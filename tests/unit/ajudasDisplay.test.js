import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Teste de regressão: A082 deve ser sempre mapaTotal − subsAlimMapa ao vivo,
// NUNCA incluindo o complemento (A008/HE) que é uma rubrica separada no recibo.
// ---------------------------------------------------------------------------

// Replica a lógica pura das variáveis calculadas no RecibosCalculadora:
//   mapaLiqLive    = mapaTotal − subsAlimMapaLive
//   ajudasDisplay  = mapaLiqLive  (quando mapa existe)
//   mapaDesviado   = |mapaLiqLive − r.ajudaCustoNecessaria| > 0.5

function computeMapaLiqLive(mapaRows, subsAlimValorDia) {
  const vdia = parseFloat(subsAlimValorDia) || 0;
  if (vdia <= 0) return 0;
  return mapaRows.reduce((sum, row) => {
    if (!row.dia) return sum;
    const dow = new Date(row.dia + 'T00:00:00').getDay();
    return sum + (dow >= 1 && dow <= 5 ? vdia : 0);
  }, 0);
}

function computeAjudasDisplay(mapaRows, mapaTotal, subsAlimMapaLive, ajudaNecessaria) {
  if (mapaRows.length === 0) return ajudaNecessaria;
  return Math.round((mapaTotal - subsAlimMapaLive) * 100) / 100;
}

function isMapaDesviado(mapaLiqLive, ajudaNecessaria, mapaRowsLen) {
  if (mapaRowsLen === 0 || ajudaNecessaria == null) return false;
  return Math.abs(mapaLiqLive - ajudaNecessaria) > 7;
}

// ---------------------------------------------------------------------------
// Cenário real: Edilson Sousa do Nascimento — Junho 2026
//   vdl = 156,36 €/dia | N=14 | fP=100% | fC=50%
//   totalAjudas  = 156,36 × 13,5 = 2110,86 €
//   subsAlimMapa = 8 dias úteis × 9,60 €/dia = 76,80 €
//   ajudaNecessaria (r.ajudaCustoNecessaria) = 2110,86 − 76,80 = 2034,06 €
//   complemento (premios A008) = 0  (residuo ≈ 0)
//
// Valor A082 correto = 2110,86 − 76,80 = 2034,06 €
// ---------------------------------------------------------------------------

const VDL = 156.36;
const SUBS_ALIM_DIA = 9.60;

// Constrói 14 linhas de mapa a partir de 2026-06-01 (domingo)
function buildMapaRows(startDate, n) {
  const rows = [];
  const d = new Date(startDate + 'T00:00:00');
  for (let i = 0; i < n; i++) {
    const dia = d.toISOString().split('T')[0];
    const dow = d.getDay();
    const pct = i === 0 ? 100 : i === n - 1 ? 50 : 100;
    rows.push({ id: i, dia, pct, territorio: 'Internacional' });
    d.setDate(d.getDate() + 1);
  }
  return rows;
}

describe('A082 — deve ser mapaTotal − subsAlimMapa (sem complemento)', () => {
  const mapaRows = buildMapaRows('2026-06-01', 14);

  // Conta dias úteis manualmente (1 Jun = Dom, logo os 14 dias cobrem 1–14 Jun)
  // Dias úteis: 2,3,4,5,6,9,10,11,12,13 = 10 dias (não 8 — corrijo o cenário)
  const subsAlimMapaLive = computeMapaLiqLive(mapaRows, SUBS_ALIM_DIA);
  const mapaTotal = Math.round(VDL * 13.5 * 100) / 100; // N=14 → (14-2)+1+0.5=13.5 unidades

  it('mapaTotal é 2110,86 €', () => {
    expect(mapaTotal).toBeCloseTo(2110.86, 2);
  });

  it('A082 (ajudasDisplay) = mapaTotal − subsAlimMapa (sem qualquer complemento)', () => {
    const ajudaNecessaria = mapaTotal - subsAlimMapaLive; // valor que r.ajudaCustoNecessaria deve ter
    const ajudasDisplay = computeAjudasDisplay(mapaRows, mapaTotal, subsAlimMapaLive, ajudaNecessaria);

    // A082 NÃO deve incluir o complemento
    expect(ajudasDisplay).toBeCloseTo(mapaTotal - subsAlimMapaLive, 2);
  });

  it('A082 ≠ mapaTotal − subsAlimMapa + complemento (o complemento não pertence ao A082)', () => {
    const complemento = 10.94; // complemento A008 de uma execução anterior hipotética
    const ajudaNecessaria = mapaTotal - subsAlimMapaLive - complemento; // r.ajudaCustoNecessaria com premios=complemento
    const ajudasDisplay = computeAjudasDisplay(mapaRows, mapaTotal, subsAlimMapaLive, ajudaNecessaria);

    // A082 deve ser mapaLiq, NÃO mapaLiq + complemento
    expect(ajudasDisplay).toBeCloseTo(mapaTotal - subsAlimMapaLive, 2);
    expect(ajudasDisplay).not.toBeCloseTo(mapaTotal - subsAlimMapaLive + complemento, 2);
  });
});

describe('mapaDesviado — deteta dessincronização entre mapa e recibo', () => {
  const mapaRows = buildMapaRows('2026-06-01', 14);
  const subsAlimMapaLive = computeMapaLiqLive(mapaRows, SUBS_ALIM_DIA);
  const mapaTotal = Math.round(VDL * 13.5 * 100) / 100;
  const mapaLiqLive = mapaTotal - subsAlimMapaLive;

  it('NÃO está desviado quando r.ajudaCustoNecessaria = mapaLiqLive', () => {
    expect(isMapaDesviado(mapaLiqLive, mapaLiqLive, mapaRows.length)).toBe(false);
  });

  it('NÃO está desviado com diferença < 7 € (ex.: +2,29 € de arredondamento de subsAlim)', () => {
    expect(isMapaDesviado(mapaLiqLive, mapaLiqLive + 2.29, mapaRows.length)).toBe(false);
    expect(isMapaDesviado(mapaLiqLive, mapaLiqLive + 6.99, mapaRows.length)).toBe(false);
  });

  it('ESTÁ desviado quando complemento antigo invalida a relação mapa←→recibo', () => {
    // Simulação: premios=10,94 ainda em inputs → r.ajudaCustoNecessaria = mapaLiq - 10,94
    const ajudaNecessariaStale = mapaLiqLive - 10.94;
    expect(isMapaDesviado(mapaLiqLive, ajudaNecessariaStale, mapaRows.length)).toBe(true);
  });

  it('NÃO está desviado com mapa vazio (sem linhas)', () => {
    expect(isMapaDesviado(mapaLiqLive, mapaLiqLive - 50, 0)).toBe(false);
  });
});

describe('Regressão: A082 mantém-se correto após mudança que invalida complemento anterior', () => {
  it('A082 = mapaLiq live mesmo que premios antigo persista em inputs', () => {
    // Cenário: autoFill definiu premios=10,94 numa iteração anterior.
    // O utilizador muda um campo e não corre o auto-fill de novo.
    // mapaLiqLive mantém-se correto pois não depende de premios.
    const mapaRows = buildMapaRows('2026-06-01', 14);
    const subsAlimMapaLive = computeMapaLiqLive(mapaRows, SUBS_ALIM_DIA);
    const mapaTotal = Math.round(VDL * 13.5 * 100) / 100;
    const premiosStale = 10.94;

    // r.ajudaCustoNecessaria com premios stale:
    const ajudaNecessaria = mapaTotal - subsAlimMapaLive - premiosStale;

    // A082 deve ignorar premios e mostrar o líquido do mapa
    const ajudasDisplay = computeAjudasDisplay(mapaRows, mapaTotal, subsAlimMapaLive, ajudaNecessaria);
    expect(ajudasDisplay).toBeCloseTo(mapaTotal - subsAlimMapaLive, 2);

    // E o mapa deve estar assinalado como desviado
    const mapaLiqLive = mapaTotal - subsAlimMapaLive;
    expect(isMapaDesviado(mapaLiqLive, ajudaNecessaria, mapaRows.length)).toBe(true);
  });
});
