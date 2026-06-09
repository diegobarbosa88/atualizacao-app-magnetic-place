
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { toISODateLocal, isSameMonth } from '../utils/dateUtils';

const AppContext = createContext();

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseInstance = null;

export const AppProvider = ({ children }) => {
  // --- SYSTEM SETTINGS ---
  const [systemSettings, setSystemSettings] = useState(() => {
    const defaults = {
      adminPassword: null,  // Must be set before admin can login (CR-01 fix)
      companyName: 'MAGNETIC PLACE',
      companyAddress: '',
      companyNif: '',
      companyEmail: '',
      companyPhone: '',
      darkMode: false,
      appWidth: '1920',
      geminiApiKey: '',
      toleranciaValido: 0.77,
      toleranciaAviso: 10,
      minuteInterval: 30,  // Arredondamento de registos de tempo (5, 10, 15, 30, 60)
      entryToleranceMinutes: 10,  // Tolerância (min) para arredondar entradas para baixo (0 desativa)
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
    const isClientPortalDomain = window.location.hostname.includes('painelcliente') || params.has('client');
    if (isClientPortalDomain) return 'client_portal';
    return params.get('view') || localStorage.getItem('magnetic_view') || 'login';
  });
  
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('magnetic_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [stampStyle, setStampStyleState] = useState(() => {
    try {
      return localStorage.getItem('magnetic_stamp_style') || 'tech';
    } catch {
      return 'tech';
    }
  });
  const setStampStyle = (style) => {
    const v = style === 'classic' ? 'classic' : style === 'corporate' ? 'corporate' : style === 'mirror' ? 'mirror' : 'tech';
    try { localStorage.setItem('magnetic_stamp_style', v); } catch { /* ignore */ }
    setStampStyleState(v);
  };

  // --- DATA STATES ---
  const [clients, setClients] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [personalSchedules, setPersonalSchedules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [correcoesCorrections, setCorrecoesCorrections] = useState([]);
  // v2 corrections (single source of truth) — see supabase/migrations/20260515_corrections_v2.sql
  const [corrections, setCorrections] = useState([]);
  const [correctionItems, setCorrectionItems] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [clientApprovals, setClientApprovals] = useState([]);
  const [appNotifications, setAppNotifications] = useState([]);
  const [workerChangeRequests, setWorkerChangeRequests] = useState([]);
  const [absenceRequests, setAbsenceRequests] = useState([]);
  const [isDbReady, setIsDbReady] = useState(false);
  const [gmailQueryConfig, setGmailQueryConfig] = useState(null);

  // Client notification preferences (granular control per notification type)
  const [notificationPreferences, setNotificationPreferences] = useState({
    correction_applied: { db: false, email: false },
    correction_resolved: { db: false, email: false },
    creation_request_approved: { db: false, email: false },
    correction_rejected: { db: false, email: false },
    correcao_aplicada: { db: false, email: false },
    correcao_aplicada_precision: { db: false, email: false },
    correcao_rejeitada: { db: false, email: false },
    reporte_divergencia_rejeitado: { db: false, email: false },
    validacao_anulada: { db: false, email: false },
  });

  // Company-wide settings persisted on Supabase (admin/responsible signature)
  const [companySignature, setCompanySignatureState] = useState({
    responsibleName: '',
    responsibleRole: '',
    responsibleEmail: '',
    signatureDataUrl: '',
  });

  // --- SUPABASE INITIALIZATION ---
  useEffect(() => {
    const initSupabase = async () => {
      if (window.supabase) {
        supabaseInstance = window.supabase.createClient(supabaseUrl, supabaseKey);
        window.supabaseInstance = supabaseInstance;
        setIsDbReady(true);
      } else {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.onload = () => {
          if (window.supabase) {
            supabaseInstance = window.supabase.createClient(supabaseUrl, supabaseKey);
            window.supabaseInstance = supabaseInstance;
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
            // Deduplicate by ID to prevent duplicate entries
            const unique = [...new Map(data.map(d => [d.id, d])).values()];
            setter(unique);
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
        fetchTable('corrections', setCorrections),
        fetchTable('correction_items', setCorrectionItems),
        fetchTable('worker_change_requests', setWorkerChangeRequests),
        (async () => {
          const { data: absData } = await supabaseInstance.from('absence_requests').select('*').order('created_at', { ascending: false });
          if (absData) setAbsenceRequests(absData);
        })(),
        (async () => {
          const { data, error } = await supabaseInstance
            .from('system_settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle();
          if (error) {
            console.error('Erro ao carregar system_settings:', error);
            return;
          }
          if (data) {
            setCompanySignatureState({
              responsibleName: data.responsible_name || '',
              responsibleRole: data.responsible_role || '',
              responsibleEmail: data.responsible_email || '',
              signatureDataUrl: data.company_signature_data_url || '',
            });
            setSystemSettings(prev => ({
              ...prev,
              ...(data.admin_password !== undefined && { adminPassword: data.admin_password }),
              ...(data.company_name && { companyName: data.company_name }),
              ...(data.company_address !== undefined && { companyAddress: data.company_address }),
              ...(data.company_nif !== undefined && { companyNif: data.company_nif }),
              ...(data.company_email !== undefined && { companyEmail: data.company_email }),
              ...(data.company_phone !== undefined && { companyPhone: data.company_phone }),
              ...(data.dark_mode !== undefined && { darkMode: data.dark_mode }),
              ...(data.app_width && { appWidth: data.app_width }),
              ...(data.gemini_api_key !== undefined && { geminiApiKey: data.gemini_api_key }),
              ...(data.tolerancia_valido != null && { toleranciaValido: Number(data.tolerancia_valido) }),
              ...(data.tolerancia_aviso  != null && { toleranciaAviso:  Number(data.tolerancia_aviso) }),
              ...(data.minute_interval != null && { minuteInterval: Number(data.minute_interval) }),
              ...(data.entry_tolerance_minutes != null && { entryToleranceMinutes: Number(data.entry_tolerance_minutes) }),
              ...(data.nav_mode && { navMode: data.nav_mode }),
              ...(data.absence_config && { absenceConfig: data.absence_config }),
            }));
            if (data.gmail_query_config) setGmailQueryConfig(data.gmail_query_config);
            if (data.notification_preferences) setNotificationPreferences(data.notification_preferences);
          }
        })(),
      ]);
    };

    fetchData();

    // --- REALTIME SUBSCRIPTIONS ---
    const channelNotif = supabaseInstance
      .channel('realtime-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          // Se for UPDATE, verificar se viewed_by_ids contém workers não-alvo (bug do trigger)
          // Apenas aplicar se não houver workers inválidos no viewed_by_ids
          const newNotif = payload.new;
          const targetIds = typeof newNotif.target_worker_ids === 'string'
            ? JSON.parse(newNotif.target_worker_ids)
            : (newNotif.target_worker_ids || []);
          const viewedIds = typeof newNotif.viewed_by_ids === 'string'
            ? JSON.parse(newNotif.viewed_by_ids)
            : (newNotif.viewed_by_ids || []);

          // Se viewed_by_ids contém workers que não são alvo, ignorar este UPDATE
          const hasInvalidViewed = viewedIds.some(vId => !targetIds.includes(vId));
          if (hasInvalidViewed && payload.eventType === 'UPDATE') {
            return;
          }

          setAppNotifications(prev => {
            const exists = prev.some(x => x.id === newNotif.id);
            return exists ? prev.map(x => x.id === newNotif.id ? newNotif : x) : [newNotif, ...prev];
          });
        } else if (payload.eventType === 'DELETE') {
          setAppNotifications(prev => prev.filter(n => n.id !== payload.old.id));
        }
      })
      .subscribe();

    const upsertById = (setter) => (row) => setter(prev => {
      const exists = prev.some(x => x.id === row.id);
      return exists ? prev.map(x => x.id === row.id ? row : x) : [row, ...prev];
    });
    const removeById = (setter) => (row) => setter(prev => prev.filter(x => x.id !== row.id));

    const channelCorrections = supabaseInstance
      .channel('realtime-corrections')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'corrections' }, (payload) => {
        if (payload.eventType === 'DELETE') removeById(setCorrections)(payload.old);
        else upsertById(setCorrections)(payload.new);
      })
      .subscribe();

    const channelCorrectionItems = supabaseInstance
      .channel('realtime-correction-items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'correction_items' }, (payload) => {
        if (payload.eventType === 'DELETE') removeById(setCorrectionItems)(payload.old);
        else upsertById(setCorrectionItems)(payload.new);
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

    const channelChangeReqs = supabaseInstance
      .channel('realtime-change-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_change_requests' }, (payload) => {
        if (payload.eventType === 'DELETE') removeById(setWorkerChangeRequests)(payload.old);
        else upsertById(setWorkerChangeRequests)(payload.new);
      })
      .subscribe();

    const channelAbsences = supabaseInstance
      .channel('realtime-absences')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'absence_requests' }, (payload) => {
        if (payload.eventType === 'DELETE') removeById(setAbsenceRequests)(payload.old);
        else upsertById(setAbsenceRequests)(payload.new);
      })
      .subscribe();

    const channelWorkers = supabaseInstance
      .channel('realtime-workers')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workers' }, (payload) => {
        const updated = payload.new;
        setWorkers(prev => prev.map(w => w.id === updated.id ? { ...w, ...updated } : w));
        setCurrentUser(prev => {
          if (!prev || prev.id !== updated.id) return prev;
          const merged = { ...prev, ...updated };
          localStorage.setItem('magnetic_user', JSON.stringify(merged));
          return merged;
        });
      })
      .subscribe();

    return () => {
      supabaseInstance.removeChannel(channelNotif);
      supabaseInstance.removeChannel(channelCorrections);
      supabaseInstance.removeChannel(channelCorrectionItems);
      supabaseInstance.removeChannel(channelApprovals);
      supabaseInstance.removeChannel(channelLogs);
      supabaseInstance.removeChannel(channelChangeReqs);
      supabaseInstance.removeChannel(channelAbsences);
      supabaseInstance.removeChannel(channelWorkers);
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
    else if (colName === 'correcoes' || colName === 'corrections') { 
      prependState(setCorrecoesCorrections);
      prependState(setCorrections);
    }
    else if (colName === 'correction_items') prependState(setCorrectionItems);
    else if (colName === 'documents' || colName === 'documentos') updateState(setDocuments);
    else if (colName === 'absence_requests') prependState(setAbsenceRequests);

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
        hours: data.hours || data.totalHours,
        description: data.description ?? null,
        source: data.source ?? null,
        edited_at: data.edited_at ?? null,
        edited_source: data.edited_source ?? null,
        check_in_lat: data.check_in_lat ?? null,
        check_in_lng: data.check_in_lng ?? null,
        geo_verified: data.geo_verified ?? null,
        break_start_lat: data.break_start_lat ?? null,
        break_start_lng: data.break_start_lng ?? null,
        break_end_lat: data.break_end_lat ?? null,
        break_end_lng: data.break_end_lng ?? null,
        check_out_lat: data.check_out_lat ?? null,
        check_out_lng: data.check_out_lng ?? null,
      };
    } else if (tableName === 'clients') {
      // Remover campos calculados em memória que não existem na BD
      const { totalHoras, totalRevenue, topWorker, ...rest } = data;
      payload = { ...rest, id };
    } else if (tableName === 'workers') {
      // morada: chave legacy de schema antigo — usar `address` em vez disso
      // role é campo transient de sessão (atribuído no login) — nunca persistir
      const { status, nis, is_active, morada, isAdminImpersonating, role, ...rest } = data;
      const currentStatus = status || (is_active === false ? 'inativo' : 'ativo');
      payload = { ...rest, is_active: currentStatus === 'ativo', id };
      if (nis) payload.nis = nis;
      // Migração silenciosa: se ainda vier `morada` no objecto e não houver `address`, preserva o valor
      if (morada && !payload.address) payload.address = morada;
      // isAdminImpersonating é campo transient de sessão — nunca persistir
    }

    // Para app_notifications: só inicializar os campos de tracking se não vierem no payload
    // Nunca sobrescrever — isso apagaria quem já viu/dispensou
    if (tableName === 'app_notifications') {
      if (!('viewed_by_ids' in payload)) payload.viewed_by_ids = null;
      if (!('dismissed_by_ids' in payload)) payload.dismissed_by_ids = [];
    }

    // correction_items: preservar objetos nested (before, proposed, final)
    // e usar os nomes de campo tal como vêm (worker_id, correction_id, etc.)
    if (tableName === 'correction_items') {
      const { error } = await supabaseInstance.from(tableName).upsert(payload, { onConflict: 'id' });
      if (error) console.error(`Erro ao gravar em ${tableName}:`, error);
      return;
    }

    const { error } = await supabaseInstance.from(tableName).upsert(payload, { onConflict: 'id' });
    if (error) console.error(`Erro ao gravar em ${tableName}:`, error);
  };

  const handleApproveMonth = async (workerId) => {
    const monthStr = toISODateLocal(currentMonth).substring(0, 7);
    const id = "appr_" + workerId + "_" + monthStr;
    await saveToDb('approvals', id, { id, workerId, month: monthStr, timestamp: new Date().toISOString() });
  };

  // Update notification preferences in Supabase
  const updateNotificationPreferences = async (newPrefs) => {
    setNotificationPreferences(newPrefs);
    // Sync to global for cross-module access
    globalThis.__notificationPreferences = newPrefs;
    if (supabaseInstance) {
      const { error } = await supabaseInstance
        .from('system_settings')
        .update({ notification_preferences: newPrefs })
        .eq('id', 1);
      if (error) console.error('Erro ao guardar preferências de notificação:', error);
    }
  };

  // Sync notificationPreferences to global on mount
  useEffect(() => {
    globalThis.__notificationPreferences = notificationPreferences;
  }, [notificationPreferences]);

  // Sincroniza currentUser com dados frescos do Supabase sempre que workers actualiza
  useEffect(() => {
    if (!currentUser || workers.length === 0) return;
    const fresh = workers.find(w => w.id === currentUser.id);
    if (!fresh) return;
    setCurrentUser(prev => {
      const merged = { ...prev, ...fresh };
      try { localStorage.setItem('magnetic_user', JSON.stringify(merged)); } catch { /* ignore */ }
      return merged;
    });
  }, [workers]);

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
    else if (colName === 'correcoes' || colName === 'corrections') filterState(setCorrecoesCorrections);
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

  // Helper: verificar se um worker está ativo num determinado mês
  const isWorkerActiveInMonth = (worker, logDate) => {
    if (!worker) return false;
    const logMonth = new Date(logDate);
    logMonth.setDate(1); // Primeiro dia do mês

    // Verificar data de início
    if (worker.dataInicio) {
      const startDate = new Date(worker.dataInicio);
      if (logMonth < startDate) return false;
    }

    // Verificar data de fim
    if (worker.dataFim) {
      const endDate = new Date(worker.dataFim);
      if (logMonth > endDate) return false;
    }

    return true;
  };

  // --- ADMIN STATS ---
  const adminStats = useMemo(() => {
    const monthLogs = logs.filter(l => isSameMonth(l.date, currentMonth));
    const totalHours = monthLogs.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);

    let expectedRevenue = 0;
    let expectedCosts = 0;
    const clientHours = {};

    monthLogs.forEach(l => {
      clientHours[l.clientId] = (clientHours[l.clientId] || 0) + l.hours;
      const client = clients.find(c => c.id === l.clientId);
      const worker = workers.find(w => w.id === l.workerId);
      if (client) expectedRevenue += l.hours * (Number(client.valorHora) || 0);
      if (worker && isWorkerActiveInMonth(worker, l.date)) {
        expectedCosts += l.hours * (Number(worker.valorHora) || 0);
      }
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

  const saveCompanySignature = async ({ responsibleName, responsibleRole, responsibleEmail, signatureDataUrl }) => {
    if (!supabaseInstance) throw new Error('Supabase ainda não está disponível.');
    const payload = {
      id: 1,
      responsible_name: responsibleName ?? '',
      responsible_role: responsibleRole ?? '',
      responsible_email: responsibleEmail ?? '',
      company_signature_data_url: signatureDataUrl ?? '',
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseInstance
      .from('system_settings')
      .upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    setCompanySignatureState({
      responsibleName: payload.responsible_name,
      responsibleRole: payload.responsible_role,
      responsibleEmail: payload.responsible_email,
      signatureDataUrl: payload.company_signature_data_url,
    });
  };

  const saveAbsenceConfig = async (config) => {
    setSystemSettings(prev => ({ ...prev, absenceConfig: config }));
    if (!supabaseInstance) return;
    const { error } = await supabaseInstance
      .from('system_settings')
      .upsert({ id: 1, absence_config: config, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) console.error('Erro ao gravar absence_config:', error);
  };

  const saveGmailQueryConfig = async (config) => {
    setGmailQueryConfig(config);
    if (!supabaseInstance) return;
    const { error } = await supabaseInstance
      .from('system_settings')
      .upsert({ id: 1, gmail_query_config: config, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) console.error('Erro ao gravar gmail_query_config:', error);
  };

  const saveSystemSettings = async (newSettings) => {
    setSystemSettings(newSettings);
    if (!supabaseInstance) return;
    const payload = {
      id: 1,
      admin_password: newSettings.adminPassword ?? '',
      company_name: newSettings.companyName ?? '',
      company_address: newSettings.companyAddress ?? '',
      company_nif: newSettings.companyNif ?? '',
      company_email: newSettings.companyEmail ?? '',
      company_phone: newSettings.companyPhone ?? '',
      dark_mode: newSettings.darkMode ?? false,
      app_width: newSettings.appWidth ?? '1920',
      gemini_api_key: newSettings.geminiApiKey ?? '',
      tolerancia_valido: newSettings.toleranciaValido ?? 0.77,
      tolerancia_aviso:  newSettings.toleranciaAviso  ?? 10,
      minute_interval: newSettings.minuteInterval ?? 30,
      entry_tolerance_minutes: newSettings.entryToleranceMinutes ?? 10,
      nav_mode: newSettings.navMode ?? 'sidebar',
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseInstance
      .from('system_settings')
      .upsert(payload, { onConflict: 'id' });
    if (error) console.error('Erro ao gravar system_settings:', error);
  };

  const value = {
    systemSettings, setSystemSettings, saveSystemSettings,
    gmailQueryConfig, saveGmailQueryConfig,
    companySignature, saveCompanySignature,
    stampStyle, setStampStyle,
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
    corrections, setCorrections,
    correctionItems, setCorrectionItems,
    approvals, setApprovals,
    documents, setDocuments,
    clientApprovals, setClientApprovals,
    appNotifications, setAppNotifications,
    workerChangeRequests, setWorkerChangeRequests,
    absenceRequests, setAbsenceRequests,
    isDbReady,
    adminStats,
    saveToDb,
    handleDelete,
    handleApproveMonth,
    supabase: supabaseInstance,
    notificationPreferences, updateNotificationPreferences,
    saveAbsenceConfig,
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
