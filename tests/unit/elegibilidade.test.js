import { describe, it, expect, vi } from 'vitest';
import { sugerirElegibilidade } from '../../src/lib/ajudas/elegibilidade.js';

// Mock mínimo de um query builder Supabase encadeável: todos os métodos de
// filtro devolvem o próprio builder, e o builder é "thenable" — resolve
// para { data, error } quando usado com await, tal como o cliente real.
function makeQueryBuilder(result) {
  const builder = {
    select: () => builder,
    gte: () => builder,
    lte: () => builder,
    gt: () => builder,
    in: () => builder,
    eq: () => builder,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function makeDbClient({ validations = [], logs = [] }) {
  const fromSpy = vi.fn((table) => {
    if (table === 'receipt_validations') return makeQueryBuilder({ data: validations, error: null });
    if (table === 'logs') return makeQueryBuilder({ data: logs, error: null });
    throw new Error(`tabela inesperada em sugerirElegibilidade: ${table}`);
  });
  return { from: fromSpy, __fromSpy: fromSpy };
}

describe('sugerirElegibilidade', () => {
  it('trabalhador com 1 único cliente no mês → 100% óbvio', async () => {
    const dbClient = makeDbClient({
      validations: [{ worker_id: 'w1', mes: '2026-05', ajudas_custo_extraidas: 200 }],
      logs: [
        { workerId: 'w1', clientId: 'clienteA', date: '2026-05-03', hours: 8 },
        { workerId: 'w1', clientId: 'clienteA', date: '2026-05-04', hours: 8 },
      ],
    });

    const candidatos = await sugerirElegibilidade({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient });

    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].clientId).toBe('clienteA');
    expect(candidatos[0].evidencia).toHaveLength(1);
    const ev = candidatos[0].evidencia[0];
    expect(ev.horasCliente).toBe(16);
    expect(ev.horasTotalTrabalhadorNoMes).toBe(16);
    expect(ev.pctHorasCliente).toBeCloseTo(1, 6);
    expect(ev.ajudaCustoDoMes).toBe(200);
    expect(ev.ajudaAtribuidaProporcional).toBeCloseTo(200, 6);
  });

  it('trabalhador com vários clientes no mesmo mês → rateio proporcional correto', async () => {
    const dbClient = makeDbClient({
      validations: [{ worker_id: 'w1', mes: '2026-05', ajudas_custo_extraidas: 300 }],
      logs: [
        { workerId: 'w1', clientId: 'clienteA', date: '2026-05-01', hours: 6 }, // 6h
        { workerId: 'w1', clientId: 'clienteB', date: '2026-05-02', hours: 2 }, // 2h
        { workerId: 'w1', clientId: 'clienteB', date: '2026-05-03', hours: 2 }, // +2h = 4h
      ],
    });

    const candidatos = await sugerirElegibilidade({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient });

    expect(candidatos).toHaveLength(2);
    // ordenado por pctHorasCliente decrescente → clienteA (60%) primeiro
    expect(candidatos[0].clientId).toBe('clienteA');
    expect(candidatos[1].clientId).toBe('clienteB');

    const evA = candidatos[0].evidencia[0];
    const evB = candidatos[1].evidencia[0];

    expect(evA.horasCliente).toBe(6);
    expect(evB.horasCliente).toBe(4);
    expect(evA.horasTotalTrabalhadorNoMes).toBe(10);
    expect(evB.horasTotalTrabalhadorNoMes).toBe(10);
    expect(evA.pctHorasCliente).toBeCloseTo(0.6, 6);
    expect(evB.pctHorasCliente).toBeCloseTo(0.4, 6);
    expect(evA.ajudaAtribuidaProporcional).toBeCloseTo(180, 6);
    expect(evB.ajudaAtribuidaProporcional).toBeCloseTo(120, 6);
    // soma das fatias tem de bater com o total real, sem perdas de arredondamento
    expect(evA.ajudaAtribuidaProporcional + evB.ajudaAtribuidaProporcional).toBeCloseTo(300, 6);
  });

  it('mês sem nenhuma ajuda extraída → não aparece nenhum candidato', async () => {
    const dbClient = makeDbClient({
      validations: [{ worker_id: 'w1', mes: '2026-06', ajudas_custo_extraidas: 0 }],
      logs: [
        { workerId: 'w1', clientId: 'clienteA', date: '2026-06-10', hours: 8 },
      ],
    });

    const candidatos = await sugerirElegibilidade({ periodoInicio: '2026-06', periodoFim: '2026-06', dbClient });

    expect(candidatos).toEqual([]);
  });

  it('sem nenhuma linha de receipt_validations no período → não chega a consultar logs', async () => {
    const dbClient = makeDbClient({ validations: [], logs: [] });

    const candidatos = await sugerirElegibilidade({ periodoInicio: '2026-07', periodoFim: '2026-07', dbClient });

    expect(candidatos).toEqual([]);
    expect(dbClient.__fromSpy).toHaveBeenCalledWith('receipt_validations');
    expect(dbClient.__fromSpy).not.toHaveBeenCalledWith('logs');
  });

  it('cliente já com elegivel_ajudas_custo decidido continua a aparecer na evidência — o módulo nunca lê `clients`', async () => {
    // Decisão registada em DECISIONS.md / no cabeçalho do módulo: sugerirElegibilidade()
    // é uma função pura sobre receipt_validations + logs; não sabe nada sobre decisões
    // de elegibilidade já tomadas em `clients`, e por isso nunca as usa para esconder
    // candidatos. Esconder um cliente já decidido é responsabilidade da UI, não deste
    // módulo — para permitir sempre rever/corrigir uma decisão anterior com a evidência
    // completa à vista.
    const dbClient = makeDbClient({
      validations: [{ worker_id: 'w1', mes: '2026-05', ajudas_custo_extraidas: 100 }],
      logs: [{ workerId: 'w1', clientId: 'clienteJaDecidido', date: '2026-05-05', hours: 8 }],
    });

    const candidatos = await sugerirElegibilidade({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient });

    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].clientId).toBe('clienteJaDecidido');
    expect(dbClient.__fromSpy).not.toHaveBeenCalledWith('clients');
  });

  it('logs sem clientId são ignorados (não entram no total nem em nenhum candidato)', async () => {
    const dbClient = makeDbClient({
      validations: [{ worker_id: 'w1', mes: '2026-05', ajudas_custo_extraidas: 100 }],
      logs: [
        { workerId: 'w1', clientId: null, date: '2026-05-01', hours: 8 },
        { workerId: 'w1', clientId: 'clienteA', date: '2026-05-02', hours: 4 },
      ],
    });

    const candidatos = await sugerirElegibilidade({ periodoInicio: '2026-05', periodoFim: '2026-05', dbClient });

    expect(candidatos).toHaveLength(1);
    const ev = candidatos[0].evidencia[0];
    expect(ev.horasTotalTrabalhadorNoMes).toBe(4);
    expect(ev.pctHorasCliente).toBeCloseTo(1, 6);
  });
});
