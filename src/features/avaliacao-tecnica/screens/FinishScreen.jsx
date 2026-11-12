import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleCheck, LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { sfx } from '../lib/sound.js';
import { useAssessmentStore } from '../store/useAssessmentStore.js';

/** Respostas em bruto — a correção é feita no servidor (ver lib/grading.js) */
function buildSubmission(state) {
  return {
    sessionId: state.sessionId,
    respostas: {
      phase1: state.phase1,
      phase2: state.phase2,
      phase3: state.phase3,
      integrity: state.integrity,
    },
  };
}

/**
 * Fim da prova do lado do candidato: envia as respostas e agradece.
 * O candidato não vê a nota — o relatório fica para o recrutador.
 */
export function FinishScreen({ onSubmit }) {
  const abandoned = useAssessmentStore((s) => s.integrity.abandoned);
  const [state, setState] = useState('sending');
  const sentOnce = useRef(false);

  const send = useCallback(() => {
    setState('sending');
    onSubmit(buildSubmission(useAssessmentStore.getState()))
      .then(() => {
        setState('sent');
        sfx.finish();
      })
      .catch(() => setState('error'));
  }, [onSubmit]);

  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    send();
  }, [send]);

  return (
    <div className="mx-auto max-w-2xl pt-6">
      <Card className="p-8 text-center sm:p-10">
        {state === 'sending' && (
          <>
            <LoaderCircle className="mx-auto size-14 animate-spin text-tech-600" />
            <h1 className="mt-5 text-2xl font-bold">Enviando suas respostas…</h1>
            <p className="mt-2 text-slate-600">Não feche esta página.</p>
          </>
        )}
        {state === 'sent' && (
          <>
            <CircleCheck className="mx-auto size-16 text-emerald-500" />
            <h1 className="mt-5 text-2xl font-bold">{abandoned ? 'Prova encerrada' : 'Prova concluída!'}</h1>
            <p className="mt-3 text-lg text-slate-700">
              Suas respostas foram enviadas à Magnetic Place. A equipe de recrutamento vai analisar o resultado e entrar em contato.
            </p>
            <p className="mt-4 text-sm text-slate-500">Já pode fechar esta página.</p>
          </>
        )}
        {state === 'error' && (
          <>
            <TriangleAlert className="mx-auto size-14 text-safety-500" />
            <h1 className="mt-5 text-2xl font-bold">Não foi possível enviar</h1>
            <p className="mt-3 text-slate-700">
              Verifique a internet e tente de novo. As respostas ficaram salvas neste aparelho: se fechar a página, abra o mesmo link mais
              tarde e elas serão enviadas.
            </p>
            <div className="mt-6 flex justify-center">
              <Button size="lg" icon={<RotateCcw className="size-5" />} onClick={send}>
                Tentar de novo
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
