
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { toISODateLocal, isSameMonth } from '../utils/dateUtils';

const AppContext = createContext();

// Supabase configuration - Fallback to hardcoded for now, but allow env override
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';

let supabaseInstance = null;

export const AppProvider = ({ children }) => {
  // --- SYSTEM SETTINGS ---
  const [systemSettings, setSystemSettings] = useState(() => {
    const defaults = {
      adminPassword: 'admin',
      companyName: 'MAGNETIC PLACE',
      darkMode: false,
      appWidth: '1920',
      geminiApiKey: ''
    };
    const saved = localStorage.getItem('magnetic_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaults, ...parsed };
      } catch (e) {
        return defaults;
      }
    }
    return defaults;
  });

  useEffect(() => {
    localStorage.setItem('magnetic_settings', JSON.stringify(systemSettings));
    const root = document.documentElement;
    root.style.setProperty('--app-max-width', `${systemSettings.appWidth}px`);
    if (systemSettings.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [systemSettings]);

  // --- VIEW & AUTH STATE ---
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || localStorage.getItem('magnetic_view') || 'login';
  });
  
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('magnetic_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // --- DATA STATES ---
  const [clients, setClients] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [personalSchedules, setPersonalSchedules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [correcoesCorrections, setCorrecoesCorrections] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [clientApprovals, setClientApprovals] = useState([]);
  const [appNotifications, setAppNotifications] = useState([]);
  const [isDbReady, setIsDbReady] = useState(false);

  // --- SUPABASE INITIALIZATION ---
  useEffect(() => {
    const initSupabase = async () => {
      if (window.supabase) {
        supabaseInstance = window.supabase.createClient(supabaseUrl, supabaseKey);
        setIsDbReady(true);
      } else {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.onload = () => {
          if (window.supabase) {
            supabaseInstance = window.supabase.createClient(supabaseUrl, supabaseKey);
            setIsDbReady(true);
          }
        };
        document.head.appendChild(script);
      }
    };
    initSupabase();
  }, []);

  // --- FETCH DATA ---
  useEffect(() => {
    if (!isDbReady || !supabaseInstance) return;

    const fetchData = async () => {
      const fetchTable = async (table, setter) => {
        const tableName = table.toLowerCase();
        const { data, error } = await supabaseInstance.from(tableName).select('*');
        if (error) {
          console.error(`Erro ao carregar ${tableName}:`, error);
          return;
        }
        if (data) {
          if (table === 'schedules') {
            const mapped = data.map(d => ({
              ...d,
              isAdvanced: d.isAdvanced !== undefined ? d.isAdvanced : d.isadvanced,
              dailyConfigs: d.dailyConfigs !== undefined ? d.dailyConfigs : d.dailyconfigs,
            }));
            setter(mapped);
          } else if (table === 'workers') {
            const mapped = data.map(d => ({
              ...d,
              nis: d.nis !== undefined ? d.nis : '',
              nif: d.nif !== undefined ? d.nif : '',
              status: d.is_active === false ? 'inativo' : 'ativo',
            }));
            setter(mapped);
          } else {
            setter(data);
          }
        }
      };

      await Promise.all([
        fetchTable('clients', setClients),
        fetchTable('workers', setWorkers),
        fetchTable('schedules', setSchedules),
        fetchTable('personalschedules', setPersonalSchedules),
        fetchTable('logs', setLogs),
        fetchTable('expenses', setExpenses),
        fetchTable('approvals', setApprovals),
        fetchTable('client_approvals', setClientApprovals),
        fetchTable('documents', setDocuments),
        fetchTable('app_notifications', setAppNotifications),
        fetchTable('correcoes', setCorrecoesCorrections),
      ]);
    };

    fetchData();

    // --- REALTIME SUBSCRIPTIONS ---
    const channelNotif = supabaseInstance
      .channel('realtime-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, (payload) => {
        if (payload.eventType === 'INSERT') setAppNotifications(prev => [payload.new, ...prev]);
        else if (payload.eventType === 'UPDATE') setAppNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
        else if (payload.eventType === 'DELETE') setAppNotifications(prev => prev.filter(n => n.id !== payload.old.id));
      })
      .subscribe();

    const channelCorrecoes = supabaseInstance
      .channel('realtime-correcoes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'correcoes' }, (payload) => {
        if (payload.eventType === 'INSERT') setCorrecoesCorrections(prev => [payload.new, ...prev]);
        else if (payload.eventType === 'UPDATE') setCorrecoesCorrections(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
        else if (payload.eventType === 'DELETE') setCorrecoesCorrections(prev => prev.filter(c => c.id !== payload.old.id));
      })
      .subscribe();

    const channelApprovals = supabaseInstance
      .channel('realtime-client-approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_approvals' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setClientApprovals(prev => {
            const exists = prev.some(x => x.id === payload.new.id);
            return exists ? prev.map(x => x.id === payload.new.id ? payload.new : x) : [...prev, payload.new];
          });
        } else if (payload.eventType === 'DELETE') {
          setClientApprovals(prev => prev.filter(x => x.id !== payload.old.id));
        }
      })
      .subscribe();

    const channelLogs = supabaseInstance
      .channel('realtime-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setLogs(prev => {
            const exists = prev.some(x => x.id === payload.new.id);
            return exists ? prev.map(x => x.id === payload.new.id ? payload.new : x) : [...prev, payload.new];
          });
        } else if (payload.eventType === 'DELETE') {
          setLogs(prev => prev.filter(x => x.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabaseInstance.removeChannel(channelNotif);
      supabaseInstance.removeChannel(channelCorrecoes);
      supabaseInstance.removeChannel(channelApprovals);
      supabaseInstance.removeChannel(channelLogs);
    };
  }, [isDbReady]);

  // --- DATABASE ACTIONS ---
  const saveToDb = async (colName, id, data) => {
    // Local State Updates (Optimistic)
    const updateState = (setter) => setter(prev => prev.some(x => x.id === id) ? prev.map(x => x.id === id ? { ...x, ...data } : x) : [...prev, data]);
    const prependState = (setter) => setter(prev => prev.some(x => x.id === id) ? prev.map(x => x.id === id ? { ...x, ...data } : x) : [data, ...prev]);

    if (colName === 'workers') updateState(setWorkers);
    else if (colName === 'clients') updateState(setClients);
    else if (colName === 'expenses') updateState(setExpenses);
    else if (colName === 'schedules') updateState(setSchedules);
    else if (colName === 'personalSchedules' || colName === 'personalschedules') updateState(setPersonalSchedules);
    else if (colName === 'logs' || colName === 'worker_logs') updateState(setLogs);
    else if (colName === 'approvals') updateState(setApprovals);
    else if (colName === 'client_approvals') updateState(setClientApprovals);
    else if (colName === 'app_notifications') prependState(setAppNotifications);
    else if (colName === 'correcoes') prependState(setCorrecoesCorrections);
    else if (colName === 'documents' || colName === 'documentos') updateState(setDocuments);

    // Supabase Persistence
    if (!supabaseInstance) return;

    let tableName = colName.toLowerCase();
    if (tableName === 'personalschedules') tableName = 'personalschedules';
    if (tableName === 'worker_logs') tableName = 'logs';
    if (tableName === 'documentos') tableName = 'documents';

    let payload = { ...data, id };
    
    // Table Specific Mappings (Legacy compatibility)
    if (tableName === 'logs') {
      payload = {
        id: data.id,
        date: data.date,
        workerId: data.workerId,
        clientId: data.clientId,
        startTime: data.startTime,
        endTime: data.endTime,
        breakStart: data.breakStart,
        breakEnd: data.breakEnd,
        hours: data.hours || data.totalHours
      };
    } else if (tableName === 'workers') {
      const { status, nis, is_active, ...rest } = data;
      const currentStatus = status || (is_active === false ? 'inativo' : 'ativo');
      payload = { ...rest, is_active: currentStatus === 'ativo', id };
      if (nis) payload.nis = nis;
    }

    const { error } = await supabaseInstance.from(tableName).upsert(payload, { onConflict: 'id' });
    if (error) console.error(`Erro ao gravar em ${tableName}:`, error);
  };

  const handleDelete = async (colName, id) => {
    // Local state updates
    const filterState = (setter) => setter(prev => prev.filter(x => x.id !== id));
    
    if (colName === 'clients') filterState(setClients);
    else if (colName === 'workers') filterState(setWorkers);
    else if (colName === 'schedules') filterState(setSchedules);
    else if (colName === 'personalSchedules' || colName === 'personalschedules') filterState(setPersonalSchedules);
    else if (colName === 'logs' || colName === 'worker_logs') filterState(setLogs);
    else if (colName === 'expenses') filterState(setExpenses);
    else if (colName === 'approvals') filterState(setApprovals);
    else if (colName === 'client_approvals') filterState(setClientApprovals);
    else if (colName === 'app_notifications') filterState(setAppNotifications);
    else if (colName === 'correcoes') filterState(setCorrecoesCorrections);
    else if (colName === 'documents' || colName === 'documentos') {
      const doc = documents.find(x => x.id === id);
      filterState(setDocuments);
      if (supabaseInstance && doc) {
        const pathToDelete = doc.storagePath || (doc.url ? doc.url.split('/public/documentos/')[1] : null);
        if (pathToDelete) await supabaseInstance.storage.from('documentos').remove([pathToDelete]);
        await supabaseInstance.from('documents').delete().eq('id', id);
      }
      return;
    }

    if (!supabaseInstance) return;
    const deleteTable = (colName === 'documentos' || colName === 'documents') ? 'documents' :
                       (colName === 'logs' || colName === 'worker_logs') ? 'logs' :
                       colName.toLowerCase();
    
    await supabaseInstance.from(deleteTable).delete().eq('id', id);
  };

  // --- ADMIN STATS ---
  const adminStats = useMemo(() => {
    const monthLogs = logs.filter(l => isSameMonth(l.date, currentMonth));
    const totalHours = monthLogs.reduce((acc, curr) => acc + curr.hours, 0);

    let expectedRevenue = 0;
    let expectedCosts = 0;
    const clientHours = {};

    monthLogs.forEach(l => {
      clientHours[l.clientId] = (clientHours[l.clientId] || 0) + l.hours;
      const client = clients.find(c => c.id === l.clientId);
      const worker = workers.find(w => w.id === l.workerId);
      if (client) expectedRevenue += l.hours * (Number(client.valorHora) || 0);
      if (worker) expectedCosts += l.hours * (Number(worker.valorHora) || 0);
    });

    const monthlyExpenses = expenses.filter(e => isSameMonth(e.date, currentMonth)).reduce((a, b) => a + Number(b.amount), 0);
    const topClientsList = Object.keys(clientHours)
      .map(id => ({ name: clients.find(c => c.id === id)?.name || 'Desconhecido', hours: clientHours[id] }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    return {
      totalHours,
      topClientName: topClientsList[0]?.name || "---",
      expectedRevenue,
      expectedCosts,
      monthlyExpenses,
      netProfit: expectedRevenue - expectedCosts - monthlyExpenses,
      topClientsList
    };
  }, [logs, currentMonth, clients, workers, expenses]);

  const currentMonthStr = toISODateLocal(currentMonth).substring(0, 7);

  const value = {
    systemSettings, setSystemSettings,
    view, setView,
    currentUser, setCurrentUser,
    currentMonth, setCurrentMonth,
    currentMonthStr,
    clients, setClients,
    workers, setWorkers,
    schedules, setSchedules,
    personalSchedules, setPersonalSchedules,
    logs, setLogs,
    expenses, setExpenses,
    correcoesCorrections, setCorrecoesCorrections,
    approvals, setApprovals,
    documents, setDocuments,
    clientApprovals, setClientApprovals,
    appNotifications, setAppNotifications,
    isDbReady,
    adminStats,
    saveToDb,
    handleDelete,
    supabase: supabaseInstance
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
