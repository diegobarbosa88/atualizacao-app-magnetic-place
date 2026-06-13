import { useState, useMemo, useEffect, useCallback } from 'react';

export function useClientNotifications({
  appNotifications,
  effectiveClientId,
  corrections,
  correctionItems,
  initialClientId,
  logs,
  setLogs,
  saveToDb,
  clientData,
  workers,
  supabase,
}) {
  const [dismissedNotifs, setDismissedNotifs] = useState([]);
  const [expandedCards, setExpandedCards] = useState({});

  useEffect(() => {
    if (!effectiveClientId) return;
    try {
      setDismissedNotifs(JSON.parse(localStorage.getItem(`dismissed_client_notifs_${effectiveClientId}`) || '[]'));
    } catch { setDismissedNotifs([]); }
  }, [effectiveClientId]);

  const myNotifications = useMemo(() => {
    if (!appNotifications || !effectiveClientId) return [];
    return appNotifications.filter(n => {
      const matchTarget = n.target_type === 'client';
      const matchClientId = String(n.target_client_id) === String(effectiveClientId);
      const isActive = n.is_active === true;
      const notDismissed = !dismissedNotifs.includes(n.id);
      return matchTarget && matchClientId && isActive && notDismissed;
    });
  }, [appNotifications, effectiveClientId, dismissedNotifs]);

  const workerSubmissionsResolved = useMemo(() => {
    if (!appNotifications || !effectiveClientId) return [];
    return appNotifications.filter(n => {
      const matchTarget = n.target_type === 'client';
      const matchClientId = String(n.target_client_id) === String(effectiveClientId);
      const isActive = n.is_active === true;
      const notDismissed = !dismissedNotifs.includes(n.id);
      const isWorkerSubmission = n.payload?.kind === 'submitted';
      if (!isWorkerSubmission) return false;
      const correctionId = n.payload?.correction_id;
      const correction = corrections?.find(c => c.id === correctionId);
      if (!correction || correction.status === 'submitted') return false;
      return matchTarget && matchClientId && isActive && notDismissed;
    });
  }, [appNotifications, effectiveClientId, dismissedNotifs, corrections]);

  const workerSubmissionsPending = useMemo(() => {
    if (!appNotifications || !effectiveClientId) return [];
    return appNotifications.filter(n => {
      const matchTarget = n.target_type === 'client';
      const matchClientId = String(n.target_client_id) === String(effectiveClientId);
      const isActive = n.is_active === true;
      const notDismissed = !dismissedNotifs.includes(n.id);
      const isWorkerSubmission = n.payload?.kind === 'submitted';
      if (!isWorkerSubmission) return false;
      const correctionId = n.payload?.correction_id;
      const correction = corrections?.find(c => c.id === correctionId);
      if (!correction || correction.status !== 'submitted') return false;
      return matchTarget && matchClientId && isActive && notDismissed;
    });
  }, [appNotifications, effectiveClientId, dismissedNotifs, corrections]);

  const handleDismissNotif = useCallback((id) => {
    setDismissedNotifs(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      localStorage.setItem(`dismissed_client_notifs_${effectiveClientId}`, JSON.stringify(updated));
      return updated;
    });
  }, [effectiveClientId]);

  const handleAcceptContestation = useCallback(async (notif) => {
    const changes = notif.payload?.changes;
    if (!changes || !Array.isArray(changes)) {
      alert('Erro: Não foi possível encontrar os dados da contra-proposta.');
      return;
    }
    try {
      const updates = [];
      const inserts = [];
      for (const w of changes) {
        for (const d of w.dailyRecords) {
          const targetWorkerId = String(w.id);
          const targetClientId = String(initialClientId);
          const targetDate = d.date || d.dateLabel || d.rawDate;
          const originalLog = logs.find(l =>
            String(l.workerId || l.worker_id) === targetWorkerId &&
            l.date === targetDate &&
            String(l.clientId || l.client_id) === targetClientId
          );
          const entry = (d.adminEntry || d.editedEntry || d.newEntry) === '--:--' ? null : (d.adminEntry || d.editedEntry || d.newEntry);
          const exit  = (d.adminExit  || d.editedExit  || d.newExit)  === '--:--' ? null : (d.adminExit  || d.editedExit  || d.newExit);
          if (originalLog) {
            updates.push({ id: originalLog.id, data: { ...originalLog, startTime: entry, endTime: exit, breakStart: d.adminBreakStart || d.editedBreakStart || d.newBreakStart, breakEnd: d.adminBreakEnd || d.editedBreakEnd || d.newBreakEnd, hours: d.adminHours || d.editedHours || d.newHours } });
          } else {
            const newLogId = `log_${crypto.randomUUID()}`;
            inserts.push({ id: newLogId, data: { id: newLogId, date: targetDate, workerId: targetWorkerId, clientId: targetClientId, startTime: entry, endTime: exit, breakStart: d.adminBreakStart || d.editedBreakStart || d.newBreakStart, breakEnd: d.adminBreakEnd || d.editedBreakEnd || d.newBreakEnd, hours: d.adminHours || d.editedHours || d.newHours, created_at: new Date().toISOString() } });
          }
        }
      }
      await Promise.all([
        ...updates.map(u => saveToDb('logs', u.id, u.data)),
        ...inserts.map(i => saveToDb('logs', i.id, i.data)),
      ]);
      setLogs(prev => {
        const updateMap = new Map(updates.map(u => [u.id, u.data]));
        const updated = prev.map(l => updateMap.has(l.id) ? { ...l, ...updateMap.get(l.id) } : l);
        return [...updated, ...inserts.map(i => i.data)];
      });

      const timestamp = Date.now();
      const adminNotifId = `accp_${notif.id}_${timestamp}`;
      await saveToDb('app_notifications', adminNotifId, {
        title: `✅ Contra-proposta Aceite e Aplicada: ${clientData.name}`,
        message: `O cliente ACEITOU a contra-proposta para ${clientData.period}. Os registos de horas foram atualizados automaticamente no sistema.`,
        type: 'success',
        target_type: 'admin',
        created_at: new Date().toISOString(),
        is_active: true,
      });

      handleDismissNotif(notif.id);
      alert('As alterações foram aplicadas! Por favor, assine agora o relatório atualizado.');
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (error) {
      console.error('Erro ao aplicar contra-proposta:', error);
      alert('Ocorreu um erro ao atualizar os dados. Por favor, tente novamente.');
    }
  }, [clientData, initialClientId, logs, saveToDb, setLogs, handleDismissNotif]);

  const handleApproveCreationRequest = useCallback(async (notif) => {
    const correctionId = notif.payload?.correction_id;
    if (!correctionId) { alert('Erro: ID do pedido não encontrado.'); return; }

    const correction = corrections?.find(c => c.id === correctionId);
    const items = (correctionItems || []).filter(it => it.correction_id === correctionId);
    if (!correction) { alert('Erro: Pedido não encontrado.'); return; }

    if (!confirm('Aprovar este pedido de registo? Os horários serão atualizados/criados no relatório.')) return;

    try {
      for (const item of items) {
        if (correction.type === 'deletion_request') {
          const delQuery = item.before?.log_id
            ? supabase.from('logs').delete().eq('id', item.before.log_id)
            : supabase.from('logs').delete().eq('workerId', item.worker_id).eq('date', item.date);
          const { error: delError } = await delQuery;
          if (delError) throw delError;
        } else if (item.proposed) {
          const existingLog = logs.find(l => String(l.workerId) === String(item.worker_id) && l.date === item.date);
          if (existingLog) {
            await saveToDb('logs', existingLog.id, { ...existingLog, ...item.proposed });
          } else {
            const newId = `log_${crypto.randomUUID()}`;
            await saveToDb('logs', newId, { id: newId, workerId: item.worker_id, clientId: effectiveClientId, date: item.date, ...item.proposed, created_at: new Date().toISOString() });
          }
        }
      }

      await supabase.from('corrections').update({ status: 'applied' }).eq('id', correctionId);

      const adminNotifId = `accp_cr_${notif.id}_${Date.now()}`;
      await saveToDb('app_notifications', adminNotifId, {
        title: `✅ Pedido de Registo Aprovado: ${clientData?.name || 'Cliente'}`,
        message: `O cliente APROVOU o pedido de registo. Os registos foram atualizados.`,
        type: 'success',
        target_type: 'admin',
        created_at: new Date().toISOString(),
        is_active: true,
      });

      for (const item of items) {
        if (item.worker_id) {
          const workerNotifId = `accp_wr_${item.id}_${Date.now()}`;
          await saveToDb('app_notifications', workerNotifId, {
            title: '✅ Pedido de Registo Aprovado',
            message: `O seu pedido de ${item.date} foi aprovado pelo cliente.`,
            type: 'success',
            target_type: 'worker',
            target_worker_ids: [String(item.worker_id)],
            created_at: new Date().toISOString(),
            is_active: true,
          });
        }
      }

      handleDismissNotif(notif.id);
      setLogs(prev => {
        const updated = [...prev];
        for (const item of items) {
          const existingIdx = updated.findIndex(l => String(l.workerId) === String(item.worker_id) && l.date === item.date);
          if (correction.type === 'deletion_request') {
            const idxToDel = item.before?.log_id
              ? updated.findIndex(l => l.id === item.before.log_id)
              : existingIdx;
            if (idxToDel >= 0) updated.splice(idxToDel, 1);
          } else if (existingIdx >= 0 && item.proposed) {
            updated[existingIdx] = { ...updated[existingIdx], ...item.proposed };
          } else if (!item.before && item.proposed) {
            updated.push({ id: `log_${crypto.randomUUID()}`, workerId: item.worker_id, clientId: effectiveClientId, date: item.date, ...item.proposed });
          }
        }
        return updated;
      });

      alert(correction.type === 'deletion_request' ? 'Pedido aprovado! Registo eliminado.' : 'Pedido aprovado! Relatório atualizado.');
    } catch (error) {
      console.error('Erro ao aprovar pedido:', error);
      alert('Ocorreu um erro ao aprovar o pedido. Por favor, tente novamente.');
    }
  }, [corrections, correctionItems, supabase, effectiveClientId, saveToDb, handleDismissNotif, logs, setLogs, clientData]);

  const handleRejectCreationRequest = useCallback(async (notif) => {
    const correctionId = notif.payload?.correction_id;
    if (!correctionId) return;

    const items = (correctionItems || []).filter(it => it.correction_id === correctionId);
    const reason = prompt('Motivo da rejeição (opcional):');
    if (reason === null) return;

    try {
      await supabase.from('corrections').update({ status: 'rejected' }).eq('id', correctionId);

      const adminNotifId = `rej_cr_${notif.id}_${Date.now()}`;
      await saveToDb('app_notifications', adminNotifId, {
        title: `❌ Pedido de Registo Rejeitado: ${clientData?.name || 'Cliente'}`,
        message: `O cliente REJEITOU o pedido de registo${reason ? `. Motivo: ${reason}` : ''}.`,
        type: 'error',
        target_type: 'admin',
        created_at: new Date().toISOString(),
        is_active: true,
      });

      const rejectionMsg = reason ? ` Motivo: ${reason}` : '';
      for (const item of items) {
        if (item.worker_id) {
          const workerNotifId = `rej_wr_${item.id}_${Date.now()}`;
          await saveToDb('app_notifications', workerNotifId, {
            title: '❌ Pedido de Registo Rejeitado',
            message: `O seu pedido de ${item.date} foi rejeitado pelo cliente.${rejectionMsg}`,
            type: 'error',
            target_type: 'worker',
            target_worker_ids: [String(item.worker_id)],
            created_at: new Date().toISOString(),
            is_active: true,
          });
        }
      }

      handleDismissNotif(notif.id);
      alert('Pedido rejeitado.');
    } catch (error) {
      console.error('Erro ao rejeitar pedido:', error);
      alert('Ocorreu um erro ao rejeitar o pedido.');
    }
  }, [supabase, saveToDb, handleDismissNotif, correctionItems, clientData]);

  return {
    dismissedNotifs,
    expandedCards,
    setExpandedCards,
    myNotifications,
    workerSubmissionsResolved,
    workerSubmissionsPending,
    handleDismissNotif,
    handleAcceptContestation,
    handleApproveCreationRequest,
    handleRejectCreationRequest,
  };
}
