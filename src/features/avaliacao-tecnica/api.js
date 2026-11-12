import { authFetch } from '../../utils/authFetch';

// Endpoints em api/_avaliacoes.js (rewrites /api/avaliacoes/<ação> em vercel.json).

async function lerResposta(promessa) {
  let res;
  try {
    res = await promessa;
  } catch {
    throw new Error('Sem ligação à internet. Verifique a rede e tente de novo.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const erro = new Error(body.error || `Erro ${res.status}`);
    erro.status = res.status;
    erro.estado = body.estado;
    throw erro;
  }
  return body;
}

const postJson = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// ── Candidato (só com o token do link) ──
export const obterConvite = (token) => lerResposta(fetch(`/api/avaliacoes/publica?token=${encodeURIComponent(token)}`));
export const iniciarProva = (token, candidato) => lerResposta(fetch('/api/avaliacoes/iniciar', postJson({ token, candidato })));
export const submeterProva = (token, envio) => lerResposta(fetch('/api/avaliacoes/submeter', postJson({ token, ...envio })));

// ── Admin (sessão) ──
export const listarAvaliacoes = () => lerResposta(authFetch('/api/avaliacoes/listar')).then((b) => b.data);
export const obterAvaliacao = (id) => lerResposta(authFetch(`/api/avaliacoes/obter?id=${encodeURIComponent(id)}`)).then((b) => b.data);
export const criarAvaliacao = (dados) => lerResposta(authFetch('/api/avaliacoes/criar', postJson(dados))).then((b) => b.data);
export const reabrirAvaliacao = (id) => lerResposta(authFetch('/api/avaliacoes/reabrir', postJson({ id }))).then((b) => b.data);
export const cancelarAvaliacao = (id) => lerResposta(authFetch('/api/avaliacoes/cancelar', postJson({ id }))).then((b) => b.data);
export const apagarAvaliacao = (id) => lerResposta(authFetch('/api/avaliacoes/apagar', postJson({ id })));

export const linkDaAvaliacao = (token) => `${window.location.origin}/avaliacao/${token}`;
