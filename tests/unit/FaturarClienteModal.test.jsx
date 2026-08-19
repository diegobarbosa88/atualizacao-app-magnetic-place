import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// Fase 2b, correção do Ponto 2 — um cliente "toc:${nome}" (fallback
// sem-horas de AjudasCalculadora.jsx, quando o nome da fatura TOConline não
// bate com nenhum `clients.name`) nunca deve avançar para emissão sem
// resolução humana explícita.
//
// NOTA sobre cobertura: confirmámos (com um componente de duas linhas,
// sem qualquer relação com este ficheiro) que `fireEvent.change` não
// desencadeia onChange em inputs controlados neste ambiente de testes
// (React 19.2 + jsdom 29 + @testing-library/dom desta versão, sem
// @testing-library/user-event instalado) — é uma limitação do ambiente,
// não deste código. Por isso este ficheiro testa apenas via cliques
// (fireEvent.click, que funciona correctamente neste ambiente): a
// presença/ausência do painel de resolução e do caminho de emissão. A
// lógica de cálculo em si (gate bloqueado/calculado, texto único,
// upsert com o valor novo) está coberta em emitirFaturaComAjudas.test.js.

vi.mock('../../src/context/AppContext.jsx', () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    is: () => chain,
    lt: () => chain,
    gt: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
    upsert: () => Promise.resolve({ data: null, error: null }),
    update: () => chain,
    insert: () => chain,
  };
  const appState = {
    clients: [
      { id: 'c1', name: 'CLIENTE REAL LDA', valorHora: 20, nif: '123456789', elegivel_ajudas_custo: true },
    ],
    logs: [],
    supabase: { from: () => chain },
    currentUser: { name: 'Admin Teste' },
  };
  return { useApp: () => appState };
});

vi.mock('../../src/utils/authFetch.js', () => ({
  authFetch: vi.fn(),
}));

import FaturarClienteModal from '../../src/features/admin/toconline/FaturarClienteModal.jsx';
import { authFetch } from '../../src/utils/authFetch.js';

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <FaturarClienteModal
        clienteIdInicial="toc:GRANDES MECANIZADOS DEL NORTE,S .A."
        nomeToConlineInicial="GRANDES MECANIZADOS DEL NORTE,S .A."
        ajudasValorInicial={0}
        periodoInicial="2026-07"
        onClose={() => {}}
        onFaturado={() => {}}
        {...props}
      />
    </MemoryRouter>
  );
}

describe('FaturarClienteModal — resolução manual de clientes "toc:" (Fase 2b, Ponto 2)', () => {
  beforeEach(() => {
    authFetch.mockReset();
    authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ doc_id: '1', documento: { attributes: { document_no: 'FT 2026/300' } } }),
    });
  });

  it('mostra o painel de resolução manual e esconde o formulário normal enquanto o cliente não é resolvido', () => {
    renderModal();

    expect(screen.getByText('Cliente não identificado automaticamente')).toBeInTheDocument();
    expect(screen.getByText(/GRANDES MECANIZADOS DEL NORTE/)).toBeInTheDocument();
    // O formulário normal do Passo 1 não é renderizado enquanto a resolução não acontece.
    expect(screen.queryByText('Ver Preview')).not.toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalled();
  });

  it('não existe nenhum caminho para emitir enquanto o cliente não é resolvido', () => {
    renderModal();
    expect(screen.queryByText(/^Emitir /)).not.toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalled();
  });

  it('escolher um cliente real no painel de resolução substitui o "toc:" pelo cliente real e liberta o formulário', () => {
    renderModal();

    fireEvent.change(screen.getByDisplayValue('Selecionar cliente...'), { target: { value: 'c1' } });
    fireEvent.click(screen.getByText('Confirmar correspondência'));

    expect(screen.queryByText('Cliente não identificado automaticamente')).not.toBeInTheDocument();
    expect(screen.getByText('Ver Preview')).toBeInTheDocument();
    // O select do Passo 1 já não está desativado num estado quebrado —
    // resolve para o cliente real escolhido.
    expect(screen.getByDisplayValue('CLIENTE REAL LDA')).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalled();
  });

  it('confirmar "não corresponde a nenhum cliente" liberta o formulário sem exigir associação a um cliente', () => {
    renderModal();

    fireEvent.click(screen.getByText('Não corresponde a nenhum cliente'));

    expect(screen.queryByText('Cliente não identificado automaticamente')).not.toBeInTheDocument();
    expect(screen.getByText('Ver Preview')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/sem cliente cadastrado associado/)).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalled();
  });
});
