import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_authUtils.js';

// Todos os endpoints de Formação Interna vivem numa única função serverless
// — o plano Hobby da Vercel limita a 12 funções por deployment; ter um
// ficheiro por endpoint (8+ aqui) estourava o limite. Dispatch por
// req.query.action, alimentado pelos rewrites /api/formacao/<action> ->
// /api/formacao?action=<action> em vercel.json (mesmo padrão já usado em
// api/toconline/proxy.js e api/reconciliacao/index.js). Nota: uma rota
// dinâmica [action].js foi tentada primeiro mas o `vercel dev` local não a
// reconhecia (nenhum sub-path respondia) — o padrão de rewrite é o que já
// está validado a funcionar no resto do projeto.

const CATEGORIAS_VALIDAS = ['soldadura', 'caldeiraria', 'certificacao_formal', 'hst', 'equipamentos', 'gwo', 'onboarding'];
const CATEGORIAS_ENTIDADE_EXTERNA = ['certificacao_formal', 'gwo'];
const CATEGORIAS_EXIGEM_VALIDADE = ['certificacao_formal', 'gwo'];
const VALIDADE_PADRAO_MESES = { gwo: 24 };
const META_HORAS_ANO = 40;
const DIAS_A_EXPIRAR = 60;

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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
  'horas-por-trabalhador': handleHorasPorTrabalhador,
};

export default async function handler(req, res) {
  const fn = ACTIONS[req.query.action];
  if (!fn) return res.status(404).json({ error: 'Ação inválida.' });
  return fn(req, res);
}
