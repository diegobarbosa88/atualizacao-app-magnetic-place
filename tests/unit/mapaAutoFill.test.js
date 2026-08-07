import { describe, it, expect } from 'vitest';
import {
  findBestCombo,
  horaDefaultPartida,
  horaDefaultChegada,
  pctFromHoraPartida,
  pctFromHoraChegada,
} from '../../src/lib/payroll/mapaAutoFill.js';

// ---------------------------------------------------------------------------
// findBestCombo — caso real: Edilson Sousa do Nascimento, Junho 2026
// ---------------------------------------------------------------------------

describe('findBestCombo — Edilson Sousa do Nascimento (Junho 2026)', () => {
  // ajudaNecessaria = 2030.86€
  // valorDiario     = 156.36€
  // N=14, fP=1.00, fC=0.50 → total = 156.36 × 13.50 = 2110.86€
  //
  // subsAlimMapa esperado ≈ 80€ (8 dias úteis × 10€/dia)
  //   → valorNec = 2030.86 + 80.00 = 2110.86 (diff = 0, melhor possível)
  //
  // Caso realista com 9.60€/dia × 8 dias úteis = 76.80€:
  //   → valorNec = 2030.86 + 76.80 = 2107.66 (diff = −3.20, dentro de ±5€)
  //
  // Em ambos os casos o algoritmo deve encontrar N=14, fP=1.00, fC=0.50 porque
  // N=15,fP=0.50,fC=0.00 dá o mesmo total (2110.86€) mas perde na regra 3 (fP).

  const VALOR_DIARIO = 156.36;
  const MAX_N        = 30; // Junho tem 30 dias

  it('cenário exacto (subsAlim=80€): encontra N=14, fP=1.00, fC=0.50', () => {
    const combo = findBestCombo(2030.86 + 80.00, VALOR_DIARIO, MAX_N);
    expect(combo).not.toBeNull();
    expect(combo.N).toBe(14);
    expect(combo.fP).toBe(1.00);
    expect(combo.fC).toBe(0.50);
  });

  it('cenário realista (subsAlim=76.80€): encontra N=14, fP=1.00, fC=0.50', () => {
    const combo = findBestCombo(2030.86 + 76.80, VALOR_DIARIO, MAX_N);
    expect(combo).not.toBeNull();
    expect(combo.N).toBe(14);
    expect(combo.fP).toBe(1.00);
    expect(combo.fC).toBe(0.50);
  });

  it('total da combinação é 2110.86€', () => {
    const combo = findBestCombo(2030.86 + 80.00, VALOR_DIARIO, MAX_N);
    expect(combo.total).toBeCloseTo(2110.86, 2);
  });

  it('diff fica dentro de ±5€ (sem A008 necessário)', () => {
    const combo = findBestCombo(2030.86 + 76.80, VALOR_DIARIO, MAX_N);
    expect(combo.absDiff).toBeLessThanOrEqual(5);
  });

  it('N=15,fP=0.50,fC=0.00 dá o mesmo total mas perde para N=14,fP=1.00 (regra fP maior)', () => {
    // Verificar que a regra de desempate rejeita a alternativa "tardia"
    const combo = findBestCombo(2110.86, VALOR_DIARIO, MAX_N);
    expect(combo.N).toBe(14);   // não 15
    expect(combo.fP).toBe(1.00); // não 0.50
  });
});

// ---------------------------------------------------------------------------
// findBestCombo — regras de desempate
// ---------------------------------------------------------------------------

describe('findBestCombo — regra 2: prefere diff ≥ 0', () => {
  // valorDiario=100, valorNec=212.5, maxN=5
  //   N=3, fP=1.00, fC=0.00 → total=200, diff=+12.5  (diff ≥ 0)
  //   N=3, fP=1.00, fC=0.25 → total=225, diff=−12.5  (diff < 0)
  //   N=3, fP=0.75, fC=0.50 → total=225, diff=−12.5  (diff < 0)
  //   Todos com |diff|=12.5 → ganha o único com diff≥0

  it('prefere diff ≥ 0 a diff < 0 quando |diff| é igual', () => {
    const combo = findBestCombo(212.5, 100, 5);
    expect(combo.diff).toBeGreaterThanOrEqual(0);
    expect(combo.fC).toBe(0.00); // única chegada que dá diff≥0
  });
});

describe('findBestCombo — regra 3: prefere fP maior', () => {
  // Dois combos com mesmo total e |diff|=0: N=14,fP=1.00,fC=0.50 vs N=15,fP=0.50,fC=0.00
  // (ambos totalizam valorDiario × 13.50)
  // fP=1.00 > fP=0.50 → N=14 ganha
  it('prefere fP=1.00 (partida padrão) sobre fP=0.50 com N maior', () => {
    const combo = findBestCombo(100 * 13.5, 100, 20); // valorNec = 1350
    expect(combo.fP).toBe(1.00);
  });
});

describe('findBestCombo — caso mínimo N=2', () => {
  // N=2, fP=1.00, fC=0.50 → total = valorDiario × (0+1+0.5) = 1.5 × valorDiario
  it('encontra N=2 quando valorNec = valorDiario × 1.5', () => {
    const combo = findBestCombo(150, 100, 5);
    expect(combo.N).toBe(2);
    expect(combo.fP).toBe(1.00);
    expect(combo.fC).toBe(0.50);
    expect(combo.diff).toBe(0);
  });

  it('total para N=2, fP=1.00, fC=0.50 é valorDiario×1.5', () => {
    const combo = findBestCombo(150, 100, 5);
    expect(combo.total).toBeCloseTo(150, 2);
  });
});

describe('findBestCombo — entradas inválidas devolvem null', () => {
  it('valorNec = 0 → null', () => expect(findBestCombo(0,   100, 5)).toBeNull());
  it('valorNec < 0 → null', () => expect(findBestCombo(-10, 100, 5)).toBeNull());
  it('valorDiario = 0 → null', () => expect(findBestCombo(500, 0, 5)).toBeNull());
  it('maxN = 1 → null',  () => expect(findBestCombo(500, 100, 1)).toBeNull());
});

// ---------------------------------------------------------------------------
// horaDefaultPartida — horas de referência por fração legal
// ---------------------------------------------------------------------------

describe('horaDefaultPartida', () => {
  it('100% → 07:30 por defeito',        () => expect(horaDefaultPartida(1.00)).toBe('07:30'));
  it('75%  → 14:00',                    () => expect(horaDefaultPartida(0.75)).toBe('14:00'));
  it('50%  → 21:30',                    () => expect(horaDefaultPartida(0.50)).toBe('21:30'));
  it('100% respeita override do toolbar',() => expect(horaDefaultPartida(1.00, '08:00')).toBe('08:00'));
  it('75%  ignora override (hora fixa)', () => expect(horaDefaultPartida(0.75, '09:00')).toBe('14:00'));
});

describe('horaDefaultChegada', () => {
  it('50%  → 21:30 por defeito',         () => expect(horaDefaultChegada(0.50)).toBe('21:30'));
  it('25%  → 19:00',                     () => expect(horaDefaultChegada(0.25)).toBe('19:00'));
  it('0%   → 10:00',                     () => expect(horaDefaultChegada(0.00)).toBe('10:00'));
  it('50%  respeita override do toolbar', () => expect(horaDefaultChegada(0.50, '20:30')).toBe('20:30'));
  it('25%  ignora override (hora fixa)',  () => expect(horaDefaultChegada(0.25, '18:00')).toBe('19:00'));
});

// ---------------------------------------------------------------------------
// pctFromHoraPartida / pctFromHoraChegada
// ---------------------------------------------------------------------------

describe('pctFromHoraPartida', () => {
  it('07:30 → 100%', () => expect(pctFromHoraPartida('07:30')).toBe(100));
  it('12:59 → 100%', () => expect(pctFromHoraPartida('12:59')).toBe(100));
  it('13:00 → 75%',  () => expect(pctFromHoraPartida('13:00')).toBe(75));
  it('14:00 → 75%',  () => expect(pctFromHoraPartida('14:00')).toBe(75));
  it('20:59 → 75%',  () => expect(pctFromHoraPartida('20:59')).toBe(75));
  it('21:00 → 50%',  () => expect(pctFromHoraPartida('21:00')).toBe(50));
  it('23:00 → 50%',  () => expect(pctFromHoraPartida('23:00')).toBe(50));
});

describe('pctFromHoraChegada', () => {
  it('10:00 →  0%',  () => expect(pctFromHoraChegada('10:00')).toBe(0));
  it('12:59 →  0%',  () => expect(pctFromHoraChegada('12:59')).toBe(0));
  it('13:00 → 25%',  () => expect(pctFromHoraChegada('13:00')).toBe(25));
  it('19:00 → 25%',  () => expect(pctFromHoraChegada('19:00')).toBe(25));
  it('19:59 → 25%',  () => expect(pctFromHoraChegada('19:59')).toBe(25));
  it('20:00 → 50%',  () => expect(pctFromHoraChegada('20:00')).toBe(50));
  it('21:30 → 50%',  () => expect(pctFromHoraChegada('21:30')).toBe(50));
});
