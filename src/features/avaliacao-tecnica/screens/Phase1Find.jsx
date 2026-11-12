import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpenCheck, CircleCheck, Hourglass, Lightbulb, ScanSearch, TriangleAlert } from 'lucide-react';
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

const VIEWER_HEIGHT = 'h-[max(380px,calc(100dvh-19rem))]';

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
    <div className="space-y-3">
      <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4">
        {mode === 'study' ? (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] md:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-900 text-safety-400">
                <BookOpenCheck className="size-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-tech-600">Fase 1 de 3 · Leitura do plano</p>
                <h2 className="text-xl font-bold sm:text-2xl">Estude o plano {DRAWING.number}</h2>
                <p className="mt-1 text-slate-600">
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
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-tech-600">
                  Fase 1 de 3 · Cota {index + 1} de {items.length}
                </p>
                <div className="flex gap-1" aria-hidden>
                  {items.map((it, i) => (
                    <span
                      key={it.id}
                      className={cn(
                        'h-2 rounded-full',
                        i < index ? 'w-2 bg-slate-400' : i === index ? 'w-6 bg-safety-400' : 'w-2 bg-slate-200',
                      )}
                    />
                  ))}
                </div>
              </div>
              <p className="mt-1 text-lg leading-snug sm:text-xl">
                <span className="text-slate-500">Encontre: </span>
                <strong className="font-bold">{item.prompt}</strong>
              </p>
              <div
                key={shake}
                aria-live="polite"
                className={cn('mt-2 flex min-h-8 flex-wrap items-center gap-3', shake > 0 && status === 'searching' && 'animate-shake')}
              >
                <div className="flex items-center gap-1.5" aria-label={`${remainingAttempts} tentativas restantes`}>
                  {Array.from({ length: maxAttempts }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'size-3 rounded-full ring-2',
                        i < remainingAttempts ? 'bg-tech-500 ring-tech-200' : 'bg-red-200 ring-red-100',
                      )}
                    />
                  ))}
                </div>
                <StatusLine status={status} wrongCount={wrong.length} remaining={remainingAttempts} />
                {hint && (
                  <span className="inline-flex animate-pop items-center gap-1.5 rounded-lg bg-tech-50 px-2.5 py-1 font-semibold text-tech-800 ring-1 ring-tech-200">
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

      <PlanViewer heightClass={VIEWER_HEIGHT}>
        <PlanSheet plan={plan} interactive={mode === 'find'} marks={marks} onDimTap={handleTap} className="block h-auto w-full" />
      </PlanViewer>
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
      <span className="inline-flex animate-pop items-center gap-1.5 rounded-lg bg-safety-100 px-2.5 py-1 font-bold text-safety-700">
        <Hourglass className="size-4" />
        {status === 'missed' ? 'Tentativas esgotadas' : 'Tempo esgotado'} — a cota certa está destacada em amarelo
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
