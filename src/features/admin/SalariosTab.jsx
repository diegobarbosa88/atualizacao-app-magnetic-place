import React, { useState, useEffect, useRef, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CheckCircle, AlertCircle, ChevronDown, ChevronUp, X, Loader2, Download, FileText, MessageSquare, Undo2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { runReconciliacaoSalarial } from '../../utils/reconciliacaoSalarialEngine';

const MESES_PT_SAL = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

const ESTADO_BADGE = {
  valido:   'bg-emerald-100 text-emerald-700',
  aviso:    'bg-yellow-100 text-yellow-700',
  invalido: 'bg-amber-100 text-amber-700',
};
const ESTADO_PT = {
  valido:   'Match Exato',
  aviso:    'Justificado',
  invalido: 'Saldo Pendente',
};

function fmtEur(v) {
  return (parseFloat(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtMes(month) {
  const [ano, mm] = month.split('-');
  return `${MESES_PT_SAL[mm]} ${ano}`;
}

function SalarioEmployeeCard({ employee, justificacoes, onJustificar, onRemoverJustificacao, tolerancia = 0.01 }) {
  const [open, setOpen] = React.useState(false);
  const justifiedMonths = employee.months.filter(m =>
    justificacoes.some(j => j.employee_name === employee.employee_name && j.month === m.month)
  ).length;
  const pendingMonths = employee.months.filter(m =>
    m.status !== 'Match Exato' &&
    !justificacoes.some(j => j.employee_name === employee.employee_name && j.month === m.month)
  ).length;
  const allOk = pendingMonths === 0;

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${allOk ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <span className="text-sm font-bold text-slate-800">{employee.employee_name}</span>
          <span className="text-[10px] text-slate-400">{employee.months.length} mês(es)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-black uppercase tracking-widest ${allOk ? 'text-emerald-600' : 'text-amber-600'}`}>
            {allOk ? 'Tudo Ok' : `${pendingMonths} pendente(s)`}
          </span>
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="divide-y divide-slate-100 bg-slate-50">
          {employee.months.map(m => {
            const [ano, mm] = m.month.split('-');
            const isMatch = m.status === 'Match Exato';
            const justEntry = justificacoes.find(j => j.employee_name === employee.employee_name && j.month === m.month);
            const isJustified = !!justEntry;
            const displayStatus = isMatch ? 'Match Exato' : isJustified ? 'Justificado' : m.status;
            const badgeClass = isMatch || isJustified
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700';

            return (
              <div key={m.month} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {MESES_PT_SAL[mm]} {ano}
                    </span>
                    <span
                      onClick={() => onJustificar({ employee_name: employee.employee_name, month: m.month, balance: m.balance })}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest cursor-pointer hover:opacity-80 ${badgeClass}`}
                    >
                      {isMatch || isJustified ? <CheckCircle size={9} /> : <AlertCircle size={9} />} {displayStatus}
                    </span>
                    {isJustified && (
                      <>
                        <span className="text-[9px] text-slate-400 italic max-w-[180px] truncate" title={justEntry.justification}>
                          "{justEntry.justification}"
                        </span>
                        <button
                          onClick={() => onRemoverJustificacao({ employee_name: employee.employee_name, month: m.month })}
                          className="flex items-center gap-0.5 px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                          title="Desfazer justificação"
                        >
                          <Undo2 size={9} /> Desfazer
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-3 text-[11px] text-slate-600">
                      <span>Recibo: <strong>{fmtEur(m.expected_amount)}</strong></span>
                      <span>Pago: <strong>{fmtEur(m.total_paid)}</strong></span>
                      {Math.abs(m.balance) > tolerancia && (
                        <span className={`font-black text-[10px] px-2 py-0.5 rounded-full ${m.balance > 0 ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'}`}>
                          {m.balance > 0
                            ? `Pagou ${fmtEur(m.balance)} a menos`
                            : `Pagou ${fmtEur(Math.abs(m.balance))} a mais`}
                        </span>
                      )}
                    </div>
                    {!isMatch && !isJustified && (
                      <button
                        onClick={() => onJustificar({ employee_name: employee.employee_name, month: m.month, balance: m.balance })}
                        className="flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                      >
                        <MessageSquare size={9} /> Justificar
                      </button>
                    )}
                  </div>
                </div>
                {m.transfers.length > 0 ? (
                  <div className="space-y-1">
                    {m.transfers.map((t, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleTipo(t, runId)}
                            className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest cursor-pointer hover:opacity-75 transition-opacity ${t.type === 'Adiantamento' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                            {t.type === 'Adiantamento' ? 'Adiant.' : 'Liquid.'}
                          </button>
                          <span className="text-[11px] text-slate-500">{t.date}</span>
                        </div>
                        <span className="text-[12px] font-bold text-slate-700">{fmtEur(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">Nenhuma transferência identificada</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SalariosTab({ month }) {
  const { supabase } = useApp();
  const year = month ? String(month.getFullYear()) : String(new Date().getFullYear());

  const [salarioResultado, setSalarioResultado] = useState(null);
  const [loadingSalarios, setLoadingSalarios] = useState(false);
  const [salarioAliases, setSalarioAliases] = useState([]);
  const [salarioAssocModal, setSalarioAssocModal] = useState(null);
  const [salarioAssocPattern, setSalarioAssocPattern] = useState('');
  const [salarioAssocWorker, setSalarioAssocWorker] = useState('');
  const [salarioAssocSaving, setSalarioAssocSaving] = useState(false);

  // Justificações
  const [justificacoes, setJustificacoes] = useState([]);
  const [justModal, setJustModal] = useState(null); // { employee_name, month, balance }
  const [justText, setJustText] = useState('');
  const [justSaving, setJustSaving] = useState(false);

  // Tolerância (euros) — diferença máxima para considerar "Match Exato"
  const savedTol = parseFloat(localStorage.getItem('salarios_tolerancia')) || 0.01;
  const [tolerancia, setTolerancia] = useState(savedTol);
  const [tolInput, setTolInput] = useState(String(savedTol));

  // Exportar dropdown
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  // Extrair meses únicos disponíveis nos dados
  const monthsAvailable = useMemo(() => {
    if (!salarioResultado) return [];
    const set = new Set();
    salarioResultado.employees.forEach(emp => emp.months.forEach(m => set.add(m.month)));
    return [...set].sort();
  }, [salarioResultado]);

  // Employees filtrados pelo mês seleccionado
  const employeesFiltered = useMemo(() => {
    if (!salarioResultado) return [];
    if (!selectedMonth) return salarioResultado.employees;
    return salarioResultado.employees
      .map(emp => ({
        ...emp,
        months: emp.months.filter(m => m.month === selectedMonth),
      }))
      .filter(emp => emp.months.length > 0);
  }, [salarioResultado, selectedMonth]);

  // KPIs filtrados pelo mês seleccionado
  const pendentesEfectivos = employeesFiltered
    ? employeesFiltered.reduce((acc, emp) => {
        return acc + emp.months.filter(m =>
          m.status !== 'Match Exato' &&
          !justificacoes.some(j => j.employee_name === emp.employee_name && j.month === m.month)
        ).length;
      }, 0)
    : 0;

  useEffect(() => {
    const handleClick = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportMenu(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const analisarSalarios = async (aliasesOverride, tolOverride) => {
    if (!supabase) return;
    setLoadingSalarios(true);
    setSalarioResultado(null);

    const { data: allRuns } = await supabase
      .from('reconciliation_runs')
      .select('id, transactions_json, created_at')
      .order('created_at', { ascending: false });

    const runIds = (allRuns || []).map(r => r.id);
    const allTxs = (allRuns || []).flatMap(r => r.transactions_json || []);
    const txs = allTxs.filter(tx => (tx.data || '').startsWith(year));

    // Load movimentacao_recibo_links for all runs
    const { data: movLinks } = runIds.length
      ? await supabase
          .from('movimentacao_recibo_links')
          .select('tx_key, worker_id, worker_name, mes, tipo, run_id')
          .in('run_id', runIds)
      : { data: [] };

    // Build tx_key -> tx map (key must match tx_key stored in movimentacao_recibo_links)
    const txKey = (tx) => `${tx.data}|${tx.descricao}|${tx.valor}`;
    const txMap = {};
    txs.forEach(tx => { txMap[txKey(tx)] = tx; });

    // Build paymentsMap: { [worker_id]: { [mes]: { amount, data, type } } }
    // Use classifyTransfer to determine type based on tx.data vs mes
    const classifyTransfer = (txDate, refMes) => {
      if (!txDate || !refMes) return null;
      const [refYear, refMonth] = refMes.split('-').map(Number);
      const [txYear, txMonth, txDay] = txDate.split('-').map(Number);
      const monthDiff = (txYear - refYear) * 12 + (txMonth - refMonth);
      if (monthDiff === 0) {
        return (txDay >= 1 && txDay <= 6) || txDay >= 16 ? 'Adiantamento'
             : txDay >= 7 && txDay <= 15 ? 'Liquidação' : null;
      }
  if (monthDiff === 1) {
    return (txDay >= 1 && txDay <= 6) || txDay >= 16 ? 'Adiantamento'
         : txDay >= 7 && txDay <= 15 ? 'Liquidação' : null;
  }
      return null;
    };

    const paymentsMap = {};
    let linksProcessed = 0, linksMissingTx = 0, linksNoType = 0;
    const receiptMesByWorker = {};
    (movLinks || []).forEach(link => {
      if (!link.worker_id && !link.worker_name) return;
      const tx = txMap[link.tx_key];
      if (!tx) { linksMissingTx++; return; }
      const type = link.tipo || classifyTransfer(tx.data, link.mes);
      if (!type) { linksNoType++; return; }
      linksProcessed++;
      const receiptMes = link.mes;
      const normStr = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').trim();

      const workerKey = link.worker_id || normStr(link.worker_name);
      if (!paymentsMap[workerKey]) paymentsMap[workerKey] = {};
      if (!paymentsMap[workerKey][receiptMes]) {
        paymentsMap[workerKey][receiptMes] = [];
      }
      paymentsMap[workerKey][receiptMes].push({
        amount: Math.abs(parseFloat(tx.valor) || 0),
        data: tx.data,
        type,
        linkId: link.id
      });
      if (!receiptMesByWorker[workerKey]) receiptMesByWorker[workerKey] = [];
      if (!receiptMesByWorker[workerKey].includes(receiptMes)) receiptMesByWorker[workerKey].push(receiptMes);
    });
    console.log('[SALARIOS DEBUG] links loaded:', movLinks?.length, '| processed:', linksProcessed, '| missing tx:', linksMissingTx, '| no type:', linksNoType);
    console.log('[SALARIOS DEBUG] receiptMes distribution:', JSON.stringify(receiptMesByWorker));

    const { data: recibos } = await supabase
      .from('receipt_validations')
      .select('worker_id, worker_name, mes, liquido_extraido, bruto_plataforma, bruto_extraido')
      .like('mes', `${year}-%`)
      .not('estado', 'in', '("erro","invalido")');

    const aliases = aliasesOverride ?? salarioAliases;
    const tol = tolOverride !== undefined ? tolOverride : tolerancia;
    const res = runReconciliacaoSalarial({ recibos: recibos || [], transacoes: txs, ano: year, aliases, tolerancia: tol, paymentsMap });
    setSalarioResultado(res);
    setLoadingSalarios(false);
  };

  useEffect(() => {
    const init = async () => {
      if (!supabase) return;
      const [{ data: aliases }, { data: just }] = await Promise.all([
        supabase.from('reconciliacao_salarial_aliases').select('*').order('created_at', { ascending: false }),
        supabase.from('salary_justifications').select('employee_name, month, justification'),
      ]);
      const loaded = aliases || [];
      setSalarioAliases(loaded);
      setJustificacoes(just || []);
      await analisarSalarios(loaded);
    };
    init();
  }, [year]);

  // Totais de diferenças com detalhe por entrada
  const totaisDiferencas = employeesFiltered
    ? employeesFiltered.reduce((acc, emp) => {
        emp.months.forEach(m => {
          if (Math.abs(m.balance) <= tolerancia) return;
          const justEntry = justificacoes.find(j => j.employee_name === emp.employee_name && j.month === m.month);
          const entry = { name: emp.employee_name, month: m.month, value: Math.abs(m.balance), justification: justEntry?.justification || '' };
          if (m.balance > 0) { acc.aMenos += m.balance; acc.detalheAmenos.push(entry); }
          else { acc.aMais += Math.abs(m.balance); acc.detalheAmais.push(entry); }
        });
        return acc;
      }, { aMais: 0, aMenos: 0, detalheAmais: [], detalheAmenos: [] })
    : { aMais: 0, aMenos: 0, detalheAmais: [], detalheAmenos: [] };

  // ── Relatórios ──────────────────────────────────────────────────────────────
  const buildRows = () => {
    if (!employeesFiltered || employeesFiltered.length === 0) return [];
    return employeesFiltered.flatMap(emp =>
      emp.months.map(m => {
        const justEntry = justificacoes.find(j => j.employee_name === emp.employee_name && j.month === m.month);
        const status = m.status === 'Match Exato' ? 'Match Exato' : justEntry ? 'Justificado' : 'Saldo Pendente';
        const difLabel = Math.abs(m.balance) > tolerancia
          ? (m.balance > 0 ? `Pagou ${fmtEur(m.balance)} a menos` : `Pagou ${fmtEur(Math.abs(m.balance))} a mais`)
          : '';
        return [emp.employee_name, fmtMes(m.month), fmtEur(m.expected_amount), fmtEur(m.total_paid), difLabel, status, justEntry?.justification || ''];
      })
    );
  };

  const handleExportCsv = () => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Trabalhador', 'Mês', 'Recibo (€)', 'Pago (€)', 'Diferença', 'Status', 'Justificação'].map(esc).join(';');
    const rows = buildRows().map(r => r.map(esc).join(';'));
    const totRow = [
      '"Total Pago a Mais"', '""', '""', '""', `"${fmtEur(totaisDiferencas.aMais)}"`, '""', '""',
    ].join(';');
    const totRow2 = [
      '"Total Pago a Menos"', '""', '""', '""', `"${fmtEur(totaisDiferencas.aMenos)}"`, '""', '""',
    ].join(';');
    const blob = new Blob(['﻿' + [header, ...rows, '', totRow, totRow2].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `salarios_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text(`Relatório Salarial — ${year}`, 14, 18);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')}`, 14, 24);
    autoTable(doc, {
      startY: 30,
      head: [['Trabalhador', 'Mês', 'Recibo (€)', 'Pago (€)', 'Diferença', 'Status', 'Justificação']],
      body: buildRows(),
      styles: { fontSize: 6.5, cellPadding: 1.3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 6: { cellWidth: 55 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const v = data.cell.raw;
          if (v === 'Match Exato' || v === 'Justificado') data.cell.styles.textColor = [5, 150, 105];
          else if (v === 'Saldo Pendente') data.cell.styles.textColor = [217, 119, 6];
        }
        if (data.section === 'body' && data.column.index === 4 && data.cell.raw) {
          if (data.cell.raw.includes('a mais')) data.cell.styles.textColor = [14, 116, 144];
          else if (data.cell.raw.includes('a menos')) data.cell.styles.textColor = [190, 18, 60];
        }
      },
    });
    // Tabela de resumo de diferenças
    const lastY = doc.lastAutoTable?.finalY ?? 30;
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.text('Resumo de Diferenças', 14, lastY + 10);
    autoTable(doc, {
      startY: lastY + 14,
      head: [['', 'Total']],
      body: [
        ['Total Pago a Mais', fmtEur(totaisDiferencas.aMais)],
        ['Total Pago a Menos', fmtEur(totaisDiferencas.aMenos)],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255 },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 35, halign: 'right' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === 0) data.cell.styles.textColor = [14, 116, 144];
        if (data.section === 'body' && data.row.index === 1) data.cell.styles.textColor = [190, 18, 60];
      },
    });
    doc.save(`salarios_${year}.pdf`);
    setShowExportMenu(false);
  };

  // ── Remover justificação ────────────────────────────────────────────────────
  const handleRemoverJustificacao = async ({ employee_name, month }) => {
    await supabase
      .from('salary_justifications')
      .delete()
      .eq('employee_name', employee_name)
      .eq('month', month);
    setJustificacoes(prev => prev.filter(j => !(j.employee_name === employee_name && j.month === month)));
  };

  // ── Guardar justificação ─────────────────────────────────────────────────────
  const handleSaveJustificacao = async () => {
    if (!justText.trim() || !justModal) return;
    setJustSaving(true);
    const { data, error } = await supabase
      .from('salary_justifications')
      .upsert({ employee_name: justModal.employee_name, month: justModal.month, justification: justText.trim() }, { onConflict: 'employee_name,month' })
      .select('employee_name, month, justification')
      .single();
    if (!error && data) {
      setJustificacoes(prev => {
        const filtered = prev.filter(j => !(j.employee_name === data.employee_name && j.month === data.month));
        return [...filtered, data];
      });
    }
    setJustSaving(false);
    setJustModal(null);
    setJustText('');
  };

  const handleToggleTipo = async (t, runId) => {
    if (!t.linkId) return;
    const novoTipo = t.type === 'Adiantamento' ? 'Liquidação' : 'Adiantamento';
    await supabase
      .from('movimentacao_recibo_links')
      .update({ tipo: novoTipo })
      .eq('id', t.linkId);
    await analisarSalarios(salAliasOverride, tolOverride);
  };

  return (
    <div className="space-y-3">
      {loadingSalarios ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
          <p className="text-[11px] text-slate-400">A analisar pagamentos salariais…</p>
        </div>
      ) : !salarioResultado ? (
        <p className="text-center text-slate-400 py-8 text-sm">Sem dados de análise salarial.</p>
      ) : (
        <>
          {/* Header: sumário + botão exportar */}
          <div className="flex items-start justify-between gap-3">
            <div className="grid grid-cols-3 gap-3 flex-1">
              {[
                { label: 'Trabalhadores', value: employeesFiltered.length, color: 'text-slate-700', bg: 'bg-slate-50' },
                { label: 'Match Exato',   value: (salarioResultado?.summary?.total_exact_matches || 0) + justificacoes.length, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'Pendentes',     value: pendentesEfectivos, color: 'text-amber-700', bg: 'bg-amber-50' },
              ].map(c => (
                <div key={c.label} className={`${c.bg} rounded-2xl px-4 py-3 text-center`}>
                  <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Tolerância */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tolerância (€)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tolInput}
                  onChange={e => setTolInput(e.target.value)}
                  onBlur={() => {
                    const v = Math.max(0, parseFloat(tolInput) || 0);
                    const rounded = Math.round(v * 100) / 100;
                    setTolInput(String(rounded));
                    setTolerancia(rounded);
                    localStorage.setItem('salarios_tolerancia', String(rounded));
                    analisarSalarios(undefined, rounded);
                  }}
                  className="w-20 border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-bold text-slate-700 text-right focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>

            {/* Exportar dropdown */}
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

          {salarioResultado.employees.length === 0 ? (
            <div className="text-center py-8 text-[12px] text-slate-400">
              Nenhum trabalhador identificado nas transferências.<br />
              Verifique se os nomes constam nas descrições dos movimentos bancários.
            </div>
          ) : (
            <>
              {/* Seletor de mês */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedMonth(null)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!selectedMonth ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700'}`}
                >
                  Todos
                </button>
                {monthsAvailable.map(mes => (
                  <button
                    key={mes}
                    onClick={() => setSelectedMonth(mes)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedMonth === mes ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700'}`}
                  >
                    {fmtMes(mes)}
                  </button>
                ))}
              </div>

              {employeesFiltered.length === 0 ? (
                <div className="text-center py-8 text-[12px] text-slate-400">
                  Nenhum dado para o mês seleccionado.
                </div>
              ) : (
                employeesFiltered.map(emp => (
                  <SalarioEmployeeCard
                    key={emp.employee_name}
                    employee={emp}
                    justificacoes={justificacoes}
                    onJustificar={setJustModal}
                    onRemoverJustificacao={handleRemoverJustificacao}
                    tolerancia={tolerancia}
                  />
                ))
              )}
            </>
          )}

          {/* Resumo de diferenças */}
          {(totaisDiferencas.aMais > 0.01 || totaisDiferencas.aMenos > 0.01) && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              {/* Pago a Mais */}
              <div className="bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-sky-500 mb-1">Total Pago a Mais</p>
                <p className="text-xl font-black text-sky-700">{fmtEur(totaisDiferencas.aMais)}</p>
                {totaisDiferencas.detalheAmais.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-sky-100 pt-2">
                    {totaisDiferencas.detalheAmais.map((e, i) => (
                      <div key={i} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-sky-800 truncate">{e.name}</p>
                          <p className="text-[9px] text-sky-400">{fmtMes(e.month)}</p>
                          {e.justification && <p className="text-[9px] text-slate-400 italic truncate" title={e.justification}>"{e.justification}"</p>}
                        </div>
                        <span className="text-[10px] font-black text-sky-700 flex-shrink-0">{fmtEur(e.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Pago a Menos */}
              <div className="bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-rose-500 mb-1">Total Pago a Menos</p>
                <p className="text-xl font-black text-rose-700">{fmtEur(totaisDiferencas.aMenos)}</p>
                {totaisDiferencas.detalheAmenos.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-rose-100 pt-2">
                    {totaisDiferencas.detalheAmenos.map((e, i) => (
                      <div key={i} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-rose-800 truncate">{e.name}</p>
                          <p className="text-[9px] text-rose-400">{fmtMes(e.month)}</p>
                          {e.justification && <p className="text-[9px] text-slate-400 italic truncate" title={e.justification}>"{e.justification}"</p>}
                        </div>
                        <span className="text-[10px] font-black text-rose-700 flex-shrink-0">{fmtEur(e.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transferências não identificadas */}
          {(salarioResultado.unmatched_transactions || []).length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-2 flex items-center gap-1">
                <AlertCircle size={11} /> Não Identificadas ({salarioResultado.unmatched_transactions.length})
              </p>
              <div className="space-y-1">
                {salarioResultado.unmatched_transactions.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-[11px] text-slate-600 truncate">{tx.descricao}</p>
                      <p className="text-[10px] text-slate-400">{tx.date} · {fmtEur(tx.amount)}</p>
                    </div>
                    <button
                      onClick={() => { setSalarioAssocModal(tx); setSalarioAssocPattern(''); setSalarioAssocWorker(''); }}
                      className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                    >
                      Associar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aliases activos */}
          {salarioAliases.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Aliases Guardados</p>
              <div className="flex flex-wrap gap-1.5">
                {salarioAliases.map(a => (
                  <div key={a.id} className="flex items-center gap-1 bg-slate-100 rounded-xl px-2 py-1">
                    <span className="text-[10px] text-slate-600 max-w-[120px] truncate">{a.pattern}</span>
                    <span className="text-[9px] text-slate-400">→</span>
                    <span className="text-[10px] font-bold text-indigo-700 max-w-[100px] truncate">{a.worker_name}</span>
                    <button
                      onClick={async () => {
                        await supabase.from('reconciliacao_salarial_aliases').delete().eq('id', a.id);
                        const updated = salarioAliases.filter(x => x.id !== a.id);
                        setSalarioAliases(updated);
                        analisarSalarios(updated);
                      }}
                      className="ml-1 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: associar transação não identificada */}
      {salarioAssocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-black text-slate-800">Associar Transferência</h3>
              <button onClick={() => setSalarioAssocModal(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="bg-slate-50 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Descrição do movimento</p>
              <p className="text-[12px] text-slate-700 break-all">{salarioAssocModal.descricao}</p>
              <p className="text-[11px] text-slate-500 mt-1">{salarioAssocModal.date} · {fmtEur(salarioAssocModal.amount)}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                  Padrão a identificar (parte da descrição)
                </label>
                <input
                  value={salarioAssocPattern}
                  onChange={e => setSalarioAssocPattern(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                {(() => {
                  const p = salarioAssocPattern.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                  if (p.length < 4) return <p className="text-[10px] text-slate-400 mt-1">Mínimo 4 caracteres.</p>;
                  const allTx = salarioResultado?.unmatched_transactions || [];
                  const matchCount = allTx.filter(t => t.descricao.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(p)).length;
                  if (matchCount === 0) return <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1"><AlertCircle size={10} /> Nenhuma transação corresponde.</p>;
                  if (matchCount > 1) return <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1"><AlertCircle size={10} /> Vai capturar {matchCount} transferências.</p>;
                  return <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle size={10} /> Corresponde exactamente a 1.</p>;
                })()}
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Trabalhador</label>
                <select value={salarioAssocWorker} onChange={e => setSalarioAssocWorker(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">Seleccionar…</option>
                  {[...new Set((salarioResultado?.employees || []).map(e => e.employee_name))].sort().map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setSalarioAssocModal(null)}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                disabled={!salarioAssocPattern.trim() || !salarioAssocWorker || salarioAssocSaving}
                onClick={async () => {
                  setSalarioAssocSaving(true);
                  const newAlias = { pattern: salarioAssocPattern.trim(), worker_name: salarioAssocWorker };
                  const { data, error } = await supabase.from('reconciliacao_salarial_aliases').insert(newAlias).select().single();
                  if (!error && data) {
                    const updated = [data, ...salarioAliases];
                    setSalarioAliases(updated);
                    setSalarioAssocModal(null);
                    setSalarioAssocSaving(false);
                    analisarSalarios(updated);
                  } else { setSalarioAssocSaving(false); }
                }}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {salarioAssocSaving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: justificar mês pendente */}
      {justModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-black text-slate-800">Justificar Diferença</h3>
              <button onClick={() => { setJustModal(null); setJustText(''); }} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="bg-amber-50 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Mês pendente</p>
              <p className="text-sm font-bold text-slate-800">{justModal.employee_name}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{fmtMes(justModal.month)} · Saldo em falta: <strong className="text-red-600">{fmtEur(Math.abs(justModal.balance))}</strong></p>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                Justificação
              </label>
              <textarea
                value={justText}
                onChange={e => setJustText(e.target.value)}
                placeholder="Ex: Adiantamento pago em numerário, remuneração acordada diferente, pagamento parcial pendente…"
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setJustModal(null); setJustText(''); }}
                className="flex-1 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
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
