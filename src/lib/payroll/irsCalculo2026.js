/**
 * irsCalculo2026.js
 * ---------------------------------------------------------------------------
 * Módulo de cálculo de retenção na fonte de IRS — Continente, 2026.
 * Base legal: Despacho n.º 233-A/2026 (DR n.º 3/2026, Suplemento, 2.ª série)
 *             + artigo 99.º-C do Código do IRS (retenção autónoma de subsídios
 *               de férias/Natal e de trabalho suplementar).
 */

// ---------------------------------------------------------------------------
// TABELAS (Continente, 2026) — Trabalho dependente, sem deficiência
// Cada escalão: { limite, taxa, parcelaAbater } onde parcelaAbater pode ser
// um número fixo OU uma função (R) => número, para os escalões mais baixos
// onde a parcela a abater é ela própria linear em R.
// ---------------------------------------------------------------------------

const TABELA_I = {
  // Não casado sem dependentes OU casado dois titulares
  parcelaAdicionalPorDependente: 21.43,
  escalões: [
    { limite: 920.00,   taxa: 0.0000, parcelaAbater: 0 },
    { limite: 1042.00,  taxa: 0.1250, parcelaAbater: (R) => 0.1250 * 2.60 * (1273.85 - R) },
    { limite: 1108.00,  taxa: 0.1570, parcelaAbater: (R) => 0.1570 * 1.35 * (1554.83 - R) },
    { limite: 1154.00,  taxa: 0.1570, parcelaAbater: 94.71 },
    { limite: 1212.00,  taxa: 0.2120, parcelaAbater: 158.18 },
    { limite: 1819.00,  taxa: 0.2410, parcelaAbater: 193.33 },
    { limite: 2119.00,  taxa: 0.3110, parcelaAbater: 320.66 },
    { limite: 2499.00,  taxa: 0.3490, parcelaAbater: 401.19 },
    { limite: 3305.00,  taxa: 0.3836, parcelaAbater: 487.66 },
    { limite: 5547.00,  taxa: 0.3969, parcelaAbater: 531.62 },
    { limite: 20221.00, taxa: 0.4495, parcelaAbater: 823.40 },
    { limite: Infinity, taxa: 0.4717, parcelaAbater: 1272.31 },
  ],
};

const TABELA_II = {
  // Não casado com um ou mais dependentes
  parcelaAdicionalPorDependente: 34.29,
  escalões: TABELA_I.escalões,
};

const TABELA_III = {
  // Casado, único titular
  parcelaAdicionalPorDependente: 42.86,
  escalões: [
    { limite: 991.00,   taxa: 0.0000, parcelaAbater: 0 },
    { limite: 1042.00,  taxa: 0.1250, parcelaAbater: (R) => 0.1250 * 2.60 * (1372.15 - R) },
    { limite: 1108.00,  taxa: 0.1250, parcelaAbater: (R) => 0.1250 * 1.35 * (1677.85 - R) },
    { limite: 1119.00,  taxa: 0.1250, parcelaAbater: 96.17 },
    { limite: 1432.00,  taxa: 0.1272, parcelaAbater: 98.64 },
    { limite: 1962.00,  taxa: 0.1570, parcelaAbater: 141.32 },
    { limite: 2240.00,  taxa: 0.1938, parcelaAbater: 213.53 },
    { limite: 2773.00,  taxa: 0.2277, parcelaAbater: 289.47 },
    { limite: 3389.00,  taxa: 0.2570, parcelaAbater: 370.72 },
    { limite: 5965.00,  taxa: 0.2881, parcelaAbater: 476.12 },
    { limite: 20265.00, taxa: 0.3843, parcelaAbater: 1049.96 },
    { limite: Infinity, taxa: 0.4717, parcelaAbater: 2821.13 },
  ],
};

export const TABELAS = { I: TABELA_I, II: TABELA_II, III: TABELA_III };

// ---------------------------------------------------------------------------
// FUNÇÕES INTERNAS
// ---------------------------------------------------------------------------

function encontrarEscalao(tabela, R) {
  return tabela.escalões.find((e) => R <= e.limite) ?? tabela.escalões[tabela.escalões.length - 1];
}

function resolverParcelaAbater(escalao, R) {
  return typeof escalao.parcelaAbater === 'function' ? escalao.parcelaAbater(R) : escalao.parcelaAbater;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// API PÚBLICA
// ---------------------------------------------------------------------------

/**
 * Calcula a retenção de IRS sobre o vencimento e abonos regulares do mês.
 * Nunca inclui subsídios de férias/Natal nem trabalho suplementar (têm retenção autónoma).
 * Aplica o arredondamento do art. 99.º-E do CIRS (floor ao euro inferior).
 *
 * @param {number} R              Incidência mensal (vencimento + excesso subsAlim + prémios)
 * @param {"I"|"II"|"III"} tabelaId  Tabela aplicável
 * @param {number} nDependentes
 * @returns {{ retencao: number, taxaMarginal: number, parcelaAbater: number, taxaEfetiva: number }}
 */
export function calcularRetencaoVencimento(R, tabelaId, nDependentes = 0) {
  const tabela = TABELAS[tabelaId];
  if (!tabela) throw new Error(`Tabela IRS desconhecida: ${tabelaId}`);
  if (R <= 0) return { retencao: 0, taxaMarginal: 0, parcelaAbater: 0, taxaEfetiva: 0 };

  const escalao = encontrarEscalao(tabela, R);
  const parcelaAbater = resolverParcelaAbater(escalao, R);
  const parcelaDependentes = tabelaId === 'I' ? 0 : tabela.parcelaAdicionalPorDependente * nDependentes;

  const retencaoBruta = R * escalao.taxa - parcelaAbater - parcelaDependentes;
  // Floor ao euro inferior (art. 99.º-E CIRS). Diferença residual ≤1€ conhecida e aceitável —
  // ex: Diego Rocha Barbosa, Tab.II, 1 dep, R=1080.55€ → retencaoBruta=34.83 → 34€ calculado vs 35€ TOConline.
  const retencao = Math.max(0, Math.floor(round2(retencaoBruta) + 1e-9));

  return {
    retencao,
    taxaMarginal: escalao.taxa,
    parcelaAbater: round2(parcelaAbater),
    taxaEfetiva: round2((retencaoBruta / R) * 100),
  };
}

/**
 * Calcula a retenção de IRS sobre duodécimo de subsídio de férias ou de Natal.
 * Art. 99.º-C, n.os 5 e 6 CIRS: o escalão é determinado pelo VALOR TOTAL do subsídio;
 * a retenção é depois repartida proporcionalmente pelo valor pago este mês.
 *
 * @param {number} valorTotalSubsidio   Valor anual do subsídio (normalmente = vencimento base)
 * @param {number} valorDuodecimo       Valor efetivamente pago este mês (ex: valorTotal/12)
 * @param {"I"|"II"|"III"} tabelaId
 * @param {number} nDependentes
 * @returns {{ retencao: number, taxaEfetiva: number }}
 */
export function calcularRetencaoSubsidioDuodecimo(valorTotalSubsidio, valorDuodecimo, tabelaId, nDependentes = 0) {
  const tabela = TABELAS[tabelaId];
  if (!tabela) throw new Error(`Tabela IRS desconhecida: ${tabelaId}`);
  if (valorDuodecimo <= 0 || valorTotalSubsidio <= 0) return { retencao: 0, taxaEfetiva: 0 };

  const escalao = encontrarEscalao(tabela, valorTotalSubsidio);
  const parcelaAbaterTotal = resolverParcelaAbater(escalao, valorTotalSubsidio);
  const parcelaDependentesTotal = tabelaId === 'I' ? 0 : tabela.parcelaAdicionalPorDependente * nDependentes;

  const retencaoTotalBruta = Math.max(
    0,
    valorTotalSubsidio * escalao.taxa - parcelaAbaterTotal - parcelaDependentesTotal
  );

  const proporcao = valorDuodecimo / valorTotalSubsidio;
  const retencaoBruta = retencaoTotalBruta * proporcao;
  const retencao = Math.max(0, Math.floor(round2(retencaoBruta) + 1e-9));

  return {
    retencao,
    taxaEfetiva: round2((retencaoBruta / valorDuodecimo) * 100),
  };
}

/**
 * Calcula a retenção de IRS sobre trabalho suplementar.
 * Taxa = 50% da taxa efetiva do vencimento regular do mesmo mês.
 *
 * @param {number} valorTrabalhoSuplementar
 * @param {number} taxaEfetivaVencimento   Taxa efetiva (%) do vencimento deste mês
 * @returns {{ retencao: number, taxaEfetiva: number }}
 */
export function calcularRetencaoTrabalhoSuplementar(valorTrabalhoSuplementar, taxaEfetivaVencimento) {
  if (valorTrabalhoSuplementar <= 0) return { retencao: 0, taxaEfetiva: 0 };
  const taxaEfetiva = taxaEfetivaVencimento / 2;
  const retencaoBruta = valorTrabalhoSuplementar * (taxaEfetiva / 100);
  const retencao = Math.max(0, Math.floor(round2(retencaoBruta) + 1e-9));
  return { retencao, taxaEfetiva: round2(taxaEfetiva) };
}

/**
 * Monta o cálculo de IRS completo de um recibo.
 *
 * @param {object} params
 * @param {number} params.vencimentoBase
 * @param {number} params.excedenteSubsidioAlimentacao
 * @param {number} params.premios
 * @param {number} params.trabalhoSuplementar
 * @param {number} params.subsidioFeriasDuodecimo
 * @param {number} params.subsidioNatalDuodecimo
 * @param {number} params.valorTotalSubsidioFerias    (normalmente = vencimentoBase)
 * @param {number} params.valorTotalSubsidioNatal
 * @param {"I"|"II"|"III"} params.tabela
 * @param {number} params.nDependentes
 */
export function calcularReciboCompleto(params) {
  const {
    vencimentoBase,
    excedenteSubsidioAlimentacao = 0,
    premios = 0,
    trabalhoSuplementar = 0,
    subsidioFeriasDuodecimo = 0,
    subsidioNatalDuodecimo = 0,
    valorTotalSubsidioFerias = 0,
    valorTotalSubsidioNatal = 0,
    tabela,
    nDependentes = 0,
  } = params;

  const incidenciaVencimento = vencimentoBase + excedenteSubsidioAlimentacao + premios;
  const irsVencimento = calcularRetencaoVencimento(incidenciaVencimento, tabela, nDependentes);

  const irsTrabalhoSuplementar = calcularRetencaoTrabalhoSuplementar(trabalhoSuplementar, irsVencimento.taxaEfetiva);

  const irsSubsidioFerias = calcularRetencaoSubsidioDuodecimo(
    valorTotalSubsidioFerias, subsidioFeriasDuodecimo, tabela, nDependentes
  );

  const irsSubsidioNatal = calcularRetencaoSubsidioDuodecimo(
    valorTotalSubsidioNatal, subsidioNatalDuodecimo, tabela, nDependentes
  );

  const irsTotal =
    irsVencimento.retencao +
    irsTrabalhoSuplementar.retencao +
    irsSubsidioFerias.retencao +
    irsSubsidioNatal.retencao;

  return {
    incidenciaVencimento: round2(incidenciaVencimento),
    irsVencimento,
    irsTrabalhoSuplementar,
    irsSubsidioFerias,
    irsSubsidioNatal,
    irsTotal,
  };
}
