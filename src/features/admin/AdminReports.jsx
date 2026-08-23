import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import ClientTimesheetReport from '../../components/common/ClientTimesheetReport';
import DateMultiPicker from '../../components/common/DateMultiPicker';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';
import SubTabBar from '../../components/common/SubTabBar';
import { FileText, History, Users, Building2, Activity, Zap, Calendar, CalendarRange, CalendarDays } from 'lucide-react';
import ModalShell from '../../components/common/ModalShell';
import { toISODateLocal } from '../../utils/dateUtils';
import { FT } from '../../styles/designTokens';

export default function AdminReports({ printingReport, setPrintingReport }) {
  const { workers, clients, logs, clientApprovals } = useApp();

  const [filterMode, setFilterMode] = useState('month'); // 'month' | 'range' | 'dates'
  const [reportFilter, setReportFilter] = useState({
    clientId: '',
    workerId: '',
    month: toISODateLocal(new Date()).substring(0, 7),
    startDate: '',
    endDate: '',
    selectedDates: [],
  });
  const [reportHistory, setReportHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('reportHistory') || '[]'); } catch { return []; }
  });

  // Deriva array de datas ativas (YYYY-MM-DD) consoante o modo de filtro
  const activeDates = useMemo(() => {
    if (filterMode === 'dates') {
      return [...reportFilter.selectedDates].sort();
    }
    if (filterMode === 'range' && reportFilter.startDate && reportFilter.endDate) {
      const days = [];
      const cur = new Date(reportFilter.startDate + 'T00:00:00');
      const end = new Date(reportFilter.endDate + 'T00:00:00');
      while (cur <= end) {
        days.push(toISODateLocal(cur));
        cur.setDate(cur.getDate() + 1);
      }
      return days;
    }
    if (filterMode === 'month' && reportFilter.month) {
      const [y, m] = reportFilter.month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      return Array.from({ length: lastDay }, (_, i) => {
        const d = String(i + 1).padStart(2, '0');
        return `${reportFilter.month}-${d}`;
      });
    }
    return [];
  }, [filterMode, reportFilter]);

  const hasValidPeriod = filterMode === 'month'
    ? !!reportFilter.month
    : filterMode === 'range'
      ? (!!reportFilter.startDate && !!reportFilter.endDate && reportFilter.startDate <= reportFilter.endDate)
      : reportFilter.selectedDates.length > 0;

  const periodLabel = useMemo(() => {
    if (filterMode === 'month') return reportFilter.month || '';
    if (activeDates.length === 0) return '';
    const first = activeDates[0];
    const last = activeDates[activeDates.length - 1];
    if (first === last) return first;
    return `${first} → ${last}`;
  }, [filterMode, reportFilter.month, activeDates]);

  const activeReportsCount = useMemo(() => {
    if (activeDates.length === 0) return 0;
    const set = new Set(activeDates);
    return logs.filter(l => l.date && set.has(l.date)).length;
  }, [logs, activeDates]);

  const activeClientsCount = useMemo(() => {
    if (activeDates.length === 0) return clients.length;
    const set = new Set(activeDates);
    return [...new Set(logs.filter(l => l.date && set.has(l.date)).map(l => l.clientId))].length;
  }, [logs, activeDates, clients]);

  const activeWorkersCount = useMemo(() => {
    if (activeDates.length === 0) return workers.filter(w => w.is_active !== false).length;
    const set = new Set(activeDates);
    return [...new Set(logs.filter(l => l.date && set.has(l.date)).map(l => l.workerId))].length;
  }, [logs, activeDates, workers]);

  const reportData = useMemo(() => {
    if (!printingReport) return null;
    return { ...printingReport, logs, workers, clients, clientApprovals };
  }, [printingReport, logs, workers, clients, clientApprovals]);

  const handleGenerateClientReport = () => {
    if (!hasValidPeriod || (!reportFilter.clientId && !reportFilter.workerId)) return;
    const clientSelected = reportFilter.clientId ? clients.find(c => c.id === reportFilter.clientId) : null;
    const workerSelected = reportFilter.workerId ? workers.find(w => w.id === reportFilter.workerId) : null;
    const historyEntry = {
      id: `rh_${Date.now()}`,
      month: filterMode === 'month' ? reportFilter.month : null,
      periodLabel,
      clientId: reportFilter.clientId || '',
      clientName: clientSelected?.name || (reportFilter.workerId ? 'Vários Clientes' : ''),
      workerId: reportFilter.workerId || '',
      workerName: workerSelected?.name || (reportFilter.clientId ? 'Todos' : ''),
      timestamp: new Date().toISOString()
    };
    const updatedHistory = [historyEntry, ...reportHistory].slice(0, 5);
    setReportHistory(updatedHistory);
    localStorage.setItem('reportHistory', JSON.stringify(updatedHistory));
    setPrintingReport({
      client: clientSelected,
      month: filterMode === 'month' ? reportFilter.month : null,
      dates: filterMode !== 'month' ? activeDates : null,
      workerId: reportFilter.workerId,
      periodLabel,
    });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4 sm:space-y-6">
      <SectionHeaderShell
        icon={<FileText size={18} />}
        title="Folhas de Horas para Clientes"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-[var(--border-soft)] flex flex-col gap-2">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl w-fit" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: FT.slate }}><Users size={18} className="sm:hidden" /><Users size={24} className="hidden sm:block" /></div>
          <div>
            <p className="text-xl sm:text-3xl font-black text-[var(--ink)]">{activeWorkersCount}</p>
            <p className="text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest">Colaboradores com Registos</p>
          </div>
          <p className="text-xs font-bold text-[var(--slate-dim)] uppercase tracking-wider">no período seleccionado</p>
        </div>
        <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-[var(--border-soft)] flex flex-col gap-2">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl w-fit" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: FT.slate }}><Building2 size={18} className="sm:hidden" /><Building2 size={24} className="hidden sm:block" /></div>
          <div>
            <p className="text-xl sm:text-3xl font-black text-[var(--ink)]">{activeClientsCount}</p>
            <p className="text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest">Clientes Activos</p>
          </div>
          <p className="text-xs font-bold text-[var(--slate-dim)] uppercase tracking-wider">no período seleccionado</p>
        </div>
        <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-[var(--border-soft)] flex flex-col gap-2">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl w-fit" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: FT.slate }}><Activity size={18} className="sm:hidden" /><Activity size={24} className="hidden sm:block" /></div>
          <div>
            <p className="text-xl sm:text-3xl font-black text-[var(--ink)]">{activeReportsCount}</p>
            <p className="text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest">Total de Registos</p>
          </div>
          <p className="text-xs font-bold text-[var(--slate-dim)] uppercase tracking-wider">no período seleccionado</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-[var(--border-soft)] space-y-4 sm:space-y-6">
        {/* Toggle de modo de período */}
        <SubTabBar
          tabs={[
            { id: 'month', label: 'Mês', icon: Calendar },
            { id: 'range', label: 'Intervalo', icon: CalendarRange },
            { id: 'dates', label: 'Dias', icon: CalendarDays },
          ]}
          activeTab={filterMode}
          onTabChange={setFilterMode}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest ml-1">Selecione o Cliente</label>
            <select className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[var(--navy)] outline-none font-bold" value={reportFilter.clientId} onChange={e => setReportFilter({ ...reportFilter, clientId: e.target.value })}>
              <option value="">-- Escolher Cliente --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest ml-1">Colaborador (Opcional)</label>
            <select className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[var(--navy)] outline-none font-bold" value={reportFilter.workerId} onChange={e => setReportFilter({ ...reportFilter, workerId: e.target.value })}>
              <option value="">-- Todos os Colaboradores --</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          {/* Seletor de período — consoante o modo */}
          <div className="space-y-2">
            {filterMode === 'month' && (
              <>
                <label className="text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest ml-1">Mês</label>
                <input type="month" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[var(--navy)] outline-none font-bold" value={reportFilter.month} onChange={e => setReportFilter({ ...reportFilter, month: e.target.value })} />
              </>
            )}
            {filterMode === 'range' && (
              <>
                <label className="text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest ml-1">Intervalo de Dias</label>
                <div className="flex gap-2 items-center">
                  <input type="date" className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[var(--navy)] outline-none font-bold" value={reportFilter.startDate} onChange={e => setReportFilter({ ...reportFilter, startDate: e.target.value })} />
                  <span className="text-[var(--slate)] font-black text-xs">→</span>
                  <input type="date" className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[var(--navy)] outline-none font-bold" value={reportFilter.endDate} min={reportFilter.startDate} onChange={e => setReportFilter({ ...reportFilter, endDate: e.target.value })} />
                </div>
                {activeDates.length > 0 && (
                  <p className="text-[10px] font-bold ml-1" style={{ color: FT.orange }}>{activeDates.length} dias no intervalo</p>
                )}
              </>
            )}
            {filterMode === 'dates' && (
              <>
                <label className="text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest ml-1">Dias Específicos</label>
                <DateMultiPicker
                  selected={reportFilter.selectedDates}
                  onChange={dates => setReportFilter({ ...reportFilter, selectedDates: dates })}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-[var(--border-soft)]">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <button onClick={handleGenerateClientReport} disabled={!hasValidPeriod || (!reportFilter.clientId && !reportFilter.workerId)} className="flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 transition-all border-2" style={{ color: 'var(--navy)', borderColor: FT.navy, backgroundColor: 'transparent' }}>
            <FileText size={18} /> Gerar Selecção
          </button>
          <button onClick={() => {
            const historyEntry = {
              id: `rh_${Date.now()}`,
              month: filterMode === 'month' ? reportFilter.month : null,
              periodLabel,
              clientId: '',
              clientName: 'Todos os Clientes',
              workerId: '',
              workerName: 'Todos',
              timestamp: new Date().toISOString()
            };
            const updatedHistory = [historyEntry, ...reportHistory].slice(0, 5);
            setReportHistory(updatedHistory);
            localStorage.setItem('reportHistory', JSON.stringify(updatedHistory));
            setPrintingReport({
              isGlobal: true,
              month: filterMode === 'month' ? reportFilter.month : null,
              dates: filterMode !== 'month' ? activeDates : null,
              periodLabel,
            });
          }} disabled={!hasValidPeriod} className="px-8 py-4 text-[var(--navy)] rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 transition-all" style={{ backgroundColor: FT.orange }}>
            <Zap size={18} className="text-amber-400" /> Gerar Tudo do Período
          </button>
        </div>
      </div>

      {/* Modal de Relatório */}
      {/* size 5xl e não viewer: a folha de horas tem proporção A4 e a 92vw
          esticava o conteúdo num monitor largo. As classes `print:` que estavam
          no overlay e no cartão são redundantes — o @media print de
          ClientTimesheetReport.css já neutraliza `.fixed.inset-0` (position
          static, sem fundo, sem blur, sem padding, overflow visível) e
          `.embedded-mode`, que se mantém como wrapper do relatório. */}
      {printingReport && (
        <ModalShell
          isOpen
          onClose={() => setPrintingReport(null)}
          title="A Visualizar Relatório"
          meta={printingReport.periodLabel || printingReport.month}
          icon={<FileText size={20} />}
          size="5xl"
          layer="viewer"
        >
          <div className="embedded-mode">
            <ClientTimesheetReport data={reportData} onBack={() => setPrintingReport(null)} isEmbedded={true} />
          </div>
        </ModalShell>
      )}

      {/* Histórico Recente */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-[var(--border-soft)]">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: FT.slate }}><History size={20} /></div>
          <h3 className="font-black text-lg text-[var(--ink)]">Histórico Recente</h3>
        </div>
        {reportHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="bg-[var(--surface)] p-4 rounded-2xl mb-3"><FileText size={32} className="text-[var(--slate)]" /></div>
            <p className="text-sm font-bold text-[var(--slate-dim)]">Ainda sem relatórios gerados</p>
            <p className="text-[10px] text-[var(--slate-dim)] mt-1">Gere um relatório para o ver aqui</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--border-soft)]">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead className="bg-[var(--surface)]">
                <tr>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest">Mês</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest">Cliente</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest">Colaborador</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest">Gerado em</th>
                  <th className="px-5 py-3 text-right text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest">Ação</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[var(--border-soft)]">
                {reportHistory.map(entry => (
                  <tr key={entry.id} className="hover:bg-[var(--surface)] transition-colors">
                    <td className="px-5 py-3 text-sm font-black text-[var(--ink-mid)]">{entry.periodLabel || entry.month}</td>
                    <td className="px-5 py-3 text-sm font-bold text-[var(--ink-soft)]">{entry.clientName}</td>
                    <td className="px-5 py-3 text-sm font-bold text-[var(--ink-soft)]">{entry.workerName}</td>
                    <td className="px-5 py-3 text-xs text-[var(--slate-dim)]">{new Date(entry.timestamp).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => {
                        const clientSelected = entry.clientId ? clients.find(c => c.id === entry.clientId) : null;
                        if (entry.clientId || entry.workerId) {
                          setPrintingReport({ client: clientSelected, month: entry.month || null, workerId: entry.workerId, periodLabel: entry.periodLabel });
                        } else {
                          setPrintingReport({ isGlobal: true, month: entry.month || null, periodLabel: entry.periodLabel });
                        }
                      }} className="px-4 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-[var(--surface)]" style={{ color: 'var(--slate-dim)' }}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
