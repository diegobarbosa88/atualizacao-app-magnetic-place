/**
 * Plano MP-AV-205 — folha A2, escala 1:5, projeção europeia (1.º diedro, ISO 5456-2).
 * 1 unidade SVG = 0,5 mm de papel; 1:5 → 0,4 unidade por mm real.
 *
 * O desenho é gerado da variante (PlanSpec): vistas à escala, cotas, símbolos, lista de peças
 * e legenda. As anotações são posicionadas em relação à geometria, para continuarem legíveis
 * em todas as variantes (verificado por src/lib/planLayout.test.ts e pelo teste de sobreposição).
 *
 * Vistas: frontal (cima, esq.) · corte A–A = vista pela esquerda, colocada à DIREITA ·
 * planta = vista de cima, colocada POR BAIXO · detalhe B (1:2).
 * Simbologia de solda: EN ISO 2553 sistema A. Cotas: ISO 129-1.
 */
import { createContext, useContext, useId, useMemo } from 'react';
import { DRAWING, ISO13920_B, dimText, planMasses } from '../../data/plan.js';

const INK = '#111827';
const PAPER = '#ffffff';
const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const FS = 12.5;
const THICK = 1.7;
const THIN = 0.8;
const CHAIN = '16 3 2 3';
const HIDDEN = '5 3';
const K = 0.4;

const pts = (list) => list.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(' ');

// ── Geometria da variante ───────────────────────────────────────────────────
export function makeGeometry(p) {
  const fx = (X) => 170 + K * X; // vista frontal / planta: X → direita
  const fz = (Z) => 380 - K * Z; // vista frontal / corte: Z → cima
  const sx = (Y) => 560 + K * (p.W - Y); // corte A–A: frente (Y=0) à direita
  const ty = (Y) => 450 + K * (p.W - Y); // planta: frente (Y=0) em baixo
  const LUG_X0 = (p.L - p.lugW) / 2;
  const LUG_X1 = LUG_X0 + p.lugW;
  const LUG_Y0 = (p.W - p.lugT) / 2; // face da frente
  const LUG_Y1 = LUG_Y0 + p.lugT; // face de trás
  const G_X0 = (p.L - p.gOuter) / 2;
  const G_X1 = p.L - G_X0;
  const PIN_X = p.L / 2;
  const cx = fx(PIN_X);
  const cy = fz(p.pinZ);
  const zHoleTop = p.pinZ + p.pinD / 2;
  const zHoleBot = p.pinZ - p.pinD / 2;
  const zRingTop = p.pinZ + p.ringD / 2;
  const zRingBot = p.pinZ - p.ringD / 2;
  const top = fz(p.H); // topo da vista frontal
  const gTop = fz(p.T + p.gH); // topo das nervuras

  // Símbolos de solda (posições usadas também pelos destaques da Fase 3)
  const w1 = { tip: [cx + 58, fz(p.T) - 1], knee: [cx + 68, fz(p.T) - 34], refTo: cx + 10, sym: cx + 38 };
  const w2Tip = [sx(LUG_Y1 + 0.78 * p.gL), fz(p.T) - 1];
  const w2 = { tip: w2Tip, knee: [w2Tip[0] - 34, fz(p.T) - 68], sym: w2Tip[0] - 68 };
  const w3Knee = [sx(LUG_Y0) + 37, top - 12];
  const w3 = { knee: w3Knee, tip: [sx(LUG_Y0) + 3.5, fz(zRingTop) - 3], sym: w3Knee[0] + 26, end: w3Knee[0] + 66 };

  return {
    p,
    fx,
    fz,
    sx,
    ty,
    LUG_X0,
    LUG_X1,
    LUG_Y0,
    LUG_Y1,
    G_X0,
    G_X1,
    PIN_X,
    cx,
    cy,
    ringR: K * (p.ringD / 2),
    pinR: K * (p.pinD / 2),
    holeR: K * (p.holeD / 2),
    holeXs: [p.holeEdge, p.L - p.holeEdge],
    holeYs: [p.holeEdge, p.W - p.holeEdge],
    zHoleTop,
    zHoleBot,
    zRingTop,
    zRingBot,
    top,
    gTop,
    w1,
    w2,
    w3,
  };
}

/** Caixas destacadas na Fase 3 */
function focusBox(id, g) {
  switch (id) {
    case 'projection':
      return { x: 898, y: 778, w: 54, h: 44 };
    case 'w1':
      return { x: g.w1.refTo - 6, y: g.w1.knee[1] - 20, w: g.w1.knee[0] - g.w1.refTo + 12, h: g.w1.tip[1] - g.w1.knee[1] + 26 };
    case 'w2':
      return { x: g.w2.knee[0] - 66, y: g.w2.knee[1] - 20, w: g.w2.tip[0] - g.w2.knee[0] + 74, h: g.w2.tip[1] - g.w2.knee[1] + 26 };
    case 'w3':
      return { x: g.w3.tip[0] - 8, y: g.w3.knee[1] - 22, w: g.w3.end - g.w3.tip[0] + 14, h: g.w3.tip[1] - g.w3.knee[1] + 30 };
    case 'cut':
      return { x: g.cx - 14, y: g.top - 28, w: 54, h: g.fz(0) - g.top + 56 };
    case 'material':
      return { x: 994, y: 642, w: 84, h: 68 };
    case 'notes':
      return { x: 866, y: 58, w: 298, h: 22 };
    case 'note-process':
      return { x: 866, y: 106, w: 298, h: 34 };
    case 'note-quality':
      return { x: 866, y: 137, w: 298, h: 17 };
    case 'note-tolerance':
      return { x: 866, y: 152, w: 298, h: 17 };
    case 'note-exc':
      return { x: 866, y: 167, w: 298, h: 17 };
  }
}

// ── Interação ───────────────────────────────────────────────────────────────
const PlanCtx = createContext({ interactive: false, marks: {} });

const MARK_STYLE = {
  correct: { fill: 'rgba(16,185,129,0.22)', stroke: '#059669' },
  wrong: { fill: 'rgba(239,68,68,0.18)', stroke: '#dc2626' },
  reveal: { fill: 'rgba(255,194,14,0.38)', stroke: '#b47e00' },
};

function Target({ id, box, label, children }) {
  const { interactive, marks, onTap } = useContext(PlanCtx);
  if (!id) return <>{children}</>;
  const mark = marks[id];
  const style = mark ? MARK_STYLE[mark] : null;
  return (
    <g>
      {style && (
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx={5}
          fill={style.fill}
          stroke={style.stroke}
          strokeWidth={1.8}
          className={mark === 'reveal' ? 'animate-pulse' : undefined}
        />
      )}
      {children}
      {interactive && (
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx={5}
          fill="transparent"
          pointerEvents="all"
          strokeWidth={1.5}
          className="cursor-pointer outline-none hover:fill-sky-500/15 focus-visible:stroke-sky-600"
          role="button"
          tabIndex={0}
          aria-label={`Cota ${label}`}
          data-dim={id}
          onClick={() => onTap?.(id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onTap?.(id);
            }
          }}
        />
      )}
    </g>
  );
}

// ── Primitivas de desenho ───────────────────────────────────────────────────
const textWidth = (s, fs = FS) => s.length * fs * 0.6;

function labelBox(x, baseline, text, anchor, fs = FS) {
  const tw = textWidth(text, fs);
  const w = Math.max(tw + 12, 34);
  const h = Math.max(fs + 11, 25);
  const textCx = anchor === 'middle' ? x : anchor === 'start' ? x + tw / 2 : x - tw / 2;
  const cy = baseline - fs * 0.36;
  return { x: textCx - w / 2, y: cy - h / 2, w, h };
}

/** Ponta de seta fechada e cheia; `dir` = sentido para onde a seta aponta */
function Arrow({ tip, dir, size = 8, spread = 2.3, fill = INK }) {
  const [tx, ty] = tip;
  const [dx, dy] = dir;
  const bx = tx - dx * size;
  const by = ty - dy * size;
  return <polygon points={pts([tip, [bx - dy * spread, by + dx * spread], [bx + dy * spread, by - dx * spread]])} fill={fill} />;
}

const unit = (from, to) => {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return [(to[0] - from[0]) / len, (to[1] - from[1]) / len];
};

/** Cota horizontal: linha de cota, linhas de chamada e valor por cima da linha (ISO 129-1) */
function HDim({ id, x1, x2, y, from1, from2, label, labelX, anchor = 'middle', outside }) {
  const lx = labelX ?? (x1 + x2) / 2;
  const baseline = y - 4;
  const ext = (x, from) => (from === undefined ? null : <line x1={x} y1={from} x2={x} y2={from > y ? y - 4 : y + 4} />);
  return (
    <g>
      <g stroke={INK} strokeWidth={THIN}>
        {ext(x1, from1)}
        {ext(x2, from2)}
        <line x1={outside ? x1 - 14 : x1} y1={y} x2={outside ? x2 + 14 : x2} y2={y} />
      </g>
      <Arrow tip={[x1, y]} dir={outside ? [1, 0] : [-1, 0]} />
      <Arrow tip={[x2, y]} dir={outside ? [-1, 0] : [1, 0]} />
      <Target id={id} box={labelBox(lx, baseline, label, anchor)} label={label}>
        <text x={lx} y={baseline} textAnchor={anchor} fontSize={FS} fill={INK}>
          {label}
        </text>
      </Target>
    </g>
  );
}

/** Cota vertical: valor rodado, legível pelo lado direito da folha */
function VDim({ id, y1, y2, x, from1, from2, label, labelY, outside }) {
  const ly = labelY ?? (y1 + y2) / 2;
  const tx = x - 4;
  const ext = (y, from) => (from === undefined ? null : <line x1={from} y1={y} x2={from > x ? x - 4 : x + 4} y2={y} />);
  const tw = textWidth(label);
  const bw = Math.max(FS + 11, 25);
  const bh = Math.max(tw + 12, 34);
  const box = { x: tx - FS * 0.36 - bw / 2, y: ly - bh / 2, w: bw, h: bh };
  return (
    <g>
      <g stroke={INK} strokeWidth={THIN}>
        {ext(y1, from1)}
        {ext(y2, from2)}
        <line x1={x} y1={outside ? y1 - 14 : y1} x2={x} y2={outside ? y2 + 14 : y2} />
      </g>
      <Arrow tip={[x, y1]} dir={outside ? [0, 1] : [0, -1]} />
      <Arrow tip={[x, y2]} dir={outside ? [0, -1] : [0, 1]} />
      <Target id={id} box={box} label={label}>
        <text x={tx} y={ly} transform={`rotate(-90 ${tx} ${ly})`} textAnchor="middle" fontSize={FS} fill={INK}>
          {label}
        </text>
      </Target>
    </g>
  );
}

/** Linha de chamada com seta, cotovelo e patamar horizontal com texto */
function Leader({ id, tip, knee, to, label }) {
  const lx = (knee[0] + to) / 2;
  const baseline = knee[1] - 4;
  return (
    <g>
      <polyline points={pts([tip, knee, [to, knee[1]]])} fill="none" stroke={INK} strokeWidth={THIN} />
      <Arrow tip={tip} dir={unit(knee, tip)} />
      <Target id={id} box={labelBox(lx, baseline, label, 'middle')} label={label}>
        <text x={lx} y={baseline} textAnchor="middle" fontSize={FS} fill={INK}>
          {label}
        </text>
      </Target>
    </g>
  );
}

/** Referência de peça (balão) com ponto na peça */
function Balloon({ n, c, to }) {
  const r = 9;
  const d = unit(c, to);
  const start = [c[0] + d[0] * r, c[1] + d[1] * r];
  return (
    <g>
      <line x1={start[0]} y1={start[1]} x2={to[0]} y2={to[1]} stroke={INK} strokeWidth={THIN} />
      <circle cx={to[0]} cy={to[1]} r={1.9} fill={INK} />
      <circle cx={c[0]} cy={c[1]} r={r} fill={PAPER} stroke={INK} strokeWidth={THIN} />
      <text x={c[0]} y={c[1] + 4.3} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>
        {n}
      </text>
    </g>
  );
}

/** Símbolo de filete (triângulo retângulo, cateto vertical à esquerda) */
function FilletSymbol({ x, y, up }) {
  const s = 12;
  return (
    <polygon
      points={pts([
        [x, y],
        [x, up ? y - s : y + s],
        [x + s, y],
      ])}
      fill="none"
      stroke={INK}
      strokeWidth={1}
    />
  );
}

function Cell({ x, y, w, h, label, children }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={INK} strokeWidth={THIN} />
      {label && (
        <text x={x + 3} y={y + 8.5} fontSize={6.8} fontWeight={700} fill="#4b5563" letterSpacing={0.3}>
          {label}
        </text>
      )}
      {children}
    </g>
  );
}

/** Símbolo do 1.º diedro (ISO 5456-2): cone com a ponta estreita à esquerda e os círculos à direita */
function FirstAngleSymbol({ x, y }) {
  return (
    <g stroke={INK} fill="none">
      <line x1={x - 2} y1={y} x2={x + 46} y2={y} strokeWidth={0.5} strokeDasharray="6 1.5 1 1.5" />
      <line x1={x + 34} y1={y - 11} x2={x + 34} y2={y + 11} strokeWidth={0.5} strokeDasharray="6 1.5 1 1.5" />
      <polygon
        points={pts([
          [x + 2, y - 4.5],
          [x + 18, y - 8],
          [x + 18, y + 8],
          [x + 2, y + 4.5],
        ])}
        strokeWidth={1.1}
      />
      <circle cx={x + 34} cy={y} r={8} strokeWidth={1.1} />
      <circle cx={x + 34} cy={y} r={4.5} strokeWidth={1.1} />
    </g>
  );
}

// ── Cota pedida (Fase 2): cota em laranja com "?" no lugar do valor ───────────
const QUERY = '#ea580c';

function querySpec(id, g) {
  const { p, fx, fz, sx, ty } = g;
  switch (id) {
    case 'edge-hole': {
      // planta: bordo esquerdo da placa → eixo do furo, no sentido do comprimento
      const xHole = fx(p.holeEdge);
      const y = 440;
      return {
        a: [fx(0), y],
        b: [xHole, y],
        exts: [
          [
            [fx(0), ty(p.W) - 4],
            [fx(0), y - 4],
          ],
          [
            [xHole, ty(p.W - p.holeEdge) - 12],
            [xHole, y - 4],
          ],
        ],
        badge: [xHole + 18, y],
      };
    }
    case 'lug-height': {
      // vista frontal: topo da placa base → topo da chapa do olhal
      const x = fx(g.LUG_X1) + 25;
      return {
        a: [x, g.top],
        b: [x, fz(p.T)],
        exts: [
          [
            [fx(g.LUG_X1 - p.chamfer) + 4, g.top],
            [x + 4, g.top],
          ],
        ],
      };
    }
    case 'gusset-inset': {
      // vista frontal: bordo lateral da chapa do olhal → face exterior da nervura
      const y = g.gTop - 18;
      return {
        a: [fx(g.LUG_X0), y],
        b: [fx(g.G_X0), y],
        exts: [
          [
            [fx(g.G_X0), g.gTop - 3],
            [fx(g.G_X0), y - 4],
          ],
        ],
        outside: true,
        badge: [fx(g.LUG_X0) - 30, y],
      };
    }
    case 'face-edge': {
      // corte A–A: face da frente da chapa do olhal → bordo da frente da placa base
      const y = g.gTop - 7;
      return {
        a: [sx(g.LUG_Y0), y],
        b: [sx(0), y],
        exts: [
          [
            [sx(0), fz(p.T) - 4],
            [sx(0), y - 4],
          ],
        ],
      };
    }
    case 'gusset-hyp': {
      // corte A–A: aresta inclinada da nervura da frente (cota alinhada)
      const A = [sx(g.LUG_Y0), g.gTop];
      const B = [sx(g.LUG_Y0 - p.gL), fz(p.T)];
      const d = unit(A, B);
      const n = [d[1], -d[0]]; // normal para fora da nervura
      const o = 18;
      const off = (q, k) => [q[0] + n[0] * k, q[1] + n[1] * k];
      return {
        a: off(A, o),
        b: off(B, o),
        exts: [
          [off(A, 3), off(A, o + 4)],
          [off(B, 3), off(B, o + 4)],
        ],
      };
    }
    case 'pin-top': {
      // vista frontal: eixo do furo do olhal → topo da chapa do olhal
      const x = fx(g.LUG_X1) + 25;
      return {
        a: [x, g.top],
        b: [x, g.cy],
        exts: [
          [
            [fx(g.LUG_X1 - p.chamfer) + 4, g.top],
            [x + 4, g.top],
          ],
          [
            [g.cx + g.ringR + 4, g.cy],
            [x + 4, g.cy],
          ],
        ],
      };
    }
    case 'hole-diagonal': {
      // planta: eixo de um furo → eixo do furo oposto
      const a = [fx(p.holeEdge), ty(p.holeEdge)];
      const b = [fx(p.L - p.holeEdge), ty(p.W - p.holeEdge)];
      return { a, b, badge: [a[0] + 0.3 * (b[0] - a[0]), a[1] + 0.3 * (b[1] - a[1])] };
    }
    case 'gusset-welds': {
      // corte A–A: nervura + símbolo W2 (as 4 nervuras são iguais)
      const x0 = sx(g.LUG_Y1 + p.gL) - 4;
      const x1 = sx(g.LUG_Y1) + 4;
      const w2 = focusBox('w2', g);
      return {
        box: { x: x0, y: g.gTop - 4, w: x1 - x0, h: fz(p.T) - g.gTop + 8 },
        badge: [(2 * sx(g.LUG_Y1) + sx(g.LUG_Y1 + p.gL)) / 3, (g.gTop + 2 * fz(p.T)) / 3],
        extra: [
          [w2.x, w2.y],
          [w2.x + w2.w, w2.y + w2.h],
        ],
      };
    }
    case 'tolerance': {
      // a pergunta é sobre uma cota já indicada: realça essa cota
      switch (p.tolTarget) {
        case 'L':
          return { box: { x: fx(0) - 8, y: 398, w: K * p.L + 16, h: 28 }, badge: [fx(p.L) + 24, 412] };
        case 'H':
          return { box: { x: 86, y: g.top - 6, w: 26, h: fz(0) - g.top + 12 }, badge: [102, g.top - 22] };
        case 'holeW':
          return {
            box: { x: 130, y: ty(p.W - p.holeEdge) - 6, w: 26, h: K * (p.W - 2 * p.holeEdge) + 12 },
            badge: [146, ty(p.W - p.holeEdge) - 22],
          };
        case 'gH':
          return { box: { x: sx(0) + 10, y: g.gTop - 6, w: 26, h: K * p.gH + 12 }, badge: [sx(0) + 26, g.gTop - 22] };
      }
    }
  }
}

function QueryOverlay({ id, g }) {
  const q = querySpec(id, g);
  const all = [];
  if (q.a) all.push(q.a);
  if (q.b) all.push(q.b);
  for (const [p1, p2] of q.exts ?? []) all.push(p1, p2);
  if (q.box) all.push([q.box.x, q.box.y], [q.box.x + q.box.w, q.box.y + q.box.h]);
  if (q.extra) all.push(...q.extra);
  const badge = q.badge ?? (q.a && q.b ? [(q.a[0] + q.b[0]) / 2, (q.a[1] + q.b[1]) / 2] : undefined);
  if (badge) all.push([badge[0] - 11, badge[1] - 11], [badge[0] + 11, badge[1] + 11]);
  const pad = 9;
  const minX = Math.min(...all.map((pt) => pt[0])) - pad;
  const minY = Math.min(...all.map((pt) => pt[1])) - pad;
  const maxX = Math.max(...all.map((pt) => pt[0])) + pad;
  const maxY = Math.max(...all.map((pt) => pt[1])) + pad;

  let dimLine = null;
  if (q.a && q.b) {
    const d = unit(q.a, q.b);
    const e = q.outside ? 14 : 0;
    dimLine = (
      <g>
        <line
          x1={q.a[0] - d[0] * e}
          y1={q.a[1] - d[1] * e}
          x2={q.b[0] + d[0] * e}
          y2={q.b[1] + d[1] * e}
          stroke={QUERY}
          strokeWidth={1.7}
        />
        <Arrow tip={q.a} dir={q.outside ? d : [-d[0], -d[1]]} size={10} spread={3} fill={QUERY} />
        <Arrow tip={q.b} dir={q.outside ? [-d[0], -d[1]] : d} size={10} spread={3} fill={QUERY} />
      </g>
    );
  }

  return (
    <g pointerEvents="none" data-query={id}>
      <rect
        x={minX}
        y={minY}
        width={maxX - minX}
        height={maxY - minY}
        rx={9}
        fill="rgba(234,88,12,0.10)"
        stroke={QUERY}
        strokeWidth={1.4}
        strokeDasharray="6 4"
        className="animate-pulse"
      />
      {q.box && (
        <rect
          x={q.box.x}
          y={q.box.y}
          width={q.box.w}
          height={q.box.h}
          rx={6}
          fill="rgba(234,88,12,0.16)"
          stroke={QUERY}
          strokeWidth={2.2}
        />
      )}
      {(q.exts ?? []).map(([p1, p2], i) => (
        <line key={i} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={QUERY} strokeWidth={1.3} />
      ))}
      {dimLine}
      {badge && (
        <g>
          <circle cx={badge[0]} cy={badge[1]} r={10.5} fill={QUERY} stroke={PAPER} strokeWidth={2} />
          <text x={badge[0]} y={badge[1] + 5.2} textAnchor="middle" fontSize={15} fontWeight={800} fill={PAPER}>
            ?
          </text>
        </g>
      )}
    </g>
  );
}

// ── Folha ───────────────────────────────────────────────────────────────────
export function PlanSheet({ plan: p, interactive = false, marks = {}, onDimTap, focus, query, className, style }) {
  const uid = useId().replace(/:/g, '');
  const h45 = `h45-${uid}`;
  const h135 = `h135-${uid}`;
  const hRing = `hr-${uid}`;
  const clipB = `clipB-${uid}`;
  const titleId = `t-${uid}`;

  const g = useMemo(() => makeGeometry(p), [p]);
  const masses = useMemo(() => planMasses(p), [p]);
  const { fx, fz, sx, ty, LUG_X0, LUG_X1, LUG_Y0, LUG_Y1, G_X0, G_X1, PIN_X, cx, cy, ringR, pinR, holeR, holeXs, holeYs } = g;
  const { zHoleTop, zHoleBot, zRingTop, zRingBot, top, gTop } = g;
  const snipe = p.snipe;
  const legLug = p.weldLug * Math.SQRT2;
  const legRing = K * p.weldRing * Math.SQRT2;
  const T = (id) => dimText(p, id);

  // Detalhe B (escala 1:2 → 1 unidade por mm), centrado no recorte da nervura da frente
  const DFACE = 662.5;
  const DBASE = 620;
  const dx = (Y) => DFACE + (LUG_Y0 - Y);
  const dz = (Z) => DBASE - (Z - p.T);
  const tolX = 872;

  // Centroide da nervura de trás (balão 3)
  const backG = [(2 * sx(LUG_Y1) + sx(LUG_Y1 + p.gL)) / 3, (gTop + 2 * fz(p.T)) / 3];

  const focusRect = focus ? focusBox(focus, g) : null;

  return (
    <PlanCtx.Provider value={{ interactive, marks, onTap: onDimTap }}>
      <svg
        viewBox="0 0 1188 840"
        role="img"
        aria-labelledby={titleId}
        className={className}
        style={{ userSelect: 'none', WebkitUserSelect: 'none', ...style }}
        fontFamily={FONT}
        data-variant={p.code}
      >
        <title id={titleId}>
          Plano {DRAWING.number}, variante {p.code}: {DRAWING.title.toLowerCase()} — vista frontal, corte A–A, planta e detalhe B
        </title>
        <defs>
          <pattern id={h45} width="4.5" height="4.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4.5" stroke={INK} strokeWidth="0.55" />
          </pattern>
          <pattern id={h135} width="4.5" height="4.5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="4.5" stroke={INK} strokeWidth="0.55" />
          </pattern>
          <pattern id={hRing} width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="2.6" stroke={INK} strokeWidth="0.5" />
          </pattern>
          <clipPath id={clipB}>
            <circle cx={680} cy={600} r={72} />
          </clipPath>
        </defs>

        {/* Papel, moldura (ISO 5457) e marcas de centragem */}
        <rect width={1188} height={840} fill={PAPER} />
        <rect x={40} y={20} width={1128} height={800} fill="none" stroke={INK} strokeWidth={1.4} />
        <g stroke={INK} strokeWidth={1.4}>
          <line x1={614} y1={0} x2={614} y2={20} />
          <line x1={614} y1={820} x2={614} y2={840} />
          <line x1={0} y1={420} x2={40} y2={420} />
          <line x1={1168} y1={420} x2={1188} y2={420} />
        </g>

        {/* ════════════ VISTA FRONTAL ════════════ */}
        <g>
          <rect x={fx(0)} y={fz(p.T)} width={K * p.L} height={K * p.T} fill={PAPER} stroke={INK} strokeWidth={THICK} />
          <polygon
            points={pts([
              [fx(LUG_X0), fz(p.T)],
              [fx(LUG_X1), fz(p.T)],
              [fx(LUG_X1), fz(p.H - p.chamfer)],
              [fx(LUG_X1 - p.chamfer), top],
              [fx(LUG_X0 + p.chamfer), top],
              [fx(LUG_X0), fz(p.H - p.chamfer)],
            ])}
            fill={PAPER}
            stroke={INK}
            strokeWidth={THICK}
            strokeLinejoin="round"
          />
          {[G_X0, G_X1 - p.gT].map((x) => (
            <rect key={x} x={fx(x)} y={gTop} width={K * p.gT} height={K * p.gH} fill={PAPER} stroke={INK} strokeWidth={THICK} />
          ))}
          <circle cx={cx} cy={cy} r={ringR} fill={PAPER} stroke={INK} strokeWidth={THICK} />
          <circle cx={cx} cy={cy} r={pinR} fill={PAPER} stroke={INK} strokeWidth={THICK} />
          {/* furos da placa base — invisíveis */}
          <g stroke={INK} strokeWidth={THIN} strokeDasharray="3 2">
            {holeXs
              .flatMap((x) => [x - p.holeD / 2, x + p.holeD / 2])
              .map((x) => (
                <line key={x} x1={fx(x)} y1={fz(p.T)} x2={fx(x)} y2={fz(0)} />
              ))}
          </g>
          {/* eixos */}
          <g stroke={INK} strokeWidth={0.6} strokeDasharray={CHAIN}>
            {holeXs.map((x) => (
              <line key={x} x1={fx(x)} y1={fz(p.T) - 7} x2={fx(x)} y2={fz(0) + 7} />
            ))}
            <line x1={cx - ringR - 8} y1={cy} x2={cx + ringR + 8} y2={cy} />
            <line x1={cx} y1={top - 18} x2={cx} y2={fz(0) + 18} />
          </g>
        </g>

        {/* Linha de corte A–A (ISO 128): grossa nas pontas, setas = sentido de observação */}
        <g>
          <line x1={cx} y1={top - 18} x2={cx} y2={top - 6} stroke={INK} strokeWidth={2.6} />
          <line x1={cx} y1={fz(0) + 6} x2={cx} y2={fz(0) + 18} stroke={INK} strokeWidth={2.6} />
          {[top - 16, fz(0) + 16].map((y) => (
            <g key={y}>
              <line x1={cx} y1={y} x2={cx + 18} y2={y} stroke={INK} strokeWidth={THIN} />
              <Arrow tip={[cx + 21, y]} dir={[1, 0]} size={10} spread={3} />
              <text x={cx + 25} y={y + 5.5} fontSize={15} fontWeight={700} fill={INK}>
                A
              </text>
            </g>
          ))}
        </g>

        {/* Cotas — vista frontal */}
        <HDim id="f-length" x1={fx(0)} x2={fx(p.L)} y={418} from1={384} from2={384} label={T('f-length')} labelX={cx - 40} />
        <HDim
          id="f-lug-width"
          x1={fx(LUG_X0)}
          x2={fx(LUG_X1)}
          y={top - 44}
          from1={fz(p.H - p.chamfer) - 4}
          from2={fz(p.H - p.chamfer) - 4}
          label={T('f-lug-width')}
          labelX={cx - 40}
        />
        <HDim
          id="f-chamfer"
          x1={fx(LUG_X1 - p.chamfer)}
          x2={fx(LUG_X1)}
          y={top - 22}
          from1={top - 4}
          label={T('f-chamfer')}
          labelX={fx(LUG_X1) + 6}
          anchor="start"
        />
        <VDim id="f-base-t" y1={fz(p.T)} y2={fz(0)} x={146} from1={166} from2={166} label={T('f-base-t')} outside />
        <VDim id="f-pin-z" y1={cy} y2={fz(0)} x={124} from1={cx - ringR - 4} from2={166} label={T('f-pin-z')} />
        <VDim
          id="f-height"
          y1={top}
          y2={fz(0)}
          x={102}
          from1={fx(LUG_X0 + p.chamfer) - 4}
          from2={166}
          label={T('f-height')}
          labelY={(top + cy) / 2}
        />
        <Leader
          id="f-ring-d"
          tip={[cx + ringR * Math.cos((240 * Math.PI) / 180), cy - ringR * Math.sin((240 * Math.PI) / 180)]}
          knee={[cx - 34, cy + 52]}
          to={cx - 70}
          label={T('f-ring-d')}
        />
        <Leader
          id="f-pin-d"
          tip={[cx + pinR * Math.SQRT1_2, cy + pinR * Math.SQRT1_2]}
          knee={[cx + 36, cy + 52]}
          to={cx + 70}
          label={T('f-pin-d')}
        />

        {/* Solda W1 — olhal / placa base: filete dos dois lados (processo pela nota 3) */}
        <g>
          <polyline points={pts([g.w1.tip, g.w1.knee, [g.w1.refTo, g.w1.knee[1]]])} fill="none" stroke={INK} strokeWidth={THIN} />
          <Arrow tip={g.w1.tip} dir={unit(g.w1.knee, g.w1.tip)} />
          <FilletSymbol x={g.w1.sym} y={g.w1.knee[1]} up />
          <FilletSymbol x={g.w1.sym} y={g.w1.knee[1]} up={false} />
          <g fontSize={11.5} fill={INK} textAnchor="end">
            <text x={g.w1.sym - 3} y={g.w1.knee[1] - 3}>
              a{p.weldLug}
            </text>
            <text x={g.w1.sym - 3} y={g.w1.knee[1] + 12}>
              a{p.weldLug}
            </text>
          </g>
        </g>

        {/* ════════════ CORTE A–A ════════════ */}
        <text x={sx(p.W / 2)} y={top - 56} textAnchor="middle" fontSize={16} fontWeight={700} fill={INK}>
          A–A
        </text>
        <g>
          {/* nervuras além do plano de corte (vistas, sem tracejado) */}
          <polygon
            points={pts([
              [sx(LUG_Y1), gTop],
              [sx(LUG_Y1), fz(p.T + snipe)],
              [sx(LUG_Y1 + snipe), fz(p.T)],
              [sx(LUG_Y1 + p.gL), fz(p.T)],
            ])}
            fill={PAPER}
            stroke={INK}
            strokeWidth={THICK}
            strokeLinejoin="round"
          />
          <polygon
            points={pts([
              [sx(LUG_Y0), gTop],
              [sx(LUG_Y0), fz(p.T + snipe)],
              [sx(LUG_Y0 - snipe), fz(p.T)],
              [sx(LUG_Y0 - p.gL), fz(p.T)],
            ])}
            fill={PAPER}
            stroke={INK}
            strokeWidth={THICK}
            strokeLinejoin="round"
          />
          {/* peças cortadas */}
          <rect x={sx(p.W)} y={fz(p.T)} width={K * p.W} height={K * p.T} fill={`url(#${h45})`} stroke={INK} strokeWidth={THICK} />
          <rect
            x={sx(LUG_Y1)}
            y={top}
            width={K * p.lugT}
            height={K * (p.H - zHoleTop)}
            fill={`url(#${h135})`}
            stroke={INK}
            strokeWidth={THICK}
          />
          <rect
            x={sx(LUG_Y1)}
            y={fz(zHoleBot)}
            width={K * p.lugT}
            height={K * (zHoleBot - p.T)}
            fill={`url(#${h135})`}
            stroke={INK}
            strokeWidth={THICK}
          />
          <rect
            x={sx(LUG_Y0)}
            y={fz(zRingTop)}
            width={K * p.ringT}
            height={K * (zRingTop - zHoleTop)}
            fill={`url(#${hRing})`}
            stroke={INK}
            strokeWidth={THICK}
          />
          <rect
            x={sx(LUG_Y0)}
            y={fz(zHoleBot)}
            width={K * p.ringT}
            height={K * (zHoleBot - zRingBot)}
            fill={`url(#${hRing})`}
            stroke={INK}
            strokeWidth={THICK}
          />
          {/* geratrizes do furo */}
          <g stroke={INK} strokeWidth={THICK}>
            <line x1={sx(LUG_Y1)} y1={fz(zHoleTop)} x2={sx(LUG_Y0 - p.ringT)} y2={fz(zHoleTop)} />
            <line x1={sx(LUG_Y1)} y1={fz(zHoleBot)} x2={sx(LUG_Y0 - p.ringT)} y2={fz(zHoleBot)} />
          </g>
          <line x1={sx(LUG_Y1) - 6} y1={cy} x2={sx(LUG_Y0 - p.ringT) + 6} y2={cy} stroke={INK} strokeWidth={0.6} strokeDasharray={CHAIN} />
          {/* soldas em corte (enegrecidas) */}
          <g fill={INK}>
            {[
              [sx(LUG_Y1), -1],
              [sx(LUG_Y0), 1],
            ].map(([x, s]) => (
              <polygon
                key={x}
                points={pts([
                  [x, fz(p.T)],
                  [x + s * K * legLug, fz(p.T)],
                  [x, fz(p.T) - K * legLug],
                ])}
              />
            ))}
            {[fz(zRingTop), fz(zRingBot)].map((y, i) => {
              const x = sx(LUG_Y0);
              return (
                <polygon
                  key={y}
                  points={pts([
                    [x, y],
                    [x, i === 0 ? y - legRing : y + legRing],
                    [x + legRing, y],
                  ])}
                />
              );
            })}
          </g>
          {/* indicação do detalhe B */}
          <circle cx={sx(LUG_Y0) + 6} cy={fz(p.T) - 6} r={18} fill="none" stroke={INK} strokeWidth={THIN} />
          <text x={sx(LUG_Y0) - 17} y={fz(0) + 21} textAnchor="middle" fontSize={15} fontWeight={700} fill={INK}>
            B
          </text>
        </g>

        {/* Cotas — corte A–A */}
        <HDim
          id="s-lug-t"
          x1={sx(LUG_Y1)}
          x2={sx(LUG_Y0)}
          y={top - 24}
          from1={top - 4}
          from2={top - 4}
          label={T('s-lug-t')}
          labelX={sx(LUG_Y1) - 18}
          anchor="end"
          outside
        />
        <VDim id="s-gusset-h" y1={gTop} y2={fz(p.T)} x={sx(0) + 26} from1={sx(LUG_Y0) + 4} from2={sx(0) + 4} label={T('s-gusset-h')} />
        <HDim id="s-gusset-l" x1={sx(LUG_Y0)} x2={sx(LUG_Y0 - p.gL)} y={404} from1={384} from2={384} label={T('s-gusset-l')} />
        <HDim id="s-width" x1={sx(p.W)} x2={sx(0)} y={428} from1={384} from2={384} label={T('s-width')} />

        {/* Solda W2 — nervuras: filete dos dois lados */}
        <g>
          <polyline points={pts([g.w2.tip, g.w2.knee, [g.w2.knee[0] - 60, g.w2.knee[1]]])} fill="none" stroke={INK} strokeWidth={THIN} />
          <Arrow tip={g.w2.tip} dir={unit(g.w2.knee, g.w2.tip)} />
          <FilletSymbol x={g.w2.sym} y={g.w2.knee[1]} up />
          <FilletSymbol x={g.w2.sym} y={g.w2.knee[1]} up={false} />
          <g fontSize={11.5} fill={INK} textAnchor="end">
            <text x={g.w2.sym - 3} y={g.w2.knee[1] - 3}>
              a{p.weldGusset}
            </text>
            <text x={g.w2.sym - 3} y={g.w2.knee[1] + 12}>
              a{p.weldGusset}
            </text>
          </g>
        </g>

        {/* Solda W3 — anel: filete do lado da seta, todo o contorno (sistema A: linha tracejada) */}
        <g>
          <line x1={g.w3.knee[0]} y1={g.w3.knee[1]} x2={g.w3.tip[0]} y2={g.w3.tip[1]} stroke={INK} strokeWidth={THIN} />
          <Arrow tip={g.w3.tip} dir={unit(g.w3.knee, g.w3.tip)} />
          <line x1={g.w3.knee[0]} y1={g.w3.knee[1]} x2={g.w3.end} y2={g.w3.knee[1]} stroke={INK} strokeWidth={THIN} />
          <line
            x1={g.w3.knee[0] + 8}
            y1={g.w3.knee[1] + 5}
            x2={g.w3.end}
            y2={g.w3.knee[1] + 5}
            stroke={INK}
            strokeWidth={THIN}
            strokeDasharray="4 2.5"
          />
          <circle cx={g.w3.knee[0]} cy={g.w3.knee[1]} r={4} fill={PAPER} stroke={INK} strokeWidth={THIN} />
          <FilletSymbol x={g.w3.sym} y={g.w3.knee[1]} up />
          <text x={g.w3.sym - 3} y={g.w3.knee[1] - 3} textAnchor="end" fontSize={11.5} fill={INK}>
            a{p.weldRing}
          </text>
        </g>

        <Balloon n={1} c={[sx(p.W) - 16, fz(0) + 16]} to={[sx(p.W) + 12, fz(p.T / 2)]} />
        <Balloon n={2} c={[sx(LUG_Y1) - 49, top + 12]} to={[sx(LUG_Y1) + 3, top + 22]} />
        <Balloon n={3} c={[sx(LUG_Y1 + p.gL) + 19, gTop + 2]} to={backG} />
        <Balloon n={4} c={[sx(LUG_Y0) + 60, fz(zRingBot) - 34]} to={[sx(LUG_Y0) + 5, fz(zRingBot) - 8]} />

        {/* ════════════ PLANTA (por baixo da vista frontal — 1.º diedro) ════════════ */}
        <g>
          <rect x={fx(0)} y={ty(p.W)} width={K * p.L} height={K * p.W} fill={PAPER} stroke={INK} strokeWidth={THICK} />
          {holeXs.flatMap((x) =>
            holeYs.map((y) => <circle key={`${x}-${y}`} cx={fx(x)} cy={ty(y)} r={holeR} fill={PAPER} stroke={INK} strokeWidth={THICK} />),
          )}
          {[
            [G_X0, LUG_Y1, LUG_Y1 + p.gL],
            [G_X1 - p.gT, LUG_Y1, LUG_Y1 + p.gL],
            [G_X0, LUG_Y0 - p.gL, LUG_Y0],
            [G_X1 - p.gT, LUG_Y0 - p.gL, LUG_Y0],
          ].map(([x, y0, y1]) => (
            <rect
              key={`${x}-${y0}`}
              x={fx(x)}
              y={ty(y1)}
              width={K * p.gT}
              height={K * (y1 - y0)}
              fill={PAPER}
              stroke={INK}
              strokeWidth={THICK}
            />
          ))}
          <rect x={fx(LUG_X0)} y={ty(LUG_Y1)} width={K * p.lugW} height={K * p.lugT} fill={PAPER} stroke={INK} strokeWidth={THICK} />
          <rect
            x={fx(PIN_X - p.ringD / 2)}
            y={ty(LUG_Y0)}
            width={K * p.ringD}
            height={K * p.ringT}
            fill={PAPER}
            stroke={INK}
            strokeWidth={THICK}
          />
          <g stroke={INK} strokeWidth={THICK}>
            <line x1={fx(LUG_X0 + p.chamfer)} y1={ty(LUG_Y1)} x2={fx(LUG_X0 + p.chamfer)} y2={ty(LUG_Y0)} />
            <line x1={fx(LUG_X1 - p.chamfer)} y1={ty(LUG_Y1)} x2={fx(LUG_X1 - p.chamfer)} y2={ty(LUG_Y0)} />
          </g>
          <g stroke={INK} strokeWidth={THIN} strokeDasharray={HIDDEN}>
            <line x1={fx(PIN_X - p.pinD / 2)} y1={ty(LUG_Y1)} x2={fx(PIN_X - p.pinD / 2)} y2={ty(LUG_Y0 - p.ringT)} />
            <line x1={fx(PIN_X + p.pinD / 2)} y1={ty(LUG_Y1)} x2={fx(PIN_X + p.pinD / 2)} y2={ty(LUG_Y0 - p.ringT)} />
          </g>
          <g stroke={INK} strokeWidth={0.6} strokeDasharray={CHAIN}>
            {holeXs.flatMap((x) =>
              holeYs.map((y) => (
                <g key={`c-${x}-${y}`}>
                  <line x1={fx(x) - 11} y1={ty(y)} x2={fx(x) + 11} y2={ty(y)} />
                  <line x1={fx(x)} y1={ty(y) - 11} x2={fx(x)} y2={ty(y) + 11} />
                </g>
              )),
            )}
            <line x1={cx} y1={440} x2={cx} y2={ty(0) + 5} />
            <line x1={160} y1={ty(p.W / 2)} x2={fx(p.L) + 10} y2={ty(p.W / 2)} />
          </g>
        </g>

        {/* Cotas — planta */}
        <VDim
          id="t-holes-w"
          y1={ty(holeYs[1])}
          y2={ty(holeYs[0])}
          x={146}
          from1={fx(holeXs[0]) - 12}
          from2={fx(holeXs[0]) - 12}
          label={T('t-holes-w')}
        />
        <Leader
          id="t-holes"
          tip={[fx(holeXs[0]) - holeR * Math.SQRT1_2, ty(holeYs[0]) + holeR * Math.SQRT1_2]}
          knee={[156, ty(0) + 24]}
          to={102}
          label={T('t-holes')}
        />
        <HDim
          id="t-gussets"
          x1={fx(G_X0)}
          x2={fx(G_X1)}
          y={ty(0) + 24}
          from1={ty(LUG_Y0 - p.gL) + 4}
          from2={ty(LUG_Y0 - p.gL) + 4}
          label={T('t-gussets')}
        />
        <HDim
          id="t-holes-l"
          x1={fx(holeXs[0])}
          x2={fx(holeXs[1])}
          y={ty(0) + 50}
          from1={ty(holeYs[0]) + holeR + 3}
          from2={ty(holeYs[0]) + holeR + 3}
          label={T('t-holes-l')}
        />

        {/* ════════════ DETALHE B (1:2) ════════════ */}
        <text x={680} y={516} textAnchor="middle" fontSize={15} fontWeight={700} fill={INK}>
          B (1:2)
        </text>
        <g clipPath={`url(#${clipB})`}>
          <rect x={560} y={DBASE} width={240} height={p.T} fill={`url(#${h45})`} stroke={INK} strokeWidth={THICK} />
          <rect x={dx(LUG_Y1)} y={500} width={p.lugT} height={DBASE - 500} fill={`url(#${h135})`} stroke={INK} strokeWidth={THICK} />
          <polygon
            points={pts([
              [DFACE, 500],
              [DFACE, dz(p.T + snipe)],
              [dx(LUG_Y0 - snipe), DBASE],
              [800, DBASE],
              [800, 500],
            ])}
            fill={PAPER}
            stroke={INK}
            strokeWidth={THICK}
            strokeLinejoin="round"
          />
          <polygon
            points={pts([
              [dx(LUG_Y1), 500],
              [dx(LUG_Y1), dz(p.T + snipe)],
              [dx(LUG_Y1 + snipe), DBASE],
              [560, DBASE],
              [560, 500],
            ])}
            fill={PAPER}
            stroke={INK}
            strokeWidth={THICK}
            strokeLinejoin="round"
          />
          <g fill={INK}>
            <polygon
              points={pts([
                [DFACE, DBASE],
                [DFACE + legLug, DBASE],
                [DFACE, DBASE - legLug],
              ])}
            />
            <polygon
              points={pts([
                [dx(LUG_Y1), DBASE],
                [dx(LUG_Y1) - legLug, DBASE],
                [dx(LUG_Y1), DBASE - legLug],
              ])}
            />
          </g>
        </g>
        <circle cx={680} cy={600} r={72} fill="none" stroke={INK} strokeWidth={THIN} />
        <Leader id="d-snipe" tip={[DFACE + snipe / 2, DBASE - snipe / 2]} knee={[700, 580]} to={746} label={T('d-snipe')} />

        {/* ════════════ NOTAS ════════════ */}
        <g fill={INK}>
          <text x={tolX} y={50} fontSize={12} fontWeight={700} letterSpacing={0.6}>
            NOTAS
          </text>
          <g fontSize={10.5}>
            {[
              '1. Cotas em mm. NÃO MEDIR SOBRE O DESENHO.',
              '2. Simbologia de soldagem: EN ISO 2553',
              '    (sistema A).',
              '3. Processo de soldagem: 135 (EN ISO 4063),',
              '    salvo indicação em contrário.',
              '4. Nível de qualidade das soldas: EN ISO 5817-C.',
              '5. Tolerâncias gerais: EN ISO 13920-BF.',
              '6. Classe de execução: EXC2 (EN 1090-2).',
              '7. Material: EN 10025-2. Quebrar arestas vivas.',
            ].map((line, i) => (
              <text key={line} x={tolX} y={74 + i * 15} xmlSpace="preserve" fontWeight={i === 0 ? 700 : 400}>
                {line}
              </text>
            ))}
          </g>
        </g>

        {/* Tabela de tolerâncias gerais */}
        <g>
          <text x={tolX} y={226} fontSize={10.5} fontWeight={700} fill={INK}>
            TOLERÂNCIAS GERAIS — EN ISO 13920
          </text>
          <text x={tolX} y={240} fontSize={9.5} fill={INK}>
            Classe B · comprimentos (mm)
          </text>
          <rect x={tolX} y={248} width={288} height={16} fill="#eef0f3" stroke={INK} strokeWidth={THIN} />
          <text x={tolX + 5} y={259.5} fontSize={8.5} fontWeight={700} fill={INK}>
            FAIXA NOMINAL (mm)
          </text>
          <text x={tolX + 195} y={259.5} fontSize={8.5} fontWeight={700} fill={INK}>
            TOLERÂNCIA
          </text>
          {ISO13920_B.map((row, i) => {
            const y = 264 + i * 18;
            return (
              <g key={row.label}>
                <rect x={tolX} y={y} width={288} height={18} fill="none" stroke={INK} strokeWidth={THIN} />
                <text x={tolX + 5} y={y + 12.5} fontSize={10} fill={INK}>
                  {row.label}
                </text>
                <text x={tolX + 195} y={y + 12.5} fontSize={10.5} fontWeight={700} fill={INK}>
                  ± {row.tol}
                </text>
              </g>
            );
          })}
          <line x1={tolX + 190} y1={248} x2={tolX + 190} y2={372} stroke={INK} strokeWidth={THIN} />
          <text x={tolX} y={388} fontSize={9} fill={INK}>
            Retitude, planeza e paralelismo: classe F.
          </text>
        </g>

        {/* ════════════ REVISÕES ════════════ */}
        <g fontSize={8.5} fill={INK}>
          <Cell x={808} y={600} w={40} h={13} />
          <Cell x={848} y={600} w={240} h={13} />
          <Cell x={1088} y={600} w={80} h={13} />
          <text x={812} y={609.5} fontWeight={700}>
            REV.
          </text>
          <text x={852} y={609.5} fontWeight={700}>
            DESCRIÇÃO
          </text>
          <text x={1092} y={609.5} fontWeight={700}>
            DATA
          </text>
          {[
            ['A', 'Emissão inicial', '2026-10-20'],
            ['B', `Furo do olhal alterado de Ø${p.pinD - 2} para Ø${p.pinD}`, DRAWING.date],
          ].map(([rev, desc, date], i) => {
            const y = 613 + i * 13;
            return (
              <g key={rev}>
                <Cell x={808} y={y} w={40} h={13} />
                <Cell x={848} y={y} w={240} h={13} />
                <Cell x={1088} y={y} w={80} h={13} />
                <text x={812} y={y + 9.5}>
                  {rev}
                </text>
                <text x={852} y={y + 9.5}>
                  {desc}
                </text>
                <text x={1092} y={y + 9.5}>
                  {date}
                </text>
              </g>
            );
          })}
        </g>

        {/* ════════════ LISTA DE PEÇAS (ISO 7573 — de baixo para cima) ════════════ */}
        <BillOfMaterials p={p} masses={masses} />

        {/* ════════════ LEGENDA (ISO 7200) ════════════ */}
        <g fill={INK}>
          {[
            ['DESENHOU', 'J. Moura'],
            ['VERIFICOU', 'A. Ribeiro'],
            ['APROVOU', 'R. Teixeira'],
            ['DATA', DRAWING.date],
            ['MASSA', `${Math.round(masses.total)} kg`],
            ['FOLHA', '1/1'],
          ].map(([label, value], i) => (
            <Cell key={label} x={808 + i * 60} y={724} w={60} h={20} label={label}>
              <text x={808 + i * 60 + 3} y={740} fontSize={9}>
                {value}
              </text>
            </Cell>
          ))}
          <Cell x={808} y={744} w={250} h={36} label="TÍTULO">
            <text x={812} y={765} fontSize={14} fontWeight={800} letterSpacing={0.3}>
              {DRAWING.title}
            </text>
            <text x={812} y={776} fontSize={8.5}>
              {DRAWING.subtitle} · Prova técnica de caldeiraria
            </text>
          </Cell>
          <Cell x={1058} y={744} w={110} h={36} label="PROPRIETÁRIO">
            <text x={1062} y={769} fontSize={10.5} fontWeight={800} letterSpacing={0.4}>
              MAGNETIC PLACE
            </text>
          </Cell>
          <Cell x={808} y={780} w={48} h={40} label="ESCALA">
            <text x={832} y={810} textAnchor="middle" fontSize={14} fontWeight={700}>
              {DRAWING.scale}
            </text>
          </Cell>
          <Cell x={856} y={780} w={44} h={40} label="FORMATO">
            <text x={878} y={810} textAnchor="middle" fontSize={14} fontWeight={700}>
              {DRAWING.format}
            </text>
          </Cell>
          <Cell x={900} y={780} w={50} h={40} label="PROJEÇÃO">
            <FirstAngleSymbol x={902} y={804} />
          </Cell>
          <Cell x={950} y={780} w={124} h={40} label="Nº DO DESENHO">
            <text x={1012} y={810} textAnchor="middle" fontSize={16} fontWeight={800} letterSpacing={0.6}>
              {DRAWING.number}
            </text>
          </Cell>
          <Cell x={1074} y={780} w={58} h={40} label="VARIANTE">
            <text
              x={1103}
              y={809}
              textAnchor="middle"
              fontSize={12}
              fontWeight={800}
              fontFamily="ui-monospace, monospace"
              letterSpacing={0.8}
            >
              {p.code}
            </text>
          </Cell>
          <Cell x={1132} y={780} w={36} h={40} label="REV.">
            <text x={1150} y={810} textAnchor="middle" fontSize={16} fontWeight={800}>
              {DRAWING.rev}
            </text>
          </Cell>
        </g>

        {focusRect && (
          <rect
            x={focusRect.x}
            y={focusRect.y}
            width={focusRect.w}
            height={focusRect.h}
            rx={8}
            fill="rgba(255,194,14,0.14)"
            stroke="#d99a00"
            strokeWidth={2.6}
            strokeDasharray="7 4"
            className="animate-pulse"
            pointerEvents="none"
            data-focus={focus}
          />
        )}
        {query && <QueryOverlay id={query} g={g} />}
      </svg>
    </PlanCtx.Provider>
  );
}

const BOM_COLS = [
  { key: 'pos', label: 'POS.', x: 808, w: 30 },
  { key: 'qty', label: 'QTD.', x: 838, w: 30 },
  { key: 'name', label: 'DENOMINAÇÃO', x: 868, w: 128 },
  { key: 'mat', label: 'MATERIAL', x: 996, w: 80 },
  { key: 'e', label: 'e (mm)', x: 1076, w: 40 },
  { key: 'mass', label: 'MASSA (kg)', x: 1116, w: 52 },
];

const kg = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function BillOfMaterials({ p, masses }) {
  const header = 708;
  const rows = [
    { pos: 1, qty: 1, name: 'Placa base', e: p.T, mass: masses.base, dim: 'bom-e1' },
    { pos: 2, qty: 1, name: 'Chapa do olhal', e: p.lugT, mass: masses.lug, dim: 'bom-e2' },
    { pos: 3, qty: 4, name: 'Nervura', e: p.gT, mass: masses.gusset, dim: 'bom-e3' },
    { pos: 4, qty: 1, name: 'Anel de reforço', e: p.ringT, mass: masses.ring, dim: 'bom-e4' },
  ];
  return (
    <g fill={INK}>
      {BOM_COLS.map((c) => (
        <g key={c.key}>
          <rect x={c.x} y={header} width={c.w} height={16} fill="#eef0f3" stroke={INK} strokeWidth={THIN} />
          <text x={c.x + 3} y={header + 11} fontSize={7.6} fontWeight={700}>
            {c.label}
          </text>
        </g>
      ))}
      {rows.map((r) => {
        const y = header - 16 * r.pos;
        const eCol = BOM_COLS[4];
        return (
          <g key={r.pos}>
            {BOM_COLS.map((c) => (
              <rect key={c.key} x={c.x} y={y} width={c.w} height={16} fill="none" stroke={INK} strokeWidth={THIN} />
            ))}
            <text x={823} y={y + 12} textAnchor="middle" fontSize={10.5} fontWeight={700}>
              {r.pos}
            </text>
            <text x={853} y={y + 12} textAnchor="middle" fontSize={10.5}>
              {r.qty}
            </text>
            <text x={871} y={y + 12} fontSize={10.5}>
              {r.name}
            </text>
            <text x={999} y={y + 12} fontSize={10.5}>
              S355J2+N
            </text>
            <Target id={r.dim} box={{ x: eCol.x + 1, y: y + 1, w: eCol.w - 2, h: 14 }} label={`e = ${r.e}`}>
              <text x={eCol.x + eCol.w / 2} y={y + 12} textAnchor="middle" fontSize={10.5}>
                {r.e}
              </text>
            </Target>
            <text x={1164} y={y + 12} textAnchor="end" fontSize={10.5}>
              {kg(r.mass)}
            </text>
          </g>
        );
      })}
    </g>
  );
}
