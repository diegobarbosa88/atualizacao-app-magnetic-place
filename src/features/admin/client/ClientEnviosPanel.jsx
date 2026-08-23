import React, { useState } from 'react';
import {
  CheckCircle, Mail, Copy, Download, RotateCcw, Link,
  Calendar, ChevronLeft, ChevronRight, LayoutList, LayoutGrid
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { calculateDuration, formatHours } from '../../../utils/formatUtils';
import { toISODateLocal } from '../../../utils/dateUtils';
import { FT } from '../../../styles/designTokens';
import { sendValidationEmail } from '../../../utils/emailUtils';
import { shouldSendNotification } from '../../../config';

export default function ClientEnviosPanel({
  portalMonth,
  setPortalMonth,
  setClienteSelecionado,
  setModalEmailAberto,
  setPrintingReport,
}) {
  const { clients, logs, clientApprovals, handleDelete, saveToDb, notificationPreferences, workers } = useApp();

  const handleAnularValidacao = async (c) => {
    if (!window.confirm('Anular validação?')) return;
    const appr = clientApprovals?.find(a => (String(a.client_id || a.clientId || '') === String(c.id)) && a.month === portalMonthStr);
    if (!appr) return;
    try {
      await handleDelete('client_approvals', appr.id);
      if (c.email && c.share_token && shouldSendNotification('validacao_anulada', 'email', notificationPreferences)) {
        sendValidationEmail({
          to: c.email, name: c.name,
          title: `Validação Anulada · ${portalMonthStr}`,
          message: `A validação do relatório de ${portalMonthStr} foi anulada pelo administrador.`,
          link: `https://painelcliente.magneticplace.pt/?token=${encodeURIComponent(c.share_token)}&month=${encodeURIComponent(portalMonthStr)}`
        }).catch(() => {});
      }
      if (shouldSendNotification('validacao_anulada', 'db', notificationPreferences)) {
        const nId = `notif_clappr_undo_${c.id}_${portalMonthStr}_${Date.now()}`;
        await saveToDb('app_notifications', nId, {
          id: nId,
          title: `❌ Validação anulada`,
          message: `A validação do relatório de ${portalMonthStr} foi anulada. Por favor reveja o relatório.`,
          type: 'warning',
          target_type: 'client',
          target_client_id: String(c.id),
          is_dismissible: true,
          is_active: true,
          read_by_ids: [],
          created_at: new Date().toISOString(),
        });
      }
    } catch (err) { alert('Erro ao anular: ' + (err?.message || err)); }
  };
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
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl shadow-sm border border-[var(--border-soft)]">
          <button onClick={() => setPortalMonth(new Date(portalMonth.getFullYear(), portalMonth.getMonth() - 1, 1))} className="p-1.5 hover:bg-[var(--surface)] rounded-lg transition-all text-[var(--slate)]"><ChevronLeft size={15} /></button>
          <div className="flex items-center gap-1.5 px-2 border-x border-[var(--border-soft)]">
            <Calendar size={13} style={{ color: FT.slate }} />
            <span className="text-xs font-black uppercase text-[var(--ink-mid)]">{portalMonth.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}</span>
          </div>
          <button onClick={() => setPortalMonth(new Date(portalMonth.getFullYear(), portalMonth.getMonth() + 1, 1))} className="p-1.5 hover:bg-[var(--surface)] rounded-lg transition-all text-[var(--slate)]"><ChevronRight size={15} /></button>
        </div>
        <div className="flex items-center gap-1 bg-[var(--surface-dim)] p-1 rounded-2xl shrink-0">
          <button onClick={() => setView('list')} className={`p-1.5 rounded-xl transition-all ${view === 'list' ? 'text-white' : 'text-[var(--slate)] hover:text-[var(--ink-soft)]'}`} style={view === 'list' ? { backgroundColor: FT.navy } : {}}><LayoutList size={14} /></button>
          <button onClick={() => setView('grid')} className={`p-1.5 rounded-xl transition-all ${view === 'grid' ? 'text-white' : 'text-[var(--slate)] hover:text-[var(--ink-soft)]'}`} style={view === 'grid' ? { backgroundColor: FT.navy } : {}}><LayoutGrid size={14} /></button>
        </div>
      </div>

      {view === 'list' && (
        <div className="bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm overflow-x-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
          <table className="w-full text-sm min-w-[600px]">
            <thead><tr className="border-b border-[var(--border-soft)] bg-[var(--surface)]">
              <th className="text-left px-4 py-3 text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest">Cliente</th>
              <th className="text-left px-4 py-3 text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest hidden sm:table-cell">Email</th>
              <th className="text-right px-4 py-3 text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest">Horas</th>
              <th className="text-center px-4 py-3 text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest">Estado</th>
              <th className="text-center px-4 py-3 text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest">Link</th>
              <th className="text-right px-4 py-3 text-[10px] font-black text-[var(--slate-dim)] uppercase tracking-widest">Ações</th>
            </tr></thead>
            <tbody>
              {enrichedClients.map(c => (
                <tr key={c.id} className="border-b border-[var(--border-soft)] hover:bg-[var(--surface)] transition-colors">
                  <td className="px-4 py-3 font-bold text-[var(--ink)]">{c.name}</td>
                  <td className="px-4 py-3 text-[var(--slate-dim)] text-xs hidden sm:table-cell">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-right font-black tabular-nums" style={{ color: 'var(--navy)' }}>{formatHours(c.totalHoras)}h</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
                      c.status === 'validado' ? 'bg-emerald-100 text-emerald-700' :
                      c.status === 'enviado'  ? 'bg-teal-100 text-teal-700' :
                                                 'bg-amber-100 text-amber-700'
                    }`}>
                      {c.status === 'validado' && <CheckCircle size={10} />}
                      {c.status === 'enviado' && <Mail size={10} />}
                      {c.status === 'validado' ? 'Validado' : c.status === 'enviado' ? 'Enviado' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => {
                      if (!c.share_token) { alert('Este cliente não tem share_token gerado.'); return; }
                      const link = `https://painelcliente.magneticplace.pt/?token=${encodeURIComponent(c.share_token)}&month=${encodeURIComponent(portalMonthStr)}`;
                      navigator.clipboard.writeText(link);
                    }} className="p-1.5 rounded-lg hover:bg-[var(--surface-dim)] transition-all" style={{ color: FT.slate }} title="Copiar Link"><Link size={13} /></button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {c.status === 'validado' ? (
                        <>
                          <button onClick={() => handleAnularValidacao(c)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-all" title="Anular"><RotateCcw size={13} /></button>
                          <button onClick={() => setPrintingReport({ client: c, logs, workers, clients, month: portalMonthStr, clientApprovals })} className="p-1.5 rounded-lg hover:bg-[var(--surface-dim)] transition-all" style={{ color: 'var(--slate-dim)' }} title="Relatório"><Download size={13} /></button>
                        </>
                      ) : (
                        <button onClick={() => { setClienteSelecionado(c); setModalEmailAberto(true); }} className="p-1.5 rounded-lg hover:bg-[var(--surface-dim)] transition-all" style={{ color: 'var(--navy)' }} title="Enviar Email"><Mail size={13} /></button>
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
            const linkUnico = c.share_token
              ? `https://painelcliente.magneticplace.pt/?token=${encodeURIComponent(c.share_token)}&month=${encodeURIComponent(portalMonthStr)}`
              : null;
            return (
              <div key={c.id} className="bg-white p-5 rounded-2xl border border-[var(--border-soft)] shadow-sm hover:shadow-md hover:border-[var(--border)] hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex justify-between items-start mb-3">
                  <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border flex items-center gap-1 ${c.status === 'validado' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : c.status === 'enviado' ? 'text-teal-600 border-teal-200 bg-teal-50' : 'text-amber-600 border-amber-200 bg-amber-50'}`}>
                    {c.status === 'validado' && <CheckCircle size={10} />}
                    {c.status === 'enviado' && <Mail size={10} />}
                    {c.status === 'validado' ? 'Validado' : c.status === 'enviado' ? 'Enviado' : 'Pendente'}
                  </div>
                  <span className="text-lg font-black" style={{ color: 'var(--navy)' }}>{formatHours(c.totalHoras)}h</span>
                </div>
                <h4 className="font-black text-[var(--ink)] text-sm truncate mb-0.5">{c.name}</h4>
                <p className="text-[10px] text-[var(--slate-dim)] font-bold truncate mb-3">{c.email || 'Sem email'}</p>
                <div className="flex items-center gap-1.5 mb-3 bg-[var(--surface)] rounded-xl p-2 border border-[var(--border-soft)]">
                  <span className="text-[9px] font-mono text-[var(--slate-dim)] truncate flex-1">{linkUnico ? linkUnico.replace(/.*\?/, '?') : 'Sem share_token'}</span>
                  <button disabled={!linkUnico} onClick={() => linkUnico && navigator.clipboard.writeText(linkUnico)} className="text-[var(--slate)] hover:text-[var(--slate)] transition-colors shrink-0 disabled:opacity-30"><Copy size={12} /></button>
                </div>
                <div className="flex gap-2">
                  {c.status === 'validado' ? (
                    <>
                      <button onClick={() => handleAnularValidacao(c)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-rose-500 hover:bg-rose-50 rounded-xl text-[10px] font-black uppercase transition-all border border-rose-100"><RotateCcw size={12} /> Anular</button>
                      <button onClick={() => setPrintingReport({ client: c, logs, workers, clients, month: portalMonthStr, clientApprovals })} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase transition-all border hover:bg-[var(--surface)]" style={{ color: 'var(--navy)', borderColor: FT.slate }}><Download size={12} /> Relatório</button>
                    </>
                  ) : (
                    <button onClick={() => { setClienteSelecionado(c); setModalEmailAberto(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase transition-all text-white hover:opacity-90" style={{ backgroundColor: FT.navy }}><Mail size={12} /> {c.status === 'enviado' ? 'Reenviar' : 'Enviar Email'}</button>
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
