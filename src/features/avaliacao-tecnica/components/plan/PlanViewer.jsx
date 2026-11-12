import { useLayoutEffect, useRef, useState } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/cn.js';

const ZOOMS = [1, 1.5, 2.2, 3];

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
 * Quadro com zoom e deslocamento para o plano.
 * Toque: desliza com o dedo (scroll nativo). Mouse: arrastar com o botão esquerdo.
 * Em ecrãs de toque abre com 1,5× para as cotas terem área de toque suficiente.
 */
export function PlanViewer({ children, className, heightClass = 'h-[70vh]' }) {
  const [zoomIndex, setZoomIndex] = useState(() => (isCoarsePointer() ? 1 : 0));
  const scrollRef = useRef(null);
  const prevZoom = useRef(ZOOMS[zoomIndex]);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const zoom = ZOOMS[zoomIndex];

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
    <div className={cn('relative overflow-hidden rounded-2xl bg-slate-300 ring-1 ring-slate-300', className)}>
      <div
        ref={scrollRef}
        data-plan-scroll
        className={cn('overflow-auto overscroll-contain', heightClass, zoom > 1 && 'cursor-grab active:cursor-grabbing')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
      >
        <div className="p-2 sm:p-3" style={{ width: `${zoom * 100}%` }}>
          <div className="shadow-md">{children}</div>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-xl bg-slate-900/90 p-1 text-white shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => setZoomIndex((z) => Math.max(0, z - 1))}
          disabled={zoomIndex === 0}
          className="grid size-11 place-items-center rounded-lg transition hover:bg-white/15 disabled:opacity-35"
          aria-label="Reduzir plano"
        >
          <Minus className="size-5" />
        </button>
        <span className="w-12 text-center font-mono text-sm font-bold tabular-nums">{zoom.toFixed(1).replace('.', ',')}×</span>
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
