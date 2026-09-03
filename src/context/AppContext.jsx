
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

  // --- VIEW & AUTH STATE ---
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const isClientPortalDomain = window.location.hostname.includes('painelcliente') || params.has('client');
    if (isClientPortalDomain) return 'client_portal';
    return params.get('view') || localStorage.getItem('magnetic_view') || 'login';
  });

  useEffect(() => {
    localStorage.setItem('magnetic_settings', JSON.stringify(systemSettings));
    const root = document.documentElement;
    root.style.setProperty('--app-max-width', `${systemSettings.appWidth}px`);
    // O portal do cliente tem identidade visual própria (navy/laranja fixos, sem par
    // dark) e nunca reage ao modo escuro — aplicar .dark aqui inverteria os fundos
    // bg-white/slate-* dele via App.css, sem os textos acompanharem.
    if (systemSettings.darkMode && view !== 'client_portal') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [systemSettings, view]);
  
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
  const [gmailQueryConfigContador, setGmailQueryConfigContador] = useState(null);

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

  // --- DETEÇÃO DE SESSÃO (Fase 0 — só para atrasar os fetches, não para autenticar) ---
  // currentUser cobre admin+trabalhador (localStorage 'magnetic_user', já reativo:
  // handleLogin em app.jsx chama setCurrentUser diretamente). clientSession vive só
  // em localStorage ('magnetic_client_session'), gerida dentro de ClientPortal.jsx,
  // sem estado próprio aqui — por isso fazemos um poll leve só até aparecer.
  // CR-06: um ?token= na URL também conta como sinal — é o que permite resolver
  // tokenResolvedClientId (clients.find por share_token) num primeiro acesso sem
  // sessão prévia em localStorage (link mágico de cliente, ainda sem login feito).
  // Propositadamente NÃO inclui ?client= sozinho — esse é o parâmetro que a
  // correção CR-06 deixa de aceitar como bypass de login, e não deve voltar a
  // disparar o fetch completo sem autenticação.
  const hasAnySessionSignal = () => {
    try {
      if (localStorage.getItem('magnetic_user')) return true;
      const raw = localStorage.getItem('magnetic_client_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Date.now() < parsed.expiry) return true;
      }
      if (new URLSearchParams(window.location.search).has('token')) return true;
    } catch { /* ignore */ }
    return false;
  };

  const [hasSession, setHasSession] = useState(hasAnySessionSignal);

  useEffect(() => {
    if (currentUser) setHasSession(true);
  }, [currentUser]);

  useEffect(() => {
    if (hasSession) return;
    const check = () => { if (hasAnySessionSignal()) setHasSession(true); };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [hasSession]);

  // --- FETCH SÓ COM SESSÃO ATIVA ---
  // Fase 1: a validação de credenciais (admin/trabalhador/cliente) passou a
  // correr inteiramente em api/auth.js, server-side — o login já não depende
  // de ter workers/clients carregados no browser para comparar contra o que
  // foi escrito no formulário. Por isso workers/clients deixaram de ter um
  // fetch "sempre ativo" (Fase 0): agora só carregam aqui, tal como todo o
  // resto (logs, documentos, despesas, aprovações, correções, pedidos de
  // ausência, notificações, system_settings completo). Antes de existir
  // qualquer sinal de sessão, este efeito nem corre — não é filtragem "por
  // dentro", é o fetch não acontecer.
  useEffect(() => {
    if (!isDbReady || !supabaseInstance || !hasSession) return;

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
              tabela_irs: d.tabela_irs || 'tabelaI',
              n_dependentes: d.n_dependentes ?? 0,
              tipo_contrato: d.tipo_contrato || 'sem_termo',
              regime: d.regime || 'tempo_inteiro',
              horas_semanais: d.horas_semanais ?? 40,
              modo_trabalho: d.modo_trabalho || 'presencial',
              data_nascimento: d.data_nascimento || null,
              enquadramento: d.enquadramento || 'REGE',
              local_trabalho: d.local_trabalho || null,
              profissao_cnp: d.profissao_cnp || null,
              ss_admissao_comunicada_em: d.ss_admissao_comunicada_em || null,
              ss_admissao_num_registo: d.ss_admissao_num_registo || null,
              ss_cessacao_comunicada_em: d.ss_cessacao_comunicada_em || null,
              ss_cessacao_num_registo: d.ss_cessacao_num_registo || null,
            }));
            setter(mapped);
          } else {
            // Deduplicate by ID to prevent duplicate entries
            const unique = [...new Map(data.map(d => [d.id, d])).values()];
            setter(unique);
          }
        }
      };

      // Fetch de logs separado: sem limite de 1000 linhas e com merge de estado
      // para não sobrescrever updates optimistas feitos durante o carregamento.
      const fetchLogs = async () => {
        const currentYear = new Date().getFullYear();
        const lastYear = currentYear - 1;
        const { data, error } = await supabaseInstance
          .from('logs')
          .select('*')
          .gte('date', `${lastYear}-01-01`)
          .order('date', { ascending: false });
        if (error) { console.error('Erro ao carregar logs:', error); return; }
        if (!data) return;
        const unique = [...new Map(data.map(d => [d.id, d])).values()];
        // Merge: a DB ganha em entradas existentes, mas preserva updates optimistas
        // que ainda não foram persistidos (ex: salvos durante a fetch em curso).
        setLogs(prev => {
          const merged = new Map(unique.map(d => [d.id, d]));
          prev.forEach(p => { if (!merged.has(p.id)) merged.set(p.id, p); });
          return [...merged.values()];
        });
      };

      await Promise.all([
        fetchTable('clients', setClients),
        fetchTable('workers', setWorkers),
        fetchTable('schedules', setSchedules),
        fetchTable('personalschedules', setPersonalSchedules),
        fetchLogs(),
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
              ...(data.gemini_api_key ? { geminiApiKey: data.gemini_api_key } : {}),
              ...(data.tolerancia_valido != null && { toleranciaValido: Number(data.tolerancia_valido) }),
              ...(data.tolerancia_aviso  != null && { toleranciaAviso:  Number(data.tolerancia_aviso) }),
              ...(data.minute_interval != null && { minuteInterval: Number(data.minute_interval) }),
              ...(data.entry_tolerance_minutes != null && { entryToleranceMinutes: Number(data.entry_tolerance_minutes) }),
              ...(data.nav_mode && { navMode: data.nav_mode }),
              ...(data.absence_config && { absenceConfig: data.absence_config }),
            }));
            if (data.gmail_query_config) setGmailQueryConfig(data.gmail_query_config);
            if (data.gmail_query_config_contador) setGmailQueryConfigContador(data.gmail_query_config_contador);
            if (data.notification_preferences) setNotificationPreferences(data.notification_preferences);
          }
        })(),
      ]);
    };

    fetchData();

    // --- REALTIME SUBSCRIPTIONS (workers/clients já subscritos no efeito sempre-ativo acima) ---
    const channelNotif = supabaseInstance
      .channel('realtime-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const newNotif = payload.new;
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

    const channelClientApprovals = supabaseInstance
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

    const channelDocuments = supabaseInstance
      .channel('realtime-documents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, (payload) => {
        if (payload.eventType === 'DELETE') removeById(setDocuments)(payload.old);
        else upsertById(setDocuments)(payload.new);
      }).subscribe();

    const channelSchedules = supabaseInstance
      .channel('realtime-schedules')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, (payload) => {
        if (payload.eventType === 'DELETE') removeById(setSchedules)(payload.old);
        else upsertById(setSchedules)(payload.new);
      }).subscribe();

    const channelPersonalSchedules = supabaseInstance
      .channel('realtime-personalschedules')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personalschedules' }, (payload) => {
        if (payload.eventType === 'DELETE') removeById(setPersonalSchedules)(payload.old);
        else upsertById(setPersonalSchedules)(payload.new);
      }).subscribe();

    const channelApprovals = supabaseInstance
      .channel('realtime-approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approvals' }, (payload) => {
        if (payload.eventType === 'DELETE') removeById(setApprovals)(payload.old);
        else upsertById(setApprovals)(payload.new);
      }).subscribe();

    const channelExpenses = supabaseInstance
      .channel('realtime-expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (payload) => {
        if (payload.eventType === 'DELETE') removeById(setExpenses)(payload.old);
        else upsertById(setExpenses)(payload.new);
      }).subscribe();

    const channelSettings = supabaseInstance
      .channel('realtime-system-settings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_settings' }, (payload) => {
        if (payload.new) setSystemSettings(prev => ({ ...prev, ...payload.new }));
      }).subscribe();

    const channelWorkers = supabaseInstance
      .channel('realtime-workers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          upsertById(setWorkers)(payload.new);
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new;
          setWorkers(prev => prev.map(w => w.id === updated.id ? { ...w, ...updated } : w));
          setCurrentUser(prev => {
            if (!prev || prev.id !== updated.id) return prev;
            const hasChange = Object.keys(updated).some(k => prev[k] !== updated[k]);
            if (!hasChange) return prev;
            const merged = { ...prev, ...updated };
            localStorage.setItem('magnetic_user', JSON.stringify(merged));
            return merged;
          });
        } else if (payload.eventType === 'DELETE') {
          removeById(setWorkers)(payload.old);
        }
      })
      .subscribe();

    const channelClients = supabaseInstance
      .channel('realtime-clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, (payload) => {
        if (payload.eventType === 'DELETE') removeById(setClients)(payload.old);
        else upsertById(setClients)(payload.new);
      }).subscribe();

    return () => {
      supabaseInstance.removeChannel(channelNotif);
      supabaseInstance.removeChannel(channelCorrections);
      supabaseInstance.removeChannel(channelCorrectionItems);
      supabaseInstance.removeChannel(channelClientApprovals);
      supabaseInstance.removeChannel(channelLogs);
      supabaseInstance.removeChannel(channelChangeReqs);
      supabaseInstance.removeChannel(channelAbsences);
      supabaseInstance.removeChannel(channelDocuments);
      supabaseInstance.removeChannel(channelSchedules);
      supabaseInstance.removeChannel(channelPersonalSchedules);
      supabaseInstance.removeChannel(channelApprovals);
      supabaseInstance.removeChannel(channelExpenses);
      supabaseInstance.removeChannel(channelSettings);
      supabaseInstance.removeChannel(channelWorkers);
      supabaseInstance.removeChannel(channelClients);
    };
  }, [isDbReady, hasSession]);

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
        // Campos GPS — só incluir quando não-nulos para não falhar se as colunas ainda não existirem na DB
        ...(data.check_in_lat  != null && { check_in_lat:    data.check_in_lat }),
        ...(data.check_in_lng  != null && { check_in_lng:    data.check_in_lng }),
        ...(data.geo_verified  != null && { geo_verified:    data.geo_verified }),
        ...(data.break_start_lat != null && { break_start_lat: data.break_start_lat }),
        ...(data.break_start_lng != null && { break_start_lng: data.break_start_lng }),
        ...(data.break_end_lat != null && { break_end_lat:   data.break_end_lat }),
        ...(data.break_end_lng != null && { break_end_lng:   data.break_end_lng }),
        ...(data.check_out_lat != null && { check_out_lat:   data.check_out_lat }),
        ...(data.check_out_lng != null && { check_out_lng:   data.check_out_lng }),
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
      // vencimento_base/subsidio_alimentacao_dia são `numeric` na BD — um
      // trabalhador novo que não visite a aba Financeiro chega aqui com ''
      // (valor de arranque do formulário), e o Postgres rejeita ''::numeric
      // (22P02). null é válido (coluna aceita NULL) e o upsert passa a
      // gravar, ficando por preencher em vez de nunca ser criado.
      if (payload.vencimento_base === '') payload.vencimento_base = null;
      if (payload.subsidio_alimentacao_dia === '') payload.subsidio_alimentacao_dia = null;
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
    if (error) {
      console.error(`Erro ao gravar em ${tableName}:`, error);
      if (tableName === 'logs' || tableName === 'workers') {
        // Erro visível ao admin — o registo não foi guardado na base de dados.
        // 'workers' juntou-se aqui depois de um upsert falhar em silêncio
        // (''::numeric rejeitado pelo Postgres) sem nunca aparecer no ecrã —
        // o estado local já tinha sido actualizado de forma optimista antes
        // desta chamada, por isso o trabalhador parecia gravado até recarregar.
        window.alert(`Erro ao guardar ${tableName === 'workers' ? 'trabalhador' : 'registo'}: ${error.message || error.code || 'Erro desconhecido'}. Tenta novamente.`);
      }
    }
  };

  const handleApproveMonth = async (workerId, { notifyAdmin = false } = {}) => {
    const monthStr = toISODateLocal(currentMonth).substring(0, 7);
    const id = "appr_" + workerId + "_" + monthStr;
    await saveToDb('approvals', id, { id, workerId, month: monthStr, timestamp: new Date().toISOString() });
    const nId = `notif_appr_${workerId}_${monthStr}`;
    await saveToDb('app_notifications', nId, {
      id: nId,
      title: `✅ Registo do mês aprovado`,
      message: `O teu registo de ${monthStr} foi aprovado.`,
      type: 'success',
      target_type: 'specific',
      target_worker_ids: [workerId],
      is_dismissible: true,
      is_active: true,
      read_by_ids: [],
      created_at: new Date().toISOString(),
    });
    if (notifyAdmin) {
      const worker = workers?.find(w => String(w.id) === String(workerId));
      const adminNId = `notif_submit_${workerId}_${monthStr}`;
      await saveToDb('app_notifications', adminNId, {
        id: adminNId,
        title: `📋 Mês submetido: ${worker?.name || 'Trabalhador'}`,
        message: `${worker?.name || 'Trabalhador'} submeteu o registo de ${monthStr} para aprovação.`,
        type: 'info',
        target_type: 'admin',
        is_dismissible: true,
        is_active: true,
        read_by_ids: [],
        created_at: new Date().toISOString(),
      });
    }
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
      if (!prev) return prev;
      // Só actualizar se algum campo realmente mudou — evita re-renders desnecessários
      const hasChange = Object.keys(fresh).some(k => prev[k] !== fresh[k]);
      if (!hasChange) return prev;
      const merged = { ...prev, ...fresh };
      try { localStorage.setItem('magnetic_user', JSON.stringify(merged)); } catch { /* ignore */ }
      return merged;
    });
  }, [workers]);

  const handleDelete = async (colName, id) => {
    // Local state updates
    const filterState = (setter) => setter(prev => prev.filter(x => x.id !== id));

    // Apagar um colaborador falha em silêncio quando há registos
    // dependentes sem CASCADE (formacao_participantes, worker_apolice_seguro,
    // worker_whatsapp_messages — de propósito, são registos de conformidade)
    // — o Supabase devolve um erro de foreign key, mas nada verificava isso:
    // o ecrã já tinha removido a linha por otimismo, e o colaborador só
    // "voltava" ao recarregar a página, sem nenhum aviso do que aconteceu.
    const deletedWorker = colName === 'workers' ? workers.find(w => w.id === id) : null;

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

    const { error } = await supabaseInstance.from(deleteTable).delete().eq('id', id);

    if (error && colName === 'workers' && deletedWorker) {
      const restoreWorker = () => setWorkers(prev => prev.some(w => w.id === id) ? prev : [...prev, deletedWorker]);

      // Apagar de vez, a pedido explícito do admin. Feito via RPC
      // (SECURITY DEFINER), não com deletes diretos do cliente aqui —
      // formacao_participantes/formacoes_internas têm RLS ativo sem
      // nenhuma policy, por isso um delete/update normal do cliente afeta
      // sempre 0 linhas em silêncio (sem erro), o que fazia esta confirmação
      // parecer aceite mas nunca remover o bloqueio real. Ver
      // forcar_apagar_worker() na base de dados para a lista completa do
      // que é apagado (formações, seguro, mensagens WhatsApp) — mantidos
      // sem CASCADE de propósito, só saem daqui com esta confirmação
      // explícita.
      if (error.code === '23503' && window.confirm(
        `Não foi possível apagar "${deletedWorker.name}" porque tem registos associados (formações, seguro ou mensagens WhatsApp) — mantidos de propósito, por serem registos de conformidade.\n\n` +
        'Queres apagar também esses registos e o colaborador, de forma definitiva e irreversível?\n\n' +
        '"Cancelar" mantém tudo — considera marcar o colaborador como inativo em vez de apagar.'
      )) {
        const { error: forceErr } = await supabaseInstance.rpc('forcar_apagar_worker', { p_worker_id: id });
        if (forceErr) {
          restoreWorker();
          window.alert(`Não foi possível apagar "${deletedWorker.name}" mesmo depois de remover os registos associados: ${forceErr.message}`);
        }
        return;
      }

      restoreWorker();
      window.alert(
        `Não foi possível apagar "${deletedWorker.name}": ${error.message}\n\n` +
        'Provavelmente tem formações, seguro ou outros registos associados. ' +
        'Considera marcá-lo como inativo em vez de apagar.'
      );
    }
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

  const saveGmailQueryConfigContador = async (config) => {
    setGmailQueryConfigContador(config);
    if (!supabaseInstance) return;
    const { error } = await supabaseInstance
      .from('system_settings')
      .upsert({ id: 1, gmail_query_config_contador: config, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) console.error('Erro ao gravar gmail_query_config_contador:', error);
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
    if (error) {
      console.error('Erro ao gravar system_settings:', error);
      window.alert(`Não foi possível gravar as Configurações: ${error.message}`);
    }
  };

  const value = {
    systemSettings, setSystemSettings, saveSystemSettings,
    gmailQueryConfig, saveGmailQueryConfig,
    gmailQueryConfigContador, saveGmailQueryConfigContador,
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
