const API_URL = process.env.TOCONLINE_API_URL || 'https://api12.toconline.pt';

const MAX_TENTATIVAS = 3;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Devolve o atraso (ms) antes da próxima tentativa, ou null se não se deve repetir.
function calcularBackoff(res, tentativa) {
  // Respeita Retry-After (segundos ou data HTTP) quando presente.
  const retryAfter = res?.headers?.get?.('retry-after');
  if (retryAfter) {
    const segundos = Number(retryAfter);
    if (Number.isFinite(segundos)) return segundos * 1000;
    const data = Date.parse(retryAfter);
    if (!Number.isNaN(data)) return Math.max(0, data - Date.now());
  }
  // Backoff exponencial com jitter: ~1s, ~2s, ~4s.
  return 2 ** (tentativa - 1) * 1000 + Math.floor(Math.random() * 250);
}

function deveRepetir(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

// Extrai o array errors[] JSON:API do corpo de erro, se existir.
function parsearTocErrors(text) {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed?.errors) ? parsed.errors : null;
  } catch {
    return null;
  }
}

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

  let ultimoErro;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    let res;
    try {
      res = await fetch(`${API_URL}${path}`, opts);
    } catch (e) {
      // Erro de rede — repetir com backoff enquanto houver tentativas.
      ultimoErro = e;
      if (tentativa < MAX_TENTATIVAS) {
        await sleep(2 ** (tentativa - 1) * 1000 + Math.floor(Math.random() * 250));
        continue;
      }
      throw e;
    }

    if (res.ok) return res.json();

    const text = await res.text();
    if (deveRepetir(res.status) && tentativa < MAX_TENTATIVAS) {
      await sleep(calcularBackoff(res, tentativa));
      ultimoErro = new Error(`TOConline API ${method} ${path} → ${res.status}: ${text}`);
      continue;
    }

    // Erro definitivo: lança erro estruturado (mantém a message para callers
    // que só usam e.message, mas anexa status e errors[] parseados).
    const err = new Error(`TOConline API ${method} ${path} → ${res.status}: ${text}`);
    err.status = res.status;
    err.tocErrors = parsearTocErrors(text);
    throw err;
  }

  throw ultimoErro || new Error(`TOConline API ${method} ${path} → falhou após ${MAX_TENTATIVAS} tentativas`);
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
  const filterType = tipoDoc === 'recibo' ? 'Receipt' : tipoDoc === 'fornecedor' ? 'PurchasesDocument' : 'Document';
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
