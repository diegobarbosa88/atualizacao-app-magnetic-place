import React, { createContext, useContext, useState, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';

const ScheduleContext = createContext();

const INITIAL_SCHEDULE_FORM = {
  id: null, name: '', startTime: '', endTime: '', breakStart: '',
  breakEnd: '', hasBreak: false, assignedWorkers: [], weekdays: [1, 2, 3, 4, 5],
  isAdvanced: false, dailyConfigs: {}
};

export const ScheduleProvider = ({ children }) => {
  const { schedules, workers, saveToDb, handleDelete } = useApp();

  const [isAddingInTab, setIsAddingInTab] = useState(false);
  const [schedulesView, setSchedulesView] = useState(window.innerWidth < 768 ? 'grid' : 'list');
  const [schedulesSort, setSchedulesSort] = useState({ key: 'name', direction: 'asc' });
  const [scheduleForm, setScheduleForm] = useState(INITIAL_SCHEDULE_FORM);
  // Datas de início/fim por trabalhador atribuído. Vive aqui, e não dentro do
  // ScheduleForm, para o botão "Salvar Horário" poder ficar no rodapé fixo do
  // ModalShell — o rodapé é irmão do conteúdo, não tem acesso ao estado dele.
  const [assignmentDates, setAssignmentDates] = useState({});

  const handleSaveSchedule = useCallback(async (assignmentDates = {}) => {
    if (!scheduleForm.name) return alert('Nome do horário é obrigatório');
    const sId = scheduleForm.id || `s${Date.now()}`;
    await saveToDb('schedules', sId, { ...scheduleForm, id: sId });

    // Update workers associations - now with dates if provided
    for (const w of workers) {
      const isSelected = scheduleForm.assignedWorkers?.includes(w.id);
      const currentAssigned = w.assignedSchedules || [];
      let nextAssigned = [...currentAssigned];

      if (isSelected && !currentAssigned.includes(sId)) {
        nextAssigned.push(sId);
      } else if (!isSelected && currentAssigned.includes(sId)) {
        nextAssigned = nextAssigned.filter(id => id !== sId);
      }

      const dates = assignmentDates[w.id];
      const scheduleDates = { ...(w.assignedScheduleDates || {}) };
      
      if (dates && dates.dataInicio) {
        scheduleDates[sId] = { 
          dataInicio: dates.dataInicio, 
          dataFim: dates.dataFim || null 
        };
      }
      
      if (JSON.stringify(currentAssigned) !== JSON.stringify(nextAssigned) || dates?.dataInicio) {
        await saveToDb('workers', w.id, { 
          ...w, 
          assignedSchedules: nextAssigned,
          assignedScheduleDates: scheduleDates
        });
      }
    }

    setIsAddingInTab(false);
    setScheduleForm(INITIAL_SCHEDULE_FORM);
  }, [scheduleForm, workers, saveToDb]);

  const handleDeleteSchedule = useCallback(async (scheduleId) => {
    // Não há FK entre schedules e workers/worker_schedule_history (confirmado
    // no schema — zero constraints) — apagar não limpa nem bloqueia nada.
    // Os trabalhadores atribuídos ficam com uma referência morta em
    // assignedSchedules/defaultScheduleId, que os cálculos de horas esperadas
    // leem em silêncio como "sem horário", sem erro visível. Por isso o aviso
    // descreve o que realmente acontece (dados órfãos), não uma limpeza
    // automática que não existe.
    const affectedCount = workers.filter(w =>
      (w.assignedSchedules || []).includes(scheduleId) || w.defaultScheduleId === scheduleId
    ).length;

    const message = affectedCount > 0
      ? affectedCount === 1
        ? '1 trabalhador atribuído a este horário ficará sem horário definido, sem aviso automático a ele. Confirmas?'
        : `${affectedCount} trabalhadores atribuídos a este horário ficarão sem horário definido, sem aviso automático a eles. Confirmas?`
      : 'Tens a certeza que queres apagar este horário?';

    if (!window.confirm(message)) return;
    await handleDelete('schedules', scheduleId);
  }, [handleDelete, workers]);

  // 11-06: Atribuir horário com datas — cria período em histórico
  const handleAssignScheduleWithDates = useCallback(async (workerId, scheduleId, dataInicio, dataFim) => {
    const w = workers.find(worker => worker.id === workerId);
    if (!w) return;
    
    const histId = crypto.randomUUID();
    await saveToDb('worker_schedule_history', histId, {
      worker_id: workerId,
      schedule_id: scheduleId,
      data_inicio: dataInicio,
      data_fim: dataFim || null
    });
    
    const scheduleDates = { ...(w.assignedScheduleDates || {}) };
    scheduleDates[scheduleId] = { dataInicio, dataFim };
    
    const currentAssigned = w.assignedSchedules || [];
    const nextAssigned = currentAssigned.includes(scheduleId) 
      ? currentAssigned 
      : [...currentAssigned, scheduleId];
    
    await saveToDb('workers', w.id, { 
      ...w, 
      assignedSchedules: nextAssigned,
      assignedScheduleDates: scheduleDates 
    });
  }, [workers, saveToDb]);

  // 11-06: Remover atribuição — guarda em histórico e remove dates
  const handleUnassignSchedule = useCallback(async (workerId, scheduleId) => {
    const w = workers.find(worker => worker.id === workerId);
    if (!w) return;
    
    const scheduleDates = { ...(w.assignedScheduleDates || {}) };
    const currentDates = scheduleDates[scheduleId] || {};
    
    if (currentDates.dataInicio) {
      await saveToDb('worker_schedule_history', crypto.randomUUID(), {
        worker_id: workerId,
        schedule_id: scheduleId,
        data_inicio: currentDates.dataInicio,
        data_fim: new Date().toISOString().split('T')[0]
      });
    }
    
    delete scheduleDates[scheduleId];
    
    await saveToDb('workers', w.id, { 
      ...w, 
      assignedScheduleDates: scheduleDates 
    });
  }, [workers, saveToDb]);

  const resetScheduleForm = useCallback(() => {
    setScheduleForm(INITIAL_SCHEDULE_FORM);
  }, []);

  const value = {
    isAddingInTab, setIsAddingInTab,
    schedulesView, setSchedulesView,
    schedulesSort, setSchedulesSort,
    scheduleForm, setScheduleForm,
    assignmentDates, setAssignmentDates,
    handleSaveSchedule,
    handleDeleteSchedule,
    handleAssignScheduleWithDates,
    handleUnassignSchedule,
    resetScheduleForm
  };

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error('useSchedule must be used within a ScheduleProvider');
  return context;
};

export default ScheduleContext;
