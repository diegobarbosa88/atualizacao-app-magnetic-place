import { createClient } from '@supabase/supabase-js';

const SALTEDGE_APP_ID = process.env.SALTEDGE_APP_ID;
const SALTEDGE_SECRET = process.env.SALTEDGE_SECRET;
// PRODUÇÃO: definir SALTEDGE_PROVIDER=novobanco_pt no ambiente Vercel
const SALTEDGE_PROVIDER = process.env.SALTEDGE_PROVIDER || 'spectre';
const SALTEDGE_PAYMENTS_URL = 'https://www.saltedge.com/api/v5/payments';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { faturas_para_pagar } = req.body || {};

  if (!Array.isArray(faturas_para_pagar) || faturas_para_pagar.length === 0) {
    return res.status(400).json({ error: 'faturas_para_pagar é obrigatório e não pode estar vazio.' });
  }

  for (const f of faturas_para_pagar) {
    if (!f.id_origem || !f.fonte || !f.iban || f.valor == null) {
      return res.status(400).json({ error: 'Cada fatura deve ter: id_origem, fonte, iban, valor.' });
    }
    if (!['toconline', 'centro_documentos'].includes(f.fonte)) {
      return res.status(400).json({ error: `fonte inválida: "${f.fonte}". Use "toconline" ou "centro_documentos".` });
    }
    if (Number(f.valor) <= 0) {
      return res.status(400).json({ error: `valor inválido para id_origem "${f.id_origem}": deve ser positivo.` });
    }
  }

  if (!SALTEDGE_APP_ID || !SALTEDGE_SECRET) {
    return res.status(500).json({ error: 'Credenciais Salt Edge não configuradas (SALTEDGE_APP_ID / SALTEDGE_SECRET).' });
  }

  const totalLote = faturas_para_pagar.reduce((sum, f) => sum + Number(f.valor), 0);
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const returnTo = `${protocol}://${host}/admin/pagamentos?saltedge=callback`;

  let saltEdgeData;
  try {
    const saltRes = await fetch(SALTEDGE_PAYMENTS_URL, {
      method: 'POST',
      headers: {
        'App-id': SALTEDGE_APP_ID,
        'Secret': SALTEDGE_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          provider_code: SALTEDGE_PROVIDER,
          amount: totalLote,
          currency_code: 'EUR',
          description: `Lote Magnetic Place — ${faturas_para_pagar.length} fatura(s)`,
          return_to: returnTo,
        },
      }),
    });

    if (!saltRes.ok) {
      const txt = await saltRes.text();
      throw new Error(`Salt Edge v5 (${saltRes.status}): ${txt}`);
    }

    const json = await saltRes.json();
    saltEdgeData = json.data;
  } catch (err) {
    return res.status(502).json({ error: `Erro ao iniciar pagamento Salt Edge: ${err.message}` });
  }

  const saltPaymentId = saltEdgeData.id;
  const paymentUrl = saltEdgeData.payment_url;

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const erros = [];

  for (const f of faturas_para_pagar) {
    try {
      if (f.fonte === 'centro_documentos') {
        const { error } = await db
          .from('faturas_centro_documentos')
          .update({ salt_edge_payment_id: saltPaymentId, estado_pagamento: 'processando' })
          .eq('id', f.id_origem);
        if (error) throw error;
      } else {
        const { error } = await db
          .from('toconline_pagamentos_pendentes')
          .insert({
            salt_edge_payment_id: saltPaymentId,
            toconline_doc_id: f.id_origem,
            estado: 'processando',
          });
        if (error) throw error;
      }
    } catch (err) {
      // Registo falhado — o pagamento já foi iniciado, não bloquear o utilizador
      console.error(`processar-lote: erro ao registar fatura ${f.id_origem}:`, err.message);
      erros.push({ id_origem: f.id_origem, fonte: f.fonte, erro: err.message });
    }
  }

  return res.status(200).json({ url: paymentUrl, salt_edge_payment_id: saltPaymentId, erros });
}
