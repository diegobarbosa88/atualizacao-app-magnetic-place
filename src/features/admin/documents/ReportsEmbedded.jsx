import React, { useState } from 'react';
import {
  FileText, Users, Building2, History, Zap, X,
} from 'lucide-react';
import ClientTimesheetReport from '../../../components/common/ClientTimesheetReport';

export default function ReportsEmbedded({
  reportFilter, setReportFilter,
  reportHistory, setReportHistory,
  printingReport, setPrintingReport,
  clients, workers, logs,
  activeWorkersCount, activeClientsCount,
  handleGenerateClientReport,
  clientApprovals,
}) {
  const reportData = printingReport ? { ...printingReport, logs, workers, clients, clientApprovals } : null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><FileText size={20} /></div>
          <h3 className="font-black text-base sm:text-xl text-slate-800 uppercase tracking-tight">Folhas de Horas para Clientes</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2">
          <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl w-fit"><Users size={18} /></div>
          <div><p className="text-xl sm:text-2xl font-black text-slate-800">{activeWorkersCount}</p><p className="text-[10px] font-black text-slate-400 uppercase">Colaboradores c/ Registos</p></div>
          <p className="text-xs font-bold text-slate-500 uppercase">no mês seleccionado</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2">
          <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl w-fit"><Building2 size={18} /></div>
          <div><p className="text-xl sm:text-2xl font-black text-slate-800">{activeClientsCount}</p><p className="text-[10px] font-black text-slate-400 uppercase">Clientes Activos</p></div>
          <p className="text-xs font-bold text-slate-500 uppercase">no mês seleccionado</p>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
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
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mês (Ano-Mês)</label>
            <input type="month" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.month} onChange={e => setReportFilter({ ...reportFilter, month: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <button onClick={handleGenerateClientReport} disabled={!reportFilter.month || (!reportFilter.clientId && !reportFilter.workerId)} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 transition-all">
            <FileText size={18} /> Gerar Selecção
          </button>
          <button onClick={() => {
            const historyEntry = { id: `rh_${Date.now()}`, month: reportFilter.month, clientId: '', clientName: 'Todos os Clientes', workerId: '', workerName: 'Todos', timestamp: new Date().toISOString() };
            const updatedHistory = [historyEntry, ...reportHistory].slice(0, 5);
            setReportHistory(updatedHistory);
            localStorage.setItem('reportHistory', JSON.stringify(updatedHistory));
            setPrintingReport({ isGlobal: true, month: reportFilter.month });
          }} disabled={!reportFilter.month} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 transition-all">
            <Zap size={18} className="text-amber-400" /> Gerar Tudo do Mês
          </button>
        </div>
      </div>

      {printingReport && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-lg z-[200] flex items-start justify-center p-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setPrintingReport(null); }}>
          <div className="w-full max-w-2xl lg:max-w-5xl mx-4 sm:mx-auto my-8 bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border border-indigo-100 animate-in fade-in zoom-in duration-300">
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white rounded-t-[2rem] sm:rounded-t-[3rem]">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-2.5 rounded-2xl text-indigo-600"><FileText size={20} /></div>
                <div><h3 className="font-black text-lg text-slate-800">A Visualizar Relatório</h3><p className="text-[10px] font-bold text-slate-400 uppercase">{printingReport.month}</p></div>
              </div>
              <button onClick={() => setPrintingReport(null)} className="p-3 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all"><X size={20} /></button>
            </div>
            <ClientTimesheetReport data={reportData} onBack={() => setPrintingReport(null)} isEmbedded={true} />
          </div>
        </div>
      )}

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
                    <td className="px-5 py-3 text-sm font-black text-slate-700">{entry.month}</td>
                    <td className="px-5 py-3 text-sm font-bold text-slate-600">{entry.clientName}</td>
                    <td className="px-5 py-3 text-sm font-bold text-slate-600">{entry.workerName}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">{new Date(entry.timestamp).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => {
                        setReportFilter(prev => ({ ...prev, month: entry.month, clientId: entry.clientId, workerId: entry.workerId }));
                        setTimeout(() => {
                          const clientSelected = entry.clientId ? clients.find(c => c.id === entry.clientId) : null;
                          if (entry.clientId || entry.workerId) setPrintingReport({ client: clientSelected, month: entry.month, workerId: entry.workerId });
                          else setPrintingReport({ isGlobal: true, month: entry.month });
                        }, 50);
                      }} className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all">Ver</button>
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
