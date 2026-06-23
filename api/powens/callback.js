/**
 * GET /api/powens/callback
 *
 * Receptor de retorno do Webview Powens após autenticação bancária (AIS) ou
 * aprovação de pagamento (PIS). Inspecciona query params e age conforme:
 *
 *  Sucesso AIS → connection_id presente → atualiza conexoes_bancarias → redirect /admin/banco?powens=sucesso
 *  Sucesso PIS → transfer_id presente   → atualiza powens_pagamentos_pendentes → redirect /admin/pagamentos?powens=sucesso
 *  Erro access_denied → utiliz. cancelou → estado cancelado_pelo_utilizador → redirect ecrã amigável
 *  Erro server_error  → falha técnica banco → regista nos logs → redirect aviso de retry
 */

import { createClient } from '@supabase/supabase-js';
import { powensRequest, APP_URL } from './_client.js';

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  // Aceita GET (redirect do browser) e POST (testes/webhooks)
  const params = req.method === 'POST' ? req.body : req.query;

  const {
    connection_id,
    transfer_id,
    state,
    error,
    error_description,
  } = params || {};

  const supabase = db();

  // ──────────────────────────────────────────────────────────────────────────
  // TRATAMENTO DE ERROS
  // ──────────────────────────────────────────────────────────────────────────
  if (error) {
    if (error === 'access_denied') {
      // Utilizador cancelou o fluxo no banco — experiência amigável
      console.info('[powens/callback] Fluxo cancelado pelo utilizador. state:', state);

      await _atualizarEstadoPorState(supabase, state, 'cancelado_pelo_utilizador', error_description);

      const destino = connection_id !== undefined
        ? `${APP_URL}/admin/documentos/banco/movimentacoes?powens=cancelado`
        : `${APP_URL}/admin/documentos/pagamentos/pagamentos-fornecedores?powens=cancelado`;

      return res.redirect(302, destino);
    }

    if (error === 'server_error') {
      // Falha técnica de comunicação do banco — registar e avisar para retry
      console.error('[powens/callback] Erro técnico do banco.', { error, error_description, state });

      await _atualizarEstadoPorState(supabase, state, 'erro_banco', error_description);

      const destino = connection_id !== undefined
        ? `${APP_URL}/admin/documentos/banco/movimentacoes?powens=erro_banco`
        : `${APP_URL}/admin/documentos/pagamentos/pagamentos-fornecedores?powens=erro_banco`;

      return res.redirect(302, destino);
    }

    // Erro desconhecido — registar e redirecionar para ecrã genérico de erro
    console.error('[powens/callback] Erro desconhecido:', { error, error_description, state });
    await _atualizarEstadoPorState(supabase, state, 'erro', `${error}: ${error_description || ''}`);
    return res.redirect(302, `${APP_URL}/admin/documentos/banco/movimentacoes?powens=erro`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SUCESSO AIS — conexão bancária estabelecida
  // ──────────────────────────────────────────────────────────────────────────
  if (connection_id) {
    try {
      // Verificar que o state corresponde a uma conexão pendente
      const { data: conexao, error: fetchErr } = await supabase
        .from('conexoes_bancarias')
        .select('*')
        .eq('powens_state', state)
        .maybeSingle();

      if (fetchErr) throw new Error(`Supabase lookup: ${fetchErr.message}`);

      if (!conexao) {
        console.error('[powens/callback] Conexão não encontrada para state:', state);
        return res.redirect(302, `${APP_URL}/admin/banco?powens=erro`);
      }

      // Tentar obter id_user via GET /connections/{id} (endpoint básico, sem expand AIS)
      let powensUserId = conexao.powens_user_id || null;
      try {
        const connInfo = await powensRequest('GET', `/connections/${connection_id}`);
        if (connInfo?.id_user) {
          powensUserId = String(connInfo.id_user);
          console.info('[powens/callback] powens_user_id obtido:', powensUserId);
        }
      } catch (e) {
        console.warn('[powens/callback] Não foi possível obter id_user:', e.message);
      }

      const { error: updateErr } = await supabase
        .from('conexoes_bancarias')
        .update({
          estado: 'ativa',
          powens_connection_id: String(connection_id),
          powens_user_id: powensUserId,
          ultima_sincronizacao: new Date().toISOString(),
          erro_detalhe: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conexao.id);

      if (updateErr) throw new Error(`Supabase update: ${updateErr.message}`);

      console.info('[powens/callback] Conexão AIS activada:', { banco: conexao.banco, connection_id });
      return res.redirect(302, `${APP_URL}/admin/documentos/banco/movimentacoes?powens=sucesso&banco=${conexao.banco}`);
    } catch (err) {
      console.error('[powens/callback] Erro a processar callback AIS:', err);
      return res.redirect(302, `${APP_URL}/admin/documentos/banco/movimentacoes?powens=erro`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SUCESSO PIS — transferência aprovada pelo utilizador no banco
  // ──────────────────────────────────────────────────────────────────────────
  if (transfer_id) {
    try {
      const { data: pagamento, error: fetchErr } = await supabase
        .from('powens_pagamentos_pendentes')
        .select('*')
        .eq('powens_state', state)
        .maybeSingle();

      if (fetchErr) throw new Error(`Supabase lookup: ${fetchErr.message}`);

      if (!pagamento) {
        console.error('[powens/callback] Pagamento não encontrado para state:', state);
        return res.redirect(302, `${APP_URL}/admin/pagamentos?powens=erro`);
      }

      // Verificar estado real da transferência na Powens
      let transferStatus = 'validated';
      try {
        const transferData = await powensRequest('GET', `/transfers/${transfer_id}`);
        transferStatus = transferData.state ?? 'validated';
      } catch (e) {
        console.warn('[powens/callback] Não foi possível verificar estado da transferência:', e.message);
      }

      const estadoFinal = transferStatus === 'done' ? 'concluido'
        : transferStatus === 'canceled' ? 'cancelado_pelo_utilizador'
        : 'processando';

      await supabase
        .from('powens_pagamentos_pendentes')
        .update({
          estado: estadoFinal,
          powens_transfer_id: String(transfer_id),
          powens_transfer_estado: transferStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pagamento.id);

      // Atualizar faturas associadas
      if (estadoFinal !== 'cancelado_pelo_utilizador') {
        const faturasIds = (pagamento.faturas_ids || []);
        if (faturasIds.length) {
          await supabase
            .from('faturas_centro_documentos')
            .update({
              powens_transfer_id: String(transfer_id),
              estado_pagamento: estadoFinal === 'concluido' ? 'pago' : 'processando',
              updated_at: new Date().toISOString(),
            })
            .in('id', faturasIds);
        }
      }

      console.info('[powens/callback] PIS processado:', { transfer_id, estado: estadoFinal });
      return res.redirect(302, `${APP_URL}/admin/documentos/pagamentos/pagamentos-fornecedores?powens=sucesso&transfer_id=${transfer_id}`);
    } catch (err) {
      console.error('[powens/callback] Erro a processar callback PIS:', err);
      return res.redirect(302, `${APP_URL}/admin/documentos/pagamentos/pagamentos-fornecedores?powens=erro`);
    }
  }

  // Callback sem parâmetros reconhecíveis
  console.warn('[powens/callback] Callback recebido sem connection_id, transfer_id ou error.', params);
  return res.redirect(302, `${APP_URL}/admin/documentos/banco/movimentacoes?powens=desconhecido`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function _atualizarEstadoPorState(supabase, state, estado, erro_detalhe = null) {
  if (!state) return;
  const ts = new Date().toISOString();
  // Tentar actualizar em ambas as tabelas (só uma terá o state)
  await Promise.allSettled([
    supabase
      .from('conexoes_bancarias')
      .update({ estado, erro_detalhe, updated_at: ts })
      .eq('powens_state', state),
    supabase
      .from('powens_pagamentos_pendentes')
      .update({ estado, erro_detalhe, updated_at: ts })
      .eq('powens_state', state),
  ]);
}
