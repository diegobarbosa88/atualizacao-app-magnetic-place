import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/** Degraus dos botões − / +; com a pinça (dois dedos) o zoom é contínuo entre o mínimo e o máximo */
const ZOOMS = [1, 1.5, 2.2, 3, 4];
const ZOOM_MIN = ZOOMS[0];
const ZOOM_MAX = ZOOMS[ZOOMS.length - 1];
const limitar = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/** Proporção da folha (viewBox 1188 × 840 do PlanSheet) */
const SHEET_ASPECT = 1188 / 840;
/** Margem interior do quadro (p-1 dos dois lados) */
const PAD = 8;
/** Abaixo desta largura (em 1×), ecrãs de toque abrem já ampliados para as cotas serem tocáveis */
const TOQUE_MIN_LARGURA = 700;

/** Centra um elemento do plano no quadro, sem mexer na página (só se não estiver visível) */
export function revealInViewer(el) {
  const scroller = el?.closest('[data-plan-scroll]');
  if (!el || !scroller) return;
  const s = scroller.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const visible = r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom;
  if (visible) return;
  scroller.scrollTo({
    left: scroller.scrollLeft + (r.left - s.left) - (s.width - r.width) / 2,
    top: scroller.scrollTop + (r.top - s.top) - (s.height - r.height) / 2,
    behavior: 'smooth',
  });
}

const isCoarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/**
 * Quadro com zoom e deslocamento para o plano. Ocupa toda a caixa onde é posto
 * (o pai define a altura); em 1× a folha inteira cabe na caixa, na largura ou na
 * altura, conforme o que for mais apertado.
 * Toque: desliza com um dedo (scroll nativo) e amplia com dois (pinça) — só o plano,
 * a página não mexe. Mouse: arrastar com o botão esquerdo; Ctrl + roda (ou a pinça do
 * trackpad) amplia o plano. Em ecrãs de toque pequenos (folha com menos de 700 px
 * em 1×) abre com 1,5×, para as cotas terem área de toque suficiente.
 */
export function PlanViewer({ children, className, controlosVerticais = false }) {
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const zoomRef = useRef(zoom);
  const zoomInicialFeito = useRef(false);
  const scrollRef = useRef(null);
  const folhaRef = useRef(null);
  /** Ponto da folha (fração 0–1 da largura/altura) que tem de ficar em (x, y) do quadro depois do zoom */
  const ancora = useRef(null);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  // Largura da folha em 1× — a maior que cabe inteira no quadro
  const [fitWidth, setFitWidth] = useState(null);

  /** Âncora no ponto (x, y) do quadro, com a folha tal como está agora */
  const ancorar = (x, y) => {
    const el = scrollRef.current;
    const folha = folhaRef.current;
    if (!el || !folha) return null;
    const s = el.getBoundingClientRect();
    const r = folha.getBoundingClientRect();
    return {
      u: (s.left + x - r.left - PAD / 2) / Math.max(1, r.width - PAD),
      v: (s.top + y - r.top - PAD / 2) / Math.max(1, r.height - PAD),
      x,
      y,
    };
  };

  /** Desloca o quadro para a âncora voltar a ficar debaixo do seu ponto */
  const posicionar = (a) => {
    const el = scrollRef.current;
    const folha = folhaRef.current;
    if (!el || !folha || !a) return;
    const s = el.getBoundingClientRect();
    const r = folha.getBoundingClientRect();
    el.scrollLeft += r.left + PAD / 2 + a.u * (r.width - PAD) - (s.left + a.x);
    el.scrollTop += r.top + PAD / 2 + a.v * (r.height - PAD) - (s.top + a.y);
  };

  /** Muda o zoom mantendo fixo o ponto (x, y) do quadro — por omissão, o centro */
  const mudarZoom = (novo, x, y) => {
    const el = scrollRef.current;
    const z = limitar(novo);
    if (!el || z === zoomRef.current) return;
    ancora.current = ancorar(x ?? el.clientWidth / 2, y ?? el.clientHeight / 2);
    zoomRef.current = z;
    setZoom(z);
  };
  // Os ouvintes nativos (registados uma vez) chamam sempre a versão mais recente
  const mudarZoomRef = useRef(mudarZoom);
  const posicionarRef = useRef(posicionar);
  useEffect(() => {
    mudarZoomRef.current = mudarZoom;
    posicionarRef.current = posicionar;
  });

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const medir = () => {
      const w = el.clientWidth - PAD;
      const h = el.clientHeight - PAD;
      if (w <= 0 || h <= 0) return;
      const fit = Math.max(160, Math.floor(Math.min(w, h * SHEET_ASPECT)));
      setFitWidth(fit);
      if (!zoomInicialFeito.current) {
        zoomInicialFeito.current = true;
        if (isCoarsePointer() && fit < TOQUE_MIN_LARGURA) {
          ancora.current = { u: 0.5, v: 0.5, x: el.clientWidth / 2, y: el.clientHeight / 2 };
          zoomRef.current = 1.5;
          setZoom(1.5);
        }
      }
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Depois de o zoom mudar, repõe o ponto ancorado no sítio (o dos dedos, do rato ou o centro)
  useLayoutEffect(() => {
    if (!ancora.current) return;
    posicionar(ancora.current);
    ancora.current = null;
  }, [zoom]);

  // Pinça com dois dedos e Ctrl + roda: amplia só o plano. O preventDefault impede o
  // browser de ampliar a página toda; tem de ser um ouvinte nativo não passivo.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let pinca = null;
    let pendente = null;
    let raf = 0;

    const dedos = (t) => {
      const s = el.getBoundingClientRect();
      const [a, b] = [t[0], t[1]];
      return {
        d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        x: (a.clientX + b.clientX) / 2 - s.left,
        y: (a.clientY + b.clientY) / 2 - s.top,
      };
    };
    const aplicar = () => {
      raf = 0;
      if (!pinca || !pendente) return;
      const { z, x, y } = pendente;
      pendente = null;
      // O ponto da folha que estava entre os dedos acompanha-os (amplia e desloca ao mesmo tempo)
      const a = { u: pinca.u, v: pinca.v, x, y };
      const novo = limitar(z);
      if (novo === zoomRef.current) {
        posicionarRef.current(a);
      } else {
        ancora.current = a;
        zoomRef.current = novo;
        setZoom(novo);
      }
    };
    const onStart = (e) => {
      if (e.touches.length !== 2) return;
      const m = dedos(e.touches);
      const s = el.getBoundingClientRect();
      const folha = folhaRef.current?.getBoundingClientRect();
      if (!folha) return;
      pinca = {
        d0: Math.max(m.d, 1),
        z0: zoomRef.current,
        u: (s.left + m.x - folha.left - PAD / 2) / Math.max(1, folha.width - PAD),
        v: (s.top + m.y - folha.top - PAD / 2) / Math.max(1, folha.height - PAD),
      };
    };
    const onMove = (e) => {
      if (e.touches.length < 2) return;
      if (e.cancelable) e.preventDefault();
      if (!pinca) return;
      const m = dedos(e.touches);
      pendente = { z: (pinca.z0 * m.d) / pinca.d0, x: m.x, y: m.y };
      if (!raf) raf = window.requestAnimationFrame(aplicar);
    };
    const onEnd = (e) => {
      if (e.touches.length < 2) pinca = null;
    };
    // Safari (iOS) amplia a página com os seus próprios eventos de gesto
    const bloquear = (e) => e.preventDefault();
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const s = el.getBoundingClientRect();
      mudarZoomRef.current(zoomRef.current * Math.exp(-e.deltaY * 0.01), e.clientX - s.left, e.clientY - s.top);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    el.addEventListener('gesturestart', bloquear);
    el.addEventListener('gesturechange', bloquear);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.cancelAnimationFrame(raf);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('gesturestart', bloquear);
      el.removeEventListener('gesturechange', bloquear);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || zoom <= ZOOM_MIN) return;
    const el = scrollRef.current;
    if (!el) return;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    const el = scrollRef.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 5) d.moved = true;
    if (d.moved) {
      el.scrollLeft = d.left - dx;
      el.scrollTop = d.top - dy;
    }
  };

  const endDrag = () => {
    if (drag.current?.moved) suppressClick.current = true;
    drag.current = null;
  };

  const onClickCapture = (e) => {
    if (suppressClick.current) {
      e.stopPropagation();
      e.preventDefault();
      suppressClick.current = false;
    }
  };

  // Botões: degrau seguinte acima/abaixo do zoom atual (que com a pinça pode estar entre degraus)
  const reduzir = () => mudarZoom([...ZOOMS].reverse().find((z) => z < zoom - 0.01) ?? ZOOM_MIN);
  const ampliar = () => mudarZoom(ZOOMS.find((z) => z > zoom + 0.01) ?? ZOOM_MAX);
  const noMinimo = zoom <= ZOOM_MIN + 0.001;
  const noMaximo = zoom >= ZOOM_MAX - 0.001;

  return (
    <div className={cn('relative h-full overflow-hidden rounded-2xl bg-mp-navy-100 ring-1 ring-mp-borda', className)}>
      <div
        ref={scrollRef}
        data-plan-scroll
        className={cn(
          // pan-x pan-y: o browser desliza o plano com um dedo, mas não amplia a página com dois
          'flex h-full touch-pan-x touch-pan-y overflow-auto overscroll-contain',
          !noMinimo && 'cursor-grab active:cursor-grabbing',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
      >
        {/* margin:auto centra a folha quando é menor que o quadro e, ao ampliar,
            deixa-a crescer a partir do canto (sem cortar o topo/esquerda) */}
        <div ref={folhaRef} className="m-auto shrink-0 p-1" style={{ width: fitWidth ? fitWidth * zoom + PAD : '100%' }}>
          <div className="shadow-md">{children}</div>
        </div>
      </div>

      {/* No celular ficam na vertical, à direita: em cima está a pergunta e em baixo a resposta */}
      <div
        className={cn(
          'absolute flex items-center gap-1 rounded-xl bg-mp-navy-800/90 p-1 text-white shadow-lg backdrop-blur',
          controlosVerticais ? 'right-2 top-1/2 -translate-y-1/2 flex-col' : 'bottom-3 left-3',
        )}
      >
        <button
          type="button"
          onClick={reduzir}
          disabled={noMinimo}
          className="grid size-11 place-items-center rounded-lg transition hover:bg-white/15 disabled:opacity-35"
          aria-label="Reduzir plano"
        >
          <Minus className="size-5" />
        </button>
        <span className={cn('text-center font-mono font-bold tabular-nums', controlosVerticais ? 'w-10 text-xs' : 'w-12 text-sm')}>
          {zoom.toFixed(1).replace('.', ',')}×
        </span>
        <button
          type="button"
          onClick={ampliar}
          disabled={noMaximo}
          className="grid size-11 place-items-center rounded-lg transition hover:bg-white/15 disabled:opacity-35"
          aria-label="Ampliar plano"
        >
          <Plus className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => mudarZoom(ZOOM_MIN)}
          disabled={noMinimo}
          className="grid size-11 place-items-center rounded-lg transition hover:bg-white/15 disabled:opacity-35"
          aria-label="Ver o plano inteiro"
        >
          <Maximize className="size-5" />
        </button>
      </div>
    </div>
  );
}
