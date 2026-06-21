import { createClient } from '@supabase/supabase-js';
import { gerarSEPAXml } from '../salarios/_sepaXml.js';

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

    // ─── PARSE IMPOSTO PDF (Gemini) ───
    if (action === 'parse-imposto') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
      const { texto } = req.body || {};
      if (!texto) return res.status(400).json({ error: 'Missing texto' });
      const prompt = `És um especialista em documentos fiscais portugueses (guias de pagamento, notas de liquidação). Analisa o texto abaixo e extrai os seguintes campos:\n\n- tipo: tipo de imposto. Um dos seguintes: "IRC", "IVA", "IRS", "SS" ou "Outro". Deteta pela referência ao imposto no documento.\n- periodo: período de referência do imposto, ex: "2026-06", "Q2-2026", "2025" (ano). Se for mensal usa YYYY-MM, trimestral usa QN-YYYY, anual usa YYYY.\n- valor: valor total a pagar (número decimal, ex: 1234.56). Procura "Total a pagar", "Valor a liquidar" ou similar.\n- data_vencimento: data limite de pagamento em formato YYYY-MM-DD. Procura "Data limite", "Prazo de pagamento", "Vencimento".\n- referencia: referência de pagamento (Multibanco ou documento). Pode ser "Entidade: XXXXX Referência: XXXXXXXXX" ou um número de documento.\n- iban_destino: IBAN do beneficiário (Estado, AT, SS). Formato PT50XXXX... Se não existir usa null.\n- descricao: breve descrição do documento, ex: "IVA Mensal Jun 2026".\n\nRegras:\n- Se um campo não existir claramente, usa null.\n- Para valor usa sempre número decimal (ex: 123.45), nunca string.\n- Responde APENAS com JSON válido, sem texto antes ou depois, sem markdown.\n\nTexto do documento:\n${texto.slice(0, 6000)}`;
      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0 } }) }
      );
      if (!gemRes.ok) return res.status(gemRes.status).json({ error: await gemRes.text() });
      const gemData = await gemRes.json();
      const raw = gemData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonStr = raw.replace(/```json|```/g, '').trim();
      try { return res.status(200).json(JSON.parse(jsonStr)); } catch { return res.status(200).json({ raw }); }
    }

    // ─── FORNECEDORES DÉBITO AUTOMÁTICO: LISTAR ───
    if (action === 'listar-fornecedores-debito') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      const { data, error } = await db.from('fornecedores_debito_automatico').select('nif, nome, iban').order('nome');
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data: data || [] });
    }

    // ─── FORNECEDORES DÉBITO AUTOMÁTICO: TOGGLE ───
    if (action === 'toggle-fornecedor-debito') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { nif, nome } = req.body || {};
      if (!nif) return res.status(400).json({ error: 'nif obrigatório' });
      const { data: existing } = await db.from('fornecedores_debito_automatico').select('nif').eq('nif', nif).maybeSingle();
      if (existing) {
        await db.from('fornecedores_debito_automatico').delete().eq('nif', nif);
        await db.from('faturas').update({ debito_automatico: false }).eq('dados->>nif_fornecedor', nif);
        return res.json({ ativo: false });
      } else {
        await db.from('fornecedores_debito_automatico').insert({ nif, nome: nome || nif });
        await db.from('faturas').update({ debito_automatico: true }).eq('dados->>nif_fornecedor', nif);
        return res.json({ ativo: true });
      }
    }

    // ─── FORNECEDORES: GUARDAR IBAN (legacy) ───
    if (action === 'guardar-iban-fornecedor') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { nif, nome, iban } = req.body || {};
      if (!nif || !iban) return res.status(400).json({ error: 'nif e iban obrigatórios' });
      // Upsert na tabela fornecedores (nova) e na legacy
      await db.from('fornecedores').upsert({ nif, nome: nome || nif, iban, updated_at: new Date().toISOString() }, { onConflict: 'nif' });
      await db.from('fornecedores_debito_automatico').upsert({ nif, nome: nome || nif, iban }, { onConflict: 'nif' });
      return res.json({ ok: true });
    }

    // ─── FORNECEDORES: LISTAR ───
    if (action === 'listar-fornecedores') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      const { data, error } = await db.from('fornecedores').select('*').order('nome');
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data: data || [] });
    }

    // ─── FORNECEDORES: GUARDAR (criar ou editar) ───
    if (action === 'guardar-fornecedor') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { id, nome, nif, email, telefone, morada, iban, swift, website, notas, status, debito_automatico } = req.body || {};
      if (!nome) return res.status(400).json({ error: 'nome obrigatório' });
      const payload = {
        nome, nif: nif || null, email: email || null, telefone: telefone || null,
        morada: morada || null, iban: iban || null, swift: swift || null,
        website: website || null, notas: notas || null,
        status: status || 'ativo', debito_automatico: !!debito_automatico,
        updated_at: new Date().toISOString(),
      };
      let result;
      if (id) {
        result = await db.from('fornecedores').update(payload).eq('id', id).select().single();
      } else {
        result = await db.from('fornecedores').insert(payload).select().single();
      }
      if (result.error) return res.status(500).json({ error: result.error.message });
      if (nif) {
        await db.from('faturas').update({ debito_automatico: !!debito_automatico }).eq('dados->>nif_fornecedor', nif);
      }
      return res.json({ data: result.data });
    }

    // ─── FORNECEDORES: APAGAR ───
    if (action === 'apagar-fornecedor') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      const { error } = await db.from('fornecedores').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }

    // ─── FATURAS GMAIL: LISTAR ELEGÍVEIS PARA FILA ───
    if (action === 'listar-faturas-fila') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      const { data, error } = await db
        .from('faturas')
        .select('id, dados, status, url, importado_em, filename')
        .eq('status', 'PENDENTE')
        .eq('debito_automatico', false)
        .not('dados', 'is', null)
        .order('importado_em', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      const elegiveis = (data || []).filter(f => f.dados?.valor_total);

      // Enriquecer com IBAN do fornecedor quando dados.iban é nulo
      const nifsComFaturasSemIban = [...new Set(
        elegiveis.filter(f => !f.dados?.iban && f.dados?.nif_fornecedor).map(f => f.dados.nif_fornecedor)
      )];
      if (nifsComFaturasSemIban.length > 0) {
        const { data: fns } = await db
          .from('fornecedores')
          .select('nif, iban')
          .in('nif', nifsComFaturasSemIban)
          .not('iban', 'is', null);
        const ibanByNif = Object.fromEntries((fns || []).map(f => [f.nif, f.iban]));
        elegiveis.forEach(f => {
          if (!f.dados?.iban && f.dados?.nif_fornecedor && ibanByNif[f.dados.nif_fornecedor]) {
            f.dados = { ...f.dados, iban: ibanByNif[f.dados.nif_fornecedor] };
          }
        });
      }

      return res.json({ data: elegiveis });
    }

    // ─── IMPOSTOS: LISTAR ───
    if (action === 'listar-impostos') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      const { status } = req.query;
      let query = db.from('impostos_pagamentos').select('*').order('data_vencimento', { ascending: true });
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data: data || [] });
    }

    // ─── IMPOSTOS: IMPORTAR (GUARDAR REGISTO + PDF OPCIONAL) ───
    if (action === 'importar-imposto-pdf') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { tipo, periodo, valor, data_vencimento, referencia, iban_destino, descricao, pdf_base64, filename } = req.body || {};
      if (!tipo || !valor || !iban_destino) {
        return res.status(400).json({ error: 'Campos obrigatórios: tipo, valor, iban_destino' });
      }

      const ibanLimpo = String(iban_destino).replace(/\s/g, '').toUpperCase();

      let storagePath = null;
      let publicUrl = null;

      if (pdf_base64 && filename) {
        try {
          const buffer = Buffer.from(pdf_base64, 'base64');
          const safeName = filename.replace(/[^a-zA-Z0-9.\-_()]/g, '_');
          storagePath = `impostos/${Date.now()}_${safeName}`;
          const { error: upErr } = await db.storage
            .from('faturas')
            .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false });
          if (upErr) throw new Error(upErr.message);
          const { data: { publicUrl: url } } = db.storage.from('faturas').getPublicUrl(storagePath);
          publicUrl = url;
        } catch (e) {
          return res.status(500).json({ error: `Erro ao guardar PDF: ${e.message}` });
        }
      }

      const { data, error } = await db
        .from('impostos_pagamentos')
        .insert({
          tipo,
          periodo: periodo || null,
          valor: Number(valor),
          data_vencimento: data_vencimento || null,
          referencia: referencia || null,
          iban_destino: ibanLimpo,
          descricao: descricao || null,
          storage_path: storagePath,
          url: publicUrl,
          status: 'pendente',
        })
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ data });
    }

    // ─── IMPOSTOS: REJEITAR ───
    if (action === 'rejeitar-imposto') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { id, motivo } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      const { error } = await db
        .from('impostos_pagamentos')
        .update({ status: 'rejeitado', notas_rejeicao: motivo || null })
        .eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }

    // ─── GERAR SEPA XML MISTO (FORNECEDORES + IMPOSTOS) ───
    if (action === 'gerar-sepa-lote') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { pagamentos_ids = [], impostos_ids = [], faturas_gmail_ids = [], data_pagamento } = req.body || {};
      if (pagamentos_ids.length === 0 && impostos_ids.length === 0 && faturas_gmail_ids.length === 0) {
        return res.status(400).json({ error: 'Nenhum item selecionado' });
      }

      const registos = [];

      if (pagamentos_ids.length > 0) {
        const { data: pags, error } = await db
          .from('pagamentos_fornecedores')
          .select('*')
          .in('id', pagamentos_ids)
          .eq('status', 'pendente');
        if (error) return res.status(500).json({ error: error.message });
        for (const p of pags || []) {
          registos.push({
            nome: p.fornecedor_nome,
            iban: p.fornecedor_iban,
            salario: p.valor,
            mes: '',
            ano: '',
            descritivo: p.referencia || `Pagamento ${p.fornecedor_nome}`,
            _fonte: 'fornecedor',
            _id: p.id,
          });
        }
      }

      if (impostos_ids.length > 0) {
        const { data: imps, error } = await db
          .from('impostos_pagamentos')
          .select('*')
          .in('id', impostos_ids)
          .eq('status', 'pendente');
        if (error) return res.status(500).json({ error: error.message });
        for (const imp of imps || []) {
          registos.push({
            nome: `${imp.tipo}${imp.periodo ? ' ' + imp.periodo : ''}`,
            iban: imp.iban_destino,
            salario: imp.valor,
            mes: '',
            ano: '',
            descritivo: imp.referencia || imp.descricao || `${imp.tipo} ${imp.periodo || ''}`.trim(),
            _fonte: 'imposto',
            _id: imp.id,
          });
        }
      }

      if (faturas_gmail_ids.length > 0) {
        const { data: fats, error } = await db
          .from('faturas')
          .select('id, dados, filename')
          .in('id', faturas_gmail_ids)
          .eq('status', 'PENDENTE');
        if (error) return res.status(500).json({ error: error.message });
        for (const f of fats || []) {
          if (!f.dados?.iban || !f.dados?.valor_total) continue;
          registos.push({
            nome: f.dados.fornecedor || f.filename || 'Fornecedor',
            iban: f.dados.iban,
            salario: Number(f.dados.valor_total),
            mes: '',
            ano: '',
            descritivo: f.dados.numero_fatura || `Fatura ${f.dados.fornecedor || ''}`.trim(),
            _fonte: 'fatura-gmail',
            _id: f.id,
          });
        }
      }

      if (registos.length === 0) {
        return res.status(404).json({ error: 'Nenhum registo pendente encontrado para os IDs fornecidos' });
      }

      let xmlStr;
      try {
        xmlStr = gerarSEPAXml(registos, { instant: false, ctgyPurp: 'SUPP' });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }

      const msgId = `LOTE-${Date.now()}`;
      const somaTotal = registos.reduce((acc, r) => acc + Number(r.salario), 0);
      const count = registos.length;

      const fornecedoresIds = registos.filter(r => r._fonte === 'fornecedor').map(r => r._id);
      const impostosIds = registos.filter(r => r._fonte === 'imposto').map(r => r._id);
      const faturasGmailIds = registos.filter(r => r._fonte === 'fatura-gmail').map(r => r._id);

      if (fornecedoresIds.length > 0) {
        await db.from('pagamentos_fornecedores')
          .update({ status: 'exportado', sepa_msg_id: msgId })
          .in('id', fornecedoresIds);
      }
      if (impostosIds.length > 0) {
        await db.from('impostos_pagamentos')
          .update({ status: 'exportado', sepa_msg_id: msgId })
          .in('id', impostosIds);
      }
      if (faturasGmailIds.length > 0) {
        await db.from('faturas')
          .update({ status: 'PAGO' })
          .in('id', faturasGmailIds);
      }

      const totalFmt = somaTotal.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      await db.from('app_notifications').insert({
        target_type: 'admin',
        title: `SEPA XML gerado — ${count} pagamento${count !== 1 ? 's' : ''}`,
        body: `Total: ${totalFmt} € • Faça download e upload no portal NovoBanco`,
        payload: { kind: 'sepa_pronto', total: somaTotal, count, msg_id: msgId },
      });

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="pagamentos_lote_${msgId}.xml"`);
      return res.status(200).send(xmlStr);
    }

    return res.status(400).json({ error: `Acção desconhecida: ${action || '(não definida)'}` });

  } catch (err) {
    console.error('Unhandled Serverless Error:', err);
    return res.status(500).json({ error: `Erro interno no servidor: ${err.message}` });
  }
}
