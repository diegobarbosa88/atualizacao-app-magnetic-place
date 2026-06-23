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
import { getUserToken, buildWebviewUrl, powensRequest } from './_client.js'; // getUserToken usado em handlePay

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
  const { faturas_ids, descricao: descricaoOverride } = req.body || {};

  if (!Array.isArray(faturas_ids) || faturas_ids.length === 0) {
    return res.status(400).json({ error: 'faturas_ids é obrigatório e não pode estar vazio' });
  }

  const supabase = db();

  try {
    const { data: faturas, error: fetchErr } = await supabase
      .from('faturas_centro_documentos')
      .select('id, fornecedor_nome, fornecedor_iban, valor_total, descricao, estado_pagamento')
      .in('id', faturas_ids);

    if (fetchErr) throw new Error(`Supabase fetch faturas: ${fetchErr.message}`);
    if (!faturas?.length) {
      return res.status(404).json({ error: 'Nenhuma fatura encontrada para os IDs fornecidos' });
    }

    for (const f of faturas) {
      if (!f.fornecedor_iban) {
        return res.status(400).json({
          error: `Fatura ${f.id} sem IBAN do fornecedor. Actualize o registo antes de pagar.`,
        });
      }
      if (!f.valor_total || Number(f.valor_total) <= 0) {
        return res.status(400).json({ error: `Fatura ${f.id} com valor inválido: ${f.valor_total}` });
      }
    }

    const totalLote = faturas.reduce((s, f) => s + Number(f.valor_total), 0);
    const descricaoFinal = descricaoOverride
      || (faturas.length === 1
        ? (faturas[0].descricao || `Pagamento ${faturas[0].fornecedor_nome}`)
        : `Magnetic Place — ${faturas.length} faturas`);

    const { data: conexao } = await supabase
      .from('conexoes_bancarias')
      .select('powens_user_id, powens_connection_id, banco')
      .eq('estado', 'ativa')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conexao?.powens_user_id) {
      return res.status(400).json({
        error: 'Nenhuma conta bancária conectada. Conecte primeiro uma conta em Admin → Banco.',
      });
    }

    const { userToken, userId } = await getUserToken(conexao.powens_user_id);

    let powensTransferId;

    if (faturas.length === 1) {
      const f = faturas[0];
      const td = await powensRequest('POST', `/users/${userId}/transfers`, {
        account_id: parseInt(conexao.powens_connection_id, 10),
        recipient: {
          iban: f.fornecedor_iban.replace(/\s/g, ''),
          label: (f.fornecedor_nome || 'Fornecedor').slice(0, 70),
        },
        amount: Number(f.valor_total),
        currency: 'EUR',
        label: descricaoFinal.slice(0, 140),
      });
      powensTransferId = String(td.id);
    } else {
      const ids = [];
      for (const f of faturas) {
        const td = await powensRequest('POST', `/users/${userId}/transfers`, {
          account_id: parseInt(conexao.powens_connection_id, 10),
          recipient: {
            iban: f.fornecedor_iban.replace(/\s/g, ''),
            label: (f.fornecedor_nome || 'Fornecedor').slice(0, 70),
          },
          amount: Number(f.valor_total),
          currency: 'EUR',
          label: (f.descricao || `Pagamento ${f.fornecedor_nome}`).slice(0, 140),
        });
        ids.push(String(td.id));
      }
      powensTransferId = ids[0];
    }

    const state = crypto.randomUUID();

    const { data: pagamento, error: insertErr } = await supabase
      .from('powens_pagamentos_pendentes')
      .insert({
        powens_transfer_id: powensTransferId,
        powens_state: state,
        faturas_ids,
        faturas_snapshot: faturas,
        total: totalLote,
        descricao: descricaoFinal,
        banco: conexao.banco,
        estado: 'pendente',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertErr) throw new Error(`Supabase insert pagamento: ${insertErr.message}`);

    await supabase
      .from('faturas_centro_documentos')
      .update({
        powens_transfer_id: powensTransferId,
        estado_pagamento: 'processando',
        updated_at: new Date().toISOString(),
      })
      .in('id', faturas_ids);

    const redirect_url = buildWebviewUrl('pay', {
      token: userToken,
      transfer_id: powensTransferId,
      state,
    });

    return res.status(200).json({
      redirect_url,
      pagamento_id: pagamento.id,
      total: totalLote,
      transfer_id: powensTransferId,
    });
  } catch (err) {
    console.error('[powens/pay]', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── sync ──────────────────────────────────────────────────────────────────────
// Body: {} (sem parâmetros obrigatórios)
// Response: { synced, resultados }
async function handleSync(req, res) {
  const supabase = db();

  try {
    const { data: conexoes, error: fetchErr } = await supabase
      .from('conexoes_bancarias')
      .select('*')
      .eq('estado', 'ativa');

    if (fetchErr) throw new Error(`Supabase: ${fetchErr.message}`);

    if (!conexoes?.length) {
      return res.status(200).json({ message: 'Nenhuma conta bancária conectada.', synced: 0 });
    }

    const resultados = [];

    for (const conexao of conexoes) {
      try {
        await powensRequest(
          'PUT',
          `/users/${conexao.powens_user_id}/connections/${conexao.powens_connection_id}/sync`,
        ).catch(e => {
          console.warn(`[powens/sync] Sync trigger ${conexao.banco}:`, e.message);
        });

        const { accounts = [] } = await powensRequest(
          'GET',
          `/users/${conexao.powens_user_id}/accounts?connection_id=${conexao.powens_connection_id}`,
        );

        if (accounts.length) {
          await supabase.from('conexoes_bancarias').update({
            saldos: accounts.map(a => ({
              id: a.id,
              nome: a.name,
              iban: a.iban,
              saldo: a.balance,
              moeda: a.currency?.id ?? a.currency ?? 'EUR',
              tipo: a.type,
            })),
            ultima_sincronizacao: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', conexao.id);
        }

        const desde = new Date();
        desde.setDate(desde.getDate() - 90);
        const desdeStr = desde.toISOString().slice(0, 10);

        const { transactions = [] } = await powensRequest(
          'GET',
          `/users/${conexao.powens_user_id}/transactions?connection_id=${conexao.powens_connection_id}&min_date=${desdeStr}&limit=500`,
        );

        if (transactions.length) {
          const rows = transactions.map(t => ({
            powens_transaction_id: String(t.id),
            conexao_id: conexao.id,
            banco: conexao.banco,
            data: t.date,
            data_valor: t.rdate ?? t.date,
            valor: t.value,
            descricao: t.original_wording || t.wording || '',
            tipo: t.type ?? null,
            estado: t.state ?? null,
            categoria: typeof t.category === 'object' ? t.category?.name ?? null : t.category ?? null,
            dados_raw: t,
            created_at: new Date().toISOString(),
          }));

          const { error: upsertErr } = await supabase
            .from('movimentos_bancarios')
            .upsert(rows, { onConflict: 'powens_transaction_id', ignoreDuplicates: false });

          if (upsertErr) {
            console.error(`[powens/sync] Upsert transacções ${conexao.banco}:`, upsertErr.message);
          }
        }

        resultados.push({ banco: conexao.banco, contas: accounts.length, transacoes: transactions.length, ok: true });
      } catch (err) {
        console.error(`[powens/sync] Erro ${conexao.banco}:`, err);
        resultados.push({ banco: conexao.banco, ok: false, erro: err.message });
      }
    }

    return res.status(200).json({ synced: resultados.length, resultados });
  } catch (err) {
    console.error('[powens/sync]', err);
    return res.status(500).json({ error: err.message });
  }
}
