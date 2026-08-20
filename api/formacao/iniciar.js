import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_authUtils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sessao = requireAuth(req, res, ['admin', 'worker']);
  if (!sessao) return;

  const { participante_id } = req.body || {};
  if (!participante_id) return res.status(400).json({ error: 'Campo obrigatório: participante_id.' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: participante, error: fetchError } = await supabase
    .from('formacao_participantes')
    .select('id, worker_id, iniciado_em, estado_conclusao')
    .eq('id', participante_id)
    .single();

  if (fetchError || !participante) {
    return res.status(404).json({ error: 'Participante não encontrado.' });
  }

  const isAdmin = sessao.role === 'admin' || sessao.isAdmin;
  if (!isAdmin && String(participante.worker_id) !== String(sessao.id)) {
    return res.status(403).json({ error: 'Só podes iniciar as tuas próprias formações.' });
  }

  const update = {};
  if (!participante.iniciado_em) update.iniciado_em = new Date().toISOString();
  // Nunca faz downgrade de 'concluido'/'reprovado' — só avança quem ainda não começou.
  if (participante.estado_conclusao === 'nao_iniciado') update.estado_conclusao = 'em_progresso';

  if (Object.keys(update).length > 0) {
    const { error: updateError } = await supabase
      .from('formacao_participantes')
      .update(update)
      .eq('id', participante_id);
    if (updateError) return res.status(500).json({ error: updateError.message });
  }

  return res.status(200).json({ ok: true });
}
