import { useRef } from 'react';

export function useDragScroll() {
  const ref       = useRef(null);
  const dragging  = useRef(false);
  const origin    = useRef({ x: 0, y: 0, sl: 0, st: 0 });

  const onMouseDown = e => {
    if (e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    dragging.current = true;
    origin.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
    el.style.cursor     = 'grabbing';
    el.style.userSelect = 'none';
    e.preventDefault();
  };

  const onMouseMove = e => {
    if (!dragging.current || !ref.current) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    ref.current.scrollLeft = origin.current.sl - dx;
    ref.current.scrollTop  = origin.current.st - dy;
  };

  const onMouseUp = () => {
    dragging.current = false;
    if (ref.current) {
      ref.current.style.cursor     = 'grab';
      ref.current.style.userSelect = '';
    }
  };

  const dragProps = {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave: onMouseUp,
    style: { cursor: 'grab' },
  };

  return { ref, dragProps };
}
