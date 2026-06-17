import { createClient } from '@supabase/supabase-js';
import { gerarSEPAXml } from './salarios/_sepaXml.js';

const SALTEDGE_APP_ID = process.env.SALTEDGE_APP_ID;
const SALTEDGE_SECRET = process.env.SALTEDGE_SECRET;
const SALTEDGE_BASE_URL = 'https://www.saltedge.com';
const SALTEDGE_SANDBOX = process.env.SALTEDGE_SANDBOX === 'true';

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Headers base Salt Edge (sem assinatura — obrigatória apenas em Live)
function saltEdgeHeaders() {
  return {
    'App-id': SALTEDGE_APP_ID,
    'Secret': SALTEDGE_SECRET,
    'Content-Type': 'application/json',
  };
}

// Criar ou recuperar o customer Salt Edge da empresa (guardado em system_settings)
async function getOrCreateCustomer(db) {
  const { data: settings } = await db
    .from('system_settings')
    .select('saltedge_customer_id')
    .eq('id', 1)
    .maybeSingle();

  if (settings?.saltedge_customer_id) return settings.saltedge_customer_id;

  const res = await fetch(`${SALTEDGE_BASE_URL}/api/v6/customers`, {
    method: 'POST',
    headers: saltEdgeHeaders(),
    body: JSON.stringify({ data: { identifier: 'magnetic_place_main' } }),
  });

  if (!res.ok) {
    const txt = await res.text();
    // Se já existe, tentar obter por identifier não é suportado — erro é expectável em re-runs
    throw new Error(`Salt Edge criar customer (${res.status}): ${txt}`);
  }

  const { data } = await res.json();
  const customerId = data.id;

  await db.from('system_settings').update({ saltedge_customer_id: customerId }).eq('id', 1);
  return customerId;
}


export default async function handler(req, res) {
  try {
    const { action } = req.query;
    const db = supabase();

    if (action === 'listar') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      const { status, mes } = req.query;
      let query = db.from('pagamentos_fornecedores').select('*').order('data_pagamento', { ascending: false });
      if (status) query = query.eq('status', status);
      if (mes) {
        const [ano, m] = mes.split('-');
        const inicio = `${ano}-${m}-01`;
        const fim = new Date(Number(ano), Number(m), 0).toISOString().slice(0, 10);
        query = query.gte('data_pagamento', inicio).lte('data_pagamento', fim);
      }
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data: data || [] });
    }

    if (action === 'criar') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { fornecedor_nome, fornecedor_iban, fornecedor_nif, valor, referencia, data_pagamento } = req.body || {};
      if (!fornecedor_nome || !fornecedor_iban || !valor || !data_pagamento) {
        return res.status(400).json({ error: 'Campos obrigatórios: fornecedor_nome, fornecedor_iban, valor, data_pagamento' });
      }
      const ibanLimpo = String(fornecedor_iban).replace(/\s/g, '').toUpperCase();
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,}$/.test(ibanLimpo)) {
        return res.status(400).json({ error: 'IBAN inválido' });
      }
      const { data, error } = await db
        .from('pagamentos_fornecedores')
        .insert({
          fornecedor_nome,
          fornecedor_iban: ibanLimpo,
          fornecedor_nif: fornecedor_nif || null,
          valor: Number(valor),
          referencia: referencia || null,
          data_pagamento,
          status: 'pendente',
        })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ data });
    }

    if (action === 'exportar-sepa') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { ids } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids obrigatório' });
      }
      const { data: pagamentos, error } = await db
        .from('pagamentos_fornecedores')
        .select('*')
        .in('id', ids)
        .eq('status', 'pendente');
      if (error) return res.status(500).json({ error: error.message });
      if (!pagamentos || pagamentos.length === 0) {
        return res.status(404).json({ error: 'Nenhum pagamento pendente encontrado para os IDs fornecidos' });
      }

      const trabalhadores = pagamentos.map(p => ({
        nome: p.fornecedor_nome,
        iban: p.fornecedor_iban,
        salario: p.valor,
        mes: new Date(p.data_pagamento).toLocaleString('pt-PT', { month: 'long' }),
        ano: new Date(p.data_pagamento).getFullYear().toString(),
        descritivo: p.referencia || `Pagamento ${p.fornecedor_nome}`,
      }));

      try {
        const xmlStr = gerarSEPAXml(trabalhadores, { instant: false, ctgyPurp: 'SUPP' });
        const msgId = `PAG-${Date.now()}`;
        await db
          .from('pagamentos_fornecedores')
          .update({ status: 'exportado', sepa_msg_id: msgId })
          .in('id', ids);

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="pagamentos_fornecedores.xml"`);
        return res.status(200).send(xmlStr);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (action === 'marcar-enviado') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { ids } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids obrigatório' });
      }
      const { error } = await db
        .from('pagamentos_fornecedores')
        .update({ status: 'enviado', enviado_em: new Date().toISOString() })
        .in('id', ids);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }

    if (action === 'apagar') {
      if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      const { error } = await db
        .from('pagamentos_fornecedores')
        .delete()
        .eq('id', id)
        .eq('status', 'pendente');
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }

    // ─── SALT EDGE PIS: INICIAR PAGAMENTO (A PARTIR DE PAGAMENTOS_FORNECEDORES) ───
    if (action === 'saltedge-iniciar') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { ids } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids obrigatório' });
      }

      const { data: pagamentos, error } = await db
        .from('pagamentos_fornecedores')
        .select('*')
        .in('id', ids)
        .eq('status', 'pendente');

      if (error) return res.status(500).json({ error: error.message });
      if (!pagamentos || pagamentos.length === 0) {
        return res.status(404).json({ error: 'Nenhum pagamento pendente encontrado' });
      }

      const p = pagamentos[0];
      const host = req.headers.host || 'localhost:3000';
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const returnTo = `${protocol}://${host}/callback`;

      const useMock = !SALTEDGE_APP_ID || !SALTEDGE_SECRET || process.env.SALTEDGE_USE_MOCK === 'true';

      let redirectUrl = '';
      let saltedgePaymentId = '';

      if (!useMock) {
        try {
          const customerId = await getOrCreateCustomer(db);
          const payRes = await fetch(`${SALTEDGE_BASE_URL}/api/v6/payments/create`, {
            method: 'POST',
            headers: saltEdgeHeaders(),
            body: JSON.stringify({
              data: {
                customer_id: customerId,
                ...(SALTEDGE_SANDBOX && { provider: { include_sandboxes: true } }),
                payment_attributes: {
                  amount: Number(p.valor),
                  currency_code: 'EUR',
                  creditor_name: p.fornecedor_nome,
                  creditor_iban: p.fornecedor_iban,
                  description: (p.referencia || `Pagam. Magnetic ${p.id.slice(0, 8)}`).slice(0, 140),
                },
                attempt: { return_to: returnTo, locale: 'pt' },
              },
            }),
          });

          if (!payRes.ok) {
            const txt = await payRes.text();
            throw new Error(`Salt Edge criar pagamento (${payRes.status}): ${txt}`);
          }

          const { data: payData } = await payRes.json();
          saltedgePaymentId = payData.id;
          redirectUrl = payData.payment_url;
        } catch (err) {
          return res.status(500).json({ error: err.message });
        }
      } else {
        saltedgePaymentId = `mock-se-pay-${Date.now()}`;
        redirectUrl = `${protocol}://${host}/callback?payment_id=${saltedgePaymentId}&mock_payment_id=${p.id}`;
      }

      const { error: updateErr } = await db
        .from('pagamentos_fornecedores')
        .update({
          status: 'iniciado_saltedge',
          saltedge_payment_id: saltedgePaymentId,
          saltedge_auth_url: redirectUrl,
          saltedge_status: 'created',
        })
        .eq('id', p.id);

      if (updateErr) return res.status(500).json({ error: updateErr.message });

      return res.json({ redirectUrl, paymentId: saltedgePaymentId, pagamentoId: p.id });
    }

    // ─── SALT EDGE PIS: VERIFICAR ESTADO DO PAGAMENTO ───
    if (action === 'saltedge-verificar') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      const { paymentId } = req.query;
      if (!paymentId) return res.status(400).json({ error: 'paymentId obrigatório' });

      if (paymentId.startsWith('mock-se-pay-')) {
        const { data: pag, error: fetchErr } = await db
          .from('pagamentos_fornecedores')
          .select('*')
          .eq('saltedge_payment_id', paymentId)
          .single();

        if (fetchErr || !pag) return res.status(404).json({ error: 'Pagamento mock não encontrado.' });

        const { error: updateErr } = await db
          .from('pagamentos_fornecedores')
          .update({ status: 'confirmado', saltedge_status: 'succeeded', enviado_em: new Date().toISOString() })
          .eq('saltedge_payment_id', paymentId);

        if (updateErr) return res.status(500).json({ error: updateErr.message });
        if (pag.fatura_id) await db.from('faturas').update({ status: 'PAGO' }).eq('id', pag.fatura_id);

        return res.json({ ok: true, status: 'succeeded', message: 'Pagamento simulado com sucesso!' });
      }

      if (!SALTEDGE_APP_ID || !SALTEDGE_SECRET) {
        return res.status(400).json({ error: 'Credenciais Salt Edge não configuradas.' });
      }

      try {
        const statusRes = await fetch(`${SALTEDGE_BASE_URL}/api/v6/payments/${paymentId}`, {
          headers: saltEdgeHeaders(),
        });

        if (!statusRes.ok) throw new Error(`Salt Edge verificar pagamento (${statusRes.status})`);

        const { data: payData } = await statusRes.json();
        const seStatus = payData.status;

        let finalStatus = 'iniciado_saltedge';
        if (seStatus === 'succeeded' || seStatus === 'completed') finalStatus = 'confirmado';
        else if (seStatus === 'failed' || seStatus === 'cancelled' || seStatus === 'rejected') finalStatus = 'falhado_saltedge';

        const { data: pag, error: updateErr } = await db
          .from('pagamentos_fornecedores')
          .update({
            status: finalStatus,
            saltedge_status: seStatus,
            enviado_em: finalStatus === 'confirmado' ? new Date().toISOString() : null,
          })
          .eq('saltedge_payment_id', paymentId)
          .select('fatura_id')
          .single();

        if (updateErr) return res.status(500).json({ error: updateErr.message });
        if (finalStatus === 'confirmado' && pag?.fatura_id) {
          await db.from('faturas').update({ status: 'PAGO' }).eq('id', pag.fatura_id);
        }

        return res.json({ ok: true, status: seStatus });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ─── SALT EDGE PIS: PAGAR FATURA (CRIAR PAGAMENTO + INICIAR EM UM PASSO) ───
    if (action === 'saltedge-pagar-fatura') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { fatura_id, fornecedor_nome, fornecedor_iban, fornecedor_nif, valor, referencia, data_pagamento } = req.body || {};

      if (!fatura_id || !fornecedor_nome || !fornecedor_iban || !valor || !data_pagamento) {
        return res.status(400).json({ error: 'Campos obrigatórios: fatura_id, fornecedor_nome, fornecedor_iban, valor, data_pagamento' });
      }

      const ibanLimpo = String(fornecedor_iban).replace(/\s/g, '').toUpperCase();
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,}$/.test(ibanLimpo)) {
        return res.status(400).json({ error: 'IBAN inválido' });
      }

      const { data: pagamento, error: criandoErr } = await db
        .from('pagamentos_fornecedores')
        .insert({
          fatura_id,
          fornecedor_nome,
          fornecedor_iban: ibanLimpo,
          fornecedor_nif: fornecedor_nif || null,
          valor: Number(valor),
          referencia: referencia || null,
          data_pagamento,
          status: 'pendente',
        })
        .select()
        .single();

      if (criandoErr) return res.status(500).json({ error: criandoErr.message });

      const p = pagamento;
      const host = req.headers.host || 'localhost:3000';
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const returnTo = `${protocol}://${host}/callback`;

      const useMock = !SALTEDGE_APP_ID || !SALTEDGE_SECRET || process.env.SALTEDGE_USE_MOCK === 'true';

      let redirectUrl = '';
      let saltedgePaymentId = '';

      if (!useMock) {
        try {
          const customerId = await getOrCreateCustomer(db);
          const payRes = await fetch(`${SALTEDGE_BASE_URL}/api/v6/payments/create`, {
            method: 'POST',
            headers: saltEdgeHeaders(),
            body: JSON.stringify({
              data: {
                customer_id: customerId,
                ...(SALTEDGE_SANDBOX && { provider: { include_sandboxes: true } }),
                payment_attributes: {
                  amount: Number(p.valor),
                  currency_code: 'EUR',
                  creditor_name: p.fornecedor_nome,
                  creditor_iban: ibanLimpo,
                  description: (p.referencia || `Pagam. Magnetic ${p.id.slice(0, 8)}`).slice(0, 140),
                },
                attempt: { return_to: returnTo, locale: 'pt' },
              },
            }),
          });

          if (!payRes.ok) {
            const txt = await payRes.text();
            throw new Error(`Salt Edge criar pagamento (${payRes.status}): ${txt}`);
          }

          const { data: payData } = await payRes.json();
          saltedgePaymentId = payData.id;
          redirectUrl = payData.payment_url;
        } catch (err) {
          await db.from('pagamentos_fornecedores').delete().eq('id', p.id);
          return res.status(500).json({ error: err.message });
        }
      } else {
        saltedgePaymentId = `mock-se-pay-${Date.now()}`;
        redirectUrl = `${protocol}://${host}/callback?payment_id=${saltedgePaymentId}&mock_payment_id=${p.id}`;
      }

      await db.from('pagamentos_fornecedores').update({
        status: 'iniciado_saltedge',
        saltedge_payment_id: saltedgePaymentId,
        saltedge_auth_url: redirectUrl,
        saltedge_status: 'created',
      }).eq('id', p.id);

      return res.json({ redirectUrl, paymentId: saltedgePaymentId, pagamentoId: p.id });
    }

    // ─── SALT EDGE AIS: GUARDAR CONNECTION_ID APÓS CALLBACK ───
    if (action === 'saltedge-save-connection') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { connection_id } = req.body || {};
      if (!connection_id) return res.status(400).json({ error: 'connection_id obrigatório.' });

      const { error } = await db
        .from('system_settings')
        .update({ saltedge_connection_id: connection_id })
        .eq('id', 1);

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true, message: 'Conta bancária Salt Edge ligada com sucesso!' });
    }

    // ─── SALT EDGE AIS: LISTAR CONTAS ───
    if (action === 'saltedge-list-accounts') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      if (!SALTEDGE_APP_ID || !SALTEDGE_SECRET) return res.status(400).json({ error: 'Credenciais Salt Edge não configuradas.' });

      try {
        const { data: settings } = await db
          .from('system_settings')
          .select('saltedge_connection_id')
          .eq('id', 1)
          .maybeSingle();

        if (!settings?.saltedge_connection_id) {
          throw new Error('Conta bancária não ligada. Por favor conecte primeiro via Salt Edge.');
        }

        const r = await fetch(
          `${SALTEDGE_BASE_URL}/api/v6/accounts?connection_id=${settings.saltedge_connection_id}`,
          { headers: saltEdgeHeaders() }
        );
        if (!r.ok) throw new Error(`Salt Edge listar contas (${r.status})`);
        const { data } = await r.json();
        return res.json({ data: data || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ─── SALT EDGE AIS: LISTAR TRANSAÇÕES ───
    if (action === 'saltedge-list-transactions') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      const { accountId } = req.query;
      if (!SALTEDGE_APP_ID || !SALTEDGE_SECRET) return res.status(400).json({ error: 'Credenciais Salt Edge não configuradas.' });

      try {
        const params = new URLSearchParams();
        if (accountId) params.set('account_id', accountId);

        const r = await fetch(`${SALTEDGE_BASE_URL}/api/v6/transactions?${params}`, {
          headers: saltEdgeHeaders(),
        });
        if (!r.ok) throw new Error(`Salt Edge listar transações (${r.status})`);
        const { data } = await r.json();
        return res.json({ data: data || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ─── SALT EDGE AIS: OBTER LINK DE CONEXÃO DE CONTAS ───
    if (action === 'saltedge-get-link') {
      if (!SALTEDGE_APP_ID || !SALTEDGE_SECRET) return res.status(400).json({ error: 'Credenciais Salt Edge não configuradas.' });

      const host = req.headers.host || 'localhost:3000';
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const returnTo = `${protocol}://${host}/callback`;

      try {
        const customerId = await getOrCreateCustomer(db);

        const r = await fetch(`${SALTEDGE_BASE_URL}/api/v6/connections/connect`, {
          method: 'POST',
          headers: saltEdgeHeaders(),
          body: JSON.stringify({
            data: {
              customer_id: customerId,
              ...(SALTEDGE_SANDBOX && { provider: { include_sandboxes: true } }),
              consent: {
                scopes: ['accounts', 'transactions', 'balance'],
                period_days: 90,
              },
              attempt: { return_to: returnTo, locale: 'pt' },
            },
          }),
        });

        if (!r.ok) {
          const txt = await r.text();
          throw new Error(`Salt Edge connect (${r.status}): ${txt}`);
        }

        const { data } = await r.json();
        return res.json({ url: data.connect_url });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: `Acção desconhecida: ${action || '(não definida)'}` });

  } catch (err) {
    console.error('Unhandled Serverless Error:', err);
    return res.status(500).json({ error: `Erro interno no servidor: ${err.message}` });
  }
}
