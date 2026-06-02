import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { WorkerProvider, useWorker } from './contexts/WorkerContext';
import { useApp } from '../../context/AppContext';
import {
  Clock, ChevronLeft, ChevronRight, Calendar, CheckCircle,
  LogOut, LogIn, Timer, TrendingUp, Edit2, Save, Plus, Users,
  AlertCircle, Briefcase, FileText, Trash2, UserCircle, Coffee, Star, Zap, ChevronUp, ChevronDown, Loader2, Sparkles, Download, LayoutGrid, MapPin, Navigation
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
import { roundTimeToIntervalTimeUp, roundTimeToIntervalTimeDown } from '../../utils/timeUtils';

import { getCurrentPosition, isWithinGeofence, distanceMeters } from '../../utils/geoUtils';
import CompanyLogo from '../../components/common/CompanyLogo';
import EntryForm from '../../components/common/EntryForm';
import WorkerDocuments from '../../components/common/WorkerDocuments';
import WorkerProfile from './WorkerProfile';
import RequestEntryCard from '../../components/worker/RequestEntryCard';


const WorkerDashboardContent = ({ onLogout, onLogin }) => {
  const {
    currentUser,
    currentMonth,
    setCurrentMonth,
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
    mainFormData, setMainFormData,
    showProgress, setShowProgress,
    expandedDays, setExpandedDays,
    monthLogs,
    todayHours,
    totalMonthHours,
    activeWorkerSchedule,
    expectedHours,
    daysList,
    assigned,
    currentMonthStr,
    myApproval,
    pendingApprovals,
    handleDismissNotif,
    handleOpenInlineForm,
    handleOpenInlineFormDelete,
    handleQuickRegister,
    setDefaultSchedule,
    handleSaveEntry,
    saveToDb,
    handleDelete,
    handleApproveMonth
  } = useWorker();

  const { setCurrentUser, workerChangeRequests } = useApp();
  const [workerTab, setWorkerTab] = useState('home');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoSuggestion, setGeoSuggestion] = useState(null); // { type, within, dist, lat, lng, client, logId }
  const [geoSuggestionDismissed, setGeoSuggestionDismissed] = useState(false);
  const [geoActionLoading, setGeoActionLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { date, logId }

  const isLimitedWorker = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.limited_entry_mode) return true;
    if (currentUser.assignedClients?.some(cid => {
      const client = clients.find(c => c.id === cid);
      return client?.triggers_limited_mode === true;
    })) return true;
    return false;
  }, [currentUser, clients]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const handleSaveWithGeoCheck = async (formData, isMain, ds) => {
    const client = clients.find(c => c.id === formData.clientId);
    let enriched = formData;
    if (client?.lat != null && client?.lng != null) {
      setGeoLoading(true);
      try {
        const { lat, lng } = await getCurrentPosition();
        const within = isWithinGeofence(lat, lng, client.lat, client.lng, client.geo_radius_m ?? 200);
        if (!within) {
          const dist = Math.round(distanceMeters(lat, lng, client.lat, client.lng));
          const ok = window.confirm(`Estás a ${dist} m da unidade (raio: ${client.geo_radius_m ?? 200} m). Confirmas o registo na mesma?`);
          if (!ok) { setGeoLoading(false); return; }
        }
        enriched = { ...formData, check_in_lat: lat, check_in_lng: lng, geo_verified: within };
      } catch (err) {
        console.warn('[WorkerDashboard] GPS unavailable:', err.message);
      } finally {
        setGeoLoading(false);
      }
    }
    handleSaveEntry(enriched, isMain, ds, (resetClientId) => {
      setMainFormData({ id: null, date: toISODateLocal(new Date()), clientId: resetClientId || currentUser?.defaultClientId || '', startTime: '', breakStart: '', breakEnd: '', endTime: '', description: '' });
    });
  };

  // Sugestão de entrada/saída ao abrir o portal
  useEffect(() => {
    if (!currentUser || geoSuggestionDismissed) return;
    const client = clients.find(c => c.id === currentUser.defaultClientId);
    if (!client) return;

    const today = new Date().toLocaleDateString('en-CA');
    const todayWorkerLogs = logs.filter(l =>
      l.date === today &&
      String(l.workerId) === String(currentUser.id) &&
      String(l.clientId) === String(currentUser.defaultClientId)
    );
    const openLog = todayWorkerLogs.find(l => l.startTime && !l.endTime);

    // Para limitados sem GPS - definir geoSuggestion imediatamente sem esperar GPS
    if (isLimitedWorker && currentUser.gps_enabled !== true) {
      if (openLog) {
        setGeoSuggestion({ type: 'saida', within: null, dist: null, lat: null, lng: null, client, logId: openLog.id, startTime: openLog.startTime });
      } else {
        setGeoSuggestion({ type: 'entrada', within: null, dist: null, lat: null, lng: null, client });
      }
      return;
    }

    // Para workers com GPS ou não limitados - lógica existente
    if (currentUser.gps_enabled !== true) return;

    // Mostrar card imediatamente (sem GPS)
    if (openLog) {
      setGeoSuggestion({ type: 'saida', within: null, dist: null, lat: null, lng: null, client, logId: openLog.id, startTime: openLog.startTime });
    } else {
      setGeoSuggestion({ type: 'entrada', within: null, dist: null, lat: null, lng: null, client });
    }

    // Enriquecer com GPS se disponível e coordenadas configuradas
    if (client.lat != null && client.lng != null) {
      getCurrentPosition()
        .then(({ lat, lng }) => {
          const within = isWithinGeofence(lat, lng, client.lat, client.lng, client.geo_radius_m ?? 200);
          const dist = Math.round(distanceMeters(lat, lng, client.lat, client.lng));
          if (openLog) {
            setGeoSuggestion(prev => prev ? { ...prev, within, dist, lat, lng } : prev);
          } else {
            setGeoSuggestion(prev => prev ? { ...prev, within, dist, lat, lng } : prev);
          }
        })
        .catch(() => {}); // GPS indisponível — card fica sem info de distância
    }
  }, [currentUser?.id, logs.length, isLimitedWorker, currentUser?.gps_enabled]);

const getClientTime = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    const tz = client?.timezone || 'Europe/Madrid';
    const now = new Date();
    const time = now.toLocaleTimeString('pt-PT', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    const date = now.toLocaleDateString('en-CA', { timeZone: tz });
    return { time, date };
  };

  const nowTimeStrForEntry = () => {
    const clientId = currentUser?.defaultClientId;
    if (!clientId) {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    return getClientTime(clientId).time;
  };

  const nowTimeStrForExit = () => {
    const clientId = currentUser?.defaultClientId;
    if (!clientId) {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    return getClientTime(clientId).time;
};

  const nowTimeStr = nowTimeStrForEntry; // backwards compat if needed

  const handleConfirmGeoSuggestion = async () => {
    if (!geoSuggestion || !currentUser) return;
    setGeoActionLoading(true);
    const entryTime = nowTimeStrForEntry();
    const exitTime = nowTimeStrForExit();
    const today = new Date().toLocaleDateString('en-CA');

    try {
      // Capturar GPS no momento do clique (mais fiável que no momento do card)
      const pos = await getGpsSilent();
      const client = geoSuggestion.client;
      const lat = pos?.lat ?? null;
      const lng = pos?.lng ?? null;
      let verified = null;
      if (pos && client?.lat != null && client?.lng != null) {
        verified = isWithinGeofence(lat, lng, client.lat, client.lng, client.geo_radius_m ?? 200);
      }

      if (geoSuggestion.type === 'entrada') {
        const logId = `l${Date.now()}`;
        await saveToDb('logs', logId, {
          id: logId,
          date: today,
          workerId: currentUser.id,
          clientId: currentUser.defaultClientId,
          startTime: entryTime,
          endTime: null,
          breakStart: null,
          breakEnd: null,
          hours: 0,
          description: '',
          check_in_lat: lat,
          check_in_lng: lng,
          geo_verified: verified,
        });
      } else {
        const existingLog = logs.find(l => l.id === geoSuggestion.logId);
        if (existingLog) {
          const interval = systemSettings?.minuteInterval || 30;
          const roundedStart = roundTimeToIntervalTimeUp(existingLog.startTime, interval);
          const roundedEnd = roundTimeToIntervalTimeDown(exitTime, interval);
          const hours = calculateDuration(roundedStart, roundedEnd, existingLog.breakStart, existingLog.breakEnd);
          await saveToDb('logs', existingLog.id, {
            ...existingLog,
            endTime: exitTime,
            hours,
            check_out_lat: lat,
            check_out_lng: lng,
          });
        }
      }
      setGeoSuggestion(null);
      setGeoSuggestionDismissed(false);
    } finally {
      setGeoActionLoading(false);
    }
  };

  const getGpsSilent = async () => {
    try { return await getCurrentPosition(); } catch { return null; }
  };

  const handleRegistarPausa = async (tipo) => {
    if (!todayOpenLog) return;
    const timeStr = tipo === 'inicio' ? nowTimeStrForEntry() : nowTimeStrForExit();
    const pos = await getGpsSilent();
    const updates = tipo === 'inicio'
      ? { breakStart: timeStr, break_start_lat: pos?.lat ?? null, break_start_lng: pos?.lng ?? null }
      : { breakEnd: timeStr, break_end_lat: pos?.lat ?? null, break_end_lng: pos?.lng ?? null };
    await saveToDb('logs', todayOpenLog.id, { ...todayOpenLog, ...updates });
  };

  const handleRegistarSaida = async () => {
    if (!todayOpenLog) return;
    setGeoActionLoading(true);
    try {
      const pos = await getGpsSilent();
      const exitTime = nowTimeStrForExit();
      const interval = systemSettings?.minuteInterval || 30;
      const roundedStart = roundTimeToIntervalTimeUp(todayOpenLog.startTime, interval);
      const roundedEnd = roundTimeToIntervalTimeDown(exitTime, interval);
      const hours = calculateDuration(roundedStart, roundedEnd, todayOpenLog.breakStart, todayOpenLog.breakEnd);
      await saveToDb('logs', todayOpenLog.id, {
        ...todayOpenLog,
        endTime: exitTime,
        hours,
        check_out_lat: pos?.lat ?? null,
        check_out_lng: pos?.lng ?? null,
      });
      setGeoSuggestion(null);
      setGeoSuggestionDismissed(false);
    } finally {
      setGeoActionLoading(false);
    }
  };

  const [expandedSchedules, setExpandedSchedules] = useState(() =>
    currentUser?.defaultScheduleId ? new Set([currentUser.defaultScheduleId]) : new Set()
  );
  useEffect(() => {
    if (currentUser?.defaultScheduleId) {
      setExpandedSchedules(prev => prev.has(currentUser.defaultScheduleId)
        ? prev
        : new Set([...prev, currentUser.defaultScheduleId]));
    }
  }, [currentUser?.defaultScheduleId]);
  const toggleScheduleExpand = (id) => {
    setExpandedSchedules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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

  // Helper: obter data de início do trabalhador atual
  const workerDataInicio = currentUser?.dataInicio;
  const workerStartDate = workerDataInicio
    ? new Date(workerDataInicio)
    : null;

  const formatElapsed = (startTimeStr) => {
    const [h, m] = startTimeStr.split(':').map(Number);
    const start = new Date(now);
    start.setHours(h, m, 0, 0);
    const diffMins = Math.max(0, Math.floor((now - start) / 60000));
    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `${diffMins} min`;
    const hh = Math.floor(diffMins / 60);
    const mm = diffMins % 60;
    return mm > 0 ? `${hh}h ${mm}min` : `${hh}h`;
  };

  const todayStr = toISODateLocal(new Date());
  const todayOpenLog = !myApproval && logs.find(l =>
    l.date === todayStr &&
    String(l.workerId) === String(currentUser?.id) &&
    l.startTime && !l.endTime
  );

  // gps_enabled field controlled in Supabase worker record
  const gpsCheckInEnabled = currentUser?.gps_enabled === true;

  // Filtrar pendingApprovals - só meses >= dataInicio
  const filteredPendingApprovals = pendingApprovals.filter(pending => {
    if (!workerStartDate) return true; // Sem data de início = sem filtro
    const pendingMonth = new Date(pending.date);
    const pendingMonthStart = new Date(pendingMonth.getFullYear(), pendingMonth.getMonth(), 1);
    return pendingMonthStart >= workerStartDate;
  });

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
        <button onClick={() => { setWorkerTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-3 hover:opacity-75 transition-opacity">
          <CompanyLogo className="h-10 w-10 object-contain" />
          <div className="flex flex-col">
            <p className="text-sm sm:text-base font-black leading-none text-slate-800 uppercase tracking-tight">{formatShortName(currentUser?.name)}</p>
            <p className="text-[9px] sm:text-[10px] text-indigo-500 uppercase font-black tracking-widest mt-1">
              {currentUser?.profissao || 'Colaborador'}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => setWorkerTab(t => t === 'horarios' ? 'home' : 'horarios')} className={`flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-xl text-xs font-black shadow-sm ${workerTab === 'horarios' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
            {activeWorkerSchedule && (
              <span className="hidden sm:inline-block text-[9px] sm:text-xs opacity-70 border-r border-indigo-200 pr-2 mr-1 leading-tight text-right uppercase">
                <span className="block">{formatTimeCompact(activeWorkerSchedule.startTime)} - {formatTimeCompact(activeWorkerSchedule.endTime)}</span>
                {activeWorkerSchedule.breakStart && (
                  <span className="block text-[8px] sm:text-[9px] font-bold text-indigo-400/80">P: {formatTimeCompact(activeWorkerSchedule.breakStart)}-{formatTimeCompact(activeWorkerSchedule.breakEnd)}</span>
                )}
              </span>
            )}
            <Timer size={16} className="shrink-0" />
            <span className="hidden sm:inline">Meus Horários</span>
          </button>
          <button
            onClick={() => setWorkerTab(t => t === 'perfil' ? 'home' : 'perfil')}
            className={`p-2 rounded-xl transition-all relative ${workerTab === 'perfil' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}
            title="Meu Perfil"
          >
            <UserCircle size={18} />
            {(workerChangeRequests || []).filter(r => r.worker_id === currentUser?.id && r.status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full text-[8px] font-black text-white flex items-center justify-center">
                {(workerChangeRequests || []).filter(r => r.worker_id === currentUser?.id && r.status === 'pending').length}
              </span>
            )}
          </button>
          {currentUser?.isAdmin && !currentUser?.isAdminImpersonating && <button onClick={() => onLogin('admin', currentUser)} className="flex items-center justify-center p-2 bg-indigo-600 text-white rounded-xl shadow-sm hover:bg-indigo-700 transition-all"><Users size={18} /></button>}
          <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-600 transition-all"><LogOut size={18} /></button>
        </div>
      </nav>
      <main className="mx-auto px-4 sm:px-6 md:px-10 lg:px-16 mt-6 md:mt-8" style={{ maxWidth: 'var(--app-max-width)' }}>
        {workerTab === 'perfil' && (
          <WorkerProfile
            worker={currentUser}
            changeRequests={(workerChangeRequests || []).filter(r => r.worker_id === currentUser?.id)}
            documents={(documents || []).filter(d => (d.workerId === currentUser?.id || d.worker_id === currentUser?.id) && d.status !== 'Rascunho')}
          />
        )}
        {workerTab === 'horarios' && (
          <div className="animate-in slide-in-from-top-4 duration-300">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6 max-w-2xl">
              <h3 className="text-base sm:text-lg font-black flex items-center gap-2 mb-5 border-b pb-3"><Timer className="text-indigo-600" size={18} /> Meus Horários</h3>
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pela Empresa</h4>
                <div className="space-y-1.5">
                  {assigned.length > 0 ? assigned.map(s => {
                    const isExpanded = expandedSchedules.has(s.id);
                    return (
                      <div key={s.id} onClick={() => toggleScheduleExpand(s.id)} className={`p-3 rounded-xl border cursor-pointer hover:shadow-sm transition-all flex flex-col gap-2 ${currentUser?.defaultScheduleId === s.id ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <p className="text-xs font-black truncate">{s.name}</p>
                            {isExpanded ? <ChevronUp size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-300 flex-shrink-0" />}
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setDefaultSchedule(s.id); }} title="Definir como Padrão" className={`p-2 rounded-xl transition-all flex-shrink-0 ${currentUser?.defaultScheduleId === s.id ? 'text-amber-500 bg-amber-100' : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100'}`}>
                            <Star fill={currentUser?.defaultScheduleId === s.id ? 'currentColor' : 'none'} size={16} />
                          </button>
                        </div>
                        {isExpanded && (
                          <div>
                            {s.isAdvanced ? (
                              <div className="space-y-1">
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
                        )}
                      </div>
                    );
                  }) : <p className="text-xs text-slate-400 italic">Sem turnos atribuídos.</p>}
                </div>
              </div>
            </div>
          </div>
        )}
        {workerTab === 'home' && (<>
        {filteredPendingApprovals.map((pending, idx) => {
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

        {(documents || []).filter(d => !d.signed_at && d.workerId === currentUser?.id && d.status !== 'Rascunho').length > 0 && (
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
            <div className="text-3xl md:text-5xl font-black mb-4 leading-tight text-white text-center md:text-left uppercase tracking-tighter">Olá, {currentUser?.name?.split(' ')[0]}!</div>
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

        {/* CARD EM SERVIÇO */}
        {gpsCheckInEnabled && todayOpenLog && (
          <div className="mb-6 bg-indigo-600 rounded-[2rem] shadow-xl shadow-indigo-200 overflow-hidden animate-in slide-in-from-top-4 duration-500">
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Timer size={28} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Em serviço desde {todayOpenLog.startTime}</p>
                  <p className="text-white font-black text-2xl leading-tight">{formatElapsed(todayOpenLog.startTime)}</p>
                  <p className="text-indigo-200 text-sm font-bold mt-0.5">
                    {clients.find(c => String(c.id) === String(todayOpenLog.clientId))?.name || 'Unidade'}
                  </p>
                </div>
                <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse flex-shrink-0" />
              </div>

              {/* Pausa info */}
              {todayOpenLog.breakStart && !todayOpenLog.breakEnd && (
                <div className="bg-amber-400/20 border border-amber-300/30 rounded-xl px-4 py-2 flex items-center gap-2">
                  <Coffee size={14} className="text-amber-200" />
                  <span className="text-amber-100 text-sm font-bold">Em pausa desde {todayOpenLog.breakStart} · {formatElapsed(todayOpenLog.breakStart)}</span>
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-2 flex-wrap">
                {/* Pausa */}
                {!todayOpenLog.breakStart && (
                  <button onClick={() => handleRegistarPausa('inicio')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide bg-white/15 hover:bg-white/25 text-white transition-all active:scale-95">
                    <Coffee size={14} /> Iniciar Pausa
                  </button>
                )}
                {todayOpenLog.breakStart && !todayOpenLog.breakEnd && (
                  <button onClick={() => handleRegistarPausa('fim')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide bg-amber-400/30 hover:bg-amber-400/50 text-amber-100 transition-all active:scale-95">
                    <Coffee size={14} /> Terminar Pausa
                  </button>
                )}
                {/* Saída */}
                <button onClick={handleRegistarSaida} disabled={geoActionLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide bg-rose-500 hover:bg-rose-600 text-white transition-all active:scale-95 shadow-sm disabled:opacity-50">
                  {geoActionLoading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  Registar Saída
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CARD ENTRADA / SAÍDA — só aparece se não há já um log em aberto (nesse caso o card "Em serviço" trata de tudo) */}
        {geoSuggestion && !geoSuggestionDismissed && !todayOpenLog && (
          <div className={`mb-6 rounded-[2rem] border shadow-xl overflow-hidden animate-in slide-in-from-top-4 duration-500 ${geoSuggestion.within === false ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className="p-6 flex flex-col md:flex-row items-center gap-5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${geoSuggestion.within === false ? 'bg-amber-400 text-white' : 'bg-emerald-500 text-white'}`}>
                {geoSuggestion.type === 'entrada' ? <LogIn size={26} /> : <LogOut size={26} />}
              </div>
              <div className="flex-1 text-center md:text-left">
                {geoSuggestion.dist != null && (
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${geoSuggestion.within === false ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {geoSuggestion.within ? `Na unidade · ${geoSuggestion.dist} m` : `A ${geoSuggestion.dist} m da unidade`}
                  </p>
                )}
                <p className="text-slate-800 font-black text-lg leading-tight">
                  {geoSuggestion.type === 'entrada'
                    ? `Registar chegada em ${geoSuggestion.client.name}?`
                    : `Registar saída de ${geoSuggestion.client.name}?`}
                </p>
                {geoSuggestion.type === 'saida' && geoSuggestion.startTime && (
                  <p className="text-sm text-slate-500 font-bold mt-0.5">Entrada registada às {geoSuggestion.startTime}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={handleConfirmGeoSuggestion}
                  disabled={geoActionLoading}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm uppercase tracking-wide text-white transition-all active:scale-95 shadow-sm ${geoSuggestion.within === false ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:opacity-50`}
                >
                  {geoActionLoading ? <Loader2 size={16} className="animate-spin" /> : (geoSuggestion.type === 'entrada' ? <LogIn size={16} /> : <LogOut size={16} />)}
                  {geoSuggestion.type === 'entrada' ? 'Registar Entrada' : 'Registar Saída'}
                </button>
                <button
                  onClick={() => { setGeoSuggestion(null); setGeoSuggestionDismissed(true); }}
                  className="px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wide text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
                >
                  Ignorar
                </button>
              </div>
            </div>
          </div>
        )}

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
            {isLimitedWorker ? (
              <RequestEntryCard
                currentUser={currentUser}
                logs={logs}
                clients={clients}
                monthLogs={monthLogs}
                onSuccess={() => {
                  setSuccessMsg('Pedido submetido com sucesso!');
                  setTimeout(() => setSuccessMsg(''), 6000);
                }}
              />
            ) : (
              <EntryForm
                data={mainFormData}
                clients={clients}
                assignedClients={currentUser?.assignedClients}
                onChange={setMainFormData}
                onSave={async () => {
                  await handleSaveWithGeoCheck(mainFormData, true);
                  if (mainFormData.clientId && mainFormData.startTime && mainFormData.endTime) {
                    setSuccessMsg('Registo inserido com sucesso!');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setTimeout(() => setSuccessMsg(''), 6000);
                  }
                }}
                onCancel={() => {
                  setMainFormData({ id: null, date: toISODateLocal(new Date()), clientId: currentUser?.defaultClientId || '', startTime: '', breakStart: '', breakEnd: '', endTime: '', description: '' });
                }}
                showDate
                systemSettings={systemSettings}
                title="Novo Registo de Atividade"
              />
            )}
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
              const dayTotalTotal = dayLogs.reduce((acc, l) => acc + (l.hours || 0), 0);
              const isCurrentInline = inlineEditingDate === ds;
              const isExpanded = expandedDays.includes(ds);
              const dObj = new Date(ds);
              const dayDate = new Date(ds);
              const isDayBeforeStart = workerStartDate && dayDate < workerStartDate;

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
                        <span className="text-[10px] uppercase font-bold text-slate-400">{['DOM','SEG','TER','QUA','QUI','SEX','SÁB'][dObj.getDay()]}</span>
                      </div>
                      <div className="flex-1 flex items-center justify-between md:justify-start gap-4">
                        {dayTotalTotal > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wide">{formatHours(dayTotalTotal)} registradas</span>
                            {!isExpanded && <span className="text-[10px] text-slate-300 font-bold hidden lg:inline">• Detalhes</span>}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Sem registos</span>
                        )}
                      </div>
                      <div className="flex justify-end items-center gap-2">
                        {(!myApproval && !isDayBeforeStart && !isLimitedWorker) && (
                          <div className="flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); handleQuickRegister(ds); }} title="Registo Rápido" className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-xl transition-all shadow-sm"><Zap size={16} /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleOpenInlineForm(ds); }} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm"><Plus size={16} /></button>
                          </div>
                        )}
                        {isLimitedWorker && (
                          <button onClick={(e) => { e.stopPropagation(); handleOpenInlineForm(ds); }} className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-xl transition-all shadow-sm"><Plus size={16} /></button>
                        )}
                        {isDayBeforeStart && (
                          <span className="text-[10px] text-slate-300 font-bold">Indisponível</span>
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
                        {dayLogs.length > 0 && (
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
                                  <span className="text-lg sm:text-sm font-black text-indigo-700">{formatHours(log.hours || 0)}</span>
                                  {!myApproval && !isLimitedWorker && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete('logs', log.id); }} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm"><Trash2 size={18} /></button>
                                  )}
                                  {isLimitedWorker && (
                                    <div className="flex gap-1">
                                      <button onClick={() => { handleOpenInlineForm(ds); }} className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all shadow-sm"><Edit2 size={16} /></button>
                                      <button onClick={() => { setDeleteConfirm({ date: ds, logId: log.id }); }} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm"><Trash2 size={16} /></button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {isLimitedWorker && isCurrentInline && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                              <RequestEntryCard
                                currentUser={currentUser}
                                logs={logs}
                                clients={clients}
                                monthLogs={monthLogs}
                                initialDate={ds}
                                isInline={true}
                                onSuccess={() => {
                                  setInlineEditingDate(null);
                                  setSuccessMsg('Pedido submetido com sucesso!');
                                  setTimeout(() => setSuccessMsg(''), 6000);
                                }}
                              />
                            </div>
                          )}

                          {!isLimitedWorker && isCurrentInline && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                              <EntryForm
                                isInline
                                data={inlineFormData}
                                clients={clients}
                                assignedClients={currentUser?.assignedClients}
                                onChange={setInlineFormData}
                                onSave={async () => { await handleSaveWithGeoCheck(inlineFormData, false, ds); setInlineEditingDate(null); }}
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
            <WorkerDocuments currentUser={currentUser} documents={documents} saveToDb={saveToDb} pendingOnly={false} />
          </div>

          {deleteConfirm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <h3 className="text-lg font-black text-slate-800 mb-2">Confirmar pedido de exclusão</h3>
                <p className="text-sm text-slate-600 mb-6">Ao confirmar, será enviado um pedido para eliminar o registo de <strong>{deleteConfirm.date}</strong>. O administrador analisará o pedido.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-bold text-sm uppercase hover:bg-slate-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      const log = logs.find(l => l.id === deleteConfirm.logId);
                      if (!log) { setDeleteConfirm(null); return; }
                      const correctionId = `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                      const now = new Date().toISOString();
                      try {
                        await saveToDb('corrections', correctionId, {
                          id: correctionId,
                          client_id: String(log.clientId),
                          month: deleteConfirm.date.substring(0, 7),
                          type: 'deletion_request',
                          status: 'submitted',
                          submitted_at: now,
                          submitted_by: String(currentUser?.id),
                          justification: `Pedido de eliminação do registo de ${deleteConfirm.date}`
                        });
                        const itemId = `citem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                        await saveToDb('correction_items', itemId, {
                          id: itemId,
                          correction_id: correctionId,
                          worker_id: String(currentUser?.id),
                          worker_name: currentUser?.name,
                          date: deleteConfirm.date,
                          before: { startTime: log.startTime, endTime: log.endTime, breakStart: log.breakStart, breakEnd: log.breakEnd },
                          proposed: null,
                          final: null,
                          item_status: 'pending',
                        });
                        await saveToDb('app_notifications', `notif_${Date.now()}`, {
                          title: `Pedido de Eliminação · ${currentUser?.name}`,
                          message: `${currentUser?.name} solicitou eliminação do registo de ${deleteConfirm.date}`,
                          type: 'warning',
                          target_type: 'admin',
                          target_client_id: String(log.clientId),
                          payload: { correction_id: correctionId, kind: 'submitted' },
                          is_active: true,
                          is_dismissible: true,
                          created_at: now,
                        });
                        await saveToDb('app_notifications', `notif_${Date.now()}_client`, {
                          title: `Pedido de Eliminação · ${currentUser?.name}`,
                          message: `O Trabalhador ${currentUser?.name} solicitou eliminação do registo de ${deleteConfirm.date}.`,
                          type: 'info',
                          target_type: 'client',
                          target_client_id: String(log.clientId),
                          payload: { correction_id: correctionId, kind: 'submitted' },
                          is_active: true,
                          is_dismissible: true,
                          created_at: now,
                        });
                        setDeleteConfirm(null);
                        setSuccessMsg('Pedido de exclusão submetido!');
                        setTimeout(() => setSuccessMsg(''), 4000);
                      } catch (err) {
                        alert('Erro ao submeter pedido: ' + err.message);
                      }
                    }}
                    className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-sm uppercase hover:bg-rose-700 transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          )}
          </>)}
      </main>
    </div>
  );
};

const WorkerDashboard = ({ onLogout, onLogin, handleSaveEntry }) => {
  return (
    <WorkerProvider handleSaveEntry={handleSaveEntry}>
      <WorkerDashboardContent onLogout={onLogout} onLogin={onLogin} />
    </WorkerProvider>
  );
};

export default WorkerDashboard;
