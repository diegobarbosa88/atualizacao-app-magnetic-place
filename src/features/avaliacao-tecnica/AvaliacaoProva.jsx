import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader.jsx';
import { PhaseGate } from './components/PhaseGate.jsx';
import { ConfirmDialog } from './components/ui/ConfirmDialog.jsx';
import { getPhaseMeta } from './data/phases.js';
import { useExamGuard } from './hooks/useExamGuard.js';
import { FinishScreen } from './screens/FinishScreen.jsx';
import { Phase1Find } from './screens/Phase1Find.jsx';
import { Phase2Derive } from './screens/Phase2Derive.jsx';
import { Phase3Symbols } from './screens/Phase3Symbols.jsx';
import { StartScreen } from './screens/StartScreen.jsx';
import { isInProgress, useAssessmentStore } from './store/useAssessmentStore.js';

/**
 * A prova em si (dados → 3 fases → envio), para o candidato que abriu o link.
 * O nível vem do convite; `onStart` regista o início e devolve a variante do plano;
 * `onSubmit` envia as respostas em bruto para correção no servidor.
 */
export default function AvaliacaoProva({ level, inicial, onStart, onSubmit }) {
  const stage = useAssessmentStore((s) => s.stage);
  const phases = getPhaseMeta(level);
  const registerFocusLoss = useAssessmentStore((s) => s.registerFocusLoss);
  const registerExitAttempt = useAssessmentStore((s) => s.registerExitAttempt);
  const abandonAssessment = useAssessmentStore((s) => s.abandonAssessment);
  const [exitOpen, setExitOpen] = useState(false);
  const inProgress = isInProgress(stage);

  const requestExit = useCallback(() => {
    registerExitAttempt();
    setExitOpen(true);
  }, [registerExitAttempt]);

  useExamGuard(inProgress, { onFocusLoss: registerFocusLoss, onExitAttempt: requestExit });

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stage]);

  const closeExit = useCallback(() => setExitOpen(false), []);

  // Altura do cabeçalho em --cab: o ecrã das fases ocupa exatamente o resto da
  // janela (components/ecraProva.js), para o plano e a pergunta não saírem do ecrã.
  const raizRef = useRef(null);
  const cabRef = useRef(null);
  useLayoutEffect(() => {
    const cab = cabRef.current;
    const raiz = raizRef.current;
    if (!cab || !raiz) return undefined;
    const medir = () => raiz.style.setProperty('--cab', `${cab.offsetHeight}px`);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(cab);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={raizRef} className="avaliacao-scope min-h-dvh bg-mp-creme text-slate-900">
      <div ref={cabRef} className="sticky top-0 z-30">
        <AppHeader onExit={requestExit} />
      </div>

      {/* py-2 (1rem no total) entra na conta da altura de GRELHA */}
      <main className="mx-auto w-full max-w-[96rem] px-2 py-2 sm:px-4">
        {stage === 'start' && <StartScreen level={level} inicial={inicial} onStart={onStart} />}
        {stage === 'phase1' && <Phase1Find />}
        {stage === 'phase2' && (
          <PhaseGate key="phase2" meta={phases[2]}>
            <Phase2Derive />
          </PhaseGate>
        )}
        {stage === 'phase3' && (
          <PhaseGate key="phase3" meta={phases[3]}>
            <Phase3Symbols />
          </PhaseGate>
        )}
        {stage === 'results' && <FinishScreen onSubmit={onSubmit} />}
      </main>

      <ConfirmDialog
        open={exitOpen && inProgress}
        title="Encerrar a prova agora?"
        description="As fases não concluídas valem 0 pontos e a prova é enviada como está. O link não poderá ser usado de novo."
        cancelLabel="Continuar a prova"
        confirmLabel="Encerrar prova"
        onCancel={closeExit}
        onConfirm={() => {
          setExitOpen(false);
          abandonAssessment();
        }}
      />
    </div>
  );
}
