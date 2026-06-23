/**
 * POST /api/powens/payments
 *
 * Inicia um fluxo PIS (Payment Initiation Service) via Powens.
 * Cria a transferência, guarda estado no Supabase e devolve a URL do Webview
 * para redirecionamento full-page no frontend (sem popups).
 *
 * Body:
 * {
 *   faturas_ids: string[],           // IDs de faturas_centro_documentos
 *   descricao?: string,              // Override da descrição da transferência
 * }
 *
 * Response:
 * {
 *   redirect_url: string,            // URL do Webview Powens (flow=pay, lang=pt)
 *   pagamento_id: string,            // ID do registo em powens_pagamentos_pendentes
 *   total: number,
 * }
 */

import { createClient } from '@supabase/supabase-js';
import { getUserToken, buildWebviewUrl, powensRequest } from './_client.js';

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { faturas_ids, descricao: descricaoOverride } = req.body || {};

  if (!Array.isArray(faturas_ids) || faturas_ids.length === 0) {
    return res.status(400).json({ error: 'faturas_ids é obrigatório e não pode estar vazio' });
  }

  const supabase = db();

  try {
    // ── 1. Obter faturas e validar ────────────────────────────────────────────
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

    // ── 2. Obter conexão bancária activa para usar como conta devedora ────────
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

    // ── 3. Obter user token para criar a transferência ────────────────────────
    const { userToken, userId } = await getUserToken(conexao.powens_user_id);

    // ── 4. Criar transferência na Powens ──────────────────────────────────────
    // Para lotes com múltiplos destinatários, Powens suporta bulk transfers.
    // Aqui usamos a primeira fatura como destinatário principal; para pagamentos
    // multi-beneficiário criar uma transferência por cada fatura é o padrão seguro.
    let powensTransferId;

    if (faturas.length === 1) {
      const f = faturas[0];
      const transferData = await powensRequest('POST', `/users/${userId}/transfers`, {
        account_id: parseInt(conexao.powens_connection_id, 10),
        recipient: {
          iban: f.fornecedor_iban.replace(/\s/g, ''),
          label: (f.fornecedor_nome || 'Fornecedor').slice(0, 70),
        },
        amount: Number(f.valor_total),
        currency: 'EUR',
        label: descricaoFinal.slice(0, 140),
      });
      powensTransferId = String(transferData.id);
    } else {
      // Lote: criar uma transferência por fatura (Powens não tem bulk em todos os bancos)
      // Usamos o primeiro transfer_id como referência principal do lote
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

    // ── 5. Gerar state para CSRF ──────────────────────────────────────────────
    const state = crypto.randomUUID();

    // ── 6. Persistir registo de pagamento pendente ────────────────────────────
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

    // Marcar faturas como em processamento
    await supabase
      .from('faturas_centro_documentos')
      .update({
        powens_transfer_id: powensTransferId,
        estado_pagamento: 'processando',
        updated_at: new Date().toISOString(),
      })
      .in('id', faturas_ids);

    // ── 7. Construir URL do Webview Powens (flow=pay, lang=pt) ───────────────
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
    console.error('[powens/payments]', err);
    return res.status(500).json({ error: err.message });
  }
}
