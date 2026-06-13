import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { getValidToken, exchangeCode } from './_token.js';
import { tocFetch, obterUrlPdf } from './_fetch.js';

const OAUTH_URL = process.env.TOCONLINE_OAUTH_URL || 'https://app12.toconline.pt/oauth';
const CLIENT_ID = process.env.TOCONLINE_CLIENT_ID;
const REDIRECT_URI = process.env.TOCONLINE_REDIRECT_URI || 'https://trabalhador.magneticplace.pt/api/toconline/callback';

const DOC_ENDPOINTS = {
  venda: '/api/v1/commercial_sales_documents',
  compra: '/api/v1/commercial_purchases_documents',
  recibo: '/api/v1/commercial_sales_receipts',
};

const REL_ENDPOINTS = {
  vendas: '/v1/commercial_sales_documents',
  compras: '/v1/commercial_purchases_documents',
  recibos: '/v1/commercial_sales_receipts',
};

const REL_TABLE_PREFIX = { vendas: 'documents', compras: 'purchases_documents', recibos: 'receipts' };

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

  if (action === 'artigos') {
    if (req.method === 'GET') {
      const { page = 1 } = req.query;
      try {
        const [prodData, svcData] = await Promise.all([
          tocFetch(`/api/products?page[number]=${page}&page[size]=50`, accessToken),
          tocFetch(`/api/services?page[number]=${page}&page[size]=50`, accessToken),
        ]);
        const produtos = (Array.isArray(prodData) ? prodData : (prodData.data || [])).map(i => ({ ...i, _kind: 'product' }));
        const servicos = (Array.isArray(svcData) ? svcData : (svcData.data || [])).map(i => ({ ...i, _kind: 'service' }));
        return res.status(200).json({ data: [...servicos, ...produtos], meta: {} });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }
    if (req.method === 'POST') {
      const { descricao, codigo, preco_unitario, tipo = 'Service' } = req.body || {};
      if (!descricao) return res.status(400).json({ error: 'Campo obrigatório: descricao' });
      const endpoint = tipo === 'Product' ? '/api/products' : '/api/services';
      const payload = { data: { type: tipo === 'Product' ? 'products' : 'services', attributes: { item_code: codigo || undefined, item_description: descricao, sales_price: preco_unitario ?? undefined } } };
      try {
        const data = await tocFetch(endpoint, accessToken, 'POST', payload);
        return res.status(201).json({ data: data.data });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (action === 'clientes') {
    if (req.method === 'GET') {
      const { page = 1 } = req.query;
      try {
        const data = await tocFetch(`/api/customers?page[number]=${page}&page[size]=50`, accessToken);
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

  if (action === 'documento') {
    const { id, tipo = 'venda' } = req.method === 'GET' ? req.query : (req.body || {});
    if (!id) return res.status(400).json({ error: 'Parâmetro obrigatório: id' });
    const base = DOC_ENDPOINTS[tipo];
    if (!base) return res.status(400).json({ error: `Tipo inválido: ${tipo}. Use venda, compra ou recibo.` });
    if (req.method === 'GET') {
      try {
        const data = await tocFetch(`${base}/${id}`, accessToken);
        const pdfUrl = await obterUrlPdf(id, tipo, accessToken);
        return res.status(200).json({ data: data.data || data, pdf_url: pdfUrl });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }
    if (req.method === 'DELETE') {
      try {
        const data = await tocFetch(`${base}/${id}/cancel`, accessToken, 'POST');
        return res.status(200).json({ anulado: true, data: data.data || data });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }
    return res.status(405).json({ error: 'Method not allowed' });
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

  return res.status(400).json({ error: `Acção desconhecida: ${action || '(não definida)'}` });
}
