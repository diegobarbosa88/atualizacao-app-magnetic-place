import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// Auditoria 2026-08-20: a query de `logs` usada para a lista "Sem
// evidência" (clientes com horas mas sem trabalhador com ajuda de custo
// ligado) não paginava — truncava silenciosamente no limite de 1000 linhas
// do PostgREST (bug real confirmado em produção, ver paginacao.js). Este
// teste simula uma resposta paginada (2 páginas) e confirma que a linha do
// segundo lote (que só existe na 2ª página) é mesmo lida.

const { CLIENTS, makeLogsChain } = vi.hoisted(() => {
  const CLIENTS = [
    { id: 'c1', name: 'CLIENTE COM EVIDENCIA', elegivel_ajudas_custo: null },
    { id: 'c2', name: 'CLIENTE SO NA 2A PAGINA', elegivel_ajudas_custo: null },
  ];

  // 1ª página: 1000 linhas do cliente c1 (irrelevantes, só para encher).
  // 2ª página: 1 linha do cliente c2 — só aparece se a paginação funcionar.
  const pagina1 = Array.from({ length: 1000 }, (_, i) => ({ clientId: 'c1', hours: 1, date: `2026-05-${(i % 28 + 1).toString().padStart(2, '0')}` }));
  const pagina2 = [{ clientId: 'c2', hours: 8, date: '2026-05-10' }];

  function makeLogsChain() {
    const chain = {
      select: () => chain,
      gte: () => chain,
      lte: () => chain,
      range: (from) => Promise.resolve({ data: from === 0 ? pagina1 : pagina2, error: null }),
    };
    return chain;
  }

  return { CLIENTS, makeLogsChain };
});

vi.mock('../../src/context/AppContext.jsx', () => {
  const chainClients = {
    select: () => Promise.resolve({ data: CLIENTS, error: null }),
  };
  const appState = {
    clients: CLIENTS,
    logs: [],
    supabase: {
      from: (table) => {
        if (table === 'logs') return makeLogsChain();
        if (table === 'receipt_validations') {
          return { select: () => ({ gte: () => ({ lte: () => ({ gt: () => Promise.resolve({ data: [], error: null }) }) }) }) };
        }
        if (table === 'clients') return chainClients;
        throw new Error(`tabela inesperada no mock: ${table}`);
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
    <MemoryRouter initialEntries={['/admin/ajudas-custo?subtab=elegibilidade']}>
      <AjudasCustoAdmin />
    </MemoryRouter>
  );
}

describe('ElegibilidadeClientesTab — correção de paginação', () => {
  it('lê a segunda página de logs (>1000 linhas) — o cliente que só aparece nela entra em "Sem evidência"', async () => {
    renderTab();
    await screen.findByText('CLIENTE SO NA 2A PAGINA');
  });
});
