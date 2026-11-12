import { useLayoutEffect, useRef, useState } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/cn.js';

const ZOOMS = [1, 1.5, 2.2, 3];

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
 * Toque: desliza com o dedo (scroll nativo). Mouse: arrastar com o botão esquerdo.
 * Em ecrãs de toque pequenos (folha com menos de 700 px em 1×) abre com 1,5×,
 * para as cotas terem área de toque suficiente; nos tablets abre com a folha inteira.
 */
export function PlanViewer({ children, className, controlosVerticais = false }) {
  const [zoomIndex, setZoomIndex] = useState(0);
  const zoomInicialFeito = useRef(false);
  const scrollRef = useRef(null);
  const prevZoom = useRef(ZOOMS[zoomIndex]);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const zoom = ZOOMS[zoomIndex];
  // Largura da folha em 1× — a maior que cabe inteira no quadro
  const [fitWidth, setFitWidth] = useState(null);

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
        if (isCoarsePointer() && fit < TOQUE_MIN_LARGURA) setZoomIndex(1);
      }
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mantém o centro visível ao mudar o zoom
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const prev = prevZoom.current;
    if (!el || prev === zoom) return;
    const ratio = zoom / prev;
    el.scrollLeft = (el.scrollLeft + el.clientWidth / 2) * ratio - el.clientWidth / 2;
    el.scrollTop = (el.scrollTop + el.clientHeight / 2) * ratio - el.clientHeight / 2;
    prevZoom.current = zoom;
  }, [zoom]);

  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || zoom === 1) return;
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

  return (
    <div className={cn('relative h-full overflow-hidden rounded-2xl bg-mp-navy-100 ring-1 ring-mp-borda', className)}>
      <div
        ref={scrollRef}
        data-plan-scroll
        className={cn('flex h-full overflow-auto overscroll-contain', zoom > 1 && 'cursor-grab active:cursor-grabbing')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
      >
        {/* margin:auto centra a folha quando é menor que o quadro e, ao ampliar,
            deixa-a crescer a partir do canto (sem cortar o topo/esquerda) */}
        <div className="m-auto shrink-0 p-1" style={{ width: fitWidth ? fitWidth * zoom + PAD : '100%' }}>
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
          onClick={() => setZoomIndex((z) => Math.max(0, z - 1))}
          disabled={zoomIndex === 0}
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
          onClick={() => setZoomIndex((z) => Math.min(ZOOMS.length - 1, z + 1))}
          disabled={zoomIndex === ZOOMS.length - 1}
          className="grid size-11 place-items-center rounded-lg transition hover:bg-white/15 disabled:opacity-35"
          aria-label="Ampliar plano"
        >
          <Plus className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setZoomIndex(0)}
          disabled={zoomIndex === 0}
          className="grid size-11 place-items-center rounded-lg transition hover:bg-white/15 disabled:opacity-35"
          aria-label="Ver o plano inteiro"
        >
          <Maximize className="size-5" />
        </button>
      </div>
    </div>
  );
}
