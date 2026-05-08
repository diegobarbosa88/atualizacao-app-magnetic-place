import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import CompanyLogo from '../../components/common/CompanyLogo';
import EntryForm from '../../components/common/EntryForm';
import ClientTimesheetReport from '../../components/common/ClientTimesheetReport';
import {
  LayoutGrid, Clock, TrendingUp, TrendingDown, Wallet, Trophy, History,
  Activity, FileText, BarChart3, Settings2, Sparkles, CheckCircle,
  X, ChevronLeft, ChevronRight, LogOut, Zap, Plus, Trash2, Unlock,
  Building2, Palette, Lock, Settings, FileSignature, Send
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

  const [docSubTab, setDocSubTab] = useState('list');
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
    if (activeTab === 'portal_validacao' && portalSubTab === 'correcoes' && notificacoesDeCorrecao.length > 0) {
      const newIds = notificacoesDeCorrecao.map(n => n.id).filter(id => !viewedCorrections.includes(id));
      if (newIds.length > 0) {
        setViewedCorrections(prev => [...prev, ...newIds]);
      }
    }
  }, [activeTab, portalSubTab, notificacoesDeCorrecao]);

  const unviewedCorrectionsCount = useMemo(() => {
    return notificacoesDeCorrecao.filter(n => !viewedCorrections.includes(n.id)).length;
  }, [notificacoesDeCorrecao, viewedCorrections]);

  const unviewedNotificationsCount = useMemo(() => {
    return (appNotifications || []).filter(n => !n.viewed).length;
  }, [appNotifications]);

  if (printingReport) {
    return <ClientTimesheetReport 
      reportData={printingReport} 
      onClose={() => setPrintingReport(null)} 
    />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Navbar Superior Premium */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-[100] border-b border-slate-200 px-6 py-4">
        <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 shrink-0">
            <div className="bg-indigo-600 p-2 rounded-2xl shadow-lg shadow-indigo-100">
              <CompanyLogo className="h-8 w-8 invert brightness-0" />
            </div>
            <div>
              <h1 className="font-black text-lg leading-none tracking-tight">MAGNETIC PLACE</h1>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">Admin Portal</p>
            </div>
          </div>

          {/* Centro: Menu de Navegação */}
          <div className="flex-1 flex justify-center w-full md:w-auto">
            <div className="flex menu-scroll w-full md:w-auto items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200" style={{ scrollbarWidth: 'thin', msOverflowStyle: 'auto' }}>
              {['overview', 'team', 'clients', 'portal_validacao', 'schedules', 'reports', 'costs', 'documentos', 'notificacoes', 'settings'].map(t => (
                <button key={t} onClick={() => { setActiveTab(t); setAuditWorkerId(null); }} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === t ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'} ${t === 'portal_validacao' && unviewedCorrectionsCount > 0 ? 'animate-pulse' : ''}`}>
                  {t === 'overview' ? 'Geral' : t === 'team' ? 'Equipa' : t === 'clients' ? 'Clientes' : t === 'portal_validacao' ? (
                    <span className="flex items-center gap-1">Portal Validação {unviewedCorrectionsCount > 0 && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{unviewedCorrectionsCount}</span>}</span>
                  ) : t === 'schedules' ? 'Horários' : t === 'reports' ? 'Relatórios' : t === 'costs' ? 'Custos' : t === 'documentos' ? 'Documentos' : t === 'notificacoes' ? 'Notificações' : <Settings size={14} />}
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

      <main className="flex-1 p-6 md:p-10 max-w-[1920px] mx-auto w-full">
        {auditWorkerId ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-6">
                <button onClick={() => setAuditWorkerId(null)} className="p-4 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all"><ChevronLeft size={24} /></button>
                <div>
                  <h2 className="text-3xl font-black text-slate-800 uppercase">{auditedWorker?.name}</h2>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{auditedWorker?.role || 'Colaborador'}</p>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{currentMonth.toLocaleString('pt-PT', { month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-3 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-all"><ChevronLeft size={18} /></button>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-3 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-all"><ChevronRight size={18} /></button>
              </div>
            </div>
            <TeamManager 
              auditWorkerId={auditWorkerId} 
              currentMonth={currentMonthStr} 
              logs={logs} 
              handleSaveEntry={handleSaveEntry} 
              handleDelete={handleDelete}
              approvals={approvals}
              workers={workers}
            />
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-black text-slate-800 tracking-tight uppercase">Dashboard Geral</h2>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1 ml-1">Monitorização de Performance & Custos</p>
                  </div>
                  <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-2.5 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-all"><ChevronLeft size={18} /></button>
                    <div className="px-4 text-xs font-black uppercase tracking-widest text-slate-600">{currentMonth.toLocaleString('pt-PT', { month: 'long', year: 'numeric' })}</div>
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-2.5 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-all"><ChevronRight size={18} /></button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Horas Totais', value: formatHours(adminStats.totalHours), sub: `${formatHours(adminStats.expectedHours)} Esperadas`, icon: <Clock />, color: 'indigo', trend: adminStats.efficiency >= 80 ? 'up' : 'down', pct: `${adminStats.efficiency.toFixed(1)}%` },
                    { label: 'Estimada Faturação', value: formatCurrency(adminStats.estimatedRevenue), sub: 'Fluxo Mensal', icon: <TrendingUp />, color: 'emerald', trend: 'up' },
                    { label: 'Custos Globais', value: formatCurrency(adminStats.totalCosts), sub: 'Operacionais + Fixos', icon: <Wallet />, color: 'rose', trend: 'down' },
                    { label: 'Resultado Líquido', value: formatCurrency(adminStats.estimatedProfit), sub: 'Margem Bruta', icon: <Activity />, color: 'purple', trend: adminStats.profitMargin > 20 ? 'up' : 'down', pct: `${adminStats.profitMargin.toFixed(1)}%` }
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all group overflow-hidden relative">
                      <div className={`absolute top-0 right-0 w-32 h-32 bg-${stat.color}-50 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-110`} />
                      <div className="relative z-10">
                        <div className={`w-14 h-14 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm`}>{stat.icon}</div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                        <h3 className="text-3xl font-black text-slate-800 leading-none mb-4">{stat.value}</h3>
                        <div className="flex items-center gap-2">
                          {stat.pct && (
                            <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${stat.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {stat.trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                              {stat.pct}
                            </div>
                          )}
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{stat.sub}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-10">
                      <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Fluxo de Faturação Diário</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Evolução de ganhos vs tempo</p>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-tighter">
                          <div className="w-2 h-2 rounded-full bg-indigo-600" /> Realizado
                        </div>
                      </div>
                    </div>
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={adminStats.dailyRevenue}>
                          <defs>
                            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px 16px'}}
                            itemStyle={{fontSize: '12px', fontWeight: 900, textTransform: 'uppercase'}}
                          />
                          <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#revenueGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-8">Distribuição de Custos</h3>
                    <div className="h-[300px] w-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={adminStats.costDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={110}
                            paddingAngle={8}
                            dataKey="value"
                          >
                            {adminStats.costDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#4f46e5', '#10b981', '#f43f5e', '#f59e0b'][index % 4]} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Custos</p>
                        <h4 className="text-2xl font-black text-slate-800 leading-none">{formatCurrency(adminStats.totalCosts)}</h4>
                      </div>
                    </div>
                    <div className="mt-8 space-y-4">
                      {adminStats.costDistribution.map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: ['#4f46e5', '#10b981', '#f43f5e', '#f59e0b'][i % 4]}} />
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{item.name}</span>
                          </div>
                          <span className="text-xs font-black text-slate-800">{formatCurrency(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'team' && <TeamManager logs={logs} currentMonth={currentMonthStr} workers={workers} />}
            {activeTab === 'clients' && <ClientManager clients={clients} logs={logs} currentMonth={currentMonthStr} saveToDb={saveToDb} />}
            
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
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
                      <FileText size={32} className="text-indigo-600" /> Centro de Documentação
                    </h2>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1 ml-1">Gestão de arquivos e emissão de templates</p>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                    <button 
                      onClick={() => setDocSubTab('list')} 
                      className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${docSubTab === 'list' ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <FileText size={14} /> Documentos Enviados
                    </button>
                    <button 
                      onClick={() => setDocSubTab('templates')} 
                      className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${docSubTab === 'templates' ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <FileSignature size={14} /> Templates & Emissão
                    </button>
                  </div>
                </div>

                {docSubTab === 'list' ? (
                  <DocumentsAdmin workers={workers} documents={documents} setDocuments={setDocuments} />
                ) : (
                  <DocumentTemplatesAdmin workers={workers} />
                )}
              </div>
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
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-6">Taxas e Valores Padrão</h3>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Taxa de Gestão (%)</label>
                          <input 
                            type="number" 
                            value={systemSettings.managementFee || 0} 
                            onChange={(e) => setSystemSettings({...systemSettings, managementFee: parseFloat(e.target.value)})}
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Subsídio de Alimentação (€)</label>
                          <input 
                            type="number" 
                            value={systemSettings.mealAllowance || 0} 
                            onChange={(e) => setSystemSettings({...systemSettings, mealAllowance: parseFloat(e.target.value)})}
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-6">Informações da Empresa</h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome da Empresa</label>
                        <input 
                          type="text" 
                          value={systemSettings.companyName || ''} 
                          onChange={(e) => setSystemSettings({...systemSettings, companyName: e.target.value})}
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">IBAN para Pagamentos</label>
                        <input 
                          type="text" 
                          value={systemSettings.companyIban || ''} 
                          onChange={(e) => setSystemSettings({...systemSettings, companyIban: e.target.value})}
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer Minimalista */}
      <footer className="p-10 border-t border-slate-200 bg-white">
        <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 p-2 rounded-xl text-slate-400"><LayoutGrid size={16} /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">© 2026 Magnetic Place • Todos os direitos reservados</p>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">Suporte</a>
            <a href="#" className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">Termos</a>
            <a href="#" className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AdminDashboard;
