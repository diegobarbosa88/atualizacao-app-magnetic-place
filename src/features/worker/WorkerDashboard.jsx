import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { WorkerProvider, useWorker } from './contexts/WorkerContext';
import { useApp } from '../../context/AppContext';
import { isPending } from '../../constants/documentStatus';
import {
  CheckCircle, Edit2,
  ChevronUp, ChevronDown, Trash2, Plus, Zap, X, Bell,
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { toISODateLocal, isSameMonth } from '../../utils/dateUtils';
import { formatHours } from '../../utils/formatUtils';
import { newId as newAbsenceId, notifyClientOfAbsence, deleteAbsenceRequest, buildAbsenceNotificationMessage } from '../../utils/absenceRequestsApi';
import { notifyEvent, TARGET } from '../../utils/notifyEvent';

import WorkerProfile from './WorkerProfile';
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
import WorkerCalendar from './worker-dashboard/WorkerCalendar';
import ManualTimeEntryCard from './worker-dashboard/ManualTimeEntryCard';
import ScheduleModal from './worker-dashboard/ScheduleModal';
import ProfileModal from './worker-dashboard/ProfileModal';
import DocumentsModal from './worker-dashboard/DocumentsModal';
import FormacaoModal from './worker-dashboard/FormacaoModal';
import { listMinhasFormacoes } from './worker-dashboard/formacaoWorkerApi';

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
    getEffectiveClientId,
    handleOpenInlineForm, handleQuickRegister,
    setDefaultSchedule, handleSaveEntry,
    saveToDb, handleDelete, handleApproveMonth, myNotifications,
  } = useWorker();

  const { setCurrentUser, workerChangeRequests, correctionItems, setCorrectionItems, corrections, supabase, absenceRequests, setAbsenceRequests } = useApp();

  const [pendingTemplateDocsCount, setPendingTemplateDocsCount] = useState(0);
  const loadPendingTemplateDocs = useCallback(async () => {
    if (!currentUser?.id || !supabase) return;
    const { data } = await supabase
      .from('worker_documents')
      .select('id, status')
      .eq('worker_id', currentUser.id)
      .eq('status', 'pending');
    setPendingTemplateDocsCount((data || []).length);
  }, [currentUser?.id, supabase]);
  useEffect(() => { loadPendingTemplateDocs(); }, [loadPendingTemplateDocs]);

  const [workerTab, setWorkerTab] = useState('home');
  const [timeEntryModalOpen, setTimeEntryModalOpen] = useState(false);
  const [timeEntryInitialLogId, setTimeEntryInitialLogId] = useState(null);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [alertsModalDismissed, setAlertsModalDismissed] = useState(false);
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
  const [approvedAbsencesExpanded, setApprovedAbsencesExpanded] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  useEffect(() => {
    if (!documentsModalOpen) loadPendingTemplateDocs();
  }, [documentsModalOpen, loadPendingTemplateDocs]);
  const [notifModalOpen, setNotifModalOpen] = useState(false);

  const [formacaoModalOpen, setFormacaoModalOpen] = useState(false);
  const [pendingFormacaoCount, setPendingFormacaoCount] = useState(0);
  const loadPendingFormacao = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const { participacoes } = await listMinhasFormacoes();
      setPendingFormacaoCount((participacoes || []).filter(p => !p.assinado_em).length);
    } catch {
      // silencioso — não bloqueia o resto do dashboard se a chamada falhar
    }
  }, [currentUser?.id]);
  useEffect(() => { loadPendingFormacao(); }, [loadPendingFormacao]);
  useEffect(() => {
    if (!formacaoModalOpen) loadPendingFormacao();
  }, [formacaoModalOpen, loadPendingFormacao]);

  const isLimitedWorker = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.limited_entry_mode) return true;
    return clients.find(c => c.id === currentUser.defaultClientId)?.triggers_limited_mode === true;
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
      clientId: log.clientId || getEffectiveClientId(log.date) || '',
      startTime: log.startTime || '',
      breakStart: log.breakStart || '',
      breakEnd: log.breakEnd || '',
      endTime: log.endTime || '',
      description: log.description || '',
    });
    setTimeEntryModalOpen(true);
  };

  const openTimeEntryModal = (ds, logId = null) => {
    setInlineEditingDate(ds);
    setTimeEntryInitialLogId(logId);
    setInlineFormData({
      id: null, date: ds, clientId: getEffectiveClientId(ds) || '',
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
    const id = newAbsenceId('abs');
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
    await notifyEvent(supabase, {
      idPrefix: 'notif_abs',
      title: 'Aviso de Falta',
      message: buildAbsenceNotificationMessage({ workerName: currentUser.name, dates, reason, notes }),
      type: 'warning',
      target: TARGET.ADMIN,
      payload: { absenceId: id, kind: 'absence' },
    });

    const client = clients?.find(c => c.id === currentUser.defaultClientId);
    if (client && !DISABLE_CLIENT_NOTIFICATIONS) {
      notifyClientOfAbsence(supabase, {
        client,
        workerName: currentUser.name,
        dates,
        reason,
        notes,
        absenceId: id,
      }).catch((e) => console.warn('falha ao notificar cliente sobre falta', e));
    }

    setSuccessMsg('Aviso de falta enviado com sucesso!');
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  const handleDeleteAbsence = async (req) => {
    if (!supabase || req.worker_id !== currentUser.id || req.status !== 'pending') return;
    await deleteAbsenceRequest(supabase, req, {
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: 'worker',
    });
    setAbsenceRequests?.(prev => prev.filter(r => r.id !== req.id));
  };

  const workerStartDate = currentUser?.dataInicio ? new Date(currentUser.dataInicio + 'T00:00:00') : null;
  const todayStr = toISODateLocal(new Date());
  const todayOpenLog = !myApproval && logs.find(l =>
    l.date === todayStr && String(l.workerId) === String(currentUser?.id) && l.startTime && !l.endTime
  );

  const filteredPendingApprovals = pendingApprovals.filter(pending => {
    if (!workerStartDate) return true;
    const pendingMonthStart = new Date(new Date(pending.date).getFullYear(), new Date(pending.date).getMonth(), 1);
    return pendingMonthStart >= workerStartDate;
  });

  const pendingSignaturesCount =
    (documents || []).filter(d => isPending(d.status) && d.workerId === currentUser?.id && d.visivel_worker === true).length +
    pendingTemplateDocsCount;
  const alertCount = filteredPendingApprovals.length + (pendingSignaturesCount > 0 ? 1 : 0) + (pendingFormacaoCount > 0 ? 1 : 0) + (previousOpenLogs?.length || 0);

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
        onOpenDocumentsModal={() => setDocumentsModalOpen(true)}
        onOpenFormacaoModal={() => setFormacaoModalOpen(true)}
        isCurrentMonth={currentMonth.getFullYear() === new Date().getFullYear() && currentMonth.getMonth() === new Date().getMonth()}
        absencePendingCount={(absenceRequests || []).filter(r => r.worker_id === currentUser?.id && (r.status === 'pending' || r.status === 'seen')).length}
        documentsPendingCount={pendingSignaturesCount}
        formacaoPendingCount={pendingFormacaoCount}
        notifCount={myNotifications.length}
        onOpenNotifs={() => setNotifModalOpen(true)}
      />

      <main className="mx-auto px-4 sm:px-6 md:px-10 lg:px-16 mt-6 md:mt-8" style={{ maxWidth: 'var(--app-max-width)' }}>

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
                onClick={() => handleApproveMonth(currentUser?.id, { notifyAdmin: true })}
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

          {(currentUser?.gps_enabled || isLimitedWorker) && currentMonth.getFullYear() === new Date().getFullYear() && currentMonth.getMonth() === new Date().getMonth() && (
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
              previousOpenLogs={previousOpenLogs} clients={clients} onCompleteLog={openIncompleteLogModal}
            />
          )}

          {myApproval && (
            <div className="mb-6 flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
              <CheckCircle size={15} className="text-emerald-500 shrink-0" />
              <p className="text-xs font-black text-emerald-700 uppercase tracking-wide">Mês validado</p>
              <span className="text-xs text-emerald-600 font-bold opacity-70 capitalize">
                — {new Date(currentMonth).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          )}

          {!isLimitedWorker && currentMonth.getFullYear() === new Date().getFullYear() && currentMonth.getMonth() === new Date().getMonth() && (
            <ManualTimeEntryCard
              clients={clients}
              currentUser={currentUser}
              onSave={async (formData, date) => {
                await handleSaveEntry(formData, false, date);
                setSuccessMsg('Horário registado com sucesso!');
                setTimeout(() => setSuccessMsg(''), 4000);
              }}
              onQuickRegister={(date) => {
                const saved = handleQuickRegister(date);
                if (saved !== false) {
                  setSuccessMsg('Registo rápido guardado!');
                  setTimeout(() => setSuccessMsg(''), 4000);
                }
                return saved;
              }}
              monthLogs={monthLogs}
              systemSettings={systemSettings}
            />
          )}

          <WorkerCalendar
            daysList={daysList}
            monthLogs={monthLogs}
            dayRequestsByDate={dayRequestsByDate}
            clients={clients}
            myApproval={myApproval}
            isLimitedWorker={isLimitedWorker}
            workerStartDate={workerStartDate}
            absenceRequests={absenceRequests}
            currentUserId={currentUser?.id}
            onAddEntry={openTimeEntryModal}
            onEditLog={openIncompleteLogModal}
            onDeleteLog={(log) => handleDelete('logs', log.id)}
            onEditLimitedLog={openTimeEntryModal}
            onQuickRegister={handleQuickRegister}
          />

          <PendingCorrectionsPanel
            pendingItems={pendingItems} resolvedItems={resolvedItems}
            pendingCollapsed={pendingCollapsed} setPendingCollapsed={setPendingCollapsed}
            dismissCorrection={dismissCorrection} labelKind={labelKind} corrections={corrections}
          />

          <PendingAlertsModal
            isOpen={alertsModalOpen}
            onClose={() => { setAlertsModalOpen(false); setAlertsModalDismissed(true); }}
            pendingApprovals={filteredPendingApprovals}
            currentMonthStr={currentMonthStr}
            pendingSignaturesCount={pendingSignaturesCount}
            pendingFormacaoCount={pendingFormacaoCount}
            previousOpenLogs={previousOpenLogs}
            clients={clients}
            onApproveMonth={() => handleApproveMonth(currentUser?.id, { notifyAdmin: true })}
            onReviewMonth={(pending) => setCurrentMonth(new Date(pending.date.getFullYear(), pending.date.getMonth(), 1))}
            onSignDocuments={() => setDocumentsModalOpen(true)}
            onSignFormacao={() => setFormacaoModalOpen(true)}
            onCompleteLog={openIncompleteLogModal}
          />

          <TimeEntryModal
            isOpen={timeEntryModalOpen}
            onClose={() => { setTimeEntryModalOpen(false); setInlineEditingDate(null); setTimeEntryInitialLogId(null); }}
            initialDate={inlineEditingDate}
            initialLogId={timeEntryInitialLogId}
            daysList={daysList}
            formData={inlineFormData}
            onFormChange={setInlineFormData}
            onSave={async (formData, date) => {
              await handleSaveWithGeoCheck(formData, false, date);
              setSuccessMsg('Horário registado com sucesso!');
              setTimeout(() => setSuccessMsg(''), 4000);
            }}
            onBulkSave={handleBulkSave}
            clients={clients}
            assignedClients={currentUser?.assignedClients}
            currentUser={currentUser}
            systemSettings={systemSettings}
            monthLogs={monthLogs}
            logs={logs}
            isLimitedWorker={isLimitedWorker}
            onQuickRegister={(date) => {
              const saved = handleQuickRegister(date);
              if (saved !== false) {
                setSuccessMsg('Registo rápido guardado!');
                setTimeout(() => setSuccessMsg(''), 4000);
              }
              return saved;
            }}
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
            absenceRequests={absenceRequests}
            onSubmit={handleAbsenceSubmit}
            onDelete={handleDeleteAbsence}
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

      <ScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        assigned={assigned}
        currentUser={currentUser}
        expandedSchedules={expandedSchedules}
        toggleScheduleExpand={toggleScheduleExpand}
        setDefaultSchedule={setDefaultSchedule}
      />

      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        worker={currentUser}
        changeRequests={(workerChangeRequests || []).filter(r => r.worker_id === currentUser?.id)}
        documents={(documents || []).filter(d => (d.workerId === currentUser?.id || d.worker_id === currentUser?.id) && d.status !== 'Rascunho')}
      />

      <DocumentsModal
        isOpen={documentsModalOpen}
        onClose={() => setDocumentsModalOpen(false)}
        currentUser={currentUser}
        documents={documents}
        saveToDb={saveToDb}
      />

      <FormacaoModal
        isOpen={formacaoModalOpen}
        onClose={() => setFormacaoModalOpen(false)}
        currentUser={currentUser}
        onChanged={loadPendingFormacao}
      />

      {notifModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNotifModalOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-indigo-600" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Notificações</h2>
                {myNotifications.length > 0 && (
                  <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">{myNotifications.length}</span>
                )}
              </div>
              <button onClick={() => setNotifModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
              {myNotifications.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Bell size={28} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Sem notificações novas</p>
                </div>
              ) : myNotifications.map(n => {
                const colorMap = { success: 'bg-emerald-100 text-emerald-600', warning: 'bg-amber-100 text-amber-600', error: 'bg-rose-100 text-rose-600', info: 'bg-indigo-100 text-indigo-600' };
                const bgClass = colorMap[n.type] || colorMap.info;
                return (
                  <div key={n.id} className="px-5 py-4 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                    <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${bgClass}`}><Bell size={14} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-800 leading-snug">{n.title}</p>
                      {n.message && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{n.message}</p>}
                      {n.created_at && <p className="text-[9px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString('pt-PT')}</p>}
                    </div>
                  </div>
                );
              })}
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
