import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Smoke test pós-reescrita de NovaAcaoForm/ListaAcoesTab e criação de
// CertificacoesValidadeTab/ElearningAcoesTab — confirma que as 5 tabs
// montam sem exceções (imports partidos, componentes em falta), sem
// precisar de login real.

vi.mock('../../src/context/AppContext.jsx', () => {
  const workersChain = {
    select: () => ({
      order: () => Promise.resolve({ data: [{ id: 'w1', name: 'Trabalhador Teste' }], error: null }),
    }),
  };
  const appState = {
    supabase: {
      from: (table) => {
        if (table === 'workers') return workersChain;
        throw new Error(`tabela inesperada no mock: ${table}`);
      },
    },
    currentUser: { name: 'Admin Teste' },
  };
  return { useApp: () => appState };
});

vi.mock('../../src/utils/authFetch.js', () => ({
  authFetch: vi.fn((url) => {
    if (url.startsWith('/api/formacao/list')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ formacoes: [] }) });
    }
    if (url.startsWith('/api/formacao/horas-por-trabalhador')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ano: '2026', meta: 40, trabalhadores: [] }) });
    }
    if (url.startsWith('/api/formacao/certificacoes')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ certificacoes: [] }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }),
}));

import FormacaoInternaAdmin from '../../src/features/admin/formacao-interna/FormacaoInternaAdmin.jsx';

describe('FormacaoInternaAdmin — smoke', () => {
  it('monta as 5 tabs sem lançar exceções', async () => {
    render(<FormacaoInternaAdmin />);

    // Tab inicial: Ações Presenciais
    await screen.findByText('Nenhuma ação presencial registada.');

    fireEvent.click(screen.getByText('E-learning'));
    await screen.findByText('Nenhuma ação e-learning registada.');

    fireEvent.click(screen.getByText('Nova Ação'));
    expect(await screen.findByText('Tipo de Formação')).toBeInTheDocument();
    expect(screen.getByText('Categoria')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Certificações e Validades'));
    await screen.findByText('Sem certificações com validade registadas.');

    fireEvent.click(screen.getByText('Horas por Trabalhador'));
    await screen.findByText('Sem dados de formação para 2026.');
  });
});
