import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTeam, TeamProvider } from './contexts/TeamContext';
import { useClient, ClientProvider } from './contexts/ClientContext';
import { useSchedule, ScheduleProvider } from './contexts/ScheduleContext';
import { 
  Users, LayoutGrid, List, UserCircle, Search, Edit2, 
  Trash2, Timer, Briefcase, CheckCircle, Unlock,
  User, Phone, CreditCard, Landmark, Wallet, CalendarRange, Save, X, Building2, Euro
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

  // 11-05: Estado para histórico de emprego
  const [showEmploymentHistory, setShowEmploymentHistory] = useState({ show: false, workerId: null, workerName: '', periods: [] });

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

  // 11-05: Função para carregar histórico de emprego
  const loadEmploymentHistory = async (workerId, workerName) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('worker_employment_history')
      .select('*')
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false });
    setShowEmploymentHistory({ show: true, workerId, workerName, periods: data || [] });
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
          <button onClick={() => { setWorkerForm({ id: null, name: '', assignedClients: [], assignedSchedules: [], defaultClientId: '', defaultScheduleId: '', tel: '', valorHora: '', profissao: '', nis: '', nif: '', iban: '', status: 'ativo', dataInicio: '', dataFim: '', dataAlteracao: new Date().toISOString().split('T')[0] }); setIsAddingInTab(!isAddingInTab); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-lg transition-all ${isAddingInTab ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}>{isAddingInTab ? 'Fechar Form' : 'Novo Trabalhador'}</button>
        </div>
      </div>

      {isAddingInTab && (
        <div className="mb-10 bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
          <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <UserCircle className="text-indigo-600" size={28} />
              {workerForm.id ? 'Editar Colaborador' : 'Novo Colaborador'}
            </h3>
            <button onClick={() => setIsAddingInTab(false)} className="text-slate-400 hover:text-slate-800 transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-wider bg-slate-50 hover:bg-slate-100 px-4 py-2 rounded-xl">
              <X size={16} /> Fechar Form
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* COLUNA ESQUERDA (8 colunas) */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* DADOS DO COLABORADOR */}
              <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><User size={18} /></div>
                  <h4 className="font-black text-slate-700 text-lg uppercase tracking-tight">Dados do Colaborador</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><User size={10} /> Nome Completo</label>
                    <input type="text" value={workerForm.name} onChange={e => setWorkerForm({ ...workerForm, name: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" placeholder="Ex: João Silva" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><Briefcase size={10} /> Profissão</label>
                    <input type="text" value={workerForm.profissao || ''} onChange={e => setWorkerForm({ ...workerForm, profissao: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" placeholder="Ex: Operador de Caixa" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><Phone size={10} /> Telemóvel (Senha)</label>
                    <input type="text" value={workerForm.tel} onChange={e => setWorkerForm({ ...workerForm, tel: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" placeholder="Ex: 912345678" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><UserCircle size={10} /> Estado da Conta</label>
                    <select value={workerForm.status || 'ativo'} onChange={e => setWorkerForm({ ...workerForm, status: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm font-bold focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all">
                      <option value="ativo">Ativo (Acesso Permitido)</option>
                      <option value="inativo">Inativo (Acesso Bloqueado)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><CalendarRange size={10} /> Data de Início</label>
                    <input type="date" value={workerForm.dataInicio || ''} onChange={e => setWorkerForm({ ...workerForm, dataInicio: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><CalendarRange size={10} /> Data de Fim</label>
                    <input type="date" value={workerForm.dataFim || ''} onChange={e => setWorkerForm({ ...workerForm, dataFim: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all" />
                  </div>
                </div>
              </div>

              {/* DADOS FINANCEIROS */}
              <div className="bg-emerald-50/30 p-6 rounded-[2rem] border border-emerald-100 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Wallet size={18} /></div>
                  <h4 className="font-black text-emerald-800 text-lg uppercase tracking-tight">Dados Financeiros</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-600/70 uppercase tracking-wider ml-1 flex items-center gap-1"><CreditCard size={10} /> NIS</label>
                    <input type="text" value={workerForm.nis || ''} onChange={e => setWorkerForm({ ...workerForm, nis: e.target.value })} className="w-full bg-white border border-emerald-100 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all" placeholder="Nº Seg. Social" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-600/70 uppercase tracking-wider ml-1 flex items-center gap-1"><CreditCard size={10} /> NIF</label>
                    <input type="text" value={workerForm.nif || ''} onChange={e => setWorkerForm({ ...workerForm, nif: e.target.value })} className="w-full bg-white border border-emerald-100 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all" placeholder="Nº Identificação Fiscal" />
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-[10px] font-black text-emerald-600/70 uppercase tracking-wider ml-1 flex items-center gap-1"><Landmark size={10} /> IBAN</label>
                    <input type="text" value={workerForm.iban} onChange={e => setWorkerForm({ ...workerForm, iban: e.target.value })} className="w-full bg-white border border-emerald-100 rounded-xl p-4 text-sm font-mono uppercase font-bold shadow-sm focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all" placeholder="PT50..." />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-emerald-100/50">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-600/70 uppercase tracking-wider ml-1 flex items-center gap-1"><Euro size={10} /> Valor Hora (€)</label>
                    <input type="number" step="0.01" value={workerForm.valorHora} onChange={e => setWorkerForm({ ...workerForm, valorHora: e.target.value })} className="w-full bg-white border border-emerald-100 rounded-xl p-4 text-lg text-emerald-700 font-black outline-none shadow-sm focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all" placeholder="0.00" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-600/70 uppercase tracking-wider ml-1 flex items-center gap-1"><CalendarRange size={10} /> Valor válido desde</label>
                    <input type="date" value={workerForm.dataAlteracao || ''} onChange={e => setWorkerForm({ ...workerForm, dataAlteracao: e.target.value })} className="w-full bg-white border border-emerald-100 rounded-xl p-4 text-sm font-bold outline-none shadow-sm focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all" />
                  </div>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA (4 colunas) */}
            <div className="lg:col-span-4 space-y-6 flex flex-col">
              
              {/* ACESSO A CLIENTES */}
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 size={16} className="text-indigo-600" />
                  <h4 className="font-black text-slate-700 text-sm uppercase tracking-widest">Acesso a Clientes</h4>
                </div>
                
                <div className="flex-1 min-h-[160px] max-h-[220px] overflow-y-auto pr-2 custom-scrollbar space-y-2 mb-4">
                  {clients.map(c => {
                    const isAssigned = workerForm.assignedClients?.includes(c.id);
                    return (
                      <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer shadow-sm ${isAssigned ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-100'}`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${isAssigned ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                          {isAssigned && <CheckCircle size={12} className="text-white" />}
                        </div>
                        <input type="checkbox" className="hidden" checked={isAssigned} onChange={() => {
                          const current = workerForm.assignedClients || [];
                          const updated = current.includes(c.id) ? current.filter(id => id !== c.id) : [...current, c.id];
                          setWorkerForm({ ...workerForm, assignedClients: updated });
                        }} />
                        <span className={`text-[11px] font-black uppercase truncate ${isAssigned ? 'text-indigo-900' : 'text-slate-600'}`}>{c.name}</span>
                      </label>
                    );
                  })}
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Unidade Padrão</label>
                  <select value={workerForm.defaultClientId || ''} onChange={e => setWorkerForm({ ...workerForm, defaultClientId: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all">
                    <option value="">Nenhuma seleção</option>
                    {clients.filter(c => workerForm.assignedClients?.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* HORÁRIOS DISPONÍVEIS */}
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <Timer size={16} className="text-indigo-600" />
                  <h4 className="font-black text-slate-700 text-sm uppercase tracking-widest">Horários</h4>
                </div>
                
                <div className="flex-1 min-h-[160px] max-h-[220px] overflow-y-auto pr-2 custom-scrollbar space-y-2 mb-4">
                  {schedules.map(s => {
                    const isAssigned = workerForm.assignedSchedules?.includes(s.id);
                    return (
                      <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer shadow-sm ${isAssigned ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-100'}`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${isAssigned ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                          {isAssigned && <CheckCircle size={12} className="text-white" />}
                        </div>
                        <input type="checkbox" className="hidden" checked={isAssigned} onChange={() => {
                          const current = workerForm.assignedSchedules || [];
                          const updated = current.includes(s.id) ? current.filter(id => id !== s.id) : [...current, s.id];
                          setWorkerForm({ ...workerForm, assignedSchedules: updated });
                        }} />
                        <span className={`text-[11px] font-black uppercase truncate ${isAssigned ? 'text-indigo-900' : 'text-slate-600'}`}>{s.name}</span>
                      </label>
                    );
                  })}
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Horário Padrão</label>
                  <select value={workerForm.defaultScheduleId || ''} onChange={e => setWorkerForm({ ...workerForm, defaultScheduleId: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all">
                    <option value="">Nenhuma seleção</option>
                    {schedules.filter(s => workerForm.assignedSchedules?.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* AÇÕES */}
              <div className="pt-2">
                <button onClick={handleSaveWorker} className="w-full bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-1 text-white p-5 rounded-[1.5rem] font-black text-sm uppercase shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 border border-indigo-500">
                  <Save size={20} />
                  Gravar Colaborador
                </button>
              </div>
            </div>
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
                        onClick={() => loadEmploymentHistory(w.id, w.name)}
                        className="ml-1 text-xs text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                        title="Períodos de emprego"
                      >
                        📅
                      </button>
                      <button 
                        onClick={() => loadWorkerValorHoraHistory(w.id, w.name)}
                        className="text-xs text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                        title="Ver histórico de valor"
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
                      <button onClick={() => { setWorkerForm({ ...w, dataAlteracao: new Date().toISOString().split('T')[0] }); setIsAddingInTab(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Editar"><Edit2 size={16} /></button>
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
                  <button onClick={() => { setWorkerForm({ ...w, dataAlteracao: new Date().toISOString().split('T')[0] }); setIsAddingInTab(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 text-slate-400 hover:text-amber-500 transition-all" title="Editar"><Edit2 size={14} /></button>
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

      {/* 11-05: Modal de Histórico de Emprego */}
      {showEmploymentHistory.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEmploymentHistory({ show: false, workerId: null, workerName: '', periods: [] })}>
          <div className="bg-white p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-indigo-700">Períodos de Emprego</h3>
              <button onClick={() => setShowEmploymentHistory({ show: false, workerId: null, workerName: '', periods: [] })} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <p className="text-sm font-bold text-slate-500 mb-4">{showEmploymentHistory.workerName}</p>
            {showEmploymentHistory.periods.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Sem períodos registados</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {showEmploymentHistory.periods.map((p, i) => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-600">{p.data_inicio}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-sm font-bold text-indigo-600">{p.data_fim || 'Atual'}</span>
                    </div>
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

