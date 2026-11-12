import { useLayoutEffect } from 'react';
import { useCountdown } from '../hooks/useCountdown.js';
import { TimerBar } from './ui/TimerBar.jsx';

/**
 * Cronômetro de uma pergunta. Use `key` para reiniciar a cada pergunta
 * sem remontar o resto da tela (o plano mantém zoom e posição).
 * `persistKey` (único por pergunta) mantém o tempo contado se o cronômetro for
 * remontado a meio (ex.: ao recolher a pergunta no celular ou ao rodar o ecrã).
 */
export function ItemTimer({ durationMs, running, onExpire, elapsedRef, label, persistKey, compacto = false }) {
  const { remainingMs, getElapsedMs } = useCountdown({ durationMs, running, onExpire, persistKey });
  useLayoutEffect(() => {
    elapsedRef.current = getElapsedMs;
  }, [elapsedRef, getElapsedMs]);
  return <TimerBar remainingMs={remainingMs} totalMs={durationMs} active={running} label={label} compacto={compacto} />;
}
