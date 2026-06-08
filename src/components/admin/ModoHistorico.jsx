import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Loader2, RefreshCw, Download, FileDown, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  MESES_PT,
  mesesDisponiveis,
  encontrarWorker,
  formatarMes,
  agruparPorSessao,
  ESTADO_PT,
} from '../../utils/validacaoHelpers';
import { associarDocumentoAoTrabalhador } from '../../utils/separarRecibosTOConline';
import SessaoRow from './SessaoRow';

function ModoHistoricoExportModal({ show, onClose, onExportPdf, onExportCsv, exportFilters, setExportFilters, years, availableMonths, workers }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-800">Exportar Relatório</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Ano</label>
            <select value={exportFilters.ano} onChange={e => setExportFilters(f => ({ ...f, ano: e.target.value, mes: '' }))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Todos os anos</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Mês</label>
            <select value={exportFilters.mes} onChange={e => setExportFilters(f => ({ ...f, mes: e.target.value }))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Todos os meses</option>
              {availableMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Trabalhador</label>
            <select value={exportFilters.workerId} onChange={e => setExportFilters(f => ({ ...f, workerId: e.target.value }))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Todos os trabalhadores</option>
              {workers.filter(w => !w.isAdmin).sort((a,b) => a.name.localeCompare(b.name)).map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onExportPdf}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors">
            <FileDown size={14} /> PDF
          </button>
          <button onClick={onExportCsv}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors">
            <FileDown size={14} /> CSV
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

const ModoHistorico = ({ workers, saveToDb, systemSettings }) => {
  const [registos, setRegistos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroWorker, setFiltroWorker] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    ano: '',
    mes: '',
    workerId: '',
  });

  const fmtEur = (v) => (parseFloat(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const fmtMes = (m) => {
    if (!m) return '';
    const [year, month] = m.split('-');
    return `${MESES_PT[parseInt(month) - 1]} ${year}`;
  };

  const years = useMemo(() => {
    const ys = [...new Set(registos.map(r => r.mes?.split('-')[0]).filter(Boolean))];
    return ys.sort((a, b) => b - a);
  }, [registos]);

  const availableMonths = useMemo(() => {
    if (!exportFilters.ano) return mesesDisponiveis;
    return mesesDisponiveis.filter(m => m.value.startsWith(exportFilters.ano));
  }, [exportFilters.ano]);

  const carregar = useCallback(async () => {
    const db = window.supabaseInstance;
    if (!db) return;
    setCarregando(true);
    const { data } = await db
      .from('receipt_validations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    setRegistos(data ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const alterarEstado = async (id, novoEstado) => {
    const db = window.supabaseInstance;
    if (!db) return;
    const patch = {
      estado: novoEstado,
      mensagem: `Estado alterado manualmente para "${ESTADO_PT[novoEstado] ?? novoEstado}" pelo administrador.`,
      ...(novoEstado === 'valido' ? { divergencia: 0 } : {}),
    };
    const { error } = await db.from('receipt_validations').update(patch).eq('id', id);
    if (error) { console.error(error); return; }
    setRegistos(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const atualizarExtracaoPdf = async (updates) => {
    const db = window.supabaseInstance;
    if (!db) return;
    for (const { id, ...campos } of updates) {
      await db.from('receipt_validations').update(campos).eq('id', id);
    }
    setRegistos(prev => prev.map(r => {
      const u = updates.find(u => u.id === r.id);
      return u ? { ...r, ...u } : r;
    }));
  };

  const apagarRegisto = async (id) => {
    const db = window.supabaseInstance;
    if (!db) return;
    const { error } = await db.from('receipt_validations').delete().eq('id', id);
    if (error) { console.error(error); return; }
    setRegistos(prev => prev.filter(r => r.id !== id));
  };

  const adicionarACustosSessao = async (sessao) => {
    const totaisPorMes = sessao.reduce((acc, r) => {
      if (r.estado !== 'valido' && r.estado !== 'aviso') return acc;
      if (!r.mes) return acc;
      if (!acc[r.mes]) acc[r.mes] = { ss: 0, irs: 0, ssEmpresa: 0 };
      acc[r.mes].ss        += Number(r.ss_extraido)  || 0;
      acc[r.mes].irs       += Number(r.irs_extraido) || 0;
      acc[r.mes].ssEmpresa += (Number(r.ss_extraido) || 0) * (23.75 / 11);
      return acc;
    }, {});
    for (const [mes, totais] of Object.entries(totaisPorMes)) {
      const dataMes = `${mes}-01`;
      const mesNome = formatarMes(mes);
      if (totais.ss > 0) {
        const id = `e${Date.now()}_ss_${mes}`;
        await saveToDb('expenses', id, {
          id, name: `Segurança Social - ${mesNome}`,
          amount: parseFloat(totais.ss.toFixed(2)),
          type: 'variável', date: dataMes,
        });
      }
      if (totais.irs > 0) {
        const id = `e${Date.now()}_irs_${mes}`;
        await saveToDb('expenses', id, {
          id, name: `IRS - ${mesNome}`,
          amount: parseFloat(totais.irs.toFixed(2)),
          type: 'variável', date: dataMes,
        });
      }
      if (totais.ssEmpresa > 0) {
        const id = `e${Date.now()}_sse_${mes}`;
        await saveToDb('expenses', id, {
          id, name: `Seg. Social Empresa - ${mesNome}`,
          amount: parseFloat(totais.ssEmpresa.toFixed(2)),
          type: 'variável', date: dataMes,
        });
      }
    }
  };

  const enviarRecibosSessao = async (resultadosFiltrados) => {
    const supabase = window.supabaseInstance;
    if (!supabase) throw new Error('Sem ligação à base de dados.');
    const erros = [];
    for (const r of resultadosFiltrados) {
      const worker = r.nome ? encontrarWorker(r.nome, workers) : null;
      if (!worker) { erros.push(`${r.nif}: trabalhador não encontrado`); continue; }
      try {
        await associarDocumentoAoTrabalhador({ ...r, worker, supabase });
      } catch (e) {
        erros.push(`${worker.name}: ${e.message}`);
      }
    }
    if (erros.length) throw new Error(erros.join(' | '));
  };

  const apagarSessao = async (sessao) => {
    const db = window.supabaseInstance;
    if (!db) return;
    const ids = sessao.map(r => r.id);
    const { error } = await db.from('receipt_validations').delete().in('id', ids);
    if (error) { console.error(error); return; }
    setRegistos(prev => prev.filter(r => !ids.includes(r.id)));
  };

  // Filtrar registos individualmente e depois agrupar por sessão
  const registosFiltrados = registos.filter(r => {
    if (filtroWorker && r.worker_id !== filtroWorker) return false;
    if (filtroMes    && r.mes       !== filtroMes)    return false;
    return true;
  });
  const sessoes = agruparPorSessao(registosFiltrados);

  const handleExportPdf = () => {
    const filters = exportFilters;
    let data = registosFiltrados;
    if (filters.ano) data = data.filter(r => r.mes?.startsWith(filters.ano));
    if (filters.mes) data = data.filter(r => r.mes === filters.mes);
    if (filters.workerId) data = data.filter(r => r.worker_id === filters.workerId);
    if (!data.length) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    try {
      const logoUrl = '/MAGNETIC (3).png';
      doc.addImage(logoUrl, 'PNG', margin, yPos, 25, 25);
    } catch (e) { console.warn('Logo não carregado:', e); }

    doc.setFontSize(18);
    doc.setTextColor(30);
    doc.text('Relatório de Recibos Validados', margin + 30, yPos + 8);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} — ${data.length} registo(s)`, margin + 30, yPos + 16);
    yPos += 28;

    const filterLabel = [
      filters.ano ? `Ano: ${filters.ano}` : '',
      filters.mes ? `Mês: ${fmtMes(filters.mes)}` : '',
      filters.workerId ? `Trabalhador: ${workers.find(w => w.id === filters.workerId)?.name ?? filters.workerId}` : '',
    ].filter(Boolean).join(' | ');
    if (filterLabel) {
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Filtros: ${filterLabel}`, margin, yPos);
      yPos += 6;
    }

    const byWorker = {};
    data.forEach(r => {
      const key = r.worker_name ?? 'Desconhecido';
      if (!byWorker[key]) byWorker[key] = { bruto: 0, ss: 0, irs: 0, ajudas: 0, liquido: 0, count: 0 };
      byWorker[key].bruto  += Number(r.bruto_plataforma) || 0;
      byWorker[key].ss     += Number(r.ss_extraido) || 0;
      byWorker[key].irs    += Number(r.irs_extraido) || 0;
      byWorker[key].ajudas += Number(r.ajudas_custo_extraidas) || 0;
      byWorker[key].liquido += Number(r.liquido_extraido) || 0;
      byWorker[key].count++;
    });

    const workerRows = Object.entries(byWorker).sort((a, b) => b[1].bruto - a[1].bruto);
    const workerTable = workerRows.map(([name, w]) => [
      name, w.count, fmtEur(w.bruto), fmtEur(w.ss), fmtEur(w.irs), fmtEur(w.ajudas), fmtEur(w.liquido)
    ]);
    const totalBruto = data.reduce((s, r) => s + (Number(r.bruto_plataforma) || 0), 0);
    const totalSS = data.reduce((s, r) => s + (Number(r.ss_extraido) || 0), 0);
    const totalIRS = data.reduce((s, r) => s + (Number(r.irs_extraido) || 0), 0);
    const totalAjudas = data.reduce((s, r) => s + (Number(r.ajudas_custo_extraidas) || 0), 0);
    const totalLiquido = data.reduce((s, r) => s + (Number(r.liquido_extraido) || 0), 0);
    const totalsRow = ['TOTAL', data.length, fmtEur(totalBruto), fmtEur(totalSS), fmtEur(totalIRS), fmtEur(totalAjudas), fmtEur(totalLiquido)];

    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text('Totais por Trabalhador', margin, yPos);
    yPos += 4;

    autoTable(doc, {
      startY: yPos,
      head: [['Trabalhador', 'Recibos', 'Bruto', 'SS', 'IRS', 'Ajudas Custo', 'Líquido']],
      body: [...workerTable, totalsRow],
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
      columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 25, halign: 'right' }, 3: { cellWidth: 22, halign: 'right' }, 4: { cellWidth: 22, halign: 'right' }, 5: { cellWidth: 25, halign: 'right' }, 6: { cellWidth: 25, halign: 'right' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.row.index === workerTable.length) {
          d.cell.styles.fillColor = [220, 220, 255];
          d.cell.styles.fontStyle = 'bold';
        }
      },
    });
    yPos = doc.lastAutoTable?.finalY + 10;

    if (yPos > pageHeight - 60) { doc.addPage(); yPos = margin; }

    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text('Resumo Mensal', margin, yPos);
    yPos += 4;

    const byMonth = {};
    data.forEach(r => {
      const m = r.mes || 'Sem mês';
      if (!byMonth[m]) byMonth[m] = { count: 0, bruto: 0, ss: 0, irs: 0, ajudas: 0, liquido: 0 };
      byMonth[m].count++;
      byMonth[m].bruto  += Number(r.bruto_plataforma) || 0;
      byMonth[m].ss     += Number(r.ss_extraido) || 0;
      byMonth[m].irs    += Number(r.irs_extraido) || 0;
      byMonth[m].ajudas += Number(r.ajudas_custo_extraidas) || 0;
      byMonth[m].liquido += Number(r.liquido_extraido) || 0;
    });

    const monthRows = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0]));
    const monthTable = monthRows.map(([mes, m]) => [
      fmtMes(mes), m.count, fmtEur(m.bruto), fmtEur(m.ss), fmtEur(m.irs), fmtEur(m.ajudas), fmtEur(m.liquido)
    ]);
    const totalRowMonth = ['TOTAL', data.length, fmtEur(totalBruto), fmtEur(totalSS), fmtEur(totalIRS), fmtEur(totalAjudas), fmtEur(totalLiquido)];

    autoTable(doc, {
      startY: yPos,
      head: [['Mês', 'Recibos', 'Bruto', 'SS', 'IRS', 'Ajudas Custo', 'Líquido']],
      body: [...monthTable, totalRowMonth],
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
      columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 25, halign: 'right' }, 3: { cellWidth: 22, halign: 'right' }, 4: { cellWidth: 22, halign: 'right' }, 5: { cellWidth: 25, halign: 'right' }, 6: { cellWidth: 25, halign: 'right' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.row.index === monthTable.length) {
          d.cell.styles.fillColor = [220, 255, 220];
          d.cell.styles.fontStyle = 'bold';
        }
      },
    });
    yPos = doc.lastAutoTable?.finalY + 10;

    if (yPos > pageHeight - 50) { doc.addPage(); yPos = margin; }

    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text('Resumo do Período', margin, yPos);
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      head: [['Indicador', 'Valor']],
      body: [
        ['Total Bruto', fmtEur(totalBruto)],
        ['Total SS (Funcionário)', fmtEur(totalSS)],
        ['Total IRS', fmtEur(totalIRS)],
        ['Total Ajudas de Custo', fmtEur(totalAjudas)],
        ['Total Líquido Pago', fmtEur(totalLiquido)],
        ['Total SS (Empresa - 23.75/11)', fmtEur(totalSS * (23.75 / 11))],
        ['Custo Total (SS Empresa + IRS)', fmtEur(totalSS * (23.75 / 11) + totalIRS)],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 40, halign: 'right' } },
    });

    doc.save(`recibos_relatorio_${new Date().toISOString().slice(0, 10)}.pdf`);
    setShowExportModal(false);
  };

  const handleExportCsv = () => {
    const filters = exportFilters;
    let data = registosFiltrados;
    if (filters.ano) data = data.filter(r => r.mes?.startsWith(filters.ano));
    if (filters.mes) data = data.filter(r => r.mes === filters.mes);
    if (filters.workerId) data = data.filter(r => r.worker_id === filters.workerId);
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Trabalhador', 'Mês', 'Bruto Platform', 'SS', 'IRS', 'Ajudas Custo', 'Líquido', 'Estado', 'Origem', 'Session ID'].map(esc).join(';');
    const rows = data.map(r => [esc(r.worker_name ?? ''), esc(r.mes ?? ''), esc(r.bruto_plataforma ?? ''), esc(r.ss_extraido ?? ''), esc(r.irs_extraido ?? ''), esc(r.ajudas_custo_extraidas ?? ''), esc(r.liquido_extraido ?? ''), esc(r.estado ?? ''), esc(r.origem ?? ''), esc(r.session_id ?? '')].join(';'));
    const blob = new Blob(['﻿' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `recibos_relatorio_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select value={filtroWorker} onChange={e => setFiltroWorker(e.target.value)}
          className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos os trabalhadores</option>
          {workers.filter(w => !w.isAdmin).sort((a,b) => a.name.localeCompare(b.name)).map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
          className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos os meses</option>
          {mesesDisponiveis.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <button onClick={carregar} disabled={carregando}
          className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all disabled:opacity-40">
          <RefreshCw size={15} className={carregando ? 'animate-spin' : ''} />
        </button>
        <div className="relative">
          <button onClick={() => setShowExportMenu(o => !o)}
            className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-600 hover:bg-indigo-100 transition-all">
            <Download size={15} />
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
              <button onClick={() => { setShowExportModal(true); setShowExportMenu(false); }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap">
                <FileDown size={14} /> Exportar PDF
              </button>
              <button onClick={() => { setShowExportModal(true); setShowExportMenu(false); }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap">
                <FileDown size={14} /> Exportar CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {carregando && (
        <div className="flex justify-center py-10">
          <Loader2 size={22} className="animate-spin text-indigo-400" />
        </div>
      )}

      {!carregando && sessoes.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-10">Nenhuma validação guardada.</p>
      )}

      {!carregando && sessoes.length > 0 && (
        <div className="rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Processamento</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Recibos</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Resumo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessoes.map(sessao => (
                <SessaoRow
                  key={sessao[0].session_id ?? sessao[0].id}
                  sessao={sessao}
                  onAlterarEstado={alterarEstado}
                  onApagarRegisto={apagarRegisto}
                  onApagarSessao={apagarSessao}
                  onAdicionarACustos={adicionarACustosSessao}
                  onEnviarRecibos={enviarRecibosSessao}
                  onAtualizarAjudas={atualizarExtracaoPdf}
                  workers={workers}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ModoHistoricoExportModal show={showExportModal} onClose={() => setShowExportModal(false)} onExportPdf={handleExportPdf} onExportCsv={handleExportCsv} exportFilters={exportFilters} setExportFilters={setExportFilters} years={years} availableMonths={availableMonths} workers={workers} />
    </div>
  );
};

export default ModoHistorico;
