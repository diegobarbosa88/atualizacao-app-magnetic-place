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

export function listFormacoes({ workerId, ano, categoria, estado, formato } = {}) {
  const params = new URLSearchParams();
  if (workerId) params.set('worker_id', workerId);
  if (ano) params.set('ano', ano);
  if (categoria) params.set('categoria', categoria);
  if (estado) params.set('estado', estado);
  if (formato) params.set('formato', formato);
  const qs = params.toString();
  return authFetch(`/api/formacao/list${qs ? `?${qs}` : ''}`).then(json);
}

export function createFormacao(payload) {
  return authFetch('/api/formacao/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(json);
}

export function atribuirParticipantes(formacaoId, participantes) {
  return authFetch('/api/formacao/atribuir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formacao_id: formacaoId, participantes }),
  }).then(json);
}

export function horasPorTrabalhador(ano) {
  const params = new URLSearchParams();
  if (ano) params.set('ano', ano);
  const qs = params.toString();
  return authFetch(`/api/formacao/horas-por-trabalhador${qs ? `?${qs}` : ''}`).then(json);
}

export function listCertificacoes({ workerId } = {}) {
  const params = new URLSearchParams();
  if (workerId) params.set('worker_id', workerId);
  const qs = params.toString();
  return authFetch(`/api/formacao/certificacoes${qs ? `?${qs}` : ''}`).then(json);
}

export function listRequisitosProfissao() {
  return authFetch('/api/formacao/requisitos').then(json);
}

export function setRequisitoProfissao(profissaoCnp, formacaoId, ativo) {
  return authFetch('/api/formacao/requisitos-set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profissao_cnp: profissaoCnp, formacao_id: formacaoId, ativo }),
  }).then(json);
}

export function autoAtribuirPorProfissao(workerId, profissaoCnp) {
  return authFetch('/api/formacao/auto-atribuir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ worker_id: workerId, profissao_cnp: profissaoCnp }),
  }).then(json);
}

export function gateStatus() {
  return authFetch('/api/formacao/gate-status').then(json);
}

export function listGateRequisitos() {
  return authFetch('/api/formacao/gate-requisitos').then(json);
}

export function setGateRequisito(formacaoId, ativo) {
  return authFetch('/api/formacao/gate-requisitos-set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formacao_id: formacaoId, ativo }),
  }).then(json);
}
