import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import EntryForm from '../../components/common/EntryForm';
import ClientTimesheetReport from '../../components/common/ClientTimesheetReport';
import { parseDeviceLabel } from '../../utils/deviceUtils';
import { FT } from '../../styles/designTokens';
import {
  Settings2, CheckCircle, Users, X, Zap, Plus, Trash2, Unlock,
  Settings, FileText, Sparkles, Bell, Pencil, FileDown, CalendarX,
  BarChart3, LogOut, ChevronLeft, ChevronRight
} from 'lucide-react';

const SOURCE_CFG = {
  gps_auto:     { label: 'GPS',        bg: 'bg-emerald-100', text: 'text-emerald-700' },
  quick_worker: { label: 'Card',       bg: 'bg-cyan-100',    text: 'text-cyan-700' },
  manual_admin: { label: 'Admin',      bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  manual_worker:{ label: 'Manual',     bg: 'bg-blue-100',    text: 'text-blue-700' },
  batch:        { label: 'Lote',       bg: 'bg-amber-100',   text: 'text-amber-700' },
  request:      { label: 'Pedido',     bg: 'bg-purple-100',  text: 'text-purple-700' },
  correction:   { label: 'Correcção',  bg: 'bg-orange-100',  text: 'text-orange-700' },
  client_portal:{ label: 'Portal',     bg: 'bg-teal-100',    text: 'text-teal-700' },
};

function LogSourceBadge({ log }) {
  const cfg = SOURCE_CFG[log.source];
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {cfg && (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
          {cfg.label}
        </span>
      )}
      {log.edited_at && (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-[var(--surface-dim)] text-[var(--slate-dim)]">
          <Pencil size={8} /> Editado
        </span>
      )}
    </div>
  );
}
import TeamManager from './TeamManager';
import ClientManager from './ClientManager';
import FornecedorManager from './FornecedorManager';
import ScheduleManager from './ScheduleManager';
import CostReports from './CostReports';
import DocumentsAdmin from './DocumentsAdmin';
import FaturacaoAdmin from './FaturacaoAdmin';
import ReconciliacaoTab from './ReconciliacaoTab';
import PagamentosAdmin from './PagamentosAdmin';
import NotificationsAdmin from './NotificationsAdmin';
import AlertasAdmin from './AlertasAdmin';
import FormacaoInternaAdmin from './formacao-interna/FormacaoInternaAdmin';
import AdminOverview from './AdminOverview';
import AdminReports from './AdminReports';
import AdminSettings from './AdminSettings';
import AdminSidebar from './AdminSidebar';
import AdminClassicNav from './AdminClassicNav';
import CompanyLogo from '../../components/common/CompanyLogo';
import TOConlineAdmin from './TOConlineAdmin';
import AjudasCustoAdmin from './AjudasCustoAdmin';
import RecibosCalculadora from './RecibosCalculadora';
import MapaSalarios from './mapa-salarios/MapaSalarios.jsx';
import {
  toISODateLocal, isSameMonth
} from '../../utils/dateUtils';
import {
  formatHours, calculateDuration
} from '../../utils/formatUtils';
import { callGemini } from '../../utils/aiUtils';

function BrandBar({ unreadCount, onToggleNotifDropdown, onOpenFinReport, onLogout, onSwitchToWorker, showBackToTeam, onBackToTeam, onGoHome }) {
  return (
    <div
      className="flex items-center px-2.5 sm:px-6 gap-1.5 sm:gap-4 shrink-0"
      style={{
        height: '104px',
        backgroundColor: FT.navy,
        borderBottom: '2px solid rgba(235,141,0,0.35)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
        zIndex: 40,
      }}
    >
      {showBackToTeam && (
        <button
          onClick={onBackToTeam}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0"
          style={{ color: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          <ChevronLeft size={15} /> Equipa
        </button>
      )}

      <button
        onClick={onGoHome}
        className="flex items-center gap-2 sm:gap-4 rounded-2xl transition-all flex-1 min-w-0 sm:flex-initial"
        style={{ background: 'none', border: 'none', padding: '6px 2px', cursor: 'pointer' }}
        aria-label="Ir para início"
        title="Início"
      >
        <div className="w-12 h-12 sm:w-[68px] sm:h-[68px] shrink-0" style={{
          borderRadius: '50%',
          overflow: 'hidden', backgroundColor: FT.orange,
        }}>
          <CompanyLogo className="w-full h-full object-cover" />
        </div>
        <div className="text-left min-w-0">
          <p className="text-sm sm:text-2xl truncate" style={{ fontWeight: 800, color: 'white', lineHeight: 1.2, letterSpacing: 'normal', textTransform: 'uppercase' }}>Magnetic Place</p>
          <p className="text-[10px] sm:text-[13px] truncate" style={{ fontWeight: 500, color: FT.slate, lineHeight: 1.3, marginTop: '2px' }}>Unipessoal, Lda</p>
          <p className="text-[9px] sm:text-xs truncate" style={{ fontWeight: 500, color: FT.orange, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.3 }}>Gestão</p>
        </div>
      </button>

      <div className="hidden sm:block sm:flex-1" />

      {/* Ícones de ação — estilo suave, sem caixa sólida, só um leve realce ao tocar/passar o rato */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <button
          data-notif-bell
          onClick={onToggleNotifDropdown}
          className="flex items-center justify-center p-1.5 sm:p-2.5 rounded-xl transition-colors active:bg-white/10 sm:hover:bg-white/10 relative"
          style={{ color: 'rgba(255,255,255,0.75)' }}
          aria-label="Notificações"
        >
          <Bell size={17} className="sm:hidden" />
          <Bell size={18} className="hidden sm:block" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenFinReport}
          className="hidden sm:flex items-center justify-center p-2.5 rounded-xl transition-colors hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.75)' }}
          aria-label="Relatório financeiro"
          title="Relatório financeiro"
        >
          <BarChart3 size={18} />
        </button>

        {onSwitchToWorker && (
          <button
            onClick={onSwitchToWorker}
            className="flex items-center justify-center p-1.5 sm:p-2.5 rounded-xl transition-colors active:bg-white/10 sm:hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.75)' }}
            aria-label="Ver como trabalhador"
            title="Ver como trabalhador"
          >
            <Users size={17} className="sm:hidden" />
            <Users size={18} className="hidden sm:block" />
          </button>
        )}

        <button
          onClick={onLogout}
          className="p-1.5 sm:p-2.5 rounded-xl transition-colors active:bg-white/10 sm:hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.5)' }}
          aria-label="Terminar sessão"
          title="Terminar sessão"
        >
          <LogOut size={17} className="sm:hidden" />
          <LogOut size={18} className="hidden sm:block" />
        </button>
      </div>
    </div>
  );
}

function AdminDashboard(props) {
  const {
    onLogout,
    onLogin,
    currentUser,
    currentMonth,
    setCurrentMonth,
    auditWorkerId,
    setAuditWorkerId,
    setShowFinReport,
    logs,
    handleSaveEntry,
    printingReport,
    setPrintingReport,
    handleDelete,
    approvals,
    clientApprovals,
    systemSettings,
    correctionNotifications,
    setClienteSelecionado,
    setModalEmailAberto,
    portalMonth,
    setPortalMonth,
    setModalRejeitarAberto,
    setRejeitarMotivo,
    setRejeitarNotif
  } = props;

  const { adminStats, clients, workers, schedules, expenses, appNotifications, workerChangeRequests, absenceRequests, corrections, correctionItems, saveToDb, setSystemSettings, saveSystemSettings, supabase, companySignature, saveCompanySignature } = useApp();

  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname.replace(/^\/admin\//, '').split('/')[0] || 'overview';
  const setActiveTab = useCallback((tab) => navigate('/admin/' + tab), [navigate]);

  const notificacoesDeCorrecao = correctionNotifications;

  const [optimisticReadIds, setOptimisticReadIds] = useState(new Set());
  const [optimisticViewedCorrIds, setOptimisticViewedCorrIds] = useState(new Set());

  const isRead = (n) => (n.read_by_admin_ids || []).includes(currentUser?.id) || (n.read_by_ids || []).includes(currentUser?.id) || optimisticReadIds.has(n.id);
  const isViewed = (n) => (n.viewed_by_admin_ids || []).includes(currentUser?.id) || optimisticViewedCorrIds.has(n.id);

  const [dismissedAdminNotifs, setDismissedAdminNotifs] = useState([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dismissed_admin_notifs');
      if (stored) setDismissedAdminNotifs(JSON.parse(stored));
    } catch {}
  }, []);

  const pendingChangeRequests = (workerChangeRequests || []).filter(r => r.status === 'pending');
  const pendingChangeRequestsCount = pendingChangeRequests.length;
  const pendingAbsencesCount = (absenceRequests || []).filter(r => r.status === 'pending').length;
  const pendingClientCorrectionsCount = (corrections || []).filter(c =>
    c.type !== 'creation_request' && c.type !== 'deletion_request' &&
    (c.status === 'submitted' || c.status === 'under_review' || c.status === 'pending')
  ).length;

  const pendingWorkerCorrectionsCount = (corrections || []).filter(c =>
    (c.type === 'creation_request' || c.type === 'deletion_request') &&
    (c.status === 'submitted' || c.status === 'under_review')
  ).length;
  const totalPendingCorrections = pendingClientCorrectionsCount + pendingWorkerCorrectionsCount;
  const workerSubmissionUnread = (appNotifications || []).filter(n => {
    if (n.target_type !== 'admin') return false;
    if (n.payload?.kind !== 'submitted') return false;
    if (isRead(n)) return false;
    if (dismissedAdminNotifs.includes(n.id)) return false;
    return true;
  }).length;
  const nonSubmittedAdminUnread = (appNotifications || []).filter(n => {
    if (n.target_type !== 'admin') return false;
    if (n.payload?.kind === 'submitted') return false;
    if (isRead(n)) return false;
    if (dismissedAdminNotifs.includes(n.id)) return false;
    return true;
  }).length;
  const unreadCount = workerSubmissionUnread + nonSubmittedAdminUnread + pendingChangeRequestsCount + pendingAbsencesCount;

  const handleDismissAdminNotif = useCallback((id) => {
    setDismissedAdminNotifs(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      localStorage.setItem('dismissed_admin_notifs', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const [expandedCards, setExpandedCards] = useState({});

  const getNotificationBadge = (notif) => {
    if (notif.payload?.kind === 'submitted') {
      const corr = corrections?.find(c => c.id === notif.payload?.correction_id);
      if (corr && corr.status && corr.status !== 'submitted' && corr.status !== 'under_review') {
        return {
          resolved: true,
          status: corr.status,
          label: corr.status === 'applied' ? '✅ Aprovado' : '❌ Rejeitado'
        };
      }
    }
    return { resolved: false };
  };

  const markNotifRead = async (id) => {
    const previousState = optimisticReadIds;
    setOptimisticReadIds(prev => new Set([...prev, id]));
    try {
      if (!currentUser?.id || !supabase) return;
      const notif = appNotifications.find(n => n.id === id);
      if (!notif) return;
      const current = notif.read_by_admin_ids || [];
      const currentGeneric = notif.read_by_ids || [];
      if (current.includes(currentUser.id) && currentGeneric.includes(currentUser.id)) return;
      await supabase.from('app_notifications')
        .update({
          read_by_admin_ids: current.includes(currentUser.id) ? current : [...current, currentUser.id],
          read_by_ids: currentGeneric.includes(currentUser.id) ? currentGeneric : [...currentGeneric, currentUser.id],
        })
        .eq('id', id);
    } catch (err) {
      setOptimisticReadIds(previousState);
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markCorrectionsViewed = async (specificIds) => {
    const ids = specificIds ?? notificacoesDeCorrecao.map(n => n.id);
    setOptimisticViewedCorrIds(prev => new Set([...prev, ...ids]));
    if (!currentUser?.id || !supabase) return;
    const toMark = specificIds
      ? notificacoesDeCorrecao.filter(n => specificIds.includes(n.id))
      : notificacoesDeCorrecao;
    await Promise.all(toMark.map(async n => {
      const current = n.viewed_by_admin_ids || [];
      if (current.includes(currentUser.id)) return;
      await supabase.from('corrections')
        .update({ viewed_by_admin_ids: [...current, currentUser.id] })
        .eq('id', n.id);
    }));
  };

  useEffect(() => {
    if (activeTab !== 'notificacoes' || !currentUser?.id || !supabase || !appNotifications.length) return;
    const unread = appNotifications.filter(n => !isRead(n) && n.target_type === 'admin');
    if (!unread.length) return;
    setOptimisticReadIds(prev => new Set([...prev, ...unread.map(n => n.id)]));
    Promise.all(unread.map(n => {
      const current = n.read_by_admin_ids || [];
      const currentGeneric = n.read_by_ids || [];
      return supabase.from('app_notifications')
        .update({
          read_by_admin_ids: [...current, currentUser.id],
          read_by_ids: currentGeneric.includes(currentUser.id) ? currentGeneric : [...currentGeneric, currentUser.id],
        })
        .eq('id', n.id);
    }));
  }, [activeTab, currentUser?.id, appNotifications, supabase]);

  useEffect(() => {
    const qp = new URLSearchParams(location.search);
    const src = qp.get('source');
    if ((activeTab !== 'clients' || src !== 'clients') && (activeTab !== 'team' || src !== 'workers')) return;
    if (!currentUser?.id || !supabase) return;
    markCorrectionsViewed();
  }, [activeTab, location.search, currentUser?.id]);

  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const notifDropdownRef = useRef(null);
  useEffect(() => {
    if (!showNotifDropdown) return;
    const handler = (e) => {
      if (e.target.closest('[data-notif-bell]')) return;
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifDropdown]);

  const [selectedCorrectionId, setSelectedCorrectionId] = useState(null);


  const [workerAISummary, setWorkerAISummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);

  const auditedWorker = workers.find(w => w.id === auditWorkerId);
  const auditedMonthLogs = logs.filter(l => l.workerId === auditWorkerId && isSameMonth(l.date, currentMonth));
  const daysInMonthList = useMemo(() => Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }, (_, i) => toISODateLocal(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1))), [currentMonth]);
  const currentMonthStr = toISODateLocal(currentMonth).substring(0, 7);
  const portalMonthStr = toISODateLocal(portalMonth).substring(0, 7);

  const [inlineEditingDate, setInlineEditingDate] = useState(null);
  const [inlineFormData, setInlineFormData] = useState({});

  const [reportFilter, setReportFilter] = useState({ clientId: '', workerId: '', month: toISODateLocal(new Date()).substring(0, 7) });
  const [reportHistory, setReportHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('reportHistory') || '[]'); } catch { return []; }
  });

  const handleGenerateClientReport = () => {
    if (!reportFilter.month || (!reportFilter.clientId && !reportFilter.workerId)) return;
    const clientSelected = reportFilter.clientId ? clients.find(c => c.id === reportFilter.clientId) : null;
    const workerSelected = reportFilter.workerId ? workers.find(w => w.id === reportFilter.workerId) : null;
    const historyEntry = {
      id: `rh_${Date.now()}`,
      month: reportFilter.month,
      clientId: reportFilter.clientId || '',
      clientName: clientSelected?.name || (reportFilter.workerId ? 'Vários Clientes' : ''),
      workerId: reportFilter.workerId || '',
      workerName: workerSelected?.name || (reportFilter.clientId ? 'Todos' : ''),
      timestamp: new Date().toISOString()
    };
    const updatedHistory = [historyEntry, ...reportHistory].slice(0, 5);
    setReportHistory(updatedHistory);
    localStorage.setItem('reportHistory', JSON.stringify(updatedHistory));
    setPrintingReport({ client: clientSelected, month: reportFilter.month, workerId: reportFilter.workerId });
  };

  const activeWorkersCount = useMemo(() => {
    if (!reportFilter.month) return workers.filter(w => w.is_active !== false).length;
    return [...new Set(logs.filter(l => l.date?.startsWith(reportFilter.month)).map(l => l.workerId))].length;
  }, [logs, reportFilter.month, workers]);

  const activeClientsCount = useMemo(() => {
    if (!reportFilter.month) return clients.length;
    return [...new Set(logs.filter(l => l.date?.startsWith(reportFilter.month)).map(l => l.clientId))].length;
  }, [logs, reportFilter.month, clients]);

  const handleOpenInlineForm = (ds) => {
    setInlineEditingDate(ds);
    setInlineFormData({ id: null, date: ds, clientId: auditedWorker?.defaultClientId || '', startTime: '', breakStart: '', breakEnd: '', endTime: '', description: '' });
  };

  const handleQuickRegister = (ds) => {
    handleOpenInlineForm(ds);
  };

  const generateWorkerSummary = async () => {
    if (auditedMonthLogs.length === 0) return;
    setIsSummarizing(true);
    const logTexts = auditedMonthLogs.map(l => `- ${l.date}: ${l.description}`).join('\n');
    const prompt = `Resuma o desempenho de ${auditedWorker.name} baseado nestas atividades de ${currentMonth.toLocaleDateString('pt-PT', { month: 'long' })}: \n${logTexts}\n Destaque produtividade e áreas de foco de forma executiva.`;
    const summary = await callGemini(prompt, "Você é um gestor de RH analítico.");
    setWorkerAISummary(summary);
    setIsSummarizing(false);
  };

  const formatLogDate = (d) => {
    if (!d) return 'Data inválida';
    const ptMatch = d.match(/^(\d{2})\/(\d{2})/);
    if (ptMatch) return `${ptMatch[1]}/${ptMatch[2]}`;
    const [y, m, day] = d.split('T')[0].split('-');
    return (y && m && day) ? `${day}/${m}/${y}` : 'Data inválida';
  };

  const tabContent = (
    <>
      {auditWorkerId && (() => {
        const currentApproval = approvals.find(a => a.workerId === auditWorkerId && a.month === currentMonthStr);
        return (
          <div className="mb-6 bg-white rounded-2xl sm:rounded-[3rem] p-4 sm:p-8 lg:p-10 shadow-2xl border-4 border-indigo-500/20 animate-in slide-in-from-top-8 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 gap-3 md:gap-6">
              <div className="flex items-center gap-3 sm:gap-6"><div className="bg-[var(--navy-solid)] p-3 sm:p-5 rounded-2xl sm:rounded-3xl text-white shadow-xl"><Settings2 size={28} className="sm:hidden" /><Settings2 size={40} className="hidden sm:block" /></div><div><h2 className="text-xl sm:text-3xl font-black uppercase">Audit: {auditedWorker?.name}</h2><p className="text-[var(--slate-dim)] font-bold uppercase text-[10px] tracking-widest mt-1">Controlo Mensal Detalhado</p></div></div>
              <div className="flex items-center gap-4 bg-[var(--surface)] p-2 rounded-[2.5rem] border border-[var(--border)]">
                {currentApproval && (
                  <div className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-[2rem] shadow-sm flex items-center gap-4 border border-emerald-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={20} />
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase opacity-70 leading-none">Status</span>
                        <span className="text-sm font-black leading-none">Aprovado</span>
                      </div>
                    </div>
                    <button onClick={() => handleDelete('approvals', currentApproval.id)} className="bg-white p-2 rounded-full text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-rose-100" title="Desbloquear Mês para o Trabalhador"><Unlock size={14} /></button>
                  </div>
                )}
                <div className="bg-[var(--navy-solid)] text-white px-8 py-3 rounded-[2rem] shadow-lg flex flex-col items-center"><span className="text-[8px] font-black uppercase opacity-70">Total Mês</span><span className="text-xl font-black">{formatHours(auditedMonthLogs.reduce((a, b) => a + b.hours, 0))}</span></div>
                <button onClick={() => setAuditWorkerId(null)} className="p-4 bg-white text-red-500 rounded-full border border-red-100 shadow-md"><X size={28} /></button>
              </div>
            </div>
            <div className="mb-8 p-6 bg-indigo-50 rounded-3xl border border-indigo-100 relative">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-indigo-700 flex items-center gap-2"><Sparkles size={16} /> Resumo de Produtividade AI ✨</h4>
                <button onClick={generateWorkerSummary} disabled={isSummarizing || auditedMonthLogs.length === 0} className="text-[10px] bg-[var(--orange)] text-[var(--navy-solid)] px-4 py-1.5 rounded-full font-black uppercase">{isSummarizing ? "Gerando..." : "Gerar com IA"}</button>
              </div>
              <p className="text-sm text-[var(--ink-soft)] italic leading-relaxed">{workerAISummary || "Utilize o Gemini para resumir as atividades deste mês."}</p>
            </div>
            <div className="overflow-x-auto rounded-[3rem] border border-[var(--border-soft)] bg-white shadow-inner"><table className="w-full text-left border-collapse">
              <thead className="bg-[var(--surface)] border-b border-[var(--border-soft)]"><tr><th className="px-4 sm:px-10 py-4 sm:py-6 text-[10px] font-black uppercase tracking-widest w-16 sm:w-32">Dia</th><th className="px-4 sm:px-10 py-4 sm:py-6 text-[10px] font-black uppercase tracking-widest">Actividades</th><th className="px-4 sm:px-10 py-4 sm:py-6 text-[10px] font-black uppercase tracking-widest text-right">Acção</th></tr></thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {daysInMonthList.map(ds => {
                  const dayLogs = logs.filter(l => l.workerId === auditWorkerId && l.date === ds);
                  const isCurrentInline = inlineEditingDate === ds;
                  return (
                    <React.Fragment key={ds}>
                      <tr className="group">
                        <td className="px-4 sm:px-10 py-4 sm:py-8 align-top"><p className="text-2xl sm:text-3xl font-black">{new Date(ds).getDate()}</p></td>
                        <td className="px-4 sm:px-10 py-4 sm:py-8">
                          <div className="space-y-3">
                            {dayLogs.map(log => (
                              <div key={log.id} className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl border border-indigo-100/50 flex items-center justify-between shadow-sm gap-2">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl uppercase border border-indigo-100">{clients.find(c => c.id === log.clientId)?.name}</span>
                                  <div className="text-sm font-bold font-mono">{log.startTime}-{log.endTime} {log.breakStart ? `(P: ${log.breakStart})` : ''}</div>
                                  <LogSourceBadge log={log} />
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-2xl font-black">{formatHours(log.hours)}</span>
                                  <button onClick={() => handleDelete('logs', log.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Apagar Registo"><Trash2 size={18} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 sm:px-10 py-4 sm:py-8 text-right align-top">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleQuickRegister(ds)} title="Registo Rápido" className="p-3 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-2xl transition-all"><Zap size={20} /></button>
                            <button onClick={() => handleOpenInlineForm(ds)} className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all"><Plus size={20} /></button>
                          </div>
                        </td>
                      </tr>
                      {isCurrentInline && (
                        <tr><td colSpan="3" className="px-4 sm:px-10 py-4 bg-indigo-50/30">
                          <EntryForm isInline data={inlineFormData} clients={clients} assignedClients={auditedWorker?.assignedClients} onChange={setInlineFormData} onSave={() => { handleSaveEntry(inlineFormData, false, ds); setInlineEditingDate(null); }} onCancel={() => setInlineEditingDate(null)} />
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        );
      })()}

      {!auditWorkerId && activeTab === 'overview' && (
        <AdminOverview currentMonth={currentMonth} setCurrentMonth={setCurrentMonth} />
      )}

      {!auditWorkerId && activeTab === 'reports' && (
        <AdminReports printingReport={printingReport} setPrintingReport={setPrintingReport} />
      )}

      {!auditWorkerId && activeTab === 'team' && (
        <TeamManager onLogin={onLogin} />
      )}

      {!auditWorkerId && activeTab === 'clients' && (
        <ClientManager
          setClienteSelecionado={setClienteSelecionado}
          setModalEmailAberto={setModalEmailAberto}
          setPrintingReport={setPrintingReport}
          portalMonth={portalMonth}
          setPortalMonth={setPortalMonth}
        />
      )}

      {!auditWorkerId && activeTab === 'fornecedores' && <FornecedorManager />}

      {!auditWorkerId && activeTab === 'schedules' && <ScheduleManager />}

      {!auditWorkerId && activeTab === 'costs' && <CostReports />}

      {!auditWorkerId && activeTab === 'documentos' && <DocumentsAdmin />}

      {!auditWorkerId && activeTab === 'faturacao' && <FaturacaoAdmin />}

      {!auditWorkerId && activeTab === 'reconciliacao' && <ReconciliacaoTab />}

      {!auditWorkerId && activeTab === 'pagamentos' && <PagamentosAdmin />}

      {!auditWorkerId && activeTab === 'notificacoes' && (
        <NotificationsAdmin workers={workers} appNotifications={appNotifications} saveToDb={saveToDb} handleDelete={handleDelete} supabase={supabase} />
      )}

      {!auditWorkerId && activeTab === 'toconline' && (
        <TOConlineAdmin />
      )}

      {!auditWorkerId && activeTab === 'ajudas-custo' && (
        <AjudasCustoAdmin />
      )}

      {!auditWorkerId && activeTab === 'recibos' && (
        <RecibosCalculadora />
      )}

      {!auditWorkerId && activeTab === 'mapa-salarios' && (
        <MapaSalarios />
      )}

      {!auditWorkerId && activeTab === 'formacao' && (
        <FormacaoInternaAdmin />
      )}

      {!auditWorkerId && activeTab === 'alertas' && (
        <AlertasAdmin />
      )}

      {!auditWorkerId && activeTab === 'settings' && (
        <AdminSettings />
      )}
    </>
  );

  const navMode = systemSettings?.navMode || 'sidebar';

  return (
    <div
      className={`bg-[var(--surface-dim)] font-sans text-[var(--ink)] ${navMode === 'topbar' ? 'min-h-screen' : 'h-screen overflow-hidden flex flex-col'}`}
    >
      {navMode === 'topbar' ? (
        <>
          <AdminClassicNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setAuditWorkerId={setAuditWorkerId}
            pendingAbsencesCount={pendingAbsencesCount}
            pendingWorkerCorrectionsCount={pendingWorkerCorrectionsCount}
            pendingClientCorrectionsCount={pendingClientCorrectionsCount}
            currentUser={currentUser}
            unreadCount={unreadCount}
            systemSettings={systemSettings}
            onToggleNotifDropdown={() => setShowNotifDropdown(s => !s)}
            onOpenFinReport={() => setShowFinReport(true)}
            onLogout={onLogout}
            onLogin={onLogin}
          />
          <main className="px-3 sm:px-6 md:px-10 lg:px-16 py-4 sm:py-6 overflow-x-hidden">
            {tabContent}
          </main>
        </>
      ) : (
        <>
          <BrandBar
            unreadCount={unreadCount}
            onToggleNotifDropdown={() => setShowNotifDropdown(s => !s)}
            onOpenFinReport={() => setShowFinReport(true)}
            onLogout={onLogout}
            onSwitchToWorker={currentUser?.isAdmin ? () => onLogin('worker', currentUser) : null}
            showBackToTeam={!!auditWorkerId}
            onBackToTeam={() => setAuditWorkerId(null)}
            onGoHome={() => setActiveTab('overview')}
          />
          <div className="flex-1 flex overflow-hidden min-h-0">
            <AdminSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setAuditWorkerId={setAuditWorkerId}
              pendingAbsencesCount={pendingAbsencesCount}
              pendingWorkerCorrectionsCount={pendingWorkerCorrectionsCount}
              pendingClientCorrectionsCount={pendingClientCorrectionsCount}
              currentUser={currentUser}
              onLogout={onLogout}
              onSwitchToWorker={currentUser?.isAdmin ? () => onLogin('worker', currentUser) : null}
              isMobileOpen={mobileNavOpen}
              onClose={() => setMobileNavOpen(false)}
            />
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <main className="flex-1 overflow-x-hidden overflow-y-auto flex flex-col min-h-0">
                <div className="flex-1 min-h-0 flex flex-col px-3 sm:px-6 md:px-10 lg:px-16 py-4 sm:py-6">
                  {tabContent}
                </div>
              </main>
            </div>
          </div>

          {/* Pega fixa para abrir o menu mobile — visível, não depende só do gesto de deslizar */}
          {!mobileNavOpen && (
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir menu"
              className="md:hidden fixed left-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center active:scale-95 transition-transform"
              style={{
                width: '20px',
                height: '56px',
                backgroundColor: FT.navy,
                borderTopRightRadius: '10px',
                borderBottomRightRadius: '10px',
                borderTop: '1px solid rgba(235,141,0,0.5)',
                borderRight: '1px solid rgba(235,141,0,0.5)',
                borderBottom: '1px solid rgba(235,141,0,0.5)',
                boxShadow: '2px 0 10px rgba(0,0,0,0.25)',
              }}
            >
              <ChevronRight size={13} style={{ color: FT.orange }} />
            </button>
          )}
        </>
      )}

      {showNotifDropdown && (
        <div ref={notifDropdownRef} className="fixed top-[6.5rem] right-3 sm:right-6 z-[200] w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-[var(--border-soft)] overflow-hidden animate-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3 border-b border-[var(--border-soft)] flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--ink-soft)]">Notificações</h3>
            <button onClick={() => setShowNotifDropdown(false)} className="p-1 text-[var(--slate)] hover:text-[var(--ink-soft)] transition-colors"><X size={14} /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--border-soft)]">
            {notificacoesDeCorrecao.filter(n => !isViewed(n)).map(corr => {
              const client = clients.find(c => String(c.id) === String(corr.client_id));
              return (
                <button key={corr.id} onClick={() => { markCorrectionsViewed([corr.id]); navigate('/admin/clients?source=clients'); setShowNotifDropdown(false); }} className="w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-orange-100 text-orange-600 shrink-0 mt-0.5"><FileText size={14} /></div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[8px] font-black uppercase tracking-widest text-orange-500 block">Report de Cliente</span>
                    <p className="text-xs font-black text-[var(--ink)] truncate">{client?.name || 'Cliente'}</p>
                    <p className="text-[10px] text-[var(--slate-dim)] mt-0.5">Mês <span className="font-bold">{corr.month}</span></p>
                    {corr.submitted_at && <p className="text-[9px] text-[var(--slate-dim)] mt-0.5">{new Date(corr.submitted_at).toLocaleString('pt-PT')}</p>}
                  </div>
                </button>
              );
            })}
            {pendingChangeRequests.map(req => {
              const worker = workers.find(w => w.id === req.worker_id);
              return (
                <button key={req.id} onClick={() => { setActiveTab('team'); setShowNotifDropdown(false); }} className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-600 shrink-0 mt-0.5"><Users size={14} /></div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[8px] font-black uppercase tracking-widest text-amber-500 block">Alteração de Dados</span>
                    <p className="text-xs font-black text-[var(--ink)] truncate">{worker?.name || 'Trabalhador'}</p>
                    <p className="text-[10px] text-[var(--slate-dim)] mt-0.5">Campo: <span className="font-bold">{req.field_label}</span></p>
                    <p className="text-[9px] text-[var(--slate-dim)] mt-0.5">{new Date(req.created_at).toLocaleString('pt-PT')}</p>
                  </div>
                </button>
              );
            })}
            {(absenceRequests || []).filter(r => r.status === 'pending').map(req => (
              <button key={req.id} onClick={() => { setActiveTab('team'); setShowNotifDropdown(false); }} className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-600 shrink-0 mt-0.5"><CalendarX size={14} /></div>
                <div className="min-w-0 flex-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-500 block">Pedido de Ausência</span>
                  <p className="text-xs font-black text-[var(--ink)] truncate">{req.worker_name || 'Trabalhador'}</p>
                  {req.dates?.length > 0 && <p className="text-[10px] text-[var(--slate-dim)] mt-0.5">{req.dates.slice(0, 2).join(', ')}{req.dates.length > 2 ? ` +${req.dates.length - 2}` : ''}</p>}
                  {req.created_at && <p className="text-[9px] text-[var(--slate-dim)] mt-0.5">{new Date(req.created_at).toLocaleString('pt-PT')}</p>}
                </div>
              </button>
            ))}
            {(() => {
              const seenClientCorrIds = new Set();
              const clientSubmitNotifs = appNotifications.filter(n => {
                if (isRead(n)) return false;
                if (dismissedAdminNotifs.includes(n.id)) return false;
                if (n.target_type !== 'admin') return false;
                if (n.payload?.kind !== 'submitted') return false;
                const cid = n.payload?.correction_id;
                if (!cid) return false;
                const corr = corrections?.find(c => c.id === cid);
                if (!corr) return false;
                if (corr.type === 'creation_request' || corr.type === 'deletion_request') return false;
                if (seenClientCorrIds.has(cid)) return false;
                seenClientCorrIds.add(cid);
                return true;
              });
              return clientSubmitNotifs.map(n => {
                const corrId = n.payload?.correction_id;
                const corr = corrections?.find(c => c.id === corrId);
                const client = clients.find(c => String(c.id) === String(corr?.client_id));
                return (
                  <button key={n.id} onClick={() => { markNotifRead(n.id); navigate('/admin/clients?source=clients'); setShowNotifDropdown(false); }} className="w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-orange-100 text-orange-600 shrink-0 mt-0.5"><FileText size={14} /></div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[8px] font-black uppercase tracking-widest text-orange-500 block">Report de Cliente</span>
                      <p className="text-xs font-black text-[var(--ink)] truncate">{client?.name || corr?.client_id || 'Cliente'}</p>
                      {corr?.month && <p className="text-[10px] text-[var(--slate-dim)] mt-0.5">Mês <span className="font-bold">{corr.month}</span></p>}
                      {n.created_at && <p className="text-[9px] text-[var(--slate-dim)] mt-0.5">{new Date(n.created_at).toLocaleString('pt-PT')}</p>}
                    </div>
                  </button>
                );
              });
            })()}
            {(() => {
              const seenCorrIds = new Set();
              const workerNotifs = appNotifications.filter(n => {
                if (isRead(n)) return false;
                if (dismissedAdminNotifs.includes(n.id)) return false;
                if (n.target_type !== 'admin') return false;
                if (n.payload?.kind !== 'submitted') return false;
                const cid = n.payload?.correction_id;
                if (!cid) return false;
                const corr = corrections?.find(c => c.id === cid);
                if (corr && corr.type !== 'creation_request' && corr.type !== 'deletion_request') return false;
                if (seenCorrIds.has(cid)) return false;
                seenCorrIds.add(cid);
                return true;
              });
              return workerNotifs.map(n => {
                const badge = getNotificationBadge(n);
                const corrId = n.payload?.correction_id;
                const corr = corrections?.find(c => c.id === corrId);
                const workerIdResolved = n.worker_id || corr?.submitted_by;
                const worker = workers.find(w => String(w.id) === String(workerIdResolved));
                const workerNameFallback = n.title?.split('·').slice(-1)[0]?.trim() || 'Trabalhador';
                const isExpanded = expandedCards[n.id];
                return (
                  <div key={n.id} className={`px-4 py-3 ${badge.resolved ? 'bg-[var(--surface)]' : 'hover:bg-amber-50'} transition-colors`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${badge.resolved ? 'bg-[var(--surface-dim)] text-[var(--ink-soft)]' : 'bg-amber-100 text-amber-600'}`}><FileText size={14} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[8px] font-black uppercase tracking-widest block ${badge.resolved ? 'text-[var(--slate-dim)]' : 'text-amber-500'}`}>Submissão Trabalhador</span>
                          {badge.resolved && <span className="text-[8px] font-black text-[var(--slate-dim)]">{badge.label}</span>}
                        </div>
                        <p className="text-xs font-black text-[var(--ink)] truncate">{worker?.name || workerNameFallback}</p>
                        {corr?.month && <p className="text-[10px] text-[var(--slate-dim)] mt-0.5">Mês <span className="font-bold">{corr.month}</span></p>}
                        {n.created_at && <p className="text-[9px] text-[var(--slate-dim)] mt-0.5">{new Date(n.created_at).toLocaleString('pt-PT')}</p>}
                      </div>
                    </div>
                    {!badge.resolved && (
                      <div className="flex gap-2 mt-2 ml-9">
                        <button onClick={() => {
                          markNotifRead(n.id);
                          if (corrId) setSelectedCorrectionId(corrId);
                          navigate('/admin/team?source=workers');
                          setShowNotifDropdown(false);
                        }} className="flex-1 py-1.5 text-[10px] font-black bg-amber-600 text-white rounded-lg hover:bg-amber-700 uppercase tracking-widest">Ver</button>
                        <button onClick={() => { markNotifRead(n.id); handleDismissAdminNotif(n.id); }} className="px-3 py-1.5 text-[10px] font-black bg-[var(--surface-dim)] text-[var(--slate-dim)] rounded-lg hover:bg-[var(--border)] uppercase tracking-widest">Ignorar</button>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
            {(() => {
              const appNotifs = appNotifications.filter(n => {
                if (n.target_type !== 'admin') return false;
                if (n.payload?.kind === 'submitted') return false;
                if (isRead(n)) return false;
                if (dismissedAdminNotifs.includes(n.id)) return false;
                return true;
              });
              return appNotifs.map(n => {
                if (n.payload?.kind === 'sepa_pronto') {
                  return (
                    <div key={n.id} className="px-4 py-3 hover:bg-[var(--surface)] transition-colors flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0 mt-0.5"><FileDown size={14} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-[var(--ink)]">{n.title || 'SEPA XML Pronto'}</p>
                        {n.body && <p className="text-[10px] text-[var(--slate-dim)] mt-0.5">{n.body}</p>}
                        {n.created_at && <p className="text-[9px] text-[var(--slate-dim)] mt-0.5">{new Date(n.created_at).toLocaleString('pt-PT')}</p>}
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => { markNotifRead(n.id); navigate('/admin/pagamentos/fila'); setShowNotifDropdown(false); }}
                            className="flex-1 py-1.5 text-[10px] font-black bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 uppercase tracking-widest">
                            Ver Fila
                          </button>
                          <button onClick={() => { markNotifRead(n.id); handleDismissAdminNotif(n.id); }}
                            className="px-3 py-1.5 text-[10px] font-black bg-[var(--surface-dim)] text-[var(--slate-dim)] rounded-lg hover:bg-[var(--border)] uppercase tracking-widest">
                            Ignorar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={n.id} className="px-4 py-3 hover:bg-[var(--surface)] transition-colors flex items-start gap-3">
                    <div className="p-2 rounded-xl shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(134,154,175,0.15)', color: FT.slate }}><Bell size={14} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-[var(--ink)]">{n.title || 'Notificação'}</p>
                      {(n.message || n.body) && <p className="text-[10px] text-[var(--slate-dim)] mt-0.5 truncate">{n.message || n.body}</p>}
                      {n.created_at && <p className="text-[9px] text-[var(--slate-dim)] mt-0.5">{new Date(n.created_at).toLocaleString('pt-PT')}</p>}
                    </div>
                    <button onClick={() => { markNotifRead(n.id); handleDismissAdminNotif(n.id); }} className="p-1 text-[var(--slate)] hover:text-[var(--slate-dim)] shrink-0"><X size={12} /></button>
                  </div>
                );
              });
            })()}
            {unreadCount === 0 && notificacoesDeCorrecao.filter(n => !isViewed(n)).length === 0 && (
              <div className="px-4 py-8 text-center text-[var(--slate-dim)] text-xs font-bold">Sem notificações novas</div>
            )}
          </div>
          <button onClick={() => { setActiveTab('notificacoes'); setShowNotifDropdown(false); }} className="w-full text-center text-[10px] font-black uppercase tracking-widest py-1.5 hover:bg-[var(--surface)] rounded-xl transition-colors" style={{ color: 'var(--navy)' }}>
            Ver Todas as Notificações
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
