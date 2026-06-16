import { createClient } from '@supabase/supabase-js';
import { exchangeCode } from './_token.js';

const REDIRECT_URI = process.env.TOCONLINE_REDIRECT_URI || 'https://trabalhador.magneticplace.pt/api/toconline/callback';
const APP_URL = process.env.TOCONLINE_APP_URL || 'https://trabalhador.magneticplace.pt';

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query || {};

  if (oauthError) {
    return res.redirect(`${APP_URL}/admin/toconline?toconline_error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return res.status(400).json({ error: 'Missing code parameter' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Validate CSRF state
  const { data: settings } = await supabase
    .from('system_settings')
    .select('toconline_oauth_state')
    .eq('id', 1)
    .maybeSingle();

  if (state && settings?.toconline_oauth_state && settings.toconline_oauth_state !== state) {
    return res.status(400).json({ error: 'Invalid OAuth state — possível ataque CSRF' });
  }

  try {
    const tokens = await exchangeCode(code, REDIRECT_URI);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase.from('system_settings').update({
      toconline_access_token: tokens.access_token,
      toconline_refresh_token: tokens.refresh_token,
      toconline_token_expires_at: expiresAt,
      toconline_oauth_state: null,
    }).eq('id', 1);

    return res.redirect(`${APP_URL}/admin/toconline?toconline_connected=1`);
  } catch (e) {
    return res.redirect(`${APP_URL}/admin/toconline?toconline_error=${encodeURIComponent(e.message)}`);
  }
}
