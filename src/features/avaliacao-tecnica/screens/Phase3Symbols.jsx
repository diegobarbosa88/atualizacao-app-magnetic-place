import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CircleCheck, CircleX, Hourglass, X } from 'lucide-react';
import { CARTAO, CELULA_PERGUNTA, CELULA_PLANO, CELULA_RESPOSTA, ECRA_CELULAR, GRELHA } from '../components/ecraProva.js';
import { PerguntaFlutuante } from '../components/PerguntaFlutuante.jsx';
import { ItemTimer } from '../components/ItemTimer.jsx';
import { PlanSheet } from '../components/plan/PlanSheet.jsx';
import { PlanViewer, revealInViewer } from '../components/plan/PlanViewer.jsx';
import { TIMING } from '../config.js';
import { LEVELS } from '../data/levels.js';
import { buildPhase3 } from '../data/phase3.js';
import { shuffle } from '../lib/calculations.js';
import { cn } from '../lib/cn.js';
import { sfx } from '../lib/sound.js';
import { tempoLeitura, useCelular } from '../hooks/useCelular.js';
import { useAssessmentStore } from '../store/useAssessmentStore.js';

export function Phase3Symbols() {
  const finishAssessment = useAssessmentStore((s) => s.finishAssessment);
  const [index, setIndex] = useState(0);
  const plan = useAssessmentStore((s) => s.plan);
  const level = useAssessmentStore((s) => s.candidate?.level ?? 'pleno');
  const questions = useMemo(() => buildPhase3(plan, level), [plan, level]);
  const question = questions[index];
  const celular = useCelular();

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
    <div className={celular ? ECRA_CELULAR : GRELHA}>
      <div className={CELULA_PLANO}>
        <PlanViewer controlosVerticais={celular}>
          <PlanSheet plan={plan} focus={question.focus} className="block h-auto w-full" />
        </PlanViewer>
      </div>
      <SymbolPanel key={question.id} celular={celular} question={question} index={index} total={questions.length} onDone={next} />
    </div>
  );
}

function SymbolPanel({ question, index, total, onDone, celular }) {
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

  const cronometro = (compacto) => (
    <ItemTimer
      persistKey={`f3-${question.id}`}
      durationMs={limitMs}
      running={feedback === null}
      onExpire={() => answer(null, true)}
      elapsedRef={elapsedRef}
      compacto={compacto}
    />
  );

  const resultado = feedback && (
    <div
      className={cn(
        'flex w-full animate-pop items-center gap-2 rounded-xl px-3 py-2 font-bold',
        feedback === 'correct' && 'bg-emerald-100 text-emerald-800',
        feedback === 'wrong' && 'bg-red-100 text-red-800',
        feedback === 'timeout' && 'bg-mp-orange-100 text-mp-orange-700',
      )}
    >
      {feedback === 'correct' && <CircleCheck className="size-5" />}
      {feedback === 'wrong' && <CircleX className="size-5" />}
      {feedback === 'timeout' && <Hourglass className="size-5" />}
      {feedback === 'correct' ? 'Resposta correta' : feedback === 'wrong' ? 'Resposta incorreta' : 'Tempo esgotado'}
      <span className="ml-auto text-sm font-medium opacity-70">{index + 1 < total ? 'Próxima…' : 'Finalizando…'}</span>
    </div>
  );

  const opcoes = (compactas) =>
    options.map((opt, i) => {
      const isSelected = selected === opt.id;
      const state = feedback && isSelected ? (feedback === 'correct' ? 'correct' : 'wrong') : null;
      return (
        <button
          key={opt.id}
          type="button"
          disabled={feedback !== null}
          onClick={() => answer(opt.id, false)}
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-2 text-left transition active:scale-[0.99]',
            compactas ? 'min-h-12' : 'min-h-14',
            !feedback && 'border-slate-200 hover:border-mp-navy-400 hover:bg-mp-navy-50',
            state === 'correct' && 'animate-pop border-emerald-500 bg-emerald-50',
            state === 'wrong' && 'animate-shake border-red-500 bg-red-50',
            feedback && !isSelected && 'border-slate-200 opacity-45',
          )}
        >
          <span
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-xl font-mono text-base font-bold',
              state === 'correct' && 'bg-emerald-500 text-white',
              state === 'wrong' && 'bg-red-500 text-white',
              !state && 'bg-mp-navy-800 text-mp-orange-400',
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
          <span className={cn('font-semibold leading-snug', compactas ? 'text-sm' : 'text-[15px]')}>{opt.label}</span>
        </button>
      );
    });

  // Celular: a pergunta é uma barra fina em cima, com o plano por baixo dela; abre
  // com as opções durante o tempo de leitura e recolhe (toque em "Responder").
  if (celular) {
    return (
      <PerguntaFlutuante
        tempoLeituraMs={tempoLeitura(question.prompt + options.map((o) => o.label).join(' '), 10000)}
        etiqueta={`Fase 3 · Pergunta ${index + 1}/${total}`}
        contador={`${index + 1}/${total}`}
        resumo={question.prompt}
        rotuloVer="Responder"
        aviso={
          feedback && (
            <span
              className={cn(
                'flex items-center gap-1.5 text-sm font-bold',
                feedback === 'correct' && 'text-emerald-700',
                feedback === 'wrong' && 'text-red-700',
                feedback === 'timeout' && 'text-mp-orange-700',
              )}
            >
              {feedback === 'correct' && <CircleCheck className="size-4 shrink-0" />}
              {feedback === 'wrong' && <CircleX className="size-4 shrink-0" />}
              {feedback === 'timeout' && <Hourglass className="size-4 shrink-0" />}
              {feedback === 'correct' ? 'Resposta correta' : feedback === 'wrong' ? 'Resposta incorreta' : 'Tempo esgotado'}
            </span>
          )
        }
        timer={cronometro}
      >
        <p className="truncate text-sm font-semibold text-slate-500">
          {question.topic} <span className="font-mono text-xs text-slate-400">· {question.norm}</span>
        </p>
        <p className="text-base font-bold leading-snug text-mp-navy-800">{question.prompt}</p>
        {resultado}
        <div className="space-y-2">{opcoes(true)}</div>
      </PerguntaFlutuante>
    );
  }

  // Duas células da grelha: a pergunta (sempre à vista, com o cronómetro e o
  // resultado da resposta) e as opções
  return (
    <>
      <section className={cn(CELULA_PERGUNTA, CARTAO, 'space-y-2.5 baixo:space-y-1.5')}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-mp-navy-600">
              Fase 3 · Pergunta {index + 1}/{total}
            </p>
            <p className="truncate text-sm font-semibold leading-snug text-slate-500">
              {question.topic} <span className="font-mono text-xs text-slate-400">· {question.norm}</span>
            </p>
          </div>
        </div>

        {cronometro(false)}

        <p className="text-base font-bold leading-snug text-mp-navy-800 sm:text-lg baixo:text-base">{question.prompt}</p>
        {/* Mesma altura com e sem resultado, para o plano não saltar */}
        <div aria-live="polite" className="flex items-center empty:hidden sm:min-h-10 baixo:min-h-0">
          {feedback ? (
            resultado
          ) : (
            <p className="hidden text-sm text-slate-500 sm:block baixo:hidden">O elemento está destacado com tracejado laranja no plano.</p>
          )}
        </div>
      </section>

      <div className={CELULA_RESPOSTA}>
        <section className={cn(CARTAO, 'space-y-2')}>{opcoes(false)}</section>
      </div>
    </>
  );
}
