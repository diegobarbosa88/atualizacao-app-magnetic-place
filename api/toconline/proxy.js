import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { getValidToken, exchangeCode } from './_token.js';
import { tocFetch } from './_fetch.js';

const OAUTH_URL = process.env.TOCONLINE_OAUTH_URL || 'https://app12.toconline.pt/oauth';
const CLIENT_ID = process.env.TOCONLINE_CLIENT_ID;
const REDIRECT_URI = process.env.TOCONLINE_REDIRECT_URI || 'https://trabalhador.magneticplace.pt/api/toconline/callback';

const REL_ENDPOINTS = {
  vendas: '/v1/commercial_sales_documents',
  compras: '/v1/commercial_purchases_documents',
  recibos: '/v1/commercial_sales_receipts',
};

const REL_TABLE_PREFIX = { vendas: 'documents', compras: 'purchases_documents', recibos: 'receipts' };

// NIF/código exato → filter[campo]; texto livre → expressão "campo like '%q%'"
// (mesma sintaxe de filtro já usada na acção `relatorio`). Sem q, pagina tudo.
function buildListQuery(q, likeField, codeField, page, isCode = t => /^\d{9}$/.test(t)) {
  const size = 'page[size]=50';
  const termo = String(q || '').trim();
  if (!termo) return `page[number]=${page}&${size}`;
  if (codeField && isCode(termo)) {
    return `filter[${codeField}]=${encodeURIComponent(termo)}&${size}`;
  }
  const escapado = termo.replace(/'/g, "''");
  const filtro = `filter=${encodeURIComponent(`"${likeField} like '%${escapado}%'"`)}`;
  return `${filtro}&${size}`;
}

export default async function handler(req, res) {
  const { action } = req.query;

  if (action === 'status') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from('system_settings')
      .select('toconline_access_token, toconline_token_expires_at')
      .eq('id', 1)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data?.toconline_access_token) return res.status(200).json({ ligado: false });
    const expiresAt = data.toconline_token_expires_at ? new Date(data.toconline_token_expires_at) : null;
    const expirado = expiresAt ? expiresAt <= new Date() : false;
    return res.status(200).json({ ligado: true, expirado, expires_at: data.toconline_token_expires_at || null });
  }

  if (action === 'auth-init') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    if (!CLIENT_ID) return res.status(500).json({ error: 'Missing TOCONLINE_CLIENT_ID env var' });
    const state = crypto.randomBytes(16).toString('hex');
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('system_settings').update({ toconline_oauth_state: state }).eq('id', 1);
      }
    } catch (_) { /* ignorar em dev local */ }
    const params = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code', scope: 'commercial', state });
    return res.status(200).json({ authUrl: `${OAUTH_URL}/auth?${params.toString()}` });
  }

  if (action === 'token-exchange') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Parâmetro "code" obrigatório' });
    try {
      const tokens = await exchangeCode(code, REDIRECT_URI);
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { error } = await supabase.from('system_settings').update({
        toconline_access_token: tokens.access_token,
        toconline_refresh_token: tokens.refresh_token,
        toconline_token_expires_at: expiresAt,
      }).eq('id', 1);
      if (error) throw new Error(`DB update: ${error.message}`);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  let accessToken;
  try {
    accessToken = await getValidToken();
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  if (action === 'clientes') {
    if (req.method === 'GET') {
      const { page = 1, q } = req.query;
      try {
        const data = await tocFetch(`/api/customers?${buildListQuery(q, 'customers.business_name', 'tax_registration_number', page)}`, accessToken);
        const lista = Array.isArray(data) ? data : (data.data || []);
        return res.status(200).json({ data: lista, meta: data.meta || {} });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }
    if (req.method === 'POST') {
      const { nome, nif, email } = req.body || {};
      if (!nome) return res.status(400).json({ error: 'Campo obrigatório: nome' });
      const payload = { data: { type: 'customers', attributes: { business_name: nome, tax_registration_number: nif || undefined, email: email || undefined } } };
      try {
        const data = await tocFetch('/api/customers', accessToken, 'POST', payload);
        return res.status(201).json({ data: data.data });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (action === 'fornecedores') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const { page = 1 } = req.query;
    try {
      const data = await tocFetch(`/api/suppliers?page[number]=${page}&page[size]=50`, accessToken);
      const lista = Array.isArray(data) ? data : (data.data || []);
      return res.status(200).json({ data: lista, meta: data.meta || {} });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (action === 'artigos') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const { page = 1, q } = req.query;
    // Token compacto com dígito → código exato (item_code); senão texto livre.
    const isCode = t => /^[A-Za-z0-9._/-]+$/.test(t) && /\d/.test(t);
    try {
      const data = await tocFetch(`/api/products?${buildListQuery(q, 'products.item_description', 'item_code', page, isCode)}`, accessToken);
      const lista = Array.isArray(data) ? data : (data.data || []);
      return res.status(200).json({ data: lista, meta: data.meta || {} });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (action === 'relatorio') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const { tipo = 'vendas', data_de, data_ate, page = 1 } = req.query;
    const base = REL_ENDPOINTS[tipo];
    if (!base) return res.status(400).json({ error: `Tipo inválido: ${tipo}. Use vendas, compras ou recibos.` });
    const pref = REL_TABLE_PREFIX[tipo];
    try {
      const filtros = [`page[number]=${page}`, `page[size]=50`];
      if (data_de && data_ate) {
        filtros.push(`filter=${encodeURIComponent(`"${pref}.date>='${data_de}' AND ${pref}.date<='${data_ate}'"`)}`);
      } else if (data_de) {
        filtros.push(`filter=${encodeURIComponent(`"${pref}.date>='${data_de}'"`)}`);
      } else if (data_ate) {
        filtros.push(`filter=${encodeURIComponent(`"${pref}.date<='${data_ate}'"`)}`);
      }
      const data = await tocFetch(`${base}?${filtros.join('&')}`, accessToken);
      const lista = Array.isArray(data) ? data : (data.data || []);
      return res.status(200).json({ data: lista, meta: data.meta || {} });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Pagamentos de compras
  if (action === 'pagamentos-compra') {
    const docId = req.query.doc_id || req.body?.doc_id;
    if (req.method === 'GET') {
      try {
        const params = docId ? `?filter[commercial_purchases_document_id]=${docId}` : '';
        const data = await tocFetch(`/api/v1/commercial_purchases_payments${params}`, accessToken);
        return res.status(200).json(data);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }
    if (req.method === 'POST') {
      const { doc_id: dId, valor, metodo, data: d } = req.body || {};
      const attrs = {
        commercial_purchases_document_id: dId,
        value: Number(valor),
      };
      if (metodo) attrs.payment_method_id = metodo;
      if (d) attrs.date = d;
      const payload = { data: { type: 'commercial_purchases_payments', attributes: attrs } };
      try {
        const data = await tocFetch('/api/v1/commercial_purchases_payments', accessToken, 'POST', payload);
        return res.status(201).json(data);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Parâmetro obrigatório: id' });
      try {
        const data = await tocFetch(`/api/v1/commercial_purchases_payments/${id}`, accessToken, 'DELETE');
        return res.status(200).json(data || {});
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }
    if (req.method === 'PATCH') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Parâmetro obrigatório: id' });
      try {
        const data = await tocFetch(
          `/api/v1/commercial_purchases_payments/${id}`,
          accessToken,
          'PATCH',
          { data: { type: 'commercial_purchases_payments', id, attributes: { finalize: 1 } } }
        );
        return res.status(200).json(data);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(400).json({ error: `Acção desconhecida: ${action || '(não definida)'}` });
}
