import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn.js';
import { sfx } from '../../lib/sound.js';

/** Contagem regressiva de preparação em tela cheia (3, 2, 1, JÁ!) */
export function PrepCountdown({ seconds, title, eyebrow = 'Prepare-se', onDone }) {
  const [n, setN] = useState(seconds);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (n <= 0) {
      sfx.go();
      const t = window.setTimeout(() => onDoneRef.current(), 650);
      return () => window.clearTimeout(t);
    }
    sfx.tick();
    const t = window.setTimeout(() => setN((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  }, [n]);

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-slate-950/95 p-6 text-center text-white"
      role="alertdialog"
      aria-live="assertive"
      aria-label={`${title}: começa em ${n}`}
    >
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-safety-400">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{title}</h2>
        <div
          key={n}
          className={cn(
            'mx-auto mt-10 grid size-44 animate-pop place-items-center rounded-full border-8 font-mono font-black tabular-nums',
            n > 0 ? 'border-safety-400 text-8xl' : 'border-emerald-400 text-6xl text-emerald-300',
          )}
        >
          {n > 0 ? n : 'JÁ!'}
        </div>
        <div className="hazard-stripe mx-auto mt-10 h-2 w-48 rounded-full" />
      </div>
    </div>
  );
}
