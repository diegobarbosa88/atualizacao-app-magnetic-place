import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { X, Download } from 'lucide-react';

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

export default function RelatorioModal({ displayData, filename, dataRun, onClose, runs }) {
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
