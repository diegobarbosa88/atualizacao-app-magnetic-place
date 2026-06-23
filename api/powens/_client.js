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

  // Tentativas em ordem: endpoints × encodings
  // Powens sandbox pode usar /auth/token ou /auth/token/new, JSON ou form-encoded
  const tentativas = [
    {
      path: '/auth/token/new',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientIdInt, client_secret: CLIENT_SECRET }),
    },
    {
      path: '/auth/token',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientIdInt, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' }),
    },
    {
      path: '/auth/token/new',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }).toString(),
    },
    {
      path: '/auth/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' }).toString(),
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
