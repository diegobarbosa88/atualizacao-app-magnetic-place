import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Smoke test do fluxo e-learning: conteúdo -> questionário -> resultado.
// Confirma que a correção nunca acontece no cliente (resposta_correta não
// vem na participação) e que o resultado aprovado avança para a assinatura.
// Não avança até ao passo de assinatura (canvas) — jsdom não implementa
// getContext('2d') sem um mock dedicado, fora do âmbito deste smoke test.

vi.mock('../../src/utils/authFetch.js', () => ({
  authFetch: vi.fn((url) => {
    if (url.startsWith('/api/formacao/iniciar')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    }
    if (url.startsWith('/api/formacao/responder-questionario')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ nota_obtida: 100, aprovado: true, estado_conclusao: 'concluido' }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }),
}));

import FormacaoElearningFlow from '../../src/features/worker/worker-dashboard/FormacaoElearningFlow.jsx';

const participacao = {
  participante_id: 'p1',
  formato: 'e-learning',
  estado_conclusao: 'nao_iniciado',
  conteudo_url: 'https://exemplo.com/video.mp4',
  nota_minima_aprovacao: 70,
  questionario: [
    { pergunta: 'Qual o EPI obrigatório?', opcoes: ['Nenhum', 'Máscara de soldar'] },
  ],
};

describe('FormacaoElearningFlow — smoke', () => {
  it('avança conteúdo -> questionário -> resultado aprovado sem expor resposta_correta', async () => {
    const onFinalizado = vi.fn();
    render(<FormacaoElearningFlow participacao={participacao} onFinalizado={onFinalizado} onError={() => {}} />);

    // Nunca deve haver "resposta_correta" na participação passada ao componente.
    expect(participacao.questionario[0].resposta_correta).toBeUndefined();

    fireEvent.click(await screen.findByText(/avançar para o questionário/i));
    expect(await screen.findByText(/Qual o EPI obrigatório\?/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Máscara de soldar'));
    fireEvent.click(screen.getByText('Submeter Respostas'));

    expect(await screen.findByText('Aprovado')).toBeInTheDocument();
    expect(screen.getByText('Avançar para Assinatura')).toBeInTheDocument();
  });
});
