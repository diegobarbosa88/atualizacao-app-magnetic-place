import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { getValidToken, exchangeCode } from './_token.js';
import { tocFetch, fetchAllPages } from './_fetch.js';
import { requireAuth } from '../_authUtils.js';

// CR-07: token-exchange fica de fora do requireAuth — não é uma ação
// disparada por um clique autenticado na nossa UI, é a conclusão do fluxo
// OAuth (chamada automaticamente pelo SPA em app.jsx quando o TOConline
// redireciona de volta com ?code&state, exatamente como callback.js — só
// que aqui é o caminho de fallback quando o redirect não atinge a função
// serverless diretamente). Reportado como caso a confirmar, não decidido
// silenciosamente.
const ACOES_SEM_AUTH = ['token-exchange'];

const OAUTH_URL = process.env.TOCONLINE_OAUTH_URL || 'https://app12.toconline.pt/oauth';
const CLIENT_ID = process.env.TOCONLINE_CLIENT_ID;
const REDIRECT_URI = process.env.TOCONLINE_REDIRECT_URI || 'https://trabalhador.magneticplace.pt/api/toconline/callback';

const REL_ENDPOINTS = {
  vendas: '/v1/commercial_sales_documents',
  compras: '/v1/commercial_purchases_documents',
  recibos: '/v1/commercial_sales_receipts',
};

const REL_TABLE_PREFIX = { vendas: 'documents', compras: 'purchases_documents', recibos: 'receipts' };

async function getSaldoAtual(contaId, initialBalance, accessToken) {
  try {
    const data = await tocFetch(
      `/api/bank_transactions?filter[bank_account_id]=${contaId}&page[size]=1&sort=-transaction_date`,
      accessToken
    );
    const items = Array.isArray(data) ? data : (data.data || []);
    if (items.length === 0) return initialBalance ?? 0;
    const attrs = items[0].attributes || items[0];
    const bal = attrs.imported_balance ?? null;
    return bal != null ? Number(bal) : (initialBalance ?? 0);
  } catch {
    return initialBalance ?? 0;
  }
}

export default async function handler(req, res) {
  const { action } = req.query;

  if (!ACOES_SEM_AUTH.includes(action)) {
    if (!requireAuth(req, res, ['admin'])) return;
  }

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

  if (action === 'bank-accounts') {
    if (req.method === 'GET') {
      const { id, com_saldo, movimentos } = req.query;

      if (movimentos === '1' && id) {
        try {
          // Busca TODAS as páginas — o TOConline não devolve total em meta,
          // e paginar só a pedido (botão "Ver mais") deixava a maioria dos
          // movimentos invisíveis por defeito (ex: 342 de 372 escondidos
          // para a Novo Banco). fetchAllPages já é o padrão usado para a
          // lista de contas (linha ~138) — reaproveitado aqui.
          const items = await fetchAllPages(
            `/api/bank_transactions?filter[bank_account_id]=${id}&sort=-transaction_date`,
            accessToken
          );
          return res.status(200).json({ data: items });
        } catch (e) {
          return res.status(500).json({ error: e.message });
        }
      }

      try {
        if (id) {
          const data = await tocFetch(`/api/bank_accounts/${id}`, accessToken);
          const conta = data.data || data;
          if (com_saldo === '1') {
            const a = conta.attributes || conta;
            const saldo_atual = await getSaldoAtual(conta.id || id, a.initial_balance, accessToken);
            return res.status(200).json({ data: { ...conta, saldo_atual } });
          }
          return res.status(200).json({ data: conta });
        }

        const lista = await fetchAllPages('/api/bank_accounts', accessToken);
        const contasBancarias = lista.filter(c => {
          const a = c.attributes || c;
          return a.entity_type === 'Company';
        });

        if (com_saldo === '1') {
          const enriquecida = await Promise.all(contasBancarias.map(async (c) => {
            const a = c.attributes || c;
            const saldo_atual = await getSaldoAtual(c.id, a.initial_balance, accessToken);
            return { ...c, saldo_atual };
          }));
          return res.status(200).json({ data: enriquecida });
        }

        return res.status(200).json({ data: contasBancarias });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    if (req.method === 'POST') {
      const { nome, iban, banco, moeda = 'EUR', saldo_inicial = 0 } = req.body || {};
      if (!nome) return res.status(400).json({ error: 'Campo obrigatório: nome' });
      const payload = {
        data: {
          type: 'bank_accounts',
          attributes: {
            name: nome,
            iban: iban || undefined,
            description: banco || undefined,
            initial_balance: saldo_inicial,
          },
        },
      };
      try {
        const data = await tocFetch('/api/bank_accounts', accessToken, 'POST', payload);
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
