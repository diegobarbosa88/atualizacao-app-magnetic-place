import React, { useMemo, useState } from 'react';
import {
  CheckCircle, Search, UserCheck, RotateCcw, ShieldCheck,
  AlertTriangle, Link, Calendar, ChevronLeft, ChevronRight,
  Mail, Copy, Download, LayoutGrid, LayoutList
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useValidationPortal } from './contexts/ValidationPortalContext';
import { formatHours, calculateDuration } from '../../utils/formatUtils';
import { sendValidationEmail } from '../../utils/emailUtils';
import CorrectionsInbox from './corrections/CorrectionsInbox';

const ValidationPortal = ({
  onLogin,
  setClienteSelecionado,
  setModalEmailAberto,
  setPrintingReport
}) => {
  // From local context (ValidationPortal state)
  const {
    portalSubTab, setPortalSubTab,
    portalWorkersSort,
    valSortConfig,
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
  const [portalView, setPortalView] = useState(window.innerWidth < 768 ? 'grid' : 'list');
  const fmtH = (h) => `${Number.isInteger(h) ? h : h.toFixed(1)}H`;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2"><ShieldCheck size={22} className="text-indigo-600" /> Portal de Validação</h2>
          <p className="text-slate-400 text-xs mt-1">Aprovações, correções e links externos.</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl shadow-sm border border-slate-100">
          <button onClick={() => setPortalMonth(new Date(portalMonth.getFullYear(), portalMonth.getMonth() - 1, 1))} className="p-1.5 hover:bg-slate-50 rounded-lg transition-all text-slate-400"><ChevronLeft size={15} /></button>
          <div className="flex items-center gap-1.5 px-2 border-x border-slate-100">
            <Calendar size={13} className="text-indigo-600" />
            <span className="text-xs font-black uppercase text-slate-700">{portalMonth.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}</span>
          </div>
          <button onClick={() => setPortalMonth(new Date(portalMonth.getFullYear(), portalMonth.getMonth() + 1, 1))} className="p-1.5 hover:bg-slate-50 rounded-lg transition-all text-slate-400"><ChevronRight size={15} /></button>
        </div>
      </div>

      {/* Sub-tabs + view toggle */}
      <div className="flex items-center gap-2 mb-4">
        <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-2xl flex-1">
        {[
          { id: 'envios', label: 'Envios', icon: Mail },
          { id: 'colaboradores', label: 'Equipa', icon: UserCheck },
          { id: 'correcoes', label: 'Correções', icon: AlertTriangle, count: pendingCorrectionsCount },
          { id: 'links', label: 'Links', icon: Link }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setPortalSubTab(tab.id)}
            className={`flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all relative ${portalSubTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <tab.icon size={12} />
            <span className="text-[9px] sm:text-[10px]">{tab.label}</span>
            {tab.count > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full">{tab.count}</span>}
          </button>
        ))}
        </div>
        {(portalSubTab === 'envios' || portalSubTab === 'colaboradores') && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl shrink-0">
            <button onClick={() => setPortalView('list')} className={`p-1.5 rounded-xl transition-all ${portalView === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutList size={14} /></button>
            <button onClick={() => setPortalView('grid')} className={`p-1.5 rounded-xl transition-all ${portalView === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={14} /></button>
          </div>
        )}
      </div>

      {/* Envios Clientes Tab */}
      {portalSubTab === 'envios' && portalView === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
              <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell">Email</th>
              <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Horas</th>
              <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
              <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
            </tr></thead>
            <tbody>
              {([...clients].map(c => {
                const totalHoras = logs.filter(l => l.clientId === c.id && l.date?.substring(0, 7) === portalMonthStr).reduce((acc, l) => acc + (l.hours || calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd)), 0);
                const approval = clientApprovals?.find(a => (String(a.client_id || a.clientId || '') === String(c.id)) && a.month === portalMonthStr);
                const status = approval ? 'validado' : (c.status_email === `enviado_${portalMonthStr}` ? 'enviado' : 'pendente');
                return { ...c, totalHoras, status };
              })).map(c => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-right font-black text-indigo-600 tabular-nums">{fmtH(c.totalHoras)}</td>
                  <td className="px-4 py-3 text-center">
                    {c.status === 'validado' && <CheckCircle size={16} className="text-emerald-500 mx-auto" />}
                    {c.status === 'enviado' && <Mail size={16} className="text-blue-500 mx-auto" />}
                    {c.status === 'pendente' && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {c.status === 'validado' ? (
                        <>
                          <button onClick={async () => { if (!window.confirm('Anular validação?')) return; const appr = clientApprovals?.find(a => (String(a.client_id || a.clientId || '') === String(c.id)) && a.month === portalMonthStr); if (!appr) return; try { await handleDelete('client_approvals', appr.id); } catch (err) { alert('Erro: ' + err?.message); } }} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-all" title="Anular"><RotateCcw size={13} /></button>
                          <button onClick={() => setPrintingReport({ client: c, logs, workers, clients, month: portalMonthStr, clientApprovals })} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all" title="Relatório"><Download size={13} /></button>
                        </>
                      ) : (
                        <button onClick={() => { setClienteSelecionado(c); setModalEmailAberto(true); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Enviar Email"><Mail size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {portalSubTab === 'envios' && portalView === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
              <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border flex items-center gap-1 ${c.status === 'validado' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : c.status === 'enviado' ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-slate-400 border-slate-200 bg-slate-50'}`}>
                    {c.status === 'validado' && <CheckCircle size={10} />}
                    {c.status === 'enviado' && <Mail size={10} />}
                    {c.status === 'validado' ? 'Validado' : c.status === 'enviado' ? 'Enviado' : 'Pendente'}
                  </div>
                  <span className="text-lg font-black text-indigo-600">{formatHours(c.totalHoras)}h</span>
                </div>
                {/* Name */}
                <h4 className="font-black text-slate-800 text-sm truncate mb-0.5">{c.name}</h4>
                <p className="text-[10px] text-slate-400 font-bold truncate mb-3">{c.email || 'Sem email'}</p>
                {/* Link */}
                <div className="flex items-center gap-1.5 mb-3 bg-slate-50 rounded-xl p-2 border border-slate-100">
                  <span className="text-[9px] font-mono text-slate-400 truncate flex-1">{linkUnico.replace(/.*\?/, '?')}</span>
                  <button onClick={() => navigator.clipboard.writeText(linkUnico)} className="text-slate-300 hover:text-indigo-600 transition-colors shrink-0"><Copy size={12} /></button>
                </div>
                {/* Actions */}
                <div className="flex gap-2">
                  {c.status === 'validado' ? (
                    <>
                      <button onClick={async () => { if (!window.confirm('Anular validação?')) return; const appr = clientApprovals?.find(a => (String(a.client_id || a.clientId || '') === String(c.id)) && a.month === portalMonthStr); if (!appr) return; try { await handleDelete('client_approvals', appr.id); if (c.email) { sendValidationEmail({ to: c.email, name: c.name, title: `Validação Anulada · ${portalMonthStr}`, message: `A validação do relatório de ${portalMonthStr} foi anulada pelo administrador. Aceda ao portal para submeter um novo reporte ou validar novamente.`, link: `${window.location.origin}/?view=client_portal&client=${encodeURIComponent(c.id)}&month=${encodeURIComponent(portalMonthStr)}` }).catch(() => { }); } } catch (err) { alert('Erro ao anular: ' + (err?.message || err)); } }} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-rose-500 hover:bg-rose-50 rounded-xl text-[10px] font-black uppercase transition-all border border-rose-100"><RotateCcw size={12} /> Anular</button>
                      <button onClick={() => setPrintingReport({ client: c, logs, workers, clients, month: portalMonthStr, clientApprovals })} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-emerald-600 hover:bg-emerald-50 rounded-xl text-[10px] font-black uppercase transition-all border border-emerald-100"><Download size={12} /> Relatório</button>
                    </>
                  ) : (
                    <button onClick={() => { setClienteSelecionado(c); setModalEmailAberto(true); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${c.status === 'enviado' ? 'text-amber-600 hover:bg-amber-50 border-amber-100' : 'text-blue-600 hover:bg-blue-50 border-blue-100'}`}><Mail size={12} /> {c.status === 'enviado' ? 'Reenviar' : 'Enviar Email'}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Validação Equipa Tab */}
      {portalSubTab === 'colaboradores' && portalView === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
              <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Horas</th>
              <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
              <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
            </tr></thead>
            <tbody>
              {sortedWorkers.map(w => (
                <tr key={w.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-800 uppercase">{w.name}</td>
                  <td className="px-4 py-3 text-right font-black text-indigo-600 tabular-nums">{fmtH(w.totalHours)}</td>
                  <td className="px-4 py-3 text-center">
                    {w.isApproved ? <CheckCircle size={16} className="text-emerald-500 mx-auto" /> : <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onLogin('worker', { ...w, isAdminImpersonating: true })} className="p-1.5 text-indigo-400 hover:bg-indigo-50 rounded-lg transition-all" title="Ver Portal"><Search size={13} /></button>
                      {!w.isApproved ? (
                        <button onClick={async () => { const id = "appr_" + w.id + "_" + portalMonthStr; try { await saveToDb('approvals', id, { id, workerId: w.id, month: portalMonthStr, timestamp: new Date().toISOString() }); } catch (err) { alert('Erro: ' + err?.message); } }} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all" title="Aprovar"><UserCheck size={13} /></button>
                      ) : (
                        <button onClick={async () => { try { await handleDelete('approvals', w.approval.id); } catch (err) { alert('Erro: ' + err?.message); } }} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-all" title="Anular"><RotateCcw size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {portalSubTab === 'colaboradores' && portalView === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {sortedWorkers.map(w => (
            <div key={w.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200">
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border flex items-center gap-1 ${w.isApproved ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-amber-500 border-amber-200 bg-amber-50'}`}>
                  {w.isApproved && <CheckCircle size={10} />}
                  {w.isApproved ? 'Aprovado' : 'Pendente'}
                </div>
                <span className="text-lg font-black text-indigo-600">{formatHours(w.totalHours)}h</span>
              </div>
              {/* Name */}
              <h4 className="font-black text-slate-800 text-sm uppercase truncate mb-4">{w.name}</h4>
              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => onLogin('worker', { ...w, isAdminImpersonating: true })}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-indigo-600 hover:bg-indigo-50 rounded-xl text-[10px] font-black uppercase transition-all border border-indigo-100"
                  title="Ver Portal"
                >
                  <Search size={12} /> Ver Portal
                </button>
                {!w.isApproved ? (
                  <button
                    onClick={async () => { const id = "appr_" + w.id + "_" + portalMonthStr; try { await saveToDb('approvals', id, { id, workerId: w.id, month: portalMonthStr, timestamp: new Date().toISOString() }); } catch (err) { alert('Erro ao aprovar: ' + (err?.message || err)); } }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-emerald-600 hover:bg-emerald-50 rounded-xl text-[10px] font-black uppercase transition-all border border-emerald-100"
                  >
                    <UserCheck size={12} /> Aprovar
                  </button>
                ) : (
                  <button
                    onClick={async () => { try { await handleDelete('approvals', w.approval.id); } catch (err) { alert('Erro ao anular: ' + (err?.message || err)); } }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-rose-500 hover:bg-rose-50 rounded-xl text-[10px] font-black uppercase transition-all border border-rose-100"
                  >
                    <RotateCcw size={12} /> Anular
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Correções Tab */}
      {portalSubTab === 'correcoes' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CorrectionsInbox />
        </div>
      )}

      {/* Links Clientes Tab */}
      {portalSubTab === 'links' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecione o Cliente</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold appearance-none cursor-pointer" value={clientPortalLinkFilter.clientId} onChange={e => setClientPortalLinkFilter({ ...clientPortalLinkFilter, clientId: e.target.value })}>
                <option value="">-- Escolher Cliente --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mês de Referência</label>
              <input type="month" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={clientPortalLinkFilter.month} onChange={e => setClientPortalLinkFilter({ ...clientPortalLinkFilter, month: e.target.value })} />
            </div>
          </div>
          {clientPortalLinkFilter.clientId && clientPortalLinkFilter.month && (
            <div className="p-4 sm:p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Link Gerado:</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono text-indigo-600 truncate shadow-inner">
                  {`${window.location.origin}${window.location.pathname}?view=client_portal&client=${clientPortalLinkFilter.clientId}&month=${clientPortalLinkFilter.month}`}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?view=client_portal&client=${clientPortalLinkFilter.clientId}&month=${clientPortalLinkFilter.month}`)}
                  className="px-5 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                >
                  <Link size={14} /> Copiar
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 italic">Envie este link ao cliente para validar as horas.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ValidationPortal;
