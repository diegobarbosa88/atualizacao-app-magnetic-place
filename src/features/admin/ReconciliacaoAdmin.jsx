import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Landmark, Upload, CheckCircle, X, ChevronDown, ChevronUp,
  AlertCircle, Clock, FileText, Loader2, Plus, ArrowLeftRight,
  ArrowDownLeft, ArrowUpRight, Trash2, RefreshCw, Tag, Download, Unlink, Pencil, Link2
} from 'lucide-react';

const COR_MAP = {
  violet:  { bg: 'bg-violet-100',  text: 'text-violet-700',  ring: 'ring-violet-400',  dot: 'bg-violet-500'  },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-400', dot: 'bg-emerald-500' },
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-700',    ring: 'ring-blue-400',    dot: 'bg-blue-500'    },
  orange:  { bg: 'bg-orange-100',  text: 'text-orange-700',  ring: 'ring-orange-400',  dot: 'bg-orange-500'  },
  slate:   { bg: 'bg-slate-100',   text: 'text-slate-600',   ring: 'ring-slate-400',   dot: 'bg-slate-500'   },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-700',    ring: 'ring-rose-400',    dot: 'bg-rose-500'    },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-700',   ring: 'ring-amber-400',   dot: 'bg-amber-500'   },
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-700',  ring: 'ring-indigo-400',  dot: 'bg-indigo-500'  },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-700',    ring: 'ring-cyan-400',    dot: 'bg-cyan-500'    },
  gray:    { bg: 'bg-gray-100',    text: 'text-gray-600',    ring: 'ring-gray-400',    dot: 'bg-gray-400'    },
};
const CORES_DISPONIVEIS = ['indigo', 'violet', 'emerald', 'blue', 'cyan', 'orange', 'amber', 'rose', 'slate', 'gray'];

function TagBadge({ nome, cor }) {
  const c = COR_MAP[cor] || COR_MAP.gray;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${c.bg} ${c.text}`}>
      <Tag size={9} /> {nome}
    </span>
  );
}
import { useApp } from '../../context/AppContext';

function TipoBadge({ tipo }) {
  if (tipo === 'credito') return (
    <span className="flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
      <ArrowDownLeft size={10} /> Entrada
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
      <ArrowUpRight size={10} /> Saída
    </span>
  );
}

// ─── Relatório Modal ──────────────────────────────────────────────────────────
const COLS_MATCHED = [
  { key: 'data',            label: 'Data Movimento' },
  { key: 'descricao',       label: 'Descrição Movimento' },
  { key: 'valor',           label: 'Valor Movimento' },
  { key: 'tipo',            label: 'Tipo' },
  { key: 'entidade',        label: 'Entidade Sistema' },
  { key: 'descricaoSist',   label: 'Descrição Sistema' },
  { key: 'valorSist',       label: 'Valor Sistema' },
  { key: 'dataSist',        label: 'Data Documento' },
  { key: 'fonte',           label: 'Fonte' },
  { key: 'regra',           label: 'Regra' },
  { key: 'estado',          label: 'Estado' },
];
const COLS_ORPHAN_BANK = [
  { key: 'data',       label: 'Data' },
  { key: 'descricao',  label: 'Descrição' },
  { key: 'valor',      label: 'Valor' },
  { key: 'tipo',       label: 'Tipo' },
  { key: 'motivo',     label: 'Motivo' },
];
const COLS_ORPHAN_SYS = [
  { key: 'entidade',      label: 'Entidade' },
  { key: 'descricao',     label: 'Descrição' },
  { key: 'valor',         label: 'Valor' },
  { key: 'dataDocumento', label: 'Data Documento' },
  { key: 'fonte',         label: 'Fonte' },
];

function getMatchedCell(m, key) {
  const isManual = m.rule === 'confirmed_manual';
  switch (key) {
    case 'data':          return m.transacao?.data ?? '';
    case 'descricao':     return m.transacao?.descricao ?? '';
    case 'valor':         return m.transacao?.valor ?? '';
    case 'tipo':          return m.transacao?.tipo ?? '';
    case 'entidade':      return isManual ? (m.classificacao?.nome || '') : (m.fatura?.entidade ?? '');
    case 'descricaoSist': return isManual ? (m.observacao || m.transacao?.descricao || '') : (m.fatura?.descricao ?? '');
    case 'valorSist':     return isManual ? (m.transacao?.valor ?? '') : (m.fatura?.valor ?? '');
    case 'dataSist':      return isManual ? (m.transacao?.data ?? '') : (m.fatura?.data_documento ?? '');
    case 'fonte':         return isManual ? 'manual' : (m.fatura?.fonte ?? '');
    case 'regra':         return m.rule ?? '';
    case 'estado':        return isManual ? 'CONFIRMADO' : (m.fatura?.status === 'PAGO' ? 'PAGO' : 'RECONCILIADO');
    default:              return '';
  }
}
function getOrphanBankCell(o, key) {
  switch (key) {
    case 'data':      return o.transacao?.data ?? '';
    case 'descricao': return o.transacao?.descricao ?? '';
    case 'valor':     return o.transacao?.valor ?? '';
    case 'tipo':      return o.transacao?.tipo ?? '';
    case 'motivo':    return o.reason ?? '';
    default:          return '';
  }
}
function getOrphanSysCell(o, key) {
  switch (key) {
    case 'entidade':      return o.fatura?.entidade ?? '';
    case 'descricao':     return o.fatura?.descricao ?? '';
    case 'valor':         return o.fatura?.valor ?? '';
    case 'dataDocumento': return o.fatura?.data_documento ?? '';
    case 'fonte':         return o.fatura?.fonte ?? '';
    default:              return '';
  }
}

function RelatorioModal({ displayData, filename, dataRun, onClose, runs }) {
  const [formato, setFormato] = useState('csv');
  const [secoes, setSecoes] = useState({ matched: true, orphan_bank: true, orphan_system: true });
  const [colsM,  setColsM]  = useState(() => Object.fromEntries(COLS_MATCHED.map(c => [c.key, true])));
  const [colsOB, setColsOB] = useState(() => Object.fromEntries(COLS_ORPHAN_BANK.map(c => [c.key, true])));
  const [colsOS, setColsOS] = useState(() => Object.fromEntries(COLS_ORPHAN_SYS.map(c => [c.key, true])));
  const [incluirTotalEntidade, setIncluirTotalEntidade] = useState(true);

  const isMulti = !!runs;
  const data = isMulti
    ? {
        matched:       runs.flatMap(r => r.results_json?.matched       || []),
        orphan_bank:   runs.flatMap(r => r.results_json?.orphan_bank   || []),
        orphan_system: runs.flatMap(r => r.results_json?.orphan_system || []),
      }
    : displayData;

  const reportName = isMulti
    ? `relatorio_${runs.length}_importacoes_${new Date().toLocaleDateString('pt-PT').replace(/\//g, '-')}`
    : `reconciliacao_${(filename || '').replace(/[^a-z0-9]/gi, '_')}_${(dataRun || '').replace(/\//g, '-')}`;

  const toggleAll = (setter, cols, val) =>
    setter(Object.fromEntries(cols.map(c => [c.key, val])));

  // ── Month grouping helpers ─────────────────────────────────────────────────
  const monthKey   = d => d ? String(d).slice(0, 7) || '9999-99' : '9999-99';
  const monthLabel = d => {
    if (!d) return 'Sem data';
    const dt = new Date(d + '-01');
    return isNaN(dt) ? 'Sem data' : dt.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  };
  const groupByMonth = (items, getDate) => {
    const map = new Map();
    for (const item of items) {
      const key = monthKey(getDate(item));
      if (!map.has(key)) map.set(key, { label: monthLabel(key), items: [] });
      map.get(key).items.push(item);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g);
  };
  const sumValor = (items, getVal) => items.reduce((s, i) => s + (Number(getVal(i)) || 0), 0);
  const entityTotals = (items, getValorFn, getEntityFn) => {
    const map = new Map();
    for (const item of items) {
      const key = getEntityFn(item);
      if (!map.has(key)) map.set(key, { count: 0, total: 0 });
      const e = map.get(key);
      e.count++;
      e.total += Number(getValorFn(item)) || 0;
    }
    return [...map.entries()].sort(([, a], [, b]) => b.total - a.total);
  };

  // Extrai nome da entidade da descrição bancária:
  // após "PARA", toma palavras consecutivas alfabéticas (nome próprio) e para no primeiro token com dígitos/símbolos
  const extractEntityBank = (o) => {
    const d = (o.transacao?.descricao || '').trim();
    const m = d.match(/(?:\bPARA\b|P\/)[ \t]*/i);
    if (m) {
      const after = d.slice(m.index + m[0].length);
      const nameWords = [];
      for (const w of after.split(/\s+/)) {
        if (/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'-]*$/.test(w)) {
          nameWords.push(w);
          if (nameWords.length >= 5) break;
        } else {
          break;
        }
      }
      if (nameWords.length > 0) return nameWords.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    const toTc = s => s.split(/\s+/).map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w).join(' ');
    return toTc(d.slice(0, 50)) || '(sem descrição)';
  };

  // ── CSV ────────────────────────────────────────────────────────────────────
  const handleDownloadCsv = () => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const parts = [];

    parts.push(esc('RELATÓRIO DE RECONCILIAÇÃO BANCÁRIA'));
    if (isMulti) {
      parts.push([esc('Importações'), esc(runs.length), esc('Ficheiros'), esc(runs.map(r => r.filename).join(', '))].join(';'));
    } else {
      parts.push([esc('Ficheiro'), esc(filename), esc('Data'), esc(dataRun)].join(';'));
    }
    parts.push('');

    const buildSection = (title, allItems, activeCols, getCellFn, getDateFn, getValorFn, getEntityFn) => {
      const lines = [esc(title), activeCols.map(c => esc(c.label)).join(';')];
      const valorIdx = activeCols.findIndex(c => c.key === 'valor');
      const totalRow = (label, total) => activeCols.map((_, i) =>
        i === 0 ? esc(label) : i === valorIdx && valorIdx >= 0 ? esc(Number(total).toFixed(2)) : '""'
      ).join(';');

      const addEntityBlock = (items) => {
        if (!incluirTotalEntidade || !getEntityFn || !items.length) return;
        const entRows = entityTotals(items, getValorFn, getEntityFn);
        lines.push([esc('Entidade'), esc('Movimentos'), esc('Total')].join(';'));
        entRows.forEach(([entity, { count, total }]) =>
          lines.push([esc(entity), esc(count), esc(total.toFixed(2))].join(';'))
        );
      };

      if (isMulti) {
        let grand = 0;
        for (const { label, items } of groupByMonth(allItems, getDateFn)) {
          lines.push(esc(`── ${label.toUpperCase()} ──`));
          items.forEach(item => lines.push(activeCols.map(c => esc(getCellFn(item, c.key))).join(';')));
          const t = sumValor(items, getValorFn);
          grand += t;
          lines.push(totalRow(`TOTAL ${label.toUpperCase()}`, t));
          addEntityBlock(items);
          lines.push('');
        }
        lines.push(totalRow('TOTAL GERAL', grand));
        if (incluirTotalEntidade && getEntityFn && allItems.length > 0) {
          lines.push('');
          lines.push(esc('TOTAL GERAL POR ENTIDADE'));
          lines.push([esc('Entidade'), esc('Movimentos'), esc('Total')].join(';'));
          entityTotals(allItems, getValorFn, getEntityFn).forEach(([entity, { count, total }]) =>
            lines.push([esc(entity), esc(count), esc(total.toFixed(2))].join(';'))
          );
        }
      } else {
        allItems.forEach(item => lines.push(activeCols.map(c => esc(getCellFn(item, c.key))).join(';')));
        if (valorIdx >= 0) lines.push(totalRow('TOTAL', sumValor(allItems, getValorFn)));
        if (incluirTotalEntidade && getEntityFn && allItems.length > 0) {
          lines.push('');
          lines.push(esc('TOTAIS POR ENTIDADE'));
          for (const { label, items } of groupByMonth(allItems, getDateFn)) {
            lines.push(esc(label.toUpperCase()));
            addEntityBlock(items);
            lines.push('');
          }
          lines.push(esc('TOTAL GERAL POR ENTIDADE'));
          lines.push([esc('Entidade'), esc('Movimentos'), esc('Total')].join(';'));
          entityTotals(allItems, getValorFn, getEntityFn).forEach(([entity, { count, total }]) =>
            lines.push([esc(entity), esc(count), esc(total.toFixed(2))].join(';'))
          );
        }
      }
      return lines.join('\n');
    };

    if (secoes.matched)       parts.push(buildSection('RECONCILIADOS',  data.matched       || [], COLS_MATCHED.filter(c => colsM[c.key]),  getMatchedCell,    m => m.transacao?.data,        m => m.transacao?.valor, m => m.rule === 'confirmed_manual' ? (m.classificacao?.nome || 'Confirmado Manual') : (m.fatura?.entidade || '').trim() || '(sem entidade)'), '');
    if (secoes.orphan_bank)   parts.push(buildSection('ÓRFÃOS BANCO',   data.orphan_bank   || [], COLS_ORPHAN_BANK.filter(c => colsOB[c.key]), getOrphanBankCell, o => o.transacao?.data,        o => o.transacao?.valor, extractEntityBank), '');
    if (secoes.orphan_system) parts.push(buildSection('ÓRFÃOS SISTEMA', data.orphan_system || [], COLS_ORPHAN_SYS.filter(c => colsOS[c.key]),  getOrphanSysCell,  o => o.fatura?.data_documento, o => o.fatura?.valor,    o => (o.fatura?.entidade || '').trim() || '(sem entidade)'));

    const blob = new Blob(['﻿' + parts.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${reportName}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(16); doc.setTextColor(30);
    doc.text('Relatório de Reconciliação Bancária', 14, 18);
    doc.setFontSize(8); doc.setTextColor(120);
    const subtitle = isMulti
      ? `${runs.length} importações   |   Reconciliados: ${data.matched?.length ?? 0}   |   Órfãos Banco: ${data.orphan_bank?.length ?? 0}   |   Órfãos Sistema: ${data.orphan_system?.length ?? 0}`
      : `Ficheiro: ${filename}   |   Data: ${dataRun}   |   Reconciliados: ${data.matched?.length ?? 0}   |   Órfãos Banco: ${data.orphan_bank?.length ?? 0}   |   Órfãos Sistema: ${data.orphan_system?.length ?? 0}`;
    doc.text(subtitle, 14, 25);

    let curY = 32;

    const addPdfSection = (title, allItems, activeCols, getCellFn, getDateFn, getValorFn, headColor, getEntityFn) => {
      doc.setFontSize(8); doc.setTextColor(80); doc.text(title, 14, curY); curY += 3;

      const addEntityPdfBlock = (items) => {
        if (!incluirTotalEntidade || !getEntityFn || !items.length) return;
        const entRows = entityTotals(items, getValorFn, getEntityFn);
        autoTable(doc, {
          startY: curY,
          head: [['Entidade', 'Movimentos', 'Total']],
          body: entRows.map(([entity, { count, total }]) => [entity, String(count), `€${total.toFixed(2)}`]),
          styles: { fontSize: 6, cellPadding: 1.2 },
          headStyles: { fillColor: [100, 116, 139], textColor: 255, fontStyle: 'bold', fontSize: 6 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
          tableWidth: 120,
        });
        curY = doc.lastAutoTable.finalY + 3;
      };

      if (isMulti) {
        let grand = 0;
        for (const { label, items } of groupByMonth(allItems, getDateFn)) {
          const monthTotal = sumValor(items, getValorFn);
          grand += monthTotal;
          const body = items.map(item => activeCols.map(c => String(getCellFn(item, c.key) ?? '')));
          const subtotalRow = activeCols.map((c, i) =>
            i === 0 ? `Total ${label}` : (c.key === 'valor' ? `€${monthTotal.toFixed(2)}` : '')
          );
          body.push(subtotalRow);
          autoTable(doc, {
            startY: curY,
            head: [[{ content: label.toUpperCase(), colSpan: activeCols.length, styles: { fillColor: [226, 232, 240], textColor: 50, fontStyle: 'bold', fontSize: 7 } }], activeCols.map(c => c.label)],
            body,
            styles: { fontSize: 7, cellPadding: 1.5 },
            headStyles: { fillColor: headColor, textColor: 255, fontStyle: 'bold' },
            didParseCell: d => { if (d.section === 'body' && d.row.index === body.length - 1) { d.cell.styles.fillColor = [241, 245, 249]; d.cell.styles.fontStyle = 'bold'; } },
          });
          curY = doc.lastAutoTable.finalY + 2;
          addEntityPdfBlock(items);
        }
        autoTable(doc, {
          startY: curY,
          body: [activeCols.map((c, i) => i === 0 ? 'TOTAL GERAL' : (c.key === 'valor' ? `€${grand.toFixed(2)}` : ''))],
          styles: { fontSize: 8, cellPadding: 2, fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [30, 41, 59] },
        });
        curY = doc.lastAutoTable.finalY + 4;
        if (incluirTotalEntidade && getEntityFn && allItems.length > 0) {
          doc.setFontSize(7); doc.setTextColor(60); doc.setFont(undefined, 'bold'); doc.text('Total Geral por Entidade', 14, curY); doc.setFont(undefined, 'normal'); curY += 3;
          addEntityPdfBlock(allItems);
        }
        curY += 4;
      } else {
        const body = allItems.map(item => activeCols.map(c => String(getCellFn(item, c.key) ?? '')));
        const total = sumValor(allItems, getValorFn);
        body.push(activeCols.map((c, i) => i === 0 ? 'TOTAL' : (c.key === 'valor' ? `€${total.toFixed(2)}` : '')));
        autoTable(doc, {
          startY: curY,
          head: [activeCols.map(c => c.label)],
          body,
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: headColor, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 247, 255] },
          didParseCell: d => { if (d.section === 'body' && d.row.index === body.length - 1) { d.cell.styles.fillColor = [241, 245, 249]; d.cell.styles.fontStyle = 'bold'; } },
        });
        curY = doc.lastAutoTable.finalY + 4;
        if (incluirTotalEntidade && getEntityFn && allItems.length > 0) {
          doc.setFontSize(7); doc.setTextColor(100); doc.text('Totais por Entidade', 14, curY); curY += 3;
          for (const { label, items } of groupByMonth(allItems, getDateFn)) {
            doc.setFontSize(6.5); doc.setTextColor(80); doc.text(label, 14, curY); curY += 2;
            addEntityPdfBlock(items);
          }
          doc.setFontSize(7); doc.setTextColor(60); doc.setFont(undefined, 'bold'); doc.text('Total Geral por Entidade', 14, curY); doc.setFont(undefined, 'normal'); curY += 3;
          addEntityPdfBlock(allItems);
        }
        curY += 4;
      }
    };

    if (secoes.matched)       addPdfSection('RECONCILIADOS',  data.matched       || [], COLS_MATCHED.filter(c => colsM[c.key]),  getMatchedCell,    m => m.transacao?.data,        m => m.transacao?.valor, [79, 70, 229],  m => m.rule === 'confirmed_manual' ? (m.classificacao?.nome || 'Confirmado Manual') : (m.fatura?.entidade || '').trim() || '(sem entidade)');
    if (secoes.orphan_bank)   addPdfSection('ÓRFÃOS BANCO',   data.orphan_bank   || [], COLS_ORPHAN_BANK.filter(c => colsOB[c.key]), getOrphanBankCell, o => o.transacao?.data,        o => o.transacao?.valor, [217, 119, 6],  extractEntityBank);
    if (secoes.orphan_system) addPdfSection('ÓRFÃOS SISTEMA', data.orphan_system || [], COLS_ORPHAN_SYS.filter(c => colsOS[c.key]),  getOrphanSysCell,  o => o.fatura?.data_documento, o => o.fatura?.valor,    [225, 29, 72],  o => (o.fatura?.entidade || '').trim() || '(sem entidade)');

    doc.save(`${reportName}.pdf`);
  };

  const ColChecks = ({ cols, state, setter, label }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
        <div className="flex gap-2">
          <button onClick={() => toggleAll(setter, cols, true)}  className="text-[9px] text-indigo-500 hover:underline">Todos</button>
          <button onClick={() => toggleAll(setter, cols, false)} className="text-[9px] text-slate-400 hover:underline">Nenhum</button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {cols.map(c => (
          <label key={c.key} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={!!state[c.key]} onChange={() => setter(p => ({ ...p, [c.key]: !p[c.key] }))}
              className="accent-indigo-600 w-3.5 h-3.5" />
            <span className="text-[11px] text-slate-600">{c.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Configurar Relatório</h3>
            {isMulti && <p className="text-xs text-slate-400 mt-0.5">{runs.length} importações · agrupado por mês</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Formato</p>
          <div className="flex gap-2">
            {[{ k: 'csv', l: 'CSV (Excel)' }, { k: 'pdf', l: 'PDF' }].map(({ k, l }) => (
              <button key={k} onClick={() => setFormato(k)}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${formato === k ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Secções a incluir</p>
          <div className="flex flex-wrap gap-2">
            {[
              { k: 'matched',       l: `Reconciliados (${data.matched?.length ?? 0})`,       color: 'emerald' },
              { k: 'orphan_bank',   l: `Órfãos Banco (${data.orphan_bank?.length ?? 0})`,    color: 'amber'   },
              { k: 'orphan_system', l: `Órfãos Sistema (${data.orphan_system?.length ?? 0})`, color: 'rose'   },
            ].map(({ k, l, color }) => (
              <button key={k} onClick={() => setSecoes(p => ({ ...p, [k]: !p[k] }))}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                  secoes[k]
                    ? color === 'emerald' ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                    : color === 'amber'   ? 'bg-amber-100 text-amber-700 border-amber-300'
                    :                       'bg-rose-100 text-rose-700 border-rose-300'
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}>
                {secoes[k] ? '✓ ' : ''}{l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Opções</p>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={incluirTotalEntidade} onChange={() => setIncluirTotalEntidade(p => !p)}
              className="accent-indigo-600 w-4 h-4" />
            <span className="text-xs text-slate-600 font-medium">Incluir total por entidade</span>
          </label>
        </div>

        <div className="space-y-5">
          {secoes.matched       && <ColChecks cols={COLS_MATCHED}     state={colsM}  setter={setColsM}  label="Colunas — Reconciliados" />}
          {secoes.orphan_bank   && <ColChecks cols={COLS_ORPHAN_BANK} state={colsOB} setter={setColsOB} label="Colunas — Órfãos Banco" />}
          {secoes.orphan_system && <ColChecks cols={COLS_ORPHAN_SYS}  state={colsOS} setter={setColsOS} label="Colunas — Órfãos Sistema" />}
        </div>

        <button onClick={formato === 'csv' ? handleDownloadCsv : handleDownloadPdf}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
          <Download size={14} /> Download {formato.toUpperCase()}
        </button>
      </div>
    </div>
  );
}

function CsvMappingCard({ csvMapping, colMap, setColMap, previewing, confirmarMapeamento, onCancel }) {
  const cols = csvMapping.columns;
  const canConfirm = colMap.dataCol && (colMap.modo === 'valor' ? colMap.valorCol : (colMap.debitoCol || colMap.creditoCol));

  const colSamples = (col) =>
    csvMapping.preview.slice(0, 3).map(r => r[col]).filter(v => v != null && v !== '').join(', ');

  const mkSelect = (field) => (
    <select
      value={colMap[field]}
      onChange={e => setColMap(p => ({ ...p, [field]: e.target.value }))}
      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
    >
      <option value="">— não usar —</option>
      {cols.map(c => {
        const samples = colSamples(c);
        return <option key={c} value={c}>{c}{samples ? ` — ${samples}` : ''}</option>;
      })}
    </select>
  );

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-amber-100 p-6 sm:p-8 space-y-5">
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-600">Mapear Colunas do CSV</h3>
        <p className="text-xs text-slate-400 mt-0.5">As colunas deste ficheiro não foram reconhecidas automaticamente. Indica qual coluna corresponde a cada campo.</p>
      </div>

      {/* Layout: prévia à esquerda, dropdowns à direita */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Prévia da tabela — sempre visível enquanto mapeia */}
        <div className="lg:flex-1 overflow-auto max-h-80 rounded-xl border border-slate-100">
          <table className="text-[11px] w-full">
            <thead className="bg-slate-50 sticky top-0">
              <tr>{cols.map(c => <th key={c} className="px-3 py-2 text-left text-slate-500 font-black uppercase tracking-widest whitespace-nowrap">{c}</th>)}</tr>
            </thead>
            <tbody>
              {csvMapping.preview.map((row, i) => (
                <tr key={i} className="border-t border-slate-50">
                  {cols.map(c => <td key={c} className="px-3 py-2 text-slate-600 whitespace-nowrap">{row[c]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dropdowns de mapeamento */}
        <div className="lg:w-72 space-y-4">
          {/* Seletor modo valor vs débito/crédito */}
          <div className="flex gap-2 flex-wrap">
            {[{ k: 'valor', l: 'Valor único' }, { k: 'debcred', l: 'Déb + Créd' }].map(({ k, l }) => (
              <button key={k} onClick={() => setColMap(p => ({ ...p, modo: k }))}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${colMap.modo === k ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {l}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Data <span className="text-rose-400">*</span></label>
            {mkSelect('dataCol')}
          </div>
          {colMap.modo === 'valor' ? (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Valor <span className="text-rose-400">*</span></label>
              {mkSelect('valorCol')}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Débito (saída)</label>
                {mkSelect('debitoCol')}
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Crédito (entrada)</label>
                {mkSelect('creditoCol')}
              </div>
            </>
          )}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Descrição</label>
            {mkSelect('descricaoCol')}
          </div>
          {colMap.modo === 'valor' && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Tipo (C/D, Entrada/Saída)</label>
              {mkSelect('tipoCol')}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={confirmarMapeamento} disabled={!canConfirm || previewing}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
              {previewing ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeftRight size={12} />}
              Aplicar
            </button>
            <button onClick={onCancel}
              className="px-4 py-2 text-slate-400 hover:text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Utilitários de auto-associação ───────────────────────────────────────────
function previousMonth(dateStr) {
  if (!dateStr || dateStr.length < 7) {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().substring(0, 7);
  }
  const [year, month] = dateStr.substring(0, 7).split('-').map(Number);
  const d = new Date(year, month - 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const LEGAL_SUFFIXES = /\b(lda|unipessoal|s\.?a\.?|ltd|lda\.|plc|inc|corp|sl|srl|bv)\b\.?/gi;

function normStrClient(s) {
  return String(s)
    .toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // remover diacríticos
    .replace(/[.,\-_/\\()'"]/g, ' ')                    // pontuação → espaço
    .replace(LEGAL_SUFFIXES, '')                         // sufixos legais
    .replace(/\s+/g, ' ').trim();
}

// Extrai tokens significativos (3+ chars) de um nome
function sigTokens(name) {
  return normStrClient(name).split(' ').filter(w => w.length >= 3);
}

function matchClientByDesc(descricao, clients) {
  const descNorm = normStrClient(descricao || '');
  let bestMatch = null;
  let bestScore = 0;

  for (const client of (clients || [])) {
    const tokens = sigTokens(client.name || '');
    if (tokens.length === 0) continue;

    // Conta quantos tokens do nome do cliente aparecem na descrição
    const hits = tokens.filter(t => descNorm.includes(t)).length;
    const score = hits / tokens.length; // 0-1

    // Exige pelo menos 75% dos tokens a corresponder (≥1 token sempre)
    if (hits >= 1 && score >= 0.75 && score > bestScore) {
      bestScore = score;
      bestMatch = client;
    }
  }
  return bestMatch;
}

export default function ReconciliacaoAdmin() {
  const { supabase, clients } = useApp();

  // ── Upload state ──────────────────────────────────────────────────────────
  const [ficheiros, setFicheiros] = useState([]);         // File[]
  const [previewErrors, setPreviewErrors] = useState([]); // { filename, error }[]
  const [dragging, setDragging] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [erro, setErro] = useState(null);
  const inputRef = useRef(null);

  // ── Preview / seleção de movimentos ───────────────────────────────────────
  const [previewTransacoes, setPreviewTransacoes] = useState(null); // null = não em preview
  const [previewFilename, setPreviewFilename] = useState('');
  const [selTransacoes, setSelTransacoes] = useState(new Set());
  const [txSearch, setTxSearch] = useState('');
  const [txTipoFiltro, setTxTipoFiltro] = useState('todos'); // 'todos' | 'debito' | 'credito'

  // ── Edição inline de descrição na pré-visualização ───────────────────────
  const [editingTxIdx, setEditingTxIdx] = useState(null);

  // ── Edição inline de descrição nos resultados (histórico/run actual) ──────
  const [editingResultDesc, setEditingResultDesc] = useState(null); // { section, index, value }

  // ── Mapeamento de colunas CSV ─────────────────────────────────────────────
  const [csvMapping, setCsvMapping] = useState(null); // { columns, preview } quando needs_mapping
  const [colMap, setColMap] = useState({ dataCol: '', valorCol: '', descricaoCol: '', debitoCol: '', creditoCol: '', tipoCol: '', modo: 'valor' });

  // ── Resultados ────────────────────────────────────────────────────────────
  const [resultado, setResultado] = useState(null);      // resposta da API
  const [activeSubTab, setActiveSubTab] = useState('matched'); // matched | orphan_bank | orphan_system
  const [confirmando, setConfirmando] = useState(new Set()); // IDs em processo
  const [selMatched, setSelMatched] = useState(new Set());    // índices seleccionados em Reconciliados
  const [selOrphan, setSelOrphan] = useState(new Set());      // índices seleccionados em Órfãos Banco
  const [confirmedOrphans, setConfirmedOrphans] = useState(new Set()); // índices confirmados órfãos
  const [orphanObservacoes, setOrphanObservacoes] = useState({}); // { [index]: string }
  const [pendingOrphanConfirm, setPendingOrphanConfirm] = useState(null); // { indices: number[] }
  const [orphanObs, setOrphanObs] = useState('');
  const [bulkConfirmando, setBulkConfirmando] = useState(false);
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [selHistorico, setSelHistorico] = useState(new Set());
  const [relatorioRuns, setRelatorioRuns] = useState(null);
  const [aliases, setAliases] = useState([]);
  const [saveAlias, setSaveAlias] = useState(false);
  const [showAliases, setShowAliases] = useState(false);
  const [loadingMultiRel, setLoadingMultiRel] = useState(false);

  // ── Classificação de Órfãos ───────────────────────────────────────────────
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);        // { id, nome, cor }
  const [orphanClassificacoes, setOrphanClassificacoes] = useState({}); // { [index]: { nome, cor } }
  const [showNovaTag, setShowNovaTag] = useState(false);
  const [novaTagNome, setNovaTagNome] = useState('');
  const [novaTagCor, setNovaTagCor] = useState('indigo');
  const [savingTag, setSavingTag] = useState(false);

  // ── Associação Manual ────────────────────────────────────────────────────
  const [pendingAssociacao, setPendingAssociacao] = useState(null); // { index, transacao }
  const [assocFaturas, setAssocFaturas] = useState([]);
  const [loadingAssoc, setLoadingAssoc] = useState(false);
  const [assocSearch, setAssocSearch] = useState('');

  // ── Histórico ─────────────────────────────────────────────────────────────
  const [historico, setHistorico] = useState([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [runSelecionado, setRunSelecionado] = useState(null); // run do histórico a ver
  const [reprocessando, setReprocessando] = useState(null); // id do run a reprocessar

  // ── Formulário inserção manual ─────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'fatura', valor: '', data_documento: '', descricao: '', entidade: '', fonte: 'manual'
  });
  const [savingFatura, setSavingFatura] = useState(false);

  // ── Auto-associação de entradas a clientes ────────────────────────────────
  const [autoAssociando, setAutoAssociando] = useState(false);

  const autoAssociarEntradas = async (resultsJson, runId) => {
    if (!supabase || !clients?.length || !runId) return 0;
    const { data: existentes } = await supabase
      .from('faturacao_clientes_pagamentos')
      .select('transaction_section, transaction_index')
      .eq('reconciliation_run_id', runId);
    const jaAssociados = new Set((existentes || []).map(p => `${p.transaction_section}_${p.transaction_index}`));
    const toInsert = [];
    for (const { key, items } of [
      { key: 'matched',     items: resultsJson.matched || [] },
      { key: 'orphan_bank', items: resultsJson.orphan_bank || [] },
    ]) {
      items.forEach((item, idx) => {
        const tx = item.transacao ?? item;
        if (tx?.tipo !== 'credito') return;
        if (jaAssociados.has(`${key}_${idx}`)) return;
        const client = matchClientByDesc(tx.descricao, clients);
        if (!client) return;
        toInsert.push({
          client_id: client.id,
          period: previousMonth(tx.data),
          reconciliation_run_id: runId,
          transaction_section: key,
          transaction_index: idx,
          transaction_data: tx,
          valor_pago: Number(tx.valor || 0),
        });
      });
    }
    if (toInsert.length > 0) await supabase.from('faturacao_clientes_pagamentos').insert(toInsert);
    return toInsert.length;
  };

  // ── Associação a Cliente (Faturação) ──────────────────────────────────────
  const [assocClienteModal, setAssocClienteModal] = useState(null); // { section, index, tx, runId }
  const [assocClienteId, setAssocClienteId] = useState('');
  const [assocPeriodo, setAssocPeriodo] = useState('');
  const [assocSaving, setAssocSaving] = useState(false);
  const [pagamentosLinks, setPagamentosLinks] = useState([]); // faturacao_clientes_pagamentos para o run actual

  const carregarPagamentosLinks = async (runId) => {
    if (!runId || !supabase) return;
    const { data } = await supabase
      .from('faturacao_clientes_pagamentos')
      .select('*')
      .eq('reconciliation_run_id', runId);
    setPagamentosLinks(data || []);
  };

  const linkKey = (section, index) => `${section}_${index}`;
  const txLinkInfo = (section, index) =>
    pagamentosLinks.find(p => p.transaction_section === section && p.transaction_index === index);

  const abrirAssociarCliente = (section, index, tx) => {
    const runId = runSelecionado?.id ?? resultado?.run_id;
    const txDate = tx?.data || '';
    const defaultPeriod = previousMonth(txDate);
    setAssocClienteModal({ section, index, tx, runId });
    setAssocClienteId('');
    setAssocPeriodo(defaultPeriod);
  };

  const salvarAssociacaoCliente = async () => {
    if (!assocClienteModal || !assocClienteId || !assocPeriodo) return;
    setAssocSaving(true);
    const { section, index, tx, runId } = assocClienteModal;
    const existente = txLinkInfo(section, index);
    if (existente) {
      await supabase.from('faturacao_clientes_pagamentos').delete().eq('id', existente.id);
    }
    await supabase.from('faturacao_clientes_pagamentos').insert({
      client_id: assocClienteId,
      period: assocPeriodo,
      reconciliation_run_id: runId,
      transaction_section: section,
      transaction_index: index,
      transaction_data: tx,
      valor_pago: Number(tx?.valor || 0),
    });
    await carregarPagamentosLinks(runId);
    setAssocSaving(false);
    setAssocClienteModal(null);
    if (section === 'orphan_bank') setActiveSubTab('matched');
  };

  const removerAssociacaoCliente = async (section, index) => {
    const existente = txLinkInfo(section, index);
    if (!existente) return;
    await supabase.from('faturacao_clientes_pagamentos').delete().eq('id', existente.id);
    const runId = runSelecionado?.id ?? resultado?.run_id;
    await carregarPagamentosLinks(runId);
  };

  // Carregar histórico e tags ao montar
  useEffect(() => {
    carregarHistorico();
    carregarTags();
  }, []);

  // Carregar links de cliente quando muda o run activo
  useEffect(() => {
    const runId = runSelecionado?.id ?? resultado?.run_id;
    if (runId) carregarPagamentosLinks(runId);
    else setPagamentosLinks([]);
  }, [runSelecionado?.id, resultado?.run_id]);

  // Restaurar estado de confirmações ao mudar de run (histórico ou novo upload)
  useEffect(() => {
    const bank = runSelecionado
      ? (runSelecionado.results_json?.orphan_bank || [])
      : (resultado?.orphan_bank || []);
    const confirmed = new Set();
    const obs = {};
    const classif = {};
    bank.forEach((item, i) => {
      if (item.confirmed) {
        confirmed.add(i);
        if (item.observacao) obs[i] = item.observacao;
        if (item.classificacao) classif[i] = item.classificacao;
      }
    });
    setConfirmedOrphans(confirmed);
    setOrphanObservacoes(obs);
    setOrphanClassificacoes(classif);
  }, [runSelecionado?.id, resultado?.run_id]);

  const carregarTags = async () => {
    const { data } = await supabase
      .from('reconciliation_classificacao_tags')
      .select('id, nome, cor')
      .order('created_at', { ascending: true });
    if (data) setTags(data);
  };

  const criarTag = async () => {
    if (!novaTagNome.trim()) return;
    setSavingTag(true);
    try {
      const { data, error } = await supabase
        .from('reconciliation_classificacao_tags')
        .insert({ nome: novaTagNome.trim(), cor: novaTagCor })
        .select('id, nome, cor')
        .single();
      if (error) throw error;
      setTags(prev => [...prev, data]);
      setSelectedTag(data);
      setShowNovaTag(false);
      setNovaTagNome('');
      setNovaTagCor('indigo');
    } catch (err) {
      alert(`Erro ao criar tag: ${err.message}`);
    } finally {
      setSavingTag(false);
    }
  };

  const carregarHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const [{ data, error }, { data: aliasData }] = await Promise.all([
        supabase
          .from('reconciliation_runs')
          .select('id, created_at, filename, transaction_count, matched_count, orphan_bank_count, orphan_system_count')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('reconciliacao_entity_aliases').select('*').order('created_at', { ascending: false }),
      ]);
      if (!error) setHistorico(data || []);
      setAliases(aliasData || []);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const apagarRun = async (e, runId) => {
    e.stopPropagation();
    if (!window.confirm('Apagar esta importação? As faturas confirmadas voltarão a PENDENTE.')) return;
    const { data: runData } = await supabase
      .from('reconciliation_runs')
      .select('results_json')
      .eq('id', runId)
      .single();
    if (runData?.results_json?.matched?.length) {
      const faturaIds = runData.results_json.matched
        .filter(m => m.fatura?.fonte !== 'recibo')
        .map(m => m.fatura?.id)
        .filter(Boolean);
      const reciboMatches = runData.results_json.matched
        .filter(m => m.fatura?.fonte === 'recibo' && m.fatura?.id);
      if (faturaIds.length) await supabase.from('faturas').update({ status: 'PENDENTE' }).in('id', faturaIds);
      // Reverter cada recibo para o seu estado original (valido ou aviso)
      if (reciboMatches.length) {
        const porEstado = {};
        for (const m of reciboMatches) {
          const est = m.fatura.estado_original || 'valido';
          if (!porEstado[est]) porEstado[est] = [];
          porEstado[est].push(m.fatura.id);
        }
        await Promise.all(
          Object.entries(porEstado).map(([est, ids]) =>
            supabase.from('receipt_validations').update({ estado: est }).in('id', ids)
          )
        );
      }
    }
    const { error, count } = await supabase.from('reconciliation_runs').delete({ count: 'exact' }).eq('id', runId);
    if (error) { alert(`Erro ao apagar: ${error.message}`); return; }
    if (count === 0) { alert('Sem permissão para apagar. Aplique a política RLS de DELETE na tabela reconciliation_runs.'); return; }
    setHistorico(prev => prev.filter(r => r.id !== runId));
    if (runSelecionado?.id === runId) setRunSelecionado(null);
  };

  const reprocessarRun = async (e, runId) => {
    e.stopPropagation();
    setReprocessando(runId);
    try {
      const res = await fetch('/api/reconciliacao/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Erro ao reprocessar.'); return; }
      // Actualizar contadores no histórico
      setHistorico(prev => prev.map(r => r.id === runId
        ? { ...r, matched_count: data.matched_count, orphan_bank_count: data.orphan_bank_count, orphan_system_count: data.orphan_system_count }
        : r
      ));
      // Se este run estava seleccionado, actualizar resultados visíveis
      if (runSelecionado?.id === runId) {
        setRunSelecionado(prev => ({
          ...prev,
          matched_count: data.matched_count,
          orphan_bank_count: data.orphan_bank_count,
          orphan_system_count: data.orphan_system_count,
          results_json: { matched: data.matched, orphan_bank: data.orphan_bank, orphan_system: data.orphan_system },
        }));
      }
      // Se é o resultado activo corrente, actualizar também
      if (resultado?.run_id === runId) {
        setResultado(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      alert(err.message || 'Erro de rede.');
    } finally {
      setReprocessando(null);
    }
  };

  // ── Drag & Drop handlers ──────────────────────────────────────────────────
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    adicionarFicheiros(e.dataTransfer.files);
  };
  const handleFileChange = (e) => {
    adicionarFicheiros(e.target.files);
    e.target.value = '';
  };
  const adicionarFicheiros = (fileList) => {
    setErro(null);
    const validos = [];
    const invalidos = [];
    for (const f of fileList) {
      const ext = f.name.split('.').pop().toLowerCase();
      if (['csv', 'ofx', 'qfx', 'pdf'].includes(ext)) validos.push(f);
      else invalidos.push(f.name);
    }
    if (invalidos.length) setErro(`Formato não suportado: ${invalidos.join(', ')}. Aceites: CSV, OFX, QFX, PDF.`);
    if (validos.length) setFicheiros(prev => {
      const existentes = new Set(prev.map(f => f.name));
      return [...prev, ...validos.filter(f => !existentes.has(f.name))];
    });
  };

  // ── Etapa 1: pré-visualizar movimentos do extrato ────────────────────────
  const previsar = async () => {
    if (!ficheiros.length) return;
    setPreviewing(true);
    setErro(null);
    setPreviewErrors([]);
    const allTx = [];
    const errors = [];
    const multiSource = ficheiros.length > 1;
    for (let idx = 0; idx < ficheiros.length; idx++) {
      const f = ficheiros[idx];
      try {
        const fp = new FormData();
        fp.append('file', f);
        const res = await fetch('/api/reconciliacao/parse', { method: 'POST', body: fp });
        const data = await res.json();
        if (!res.ok) { errors.push({ filename: f.name, error: data.error || 'Erro ao ler' }); continue; }
        if (data.needs_mapping) {
          // Guardar restantes para depois do mapeamento
          const remaining = ficheiros.slice(idx + 1);
          if (allTx.length) {
            setPreviewTransacoes(allTx);
            setSelTransacoes(new Set(allTx.map((_, i) => i)));
          }
          setFicheiros([f, ...remaining]);
          setCsvMapping({ columns: data.columns, preview: data.preview });
          setColMap({ dataCol: '', valorCol: '', descricaoCol: '', debitoCol: '', creditoCol: '', tipoCol: '', modo: 'valor' });
          setPreviewFilename(data.filename);
          if (errors.length) setPreviewErrors(errors);
          setPreviewing(false);
          return;
        }
        allTx.push(...data.transactions.map(tx => ({ ...tx, _source: multiSource ? f.name : undefined })));
      } catch (err) {
        errors.push({ filename: f.name, error: err.message || 'Erro de rede' });
      }
    }
    if (errors.length) setPreviewErrors(errors);
    if (allTx.length) {
      setPreviewTransacoes(allTx);
      setPreviewFilename(ficheiros.map(f => f.name).join(', '));
      setSelTransacoes(new Set(allTx.map((_, i) => i)));
      setTxSearch('');
      setTxTipoFiltro('todos');
    }
    setFicheiros([]);
    setPreviewing(false);
  };

  // ── Confirmar mapeamento de colunas e re-parsear ──────────────────────
  const confirmarMapeamento = async () => {
    if (!ficheiros.length) return;
    const ficheiroAtual = ficheiros[0];
    const restantes = ficheiros.slice(1);
    const mapping = { ...colMap };
    setPreviewing(true);
    setErro(null);
    try {
      const formPayload = new FormData();
      formPayload.append('file', ficheiroAtual);
      formPayload.append('column_mapping', JSON.stringify(mapping));
      const res = await fetch('/api/reconciliacao/parse', { method: 'POST', body: formPayload });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro ao ler ficheiro.'); return; }
      const novasTx = data.transactions.map(tx => ({ ...tx, _source: restantes.length || previewTransacoes?.length ? ficheiroAtual.name : undefined }));
      const merged = [...(previewTransacoes || []), ...novasTx];
      setCsvMapping(null);
      setPreviewTransacoes(merged);
      setSelTransacoes(new Set(merged.map((_, i) => i)));
      setTxSearch('');
      setTxTipoFiltro('todos');
      // Continuar com ficheiros restantes
      if (restantes.length) {
        setFicheiros(restantes);
      } else {
        setFicheiros([]);
      }
    } catch (err) {
      setErro(err.message || 'Erro de rede.');
    } finally {
      setPreviewing(false);
    }
  };

  // ── Etapa 2: processar movimentos seleccionados ────────────────────────
  const processar = async () => {
    if (!previewTransacoes) return;
    const selected = previewTransacoes.filter((_, i) => selTransacoes.has(i));
    if (!selected.length) { setErro('Seleccione pelo menos um movimento.'); return; }
    setProcessando(true);
    setErro(null);
    setResultado(null);
    try {
      const res = await fetch('/api/reconciliacao/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions_json: selected, filename: previewFilename }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro ao processar.'); return; }
      setResultado(data);
      setActiveSubTab('matched');
      setPreviewTransacoes(null);
      setFicheiros([]);
      carregarHistorico();
      if (data.run_id) {
        await autoAssociarEntradas(data, data.run_id);
        await carregarPagamentosLinks(data.run_id);
      }
    } catch (err) {
      setErro(err.message || 'Erro de rede.');
    } finally {
      setProcessando(false);
    }
  };

  // ── Confirmar Pagamento (individual, não-bulk per D-10) ────────────────────
  const confirmarPagamento = async (faturaId, fonte) => {
    setConfirmando(prev => new Set(prev).add(faturaId));
    try {
      if (fonte === 'recibo') {
        const { error } = await supabase
          .from('receipt_validations')
          .update({ estado: 'pago' })
          .eq('id', faturaId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('faturas')
          .update({ status: 'PAGO' })
          .eq('id', faturaId);
        if (error) throw error;
      }
      const updateMatched = matched => matched.map(m =>
        m.fatura.id === faturaId ? { ...m, fatura: { ...m.fatura, status: 'PAGO' } } : m
      );

      // Actualizar estado local
      const runId = runSelecionado?.id ?? resultado?.run_id;
      let newMatched;
      if (runSelecionado) {
        newMatched = updateMatched(runSelecionado.results_json.matched || []);
        setRunSelecionado(prev => ({
          ...prev,
          results_json: { ...prev.results_json, matched: newMatched },
        }));
      } else {
        newMatched = updateMatched(resultado?.matched || []);
        setResultado(prev => ({ ...prev, matched: newMatched }));
      }

      // Persistir no results_json do run para que o histórico reflicta o status
      if (runId) {
        const baseResults = runSelecionado?.results_json ?? {
          matched: resultado?.matched || [],
          orphan_bank: resultado?.orphan_bank || [],
          orphan_system: resultado?.orphan_system || [],
        };
        await supabase
          .from('reconciliation_runs')
          .update({ results_json: { ...baseResults, matched: newMatched } })
          .eq('id', runId);
      }
    } catch (err) {
      alert(`Erro ao confirmar pagamento: ${err.message}`);
    } finally {
      setConfirmando(prev => { const s = new Set(prev); s.delete(faturaId); return s; });
    }
  };

  // ── Bulk: confirmar pagamento para seleccionados em Reconciliados ─────────
  const confirmarBulkMatched = async () => {
    if (!selMatched.size) return;
    setBulkConfirmando(true);
    try {
      const currentMatched = (runSelecionado ? runSelecionado.results_json : resultado)?.matched || [];
      const items = currentMatched.filter((_, i) => selMatched.has(i) && _.fatura.status !== 'PAGO');
      if (!items.length) return;

      // Deduplicate por ID (splits não devem confirmar o mesmo recibo duas vezes)
      const seenIds = new Set();
      const uniqueItems = items.filter(m => { if (seenIds.has(m.fatura.id)) return false; seenIds.add(m.fatura.id); return true; });
      const allIds = uniqueItems.map(m => m.fatura.id);
      setConfirmando(new Set(allIds));

      // Todos os updates em paralelo (já deduplicados)
      await Promise.all(uniqueItems.map(item =>
        item.fatura.fonte === 'recibo'
          ? supabase.from('receipt_validations').update({ estado: 'pago' }).eq('id', item.fatura.id)
          : supabase.from('faturas').update({ status: 'PAGO' }).eq('id', item.fatura.id)
      ));

      // Actualizar estado local uma única vez com todos os IDs
      const idSet = new Set(allIds);
      const updateAllMatched = matched => matched.map(m =>
        idSet.has(m.fatura.id) ? { ...m, fatura: { ...m.fatura, status: 'PAGO' } } : m
      );

      const runId = runSelecionado?.id ?? resultado?.run_id;
      let newMatched;
      if (runSelecionado) {
        newMatched = updateAllMatched(runSelecionado.results_json.matched || []);
        setRunSelecionado(prev => ({
          ...prev,
          results_json: { ...prev.results_json, matched: newMatched },
        }));
      } else {
        newMatched = updateAllMatched(resultado?.matched || []);
        setResultado(prev => ({ ...prev, matched: newMatched }));
      }

      // Persistir no run
      if (runId) {
        const baseResults = runSelecionado?.results_json ?? {
          matched: resultado?.matched || [],
          orphan_bank: resultado?.orphan_bank || [],
          orphan_system: resultado?.orphan_system || [],
        };
        await supabase
          .from('reconciliation_runs')
          .update({ results_json: { ...baseResults, matched: newMatched } })
          .eq('id', runId);
      }

      setSelMatched(new Set());
      setConfirmando(new Set());
    } catch (err) {
      alert(`Erro ao confirmar pagamentos: ${err.message}`);
    } finally {
      setBulkConfirmando(false);
    }
  };

  // ── Confirmar movimento em Órfãos Banco — abre modal para observação ────────
  const pedirObservacaoOrphan = (indices) => {
    setPendingOrphanConfirm({ indices });
    setOrphanObs('');
    setSelectedTag(null);
    setShowNovaTag(false);
    setNovaTagNome('');
  };

  const confirmarMovimento = async () => {
    if (!pendingOrphanConfirm) return;
    const { indices } = pendingOrphanConfirm;
    const idxSet = new Set(indices);
    const obsText = orphanObs.trim();
    const tag = selectedTag ? { nome: selectedTag.nome, cor: selectedTag.cor } : null;

    setPendingOrphanConfirm(null);
    setOrphanObs('');
    setSelectedTag(null);
    setSelOrphan(new Set());

    const runId = runSelecionado?.id ?? resultado?.run_id;
    if (!runId) return;

    const baseResults = runSelecionado?.results_json ?? {
      matched: resultado?.matched || [],
      orphan_bank: resultado?.orphan_bank || [],
      orphan_system: resultado?.orphan_system || [],
    };

    const sourceBank = baseResults.orphan_bank;
    const newOrphanBank = sourceBank.filter((_, i) => !idxSet.has(i));
    const newManualMatches = sourceBank
      .filter((_, i) => idxSet.has(i))
      .map(item => ({
        transacao: item.transacao,
        fatura: null,
        rule: 'confirmed_manual',
        observacao: obsText || null,
        classificacao: tag,
      }));

    const newMatched = [...(baseResults.matched || []), ...newManualMatches];
    const newResults = { ...baseResults, matched: newMatched, orphan_bank: newOrphanBank };

    // Actualizar estado imediatamente (optimistic)
    if (runSelecionado) {
      setRunSelecionado(prev => ({ ...prev, results_json: newResults }));
    } else {
      setResultado(prev => ({ ...prev, matched: newMatched, orphan_bank: newOrphanBank }));
    }

    const { error } = await supabase
      .from('reconciliation_runs')
      .update({ results_json: newResults })
      .eq('id', runId);
    if (error) console.error('Erro ao persistir confirmação:', error.message);
  };

  // ── Associação Manual de Órfão Banco a Fatura ────────────────────────────
  const abrirAssociarFatura = async (index, transacao) => {
    setPendingAssociacao({ index, transacao });
    setAssocSearch('');
    setLoadingAssoc(true);
    try {
      const [{ data: faturas }, { data: recibos }] = await Promise.all([
        supabase
          .from('faturas')
          .select('id, tipo, valor, data_documento, descricao, entidade, status, fonte, dados, filename')
          .not('status', 'eq', 'PAGO')
          .order('data_documento', { ascending: false })
          .limit(100),
        supabase
          .from('receipt_validations')
          .select('id, worker_name, liquido_extraido, mes, estado')
          .not('estado', 'eq', 'pago')
          .limit(100),
      ]);
      const recibosNorm = (recibos || []).map(r => ({
        id: r.id,
        tipo: 'recibo',
        fonte: 'recibo',
        valor: r.liquido_extraido,
        data_documento: null,
        descricao: `Recibo ${r.worker_name || ''} ${r.mes || ''}`.trim(),
        entidade: r.worker_name || '',
        status: r.estado,
        estado_original: r.estado,
        dados: null,
        filename: null,
      }));
      setAssocFaturas([...(faturas || []), ...recibosNorm]);
    } finally {
      setLoadingAssoc(false);
    }
  };

  const confirmarAssociacaoManual = async (fatura) => {
    if (!pendingAssociacao) return;
    const { index, transacao } = pendingAssociacao;

    const sourceMatchedCheck = runSelecionado
      ? (runSelecionado.results_json?.matched || [])
      : (resultado?.matched || []);
    const isSplit = sourceMatchedCheck.some(m => m.fatura?.id === fatura.id);
    const novoMatch = { transacao, fatura: { ...fatura, valor: fatura.valor ?? fatura.dados?.valor_total }, rule: isSplit ? 'manual_split' : 'manual' };

    const runId = runSelecionado?.id ?? resultado?.run_id;
    if (!runId) { setPendingAssociacao(null); return; }

    const sourceBank = runSelecionado
      ? (runSelecionado.results_json?.orphan_bank || [])
      : (resultado?.orphan_bank || []);
    const sourceMatched = runSelecionado
      ? (runSelecionado.results_json?.matched || [])
      : (resultado?.matched || []);
    const sourceSystem = runSelecionado
      ? (runSelecionado.results_json?.orphan_system || [])
      : (resultado?.orphan_system || []);

    const newOrphanBank = sourceBank.filter((_, i) => i !== index);
    const newMatched = [...sourceMatched, novoMatch];
    const newOrphanSystem = sourceSystem.filter(s => s.fatura?.id !== fatura.id);

    const baseResults = runSelecionado?.results_json ?? {
      matched: resultado?.matched || [],
      orphan_bank: resultado?.orphan_bank || [],
      orphan_system: resultado?.orphan_system || [],
    };
    const newResults = {
      ...baseResults,
      matched: newMatched,
      orphan_bank: newOrphanBank,
      orphan_system: newOrphanSystem,
    };

    const { error } = await supabase
      .from('reconciliation_runs')
      .update({
        results_json: newResults,
        matched_count: newMatched.length,
        orphan_bank_count: newOrphanBank.length,
        orphan_system_count: newOrphanSystem.length,
      })
      .eq('id', runId);
    if (error) { alert(`Erro ao guardar associação: ${error.message}`); return; }

    if (runSelecionado) {
      setRunSelecionado(prev => ({
        ...prev,
        matched_count: newMatched.length,
        orphan_bank_count: newOrphanBank.length,
        orphan_system_count: newOrphanSystem.length,
        results_json: newResults,
      }));
    } else {
      setResultado(prev => ({
        ...prev,
        matched: newMatched,
        orphan_bank: newOrphanBank,
        orphan_system: newOrphanSystem,
        matched_count: newMatched.length,
        orphan_bank_count: newOrphanBank.length,
        orphan_system_count: newOrphanSystem.length,
      }));
    }
    setHistorico(prev => prev.map(r => r.id === runId
      ? { ...r, matched_count: newMatched.length, orphan_bank_count: newOrphanBank.length, orphan_system_count: newOrphanSystem.length }
      : r
    ));
    if (saveAlias && fatura.entidade) {
      const bankName = extractEntityFromDescUI(transacao.descricao || '');
      const { data: newAlias } = await supabase
        .from('reconciliacao_entity_aliases')
        .upsert({ bank_name: bankName, system_entity: fatura.entidade }, { onConflict: 'bank_name,system_entity' })
        .select()
        .single();
      if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => !(a.bank_name === bankName && a.system_entity === fatura.entidade))]);
    }
    setSaveAlias(false);
    setPendingAssociacao(null);
  };

  // ── Extracção de entidade para UI (espelho da lógica do engine) ────────────
  const extractEntityFromDescUI = (desc) => {
    const patterns = [
      /TRF\s+IMEDIATA\s+DE\s+/i, /TRANSFERENCIA\s+DE\s+/i,
      /TRANSF(?:ERENCIA)?\s+DE\s+/i, /TRF\s+DE\s+/i,
      /ORDEM\s+DE\s+PAGAMENTO\s+DE\s+/i, /PAGAMENTO\s+DE\s+/i,
      /PAGT\s+DE\s+/i, /RECEBIDO\s+DE\s+/i, /REC\s+DE\s+/i,
    ];
    for (const p of patterns) {
      const m = desc.match(p);
      if (m) return desc.slice(m.index + m[0].length).trim();
    }
    return desc;
  };

  const apagarAlias = async (id) => {
    await supabase.from('reconciliacao_entity_aliases').delete().eq('id', id);
    setAliases(prev => prev.filter(a => a.id !== id));
  };

  // ── Guardar fatura manual ─────────────────────────────────────────────────
  const guardarFatura = async () => {
    if (!formData.valor || !formData.data_documento) {
      alert('Valor e data são obrigatórios.');
      return;
    }
    setSavingFatura(true);
    try {
      const { error } = await supabase.from('faturas').insert({
        tipo: formData.tipo,
        valor: parseFloat(formData.valor),
        data_documento: formData.data_documento,
        descricao: formData.descricao,
        entidade: formData.entidade,
        fonte: 'manual',
        status: 'PENDENTE',
        gmail_message_id: `manual-${Date.now()}`, // campo NOT NULL do schema original
        filename: `manual-${Date.now()}.txt`,
        storage_path: '',
        url: '',
      });
      if (error) throw error;
      setShowForm(false);
      setFormData({ tipo: 'fatura', valor: '', data_documento: '', descricao: '', entidade: '', fonte: 'manual' });
    } catch (err) {
      alert(`Erro ao guardar fatura: ${err.message}`);
    } finally {
      setSavingFatura(false);
    }
  };

  // ── Desvincular match ────────────────────────────────────────────────────
  const [desvinculando, setDesvinculando] = useState(new Set());

  const desvincularMatch = async (matchItem, matchIndex) => {
    const key = `${matchIndex}`;
    setDesvinculando(prev => new Set(prev).add(key));
    try {
      const runId = runSelecionado?.id ?? resultado?.run_id;
      const base = runSelecionado?.results_json ?? {
        matched: resultado?.matched || [],
        orphan_bank: resultado?.orphan_bank || [],
        orphan_system: resultado?.orphan_system || [],
      };

      const newMatched      = base.matched.filter((_, i) => i !== matchIndex);
      const newOrphanBank   = [...base.orphan_bank, { transacao: matchItem.transacao, reason: 'desvinculado' }];
      const newOrphanSystem = matchItem.fatura
        ? [...base.orphan_system, { fatura: matchItem.fatura, reason: 'desvinculado' }]
        : base.orphan_system;
      const newResults = { matched: newMatched, orphan_bank: newOrphanBank, orphan_system: newOrphanSystem };

      // Reverter status se estiver PAGO
      if (matchItem.fatura?.status === 'PAGO') {
        if (matchItem.fatura.fonte === 'recibo') {
          await supabase.from('receipt_validations')
            .update({ estado: matchItem.fatura.estado_original || 'valido' })
            .eq('id', matchItem.fatura.id);
        } else {
          await supabase.from('faturas').update({ status: 'PENDENTE' }).eq('id', matchItem.fatura.id);
        }
      }

      if (runId) {
        await supabase.from('reconciliation_runs').update({
          results_json: newResults,
          matched_count: newMatched.length,
          orphan_bank_count: newOrphanBank.length,
          orphan_system_count: newOrphanSystem.length,
        }).eq('id', runId);
      }

      if (runSelecionado) {
        setRunSelecionado(prev => ({ ...prev, results_json: newResults }));
      } else {
        setResultado(prev => ({ ...prev, ...newResults }));
      }
    } catch (err) {
      alert(`Erro ao desvincular: ${err.message}`);
    } finally {
      setDesvinculando(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  // ── Excluir item de um run ───────────────────────────────────────────────
  const [excluindo, setExcluindo] = useState(new Set());

  const excluirItem = async (section, index) => {
    const key = `${section}_${index}`;
    setExcluindo(prev => new Set(prev).add(key));
    try {
      const runId = runSelecionado?.id ?? resultado?.run_id;
      const base = runSelecionado?.results_json ?? {
        matched: resultado?.matched || [],
        orphan_bank: resultado?.orphan_bank || [],
        orphan_system: resultado?.orphan_system || [],
      };
      let newMatched = [...base.matched];
      let newOrphanBank = [...base.orphan_bank];
      let newOrphanSystem = [...base.orphan_system];

      if (section === 'matched') {
        const item = newMatched[index];
        if (item?.fatura?.status === 'PAGO') {
          if (item.fatura.fonte === 'recibo') {
            await supabase.from('receipt_validations').update({ estado: item.fatura.estado_original || 'valido' }).eq('id', item.fatura.id);
          } else {
            await supabase.from('faturas').update({ status: 'PENDENTE' }).eq('id', item.fatura.id);
          }
        }
        newMatched = newMatched.filter((_, i) => i !== index);
      } else if (section === 'orphan_bank') {
        newOrphanBank = newOrphanBank.filter((_, i) => i !== index);
      } else if (section === 'orphan_system') {
        newOrphanSystem = newOrphanSystem.filter((_, i) => i !== index);
      }

      const newResults = { matched: newMatched, orphan_bank: newOrphanBank, orphan_system: newOrphanSystem };
      if (runId) {
        await supabase.from('reconciliation_runs').update({
          results_json: newResults,
          matched_count: newMatched.length,
          orphan_bank_count: newOrphanBank.length,
          orphan_system_count: newOrphanSystem.length,
        }).eq('id', runId);
      }
      if (runSelecionado) {
        setRunSelecionado(prev => ({ ...prev, results_json: newResults }));
      } else {
        setResultado(prev => ({ ...prev, ...newResults }));
      }
    } catch (err) {
      alert(`Erro ao excluir: ${err.message}`);
    } finally {
      setExcluindo(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  // ── Guardar descrição editada nos resultados ──────────────────────────────
  const saveResultDescricao = async (section, index, newDesc) => {
    setEditingResultDesc(null);
    const runId = runSelecionado?.id ?? resultado?.run_id;
    const base = runSelecionado?.results_json ?? {
      matched: resultado?.matched || [],
      orphan_bank: resultado?.orphan_bank || [],
      orphan_system: resultado?.orphan_system || [],
    };
    const newSection = base[section].map((item, i) =>
      i === index ? { ...item, transacao: { ...item.transacao, descricao: newDesc } } : item
    );
    const newResults = { ...base, [section]: newSection };
    if (runId) {
      await supabase.from('reconciliation_runs').update({ results_json: newResults }).eq('id', runId);
    }
    if (runSelecionado) {
      setRunSelecionado(prev => ({ ...prev, results_json: newResults }));
    } else {
      setResultado(prev => ({ ...prev, [section]: newSection }));
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const displayData = runSelecionado
    ? { ...runSelecionado.results_json, run_id: runSelecionado.id }
    : resultado;

  const clientAssocMatched = pagamentosLinks
    .filter(p => p.transaction_section === 'orphan_bank')
    .map(p => ({
      transacao: p.transaction_data,
      fatura: null,
      rule: 'client_association',
      client_name: clients?.find(c => c.id === p.client_id)?.name || p.client_id,
      period: p.period,
      _orig_section: 'orphan_bank',
      _orig_index: p.transaction_index,
    }));
  const orphanBankAssocSet = new Set(
    pagamentosLinks.filter(p => p.transaction_section === 'orphan_bank').map(p => p.transaction_index)
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black flex items-center gap-2">
          <Landmark size={24} className="text-indigo-600" /> Reconciliação Bancária
        </h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
        >
          <Plus size={14} /> Inserir Fatura Manual
        </button>
      </div>

      {/* Formulário inserção manual */}
      {showForm && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nova Fatura / Recibo</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Tipo</label>
              <select value={formData.tipo} onChange={e => setFormData(p => ({...p, tipo: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
                <option value="fatura">Fatura</option>
                <option value="recibo">Recibo</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Valor (€)</label>
              <input type="number" step="0.01" value={formData.valor} onChange={e => setFormData(p => ({...p, valor: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Data Documento</label>
              <input type="date" value={formData.data_documento} onChange={e => setFormData(p => ({...p, data_documento: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Entidade (nome/NIF)</label>
              <input type="text" value={formData.entidade} onChange={e => setFormData(p => ({...p, entidade: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="Nome ou NIF" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Descrição</label>
              <input type="text" value={formData.descricao} onChange={e => setFormData(p => ({...p, descricao: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="Descrição opcional" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={guardarFatura} disabled={savingFatura}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
              {savingFatura ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Guardar
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-500 hover:text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Zona de Upload */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 sm:p-8">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
          Importar Extrato Bancário
        </h3>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
          }`}
        >
          <input ref={inputRef} type="file" accept=".csv,.ofx,.qfx,.pdf" multiple className="hidden" onChange={handleFileChange} />
          <Upload size={32} className={`mx-auto mb-3 ${dragging ? 'text-indigo-500' : 'text-slate-300'}`} />
          {ficheiros.length > 0 ? (
            <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
              {ficheiros.map((f, idx) => (
                <div key={idx} className="flex items-center justify-center gap-2">
                  <FileText size={14} className="text-indigo-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 truncate max-w-xs">{f.name}</span>
                  <button onClick={() => setFicheiros(prev => prev.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-rose-500 flex-shrink-0">
                    <X size={13} />
                  </button>
                </div>
              ))}
              <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest pt-1 cursor-pointer hover:underline"
                onClick={() => inputRef.current?.click()}>
                + Adicionar mais ficheiros
              </p>
            </div>
          ) : (
            <>
              <p className="text-slate-500 font-medium">Arraste ficheiros CSV, OFX ou PDF aqui</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">ou clique para escolher (múltiplos permitidos)</p>
            </>
          )}
        </div>

        {erro && (
          <div className="mt-3 flex items-start gap-2 bg-rose-50 text-rose-700 rounded-xl p-3 text-sm">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {previewErrors.length > 0 && (
          <div className="mt-3 space-y-1">
            {previewErrors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 bg-amber-50 text-amber-700 rounded-xl p-3 text-xs">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span><strong>{e.filename}</strong>: {e.error}</span>
              </div>
            ))}
          </div>
        )}
        {ficheiros.length > 0 && !previewing && !csvMapping && (
          <button onClick={previsar}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-2xl py-3 hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest">
            <ArrowLeftRight size={14} /> Pré-visualizar {ficheiros.length > 1 ? `${ficheiros.length} Ficheiros` : 'Movimentos'}
          </button>
        )}
        {previewing && (
          <div className="mt-4 flex items-center justify-center gap-2 text-indigo-600">
            <Loader2 size={18} className="animate-spin" /> A ler ficheiros...
          </div>
        )}
      </div>

      {/* Mapeamento de colunas CSV */}
      {csvMapping && (
        <CsvMappingCard
          csvMapping={csvMapping}
          colMap={colMap}
          setColMap={setColMap}
          previewing={previewing}
          confirmarMapeamento={confirmarMapeamento}
          onCancel={() => { setCsvMapping(null); setFicheiros([]); setErro(null); }}
        />
      )}

      {/* Preview de movimentos — etapa de seleção */}
      {previewTransacoes && (() => {
        const q = txSearch.trim().toLowerCase();
        const visibleIndices = previewTransacoes
          .map((tx, i) => ({ tx, i }))
          .filter(({ tx }) => {
            if (txTipoFiltro !== 'todos' && tx.tipo !== txTipoFiltro) return false;
            if (q && !tx.descricao.toLowerCase().includes(q) && !String(tx.valor).includes(q)) return false;
            return true;
          });
        const nDebito = previewTransacoes.filter(t => t.tipo === 'debito').length;
        const nCredito = previewTransacoes.filter(t => t.tipo === 'credito').length;
        const allVisible = visibleIndices.map(x => x.i);
        const allVisibleSelected = allVisible.length > 0 && allVisible.every(i => selTransacoes.has(i));
        return (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Seleccionar Movimentos
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selTransacoes.size} de {previewTransacoes.length} seleccionados
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setPreviewTransacoes(null); setFicheiros([]); setPreviewErrors([]); setErro(null); }}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:border-slate-300 transition-all"
                >
                  <X size={11} className="inline mr-1" />Cancelar
                </button>
                <button
                  onClick={processar}
                  disabled={processando || selTransacoes.size === 0}
                  className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                >
                  {processando ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeftRight size={12} />}
                  Processar {selTransacoes.size > 0 ? `(${selTransacoes.size})` : ''}
                </button>
              </div>
            </div>

            {/* Filtro por tipo */}
            <div className="flex gap-2">
              {[
                { key: 'todos', label: `Todos (${previewTransacoes.length})` },
                { key: 'debito', label: `Saídas (${nDebito})` },
                { key: 'credito', label: `Entradas (${nCredito})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTxTipoFiltro(key)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                    txTipoFiltro === key
                      ? key === 'debito' ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-300'
                        : key === 'credito' ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                        : 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              value={txSearch}
              onChange={e => setTxSearch(e.target.value)}
              placeholder="Filtrar por descrição ou valor..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />

            <div className="flex items-center gap-3 px-1">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={e => {
                    setSelTransacoes(prev => {
                      const s = new Set(prev);
                      allVisible.forEach(i => e.target.checked ? s.add(i) : s.delete(i));
                      return s;
                    });
                  }}
                  className="accent-indigo-600 w-4 h-4"
                />
                {allVisibleSelected ? 'Desseleccionar visíveis' : 'Seleccionar visíveis'}
              </label>
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {visibleIndices.length === 0 && (
                <p className="text-center text-slate-400 py-6 text-sm">Nenhum movimento corresponde ao filtro.</p>
              )}
              {visibleIndices.map(({ tx, i }) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${selTransacoes.has(i) ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50 border border-transparent hover:bg-slate-100'}`}>
                  <input
                    type="checkbox"
                    checked={selTransacoes.has(i)}
                    onChange={e => setSelTransacoes(prev => { const s = new Set(prev); e.target.checked ? s.add(i) : s.delete(i); return s; })}
                    className="accent-indigo-600 w-4 h-4 flex-shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    {tx._source && (
                      <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 truncate mb-0.5">{tx._source}</p>
                    )}
                    {editingTxIdx === i ? (
                      <input
                        autoFocus
                        className="w-full text-xs text-slate-700 font-medium border-b border-indigo-400 bg-transparent outline-none pb-0.5"
                        value={tx.descricao}
                        onChange={e => setPreviewTransacoes(prev => prev.map((t, j) => j === i ? { ...t, descricao: e.target.value } : t))}
                        onBlur={() => setEditingTxIdx(null)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTxIdx(null); }}
                      />
                    ) : (
                      <p className="text-xs text-slate-700 font-medium truncate">{tx.descricao || '—'}</p>
                    )}
                    <p className="text-[10px] text-slate-400">{tx.data}</p>
                  </div>
                  <button
                    onClick={() => setEditingTxIdx(editingTxIdx === i ? null : i)}
                    className={`flex-shrink-0 transition-all ${editingTxIdx === i ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-400'}`}
                    title="Editar descrição"
                  >
                    <Pencil size={12} />
                  </button>
                  <div className="text-right flex-shrink-0 flex items-center gap-2">
                    <TipoBadge tipo={tx.tipo} />
                    <span className="text-sm font-bold text-slate-700">€{Number(tx.valor).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Sub-tabs de Resultados */}
      {displayData && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 sm:p-8">
          {runSelecionado && (
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
              <button onClick={() => setRunSelecionado(null)}
                className="text-indigo-600 hover:underline text-[10px] font-black uppercase tracking-widest">
                ← Voltar ao run actual
              </button>
              <span>· A ver: {runSelecionado.filename} ({new Date(runSelecionado.created_at).toLocaleDateString('pt-PT')})</span>
            </div>
          )}

          {/* Sub-tab buttons + download */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex flex-1 gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
              {[
                { key: 'matched', label: 'Reconciliados', count: displayData.matched?.length ?? 0 },
                { key: 'orphan_bank', label: 'Órfãos Banco', count: displayData.orphan_bank?.length ?? 0 },
                { key: 'orphan_system', label: 'Órfãos Sistema', count: displayData.orphan_system?.length ?? 0 },
              ].map(tab => (
                <button key={tab.key} onClick={() => { setActiveSubTab(tab.key); setSelMatched(new Set()); setSelOrphan(new Set()); }}
                  className={`flex-1 flex-shrink-0 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeSubTab === tab.key ? 'bg-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                  }`}>
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
            <button
              onClick={async () => {
                const runId = runSelecionado?.id ?? displayData?.run_id;
                const rj = runSelecionado?.results_json ?? { matched: displayData?.matched || [], orphan_bank: displayData?.orphan_bank || [] };
                if (!runId) return;
                setAutoAssociando(true);
                const n = await autoAssociarEntradas(rj, runId);
                await carregarPagamentosLinks(runId);
                setAutoAssociando(false);
                if (n > 0) alert(`${n} entrada${n > 1 ? 's' : ''} associada${n > 1 ? 's' : ''} automaticamente.`);
                else alert('Nenhuma nova entrada com cliente identificável.');
              }}
              disabled={autoAssociando}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0 disabled:opacity-50"
              title="Associar automaticamente entradas bancárias a clientes (por nome na descrição)"
            >
              {autoAssociando ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} Auto
            </button>
            <button onClick={() => setShowAliases(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-violet-100 text-slate-500 hover:text-violet-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0">
              <Tag size={13} /> Aliases {aliases.length > 0 && `(${aliases.length})`}
            </button>
            <button onClick={() => setShowRelatorio(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0">
              <Download size={13} /> Relatório
            </button>
          </div>

          {/* Sub-tab: Reconciliados */}
          {activeSubTab === 'matched' && (() => {
            const items = [...(displayData.matched || []), ...clientAssocMatched];
            const faturaIdCount = items.reduce((acc, m) => { if (m.fatura?.id) acc[m.fatura.id] = (acc[m.fatura.id] || 0) + 1; return acc; }, {});
            const allPendentes = items.filter(m => m.fatura?.status !== 'PAGO');
            return (
              <div className="space-y-3">
                {items.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Nenhuma transação reconciliada.</p>}
                {items.length > 0 && (
                  <div className="flex items-center justify-between mb-1">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer select-none">
                      <input type="checkbox"
                        checked={allPendentes.length > 0 && selMatched.size === allPendentes.length}
                        onChange={e => setSelMatched(e.target.checked ? new Set(items.map((_, i) => i).filter(i => items[i].fatura?.status !== 'PAGO')) : new Set())}
                        className="accent-emerald-600 w-4 h-4" />
                      Seleccionar todos
                    </label>
                    {selMatched.size > 0 && (
                      <button onClick={confirmarBulkMatched} disabled={bulkConfirmando}
                        className="flex items-center gap-1 bg-emerald-600 text-white rounded-xl px-4 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50">
                        {bulkConfirmando ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                        Confirmar Selecionados ({selMatched.size})
                      </button>
                    )}
                  </div>
                )}
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-emerald-50 rounded-2xl p-4">
                    {item.fatura?.status !== 'PAGO' && item.rule !== 'confirmed_manual' && item.rule !== 'client_association' && (
                      <input type="checkbox" checked={selMatched.has(i)}
                        onChange={e => setSelMatched(prev => { const s = new Set(prev); e.target.checked ? s.add(i) : s.delete(i); return s; })}
                        className="accent-emerald-600 w-4 h-4 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TipoBadge tipo={item.transacao?.tipo} />
                        <span className="text-sm font-bold text-slate-700">€{Number(item.transacao?.valor ?? 0).toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400">{item.transacao?.data}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                          {item.rule === 'client_association' ? 'Banco' : item.fatura?.fonte === 'recibo' ? 'Recibo' : item.fatura?.tipo || 'Fatura'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {item.rule === 'client_association' ? item.client_name : item.fatura?.entidade}
                        </span>
                        {item.rule === 'client_association' && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest">cliente · {item.period}</span>
                        )}
                        {item.rule === 'confirmed_manual' && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest">confirmado</span>
                        )}
                        {item.rule === 'alias_match' && (
                          <span className="text-[9px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full uppercase tracking-widest">alias</span>
                        )}
                        {item.rule === 'manual' && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest">manual</span>
                        )}
                        {item.rule === 'manual_split' && (
                          <span className="text-[9px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full uppercase tracking-widest">split</span>
                        )}
                        {item.rule === 'description_match' && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-widest">desc</span>
                        )}
                        {item.rule === 'date_proximity' && (
                          <span className="text-[9px] bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full uppercase tracking-widest">data</span>
                        )}
                        {faturaIdCount[item.fatura?.id] > 1 && item.rule !== 'manual_split' && (
                          <span className="text-[9px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full uppercase tracking-widest">2 movimentos</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {editingResultDesc?.section === 'matched' && editingResultDesc?.index === i ? (
                          <input
                            autoFocus
                            className="flex-1 text-xs text-slate-700 font-medium border-b border-indigo-400 bg-transparent outline-none pb-0.5"
                            value={editingResultDesc.value}
                            onChange={e => setEditingResultDesc(prev => ({ ...prev, value: e.target.value }))}
                            onBlur={() => saveResultDescricao('matched', i, editingResultDesc.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveResultDescricao('matched', i, editingResultDesc.value);
                              if (e.key === 'Escape') setEditingResultDesc(null);
                            }}
                          />
                        ) : (
                          <p className="flex-1 text-xs text-slate-600 truncate font-medium">{item.transacao?.descricao}</p>
                        )}
                        <button
                          onClick={() => setEditingResultDesc({ section: 'matched', index: i, value: item.transacao?.descricao || '' })}
                          className={`flex-shrink-0 transition-all ${editingResultDesc?.section === 'matched' && editingResultDesc?.index === i ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-400'}`}
                          title="Editar descrição"
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                      {item.fatura?.descricao && (
                        <p className="text-xs text-slate-500 truncate">{item.fatura.entidade} · {item.fatura.descricao}</p>
                      )}
                      {item.rule === 'confirmed_manual' && (item.observacao || item.classificacao) && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {item.classificacao && <TagBadge nome={item.classificacao.nome} cor={item.classificacao.cor} />}
                          {item.observacao && <span className="italic ml-1">{item.observacao}</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {item.transacao?.tipo === 'credito' && (() => {
                        if (item.rule === 'client_association') {
                          return (
                            <span
                              title={`Associado a ${item.client_name} (${item.period}) — clique para remover`}
                              className="flex items-center gap-1 text-indigo-500 text-[9px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-full cursor-pointer hover:bg-rose-50 hover:text-rose-500"
                              onClick={() => removerAssociacaoCliente(item._orig_section, item._orig_index)}
                            >
                              <Link2 size={10} /> {item.client_name}
                            </span>
                          );
                        }
                        const link = txLinkInfo('matched', i);
                        const clientName = link ? (clients?.find(c => c.id === link.client_id)?.name || link.client_id) : null;
                        return link ? (
                          <span
                            title={`Associado a ${clientName} (${link.period})`}
                            className="flex items-center gap-1 text-indigo-500 text-[9px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-full cursor-pointer hover:bg-rose-50 hover:text-rose-500"
                            onClick={() => removerAssociacaoCliente('matched', i)}
                          >
                            <Link2 size={10} /> {clientName}
                          </span>
                        ) : (
                          <button
                            onClick={() => abrirAssociarCliente('matched', i, item.transacao)}
                            title="Associar a cliente de faturação"
                            className="p-1.5 rounded-xl text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                          >
                            <Link2 size={13} />
                          </button>
                        );
                      })()}
                      {item.rule === 'confirmed_manual' ? (
                        <span className="flex items-center gap-1 text-indigo-500 text-[10px] font-black uppercase tracking-widest">
                          <CheckCircle size={14} /> Confirmado
                        </span>
                      ) : item.fatura?.status === 'PAGO' ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                          <CheckCircle size={14} /> Pago
                        </span>
                      ) : (
                        <button onClick={() => confirmarPagamento(item.fatura?.id, item.fatura?.fonte)}
                          disabled={confirmando.has(item.fatura?.id)}
                          className="flex items-center gap-1 bg-emerald-600 text-white rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50">
                          {confirmando.has(item.fatura?.id) ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                          Confirmar
                        </button>
                      )}
                      <button
                        onClick={() => desvincularMatch(item, i)}
                        disabled={desvinculando.has(`${i}`)}
                        title="Desvincular"
                        className="p-1.5 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50">
                        {desvinculando.has(`${i}`) ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
                      </button>
                      <button
                        onClick={() => { if (window.confirm('Excluir este movimento dos resultados?')) excluirItem('matched', i); }}
                        disabled={excluindo.has(`matched_${i}`)}
                        title="Excluir movimento"
                        className="p-1.5 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50">
                        {excluindo.has(`matched_${i}`) ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Sub-tab: Órfãos Banco */}
          {activeSubTab === 'orphan_bank' && (() => {
            const items = (displayData.orphan_bank || []).filter((_, i) => !confirmedOrphans.has(i) && !orphanBankAssocSet.has(i));
            const allIndices = (displayData.orphan_bank || []).map((_, i) => i).filter(i => !confirmedOrphans.has(i) && !orphanBankAssocSet.has(i));
            return (
              <div className="space-y-3">
                {items.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Sem transações sem correspondência.</p>}
                {items.length > 0 && (
                  <div className="flex items-center justify-between mb-1">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer select-none">
                      <input type="checkbox"
                        checked={allIndices.length > 0 && selOrphan.size === allIndices.length}
                        onChange={e => setSelOrphan(e.target.checked ? new Set(allIndices) : new Set())}
                        className="accent-indigo-600 w-4 h-4" />
                      Seleccionar todos
                    </label>
                    {selOrphan.size > 0 && (
                      <button onClick={() => pedirObservacaoOrphan([...selOrphan])}
                        className="flex items-center gap-1 bg-indigo-600 text-white rounded-xl px-4 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                        <CheckCircle size={12} /> Confirmar Selecionados ({selOrphan.size})
                      </button>
                    )}
                  </div>
                )}
                {(displayData.orphan_bank || []).map((item, i) => {
                  const isConfirmed = confirmedOrphans.has(i);
                  if (isConfirmed) {
                    const classif = orphanClassificacoes[i];
                    return (
                      <div key={i} className="rounded-2xl p-4 bg-slate-50 border border-slate-100 opacity-70">
                        <div className="flex items-start gap-3">
                          <CheckCircle size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <TipoBadge tipo={item.transacao.tipo} />
                              <span className="text-sm font-bold text-slate-500">€{Number(item.transacao.valor).toFixed(2)}</span>
                              <span className="text-[10px] text-slate-400">{item.transacao.data}</span>
                              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Confirmado</span>
                              {classif && <TagBadge nome={classif.nome} cor={classif.cor} />}
                            </div>
                            {orphanObservacoes[i] && (
                              <p className="text-xs text-slate-500 mt-1 italic">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 not-italic">Obs: </span>
                                {orphanObservacoes[i]}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className={`rounded-2xl p-4 ${item.reason === 'ambiguous' ? 'bg-amber-50' : 'bg-rose-50'}`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={selOrphan.has(i)}
                          onChange={e => setSelOrphan(prev => { const s = new Set(prev); e.target.checked ? s.add(i) : s.delete(i); return s; })}
                          className="accent-indigo-600 w-4 h-4 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <TipoBadge tipo={item.transacao.tipo} />
                            <span className="text-sm font-bold text-slate-700">€{Number(item.transacao.valor).toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400">{item.transacao.data}</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${item.reason === 'ambiguous' ? 'text-amber-700' : 'text-rose-700'}`}>
                              {item.reason === 'ambiguous' ? 'Ambíguo' : 'Sem correspondência'}
                            </span>
                          </div>
                          {item.transacao.tipoMovimento && (
                            <p className="text-[10px] text-slate-500 mb-1">
                              <span className="font-black uppercase tracking-widest">Tipo Movimento:</span> {item.transacao.tipoMovimento}
                            </p>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex-shrink-0">Descrição: </span>
                            {editingResultDesc?.section === 'orphan_bank' && editingResultDesc?.index === i ? (
                              <input
                                autoFocus
                                className="flex-1 text-xs text-slate-700 font-medium border-b border-indigo-400 bg-transparent outline-none pb-0.5"
                                value={editingResultDesc.value}
                                onChange={e => setEditingResultDesc(prev => ({ ...prev, value: e.target.value }))}
                                onBlur={() => saveResultDescricao('orphan_bank', i, editingResultDesc.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveResultDescricao('orphan_bank', i, editingResultDesc.value);
                                  if (e.key === 'Escape') setEditingResultDesc(null);
                                }}
                              />
                            ) : (
                              <span className="text-xs text-slate-700 font-medium truncate">{item.transacao.descricao || '—'}</span>
                            )}
                            <button
                              onClick={() => setEditingResultDesc({ section: 'orphan_bank', index: i, value: item.transacao.descricao || '' })}
                              className={`flex-shrink-0 transition-all ${editingResultDesc?.section === 'orphan_bank' && editingResultDesc?.index === i ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-400'}`}
                              title="Editar descrição"
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                          {item.reason === 'ambiguous' && item.candidates && (
                            <p className="text-[10px] text-amber-600 mt-1">
                              Candidatos: {item.candidates.map(c => c.entidade).filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 flex gap-2">
                          {item.transacao?.tipo === 'credito' && (() => {
                            const link = txLinkInfo('orphan_bank', i);
                            const clientName = link ? (clients?.find(c => c.id === link.client_id)?.name || link.client_id) : null;
                            return link ? (
                              <span
                                title={`Associado a ${clientName} (${link.period}) — clique para remover`}
                                className="flex items-center gap-1 text-indigo-500 text-[9px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-full cursor-pointer hover:bg-rose-50 hover:text-rose-500"
                                onClick={() => removerAssociacaoCliente('orphan_bank', i)}
                              >
                                <Link2 size={10} /> {clientName}
                              </span>
                            ) : (
                              <button
                                onClick={() => abrirAssociarCliente('orphan_bank', i, item.transacao)}
                                title="Associar a cliente de faturação"
                                className="flex items-center gap-1 border border-indigo-100 text-indigo-400 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all"
                              >
                                <Link2 size={12} /> Cliente
                              </button>
                            );
                          })()}
                          <button onClick={() => abrirAssociarFatura(i, item.transacao)}
                            className="flex items-center gap-1 border border-indigo-200 text-indigo-600 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all">
                            <Tag size={12} /> Associar
                          </button>
                          <button onClick={() => pedirObservacaoOrphan([i])}
                            className="flex items-center gap-1 bg-indigo-600 text-white rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                            <CheckCircle size={12} /> Confirmar
                          </button>
                          <button
                            onClick={() => { if (window.confirm('Excluir este movimento dos resultados?')) excluirItem('orphan_bank', i); }}
                            disabled={excluindo.has(`orphan_bank_${i}`)}
                            title="Excluir movimento"
                            className="p-1.5 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50">
                            {excluindo.has(`orphan_bank_${i}`) ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Sub-tab: Órfãos Sistema */}
          {activeSubTab === 'orphan_system' && (
            <div className="space-y-3">
              {(displayData.orphan_system || []).length === 0 && (
                <p className="text-center text-slate-400 py-8 text-sm">Todas as faturas têm correspondência.</p>
              )}
              {(displayData.orphan_system || []).map((item, i) => (
                <div key={i} className="bg-rose-50 rounded-2xl p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-rose-700">Fatura sem pagamento</span>
                      <span className="text-sm font-bold text-slate-700">€{Number(item.fatura.valor).toFixed(2)}</span>
                      <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">PENDENTE</span>
                    </div>
                    <p className="text-xs text-slate-600 truncate">{item.fatura.entidade} · {item.fatura.descricao}</p>
                  </div>
                  <button
                    onClick={() => { if (window.confirm('Remover esta fatura dos resultados?')) excluirItem('orphan_system', i); }}
                    disabled={excluindo.has(`orphan_system_${i}`)}
                    title="Excluir da lista"
                    className="flex-shrink-0 p-1.5 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50">
                    {excluindo.has(`orphan_system_${i}`) ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Histórico — secção colapsável */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100">
        <button
          onClick={() => setHistoricoAberto(v => !v)}
          className="w-full flex items-center justify-between px-6 sm:px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Clock size={14} /> Histórico de Importações ({historico.length})
          </span>
          {historicoAberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {historicoAberto && (
          <div className="px-6 sm:px-8 pb-6">
            {loadingHistorico && (
              <div className="flex justify-center py-4">
                <Loader2 size={18} className="animate-spin text-indigo-400" />
              </div>
            )}
            {!loadingHistorico && historico.length === 0 && (
              <p className="text-center text-slate-400 py-4 text-sm">Nenhuma importação anterior.</p>
            )}

            {/* Barra de acções multi-selecção */}
            {selHistorico.size > 0 && (
              <div className="flex items-center justify-between mb-3 px-3 py-2 bg-indigo-50 rounded-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                  {selHistorico.size} seleccionada{selHistorico.size > 1 ? 's' : ''}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelHistorico(new Set())}
                    className="text-[10px] text-slate-400 hover:text-slate-600 font-black uppercase tracking-widest"
                  >
                    Limpar
                  </button>
                  <button
                    disabled={loadingMultiRel}
                    onClick={async () => {
                      setLoadingMultiRel(true);
                      try {
                        const { data } = await supabase
                          .from('reconciliation_runs')
                          .select('id, filename, created_at, results_json')
                          .in('id', [...selHistorico]);
                        if (data) { setRelatorioRuns(data); setShowRelatorio(true); }
                      } finally { setLoadingMultiRel(false); }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    {loadingMultiRel ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                    Relatório
                  </button>
                </div>
              </div>
            )}

            {historico.map(run => (
              <div
                key={run.id}
                onClick={async () => {
                  const { data } = await supabase
                    .from('reconciliation_runs')
                    .select('*')
                    .eq('id', run.id)
                    .single();
                  if (data) {
                    setRunSelecionado(data);
                    if (data.results_json) {
                      await autoAssociarEntradas(data.results_json, data.id);
                      await carregarPagamentosLinks(data.id);
                    }
                  }
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 cursor-pointer ${selHistorico.has(run.id) ? 'bg-indigo-50' : ''}`}
              >
                {/* Checkbox de selecção */}
                <input
                  type="checkbox"
                  checked={selHistorico.has(run.id)}
                  onClick={e => e.stopPropagation()}
                  onChange={e => {
                    e.stopPropagation();
                    setSelHistorico(prev => {
                      const s = new Set(prev);
                      e.target.checked ? s.add(run.id) : s.delete(run.id);
                      return s;
                    });
                  }}
                  className="accent-indigo-600 w-4 h-4 flex-shrink-0 mr-2 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{run.filename}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(run.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black flex-shrink-0">
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{run.matched_count} ok</span>
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{run.orphan_bank_count} banco</span>
                  <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{run.orphan_system_count} sistema</span>
                  <button
                    onClick={e => reprocessarRun(e, run.id)}
                    disabled={reprocessando === run.id}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                    title="Reprocessar extrato com faturas actuais"
                  >
                    {reprocessando === run.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  </button>
                  <button
                    onClick={e => apagarRun(e, run.id)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    title="Apagar importação"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal — Associação Manual */}
      {pendingAssociacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Associar a Fatura</h3>
              <p className="text-sm text-slate-700 mt-1 font-semibold">
                €{Number(pendingAssociacao.transacao.valor).toFixed(2)} · {pendingAssociacao.transacao.data}
              </p>
              <p className="text-xs text-slate-500 truncate">{pendingAssociacao.transacao.descricao}</p>
            </div>

            <input
              autoFocus
              value={assocSearch}
              onChange={e => setAssocSearch(e.target.value)}
              placeholder="Filtrar por entidade, descrição ou valor..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {loadingAssoc && (
                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-indigo-400" /></div>
              )}
              {!loadingAssoc && (() => {
                const q = assocSearch.toLowerCase();
                const lista = assocFaturas.filter(f => {
                  if (!q) return true;
                  const v = String(f.valor ?? f.dados?.valor_total ?? '');
                  const ent = (f.entidade || f.dados?.fornecedor || '').toLowerCase();
                  const desc = (f.descricao || f.dados?.numero_fatura || f.filename || '').toLowerCase();
                  return ent.includes(q) || desc.includes(q) || v.includes(q);
                });
                if (!lista.length) return <p className="text-center text-slate-400 py-6 text-sm">Nenhuma fatura encontrada.</p>;
                return lista.map(f => {
                  const valorF = f.valor ?? f.dados?.valor_total;
                  const diff = Math.abs((valorF ?? 0) - pendingAssociacao.transacao.valor);
                  const isClose = diff <= 0.01;
                  return (
                    <button
                      key={f.id}
                      onClick={() => confirmarAssociacaoManual(f)}
                      className={`w-full text-left p-3 rounded-xl border transition-all hover:border-indigo-400 hover:bg-indigo-50 ${isClose ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">
                            {f.entidade || f.dados?.fornecedor || f.filename || '—'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {f.descricao || f.dados?.numero_fatura || f.dados?.fornecedor || '—'}
                          </p>
                          {f.data_documento && <p className="text-[10px] text-slate-400">{f.data_documento}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${isClose ? 'text-emerald-700' : 'text-slate-700'}`}>
                            €{Number(valorF ?? 0).toFixed(2)}
                          </p>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{f.status || 'PENDENTE'}</span>
                        </div>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none px-1 pb-1">
              <input type="checkbox" checked={saveAlias} onChange={e => setSaveAlias(e.target.checked)}
                className="accent-indigo-600 w-4 h-4" />
              <span className="text-xs text-slate-600">Guardar como alias (próximos matches automáticos)</span>
            </label>

            <button
              onClick={() => { setPendingAssociacao(null); setSaveAlias(false); }}
              className="w-full py-2 text-slate-500 hover:text-slate-700 text-[10px] font-black uppercase tracking-widest"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal — Confirmar Órfão Banco */}
      {pendingOrphanConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Confirmar Movimento
                {pendingOrphanConfirm.indices.length > 1 && ` (${pendingOrphanConfirm.indices.length} movimentos)`}
              </h3>
              <p className="text-sm text-slate-500 mt-1">Classifique e/ou adicione uma observação para este movimento.</p>
            </div>

            {/* Classificação */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <Tag size={10} /> Classificação
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => {
                  const c = COR_MAP[tag.cor] || COR_MAP.gray;
                  const isSelected = selectedTag?.id === tag.id;
                  return (
                    <button
                      key={tag.id}
                      onClick={() => setSelectedTag(isSelected ? null : tag)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ring-2 transition-all ${
                        isSelected
                          ? `${c.bg} ${c.text} ${c.ring}`
                          : 'bg-slate-100 text-slate-500 ring-transparent hover:ring-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {tag.nome}
                    </button>
                  );
                })}

                {/* Criar nova tag */}
                {showNovaTag ? (
                  <div className="flex items-center gap-2 w-full mt-1 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <input
                      autoFocus
                      value={novaTagNome}
                      onChange={e => setNovaTagNome(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') criarTag(); if (e.key === 'Escape') { setShowNovaTag(false); setNovaTagNome(''); } }}
                      placeholder="Nome da classificação..."
                      className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <div className="flex items-center gap-1">
                      {CORES_DISPONIVEIS.map(cor => (
                        <button
                          key={cor}
                          onClick={() => setNovaTagCor(cor)}
                          title={cor}
                          className={`w-5 h-5 rounded-full ${COR_MAP[cor].dot} transition-all ${
                            novaTagCor === cor ? 'ring-2 ring-offset-1 ring-slate-500 scale-110' : 'opacity-60 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={criarTag}
                      disabled={!novaTagNome.trim() || savingTag}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                    >
                      {savingTag ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />} Criar
                    </button>
                    <button onClick={() => { setShowNovaTag(false); setNovaTagNome(''); }} className="text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNovaTag(true)}
                    className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-1"
                  >
                    <Plus size={10} /> Nova
                  </button>
                )}
              </div>
            </div>

            {/* Observação */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Observação {!selectedTag && <span className="text-rose-400">*</span>}
              </label>
              <textarea
                value={orphanObs}
                onChange={e => setOrphanObs(e.target.value)}
                placeholder="Ex: Pagamento de fornecedor por transferência direta, fatura pendente de envio..."
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {!selectedTag && !orphanObs.trim() && (
                <p className="text-[10px] text-slate-400">Seleccione uma classificação ou escreva uma observação.</p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={confirmarMovimento}
                disabled={!selectedTag && !orphanObs.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle size={12} /> Confirmar
              </button>
              <button
                onClick={() => { setPendingOrphanConfirm(null); setOrphanObs(''); setSelectedTag(null); setShowNovaTag(false); setNovaTagNome(''); }}
                className="px-4 py-2 text-slate-500 hover:text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Gestão de Aliases ─────────────────────────────────────────── */}
      {showAliases && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-violet-600">Aliases de Entidade</h3>
              <button onClick={() => setShowAliases(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className="text-xs text-slate-500">Liga o nome que aparece no banco ao nome da entidade no sistema. Usado para match automático em futuras importações.</p>

            {/* Formulário de adição directa */}
            <div className="bg-violet-50 rounded-2xl p-4 space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-violet-500">Adicionar alias</p>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome no banco (ex: A&G Steel Building Sl)</label>
                <input id="alias-bank" placeholder="Como aparece no extrato bancário"
                  className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Entidade no sistema</label>
                <input id="alias-system" placeholder="Nome exacto da entidade no sistema"
                  className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>
              <button onClick={async () => {
                const bankName = document.getElementById('alias-bank')?.value?.trim();
                const sysEntity = document.getElementById('alias-system')?.value?.trim();
                if (!bankName || !sysEntity) return;
                const { data: newAlias, error } = await supabase
                  .from('reconciliacao_entity_aliases')
                  .upsert({ bank_name: bankName, system_entity: sysEntity }, { onConflict: 'bank_name,system_entity' })
                  .select().single();
                if (!error && newAlias) {
                  setAliases(prev => [newAlias, ...prev.filter(a => a.id !== newAlias.id)]);
                  document.getElementById('alias-bank').value = '';
                  document.getElementById('alias-system').value = '';
                }
              }} className="w-full py-2 bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-violet-700 transition-all">
                Guardar Alias
              </button>
            </div>

            <div className="space-y-2">
              {aliases.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">Nenhum alias guardado.</p>}
              {aliases.map(a => (
                <div key={a.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{a.bank_name}</p>
                    <p className="text-[10px] text-violet-600 font-black uppercase tracking-widest truncate">→ {a.system_entity}</p>
                  </div>
                  <button onClick={() => apagarAlias(a.id)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal — Associar Pagamento a Cliente de Faturação */}
      {assocClienteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Associar a Cliente</h3>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  €{Number(assocClienteModal.tx?.valor || 0).toFixed(2)} · {assocClienteModal.tx?.data}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{assocClienteModal.tx?.descricao}</p>
              </div>
              <button onClick={() => setAssocClienteModal(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</label>
                <select
                  value={assocClienteId}
                  onChange={e => setAssocClienteId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">Selecionar cliente...</option>
                  {(clients || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Período (AAAA-MM)</label>
                <input
                  type="month"
                  value={assocPeriodo}
                  onChange={e => setAssocPeriodo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={salvarAssociacaoCliente}
                disabled={!assocClienteId || !assocPeriodo || assocSaving}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {assocSaving ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                Associar
              </button>
              <button
                onClick={() => setAssocClienteModal(null)}
                className="px-4 py-2.5 text-slate-500 hover:text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:border-slate-300 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showRelatorio && (relatorioRuns || displayData) && (
        <RelatorioModal
          displayData={relatorioRuns ? null : displayData}
          filename={runSelecionado?.filename ?? resultado?.filename ?? 'extrato'}
          dataRun={runSelecionado
            ? new Date(runSelecionado.created_at).toLocaleDateString('pt-PT')
            : new Date().toLocaleDateString('pt-PT')}
          runs={relatorioRuns}
          onClose={() => { setShowRelatorio(false); setRelatorioRuns(null); }}
        />
      )}
    </div>
  );
}
