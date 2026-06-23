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

  // client_id é inteiro na API Powens; grant_type obrigatório na versão actual
  const clientIdInt = parseInt(CLIENT_ID, 10) || CLIENT_ID;
  const body = JSON.stringify({
    client_id: clientIdInt,
    client_secret: CLIENT_SECRET,
    grant_type: 'client_credentials',
  });

  // Tentar /auth/token primeiro (endpoint actual); fallback para /auth/token/new (legacy)
  let access_token;
  for (const path of ['/auth/token', '/auth/token/new']) {
    const tokenUrl = `${POWENS_BASE}${path}`;
    console.info('[powens/_client] getAppToken →', tokenUrl);

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (res.status === 404) {
      console.warn('[powens/_client] 404 em', tokenUrl, '— a tentar próximo endpoint');
      continue;
    }

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Powens ${path} falhou (${res.status}): ${txt}`);
    }

    const data = await res.json();
    // A Powens pode devolver access_token ou token
    access_token = data.access_token ?? data.token;
    if (!access_token) {
      throw new Error(`Powens ${path} não devolveu token. Resposta: ${JSON.stringify(data)}`);
    }
    break;
  }

  if (!access_token) {
    throw new Error('Nenhum endpoint Powens de autenticação respondeu com sucesso');
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
