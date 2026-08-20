import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_authUtils.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;

  const { worker_id } = req.query;
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  let query = supabase
    .from('worker_certificacoes_ativas')
    .select('*')
    .order('data_validade', { ascending: true });

  if (worker_id) query = query.eq('worker_id', worker_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ certificacoes: data || [] });
}
