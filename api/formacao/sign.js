import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_authUtils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sessao = requireAuth(req, res, ['admin', 'worker']);
  if (!sessao) return;

  const { participante_id, assinatura_base64 } = req.body || {};
  if (!participante_id || !assinatura_base64?.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Campos obrigatórios: participante_id, assinatura_base64 (data:image/...).' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: participante, error: fetchError } = await supabase
    .from('formacao_participantes')
    .select('id, formacao_id, worker_id, estado_conclusao, formacoes_internas(formato)')
    .eq('id', participante_id)
    .single();

  if (fetchError || !participante) {
    return res.status(404).json({ error: 'Participante não encontrado.' });
  }

  // A assinatura só tem validade legal se for o próprio trabalhador a
  // desenhá-la — um worker só pode assinar a sua própria participação.
  const isAdmin = sessao.role === 'admin' || sessao.isAdmin;
  if (!isAdmin && String(participante.worker_id) !== String(sessao.id)) {
    return res.status(403).json({ error: 'Só podes assinar as tuas próprias formações.' });
  }

  // A assinatura confirma a conclusão da formação — nas ações e-learning só
  // pode acontecer depois de aprovado no questionário, nunca antes/em vez.
  if (participante.formacoes_internas?.formato === 'e-learning' && participante.estado_conclusao !== 'concluido') {
    return res.status(403).json({ error: 'Tens de concluir o questionário com aprovação antes de assinar.' });
  }

  const base64Data = assinatura_base64.split(',')[1];
  const buffer = Buffer.from(base64Data, 'base64');
  const path = `${participante.formacao_id}/${participante.worker_id}.png`;

  const { error: uploadError } = await supabase.storage
    .from('formacao-interna')
    .upload(path, buffer, { contentType: 'image/png', upsert: true });

  if (uploadError) return res.status(500).json({ error: uploadError.message });

  const { error: updateError } = await supabase
    .from('formacao_participantes')
    .update({ assinatura_url: path, assinado_em: new Date().toISOString() })
    .eq('id', participante_id);

  if (updateError) return res.status(500).json({ error: updateError.message });

  return res.status(200).json({ ok: true });
}
