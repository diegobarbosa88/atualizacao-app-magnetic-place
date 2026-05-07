import React, { useMemo } from 'react';
import { 
  CheckCircle, Search, UserCheck, RotateCcw, ShieldCheck, 
  AlertTriangle, Link, Calendar, ChevronLeft, ChevronRight,
  Mail, Copy, Download
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useValidationPortal } from './contexts/ValidationPortalContext';
import { formatHours, calculateDuration } from '../../utils/formatUtils';
import CorrecoesAdminPortal from '../../components/CorrecoesAdminPortal';

const ValidationPortal = ({ 
  onLogin, 
  setClienteSelecionado, 
  setModalEmailAberto,
  setPrintingReport
}) => {
  // From local context (ValidationPortal state)
  const { 
    portalSubTab, setPortalSubTab,
    portalWorkersSort, setPortalWorkersSort,
    valSortConfig, setValSortConfig,
    clientPortalLinkFilter, setClientPortalLinkFilter,
    portalMonth, setPortalMonth,
    portalMonthStr
  } = useValidationPortal();

  // From global context (shared data)
  const { 
    workers, 
    clients,
    logs, 
    approvals, 
    saveToDb, 
    handleDelete, 
    appNotifications,
    currentUser,
    correctionNotifications,
    clientApprovals,
    correcoesCorrections
  } = useApp();

  const sortedWorkers = useMemo(() => {
    return [...workers].map(w => {
      const totalHours = logs
        .filter(l => l.workerId === w.id && l.date?.substring(0, 7) === portalMonthStr)
        .reduce((acc, l) => acc + calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd), 0);
      const approval = approvals.find(a => a.workerId === w.id && a.month === portalMonthStr);
      return { ...w, totalHours, isApproved: !!approval, approval };
    }).sort((a, b) => {
      let res = 0;
      if (portalWorkersSort.key === 'name') res = a.name.localeCompare(b.name);
      if (portalWorkersSort.key === 'hours') res = a.totalHours - b.totalHours;
      if (portalWorkersSort.key === 'status') res = (a.isApproved ? 1 : 0) - (b.isApproved ? 1 : 0);
      return portalWorkersSort.direction === 'asc' ? res : -res;
    });
  }, [workers, logs, portalMonthStr, approvals, portalWorkersSort]);

  const pendingCorrectionsCount = (correctionNotifications || []).filter(c => c.status === 'pending').length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-black flex items-center gap-3"><ShieldCheck size={32} className="text-indigo-600" /> Portal de Validação</h2>
          <p className="text-slate-400 text-sm mt-1">Gestão de aprovações, correções e links externos.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <button onClick={() => setPortalMonth(new Date(portalMonth.getFullYear(), portalMonth.getMonth() - 1, 1))} className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-indigo-600"><ChevronLeft size={20} /></button>
          <div className="flex items-center gap-2 px-4 border-x border-slate-100">
            <Calendar size={16} className="text-indigo-600" />
            <span className="text-sm font-black uppercase text-slate-700">{portalMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</span>
          </div>
          <button onClick={() => setPortalMonth(new Date(portalMonth.getFullYear(), portalMonth.getMonth() + 1, 1))} className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-indigo-600"><ChevronRight size={20} /></button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
        {[
          { id: 'envios', label: 'Envios Clientes', icon: Mail },
          { id: 'colaboradores', label: 'Validação Equipa', icon: UserCheck },
          { id: 'correcoes', label: 'Correções', icon: AlertTriangle, count: pendingCorrectionsCount },
          { id: 'links', label: 'Links Clientes', icon: Link }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setPortalSubTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase transition-all ${portalSubTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.count > 0 && <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Envios Clientes Tab */}
      {portalSubTab === 'envios' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th onClick={() => setValSortConfig(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Cliente {valSortConfig.key === 'name' ? (valSortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th onClick={() => setValSortConfig(prev => ({ key: 'hours', direction: prev.key === 'hours' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Horas {valSortConfig.key === 'hours' ? (valSortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th onClick={() => setValSortConfig(prev => ({ key: 'status', direction: prev.key === 'status' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Estado {valSortConfig.key === 'status' ? (valSortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Ligação</th>
                  <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ação</th>
                </tr>
              </thead>
              <tbody>
                {([...clients].map(c => {
                  const totalHoras = logs.filter(l => l.clientId === c.id && l.date?.substring(0, 7) === portalMonthStr).reduce((acc, l) => acc + (l.hours || calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd)), 0);
                  const approval = clientApprovals?.find(a => (String(a.client_id || a.clientId || '') === String(c.id)) && a.month === portalMonthStr);
                  const status = approval ? 'validado' : (c.status_email === `enviado_${portalMonthStr}` ? 'enviado' : 'pendente');
                  return { ...c, totalHoras, status };
                }).sort((a, b) => {
                  let res = 0;
                  if (valSortConfig.key === 'name') res = a.name.localeCompare(b.name);
                  if (valSortConfig.key === 'hours') res = a.totalHoras - b.totalHoras;
                  if (valSortConfig.key === 'status') {
                    const statusOrder = { 'pendente': 1, 'enviado': 2, 'validado': 3 };
                    res = statusOrder[a.status] - statusOrder[b.status];
                  }
                  return valSortConfig.direction === 'asc' ? res : -res;
                })).map(c => {
                  const linkUnico = c.link_gerado || `${window.location.origin}${window.location.pathname}?view=client_portal&client=${String(c.id)}&month=${portalMonthStr}`;
                  return (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-indigo-50/40 transition-all group">
                      <td className="relative p-5">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <p className="font-black text-slate-800 text-sm truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold truncate">{c.email || 'SEM EMAIL'}</p>
                      </td>
                      <td className="p-5 font-bold text-slate-600">{formatHours(c.totalHoras)}h</td>
                      <td className="text-center p-5">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full uppercase border ${
                          c.status === 'validado' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 
                          c.status === 'enviado' ? 'text-blue-600 border-blue-200 bg-blue-50' : 
                          'text-slate-400 border-slate-100 bg-slate-50'
                        }`}>
                          {c.status === 'validado' && <CheckCircle size={12} />}
                          {c.status === 'enviado' && <Mail size={12} />}
                          {c.status === 'validado' ? 'Validado' : c.status === 'enviado' ? 'Enviado' : 'Pendente'}
                        </span>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <input type="text" readOnly value={linkUnico} className="bg-slate-50 border border-slate-100 text-slate-400 text-[10px] font-mono rounded-lg p-2 w-32 truncate shadow-inner" />
                          <button onClick={() => navigator.clipboard.writeText(linkUnico)} className="text-slate-300 hover:text-indigo-600 transition-colors"><Copy size={14} /></button>
                        </div>
                      </td>
                      <td className="text-right p-5">
                        <div className="flex justify-end gap-2">
                          {c.status === 'validado' ? (
                            <>
                              <button onClick={() => { if (window.confirm('Anular validação?')) { const appr = clientApprovals?.find(a => (String(a.client_id || a.clientId || '') === String(c.id)) && a.month === portalMonthStr); if (appr) handleDelete('client_approvals', appr.id); } }} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Anular Validação"><RotateCcw size={18} /></button>
                              <button onClick={() => setPrintingReport({ client: c, logs, workers, clients, month: portalMonthStr, clientApprovals })} className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Baixar Relatório"><Download size={18} /></button>
                            </>
                          ) : (
                            <button onClick={() => { setClienteSelecionado(c); setModalEmailAberto(true); }} className={`p-3 rounded-xl transition-all ${c.status === 'enviado' ? 'text-amber-500 hover:bg-amber-50' : 'text-blue-600 hover:bg-blue-50'}`} title={c.status === 'enviado' ? 'Reenviar Email' : 'Enviar Email'}><Mail size={18} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Validação Equipa Tab */}
      {portalSubTab === 'colaboradores' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th onClick={() => setPortalWorkersSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Colaborador {portalWorkersSort.key === 'name' ? (portalWorkersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th onClick={() => setPortalWorkersSort(prev => ({ key: 'hours', direction: prev.key === 'hours' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Total Horas {portalWorkersSort.key === 'hours' ? (portalWorkersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th onClick={() => setPortalWorkersSort(prev => ({ key: 'status', direction: prev.key === 'status' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Estado {portalWorkersSort.key === 'status' ? (portalWorkersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ação</th>
                </tr>
              </thead>
              <tbody>
                {sortedWorkers.map(w => (
                  <tr key={w.id} className="border-b border-slate-100 hover:bg-indigo-50/40 transition-all even:bg-slate-50/50 last:border-b-0 group">
                    <td className="relative p-5">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <p className="font-black text-slate-900 text-[14px] uppercase truncate">{w.name}</p>
                    </td>
                    <td className="p-5"><span className="font-bold text-slate-600">{formatHours(w.totalHours)}h</span></td>
                    <td className="text-center p-5">
                      {w.isApproved ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 border border-emerald-200 bg-emerald-50/30 px-4 py-2 rounded-full">
                          <CheckCircle size={14} /> Aprovado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500 border border-amber-200 bg-amber-50/30 px-4 py-2 rounded-full">
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="text-right p-5">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onLogin('worker', { ...w, isAdminImpersonating: true })}
                          className="p-3 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"
                          title="Ver Portal do Trabalhador"
                        >
                          <Search size={18} />
                        </button>
                        {!w.isApproved ? (
                          <button
                            onClick={() => { const id = "appr_" + w.id + "_" + portalMonthStr; saveToDb('approvals', id, { id, workerId: w.id, month: portalMonthStr, timestamp: new Date().toISOString() }); }}
                            className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                            title="Aprovar Horas"
                          >
                            <UserCheck size={18} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDelete('approvals', w.approval.id)}
                            className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            title="Anular Aprovação"
                          >
                            <RotateCcw size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Correções Tab */}
      {portalSubTab === 'correcoes' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CorrecoesAdminPortal workers={workers} appNotifications={appNotifications} saveToDb={saveToDb} handleDelete={handleDelete} clients={clients} logs={logs} currentUser={currentUser} correcoesCorrections={correcoesCorrections} />
        </div>
      )}

      {/* Links Clientes Tab */}
      {portalSubTab === 'links' && (
        <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecione o Cliente</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold appearance-none cursor-pointer" value={clientPortalLinkFilter.clientId} onChange={e => setClientPortalLinkFilter({ ...clientPortalLinkFilter, clientId: e.target.value })}>
                <option value="">-- Escolher Cliente --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mês de Referência</label>
              <input type="month" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={clientPortalLinkFilter.month} onChange={e => setClientPortalLinkFilter({ ...clientPortalLinkFilter, month: e.target.value })} />
            </div>
          </div>
          {clientPortalLinkFilter.clientId && clientPortalLinkFilter.month && (
            <div className="p-8 bg-indigo-50/50 rounded-3xl border border-indigo-100">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Link Gerado para o Cliente:</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 text-sm font-mono text-indigo-600 truncate shadow-inner">
                  {`${window.location.origin}${window.location.pathname}?view=client_portal&client=${clientPortalLinkFilter.clientId}&month=${clientPortalLinkFilter.month}`}
                </div>
                <button 
                  onClick={() => { 
                    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?view=client_portal&client=${clientPortalLinkFilter.clientId}&month=${clientPortalLinkFilter.month}`);
                  }} 
                  className="px-8 py-5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                >
                  <Link size={16} /> Copiar Link
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-4 italic">Envie este link ao cliente para que ele possa validar as horas e reportar divergências.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ValidationPortal;
