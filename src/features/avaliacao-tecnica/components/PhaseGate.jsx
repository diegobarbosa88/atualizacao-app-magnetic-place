import { useState } from 'react';
import { Check, Clock, Play } from 'lucide-react';
import { TIMING } from '../config.js';

import { sfx } from '../lib/sound.js';
import { Button } from './ui/Button.jsx';
import { PrepCountdown } from './ui/PrepCountdown.jsx';

/** Instruções da fase → contagem 3-2-1 → conteúdo da fase (cronômetro começa aqui) */
export function PhaseGate({ meta, children }) {
  const [step, setStep] = useState('intro');

  if (step === 'running') return <>{children}</>;

  const Icon = meta.icon;
  return (
    <>
      <div className="mx-auto max-w-2xl pb-6 pt-2">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="bg-mp-navy-800 px-6 py-8 text-center text-white sm:px-10">
            <div className="mx-auto grid size-20 place-items-center rounded-2xl bg-mp-orange-400 text-mp-navy-800">
              <Icon className="size-10" />
            </div>
            <p className="mt-5 text-sm font-bold uppercase tracking-[0.25em] text-mp-orange-400">Fase {meta.number} de 3</p>
            <h2 className="mt-1 text-3xl font-bold">{meta.title}</h2>
            <p className="mt-1 text-mp-navy-100">{meta.subtitle}</p>
          </div>
          <div className="faixa-marca h-[3px]" />
          <div className="space-y-5 p-6 sm:p-8">
            <p className="text-lg font-semibold">{meta.objective}</p>
            <ul className="space-y-3">
              {meta.rules.map((rule) => (
                <li key={rule} className="flex items-start gap-3 text-slate-700">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                    <Check className="size-4" />
                  </span>
                  {rule}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 rounded-xl bg-mp-creme px-4 py-3 text-slate-700">
              <Clock className="size-5 text-mp-navy-600" />
              Tempo da fase: <strong className="font-mono">{meta.durationLabel}</strong>
            </div>
            <Button
              size="xl"
              block
              icon={<Play className="size-6" />}
              onClick={() => {
                sfx.unlock();
                setStep('countdown');
              }}
            >
              Começar Fase {meta.number}
            </Button>
          </div>
        </div>
      </div>
      {step === 'countdown' && (
        <PrepCountdown seconds={TIMING.prepCountdownSec} title={`Fase ${meta.number} · ${meta.title}`} onDone={() => setStep('running')} />
      )}
    </>
  );
}
