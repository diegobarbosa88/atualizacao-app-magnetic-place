import { createClient } from '@supabase/supabase-js';
import { calcularRecibo, valorDiarioLegal, getIRSTabelasPorAno } from '../src/lib/payroll/reciboCalculations.js';
import { calcMesParcial } from '../src/lib/payroll/mesParcial.js';
import { calcularDiasUteisNoMes } from '../src/lib/payroll/feriadosPortugal.js';
import { findBestCombo, SYNC_TOLERANCE } from '../src/lib/payroll/mapaAutoFill.js';

// Única forma de obter (ou alterar) dados do Resumo Mensal partilhado com o
// contabilista — o frontend público (src/features/public/ResumoMensalPublico.jsx)
// não acede a workers/clients/logs/etc. diretamente com a anon key; tudo passa
// por aqui, com a service role key, depois de validar o token.

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

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

// Portado tal-e-qual de ResumoMensalPublico.jsx (ver histórico) — a página
// pública deixou de fazer qualquer cálculo, só mostra o que este endpoint devolve.
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

export default async function handler(req, res) {
  try {
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

    // action 'get' (default) — devolve o resumo mensal calculado
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

    // Audit log — regista cada acesso (token, mês pedido, IP, user agent)
    await supabase.from('contador_portal_audit_logs').insert({
      token,
      mes_acedido: dataInicio,
      ip_address: getClientIp(req),
      user_agent: req.headers['user-agent'] || null,
    });

    return res.status(200).json({ rows, visibleCols, feriadoMunicipal: settingsRow?.feriado_municipal || null });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}
