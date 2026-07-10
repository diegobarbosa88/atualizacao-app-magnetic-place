// clientPortalApi — ações diretas do cliente no portal (CRUD de logs + aprovação de pedidos de trabalhadores).
// Cada ação é registada em client_portal_audit_logs para auditoria pelo admin.

import { calculateDuration } from './formatUtils';

// Data de corte: pedidos de trabalhadores submetidos antes desta data não aparecem no portal do cliente
// (foram tratados pelo admin antes da implementação desta funcionalidade).
export const CLIENT_REQUESTS_CUTOFF = '2026-07-10';

const newId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const normalizeTime = (t) => (!t || t === '--:--' ? null : t);

function buildLogTimes({ startTime, endTime, breakStart, breakEnd }) {
  const s = normalizeTime(startTime);
  const e = normalizeTime(endTime);
  const bs = normalizeTime(breakStart);
  const be = normalizeTime(breakEnd);
  return {
    startTime: s,
    endTime: e,
    breakStart: bs,
    breakEnd: be,
    hours: calculateDuration(s, e, bs, be),
  };
}

async function recordAudit(supabase, { clientId, clientName, action, workerId, workerName, logId, date, beforeData, afterData, note }) {
  const { error } = await supabase.from('client_portal_audit_logs').insert({
    id: newId('cpa'),
    client_id: String(clientId),
    client_name: clientName || null,
    action,
    worker_id: workerId ? String(workerId) : null,
    worker_name: workerName || null,
    log_id: logId || null,
    date: date || null,
    before_data: beforeData || null,
    after_data: afterData || null,
    note: note || null,
    created_at: new Date().toISOString(),
  });
  if (error) console.error('[clientPortalApi] recordAudit falhou:', error.message, { action, clientId });
}

/**
 * Cliente cria um novo registo de horas diretamente.
 */
export async function createLogByClient(supabase, { clientId, clientName, workerId, workerName, date, startTime, endTime, breakStart, breakEnd }) {
  if (!supabase) throw new Error('Supabase indisponível');
  const times = buildLogTimes({ startTime, endTime, breakStart, breakEnd });
  const logId = newId('l');
  const { error } = await supabase.from('logs').insert({
    id: logId,
    workerId: String(workerId),
    clientId: String(clientId),
    date,
    ...times,
    source: 'client_portal',
  });
  if (error) throw error;

  await recordAudit(supabase, {
    clientId, clientName, action: 'log_criado',
    workerId, workerName, logId, date,
    afterData: { ...times, date },
  });

  return logId;
}

/**
 * Cliente edita um registo de horas existente.
 */
export async function updateLogByClient(supabase, { clientId, clientName, workerId, workerName, logId, date, startTime, endTime, breakStart, breakEnd, existingLog }) {
  if (!supabase) throw new Error('Supabase indisponível');
  const times = buildLogTimes({ startTime, endTime, breakStart, breakEnd });
  const { error } = await supabase.from('logs').update({
    ...times,
    edited_at: new Date().toISOString(),
    edited_source: 'client_portal',
  }).eq('id', logId);
  if (error) throw error;

  await recordAudit(supabase, {
    clientId, clientName, action: 'log_editado',
    workerId, workerName, logId, date,
    beforeData: existingLog ? {
      startTime: existingLog.startTime,
      endTime: existingLog.endTime,
      breakStart: existingLog.breakStart,
      breakEnd: existingLog.breakEnd,
      hours: existingLog.hours,
    } : null,
    afterData: { ...times, date },
  });
}

/**
 * Cliente elimina um registo de horas.
 */
export async function deleteLogByClient(supabase, { clientId, clientName, workerId, workerName, logId, date, existingLog }) {
  if (!supabase) throw new Error('Supabase indisponível');
  const { error } = await supabase.from('logs').delete().eq('id', logId);
  if (error) throw error;

  await recordAudit(supabase, {
    clientId, clientName, action: 'log_eliminado',
    workerId, workerName, logId, date,
    beforeData: existingLog ? {
      startTime: existingLog.startTime,
      endTime: existingLog.endTime,
      breakStart: existingLog.breakStart,
      breakEnd: existingLog.breakEnd,
      hours: existingLog.hours,
    } : null,
  });
}

/**
 * Cliente aprova um pedido de criação/edição submetido por trabalhador limitado.
 * Aplica o log diretamente e marca a correction como 'applied'.
 */
export async function approveWorkerRequest(supabase, { clientId, clientName, correction, items }) {
  if (!supabase) throw new Error('Supabase indisponível');

  for (const item of items) {
    const proposed = item.proposed;
    const isDeletion = !proposed || (!proposed.startTime && !proposed.endTime);

    if (isDeletion) {
      // deletion_request: apagar o registo referenciado
      if (item.before?.log_id) {
        const { error } = await supabase.from('logs').delete().eq('id', item.before.log_id);
        if (error) throw error;
      } else if (item.worker_id && item.date) {
        const { error } = await supabase.from('logs').delete()
          .eq('workerId', item.worker_id)
          .eq('date', item.date);
        if (error) throw error;
      }
      continue;
    }

    // creation_request ou edição: verificar se existe registo provisional
    let existing = null;
    if (item.before) {
      const { data } = await supabase.from('logs').select('*')
        .eq('workerId', item.worker_id).eq('date', item.date).limit(1).maybeSingle();
      existing = data;
    }

    const times = buildLogTimes(proposed);

    if (item.before && existing) {
      const { error } = await supabase.from('logs').update({
        ...times,
        edited_at: new Date().toISOString(),
        edited_source: 'client_portal',
      }).eq('id', existing.id);
      if (error) throw error;
    } else {
      // Verificar se existe log provisional criado pelo worker
      const { data: provisional } = await supabase.from('logs').select('id, endTime')
        .eq('workerId', item.worker_id).eq('date', item.date).eq('source', 'request').maybeSingle();

      const logId = provisional?.id || newId('l');
      if (provisional) {
        const endTime = provisional.endTime ?? times.endTime ?? null;
        const finalTimes = buildLogTimes({ startTime: times.startTime, endTime, breakStart: times.breakStart, breakEnd: times.breakEnd });
        const { error } = await supabase.from('logs').update({
          ...finalTimes,
          edited_at: new Date().toISOString(),
          edited_source: 'client_portal',
        }).eq('id', provisional.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('logs').insert({
          id: logId,
          workerId: String(item.worker_id),
          clientId: String(correction.client_id),
          date: item.date,
          ...times,
          source: 'client_portal',
        });
        if (error) throw error;
      }
    }
  }

  await supabase.from('corrections').update({
    status: 'applied',
    reviewed_at: new Date().toISOString(),
    reviewed_by: `client:${clientId}`,
  }).eq('id', correction.id);

  // Audit sempre registado ao nível da correction (independente de items)
  const workerId = items[0]?.worker_id;
  const workerName = items[0]?.worker_name;
  await recordAudit(supabase, {
    clientId, clientName, action: 'pedido_aprovado',
    workerId, workerName, date: items[0]?.date || null,
    note: `Correction ${correction.id} aprovada (${items.length} item(s))`,
  });

  // Notificar o trabalhador (mesmo padrão que o admin)
  await supabase.from('app_notifications').insert({
    id: newId('notif'),
    title: 'Pedido de Registo Aprovado',
    message: 'O seu pedido de registo foi aprovado.',
    type: 'success',
    target_type: 'specific',
    target_worker_ids: workerId ? [String(workerId)] : [],
    payload: { correction_id: correction.id, kind: 'applied' },
    is_active: true,
    is_dismissible: true,
    created_at: new Date().toISOString(),
  });
}

/**
 * Cliente rejeita um pedido de trabalhador limitado.
 */
export async function rejectWorkerRequest(supabase, { clientId, clientName, correction, items, reason }) {
  if (!supabase) throw new Error('Supabase indisponível');

  // Apagar log provisional se existir (pedido para hoje)
  const today = new Date().toLocaleDateString('en-CA');
  for (const item of items) {
    if (item.date === today) {
      await supabase.from('logs').delete()
        .eq('workerId', item.worker_id)
        .eq('date', item.date)
        .eq('source', 'request')
        .is('endTime', null);
    }
  }

  await supabase.from('corrections').update({
    status: 'rejected',
    reviewed_at: new Date().toISOString(),
    reviewed_by: `client:${clientId}`,
  }).eq('id', correction.id);

  // Auditoria
  const workerId = items[0]?.worker_id;
  const workerName = items[0]?.worker_name;
  await recordAudit(supabase, {
    clientId, clientName, action: 'pedido_rejeitado',
    workerId, workerName, date: items[0]?.date || null,
    note: reason ? `Motivo: ${reason}` : `Correction ${correction.id} rejeitada`,
  });

  // Notificar o trabalhador (mesmo padrão que o admin)
  await supabase.from('app_notifications').insert({
    id: newId('notif'),
    title: 'Pedido de Registo Rejeitado',
    message: reason ? `Motivo: ${reason}` : 'O seu pedido de registo foi rejeitado.',
    type: 'error',
    target_type: 'specific',
    target_worker_ids: workerId ? [String(workerId)] : [],
    payload: { correction_id: correction.id, kind: 'rejected' },
    is_active: true,
    is_dismissible: true,
    created_at: new Date().toISOString(),
  });
}
