import React, { useState, useMemo, useEffect } from 'react';
import { WorkerProvider, useWorker } from './contexts/WorkerContext';
import { useApp } from '../../context/AppContext';
import {
  CheckCircle, Edit2,
  ChevronUp, ChevronDown, Trash2, Plus, Zap,
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

  const { setCurrentUser, workerChangeRequests, correctionItems, setCorrectionItems, corrections, supabase } = useApp();
  const [workerTab, setWorkerTab] = useState('home');
  const [timeEntryModalOpen, setTimeEntryModalOpen] = useState(false);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [alertsModalDismissed, setAlertsModalDismissed] = useState(false);

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

          {currentUser?.gps_enabled && (
            <InServiceCard
              todayOpenLog={todayOpenLog} clients={clients}
              handleRegistarPausa={handleRegistarPausa} handleRegistarSaida={handleRegistarSaida}
              geoActionLoading={geoActionLoading}
            />
          )}

          <GeoSuggestionCard
            geoSuggestion={geoSuggestion} geoSuggestionDismissed={geoSuggestionDismissed}
            setGeoSuggestion={setGeoSuggestion} setGeoSuggestionDismissed={setGeoSuggestionDismissed}
            geoActionLoading={geoActionLoading} handleConfirmGeoSuggestion={handleConfirmGeoSuggestion}
          />

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
              {successMsg && (

                <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 font-bold rounded-2xl flex items-center justify-center gap-3 border border-emerald-100 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                  <CheckCircle size={24} className="text-emerald-500" /><span>{successMsg}</span>
                </div>
              )}
              {currentMonthStr === todayStr.substring(0, 7) && (isLimitedWorker ? (
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
                      className={`p-4 md:px-8 md:py-6 transition-all border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${dObj.getDay() === 0 || dObj.getDay() === 6 ? 'bg-slate-50/40' : ''} ${isExpanded ? 'bg-indigo-50/20' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2 md:grid md:grid-cols-[120px_1fr_220px]">
                        <div className="flex md:flex-col items-baseline md:items-start gap-2 md:gap-0">
                          <span className="text-2xl font-black text-slate-800">{dObj.getDate()}</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400">{['DOM','SEG','TER','QUA','QUI','SEX','SÁB'][dObj.getDay()]}</span>
                        </div>
                        <div className="flex-1 flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2">
                            {dayTotalTotal > 0 ? (
                              <>
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wide">{formatHours(dayTotalTotal)} registradas</span>
                                {!isExpanded && <span className="text-[10px] text-slate-300 font-bold hidden lg:inline">• Detalhes</span>}
                              </>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Sem registos</span>
                            )}
                          </div>
                          {(dayRequestsByDate[ds] || []).map(({ item, corr }) => {
                            if (corr.status !== 'submitted' && corr.status !== 'under_review') return null;
                            const isDeletion = corr.type === 'deletion_request';
                            const hasProposed = item.proposed && (item.proposed.startTime || item.proposed.endTime);
                            const label = isDeletion ? 'Pedido de eliminação' : item.before?.startTime ? 'Pedido de ajuste' : 'Pedido de registo';
                            return (
                              <span key={item.id} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                                ⏳ {label}
                                {hasProposed && <span className="font-mono ml-1">{item.proposed.startTime}–{item.proposed.endTime}</span>}
                              </span>
                            );
                          })}
                        </div>
                        <div className="flex justify-end items-center gap-2">
                          {!myApproval && !isDayBeforeStart && !isLimitedWorker && (
                            <div className="flex gap-2">
                              <button onClick={(e) => { e.stopPropagation(); handleQuickRegister(ds); }} title="Registo Rápido" className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-xl transition-all shadow-sm"><Zap size={16} /></button>
                              <button onClick={(e) => { e.stopPropagation(); openTimeEntryModal(ds); }} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm"><Plus size={16} /></button>
                            </div>
                          )}
                          {isLimitedWorker && (
                            <button onClick={(e) => { e.stopPropagation(); openTimeEntryModal(ds); }} className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-xl transition-all shadow-sm"><Plus size={16} /></button>
                          )}
                          {isDayBeforeStart && <span className="text-[10px] text-slate-300 font-bold">Indisponível</span>}
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
        </>)}
      </main>
    </div>
  );
};

const WorkerDashboard = ({ onLogout, onLogin, handleSaveEntry }) => (
  <WorkerProvider handleSaveEntry={handleSaveEntry}>
    <WorkerDashboardContent onLogout={onLogout} onLogin={onLogin} />
  </WorkerProvider>
);

export default WorkerDashboard;
