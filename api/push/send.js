import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Envia push notifications reais para todas as subscrições de um `role`
// ('admin' | 'worker' | 'client'). Chamado a partir de notifyEvent() no
// browser — mesmo nível de confiança que qualquer outro insert feito com a
// chave anon (sem auth extra), consistente com o resto da app.
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Configuração do servidor em falta' });
    }
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate) {
      return res.status(500).json({ error: 'VAPID não configurado' });
    }

    const { role, userId, title, body, url } = req.body || {};
    if (!role || !title) return res.status(400).json({ error: 'Campos obrigatórios: role, title.' });

    webpush.setVapidDetails('mailto:geral@magneticplace.pt', vapidPublic, vapidPrivate);

    const supabase = supabaseAdmin();
    let query = supabase.from('push_subscriptions').select('*').eq('role', role);
    if (userId) query = query.eq('user_id', String(userId));
    const { data: subs, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    if (!subs?.length) return res.status(200).json({ sent: 0, failed: 0, reason: 'sem subscrições' });

    const payload = JSON.stringify({ title, body: body || '', url: url || '/' });
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
      )
    );

    const deadIds = results
      .map((r, i) => ({ r, sub: subs[i] }))
      .filter(({ r }) => r.status === 'rejected' && [404, 410].includes(r.reason?.statusCode))
      .map(({ sub }) => sub.id);
    if (deadIds.length) {
      await supabase.from('push_subscriptions').delete().in('id', deadIds);
    }

    return res.status(200).json({
      sent: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
