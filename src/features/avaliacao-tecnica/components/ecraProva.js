/**
 * Ecrã das fases: o plano e a pergunta ficam sempre à vista, sem rolar a página.
 *
 * A grelha ocupa exatamente a altura que sobra por baixo do cabeçalho
 * (`--cab`, medido em AvaliacaoProva.jsx). Só a caixa da resposta e o próprio
 * plano têm deslocamento interno.
 *
 * - Ecrã deitado (≥ 768 px de largura): plano à esquerda em toda a altura;
 *   pergunta e resposta empilhadas à direita.
 * - Ecrã em pé: pergunta em cima, plano no meio, resposta em baixo.
 *
 * Em ecrãs baixos (`baixo:`, ver avaliacao.css) os cartões e textos compactam-se.
 * As classes ficam escritas por extenso para o Tailwind as gerar.
 */
export const GRELHA =
  'grid h-[calc(100dvh_-_var(--cab,7.5rem)_-_1rem)] min-h-[15rem] grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 sm:gap-3 md:landscape:grid-cols-[minmax(0,1fr)_minmax(16rem,23rem)] md:landscape:grid-rows-[auto_minmax(0,1fr)]';

export const CELULA_PERGUNTA = 'row-start-1 min-w-0 md:landscape:col-start-2';

export const CELULA_PLANO = 'row-start-2 min-h-0 min-w-0 md:landscape:col-start-1 md:landscape:row-span-2 md:landscape:row-start-1';

export const CELULA_RESPOSTA =
  'row-start-3 min-h-0 min-w-0 max-h-[38dvh] overflow-y-auto overscroll-contain rounded-2xl md:landscape:col-start-2 md:landscape:row-start-2 md:landscape:max-h-none';

export const CARTAO = 'rounded-2xl bg-white p-3 shadow-sm ring-1 ring-mp-borda sm:p-4 baixo:p-2.5';
