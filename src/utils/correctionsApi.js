// correctionsApi — helpers around the `corrections` + `correction_items` tables.
// Single source of truth for the client→admin correction flow (v2).

import { calculateDuration } from './formatUtils';
import { sendValidationEmail } from './emailUtils';
import { DISABLE_CLIENT_NOTIFICATIONS } from '../config';

const safeEmail = (args) => sendValidationEmail(args).catch((e) => console.warn('email error', e));

const buildClientLink = (clientId, month, base, shareToken) => {
  const origin = base || (typeof window !== 'undefined' ? window.location.origin : '');
  if (shareToken) {
    return `${origin}/?token=${encodeURIComponent(shareToken)}&month=${encodeURIComponent(month)}`;
  }
  return `${origin}/?view=client_portal&client=${encodeURIComponent(clientId)}&month=${encodeURIComponent(month)}`;
};
const buildAdminLink = (base) => {
  const origin = base || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}/?view=admin`;
};

const newId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeTime = (t) => (!t || t === '--:--' ? null : t);

const buildLogShape = ({ startTime, endTime, breakStart, breakEnd, hours }) => ({
  startTime: normalizeTime(startTime),
  endTime: normalizeTime(endTime),
  breakStart: normalizeTime(breakStart),
  breakEnd: normalizeTime(breakEnd),
  hours: calculateDuration(normalizeTime(startTime), normalizeTime(endTime), normalizeTime(breakStart), normalizeTime(breakEnd)),
});

/**
 * Client submits a correction.
 *
 * @param supabase Supabase client
 * @param payload {
 *   clientId, month, type ('quick'|'precision'), justification,
 *   submittedBy, items: [{ workerId, workerName, date, before, proposed }]
 * }
 * @returns the created correction row
 */
export async function submitCorrection(supabase, payload) {
  if (!supabase) throw new Error('Supabase indisponível');
  const correctionId = newId('corr');
  const now = new Date().toISOString();

  const correction = {
    id: correctionId,
    client_id: String(payload.clientId),
    month: payload.month,
    type: payload.type || 'quick',
    status: 'submitted',
    submitted_at: now,
    submitted_by: payload.submittedBy ? String(payload.submittedBy) : null,
    justification: payload.justification || null,
  };

  const { error: e1 } = await supabase.from('corrections').insert(correction);
  if (e1) throw e1;

  const items = (payload.items || []).map((it) => ({
    id: newId('citem'),
    correction_id: correctionId,
    worker_id: it.workerId ? String(it.workerId) : null,
    worker_name: it.workerName || null,
    date: it.date || null,
    before: it.before ? buildLogShape(it.before) : null,
    proposed: it.proposed ? buildLogShape(it.proposed) : null,
    final: null,
    item_status: 'pending',
  }));

  if (items.length > 0) {
    const { error: e2 } = await supabase.from('correction_items').insert(items);
    if (e2) throw e2;
  }

  // Thin notification pointer (no payload duplication)
  const typeLabel = (payload.type || 'quick') === 'precision' ? 'Precisão' : (payload.type === 'creation_request' ? 'Criação' : 'Rápido');
  const msgRaw = payload.type === 'precision'
    ? `${items.length} alteração(ões) submetida(s).${payload.justification ? '\n\n' + payload.justification : ''}`
    : (payload.justification || 'Nova correção submetida.');
  const msg = msgRaw.length > 220 ? msgRaw.slice(0, 220) + '…' : msgRaw;
  const notifTitle = payload.type === 'creation_request' ? 'Pedido de Registo' : 'Pedido de Correção';
  await supabase.from('app_notifications').insert({
    id: newId('notif'),
    title: `${notifTitle} · ${payload.month} · ${typeLabel}`,
    message: msg,
    type: 'warning',
    target_type: 'admin',
    target_client_id: String(payload.clientId),
    payload: { correction_id: correctionId, kind: 'submitted' },
    is_active: true,
    is_dismissible: true,
    created_at: now,
  });

  if (payload.adminEmail) {
    safeEmail({
      to: payload.adminEmail,
      name: 'Admin',
      title: `${notifTitle} · ${payload.month} · ${typeLabel}`,
      message: `Cliente ${payload.clientName || payload.clientId} submeteu uma correção.\n\n${msg}`,
      link: buildAdminLink(payload.portalBase),
    });
  }

  return { ...correction, items };
}

export async function markUnderReview(supabase, correctionId, reviewer) {
  const { error } = await supabase
    .from('corrections')
    .update({ status: 'under_review', reviewed_by: reviewer ? String(reviewer) : null })
    .eq('id', correctionId)
    .eq('status', 'submitted');
  if (error) throw error;
}

export async function setItemResolution(supabase, itemId, { itemStatus, finalValues, adminNote }) {
  const patch = { item_status: itemStatus };
  if (itemStatus === 'accepted' || itemStatus === 'edited') {
    patch.final = finalValues ? buildLogShape(finalValues) : null;
  } else if (itemStatus === 'rejected') {
    patch.final = null;
  }
  if (adminNote !== undefined) patch.admin_note = adminNote;
  const { error } = await supabase.from('correction_items').update(patch).eq('id', itemId);
  if (error) throw error;
}

/**
 * Apply a correction: write resolved items into `logs`, mark correction applied,
 * notify the client. Items still `pending` block the apply.
 */
export async function applyCorrection(supabase, { correction, items, logs, clientName, clientEmail, portalBase }) {
  if (!supabase) throw new Error('Supabase indisponível');

  const unresolved = items.filter((it) => it.item_status === 'pending');
  if (unresolved.length > 0) {
    throw new Error(`Há ${unresolved.length} item(ns) por resolver. Aceite, edite ou rejeite cada um.`);
  }

  const resolvedItems = items.filter((it) => it.item_status === 'accepted' || it.item_status === 'edited');

  const results = await Promise.allSettled(
    resolvedItems.map(async (it) => {
      const final = it.final || it.proposed;
      if (!final) return;
      const existing = logs.find(
        (l) => String(l.workerId) === String(it.worker_id) && l.date === it.date
      );
      const isRemove = !final.startTime && !final.endTime && !final.breakStart && !final.breakEnd;
      if (isRemove) {
        if (existing) {
          const { error } = await supabase.from('logs').delete().eq('id', existing.id);
          if (error) throw error;
        }
        return;
      }
      if (existing) {
        const { error } = await supabase.from('logs').upsert({
          ...existing,
          startTime: normalizeTime(final.startTime),
          endTime: normalizeTime(final.endTime),
          breakStart: normalizeTime(final.breakStart),
          breakEnd: normalizeTime(final.breakEnd),
          hours: calculateDuration(normalizeTime(final.startTime), normalizeTime(final.endTime), normalizeTime(final.breakStart), normalizeTime(final.breakEnd)),
        }, { onConflict: 'id' });
        if (error) throw error;
      } else if (final.startTime && final.endTime && it.date) {
        const logId = newId('l');
        const { error } = await supabase.from('logs').insert({
          id: logId,
          workerId: String(it.worker_id),
          clientId: String(correction.client_id),
          date: it.date,
          startTime: normalizeTime(final.startTime),
          endTime: normalizeTime(final.endTime),
          breakStart: normalizeTime(final.breakStart),
          breakEnd: normalizeTime(final.breakEnd),
          hours: calculateDuration(normalizeTime(final.startTime), normalizeTime(final.endTime), normalizeTime(final.breakStart), normalizeTime(final.breakEnd)),
        });
        if (error) throw error;
      }
    })
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    const reasons = failed.map((r) => r.reason?.message || String(r.reason)).join('; ');
    throw new Error(`Falha ao aplicar ${failed.length} item(ns): ${reasons}`);
  }

  const { error: e2 } = await supabase
    .from('correction_items')
    .delete()
    .eq('correction_id', correction.id);
  if (e2) throw e2;

  const { error: e3 } = await supabase
    .from('corrections')
    .update({ status: 'applied' })
    .eq('id', correction.id);
  if (e3) throw e3;

  if (!DISABLE_CLIENT_NOTIFICATIONS) {
    await supabase.from('app_notifications').insert({
      id: newId('notif'),
      title: `Correção Aplicada: ${clientName || ''}`.trim(),
      message: `A sua correção para ${correction.month} foi aplicada.`,
      type: 'success',
      target_type: 'client',
      target_client_id: String(correction.client_id),
      payload: { correction_id: correction.id, kind: 'applied' },
      is_active: true,
      is_dismissible: true,
      created_at: new Date().toISOString(),
    });
  }

  if (clientEmail && !DISABLE_CLIENT_NOTIFICATIONS) {
    safeEmail({
      to: clientEmail,
      name: clientName,
      title: `Correção Aplicada · ${correction.month}`,
      message: `A sua correção para ${correction.month} foi aplicada. Pode consultar o relatório actualizado no portal.`,
      link: buildClientLink(correction.client_id, correction.month, portalBase),
    });
  }
}

/**
 * Admin builds items on the fly (typically from a quick correction) and applies them
 * straight away. Each draft item is inserted as `accepted` with `final = proposed`,
 * then standard apply runs.
 */
export async function applyAdminDraftToQuick(supabase, { correction, draftItems, logs, reviewer, clientName, clientEmail, portalBase }) {
  if (!supabase) throw new Error('Supabase indisponível');
  if (!draftItems || draftItems.length === 0) throw new Error('Nenhuma alteração para aplicar.');

  const rows = draftItems.map((it) => {
    const proposed = it.proposed ? buildLogShape(it.proposed) : null;
    return {
      id: newId('citem'),
      correction_id: correction.id,
      worker_id: it.workerId ? String(it.workerId) : null,
      worker_name: it.workerName || null,
      date: it.date || null,
      before: it.before ? buildLogShape(it.before) : null,
      proposed,
      final: proposed,
      item_status: 'accepted',
    };
  });

  const { error: e1 } = await supabase.from('correction_items').insert(rows);
  if (e1) throw e1;

  await applyCorrection(supabase, { correction, items: rows, logs, reviewer, clientName, clientEmail, portalBase });
}

/**
 * Close a correction as applied without writing to logs (admin handled it elsewhere
 * or the message did not require a change).
 */
export async function markResolved(supabase, { correctionId, clientId, month, note, reviewer, clientName, clientEmail, portalBase }) {
  const { error } = await supabase
    .from('corrections')
    .update({
      status: 'applied',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer ? String(reviewer) : null,
    })
    .eq('id', correctionId);
  if (error) throw error;

  const resolvedMsg = note
    ? `O administrador analisou o seu pedido (${month}).\n\n${note}`
    : `O administrador analisou o seu pedido para ${month}.`;
  if (!DISABLE_CLIENT_NOTIFICATIONS) {
    await supabase.from('app_notifications').insert({
      id: newId('notif'),
      title: `Correção Resolvida: ${clientName || ''}`.trim(),
      message: resolvedMsg,
      type: 'success',
      target_type: 'client',
      target_client_id: String(clientId),
      payload: { correction_id: correctionId, kind: 'resolved' },
      is_active: true,
      is_dismissible: true,
      created_at: new Date().toISOString(),
    });
  }

  if (clientEmail && !DISABLE_CLIENT_NOTIFICATIONS) {
    safeEmail({
      to: clientEmail,
      name: clientName,
      title: `Correção Resolvida · ${month}`,
      message: resolvedMsg,
      link: buildClientLink(clientId, month, portalBase),
    });
  }
}

export async function applyCreationRequest(supabase, { correction, items, clientName, clientEmail, portalBase }) {
  if (!supabase) throw new Error('Supabase indisponível');

  for (const item of items) {
    // deletion_request: proposed is null - delete the log entirely
    if (!item.proposed || (item.proposed && !item.proposed.startTime && !item.proposed.endTime)) {
      if (item.before && item.worker_id && item.date) {
        const { error } = await supabase
          .from('logs')
          .delete()
          .eq('workerId', item.worker_id)
          .eq('date', item.date);
        if (error) throw error;
      }
      continue;
    }

    // creation_request or edit: update or insert log
    let existing = null;
    if (item.before) {
      const { data } = await supabase
        .from('logs')
        .select('*')
        .eq('workerId', item.worker_id)
        .eq('date', item.date)
        .limit(1)
        .maybeSingle();
      existing = data;
    }

    if (item.before && existing) {
      const { error } = await supabase.from('logs').update({
        startTime: item.proposed?.startTime || null,
        endTime: item.proposed?.endTime || null,
        breakStart: item.proposed?.breakStart || null,
        breakEnd: item.proposed?.breakEnd || null,
        hours: calculateDuration(item.proposed?.startTime, item.proposed?.endTime, item.proposed?.breakStart, item.proposed?.breakEnd),
      }).eq('id', existing.id);
      if (error) throw error;
    } else if (!item.before && item.proposed) {
      const logId = newId('l');
      const { error } = await supabase.from('logs').insert({
        id: logId,
        workerId: String(item.worker_id),
        clientId: String(correction.client_id),
        date: item.date,
        startTime: item.proposed.startTime,
        endTime: item.proposed.endTime,
        breakStart: item.proposed.breakStart,
        breakEnd: item.proposed.breakEnd,
        hours: calculateDuration(item.proposed.startTime, item.proposed.endTime, item.proposed.breakStart, item.proposed.breakEnd),
      });
      if (error) throw error;
    }
  }

  await supabase.from('corrections').update({
    status: 'applied',
    reviewed_at: new Date().toISOString(),
  }).eq('id', correction.id);

  const msg = `O seu pedido de registo foi aprovado.`;
  if (!DISABLE_CLIENT_NOTIFICATIONS) {
    await supabase.from('app_notifications').insert({
      id: newId('notif'),
      title: `Pedido de Registo Aprovado: ${clientName || ''}`.trim(),
      message: msg,
      type: 'success',
      target_type: 'client',
      target_client_id: String(correction.client_id),
      payload: { correction_id: correction.id, kind: 'applied' },
      is_active: true,
      is_dismissible: true,
      created_at: new Date().toISOString(),
    });
  }

  if (clientEmail && !DISABLE_CLIENT_NOTIFICATIONS) {
    safeEmail({
      to: clientEmail,
      name: clientName,
      title: `Pedido de Registo Aprovado · ${correction.month}`,
      message: msg,
      link: buildClientLink(correction.client_id, correction.month, portalBase),
    });
  }
}

export async function rejectCorrection(supabase, { correctionId, clientId, month, reason, reviewer, clientName, clientEmail, portalBase }) {
  const { error } = await supabase
    .from('corrections')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer ? String(reviewer) : null,
      justification: reason || null,
    })
    .eq('id', correctionId);
  if (error) throw error;

  const rejectMsg = reason ? `Motivo: ${reason}` : `A sua correção para ${month} foi rejeitada.`;
  if (!DISABLE_CLIENT_NOTIFICATIONS) {
    await supabase.from('app_notifications').insert({
      id: newId('notif'),
      title: `Correção Rejeitada: ${clientName || ''}`.trim(),
      message: rejectMsg,
      type: 'error',
      target_type: 'client',
      target_client_id: String(clientId),
      payload: { correction_id: correctionId, kind: 'rejected' },
      is_active: true,
      is_dismissible: true,
      created_at: new Date().toISOString(),
    });
  }

  if (clientEmail && !DISABLE_CLIENT_NOTIFICATIONS) {
    safeEmail({
      to: clientEmail,
      name: clientName,
      title: `Correção Rejeitada · ${month}`,
      message: rejectMsg,
      link: buildClientLink(clientId, month, portalBase),
    });
  }
}
