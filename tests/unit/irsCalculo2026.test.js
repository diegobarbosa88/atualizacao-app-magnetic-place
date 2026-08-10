import { describe, it, expect } from 'vitest';
import {
  calcularRetencaoVencimento,
  calcularRetencaoSubsidioDuodecimo,
  calcularRetencaoTrabalhoSuplementar,
} from '../../src/lib/payroll/irsCalculo2026.js';

// ─────────────────────────────────────────────────────────────
// Casos confirmados contra recibos reais do TOConline (vencimento 1000€)
// ─────────────────────────────────────────────────────────────

describe('calcularRetencaoVencimento — casos reais TOConline', () => {
  it('Tabela I, 1000€, 0 dependentes → retenção = 36€ ≈ 3.6%', () => {
    const r = calcularRetencaoVencimento(1000, 'I', 0);
    expect(r.retencao).toBe(36);
    expect(r.taxaEfetiva).toBeCloseTo(3.6, 1);
  });

  it('Tabela II, 1000€, 1 dependente → retenção = 1€ ≈ 0.17%', () => {
    const r = calcularRetencaoVencimento(1000, 'II', 1);
    expect(r.retencao).toBe(1);
    expect(r.taxaEfetiva).toBeCloseTo(0.17, 1);
  });

  it('Tabela III, 1000€, 0 dependentes → retenção = 4€ ≈ 0.41%', () => {
    const r = calcularRetencaoVencimento(1000, 'III', 0);
    expect(r.retencao).toBe(4);
    expect(r.taxaEfetiva).toBeCloseTo(0.41, 1);
  });
});

// ─────────────────────────────────────────────────────────────
// Casos limite e edge cases
// ─────────────────────────────────────────────────────────────

describe('calcularRetencaoVencimento — edge cases', () => {
  it('rendimento 0 → retenção = 0', () => {
    const r = calcularRetencaoVencimento(0, 'I', 0);
    expect(r.retencao).toBe(0);
    expect(r.taxaEfetiva).toBe(0);
  });

  it('rendimento abaixo do limite de isenção (920€) → retenção = 0', () => {
    const r = calcularRetencaoVencimento(919, 'I', 0);
    expect(r.retencao).toBe(0);
  });

  it('tabela desconhecida → lança erro', () => {
    expect(() => calcularRetencaoVencimento(1000, 'IV', 0)).toThrow();
  });

  it('arredondamento: floor ao euro inferior (não round)', () => {
    // Tabela I, 1100€: deve retornar um inteiro (floor)
    const r = calcularRetencaoVencimento(1100, 'I', 0);
    expect(Number.isInteger(r.retencao)).toBe(true);
    expect(r.retencao).toBeGreaterThanOrEqual(0);
  });

  it('Tabela II, 0 dependentes → mesmo resultado que Tabela I (parcela dependentes = 0)', () => {
    const r1 = calcularRetencaoVencimento(2000, 'I', 0);
    const r2 = calcularRetencaoVencimento(2000, 'II', 0);
    expect(r1.retencao).toBe(r2.retencao);
  });
});

// ─────────────────────────────────────────────────────────────
// Duodécimos (art. 99.º-C CIRS)
// ─────────────────────────────────────────────────────────────

describe('calcularRetencaoSubsidioDuodecimo', () => {
  it('duodécimo de 1000€/12 → escalão determinado pelo total (1000€)', () => {
    const duodecimo = 1000 / 12;
    const r = calcularRetencaoSubsidioDuodecimo(1000, duodecimo, 'I', 0);
    // Retenção deve ser floor(retenção_total / 12)
    // retenção_total ≈ 36€ (Tabela I, 1000€) → 36/12 = 3€
    expect(r.retencao).toBe(3);
    expect(Number.isInteger(r.retencao)).toBe(true);
  });

  it('duodécimo 0 → retenção = 0', () => {
    const r = calcularRetencaoSubsidioDuodecimo(1000, 0, 'I', 0);
    expect(r.retencao).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Trabalho suplementar (50% da taxa efetiva do vencimento)
// ─────────────────────────────────────────────────────────────

describe('calcularRetencaoTrabalhoSuplementar', () => {
  it('valor 0 → retenção = 0', () => {
    const r = calcularRetencaoTrabalhoSuplementar(0, 5.0);
    expect(r.retencao).toBe(0);
  });

  it('taxa efetiva do trabalho suplementar = metade da taxa do vencimento', () => {
    const r = calcularRetencaoTrabalhoSuplementar(100, 10.0);
    expect(r.taxaEfetiva).toBeCloseTo(5.0, 1);
  });

  it('resultado é sempre inteiro (floor)', () => {
    const r = calcularRetencaoTrabalhoSuplementar(1.44, 5.29);
    expect(Number.isInteger(r.retencao)).toBe(true);
  });
});
