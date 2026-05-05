
import SignatureCanvas from 'react-signature-canvas';
import React, { useState, useMemo, useEffect, useRef } from 'react';
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

// --- CONFIGURAÇÃO DO SUPABASE ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

let supabase = null;

// --- Configuração da IA (Opcional) ---
let apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

async function callGemini(prompt, systemInstruction = "") {
  if (!apiKey) return "A IA precisa de uma chave API configurada no código.";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] }
  };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(payload) });
    if (response.ok) {
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro na resposta.";
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', response.status, errorData);
      if (response.status === 401) return "Chave API inválida.";
      if (response.status === 429) return "Limite de uso atingido. Tente novamente em alguns minutos.";
      return `Erro da IA (${response.status}).`;
    }
  } catch (error) { console.error(error); }
  return "Ocorreu um erro ao contactar a IA.";
}

// --- Funções Utilitárias ---
const toISODateLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatHours = (h) => {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return `${hours}h${minutes === 0 ? '00' : minutes.toString().padStart(2, '0')}`;
};

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || "";
const EMAILJS_TEMPLATE_ID_NOTIF = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_NOTIF || "";
const EMAILJS_TEMPLATE_ID_PORTAL = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_PORTAL || "";
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "";
const CLIENT_PORTAL_URL = import.meta.env.VITE_CLIENT_PORTAL_URL || 'http://localhost:5173';

const emailTranslations = {
  es: {
    // Títulos
    'Pedido de Correção': 'Solicitud de Corrección',
    'Divergência Reportada': 'Divergencia Reportada',
    'Correção Aceite': 'Corrección Aceptada',
    'Correção Rejeitada': 'Corrección Rechazada',
    'Mensagem de Divergência': 'Mensaje de Divergencia',
    // Partes da mensagem
    'PEDIDO DE CORREÇÃO': 'SOLICITUD DE CORRECCIÓN',
    'MENSAGEM DE DIVERGÊNCIA': 'MENSAJE DE DIVERGENCIA',
    'RESUMO GERAL': 'RESUMEN GENERAL',
    'Total Original:': 'Total Original:',
    'Novo Total Sugerido:': 'Nuevo Total Sugerido:',
    'Diferença:': 'Diferencia:',
    'DETALHES POR COLABORADOR': 'DETALLES POR COLABORADOR',
    'Total:': 'Total:',
    'Alterações:': 'Cambios:',
    'Turno:': 'Turno:',
    'Pausa:': 'Pausa:',
    'Horas:': 'Horas:',
    'JUSTIFICAÇÃO:': 'JUSTIFICACIÓN:',
    'justificação:': 'justificación:',
    'Correção aceite pelo admin!': '¡Corrección aceptada por el admin!',
    'Correção rejeitada. Motivo:': 'Corrección rechazada. Motivo:',
  }
};

const translateEmailContent = (text, lang = 'es') => {
  if (!text || !emailTranslations[lang]) return text;
  let translated = text;
  const replacements = emailTranslations[lang];
  // Sort by length descending to avoid partial replacements
  const keys = Object.keys(replacements).sort((a, b) => b.length - a.length);
  keys.forEach(key => {
    translated = translated.split(key).join(replacements[key]);
  });
  return translated;
};

const monthToYYYYMM = (monthStr) => {
  if (!monthStr) return null;
  if (monthStr.match(/^\d{4}-\d{2}$/)) return monthStr;
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const lower = monthStr.toLowerCase();
  const monthIdx = months.findIndex(m => lower.includes(m));
  const yearMatch = monthStr.match(/\d{4}/);
  if (monthIdx >= 0 && yearMatch) {
    return `${yearMatch[0]}-${String(monthIdx + 1).padStart(2, '0')}`;
  }
  return monthStr;
};

const sendNotificationEmail = async (clientEmail, clientName, notifTitle, notifMessage, clientId = null, month = null) => {
  try {
    const monthStr = month ? monthToYYYYMM(month) : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const clientParam = clientId ? `&client=${String(clientId)}&month=${monthStr}` : '';
    const translatedTitle = translateEmailContent(notifTitle, 'es');
    const translatedMessage = translateEmailContent(notifMessage, 'es');
    const templateParams = {
      to_email: clientEmail || 'contato@cliente.pt',
      to_name: clientName,
      notification_title: translatedTitle,
      notification_message: translatedMessage,
      link_unico: `${CLIENT_PORTAL_URL}/?view=client_portal${clientParam}`
    };
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID_NOTIF, templateParams, EMAILJS_PUBLIC_KEY);
    return true;
  } catch (error) {
    console.error('Falha no envio de e-mail de notificação:', error);
    return false;
  }
};

const formatDocDate = (dateStr, showTime = false) => {
  if (!dateStr) return '--/--/----';
  // Se for apenas data (YYYY-MM-DD), evita o shift de timezone convertendo manualmente
  if (dateStr.length === 10) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(dateStr);
  if (showTime) {
    return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-PT');
};

const getLastBusinessDayOfMonth = (date) => {
  let tempDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  while (tempDate.getDay() === 0 || tempDate.getDay() === 6) {
    tempDate.setDate(tempDate.getDate() - 1);
  }
  return tempDate;
};

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val || 0);
};

const isSameMonth = (dateStr, targetDate) => {
  if (!dateStr) return false;
  const [y, m] = dateStr.split('-').map(Number);
  return y === targetDate.getFullYear() && (m - 1) === targetDate.getMonth();
};

const toTimeInputValue = (val) => val === '--:--' ? '' : (val || '');

// Mesma lógica do ClientPortal para calcular horas
const calculateDuration = (entry, exit, breakStart, breakEnd) => {
  if (!entry || !exit || entry === '--:--' || exit === '--:--') return 0;
  const [eh, em] = entry.split(':').map(Number);
  const [xh, xm] = exit.split(':').map(Number);
  let diffMins = (xh * 60 + xm) - (eh * 60 + em);
  if (diffMins < 0) diffMins += 24 * 60;

  if (breakStart && breakEnd && breakStart !== '--:--' && breakEnd !== '--:--') {
    const [bsh, bsm] = breakStart.split(':').map(Number);
    const [beh, bem] = breakEnd.split(':').map(Number);
    let breakDiffMins = (beh * 60 + bem) - (bsh * 60 + bsm);
    if (breakDiffMins < 0) breakDiffMins += 24 * 60;
    diffMins -= breakDiffMins;
  }

  return Number(Math.max(0, diffMins / 60).toFixed(2));
};

const getScheduleForDay = (schedule, dateStr) => {
  if (!schedule) return null;
  const d = new Date(dateStr).getDay();
  if (schedule.isAdvanced && schedule.dailyConfigs && schedule.dailyConfigs[d]) {
    return schedule.dailyConfigs[d].isActive ? schedule.dailyConfigs[d] : null;
  }
  const allowedDays = schedule.weekdays || [1, 2, 3, 4, 5];
  if (allowedDays.includes(d)) {
    return { startTime: schedule.startTime, breakStart: schedule.breakStart, breakEnd: schedule.breakEnd, endTime: schedule.endTime };
  }
  return null;
};

const calculateExpectedMonthlyHours = (schedule, targetDate) => {
  if (!schedule) return 0;
  const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
  let totalHours = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const ds = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayConfig = getScheduleForDay(schedule, ds);
    if (dayConfig) {
      totalHours += calculateDuration(dayConfig.startTime, dayConfig.endTime, dayConfig.breakStart, dayConfig.breakEnd);
    }
  }
  return totalHours;
};

const getISOWeek = (d) => {
  if (!d || isNaN(d.getTime())) return 0;
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const calculateExpectedDailyHours = (schedule, dateStr) => {
  if (!schedule) return 0;
  const dayConfig = getScheduleForDay(schedule, dateStr);
  if (!dayConfig) return 0;
  return calculateDuration(dayConfig.startTime, dayConfig.endTime, dayConfig.breakStart, dayConfig.breakEnd);
};

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
    try {
      const res = await callGemini(`Melhore esta descrição de tarefa para um relatório de horas profissional. Responda APENAS com a descrição polida. Sem conselhos e sem frases introdutórias (ex: não comece com "A descrição melhorada seria..." ou "às vezes isso acontece..."). Texto original: "${data.description}"`, "Você é um redator profissional muito rigoroso.");
      if (res) onChange({ ...data, description: res.trim() });
    } catch (error) {
      console.error('AI polish failed:', error);
    } finally {
      setIsImproving(false);
    }
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
    const res = await callGemini(prompt, "Você é um consultor financeiro sênior da empresa.");
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

  const docs = documents?.filter(d => d.workerId === currentUser?.id) || [];

  const pendentes = docs.filter(d => d.status === 'Pendente');
  const historico = docs.filter(d => d.status === 'Assinado');

  const handleSign = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return alert('Assinatura obrigatória.');
    setSigning(true);

    try {
      const sigDataUrl = sigCanvas.current.toDataURL('image/png');

      // Upload assinatura
      const sigBlob = await fetch(sigDataUrl).then(r => r.blob());
      const sigPath = `${currentUser.id}/assinaturas/${Date.now()}.png`;
      const { data: sigUpload, error: sigError } = await supabase.storage
        .from('documentos')
        .upload(sigPath, sigBlob);

      if (sigError) throw new Error(`Erro upload assinatura: ${sigError.message}`);

      const { data: sigUrlData } = supabase.storage.from('documentos').getPublicUrl(sigPath);
      const assinaturaUrl = sigUrlData.publicUrl;

      // IP do utilizador
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const userIP = ipData.ip || 'Desconhecido';
      const now = new Date().toISOString();
      const workerName = currentUser?.name || 'Desconhecido';

      // Processar PDF com PDF.co
      const pdfCoUrl = 'https://api.pdf.co/v1/pdf/edit/add';
      const pdfCoKey = import.meta.env.VITE_PDFCO_API_KEY || '';

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

      if (imgResult.error) {
        throw new Error(imgResult.error);
      }

      const pdfCoTempUrl = imgResult.url;

      // Fazer download do PDF temporário e fazer upload para Supabase Storage (permanent)

      const pdfBlob = await fetch(pdfCoTempUrl).then(async r => {
        if (!r.ok) throw new Error('Erro ao baixar PDF temporário do PDF.co');
        return await r.blob();
      });

      const pdfPath = `${currentUser.id}/documentos_assinados/${selectedDoc.id}_signed_${Date.now()}.pdf`;

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

      // Guardar
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

    const clientSupabase = supabase || (window.supabase ? window.supabase.createClient(import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co', import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key') : null);
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

// D-04: Separate wrapper components for each report type
// Each component handles its specific type and renders appropriately
// D-09: LegacyCorrectionCard shows both badges since we don't know original type
const QuickReportCorrectionCard = ({ notif, ...props }) => {
  if (notif.payload?.reportType !== 'quick') return null;
  return <div className="quick-correction-card">{notif.title} - Quick</div>;
};

const PrecisionReportCorrectionCard = ({ notif, ...props }) => {
  if (notif.payload?.reportType !== 'precision') return null;
  return <div className="precision-correction-card">{notif.title} - Precision</div>;
};

const LegacyCorrectionCard = ({ notif, ...props }) => {
  if (notif.payload?.reportType) return null;
  return <div className="legacy-correction-card">{notif.title} - Legacy</div>;
};

// D-04/D-09: Shared render function for correction cards
const renderCorrectionCard = ({ notif, isQuickReport, isPrecisionReport, isLegacy, ...props }) => null;

const CorrecoesAdmin = ({ workers, appNotifications, saveToDb, handleDelete, clients, logs, setSchedules, currentUser, setModalRejeitarAberto, setRejeitarMotivo, setRejeitarNotif, correcoesCorrections }) => {
  // D-01: State completely separated between Quick and Precision
  const [quickEditingDrafts, setQuickEditingDrafts] = useState(() => {
    try { const saved = localStorage.getItem('magnetic_quick_drafts'); return saved ? JSON.parse(saved) : {}; } catch { return {}; }
  });
  const [quickActiveWorker, setQuickActiveWorker] = useState(() => {
    try { const saved = localStorage.getItem('magnetic_quick_worker'); return saved ? JSON.parse(saved) : {}; } catch { return {}; }
  });
  const [quickActiveDay, setQuickActiveDay] = useState(() => {
    try { const saved = localStorage.getItem('magnetic_quick_day'); return saved ? JSON.parse(saved) : {}; } catch { return {}; }
  });

  const [precisionEditingDrafts, setPrecisionEditingDrafts] = useState(() => {
    try { const saved = localStorage.getItem('magnetic_precision_drafts'); return saved ? JSON.parse(saved) : {}; } catch { return {}; }
  });
  const [precisionActiveWorker, setPrecisionActiveWorker] = useState(() => {
    try { const saved = localStorage.getItem('magnetic_precision_worker'); return saved ? JSON.parse(saved) : {}; } catch { return {}; }
  });
  const [precisionActiveDay, setPrecisionActiveDay] = useState(() => {
    try { const saved = localStorage.getItem('magnetic_precision_day'); return saved ? JSON.parse(saved) : {}; } catch { return {}; }
  });
  const [precisionExpandedDias, setPrecisionExpandedDias] = useState(() => {
    try { const saved = localStorage.getItem('magnetic_precision_expanded'); return saved ? JSON.parse(saved) : {}; } catch { return {}; }
  });

  // Legacy: keep old state for notifications without reportType
  const [legacyEditingDrafts, setLegacyEditingDrafts] = useState(() => {
    try { const saved = localStorage.getItem('magnetic_legacy_drafts'); return saved ? JSON.parse(saved) : {}; } catch { return {}; }
  });

  useEffect(() => { localStorage.setItem('magnetic_quick_drafts', JSON.stringify(quickEditingDrafts)); }, [quickEditingDrafts]);
  useEffect(() => { localStorage.setItem('magnetic_quick_worker', JSON.stringify(quickActiveWorker)); }, [quickActiveWorker]);
  useEffect(() => { localStorage.setItem('magnetic_quick_day', JSON.stringify(quickActiveDay)); }, [quickActiveDay]);
  useEffect(() => { localStorage.setItem('magnetic_precision_drafts', JSON.stringify(precisionEditingDrafts)); }, [precisionEditingDrafts]);
  useEffect(() => { localStorage.setItem('magnetic_precision_worker', JSON.stringify(precisionActiveWorker)); }, [precisionActiveWorker]);
  useEffect(() => { localStorage.setItem('magnetic_precision_day', JSON.stringify(precisionActiveDay)); }, [precisionActiveDay]);
  useEffect(() => { localStorage.setItem('magnetic_precision_expanded', JSON.stringify(precisionExpandedDias)); }, [precisionExpandedDias]);
  useEffect(() => { localStorage.setItem('magnetic_legacy_drafts', JSON.stringify(legacyEditingDrafts)); }, [legacyEditingDrafts]);

  // D-06: Independent notification filters per type
  const baseFilter = n =>
    n.is_active &&
    n.title &&
    (
      n.title.includes('Pedido de Correção') ||
      n.title.includes('Contra-proposta Aceite') ||
      n.title.includes('Divergência Reportada') ||
      n.title.includes('Contra-proposta')
    ) &&
    n.target_type === 'admin';
  const quickNotifications = (appNotifications || []).filter(n => baseFilter(n) && n.payload?.reportType === 'quick');
  const precisionNotifications = (appNotifications || []).filter(n => baseFilter(n) && n.payload?.reportType === 'precision');
  const legacyNotifications = (appNotifications || []).filter(n => baseFilter(n) && !n.payload?.reportType);
  const correctionNotifications = [...quickNotifications, ...precisionNotifications, ...legacyNotifications];

  // Inicializar precisionExpandedDias para Precision reports (não expandir automaticamente)
  useEffect(() => {
    if (!precisionNotifications || precisionNotifications.length === 0) return;
    const needsUpdate = precisionNotifications.some(n =>
      precisionExpandedDias[n.id] === undefined
    );
    if (needsUpdate) {
      setPrecisionExpandedDias(prev => {
        const next = { ...prev };
        precisionNotifications.forEach(n => {
          if (next[n.id] === undefined) {
            next[n.id] = false; // Precision reports start collapsed
          }
        });
        return next;
      });
    }
  }, [precisionNotifications]);

  if (!appNotifications) {
    return <div className="p-8 text-center">Carregando...</div>;
  }

  const parseCorrectionDetails = (message, targetClientId = null, targetMonth = null) => {
    const details = { workers: [], monthStr: "", clientId: targetClientId, month: targetMonth };

    const clientMatch = message.match(/(?:⚠️ PEDIDO DE CORREÇÃO|💬 MENSAGEM DE DIVERGÊNCIA): (.+)\n/);
    if (clientMatch) details.clientName = clientMatch[1].trim();

    const periodMatch = message.match(/📅 Período: (.+)\n/);
    if (periodMatch) {
      details.monthLabel = periodMatch[1].trim();
      const yearMatch = details.monthLabel.match(/\d{4}/);
      if (yearMatch) details.year = yearMatch[0];
    }

    const justificationMatch = message.match(/💬 JUSTIFICAÇÃO:\n"(.+)"/);
    if (justificationMatch) details.justification = justificationMatch[1].trim();

    // Suporte para o formato de mensagem simples
    if (!details.justification && message.includes('"\n')) {
      const simpleMsgMatch = message.match(/"\n\n"(.+)"/);
      if (simpleMsgMatch) details.justification = simpleMsgMatch[1].trim();
    }

    const isNewFormat = message.includes('👥 DETALHES POR COLABORADOR');
    const isQuickReportMessage = message.includes('💬 MENSAGEM DE DIVERGÊNCIA');

    if (isNewFormat) {
      const workerParts = message.split('👤 ');
      workerParts.shift();

      workerParts.forEach(part => {
        const lines = part.split('\n');
        const nameLine = lines[0].trim();
        const idMatch = nameLine.match(/(.+) \[ID:(.+)\]/);
        const workerName = idMatch ? idMatch[1].trim() : nameLine;
        const workerId = idMatch ? idMatch[2].trim() : null;

        const totalMatch = part.match(/Total: ([\d.]+)h ➔ ([\d.]+)h/);
        const suggestedTotal = totalMatch ? parseFloat(totalMatch[2]) : 0;
        const originalTotal = totalMatch ? parseFloat(totalMatch[1]) : 0;

        const changes = [];
        const dayParts = part.split('   • ');
        dayParts.shift();

        dayParts.forEach(dayPart => {
          const dayLines = dayPart.split('\n');
          const dateLabel = dayLines[0].replace(':', '').trim();

          const shiftMatch = dayPart.match(/- Turno: (.*?) ➔ (.*?)\n/);
          const breakMatch = dayPart.match(/- Pausa: (.*?) ➔ (.*?)\n/);
          const hourMatch = dayPart.match(/- Horas: (.*?) ➔ (.*?)\n/);

          if (shiftMatch) {
            const editedShift = shiftMatch[2].trim();
            const originalShift = shiftMatch[1].trim();
            const isClearedShift = (editedShift === '--:--' || editedShift === '--:' ||
              (editedShift.startsWith('--:') && editedShift.includes('-----')));
            const [e, x] = isClearedShift
              ? ['--:--', '--:--']
              : editedShift.includes('-') ? editedShift.split('-') : ['--:--', '--:--'];
            const [origEntry, origExit] = (originalShift && originalShift !== '--' && originalShift.includes('-') && originalShift !== '--:--') ? originalShift.split('-') : ['--:--', '--:--'];

            const originalBreak = breakMatch ? breakMatch[1].trim() : '--:--';
            const editedBreak = breakMatch ? breakMatch[2].trim() : '--:--';
            const [bs, be] = (editedBreak.includes('-') && editedBreak !== '--:--') ? editedBreak.split('-') : ['--:--', '--:--'];
            const [obs, obsEnd] = originalBreak.includes('-') ? originalBreak.split('-') : ['--:--', '--:--'];

            const dayRecord = {
              dateLabel,
              date: dateLabel,
              originalShift: originalShift,
              entry: origEntry === 'undefined' ? '--:--' : origEntry,
              exit: origExit === 'undefined' ? '--:--' : origExit,
              editedEntry: e,
              editedExit: x,
              originalBreak: originalBreak,
              editedBreakStart: bs === 'undefined' ? '--:--' : bs,
              editedBreakEnd: be === 'undefined' ? '--:--' : be,
              breakStart: obs === 'undefined' ? '--:--' : obs,
              breakEnd: obsEnd === 'undefined' ? '--:--' : obsEnd,
              originalHours: hourMatch ? parseFloat(hourMatch[1].replace('h', '')) : 0,
              editedHours: hourMatch ? parseFloat(hourMatch[2].replace('h', '')) : 0
            };

            changes.push(dayRecord);
          }
        });

        details.workers.push({ id: workerId, name: workerName, totalHours: originalTotal, editedTotalHours: suggestedTotal, dailyRecords: changes });
      });
    } else {
      message.split('►').forEach(part => {
        if (part.includes('(')) {
          const workerMatch = part.match(/(.+?) \(Sugerido Total: ([\d.]+)h\):/);
          if (workerMatch) {
            const workerName = workerMatch[1].trim();
            const suggestedTotal = parseFloat(workerMatch[2]);
            const changes = [];
            part.split('\n').forEach(line => {
              if (line.includes('•')) {
                const dateMatch = line.match(/(\d{2}\/\d{2}.+?)/);
                const times = line.match(/(\d{2}:\d{2})/g);
                if (dateMatch && times && times.length >= 2) {
                  changes.push({
                    dateLabel: dateMatch[1],
                    newEntry: times[0],
                    newExit: times[1],
                    newBreakStart: times[2] || null,
                    newBreakEnd: times[3] || null
                  });
                }
              }
            });
            details.workers.push({ name: workerName, suggestedTotal, changes });
          }
        }
      });
    }

    // Se temos clientId e month, buscar todos os logs do período do banco de dados
    if (targetClientId && targetMonth && logs) {
      const clientLogs = logs.filter(l =>
        String(l.clientId) === String(targetClientId) &&
        l.date &&
        l.date.substring(0, 7) === targetMonth
      );

      const workerIds = [...new Set(clientLogs.map(l => l.workerId))];

      const enrichedWorkers = workerIds.map(wId => {
        const worker = workers.find(w => w.id === wId) || { name: 'Desconhecido', id: wId };
        const wLogs = clientLogs.filter(l => l.workerId === wId).sort((a, b) => a.date.localeCompare(b.date));

        // Encontrar se há alterações pendentes para este worker
        const existingWorker = details.workers.find(dw => String(dw.id) === String(wId));
        const existingChanges = existingWorker?.dailyRecords || [];

        const dailyRecords = wLogs.map(log => {
          const existingChange = existingChanges.find(c => c.dateLabel === log.date || c.date === log.date);

          return {
            date: log.date,
            dateLabel: log.date,
            entry: log.startTime || '--:--',
            exit: log.endTime || '--:--',
            breakStart: log.breakStart || '--:--',
            breakEnd: log.breakEnd || '--:--',
            hours: parseFloat(log.hours || 0),
            originalEntry: log.startTime || '--:--',
            originalExit: log.endTime || '--:--',
            originalBreakStart: log.breakStart || '--:--',
            originalBreakEnd: log.breakEnd || '--:--',
            originalHours: parseFloat(log.hours || 0),
            editedEntry: existingChange?.editedEntry || null,
            editedExit: existingChange?.editedExit || null,
            editedBreakStart: existingChange?.editedBreakStart || null,
            editedBreakEnd: existingChange?.editedBreakEnd || null,
            editedHours: existingChange?.editedHours || null,
            adminEntry: existingChange?.adminEntry || null,
            adminExit: existingChange?.adminExit || null,
            adminBreakStart: existingChange?.adminBreakStart || null,
            adminBreakEnd: existingChange?.adminBreakEnd || null,
            adminHours: existingChange?.adminHours || null
          };
        });

        const totalHours = parseFloat(dailyRecords.reduce((acc, d) => acc + d.hours, 0).toFixed(2));

        return {
          id: wId,
          name: worker.name,
          totalHours,
          editedTotalHours: existingWorker?.editedTotalHours || totalHours,
          dailyRecords
        };
      });

      details.workers = enrichedWorkers;
    }

    return details;
  };

  const handleApplyCorrection = async (correction, isEditing, currentData) => {
    const targetClientId = correction.target_client_id;
    const targetMonth = (correction.message.match(/📅 Período: (.+)/)?.[1] || '').match(/\d{4}-\d{2}/)?.[0];
    const details = isEditing && currentData ? currentData : parseCorrectionDetails(correction.message, targetClientId, targetMonth);
    if (!details.clientName) {
      alert("Não foi possível identificar o cliente nesta notificação.");
      return;
    }

    const client = clients.find(c => c.name.toLowerCase() === details.clientName.toLowerCase());
    if (!client) {
      alert(`Cliente "${details.clientName}" não encontrado.`);
      return;
    }

    let appliedCount = 0;

    let clientMsg = `⚠️ CORREÇÕES APLICADAS PELO ADMINISTRADOR\n`;
    clientMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    clientMsg += `👤 Cliente: ${client.name}\n`;
    clientMsg += `📅 Período: ${details.monthLabel || 'o período'}\n\n`;
    clientMsg += `As correções sugeridas foram analisadas e aplicadas no sistema.\n\n`;
    clientMsg += `📊 RESUMO DAS ALTERAÇÕES:\n`;
    clientMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const worker of details.workers) {
      const targetWorkerId = worker.id || workers.find(w => w.name.toLowerCase() === worker.name.toLowerCase())?.id;
      if (!targetWorkerId) continue;

      const workerDailyRecords = worker.dailyRecords || worker.changes || [];

      let workerMsg = '';
      let workerModifiedCount = 0;
      let totalWorkerHoursOrig = 0;
      let totalWorkerHoursNew = 0;

      workerMsg += `👤 ${worker.name.toUpperCase()} [ID:${targetWorkerId}]\n`;
      workerMsg += `   Alterações Aplicadas:\n`;

      for (const change of workerDailyRecords) {
        // Tentar obter a data no formato correto (YYYY-MM-DD)
        let dateStr = change.date;
        // Se date contém apenas label formatada (DD/MM), usar rawDate ou extrair do date
        if (!dateStr || !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const dateMatch = (change.date || change.rawDate || '').match(/(\d{2})\/(\d{2})/);
          if (dateMatch) {
            const year = details.year || new Date().getFullYear();
            dateStr = `${year}-${dateMatch[2]}-${dateMatch[1]}`;
          } else if (change.rawDate && change.rawDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateStr = change.rawDate;
          }
        }

        if (!dateStr) continue;

        // Normalizar IDs para string para comparação
        const targetWorkerIdStr = String(targetWorkerId);
        const clientIdStr = String(client.id);

        // Encontrar o log correspondente - verificação mais flexível
        const oldLog = logs.find(l =>
          String(l.workerId) === targetWorkerIdStr &&
          String(l.clientId) === clientIdStr &&
          l.date === dateStr
        );

        const entry = change.adminEntry || change.editedEntry || change.newEntry;
        const exit = change.adminExit || change.editedExit || change.newExit;
        const bStart = change.adminBreakStart || change.editedBreakStart || change.newBreakStart || '--:--';
        const bEnd = change.adminBreakEnd || change.editedBreakEnd || change.newBreakEnd || '--:--';

        // Só cria/atualiza se existirem dados válidos de entrada/saída ou se for uma edição explícita
        if ((entry && entry !== '--:--' && exit && exit !== '--:--') || oldLog) {
          const dur = calculateDuration(
            entry,
            exit,
            bStart === '--:--' ? null : bStart,
            bEnd === '--:--' ? null : bEnd
          );

          const logId = oldLog ? oldLog.id : "log_" + Date.now() + Math.random().toString(36).substr(2, 9);

          const updateData = {
            id: logId,
            date: oldLog ? oldLog.date : dateStr,
            workerId: String(targetWorkerIdStr),
            clientId: String(clientIdStr),
            startTime: entry === '--:--' ? null : entry,
            endTime: exit === '--:--' ? null : exit,
            breakStart: bStart === '--:--' ? null : bStart,
            breakEnd: bEnd === '--:--' ? null : bEnd,
            hours: dur
          };

          await saveToDb('logs', logId, updateData);
          appliedCount++;
          workerModifiedCount++;

          const oldEntry = oldLog ? (oldLog.startTime || '--:--') : '--:--';
          const oldExit = oldLog ? (oldLog.endTime || '--:--') : '--:--';
          const oldBStart = oldLog ? (oldLog.breakStart || '--:--') : '--:--';
          const oldBEnd = oldLog ? (oldLog.breakEnd || '--:--') : '--:--';
          const oldDur = oldLog ? (oldLog.hours || '--:--') : '--:--';

          totalWorkerHoursOrig += oldDur;
          totalWorkerHoursNew += dur;

          workerMsg += `   • ${change.dateLabel || dateStr}:\n`;
          workerMsg += `     - Turno: ${oldEntry}-${oldExit} ➔ ${entry}-${exit}\n`;
          if (oldBStart !== '--:--' || bStart !== '--:--') {
            workerMsg += `     - Pausa: ${oldBStart}-${oldBEnd} ➔ ${bStart}-${bEnd}\n`;
          }
          workerMsg += `     - Horas: ${oldDur}h ➔ ${dur}h\n`;
        }
      }

      if (workerModifiedCount > 0) {
        clientMsg += workerMsg;
        clientMsg += `   📈 Subtotal: ${totalWorkerHoursOrig}h ➔ ${totalWorkerHoursNew}h\n\n`;
      }
    }

    // Calcular total geral
    let totalGeralOrig = 0;
    let totalGeralNew = 0;
    for (const w of details.workers) {
      const wr = w.dailyRecords || w.changes || [];
      for (const c of wr) {
        const oldH = c.originalHours || c.hours || 0;
        const newH = c.adminHours || c.editedHours || c.newHours || oldH;
        totalGeralOrig += parseFloat(oldH);
        totalGeralNew += parseFloat(newH);
      }
    }
    const diffGeral = (totalGeralNew - totalGeralOrig).toFixed(2);
    clientMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    clientMsg += `📊 TOTAL GERAL DO PERÍODO:\n`;
    clientMsg += `• Original: ${parseFloat(totalGeralOrig.toFixed(2))}h\n`;
    clientMsg += `• Atualizado: ${parseFloat(totalGeralNew.toFixed(2))}h\n`;
    clientMsg += `• Diferença: ${diffGeral > 0 ? '+' : ''}${diffGeral}h\n`;
    clientMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Notificar o cliente que as correções foram aplicadas
    if (client && appliedCount > 0) {
      const notifId = `aplicado_${correction.id}_${Date.now()}`;
      await saveToDb('app_notifications', notifId, {
        title: `✅ Correções Aplicadas: ${client.name}`,
        message: clientMsg,
        type: 'success',
        target_type: 'client',
        target_client_id: String(client.id),
        created_at: new Date().toISOString(),
        is_active: true,
        payload: {
          type: 'correcoes_aplicadas',
          month: details.monthLabel,
          appliedCount
        }
      });
    }

    await handleDelete('app_notifications', correction.id);
    alert(`Sucesso! ${appliedCount} registos de horários foram atualizados.\nO cliente foi notificado.`);
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-6">
        <div className="bg-amber-50 p-2 rounded-xl text-amber-600">
          <AlertTriangle size={20} />
        </div>
        <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight">Pedidos de Correção de Horários</h3>
      </div>

      {correctionNotifications.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-slate-50 p-6 rounded-[2rem] mb-4 inline-block">
            <CheckCircle size={48} className="text-emerald-400" />
          </div>
          <p className="text-slate-500 font-medium">Nenhum pedido de correção pendente</p>
        </div>
      ) : (
        <div className="space-y-4">
          {correctionNotifications.map(notif => {
            const targetClientId = notif.target_client_id || (clients.find(c => c.name.toLowerCase() === notif.message.toLowerCase().split('\n')[0]?.replace('⚠️ PEDIDO DE CORREÇÃO: ', '').replace('💬 MENSAGEM DE DIVERGÊNCIA: ', ''))?.id);
            const periodMatch = notif.message.match(/📅 Período: (.+)\n/);
            const periodLabel = periodMatch ? periodMatch[1].trim() : '';
            const rawTargetMonth = periodLabel.match(/\d{4}-\d{2}/)?.[0] || (periodLabel ? (() => {
              const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
              const lowerLabel = periodLabel.toLowerCase();
              const monthIdx = months.findIndex(m => lowerLabel.includes(m));
              const yearMatch = periodLabel.match(/\d{4}/);
              if (monthIdx >= 0 && yearMatch) {
                return `${yearMatch[0]}-${String(monthIdx + 1).padStart(2, '0')}`;
              }
              return null;
            })() : null);
            const details = parseCorrectionDetails(notif.message, targetClientId, rawTargetMonth);
            let currentData;

            // 1. DETETAR TIPO DE REPORT PRIMEIRO (antes de processar dados)
            const isPrecisionReport = notif.payload?.reportType === 'precision';
            const isQuickReport = notif.payload?.reportType === 'quick';

            // 2. TENTAR OBTER DADOS DA TABELA CORRECOES USANDO correcao_id
            let workersData = null;
            let dataSource = null;

            if (notif.payload?.correcao_id && correcoesCorrections) {
              const correcaoFromTable = correcoesCorrections.find(c => c.id === notif.payload.correcao_id);
              if (correcaoFromTable?.payload?.changes) {
                workersData = correcaoFromTable.payload.changes;
                dataSource = 'correcoesTable';
              }
            }

            // 3. Se não encontrou na tabela correcoes, tentar usar payload.changes direto
            if (!workersData && notif.payload?.changes && Array.isArray(notif.payload.changes) && notif.payload.changes.length > 0) {
              workersData = notif.payload.changes;
              dataSource = 'notificationPayload';
            }

            // 4. Se tem workersData, usar
            if (workersData) {
              const clientNameMatch = notif.message.match(/(?:⚠️ PEDIDO DE CORREÇÃO|💬 MENSAGEM DE DIVERGÊNCIA): (.+)\n/);
              const periodMatch = notif.message.match(/📅 Período: (.+)\n/);
              currentData = {
                workers: workersData,
                clientName: clientNameMatch ? clientNameMatch[1].trim() : '',
                monthLabel: periodMatch ? periodMatch[1].trim() : ''
              };
            }
            // 5. SÓ usar draft se não tem payload E tem edições reais do admin
            else if ((isQuickReport && quickEditingDrafts[notif.id]) ||
                     (isPrecisionReport && precisionEditingDrafts[notif.id]) ||
                     (!isQuickReport && !isPrecisionReport && legacyEditingDrafts[notif.id])) {
              const draft = isQuickReport ? quickEditingDrafts[notif.id] : (isPrecisionReport ? precisionEditingDrafts[notif.id] : legacyEditingDrafts[notif.id]);
              const hasAdminEdits = draft.workers?.some(w =>
                (w.dailyRecords || w.changes || []).some(d =>
                  d.adminEntry || d.adminExit || d.adminBreakStart || d.adminBreakEnd
                )
              );
              if (hasAdminEdits) {
                currentData = draft;
              }
            }
            // 3. Fallback: usar parseCorrectionDetails
            else if (details.workers && details.workers.length > 0) {
              currentData = details;
            }

            // Função para verificar se um dia foi editado pelo cliente (SÓ para quick reports)
            const isEditedDay = (day) => {
              if (!isQuickReport) return false; // Precision reports não usam esta lógica
              const isEmptyValue = (val) => val === '' || val === null || val === undefined;
              // Para quick reports, dias novos (isNew) sem horas originais podem ser adicionados
              const isNewDayAdded = day.isNew && day.editedEntry && day.editedEntry !== '--:--' && day.editedEntry !== '';
              const hadOriginalHours = (day.originalHours > 0) || (day.hours > 0);

              // Dia foi editado com novo valor (editedEntry diferente do original E não vazio)
              const wasEditedToNew = !isEmptyValue(day.editedEntry) && (day.editedEntry !== '--:' && day.editedEntry !== '--:--' && day.editedEntry !== day.entry) ||
                !isEmptyValue(day.editedExit) && (day.editedExit !== '--:' && day.editedExit !== '--:--' && day.editedExit !== day.exit) ||
                !isEmptyValue(day.editedBreakStart) && (day.editedBreakStart !== '--:' && day.editedBreakStart !== '--:--') ||
                !isEmptyValue(day.editedBreakEnd) && (day.editedBreakEnd !== '--:' && day.editedBreakEnd !== '--:--');

              // Dia foi apagado (original tinha horário, edited está vazio)
              // Só considera "cleared" se tinha horas originais E valores são diferentes do original
              const isClearedPattern = (val) => val === '--:--' || (val && val.startsWith('--:') && val.includes('-----'));
              const isSameAsOriginal = (day.editedEntry === day.entry || isEmptyValue(day.editedEntry)) &&
                (day.editedExit === day.exit || isEmptyValue(day.editedExit));
              const wasCleared = hadOriginalHours && !isSameAsOriginal &&
                ((day.entry && day.entry !== '--:') || (day.exit && day.exit !== '--:')) &&
                (isClearedPattern(day.editedEntry) || isClearedPattern(day.editedExit) ||
                  isEmptyValue(day.editedEntry) || isEmptyValue(day.editedExit));

              return isNewDayAdded || wasEditedToNew || wasCleared;
            };

            // Para quick reports: Filtrar workers e dias se houver edits do cliente
            // Para precision: Não filtrar, mostrar todos os dias
            const hasClientEdits = isQuickReport && currentData.workers && currentData.workers.some(w =>
              (w.dailyRecords || []).some(d => isEditedDay(d))
            );

            // Precision reports: admin pode editar qualquer dia sem filtragem
            let displayWorkers = currentData.workers;
            if (isQuickReport && hasClientEdits && currentData.workers) {
              displayWorkers = currentData.workers
                .map(w => ({
                  ...w,
                  dailyRecords: (w.dailyRecords || []).filter(d => isEditedDay(d))
                }))
                .filter(w => w.dailyRecords && w.dailyRecords.length > 0);
            }

            const hasWorkerChanges = displayWorkers && displayWorkers.some(w =>
              (w.dailyRecords || w.changes || []).some(c =>
                c.adminEntry || c.adminExit || c.adminBreakStart || c.adminBreakEnd || c.editedEntry || c.editedExit
              )
            );
            // Admin pode sempre editar, idependente de edits do cliente
            const isEditing = !!(isQuickReport ? quickEditingDrafts[notif.id] : isPrecisionReport ? precisionEditingDrafts[notif.id] : legacyEditingDrafts[notif.id]);

            const calculateMonthTotal = (worker) => {
              const days = worker.dailyRecords || worker.changes || [];
              const originalTotal = worker.totalHours || worker.originalTotal || 0;
              const originalOfModified = days.reduce((acc, c) => {
                const isNewDay = c.isNew || (!c.entry || c.entry === '--:--');
                const entry = c.entry || c.startTime || '--:--';
                const exit = c.exit || c.endTime || '--:--';
                const bStart = c.breakStart || '--:--';
                const bEnd = c.breakEnd || '--:--';
                const h = calculateDuration(entry, exit, bStart === '--:--' ? null : bStart, bEnd === '--:--' ? null : bEnd);
                return acc + h;
              }, 0);
              const finalOfModified = days.reduce((acc, c) => {
                if (c.adminHours !== undefined && c.adminHours !== null) {
                  return acc + c.adminHours;
                }
                if (c.editedHours !== undefined && c.editedHours !== null) {
                  return acc + parseFloat(c.editedHours);
                }
                if (c.newHours !== undefined && c.newHours !== null) {
                  return acc + parseFloat(c.newHours);
                }
                // For new days added by client, use editedEntry/Exit
                const isNewDay = c.isNew || (!c.entry || c.entry === '--:--');
                const entry = c.adminEntry || (isNewDay ? c.editedEntry : null) || c.editedEntry || c.entry || '--:--';
                const exit = c.adminExit || (isNewDay ? c.editedExit : null) || c.editedExit || c.exit || '--:--';
                const bStart = c.adminBreakStart || c.editedBreakStart || c.breakStart || '--:--';
                const bEnd = c.adminBreakEnd || c.editedBreakEnd || c.breakEnd || '--:--';
                const h = calculateDuration(entry, exit, bStart === '--:--' ? null : bStart, bEnd === '--:--' ? null : bEnd);
                return acc + h;
              }, 0);
              return parseFloat((originalTotal - originalOfModified + finalOfModified).toFixed(2));
            };

            const handleUpdateDraft = (workerName, date, field, value) => {
              const isTimeField = field.endsWith('Entry') || field.endsWith('Exit') || field.endsWith('BreakStart') || field.endsWith('BreakEnd');
              if (isTimeField && value === '--' || value === '--:') {
                value = '--:--';
              }
              // D-01: Use type-specific state setters
              const setDrafts = isQuickReport ? setQuickEditingDrafts : isPrecisionReport ? setPrecisionEditingDrafts : setLegacyEditingDrafts;
              setDrafts(prev => {
                const currentDraft = prev[notif.id] ? JSON.parse(JSON.stringify(prev[notif.id])) : (() => {
                  const draft = JSON.parse(JSON.stringify(currentData));
                  draft.workers.forEach(w => {
                    w.editedTotalHours = calculateMonthTotal(w);
                  });
                  return draft;
                })();
                const worker = currentDraft.workers.find(w => w.name === workerName);
                if (worker) {
                  let change = (worker.dailyRecords || worker.changes).find(c => (c.date || c.dateLabel) === date);
                  if (!change) {
                    change = {
                      date: date,
                      entry: '--:--',
                      exit: '--:--',
                      breakStart: '--:--',
                      breakEnd: '--:--',
                      hours: 0,
                    };
                    if (worker.dailyRecords) {
                      worker.dailyRecords.push(change);
                    } else if (worker.changes) {
                      worker.changes.push(change);
                    }
                  }

                  if (change) {
                    change.isPlaceholder = false;
                    if (field !== 'adminHours' && field !== 'toDelete' && field !== 'isPlaceholder' && field !== 'isNew' && field !== 'originalHours' && field !== 'editedHours' && field !== 'newHours' && !value) {
                      value = '--:--';
                    }
                    change[field] = value;
                    if (field.startsWith('admin')) {
                      const entry = change.adminEntry || change.editedEntry || change.entry || '';
                      const exit = change.adminExit || change.editedExit || change.exit || '';
                      const bStart = change.adminBreakStart || change.breakStart || '--:--';
                      const bEnd = change.adminBreakEnd || change.breakEnd || '--:--';
                      change.adminHours = calculateDuration(entry, exit, bStart === '--:--' ? null : bStart, bEnd === '--:--' ? null : bEnd);
                    }
                    worker.editedTotalHours = calculateMonthTotal(worker);
                  }
                }
                return { ...prev, [notif.id]: currentDraft };
              });
            };

            const isAcceptance = notif.title.includes('Contra-proposta Aceite');

            return (
              <div key={notif.id} className={`rounded-[1.5rem] p-6 border ${isAcceptance ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isAcceptance ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                      {isAcceptance ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    </div>
                    <div>
                      <h4 className={`font-black uppercase tracking-tight ${isAcceptance ? 'text-emerald-800' : 'text-slate-800'}`}>{notif.title}</h4>
                      {isPrecisionReport && (
                        <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[8px] font-black rounded uppercase">Precisão</span>
                      )}
                      {isQuickReport && (
                        <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-600 text-[8px] font-black rounded uppercase">Rápido</span>
                      )}
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">{new Date(notif.created_at).toLocaleDateString('pt-PT')}</p>
                    </div>
                  </div>
                </div>

                {isAcceptance ? (
                  <div className="space-y-4">
                    <div className="bg-white/60 p-4 rounded-2xl border border-emerald-100 italic text-sm text-emerald-900">{notif.message}</div>
                    <button onClick={() => handleDelete('app_notifications', notif.id)} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95">Arquivar e Remover da Lista</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayWorkers?.length === 0 && (
                      <div className="bg-white/60 p-6 rounded-2xl border border-amber-200 text-sm text-amber-900 whitespace-pre-wrap font-medium">
                        {notif.message}
                      </div>
                    )}

                    {displayWorkers?.length > 0 && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 space-y-3">
                          {!isEditing && (
                            <button
                              onClick={() => {
                                const setDrafts = isQuickReport ? setQuickEditingDrafts : isPrecisionReport ? setPrecisionEditingDrafts : setLegacyEditingDrafts;
                                const setDay = isQuickReport ? setQuickActiveDay : isPrecisionReport ? setPrecisionActiveDay : null;
                                setDrafts(prev => ({ ...prev, [notif.id]: JSON.parse(JSON.stringify(currentData)) }));
                                if (setDay) setDay(prev => ({ ...prev, [notif.id]: displayWorkers[0]?.dailyRecords?.[0]?.date || displayWorkers[0]?.dailyRecords?.[0]?.dateLabel || null }));
                              }}
                              className="w-full p-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                            >
                              <Edit2 size={14} className="inline mr-2" /> Iniciar Edição
                            </button>
                          )}
                        </div>
                        {/* Lista de Colaboradores (Esquerda) */}
                        <div className="lg:col-span-1 space-y-3">
                          {displayWorkers.map((worker, idx) => {
                            const selectedWorkerId = activeWorkerInNotif[notif.id] || displayWorkers[0]?.id;
                            const isSelected = selectedWorkerId === worker.id;
                            const workerChanged = (worker.editedTotalHours || worker.suggestedTotal || 0) !== (worker.totalHours || worker.originalTotal || 0);
                            const originalTotal = worker.totalHours || worker.originalTotal || 0;
                            const suggestedTotal = worker.editedTotalHours || worker.suggestedTotal || 0;
                            const diff = (suggestedTotal - originalTotal).toFixed(2);
                            const diffColor = diff >= 0 ? 'text-emerald-600' : 'text-rose-600';
                            const diffSign = diff >= 0 ? '+' : '';
                            return (
                              <button
                                key={idx}
                                onClick={() => setActiveWorkerInNotif(prev => ({ ...prev, [notif.id]: worker.id }))}
                                className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex flex-col gap-1 ${isSelected ? 'border-indigo-600 bg-white shadow-lg' : 'border-slate-100 bg-slate-50/50 hover:border-slate-300'}`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[8px] ${workerChanged ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                    {workerChanged ? '!' : '✓'}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase">{suggestedTotal}h</span>
                                    <span className={`font-black text-[10px] ${diffColor}`}>{diffSign}{diff}h</span>
                                  </div>
                                </div>
                                <h4 className="font-black text-slate-800 text-xs leading-tight">{worker.name}</h4>
                              </button>
                            );
                          })}
                        </div>

                        {/* Detalhes do Colaborador Selecionado (Direita) */}
                        <div className="lg:col-span-2 space-y-3">
                          {(() => {
                            const selectedId = activeWorkerInNotif[notif.id] || displayWorkers[0]?.id;
                            const worker = displayWorkers.find(w => w.id === selectedId);
                            if (!worker) return null;
                            const days = worker.dailyRecords || worker.changes || [];
                            const totalSugerido = worker.editedTotalHours || worker.totalHours || 0;
                            const originalTotal = worker.totalHours || worker.originalTotal || 0;
                            const diff = (totalSugerido - originalTotal).toFixed(2);
                            const diffColor = diff >= 0 ? 'text-emerald-600' : 'text-rose-600';
                            const diffSign = diff >= 0 ? '+' : '';

                            return (
                              <div className="animate-fade-in space-y-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tighter">{worker.name}</h3>
                                  <div className="flex items-center gap-2">
                                    {!hasClientEdits && (
                                      <button
                                        onClick={() => setExpandedCorrecaoDias(prev => ({ ...prev, [notif.id]: !prev[notif.id] }))}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${precisionExpandedDias[notif.id] ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        title={precisionExpandedDias[notif.id] ? 'Ocultar dias sem registo' : 'Mostrar todos os dias do mês'}
                                      >
                                        {precisionExpandedDias[notif.id] ? '▼ Todos' : '▶ Expandir'}
                                      </button>
                                    )}
                                    <span className="text-sm text-slate-400 line-through">{originalTotal}h</span>
                                    <span className="text-slate-300">→</span>
                                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg font-black text-sm">{totalSugerido}h</span>
                                    <span className={`font-black text-[10px] ${diffColor}`}>{diffSign}{diff}h</span>
                                  </div>
                                </div>

                                <div className="space-y-3">


                                  {(() => {
                                    let daysToRender = days;

                                    // Se há edits do cliente, nunca expandir - mostrar apenas os dias editados
                                    // Se não há edits E expanded=true, expandir para todos os dias do mês
                                    if (!hasClientEdits && precisionExpandedDias[notif.id] && days.length > 0) {
                                      const sampleDate = days.find(r => r.date || r.dateLabel)?.date || days.find(r => r.date || r.dateLabel)?.dateLabel;
                                      if (sampleDate) {
                                        const [y, m] = sampleDate.split('-').map(Number);
                                        const daysInMonth = new Date(y, m, 0).getDate();
                                        const recordsMap = {};
                                        days.forEach(r => { if (r.date || r.dateLabel) recordsMap[r.date || r.dateLabel] = r; });

                                        daysToRender = Array.from({ length: daysInMonth }, (_, i) => {
                                          const dayStr = String(i + 1).padStart(2, '0');
                                          const monthStr = String(m).padStart(2, '0');
                                          const dateStr = `${y}-${monthStr}-${dayStr}`;
                                          return recordsMap[dateStr] || {
                                            date: dateStr,
                                            entry: '--:--',
                                            exit: '--:--',
                                            breakStart: '--:--',
                                            breakEnd: '--:--',
                                            hours: 0,
                                            editedEntry: '--:--',
                                            editedExit: '--:--',
                                            editedBreakStart: '--:--',
                                            editedBreakEnd: '--:--',
                                            editedHours: 0,
                                            isNew: true,
                                            isPlaceholder: true
                                          };
                                        });
                                      }
                                    } else {
                                      // Modo Expandir: não filtra, apenas usa array original
                                      daysToRender = days;
                                    }

                                    // Garantir que a lista fica sempre ordenada cronologicamente
                                    daysToRender = [...daysToRender].sort((a, b) => {
                                      const dateA = a.date || a.dateLabel || '';
                                      const dateB = b.date || b.dateLabel || '';
                                      return dateA.localeCompare(dateB);
                                    });

                                    return daysToRender.map((change, cIdx) => {
                                      // Verificar se o dia foi editado pelo cliente (não apagado)
                                      const isEmptyValue = (val) => val === '' || val === null || val === undefined;
                                      const isClientEditedDay = !isEmptyValue(change.editedEntry) && !isEmptyValue(change.editedExit) &&
                                        (change.editedEntry !== '--:' && change.editedEntry !== '--:--' && change.editedEntry !== change.entry) ||
                                        !isEmptyValue(change.editedExit) && (change.editedExit !== '--:' && change.editedExit !== '--:--' && change.editedExit !== change.exit) ||
                                        !isEmptyValue(change.editedBreakStart) && (change.editedBreakStart !== '--:' && change.editedBreakStart !== '--:--') ||
                                        !isEmptyValue(change.editedBreakEnd) && (change.editedBreakEnd !== '--:' && change.editedBreakEnd !== '--:--');

                                      // Verificar se o dia foi apagado pelo cliente
                                      const hadOriginalHours = (change.originalHours > 0) || (change.hours > 0);
                                      const wasOriginalEntry = change.entry && change.entry !== '--:';
                                      const wasOriginalExit = change.exit && change.exit !== '--:';
                                      const isClearedPattern = (val) => val === '--:--' || (val && val.startsWith('--:') && val.includes('-----'));
                                      const isSameAsOriginal = (change.editedEntry === change.entry || isEmptyValue(change.editedEntry)) &&
                                        (change.editedExit === change.exit || isEmptyValue(change.editedExit));
                                      const isClientClearedDay = hadOriginalHours && !isSameAsOriginal && (wasOriginalEntry || wasOriginalExit) &&
                                        (isClearedPattern(change.editedEntry) || isClearedPattern(change.editedExit) ||
                                          isEmptyValue(change.editedEntry) || isEmptyValue(change.editedExit));

                                      const shouldShowCorrection = isClientEditedDay || isClientClearedDay;

                                      // Se há edits do cliente, não mostrar dias sem edits
                                      if (hasClientEdits && !shouldShowCorrection) return null;

                                      const displayEntry = change.adminEntry || change.editedEntry || change.entry || '--:--';
                                      const displayExit = change.adminExit || change.editedExit || change.exit || '--:--';
                                      const displayBreakStart = change.adminBreakStart || change.editedBreakStart || change.breakStart || '--:--';
                                      const displayBreakEnd = change.adminBreakEnd || change.editedBreakEnd || change.breakEnd || '--:--';
                                      const displayHours = (change.adminHours !== null && change.adminHours !== undefined)
                                        ? change.adminHours
                                        : (change.editedHours || calculateDuration(change.entry, change.exit, change.breakStart === '--:--' ? null : change.breakStart, change.breakEnd === '--:--' ? null : change.breakEnd) || 0);

                                      const isDayChanged = change.adminEntry || change.adminExit || change.adminBreakStart || change.adminBreakEnd || isClientEditedDay;
                                      const isDayCleared = isClientClearedDay;

                                      const isDayEditing = activeEditingDay[notif.id] === (change.date || change.dateLabel);
                                      const toggleDayEdit = () => {
                                        setActiveEditingDay(prev => ({
                                          ...prev,
                                          [notif.id]: isDayEditing ? null : (change.date || change.dateLabel)
                                        }));
                                      };

                                      return (
                                        <div key={cIdx} className={`flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 rounded-xl gap-3 ${isDayCleared ? 'bg-rose-50 border border-rose-100' : isDayChanged && !change.isNew ? 'bg-amber-50 border border-amber-100' : (!change.entry || change.entry === '--:--' || change.isNew ? 'bg-slate-50/50 border border-slate-200 opacity-70' : 'bg-slate-50 border border-transparent')} ${isDayEditing ? 'ring-2 ring-indigo-500' : ''}`}>
                                          <div className="flex items-center gap-3">
                                            {isEditing && (
                                              <button onClick={toggleDayEdit} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded">
                                                <Edit2 size={14} />
                                              </button>
                                            )}
                                            <span className="font-bold text-slate-600 text-[10px] uppercase tracking-wider">{change.date || change.dateLabel}</span>
                                            {isDayCleared && <span className="text-[8px] font-black text-rose-500 bg-rose-100 px-2 py-0.5 rounded uppercase">Apagado</span>}
                                          </div>
                                          <div className={`flex flex-col sm:flex-row items-center gap-3 text-xs px-4 py-2 rounded-lg shadow-sm ${isDayCleared ? 'bg-white border border-rose-200' : isDayChanged ? 'bg-white border border-amber-200' : 'bg-white/50 border border-slate-100'}`}>
                                            {isDayCleared ? (
                                              <>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-slate-400 font-bold">Turno:</span>
                                                  <span className="text-slate-400 line-through decoration-rose-400 text-xs">{change.entry} - {change.exit}</span>
                                                  <span className="text-slate-300 text-xs">→</span>
                                                  <span className="text-rose-400 font-black text-xs">--:-- - --:--</span>
                                                </div>
                                                <div className="hidden sm:block w-px h-4 bg-slate-200"></div>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-slate-400 font-bold">Pausa:</span>
                                                  <span className="text-slate-400 line-through decoration-rose-400 text-xs">{(change.breakStart || '--:--')} - {(change.breakEnd || '--:--')}</span>
                                                  <span className="text-slate-300 text-xs">→</span>
                                                  <span className="text-rose-400 font-black text-xs">--:-- - --:--</span>
                                                </div>
                                              </>
                                            ) : isDayChanged ? (
                                              <>
                                                {isDayEditing ? (
                                                  <>
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-slate-400 font-bold">Turno:</span>
                                                      <input type="time" value={change.adminEntry || ''} onChange={e => handleUpdateDraft(worker.name, change.date, 'adminEntry', e.target.value)} className="w-24 bg-white border border-indigo-200 rounded-lg p-1 text-xs font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                      <span className="text-indigo-400">-</span>
                                                      <input type="time" value={change.adminExit || ''} onChange={e => handleUpdateDraft(worker.name, change.date, 'adminExit', e.target.value)} className="w-24 bg-white border border-indigo-200 rounded-lg p-1 text-xs font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                    </div>
                                                    <div className="hidden sm:block w-px h-4 bg-slate-200"></div>
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-slate-400 font-bold">Pausa:</span>
                                                      <input type="time" value={change.adminBreakStart || ''} onChange={e => handleUpdateDraft(worker.name, change.date, 'adminBreakStart', e.target.value)} className="w-24 bg-white border border-indigo-200 rounded-lg p-1 text-xs font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                      <span className="text-indigo-400">-</span>
                                                      <input type="time" value={change.adminBreakEnd || ''} onChange={e => handleUpdateDraft(worker.name, change.date, 'adminBreakEnd', e.target.value)} className="w-24 bg-white border border-indigo-200 rounded-lg p-1 text-xs font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                    </div>
                                                    <div className="hidden sm:block w-px h-4 bg-slate-200"></div>
                                                    <button onClick={() => { handleUpdateDraft(worker.name, change.date, 'adminEntry', ''); handleUpdateDraft(worker.name, change.date, 'adminExit', ''); handleUpdateDraft(worker.name, change.date, 'adminBreakStart', ''); handleUpdateDraft(worker.name, change.date, 'adminBreakEnd', ''); handleUpdateDraft(worker.name, change.date, 'adminHours', 0); }} className="p-2 rounded-lg transition-all bg-rose-100 text-rose-600 hover:bg-rose-200" title="Apagar valores">
                                                      <Trash2 size={16} />
                                                    </button>
                                                  </>
                                                ) : (
                                                  <>
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-slate-400 font-bold">Turno:</span>
                                                      <span className="text-slate-400 line-through decoration-rose-400">{change.entry} - {change.exit}</span>
                                                      <span className="text-slate-300">→</span>
                                                      <span className="text-amber-600 font-black">{displayEntry} - {displayExit}</span>
                                                    </div>
                                                    <div className="hidden sm:block w-px h-4 bg-slate-200"></div>
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-slate-400 font-bold">Pausa:</span>
                                                      <span className="text-slate-400 line-through decoration-rose-400">{change.breakStart || '--:--'} - {change.breakEnd || '--:--'}</span>
                                                      <span className="text-slate-300">→</span>
                                                      <span className="text-amber-600 font-black">{displayBreakStart} - {displayBreakEnd}</span>
                                                    </div>
                                                  </>
                                                )}
                                              </>
                                            ) : (
                                              <>
                                                {isDayEditing ? (
                                                  <>
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-slate-400 font-bold">Turno:</span>
                                                      <input type="time" value={change.adminEntry || ''} onChange={e => handleUpdateDraft(worker.name, change.date, 'adminEntry', e.target.value)} className="w-24 bg-white border border-indigo-200 rounded-lg p-1 text-xs font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                      <span className="text-indigo-400">-</span>
                                                      <input type="time" value={change.adminExit || ''} onChange={e => handleUpdateDraft(worker.name, change.date, 'adminExit', e.target.value)} className="w-24 bg-white border border-indigo-200 rounded-lg p-1 text-xs font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                    </div>
                                                    <div className="hidden sm:block w-px h-4 bg-slate-200"></div>
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-slate-400 font-bold">Pausa:</span>
                                                      <input type="time" value={change.adminBreakStart || ''} onChange={e => handleUpdateDraft(worker.name, change.date, 'adminBreakStart', e.target.value)} className="w-24 bg-white border border-indigo-200 rounded-lg p-1 text-xs font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                      <span className="text-indigo-400">-</span>
                                                      <input type="time" value={change.adminBreakEnd || ''} onChange={e => handleUpdateDraft(worker.name, change.date, 'adminBreakEnd', e.target.value)} className="w-24 bg-white border border-indigo-200 rounded-lg p-1 text-xs font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                    </div>
                                                    <div className="hidden sm:block w-px h-4 bg-slate-200"></div>
                                                    <button onClick={() => { handleUpdateDraft(worker.name, change.date, 'adminEntry', ''); handleUpdateDraft(worker.name, change.date, 'adminExit', ''); handleUpdateDraft(worker.name, change.date, 'adminBreakStart', ''); handleUpdateDraft(worker.name, change.date, 'adminBreakEnd', ''); handleUpdateDraft(worker.name, change.date, 'adminHours', 0); }} className="p-2 rounded-lg transition-all bg-rose-100 text-rose-600 hover:bg-rose-200" title="Apagar valores">
                                                      <Trash2 size={16} />
                                                    </button>
                                                  </>
                                                ) : (
                                                  <>
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-slate-400 font-bold">Turno:</span>
                                                      <span className="text-slate-600 font-black">{change.entry} - {change.exit}</span>
                                                    </div>
                                                    <div className="hidden sm:block w-px h-4 bg-slate-100"></div>
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-slate-400 font-bold">Pausa:</span>
                                                      <span className="text-slate-600 font-black">{change.breakStart || '--:--'} - {change.breakEnd || '--:--'}</span>
                                                    </div>
                                                  </>
                                                )}
                                              </>
                                            )}
                                            {(() => {
                                              const originalDayHours = (change.hours !== undefined && change.hours !== null && change.hours !== '')
                                                ? parseFloat(change.hours)
                                                : calculateDuration(change.entry, change.exit, change.breakStart === '--:--' ? null : change.breakStart, change.breakEnd === '--:--' ? null : change.breakEnd);
                                              const dayDiff = (displayHours - originalDayHours).toFixed(2);
                                              const dayDiffColor = dayDiff >= 0 ? 'text-emerald-600' : 'text-rose-600';
                                              const dayDiffSign = dayDiff >= 0 ? '+' : '';
                                              const hoursDisplay = (val) => val > 0 ? `${val}h` : '--h';
                                              if (isDayCleared) {
                                                return (
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-xs text-slate-400 line-through">{originalDayHours.toFixed(2)}h</span>
                                                    <span className="text-slate-300">→</span>
                                                    <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded font-black text-xs">0.00h</span>
                                                    <span className="text-rose-400 font-black text-[9px]">-{originalDayHours.toFixed(2)}h</span>
                                                  </div>
                                                );
                                              } else if (isDayChanged) {
                                                return (
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-xs text-slate-400 line-through">{hoursDisplay(originalDayHours)}</span>
                                                    <span className="text-slate-300">→</span>
                                                    <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-md font-black text-xs">{hoursDisplay(displayHours)}</span>
                                                    <span className={`font-black text-[9px] ${dayDiffColor}`}>{dayDiffSign}{dayDiff}h</span>
                                                  </div>
                                                );
                                              } else {
                                                return (
                                                  <span className="sm:ml-2 px-2 py-1 rounded-md font-black bg-slate-100 text-slate-600">{hoursDisplay(displayHours)}</span>
                                                );
                                              }
                                            })()}


                                          </div>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {details.justification && (
                      <div className="bg-white rounded-xl p-4 border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Justificação do Cliente</p>
                        <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded">"{details.justification}"</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      {isEditing ? (
                        <>
                          <button
                            onClick={async () => {
                              const targetClientId = notif.target_client_id;

                              if (!targetClientId) {
                                alert("ERRO: target_client_id não encontrado na notificação!");
                                return;
                              }

                              for (const worker of (displayWorkers || [])) {
                                logs.filter(l => String(l.workerId) === String(worker.id) && String(l.clientId) === String(targetClientId));

                                for (const change of (worker.dailyRecords || worker.changes || [])) {
                                  const dateStr = change.date || change.rawDate;
                                  if (!dateStr) continue;

                                  const workerIdStr = String(worker.id);
                                  const clientIdStr = String(targetClientId);

                                  const oldLog = logs.find(l => String(l.workerId) === workerIdStr && String(l.clientId) === clientIdStr && l.date === dateStr);

                                  // Se há edits do cliente, usar apenas editedEntry/editedExit
                                  // Se não há edits do cliente, usar hierarquia normal (admin > cliente > original)
                                  const entry = hasClientEdits
                                    ? (change.editedEntry || change.entry || '--:--')
                                    : (change.adminEntry || change.editedEntry || change.entry || '--:--');
                                  const exit = hasClientEdits
                                    ? (change.editedExit || change.exit || '--:--')
                                    : (change.adminExit || change.editedExit || change.exit || '--:--');
                                  const bStart = hasClientEdits
                                    ? (change.editedBreakStart || change.breakStart || '--:--')
                                    : (change.adminBreakStart || change.editedBreakStart || change.breakStart || '--:--');
                                  const bEnd = hasClientEdits
                                    ? (change.editedBreakEnd || change.breakEnd || '--:--')
                                    : (change.adminBreakEnd || change.editedBreakEnd || change.breakEnd || '--:--');

                                  const isAdminCleared = change.adminEntry === '--:--' || change.adminExit === '--:--';
                                  const isClientCleared = ((change.originalHours && change.originalHours > 0) || (change.hours && change.hours > 0)) && (change.entry && change.entry !== '--:--') && (change.editedEntry === '--:--' || change.editedExit === '--:--');

                                  // Se admin apagou OU cliente apagou (e tinha registro original), deletar o log
                                  if (isAdminCleared || isClientCleared) {
                                    if (oldLog) {
                                      await handleDelete('logs', oldLog.id);
                                    }
                                    continue;
                                  }

                                  // Usar editedHours se existir (do cliente), senão adminHours, senão calcular
                                  const dur = change.adminHours ?? change.editedHours ?? calculateDuration(entry, exit, bStart === '--:--' ? null : bStart, bEnd === '--:--' ? null : bEnd);

                                  const logData = {
                                    startTime: entry === '--:--' ? null : entry,
                                    endTime: exit === '--:--' ? null : exit,
                                    breakStart: bStart === '--:--' ? null : bStart,
                                    breakEnd: bEnd === '--:--' ? null : bEnd,
                                    hours: dur
                                  };

                                  if (oldLog) {
                                    await saveToDb('logs', oldLog.id, { ...oldLog, ...logData });
                                  } else {
                                    const nid = "log_" + Date.now() + Math.random();
                                    await saveToDb('logs', nid, {
                                      id: nid,
                                      date: dateStr,
                                      workerId: workerIdStr,
                                      clientId: clientIdStr,
                                      ...logData,
                                      created_at: new Date().toISOString()
                                    });
                                  }
                                }
                              }

                              // Envia notificação para o cliente
                              const totalOriginal = (displayWorkers || []).reduce((acc, w) => acc + (parseFloat(w.totalHours) || 0), 0);
                              const totalCorrigido = (displayWorkers || []).reduce((acc, w) => acc + (parseFloat(w.editedTotalHours) || parseFloat(w.totalHours) || 0), 0);

                              let clientMsg = `Olá ${currentData.clientName},\nRecebeu uma nova atualização no seu portal de cliente.\nNotificação\nCorreção: ${currentData.monthLabel}\n\n`;
                              clientMsg += `⚠️ CORREÇÃO DO ADMINISTRADOR\n`;
                              clientMsg += `👤 Cliente: ${currentData.clientName}\n📅 Período: ${currentData.monthLabel}\n`;
                              const diffTotal = (totalCorrigido - totalOriginal).toFixed(2);
                              const diffSignTotal = diffTotal >= 0 ? '+' : '';
                              clientMsg += `💰 Total Original: ${totalOriginal.toFixed(2)}h\n`;
                              clientMsg += `✅ Total Corrigido: ${totalCorrigido.toFixed(2)}h (${diffSignTotal}${diffTotal}h)\n\n`;
                              (displayWorkers || []).forEach(w => {
                                const orig = parseFloat(w.totalHours) || 0;
                                const edit = parseFloat(w.editedTotalHours) || orig;
                                const diff = (edit - orig).toFixed(2);
                                const diffSign = diff >= 0 ? '+' : '';
                                clientMsg += `👤 ${w.name}: ${orig.toFixed(2)}h ➔ ${edit.toFixed(2)}h (${diffSign}${diff}h)\n`;
                              });
                              const notifId = "cntr_" + Date.now();
                              const newNotif = {
                                id: notifId,
                                title: `Correção: ${currentData.monthLabel || ''}`,
                                message: clientMsg,
                                type: 'warning',
                                target_type: 'client',
                                target_client_id: String(notif.target_client_id),
                                created_at: new Date().toISOString(),
                                is_active: true,
                                payload: { type: 'correcao_admin', month: currentData.monthLabel, totalOriginal, totalCorrigido, changes: displayWorkers }
                              };
                              await saveToDb('app_notifications', notifId, newNotif);

                              const targetClient = clients.find(c => String(c.id) === String(notif.target_client_id));
                              if (targetClient?.email) {
                                await sendNotificationEmail(targetClient.email, targetClient.name, newNotif.title, newNotif.message, notif.target_client_id, currentData.monthLabel);
                              }

                              await handleDelete('app_notifications', notif.id);
                              const setDrafts = isQuickReport ? setQuickEditingDrafts : isPrecisionReport ? setPrecisionEditingDrafts : setLegacyEditingDrafts;
                              setDrafts(prev => { const n = { ...prev }; delete n[notif.id]; return n; });

                              if (notif.payload?.correcao_id) {
                                await saveToDb('correcoes', notif.payload.correcao_id, { status: 'resolved' });
                              }

                              alert("Correções aplicadas e cliente notificado!");
                            }}
                            className={`flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 ${currentData.workers?.length === 0 ? 'hidden' : ''}`}
                          >
                            <Send size={16} /> Corrigir e Enviar
                          </button>
                          <button onClick={() => {
                            const setDrafts = isQuickReport ? setQuickEditingDrafts : isPrecisionReport ? setPrecisionEditingDrafts : setLegacyEditingDrafts;
                            const setDay = isQuickReport ? setQuickActiveDay : isPrecisionReport ? setPrecisionActiveDay : null;
                            setDrafts(prev => { const n = { ...prev }; delete n[notif.id]; return n; });
                            if (setDay) setDay(prev => { const n = { ...prev }; delete n[notif.id]; return n; });
                          }} className="px-6 py-3 bg-white text-slate-500 border border-slate-200 rounded-xl font-black text-xs uppercase hover:bg-slate-50 transition-all">Cancelar</button>
                          {isEditing && (
                            <button
                              onClick={async () => {
                                const reason = prompt("Motivo da Contra-proposta / Contestação:");
                                if (!reason) return;

                                let clientMsg = `⚠️ CONTRA-PROPOSTA DO ADMINISTRADOR\n`;
                                clientMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                                clientMsg += `👤 Cliente: ${currentData.clientName}\n`;
                                clientMsg += `📅 Período: ${currentData.monthLabel}\n`;
                                clientMsg += `💬 Motivo: ${reason}\n\n`;
                                clientMsg += `📊 RESUMO DAS ALTERAÇÕES PROPOSTAS:\n`;
                                clientMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

                                currentData.workers.forEach(w => {
                                  clientMsg += `\n👤 TRABALHADOR: ${w.name}\n`;
                                  const originalTotal = w.totalHours || w.originalTotal || 0;
                                  const days = w.dailyRecords || w.changes || [];
                                  const originalOfModified = days.reduce((acc, c) => acc + (parseFloat(c.originalHours) || parseFloat(c.hours) || 0), 0);
                                  const editedOfModified = days.reduce((acc, c) => {
                                    if (c.editedHours !== undefined) return acc + parseFloat(c.editedHours);
                                    if (c.newHours !== undefined) return acc + parseFloat(c.newHours);
                                    return acc + (parseFloat(c.originalHours) || parseFloat(c.hours) || 0);
                                  }, 0);
                                  const suggestedTotal = parseFloat((originalTotal - originalOfModified + editedOfModified).toFixed(2));
                                  const adminTotal = w.editedTotalHours || 0;
                                  clientMsg += `   📊 Total do Período: ${originalTotal}h ➔ ${suggestedTotal}h ➔ ${adminTotal}h\n`;
                                });

                                const normalizedClientName = (currentData.clientName || "").trim().toLowerCase();
                                const clientObj = clients.find(c => (c.name || "").trim().toLowerCase() === normalizedClientName);
                                const targetClientId = clientObj?.id;

                                if (!targetClientId) {
                                  alert("Erro: Não foi possível identificar o cliente.");
                                  return;
                                }

                                await saveToDb('app_notifications', `cntr_${notif.id}_${Date.now()}`, {
                                  title: `Contra-proposta: ${currentData.monthLabel}`,
                                  message: clientMsg,
                                  type: 'warning',
                                  target_type: 'client',
                                  target_client_id: String(targetClientId),
                                  created_at: new Date().toISOString(),
                                  is_active: true,
                                  payload: {
                                    type: 'counter_proposal',
                                    reason: reason,
                                    changes: currentData.workers
                                  }
                                });

                                await saveToDb('app_notifications', notif.id, {
                                  ...notif,
                                  status: 'contestada',
                                  admin_response: reason,
                                  is_active: false
                                });

                                const setDrafts = isQuickReport ? setQuickEditingDrafts : isPrecisionReport ? setPrecisionEditingDrafts : setLegacyEditingDrafts;
                                setDrafts(prev => { const n = { ...prev }; delete n[notif.id]; return n; });
                                alert("Contra-proposta enviada ao cliente!");
                              }}
                              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
                            >
                              <Sparkles size={16} /> Enviar Contra-proposta
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {(displayWorkers && displayWorkers.length > 0) ? (
                            <button
                              onClick={async () => {
                                if (!window.confirm("Aprovar todas as alterações?")) return;

                                for (const worker of displayWorkers) {
                                  for (const change of (worker.dailyRecords || worker.changes || [])) {
                                    const dateStr = change.date || change.rawDate;
                                    if (!dateStr || !dateStr.includes('-')) continue;
                                    const oldLog = logs.find(l => String(l.workerId) === String(worker.id) && String(l.clientId) === String(notif.target_client_id) && l.date === dateStr);

                                    const entry = change.adminEntry || change.editedEntry || change.entry || '--:--';
                                    const exit = change.adminExit || change.editedExit || change.exit || '--:--';
                                    const bStart = change.adminBreakStart || change.editedBreakStart || change.breakStart || '--:--';
                                    const bEnd = change.adminBreakEnd || change.editedBreakEnd || change.breakEnd || '--:--';

                                    const isAdminCleared = change.adminEntry === '--:--' || change.adminExit === '--:--';
                                    const isClientCleared = ((change.originalHours && change.originalHours > 0) || (change.hours && change.hours > 0)) && (change.entry && change.entry !== '--:--') && (change.editedEntry === '--:--' || change.editedExit === '--:--');

                                    // Se admin apagou OU cliente apagou (e tinha registro original), deletar o log
                                    if (isAdminCleared || isClientCleared) {
                                      if (oldLog) {
                                        await handleDelete('logs', oldLog.id);
                                      }
                                      continue;
                                    }

                                    const isNewDay = change.isNew || (!change.originalHours || change.originalHours === 0);
                                    const hasValidTimes = entry && entry !== '--:--' && exit && exit !== '--:--';
                                    const shouldSave = hasValidTimes || oldLog || isNewDay;

                                    if (shouldSave) {
                                      // Usar editedHours se existir (do cliente), senão adminHours, senão calcular
                                      const dur = change.adminHours ?? change.editedHours ?? (hasValidTimes ? calculateDuration(entry, exit, bStart === '--:--' ? null : bStart, bEnd === '--:--' ? null : bEnd) : 0);
                                      if (oldLog) {
                                        await saveToDb('logs', oldLog.id, { ...oldLog, startTime: entry === '--:--' ? null : entry, endTime: exit === '--:--' ? null : exit, breakStart: bStart === '--:--' ? null : bStart, breakEnd: bEnd === '--:--' ? null : bEnd, hours: dur });
                                      } else {
                                        const nid = "log_" + Date.now() + Math.random().toString(36).substr(2, 9);
                                        await saveToDb('logs', nid, { id: nid, date: dateStr, workerId: String(worker.id), clientId: String(notif.target_client_id), startTime: entry === '--:--' ? null : entry, endTime: exit === '--:--' ? null : exit, breakStart: bStart === '--:--' ? null : bStart, breakEnd: bEnd === '--:--' ? null : bEnd, hours: dur, created_at: new Date().toISOString() });
                                      }
                                    }
                                  }
                                }

                                const feedbackNotifId = "fb_" + Date.now();
                                await saveToDb('app_notifications', feedbackNotifId, {
                                  id: feedbackNotifId,
                                  title: `Reporte de Divergência Resolvido: ${currentData.monthLabel || details.monthLabel || ''}`,
                                  message: `O seu reporte de divergência referente ao período de ${currentData.monthLabel || details.monthLabel || ''} foi analisado e resolvido pelo administrador. Por favor, aceda ao portal para realizar a validação final das horas.`,
                                  type: 'success',
                                  target_type: 'client',
                                  target_client_id: String(notif.target_client_id),
                                  created_at: new Date().toISOString(),
                                  is_active: true,
                                  payload: { type: 'correcoes_aplicadas' }
                                });

                                const targetClient2 = clients.find(c => String(c.id) === String(notif.target_client_id));
                                if (targetClient2?.email) {
                                  const fbNotif = {
                                    title: `Reporte de Divergência Resolvido: ${currentData.monthLabel || details.monthLabel || ''}`,
                                    message: `O seu reporte de divergência referente ao período de ${currentData.monthLabel || details.monthLabel || ''} foi analisado e resolvido pelo administrador. Por favor, aceda ao portal para realizar a validação final das horas.`
                                  };
                                  const totalOriginal = (displayWorkers || []).reduce((acc, w) => acc + (parseFloat(w.totalHours) || 0), 0);
                                  const totalCorrigido = (displayWorkers || []).reduce((acc, w) => acc + (parseFloat(w.editedTotalHours) || parseFloat(w.totalHours) || 0), 0);
                                  const diffTotalAcc = (totalCorrigido - totalOriginal).toFixed(2);
                                  const diffSignTotalAcc = diffTotalAcc >= 0 ? '+' : '';
                                  let clientMsgAcc = `Olá ${targetClient2.name},\nRecebeu uma nova atualização no seu portal de cliente.\nNotificação\nCorreção: ${currentData.monthLabel || details.monthLabel || ''}\n\n`;
                                  clientMsgAcc += `⚠️ CORREÇÃO DO ADMINISTRADOR\n`;
                                  clientMsgAcc += `👤 Cliente: ${targetClient2.name}\n📅 Período: ${currentData.monthLabel || details.monthLabel || ''}\n`;
                                  clientMsgAcc += `💰 Total Original: ${totalOriginal.toFixed(2)}h\n`;
                                  clientMsgAcc += `✅ Total Corrigido: ${totalCorrigido.toFixed(2)}h (${diffSignTotalAcc}${diffTotalAcc}h)\n\n`;
                                  (displayWorkers || []).forEach(w => {
                                    const orig = parseFloat(w.totalHours) || 0;
                                    const edit = parseFloat(w.editedTotalHours) || orig;
                                    const diff = (edit - orig).toFixed(2);
                                    const dS = diff >= 0 ? '+' : '';
                                    clientMsgAcc += `👤 ${w.name}: ${orig.toFixed(2)}h ➔ ${edit.toFixed(2)}h (${dS}${diff}h)\n`;
                                  });
                                  await sendNotificationEmail(targetClient2.email, targetClient2.name, fbNotif.title, clientMsgAcc, notif.target_client_id, rawTargetMonth || currentData.monthLabel || details.monthLabel);
                                }

                                await handleDelete('app_notifications', notif.id);
                                alert("Correções aplicadas e cliente notificado!");
                              }}
                              className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-black text-xs uppercase hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                            >
                              <CheckCircle size={16} /> Aceitar e Aplicar
                            </button>
                          ) : (
                            <button onClick={async () => {
                              if (!window.confirm("Marcar este reporte como resolvido e notificar o cliente?")) return;
                              const feedbackNotifId = "fb_" + Date.now();
                              const fbNotifData = {
                                id: feedbackNotifId,
                                title: `Reporte de Divergência Resolvido: ${details.monthLabel || notif.payload?.month || ''}`,
                                message: `O seu reporte de divergência referente ao período de ${details.monthLabel || notif.payload?.month || ''} foi analisado e resolvido pelo administrador. Por favor, aceda ao portal para realizar a validação final das horas.`,
                                type: 'success',
                                target_type: 'client',
                                target_client_id: String(notif.target_client_id),
                                created_at: new Date().toISOString(),
                                is_active: true,
                                payload: { type: 'correcoes_aplicadas' }
                              };
                              await saveToDb('app_notifications', feedbackNotifId, fbNotifData);
                              const targetClient3 = clients.find(c => String(c.id) === String(notif.target_client_id));
                              if (targetClient3?.email) {
                                const rawTargetMonth3 = (notif.payload?.month || details.monthLabel || '').match(/\d{4}-\d{2}/)?.[0] || '';
                                const clientMsgRes = details.workers
                                  ? (() => {
                                    const tOrig = (details.workers || []).reduce((acc, w) => acc + (parseFloat(w.totalHours) || 0), 0);
                                    const tCorr = (details.workers || []).reduce((acc, w) => acc + (parseFloat(w.editedTotalHours) || parseFloat(w.totalHours) || 0), 0);
                                    const dT = (tCorr - tOrig).toFixed(2);
                                    const dTS = dT >= 0 ? '+' : '';
                                    let m = `Olá ${targetClient3.name},\nRecebeu uma nova atualização no seu portal de cliente.\nNotificação\nCorreção: ${details.monthLabel || notif.payload?.month || ''}\n\n`;
                                    m += `⚠️ CORREÇÃO DO ADMINISTRADOR\n`;
                                    m += `👤 Cliente: ${targetClient3.name}\n📅 Período: ${details.monthLabel || notif.payload?.month || ''}\n`;
                                    m += `💰 Total Original: ${tOrig.toFixed(2)}h\n`;
                                    m += `✅ Total Corrigido: ${tCorr.toFixed(2)}h (${dTS}${dT}h)\n\n`;
                                    (details.workers || []).forEach(w => {
                                      const orig = parseFloat(w.totalHours) || 0;
                                      const edit = parseFloat(w.editedTotalHours) || orig;
                                      const diff = (edit - orig).toFixed(2);
                                      const dS = diff >= 0 ? '+' : '';
                                      m += `👤 ${w.name}: ${orig.toFixed(2)}h ➔ ${edit.toFixed(2)}h (${dS}${diff}h)\n`;
                                    });
                                    return m;
                                  })()
                                  : `Olá ${targetClient3.name},\nRecebeu uma nova atualização no seu portal de cliente.\nNotificação\nCorreção: ${details.monthLabel || notif.payload?.month || ''}\n\n`;
                                await sendNotificationEmail(targetClient3.email, targetClient3.name, fbNotifData.title, clientMsgRes, notif.target_client_id, rawTargetMonth3 || notif.payload?.month || details.monthLabel);
                              }
                              await handleDelete('app_notifications', notif.id);
                              if (notif.payload?.correcao_id) {
                                await saveToDb('correcoes', notif.payload.correcao_id, { status: 'resolved' });
                              }
                              alert("Reporte marcado como resolvido.");
                            }} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-black text-xs uppercase hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                              <CheckCircle size={16} /> Marcar como Resolvido
                            </button>
                          )}
                          <button onClick={() => { setRejeitarNotif(notif); setRejeitarMotivo(''); setModalRejeitarAberto(true); }} className="px-6 py-3 bg-rose-100 text-rose-600 rounded-xl font-black text-xs uppercase hover:bg-rose-200 transition-all"><X size={16} /> Rejeitar</button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
  const { onLogout, onLogin, currentUser, adminStats, currentMonth, setCurrentMonth, activeTab, setActiveTab, clients, setClients, clientForm, setClientForm, workers, setWorkers, workerForm, setWorkerForm, schedules, setSchedules, scheduleForm, setScheduleForm, expenses, setExpenses, expenseForm, setExpenseForm, auditWorkerId, setAuditWorkerId, setShowFinReport, logs, handleSaveWorker, handleSaveClient, handleSaveSchedule, handleSaveExpense, handleSaveEntry, printingReport, setPrintingReport, handleDelete, approvals, clientApprovals, systemSettings, setSystemSettings, documents, setDocuments, saveToDb, appNotifications, correctionNotifications, correcoesCorrections, setClienteSelecionado, setModalEmailAberto, setToastMessage, portalSubTab, setPortalSubTab, portalMonth, setPortalMonth, setModalRejeitarAberto, setRejeitarMotivo, setRejeitarNotif } = props;

  const notificacoesDeCorrecao = correctionNotifications;


  const [isAddingInTab, setIsAddingInTab] = useState(false);
  const [workerAISummary, setWorkerAISummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [clientPortalLinkFilter, setClientPortalLinkFilter] = useState({ clientId: '', month: toISODateLocal(new Date()).substring(0, 7) });
  const [reportFilter, setReportFilter] = useState({ clientId: '', workerId: '', month: toISODateLocal(new Date()).substring(0, 7) });
  const [workersSort, setWorkersSort] = useState({ key: 'name', direction: 'asc' });
  const [workersView, setWorkersView] = useState('list'); // 'grid' | 'list'
  const [clientsSort, setClientsSort] = useState({ key: 'name', direction: 'asc' });
  const [clientsView, setClientsView] = useState('list'); // 'grid' | 'list'
  const [schedulesSort, setSchedulesSort] = useState({ key: 'name', direction: 'asc' });
  const [schedulesView, setSchedulesView] = useState('list'); // 'grid' | 'list'
  const [portalWorkersSort, setPortalWorkersSort] = useState({ key: 'name', direction: 'asc' });
  const [valSortConfig, setValSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [expensesSort, setExpensesSort] = useState({ key: 'date', direction: 'desc' });
  const [portalHistoryClient, setPortalHistoryClient] = useState('');
  const [portalHistoryStatus, setPortalHistoryStatus] = useState('');
  const [portalHistoryMonth, setPortalHistoryMonth] = useState('');
  const [portalSearchText, setPortalSearchText] = useState('');

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
    const s = schedules.find(s => s.id === auditedWorker?.defaultScheduleId);
    if (!auditedWorker?.defaultClientId || !s) { handleOpenInlineForm(ds); return; }
    const dsConfig = getScheduleForDay(s, ds);
    if (!dsConfig) { handleOpenInlineForm(ds); return; }
    handleSaveEntry({ clientId: auditedWorker.defaultClientId, startTime: dsConfig.startTime, breakStart: dsConfig.breakStart, breakEnd: dsConfig.breakEnd, endTime: dsConfig.endTime, description: 'Registo Rápido (Auditoria)' }, false, ds);
  };

  const openInMaps = (morada) => {
    if (!morada) return;
    window.open('https://maps.google.com/?q=' + encodeURIComponent(morada), '_blank');
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
                <button key={t} onClick={() => { setActiveTab(t); setIsAddingInTab(false); setAuditWorkerId(null); }} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === t ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'} ${t === 'portal_validacao' && unviewedCorrectionsCount > 0 ? 'animate-pulse' : ''}`}>
                  {t === 'overview' ? 'Geral' : t === 'team' ? 'Equipa' : t === 'clients' ? 'Clientes' : t === 'portal_validacao' ? (
                    <span className="flex items-center gap-1">Portal Validação {unviewedCorrectionsCount > 0 && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{unviewedCorrectionsCount}</span>}</span>
                  ) : t === 'schedules' ? 'Horários' : t === 'expenses' ? 'Despesas' : t === 'reports' ? 'Relatórios' : t === 'documentos' ? 'Documentos' : t === 'notificacoes' ? (
                    <span className="flex items-center gap-1">Notificações {(appNotifications?.filter(n => n.is_active && n.target_type === 'admin')?.length || 0) > 0 && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{appNotifications?.filter(n => n.is_active && n.target_type === 'admin')?.length || 0}</span>}</span>
                  ) : <Settings size={14} />}
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
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black flex items-center gap-3"><Users size={32} className="text-indigo-600" /> Gestão de Colaboradores</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
                    <button onClick={() => setWorkersView('grid')} className={`p-2 rounded-lg transition-all ${workersView === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Grade"><LayoutGrid size={18} /></button>
                    <button onClick={() => setWorkersView('list')} className={`p-2 rounded-lg transition-all ${workersView === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Lista"><List size={18} /></button>
                  </div>
                  <button onClick={() => { setWorkerForm({ id: null, name: '', assignedClients: [], assignedSchedules: [], defaultClientId: '', defaultScheduleId: '', tel: '', valorHora: '', profissao: '', nis: '', nif: '', iban: '' }); setIsAddingInTab(!isAddingInTab); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-lg transition-all ${isAddingInTab ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}>{isAddingInTab ? 'Fechar Form' : 'Novo Trabalhador'}</button>
                </div>
              </div>

              {isAddingInTab && (
                <div className="mb-10 bg-white p-10 rounded-[3rem] shadow-xl border-2 border-indigo-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome Completo</label><input type="text" value={workerForm.name} onChange={e => setWorkerForm({ ...workerForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" placeholder="Nome" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Profissão</label><input type="text" value={workerForm.profissao || ''} onChange={e => setWorkerForm({ ...workerForm, profissao: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" placeholder="Cargo" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Telemóvel (Senha)</label><input type="text" value={workerForm.tel} onChange={e => setWorkerForm({ ...workerForm, tel: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" placeholder="9xxxxxxxx" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">NIS</label><input type="text" value={workerForm.nis || ''} onChange={e => setWorkerForm({ ...workerForm, nis: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" placeholder="Segurança Social" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">NIF</label><input type="text" value={workerForm.nif || ''} onChange={e => setWorkerForm({ ...workerForm, nif: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" placeholder="Número de Identificação Fiscal" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor Hora (€)</label><input type="number" value={workerForm.valorHora} onChange={e => setWorkerForm({ ...workerForm, valorHora: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">IBAN</label><input type="text" value={workerForm.iban} onChange={e => setWorkerForm({ ...workerForm, iban: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-mono uppercase shadow-sm" placeholder="PT50..." /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Estado da Conta</label><select value={workerForm.status || 'ativo'} onChange={e => setWorkerForm({ ...workerForm, status: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm font-bold"><option value="ativo">Ativo (Acesso Permitido)</option><option value="inativo">Inativo (Acesso Bloqueado)</option></select></div>
                  </div>
                  <div className="mt-8 border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block">Acesso a Clientes</label>
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        {clients.map(c => (
                          <label key={c.id} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer hover:bg-indigo-50 transition-colors shadow-sm">
                            <input type="checkbox" checked={workerForm.assignedClients?.includes(c.id)} onChange={() => {
                              const current = workerForm.assignedClients || [];
                              const updated = current.includes(c.id) ? current.filter(id => id !== c.id) : [...current, c.id];
                              setWorkerForm({ ...workerForm, assignedClients: updated });
                            }} className="rounded text-indigo-600" />
                            <span className="text-xs font-bold text-slate-700 truncate">{c.name}</span>
                          </label>
                        ))}
                      </div>
                      <select value={workerForm.defaultClientId || ''} onChange={e => setWorkerForm({ ...workerForm, defaultClientId: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm">
                        <option value="">Definir Unidade Padrão...</option>
                        {clients.filter(c => workerForm.assignedClients?.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block">Horários Disponíveis</label>
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        {schedules.map(s => (
                          <label key={s.id} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer hover:bg-indigo-50 transition-colors shadow-sm">
                            <input type="checkbox" checked={workerForm.assignedSchedules?.includes(s.id)} onChange={() => {
                              const current = workerForm.assignedSchedules || [];
                              const updated = current.includes(s.id) ? current.filter(id => id !== s.id) : [...current, s.id];
                              setWorkerForm({ ...workerForm, assignedSchedules: updated });
                            }} className="rounded text-indigo-600" />
                            <span className="text-xs font-bold text-slate-700 truncate">{s.name}</span>
                          </label>
                        ))}
                      </div>
                      <select value={workerForm.defaultScheduleId || ''} onChange={e => setWorkerForm({ ...workerForm, defaultScheduleId: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm">
                        <option value="">Definir Horário Padrão...</option>
                        {schedules.filter(s => workerForm.assignedSchedules?.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end gap-3"><button onClick={() => setIsAddingInTab(false)} className="px-6 py-3 text-slate-400 font-bold uppercase text-xs">Cancelar</button><button onClick={() => { handleSaveWorker(); setIsAddingInTab(false); }} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase shadow-lg">Gravar</button></div>
                </div>
              )}

              {/* Vista de workers - Grid ou Lista */}
              {workersView === 'list' ? (
                <div className="overflow-x-auto">
                  <table className="admin-table">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th onClick={() => setWorkersSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Colaborador {workersSort.key === 'name' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                        <th onClick={() => setWorkersSort(prev => ({ key: 'schedule', direction: prev.key === 'schedule' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Horário {workersSort.key === 'schedule' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                        <th onClick={() => setWorkersSort(prev => ({ key: 'unit', direction: prev.key === 'unit' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Unidade {workersSort.key === 'unit' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                        <th onClick={() => setWorkersSort(prev => ({ key: 'status', direction: prev.key === 'status' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Acesso {workersSort.key === 'status' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                        <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([...workers].sort((a, b) => {
                        let res = 0;
                        if (workersSort.key === 'name') res = a.name.localeCompare(b.name);
                        if (workersSort.key === 'profissao') res = (a.profissao || '').localeCompare(b.profissao || '');
                        if (workersSort.key === 'schedule') {
                          const nameA = schedules.find(s => s.id === a.defaultScheduleId)?.name || '';
                          const nameB = schedules.find(s => s.id === b.defaultScheduleId)?.name || '';
                          res = nameA.localeCompare(nameB);
                        }
                        if (workersSort.key === 'unit') {
                          const nameA = clients.find(c => c.id === a.defaultClientId)?.name || '';
                          const nameB = clients.find(c => c.id === b.defaultClientId)?.name || '';
                          res = nameA.localeCompare(nameB);
                        }
                        if (workersSort.key === 'status') res = (a.status || 'ativo').localeCompare(b.status || 'ativo');
                        return workersSort.direction === 'asc' ? res : -res;
                      })).map(w => (
                        <tr key={w.id} className="border-b border-slate-100 hover:bg-indigo-50/40 transition-all even:bg-slate-50/50 last:border-b-0 group">
                          <td className="relative">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <p className="font-black text-slate-900 text-sm uppercase truncate">{w.name}</p>
                            <p className="text-xs text-slate-400 truncate">{w.profissao || 'Staff'}</p>
                          </td>
                          <td className="text-sm font-bold text-indigo-600 truncate">{schedules.find(s => s.id === w.defaultScheduleId)?.name || 'N/A'}</td>
                          <td className="text-sm font-bold text-indigo-600 truncate">{clients.find(c => c.id === w.defaultClientId)?.name || 'N/A'}</td>
                          <td className="">
                            <div className="flex items-center">
                              <select
                                value={w.status || 'ativo'}
                                onChange={e => {
                                  const updated = { ...w, status: e.target.value };
                                  saveToDb('workers', w.id, updated);
                                }}
                                className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full border outline-none transition-all cursor-pointer ${w.status === 'inativo' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}
                              >
                                <option value="ativo">Ativo</option>
                                <option value="inativo">Inativo</option>
                              </select>
                            </div>
                          </td>
                          <td className="text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => onLogin('worker', { ...w, isAdminImpersonating: true })} className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Ver Portal do Trabalhador"><Search size={16} /></button>
                              <button onClick={() => { setWorkerForm(w); setIsAddingInTab(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Editar"><Edit2 size={16} /></button>
                              <button onClick={() => handleDelete('workers', w.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Apagar"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {([...workers].sort((a, b) => workersSort === 'alphabetical' ? a.name.localeCompare(b.name) : 0)).map(w => (
                    <div key={w.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-indigo-200 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><UserCircle size={24} /></div>
                        <div className="flex gap-2">
                          <button onClick={() => onLogin('worker', { ...w, isAdminImpersonating: true })} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Ver Portal do Trabalhador"><Search size={14} /></button>
                          <button onClick={() => { setWorkerForm(w); setIsAddingInTab(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 text-slate-400 hover:text-amber-500 transition-all" title="Editar"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete('workers', w.id)} className="p-2 text-slate-400 hover:text-red-500 transition-all" title="Apagar"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <h4 className="text-xl font-black text-indigo-700 mb-1">{w.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b pb-4 mb-4">{w.profissao || 'Staff'}</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Timer size={12} /> Horário: <span className="text-indigo-600">{schedules.find(s => s.id === w.defaultScheduleId)?.name || 'N/A'}</span></div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Briefcase size={12} /> Unidade: <span className="text-indigo-600">{clients.find(c => c.id === w.defaultClientId)?.name || 'N/A'}</span></div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mt-2 border-t border-slate-100 pt-2">
                          <CheckCircle size={12} /> Mês ({currentMonthStr}):
                          {(() => {
                            const workerApproval = approvals.find(a => a.workerId === w.id && a.month === currentMonthStr);
                            return workerApproval ? (
                              <span className="flex items-center gap-2 text-emerald-500 font-black bg-emerald-50 px-2 py-0.5 rounded">
                                Aprovado ({new Date(workerApproval.timestamp).toLocaleDateString('pt-PT')})
                                <button onClick={() => handleDelete('approvals', workerApproval.id)} className="text-rose-400 hover:text-rose-600 bg-white rounded-full p-1 shadow-sm ml-1" title="Desbloquear Mês"><Unlock size={10} /></button>
                              </span>
                            ) : (
                              <span className="text-amber-500 font-black bg-amber-50 px-2 py-0.5 rounded">Pendente</span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Módulos Clientes */}
          {!auditWorkerId && activeTab === 'clients' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black flex items-center gap-3"><Briefcase size={32} className="text-indigo-600" /> Gestão Comercial</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
                    <button onClick={() => setClientsView('grid')} className={`p-2 rounded-lg transition-all ${clientsView === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Grade"><LayoutGrid size={18} /></button>
                    <button onClick={() => setClientsView('list')} className={`p-2 rounded-lg transition-all ${clientsView === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Lista"><List size={18} /></button>
                  </div>
                  <button onClick={() => { setClientForm({ id: null, name: '', morada: '', nif: '', valorHora: '', email: '' }); setIsAddingInTab(!isAddingInTab); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-lg transition-all ${isAddingInTab ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}>{isAddingInTab ? 'Voltar' : 'Registar Cliente'}</button>
                </div>
              </div>
              {isAddingInTab && (
                <div className="mb-10 bg-white p-10 rounded-[3rem] shadow-xl border-2 border-indigo-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Empresa</label><input type="text" value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">NIF</label><input type="text" value={clientForm.nif} onChange={e => setClientForm({ ...clientForm, nif: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor/h (€)</label><input type="number" value={clientForm.valorHora} onChange={e => setClientForm({ ...clientForm, valorHora: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none shadow-sm" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">E-mail de Contato</label><input type="email" value={clientForm.email || ''} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" placeholder="email@exemplo.pt" /></div>
                    <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Morada</label><input type="text" value={clientForm.morada} onChange={e => setClientForm({ ...clientForm, morada: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" /></div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3"><button onClick={() => setIsAddingInTab(false)} className="px-6 py-3 text-slate-400 font-bold uppercase text-xs">Cancelar</button><button onClick={() => { handleSaveClient(); setIsAddingInTab(false); }} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase shadow-lg">Salvar</button></div>
                </div>
              )}

              {clientsView === 'list' ? (
                <div className="overflow-x-auto">
                  <table className="admin-table">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th onClick={() => setClientsSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Cliente {clientsSort.key === 'name' ? (clientsSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                        <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Morada</th>
                        <th onClick={() => setClientsSort(prev => ({ key: 'value', direction: prev.key === 'value' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Valor Hora {clientsSort.key === 'value' ? (clientsSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                        <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([...clients].sort((a, b) => {
                        let res = 0;
                        if (clientsSort.key === 'name') res = a.name.localeCompare(b.name);
                        if (clientsSort.key === 'nif') res = (a.nif || '').localeCompare(b.nif || '');
                        if (clientsSort.key === 'morada') res = (a.morada || '').localeCompare(b.morada || '');
                        if (clientsSort.key === 'value') res = (Number(a.valorHora) || 0) - (Number(b.valorHora) || 0);
                        return clientsSort.direction === 'asc' ? res : -res;
                      })).map(c => (
                        <tr key={c.id} className="border-b border-slate-100 hover:bg-indigo-50/40 transition-all even:bg-slate-50/50 last:border-b-0 group">
                          <td className="relative">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <p className="font-black text-slate-900 text-sm uppercase truncate">{c.name}</p>
                            <p className="text-xs text-slate-400 truncate">NIF: {c.nif || 'N/A'}</p>
                          </td>
                          <td className="text-sm font-bold text-slate-500 truncate">{c.morada || 'N/A'}</td>
                          <td className="text-sm text-indigo-600 font-black truncate">{c.valorHora ? `${c.valorHora}€` : 'N/A'}</td>
                          <td className="text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setClientForm(c); setIsAddingInTab(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="Editar"><Edit2 size={16} /></button>
                              <button onClick={() => handleDelete('clients', c.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Apagar"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {([...clients].sort((a, b) => clientsSort === 'alphabetical' ? a.name.localeCompare(b.name) : 0)).map(c => (
                    <div key={c.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-indigo-200 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><Briefcase size={24} /></div>
                        <div className="flex gap-2">
                          <button onClick={() => { setClientForm(c); setIsAddingInTab(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 bg-slate-50 rounded-lg text-amber-500 hover:bg-amber-500 hover:text-white transition-all"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete('clients', c.id)} className="p-2 bg-slate-50 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <h4 className="text-xl font-black text-indigo-700 mb-1">{c.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b pb-4 mb-4">{c.nif || 'Sem NIF'}</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><MapPin size={12} /> {c.morada || 'Sem morada'}</div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Euro size={12} /> Valor/h: <span className="text-indigo-600">{c.valorHora ? `${c.valorHora}€` : 'N/A'}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Módulo Portal de Validação */}
          {!auditWorkerId && activeTab === 'portal_validacao' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex flex-col">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Portal de Validação</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-slate-500 text-sm font-medium">Controle de envios e gestão de pedidos de correção.</p>
                    <div className="h-1 w-1 bg-slate-300 rounded-full"></div>
                    <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                      <button onClick={() => setPortalMonth(new Date(portalMonth.setMonth(portalMonth.getMonth() - 1)))} className="p-1 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"><ChevronLeft size={14} /></button>
                      <span className={`text-[10px] font-black uppercase tracking-widest min-w-[100px] text-center ${allClientsValidated ? 'text-emerald-700' : 'text-indigo-700'}`}>
                        {portalMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                      </span>
                      <button onClick={() => setPortalMonth(new Date(portalMonth.setMonth(portalMonth.getMonth() + 1)))} className="p-1 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"><ChevronRight size={14} /></button>
                    </div>
                    {allClientsValidated && (
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">✓ Validado</span>
                    )}
                  </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                  <button
                    onClick={() => setPortalSubTab('envios')}
                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${portalSubTab === 'envios' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Envios Clientes
                  </button>
                  <button
                    onClick={() => setPortalSubTab('colaboradores')}
                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${portalSubTab === 'colaboradores' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Validação Equipa
                  </button>
                  <button
                    onClick={() => setPortalSubTab('correcoes')}
                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${portalSubTab === 'correcoes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Correções {unviewedCorrectionsCount > 0 && <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unviewedCorrectionsCount}</span>}
                  </button>
                  <button
                    onClick={() => setPortalSubTab('links')}
                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${portalSubTab === 'links' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Links
                  </button>
                  <button
                    onClick={() => setPortalSubTab('historico')}
                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${portalSubTab === 'historico' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Histórico
                  </button>
                </div>
              </div>

              {/* Filtros de Histórico */}
              {portalSubTab === 'historico' && (
                <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Pesquisar</label>
                      <input
                        type="text"
                        placeholder="Pesquisar por cliente..."
                        value={portalSearchText}
                        onChange={(e) => setPortalSearchText(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                      />
                    </div>
                    <div className="min-w-[150px]">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Cliente</label>
                      <select
                        value={portalHistoryClient}
                        onChange={(e) => setPortalHistoryClient(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                      >
                        <option value="">Todos os clientes</option>
                        {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="min-w-[150px]">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Estado</label>
                      <select
                        value={portalHistoryStatus}
                        onChange={(e) => setPortalHistoryStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                      >
                        <option value="">Todos</option>
                        <option value="pending">Pendente</option>
                        <option value="enviado">Enviado</option>
                        <option value="validado">Validado</option>
                      </select>
                    </div>
                    <div className="min-w-[150px]">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Mês</label>
                      <input
                        type="month"
                        value={portalHistoryMonth}
                        onChange={(e) => setPortalHistoryMonth(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                      />
                    </div>
                    {(portalSearchText || portalHistoryClient || portalHistoryStatus || portalHistoryMonth) && (
                      <button
                        onClick={() => { setPortalSearchText(''); setPortalHistoryClient(''); setPortalHistoryStatus(''); setPortalHistoryMonth(''); }}
                        className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-100"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
              )}

              {portalSubTab === 'envios' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="overflow-x-auto">
                    <table className="admin-table">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th onClick={() => setValSortConfig(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">CLIENTE {valSortConfig.key === 'name' ? (valSortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                          <th onClick={() => setValSortConfig(prev => ({ key: 'hours', direction: prev.key === 'hours' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">HORAS {valSortConfig.key === 'hours' ? (valSortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                          <th onClick={() => setValSortConfig(prev => ({ key: 'status', direction: prev.key === 'status' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">ESTADO {valSortConfig.key === 'status' ? (valSortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                          <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">LIGAÇÃO</th>
                          <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider">AÇÃO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {([...clients].map(c => {
                          const totalHoras = logs.filter(l => l.clientId === c.id && l.date?.substring(0, 7) === portalMonthStr).reduce((acc, l) => acc + l.hours, 0);
                          const approval = clientApprovals?.find(a => (String(a.client_id || a.clientId || '') === String(c.id)) && a.month === portalMonthStr);
                          const sentEmails = c.sent_emails || {};
                          const status = approval ? 'validado' : (c.status_email === `enviado_${portalMonthStr}` ? 'enviado' : 'pendente');
                          return { ...c, totalHoras, status };
                        }).sort((a, b) => {
                          let res = 0;
                          if (valSortConfig.key === 'name') res = a.name.localeCompare(b.name);
                          if (valSortConfig.key === 'hours') res = a.totalHoras - b.totalHoras;
                          if (valSortConfig.key === 'status') {
                            const statusOrder = { 'pendente': 1, 'enviado': 2, 'validado': 3 };
                            res = statusOrder[a.status] - statusOrder[b.status];
                          }
                          return valSortConfig.direction === 'asc' ? res : -res;
                        })).map(c => {
                          const status = c.status;
                          const monthStr = portalMonthStr;
                          const linkUnico = c.link_gerado || `${window.location.origin}${window.location.pathname}?view=client_portal&client=${String(c.id)}&month=${monthStr}`;

                          return (
                            <tr key={c.id} className="border-b border-slate-100 hover:bg-indigo-50/40 transition-all even:bg-slate-50/50 last:border-b-0 group">
                              <td className="relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <p className="font-black text-slate-800 text-sm truncate">{c.name}</p>
                                <p className="text-xs text-slate-400 truncate">{c.email || 'Não definido'}</p>
                              </td>
                              <td><span className="font-bold text-slate-600 text-[14px]">{formatHours(c.totalHoras)}h</span></td>
                              <td className="text-center">
                                {status === 'validado' ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 border border-emerald-200 bg-white px-3 py-1.5 rounded-full whitespace-nowrap">
                                    <CheckCircle size={14} /> Validado
                                  </span>
                                ) : status === 'enviado' ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 border border-blue-200 bg-white px-3 py-1.5 rounded-full whitespace-nowrap">
                                    <Mail size={14} /> Enviado
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 border border-slate-200 bg-white px-3 py-1.5 rounded-full whitespace-nowrap">
                                    Pendente
                                  </span>
                                )}
                              </td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <input type="text" readOnly value={linkUnico} className="bg-slate-50 border border-slate-100 text-slate-500 text-xs font-medium rounded-lg p-1.5 w-32 truncate" />
                                  <button onClick={() => { navigator.clipboard.writeText(linkUnico); }} className="text-slate-400 hover:text-indigo-600 p-1"><Copy size={14} /></button>
                                </div>
                              </td>
                              <td className="text-right">
                                {status === 'validado' ? (
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => { if (window.confirm('Anular validação?')) { const approval = clientApprovals?.find(a => a.client_id === c.id && a.month === monthStr); if (approval) handleDelete('client_approvals', approval.id); } }}
                                      className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                      title="Anular Validação"
                                    >
                                      <RotateCcw size={16} />
                                    </button>
                                    <button
                                      onClick={() => setPrintingReport({ client: c, logs, workers, clients, month: monthStr, clientApprovals })}
                                      className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                      title="Baixar Relatório Assinado"
                                    >
                                      <Download size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setClienteSelecionado(c); setModalEmailAberto(true); }}
                                    className={`p-2.5 rounded-lg transition-all ${status === 'enviado' ? 'text-amber-500 hover:bg-amber-50' : 'text-blue-600 hover:bg-blue-50'}`}
                                    title={status === 'enviado' ? 'Reenviar E-mail' : 'Enviar E-mail'}
                                  >
                                    <Mail size={16} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {portalSubTab === 'colaboradores' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="overflow-x-auto">
                    <table className="admin-table">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th onClick={() => setPortalWorkersSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Colaborador {portalWorkersSort.key === 'name' ? (portalWorkersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                          <th onClick={() => setPortalWorkersSort(prev => ({ key: 'hours', direction: prev.key === 'hours' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Total Horas {portalWorkersSort.key === 'hours' ? (portalWorkersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                          <th onClick={() => setPortalWorkersSort(prev => ({ key: 'status', direction: prev.key === 'status' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors">Estado {portalWorkersSort.key === 'status' ? (portalWorkersSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                          <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {([...workers].map(w => {
                          const totalHours = logs.filter(l => l.workerId === w.id && l.date?.substring(0, 7) === portalMonthStr).reduce((acc, l) => acc + calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd), 0);
                          const approval = approvals.find(a => a.workerId === w.id && a.month === portalMonthStr);
                          return { ...w, totalHours, isApproved: !!approval, approval };
                        }).sort((a, b) => {
                          let res = 0;
                          if (portalWorkersSort.key === 'name') res = a.name.localeCompare(b.name);
                          if (portalWorkersSort.key === 'hours') res = a.totalHours - b.totalHours;
                          if (portalWorkersSort.key === 'status') res = (a.isApproved ? 1 : 0) - (b.isApproved ? 1 : 0);
                          return portalWorkersSort.direction === 'asc' ? res : -res;
                        })).map(w => (
                          <tr key={w.id} className="border-b border-slate-100 hover:bg-indigo-50/40 transition-all even:bg-slate-50/50 last:border-b-0 group">
                            <td className="relative">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              <p className="font-black text-slate-900 text-[14px] uppercase truncate">{w.name}</p>
                            </td>
                            <td><span className="font-bold text-slate-600">{formatHours(w.totalHours)}h</span></td>
                            <td className="text-center">
                              {w.isApproved ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 border border-emerald-200 bg-white px-3 py-1.5 rounded-full whitespace-nowrap">
                                  <CheckCircle size={14} /> Aprovado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500 border border-amber-200 bg-white px-3 py-1.5 rounded-full whitespace-nowrap">
                                  Pendente
                                </span>
                              )}
                            </td>
                            <td className="text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => onLogin('worker', { ...w, isAdminImpersonating: true })}
                                  className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="Ver Portal do Trabalhador"
                                >
                                  <Search size={16} />
                                </button>
                                {!w.isApproved ? (
                                  <button
                                    onClick={() => { const id = "appr_" + w.id + "_" + portalMonthStr; saveToDb('approvals', id, { id, workerId: w.id, month: portalMonthStr, timestamp: new Date().toISOString() }); }}
                                    className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Aprovar Horas"
                                  >
                                    <UserCheck size={16} />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleDelete('approvals', w.approval.id)}
                                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                    title="Anular Aprovação"
                                  >
                                    <RotateCcw size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {portalSubTab === 'correcoes' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <CorrecoesAdmin workers={workers} appNotifications={appNotifications} saveToDb={saveToDb} handleDelete={handleDelete} clients={clients} logs={logs} setSchedules={setSchedules} correcoesCorrections={correcoesCorrections} setModalRejeitarAberto={setModalRejeitarAberto} setRejeitarMotivo={setRejeitarMotivo} setRejeitarNotif={setRejeitarNotif} />
                </div>
              )}

              {portalSubTab === 'links' && (
                <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {clientPortalLinkFilter ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecione o Cliente</label>
                          <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={clientPortalLinkFilter.clientId} onChange={e => setClientPortalLinkFilter({ ...clientPortalLinkFilter, clientId: e.target.value })}>
                            <option value="">-- Escolher Cliente --</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mês (Ano-Mês)</label>
                          <input type="month" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" value={clientPortalLinkFilter.month} onChange={e => setClientPortalLinkFilter({ ...clientPortalLinkFilter, month: e.target.value })} />
                        </div>
                      </div>
                      {clientPortalLinkFilter.clientId && clientPortalLinkFilter.month && (
                        <div className="p-6 bg-indigo-50 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Link para o Cliente:</p>
                          <div className="flex gap-3">
                            <input readOnly className="flex-1 bg-white border border-slate-200 rounded-xl p-4 text-sm font-mono" value={`${window.location.origin}${window.location.pathname}?view=client_portal&client=${clientPortalLinkFilter.clientId}&month=${clientPortalLinkFilter.month}`} />
                            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?view=client_portal&client=${clientPortalLinkFilter.clientId}&month=${clientPortalLinkFilter.month}`); setToastMessage('Link copiado com sucesso!'); setTimeout(() => setToastMessage(null), 3000); }} className="px-6 py-4 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700">Copiar</button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-400">A carregar...</p>
                  )}
                </div>
              )}

              {portalSubTab === 'historico' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="admin-table">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">CLIENTE</th>
                            <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">MÊS</th>
                            <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider">HORAS</th>
                            <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider">ESTADO</th>
                            <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider">AÇÃO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const allMonths = [];
                            const now = new Date();
                            for (let i = 0; i < 12; i++) {
                              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                              const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                              allMonths.push(monthStr);
                            }

                            const historyRows = [];
                            clients.forEach(c => {
                              allMonths.forEach(monthStr => {
                                const totalHoras = logs.filter(l => l.clientId === c.id && l.date?.substring(0, 7) === monthStr).reduce((acc, l) => acc + l.hours, 0);
                                if (totalHoras === 0) return;
                                const approval = clientApprovals?.find(a => (String(a.client_id || a.clientId || '') === String(c.id)) && a.month === monthStr);
                                const emailSent = c.status_email === `enviado_${monthStr}`;
                                const status = approval ? 'validado' : (emailSent ? 'enviado' : 'pendente');
                                historyRows.push({ client: c, monthStr, totalHoras, status, approval, emailSent });
                              });
                            });

                            let filtered = historyRows;

                            if (portalSearchText) {
                              const search = portalSearchText.toLowerCase();
                              filtered = filtered.filter(r => r.client.name.toLowerCase().includes(search));
                            }
                            if (portalHistoryClient) {
                              filtered = filtered.filter(r => r.client.id === portalHistoryClient);
                            }
                            if (portalHistoryStatus) {
                              filtered = filtered.filter(r => r.status === portalHistoryStatus);
                            }
                            if (portalHistoryMonth) {
                              filtered = filtered.filter(r => r.monthStr === portalHistoryMonth);
                            }

                            filtered.sort((a, b) => b.monthStr.localeCompare(a.monthStr) || a.client.name.localeCompare(b.client.name));

                            if (filtered.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={5} className="text-center py-12 text-slate-400">
                                    Nenhum registo encontrado
                                  </td>
                                </tr>
                              );
                            }

                            return filtered.map((row, idx) => {
                              const monthDate = new Date(row.monthStr + '-01');
                              const monthLabel = monthDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
                              return (
                                <tr key={`${row.client.id}-${row.monthStr}`} className="border-b border-slate-100 hover:bg-indigo-50/40 transition-all">
                                  <td className="relative">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <p className="font-black text-slate-800 text-sm">{row.client.name}</p>
                                    <p className="text-xs text-slate-400">{row.client.email || 'Não definido'}</p>
                                  </td>
                                  <td><span className="font-medium text-slate-600 text-sm capitalize">{monthLabel}</span></td>
                                  <td className="text-center"><span className="font-bold text-slate-600">{formatHours(row.totalHoras)}h</span></td>
                                  <td className="text-center">
                                    {row.status === 'validado' ? (
                                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 border border-emerald-200 bg-white px-3 py-1.5 rounded-full">
                                        <CheckCircle size={14} /> Validado
                                      </span>
                                    ) : row.status === 'enviado' ? (
                                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 border border-blue-200 bg-white px-3 py-1.5 rounded-full">
                                        <Mail size={14} /> Enviado
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 border border-slate-200 bg-white px-3 py-1.5 rounded-full">
                                        Pendente
                                      </span>
                                    )}
                                  </td>
                                  <td className="text-right">
                                    <div className="flex justify-end gap-2">
                                      {row.status === 'validado' && (
                                        <button
                                          onClick={() => setPrintingReport({ client: row.client, logs, workers, clients, month: row.monthStr, clientApprovals })}
                                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                          title="Baixar Relatório"
                                        >
                                          <Download size={16} />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => { setClienteSelecionado(row.client); setPortalMonth(new Date(row.monthStr + '-01')); setPortalSubTab('envios'); }}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                        title="Ver detalhes"
                                      >
                                        <Eye size={16} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {!auditWorkerId && activeTab === 'schedules' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black flex items-center gap-3"><Timer size={32} className="text-indigo-600" /> Turnos Magnetic</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
                    <button onClick={() => setSchedulesView('grid')} className={`p-2 rounded-lg transition-all ${schedulesView === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Grade"><LayoutGrid size={18} /></button>
                    <button onClick={() => setSchedulesView('list')} className={`p-2 rounded-lg transition-all ${schedulesView === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600'}`} title="Vista em Lista"><List size={18} /></button>
                  </div>
                  <button onClick={() => { setScheduleForm({ id: null, name: '', startTime: '', endTime: '', breakStart: '', breakEnd: '', hasBreak: false, assignedWorkers: [], weekdays: [1, 2, 3, 4, 5] }); setIsAddingInTab(!isAddingInTab); }} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-lg transition-all ${isAddingInTab ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}>{isAddingInTab ? 'Voltar' : 'Novo Horário'}</button>
                </div>
              </div>
              {isAddingInTab && (
                <div className="mb-10 bg-white p-10 rounded-[3rem] shadow-xl border-2 border-indigo-100">
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-6">
                      <input type="checkbox" id="advSch" checked={scheduleForm.isAdvanced || false} onChange={e => {
                        const baseHasBreak = scheduleForm.hasBreak || !!scheduleForm.breakStart;
                        const dailyConfigs = scheduleForm.dailyConfigs || {
                          1: { isActive: true, hasBreak: baseHasBreak, startTime: scheduleForm.startTime || '', breakStart: scheduleForm.breakStart || '', breakEnd: scheduleForm.breakEnd || '', endTime: scheduleForm.endTime || '' },
                          2: { isActive: true, hasBreak: baseHasBreak, startTime: scheduleForm.startTime || '', breakStart: scheduleForm.breakStart || '', breakEnd: scheduleForm.breakEnd || '', endTime: scheduleForm.endTime || '' },
                          3: { isActive: true, hasBreak: baseHasBreak, startTime: scheduleForm.startTime || '', breakStart: scheduleForm.breakStart || '', breakEnd: scheduleForm.breakEnd || '', endTime: scheduleForm.endTime || '' },
                          4: { isActive: true, hasBreak: baseHasBreak, startTime: scheduleForm.startTime || '', breakStart: scheduleForm.breakStart || '', breakEnd: scheduleForm.breakEnd || '', endTime: scheduleForm.endTime || '' },
                          5: { isActive: true, hasBreak: baseHasBreak, startTime: scheduleForm.startTime || '', breakStart: scheduleForm.breakStart || '', breakEnd: scheduleForm.breakEnd || '', endTime: scheduleForm.endTime || '' },
                          6: { isActive: false, hasBreak: baseHasBreak, startTime: scheduleForm.startTime || '', breakStart: scheduleForm.breakStart || '', breakEnd: scheduleForm.breakEnd || '', endTime: scheduleForm.endTime || '' },
                          0: { isActive: false, hasBreak: baseHasBreak, startTime: scheduleForm.startTime || '', breakStart: scheduleForm.breakStart || '', breakEnd: scheduleForm.breakEnd || '', endTime: scheduleForm.endTime || '' },
                        };
                        setScheduleForm({ ...scheduleForm, isAdvanced: e.target.checked, dailyConfigs });
                      }} className="rounded text-indigo-600 w-4 h-4" />
                      <label htmlFor="advSch" className="text-sm font-bold text-slate-700 cursor-pointer">Definir horários diferentes para cada dia da semana</label>
                    </div>
                  </div>

                  <div className={`grid grid-cols-1 ${!scheduleForm.isAdvanced ? ((scheduleForm.hasBreak || !!scheduleForm.breakStart) ? 'md:grid-cols-5' : 'md:grid-cols-3') : 'md:grid-cols-1'} gap-6 mb-4`}>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome</label><input type="text" value={scheduleForm.name} onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" /></div>
                    {!scheduleForm.isAdvanced && (
                      <>
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Entrada</label><input type="time" value={scheduleForm.startTime} onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm shadow-sm" /></div>
                        {(scheduleForm.hasBreak || !!scheduleForm.breakStart) && (
                          <>
                            <div className="space-y-1"><label className="text-[10px] font-black text-orange-500 uppercase ml-1">Pausa I.</label><input type="time" value={scheduleForm.breakStart} onChange={e => setScheduleForm({ ...scheduleForm, breakStart: e.target.value })} className="w-full bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm shadow-sm" /></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-orange-500 uppercase ml-1">Pausa F.</label><input type="time" value={scheduleForm.breakEnd} onChange={e => setScheduleForm({ ...scheduleForm, breakEnd: e.target.value })} className="w-full bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm shadow-sm" /></div>
                          </>
                        )}
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Saída</label><input type="time" value={scheduleForm.endTime} onChange={e => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm shadow-sm" /></div>
                      </>
                    )}
                  </div>
                  {!scheduleForm.isAdvanced && (
                    <div className="mb-8">
                      <button type="button" onClick={() => {
                        const nextHasBreak = !(scheduleForm.hasBreak || !!scheduleForm.breakStart);
                        setScheduleForm({ ...scheduleForm, hasBreak: nextHasBreak, breakStart: nextHasBreak ? scheduleForm.breakStart : '', breakEnd: nextHasBreak ? scheduleForm.breakEnd : '' });
                      }} className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors">
                        {(scheduleForm.hasBreak || !!scheduleForm.breakStart) ? '× Remover Pausa' : '+ Adicionar Pausa'}
                      </button>
                    </div>
                  )}

                  <div className="mb-6">
                    {!scheduleForm.isAdvanced ? (
                      <>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-3">Dias de Trabalho</label>
                        <div className="flex flex-wrap gap-2">
                          {[{ v: 1, l: 'Seg' }, { v: 2, l: 'Ter' }, { v: 3, l: 'Qua' }, { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(day => {
                            const isActive = (scheduleForm.weekdays || [1, 2, 3, 4, 5]).includes(day.v);
                            return (
                              <button type="button" key={day.v} onClick={() => {
                                const current = scheduleForm.weekdays || [1, 2, 3, 4, 5];
                                const updated = isActive ? current.filter(d => d !== day.v) : [...current, day.v];
                                setScheduleForm({ ...scheduleForm, weekdays: updated });
                              }} className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                {day.l}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        {[{ v: 1, l: 'Segunda-feira' }, { v: 2, l: 'Terça-feira' }, { v: 3, l: 'Quarta-feira' }, { v: 4, l: 'Quinta-feira' }, { v: 5, l: 'Sexta-feira' }, { v: 6, l: 'Sábado' }, { v: 0, l: 'Domingo' }].map(day => {
                          const config = scheduleForm.dailyConfigs?.[day.v] || { isActive: false, hasBreak: false, startTime: '', breakStart: '', breakEnd: '', endTime: '' };
                          return (
                            <div key={day.v} className={`p-4 rounded-xl border ${config.isActive ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-slate-50'}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <input type="checkbox" checked={config.isActive} onChange={e => {
                                    setScheduleForm({
                                      ...scheduleForm,
                                      dailyConfigs: {
                                        ...scheduleForm.dailyConfigs,
                                        [day.v]: { ...config, isActive: e.target.checked }
                                      }
                                    });
                                  }} className="rounded text-indigo-600 w-4 h-4 cursor-pointer" />
                                  <span className={`text-sm font-bold ${config.isActive ? 'text-indigo-900' : 'text-slate-400'}`}>{day.l}</span>
                                </div>
                                {config.isActive && (
                                  <button type="button" onClick={() => {
                                    const nextHasBreak = !(config.hasBreak || !!config.breakStart);
                                    setScheduleForm({
                                      ...scheduleForm, dailyConfigs: {
                                        ...scheduleForm.dailyConfigs, [day.v]: { ...config, hasBreak: nextHasBreak, breakStart: nextHasBreak ? config.breakStart : '', breakEnd: nextHasBreak ? config.breakEnd : '' }
                                      }
                                    });
                                  }} className="text-[10px] font-bold text-orange-500 hover:text-orange-600">
                                    {(config.hasBreak || !!config.breakStart) ? '× Remover Pausa' : '+ Adicionar Pausa'}
                                  </button>
                                )}
                              </div>
                              {config.isActive && (
                                <div className={`grid grid-cols-2 ${config.hasBreak || !!config.breakStart ? 'lg:grid-cols-4' : ''} gap-4 pl-7`}>
                                  <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">Entrada</label><input type="time" value={config.startTime} onChange={e => setScheduleForm({ ...scheduleForm, dailyConfigs: { ...scheduleForm.dailyConfigs, [day.v]: { ...config, startTime: e.target.value } } })} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs shadow-sm" /></div>
                                  {(config.hasBreak || !!config.breakStart) && (
                                    <>
                                      <div className="space-y-1"><label className="text-[9px] font-black text-orange-500 uppercase">Pausa I.</label><input type="time" value={config.breakStart} onChange={e => setScheduleForm({ ...scheduleForm, dailyConfigs: { ...scheduleForm.dailyConfigs, [day.v]: { ...config, breakStart: e.target.value } } })} className="w-full bg-white border border-orange-100 rounded-lg p-2 text-xs shadow-sm" /></div>
                                      <div className="space-y-1"><label className="text-[9px] font-black text-orange-500 uppercase">Pausa F.</label><input type="time" value={config.breakEnd} onChange={e => setScheduleForm({ ...scheduleForm, dailyConfigs: { ...scheduleForm.dailyConfigs, [day.v]: { ...config, breakEnd: e.target.value } } })} className="w-full bg-white border border-orange-100 rounded-lg p-2 text-xs shadow-sm" /></div>
                                    </>
                                  )}
                                  <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">Saída</label><input type="time" value={config.endTime} onChange={e => setScheduleForm({ ...scheduleForm, dailyConfigs: { ...scheduleForm.dailyConfigs, [day.v]: { ...config, endTime: e.target.value } } })} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs shadow-sm" /></div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 border-t pt-8">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-3">Atribuir aos Trabalhadores</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-48 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      {workers.map(w => (
                        <label key={w.id} className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-slate-300 hover:bg-slate-50 transition-colors shadow-sm">
                          <input type="checkbox" checked={scheduleForm.assignedWorkers?.includes(w.id)} onChange={() => {
                            const current = scheduleForm.assignedWorkers || [];
                            const updated = current.includes(w.id) ? current.filter(id => id !== w.id) : [...current, w.id];
                            setScheduleForm({ ...scheduleForm, assignedWorkers: updated });
                          }} className="rounded text-indigo-600" />
                          <span className="text-[10px] font-bold text-slate-700 truncate">{w.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end gap-3"><button onClick={() => setIsAddingInTab(false)} className="px-6 py-3 text-slate-400 font-bold uppercase text-xs">Cancelar</button><button onClick={() => { handleSaveSchedule(); setIsAddingInTab(false); }} className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-black text-xs uppercase shadow-lg">Salvar Horário</button></div>
                </div>
              )}
              {schedulesView === 'list' ? (
                <div className="overflow-x-auto">
                  <table className="admin-table">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Nome</th>
                        <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Horário</th>
                        <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Dias</th>
                        <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Pausa</th>
                        <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([...schedules].sort((a, b) => schedulesSort.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))).map(s => (
                        <tr key={s.id} className="border-b border-slate-100 hover:bg-indigo-50/40 transition-all even:bg-slate-50/50 last:border-b-0 group">
                          <td className="relative">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <p className="font-black text-slate-900 text-sm uppercase truncate">{s.name}</p>
                            <p className="text-xs text-slate-400 truncate">{(s.assignedWorkers || []).length} Colaboradores</p>
                          </td>
                          <td className="text-sm font-bold text-indigo-600 truncate">{s.isAdvanced ? 'Múltiplos' : `${s.startTime || '--:--'} — ${s.endTime || '--:--'}`}</td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(d => {
                                const isActive = s.isAdvanced ? (s.dailyConfigs && s.dailyConfigs[d.v] && s.dailyConfigs[d.v].isActive) : (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
                                return isActive ? <span key={d.v} className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md text-[9px] font-black uppercase">{d.l}</span> : null;
                              })}
                            </div>
                          </td>
                          <td className="text-sm font-bold text-orange-500 truncate">{s.isAdvanced ? 'Variável' : `${s.breakStart || '--:--'} — ${s.breakEnd || '--:--'}`}</td>
                          <td className="text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => {
                                const assigned = workers.filter(w => w.assignedSchedules?.includes(s.id)).map(w => w.id);
                                setScheduleForm({ ...s, assignedWorkers: assigned });
                                setIsAddingInTab(true);
                              }} className="p-2 text-slate-400 hover:text-amber-600"><Edit2 size={16} /></button>
                              <button onClick={() => handleDelete('schedules', s.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {schedules.map(s => (
                    <div key={s.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-indigo-100 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Timer size={20} /></div>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            const assigned = workers.filter(w => w.assignedSchedules?.includes(s.id)).map(w => w.id);
                            setScheduleForm({ ...s, assignedWorkers: assigned });
                            setIsAddingInTab(true);
                          }} className="p-2 text-slate-400 hover:text-amber-500"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete('schedules', s.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <h4 className="font-black text-slate-800 text-lg uppercase">{s.name}</h4>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.isAdvanced ? 'Múltiplos (por dia)' : `${s.startTime || '--:--'} — ${s.endTime || '--:--'}`}</p>
                      <div className="flex flex-wrap gap-1 mt-3 mb-2">
                        {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(d => {
                          const isActive = s.isAdvanced ? (s.dailyConfigs && s.dailyConfigs[d.v] && s.dailyConfigs[d.v].isActive) : (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
                          return isActive ? <span key={d.v} className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md text-[9px] font-black uppercase">{d.l}</span> : null;
                        })}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-orange-500 font-bold mt-2"><Coffee size={12} /> Pausa: {s.isAdvanced ? 'Variável' : `${s.breakStart || '--:--'}-${s.breakEnd || '--:--'}`}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Módulo Despesas */}
          {!auditWorkerId && activeTab === 'expenses' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black flex items-center gap-3"><Receipt size={32} className="text-rose-600" /> Balanço de Custos</h2>
                <button onClick={() => { setExpenseForm({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) }); setIsAddingInTab(!isAddingInTab); }} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl transition-all ${isAddingInTab ? 'bg-slate-800 text-white' : 'bg-rose-600 text-white'}`}>{isAddingInTab ? 'Fechar' : 'Nova Despesa'}</button>
              </div>
              {isAddingInTab && (
                <div className="mb-10 bg-white p-10 rounded-[3rem] shadow-xl border-2 border-rose-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Descrição</label><input type="text" value={expenseForm.name} onChange={e => setExpenseForm({ ...expenseForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor (€)</label><input type="number" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold text-rose-600 outline-none shadow-sm" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo</label><select value={expenseForm.type} onChange={e => setExpenseForm({ ...expenseForm, type: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none shadow-sm"><option value="fixo">Fixo</option><option value="variável">Variável</option></select></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data</label><input type="date" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm shadow-sm" /></div>
                  </div>
                  <div className="mt-6 flex items-center gap-3"><button onClick={handleSaveExpense} className="flex-1 bg-rose-600 text-white py-5 rounded-2xl font-black text-sm uppercase shadow-lg">Registar Gasto</button></div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th onClick={() => setExpensesSort(prev => ({ key: 'date', direction: prev.key === 'date' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-rose-600 transition-colors">Data {expensesSort.key === 'date' ? (expensesSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th onClick={() => setExpensesSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-rose-600 transition-colors">Descrição {expensesSort.key === 'name' ? (expensesSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th onClick={() => setExpensesSort(prev => ({ key: 'type', direction: prev.key === 'type' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-rose-600 transition-colors">Tipo {expensesSort.key === 'type' ? (expensesSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th onClick={() => setExpensesSort(prev => ({ key: 'amount', direction: prev.key === 'amount' && prev.direction === 'asc' ? 'desc' : 'asc' }))} className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-rose-600 transition-colors">Valor {expensesSort.key === 'amount' ? (expensesSort.direction === 'asc' ? '↑' : '↓') : ''}</th>
                      <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([...expenses].filter(e => isSameMonth(e.date, currentMonth)).sort((a, b) => {
                      let res = 0;
                      if (expensesSort.key === 'date') res = new Date(a.date) - new Date(b.date);
                      if (expensesSort.key === 'name') res = a.name.localeCompare(b.name);
                      if (expensesSort.key === 'type') res = a.type.localeCompare(b.type);
                      if (expensesSort.key === 'amount') res = a.amount - b.amount;
                      return expensesSort.direction === 'asc' ? res : -res;
                    })).map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                        <td className="text-sm font-bold truncate">{new Date(exp.date).toLocaleDateString('pt-PT')}</td>
                        <td className="text-sm font-bold text-slate-700 truncate">{exp.name}</td>
                        <td className="text-center">
                          <span className={`px-4 py-1 rounded-full text-[9px] font-bold uppercase ${exp.type === 'fixo' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                            {exp.type}
                          </span>
                        </td>
                        <td className="text-sm font-black text-rose-600 text-right">-{formatCurrency(exp.amount)}</td>
                        <td className="text-right">
                          <div className="flex justify-end gap-3">
                            <button onClick={() => handleDelete('expenses', exp.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
  const [systemSettings, setSystemSettings] = useState(() => {
    const defaults = {
      adminPassword: 'admin',
      companyName: 'MAGNETIC PLACE',
      darkMode: false,
      appWidth: '1920',
      geminiApiKey: ''
    };
    const saved = localStorage.getItem('magnetic_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaults, ...parsed };
      } catch (e) {
        return defaults;
      }
    }
    return defaults;
  });

  useEffect(() => {
    localStorage.setItem('magnetic_settings', JSON.stringify(systemSettings));
    const root = document.documentElement;
    root.style.setProperty('--app-max-width', `${systemSettings.appWidth}px`);
    // Sync the module-level apiKey variable used by callGemini
    apiKey = systemSettings.geminiApiKey || '';
    if (systemSettings.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [systemSettings]);

  const urlParams = new URLSearchParams(window.location.search);
  const urlView = urlParams.get('view');
  const urlClient = urlParams.get('client');
  const urlMonth = urlParams.get('month');

  const [view, setView] = useState(() => urlView || localStorage.getItem('magnetic_view') || 'login');
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('magnetic_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Corrigir problema de URL params perdidos no deploy Vercel
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const clientParam = params.get('client');
    if (viewParam === 'client_portal' && clientParam) {
      setView('client_portal');
    }
  }, []);

  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('magnetic_admin_tab');
    const validTabs = ['overview', 'team', 'clients', 'portal_validacao', 'schedules', 'expenses', 'reports', 'documentos', 'notificacoes', 'correcoes', 'settings'];
    return validTabs.includes(saved) ? saved : 'overview';
  });

  useEffect(() => {
    localStorage.setItem('magnetic_admin_tab', activeTab);
  }, [activeTab]);

  const [printingReport, setPrintingReport] = useState(null);

  // --- DADOS REAIS DO SUPABASE (Começam vazios) ---
  const [clients, setClients] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [personalSchedules, setPersonalSchedules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [correcoesCorrections, setCorrecoesCorrections] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [clientApprovals, setClientApprovals] = useState([]);
  const [appNotifications, setAppNotifications] = useState([]);
  const [isDbReady, setIsDbReady] = useState(false);

  // --- Estados do Disparo de E-mail ---
  const [modalEmailAberto, setModalEmailAberto] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [portalSubTab, setPortalSubTab] = useState('envios'); // 'envios' | 'colaboradores' | 'correcoes' | 'links'
  const [portalMonth, setPortalMonth] = useState(new Date());
  const [modalRejeitarAberto, setModalRejeitarAberto] = useState(false);
  const [rejeitarMotivo, setRejeitarMotivo] = useState('');
  const [rejeitarNotif, setRejeitarNotif] = useState(null);

  // Injetar o script do Supabase dinamicamente para evitar erros de build
  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    if (supabase) {
      setIsDbReady(true);
      return;
    }
    if (window.supabase) {
      supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
      setIsDbReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = () => {
      if (window.supabase) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        setIsDbReady(true);
      }
    };
    document.head.appendChild(script);
  }, []);

  // Make schedules available globally for the report calculation
  useEffect(() => {
    window.schedules_global = schedules;
  }, [schedules]);

  // 1. CARREGAR OS DADOS DO SUPABASE AO ABRIR A APP
  useEffect(() => {
    if (!isDbReady || !supabase) return;
    const fetchData = async () => {
      const fetchTable = async (table, setter) => {
        const tableName = table.toLowerCase();
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) console.error('Erro fetchTable:', error);
        if (!error && data) {
          if (table === 'schedules') {
            const mapped = data.map(d => ({
              ...d,
              isAdvanced: d.isAdvanced !== undefined ? d.isAdvanced : d.isadvanced,
              dailyConfigs: d.dailyConfigs !== undefined ? d.dailyConfigs : d.dailyconfigs,
            }));
            setter(mapped);
          } else {
            setter(data);
          }
        }
      };

      await Promise.all([
        fetchTable('clients', setClients),
        fetchTable('workers', (data) => {
          const mapped = data.map(d => ({
            ...d,
            nis: d.nis !== undefined ? d.nis : '',
            nif: d.nif !== undefined ? d.nif : '',
            status: d.is_active === false ? 'inativo' : 'ativo',
          }));
          setWorkers(mapped);
        }),
        fetchTable('schedules', setSchedules),
        fetchTable('personalschedules', setPersonalSchedules),
        fetchTable('logs', setLogs),
        fetchTable('expenses', setExpenses),
        fetchTable('approvals', setApprovals),
        fetchTable('client_approvals', setClientApprovals),
        // Fetch tabela documents (nome em inglês)
        fetchTable('documents', setDocuments),
        fetchTable('app_notifications', setAppNotifications),
        fetchTable('correcoes', setCorrecoesCorrections),
      ]);
    };
    fetchData();

    // REAL-TIME SUBSCRIPTIONS PARA DADOS CRÍTICOS
    // Notificações
    const channelNotif = supabase
      .channel('realtime-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, (payload) => {
        if (payload.eventType === 'INSERT') setAppNotifications(prev => [payload.new, ...prev]);
        else if (payload.eventType === 'UPDATE') setAppNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
        else if (payload.eventType === 'DELETE') setAppNotifications(prev => prev.filter(n => n.id !== payload.old.id));
      })
      .subscribe();

    // Correções
    const channelCorrecoes = supabase
      .channel('realtime-correcoes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'correcoes' }, (payload) => {
        if (payload.eventType === 'INSERT') setCorrecoesCorrections(prev => [payload.new, ...prev]);
        else if (payload.eventType === 'UPDATE') setCorrecoesCorrections(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
        else if (payload.eventType === 'DELETE') setCorrecoesCorrections(prev => prev.filter(c => c.id !== payload.old.id));
      })
      .subscribe();

    // Aprovações de Clientes (Crucial para Dashboard de Validação)
    const channelApprovals = supabase
      .channel('realtime-client-approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_approvals' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setClientApprovals(prev => {
            const exists = prev.some(x => x.id === payload.new.id);
            return exists ? prev.map(x => x.id === payload.new.id ? payload.new : x) : [...prev, payload.new];
          });
        } else if (payload.eventType === 'DELETE') {
          setClientApprovals(prev => prev.filter(x => x.id !== payload.old.id));
        }
      })
      .subscribe();

    // Logs de Horas
    const channelLogs = supabase
      .channel('realtime-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setLogs(prev => {
            const exists = prev.some(x => x.id === payload.new.id);
            return exists ? prev.map(x => x.id === payload.new.id ? payload.new : x) : [...prev, payload.new];
          });
        } else if (payload.eventType === 'DELETE') {
          setLogs(prev => prev.filter(x => x.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelNotif);
      supabase.removeChannel(channelApprovals);
      supabase.removeChannel(channelLogs);
    };
  }, [isDbReady]);

  // 2. GRAVAR DADOS NO SUPABASE
  const saveToDb = async (colName, id, data) => {
    if (colName === 'workers') setWorkers(prev => prev.some(x => x.id === id) ? prev.map(x => x.id === id ? { ...x, ...data } : x) : [...prev, data]);
    if (colName === 'clients') setClients(prev => prev.some(x => x.id === id) ? prev.map(x => x.id === id ? { ...x, ...data } : x) : [...prev, data]);
    if (colName === 'expenses') setExpenses(prev => prev.some(x => x.id === id) ? prev.map(x => x.id === id ? { ...x, ...data } : x) : [...prev, data]);
    if (colName === 'schedules') setSchedules(prev => prev.some(x => x.id === id) ? prev.map(x => x.id === id ? { ...x, ...data } : x) : [...prev, data]);
    if (colName === 'personalSchedules' || colName === 'personalschedules') setPersonalSchedules(prev => prev.some(x => x.id === id) ? prev.map(x => x.id === id ? { ...x, ...data } : x) : [...prev, data]);
    if (colName === 'logs' || colName === 'worker_logs') {
      setLogs(prev => prev.some(x => x.id === id) ? prev.map(x => x.id === id ? { ...x, ...data } : x) : [...prev, data]);
    }
    if (colName === 'approvals') setApprovals(prev => prev.some(x => x.id === id) ? prev.map(x => x.id === id ? { ...x, ...data } : x) : [...prev, data]);
    if (colName === 'client_approvals') setClientApprovals(prev => prev.some(x => x.id === id) ? prev.map(x => x.id === id ? { ...x, ...data } : x) : [...prev, data]);
    if (colName === 'app_notifications') {
      setAppNotifications(prev => prev.some(x => x.id === id) ? prev.map(x => x.id === id ? { ...x, ...data } : x) : [data, ...prev]);
    }
    if (colName === 'correcoes') {
      setCorrecoesCorrections(prev => prev.some(x => x.id === id) ? prev.map(x => x.id === id ? { ...x, ...data } : x) : [data, ...prev]);
    }

    if (colName === 'documents' || colName === 'documentos') {
      setDocuments(prev => {
        const exists = prev.some(x => x.id === id);
        if (exists) return prev.map(x => x.id === id ? { ...x, ...data } : x);
        return [...prev, data];
      });

      if (supabase) {
        const { file, ...updatePayload } = data;
        await supabase.from('documents').upsert({ ...updatePayload, id });
      }
    } else if (supabase) {
      // Gravação Genérica para outras tabelas (workers, clients, schedules, app_notifications, etc)
      const tableName = (colName === 'personalSchedules' || colName === 'personalschedules') ? 'personalschedules' :
        (colName === 'logs' || colName === 'worker_logs') ? 'logs' :
          colName.toLowerCase();

      // Se for logs, garantir campos em camelCase
      let payload = { ...data, id };
      if (colName === 'logs' || colName === 'worker_logs') {
        payload = {
          id: data.id,
          date: data.date,
          workerId: data.workerId,
          clientId: data.clientId,
          startTime: data.startTime,
          endTime: data.endTime,
          breakStart: data.breakStart,
          breakEnd: data.breakEnd,
          hours: data.hours || data.totalHours
        };
      } else if (colName === 'workers') {
        // Mapeamento explícito e seguro para a tabela de trabalhadores
        const { status, nis, niss, is_active, ...rest } = data;
        const currentStatus = status || (is_active === false ? 'inativo' : 'ativo');
        payload = {
          ...rest,
          is_active: currentStatus === 'ativo',
          id: id
        };
        // Garantir que não enviamos nomes de colunas duplicados ou internos
        if (nis) {
          payload.nis = nis;
        }
      } else if (colName === 'clients') {
        // Filtrar apenas campos que existem na tabela clients
        const { name, morada, nif, email, valorHora, status_email, link_gerado, status, totalHoras, ...rest } = data;
        payload = {
          id: id,
          name,
          morada,
          nif,
          email,
          valorHora,
          status_email,
          link_gerado,
          ...rest
        };
      } else if (colName === 'correcoes') {
        // Filtrar apenas campos que existem na tabela correcoes
        const { title, message, status: correcaoStatus, client_id, month, payload: correcaoPayload, created_at, ...rest } = data;
        payload = {
          id: id,
          title,
          message,
          status: correcaoStatus || 'pending',
          client_id,
          month,
          payload: correcaoPayload || {},
          created_at: created_at || new Date().toISOString(),
          ...rest
        };
      }

      const { error } = await supabase.from(tableName).upsert(payload, { onConflict: 'id' });
      if (error) {
        console.error(`Erro ao gravar em ${tableName}:`, error);
        console.error('Detalhes do erro:', error.message, error.details, error.hint);
      }
    }
  };

  // 3. APAGAR DADOS DO SUPABASE
  const handleDelete = async (colName, id) => {
    if (colName === 'clients') setClients(prev => prev.filter(x => x.id !== id));
    if (colName === 'workers') setWorkers(prev => prev.filter(x => x.id !== id));
    if (colName === 'schedules') setSchedules(prev => prev.filter(x => x.id !== id));
    if (colName === 'personalSchedules' || colName === 'personalschedules') setPersonalSchedules(prev => prev.filter(x => x.id !== id));
    if (colName === 'logs' || colName === 'worker_logs') setLogs(prev => prev.filter(x => x.id !== id));
    if (colName === 'expenses') setExpenses(prev => prev.filter(x => x.id !== id));
    if (colName === 'approvals') setApprovals(prev => prev.filter(x => x.id !== id));
    if (colName === 'client_approvals') setClientApprovals(prev => prev.filter(x => x.id !== id));
    if (colName === 'app_notifications') setAppNotifications(prev => prev.filter(x => x.id !== id));
    if (colName === 'correcoes') setCorrecoesCorrections(prev => prev.filter(x => x.id !== id));
    if (colName === 'documentos' || colName === 'documents') {
      const doc = documents.find(x => x.id === id);
      setDocuments(prev => prev.filter(x => x.id !== id));

      if (supabase && doc) {
        const pathToDelete = doc.storagePath || (doc.url ? doc.url.split('/public/documentos/')[1] : null);

        if (pathToDelete) {
          await supabase.storage.from('documentos').remove([pathToDelete]);
        }

        await supabase.from('documents').delete().eq('id', id);
      }
    } else if (supabase) {
      const deleteTable = colName === 'documentos' ? 'documents' :
        (colName === 'logs' || colName === 'worker_logs') ? 'logs' :
          colName.toLowerCase();
      const { error } = await supabase.from(deleteTable).delete().eq('id', id);
      if (error) console.error("Erro ao apagar:", error);
    }
  };

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

  const [workerForm, setWorkerForm] = useState({ id: null, name: '', assignedClients: [], assignedSchedules: [], defaultClientId: '', defaultScheduleId: '', tel: '', valorHora: '', profissao: '', nis: '', nif: '', iban: '', status: 'ativo' });
  const [clientForm, setClientForm] = useState({ id: null, name: '', morada: '', nif: '', valorHora: '', email: '' });
  const [scheduleForm, setScheduleForm] = useState({ id: null, name: '', startTime: '', breakStart: '', breakEnd: '', endTime: '', weekdays: [1, 2, 3, 4, 5], assignedWorkers: [] });
  const [expenseForm, setExpenseForm] = useState({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) });

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
        toDismiss.forEach(n => handleDismissNotif(n.id));
      }
    }
  }, [activeTab, portalSubTab, myNotifications, currentUser?.role]);

  const handleBannerClick = (notif) => {
    handleDismissNotif(notif.id);

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

  const handleSaveWorker = () => {
    if (!workerForm.name) return;
    const wId = workerForm.id || `w${Date.now()}`;
    saveToDb('workers', wId, { ...workerForm, id: wId, status: workerForm.status || 'ativo' });
    setWorkerForm({ id: null, name: '', assignedClients: [], assignedSchedules: [], defaultClientId: '', defaultScheduleId: '', tel: '', valorHora: '', profissao: '', nis: '', nif: '', iban: '', status: 'ativo' });
  };

  const handleSaveClient = () => {
    if (!clientForm.name) return;
    const cId = clientForm.id || `c${Date.now()}`;
    saveToDb('clients', cId, { ...clientForm, id: cId });
    setClientForm({ id: null, name: '', morada: '', nif: '', valorHora: '', email: '' });
  };

  const handleDisparoEmail = async () => {
    if (!clienteSelecionado) return;
    setIsSendingEmail(true);

    const monthStr = `${portalMonth.getFullYear()}-${String(portalMonth.getMonth() + 1).padStart(2, '0')}`;
    const modalLinkUnico = clienteSelecionado.link_gerado || `${CLIENT_PORTAL_URL}/?view=client_portal&client=${String(clienteSelecionado.id)}&month=${monthStr}`;
    const totalHoras = formatHours(logs.filter(l => l.clientId === clienteSelecionado.id && l.date?.substring(0, 7) === monthStr).reduce((acc, l) => acc + l.hours, 0));

    // Configurações da sua conta EmailJS
    const EMAILJS_TEMPLATE_ID = EMAILJS_TEMPLATE_ID_PORTAL;

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

      await sendNotificationEmail(
        clienteSelecionado.email,
        clienteSelecionado.name,
        'Novo Relatório Disponível',
        `O seu relatório de horas do mês ${portalMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })} está disponível para validação.`,
        clienteSelecionado.id,
        monthStr
      );

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

  const handleSaveExpense = () => {
    if (!expenseForm.name || !expenseForm.amount) return;
    const eId = expenseForm.id || `e${Date.now()}`;
    saveToDb('expenses', eId, { ...expenseForm, id: eId });
    setExpenseForm({ id: null, name: '', amount: '', type: 'fixo', date: toISODateLocal(new Date()) });
  };

  const handleSaveSchedule = () => {
    if (!scheduleForm.name) return;
    const sId = scheduleForm.id || `s${Date.now()}`;
    saveToDb('schedules', sId, { ...scheduleForm, id: sId });

    workers.forEach(w => {
      const isSelected = scheduleForm.assignedWorkers?.includes(w.id);
      const currentAssigned = w.assignedSchedules || [];
      let nextAssigned = [...currentAssigned];

      if (isSelected && !currentAssigned.includes(sId)) nextAssigned.push(sId);
      else if (!isSelected && currentAssigned.includes(sId)) nextAssigned = nextAssigned.filter(id => id !== sId);

      if (JSON.stringify(currentAssigned) !== JSON.stringify(nextAssigned)) {
        saveToDb('workers', w.id, { ...w, assignedSchedules: nextAssigned });
      }
    });
    setScheduleForm({ id: null, name: '', startTime: '', breakStart: '', breakEnd: '', endTime: '', weekdays: [1, 2, 3, 4, 5], assignedWorkers: [] });
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
          {...{ onLogout: handleLogout, onLogin: handleLogin, currentUser, adminStats, currentMonth, setCurrentMonth, activeTab, setActiveTab, clients, clientForm, setClientForm, workers, workerForm, setWorkerForm, schedules, scheduleForm, setScheduleForm, expenses, expenseForm, setExpenseForm, auditWorkerId, setAuditWorkerId, setShowFinReport, logs, handleSaveWorker, handleSaveClient, handleSaveSchedule, handleSaveExpense, handleSaveEntry, printingReport, setPrintingReport, handleDelete, approvals, clientApprovals, systemSettings, setSystemSettings, documents, setDocuments, saveToDb, appNotifications, correctionNotifications, correcoesCorrections, setClienteSelecionado, setModalEmailAberto, setToastMessage, portalSubTab, setPortalSubTab, portalMonth, setPortalMonth, setModalRejeitarAberto, setRejeitarMotivo, setRejeitarNotif }}
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