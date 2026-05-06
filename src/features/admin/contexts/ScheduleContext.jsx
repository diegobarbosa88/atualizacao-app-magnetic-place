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
