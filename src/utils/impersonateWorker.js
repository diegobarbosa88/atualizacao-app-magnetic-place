import { authFetch } from './authFetch';

// "Ver Portal" no admin — pede ao servidor um token de sessão próprio do
// trabalhador selecionado (nunca reutiliza o token do admin). Sem isto, os
// endpoints autenticados por token (ex: /api/formacao/minhas) continuavam a
// resolver para a conta do admin, mostrando os mesmos dados independentemente
// do trabalhador escolhido.
export async function impersonarTrabalhador(worker) {
  const res = await authFetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'impersonate', worker_id: worker.id }),
  });
  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(res.ok ? 'Resposta inválida do servidor.' : `Erro ${res.status}`);
  }
  if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
  return body;
}
