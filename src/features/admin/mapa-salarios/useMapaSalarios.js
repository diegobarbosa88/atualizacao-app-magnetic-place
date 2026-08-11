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
  const [extra, setExtra] = useState({ resumoObs: [], rateHistory: [], absencias: [] });
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
    ])
      .then(([obsRes, rateRes, absRes]) => {
        const err = obsRes.error || rateRes.error || absRes.error;
        if (err) { setError(err.message); return; }
        setExtra({
          resumoObs:   obsRes.data  || [],
          rateHistory: rateRes.data || [],
          absencias:   absRes.data  || [],
        });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [mesStr, supabase]);

  const logsDoMes = useMemo(
    () => (logs || []).filter(l => l.date?.startsWith(mesStr)),
    [logs, mesStr]
  );

  const rows = useMemo(() => {
    if (!workers.length) return [];
    const { resumoObs, rateHistory, absencias } = extra;

    const ativos = workers.filter(w =>
      w.is_active !== false &&
      w.status !== 'inativo' &&
      w.vencimento_base != null &&
      parseFloat(w.vencimento_base) > 0
    );

    return ativos.map((w, idx) => {
      const sempreIncluir = isMaxAjudas(w.name);
      const funcaoW = sempreIncluir
        ? funcaoDeNome(w.name)
        : (w.profissao_cnp ? funcaoDeCPP(w.profissao_cnp) : 'geral');

      const workerLogs = logsDoMes.filter(l => l.workerId === w.id);
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

      const { rc, mapaLiqLive: calc } = calcComMapa(
        w, subsAlimDias, brutoAlvo, anoNum, mesStr, vencCalculo, funcaoW
      );

      const mapaLiqLive = sempreIncluir
        ? Math.round(new Date(anoNum, mesNum, 0).getDate() * valorDiarioLegal('internacional', funcaoW) * 100) / 100
        : calc;

      const obs = resumoObs.find(o => o.worker_id === w.id);
      const ajusteBruto = obs?.ajuste_bruto ?? null;
      const rawDiv = ajusteBruto != null
        ? Math.round((rc.totalAbonos - ajusteBruto) * 100) / 100
        : null;
      const divergencia = rawDiv != null && Math.abs(rawDiv) > 0.02 ? rawDiv : null;

      const ajudas = mapaLiqLive ?? rc.ajudaCustoNecessaria;

      return {
        id:       w.id,
        mecNum:   String(idx + 1).padStart(2, '0'),
        nome:     w.name,

        // Vencimentos a Pagar (colunas TOConline — acrescimos/retencao/subPrem ainda não calculados)
        receber:    rc.totalAbonos,
        acrescimos: 0,
        retencao:   0,
        subPrem:    0,
        totalVenc:  rc.totalAbonos,

        // Recibo
        mapa:        rc.somaOutrosAbonos,
        ajudasCusto: ajudas,
        totalRecibo: rc.somaOutrosAbonos + ajudas,

        // Descontos
        segSocial:    rc.ssTrabalhador,
        irs:          rc.irsTotal,
        fct:          0,
        penhora:      0,
        acDesconto:   0,
        retencaoFinal: 0,

        // Resultado
        liquido: rc.liquido,

        // Estado
        isCompleto:  obs?.completo  ?? false,
        divergencia,
        semNIS:      !w.nis,
      };
    });
  }, [workers, logsDoMes, extra, anoNum, mesNum, mesStr]);

  const totals = useMemo(() => ({
    receber:       rows.reduce((s, r) => s + r.receber, 0),
    mapa:          rows.reduce((s, r) => s + r.mapa, 0),
    ajudasCusto:   rows.reduce((s, r) => s + r.ajudasCusto, 0),
    totalRecibo:   rows.reduce((s, r) => s + r.totalRecibo, 0),
    segSocial:     rows.reduce((s, r) => s + r.segSocial, 0),
    irs:           rows.reduce((s, r) => s + r.irs, 0),
    liquido:       rows.reduce((s, r) => s + r.liquido, 0),
    nWorkers:      rows.length,
    nCompletos:    rows.filter(r => r.isCompleto).length,
    nDivergencias: rows.filter(r => r.divergencia != null).length,
    nSemNIS:       rows.filter(r => r.semNIS).length,
  }), [rows]);

  return { rows, totals, loading, error, mesStr, mesLabel };
}
