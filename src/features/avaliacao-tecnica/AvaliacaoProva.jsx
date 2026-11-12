import { useCallback, useEffect, useState } from 'react';
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

  return (
    <div className="avaliacao-scope min-h-dvh bg-slate-100 text-slate-900">
      <AppHeader onExit={requestExit} />

      <main className="mx-auto w-full max-w-[96rem] px-3 pb-8 pt-4 sm:px-5">
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
