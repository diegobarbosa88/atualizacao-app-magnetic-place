import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { requireAuth } from '../_authUtils.js';
import { getGateStatus } from '../_gateUtils.js';
import { calculateDuration } from '../../src/utils/formatUtils.js';

// Todos os endpoints de Formação Interna vivem numa única função serverless
// — o plano Hobby da Vercel limita a 12 funções por deployment; ter um
// ficheiro por endpoint (8+ aqui) estourava o limite. Dispatch por
// req.query.action, alimentado pelos rewrites /api/formacao/<action> ->
// /api/formacao?action=<action> em vercel.json (mesmo padrão já usado em
// api/toconline/proxy.js e api/reconciliacao/index.js). Nota: uma rota
// dinâmica [action].js foi tentada primeiro mas o `vercel dev` local não a
// reconhecia (nenhum sub-path respondia) — o padrão de rewrite é o que já
// está validado a funcionar no resto do projeto.

const CATEGORIAS_VALIDAS = ['soldadura', 'caldeiraria', 'certificacao_formal', 'hst', 'equipamentos', 'gwo', 'onboarding', 'tecnico'];
const CATEGORIAS_ENTIDADE_EXTERNA = ['certificacao_formal', 'gwo'];
const CATEGORIAS_EXIGEM_VALIDADE = ['certificacao_formal', 'gwo'];
const VALIDADE_PADRAO_MESES = { gwo: 24 };
const META_HORAS_ANO = 40;
const DIAS_A_EXPIRAR = 60;

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function slugify(texto) {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function addMeses(dataISO, meses) {
  const d = new Date(dataISO);
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

function calcularEstadoValidade(dataValidade) {
  if (!dataValidade) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const validade = new Date(dataValidade);
  const diffDias = Math.floor((validade - hoje) / 86400000);
  if (diffDias < 0) return 'expirado';
  if (diffDias <= DIAS_A_EXPIRAR) return 'a_expirar';
  return 'valido';
}

async function handleList(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;

  const { worker_id, ano, categoria, estado, formato } = req.query;
  const supabase = getSupabase();

  let query = supabase
    .from('formacoes_internas')
    .select('*, formador:formador_id(name), formacao_participantes(id, worker_id, assinatura_url, assinado_em, data_validade, iniciado_em, concluido_em, nota_obtida, estado_conclusao, workers(name))')
    .order('data_inicio', { ascending: false });

  if (ano) {
    query = query.gte('data_inicio', `${ano}-01-01`).lte('data_inicio', `${ano}-12-31`);
  }
  if (categoria) {
    query = query.eq('categoria', categoria);
  }
  if (formato) {
    query = query.eq('formato', formato);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  let formacoes = data || [];

  for (const f of formacoes) {
    for (const p of f.formacao_participantes) {
      p.estado = calcularEstadoValidade(p.data_validade);
      if (p.assinatura_url) {
        const { data: signed } = await supabase.storage
          .from('formacao-interna')
          .createSignedUrl(p.assinatura_url, 3600);
        p.assinatura_signed_url = signed?.signedUrl || null;
      }
    }
  }

  if (worker_id) {
    formacoes = formacoes.filter(f => f.formacao_participantes.some(p => p.worker_id === worker_id));
  }
  if (estado) {
    formacoes = formacoes.filter(f => f.formacao_participantes.some(p => p.estado === estado));
  }

  return res.status(200).json({ formacoes });
}

async function handleCreate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;

  const body = req.body || {};
  const {
    categoria, tipo_formacao, data_inicio, data_fim, duracao_horas, local,
    formador_id, entidade_externa,
    objetivos, conteudo_programatico, justificativa_afinidade,
    metodo_avaliacao, resultado_avaliacao, evidencias_url,
    formato = 'presencial', conteudo_url, conteudo_estruturado, questionario, nota_minima_aprovacao,
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
    const temConteudoEstruturado = conteudo_estruturado && Array.isArray(conteudo_estruturado.seccoes) && conteudo_estruturado.seccoes.length > 0;
    if (!conteudo_url?.trim() && !temConteudoEstruturado) {
      return res.status(400).json({ error: 'Formação e-learning exige conteudo_url ou conteudo_estruturado.' });
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

  const supabase = getSupabase();

  // Evita duplicados: se já existe uma ação e-learning com este mesmo tipo,
  // usar "Atribuir Trabalhadores" nessa em vez de criar outra igual.
  if (formato === 'e-learning') {
    const { data: existentes } = await supabase
      .from('formacoes_internas')
      .select('id')
      .eq('categoria', categoria)
      .eq('tipo_formacao', tipo_formacao.trim())
      .eq('formato', 'e-learning')
      .limit(1);
    if (existentes && existentes.length > 0) {
      return res.status(409).json({
        error: `Já existe uma ação e-learning "${tipo_formacao.trim()}". Usa "Atribuir Trabalhadores" nessa ação em vez de criar outra igual.`,
      });
    }
  }

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
      conteudo_url: formato === 'e-learning' && conteudo_url?.trim() ? conteudo_url.trim() : null,
      conteudo_estruturado: formato === 'e-learning' ? conteudo_estruturado || null : null,
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

async function handleAtribuir(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;

  const { formacao_id, participantes } = req.body || {};
  if (!formacao_id || !Array.isArray(participantes) || participantes.length === 0) {
    return res.status(400).json({ error: 'Campos obrigatórios: formacao_id, participantes.' });
  }

  const supabase = getSupabase();

  const { data: formacao, error: fetchError } = await supabase
    .from('formacoes_internas')
    .select('id, categoria, data_fim')
    .eq('id', formacao_id)
    .single();

  if (fetchError || !formacao) {
    return res.status(404).json({ error: 'Ação não encontrada.' });
  }

  const exigeValidade = CATEGORIAS_EXIGEM_VALIDADE.includes(formacao.categoria);
  const validadeDefaultMeses = VALIDADE_PADRAO_MESES[formacao.categoria];

  const linhas = participantes.map(p => {
    const workerId = typeof p === 'string' ? p : p.worker_id;
    let dataValidade = typeof p === 'string' ? null : (p.data_validade || null);
    if (exigeValidade && !dataValidade && validadeDefaultMeses) {
      dataValidade = addMeses(formacao.data_fim, validadeDefaultMeses);
    }
    return { formacao_id, worker_id: workerId, data_validade: dataValidade };
  });

  if (exigeValidade && linhas.some(l => !l.data_validade)) {
    return res.status(400).json({ error: 'Esta categoria exige data de validade para todos os novos participantes.' });
  }

  const { error } = await supabase.from('formacao_participantes').insert(linhas);
  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Um ou mais trabalhadores selecionados já são participantes desta ação.' });
    }
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ ok: true, adicionados: linhas.length });
}

async function handleSign(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sessao = requireAuth(req, res, ['admin', 'worker']);
  if (!sessao) return;

  const { participante_id, assinatura_base64 } = req.body || {};
  if (!participante_id || !assinatura_base64?.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Campos obrigatórios: participante_id, assinatura_base64 (data:image/...).' });
  }

  const supabase = getSupabase();

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

async function handleMinhas(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const sessao = requireAuth(req, res, ['admin', 'worker']);
  if (!sessao) return;

  // Autosserviço: mostra sempre as formações do próprio utilizador
  // autenticado — nunca as de terceiros, independentemente de query params.
  const workerId = sessao.id;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('formacao_participantes')
    .select(`
      id, formacao_id, assinatura_url, assinado_em, data_validade,
      iniciado_em, concluido_em, nota_obtida, estado_conclusao,
      formacoes_internas(
        categoria, tipo_formacao, titulo, data_inicio, data_fim, duracao_horas,
        local, entidade_externa, formato, conteudo_url, conteudo_estruturado, questionario, nota_minima_aprovacao,
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
    conteudo_estruturado: p.formacoes_internas?.conteudo_estruturado || null,
    nota_minima_aprovacao: p.formacoes_internas?.nota_minima_aprovacao ?? null,
    questionario: Array.isArray(p.formacoes_internas?.questionario)
      ? p.formacoes_internas.questionario.map(q => ({ pergunta: q.pergunta, opcoes: q.opcoes, imagem_url: q.imagem_url || null }))
      : null,
    iniciado_em: p.iniciado_em,
    concluido_em: p.concluido_em,
    nota_obtida: p.nota_obtida,
    estado_conclusao: p.estado_conclusao,
  })).sort((a, b) => new Date(b.data_inicio) - new Date(a.data_inicio));

  return res.status(200).json({ participacoes });
}

async function handleIniciar(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sessao = requireAuth(req, res, ['admin', 'worker']);
  if (!sessao) return;

  const { participante_id } = req.body || {};
  if (!participante_id) return res.status(400).json({ error: 'Campo obrigatório: participante_id.' });

  const supabase = getSupabase();

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

async function handleResponderQuestionario(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sessao = requireAuth(req, res, ['admin', 'worker']);
  if (!sessao) return;

  const { participante_id, respostas } = req.body || {};
  if (!participante_id || !Array.isArray(respostas)) {
    return res.status(400).json({ error: 'Campos obrigatórios: participante_id, respostas (array).' });
  }

  const supabase = getSupabase();

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
  // cliente antes deste ponto (ver handleMinhas acima).
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

function isPathInterno(url) {
  return !!url && !/^https?:\/\//i.test(url);
}

async function handleConteudo(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const sessao = requireAuth(req, res, ['admin', 'worker']);
  if (!sessao) return;

  const { participante_id } = req.query;
  if (!participante_id) return res.status(400).json({ error: 'Campo obrigatório: participante_id.' });

  const supabase = getSupabase();

  const { data: participante, error: fetchError } = await supabase
    .from('formacao_participantes')
    .select('id, worker_id, formacoes_internas(formato, conteudo_url)')
    .eq('id', participante_id)
    .single();

  if (fetchError || !participante) {
    return res.status(404).json({ error: 'Participante não encontrado.' });
  }

  const isAdmin = sessao.role === 'admin' || sessao.isAdmin;
  if (!isAdmin && String(participante.worker_id) !== String(sessao.id)) {
    return res.status(403).json({ error: 'Só podes aceder ao conteúdo das tuas próprias formações.' });
  }

  const conteudoUrl = participante.formacoes_internas?.conteudo_url;
  if (participante.formacoes_internas?.formato !== 'e-learning' || !conteudoUrl) {
    return res.status(400).json({ error: 'Esta formação não tem conteúdo e-learning.' });
  }

  // Links externos (YouTube/Vimeo/URL pública) não precisam de assinatura —
  // só paths internos do bucket privado formacao-interna passam por aqui.
  if (!isPathInterno(conteudoUrl)) {
    return res.status(200).json({ url: conteudoUrl });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from('formacao-interna')
    .createSignedUrl(conteudoUrl, 3600);

  if (signError || !signed?.signedUrl) {
    return res.status(500).json({ error: signError?.message || 'Não foi possível gerar o link de acesso ao conteúdo.' });
  }

  return res.status(200).json({ url: signed.signedUrl });
}

async function handleCertificacoes(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;

  const { worker_id } = req.query;
  const supabase = getSupabase();

  let query = supabase
    .from('worker_certificacoes_ativas')
    .select('*')
    .order('data_validade', { ascending: true });

  if (worker_id) query = query.eq('worker_id', worker_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ certificacoes: data || [] });
}

async function handleRequisitos(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('formacao_requisitos_profissao')
    .select('id, profissao_cnp, formacao_id, ativo, formacoes_internas(tipo_formacao, categoria, formato)')
    .order('profissao_cnp');

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ requisitos: data || [] });
}

async function handleRequisitosSet(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;

  const { profissao_cnp, formacao_id, ativo } = req.body || {};
  if (!profissao_cnp?.trim() || !formacao_id || typeof ativo !== 'boolean') {
    return res.status(400).json({ error: 'Campos obrigatórios: profissao_cnp, formacao_id, ativo.' });
  }

  const supabase = getSupabase();

  const { data: formacao, error: fetchError } = await supabase
    .from('formacoes_internas')
    .select('id, formato')
    .eq('id', formacao_id)
    .single();

  if (fetchError || !formacao) {
    return res.status(404).json({ error: 'Ação não encontrada.' });
  }
  // Atribuição automática só cobre e-learning — ver contexto no topo do
  // ficheiro de migração formacao_requisitos_profissao.
  if (formacao.formato !== 'e-learning') {
    return res.status(400).json({ error: 'Só ações e-learning podem ser marcadas como requisito automático.' });
  }

  const { error } = await supabase
    .from('formacao_requisitos_profissao')
    .upsert({ profissao_cnp: profissao_cnp.trim(), formacao_id, ativo }, { onConflict: 'profissao_cnp,formacao_id' });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

async function handleAutoAtribuir(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;

  const { worker_id, profissao_cnp } = req.body || {};
  if (!worker_id) {
    return res.status(400).json({ error: 'Campo obrigatório: worker_id.' });
  }

  const supabase = getSupabase();

  // Duas fontes de "obrigatório", combinadas: por profissão
  // (formacao_requisitos_profissao) + universal para todos os trabalhadores
  // novos, independente de profissão (onboarding_gate_itens, tipo='formacao').
  const buscas = [
    profissao_cnp?.trim()
      ? supabase
          .from('formacao_requisitos_profissao')
          .select('formacao_id, formacoes_internas(categoria, data_fim)')
          .eq('profissao_cnp', profissao_cnp.trim())
          .eq('ativo', true)
      : Promise.resolve({ data: [] }),
    supabase
      .from('onboarding_gate_itens')
      .select('slug')
      .eq('tipo', 'formacao')
      .eq('ativo', true),
  ];
  const [{ data: requisitosProfissao, error: fetchError }, { data: itensGate, error: gateError }] = await Promise.all(buscas);
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (gateError) return res.status(500).json({ error: gateError.message });

  let requisitosGate = [];
  if (itensGate?.length) {
    const { data: formacoesGate, error: formacoesError } = await supabase
      .from('formacoes_internas')
      .select('id, categoria, data_fim')
      .in('slug', itensGate.map(i => i.slug));
    if (formacoesError) return res.status(500).json({ error: formacoesError.message });
    requisitosGate = (formacoesGate || []).map(f => ({ formacao_id: f.id, formacoes_internas: f }));
  }

  // Une os dois conjuntos, sem duplicar formacao_id repetido nos dois.
  const vistos = new Set();
  const requisitos = [...(requisitosProfissao || []), ...requisitosGate].filter(r => {
    if (vistos.has(r.formacao_id)) return false;
    vistos.add(r.formacao_id);
    return true;
  });

  if (!requisitos.length) return res.status(200).json({ atribuidas: 0, ignoradas: 0 });

  let atribuidas = 0;
  let ignoradas = 0;
  for (const requisito of requisitos) {
    const formacao = requisito.formacoes_internas;
    const exigeValidade = CATEGORIAS_EXIGEM_VALIDADE.includes(formacao?.categoria);
    const validadeDefaultMeses = VALIDADE_PADRAO_MESES[formacao?.categoria];
    const dataValidade = exigeValidade && validadeDefaultMeses ? addMeses(formacao.data_fim, validadeDefaultMeses) : null;

    const { error } = await supabase
      .from('formacao_participantes')
      .insert({ formacao_id: requisito.formacao_id, worker_id, data_validade: dataValidade });

    if (error) {
      if (error.code === '23505') { ignoradas++; continue; }
      return res.status(500).json({ error: error.message });
    }
    atribuidas++;
  }

  return res.status(200).json({ atribuidas, ignoradas });
}

async function handleGateStatus(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const sessao = requireAuth(req, res, ['admin', 'worker']);
  if (!sessao) return;

  const supabase = getSupabase();
  const gate = await getGateStatus(supabase, sessao.id);
  return res.status(200).json(gate);
}

async function handleGateRequisitos(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('onboarding_gate_itens')
    .select('id, tipo, slug, label, ativo')
    .eq('tipo', 'formacao')
    .order('label');

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ itens: data || [] });
}

async function handleGateRequisitosSet(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;

  const { formacao_id, ativo } = req.body || {};
  if (!formacao_id || typeof ativo !== 'boolean') {
    return res.status(400).json({ error: 'Campos obrigatórios: formacao_id, ativo.' });
  }

  const supabase = getSupabase();

  const { data: formacao, error: fetchError } = await supabase
    .from('formacoes_internas')
    .select('id, slug, tipo_formacao, formato')
    .eq('id', formacao_id)
    .single();

  if (fetchError || !formacao) return res.status(404).json({ error: 'Ação não encontrada.' });
  if (formacao.formato !== 'e-learning') {
    return res.status(400).json({ error: 'Só ações e-learning podem ser marcadas como obrigatórias no gate.' });
  }

  // Gera o slug a partir do tipo_formacao na primeira vez que este curso é
  // marcado como obrigatório no gate — nunca escrito à mão pelo admin.
  let slug = formacao.slug;
  if (!slug) {
    slug = slugify(formacao.tipo_formacao);
    const { error: slugError } = await supabase.from('formacoes_internas').update({ slug }).eq('id', formacao_id);
    if (slugError) return res.status(500).json({ error: slugError.message });
  }

  const { error } = await supabase
    .from('onboarding_gate_itens')
    .upsert({ tipo: 'formacao', slug, label: formacao.tipo_formacao, ativo }, { onConflict: 'tipo,slug' });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true, slug });
}

async function handleHorasPorTrabalhador(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;

  const ano = req.query.ano || String(new Date().getFullYear());
  const supabase = getSupabase();

  // Categorias com exige_entidade_externa (certificação formal, GWO) seguem
  // lógica de validade própria — não entram no cômputo anual das 40h.
  const { data, error } = await supabase
    .from('formacao_participantes')
    .select('worker_id, workers(name), formacoes_internas!inner(duracao_horas, data_inicio, exige_entidade_externa)')
    .eq('formacoes_internas.exige_entidade_externa', false)
    .gte('formacoes_internas.data_inicio', `${ano}-01-01`)
    .lte('formacoes_internas.data_inicio', `${ano}-12-31`);

  if (error) return res.status(500).json({ error: error.message });

  const porTrabalhador = new Map();
  for (const row of data || []) {
    const atual = porTrabalhador.get(row.worker_id) || { worker_id: row.worker_id, nome: row.workers?.name || row.worker_id, horas: 0 };
    atual.horas += Number(row.formacoes_internas?.duracao_horas || 0);
    porTrabalhador.set(row.worker_id, atual);
  }

  const resultado = [...porTrabalhador.values()]
    .map(w => ({ ...w, meta: META_HORAS_ANO, cumprido: w.horas >= META_HORAS_ANO }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return res.status(200).json({ ano, meta: META_HORAS_ANO, trabalhadores: resultado });
}

// push-send não é de Formação Interna — vive aqui só para não estourar o
// limite de 12 funções serverless do plano Hobby (ver nota no topo do
// ficheiro). Envia push notifications reais para todas as subscrições de
// um `role` ('admin' | 'worker' | 'client'), chamado a partir de
// notifyEvent() no browser. Mesmo nível de confiança que qualquer outro
// insert feito com a chave anon (sem auth extra) — consistente com o resto
// da app de notificações.
async function handlePushSend(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) return res.status(500).json({ error: 'VAPID não configurado' });

  const { role, userId, userIds, title, body, url, image, tag, type, dedupeKey } = req.body || {};
  if (!role || !title) return res.status(400).json({ error: 'Campos obrigatórios: role, title.' });

  const supabase = getSupabase();

  // dedupeKey é opcional, para chamadores repetitivos (crons) que não devem
  // reenviar o mesmo aviso enquanto a condição de origem se mantiver — reaproveita
  // notificacoes_proativas_log, já usada com o mesmo padrão pelos crons do
  // agente WhatsApp (conselheiro-estrategico), na mesma base de dados.
  if (dedupeKey) {
    const { data: existing } = await supabase
      .from('notificacoes_proativas_log')
      .select('id')
      .eq('chave', dedupeKey)
      .maybeSingle();
    if (existing) return res.status(200).json({ sent: 0, failed: 0, reason: 'já enviado (dedup)' });
  }

  webpush.setVapidDetails('mailto:geral@magneticplace.pt', vapidPublic, vapidPrivate);

  let query = supabase.from('push_subscriptions').select('*').eq('role', role);
  if (userId) query = query.eq('user_id', String(userId));
  else if (userIds?.length) query = query.in('user_id', userIds.map(String));
  const { data: subs, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  if (!subs?.length) return res.status(200).json({ sent: 0, failed: 0, reason: 'sem subscrições' });

  const payload = JSON.stringify({ title, body: body || '', url: url || '/', image, tag, type });
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
    )
  );

  const deadIds = results
    .map((r, i) => ({ r, sub: subs[i] }))
    .filter(({ r }) => r.status === 'rejected' && [404, 410].includes(r.reason?.statusCode))
    .map(({ sub }) => sub.id);
  if (deadIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', deadIds);
  }

  if (dedupeKey) {
    await supabase.from('notificacoes_proativas_log').insert({
      chave: dedupeKey,
      tipo: 'push',
      canal: 'push',
      enviado_em: new Date().toISOString(),
      resolvido: true,
    });
  }

  return res.status(200).json({
    sent: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
  });
}

// lembrete-validacao não é de Formação Interna — vive aqui pela mesma razão
// que push-send acima (ver nota no topo do ficheiro: limite de 12 funções
// serverless do plano Hobby). Cron diário que avisa o cliente (banner +
// push — sem email: o email deste projeto usa o SDK de browser do EmailJS,
// não invocável a partir de uma function Node) quando o mês de referência
// (o último já fechado por completo) continua sem client_approvals passados
// DIAS_LEMBRETE dias do fim do mês. Nunca reenvia o mesmo aviso duas vezes
// (dedup em notificacoes_proativas_log, mesmo padrão do handlePushSend
// acima) e nunca avisa se houver uma correção do cliente ainda por rever
// pela Magnetic (status submitted/under_review) — nesse caso a bola está do
// nosso lado, não do cliente. Decisão de negócio (2026-08-25): isto é só um
// lembrete — nunca bloqueia nem substitui a faturação, e nunca há aprovação
// silenciosa: o mês fica pendente até o cliente assinar.
const DIAS_LEMBRETE = 7;
const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function mesReferenciaParaLembrete(hoje = new Date()) {
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth(); // mês corrente, 0-indexed
  const anoRef = mes === 0 ? ano - 1 : ano;
  const mesRefIdx = mes === 0 ? 11 : mes - 1;
  const inicioMesCorrente = new Date(Date.UTC(ano, mes, 1));
  const diasDesdeFim = Math.floor((hoje.getTime() - inicioMesCorrente.getTime()) / 86400000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return {
    mesStr: `${anoRef}-${String(mesRefIdx + 1).padStart(2, '0')}`,
    inicio: fmt(new Date(Date.UTC(anoRef, mesRefIdx, 1))),
    fimExclusive: fmt(inicioMesCorrente),
    label: `${NOMES_MES[mesRefIdx]} de ${anoRef}`,
    diasDesdeFim,
  };
}

async function handleLembreteValidacao(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  const { mesStr, inicio, fimExclusive, label, diasDesdeFim } = mesReferenciaParaLembrete();
  if (diasDesdeFim < DIAS_LEMBRETE) {
    return res.status(200).json({ ok: true, skip: 'ainda dentro da janela de tolerância', mes: mesStr, diasDesdeFim });
  }

  const supabase = getSupabase();

  const [{ data: logsDoMes }, { data: aprovacoes }, { data: correcoesPendentes }, { data: jaNotificados }, { data: dispensados }] = await Promise.all([
    supabase.from('logs').select('clientId, startTime, endTime, breakStart, breakEnd').gte('date', inicio).lt('date', fimExclusive),
    supabase.from('client_approvals').select('client_id').eq('month', mesStr),
    supabase.from('corrections').select('client_id').eq('month', mesStr).in('status', ['submitted', 'under_review']),
    supabase.from('notificacoes_proativas_log').select('chave').eq('tipo', 'lembrete_validacao_mensal').like('chave', `%_${mesStr}`),
    supabase.from('client_month_waivers').select('client_id').eq('month', mesStr),
  ]);

  const clientesComHoras = new Set(
    (logsDoMes || [])
      .filter((l) => calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd) > 0)
      .map((l) => String(l.clientId))
  );
  const clientesValidados = new Set((aprovacoes || []).map((a) => String(a.client_id)));
  const clientesComBolaConosco = new Set((correcoesPendentes || []).map((c) => String(c.client_id)));
  const chavesJaEnviadas = new Set((jaNotificados || []).map((n) => n.chave));
  // Dispensado pelo admin (client_month_waivers) — não é aprovação/assinatura do
  // cliente, só evita o lembrete automático para este mês. Ver ValidacaoMensalPanel.jsx.
  const clientesDispensados = new Set((dispensados || []).map((d) => String(d.client_id)));

  const clientesAlvo = [...clientesComHoras].filter((id) =>
    !clientesValidados.has(id) &&
    !clientesComBolaConosco.has(id) &&
    !clientesDispensados.has(id) &&
    !chavesJaEnviadas.has(`lembrete_validacao_${id}_${mesStr}`)
  );

  if (!clientesAlvo.length) {
    return res.status(200).json({ ok: true, mes: mesStr, clientesNotificados: 0 });
  }

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const pushDisponivel = !!(vapidPublic && vapidPrivate);
  if (pushDisponivel) webpush.setVapidDetails('mailto:geral@magneticplace.pt', vapidPublic, vapidPrivate);

  const titulo = `Relatório de ${label} por validar`;
  const mensagem = `O relatório de horas de ${label} ainda não foi validado. Acede ao portal para conferir e assinar.`;

  for (const clienteId of clientesAlvo) {
    await supabase.from('app_notifications').insert({
      id: `notif_lembrete_${clienteId}_${mesStr}`,
      title: titulo,
      message: mensagem,
      type: 'warning',
      target_type: 'client',
      target_client_id: clienteId,
      payload: { kind: 'reminder_validacao', month: mesStr },
      is_dismissible: true,
      is_active: true,
      read_by_ids: [],
      dismissed_by_ids: [],
      viewed_by_ids: [],
      read_by_admin_ids: [],
      created_at: new Date().toISOString(),
    });

    if (pushDisponivel) {
      const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('role', 'client').eq('user_id', clienteId);
      if (subs?.length) {
        const payload = JSON.stringify({ title: titulo, body: mensagem, url: `/?view=client_portal&client=${clienteId}&month=${mesStr}` });
        await Promise.allSettled(subs.map((s) =>
          webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        ));
      }
    }

    await supabase.from('notificacoes_proativas_log').insert({
      chave: `lembrete_validacao_${clienteId}_${mesStr}`,
      tipo: 'lembrete_validacao_mensal',
      canal: 'banner+push',
      enviado_em: new Date().toISOString(),
      resolvido: true,
    });
  }

  return res.status(200).json({ ok: true, mes: mesStr, clientesNotificados: clientesAlvo.length });
}

const ACTIONS = {
  'list': handleList,
  'create': handleCreate,
  'atribuir': handleAtribuir,
  'sign': handleSign,
  'minhas': handleMinhas,
  'iniciar': handleIniciar,
  'responder-questionario': handleResponderQuestionario,
  'conteudo': handleConteudo,
  'certificacoes': handleCertificacoes,
  'requisitos': handleRequisitos,
  'requisitos-set': handleRequisitosSet,
  'auto-atribuir': handleAutoAtribuir,
  'gate-status': handleGateStatus,
  'gate-requisitos': handleGateRequisitos,
  'gate-requisitos-set': handleGateRequisitosSet,
  'horas-por-trabalhador': handleHorasPorTrabalhador,
  'push-send': handlePushSend,
  'lembrete-validacao': handleLembreteValidacao,
};

export default async function handler(req, res) {
  const fn = ACTIONS[req.query.action];
  if (!fn) return res.status(404).json({ error: 'Ação inválida.' });
  return fn(req, res);
}
