import { describe, it, expect } from 'vitest';
import { calcularFeriados, calcularDiasUteisNoMes } from '../../src/lib/payroll/feriadosPortugal.js';

// ---------------------------------------------------------------------------
// calcularFeriados
// ---------------------------------------------------------------------------

describe('calcularFeriados', () => {
  it('inclui os 13 feriados nacionais de 2026', () => {
    const f = calcularFeriados(2026);
    expect(f.has('2026-01-01')).toBe(true); // Ano Novo
    expect(f.has('2026-04-25')).toBe(true); // Liberdade
    expect(f.has('2026-05-01')).toBe(true); // Trabalhador
    expect(f.has('2026-06-10')).toBe(true); // Dia de Portugal
    expect(f.has('2026-08-15')).toBe(true); // Assunção
    expect(f.has('2026-10-05')).toBe(true); // República
    expect(f.has('2026-11-01')).toBe(true); // Todos os Santos
    expect(f.has('2026-12-01')).toBe(true); // Restauração
    expect(f.has('2026-12-08')).toBe(true); // Imaculada
    expect(f.has('2026-12-25')).toBe(true); // Natal
    expect(f.size).toBe(13);
  });

  it('Páscoa 2026 é 5 de Abril (domingo)', () => {
    const f = calcularFeriados(2026);
    expect(f.has('2026-04-05')).toBe(true);
    expect(new Date('2026-04-05').getDay()).toBe(0); // domingo
  });

  it('Sexta-feira Santa 2026 é 3 de Abril', () => {
    const f = calcularFeriados(2026);
    expect(f.has('2026-04-03')).toBe(true);
    expect(new Date('2026-04-03').getDay()).toBe(5); // sexta
  });

  it('Corpo de Deus 2026 é 4 de Junho (Páscoa + 60 dias)', () => {
    const f = calcularFeriados(2026);
    expect(f.has('2026-06-04')).toBe(true);
    expect(new Date('2026-06-04').getDay()).toBe(4); // quinta
  });

  it('adiciona feriado municipal em formato MM-DD', () => {
    const f = calcularFeriados(2026, '06-13');
    expect(f.has('2026-06-13')).toBe(true);
    expect(f.size).toBe(14);
  });

  it('adiciona feriado municipal em formato YYYY-MM-DD', () => {
    const f = calcularFeriados(2026, '2026-06-13');
    expect(f.has('2026-06-13')).toBe(true);
    expect(f.size).toBe(14);
  });

  it('Páscoa 2025 é 20 de Abril', () => {
    const f = calcularFeriados(2025);
    expect(f.has('2025-04-20')).toBe(true); // Páscoa
    expect(f.has('2025-04-18')).toBe(true); // Sexta-feira Santa
    expect(f.has('2025-06-19')).toBe(true); // Corpo de Deus (Abril 20 + 60)
  });
});

// ---------------------------------------------------------------------------
// calcularDiasUteisNoMes — casos base
// ---------------------------------------------------------------------------

describe('calcularDiasUteisNoMes — mês sem feriados a meio de semana', () => {
  it('agosto 2026: 21 dias úteis (Aug-15 cai a sábado, não desconta duas vezes)', () => {
    // Ago 2026: Ago-1 = Sábado → 5 sábados (1,8,15,22,29) + 5 domingos (2,9,16,23,30) = 10 WE
    // 31 - 10 = 21 dias úteis; feriado Aug-15 é sábado → sem desconto extra
    expect(calcularDiasUteisNoMes(2026, 8)).toBe(21);
  });

  it('janeiro 2026: 21 dias úteis (Jan-1 é quinta-feira)', () => {
    // Jan 2026: Jan-1 = Quinta; sábados: 3,10,17,24,31 (5), domingos: 4,11,18,25 (4) → 9 WE
    // 31 - 9 = 22 dias de semana; -1 feriado (Jan-1 quinta) = 21
    expect(calcularDiasUteisNoMes(2026, 1)).toBe(21);
  });
});

// ---------------------------------------------------------------------------
// calcularDiasUteisNoMes — mês com feriados móveis (Junho 2026)
// ---------------------------------------------------------------------------

describe('calcularDiasUteisNoMes — junho 2026 (feriados móveis)', () => {
  it('junho 2026: 20 dias úteis (Corpo de Deus 4-Jun + Dia de Portugal 10-Jun)', () => {
    // Jun 2026: Jun-1 = Segunda; sábados: 6,13,20,27 (4); domingos: 7,14,21,28 (4) → 8 WE
    // 30 - 8 = 22 dias de semana; -2 feriados (4-jun quinta, 10-jun quarta) = 20
    expect(calcularDiasUteisNoMes(2026, 6)).toBe(20);
  });

  it('junho 2026 com feriado municipal: 19 dias úteis', () => {
    // Feriado municipal a 3-Jun (quarta), dia de semana
    expect(calcularDiasUteisNoMes(2026, 6, { feriadoMunicipal: '06-03' })).toBe(19);
  });

  it('feriado municipal que cai ao fim de semana não reduz dias úteis', () => {
    // 6-Jun 2026 = sábado → feriado municipal não tem efeito
    const semFeriado = calcularDiasUteisNoMes(2026, 6);
    const comFeriado = calcularDiasUteisNoMes(2026, 6, { feriadoMunicipal: '06-06' });
    expect(comFeriado).toBe(semFeriado);
  });
});

// ---------------------------------------------------------------------------
// calcularDiasUteisNoMes — admissão a meio do mês
// ---------------------------------------------------------------------------

describe('calcularDiasUteisNoMes — admissão a meio do mês', () => {
  it('admissão a 15-Jun-2026 (segunda): 12 dias úteis a partir dessa data', () => {
    // 15-19: seg-sex = 5 (sem feriados após 15 em junho)
    // 22-26: seg-sex = 5
    // 29-30: seg-ter = 2
    // Total: 12
    expect(calcularDiasUteisNoMes(2026, 6, { dataAdmissao: '2026-06-15' })).toBe(12);
  });

  it('admissão a 1 de agosto 2026 (sábado): conta a partir do primeiro dia útil (3-ago)', () => {
    // dataAdmissao = '2026-08-01' (sábado) → não é dia útil, primeiro útil é 3-ago (segunda)
    // Nenhum dia é excluído para dias úteis (sábado/domingo já ignorados pelo filtro dow)
    // Resultado = igual ao total de agosto 2026 = 21
    expect(calcularDiasUteisNoMes(2026, 8, { dataAdmissao: '2026-08-01' })).toBe(21);
  });

  it('cessação a 15-Jun-2026 (segunda): 9 dias úteis até essa data inclusive', () => {
    // Semana 1-5: 5 dias - 1 feriado (4-jun=Quinta) = 4
    // Semana 8-12: 5 dias - 1 feriado (10-jun=Quarta) = 4
    // Semana 15 (só segunda): 1
    // Total: 9
    expect(calcularDiasUteisNoMes(2026, 6, { dataCessacao: '2026-06-15' })).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// calcularDiasUteisNoMes — ausências
// ---------------------------------------------------------------------------

describe('calcularDiasUteisNoMes — ausências aprovadas', () => {
  it('duas ausências em dias úteis de agosto 2026: 21 - 2 = 19', () => {
    expect(
      calcularDiasUteisNoMes(2026, 8, { ausencias: ['2026-08-03', '2026-08-04'] })
    ).toBe(19);
  });

  it('ausência num fim de semana não tem efeito (dia já excluído)', () => {
    // 2026-08-01 é sábado
    expect(
      calcularDiasUteisNoMes(2026, 8, { ausencias: ['2026-08-01'] })
    ).toBe(21);
  });

  it('ausência num feriado não tem efeito duplo (feriado já excluído)', () => {
    // 2026-01-01 é feriado (quinta)
    expect(
      calcularDiasUteisNoMes(2026, 1, { ausencias: ['2026-01-01'] })
    ).toBe(21);
  });
});

// ---------------------------------------------------------------------------
// calcularDiasUteisNoMes — horário reduzido (horasSemana)
// ---------------------------------------------------------------------------

describe('calcularDiasUteisNoMes — horário reduzido', () => {
  it('32h/semana → 4 dias/semana (Seg–Qui): agosto 2026 = 17 dias', () => {
    // Seg: 3,10,17,24,31 = 5; Ter: 4,11,18,25 = 4; Qua: 5,12,19,26 = 4; Qui: 6,13,20,27 = 4
    // 5+4+4+4 = 17; feriado 15-ago = sábado → não afeta
    expect(calcularDiasUteisNoMes(2026, 8, { horasSemana: 32 })).toBe(17);
  });

  it('40h/semana (padrão) → 5 dias/semana: agosto 2026 = 21 dias', () => {
    expect(calcularDiasUteisNoMes(2026, 8, { horasSemana: 40 })).toBe(21);
  });
});

// ---------------------------------------------------------------------------
// calcularDiasUteisNoMes — edição manual não deve ser sobrescrita
// (teste de contrato: o valor retornado é sempre o calculado, quem protege
//  é a UI — aqui testamos apenas que a função é pura e determinística)
// ---------------------------------------------------------------------------

describe('calcularDiasUteisNoMes — determinismo', () => {
  it('chamadas repetidas com os mesmos argumentos devolvem sempre o mesmo valor', () => {
    const r1 = calcularDiasUteisNoMes(2026, 6);
    const r2 = calcularDiasUteisNoMes(2026, 6);
    expect(r1).toBe(r2);
  });
});
