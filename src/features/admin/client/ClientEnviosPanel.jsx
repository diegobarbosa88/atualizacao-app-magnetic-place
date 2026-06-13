import React, { useState } from 'react';
import {
  CheckCircle, Mail, Copy, Download, RotateCcw, Link,
  Calendar, ChevronLeft, ChevronRight, LayoutList, LayoutGrid
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { calculateDuration, formatHours } from '../../../utils/formatUtils';
import { toISODateLocal } from '../../../utils/dateUtils';
import { sendValidationEmail } from '../../../utils/emailUtils';
import { shouldSendNotification } from '../../../config';

const toClientLinkId = (id) => {
  if (!id) return null;
  if (id.startsWith('c')) return id;
  if (id.startsWith('client_')) return 'c' + id.replace('client_', '');
  return 'c' + id;
};

export default function ClientEnviosPanel({
  portalMonth,
  setPortalMonth,
  setClienteSelecionado,
  setModalEmailAberto,
  setPrintingReport,
}) {
  const { clients, logs, clientApprovals, handleDelete, notificationPreferences, workers } = useApp();
  const [view, setView] = useState(window.innerWidth < 768 ? 'grid' : 'list');
  const [sortConfig] = useState({ key: 'name', direction: 'asc' });

  const portalMonthStr = toISODateLocal(portalMonth).substring(0, 7);

  const enrichedClients = [...clients].map(c => {
    const totalHoras = logs
      .filter(l => l.clientId === c.id && l.date?.substring(0, 7) === portalMonthStr)
      .reduce((acc, l) => acc + (l.hours || calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd)), 0);
    const approval = clientApprovals?.find(a => (String(a.client_id || a.clientId || '') === String(c.id)) && a.month === portalMonthStr);
    const status = approval ? 'validado' : (c.status_email === `enviado_${portalMonthStr}` ? 'enviado' : 'pendente');
    return { ...c, totalHoras, status };
  }).sort((a, b) => {
    let res = 0;
    if (sortConfig.key === 'name') res = a.name.localeCompare(b.name);
    if (sortConfig.key === 'hours') res = a.totalHoras - b.totalHoras;
    if (sortConfig.key === 'status') {
      const statusOrder = { 'pendente': 1, 'enviado': 2, 'validado': 3 };
      res = statusOrder[a.status] - statusOrder[b.status];
    }
    return sortConfig.direction === 'asc' ? res : -res;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl shadow-sm border border-slate-100">
          <button onClick={() => setPortalMonth(new Date(portalMonth.getFullYear(), portalMonth.getMonth() - 1, 1))} className="p-1.5 hover:bg-slate-50 rounded-lg transition-all text-slate-400"><ChevronLeft size={15} /></button>
          <div className="flex items-center gap-1.5 px-2 border-x border-slate-100">
            <Calendar size={13} className="text-indigo-600" />
            <span className="text-xs font-black uppercase text-slate-700">{portalMonth.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}</span>
          </div>
          <button onClick={() => setPortalMonth(new Date(portalMonth.getFullYear(), portalMonth.getMonth() + 1, 1))} className="p-1.5 hover:bg-slate-50 rounded-lg transition-all text-slate-400"><ChevronRight size={15} /></button>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl shrink-0">
          <button onClick={() => setView('list')} className={`p-1.5 rounded-xl transition-all ${view === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutList size={14} /></button>
          <button onClick={() => setView('grid')} className={`p-1.5 rounded-xl transition-all ${view === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={14} /></button>
        </div>
      </div>

      {view === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
          <table className="w-full text-sm min-w-[600px]">
            <thead><tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
              <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell">Email</th>
              <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Horas</th>
              <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
              <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Link</th>
              <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
            </tr></thead>
            <tbody>
              {enrichedClients.map(c => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-right font-black text-indigo-600 tabular-nums">{formatHours(c.totalHoras)}h</td>
                  <td className="px-4 py-3 text-center">
                    {c.status === 'validado' && <CheckCircle size={16} className="text-emerald-500 mx-auto" />}
                    {c.status === 'enviado' && <Mail size={16} className="text-blue-500 mx-auto" />}
                    {c.status === 'pendente' && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => {
                      const link = `https://painelcliente.magneticplace.pt/?client=${encodeURIComponent(toClientLinkId(c.id))}&month=${encodeURIComponent(portalMonthStr)}`;
                      navigator.clipboard.writeText(link);
                    }} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Copiar Link"><Link size={13} /></button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {c.status === 'validado' ? (
                        <>
                          <button onClick={async () => { if (!window.confirm('Anular validação?')) return; const appr = clientApprovals?.find(a => (String(a.client_id || a.clientId || '') === String(c.id)) && a.month === portalMonthStr); if (!appr) return; try { await handleDelete('client_approvals', appr.id); if (c.email && shouldSendNotification('validacao_anulada', 'email', notificationPreferences)) { sendValidationEmail({ to: c.email, name: c.name, title: `Validação Anulada · ${portalMonthStr}`, message: `A validação do relatório de ${portalMonthStr} foi anulada pelo administrador.`, link: `https://painelcliente.magneticplace.pt/?view=client_portal&client=${encodeURIComponent(c.id)}&month=${encodeURIComponent(portalMonthStr)}` }).catch(() => {}); } } catch (err) { alert('Erro ao anular: ' + (err?.message || err)); } }} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-all" title="Anular"><RotateCcw size={13} /></button>
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

      {view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {enrichedClients.map(c => {
            const linkUnico = `https://painelcliente.magneticplace.pt/?client=${encodeURIComponent(toClientLinkId(c.id))}&month=${encodeURIComponent(portalMonthStr)}`;
            return (
              <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex justify-between items-start mb-3">
                  <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border flex items-center gap-1 ${c.status === 'validado' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : c.status === 'enviado' ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-slate-400 border-slate-200 bg-slate-50'}`}>
                    {c.status === 'validado' && <CheckCircle size={10} />}
                    {c.status === 'enviado' && <Mail size={10} />}
                    {c.status === 'validado' ? 'Validado' : c.status === 'enviado' ? 'Enviado' : 'Pendente'}
                  </div>
                  <span className="text-lg font-black text-indigo-600">{formatHours(c.totalHoras)}h</span>
                </div>
                <h4 className="font-black text-slate-800 text-sm truncate mb-0.5">{c.name}</h4>
                <p className="text-[10px] text-slate-400 font-bold truncate mb-3">{c.email || 'Sem email'}</p>
                <div className="flex items-center gap-1.5 mb-3 bg-slate-50 rounded-xl p-2 border border-slate-100">
                  <span className="text-[9px] font-mono text-slate-400 truncate flex-1">{linkUnico.replace(/.*\?/, '?')}</span>
                  <button onClick={() => navigator.clipboard.writeText(linkUnico)} className="text-slate-300 hover:text-indigo-600 transition-colors shrink-0"><Copy size={12} /></button>
                </div>
                <div className="flex gap-2">
                  {c.status === 'validado' ? (
                    <>
                      <button onClick={async () => { if (!window.confirm('Anular validação?')) return; const appr = clientApprovals?.find(a => (String(a.client_id || a.clientId || '') === String(c.id)) && a.month === portalMonthStr); if (!appr) return; try { await handleDelete('client_approvals', appr.id); if (c.email && shouldSendNotification('validacao_anulada', 'email', notificationPreferences)) { sendValidationEmail({ to: c.email, name: c.name, title: `Validação Anulada · ${portalMonthStr}`, message: `A validação do relatório de ${portalMonthStr} foi anulada pelo administrador.`, link: `https://painelcliente.magneticplace.pt/?view=client_portal&client=${encodeURIComponent(c.id)}&month=${encodeURIComponent(portalMonthStr)}` }).catch(() => {}); } } catch (err) { alert('Erro ao anular: ' + (err?.message || err)); } }} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-rose-500 hover:bg-rose-50 rounded-xl text-[10px] font-black uppercase transition-all border border-rose-100"><RotateCcw size={12} /> Anular</button>
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
    </div>
  );
}
