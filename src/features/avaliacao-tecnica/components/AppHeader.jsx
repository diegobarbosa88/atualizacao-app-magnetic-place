import { Check, HardHat, LogOut, Volume2, VolumeX } from 'lucide-react';
import { LEVEL_LABELS, ORG_NAME, TEST_TITLE } from '../config.js';
import { cn } from '../lib/cn.js';
import { isInProgress, useAssessmentStore } from '../store/useAssessmentStore.js';

import { Button } from './ui/Button.jsx';

const STEPS = [
  { stage: 'phase1', label: 'Localizar' },
  { stage: 'phase2', label: 'Calcular' },
  { stage: 'phase3', label: 'Simbologia' },
  { stage: 'results', label: 'Envio' },
];

export function AppHeader({ onExit }) {
  const stage = useAssessmentStore((s) => s.stage);
  const candidate = useAssessmentStore((s) => s.candidate);
  const soundEnabled = useAssessmentStore((s) => s.soundEnabled);
  const toggleSound = useAssessmentStore((s) => s.toggleSound);
  const inProgress = isInProgress(stage);
  const currentIndex = STEPS.findIndex((s) => s.stage === stage);

  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-lg print:hidden">
      <div className="mx-auto flex max-w-[96rem] items-center gap-3 px-4 py-3 sm:px-6">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-safety-400 text-slate-900">
          <HardHat className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-safety-400">{ORG_NAME}</p>
          <p className="truncate text-base font-bold sm:text-lg">{TEST_TITLE}</p>
        </div>

        {candidate && stage !== 'start' && (
          <div className="hidden text-right md:block">
            <p className="max-w-56 truncate text-sm font-semibold">{candidate.fullName}</p>
            <p className="text-xs text-slate-400">
              ID {candidate.internalId} · {LEVEL_LABELS[candidate.level]}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={toggleSound}
          className="grid size-11 place-items-center rounded-xl text-slate-300 transition hover:bg-white/10"
          aria-label={soundEnabled ? 'Desativar som' : 'Ativar som'}
          aria-pressed={soundEnabled}
        >
          {soundEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>

        {inProgress && (
          <Button variant="ghost" size="md" onClick={onExit} icon={<LogOut className="size-4" />} aria-label="Encerrar prova">
            <span className="hidden sm:inline">Encerrar</span>
          </Button>
        )}
      </div>

      {stage !== 'start' && (
        <nav aria-label="Progresso da avaliação" className="border-t border-white/10 bg-slate-800/70">
          <ol className="mx-auto grid max-w-[96rem] grid-cols-4 gap-2 px-4 py-2 sm:px-6">
            {STEPS.map((step, i) => {
              const done = i < currentIndex;
              const current = i === currentIndex;
              return (
                <li key={step.stage} className="flex min-w-0 items-center gap-2" aria-current={current ? 'step' : undefined}>
                  <span
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                      done && 'bg-emerald-500 text-white',
                      current && 'bg-safety-400 text-slate-900',
                      !done && !current && 'bg-slate-700 text-slate-400',
                    )}
                  >
                    {done ? <Check className="size-4" /> : i + 1}
                  </span>
                  <span className={cn('truncate text-xs font-semibold sm:text-sm', current ? 'text-white' : 'text-slate-400')}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <div className="hazard-stripe h-1.5" aria-hidden />
    </header>
  );
}
