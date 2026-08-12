import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { getMessageReplyContext, sendGmailReply, sendGmailNewMessage } from '../gmail/_sendGmailReply.js';
import {
  extrairLinhasFaturasEmFalta, cruzarFaturasEmFalta, extrairPedidoExtratosBancarios,
} from './_pedidosContador.js';
import { extractPdfText } from '../gmail/_parseComprovativo.js';
import { calcularRecibo, valorDiarioLegal, getIRSTabelasPorAno } from '../../src/lib/payroll/reciboCalculations.js';
import { calcMesParcial } from '../../src/lib/payroll/mesParcial.js';
import { calcularDiasUteisNoMes } from '../../src/lib/payroll/feriadosPortugal.js';
import { findBestCombo, SYNC_TOLERANCE } from '../../src/lib/payroll/mapaAutoFill.js';

// Router único para os 4 endpoints relacionados com o contabilista — consolidados
// num só ficheiro para não exceder o limite de Serverless Functions do plano
// Hobby da Vercel (12). Dispatch feito por ?tipo=, mapeado via rewrites em
// vercel.json para preservar os caminhos originais (/api/contador-resumo, etc.)
// sem alterar nada no frontend. Cada secção abaixo é o handler original,
// intocado na lógica.

const VALOR_TOLERANCIA = 0.01;

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function gmailClient() {
  const auth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth });
}

// ---------------------------------------------------------------------------
// tipo=acesso — gestão do token de acesso do contabilista (obter / regenerar)
// ---------------------------------------------------------------------------

async function passwordValida(supabase, adminPassword) {
  if (!adminPassword) return false;
  const { data } = await supabase.from('system_settings').select('admin_password').eq('id', 1).maybeSingle();
  const senhaAtual = data?.admin_password;
  return !!senhaAtual && adminPassword === senhaAtual;
}

async function handleAcesso(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Configuração do servidor em falta' });
  }

  const supabase = supabaseAdmin();
  const { action, admin_password } = req.body || {};

  if (!(await passwordValida(supabase, admin_password))) {
    return res.status(401).json({ error: 'Password de admin incorreta.' });
  }

  if (action === 'regenerar') {
    const { error: revokeError } = await supabase
      .from('contador_acesso')
      .update({ ativo: false, revoked_at: new Date().toISOString() })
      .eq('ativo', true);
    if (revokeError) return res.status(500).json({ error: `Erro ao revogar token atual: ${revokeError.message}` });

    const { data: novo, error: insertError } = await supabase
      .from('contador_acesso')
      .insert({ descricao: 'Acesso resumo mensal - contabilista' })
      .select('token, created_at')
      .single();
    if (insertError) return res.status(500).json({ error: `Erro ao criar novo token: ${insertError.message}` });

    return res.status(200).json({ token: novo.token, created_at: novo.created_at });
  }

  const { data: atual, error: fetchError } = await supabase
    .from('contador_acesso')
    .select('token, created_at')
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!atual) return res.status(404).json({ error: 'Nenhum token ativo — regenera um novo.' });

  return res.status(200).json({ token: atual.token, created_at: atual.created_at });
}

// ---------------------------------------------------------------------------
// tipo=resumo — única forma de obter/alterar dados do Resumo Mensal partilhado
// ---------------------------------------------------------------------------

function getRateAtDate(logDate, history, currentRate) {
  if (!history || history.length === 0) return Number(currentRate) || 0;
  const sorted = [...history].sort((a, b) => new Date(a.data_alteracao) - new Date(b.data_alteracao));
  const firstDate = sorted[0].data_alteracao.substring(0, 10);
  if (logDate < firstDate) return Number(sorted[0].valor_anterior) || 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (logDate >= sorted[i].data_alteracao.substring(0, 10)) return Number(sorted[i].valor_novo) || 0;
  }
  return Number(currentRate) || 0;
}

const funcaoDeCPP = (cpp) => cpp && String(cpp).startsWith('1') ? 'gerencia' : 'geral';
const funcaoMaxAjudasWorker = (name) =>
  (name || '').trim().toLowerCase() === 'diego rocha barbosa' ? 'gerencia' : 'geral';

function _calcReciboComMapa(w, subsAlimDias, brutoAlvo, anoNum, mesStr, vencBaseOverride, funcao = 'geral') {
  const vencBase         = vencBaseOverride ?? (parseFloat(w.vencimento_base) || 0);
  const subsAlimValorDia = parseFloat(w.subsidio_alimentacao_dia) || 0;
  const baseParams = {
    vencimentoBase: vencBase, horasSemana: 40, premios: 0,
    he1: 0, he2: 0, incluirFerias: true, incluirNatal: true,
    subsAlimValorDia, subsAlimDias, subsAlimTipo: w.subsidio_alimentacao_tipo || 'dinheiro',
    tabelaKey: w.tabela_irs || 'tabelaI',
    nDependentes: w.n_dependentes ?? 0,
    brutoAlvo: brutoAlvo || vencBase,
    territorio: 'internacional', funcao, ano: anoNum,
  };
  const rc0             = calcularRecibo(baseParams);
  const valorDiario     = valorDiarioLegal('internacional', funcao);
  const ajudaNecessaria = rc0.ajudaCustoNecessaria;
  if (ajudaNecessaria <= 0 || valorDiario <= 0) return { rc: rc0, mapaLiqLive: 0 };

  const totalDiasMes = new Date(anoNum, parseInt(mesStr.split('-')[1], 10), 0).getDate();

  function contarDiasUteis(di, nDias) {
    let count = 0;
    const d = new Date(di + 'T00:00:00');
    for (let i = 0; i < nDias; i++) {
      const dow = d.getDay();
      if (dow >= 1 && dow <= 5) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }

  function runForStartDay(di) {
    let subsAlimMapa = subsAlimValorDia > 0 ? rc0.subsAlimTotal : 0;
    let bestCombo = null;
    for (let iter = 0; iter < 6; iter++) {
      const valorNec = ajudaNecessaria + subsAlimMapa;
      if (valorNec <= 0) break;
      bestCombo = findBestCombo(valorNec, valorDiario, totalDiasMes);
      if (!bestCombo) break;
      const novoSubsAlim = subsAlimValorDia > 0 ? contarDiasUteis(di, bestCombo.N) * subsAlimValorDia : 0;
      if (Math.abs(novoSubsAlim - subsAlimMapa) < 0.005) break;
      subsAlimMapa = novoSubsAlim;
    }
    if (!bestCombo) return null;
    const totalAjudas   = Math.round(bestCombo.total * 100) / 100;
    const valorNecFinal = ajudaNecessaria + subsAlimMapa;
    const residuo       = Math.round((valorNecFinal - totalAjudas) * 100) / 100;
    return { bestCombo, subsAlimMapa, totalAjudas, residuo };
  }

  let bestResult = null;
  for (let day = 1; day <= 20; day++) {
    const di     = `${mesStr}-${String(day).padStart(2, '0')}`;
    const result = runForStartDay(di);
    if (!result) continue;
    if (!bestResult || Math.abs(result.residuo) < Math.abs(bestResult.residuo)) bestResult = result;
  }

  if (!bestResult) {
    const premios = ajudaNecessaria > SYNC_TOLERANCE ? Math.round(ajudaNecessaria * 100) / 100 : 0;
    if (premios > 0) return { rc: calcularRecibo({ ...baseParams, premios }), mapaLiqLive: 0 };
    return { rc: rc0, mapaLiqLive: 0 };
  }
  const { bestCombo, subsAlimMapa } = bestResult;
  const totalAjudas   = Math.round(bestCombo.total * 100) / 100;
  const valorNecFinal = ajudaNecessaria + subsAlimMapa;
  const residuo       = Math.round((valorNecFinal - totalAjudas) * 100) / 100;
  const premios       = residuo > SYNC_TOLERANCE ? Math.round(residuo * 100) / 100 : 0;
  const mapaLiqLive   = Math.round((totalAjudas - subsAlimMapa) * 100) / 100;
  const rc            = premios > 0 ? calcularRecibo({ ...baseParams, premios }) : rc0;
  return { rc, mapaLiqLive };
}

function computeRows({ workers, clients, rateHistory, logs, obs, completos, ajustes, anoNum, mesNum, feriadoMunicipal }) {
  const eur2   = v => (isNaN(v) ? 0 : v).toFixed(2);
  const pct2   = v => (v * 100).toFixed(2) + '%';
  const fmtData = d => d ? String(d).split('T')[0] : '';
  const mesStr = `${anoNum}-${String(mesNum).padStart(2, '0')}`;

  const ativos = workers
    .filter(w => w.vencimento_base != null)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const logsDoMes = logs.filter(l => l.date?.startsWith(mesStr));

  return ativos.map(w => {
    const workerLogs = logsDoMes.filter(l => l.workerId === w.id);
    if (workerLogs.length === 0) return null;
    const hist = rateHistory.filter(h => h.worker_id === w.id);

    const brutoAlvo = workerLogs.reduce((s, l) => {
      const rate = getRateAtDate(l.date, hist, parseFloat(w.valorHora) || 0);
      return s + (parseFloat(l.hours) || 0) * rate;
    }, 0);

    const subsAlimDias = calcularDiasUteisNoMes(anoNum, mesNum, {
      feriadoMunicipal,
      dataAdmissao: w.dataInicio || null,
      dataCessacao: w.dataFim    || null,
    });

    const wMesParcial = calcMesParcial(w.dataInicio || null, w.dataFim || null, anoNum, mesNum);
    const vencOrig    = parseFloat(w.vencimento_base) || 0;
    const vencCalculo = wMesParcial.tipo !== 'completo'
      ? parseFloat((vencOrig * wMesParcial.fator).toFixed(2))
      : undefined;

    const funcaoW = w.profissao_cnp ? funcaoDeCPP(w.profissao_cnp) : funcaoMaxAjudasWorker(w.name);
    const { rc, mapaLiqLive } = _calcReciboComMapa(w, subsAlimDias, brutoAlvo, anoNum, mesStr, vencCalculo, funcaoW);
    const mapaAjudasDiff = mapaLiqLive - rc.ajudaCustoNecessaria;

    const tabelaNome = (getIRSTabelasPorAno(anoNum)[w.tabela_irs || 'tabelaI'] || {}).nome || 'Tabela I';
    const empresa = [...new Set(workerLogs.map(l => l.clientId).filter(Boolean))]
      .map(id => clients.find(c => c.id === id)?.name || '').filter(Boolean).join(' / ');

    const ajusteVal = ajustes[w.id] || 0;

    return {
      workerId: w.id, nome: w.name || '', nif: w.nif || '', nis: w.nis || '',
      profissao: w.profissao || '', empresa: empresa || '—',
      inicioVinculo: fmtData(w.dataInicio), cessacaoVinculo: fmtData(w.dataFim),
      tabelaNome, nDep: String(w.n_dependentes ?? 0),
      vencBase:      eur2(vencOrig),
      subsAlimDias:  String(subsAlimDias),
      subsAlimDia:   eur2(parseFloat(w.subsidio_alimentacao_dia) || 0),
      subsAlimTotal: eur2(rc.subsAlimTotal),
      subsFerias:    eur2(rc.subsFerias),
      subsNatal:     eur2(rc.subsNatal),
      ajudas:        eur2(mapaLiqLive),
      baseIRS:       eur2(rc.incidenciaRegular),
      taxaIRS:       pct2(rc.taxaRegular),
      irsTotal:      eur2(rc.irsTotal),
      ssTrab:        eur2(rc.ssTrabalhador),
      totalAbonos:   eur2(rc.totalAbonos + mapaAjudasDiff),
      totalDesc:     eur2(rc.totalDescontos),
      liquido:       eur2(rc.liquido + mapaAjudasDiff),
      ssPatronal:    eur2(rc.ssPatronal),
      custoEmpresa:  eur2(rc.custoEmpresa + mapaAjudasDiff),
      ajuste:        ajusteVal,
      brutoAlvo:     eur2(brutoAlvo),
      observacao:    obs[w.id] || '',
      completo:      completos[w.id] || false,
      _ajusteNum:    ajusteVal,
      _vencNum:      parseFloat(w.vencimento_base) || 0,
      _subsAlimNum:  rc.subsAlimTotal,
      _feriasNum:    rc.subsFerias,
      _natalNum:     rc.subsNatal,
      _ajudasNum:    mapaLiqLive,
      _irsNum:       rc.irsTotal,
      _ssTrabNum:    rc.ssTrabalhador,
      _abonosNum:    rc.totalAbonos + mapaAjudasDiff,
      _descNum:      rc.totalDescontos,
      _liquidoNum:   rc.liquido + mapaAjudasDiff,
      _ssPatNum:     rc.ssPatronal,
      _custoNum:     rc.custoEmpresa + mapaAjudasDiff,
      _brutoNum:     brutoAlvo,
    };
  }).filter(Boolean);
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

async function validarToken(supabase, token) {
  if (!token) return null;
  const { data } = await supabase
    .from('contador_acesso')
    .select('id, token, ativo')
    .eq('token', token)
    .eq('ativo', true)
    .maybeSingle();
  return data || null;
}

async function handleResumo(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Configuração do servidor em falta' });
  }

  const { token, action, mes } = req.body || {};
  if (!token) return res.status(401).json({ error: 'Acesso inválido — token em falta.' });

  const supabase = supabaseAdmin();
  const acesso = await validarToken(supabase, token);
  if (!acesso) {
    return res.status(403).json({ error: 'Acesso inválido ou revogado. Contacte a Magnetic Place para obter um novo link.' });
  }

  if (action === 'upsert_obs') {
    const { worker_id, observacao, completo, ajuste_bruto } = req.body || {};
    if (!worker_id || !mes) return res.status(400).json({ error: 'worker_id e mes são obrigatórios' });
    const { error } = await supabase.from('resumo_observacoes').upsert(
      {
        worker_id, mes,
        observacao: observacao ?? '',
        completo: !!completo,
        ajuste_bruto: ajuste_bruto ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'worker_id,mes' }
    );
    if (error) return res.status(500).json({ error: `Erro ao guardar: ${error.message}` });
    return res.status(200).json({ sucesso: true });
  }

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: 'mes é obrigatório no formato YYYY-MM' });
  }
  const [anoNum, mesNum] = mes.split('-').map(Number);
  const dataInicio = `${mes}-01`;
  const nextMes = mesNum === 12 ? `${anoNum + 1}-01-01` : `${anoNum}-${String(mesNum + 1).padStart(2, '0')}-01`;

  const [
    { data: workers },
    { data: clients },
    { data: rateHistory },
    { data: logs },
    { data: obsRows },
    { data: settingsRow },
    { data: colsRow },
  ] = await Promise.all([
    supabase.from('workers').select('*').limit(1000),
    supabase.from('clients').select('*').limit(1000),
    supabase.from('worker_valorhora_history').select('*').limit(5000),
    supabase.from('logs').select('*').gte('date', dataInicio).lt('date', nextMes).limit(5000),
    supabase.from('resumo_observacoes').select('worker_id, observacao, completo, ajuste_bruto').eq('mes', mes),
    supabase.from('system_settings').select('feriado_municipal').eq('id', 1).maybeSingle(),
    supabase.from('resumo_config').select('valor').eq('chave', 'visible_cols').maybeSingle(),
  ]);

  const obs = {}, completos = {}, ajustes = {};
  (obsRows || []).forEach(r => {
    obs[r.worker_id] = r.observacao;
    completos[r.worker_id] = !!r.completo;
    if (r.ajuste_bruto) ajustes[r.worker_id] = parseFloat(r.ajuste_bruto) || 0;
  });

  const rows = computeRows({
    workers: workers || [], clients: clients || [], rateHistory: rateHistory || [],
    logs: logs || [], obs, completos, ajustes, anoNum, mesNum,
    feriadoMunicipal: settingsRow?.feriado_municipal || null,
  });

  let visibleCols = null;
  const rawCols = colsRow?.valor;
  if (Array.isArray(rawCols)) visibleCols = rawCols;
  else if (typeof rawCols === 'string') { try { visibleCols = JSON.parse(rawCols); } catch { /* mantém null */ } }

  await supabase.from('contador_portal_audit_logs').insert({
    token,
    mes_acedido: dataInicio,
    ip_address: getClientIp(req),
    user_agent: req.headers['user-agent'] || null,
  });

  return res.status(200).json({ rows, visibleCols, feriadoMunicipal: settingsRow?.feriado_municipal || null });
}

// ---------------------------------------------------------------------------
// tipo=gerar — gera rascunho de resposta ao email do contador (Claude)
// ---------------------------------------------------------------------------

export async function cruzarComRegistos(supabase, contadorNif, dadosExtraidos) {
  const numeroFatura = dadosExtraidos?.numero_fatura || null;
  const valor = dadosExtraidos?.valor != null ? Number(dadosExtraidos.valor) : null;

  const { data: faturasMatch } = await supabase
    .from('faturas')
    .select('id, dados')
    .eq('dados->>nif_fornecedor', contadorNif);

  let matchedFatura = null;
  if (faturasMatch?.length) {
    if (numeroFatura) {
      matchedFatura = faturasMatch.find(f => f.dados?.numero_fatura && String(f.dados.numero_fatura).trim() === String(numeroFatura).trim());
    }
    if (!matchedFatura && valor != null) {
      matchedFatura = faturasMatch.find(f => f.dados?.valor_total != null && Math.abs(Number(f.dados.valor_total) - valor) < VALOR_TOLERANCIA);
    }
  }

  const { data: pagamentosMatch } = await supabase
    .from('pagamentos_fornecedores')
    .select('id, valor, referencia, status')
    .eq('fornecedor_nif', contadorNif)
    .in('status', ['enviado', 'confirmado']);

  let matchedPagamento = null;
  if (pagamentosMatch?.length) {
    if (numeroFatura) {
      matchedPagamento = pagamentosMatch.find(p => p.referencia && String(p.referencia).trim() === String(numeroFatura).trim());
    }
    if (!matchedPagamento && valor != null) {
      matchedPagamento = pagamentosMatch.find(p => p.valor != null && Math.abs(Number(p.valor) - valor) < VALOR_TOLERANCIA);
    }
  }

  let situacao;
  let valorRegistado = null;
  if (matchedPagamento && (valor == null || Math.abs(Number(matchedPagamento.valor) - valor) < VALOR_TOLERANCIA)) {
    situacao = 'pago';
    valorRegistado = matchedPagamento.valor;
  } else if (matchedFatura && valor != null && matchedFatura.dados?.valor_total != null && Math.abs(Number(matchedFatura.dados.valor_total) - valor) >= VALOR_TOLERANCIA) {
    situacao = 'divergencia';
    valorRegistado = matchedFatura.dados.valor_total;
  } else if (matchedFatura || matchedPagamento) {
    situacao = 'sem_registo';
  } else {
    situacao = 'sem_registo';
  }

  return { situacao, valorRegistado, matchedFatura, matchedPagamento };
}

export function buildRespostaPrompt({ situacao, dadosExtraidos, valorRegistado, assunto, nomeEmpresaContador }) {
  const numeroFatura = dadosExtraidos?.numero_fatura || 'não indicado';
  const valor = dadosExtraidos?.valor != null ? `${Number(dadosExtraidos.valor).toFixed(2)} €` : 'não indicado';
  const mesRef = dadosExtraidos?.mes_referencia || 'não indicado';

  const instrucaoSituacao = {
    pago: `A fatura/cobrança JÁ ESTÁ registada como paga no nosso sistema (valor confirmado: ${valorRegistado != null ? Number(valorRegistado).toFixed(2) + ' €' : valor}). Confirma a receção deste email e confirma explicitamente que o pagamento já foi efetuado. Não peças mais informação.`,
    divergencia: `Há uma DIVERGÊNCIA DE VALOR entre o que está a ser cobrado (${valor}) e o que temos registado (${valorRegistado != null ? Number(valorRegistado).toFixed(2) + ' €' : 'valor diferente'}). Aponta a divergência de forma clara e direta, pedindo esclarecimento sobre a diferença, sem acusar nem especular sobre a causa.`,
    sem_registo: `NÃO há registo desta fatura/cobrança no nosso sistema. Confirma a receção do email e informa que vai ser verificado internamente. NÃO prometas um prazo específico de resposta ou pagamento.`,
  }[situacao];

  return `Atua como assistente administrativo da Magnetic Place Unipessoal, Lda a responder por email ao contador/contabilista da empresa.

CONTEXTO DO EMAIL RECEBIDO:
- Assunto: ${assunto || '(sem assunto)'}
- Número de fatura/referência indicado: ${numeroFatura}
- Valor cobrado: ${valor}
- Mês de referência: ${mesRef}

SITUAÇÃO APURADA (verificada no nosso sistema, não é para ti verificar novamente):
${instrucaoSituacao}

REGRAS DE ESCRITA:
- Português de Portugal, tom profissional e cordial, mas direto — sem floreados.
- Não repitas o assunto no corpo do email.
- Não inventes números de registo, datas de pagamento ou prazos que não te foram dados.
- Termina com uma saudação simples, sem assinatura completa (a assinatura é adicionada depois manualmente).
- Escreve APENAS o corpo do email de resposta, sem "Assunto:", sem markdown, sem comentários sobre a tua resposta.`;
}

function inferirTipoAnexo(anexoPath) {
  if (!anexoPath) return null;
  return anexoPath.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'pdf';
}

async function baixarAnexoFaturas(supabase, anexoPath) {
  const { data, error } = await supabase.storage.from('faturas').download(anexoPath);
  if (error) throw new Error(`Erro ao descarregar anexo: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

function buildRespostaFaturasEmFaltaPrompt({ encontradas, emFalta, assunto }) {
  const fmt = l => `- ${l.fornecedor || 'Fornecedor não identificado'} — documento ${l.numero_documento}${l.valor != null ? ` (${Number(l.valor).toFixed(2)} €)` : ''}`;
  const listaEncontradas = encontradas.map(fmt).join('\n') || '(nenhuma)';
  const listaEmFalta = emFalta.map(fmt).join('\n') || '(nenhuma)';

  return `Atua como assistente administrativo da Magnetic Place Unipessoal, Lda a responder por email ao contabilista, que pediu o envio de faturas de fornecedores em falta.

CONTEXTO:
- Assunto do email recebido: ${assunto || '(sem assunto)'}
- Encontrámos no nosso sistema ${encontradas.length} do(s) documento(s) pedido(s) — vão seguir em anexo a esta resposta.
- ${emFalta.length} documento(s) continuam sem correspondência no nosso sistema — vamos verificar internamente.

DOCUMENTOS ENCONTRADOS (a mencionar como já anexados a este email):
${listaEncontradas}

DOCUMENTOS EM FALTA (a mencionar como a verificar internamente, sem prometer prazo):
${listaEmFalta}

REGRAS DE ESCRITA:
- Português de Portugal, tom profissional e cordial, direto.
- Menciona claramente que os documentos encontrados seguem em anexo, com uma lista breve.
- Não inventes números de documento, valores ou fornecedores além dos listados acima.
- Escreve APENAS o corpo do email de resposta, sem "Assunto:", sem markdown, sem comentários sobre a tua resposta.`;
}

function buildRespostaExtratosBancariosPrompt({ pedidos, textoLivre, assunto }) {
  const listaPedidos = (pedidos || []).map(p => `- ${p.banco || 'Banco não identificado'}${p.mes_referencia ? ` (${p.mes_referencia})` : ''}`).join('\n');
  const resumoPedido = listaPedidos
    ? `Identificámos este pedido:\n${listaPedidos}`
    : (textoLivre ? `Resumo do pedido: ${textoLivre}` : 'Não foi possível identificar automaticamente que banco(s)/mês(es) estão em causa a partir do texto do email — usa uma formulação genérica.');

  return `Atua como assistente administrativo da Magnetic Place Unipessoal, Lda a responder por email ao contabilista, que pediu extratos bancários mensais em falta.

CONTEXTO:
- Assunto do email recebido: ${assunto || '(sem assunto)'}
- ${resumoPedido}
- IMPORTANTE: NÃO existe hoje no sistema um registo automático de que extratos já foram entregues ao contabilista — NÃO afirmes que algo já foi enviado nem que está confirmado.

REGRAS DE ESCRITA:
- Português de Portugal, tom profissional e cordial, direto.
- Confirma a receção do pedido e resume o que percebeste estar a ser pedido.
- NÃO prometas prazo nem confirmes envio — diz apenas que vai ser verificado internamente e enviado o que estiver em falta.
- Escreve APENAS o corpo do email de resposta, sem "Assunto:", sem markdown, sem comentários sobre a tua resposta.`;
}

async function gerarComClaude(prompt) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  });
  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text?.trim() || null;
}

async function guardarRascunho(supabase, {
  email_contador_id = null, rascunho, gmail_thread_id = null, anexos_faturas_ids,
  tipo_resposta = 'resposta_email', periodo_referente = null,
}) {
  const { data: resposta, error: insertError } = await supabase
    .from('respostas_contador_pendentes')
    .insert({
      email_contador_id,
      rascunho,
      editado_manualmente: false,
      status: 'pendente',
      gmail_thread_id,
      tipo_resposta,
      periodo_referente,
      ...(anexos_faturas_ids ? { anexos_faturas_ids } : {}),
    })
    .select()
    .single();
  if (insertError) throw new Error(`Erro ao guardar rascunho: ${insertError.message}`);

  // Envios mensais proativos não nascem de um email recebido — não há
  // emails_contador a atualizar.
  if (email_contador_id) {
    const { error: updateError } = await supabase
      .from('emails_contador')
      .update({ status: 'rascunho_gerado' })
      .eq('id', email_contador_id);
    if (updateError) throw new Error(`Rascunho guardado, mas falhou atualizar status do email: ${updateError.message}`);
  }

  return resposta;
}

async function handleGerar(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const missingEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN']
    .filter(k => !process.env[k]);
  if (missingEnv.length) {
    return res.status(500).json({ error: `Env vars em falta: ${missingEnv.join(', ')}` });
  }

  const { email_contador_id } = req.body || {};
  if (!email_contador_id) return res.status(400).json({ error: 'email_contador_id é obrigatório' });

  const supabase = supabaseAdmin();

  const { data: emailContador, error: fetchError } = await supabase
    .from('emails_contador')
    .select('*, fornecedores(nome, nif)')
    .eq('id', email_contador_id)
    .single();

  if (fetchError || !emailContador) {
    return res.status(404).json({ error: `Email do contador não encontrado: ${fetchError?.message || email_contador_id}` });
  }

  if (emailContador.tipo_pedido === 'outro') {
    return res.status(400).json({
      error: 'Este email não foi classificado como um dos tipos de pedido tratados automaticamente (faturas em falta, extratos bancários, cobrança). Requer resposta manual.',
    });
  }

  let replyContext;
  try {
    const gmail = gmailClient();
    replyContext = await getMessageReplyContext(gmail, { gmailMessageId: emailContador.gmail_message_id });
  } catch (e) {
    return res.status(502).json({ error: `Falha ao obter contexto da thread Gmail: ${e.message}` });
  }

  try {
    if (emailContador.tipo_pedido === 'faturas_em_falta') {
      if (!emailContador.anexo_path) {
        return res.status(400).json({ error: 'Este email foi classificado como "faturas em falta" mas não tem anexo guardado — não é possível cruzar a lista.' });
      }
      const kind = inferirTipoAnexo(emailContador.anexo_path);
      const buffer = await baixarAnexoFaturas(supabase, emailContador.anexo_path);
      let textoPdf = '';
      if (kind === 'pdf') {
        try { textoPdf = await extractPdfText(buffer); } catch (e) {
          return res.status(502).json({ error: `Falha ao extrair texto do PDF anexo: ${e.message}` });
        }
      }
      const linhas = await extrairLinhasFaturasEmFalta({ kind, buffer, textoPdf });
      if (linhas.length === 0) {
        return res.status(502).json({ error: 'Não foi possível extrair nenhuma linha de documento do anexo — verifica o formato manualmente.' });
      }
      const { encontradas, emFalta } = await cruzarFaturasEmFalta(supabase, linhas);

      const rascunho = await gerarComClaude(buildRespostaFaturasEmFaltaPrompt({ encontradas, emFalta, assunto: emailContador.assunto }));
      if (!rascunho) return res.status(502).json({ error: 'A API da Anthropic não devolveu texto de resposta' });

      const anexosFaturasIds = encontradas.map(l => l.fatura.id);
      const resposta = await guardarRascunho(supabase, {
        email_contador_id, rascunho, gmail_thread_id: replyContext.threadId, anexos_faturas_ids: anexosFaturasIds,
      });

      return res.status(200).json({
        resposta_id: resposta.id, rascunho, tipo_pedido: 'faturas_em_falta',
        encontradas: encontradas.map(l => ({ fornecedor: l.fornecedor, numero_documento: l.numero_documento, valor: l.valor, fatura_id: l.fatura.id, filename: l.fatura.filename })),
        em_falta: emFalta.map(l => ({ fornecedor: l.fornecedor, numero_documento: l.numero_documento, valor: l.valor, motivo: l.motivo })),
      });
    }

    if (emailContador.tipo_pedido === 'extratos_bancarios_em_falta') {
      const { extractBodyText } = await import('../gmail/_parseComprovativo.js');
      const gmail = gmailClient();
      const full = await gmail.users.messages.get({ userId: 'me', id: emailContador.gmail_message_id, format: 'full' });
      const textoCorpo = extractBodyText(full.data.payload);
      const { pedidos, texto_livre: textoLivre } = await extrairPedidoExtratosBancarios(textoCorpo);

      const rascunho = await gerarComClaude(buildRespostaExtratosBancariosPrompt({ pedidos, textoLivre, assunto: emailContador.assunto }));
      if (!rascunho) return res.status(502).json({ error: 'A API da Anthropic não devolveu texto de resposta' });

      const resposta = await guardarRascunho(supabase, { email_contador_id, rascunho, gmail_thread_id: replyContext.threadId });

      return res.status(200).json({
        resposta_id: resposta.id, rascunho, tipo_pedido: 'extratos_bancarios_em_falta',
        pedidos, texto_livre: textoLivre,
        aviso: 'Não há confirmação automática de quais extratos já foram enviados — revê manualmente antes de aprovar.',
      });
    }

    // Fallback: 'cobranca' ou tipo_pedido ainda não definido (registos antigos) — lógica original.
    const contadorNif = emailContador.fornecedores?.nif;
    if (!contadorNif) {
      return res.status(500).json({ error: 'Fornecedor "contador" associado não tem NIF definido — não é possível cruzar com faturas/pagamentos' });
    }

    const { situacao, valorRegistado } = await cruzarComRegistos(supabase, contadorNif, emailContador.dados_extraidos);
    const rascunho = await gerarComClaude(buildRespostaPrompt({
      situacao, dadosExtraidos: emailContador.dados_extraidos, valorRegistado,
      assunto: emailContador.assunto, nomeEmpresaContador: emailContador.fornecedores?.nome,
    }));
    if (!rascunho) return res.status(502).json({ error: 'A API da Anthropic não devolveu texto de resposta' });

    const resposta = await guardarRascunho(supabase, { email_contador_id, rascunho, gmail_thread_id: replyContext.threadId });
    return res.status(200).json({ resposta_id: resposta.id, rascunho, situacao, tipo_pedido: emailContador.tipo_pedido || 'cobranca' });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

// ---------------------------------------------------------------------------
// tipo=preparar_mensal — cron do dia 5: prepara (nunca envia) rascunho com as
// faturas reconciliadas do mês anterior, para reduzir pedidos de faturas em
// falta por parte do contador. Invocado pela Vercel Cron (vercel.json), que
// injeta automaticamente Authorization: Bearer $CRON_SECRET — verificado
// abaixo para bloquear qualquer chamada externa não autenticada.
// ---------------------------------------------------------------------------

function verificarAutorizacaoCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers['authorization'] === `Bearer ${secret}`;
}

// "Mês anterior" relativo a hoje, em UTC — evita ambiguidade de fuso horário
// à volta da meia-noite do dia 5. Devolve o intervalo [inicio, fim) e o
// próprio "inicio" serve como periodo_referente (primeiro dia do mês).
function getMesAnterior(refDate = new Date()) {
  const ano = refDate.getUTCFullYear();
  const mes = refDate.getUTCMonth(); // mês corrente, 0-indexed
  const anoAnterior = mes === 0 ? ano - 1 : ano;
  const mesAnteriorIdx = mes === 0 ? 11 : mes - 1;
  const fmt = d => d.toISOString().slice(0, 10);
  return {
    inicio: fmt(new Date(Date.UTC(anoAnterior, mesAnteriorIdx, 1))),
    fim: fmt(new Date(Date.UTC(ano, mes, 1))),
  };
}

async function getContadorFornecedor(supabase) {
  const nif = process.env.VITE_CONTADOR_NIF;
  if (!nif) return null;
  const { data } = await supabase.from('fornecedores').select('id, nome, email').eq('nif', nif).maybeSingle();
  return data || null;
}

function buildRespostaEnvioMensalPrompt({ comPdf, semPdf, mesNomeAno }) {
  const fmt = f => `- ${f.dados?.fornecedor || 'Fornecedor não identificado'}${f.dados?.numero_fatura ? ` — doc. ${f.dados.numero_fatura}` : ''}${f.dados?.valor_total != null ? ` (${Number(f.dados.valor_total).toFixed(2)} €)` : ''}`;
  const listaComPdf = comPdf.map(fmt).join('\n') || '(nenhuma)';
  const listaSemPdf = semPdf.map(fmt).join('\n') || '(nenhuma)';

  return `Atua como assistente administrativo da Magnetic Place Unipessoal, Lda a escrever um email PROATIVO (não é resposta a nenhum email recebido) para o contabilista, com as faturas de fornecedores já reconciliadas com o extrato bancário referentes a ${mesNomeAno}, para reduzir a necessidade de ele pedir estes documentos depois.

DOCUMENTOS RECONCILIADOS ANEXADOS A ESTE EMAIL:
${listaComPdf}

DOCUMENTOS RECONCILIADOS MAS AINDA SEM FICHEIRO DISPONÍVEL (mencionar como "a disponibilizar em breve", NÃO estão anexados):
${listaSemPdf}

REGRAS DE ESCRITA:
- Português de Portugal, tom profissional e cordial, direto.
- É um email NOVO, não uma resposta — não uses "obrigado pelo email" nem qualquer referência a mensagens anteriores.
- Explica em 1-2 frases o propósito: partilhar antecipadamente as faturas já reconciliadas do mês, para facilitar o trabalho de contabilidade.
- Termina com uma frase de transparência deixando claro que podem seguir-se documentos adicionais deste mesmo período nos próximos dias, à medida que forem reconciliados (não há garantia de que a reconciliação do mês esteja 100% completa nesta data).
- Não inventes fornecedores, números de documento ou valores além dos listados acima.
- Escreve APENAS o corpo do email, sem "Assunto:", sem markdown, sem comentários sobre a tua resposta.`;
}

// Zero faturas reconciliadas para o mês anterior é sinal de que o extrato
// bancário desse mês nunca foi carregado — não faz sentido gerar um rascunho
// vazio, avisa-se um humano em vez disso. Idempotente por título (mesmo
// padrão de registarAlertaDuplicados em api/auth.js): não duplica o alerta
// se já existir um igual ainda por resolver para este período.
async function registarAlertaExtratoNaoReconciliado(supabase, { mesNomeAno }) {
  const titulo = `Extrato de ${mesNomeAno} não reconciliado — envio mensal ao contador não preparado`;
  try {
    const { data: existente } = await supabase
      .from('gestao_alertas')
      .select('id')
      .eq('titulo', titulo)
      .in('status', ['pendente', 'visto'])
      .maybeSingle();
    if (existente) return { criado: false, id: existente.id };

    const { data: novo, error } = await supabase.from('gestao_alertas').insert({
      tipo: 'operacional',
      severidade: 'media',
      titulo,
      descricao: `O cron do dia 5 correu para preparar o envio mensal proativo ao contador, mas não encontrou nenhuma fatura reconciliada (fatura_pagamento_links) referente a ${mesNomeAno}. Isto normalmente significa que o extrato bancário desse mês ainda não foi carregado em Reconciliação.`,
      status: 'pendente',
      acao_sugerida: `Carregar o extrato bancário de ${mesNomeAno} em Reconciliação e, depois de reconciliado, disparar "preparar_mensal" manualmente para gerar o rascunho do envio ao contador.`,
      created_at: new Date().toISOString(),
    }).select('id').single();
    if (error) throw error;
    return { criado: true, id: novo.id };
  } catch (e) {
    console.error('[contador] falha ao registar alerta de extrato não reconciliado:', e.message);
    return { criado: false, id: null };
  }
}

async function handlePararMensal(req, res) {
  if (!verificarAutorizacaoCron(req)) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  const missingEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY']
    .filter(k => !process.env[k]);
  if (missingEnv.length) {
    return res.status(500).json({ error: `Env vars em falta: ${missingEnv.join(', ')}` });
  }

  const supabase = supabaseAdmin();
  const { inicio, fim } = getMesAnterior();

  // Idempotência — o cron pode disparar mais de uma vez por engano; se já
  // existir um envio mensal ativo (pendente, aprovado ou já enviado) para
  // este período, não gera outro. 'rejeitado' não bloqueia — se o admin
  // rejeitou, uma nova tentativa para o mesmo mês é legítima.
  const { data: existente, error: existenteError } = await supabase
    .from('respostas_contador_pendentes')
    .select('id, status')
    .eq('tipo_resposta', 'envio_mensal_proativo')
    .eq('periodo_referente', inicio)
    .in('status', ['pendente', 'aprovado', 'enviado'])
    .maybeSingle();
  if (existenteError) return res.status(500).json({ error: `Erro ao verificar duplicados: ${existenteError.message}` });
  if (existente) {
    return res.status(200).json({ ja_existe: true, resposta_id: existente.id, status: existente.status, periodo_referente: inicio });
  }

  const { data: faturasDoMes, error: faturasError } = await supabase
    .from('faturas')
    .select('id, filename, storage_path, mime_type, dados')
    .gte('dados->>data_pagamento', inicio)
    .lt('dados->>data_pagamento', fim);
  if (faturasError) return res.status(500).json({ error: `Erro ao carregar faturas: ${faturasError.message}` });

  const idsCandidatos = (faturasDoMes || []).map(f => f.id);
  let idsReconciliados = new Set();
  if (idsCandidatos.length > 0) {
    const { data: links, error: linksError } = await supabase
      .from('fatura_pagamento_links')
      .select('fatura_id')
      .in('fatura_id', idsCandidatos);
    if (linksError) return res.status(500).json({ error: `Erro ao carregar reconciliações: ${linksError.message}` });
    idsReconciliados = new Set((links || []).map(l => l.fatura_id));
  }

  const faturasReconciliadas = (faturasDoMes || []).filter(f => idsReconciliados.has(f.id));
  const mesNomeAno = new Date(`${inicio}T00:00:00Z`)
    .toLocaleDateString('pt-PT', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  if (faturasReconciliadas.length === 0) {
    const alerta = await registarAlertaExtratoNaoReconciliado(supabase, { mesNomeAno });
    return res.status(200).json({ sem_faturas: true, periodo_referente: inicio, alerta_criado: alerta.criado, alerta_id: alerta.id });
  }

  const comPdf = faturasReconciliadas.filter(f => f.storage_path);
  const semPdf = faturasReconciliadas.filter(f => !f.storage_path);

  const rascunho = await gerarComClaude(buildRespostaEnvioMensalPrompt({ comPdf, semPdf, mesNomeAno }));
  if (!rascunho) return res.status(502).json({ error: 'A API da Anthropic não devolveu texto de resposta' });

  let resposta;
  try {
    resposta = await guardarRascunho(supabase, {
      rascunho,
      anexos_faturas_ids: comPdf.map(f => f.id),
      tipo_resposta: 'envio_mensal_proativo',
      periodo_referente: inicio,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  return res.status(200).json({
    resposta_id: resposta.id,
    periodo_referente: inicio,
    rascunho,
    com_pdf: comPdf.map(f => ({ id: f.id, filename: f.filename, fornecedor: f.dados?.fornecedor, valor: f.dados?.valor_total })),
    sem_pdf: semPdf.map(f => ({ id: f.id, fornecedor: f.dados?.fornecedor, valor: f.dados?.valor_total })),
  });
}

// ---------------------------------------------------------------------------
// tipo=aprovar — aprova (envia) ou rejeita um rascunho de resposta ao contador
// ---------------------------------------------------------------------------

async function handleAprovar(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { resposta_id, action, confirmado_por, rascunho_final } = req.body || {};
  if (!resposta_id) return res.status(400).json({ error: 'resposta_id é obrigatório' });
  if (!['aprovar', 'rejeitar'].includes(action)) return res.status(400).json({ error: 'action deve ser "aprovar" ou "rejeitar"' });
  if (!confirmado_por) return res.status(400).json({ error: 'confirmado_por é obrigatório — nunca envio sem identidade registada' });

  const missingEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    .concat(action === 'aprovar' ? ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'] : [])
    .filter(k => !process.env[k]);
  if (missingEnv.length) {
    return res.status(500).json({ error: `Env vars em falta: ${missingEnv.join(', ')}` });
  }

  const supabase = supabaseAdmin();

  const { data: resposta, error: fetchError } = await supabase
    .from('respostas_contador_pendentes')
    .select('*, emails_contador(id, gmail_message_id, remetente, assunto)')
    .eq('id', resposta_id)
    .single();

  if (fetchError || !resposta) {
    return res.status(404).json({ error: `Resposta não encontrada: ${fetchError?.message || resposta_id}` });
  }

  if (resposta.status !== 'pendente') {
    return res.status(409).json({ error: `Esta resposta já foi ${resposta.status} — não pode ser reprocessada` });
  }

  const rascunhoFinal = (rascunho_final ?? resposta.rascunho).trim();
  const foiEditado = rascunhoFinal !== resposta.rascunho.trim();

  const isEnvioMensal = resposta.tipo_resposta === 'envio_mensal_proativo';

  if (action === 'rejeitar') {
    const { error: updateError } = await supabase
      .from('respostas_contador_pendentes')
      .update({ status: 'rejeitado', confirmado_por, resolved_at: new Date().toISOString(), rascunho: rascunhoFinal, editado_manualmente: foiEditado })
      .eq('id', resposta_id);
    if (updateError) return res.status(500).json({ error: `Erro ao registar rejeição: ${updateError.message}` });

    // Envios mensais proativos não têm email de origem associado.
    if (resposta.emails_contador) {
      await supabase.from('emails_contador').update({ status: 'rejeitado' }).eq('id', resposta.emails_contador.id);
    }

    return res.status(200).json({ sucesso: true, status: 'rejeitado' });
  }

  let destinatario, assuntoEnvio;
  if (isEnvioMensal) {
    const fornecedorContador = await getContadorFornecedor(supabase);
    if (!fornecedorContador?.email) {
      return res.status(500).json({ error: 'Não foi possível determinar o email do contador — o fornecedor com o NIF configurado em VITE_CONTADOR_NIF não tem email definido.' });
    }
    destinatario = fornecedorContador.email;
    const mesNomeAno = resposta.periodo_referente
      ? new Date(`${resposta.periodo_referente}T00:00:00Z`).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      : 'mês anterior';
    assuntoEnvio = `Faturas reconciliadas — ${mesNomeAno}`;
  } else {
    if (!resposta.emails_contador?.remetente) {
      return res.status(500).json({ error: 'Email do contador associado não tem remetente registado — não é possível responder' });
    }
    destinatario = resposta.emails_contador.remetente;
    assuntoEnvio = resposta.emails_contador.assunto;
  }

  // Faturas encontradas automaticamente (Fase C) são anexadas ao envio real —
  // só aqui, nunca antes da aprovação humana.
  let anexos = [];
  if (Array.isArray(resposta.anexos_faturas_ids) && resposta.anexos_faturas_ids.length > 0) {
    const { data: faturasParaAnexar, error: faturasErr } = await supabase
      .from('faturas')
      .select('id, filename, storage_path, mime_type')
      .in('id', resposta.anexos_faturas_ids);
    if (faturasErr) return res.status(500).json({ error: `Erro ao carregar faturas para anexar: ${faturasErr.message}` });

    for (const f of faturasParaAnexar || []) {
      if (!f.storage_path) continue;
      const { data: ficheiro, error: downloadErr } = await supabase.storage.from('faturas').download(f.storage_path);
      if (downloadErr) return res.status(500).json({ error: `Erro ao descarregar anexo "${f.filename}": ${downloadErr.message}` });
      anexos.push({
        filename: f.filename || f.storage_path.split('/').pop(),
        mimeType: f.mime_type || 'application/pdf',
        content: Buffer.from(await ficheiro.arrayBuffer()),
      });
    }
  }

  let sendResult;
  try {
    const gmail = gmailClient();
    if (isEnvioMensal) {
      // Email novo — não é reply a nenhuma thread existente.
      sendResult = await sendGmailNewMessage(gmail, {
        to: destinatario,
        subject: assuntoEnvio,
        bodyText: rascunhoFinal,
        attachments: anexos,
      });
    } else {
      const replyContext = await getMessageReplyContext(gmail, { gmailMessageId: resposta.emails_contador.gmail_message_id });
      sendResult = await sendGmailReply(gmail, {
        threadId: resposta.gmail_thread_id || replyContext.threadId,
        to: destinatario,
        subject: assuntoEnvio,
        bodyText: rascunhoFinal,
        inReplyToMessageId: replyContext.messageIdHeader,
        attachments: anexos,
      });
    }
  } catch (e) {
    return res.status(502).json({ error: `Falha ao enviar via Gmail: ${e.message}` });
  }

  const { error: updateError } = await supabase
    .from('respostas_contador_pendentes')
    .update({
      status: 'enviado',
      confirmado_por,
      resolved_at: new Date().toISOString(),
      rascunho: rascunhoFinal,
      editado_manualmente: foiEditado,
    })
    .eq('id', resposta_id);

  if (updateError) {
    return res.status(500).json({
      error: `Email enviado com sucesso (gmail_message_id: ${sendResult.id}), mas falhou registar o estado: ${updateError.message}`,
      enviado: true,
      gmail_message_id: sendResult.id,
    });
  }

  if (!isEnvioMensal) {
    await supabase.from('emails_contador').update({ status: 'enviado' }).eq('id', resposta.emails_contador.id);
  }

  return res.status(200).json({ sucesso: true, status: 'enviado', gmail_message_id: sendResult.id, anexos_enviados: anexos.length });
}

// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  try {
    const { tipo } = req.query;
    switch (tipo) {
      case 'acesso':          return await handleAcesso(req, res);
      case 'resumo':          return await handleResumo(req, res);
      case 'gerar':           return await handleGerar(req, res);
      case 'aprovar':         return await handleAprovar(req, res);
      case 'preparar_mensal': return await handlePararMensal(req, res);
      default:                return res.status(400).json({ error: `tipo desconhecido: ${tipo || '(não definido)'}` });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}
