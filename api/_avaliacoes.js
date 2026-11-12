// Avaliação técnica de candidatos (Caldeireiro Industrial) — endpoints.
//
// Vive dentro da função api/formacao/index.js (dispatch por `action`), como o
// ponto QR: o plano Hobby da Vercel limita a 12 funções e já estão todas usadas.
// O prefixo `_` impede este ficheiro de virar uma função própria.
//
// A tabela `avaliacoes_tecnicas` tem RLS ativa e nenhuma policy — só a service
// role (aqui) lhe toca. Três endpoints são públicos e só aceitam o token do link;
// os restantes exigem sessão de admin.
//
// A prova é corrigida aqui (gradeSubmission), com a variante e o nível gravados
// no convite — o navegador do candidato só envia as respostas em bruto.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './_authUtils.js';
import { gradeSubmission, LEVEL_IDS } from '../src/features/avaliacao-tecnica/lib/grading.js';
import { SEED_BITS, seedToCode } from '../src/features/avaliacao-tecnica/data/plan.js';
import { CLASSIFICATION_LABELS, EXPERIENCIA_OPCOES, LEVEL_LABELS } from '../src/features/avaliacao-tecnica/config.js';

const VALIDADE_PADRAO_DIAS = 7;
const MAX_BODY_CHARS = 200_000;

// Colunas da listagem do admin — sem `resultado` (pesado) e sem `seed`.
const COLUNAS_LISTA = [
  'id', 'token', 'nivel', 'plan_variant', 'status', 'vaga', 'created_at', 'expires_at', 'reaberturas',
  'candidato_nome', 'candidato_telefone', 'candidato_email', 'candidato_experiencia', 'candidato_localidade',
  'started_at', 'completed_at', 'overall_score', 'score_localizacao', 'score_calculo', 'score_simbologia',
  'score_agilidade', 'classification', 'abandonada',
].join(', ');

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const texto = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const agora = () => new Date().toISOString();
const emDias = (dias) => new Date(Date.now() + dias * 86400000).toISOString();
const novaSeed = () => crypto.randomInt(0, 2 ** SEED_BITS);
const idInterno = (row) => `AV-${row.id.slice(0, 6).toUpperCase()}`;

/** Estado visto de fora: 'pending' expirado passa a 'expired' */
function estadoDe(row) {
  if (row.status === 'pending' && new Date(row.expires_at) < new Date()) return 'expired';
  return row.status;
}

function lerId(req, res) {
  const id = texto(req.body?.id ?? req.query.id, 64);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(400).json({ error: 'id inválido.' });
    return null;
  }
  return id;
}

function lerToken(req, res) {
  const token = texto(req.body?.token ?? req.query.token, 64);
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    res.status(404).json({ estado: 'invalid', error: 'Link inválido.' });
    return null;
  }
  return token;
}

// ── Admin ──────────────────────────────────────────────────────────────────

async function handleListar(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;
  const { data, error } = await getSupabase()
    .from('avaliacoes_tecnicas')
    .select(COLUNAS_LISTA)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data: data.map((row) => ({ ...row, estado: estadoDe(row) })) });
}

async function handleObter(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;
  const id = lerId(req, res);
  if (!id) return;
  const { data, error } = await getSupabase()
    .from('avaliacoes_tecnicas')
    .select(`${COLUNAS_LISTA}, resultado`)
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Avaliação não encontrada.' });
  return res.status(200).json({ data: { ...data, estado: estadoDe(data) } });
}

async function handleCriar(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sessao = requireAuth(req, res, ['admin']);
  if (!sessao) return;
  const body = req.body || {};
  if (!LEVEL_IDS.includes(body.nivel)) return res.status(400).json({ error: 'Escolhe o nível da prova.' });
  const dias = Math.min(30, Math.max(1, Math.round(Number(body.validade_dias)) || VALIDADE_PADRAO_DIAS));
  const seed = novaSeed();

  const { data, error } = await getSupabase()
    .from('avaliacoes_tecnicas')
    .insert({
      token: crypto.randomBytes(24).toString('base64url'),
      nivel: body.nivel,
      seed,
      plan_variant: seedToCode(seed),
      vaga: texto(body.vaga, 120) || null,
      candidato_nome: texto(body.candidato_nome, 120) || null,
      candidato_telefone: texto(body.candidato_telefone, 40) || null,
      created_by: sessao.id != null ? String(sessao.id) : null,
      expires_at: emDias(dias),
    })
    .select(COLUNAS_LISTA)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data: { ...data, estado: estadoDe(data) } });
}

// Reabre um link interrompido (candidato recarregou/fechou a página a meio) ou
// expirado. Uma prova interrompida recebe uma variante nova: o candidato já viu
// o plano anterior.
async function handleReabrir(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;
  const id = lerId(req, res);
  if (!id) return;
  const supabase = getSupabase();
  const { data: row, error: e1 } = await supabase.from('avaliacoes_tecnicas').select('id, status, reaberturas').eq('id', id).maybeSingle();
  if (e1) return res.status(500).json({ error: e1.message });
  if (!row) return res.status(404).json({ error: 'Avaliação não encontrada.' });
  if (!['pending', 'in_progress'].includes(row.status)) {
    return res.status(409).json({ error: 'Só se reabrem avaliações por iniciar, expiradas ou interrompidas.' });
  }

  const patch = { status: 'pending', expires_at: emDias(VALIDADE_PADRAO_DIAS), reaberturas: (row.reaberturas || 0) + 1 };
  if (row.status === 'in_progress') {
    const seed = novaSeed();
    Object.assign(patch, { seed, plan_variant: seedToCode(seed), started_at: null });
  }
  const { data, error } = await supabase
    .from('avaliacoes_tecnicas')
    .update(patch)
    .eq('id', id)
    .eq('status', row.status)
    .select(COLUNAS_LISTA)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(409).json({ error: 'O estado mudou entretanto — atualiza a lista.' });
  return res.status(200).json({ data: { ...data, estado: estadoDe(data) } });
}

async function handleCancelar(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;
  const id = lerId(req, res);
  if (!id) return;
  const { data, error } = await getSupabase()
    .from('avaliacoes_tecnicas')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .in('status', ['pending', 'in_progress'])
    .select(COLUNAS_LISTA)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(409).json({ error: 'Esta avaliação já não pode ser cancelada.' });
  return res.status(200).json({ data: { ...data, estado: estadoDe(data) } });
}

// Apaga o convite e o resultado (pedido de eliminação de dados do candidato, RGPD).
async function handleApagar(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;
  const id = lerId(req, res);
  if (!id) return;
  const { error } = await getSupabase().from('avaliacoes_tecnicas').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

// ── Públicos (só com o token do link) ─────────────────────────────────────

async function handlePublica(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const token = lerToken(req, res);
  if (!token) return;
  const { data: row, error } = await getSupabase()
    .from('avaliacoes_tecnicas')
    .select('nivel, status, expires_at, candidato_nome, candidato_telefone')
    .eq('token', token)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Erro ao carregar a avaliação.' });
  if (!row) return res.status(404).json({ estado: 'invalid', error: 'Link inválido.' });
  const estado = estadoDe(row);
  return res.status(200).json({
    estado,
    nivel: row.nivel,
    // pré-preenchimento só enquanto a prova não começou
    candidato: estado === 'pending' ? { nome: row.candidato_nome || '', telefone: row.candidato_telefone || '' } : null,
  });
}

function validarCandidato(c) {
  const dados = {
    nome: texto(c?.nome, 120),
    telefone: texto(c?.telefone, 40),
    email: texto(c?.email, 160),
    experiencia: texto(c?.experiencia, 40),
    localidade: texto(c?.localidade, 80),
  };
  if (dados.nome.split(' ').filter(Boolean).length < 2) return { erro: 'Informe nome e sobrenome.' };
  if (dados.telefone.replace(/\D/g, '').length < 9) return { erro: 'Telefone inválido.' };
  if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) return { erro: 'E-mail inválido.' };
  if (!EXPERIENCIA_OPCOES.includes(dados.experiencia)) return { erro: 'Selecione o tempo de experiência.' };
  if (c?.rgpd !== true) return { erro: 'É preciso autorizar o tratamento dos dados.' };
  return { dados };
}

const MENSAGEM_ESTADO = {
  in_progress: 'Esta prova já foi iniciada. Se foi interrompida, peça ao recrutador para reabrir o link.',
  completed: 'Esta prova já foi concluída.',
  cancelled: 'Este link foi cancelado.',
  expired: 'Este link expirou. Peça um novo link ao recrutador.',
};

async function handleIniciar(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = lerToken(req, res);
  if (!token) return;
  const { dados, erro } = validarCandidato(req.body?.candidato);
  if (erro) return res.status(400).json({ error: erro });

  const supabase = getSupabase();
  const inicio = agora();
  // Atualização condicional: só uma chamada passa de 'pending' a 'in_progress',
  // mesmo com dois cliques ou dois separadores abertos.
  const { data: row, error } = await supabase
    .from('avaliacoes_tecnicas')
    .update({
      status: 'in_progress',
      started_at: inicio,
      candidato_nome: dados.nome,
      candidato_telefone: dados.telefone,
      candidato_email: dados.email || null,
      candidato_experiencia: dados.experiencia,
      candidato_localidade: dados.localidade || null,
      rgpd_consentido_em: inicio,
      user_agent: texto(req.headers['user-agent'], 300) || null,
    })
    .eq('token', token)
    .eq('status', 'pending')
    .gt('expires_at', inicio)
    .select('id, seed, nivel')
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Erro ao iniciar a prova. Tente de novo.' });

  if (!row) {
    const { data: atual } = await supabase.from('avaliacoes_tecnicas').select('status, expires_at').eq('token', token).maybeSingle();
    if (!atual) return res.status(404).json({ estado: 'invalid', error: 'Link inválido.' });
    const estado = estadoDe(atual);
    return res.status(409).json({ estado, error: MENSAGEM_ESTADO[estado] || 'Não foi possível iniciar a prova.' });
  }
  return res.status(200).json({ seed: row.seed, nivel: row.nivel, internalId: idInterno(row) });
}

async function handleSubmeter(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = lerToken(req, res);
  if (!token) return;
  if (JSON.stringify(req.body || {}).length > MAX_BODY_CHARS) return res.status(413).json({ error: 'Respostas demasiado grandes.' });

  const supabase = getSupabase();
  const { data: row, error: e1 } = await supabase
    .from('avaliacoes_tecnicas')
    .select('id, status, seed, nivel, started_at, candidato_nome')
    .eq('token', token)
    .maybeSingle();
  if (e1) return res.status(500).json({ error: 'Erro ao gravar a prova. Tente de novo.' });
  if (!row) return res.status(404).json({ estado: 'invalid', error: 'Link inválido.' });
  // Reenvio depois de uma resposta perdida pela rede: já está gravado, não é erro.
  if (row.status === 'completed') return res.status(200).json({ ok: true, jaEnviada: true });
  if (row.status !== 'in_progress') {
    return res.status(409).json({ estado: estadoDe(row), error: MENSAGEM_ESTADO[estadoDe(row)] || 'Esta prova não está em curso.' });
  }

  const fim = agora();
  let relatorio;
  try {
    relatorio = gradeSubmission({
      seed: row.seed,
      level: row.nivel,
      candidate: { fullName: row.candidato_nome || '—', internalId: idInterno(row) },
      sessionId: texto(req.body?.sessionId, 64) || row.id,
      startedAt: row.started_at || fim,
      finishedAt: fim,
      respostas: req.body?.respostas,
    });
  } catch (e) {
    console.error('[avaliacoes] falha na correção', row.id, e);
    return res.status(400).json({ error: 'Respostas inválidas.' });
  }
  const { record, summary } = relatorio;

  const { data: gravada, error: e2 } = await supabase
    .from('avaliacoes_tecnicas')
    .update({
      status: 'completed',
      completed_at: fim,
      overall_score: summary.overall,
      score_localizacao: summary.pillars.localizacao,
      score_calculo: summary.pillars.calculo,
      score_simbologia: summary.pillars.simbologia,
      score_agilidade: summary.pillars.agilidade,
      classification: summary.classification,
      abandonada: record.integrity.abandoned,
      resultado: record,
    })
    .eq('id', row.id)
    .eq('status', 'in_progress')
    .select('id')
    .maybeSingle();
  if (e2) return res.status(500).json({ error: 'Erro ao gravar a prova. Tente de novo.' });
  if (!gravada) return res.status(200).json({ ok: true, jaEnviada: true });

  // Aviso no painel do admin — falhar aqui não invalida a prova já gravada.
  const { error: eNotif } = await supabase.from('app_notifications').insert({
    id: `notif_avaliacao_${row.id}`,
    title: 'Avaliação técnica concluída',
    message: `${row.candidato_nome || 'Candidato'} — ${LEVEL_LABELS[row.nivel]}: ${summary.overall}/100 (${CLASSIFICATION_LABELS[summary.classification]})${record.integrity.abandoned ? ' · prova encerrada antes do fim' : ''}. Ver em Equipa › Avaliações.`,
    type: summary.classification === 'apto' ? 'success' : 'info',
    target_type: 'admin',
    payload: { kind: 'avaliacao_tecnica', avaliacao_id: row.id },
    is_dismissible: true,
    is_active: true,
    read_by_ids: [],
    dismissed_by_ids: [],
    viewed_by_ids: [],
    read_by_admin_ids: [],
    created_at: fim,
  });
  if (eNotif) console.error('[avaliacoes] notificação não criada', row.id, eNotif.message);

  return res.status(200).json({ ok: true });
}

export const AVALIACAO_ACTIONS = {
  'avaliacao-listar': handleListar,
  'avaliacao-obter': handleObter,
  'avaliacao-criar': handleCriar,
  'avaliacao-reabrir': handleReabrir,
  'avaliacao-cancelar': handleCancelar,
  'avaliacao-apagar': handleApagar,
  'avaliacao-publica': handlePublica,
  'avaliacao-iniciar': handleIniciar,
  'avaliacao-submeter': handleSubmeter,
};
