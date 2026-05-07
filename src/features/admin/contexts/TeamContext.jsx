import React, { createContext, useContext, useState, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';

const TeamContext = createContext();

// D-05/11-05: Salvar histórico de emprego (períodos entrada/saída)
const saveEmploymentHistory = async (saveToDb, workerId, dataInicio, dataFim) => {
  const supabase = window.supabaseInstance;
  if (!supabase || !workerId) return;
  
  // Buscar último período sem data_fim
  const { data: lastPeriod } = await supabase
    .from('worker_employment_history')
    .select('*')
    .eq('worker_id', workerId)
    .is('data_fim', null)
    .maybeSingle();
  
  if (lastPeriod && dataFim) {
    // Fechar período anterior (dia antes)
    const prevDate = new Date(dataFim);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    await saveToDb('worker_employment_history', lastPeriod.id, {
      ...lastPeriod,
      data_fim: prevDateStr
    });
  }
  
  if (!lastPeriod || dataFim) {
    // Criar novo período
    await saveToDb('worker_employment_history', crypto.randomUUID(), {
      worker_id: workerId,
      data_inicio: dataInicio || new Date().toISOString().split('T')[0],
      data_fim: dataFim || null
    });
  }
};

// D-06: Função para guardar histórico de alterações do valor hora do trabalhador
const saveWorkerValorHoraHistory = async (workers, saveToDb, workerId, valorNovo, dataAlteracao) => {
  const worker = workers.find(w => w.id === workerId);
  if (!worker || worker.valorHora === valorNovo) return;
  
  await saveToDb('worker_valorhora_history', crypto.randomUUID(), {
    worker_id: workerId,
    valor_anterior: worker.valorHora,
    valor_novo: valorNovo,
    data_alteracao: new Date(dataAlteracao).toISOString()
  });
};

const INITIAL_WORKER_FORM = {
  id: null, name: '', assignedClients: [], assignedSchedules: [],
  defaultClientId: '', defaultScheduleId: '', tel: '', valorHora: '',
  profissao: '', nis: '', nif: '', iban: '', status: 'ativo',
  dataInicio: '', dataFim: '', dataAlteracao: new Date().toISOString().split('T')[0]
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
    // D-06: Salvar histórico se valor hora mudou
    if (workerForm.id) {
      const existingWorker = workers.find(w => w.id === workerForm.id);
      if (existingWorker && existingWorker.valorHora !== workerForm.valorHora) {
        await saveWorkerValorHoraHistory(workers, saveToDb, workerForm.id, workerForm.valorHora, workerForm.dataAlteracao);
      }
    }
    // 11-05: Salvar histórico de emprego
    await saveEmploymentHistory(saveToDb, id, workerForm.dataInicio, workerForm.dataFim);
    const { dataAlteracao, ...restForm } = workerForm;
    const workerToSave = {
      ...restForm,
      id,
      status: workerForm.dataFim ? 'inativo' : 'ativo'
    };
    await saveToDb('workers', id, workerToSave);
    setIsAddingInTab(false);
    setWorkerForm(INITIAL_WORKER_FORM);
  }, [workerForm, saveToDb, workers]);

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
