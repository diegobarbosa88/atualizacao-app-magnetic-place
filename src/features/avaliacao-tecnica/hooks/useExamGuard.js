import { useEffect, useRef } from 'react';

/**
 * Protege a prova em andamento:
 * - pede confirmação do navegador ao recarregar/fechar (F5, Ctrl+R, fechar aba);
 * - intercepta o botão voltar e devolve o controle ao app (diálogo próprio);
 * - conta saídas da tela para o relatório de integridade.
 */
export function useExamGuard(active, handlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!active) return;

    const onBeforeUnload = (event) => {
      event.preventDefault();
      // Necessário para alguns navegadores exibirem o alerta de abandono
      event.returnValue = '';
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') handlersRef.current.onFocusLoss();
    };

    let historyTrapped = false;
    try {
      window.history.pushState({ examGuard: true }, '');
      historyTrapped = true;
    } catch {
      /* ambiente sem History API (iframe isolado) */
    }

    const onPopState = () => {
      try {
        window.history.pushState({ examGuard: true }, '');
      } catch {
        /* ignore */
      }
      handlersRef.current.onExitAttempt();
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    if (historyTrapped) window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('popstate', onPopState);
    };
  }, [active]);
}
