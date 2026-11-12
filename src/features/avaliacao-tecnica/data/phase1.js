/**
 * Fase 1 — Caçador de Cotas: o candidato toca na cota pedida, em qualquer vista do plano.
 * `targets` lista todas as respostas aceitas (ex.: a vista e a lista de peças).
 * O valor mostrado muda com a variante; a posição da cota no plano é a mesma.
 * Cada nível usa uma parte deste conjunto (ver levels.ts).
 */

import { LEVELS } from './levels.js';

export const PHASE1_POOL = [
  // básicas — cotas diretas nas vistas principais
  { id: 'p1-comprimento', prompt: 'Comprimento da placa base (Pos. 1)', targets: ['f-length'] },
  { id: 'p1-altura-total', prompt: 'Altura total do conjunto', targets: ['f-height'] },
  { id: 'p1-furos', prompt: 'Diâmetro dos furos de fixação da placa base', targets: ['t-holes'] },
  { id: 'p1-esp-olhal', prompt: 'Espessura da chapa do olhal (Pos. 2)', targets: ['s-lug-t', 'bom-e2'] },
  { id: 'p1-anel', prompt: 'Diâmetro exterior do anel de reforço (Pos. 4)', targets: ['f-ring-d'] },
  { id: 'p1-furo-olhal', prompt: 'Diâmetro do furo do olhal', targets: ['f-pin-d'] },
  // intermediárias — cortes, planta, eixos
  {
    id: 'p1-entre-eixos',
    prompt: 'Distância entre eixos dos furos de fixação, no sentido da largura da placa base',
    targets: ['t-holes-w'],
  },
  { id: 'p1-eixo-furo', prompt: 'Altura do eixo do furo do olhal, medida a partir da base', targets: ['f-pin-z'] },
  { id: 'p1-nervura', prompt: 'Altura das nervuras (Pos. 3)', targets: ['s-gusset-h'] },
  { id: 'p1-escotadura', prompt: 'Escotadura (recorte de passagem de solda) das nervuras', targets: ['d-snipe'] },
  // avançadas — corte, detalhe e lista de peças
  { id: 'p1-largura-placa', prompt: 'Largura da placa base (Pos. 1)', targets: ['s-width'] },
  { id: 'p1-chanfro', prompt: 'Chanfro dos cantos superiores da chapa do olhal', targets: ['f-chamfer'] },
  { id: 'p1-esp-nervura', prompt: 'Espessura da chapa das nervuras (Pos. 3)', targets: ['bom-e3'] },
  { id: 'p1-comp-nervura', prompt: 'Comprimento da nervura apoiado na placa base', targets: ['s-gusset-l'] },
  { id: 'p1-faces-nervuras', prompt: 'Distância entre as faces exteriores das nervuras', targets: ['t-gussets'] },
  { id: 'p1-esp-anel', prompt: 'Espessura do anel de reforço (Pos. 4)', targets: ['bom-e4'] },
];

const BY_ID = new Map(PHASE1_POOL.map((i) => [i.id, i]));

export function getPhase1Items(level) {
  return LEVELS[level].phase1.items.map((id) => {
    const item = BY_ID.get(id);
    if (!item) throw new Error(`Item da Fase 1 desconhecido: ${id}`);
    return item;
  });
}
