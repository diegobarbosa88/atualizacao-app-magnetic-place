import { describe, it, expect } from 'vitest';
import { getRateAtDate, calcularFaturacaoCliente } from '../../src/lib/faturacao/tarifaHistorica.js';

describe('getRateAtDate', () => {
  it('sem histórico → devolve a tarifa atual (fallback)', () => {
    expect(getRateAtDate('2026-05-10', [], 25)).toBe(25);
  });

  it('data anterior ao primeiro registo do histórico → devolve valor_anterior desse registo', () => {
    const history = [{ data_alteracao: '2026-05-01T00:00:00Z', valor_anterior: 20, valor_novo: 25 }];
    expect(getRateAtDate('2026-04-15', history, 30)).toBe(20);
  });

  it('data depois de uma alteração → devolve valor_novo em vigor nessa data', () => {
    const history = [{ data_alteracao: '2026-05-15T00:00:00Z', valor_anterior: 20, valor_novo: 25 }];
    expect(getRateAtDate('2026-05-20', history, 30)).toBe(25);
    expect(getRateAtDate('2026-05-10', history, 30)).toBe(20);
  });
});

describe('calcularFaturacaoCliente — paridade com Custos → Clientes', () => {
  // Réplica minimalista da agregação usada em useCostReportsData.js (mesma
  // fórmula, para provar que calcularFaturacaoCliente produz IDENTICAMENTE
  // o mesmo valor que a coluna "Faturação (€)" mostra para o mesmo cliente/mês.
  function faturacaoClientesTabEquivalente({ logs, clientId, periodo, valorHoraAtual, clientRateHistory }) {
    const clientHistory = clientRateHistory.filter(h => h.client_id === clientId);
    return logs
      .filter(l => l.clientId === clientId && (l.date || '').startsWith(periodo))
      .reduce((sum, l) => sum + (Number(l.hours) || 0) * getRateAtDate(l.date, clientHistory, valorHoraAtual), 0);
  }

  it('tarifa constante no mês → valor por defeito do modal == valor em Custos → Clientes', () => {
    const logs = [
      { clientId: 'c1', date: '2026-05-05', hours: 8 },
      { clientId: 'c1', date: '2026-05-12', hours: 6 },
      { clientId: 'c2', date: '2026-05-05', hours: 10 }, // outro cliente, não deve entrar
    ];
    const clientRateHistory = [];
    const valorHoraAtual = 25;

    const esperado = faturacaoClientesTabEquivalente({ logs, clientId: 'c1', periodo: '2026-05', valorHoraAtual, clientRateHistory });
    const { valorFaturado } = calcularFaturacaoCliente({ logs, clientId: 'c1', periodo: '2026-05', valorHoraAtual, clientRateHistory });

    expect(valorFaturado).toBeCloseTo(esperado, 6);
    expect(valorFaturado).toBeCloseTo(14 * 25, 6); // 8h+6h × 25€/h
  });

  it('tarifa mudou a meio do mês → valor por defeito do modal continua == Custos → Clientes (o bug que estamos a corrigir)', () => {
    const logs = [
      { clientId: 'c1', date: '2026-05-05', hours: 10 }, // antes da mudança → tarifa antiga (20€)
      { clientId: 'c1', date: '2026-05-20', hours: 10 }, // depois da mudança → tarifa nova (30€)
    ];
    const clientRateHistory = [
      { client_id: 'c1', data_alteracao: '2026-05-15T00:00:00Z', valor_anterior: 20, valor_novo: 30 },
    ];
    const valorHoraAtual = 30; // tarifa "atual" do cliente — é o que FaturarClienteModal usava ANTES da correção

    const esperado = faturacaoClientesTabEquivalente({ logs, clientId: 'c1', periodo: '2026-05', valorHoraAtual, clientRateHistory });
    const { valorFaturado, totalHoras } = calcularFaturacaoCliente({ logs, clientId: 'c1', periodo: '2026-05', valorHoraAtual, clientRateHistory });

    // valor correto (respeitando histórico): 10×20 + 10×30 = 500
    expect(esperado).toBeCloseTo(500, 6);
    expect(valorFaturado).toBeCloseTo(esperado, 6);
    expect(valorFaturado).toBeCloseTo(500, 6);

    // antes da correção, o modal teria proposto 20h × 30€ (tarifa atual) = 600€ — divergente.
    const valorAntigoDoModal = totalHoras * valorHoraAtual;
    expect(valorAntigoDoModal).toBeCloseTo(600, 6);
    expect(valorAntigoDoModal).not.toBeCloseTo(valorFaturado, 6); // prova que o bug era real

    // preço-por-hora efetivo que o modal agora propõe (valorFaturado ÷ totalHoras)
    // continua a reproduzir o total correto quando multiplicado pela quantidade:
    const precoUnitarioProposto = valorFaturado / totalHoras;
    expect(precoUnitarioProposto * totalHoras).toBeCloseTo(500, 6);
  });

  it('sem logs no período → totalHoras e valorFaturado ficam a 0, sem erro', () => {
    const r = calcularFaturacaoCliente({ logs: [], clientId: 'c1', periodo: '2026-05', valorHoraAtual: 25, clientRateHistory: [] });
    expect(r).toEqual({ totalHoras: 0, valorFaturado: 0 });
  });
});
