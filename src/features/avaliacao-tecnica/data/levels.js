/**
 * Composição da prova por nível pretendido.
 * O nível muda as perguntas (mais difíceis no topo), a quantidade, o tempo,
 * as tentativas na Fase 1 e a ajuda dada ao candidato.
 */

export const LEVELS = {
  'meio-oficial': {
    difficulty: 'Básica',
    summary: 'Cotas diretas nas vistas principais, contas de somar e subtrair, símbolos essenciais. Com dicas.',
    studySec: 90,
    phase1: {
      items: ['p1-comprimento', 'p1-altura-total', 'p1-furos', 'p1-esp-olhal', 'p1-anel', 'p1-furo-olhal'],
      itemSec: 40,
      maxAttempts: 3,
      hintAfterMiss: true,
    },
    phase2: {
      questions: ['p2-altura-olhal', 'p2-topo-furo', 'p2-bordo-furo', 'p2-face-bordo'],
      itemSec: 120,
    },
    phase3: {
      questions: ['p3-projecao', 'p3-corte', 'p3-w1', 'p3-w3', 'p3-nao-medir', 'p3-material'],
      itemSec: 45,
    },
  },
  pleno: {
    difficulty: 'Intermediária',
    summary: 'Cortes e planta, cotas derivadas, Pitágoras e tolerâncias gerais, simbologia de solda.',
    studySec: 60,
    phase1: {
      items: ['p1-comprimento', 'p1-furos', 'p1-entre-eixos', 'p1-esp-olhal', 'p1-eixo-furo', 'p1-nervura', 'p1-anel', 'p1-escotadura'],
      itemSec: 30,
      maxAttempts: 3,
      hintAfterMiss: false,
    },
    phase2: {
      questions: ['p2-bordo-furo', 'p2-altura-olhal', 'p2-recuo-nervura', 'p2-face-bordo', 'p2-hipotenusa', 'p2-tolerancia'],
      itemSec: 90,
    },
    phase3: {
      questions: ['p3-projecao', 'p3-w1', 'p3-a-z', 'p3-w3', 'p3-tracejada', 'p3-corte', 'p3-material', 'p3-nao-medir'],
      itemSec: 40,
    },
  },
  especialista: {
    difficulty: 'Avançada',
    summary:
      'Detalhes e lista de peças, diagonais de esquadro, metros de solda, normas EN de qualidade e execução. Menos tempo e 2 tentativas.',
    studySec: 45,
    phase1: {
      items: [
        'p1-entre-eixos',
        'p1-largura-placa',
        'p1-eixo-furo',
        'p1-chanfro',
        'p1-escotadura',
        'p1-esp-nervura',
        'p1-comp-nervura',
        'p1-faces-nervuras',
        'p1-esp-anel',
        'p1-nervura',
      ],
      itemSec: 25,
      maxAttempts: 2,
      hintAfterMiss: false,
    },
    phase2: {
      questions: ['p2-face-bordo', 'p2-recuo-nervura', 'p2-hipotenusa', 'p2-diagonal-furos', 'p2-solda-nervuras', 'p2-tolerancia'],
      itemSec: 75,
    },
    phase3: {
      questions: [
        'p3-projecao',
        'p3-a-z',
        'p3-w3',
        'p3-tracejada',
        'p3-corte',
        'p3-material',
        'p3-processo',
        'p3-qualidade',
        'p3-tolerancias',
        'p3-execucao',
      ],
      itemSec: 35,
    },
  },
};

/** Duração máxima da prova (s), sem contar instruções e contagens */
export function maxDurationSec(level) {
  const l = LEVELS[level];
  return (
    l.studySec +
    l.phase1.items.length * l.phase1.itemSec +
    l.phase2.questions.length * l.phase2.itemSec +
    l.phase3.questions.length * l.phase3.itemSec
  );
}
