import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const OAUTH_URL = process.env.TOCONLINE_OAUTH_URL || 'https://app12.toconline.pt/oauth';
const CLIENT_ID = process.env.TOCONLINE_CLIENT_ID;
const REDIRECT_URI = process.env.TOCONLINE_REDIRECT_URI || 'https://trabalhador.magneticplace.pt/api/toconline/callback';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!CLIENT_ID) {
    return res.status(500).json({ error: 'Missing TOCONLINE_CLIENT_ID env var' });
  }

  const state = crypto.randomBytes(16).toString('hex');

  // Guardar state para validação CSRF no callback (não fatal se falhar)
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from('system_settings').update({ toconline_oauth_state: state }).eq('id', 1);
    }
  } catch (_) { /* ignorar em dev local */ }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'commercial',
    state,
  });

  const authUrl = `${OAUTH_URL}/auth?${params.toString()}`;
  return res.status(200).json({ authUrl });
}
