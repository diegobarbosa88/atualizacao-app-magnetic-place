import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTeam, TeamProvider } from './contexts/TeamContext';
import { Users, LayoutGrid, List, CalendarX, ShieldCheck, AlertTriangle } from 'lucide-react';
import WorkerForm from './team/WorkerForm';
import WorkerList from './team/WorkerList';
import ChangeRequestsPanel from './team/ChangeRequestsPanel';
import AbsenceRequestsPanel from './team/AbsenceRequestsPanel';
import WorkerValorHoraHistoryModal from './team/WorkerValorHoraHistoryModal';
import WorkerEmploymentHistoryModal from './team/WorkerEmploymentHistoryModal';
import WorkerValidationPanel from './team/WorkerValidationPanel';
import CorrectionsInbox from './corrections/CorrectionsInbox';

const TeamManagerContent = ({ onLogin }) => {
  const { workers, schedules, clients, supabase, workerChangeRequests, absenceRequests, systemSettings } = useApp();
  const [teamSubTab, setTeamSubTab] = useState('workers');
  const {
    isAddingInTab, setIsAddingInTab,
    workersView, setWorkersView,
    workersSort, setWorkersSort,
    workerForm, setWorkerForm,
    handleDeleteWorker,
  } = useTeam();

  const [showInactive, setShowInactive] = useState(false);
  const [vhModal, setVhModal] = useState({ show: false, workerId: null, workerName: '' });
  const [empModal, setEmpModal] = useState({ show: false, workerId: null, workerName: '' });

  const pendingChangeRequests = (workerChangeRequests || []).filter(r => r.status === 'pending');
  const pendingAbsences = (absenceRequests || []).filter(r => r.status === 'pending').length;
  const inactiveCount = workers.filter(w => w.status === 'inativo').length;

  const { corrections } = useApp();
  const pendingWorkerCorrections = (corrections || []).filter(c =>
    (c.type === 'creation_request' || c.type === 'deletion_request') &&
    (c.status === 'submitted' || c.status === 'under_review')
  ).length;

  const displayWorkers = workers.filter(w => showInactive || w.status !== 'inativo');

  const sortedWorkers = [...displayWorkers].sort((a, b) => {
    let res = 0;
    if (workersSort.key === 'name') res = a.name.localeCompare(b.name);
    if (workersSort.key === 'profissao') res = (a.profissao || '').localeCompare(b.profissao || '');
    if (workersSort.key === 'schedule') {
      res = (schedules.find(s => s.id === a.defaultScheduleId)?.name || '').localeCompare(schedules.find(s => s.id === b.defaultScheduleId)?.name || '');
    }
    if (workersSort.key === 'unit') {
      res = (clients.find(c => c.id === a.defaultClientId)?.name || '').localeCompare(clients.find(c => c.id === b.defaultClientId)?.name || '');
    }
    if (workersSort.key === 'status') res = (a.status || 'ativo').localeCompare(b.status || 'ativo');
    return workersSort.direction === 'asc' ? res : -res;
  });

  const openEditWorker = async (w) => {
    let dataAlteracao = new Date().toISOString().split('T')[0];
    if (supabase) {
      const { data } = await supabase.from('worker_valorhora_history').select('data_alteracao').eq('worker_id', w.id).order('data_alteracao', { ascending: false }).limit(1).maybeSingle();
      if (data?.data_alteracao) dataAlteracao = data.data_alteracao.split('T')[0];
    }
    setWorkerForm({ ...w, dataAlteracao });
    setIsAddingInTab(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleWorkerListAction = (w) => {
    if (w.__deleteId) {
      handleDeleteWorker(w.__deleteId);
    } else {
      openEditWorker(w);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sub-tab navigation */}
      <div className="flex flex-wrap items-center gap-2 mb-5 border-b border-slate-100 pb-3">
        <button
          onClick={() => setTeamSubTab('workers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${teamSubTab === 'workers' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500 hover:text-indigo-600'}`}
        >
          <Users size={14} /> Colaboradores
          {pendingChangeRequests.length > 0 && (
            <span className="bg-amber-400 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{pendingChangeRequests.length}</span>
          )}
        </button>
        <button
          onClick={() => setTeamSubTab('absences')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${teamSubTab === 'absences' ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-500 hover:text-orange-600'}`}
        >
          <CalendarX size={14} /> Faltas
          {pendingAbsences > 0 && (
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${teamSubTab === 'absences' ? 'bg-white text-orange-500' : 'bg-orange-500 text-white'}`}>{pendingAbsences}</span>
          )}
        </button>
        <button
          onClick={() => setTeamSubTab('validacao')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${teamSubTab === 'validacao' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-500 hover:text-emerald-600'}`}
        >
          <ShieldCheck size={14} /> Validação
        </button>
        <button
          onClick={() => setTeamSubTab('correcoes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${teamSubTab === 'correcoes' ? 'bg-amber-500 text-white' : 'bg-slate-50 text-slate-500 hover:text-amber-600'}`}
        >
          <AlertTriangle size={14} /> Correções
          {pendingWorkerCorrections > 0 && (
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${teamSubTab === 'correcoes' ? 'bg-white text-amber-500' : 'bg-red-500 text-white'}`}>{pendingWorkerCorrections}</span>
          )}
        </button>
      </div>

      {teamSubTab === 'absences' && (
        <AbsenceRequestsPanel
          requests={absenceRequests || []}
          systemSettings={systemSettings}
          clients={clients}
        />
      )}

      {teamSubTab === 'validacao' && (
        <WorkerValidationPanel onLogin={onLogin} />
      )}

      {teamSubTab === 'correcoes' && (
        <CorrectionsInbox forcedSource="workers" />
      )}

      {teamSubTab === 'workers' && (<>
      <div className="flex justify-between items-center gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Users size={20} /></div>
          <h3 className="font-black text-base sm:text-xl text-slate-800 uppercase tracking-tight">Gestão de Colaboradores</h3>
        </div>
        <div className="flex items-center gap-2">
          {inactiveCount > 0 && (
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded border-slate-300" />
              Mostrar inativos ({inactiveCount})
            </label>
          )}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button onClick={() => setWorkersView('grid')} className={`p-2 rounded-lg transition-all ${workersView === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Grade"><LayoutGrid size={18} /></button>
            <button onClick={() => setWorkersView('list')} className={`p-2 rounded-lg transition-all ${workersView === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Lista"><List size={18} /></button>
          </div>
          <button
            onClick={() => {
              setWorkerForm({ id: null, name: '', assignedClients: [], assignedSchedules: [], defaultClientId: '', defaultScheduleId: '', tel: '', valorHora: '', profissao: '', nis: '', nif: '', iban: '', status: 'ativo', dataInicio: '', dataFim: '', dataAlteracao: new Date().toISOString().split('T')[0], limited_entry_mode: false });
              setIsAddingInTab(!isAddingInTab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`px-3 sm:px-5 py-2 rounded-xl font-black text-xs uppercase shadow-lg transition-all whitespace-nowrap ${isAddingInTab ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}
          >
            {isAddingInTab ? 'Fechar' : 'Novo'}
          </button>
        </div>
      </div>

      {isAddingInTab && <WorkerForm />}

      <ChangeRequestsPanel requests={pendingChangeRequests} />

      <WorkerList
        sortedWorkers={sortedWorkers}
        workersView={workersView}
        setWorkersView={setWorkersView}
        workersSort={workersSort}
        setWorkersSort={setWorkersSort}
        onLogin={onLogin}
        onEdit={handleWorkerListAction}
        onOpenVHHistory={(id, name) => setVhModal({ show: true, workerId: id, workerName: name })}
        onOpenEmpHistory={(id, name) => setEmpModal({ show: true, workerId: id, workerName: name })}
      />

      <WorkerValorHoraHistoryModal
        show={vhModal.show}
        workerId={vhModal.workerId}
        workerName={vhModal.workerName}
        supabase={supabase}
        onClose={() => setVhModal({ show: false, workerId: null, workerName: '' })}
      />

      <WorkerEmploymentHistoryModal
        show={empModal.show}
        workerId={empModal.workerId}
        workerName={empModal.workerName}
        supabase={supabase}
        onClose={() => setEmpModal({ show: false, workerId: null, workerName: '' })}
      />
      </>)}
    </div>
  );
};

const TeamManager = ({ onLogin }) => (
  <TeamProvider>
    <TeamManagerContent onLogin={onLogin} />
  </TeamProvider>
);

export default TeamManager;
