// absenceRequestsApi — helpers para o fluxo de avisos de falta (worker -> admin/cliente).
// Mesmo espírito de correctionsApi.js: funções puras que recebem `supabase` + payload,
// reutilizáveis entre o dashboard do worker e o painel do admin.

import { sendValidationEmail } from './emailUtils';

export const newId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const safeEmail = (args) => sendValidationEmail(args).catch((e) => console.warn('[absenceRequestsApi] email error', e));

/**
 * Formata a lista de dias em falta em texto curto (ex: "21 ago, 22 ago"),
 * para uso nas mensagens de notificação em vez de apenas a contagem de dias.
 */
export function formatAbsenceDatesLabel(dates) {
  return (dates || [])
    .slice()
    .sort()
    .map(ds => new Date(`${ds}T00:00:00`).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }))
    .join(', ');
}

export function buildAbsenceNotificationMessage({ workerName, dates, reason, notes }) {
  const base = `${workerName} avisou falta (${formatAbsenceDatesLabel(dates)}): ${reason}`;
  return notes ? `${base} — ${notes}` : base;
}

/**
 * Notifica o cliente padrão do worker (dashboard + email) quando uma falta é registada.
 * Sempre automático — não depende de nenhum toggle de configuração.
 */
export async function notifyClientOfAbsence(supabase, { client, workerName, dates, reason, notes, absenceId, portalBase }) {
  if (!supabase || !client) return;

  const message = buildAbsenceNotificationMessage({ workerName, dates, reason, notes });

  const { error } = await supabase.from('app_notifications').insert({
    id: newId('notif_abs_client'),
    title: 'Aviso de Falta',
    message,
    type: 'warning',
    target_type: 'client',
    target_client_id: String(client.id),
    payload: { absenceId, kind: 'absence' },
    is_dismissible: true,
    is_active: true,
    viewed_by_ids: [],
    dismissed_by_ids: [],
    created_at: new Date().toISOString(),
  });
  if (error) console.error('[absenceRequestsApi] falha ao notificar cliente:', error);

  if (client.email) {
    const origin = portalBase || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');
    safeEmail({
      to: client.email,
      name: client.name,
      title: 'Aviso de Falta',
      message,
      link: `${origin}?view=client_portal&client=${encodeURIComponent(client.id)}`,
    });
  }
}

/**
 * Apaga um pedido de falta, preservando o registo completo em
 * absence_requests_audit_log antes da exclusão real.
 */
export async function deleteAbsenceRequest(supabase, req, { actorId, actorName, actorRole }) {
  if (!supabase) throw new Error('Supabase indisponível');

  const { error: e1 } = await supabase.from('absence_requests_audit_log').insert({
    id: newId('absaudit'),
    absence_request_id: req.id,
    worker_id: req.worker_id,
    worker_name: req.worker_name,
    client_id: req.client_id || null,
    dates: req.dates || [],
    reason: req.reason || null,
    notes: req.notes || null,
    status: req.status,
    original_created_at: req.created_at || null,
    deleted_by: actorId,
    deleted_by_role: actorRole,
    deleted_at: new Date().toISOString(),
  });
  if (e1) throw e1;

  const { error: e2 } = await supabase.from('absence_requests').delete().eq('id', req.id);
  if (e2) throw e2;
}
