import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_authUtils.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const sessao = requireAuth(req, res, ['admin', 'worker']);
  if (!sessao) return;

  // Autosserviço: mostra sempre as formações do próprio utilizador
  // autenticado — nunca as de terceiros, independentemente de query params.
  const workerId = sessao.id;
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('formacao_participantes')
    .select(`
      id, formacao_id, assinatura_url, assinado_em, data_validade,
      iniciado_em, concluido_em, nota_obtida, estado_conclusao,
      formacoes_internas(
        categoria, tipo_formacao, titulo, data_inicio, data_fim, duracao_horas,
        local, entidade_externa, formato, conteudo_url, questionario, nota_minima_aprovacao,
        formador:formador_id(name)
      )
    `)
    .eq('worker_id', workerId)
    .order('formacao_id', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const participacoes = (data || []).map(p => ({
    participante_id: p.id,
    formacao_id: p.formacao_id,
    assinado_em: p.assinado_em,
    data_validade: p.data_validade,
    categoria: p.formacoes_internas?.categoria,
    tipo_formacao: p.formacoes_internas?.tipo_formacao || p.formacoes_internas?.titulo,
    data_inicio: p.formacoes_internas?.data_inicio,
    data_fim: p.formacoes_internas?.data_fim,
    duracao_horas: p.formacoes_internas?.duracao_horas,
    local: p.formacoes_internas?.local,
    entidade_externa: p.formacoes_internas?.entidade_externa,
    formador_nome: p.formacoes_internas?.formador?.name || null,
    // e-learning — resposta_correta é sempre removida antes de sair do servidor.
    formato: p.formacoes_internas?.formato || 'presencial',
    conteudo_url: p.formacoes_internas?.conteudo_url || null,
    nota_minima_aprovacao: p.formacoes_internas?.nota_minima_aprovacao ?? null,
    questionario: Array.isArray(p.formacoes_internas?.questionario)
      ? p.formacoes_internas.questionario.map(q => ({ pergunta: q.pergunta, opcoes: q.opcoes }))
      : null,
    iniciado_em: p.iniciado_em,
    concluido_em: p.concluido_em,
    nota_obtida: p.nota_obtida,
    estado_conclusao: p.estado_conclusao,
  })).sort((a, b) => new Date(b.data_inicio) - new Date(a.data_inicio));

  return res.status(200).json({ participacoes });
}
