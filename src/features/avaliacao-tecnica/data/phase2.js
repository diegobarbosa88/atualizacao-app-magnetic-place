/**
 * Fase 2 — Cotas não indicadas: medidas que o candidato calcula a partir do plano.
 * As perguntas são geradas da variante, por isso os valores mudam de prova para prova.
 */

import { LEVELS } from './levels.js';
import { toleranceRowB } from './plan.js';

const fmt = (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const TOL_TARGETS = {
  L: { name: 'o comprimento da placa base (Pos. 1)', nominal: (p) => p.L },
  H: { name: 'a altura total do conjunto', nominal: (p) => p.H },
  holeW: { name: 'o entre-eixos dos furos de fixação, no sentido da largura', nominal: (p) => p.W - 2 * p.holeEdge },
  gH: { name: 'a altura das nervuras (Pos. 3)', nominal: (p) => p.gH },
};

export function tolNominal(p) {
  return TOL_TARGETS[p.tolTarget].nominal(p);
}

/** Todas as perguntas possíveis para esta variante */
export function buildPhase2Pool(p) {
  const holeSpacingL = p.L - 2 * p.holeEdge;
  const nominal = tolNominal(p);
  const row = toleranceRowB(nominal);
  const tol = row?.tol ?? 0;
  const bound = p.tolBound === 'min' ? 'mínima' : 'máxima';
  const tolExpected = p.tolBound === 'min' ? nominal - tol : nominal + tol;

  return [
    {
      id: 'p2-bordo-furo',
      query: 'edge-hole',
      topic: 'Bordo ao furo',
      prompt: 'Distância do bordo da placa base ao eixo dos furos de fixação, no sentido do comprimento.',
      expected: (p.L - holeSpacingL) / 2,
      tolerance: 0.5,
      how: `(${p.L} − ${holeSpacingL}) ÷ 2 — vista frontal + planta`,
    },
    {
      id: 'p2-altura-olhal',
      query: 'lug-height',
      topic: 'Altura da Pos. 2',
      prompt: 'Altura da chapa do olhal (Pos. 2).',
      expected: p.H - p.T,
      tolerance: 0.5,
      how: `${p.H} − ${p.T} — altura total menos a placa base`,
    },
    {
      id: 'p2-recuo-nervura',
      query: 'gusset-inset',
      topic: 'Posição das nervuras',
      prompt: 'Distância da face exterior de cada nervura ao bordo lateral da chapa do olhal.',
      expected: (p.lugW - p.gOuter) / 2,
      tolerance: 0.5,
      how: `(${p.lugW} − ${p.gOuter}) ÷ 2 — vista frontal + planta`,
    },
    {
      id: 'p2-face-bordo',
      query: 'face-edge',
      topic: 'Implantação da Pos. 2',
      prompt: 'Distância da face da chapa do olhal ao bordo da placa base, no sentido da largura.',
      expected: (p.W - p.lugT) / 2,
      tolerance: 0.5,
      how: `(${p.W} − ${p.lugT}) ÷ 2 — corte A–A`,
    },
    {
      id: 'p2-hipotenusa',
      query: 'gusset-hyp',
      topic: 'Traçagem da nervura',
      prompt: 'Comprimento da aresta inclinada da nervura (Pos. 3).',
      expected: Math.hypot(p.gL, p.gH),
      tolerance: 0.5,
      how: `√(${p.gL}² + ${p.gH}²) ≈ ${fmt(Math.hypot(p.gL, p.gH))} — corte A–A`,
    },
    {
      id: 'p2-tolerancia',
      query: 'tolerance',
      topic: 'Tolerância geral',
      prompt: `Medida ${bound} aceitável para ${TOL_TARGETS[p.tolTarget].name}, segundo as tolerâncias gerais do plano.`,
      expected: tolExpected,
      tolerance: 0.05,
      how: `${nominal} está na faixa "${row?.label ?? '—'}" → ±${tol} → ${tolExpected}`,
    },
    {
      id: 'p2-topo-furo',
      query: 'pin-top',
      topic: 'Eixo do furo ao topo',
      prompt: 'Distância do eixo do furo do olhal ao topo da chapa do olhal.',
      expected: p.H - p.pinZ,
      tolerance: 0.5,
      how: `${p.H} − ${p.pinZ} — vista frontal`,
    },
    {
      id: 'p2-diagonal-furos',
      query: 'hole-diagonal',
      topic: 'Diagonal de esquadro',
      prompt: 'Diagonal entre os eixos de dois furos opostos da placa base (para conferir o esquadro).',
      expected: Math.hypot(holeSpacingL, p.W - 2 * p.holeEdge),
      tolerance: 0.5,
      how: `√(${holeSpacingL}² + ${p.W - 2 * p.holeEdge}²) ≈ ${fmt(Math.hypot(holeSpacingL, p.W - 2 * p.holeEdge))} — planta`,
    },
    {
      id: 'p2-solda-nervuras',
      query: 'gusset-welds',
      topic: 'Metros de solda',
      prompt:
        'Comprimento total de cordão de solda nas 4 nervuras: filete dos dois lados, nas uniões com a placa base e com a chapa do olhal (as escotaduras não levam solda).',
      expected: 8 * (p.gL + p.gH - 2 * p.snipe),
      tolerance: 0.5,
      how: `4 nervuras × 2 lados × (${p.gL} + ${p.gH} − 2 × ${p.snipe}) = ${8 * (p.gL + p.gH - 2 * p.snipe)}`,
    },
  ];
}

/** Perguntas do nível, pela ordem definida em levels.ts */
export function buildPhase2(p, level) {
  const pool = new Map(buildPhase2Pool(p).map((q) => [q.id, q]));
  return LEVELS[level].phase2.questions.map((id) => {
    const q = pool.get(id);
    if (!q) throw new Error(`Pergunta da Fase 2 desconhecida: ${id}`);
    return q;
  });
}
