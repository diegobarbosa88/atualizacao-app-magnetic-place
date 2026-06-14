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
  const [timeEntryInitialLogId, setTimeEntryInitialLogId] = useState(null);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [alertsModalDismissed, setAlertsModalDismissed] = useState(false);
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
  const [approvedAbsencesExpanded, setApprovedAbsencesExpanded] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);

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

  const openTimeEntryModal = (ds, logId = null) => {
    setInlineEditingDate(ds);
    setTimeEntryInitialLogId(logId);
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
        onOpenDocumentsModal={() => setDocumentsModalOpen(true)}
        isCurrentMonth={currentMonth.getFullYear() === new Date().getFullYear() && currentMonth.getMonth() === new Date().getMonth()}
        absencePendingCount={(absenceRequests || []).filter(r => r.worker_id === currentUser?.id && (r.status === 'pending' || r.status === 'seen')).length}
        documentsPendingCount={pendingSignaturesCount}
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
            previousOpenLogs={previousOpenLogs}
            clients={clients}
            onApproveMonth={() => handleApproveMonth(currentUser?.id)}
            onReviewMonth={(pending) => setCurrentMonth(new Date(pending.date.getFullYear(), pending.date.getMonth(), 1))}
            onSignDocuments={() => setDocumentsModalOpen(true)}
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
    </div>
  );
};

const WorkerDashboard = ({ onLogout, onLogin, handleSaveEntry }) => (
  <WorkerProvider handleSaveEntry={handleSaveEntry}>
    <WorkerDashboardContent onLogout={onLogout} onLogin={onLogin} />
  </WorkerProvider>
);

export default WorkerDashboard;
