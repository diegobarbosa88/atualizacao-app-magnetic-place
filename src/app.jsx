import React, { useState, useMemo, useEffect } from 'react';
import './App.css';
import {
  AlertCircle, CheckCircle, ChevronLeft, ChevronRight, LogOut, Mail,
  Megaphone, Plus, Sparkles, Loader2, Send, X, XCircle, BarChart3,
  Settings, AlertTriangle, Clock, TrendingUp, TrendingDown, Wallet,
  FileText, LayoutGrid, Activity, History, Trophy, Building2, Palette,
  Lock, UserCircle, Upload, Bell, Star
} from 'lucide-react';
import emailjs from '@emailjs/browser';
import { useApp } from './context/AppContext';
import ClientPortal from './ClientPortal.jsx';
import { WorkerDashboard } from './features/worker';
import AdminDashboard from './features/admin/AdminDashboard';
import FinancialReportOverlay from './features/admin/FinancialReportOverlay';
import DocumentsAdmin from './features/admin/DocumentsAdmin';
import NotificationsAdmin from './features/admin/NotificationsAdmin';
import LoginView from './features/auth/LoginView';
import CompanyLogo from './components/common/CompanyLogo';
import EntryForm from './components/common/EntryForm';
import ClientTimesheetReport from './components/common/ClientTimesheetReport';
import WorkerDocuments from './components/common/WorkerDocuments';
import {
  toISODateLocal, isSameMonth
} from './utils/dateUtils';
import {
  formatHours, formatCurrency, calculateDuration
} from './utils/formatUtils';
import { sendNotificationEmail } from './utils/emailUtils';

const CLIENT_PORTAL_URL = import.meta.env.VITE_CLIENT_PORTAL_URL || 'https://t2x5z5k2q1qweqobvre.plex.cloud';

// --- App Principal ---
export default function App() {
  const {
    systemSettings, setSystemSettings,
    view, setView,
    currentUser, setCurrentUser,
    currentMonth, setCurrentMonth,
    clients, setClients, workers,
    logs,
    expenses,
    correcoesCorrections,
    approvals,
    documents,
    clientApprovals,
    appNotifications,
    saveToDb,
    handleDelete,
    supabase
  } = useApp();

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
        await supabase.from('app_notifications').update({ dismissed_by_ids: [...dismissedIds, currentUser.id] }).eq('id', id);
      }
    }
  };

  useEffect(() => {
    if (!currentUser || !myNotifications.length) return;
    myNotifications.forEach(async (notif) => {
      const viewedIds = notif.viewed_by_ids || [];
      if (!viewedIds.includes(currentUser.id)) {
        if (supabase) {
          await supabase.from('app_notifications').update({ viewed_by_ids: [...viewedIds, currentUser.id] }).eq('id', notif.id);
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

  const handleDisparoEmail = async () => {
    if (!clienteSelecionado) return;
    setIsSendingEmail(true);
    const monthStr = `${portalMonth.getFullYear()}-${String(portalMonth.getMonth() + 1).padStart(2, '0')}`;
    const modalLinkUnico = clienteSelecionado.link_gerado || `${CLIENT_PORTAL_URL}/?view=client_portal&client=${String(clienteSelecionado.id)}&month=${monthStr}`;
    const totalHoras = formatHours(logs.filter(l => l.clientId === clienteSelecionado.id && l.date?.substring(0, 7) === monthStr).reduce((acc, l) => acc + l.hours, 0));
    const EMAILJS_SERVICE_ID = "service_xvt0vm8";
    const EMAILJS_TEMPLATE_ID = "template_o5csfq8";
    const EMAILJS_PUBLIC_KEY = "SzlA6KKCD4miw0CR9";
    try {
      const templateParams = {
        to_email: clienteSelecionado.email || 'contato@cliente.pt',
        to_name: clienteSelecionado.name,
        mes_referencia: portalMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
        total_horas: totalHoras,
        link_unico: modalLinkUnico
      };
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
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
    if (rejeitarMotivo.trim().length < 10) { alert('Por favor, insira um motivo com pelo menos 10 caracteres.'); return; }
    const targetClient = clients.find(c => String(c.id) === String(rejeitarNotif.target_client_id));
    let rawTargetMonth = rejeitarNotif.payload?.month || '';
    if (rawTargetMonth && !rawTargetMonth.match(/^\d{4}-\d{2}$/)) {
      const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      const lowerMonth = rawTargetMonth.toLowerCase();
      const monthIdx = months.findIndex(m => lowerMonth.includes(m));
      const yearMatch = rawTargetMonth.match(/\d{4}/);
      if (monthIdx >= 0 && yearMatch) rawTargetMonth = `${yearMatch[0]}-${String(monthIdx + 1).padStart(2, '0')}`;
    }
    const monthLabel = (rejeitarNotif.message.match(/Período: (.+)\n/)?.[1] || rawTargetMonth || '').trim();
    const rejectNotifId = "reject_" + Date.now();
    const fbNotifData = {
      id: rejectNotifId,
      title: `Reporte de Divergência Rejeitado: ${monthLabel || rawTargetMonth || ''}`,
      message: `O seu reporte de divergência referente ao período de ${monthLabel || rawTargetMonth || ''} foi rejeitado pelo administrador.\n\nMotivo: ${rejeitarMotivo.trim()}\n\nPor favor, aceda ao portal para rever e submeter um novo reporte caso necessário.`,
      type: 'error', target_type: 'client', target_client_id: String(rejeitarNotif.target_client_id),
      created_at: new Date().toISOString(), is_active: true,
      payload: { type: 'correcao_rejeitada', motivo: rejeitarMotivo.trim() }
    };
    const monthFromMsg = rejeitarNotif.message.match(/Período: (.+)\n/)?.[1] || '';
    if (!rawTargetMonth && monthFromMsg) {
      const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      const lowerMonth = monthFromMsg.toLowerCase();
      const monthIdx = months.findIndex(m => lowerMonth.includes(m));
      const yearMatch = monthFromMsg.match(/\d{4}/);
      if (monthIdx >= 0 && yearMatch) rawTargetMonth = `${yearMatch[0]}-${String(monthIdx + 1).padStart(2, '0')}`;
    }
    await saveToDb('app_notifications', rejectNotifId, fbNotifData);
    if (targetClient?.email) await sendNotificationEmail(targetClient.email, targetClient.name, fbNotifData.title, fbNotifData.message, rejeitarNotif.target_client_id, rawTargetMonth);
    if (rejeitarNotif.payload?.correcao_id) {
      const existingCorrecao = correcoesCorrections.find(c => c.id === rejeitarNotif.payload.correcao_id);
      if (existingCorrecao) await saveToDb('correcoes', rejeitarNotif.payload.correcao_id, { ...existingCorrecao, status: 'rejected' });
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
    const existingLogs = logs.filter(l => String(l.workerId) === String(wId) && l.date === dateToSave && String(l.clientId) === String(formData.clientId) && l.id !== logId);
    for (const log of existingLogs) {
      const existingStart = toMins(log.startTime);
      const existingEnd = toMins(log.endTime);
      if (newStart < existingEnd && newEnd > existingStart) { alert(`Já existe um registo das ${log.startTime} às ${log.endTime} nesse dia.`); return; }
    }
    saveToDb('logs', logId, { ...formData, date: dateToSave, hours, workerId: wId, id: logId });
    if (isMain) { const resetClientId = currentUser?.role === 'worker' ? (currentUser.defaultClientId || '') : ''; setMainFormData(prev => ({ ...prev, description: '', startTime: '', breakStart: '', breakEnd: '', endTime: '', clientId: resetClientId })); }
  };

  const handleApproveMonth = (workerId) => { const monthStr = toISODateLocal(currentMonth).substring(0, 7); const id = "appr_" + workerId + "_" + monthStr; saveToDb('approvals', id, { id, workerId, month: monthStr, timestamp: new Date().toISOString() }); };

  const urlClient = null, urlMonth = null;

  return (
    <div className="text-slate-900 bg-slate-50 min-h-screen font-sans">
      {(view === 'admin' || view === 'worker') && currentUser && myNotifications.length > 0 && (
        <div className="fixed top-4 left-4 right-4 z-[9999] pointer-events-none space-y-3 max-w-xl mx-auto">
          {myNotifications.map(notif => (
            <div key={notif.id} onClick={() => handleBannerClick(notif)} className={`pointer-events-auto animate-in slide-in-from-top-4 duration-700 ${notif.title?.includes('Pedido de Correção') ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all' : ''}`}>
              <div className={`rounded-[2rem] p-0.5 shadow-2xl ${notif.type === 'urgent' ? 'bg-gradient-to-br from-rose-500 to-red-600' : notif.type === 'warning' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : notif.type === 'success' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-indigo-500 to-violet-600'}`}>
                <div className="bg-white/95 backdrop-blur-md rounded-[1.95rem] p-4 shadow-inner">
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-2xl ${notif.type === 'urgent' ? 'bg-rose-50 text-rose-600' : notif.type === 'warning' ? 'bg-amber-50 text-amber-600' : notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      {notif.type === 'urgent' ? <AlertCircle size={20} /> : <Megaphone size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">{notif.title}</h3>
                      <p className="text-[10px] font-bold text-slate-500 mt-0.5 leading-tight line-clamp-1">{notif.title.includes('Pedido de Correção') ? notif.message.split('\n')[0] : notif.message}</p>
                    </div>
                    {notif.is_dismissible && <button onClick={(e) => { e.stopPropagation(); handleDismissNotif(notif.id); }} className="p-1.5 text-slate-300 hover:text-slate-600 transition-all hover:bg-slate-50 rounded-xl"><X size={18} /></button>}
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
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
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
          {...{ onLogout: handleLogout, onLogin: handleLogin, currentUser, setCurrentUser, currentMonth, setCurrentMonth, logs, clients, schedules: [], personalSchedules: [], mainFormData, setMainFormData, handleSaveEntry, saveToDb, handleDelete, approvals, handleApproveMonth, systemSettings, documents, appNotifications }}
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
              data={{ client: clients.find(c => c.id === urlClient), logs, workers, clients, month: urlMonth, workerId, isGlobal: isGlobal && !workerId, clientApprovals }}
              isEmbedded={true}
              onBack={() => { }}
            />
          )}
        />
      )}
      {showFinReport && <FinancialReportOverlay {...{ logs, workers, clients, expenses, finFilter, setFinFilter, setShowFinReport }} />}
      {modalEmailAberto && clienteSelecionado && (() => {
        const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
        const modalLinkUnico = clienteSelecionado.link_gerado || `${window.location.origin}${window.location.pathname}?view=client_portal&client=${clienteSelecionado.id}&month=${monthStr}`;
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl border border-indigo-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <h3 className="font-black text-xl text-slate-800 flex items-center gap-3"><Mail size={24} className="text-indigo-600" /> Disparar E-mail para {clienteSelecionado.name}</h3>
                <button onClick={() => setModalEmailAberto(false)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><X size={20} /></button>
              </div>
              <div className="p-6 bg-slate-50 space-y-4">
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-2">
                  <div className="flex gap-2 text-sm"><span className="font-black text-slate-400 uppercase text-[10px] tracking-widest w-16">De:</span><span className="font-medium text-slate-700">nao-responder@magneticplace.pt</span></div>
                  <div className="flex gap-2 text-sm"><span className="font-black text-slate-400 uppercase text-[10px] tracking-widest w-16">Para:</span><span className="font-bold text-indigo-700">{clienteSelecionado.email || 'cliente@exemplo.pt'}</span></div>
                  <div className="flex gap-2 text-sm"><span className="font-black text-slate-400 uppercase text-[10px] tracking-widest w-16">Assunto:</span><span className="font-medium text-slate-700">Aprovação de Horas Magnetic Place - {currentMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</span></div>
                </div>
                <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="flex justify-center mb-8 pb-6 border-b-2 border-slate-50"><img src="/MAGNETIC (3).png" alt="Logo" className="h-10 object-contain" /></div>
                  <h4 className="font-black text-lg text-slate-800 mb-4">Olá {clienteSelecionado.name},</h4>
                  <p className="text-slate-600 text-sm leading-relaxed mb-6">Os relatórios de serviço referentes ao período de <strong className="font-black text-indigo-700">{currentMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</strong> já estão disponíveis para a sua revisão e aprovação.</p>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8"><p className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em] mb-1">Total Registado</p><p className="text-2xl font-black text-indigo-700">{formatHours(logs.filter(l => l.clientId === clienteSelecionado.id).reduce((acc, l) => acc + l.hours, 0))} <span className="text-base font-bold">horas</span></p></div>
                  <p className="text-slate-500 text-xs leading-relaxed mb-8">Para rever em detalhe as datas, horas, e trabalhadores associados a este período, por favor utilize o botão abaixo:</p>
                  <div className="text-center mb-10"><div className="inline-block bg-indigo-600 text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200">Aceder ao Portal de Validação</div></div>
                  <div className="pt-8 border-t border-slate-100 text-center"><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Equipa Magnetic Place</p></div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white">
                <button onClick={() => setModalEmailAberto(false)} disabled={isSendingEmail} className="px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100 transition-all border border-slate-200">Cancelar</button>
                <button onClick={handleDisparoEmail} disabled={isSendingEmail} className="px-6 py-3 rounded-xl font-black text-xs uppercase text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50">{isSendingEmail ? <><Loader2 size={16} className="animate-spin" /> A processar...</> : <><Send size={16} /> Confirmar e Disparar</>}</button>
              </div>
            </div>
          </div>
        );
      })()}
      {modalRejeitarAberto && rejeitarNotif && (() => {
        const targetClient = clients.find(c => String(c.id) === String(rejeitarNotif.target_client_id));
        const monthLabel = (rejeitarNotif.message.match(/Período: (.+)\n/)?.[1] || rejeitarNotif.payload?.month || '').trim();
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl border border-rose-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="flex justify-between items-center p-6 border-b border-rose-100">
                <h3 className="font-black text-xl text-rose-600 flex items-center gap-3"><XCircle size={24} /> Rejeitar Correção</h3>
                <button onClick={() => setModalRejeitarAberto(false)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><X size={20} /></button>
              </div>
              <div className="p-6 bg-slate-50 space-y-4">
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-2">
                  <div className="flex gap-2 text-sm"><span className="font-black text-slate-400 uppercase text-[10px] tracking-widest w-16">Para:</span><span className="font-bold text-rose-700">{targetClient?.name || 'Cliente'}</span></div>
                  <div className="flex gap-2 text-sm"><span className="font-black text-slate-400 uppercase text-[10px] tracking-widest w-16">E-mail:</span><span className="font-medium text-slate-700">{targetClient?.email || 'Não definido'}</span></div>
                  <div className="flex gap-2 text-sm"><span className="font-black text-slate-400 uppercase text-[10px] tracking-widest w-16">Período:</span><span className="font-medium text-slate-700">{monthLabel || rejeitarNotif.payload?.month || ''}</span></div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Motivo da Rejeição *</label>
                  <textarea value={rejeitarMotivo} onChange={e => setRejeitarMotivo(e.target.value)} placeholder="Descreva o motivo pelo qual esta correção está a ser rejeitada..." rows={4} className="w-full border border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 resize-none" />
                  <p className="text-[10px] text-slate-400 mt-2 text-right">{rejeitarMotivo.length} caracteres (mínimo 10)</p>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                  <p className="text-[10px] font-black uppercase text-rose-400 tracking-widest mb-2">Pré-visualização do E-mail</p>
                  <div className="bg-white rounded-lg p-4 text-sm space-y-2">
                    <p className="font-bold text-slate-800">Assunto: Reporte de Divergência Rejeitado: {monthLabel || ''}</p>
                    <p className="text-slate-600 text-xs leading-relaxed">{rejeitarMotivo.trim().length >= 10 ? <>O seu reporte de divergência referente ao período de <strong>{monthLabel || ''}</strong> foi rejeitado pelo administrador.<br /><br /><strong>Motivo:</strong> {rejeitarMotivo.trim()}</> : <span className="text-amber-500">Aguarde... Insira o motivo da rejeição.</span>}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white">
                <button onClick={() => setModalRejeitarAberto(false)} className="px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100 transition-all border border-slate-200">Cancelar</button>
                <button onClick={handleConfirmarRejeicao} disabled={rejeitarMotivo.trim().length < 10} className="px-6 py-3 rounded-xl font-black text-xs uppercase text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><XCircle size={16} /> Confirmar Rejeição</button>
              </div>
            </div>
          </div>
        );
      })()}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[300] animate-in slide-in-from-right fade-in duration-300">
          <div className="bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 font-bold text-sm"><CheckCircle size={20} className="text-emerald-200" />{toastMessage}</div>
        </div>
      )}
    </div>
  );
}
