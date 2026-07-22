import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { Search, Edit2, Trash2, CheckCircle, ShieldCheck, ShieldOff, MoreVertical } from 'lucide-react';

const WorkerList = ({ sortedWorkers, workersView, setWorkersView, workersSort, setWorkersSort, onLogin, onEdit, onOpenVHHistory, onOpenEmpHistory }) => {
  const { approvals, currentMonthStr, schedules, clients, saveToDb } = useApp();
  const [confirmDeleteWorkerId, setConfirmDeleteWorkerId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  const handleDelete = (id) => {
    onEdit?.({ __deleteId: id });
  };

  if (workersView === 'list') {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="min-w-[480px] w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[42%]" />
            <col className="hidden sm:table-column w-[33%]" />
            <col className="w-[17%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th
                onClick={() => setWorkersSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
              >
                Colaborador {workersSort.key === 'name' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th
                onClick={() => setWorkersSort(prev => ({ key: 'schedule', direction: prev.key === 'schedule' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                className="hidden sm:table-cell text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
              >
                Horário · Unidade {workersSort.key === 'schedule' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="text-left px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Estado
              </th>
              <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedWorkers.map(w => {
              const schedule = schedules.find(s => s.id === w.defaultScheduleId);
              const client = clients.find(c => c.id === w.defaultClientId);
              return (
                <tr key={w.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  {/* Colaborador */}
                  <td className="px-4 py-3">
                    <p className="font-black text-slate-800 text-sm uppercase truncate">{w.name}</p>
                    <p className="text-xs text-slate-400 truncate">{w.profissao || 'Staff'}</p>
                    {w.valorHora && <p className="text-[10px] text-slate-300 font-bold mt-0.5">{w.valorHora}€/h</p>}
                  </td>

                  {/* Horário · Unidade (oculto em mobile) */}
                  <td className="hidden sm:table-cell px-4 py-3">
                    <p className="text-xs font-bold text-slate-500 truncate">{schedule?.name || 'N/A'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{client?.name || 'N/A'}</p>
                  </td>

                  {/* Estado — dois toggles compactos */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => saveToDb('workers', w.id, { ...w, status: w.status === 'inativo' ? 'ativo' : 'inativo' })}
                        title={w.status === 'inativo' ? 'Inativo — clique para ativar' : 'Ativo — clique para desativar'}
                        className={`p-1.5 rounded-lg transition-all ${w.status === 'inativo' ? 'text-rose-400 hover:bg-rose-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                      >
                        {w.status === 'inativo' ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                      </button>
                      <button
                        onClick={() => saveToDb('workers', w.id, { ...w, limited_entry_mode: !w.limited_entry_mode })}
                        title={w.limited_entry_mode ? 'Modo limitado ativo — clique para desativar' : 'Modo livre — clique para ativar modo limitado'}
                        className={`p-1.5 rounded-lg transition-all ${w.limited_entry_mode ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:bg-slate-100'}`}
                      >
                        {w.limited_entry_mode ? <ShieldOff size={15} /> : <CheckCircle size={15} />}
                      </button>
                    </div>
                  </td>

                  {/* Ações — dropdown ⋮ */}
                  <td className="px-3 py-3 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === w.id ? null : w.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                        title="Mais ações"
                      >
                        <MoreVertical size={15} />
                      </button>
                      {openMenuId === w.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[175px]">
                            <button
                              onClick={() => { onEdit(w); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Edit2 size={13} className="text-amber-500" /> Editar
                            </button>
                            <button
                              onClick={() => { onLogin('worker', { ...w, isAdminImpersonating: true }); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Search size={13} className="text-indigo-500" /> Ver Portal
                            </button>
                            <button
                              onClick={() => { onOpenEmpHistory(w.id, w.name); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <span className="text-sm">📅</span> Períodos de Emprego
                            </button>
                            <button
                              onClick={() => { onOpenVHHistory(w.id, w.name); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <span className="text-sm">📊</span> Histórico de Valor
                            </button>
                            <div className="border-t border-slate-100 mt-1 pt-1">
                              {confirmDeleteWorkerId === w.id ? (
                                <div className="flex items-center gap-1 px-3 py-1">
                                  <button
                                    onClick={() => { handleDelete(w.id); setConfirmDeleteWorkerId(null); setOpenMenuId(null); }}
                                    className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg"
                                  >
                                    Sim
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteWorkerId(null)}
                                    className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg"
                                  >
                                    Não
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteWorkerId(w.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-50 transition-colors"
                                >
                                  <Trash2 size={13} /> Apagar
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
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
