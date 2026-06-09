import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('system_settings')
    .select('toconline_access_token, toconline_token_expires_at')
    .eq('id', 1)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  if (!data?.toconline_access_token) {
    return res.status(200).json({ ligado: false });
  }

  const expiresAt = data.toconline_token_expires_at ? new Date(data.toconline_token_expires_at) : null;
  const expirado = expiresAt ? expiresAt <= new Date() : false;

  return res.status(200).json({
    ligado: true,
    expirado,
    expires_at: data.toconline_token_expires_at || null,
  });
}
