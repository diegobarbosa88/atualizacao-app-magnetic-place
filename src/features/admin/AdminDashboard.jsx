import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import CompanyLogo from '../../components/common/CompanyLogo';
import EntryForm from '../../components/common/EntryForm';
import ClientTimesheetReport from '../../components/common/ClientTimesheetReport';
import CompanyValidationStamp from '../../components/common/CompanyValidationStamp';
import CompanyClassicStamp from '../../components/common/CompanyClassicStamp';
import CompanyCorporateStamp from '../../components/common/CompanyCorporateStamp';
import ValidationStampAdmin from '../../components/common/ValidationStampAdmin';
import { parseDeviceLabel } from '../../utils/deviceUtils';
import {
  LayoutGrid, Clock, TrendingUp, TrendingDown, Wallet, Trophy, History, Printer,
  Activity, FileText, BarChart3, Settings2, Sparkles, CheckCircle, Users, Download,
  X, ChevronLeft, ChevronRight, LogOut, Zap, Plus, Trash2, Unlock,
  Building2, Palette, Lock, Settings, FileSignature, Upload, Loader2, PenTool, UserPlus, ShieldCheck, ShieldOff, Bell
} from 'lucide-react';
import TeamManager from './TeamManager';
import ClientManager from './ClientManager';
import ScheduleManager from './ScheduleManager';
import CostReports from './CostReports';
import ValidationPortal from './ValidationPortal';
import { ValidationPortalProvider } from './contexts/ValidationPortalContext';
import DocumentsAdmin from './DocumentsAdmin';
import DocumentTemplatesAdmin from '../../components/admin/DocumentTemplatesAdmin';
import NotificationsAdmin from './NotificationsAdmin';
import {
  toISODateLocal, isSameMonth
} from '../../utils/dateUtils';
import {
  formatHours, formatCurrency, calculateDuration
} from '../../utils/formatUtils';
import { callGemini } from '../../utils/aiUtils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function AdminDashboard(props) {
  const {
    onLogout,
    onLogin,
    currentUser,
    currentMonth,
    setCurrentMonth,
    activeTab,
    setActiveTab,
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
    portalSubTab,
    setPortalSubTab,
    portalMonth,
    setPortalMonth,
    setModalRejeitarAberto,
    setRejeitarMotivo,
    setRejeitarNotif
  } = props;

  const { adminStats, clients, workers, schedules, expenses, appNotifications, workerChangeRequests, saveToDb, setSystemSettings, saveSystemSettings, supabase, companySignature, saveCompanySignature } = useApp();
  const updateSetting = (key, value) => saveSystemSettings({ ...systemSettings, [key]: value });

  const notificacoesDeCorrecao = correctionNotifications;


  const [adminFormMode, setAdminFormMode] = useState(null); // null | 'new' | 'existing' | 'edit'
  const [adminForm, setAdminForm] = useState({ id: null, name: '', nif: '', selectedWorkerId: '' });

  const nonAdminWorkers = workers.filter(w => !w.isAdmin);

  const handleOpenAddAdmin = () => {
    setAdminForm({ id: null, name: '', nif: '', selectedWorkerId: '' });
    setAdminFormMode('new');
  };

  const handleSelectExistingWorker = (workerId) => {
    const w = workers.find(x => x.id === workerId);
    if (!w) return;
    setAdminForm({ id: w.id, name: w.name, nif: w.nif || '', selectedWorkerId: workerId });
    setAdminFormMode('existing');
  };

  const handleEditAdmin = (worker) => {
    setAdminForm({ id: worker.id, name: worker.name, nif: worker.nif || '', selectedWorkerId: worker.id });
    setAdminFormMode('edit');
  };

  const handleSaveAdmin = async () => {
    if (!adminForm.name.trim() || !adminForm.nif.trim()) return alert('Nome e senha são obrigatórios.');
    if (adminFormMode === 'edit' || adminFormMode === 'existing') {
      const existing = workers.find(w => w.id === adminForm.id);
      await saveToDb('workers', adminForm.id, { ...existing, name: adminForm.name.trim(), nif: adminForm.nif.trim(), isAdmin: true });
    } else {
      const id = `worker_${Date.now()}`;
      await saveToDb('workers', id, { id, name: adminForm.name.trim(), nif: adminForm.nif.trim(), isAdmin: true, status: 'ativo', assignedClients: [], assignedSchedules: [] });
    }
    setAdminFormMode(null);
    setAdminForm({ id: null, name: '', nif: '', selectedWorkerId: '' });
  };

  const handleRevokeAdmin = async (worker) => {
    await saveToDb('workers', worker.id, { ...worker, isAdmin: false });
  };

  const [readNotifIds, setReadNotifIds] = useState(() => {
    if (!currentUser?.id) return [];
    try { return JSON.parse(localStorage.getItem(`admin_read_notifs_${currentUser.id}`) || '[]'); }
    catch { return []; }
  });
  const [viewedCorrections, setViewedCorrections] = useState(() => {
    const saved = localStorage.getItem('magnetic_viewed_corrections');
    return saved ? JSON.parse(saved) : [];
  });
  useEffect(() => {
    localStorage.setItem('magnetic_viewed_corrections', JSON.stringify(viewedCorrections));
  }, [viewedCorrections]);

  const pendingChangeRequests = (workerChangeRequests || []).filter(r => r.status === 'pending');
  const pendingChangeRequestsCount = pendingChangeRequests.length;
  const unviewedCorrectionsCount = notificacoesDeCorrecao.filter(n => !viewedCorrections.includes(n.id)).length;
  const unreadCount = appNotifications.filter(n => !readNotifIds.includes(n.id)).length + pendingChangeRequestsCount + unviewedCorrectionsCount;

  useEffect(() => {
    if (activeTab !== 'notificacoes' || !currentUser?.id || !appNotifications.length) return;
    const allIds = appNotifications.map(n => n.id);
    setReadNotifIds(prev => {
      const merged = [...new Set([...prev, ...allIds])];
      localStorage.setItem(`admin_read_notifs_${currentUser.id}`, JSON.stringify(merged));
      return merged;
    });
  }, [activeTab, currentUser?.id, appNotifications]);

  useEffect(() => {
    if (activeTab === 'portal_validacao' && portalSubTab === 'correcoes' && notificacoesDeCorrecao.length > 0) {
      setViewedCorrections(prev => {
        const newIds = notificacoesDeCorrecao.map(n => n.id).filter(id => !prev.includes(id));
        if (newIds.length === 0) return prev;
        return [...prev, ...newIds];
      });
    }
  }, [activeTab, portalSubTab, notificacoesDeCorrecao]);

  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
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

  const markNotifRead = (id) => {
    setReadNotifIds(prev => {
      const merged = [...new Set([...prev, id])];
      if (currentUser?.id) localStorage.setItem(`admin_read_notifs_${currentUser.id}`, JSON.stringify(merged));
      return merged;
    });
  };
  const markCorrectionsViewed = () => {
    setViewedCorrections(prev => {
      const allIds = notificacoesDeCorrecao.map(n => n.id);
      return [...new Set([...prev, ...allIds])];
    });
  };

  const [workerAISummary, setWorkerAISummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [reportFilter, setReportFilter] = useState({ clientId: '', workerId: '', month: toISODateLocal(new Date()).substring(0, 7) });
  const [valSortConfig, setValSortConfig] = useState({ key: 'name', direction: 'asc' });

  const auditedWorker = workers.find(w => w.id === auditWorkerId);
  const auditedMonthLogs = logs.filter(l => l.workerId === auditWorkerId && isSameMonth(l.date, currentMonth));
  const daysInMonthList = useMemo(() => Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }, (_, i) => toISODateLocal(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1))), [currentMonth]);
  const currentMonthStr = toISODateLocal(currentMonth).substring(0, 7);
  const portalMonthStr = toISODateLocal(portalMonth).substring(0, 7);

  const allClientsValidated = useMemo(() => {
    if (clients.length === 0) return false;
    return clients.every(c => {
      const approval = clientApprovals?.find(a => (String(a.client_id || a.clientId || '') === String(c.id)) && a.month === portalMonthStr);
      const hasEmail = c.status_email === `enviado_${portalMonthStr}`;
      return approval || hasEmail;
    });
  }, [clients, clientApprovals, portalMonthStr]);

  const [showAllActivity, setShowAllActivity] = useState(false);

  // Calculate working days in month
  const getWorkingDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    let count = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const day = new Date(year, month, i).getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  };

  // Calculate expected hours per worker based on their schedule
  const getWorkerExpectedHours = (workerId) => {
    const worker = workers.find(w => w.id === workerId);
    if (!worker?.defaultScheduleId) return 0;
    const schedule = schedules.find(s => s.id === worker.defaultScheduleId);
    if (!schedule) return 0;
    const hoursPerDay = calculateDuration(schedule.startTime, schedule.endTime, schedule.breakStart, schedule.breakEnd);
    const workingDays = getWorkingDaysInMonth(currentMonth);
    return hoursPerDay * workingDays;
  };

  // Aggregated trend vs expected
  const aggregatedTrend = useMemo(() => {
    const totalExpected = workers.reduce((sum, w) => sum + getWorkerExpectedHours(w.id), 0);
    const totalRegistered = adminStats.totalHours;
    if (totalExpected === 0) return { percent: 0, expected: 0 };
    return {
      percent: ((totalRegistered - totalExpected) / totalExpected * 100).toFixed(1),
      expected: totalExpected
    };
  }, [workers, schedules, currentMonth, adminStats.totalHours]);

  // Dia de corte proporcional: dia de hoje no mês atual
  const todayDay = new Date().getDate();

  // Filtra logs do mês anterior até ao mesmo dia do mês de hoje
  const filterPrevMonthProportional = (allLogs, prevMonth) =>
    allLogs.filter(l => {
      if (!isSameMonth(l.date, prevMonth)) return false;
      const d = new Date(l.date.split('T')[0]);
      return d.getDate() <= todayDay;
    });

  // Stats do mês anterior (proporcional ao dia atual)
  const prevMonthStats = useMemo(() => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const prevLogs = filterPrevMonthProportional(logs, prevMonth);
    const totalHours = prevLogs.reduce((acc, l) => acc + (Number(l.hours) || 0), 0);
    let expectedRevenue = 0;
    let expectedCosts = 0;
    prevLogs.forEach(l => {
      const client = clients.find(c => c.id === l.clientId);
      const worker = workers.find(w => w.id === l.workerId);
      if (client) expectedRevenue += l.hours * (Number(client.valorHora) || 0);
      if (worker) expectedCosts += l.hours * (Number(worker.valorHora) || 0);
    });
    const prevMonth2 = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const monthlyExpenses = expenses
      .filter(e => {
        if (!isSameMonth(e.date, prevMonth2)) return false;
        const d = new Date(e.date.split('T')[0]);
        return d.getDate() <= todayDay;
      })
      .reduce((a, b) => a + Number(b.amount), 0);
    return {
      totalHours,
      expectedRevenue,
      expectedCosts,
      monthlyExpenses,
      netProfit: expectedRevenue - expectedCosts - monthlyExpenses
    };
  }, [logs, currentMonth, clients, workers, expenses]);

  // Variações % vs mês anterior (proporcional)
  const vsLastMonth = useMemo(() => {
    const pct = (curr, prev) => {
      if (prev === 0) return null;
      return Number(((curr - prev) / Math.abs(prev) * 100).toFixed(1));
    };
    return {
      hours: pct(adminStats.totalHours, prevMonthStats.totalHours),
      revenue: pct(adminStats.expectedRevenue, prevMonthStats.expectedRevenue),
      costs: pct(adminStats.expectedCosts + adminStats.monthlyExpenses, prevMonthStats.expectedCosts + prevMonthStats.monthlyExpenses),
      profit: pct(adminStats.netProfit, prevMonthStats.netProfit)
    };
  }, [adminStats, prevMonthStats]);

  // Worker comparison data
  const workerComparisonData = useMemo(() => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    return workers
      .map(w => {
        const workerLogs = logs.filter(l => l.workerId === w.id && isSameMonth(l.date, currentMonth));
        const prevWorkerLogs = filterPrevMonthProportional(logs.filter(l => l.workerId === w.id), prevMonth);
        const registered = workerLogs.reduce((sum, l) => sum + (l.hours || 0), 0);
        const prevRegistered = prevWorkerLogs.reduce((sum, l) => sum + (l.hours || 0), 0);
        const expected = getWorkerExpectedHours(w.id);
        const percent = expected > 0 ? (registered / expected * 100).toFixed(1) : 0;
        const prevPct = prevRegistered > 0
          ? Number(((registered - prevRegistered) / prevRegistered * 100).toFixed(1))
          : null;
        return {
          id: w.id,
          name: w.name,
          registered,
          prevRegistered,
          expected,
          percent,
          prevPct,
          isOver: registered >= expected
        };
      })
      .filter(w => w.registered > 0 || w.expected > 0)
      .sort((a, b) => b.percent - a.percent);
  }, [workers, logs, schedules, currentMonth]);

  // Area chart data - daily revenue
  const areaData = useMemo(() => {
    if (!logs.length || !adminStats.totalHours) return [];
    const byDay = {};
    logs.forEach(l => {
      if (l.date && l.hours) {
        const day = l.date.split('T')[0];
        byDay[day] = (byDay[day] || 0) + l.hours;
      }
    });
    return Object.entries(byDay)
      .map(([date, hours]) => ({
        date: date.slice(5).replace('-', '/'),
        horas: Number(hours.toFixed(1)),
        valor: adminStats.totalHours > 0
          ? Number(((hours / adminStats.totalHours) * adminStats.expectedRevenue).toFixed(2))
          : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, adminStats]);

  // Pie chart data
  const pieData = [
    { name: 'Operacionais', value: adminStats.expectedCosts, color: '#6366f1' },
    { name: 'Fixos', value: adminStats.monthlyExpenses, color: '#f43f5e' }
  ];

  // Top clientes com comparação proporcional vs mês anterior
  const topClientsWithPrev = useMemo(() => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const currHours = {};
    const prevHours = {};
    logs.forEach(l => {
      if (!l.clientId || !l.hours) return;
      if (isSameMonth(l.date, currentMonth)) {
        currHours[l.clientId] = (currHours[l.clientId] || 0) + l.hours;
      } else if (isSameMonth(l.date, prevMonth)) {
        const d = new Date(l.date.split('T')[0]);
        if (d.getDate() <= todayDay) {
          prevHours[l.clientId] = (prevHours[l.clientId] || 0) + l.hours;
        }
      }
    });
    const totalCurr = Object.values(currHours).reduce((a, b) => a + b, 0);
    return Object.keys(currHours)
      .map(id => {
        const curr = currHours[id];
        const prev = prevHours[id] || 0;
        const pct = prev > 0 ? Number(((curr - prev) / prev * 100).toFixed(1)) : null;
        return {
          id,
          name: clients.find(c => c.id === id)?.name || 'Desconhecido',
          hours: curr,
          prevHours: prev,
          pct,
          totalCurr
        };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
  }, [logs, currentMonth, clients, todayDay]);

  const parseLogDate = (d) => {
    if (!d) return 0;
    const ptMatch = d.match(/^(\d{2})\/(\d{2})/);
    if (ptMatch) {
      return new Date(`${new Date().getFullYear()}-${ptMatch[2]}-${ptMatch[1]}`).getTime();
    }
    const [y, m, day] = d.split('T')[0].split('-');
    return y && m && day ? new Date(`${y}-${m}-${day}`).getTime() : 0;
  };

  const formatLogDate = (d) => {
    if (!d) return 'Data inválida';
    const ptMatch = d.match(/^(\d{2})\/(\d{2})/);
    if (ptMatch) return `${ptMatch[1]}/${ptMatch[2]}`;
    const [y, m, day] = d.split('T')[0].split('-');
    return (y && m && day) ? `${day}/${m}/${y}` : 'Data inválida';
  };


  const [inlineEditingDate, setInlineEditingDate] = useState(null);
  const [inlineFormData, setInlineFormData] = useState({});
  const [reportHistory, setReportHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('reportHistory') || '[]'); } catch { return []; }
  });

  const activeReportsCount = useMemo(() => {
    if (!reportFilter.month) return 0;
    return logs.filter(l => l.date?.startsWith(reportFilter.month)).length;
  }, [logs, reportFilter.month]);

  const activeClientsCount = useMemo(() => {
    if (!reportFilter.month) return clients.length;
    return [...new Set(logs.filter(l => l.date?.startsWith(reportFilter.month)).map(l => l.clientId))].length;
  }, [logs, reportFilter.month, clients]);

  const activeWorkersCount = useMemo(() => {
    if (!reportFilter.month) return workers.filter(w => w.is_active !== false).length;
    return [...new Set(logs.filter(l => l.date?.startsWith(reportFilter.month)).map(l => l.workerId))].length;
  }, [logs, reportFilter.month, workers]);

  const handleOpenInlineForm = (ds) => {
    setInlineEditingDate(ds);
    setInlineFormData({ id: null, date: ds, clientId: auditedWorker?.defaultClientId || '', startTime: '', breakStart: '', breakEnd: '', endTime: '', description: '' });
  };

  const handleQuickRegister = (ds) => {
    // Legacy logic reference - needs to be handled via proper schedule selection in future refactor
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

  // Derivado reactivo: enriquece o snapshot leve de `printingReport` com os arrays vivos do AppContext.
  // Sem isto, aplicar uma correção enquanto o modal está aberto mostraria dados antigos.
  const reportData = useMemo(() => {
    if (!printingReport) return null;
    return { ...printingReport, logs, workers, clients, clientApprovals };
  }, [printingReport, logs, workers, clients, clientApprovals]);

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans text-slate-900">
      <nav className="bg-white border-b border-slate-200 min-h-[4rem] sticky top-0 z-40 shadow-sm py-3 px-4 md:px-0">
        <div className="mx-auto md:px-10 lg:px-16 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-6" style={{ maxWidth: `var(--app-max-width)` }}>
          {/* Lado Esquerdo: Logo */}
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3 font-black text-xl tracking-tighter uppercase shrink-0">
              <CompanyLogo className="h-8 w-8" />
              <span className="hidden md:inline">{systemSettings.companyName}</span>
            </div>
            {/* Mobile Actions */}
            <div className="flex md:hidden items-center gap-2">
              <button data-notif-bell onClick={() => setShowNotifDropdown(s => !s)} className="flex items-center justify-center p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 relative">
                <Bell size={18} />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
              </button>
              {currentUser?.isAdmin && <button onClick={() => onLogin('worker', currentUser)} className="flex items-center justify-center p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100"><Users size={18} /></button>}
              <button onClick={() => setShowFinReport(true)} className="flex items-center justify-center p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100"><BarChart3 size={18} /></button>
              <button onClick={onLogout} className="p-2 text-slate-400"><LogOut size={18} /></button>
            </div>
          </div>

          {/* Centro: Menu de Navegação */}
          <div className="flex-1 flex justify-center w-full md:w-auto">
            <div className="flex menu-scroll w-full md:w-auto items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto" style={{ scrollbarWidth: 'thin', msOverflowStyle: 'auto' }}>
              {['overview', 'team', 'clients', 'portal_validacao', 'schedules', 'documentos', 'costs', 'settings'].map(t => (
                <button key={t} onClick={() => { setActiveTab(t); setAuditWorkerId(null); }} className={`flex-shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === t ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'} ${t === 'portal_validacao' && unviewedCorrectionsCount > 0 ? 'animate-pulse' : ''}`}>
                  {t === 'overview' ? 'Geral' : t === 'team' ? 'Equipa' : t === 'clients' ? 'Clientes' : t === 'portal_validacao' ? (
                    <span className="flex items-center gap-1">Portal Validação {unviewedCorrectionsCount > 0 && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{unviewedCorrectionsCount}</span>}</span>
                  ) : t === 'schedules' ? 'Horários' : t === 'costs' ? 'Custos' : t === 'documentos' ? 'Documentos' : <Settings size={14} />}
                </button>
              ))}
            </div>
          </div>

          {/* Lado Direito: Ações */}
          <div className="hidden md:flex items-center gap-4 shrink-0">
            <button data-notif-bell onClick={() => setShowNotifDropdown(s => !s)} className="flex items-center justify-center p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm relative"><Bell size={18} /> {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{unreadCount}</span>}</button>
            <button onClick={() => setShowFinReport(true)} className="flex items-center justify-center p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><BarChart3 size={18} /></button>
            {currentUser?.isAdmin && <button onClick={() => onLogin('worker', currentUser)} className="flex items-center justify-center p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Users size={18} /></button>}
            <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
          </div>
        </div>
      </nav>

      {showNotifDropdown && (
        <div ref={notifDropdownRef} className="fixed top-[4.5rem] right-3 sm:right-6 z-[200] w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Notificações</h3>
            <button onClick={() => setShowNotifDropdown(false)} className="p-1 text-slate-300 hover:text-slate-600 transition-colors"><X size={14} /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-50">
            {/* Correções de clientes — laranja */}
            {notificacoesDeCorrecao.filter(n => !viewedCorrections.includes(n.id)).map(corr => {
              const client = clients.find(c => String(c.id) === String(corr.client_id));
              return (
                <button key={corr.id} onClick={() => { markCorrectionsViewed(); setActiveTab('portal_validacao'); setPortalSubTab('correcoes'); setShowNotifDropdown(false); }} className="w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors flex items-start gap-3">
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
            {/* Pedidos de alteração de dados — âmbar */}
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
            {/* Notificações gerais — cor por tipo */}
            {appNotifications.filter(n => !readNotifIds.includes(n.id)).map(notif => {
              const styles = notif.type === 'urgent'
                ? { hover: 'hover:bg-rose-50', icon: 'bg-rose-100 text-rose-600', label: 'text-rose-500', tag: 'Urgente' }
                : notif.type === 'warning'
                ? { hover: 'hover:bg-yellow-50', icon: 'bg-yellow-100 text-yellow-600', label: 'text-yellow-500', tag: 'Aviso' }
                : notif.type === 'success'
                ? { hover: 'hover:bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', label: 'text-emerald-500', tag: 'Sucesso' }
                : { hover: 'hover:bg-indigo-50', icon: 'bg-indigo-100 text-indigo-600', label: 'text-indigo-500', tag: 'Informação' };
              return (
                <button key={notif.id} onClick={() => { markNotifRead(notif.id); setActiveTab('notificacoes'); setShowNotifDropdown(false); }} className={`w-full text-left px-4 py-3 ${styles.hover} transition-colors flex items-start gap-3`}>
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${styles.icon}`}>
                    <Bell size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={`text-[8px] font-black uppercase tracking-widest ${styles.label} block`}>{styles.tag}</span>
                    <p className="text-xs font-black text-slate-800 truncate">{notif.title}</p>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{notif.message}</p>
                  </div>
                </button>
              );
            })}
            {unreadCount === 0 && (
              <div className="px-4 py-8 text-center">
                <Bell size={24} className="text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Sem notificações por ler</p>
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 p-2">
            <button onClick={() => { setActiveTab('notificacoes'); setShowNotifDropdown(false); }} className="w-full text-center text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest py-1.5 hover:bg-indigo-50 rounded-xl transition-colors">
              Ver todas as notificações →
            </button>
          </div>
        </div>
      )}

      <main className="w-full mt-4 pb-12">
        <div className="mx-auto px-3 sm:px-6 md:px-10 lg:px-16" style={{ maxWidth: `var(--app-max-width)` }}>


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
                                    <div className="flex items-center gap-4">
                                      <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl uppercase border border-indigo-100">{clients.find(c => c.id === log.clientId)?.name}</span>
                                      <div className="text-sm font-bold font-mono">{log.startTime}-{log.endTime} {log.breakStart ? `(P: ${log.breakStart})` : ''}</div>
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
            <div className="animate-in fade-in duration-500 space-y-4 sm:space-y-6 lg:space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 sm:mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><LayoutGrid size={20} /></div>
                  <h3 className="font-black text-base sm:text-xl text-slate-800 uppercase tracking-tight">Dashboard Geral</h3>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><ChevronLeft size={16} /></button>
                  <span className="font-bold text-sm uppercase tracking-widest text-indigo-600 min-w-[120px] text-center">
                    {currentMonth.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}
                  </span>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><ChevronRight size={16} /></button>
                </div>
              </div>

              {/* KPI Cards Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                {/* Horas Totais */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2 sm:gap-3">
                  <div className="flex justify-between items-start">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl"><Clock size={24} /></div>
                    {vsLastMonth.hours !== null && vsLastMonth.hours !== 0 && (
                      <span className={`text-[10px] font-black px-2 py-1 rounded-full ${vsLastMonth.hours >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {vsLastMonth.hours >= 0 ? '▲' : '▼'} {Math.abs(vsLastMonth.hours)}%
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xl sm:text-3xl font-black text-slate-800">{formatHours(adminStats.totalHours)}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatHours(aggregatedTrend.expected)} Esperadas</p>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Horas Totais</p>
                </div>

                {/* Faturação */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2 sm:gap-3">
                  <div className="flex justify-between items-start">
                    <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl"><TrendingUp size={24} /></div>
                    {vsLastMonth.revenue !== null && vsLastMonth.revenue !== 0 && (
                      <span className={`text-[10px] font-black px-2 py-1 rounded-full ${vsLastMonth.revenue >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {vsLastMonth.revenue >= 0 ? '▲' : '▼'} {Math.abs(vsLastMonth.revenue)}%
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xl sm:text-3xl font-black text-slate-800">{formatCurrency(adminStats.expectedRevenue)}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimada</p>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Faturação</p>
                </div>

                {/* Custos */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2 sm:gap-3">
                  <div className="flex justify-between items-start">
                    <div className="bg-rose-50 text-rose-600 p-3 rounded-2xl"><TrendingDown size={24} /></div>
                    {vsLastMonth.costs !== null && vsLastMonth.costs !== 0 && (
                      <span className={`text-[10px] font-black px-2 py-1 rounded-full ${vsLastMonth.costs <= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {vsLastMonth.costs >= 0 ? '▲' : '▼'} {Math.abs(vsLastMonth.costs)}%
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xl sm:text-3xl font-black text-slate-800">{formatCurrency(adminStats.expectedCosts + adminStats.monthlyExpenses)}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operacionais + Fixos</p>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custos Globais</p>
                </div>

                {/* Resultado Líquido */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-xl flex flex-col gap-2 sm:gap-3 text-white">
                  <div className="flex justify-between items-start">
                    <div className="bg-white/20 p-3 rounded-2xl"><Wallet size={24} /></div>
                    {vsLastMonth.profit !== null && vsLastMonth.profit !== 0 && (
                      <span className={`text-[10px] font-black px-2 py-1 rounded-full ${vsLastMonth.profit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {vsLastMonth.profit >= 0 ? '▲' : '▼'} {Math.abs(vsLastMonth.profit)}%
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xl sm:text-3xl font-black">{formatCurrency(adminStats.netProfit)}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Líquido</p>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resultado</p>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {/* Area Chart - 2/3 */}
                <div className="lg:col-span-2 bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><TrendingUp size={20} /></div>
                    <h3 className="font-black text-lg text-slate-800">Fluxo de Faturamento Diário</h3>
                  </div>
                  {areaData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={areaData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `€${v}`} />
                        <Tooltip
                          contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(value) => [`€${value}`, 'Faturamento']}
                        />
                        <Area type="monotone" dataKey="valor" stroke="#6366f1" strokeWidth={2} fill="url(#colorValor)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
                      Sem dados de faturação para exibir
                    </div>
                  )}
                </div>

                {/* Pie Chart - 1/3 */}
                <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-rose-50 p-2 rounded-xl text-rose-600"><TrendingDown size={20} /></div>
                    <h3 className="font-black text-lg text-slate-800">Composição de Gastos</h3>
                  </div>
                  {pieData[0].value + pieData[1].value > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : null}
                  <div className="space-y-3 mt-4">
                    {pieData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-xs font-bold text-slate-600">{item.name}</span>
                        </div>
                        <span className="text-xs font-black text-slate-800">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Worker Comparison */}
              <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Activity size={20} /></div>
                  <h3 className="font-black text-lg text-slate-800">Comparativo por Trabalhador</h3>
                </div>
                <div className="space-y-3">
                  {workerComparisonData.length > 0 ? workerComparisonData.map((w) => (
                    <div key={w.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-bold text-slate-700 truncate">{w.name}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[10px] font-black text-slate-400">{formatHours(w.registered)} / {formatHours(w.expected)}</span>
                            {w.prevPct !== null ? (
                              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${w.prevPct >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {w.prevPct >= 0 ? '▲' : '▼'} {Math.abs(w.prevPct)}%
                              </span>
                            ) : (
                              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${w.isOver ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {w.isOver ? '▲' : '▼'} {Math.abs(w.percent)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${w.isOver ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.min(100, w.percent)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-xs text-slate-400 italic text-center py-8">Sem dados de trabalhadores este mês.</p>
                  )}
                </div>
              </div>

              {/* Bottom Row: Top Units + Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                {/* Top Units */}
                <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-amber-50 p-2 rounded-xl text-amber-600"><Trophy size={20} /></div>
                    <h3 className="font-black text-lg text-slate-800">Top Unidades (Horas)</h3>
                  </div>
                  <div className="space-y-4">
                    {topClientsWithPrev.length > 0 ? topClientsWithPrev.map((c, i) => (
                      <div key={c.id} className="flex items-center justify-between group">
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-700">{c.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              {c.pct !== null && c.pct !== 0 && (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.pct >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                  {c.pct >= 0 ? '▲' : '▼'} {Math.abs(c.pct)}%
                                </span>
                              )}
                              <span className="text-xs font-black text-indigo-600">{formatHours(c.hours)}</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-50 rounded-full h-2">
                            <div className="bg-indigo-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (c.hours / c.totalCurr) * 100)}%` }}></div>
                          </div>
                        </div>
                      </div>
                    )) : <p className="text-xs text-slate-400 italic">Sem dados de clientes registados este mês.</p>}
                  </div>
                </div>

                {/* Activity Recente */}
                <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-blue-50 p-2 rounded-xl text-blue-600"><History size={20} /></div>
                    <h3 className="font-black text-lg text-slate-800">Atividade Recente</h3>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {logs.slice().sort((a, b) => parseLogDate(b.date) - parseLogDate(a.date) || b.id.localeCompare(a.id)).slice(0, showAllActivity ? undefined : 5).map(log => (
                      <div key={log.id} className="flex gap-3 items-start p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                        <div className="bg-slate-100 p-2 rounded-xl text-slate-400 mt-0.5"><Activity size={12} /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">{workers.find(w => w.id === log.workerId)?.name || 'Colaborador'}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest">{clients.find(c => c.id === log.clientId)?.name} • {formatLogDate(log.date)}</p>
                        </div>
                        <div className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg shrink-0">
                          {formatHours(Number(log.hours) || 0)}
                        </div>
                      </div>
                    ))}
                    {logs.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">Sem atividade registada.</p>}
                  </div>
                  {logs.length > 5 && (
                    <button
                      onClick={() => setShowAllActivity(!showAllActivity)}
                      className="mt-4 w-full py-3 text-xs font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-colors"
                    >
                      {showAllActivity ? 'Mostrar Menos' : 'Ver Tudo →'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

{!auditWorkerId && activeTab === 'reports' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><FileText size={20} /></div>
                  <h3 className="font-black text-base sm:text-xl text-slate-800 uppercase tracking-tight">Folhas de Horas para Clientes</h3>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2">
                  <div className="bg-indigo-50 text-indigo-600 p-2 sm:p-3 rounded-xl sm:rounded-2xl w-fit"><Users size={18} className="sm:hidden" /><Users size={24} className="hidden sm:block" /></div>
                  <div>
                    <p className="text-xl sm:text-3xl font-black text-slate-800">{activeWorkersCount}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaboradores com Registos</p>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">no mês seleccionado</p>
                </div>
                <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2">
                  <div className="bg-emerald-50 text-emerald-600 p-2 sm:p-3 rounded-xl sm:rounded-2xl w-fit"><Building2 size={18} className="sm:hidden" /><Building2 size={24} className="hidden sm:block" /></div>
                  <div>
                    <p className="text-xl sm:text-3xl font-black text-slate-800">{activeClientsCount}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clientes Activos</p>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">no mês seleccionado</p>
                </div>
                <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2">
                  <div className="bg-amber-50 text-amber-600 p-2 sm:p-3 rounded-xl sm:rounded-2xl w-fit"><Activity size={18} className="sm:hidden" /><Activity size={24} className="hidden sm:block" /></div>
                  <div>
                    <p className="text-xl sm:text-3xl font-black text-slate-800">{activeReportsCount}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Registos</p>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">no mês seleccionado</p>
                </div>
              </div>

              {/* Filtros */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecione o Cliente</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.clientId} onChange={e => setReportFilter({ ...reportFilter, clientId: e.target.value })}>
                      <option value="">-- Escolher Cliente --</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Colaborador (Opcional)</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.workerId} onChange={e => setReportFilter({ ...reportFilter, workerId: e.target.value })}>
                      <option value="">-- Todos os Colaboradores --</option>
                      {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mês (Ano-Mês)</label>
                    <input type="month" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.month} onChange={e => setReportFilter({ ...reportFilter, month: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                  <button onClick={handleGenerateClientReport} disabled={!reportFilter.month || (!reportFilter.clientId && !reportFilter.workerId)} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 transition-all">
                    <FileText size={18} /> Gerar Selecção
                  </button>
                  <button onClick={() => {
                    const historyEntry = {
                      id: `rh_${Date.now()}`,
                      month: reportFilter.month,
                      clientId: '',
                      clientName: 'Todos os Clientes',
                      workerId: '',
                      workerName: 'Todos',
                      timestamp: new Date().toISOString()
                    };
                    const updatedHistory = [historyEntry, ...reportHistory].slice(0, 5);
                    setReportHistory(updatedHistory);
                    localStorage.setItem('reportHistory', JSON.stringify(updatedHistory));
                    setPrintingReport({ isGlobal: true, month: reportFilter.month });
                  }} disabled={!reportFilter.month} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 transition-all">
                    <Zap size={18} className="text-amber-400" /> Gerar Tudo do Mês
                  </button>
                </div>
              </div>

              {/* Modal de Relatório */}
              {printingReport && (
                <div
                  className="fixed inset-0 bg-slate-900/80 backdrop-blur-lg z-[200] flex items-start justify-center p-4 overflow-y-auto print:bg-transparent print:backdrop-blur-none print:p-0 print:static print:overflow-visible"
                  onClick={(e) => { if (e.target === e.currentTarget) setPrintingReport(null); }}
                >
                  <div className="w-full max-w-2xl lg:max-w-5xl mx-4 sm:mx-auto my-8 bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border border-indigo-100 animate-in fade-in zoom-in duration-300 embedded-mode print:my-0 print:max-w-full print:rounded-none print:shadow-none print:border-0 print:overflow-visible">
                    <div className="no-print sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white rounded-t-[2rem] sm:rounded-t-[3rem]">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-50 p-2.5 rounded-2xl text-indigo-600"><FileText size={20} /></div>
                        <div>
                          <h3 className="font-black text-lg text-slate-800">A Visualizar Relatório</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{printingReport.month}</p>
                        </div>
                      </div>
                      <button onClick={() => setPrintingReport(null)} className="p-3 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all">
                        <X size={20} />
                      </button>
                    </div>
                    <ClientTimesheetReport data={reportData} onBack={() => setPrintingReport(null)} isEmbedded={true} />
                  </div>
                </div>
              )}

              {/* Histórico Recente */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-5">
                  <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><History size={20} /></div>
                  <h3 className="font-black text-lg text-slate-800">Histórico Recente</h3>
                </div>
                {reportHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="bg-slate-50 p-4 rounded-2xl mb-3"><FileText size={32} className="text-slate-300" /></div>
                    <p className="text-sm font-bold text-slate-400">Ainda sem relatórios gerados</p>
                    <p className="text-[10px] text-slate-300 mt-1">Gere um relatório para o ver aqui</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Mês</th>
                          <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                          <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                          <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Gerado em</th>
                          <th className="px-5 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {reportHistory.map(entry => (
                          <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 text-sm font-black text-slate-700">{entry.month}</td>
                            <td className="px-5 py-3 text-sm font-bold text-slate-600">{entry.clientName}</td>
                            <td className="px-5 py-3 text-sm font-bold text-slate-600">{entry.workerName}</td>
                            <td className="px-5 py-3 text-xs text-slate-400">{new Date(entry.timestamp).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="px-5 py-3 text-right">
                              <button onClick={() => {
                                setReportFilter(prev => ({ ...prev, month: entry.month, clientId: entry.clientId, workerId: entry.workerId }));
                                setTimeout(() => {
                                  const clientSelected = entry.clientId ? clients.find(c => c.id === entry.clientId) : null;
                                  if (entry.clientId || entry.workerId) {
                                    setPrintingReport({ client: clientSelected, month: entry.month, workerId: entry.workerId });
                                  } else {
                                    setPrintingReport({ isGlobal: true, month: entry.month });
                                  }
                                }, 50);
                              }} className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all">
                                Ver
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}



          {!auditWorkerId && activeTab === 'team' && (
            <TeamManager onLogin={onLogin} />
          )}

          {/* Módulos Clientes */}
          {!auditWorkerId && activeTab === 'clients' && (
            <ClientManager />
          )}

          {!auditWorkerId && activeTab === 'portal_validacao' && (
            <ValidationPortalProvider portalSubTab={portalSubTab} setPortalSubTab={setPortalSubTab} portalMonth={portalMonth} setPortalMonth={setPortalMonth}>
              <ValidationPortal
                onLogin={onLogin}
                setClienteSelecionado={setClienteSelecionado}
                setModalEmailAberto={setModalEmailAberto}
                setPrintingReport={setPrintingReport}
              />
            </ValidationPortalProvider>
          )}
          {!auditWorkerId && activeTab === 'schedules' && <ScheduleManager />}

{!auditWorkerId && activeTab === 'costs' && <CostReports />}
          {!auditWorkerId && activeTab === 'documentos' && (
            <DocumentsAdmin workers={workers} documents={documents} setDocuments={setDocuments} systemSettings={systemSettings} supabase={supabase} reportFilter={reportFilter} setReportFilter={setReportFilter} reportHistory={reportHistory} setReportHistory={setReportHistory} printingReport={printingReport} setPrintingReport={setPrintingReport} clients={clients} activeWorkersCount={activeWorkersCount} activeClientsCount={activeClientsCount} handleGenerateClientReport={handleGenerateClientReport} logs={logs} clientApprovals={clientApprovals} />
          )}
          {!auditWorkerId && activeTab === 'notificacoes' && (
            <NotificationsAdmin workers={workers} appNotifications={appNotifications} saveToDb={saveToDb} handleDelete={handleDelete} supabase={supabase} />
          )}

          {/* Módulo Configurações */}
          {!auditWorkerId && activeTab === 'settings' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-black flex items-center gap-2"><Settings size={22} className="text-indigo-600" /> Configurações do Sistema</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">

                {/* Administradores */}
                <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 lg:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><ShieldCheck size={20} /></div>
                      <h3 className="font-black text-lg text-slate-800">Administradores</h3>
                    </div>
                    <button onClick={handleOpenAddAdmin} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all">
                      <UserPlus size={14} /> Adicionar
                    </button>
                  </div>

                  {/* Lista de admins */}
                  <div className="space-y-2 mb-4">
                    {workers.filter(w => w.isAdmin).length === 0 && !adminFormMode && (
                      <p className="text-xs text-slate-400 font-bold text-center py-4">Nenhum administrador configurado.</p>
                    )}
                    {workers.filter(w => w.isAdmin).map(w => {
                      const parts = (w.name || '').trim().split(/\s+/);
                      const username = parts.length > 1 ? (parts[0] + parts[parts.length - 1]).toLowerCase() : parts[0].toLowerCase();
                      const isEditing = adminFormMode === 'edit' && adminForm.id === w.id;
                      return (
                        <div key={w.id} className={`p-3 bg-slate-50 rounded-2xl border transition-all ${isEditing ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100'}`}>
                          {isEditing ? (
                            <div className="space-y-2">
                              <input type="text" value={adminForm.name} onChange={e => setAdminForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                              <input type="text" value={adminForm.nif} onChange={e => setAdminForm(p => ({ ...p, nif: e.target.value }))} placeholder="Senha (NIF)" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                              <div className="flex gap-2 pt-1">
                                <button onClick={handleSaveAdmin} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all">Guardar</button>
                                <button onClick={() => setAdminFormMode(null)} className="px-4 py-2 rounded-xl font-black text-xs text-slate-500 hover:bg-slate-100 transition-all">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-black text-slate-800">{w.name}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{username}</p>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => handleEditAdmin(w)} className="text-xs font-bold text-indigo-500 hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition-all">Editar</button>
                                <button onClick={() => handleRevokeAdmin(w)} className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-all"><ShieldOff size={12} /> Revogar</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Form adicionar admin */}
                  {(adminFormMode === 'new' || adminFormMode === 'existing') && (
                    <div className="border-t border-slate-100 pt-5 space-y-3">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Novo Administrador</p>
                      {nonAdminWorkers.length > 0 && (
                        <select
                          value={adminForm.selectedWorkerId}
                          onChange={e => handleSelectExistingWorker(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">— Selecionar trabalhador existente —</option>
                          {nonAdminWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      )}
                      <input type="text" placeholder="Nome completo" value={adminForm.name} onChange={e => setAdminForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                      <input type="text" placeholder="Senha (NIF)" value={adminForm.nif} onChange={e => setAdminForm(p => ({ ...p, nif: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                      <div className="flex gap-2">
                        <button onClick={handleSaveAdmin} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all">Criar</button>
                        <button onClick={() => { setAdminFormMode(null); setAdminForm({ id: null, name: '', nif: '', selectedWorkerId: '' }); }} className="px-4 py-3 rounded-xl font-black text-xs text-slate-500 hover:bg-slate-100 transition-all">Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Conta e Segurança */}
                <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-amber-50 p-2 rounded-xl text-amber-600"><Lock size={20} /></div>
                    <h3 className="font-black text-lg text-slate-800">Segurança da Conta</h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Alterar Senha Administrador</p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Nova Senha"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        id="new-admin-pass"
                      />
                      <button
                        onClick={() => {
                          const passEl = document.getElementById('new-admin-pass');
                          if (!passEl) return;
                          const newPass = passEl.value;
                          if (!newPass) return;
                          updateSetting('adminPassword', newPass);
                          alert('Senha alterada com sucesso! A nova senha será necessária no próximo login.');
                          passEl.value = '';
                        }}
                        className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-xs uppercase hover:bg-slate-800 transition-all"
                      >
                        Atualizar
                      </button>
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Chave API Gemini (IA)</p>
                      <p className="text-[10px] text-slate-400 mb-3">Obtenha a sua chave em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-indigo-500 underline">aistudio.google.com</a></p>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          placeholder="AIza..."
                          defaultValue={systemSettings.geminiApiKey || ''}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                          id="gemini-api-key"
                        />
                        <button
                          onClick={() => {
                            const keyEl = document.getElementById('gemini-api-key');
                            const key = keyEl ? keyEl.value.trim() : '';
                            updateSetting('geminiApiKey', key);
                            alert(key ? 'Chave API guardada! A IA está agora activa.' : 'Chave API removida.');
                          }}
                          className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-xs uppercase hover:bg-indigo-700 transition-all whitespace-nowrap"
                        >
                          Guardar
                        </button>
                      </div>
                      {systemSettings.geminiApiKey ? (
                        <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1"><span>•</span> IA activa</p>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-1"><span>•</span> IA inactiva - configure a chave</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Identidade Visual */}
                <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Building2 size={20} /></div>
                    <h3 className="font-black text-lg text-slate-800">Identidade da Empresa</h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Nome da Empresa</p>
                    <input
                      type="text"
                      value={systemSettings.companyName}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, companyName: e.target.value }))}
                      onBlur={(e) => updateSetting('companyName', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    />
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Morada</p>
                    <input
                      type="text"
                      value={systemSettings.companyAddress || ''}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, companyAddress: e.target.value }))}
                      onBlur={(e) => updateSetting('companyAddress', e.target.value)}
                      placeholder="Rua, nº, código postal, localidade"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    />
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">NIF</p>
                    <input
                      type="text"
                      value={systemSettings.companyNif || ''}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, companyNif: e.target.value }))}
                      onBlur={(e) => updateSetting('companyNif', e.target.value)}
                      placeholder="Nº de Identificação Fiscal"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    />
                  </div>
                </div>

                {/* Assinatura da Empresa (Responsável) */}
                <CompanySignatureSettings
                  companySignature={companySignature}
                  saveCompanySignature={saveCompanySignature}
                />

                {/* Personalização Visual */}
                <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600"><Palette size={20} /></div>
                    <h3 className="font-black text-lg text-slate-800">Visual e Tema</h3>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-sm font-bold text-slate-700">Largura do App (Desktop)</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{systemSettings.appWidth}px</p>
                      </div>
                      <input
                        type="range"
                        min="1000"
                        max="4000"
                        step="20"
                        value={Number(systemSettings.appWidth)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSystemSettings(prev => ({ ...prev, appWidth: val }));
                        }}
                        onMouseUp={(e) => updateSetting('appWidth', e.target.value)}
                        onTouchEnd={(e) => updateSetting('appWidth', e.target.value)}
                        className="w-32 accent-indigo-600"
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-sm font-bold text-slate-700">Modo Escuro (Interface)</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ajuste de luminosidade</p>
                      </div>
                      <button
                        onClick={() => updateSetting('darkMode', !systemSettings.darkMode)}
                        className={`w-14 h-8 rounded-full transition-all flex items-center px-1 ${systemSettings.darkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
                      >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all ${systemSettings.darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Destaque Informativo */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-xl text-white relative overflow-hidden flex flex-col justify-center">
                  <div className="absolute top-0 right-0 p-6 opacity-10"><Sparkles size={80} /></div>
                  <h3 className="text-xl font-black uppercase tracking-tighter mb-2">Magnetic Place Pro</h3>
                  <p className="text-sm font-medium opacity-80 leading-relaxed mb-6">Utilize o painel de configurações para moldar a experiência do dashboard conforme as necessidades da sua empresa.</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><CheckCircle size={14} /> Relatórios Financeiros</div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><CheckCircle size={14} /> Gestão de Equipa Analítica</div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><CheckCircle size={14} /> Automação com IA</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function CompanySignatureSettings({ companySignature, saveCompanySignature }) {
  const { stampStyle, setStampStyle } = useApp();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [sigDataUrl, setSigDataUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  // Hidratar quando os dados chegam do servidor
  useEffect(() => {
    setName(companySignature?.responsibleName || '');
    setRole(companySignature?.responsibleRole || '');
    setEmail(companySignature?.responsibleEmail || '');
    setSigDataUrl(companySignature?.signatureDataUrl || '');
  }, [companySignature?.responsibleName, companySignature?.responsibleRole, companySignature?.responsibleEmail, companySignature?.signatureDataUrl]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await saveCompanySignature({
        responsibleName: name.trim(),
        responsibleRole: role.trim(),
        responsibleEmail: email.trim(),
        signatureDataUrl: sigDataUrl,
      });
      setMessage('Assinatura da empresa guardada com sucesso.');
    } catch (err) {
      setError('Erro ao guardar: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><FileSignature size={20} /></div>
        <h3 className="font-black text-lg text-slate-800">Assinatura da Empresa</h3>
      </div>
      <p className="text-xs text-slate-500 mb-6">
        Carimbo aplicado pelo responsável da Magnetic Place quando aprova um documento assinado pelo trabalhador.
      </p>

      <div className="space-y-4">
        <div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Nome do Responsável</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: João Silva"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
          />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Cargo</p>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Ex: Diretor, Gestor de RH"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
          />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Email do Responsável</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@magneticplace.pt"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
          />
          <p className="text-[10px] text-slate-400 mt-1">Recebe notificações de validação (correções, assinaturas mensais).</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Imagem da Assinatura</p>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="flex-1">
              <button
                onClick={() => setShowSignaturePad(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-colors w-fit"
              >
                <PenTool size={16} />
                {sigDataUrl ? 'Redesenhar assinatura' : 'Desenhar assinatura'}
              </button>
              <p className="text-[11px] text-slate-400 mt-2">Desenhe a sua assinatura digital diretamente no ecrã.</p>
            </div>
            <div className="w-40 h-20 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 bg-white">
              {sigDataUrl ? (
                <img src={sigDataUrl} alt="Assinatura" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-[10px] text-slate-400 font-bold uppercase text-center">Sem assinatura</span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2 font-bold">{error}</div>
        )}
        {message && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2 font-bold">{message}</div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Guardar
        </button>

        <div className="pt-6 mt-2 border-t border-slate-100 space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Estilo do carimbo aplicado aos documentos
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStampStyle('mirror')}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${stampStyle === 'mirror' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-800">Espelho · Estilo Trabalhador</div>
              <div className="text-[10px] text-slate-500 mt-1">Mesmo layout do trabalhador, paleta azul, com assinatura e cargo</div>
            </button>
            <button
              type="button"
              onClick={() => setStampStyle('classic')}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${stampStyle === 'classic' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-800">Logo + Assinatura</div>
              <div className="text-[10px] text-slate-500 mt-1">Logo da empresa + assinatura desenhada azul</div>
            </button>
            <button
              type="button"
              onClick={() => setStampStyle('corporate')}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${stampStyle === 'corporate' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-800">Corporate · Multinacional</div>
              <div className="text-[10px] text-slate-500 mt-1">Marinho + dourado, selo CERTIFIED ORIGINAL, logo proeminente</div>
            </button>
            <button
              type="button"
              onClick={() => setStampStyle('tech')}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${stampStyle === 'tech' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-800">Tech Data-Grid</div>
              <div className="text-[10px] text-slate-500 mt-1">Auditoria técnica + token (sem assinatura desenhada)</div>
            </button>
          </div>

          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-2">
            Pré-visualização
          </p>
          {stampStyle === 'mirror' ? (
            <ValidationStampAdmin
              responsibleName={name || 'Nome do Responsável'}
              responsibleRole={role}
              signedAt={new Date().toISOString()}
              ip="192.168.x.x"
              signatureDataUrl={sigDataUrl}
              companyLogoUrl="/icon-512x512.png"
            />
          ) : stampStyle === 'classic' ? (
            <CompanyClassicStamp
              responsibleName={name || 'Nome do Responsável'}
              responsibleRole={role}
              signedAt={new Date().toISOString()}
              signatureDataUrl={sigDataUrl}
            />
          ) : stampStyle === 'corporate' ? (
            <CompanyCorporateStamp
              responsibleName={name || 'Nome do Responsável'}
              responsibleRole={role}
              signedAt={new Date().toISOString()}
              signatureDataUrl={sigDataUrl}
            />
          ) : (
            <CompanyValidationStamp
              responsibleName={name || 'Nome do Responsável'}
              responsibleRole={role}
              signedAt={new Date().toISOString()}
              ip="192.168.x.x"
              id={`prev_${Date.now().toString(16).slice(-8)}`}
              signatureDataUrl={sigDataUrl}
            />
          )}
        </div>
      </div>

      {showSignaturePad && (
        <AdminSignDrawModal
          onClose={() => setShowSignaturePad(false)}
          onSign={(dataUrl) => {
            setSigDataUrl(dataUrl);
            setShowSignaturePad(false);
            setError('');
          }}
          userName={name || 'Responsável'}
        />
      )}
    </div>
  );
}

function AdminSignDrawModal({ onClose, onSign, userName }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const setup = () => {
      const parent = c.parentElement;
      if (!parent) return;
      const ratio = window.devicePixelRatio || 1;
      const cssW = parent.clientWidth;
      const cssH = parent.clientHeight;
      c.width = cssW * ratio;
      c.height = cssH * ratio;
      c.style.width = cssW + 'px';
      c.style.height = cssH + 'px';
      const ctx = c.getContext('2d');
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1e293b';
    };
    setup();
    window.addEventListener('resize', setup);
    return () => window.removeEventListener('resize', setup);
  }, []);

  const pos = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const src = e.touches?.[0] || e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };
  const stop = (e) => {
    if (!drawing.current) return;
    e?.preventDefault?.();
    drawing.current = false;
    canvasRef.current?.getContext('2d')?.closePath();
  };
  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const ratio = window.devicePixelRatio || 1;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    setHasInk(false);
  };
  const submit = () => {
    if (!hasInk) { setError('Por favor, assine antes de confirmar.'); return; }
    setError('');
    onSign(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[210] flex items-stretch sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh]">
        <div className="flex justify-between items-center mb-3 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-black text-slate-800">Assinatura da Empresa</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {userName && (
          <p className="text-xs text-slate-500 mb-3 flex-shrink-0">
            <span className="font-bold text-slate-700">{userName}</span> — desenhe a assinatura digital abaixo.
          </p>
        )}
        <div className="mb-3 bg-white border-2 border-slate-200 rounded-2xl flex-1 sm:flex-none relative" style={{ minHeight: '200px', height: 'auto', touchAction: 'none' }}>
          <canvas ref={canvasRef} className="w-full h-full cursor-crosshair block rounded-2xl" style={{ touchAction: 'none', height: '100%' }} onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop} onTouchStart={start} onTouchMove={move} onTouchEnd={stop} onTouchCancel={stop} />
          {!hasInk && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-300 font-bold text-xs uppercase tracking-widest">Assine aqui</div>}
        </div>
        {error && <div className="mb-3 p-3 bg-rose-50 text-rose-600 text-sm font-bold rounded-xl flex-shrink-0">{error}</div>}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2 flex-shrink-0">
          <button onClick={clear} className="px-4 py-3 sm:py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm border border-slate-200 sm:border-0 font-bold">Limpar</button>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={onClose} className="px-4 py-3 sm:py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold">Cancelar</button>
            <button onClick={submit} disabled={!hasInk} className="px-6 py-3 sm:py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" /> Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
