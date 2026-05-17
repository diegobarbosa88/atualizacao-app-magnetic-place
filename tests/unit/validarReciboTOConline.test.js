import { describe, it, expect, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

import { parseReciboTOConline, extrairMetadadosTOConline } from '../../src/utils/validarReciboTOConline.js';

// Formato real do TOConline: labels numa linha, valores na linha seguinte.
// ORIGINAL + DUPLICADO fundem-se na mesma linha (pdfjs lê por coordenada Y).
//
// Caso 1: SS=136,99€, IRS=0%, bruto=3249 → 3249 - 136,99 - 0 = 3112,01 ✓
const TEXT_VALIDO = `
Emitido por TOConline
Segurança Social (11%)   136,99€   Segurança Social (11%)   136,99€
IRS - Taxa efetiva (Subsídio de Férias): 0%.   IRS - Taxa efetiva (Subsídio de Férias): 0%.
Total Abonos  Total Descontos  Total a Receber  Total Abonos  Total Descontos  Total a Receber
3.249,00€  136,99€  3.112,01€  3.249,00€  136,99€  3.112,01€
`;

// Caso 2: SS=110€, IRS=150€ → 1000 - 110 - 150 = 740 ✓
const TEXT_COM_IRS = `
Emitido por TOConline
Segurança Social (11%)   110,00€   Segurança Social (11%)   110,00€
IRS   150,00€   IRS   150,00€
Total Abonos  Total Descontos  Total a Receber  Total Abonos  Total Descontos  Total a Receber
1.000,00€  260,00€  740,00€  1.000,00€  260,00€  740,00€
`;

// Caso 3: Formato real com Abono intercalado antes do Desconto (pdfjs: coluna ABONO → DESCONTO).
// SS: linha termina em 110,00€ (desconto), tendo 1000€ de abono antes
// IRS: linha termina em 76,00€ (desconto), tendo 1251,23€ de incidência e 99,67€ parcela na desc.
// Outros descontos (Adiantamento 100€) são ignorados no cálculo.
// bruto=1251,23, SS=110, IRS=76 → liquidoCalculado=1065,23; liquidoPDF=1065,23 ✓
const TEXT_ABONO_INTERCALADO = `
Emitido por TOConline
Segurança Social (11%)   1.000,00€   110,00€   Segurança Social (11%)   1.000,00€   110,00€
IRS ( Incidência 1251.23€ ; Taxa IRS 15.7% ; Parcela a 76,00€   IRS ( Incidência 1251.23€ ; Taxa IRS 15.7% ; Parcela a 76,00€
abater 99.67€)   abater 99.67€)
Adiantamento   100,00€   Adiantamento   100,00€
Total Abonos  Total Descontos  Total a Receber  Total Abonos  Total Descontos  Total a Receber
1.251,23€  286,00€  1.065,23€  1.251,23€  286,00€  1.065,23€
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

  it('extrai SS e IRS corretamente quando Abono está intercalado (formato real pdfjs)', () => {
    // SS=110, IRS=76, bruto=1251.23 → liquidoCalculado=1065.23 = liquidoPDF → válido
    const res = parseReciboTOConline(TEXT_ABONO_INTERCALADO, 1251.23);
    expect(res.sucesso).toBe(true);
    expect(res.ssExtraido).toBe(110.00);
    expect(res.irsExtraido).toBe(76.00);
    expect(res.liquidoExtraido).toBe(1065.23);
    expect(res.valido).toBe(true);
  });

  it('valido=false quando há divergência maior que 0,02€', () => {
    const text = [
      'Emitido por TOConline',
      'Segurança Social (11%)   136,99€',
      'Total Abonos  Total Descontos  Total a Receber',
      '3.249,00€  136,99€  3.000,00€',
    ].join('\n');
    const res = parseReciboTOConline(text, 3249.00);
    expect(res.sucesso).toBe(true);
    expect(res.valido).toBe(false);
    expect(res.divergencia).toBeGreaterThan(0.02);
  });

  it('aceita divergência dentro da margem de 0,02€', () => {
    // 3249 - 136.99 - 0 = 3112.01; líquido no PDF = 3112.02 → divergência=0.01 → válido
    const text = [
      'Emitido por TOConline',
      'Segurança Social (11%)   136,99€',
      'Total Abonos  Total Descontos  Total a Receber',
      '3.249,00€  136,99€  3.112,02€',
    ].join('\n');
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
    const text = [
      'Emitido por TOConline',
      'Segurança Social (11%)   136,99€',
      'Total Abonos  Total Descontos  Total a Receber',
      '3.249,00€  136,99€  3.000,00€',
    ].join('\n');
    const res = parseReciboTOConline(text, 3249.00);
    expect(res.mensagem).toMatch(/Divergência/);
    expect(res.divergencia).toBeCloseTo(112.01, 1);
  });
});

describe('extrairMetadadosTOConline', () => {
  // Simula texto real: ORIGINAL + DUPLICADO fundidos na mesma linha por coordenada Y
  const TEXT_REAL = [
    'De 1 de Abril 2026 De 1 de Abril 2026',
    'Nome: ANDRE MARCOS SILVA Nome: ANDRE MARCOS SILVA',
    'Nº Contribuinte: 329434110 Nº Mecanográfico 35',
  ].join('\n');

  it('extrai nome do campo "Nome:" ignorando o duplicado', () => {
    const { nome } = extrairMetadadosTOConline(TEXT_REAL);
    expect(nome).toBe('ANDRE MARCOS SILVA');
  });

  it('extrai mês e ano no formato YYYY-MM', () => {
    const { mes } = extrairMetadadosTOConline(TEXT_REAL);
    expect(mes).toBe('2026-04');
  });

  it('devolve null quando os campos não existem', () => {
    const { nome, mes } = extrairMetadadosTOConline('Texto sem campos relevantes');
    expect(nome).toBeNull();
    expect(mes).toBeNull();
  });
});
