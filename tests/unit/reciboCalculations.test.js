import { describe, it, expect } from 'vitest';
import {
  calcularIRS,
  taxaEfetiva,
  valorDiarioLegal,
  calcularRecibo,
  gerarLinhasMapa,
  LIMITES,
} from '../../src/lib/payroll/reciboCalculations.js';

describe('calcularIRS', () => {
  it('retorna 0 quando rendimento está abaixo do mínimo (tabela I)', () => {
    expect(calcularIRS(900, 'tabelaI', 0)).toBe(0);
  });

  it('retorna 0 quando rendimento é 0', () => {
    expect(calcularIRS(0, 'tabelaI', 0)).toBe(0);
  });

  it('tabela I, rendimento 1000€ sem dependentes → valor positivo esperado', () => {
    const irs = calcularIRS(1000, 'tabelaI', 0);
    // 1000 > 920 e ≤ 1042: taxa 12,5%, parcela transitória
    expect(irs).toBeGreaterThan(0);
    expect(irs).toBeLessThan(200);
  });

  it('tabela I, rendimento 1819€ → escalão 24,1%', () => {
    // Limite superior do escalão 24,1% é 1819
    const irs = calcularIRS(1819, 'tabelaI', 0);
    // IRS = 1819 * 0.241 - 193.33 - 0 = 438.38 - 193.33 = 245.05
    expect(irs).toBeCloseTo(245.05, 0);
  });

  it('deduz adicional por dependente (tabela II)', () => {
    const irsSem = calcularIRS(1500, 'tabelaII', 0);
    const irsCom = calcularIRS(1500, 'tabelaII', 1);
    expect(irsCom).toBeLessThan(irsSem);
    expect(irsSem - irsCom).toBeCloseTo(34.29, 1);
  });

  it('tabela III (casado único titular) tem limiar de isenção mais alto', () => {
    // Abaixo de 991 → 0
    expect(calcularIRS(990, 'tabelaIII', 0)).toBe(0);
    // Tabela I: 990 > 920 → já tem IRS
    expect(calcularIRS(990, 'tabelaI', 0)).toBeGreaterThan(0);
  });
});

describe('taxaEfetiva', () => {
  it('retorna 0 para rendimento 0', () => {
    expect(taxaEfetiva(0, 'tabelaI', 0)).toBe(0);
  });

  it('taxa nunca excede 47,17%', () => {
    const taxa = taxaEfetiva(50000, 'tabelaI', 0);
    expect(taxa).toBeLessThanOrEqual(0.4717);
  });
});

describe('valorDiarioLegal', () => {
  it('nacional → 65,89€ (DL n.º 1/2025)', () => {
    expect(valorDiarioLegal('nacional', 'geral')).toBe(65.89);
  });

  it('internacional / geral → 156,36€ (DL n.º 29-A/2026)', () => {
    expect(valorDiarioLegal('internacional', 'geral')).toBe(156.36);
  });

  it('internacional / gerência → 175,42€ (DL n.º 29-A/2026)', () => {
    expect(valorDiarioLegal('internacional', 'gerencia')).toBe(175.42);
  });
});

describe('calcularRecibo', () => {
  // Caso real: André Marcos Silva – vencimento base 1000€, bruto alvo 4464€
  const inputsBase = {
    vencimentoBase: 1000,
    horasSemana: 40,
    premios: 0,
    he1: 0,
    he2: 0,
    incluirFerias: true,
    incluirNatal: true,
    subsAlimValorDia: 8.00,
    subsAlimDias: 20,
    subsAlimTipo: 'cartao',
    tabelaKey: 'tabelaI',
    nDependentes: 0,
    brutoAlvo: 4464,
    territorio: 'internacional',
    funcao: 'geral',
  };

  it('calcula salário/hora correto a 40h/semana', () => {
    const r = calcularRecibo(inputsBase);
    // 1000 * 12 / (52 * 40) = 5.769...
    expect(r.salarioHora).toBeCloseTo(5.769, 2);
  });

  it('subsídio alimentação 8€/dia em cartão (limite 10,46) → sem excedente', () => {
    const r = calcularRecibo(inputsBase);
    expect(r.subsAlimExcedente).toBe(0);
    expect(r.subsAlimTotal).toBeCloseTo(160, 2);
  });

  it('subsídio alimentação acima do limite em dinheiro → excedente sujeito a IRS/SS', () => {
    const r = calcularRecibo({ ...inputsBase, subsAlimValorDia: 7, subsAlimTipo: 'dinheiro' });
    // limite dinheiro: 6,15 → excedente: (7 - 6.15) * 20 = 17€
    expect(r.subsAlimExcedente).toBeCloseTo(17, 2);
    // base regular NÃO inclui duodécimos — só vencimento + excedente
    expect(r.incidenciaRegular).toBeCloseTo(1000 + 17, 1);
  });

  it('duodécimos de férias e natal = vencimentoBase / 12 cada', () => {
    const r = calcularRecibo(inputsBase);
    expect(r.subsFerias).toBeCloseTo(1000 / 12, 2);
    expect(r.subsNatal).toBeCloseTo(1000 / 12, 2);
  });

  it('ajuda de custo = brutoAlvo − restantes abonos', () => {
    const r = calcularRecibo(inputsBase);
    const esperadaOutros = 1000 + 160 + (1000 / 12) + 0 + 0 + (1000 / 12);
    const esperadaAjuda  = 4464 - esperadaOutros;
    expect(r.ajudaCustoNecessaria).toBeCloseTo(esperadaAjuda, 1);
    // Total abonos = bruto alvo
    expect(r.totalAbonos).toBeCloseTo(4464, 1);
  });

  it('SS trabalhador = 11% da base de incidência', () => {
    const r = calcularRecibo(inputsBase);
    expect(r.ssTrabalhador).toBeCloseTo(r.incidenciaSS * LIMITES.ssTrabalhador, 2);
  });

  it('IRS total > 0 para rendimento acima do mínimo', () => {
    const r = calcularRecibo(inputsBase);
    expect(r.irsTotal).toBeGreaterThan(0);
  });

  it('bug fix: duodécimos avaliados separadamente — vencimento 1000€ → IRS ≈ 42€ (não 89€)', () => {
    // Caso confirmado com recibos TOConline:
    // vencimento 1000€ + duodécimos 83,33€ férias + 83,33€ natal
    // Bug antigo: base combinada 1166,67€ → IRS 89,15€ (escalão mais alto)
    // Correto: incidenciaRegular 1000€ + cada duodécimo pela taxa do vencimento → IRS ≈ 42€
    const r = calcularRecibo({
      ...inputsBase,
      subsAlimValorDia: 0,
      subsAlimDias: 0,
      brutoAlvo: 1166.67,
    });
    expect(r.incidenciaRegular).toBeCloseTo(1000, 1);
    expect(r.irsFerias).toBeCloseTo(r.subsFerias * r.taxaSubsidios, 2);
    expect(r.irsNatal).toBeCloseTo(r.subsNatal  * r.taxaSubsidios, 2);
    expect(r.irsTotal).toBeCloseTo(42, 0);
  });

  it('líquido = totalAbonos − (IRS + SS trabalhador)', () => {
    const r = calcularRecibo(inputsBase);
    expect(r.liquido).toBeCloseTo(r.totalAbonos - r.irsTotal - r.ssTrabalhador, 2);
  });

  it('custo empresa = totalAbonos + SS patronal', () => {
    const r = calcularRecibo(inputsBase);
    expect(r.custoEmpresa).toBeCloseTo(r.totalAbonos + r.ssPatronal, 2);
  });

  it('sem duodécimos não inclui subsídios de férias/natal', () => {
    const r = calcularRecibo({ ...inputsBase, incluirFerias: false, incluirNatal: false });
    expect(r.subsFerias).toBe(0);
    expect(r.subsNatal).toBe(0);
  });

  it('horas extra calculam com sobretaxa 25% (1ª hora) e 37,5% (seguintes)', () => {
    const r = calcularRecibo({ ...inputsBase, brutoAlvo: 5000, he1: 2, he2: 3 });
    const valorHora = (1000 * 12) / (52 * 40);
    expect(r.valorHe1un).toBeCloseTo(valorHora * 1.25, 3);
    expect(r.valorHe2un).toBeCloseTo(valorHora * 1.375, 3);
    expect(r.valorHe1).toBeCloseTo(valorHora * 1.25 * 2, 2);
    expect(r.valorHe2).toBeCloseTo(valorHora * 1.375 * 3, 2);
  });
});

describe('gerarLinhasMapa', () => {
  it('gera linhas até cobrir o valor necessário', () => {
    const limiteDia = 148.91;
    const necessaria = 2977.82; // exatamente 20 dias a 100%
    const rows = gerarLinhasMapa({
      necessaria,
      limiteDia,
      dataInicio: '2026-08-01',
      horaPartida: '07:30',
      horaChegada: '20:30',
      territorio: 'internacional',
      cliente: 'Calcosa',
      localidade: 'Espanha',
    });
    const total = rows.reduce((s, r) => s + limiteDia * (r.pct / 100), 0);
    expect(total).toBeGreaterThanOrEqual(necessaria - 0.5);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(22); // margem para arredondamentos
  });

  it('primeira linha tem tipo "Partida" com hora de partida', () => {
    const rows = gerarLinhasMapa({
      necessaria: 500,
      limiteDia: 148.91,
      dataInicio: '2026-08-01',
      horaPartida: '07:30',
      horaChegada: '20:30',
      territorio: 'internacional',
    });
    expect(rows[0].tipo).toBe('Partida');
    expect(rows[0].hora).toBe('07:30');
  });

  it('última linha tem tipo "Chegada" com hora de chegada', () => {
    const rows = gerarLinhasMapa({
      necessaria: 500,
      limiteDia: 148.91,
      dataInicio: '2026-08-01',
      horaPartida: '07:30',
      horaChegada: '20:30',
      territorio: 'internacional',
    });
    const last = rows[rows.length - 1];
    expect(last.tipo).toBe('Chegada');
    expect(last.hora).toBe('20:30');
  });

  it('retorna array vazio se necessária ≤ 0', () => {
    const rows = gerarLinhasMapa({ necessaria: 0, limiteDia: 148.91, dataInicio: '2026-08-01' });
    expect(rows).toHaveLength(0);
  });

  it('linhas têm território correto', () => {
    const rows = gerarLinhasMapa({
      necessaria: 300,
      limiteDia: 148.91,
      dataInicio: '2026-08-01',
      territorio: 'internacional',
    });
    rows.forEach(r => expect(r.territorio).toBe('Internacional'));
  });
});
