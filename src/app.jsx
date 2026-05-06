
import SignatureCanvas from 'react-signature-canvas';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import './App.css';
import './App.css';
import {
  Users, Briefcase, Clock, FileText, Plus, Trash2, Download,
  ChevronRight, LogOut, UserCircle, AlertCircle, Edit2, Save,
  X, ChevronLeft, ChevronDown, ChevronUp, LayoutGrid, PlusCircle, CheckSquare,
  MousePointer2, TrendingUp, Zap, Calendar, UserPlus,
  Search, Settings2, Activity, Phone, CreditCard, MapPin,
  Hash, Euro, BarChart3, ArrowUpRight, ArrowDownRight,
  Wallet, Receipt, Tag, Layers, Repeat, Trophy, History,
  TrendingDown, Building2, ExternalLink, Lock, Stethoscope, UserCheck, Eye,
  Sparkles, Loader2, BrainCircuit, Magnet, Timer, Coffee, ListChecks, Star, Printer, CheckCircle, Unlock, List, Palette, Settings, Upload, User, Bell, Megaphone, Info, Link, AlertTriangle, Mail, Send, RotateCcw, Copy, XCircle
} from 'lucide-react';
import emailjs from '@emailjs/browser';

import ClientPortal from './ClientPortal.jsx';
import CorrecoesAdminPortal from './components/CorrecoesAdminPortal.jsx';
import TeamManager from './features/admin/TeamManager';
import ClientManager from './features/admin/ClientManager';
import ScheduleManager from './features/admin/ScheduleManager';
import ExpenseManager from './features/admin/ExpenseManager';
import ValidationPortal from './features/admin/ValidationPortal';
import { useApp } from './context/AppContext';
import {
  toISODateLocal,
  isSameMonth,
  getLastBusinessDayOfMonth,
  formatDocDate,
  monthToYYYYMM,
  getISOWeek
} from './utils/dateUtils';
import {
  formatHours,
  calculateDuration,
  calculateExpectedMonthlyHours,
  calculateExpectedDailyHours,
  getScheduleForDay,
  formatCurrency,
  toTimeInputValue
} from './utils/formatUtils';
import { callGemini } from './utils/aiUtils';
import { sendNotificationEmail } from './utils/emailUtils';

// --- CONFIGURAÇÃO DO SUPABASE ---
// (Agora gerida pelo AppContext.jsx)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';
let supabase = null;


// --- Funções Utilitárias removidas (Movidas para src/utils/) ---

// --- Logo da Empresa ---
const CompanyLogo = ({ className = "h-8 w-8" }) => (
  <img
    src="MAGNETIC (3).png"
    alt="Logo da Empresa"
    className={className}
    onError={(e) => {
      e.target.onerror = null;
      e.target.src = 'https://ui-avatars.com/api/?name=Magnetic+Place&background=4f46e5&color=fff';
    }}
  />
);

// --- Componentes da Interface ---
const EntryForm = ({ data, clients, assignedClients, onChange, onSave, onCancel, showDate = false, isEditing = false, title = "Registar Horário", isInline = false }) => {
  const { systemSettings } = useApp();
  const [isImproving, setIsImproving] = useState(false);
  const [showBreaks, setShowBreaks] = useState(!!(data.breakStart || data.breakEnd));
  const [showComments, setShowComments] = useState(!!data.description);
  const filteredClients = useMemo(() => {
    if (!assignedClients || assignedClients.length === 0) return clients;
    return clients.filter(c => assignedClients.includes(c.id));
  }, [clients, assignedClients]);

  const handleAiPolish = async () => {
    if (!data.description) return;
    setIsImproving(true);
    const res = await callGemini(
      `Melhore esta descrição de tarefa para um relatório de horas profissional. Responda APENAS com a descrição polida. Sem conselhos e sem frases introdutórias (ex: não comece com "A descrição melhorada seria..." ou "às vezes isso acontece..."). Texto original: "${data.description}"`,
      "Você é um redator profissional muito rigoroso.",
      systemSettings.geminiApiKey
    );
    onChange({ ...data, description: res.trim() });
    setIsImproving(false);
  };

  return (
    <div className={`bg-white ${isInline ? 'rounded-2xl p-4 shadow-lg border-2 border-indigo-100' : 'rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl border border-indigo-50/50'} animate-in fade-in zoom-in-95 duration-300 w-full text-slate-900 my-2`}>
      {!isInline && (
        <div className="flex items-center gap-3 mb-4 sm:mb-6 border-b border-slate-100 pb-3 sm:pb-4">
          <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Calendar size={20} /></div>
          <h3 className="font-black text-lg uppercase tracking-tight text-slate-800">{title}</h3>
        </div>
      )}

      <div className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
          <div className={`${showDate ? 'md:col-span-3' : 'md:col-span-4'} space-y-1`}>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente / Unidade</label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none shadow-sm text-slate-900" value={data.clientId || ''} onChange={(e) => onChange({ ...data, clientId: e.target.value })}>
              <option value="">Selecione o Cliente...</option>
              {filteredClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {showDate && (
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
              <input type="date" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-slate-900" value={data.date || ''} onChange={(e) => onChange({ ...data, date: e.target.value })} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Entrada</label><input type="time" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 text-sm text-slate-900" value={data.startTime || ''} onChange={(e) => onChange({ ...data, startTime: e.target.value })} /></div>

          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Saída</label><input type="time" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 text-sm text-slate-900" value={data.endTime || ''} onChange={(e) => onChange({ ...data, endTime: e.target.value })} /></div>

          {showBreaks ? (
            <>
              <div className="space-y-1"><label className="text-[9px] font-black text-orange-500 uppercase tracking-widest ml-1">Pausa I.</label><input type="time" className="w-full bg-orange-50 border border-orange-100 rounded-xl p-2.5 sm:p-3 text-sm text-slate-900" value={data.breakStart || ''} onChange={(e) => onChange({ ...data, breakStart: e.target.value })} /></div>
              <div className="space-y-1"><label className="text-[9px] font-black text-orange-500 uppercase tracking-widest ml-1">Pausa F.</label><input type="time" className="w-full bg-orange-50 border border-orange-100 rounded-xl p-2.5 sm:p-3 text-sm text-slate-900" value={data.breakEnd || ''} onChange={(e) => onChange({ ...data, breakEnd: e.target.value })} /></div>
            </>
          ) : (
            <div className="col-span-2 md:col-span-2 flex items-end">
              <button type="button" onClick={(e) => { e.preventDefault(); setShowBreaks(true); }} className="w-full text-[10px] font-black uppercase text-orange-500 bg-orange-50 hover:bg-orange-100 border border-orange-100 rounded-xl p-2.5 sm:p-3 transition-colors flex items-center justify-center gap-2 h-[38px] sm:h-[46px]">
                <Coffee size={14} /> Adicionar Pausa
              </button>
            </div>
          )}
        </div>

        {showComments ? (
          <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Comentários</label>
              <button onClick={handleAiPolish} disabled={isImproving || !data.description} className="text-[9px] flex items-center gap-1 font-bold text-indigo-500 hover:text-indigo-700 disabled:opacity-50">
                {isImproving ? <Loader2 className="animate-spin" size={10} /> : <Sparkles size={10} />} Sugestão IA ✨
              </button>
            </div>
            <textarea rows="2" placeholder="Opcional: Preencha notas ou detalhes sobre a tarefa..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 text-sm outline-none resize-none shadow-inner text-slate-900" value={data.description || ''} onChange={(e) => onChange({ ...data, description: e.target.value })} />
          </div>
        ) : (
          <div>
            <button onClick={(e) => { e.preventDefault(); setShowComments(true); }} className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1 bg-slate-50 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-slate-200 border-dashed w-max">
              <Plus size={12} /> Adicionar Comentários
            </button>
          </div>
        )}

        <div className="flex gap-2 sm:gap-3 pt-1 sm:pt-2">
          <button onClick={onSave} className="flex-1 bg-emerald-600 text-white py-2.5 sm:py-3 rounded-xl shadow-lg hover:bg-emerald-700 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95"><Save size={16} /> {isEditing ? 'ATUALIZAR' : 'GRAVAR REGISTO'}</button>
          <button onClick={onCancel} className="bg-slate-100 border border-slate-200 text-slate-400 p-2.5 sm:p-3 rounded-xl hover:text-red-500 transition-all shadow-sm"><X size={18} /></button>
        </div>
      </div>
    </div>
  );
};

const FinancialReportOverlay = ({ logs, workers, clients, expenses, finFilter, setFinFilter, setShowFinReport }) => {
  const { systemSettings } = useApp();
  const [insight, setInsight] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const stats = useMemo(() => {
    let revenue = 0, teamCosts = 0, totalExpenses = 0;
    const filteredLogs = logs.filter(l => (finFilter.start ? l.date >= finFilter.start : true) && (finFilter.end ? l.date <= finFilter.end : true));
    filteredLogs.forEach(log => {
      const w = workers.find(work => work.id === log.workerId);
      const c = clients.find(cl => cl.id === log.clientId);
      revenue += log.hours * (Number(c?.valorHora) || 0);
      teamCosts += log.hours * (Number(w?.valorHora) || 0);
    });
    const filteredExpenses = expenses.filter(e => (finFilter.start ? e.date >= finFilter.start : true) && (finFilter.end ? e.date <= finFilter.end : true));
    filteredExpenses.forEach(exp => totalExpenses += Number(exp.amount) || 0);
    return { revenue, teamCosts, totalExpenses, netProfit: revenue - teamCosts - totalExpenses };
  }, [logs, workers, clients, expenses, finFilter]);

  const generateInsight = async () => {
    setIsAnalyzing(true);
    const prompt = `Analise financeiramente os dados: Faturamento ${stats.revenue}€, Custos Staff ${stats.teamCosts}€, Outras Despesas ${stats.totalExpenses}€, Lucro ${stats.netProfit}€. Sugira 3 estratégias curtas para melhorar o lucro.`;
    const res = await callGemini(prompt, "Você é um consultor financeiro sênior da empresa.", systemSettings.geminiApiKey);
    setInsight(res);
    setIsAnalyzing(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-lg z-[200] flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="bg-white w-full max-w-6xl h-[94vh] rounded-[3rem] flex flex-col shadow-2xl overflow-hidden border border-white/20">
        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/80">
          <div className="flex items-center gap-4">
            <CompanyLogo className="h-10 w-10" />
            <div>
              <h3 className="font-black text-slate-800 text-2xl tracking-tighter">Relatório Financeiro Interno</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Gestão de Rentabilidade</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white p-3 rounded-3xl border border-slate-200 shadow-sm text-slate-900">
            <input type="date" className="bg-slate-50 border-none rounded-xl p-2 text-xs font-bold text-slate-600 outline-none" value={finFilter.start} onChange={e => setFinFilter({ ...finFilter, start: e.target.value })} />
            <span className="text-slate-300">→</span>
            <input type="date" className="bg-slate-50 border-none rounded-xl p-2 text-xs font-bold text-slate-600 outline-none" value={finFilter.end} onChange={e => setFinFilter({ ...finFilter, end: e.target.value })} />
            <button onClick={() => setShowFinReport(false)} className="p-2.5 bg-slate-100 text-slate-400 hover:text-red-500 rounded-xl transition-all shadow-sm"><X size={20} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-white text-slate-900">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100"><div className="flex items-center gap-3 text-indigo-600 mb-2 font-black uppercase text-[10px] tracking-widest">Faturação Potencial</div><p className="text-3xl font-black">{formatCurrency(stats.revenue)}</p></div>
            <div className="bg-red-50 p-6 rounded-3xl border border-red-100"><div className="flex items-center gap-3 text-red-600 mb-2 font-black uppercase text-[10px] tracking-widest">Despesas + Staff</div><p className="text-3xl font-black">{formatCurrency(stats.teamCosts + stats.totalExpenses)}</p></div>
            <div className={`p-6 rounded-3xl border ${stats.netProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <div className={`flex items-center gap-3 mb-2 ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}><Wallet size={20} /><span className="text-[10px] font-black uppercase tracking-widest">Resultado Líquido Estimado</span></div>
              <p className="text-3xl font-black">{formatCurrency(stats.netProfit)}</p>
            </div>
          </div>
          <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 p-8 opacity-10"><BrainCircuit size={120} /></div>
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold flex items-center gap-2"><Sparkles className="text-amber-400" size={20} /> Insights do Consultor AI</h4>
                <button onClick={generateInsight} disabled={isAnalyzing} className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg border border-indigo-400/30 text-white">
                  {isAnalyzing ? "Analisando..." : "Gerar Análise Estratégica"}
                </button>
              </div>
              <p className="text-sm text-slate-300 italic whitespace-pre-line leading-relaxed">{insight || "Clique no botão para que a inteligência artificial analise o desempenho financeiro."}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClientTimesheetReport = ({ data, onBack, isEmbedded = false }) => {
  const { client, logs, workers, clients, month, workerId, clientApprovals } = data;

  const [visibleColumns, setVisibleColumns] = useState({
    day: true,
    start: true,
    breakStart: true,
    breakEnd: true,
    end: true,
    total: true,
    project: true,
    comment: false
  });

  const [isZipping, setIsZipping] = useState(false);

  const columns = [
    { id: 'day', label: 'Dia', width: '30px' },
    { id: 'start', label: 'Entrada', width: '50px' },
    { id: 'breakStart', label: 'I. Desc', width: '50px' },
    { id: 'breakEnd', label: 'F. Desc', width: '50px' },
    { id: 'end', label: 'Saída', width: '50px' },
    { id: 'total', label: 'Total', width: '50px' },
    { id: 'project', label: 'Projeto', width: 'auto' },
    { id: 'comment', label: 'Comentário', width: 'auto' },
  ];

  const activeColumnsCount = Object.values(visibleColumns).filter(Boolean).length;



  // Groups logs and metadata for each individual report unit (Client + Worker pair)
  const reportUnits = useMemo(() => {
    if (!month) return [];

    let filteredLogs = logs.filter(l => l.date.startsWith(month));

    // Determine the grouping criteria based on the data provided
    let units = [];

    if (data.isGlobal) {
      // Global mode: group by (clientId, workerId) for ALL logs in the month
      const pairs = [...new Set(filteredLogs.map(l => `${l.clientId}:::${l.workerId}`))];
      units = pairs.map(pair => {
        const [cId, wId] = pair.split(':::');
        const unitLogs = filteredLogs.filter(l => l.clientId === cId && l.workerId === wId).sort((a, b) => a.date.localeCompare(b.date));
        const uClient = clients.find(c => c.id === cId);
        const uWorker = workers.find(w => w.id === wId);
        if (!uClient || !uWorker) return null;
        return {
          client: uClient,
          worker: uWorker,
          logs: unitLogs,
          totalHours: unitLogs.reduce((acc, l) => acc + calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd), 0),
          id: pair
        };
      }).filter(Boolean);
    } else if (client && !workerId) {
      // Client mode: all workers for ONE specified client
      const clientLogs = filteredLogs.filter(l => l.clientId === client.id);
      const workerIds = [...new Set(clientLogs.map(l => l.workerId))];
      units = workerIds.map(wId => {
        const unitLogs = clientLogs.filter(l => l.workerId === wId).sort((a, b) => a.date.localeCompare(b.date));
        return {
          client,
          worker: workers.find(w => w.id === wId),
          logs: unitLogs,
          totalHours: unitLogs.reduce((acc, l) => acc + calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd), 0),
          id: wId
        };
      });
    } else if (client && workerId) {
      // Specific mode: ONE client + ONE worker
      const specificLogs = filteredLogs.filter(l => l.clientId === client.id && l.workerId === workerId).sort((a, b) => a.date.localeCompare(b.date));
      if (specificLogs.length > 0) {
        units = [{
          client,
          worker: workers.find(w => w.id === workerId),
          logs: specificLogs,
          totalHours: specificLogs.reduce((acc, l) => acc + calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd), 0),
          id: workerId
        }];
      }
    } else if (!client && workerId) {
      // Worker mode (Aggregation): One worker across ALL clients they worked for
      const workerLogs = filteredLogs.filter(l => l.workerId === workerId);
      const clientIds = [...new Set(workerLogs.map(l => l.clientId))];
      units = clientIds.map(cId => {
        const unitLogs = workerLogs.filter(l => l.clientId === cId).sort((a, b) => a.date.localeCompare(b.date));
        return {
          client: clients.find(c => c.id === cId),
          worker: workers.find(w => w.id === workerId),
          logs: unitLogs,
          totalHours: unitLogs.reduce((acc, l) => acc + calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd), 0),
          id: cId
        };
      });
    }

    // Sort units: by Client Name then Worker Name
    return units.sort((a, b) => {
      const cComp = (a.client?.name || '').localeCompare(b.client?.name || '');
      if (cComp !== 0) return cComp;
      return (a.worker?.name || '').localeCompare(b.worker?.name || '');
    });
  }, [logs, client, month, workerId, workers, clients, data.isGlobal]);

  const daysInMonthList = useMemo(() => {
    if (!month || !month.includes('-')) return [];
    const [y, m] = month.split('-').map(Number);
    if (isNaN(y) || isNaN(m)) return [];
    const lastDay = new Date(y, m, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => {
      const d = String(i + 1).padStart(2, '0');
      return `${month}-${d}`;
    });
  }, [month]);

  // Group days by week
  const weeksData = useMemo(() => {
    const groups = {};
    daysInMonthList.forEach(dateStr => {
      const date = new Date(dateStr);
      const weekNum = getISOWeek(date);
      if (!groups[weekNum]) groups[weekNum] = [];
      groups[weekNum].push(dateStr);
    });
    return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
  }, [daysInMonthList]);

  // Update document.title for the PDF filename
  useEffect(() => {
    const originalTitle = document.title;
    if (reportUnits.length === 1) {
      const unit = reportUnits[0];
      const name = unit.worker?.name || 'Colaborador';
      const nameParts = name.trim().split(/\s+/);
      const shortName = nameParts.length > 1
        ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
        : name;

      const monthDisplay = daysInMonthList.length > 0
        ? new Date(daysInMonthList[0]).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
        : '';
      const newTitle = `${shortName} - ${unit.client?.name || 'Empresa'} - ${monthDisplay}`;
      document.title = newTitle;
    } else if (month) {
      const monthDisplay = daysInMonthList.length > 0
        ? new Date(daysInMonthList[0]).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
        : month;
      document.title = `Relatório de Horas - ${monthDisplay}`;
    }

    return () => {
      document.title = originalTitle;
    };
  }, [reportUnits, daysInMonthList, month]);

  const handleGenerateZip = async () => {
    setIsZipping(true);
    try {
      let JSZip = window.JSZip;
      if (!JSZip) {
        JSZip = await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
          script.onload = () => resolve(window.JSZip);
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      let html2pdf = window.html2pdf;
      if (!html2pdf) {
        html2pdf = await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
          script.onload = () => resolve(window.html2pdf);
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const zip = new JSZip();

      // 1. Gerar PDFs dentro das pastas (por trabalhador)
      for (let i = 0; i < reportUnits.length; i++) {
        const unit = reportUnits[i];
        const clientName = unit.client?.name || "Sem_Cliente";
        const workerName = unit.worker?.name || "Sem_Colaborador";

        const clientFolder = zip.folder(clientName);
        const originalElement = document.getElementById(`report-unit-${i}`);

        if (originalElement) {
          originalElement.scrollIntoView({ behavior: 'instant', block: 'start' });

          // Guardamos os estilos originais
          const originalPaddingTop = originalElement.style.paddingTop;
          const originalPaddingBottom = originalElement.style.paddingBottom;
          const originalMinHeight = originalElement.style.minHeight;

          // Aplicamos os ajustes
          originalElement.style.paddingTop = '15px';
          originalElement.style.paddingBottom = '10px';
          originalElement.style.minHeight = 'auto';

          await new Promise(r => setTimeout(r, 400));

          const opt = {
            margin: 0,
            filename: `Relatorio_${workerName.replace(/[^a-zA-Z0-9]/g, '_')}_${month}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 1.5,
              useCORS: true,
              logging: false
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };

          const pdfBlob = await html2pdf().set(opt).from(originalElement).output('blob');
          clientFolder.file(opt.filename, pdfBlob);

          // Devolve a tela ao normal
          originalElement.style.paddingTop = originalPaddingTop;
          originalElement.style.paddingBottom = originalPaddingBottom;
          originalElement.style.minHeight = originalMinHeight;
        }
      }

      // --- CORREÇÃO DO ERRO DO ZIP ---
      const blob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `relatorios de horas ${month}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao gerar ZIP com PDFs:", error);
      alert("Ocorreu um erro ao processar os PDFs. Tente novamente.");
    } finally {
      setIsZipping(false);

      // Dá 100 milissegundos para o React remover o botão de "Carregando"
      setTimeout(() => {
        const alvoTopo = document.getElementById('topo-da-pagina');

        if (alvoTopo) {
          // Desliza a tela de volta para o elemento alvo (garantido!)
          alvoTopo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // Fallback caso você esqueça de colocar o ID
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
    }
  };

  return (
    <div className={`bg-white min-h-screen font-sans text-slate-900 ${isEmbedded ? 'relative w-full' : 'absolute inset-0 z-[500]'} overflow-y-auto print:bg-white print:static print:overflow-visible print:inset-auto print:z-0 print:min-h-0 print:shadow-none print:border-none`}>
      <style dangerouslySetInnerHTML={{
        __html: `
        /* --- FUNDO DA TELA E ESTILO DA PÁGINA A4 --- */
        body {
          background-color: #f1f5f9; 
        }

        .a4-paper {
          width: 794px;
          min-height: 1123px;
          background: white;
          margin: 40px auto;
          padding: 40px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          box-sizing: border-box;
          font-family: 'Inter', sans-serif;
          color: #0f172a;
          line-height: 1 !important;
          position: relative;
        }

        .a4-paper .print-table tr {
          height: 12px !important;
        }

        .a4-paper .print-table td { 
          padding-top: 0px !important; 
          padding-bottom: 0px !important;
          line-height: 0.8 !important;
          font-size: 6.5pt !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }

        .a4-paper .p-3 {
          padding-top: 2px !important;
          padding-bottom: 2px !important;
          margin-top: 2px !important; 
          margin-bottom: 4px !important; 
        }

        .a4-paper .p-3 .text-xl {
          font-size: 12pt !important;
          line-height: 1 !important;
        }

        .a4-paper .mt-8 {
          margin-top: 8px !important;
        }

        .a4-paper .column-header-row th { 
          padding: 1px 2px !important;
          height: 14px !important;
        }

        .a4-paper .week-row td { 
          padding-top: 1px !important;
          padding-bottom: 1px !important;
          height: 18px !important;
          font-size: 8.5pt !important;
        }

        .a4-paper .print-table td div, 
        .a4-paper .print-table td span {
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1 !important;
        }

        .a4-paper .week-spacing { 
          margin-top: 0px !important; 
          margin-bottom: 0px !important; 
        }

        @media print, .zip-export-mode {
          body {
            background-color: white !important;
          }
          .a4-paper {
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
          }
        }

        .a4-paper.page-break:first-of-type {
          break-before: auto !important;
          page-break-before: auto !important;
        }

        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .a4-paper * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .a4-paper .print-table th, 
        .a4-paper .print-table td { 
          padding: 3px 4px !important; 
          font-size: 7.5pt !important;
          border: none !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }

        .a4-paper .week-row td { 
          padding: 6px 8px !important;
          font-size: 9pt !important;
          font-weight: 900 !important;
          border-bottom: 1.5px solid #cbd5e1 !important;
          background-color: #f8fafc !important;
        }

        .a4-paper .column-header-row th { 
          font-size: 6.5pt !important;
          padding: 3px 4px !important;
          background-color: #f1f5f9 !important;
          text-transform: uppercase;
        }

        /* CONTAINER PRINCIPAL DO RELATÓRIO */
        .report-container, .pdf-export-mode {
          background: white !important;
          color: #1e293b !important;
          font-family: 'Inter', sans-serif;
          max-width: 794px;
          margin: 0 auto;
          padding: 20px;
        }

        /* ESCONDER ELEMENTOS NA HORA DE IMPRIMIR */
        @media print {
          .no-print { display: none !important; }
          .report-container { padding: 0; max-width: 100%; }
          
          /* Garantir quebras de página corretas */
          .a4-paper { 
            page-break-after: always !important; 
            break-after: page !important;
          }
          .a4-paper:last-child { 
            page-break-after: auto !important; 
            break-after: auto !important;
          }
          
          /* Evitar quebra dentro de elementos */
          .page-break-inside-avoid { 
            break-inside: avoid !important; 
            page-break-inside: avoid !important; 
          }
          
          /* Forçar quebra antes de cada relatório */
          .a4-paper { 
            page-break-before: auto !important;
          }
        }

        /* TABELAS UNIFICADAS */
        .report-table { border-collapse: collapse; width: 100%; table-layout: auto; margin-bottom: 4px; }
        .report-table th, .report-table td { 
          border: none !important; 
          border-bottom: 1px solid #e2e8f0 !important; 
          padding: 2px 4px !important;
        }
        .report-table th { 
          background-color: #f8fafc !important; 
          color: #64748b !important; 
          font-size: 7pt !important;
          text-transform: uppercase;
        }
        .report-table td { font-size: 8pt !important; }

        /* Larguras fixas para todas as tabelas terem colunas alinhadas */
        .report-table .col-day { width: 40px; min-width: 40px; }
        .report-table .col-time { width: 60px; min-width: 60px; }
        .report-table .col-project { min-width: 120px; }
        .report-table .col-comment { width: auto; }

        .week-row td { 
          background-color: #f8fafc !important; 
          font-weight: 900 !important; 
          font-size: 9pt !important; 
          border-bottom: 1px solid #cbd5e1 !important; 
          color: #0f172a !important; 
          padding: 0 !important;
        }

        .column-header-row th { 
          background-color: #f1f5f9 !important; 
          color: #475569 !important; 
          font-weight: 800 !important; 
        }

        /* QUEBRAS DE PÁGINA */
        .page-break-inside-avoid { break-inside: avoid !important; page-break-inside: avoid !important; }

        /* ESTILOS ADICIONAIS */
        .week-spacing { margin-top: 12px !important; }
        .signature-box { height: 25px !important; }
        .employee-bar-print { padding: 4px 10px !important; margin-bottom: 8px !important; border-radius: 0 !important; border: none !important; }
        .week-header { background: #f1f5f9; font-weight: 700; color: #334155; }
        .employee-bar { background: #f1f5f9; padding: 8px 15px; border-radius: 4px; margin-bottom: 12px; border: none !important; }

        /* ZIP EXPORT MODE - Layout紧凑 para PDF no ZIP */
        .zip-export-mode {
          margin: 0 !important; 
          padding: 0 !important;
        }

        .zip-export-mode html, .zip-export-mode body {
          height: auto !important;
          overflow: visible !important;
        }

        .zip-export-mode .page-break {
          break-before: auto !important;
          page-break-before: auto !important;
        }

        .zip-export-mode .mt-8 { margin-top: 16px !important; }
        .zip-export-mode .pb-2 { padding-bottom: 8px !important; }
        .zip-export-mode .mb-4 { margin-bottom: 12px !important; }
        .zip-export-mode .mb-2 { margin-bottom: 0px !important; }
        .zip-export-mode .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 0px !important; }
        .zip-export-mode .border-b-2.border-slate-900 {
          border-bottom: 2px solid #0f172a !important;
        }
        .zip-export-mode .text-xl { font-size: 14pt !important; }
        .zip-export-mode .text-sm { font-size: 10pt !important; }
        .zip-export-mode .text-\[10px\] { font-size: 8pt !important; }
        .zip-export-mode .text-\[9px\] { font-size: 7pt !important; }
        .zip-export-mode .text-\[7px\] { font-size: 6pt !important; }
        .zip-export-mode .week-spacing { margin-top: 8px !important; }
        .zip-export-mode .print-table th,
        .zip-export-mode .print-table td {
          padding: 3px 4px !important; 
          font-size: 7.5pt !important;
          border: none !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        .zip-export-mode .week-row td {
          padding: 6px 8px !important;
          font-size: 9pt !important;
          font-weight: 900 !important;
          border-bottom: 1.5px solid #cbd5e1 !important;
          background-color: #f8fafc !important;
        }
        .zip-export-mode .column-header-row th {
          font-size: 6.5pt !important;
          padding: 3px 4px !important;
          background-color: #f1f5f9 !important;
          text-transform: uppercase;
        }
        `}} />

      <div className="max-w-5xl mx-auto p-4 sm:p-12 report-container pdf-export-mode">
        {!isEmbedded && (
          <div id="topo-da-pagina" className="no-print flex flex-col gap-6 mb-8 pb-6 border-b">
            <div className="flex justify-between items-center">
              <button onClick={onBack} className="px-6 py-2 bg-slate-100 text-slate-600 font-bold text-xs uppercase rounded-xl hover:bg-slate-200 transition-colors">Voltar</button>
              <div className="flex gap-3">
                <button id="magnetic-zip-btn" onClick={handleGenerateZip} disabled={isZipping} className="px-6 py-2 bg-emerald-600 text-white font-black text-xs uppercase rounded-xl shadow-lg flex items-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50">
                  {isZipping ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Baixar ZIP (PDFs)
                </button>
                <button onClick={() => window.print()} className="px-6 py-2.5 bg-slate-900 text-white font-black text-xs uppercase rounded-xl shadow-lg flex items-center gap-2 hover:bg-slate-800 transition-all"><Printer size={16} /> Imprimir / PDF ({reportUnits.length} {reportUnits.length === 1 ? 'Folha' : 'Folhas'})</button>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Settings2 size={16} className="text-indigo-600" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Selecionar Colunas Visíveis</h4>
                </div>
                <div className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-lg">Gerando {reportUnits.length} documentos individuais</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {columns.map(col => (
                  <button
                    key={col.id}
                    onClick={() => setVisibleColumns(prev => ({ ...prev, [col.id]: !prev[col.id] }))}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all border ${visibleColumns[col.id]
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300'
                      }`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {reportUnits.map((unit, idx) => (
          <div key={`${unit.id}-${idx}`} id={`report-unit-${idx}`} className="a4-paper">
            {/* Header Section */}
            <div className="flex justify-between items-center mb-10 text-slate-900 border-b-2 border-slate-900 pb-3">
              <div className="flex items-center gap-4">
                <CompanyLogo className="h-11 w-auto" />
                <div>
                  <div className="text-[17pt] font-black uppercase tracking-tighter leading-none text-slate-900">Magnetic Place</div>
                  <div className="text-[8pt] font-black uppercase tracking-[0.3em] text-slate-400 mt-0.5">Unipessoal LDA</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[12pt] font-black text-slate-800 uppercase tracking-widest">
                  {daysInMonthList.length > 0 && new Date(daysInMonthList[0]).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                </div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Folha de Horas Mensal • {unit.client?.name || ''}
                </div>
              </div>
            </div>

            <div className="employee-bar employee-bar-print flex justify-between items-center py-2 px-4 bg-slate-50 mb-4 mt-12">
              <div>
                <div className="text-[7px] font-black uppercase text-slate-400 tracking-[0.2em]">Colaborador</div>
                <div className="text-[12pt] font-black text-slate-800 uppercase leading-tight">{unit.worker?.name || 'Vários Colaboradores'}</div>
              </div>
              <div className="text-right">
                <div className="text-[7px] font-black uppercase text-indigo-400 tracking-[0.2em]">Total Registrado</div>
                <div className="text-[13pt] font-black text-indigo-600 leading-tight mt-0.5">{formatHours(unit.totalHours)}</div>
              </div>
            </div>

            {/* Table Section */}
            {/* Weekly Tables Section */}
            <div className="mb-2">
              {weeksData.map(([weekNum, dates]) => {
                let weekPerformed = 0;

                const dayRows = dates.map(dateStr => {
                  const dayLogs = unit.logs.filter(l => l.date === dateStr);
                  const dateObj = new Date(dateStr);
                  const dayNum = dateObj.getDate();
                  const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0, 3);

                  if (dayLogs.length === 0) {
                    return (
                      <tr key={dateStr} className="print-scale">
                        {visibleColumns.day && <td className="text-center font-bold text-slate-400 py-0 col-day">{dayNum} {dayName}</td>}
                        {visibleColumns.start && <td className="border-r border-slate-200 col-time"></td>}
                        {visibleColumns.breakStart && <td className="border-r border-slate-200 col-time"></td>}
                        {visibleColumns.breakEnd && <td className="border-r border-slate-200 col-time"></td>}
                        {visibleColumns.end && <td className="border-r border-slate-200 col-time"></td>}
                        {visibleColumns.total && <td className="border-r border-slate-200 col-time"></td>}
                        {visibleColumns.project && <td className="border-r border-slate-200 col-project"></td>}
                        {visibleColumns.comment && <td className="col-comment"></td>}
                      </tr>
                    );
                  }

                  return dayLogs.map((log, lIdx) => {
                    const isClearedDay = log.startTime == null && log.endTime == null;
                    const logHours = isClearedDay ? 0 : calculateDuration(log.startTime, log.endTime, log.breakStart, log.breakEnd);
                    if (!isClearedDay) {
                      weekPerformed += logHours;
                    }
                    return (
                      <tr key={`${log.id}-${lIdx}`} className="page-break-inside-avoid">
                        {visibleColumns.day && <td className="text-center font-bold text-slate-700 py-0 col-day">{lIdx === 0 ? `${dayNum} ${dayName}` : ''}</td>}
                        {visibleColumns.start && <td className="text-center font-mono col-time">{log.startTime ?? ''}</td>}
                        {visibleColumns.breakStart && <td className="text-center font-mono text-slate-400 col-time">{log.breakStart || ''}</td>}
                        {visibleColumns.breakEnd && <td className="text-center font-mono text-slate-400 col-time">{log.breakEnd || ''}</td>}
                        {visibleColumns.end && <td className="text-center font-mono col-time">{log.endTime ?? ''}</td>}
                        {visibleColumns.total && <td className="text-center font-bold text-slate-700 col-time">{isClearedDay ? '' : formatHours(logHours)}</td>}
                        {visibleColumns.project && <td className="text-center font-medium text-slate-700 uppercase whitespace-nowrap col-project" style={{ fontSize: '8px' }}>{isClearedDay ? '' : (unit.client?.name || '')}</td>}
                        {visibleColumns.comment && <td className="text-center text-slate-500 italic col-comment" style={{ fontSize: '8px' }}>{log.description || ''}</td>}
                      </tr>
                    );
                  });
                }).flat();

                return (
                  <div key={weekNum} className="page-break-inside-avoid shadow-sm week-spacing">
                    <table className="report-table print-table mb-0">
                      <thead>
                        {/* 1. Week Summary Line (Title of the individual table) */}
                        <tr className="week-header week-row bg-slate-50">
                          {visibleColumns.day && <td colSpan="1" className="bg-slate-100 font-black whitespace-nowrap text-[10px] sm:text-xs border-l-0">SEMANA {weekNum}</td>}
                          <td colSpan={Math.max(1, (visibleColumns.start ? 1 : 0) + (visibleColumns.breakStart ? 1 : 0) + (visibleColumns.breakEnd ? 1 : 0) + (visibleColumns.end ? 1 : 0))} className="bg-slate-100 text-right pr-4 text-[7px] uppercase tracking-widest text-slate-400">Total Semanal:</td>
                          {visibleColumns.total && <td className="text-center bg-slate-100 font-black text-slate-900 border-x-2 border-slate-900">{formatHours(weekPerformed)}</td>}
                          <td colSpan={(visibleColumns.project ? 1 : 0) + (visibleColumns.comment ? 1 : 0)} className="bg-slate-100 border-r-0"></td>
                        </tr>

                        {/* 2. Column Headers for this week's table (Fixed widths for alignment) */}
                        <tr className="column-header-row bg-slate-50 border-b border-slate-200">
                          {visibleColumns.day && <th className="text-center col-day">Dia</th>}
                          {visibleColumns.start && <th className="text-center col-time">Entrada</th>}
                          {visibleColumns.breakStart && <th className="text-center col-time">I. Desc</th>}
                          {visibleColumns.breakEnd && <th className="text-center col-time">F. Desc</th>}
                          {visibleColumns.end && <th className="text-center col-time">Saída</th>}
                          {visibleColumns.total && <th className="text-center col-time">Total</th>}
                          {visibleColumns.project && <th className="text-center px-4 col-project">Projeto</th>}
                          {visibleColumns.comment && <th className="text-center px-4 col-comment">Comentário</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {dayRows}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* Final Monthly Summary Section (Isolated from weekly tables) */}
            <div className="bg-white text-black p-4 shadow-none border-y-2 border-slate-900 mt-1 page-break-inside-avoid">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-60">RESUMO MENSAL</span>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-end">
                    <span className="text-[7px] font-bold uppercase opacity-50 mb-0.5">TOTAL REGISTRADO</span>
                    <span className="text-xl font-black text-indigo-600">{formatHours(unit.totalHours)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Signature Section at the bottom */}
            {(() => {
              const approval = clientApprovals?.find(a => a.client_id === unit.client?.id && a.month === month);
              if (approval?.signature_base64) {
                return (
                  <div className="mt-8 pt-6 border-t border-slate-100 page-break-inside-avoid">
                    <div className="flex flex-col items-end">
                      <div className="bg-slate-50 border-2 border-indigo-100 rounded-2xl p-4 relative overflow-hidden shadow-sm flex items-center gap-4">
                        <div className="absolute top-0 right-0 p-1 opacity-5"><CheckCircle size={40} /></div>
                        <div className="bg-white border border-slate-100 rounded-lg p-1.5 shadow-inner">
                          <img src={approval.signature_base64} alt="Assinatura" className="h-12 w-auto mix-blend-multiply" />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 text-indigo-600 font-black text-[9px] uppercase tracking-widest mb-1.5">
                            <span className="bg-indigo-600 text-white p-0.5 rounded-sm"><CheckCircle size={8} /></span>
                            VALIDAÇÃO DIGITAL
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[6.5px] font-bold text-slate-500 uppercase tracking-tight flex justify-between gap-3">
                              <span>Data/Hora:</span>
                              <span className="text-slate-800 font-black">{new Date(approval.created_at).toLocaleString('pt-PT')}</span>
                            </p>
                            <p className="text-[6.5px] font-bold text-slate-500 uppercase tracking-tight flex justify-between gap-3">
                              <span>Endereço IP:</span>
                              <span className="text-slate-800 font-black">{approval.client_ip || 'N/D'}</span>
                            </p>
                            <p className="text-[6.5px] font-bold text-slate-400 uppercase tracking-tight flex justify-between gap-3 mt-1 pt-1 border-t border-slate-100">
                              <span>ID:</span>
                              <span className="font-mono text-slate-400">{approval.id.substring(0, 16)}...</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-[5px] font-bold text-slate-400 mt-1.5 uppercase tracking-[0.2em]">Documento validado eletronicamente</p>
                    </div>
                  </div>
                );
              }
              return (
                <div className="mt-8 pt-6 border-t border-slate-100 opacity-30 page-break-inside-avoid">
                  <div className="flex flex-col items-end">
                    <div className="w-56 h-16 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Aguardando Assinatura</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

    </div>
  );
};


const WorkerDocuments = ({ currentUser, documents, saveToDb }) => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('magnetic_worker_doc_tab') || 'pendentes');

  useEffect(() => {
    localStorage.setItem('magnetic_worker_doc_tab', activeTab);
  }, [activeTab]);

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showSigner, setShowSigner] = useState(false);
  const [signing, setSigning] = useState(false);
  const sigCanvas = useRef(null);

  // Ajustar resolução interna do canvas para coincidir com o ecrã (resolve desfasamento do toque)
  useEffect(() => {
    if (showSigner && sigCanvas.current) {
      const canvas = sigCanvas.current.getCanvas();
      if (canvas) {
        // Pequeno timeout para garantir que o layout terminou de renderizar
        setTimeout(() => {
          const rect = canvas.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            canvas.width = rect.width;
            canvas.height = rect.height;
            sigCanvas.current.clear(); // Limpar para inicializar corretamente com o novo tamanho
          }
        }, 50);
      }
    }
  }, [showSigner]);

  console.log('WorkerDocuments - currentUser:', currentUser?.id);
  console.log('WorkerDocuments - documents count:', documents?.length);
  console.log('WorkerDocuments - first doc:', documents?.[0]);

  const docs = documents?.filter(d => d.workerId === currentUser?.id) || [];
  console.log('WorkerDocuments - filtered docs:', docs.length);

  const pendentes = docs.filter(d => d.status === 'Pendente');
  const historico = docs.filter(d => d.status === 'Assinado');
  console.log('Pendentes:', pendentes.length);
  console.log('Historico:', historico.length);

  const handleSign = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return alert('Assinatura obrigatória.');
    setSigning(true);

    try {
      const sigDataUrl = sigCanvas.current.toDataURL('image/png');
      console.log('Assinatura gerada:', sigDataUrl.substring(0, 50));

      // Upload assinatura
      const sigBlob = await fetch(sigDataUrl).then(r => r.blob());
      const sigPath = `${currentUser.id}/assinaturas/${Date.now()}.png`;
      const { data: sigUpload, error: sigError } = await supabase.storage
        .from('documentos')
        .upload(sigPath, sigBlob);

      if (sigError) throw new Error(`Erro upload assinatura: ${sigError.message}`);

      const { data: sigUrlData } = supabase.storage.from('documentos').getPublicUrl(sigPath);
      const assinaturaUrl = sigUrlData.publicUrl;
      console.log('Assinatura URL:', assinaturaUrl);

      // IP do utilizador
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const userIP = ipData.ip || 'Desconhecido';
      const now = new Date().toISOString();
      const workerName = currentUser?.name || 'Desconhecido';

      // Processar PDF com PDF.co
      console.log('A processar PDF com PDF.co...');

      const pdfCoUrl = 'https://api.pdf.co/v1/pdf/edit/add';
      const pdfCoKey = 'diegobarbosa@magneticplace.pt_QTV2lppvP8euGSGmWWAEU9iZTpb81mZIQqOJM1r9zsVW4weRfuolLhkdzXFTpNFU';

      // Primeira chamada - adicionar texto
      const textResponse = await fetch(pdfCoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': pdfCoKey
        },
        body: JSON.stringify({
          url: selectedDoc.url,
          name: 'Documento_Assinado',
          annotations: [
            {
              text: `Assinado por ${workerName} em ${new Date(now).toLocaleString('pt-PT')} via IP ${userIP}`,
              x: 50, y: 750, width: 450, height: 16,
              fontsize: 9, color: '333333'
            }
          ]
        })
      });

      const textResult = await textResponse.json();
      console.log('Texto adicionado:', textResult);

      if (textResult.error) {
        throw new Error(textResult.error);
      }

      // Segunda chamada - adicionar imagem da assinatura
      const pdfWithSigUrl = textResult.url;

      const imgResponse = await fetch(pdfCoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': pdfCoKey
        },
        body: JSON.stringify({
          url: pdfWithSigUrl,
          name: 'Documento_Assinado_Completo',
          images: [
            {
              url: assinaturaUrl,
              x: 400, y: 700, width: 150, height: 50
            }
          ]
        })
      });

      const imgResult = await imgResponse.json();
      console.log('Imagem adicionada:', imgResult);

      if (imgResult.error) {
        throw new Error(imgResult.error);
      }

      const pdfCoTempUrl = imgResult.url;
      console.log('PDF temporário PDF.co:', pdfCoTempUrl);

      // Fazer download do PDF temporário e fazer upload para Supabase Storage (permanent)
      console.log('A tentar descarregar PDF assinado do PDF.co:', pdfCoTempUrl);

      const pdfBlob = await fetch(pdfCoTempUrl).then(async r => {
        if (!r.ok) throw new Error('Erro ao baixar PDF temporário do PDF.co');
        return await r.blob();
      });

      const pdfPath = `${currentUser.id}/documentos_assinados/${selectedDoc.id}_signed_${Date.now()}.pdf`;
      console.log('A carregar PDF para Supabase Path:', pdfPath);

      const { data: pdfUpload, error: pdfError } = await supabase.storage
        .from('documentos')
        .upload(pdfPath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (pdfError) {
        console.error('Erro crítico no upload para Supabase:', pdfError);
        throw new Error(`Erro ao guardar PDF no seu storage: ${pdfError.message}`);
      }

      const { data: pdfUrlData } = supabase.storage.from('documentos').getPublicUrl(pdfPath);
      const pdfAssinadoUrl = pdfUrlData.publicUrl;
      console.log('PDF Permanente gerado com sucesso:', pdfAssinadoUrl);

      // Guardar
      console.log('A guardar documento com ID:', selectedDoc.id);

      // Criar objeto limpo sem a propriedade 'file'
      const docData = {
        id: selectedDoc.id,
        workerId: selectedDoc.workerId,
        tipo: selectedDoc.tipo,
        nomeFicheiro: selectedDoc.nomeFicheiro,
        url: selectedDoc.url,
        status: 'Assinado',
        assinaturaUrl: assinaturaUrl,
        dataAssinatura: now,
        ipAssinatura: userIP,
        pdfAssinadoUrl: pdfAssinadoUrl,
        dataEmissao: selectedDoc.dataEmissao
      };

      await saveToDb('documentos', selectedDoc.id, docData);

      console.log('Documento guardado com sucesso');
      alert('Documento assinado com sucesso! O PDF será atualizado em breve.');
      setShowSigner(false);
      setSelectedDoc(null);
    } catch (err) {
      console.error('Erro completo:', err);
      alert(`Erro: ${err.message}`);
    }
    setSigning(false);
  };


  const docList = activeTab === 'pendentes' ? pendentes : historico;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-indigo-50/50 mt-8">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
        <FileText size={20} className="text-indigo-600" />
        <h3 className="font-black text-lg uppercase tracking-tight text-slate-800">Os Meus Documentos</h3>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('pendentes')} className={`px-4 py-2 rounded-xl font-bold text-sm ${activeTab === 'pendentes' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
          Pendentes ({pendentes.length})
        </button>
        <button onClick={() => setActiveTab('historico')} className={`px-4 py-2 rounded-xl font-bold text-sm ${activeTab === 'historico' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          Histórico ({historico.length})
        </button>
      </div>

      {docList.length === 0 ? (
        <p className="text-slate-400 text-center py-8">Nenhum documento.</p>
      ) : (
        <div className="space-y-3">
          {docList.sort((a, b) => b.dataEmissao?.localeCompare(a.dataEmissao)).map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-indigo-500" />
                <div>
                  <p className="text-sm font-bold text-slate-700">{doc.tipo}</p>
                  <p className="text-[10px] text-slate-400">{formatDocDate(doc.dataEmissao)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${doc.status === 'Pendente' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {doc.status}
                </span>
                {doc.status === 'Pendente' ? (
                  <button onClick={() => { setSelectedDoc(doc); setShowSigner(true); }} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl">
                    <Edit2 size={14} />
                  </button>
                ) : (
                  <a href={doc.pdfAssinadoUrl || doc.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl">
                    <Download size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showSigner && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-black text-lg">{selectedDoc.tipo}</h4>
              <button onClick={() => setShowSigner(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
            </div>
            <div className="w-full h-96 border rounded-xl mb-4 bg-slate-100 relative">
              {selectedDoc.url ? (
                <iframe
                  src={`${selectedDoc.url}#toolbar=0`}
                  className="w-full h-full rounded-xl"
                  title="Document Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400">Documento não disponível</p>
                </div>
              )}
            </div>
            <div className="bg-slate-50 p-4 rounded-xl mb-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-bold text-slate-500">Desenhe a sua assinatura abaixo:</p>
                <button
                  type="button"
                  onClick={() => sigCanvas.current?.clear()}
                  className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-700 transition-colors"
                >
                  Limpar Área
                </button>
              </div>
              <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden shadow-inner h-40">
                <SignatureCanvas
                  ref={sigCanvas}
                  penColor="black"
                  canvasProps={{
                    className: 'w-full h-full cursor-crosshair'
                  }}
                />
              </div>
            </div>
            <button onClick={handleSign} disabled={signing} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex justify-center gap-2 disabled:opacity-50">
              {signing ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} {signing ? 'A processar...' : 'Confirmar Assinatura'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const DocumentsAdmin = ({ workers = [], documents = [], setDocuments }) => {
  const [selWorker, setSelWorker] = useState('');
  const [selTipo, setSelTipo] = useState('Recibo de Vencimento');
  const [selFile, setSelFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [sortConfig, setSortConfig] = useState({ key: 'dataEmissao', direction: 'desc' });

  const tipos = ['Recibo de Vencimento', 'Mapa de Deslocamento', 'Contrato de Trabalho', 'Outro'];

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const onUpload = async () => {
    if (!selWorker || !selFile) return alert('Selecione tudo.');
    setUploading(true);

    const clientSupabase = supabase || (window.supabase ? window.supabase.createClient('https://ccvxnrnlbipsojbbrzaw.supabase.co', 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ') : null);
    if (!clientSupabase) {
      setUploading(false);
      return alert('A conexão com a base de dados falhou. Por favor, atualize a página (F5) e tente novamente.');
    }

    const docId = `doc_${Date.now()}`;

    // Higienizar totalmente o caminho para evitar erros HTTP 502 no Supabase
    const cleanTipo = selTipo.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanName = selFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${selWorker}/${cleanTipo}/${Date.now()}_${cleanName}`;

    try {
      const { error: upError } = await clientSupabase.storage.from('documentos').upload(path, selFile);
      if (upError) throw upError;

      const { data: urlData } = clientSupabase.storage.from('documentos').getPublicUrl(path);

      const newDoc = {
        id: docId,
        workerId: selWorker,
        tipo: selTipo,
        nomeFicheiro: selFile.name,
        url: urlData.publicUrl,
        status: 'Pendente',
        dataEmissao: new Date().toISOString()
      };

      const { file: _unused, ...docToInsert } = newDoc;

      const { error: dbError } = await supabase
        .from('documents')
        .insert([docToInsert]);

      if (dbError) throw dbError;

      if (setDocuments) {
        setDocuments(prev => [newDoc, ...prev]);
      }
      alert('Documento enviado com sucesso!');
      setSelFile(null);

    } catch (err) {
      console.error("Erro no upload:", err);
      alert(`Erro: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (doc) => {
    if (!window.confirm('Apagar documento permanentemente?')) return;

    try {
      const pathInStorage = doc.url?.includes('/documentos/') ? doc.url.split('/documentos/')[1] : null;

      if (pathInStorage) {
        await supabase.storage.from('documentos').remove([pathInStorage]);
      }

      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      if (setDocuments) {
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
      }
      alert('Apagado com sucesso!');
    } catch (err) {
      alert(`Erro ao apagar: ${err.message}`);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-6">
        <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
          <FileText size={20} />
        </div>
        <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight">Gestão de Documentos</h3>
      </div>

      <div className="bg-slate-50/50 rounded-[2rem] p-6 mb-8 border border-slate-100">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 ml-1">Upload de Novo Ficheiro (PDF)</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Colaborador</label>
            <select
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
              value={selWorker}
              onChange={(e) => setSelWorker(e.target.value)}
            >
              <option value="">Selecionar...</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Tipo</label>
            <select
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
              value={selTipo}
              onChange={(e) => setSelTipo(e.target.value)}
            >
              {tipos.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Ficheiro</label>
            <input
              type="file"
              accept=".pdf"
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs file:hidden cursor-pointer"
              onChange={(e) => setSelFile(e.target.files?.[0])}
            />
          </div>
        </div>
        <button
          onClick={onUpload}
          disabled={uploading || !selWorker || !selFile}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 transition-all hover:bg-slate-900 shadow-lg shadow-indigo-200 active:scale-[0.98]"
        >
          {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
          {uploading ? 'A Enviar ficheiro...' : 'Submeter Documento'}
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Pesquisar por colaborador ou ficheiro..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="w-full md:w-48 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="Todos">Todos os Estados</option>
          <option value="Pendente">Pendentes</option>
          <option value="Assinado">Assinados</option>
        </select>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-slate-400">
              <th
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => requestSort('dataEmissao')}
              >
                Data {sortConfig.key === 'dataEmissao' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => requestSort('workerName')}
              >
                Colaborador {sortConfig.key === 'workerName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => requestSort('tipo')}
              >
                Tipo / Nome {sortConfig.key === 'tipo' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => requestSort('status')}
              >
                Estado {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-2 opacity-30">
                    <FileText size={40} />
                    <p className="text-xs font-black uppercase tracking-widest">Sem documentos registados</p>
                  </div>
                </td>
              </tr>
            ) : (
              [...documents]
                .map(doc => ({
                  ...doc,
                  workerName: workers.find(w => w.id === doc.workerId)?.name || 'Desconhecido'
                }))
                .filter(doc => {
                  const matchSearch = doc.workerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (doc.nomeFicheiro || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    doc.tipo.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchStatus = statusFilter === 'Todos' || doc.status === statusFilter;
                  return matchSearch && matchStatus;
                })
                .sort((a, b) => {
                  const aVal = a[sortConfig.key] || '';
                  const bVal = b[sortConfig.key] || '';
                  if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                  if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                  return 0;
                })
                .map(doc => {
                  const worker = workers.find(w => w.id === doc.workerId);
                  return (
                    <tr key={doc.id} className="bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300">
                      <td className="px-4 py-4 rounded-l-2xl border-y border-l border-slate-100">
                        <span className="text-xs font-bold text-slate-500 font-mono">
                          {formatDocDate(doc.dataEmissao, true)}
                        </span>
                      </td>
                      <td className="px-4 py-4 border-y border-slate-100">
                        <p className="text-sm font-black text-slate-800">{worker?.name || 'Desconhecido'}</p>
                      </td>
                      <td className="px-4 py-4 border-y border-slate-100">
                        <p className="text-xs font-bold text-slate-500">{doc.nomeFicheiro || doc.tipo}</p>
                      </td>
                      <td className="px-4 py-4 border-y border-slate-100">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${doc.status === 'Assinado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {doc.status || 'Pendente'}
                        </span>
                      </td>
                      <td className="px-4 py-4 rounded-r-2xl border-y border-r border-slate-100 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                            title="Visualizar Original"
                          >
                            <Eye size={16} />
                          </a>
                          {doc.pdfAssinadoUrl && (
                            <a
                              href={doc.pdfAssinadoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 bg-white text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                              title="Visualizar Assinado"
                            >
                              <CheckCircle size={16} />
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteDoc(doc)}
                            className="p-2 bg-white text-rose-500 rounded-xl border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};




const NotificationsAdmin = ({ workers, appNotifications, saveToDb, handleDelete }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [targetType, setTargetType] = useState('all');
  const [isDismissible, setIsDismissible] = useState(true);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showViewDetails, setShowViewDetails] = useState(null); // ID do aviso para ver detalhes
  const [viewDetailsTab, setViewDetailsTab] = useState('viewed'); // 'viewed' | 'dismissed'

  const handleAdd = async () => {
    if (!title || !message) return alert('Preencha o título e a mensagem!');
    setLoading(true);
    const id = "notif_" + Date.now();
    const newNotif = {
      id,
      title,
      message,
      type,
      target_type: targetType,
      target_worker_ids: targetType === 'specific' ? selectedWorkers : [],
      is_dismissible: isDismissible,
      is_active: true,
      created_at: new Date().toISOString()
    };
    await saveToDb('app_notifications', id, newNotif);
    setTitle('');
    setMessage('');
    setSelectedWorkers([]);
    setLoading(false);
    alert('Aviso criado com sucesso!');
  };

  const toggleStatus = async (notif) => {
    const updated = { ...notif, is_active: !notif.is_active };
    await saveToDb('app_notifications', notif.id, updated);
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-6">
        <div className="bg-amber-50 p-2 rounded-xl text-amber-600">
          <Megaphone size={20} />
        </div>
        <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight">Gestão de Banners de Aviso</h3>
      </div>

      <div className="bg-slate-50/50 rounded-[2rem] p-6 mb-8 border border-slate-100">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 ml-1">Criar Novo Aviso</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Título do Banner</label>
            <input
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none font-medium"
              placeholder="Ex: Reunião Geral"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Tipo / Estilo</label>
            <select
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none font-medium"
              value={type}
              onChange={e => setType(e.target.value)}
            >
              <option value="info">Informação (Azul)</option>
              <option value="warning">Aviso (Laranja)</option>
              <option value="urgent">Urgente (Vermelho)</option>
              <option value="success">Sucesso (Verde)</option>
            </select>
          </div>
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              id="dismissible"
              checked={isDismissible}
              onChange={e => setIsDismissible(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
            />
            <label htmlFor="dismissible" className="text-[10px] font-bold text-slate-600 uppercase cursor-pointer">
              Permitir que o trabalhador feche este aviso
            </label>
          </div>
        </div>
        <div className="space-y-1 mb-4">
          <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Mensagem</label>
          <textarea
            className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none font-medium h-20"
            placeholder="Escreva aqui o conteúdo do aviso..."
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Público-Alvo</label>
            <select
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none font-medium"
              value={targetType}
              onChange={e => setTargetType(e.target.value)}
            >
              <option value="all">Todos os Trabalhadores</option>
              <option value="specific">Apenas trabalhadores selecionados</option>
            </select>
          </div>
          {targetType === 'specific' && (
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Selecionar Trabalhadores</label>
              <div className="flex flex-wrap gap-2 p-2 min-h-[42px] rounded-xl border border-slate-200 bg-white">
                {workers.map(w => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setSelectedWorkers(prev =>
                        prev.includes(w.id) ? prev.filter(id => id !== w.id) : [...prev, w.id]
                      )
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${selectedWorkers.includes(w.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={loading}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} Criar Aviso no App
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Avisos Existentes</p>
        {appNotifications.length === 0 ? (
          <p className="text-center py-10 text-slate-400 text-xs font-bold">Nenhum aviso criado.</p>
        ) : (
          appNotifications.filter(n =>
            n.is_active &&
            !n.title?.includes('Pedido de Correção') &&
            !n.title?.includes('Contra-proposta')
          ).map(notif => (
            <div key={notif.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${notif.type === 'urgent' ? 'bg-rose-50 text-rose-600' :
                  notif.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                    notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-blue-50 text-blue-600'
                  }`}>
                  <Bell size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800 truncate">{notif.title}</p>
                  <p className="text-[10px] text-slate-400 truncate">{notif.message}</p>
                  <p className="text-[9px] font-bold text-indigo-500 uppercase mt-1">
                    🎯 {notif.target_type === 'all' ? 'Todos' : `${notif.target_worker_ids?.length || 0} específicos`} • {notif.is_dismissible ? 'Fechável' : 'Fixo'}
                  </p>
                  <div
                    onClick={() => setShowViewDetails(notif.id)}
                    className="mt-2 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="flex -space-x-2">
                      {(notif.viewed_by_ids || []).slice(0, 5).map(vId => (
                        <div key={vId} title={workers.find(w => w.id === vId)?.name} className="w-5 h-5 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-indigo-600 uppercase">
                          {workers.find(w => w.id === vId)?.name?.[0] || '?'}
                        </div>
                      ))}
                      {(notif.viewed_by_ids || []).length > 5 && (
                        <div className="w-5 h-5 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[7px] font-black text-slate-500">
                          +{(notif.viewed_by_ids || []).length - 5}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      {(notif.viewed_by_ids || []).length} Viu
                    </span>
                    {notif.is_dismissible && (
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">
                        • {(notif.dismissed_by_ids || []).length} Fechou
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleStatus(notif)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${notif.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                    }`}
                >
                  {notif.is_active ? 'Ativo' : 'Pausado'}
                </button>
                <button
                  onClick={() => handleDelete('app_notifications', notif.id)}
                  className="p-2 text-rose-300 hover:text-rose-600 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Detalhes de Visualização */}
      {showViewDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Detalhes do Aviso</h3>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Registo de Interação</p>
              </div>
              <button onClick={() => setShowViewDetails(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setViewDetailsTab('viewed')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewDetailsTab === 'viewed' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
              >
                Visualizaram ({(appNotifications.find(n => n.id === showViewDetails)?.viewed_by_ids || []).length})
              </button>
              {appNotifications.find(n => n.id === showViewDetails)?.is_dismissible && (
                <button
                  onClick={() => setViewDetailsTab('dismissed')}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewDetailsTab === 'dismissed' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}
                >
                  Fecharam ({(appNotifications.find(n => n.id === showViewDetails)?.dismissed_by_ids || []).length})
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {(appNotifications.find(n => n.id === showViewDetails)?.[viewDetailsTab === 'viewed' ? 'viewed_by_ids' : 'dismissed_by_ids'] || []).length > 0 ? (
                (appNotifications.find(n => n.id === showViewDetails)?.[viewDetailsTab === 'viewed' ? 'viewed_by_ids' : 'dismissed_by_ids'] || []).map(vId => {
                  const worker = workers.find(w => w.id === vId);
                  return (
                    <div key={vId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center font-black text-xs uppercase ${viewDetailsTab === 'viewed' ? 'bg-indigo-600' : 'bg-rose-500'}`}>
                        {worker?.name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{worker?.name || 'Desconhecido'}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">{worker?.profissao || 'Colaborador'}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm font-bold text-slate-400 italic">Nenhum registo encontrado.</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowViewDetails(null)}
              className="w-full mt-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const LoginView = ({ workers, onLogin, systemSettings, setSystemSettings }) => {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  // Detecção de iOS e se já está instalado
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      const newState = !showIosInstructions;
      setShowIosInstructions(newState);
      if (newState) {
        // Pequeno atraso para garantir que o elemento foi renderizado no DOM após o estado mudar
        setTimeout(() => {
          const el = document.getElementById('ios-instructions');
          if (el) {
            el.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            });
          }
        }, 300);
      }
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };



  const handleSubmit = (e) => {
    e.preventDefault();
    if (user === 'admin' && pass === systemSettings.adminPassword) {
      onLogin('admin');
      return;
    }

    // Procura o trabalhador pelo primeiro e último nome juntos em minúsculas
    const found = workers.find(w => {
      if (!w.name) return false;
      const parts = w.name.trim().split(/\s+/);
      const first = parts[0].toLowerCase();
      const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
      const workerLogin = first + last;
      return workerLogin === user.toLowerCase().trim();
    });

    if (found) {
      const validPass = (found.nif || "").toString().trim();
      if (validPass === pass.trim()) {
        if (found.status === 'inativo') {
          setError('A sua conta está inativa. Contacte a administração.');
          return;
        }
        onLogin('worker', found);
      } else {
        setError('Senha incorreta (utilize o seu NIF)');
      }
    } else {
      setError('Utilizador não encontrado (use o seu primeiro e último nome juntos, ex: joaosilva)');
    }
  };

  const showInstallButton = (deferredPrompt || (isIOS && !isStandalone));

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans text-slate-900">
      <div className="max-w-md w-full bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl p-8 sm:p-12 border border-slate-200">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <CompanyLogo className="h-32 w-32 object-contain drop-shadow-xl" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter uppercase">{systemSettings.companyName}</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">Acesso ao Sistema</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Utilizador</label>
            <div className="relative"><UserCircle className="absolute left-4 top-4 text-slate-300" size={20} /><input type="text" value={user} onChange={e => setUser(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl p-4 pl-12 text-sm outline-none transition-all shadow-inner text-slate-900" placeholder="ex: joaosilva" required /></div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Senha</label>
            <div className="relative"><Lock className="absolute left-4 top-4 text-slate-300" size={20} /><input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl p-4 pl-12 text-sm outline-none transition-all shadow-inner text-slate-900" placeholder="O seu NIF" required /></div>
          </div>
          {error && <div className="p-4 bg-red-50 text-red-500 text-xs font-bold rounded-2xl flex items-center gap-3 animate-pulse"><AlertCircle size={16} /> {error}</div>}
          <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-slate-800 active:scale-95 transition-all">Entrar</button>

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-4">
            {/* Botão de Instalação Unificado */}
            {showInstallButton && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:from-indigo-700 hover:to-indigo-800 shadow-xl shadow-indigo-100 flex justify-center items-center gap-3 animate-bounce-subtle transition-all transform active:scale-95"
              >
                <div className="bg-white/20 p-1.5 rounded-lg"><Download size={20} /></div>
                Instalar no Telemóvel
              </button>
            )}

            {/* Instruções para iPhone (iOS) - Mostra apenas após clique */}
            {isIOS && showIosInstructions && (
              <div id="ios-instructions" className="bg-amber-50 rounded-2xl p-5 border border-amber-200 animate-in zoom-in-95 duration-300 ring-2 ring-amber-100">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <ExternalLink size={18} className="text-amber-600" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-900">Guia Visual iPhone</h4>
                  </div>
                  <button onClick={() => setShowIosInstructions(false)} className="text-amber-400 p-1 hover:text-amber-600"><X size={16} /></button>
                </div>

                <div className="mb-4 rounded-xl overflow-hidden border border-amber-100 shadow-sm">
                  <img src="ios-guide.png" alt="Guia de Instalação iOS" className="w-full h-auto object-cover" />
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-amber-800 leading-relaxed">Mais fácil do que parece:</p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-3 text-[10px] font-medium text-amber-700 bg-white/70 p-2.5 rounded-xl border border-amber-100">
                      <span className="bg-amber-200 text-amber-900 w-5 h-5 flex items-center justify-center rounded-full font-black text-[9px]">1</span>
                      Toque no ícone de <span className="font-black mx-1">Partilhar</span> em baixo.
                    </li>
                    <li className="flex items-center gap-3 text-[10px] font-medium text-amber-700 bg-white/70 p-2.5 rounded-xl border border-amber-100">
                      <span className="bg-amber-200 text-amber-900 w-5 h-5 flex items-center justify-center rounded-full font-black text-[9px]">2</span>
                      Escolha <span className="font-black mx-1">"Ecrã de Início"</span>.
                    </li>
                  </ul>
                  <button onClick={() => setShowIosInstructions(false)} className="w-full py-2 bg-amber-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest mt-2 hover:bg-amber-700 transition-colors">Entendido</button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s infinite ease-in-out;
        }
      `}} />
    </div>
  );
};

function AdminDashboard(props) {
  const {
    onLogout,
    onLogin,
    adminStats,
    currentMonth,
    setCurrentMonth,
    activeTab,
    setActiveTab,
    clients,
    workers,
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
              {['overview', 'team', 'clients', 'portal_validacao', 'schedules', 'expenses', 'reports', 'documentos', 'notificacoes', 'settings'].map(t => (
                <button key={t} onClick={() => { setActiveTab(t); setAuditWorkerId(null); }} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === t ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'} ${t === 'portal_validacao' && unviewedCorrectionsCount > 0 ? 'animate-pulse' : ''}`}>
                  {t === 'overview' ? 'Geral' : t === 'team' ? 'Equipa' : t === 'clients' ? 'Clientes' : t === 'portal_validacao' ? (
                    <span className="flex items-center gap-1">Portal Validação {unviewedCorrectionsCount > 0 && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{unviewedCorrectionsCount}</span>}</span>
                  ) : t === 'schedules' ? 'Horários' : t === 'expenses' ? 'Despesas' : t === 'reports' ? 'Relatórios' : t === 'documentos' ? 'Documentos' : t === 'notificacoes' ? 'Notificações' : <Settings size={14} />}
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
                  <thead className="bg-slate-50 border-b border-slate-100"><tr><th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest w-32">Dia</th><th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest">Actividades</th><th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-right">Ação</th></tr></thead>
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
                                      <div className="text-sm font-bold font-mono">{log.startTime}—{log.endTime} {log.breakStart ? `(P: ${log.breakStart})` : ''}</div>
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
            <div className="animate-in fade-in duration-500 space-y-8">
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

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
                  <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl w-fit"><Clock size={24} /></div>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horas Totais</p><p className="text-3xl font-black">{formatHours(adminStats.totalHours)}</p></div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
                  <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl w-fit"><TrendingUp size={24} /></div>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Faturação Estimada</p><p className="text-3xl font-black">{formatCurrency(adminStats.expectedRevenue)}</p></div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
                  <div className="bg-rose-50 text-rose-600 p-3 rounded-2xl w-fit"><TrendingDown size={24} /></div>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Custos Globais</p><p className="text-3xl font-black">{formatCurrency(adminStats.expectedCosts + adminStats.monthlyExpenses)}</p></div>
                </div>
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl shadow-xl flex flex-col gap-4 text-white">
                  <div className="bg-white/20 p-3 rounded-2xl w-fit"><Wallet size={24} /></div>
                  <div><p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Resultado Líquido</p><p className="text-3xl font-black">{formatCurrency(adminStats.netProfit)}</p></div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-blue-50 p-2 rounded-xl text-blue-600"><History size={20} /></div>
                    <h3 className="font-black text-lg text-slate-800">Atividade Recente</h3>
                  </div>
                  <div className="space-y-4">
                    {logs.slice().sort((a, b) => new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id)).slice(0, 5).map(log => (
                      <div key={log.id} className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                        <div className="bg-slate-100 p-2 rounded-xl text-slate-400 mt-1"><Activity size={14} /></div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">{workers.find(w => w.id === log.workerId)?.name || 'Colaborador'}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{clients.find(c => c.id === log.clientId)?.name} • {new Date(log.date).toLocaleDateString('pt-PT')}</p>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-1 italic">{log.description || 'Registo sem descrição detalhada.'}</p>
                        </div>
                        <div className="ml-auto text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                          {formatHours(log.hours)}
                        </div>
                      </div>
                    ))}
                    {logs.length === 0 && <p className="text-xs text-slate-400 italic">Sem atividade registada recentemente.</p>}
                  </div>
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
                    <FileText size={20} /> Gerar Seleção
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
            <ValidationPortal
              onLogin={onLogin}
              portalMonth={portalMonth}
              setPortalMonth={setPortalMonth}
              correctionNotifications={correctionNotifications}
              clientApprovals={clientApprovals}
              setClienteSelecionado={setClienteSelecionado}
              setModalEmailAberto={setModalEmailAberto}
              setPrintingReport={setPrintingReport}
            />
          )}
          {!auditWorkerId && activeTab === 'schedules' && <ScheduleManager />}

          {/* Módulo Despesas */}
          {!auditWorkerId && activeTab === 'expenses' && <ExpenseManager />}
          {!auditWorkerId && activeTab === 'documentos' && (
            <DocumentsAdmin workers={workers} documents={documents} setDocuments={setDocuments} />
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
                        <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1"><span>●</span> IA activa</p>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-1"><span>●</span> IA inactiva — configure a chave</p>
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

// --- Worker Dashboard ---

function WorkerDashboard(props) {
  const { onLogout, onLogin, currentUser, setCurrentUser, currentMonth, setCurrentMonth, logs, clients, schedules, personalSchedules, mainFormData, setMainFormData, handleSaveEntry, saveToDb, handleDelete, approvals, handleApproveMonth, systemSettings, documents, appNotifications } = props;
  const [inlineEditingDate, setInlineEditingDate] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [inlineFormData, setInlineFormData] = useState({});
  const [showSchedulesModal, setShowSchedulesModal] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [expandedDays, setExpandedDays] = useState([]);
  const [showPersonalBreaks, setShowPersonalBreaks] = useState(false);
  const [newPersonalForm, setNewPersonalForm] = useState({ name: '', startTime: '', breakStart: '', breakEnd: '', endTime: '', weekdays: [1, 2, 3, 4, 5] });

  const todayStr = toISODateLocal(new Date());
  const monthLogs = logs.filter(l => l.workerId === currentUser.id && isSameMonth(l.date, currentMonth));
  const todayHours = monthLogs.filter(l => l.date === todayStr).reduce((a, b) => a + calculateDuration(b.startTime, b.endTime, b.breakStart, b.breakEnd), 0);
  const totalMonthHours = monthLogs.reduce((acc, curr) => acc + calculateDuration(curr.startTime, curr.endTime, curr.breakStart, curr.breakEnd), 0);

  const activeWorkerSchedule = schedules.find(s => s.id === currentUser.defaultScheduleId) || personalSchedules.find(p => p.id === currentUser.defaultScheduleId);
  const expectedHours = activeWorkerSchedule ? calculateExpectedMonthlyHours(activeWorkerSchedule, currentMonth) : 0;

  const daysList = Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }, (_, i) => toISODateLocal(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1)));

  const assigned = schedules.filter(s => currentUser.assignedSchedules?.includes(s.id));
  const myPersonals = personalSchedules.filter(ps => ps.workerId === currentUser.id);

  const currentMonthStr = toISODateLocal(currentMonth).substring(0, 7);
  const myApproval = approvals.find(a => a.workerId === currentUser.id && a.month === currentMonthStr);
  const [dismissedNotifs, setDismissedNotifs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`dismissed_notifs_${currentUser.id}`) || '[]');
    } catch { return []; }
  });

  const myNotifications = [];

  const handleDismissNotif = async (id) => {
    const updated = [...dismissedNotifs, id];
    setDismissedNotifs(updated);
    localStorage.setItem(`dismissed_notifs_${currentUser.id}`, JSON.stringify(updated));

    const notif = appNotifications?.find(n => n.id === id);
    if (notif && supabase) {
      const dismissedIds = notif.dismissed_by_ids || [];
      if (!dismissedIds.includes(currentUser.id)) {
        await supabase.from('app_notifications').update({
          dismissed_by_ids: [...dismissedIds, currentUser.id]
        }).eq('id', id);
      }
    }
  };

  // Registar visualização automática
  useEffect(() => {
    if (!currentUser || !appNotifications || appNotifications.length === 0) return;

    myNotifications.forEach(async (notif) => {
      const viewedIds = notif.viewed_by_ids || [];
      if (!viewedIds.includes(currentUser.id)) {
        const updatedNotif = {
          ...notif,
          viewed_by_ids: [...viewedIds, currentUser.id]
        };
        // Gravação silenciosa no DB
        if (supabase) {
          await supabase.from('app_notifications').update({
            viewed_by_ids: updatedNotif.viewed_by_ids
          }).eq('id', notif.id);
        }
      }
    });
  }, [currentUser?.id]);

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const lastBizDay = getLastBusinessDayOfMonth(currentMonth);
  lastBizDay.setHours(0, 0, 0, 0);
  const isEndOfMonth = todayDate.getTime() >= lastBizDay.getTime();

  const pendingApprovals = useMemo(() => {
    const pending = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkPending = (d) => {
      const mStr = toISODateLocal(d).substring(0, 7);
      const lBiz = getLastBusinessDayOfMonth(d);
      lBiz.setHours(0, 0, 0, 0);
      if (today.getTime() >= lBiz.getTime()) {
        const isApproved = approvals.some(a => a.workerId === currentUser.id && a.month === mStr);
        // Só pedir aprovação se tiver registos ou se for o mês atual?
        // Vamos pedir sempre se passou o dia útil.
        if (!isApproved) {
          pending.push({ date: d, monthStr: mStr });
        }
      }
    };

    checkPending(new Date()); // Mês atual

    const prevM = new Date();
    prevM.setMonth(prevM.getMonth() - 1);
    checkPending(prevM); // Mês anterior

    return pending;
  }, [approvals, currentUser.id]);

  const handleOpenInlineForm = (ds) => {
    if (!expandedDays.includes(ds)) setExpandedDays(prev => [...prev, ds]);
    setInlineEditingDate(ds);
    setInlineFormData({
      id: null, date: ds, clientId: currentUser.defaultClientId || '', startTime: '', breakStart: '', breakEnd: '', endTime: '', description: ''
    });
  };

  const handleQuickRegister = (ds) => {
    const s = schedules.find(s => s.id === currentUser.defaultScheduleId) || myPersonals.find(p => p.id === currentUser.defaultScheduleId);
    if (!currentUser.defaultClientId || !s) {
      handleOpenInlineForm(ds);
      return;
    }
    const dsConfig = getScheduleForDay(s, ds);
    if (!dsConfig) { handleOpenInlineForm(ds); return; }
    handleSaveEntry({
      clientId: currentUser.defaultClientId, startTime: dsConfig.startTime, breakStart: dsConfig.breakStart, breakEnd: dsConfig.breakEnd, endTime: dsConfig.endTime, description: 'Registo Rápido (Padrão)'
    }, false, ds);
  };

  const savePersonalSchedule = () => {
    if (!newPersonalForm.name) return;
    const pId = `ps${Date.now()}`;
    saveToDb('personalSchedules', pId, { ...newPersonalForm, id: pId, workerId: currentUser.id });
    setNewPersonalForm({ name: '', startTime: '', breakStart: '', breakEnd: '', endTime: '', weekdays: [1, 2, 3, 4, 5] });
  };

  const setDefaultSchedule = (sId) => {
    saveToDb('workers', currentUser.id, { ...currentUser, defaultScheduleId: sId });
    setCurrentUser(prev => ({ ...prev, defaultScheduleId: sId }));
  };

  const formatShortName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    const first = parts[0];
    const last = parts[parts.length - 1];
    const middle = parts.slice(1, -1).map(p => p[0].toUpperCase() + '.').join(' ');
    return `${first} ${middle} ${last}`;
  };

  const formatTimeCompact = (timeStr) => {
    if (!timeStr) return '--h';
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h)) return '--h';
    return `${h}h${m === 0 ? '' : m.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32 font-sans relative">
      {currentUser.isAdminImpersonating && (
        <div className="bg-indigo-600 text-white p-2 text-center text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-lg sticky top-0 z-[100]">
          <span>Modo Visualização Admin (Impersonando: {currentUser.name})</span>
          <button
            onClick={() => onLogin('admin')}
            className="bg-white text-indigo-600 px-3 py-1 rounded-full hover:bg-indigo-50 transition-all shadow-sm"
          >
            Voltar ao Painel Admin
          </button>
        </div>
      )}
      <nav className="bg-white border-b border-slate-200 h-16 flex items-center px-4 md:px-6 justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <CompanyLogo className="h-10 w-10 object-contain" />
          <div className="flex flex-col">
            <p className="text-sm sm:text-base font-black leading-none text-slate-800 uppercase tracking-tight">{formatShortName(currentUser.name)}</p>
            <p className="text-[9px] sm:text-[10px] text-indigo-500 uppercase font-black tracking-widest mt-1">
              {currentUser.profissao || 'Colaborador'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => setShowSchedulesModal(true)} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black shadow-sm">
            {activeWorkerSchedule && (
              <span className="text-[9px] sm:text-xs opacity-70 border-r border-indigo-200 pr-2 mr-1 inline-block leading-tight text-right uppercase">
                <span className="block">{formatTimeCompact(activeWorkerSchedule.startTime)} - {formatTimeCompact(activeWorkerSchedule.endTime)}</span>
                {activeWorkerSchedule.breakStart && (
                  <span className="block text-[8px] sm:text-[9px] font-bold text-indigo-400/80">P: {formatTimeCompact(activeWorkerSchedule.breakStart)}-{formatTimeCompact(activeWorkerSchedule.breakEnd)}</span>
                )}
              </span>
            )}
            <Timer size={16} className="shrink-0" />
            <span className="hidden sm:inline">Meus Horários</span>
          </button>

          <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-600 transition-all"><LogOut size={18} /></button>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 mt-6 md:mt-8">
        {/* Notificações de Fim de Mês - PRIORIDADE MÁXIMA */}
        {pendingApprovals.map((pending, idx) => {
          const isViewingThisMonth = pending.monthStr === currentMonthStr;

          return (
            <div key={`pending-${pending.monthStr}`} className="mb-8 animate-in slide-in-from-top-4 duration-700">
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-1 shadow-2xl ring-4 ring-indigo-500/20">
                <div className="bg-white/95 backdrop-blur-sm rounded-[2.4rem] p-6 sm:p-8">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="bg-indigo-100 p-4 rounded-2xl text-indigo-600 shadow-inner animate-pulse">
                        <Clock size={32} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                          Validar Horas de {pending.date.toLocaleDateString('pt-PT', { month: 'long' })}
                        </h3>
                        <p className="text-sm font-bold text-slate-500 mt-1">
                          {isViewingThisMonth
                            ? "O mês terminou. Verifica os teus registos e submete para aprovação."
                            : "Ainda tens horas de um mês anterior por validar. Por favor, revê e submete."}
                        </p>
                      </div>
                    </div>
                    {isViewingThisMonth ? (
                      <button
                        onClick={() => handleApproveMonth(currentUser.id)}
                        className="w-full md:w-auto px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-indigo-200 active:scale-95 flex items-center justify-center gap-3"
                      >
                        <CheckCircle size={18} /> Confirmar e Enviar
                      </button>
                    ) : (
                      <button
                        onClick={() => setCurrentMonth(new Date(pending.date.getFullYear(), pending.date.getMonth(), 1))}
                        className="w-full md:w-auto px-10 py-4 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-orange-200 active:scale-95 flex items-center justify-center gap-3"
                      >
                        <Clock size={18} /> Rever e Validar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Notificação de Assinaturas Pendentes */}
        {(documents || []).filter(d => !d.signed_at && d.workerId === currentUser?.id).length > 0 && (
          <div className="mb-8 animate-in slide-in-from-top-4 duration-700">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-[2.5rem] p-1 shadow-lg">
              <div className="bg-white/95 backdrop-blur-sm rounded-[2.4rem] p-6 sm:p-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="bg-amber-100 p-4 rounded-2xl text-amber-600 shadow-inner">
                      <AlertCircle size={32} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Assinaturas Pendentes</h3>
                      <p className="text-sm font-bold text-slate-500 mt-1">Tens documentos importantes que requerem a tua validação e assinatura digital.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const el = document.getElementById('secao-documentos');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="w-full md:w-auto px-10 py-4 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-orange-200 active:scale-95 flex items-center justify-center gap-3"
                  >
                    <Edit2 size={18} /> Assinar Agora
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}


        <div className="bg-slate-900 rounded-[2.5rem] md:rounded-[3rem] p-5 md:p-8 mb-6 md:mb-8 shadow-2xl text-white flex flex-col md:flex-row justify-between items-center gap-6 md:gap-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:rotate-12 transition-transform duration-700 hidden sm:block"><CompanyLogo className="h-64 w-64 filter invert grayscale" /></div>
          <div className="relative z-10 w-full md:flex-1 mb-2 md:mb-0">
            <h2 className="text-3xl md:text-5xl font-black mb-4 leading-tight text-white text-center md:text-left uppercase tracking-tighter">Olá, {currentUser.name.split(' ')[0]}!</h2>
            <div className="flex items-center justify-center md:justify-start gap-3 bg-white/10 p-2 rounded-2xl w-full sm:w-fit">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 hover:bg-white/20 rounded-xl text-white"><ChevronLeft size={16} /></button>
              <div className="text-indigo-200 flex items-center gap-2 text-sm font-bold font-mono uppercase tracking-widest min-w-[120px] justify-center"><Calendar size={18} /> {new Date(currentMonth).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</div>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 hover:bg-white/20 rounded-xl text-white"><ChevronRight size={16} /></button>
            </div>
            {expectedHours > 0 && (
              <button onClick={() => setShowProgress(!showProgress)} className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-300/80 hover:text-indigo-200 transition-colors bg-white/5 px-4 py-2 rounded-xl border border-white/5 mx-auto md:mx-0">
                <TrendingUp size={14} /> {showProgress ? 'Ocultar Progresso' : 'Ver Meta Mensal'}
              </button>
            )}
          </div>
          <div className="relative z-10 flex flex-row gap-4 w-full md:w-auto">
            <div className="bg-white/10 backdrop-blur-xl p-6 sm:p-8 rounded-3xl md:rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center flex-1 md:min-w-[150px]">
              <p className="text-[10px] font-black uppercase opacity-70 mb-1">Horas Hoje</p>
              <div className="text-3xl sm:text-5xl font-black">{formatHours(todayHours)}</div>
            </div>
            <div className="bg-indigo-500/20 backdrop-blur-xl p-6 sm:p-8 rounded-3xl md:rounded-[2.5rem] border border-indigo-400/30 flex flex-col items-center justify-center flex-1 md:min-w-[150px] shadow-inner relative">
              <p className="text-[10px] font-black uppercase text-indigo-200 mb-1">Total Mês</p>
              <div className="flex flex-col items-center mb-1 text-center">
                <div className="text-3xl sm:text-5xl font-black text-indigo-50 flex items-baseline gap-2 justify-center">
                  {formatHours(totalMonthHours)}
                </div>
              </div>
              {myApproval && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-[9px] font-black uppercase text-emerald-300 bg-emerald-500/20 px-2 sm:px-3 py-1.5 rounded-xl sm:rounded-full border border-emerald-400/30 w-full sm:w-auto text-center mt-2">
                  <div className="flex items-center gap-1"><CheckCircle size={12} className="shrink-0" /> <span className="hidden sm:inline">Aprovado</span></div>
                  <span className="opacity-90">{new Date(myApproval.timestamp).toLocaleDateString('pt-PT')}</span>
                </div>
              )}
            </div>
          </div>

          {expectedHours > 0 && showProgress && (
            <div className="relative z-10 w-full mt-8 md:mt-12 pt-6 md:pt-10 border-t border-white/10 animate-in slide-in-from-top-4 duration-500">
              <div className="flex justify-between items-end mb-4">
                <div className="flex flex-col gap-0.5">
                  <p className="text-[10px] font-black uppercase text-indigo-300 tracking-[0.2em]">Meta Mensal</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl md:text-5xl font-black text-white">{formatHours(expectedHours)}</span>
                  </div>
                </div>
                <div className="bg-indigo-500/30 px-4 py-2 rounded-2xl border border-indigo-400/40 shadow-lg">
                  <span className="text-xl md:text-2xl font-black text-indigo-100">{Math.round((totalMonthHours / expectedHours) * 100)}%</span>
                </div>
              </div>
              <div className="h-4 bg-slate-800/80 rounded-full p-1 border border-white/5 shadow-inner backdrop-blur-sm">
                <div
                  className="h-full bg-gradient-to-r from-indigo-600 via-indigo-400 to-indigo-300 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all duration-[1500ms] ease-out relative overflow-hidden"
                  style={{ width: `${Math.min(100, (totalMonthHours / expectedHours) * 100)}%` }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] animate-[shimmer_2s_infinite]" style={{ backgroundSize: '200% 100%' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {myApproval ? (
          <div className="mb-10 bg-emerald-50/80 border border-emerald-200 rounded-[3rem] p-12 text-center text-emerald-800 shadow-inner animate-in zoom-in-95">
            <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <CheckCircle size={40} className="text-emerald-500" />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-widest mb-2">Mês Validado e Fechado</h3>
            <p className="text-sm font-bold opacity-70 max-w-md mx-auto">As horas de {new Date(currentMonth).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })} já foram aprovadas e enviadas para a administração. Não é possível adicionar novos registos ou apagar os existentes.</p>
          </div>
        ) : (
          <div className="mb-8">
            {successMsg && (
              <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 font-bold rounded-2xl flex items-center justify-center gap-3 border border-emerald-100 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                <CheckCircle size={24} className="text-emerald-500" />
                <span>{successMsg}</span>
              </div>
            )}
            <EntryForm data={mainFormData} clients={clients} assignedClients={currentUser.assignedClients} onChange={setMainFormData} onSave={() => {
              if (!mainFormData.clientId || !mainFormData.startTime || !mainFormData.endTime) {
                handleSaveEntry(mainFormData, true); // Will just return inside
                return;
              }
              handleSaveEntry(mainFormData, true);
              setSuccessMsg('Registo inserido com sucesso!');
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setTimeout(() => setSuccessMsg(''), 6000);
            }} onCancel={() => {
              setMainFormData({ id: null, date: todayStr, clientId: currentUser.defaultClientId || '', startTime: '', breakStart: '', breakEnd: '', endTime: '', description: '' });
            }} showDate title="Novo Registo de Atividade" />
          </div>
        )}



        <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden mb-12">
          <div className="hidden md:grid grid-cols-[120px_1fr_150px] gap-6 bg-slate-50 border-b border-slate-100 px-8 py-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Dia</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Actividades</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Ação</div>
          </div>
          <div className="divide-y divide-slate-100">
            {daysList.map(ds => {
              const dayLogs = monthLogs.filter(l => l.date === ds);
              const dayTotalTotal = dayLogs.reduce((acc, l) => acc + calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd), 0);
              const isCurrentInline = inlineEditingDate === ds;
              const isExpanded = expandedDays.includes(ds);
              const dObj = new Date(ds);

              const toggleExpand = () => {
                if (isExpanded) {
                  setExpandedDays(prev => prev.filter(d => d !== ds));
                  if (isCurrentInline) setInlineEditingDate(null);
                } else {
                  setExpandedDays(prev => [...prev, ds]);
                  if (dayLogs.length === 0) handleOpenInlineForm(ds);
                }
              };

              return (
                <React.Fragment key={ds}>
                  <div
                    onClick={toggleExpand}
                    className={`p-4 md:px-8 md:py-6 transition-all border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${dObj.getDay() === 0 || dObj.getDay() === 6 ? 'bg-slate-50/40' : ''} ${isExpanded ? 'bg-indigo-50/20' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2 md:grid md:grid-cols-[120px_1fr_220px]">

                      <div className="flex md:flex-col items-baseline md:items-start gap-2 md:gap-0">
                        <span className="text-2xl font-black text-slate-800">{dObj.getDate()}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">{dObj.toLocaleDateString('pt-PT', { weekday: 'short' })}</span>
                      </div>

                      <div className="flex-1 flex items-center justify-between md:justify-start gap-4">
                        {dayTotalTotal > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-indigo-600">{formatHours(dayTotalTotal)} registradas</span>
                            {!isExpanded && <span className="text-[10px] text-slate-300 font-bold hidden lg:inline">• Detalhes</span>}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Sem registos</span>
                        )}
                      </div>

                      <div className="flex justify-end items-center gap-2">
                        {!myApproval && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); handleQuickRegister(ds); }} title="Registo Rápido" className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-xl transition-all shadow-sm"><Zap size={16} /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleOpenInlineForm(ds); }} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm"><Plus size={16} /></button>
                          </>
                        )}
                        <div className="ml-1 border-l border-slate-100 pl-3">
                          {isExpanded ? <ChevronUp size={20} className="text-indigo-400" /> : <ChevronDown size={20} className="text-slate-300" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 md:px-12 md:py-8 bg-slate-50/50 border-b border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-4">
                        {dayLogs.length > 0 ? (
                          <div className="space-y-3">
                            {dayLogs.map(log => (
                              <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm w-full">
                                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                  <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-1.5 rounded-lg border border-indigo-100 uppercase">{clients.find(c => c.id === log.clientId)?.name || 'Cliente'}</span>
                                  <div className="text-xs font-bold font-mono text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">{log.startTime}-{log.endTime}</div>
                                  {(log.breakStart || log.breakEnd) && (
                                    <div className="text-[9px] font-bold text-orange-500 bg-orange-50 px-2 py-1.5 rounded-lg border border-orange-100">
                                      Pausa: {log.breakStart || '--:--'} às {log.breakEnd || '--:--'}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-row items-center justify-between sm:justify-end gap-4 sm:border-l sm:pl-4 border-slate-100 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 mt-2 sm:mt-0">
                                  <span className="text-lg sm:text-sm font-black text-indigo-700">{formatHours(calculateDuration(log.startTime, log.endTime, log.breakStart, log.breakEnd))}</span>
                                  {!myApproval && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete('logs', log.id); }} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm"><Trash2 size={18} /></button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center py-4 bg-white rounded-2xl border border-dashed border-slate-200">Não existem tarefas detalhadas para este dia.</p>
                        )}

                        {isCurrentInline && (
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <EntryForm isInline data={inlineFormData} clients={clients} assignedClients={currentUser.assignedClients} onChange={setInlineFormData} onSave={() => { handleSaveEntry(inlineFormData, false, ds); setInlineEditingDate(null); }} onCancel={() => setInlineEditingDate(null)} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>


        <div id="secao-documentos" className="mt-8">
          <WorkerDocuments currentUser={currentUser} documents={documents} saveToDb={saveToDb} />
        </div>
      </main>


      {/* Modal Horários Pessoais */}
      {showSchedulesModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8 border-b pb-4">
              <h3 className="text-2xl font-black flex items-center gap-3"><Timer className="text-indigo-600" /> Meus Horários</h3>
              <button onClick={() => setShowSchedulesModal(false)} className="p-2 text-slate-300 hover:text-red-500"><X size={24} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pela Empresa</h4>
                <div className="space-y-2">
                  {assigned.length > 0 ? assigned.map(s => (
                    <div key={s.id} className={`p-4 rounded-2xl border flex justify-between items-center ${currentUser.defaultScheduleId === s.id ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div>
                        <p className="text-xs font-black">{s.name}</p>
                        {s.isAdvanced ? (
                          <div className="mt-2 space-y-1">
                            {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(d => {
                              const config = s.dailyConfigs && s.dailyConfigs[d.v];
                              if (!config || !config.isActive) return null;
                              return (
                                <div key={d.v} className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-600">
                                  <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded flex-shrink-0 w-6 text-center uppercase">{d.l}</span>
                                  <span>{config.startTime}-{config.endTime}</span>
                                  {config.breakStart && <span className="text-orange-500 flex items-center ml-1"><Coffee size={10} className="mr-0.5" /> {config.breakStart}-{config.breakEnd}</span>}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            <p className="text-sm sm:text-base font-black text-slate-900 mb-1 leading-none">{s.startTime || '--:--'} - {s.endTime || '--:--'}</p>
                            {s.breakStart && (
                              <div className="flex items-center gap-1 text-[9px] font-black text-orange-500 uppercase">
                                <Coffee size={10} /> Pausa: {s.breakStart} - {s.breakEnd || '--:--'}
                              </div>
                            )}
                            <div className="flex gap-0.5 mt-1">
                              {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(d => {
                                const isActive = (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
                                return isActive ? <span key={d.v} className="bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded text-[8px] font-black uppercase">{d.l}</span> : null;
                              })}
                            </div>
                          </>
                        )}
                      </div>
                      <button onClick={() => setDefaultSchedule(s.id)} title="Definir como Padrão" className={`p-2 rounded-xl transition-all ${currentUser.defaultScheduleId === s.id ? 'text-amber-500 bg-amber-100' : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100'}`}>
                        <Star fill={currentUser.defaultScheduleId === s.id ? 'currentColor' : 'none'} size={16} />
                      </button>
                    </div>
                  )) : <p className="text-xs text-slate-400 italic">Sem turnos atribuídos.</p>}
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pessoais</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {myPersonals.map(s => (
                    <div key={s.id} className={`p-4 rounded-2xl border flex justify-between items-center ${currentUser.defaultScheduleId === s.id ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50/50 border-emerald-100'}`}>
                      <div>
                        <p className="text-xs font-black">{s.name}</p>
                        {s.isAdvanced ? (
                          <div className="mt-2 space-y-1">
                            {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(d => {
                              const config = s.dailyConfigs && s.dailyConfigs[d.v];
                              if (!config || !config.isActive) return null;
                              return (
                                <div key={d.v} className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-600">
                                  <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded flex-shrink-0 w-6 text-center uppercase">{d.l}</span>
                                  <span>{config.startTime}-{config.endTime}</span>
                                  {config.breakStart && <span className="text-orange-500 flex items-center ml-1"><Coffee size={10} className="mr-0.5" /> {config.breakStart}-{config.breakEnd}</span>}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            <p className="text-sm sm:text-base font-black text-slate-900 mb-1 leading-none">{s.startTime || '--:--'} - {s.endTime || '--:--'}</p>
                            {s.breakStart && (
                              <div className="flex items-center gap-1 text-[9px] font-black text-emerald-600 uppercase">
                                <Coffee size={10} /> Pausa: {s.breakStart} - {s.breakEnd || '--:--'}
                              </div>
                            )}
                            <div className="flex gap-0.5 mt-1">
                              {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(d => {
                                const isActive = (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
                                return isActive ? <span key={d.v} className="bg-emerald-100 text-emerald-600 px-1 py-0.5 rounded text-[8px] font-black uppercase">{d.l}</span> : null;
                              })}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setDefaultSchedule(s.id)} title="Definir como Padrão" className={`p-2 rounded-xl transition-all ${currentUser.defaultScheduleId === s.id ? 'text-amber-500 bg-amber-100' : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100'}`}>
                          <Star fill={currentUser.defaultScheduleId === s.id ? 'currentColor' : 'none'} size={14} />
                        </button>
                        <button onClick={() => handleDelete('personalSchedules', s.id)} className="p-2 text-red-300 hover:text-red-500 bg-white rounded-xl"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-slate-50 rounded-3xl border border-dashed border-slate-300 space-y-3">
                  <input type="text" placeholder="Nome do turno..." className="w-full p-2 text-xs rounded-xl border-none outline-none bg-white" value={newPersonalForm.name} onChange={e => setNewPersonalForm({ ...newPersonalForm, name: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-1">Entrada</label><input type="time" className="w-full p-2 text-xs rounded-xl border-none bg-white font-bold text-indigo-600" value={newPersonalForm.startTime} onChange={e => setNewPersonalForm({ ...newPersonalForm, startTime: e.target.value })} /></div>
                    <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-1">Saída</label><input type="time" className="w-full p-2 text-xs rounded-xl border-none bg-white font-bold text-indigo-600" value={newPersonalForm.endTime} onChange={e => setNewPersonalForm({ ...newPersonalForm, endTime: e.target.value })} /></div>
                  </div>

                  <button type="button" onClick={() => setShowPersonalBreaks(!showPersonalBreaks)} className="text-[9px] font-black uppercase text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 py-1">
                    {showPersonalBreaks ? '× Ocultar Pausa' : '+ Adicionar Pausa'}
                  </button>

                  {showPersonalBreaks && (
                    <div className="grid grid-cols-2 gap-2 p-2 bg-white/50 rounded-xl animate-in slide-in-from-top-1 duration-200">
                      <div className="space-y-1"><label className="text-[8px] font-black uppercase text-orange-400 ml-1">Pausa I.</label><input type="time" className="w-full p-2 text-xs rounded-xl border-none bg-white text-orange-600" value={newPersonalForm.breakStart} onChange={e => setNewPersonalForm({ ...newPersonalForm, breakStart: e.target.value })} /></div>
                      <div className="space-y-1"><label className="text-[8px] font-black uppercase text-orange-400 ml-1">Pausa F.</label><input type="time" className="w-full p-2 text-xs rounded-xl border-none bg-white text-orange-600" value={newPersonalForm.breakEnd} onChange={e => setNewPersonalForm({ ...newPersonalForm, breakEnd: e.target.value })} /></div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1 justify-center">
                    {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(day => {
                      const isActive = (newPersonalForm.weekdays || [1, 2, 3, 4, 5]).includes(day.v);
                      return (
                        <button type="button" key={day.v} onClick={() => {
                          const current = newPersonalForm.weekdays || [1, 2, 3, 4, 5];
                          const updated = isActive ? current.filter(d => d !== day.v) : [...current, day.v];
                          setNewPersonalForm({ ...newPersonalForm, weekdays: updated });
                        }} className={`px-2 py-1 rounded text-[9px] font-black transition-all ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-400 hover:bg-slate-200'}`}>
                          {day.l}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={savePersonalSchedule} className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase mt-2 shadow-md">Adicionar Pessoal</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- App Principal ---

function App(props) {

  const {
    systemSettings, setSystemSettings,
    view, setView,
    currentUser, setCurrentUser,
    currentMonth, setCurrentMonth,
    clients, setClients,
    workers, setWorkers,
    schedules, setSchedules,
    personalSchedules, setPersonalSchedules,
    logs, setLogs,
    expenses, setExpenses,
    correcoesCorrections, setCorrecoesCorrections,
    approvals, setApprovals,
    documents, setDocuments,
    clientApprovals, setClientApprovals,
    appNotifications, setAppNotifications,
    isDbReady,
    saveToDb,
    handleDelete,
    supabase: supabaseInstance
  } = useApp();

  // Re-define local supabase variable for legacy compatibility in this file if needed
  supabase = supabaseInstance;

  useEffect(() => {
    document.title = "Magnetic Place | Gestão";
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = 'MAGNETIC (3).png';
  }, []);


  const [activeTab, setActiveTab] = useState('overview');
  const [portalMonth, setPortalMonth] = useState(new Date());
  const [portalSubTab, setPortalSubTab] = useState('envios');
  const [printingReport, setPrintingReport] = useState(null);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [modalEmailAberto, setModalEmailAberto] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [modalRejeitarAberto, setModalRejeitarAberto] = useState(false);
  const [rejeitarMotivo, setRejeitarMotivo] = useState('');
  const [rejeitarNotif, setRejeitarNotif] = useState(null);

  const [auditWorkerId, setAuditWorkerId] = useState(null);
  const [showFinReport, setShowFinReport] = useState(false);
  const [finFilter, setFinFilter] = useState({ start: toISODateLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), end: toISODateLocal(new Date()) });
  const [mainFormData, setMainFormData] = useState({ id: null, date: toISODateLocal(new Date()), clientId: '', startTime: '', breakStart: '', breakEnd: '', endTime: '', description: '' });

  const adminStats = useMemo(() => {
    const monthLogs = logs.filter(l => isSameMonth(l.date, currentMonth));
    const totalHours = monthLogs.reduce((acc, curr) => acc + curr.hours, 0);

    let expectedRevenue = 0;
    let expectedCosts = 0;
    const clientHours = {};

    monthLogs.forEach(l => {
      clientHours[l.clientId] = (clientHours[l.clientId] || 0) + l.hours;
      const client = clients.find(c => c.id === l.clientId);
      const worker = workers.find(w => w.id === l.workerId);
      if (client) expectedRevenue += l.hours * (Number(client.valorHora) || 0);
      if (worker) expectedCosts += l.hours * (Number(worker.valorHora) || 0);
    });

    const monthlyExpenses = expenses.filter(e => isSameMonth(e.date, currentMonth)).reduce((a, b) => a + Number(b.amount), 0);

    const topClientsList = Object.keys(clientHours)
      .map(id => ({ name: clients.find(c => c.id === id)?.name || 'Desconhecido', hours: clientHours[id] }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    const topClientName = topClientsList[0]?.name || "---";

    return {
      totalHours,
      topClientName,
      expectedRevenue,
      expectedCosts,
      monthlyExpenses,
      netProfit: expectedRevenue - expectedCosts - monthlyExpenses,
      topClientsList
    };
  }, [logs, currentMonth, clients, workers, expenses]);

  const [dismissedNotifs, setDismissedNotifs] = useState(() => {
    if (!currentUser) return [];
    try {
      return JSON.parse(localStorage.getItem(`dismissed_notifs_${currentUser.id}`) || '[]');
    } catch { return []; }
  });

  const myNotifications = useMemo(() => {
    if (!currentUser || !appNotifications) return [];
    return appNotifications.filter(n =>
      n.is_active &&
      (n.target_type === 'all' ||
        (currentUser.role === 'admin' && n.target_type === 'admin') ||
        (n.target_worker_ids && n.target_worker_ids.includes(currentUser.id))) &&
      !dismissedNotifs.includes(n.id)
    );
  }, [appNotifications, currentUser, dismissedNotifs]);

  const correctionNotifications = useMemo(() => {
    return correcoesCorrections.filter(c => c.status === 'pending');
  }, [correcoesCorrections]);

  const handleDismissNotif = async (id) => {
    setDismissedNotifs(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      if (currentUser) {
        localStorage.setItem(`dismissed_notifs_${currentUser.id}`, JSON.stringify(updated));
      }
      return updated;
    });

    const notif = appNotifications?.find(n => n.id === id);
    if (notif && supabase && currentUser) {
      const dismissedIds = notif.dismissed_by_ids || [];
      if (!dismissedIds.includes(currentUser.id)) {
        await supabase.from('app_notifications').update({
          dismissed_by_ids: [...dismissedIds, currentUser.id]
        }).eq('id', id);
      }
    }
  };

  useEffect(() => {
    if (!currentUser || !myNotifications.length) return;
    myNotifications.forEach(async (notif) => {
      const viewedIds = notif.viewed_by_ids || [];
      if (!viewedIds.includes(currentUser.id)) {
        if (supabase) {
          await supabase.from('app_notifications').update({
            viewed_by_ids: [...viewedIds, currentUser.id]
          }).eq('id', notif.id);
        }
      }
    });
  }, [currentUser?.id]);

  useEffect(() => {
    if (activeTab === 'portal_validacao' && portalSubTab === 'correcoes' && currentUser?.role === 'admin' && myNotifications.length > 0) {
      const toDismiss = myNotifications.filter(n => n.title?.includes('Pedido de Correção') || n.title?.includes('MENSAGEM DE DIVERGÊNCIA'));
      if (toDismiss.length > 0) {
        console.log('Auto-descartando notificações de correção pois a sub-aba correcoes está ativa');
        toDismiss.forEach(n => handleDismissNotif(n.id));
      }
    }
  }, [activeTab, portalSubTab, myNotifications, currentUser?.role]);

  const handleBannerClick = (notif) => {
    console.log('Banner clicado:', notif.title);
    // 1. Descarta imediatamente para sumir visualmente
    handleDismissNotif(notif.id);

    // 2. Navega se for um pedido de correção ou mensagem rápida
    if ((notif.title?.includes('Pedido de Correção') || notif.title?.includes('MENSAGEM DE DIVERGÊNCIA')) && currentUser.role === 'admin') {
      setActiveTab('portal_validacao');
      setPortalSubTab('correcoes');
      setView('admin');
    }
  };

  const handleLogin = (role, user = null) => {
    const userData = user || { id: 'admin_system', name: 'Admin', role: 'admin' };
    setCurrentUser(userData);
    setView(role);
    localStorage.setItem('magnetic_view', role);
    localStorage.setItem('magnetic_user', JSON.stringify(userData));
    if (role === 'worker' && user) {
      setMainFormData(prev => ({ ...prev, clientId: user.defaultClientId || '', startTime: '', breakStart: '', breakEnd: '', endTime: '' }));
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('login');
    localStorage.removeItem('magnetic_view');
    localStorage.removeItem('magnetic_user');
  };


  const handleDisparoEmail = async () => {
    if (!clienteSelecionado) return;
    setIsSendingEmail(true);

    const monthStr = `${portalMonth.getFullYear()}-${String(portalMonth.getMonth() + 1).padStart(2, '0')}`;
    const modalLinkUnico = clienteSelecionado.link_gerado || `${CLIENT_PORTAL_URL}/?view=client_portal&client=${String(clienteSelecionado.id)}&month=${monthStr}`;
    const totalHoras = formatHours(logs.filter(l => l.clientId === clienteSelecionado.id && l.date?.substring(0, 7) === monthStr).reduce((acc, l) => acc + l.hours, 0));

    // Configurações da sua conta EmailJS
    const EMAILJS_SERVICE_ID = "service_xvt0vm8"; // Substitua pelo seu Service ID
    const EMAILJS_TEMPLATE_ID = "template_o5csfq8"; // Substitua pelo seu Template ID
    const EMAILJS_PUBLIC_KEY = "SzlA6KKCD4miw0CR9"; // Substitua pela sua Public Key

    // O sistema agora avança diretamente para o envio via EmailJS
    try {
      // Prepara os parâmetros que o template vai usar no EmailJS
      const templateParams = {
        to_email: clienteSelecionado.email || 'contato@cliente.pt',
        to_name: clienteSelecionado.name,
        mes_referencia: portalMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
        total_horas: totalHoras,
        link_unico: modalLinkUnico
      };

      // Chama a API do EmailJS para envio em background real
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );

      const updatedClient = { ...clienteSelecionado, status_email: `enviado_${monthStr}` };
      saveToDb('clients', updatedClient.id, updatedClient);
      setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));

      setToastMessage('E-mail enviado com sucesso!');
      setTimeout(() => setToastMessage(null), 4000);

    } catch (error) {
      console.error('Falha no envio do e-mail:', error);
      alert('Houve um erro a enviar o e-mail pela API. Verifique a consola.');
    } finally {
      setIsSendingEmail(false);
      setModalEmailAberto(false);
      setClienteSelecionado(null);
    }
  };

  const handleConfirmarRejeicao = async () => {
    if (!rejeitarNotif) return;
    if (rejeitarMotivo.trim().length < 10) {
      alert('Por favor, insira um motivo com pelo menos 10 caracteres.');
      return;
    }
    const targetClient = clients.find(c => String(c.id) === String(rejeitarNotif.target_client_id));
    let rawTargetMonth = rejeitarNotif.payload?.month || '';
    // Convert "abril de 2026" format to "2026-04" for URL parameter
    if (rawTargetMonth && !rawTargetMonth.match(/^\d{4}-\d{2}$/)) {
      const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      const lowerMonth = rawTargetMonth.toLowerCase();
      const monthIdx = months.findIndex(m => lowerMonth.includes(m));
      const yearMatch = rawTargetMonth.match(/\d{4}/);
      if (monthIdx >= 0 && yearMatch) {
        rawTargetMonth = `${yearMatch[0]}-${String(monthIdx + 1).padStart(2, '0')}`;
      }
    }
    const monthLabel = (rejeitarNotif.message.match(/📅 Período: (.+)\n/)?.[1] || rawTargetMonth || '').trim();
    const rejectNotifId = "reject_" + Date.now();
    const fbNotifData = {
      id: rejectNotifId,
      title: `Reporte de Divergência Rejeitado: ${monthLabel || rawTargetMonth || ''}`,
      message: `O seu reporte de divergência referente ao período de ${monthLabel || rawTargetMonth || ''} foi rejeitado pelo administrador.\n\nMotivo: ${rejeitarMotivo.trim()}\n\nPor favor, aceda ao portal para rever e submeter um novo reporte caso necessário.`,
      type: 'error',
      target_type: 'client',
      target_client_id: String(rejeitarNotif.target_client_id),
      created_at: new Date().toISOString(),
      is_active: true,
      payload: { type: 'correcao_rejeitada', motivo: rejeitarMotivo.trim() }
    };
    const monthFromMsg = rejeitarNotif.message.match(/📅 Período: (.+)\n/)?.[1] || '';
    if (!rawTargetMonth && monthFromMsg) {
      const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      const lowerMonth = monthFromMsg.toLowerCase();
      const monthIdx = months.findIndex(m => lowerMonth.includes(m));
      const yearMatch = monthFromMsg.match(/\d{4}/);
      if (monthIdx >= 0 && yearMatch) {
        rawTargetMonth = `${yearMatch[0]}-${String(monthIdx + 1).padStart(2, '0')}`;
      }
    }
    await saveToDb('app_notifications', rejectNotifId, fbNotifData);
    if (targetClient?.email) {
      await sendNotificationEmail(targetClient.email, targetClient.name, fbNotifData.title, fbNotifData.message, rejeitarNotif.target_client_id, rawTargetMonth);
    }
    if (rejeitarNotif.payload?.correcao_id) {
      const existingCorrecao = correcoesCorrections.find(c => c.id === rejeitarNotif.payload.correcao_id);
      if (existingCorrecao) {
        await saveToDb('correcoes', rejeitarNotif.payload.correcao_id, { ...existingCorrecao, status: 'rejected' });
      }
    }
    await handleDelete('app_notifications', rejeitarNotif.id);
    setModalRejeitarAberto(false);
    setRejeitarMotivo('');
    setRejeitarNotif(null);
    setToastMessage('Correção rejeitada e cliente notificado!');
    setTimeout(() => setToastMessage(null), 4000);
  };


  const handleSaveEntry = (formData, isMain = false, inlineDate = null) => {
    if (!formData.clientId || !formData.startTime || !formData.endTime) return;
    const hours = calculateDuration(formData.startTime, formData.endTime, formData.breakStart, formData.breakEnd);
    const dateToSave = isMain ? formData.date : inlineDate;
    const wId = (currentUser.role === 'admin' ? auditWorkerId : currentUser.id);
    const logId = formData.id || `l${Date.now()}`;

    const toMins = (t) => { if (!t || t === '--:--') return 0; const [h, m] = t.split(':'); return parseInt(h) * 60 + parseInt(m); };
    const newStart = toMins(formData.startTime);
    const newEnd = toMins(formData.endTime);

    const existingLogs = logs.filter(l =>
      String(l.workerId) === String(wId) &&
      l.date === dateToSave &&
      String(l.clientId) === String(formData.clientId) &&
      l.id !== logId
    );

    for (const log of existingLogs) {
      const existingStart = toMins(log.startTime);
      const existingEnd = toMins(log.endTime);
      if (newStart < existingEnd && newEnd > existingStart) {
        alert(`Já existe um registo das ${log.startTime} às ${log.endTime} nesse dia. Não é permitido sobrepor horários.`);
        return;
      }
    }

    saveToDb('logs', logId, { ...formData, date: dateToSave, hours, workerId: wId, id: logId });


    if (isMain) {
      const resetClientId = currentUser?.role === 'worker' ? (currentUser.defaultClientId || '') : '';
      setMainFormData(prev => ({ ...prev, description: '', startTime: '', breakStart: '', breakEnd: '', endTime: '', clientId: resetClientId }));
    }
  };

  const handleApproveMonth = (workerId) => {
    const monthStr = toISODateLocal(currentMonth).substring(0, 7);
    const id = "appr_" + workerId + "_" + monthStr;
    saveToDb('approvals', id, { id, workerId, month: monthStr, timestamp: new Date().toISOString() });
  };

  return (
    <div className="text-slate-900 bg-slate-50 min-h-screen font-sans">
      {(view === 'admin' || view === 'worker') && currentUser && myNotifications.length > 0 && (
        <div className="fixed top-4 left-4 right-4 z-[9999] pointer-events-none space-y-3 max-w-xl mx-auto">
          {myNotifications.map(notif => (
            <div key={notif.id} onClick={() => handleBannerClick(notif)} className={`pointer-events-auto animate-in slide-in-from-top-4 duration-700 ${notif.title?.includes('Pedido de Correção') ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all' : ''}`}>
              <div className={`rounded-[2rem] p-0.5 shadow-2xl ${notif.type === 'urgent' ? 'bg-gradient-to-br from-rose-500 to-red-600' :
                notif.type === 'warning' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                  notif.type === 'success' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' :
                    'bg-gradient-to-br from-indigo-500 to-violet-600'
                }`}>
                <div className="bg-white/95 backdrop-blur-md rounded-[1.95rem] p-4 shadow-inner">
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-2xl ${notif.type === 'urgent' ? 'bg-rose-50 text-rose-600' :
                      notif.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                        notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-indigo-50 text-indigo-600'
                      }`}>
                      {notif.type === 'urgent' ? <AlertCircle size={20} /> : <Megaphone size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">{notif.title}</h3>
                      <p className="text-[10px] font-bold text-slate-500 mt-0.5 leading-tight line-clamp-1">
                        {notif.title.includes('Pedido de Correção') ? notif.message.split('\n')[0] : notif.message}
                      </p>
                    </div>
                    {notif.is_dismissible && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDismissNotif(notif.id); }}
                        className="p-1.5 text-slate-300 hover:text-slate-600 transition-all hover:bg-slate-50 rounded-xl"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {view === 'login' && <LoginView workers={workers} onLogin={handleLogin} systemSettings={systemSettings} setSystemSettings={setSystemSettings} />}
      {view === 'admin' && (
        <AdminDashboard
          onLogout={handleLogout}
          onLogin={handleLogin}
          adminStats={adminStats}
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          clients={clients}
          workers={workers}
          schedules={schedules}
          auditWorkerId={auditWorkerId}
          setAuditWorkerId={setAuditWorkerId}
          setShowFinReport={setShowFinReport}
          logs={logs}
          handleSaveEntry={handleSaveEntry}
          printingReport={printingReport}
          setPrintingReport={setPrintingReport}
          handleDelete={handleDelete}
          approvals={approvals}
          clientApprovals={clientApprovals}
          systemSettings={systemSettings}
          documents={documents}
          setDocuments={setDocuments}
          correctionNotifications={correctionNotifications}
          setClienteSelecionado={setClienteSelecionado}
          setModalEmailAberto={setModalEmailAberto}
          portalSubTab={portalSubTab}
          setPortalSubTab={setPortalSubTab}
          portalMonth={portalMonth}
          setPortalMonth={setPortalMonth}
          setModalRejeitarAberto={setModalRejeitarAberto}
          setRejeitarMotivo={setRejeitarMotivo}
          setRejeitarNotif={setRejeitarNotif}
        />
      )}
      {view === 'worker' && (
        <WorkerDashboard
          {...{ onLogout: handleLogout, onLogin: handleLogin, currentUser, setCurrentUser, currentMonth, setCurrentMonth, logs, clients, schedules, personalSchedules, mainFormData, setMainFormData, handleSaveEntry, saveToDb, handleDelete, approvals, handleApproveMonth, systemSettings, documents, appNotifications }}
        />
      )}
      {view === 'client_portal' && (
        <ClientPortal
          clients={clients}
          workers={workers}
          logs={logs}
          saveToDb={saveToDb}
          initialClientId={urlClient}
          initialMonth={urlMonth}
          systemSettings={systemSettings}
          appNotifications={appNotifications}
          clientApprovals={clientApprovals}
          supabase={supabase}
          renderReport={(workerId, isGlobal) => (
            <ClientTimesheetReport
              data={{
                client: clients.find(c => c.id === urlClient),
                logs,
                workers,
                clients,
                month: urlMonth,
                workerId: workerId,
                isGlobal: isGlobal && !workerId,
                clientApprovals
              }}
              isEmbedded={true}
              onBack={() => { }}
            />
          )}
        />
      )}
      {showFinReport && <FinancialReportOverlay {...{ logs, workers, clients, expenses, finFilter, setFinFilter, setShowFinReport }} />}

      {/* Modal de Disparo de E-mail */}
      {modalEmailAberto && clienteSelecionado && (() => {
        const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
        const modalLinkUnico = clienteSelecionado.link_gerado || `${window.location.origin}${window.location.pathname}?view=client_portal&client=${clienteSelecionado.id}&month=${monthStr}`;
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl border border-indigo-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <h3 className="font-black text-xl text-slate-800 flex items-center gap-3">
                  <Mail size={24} className="text-indigo-600" />
                  Disparar E-mail para {clienteSelecionado.name}
                </h3>
                <button onClick={() => setModalEmailAberto(false)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 bg-slate-50 space-y-4">
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-2">
                  <div className="flex gap-2 text-sm">
                    <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest w-16">De:</span>
                    <span className="font-medium text-slate-700">nao-responder@magneticplace.pt</span>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest w-16">Para:</span>
                    <span className="font-bold text-indigo-700">{clienteSelecionado.email || 'cliente@exemplo.pt'}</span>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest w-16">Assunto:</span>
                    <span className="font-medium text-slate-700">Aprovação de Horas Magnetic Place - {currentMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
                  {/* Header do E-mail Mockup */}
                  <div className="flex justify-center mb-8 pb-6 border-b-2 border-slate-50">
                    <img src="/MAGNETIC (3).png" alt="Logo" className="h-10 object-contain" />
                  </div>

                  <h4 className="font-black text-lg text-slate-800 mb-4">Olá {clienteSelecionado.name},</h4>
                  <p className="text-slate-600 text-sm leading-relaxed mb-6">
                    Os relatórios de serviço referentes ao período de <strong className="font-black text-indigo-700">{currentMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</strong> já estão disponíveis para a sua revisão e aprovação.
                  </p>

                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8">
                    <p className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em] mb-1">Total Registado</p>
                    <p className="text-2xl font-black text-indigo-700">
                      {formatHours(logs.filter(l => l.clientId === clienteSelecionado.id).reduce((acc, l) => acc + l.hours, 0))} <span className="text-base font-bold">horas</span>
                    </p>
                  </div>

                  <p className="text-slate-500 text-xs leading-relaxed mb-8">
                    Para rever em detalhe as datas, horas, e trabalhadores associados a este período, por favor utilize o botão abaixo:
                  </p>

                  <div className="text-center mb-10">
                    <div className="inline-block bg-indigo-600 text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200">
                      Aceder ao Portal de Validação
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Equipa Magnetic Place</p>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white">
                <button
                  onClick={() => setModalEmailAberto(false)}
                  disabled={isSendingEmail}
                  className="px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDisparoEmail}
                  disabled={isSendingEmail}
                  className="px-6 py-3 rounded-xl font-black text-xs uppercase text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {isSendingEmail ? (
                    <><Loader2 size={16} className="animate-spin" /> A processar...</>
                  ) : (
                    <><Send size={16} /> Confirmar e Disparar</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de Rejeição de Correção */}
      {modalRejeitarAberto && rejeitarNotif && (() => {
        const targetClient = clients.find(c => String(c.id) === String(rejeitarNotif.target_client_id));
        const monthLabel = (rejeitarNotif.message.match(/📅 Período: (.+)\n/)?.[1] || rejeitarNotif.payload?.month || '').trim();
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl border border-rose-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="flex justify-between items-center p-6 border-b border-rose-100">
                <h3 className="font-black text-xl text-rose-600 flex items-center gap-3">
                  <XCircle size={24} />
                  Rejeitar Correção
                </h3>
                <button onClick={() => setModalRejeitarAberto(false)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 bg-slate-50 space-y-4">
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-2">
                  <div className="flex gap-2 text-sm">
                    <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest w-16">Para:</span>
                    <span className="font-bold text-rose-700">{targetClient?.name || 'Cliente'}</span>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest w-16">E-mail:</span>
                    <span className="font-medium text-slate-700">{targetClient?.email || 'Não definido'}</span>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest w-16">Período:</span>
                    <span className="font-medium text-slate-700">{monthLabel || rejeitarNotif.payload?.month || ''}</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Motivo da Rejeição *</label>
                  <textarea
                    value={rejeitarMotivo}
                    onChange={e => setRejeitarMotivo(e.target.value)}
                    placeholder="Descreva o motivo pelo qual esta correção está a ser rejeitada..."
                    rows={4}
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 resize-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 text-right">{rejeitarMotivo.length} caracteres (mínimo 10)</p>
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                  <p className="text-[10px] font-black uppercase text-rose-400 tracking-widest mb-2">Pré-visualização do E-mail</p>
                  <div className="bg-white rounded-lg p-4 text-sm space-y-2">
                    <p className="font-bold text-slate-800">Assunto: Reporte de Divergência Rejeitado: {monthLabel || ''}</p>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      {rejeitarMotivo.trim().length >= 10 ? (
                        <>O seu reporte de divergência referente ao período de <strong>{monthLabel || ''}</strong> foi rejeitado pelo administrador.<br /><br /><strong>Motivo:</strong> {rejeitarMotivo.trim()}</>
                      ) : (
                        <span className="text-amber-500">Aguarde... Insira o motivo da rejeição.</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white">
                <button
                  onClick={() => setModalRejeitarAberto(false)}
                  className="px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarRejeicao}
                  disabled={rejeitarMotivo.trim().length < 10}
                  className="px-6 py-3 rounded-xl font-black text-xs uppercase text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle size={16} /> Confirmar Rejeição
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Toast Notificação Simples */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[300] animate-in slide-in-from-right fade-in duration-300">
          <div className="bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 font-bold text-sm">
            <CheckCircle size={20} className="text-emerald-200" />
            {toastMessage}
          </div>
        </div>
      )}

    </div>
  );
}

export default App; 