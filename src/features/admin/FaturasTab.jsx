import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  X, Loader2, Download, FileText, MessageSquare, Undo2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

function fmtEur(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtData(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('pt-PT'); } catch { return d; }
}

function FaturaFornecedorCard({ fornecedor, faturas, justificacoes, onJustificar, onRemoverJustificacao }) {
  const [open, setOpen] = useState(false);

  const pendingCount = faturas.filter(f =>
    f.status !== 'PAGO' && !justificacoes.some(j => j.fatura_id === f.id)
  ).length;
  const allOk = pendingCount === 0;

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${allOk ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <span className="text-sm font-bold text-slate-800">{fornecedor}</span>
          <span className="text-[10px] text-slate-400">{faturas.length} fatura(s)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-black uppercase tracking-widest ${allOk ? 'text-emerald-600' : 'text-amber-600'}`}>
            {allOk ? 'Tudo Ok' : `${pendingCount} pendente(s)`}
          </span>
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-slate-100 bg-slate-50">
          {faturas.map(f => {
            const isPago = f.status === 'PAGO';
            const justEntry = justificacoes.find(j => j.fatura_id === f.id);
            const isJustified = !!justEntry;
            const displayStatus = isPago ? 'Pago' : isJustified ? 'Justificado' : 'Pendente';
            const badgeClass = isPago || isJustified
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700';

            return (
              <div key={f.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {f.dados?.numero_fatura || '—'}
                    </span>
                    <span className="text-[10px] text-slate-400">{fmtData(f.dados?.data_fatura)}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${badgeClass}`}>
                      {isPago || isJustified ? <CheckCircle size={9} /> : <AlertCircle size={9} />}
                      {displayStatus}
                    </span>
                    {isJustified && (
                      <>
                        <span className="text-[9px] text-slate-400 italic max-w-[180px] truncate" title={justEntry.justification}>
                          "{justEntry.justification}"
                        </span>
                        <button
                          onClick={() => onRemoverJustificacao(f.id)}
                          className="flex items-center gap-0.5 px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                          title="Desfazer justificação"
                        >
                          <Undo2 size={9} /> Desfazer
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[12px] font-bold text-slate-700">{fmtEur(f.dados?.valor_total)}</span>
                    {!isPago && !isJustified && (
                      <button
                        onClick={() => onJustificar({ fatura_id: f.id, fornecedor, numero: f.dados?.numero_fatura, valor: f.dados?.valor_total })}
                        className="flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                      >
                        <MessageSquare size={9} /> Justificar
                      </button>
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

export default function FaturasTab() {
  const { supabase } = useApp();

  const [faturas, setFaturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [justificacoes, setJustificacoes] = useState([]);
  const [justModal, setJustModal] = useState(null); // { fatura_id, fornecedor, numero, valor }
  const [justText, setJustText] = useState('');
  const [justSaving, setJustSaving] = useState(false);
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
      const [{ data: fat }, { data: just }] = await Promise.all([
        supabase.from('faturas').select('*').order('importado_em', { ascending: false }),
        supabase.from('fatura_justifications').select('fatura_id, justification'),
      ]);
      setFaturas(fat || []);
      setJustificacoes(just || []);
      setLoading(false);
    };
    init();
  }, []);

  // Agrupamento por fornecedor
  const grupos = faturas.reduce((acc, f) => {
    const key = f.dados?.fornecedor || 'Sem Fornecedor';
    (acc[key] = acc[key] || []).push(f);
    return acc;
  }, {});

  // KPIs
  const totalFaturas = faturas.length;
  const pagas = faturas.filter(f =>
    f.status === 'PAGO' || justificacoes.some(j => j.fatura_id === f.id)
  ).length;
  const pendentesEfectivos = faturas.filter(f =>
    f.status !== 'PAGO' && !justificacoes.some(j => j.fatura_id === f.id)
  ).length;

  // Total valor pendente
  const totalPendente = faturas
    .filter(f => f.status !== 'PAGO' && !justificacoes.some(j => j.fatura_id === f.id))
    .reduce((s, f) => s + (parseFloat(f.dados?.valor_total) || 0), 0);

  // ── Relatórios ────────────────────────────────────────────────────────────────
  const buildRows = () =>
    faturas.map(f => {
      const justEntry = justificacoes.find(j => j.fatura_id === f.id);
      const status = f.status === 'PAGO' ? 'Pago' : justEntry ? 'Justificado' : 'Pendente';
      return [
        f.dados?.fornecedor || 'Sem Fornecedor',
        f.dados?.numero_fatura || '—',
        fmtData(f.dados?.data_fatura),
        fmtEur(f.dados?.valor_total),
        status,
        justEntry?.justification || '',
      ];
    });

  const handleExportCsv = () => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Fornecedor', 'Nº Fatura', 'Data', 'Valor (€)', 'Status', 'Justificação'].map(esc).join(';');
    const rows = buildRows().map(r => r.map(esc).join(';'));
    const totRow = ['"Total Pendente"', '""', '""', `"${fmtEur(totalPendente)}"`, '""', '""'].join(';');
    const blob = new Blob(['﻿' + [header, ...rows, '', totRow].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'faturas_validacao.csv'; a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text('Relatório de Faturas', 14, 18);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')}`, 14, 24);
    autoTable(doc, {
      startY: 30,
      head: [['Fornecedor', 'Nº Fatura', 'Data', 'Valor (€)', 'Status', 'Justificação']],
      body: buildRows(),
      styles: { fontSize: 6.5, cellPadding: 1.3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 5: { cellWidth: 55 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const v = data.cell.raw;
          if (v === 'Pago' || v === 'Justificado') data.cell.styles.textColor = [5, 150, 105];
          else if (v === 'Pendente') data.cell.styles.textColor = [217, 119, 6];
        }
      },
    });
    const lastY = doc.lastAutoTable?.finalY ?? 30;
    doc.setFontSize(9);
    doc.setTextColor(30);
    doc.text(`Total Pendente: ${fmtEur(totalPendente)}`, 14, lastY + 10);
    doc.save('faturas_validacao.pdf');
    setShowExportMenu(false);
  };

  // ── Justificação ──────────────────────────────────────────────────────────────
  const handleSaveJustificacao = async () => {
    if (!justText.trim() || !justModal) return;
    setJustSaving(true);
    const { data, error } = await supabase
      .from('fatura_justifications')
      .upsert({ fatura_id: justModal.fatura_id, justification: justText.trim() }, { onConflict: 'fatura_id' })
      .select('fatura_id, justification')
      .single();
    if (!error && data) {
      setJustificacoes(prev => {
        const filtered = prev.filter(j => j.fatura_id !== data.fatura_id);
        return [...filtered, data];
      });
    }
    setJustSaving(false);
    setJustModal(null);
    setJustText('');
  };

  const handleRemoverJustificacao = async (fatura_id) => {
    await supabase.from('fatura_justifications').delete().eq('fatura_id', fatura_id);
    setJustificacoes(prev => prev.filter(j => j.fatura_id !== fatura_id));
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
        <p className="text-[11px] text-slate-400">A carregar faturas…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header: KPIs + exportar */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Faturas',    value: totalFaturas,      color: 'text-slate-700',  bg: 'bg-slate-50' },
            { label: 'Pagas',      value: pagas,             color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Pendentes',  value: pendentesEfectivos, color: 'text-amber-700',  bg: 'bg-amber-50' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-2xl px-4 py-3 text-center`}>
              <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Exportar dropdown */}
        <div className="relative self-start sm:flex-shrink-0" ref={exportRef}>
          <button
            onClick={() => setShowExportMenu(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Download size={13} /> Exportar
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 py-1 z-20 min-w-[130px] max-w-[calc(100vw-2rem)]">
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

      {/* Lista por fornecedor */}
      {Object.keys(grupos).length === 0 ? (
        <p className="text-center text-slate-400 py-8 text-sm">Nenhuma fatura encontrada.</p>
      ) : (
        Object.entries(grupos)
          .sort(([a], [b]) => a.localeCompare(b, 'pt'))
          .map(([fornecedor, fats]) => (
            <FaturaFornecedorCard
              key={fornecedor}
              fornecedor={fornecedor}
              faturas={fats}
              justificacoes={justificacoes}
              onJustificar={setJustModal}
              onRemoverJustificacao={handleRemoverJustificacao}
            />
          ))
      )}

      {/* Total pendente */}
      {totalPendente > 0.01 && (
        <div className="mt-2 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-center justify-between">
          <p className="text-[9px] font-black uppercase tracking-widest text-amber-500">Total em Aberto</p>
          <p className="text-xl font-black text-amber-700">{fmtEur(totalPendente)}</p>
        </div>
      )}

      {/* Modal: justificar fatura */}
      {justModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-black text-slate-800">Justificar Fatura Pendente</h3>
              <button onClick={() => { setJustModal(null); setJustText(''); }} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <div className="bg-amber-50 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Fatura pendente</p>
              <p className="text-sm font-bold text-slate-800">{justModal.fornecedor}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Nº {justModal.numero || '—'} · Valor: <strong className="text-red-600">{fmtEur(justModal.valor)}</strong>
              </p>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                Justificação
              </label>
              <textarea
                value={justText}
                onChange={e => setJustText(e.target.value)}
                placeholder="Ex: Pago em numerário, acordado com fornecedor, aguarda crédito…"
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
