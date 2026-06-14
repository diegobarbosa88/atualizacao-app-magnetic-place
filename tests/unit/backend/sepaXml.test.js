import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gerarSEPAXml } from '../../../api/salarios/_sepaXml.js';

const TRABALHADOR_VALIDO = {
  nome: 'João Silva',
  iban: 'PT50000201231234567890154',
  salario: 1200.50,
  mes: '05',
  ano: '2026',
};

beforeEach(() => {
  process.env.MINHA_CONTA_IBAN = 'PT50000201231234567890154';
  process.env.MINHA_CONTA_BIC = 'NOVAPTPL';
});

afterEach(() => {
  delete process.env.MINHA_CONTA_IBAN;
  delete process.env.MINHA_CONTA_BIC;
});

describe('gerarSEPAXml', () => {
  it('gera XML válido para um trabalhador', () => {
    const xml = gerarSEPAXml([TRABALHADOR_VALIDO]);
    expect(xml).toContain('<?xml');
    expect(xml).toContain('pain.001.001.03');
    expect(xml).toContain('CstmrCdtTrfInitn');
  });

  it('inclui o nome da empresa no XML', () => {
    const xml = gerarSEPAXml([TRABALHADOR_VALIDO]);
    expect(xml).toContain('MAGNETIC PLACE UNIPESSOAL LDA');
  });

  it('inclui o IBAN da empresa', () => {
    const xml = gerarSEPAXml([TRABALHADOR_VALIDO]);
    expect(xml).toContain(process.env.MINHA_CONTA_IBAN);
  });

  it('inclui o BIC da empresa', () => {
    const xml = gerarSEPAXml([TRABALHADOR_VALIDO]);
    expect(xml).toContain('NOVAPTPL');
  });

  it('inclui nome e IBAN do trabalhador', () => {
    const xml = gerarSEPAXml([TRABALHADOR_VALIDO]);
    expect(xml).toContain('João Silva');
    expect(xml).toContain(TRABALHADOR_VALIDO.iban);
  });

  it('formata o valor com 2 casas decimais', () => {
    const xml = gerarSEPAXml([TRABALHADOR_VALIDO]);
    expect(xml).toContain('1200.50');
  });

  it('NbOfTxs corresponde ao número de trabalhadores', () => {
    const trabalhadores = [TRABALHADOR_VALIDO, { ...TRABALHADOR_VALIDO, nome: 'Maria Costa' }];
    const xml = gerarSEPAXml(trabalhadores);
    expect(xml).toContain('<NbOfTxs>2</NbOfTxs>');
  });

  it('CtrlSum é a soma correta dos salários', () => {
    const trabalhadores = [
      { ...TRABALHADOR_VALIDO, salario: 1000.00 },
      { ...TRABALHADOR_VALIDO, salario: 500.50 },
    ];
    const xml = gerarSEPAXml(trabalhadores);
    expect(xml).toContain('<CtrlSum>1500.50</CtrlSum>');
  });

  it('inclui descritivo com mês e ano', () => {
    const xml = gerarSEPAXml([TRABALHADOR_VALIDO]);
    expect(xml).toContain('Vencimento 05/2026');
  });

  it('modo instant inclui código INST e não tem 2 dias úteis de avanço', () => {
    const xml = gerarSEPAXml([TRABALHADOR_VALIDO], { instant: true });
    expect(xml).toContain('<Cd>INST</Cd>');
  });

  it('modo normal NÃO inclui código INST', () => {
    const xml = gerarSEPAXml([TRABALHADOR_VALIDO], { instant: false });
    expect(xml).not.toContain('<Cd>INST</Cd>');
  });

  it('inclui categoria SALA para isenção de taxas', () => {
    const xml = gerarSEPAXml([TRABALHADOR_VALIDO]);
    expect(xml).toContain('<Cd>SALA</Cd>');
  });

  it('lança erro quando MINHA_CONTA_IBAN não está definido', () => {
    delete process.env.MINHA_CONTA_IBAN;
    expect(() => gerarSEPAXml([TRABALHADOR_VALIDO])).toThrow('MINHA_CONTA_IBAN');
  });

  it('lança erro quando MINHA_CONTA_BIC não está definido', () => {
    delete process.env.MINHA_CONTA_BIC;
    expect(() => gerarSEPAXml([TRABALHADOR_VALIDO])).toThrow('MINHA_CONTA_BIC');
  });
});
