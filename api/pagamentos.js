import { createClient } from '@supabase/supabase-js';
import { gerarSEPAXml } from './salarios/_sepaXml.js';

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
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

  if (action === 'tink-iniciar') {
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
      return res.status(404).json({ error: 'Nenhum pagamento pendente encontrado para iniciar com Tink' });
    }

    // Iniciamos o primeiro pagamento do lote para demonstração/fluxo simplificado e seguro (SCA individual)
    const p = pagamentos[0];

    const clientId = process.env.TINK_CLIENT_ID;
    const clientSecret = process.env.TINK_CLIENT_SECRET;
    const baseUrl = process.env.TINK_BASE_URL || 'https://api.tink.com';

    let redirectUrl = '';
    let tinkRequestId = '';

    if (clientId && clientSecret) {
      try {
        // 1. Obter Token de Acesso Tink (client_credentials)
        const tokenRes = await fetch(`${baseUrl}/api/v1/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials',
            scope: 'payment:write'
          })
        });

        if (!tokenRes.ok) {
          const errData = await tokenRes.json();
          throw new Error(errData.errorMessage || errData.error || 'Erro na autenticação Tink');
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // 2. Criar Iniciação de Pagamento na Tink
        const host = req.headers.host || 'localhost:3000';
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const callbackUrl = `${protocol}://${host}/admin/pagamentos?tink=callback`;

        const paymentRes = await fetch(`${baseUrl}/api/v1/payments/requests`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            destinations: [{
              accountNumber: p.fornecedor_iban,
              type: 'IBAN'
            }],
            amount: Number(p.valor),
            currency: 'EUR',
            recipientName: p.fornecedor_nome,
            sourceMessage: p.referencia || `Pagam. Magnetic ${p.id.slice(0, 8)}`,
            redirectUri: callbackUrl
          })
        });

        if (!paymentRes.ok) {
          const errData = await paymentRes.json();
          throw new Error(errData.errorMessage || errData.error || 'Erro ao criar pedido Tink');
        }

        const paymentData = await paymentRes.json();
        tinkRequestId = paymentData.id;
        redirectUrl = paymentData.paymentRequestUrl;

      } catch (err) {
        return res.status(500).json({ error: `Erro na integração Tink real: ${err.message}` });
      }
    } else {
      // ─── MOCK SANDBOX FLOW (Caso não existam credenciais reais configuradas) ───
      const mockId = `mock-tink-req-${Date.now()}`;
      tinkRequestId = mockId;

      const host = req.headers.host || 'localhost:3000';
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      redirectUrl = `${protocol}://${host}/admin/pagamentos?tink=callback&mock_request_id=${mockId}&mock_payment_id=${p.id}`;
    }

    const { error: updateErr } = await db
      .from('pagamentos_fornecedores')
      .update({
        status: 'iniciado_tink',
        tink_payment_request_id: tinkRequestId,
        tink_auth_url: redirectUrl,
        tink_status: 'PENDING'
      })
      .eq('id', p.id);

    if (updateErr) return res.status(500).json({ error: `Erro ao atualizar base de dados: ${updateErr.message}` });

    return res.json({ redirectUrl, paymentRequestId: tinkRequestId, paymentId: p.id });
  }

  if (action === 'tink-verificar') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const { paymentRequestId } = req.query;

    if (!paymentRequestId) {
      return res.status(400).json({ error: 'paymentRequestId obrigatório' });
    }

    if (paymentRequestId.startsWith('mock-tink-req-')) {
      const { data: p, error: fetchErr } = await db
        .from('pagamentos_fornecedores')
        .select('*')
        .eq('tink_payment_request_id', paymentRequestId)
        .single();

      if (fetchErr || !p) {
        return res.status(404).json({ error: 'Pagamento mock não encontrado.' });
      }

      const { error: updateErr } = await db
        .from('pagamentos_fornecedores')
        .update({
          status: 'confirmado',
          tink_status: 'EXECUTED',
          enviado_em: new Date().toISOString()
        })
        .eq('tink_payment_request_id', paymentRequestId);

      if (updateErr) return res.status(500).json({ error: updateErr.message });

      return res.json({ ok: true, status: 'EXECUTED', message: 'Pagamento simulado com sucesso!' });
    }

    const clientId = process.env.TINK_CLIENT_ID;
    const clientSecret = process.env.TINK_CLIENT_SECRET;
    const baseUrl = process.env.TINK_BASE_URL || 'https://api.tink.com';

    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'Credenciais Tink não configuradas para verificação real' });
    }

    try {
      const tokenRes = await fetch(`${baseUrl}/api/v1/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
          scope: 'payment:read'
        })
      });

      if (!tokenRes.ok) throw new Error('Erro ao autenticar com a API Tink');
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      const statusRes = await fetch(`${baseUrl}/api/v1/payments/requests/${paymentRequestId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!statusRes.ok) throw new Error('Erro ao consultar estado na API Tink');
      const paymentData = await statusRes.json();
      const tinkState = paymentData.status;

      let finalStatus = 'iniciado_tink';
      if (tinkState === 'EXECUTED' || tinkState === 'SETTLED') {
        finalStatus = 'confirmado';
      } else if (tinkState === 'FAILED' || tinkState === 'CANCELLED') {
        finalStatus = 'falhado_tink';
      }

      const { error: updateErr } = await db
        .from('pagamentos_fornecedores')
        .update({
          status: finalStatus,
          tink_status: tinkState,
          enviado_em: (finalStatus === 'confirmado') ? new Date().toISOString() : null
        })
        .eq('tink_payment_request_id', paymentRequestId);

      if (updateErr) return res.status(500).json({ error: updateErr.message });

      return res.json({ ok: true, status: tinkState });

    } catch (err) {
      return res.status(500).json({ error: `Erro ao verificar estado Tink: ${err.message}` });
    }
  }

  return res.status(400).json({ error: `Acção desconhecida: ${action || '(não definida)'}` });
}
