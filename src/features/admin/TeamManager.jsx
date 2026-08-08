import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTeam, TeamProvider } from './contexts/TeamContext';
import { Users, LayoutGrid, List, CalendarX, ShieldCheck, AlertTriangle, Search, ScanSearch, UserPlus, Copy, Mail, Check, Clock } from 'lucide-react';
import WorkerForm from './team/WorkerForm';
import WorkerList from './team/WorkerList';
import ModalShell from '../../components/common/ModalShell';
import ChangeRequestsPanel from './team/ChangeRequestsPanel';
import AbsenceRequestsPanel from './team/AbsenceRequestsPanel';
import WorkerValorHoraHistoryModal from './team/WorkerValorHoraHistoryModal';
import WorkerEmploymentHistoryModal from './team/WorkerEmploymentHistoryModal';
import WorkerValidationPanel from './team/WorkerValidationPanel';
import CorrectionsInbox from './corrections/CorrectionsInbox';
import DocumentScannerModal from './team/DocumentScannerModal';
import WorkerFolderModal from './documents/WorkerFolderModal';
import OnboardingPendentes from './team/OnboardingPendentes';
import { sendOnboardingInviteEmail } from '../../utils/emailUtils';

const TeamManagerContent = ({ onLogin }) => {
  const { workers, schedules, clients, supabase, workerChangeRequests, absenceRequests, systemSettings } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [teamSubTab, setTeamSubTab] = useState(() => searchParams.get('subtab') || 'workers');
  const [pendingOnboardingCount, setPendingOnboardingCount] = useState(0);
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('worker_onboarding_submissions')
      .select('id', { count: 'exact' })
      .eq('status', 'pending')
      .then(({ count }) => setPendingOnboardingCount(count || 0));
  }, [supabase, teamSubTab]);

  useEffect(() => {
    const tab = searchParams.get('subtab');
    if (tab) setTeamSubTab(tab);
  }, [searchParams]);
  const {
    isAddingInTab, setIsAddingInTab,
    workersView, setWorkersView,
    workersSearch, setWorkersSearch,
    workersSort, setWorkersSort,
    workerForm, setWorkerForm,
    handleDeleteWorker,
  } = useTeam();

  const [showInactive, setShowInactive] = useState(false);
  const [vhModal, setVhModal] = useState({ show: false, workerId: null, workerName: '' });
  const [empModal, setEmpModal] = useState({ show: false, workerId: null, workerName: '' });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pastaModal, setPastaModal] = useState({ show: false, workerId: null, workerName: '' });

  const gerarConvite = async () => {
    if (!supabase || inviteLoading) return;
    setInviteLoading(true);
    try {
      const token = crypto.randomUUID();
      const id = 'onb_inv_' + Date.now();
      await supabase.from('worker_onboarding_invites').insert({
        id, token,
        email: inviteEmail || null,
        created_by: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      });
      const link = `${window.location.origin}/onboarding/${token}`;
      setGeneratedLink(link);
      setLinkCopied(false);
      setInviteEmailSent(false);
    } catch (e) {
      console.error('[onboarding] Erro ao gerar convite:', e);
    } finally {
      setInviteLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const sendInviteEmail = async () => {
    if (!inviteEmail || !generatedLink) return;
    const ok = await sendOnboardingInviteEmail({ toEmail: inviteEmail, link: generatedLink });
    if (ok) setInviteEmailSent(true);
  };

  const pendingChangeRequests = (workerChangeRequests || []).filter(r => r.status === 'pending');
  const pendingAbsences = (absenceRequests || []).filter(r => r.status === 'pending').length;
  const inactiveCount = workers.filter(w => w.status === 'inativo').length;

  const { corrections } = useApp();
  const pendingWorkerCorrections = (corrections || []).filter(c =>
    (c.type === 'creation_request' || c.type === 'deletion_request') &&
    (c.status === 'submitted' || c.status === 'under_review')
  ).length;

  const displayWorkers = workers
    .filter(w => showInactive || w.status !== 'inativo')
    .filter(w => !workersSearch || w.name.toLowerCase().includes(workersSearch.toLowerCase()) || (w.profissao || '').toLowerCase().includes(workersSearch.toLowerCase()));

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
        <button
          onClick={() => setTeamSubTab('onboarding')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${teamSubTab === 'onboarding' ? 'bg-teal-600 text-white' : 'bg-slate-50 text-slate-500 hover:text-teal-600'}`}
        >
          <Clock size={14} /> Pendentes
          {pendingOnboardingCount > 0 && (
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${teamSubTab === 'onboarding' ? 'bg-white text-teal-600' : 'bg-teal-500 text-white'}`}>{pendingOnboardingCount}</span>
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

      {teamSubTab === 'onboarding' && (
        <OnboardingPendentes />
      )}

      {teamSubTab === 'workers' && (<>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Users size={20} /></div>
          <h3 className="font-black text-base sm:text-xl text-slate-800 uppercase tracking-tight">Gestão de Colaboradores</h3>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar colaborador..."
            value={workersSearch}
            onChange={e => setWorkersSearch(e.target.value)}
            className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48 sm:w-64"
          />
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
            onClick={() => { setInviteEmail(''); setGeneratedLink(''); setInviteModal(true); }}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl font-black text-xs uppercase shadow-lg transition-all whitespace-nowrap bg-teal-600 hover:bg-teal-700 text-white"
            title="Convidar novo colaborador via link de onboarding"
          >
            <UserPlus size={14} /> Convidar
          </button>
          <button
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl font-black text-xs uppercase shadow-lg transition-all whitespace-nowrap bg-violet-600 hover:bg-violet-700 text-white"
            title="Scanner de Documentos com IA"
          >
            <ScanSearch size={14} /> Scanner
          </button>
          <button
            onClick={() => {
              setWorkerForm({ id: null, name: '', assignedClients: [], assignedSchedules: [], defaultClientId: '', defaultScheduleId: '', tel: '', valorHora: '', profissao: '', nis: '', nif: '', iban: '', status: 'ativo', dataInicio: '', dataFim: '', dataAlteracao: new Date().toISOString().split('T')[0], limited_entry_mode: false, vencimento_base: '', subsidio_alimentacao_dia: '' });
              setIsAddingInTab(true);
            }}
            className="px-3 sm:px-5 py-2 rounded-xl font-black text-xs uppercase shadow-lg transition-all whitespace-nowrap bg-indigo-600 text-white"
          >
            Novo
          </button>
        </div>
      </div>

      <ModalShell
        isOpen={isAddingInTab}
        onClose={() => setIsAddingInTab(false)}
        title={workerForm.id ? 'Editar Colaborador' : 'Novo Colaborador'}
        icon={<Users size={16} />}
        accent="indigo"
        size="3xl"
      >
        <WorkerForm />
      </ModalShell>

      <DocumentScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} />

      {/* Modal de convite de onboarding */}
      <ModalShell
        isOpen={inviteModal}
        onClose={() => { setInviteModal(false); setGeneratedLink(''); setInviteEmail(''); }}
        title="Convidar novo colaborador"
        subtitle="Gera um link único que o colaborador usa para preencher os seus dados."
        icon={<UserPlus size={16} />}
        accent="indigo"
        size="md"
      >
        <div className="space-y-4">
          {!generatedLink ? (<>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                Email do colaborador (opcional)
              </label>
              <input
                className="w-full bg-white border border-slate-200 rounded-lg py-[3px] px-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                type="email"
                placeholder="colaborador@email.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
              <p className="text-[10px] text-slate-400 mt-1">Se preenchido, pode enviar o link por email diretamente.</p>
            </div>
            <button
              onClick={gerarConvite}
              disabled={inviteLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black uppercase bg-teal-600 text-white hover:bg-teal-700 transition-all disabled:opacity-50"
            >
              {inviteLoading ? <span className="animate-spin text-lg">⟳</span> : <UserPlus size={16} />}
              Gerar link de convite
            </button>
          </>) : (<>
            <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
              <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest mb-2">Link gerado</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-teal-800 break-all flex-1 bg-white rounded-lg px-3 py-2 border border-teal-200 font-mono select-all">
                  {generatedLink}
                </p>
                <button
                  onClick={copyLink}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${linkCopied ? 'bg-emerald-600 text-white' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
                >
                  {linkCopied ? <Check size={12} /> : <Copy size={12} />}
                  {linkCopied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="text-[10px] text-teal-600 mt-2 font-bold">
                Este link expira em 7 dias e só pode ser usado uma vez.
              </p>
            </div>
            {inviteEmail && (
              <div className="flex items-center gap-3">
                <button
                  onClick={sendInviteEmail}
                  disabled={inviteEmailSent}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${inviteEmailSent ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                  {inviteEmailSent ? <Check size={14} /> : <Mail size={14} />}
                  {inviteEmailSent ? 'Email enviado' : `Enviar por email para ${inviteEmail}`}
                </button>
              </div>
            )}
            <button
              onClick={() => { setGeneratedLink(''); setInviteEmail(''); }}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              Gerar novo link
            </button>
          </>)}
        </div>
      </ModalShell>

      {pastaModal.show && (
        <WorkerFolderModal
          workerId={pastaModal.workerId}
          workerName={pastaModal.workerName}
          onClose={() => setPastaModal({ show: false, workerId: null, workerName: '' })}
        />
      )}

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
        onVerPasta={(id) => {
          const w = workers.find(x => x.id === id);
          setPastaModal({ show: true, workerId: id, workerName: w?.name || '' });
        }}
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
