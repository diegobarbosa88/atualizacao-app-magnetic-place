import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import EntryForm from '../../components/common/EntryForm';
import ClientTimesheetReport from '../../components/common/ClientTimesheetReport';
import { parseDeviceLabel } from '../../utils/deviceUtils';
import {
  Settings2, CheckCircle, Users, X, Zap, Plus, Trash2, Unlock,
  Settings, FileText, Sparkles, Bell, Pencil, FileDown
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
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
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
import DocumentTemplatesAdmin from '../../components/admin/DocumentTemplatesAdmin';
import NotificationsAdmin from './NotificationsAdmin';
import AdminOverview from './AdminOverview';
import AdminReports from './AdminReports';
import AdminSettings from './AdminSettings';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';
import AdminClassicNav from './AdminClassicNav';
import {
  toISODateLocal, isSameMonth
} from '../../utils/dateUtils';
import {
  formatHours, calculateDuration
} from '../../utils/formatUtils';
import { callGemini } from '../../utils/aiUtils';

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
    documents,
    setDocuments,
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

  const isRead = (n) => (n.read_by_admin_ids || []).includes(currentUser?.id) || optimisticReadIds.has(n.id);
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
  const unreadCount = workerSubmissionUnread + pendingChangeRequestsCount + pendingAbsencesCount;

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
    setOptimisticReadIds(prev => new Set([prev, id]));
    try {
      if (!currentUser?.id || !supabase) return;
      const notif = appNotifications.find(n => n.id === id);
      if (!notif) return;
      const current = notif.read_by_admin_ids || [];
      if (current.includes(currentUser.id)) return;
      await supabase.from('app_notifications')
        .update({ read_by_admin_ids: [...current, currentUser.id] })
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
    const unread = appNotifications.filter(n => !isRead(n));
    if (!unread.length) return;
    setOptimisticReadIds(prev => new Set([...prev, ...unread.map(n => n.id)]));
    Promise.all(unread.map(n => {
      const current = n.read_by_admin_ids || [];
      return supabase.from('app_notifications')
        .update({ read_by_admin_ids: [...current, currentUser.id] })
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
              <div className="flex items-center gap-3 sm:gap-6"><div className="bg-slate-900 p-3 sm:p-5 rounded-2xl sm:rounded-3xl text-white shadow-xl"><Settings2 size={28} className="sm:hidden" /><Settings2 size={40} className="hidden sm:block" /></div><div><h2 className="text-xl sm:text-3xl font-black uppercase">Audit: {auditedWorker?.name}</h2><p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Controlo Mensal Detalhado</p></div></div>
              <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-[2.5rem] border border-slate-200">
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
                <div className="bg-slate-900 text-white px-8 py-3 rounded-[2rem] shadow-lg flex flex-col items-center"><span className="text-[8px] font-black uppercase opacity-70">Total Mês</span><span className="text-xl font-black">{formatHours(auditedMonthLogs.reduce((a, b) => a + b.hours, 0))}</span></div>
                <button onClick={() => setAuditWorkerId(null)} className="p-4 bg-white text-red-500 rounded-full border border-red-100 shadow-md"><X size={28} /></button>
              </div>
            </div>
            <div className="mb-8 p-6 bg-indigo-50 rounded-3xl border border-indigo-100 relative">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-indigo-700 flex items-center gap-2"><Sparkles size={16} /> Resumo de Produtividade AI ✨</h4>
                <button onClick={generateWorkerSummary} disabled={isSummarizing || auditedMonthLogs.length === 0} className="text-[10px] bg-indigo-600 text-white px-4 py-1.5 rounded-full font-black uppercase">{isSummarizing ? "Gerando..." : "Gerar com IA"}</button>
              </div>
              <p className="text-sm text-slate-600 italic leading-relaxed">{workerAISummary || "Utilize o Gemini para resumir as atividades deste mês."}</p>
            </div>
            <div className="overflow-x-auto rounded-[3rem] border border-slate-100 bg-white shadow-inner"><table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100"><tr><th className="px-4 sm:px-10 py-4 sm:py-6 text-[10px] font-black uppercase tracking-widest w-16 sm:w-32">Dia</th><th className="px-4 sm:px-10 py-4 sm:py-6 text-[10px] font-black uppercase tracking-widest">Actividades</th><th className="px-4 sm:px-10 py-4 sm:py-6 text-[10px] font-black uppercase tracking-widest text-right">Acção</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
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

      {!auditWorkerId && activeTab === 'documentos' && (
        <DocumentsAdmin workers={workers} documents={documents} setDocuments={setDocuments} systemSettings={systemSettings} />
      )}

      {!auditWorkerId && activeTab === 'notificacoes' && (
        <NotificationsAdmin workers={workers} appNotifications={appNotifications} saveToDb={saveToDb} handleDelete={handleDelete} supabase={supabase} />
      )}

{!auditWorkerId && activeTab === 'settings' && (
        <AdminSettings />
      )}
    </>
  );

  const navMode = systemSettings?.navMode || 'sidebar';

  return (
    <div className={`min-h-screen bg-slate-50 font-sans text-slate-900 ${navMode === 'topbar' ? '' : 'flex'}`}>
      {navMode === 'topbar' ? (
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
      ) : (
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
      )}

      {navMode === 'topbar' ? (
        <main className="px-3 sm:px-6 md:px-10 lg:px-16 py-4 sm:py-6 overflow-x-hidden">
          {tabContent}
        </main>
      ) : (
        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          <AdminTopbar
            activeTab={activeTab}
            unreadCount={unreadCount}
            onToggleNotifDropdown={() => setShowNotifDropdown(s => !s)}
            onOpenFinReport={() => setShowFinReport(true)}
            onLogout={onLogout}
            onSwitchToWorker={currentUser?.isAdmin ? () => onLogin('worker', currentUser) : null}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            showBackToTeam={!!auditWorkerId}
            onBackToTeam={() => setAuditWorkerId(null)}
          />
          <main className="flex-1 overflow-x-hidden">
            <div className="px-3 sm:px-6 md:px-10 lg:px-16 py-4 sm:py-6">
              {tabContent}
            </div>
          </main>
        </div>
      )}

      {showNotifDropdown && (
        <div ref={notifDropdownRef} className="fixed top-[4.5rem] right-3 sm:right-6 z-[200] w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Notificações</h3>
            <button onClick={() => setShowNotifDropdown(false)} className="p-1 text-slate-300 hover:text-slate-600 transition-colors"><X size={14} /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-50">
            {notificacoesDeCorrecao.filter(n => !isViewed(n)).map(corr => {
              const client = clients.find(c => String(c.id) === String(corr.client_id));
              return (
                <button key={corr.id} onClick={() => { markCorrectionsViewed([corr.id]); navigate('/admin/clients?source=clients'); setShowNotifDropdown(false); }} className="w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-orange-100 text-orange-600 shrink-0 mt-0.5"><FileText size={14} /></div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[8px] font-black uppercase tracking-widest text-orange-500 block">Report de Cliente</span>
                    <p className="text-xs font-black text-slate-800 truncate">{client?.name || 'Cliente'}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Mês <span className="font-bold">{corr.month}</span></p>
                    {corr.submitted_at && <p className="text-[9px] text-slate-400 mt-0.5">{new Date(corr.submitted_at).toLocaleString('pt-PT')}</p>}
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
                    <p className="text-xs font-black text-slate-800 truncate">{worker?.name || 'Trabalhador'}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Campo: <span className="font-bold">{req.field_label}</span></p>
                    <p className="text-[9px] text-slate-400 mt-0.5">{new Date(req.created_at).toLocaleString('pt-PT')}</p>
                  </div>
                </button>
              );
            })}
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
                      <p className="text-xs font-black text-slate-800 truncate">{client?.name || corr?.client_id || 'Cliente'}</p>
                      {corr?.month && <p className="text-[10px] text-slate-500 mt-0.5">Mês <span className="font-bold">{corr.month}</span></p>}
                      {n.created_at && <p className="text-[9px] text-slate-400 mt-0.5">{new Date(n.created_at).toLocaleString('pt-PT')}</p>}
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
                  <div key={n.id} className={`px-4 py-3 ${badge.resolved ? 'bg-slate-50' : 'hover:bg-indigo-50'} transition-colors`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${badge.resolved ? 'bg-slate-100 text-slate-400' : 'bg-indigo-100 text-indigo-600'}`}><FileText size={14} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[8px] font-black uppercase tracking-widest block ${badge.resolved ? 'text-slate-400' : 'text-indigo-500'}`}>Submissão Trabalhador</span>
                          {badge.resolved && <span className="text-[8px] font-black text-slate-400">{badge.label}</span>}
                        </div>
                        <p className="text-xs font-black text-slate-800 truncate">{worker?.name || workerNameFallback}</p>
                        {corr?.month && <p className="text-[10px] text-slate-500 mt-0.5">Mês <span className="font-bold">{corr.month}</span></p>}
                        {n.created_at && <p className="text-[9px] text-slate-400 mt-0.5">{new Date(n.created_at).toLocaleString('pt-PT')}</p>}
                      </div>
                    </div>
                    {!badge.resolved && (
                      <div className="flex gap-2 mt-2 ml-9">
                        <button onClick={() => {
                          markNotifRead(n.id);
                          if (corrId) setSelectedCorrectionId(corrId);
                          navigate('/admin/team?source=workers');
                          setShowNotifDropdown(false);
                        }} className="flex-1 py-1.5 text-[10px] font-black bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 uppercase tracking-widest">Ver</button>
                        <button onClick={() => { markNotifRead(n.id); handleDismissAdminNotif(n.id); }} className="px-3 py-1.5 text-[10px] font-black bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 uppercase tracking-widest">Ignorar</button>
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
                    <div key={n.id} className="px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0 mt-0.5"><FileDown size={14} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-800">{n.title || 'SEPA XML Pronto'}</p>
                        {n.body && <p className="text-[10px] text-slate-500 mt-0.5">{n.body}</p>}
                        {n.created_at && <p className="text-[9px] text-slate-400 mt-0.5">{new Date(n.created_at).toLocaleString('pt-PT')}</p>}
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => { markNotifRead(n.id); navigate('/admin/documentos/pagamentos/fila'); setShowNotifDropdown(false); }}
                            className="flex-1 py-1.5 text-[10px] font-black bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 uppercase tracking-widest">
                            Ver Fila
                          </button>
                          <button onClick={() => { markNotifRead(n.id); handleDismissAdminNotif(n.id); }}
                            className="px-3 py-1.5 text-[10px] font-black bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 uppercase tracking-widest">
                            Ignorar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={n.id} className="px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-500 shrink-0 mt-0.5"><Bell size={14} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-slate-800">{n.title || 'Notificação'}</p>
                      {n.body && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{n.body}</p>}
                      {n.created_at && <p className="text-[9px] text-slate-400 mt-0.5">{new Date(n.created_at).toLocaleString('pt-PT')}</p>}
                    </div>
                    <button onClick={() => { markNotifRead(n.id); handleDismissAdminNotif(n.id); }} className="p-1 text-slate-300 hover:text-slate-500"><X size={12} /></button>
                  </div>
                );
              });
            })()}
            {unreadCount === 0 && notificacoesDeCorrecao.filter(n => !isViewed(n)).length === 0 && (
              <div className="px-4 py-8 text-center text-slate-400 text-xs font-bold">Sem notificações novas</div>
            )}
          </div>
          <button onClick={() => { setActiveTab('notificacoes'); setShowNotifDropdown(false); }} className="w-full text-center text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest py-1.5 hover:bg-indigo-50 rounded-xl transition-colors">
            Ver Todas as Notificações
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
