import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator as CalculatorIcon, Check, CircleCheck, CircleX, Hourglass, SkipForward } from 'lucide-react';
import { Calculator } from '../components/Calculator.jsx';
import { CARTAO, CELULA_PERGUNTA, CELULA_PLANO, CELULA_RESPOSTA, ECRA_CELULAR, GRELHA } from '../components/ecraProva.js';
import { PerguntaFlutuante } from '../components/PerguntaFlutuante.jsx';
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
import { tempoLeitura, useCelular } from '../hooks/useCelular.js';
import { useAssessmentStore } from '../store/useAssessmentStore.js';

export function Phase2Derive() {
  const completePhase2 = useAssessmentStore((s) => s.completePhase2);
  const [index, setIndex] = useState(0);
  const [calcOpen, setCalcOpen] = useState(false);
  const celular = useCelular();
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
    <div className={celular ? ECRA_CELULAR : GRELHA}>
      <div className={CELULA_PLANO}>
        <PlanViewer controlosVerticais={celular}>
          <PlanSheet plan={plan} query={question.query} className="block h-auto w-full" />
        </PlanViewer>
      </div>
      <DerivePanel
        key={question.id}
        celular={celular}
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

function DerivePanel({ question, index, total, calcOpen, onToggleCalc, onDone, celular }) {
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

  const cronometro = (compacto) => (
    <ItemTimer
      persistKey={`f2-${question.id}`}
      durationMs={limitMs}
      running={answering}
      onExpire={() => submit('timeout')}
      elapsedRef={elapsedRef}
      compacto={compacto}
    />
  );
  const usarCalculadora = (value) => {
    if (!answering) return;
    setRaw(value);
    inputRef.current?.focus({ preventScroll: true });
  };

  // Celular: o plano ocupa o ecrã todo; a pergunta flutua em cima (recolhe depois
  // do tempo de leitura) e a resposta fica numa barra fixa em baixo.
  if (celular) {
    return (
      <>
        <PerguntaFlutuante
          tempoLeituraMs={tempoLeitura(question.prompt)}
          etiqueta={`Fase 2 · Pergunta ${index + 1}/${total}`}
          resumo={question.prompt}
          timer={cronometro}
        >
          <p className="text-sm font-semibold text-slate-500">{question.topic}</p>
          <p className="text-lg font-bold leading-snug text-mp-navy-800">{question.prompt}</p>
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <span
              className="grid size-5 shrink-0 place-items-center rounded-full bg-mp-orange-400 text-xs font-extrabold text-mp-navy-800"
              aria-hidden
            >
              ?
            </span>
            A medida pedida está marcada em laranja no plano.
          </p>
        </PerguntaFlutuante>

        <div className="absolute inset-x-2 bottom-2 z-20 max-h-[70%] overflow-y-auto overscroll-contain rounded-2xl bg-white/95 p-2.5 shadow-xl ring-1 ring-mp-borda backdrop-blur">
          {calcOpen && (
            <div className="mb-2">
              <Calculator onUse={usarCalculadora} />
            </div>
          )}
          {answering ? (
            <>
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
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
                    onChange={(e) => setRaw(e.target.value.replace(/[^\d.,\s]/g, ''))}
                    placeholder="Resposta"
                    className={cn(
                      'h-12 w-full rounded-xl border-2 bg-white pl-3 pr-11 font-mono text-2xl font-bold tabular-nums outline-none transition',
                      'placeholder:font-sans placeholder:text-base placeholder:font-semibold placeholder:text-slate-300 focus:border-mp-navy-500 focus:ring-4 focus:ring-mp-navy-100',
                      raw && parsed === null ? 'border-red-400' : 'border-slate-300',
                    )}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">mm</span>
                </div>
                <Button type="submit" size="sm" className="h-12 px-4" disabled={parsed === null} icon={<Check className="size-5" />}>
                  OK
                </Button>
              </form>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={onToggleCalc}
                  aria-expanded={calcOpen}
                  className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 font-semibold text-mp-navy-700 active:bg-mp-creme"
                >
                  <CalculatorIcon className="size-4" /> {calcOpen ? 'Fechar calculadora' : 'Calculadora'}
                </button>
                {raw && parsed === null && <span className="truncate text-xs font-semibold text-red-600">Só números e vírgula</span>}
                <button
                  type="button"
                  onClick={() => submit('skip')}
                  className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 font-semibold text-slate-600 active:bg-mp-creme"
                >
                  <SkipForward className="size-4" /> Pular
                </button>
              </div>
            </>
          ) : (
            <Feedback status={status} />
          )}
        </div>
      </>
    );
  }

  // Duas células da grelha: a pergunta (sempre à vista, com o cronómetro) e a
  // resposta (com deslocamento próprio quando a calculadora está aberta)
  return (
    <>
      <section className={cn(CELULA_PERGUNTA, CARTAO, 'space-y-2.5 baixo:space-y-1.5')}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-mp-navy-600">
              Fase 2 · Pergunta {index + 1}/{total}
            </p>
            <p className="truncate text-sm font-semibold text-slate-500">{question.topic}</p>
          </div>
        </div>

        {cronometro(false)}

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
                <Button
                  type="submit"
                  size="lgEstreito"
                  className="baixo:min-h-11"
                  disabled={parsed === null}
                  icon={<Check className="size-5" />}
                >
                  Confirmar
                </Button>
                <Button
                  variant="outline"
                  size="lgEstreito"
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
                <Calculator onUse={usarCalculadora} />
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
