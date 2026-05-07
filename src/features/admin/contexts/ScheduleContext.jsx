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
  const [schedulesView, setSchedulesView] = useState('list');
  const [schedulesSort, setSchedulesSort] = useState({ key: 'name', direction: 'asc' });
  const [scheduleForm, setScheduleForm] = useState(INITIAL_SCHEDULE_FORM);

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
    await handleDelete('schedules', scheduleId);
  }, [handleDelete]);

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
