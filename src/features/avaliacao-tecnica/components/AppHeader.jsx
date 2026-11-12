import { Check, LogOut, Volume2, VolumeX } from 'lucide-react';
import { LEVEL_LABELS } from '../config.js';
import { cn } from '../lib/cn.js';
import { isInProgress, useAssessmentStore } from '../store/useAssessmentStore.js';
import { Marca } from './Marca.jsx';
import { Button } from './ui/Button.jsx';

const STEPS = [
  { stage: 'phase1', label: 'Localizar' },
  { stage: 'phase2', label: 'Calcular' },
  { stage: 'phase3', label: 'Simbologia' },
  { stage: 'results', label: 'Envio' },
];

/**
 * Cabeçalho da prova. Durante as fases fica numa linha só (logótipo, fases e
 * botões), para o plano ficar com o máximo de altura.
 */
export function AppHeader({ onExit }) {
  const stage = useAssessmentStore((s) => s.stage);
  const candidate = useAssessmentStore((s) => s.candidate);
  const soundEnabled = useAssessmentStore((s) => s.soundEnabled);
  const toggleSound = useAssessmentStore((s) => s.toggleSound);
  const inProgress = isInProgress(stage);
  const currentIndex = STEPS.findIndex((s) => s.stage === stage);

  return (
    <header className="shrink-0 bg-mp-navy-800 text-white shadow-lg print:hidden">
      <div className={cn('flex items-center gap-3 px-3 sm:px-4', inProgress ? 'py-1' : 'py-2.5 baixo:py-1')}>
        <div className="min-w-0 flex-1">
          <Marca compacto={inProgress} />
        </div>

        {stage !== 'start' && (
          <ol aria-label="Progresso da avaliação" className="hidden shrink-0 items-center gap-1 md:flex">
            {STEPS.map((step, i) => {
              const done = i < currentIndex;
              const current = i === currentIndex;
              return (
                <li
                  key={step.stage}
                  aria-current={current ? 'step' : undefined}
                  title={step.label}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-full font-mono text-xs font-bold',
                    current && 'bg-mp-orange-400 pl-0.5 pr-3 text-mp-navy-800',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full',
                      done && 'bg-emerald-500 text-white',
                      current && 'bg-mp-navy-800 text-mp-orange-400',
                      !done && !current && 'bg-white/10 text-white/60',
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  {current && <span className="font-sans text-sm">{step.label}</span>}
                </li>
              );
            })}
          </ol>
        )}

        {candidate && stage !== 'start' && (
          <div className="hidden min-w-0 text-right xl:block">
            <p className="max-w-56 truncate text-sm font-semibold leading-tight">{candidate.fullName}</p>
            <p className="font-mono text-xs text-mp-navy-200">
              {candidate.internalId} · {LEVEL_LABELS[candidate.level]}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={toggleSound}
          className={cn(
            'grid place-items-center rounded-xl text-mp-navy-100 transition hover:bg-white/10',
            inProgress ? 'size-10' : 'size-11',
          )}
          aria-label={soundEnabled ? 'Desativar som' : 'Ativar som'}
          aria-pressed={soundEnabled}
        >
          {soundEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>

        {inProgress && (
          <Button variant="ghost" size="sm" onClick={onExit} icon={<LogOut className="size-4" />} aria-label="Encerrar prova">
            <span className="hidden sm:inline">Encerrar</span>
          </Button>
        )}
      </div>
      <div className="faixa-marca h-[3px]" aria-hidden />
    </header>
  );
}
