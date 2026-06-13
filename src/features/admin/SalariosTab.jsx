import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AlertCircle, ChevronDown, Download, FileText, Landmark, Loader2, Scissors, X, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { runReconciliacaoSalarial } from '../../utils/reconciliacaoSalarialEngine';
import '../../utils/toggleTipoLink';
import { MESES_PT_SAL, fmtEur, fmtMes } from './salarios/salarioUtils';
import SalarioEmployeeCard from './salarios/SalarioEmployeeCard';
import AssocTransacaoModal from './salarios/AssocTransacaoModal';
import JustificarModal from './salarios/JustificarModal';
import ImportarIBANsModal from './salarios/ImportarIBANsModal';

export default function SalariosTab({ month }) {
  const { supabase, workers } = useApp();
  const year = month ? String(month.getFullYear()) : String(new Date().getFullYear());

  const [salarioResultado, setSalarioResultado] = useState(null);
  const [loadingSalarios, setLoadingSalarios] = useState(false);
  const [salarioAliases, setSalarioAliases] = useState([]);
  const [salarioAssocModal, setSalarioAssocModal] = useState(null);
  const [salarioAssocPattern, setSalarioAssocPattern] = useState('');
  const [salarioAssocWorker, setSalarioAssocWorker] = useState('');
  const [salarioAssocSaving, setSalarioAssocSaving] = useState(false);

  const [justificacoes, setJustificacoes] = useState([]);
  const [justModal, setJustModal] = useState(null);

  const [deducoes, setDeducoes] = useState([]);
  const [descontosModal, setDescontosModal] = useState(false);
  const [descMes, setDescMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [descForm, setDescForm] = useState(null); // { workerId, workerName } quando add form está aberto
  const [descFormVal, setDescFormVal] = useState({ motivo: 'adiantamento', amount: '', descricao: '' });
  const [descSaving, setDescSaving] = useState(false);

  const MOTIVOS_DESCONTO = [
    { value: 'adiantamento', label: 'Adiantamento' },
    { value: 'emprestimo',   label: 'Parcela Empréstimo' },
    { value: 'outro',        label: 'Outro' },
  ];

  const [sepaModal, setSepaModal] = useState(false);
  const [sepaModo, setSepaModo] = useState('normal'); // 'normal' | 'instant'
  const [sepaSelecao, setSepaSelecao] = useState(new Set());
  const [sepaAjustes, setSepaAjustes] = useState({}); // employee_name → { base, adicionar, abater }
  const [sepaExpandido, setSepaExpandido] = useState(null); // employee_name com ajustes abertos
  const [sepaCarregando, setSepaCarregando] = useState(false);
  const [justText, setJustText] = useState('');
  const [justSaving, setJustSaving] = useState(false);

  const savedTol = parseFloat(localStorage.getItem('salarios_tolerancia')) || 0.01;
  const [tolerancia, setTolerancia] = useState(savedTol);
  const [tolInput, setTolInput] = useState(String(savedTol));

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef(null);
  const [importarIBANsModal, setImportarIBANsModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [openEmployee, setOpenEmployee] = useState(null);

  const handleTipoUpdate = useCallback((linkId, novoTipo) => {
    setSalarioResultado(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        employees: prev.employees.map(emp => ({
          ...emp,
          months: emp.months.map(m => ({
            ...m,
            transfers: m.transfers.map(t =>
              t.linkId === linkId ? { ...t, type: novoTipo } : t
            ),
          })),
        })),
      };
    });
  }, []);

  const monthsAvailable = useMemo(() => {
    if (!salarioResultado) return [];
    const set = new Set();
    salarioResultado.employees.forEach(emp => emp.months.forEach(m => set.add(m.month)));
    return [...set].sort();
  }, [salarioResultado]);

  const employeesFiltered = useMemo(() => {
    if (!salarioResultado) return [];
    if (!selectedMonth) return salarioResultado.employees;
    return salarioResultado.employees
      .map(emp => ({ ...emp, months: emp.months.filter(m => m.month === selectedMonth) }))
      .filter(emp => emp.months.length > 0);
  }, [salarioResultado, selectedMonth]);

  const pendentesEfectivos = employeesFiltered
    ? employeesFiltered.reduce((acc, emp) => acc + emp.months.filter(m =>
        m.status !== 'Match Exato' &&
        !justificacoes.some(j => j.employee_name === emp.employee_name && j.month === m.month)
      ).length, 0)
    : 0;

  useEffect(() => {
    const handleClick = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportMenu(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const analisarSalarios = useCallback(async (aliasesOverride, tolOverride) => {
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

    const { data: movLinks } = runIds.length
      ? await supabase
          .from('movimentacao_recibo_links')
          .select('id, tx_key, worker_id, worker_name, mes, tipo, run_id')
          .in('run_id', runIds)
      : { data: [] };

    const txKey = (tx) => `${tx.data}|${tx.descricao}|${tx.valor}`;
    const txMap = {};
    txs.forEach(tx => { txMap[txKey(tx)] = tx; });

    const classifyTransfer = (txDate, refMes) => {
      if (!txDate || !refMes) return null;
      const [refYear, refMonth] = refMes.split('-').map(Number);
      const [txYear, txMonth, txDay] = txDate.split('-').map(Number);
      const monthDiff = (txYear - refYear) * 12 + (txMonth - refMonth);
      if (monthDiff === 0 || monthDiff === 1) {
        return (txDay >= 1 && txDay <= 6) || txDay >= 16 ? 'Adiantamento'
             : txDay >= 7 && txDay <= 15 ? 'Liquidação' : null;
      }
      return null;
    };

    const paymentsMap = {};
    (movLinks || []).forEach(link => {
      if (!link.worker_id && !link.worker_name) return;
      const tx = txMap[link.tx_key];
      if (!tx) return;
      const type = link.tipo || classifyTransfer(tx.data, link.mes);
      if (!type) return;
      const normStr = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '').trim();
      const workerKey = link.worker_id || normStr(link.worker_name);
      if (!paymentsMap[workerKey]) paymentsMap[workerKey] = {};
      if (!paymentsMap[workerKey][link.mes]) paymentsMap[workerKey][link.mes] = [];
      paymentsMap[workerKey][link.mes].push({
        amount: Math.abs(parseFloat(tx.valor) || 0),
        data: tx.data,
        type,
        linkId: link.id,
      });
    });

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
  }, [supabase, year, salarioAliases, tolerancia]);

  useEffect(() => {
    const init = async () => {
      if (!supabase) return;
      const [{ data: aliases }, { data: just }, { data: deducoesData }] = await Promise.all([
        supabase.from('reconciliacao_salarial_aliases').select('*').order('created_at', { ascending: false }),
        supabase.from('salary_justifications').select('employee_name, month, justification'),
        supabase.from('worker_salary_deductions').select('*').order('created_at', { ascending: false }),
      ]);
      const loaded = aliases || [];
      setSalarioAliases(loaded);
      setJustificacoes(just || []);
      setDeducoes(deducoesData || []);
      await analisarSalarios(loaded);
    };
    init();
  }, [year]);

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

  const buildRows = () => {
    if (!employeesFiltered || employeesFiltered.length === 0) return [];
    const allMonths = [...new Set(employeesFiltered.flatMap(e => e.months.map(m => m.month)))].sort();
    const result = [];
    for (const mes of allMonths) {
      let monthExpected = 0, monthPaid = 0;
      for (const emp of employeesFiltered) {
        for (const m of emp.months.filter(m => m.month === mes)) {
          const justEntry = justificacoes.find(j => j.employee_name === emp.employee_name && j.month === m.month);
          const status = m.status === 'Match Exato' ? 'Match Exato' : justEntry ? 'Justificado' : 'Saldo Pendente';
          const difLabel = Math.abs(m.balance) > tolerancia
            ? (m.balance > 0 ? `Pagou ${fmtEur(m.balance)} a menos` : `Pagou ${fmtEur(Math.abs(m.balance))} a mais`)
            : '';
          result.push([emp.employee_name, fmtMes(m.month), fmtEur(m.expected_amount), fmtEur(m.total_paid), difLabel, status, justEntry?.justification || '']);
          monthExpected += m.expected_amount;
          monthPaid += m.total_paid;
        }
      }
      const monthBalance = monthExpected - monthPaid;
      const monthDiffLabel = Math.abs(monthBalance) > tolerancia
        ? (monthBalance > 0 ? `Pagou ${fmtEur(monthBalance)} a menos` : `Pagou ${fmtEur(Math.abs(monthBalance))} a mais`)
        : '';
      result.push(['Subtotal', fmtMes(mes), fmtEur(monthExpected), fmtEur(monthPaid), monthDiffLabel, '', '']);
    }
    return result;
  };

  const handleExportCsv = () => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Trabalhador', 'Mês', 'Recibo (€)', 'Pago (€)', 'Diferença', 'Status', 'Justificação'].map(esc).join(';');
    const rows = buildRows().map(r => r.map(esc).join(';'));
    const totRow = ['"Total Pago a Mais"', '""', '""', '""', `"${fmtEur(totaisDiferencas.aMais)}"`, '""', '""'].join(';');
    const totRow2 = ['"Total Pago a Menos"', '""', '""', '""', `"${fmtEur(totaisDiferencas.aMenos)}"`, '""', '""'].join(';');
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
        if (data.section === 'body' && data.column.index === 0 && data.cell.raw === 'Subtotal') {
          data.cell.styles.fillColor = [240, 240, 240];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [50, 50, 50];
          return;
        }
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

  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const abrirSepaModal = (modo = 'normal') => {
    const mesAlvo = selectedMonth || (monthsAvailable.length === 1 ? monthsAvailable[0] : null);
    if (!mesAlvo) {
      alert(modo === 'instant'
        ? 'Selecciona um mês antes de exportar a Transferência Imediata.'
        : 'Selecciona um mês antes de exportar o SEPA XML.');
      return;
    }
    const elegíveis = employeesFiltered
      .filter(emp => emp.months.find(x => x.month === mesAlvo && x.expected_amount > 0));
    const ajustesIniciais = {};
    elegíveis.forEach(emp => {
      const m = emp.months.find(x => x.month === mesAlvo);
      const totalDesconto = deducoes
        .filter(d => norm(d.worker_name) === norm(emp.employee_name) && d.month === mesAlvo)
        .reduce((sum, d) => sum + Number(d.amount), 0);
      ajustesIniciais[emp.employee_name] = {
        base: String(m?.expected_amount ?? 0),
        adicionar: '',
        abater: totalDesconto > 0 ? String(totalDesconto) : '',
      };
    });
    setSepaSelecao(new Set(elegíveis.map(e => e.employee_name)));
    setSepaAjustes(ajustesIniciais);
    setSepaModo(modo);
    setSepaModal(true);
    setShowExportMenu(false);
  };

  const confirmarSepa = async () => {
    const mesAlvo = selectedMonth || (monthsAvailable.length === 1 ? monthsAvailable[0] : null);
    if (!mesAlvo) return;
    setSepaCarregando(true);

    const trabalhadores = [];
    for (const emp of employeesFiltered) {
      if (!sepaSelecao.has(emp.employee_name)) continue;
      const aj = sepaAjustes[emp.employee_name] || {};
      const valorFinal = (parseFloat(aj.base) || 0) + (parseFloat(aj.adicionar) || 0) - (parseFloat(aj.abater) || 0);
      if (valorFinal <= 0) continue;
      const worker = workers.find(w => norm(w.name) === norm(emp.employee_name));
      if (!worker?.iban) {
        alert(`"${emp.employee_name}" não tem IBAN registado. Preenche o IBAN no perfil.`);
        setSepaCarregando(false);
        return;
      }
      trabalhadores.push({
        nome: emp.employee_name,
        iban: worker.iban.replace(/\s/g, '').toUpperCase(),
        salario: valorFinal,
        mes: MESES_PT[parseInt(mesAlvo.split('-')[1], 10) - 1],
        ano: mesAlvo.split('-')[0],
      });
    }

    if (trabalhadores.length === 0) {
      alert('Nenhum trabalhador seleccionado.');
      setSepaCarregando(false);
      return;
    }

    try {
      const isInstant = sepaModo === 'instant';
      const res = await fetch('/api/salarios/exportar-sepa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhadores, instant: isInstant }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        alert(`Erro ao gerar ficheiro: ${err.error}`);
        setSepaCarregando(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = isInstant
        ? `transf_imediata_${mesAlvo}_magnetic_place.xml`
        : `salarios_${mesAlvo}_magnetic_place.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Erro de rede: ${e.message}`);
    }
    setSepaCarregando(false);
    setSepaModal(false);
  };

  const handleRemoverJustificacao = async ({ employee_name, month }) => {
    await supabase.from('salary_justifications').delete().eq('employee_name', employee_name).eq('month', month);
    setJustificacoes(prev => prev.filter(j => !(j.employee_name === employee_name && j.month === month)));
  };

  const handleSaveJustificacao = async () => {
    if (!justText.trim() || !justModal) return;
    setJustSaving(true);
    const { data, error } = await supabase
      .from('salary_justifications')
      .upsert({ employee_name: justModal.employee_name, month: justModal.month, justification: justText.trim() }, { onConflict: 'employee_name,month' })
      .select('employee_name, month, justification')
      .single();
    if (!error && data) {
      setJustificacoes(prev => [...prev.filter(j => !(j.employee_name === data.employee_name && j.month === data.month)), data]);
    }
    setJustSaving(false);
    setJustModal(null);
    setJustText('');
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
          {/* Header: sumário + exportar */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Trabalhadores', value: employeesFiltered.length, color: 'text-slate-700', bg: 'bg-slate-50' },
                { label: 'Match Exato', value: (salarioResultado?.summary?.total_exact_matches || 0) + justificacoes.length, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'Pendentes', value: pendentesEfectivos, color: 'text-amber-700', bg: 'bg-amber-50' },
              ].map(c => (
                <div key={c.label} className={`${c.bg} rounded-2xl px-4 py-3 text-center`}>
                  <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{c.label}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1 self-start sm:flex-shrink-0">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tolerância (€)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" step="0.01" value={tolInput}
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

            <div className="flex flex-col gap-2 flex-shrink-0">
              {/* Exportar CSV / PDF */}
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setShowExportMenu(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest transition-all w-full justify-center"
                >
                  <Download size={13} /> Exportar
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 py-1 z-20 min-w-[130px]">
                    <button onClick={handleExportCsv} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                      <FileText size={13} className="text-emerald-600" /> CSV
                    </button>
                    <button onClick={handleExportPdf} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                      <FileText size={13} className="text-rose-500" /> PDF
                    </button>
                  </div>
                )}
              </div>
              {/* SEPA XML */}
              <button
                onClick={() => abrirSepaModal('normal')}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 rounded-2xl text-xs font-black uppercase tracking-widest transition-all justify-center"
              >
                <Landmark size={13} /> SEPA XML
              </button>
              {/* Transferência Imediata (SCT Inst) */}
              <button
                onClick={() => abrirSepaModal('instant')}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-800 rounded-2xl text-xs font-black uppercase tracking-widest transition-all justify-center"
              >
                <Zap size={13} /> Transf. Imediata
              </button>
              {/* Descontos Salariais */}
              <button
                onClick={() => setDescontosModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 hover:bg-violet-100 text-violet-600 hover:text-violet-800 rounded-2xl text-xs font-black uppercase tracking-widest transition-all justify-center"
              >
                <Scissors size={13} /> Descontos
              </button>
              {/* Importar IBANs */}
              <button
                onClick={() => setImportarIBANsModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-800 rounded-2xl text-xs font-black uppercase tracking-widest transition-all justify-center"
              >
                <Landmark size={13} /> Importar IBANs
              </button>
            </div>
          </div>

          {salarioResultado.employees.length === 0 ? (
            <div className="text-center py-8 text-[12px] text-slate-400">
              Nenhum trabalhador identificado nas transferências.<br />
              Verifique se os nomes constam nas descrições dos movimentos bancários.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedMonth(null)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!selectedMonth ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700'}`}>
                  Todos
                </button>
                {monthsAvailable.map(mes => (
                  <button key={mes} onClick={() => setSelectedMonth(mes)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedMonth === mes ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700'}`}>
                    {fmtMes(mes)}
                  </button>
                ))}
              </div>

              {employeesFiltered.length === 0 ? (
                <div className="text-center py-8 text-[12px] text-slate-400">Nenhum dado para o mês seleccionado.</div>
              ) : (
                employeesFiltered.map(emp => (
                  <SalarioEmployeeCard
                    key={emp.employee_name}
                    employee={emp}
                    justificacoes={justificacoes}
                    onJustificar={setJustModal}
                    onRemoverJustificacao={handleRemoverJustificacao}
                    tolerancia={tolerancia}
                    onTipoUpdate={handleTipoUpdate}
                    isOpen={openEmployee === emp.employee_name}
                    onToggleOpen={() => setOpenEmployee(prev => prev === emp.employee_name ? null : emp.employee_name)}
                  />
                ))
              )}
            </>
          )}

          {/* Resumo de diferenças */}
          {(totaisDiferencas.aMais > 0.01 || totaisDiferencas.aMenos > 0.01) && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {salarioAssocModal && (
        <AssocTransacaoModal
          tx={salarioAssocModal}
          pattern={salarioAssocPattern}
          onPatternChange={setSalarioAssocPattern}
          worker={salarioAssocWorker}
          onWorkerChange={setSalarioAssocWorker}
          workers={[...new Set((salarioResultado?.employees || []).map(e => e.employee_name))].sort()}
          unmatchedTxs={salarioResultado?.unmatched_transactions || []}
          saving={salarioAssocSaving}
          onClose={() => setSalarioAssocModal(null)}
          onSave={async () => {
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
        />
      )}

      {justModal && (
        <JustificarModal
          entry={justModal}
          text={justText}
          onTextChange={setJustText}
          saving={justSaving}
          onClose={() => { setJustModal(null); setJustText(''); }}
          onSave={handleSaveJustificacao}
        />
      )}

      {sepaModal && (() => {
        const mesAlvo = selectedMonth || (monthsAvailable.length === 1 ? monthsAvailable[0] : null);
        const candidatos = employeesFiltered.filter(emp =>
          emp.months.find(x => x.month === mesAlvo && x.expected_amount > 0)
        );

        const calcFinal = name => {
          const aj = sepaAjustes[name] || {};
          return (parseFloat(aj.base) || 0) + (parseFloat(aj.adicionar) || 0) - (parseFloat(aj.abater) || 0);
        };

        const setAj = (name, field, val) =>
          setSepaAjustes(prev => ({ ...prev, [name]: { ...(prev[name] || {}), [field]: val } }));

        const total = candidatos
          .filter(emp => sepaSelecao.has(emp.employee_name))
          .reduce((acc, emp) => acc + Math.max(0, calcFinal(emp.employee_name)), 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {sepaModo === 'instant'
                    ? <Zap size={18} className="text-amber-500" />
                    : <Landmark size={18} className="text-indigo-500" />}
                  <p className="text-sm font-black uppercase tracking-widest text-slate-700">
                    {sepaModo === 'instant' ? 'Transferência Imediata' : 'SEPA XML'} — {mesAlvo ? fmtMes(mesAlvo) : ''}
                  </p>
                </div>
                <button onClick={() => setSepaModal(false)} className="text-slate-300 hover:text-slate-600 transition-colors"><X size={18} /></button>
              </div>

              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Seleccionar todos</span>
                <input
                  type="checkbox"
                  checked={candidatos.length > 0 && candidatos.every(e => sepaSelecao.has(e.employee_name))}
                  onChange={e => setSepaSelecao(e.target.checked ? new Set(candidatos.map(c => c.employee_name)) : new Set())}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                {candidatos.map(emp => {
                  const worker = workers.find(w => norm(w.name) === norm(emp.employee_name));
                  const semIban = !worker?.iban;
                  const selecionado = sepaSelecao.has(emp.employee_name);
                  const aj = sepaAjustes[emp.employee_name] || {};
                  const valorFinal = calcFinal(emp.employee_name);
                  const temAjuste = (parseFloat(aj.adicionar) || 0) !== 0 || (parseFloat(aj.abater) || 0) !== 0;
                  const expandido = sepaExpandido === emp.employee_name;

                  return (
                    <div key={emp.employee_name} className={semIban ? 'opacity-50' : ''}>
                      {/* Linha principal — clicar expande os ajustes */}
                      <div
                        className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors ${expandido ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                        onClick={() => !semIban && setSepaExpandido(expandido ? null : emp.employee_name)}
                      >
                        <input
                          type="checkbox"
                          disabled={semIban}
                          checked={selecionado}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setSepaSelecao(prev => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(emp.employee_name) : next.delete(emp.employee_name);
                            return next;
                          })}
                          className="w-4 h-4 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-700 truncate">{emp.employee_name}</p>
                          {semIban
                            ? <p className="text-xs text-rose-500 font-semibold">Sem IBAN</p>
                            : <p className="text-xs text-slate-400 font-mono">{worker.iban.replace(/\s/g,'').slice(0,8)}…</p>
                          }
                          {(() => {
                            const nDesc = deducoes.filter(d => norm(d.worker_name) === norm(emp.employee_name) && d.month === mesAlvo).length;
                            return nDesc > 0
                              ? <p className="text-[10px] text-violet-500 font-bold">{nDesc} desconto{nDesc > 1 ? 's' : ''} aplicado{nDesc > 1 ? 's' : ''}</p>
                              : null;
                          })()}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {temAjuste && (
                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 rounded-full px-2 py-0.5">ajustado</span>
                          )}
                          <span className={`text-sm font-black ${temAjuste ? 'text-indigo-600' : 'text-slate-700'}`}>
                            {fmtEur(valorFinal)}
                          </span>
                          <ChevronDown size={14} className={`text-slate-300 transition-transform ${expandido ? 'rotate-180' : ''}`} />
                        </div>
                      </div>

                      {/* Painel de ajustes — expande ao clicar */}
                      {expandido && (
                        <div className="px-4 pb-4 pt-1 bg-indigo-50 border-t border-indigo-100">
                          <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest mb-3">Ajustar valor</p>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="text-xs font-bold text-slate-500 block mb-1.5">Base (€)</label>
                              <input
                                type="number" min="0" step="0.01"
                                value={aj.base ?? ''}
                                onChange={e => setAj(emp.employee_name, 'base', e.target.value)}
                                className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-sm font-mono text-slate-700 text-right focus:outline-none focus:ring-2 focus:ring-indigo-300"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-emerald-600 block mb-1.5">+ Adicionar</label>
                              <input
                                type="number" min="0" step="0.01"
                                value={aj.adicionar ?? ''}
                                placeholder="0,00"
                                onChange={e => setAj(emp.employee_name, 'adicionar', e.target.value)}
                                className="w-full border border-emerald-200 bg-white rounded-xl px-3 py-2 text-sm font-mono text-emerald-700 text-right focus:outline-none focus:ring-2 focus:ring-emerald-300 placeholder:text-slate-300"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-rose-500 block mb-1.5">− Abater</label>
                              <input
                                type="number" min="0" step="0.01"
                                value={aj.abater ?? ''}
                                placeholder="0,00"
                                onChange={e => setAj(emp.employee_name, 'abater', e.target.value)}
                                className="w-full border border-rose-200 bg-white rounded-xl px-3 py-2 text-sm font-mono text-rose-700 text-right focus:outline-none focus:ring-2 focus:ring-rose-300 placeholder:text-slate-300"
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end">
                            <p className="text-sm font-black text-indigo-700">
                              Total: {fmtEur(valorFinal)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total selecionado</p>
                  <p className="text-xl font-black text-indigo-700">{fmtEur(total)}</p>
                </div>
                <button
                  onClick={confirmarSepa}
                  disabled={sepaCarregando || sepaSelecao.size === 0}
                  className={`flex items-center gap-2 px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${sepaModo === 'instant' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                  {sepaCarregando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Exportar {sepaSelecao.size > 0 ? `(${sepaSelecao.size})` : ''}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    {importarIBANsModal && (
      <ImportarIBANsModal
        workers={workers}
        supabase={supabase}
        onClose={() => setImportarIBANsModal(false)}
        onImportado={() => {/* workers actualizam via realtime do AppContext */}}
      />
    )}

    {descontosModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Scissors size={18} className="text-violet-500" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-700">Descontos Salariais</p>
            </div>
            <button onClick={() => { setDescontosModal(false); setDescForm(null); }} className="text-slate-300 hover:text-slate-600 transition-colors"><X size={18} /></button>
          </div>

          <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Mês</label>
            <input
              type="month"
              value={descMes}
              onChange={e => { setDescMes(e.target.value); setDescForm(null); }}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {(workers || []).filter(w => w.status === 'ativo').map(worker => {
              const descWorker = deducoes.filter(d => norm(d.worker_name) === norm(worker.name) && d.month === descMes);
              const formAberto = descForm?.workerId === worker.id;
              return (
                <div key={worker.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-700">{worker.name}</p>
                    <button
                      onClick={() => {
                        setDescForm(formAberto ? null : { workerId: worker.id, workerName: worker.name });
                        setDescFormVal({ motivo: 'adiantamento', amount: '', descricao: '' });
                      }}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 rounded-xl px-2 py-1 transition-colors"
                    >
                      {formAberto ? <X size={11} /> : '+'} {formAberto ? 'Cancelar' : 'Adicionar'}
                    </button>
                  </div>

                  {descWorker.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {descWorker.map(d => (
                        <span key={d.id} className="flex items-center gap-1.5 text-[11px] font-bold bg-violet-50 text-violet-700 rounded-full px-2.5 py-1">
                          {MOTIVOS_DESCONTO.find(m => m.value === d.motivo)?.label ?? d.motivo}
                          {' · '}
                          {fmtEur(d.amount)}
                          {d.descricao ? <span className="text-violet-400 font-normal">({d.descricao})</span> : null}
                          <button
                            onClick={async () => {
                              await supabase.from('worker_salary_deductions').delete().eq('id', d.id);
                              setDeducoes(prev => prev.filter(x => x.id !== d.id));
                            }}
                            className="text-violet-400 hover:text-rose-500 transition-colors ml-0.5"
                          ><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  )}

                  {formAberto && (
                    <div className="mt-3 bg-violet-50 rounded-2xl p-3 flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-violet-500 uppercase tracking-widest block mb-1">Motivo</label>
                          <select
                            value={descFormVal.motivo}
                            onChange={e => setDescFormVal(p => ({ ...p, motivo: e.target.value }))}
                            className="w-full border border-violet-200 bg-white rounded-xl px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
                          >
                            {MOTIVOS_DESCONTO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-violet-500 uppercase tracking-widest block mb-1">Valor (€)</label>
                          <input
                            type="number" min="0.01" step="0.01"
                            value={descFormVal.amount}
                            onChange={e => setDescFormVal(p => ({ ...p, amount: e.target.value }))}
                            placeholder="0,00"
                            className="w-full border border-violet-200 bg-white rounded-xl px-2.5 py-1.5 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-violet-500 uppercase tracking-widest block mb-1">Nota (opcional)</label>
                        <input
                          type="text"
                          value={descFormVal.descricao}
                          onChange={e => setDescFormVal(p => ({ ...p, descricao: e.target.value }))}
                          placeholder="Ex: adiantamento de 10 jan"
                          className="w-full border border-violet-200 bg-white rounded-xl px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          disabled={descSaving || !descFormVal.amount || parseFloat(descFormVal.amount) <= 0}
                          onClick={async () => {
                            setDescSaving(true);
                            const { data, error } = await supabase
                              .from('worker_salary_deductions')
                              .insert({
                                worker_id: worker.id,
                                worker_name: worker.name,
                                month: descMes,
                                amount: parseFloat(descFormVal.amount),
                                motivo: descFormVal.motivo,
                                descricao: descFormVal.descricao || null,
                              })
                              .select()
                              .single();
                            if (!error && data) {
                              setDeducoes(prev => [data, ...prev]);
                              setDescForm(null);
                            }
                            setDescSaving(false);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
                        >
                          {descSaving ? <Loader2 size={12} className="animate-spin" /> : null}
                          Guardar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0 flex justify-end">
            <button
              onClick={() => { setDescontosModal(false); setDescForm(null); }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
