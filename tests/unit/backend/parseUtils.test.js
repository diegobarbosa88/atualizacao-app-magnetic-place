import { describe, it, expect } from 'vitest';
import {
  normalizeDate,
  normStr,
  detectColumn,
  cleanCsvValue,
  detectDelimiter,
  normalizeValorCsv,
} from '../../../api/reconciliacao/_parseUtils.js';

describe('normalizeDate', () => {
  it('passa data ISO intacta', () => {
    expect(normalizeDate('2026-05-15')).toBe('2026-05-15');
  });

  it('corta ISO com hora', () => {
    expect(normalizeDate('2026-05-15T14:30:00')).toBe('2026-05-15');
    expect(normalizeDate('2026-05-15 14:30:00')).toBe('2026-05-15');
  });

  it('converte 8 dígitos compactos (OFX)', () => {
    expect(normalizeDate('20260515')).toBe('2026-05-15');
  });

  it('converte DD/MM/YYYY para ISO', () => {
    expect(normalizeDate('15/05/2026')).toBe('2026-05-15');
  });

  it('converte DD-MM-YYYY para ISO', () => {
    expect(normalizeDate('15-05-2026')).toBe('2026-05-15');
  });

  it('converte DD.MM.YYYY para ISO', () => {
    expect(normalizeDate('15.05.2026')).toBe('2026-05-15');
  });

  it('converte YYYY/MM/DD para ISO', () => {
    expect(normalizeDate('2026/05/15')).toBe('2026-05-15');
  });

  it('converte data com mês por extenso PT', () => {
    expect(normalizeDate('15-Mai-2026')).toBe('2026-05-15');
    expect(normalizeDate('15 Janeiro 2026')).toBe('2026-01-15');
    expect(normalizeDate('15-Abr-2026')).toBe('2026-04-15');
  });

  it('converte data com mês por extenso EN', () => {
    expect(normalizeDate('15 May 2026')).toBe('2026-05-15');
    expect(normalizeDate('15-Apr-2026')).toBe('2026-04-15');
  });

  it('retorna null para string vazia ou nula', () => {
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate(undefined)).toBeNull();
  });

  it('retorna null para formato não reconhecido', () => {
    expect(normalizeDate('não é uma data')).toBeNull();
  });
});

describe('normStr', () => {
  it('converte para minúsculas e remove acentos', () => {
    expect(normStr('DESCRIÇÃO')).toBe('descricao');
    expect(normStr('  Março  ')).toBe('marco');
  });
});

describe('detectColumn', () => {
  const headers = ['Data', 'Descrição', 'Valor'];

  it('encontra coluna com nome exato (case-insensitive, sem acentos)', () => {
    expect(detectColumn(headers, ['data'])).toBe('Data');
    expect(detectColumn(headers, ['descricao'])).toBe('Descrição');
  });

  it('retorna undefined quando não encontra', () => {
    expect(detectColumn(headers, ['montante', 'amount'])).toBeUndefined();
  });

  it('retorna primeiro candidato que encontrar', () => {
    expect(detectColumn(headers, ['valor', 'montante'])).toBe('Valor');
  });
});

describe('cleanCsvValue', () => {
  it('remove fórmula Excel =ASC("...")', () => {
    expect(cleanCsvValue('=ASC("texto")')).toBe('texto');
  });

  it('remove fórmula simples =valor', () => {
    expect(cleanCsvValue('=TEXTO')).toBe('TEXTO');
  });

  it('passa string normal intacta', () => {
    expect(cleanCsvValue('normal')).toBe('normal');
  });

  it('passa não-string intacto', () => {
    expect(cleanCsvValue(123)).toBe(123);
  });
});

describe('detectDelimiter', () => {
  it('detecta ponto-e-vírgula quando dominante', () => {
    expect(detectDelimiter('col1;col2;col3')).toBe(';');
  });

  it('detecta vírgula quando dominante', () => {
    expect(detectDelimiter('col1,col2,col3')).toBe(',');
  });

  it('usa vírgula por defeito em empate', () => {
    expect(detectDelimiter('a,b;c')).toBe(',');
  });
});

describe('normalizeValorCsv', () => {
  it('converte formato europeu (1.234,56) para float string', () => {
    expect(normalizeValorCsv('1.234,56')).toBe('1234.56');
  });

  it('passa formato americano (1234.56) intacto', () => {
    expect(normalizeValorCsv('1234.56')).toBe('1234.56');
  });

  it('remove espaços', () => {
    expect(normalizeValorCsv(' 100,50 ')).toBe('100.50');
  });
});
