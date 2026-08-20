import { describe, it, expect } from 'vitest';
import {
  verificarClientesPorDecidir,
  consolidarTotalReal,
  filtrarFaturasElegiveis,
  ratearHistorico,
  calcularPercentagemHistorica,
  executarCalculoFase1,
  extrairValorObs,
} from '../../src/lib/ajudas/percentagemHistorica.js';

// Mock de query builder que aplica de facto os filtros (.eq/.gte/.lte/.in)
// sobre o array fornecido — necessário desde que consolidarTotalReal passou
// a chamar calcularValoresPorClienteMes por mês (.eq('mes', mesFatura)); o
// mock anterior (que ignorava os filtros e devolvia sempre tudo) já não
// discriminava mês a mês.
function makeFilteringBuilder(fullData) {
  const filtros = [];
  const builder = {
    select: () => builder,
    eq: (campo, valor) => { filtros.push(row => row[campo] === valor); return builder; },
    gte: (campo, valor) => { filtros.push(row => row[campo] >= valor); return builder; },
    lte: (campo, valor) => { filtros.push(row => row[campo] <= valor); return builder; },
    in: (campo, valores) => { filtros.push(row => valores.includes(row[campo])); return builder; },
    range: () => builder,
    then: (resolve, reject) => {
      const data = (fullData || []).filter(row => filtros.every(f => f(row)));
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return builder;
}

function makeDbClient({ clients = [], validations = [], logs = [] }) {
  return {
    from(table) {
      if (table === 'clients') return makeFilteringBuilder(clients);
      if (table === 'receipt_validations') return makeFilteringBuilder(validations);
      if (table === 'logs') return makeFilteringBuilder(logs);
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
}

// Item bruto "plano" (sem envelope attributes), como confirmado em
// create-fatura.js — o mesmo formato que fetchVendasFn devolve na
// implementação real (fetchVendasTOConline).
function fatura({ documentType = 'FT', cliente, valor, data, notes = null, docNum }) {
  return {
    document_type_name: documentType,
    customer_business_name: cliente,
    gross_total: valor,
    date: data,
    notes,
    document_number: docNum,
  };
}

describe('verificarClientesPorDecidir (gate fail-closed)', () => {
  it('bloqueia quando há cliente por decidir', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: null }],
    });
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Cliente A', valor: 1000, data: '2026-05-10', docNum: 'FT1' }),
    ];

    const r = await verificarClientesPorDecidir({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient, fetchVendasFn });

    expect(r.bloqueado).toBe(true);
    expect(r.clientesPorDecidir).toEqual([{ clientId: 'c1', nome: 'Cliente A' }]);
  });

  it('permite quando todos os clientes com faturas no período estão decididos (true ou false)', async () => {
    const dbClient = makeDbClient({
      clients: [
        { id: 'c1', name: 'Cliente Elegível', elegivel_ajudas_custo: true },
        { id: 'c2', name: 'Cliente Não Elegível', elegivel_ajudas_custo: false },
      ],
    });
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Cliente Elegível', valor: 1000, data: '2026-05-10', docNum: 'FT1' }),
      fatura({ cliente: 'Cliente Não Elegível', valor: 500, data: '2026-05-11', docNum: 'FT2' }),
    ];

    const r = await verificarClientesPorDecidir({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient, fetchVendasFn });

    expect(r.bloqueado).toBe(false);
    expect(r.clientesPorDecidir).toEqual([]);
  });

  it('ignora documentos que não são faturas de receita (nota de crédito) para efeitos do gate', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: null }],
    });
    const fetchVendasFn = async () => [
      fatura({ documentType: 'NC', cliente: 'Cliente A', valor: 200, data: '2026-05-12', docNum: 'NC1' }),
    ];

    const r = await verificarClientesPorDecidir({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient, fetchVendasFn });

    // Nota de crédito não conta como fatura de receita → não gera bloqueio
    expect(r.bloqueado).toBe(false);
  });
});

describe('consolidarTotalReal (duplo desvio M→M-1 + resíduo cumulativo)', () => {
  it('usa faturas e receipt_validations do mês SEGUINTE ao de referência (duplo desvio); estados valido/pago/aviso contam, erro/invalido não', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: true }],
      validations: [
        { mes: '2020-04', ajudas_custo_extraidas: 100, estado: 'valido' },
        { mes: '2020-04', ajudas_custo_extraidas: 200, estado: 'pago' },
        { mes: '2020-04', ajudas_custo_extraidas: 50, estado: 'aviso' },
        { mes: '2020-04', ajudas_custo_extraidas: 999, estado: 'erro' },
        { mes: '2020-04', ajudas_custo_extraidas: 999, estado: 'invalido' },
      ],
    });
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Cliente A', valor: 1000, data: '2020-04-05', docNum: 'FT1', notes: null }), // sem declaração → recebe o rateio
    ];

    const r = await consolidarTotalReal({ periodoInicio: '2020-03', periodoFim: '2020-03', dbClient, fetchVendasFn });

    // 100 + 200 + 50 = 350 — 'erro' e 'invalido' ficam de fora
    expect(r.totalReal).toBeCloseTo(350, 6);
    expect(r.linhasPorMes).toHaveLength(1);
    expect(r.linhasPorMes[0].mes).toBe('2020-03'); // mês de referência, não o mês da fatura (2020-04)
  });

  it('cliente NÃO elegível participa do rateio do resíduo, mas fica fora de totalReal (numerador só soma elegivel_na_data=true)', async () => {
    const dbClient = makeDbClient({
      clients: [
        { id: 'c1', name: 'Elegível', elegivel_ajudas_custo: true },
        { id: 'c2', name: 'Não Elegível', elegivel_ajudas_custo: false },
      ],
      validations: [{ mes: '2020-04', ajudas_custo_extraidas: 100, estado: 'valido' }],
    });
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Elegível', valor: 6000, data: '2020-04-05', docNum: 'FT1', notes: null }),
      fatura({ cliente: 'Não Elegível', valor: 4000, data: '2020-04-06', docNum: 'FT2', notes: null }),
    ];

    const r = await consolidarTotalReal({ periodoInicio: '2020-03', periodoFim: '2020-03', dbClient, fetchVendasFn });

    // resíduo 100 rateado 60/40 pelo valor da fatura — só os 60 do elegível entram em totalReal
    expect(r.totalReal).toBeCloseTo(60, 6);
    const linhaNaoElegivel = r.linhasPorMes.find(l => l.client_id === 'c2');
    expect(linhaNaoElegivel.valor_atribuido).toBeCloseTo(40, 6); // recebeu rateio, mas não conta no total
  });

  it('resíduo negativo de um mês NÃO é forçado a zero — transporta-se (cumulativo) e é absorvido no mês seguinte', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: true }],
      validations: [
        { mes: '2020-04', ajudas_custo_extraidas: 50, estado: 'valido' },  // mês 1 (ref 2020-03): real=50
        { mes: '2020-05', ajudas_custo_extraidas: 300, estado: 'valido' }, // mês 2 (ref 2020-04): real=300
      ],
    });
    const fetchVendasFn = async ({ dataDe }) => {
      if (dataDe.startsWith('2020-04')) {
        // mês 1: declarado (200) > real (50) → resíduo bruto = -150
        return [fatura({ cliente: 'Cliente A', valor: 1000, data: '2020-04-05', docNum: 'FT1', notes: '€200,00' })];
      }
      // mês 2: sem declaração — recebe o saldo acumulado (-150 + 300 = 150)
      return [fatura({ cliente: 'Cliente A', valor: 1000, data: '2020-05-05', docNum: 'FT2', notes: null })];
    };

    const r = await consolidarTotalReal({ periodoInicio: '2020-03', periodoFim: '2020-04', dbClient, fetchVendasFn });

    const linhaMes1 = r.linhasPorMes.find(l => l.fatura_id === 'FT1');
    const linhaMes2 = r.linhasPorMes.find(l => l.fatura_id === 'FT2');
    expect(linhaMes1.valor_atribuido).toBeCloseTo(200, 6); // declarado, não mexe
    expect(linhaMes2.valor_atribuido).toBeCloseTo(150, 6); // saldo acumulado: -150 (mês 1) + 300 (mês 2) = 150
    expect(r.saldoAcumuladoFinal).toBeCloseTo(0, 6);
    expect(r.anomaliaSaldoFinalNegativo).toBe(false);
    expect(r.historicoSaldo).toHaveLength(2);
    expect(r.historicoSaldo[0].saldoAcumuladoSaida).toBeCloseTo(-150, 6); // fica negativo após o mês 1 — não é tratado como erro aqui
  });

  it('saldoAcumuladoFinal negativo no fim do período → anomaliaSaldoFinalNegativo=true (só isto é reportado como anomalia real)', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: true }],
      validations: [{ mes: '2020-04', ajudas_custo_extraidas: 50, estado: 'valido' }],
    });
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Cliente A', valor: 1000, data: '2020-04-05', docNum: 'FT1', notes: '€500,00' }), // declarado > real
    ];

    const r = await consolidarTotalReal({ periodoInicio: '2020-03', periodoFim: '2020-03', dbClient, fetchVendasFn });

    expect(r.saldoAcumuladoFinal).toBeCloseTo(-450, 6);
    expect(r.anomaliaSaldoFinalNegativo).toBe(true);
  });

  it('mês cujo mesFatura cai no mês corrente (ou futuro) fica em mesesComDadosInsuficientes — não altera saldoAcumulado nem totalReal', async () => {
    // periodoFim = mês anterior ao corrente real → mesFatura(periodoFim) = mês corrente → dadosInsuficientes
    const hoje = new Date();
    const anoAnt = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
    const mesAnt = hoje.getMonth() === 0 ? 12 : hoje.getMonth(); // getMonth() é 0-based; mês anterior 1-based
    const periodoFim = `${anoAnt}-${String(mesAnt).padStart(2, '0')}`;

    const dbClient = makeDbClient({ clients: [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: true }], validations: [] });
    const fetchVendasFn = async () => { throw new Error('não devia chamar fetchVendasFn para um mês com dados insuficientes'); };

    const r = await consolidarTotalReal({ periodoInicio: periodoFim, periodoFim, dbClient, fetchVendasFn });

    expect(r.mesesComDadosInsuficientes).toHaveLength(1);
    expect(r.mesesComDadosInsuficientes[0].mes).toBe(periodoFim);
    expect(r.totalReal).toBe(0);
    expect(r.saldoAcumuladoFinal).toBe(0);
  });

  it('gate de completude (mesesIncluidos/mesesExcluidos) usa o MESMO duplo desvio: recibo que reporta o trabalho de `mes` tem mes=mesSeguinte(mes)', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: true }],
      logs: [
        { workerId: 'w1', clientId: 'c1', date: '2020-03-05', hours: 8 }, // tem recibo em 2020-04 (mesSeguinte) → completo
        { workerId: 'w2', clientId: 'c1', date: '2020-03-05', hours: 8 }, // sem NENHUM recibo em 2020-04 → incompleto
      ],
      validations: [
        // reporta o trabalho de março (mes de referência), por isso mes=abril (mesSeguinte) — serve o gate (worker_id=w1) e o numerador
        { worker_id: 'w1', mes: '2020-04', ajudas_custo_extraidas: 150, estado: 'valido' },
      ],
    });
    const fetchVendasFn = async () => [
      fatura({ cliente: 'Cliente A', valor: 1000, data: '2020-04-05', docNum: 'FT1', notes: null }),
    ];

    const r = await consolidarTotalReal({ periodoInicio: '2020-03', periodoFim: '2020-03', dbClient, fetchVendasFn });

    expect(r.mesesExcluidos).toHaveLength(1);
    expect(r.mesesExcluidos[0].mes).toBe('2020-03');
    expect(r.mesesExcluidos[0].motivo).toMatch(/w2/);
    expect(r.mesesExcluidos[0].motivo).not.toMatch(/w1/);
    expect(r.mesesIncluidos).toEqual([]);
  });

  it('gate de completude — recibo com mes=mes (SEM desvio) já não conta como completo (prova a correção do bug)', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: true }],
      logs: [{ workerId: 'w1', clientId: 'c1', date: '2020-03-05', hours: 8 }],
      validations: [
        // recibo com o MESMO mes do trabalho (sem o desvio) — já não deve satisfazer o gate
        { worker_id: 'w1', mes: '2020-03', ajudas_custo_extraidas: 150, estado: 'valido' },
      ],
    });
    const fetchVendasFn = async () => [];

    const r = await consolidarTotalReal({ periodoInicio: '2020-03', periodoFim: '2020-03', dbClient, fetchVendasFn });

    expect(r.mesesExcluidos).toHaveLength(1);
    expect(r.mesesExcluidos[0].motivo).toMatch(/w1/);
    expect(r.mesesIncluidos).toEqual([]);
  });

  it('campos do método antigo (distribuicaoHoras.js) ficam vazios/zero — já não são calculados', async () => {
    const dbClient = makeDbClient({ clients: [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: true }], validations: [] });
    const fetchVendasFn = async () => [];

    const r = await consolidarTotalReal({ periodoInicio: '2020-03', periodoFim: '2020-03', dbClient, fetchVendasFn });

    expect(r.semLogs).toEqual([]);
    expect(r.totalSemLogs).toBe(0);
    expect(r.atribuicoesHistoricas).toEqual([]);
    expect(r.semWorkerId).toEqual([]);
    expect(r.totalSemWorkerId).toBe(0);
    expect(r.naoElegivel).toEqual([]);
    expect(r.totalNaoElegivel).toBe(0);
  });
});

describe('filtrarFaturasElegiveis / totalFaturamento', () => {
  it('faturamento de cliente não elegível nunca entra no denominador', () => {
    const faturas = [
      { clientId: 'c1', clienteNome: 'Elegível', valor: 1000, elegivel: true },
      { clientId: 'c2', clienteNome: 'Não elegível', valor: 5000, elegivel: false },
    ];

    const elegiveis = filtrarFaturasElegiveis(faturas);
    const totalFaturamento = elegiveis.reduce((s, f) => s + f.valor, 0);

    expect(elegiveis).toHaveLength(1);
    expect(elegiveis[0].clientId).toBe('c1');
    expect(totalFaturamento).toBe(1000); // os 5000 do cliente não elegível NUNCA entram
  });

  it('via executarCalculoFase1 (fim a fim, já com duplo desvio): totalBrutoReferencia exclui o não elegível', async () => {
    const dbClient = makeDbClient({
      clients: [
        { id: 'c1', name: 'Elegível', elegivel_ajudas_custo: true },
        { id: 'c2', name: 'Não Elegível', elegivel_ajudas_custo: false },
      ],
      logs: [{ workerId: 'w1', clientId: 'c1', date: '2026-05-05', hours: 8 }],
      // Recibo com mes=2026-06 (mesSeguinte de maio) reporta o trabalho de
      // maio — alimenta o numerador real E satisfaz o gate de completude
      // (worker_id=w1) com o mesmo duplo desvio.
      validations: [
        { worker_id: 'w1', mes: '2026-06', ajudas_custo_extraidas: 100, estado: 'valido' },
      ],
    });
    // O denominador (totalBrutoReferencia) vem das faturas do próprio mês
    // (maio); o numerador (totalAjudasReal) vem das faturas do mês
    // seguinte (junho), que é quem declara o trabalho de maio.
    const fetchVendasFn = async ({ dataDe }) => {
      if (dataDe.startsWith('2026-05')) {
        return [
          fatura({ cliente: 'Elegível', valor: 1000, data: '2026-05-10', docNum: 'FT1' }),
          fatura({ cliente: 'Não Elegível', valor: 5000, data: '2026-05-11', docNum: 'FT2' }),
        ];
      }
      return [fatura({ cliente: 'Elegível', valor: 1200, data: '2026-06-10', docNum: 'FT3', notes: '€100,00' })];
    };

    const r = await executarCalculoFase1({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient, fetchVendasFn });

    expect(r.bloqueado).toBe(false);
    expect(r.totalBrutoReferencia).toBe(1000);
    expect(r.totalAjudasReal).toBeCloseTo(100, 6); // declarado na fatura de junho, atribuído ao cliente elegível c1
    expect(r.clientesElegiveis).toEqual(['c1']);
  });
});

describe('ratearHistorico (correção de dupla contagem: faturas com valor manual saem do rateio)', () => {
  it('faturas sem valor manual entram no rateio, proporcionalmente só entre si', () => {
    const faturasElegiveisDoPeriodo = [
      { clientId: 'c1', faturaId: 'FT1', mes: '2026-05', valor: 600, valorObservacaoManual: null },
      { clientId: 'c3', faturaId: 'FT3', mes: '2026-05', valor: 400, valorObservacaoManual: null },
    ];

    const linhas = ratearHistorico({ totalAjudasRealAjustado: 100, faturasElegiveisDoPeriodo });

    expect(linhas).toHaveLength(2);
    const l1 = linhas.find(l => l.client_id === 'c1');
    const l3 = linhas.find(l => l.client_id === 'c3');

    expect(l1.valor_observacao_manual).toBeNull();
    expect(l1.valor_estimado_bruto).toBeCloseTo(60, 6); // 600/1000 × 100
    expect(l1.origem).toBe('historico');
    expect(l1.status).toBe('historico');
    expect(l1.valor_fatura).toBe(600); // valor total da fatura, não só a ajuda de custo

    expect(l3.valor_estimado_bruto).toBeCloseTo(40, 6); // 400/1000 × 100
    expect(l3.valor_fatura).toBe(400);
  });

  it('fatura COM valor manual fica de fora do rateio, mas aparece no relatório com o próprio valor declarado (nunca recalculado)', () => {
    const faturasElegiveisDoPeriodo = [
      { clientId: 'c1', faturaId: 'FT1', mes: '2026-05', valor: 600, valorObservacaoManual: null },
      { clientId: 'c2', faturaId: 'FT2', mes: '2026-05', valor: 400, valorObservacaoManual: 45.5 },
    ];

    // totalAjudasRealAjustado já vem sem o que está declarado (45.5) — o
    // rateio distribui só pela fatura SEM valor manual (FT1), que aqui é a
    // única, por isso recebe o ajustado inteiro (60).
    const linhas = ratearHistorico({ totalAjudasRealAjustado: 60, faturasElegiveisDoPeriodo });

    expect(linhas).toHaveLength(2);
    const l1 = linhas.find(l => l.client_id === 'c1');
    const l2 = linhas.find(l => l.client_id === 'c2');

    expect(l1.valor_estimado_bruto).toBeCloseTo(60, 6);
    expect(l1.valor_final).toBeCloseTo(60, 6);
    expect(l1.origem).toBe('historico');
    expect(l1.status).toBe('historico');

    // Fatura com valor manual: fora do rateio proporcional — valor_final é
    // o próprio valor já declarado na observação, não um valor calculado.
    expect(l2.valor_observacao_manual).toBeCloseTo(45.5, 6);
    expect(l2.valor_estimado_bruto).toBeCloseTo(45.5, 6);
    expect(l2.valor_final).toBeCloseTo(45.5, 6);
    expect(l2.origem).toBe('historico');
    expect(l2.status).toBe('historico');

    // valor_fatura (total da fatura) presente nos dois casos, mesmo na
    // fatura com valor manual — nunca confundir com valor_final (só a
    // ajuda de custo).
    expect(l1.valor_fatura).toBe(600);
    expect(l2.valor_fatura).toBe(400);
  });
});

describe('executarCalculoFase1 — faturas com valor manual já declarado (correção de dupla contagem)', () => {
  it('exclui faturas com valor manual do numerador E do denominador; % calculada só sobre as faturas sem valor manual', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: true }],
      logs: [{ workerId: 'w1', clientId: 'c1', date: '2026-05-05', hours: 8 }],
      validations: [{ worker_id: 'w1', mes: '2026-06', ajudas_custo_extraidas: 300, estado: 'valido' }],
    });
    const fetchVendasFn = async ({ dataDe }) => {
      if (dataDe.startsWith('2026-05')) {
        return [
          fatura({ cliente: 'Cliente A', valor: 1000, data: '2026-05-10', docNum: 'FT1', notes: null }), // sem valor manual
          fatura({ cliente: 'Cliente A', valor: 500, data: '2026-05-11', docNum: 'FT2', notes: '€50,00' }), // já declarado
        ];
      }
      // Fatura de junho (mesFatura de maio) sem declaração — recebe o resíduo (300), alimenta o numerador (totalReal).
      return [fatura({ cliente: 'Cliente A', valor: 1200, data: '2026-06-10', docNum: 'FT3', notes: null })];
    };

    const r = await executarCalculoFase1({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient, fetchVendasFn });

    expect(r.bloqueado).toBe(false);
    expect(r.valorManualTotal).toBeCloseTo(50, 6);
    expect(r.faturasComValorManualCount).toBe(1);
    expect(r.totalAjudasRealComRecibos).toBeCloseTo(300, 6); // total real ANTES do ajuste
    expect(r.totalAjudasReal).toBeCloseTo(250, 6); // 300 − 50 (ajustado)
    expect(r.totalBrutoReferencia).toBe(1000); // só FT1 — FT2 (com valor manual) sai do denominador
    expect(r.percentagem).toBeCloseTo(0.25, 6); // 250 / 1000

    const linhaFT1 = r.linhasHistoricas.find(l => l.fatura_id === 'FT1');
    const linhaFT2 = r.linhasHistoricas.find(l => l.fatura_id === 'FT2');
    expect(linhaFT1.valor_final).toBeCloseTo(250, 6); // recebe TODO o ajustado — é a única sem valor manual
    expect(linhaFT2.valor_final).toBeCloseTo(50, 6); // o próprio valor declarado, nunca recalculado
    expect(linhaFT2.origem).toBe('historico');
    expect(linhaFT2.status).toBe('historico');
  });

  it('caso limite: valorManualTotal > totalReal → bloqueado com os números para decisão humana, não decide sozinho', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', name: 'Cliente A', elegivel_ajudas_custo: true }],
      logs: [{ workerId: 'w1', clientId: 'c1', date: '2026-05-05', hours: 8 }],
      validations: [{ worker_id: 'w1', mes: '2026-06', ajudas_custo_extraidas: 30, estado: 'valido' }],
    });
    const fetchVendasFn = async ({ dataDe }) => {
      if (dataDe.startsWith('2026-05')) {
        // valor manual (999) > total real que o numerador vai ter (30)
        return [fatura({ cliente: 'Cliente A', valor: 500, data: '2026-05-11', docNum: 'FT2', notes: '€999,00' })];
      }
      return [fatura({ cliente: 'Cliente A', valor: 1000, data: '2026-06-05', docNum: 'FT3', notes: null })];
    };

    const r = await executarCalculoFase1({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient, fetchVendasFn });

    expect(r.bloqueado).toBe(true);
    expect(r.motivoBloqueio).toBe('valor_manual_excede_total_real');
    expect(r.valorManualTotal).toBeCloseTo(999, 6);
    expect(r.totalAjudasRealComRecibos).toBeCloseTo(30, 6);
    expect(r.percentagem).toBeUndefined();
    expect(r.linhasHistoricas).toBeUndefined();
  });

  // Correção de 2026-08-20: 8 faturas específicas (Caldereria Gurelan,
  // Caldereria Kortaberri, Ferrocal Steel, Grandes Mecanizados — 2026-06 e
  // 2026-07) têm valor_observacao_manual preenchido mas confirmado como
  // placeholder aleatório (sem base em recibo real), ao contrário dos
  // outros 17 valores manuais genuínos do período. Tratadas como SEM valor
  // manual no cálculo — entram no rateio normalmente — mas o valor escrito
  // na observação não é apagado, fica como referência histórica.
  it('fatura na lista FATURAS_VALOR_MANUAL_PLACEHOLDER é tratada como SEM valor manual (entra no rateio), mas mantém valor_observacao_manual como referência', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1775487604163', name: 'Caldereria Gurelan Teste', elegivel_ajudas_custo: true }],
      logs: [{ workerId: 'w1', clientId: 'c1775487604163', date: '2026-06-05', hours: 8 }],
      validations: [{ worker_id: 'w1', mes: '2026-07', ajudas_custo_extraidas: 200, estado: 'valido' }],
    });
    const fetchVendasFn = async ({ dataDe }) => {
      if (dataDe.startsWith('2026-06')) {
        // Mesma chave (client_id, mes, fatura_id) de uma das 8 faturas
        // confirmadas como placeholder.
        return [fatura({ cliente: 'Caldereria Gurelan Teste', valor: 12000, data: '2026-06-15', docNum: 'FT 2026/36', notes: '€6.040,00' })];
      }
      return [fatura({ cliente: 'Caldereria Gurelan Teste', valor: 1000, data: '2026-07-05', docNum: 'FT-JUL', notes: null })];
    };

    const r = await executarCalculoFase1({ periodoInicio: '2026-06', periodoFim: '2026-06', dbClient, fetchVendasFn });

    expect(r.bloqueado).toBe(false);
    // Placeholder não conta para valorManualTotal — só entraria se fosse genuína.
    expect(r.valorManualTotal).toBe(0);
    expect(r.faturasComValorManualCount).toBe(0);
    // O valor da fatura volta para o universo do rateio (denominador).
    expect(r.totalBrutoReferencia).toBe(12000);

    const linha = r.linhasHistoricas.find(l => l.fatura_id === 'FT 2026/36');
    expect(linha).toBeTruthy();
    expect(linha.status).toBe('historico');
    // Recebeu o rateio (é a única fatura do mês), não o seu próprio valor manual (6040).
    expect(linha.valor_final).toBeCloseTo(200, 6);
    // Mas o valor que lá estava escrito continua guardado como referência.
    expect(linha.valor_observacao_manual).toBeCloseTo(6040, 6);
  });
});

describe('calcularPercentagemHistorica', () => {
  it('calcula a percentagem como totalReal / totalFaturamento', () => {
    const r = calcularPercentagemHistorica({ totalReal: 85, totalFaturamento: 1000 });
    expect(r.percentagem).toBeCloseTo(0.085, 6);
    expect(r.totalAjudasReal).toBe(85);
    expect(r.totalBrutoReferencia).toBe(1000);
  });

  it('totalFaturamento 0 → percentagem 0, sem divisão por zero', () => {
    const r = calcularPercentagemHistorica({ totalReal: 85, totalFaturamento: 0 });
    expect(r.percentagem).toBe(0);
  });
});

describe('extrairValorObs', () => {
  it('prioriza o padrão €X.XXX,XX sobre um número genérico no texto', () => {
    expect(extrairValorObs('Ref. 2026 — €1.234,56 incluídos')).toBeCloseTo(1234.56, 6);
  });

  it('sem observação → null', () => {
    expect(extrairValorObs(null)).toBeNull();
    expect(extrairValorObs('')).toBeNull();
  });

  // Correção do bug de parsing: separador de milhares por espaço não era
  // reconhecido — "€21 248,50" ficava capturado só "21" (a regex parava no
  // primeiro carácter fora de [\d.,]). Casos pedidos explicitamente:
  it('separador de milhares por ESPAÇO (bug corrigido — antes capturava só "21")', () => {
    expect(extrairValorObs('Estão incluídas nesta fatura €21 248,50 referentes a ajudas de custo.')).toBeCloseTo(21248.50, 6);
  });

  it('separador de milhares por PONTO continua a funcionar', () => {
    expect(extrairValorObs('€1.234,56')).toBeCloseTo(1234.56, 6);
  });

  it('sem separador de milhares (valor pequeno) continua a funcionar como antes', () => {
    expect(extrairValorObs('€224,00')).toBeCloseTo(224.00, 6);
    expect(extrairValorObs('€91,86')).toBeCloseTo(91.86, 6);
  });

  it('não consome o espaço a seguir ao valor quando não é seguido de outro dígito', () => {
    // "€224,00 referentes" — o espaço antes de "referentes" não pode ficar
    // colado ao número capturado (senão _parseMonetario recebia lixo).
    expect(extrairValorObs('Estão incluídas nesta fatura €224,00 referentes a ajudas de custo.')).toBeCloseTo(224.00, 6);
  });

  // Casos adicionais encontrados na investigação de observações reais
  // (faturas TOConline, 2025-12 a 2026-07) — nenhum tinha separador por
  // espaço, mas surgiram estes outros formatos, já cobertos:
  it('espaço entre € e o valor, ponto de milhares (formato real mais comum)', () => {
    expect(extrairValorObs('...trabalhadores. € 6.439,00')).toBeCloseTo(6439.00, 6);
  });

  it('€ colado ao valor, sem espaço antes nem depois do ponto final da frase anterior', () => {
    expect(extrairValorObs('...trabalhadores.€8.087,04')).toBeCloseTo(8087.04, 6);
    expect(extrairValorObs('...trabalhadores€12.509,64')).toBeCloseTo(12509.64, 6);
  });

  it('valor sem símbolo € (fallback), com ponto de milhares e vírgula decimal', () => {
    expect(extrairValorObs('...trabalhadores 13.555,49.')).toBeCloseTo(13555.49, 6);
  });

  it('valor com ponto decimal (sem separador de milhares) e € depois do número', () => {
    expect(extrairValorObs('...trabalhadores 16733.68 €')).toBeCloseTo(16733.68, 6);
    expect(extrairValorObs('...trabalhadores 7656.12€')).toBeCloseTo(7656.12, 6);
  });

  it('dois pontos sem vírgula com último grupo de 2 dígitos → tratado como erro de digitação (ponto por vírgula decimal)', () => {
    // Encontrado em FT 2026A/1: "€13.815.05" — se tratássemos os dois
    // pontos como milhares dava 1.381.505 (100x maior que a fatura real,
    // ~14 mil €), por isso o último grupo de 2 dígitos é interpretado como
    // decimal.
    expect(extrairValorObs('...trabalhadores €13.815.05')).toBeCloseTo(13815.05, 6);
  });

  it('múltiplos pontos com último grupo de 3 dígitos continua a ser lido como inteiro de milhares', () => {
    expect(extrairValorObs('€1.234.567')).toBeCloseTo(1234567, 6);
  });
});
