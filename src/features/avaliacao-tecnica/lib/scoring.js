/**
 * Regras de pontuação (0–100 por pilar) e classificação final.
 * Pesos e limites ficam em src/config.ts.
 */
import { LEVEL_THRESHOLDS, MIN_CORE_PILLAR_FOR_APTO, PHASE1_CREDIT, PILLAR_WEIGHTS } from '../config.js';
import { LEVELS } from '../data/levels.js';

const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** Crédito de uma cota encontrada: 1.ª tentativa 100 %, 2.ª 60 %, 3.ª 30 % */
export function findCredit(result) {
  if (!result || !result.found) return 0;
  return PHASE1_CREDIT[result.attemptsUsed - 1] ?? 0;
}

/** Pilar 1 — localização de cotas (cota não respondida = 0) */
export function scoreLocalizacao(level, results) {
  return Math.round(100 * mean(LEVELS[level].phase1.items.map((id) => findCredit(results.find((r) => r.itemId === id)))));
}

/** Pilar 2 — % de cotas derivadas dentro da tolerância */
export function scoreCalculo(level, answers) {
  const ids = LEVELS[level].phase2.questions;
  const correct = ids.filter((id) => answers.find((a) => a.questionId === id)?.correct).length;
  return Math.round((correct / ids.length) * 100);
}

/** Pilar 3 — % de acertos em simbologia e normas */
export function scoreSimbologia(level, answers) {
  const ids = LEVELS[level].phase3.questions;
  const correct = ids.filter((id) => answers.find((a) => a.questionId === id)?.correct).length;
  return Math.round((correct / ids.length) * 100);
}

/**
 * Velocidade relativa ao limite: até 25 % do tempo = 1,0; cai linearmente até 0,2 no limite.
 * Tempo esgotado ou pergunta pulada = 0.
 */
export function speedFactor(timeMs, limitMs, timedOut) {
  if (timedOut || limitMs <= 0) return 0;
  const ratio = timeMs / limitMs;
  if (ratio <= 0.25) return 1;
  return clamp(1 - ((ratio - 0.25) / 0.75) * 0.8, 0.2, 1);
}

/** Pilar 4 — agilidade ponderada pela precisão: rápido e errado não pontua bem */
export function scoreAgilidade(s, technicalAccuracy) {
  const l = LEVELS[s.candidate.level];
  const p1 = mean(
    l.phase1.items.map((id) => {
      const r = s.phase1.find((x) => x.itemId === id);
      return r && r.found ? speedFactor(r.timeMs, l.phase1.itemSec * 1000, r.timedOut) : 0;
    }),
  );
  const p2 = mean(
    l.phase2.questions.map((id) => {
      const a = s.phase2.find((x) => x.questionId === id);
      return a && !a.skipped ? speedFactor(a.timeMs, l.phase2.itemSec * 1000, a.timedOut) : 0;
    }),
  );
  const p3 = mean(
    l.phase3.questions.map((id) => {
      const a = s.phase3.find((x) => x.questionId === id);
      return a ? speedFactor(a.timeMs, l.phase3.itemSec * 1000, a.timedOut) : 0;
    }),
  );
  return Math.round(100 * mean([p1, p2, p3]) * (0.4 + 0.6 * clamp(technicalAccuracy)));
}

export function classify(level, overall, pillars) {
  const t = LEVEL_THRESHOLDS[level];
  const coreBelowMin = [pillars.localizacao, pillars.calculo, pillars.simbologia].some((v) => v < MIN_CORE_PILLAR_FOR_APTO);
  if (overall >= t.apto && !coreBelowMin) return { classification: 'apto', gateFailed: false };
  const gateFailed = overall >= t.apto && coreBelowMin;
  if (overall >= t.avaliacao) return { classification: 'em-avaliacao', gateFailed };
  return { classification: 'nao-recomendado', gateFailed };
}

export function computeSummary(s) {
  const level = s.candidate.level;
  const localizacao = scoreLocalizacao(level, s.phase1);
  const calculo = scoreCalculo(level, s.phase2);
  const simbologia = scoreSimbologia(level, s.phase3);
  const agilidade = scoreAgilidade(s, (localizacao + calculo + simbologia) / 300);
  const pillars = { localizacao, calculo, simbologia, agilidade };

  const overall = Math.round(Object.keys(PILLAR_WEIGHTS).reduce((acc, k) => acc + pillars[k] * PILLAR_WEIGHTS[k], 0));
  const { classification, gateFailed } = classify(s.candidate.level, overall, pillars);

  const activeTimeMs =
    s.phase1.reduce((acc, r) => acc + r.timeMs, 0) +
    s.phase2.reduce((acc, a) => acc + a.timeMs, 0) +
    s.phase3.reduce((acc, a) => acc + a.timeMs, 0);
  const wallTimeMs = Math.max(0, new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime());

  return {
    overall,
    pillars,
    classification,
    thresholds: LEVEL_THRESHOLDS[s.candidate.level],
    gateFailed,
    activeTimeMs,
    wallTimeMs,
    wrongTapsTotal: s.phase1.reduce((acc, r) => acc + r.wrongTaps.length, 0),
  };
}
