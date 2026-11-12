import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CircleCheck, CircleX, Hourglass, X } from 'lucide-react';
import { ItemTimer } from '../components/ItemTimer.jsx';
import { PlanSheet } from '../components/plan/PlanSheet.jsx';
import { PlanViewer, revealInViewer } from '../components/plan/PlanViewer.jsx';
import { TIMING } from '../config.js';
import { LEVELS } from '../data/levels.js';
import { buildPhase3 } from '../data/phase3.js';
import { shuffle } from '../lib/calculations.js';
import { cn } from '../lib/cn.js';
import { sfx } from '../lib/sound.js';
import { useAssessmentStore } from '../store/useAssessmentStore.js';

export function Phase3Symbols() {
  const finishAssessment = useAssessmentStore((s) => s.finishAssessment);
  const [index, setIndex] = useState(0);
  const plan = useAssessmentStore((s) => s.plan);
  const level = useAssessmentStore((s) => s.candidate?.level ?? 'pleno');
  const questions = useMemo(() => buildPhase3(plan, level), [plan, level]);
  const question = questions[index];

  // Leva o elemento destacado para dentro do quadro quando o plano está ampliado
  useEffect(() => {
    const id = window.requestAnimationFrame(() => revealInViewer(document.querySelector('[data-focus]')));
    return () => window.cancelAnimationFrame(id);
  }, [question.focus]);

  const next = () => {
    if (index + 1 < questions.length) setIndex(index + 1);
    else finishAssessment();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_25rem]">
      <PlanViewer heightClass="h-[42vh] lg:h-[max(440px,calc(100dvh-11rem))]">
        <PlanSheet plan={plan} focus={question.focus} className="block h-auto w-full" />
      </PlanViewer>
      <div className="lg:sticky lg:top-[8.25rem] lg:max-h-[calc(100dvh-9rem)] lg:self-start lg:overflow-y-auto lg:rounded-2xl">
        <SymbolPanel key={question.id} question={question} index={index} total={questions.length} onDone={next} />
      </div>
    </div>
  );
}

function SymbolPanel({ question, index, total, onDone }) {
  const recordSymbol = useAssessmentStore((s) => s.recordSymbol);
  // Ordem das opções sorteada a cada pergunta (o gabarito não fica sempre na mesma letra)
  const [options] = useState(() => shuffle(question.options));
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const lockedRef = useRef(false);
  const elapsedRef = useRef(() => 0);
  const doneTimer = useRef(null);
  const level = useAssessmentStore((s) => s.candidate?.level ?? 'pleno');
  const limitMs = LEVELS[level].phase3.itemSec * 1000;

  const answer = (optionId, timedOut) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    const correct = optionId === question.correctOptionId;
    setSelected(optionId);
    setFeedback(timedOut ? 'timeout' : correct ? 'correct' : 'wrong');
    if (correct) sfx.correct();
    else sfx.wrong();
    recordSymbol({
      questionId: question.id,
      selectedOptionId: optionId,
      correct,
      timeMs: Math.round(Math.min(elapsedRef.current(), limitMs)),
      timedOut,
    });
    doneTimer.current = window.setTimeout(onDone, TIMING.feedbackMs);
  };

  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  });

  // Teclas 1–4 no desktop
  useEffect(() => {
    const onKey = (e) => {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= options.length) answerRef.current(options[n - 1].id, false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options]);

  useEffect(
    () => () => {
      if (doneTimer.current !== null) window.clearTimeout(doneTimer.current);
    },
    [],
  );

  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-tech-600">
            Fase 3 de 3 · Pergunta {index + 1} de {total}
          </p>
          <p className="font-semibold leading-snug text-slate-500">
            {question.topic} <span className="font-mono text-xs text-slate-400">· {question.norm}</span>
          </p>
        </div>
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn('h-2 rounded-full', i < index ? 'w-2 bg-slate-400' : i === index ? 'w-6 bg-safety-400' : 'w-2 bg-slate-200')}
            />
          ))}
        </div>
      </div>

      <ItemTimer durationMs={limitMs} running={feedback === null} onExpire={() => answer(null, true)} elapsedRef={elapsedRef} />

      <p className="text-lg font-bold leading-snug">{question.prompt}</p>
      <p className="-mt-2 text-sm text-slate-500">O elemento está destacado com tracejado amarelo no plano.</p>

      <div className="space-y-2.5">
        {options.map((opt, i) => {
          const isSelected = selected === opt.id;
          const state = feedback && isSelected ? (feedback === 'correct' ? 'correct' : 'wrong') : null;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={feedback !== null}
              onClick={() => answer(opt.id, false)}
              className={cn(
                'flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 bg-white p-2.5 text-left transition active:scale-[0.99]',
                !feedback && 'border-slate-200 hover:border-tech-400 hover:bg-tech-50',
                state === 'correct' && 'animate-pop border-emerald-500 bg-emerald-50',
                state === 'wrong' && 'animate-shake border-red-500 bg-red-50',
                feedback && !isSelected && 'border-slate-200 opacity-45',
              )}
            >
              <span
                className={cn(
                  'grid size-10 shrink-0 place-items-center rounded-xl font-mono text-lg font-bold',
                  state === 'correct' && 'bg-emerald-500 text-white',
                  state === 'wrong' && 'bg-red-500 text-white',
                  !state && 'bg-slate-900 text-safety-400',
                )}
              >
                {state === 'correct' ? (
                  <Check className="size-5" />
                ) : state === 'wrong' ? (
                  <X className="size-5" />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span className="text-base font-semibold leading-snug">{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="min-h-12">
        {feedback && (
          <div
            className={cn(
              'flex animate-pop items-center gap-2 rounded-xl px-4 py-3 font-bold',
              feedback === 'correct' && 'bg-emerald-100 text-emerald-800',
              feedback === 'wrong' && 'bg-red-100 text-red-800',
              feedback === 'timeout' && 'bg-safety-100 text-safety-700',
            )}
          >
            {feedback === 'correct' && <CircleCheck className="size-5" />}
            {feedback === 'wrong' && <CircleX className="size-5" />}
            {feedback === 'timeout' && <Hourglass className="size-5" />}
            {feedback === 'correct' ? 'Resposta correta' : feedback === 'wrong' ? 'Resposta incorreta' : 'Tempo esgotado'}
            <span className="ml-auto text-sm font-medium opacity-70">{index + 1 < total ? 'Próxima…' : 'Gerando relatório…'}</span>
          </div>
        )}
      </div>
    </section>
  );
}
