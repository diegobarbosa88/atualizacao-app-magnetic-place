import { authFetch } from '../../../utils/authFetch';

async function json(res) {
  let body;
  try {
    body = await res.json();
  } catch {
    // Resposta não é JSON — sintoma típico de as rotas /api/formacao/* não
    // estarem servidas (ex: só o Vite dev a correr, sem `vercel dev`).
    throw new Error(res.ok ? 'Resposta inválida do servidor — API indisponível.' : `Erro ${res.status}`);
  }
  if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
  return body;
}

export function listMinhasFormacoes() {
  return authFetch('/api/formacao/minhas').then(json);
}

export function assinarMinhaFormacao(participanteId, assinaturaBase64) {
  return authFetch('/api/formacao/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participante_id: participanteId, assinatura_base64: assinaturaBase64 }),
  }).then(json);
}

export function iniciarFormacao(participanteId) {
  return authFetch('/api/formacao/iniciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participante_id: participanteId }),
  }).then(json);
}

export function responderQuestionario(participanteId, respostas) {
  return authFetch('/api/formacao/responder-questionario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participante_id: participanteId, respostas }),
  }).then(json);
}

export function getConteudoUrl(participanteId) {
  return authFetch(`/api/formacao/conteudo?participante_id=${encodeURIComponent(participanteId)}`).then(json);
}
