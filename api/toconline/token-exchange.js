import { createClient } from '@supabase/supabase-js';
import { exchangeCode } from './_token.js';

const REDIRECT_URI = process.env.TOCONLINE_REDIRECT_URI || 'https://trabalhador.magneticplace.pt/api/toconline/callback';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Parâmetro "code" obrigatório' });

  try {
    const tokens = await exchangeCode(code, REDIRECT_URI);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase.from('system_settings').update({
      toconline_access_token: tokens.access_token,
      toconline_refresh_token: tokens.refresh_token,
      toconline_token_expires_at: expiresAt,
    }).eq('id', 1);

    if (error) throw new Error(`DB update: ${error.message}`);

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
