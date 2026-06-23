/**
 * POST /api/webhooks/powens
 *
 * Receptor de webhooks push da Powens (Budget Insight).
 * Segurança e conformidade técnica:
 *
 *  1. Valida `Authorization: Bearer {POWENS_WEBHOOK_SECRET}` antes de qualquer acção.
 *  2. Responde HTTP 200 IMEDIATAMENTE após validar origem e ler o corpo,
 *     para evitar timeouts (Powens aguarda <5 s) e reenvios em loop.
 *  3. Suporta `content-encoding: gzip` — o body parser da Vercel é desactivado
 *     e o corpo é descomprimido manualmente via Node zlib.
 *  4. Processamento pesado (upsert de transações) corre de forma assíncrona
 *     APÓS a resposta ter sido enviada, dentro do maxDuration da função.
 *
 * Eventos tratados:
 *  - connection.synced / connection.updated → atualiza conexoes_bancarias
 *  - transaction.created / transaction.updated → upsert em movimentos_bancarios
 *  - transfer.updated → atualiza powens_pagamentos_pendentes + faturas_centro_documentos
 */

import { createClient } from '@supabase/supabase-js';
import { createGunzip } from 'zlib';

// ── Desactivar body parser da Vercel — tratamos manualmente para suporte gzip ──
export const config = {
  api: { bodyParser: false },
};

const WEBHOOK_SECRET = process.env.POWENS_WEBHOOK_SECRET;

function db() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

// ── Leitura e descompressão do corpo ─────────────────────────────────────────
function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const isGzip = (req.headers['content-encoding'] || '').toLowerCase() === 'gzip';

    // Se vier comprimido, encadeamos um Gunzip antes de ler
    const stream = isGzip ? req.pipe(createGunzip()) : req;

    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(new Error(`JSON inválido: ${e.message}`));
      }
    });
    stream.on('error', reject);
  });
}

// ── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 1. Validação da origem via Bearer token ──────────────────────────────
  const authHeader = req.headers['authorization'] || '';
  const receivedToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!WEBHOOK_SECRET || receivedToken !== WEBHOOK_SECRET) {
    console.warn('[webhooks/powens] Token Bearer inválido ou ausente');
    // Devolvemos 401 mas não revelamos o motivo ao exterior
    return res.status(401).end();
  }

  // ── 2. Ler e descomprimir corpo ──────────────────────────────────────────
  let payload;
  try {
    payload = await lerCorpo(req);
  } catch (e) {
    console.error('[webhooks/powens] Erro ao ler corpo:', e.message);
    return res.status(400).end();
  }

  // ── 3. Resposta 200 IMEDIATA — Powens não espera mais de ~5 s ────────────
  // A função Vercel continua a executar após res.end() até maxDuration.
  res.status(200).end();

  // ── 4. Processamento assíncrono após resposta enviada ────────────────────
  _processarEvento(payload).catch(err => {
    console.error('[webhooks/powens] Erro no processamento assíncrono:', err);
  });
}

// ── Processamento de eventos ─────────────────────────────────────────────────
async function _processarEvento(payload) {
  const supabase = db();
  const { event } = payload;

  if (!event) {
    console.warn('[webhooks/powens] Payload sem campo "event":', JSON.stringify(payload).slice(0, 200));
    return;
  }

  console.info('[webhooks/powens] Evento:', event);

  switch (event) {

    // ── Conexão AIS sincronizada ou actualizada ───────────────────────────
    case 'connection.synced':
    case 'connection.updated': {
      const conn = payload.connection ?? payload;
      const connectionId = conn?.id;
      if (!connectionId) break;

      const temErro = Boolean(conn.error || conn.error_message);
      const { error } = await supabase
        .from('conexoes_bancarias')
        .update({
          estado: temErro ? 'erro_banco' : 'ativa',
          erro_detalhe: conn.error_message ?? conn.error ?? null,
          ultima_sincronizacao: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('powens_connection_id', String(connectionId));

      if (error) console.error('[webhooks/powens] Update conexão:', error.message);
      else console.info(`[webhooks/powens] Conexão ${connectionId} → ${temErro ? 'erro_banco' : 'ativa'}`);
      break;
    }

    // ── Transacções novas ou actualizadas ─────────────────────────────────
    case 'transaction.created':
    case 'transaction.updated': {
      // A Powens pode enviar array (transaction.created em lote) ou objecto singular
      const transactions = Array.isArray(payload.transactions)
        ? payload.transactions
        : payload.transaction
          ? [payload.transaction]
          : [];

      if (transactions.length === 0) {
        console.warn('[webhooks/powens] Evento transação sem dados');
        break;
      }

      // Resolver conexao_id a partir do powens_connection_id da primeira transação
      const connectionId = transactions[0]?.id_connection ?? transactions[0]?.connection_id;
      let conexaoId = null;
      let bancoDaConexao = null;

      if (connectionId) {
        const { data: cx } = await supabase
          .from('conexoes_bancarias')
          .select('id, banco')
          .eq('powens_connection_id', String(connectionId))
          .maybeSingle();
        conexaoId = cx?.id ?? null;
        bancoDaConexao = cx?.banco ?? null;
      }

      const rows = transactions.map(t => ({
        powens_transaction_id: String(t.id),
        conexao_id: conexaoId,
        banco: bancoDaConexao ?? 'desconhecido',
        data: t.date ?? null,
        data_valor: t.rdate ?? t.date ?? null,
        valor: t.value ?? null,
        descricao: t.original_wording || t.wording || '',
        tipo: t.type ?? null,
        estado: t.state ?? null,
        // category pode vir como string ou como objecto {id, name}
        categoria: typeof t.category === 'object' ? t.category?.name ?? null : t.category ?? null,
        dados_raw: t,
      }));

      const { error } = await supabase
        .from('movimentos_bancarios')
        .upsert(rows, { onConflict: 'powens_transaction_id', ignoreDuplicates: false });

      if (error) console.error('[webhooks/powens] Upsert transações:', error.message);
      else console.info(`[webhooks/powens] ${rows.length} transação(ões) upserted`);
      break;
    }

    // ── Transferência PIS actualizada ─────────────────────────────────────
    case 'transfer.updated': {
      const transfer = payload.transfer ?? payload;
      const transferId = transfer?.id;
      const transferState = transfer?.state;
      if (!transferId) break;

      const estadoLocal =
        transferState === 'done'     ? 'concluido' :
        transferState === 'canceled' ? 'cancelado_pelo_utilizador' :
                                       'processando';

      await supabase
        .from('powens_pagamentos_pendentes')
        .update({
          powens_transfer_estado: transferState,
          estado: estadoLocal,
          updated_at: new Date().toISOString(),
        })
        .eq('powens_transfer_id', String(transferId));

      // Se concluída, marcar as faturas associadas como pagas
      if (estadoLocal === 'concluido') {
        const { data: pag } = await supabase
          .from('powens_pagamentos_pendentes')
          .select('faturas_ids')
          .eq('powens_transfer_id', String(transferId))
          .maybeSingle();

        if (pag?.faturas_ids?.length) {
          await supabase
            .from('faturas_centro_documentos')
            .update({
              estado_pagamento: 'pago',
              updated_at: new Date().toISOString(),
            })
            .in('id', pag.faturas_ids);

          console.info(`[webhooks/powens] ${pag.faturas_ids.length} fatura(s) marcada(s) como pagas`);
        }
      }

      console.info(`[webhooks/powens] Transferência ${transferId} → ${estadoLocal}`);
      break;
    }

    default:
      console.info('[webhooks/powens] Evento não mapeado ignorado:', event);
  }
}
