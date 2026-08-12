import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight, FileSpreadsheet, ShieldAlert } from 'lucide-react';
import { MESES_PT } from '../../lib/payroll/reciboCalculations.js';
import { RESUMO_COLS, GROUP_DEFS } from '../../lib/payroll/resumoCols.js';
import { useDragScroll } from '../../lib/useDragScroll.js';

const EMPRESA = { nome: 'Magnetic Place Unipessoal, Lda', nif: '517379740' };

// Cliente Supabase (anon key) usado EXCLUSIVAMENTE para subscrições em tempo
// real a `resumo_config` e `resumo_observacoes` — as únicas duas tabelas deste
// fluxo com RLS aberta e sem dados pessoais sensíveis. NUNCA usar este cliente
// para .from('workers'/'clients'/'logs'/'worker_valorhora_history') — esses
// dados vêm só de api/contador-resumo.js, server-side, com o token validado.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const sbRealtime = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function parseMes(str) {
  const [a, m] = (str || '').split('-');
  return { ano: parseInt(a) || new Date().getFullYear(), mes: parseInt(m) || new Date().getMonth() + 1 };
}
function toMesStr(ano, mes) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

async function callContadorResumo(payload) {
  const res = await fetch('/api/contador-resumo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
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

function AcessoInvalido({ mensagem }) {
  return (
    <div className="h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 max-w-md text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={22} />
        </div>
        <h1 className="font-black text-slate-800 text-lg mb-2">Acesso inválido</h1>
        <p className="text-sm text-slate-500 font-medium leading-relaxed">
          {mensagem || 'Este link não é válido ou foi revogado. Contacte a Magnetic Place para obter um novo link.'}
        </p>
      </div>
    </div>
  );
}

export default function ResumoMensalPublico() {
  const params  = new URLSearchParams(window.location.search);
  const token   = params.get('token') || '';
  const inicial = params.get('mes') || toMesStr(new Date().getFullYear(), new Date().getMonth() + 1);
  const { ano: a0, mes: m0 } = parseMes(inicial);

  const [ano, setAno] = useState(a0);
  const [mes, setMes] = useState(m0);

  const [rows,        setRows]        = useState([]);
  const [visibleCols, setVisibleCols] = useState(() => new Set(RESUMO_COLS.map((_, i) => i)));

  const [loading,     setLoading]     = useState(true);
  const [saveStatus,  setSaveStatus]  = useState(null);
  const [dataError,   setDataError]   = useState(null);
  const [acessoNegado, setAcessoNegado] = useState(null); // null = a validar, string = mensagem, false = válido
  const [copiedCell,  setCopiedCell]  = useState(null);
  const { ref: tableScrollRef, dragProps } = useDragScroll();

  const copyCell = (ri, ci, text) => {
    if (text === '' || text == null || !navigator.clipboard) return;
    navigator.clipboard.writeText(String(text)).then(() => {
      const key = `${ri}-${ci}`;
      setCopiedCell(key);
      setTimeout(() => setCopiedCell(prev => (prev === key ? null : prev)), 900);
    }).catch(() => {});
  };
  const handleCellClick = (e, ri, ci, text) => {
    if (e.target.closest('input, button')) return;
    copyCell(ri, ci, text);
  };

  const ms = toMesStr(ano, mes);

  // Sem token na URL — nem sequer tenta carregar dados
  useEffect(() => {
    if (!token) setAcessoNegado('Este link está incompleto — falta o token de acesso.');
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setDataError(null);
    callContadorResumo({ token, action: 'get', mes: ms }).then(({ ok, status, data }) => {
      if (!ok) {
        if (status === 401 || status === 403) setAcessoNegado(data.error || 'Acesso inválido.');
        else setDataError(data.error || 'Erro ao carregar dados.');
        setLoading(false);
        return;
      }
      setAcessoNegado(false);
      setRows(data.rows || []);
      if (Array.isArray(data.visibleCols)) setVisibleCols(new Set(data.visibleCols));
      setLoading(false);
    });
  }, [token, ms]);

  // Tempo real — colunas visíveis sincronizadas com o admin (só resumo_config)
  useEffect(() => {
    if (!sbRealtime) return;
    const parseValor = v => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
      return null;
    };
    const ch = sbRealtime.channel('pub_config_cols')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resumo_config' },
        ({ new: row }) => {
          if (row?.chave !== 'visible_cols') return;
          const arr = parseValor(row?.valor);
          if (arr) setVisibleCols(new Set(arr));
        })
      .subscribe();
    return () => { sbRealtime.removeChannel(ch); };
  }, []);

  // Tempo real — observação/completo/ajuste editados no admin para o mês atual
  // (só resumo_observacoes, filtrado por mes=eq.${ms})
  useEffect(() => {
    if (!sbRealtime) return;
    const channel = sbRealtime.channel(`pub_obs_${ms}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'resumo_observacoes', filter: `mes=eq.${ms}`,
      }, ({ new: row, eventType }) => {
        if (!row?.worker_id) return;
        const apagado = eventType === 'DELETE';
        setRows(prev => prev.map(r => {
          if (r.workerId !== row.worker_id) return r;
          const ajusteVal = apagado ? 0 : (parseFloat(row.ajuste_bruto) || 0);
          return {
            ...r,
            observacao: apagado ? '' : (row.observacao || ''),
            completo: apagado ? false : !!row.completo,
            ajuste: ajusteVal,
            _ajusteNum: ajusteVal,
          };
        }));
      })
      .subscribe();
    return () => { sbRealtime.removeChannel(channel); };
  }, [ms]);

  function navMes(dir) {
    let m = mes + dir, a = ano;
    if (m > 12) { m = 1; a++; }
    if (m < 1)  { m = 12; a--; }
    setMes(m); setAno(a);
    window.history.replaceState(null, '', `?token=${encodeURIComponent(token)}&mes=${toMesStr(a, m)}`);
  }

  const updateObs = (workerId, patch) => {
    setRows(prev => prev.map(r => r.workerId === workerId ? { ...r, ...patch } : r));
    setSaveStatus('saving');
    const row = rows.find(r => r.workerId === workerId) || {};
    callContadorResumo({
      token, action: 'upsert_obs', mes: ms, worker_id: workerId,
      observacao: patch.observacao ?? row.observacao ?? '',
      completo: patch.completo ?? row.completo ?? false,
      ajuste_bruto: row._ajusteNum || 0,
    }).then(({ ok, data }) => {
      setSaveStatus(ok ? 'ok' : 'error');
      if (!ok) setDataError(data.error || 'Erro ao guardar.');
      setTimeout(() => setSaveStatus(null), 2500);
    });
  };

  const mesLabel   = `${MESES_PT[mes] || ''} ${ano}`;
  const isReady    = acessoNegado === false && !loading;
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

  if (acessoNegado) return <AcessoInvalido mensagem={acessoNegado} />;

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
          {isReady && !saveStatus  && <span className="text-[10px] text-slate-400">{rows.length} trabalhadores</span>}
          <button
            onClick={exportXLS}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase bg-emerald-600 text-white hover:bg-emerald-700 transition-all border border-emerald-600 shadow-sm"
          >
            <FileSpreadsheet size={13} /> XLS
          </button>
        </div>
      </div>

      {/* Banner erro */}
      {dataError && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-800 flex-shrink-0">
          <strong>⚠️ Erro:</strong> {dataError}
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
            Vista partilhada · acesso registado
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
            className="scroll-marca flex-1 overflow-auto rounded-2xl border border-slate-200 shadow-sm min-h-0"
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

                      const cellKey = `${ri}-${ci}`;
                      const isCopied = copiedCell === cellKey;
                      const canCopy  = col.tipo !== 'toggle';
                      return (
                        <td
                          key={ci}
                          onClick={canCopy ? e => handleCellClick(e, ri, ci, val) : undefined}
                          title={canCopy ? (isCopied ? 'Copiado!' : 'Clique para copiar') : undefined}
                          className={`px-1.5 py-[3px] font-bold ${col.highlight ? hlCell(col.highlight) : 'text-slate-700'} ${canCopy ? 'cursor-pointer' : ''}`}
                          style={{
                            position: 'relative',
                            whiteSpace: 'nowrap',
                            textAlign: col.align || 'center',
                            borderRight: isLastInGroup && def.border ? `2px solid ${def.border}` : isLastInGroup ? '1px solid #1e293b' : undefined,
                            minWidth: isNome ? undefined : `${col.w || 64}px`,
                            ...(ai === 0 ? { position: 'sticky', left: 0, zIndex: 5, background: stickyBg, boxShadow: '2px 0 4px -2px rgba(0,0,0,.08)' } : {}),
                            ...(isCompleto ? { position: 'sticky', right: 0, zIndex: 5, background: stickyBg, boxShadow: '-2px 0 4px -2px rgba(0,0,0,.08)' } : {}),
                            ...(isCopied ? { background: 'rgba(16,185,129,0.22)' } : {}),
                          }}
                        >
                          {isCopied && (
                            <span
                              className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wide shadow-md pointer-events-none whitespace-nowrap"
                              style={{ zIndex: 20 }}
                            >
                              Copiado!
                            </span>
                          )}
                          {col.tipo === 'toggle' ? (
                            <div className="flex justify-center">
                              <button
                                onClick={() => updateObs(row.workerId, { completo: !row.completo })}
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
                              value={row.observacao || ''}
                              onChange={e => setRows(prev => prev.map(r => r.workerId === row.workerId ? { ...r, observacao: e.target.value } : r))}
                              onBlur={e => updateObs(row.workerId, { observacao: e.target.value })}
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
