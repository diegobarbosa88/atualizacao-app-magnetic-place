import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// Parte 3 (2026-08-20): novo separador "Faturas com Observações" — junta
// faturas reais emitidas (status='faturado', Fase 2b) e linhas retroativas
// (origem='historico', Fase 1) num único ecrã de auditoria.

const { CLIENTS, FATURADAS, SIMULADAS, HISTORICAS, makeChain } = vi.hoisted(() => {
  const CLIENTS = [{ id: 'c1', name: 'CLIENTE REAL LDA' }];

  const FATURADAS = [
    {
      id: 'e1', mes: '2026-07', client_id: 'c1', fatura_id: 'FT 2026/50',
      valor_fatura: 2800, valor_final: 1200.5, percentagem_historica_id: 'pct1',
      residuo_mes_anterior_aplicado: 30, criado_em: '2026-08-10T10:00:00Z', status: 'faturado',
    },
  ];
  const SIMULADAS = [
    {
      id: 's1', mes: '2026-06', client_id: 'c1', fatura_id: 'FT 2026/60',
      valor_fatura: 3000, valor_final: 1500, percentagem_historica_id: 'pct1',
      residuo_mes_anterior_aplicado: 0, criado_em: '2026-08-19T10:00:00Z', status: 'calculado',
    },
    {
      id: 's2', mes: '2026-06', client_id: 'c1', fatura_id: 'FT 2026/61',
      valor_fatura: 500, valor_final: 0, percentagem_historica_id: null,
      residuo_mes_anterior_aplicado: 0, criado_em: '2026-08-19T10:00:00Z', status: 'bloqueado',
    },
  ];
  const HISTORICAS = [
    {
      id: 'h1', mes: '2026-02', client_id: 'c1', fatura_id: 'FT 2026/10',
      valor_fatura: 1900, valor_final: 800, valor_observacao_manual: null, percentagem_historica_id: 'pct1',
      residuo_mes_anterior_aplicado: 0, criado_em: '2026-08-15T10:00:00Z',
    },
    {
      id: 'h2', mes: '2026-03', client_id: 'c1', fatura_id: 'FT 2026/11',
      valor_fatura: 2100, valor_final: 950, valor_observacao_manual: 950, percentagem_historica_id: 'pct1',
      residuo_mes_anterior_aplicado: 0, criado_em: '2026-08-15T10:00:00Z',
    },
  ];

  function makeChain(table) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      then: (resolve) => {
        if (table === 'ajudas_percentagem_historica') {
          return Promise.resolve({ data: [{ id: 'pct1', percentagem: 0.408826 }], error: null }).then(resolve);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    return chain;
  }

  return { CLIENTS, FATURADAS, SIMULADAS, HISTORICAS, makeChain };
});

vi.mock('../../src/context/AppContext.jsx', () => {
  const appState = {
    clients: CLIENTS,
    logs: [],
    supabase: {
      from: (table) => {
        if (table === 'ajudas_estimativas_fatura') {
          // Duas queries diferentes na mesma tabela (status='faturado' e
          // origem='historico') — o mock diferencia pelo `.eq()` chamado.
          const chain = {
            select: () => chain,
            order: () => chain,
            eq: (campo, valor) => {
              let dados = [];
              if (campo === 'status' && valor === 'faturado') dados = FATURADAS;
              else if (campo === 'origem' && valor === 'estimativa') dados = SIMULADAS;
              else if (campo === 'origem' && valor === 'historico') dados = HISTORICAS;
              const resultado = {
                order: () => resultado,
                then: (resolve) => Promise.resolve({ data: dados, error: null }).then(resolve),
              };
              return resultado;
            },
          };
          return chain;
        }
        return makeChain(table);
      },
    },
    currentUser: { name: 'Admin Teste' },
  };
  return { useApp: () => appState };
});

vi.mock('../../src/utils/authFetch.js', () => ({ authFetch: vi.fn() }));

import AjudasCustoAdmin from '../../src/features/admin/AjudasCustoAdmin.jsx';

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/admin/ajudas-custo?subtab=faturas']}>
      <AjudasCustoAdmin />
    </MemoryRouter>
  );
}

describe('FaturasComObservacoesTab', () => {
  it('mostra as faturas reais emitidas por omissão, com % histórica resolvida e o valor total da fatura', async () => {
    renderTab();
    await screen.findByText('FT 2026/50');
    expect(screen.getByText('CLIENTE REAL LDA')).toBeInTheDocument();
    expect(screen.getByText('40,9%')).toBeInTheDocument();
    // valor total da fatura (2800€) distinto do valor na observação (1200,50€).
    expect(screen.getByText('2800,00 €')).toBeInTheDocument();
    expect(screen.getByText('1200,50 €')).toBeInTheDocument();
  });

  it('alterna para a secção "Simuladas" e mostra as linhas de origem="estimativa" ainda não faturadas, com estado calculado/bloqueado', async () => {
    renderTab();
    await screen.findByText('FT 2026/50');

    fireEvent.click(screen.getByRole('button', { name: /Simuladas — Ainda Não Emitidas/i }));

    await screen.findByText('FT 2026/60');
    expect(screen.getByText('FT 2026/61')).toBeInTheDocument();
    // A fatura já emitida (FT 2026/50, status='faturado') não aparece aqui — já está na secção "Emitidas".
    expect(screen.queryByText('FT 2026/50')).not.toBeInTheDocument();

    const linhaCalculada = screen.getByText('FT 2026/60').closest('tr');
    const linhaBloqueada = screen.getByText('FT 2026/61').closest('tr');
    expect(linhaCalculada).toHaveTextContent('Calculado');
    expect(linhaBloqueada).toHaveTextContent('Bloqueado');
  });

  it('alterna para a secção retroativa (histórico) e mostra as linhas de origem="historico"', async () => {
    renderTab();
    await screen.findByText('FT 2026/50');

    fireEvent.click(screen.getByRole('button', { name: /Retroativo — Histórico/i }));

    await screen.findByText('FT 2026/10');
    expect(screen.queryByText('FT 2026/50')).not.toBeInTheDocument();
  });

  it('agrupa o retroativo por mês e sinaliza qual fatura tem valor explícito na observação vs calculado por rateio', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Retroativo — Histórico/i }));
    await screen.findByText('FT 2026/10');

    // Um cabeçalho de grupo por mês, cada um com as suas faturas.
    expect(screen.getByText('2026-02')).toBeInTheDocument();
    expect(screen.getByText('2026-03')).toBeInTheDocument();

    // FT 2026/10 (valor_observacao_manual=null) → rateio; FT 2026/11
    // (valor_observacao_manual=950) → declarado na fatura.
    const linhaRateio = screen.getByText('FT 2026/10').closest('tr');
    const linhaDeclarada = screen.getByText('FT 2026/11').closest('tr');
    expect(linhaRateio).toHaveTextContent('Rateio');
    expect(linhaDeclarada).toHaveTextContent('Declarado na fatura');
  });
});
