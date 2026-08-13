// fetch() com o header Authorization: Bearer <token> já incluído
// automaticamente — para endpoints protegidos por requireAuth
// (api/_authUtils.js). Mesma assinatura do fetch nativo, para ser um
// substituto direto: authFetch(url, options) em vez de fetch(url, options).
export function authFetch(url, options = {}) {
  const token = localStorage.getItem('magnetic_session_token');
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}
