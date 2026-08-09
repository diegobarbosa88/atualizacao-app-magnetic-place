import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import {
  calcularRecibo, valorDiarioLegal, getIRSTabelasPorAno, MESES_PT,
} from '../../lib/payroll/reciboCalculations.js';
import { calcMesParcial } from '../../lib/payroll/mesParcial.js';
import { calcularDiasUteisNoMes } from '../../lib/payroll/feriadosPortugal.js';
import { findBestCombo, SYNC_TOLERANCE } from '../../lib/payroll/mapaAutoFill.js';
import { getRateAtDate } from '../admin/cost-reports/useCostReportsData.js';
import { RESUMO_COLS, GROUP_DEFS } from '../../lib/payroll/resumoCols.js';
import { useDragScroll } from '../../lib/useDragScroll.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const sb = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const EMPRESA = { nome: 'Magnetic Place Unipessoal, Lda', nif: '517379740' };

function _calcReciboComMapa(w, subsAlimDias, brutoAlvo, anoNum, mesStr, vencBaseOverride) {
  const vencBase         = vencBaseOverride ?? (parseFloat(w.vencimento_base) || 0);
  const subsAlimValorDia = parseFloat(w.subsidio_alimentacao_dia) || 0;
  const baseParams = {
    vencimentoBase: vencBase, horasSemana: 40, premios: 0,
    he1: 0, he2: 0, incluirFerias: true, incluirNatal: true,
    subsAlimValorDia, subsAlimDias, subsAlimTipo: w.subsidio_alimentacao_tipo || 'dinheiro',
    tabelaKey: w.tabela_irs || 'tabelaI',
    nDependentes: w.n_dependentes ?? 0,
    brutoAlvo: brutoAlvo || vencBase,
    territorio: 'internacional', funcao: 'geral', ano: anoNum,
  };
  const rc0             = calcularRecibo(baseParams);
  const valorDiario     = valorDiarioLegal('internacional', 'geral');
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

  if (!bestResult) return { rc: rc0, mapaLiqLive: 0 };
  const { bestCombo, subsAlimMapa } = bestResult;
  const totalAjudas   = Math.round(bestCombo.total * 100) / 100;
  const valorNecFinal = ajudaNecessaria + subsAlimMapa;
  const residuo       = Math.round((valorNecFinal - totalAjudas) * 100) / 100;
  const premios       = residuo > SYNC_TOLERANCE ? Math.round(residuo * 100) / 100 : 0;
  const mapaLiqLive   = Math.round((totalAjudas - subsAlimMapa) * 100) / 100;
  const rc            = premios > 0 ? calcularRecibo({ ...baseParams, premios }) : rc0;
  return { rc, mapaLiqLive };
}

function parseMes(str) {
  const [a, m] = (str || '').split('-');
  return { ano: parseInt(a) || new Date().getFullYear(), mes: parseInt(m) || new Date().getMonth() + 1 };
}
function toMesStr(ano, mes) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

// Célula que expande no hover quando o texto está truncado
function ExpandCell({ text, maxWidth, style, className }) {
  const ref  = useRef(null);
  const [rect, setRect] = useState(null);

  const handleEnter = () => {
    if (ref.current && ref.current.scrollWidth > ref.current.clientWidth + 1) {
      setRect(ref.current.getBoundingClientRect());
    }
  };

  return (
    <div
      ref={ref}
      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: maxWidth || 'none', ...style }}
      className={className}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setRect(null)}
    >
      {text}
      {rect && createPortal(
        <div style={{
          position: 'fixed', top: rect.top, left: rect.left, height: rect.height,
          zIndex: 9999, background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px',
          padding: '0 10px', whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,.18)',
          fontSize: '11px', fontWeight: 700,
          display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#1e293b',
          minWidth: rect.width,
        }}>
          {text}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function ResumoMensalPublico() {
  const params  = new URLSearchParams(window.location.search);
  const inicial = params.get('mes') || toMesStr(new Date().getFullYear(), new Date().getMonth() + 1);
  const { ano: a0, mes: m0 } = parseMes(inicial);

  const [ano, setAno] = useState(a0);
  const [mes, setMes] = useState(m0);

  const [workers,     setWorkers]     = useState([]);
  const [clients,     setClients]     = useState([]);
  const [rateHistory, setRateHistory] = useState([]);
  const [staticReady, setStaticReady] = useState(false);

  const [visibleCols, setVisibleCols] = useState(() => new Set(RESUMO_COLS.map((_, i) => i)));

  const [logs,       setLogs]       = useState([]);
  const [contab,     setContab]     = useState([]);
  const [obs,        setObs]        = useState({});
  const [completos,  setCompletos]  = useState({});
  const [ajustes,    setAjustes]    = useState({});
  const [loading,          setLoading]          = useState(true);
  const [saveStatus,       setSaveStatus]       = useState(null);
  const [dbError,          setDbError]          = useState(null);
  const [feriadoMunicipal, setFeriadoMunicipal] = useState(null);
  const { ref: tableScrollRef, dragProps }       = useDragScroll();

  const ms = toMesStr(ano, mes);

  useEffect(() => {
    if (!sb) return;
    sb.from('resumo_observacoes').select('completo, ajuste_bruto').limit(1)
      .then(({ error }) => { setDbError(error ? error.message : null); });
  }, []);

  useEffect(() => {
    if (!sb) return;
    sb.from('system_settings').select('*').eq('id', 1).maybeSingle()
      .then(({ data }) => setFeriadoMunicipal(data?.feriado_municipal || null));
  }, []);

  useEffect(() => {
    if (!sb) return;
    Promise.all([
      sb.from('workers').select('*').limit(1000),
      sb.from('clients').select('*').limit(1000),
      sb.from('worker_valorhora_history').select('*').limit(5000),
    ]).then(([w, c, r]) => {
      setWorkers(w.data || []);
      setClients(c.data || []);
      setRateHistory(r.data || []);
      setStaticReady(true);
    });
  }, []);

  // Colunas visíveis sincronizadas com admin
  useEffect(() => {
    if (!sb) return;
    const parseValor = v => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
      return null;
    };
    let lastHash = '';
    const syncCols = () =>
      sb.from('resumo_config').select('valor').eq('chave', 'visible_cols').maybeSingle()
        .then(({ data }) => {
          const arr = parseValor(data?.valor);
          if (!arr) return;
          const hash = [...arr].sort().join(',');
          if (hash === lastHash) return;
          lastHash = hash;
          setVisibleCols(new Set(arr));
        });
    syncCols();
    const interval = setInterval(syncCols, 3000);
    const ch = sb.channel('pub_config_cols')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resumo_config' },
        ({ new: row }) => {
          if (row?.chave !== 'visible_cols') return;
          const arr = parseValor(row?.valor);
          if (arr) { lastHash = [...arr].sort().join(','); setVisibleCols(new Set(arr)); }
        })
      .subscribe();
    return () => { clearInterval(interval); sb.removeChannel(ch); };
  }, []);

  // Dados do mês
  useEffect(() => {
    if (!sb) return;
    setLoading(true);
    const dataInicio = `${ms}-01`;
    const nextMes    = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
    Promise.all([
      sb.from('logs').select('*').gte('date', dataInicio).lt('date', nextMes).limit(5000),
      sb.from('contabilidade_mensal').select('*').eq('mes', ms),
      sb.from('resumo_observacoes').select('worker_id, observacao, completo, ajuste_bruto').eq('mes', ms),
    ]).then(([l, c, o]) => {
      setLogs(l.data || []);
      setContab(c.data || []);
      const obsMap = {}, compMap = {}, ajMap = {};
      (o.data || []).forEach(r => {
        obsMap[r.worker_id]  = r.observacao;
        compMap[r.worker_id] = !!r.completo;
        if (r.ajuste_bruto)  ajMap[r.worker_id] = parseFloat(r.ajuste_bruto) || 0;
      });
      setObs(obsMap); setCompletos(compMap); setAjustes(ajMap);
      setLoading(false);
    });

    const channel = sb.channel(`pub_obs_${ms}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'resumo_observacoes', filter: `mes=eq.${ms}`,
      }, ({ new: row, eventType }) => {
        if (!row?.worker_id) return;
        setObs(prev => eventType === 'DELETE'
          ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== row.worker_id))
          : { ...prev, [row.worker_id]: row.observacao || '' });
        if (eventType !== 'DELETE') {
          setCompletos(prev => ({ ...prev, [row.worker_id]: !!row.completo }));
          setAjustes(prev =>   ({ ...prev, [row.worker_id]: parseFloat(row.ajuste_bruto) || 0 }));
        } else {
          setCompletos(prev => { const n = { ...prev }; delete n[row.worker_id]; return n; });
          setAjustes(prev =>   { const n = { ...prev }; delete n[row.worker_id]; return n; });
        }
      })
      .subscribe();

    const syncData = () =>
      sb.from('resumo_observacoes')
        .select('worker_id, observacao, completo, ajuste_bruto').eq('mes', ms)
        .then(({ data }) => {
          if (!data) return;
          const obsMap = {}, compMap = {}, ajMap = {};
          data.forEach(r => {
            obsMap[r.worker_id]  = r.observacao || '';
            compMap[r.worker_id] = !!r.completo;
            ajMap[r.worker_id]   = parseFloat(r.ajuste_bruto) || 0;
          });
          setObs(obsMap); setCompletos(compMap); setAjustes(ajMap);
        });
    const poll = setInterval(syncData, 4000);

    return () => { sb.removeChannel(channel); clearInterval(poll); };
  }, [ms]);

  function navMes(dir) {
    let m = mes + dir, a = ano;
    if (m > 12) { m = 1; a++; }
    if (m < 1)  { m = 12; a--; }
    setMes(m); setAno(a);
    window.history.replaceState(null, '', `?mes=${toMesStr(a, m)}`);
  }

  const anoNum = ano;
  const mesNum = mes;

  const rows = useMemo(() => {
    if (!staticReady) return [];
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

      const { rc, mapaLiqLive } = _calcReciboComMapa(w, subsAlimDias, brutoAlvo, anoNum, mesStr, vencCalculo);
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
  }, [staticReady, workers, clients, rateHistory, logs, obs, completos, ajustes, anoNum, mesNum, feriadoMunicipal]);

  const upsertObs = (workerId, patch) => {
    if (!sb || !workerId || !ms) return;
    setSaveStatus('saving');
    sb.from('resumo_observacoes').upsert(
      {
        worker_id:    workerId,
        mes:          ms,
        observacao:   obs[workerId]      || '',
        completo:     completos[workerId] || false,
        ajuste_bruto: ajustes[workerId]   || 0,
        updated_at:   new Date().toISOString(),
        ...patch,
      },
      { onConflict: 'worker_id,mes' }
    ).then(({ error }) => {
      if (error) { setDbError(error.message); setSaveStatus('error'); }
      else       { setDbError(null);           setSaveStatus('ok'); }
      setTimeout(() => setSaveStatus(null), 2500);
    });
  };

  const updateObs = (workerId, valor) => {
    setObs(prev => ({ ...prev, [workerId]: valor }));
    upsertObs(workerId, { observacao: valor });
  };

  const updateCompleto = (workerId, valor) => {
    setCompletos(prev => ({ ...prev, [workerId]: valor }));
    upsertObs(workerId, { completo: valor });
  };

  const mesLabel   = `${MESES_PT[mes] || ''} ${ano}`;
  const isReady    = staticReady && !loading;
  const activeCols = RESUMO_COLS.map((col, ci) => ({ col, ci })).filter(({ ci }) => visibleCols.has(ci));

  const hlHead = h => ({ blue: 'bg-sky-700 text-white', green: 'bg-emerald-700 text-white', rose: 'bg-rose-700 text-white', emerald: 'bg-emerald-600 text-white' }[h] || '');
  const hlCell = h => ({ blue: 'bg-sky-50 text-sky-900 border-x border-sky-100', green: 'bg-emerald-50 text-emerald-900 border-x border-emerald-100', rose: 'bg-rose-50 text-rose-900 border-x border-rose-100', emerald: 'bg-emerald-50 text-emerald-800 border-x border-emerald-100' }[h] || '');
  const hlFoot = h => ({ blue: 'bg-sky-200 text-sky-900 border-x border-sky-300', green: 'bg-emerald-200 text-emerald-900 border-x border-emerald-300', rose: 'bg-rose-200 text-rose-900 border-x border-rose-300', emerald: 'bg-emerald-200 text-emerald-800 border-x border-emerald-300' }[h] || '');
  const tdAlign = col => col?.align === 'right' ? 'text-right' : col?.align === 'left' ? 'text-left' : 'text-center';

  function exportXLS() {
    const style = (bg, color, bold) =>
      `background:${bg};color:${color};font-weight:${bold ? 'bold' : 'normal'};padding:7px 10px;border:1px solid #E2E8F0;white-space:nowrap;text-align:center`;
    const hdrRow = `<tr>${activeCols.map(({ col }) =>
      `<td style="${style('#0F1F3D', 'white', true)}">${col.label}</td>`).join('')}</tr>`;
    const bodyRows = rows.map((row, ri) =>
      `<tr>${activeCols.map(({ col }) =>
        `<td style="${style(ri % 2 === 0 ? '#ffffff' : '#F8FAFC', '#1E293B', false)}">${
          col.tipo === 'toggle' ? (row.completo ? '✓' : '') : (row[col.key] ?? '')
        }</td>`).join('')}</tr>`).join('');
    const totRow = `<tr>${activeCols.map(({ col }, ai) => {
      const val = col.sumKey ? rows.reduce((s, r) => s + (r[col.sumKey] || 0), 0) : null;
      return `<td style="${style('#EEF2FF', '#4F46E5', true)}">${ai === 0 ? 'TOTAIS' : val !== null ? val.toFixed(2) : ''}</td>`;
    }).join('')}</tr>`;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/></head><body>
<h2 style="font-family:Arial;color:#0F1F3D">RESUMO MENSAL — ${mesLabel.toUpperCase()}</h2>
<table border="1">${hdrRow}${bodyRows}${totRow}</table>
</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `resumo-mensal-${mesLabel.toLowerCase().replace(/\s+/g, '-')}.xls`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (!sb) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <p className="text-slate-500 font-bold">Configuração Supabase em falta.</p>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

      {/* ── Cabeçalho escuro ── */}
      <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between gap-4 shadow-lg flex-wrap flex-shrink-0">
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Resumo Mensal Salarial</p>
          <p className="text-sm font-black text-white">{EMPRESA.nome} · NIF {EMPRESA.nif}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navMes(-1)} className="p-2 rounded-xl hover:bg-slate-700 transition-all">
            <ChevronLeft size={16} />
          </button>
          <span className="font-black text-base min-w-44 text-center capitalize">{mesLabel}</span>
          <button onClick={() => navMes(1)} className="p-2 rounded-xl hover:bg-slate-700 transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && <span className="text-[10px] text-slate-300 animate-pulse">A guardar…</span>}
          {saveStatus === 'ok'     && <span className="text-[10px] text-emerald-400 font-black">✓ Guardado</span>}
          {saveStatus === 'error'  && <span className="text-[10px] text-red-400 font-black">✗ Erro ao guardar</span>}
          {isReady && !saveStatus  && <span className="text-[10px] text-slate-400">{rows.length} trabalhadores · {logs.length} registos</span>}
          <button
            onClick={exportXLS}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase bg-emerald-600 text-white hover:bg-emerald-700 transition-all border border-emerald-600 shadow-sm"
          >
            <FileSpreadsheet size={13} /> XLS
          </button>
        </div>
      </div>

      {/* Banner erro BD */}
      {dbError && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-800 flex-shrink-0">
          <strong>⚠️ Erro na base de dados:</strong> {dbError}
          <br />Execute este SQL no Supabase → SQL Editor:
          <pre className="mt-1 bg-red-100 rounded p-2 text-[10px] overflow-x-auto whitespace-pre-wrap">
{`DROP TABLE IF EXISTS resumo_observacoes;
CREATE TABLE resumo_observacoes (
  worker_id    TEXT        NOT NULL,
  mes          TEXT        NOT NULL,
  observacao   TEXT        NOT NULL DEFAULT '',
  completo     BOOLEAN     NOT NULL DEFAULT FALSE,
  ajuste_bruto NUMERIC     DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (worker_id, mes)
);
ALTER TABLE resumo_observacoes DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE resumo_observacoes;`}
          </pre>
        </div>
      )}

      {/* ── Conteúdo principal — preenche o espaço restante ── */}
      <div className="flex-1 flex flex-col overflow-hidden px-4 pt-3 pb-2 min-h-0">

        {/* Sub-toolbar */}
        <div className="flex items-center gap-3 flex-wrap mb-2 flex-shrink-0">
          <h3 className="text-xs font-black text-slate-600 uppercase tracking-wide">
            Resumo — {mesLabel}
          </h3>
          {isReady && (
            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
              {rows.length} trabalhadores
            </span>
          )}
          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg font-bold ml-auto">
            Vista partilhada · colunas sincronizadas com admin
          </span>
        </div>

        {/* Tabela — flex-1 preenche o espaço disponível */}
        {!isReady ? (
          <div className="flex-1 flex items-center justify-center gap-3 text-slate-400 bg-white rounded-2xl border border-slate-100">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-sm font-bold">A carregar dados…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 bg-white rounded-2xl border border-slate-100">
            <p className="text-sm font-black uppercase tracking-wide">Sem dados para {mesLabel}</p>
          </div>
        ) : (
          <div
            ref={tableScrollRef}
            className="flex-1 overflow-auto rounded-2xl border border-slate-200 shadow-sm min-h-0"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#6366f1 #e2e8f0' }}
            {...dragProps}
          >
            <table
              className="border-collapse"
              style={{ tableLayout: 'auto', width: '100%', fontSize: '11px' }}
            >
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                {/* Linha de grupos */}
                <tr>
                  {activeCols.map(({ col, ci }, ai) => {
                    const g   = col.group || 'obs';
                    const def = GROUP_DEFS[g] || GROUP_DEFS.obs;
                    const isFirstInGroup = ai === 0 || (activeCols[ai - 1]?.col.group || 'obs') !== g;
                    const isLastInGroup  = ai === activeCols.length - 1 || (activeCols[ai + 1]?.col.group || 'obs') !== g;
                    return (
                      <th
                        key={ci}
                        className="text-[8px] font-black uppercase tracking-widest py-1"
                        style={{
                          background: def.bg, color: def.text,
                          textAlign: isFirstInGroup ? 'left' : 'center',
                          paddingLeft: isFirstInGroup ? '8px' : '0',
                          borderRight: isLastInGroup && def.border ? `2px solid ${def.border}` : isLastInGroup ? '1px solid #1e293b' : 'none',
                          whiteSpace: 'nowrap',
                          minWidth: col.key === 'nome' ? undefined : `${col.w || 64}px`,
                          ...(ai === 0 ? { position: 'sticky', left: 0, zIndex: 12 } : col.key === 'completo' ? { position: 'sticky', right: 0, zIndex: 12 } : {}),
                        }}
                      >
                        {isFirstInGroup ? def.label : ''}
                      </th>
                    );
                  })}
                </tr>
                {/* Linha de colunas */}
                <tr>
                  {activeCols.map(({ col, ci }, ai) => {
                    const g   = col.group || 'obs';
                    const def = GROUP_DEFS[g] || GROUP_DEFS.obs;
                    const isLastInGroup = ai === activeCols.length - 1 || (activeCols[ai + 1]?.col.group || 'obs') !== g;
                    return (
                      <th
                        key={ci}
                        className={`px-1.5 py-2 text-[9px] font-black uppercase tracking-wide leading-tight ${col.highlight ? hlHead(col.highlight) : ''}`}
                        style={{
                          background: col.highlight ? undefined : def.bg,
                          color: col.highlight ? undefined : def.text,
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          borderRight: isLastInGroup && def.border ? `2px solid ${def.border}` : isLastInGroup ? '1px solid #1e293b' : undefined,
                          minWidth: col.key === 'nome' ? undefined : `${col.w || 64}px`,
                          ...(ai === 0 ? { position: 'sticky', left: 0, zIndex: 12 } : col.key === 'completo' ? { position: 'sticky', right: 0, zIndex: 12 } : {}),
                        }}
                      >
                        {col.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className={row.completo ? 'bg-emerald-50' : ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    {activeCols.map(({ col, ci }, ai) => {
                      const g   = col.group || 'obs';
                      const def = GROUP_DEFS[g] || GROUP_DEFS.obs;
                      const isLastInGroup = ai === activeCols.length - 1 || (activeCols[ai + 1]?.col.group || 'obs') !== g;
                      const stickyBg   = row.completo ? '#ecfdf5' : ri % 2 === 0 ? '#ffffff' : '#f8fafc';
                      const isNome     = col.key === 'nome';
                      const isCompleto = col.key === 'completo';
                      const val        = row[col.key] ?? '';

                      return (
                        <td
                          key={ci}
                          className={`px-1.5 py-1.5 font-bold ${col.highlight ? hlCell(col.highlight) : 'text-slate-700'}`}
                          style={{
                            whiteSpace: 'nowrap',
                            textAlign: col.align || 'center',
                            borderRight: isLastInGroup && def.border ? `2px solid ${def.border}` : isLastInGroup ? '1px solid #1e293b' : undefined,
                            minWidth: isNome ? undefined : `${col.w || 64}px`,
                            ...(ai === 0 ? { position: 'sticky', left: 0, zIndex: 5, background: stickyBg, boxShadow: '2px 0 4px -2px rgba(0,0,0,.08)' } : {}),
                            ...(isCompleto ? { position: 'sticky', right: 0, zIndex: 5, background: stickyBg, boxShadow: '-2px 0 4px -2px rgba(0,0,0,.08)' } : {}),
                          }}
                        >
                          {col.tipo === 'toggle' ? (
                            <div className="flex justify-center">
                              <button
                                onClick={() => updateCompleto(row.workerId, !row.completo)}
                                title={row.completo ? 'Desmarcar como completo' : 'Marcar como completo'}
                                className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                                  row.completo
                                    ? 'bg-emerald-500 text-white hover:bg-red-400 shadow-sm'
                                    : 'bg-white border-2 border-slate-300 text-transparent hover:border-emerald-400 hover:text-emerald-400'
                                }`}
                              >
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              </button>
                            </div>
                          ) : col.editable ? (
                            <input
                              type="text"
                              value={obs[row.workerId] || ''}
                              onChange={e => updateObs(row.workerId, e.target.value)}
                              onBlur={e => upsertObs(row.workerId, { observacao: e.target.value })}
                              placeholder="—"
                              className="w-full bg-transparent outline-none text-[10px] font-bold text-slate-600 placeholder-slate-300"
                              style={{ minWidth: 0 }}
                            />
                          ) : col.tipo === 'ajuste' ? (
                            <span style={{ color: (row.ajuste || 0) < 0 ? '#dc2626' : (row.ajuste || 0) > 0 ? '#16a34a' : '#94a3b8' }}>
                              {(row.ajuste || 0) !== 0 ? ((row.ajuste > 0 ? '+' : '') + (row.ajuste || 0).toFixed(2)) : '—'}
                            </span>
                          ) : isNome ? (
                            <span>{val}</span>
                          ) : col.key === 'totalAbonos' && row._brutoNum > 0 ? (() => {
                            const diff = Math.round((row._brutoNum - row._abonosNum) * 100) / 100;
                            return (
                              <span className={`block px-2 ${tdAlign(col)}`}>
                                {val}
                                {Math.abs(diff) >= 0.005 && (
                                  <span className={`block text-[9px] font-bold leading-tight ${diff <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                  </span>
                                )}
                              </span>
                            );
                          })() : (
                            <ExpandCell text={String(val)} maxWidth={`${col.w || 84}px`} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-indigo-300" style={{ position: 'sticky', bottom: 0, zIndex: 9 }}>
                  {activeCols.map(({ col, ci }, ai) => {
                    const g   = col.group || 'obs';
                    const def = GROUP_DEFS[g] || GROUP_DEFS.obs;
                    const isLastInGroup = ai === activeCols.length - 1 || (activeCols[ai + 1]?.col.group || 'obs') !== g;
                    const val = col.sumKey ? rows.reduce((s, r) => s + (r[col.sumKey] || 0), 0) : null;
                    return (
                      <td
                        key={ci}
                        className={`px-1.5 py-2 text-[10px] font-black whitespace-nowrap text-center ${col.highlight ? hlFoot(col.highlight) : 'bg-indigo-50 text-indigo-700'}`}
                        style={{
                          borderRight: isLastInGroup && def.border ? `2px solid ${def.border}` : isLastInGroup ? '1px solid #1e293b' : undefined,
                          ...(ai === 0 ? { position: 'sticky', left: 0, zIndex: 5, background: '#eef2ff' } : {}),
                          ...(col.key === 'completo' ? { position: 'sticky', right: 0, zIndex: 5, background: '#eef2ff' } : {}),
                        }}
                      >
                        {ai === 0 ? 'TOTAIS'
                          : col.tipo === 'toggle' ? `${rows.filter(r => r.completo).length}/${rows.length} ✓`
                          : val !== null ? val.toFixed(2) : ''}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Aviso abaixo da tabela */}
        <p className="flex-shrink-0 text-center text-[10px] text-slate-400 font-bold pt-2">
          Estimativa não oficial · Valores calculados com base nas tabelas IRS {ano} e TSU em vigor · Confirme sempre no TOConline
        </p>
      </div>
    </div>
  );
}
