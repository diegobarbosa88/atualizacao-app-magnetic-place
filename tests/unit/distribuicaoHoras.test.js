import { describe, it, expect } from 'vitest';
import { distribuirAjudaPorCliente, clienteUnicoNoHistorico } from '../../src/lib/ajudas/distribuicaoHoras.js';

describe('distribuirAjudaPorCliente', () => {
  it('distribui proporcionalmente por horas quando há logs no mês', () => {
    const { atribuicoes, semLogs, semWorkerId } = distribuirAjudaPorCliente({
      validacoes: [{ worker_id: 'w1', mes: '2026-05', ajudas_custo_extraidas: 100 }],
      logs: [
        { workerId: 'w1', clientId: 'c1', date: '2026-05-01', hours: 6 },
        { workerId: 'w1', clientId: 'c2', date: '2026-05-02', hours: 4 },
      ],
    });
    expect(semLogs).toEqual([]);
    expect(semWorkerId).toEqual([]);
    expect(atribuicoes.find(a => a.clientId === 'c1').ajudaAtribuidaProporcional).toBeCloseTo(60, 6);
    expect(atribuicoes.find(a => a.clientId === 'c2').ajudaAtribuidaProporcional).toBeCloseTo(40, 6);
  });

  it('validação sem worker_id vai para semWorkerId, não para semLogs', () => {
    const { semWorkerId, semLogs } = distribuirAjudaPorCliente({
      validacoes: [{ worker_id: null, mes: '2026-05', ajudas_custo_extraidas: 100 }],
      logs: [],
    });
    expect(semWorkerId).toEqual([{ mes: '2026-05', ajudaCustoDoMes: 100 }]);
    expect(semLogs).toEqual([]);
  });
});

describe('clienteUnicoNoHistorico', () => {
  it('worker com 100% do histórico num único cliente → devolve esse clientId', () => {
    const logs = [
      { clientId: 'c1', date: '2025-01-10' },
      { clientId: 'c1', date: '2025-03-05' },
      { clientId: 'c1', date: '2026-06-20' },
    ];
    const r = clienteUnicoNoHistorico({ logsHistoricoWorker: logs, ateData: '2026-07-31' });
    expect(r).toBe('c1');
  });

  it('worker com histórico dividido entre 2 clientes (mesmo 99%/1%) → devolve null, sem atribuição', () => {
    const logs = [
      ...Array.from({ length: 99 }, (_, i) => ({ clientId: 'c1', date: `2026-0${(i % 6) + 1}-01` })),
      { clientId: 'c2', date: '2026-01-15' }, // só 1 registo do segundo cliente já basta para bloquear
    ];
    const r = clienteUnicoNoHistorico({ logsHistoricoWorker: logs, ateData: '2026-07-31' });
    expect(r).toBeNull();
  });

  it('worker sem logs em todo o histórico → devolve null', () => {
    const r = clienteUnicoNoHistorico({ logsHistoricoWorker: [], ateData: '2026-07-31' });
    expect(r).toBeNull();
  });

  it('ignora logs DEPOIS de ateData — caso real Rafael Marques dos Santos (mudou de cliente em agosto, fora do período)', () => {
    const logs = [
      { clientId: 'grandes-mecanizados', date: '2025-12-05' },
      { clientId: 'grandes-mecanizados', date: '2026-03-20' },
      { clientId: 'grandes-mecanizados', date: '2026-07-31' },
      { clientId: 'sling-supply', date: '2026-08-10' }, // mudança de cliente DEPOIS do período em análise
    ];
    const r = clienteUnicoNoHistorico({ logsHistoricoWorker: logs, ateData: '2026-07-31' });
    // sem o corte por ateData, isto seria "dividido entre 2 clientes" (null);
    // com o corte, só conta o histórico até Jul/2026 → único cliente
    expect(r).toBe('grandes-mecanizados');
  });

  it('logs sem clientId são ignorados na determinação', () => {
    const logs = [
      { clientId: null, date: '2026-01-01' },
      { clientId: 'c1', date: '2026-02-01' },
    ];
    const r = clienteUnicoNoHistorico({ logsHistoricoWorker: logs, ateData: '2026-07-31' });
    expect(r).toBe('c1');
  });
});
