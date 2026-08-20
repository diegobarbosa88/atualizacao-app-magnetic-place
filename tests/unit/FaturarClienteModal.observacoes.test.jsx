import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// Pedido explícito (2026-08-20): a caixa "Observações" deve pré-preencher
// automaticamente o texto de ajudas de custo, ANTES da confirmação —
// calculado sempre a partir do gate real (verificarEstimativaParaFatura),
// nunca de ajudasValorInicial (só informativo, pode divergir — foi
// exatamente esse bug que uma decisão anterior no código já tinha
// corrigido). Fica editável: só atualiza sozinho enquanto o admin não
// tocar; e nunca duplica o texto na emissão real.

const { CLIENTS, LOGS, makeChain } = vi.hoisted(() => {
  const CLIENTS = [
    { id: 'c1', name: 'CLIENTE REAL LDA', valorHora: 20, nif: '123456789', elegivel_ajudas_custo: true },
  ];
  const LOGS = [{ clientId: 'c1', workerId: 'w1', date: '2026-07-10', hours: 8 }];

  function makeChain(table) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      is: () => chain,
      lt: () => chain,
      gt: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => {
        if (table === 'ajudas_percentagem_historica') return { data: { id: 'pct1', percentagem: 0.5 }, error: null };
        return { data: null, error: null };
      },
      single: async () => ({ data: { id: 'estimativa-1' }, error: null }),
      then: (resolve) => {
        if (table === 'clients') return Promise.resolve({ data: CLIENTS, error: null }).then(resolve);
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
      upsert: () => Promise.resolve({ data: null, error: null }),
      update: () => chain,
      insert: () => chain,
    };
    return chain;
  }

  return { CLIENTS, LOGS, makeChain };
});

vi.mock('../../src/context/AppContext.jsx', () => {
  const appState = {
    clients: CLIENTS,
    logs: LOGS,
    supabase: { from: (table) => makeChain(table) },
    currentUser: { name: 'Admin Teste' },
  };
  return { useApp: () => appState };
});

vi.mock('../../src/utils/authFetch.js', () => ({ authFetch: vi.fn() }));

import FaturarClienteModal from '../../src/features/admin/toconline/FaturarClienteModal.jsx';
import { authFetch } from '../../src/utils/authFetch.js';

async function esperarDebounce() {
  await act(async () => {
    await new Promise(r => setTimeout(r, 500));
  });
}

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <FaturarClienteModal
        clienteIdInicial="c1"
        periodoInicial="2026-07"
        onClose={() => {}}
        onFaturado={() => {}}
        {...props}
      />
    </MemoryRouter>
  );
}

beforeEach(() => {
  authFetch.mockReset();
  authFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ doc_id: '1', documento: { attributes: { document_no: 'FT 2026/400' } } }),
  });
});

describe('FaturarClienteModal — pré-preenchimento automático de "Observações" com o texto de ajudas', () => {
  it('pré-preenche a caixa com o texto real (calculado pelo gate), não com um valor à parte', async () => {
    renderModal();
    await esperarDebounce();

    const textarea = screen.getByPlaceholderText('Observações que aparecerão na fatura...');
    expect(textarea.value).toMatch(/Estão incluídas nesta fatura €.+ referentes a ajudas de custo\./);
  });

  it('deixa de atualizar sozinho assim que o admin edita o campo manualmente', async () => {
    renderModal();
    await esperarDebounce();

    const textarea = screen.getByPlaceholderText('Observações que aparecerão na fatura...');
    fireEvent.change(textarea, { target: { value: 'Nota manual do admin' } });
    expect(textarea.value).toBe('Nota manual do admin');

    // Mesmo esperando outro ciclo de debounce, o texto editado não é substituído.
    await esperarDebounce();
    expect(textarea.value).toBe('Nota manual do admin');
  });

  it('não duplica o texto de ajudas na fatura real quando o campo já foi pré-preenchido e não foi tocado', async () => {
    renderModal();
    await esperarDebounce();

    fireEvent.click(screen.getByText('Ver Preview'));
    fireEvent.click(screen.getByText(/^Emitir /));
    await esperarDebounce();
    fireEvent.click(screen.getByText('Confirmar e Emitir'));
    await esperarDebounce();

    const chamadaCriarFatura = authFetch.mock.calls.find(c => c[0] === '/api/toconline/create-fatura');
    expect(chamadaCriarFatura).toBeTruthy();
    const payload = JSON.parse(chamadaCriarFatura[1].body);
    const ocorrencias = (payload.observacoes.match(/referentes a ajudas de custo/g) || []).length;
    expect(ocorrencias).toBe(1);
  });
});
