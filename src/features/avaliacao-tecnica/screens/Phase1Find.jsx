import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpenCheck, CircleCheck, Hourglass, Lightbulb, ScanSearch, TriangleAlert } from 'lucide-react';
import { CARTAO, CELULA_PERGUNTA, CELULA_PLANO, GRELHA } from '../components/ecraProva.js';
import { ItemTimer } from '../components/ItemTimer.jsx';
import { PlanSheet } from '../components/plan/PlanSheet.jsx';
import { PlanViewer, revealInViewer } from '../components/plan/PlanViewer.jsx';
import { Button } from '../components/ui/Button.jsx';
import { TIMING } from '../config.js';
import { LEVELS } from '../data/levels.js';
import { getPhase1Items } from '../data/phase1.js';
import { DIM_WHERE, DRAWING } from '../data/plan.js';
import { cn } from '../lib/cn.js';
import { sfx } from '../lib/sound.js';
import { useAssessmentStore } from '../store/useAssessmentStore.js';

const WHERE_PHRASE = {
  'Vista frontal': 'na vista frontal',
  Planta: 'na planta (vista de cima)',
  'Corte A–A': 'no corte A–A',
  'Detalhe B': 'no detalhe B',
  'Lista de peças': 'na lista de peças',
};

export function Phase1Find() {
  const recordFind = useAssessmentStore((s) => s.recordFind);
  const completePhase1 = useAssessmentStore((s) => s.completePhase1);
  const plan = useAssessmentStore((s) => s.plan);
  const level = useAssessmentStore((s) => s.candidate?.level ?? 'pleno');
  const spec = LEVELS[level];
  const items = useMemo(() => getPhase1Items(level), [level]);
  const maxAttempts = spec.phase1.maxAttempts;

  const [mode, setMode] = useState('study');
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState([]);
  const [foundId, setFoundId] = useState(null);
  const [status, setStatus] = useState('searching');
  const [shake, setShake] = useState(0);

  const wrongRef = useRef([]);
  const lockedRef = useRef(false);
  const elapsedRef = useRef(() => 0);
  const timeoutRef = useRef(null);

  const item = items[index];
  const limitMs = spec.phase1.itemSec * 1000;
  const remainingAttempts = maxAttempts - wrong.length;
  const hint = spec.phase1.hintAfterMiss && wrong.length > 0 && status === 'searching' ? WHERE_PHRASE[DIM_WHERE[item.targets[0]]] : null;

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  // Mostra a cota certa quando o candidato não a encontra
  useEffect(() => {
    if (status === 'missed' || status === 'timeout') {
      revealInViewer(document.querySelector(`[data-dim="${item.targets[0]}"]`));
    }
  }, [status, item]);

  const startFinding = () => {
    sfx.go();
    setMode('find');
  };

  const advance = () => {
    if (index + 1 >= items.length) {
      completePhase1();
      return;
    }
    wrongRef.current = [];
    lockedRef.current = false;
    setWrong([]);
    setFoundId(null);
    setStatus('searching');
    setIndex(index + 1);
  };

  const finish = (delayMs) => {
    timeoutRef.current = window.setTimeout(advance, delayMs);
  };

  const elapsed = () => Math.round(Math.min(elapsedRef.current(), limitMs));

  const handleTap = (id) => {
    if (mode !== 'find' || lockedRef.current || wrongRef.current.includes(id)) return;

    if (item.targets.includes(id)) {
      lockedRef.current = true;
      setFoundId(id);
      setStatus('found');
      sfx.correct();
      recordFind({
        itemId: item.id,
        found: true,
        attemptsUsed: wrongRef.current.length + 1,
        wrongTaps: [...wrongRef.current],
        hintShown: spec.phase1.hintAfterMiss && wrongRef.current.length > 0,
        timeMs: elapsed(),
        timedOut: false,
      });
      finish(TIMING.feedbackMs);
      return;
    }

    const next = [...wrongRef.current, id];
    wrongRef.current = next;
    setWrong(next);
    setShake((n) => n + 1);
    sfx.wrong();
    if (next.length >= maxAttempts) {
      lockedRef.current = true;
      setStatus('missed');
      recordFind({
        itemId: item.id,
        found: false,
        attemptsUsed: next.length,
        wrongTaps: next,
        hintShown: spec.phase1.hintAfterMiss,
        timeMs: elapsed(),
        timedOut: false,
      });
      finish(TIMING.revealMs);
    }
  };

  const handleExpire = () => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setStatus('timeout');
    sfx.wrong();
    recordFind({
      itemId: item.id,
      found: false,
      attemptsUsed: wrongRef.current.length,
      wrongTaps: [...wrongRef.current],
      hintShown: spec.phase1.hintAfterMiss && wrongRef.current.length > 0,
      timeMs: limitMs,
      timedOut: true,
    });
    finish(TIMING.revealMs);
  };

  const marks = {};
  if (mode === 'find') {
    for (const id of wrong) marks[id] = 'wrong';
    if (status === 'found' && foundId) marks[foundId] = 'correct';
    if (status === 'missed' || status === 'timeout') for (const t of item.targets) marks[t] = 'reveal';
  }

  return (
    <div className={GRELHA}>
      <section className={cn(CELULA_PERGUNTA, CARTAO, '@container')}>
        {mode === 'study' ? (
          <div className="grid gap-3 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] @2xl:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-mp-navy-800 text-mp-orange-400">
                <BookOpenCheck className="size-6" />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-mp-navy-600">
                  Fase 1 · Leitura do plano
                </p>
                <h2 className="text-xl font-bold text-mp-navy-800 sm:text-2xl">Estude o plano {DRAWING.number}</h2>
                <p className="mt-1 text-sm text-slate-600 sm:text-base baixo:hidden">
                  Veja as vistas, o corte A–A, o detalhe B, a lista de peças e as notas. Depois vai procurar {items.length} cotas.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <ItemTimer
                key="study"
                durationMs={spec.studySec * 1000}
                running
                onExpire={startFinding}
                elapsedRef={elapsedRef}
                label="Leitura do plano"
              />
              <Button block size="lg" icon={<ScanSearch className="size-5" />} onClick={startFinding}>
                Começar a procurar cotas
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] @2xl:items-center @2xl:gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-mp-navy-600">
                  Fase 1 · Cota {index + 1}/{items.length}
                </p>
              </div>
              <p className="mt-1 text-lg leading-snug sm:text-xl baixo:text-base">
                <span className="text-slate-500">Encontre: </span>
                <strong className="font-bold text-mp-navy-800">{item.prompt}</strong>
              </p>
              {/* Altura reservada: a mensagem muda a cada toque e não deve empurrar o plano */}
              <div
                key={shake}
                aria-live="polite"
                className={cn(
                  'mt-2 flex min-h-[4.25rem] flex-wrap content-start items-center gap-x-3 gap-y-1.5 @2xl:min-h-8',
                  shake > 0 && status === 'searching' && 'animate-shake',
                )}
              >
                <div className="flex items-center gap-1.5" aria-label={`${remainingAttempts} tentativas restantes`}>
                  {Array.from({ length: maxAttempts }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'size-3 rounded-full ring-2',
                        i < remainingAttempts ? 'bg-mp-navy-500 ring-mp-navy-200' : 'bg-red-200 ring-red-100',
                      )}
                    />
                  ))}
                </div>
                <StatusLine status={status} wrongCount={wrong.length} remaining={remainingAttempts} />
                {hint && (
                  <span className="inline-flex animate-pop items-center gap-1.5 rounded-lg bg-mp-navy-50 px-2.5 py-1 font-semibold text-mp-navy-800 ring-1 ring-mp-navy-200">
                    <Lightbulb className="size-4" /> Dica: procure {hint}
                  </span>
                )}
              </div>
            </div>
            <ItemTimer
              key={item.id}
              durationMs={limitMs}
              running={status === 'searching'}
              onExpire={handleExpire}
              elapsedRef={elapsedRef}
            />
          </div>
        )}
      </section>

      <div className={CELULA_PLANO}>
        <PlanViewer>
          <PlanSheet plan={plan} interactive={mode === 'find'} marks={marks} onDimTap={handleTap} className="block h-auto w-full" />
        </PlanViewer>
      </div>
    </div>
  );
}

function StatusLine({ status, wrongCount, remaining }) {
  if (status === 'found')
    return (
      <span className="inline-flex animate-pop items-center gap-1.5 rounded-lg bg-emerald-100 px-2.5 py-1 font-bold text-emerald-800">
        <CircleCheck className="size-4" /> Encontrada
      </span>
    );
  if (status === 'missed' || status === 'timeout')
    return (
      <span className="inline-flex animate-pop items-center gap-1.5 rounded-lg bg-mp-orange-100 px-2.5 py-1 font-bold text-mp-orange-700">
        <Hourglass className="size-4" />
        {status === 'missed' ? 'Tentativas esgotadas' : 'Tempo esgotado'} — a cota certa está destacada em laranja
      </span>
    );
  if (wrongCount > 0)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-2.5 py-1 font-bold text-red-800">
        <TriangleAlert className="size-4" /> Não é essa. {remaining === 1 ? 'Resta 1 tentativa' : `Restam ${remaining} tentativas`}
      </span>
    );
  return <span className="text-sm text-slate-500">Toque na cota no plano. Use + para ampliar.</span>;
}
