import React, { createContext, useContext, useState, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';

const TeamContext = createContext();

const INITIAL_WORKER_FORM = {
  id: null, name: '', assignedClients: [], assignedSchedules: [],
  defaultClientId: '', defaultScheduleId: '', tel: '', valorHora: '',
  profissao: '', nis: '', nif: '', iban: '', status: 'ativo',
  dataInicio: '', dataFim: ''
};

export const TeamProvider = ({ children }) => {
  const { saveToDb, handleDelete } = useApp();

  const [isAddingInTab, setIsAddingInTab] = useState(false);
  const [workersView, setWorkersView] = useState('list');
  const [workersSort, setWorkersSort] = useState({ key: 'name', direction: 'asc' });
  const [workerForm, setWorkerForm] = useState(INITIAL_WORKER_FORM);

  const handleSaveWorker = useCallback(async () => {
    if (!workerForm.name) return alert('Nome é obrigatório');
    const id = workerForm.id || `worker_${Date.now()}`;
    await saveToDb('workers', id, { ...workerForm, id });
    setIsAddingInTab(false);
    setWorkerForm(INITIAL_WORKER_FORM);
  }, [workerForm, saveToDb]);

  const handleDeleteWorker = useCallback(async (workerId) => {
    await handleDelete('workers', workerId);
  }, [handleDelete]);

  const resetWorkerForm = useCallback(() => {
    setWorkerForm(INITIAL_WORKER_FORM);
  }, []);

  const value = {
    isAddingInTab, setIsAddingInTab,
    workersView, setWorkersView,
    workersSort, setWorkersSort,
    workerForm, setWorkerForm,
    handleSaveWorker,
    handleDeleteWorker,
    resetWorkerForm
  };

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
};

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) throw new Error('useTeam must be used within a TeamProvider');
  return context;
};

export default TeamContext;
