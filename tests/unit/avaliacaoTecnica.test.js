import { describe, expect, it } from 'vitest';
import { makeGeometry } from '../../src/features/avaliacao-tecnica/components/plan/PlanSheet.jsx';
import { LEVELS, maxDurationSec } from '../../src/features/avaliacao-tecnica/data/levels.js';
import { PHASE1_POOL, getPhase1Items } from '../../src/features/avaliacao-tecnica/data/phase1.js';
import { buildPhase2, buildPhase2Pool } from '../../src/features/avaliacao-tecnica/data/phase2.js';
import { buildPhase3, buildPhase3Pool } from '../../src/features/avaliacao-tecnica/data/phase3.js';
import {
  DEFAULT_PLAN,
  DIM_IDS,
  FOCUS_IDS,
  QUERY_IDS,
  codeToSeed,
  dimText,
  generatePlan,
  generalToleranceB,
  planMasses,
  seedToCode,
} from '../../src/features/avaliacao-tecnica/data/plan.js';
import { parseMillimeters } from '../../src/features/avaliacao-tecnica/lib/calculations.js';
import { evaluateExpression } from '../../src/features/avaliacao-tecnica/lib/calculator.js';
import { evaluateDerive } from '../../src/features/avaliacao-tecnica/lib/evaluators.js';
import { computeSummary, speedFactor } from '../../src/features/avaliacao-tecnica/lib/scoring.js';

const LEVEL_KEYS = ['meio-oficial', 'pleno', 'especialista'];
const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));

const SEEDS = Array.from({ length: 500 }, (_, i) => (i * 2654435761) % (1 << 25));

describe('parseMillimeters', () => {
  it.each([
    ['287,5', 287.5],
    ['287.5', 287.5],
    ['3.110,18', 3110.18],
    ['3,110.18', 3110.18],
    ['3.110', 3110],
    ['384 mm', 384],
    ['797', 797],
  ])('%s → %d', (raw, expected) => expect(parseMillimeters(raw)).toBeCloseTo(expected, 5));

  it.each(['', 'abc', '3,1,1', '-5', '70,'])('rejeita "%s"', (raw) => expect(parseMillimeters(raw)).toBeNull());
});

describe('calculadora', () => {
  it.each([
    ['√(240²+300²)', Math.hypot(240, 300)],
    ['(800−660)÷2', 70],
    ['(600-25)/2', 287.5],
    ['2π', 2 * Math.PI],
    ['5×√2', 5 * Math.SQRT2],
    ['-3²', -9],
    ['1,5+1,5', 3],
    ['√(9', 3],
  ])('%s', (expr, expected) => expect(evaluateExpression(expr)).toBeCloseTo(expected, 9));

  it.each(['', '2+', '1..2', '()', '√(-4)', '2)', 'abc'])('inválida: "%s"', (expr) => expect(evaluateExpression(expr)).toBeNull());
});

describe('tolerâncias gerais EN ISO 13920 classe B', () => {
  it.each([
    [30, 1],
    [31, 2],
    [400, 2],
    [401, 3],
    [800, 3],
    [1000, 3],
    [1500, 4],
  ])('%d mm → ±%d', (nominal, tol) => expect(generalToleranceB(nominal)).toBe(tol));
});

describe('variantes do plano', () => {
  it('código ↔ seed', () => {
    for (const seed of SEEDS) {
      const code = seedToCode(seed);
      expect(code).toMatch(/^[23456789A-HJ-NP-Z]{5}$/);
      expect(codeToSeed(code)).toBe(seed);
    }
  });

  it('a mesma seed gera sempre a mesma variante', () => {
    expect(generatePlan(12345)).toEqual(generatePlan(12345));
  });

  it('todas as variantes respeitam as restrições geométricas', () => {
    for (const seed of SEEDS) {
      const p = generatePlan(seed);
      const side = (p.L - p.lugW) / 2;
      // olhal afastado dos furos
      expect(side).toBeGreaterThan(p.holeEdge + p.holeD / 2 + 20);
      // nervuras dentro do olhal e com espaço para as cotas do anel
      expect(p.gOuter).toBeGreaterThanOrEqual(400);
      expect(p.gOuter).toBeLessThan(p.lugW);
      // anel acima das nervuras e abaixo do topo
      expect(p.pinZ - p.ringD / 2 - (p.T + p.gH)).toBeGreaterThanOrEqual(35);
      expect(p.H - p.pinZ).toBeGreaterThanOrEqual(p.ringD / 2 + 45);
      // nervura não passa do bordo da placa
      expect((p.W - p.lugT) / 2 - p.gL).toBeGreaterThanOrEqual(30);
      // escotadura deixa passar a solda do olhal
      expect(p.snipe).toBeGreaterThan(p.weldLug * Math.SQRT2 + 5);
      // garganta das nervuras ≤ 0,7 × espessura
      expect(p.weldGusset).toBeLessThanOrEqual(0.7 * p.gT);
      expect(planMasses(p).total).toBeGreaterThan(80);
    }
  });

  it('todas as variantes cabem na folha sem colisões entre zonas', () => {
    for (const seed of SEEDS) {
      const g = makeGeometry(generatePlan(seed));
      const { p } = g;
      expect(g.top - 44 - 12).toBeGreaterThan(20); // cotas acima do olhal dentro da moldura
      expect(g.fx(p.L)).toBeLessThanOrEqual(490); // vista frontal antes do símbolo W2
      expect(g.w2.knee[0] - 60).toBeGreaterThan(g.fx(g.LUG_X1) + 10); // linha de referência de W2 fora da vista frontal
      expect(g.w2.knee[0] - 60).toBeGreaterThan(g.fx(p.L) + 4);
      expect(g.sx(0) + 40).toBeLessThan(872); // corte antes das notas
      expect(g.ty(0) + 50 + 12).toBeLessThan(820); // cotas da planta dentro da moldura
      // textos Ø do anel/furo entre as nervuras
      expect(g.cx - 70).toBeGreaterThan(g.fx(g.G_X0 + p.gT) + 3);
      expect(g.cx + 70).toBeLessThan(g.fx(g.G_X1 - p.gT) - 3);
      // símbolo W1 entre o eixo e a nervura direita
      expect(g.w1.knee[0]).toBeLessThan(g.fx(g.G_X1 - p.gT) - 2);
      // textos Ø acima do símbolo W1
      expect(g.cy + 52).toBeLessThan(g.w1.knee[1] - 14);
    }
  });

  it('as provas são diferentes entre si', () => {
    const answerSets = new Set(
      SEEDS.slice(0, 200).map((seed) => {
        const p = generatePlan(seed);
        return buildPhase2(p, 'pleno')
          .map((q) => q.expected.toFixed(1))
          .join('|');
      }),
    );
    expect(answerSets.size).toBeGreaterThanOrEqual(195);

    // cada resposta da Fase 2 assume vários valores
    const poolSize = buildPhase2Pool(DEFAULT_PLAN).length;
    for (let i = 0; i < poolSize; i++) {
      const values = new Set(SEEDS.map((s) => buildPhase2Pool(generatePlan(s))[i].expected.toFixed(1)));
      expect(values.size).toBeGreaterThanOrEqual(5);
    }
    // as cotas da Fase 1 também mudam
    for (const item of PHASE1_POOL) {
      const values = new Set(SEEDS.map((s) => dimText(generatePlan(s), item.targets[0])));
      expect(values.size).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('gabarito da Fase 2', () => {
  it('variante de referência', () => {
    const q = Object.fromEntries(buildPhase2Pool(DEFAULT_PLAN).map((x) => [x.id, x.expected]));
    expect(q['p2-bordo-furo']).toBe(70);
    expect(q['p2-altura-olhal']).toBe(570);
    expect(q['p2-recuo-nervura']).toBe(25);
    expect(q['p2-face-bordo']).toBe(287.5);
    expect(q['p2-hipotenusa']).toBeCloseTo(384.19, 2);
    expect(q['p2-tolerancia']).toBe(797);
    expect(q['p2-topo-furo']).toBe(150);
    expect(q['p2-diagonal-furos']).toBeCloseTo(Math.hypot(660, 460), 9);
    expect(q['p2-solda-nervuras']).toBe(8 * (240 + 300 - 60));
  });

  it('o gabarito sai das cotas que estão no plano', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const p = generatePlan(seed);
      const num = (id) => Number(dimText(p, id).replace(/[^\d.]/g, ''));
      const q = Object.fromEntries(buildPhase2Pool(p).map((x) => [x.id, x.expected]));
      expect(q['p2-bordo-furo']).toBe((num('f-length') - num('t-holes-l')) / 2);
      expect(q['p2-altura-olhal']).toBe(num('f-height') - num('f-base-t'));
      expect(q['p2-recuo-nervura']).toBe((num('f-lug-width') - num('t-gussets')) / 2);
      expect(q['p2-face-bordo']).toBe((num('s-width') - num('s-lug-t')) / 2);
      expect(q['p2-hipotenusa']).toBeCloseTo(Math.hypot(num('s-gusset-l'), num('s-gusset-h')), 9);
      expect(q['p2-topo-furo']).toBe(num('f-height') - num('f-pin-z'));
      expect(q['p2-diagonal-furos']).toBeCloseTo(Math.hypot(num('t-holes-l'), num('t-holes-w')), 9);
      expect(q['p2-solda-nervuras']).toBe(8 * (num('s-gusset-l') + num('s-gusset-h') - 2 * parseInt(dimText(p, 'd-snipe'), 10)));
    }
  });

  it('aceita ±0,5 mm na hipotenusa', () => {
    const q = buildPhase2Pool(DEFAULT_PLAN).find((x) => x.id === 'p2-hipotenusa');
    const base = { timeMs: 30_000, timedOut: false, skipped: false };
    expect(evaluateDerive(q, { ...base, rawInput: '384,2' }).correct).toBe(true);
    expect(evaluateDerive(q, { ...base, rawInput: '385' }).correct).toBe(false);
  });

  it('pergunta pulada não pontua', () => {
    const q = buildPhase2Pool(DEFAULT_PLAN)[0];
    const a = evaluateDerive(q, { rawInput: '70', timeMs: 5_000, timedOut: false, skipped: true });
    expect(a.correct).toBe(false);
    expect(a.value).toBeNull();
  });

  it('a pergunta de tolerância cobre várias cotas, faixas e limites', () => {
    const prompts = new Set(SEEDS.map((s) => byId(buildPhase2Pool(generatePlan(s)))['p2-tolerancia'].prompt.split(',')[0]));
    expect(prompts.size).toBeGreaterThanOrEqual(6);
  });
});

describe('consistência dos dados', () => {
  it('alvos da Fase 1 existem no plano', () => {
    for (const item of PHASE1_POOL) for (const t of item.targets) expect(DIM_IDS).toContain(t);
  });
  it('cada pergunta da Fase 2 marca uma medida diferente no plano', () => {
    const queries = buildPhase2Pool(DEFAULT_PLAN).map((q) => q.query);
    for (const q of queries) expect(QUERY_IDS).toContain(q);
    expect(new Set(queries).size).toBe(queries.length);
    expect(new Set(queries).size).toBe(QUERY_IDS.length);
  });
  it('cada pergunta da Fase 3 destaca um elemento existente', () => {
    for (const q of buildPhase3Pool(DEFAULT_PLAN)) expect(FOCUS_IDS).toContain(q.focus);
  });
  it('gabarito da Fase 3 aponta para uma opção existente e as opções são distintas', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      for (const q of buildPhase3Pool(generatePlan(seed))) {
        expect(q.options.map((o) => o.id)).toContain(q.correctOptionId);
        expect(new Set(q.options.map((o) => o.label)).size).toBe(q.options.length);
      }
    }
  });
});

describe('níveis de dificuldade', () => {
  it('todas as perguntas dos níveis existem e não se repetem', () => {
    for (const level of LEVEL_KEYS) {
      const l = LEVELS[level];
      expect(getPhase1Items(level)).toHaveLength(l.phase1.items.length);
      expect(buildPhase2(DEFAULT_PLAN, level)).toHaveLength(l.phase2.questions.length);
      expect(buildPhase3(DEFAULT_PLAN, level)).toHaveLength(l.phase3.questions.length);
      for (const ids of [l.phase1.items, l.phase2.questions, l.phase3.questions]) expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('as três provas são diferentes', () => {
    const signature = (level) => {
      const l = LEVELS[level];
      return [l.phase1.items, l.phase2.questions, l.phase3.questions].map((x) => x.join(',')).join('|');
    };
    expect(new Set(LEVEL_KEYS.map(signature)).size).toBe(3);
    // cada fase muda de conteúdo entre o nível básico e o avançado
    const [mo, , es] = LEVEL_KEYS.map((k) => LEVELS[k]);
    for (const key of ['phase1', 'phase2', 'phase3']) {
      const a = key === 'phase1' ? mo.phase1.items : mo[key].questions;
      const b = key === 'phase1' ? es.phase1.items : es[key].questions;
      const shared = a.filter((id) => b.includes(id)).length;
      expect(shared / Math.max(a.length, b.length)).toBeLessThan(0.5);
    }
  });

  it('a exigência sobe com o nível', () => {
    const [mo, pl, es] = LEVEL_KEYS.map((k) => LEVELS[k]);
    expect(mo.phase1.itemSec).toBeGreaterThan(pl.phase1.itemSec);
    expect(pl.phase1.itemSec).toBeGreaterThan(es.phase1.itemSec);
    expect(es.phase1.maxAttempts).toBeLessThan(mo.phase1.maxAttempts);
    expect(mo.phase1.hintAfterMiss).toBe(true);
    expect(es.phase1.hintAfterMiss).toBe(false);
    expect(es.phase1.items.length).toBeGreaterThan(mo.phase1.items.length);
    expect(es.phase3.questions.length).toBeGreaterThan(mo.phase3.questions.length);
    expect(mo.phase2.itemSec).toBeGreaterThan(es.phase2.itemSec);
    for (const k of LEVEL_KEYS) expect(maxDurationSec(k)).toBeLessThanOrEqual(21 * 60);
  });
});

describe('pontuação', () => {
  const perfect = (level = 'pleno', plan = DEFAULT_PLAN) => ({
    sessionId: 't',
    candidate: { fullName: 'Teste Silva', internalId: 'T1', level },
    plan,
    startedAt: '2026-01-01T10:00:00.000Z',
    finishedAt: '2026-01-01T10:10:00.000Z',
    phase1: getPhase1Items(level).map((i) => ({
      itemId: i.id,
      found: true,
      attemptsUsed: 1,
      wrongTaps: [],
      timeMs: 5_000,
      timedOut: false,
    })),
    phase2: buildPhase2(plan, level).map((q) =>
      evaluateDerive(q, { rawInput: q.expected.toFixed(2).replace('.', ','), timeMs: 20_000, timedOut: false, skipped: false }),
    ),
    phase3: LEVELS[level].phase3.questions.map((id) => ({
      questionId: id,
      selectedOptionId: 'a',
      correct: true,
      timeMs: 8_000,
      timedOut: false,
    })),
    integrity: { focusLosses: 0, exitAttempts: 0, abandoned: false },
  });

  it('candidato perfeito e rápido → Apto, em qualquer nível e variante', () => {
    for (const level of LEVEL_KEYS) {
      for (const seed of SEEDS.slice(0, 10)) {
        const s = computeSummary(perfect(level, generatePlan(seed)));
        expect(s.pillars.localizacao).toBe(100);
        expect(s.pillars.calculo).toBe(100);
        expect(s.pillars.simbologia).toBe(100);
        expect(s.overall).toBeGreaterThanOrEqual(95);
        expect(s.classification).toBe('apto');
      }
    }
  });

  it('respostas de outro nível não contam', () => {
    const snap = perfect('especialista');
    snap.phase2 = perfect('meio-oficial').phase2; // respondeu as perguntas do nível básico
    const s = computeSummary(snap);
    const shared = LEVELS['especialista'].phase2.questions.filter((id) => LEVELS['meio-oficial'].phase2.questions.includes(id)).length;
    expect(s.pillars.calculo).toBe(Math.round((shared / LEVELS['especialista'].phase2.questions.length) * 100));
  });

  it('toques errados reduzem a localização (2.ª tentativa = 60 %)', () => {
    const snap = perfect();
    snap.phase1 = snap.phase1.map((r) => ({ ...r, attemptsUsed: 2, wrongTaps: ['f-height'] }));
    const s = computeSummary(snap);
    expect(s.pillars.localizacao).toBe(60);
    expect(s.wrongTapsTotal).toBe(LEVELS.pleno.phase1.items.length);
  });

  it('simbologia fraca bloqueia "Apto" mesmo com nota alta', () => {
    const snap = perfect();
    snap.phase3 = snap.phase3.map((a, i) => ({ ...a, correct: i < 2, selectedOptionId: i < 2 ? 'a' : 'b' }));
    const s = computeSummary(snap);
    expect(s.pillars.simbologia).toBe(25);
    expect(s.classification).not.toBe('apto');
  });

  it('prova abandonada após a Fase 1 → Não Recomendado', () => {
    const snap = perfect();
    snap.phase2 = [];
    snap.phase3 = [];
    expect(computeSummary(snap).classification).toBe('nao-recomendado');
  });

  it('fator de velocidade', () => {
    expect(speedFactor(5_000, 40_000, false)).toBe(1);
    expect(speedFactor(40_000, 40_000, false)).toBeCloseTo(0.2);
    expect(speedFactor(10_000, 40_000, true)).toBe(0);
  });
});

// ── Correção no servidor (api/_avaliacoes.js usa gradeSubmission) ─────────────
import { gradeSubmission, reportFromRecord } from '../../src/features/avaliacao-tecnica/lib/grading.js';

describe('correção no servidor', () => {
  const SEED = 123456;
  const base = (level, respostas) =>
    gradeSubmission({
      seed: SEED,
      level,
      candidate: { fullName: 'Ana Teste', internalId: 'AV-TESTE' },
      sessionId: 'sess-1',
      startedAt: '2026-11-11T10:00:00.000Z',
      finishedAt: '2026-11-11T10:15:00.000Z',
      respostas,
    });

  // respostas certas, enviadas como o navegador as envia
  const respostasCertas = (level) => {
    const plan = generatePlan(SEED);
    return {
      phase1: getPhase1Items(level).map((i) => ({ itemId: i.id, found: true, attemptsUsed: 1, wrongTaps: [], timeMs: 3000, timedOut: false })),
      phase2: buildPhase2(plan, level).map((q) => ({ questionId: q.id, rawInput: String(q.expected), timeMs: 10000, timedOut: false, skipped: false })),
      phase3: buildPhase3(plan, level).map((q) => ({ questionId: q.id, selectedOptionId: q.correctOptionId, timeMs: 4000, timedOut: false })),
      integrity: { focusLosses: 1, exitAttempts: 0, abandoned: false },
    };
  };

  for (const level of Object.keys(LEVELS)) {
    it(`respostas certas dão 100 (${level})`, () => {
      const { summary, record } = base(level, respostasCertas(level));
      expect(summary.overall).toBe(100);
      expect(record.classification).toBe('apto');
      expect(record.plan_variant).toBe(seedToCode(SEED));
      expect(record.candidate_level).toBe(level);
      expect(record.integrity).toEqual({ focusLosses: 1, exitAttempts: 0, abandoned: false });
    });
  }

  it('ignora "correct: true" enviado pelo navegador e recorrige as fases 2 e 3', () => {
    const r = respostasCertas('pleno');
    r.phase2 = r.phase2.map((a) => ({ ...a, rawInput: '1', value: 999, correct: true }));
    r.phase3 = r.phase3.map((a) => ({ ...a, selectedOptionId: 'b', correct: true }));
    const { summary } = base('pleno', r);
    expect(summary.pillars.calculo).toBe(0);
    expect(summary.pillars.simbologia).toBe(0);
  });

  it('a variante vem da seed do convite, não do plano enviado', () => {
    const r = { ...respostasCertas('pleno'), plan: DEFAULT_PLAN };
    const { record } = base('pleno', r);
    expect(record.plan).toEqual(generatePlan(SEED));
  });

  it('limita valores impossíveis e descarta perguntas de outro nível', () => {
    const r = respostasCertas('meio-oficial');
    r.phase1 = r.phase1.map((a) => ({ ...a, attemptsUsed: 0, timeMs: -50, wrongTaps: ['f-length', '<script>'] }));
    r.phase2.push({ questionId: 'p2-diagonal-furos', rawInput: '1', timeMs: 1 }); // só existe no Especialista
    const { record } = base('meio-oficial', r);
    expect(record.phase1.every((a) => a.attemptsUsed === 1 && a.timeMs === 0)).toBe(true);
    expect(record.phase1[0].wrongTaps).toEqual(['f-length']);
    expect(record.phase2.map((a) => a.questionId)).toEqual(LEVELS['meio-oficial'].phase2.questions);
  });

  it('prova encerrada antes da Fase 3 fica marcada como abandonada', () => {
    const r = respostasCertas('pleno');
    r.phase3 = r.phase3.slice(0, 2);
    r.integrity.abandoned = false;
    const { record } = base('pleno', r);
    expect(record.integrity.abandoned).toBe(true);
  });

  it('respostas vazias ou malformadas não rebentam a correção', () => {
    expect(base('pleno', null).summary.overall).toBe(0);
    expect(base('pleno', { phase1: 'x', phase2: [null, 3], phase3: {} }).summary.overall).toBe(0);
    expect(() => base('mestre', {})).toThrow();
  });

  it('o relatório do admin reconstrói a mesma nota a partir do registo gravado', () => {
    const { record, summary } = base('especialista', respostasCertas('especialista'));
    const again = reportFromRecord(JSON.parse(JSON.stringify(record)));
    expect(again.summary).toEqual(summary);
  });
});
