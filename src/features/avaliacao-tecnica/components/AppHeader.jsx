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

// Em ecrãs baixos (`baixo:`, telemóvel deitado) o cabeçalho encolhe e a barra
// de fases esconde-se, para sobrar altura para o plano e a pergunta.

export function AppHeader({ onExit }) {
  const stage = useAssessmentStore((s) => s.stage);
  const candidate = useAssessmentStore((s) => s.candidate);
  const soundEnabled = useAssessmentStore((s) => s.soundEnabled);
  const toggleSound = useAssessmentStore((s) => s.toggleSound);
  const inProgress = isInProgress(stage);
  const currentIndex = STEPS.findIndex((s) => s.stage === stage);

  return (
    <header className="shrink-0 bg-mp-navy-800 text-white shadow-lg print:hidden">
      <div className={'mx-auto flex max-w-[96rem] items-center gap-3 px-4 py-2.5 sm:px-6 baixo:py-1'}>
        <div className="min-w-0 flex-1">
          <Marca />
        </div>

        {candidate && stage !== 'start' && (
          <div className="hidden text-right md:block">
            <p className="max-w-56 truncate text-sm font-semibold">{candidate.fullName}</p>
            <p className="font-mono text-xs text-mp-navy-200">
              {candidate.internalId} · {LEVEL_LABELS[candidate.level]}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={toggleSound}
          className="grid size-11 place-items-center rounded-xl text-mp-navy-100 transition hover:bg-white/10"
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
        <nav aria-label="Progresso da avaliação" className={'border-t border-white/10 bg-mp-navy-700 baixo:hidden'}>
          <ol className="mx-auto grid max-w-[96rem] grid-cols-4 gap-2 px-4 py-1.5 sm:px-6">
            {STEPS.map((step, i) => {
              const done = i < currentIndex;
              const current = i === currentIndex;
              return (
                <li key={step.stage} className="flex min-w-0 items-center gap-2" aria-current={current ? 'step' : undefined}>
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs font-bold',
                      done && 'bg-emerald-500 text-white',
                      current && 'bg-mp-orange-400 text-mp-navy-800',
                      !done && !current && 'bg-white/10 text-white/60',
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className={cn('truncate text-xs font-semibold sm:text-sm', current ? 'text-white' : 'text-white/60')}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <div className="faixa-marca h-[3px]" aria-hidden />
    </header>
  );
}
