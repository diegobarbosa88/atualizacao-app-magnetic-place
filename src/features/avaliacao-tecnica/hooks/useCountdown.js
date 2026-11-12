import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cronômetro regressivo baseado em performance.now() — continua correto mesmo
 * com a aba em segundo plano (onde setInterval é desacelerado).
 * Para reiniciar, remonte o componente (prop `key`).
 */
export function useCountdown({ durationMs, running, onExpire }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const accumulatedRef = useRef(0);
  const segmentStartRef = useRef(null);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  const getElapsedMs = useCallback(() => {
    const live = segmentStartRef.current === null ? 0 : performance.now() - segmentStartRef.current;
    return accumulatedRef.current + live;
  }, []);

  useEffect(() => {
    if (!running) return;
    segmentStartRef.current = performance.now();

    const id = window.setInterval(() => {
      const elapsed = getElapsedMs();
      setElapsedMs(Math.min(elapsed, durationMs));
      if (elapsed >= durationMs && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    }, 100);

    return () => {
      window.clearInterval(id);
      if (segmentStartRef.current !== null) {
        accumulatedRef.current += performance.now() - segmentStartRef.current;
        segmentStartRef.current = null;
      }
    };
  }, [running, durationMs, getElapsedMs]);

  return { elapsedMs, remainingMs: Math.max(0, durationMs - elapsedMs), getElapsedMs };
}
