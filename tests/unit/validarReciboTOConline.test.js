import { describe, it, expect, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

import { parseReciboTOConline } from '../../src/utils/validarReciboTOConline.js';

// Formato real extraído pelo pdfjs-dist: Descontos → Abonos → Líquido
const TEXT_VALIDO = `
Emitido por TOConline
Total Descontos  136,99€  Total Abonos  3.249,00€   3.112,01€
`;

describe('parseReciboTOConline', () => {
  it('devolve valido=true quando as contas batem certo', () => {
    const res = parseReciboTOConline(TEXT_VALIDO, 3249.00);
    expect(res.sucesso).toBe(true);
    expect(res.valido).toBe(true);
    expect(res.abonosExtraidos).toBe(3249.00);
    expect(res.descontosExtraidos).toBe(136.99);
    expect(res.liquidoExtraido).toBe(3112.01);
    expect(res.divergencia).toBe(0);
  });

  it('devolve valido=false quando há divergência maior que 0,02€', () => {
    const text = `Emitido por TOConline\nTotal Descontos  136,99€  Total Abonos  3.249,00€   3.000,00€`;
    const res = parseReciboTOConline(text, 3249.00);
    expect(res.sucesso).toBe(true);
    expect(res.valido).toBe(false);
    expect(res.divergencia).toBeGreaterThan(0.02);
  });

  it('aceita divergência dentro da margem de 0,02€', () => {
    // bruto=3249, descontos=136.99, líquido=3112.02 → divergência=0.01 → válido
    const text = `Emitido por TOConline\nTotal Descontos  136,99€  Total Abonos  3.249,00€   3.112,02€`;
    const res = parseReciboTOConline(text, 3249.00);
    expect(res.sucesso).toBe(true);
    expect(res.valido).toBe(true);
  });

  it('rejeita PDF sem marca TOConline', () => {
    const res = parseReciboTOConline('Outro software de salários', 3249.00);
    expect(res.sucesso).toBe(false);
    expect(res.valido).toBe(false);
    expect(res.mensagem).toMatch(/não reconhecido/i);
  });

  it('devolve sucesso=false quando os totais não são encontrados', () => {
    const res = parseReciboTOConline('Emitido por TOConline\nSem tabela de totais aqui.', 3249.00);
    expect(res.sucesso).toBe(false);
    expect(res.mensagem).toMatch(/extrair os totais/i);
  });

  it('mensagem de erro indica a divergência exata', () => {
    const text = `Emitido por TOConline\nTotal Descontos  136,99€  Total Abonos  3.249,00€   3.000,00€`;
    const res = parseReciboTOConline(text, 3249.00);
    expect(res.mensagem).toMatch(/Divergência/);
    expect(res.divergencia).toBeCloseTo(112.01, 1);
  });
});
