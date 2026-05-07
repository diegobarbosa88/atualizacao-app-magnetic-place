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

  const handleSaveSchedule = useCallback(async () => {
    if (!scheduleForm.name) return alert('Nome do horário é obrigatório');
    const sId = scheduleForm.id || `s${Date.now()}`;
    await saveToDb('schedules', sId, { ...scheduleForm, id: sId });

    // Update workers associations
    for (const w of workers) {
      const isSelected = scheduleForm.assignedWorkers?.includes(w.id);
      const currentAssigned = w.assignedSchedules || [];
      let nextAssigned = [...currentAssigned];

      if (isSelected && !currentAssigned.includes(sId)) {
        nextAssigned.push(sId);
      } else if (!isSelected && currentAssigned.includes(sId)) {
        nextAssigned = nextAssigned.filter(id => id !== sId);
      }

      if (JSON.stringify(currentAssigned) !== JSON.stringify(nextAssigned)) {
        await saveToDb('workers', w.id, { ...w, assignedSchedules: nextAssigned });
      }
    }

    setIsAddingInTab(false);
    setScheduleForm(INITIAL_SCHEDULE_FORM);
  }, [scheduleForm, workers, saveToDb]);

  const handleDeleteSchedule = useCallback(async (scheduleId) => {
    await handleDelete('schedules', scheduleId);
  }, [handleDelete]);

  // D-04, D-05: Atribuição com datas de validade preserva histórico
  const handleAssignScheduleWithDates = useCallback(async (workerId, scheduleId, dataInicio, dataFim) => {
    const w = workers.find(worker => worker.id === workerId);
    if (!w) return;
    
    // Guardar datas no worker record (não substitui atribuições anteriores)
    const scheduleDates = w.assignedScheduleDates || {};
    scheduleDates[scheduleId] = { dataInicio, dataFim };
    
    // Also add to assignedSchedules array for backwards compatibility
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

  // Handle para remover atribuição (não remove historial)
  const handleUnassignSchedule = useCallback(async (workerId, scheduleId) => {
    const w = workers.find(worker => worker.id === workerId);
    if (!w) return;
    
    // Marcar data_fim como hoje (fim da vigência)
    const scheduleDates = w.assignedScheduleDates || {};
    const currentDates = scheduleDates[scheduleId] || { dataInicio: null, dataFim: null };
    scheduleDates[scheduleId] = { ...currentDates, dataFim: new Date().toISOString().split('T')[0] };
    
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
