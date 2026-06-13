const API_URL = process.env.TOCONLINE_API_URL || 'https://api12.toconline.pt';

export async function tocFetch(path, accessToken, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_URL}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TOConline API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

export async function fetchAllPages(basePath, accessToken) {
  const all = [];
  let page = 1;
  while (true) {
    const sep = basePath.includes('?') ? '&' : '?';
    const data = await tocFetch(`${basePath}${sep}page[number]=${page}&page[size]=100`, accessToken);
    const items = Array.isArray(data) ? data : (data.data || data.items || data.documents || []);
    all.push(...items);
    if (items.length === 0) break;
    const meta = data.meta || data.pagination || {};
    const totalPages = meta.total_pages || meta.last_page || null;
    if (totalPages && page >= totalPages) break;
    if (!totalPages && items.length < 100) break;
    page++;
  }
  return all;
}

export async function obterUrlPdf(docId, tipoDoc, accessToken) {
  const filterType = tipoDoc === 'recibo' ? 'Receipt' : 'Document';
  try {
    const res = await fetch(
      `${API_URL}/api/url_for_print/${docId}?filter[type]=${filterType}&filter[copies]=1`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/vnd.api+json',
          'Accept': 'application/json',
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const attrs = data.data?.attributes || data.attributes || {};
    if (!attrs.scheme || !attrs.host || !attrs.path) return null;
    return `${attrs.scheme}://${attrs.host}${attrs.path}`;
  } catch {
    return null;
  }
}
