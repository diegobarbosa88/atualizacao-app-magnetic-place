import React, { createContext, useContext, useState, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';

const ClientContext = createContext();

// D-07: Função para guardar histórico de alterações do valor hora do cliente
const saveClientValorHoraHistory = async (clients, saveToDb, clientId, valorNovo, dataAlteracao) => {
  const client = clients.find(c => c.id === clientId);
  if (!client || client.valorHora === valorNovo) return;
  
  await saveToDb('client_valorhora_history', crypto.randomUUID(), {
    client_id: clientId,
    valor_anterior: client.valorHora,
    valor_novo: valorNovo,
    data_alteracao: new Date(dataAlteracao).toISOString()
  });
};

const INITIAL_CLIENT_FORM = {
  id: null, name: '', morada: '', nif: '', valorHora: '', email: '', dataAlteracao: new Date().toISOString().split('T')[0]
};

export const ClientProvider = ({ children }) => {
  const { clients, saveToDb, handleDelete } = useApp();

  const [isAddingInTab, setIsAddingInTab] = useState(false);
  const [clientsView, setClientsView] = useState('list');
  const [clientsSort, setClientsSort] = useState({ key: 'name', direction: 'asc' });
  const [clientForm, setClientForm] = useState(INITIAL_CLIENT_FORM);

  const handleSaveClient = useCallback(async () => {
    if (!clientForm.name) return alert('Nome da empresa é obrigatório');
    const id = clientForm.id || `client_${Date.now()}`;
    // D-07: Salvar histórico se valor hora mudou
    if (clientForm.id) {
      const existingClient = clients.find(c => c.id === clientForm.id);
      if (existingClient && existingClient.valorHora !== clientForm.valorHora) {
        await saveClientValorHoraHistory(clients, saveToDb, clientForm.id, clientForm.valorHora, clientForm.dataAlteracao);
      }
    }
    const { dataAlteracao, ...restForm } = clientForm;
    await saveToDb('clients', id, { ...restForm, id });
    setIsAddingInTab(false);
    setClientForm(INITIAL_CLIENT_FORM);
  }, [clientForm, saveToDb, clients]);

  const handleDeleteClient = useCallback(async (clientId) => {
    await handleDelete('clients', clientId);
  }, [handleDelete]);

  const resetClientForm = useCallback(() => {
    setClientForm(INITIAL_CLIENT_FORM);
  }, []);

  // D-07: Função exposta para guardar histórico do valor hora do cliente
  const saveClientHistory = useCallback(async (clientId, valorNovo) => {
    await saveClientValorHoraHistory(clients, saveToDb, clientId, valorNovo);
  }, [clients, saveToDb]);

  const value = {
    isAddingInTab, setIsAddingInTab,
    clientsView, setClientsView,
    clientsSort, setClientsSort,
    clientForm, setClientForm,
    handleSaveClient,
    handleDeleteClient,
    resetClientForm,
    saveClientHistory,
    clients
  };

  return (
    <ClientContext.Provider value={value}>
      {children}
    </ClientContext.Provider>
  );
};

export const useClient = () => {
  const context = useContext(ClientContext);
  if (!context) throw new Error('useClient must be used within a ClientProvider');
  return context;
};

export default ClientContext;
