/**
 * Cliente partilhado da API Powens (Budget Insight).
 * Gere tokens de aplicação com cache e constrói URLs de webview.
 */

// Sanitizar POWENS_DOMAIN: aceita "magneticplace", "magneticplace.biapi.pro"
// ou "https://magneticplace.biapi.pro" — extrai sempre só o subdomínio
const _rawDomain = (process.env.POWENS_DOMAIN || '')
  .replace(/^https?:\/\//i, '')   // remover protocolo se presente
  .replace(/\.biapi\.pro.*$/i, '') // remover sufixo .biapi.pro se presente
  .replace(/\/$/, '');             // remover trailing slash
const DOMAIN = _rawDomain;

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
  if (!DOMAIN) {
    throw new Error('POWENS_DOMAIN não configurado');
  }

  // client_id pode ser inteiro na API Powens
  const clientIdInt = parseInt(CLIENT_ID, 10) || CLIENT_ID;

  // Sandbox Powens configurado apenas para PIS (Pay by Bank).
  // Scopes válidos: 'payments' ou 'payments:read-only'.
  // AIS (accounts/transactions) não está disponível neste ambiente.
  const tentativas = [
    {
      path: '/auth/token',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientIdInt, client_secret: CLIENT_SECRET, grant_type: 'client_credentials', scope: 'payments' }),
    },
    {
      path: '/auth/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials', scope: 'payments' }).toString(),
    },
    {
      path: '/auth/token',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientIdInt, client_secret: CLIENT_SECRET, grant_type: 'client_credentials', scope: 'payments:read-only' }),
    },
    {
      // Fallback sem scope — caso sandbox aceite acesso total implícito
      path: '/auth/token',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientIdInt, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' }),
    },
  ];

  let access_token;
  const erros = [];

  for (const t of tentativas) {
    const tokenUrl = `${POWENS_BASE}${t.path}`;
    console.info('[powens/_client] getAppToken →', tokenUrl, t.headers['Content-Type']);

    const res = await fetch(tokenUrl, { method: 'POST', headers: t.headers, body: t.body });

    if (res.status === 404 || res.status === 405) {
      erros.push(`${t.path} (${t.headers['Content-Type']}): ${res.status}`);
      continue;
    }

    if (!res.ok) {
      const txt = await res.text();
      erros.push(`${t.path}: ${res.status} ${txt}`);
      continue;
    }

    const data = await res.json();
    access_token = data.access_token ?? data.token;
    if (access_token) {
      console.info('[powens/_client] token obtido via', tokenUrl);
      break;
    }
    erros.push(`${t.path}: resposta sem token — ${JSON.stringify(data)}`);
  }

  if (!access_token) {
    throw new Error(`Powens auth falhou em todas as tentativas:\n${erros.join('\n')}`);
  }
  _cachedAppToken = access_token;
  _tokenExpiresAt = Date.now() + 50 * 60 * 1000;
  return access_token;
}

/**
 * Cria um novo utilizador Powens via POST /auth/init.
 * Devolve { userId, userToken } — o userToken é permanente (client_id + secret enviados).
 */
export async function createPowensUser() {
  const clientIdInt = parseInt(CLIENT_ID, 10) || CLIENT_ID;
  const res = await fetch(`${POWENS_BASE}/auth/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientIdInt, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Powens /auth/init falhou (${res.status}): ${txt}`);
  }
  // Resposta: { auth_token, type, id_user, expires_in }
  const data = await res.json();
  if (!data.id_user || !data.auth_token) {
    throw new Error(`Powens /auth/init resposta inesperada: ${JSON.stringify(data)}`);
  }
  console.info('[powens/_client] utilizador criado, id_user:', data.id_user);
  return { userId: String(data.id_user), userToken: data.auth_token };
}

/**
 * Obtém token de utilizador existente via POST /auth/renew.
 * Alternativa ao createPowensUser quando o utilizador já existe.
 */
export async function renewUserToken(userId) {
  const clientIdInt = parseInt(CLIENT_ID, 10) || CLIENT_ID;
  const res = await fetch(`${POWENS_BASE}/auth/renew`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientIdInt,
      client_secret: CLIENT_SECRET,
      id_user: parseInt(userId, 10),
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Powens /auth/renew falhou (${res.status}): ${txt}`);
  }
  const data = await res.json();
  const token = data.access_token || data.auth_token;
  if (!token) throw new Error(`Powens /auth/renew sem token: ${JSON.stringify(data)}`);
  return token;
}

/**
 * Chamada autenticada à API Powens como utilizador (user token).
 */
export async function powensUserRequest(method, path, userToken, body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${POWENS_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Powens ${method} ${path} falhou (${res.status}): ${data.message || JSON.stringify(data)}`,
    );
  }
  return data;
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

export { APP_URL, CLIENT_ID, CLIENT_SECRET, DOMAIN };
