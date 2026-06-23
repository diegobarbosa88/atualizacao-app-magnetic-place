/**
 * POST /api/powens/connect
 *
 * Inicia um fluxo AIS (Account Information Service) para novobanco ou Santander.
 * Devolve a URL do Webview Powens para redirecionamento full-page no frontend.
 *
 * Body: { banco: 'novobanco' | 'santander' }
 * Response: { redirect_url: string, conexao_id: string }
 */

import { createClient } from '@supabase/supabase-js';
import { getUserToken, buildWebviewUrl } from './_client.js';

// IDs de conector Powens para cada banco PT suportado
const CONNECTOR_IDS = {
  novobanco: '338',
  santander: '315',
};

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { banco } = req.body || {};

  if (!banco || !CONNECTOR_IDS[banco]) {
    return res.status(400).json({
      error: `banco inválido: "${banco}". Use um de: ${Object.keys(CONNECTOR_IDS).join(', ')}`,
    });
  }

  const supabase = db();

  try {
    // Verificar se já existe conexão activa para este banco
    const { data: existente } = await supabase
      .from('conexoes_bancarias')
      .select('powens_user_id')
      .eq('banco', banco)
      .maybeSingle();

    // Criar ou reutilizar utilizador Powens
    const { userToken, userId } = await getUserToken(existente?.powens_user_id ?? null);

    // Gerar state único para protecção CSRF
    const state = crypto.randomUUID();

    // Persistir registo da conexão antes do redirect
    const { data: conexao, error: upsertErr } = await supabase
      .from('conexoes_bancarias')
      .upsert(
        {
          banco,
          powens_user_id: userId,
          estado: 'pendente',
          powens_state: state,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'banco' }
      )
      .select('id')
      .single();

    if (upsertErr) throw new Error(`Supabase upsert: ${upsertErr.message}`);

    // Construir URL Webview — idioma pt, fluxo connect
    const redirect_url = buildWebviewUrl('connect', {
      token: userToken,
      state,
      // Pré-filtrar ao banco seleccionado
      'connector_ids[]': CONNECTOR_IDS[banco],
    });

    return res.status(200).json({ redirect_url, conexao_id: conexao.id });
  } catch (err) {
    console.error('[powens/connect]', err);
    return res.status(500).json({ error: err.message });
  }
}
