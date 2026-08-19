import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import {
  calcularRecibo,
  valorDiarioLegal,
  MESES_PT,
} from '../../../lib/payroll/reciboCalculations.js';
import { findBestCombo, SYNC_TOLERANCE } from '../../../lib/payroll/mapaAutoFill.js';
import { calcMesParcial } from '../../../lib/payroll/mesParcial.js';
import { calcularDiasUteisNoMes } from '../../../lib/payroll/feriadosPortugal.js';
import { getRateAtDate } from '../cost-reports/useCostReportsData.js';
import { normalizarNome } from '../../../utils/validacaoHelpers.js';

// Réplica, como predicado par-a-par, dos 3 níveis de correspondência de
// encontrarWorker (validacaoHelpers.js): exata → substring → ≥60% de
// palavras significativas em comum. Não dá para reutilizar encontrarWorker
// diretamente aqui porque precisamos de saber se MAIS DE UM trabalhador
// bate com o mesmo nome (deteção de ambiguidade), não só o primeiro match.
function nomesCorrespondem(nomeA, nomeB) {
  const a = normalizarNome(nomeA || '');
  const b = normalizarNome(nomeB || '');
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const wordsA = a.split(/\s+/).filter(w => w.length >= 3);
  const wordsB = b.split(/\s+/).filter(w => w.length >= 3);
  const comuns = wordsA.filter(w => wordsB.includes(w));
  return comuns.length >= 2 && comuns.length / Math.max(wordsA.length, wordsB.length) >= 0.6;
}

// Pré-calcula, para cada linha de receipt_validations SEM worker_id (muitos
// registos antigos têm worker_id NULL), quais trabalhadores ativos
// correspondem ao nome extraído. Feito uma vez para todo o mês (não por
// trabalhador) porque a ambiguidade é uma relação entre um recibo e
// POTENCIALMENTE VÁRIOS trabalhadores — só é decidível olhando para todos
// os trabalhadores ativos de uma vez, não trabalhador a trabalhador.
function calcularMatchesPorNome(ativos, receiptValidations) {
  const semWorkerId = receiptValidations.filter(r => r.worker_id == null);
  return semWorkerId.map(rv => ({
    rv,
    workers: ativos.filter(w => nomesCorrespondem(w.name, rv.worker_name)),
  }));
}

// Resolve o fallback de um trabalhador específico: 'id' (worker_id direto,
// nunca ambíguo — índice único worker_id+mes), 'nome' (correspondência por
// nome, único candidato), 'ambigua' (correspondência por nome, mas mais de
// um trabalhador ativo bate com o mesmo recibo — ex.: nomes duplicados/muito
// semelhantes — não atribui a ninguém automaticamente), ou null (nada).
function resolverReciboFallback(w, receiptValidations, matchesPorNome) {
  const porId = receiptValidations.find(r => r.worker_id === w.id);
  if (porId) return { tipo: 'id', rv: porId };

  const entradasComW = matchesPorNome.filter(m => m.workers.some(mw => mw.id === w.id));
  if (entradasComW.length === 0) return { tipo: null, rv: null };
  if (entradasComW.length > 1) {
    // w bate com mais de um recibo diferente — também ambíguo.
    return {
      tipo: 'ambigua',
      rv: null,
      candidatos: entradasComW.map(e => ({ nomeRecibo: e.rv.worker_name, workerIds: e.workers.map(x => x.id) })),
    };
  }
  const [entrada] = entradasComW;
  if (entrada.workers.length > 1) {
    return {
      tipo: 'ambigua',
      rv: null,
      candidatos: [{ nomeRecibo: entrada.rv.worker_name, workerIds: entrada.workers.map(x => x.id) }],
    };
  }
  return { tipo: 'nome', rv: entrada.rv };
}

// Trabalhadores com ajudas de custo sempre ao máximo (mesma lógica do RecibosCalculadora)
const SEMPRE_MAX = ['diego rocha barbosa', 'nicole emanuele rosa da costa galtieri'];
const isMaxAjudas = (name) => SEMPRE_MAX.includes((name || '').trim().toLowerCase());
const funcaoDeNome = (name) =>
  (name || '').trim().toLowerCase() === 'diego rocha barbosa' ? 'gerencia' : 'geral';
const funcaoDeCPP = (cpp) => cpp && String(cpp).startsWith('1') ? 'gerencia' : 'geral';

// Equivalente a _calcReciboComMapa de RecibosCalculadora — função pura, sem estado React
function calcComMapa(w, subsAlimDias, brutoAlvo, anoNum, mesStr, vencBaseOverride, funcao = 'geral') {
  const vencBase = vencBaseOverride ?? (parseFloat(w.vencimento_base) || 0);
  const subsAlimValorDia = parseFloat(w.subsidio_alimentacao_dia) || 0;
  const baseParams = {
    vencimentoBase: vencBase, horasSemana: 40, premios: 0,
    he1: 0, he2: 0, incluirFerias: true, incluirNatal: true,
    subsAlimValorDia, subsAlimDias,
    subsAlimTipo: w.subsidio_alimentacao_tipo || 'dinheiro',
    tabelaKey: w.tabela_irs || 'tabelaI',
    nDependentes: w.n_dependentes ?? 0,
    brutoAlvo: brutoAlvo || vencBase,
    territorio: 'internacional', funcao, ano: anoNum,
    subsidiosMetodo: w.subsidios_metodo || 'duodecimos',
  };
  const rc0 = calcularRecibo(baseParams);
  const valorDiario = valorDiarioLegal('internacional', funcao);
  const ajudaNecessaria = rc0.ajudaCustoNecessaria;
  if (ajudaNecessaria <= 0 || valorDiario <= 0) return { rc: rc0, mapaLiqLive: 0 };

  const mesNum = parseInt(mesStr.split('-')[1], 10);
  const totalDiasMes = new Date(anoNum, mesNum, 0).getDate();

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
    const totalAjudas = Math.round(bestCombo.total * 100) / 100;
    const valorNecFinal = ajudaNecessaria + subsAlimMapa;
    const residuo = Math.round((valorNecFinal - totalAjudas) * 100) / 100;
    return { bestCombo, subsAlimMapa, totalAjudas, residuo };
  }

  let bestResult = null;
  for (let day = 1; day <= 20; day++) {
    const di = `${mesStr}-${String(day).padStart(2, '0')}`;
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
  const totalAjudas = Math.round(bestCombo.total * 100) / 100;
  const valorNecFinal = ajudaNecessaria + subsAlimMapa;
  const residuo = Math.round((valorNecFinal - totalAjudas) * 100) / 100;
  const premios = residuo > SYNC_TOLERANCE ? Math.round(residuo * 100) / 100 : 0;
  const mapaLiqLive = Math.round((totalAjudas - subsAlimMapa) * 100) / 100;
  const rc = premios > 0 ? calcularRecibo({ ...baseParams, premios }) : rc0;
  return { rc, mapaLiqLive };
}

export function useMapaSalarios(mes, ano) {
  const { workers, logs, supabase } = useApp();
  const [extra, setExtra] = useState({ resumoObs: [], rateHistory: [], absencias: [], receiptValidations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const mesNum = Number(mes);
  const anoNum = Number(ano);
  const mesStr = `${anoNum}-${String(mesNum).padStart(2, '0')}`;
  const mesLabel = `${MESES_PT[mesNum] || ''} ${anoNum}`;

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    Promise.all([
      supabase
        .from('resumo_observacoes')
        .select('worker_id, completo, ajuste_bruto')
        .eq('mes', mesStr),
      supabase.from('worker_valorhora_history').select('*'),
      supabase
        .from('absence_requests')
        .select('worker_id, dates')
        .eq('status', 'approved'),
      supabase
        .from('receipt_validations')
        .select('worker_id, worker_name, bruto_plataforma, abonos_extraidos, ss_extraido, irs_extraido, liquido_extraido, ajudas_custo_extraidas')
        .eq('mes', mesStr),
    ])
      .then(([obsRes, rateRes, absRes, rvRes]) => {
        const err = obsRes.error || rateRes.error || absRes.error || rvRes.error;
        if (err) { setError(err.message); return; }
        setExtra({
          resumoObs:   obsRes.data  || [],
          rateHistory: rateRes.data || [],
          absencias:   absRes.data  || [],
          receiptValidations: rvRes.data || [],
        });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [mesStr, supabase]);

  const logsDoMes = useMemo(
    () => (logs || []).filter(l => l.date?.startsWith(mesStr)),
    [logs, mesStr]
  );

  const rowsResult = useMemo(() => {
    if (!workers.length) return { linhas: [], ambiguidades: [] };
    const { resumoObs, rateHistory, absencias, receiptValidations } = extra;

    const ativos = workers.filter(w =>
      w.is_active !== false &&
      w.status !== 'inativo' &&
      w.vencimento_base != null &&
      parseFloat(w.vencimento_base) > 0
    );

    const matchesPorNome = calcularMatchesPorNome(ativos, receiptValidations);
    const ambiguidadesVistas = new Set();
    const ambiguidades = [];

    const linhas = ativos.map((w, idx) => {
      const sempreIncluir = isMaxAjudas(w.name);
      const funcaoW = sempreIncluir
        ? funcaoDeNome(w.name)
        : (w.profissao_cnp ? funcaoDeCPP(w.profissao_cnp) : 'geral');

      const workerLogs = logsDoMes.filter(l => l.workerId === w.id);
      const temLogs = workerLogs.length > 0;
      const hist = rateHistory.filter(h => h.worker_id === w.id);
      const brutoAlvo = workerLogs.reduce((s, l) => {
        const rate = getRateAtDate(l.date, hist, parseFloat(w.valorHora) || 0);
        return s + (parseFloat(l.hours) || 0) * rate;
      }, 0);

      const workerAus = absencias
        .filter(a => a.worker_id === w.id)
        .flatMap(a => a.dates || [])
        .filter(d => d.startsWith(mesStr));

      const subsAlimDias = calcularDiasUteisNoMes(anoNum, mesNum, {
        feriadoMunicipal: null,
        dataAdmissao:     w.dataInicio || null,
        dataCessacao:     w.dataFim    || null,
        ausencias:        workerAus,
      });

      const mesParcial = calcMesParcial(w.dataInicio || null, w.dataFim || null, anoNum, mesNum);
      const vencOrig = parseFloat(w.vencimento_base) || 0;
      const vencCalculo = mesParcial.tipo !== 'completo'
        ? parseFloat((vencOrig * mesParcial.fator).toFixed(2))
        : undefined;

      // mapaLiqLiveMax: fórmula independente de logs, para os 2 trabalhadores
      // sempre-máximo (SEMPRE_MAX) — preservada tal e qual, em qualquer fonte.
      const mapaLiqLiveMax = () =>
        Math.round(new Date(anoNum, mesNum, 0).getDate() * valorDiarioLegal('internacional', funcaoW) * 100) / 100;

      let fonte, receber, mapa, ajudasCusto, totalRecibo, segSocial, irs, liquido, divergencia;

      if (temLogs) {
        // Comportamento atual, sem alterações.
        const { rc, mapaLiqLive: calc } = calcComMapa(
          w, subsAlimDias, brutoAlvo, anoNum, mesStr, vencCalculo, funcaoW
        );
        const mapaLiqLive = sempreIncluir ? mapaLiqLiveMax() : calc;
        const ajudas = mapaLiqLive ?? rc.ajudaCustoNecessaria;

        const obs = resumoObs.find(o => o.worker_id === w.id);
        const ajusteBruto = obs?.ajuste_bruto ?? null;
        const rawDiv = ajusteBruto != null
          ? Math.round((rc.totalAbonos - ajusteBruto) * 100) / 100
          : null;

        fonte = 'log';
        receber = rc.totalAbonos;
        mapa = rc.somaOutrosAbonos;
        ajudasCusto = ajudas;
        totalRecibo = rc.somaOutrosAbonos + ajudas;
        segSocial = rc.ssTrabalhador;
        irs = rc.irsTotal;
        liquido = rc.liquido;
        divergencia = rawDiv != null && Math.abs(rawDiv) > 0.02 ? rawDiv : null;
      } else {
        // Sem logs suficientes — tenta preencher com o recibo já processado
        // (receipt_validations) do mesmo trabalhador/mês. Sem comparação
        // possível com resumo_observacoes (não há cálculo de mapa para
        // divergir), por isso divergencia fica sempre null aqui.
        const { tipo, rv, candidatos } = resolverReciboFallback(w, receiptValidations, matchesPorNome);
        divergencia = null;

        if (tipo === 'ambigua') {
          // Mais de um trabalhador ativo bate com o mesmo nome de recibo —
          // não atribui a ninguém automaticamente. Regista para revisão
          // manual (uma vez por combinação nome+candidatos, evita repetir a
          // mesma ambiguidade se dois trabalhadores dispararem a mesma).
          for (const c of candidatos) {
            const chave = c.nomeRecibo + '|' + c.workerIds.slice().sort().join(',');
            if (!ambiguidadesVistas.has(chave)) {
              ambiguidadesVistas.add(chave);
              ambiguidades.push({ nomeRecibo: c.nomeRecibo, workerIdsCandidatos: c.workerIds, mes: mesStr });
            }
          }
        }

        if (tipo === 'id' || tipo === 'nome') {
          fonte = tipo === 'id' ? 'recibo-id' : 'recibo-nome';
          mapa = Number(rv.abonos_extraidos) || 0;
          const ajudasRecibo = Number(rv.ajudas_custo_extraidas) || 0;
          ajudasCusto = sempreIncluir ? mapaLiqLiveMax() : ajudasRecibo;
          totalRecibo = mapa + ajudasCusto;
          receber = Number(rv.bruto_plataforma) > 0 ? Number(rv.bruto_plataforma) : totalRecibo;
          segSocial = Number(rv.ss_extraido) || 0;
          irs = Number(rv.irs_extraido) || 0;
          liquido = Number(rv.liquido_extraido) || 0;
        } else if (tipo === 'ambigua') {
          // Revisão manual necessária — nenhum valor atribuído automaticamente.
          fonte = 'ambigua';
          receber = mapa = ajudasCusto = totalRecibo = segSocial = irs = liquido = null;
        } else {
          // Nem log nem recibo — a linha continua a aparecer, mas sem
          // nenhum dado disponível. `null` explícito (não 0) para a UI
          // distinguir "sem dado nenhum" de "valor real é zero" (n2, em
          // mapaUtils.js, mostra null como "—").
          fonte = 'sem-dados';
          receber = mapa = ajudasCusto = totalRecibo = segSocial = irs = liquido = null;
        }
      }

      return {
        id:       w.id,
        mecNum:   String(idx + 1).padStart(2, '0'),
        nome:     w.name,
        fonte,

        // Vencimentos a Pagar (colunas TOConline — acrescimos/retencao/subPrem ainda não calculados)
        receber,
        acrescimos: 0,
        retencao:   0,
        subPrem:    0,
        totalVenc:  receber,

        // Recibo
        mapa,
        ajudasCusto,
        totalRecibo,

        // Descontos
        segSocial,
        irs,
        fct:          0,
        penhora:      0,
        acDesconto:   0,
        retencaoFinal: 0,

        // Resultado
        liquido,

        // Estado
        isCompleto:  fonte === 'log' ? (resumoObs.find(o => o.worker_id === w.id)?.completo ?? false) : false,
        divergencia,
        semNIS:      !w.nis,
      };
    });

    return { linhas, ambiguidades };
  }, [workers, logsDoMes, extra, anoNum, mesNum, mesStr]);

  const rows = rowsResult.linhas;
  const ambiguidadesFallback = rowsResult.ambiguidades;

  const totals = useMemo(() => ({
    // r.field pode ser null (fonte 'ambigua'/'sem-dados') — soma como 0 sem
    // mascarar o null nas células individuais (n2, em mapaUtils.js).
    receber:       rows.reduce((s, r) => s + (r.receber ?? 0), 0),
    mapa:          rows.reduce((s, r) => s + (r.mapa ?? 0), 0),
    ajudasCusto:   rows.reduce((s, r) => s + (r.ajudasCusto ?? 0), 0),
    totalRecibo:   rows.reduce((s, r) => s + (r.totalRecibo ?? 0), 0),
    segSocial:     rows.reduce((s, r) => s + (r.segSocial ?? 0), 0),
    irs:           rows.reduce((s, r) => s + (r.irs ?? 0), 0),
    liquido:       rows.reduce((s, r) => s + (r.liquido ?? 0), 0),
    nWorkers:      rows.length,
    nCompletos:    rows.filter(r => r.isCompleto).length,
    nDivergencias: rows.filter(r => r.divergencia != null).length,
    nSemNIS:       rows.filter(r => r.semNIS).length,
    nSemDados:     rows.filter(r => r.fonte === 'sem-dados' || r.fonte === 'ambigua').length,
  }), [rows]);

  return { rows, totals, loading, error, mesStr, mesLabel, ambiguidadesFallback };
}
