/**
 * Cliente partilhado da API Powens (Budget Insight).
 * Gere tokens de aplicação com cache e constrói URLs de webview.
 */

const DOMAIN = process.env.POWENS_DOMAIN;          // ex: magneticplace
const CLIENT_ID = process.env.POWENS_CLIENT_ID;
const CLIENT_SECRET = process.env.POWENS_CLIENT_SECRET;
const APP_URL = process.env.APP_URL || 'https://trabalhador.magneticplace.pt';

export const POWENS_BASE = `https://${DOMAIN}.biapi.pro/2.0`;
export const CALLBACK_URI = `${APP_URL}/api/powens/callback`;

// ─── Cache do token de aplicação ─────────────────────────────────────────────
let _cachedAppToken = null;
let _tokenExpiresAt = 0;

/**
 * Obtém (ou reutiliza do cache) um access_token de aplicação via
 * client_credentials. Expira após 50 min para evitar margin-race com o TTL 1h.
 */
export async function getAppToken() {
  if (_cachedAppToken && Date.now() < _tokenExpiresAt) return _cachedAppToken;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('POWENS_CLIENT_ID / POWENS_CLIENT_SECRET não configurados');
  }

  const res = await fetch(`${POWENS_BASE}/auth/token/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Powens auth/token/new falhou (${res.status}): ${txt}`);
  }

  const { access_token } = await res.json();
  _cachedAppToken = access_token;
  _tokenExpiresAt = Date.now() + 50 * 60 * 1000;
  return access_token;
}

/**
 * Cria (ou recupera) um utilizador Powens e devolve o seu user_token.
 * @param {string|null} powensUserId  ID já guardado no Supabase (null = criar novo)
 * @returns {{ userToken: string, userId: string }}
 */
export async function getUserToken(powensUserId = null) {
  const appToken = await getAppToken();

  if (!powensUserId) {
    // Criar utilizador anónimo Powens
    const res = await fetch(`${POWENS_BASE}/users/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${appToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Powens criar utilizador falhou (${res.status}): ${txt}`);
    }
    const user = await res.json();
    powensUserId = String(user.id);
  }

  // Obter token do utilizador
  const res = await fetch(`${POWENS_BASE}/users/${powensUserId}/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${appToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ client_id: CLIENT_ID }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Powens user token falhou (${res.status}): ${txt}`);
  }

  const { access_token } = await res.json();
  return { userToken: access_token, userId: powensUserId };
}

/**
 * Constrói a URL do Webview Powens com idioma Português (pt).
 *
 * Padrão oficial: https://webview.powens.com/{lang}/{flow}?domain=...
 *
 * @param {'connect'|'manage'|'pay'} flow
 * @param {Record<string,string>} extraParams  Parâmetros adicionais (token, state, etc.)
 * @returns {string}
 */
export function buildWebviewUrl(flow, extraParams = {}) {
  if (!DOMAIN || !CLIENT_ID) {
    throw new Error('POWENS_DOMAIN / POWENS_CLIENT_ID não configurados');
  }

  const qs = new URLSearchParams({
    domain: `${DOMAIN}.biapi.pro`,
    client_id: CLIENT_ID,
    redirect_uri: CALLBACK_URI,
    ...extraParams,
  });

  // Idioma forçado a 'pt' conforme directrizes Powens para Portugal
  return `https://webview.powens.com/pt/${flow}?${qs.toString()}`;
}

/**
 * Chamada genérica autenticada à API Powens (como app, não como utilizador).
 */
export async function powensRequest(method, path, body = null) {
  const appToken = await getAppToken();
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${appToken}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${POWENS_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      `Powens ${method} ${path} falhou (${res.status}): ${data.message || JSON.stringify(data)}`
    );
  }
  return data;
}

export { APP_URL, CLIENT_ID, DOMAIN };
