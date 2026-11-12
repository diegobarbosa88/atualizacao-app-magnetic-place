import { useEffect } from 'react';
import { Timer } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { formatClock } from '../../lib/format.js';
import { sfx } from '../../lib/sound.js';

export function TimerBar({ remainingMs, totalMs, active, label = 'Tempo restante' }) {
  const ratio = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const critical = ratio <= 0.2;
  const finalSeconds = active && secondsLeft > 0 && secondsLeft <= 5;

  useEffect(() => {
    if (finalSeconds) sfx.tick();
  }, [finalSeconds, secondsLeft]);

  return (
    <div className="flex items-center gap-3" role="timer" aria-label={`${label}: ${secondsLeft} segundos`}>
      <Timer
        className={cn('size-7 shrink-0 baixo:size-5', critical ? 'text-red-500' : 'text-slate-400', finalSeconds && 'animate-pulse')}
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
          <span className={cn('font-mono text-2xl font-bold tabular-nums baixo:text-lg', critical ? 'text-red-600' : 'text-slate-900')}>
            {formatClock(remainingMs)}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-100 ease-linear',
              ratio > 0.5 ? 'bg-mp-navy-500' : critical ? 'bg-red-500' : 'bg-mp-orange-400',
            )}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
