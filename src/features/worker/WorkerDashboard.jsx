import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { WorkerProvider, useWorker } from './contexts/WorkerContext';
import { useApp } from '../../context/AppContext';
import {
  Clock, ChevronLeft, ChevronRight, Calendar, CheckCircle,
  LogOut, Timer, TrendingUp, Edit2, Save, X, Plus, Users,
  AlertCircle, Briefcase, FileText, Trash2, UserCircle, Coffee, Star, Zap, ChevronUp, ChevronDown, Loader2, Sparkles, Download
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import {
  toISODateLocal,
  isSameMonth,
  getLastBusinessDayOfMonth,
  formatDocDate
} from '../../utils/dateUtils';
import {
  formatHours,
  calculateDuration,
  calculateExpectedMonthlyHours,
  getScheduleForDay
} from '../../utils/formatUtils';

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

const EntryForm = ({ data, clients, assignedClients, onChange, onSave, onCancel, showDate = false, isEditing = false, title = "Registar Horário", isInline = false, systemSettings }) => {
  const [isImproving, setIsImproving] = useState(false);
  const [showBreaks, setShowBreaks] = useState(!!(data.breakStart || data.breakEnd));
  const [showComments, setShowComments] = useState(!!data.description);

  const callGemini = async (prompt, systemPrompt, apiKey) => {
    if (!apiKey) return prompt;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }] })
      });
      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text || prompt;
    } catch { return prompt; }
  };

  const filteredClients = useMemo(() => {
    if (!assignedClients || assignedClients.length === 0) return clients || [];
    return (clients || []).filter(c => assignedClients.includes(c.id));
  }, [clients, assignedClients]);

  const handleAiPolish = async () => {
    if (!data.description) return;
    setIsImproving(true);
    const res = await callGemini(
      `Melhore esta descrição de tarefa para um relatório de horas profissional. Responda APENAS com a descrição polida. Sem conselhos e sem frases introdutórias. Texto original: "${data.description}"`,
      "Você é um redator profissional muito rigoroso.",
      systemSettings?.geminiApiKey
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

const WorkerDocuments = ({ currentUser, documents, saveToDb }) => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('magnetic_worker_doc_tab') || 'pendentes');

  useEffect(() => {
    localStorage.setItem('magnetic_worker_doc_tab', activeTab);
  }, [activeTab]);

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showSigner, setShowSigner] = useState(false);
  const [signing, setSigning] = useState(false);
  const sigCanvas = useRef(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';
  const supabase = window.supabase;

  useEffect(() => {
    if (showSigner && sigCanvas.current) {
      const canvas = sigCanvas.current.getCanvas();
      if (canvas) {
        setTimeout(() => {
          const rect = canvas.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            canvas.width = rect.width;
            canvas.height = rect.height;
            sigCanvas.current.clear();
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
      const sigBlob = await fetch(sigDataUrl).then(r => r.blob());
      const sigPath = `${currentUser.id}/assinaturas/${Date.now()}.png`;
      const { data: sigUpload, error: sigError } = await supabase.storage
        .from('documentos')
        .upload(sigPath, sigBlob);

      if (sigError) throw new Error(`Erro upload assinatura: ${sigError.message}`);

      const { data: sigUrlData } = supabase.storage.from('documentos').getPublicUrl(sigPath);
      const assinaturaUrl = sigUrlData.publicUrl;

      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const userIP = ipData.ip || 'Desconhecido';
      const now = new Date().toISOString();
      const workerName = currentUser?.name || 'Desconhecido';

      const pdfCoUrl = 'https://api.pdf.co/v1/pdf/edit/add';
      const pdfCoKey = import.meta.env.VITE_PDFCO_API_KEY || 'diegobarbosa@magneticplace.pt_QTV2lppvP8euGSGmWWAEU9iZTpb81mZIQqOJM1r9zsVW4weRfuolLhkdzXFTpNFU';

      const textResponse = await fetch(pdfCoUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': pdfCoKey },
        body: JSON.stringify({
          url: selectedDoc.url,
          name: 'Documento_Assinado',
          annotations: [{ text: `Assinado por ${workerName} em ${new Date(now).toLocaleString('pt-PT')} via IP ${userIP}`, x: 50, y: 750, width: 450, height: 16, fontsize: 9, color: '333333' }]
        })
      });

      const textResult = await textResponse.json();
      if (textResult.error) throw new Error(textResult.error);

      const pdfWithSigUrl = textResult.url;

      const imgResponse = await fetch(pdfCoUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': pdfCoKey },
        body: JSON.stringify({
          url: pdfWithSigUrl,
          name: 'Documento_Assinado_Completo',
          images: [{ url: assinaturaUrl, x: 400, y: 700, width: 150, height: 50 }]
        })
      });

      const imgResult = await imgResponse.json();
      if (imgResult.error) throw new Error(imgResult.error);

      const pdfCoTempUrl = imgResult.url;
      const pdfBlob = await fetch(pdfCoTempUrl).then(async r => {
        if (!r.ok) throw new Error('Erro ao baixar PDF temporário do PDF.co');
        return await r.blob();
      });

      const pdfPath = `${currentUser.id}/documentos_assinados/${selectedDoc.id}_signed_${Date.now()}.pdf`;
      const { data: pdfUpload, error: pdfError } = await supabase.storage
        .from('documentos')
        .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });

      if (pdfError) throw new Error(`Erro ao guardar PDF no seu storage: ${pdfError.message}`);

      const { data: pdfUrlData } = supabase.storage.from('documentos').getPublicUrl(pdfPath);
      const pdfAssinadoUrl = pdfUrlData.publicUrl;

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
                <iframe src={`${selectedDoc.url}#toolbar=0`} className="w-full h-full rounded-xl" title="Document Preview" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400">Documento não disponível</p>
                </div>
              )}
            </div>
            <div className="bg-slate-50 p-4 rounded-xl mb-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-bold text-slate-500">Desenhe a sua assinatura abaixo:</p>
                <button type="button" onClick={() => sigCanvas.current?.clear()} className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-700 transition-colors">
                  Limpar Área
                </button>
              </div>
              <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden shadow-inner h-40">
                <SignatureCanvas ref={sigCanvas} penColor="black" canvasProps={{ className: 'w-full h-full cursor-crosshair' }} />
              </div>
            </div>
            <button
              onClick={handleSign}
              disabled={signing}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {signing ? <><Loader2 size={16} className="animate-spin" /> A processar...</> : <><CheckCircle size={16} /> Assinar Documento</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const WorkerDashboardContent = ({ onLogout, onLogin }) => {
  const {
    currentUser,
    currentMonth,
    logs,
    clients,
    schedules,
    personalSchedules,
    approvals,
    documents,
    systemSettings,
    inlineEditingDate, setInlineEditingDate,
    successMsg, setSuccessMsg,
    inlineFormData, setInlineFormData,
    showSchedulesModal, setShowSchedulesModal,
    showProgress, setShowProgress,
    expandedDays, setExpandedDays,
    showPersonalBreaks, setShowPersonalBreaks,
    newPersonalForm, setNewPersonalForm,
    monthLogs,
    todayHours,
    totalMonthHours,
    activeWorkerSchedule,
    expectedHours,
    daysList,
    assigned,
    myPersonals,
    currentMonthStr,
    myApproval,
    pendingApprovals,
    handleDismissNotif,
    handleOpenInlineForm,
    handleQuickRegister,
    savePersonalSchedule,
    setDefaultSchedule,
    handleSaveEntry,
    saveToDb,
    handleDelete,
    handleApproveMonth
  } = useWorker();

  const { mainFormData, setMainFormData, setCurrentUser } = useApp();

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
      {currentUser?.isAdminImpersonating && (
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
            <p className="text-sm sm:text-base font-black leading-none text-slate-800 uppercase tracking-tight">{formatShortName(currentUser?.name)}</p>
            <p className="text-[9px] sm:text-[10px] text-indigo-500 uppercase font-black tracking-widest mt-1">
              {currentUser?.profissao || 'Colaborador'}
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
                        onClick={() => handleApproveMonth(currentUser?.id)}
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
            <h2 className="text-3xl md:text-5xl font-black mb-4 leading-tight text-white text-center md:text-left uppercase tracking-tighter">Olá, {currentUser?.name?.split(' ')[0]}!</h2>
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
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)]" style={{ backgroundSize: '200% 100%' }}></div>
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
            <EntryForm
              data={mainFormData}
              clients={clients}
              assignedClients={currentUser?.assignedClients}
              onChange={setMainFormData}
              onSave={() => {
                if (!mainFormData.clientId || !mainFormData.startTime || !mainFormData.endTime) {
                  handleSaveEntry(mainFormData, true);
                  return;
                }
                handleSaveEntry(mainFormData, true);
                setSuccessMsg('Registo inserido com sucesso!');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => setSuccessMsg(''), 6000);
              }}
              onCancel={() => {
                setMainFormData({ id: null, date: toISODateLocal(new Date()), clientId: currentUser?.defaultClientId || '', startTime: '', breakStart: '', breakEnd: '', endTime: '', description: '' });
              }}
              showDate
              systemSettings={systemSettings}
              title="Novo Registo de Atividade"
            />
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
                            <EntryForm
                              isInline
                              data={inlineFormData}
                              clients={clients}
                              assignedClients={currentUser?.assignedClients}
                              onChange={setInlineFormData}
                              onSave={() => { handleSaveEntry(inlineFormData, false, ds); setInlineEditingDate(null); }}
                              onCancel={() => setInlineEditingDate(null)}
                              systemSettings={systemSettings}
                            />
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

        <div id="secao-documentos">
          <WorkerDocuments currentUser={currentUser} documents={documents} saveToDb={saveToDb} />
        </div>
      </main>

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
                    <div key={s.id} className={`p-4 rounded-2xl border flex justify-between items-center ${currentUser?.defaultScheduleId === s.id ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
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
                              {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(d => {
                                const isActive = (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
                                return isActive ? <span key={d.v} className="bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded text-[8px] font-black uppercase">{d.l}</span> : null;
                              })}
                            </div>
                          </>
                        )}
                      </div>
                      <button onClick={() => setDefaultSchedule(s.id)} title="Definir como Padrão" className={`p-2 rounded-xl transition-all ${currentUser?.defaultScheduleId === s.id ? 'text-amber-500 bg-amber-100' : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100'}`}>
                        <Star fill={currentUser?.defaultScheduleId === s.id ? 'currentColor' : 'none'} size={16} />
                      </button>
                    </div>
                  )) : <p className="text-xs text-slate-400 italic">Sem turnos atribuídos.</p>}
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pessoais</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {myPersonals.map(s => (
                    <div key={s.id} className={`p-4 rounded-2xl border flex justify-between items-center ${currentUser?.defaultScheduleId === s.id ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50/50 border-emerald-100'}`}>
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
                              {[{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }].map(d => {
                                const isActive = (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
                                return isActive ? <span key={d.v} className="bg-emerald-100 text-emerald-600 px-1 py-0.5 rounded text-[8px] font-black uppercase">{d.l}</span> : null;
                              })}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setDefaultSchedule(s.id)} title="Definir como Padrão" className={`p-2 rounded-xl transition-all ${currentUser?.defaultScheduleId === s.id ? 'text-amber-500 bg-amber-100' : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100'}`}>
                          <Star fill={currentUser?.defaultScheduleId === s.id ? 'currentColor' : 'none'} size={14} />
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
};

const WorkerDashboard = ({ onLogout, onLogin }) => {
  return (
    <WorkerProvider>
      <WorkerDashboardContent onLogout={onLogout} onLogin={onLogin} />
    </WorkerProvider>
  );
};

export default WorkerDashboard;
