import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Smoke test do fluxo de assinatura movido para o dashboard do worker —
// confirma que o modal monta e lista as participações sem exceções.

vi.mock('../../src/utils/authFetch.js', () => ({
  authFetch: vi.fn((url) => {
    if (url.startsWith('/api/formacao/minhas')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          participacoes: [{
            participante_id: 'p1',
            formacao_id: 'f1',
            categoria: 'soldadura',
            tipo_formacao: 'TIG (141)',
            data_inicio: '2026-01-10',
            data_fim: '2026-01-10',
            duracao_horas: 8,
            local: 'Sede',
            formato: 'presencial',
            data_validade: null,
            assinado_em: null,
          }],
        }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }),
}));

import FormacaoModal from '../../src/features/worker/worker-dashboard/FormacaoModal.jsx';

describe('FormacaoModal (worker) — smoke', () => {
  it('monta e mostra o cartão da formação pendente com o estado correto', async () => {
    // Não clica no cartão: abriria o SignDrawModal, cujo canvas.getContext('2d')
    // não é suportado em jsdom sem o pacote `canvas` — fora do âmbito deste teste.
    render(
      <FormacaoModal
        isOpen={true}
        onClose={() => {}}
        currentUser={{ id: 'w1', name: 'Trabalhador Teste' }}
        onChanged={() => {}}
      />
    );

    expect(await screen.findByText('TIG (141)')).toBeInTheDocument();
    expect(screen.getByText('Por assinar')).toBeInTheDocument();
  });
});
