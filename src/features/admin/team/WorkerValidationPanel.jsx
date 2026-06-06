import React, { useState, useMemo } from 'react';
import {
  CheckCircle, UserCheck, RotateCcw, Search,
  Calendar, ChevronLeft, ChevronRight, LayoutList, LayoutGrid
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { calculateDuration, formatHours } from '../../../utils/formatUtils';
import { toISODateLocal } from '../../../utils/dateUtils';

export default function WorkerValidationPanel({ onLogin }) {
  const { workers, logs, approvals, saveToDb, handleDelete } = useApp();
  const [month, setMonth] = useState(new Date());
  const [view, setView] = useState(window.innerWidth < 768 ? 'grid' : 'list');
  const [sort] = useState({ key: 'name', direction: 'asc' });

  const monthStr = toISODateLocal(month).substring(0, 7);
  const fmtH = (h) => `${Number.isInteger(h) ? h : h.toFixed(1)}H`;

  const sortedWorkers = useMemo(() => {
    return [...workers].map(w => {
      const totalHours = logs
        .filter(l => l.workerId === w.id && l.date?.substring(0, 7) === monthStr)
        .reduce((acc, l) => acc + (l.hours ?? calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd)), 0);
      const approval = approvals.find(a => a.workerId === w.id && a.month === monthStr);
      return { ...w, totalHours, isApproved: !!approval, approval };
    }).sort((a, b) => {
      let res = 0;
      if (sort.key === 'name') res = a.name.localeCompare(b.name);
      if (sort.key === 'hours') res = a.totalHours - b.totalHours;
      if (sort.key === 'status') res = (a.isApproved ? 1 : 0) - (b.isApproved ? 1 : 0);
      return sort.direction === 'asc' ? res : -res;
    });
  }, [workers, logs, monthStr, approvals, sort]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl shadow-sm border border-slate-100">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-1.5 hover:bg-slate-50 rounded-lg transition-all text-slate-400"><ChevronLeft size={15} /></button>
          <div className="flex items-center gap-1.5 px-2 border-x border-slate-100">
            <Calendar size={13} className="text-indigo-600" />
            <span className="text-xs font-black uppercase text-slate-700">{month.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}</span>
          </div>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-1.5 hover:bg-slate-50 rounded-lg transition-all text-slate-400"><ChevronRight size={15} /></button>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl shrink-0">
          <button onClick={() => setView('list')} className={`p-1.5 rounded-xl transition-all ${view === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutList size={14} /></button>
          <button onClick={() => setView('grid')} className={`p-1.5 rounded-xl transition-all ${view === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={14} /></button>
        </div>
      </div>

      {view === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
          <table className="w-full text-sm min-w-[400px]">
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
                        <button onClick={async () => { const id = "appr_" + w.id + "_" + monthStr; try { await saveToDb('approvals', id, { id, workerId: w.id, month: monthStr, timestamp: new Date().toISOString() }); } catch (err) { alert('Erro: ' + err?.message); } }} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all" title="Aprovar"><UserCheck size={13} /></button>
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

      {view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {sortedWorkers.map(w => (
            <div key={w.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex justify-between items-start mb-3">
                <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border flex items-center gap-1 ${w.isApproved ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-amber-500 border-amber-200 bg-amber-50'}`}>
                  {w.isApproved && <CheckCircle size={10} />}
                  {w.isApproved ? 'Aprovado' : 'Pendente'}
                </div>
                <span className="text-lg font-black text-indigo-600">{formatHours(w.totalHours)}h</span>
              </div>
              <h4 className="font-black text-slate-800 text-sm uppercase truncate mb-4">{w.name}</h4>
              <div className="flex gap-2">
                <button onClick={() => onLogin('worker', { ...w, isAdminImpersonating: true })} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-indigo-600 hover:bg-indigo-50 rounded-xl text-[10px] font-black uppercase transition-all border border-indigo-100" title="Ver Portal">
                  <Search size={12} /> Ver Portal
                </button>
                {!w.isApproved ? (
                  <button onClick={async () => { const id = "appr_" + w.id + "_" + monthStr; try { await saveToDb('approvals', id, { id, workerId: w.id, month: monthStr, timestamp: new Date().toISOString() }); } catch (err) { alert('Erro ao aprovar: ' + (err?.message || err)); } }} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-emerald-600 hover:bg-emerald-50 rounded-xl text-[10px] font-black uppercase transition-all border border-emerald-100">
                    <UserCheck size={12} /> Aprovar
                  </button>
                ) : (
                  <button onClick={async () => { try { await handleDelete('approvals', w.approval.id); } catch (err) { alert('Erro ao anular: ' + (err?.message || err)); } }} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-rose-500 hover:bg-rose-50 rounded-xl text-[10px] font-black uppercase transition-all border border-rose-100">
                    <RotateCcw size={12} /> Anular
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
