/**
 * Plano MP-AV-205 — Suporte de olhal soldado.
 *
 * Cada prova usa uma VARIANTE do plano: as medidas são sorteadas a partir de uma seed,
 * dentro de faixas realistas e com restrições geométricas (as peças cabem, a solda passa
 * na escotadura, o anel não toca nas nervuras…). O desenho, o gabarito, a lista de peças
 * e o relatório saem todos da mesma variante, por isso dois candidatos não têm as mesmas respostas.
 */

export const DRAWING = {
  number: 'MP-AV-205',
  rev: 'B',
  title: 'SUPORTE DE OLHAL SOLDADO',
  subtitle: 'Conjunto soldado',
  scale: '1:5',
  format: 'A2',
  date: '2026-11-02',
};

/** Cota cuja tolerância geral é pedida na Fase 2 */

/** Variante de referência (usada nos testes e como estado inicial) */
export const DEFAULT_PLAN = {
  code: 'BASE0',
  seed: -1,
  L: 800,
  W: 600,
  T: 30,
  holeEdge: 70,
  holeD: 33,
  lugW: 500,
  lugT: 25,
  H: 600,
  chamfer: 80,
  pinZ: 450,
  pinD: 52,
  ringD: 160,
  ringT: 20,
  gT: 15,
  gL: 240,
  gH: 300,
  gOuter: 450,
  snipe: 30,
  weldLug: 8,
  weldGusset: 5,
  weldRing: 6,
  tolTarget: 'L',
  tolBound: 'min',
};

// ── Seed e código da variante ───────────────────────────────────────────────
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 símbolos, sem 0/O/1/I
export const SEED_BITS = 25; // 5 caracteres × 5 bits

export function seedToCode(seed) {
  let s = seed >>> 0;
  let code = '';
  for (let i = 0; i < 5; i++) {
    code = CODE_ALPHABET[s & 31] + code;
    s >>>= 5;
  }
  return code;
}

export function codeToSeed(code) {
  const clean = code.trim().toUpperCase();
  if (!/^[23456789A-HJ-NP-Z]{5}$/.test(clean)) return null;
  let seed = 0;
  for (const ch of clean) seed = (seed << 5) | CODE_ALPHABET.indexOf(ch);
  return seed >>> 0;
}

export function randomSeed() {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') return c.getRandomValues(new Uint32Array(1))[0] & ((1 << SEED_BITS) - 1);
  return Math.floor(Math.random() * (1 << SEED_BITS));
}

/** PRNG determinístico (mulberry32) */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Faixas de variação. As restrições mantêm a peça coerente e o desenho legível
 * na folha A2 a 1:5 (vistas, cotas e símbolos não se sobrepõem).
 */
export function generatePlan(seed) {
  const rnd = mulberry32(seed ^ 0x5eed1234);
  const pick = (options) => {
    if (options.length === 0) throw new Error('variante sem opção válida');
    return options[Math.floor(rnd() * options.length)];
  };

  const L = pick([720, 740, 760, 780, 800]);
  const W = pick([520, 540, 560, 580, 600]);
  const T = pick([20, 25, 30]);
  const holeEdge = pick([50, 55, 60, 65, 70]);
  const holeD = pick([22, 26, 33]); // furos de passagem M20 / M24 / M30
  const lugW = pick([440, 460, 480, 500, 520].filter((w) => (L - w) / 2 >= 120));
  const inset = pick([20, 25, 30, 35, 40, 45, 50].filter((i) => lugW - 2 * i >= 400));
  const lugT = pick([20, 25, 30]);
  const H = pick([540, 560, 580, 600, 620]);
  const chamfer = pick([60, 70, 80]);
  const ringD = pick([140, 150, 160]);
  const pinD = pick([40, 45, 50, 52]);
  const ringT = pick([15, 20]);
  const top = pick([130, 140, 150, 160, 170].filter((t) => t >= ringD / 2 + 45));
  const pinZ = H - top;
  const gT = pick([12, 15]);
  const gH = pick([220, 240, 260, 280, 300].filter((h) => T + h <= pinZ - ringD / 2 - 35));
  const gL = pick([200, 220, 240, 260].filter((l) => l <= (W - lugT) / 2 - 30));
  const snipe = pick([20, 25, 30]);
  const weldLug = pick([6, 7, 8]);
  const weldGusset = pick([4, 5]);
  const weldRing = pick([5, 6]);
  const tolTarget = pick(['L', 'H', 'holeW', 'gH']);
  const tolBound = pick(['min', 'max']);

  return {
    code: seedToCode(seed),
    seed,
    L,
    W,
    T,
    holeEdge,
    holeD,
    lugW,
    lugT,
    H,
    chamfer,
    pinZ,
    pinD,
    ringD,
    ringT,
    gT,
    gL,
    gH,
    gOuter: lugW - 2 * inset,
    snipe,
    weldLug,
    weldGusset,
    weldRing,
    tolTarget,
    tolBound,
  };
}

// ── Massas (aço, 7850 kg/m³) ────────────────────────────────────────────────
const RHO = 7.85e-6; // kg/mm³

export function planMasses(p) {
  const circle = (d) => (Math.PI * d * d) / 4;
  const base = (p.L * p.W - 4 * circle(p.holeD)) * p.T * RHO;
  const lug = (p.lugW * (p.H - p.T) - p.chamfer * p.chamfer - circle(p.pinD)) * p.lugT * RHO;
  const gusset = ((p.gL * p.gH) / 2 - (p.snipe * p.snipe) / 2) * p.gT * RHO;
  const ring = (circle(p.ringD) - circle(p.pinD)) * p.ringT * RHO;
  return { base, lug, gusset, ring, total: base + lug + 4 * gusset + ring };
}

// ── Tolerâncias gerais EN ISO 13920 classe B (comprimentos, mm) ─────────────
export const ISO13920_B = [
  { from: 2, to: 30, tol: 1, label: '2 a 30' },
  { from: 30, to: 120, tol: 2, label: 'acima de 30 até 120' },
  { from: 120, to: 400, tol: 2, label: 'acima de 120 até 400' },
  { from: 400, to: 1000, tol: 3, label: 'acima de 400 até 1000' },
  { from: 1000, to: 2000, tol: 4, label: 'acima de 1000 até 2000' },
  { from: 2000, to: 4000, tol: 6, label: 'acima de 2000 até 4000' },
];

export function toleranceRowB(nominal) {
  return ISO13920_B.find((r, i) => (i === 0 ? nominal >= r.from : nominal > r.from) && nominal <= r.to) ?? null;
}

export function generalToleranceB(nominal) {
  return toleranceRowB(nominal)?.tol ?? null;
}

// ── Cotas do plano ──────────────────────────────────────────────────────────
/** Cotas tocáveis no plano (Fase 1) */
export const DIM_IDS = [
  'f-length',
  'f-lug-width',
  'f-chamfer',
  'f-base-t',
  'f-pin-z',
  'f-height',
  'f-ring-d',
  'f-pin-d',
  's-lug-t',
  's-gusset-h',
  's-gusset-l',
  's-width',
  't-holes',
  't-holes-w',
  't-gussets',
  't-holes-l',
  'd-snipe',
  'bom-e1',
  'bom-e2',
  'bom-e3',
  'bom-e4',
];

export const DIM_WHERE = {
  'f-length': 'Vista frontal',
  'f-lug-width': 'Vista frontal',
  'f-chamfer': 'Vista frontal',
  'f-base-t': 'Vista frontal',
  'f-pin-z': 'Vista frontal',
  'f-height': 'Vista frontal',
  'f-ring-d': 'Vista frontal',
  'f-pin-d': 'Vista frontal',
  's-lug-t': 'Corte A–A',
  's-gusset-h': 'Corte A–A',
  's-gusset-l': 'Corte A–A',
  's-width': 'Corte A–A',
  't-holes': 'Planta',
  't-holes-w': 'Planta',
  't-gussets': 'Planta',
  't-holes-l': 'Planta',
  'd-snipe': 'Detalhe B',
  'bom-e1': 'Lista de peças',
  'bom-e2': 'Lista de peças',
  'bom-e3': 'Lista de peças',
  'bom-e4': 'Lista de peças',
};

/** Texto que a cota mostra no plano desta variante */
export function dimText(p, id) {
  switch (id) {
    case 'f-length':
      return String(p.L);
    case 'f-lug-width':
      return String(p.lugW);
    case 'f-chamfer':
      return `2× ${p.chamfer}×45°`;
    case 'f-base-t':
      return String(p.T);
    case 'f-pin-z':
      return String(p.pinZ);
    case 'f-height':
      return String(p.H);
    case 'f-ring-d':
      return `Ø${p.ringD}`;
    case 'f-pin-d':
      return `Ø${p.pinD}`;
    case 's-lug-t':
      return String(p.lugT);
    case 's-gusset-h':
      return String(p.gH);
    case 's-gusset-l':
      return String(p.gL);
    case 's-width':
      return String(p.W);
    case 't-holes':
      return `4× Ø${p.holeD}`;
    case 't-holes-w':
      return String(p.W - 2 * p.holeEdge);
    case 't-gussets':
      return String(p.gOuter);
    case 't-holes-l':
      return String(p.L - 2 * p.holeEdge);
    case 'd-snipe':
      return `${p.snipe}×45°`;
    case 'bom-e1':
      return `e = ${p.T}`;
    case 'bom-e2':
      return `e = ${p.lugT}`;
    case 'bom-e3':
      return `e = ${p.gT}`;
    case 'bom-e4':
      return `e = ${p.ringT}`;
  }
}

/** Elementos destacados no plano durante a Fase 3 (a posição depende da variante) */
export const FOCUS_IDS = [
  'projection',
  'w1',
  'w2',
  'w3',
  'cut',
  'material',
  'notes',
  'note-process',
  'note-quality',
  'note-tolerance',
  'note-exc',
];

/** Medidas pedidas na Fase 2 — desenhadas no plano como cota "?" em laranja */
export const QUERY_IDS = [
  'edge-hole',
  'lug-height',
  'gusset-inset',
  'face-edge',
  'gusset-hyp',
  'tolerance',
  'pin-top',
  'hole-diagonal',
  'gusset-welds',
];
