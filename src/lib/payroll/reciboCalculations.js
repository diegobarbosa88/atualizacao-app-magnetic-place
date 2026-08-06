/* Cálculos de recibo de vencimento - Magnetic Place
 * Módulo puro sem dependências de DOM.
 * Tabelas IRS por ano (Continente): cada entrada em IRS_TABELAS_BY_YEAR corresponde a um Despacho AT.
 * Ao calcular, usa-se o ano mais recente disponível que não ultrapasse o ano pedido.
 */

// ---------------------------------------------------------------------------
// 2025 — Despacho n.º 28-A/2025 (Continente, trabalho dependente)
// ---------------------------------------------------------------------------
const _tabelas2025 = {
  tabelaI: {
    nome: 'Tabela I — Não casado / Casado, dois titulares',
    escalões: [
      { limite: 870.00,   taxa: 0,      parcela: ()  => 0,                              adicional: 0 },
      { limite: 988.00,   taxa: 0.1250, parcela: (R) => 0.1250 * 2.60 * (1207.69 - R),  adicional: 20.71 },
      { limite: 1051.00,  taxa: 0.1570, parcela: (R) => 0.1570 * 1.35 * (1473.73 - R),  adicional: 20.71 },
      { limite: 1094.00,  taxa: 0.1570, parcela: ()  => 89.79,                           adicional: 20.71 },
      { limite: 1149.00,  taxa: 0.2120, parcela: ()  => 149.95,                          adicional: 20.71 },
      { limite: 1724.00,  taxa: 0.2410, parcela: ()  => 183.28,                          adicional: 20.71 },
      { limite: 2009.00,  taxa: 0.3110, parcela: ()  => 303.96,                          adicional: 20.71 },
      { limite: 2370.00,  taxa: 0.3490, parcela: ()  => 380.28,                          adicional: 20.71 },
      { limite: 3135.00,  taxa: 0.3836, parcela: ()  => 462.28,                          adicional: 20.71 },
      { limite: 5260.00,  taxa: 0.3969, parcela: ()  => 504.01,                          adicional: 20.71 },
      { limite: 19172.00, taxa: 0.4495, parcela: ()  => 780.70,                          adicional: 20.71 },
      { limite: Infinity, taxa: 0.4717, parcela: ()  => 1206.44,                         adicional: 20.71 },
    ],
  },
  tabelaII: {
    nome: 'Tabela II — Não casado, com dependentes',
    escalões: [
      { limite: 870.00,   taxa: 0,      parcela: ()  => 0,                              adicional: 0 },
      { limite: 988.00,   taxa: 0.1250, parcela: (R) => 0.1250 * 2.60 * (1207.69 - R),  adicional: 33.13 },
      { limite: 1051.00,  taxa: 0.1570, parcela: (R) => 0.1570 * 1.35 * (1473.73 - R),  adicional: 33.13 },
      { limite: 1094.00,  taxa: 0.1570, parcela: ()  => 89.79,                           adicional: 33.13 },
      { limite: 1149.00,  taxa: 0.2120, parcela: ()  => 149.95,                          adicional: 33.13 },
      { limite: 1724.00,  taxa: 0.2410, parcela: ()  => 183.28,                          adicional: 33.13 },
      { limite: 2009.00,  taxa: 0.3110, parcela: ()  => 303.96,                          adicional: 33.13 },
      { limite: 2370.00,  taxa: 0.3490, parcela: ()  => 380.28,                          adicional: 33.13 },
      { limite: 3135.00,  taxa: 0.3836, parcela: ()  => 462.28,                          adicional: 33.13 },
      { limite: 5260.00,  taxa: 0.3969, parcela: ()  => 504.01,                          adicional: 33.13 },
      { limite: 19172.00, taxa: 0.4495, parcela: ()  => 780.70,                          adicional: 33.13 },
      { limite: Infinity, taxa: 0.4717, parcela: ()  => 1206.44,                         adicional: 33.13 },
    ],
  },
  tabelaIII: {
    nome: 'Tabela III — Casado, único titular',
    escalões: [
      { limite: 939.00,   taxa: 0,      parcela: ()  => 0,                              adicional: 0 },
      { limite: 988.00,   taxa: 0.1250, parcela: (R) => 0.1250 * 2.60 * (1300.77 - R),  adicional: 41.43 },
      { limite: 1051.00,  taxa: 0.1250, parcela: (R) => 0.1250 * 1.35 * (1590.37 - R),  adicional: 41.43 },
      { limite: 1061.00,  taxa: 0.1250, parcela: ()  => 91.14,                           adicional: 41.43 },
      { limite: 1358.00,  taxa: 0.1272, parcela: ()  => 93.47,                           adicional: 41.43 },
      { limite: 1860.00,  taxa: 0.1570, parcela: ()  => 133.94,                          adicional: 41.43 },
      { limite: 2124.00,  taxa: 0.1938, parcela: ()  => 202.49,                          adicional: 41.43 },
      { limite: 2630.00,  taxa: 0.2277, parcela: ()  => 274.35,                          adicional: 41.43 },
      { limite: 3215.00,  taxa: 0.2570, parcela: ()  => 351.43,                          adicional: 41.43 },
      { limite: 5658.00,  taxa: 0.2881, parcela: ()  => 451.42,                          adicional: 41.43 },
      { limite: 19222.00, taxa: 0.3843, parcela: ()  => 995.64,                          adicional: 41.43 },
      { limite: Infinity, taxa: 0.4717, parcela: ()  => 2675.05,                         adicional: 41.43 },
    ],
  },
};

// ---------------------------------------------------------------------------
// 2026 — Despacho n.º 233-A/2026 (Continente, trabalho dependente)
// ---------------------------------------------------------------------------
const _tabelas2026 = {
  tabelaI: {
    nome: 'Tabela I — Não casado / Casado, dois titulares',
    escalões: [
      { limite: 920.00,   taxa: 0,      parcela: ()  => 0,                              adicional: 0 },
      { limite: 1042.00,  taxa: 0.1250, parcela: (R) => 0.1250 * 2.60 * (1273.85 - R),  adicional: 21.43 },
      { limite: 1108.00,  taxa: 0.1570, parcela: (R) => 0.1570 * 1.35 * (1554.83 - R),  adicional: 21.43 },
      { limite: 1154.00,  taxa: 0.1570, parcela: ()  => 94.71,                           adicional: 21.43 },
      { limite: 1212.00,  taxa: 0.2120, parcela: ()  => 158.18,                          adicional: 21.43 },
      { limite: 1819.00,  taxa: 0.2410, parcela: ()  => 193.33,                          adicional: 21.43 },
      { limite: 2119.00,  taxa: 0.3110, parcela: ()  => 320.66,                          adicional: 21.43 },
      { limite: 2499.00,  taxa: 0.3490, parcela: ()  => 401.19,                          adicional: 21.43 },
      { limite: 3305.00,  taxa: 0.3836, parcela: ()  => 487.66,                          adicional: 21.43 },
      { limite: 5547.00,  taxa: 0.3969, parcela: ()  => 531.62,                          adicional: 21.43 },
      { limite: 20221.00, taxa: 0.4495, parcela: ()  => 823.40,                          adicional: 21.43 },
      { limite: Infinity, taxa: 0.4717, parcela: ()  => 1272.31,                         adicional: 21.43 },
    ],
  },
  tabelaII: {
    nome: 'Tabela II — Não casado, com dependentes',
    escalões: [
      { limite: 920.00,   taxa: 0,      parcela: ()  => 0,                              adicional: 0 },
      { limite: 1042.00,  taxa: 0.1250, parcela: (R) => 0.1250 * 2.60 * (1273.85 - R),  adicional: 34.29 },
      { limite: 1108.00,  taxa: 0.1570, parcela: (R) => 0.1570 * 1.35 * (1554.83 - R),  adicional: 34.29 },
      { limite: 1154.00,  taxa: 0.1570, parcela: ()  => 94.71,                           adicional: 34.29 },
      { limite: 1212.00,  taxa: 0.2120, parcela: ()  => 158.18,                          adicional: 34.29 },
      { limite: 1819.00,  taxa: 0.2410, parcela: ()  => 193.33,                          adicional: 34.29 },
      { limite: 2119.00,  taxa: 0.3110, parcela: ()  => 320.66,                          adicional: 34.29 },
      { limite: 2499.00,  taxa: 0.3490, parcela: ()  => 401.19,                          adicional: 34.29 },
      { limite: 3305.00,  taxa: 0.3836, parcela: ()  => 487.66,                          adicional: 34.29 },
      { limite: 5547.00,  taxa: 0.3969, parcela: ()  => 531.62,                          adicional: 34.29 },
      { limite: 20221.00, taxa: 0.4495, parcela: ()  => 823.40,                          adicional: 34.29 },
      { limite: Infinity, taxa: 0.4717, parcela: ()  => 1272.31,                         adicional: 34.29 },
    ],
  },
  tabelaIII: {
    nome: 'Tabela III — Casado, único titular',
    escalões: [
      { limite: 991.00,   taxa: 0,      parcela: ()  => 0,                              adicional: 0 },
      { limite: 1042.00,  taxa: 0.1250, parcela: (R) => 0.1250 * 2.60 * (1372.15 - R),  adicional: 42.86 },
      { limite: 1108.00,  taxa: 0.1250, parcela: (R) => 0.1250 * 1.35 * (1677.85 - R),  adicional: 42.86 },
      { limite: 1119.00,  taxa: 0.1250, parcela: ()  => 96.17,                           adicional: 42.86 },
      { limite: 1432.00,  taxa: 0.1272, parcela: ()  => 98.64,                           adicional: 42.86 },
      { limite: 1962.00,  taxa: 0.1570, parcela: ()  => 141.32,                          adicional: 42.86 },
      { limite: 2240.00,  taxa: 0.1938, parcela: ()  => 213.53,                          adicional: 42.86 },
      { limite: 2773.00,  taxa: 0.2277, parcela: ()  => 289.47,                          adicional: 42.86 },
      { limite: 3389.00,  taxa: 0.2570, parcela: ()  => 370.72,                          adicional: 42.86 },
      { limite: 5965.00,  taxa: 0.2881, parcela: ()  => 476.12,                          adicional: 42.86 },
      { limite: 20265.00, taxa: 0.3843, parcela: ()  => 1049.96,                         adicional: 42.86 },
      { limite: Infinity, taxa: 0.4717, parcela: ()  => 2821.13,                         adicional: 42.86 },
    ],
  },
};

// Registo de todas as tabelas disponíveis por ano
export const IRS_TABELAS_BY_YEAR = {
  2025: _tabelas2025,
  2026: _tabelas2026,
};

// Resolve as tabelas para um dado ano (usa o ano mais recente disponível se não houver dados exactos)
export function getIRSTabelasPorAno(ano) {
  const anos = Object.keys(IRS_TABELAS_BY_YEAR).map(Number).sort((a, b) => b - a);
  const anoResolvido = anos.find(a => a <= ano) || anos[0];
  return IRS_TABELAS_BY_YEAR[anoResolvido];
}

// Alias para compatibilidade — aponta sempre para as tabelas do ano mais recente disponível
export const IRS_TABELAS = _tabelas2026;

export const LIMITES = {
  ssTrabalhador: 0.11,
  ssPatronal: 0.2375,
  subsAlimCartao: 10.46,
  subsAlimDinheiro: 6.15,
  ajudaNacional: 65.89,           // DL n.º 1/2025 (+5% sobre 62,75)
  ajudaInternacionalGeral: 156.36, // DL n.º 29-A/2026 (+5% sobre 148,91)
  ajudaInternacionalGerencia: 175.42, // DL n.º 29-A/2026 (+5% sobre 167,07)
};

export const MESES_PT = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function eur(v) {
  return (isNaN(v) ? 0 : v).toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + '€';
}

export function calcularIRS(rendimento, tabelaKey, nDependentes = 0, ano = 2026) {
  if (rendimento <= 0) return 0;
  const tabelas = getIRSTabelasPorAno(ano);
  const tabela = tabelas[tabelaKey];
  if (!tabela) return 0;
  const escalão = tabela.escalões.find(e => rendimento <= e.limite);
  if (!escalão) return 0;
  const parcela = escalão.parcela(rendimento);
  const irs = rendimento * escalão.taxa - parcela - escalão.adicional * (nDependentes || 0);
  return Math.max(0, irs);
}

export function taxaEfetiva(rendimento, tabelaKey, nDependentes = 0, ano = 2026) {
  if (rendimento <= 0) return 0;
  return calcularIRS(rendimento, tabelaKey, nDependentes, ano) / rendimento;
}

export function valorDiarioLegal(territorio, funcao) {
  if (territorio === 'nacional') return LIMITES.ajudaNacional;
  return funcao === 'gerencia' ? LIMITES.ajudaInternacionalGerencia : LIMITES.ajudaInternacionalGeral;
}

/**
 * Calcula o recibo completo a partir dos inputs do formulário.
 * @param {object} inputs
 * @param {number}  inputs.vencimentoBase
 * @param {number}  inputs.horasSemana       default 40
 * @param {number}  inputs.premios            default 0
 * @param {number}  inputs.he1               horas suplementares 1ª hora
 * @param {number}  inputs.he2               horas suplementares seguintes
 * @param {boolean} inputs.incluirFerias      duodécimo subsídio de férias
 * @param {boolean} inputs.incluirNatal       duodécimo subsídio de natal
 * @param {number}  inputs.subsAlimValorDia
 * @param {number}  inputs.subsAlimDias
 * @param {string}  inputs.subsAlimTipo       'cartao' | 'dinheiro'
 * @param {string}  inputs.tabelaKey          'tabelaI' | 'tabelaII' | 'tabelaIII'
 * @param {number}  inputs.nDependentes
 * @param {number}  inputs.brutoAlvo
 * @param {string}  inputs.territorio         'internacional' | 'nacional'
 * @param {string}  inputs.funcao             'geral' | 'gerencia'
 * @param {number}  inputs.ano               ano fiscal (default: ano actual)
 */
export function calcularRecibo(inputs) {
  const {
    vencimentoBase = 0,
    horasSemana = 40,
    premios = 0,
    he1 = 0,
    he2 = 0,
    incluirFerias = true,
    incluirNatal = true,
    subsAlimValorDia = 0,
    subsAlimDias = 0,
    subsAlimTipo = 'cartao',
    tabelaKey = 'tabelaI',
    nDependentes = 0,
    brutoAlvo = 0,
    territorio = 'internacional',
    funcao = 'geral',
    ano = new Date().getFullYear(),
  } = inputs;

  const salarioHora = (vencimentoBase * 12) / (52 * (horasSemana || 40));

  const valorHe1un = salarioHora * 1.25;
  const valorHe2un = salarioHora * 1.375;
  const valorHe1 = valorHe1un * he1;
  const valorHe2 = valorHe2un * he2;
  const totalOvertime = valorHe1 + valorHe2;

  const subsFerias = incluirFerias ? vencimentoBase / 12 : 0;
  const subsNatal  = incluirNatal  ? vencimentoBase / 12 : 0;

  const subsAlimTotal = subsAlimValorDia * subsAlimDias;
  const limiteAlim = subsAlimTipo === 'cartao' ? LIMITES.subsAlimCartao : LIMITES.subsAlimDinheiro;
  const subsAlimExcedente = Math.max(0, (subsAlimValorDia - limiteAlim)) * subsAlimDias;

  const vdl = valorDiarioLegal(territorio, funcao);

  // IRS regular: vencimento + prémios + excedente de subsídio alimentação
  const incidenciaRegular = vencimentoBase + premios + subsAlimExcedente;
  const irsRegular  = calcularIRS(incidenciaRegular, tabelaKey, nDependentes, ano);
  const taxaRegular = taxaEfetiva(incidenciaRegular, tabelaKey, nDependentes, ano);

  // IRS subsídios: cada duodécimo tributado pela taxa do vencimento base isolado (sem somar entre si)
  const taxaSubsidios = taxaEfetiva(vencimentoBase, tabelaKey, nDependentes, ano);
  const irsFerias     = subsFerias * taxaSubsidios;
  const irsNatal      = subsNatal  * taxaSubsidios;

  // Trabalho suplementar: 50% da taxa regular
  const taxaOvertime = taxaRegular * 0.5;
  const irsOvertime  = totalOvertime * taxaOvertime;

  const irsTotal = irsRegular + irsFerias + irsNatal + irsOvertime;

  // Base SS: inclui tudo exceto ajudas de custo e parte isenta de subsAlim
  const incidenciaSS  = incidenciaRegular + subsFerias + subsNatal + totalOvertime;
  const ssTrabalhador = incidenciaSS * LIMITES.ssTrabalhador;
  const ssPatronal    = incidenciaSS * LIMITES.ssPatronal;

  // Ajuda de custo internacional como valor residual (plug)
  const somaOutrosAbonos = vencimentoBase + subsAlimTotal + subsFerias + premios + totalOvertime + subsNatal;
  const ajudaCustoNecessaria = Math.max(0, brutoAlvo - somaOutrosAbonos);

  const totalAbonos    = somaOutrosAbonos + ajudaCustoNecessaria;
  const totalDescontos = irsTotal + ssTrabalhador;
  const liquido        = totalAbonos - totalDescontos;
  const custoEmpresa   = totalAbonos + ssPatronal;

  return {
    salarioHora,
    valorHe1un, valorHe2un, valorHe1, valorHe2, totalOvertime,
    subsFerias, subsNatal,
    subsAlimTotal, subsAlimExcedente, limiteAlim,
    valorDiarioLegal: vdl,
    incidenciaRegular, irsRegular, taxaRegular,
    taxaSubsidios, irsFerias, irsNatal,
    taxaOvertime, irsOvertime,
    irsTotal,
    incidenciaSS, ssTrabalhador, ssPatronal,
    somaOutrosAbonos, ajudaCustoNecessaria,
    totalAbonos, totalDescontos, liquido, custoEmpresa,
  };
}

/**
 * Gera automaticamente as linhas do mapa de ajudas de custo até cobrir o valor necessário.
 * @param {number} necessaria         valor total de ajuda de custo necessário
 * @param {number} limiteDia          valor legal diário (resultado de valorDiarioLegal)
 * @param {string} dataInicio         'YYYY-MM-DD'
 * @param {string} horaPartida        'HH:MM'
 * @param {string} horaChegada        'HH:MM'
 * @param {string} territorio         'nacional' | 'internacional'
 * @param {string} cliente
 * @param {string} localidade
 * @returns {Array<{dia,servico,cliente,localidade,territorio,tipo,hora,pct}>}
 */
export function gerarLinhasMapa({
  necessaria,
  limiteDia,
  dataInicio,
  horaPartida = '07:30',
  horaChegada = '20:30',
  territorio = 'internacional',
  cliente = '',
  localidade = '',
}) {
  if (necessaria <= 0 || limiteDia <= 0) return [];

  const rows = [];
  const territorioLabel = territorio === 'nacional' ? 'Nacional' : 'Internacional';
  const start = dataInicio || new Date().toISOString().slice(0, 10);
  let cursor = new Date(start + 'T00:00:00');
  let restante = necessaria;
  let isFirst = true;

  while (restante > 0.5 && rows.length < 120) {
    const pctFull = Math.min(100, Math.round((restante / limiteDia) * 100));
    const isLast  = (restante - limiteDia) <= 0.5;
    const pct     = isLast ? pctFull : 100;
    const valorDia = limiteDia * (pct / 100);

    let tipo = 'Consecutivo';
    let hora = '';
    if (isFirst)      { tipo = 'Partida'; hora = horaPartida; }
    else if (isLast)  { tipo = 'Chegada'; hora = horaChegada; }

    rows.push({
      id: rows.length + 1,
      dia: cursor.toISOString().slice(0, 10),
      servico: 'Serviços de mecânica geral',
      cliente,
      localidade,
      territorio: territorioLabel,
      tipo,
      hora,
      pct,
    });

    restante = isLast ? 0 : restante - valorDia;
    cursor.setDate(cursor.getDate() + 1);
    isFirst = false;
  }

  return rows;
}
