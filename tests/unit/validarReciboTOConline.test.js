import { describe, it, expect, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

import { parseReciboTOConline } from '../../src/utils/validarReciboTOConline.js';

// Texto real extraído do TOConline: SS=136,99€, IRS=0%, bruto=3249, líquido=3112,01
// fórmula: 3249 - 136,99 - 0 = 3112,01 ✓
const TEXT_VALIDO = `
Emitido por TOConline
Segurança Social (11%)   136,99€
IRS - Taxa efetiva (Subsídio de Férias): 0%.
Total Descontos  136,99€  Total Abonos  3.249,00€   3.112,01€
`;

const TEXT_COM_IRS = `
Emitido por TOConline
Segurança Social (11%)   110,00€
IRS   150,00€
Total Descontos  260,00€  Total Abonos  1.000,00€   740,00€
`;

describe('parseReciboTOConline', () => {
  it('valido=true: bruto - SS - IRS(0) = líquido', () => {
    const res = parseReciboTOConline(TEXT_VALIDO, 3249.00);
    expect(res.sucesso).toBe(true);
    expect(res.valido).toBe(true);
    expect(res.ssExtraido).toBe(136.99);
    expect(res.irsExtraido).toBe(0);
    expect(res.liquidoExtraido).toBe(3112.01);
    expect(res.divergencia).toBe(0);
  });

  it('valido=true: bruto - SS - IRS = líquido (com IRS > 0)', () => {
    // 1000 - 110 - 150 = 740
    const res = parseReciboTOConline(TEXT_COM_IRS, 1000.00);
    expect(res.sucesso).toBe(true);
    expect(res.valido).toBe(true);
    expect(res.ssExtraido).toBe(110.00);
    expect(res.irsExtraido).toBe(150.00);
    expect(res.liquidoExtraido).toBe(740.00);
    expect(res.divergencia).toBe(0);
  });

  it('valido=false quando há divergência maior que 0,02€', () => {
    const text = `Emitido por TOConline\nSegurança Social (11%)   136,99€\nTotal Descontos  136,99€  Total Abonos  3.249,00€   3.000,00€`;
    const res = parseReciboTOConline(text, 3249.00);
    expect(res.sucesso).toBe(true);
    expect(res.valido).toBe(false);
    expect(res.divergencia).toBeGreaterThan(0.02);
  });

  it('aceita divergência dentro da margem de 0,02€', () => {
    // 3249 - 136.99 - 0 = 3112.01; líquido no PDF = 3112.02 → divergência=0.01 → válido
    const text = `Emitido por TOConline\nSegurança Social (11%)   136,99€\nTotal Descontos  136,99€  Total Abonos  3.249,00€   3.112,02€`;
    const res = parseReciboTOConline(text, 3249.00);
    expect(res.sucesso).toBe(true);
    expect(res.valido).toBe(true);
  });

  it('rejeita PDF sem marca TOConline', () => {
    const res = parseReciboTOConline('Outro software de salários', 3249.00);
    expect(res.sucesso).toBe(false);
    expect(res.mensagem).toMatch(/não reconhecido/i);
  });

  it('devolve sucesso=false quando os totais não são encontrados', () => {
    const res = parseReciboTOConline('Emitido por TOConline\nSem tabela de totais aqui.', 3249.00);
    expect(res.sucesso).toBe(false);
    expect(res.mensagem).toMatch(/extrair os totais/i);
  });

  it('mensagem de divergência inclui o valor calculado', () => {
    const text = `Emitido por TOConline\nSegurança Social (11%)   136,99€\nTotal Descontos  136,99€  Total Abonos  3.249,00€   3.000,00€`;
    const res = parseReciboTOConline(text, 3249.00);
    expect(res.mensagem).toMatch(/Divergência/);
    expect(res.divergencia).toBeCloseTo(112.01, 1);
  });
});
