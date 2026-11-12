import { TEST_VERSION } from '../config.js';
import { DRAWING } from '../data/plan.js';

import { computeSummary } from './scoring.js';

export function buildReport(input) {
  const now = new Date().toISOString();
  const snapshot = {
    sessionId: input.sessionId,
    candidate: input.candidate ?? { fullName: '—', internalId: '—', level: 'pleno' },
    plan: input.plan,
    startedAt: input.startedAt ?? now,
    finishedAt: input.finishedAt ?? now,
    phase1: input.phase1,
    phase2: input.phase2,
    phase3: input.phase3,
    integrity: input.integrity,
  };
  const summary = computeSummary(snapshot);

  const record = {
    id: snapshot.sessionId,
    test_version: TEST_VERSION,
    drawing_number: `${DRAWING.number} rev. ${DRAWING.rev}`,
    plan_variant: snapshot.plan.code,
    plan: snapshot.plan,
    candidate_name: snapshot.candidate.fullName,
    candidate_internal_id: snapshot.candidate.internalId,
    candidate_level: snapshot.candidate.level,
    started_at: snapshot.startedAt,
    finished_at: snapshot.finishedAt,
    active_time_ms: summary.activeTimeMs,
    wall_time_ms: summary.wallTimeMs,
    overall_score: summary.overall,
    score_localizacao: summary.pillars.localizacao,
    score_calculo: summary.pillars.calculo,
    score_simbologia: summary.pillars.simbologia,
    score_agilidade: summary.pillars.agilidade,
    classification: summary.classification,
    phase1: snapshot.phase1,
    phase2: snapshot.phase2,
    phase3: snapshot.phase3,
    integrity: snapshot.integrity,
  };

  return { snapshot, summary, record };
}
