import React, { createContext, useContext, useState, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';

const ClientContext = createContext();

const INITIAL_CLIENT_FORM = {
  id: null, name: '', morada: '', nif: '', valorHora: '', email: ''
};

export const ClientProvider = ({ children }) => {
  const { saveToDb, handleDelete } = useApp();

  const [isAddingInTab, setIsAddingInTab] = useState(false);
  const [clientsView, setClientsView] = useState('list');
  const [clientsSort, setClientsSort] = useState({ key: 'name', direction: 'asc' });
  const [clientForm, setClientForm] = useState(INITIAL_CLIENT_FORM);

  const handleSaveClient = useCallback(async () => {
    if (!clientForm.name) return alert('Nome da empresa é obrigatório');
    const id = clientForm.id || `client_${Date.now()}`;
    await saveToDb('clients', id, { ...clientForm, id });
    setIsAddingInTab(false);
    setClientForm(INITIAL_CLIENT_FORM);
  }, [clientForm, saveToDb]);

  const handleDeleteClient = useCallback(async (clientId) => {
    await handleDelete('clients', clientId);
  }, [handleDelete]);

  const resetClientForm = useCallback(() => {
    setClientForm(INITIAL_CLIENT_FORM);
  }, []);

  const value = {
    isAddingInTab, setIsAddingInTab,
    clientsView, setClientsView,
    clientsSort, setClientsSort,
    clientForm, setClientForm,
    handleSaveClient,
    handleDeleteClient,
    resetClientForm
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
