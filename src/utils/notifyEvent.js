// notifyEvent — despachante central de notificações (padronização P0/P1 da
// auditoria de notificações). Substitui os inserts diretos em
// app_notifications espalhados pelos componentes: um único ponto que gera o
// id, aplica os campos de estado padronizados e, quando pedido, envia email
// através do mesmo portão (shouldSendNotification).
//
// target_type continua a gravar os valores já usados na BD (admin/client/
// specific/all) para não quebrar os consumidores existentes — TARGET expõe
// nomes semânticos (WORKER em vez de specific, BROADCAST em vez de all).

import { sendValidationEmail } from './emailUtils';
import { shouldSendNotification } from '../config';

export const TARGET = {
  ADMIN: 'admin',
  CLIENT: 'client',
  WORKER: 'specific',
  BROADCAST: 'all',
};

export const newId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * @param supabase Supabase client
 * @param {object} args
 * @param idPrefix prefixo do id gerado (ex: 'notif_abs_client')
 * @param title, message, type ('success'|'warning'|'error'|'info')
 * @param target um dos valores de TARGET
 * @param targetClientId obrigatório quando target === TARGET.CLIENT
 * @param targetWorkerIds array de ids, obrigatório quando target === TARGET.WORKER
 * @param payload objeto livre (kind, ids relacionados, etc.)
 * @param notifType chave de notification_preferences — se omitido, o email (quando pedido) é sempre enviado
 * @param preferences objeto de notification_preferences, só relevante com notifType
 * @param email { to, name, link } — opcional; só envia se `to` estiver presente
 * @param push { url, image, tag, role, userId, userIds, dedupeKey } — opcional; envia push real.
 *   role/userId(s) são opcionais — se omitidos, infere-se de target/targetClientId/targetWorkerIds
 *   (ADMIN→role 'admin'; CLIENT→role 'client' + userId=targetClientId; WORKER→role 'worker' +
 *   userIds=targetWorkerIds). dedupeKey é opcional — quando fornecido, o endpoint não reenvia se já
 *   tiver mandado com a mesma chave (ver handlePushSend em api/formacao/index.js).
 * @param banner default true — quando false, não grava em app_notifications (o evento passa a existir só como push/email, sem o banner in-app)
 */
export async function notifyEvent(supabase, {
  idPrefix = 'notif',
  title,
  message,
  type = 'info',
  target,
  targetClientId,
  targetWorkerIds,
  payload = {},
  notifType,
  preferences,
  email,
  push,
  banner = true,
}) {
  if (!supabase) return { error: new Error('Supabase indisponível') };

  const id = newId(idPrefix);
  let error;

  if (banner) {
    const row = {
      id,
      title,
      message,
      type,
      target_type: target,
      payload,
      is_dismissible: true,
      is_active: true,
      // estado padronizado (P0) — válido para qualquer perfil
      read_by_ids: [],
      dismissed_by_ids: [],
      // campos legados, preenchidos em paralelo enquanto os consumidores
      // (AdminDashboard, useClientNotifications) não migram para read_by_ids
      viewed_by_ids: [],
      read_by_admin_ids: [],
      created_at: new Date().toISOString(),
    };
    // target_client_id é sempre gravado quando fornecido, mesmo fora de TARGET.CLIENT —
    // alguns eventos (ex: pedido de correção submetido) são dirigidos ao admin mas
    // carregam o cliente de origem como metadado, para o admin saber a quem responder.
    if (targetClientId) row.target_client_id = String(targetClientId);
    if (target === TARGET.WORKER && targetWorkerIds?.length) row.target_worker_ids = targetWorkerIds.map(String);

    const result = await supabase.from('app_notifications').insert(row);
    error = result.error;
    if (error) console.error(`[notifyEvent] falha ao criar notificação (${idPrefix}):`, error);
  }

  if (email?.to) {
    const shouldSend = notifType ? shouldSendNotification(notifType, 'email', preferences) : true;
    if (shouldSend) {
      sendValidationEmail({ to: email.to, name: email.name, title, message, link: email.link })
        .catch((e) => console.warn(`[notifyEvent] falha no email (${idPrefix}):`, e));
    }
  }

  if (push) {
    const role = push.role || (
      target === TARGET.ADMIN ? 'admin' :
      target === TARGET.CLIENT ? 'client' :
      target === TARGET.WORKER ? 'worker' : null
    );
    if (role) {
      const userId = push.userId !== undefined ? push.userId : (target === TARGET.CLIENT ? targetClientId : undefined);
      const userIds = push.userIds || (target === TARGET.WORKER ? targetWorkerIds : undefined);
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          userId: userId != null ? String(userId) : undefined,
          userIds: userIds?.length ? userIds.map(String) : undefined,
          title, body: message, url: push.url, image: push.image, tag: push.tag, type,
          dedupeKey: push.dedupeKey,
        }),
      }).catch((e) => console.warn(`[notifyEvent] falha no push (${idPrefix}):`, e));
    } else {
      console.warn(`[notifyEvent] push pedido sem role determinável (${idPrefix}) — passa push.role explicitamente.`);
    }
  }

  return { error, id };
}
