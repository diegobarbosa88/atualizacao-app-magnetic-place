/**
 * POST /api/powens?action=connect|pay|sync
 *
 * Router unificado das acções Powens activas.
 * Consolida connect.js + payments.js + sync.js num único ficheiro
 * para respeitar o limite de 12 Serverless Functions do plano Vercel Hobby.
 *
 * Acções:
 *   connect — Inicia fluxo AIS (Account Information Service) para novobanco/santander
 *   pay     — Inicia fluxo PIS (Payment Initiation Service) para faturas seleccionadas
 *   sync    — Sincroniza contas e movimentos de todas as conexões activas
 */

import { createClient } from '@supabase/supabase-js';
import { buildWebviewUrl, powensRequest, CALLBACK_URI } from './_client.js';

// IDs de conector Powens para bancos PT suportados
// Confirmado via API: GET /connectors ou painel Powens Dashboard
const CONNECTOR_IDS = {
  novobanco: '338',
  santander: '2499', // Santander Totta (PT) — slug "BST"
};

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action || req.body?.action;

  switch (action) {
    case 'connect': return handleConnect(req, res);
    case 'pay':     return handlePay(req, res);
    case 'sync':    return handleSync(req, res);
    default:
      return res.status(400).json({ error: `action inválida: "${action}". Use connect, pay ou sync.` });
  }
}

// ── connect ───────────────────────────────────────────────────────────────────
// Body: { banco: 'novobanco' | 'santander' }
// Response: { redirect_url, conexao_id }
//
// Não requer token da API Powens — o webview aceita ligações sem user token.
// A Powens cria uma sessão anónima; o user_id é obtido no callback via connection_id.
async function handleConnect(req, res) {
  const { banco } = req.body || {};

  if (!banco || !CONNECTOR_IDS[banco]) {
    return res.status(400).json({
      error: `banco inválido: "${banco}". Use um de: ${Object.keys(CONNECTOR_IDS).join(', ')}`,
    });
  }

  const supabase = db();

  try {
    const state = crypto.randomUUID();

    const { data: conexao, error: upsertErr } = await supabase
      .from('conexoes_bancarias')
      .upsert(
        {
          banco,
          estado: 'pendente',
          powens_state: state,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'banco' },
      )
      .select('id')
      .single();

    if (upsertErr) throw new Error(`Supabase upsert: ${upsertErr.message}`);

    // Webview sem user token — Powens cria sessão nova e devolve connection_id no callback
    const redirect_url = buildWebviewUrl('connect', {
      state,
      'connector_ids[]': CONNECTOR_IDS[banco],
    });

    return res.status(200).json({ redirect_url, conexao_id: conexao.id });
  } catch (err) {
    console.error('[powens/connect]', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── pay ───────────────────────────────────────────────────────────────────────
// Body: { faturas_ids: string[], descricao?: string }
// Response: { redirect_url, pagamento_id, total, transfer_id }
async function handlePay(req, res) {
  const {
    faturas_ids,
    descricao: descricaoOverride,
    iban_direto,
    valor_direto,
    fornecedor_direto,
  } = req.body || {};

  // Modo directo: IBAN + valor passados pelo caller (sem lookup na DB)
  const modoDireto = !!iban_direto;

  if (!modoDireto && (!Array.isArray(faturas_ids) || faturas_ids.length === 0)) {
    return res.status(400).json({ error: 'faturas_ids ou iban_direto+valor_direto são obrigatórios' });
  }
  if (modoDireto && (!valor_direto || Number(valor_direto) <= 0)) {
    return res.status(400).json({ error: 'valor_direto inválido' });
  }

  const supabase = db();

  let faturas = [];

  try {
    if (!modoDireto) {
      const { data, error: fetchErr } = await supabase
        .from('faturas_centro_documentos')
        .select('id, fornecedor, fornecedor_iban, valor, descricao, estado_pagamento')
        .in('id', faturas_ids);

      if (fetchErr) throw new Error(`Supabase fetch faturas: ${fetchErr.message}`);
      if (!data?.length) {
        return res.status(404).json({ error: 'Nenhuma fatura encontrada para os IDs fornecidos' });
      }

      for (const f of data) {
        if (!f.fornecedor_iban) {
          return res.status(400).json({
            error: `Fatura ${f.id} sem IBAN do fornecedor. Actualize o registo antes de pagar.`,
          });
        }
        if (!f.valor || Number(f.valor) <= 0) {
          return res.status(400).json({ error: `Fatura ${f.id} com valor inválido: ${f.valor}` });
        }
      }
      faturas = data;
    } else {
      // Fatura sintética com os dados passados directamente
      faturas = [{
        id: null,
        fornecedor: fornecedor_direto || 'Fornecedor',
        fornecedor_iban: iban_direto.replace(/\s/g, '').toUpperCase(),
        valor: Number(valor_direto),
        descricao: descricaoOverride || `Pagamento ${fornecedor_direto || ''}`,
      }];
    }

    const totalLote = faturas.reduce((s, f) => s + Number(f.valor), 0);
    const descricaoFinal = descricaoOverride
      || (faturas.length === 1
        ? (faturas[0].descricao || `Pagamento ${faturas[0].fornecedor}`)
        : `Magnetic Place — ${faturas.length} faturas`);

    const f = faturas[0];
    const state = crypto.randomUUID();

    // Uma única query — banco + user_id + connection_id
    const { data: conexao } = await supabase
      .from('conexoes_bancarias')
      .select('banco, powens_user_id, powens_connection_id')
      .eq('estado', 'ativa')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conexao?.powens_user_id) {
      throw new Error(
        'powens_user_id em falta — reconecte o banco em Admin → Banco para obter o ID de utilizador Powens.'
      );
    }

    const { data: pagamento, error: insertErr } = await supabase
      .from('powens_pagamentos_pendentes')
      .insert({
        powens_state: state,
        faturas_ids: faturas_ids || [],
        faturas_snapshot: faturas,
        total: totalLote,
        descricao: descricaoFinal,
        banco: conexao.banco || null,
        estado: 'pendente',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertErr) throw new Error(`Supabase insert pagamento: ${insertErr.message}`);

    const connectionId = conexao.powens_connection_id;
    if (!connectionId) {
      throw new Error('Nenhuma conta bancária conectada. Conecte primeiro uma conta em Admin → Banco.');
    }

    const transferBody = {
      recipient: {
        iban: f.fornecedor_iban.replace(/\s/g, ''),
        label: (f.fornecedor || 'Fornecedor').slice(0, 70),
      },
      amount: Number(f.valor),
      currency: 'EUR',
      label: descricaoFinal.slice(0, 140),
    };

    // Tentar endpoints por ordem: connection-level primeiro, depois user-level se user_id disponível
    const endpointsCandidatos = [
      `/connections/${connectionId}/transfers`,
      `/connections/${connectionId}/initiations`,
      ...(conexao.powens_user_id ? [`/users/${conexao.powens_user_id}/transfers`] : []),
    ];

    let transfer;
    let erroFinal;
    for (const endpoint of endpointsCandidatos) {
      try {
        transfer = await powensRequest('POST', endpoint, transferBody);
        console.info('[powens/pay] OK via', endpoint);
        break;
      } catch (e) {
        erroFinal = e;
        console.warn('[powens/pay] falhou', endpoint, ':', e.message);
      }
    }

    if (!transfer) throw erroFinal || new Error('Nenhum endpoint PIS disponível neste sandbox');

    const powensTransferId = transfer.id ? String(transfer.id) : null;

    if (powensTransferId) {
      await supabase
        .from('powens_pagamentos_pendentes')
        .update({ powens_transfer_id: powensTransferId })
        .eq('id', pagamento.id);
    }

    const redirect_url = transfer.webview_url
      || transfer.redirect_url
      || (powensTransferId ? buildWebviewUrl('pay', { transfer_id: powensTransferId, state }) : null);

    if (!redirect_url) {
      throw new Error(`Powens não devolveu URL de pagamento. Resposta: ${JSON.stringify(transfer)}`);
    }

    return res.status(200).json({
      redirect_url,
      pagamento_id: pagamento.id,
      total: totalLote,
    });
  } catch (err) {
    console.error('[powens/pay]', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── sync ──────────────────────────────────────────────────────────────────────
// AIS (leitura de contas/transações) não disponível — sandbox configurado apenas para PIS.
// Esta acção devolve uma mensagem informativa sem chamar a API Powens.
async function handleSync(req, res) {
  return res.status(200).json({
    synced: 0,
    message: 'Sincronização AIS não disponível: ambiente Sandbox configurado apenas para Pay by Bank (PIS). O histórico de pagamentos está disponível na tabela abaixo.',
  });
}
