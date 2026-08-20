import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_authUtils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sessao = requireAuth(req, res, ['admin', 'worker']);
  if (!sessao) return;

  const { participante_id, respostas } = req.body || {};
  if (!participante_id || !Array.isArray(respostas)) {
    return res.status(400).json({ error: 'Campos obrigatórios: participante_id, respostas (array).' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: participante, error: fetchError } = await supabase
    .from('formacao_participantes')
    .select('id, worker_id, formacao_id, formacoes_internas(formato, questionario, nota_minima_aprovacao)')
    .eq('id', participante_id)
    .single();

  if (fetchError || !participante) {
    return res.status(404).json({ error: 'Participante não encontrado.' });
  }

  const isAdmin = sessao.role === 'admin' || sessao.isAdmin;
  if (!isAdmin && String(participante.worker_id) !== String(sessao.id)) {
    return res.status(403).json({ error: 'Só podes responder ao teu próprio questionário.' });
  }

  const formacao = participante.formacoes_internas;
  const questionario = formacao?.questionario;
  if (formacao?.formato !== 'e-learning' || !Array.isArray(questionario) || questionario.length === 0) {
    return res.status(400).json({ error: 'Esta formação não tem questionário.' });
  }
  if (respostas.length !== questionario.length) {
    return res.status(400).json({ error: 'Número de respostas não corresponde ao número de perguntas.' });
  }

  // Correção sempre no servidor — resposta_correta nunca é enviada ao
  // cliente antes deste ponto (ver api/formacao/minhas.js).
  const acertos = questionario.reduce((total, pergunta, i) => (
    total + (Number(respostas[i]) === Number(pergunta.resposta_correta) ? 1 : 0)
  ), 0);
  const notaObtida = Math.round((acertos / questionario.length) * 10000) / 100;
  const aprovado = notaObtida >= Number(formacao.nota_minima_aprovacao);

  const update = {
    respostas_questionario: respostas,
    nota_obtida: notaObtida,
    estado_conclusao: aprovado ? 'concluido' : 'reprovado',
    concluido_em: aprovado ? new Date().toISOString() : null,
  };

  const { error: updateError } = await supabase
    .from('formacao_participantes')
    .update(update)
    .eq('id', participante_id);

  if (updateError) return res.status(500).json({ error: updateError.message });

  return res.status(200).json({ nota_obtida: notaObtida, aprovado, estado_conclusao: update.estado_conclusao });
}
