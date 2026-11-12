import { useLayoutEffect } from 'react';
import { useCountdown } from '../hooks/useCountdown.js';
import { TimerBar } from './ui/TimerBar.jsx';

/**
 * Cronômetro de uma pergunta. Use `key` para reiniciar a cada pergunta
 * sem remontar o resto da tela (o plano mantém zoom e posição).
 */
export function ItemTimer({ durationMs, running, onExpire, elapsedRef, label }) {
  const { remainingMs, getElapsedMs } = useCountdown({ durationMs, running, onExpire });
  useLayoutEffect(() => {
    elapsedRef.current = getElapsedMs;
  }, [elapsedRef, getElapsedMs]);
  return <TimerBar remainingMs={remainingMs} totalMs={durationMs} active={running} label={label} />;
}
