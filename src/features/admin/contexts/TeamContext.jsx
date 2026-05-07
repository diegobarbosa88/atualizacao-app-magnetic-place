import React, { createContext, useContext, useState, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';

const TeamContext = createContext();

// D-05: Função para guardar histórico de alterações do valor hora do trabalhador
const saveWorkerValorHoraHistory = async (workers, saveToDb, workerId, valorNovo) => {
  const worker = workers.find(w => w.id === workerId);
  // Apenas criar registo se o valor mudou
  if (!worker || worker.valorHora === valorNovo) return;
  
  await saveToDb('worker_valorhora_history', null, {
    worker_id: workerId,
    valor_anterior: worker.valorHora,
    valor_novo: valorNovo,
    data_alteracao: new Date().toISOString()
  });
};

const INITIAL_WORKER_FORM = {
  id: null, name: '', assignedClients: [], assignedSchedules: [],
  defaultClientId: '', defaultScheduleId: '', tel: '', valorHora: '',
  profissao: '', nis: '', nif: '', iban: '', status: 'ativo',
  dataInicio: '', dataFim: ''
};

export const TeamProvider = ({ children }) => {
  const { workers, saveToDb, handleDelete } = useApp();

  const [isAddingInTab, setIsAddingInTab] = useState(false);
  const [workersView, setWorkersView] = useState('list');
  const [workersSort, setWorkersSort] = useState({ key: 'name', direction: 'asc' });
  const [workerForm, setWorkerForm] = useState(INITIAL_WORKER_FORM);

  const handleSaveWorker = useCallback(async () => {
    if (!workerForm.name) return alert('Nome é obrigatório');
    const id = workerForm.id || `worker_${Date.now()}`;
    // D-03: Se dataFim existe, automaticamente definir como inativo
    const workerToSave = {
      ...workerForm,
      id,
      status: workerForm.dataFim ? 'inativo' : (workerForm.status || 'ativo')
    };
    await saveToDb('workers', id, workerToSave);
    setIsAddingInTab(false);
    setWorkerForm(INITIAL_WORKER_FORM);
  }, [workerForm, saveToDb]);

  const handleDeleteWorker = useCallback(async (workerId) => {
    await handleDelete('workers', workerId);
  }, [handleDelete]);

  const resetWorkerForm = useCallback(() => {
    setWorkerForm(INITIAL_WORKER_FORM);
  }, []);

  // D-05: Função exposta para guardar histórico do valor hora
  const saveWorkerHistory = useCallback(async (workerId, valorNovo) => {
    await saveWorkerValorHoraHistory(workers, saveToDb, workerId, valorNovo);
  }, [workers, saveToDb]);

  const value = {
    isAddingInTab, setIsAddingInTab,
    workersView, setWorkersView,
    workersSort, setWorkersSort,
    workerForm, setWorkerForm,
    handleSaveWorker,
    handleDeleteWorker,
    resetWorkerForm,
    saveWorkerHistory,
    workers
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
