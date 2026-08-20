import { authFetch } from '../../../utils/authFetch';

async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
  return body;
}

export function listFormacoes({ workerId, ano, categoria, estado } = {}) {
  const params = new URLSearchParams();
  if (workerId) params.set('worker_id', workerId);
  if (ano) params.set('ano', ano);
  if (categoria) params.set('categoria', categoria);
  if (estado) params.set('estado', estado);
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
