/** Identificação exibida no cabeçalho e no relatório impresso */
export const ORG_NAME = 'Magnetic Place';
export const TEST_TITLE = 'Avaliação Técnica · Caldeireiro Industrial';
export const TEST_SUBTITLE = 'Interpretação de plano — normas EN ISO';
export const TEST_VERSION = 'CALD-PLANO-2.0';

/** Tempos comuns (os tempos de cada pergunta dependem do nível — ver data/levels.ts) */
export const TIMING = {
  prepCountdownSec: 3,
  /** Feedback visual antes de avançar */
  feedbackMs: 1300,
  /** Tempo que a cota certa fica destacada quando o candidato não a encontra */
  revealMs: 1900,
};

/** Fase 1: crédito por tentativa (1.ª, 2.ª, 3.ª). O nº de tentativas depende do nível. */
export const PHASE1_CREDIT = [1, 0.6, 0.3];

/** Pesos dos pilares na nota geral (somam 1) */
export const PILLAR_WEIGHTS = {
  localizacao: 0.3,
  calculo: 0.3,
  simbologia: 0.25,
  agilidade: 0.15,
};

export const PILLAR_LABELS = {
  localizacao: 'Localização de Cotas',
  calculo: 'Cotas Derivadas e Cálculo',
  simbologia: 'Simbologia e Normas EN ISO',
  agilidade: 'Agilidade / Tomada de Decisão',
};

export const PILLAR_SHORT_LABELS = {
  localizacao: 'Localizar',
  calculo: 'Calcular',
  simbologia: 'Simbologia',
  agilidade: 'Agilidade',
};

export const LEVEL_LABELS = {
  'meio-oficial': 'Meio-Oficial',
  pleno: 'Pleno',
  especialista: 'Especialista',
};

export const LEVEL_DESCRIPTIONS = {
  'meio-oficial': 'Auxilia na traçagem, montagem e ponteamento.',
  pleno: 'Lê o plano, traça e monta com autonomia.',
  especialista: 'Interpreta conjuntos complexos e orienta a equipe.',
};

/**
 * Nota mínima por nível pretendido. A prova do Especialista já é mais difícil,
 * por isso o limite sobe menos do que a dificuldade.
 */
export const LEVEL_THRESHOLDS = {
  'meio-oficial': { apto: 60, avaliacao: 40 },
  pleno: { apto: 70, avaliacao: 50 },
  especialista: { apto: 75, avaliacao: 55 },
};

/** "Apto" exige que nenhum pilar técnico (localizar, calcular, simbologia) fique abaixo deste valor */
export const MIN_CORE_PILLAR_FOR_APTO = 40;

export const CLASSIFICATION_LABELS = {
  apto: 'Apto para Teste Prático de Chão',
  'em-avaliacao': 'Em Avaliação',
  'nao-recomendado': 'Não Recomendado',
};

/** Tempo de experiência que o candidato declara ao abrir o link (validado também no servidor) */
export const EXPERIENCIA_OPCOES = ['Menos de 1 ano', '1 a 3 anos', '3 a 5 anos', '5 a 10 anos', 'Mais de 10 anos'];
