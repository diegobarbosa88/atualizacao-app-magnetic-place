import crypto from 'node:crypto';

// Token de sessão assinado — HMAC-SHA256 nativo do Node, sem dependência
// nova (nem jsonwebtoken nem jose). Formato: <payload base64url>.<hmac
// base64url>, mesmo espírito de um JWT compacto mas sem header nem as
// convenções extra da spec — só o que este app precisa: role + id + exp,
// à prova de alteração pelo cliente (qualquer mudança no payload invalida
// o hmac).

const ALGORITMO = 'sha256';

function getSecret() {
  // Fallback SESSION_SECRET_LOCAL_DEV: o `vercel dev` não injeta o nome
  // "SESSION_SECRET" no process.env das funções (parece reservado
  // internamente, mesmo com o valor certo no .env) — só afecta ambiente
  // local, a Vercel em produção/preview injeta SESSION_SECRET normalmente.
  const secret = process.env.SESSION_SECRET || process.env.SESSION_SECRET_LOCAL_DEV;
  if (!secret) throw new Error('SESSION_SECRET não está configurado nas env vars.');
  return secret;
}

function assinar(body, secret) {
  return crypto.createHmac(ALGORITMO, secret).update(body).digest('base64url');
}

export function assinarSessao(payload) {
  const secret = getSecret();
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = assinar(body, secret);
  return `${body}.${hmac}`;
}

// Devolve o payload se o token for válido (assinatura correta e não
// expirado), ou null caso contrário — nunca lança.
export function verificarSessao(token) {
  if (!token || typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 2) return null;
  const [body, hmac] = partes;
  if (!body || !hmac) return null;

  let secret;
  try { secret = getSecret(); } catch { return null; }

  const esperado = assinar(body, secret);
  const a = Buffer.from(hmac);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== 'object') return null;
  if (!payload.exp || Date.now() > payload.exp) return null;

  return payload;
}

// Helper para o topo de cada handler: lê Authorization: Bearer <token>,
// valida, confirma o role. Já responde 401/403 e devolve null quando falha
// — o chamador só precisa de `const sessao = requireAuth(req, res, [...]);
// if (!sessao) return;`.
export function requireAuth(req, res, rolesPermitidos = []) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    res.status(401).json({ error: 'Autenticação necessária — token em falta.' });
    return null;
  }

  const payload = verificarSessao(token);
  if (!payload) {
    res.status(401).json({ error: 'Sessão inválida ou expirada — faz login novamente.' });
    return null;
  }

  if (Array.isArray(rolesPermitidos) && rolesPermitidos.length > 0) {
    // isAdmin cobre o caso de um trabalhador com privilégio de admin (ver
    // api/auth.js) que possa precisar de ações de admin independentemente
    // do dashboard que escolheu ao entrar.
    const rolesEfetivos = [payload.role, payload.isAdmin ? 'admin' : null].filter(Boolean);
    const autorizado = rolesEfetivos.some(r => rolesPermitidos.includes(r));
    if (!autorizado) {
      res.status(403).json({ error: 'Sem permissão para executar esta ação.' });
      return null;
    }
  }

  return payload;
}
