import { describe, it, expect, vi } from 'vitest';
import { verificarEstimativaParaFatura, confirmarEEmitirFatura } from '../../src/lib/ajudas/emitirFaturaComAjudas.js';

// Mock de query builder encadeável, com suporte a .maybeSingle(), .in(), .is(), .single().
function makeQueryBuilder(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    update: () => builder,
    maybeSingle: () => Promise.resolve(result.single ?? result),
    single: () => Promise.resolve(result.single ?? result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function makeDbClient({ clients = [], percentagemAtiva = null, residuoPendente = null, estimativaExistente = null, calls = [] }) {
  return {
    from(table) {
      calls.push(table);
      if (table === 'clients') return makeQueryBuilder({ data: clients, error: null });
      if (table === 'ajudas_percentagem_historica') return makeQueryBuilder({ single: { data: percentagemAtiva, error: null } });
      if (table === 'ajudas_reconciliacao_mensal') return makeQueryBuilder({ single: { data: residuoPendente, error: null } });
      if (table === 'ajudas_estimativas_fatura') {
        return makeQueryBuilder({
          single: { data: estimativaExistente ? { id: estimativaExistente } : { id: 'nova-estimativa-id' }, error: null },
          data: estimativaExistente ? { id: estimativaExistente } : null,
          error: null,
        });
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
}

describe('verificarEstimativaParaFatura', () => {
  it('mesReferencia é usado tal-e-qual (regra M→M-1): fatura emitida em agosto refere-se ao mês de referência julho', async () => {
    const criarFaturaFn = vi.fn();
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', elegivel_ajudas_custo: true }],
      percentagemAtiva: { id: 'pct1', percentagem: 0.1 },
    });

    // Fatura emitida "hoje" (agosto), mas o trabalho faturado é de julho —
    // o mesReferencia passado tem de ser '2026-07', nunca o mês de emissão.
    const mesReferencia = '2026-07';
    const r = await verificarEstimativaParaFatura({
      mesReferencia, clientId: 'c1', valorFinalDoModal: 1000, dbClient,
    });

    expect(r.linha.status).toBe('calculado');
    expect(r.linha.valorEstimadoBruto).toBeCloseTo(100, 6);
    expect(r.percentagemHistoricaId).toBe('pct1');
    expect(criarFaturaFn).not.toHaveBeenCalled();
  });

  it('cliente sem decisão de elegibilidade → linha bloqueada, motivo explícito para a UI', async () => {
    const dbClient = makeDbClient({
      clients: [{ id: 'c1', elegivel_ajudas_custo: null }],
      percentagemAtiva: { id: 'pct1', percentagem: 0.1 },
    });
    const r = await verificarEstimativaParaFatura({ mesReferencia: '2026-07', clientId: 'c1', valorFinalDoModal: 1000, dbClient });
    expect(r.linha.status).toBe('bloqueado');
    expect(r.linha.motivoBloqueio).toBe('cliente sem decisao de elegibilidade');
  });
});

describe('confirmarEEmitirFatura', () => {
  const linhaCalculada = {
    clientId: 'c1', faturaId: null, valorEstimadoBruto: 100, residuoAplicado: 0, valorFinal: 100, status: 'calculado', motivoBloqueio: null,
  };

  it('fatura bloqueada nunca chega a chamar create-fatura.js (lança antes de qualquer chamada)', async () => {
    const criarFaturaFn = vi.fn();
    const dbClient = makeDbClient({});
    const linhaBloqueada = { ...linhaCalculada, status: 'bloqueado', motivoBloqueio: 'sem percentagem historica ativa' };

    await expect(confirmarEEmitirFatura({
      mesReferencia: '2026-07', clientId: 'c1', linha: linhaBloqueada, percentagemHistoricaId: null,
      dbClient, confirmadoPor: 'admin@x.pt', criarFaturaFn,
    })).rejects.toThrow(/nunca bloqueada/);

    expect(criarFaturaFn).not.toHaveBeenCalled();
  });

  it('linha calculada + confirmação → grava status "confirmado" ANTES de chamar create-fatura.js', async () => {
    const chamadas = [];
    const realDbClient = {
      from(table) {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          in: () => builder,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          insert: (payload) => { chamadas.push({ tipo: 'insert', table, payload }); return builder; },
          update: (payload) => { chamadas.push({ tipo: 'update', table, payload }); return builder; },
          upsert: (payload, opts) => { chamadas.push({ tipo: 'upsert', table, payload, opts }); return Promise.resolve({ data: null, error: null }); },
          single: () => Promise.resolve({ data: { id: 'est1' }, error: null }),
        };
        return builder;
      },
    };

    let statusNoMomentoDaChamadaApi = null;
    const criarFaturaFn = vi.fn(async () => {
      statusNoMomentoDaChamadaApi = chamadas.find(c => c.tipo === 'insert')?.payload?.status;
      return { faturaId: 'FT 2026/99' };
    });

    const r = await confirmarEEmitirFatura({
      mesReferencia: '2026-07', clientId: 'c1', linha: linhaCalculada, percentagemHistoricaId: 'pct1',
      dbClient: realDbClient, confirmadoPor: 'admin@x.pt', criarFaturaFn,
    });

    expect(statusNoMomentoDaChamadaApi).toBe('confirmado');
    expect(criarFaturaFn).toHaveBeenCalledTimes(1);
    expect(r.faturado).toBe(true);
    expect(r.faturaId).toBe('FT 2026/99');

    const updateFinal = chamadas.find(c => c.tipo === 'update');
    expect(updateFinal.payload).toEqual({ status: 'faturado', fatura_id: 'FT 2026/99' });
  });

  it('sucesso na API → transita "confirmado" para "faturado" e grava fatura_id', async () => {
    const chamadas = [];
    const dbClient = {
      from(table) {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          in: () => builder,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          insert: (payload) => { chamadas.push({ tipo: 'insert', payload }); return builder; },
          update: (payload) => { chamadas.push({ tipo: 'update', payload }); return builder; },
          upsert: (payload, opts) => { chamadas.push({ tipo: 'upsert', table, payload, opts }); return Promise.resolve({ data: null, error: null }); },
          single: () => Promise.resolve({ data: { id: 'est1' }, error: null }),
        };
        return builder;
      },
    };
    const criarFaturaFn = vi.fn(async () => ({ faturaId: 'FT 2026/100' }));

    const r = await confirmarEEmitirFatura({
      mesReferencia: '2026-07', clientId: 'c1', linha: linhaCalculada, percentagemHistoricaId: 'pct1',
      dbClient, confirmadoPor: 'admin@x.pt', criarFaturaFn,
    });

    expect(r.confirmado).toBe(true);
    expect(r.faturado).toBe(true);
    expect(r.faturaId).toBe('FT 2026/100');
    const update = chamadas.find(c => c.tipo === 'update');
    expect(update.payload.status).toBe('faturado');
    expect(update.payload.fatura_id).toBe('FT 2026/100');
  });

  it('sucesso na API → grava exatamente 1 linha nova em ajudas_valores_por_cliente_mes com origem="sistema" e os valores corretos', async () => {
    const chamadas = [];
    const dbClient = {
      from(table) {
        if (table === 'clients') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { elegivel_ajudas_custo: true }, error: null }),
              }),
            }),
          };
        }
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          in: () => builder,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          insert: (payload) => { chamadas.push({ tipo: 'insert', table, payload }); return builder; },
          update: (payload) => { chamadas.push({ tipo: 'update', table, payload }); return builder; },
          upsert: (payload, opts) => { chamadas.push({ tipo: 'upsert', table, payload, opts }); return Promise.resolve({ data: null, error: null }); },
          single: () => Promise.resolve({ data: { id: 'est1' }, error: null }),
        };
        return builder;
      },
    };
    const criarFaturaFn = vi.fn(async () => ({ faturaId: 'FT 2026/101' }));

    const r = await confirmarEEmitirFatura({
      mesReferencia: '2026-07', clientId: 'c1', linha: linhaCalculada, percentagemHistoricaId: 'pct1',
      dbClient, confirmadoPor: 'admin@x.pt', criarFaturaFn, valorFaturaTotal: 1000,
    });

    expect(r.erroValoresPorCliente).toBeNull();
    const upsertsValores = chamadas.filter(c => c.tipo === 'upsert' && c.table === 'ajudas_valores_por_cliente_mes');
    expect(upsertsValores).toHaveLength(1);
    expect(upsertsValores[0].payload).toEqual({
      mes: '2026-07',
      client_id: 'c1',
      fatura_id: 'FT 2026/101',
      valor_fatura: 1000,
      valor_declarado: null,
      valor_atribuido: linhaCalculada.valorFinal,
      origem: 'sistema',
      elegivel_na_data: true,
    });
    expect(upsertsValores[0].opts).toEqual({ onConflict: 'mes,client_id,fatura_id' });
  });

  it('sem valorFaturaTotal → não escreve em ajudas_valores_por_cliente_mes (valor_fatura é NOT NULL), reporta o motivo sem lançar', async () => {
    const chamadas = [];
    const dbClient = {
      from(table) {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          in: () => builder,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          insert: (payload) => { chamadas.push({ tipo: 'insert', table, payload }); return builder; },
          update: (payload) => { chamadas.push({ tipo: 'update', table, payload }); return builder; },
          upsert: (payload, opts) => { chamadas.push({ tipo: 'upsert', table, payload, opts }); return Promise.resolve({ data: null, error: null }); },
          single: () => Promise.resolve({ data: { id: 'est1' }, error: null }),
        };
        return builder;
      },
    };
    const criarFaturaFn = vi.fn(async () => ({ faturaId: 'FT 2026/102' }));

    const r = await confirmarEEmitirFatura({
      mesReferencia: '2026-07', clientId: 'c1', linha: linhaCalculada, percentagemHistoricaId: 'pct1',
      dbClient, confirmadoPor: 'admin@x.pt', criarFaturaFn,
    });

    expect(r.faturado).toBe(true); // a emissão em si não é afetada
    expect(r.erroValoresPorCliente).toMatch(/valorFaturaTotal/);
    expect(chamadas.some(c => c.tipo === 'upsert' && c.table === 'ajudas_valores_por_cliente_mes')).toBe(false);
  });

  // Fase 2b, correção do Ponto 1: o mecanismo antigo (cálculo independente,
  // lido de ajudas_faturadas_clientes/estimativa das últimas médias) já não
  // escreve texto nem alimenta essa tabela — só o valor NOVO
  // (calcularEstimativaMensal) o faz, e é sempre o mesmo valor em ambos os
  // sítios (texto da observação e tabela legada).
  it('só o mecanismo NOVO alimenta o texto e a tabela legada — mesmo quando o antigo teria produzido um valor diferente', async () => {
    const chamadas = [];
    const dbClient = {
      from(table) {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          in: () => builder,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          insert: (payload) => { chamadas.push({ tipo: 'insert', table, payload }); return builder; },
          update: (payload) => { chamadas.push({ tipo: 'update', table, payload }); return builder; },
          upsert: (payload, opts) => { chamadas.push({ tipo: 'upsert', table, payload, opts }); return Promise.resolve({ data: null, error: null }); },
          single: () => Promise.resolve({ data: { id: 'est1' }, error: null }),
        };
        return builder;
      },
    };

    // Valor que o mecanismo ANTIGO teria produzido (ex.: média dos últimos
    // 3 meses, ou valor de ajudas_faturadas_clientes já existente) —
    // deliberadamente diferente do valor do mecanismo novo (linhaCalculada,
    // valorFinal = 100), para provar que não influencia nada abaixo.
    const valorMecanismoAntigo = 250.00;
    expect(valorMecanismoAntigo).not.toBe(linhaCalculada.valorFinal);

    let textoRecebidoPorCriarFaturaFn = null;
    const criarFaturaFn = vi.fn(async ({ textoObservacaoAjudas }) => {
      textoRecebidoPorCriarFaturaFn = textoObservacaoAjudas;
      return { faturaId: 'FT 2026/200' };
    });

    const r = await confirmarEEmitirFatura({
      mesReferencia: '2026-07', clientId: 'c1', linha: linhaCalculada, percentagemHistoricaId: 'pct1',
      dbClient, confirmadoPor: 'admin@x.pt', criarFaturaFn, valorFaturaTotal: 1000,
    });

    // Um único texto passado para a criação da fatura — nenhuma referência
    // ao valor do mecanismo antigo, só ao valorFinal do mecanismo novo.
    // Formato PT (vírgula decimal), não o toFixed(2) em inglês — texto
    // real escrito na fatura fiscal, não só o parser de releitura.
    expect(textoRecebidoPorCriarFaturaFn).toBe('Estão incluídas nesta fatura €100,00 referentes a ajudas de custo.');
    expect(textoRecebidoPorCriarFaturaFn).not.toContain(String(valorMecanismoAntigo));

    // ajudas_faturadas_clientes (tabela legada) fica com o valor NOVO.
    const upsert = chamadas.find(c => c.tipo === 'upsert' && c.table === 'ajudas_faturadas_clientes');
    expect(upsert).toBeTruthy();
    expect(upsert.payload.valor_ajudas).toBe(linhaCalculada.valorFinal);
    expect(upsert.payload.valor_ajudas).not.toBe(valorMecanismoAntigo);
    expect(upsert.payload.mes).toBe('2026-07');
    expect(upsert.payload.client_id).toBe('c1');
    expect(upsert.payload.total_fatura).toBe(1000);
    expect(upsert.payload.confirmado).toBe(true);
    expect(upsert.opts).toEqual({ onConflict: 'mes,client_id' });

    expect(r.faturado).toBe(true);
    expect(r.erroLegado).toBeNull();
  });

  it('texto da observação usa vírgula decimal (formato PT), não ponto — corrigido na escrita, não só na releitura', async () => {
    const dbClient = {
      from(table) {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          in: () => builder,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          insert: () => builder,
          update: () => builder,
          upsert: () => Promise.resolve({ data: null, error: null }),
          single: () => Promise.resolve({ data: { id: 'est1' }, error: null }),
        };
        return builder;
      },
    };
    let texto = null;
    const criarFaturaFn = vi.fn(async ({ textoObservacaoAjudas }) => {
      texto = textoObservacaoAjudas;
      return { faturaId: 'FT 2026/300' };
    });

    // Valor acima de 1000 — não só a vírgula decimal, também o
    // comportamento (real, não assumido) do separador de milhares em
    // pt-PT: o Intl/toLocaleString desta locale não agrupa milhares (ao
    // contrário de pt-BR/de-DE) — mesmo formatador usado em
    // AjudasCustoAdmin.jsx (fmtEur), por isso este teste fixa o
    // comportamento real e evita uma regressão silenciosa se a locale
    // mudar de comportamento numa atualização de Node/ICU.
    const linhaGrande = { clientId: 'c1', faturaId: null, valorEstimadoBruto: 1234.5, residuoAplicado: 0.06, valorFinal: 1234.56, status: 'calculado', motivoBloqueio: null };

    await confirmarEEmitirFatura({
      mesReferencia: '2026-07', clientId: 'c1', linha: linhaGrande, percentagemHistoricaId: 'pct1',
      dbClient, confirmadoPor: 'admin@x.pt', criarFaturaFn, valorFaturaTotal: 5000,
    });

    expect(texto).toBe('Estão incluídas nesta fatura €' + (1234.56).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' referentes a ajudas de custo.');
    expect(texto).not.toContain('1234.56');
    expect(texto).toContain('1234,56');
  });

  it('falha na API → mantém "confirmado", não regride, não perde o registo da confirmação humana', async () => {
    const chamadas = [];
    const dbClient = {
      from(table) {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          in: () => builder,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          insert: (payload) => { chamadas.push({ tipo: 'insert', payload }); return builder; },
          update: (payload) => { chamadas.push({ tipo: 'update', payload }); return builder; },
          upsert: (payload, opts) => { chamadas.push({ tipo: 'upsert', table, payload, opts }); return Promise.resolve({ data: null, error: null }); },
          single: () => Promise.resolve({ data: { id: 'est1' }, error: null }),
        };
        return builder;
      },
    };
    const criarFaturaFn = vi.fn(async () => { throw new Error('TOConline indisponível'); });

    const r = await confirmarEEmitirFatura({
      mesReferencia: '2026-07', clientId: 'c1', linha: linhaCalculada, percentagemHistoricaId: 'pct1',
      dbClient, confirmadoPor: 'admin@x.pt', criarFaturaFn,
    });

    expect(r.confirmado).toBe(true);
    expect(r.faturado).toBe(false);
    expect(r.erro).toBe('TOConline indisponível');

    // Nenhum update para 'faturado' foi feito — só o insert inicial com status 'confirmado'.
    const updates = chamadas.filter(c => c.tipo === 'update');
    expect(updates).toHaveLength(0);
    const insert = chamadas.find(c => c.tipo === 'insert');
    expect(insert.payload.status).toBe('confirmado');
  });

  it('retry após falha anterior: reaproveita o registo existente (fatura_id NULL) em vez de duplicar', async () => {
    const chamadas = [];
    const dbClient = {
      from(table) {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          in: () => builder,
          maybeSingle: () => Promise.resolve({ data: { id: 'est-existente' }, error: null }),
          insert: (payload) => { chamadas.push({ tipo: 'insert', payload }); return builder; },
          update: (payload) => { chamadas.push({ tipo: 'update', payload }); return builder; },
          single: () => Promise.resolve({ data: { id: 'nao-devia-ser-usado' }, error: null }),
        };
        return builder;
      },
    };
    const criarFaturaFn = vi.fn(async () => ({ faturaId: 'FT 2026/101' }));

    const r = await confirmarEEmitirFatura({
      mesReferencia: '2026-07', clientId: 'c1', linha: linhaCalculada, percentagemHistoricaId: 'pct1',
      dbClient, confirmadoPor: 'admin@x.pt', criarFaturaFn,
    });

    expect(chamadas.some(c => c.tipo === 'insert')).toBe(false); // nunca insere de novo
    expect(r.estimativaId).toBe('est-existente');
    const update = chamadas.find(c => c.tipo === 'update' && c.payload.status === 'faturado');
    expect(update).toBeTruthy();
  });
});
