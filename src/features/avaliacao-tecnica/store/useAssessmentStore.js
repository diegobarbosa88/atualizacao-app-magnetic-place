import { create } from 'zustand';
import { LEVELS } from '../data/levels.js';
import { DEFAULT_PLAN, generatePlan, randomSeed } from '../data/plan.js';
import { createId } from '../lib/id.js';
import { setSoundEnabled } from '../lib/sound.js';

/** Estado da partida — serializável, pronto para virar um registro no banco */

const initialData = () => ({
  sessionId: createId(),
  stage: 'start',
  candidate: null,
  plan: DEFAULT_PLAN,
  startedAt: null,
  finishedAt: null,
  phase1: [],
  phase2: [],
  phase3: [],
  integrity: { focusLosses: 0, exitAttempts: 0, abandoned: false },
});

const upsert = (list, item, key) => [...list.filter((x) => x[key] !== item[key]), item];

export const useAssessmentStore = create()((set, get) => ({
  ...initialData(),
  soundEnabled: true,

  // A variante (seed) vem do convite gravado no servidor — o candidato não a escolhe
  // nem a pode trocar recarregando a página.
  startAssessment: (candidate, seed) =>
    set({ ...initialData(), candidate, plan: generatePlan(seed ?? randomSeed()), stage: 'phase1', startedAt: new Date().toISOString() }),

  recordFind: (result) => set((s) => ({ phase1: upsert(s.phase1, result, 'itemId') })),
  completePhase1: () => set({ stage: 'phase2' }),

  recordDerive: (answer) => set((s) => ({ phase2: upsert(s.phase2, answer, 'questionId') })),
  completePhase2: () => set({ stage: 'phase3' }),

  recordSymbol: (answer) => set((s) => ({ phase3: upsert(s.phase3, answer, 'questionId') })),
  finishAssessment: () => set({ stage: 'results', finishedAt: new Date().toISOString() }),

  registerFocusLoss: () => set((s) => ({ integrity: { ...s.integrity, focusLosses: s.integrity.focusLosses + 1 } })),
  registerExitAttempt: () => set((s) => ({ integrity: { ...s.integrity, exitAttempts: s.integrity.exitAttempts + 1 } })),

  abandonAssessment: () =>
    set((s) => ({
      stage: 'results',
      finishedAt: new Date().toISOString(),
      integrity: { ...s.integrity, abandoned: s.phase3.length < LEVELS[s.candidate?.level ?? 'pleno'].phase3.questions.length },
    })),

  toggleSound: () => {
    const next = !get().soundEnabled;
    setSoundEnabled(next);
    set({ soundEnabled: next });
  },

  reset: () => set(initialData()),
}));

export const isInProgress = (stage) => stage === 'phase1' || stage === 'phase2' || stage === 'phase3';
