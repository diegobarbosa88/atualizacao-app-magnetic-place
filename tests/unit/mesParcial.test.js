import { describe, it, expect } from 'vitest';
import {
  calcMesParcial,
  calcSubsidiosAnoProportional,
  calcAcertoCessacao,
  calcDiasFeriasAnoAdmissao,
} from '../../src/lib/payroll/mesParcial.js';

// ─────────────────────────────────────────────────────────────
// calcMesParcial
// ─────────────────────────────────────────────────────────────

describe('calcMesParcial', () => {
  it('mês completo — sem admissão/cessação no mês', () => {
    const r = calcMesParcial('2026-03-01', null, 2026, 5);
    expect(r.tipo).toBe('completo');
    expect(r.diasTrabalhados).toBe(30);
    expect(r.fator).toBe(1);
  });

  it('admissão a meio do mês (dia 17 de Maio 2026)', () => {
    const r = calcMesParcial('2026-05-17', null, 2026, 5);
    expect(r.tipo).toBe('inicio');
    expect(r.diaInicio).toBe(17);
    expect(r.diaFim).toBe(30);
    // dias 17 a 30 inclusive: 30 - 17 + 1 = 14
    expect(r.diasTrabalhados).toBe(14);
    expect(r.fator).toBeCloseTo(14 / 30, 5);
  });

  it('cessação a meio do mês (dia 10)', () => {
    const r = calcMesParcial('2025-01-01', '2026-05-10', 2026, 5);
    expect(r.tipo).toBe('fim');
    expect(r.diaInicio).toBe(1);
    expect(r.diaFim).toBe(10);
    expect(r.diasTrabalhados).toBe(10);
    expect(r.fator).toBeCloseTo(10 / 30, 5);
  });

  it('admissão E cessação no mesmo mês (contrato muito curto)', () => {
    const r = calcMesParcial('2026-05-10', '2026-05-20', 2026, 5);
    expect(r.tipo).toBe('ambos');
    expect(r.diaInicio).toBe(10);
    expect(r.diaFim).toBe(20);
    expect(r.diasTrabalhados).toBe(11); // 20 - 10 + 1
    expect(r.fator).toBeCloseTo(11 / 30, 5);
  });

  it('dia 31 conta como 30 (convenção de mês de 30 dias)', () => {
    const r = calcMesParcial('2025-01-01', '2026-05-31', 2026, 5);
    expect(r.diaFim).toBe(30);
    expect(r.diasTrabalhados).toBe(30);
  });

  it('admissão em mês diferente → completo', () => {
    const r = calcMesParcial('2026-05-17', null, 2026, 6);
    expect(r.tipo).toBe('completo');
  });

  // Caso real: IDEMILTON MAIA DE BRITO JUNIOR — admissão a meio de Maio 2026
  it('caso real IDEMILTON — admissão 2026-05-17, vencBase 1200€', () => {
    const vencBase = 1200;
    const r = calcMesParcial('2026-05-17', null, 2026, 5);
    expect(r.tipo).toBe('inicio');
    expect(r.diasTrabalhados).toBe(14);
    const vencProporcional = vencBase * r.fator;
    // 1200 × (14/30) = 560.00
    expect(vencProporcional).toBeCloseTo(560, 0);
  });
});

// ─────────────────────────────────────────────────────────────
// calcSubsidiosAnoProportional
// ─────────────────────────────────────────────────────────────

describe('calcSubsidiosAnoProportional', () => {
  const VENC = 1000;

  it('trabalhador com ano completo → subsídio = vencBase', () => {
    const r = calcSubsidiosAnoProportional(VENC, '2025-01-01', null, 2026);
    expect(r.subsFeriasTotalAno).toBeCloseTo(VENC, 1);
    expect(r.fratorAno).toBeCloseTo(12, 1);
  });

  it('admissão a 1 de Janeiro → ano completo', () => {
    const r = calcSubsidiosAnoProportional(VENC, '2026-01-01', null, 2026);
    expect(r.subsFeriasTotalAno).toBeCloseTo(VENC, 1);
  });

  it('admissão a 1 de Julho → 6 meses completos', () => {
    const r = calcSubsidiosAnoProportional(VENC, '2026-07-01', null, 2026);
    expect(r.fratorAno).toBeCloseTo(6, 1);
    expect(r.subsFeriasTotalAno).toBeCloseTo(VENC / 2, 1);
  });

  it('admissão a 17 de Maio — fração correta do mês', () => {
    const r = calcSubsidiosAnoProportional(VENC, '2026-05-17', null, 2026);
    // Maio: 14 dias, Jun–Dez: 7 meses → frator = 14/30 + 7
    const esperado = (VENC / 12) * (14 / 30 + 7);
    expect(r.subsFeriasTotalAno).toBeCloseTo(esperado, 1);
  });

  it('cessação a 10 de Outubro — fração correta', () => {
    const r = calcSubsidiosAnoProportional(VENC, '2025-01-01', '2026-10-10', 2026);
    // Jan–Set (9 meses) + Out 10 dias → frator = 9 + 10/30
    const esperado = (VENC / 12) * (9 + 10 / 30);
    expect(r.subsFeriasTotalAno).toBeCloseTo(esperado, 1);
  });

  it('contrato muito curto — admissão e cessação no mesmo mês', () => {
    const r = calcSubsidiosAnoProportional(VENC, '2026-05-10', '2026-05-20', 2026);
    // 11 dias → frator = 11/30
    expect(r.fratorAno).toBeCloseTo(11 / 30, 4);
  });
});

// ─────────────────────────────────────────────────────────────
// calcAcertoCessacao
// ─────────────────────────────────────────────────────────────

describe('calcAcertoCessacao', () => {
  const VENC = 1000;

  it('sem férias não gozadas → feriasNaoGozadasEur = 0', () => {
    const r = calcAcertoCessacao(VENC, '2026-01-01', '2026-10-10', 2026, 0);
    expect(r.feriasNaoGozadasEur).toBe(0);
    expect(r.subsidioSobreFeriasNaoGozadas).toBe(0);
  });

  it('5 dias de férias não gozadas → vencBase/30 × 5', () => {
    const r = calcAcertoCessacao(VENC, '2026-01-01', '2026-10-10', 2026, 5);
    expect(r.feriasNaoGozadasEur).toBeCloseTo((VENC / 30) * 5, 4);
    expect(r.subsidioSobreFeriasNaoGozadas).toBeCloseTo((VENC / 30) * 5, 4);
  });

  it('subsFeriasProp === subsNatalProp (mesma fórmula)', () => {
    const r = calcAcertoCessacao(VENC, '2026-01-01', '2026-10-10', 2026, 0);
    expect(r.subsFeriasProp).toBe(r.subsNatalProp);
  });

  it('cessação a 10 de Outubro — subsídios proporcionais corretos', () => {
    const r = calcAcertoCessacao(VENC, '2025-01-01', '2026-10-10', 2026, 0);
    const esperado = (VENC / 12) * (9 + 10 / 30);
    expect(r.subsFeriasProp).toBeCloseTo(esperado, 1);
  });
});

// ─────────────────────────────────────────────────────────────
// calcDiasFeriasAnoAdmissao
// ─────────────────────────────────────────────────────────────

describe('calcDiasFeriasAnoAdmissao', () => {
  it('retorna null se não é o ano de admissão', () => {
    expect(calcDiasFeriasAnoAdmissao('2025-06-01', null, 2026)).toBeNull();
  });

  it('admitido a 1 de Janeiro → 12 meses completos → 20 dias (limitado)', () => {
    const r = calcDiasFeriasAnoAdmissao('2026-01-01', null, 2026);
    expect(r.mesesCompletos).toBe(12);
    expect(r.limitado).toBe(true);
    expect(r.diasFerias).toBe(20);
  });

  it('admitido a 1 de Julho → 6 meses completos → 12 dias', () => {
    const r = calcDiasFeriasAnoAdmissao('2026-07-01', null, 2026);
    expect(r.mesesCompletos).toBe(6);
    expect(r.diasFerias).toBe(12);
    expect(r.limitado).toBe(false);
  });

  it('admitido a 17 de Maio → Junho a Dezembro são completos (7)', () => {
    // Maio parcial → não conta; Jun, Jul, Ago, Set, Out, Nov, Dez = 7 meses
    const r = calcDiasFeriasAnoAdmissao('2026-05-17', null, 2026);
    expect(r.mesesCompletos).toBe(7);
    expect(r.diasFerias).toBe(14);
  });

  it('contrato muito curto — cessação no mesmo mês', () => {
    const r = calcDiasFeriasAnoAdmissao('2026-05-10', '2026-05-20', 2026);
    expect(r.mesesCompletos).toBe(0);
    expect(r.diasFerias).toBe(0);
  });
});
