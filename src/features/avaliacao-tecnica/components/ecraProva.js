/**
 * Ecrã das fases: o plano e a pergunta ficam sempre à vista, sem rolar a página,
 * e o plano fica com o maior espaço possível. O layout está em avaliacao.css
 * (`.ecra-prova`): a grelha ocupa a altura que sobra por baixo do cabeçalho
 * (`--cab`, medido em AvaliacaoProva.jsx) e só a resposta e o plano têm
 * deslocamento interno.
 *
 * - Ecrã deitado (≥ 768 px de largura): plano à esquerda em toda a altura; a
 *   pergunta e a resposta ficam à direita, numa coluna só com a largura que o
 *   plano não precisa.
 * - Ecrã em pé (tablet): pergunta em cima, plano no meio, resposta em baixo.
 * - Celular (`.ecra-celular`): a pergunta recolhida e a resposta são barras finas,
 *   cada uma na sua faixa, e o plano fica no espaço livre entre elas. A pergunta
 *   abre por cima do plano só durante o tempo de leitura ou quando o candidato
 *   toca em "Ver" (components/PerguntaFlutuante.jsx).
 *
 * Em ecrãs baixos (`baixo:`, ver avaliacao.css) os cartões e textos compactam-se.
 */
export const GRELHA = 'ecra-prova';
/** No celular (useCelular): barras da pergunta e da resposta, e o plano entre elas */
export const ECRA_CELULAR = 'ecra-celular';
export const CELULA_PERGUNTA = 'celula-pergunta';
export const CELULA_PLANO = 'celula-plano';
export const CELULA_RESPOSTA = 'celula-resposta';

export const CARTAO = 'rounded-2xl bg-white p-3 shadow-sm ring-1 ring-mp-borda sm:p-4 baixo:p-2.5';
