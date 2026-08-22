import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { authFetch } from '../../../utils/authFetch';
import { impersonarTrabalhador } from '../../../utils/impersonateWorker';
import { Search, Edit2, Trash2, CheckCircle, ShieldCheck, ShieldOff, MoreVertical, FolderOpen, SendHorizonal, AlertTriangle, Shield } from 'lucide-react';
import SSComunicacaoModal from './SSComunicacaoModal';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ssBadge(w) {
  if (w.ss_cessacao_comunicada_em) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 border border-slate-200 text-slate-500">
        <CheckCircle size={8} /> SS Cessação OK
      </span>
    );
  }
  if (w.dataFim && !w.ss_cessacao_comunicada_em) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-orange-50 border border-orange-200 text-orange-600">
        <AlertTriangle size={8} /> SS Cessação pendente
      </span>
    );
  }
  if (w.ss_admissao_comunicada_em) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 border border-emerald-200 text-emerald-600">
        <CheckCircle size={8} /> SS Admissão OK
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-50 border border-amber-200 text-amber-600">
      <AlertTriangle size={8} /> SS por comunicar
    </span>
  );
}

function apoliceBadge(w, apoliceMap) {
  const status = apoliceMap[w.id]?.status;
  if (status === 'ativo') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 border border-emerald-200 text-emerald-600">
        <Shield size={8} /> Apólice Ativa
      </span>
    );
  }
  if (status === 'solicitado' || status === 'pendente') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-50 border border-amber-200 text-amber-600">
        <AlertTriangle size={8} /> Apólice Solicitada
      </span>
    );
  }
  if (status === 'excluido') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 border border-slate-200 text-slate-500">
        <ShieldOff size={8} /> Apólice Excluída
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-50 border border-amber-200 text-amber-600">
      <AlertTriangle size={8} /> Apólice por confirmar
    </span>
  );
}

const WorkerList = ({ sortedWorkers, workersView, setWorkersView, workersSort, setWorkersSort, onLogin, onEdit, onOpenVHHistory, onOpenEmpHistory, onVerPasta }) => {
  const { approvals, currentMonthStr, schedules, clients, saveToDb, setWorkers } = useApp();
  const [confirmDeleteWorkerId, setConfirmDeleteWorkerId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [ssModal, setSsModal] = useState(null); // { worker, tipo: 'admissao'|'cessacao' }
  const [ssAmbiente, setSsAmbiente] = useState('teste');
  const [apoliceMap, setApoliceMap] = useState({});
  const supabase = window.supabaseInstance;

  useEffect(() => {
    if (!supabase) return;
    supabase.from('worker_apolice_seguro').select('worker_id, status').then(({ data }) => {
      setApoliceMap(Object.fromEntries((data || []).map(r => [r.worker_id, r])));
    });
  }, []);

  const verPortal = async (w) => {
    try {
      const { user, token } = await impersonarTrabalhador(w);
      onLogin('worker', { ...user, isAdminImpersonating: true }, token);
    } catch (e) {
      alert(e.message);
    }
  };

  useEffect(() => {
    authFetch('/api/seguranca-social?action=status')
      .then(r => r.json())
      .then(d => { if (d.ambiente) setSsAmbiente(d.ambiente); })
      .catch(() => {});
  }, []);

  function handleSsSuccess(data, workerIdOverride, tipoOverride) {
    const workerId = workerIdOverride || ssModal?.worker?.id;
    const tipo = tipoOverride || ssModal?.tipo;
    if (workerId && tipo) {
      const campo = tipo === 'admissao'
        ? { ss_admissao_comunicada_em: data.dataHora || new Date().toISOString(), ss_admissao_num_registo: data.numRegisto || null }
        : { ss_cessacao_comunicada_em: data.dataHora || new Date().toISOString(), ss_cessacao_num_registo: data.numRegisto || null };
      setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, ...campo } : w));
    }
  }

  const handleDelete = (id) => {
    onEdit?.({ __deleteId: id });
  };

  if (workersView === 'list') {
    return (
      <>
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
                className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-700 transition-colors"
              >
                Colaborador {workersSort.key === 'name' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th
                onClick={() => setWorkersSort(prev => ({ key: 'schedule', direction: prev.key === 'schedule' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                className="hidden sm:table-cell text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-700 transition-colors"
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
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black" style={{ backgroundColor: '#1B3A57', color: '#EB8D00' }}>{getInitials(w.name)}</div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-800 text-sm truncate">{w.name}</p>
                        <p className="text-xs text-slate-400 truncate">{w.profissao || 'Staff'}</p>
                        <div className="mt-1 flex flex-wrap gap-1">{ssBadge(w)}{apoliceBadge(w, apoliceMap)}</div>
                        {w.valorHora && <p className="text-[10px] text-slate-300 font-bold mt-0.5">{w.valorHora}€/h</p>}
                      </div>
                    </div>
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
                          <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-slate-200/80 rounded-2xl shadow-xl ring-1 ring-black/5 py-1.5 min-w-[200px]">
                            <button
                              onClick={() => { onEdit(w); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-amber-50 group transition-colors"
                            >
                              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 text-amber-500 group-hover:bg-amber-200 transition-colors shrink-0"><Edit2 size={13} /></span>
                              <span className="text-xs font-semibold text-slate-700 group-hover:text-amber-700">Editar</span>
                            </button>
                            <button
                              onClick={() => { verPortal(w); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 group transition-colors"
                            >
                              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 transition-colors shrink-0" style={{ color: '#869AAF' }}><Search size={13} /></span>
                              <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-800">Ver Portal</span>
                            </button>
                            <button
                              onClick={() => { onVerPasta?.(w.id); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-emerald-50 group transition-colors"
                            >
                              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-500 group-hover:bg-emerald-200 transition-colors shrink-0"><FolderOpen size={13} /></span>
                              <span className="text-xs font-semibold text-slate-700 group-hover:text-emerald-700">Ver Pasta</span>
                            </button>
                            <div className="mx-3 my-1 border-t border-slate-100" />
                            <button
                              onClick={() => { onOpenEmpHistory(w.id, w.name); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 group transition-colors"
                            >
                              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 transition-colors shrink-0 text-base leading-none">📅</span>
                              <span className="text-xs font-semibold text-slate-700">Períodos de Emprego</span>
                            </button>
                            <button
                              onClick={() => { onOpenVHHistory(w.id, w.name); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 group transition-colors"
                            >
                              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 transition-colors shrink-0 text-base leading-none">📊</span>
                              <span className="text-xs font-semibold text-slate-700">Histórico de Valor</span>
                            </button>
                            {/* Segurança Social */}
                            {(w.status === 'ativo' && !w.ss_admissao_comunicada_em) && (
                              <>
                                <div className="mx-3 my-1 border-t border-slate-100" />
                                <button
                                  onClick={() => { setSsModal({ worker: w, tipo: 'admissao' }); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-blue-50 group transition-colors"
                                >
                                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-500 group-hover:bg-blue-200 transition-colors shrink-0"><SendHorizonal size={13} /></span>
                                  <div className="text-left">
                                    <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-700">Comunicar Admissão à SS</span>
                                    {ssAmbiente === 'teste' && <p className="text-[9px] text-orange-500 font-bold">MODO TESTE</p>}
                                  </div>
                                </button>
                              </>
                            )}
                            {(w.dataFim && !w.ss_cessacao_comunicada_em) && (
                              <>
                                {!(w.status === 'ativo' && !w.ss_admissao_comunicada_em) && <div className="mx-3 my-1 border-t border-slate-100" />}
                                <button
                                  onClick={() => { setSsModal({ worker: w, tipo: 'cessacao' }); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-blue-50 group transition-colors"
                                >
                                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-500 group-hover:bg-blue-200 transition-colors shrink-0"><SendHorizonal size={13} /></span>
                                  <div className="text-left">
                                    <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-700">Comunicar Cessação à SS</span>
                                    {ssAmbiente === 'teste' && <p className="text-[9px] text-orange-500 font-bold">MODO TESTE</p>}
                                  </div>
                                </button>
                              </>
                            )}
                            <div className="mx-3 my-1 border-t border-slate-100" />
                            {confirmDeleteWorkerId === w.id ? (
                              <div className="mx-2 mb-1.5 p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                                <p className="text-[10px] font-black text-rose-500 uppercase tracking-wider mb-2">Confirmar apagar?</p>
                                <div className="flex gap-1.5">
                                  <button onClick={() => { handleDelete(w.id); setConfirmDeleteWorkerId(null); setOpenMenuId(null); }} className="flex-1 py-1.5 bg-rose-600 text-white text-[10px] font-black rounded-lg hover:bg-rose-700 transition-colors">Sim</button>
                                  <button onClick={() => setConfirmDeleteWorkerId(null)} className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black rounded-lg hover:bg-slate-50 transition-colors">Não</button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteWorkerId(w.id)}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-rose-50 group transition-colors"
                              >
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-rose-100 text-rose-500 group-hover:bg-rose-200 transition-colors shrink-0"><Trash2 size={13} /></span>
                                <span className="text-xs font-semibold text-rose-500 group-hover:text-rose-600">Apagar</span>
                              </button>
                            )}
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
      {ssModal && (
        <SSComunicacaoModal
          worker={ssModal.worker}
          tipo={ssModal.tipo}
          ambiente={ssAmbiente}
          onClose={() => setSsModal(null)}
          onSuccess={(data) => { handleSsSuccess(data); setSsModal(null); }}
        />
      )}
    </>
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedWorkers.map(w => {
        const workerApproval = approvals.find(a => a.workerId === w.id && a.month === currentMonthStr);
        return (
          <div key={w.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex justify-between items-start mb-3">
              <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border flex items-center gap-1 ${w.status === 'inativo' ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50'}`}>
                {w.status !== 'inativo' && <CheckCircle size={10} />}
                {w.status === 'inativo' ? 'Inativo' : 'Ativo'}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => verPortal(w)} className="p-1.5 hover:bg-slate-50 rounded-lg transition-all border border-slate-100" style={{ color: '#869AAF' }} title="Ver Portal"><Search size={12} /></button>
                <button onClick={() => onEdit(w)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all border border-amber-100" title="Editar"><Edit2 size={12} /></button>
                <button onClick={() => onVerPasta?.(w.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all border border-emerald-100" title="Ver Pasta de Documentos"><FolderOpen size={12} /></button>
                <button onClick={() => onOpenEmpHistory(w.id, w.name)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all border border-slate-100 text-xs" title="Períodos de emprego">📅</button>
                <button onClick={() => onOpenVHHistory(w.id, w.name)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all border border-slate-100 text-xs" title="Histórico de valor">📊</button>
                {w.status === 'ativo' && !w.ss_admissao_comunicada_em && (
                  <button onClick={() => setSsModal({ worker: w, tipo: 'admissao' })} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all border border-blue-100" title={`Comunicar Admissão à SS${ssAmbiente === 'teste' ? ' (TESTE)' : ''}`}><SendHorizonal size={12} /></button>
                )}
                {w.dataFim && !w.ss_cessacao_comunicada_em && (
                  <button onClick={() => setSsModal({ worker: w, tipo: 'cessacao' })} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all border border-blue-100" title={`Comunicar Cessação à SS${ssAmbiente === 'teste' ? ' (TESTE)' : ''}`}><SendHorizonal size={12} /></button>
                )}
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
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-black" style={{ backgroundColor: '#1B3A57', color: '#EB8D00' }}>{getInitials(w.name)}</div>
              <div className="min-w-0">
                <h4 className="font-black text-slate-800 text-sm truncate">{w.name}</h4>
                <p className="text-[10px] text-slate-400 font-bold truncate">{w.profissao || 'Staff'}</p>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-1">{ssBadge(w)}{apoliceBadge(w, apoliceMap)}</div>
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
    {ssModal && (
      <SSComunicacaoModal
        worker={ssModal.worker}
        tipo={ssModal.tipo}
        ambiente={ssAmbiente}
        onClose={() => setSsModal(null)}
        onSuccess={(data) => { handleSsSuccess(data); setSsModal(null); }}
      />
    )}
    </>
  );
};

export { WorkerList as default, WorkerList };
