import { useState, useEffect, useMemo } from 'react';
import { submitCorrection } from '../../../utils/correctionsApi';

export function useWorkerCorrections({ currentUser, correctionItems, setCorrectionItems, corrections, currentMonthStr, supabase, logs, setSuccessMsg }) {
  const [dismissedCorrectionIds, setDismissedCorrectionIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('wk_dismissed_corrections') || '[]')); }
    catch { return new Set(); }
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [pendingCollapsed, setPendingCollapsed] = useState(true);

  // Safety net: refetch periodicamente e ao focar a janela caso o realtime falhe
  useEffect(() => {
    if (!supabase) return;
    const refetch = async () => {
      const { data, error } = await supabase.from('correction_items').select('*');
      if (error) { console.warn('[WorkerDashboard] refetch correction_items falhou', error); return; }
      if (Array.isArray(data)) setCorrectionItems(data);
    };
    const interval = setInterval(refetch, 30000);
    const onFocus = () => { refetch(); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [supabase, setCorrectionItems]);

  const pendingItems = useMemo(() => {
    const resolvedCorrectionIds = new Set(
      (corrections || [])
        .filter((c) => c.status === 'applied' || c.status === 'rejected')
        .map((c) => c.id)
    );
    return (correctionItems || []).filter(
      (i) =>
        i.worker_id === currentUser?.id &&
        i.item_status === 'pending' &&
        !resolvedCorrectionIds.has(i.correction_id) &&
        (i.date || '').startsWith(currentMonthStr)
    );
  }, [correctionItems, corrections, currentUser, currentMonthStr]);

  const resolvedItems = useMemo(() => {
    return (correctionItems || []).filter((i) => {
      if (i.worker_id !== currentUser?.id) return false;
      if (dismissedCorrectionIds.has(i.correction_id)) return false;
      if (!(i.date || '').startsWith(currentMonthStr)) return false;
      const corr = (corrections || []).find((c) => c.id === i.correction_id);
      return corr && (corr.status === 'applied' || corr.status === 'rejected');
    });
  }, [correctionItems, corrections, currentUser, dismissedCorrectionIds, currentMonthStr]);

  const dismissCorrection = (correctionId) => {
    setDismissedCorrectionIds((prev) => {
      const next = new Set(prev);
      next.add(correctionId);
      localStorage.setItem('wk_dismissed_corrections', JSON.stringify([...next]));
      return next;
    });
  };

  const labelKind = (item) => {
    if (!item.before || (!item.before.startTime && !item.before.endTime)) return '✚ Novo dia';
    if (!item.proposed || (!item.proposed.startTime && !item.proposed.endTime)) return '✖ Remover dia';
    return '✎ Ajuste';
  };

  const handleSubmitDeletion = async () => {
    if (!deleteConfirm || deleteSubmitting) return;
    const log = logs.find(l => l.id === deleteConfirm.logId);
    if (!log) {
      console.warn('[WorkerDashboard] log not found', deleteConfirm.logId);
      alert('Registo não encontrado. A fechar modal.');
      setDeleteConfirm(null);
      return;
    }
    if (!supabase) {
      alert('Sistema ainda não está pronto. Aguarde alguns segundos e tente novamente.');
      return;
    }
    const dup = (correctionItems || []).some((i) => {
      if (i.worker_id !== String(currentUser?.id)) return false;
      if (i.date !== deleteConfirm.date) return false;
      if (i.item_status !== 'pending') return false;
      const corr = (corrections || []).find((c) => c.id === i.correction_id);
      return corr && corr.status !== 'applied' && corr.status !== 'rejected';
    });
    if (dup) {
      alert('Já existe um pedido pendente para este dia. Aguarda a resposta do administrador antes de submeter outro.');
      return;
    }
    setDeleteSubmitting(true);
    try {
      await submitCorrection(supabase, {
        clientId: log.clientId,
        month: deleteConfirm.date.substring(0, 7),
        type: 'deletion_request',
        submittedBy: currentUser?.id,
        justification: `Pedido de eliminação do registo de ${deleteConfirm.date}`,
        items: [{
          workerId: currentUser?.id,
          workerName: currentUser?.name,
          date: deleteConfirm.date,
          before: {
            log_id: log.id,
            startTime: log.startTime,
            endTime: log.endTime,
            breakStart: log.breakStart,
            breakEnd: log.breakEnd,
          },
          proposed: null,
        }],
      });
      setDeleteConfirm(null);
      setSuccessMsg('Pedido de exclusão submetido!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('[WorkerDashboard] submitCorrection error', err);
      alert('Erro ao submeter pedido: ' + (err?.message || err));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return {
    pendingItems,
    resolvedItems,
    pendingCollapsed,
    setPendingCollapsed,
    deleteConfirm,
    setDeleteConfirm,
    deleteSubmitting,
    dismissCorrection,
    labelKind,
    handleSubmitDeletion,
  };
}
