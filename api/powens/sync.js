/**
 * POST /api/powens/sync
 *
 * Sincroniza contas e movimentos bancários de todas as conexões activas.
 * Faz upsert na tabela movimentos_bancarios com base em powens_transaction_id.
 *
 * Utilizado tanto manualmente (botão "Sincronizar") como via cron.
 */

import { createClient } from '@supabase/supabase-js';
import { powensRequest } from './_client.js';

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
        // Disparar sincronização da ligação
        await powensRequest(
          'PUT',
          `/users/${conexao.powens_user_id}/connections/${conexao.powens_connection_id}/sync`
        ).catch(e => {
          // sync pode retornar 202 Accepted — ignorar erros não críticos
          console.warn(`[powens/sync] Sync trigger ${conexao.banco}:`, e.message);
        });

        // Obter contas
        const { accounts = [] } = await powensRequest(
          'GET',
          `/users/${conexao.powens_user_id}/accounts?connection_id=${conexao.powens_connection_id}`
        );

        // Guardar saldos das contas
        if (accounts.length) {
          await supabase.from('conexoes_bancarias').update({
            saldos: accounts.map(a => ({
              id: a.id,
              nome: a.name,
              iban: a.iban,
              saldo: a.balance,
              moeda: a.currency,
              tipo: a.type,
            })),
            ultima_sincronizacao: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', conexao.id);
        }

        // Obter transacções (últimos 90 dias por omissão)
        const desde = new Date();
        desde.setDate(desde.getDate() - 90);
        const desdeStr = desde.toISOString().slice(0, 10);

        const { transactions = [] } = await powensRequest(
          'GET',
          `/users/${conexao.powens_user_id}/transactions?connection_id=${conexao.powens_connection_id}&min_date=${desdeStr}&limit=500`
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
            categoria: t.category ?? null,
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

        resultados.push({
          banco: conexao.banco,
          contas: accounts.length,
          transacoes: transactions.length,
          ok: true,
        });
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
