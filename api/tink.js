import { createClient } from '@supabase/supabase-js';

const TINK_CLIENT_ID = process.env.TINK_CLIENT_ID;
const TINK_CLIENT_SECRET = process.env.TINK_CLIENT_SECRET;
const TINK_BASE_URL = process.env.TINK_BASE_URL || 'https://api.tink.com';

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function exchangeAuthorizationCode(code) {
  const res = await fetch(`${TINK_BASE_URL}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: TINK_CLIENT_ID,
      client_secret: TINK_CLIENT_SECRET,
      grant_type: 'authorization_code'
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro Tink token exchange (${res.status}): ${text}`);
  }

  return res.json();
}

async function refreshUserTokens(refreshToken) {
  const res = await fetch(`${TINK_BASE_URL}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: TINK_CLIENT_ID,
      client_secret: TINK_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro Tink token refresh (${res.status}): ${text}`);
  }

  return res.json();
}

async function getValidUserToken(db) {
  const { data, error } = await db
    .from('system_settings')
    .select('tink_access_token, tink_refresh_token, tink_token_expires_at')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw new Error(`system_settings: ${error.message}`);
  if (!data?.tink_access_token) {
    throw new Error('Conta bancária Tink não está ligada. Por favor autentique primeiro.');
  }

  const expiresAt = data.tink_token_expires_at ? new Date(data.tink_token_expires_at) : null;
  const isExpired = !expiresAt || expiresAt <= new Date(Date.now() + 60_000);

  if (!isExpired) return data.tink_access_token;

  const tokens = await refreshUserTokens(data.tink_refresh_token);
  const newExpires = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await db.from('system_settings').update({
    tink_access_token: tokens.access_token,
    tink_refresh_token: tokens.refresh_token || data.tink_refresh_token,
    tink_token_expires_at: newExpires,
  }).eq('id', 1);

  return tokens.access_token;
}

export default async function handler(req, res) {
  const { action } = req.query;
  const db = supabaseAdmin();

  if (!TINK_CLIENT_ID || !TINK_CLIENT_SECRET) {
    return res.status(400).json({ error: 'Credenciais Tink (Client ID / Client Secret) não estão configuradas.' });
  }

  try {
    if (action === 'exchange-code') {
      const { code } = req.body || {};
      if (!code) return res.status(400).json({ error: 'Código de autorização obrigatório.' });

      const tokens = await exchangeAuthorizationCode(code);
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      const { error } = await db
        .from('system_settings')
        .update({
          tink_access_token: tokens.access_token,
          tink_refresh_token: tokens.refresh_token,
          tink_token_expires_at: expiresAt
        })
        .eq('id', 1);

      if (error) throw error;

      return res.status(200).json({ ok: true, message: 'Conta bancária Tink ligada com sucesso!' });
    }

    if (action === 'list-accounts') {
      let accessToken;
      try {
        accessToken = await getValidUserToken(db);
      } catch (err) {
        return res.status(401).json({ error: err.message, requiresAuth: true });
      }

      const response = await fetch(`${TINK_BASE_URL}/api/v1/accounts/list`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Erro Tink ao listar contas (${response.status}): ${text}`);
      }

      const data = await response.json();
      return res.status(200).json({ data: data.accounts || [] });
    }

    if (action === 'list-transactions') {
      const { accountId } = req.query;
      let accessToken;
      try {
        accessToken = await getValidUserToken(db);
      } catch (err) {
        return res.status(401).json({ error: err.message });
      }

      const params = new URLSearchParams();
      if (accountId) params.set('accountId', accountId);

      const response = await fetch(`${TINK_BASE_URL}/api/v1/transactions?${params}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Erro Tink ao listar transações (${response.status}): ${text}`);
      }

      const data = await response.json();
      return res.status(200).json({ data: data.transactions || [] });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
