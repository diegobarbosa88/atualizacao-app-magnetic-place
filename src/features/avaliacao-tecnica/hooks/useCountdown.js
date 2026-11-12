import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tempo já contado por pergunta (`persistKey`), para o cronómetro não voltar ao
 * início se o componente for remontado a meio — por exemplo quando o ecrã muda
 * entre o layout de celular e o de tablet ao rodar o aparelho.
 */
const memoria = new Map();

/**
 * Cronômetro regressivo baseado em performance.now() — continua correto mesmo
 * com a aba em segundo plano (onde setInterval é desacelerado).
 * Para reiniciar, remonte o componente (prop `key`) com outra `persistKey`.
 */
export function useCountdown({ durationMs, running, onExpire, persistKey }) {
  const accumulatedRef = useRef(null);
  const expiredRef = useRef(false);
  if (accumulatedRef.current === null) {
    const guardado = persistKey ? memoria.get(persistKey) : null;
    accumulatedRef.current = guardado
      ? guardado.acumulado + (guardado.correndoDesde !== null ? performance.now() - guardado.correndoDesde : 0)
      : 0;
    expiredRef.current = guardado?.expirado ?? false;
  }
  const [elapsedMs, setElapsedMs] = useState(() => Math.min(accumulatedRef.current, durationMs));
  const segmentStartRef = useRef(null);
  const onExpireRef = useRef(onExpire);
  const runningRef = useRef(running);

  useEffect(() => {
    onExpireRef.current = onExpire;
    runningRef.current = running;
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

  // Declarado depois do efeito acima: ao desmontar, o segmento em curso já foi somado.
  useEffect(() => {
    if (!persistKey) return undefined;
    return () => {
      memoria.set(persistKey, {
        acumulado: accumulatedRef.current,
        correndoDesde: runningRef.current ? performance.now() : null,
        expirado: expiredRef.current,
      });
    };
  }, [persistKey]);

  return { elapsedMs, remainingMs: Math.max(0, durationMs - elapsedMs), getElapsedMs };
}
