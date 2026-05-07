import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTeam, TeamProvider } from './contexts/TeamContext';
import { useClient, ClientProvider } from './contexts/ClientContext';
import { useSchedule, ScheduleProvider } from './contexts/ScheduleContext';
import { 
  Users, LayoutGrid, List, UserCircle, Search, Edit2, 
  Trash2, Timer, Briefcase, CheckCircle, Unlock 
} from 'lucide-react';

const TeamManagerContent = ({ onLogin }) => {
  const { 
    workers, 
    schedules, 
    clients, 
    approvals, 
    currentMonthStr,
    supabase 
  } = useApp();

  const {
    isAddingInTab, setIsAddingInTab,
    workersView, setWorkersView,
    workersSort, setWorkersSort,
    workerForm, setWorkerForm,
    handleSaveWorker,
    handleDeleteWorker
  } = useTeam();

  const [showInactive, setShowInactive] = useState(false);
  
  // D-06: Estado para histórico de valor hora
  const [showWorkerHistory, setShowWorkerHistory] = useState({ show: false, workerId: null, workerName: '' });
  const [workerValorHoraHistory, setWorkerValorHoraHistory] = useState([]);

  // D-06: Função para carregar histórico
  const loadWorkerValorHoraHistory = async (workerId, workerName) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('worker_valorhora_history')
      .select('*')
      .eq('worker_id', workerId)
      .order('data_alteracao', { ascending: false });
    setWorkerValorHoraHistory(data || []);
    setShowWorkerHistory({ show: true, workerId, workerName });
  };

  // Contador de inativos
  const inactiveCount = workers.filter(w => w.status === 'inativo').length;

  // Filtrar workers para display
  const displayWorkers = workers.filter(w => {
    if (showInactive) return true; // Mostrar todos
    return w.status !== 'inativo'; // Só ativos
  });

  const sortedWorkers = [...displayWorkers].sort((a, b) => {
    let res = 0;
    if (workersSort.key === 'name') res = a.name.localeCompare(b.name);
    if (workersSort.key === 'profissao') res = (a.profissao || '').localeCompare(b.profissao || '');
    if (workersSort.key === 'schedule') {
      const nameA = schedules.find(s => s.id === a.defaultScheduleId)?.name || '';
      const nameB = schedules.find(s => s.id === b.defaultScheduleId)?.name || '';
      res = nameA.localeCompare(nameB);
    }
    if (workersSort.key === 'unit') {
      const nameA = clients.find(c => c.id === a.defaultClientId)?.name || '';
      const nameB = clients.find(c => c.id === b.defaultClientId)?.name || '';
      res = nameA.localeCompare(nameB);
    }
    if (workersSort.key === 'status') res = (a.status || 'ativo').localeCompare(b.status || 'ativo');
    return workersSort.direction === 'asc' ? res : -res;
  });

  const { saveToDb, handleDelete } = useApp();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black flex items-center gap-3"><Users size={32} className="text-indigo-600" /> Gestão de Colaboradores</h2>
        <div className="flex items-center gap-4">
          {inactiveCount > 0 && (
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
                className="rounded border-slate-300"
              />
              Mostrar inativos ({inactiveCount})
            </label>
          )}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button onClick={() => setWorkersView('grid')} className={`p-2 rounded-lg transition-all ${workersView === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Grade"><LayoutGrid size={18} /></button>
            <button onClick={() => setWorkersView('list')} className={`p-2 rounded-lg transition-all ${workersView === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Lista"><List size={18} /></button>
          </div>
          <button onClick={() => { setWorkerForm({ id: null, name: '', assignedClients: [], assignedSchedules: [], defaultClientId: '', defaultScheduleId: '', tel: '', valorHora: '', profissao: '', nis: '', nif: '', iban: '', status: 'ativo', dataInicio: '', dataFim: '' }); setIsAddingInTab(!isAddingInTab); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-lg transition-all ${isAddingInTab ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}>{isAddingInTab ? 'Fechar Form' : 'Novo Trabalhador'}</button>
        </div>
      </div>

      {isAddingInTab && (
        <div className="mb-10 bg-white p-10 rounded-[3rem] shadow-xl border-2 border-indigo-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome Completo</label><input type="text" value={workerForm.name} onChange={e => setWorkerForm({ ...workerForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" placeholder="Nome" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Profissão</label><input type="text" value={workerForm.profissao || ''} onChange={e => setWorkerForm({ ...workerForm, profissao: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" placeholder="Cargo" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Telemóvel (Senha)</label><input type="text" value={workerForm.tel} onChange={e => setWorkerForm({ ...workerForm, tel: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" placeholder="9xxxxxxxx" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">NIS</label><input type="text" value={workerForm.nis || ''} onChange={e => setWorkerForm({ ...workerForm, nis: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" placeholder="Segurança Social" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">NIF</label><input type="text" value={workerForm.nif || ''} onChange={e => setWorkerForm({ ...workerForm, nif: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" placeholder="Número de Identificação Fiscal" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor Hora (€)</label><input type="number" value={workerForm.valorHora} onChange={e => setWorkerForm({ ...workerForm, valorHora: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">IBAN</label><input type="text" value={workerForm.iban} onChange={e => setWorkerForm({ ...workerForm, iban: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-mono uppercase shadow-sm" placeholder="PT50..." /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Estado da Conta</label><select value={workerForm.status || 'ativo'} onChange={e => setWorkerForm({ ...workerForm, status: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm font-bold"><option value="ativo">Ativo (Acesso Permitido)</option><option value="inativo">Inativo (Acesso Bloqueado)</option></select></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data de Início</label><input type="date" value={workerForm.dataInicio || ''} onChange={e => setWorkerForm({ ...workerForm, dataInicio: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data de Fim</label><input type="date" value={workerForm.dataFim || ''} onChange={e => setWorkerForm({ ...workerForm, dataFim: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm" /></div>
          </div>
          <div className="mt-8 border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block">Acesso a Clientes</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100">
                {clients.map(c => (
                  <label key={c.id} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer hover:bg-indigo-50 transition-colors shadow-sm">
                    <input type="checkbox" checked={workerForm.assignedClients?.includes(c.id)} onChange={() => {
                      const current = workerForm.assignedClients || [];
                      const updated = current.includes(c.id) ? current.filter(id => id !== c.id) : [...current, c.id];
                      setWorkerForm({ ...workerForm, assignedClients: updated });
                    }} className="rounded text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700 truncate">{c.name}</span>
                  </label>
                ))}
              </div>
              <select value={workerForm.defaultClientId || ''} onChange={e => setWorkerForm({ ...workerForm, defaultClientId: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm">
                <option value="">Definir Unidade Padrão...</option>
                {clients.filter(c => workerForm.assignedClients?.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block">Horários Disponíveis</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100">
                {schedules.map(s => (
                  <label key={s.id} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer hover:bg-indigo-50 transition-colors shadow-sm">
                    <input type="checkbox" checked={workerForm.assignedSchedules?.includes(s.id)} onChange={() => {
                      const current = workerForm.assignedSchedules || [];
                      const updated = current.includes(s.id) ? current.filter(id => id !== s.id) : [...current, s.id];
                      setWorkerForm({ ...workerForm, assignedSchedules: updated });
                    }} className="rounded text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700 truncate">{s.name}</span>
                  </label>
                ))}
              </div>
              <select value={workerForm.defaultScheduleId || ''} onChange={e => setWorkerForm({ ...workerForm, defaultScheduleId: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm">
                <option value="">Definir Horário Padrão...</option>
                {schedules.filter(s => workerForm.assignedSchedules?.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-8 flex justify-end gap-3">
            <button onClick={() => setIsAddingInTab(false)} className="px-6 py-3 text-slate-400 font-bold uppercase text-xs">Cancelar</button>
            <button onClick={handleSaveWorker} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase shadow-lg">Gravar</button>
          </div>
        </div>
      )}

      {workersView === 'list' ? (
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th onClick={() => setWorkersSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Colaborador {workersSort.key === 'name' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => setWorkersSort(prev => ({ key: 'schedule', direction: prev.key === 'schedule' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Horário {workersSort.key === 'schedule' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => setWorkersSort(prev => ({ key: 'unit', direction: prev.key === 'unit' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Unidade {workersSort.key === 'unit' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Valor/H</th>
                <th onClick={() => setWorkersSort(prev => ({ key: 'status', direction: prev.key === 'status' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Acesso {workersSort.key === 'status' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedWorkers.map(w => (
                <tr key={w.id} className="border-b border-slate-100 hover:bg-indigo-50/40 transition-all even:bg-slate-50/50 last:border-b-0 group">
                  <td className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <p className="font-black text-slate-900 text-sm uppercase truncate">{w.name}</p>
                    <p className="text-xs text-slate-400 truncate">{w.profissao || 'Staff'}</p>
                  </td>
                  <td className="text-sm font-bold text-indigo-600 truncate">{schedules.find(s => s.id === w.defaultScheduleId)?.name || 'N/A'}</td>
                  <td className="text-sm font-bold text-indigo-600 truncate">{clients.find(c => c.id === w.defaultClientId)?.name || 'N/A'}</td>
                  <td className="text-sm font-bold text-indigo-600">
                    <div className="flex items-center gap-1">
                      <span>{w.valorHora ? `${w.valorHora}€` : 'N/A'}</span>
                      <button 
                        onClick={() => loadWorkerValorHoraHistory(w.id, w.name)}
                        className="ml-1 text-xs text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                        title="Ver histórico"
                      >
                        📊
                      </button>
                    </div>
                  </td>
                  <td className="">
                    <div className="flex items-center">
                      <select
                        value={w.status || 'ativo'}
                        onChange={e => {
                          const updated = { ...w, status: e.target.value };
                          saveToDb('workers', w.id, updated);
                        }}
                        className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full border outline-none transition-all cursor-pointer ${w.status === 'inativo' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}
                      >
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                      </select>
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => onLogin('worker', { ...w, isAdminImpersonating: true })} className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Ver Portal do Trabalhador"><Search size={16} /></button>
                      <button onClick={() => { setWorkerForm(w); setIsAddingInTab(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Editar"><Edit2 size={16} /></button>
                      <button onClick={() => handleDeleteWorker(w.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Apagar"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedWorkers.map(w => (
            <div key={w.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-indigo-200 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><UserCircle size={24} /></div>
                <div className="flex gap-2">
                  <button onClick={() => onLogin('worker', { ...w, isAdminImpersonating: true })} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Ver Portal do Trabalhador"><Search size={14} /></button>
                  <button onClick={() => { setWorkerForm(w); setIsAddingInTab(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 text-slate-400 hover:text-amber-500 transition-all" title="Editar"><Edit2 size={14} /></button>
                  <button onClick={() => handleDeleteWorker(w.id)} className="p-2 text-slate-400 hover:text-red-500 transition-all" title="Apagar"><Trash2 size={14} /></button>
                </div>
              </div>
              <h4 className="text-xl font-black text-indigo-700 mb-1">{w.name}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b pb-4 mb-4">{w.profissao || 'Staff'}</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Timer size={12} /> Horário: <span className="text-indigo-600">{schedules.find(s => s.id === w.defaultScheduleId)?.name || 'N/A'}</span></div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Briefcase size={12} /> Unidade: <span className="text-indigo-600">{clients.find(c => c.id === w.defaultClientId)?.name || 'N/A'}</span></div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mt-2 border-t border-slate-100 pt-2">
                  <CheckCircle size={12} /> Mês ({currentMonthStr}):
                  {(() => {
                    const workerApproval = approvals.find(a => a.workerId === w.id && a.month === currentMonthStr);
                    return workerApproval ? (
                      <span className="flex items-center gap-2 text-emerald-500 font-black bg-emerald-50 px-2 py-0.5 rounded">
                        Aprovado ({new Date(workerApproval.timestamp).toLocaleDateString('pt-PT')})
                        <button onClick={() => handleDelete('approvals', workerApproval.id)} className="text-rose-400 hover:text-rose-600 bg-white rounded-full p-1 shadow-sm ml-1" title="Desbloquear Mês"><Unlock size={10} /></button>
                      </span>
                    ) : (
                      <span className="text-amber-500 font-black bg-amber-50 px-2 py-0.5 rounded">Pendente</span>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* D-06: Modal de Histórico de Valor Hora */}
      {showWorkerHistory.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowWorkerHistory({ show: false, workerId: null, workerName: '' })}>
          <div className="bg-white p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-indigo-700">Histórico de Valor Hora</h3>
              <button onClick={() => setShowWorkerHistory({ show: false, workerId: null, workerName: '' })} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <p className="text-sm font-bold text-slate-500 mb-4">{showWorkerHistory.workerName}</p>
            {workerValorHoraHistory.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Sem histórico disponível</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {workerValorHoraHistory.map(h => (
                  <div key={h.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-600">{h.valor_anterior || 'N/A'}€</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-sm font-bold text-indigo-600">{h.valor_novo}€</span>
                    </div>
                    <span className="text-xs text-slate-400">{new Date(h.data_alteracao).toLocaleDateString('pt-PT')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TeamManager = ({ onLogin }) => {
  return (
    <TeamProvider>
      <TeamManagerContent onLogin={onLogin} />
    </TeamProvider>
  );
};

export default TeamManager;
