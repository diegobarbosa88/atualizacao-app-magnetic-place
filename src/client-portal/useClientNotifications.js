import { useState, useMemo, useEffect, useCallback } from 'react';
import { approveWorkerRequest, rejectWorkerRequest } from '../utils/clientPortalApi';

export function useClientNotifications({
  appNotifications,
  effectiveClientId,
  corrections,
  correctionItems,
  logs,
  setLogs,
  saveToDb,
  clientData,
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
      if (supabase && effectiveClientId) {
        const notif = appNotifications?.find(n => n.id === id);
        const existing = notif?.dismissed_by_ids || [];
        if (!existing.includes(String(effectiveClientId))) {
          supabase.from('app_notifications')
            .update({ dismissed_by_ids: [...existing, String(effectiveClientId)] })
            .eq('id', id);
        }
      }
      return updated;
    });
  }, [effectiveClientId, supabase, appNotifications]);

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
          const targetClientId = String(effectiveClientId);
          const targetDate = d.date || d.dateLabel || d.rawDate;
          const originalLog = logs.find(l =>
            String(l.workerId || l.worker_id) === targetWorkerId &&
            l.date === targetDate &&
            String(l.clientId || l.client_id) === targetClientId
          );
          const entry = (d.adminEntry || d.editedEntry || d.newEntry) === '--:--' ? null : (d.adminEntry || d.editedEntry || d.newEntry);
          const exit  = (d.adminExit  || d.editedExit  || d.newExit)  === '--:--' ? null : (d.adminExit  || d.editedExit  || d.newExit);
          if (originalLog) {
            updates.push({ id: originalLog.id, data: { ...originalLog, startTime: entry, endTime: exit, breakStart: d.adminBreakStart || d.editedBreakStart || d.newBreakStart, breakEnd: d.adminBreakEnd || d.editedBreakEnd || d.newBreakEnd, hours: d.adminHours || d.editedHours || d.newHours, edited_at: new Date().toISOString(), edited_source: 'client_portal' } });
          } else {
            const newLogId = `log_${crypto.randomUUID()}`;
            inserts.push({ id: newLogId, data: { id: newLogId, date: targetDate, workerId: targetWorkerId, clientId: targetClientId, startTime: entry, endTime: exit, breakStart: d.adminBreakStart || d.editedBreakStart || d.newBreakStart, breakEnd: d.adminBreakEnd || d.editedBreakEnd || d.newBreakEnd, hours: d.adminHours || d.editedHours || d.newHours, created_at: new Date().toISOString(), source: 'client_portal' } });
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
        read_by_ids: [],
      });

      handleDismissNotif(notif.id);
      alert('As alterações foram aplicadas! Por favor, assine agora o relatório atualizado.');
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (error) {
      console.error('Erro ao aplicar contra-proposta:', error);
      alert('Ocorreu um erro ao atualizar os dados. Por favor, tente novamente.');
    }
  }, [clientData, effectiveClientId, logs, saveToDb, setLogs, handleDismissNotif]);

  const handleApproveCreationRequest = useCallback(async (notif) => {
    const correctionId = notif.payload?.correction_id;
    if (!correctionId) { alert('Erro: ID do pedido não encontrado.'); return; }

    const correction = corrections?.find(c => c.id === correctionId);
    const items = (correctionItems || []).filter(it => it.correction_id === correctionId);
    if (!correction) { alert('Erro: Pedido não encontrado.'); return; }

    if (!confirm('Aprovar este pedido de registo? Os horários serão atualizados/criados no relatório.')) return;

    try {
      const results = await approveWorkerRequest(supabase, { clientId: effectiveClientId, clientName: clientData?.name, correction, items });

      const adminNotifId = `accp_cr_${notif.id}_${Date.now()}`;
      await saveToDb('app_notifications', adminNotifId, {
        title: `✅ Pedido de Registo Aprovado: ${clientData?.name || 'Cliente'}`,
        message: `O cliente APROVOU o pedido de registo. Os registos foram atualizados.`,
        type: 'success',
        target_type: 'admin',
        created_at: new Date().toISOString(),
        is_active: true,
        read_by_ids: [],
      });

      handleDismissNotif(notif.id);
      setLogs(prev => {
        const updated = [...prev];
        for (const r of results) {
          if (r.isDeletion) {
            const idxToDel = r.deletedLogId
              ? updated.findIndex(l => l.id === r.deletedLogId)
              : updated.findIndex(l => String(l.workerId) === String(r.worker_id) && l.date === r.date);
            if (idxToDel >= 0) updated.splice(idxToDel, 1);
          } else {
            const idx = updated.findIndex(l => l.id === r.logId);
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], ...r.times };
            } else {
              updated.push({ id: r.logId, workerId: r.worker_id, clientId: effectiveClientId, date: r.date, ...r.times });
            }
          }
        }
        return updated;
      });

      alert(correction.type === 'deletion_request' ? 'Pedido aprovado! Registo eliminado.' : 'Pedido aprovado! Relatório atualizado.');
    } catch (error) {
      console.error('Erro ao aprovar pedido:', error);
      alert('Ocorreu um erro ao aprovar o pedido. Por favor, tente novamente.');
    }
  }, [corrections, correctionItems, supabase, effectiveClientId, saveToDb, handleDismissNotif, setLogs, clientData]);

  const handleRejectCreationRequest = useCallback(async (notif) => {
    const correctionId = notif.payload?.correction_id;
    if (!correctionId) return;

    const correction = corrections?.find(c => c.id === correctionId);
    const items = (correctionItems || []).filter(it => it.correction_id === correctionId);
    if (!correction) { alert('Erro: Pedido não encontrado.'); return; }

    const reason = prompt('Motivo da rejeição (opcional):');
    if (reason === null) return;

    try {
      await rejectWorkerRequest(supabase, { clientId: effectiveClientId, clientName: clientData?.name, correction, items, reason: reason.trim() || undefined });

      const adminNotifId = `rej_cr_${notif.id}_${Date.now()}`;
      await saveToDb('app_notifications', adminNotifId, {
        title: `❌ Pedido de Registo Rejeitado: ${clientData?.name || 'Cliente'}`,
        message: `O cliente REJEITOU o pedido de registo${reason ? `. Motivo: ${reason}` : ''}.`,
        type: 'error',
        target_type: 'admin',
        created_at: new Date().toISOString(),
        is_active: true,
        read_by_ids: [],
      });

      handleDismissNotif(notif.id);
      alert('Pedido rejeitado.');
    } catch (error) {
      console.error('Erro ao rejeitar pedido:', error);
      alert('Ocorreu um erro ao rejeitar o pedido.');
    }
  }, [corrections, correctionItems, supabase, effectiveClientId, saveToDb, handleDismissNotif, clientData]);

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
