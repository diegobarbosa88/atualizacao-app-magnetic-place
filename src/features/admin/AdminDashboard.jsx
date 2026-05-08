import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import CompanyLogo from '../../components/common/CompanyLogo';
import EntryForm from '../../components/common/EntryForm';
import ClientTimesheetReport from '../../components/common/ClientTimesheetReport';
import {
  LayoutGrid, Clock, TrendingUp, TrendingDown, Wallet, Trophy, History,
  Activity, FileText, BarChart3, Settings2, Sparkles, CheckCircle,
  X, ChevronLeft, ChevronRight, LogOut, Zap, Plus, Trash2, Unlock,
  Building2, Palette, Lock, Settings
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

  const { adminStats, clients, workers, schedules, appNotifications, saveToDb, setSystemSettings } = useApp();

  const notificacoesDeCorrecao = correctionNotifications;


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

  const [viewedCorrections, setViewedCorrections] = useState(() => {
    const saved = localStorage.getItem('magnetic_viewed_corrections');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('magnetic_viewed_corrections', JSON.stringify(viewedCorrections));
  }, [viewedCorrections]);


  useEffect(() => {
    // Agora a aba correções é uma sub-tab do portal_validacao
    if (activeTab === 'portal_validacao' && portalSubTab === 'correcoes' && notificacoesDeCorrecao.length > 0) {
      setViewedCorrections(prev => {
        const newIds = notificacoesDeCorrecao.map(n => n.id).filter(id => !prev.includes(id));
        if (newIds.length === 0) return prev;
        return [...prev, ...newIds];
      });
    }
  }, [activeTab, portalSubTab, notificacoesDeCorrecao]);

  const unviewedCorrectionsCount = useMemo(() => {
    return notificacoesDeCorrecao.filter(n => !viewedCorrections.includes(n.id)).length;
  }, [notificacoesDeCorrecao, viewedCorrections]);

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

  // Worker comparison data
  const workerComparisonData = useMemo(() => {
    return workers
      .map(w => {
        const workerLogs = logs.filter(l => l.workerId === w.id && isSameMonth(l.date, currentMonth));
        const registered = workerLogs.reduce((sum, l) => sum + (l.hours || 0), 0);
        const expected = getWorkerExpectedHours(w.id);
        const percent = expected > 0 ? (registered / expected * 100).toFixed(1) : 0;
        return {
          id: w.id,
          name: w.name,
          registered,
          expected,
          percent,
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

  if (printingReport) {
    return (
      <div className="min-h-screen bg-slate-50 print:bg-white print:border-none print:shadow-none font-sans text-slate-900">
        <nav className="bg-white border-b border-slate-200 min-h-[4rem] flex flex-col md:flex-row items-center px-4 md:px-8 justify-between sticky top-0 z-40 shadow-sm gap-y-4 py-3 print:hidden">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full md:w-auto">
            <div className="flex items-center justify-between w-full md:w-auto">
              <div className="flex items-center gap-3 font-black text-xl tracking-tighter uppercase">
                <CompanyLogo className="h-8 w-8" />
                <span className="inline">MAGNETIC PLACE</span>
              </div>
            </div>
            <div className="flex overflow-x-auto w-full md:w-auto items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 opacity-50 cursor-not-allowed">
              {['overview', 'team', 'clients', 'schedules', 'expenses', 'reports', 'settings'].map(t => (
                <button key={t} disabled className="whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {t === 'overview' ? 'Geral' : t === 'team' ? 'Equipa' : t === 'clients' ? 'Clientes' : t === 'schedules' ? 'Horários' : t === 'expenses' ? 'Despesas' : t === 'settings' ? 'Configurações' : 'Relatórios'}
                </button>
              ))}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4 ml-auto md:ml-0">
            <button onClick={onLogout} title="Sair" className="p-3 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={24} /></button>
          </div>
        </nav>
        <ClientTimesheetReport data={printingReport} onBack={() => setPrintingReport(null)} />
      </div>
    );
  }

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
    setPrintingReport({ client: clientSelected, logs, workers, clients, month: reportFilter.month, workerId: reportFilter.workerId, clientApprovals });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans text-slate-900">
      <nav className="bg-white border-b border-slate-200 min-h-[4rem] sticky top-0 z-40 shadow-sm py-3 px-4 md:px-0">
        <div className="mx-auto md:px-10 lg:px-16 flex flex-col md:flex-row items-center justify-between gap-6" style={{ maxWidth: `var(--app-max-width)` }}>
          {/* Lado Esquerdo: Logo */}
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3 font-black text-xl tracking-tighter uppercase shrink-0">
              <CompanyLogo className="h-8 w-8" />
              <span className="inline">{systemSettings.companyName}</span>
            </div>
            {/* Mobile Actions */}
            <div className="flex md:hidden items-center gap-2">
              <button onClick={() => setShowFinReport(true)} className="flex items-center justify-center p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100"><BarChart3 size={18} /></button>
              <button onClick={onLogout} className="p-2 text-slate-400"><LogOut size={18} /></button>
            </div>
          </div>

          {/* Centro: Menu de Navegação */}
          <div className="flex-1 flex justify-center w-full md:w-auto">
            <div className="flex menu-scroll w-full md:w-auto items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200" style={{ scrollbarWidth: 'thin', msOverflowStyle: 'auto' }}>
              {['overview', 'team', 'clients', 'portal_validacao', 'schedules', 'reports', 'costs', 'documentos', 'templates', 'notificacoes', 'settings'].map(t => (
                <button key={t} onClick={() => { setActiveTab(t); setAuditWorkerId(null); }} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === t ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'} ${t === 'portal_validacao' && unviewedCorrectionsCount > 0 ? 'animate-pulse' : ''}`}>
                  {t === 'overview' ? 'Geral' : t === 'team' ? 'Equipa' : t === 'clients' ? 'Clientes' : t === 'portal_validacao' ? (
                    <span className="flex items-center gap-1">Portal Validação {unviewedCorrectionsCount > 0 && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{unviewedCorrectionsCount}</span>}</span>
                  ) : t === 'schedules' ? 'Horários' : t === 'reports' ? 'Relatórios' : t === 'costs' ? 'Custos' : t === 'documentos' ? 'Documentos' : t === 'templates' ? 'Templates' : t === 'notificacoes' ? 'Notificações' : <Settings size={14} />}
                </button>
              ))}
            </div>
          </div>

          {/* Lado Direito: Ações */}
          <div className="hidden md:flex items-center gap-4 shrink-0">
            <button onClick={() => setShowFinReport(true)} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-xs font-black uppercase border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><BarChart3 size={16} /> Financeiro</button>
            <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
          </div>
        </div>
      </nav>

      <main className="w-full mt-12 pb-12">
        <div className="mx-auto px-4 sm:px-10 lg:px-16" style={{ maxWidth: `var(--app-max-width)` }}>


          {auditWorkerId && (() => {
            const currentApproval = approvals.find(a => a.workerId === auditWorkerId && a.month === currentMonthStr);
            return (
              <div className="mb-10 bg-white rounded-[3rem] p-10 shadow-2xl border-4 border-indigo-500/20 animate-in slide-in-from-top-8 duration-500">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                  <div className="flex items-center gap-6"><div className="bg-slate-900 p-5 rounded-3xl text-white shadow-xl"><Settings2 size={40} /></div><div><h2 className="text-3xl font-black uppercase">Audit: {auditedWorker?.name}</h2><p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Controlo Mensal Detalhado</p></div></div>
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
                  <thead className="bg-slate-50 border-b border-slate-100"><tr><th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest w-32">Dia</th><th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest">Actividades</th><th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-right">Acção</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {daysInMonthList.map(ds => {
                      const dayLogs = logs.filter(l => l.workerId === auditWorkerId && l.date === ds);
                      const isCurrentInline = inlineEditingDate === ds;
                      return (
                        <React.Fragment key={ds}>
                          <tr className="group">
                            <td className="px-10 py-8 align-top"><p className="text-3xl font-black">{new Date(ds).getDate()}</p></td>
                            <td className="px-10 py-8">
                              <div className="space-y-4">
                                {dayLogs.map(log => (
                                  <div key={log.id} className="bg-white p-6 rounded-3xl border border-indigo-100/50 flex items-center justify-between shadow-sm">
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
                            <td className="px-10 py-8 text-right align-top">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => handleQuickRegister(ds)} title="Registo Rápido" className="p-3 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-2xl transition-all"><Zap size={20} /></button>
                                <button onClick={() => handleOpenInlineForm(ds)} className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all"><Plus size={20} /></button>
                              </div>
                            </td>
                          </tr>
                          {isCurrentInline && (
                            <tr><td colSpan="3" className="px-10 py-4 bg-indigo-50/30">
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
            <div className="animate-in fade-in duration-500 space-y-8" style={{ maxWidth: '1440px', margin: '0 auto' }}>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3"><LayoutGrid size={32} className="text-indigo-600" /> Dashboard Geral</h2>
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><ChevronLeft size={16} /></button>
                  <span className="font-bold text-sm uppercase tracking-widest text-indigo-600 min-w-[120px] text-center">
                    {currentMonth.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}
                  </span>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><ChevronRight size={16} /></button>
                </div>
              </div>

              {/* KPI Cards Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Horas Totais */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl"><Clock size={24} /></div>
                    {aggregatedTrend.percent != 0 && (
                      <span className={`text-[10px] font-black px-2 py-1 rounded-full ${Number(aggregatedTrend.percent) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {Number(aggregatedTrend.percent) >= 0 ? '▲' : '▼'} {Math.abs(aggregatedTrend.percent)}%
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-3xl font-black text-slate-800">{formatHours(adminStats.totalHours)}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatHours(aggregatedTrend.expected)} Esperadas</p>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Horas Totais</p>
                </div>

                {/* Faturação */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl"><TrendingUp size={24} /></div>
                  </div>
                  <div>
                    <p className="text-3xl font-black text-slate-800">{formatCurrency(adminStats.expectedRevenue)}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimada</p>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Faturação</p>
                </div>

                {/* Custos */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="bg-rose-50 text-rose-600 p-3 rounded-2xl"><TrendingDown size={24} /></div>
                  </div>
                  <div>
                    <p className="text-3xl font-black text-slate-800">{formatCurrency(adminStats.expectedCosts + adminStats.monthlyExpenses)}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operacionais + Fixos</p>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custos Globais</p>
                </div>

                {/* Resultado Líquido */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-[2.5rem] shadow-xl flex flex-col gap-3 text-white">
                  <div className="flex justify-between items-start">
                    <div className="bg-white/20 p-3 rounded-2xl"><Wallet size={24} /></div>
                    {aggregatedTrend.percent != 0 && (
                      <span className={`text-[10px] font-black px-2 py-1 rounded-full ${Number(aggregatedTrend.percent) >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {Number(aggregatedTrend.percent) >= 0 ? '▲' : '▼'} {Math.abs(aggregatedTrend.percent)}%
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-3xl font-black">{formatCurrency(adminStats.netProfit)}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Líquido</p>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resultado</p>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Area Chart - 2/3 */}
                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
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
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
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
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
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
                            <span className={`text-[10px] font-black px-2 py-1 rounded-full ${w.isOver ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {w.isOver ? '▲' : '▼'} {Math.abs(w.percent)}%
                            </span>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Units */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-amber-50 p-2 rounded-xl text-amber-600"><Trophy size={20} /></div>
                    <h3 className="font-black text-lg text-slate-800">Top Unidades (Horas)</h3>
                  </div>
                  <div className="space-y-4">
                    {adminStats.topClientsList.length > 0 ? adminStats.topClientsList.map((c, i) => (
                      <div key={i} className="flex items-center justify-between group">
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-bold text-slate-700">{c.name}</span>
                            <span className="text-xs font-black text-indigo-600">{formatHours(c.hours)}</span>
                          </div>
                          <div className="w-full bg-slate-50 rounded-full h-2">
                            <div className="bg-indigo-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (c.hours / adminStats.totalHours) * 100)}%` }}></div>
                          </div>
                        </div>
                      </div>
                    )) : <p className="text-xs text-slate-400 italic">Sem dados de clientes registados este mês.</p>}
                  </div>
                </div>

                {/* Activity Recente */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
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
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black flex items-center gap-3"><FileText size={32} className="text-indigo-600" /> Folhas de Horas para Clientes</h2>
              </div>
              <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecione o Cliente</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.clientId} onChange={e => setReportFilter({ ...reportFilter, clientId: e.target.value })}>
                      <option value="">-- Escolher Cliente --</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Colaborador (Opcional)</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.workerId} onChange={e => setReportFilter({ ...reportFilter, workerId: e.target.value })}>
                      <option value="">-- Todos os Colaboradores --</option>
                      {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mês (Ano-Mês)</label>
                    <input type="month" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={reportFilter.month} onChange={e => setReportFilter({ ...reportFilter, month: e.target.value })} />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                  <button onClick={handleGenerateClientReport} disabled={!reportFilter.month || (!reportFilter.clientId && !reportFilter.workerId)} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 transition-all">
                    <FileText size={20} /> Gerar Selecção
                  </button>
                  <button onClick={() => setPrintingReport({ isGlobal: true, month: reportFilter.month, logs, workers, clients, clientApprovals })} disabled={!reportFilter.month} className="px-8 py-5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 transition-all">
                    <Zap size={20} className="text-amber-400" /> Gerar Tudo do Mês
                  </button>
                </div>
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
            <ValidationPortalProvider>
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
            <DocumentsAdmin workers={workers} documents={documents} setDocuments={setDocuments} />
          )}
          {!auditWorkerId && activeTab === 'templates' && (
            <DocumentTemplatesAdmin workers={workers} />
          )}
          {!auditWorkerId && activeTab === 'notificacoes' && (
            <NotificationsAdmin workers={workers} appNotifications={appNotifications} saveToDb={saveToDb} handleDelete={handleDelete} />
          )}

          {/* Módulo Configurações */}
          {!auditWorkerId && activeTab === 'settings' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black flex items-center gap-3"><Settings size={32} className="text-indigo-600" /> Configurações do Sistema</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Conta e Segurança */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
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
                          const newPass = document.getElementById('new-admin-pass').value;
                          if (!newPass) return;
                          setSystemSettings(prev => ({ ...prev, adminPassword: newPass }));
                          alert('Senha alterada com sucesso! A nova senha será necessária no próximo login.');
                          document.getElementById('new-admin-pass').value = '';
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
                            const key = document.getElementById('gemini-api-key').value.trim();
                            setSystemSettings(prev => ({ ...prev, geminiApiKey: key }));
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
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
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
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    />
                  </div>
                </div>

                {/* Personalização Visual */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
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
                        value={systemSettings.appWidth}
                        onChange={(e) => setSystemSettings(prev => ({ ...prev, appWidth: e.target.value }))}
                        className="w-32 accent-indigo-600"
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-sm font-bold text-slate-700">Modo Escuro (Interface)</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ajuste de luminosidade</p>
                      </div>
                      <button
                        onClick={() => setSystemSettings(prev => ({ ...prev, darkMode: !prev.darkMode }))}
                        className={`w-14 h-8 rounded-full transition-all flex items-center px-1 ${systemSettings.darkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
                      >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all ${systemSettings.darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Destaque Informativo */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden flex flex-col justify-center">
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

export default AdminDashboard;
