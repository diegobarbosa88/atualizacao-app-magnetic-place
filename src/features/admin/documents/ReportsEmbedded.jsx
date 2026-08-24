import React, { useState } from 'react';
import {
  FileText, Users, Building2, History, Zap,
} from 'lucide-react';
import ClientTimesheetReport from '../../../components/common/ClientTimesheetReport';
import ModalShell from '../../../components/common/ModalShell';
import { SCALE } from '../../../styles/designTokens';

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
          <h3 className="font-black text-base sm:text-xl text-[var(--ink)] uppercase tracking-tight">Folhas de Horas para Clientes</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-[var(--border-soft)] flex flex-col gap-2">
          <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl w-fit"><Users size={18} /></div>
          <div><p className="text-xl sm:text-2xl font-black text-[var(--ink)]">{activeWorkersCount}</p><p className={`${SCALE.text.statLabel} text-[var(--slate)]`}>Colaboradores c/ Registos</p></div>
          <p className="text-xs font-bold text-[var(--slate-dim)] uppercase">no mês seleccionado</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-[var(--border-soft)] flex flex-col gap-2">
          <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl w-fit"><Building2 size={18} /></div>
          <div><p className="text-xl sm:text-2xl font-black text-[var(--ink)]">{activeClientsCount}</p><p className={`${SCALE.text.statLabel} text-[var(--slate)]`}>Clientes Activos</p></div>
          <p className="text-xs font-bold text-[var(--slate-dim)] uppercase">no mês seleccionado</p>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-[var(--border-soft)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="space-y-2">
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-1`}>Selecione o Cliente</label>
            <select className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.clientId} onChange={e => setReportFilter({ ...reportFilter, clientId: e.target.value })}>
              <option value="">-- Escolher Cliente --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-1`}>Colaborador (Opcional)</label>
            <select className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.workerId} onChange={e => setReportFilter({ ...reportFilter, workerId: e.target.value })}>
              <option value="">-- Todos os Colaboradores --</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-1`}>Mês (Ano-Mês)</label>
            <input type="month" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.month} onChange={e => setReportFilter({ ...reportFilter, month: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-[var(--border-soft)]">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <button onClick={handleGenerateClientReport} disabled={!reportFilter.month || (!reportFilter.clientId && !reportFilter.workerId)} className="flex-1 py-4 bg-[var(--orange)] text-[var(--navy-solid)] rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[var(--orange-hover)] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 transition-all">
            <FileText size={18} /> Gerar Selecção
          </button>
          <button onClick={() => {
            const historyEntry = { id: `rh_${Date.now()}`, month: reportFilter.month, clientId: '', clientName: 'Todos os Clientes', workerId: '', workerName: 'Todos', timestamp: new Date().toISOString() };
            const updatedHistory = [historyEntry, ...reportHistory].slice(0, 5);
            setReportHistory(updatedHistory);
            localStorage.setItem('reportHistory', JSON.stringify(updatedHistory));
            setPrintingReport({ isGlobal: true, month: reportFilter.month });
          }} disabled={!reportFilter.month} className="px-8 py-4 bg-[var(--navy-solid)] text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[var(--navy-solid)] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 transition-all">
            <Zap size={18} className="text-amber-400" /> Gerar Tudo do Mês
          </button>
        </div>
      </div>

      {/* size 5xl e não viewer: a folha de horas tem proporção A4 e a 92vw
          esticava o conteúdo num monitor largo. Mantém-se a largura original
          (max-w-5xl); só a camada é que sobe para viewer. */}
      {printingReport && (
        <ModalShell
          isOpen
          onClose={() => setPrintingReport(null)}
          title="A Visualizar Relatório"
          meta={printingReport.month}
          icon={<FileText size={20} />}
          size="5xl"
          layer="viewer"
        >
          <ClientTimesheetReport data={reportData} onBack={() => setPrintingReport(null)} isEmbedded={true} />
        </ModalShell>
      )}

      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-[var(--border-soft)]">
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><History size={20} /></div>
          <h3 className="font-black text-lg text-[var(--ink)]">Histórico Recente</h3>
        </div>
        {reportHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="bg-[var(--surface)] p-4 rounded-2xl mb-3"><FileText size={32} className="text-[var(--slate)]" /></div>
            <p className="text-sm font-bold text-[var(--slate-dim)]">Ainda sem relatórios gerados</p>
            <p className={`${SCALE.text.meta} text-[var(--slate-dim)] mt-1`}>Gere um relatório para o ver aqui</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--border-soft)]">
            <table className="min-w-full divide-y divide-[var(--border-soft)]">
              <thead className="bg-[var(--surface)]">
                <tr>
                  <th className={`px-5 py-3 text-left ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Mês</th>
                  <th className={`px-5 py-3 text-left ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Cliente</th>
                  <th className={`px-5 py-3 text-left ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Colaborador</th>
                  <th className={`px-5 py-3 text-left ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Gerado em</th>
                  <th className={`px-5 py-3 text-right ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Ação</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[var(--border-soft)]">
                {reportHistory.map(entry => (
                  <tr key={entry.id} className="hover:bg-[var(--surface)] transition-colors">
                    <td className="px-5 py-3 text-sm font-black text-[var(--ink-mid)]">{entry.month}</td>
                    <td className="px-5 py-3 text-sm font-bold text-[var(--ink-soft)]">{entry.clientName}</td>
                    <td className="px-5 py-3 text-sm font-bold text-[var(--ink-soft)]">{entry.workerName}</td>
                    <td className="px-5 py-3 text-xs text-[var(--slate-dim)]">{new Date(entry.timestamp).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => {
                        setReportFilter(prev => ({ ...prev, month: entry.month, clientId: entry.clientId, workerId: entry.workerId }));
                        setTimeout(() => {
                          const clientSelected = entry.clientId ? clients.find(c => c.id === entry.clientId) : null;
                          if (entry.clientId || entry.workerId) setPrintingReport({ client: clientSelected, month: entry.month, workerId: entry.workerId });
                          else setPrintingReport({ isGlobal: true, month: entry.month });
                        }, 50);
                      }} className={`px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl ${SCALE.text.badge} hover:bg-indigo-100 transition-all`}>Ver</button>
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
