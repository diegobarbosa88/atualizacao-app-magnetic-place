import { createClient } from '@supabase/supabase-js';
import { gerarSEPAXml } from './salarios/_sepaXml.js';

const TINK_CLIENT_ID = process.env.TINK_CLIENT_ID;
const TINK_CLIENT_SECRET = process.env.TINK_CLIENT_SECRET;
const TINK_BASE_URL = process.env.TINK_BASE_URL || 'https://api.tink.com';

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Helper: Obter Token de Iniciação de Pagamentos (Client Credentials)
async function getTinkClientCredentialsToken(scope) {
  const res = await fetch(`${TINK_BASE_URL}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TINK_CLIENT_ID,
      client_secret: TINK_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: scope
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro Tink client credentials (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

// Helper: Trocar Código por Token de Utilizador (AIS - Sincronização)
async function exchangeAuthorizationCode(code) {
  const res = await fetch(`${TINK_BASE_URL}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: TINK_CLIENT_ID,
      client_secret: TINK_CLIENT_SECRET,
      grant_type: 'authorization_code'
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro Tink token exchange (${res.status}): ${text}`);
  }

  return res.json();
}

// Helper: Renovar Token de Utilizador (AIS)
async function refreshUserTokens(refreshToken) {
  const res = await fetch(`${TINK_BASE_URL}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: TINK_CLIENT_ID,
      client_secret: TINK_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro Tink token refresh (${res.status}): ${text}`);
  }

  return res.json();
}

// Helper: Obter Token AIS de Utilizador Válido
async function getValidUserToken(db) {
  const { data, error } = await db
    .from('system_settings')
    .select('tink_access_token, tink_refresh_token, tink_token_expires_at')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw new Error(`system_settings: ${error.message}`);
  if (!data?.tink_access_token) {
    throw new Error('Conta bancária Tink não está ligada. Por favor autentique primeiro.');
  }

  const expiresAt = data.tink_token_expires_at ? new Date(data.tink_token_expires_at) : null;
  const isExpired = !expiresAt || expiresAt <= new Date(Date.now() + 60_000);

  if (!isExpired) return data.tink_access_token;

  const tokens = await refreshUserTokens(data.tink_refresh_token);
  const newExpires = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await db.from('system_settings').update({
    tink_access_token: tokens.access_token,
    tink_refresh_token: tokens.refresh_token || data.tink_refresh_token,
    tink_token_expires_at: newExpires,
  }).eq('id', 1);

  return tokens.access_token;
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

    // ─── TINK PIS: INICIAR PAGAMENTO REAL (TRANSFERÊNCIA) ───
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

      const p = pagamentos[0];

      let redirectUrl = '';
      let tinkRequestId = '';

      if (TINK_CLIENT_ID && TINK_CLIENT_SECRET) {
        try {
          // 1. Obter Token Client Credentials
          const accessToken = await getTinkClientCredentialsToken('payment:write');

          // 2. Criar Iniciação de Pagamento
          const host = req.headers.host || 'localhost:3000';
          const protocol = req.headers['x-forwarded-proto'] || 'http';
          const callbackUrl = `${protocol}://${host}/admin/pagamentos?tink=callback`;

          const paymentRes = await fetch(`${TINK_BASE_URL}/api/v1/payments/requests`, {
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
              sourceMessage: (p.referencia || `Pagam. Magnetic ${p.id.slice(0, 8)}`).slice(0, 140),
              remittanceInformation: {
                type: 'UNSTRUCTURED',
                value: (p.referencia || `Pagam. Magnetic ${p.id.slice(0, 8)}`).slice(0, 140)
              },
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
        // MOCK SANDBOX FLOW
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

    // ─── TINK PIS: VERIFICAR ESTADO DO PAGAMENTO ───
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

      if (!TINK_CLIENT_ID || !TINK_CLIENT_SECRET) {
        return res.status(400).json({ error: 'Credenciais Tink não configuradas para verificação real' });
      }

      try {
        const accessToken = await getTinkClientCredentialsToken('payment:read');

        const statusRes = await fetch(`${TINK_BASE_URL}/api/v1/payments/requests/${paymentRequestId}`, {
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

    // ─── TINK AIS: TROCAR CÓDIGO POR TOKENS (SINCRONIZAÇÃO DE CONTAS) ───
    if (action === 'tink-exchange-code') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { code } = req.body || {};
      if (!code) return res.status(400).json({ error: 'Código de autorização obrigatório.' });

      if (!TINK_CLIENT_ID || !TINK_CLIENT_SECRET) {
        return res.status(400).json({ error: 'Credenciais Tink não configuradas.' });
      }

      try {
        const tokens = await exchangeAuthorizationCode(code);
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        const { error } = await db
          .from('system_settings')
          .update({
            tink_access_token: tokens.access_token,
            tink_refresh_token: tokens.refresh_token,
            tink_token_expires_at: expiresAt
          })
          .eq('id', 1);

        if (error) throw error;

        return res.status(200).json({ ok: true, message: 'Conta bancária Tink ligada com sucesso!' });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ─── TINK AIS: LISTAR CONTAS CONECTADAS ───
    if (action === 'tink-list-accounts') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

      if (!TINK_CLIENT_ID || !TINK_CLIENT_SECRET) {
        return res.status(400).json({ error: 'Credenciais Tink não configuradas.' });
      }

      try {
        const accessToken = await getValidUserToken(db);

        const response = await fetch(`${TINK_BASE_URL}/api/v1/accounts/list`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Erro Tink ao listar contas (${response.status}): ${text}`);
        }

        const data = await response.json();
        return res.status(200).json({ data: data.accounts || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ─── TINK AIS: LISTAR TRANSAÇÕES DA CONTA ───
    if (action === 'tink-list-transactions') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      const { accountId } = req.query;

      if (!TINK_CLIENT_ID || !TINK_CLIENT_SECRET) {
        return res.status(400).json({ error: 'Credenciais Tink não configuradas.' });
      }

      try {
        const accessToken = await getValidUserToken(db);

        const params = new URLSearchParams();
        if (accountId) params.set('accountId', accountId);

        const response = await fetch(`${TINK_BASE_URL}/api/v1/transactions?${params}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Erro Tink ao listar transações (${response.status}): ${text}`);
        }

        const data = await response.json();
        return res.status(200).json({ data: data.transactions || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ─── TINK AIS: OBTER LINK DE CONEXÃO DE CONTAS ───
    if (action === 'tink-get-link') {
      const clientId = TINK_CLIENT_ID || 'a9eeac4d05fa425d9e8f67b114ec70cf';
      const host = req.headers.host || 'localhost:3000';
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const redirectUri = `${protocol}://${host}/admin/pagamentos?tink=callback`;

      const url = `https://link.tink.com/1.0/business-transactions/connect-accounts/?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&market=PT&locale=pt_PT`;
      return res.status(200).json({ url });
    }

    return res.status(400).json({ error: `Acção desconhecida: ${action || '(não definida)'}` });

  } catch (err) {
    console.error('Unhandled Serverless Error:', err);
    return res.status(500).json({ error: `Erro interno no servidor: ${err.message}` });
  }
}
