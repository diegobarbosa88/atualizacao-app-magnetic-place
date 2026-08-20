import { authFetch } from '../../../utils/authFetch';

async function json(res) {
  const body = await res.json().catch(() => ({}));
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
