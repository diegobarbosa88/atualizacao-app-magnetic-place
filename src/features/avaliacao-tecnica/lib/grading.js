/**
 * Correção da prova a partir das respostas em bruto do candidato.
 *
 * Corre no servidor (api/_avaliacoes.js) quando o candidato envia a prova, e é o
 * resultado daqui que fica gravado. A variante do plano (seed) e o nível vêm do
 * convite gravado na base de dados, nunca do navegador do candidato. As fases 2 e 3
 * são recorrigidas aqui contra o gabarito da variante, por isso uma nota alterada no
 * navegador não chega ao relatório. A fase 1 aceita o "encontrou / tentativas"
 * enviado (o toque certo não é reenviado), só limitado aos valores possíveis.
 *
 * Só importa data/ e lib/ sem React — o Node da Vercel carrega estes ficheiros
 * diretamente, por isso os imports relativos levam sempre a extensão .js.
 */
import { LEVELS } from '../data/levels.js';
import { DIM_IDS, generatePlan } from '../data/plan.js';
import { getPhase1Items } from '../data/phase1.js';
import { buildPhase2 } from '../data/phase2.js';
import { buildPhase3 } from '../data/phase3.js';
import { evaluateDerive } from './evaluators.js';
import { buildReport } from './report.js';

export const LEVEL_IDS = Object.keys(LEVELS);

const bool = (v) => v === true;
const int = (v, min, max) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const byKey = (list, key) => new Map((Array.isArray(list) ? list : []).filter((x) => x && typeof x === 'object').map((x) => [x[key], x]));

/**
 * @param {object} p
 * @param {number} p.seed       variante gravada no convite
 * @param {string} p.level      'meio-oficial' | 'pleno' | 'especialista'
 * @param {{fullName: string, internalId: string}} p.candidate
 * @param {string} p.sessionId
 * @param {string} p.startedAt  ISO — hora do servidor no início
 * @param {string} p.finishedAt ISO — hora do servidor na entrega
 * @param {{phase1?: object[], phase2?: object[], phase3?: object[], integrity?: object}} p.respostas
 */
export function gradeSubmission({ seed, level, candidate, sessionId, startedAt, finishedAt, respostas }) {
  if (!LEVEL_IDS.includes(level)) throw new Error(`Nível desconhecido: ${level}`);
  const spec = LEVELS[level];
  const plan = generatePlan(seed);
  const r = respostas && typeof respostas === 'object' ? respostas : {};

  const p1 = byKey(r.phase1, 'itemId');
  const phase1 = getPhase1Items(level)
    .filter((item) => p1.has(item.id))
    .map((item) => {
      const a = p1.get(item.id);
      const found = bool(a.found);
      return {
        itemId: item.id,
        found,
        attemptsUsed: int(a.attemptsUsed, found ? 1 : 0, spec.phase1.maxAttempts),
        wrongTaps: (Array.isArray(a.wrongTaps) ? a.wrongTaps : []).filter((d) => DIM_IDS.includes(d)).slice(0, spec.phase1.maxAttempts),
        hintShown: bool(a.hintShown),
        timeMs: int(a.timeMs, 0, spec.phase1.itemSec * 1000),
        timedOut: bool(a.timedOut),
      };
    });

  const p2 = byKey(r.phase2, 'questionId');
  const phase2 = buildPhase2(plan, level)
    .filter((q) => p2.has(q.id))
    .map((q) => {
      const a = p2.get(q.id);
      return evaluateDerive(q, {
        rawInput: String(a.rawInput ?? '').slice(0, 40),
        timeMs: int(a.timeMs, 0, spec.phase2.itemSec * 1000),
        timedOut: bool(a.timedOut),
        skipped: bool(a.skipped),
      });
    });

  const p3 = byKey(r.phase3, 'questionId');
  const phase3 = buildPhase3(plan, level)
    .filter((q) => p3.has(q.id))
    .map((q) => {
      const a = p3.get(q.id);
      const selected = q.options.some((o) => o.id === a.selectedOptionId) ? a.selectedOptionId : null;
      return {
        questionId: q.id,
        selectedOptionId: selected,
        correct: selected !== null && selected === q.correctOptionId,
        timeMs: int(a.timeMs, 0, spec.phase3.itemSec * 1000),
        timedOut: bool(a.timedOut),
      };
    });

  const integ = r.integrity && typeof r.integrity === 'object' ? r.integrity : {};
  const integrity = {
    focusLosses: int(integ.focusLosses, 0, 9999),
    exitAttempts: int(integ.exitAttempts, 0, 9999),
    abandoned: phase3.length < spec.phase3.questions.length,
  };

  return buildReport({
    sessionId,
    candidate: { fullName: candidate.fullName, internalId: candidate.internalId, level },
    plan,
    startedAt,
    finishedAt,
    phase1,
    phase2,
    phase3,
    integrity,
  });
}

/** Relatório a partir do registo gravado (coluna `resultado`), para o ecrã do admin */
export function reportFromRecord(record) {
  return buildReport({
    sessionId: record.id,
    candidate: { fullName: record.candidate_name, internalId: record.candidate_internal_id, level: record.candidate_level },
    plan: record.plan,
    startedAt: record.started_at,
    finishedAt: record.finished_at,
    phase1: record.phase1,
    phase2: record.phase2,
    phase3: record.phase3,
    integrity: record.integrity,
  });
}
