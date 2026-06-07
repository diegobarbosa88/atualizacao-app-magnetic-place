import React, { useState, useMemo, useEffect } from 'react';
import { WorkerProvider, useWorker } from './contexts/WorkerContext';
import { useApp } from '../../context/AppContext';
import {
  CheckCircle, Edit2,
  ChevronUp, ChevronDown, Trash2, Plus, Zap, X,
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { toISODateLocal, isSameMonth } from '../../utils/dateUtils';
import { formatHours } from '../../utils/formatUtils';

import EntryForm from '../../components/common/EntryForm';
import WorkerDocuments from '../../components/common/WorkerDocuments';
import WorkerProfile from './WorkerProfile';
import RequestEntryCard from '../../components/worker/RequestEntryCard';
import { DISABLE_CLIENT_NOTIFICATIONS } from '../../config';

import { useWorkerGeo } from './worker-dashboard/useWorkerGeo';
import { useWorkerCorrections } from './worker-dashboard/useWorkerCorrections';
import PendingCorrectionsPanel from './worker-dashboard/PendingCorrectionsPanel';
import DeleteConfirmModal from './worker-dashboard/DeleteConfirmModal';
import TimeEntryModal from './worker-dashboard/TimeEntryModal';
import PendingAlertsModal from './worker-dashboard/PendingAlertsModal';
import AbsenceRequestModal from './worker-dashboard/AbsenceRequestModal';
import WorkerNavBar from './worker-dashboard/WorkerNavBar';
import WorkerHeroStats from './worker-dashboard/WorkerHeroStats';
import InServiceCard from './worker-dashboard/InServiceCard';
import GeoSuggestionCard from './worker-dashboard/GeoSuggestionCard';
import WorkerScheduleTab from './worker-dashboard/WorkerScheduleTab';

const WorkerDashboardContent = ({ onLogout, onLogin }) => {
  const {
    currentUser, currentMonth, setCurrentMonth,
    logs, clients, schedules, personalSchedules,
    approvals, documents, systemSettings,
    inlineEditingDate, setInlineEditingDate,
    successMsg, setSuccessMsg,
    inlineFormData, setInlineFormData,
    mainFormData, setMainFormData,
    showProgress, setShowProgress,
    expandedDays, setExpandedDays,
    monthLogs, todayHours, totalMonthHours,
    activeWorkerSchedule, expectedHours,
    daysList, assigned, currentMonthStr,
    myApproval, pendingApprovals, previousOpenLogs,
    handleOpenInlineForm, handleQuickRegister,
    setDefaultSchedule, handleSaveEntry,
    saveToDb, handleDelete, handleApproveMonth,
  } = useWorker();

  const { setCurrentUser, workerChangeRequests, correctionItems, setCorrectionItems, corrections, supabase, absenceRequests } = useApp();
  const [workerTab, setWorkerTab] = useState('home');
  const [timeEntryModalOpen, setTimeEntryModalOpen] = useState(false);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [alertsModalDismissed, setAlertsModalDismissed] = useState(false);
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
  const [approvedAbsencesExpanded, setApprovedAbsencesExpanded] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const isLimitedWorker = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.limited_entry_mode) return true;
    return currentUser.assignedClients?.some(cid => clients.find(c => c.id === cid)?.triggers_limited_mode === true);
  }, [currentUser, clients]);

  const {
    geoLoading, geoSuggestion, setGeoSuggestion,
    geoSuggestionDismissed, setGeoSuggestionDismissed,
    geoActionLoading, handleSaveWithGeoCheck,
    handleConfirmGeoSuggestion, handleRegistarPausa, handleRegistarSaida,
  } = useWorkerGeo({ currentUser, clients, logs, systemSettings, saveToDb, isLimitedWorker, handleSaveEntry, setMainFormData });

  const {
    pendingItems, resolvedItems, pendingCollapsed, setPendingCollapsed,
    deleteConfirm, setDeleteConfirm, deleteSubmitting,
    dismissCorrection, labelKind, handleSubmitDeletion,
  } = useWorkerCorrections({ currentUser, correctionItems, setCorrectionItems, corrections, currentMonthStr, supabase, logs, setSuccessMsg });

  const dayRequestsByDate = useMemo(() => {
    const map = {};
    (correctionItems || []).forEach((item) => {
      if (String(item.worker_id) !== String(currentUser?.id)) return;
      if (!(item.date || '').startsWith(currentMonthStr)) return;
      const corr = (corrections || []).find((c) => c.id === item.correction_id);
      if (!corr) return;
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push({ item, corr });
    });
    return map;
  }, [correctionItems, corrections, currentUser?.id, currentMonthStr]);

  const [expandedSchedules, setExpandedSchedules] = useState(() =>
    currentUser?.defaultScheduleId ? new Set([currentUser.defaultScheduleId]) : new Set()
  );
  useEffect(() => {
    if (currentUser?.defaultScheduleId) {
      setExpandedSchedules(prev =>
        prev.has(currentUser.defaultScheduleId) ? prev : new Set([...prev, currentUser.defaultScheduleId])
      );
    }
  }, [currentUser?.defaultScheduleId]);
  const toggleScheduleExpand = (id) => setExpandedSchedules(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const openIncompleteLogModal = (log) => {
    setInlineEditingDate(log.date);
    setInlineFormData({
      id: log.id,
      date: log.date,
      clientId: log.clientId || currentUser?.defaultClientId || '',
      startTime: log.startTime || '',
      breakStart: log.breakStart || '',
      breakEnd: log.breakEnd || '',
      endTime: '',
      description: log.description || '',
    });
    setTimeEntryModalOpen(true);
  };

  const openTimeEntryModal = (ds) => {
    setInlineEditingDate(ds);
    setInlineFormData({
      id: null, date: ds, clientId: currentUser?.defaultClientId || '',
      startTime: '', breakStart: '', breakEnd: '', endTime: '', description: '',
    });
    setTimeEntryModalOpen(true);
  };

  const handleBulkSave = async (formData, dates) => {
    for (const date of dates) {
      await handleSaveEntry({ ...formData, date }, false, date);
    }
    setSuccessMsg(`${dates.length} registo${dates.length !== 1 ? 's' : ''} guardado${dates.length !== 1 ? 's' : ''} com sucesso!`);
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  const handleAbsenceSubmit = async (dates, reason, notes) => {
    const id = `abs_${Date.now()}`;
    await saveToDb('absence_requests', id, {
      id,
      worker_id: currentUser.id,
      worker_name: currentUser.name,
      client_id: currentUser.defaultClientId || null,
      dates,
      reason,
      notes: notes || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    const notifId = `notif_abs_${Date.now()}`;
    await saveToDb('app_notifications', notifId, {
      id: notifId,
      title: 'Aviso de Falta',
      message: `${currentUser.name} avisou falta (${dates.length} dia${dates.length !== 1 ? 's' : ''}): ${reason}`,
      type: 'warning',
      target_type: 'admin',
      payload: { absenceId: id, kind: 'absence' },
      is_dismissible: true,
      is_active: true,
      viewed_by_ids: [],
      dismissed_by_ids: [],
      read_by_admin_ids: [],
      created_at: new Date().toISOString(),
    });
    setSuccessMsg('Aviso de falta enviado com sucesso!');
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  const workerStartDate = currentUser?.dataInicio ? new Date(currentUser.dataInicio) : null;
  const todayStr = toISODateLocal(new Date());
  const todayOpenLog = !myApproval && logs.find(l =>
    l.date === todayStr && String(l.workerId) === String(currentUser?.id) && l.startTime && !l.endTime
  );

  const filteredPendingApprovals = pendingApprovals.filter(pending => {
    if (!workerStartDate) return true;
    const pendingMonthStart = new Date(new Date(pending.date).getFullYear(), new Date(pending.date).getMonth(), 1);
    return pendingMonthStart >= workerStartDate;
  });

  const pendingSignaturesCount = (documents || []).filter(d => !d.signed_at && d.workerId === currentUser?.id && d.status !== 'Rascunho').length;
  const alertCount = filteredPendingApprovals.length + (pendingSignaturesCount > 0 ? 1 : 0) + (previousOpenLogs?.length || 0);

  useEffect(() => {
    if (alertCount > 0 && !alertsModalDismissed) setAlertsModalOpen(true);
  }, [alertCount, alertsModalDismissed]);

  return (
    <div className="min-h-screen bg-slate-50 pb-32 font-sans relative">
      <WorkerNavBar
        currentUser={currentUser}
        workerTab={workerTab}
        setWorkerTab={setWorkerTab}
        activeWorkerSchedule={activeWorkerSchedule}
        workerChangeRequests={workerChangeRequests}
        onLogin={onLogin}
        onLogout={onLogout}
        alertCount={alertCount}
        onOpenAlerts={() => setAlertsModalOpen(true)}
        onOpenAbsenceModal={() => setAbsenceModalOpen(true)}
        onOpenScheduleModal={() => setScheduleModalOpen(true)}
        onOpenProfileModal={() => setProfileModalOpen(true)}
        isCurrentMonth={currentMonth.getFullYear() === new Date().getFullYear() && currentMonth.getMonth() === new Date().getMonth()}
      />

      <main className="mx-auto px-4 sm:px-6 md:px-10 lg:px-16 mt-6 md:mt-8" style={{ maxWidth: 'var(--app-max-width)' }}>
        <PendingCorrectionsPanel
          pendingItems={pendingItems} resolvedItems={resolvedItems}
          pendingCollapsed={pendingCollapsed} setPendingCollapsed={setPendingCollapsed}
          dismissCorrection={dismissCorrection} labelKind={labelKind} corrections={corrections}
        />

        {workerTab === 'perfil' && (
          <WorkerProfile
            worker={currentUser}
            changeRequests={(workerChangeRequests || []).filter(r => r.worker_id === currentUser?.id)}
            documents={(documents || []).filter(d => (d.workerId === currentUser?.id || d.worker_id === currentUser?.id) && d.status !== 'Rascunho')}
          />
        )}

        {workerTab === 'horarios' && (
          <WorkerScheduleTab
            assigned={assigned}
            currentUser={currentUser}
            expandedSchedules={expandedSchedules}
            toggleScheduleExpand={toggleScheduleExpand}
            setDefaultSchedule={setDefaultSchedule}
          />
        )}

        {workerTab === 'home' && (<>

          {filteredPendingApprovals.some(p => p.monthStr === currentMonthStr) && (
            <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle size={20} className="text-indigo-500 shrink-0" />
                <p className="text-sm font-black text-indigo-800">
                  Revê os registos abaixo e confirma as horas de {new Date(currentMonth).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}.
                </p>
              </div>
              <button
                onClick={() => handleApproveMonth(currentUser?.id)}
                className="w-full sm:w-auto shrink-0 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle size={14} /> Confirmar e Enviar
              </button>
            </div>
          )}

          <WorkerHeroStats
            currentUser={currentUser} currentMonth={currentMonth} setCurrentMonth={setCurrentMonth}
            todayHours={todayHours} totalMonthHours={totalMonthHours} expectedHours={expectedHours}
            myApproval={myApproval} showProgress={showProgress} setShowProgress={setShowProgress}
          />

          {currentUser?.gps_enabled && currentMonth.getFullYear() === new Date().getFullYear() && currentMonth.getMonth() === new Date().getMonth() && (
            <InServiceCard
              todayOpenLog={todayOpenLog} clients={clients}
              handleRegistarPausa={handleRegistarPausa} handleRegistarSaida={handleRegistarSaida}
              geoActionLoading={geoActionLoading}
            />
          )}

          {currentMonth.getFullYear() === new Date().getFullYear() && currentMonth.getMonth() === new Date().getMonth() && !(todayOpenLog && geoSuggestion?.type === 'saida') && (
            <GeoSuggestionCard
              geoSuggestion={geoSuggestion} geoSuggestionDismissed={geoSuggestionDismissed}
              setGeoSuggestion={setGeoSuggestion} setGeoSuggestionDismissed={setGeoSuggestionDismissed}
              geoActionLoading={geoActionLoading} handleConfirmGeoSuggestion={handleConfirmGeoSuggestion}
            />
          )}

          {myApproval ? (
            <div className="mb-10 bg-emerald-50/80 border border-emerald-200 rounded-[3rem] p-12 text-center text-emerald-800 shadow-inner animate-in zoom-in-95">
              <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <CheckCircle size={40} className="text-emerald-500" />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-widest mb-2">Mês Validado e Fechado</h3>
              <p className="text-sm font-bold opacity-70 max-w-md mx-auto">
                As horas de {new Date(currentMonth).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })} já foram aprovadas e enviadas para a administração. Não é possível adicionar novos registos ou apagar os existentes.
              </p>
            </div>
          ) : (
            <div className="mb-8">
              {(currentMonth.getFullYear() === new Date().getFullYear() && currentMonth.getMonth() === new Date().getMonth()) && (isLimitedWorker ? (
                <RequestEntryCard
                  currentUser={currentUser} logs={logs} clients={clients} monthLogs={monthLogs}
                  onSuccess={() => { setSuccessMsg('Pedido submetido com sucesso!'); setTimeout(() => setSuccessMsg(''), 6000); }}
                />
              ) : (
                <EntryForm
                  data={mainFormData} clients={clients} assignedClients={currentUser?.assignedClients}
                  onChange={setMainFormData}
                  onSave={async () => {
                    await handleSaveWithGeoCheck(mainFormData, true);
                    if (mainFormData.clientId && mainFormData.startTime && mainFormData.endTime) {
                      setSuccessMsg('Registo inserido com sucesso!');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      setTimeout(() => setSuccessMsg(''), 6000);
                    }
                  }}
                  onCancel={() => setMainFormData({ id: null, date: toISODateLocal(new Date()), clientId: currentUser?.defaultClientId || '', startTime: '', breakStart: '', breakEnd: '', endTime: '', description: '' })}
                  showDate systemSettings={systemSettings} title="Novo Registo de Atividade"
                />
              ))}
            </div>
          )}

          {/* Day log list */}
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
                const isDayBeforeStart = workerStartDate && new Date(ds) < workerStartDate;

                const toggleExpand = () => {
                  if (isExpanded) {
                    setExpandedDays(prev => prev.filter(d => d !== ds));
                  } else if (dayLogs.length > 0) {
                    setExpandedDays(prev => [...prev, ds]);
                  } else {
                    openTimeEntryModal(ds);
                  }
                };

                return (
                  <React.Fragment key={ds}>
                    <div
                      onClick={toggleExpand}
                      className={`px-3 py-2.5 md:px-8 md:py-5 transition-all border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${dObj.getDay() === 0 || dObj.getDay() === 6 ? 'bg-slate-50/40' : ''} ${isExpanded ? 'bg-indigo-50/20' : ''}`}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Dia */}
                        <span className="text-base font-black text-slate-800 w-5 text-right shrink-0">{dObj.getDate()}</span>
                        <span className="text-[10px] uppercase font-black text-slate-400 w-7 shrink-0">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dObj.getDay()]}</span>

                        {/* Horas / estado */}
                        <div className="flex-1 flex items-center gap-1.5 min-w-0">
                          {dayTotalTotal > 0 ? (
                            <span className="text-xs font-black text-teal-600 uppercase tracking-wide">{formatHours(dayTotalTotal)} registradas</span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">—</span>
                          )}
                          {(dayRequestsByDate[ds] || []).map(({ item, corr }) => {
                            if (corr.status !== 'submitted' && corr.status !== 'under_review') return null;
                            const isDeletion = corr.type === 'deletion_request';
                            const label = isDeletion ? 'Eliminação' : item.before?.startTime ? 'Ajuste' : 'Registo';
                            return (
                              <span key={item.id} className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
                                ⏳ {label}
                              </span>
                            );
                          })}
                        </div>

                        {/* Ações */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!myApproval && !isDayBeforeStart && !isLimitedWorker && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleQuickRegister(ds); }} title="Registo Rápido" className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-lg transition-all"><Zap size={13} /></button>
                              <button onClick={(e) => { e.stopPropagation(); openTimeEntryModal(ds); }} className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"><Plus size={13} /></button>
                            </>
                          )}
                          {isLimitedWorker && (
                            <button onClick={(e) => { e.stopPropagation(); openTimeEntryModal(ds); }} className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-lg transition-all"><Plus size={13} /></button>
                          )}
                          {isDayBeforeStart && <span className="text-[9px] text-slate-300 font-bold">—</span>}
                          {isExpanded ? <ChevronUp size={14} className="text-indigo-400 ml-1" /> : <ChevronDown size={14} className="text-slate-300 ml-1" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 md:px-12 md:py-8 bg-slate-50/50 border-b border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-4">
                          {dayLogs.length > 0 && (
                            <div className="space-y-3">
                              {dayLogs.map(log => (
                                <div
                                  key={log.id}
                                  onClick={() => openTimeEntryModal(ds)}
                                  className="bg-white px-3 py-2.5 sm:p-4 rounded-2xl border border-slate-100 flex items-center justify-between gap-2 shadow-sm w-full cursor-pointer hover:bg-indigo-50/40 transition-all"
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg border border-indigo-100 uppercase shrink-0 max-w-[90px] truncate">{clients.find(c => c.id === log.clientId)?.name || 'Cliente'}</span>
                                    <div className="text-xs font-bold font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 shrink-0">{log.startTime}–{log.endTime}</div>
                                    {(log.breakStart || log.breakEnd) && (
                                      <div className="text-[9px] font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100 hidden sm:block shrink-0">
                                        Pausa: {log.breakStart || '--:--'}–{log.breakEnd || '--:--'}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 border-l border-slate-100 pl-3">
                                    <span className="text-sm font-black text-indigo-700">{formatHours(log.hours || 0)}</span>
                                    {!myApproval && !isLimitedWorker && (
                                      <button onClick={(e) => { e.stopPropagation(); handleDelete('logs', log.id); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm"><Trash2 size={16} /></button>
                                    )}
                                    {isLimitedWorker && (
                                      <button onClick={(e) => { e.stopPropagation(); openTimeEntryModal(ds); }} className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all shadow-sm"><Edit2 size={14} /></button>
                                    )}
                                  </div>
                                </div>
                              ))}
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

          {(() => {
            const statusMap = {
              approved: { label: 'Confirmado', cls: 'bg-emerald-100 text-emerald-700' },
              seen:     { label: 'Visto',      cls: 'bg-slate-100 text-slate-500' },
              pending:  { label: 'Aguarda',    cls: 'bg-orange-100 text-orange-600' },
            };
            const renderRow = (r) => {
              const s = statusMap[r.status] || statusMap.pending;
              const sortedDates = (r.dates || []).slice().sort();
              return (
                <div key={r.id} className="px-4 py-3 space-y-2 border-b border-slate-50 last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-slate-700">{r.reason}</p>
                    <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                  </div>
                  {sortedDates.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {sortedDates.map(ds => {
                        const d = new Date(ds + 'T00:00:00');
                        const weekday = d.toLocaleDateString('pt-PT', { weekday: 'short' });
                        const dayNum = d.getDate();
                        const month = d.toLocaleDateString('pt-PT', { month: 'short' });
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <span key={ds} className={`inline-flex flex-col items-center px-2.5 py-1.5 rounded-xl text-center leading-none ${isWeekend ? 'bg-slate-100 text-slate-400' : 'bg-orange-100 text-orange-700'}`}>
                            <span className="text-[8px] font-black uppercase tracking-wider">{weekday}</span>
                            <span className="text-sm font-black">{dayNum}</span>
                            <span className="text-[8px] font-bold opacity-70">{month}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            };

            const myAbsences = (absenceRequests || [])
              .filter(r => r.worker_id === currentUser?.id && r.status !== 'archived')
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            if (!myAbsences.length) return null;

            const pendingOnes = myAbsences.filter(r => r.status !== 'approved');
            const approvedOnes = myAbsences.filter(r => r.status === 'approved');
            const mostRecentApproved = approvedOnes[0];
            const restApproved = approvedOnes.slice(1);

            return (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Os meus avisos de falta</p>
                </div>
                <div>
                  {pendingOnes.map(renderRow)}
                  {mostRecentApproved && renderRow(mostRecentApproved)}
                  {restApproved.length > 0 && (
                    <>
                      <button
                        onClick={() => setApprovedAbsencesExpanded(p => !p)}
                        className="w-full px-4 py-2 flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                      >
                        {approvedAbsencesExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        {approvedAbsencesExpanded ? 'Mostrar menos' : `Ver mais ${restApproved.length} confirmado${restApproved.length !== 1 ? 's' : ''}`}
                      </button>
                      {approvedAbsencesExpanded && restApproved.map(renderRow)}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          <div id="secao-documentos">
            <WorkerDocuments currentUser={currentUser} documents={documents} saveToDb={saveToDb} pendingOnly={false} />
          </div>

          <PendingAlertsModal
            isOpen={alertsModalOpen}
            onClose={() => { setAlertsModalOpen(false); setAlertsModalDismissed(true); }}
            pendingApprovals={filteredPendingApprovals}
            currentMonthStr={currentMonthStr}
            pendingSignaturesCount={pendingSignaturesCount}
            previousOpenLogs={previousOpenLogs}
            clients={clients}
            onApproveMonth={() => handleApproveMonth(currentUser?.id)}
            onReviewMonth={(pending) => setCurrentMonth(new Date(pending.date.getFullYear(), pending.date.getMonth(), 1))}
            onSignDocuments={() => { const el = document.getElementById('secao-documentos'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            onCompleteLog={openIncompleteLogModal}
          />

          <TimeEntryModal
            isOpen={timeEntryModalOpen}
            onClose={() => { setTimeEntryModalOpen(false); setInlineEditingDate(null); }}
            initialDate={inlineEditingDate}
            daysList={daysList}
            formData={inlineFormData}
            onFormChange={setInlineFormData}
            onSave={async (formData, date) => { await handleSaveWithGeoCheck(formData, false, date); }}
            onBulkSave={handleBulkSave}
            clients={clients}
            assignedClients={currentUser?.assignedClients}
            currentUser={currentUser}
            systemSettings={systemSettings}
            monthLogs={monthLogs}
            logs={logs}
            isLimitedWorker={isLimitedWorker}
            onLimitedSuccess={() => {
              setTimeEntryModalOpen(false);
              setInlineEditingDate(null);
              setSuccessMsg('Pedido submetido com sucesso!');
              setTimeout(() => setSuccessMsg(''), 6000);
            }}
          />

          <DeleteConfirmModal
            deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm}
            deleteSubmitting={deleteSubmitting} onConfirm={handleSubmitDeletion}
          />

          <AbsenceRequestModal
            isOpen={absenceModalOpen}
            onClose={() => setAbsenceModalOpen(false)}
            daysList={daysList}
            monthLogs={monthLogs}
            currentUser={currentUser}
            systemSettings={systemSettings}
            onSubmit={handleAbsenceSubmit}
          />
        </>)}
      </main>

      {/* Toast de confirmação */}
      {successMsg && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none">
          <div className="flex items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300 whitespace-nowrap">
            <CheckCircle size={18} className="text-emerald-400 shrink-0" />
            <span className="text-sm font-bold">{successMsg}</span>
          </div>
        </div>
      )}

      {/* Modal Horários — mobile */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] flex flex-col sm:hidden">
          <button className="flex-shrink-0 h-16" onClick={() => setScheduleModalOpen(false)} aria-label="Fechar" />
          <div className="flex-1 bg-white rounded-t-3xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-sm">Meus Horários</h2>
              <button onClick={() => setScheduleModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-4">
              <WorkerScheduleTab
                assigned={assigned}
                currentUser={currentUser}
                expandedSchedules={expandedSchedules}
                toggleScheduleExpand={toggleScheduleExpand}
                setDefaultSchedule={setDefaultSchedule}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Perfil — mobile */}
      {profileModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] flex flex-col sm:hidden">
          <button className="flex-shrink-0 h-16" onClick={() => setProfileModalOpen(false)} aria-label="Fechar" />
          <div className="flex-1 bg-white rounded-t-3xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-sm">Meu Perfil</h2>
              <button onClick={() => setProfileModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-4">
              <WorkerProfile
                worker={currentUser}
                changeRequests={(workerChangeRequests || []).filter(r => r.worker_id === currentUser?.id)}
                documents={(documents || []).filter(d => (d.workerId === currentUser?.id || d.worker_id === currentUser?.id) && d.status !== 'Rascunho')}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const WorkerDashboard = ({ onLogout, onLogin, handleSaveEntry }) => (
  <WorkerProvider handleSaveEntry={handleSaveEntry}>
    <WorkerDashboardContent onLogout={onLogout} onLogin={onLogin} />
  </WorkerProvider>
);

export default WorkerDashboard;
