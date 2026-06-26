const TIMEOUT_MS = 20_000;

// Fetch centralizado ao endpoint de vendas TOConline.
// O chamador é responsável por calcular o mês correto (com ou sem mesSeguinte).
export async function fetchVendasMes(mesFaturas) {
  const [y, m] = mesFaturas.split('-').map(Number);
  const ultimoDia = new Date(y, m, 0).getDate();
  const params = new URLSearchParams({
    tipo: 'vendas',
    data_de: `${mesFaturas}-01`,
    data_ate: `${mesFaturas}-${String(ultimoDia).padStart(2, '0')}`,
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`/api/toconline/relatorio?${params}`, { signal: ctrl.signal });
    if (res.status === 401) return { ok: false, status: 401, data: [] };
    if (!res.ok) return { ok: false, status: res.status, data: [] };
    let json;
    try { json = await res.json(); } catch { return { ok: false, status: res.status, data: [] }; }
    return { ok: true, status: 200, data: Array.isArray(json.data) ? json.data : [] };
  } catch (e) {
    const isTimeout = e.name === 'AbortError';
    return { ok: false, status: isTimeout ? 408 : 0, data: [], timeout: isTimeout };
  } finally {
    clearTimeout(timer);
  }
}
