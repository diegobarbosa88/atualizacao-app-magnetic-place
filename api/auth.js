import { createClient } from '@supabase/supabase-js';
import { assinarSessao, requireAuth } from './_authUtils.js';
import { getGateStatus } from './_gateUtils.js';

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

// Fase 1 — validação de credenciais no servidor para os 3 papéis (admin,
// trabalhador, cliente), substituindo a comparação feita no browser contra
// workers/clients completos já carregados (Fase 0 já tinha atrasado esses
// fetches para depois da sessão existir — este endpoint é o que cria essa
// sessão, sem nunca enviar a tabela toda ao cliente). Dispatch por body.role.
// Hashing da password de admin, Supabase Auth real e CR-06 ficam fora de
// âmbito desta fase, tal como combinado.

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function loginKeyFromName(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  const first = parts[0].toLowerCase();
  const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  return first + last;
}

function normDoc(v) {
  return String(v || '').replace(/[\s.\-]/g, '').trim();
}

async function registarAlertaDuplicados(supabase, { username, nif, ids }) {
  try {
    const titulo = `Login de trabalhador ambíguo — múltiplos registos para "${username}"`;
    // Evita repetir o mesmo alerta a cada tentativa de login (pendente/visto == ainda por resolver)
    const { data: existente } = await supabase
      .from('gestao_alertas')
      .select('id')
      .eq('titulo', titulo)
      .in('status', ['pendente', 'visto'])
      .maybeSingle();
    if (existente) return;

    await supabase.from('gestao_alertas').insert({
      tipo: 'qualidade_dados',
      severidade: 'media',
      titulo,
      descricao: `Uma tentativa de login de trabalhador com username "${username}" e NIF fornecido encontrou ${ids.length} registos em workers com o mesmo nome+apelido E o mesmo NIF (ids: ${ids.join(', ')}). O login foi bloqueado (nenhum dos registos foi escolhido arbitrariamente) até um administrador resolver a duplicação. Detetado em api/auth.js (Fase 1 — validação de credenciais no servidor).`,
      status: 'pendente',
      acao_sugerida: 'Rever os registos de trabalhador com estes IDs em Equipa → Trabalhadores e fundir ou desativar o(s) duplicado(s), mantendo só um registo ativo com este nome+NIF.',
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[auth] falha ao registar alerta de duplicados:', e.message);
  }
}

function mapWorkerRow(d) {
  return {
    ...d,
    nis: d.nis !== undefined ? d.nis : '',
    nif: d.nif !== undefined ? d.nif : '',
    status: d.is_active === false ? 'inativo' : 'ativo',
    tabela_irs: d.tabela_irs || 'tabelaI',
    n_dependentes: d.n_dependentes ?? 0,
    tipo_contrato: d.tipo_contrato || 'sem_termo',
    regime: d.regime || 'tempo_inteiro',
    horas_semanais: d.horas_semanais ?? 40,
    modo_trabalho: d.modo_trabalho || 'presencial',
    data_nascimento: d.data_nascimento || null,
    enquadramento: d.enquadramento || 'REGE',
    local_trabalho: d.local_trabalho || null,
    profissao_cnp: d.profissao_cnp || null,
    ss_admissao_comunicada_em: d.ss_admissao_comunicada_em || null,
    ss_admissao_num_registo: d.ss_admissao_num_registo || null,
    ss_cessacao_comunicada_em: d.ss_cessacao_comunicada_em || null,
    ss_cessacao_num_registo: d.ss_cessacao_num_registo || null,
  };
}

async function handleAdmin(supabase, req, res) {
  const { password } = req.body || {};
  if (!password) return res.status(401).json({ error: 'Senha incorreta.' });

  const { data, error } = await supabase
    .from('system_settings')
    .select('admin_password')
    .eq('id', 1)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Erro ao validar credenciais.' });

  if (!data?.admin_password || password.trim() !== data.admin_password) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }

  const token = assinarSessao({ role: 'admin', id: 'admin_system', exp: Date.now() + SETE_DIAS_MS });
  return res.status(200).json({ user: { id: 'admin_system', name: 'Admin', role: 'admin' }, token });
}

async function handleWorker(supabase, req, res) {
  const { username, nif } = req.body || {};
  if (!username || !nif) return res.status(401).json({ error: 'Credenciais inválidas.' });

  const usernameNorm = String(username).toLowerCase().trim();
  const nifNorm = String(nif).trim();

  // Projeção mínima só para o matching — o registo completo só é lido depois
  // de já sabermos que existe exatamente 1 correspondência válida.
  const { data: candidatos, error } = await supabase
    .from('workers')
    .select('id, name, nif');
  if (error) return res.status(500).json({ error: 'Erro ao validar credenciais.' });

  const matches = (candidatos || []).filter(w =>
    loginKeyFromName(w.name) === usernameNorm && String(w.nif || '').trim() === nifNorm
  );

  if (matches.length === 0) return res.status(401).json({ error: 'Credenciais inválidas.' });

  if (matches.length > 1) {
    await registarAlertaDuplicados(supabase, { username: usernameNorm, nif: nifNorm, ids: matches.map(m => m.id) });
    return res.status(409).json({
      error: 'Existem múltiplos registos correspondentes a estas credenciais. Contacta o administrador.',
    });
  }

  const { data: full, error: fullErr } = await supabase
    .from('workers')
    .select('*')
    .eq('id', matches[0].id)
    .single();
  if (fullErr || !full) return res.status(500).json({ error: 'Erro ao validar credenciais.' });

  if (full.is_active === false) {
    return res.status(403).json({ error: 'A sua conta está inativa. Contacte a administração.' });
  }

  // isAdmin fica no token para cobrir o trabalhador com privilégio de admin
  // (escolhe "Painel Admin" ou entrar como trabalhador — ver LoginView.jsx —
  // mas a permissão real já vem confirmada aqui, do registo da BD).
  const token = assinarSessao({ role: 'worker', id: full.id, isAdmin: !!full.isAdmin, exp: Date.now() + SETE_DIAS_MS });
  const gate = await getGateStatus(supabase, full.id);
  return res.status(200).json({ user: { ...mapWorkerRow(full), gate }, token });
}

// "Ver Portal" no admin — abre o dashboard de um trabalhador específico para
// consulta. Emite um token de sessão próprio desse trabalhador (nunca reutiliza
// o token do admin), caso contrário todas as chamadas autenticadas por token
// (ex: /api/formacao/minhas) continuavam a resolver para a conta do admin — o
// que fazia qualquer trabalhador visto pelo "Ver Portal" mostrar sempre os
// mesmos dados (os do admin), em vez dos do trabalhador selecionado.
async function handleImpersonate(supabase, req, res) {
  const sessao = requireAuth(req, res, ['admin']);
  if (!sessao) return;

  const { worker_id } = req.body || {};
  if (!worker_id) return res.status(400).json({ error: 'Campo obrigatório: worker_id.' });

  const { data: full, error: fullErr } = await supabase
    .from('workers')
    .select('*')
    .eq('id', worker_id)
    .single();
  if (fullErr || !full) return res.status(404).json({ error: 'Trabalhador não encontrado.' });

  const token = assinarSessao({ role: 'worker', id: full.id, isAdmin: !!full.isAdmin, exp: Date.now() + SETE_DIAS_MS });
  const gate = await getGateStatus(supabase, full.id);
  return res.status(200).json({ user: { ...mapWorkerRow(full), gate }, token });
}

async function handleClient(supabase, req, res) {
  const { nif, email } = req.body || {};
  const nifNorm = normDoc(nif);
  if (!nifNorm) return res.status(401).json({ error: 'NIF ou email incorretos.' });
  const emailNorm = String(email || '').toLowerCase().trim();

  const { data: candidatos, error } = await supabase
    .from('clients')
    .select('id, name, nif, email');
  if (error) return res.status(500).json({ error: 'Erro ao validar credenciais.' });

  const matches = (candidatos || []).filter(c => {
    const nifMatch = normDoc(c.nif) === nifNorm;
    const emailMatch = !emailNorm || (c.email || '').toLowerCase().trim() === emailNorm;
    return nifMatch && emailMatch;
  });

  if (matches.length === 0) return res.status(401).json({ error: 'NIF ou email incorretos.' });

  if (matches.length > 1) {
    return res.status(409).json({
      error: 'Existem múltiplos registos correspondentes a estas credenciais. Contacta o administrador.',
    });
  }

  const client = matches[0];
  const expiry = Date.now() + TRINTA_DIAS_MS;
  const token = assinarSessao({ role: 'client', id: client.id, exp: expiry });
  return res.status(200).json({
    session: { clientId: client.id, name: client.name, expiry },
    token,
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Configuração do servidor em falta' });
    }

    const { role } = req.body || {};
    const supabase = supabaseAdmin();

    switch (role) {
      case 'admin':       return await handleAdmin(supabase, req, res);
      case 'worker':      return await handleWorker(supabase, req, res);
      case 'client':      return await handleClient(supabase, req, res);
      case 'impersonate': return await handleImpersonate(supabase, req, res);
      default:            return res.status(400).json({ error: `role desconhecido: ${role || '(não definido)'}` });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}
