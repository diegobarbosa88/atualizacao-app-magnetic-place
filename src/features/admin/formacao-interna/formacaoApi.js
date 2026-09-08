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

// datasConclusao (opcional): { [formacao_id]: 'YYYY-MM-DD' } — quando
// presente para uma formação, o registo já entra concluído nessa data em
// vez de "não iniciado" (trabalhador antigo que já a fez antes de o
// sistema existir, ver SincronizarFormacoesModal.jsx).
export function autoAtribuirPorProfissao(workerId, profissaoCnp, datasConclusao) {
  return authFetch('/api/formacao/auto-atribuir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ worker_id: workerId, profissao_cnp: profissaoCnp, datas_conclusao: datasConclusao }),
  }).then(json);
}

// Lista as formações obrigatórias (por profissão + Gate) deste trabalhador,
// separadas em pendentes (ainda não tem) e já atribuídas — sem atribuir
// nem remover nada.
export function formacoesPendentes(workerId, profissaoCnp) {
  const params = new URLSearchParams({ worker_id: workerId });
  if (profissaoCnp) params.set('profissao_cnp', profissaoCnp);
  return authFetch(`/api/formacao/formacoes-pendentes?${params}`).then(json);
}

// Remove um registo de participante (formacao_participantes) — liberta a
// formação para ser reatribuída depois.
export function removerParticipante(participanteId) {
  return authFetch('/api/formacao/formacao-participante-remover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participante_id: participanteId }),
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
