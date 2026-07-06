import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import ClientTimesheetReport from '../../components/common/ClientTimesheetReport';
import DateMultiPicker from '../../components/common/DateMultiPicker';
import { FileText, History, Users, Building2, Activity, X, Zap, Calendar, CalendarRange, CalendarDays } from 'lucide-react';
import { toISODateLocal } from '../../utils/dateUtils';

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><FileText size={20} /></div>
          <h3 className="font-black text-base sm:text-xl text-slate-800 uppercase tracking-tight">Folhas de Horas para Clientes</h3>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2">
          <div className="bg-indigo-50 text-indigo-600 p-2 sm:p-3 rounded-xl sm:rounded-2xl w-fit"><Users size={18} className="sm:hidden" /><Users size={24} className="hidden sm:block" /></div>
          <div>
            <p className="text-xl sm:text-3xl font-black text-slate-800">{activeWorkersCount}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaboradores com Registos</p>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">no período seleccionado</p>
        </div>
        <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2">
          <div className="bg-emerald-50 text-emerald-600 p-2 sm:p-3 rounded-xl sm:rounded-2xl w-fit"><Building2 size={18} className="sm:hidden" /><Building2 size={24} className="hidden sm:block" /></div>
          <div>
            <p className="text-xl sm:text-3xl font-black text-slate-800">{activeClientsCount}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clientes Activos</p>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">no período seleccionado</p>
        </div>
        <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2">
          <div className="bg-amber-50 text-amber-600 p-2 sm:p-3 rounded-xl sm:rounded-2xl w-fit"><Activity size={18} className="sm:hidden" /><Activity size={24} className="hidden sm:block" /></div>
          <div>
            <p className="text-xl sm:text-3xl font-black text-slate-800">{activeReportsCount}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Registos</p>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">no período seleccionado</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4 sm:space-y-6">
        {/* Toggle de modo de período */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterMode('month')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterMode === 'month' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <Calendar size={13} /> Mês
          </button>
          <button
            onClick={() => setFilterMode('range')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterMode === 'range' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <CalendarRange size={13} /> Intervalo
          </button>
          <button
            onClick={() => setFilterMode('dates')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterMode === 'dates' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <CalendarDays size={13} /> Dias
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecione o Cliente</label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.clientId} onChange={e => setReportFilter({ ...reportFilter, clientId: e.target.value })}>
              <option value="">-- Escolher Cliente --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Colaborador (Opcional)</label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.workerId} onChange={e => setReportFilter({ ...reportFilter, workerId: e.target.value })}>
              <option value="">-- Todos os Colaboradores --</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          {/* Seletor de período — consoante o modo */}
          <div className="space-y-2">
            {filterMode === 'month' && (
              <>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mês</label>
                <input type="month" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.month} onChange={e => setReportFilter({ ...reportFilter, month: e.target.value })} />
              </>
            )}
            {filterMode === 'range' && (
              <>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Intervalo de Dias</label>
                <div className="flex gap-2 items-center">
                  <input type="date" className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.startDate} onChange={e => setReportFilter({ ...reportFilter, startDate: e.target.value })} />
                  <span className="text-slate-400 font-black text-xs">→</span>
                  <input type="date" className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.endDate} min={reportFilter.startDate} onChange={e => setReportFilter({ ...reportFilter, endDate: e.target.value })} />
                </div>
                {activeDates.length > 0 && (
                  <p className="text-[10px] font-bold text-indigo-500 ml-1">{activeDates.length} dias no intervalo</p>
                )}
              </>
            )}
            {filterMode === 'dates' && (
              <>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dias Específicos</label>
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
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <button onClick={handleGenerateClientReport} disabled={!hasValidPeriod || (!reportFilter.clientId && !reportFilter.workerId)} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 transition-all">
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
          }} disabled={!hasValidPeriod} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 transition-all">
            <Zap size={18} className="text-amber-400" /> Gerar Tudo do Período
          </button>
        </div>
      </div>

      {/* Modal de Relatório */}
      {printingReport && (
        <div
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-lg z-[200] flex items-start justify-center p-4 overflow-y-auto print:bg-transparent print:backdrop-blur-none print:p-0 print:static print:overflow-visible"
          onClick={(e) => { if (e.target === e.currentTarget) setPrintingReport(null); }}
        >
          <div className="w-full max-w-2xl lg:max-w-5xl mx-4 sm:mx-auto my-8 bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border border-indigo-100 animate-in fade-in zoom-in duration-300 embedded-mode print:my-0 print:max-w-full print:rounded-none print:shadow-none print:border-0 print:overflow-visible">
            <div className="no-print sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white rounded-t-[2rem] sm:rounded-t-[3rem]">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-2.5 rounded-2xl text-indigo-600"><FileText size={20} /></div>
                <div>
                  <h3 className="font-black text-lg text-slate-800">A Visualizar Relatório</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{printingReport.periodLabel || printingReport.month}</p>
                </div>
              </div>
              <button onClick={() => setPrintingReport(null)} className="p-3 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all">
                <X size={20} />
              </button>
            </div>
            <ClientTimesheetReport data={reportData} onBack={() => setPrintingReport(null)} isEmbedded={true} />
          </div>
        </div>
      )}

      {/* Histórico Recente */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><History size={20} /></div>
          <h3 className="font-black text-lg text-slate-800">Histórico Recente</h3>
        </div>
        {reportHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="bg-slate-50 p-4 rounded-2xl mb-3"><FileText size={32} className="text-slate-300" /></div>
            <p className="text-sm font-bold text-slate-400">Ainda sem relatórios gerados</p>
            <p className="text-[10px] text-slate-300 mt-1">Gere um relatório para o ver aqui</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Mês</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Gerado em</th>
                  <th className="px-5 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ação</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {reportHistory.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-black text-slate-700">{entry.periodLabel || entry.month}</td>
                    <td className="px-5 py-3 text-sm font-bold text-slate-600">{entry.clientName}</td>
                    <td className="px-5 py-3 text-sm font-bold text-slate-600">{entry.workerName}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">{new Date(entry.timestamp).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => {
                        const clientSelected = entry.clientId ? clients.find(c => c.id === entry.clientId) : null;
                        if (entry.clientId || entry.workerId) {
                          setPrintingReport({ client: clientSelected, month: entry.month || null, workerId: entry.workerId, periodLabel: entry.periodLabel });
                        } else {
                          setPrintingReport({ isGlobal: true, month: entry.month || null, periodLabel: entry.periodLabel });
                        }
                      }} className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all">
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
