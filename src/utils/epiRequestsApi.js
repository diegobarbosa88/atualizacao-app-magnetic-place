// Funções puras (supabase, payload) => ... para o fluxo de Solicitação de
// EPI — mesmo espírito de absenceRequestsApi.js, reutilizáveis entre o
// dashboard do trabalhador e o painel admin.

import { notifyEvent, TARGET, newId } from './notifyEvent';

export const newEpiRequestId = () => newId('epi');

export async function createEpiRequest(supabase, { worker, typeId, typeLabel, qty, size, motivo, notes }) {
  const id = newEpiRequestId();
  const { error } = await supabase.from('epi_requests').insert({
    id,
    worker_id: worker.id,
    worker_name: worker.name,
    client_id: worker.defaultClientId || null,
    type_id: typeId,
    qty,
    size: size || null,
    motivo,
    notes: notes || null,
    status: 'pending',
  });
  if (error) throw error;

  await notifyEvent(supabase, {
    idPrefix: 'notif_epi',
    title: 'Pedido de EPI',
    message: `${worker.name} pediu ${qty} un. de ${typeLabel}${size ? ` (tam. ${size})` : ''}.`,
    type: 'info',
    target: TARGET.ADMIN,
    banner: false,
    push: { url: '/?view=admin', tag: 'epi' },
    payload: { epiRequestId: id, kind: 'epi' },
  });

  return id;
}

export async function notifyWorkerEpiApproved(supabase, { workerId, typeLabel, requestId }) {
  return notifyEvent(supabase, {
    idPrefix: 'notif_epi_ok',
    title: '✅ Pedido de EPI aprovado',
    message: `O teu pedido de ${typeLabel} foi aprovado — aguarda entrega.`,
    type: 'success',
    target: TARGET.WORKER,
    targetWorkerIds: [workerId],
    payload: { epiRequestId: requestId, kind: 'epi' },
    push: { url: '/worker', tag: 'epi-approved' },
  });
}

export async function notifyWorkerEpiRejected(supabase, { workerId, typeLabel, requestId, reason }) {
  return notifyEvent(supabase, {
    idPrefix: 'notif_epi_rej',
    title: '✕ Pedido de EPI rejeitado',
    message: `O teu pedido de ${typeLabel} foi rejeitado.${reason ? ` Motivo: ${reason}` : ''}`,
    type: 'warning',
    target: TARGET.WORKER,
    targetWorkerIds: [workerId],
    payload: { epiRequestId: requestId, kind: 'epi' },
    push: { url: '/worker', tag: 'epi-rejected' },
  });
}

export async function notifyWorkerEpiDelivered(supabase, { workerId, typeLabel, requestId }) {
  return notifyEvent(supabase, {
    idPrefix: 'notif_epi_delivered',
    title: '📦 EPI entregue',
    message: `${typeLabel} foi marcado como entregue.`,
    type: 'success',
    target: TARGET.WORKER,
    targetWorkerIds: [workerId],
    payload: { epiRequestId: requestId, kind: 'epi' },
    push: { url: '/worker', tag: 'epi-delivered' },
  });
}
