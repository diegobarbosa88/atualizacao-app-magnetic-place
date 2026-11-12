import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator as CalculatorIcon, Check, CircleCheck, CircleX, Hourglass, SkipForward } from 'lucide-react';
import { Calculator } from '../components/Calculator.jsx';
import { CARTAO, CELULA_PERGUNTA, CELULA_PLANO, CELULA_RESPOSTA, GRELHA } from '../components/ecraProva.js';
import { ItemTimer } from '../components/ItemTimer.jsx';
import { PlanSheet } from '../components/plan/PlanSheet.jsx';
import { PlanViewer, revealInViewer } from '../components/plan/PlanViewer.jsx';
import { Button } from '../components/ui/Button.jsx';
import { TIMING } from '../config.js';
import { LEVELS } from '../data/levels.js';
import { buildPhase2 } from '../data/phase2.js';
import { parseMillimeters } from '../lib/calculations.js';
import { cn } from '../lib/cn.js';
import { evaluateDerive } from '../lib/evaluators.js';
import { formatMm } from '../lib/format.js';
import { sfx } from '../lib/sound.js';
import { useAssessmentStore } from '../store/useAssessmentStore.js';

export function Phase2Derive() {
  const completePhase2 = useAssessmentStore((s) => s.completePhase2);
  const [index, setIndex] = useState(0);
  const [calcOpen, setCalcOpen] = useState(false);
  const plan = useAssessmentStore((s) => s.plan);
  const level = useAssessmentStore((s) => s.candidate?.level ?? 'pleno');
  const questions = useMemo(() => buildPhase2(plan, level), [plan, level]);
  const question = questions[index];

  // Leva a cota pedida para dentro do quadro quando o plano está ampliado
  useEffect(() => {
    const id = window.requestAnimationFrame(() => revealInViewer(document.querySelector('[data-query]')));
    return () => window.cancelAnimationFrame(id);
  }, [question.query]);

  const next = () => {
    if (index + 1 < questions.length) setIndex(index + 1);
    else completePhase2();
  };

  return (
    <div className={GRELHA}>
      <div className={CELULA_PLANO}>
        <PlanViewer>
          <PlanSheet plan={plan} query={question.query} className="block h-auto w-full" />
        </PlanViewer>
      </div>
      <DerivePanel
        key={question.id}
        question={question}
        index={index}
        total={questions.length}
        calcOpen={calcOpen}
        onToggleCalc={() => setCalcOpen((v) => !v)}
        onDone={next}
      />
    </div>
  );
}

function DerivePanel({ question, index, total, calcOpen, onToggleCalc, onDone }) {
  const recordDerive = useAssessmentStore((s) => s.recordDerive);
  const [raw, setRaw] = useState('');
  const [status, setStatus] = useState('answering');
  const lockedRef = useRef(false);
  const elapsedRef = useRef(() => 0);
  const doneTimer = useRef(null);
  const inputRef = useRef(null);
  const level = useAssessmentStore((s) => s.candidate?.level ?? 'pleno');
  const limitMs = LEVELS[level].phase2.itemSec * 1000;
  const parsed = parseMillimeters(raw);
  const answering = status === 'answering';

  useEffect(
    () => () => {
      if (doneTimer.current !== null) window.clearTimeout(doneTimer.current);
    },
    [],
  );

  const submit = (kind) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    const answer = evaluateDerive(question, {
      rawInput: raw,
      timeMs: Math.min(elapsedRef.current(), limitMs),
      timedOut: kind === 'timeout',
      skipped: kind === 'skip',
    });
    recordDerive(answer);
    const next = kind === 'skip' ? 'skipped' : kind === 'timeout' && !answer.correct ? 'timeout' : answer.correct ? 'correct' : 'wrong';
    setStatus(next);
    if (next === 'correct') sfx.correct();
    else if (next === 'skipped') sfx.move();
    else sfx.wrong();
    doneTimer.current = window.setTimeout(onDone, TIMING.feedbackMs);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (parsed !== null) submit('answer');
  };

  // Duas células da grelha: a pergunta (sempre à vista, com o cronómetro) e a
  // resposta (com deslocamento próprio quando a calculadora está aberta)
  return (
    <>
      <section className={cn(CELULA_PERGUNTA, CARTAO, 'space-y-2.5 baixo:space-y-1.5')}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-mp-navy-600">
              Fase 2 de 3 · Pergunta {index + 1} de {total}
            </p>
            <p className="truncate text-sm font-semibold text-slate-500">{question.topic}</p>
          </div>
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-2 rounded-full',
                  i < index ? 'w-2 bg-mp-navy-300' : i === index ? 'w-6 bg-mp-orange-400' : 'w-2 bg-slate-200',
                )}
              />
            ))}
          </div>
        </div>

        <ItemTimer durationMs={limitMs} running={answering} onExpire={() => submit('timeout')} elapsedRef={elapsedRef} />

        <p className="text-base font-bold leading-snug text-mp-navy-800 sm:text-lg baixo:text-base">{question.prompt}</p>
        <p className="hidden items-center gap-2 text-sm text-slate-600 sm:flex baixo:hidden">
          <span
            className="grid size-5 shrink-0 place-items-center rounded-full bg-mp-orange-400 text-xs font-extrabold text-mp-navy-800"
            aria-hidden
          >
            ?
          </span>
          A medida pedida está marcada em laranja no plano.
        </p>
      </section>

      <div className={CELULA_RESPOSTA}>
        <section className={cn(CARTAO, 'space-y-3')}>
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="relative">
              <label htmlFor="derive-input" className="sr-only">
                Resposta em milímetros
              </label>
              <input
                ref={inputRef}
                id="derive-input"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                value={raw}
                disabled={!answering}
                onChange={(e) => setRaw(e.target.value.replace(/[^\d.,\s]/g, ''))}
                placeholder="0"
                className={cn(
                  'h-16 w-full rounded-2xl border-2 bg-white pl-5 pr-16 font-mono text-3xl font-bold tabular-nums outline-none transition baixo:h-12 baixo:text-2xl',
                  'placeholder:text-slate-300 focus:border-mp-navy-500 focus:ring-4 focus:ring-mp-navy-100 disabled:bg-slate-50',
                  raw && parsed === null ? 'border-red-400' : 'border-slate-300',
                )}
              />
              <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">mm</span>
            </div>
            <p className={cn('min-h-5 text-sm baixo:hidden', raw && parsed === null ? 'font-semibold text-red-600' : 'text-slate-500')}>
              {raw
                ? parsed === null
                  ? 'Formato inválido — use só números e vírgula'
                  : `Valor lido: ${formatMm(parsed, parsed % 1 ? 2 : 0)}`
                : 'Use vírgula para decimais.'}
            </p>

            {answering ? (
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button type="submit" size="lg" className="baixo:min-h-11" disabled={parsed === null} icon={<Check className="size-5" />}>
                  Confirmar
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="baixo:min-h-11"
                  icon={<SkipForward className="size-5" />}
                  onClick={() => submit('skip')}
                >
                  Pular
                </Button>
              </div>
            ) : (
              <Feedback status={status} />
            )}
          </form>

          <div className="border-t border-slate-200 pt-2">
            <button
              type="button"
              onClick={onToggleCalc}
              aria-expanded={calcOpen}
              className="flex min-h-11 w-full items-center justify-between rounded-xl px-2 font-semibold text-slate-700 transition hover:bg-mp-creme"
            >
              <span className="flex items-center gap-2">
                <CalculatorIcon className="size-5 text-mp-navy-600" /> Calculadora
              </span>
              <span className="text-sm text-slate-500">{calcOpen ? 'Esconder' : 'Mostrar'}</span>
            </button>
            {calcOpen && (
              <div className="mt-2">
                <Calculator
                  onUse={(value) => {
                    if (!answering) return;
                    setRaw(value);
                    inputRef.current?.focus({ preventScroll: true });
                  }}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function Feedback({ status }) {
  const map = {
    correct: { cls: 'bg-emerald-100 text-emerald-800', Icon: CircleCheck, text: 'Resposta correta' },
    wrong: { cls: 'bg-red-100 text-red-800', Icon: CircleX, text: 'Resposta incorreta' },
    skipped: { cls: 'bg-slate-100 text-slate-700', Icon: SkipForward, text: 'Pergunta pulada' },
    timeout: { cls: 'bg-mp-orange-100 text-mp-orange-700', Icon: Hourglass, text: 'Tempo esgotado' },
    answering: null,
  }[status];
  if (!map) return null;
  const { cls, Icon, text } = map;
  return (
    <div aria-live="polite" className={cn('flex h-14 animate-pop items-center gap-2 rounded-xl px-4 font-bold', cls)}>
      <Icon className="size-5" /> {text}
      <span className="ml-auto text-sm font-medium opacity-70">Próxima…</span>
    </div>
  );
}
