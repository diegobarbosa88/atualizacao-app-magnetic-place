import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_authUtils.js';

const CATEGORIAS_VALIDAS = ['soldadura', 'caldeiraria', 'certificacao_formal', 'hst', 'equipamentos', 'gwo', 'onboarding'];
const CATEGORIAS_ENTIDADE_EXTERNA = ['certificacao_formal', 'gwo'];
const CATEGORIAS_EXIGEM_VALIDADE = ['certificacao_formal', 'gwo'];
const VALIDADE_PADRAO_MESES = { gwo: 24 };

function addMeses(dataISO, meses) {
  const d = new Date(dataISO);
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;

  const body = req.body || {};
  const {
    categoria, tipo_formacao, data_inicio, data_fim, duracao_horas, local,
    formador_id, entidade_externa,
    objetivos, conteudo_programatico, justificativa_afinidade,
    metodo_avaliacao, resultado_avaliacao, evidencias_url,
    formato = 'presencial', conteudo_url, questionario, nota_minima_aprovacao,
    participantes = [],
  } = body;

  if (!CATEGORIAS_VALIDAS.includes(categoria)) {
    return res.status(400).json({ error: 'Categoria inválida.' });
  }
  if (!tipo_formacao?.trim() || !data_inicio || !data_fim || !(Number(duracao_horas) > 0)) {
    return res.status(400).json({ error: 'Campos obrigatórios: tipo_formacao, data_inicio, data_fim, duracao_horas.' });
  }
  if (!Array.isArray(participantes) || participantes.length === 0) {
    return res.status(400).json({ error: 'Selecione pelo menos um participante.' });
  }
  if (!['presencial', 'e-learning'].includes(formato)) {
    return res.status(400).json({ error: 'Formato inválido.' });
  }
  if (formato === 'e-learning') {
    const perguntasValidas = Array.isArray(questionario) && questionario.length > 0 &&
      questionario.every(q => q.pergunta?.trim() && Array.isArray(q.opcoes) && q.opcoes.length >= 2 &&
        Number.isInteger(q.resposta_correta) && q.resposta_correta >= 0 && q.resposta_correta < q.opcoes.length);
    if (!conteudo_url?.trim()) {
      return res.status(400).json({ error: 'Formação e-learning exige conteudo_url.' });
    }
    if (!perguntasValidas) {
      return res.status(400).json({ error: 'Formação e-learning exige um questionário válido (pergunta, opções, resposta correta).' });
    }
    if (!(Number(nota_minima_aprovacao) > 0) || Number(nota_minima_aprovacao) > 100) {
      return res.status(400).json({ error: 'nota_minima_aprovacao deve ser um valor entre 1 e 100.' });
    }
  }

  const exigeEntidadeExterna = CATEGORIAS_ENTIDADE_EXTERNA.includes(categoria);
  const exigeValidade = CATEGORIAS_EXIGEM_VALIDADE.includes(categoria);

  if (exigeEntidadeExterna && !entidade_externa?.trim()) {
    return res.status(400).json({ error: 'Esta categoria exige o nome da entidade externa certificadora.' });
  }
  // GWO é sempre ministrado pela entidade externa — sem formador interno.
  const formadorFinal = categoria === 'gwo' ? null : (formador_id || null);

  const validadeDefaultMeses = VALIDADE_PADRAO_MESES[categoria];
  const participantesNormalizados = participantes.map(p => {
    const workerId = typeof p === 'string' ? p : p.worker_id;
    let dataValidade = typeof p === 'string' ? null : (p.data_validade || null);
    if (exigeValidade && !dataValidade && validadeDefaultMeses) {
      dataValidade = addMeses(data_fim, validadeDefaultMeses);
    }
    return { worker_id: workerId, data_validade: dataValidade };
  });

  if (exigeValidade && participantesNormalizados.some(p => !p.data_validade)) {
    return res.status(400).json({ error: 'Esta categoria exige data de validade para todos os participantes.' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: formacao, error } = await supabase
    .from('formacoes_internas')
    .insert({
      categoria,
      tipo_formacao: tipo_formacao.trim(),
      titulo: tipo_formacao.trim(),
      data_inicio,
      data_fim,
      duracao_horas: Number(duracao_horas),
      local: local?.trim() || null,
      formador_id: formadorFinal,
      entidade_externa: entidade_externa?.trim() || null,
      exige_entidade_externa: exigeEntidadeExterna,
      objetivos: objetivos?.trim() || null,
      conteudo_programatico: conteudo_programatico?.trim() || null,
      justificativa_afinidade: justificativa_afinidade?.trim() || null,
      metodo_avaliacao: metodo_avaliacao?.trim() || null,
      resultado_avaliacao: resultado_avaliacao?.trim() || null,
      evidencias_url: evidencias_url?.trim() || null,
      formato,
      conteudo_url: formato === 'e-learning' ? conteudo_url.trim() : null,
      questionario: formato === 'e-learning' ? questionario : null,
      nota_minima_aprovacao: formato === 'e-learning' ? Number(nota_minima_aprovacao) : null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const { error: partError } = await supabase
    .from('formacao_participantes')
    .insert(participantesNormalizados.map(p => ({
      formacao_id: formacao.id,
      worker_id: p.worker_id,
      data_validade: p.data_validade,
    })));

  if (partError) {
    await supabase.from('formacoes_internas').delete().eq('id', formacao.id);
    return res.status(500).json({ error: partError.message });
  }

  return res.status(201).json({ formacao });
}
