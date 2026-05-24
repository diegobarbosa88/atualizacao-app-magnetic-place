import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  X, Loader2, Download, FileText, MessageSquare, Undo2,
  ArrowLeftRight, Link,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

const MESES = { '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez' };

function fmtEur(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtMes(yyyymm) {
  if (!yyyymm) return '—';
  const [ano, mm] = yyyymm.split('-');
  return `${MESES[mm] || mm} ${ano}`;
}

function txKey(tx) {
  return `${tx.data}|${tx.descricao}|${tx.valor}`;
}

function clienteLink(tx, pagamentos) {
  return pagamentos?.find(p =>
    p.transaction_data?.data === tx.data &&
    p.transaction_data?.descricao === tx.descricao &&
    String(p.transaction_data?.valor) === String(tx.valor)
  );
}

function statusTx(tx, pagamentos, justificacoes, internos, notasCredito) {
  const key = txKey(tx);
  if (clienteLink(tx, pagamentos)) return 'Com Cliente';
  if (notasCredito?.some(n => n.tx_key === key)) return 'Nota Crédito';
  if (internos?.some(i => i.tx_key === key)) return 'Interno';
  if (justificacoes?.some(j => j.tx_key === key)) return 'Justificado';
  return 'Sem Cliente';
}

const STATUS_CFG = {
  'Com Cliente':  { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
  'Nota Crédito': { bg: 'bg-blue-100',    text: 'text-blue-700',    icon: Link },
  'Interno':      { bg: 'bg-purple-100',  text: 'text-purple-700',  icon: ArrowLeftRight },
  'Justificado':  { bg: 'bg-violet-100',  text: 'text-violet-700',  icon: MessageSquare },
  'Sem Cliente':  { bg: 'bg-amber-100',   text: 'text-amber-700',   icon: AlertCircle },
};

function EntradaMesCard({ mes, txs, pagamentos, justificacoes, internos, notasCredito, clients, onJustificar, onRemoverJustificacao, onMarcarInterno, onDesfazerInterno, onNotaCredito, onDesfazerNotaCredito }) {
  const [open, setOpen] = useState(false);
  const semCliente = txs.filter(tx => statusTx(tx, pagamentos, justificacoes, internos, notasCredito) === 'Sem Cliente').length;
  const allOk = semCliente === 0;
  const totalMes = txs.reduce((s, tx) => s + (parseFloat(tx.valor) || 0), 0);

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${allOk ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <span className="text-sm font-bold text-slate-800">{fmtMes(mes)}</span>
          <span className="text-[10px] text-slate-400">{txs.length} transacção(ões)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-black text-slate-600">{fmtEur(totalMes)}</span>
          <span className={`text-[10px] font-black uppercase tracking-widest ${allOk ? 'text-emerald-600' : 'text-amber-600'}`}>
            {allOk ? 'Tudo Ok' : `${semCliente} s/ resolver`}
          </span>
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-slate-100 bg-slate-50">
          {txs.map((tx, i) => {
            const status = statusTx(tx, pagamentos, justificacoes, internos, notasCredito);
            const key = txKey(tx);
            const link = clienteLink(tx, pagamentos);
            const clientName = link ? (clients?.find(c => c.id === link.client_id)?.name || link.client_id) : null;
            const justEntry = justificacoes.find(j => j.tx_key === key);
            const ncEntry = notasCredito.find(n => n.tx_key === key);
            const ncClientName = ncEntry ? (clients?.find(c => c.id === ncEntry.client_id)?.name || ncEntry.client_id) : null;
            const cfg = STATUS_CFG[status] || STATUS_CFG['Sem Cliente'];
            const Icon = cfg.icon;

            return (
              <div key={i} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tx.data}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
                        <Icon size={9} /> {status}
                      </span>

                      {status === 'Com Cliente' && clientName && (
                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{clientName}</span>
                      )}
                      {status === 'Nota Crédito' && ncClientName && (
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          {ncClientName} · {fmtMes(ncEntry.period)}
                        </span>
                      )}
                      {status === 'Justificado' && (
                        <span className="text-[9px] text-slate-400 italic max-w-[200px] truncate" title={justEntry?.justification}>
                          "{justEntry?.justification}"
                        </span>
                      )}

                      {status === 'Nota Crédito' && (
                        <button onClick={() => onDesfazerNotaCredito(tx)}
                          className="flex items-center gap-0.5 px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">
                          <Undo2 size={9} /> Desfazer
                        </button>
                      )}
                      {status === 'Interno' && (
                        <button onClick={() => onDesfazerInterno(tx)}
                          className="flex items-center gap-0.5 px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">
                          <Undo2 size={9} /> Desfazer
                        </button>
                      )}
                      {status === 'Justificado' && (
                        <button onClick={() => onRemoverJustificacao(tx)}
                          className="flex items-center gap-0.5 px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">
                          <Undo2 size={9} /> Desfazer
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate max-w-sm" title={tx.descricao}>{tx.descricao}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[12px] font-bold text-emerald-700">{fmtEur(tx.valor)}</span>
                    {status === 'Sem Cliente' && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => onMarcarInterno(tx)}
                          className="flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors">
                          <ArrowLeftRight size={9} /> Interno
                        </button>
                        <button onClick={() => onNotaCredito(tx)}
                          className="flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
                          <Link size={9} /> N. Crédito
                        </button>
                        <button onClick={() => onJustificar(tx)}
                          className="flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors">
                          <MessageSquare size={9} /> Justificar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EntradasTab() {
  const { supabase, clients } = useApp();

  const [creditos, setCreditos] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [justificacoes, setJustificacoes] = useState([]);
  const [internos, setInternos] = useState([]);
  const [notasCredito, setNotasCredito] = useState([]);
  const [runId, setRunId] = useState(null);
  const [runData, setRunData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [justModal, setJustModal] = useState(null);
  const [justText, setJustText] = useState('');
  const [justSaving, setJustSaving] = useState(false);

  const [ncModal, setNcModal] = useState(null);
  const [ncClientId, setNcClientId] = useState('');
  const [ncPeriod, setNcPeriod] = useState('');
  const [ncNotas, setNcNotas] = useState('');
  const [ncSaving, setNcSaving] = useState(false);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!supabase) return;
      setLoading(true);

      const { data: run } = await supabase
        .from('reconciliation_runs')
        .select('id, transactions_json, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!run) { setLoading(false); return; }

      const rid = run.id;
      setRunId(rid);
      setRunData(run);

      const creds = (run.transactions_json || []).filter(t => t.tipo === 'credito');
      setCreditos(creds);

      const [{ data: pags }, { data: just }, { data: ints }, { data: ncs }] = await Promise.all([
        supabase.from('faturacao_clientes_pagamentos').select('transaction_data, client_id, period').eq('reconciliation_run_id', rid),
        supabase.from('entrada_justifications').select('tx_key, justification').eq('run_id', rid),
        supabase.from('entrada_internos').select('tx_key').eq('run_id', rid),
        supabase.from('entrada_nota_credito_links').select('tx_key, client_id, period, notas').eq('run_id', rid),
      ]);
      setPagamentos(pags || []);
      setJustificacoes(just || []);
      setInternos(ints || []);
      setNotasCredito(ncs || []);
      setLoading(false);
    };
    init();
  }, []);

  const grupos = creditos.reduce((acc, tx) => {
    const mes = (tx.data || '').substring(0, 7) || 'Desconhecido';
    (acc[mes] = acc[mes] || []).push(tx);
    return acc;
  }, {});

  const totalResolvido = creditos.filter(tx => statusTx(tx, pagamentos, justificacoes, internos, notasCredito) !== 'Sem Cliente').length;
  const semCliente = creditos.filter(tx => statusTx(tx, pagamentos, justificacoes, internos, notasCredito) === 'Sem Cliente').length;
  const totalRecebido = creditos.reduce((s, tx) => s + (parseFloat(tx.valor) || 0), 0);

  // ── Exportar ──────────────────────────────────────────────────────────────────
  const buildRows = () =>
    creditos.map(tx => {
      const status = statusTx(tx, pagamentos, justificacoes, internos, notasCredito);
      const key = txKey(tx);
      const link = clienteLink(tx, pagamentos);
      const clientName = link ? (clients?.find(c => c.id === link.client_id)?.name || link.client_id || '') : '';
      const ncEntry = notasCredito.find(n => n.tx_key === key);
      const ncClientName = ncEntry ? (clients?.find(c => c.id === ncEntry.client_id)?.name || ncEntry.client_id || '') : '';
      const justEntry = justificacoes.find(j => j.tx_key === key);
      const detalhe = status === 'Com Cliente' ? clientName
        : status === 'Nota Crédito' ? `${ncClientName} · ${fmtMes(ncEntry?.period)}`
        : status === 'Justificado' ? (justEntry?.justification || '')
        : '';
      return [tx.data, tx.descricao || '', fmtEur(tx.valor), status, detalhe];
    });

  const handleExportCsv = () => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Data', 'Descrição', 'Valor (€)', 'Status', 'Detalhe'].map(esc).join(';');
    const rows = buildRows().map(r => r.map(esc).join(';'));
    const totRow = ['"Total Recebido"', '""', `"${fmtEur(totalRecebido)}"`, '""', '""'].join(';');
    const blob = new Blob(['﻿' + [header, ...rows, '', totRow].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'entradas_validacao.csv'; a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14); doc.setTextColor(30);
    doc.text('Relatório de Entradas (Créditos)', 14, 18);
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} · Extrato: ${runData?.created_at ? new Date(runData.created_at).toLocaleDateString('pt-PT') : '—'}`, 14, 24);
    autoTable(doc, {
      startY: 30,
      head: [['Data', 'Descrição', 'Valor (€)', 'Status', 'Detalhe']],
      body: buildRows(),
      styles: { fontSize: 6.5, cellPadding: 1.3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 1: { cellWidth: 60 }, 4: { cellWidth: 50 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const v = data.cell.raw;
          if (v === 'Com Cliente' || v === 'Nota Crédito') data.cell.styles.textColor = [5, 150, 105];
          else if (v === 'Interno' || v === 'Justificado') data.cell.styles.textColor = [99, 102, 241];
          else if (v === 'Sem Cliente') data.cell.styles.textColor = [217, 119, 6];
        }
      },
    });
    const lastY = doc.lastAutoTable?.finalY ?? 30;
    doc.setFontSize(9); doc.setTextColor(30);
    doc.text(`Total Recebido: ${fmtEur(totalRecebido)}`, 14, lastY + 10);
    doc.save('entradas_validacao.pdf');
    setShowExportMenu(false);
  };

  // ── Acções: Interno ───────────────────────────────────────────────────────────
  const handleMarcarInterno = async (tx) => {
    if (!runId) return;
    const key = txKey(tx);
    const { error } = await supabase
      .from('entrada_internos')
      .upsert({ run_id: runId, tx_key: key }, { onConflict: 'run_id,tx_key' });
    if (!error) setInternos(prev => [...prev.filter(i => i.tx_key !== key), { tx_key: key }]);
  };

  const handleDesfazerInterno = async (tx) => {
    const key = txKey(tx);
    await supabase.from('entrada_internos').delete().eq('run_id', runId).eq('tx_key', key);
    setInternos(prev => prev.filter(i => i.tx_key !== key));
  };

  // ── Acções: Nota de Crédito ───────────────────────────────────────────────────
  const handleOpenNotaCredito = (tx) => {
    const mes = (tx.data || '').substring(0, 7);
    setNcModal(tx);
    setNcClientId('');
    setNcPeriod(mes);
    setNcNotas('');
  };

  const handleSaveNotaCredito = async () => {
    if (!ncClientId || !ncPeriod || !ncModal || !runId) return;
    setNcSaving(true);
    const key = txKey(ncModal);
    const { data, error } = await supabase
      .from('entrada_nota_credito_links')
      .upsert(
        { run_id: runId, tx_key: key, client_id: ncClientId, period: ncPeriod, notas: ncNotas.trim() || null },
        { onConflict: 'run_id,tx_key' }
      )
      .select('tx_key, client_id, period, notas')
      .single();
    if (!error && data) {
      setNotasCredito(prev => [...prev.filter(n => n.tx_key !== data.tx_key), data]);
    }
    setNcSaving(false);
    setNcModal(null);
  };

  const handleDesfazerNotaCredito = async (tx) => {
    const key = txKey(tx);
    await supabase.from('entrada_nota_credito_links').delete().eq('run_id', runId).eq('tx_key', key);
    setNotasCredito(prev => prev.filter(n => n.tx_key !== key));
  };

  // ── Acções: Justificação ──────────────────────────────────────────────────────
  const handleSaveJustificacao = async () => {
    if (!justText.trim() || !justModal || !runId) return;
    setJustSaving(true);
    const key = txKey(justModal);
    const { data, error } = await supabase
      .from('entrada_justifications')
      .upsert({ run_id: runId, tx_key: key, justification: justText.trim() }, { onConflict: 'run_id,tx_key' })
      .select('tx_key, justification')
      .single();
    if (!error && data) {
      setJustificacoes(prev => [...prev.filter(j => j.tx_key !== data.tx_key), data]);
    }
    setJustSaving(false);
    setJustModal(null);
    setJustText('');
  };

  const handleRemoverJustificacao = async (tx) => {
    const key = txKey(tx);
    await supabase.from('entrada_justifications').delete().eq('run_id', runId).eq('tx_key', key);
    setJustificacoes(prev => prev.filter(j => j.tx_key !== key));
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
        <p className="text-[11px] text-slate-400">A carregar créditos do extrato…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header: KPIs + exportar */}
      <div className="flex items-start justify-between gap-3">
        <div className="grid grid-cols-3 gap-3 flex-1">
          {[
            { label: 'Total Créditos', value: creditos.length,   color: 'text-slate-700',   bg: 'bg-slate-50' },
            { label: 'Resolvidos',     value: totalResolvido,    color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Por Resolver',   value: semCliente,        color: 'text-amber-700',   bg: 'bg-amber-50' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-2xl px-4 py-3 text-center`}>
              <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="relative flex-shrink-0" ref={exportRef}>
          <button
            onClick={() => setShowExportMenu(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Download size={13} /> Exportar
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 py-1 z-20 min-w-[130px]">
              <button onClick={handleExportCsv}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                <FileText size={13} className="text-emerald-600" /> CSV
              </button>
              <button onClick={handleExportPdf}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                <FileText size={13} className="text-rose-500" /> PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {runData && (
        <p className="text-[10px] text-slate-400">
          Extrato importado em {new Date(runData.created_at).toLocaleDateString('pt-PT')} · {creditos.length} créditos
        </p>
      )}

      {/* Lista por mês */}
      {Object.keys(grupos).length === 0 ? (
        <p className="text-center text-slate-400 py-8 text-sm">Nenhum crédito encontrado no último extrato.</p>
      ) : (
        Object.entries(grupos)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([mes, txs]) => (
            <EntradaMesCard
              key={mes}
              mes={mes}
              txs={txs}
              pagamentos={pagamentos}
              justificacoes={justificacoes}
              internos={internos}
              notasCredito={notasCredito}
              clients={clients}
              onJustificar={tx => { setJustModal(tx); setJustText(''); }}
              onRemoverJustificacao={handleRemoverJustificacao}
              onMarcarInterno={handleMarcarInterno}
              onDesfazerInterno={handleDesfazerInterno}
              onNotaCredito={handleOpenNotaCredito}
              onDesfazerNotaCredito={handleDesfazerNotaCredito}
            />
          ))
      )}

      {/* Total recebido */}
      {totalRecebido > 0 && (
        <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 flex items-center justify-between">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Total Recebido</p>
          <p className="text-xl font-black text-emerald-700">{fmtEur(totalRecebido)}</p>
        </div>
      )}

      {/* Modal: Nota de Crédito */}
      {ncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-black text-slate-800">Ligar a Nota de Crédito</h3>
              <button onClick={() => setNcModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <div className="bg-blue-50 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Transacção</p>
              <p className="text-sm font-bold text-slate-800">{fmtEur(ncModal.valor)}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{ncModal.data}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 break-all">{ncModal.descricao}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                  Cliente
                </label>
                <select
                  value={ncClientId}
                  onChange={e => setNcClientId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                >
                  <option value="">— Selecionar cliente —</option>
                  {(clients || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                  Mês de referência
                </label>
                <input
                  type="month"
                  value={ncPeriod}
                  onChange={e => setNcPeriod(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                  Notas (opcional)
                </label>
                <input
                  type="text"
                  value={ncNotas}
                  onChange={e => setNcNotas(e.target.value)}
                  placeholder="Ex: Nota de crédito nº 42, pagamento parcial…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setNcModal(null)}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!ncClientId || !ncPeriod || ncSaving}
                onClick={handleSaveNotaCredito}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {ncSaving ? <Loader2 size={13} className="animate-spin" /> : <Link size={13} />} Ligar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Justificação */}
      {justModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-black text-slate-800">Justificar Entrada Sem Cliente</h3>
              <button onClick={() => { setJustModal(null); setJustText(''); }} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <div className="bg-amber-50 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Transacção</p>
              <p className="text-sm font-bold text-slate-800">{fmtEur(justModal.valor)}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{justModal.data}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 break-all">{justModal.descricao}</p>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                Justificação
              </label>
              <textarea
                value={justText}
                onChange={e => setJustText(e.target.value)}
                placeholder="Ex: Juro bancário, reembolso de despesa, transferência interna…"
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setJustModal(null); setJustText(''); }}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!justText.trim() || justSaving}
                onClick={handleSaveJustificacao}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {justSaving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Marcar Ok
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
