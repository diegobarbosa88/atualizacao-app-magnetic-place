import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTeam, TeamProvider } from './contexts/TeamContext';
import { Users, LayoutGrid, List, CalendarX, ShieldCheck, AlertTriangle, Search, ScanSearch, UserPlus, Copy, Mail, Check, Clock, Loader2 } from 'lucide-react';
import WorkerForm from './team/WorkerForm';
import WorkerList from './team/WorkerList';
import ModalShell from '../../components/common/ModalShell';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';
import { FT, SCALE } from '../../styles/designTokens';
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
  const [generatedWaLink, setGeneratedWaLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [waLinkCopied, setWaLinkCopied] = useState(false);
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteVencimentoBase, setInviteVencimentoBase] = useState('');
  const [inviteDataInicio, setInviteDataInicio] = useState('');
  const [inviteLocalTrabalho, setInviteLocalTrabalho] = useState('');

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

  // Substitui o antigo showInactive (booleano) — os 3 chips clicáveis do
  // cabeçalho (Colaboradores/Ativos/Inativos) cobrem o mesmo território e
  // mais (Inativos sozinho não era possível antes), por isso a checkbox
  // "Mostrar inativos" foi removida em vez de mantida a par de um controlo
  // que já a torna redundante.
  const [workerFilter, setWorkerFilter] = useState('ativos');
  const [vhModal, setVhModal] = useState({ show: false, workerId: null, workerName: '' });
  const [empModal, setEmpModal] = useState({ show: false, workerId: null, workerName: '' });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pastaModal, setPastaModal] = useState({ show: false, workerId: null, workerName: '' });

  const gerarConvite = async () => {
    if (!supabase || inviteLoading) return;
    setInviteLoading(true);
    setInviteError('');
    try {
      const token = crypto.randomUUID();
      const id = 'onb_inv_' + Date.now();
      const { error } = await supabase.from('worker_onboarding_invites').insert({
        id, token,
        email: inviteEmail || null,
        created_by: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        vencimento_base: inviteVencimentoBase ? Number(inviteVencimentoBase) : null,
        data_inicio_prevista: inviteDataInicio || null,
        local_trabalho_texto: inviteLocalTrabalho || null,
      });
      if (error) throw error;
      const link = `${window.location.origin}/onboarding/${token}`;
      setGeneratedLink(link);
      // Segunda via: o trabalhador abre este link no telemóvel dele e envia a
      // mensagem já escrita ao número da empresa. Isso abre a janela de 24h da
      // Meta, e o Trabalhador Virtual responde com o Flow de registo — sem
      // precisar de um template aprovado. Fica vazio se o número não estiver
      // configurado; a via web continua a funcionar na mesma.
      const numeroEmpresa = (import.meta.env.VITE_WHATSAPP_NUMERO || '').replace(/[^\d]/g, '');
      setGeneratedWaLink(numeroEmpresa ? `https://wa.me/${numeroEmpresa}?text=${encodeURIComponent(`ONBOARD ${token}`)}` : '');
      setLinkCopied(false);
      setWaLinkCopied(false);
      setInviteEmailSent(false);
    } catch (e) {
      console.error('[onboarding] Erro ao gerar convite:', e);
      setInviteError(e?.message || 'Erro ao gerar link. Verifica a ligação à base de dados.');
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

  const copyWaLink = () => {
    navigator.clipboard.writeText(generatedWaLink).then(() => {
      setWaLinkCopied(true);
      setTimeout(() => setWaLinkCopied(false), 2000);
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
    .filter(w => workerFilter === 'ativos' ? w.status !== 'inativo' : workerFilter === 'inativos' ? w.status === 'inativo' : true)
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
      <SectionHeaderShell
        icon={<Users size={18} />}
        title="Equipa"
        subtitle="Colaboradores, faltas e validações"
        tabs={[
          { id: 'workers',    label: 'Colaboradores', icon: Users,        badge: pendingChangeRequests.length || null, badgeColor: 'amber' },
          { id: 'absences',   label: 'Faltas',        icon: CalendarX,    badge: pendingAbsences || null },
          { id: 'validacao',  label: 'Validação',     icon: ShieldCheck },
          { id: 'correcoes',  label: 'Correções',     icon: AlertTriangle, badge: pendingWorkerCorrections || null },
          { id: 'onboarding', label: 'Pendentes',     icon: Clock,        badge: pendingOnboardingCount || null },
        ]}
        activeTab={teamSubTab}
        onTabChange={setTeamSubTab}
        stats={[
          { label: 'Colaboradores', value: workers.length, colorText: FT.navy, dotColor: FT.slate, active: workerFilter === 'all', onClick: () => setWorkerFilter('all') },
          { label: 'Ativos', value: workers.length - inactiveCount, colorText: '#0d7a4b', dotColor: '#1cb476', active: workerFilter === 'ativos', onClick: () => setWorkerFilter('ativos') },
          { label: 'Inativos', value: inactiveCount, colorText: '#516375', dotColor: '#94a3b8', active: workerFilter === 'inativos', onClick: () => setWorkerFilter('inativos') },
          // Não é filtro — worker_onboarding_submissions é uma tabela diferente de
          // workers, não haveria nada para mostrar na lista. Comporta-se como link:
          // navega para a subtab Pendentes, onde os dados realmente vivem. A seta
          // "↗" sinaliza que este item não é como os outros três.
          { label: 'Onboarding pendente ↗', value: pendingOnboardingCount, colorText: '#92660a', dotColor: '#e8a317', onClick: () => setTeamSubTab('onboarding') },
        ]}
      />

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
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate)] pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar colaborador..."
            value={workersSearch}
            onChange={e => setWorkersSearch(e.target.value)}
            className="pl-8 pr-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48 sm:w-64"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1">
            <button onClick={() => setWorkersView('grid')} className={`p-2 rounded-lg transition-all ${workersView === 'grid' ? 'text-white' : 'text-[var(--slate)] hover:text-[var(--ink-soft)]'}`} style={workersView === 'grid' ? { backgroundColor: FT.navy } : {}} title="Vista em Grade"><LayoutGrid size={18} /></button>
            <button onClick={() => setWorkersView('list')} className={`p-2 rounded-lg transition-all ${workersView === 'list' ? 'text-white' : 'text-[var(--slate)] hover:text-[var(--ink-soft)]'}`} style={workersView === 'list' ? { backgroundColor: FT.navy } : {}} title="Vista em Lista"><List size={18} /></button>
          </div>
          <button
            onClick={() => { setInviteEmail(''); setGeneratedLink(''); setInviteModal(true); }}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl font-black text-xs uppercase transition-all whitespace-nowrap border-2 hover:bg-[var(--surface)]"
            style={{ borderColor: FT.slate, color: 'var(--ink-soft)' }}
            title="Convidar novo colaborador via link de onboarding"
          >
            <UserPlus size={14} /> Convidar
          </button>
          <button
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl font-black text-xs uppercase transition-all whitespace-nowrap border-2 hover:bg-[var(--surface)]"
            style={{ borderColor: FT.slate, color: 'var(--ink-soft)' }}
            title="Scanner de Documentos com IA"
          >
            <ScanSearch size={14} /> Scanner
          </button>
          <button
            onClick={() => {
              setWorkerForm({ id: null, name: '', assignedClients: [], assignedSchedules: [], defaultClientId: '', defaultScheduleId: '', tel: '', valorHora: '', profissao: '', nis: '', nif: '', iban: '', status: 'ativo', dataInicio: '', dataFim: '', dataAlteracao: new Date().toISOString().split('T')[0], limited_entry_mode: false, vencimento_base: '', subsidio_alimentacao_dia: '' });
              setIsAddingInTab(true);
            }}
            className="px-3 sm:px-5 py-2 rounded-xl font-black text-xs uppercase shadow-lg transition-all whitespace-nowrap text-[var(--navy-solid)]"
            style={{ backgroundColor: FT.orange }}
          >
            Novo
          </button>
        </div>
      </div>

      <ModalShell
        isOpen={isAddingInTab}
        onClose={() => setIsAddingInTab(false)}
        title={workerForm.id ? 'Editar Colaborador' : 'Novo Colaborador'}
        subtitle={workerForm.id ? [workerForm.name, workerForm.profissao].filter(Boolean).join(' · ') : undefined}
        icon={<Users size={16} />}
        accent="brand"
        size="3xl"
      >
        <WorkerForm />
      </ModalShell>

      <DocumentScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} />

      {/* Modal de convite de onboarding */}
      <ModalShell
        isOpen={inviteModal}
        onClose={() => { setInviteModal(false); setGeneratedLink(''); setInviteEmail(''); setInviteError(''); setInviteVencimentoBase(''); setInviteDataInicio(''); setInviteLocalTrabalho(''); }}
        title="Convidar novo colaborador"
        subtitle="Link único de preenchimento de dados"
        icon={<UserPlus size={16} />}
        accent="default"
        size="md"
      >
        <div className="p-5 space-y-4">
          {!generatedLink ? (<>
            <p className="text-xs text-[var(--slate-dim)] font-medium leading-relaxed">
              Gera um link único e seguro que o colaborador usa para preencher os seus próprios dados.
              O link expira em 7 dias e só pode ser usado uma vez.
            </p>
            <div>
              <label className={`block ${SCALE.text.statLabel} text-[var(--slate-dim)] mb-1`}>
                Email do colaborador (opcional)
              </label>
              <input
                className="w-full bg-white border border-[var(--border)] rounded-lg py-2 px-3 text-sm font-semibold text-[var(--ink)] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:font-normal placeholder:text-[var(--slate-dim)]"
                type="email"
                placeholder="colaborador@email.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
              <p className={`text-[var(--slate-dim)] mt-1.5 ${SCALE.text.body}`}>Se preenchido, pode enviar o link por email.</p>
            </div>
            <div className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)] space-y-3">
              <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>
                Condições propostas (entram no compromisso de início de atividade)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block ${SCALE.text.statLabel} text-[var(--slate-dim)] mb-1`}>
                    Vencimento base (€)
                  </label>
                  <input
                    className="w-full bg-white border border-[var(--border)] rounded-lg py-2 px-3 text-sm font-semibold text-[var(--ink)] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ex: 900"
                    value={inviteVencimentoBase}
                    onChange={e => setInviteVencimentoBase(e.target.value)}
                  />
                </div>
                <div>
                  <label className={`block ${SCALE.text.statLabel} text-[var(--slate-dim)] mb-1`}>
                    Data de início prevista
                  </label>
                  <input
                    className="w-full bg-white border border-[var(--border)] rounded-lg py-2 px-3 text-sm font-semibold text-[var(--ink)] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                    type="date"
                    value={inviteDataInicio}
                    onChange={e => setInviteDataInicio(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={`block ${SCALE.text.statLabel} text-[var(--slate-dim)] mb-1`}>
                  Local de trabalho
                </label>
                <input
                  className="w-full bg-white border border-[var(--border)] rounded-lg py-2 px-3 text-sm font-semibold text-[var(--ink)] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:font-normal placeholder:text-[var(--slate-dim)]"
                  type="text"
                  placeholder="Ex: instalações do cliente Acme Lda, Porto"
                  value={inviteLocalTrabalho}
                  onChange={e => setInviteLocalTrabalho(e.target.value)}
                />
              </div>
              <p className={`text-[var(--slate-dim)] ${SCALE.text.body}`}>
                Opcional — se deixares em branco, o compromisso mostra "[a definir]" nesses pontos.
              </p>
            </div>
            {inviteError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                <p className="text-xs font-bold text-rose-700">{inviteError}</p>
              </div>
            )}
            <button
              onClick={gerarConvite}
              disabled={inviteLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black uppercase bg-teal-600 text-white hover:bg-teal-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-md"
            >
              {inviteLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              Gerar link de convite
            </button>
          </>) : (<>
            <div className="bg-teal-50 rounded-xl p-4 border border-teal-100 space-y-3">
              <p className={`${SCALE.text.statLabel} text-teal-700`}>Link gerado com sucesso</p>
              <div className="bg-white rounded-lg border border-teal-200 px-3 py-2.5">
                <p className="text-xs font-mono text-teal-800 break-all select-all leading-relaxed">{generatedLink}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyLink}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black uppercase transition-all ${linkCopied ? 'bg-emerald-600 text-white' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
                >
                  {linkCopied ? <Check size={13} /> : <Copy size={13} />}
                  {linkCopied ? 'Copiado!' : 'Copiar link'}
                </button>
                {inviteEmail && (
                  <button
                    onClick={sendInviteEmail}
                    disabled={inviteEmailSent}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black uppercase transition-all ${inviteEmailSent ? 'bg-emerald-100 text-emerald-700' : 'bg-[var(--orange)] text-[var(--navy-solid)] hover:bg-[var(--orange-hover)]'} disabled:opacity-60`}
                  >
                    {inviteEmailSent ? <Check size={13} /> : <Mail size={13} />}
                    {inviteEmailSent ? 'Enviado' : 'Enviar email'}
                  </button>
                )}
              </div>
              <p className={`text-teal-600 ${SCALE.text.meta}`}>
                Expira em 7 dias · uso único
              </p>
            </div>
            {generatedWaLink && (
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 space-y-3">
                <p className={`${SCALE.text.statLabel} text-emerald-700`}>Ou preencher pelo WhatsApp</p>
                <div className="bg-white rounded-lg border border-emerald-200 px-3 py-2.5">
                  <p className="text-xs font-mono text-emerald-800 break-all select-all leading-relaxed">{generatedWaLink}</p>
                </div>
                <button
                  onClick={copyWaLink}
                  className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black uppercase transition-all ${waLinkCopied ? 'bg-emerald-600 text-white' : 'bg-emerald-700 text-white hover:bg-emerald-800'}`}
                >
                  {waLinkCopied ? <Check size={13} /> : <Copy size={13} />}
                  {waLinkCopied ? 'Copiado!' : 'Copiar link WhatsApp'}
                </button>
                <p className={`text-emerald-600 ${SCALE.text.meta}`}>
                  O trabalhador abre este link no telemóvel e envia a mensagem já escrita. O Trabalhador Virtual responde com o formulário. A assinatura é sempre feita no link acima.
                </p>
              </div>
            )}
            <button
              onClick={() => { setGeneratedLink(''); setGeneratedWaLink(''); setInviteEmail(''); setInviteError(''); setInviteVencimentoBase(''); setInviteDataInicio(''); setInviteLocalTrabalho(''); }}
              className="w-full text-xs text-[var(--slate-dim)] hover:text-[var(--ink-soft)] font-bold py-1 transition-colors"
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
