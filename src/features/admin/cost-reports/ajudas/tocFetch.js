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
  const res = await fetch(`/api/toconline/relatorio?${params}`);
  if (res.status === 401) return { ok: false, status: 401, data: [] };
  if (!res.ok) return { ok: false, status: res.status, data: [] };
  const json = await res.json();
  return { ok: true, status: 200, data: json.data || [] };
}
