import { Calculator, ScanSearch, Shapes } from 'lucide-react';

import { LEVELS } from './levels.js';

/** Textos das fases para o nível escolhido (quantidades, tempos e ajudas mudam com o nível) */
export function getPhaseMeta(level) {
  const l = LEVELS[level];
  const n1 = l.phase1.items.length;
  const n2 = l.phase2.questions.length;
  const n3 = l.phase3.questions.length;
  return {
    1: {
      number: 1,
      title: 'Caçador de Cotas',
      subtitle: 'Localizar cotas no plano',
      objective: 'Encontrar no plano as cotas pedidas, em qualquer vista, corte, detalhe ou na lista de peças.',
      rules: [
        `${l.studySec} s para estudar o plano antes de começar.`,
        `${n1} cotas, ${l.phase1.itemSec} s cada.`,
        `Toque na cota pedida. Até ${l.phase1.maxAttempts} tentativas por cota.`,
        ...(l.phase1.hintAfterMiss ? ['Depois de um toque errado, aparece uma dica com a vista onde procurar.'] : []),
      ],
      durationLabel: `${n1} × ${l.phase1.itemSec} s`,
      icon: ScanSearch,
    },
    2: {
      number: 2,
      title: 'Cotas Não Indicadas',
      subtitle: 'Calcular a partir do plano',
      objective: 'Calcular medidas que não estão cotadas, usando apenas as cotas e a tabela do plano.',
      rules: [
        `${n2} perguntas, ${l.phase2.itemSec} s cada.`,
        'A medida pedida aparece marcada em laranja no plano.',
        'Calculadora disponível na tela. Responda em milímetros.',
      ],
      durationLabel: `${n2} × ${l.phase2.itemSec} s`,
      icon: Calculator,
    },
    3: {
      number: 3,
      title: 'Simbologia EN ISO',
      subtitle: 'Normas europeias no plano',
      objective: 'Interpretar símbolos de solda, projeção, cortes, materiais e notas segundo as normas EN ISO.',
      rules: [
        `${n3} perguntas, ${l.phase3.itemSec} s cada.`,
        'O elemento de cada pergunta fica destacado no plano.',
        'O primeiro toque é a resposta definitiva.',
      ],
      durationLabel: `${n3} × ${l.phase3.itemSec} s`,
      icon: Shapes,
    },
  };
}
