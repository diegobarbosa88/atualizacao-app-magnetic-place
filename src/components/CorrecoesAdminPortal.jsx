import React, { useMemo, useState } from 'react';
import QuickReportCard from './correcoes/QuickReportCard';
import PrecisionReportCard from './correcoes/PrecisionReportCard';
import { useEditDraft } from '../hooks/useEditDraft';
import { parseCorrectionMessage } from '../utils/notifParser';
import { sendNotificationEmail } from '../utils/emailUtils';
import { calculateDuration } from '../utils/formatUtils';
import { CheckCircle, XCircle, AlertCircle, ChevronDown } from 'lucide-react';

const CorrecoesAdminPortal = ({ workers, appNotifications, saveToDb, handleDelete, clients, logs, currentUser, correcoesCorrections }) => {
  const [expandedSections, setExpandedSections] = useState({ quick: true, precision: true });

  const processedNotifications = useMemo(() => {
    return (appNotifications || [])
      .filter(n => n.is_active && n.title && (n.title.includes('Pedido de Correção') || n.title.includes('Divergência Reportada') || n.title.includes('Contra-proposta Aceite')))
      .map(n => ({
        ...n,
        parsedData: parseCorrectionMessage(n.message)
      }));
  }, [appNotifications]);

  const quickNotifications = processedNotifications.filter(n => n.parsedData.type === 'quick');
  const precisionNotifications = processedNotifications.filter(n => n.parsedData.type === 'precision');

  const { draft, startEdit, updateField, updateNestedField, clearDraft, isDirty } = useEditDraft();

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSave = async () => {
    if (!draft) return;
    
    try {
      console.log('Saving correction to DB:', draft);
      await handleDelete('app_notifications', draft.id);
      alert(`Correção para ${draft.parsedData?.workerName || draft.parsedData?.clientName} aplicada com sucesso!`);
      clearDraft();
    } catch (error) {
      alert('Erro ao salvar correção: ' + error.message);
    }
  };

  const handleApply = async ({ localEdits, deletedDays, workersData, notification }) => {
    if (!notification) return;

    try {
      const clientId = notification.target_client_id;
      const client = clients.find(c => String(c.id) === String(clientId));
      const month = notification.payload?.month || '';
      const correcaoId = notification.payload?.correcao_id;

      for (const worker of workersData) {
        for (let dayIdx = 0; dayIdx < worker.dailyRecords.length; dayIdx++) {
          const day = worker.dailyRecords[dayIdx];
          const deleteKey = `w${workersData.indexOf(worker)}.d${dayIdx}`;
          const isDeleted = deletedDays[deleteKey];

          if (isDeleted) {
            const logEntry = logs.find(l => 
              String(l.workerId) === String(worker.id) && 
              l.date === day.rawDate
            );
            if (logEntry) {
              await saveToDb('logs', logEntry.id, { ...logEntry, hours: 0, startTime: null, endTime: null });
            }
            continue;
          }

          const entryKey = `w${workersData.indexOf(worker)}.d${dayIdx}.editedEntry`;
          const exitKey = `w${workersData.indexOf(worker)}.d${dayIdx}.editedExit`;
          const breakStartKey = `w${workersData.indexOf(worker)}.d${dayIdx}.editedBreakStart`;
          const breakEndKey = `w${workersData.indexOf(worker)}.d${dayIdx}.editedBreakEnd`;

          const editedEntry = localEdits[entryKey] || day.entry;
          const editedExit = localEdits[exitKey] || day.exit;
          const editedBreakStart = localEdits[breakStartKey] || day.breakStart;
          const editedBreakEnd = localEdits[breakEndKey] || day.breakEnd;

          if (localEdits[entryKey] || localEdits[exitKey] || localEdits[breakStartKey] || localEdits[breakEndKey]) {
            const logEntry = logs.find(l => 
              String(l.workerId) === String(worker.id) && 
              l.date === day.rawDate
            );

            if (logEntry) {
              const hours = calculateDuration(editedEntry, editedExit, editedBreakStart, editedBreakEnd);
              await saveToDb('logs', logEntry.id, {
                ...logEntry,
                startTime: editedEntry === '--:--' ? null : editedEntry,
                endTime: editedExit === '--:--' ? null : editedExit,
                breakStart: editedBreakStart,
                breakEnd: editedBreakEnd,
                hours: hours
              });
            }
          }
        }
      }

      if (correcaoId) {
        const correcao = correcoesCorrections?.find(c => c.id === correcaoId);
        if (correcao) {
          await saveToDb('correcoes', correcaoId, { ...correcao, status: 'applied' });
        }
      }

      const appliedNotifId = "applied_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const appliedNotifData = {
        id: appliedNotifId,
        title: `Correção Aplicada: ${notification.parsedData?.clientName || client?.name || 'Cliente'}`,
        message: `A sua correção referente ao período de ${month} foi aplicada e os valores foram atualizados no relatório.\n\nPode consultar o portal para verificar as alterações.`,
        type: 'success',
        target_type: 'client',
        target_client_id: String(clientId),
        created_at: new Date().toISOString(),
        is_active: true,
        payload: { type: 'correcao_aplicada', correcao_id: correcaoId }
      };
      await saveToDb('app_notifications', appliedNotifId, appliedNotifData);

      if (client?.email) {
        await sendNotificationEmail(
          client.email, 
          client.name, 
          appliedNotifData.title, 
          appliedNotifData.message, 
          clientId, 
          month
        );
      }

      await handleDelete('app_notifications', notification.id);
      alert(`Correção aplicada com sucesso! Cliente notificado.`);
      clearDraft();
    } catch (error) {
      console.error('Erro ao aplicar correção:', error);
      alert('Erro ao aplicar correção: ' + error.message);
    }
  };

  const handleReject = async ({ notification, workersData }) => {
    if (!notification) return;
    if (!window.confirm('Tem certeza que deseja rejeitar este reporte?')) return;

    try {
      const clientId = notification.target_client_id;
      const client = clients.find(c => String(c.id) === String(clientId));
      const month = notification.payload?.month || '';
      const correcaoId = notification.payload?.correcao_id;

      if (correcaoId) {
        const correcao = correcoesCorrections?.find(c => c.id === correcaoId);
        if (correcao) {
          await saveToDb('correcoes', correcaoId, { ...correcao, status: 'rejected' });
        }
      }

      const rejectNotifId = "reject_" + Date.now();
      const rejectNotifData = {
        id: rejectNotifId,
        title: `Correção Rejeitada: ${notification.parsedData?.clientName || client?.name || 'Cliente'}`,
        message: `A sua correção referente ao período de ${month} foi rejeitada pelo administrador.\n\nPor favor, aceda ao portal para submeter uma nova correção.`,
        type: 'error',
        target_type: 'client',
        target_client_id: String(clientId),
        created_at: new Date().toISOString(),
        is_active: true,
        payload: { type: 'correcao_rejeitada', correcao_id: correcaoId }
      };
      await saveToDb('app_notifications', rejectNotifId, rejectNotifData);

      if (client?.email) {
        await sendNotificationEmail(
          client.email, 
          client.name, 
          rejectNotifData.title, 
          rejectNotifData.message, 
          clientId, 
          month
        );
      }

      await handleDelete('app_notifications', notification.id);
      alert('Reporte rejeitado. Cliente notificado.');
      clearDraft();
    } catch (error) {
      console.error('Erro ao rejeitar correção:', error);
      alert('Erro ao rejeitar correção: ' + error.message);
    }
  };

  const handleApplyPrecision = async ({ workerIdx, worker, localEdits, deletedDays, notification }) => {
    if (!notification || !worker) return;

    try {
      const clientId = notification.target_client_id;
      const client = clients.find(c => String(c.id) === String(clientId));
      const month = notification.payload?.month || '';
      const correcaoId = notification.payload?.correcao_id;

      for (let dayIdx = 0; dayIdx < (worker.dailyRecords || []).length; dayIdx++) {
        const day = worker.dailyRecords[dayIdx];
        const deleteKey = `w${workerIdx}.d${dayIdx}`;
        const isDeleted = deletedDays[deleteKey];

        if (isDeleted) {
          if (day.logId) {
            await saveToDb('logs', day.logId, {
              id: day.logId,
              hours: 0,
              startTime: null,
              endTime: null
            });
          }
          continue;
        }

        const editEntry = localEdits[`w${workerIdx}.d${dayIdx}.editedEntry`] || day.editedEntry;
        const editExit = localEdits[`w${workerIdx}.d${dayIdx}.editedExit`] || day.editedExit;
        const editBreakStart = localEdits[`w${workerIdx}.d${dayIdx}.editedBreakStart`] || day.editedBreakStart;
        const editBreakEnd = localEdits[`w${workerIdx}.d${dayIdx}.editedBreakEnd`] || day.editedBreakEnd;

        if (editEntry || editExit || editBreakStart || editBreakEnd) {
          const newStart = editEntry || day.entry || day.start;
          const newEnd = editExit || day.exit || day.end;
          const newBreakStart = editBreakStart || day.breakStart;
          const newBreakEnd = editBreakEnd || day.breakEnd;

          if (day.logId) {
            await saveToDb('logs', day.logId, {
              id: day.logId,
              startTime: newStart === '--:--' ? null : newStart,
              endTime: newEnd === '--:--' ? null : newEnd,
              breakStart: newBreakStart,
              breakEnd: newBreakEnd,
              hours: day.editedHours || day.hours
            });
          }
        }
      }

      if (correcaoId) {
        const correcao = correcoesCorrections?.find(c => c.id === correcaoId);
        if (correcao) {
          await saveToDb('correcoes', correcaoId, { ...correcao, status: 'applied' });
        }
      }

      const appliedNotifId = "applied_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const appliedNotifData = {
        id: appliedNotifId,
        title: `Correção de Precisão Aplicada: ${notification.parsedData?.clientName || client?.name || 'Cliente'}`,
        message: `As suas correções de precisão para ${month} foram aplicadas e os valores foram atualizados no relatório.\n\nPode consultar o portal para verificar as alterações.`,
        type: 'success',
        target_type: 'client',
        target_client_id: String(clientId),
        created_at: new Date().toISOString(),
        is_active: true,
        payload: { type: 'correcao_aplicada', correcao_id: correcaoId }
      };
      await saveToDb('app_notifications', appliedNotifId, appliedNotifData);

      if (client?.email) {
        await sendNotificationEmail(
          client.email,
          client.name,
          appliedNotifData.title,
          appliedNotifData.message,
          clientId,
          month
        );
      }

      await handleDelete('app_notifications', notification.id);
      alert('Correção de precisão aplicada com sucesso! Cliente notificado.');
      clearDraft();
    } catch (error) {
      console.error('Erro ao aplicar correção de precisão:', error);
      alert('Erro ao aplicar correção: ' + error.message);
    }
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <header className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Painel de Correções</h2>
            <p className="text-sm font-medium text-slate-400">{processedNotifications.length} pendência{processedNotifications.length !== 1 ? 's' : ''} aguardando análise</p>
          </div>
        </div>
      </header>

      {/* Stats Cards - Clickable Accordion Headers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <button 
          onClick={() => toggleSection('quick')}
          className="bg-white p-6 rounded-[2rem] shadow-lg border border-indigo-100 hover:shadow-xl transition-all text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <span className="text-2xl">💬</span>
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Reportes Rápidos</p>
                <p className="text-3xl font-black text-slate-800">{quickNotifications.length}</p>
              </div>
            </div>
            <ChevronDown size={24} className={`text-slate-300 transition-transform ${expandedSections.quick ? 'rotate-180' : ''}`} />
          </div>
        </button>

        <button 
          onClick={() => toggleSection('precision')}
          className="bg-white p-6 rounded-[2rem] shadow-lg border border-amber-100 hover:shadow-xl transition-all text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
              <div>
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Ajuste de Precisão</p>
                <p className="text-3xl font-black text-slate-800">{precisionNotifications.length}</p>
              </div>
            </div>
            <ChevronDown size={24} className={`text-slate-300 transition-transform ${expandedSections.precision ? 'rotate-180' : ''}`} />
          </div>
        </button>
      </div>

      <div className="space-y-8">
        {/* Quick Reports Section */}
        {quickNotifications.length > 0 && (
          <section className="animate-fade-in">
            {expandedSections.quick && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                    <span>💬</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight">Mensagens Rápidas</h3>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {quickNotifications.map(n => (
                    <QuickReportCard 
                      key={n.id}
                      notification={{ ...n.parsedData, id: n.id, target_client_id: n.target_client_id, payload: n.payload }}
                      onEdit={() => startEdit({ ...n, ...n.parsedData })}
                      isEditing={draft?.id === n.id}
                      draft={draft?.id === n.id ? draft : null}
                      updateField={updateField}
                      allWorkersData={n.payload?.changes || []}
                      onApply={handleApply}
                      onReject={handleReject}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Precision Reports Section */}
        {precisionNotifications.length > 0 && (
          <section className="animate-fade-in">
            {expandedSections.precision && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                    <span>🎯</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight">Auditoria de Precisão</h3>
                </div>
                  <div className="grid grid-cols-1 gap-6">
                  {precisionNotifications.map(n => {
                    const clientName = clients?.find(c => String(c.id) === String(n.target_client_id))?.name || 'Cliente';
                    return (
                      <PrecisionReportCard
                        key={n.id}
                        notification={{ ...n.parsedData, id: n.id, target_client_id: n.target_client_id, payload: n.payload, clientName }}
                        onApply={handleApplyPrecision}
                        onReject={handleReject}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {processedNotifications.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[3rem] border border-slate-100">
            <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-700 mb-2">Tudo em dia!</h3>
            <p className="text-slate-400 font-medium">Nenhuma correção pendente no momento.</p>
          </div>
        )}
      </div>

      {draft && (
        <div className="fixed bottom-8 right-8 z-50 bg-white rounded-[2rem] shadow-2xl border border-slate-200 p-6 w-80 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Editando</p>
              <p className="text-lg font-black text-slate-800">{draft.parsedData?.workerName || draft.parsedData?.clientName || 'Correção'}</p>
            </div>
            {isDirty() && (
              <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-3 py-1 rounded-lg">Alterado</span>
            )}
          </div>

          <div className="flex gap-3">
            <button 
              onClick={handleSave}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} /> Confirmar
            </button>
            <button 
              onClick={handleReject}
              className="py-3 px-4 bg-rose-50 text-rose-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition-colors"
            >
              <XCircle size={16} />
            </button>
          </div>
          <button 
            onClick={clearDraft}
            className="w-full mt-3 py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
          >
            Descartar
          </button>
        </div>
      )}
    </div>
  );
};

export default CorrecoesAdminPortal;