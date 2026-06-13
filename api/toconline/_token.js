import { createClient } from '@supabase/supabase-js';

const OAUTH_URL = process.env.TOCONLINE_OAUTH_URL || 'https://app12.toconline.pt/oauth';
const CLIENT_ID = process.env.TOCONLINE_CLIENT_ID;
const CLIENT_SECRET = process.env.TOCONLINE_CLIENT_SECRET;

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function fetchTokens(params) {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${OAUTH_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TOConline token error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function exchangeCode(code, redirectUri) {
  return fetchTokens({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
}

export async function refreshTokens(refreshToken) {
  return fetchTokens({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

export async function getValidToken() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('system_settings')
    .select('toconline_access_token, toconline_refresh_token, toconline_token_expires_at')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw new Error(`system_settings read: ${error.message}`);
  if (!data?.toconline_access_token) throw new Error('TOConline não está ligado. Autentique primeiro.');

  const expiresAt = data.toconline_token_expires_at ? new Date(data.toconline_token_expires_at) : null;
  const isExpired = !expiresAt || expiresAt <= new Date(Date.now() + 60_000);

  if (!isExpired) return data.toconline_access_token;

  // Refresh
  const tokens = await refreshTokens(data.toconline_refresh_token);
  const newExpires = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase.from('system_settings').update({
    toconline_access_token: tokens.access_token,
    toconline_refresh_token: tokens.refresh_token || data.toconline_refresh_token,
    toconline_token_expires_at: newExpires,
  }).eq('id', 1);

  return tokens.access_token;
}
