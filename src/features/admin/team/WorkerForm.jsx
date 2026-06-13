import React from 'react';
import { useApp } from '../../../context/AppContext';
import { useTeam } from '../contexts/TeamContext';
import {
  UserCircle, User, Phone, CreditCard, Landmark, Wallet, CalendarRange, Save, X, Building2, Euro,
  MapPin, Fingerprint, Mail, Briefcase, Timer, CheckCircle, ShieldOff
} from 'lucide-react';

const WorkerForm = () => {
  const { clients, schedules } = useApp();
  const { workerForm, setWorkerForm, handleSaveWorker, setIsAddingInTab } = useTeam();

  return (
    <div className="mb-4 sm:mb-6 bg-white p-3 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl shadow-xl border border-slate-100">
      <div className="flex justify-between items-center mb-3 sm:mb-4 border-b border-slate-100 pb-3">
        <h3 className="text-base sm:text-xl font-black text-slate-800 flex items-center gap-2">
          <UserCircle className="text-indigo-600" size={18} />
          {workerForm.id ? 'Editar Colaborador' : 'Novo Colaborador'}
        </h3>
        <button onClick={() => setIsAddingInTab(false)} className="text-slate-400 hover:text-slate-800 transition-colors flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg">
          <X size={14} /> Fechar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* COLUNA ESQUERDA */}
        <div className="lg:col-span-8 space-y-4 sm:space-y-6">

          <div className="bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><User size={14} /></div>
              <h4 className="font-black text-slate-700 text-sm sm:text-base uppercase tracking-tight">Dados do Colaborador</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><User size={10} /> Nome</label>
                <input type="text" value={workerForm.name} onChange={e => setWorkerForm({ ...workerForm, name: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all" placeholder="Ex: João Silva" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><Briefcase size={10} /> Profissão</label>
                <input type="text" value={workerForm.profissao || ''} onChange={e => setWorkerForm({ ...workerForm, profissao: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all" placeholder="Ex: Operador de Caixa" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><Phone size={10} /> Telemóvel</label>
                <input type="text" value={workerForm.tel} onChange={e => setWorkerForm({ ...workerForm, tel: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all" placeholder="Ex: 912345678" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><Mail size={10} /> Email</label>
                <input type="email" value={workerForm.email || ''} onChange={e => setWorkerForm({ ...workerForm, email: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all" placeholder="exemplo@dominio.pt" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><UserCircle size={10} /> Estado</label>
                <select value={workerForm.status || 'ativo'} onChange={e => setWorkerForm({ ...workerForm, status: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-sm outline-none shadow-sm font-bold focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all">
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Admin</label>
                <button type="button" onClick={() => setWorkerForm({ ...workerForm, isAdmin: !workerForm.isAdmin })} className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-lg sm:rounded-xl border font-bold text-xs sm:text-sm transition-all ${workerForm.isAdmin ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                  <span>Admin</span>
                  <div className={`w-8 h-4 rounded-full transition-all relative ${workerForm.isAdmin ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${workerForm.isAdmin ? 'left-4' : 'left-0.5'}`} />
                  </div>
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-amber-600 uppercase tracking-wider ml-1 flex items-center gap-1"><ShieldOff size={10} /> Modo Limitado</label>
                <button type="button" onClick={() => setWorkerForm({ ...workerForm, limited_entry_mode: !workerForm.limited_entry_mode })} className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-lg sm:rounded-xl border font-bold text-xs sm:text-sm transition-all ${workerForm.limited_entry_mode ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                  <span>Pedido de Registo</span>
                  <div className={`w-8 h-4 rounded-full transition-all relative ${workerForm.limited_entry_mode ? 'bg-amber-500' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${workerForm.limited_entry_mode ? 'left-4' : 'left-0.5'}`} />
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 pt-2 border-t border-slate-100">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><MapPin size={10} /> Morada</label>
                <input type="text" value={workerForm.address || ''} onChange={e => setWorkerForm({ ...workerForm, address: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all" placeholder="Morada" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><Fingerprint size={10} /> DNI</label>
                <input type="text" value={workerForm.dni || ''} onChange={e => setWorkerForm({ ...workerForm, dni: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all" placeholder="DNI" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 pt-2 border-t border-slate-100">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><CalendarRange size={10} /> Data Início</label>
                <input type="date" value={workerForm.dataInicio || ''} onChange={e => setWorkerForm({ ...workerForm, dataInicio: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><CalendarRange size={10} /> Data Fim</label>
                <input type="date" value={workerForm.dataFim || ''} onChange={e => setWorkerForm({ ...workerForm, dataFim: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all" />
              </div>
            </div>
          </div>

          {/* DADOS FINANCEIROS */}
          <div className="bg-emerald-50/30 p-4 sm:p-5 rounded-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><Wallet size={14} /></div>
              <h4 className="font-black text-emerald-800 text-sm sm:text-base uppercase tracking-tight">Financeiro</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-emerald-600/70 uppercase tracking-wider ml-1 flex items-center gap-1"><CreditCard size={10} /> NIS</label>
                <input type="text" value={workerForm.nis || ''} onChange={e => setWorkerForm({ ...workerForm, nis: e.target.value })} className="w-full bg-white border border-emerald-100 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-sm font-bold outline-none shadow-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition-all" placeholder="NIS" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-emerald-600/70 uppercase tracking-wider ml-1 flex items-center gap-1"><CreditCard size={10} /> NIF</label>
                <input type="text" value={workerForm.nif || ''} onChange={e => setWorkerForm({ ...workerForm, nif: e.target.value })} className="w-full bg-white border border-emerald-100 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-sm font-bold outline-none shadow-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition-all" placeholder="NIF" />
              </div>
              <div className="space-y-1 md:col-span-1">
                <label className="text-[9px] font-black text-emerald-600/70 uppercase tracking-wider ml-1 flex items-center gap-1"><Landmark size={10} /> IBAN</label>
                <input type="text" value={workerForm.iban} onChange={e => setWorkerForm({ ...workerForm, iban: e.target.value })} className="w-full bg-white border border-emerald-100 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm font-mono uppercase font-bold shadow-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition-all" placeholder="PT50..." />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 pt-2 border-t border-emerald-100/50">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-emerald-600/70 uppercase tracking-wider ml-1 flex items-center gap-1"><Euro size={10} /> Valor Hora (€)</label>
                <input type="number" step="0.01" value={workerForm.valorHora} onChange={e => setWorkerForm({ ...workerForm, valorHora: e.target.value })} className="w-full bg-white border border-emerald-100 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-sm sm:text-base text-emerald-700 font-black outline-none shadow-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition-all" placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-emerald-600/70 uppercase tracking-wider ml-1 flex items-center gap-1"><CalendarRange size={10} /> Desde</label>
                <input type="date" value={workerForm.dataAlteracao || ''} onChange={e => setWorkerForm({ ...workerForm, dataAlteracao: e.target.value })} className="w-full bg-white border border-emerald-100 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-sm font-bold outline-none shadow-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition-all" />
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className="lg:col-span-4 space-y-3 sm:space-y-4 flex flex-col">

          <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-100 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <Building2 size={14} className="text-indigo-600" />
              <h4 className="font-black text-slate-700 text-xs sm:text-sm uppercase tracking-widest">Clientes</h4>
            </div>
            <div className="flex-1 min-h-[100px] max-h-[160px] overflow-y-auto pr-2 custom-scrollbar space-y-1.5 mb-2 sm:mb-3">
              {clients.map(c => {
                const isAssigned = workerForm.assignedClients?.includes(c.id);
                return (
                  <label key={c.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer shadow-sm ${isAssigned ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-100'}`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center border ${isAssigned ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                      {isAssigned && <CheckCircle size={10} className="text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={isAssigned} onChange={() => {
                      const current = workerForm.assignedClients || [];
                      const updated = current.includes(c.id) ? current.filter(id => id !== c.id) : [...current, c.id];
                      setWorkerForm({ ...workerForm, assignedClients: updated });
                    }} />
                    <span className={`text-[10px] font-black uppercase truncate ${isAssigned ? 'text-indigo-900' : 'text-slate-600'}`}>{c.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Padrão</label>
              <select value={workerForm.defaultClientId || ''} onChange={e => setWorkerForm({ ...workerForm, defaultClientId: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs sm:text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all">
                <option value="">Selecionar</option>
                {clients.filter(c => workerForm.assignedClients?.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-100 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <Timer size={14} className="text-indigo-600" />
              <h4 className="font-black text-slate-700 text-xs sm:text-sm uppercase tracking-widest">Horários</h4>
            </div>
            <div className="flex-1 min-h-[100px] max-h-[160px] overflow-y-auto pr-2 custom-scrollbar space-y-1.5 mb-2 sm:mb-3">
              {schedules.map(s => {
                const isAssigned = workerForm.assignedSchedules?.includes(s.id);
                return (
                  <label key={s.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer shadow-sm ${isAssigned ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-100'}`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center border ${isAssigned ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                      {isAssigned && <CheckCircle size={10} className="text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={isAssigned} onChange={() => {
                      const current = workerForm.assignedSchedules || [];
                      const updated = current.includes(s.id) ? current.filter(id => id !== s.id) : [...current, s.id];
                      setWorkerForm({ ...workerForm, assignedSchedules: updated });
                    }} />
                    <span className={`text-[10px] font-black uppercase truncate ${isAssigned ? 'text-indigo-900' : 'text-slate-600'}`}>{s.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Padrão</label>
              <select value={workerForm.defaultScheduleId || ''} onChange={e => setWorkerForm({ ...workerForm, defaultScheduleId: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs sm:text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all">
                <option value="">Selecionar</option>
                {schedules.filter(s => workerForm.assignedSchedules?.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button onClick={handleSaveWorker} className="w-full bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 text-white p-3 sm:p-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 border border-indigo-500">
              <Save size={16} />
              Gravar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerForm;
