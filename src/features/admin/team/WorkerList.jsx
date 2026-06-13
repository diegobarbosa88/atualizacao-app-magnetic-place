import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { LayoutGrid, List, Search, Edit2, Trash2, CheckCircle, ShieldCheck, ShieldOff } from 'lucide-react';

const WorkerList = ({ sortedWorkers, workersView, setWorkersView, workersSort, setWorkersSort, onLogin, onEdit, onOpenVHHistory, onOpenEmpHistory }) => {
  const { approvals, currentMonthStr, schedules, clients, saveToDb } = useApp();
  const [confirmDeleteWorkerId, setConfirmDeleteWorkerId] = useState(null);

  const handleDelete = (id) => {
    // propagate up — parent should handle actual deletion
    onEdit?.({ __deleteId: id });
  };

  if (workersView === 'list') {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th onClick={() => setWorkersSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors">Colaborador {workersSort.key === 'name' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
              <th onClick={() => setWorkersSort(prev => ({ key: 'schedule', direction: prev.key === 'schedule' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="hidden sm:table-cell text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors">Horário {workersSort.key === 'schedule' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
              <th onClick={() => setWorkersSort(prev => ({ key: 'unit', direction: prev.key === 'unit' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="hidden sm:table-cell text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors">Unidade {workersSort.key === 'unit' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
              <th className="hidden sm:table-cell text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor/H</th>
              <th onClick={() => setWorkersSort(prev => ({ key: 'status', direction: prev.key === 'status' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors">Acesso {workersSort.key === 'status' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
              <th className="text-left px-4 py-3 text-[10px] font-black text-amber-400 uppercase tracking-widest">Pedido Registo</th>
              <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedWorkers.map(w => (
              <tr key={w.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-black text-slate-800 text-sm uppercase truncate">{w.name}</p>
                  <p className="text-xs text-slate-400">{w.profissao || 'Staff'}</p>
                </td>
                <td className="hidden sm:table-cell px-4 py-3 text-sm font-bold text-slate-500 truncate">{schedules.find(s => s.id === w.defaultScheduleId)?.name || 'N/A'}</td>
                <td className="hidden sm:table-cell px-4 py-3 text-sm font-bold text-slate-500 truncate">{clients.find(c => c.id === w.defaultClientId)?.name || 'N/A'}</td>
                <td className="hidden sm:table-cell px-4 py-3 text-sm font-bold text-slate-500">{w.valorHora ? `${w.valorHora}€` : 'N/A'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => saveToDb('workers', w.id, { ...w, status: w.status === 'inativo' ? 'ativo' : 'inativo' })} title={w.status === 'inativo' ? 'Inativo — clique para ativar' : 'Ativo — clique para desativar'} className={`p-1.5 rounded-lg transition-all ${w.status === 'inativo' ? 'text-rose-400 hover:bg-rose-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                    {w.status === 'inativo' ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => saveToDb('workers', w.id, { ...w, limited_entry_mode: !w.limited_entry_mode })} title={w.limited_entry_mode ? 'Modo limitado ativo — clique para desativar' : 'Modo livre — clique para ativar modo limitado'} className={`p-1.5 rounded-lg transition-all ${w.limited_entry_mode ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:bg-slate-100'}`}>
                    {w.limited_entry_mode ? <ShieldOff size={16} /> : <CheckCircle size={16} />}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => onOpenEmpHistory(w.id, w.name)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Períodos de emprego">📅</button>
                    <button onClick={() => onOpenVHHistory(w.id, w.name)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Histórico de valor">📊</button>
                    <button onClick={() => onLogin('worker', { ...w, isAdminImpersonating: true })} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Ver Portal"><Search size={13} /></button>
                    <button onClick={() => onEdit(w)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Editar"><Edit2 size={13} /></button>
                    {confirmDeleteWorkerId === w.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { handleDelete(w.id); setConfirmDeleteWorkerId(null); }} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg">Sim</button>
                        <button onClick={() => setConfirmDeleteWorkerId(null)} className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg">Não</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteWorkerId(w.id)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-all" title="Apagar"><Trash2 size={13} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedWorkers.map(w => {
        const workerApproval = approvals.find(a => a.workerId === w.id && a.month === currentMonthStr);
        return (
          <div key={w.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex justify-between items-start mb-3">
              <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border flex items-center gap-1 ${w.status === 'inativo' ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50'}`}>
                {w.status !== 'inativo' && <CheckCircle size={10} />}
                {w.status === 'inativo' ? 'Inativo' : 'Ativo'}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onLogin('worker', { ...w, isAdminImpersonating: true })} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-indigo-100" title="Ver Portal"><Search size={12} /></button>
                <button onClick={() => onEdit(w)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all border border-amber-100" title="Editar"><Edit2 size={12} /></button>
                <button onClick={() => onOpenEmpHistory(w.id, w.name)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-slate-100 text-xs" title="Períodos de emprego">📅</button>
                <button onClick={() => onOpenVHHistory(w.id, w.name)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-slate-100 text-xs" title="Histórico de valor">📊</button>
                {confirmDeleteWorkerId === w.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => { handleDelete(w.id); setConfirmDeleteWorkerId(null); }} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg">Sim</button>
                    <button onClick={() => setConfirmDeleteWorkerId(null)} className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg">Não</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteWorkerId(w.id)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all border border-slate-100"><Trash2 size={12} /></button>
                )}
              </div>
            </div>
            <h4 className="font-black text-slate-800 text-sm uppercase truncate mb-0.5">{w.name}</h4>
            <p className="text-[10px] text-slate-400 font-bold truncate mb-3">{w.profissao || 'Staff'}</p>
            <div className="text-[10px] text-slate-400 font-bold space-y-1 border-t border-slate-50 pt-2">
              <div className="flex items-center gap-1.5">
                <span>⏱</span> {schedules.find(s => s.id === w.defaultScheduleId)?.name || 'N/A'}
              </div>
              <div className="flex items-center gap-1.5">
                <span>💼</span> {clients.find(c => c.id === w.defaultClientId)?.name || 'N/A'}
              </div>
              {workerApproval && (
                <div className="flex items-center gap-1 pt-1"><CheckCircle size={10} className="text-emerald-500" /><span className="text-emerald-600">Aprovado</span></div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export { WorkerList as default, WorkerList };
