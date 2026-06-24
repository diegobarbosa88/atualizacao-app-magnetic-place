import React, { createContext, useContext, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { 
  toISODateLocal,
  isSameMonth,
  getLastBusinessDayOfMonth
} from '../../../utils/dateUtils';
import {
  calculateExpectedMonthlyHours,
  getScheduleForDay
} from '../../../utils/formatUtils';
import {
  Clock, ChevronLeft, ChevronRight, Calendar, CheckCircle, 
  LogOut, Timer, TrendingUp, Edit2, Save, X, Plus, Users,
  AlertCircle, Briefcase, FileText, Trash2, UserCircle, Coffee, Star, Zap, ChevronUp, ChevronDown
} from 'lucide-react';

const WorkerContext = createContext(null);

export const useWorker = () => useContext(WorkerContext);

export const WorkerProvider = ({ children, handleSaveEntry }) => {
  const {
    currentUser, setCurrentUser, currentMonth, setCurrentMonth,
    logs, clients, schedules, personalSchedules,
    saveToDb, handleDelete, approvals, handleApproveMonth,
    systemSettings, documents, appNotifications, supabase
  } = useApp();

  // Local state
  const [inlineEditingDate, setInlineEditingDate] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [inlineFormData, setInlineFormData] = useState({});
  const [mainFormData, setMainFormData] = useState({
    id: null,
    date: toISODateLocal(new Date()),
    clientId: '',
    startTime: '',
    breakStart: '',
    breakEnd: '',
    endTime: '',
    description: ''
  });

  // Hidrata clientId com o default do utilizador ao montar/mudar de utilizador
  useEffect(() => {
    if (currentUser?.defaultClientId) {
      setMainFormData(prev => prev.clientId ? prev : { ...prev, clientId: currentUser.defaultClientId });
    }
  }, [currentUser?.defaultClientId]);
  const [showSchedulesModal, setShowSchedulesModal] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [expandedDays, setExpandedDays] = useState([]);
  const [showPersonalBreaks, setShowPersonalBreaks] = useState(false);
  const [newPersonalForm, setNewPersonalForm] = useState({ 
    name: '', startTime: '', breakStart: '', breakEnd: '', endTime: '', weekdays: [1, 2, 3, 4, 5] 
  });
  const [dismissedNotifs, setDismissedNotifs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`dismissed_notifs_${currentUser?.id}`) || '[]');
    } catch { return []; }
  });

  // Computed values
  const todayStr = toISODateLocal(new Date());
  // workerId pode vir como camelCase, lowercase ou snake_case dependendo de como a coluna foi criada no Supabase
  const _wId = (l) => String(l.workerId ?? l.workerid ?? l.worker_id ?? '');
  const monthLogs = logs?.filter(l => _wId(l) === String(currentUser?.id) && isSameMonth(l.date, currentMonth)) || [];
  const todayHours = monthLogs.filter(l => l.date === todayStr).reduce((a, b) => a + (b.hours || 0), 0);
  const totalMonthHours = monthLogs.reduce((acc, curr) => acc + (curr.hours || 0), 0);

  const previousOpenLogs = useMemo(() => {
    if (!currentUser) return [];
    return (logs || []).filter(l =>
      _wId(l) === String(currentUser.id) &&
      l.startTime && !l.endTime &&
      l.date < todayStr
    );
  }, [logs, currentUser, todayStr]);

  const activeWorkerSchedule = schedules.find(s => s.id === currentUser?.defaultScheduleId) || personalSchedules.find(p => p.id === currentUser?.defaultScheduleId);
  const expectedHours = activeWorkerSchedule ? calculateExpectedMonthlyHours(activeWorkerSchedule, currentMonth) : 0;

  const daysList = Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }, (_, i) => toISODateLocal(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1)));

  const assigned = schedules.filter(s => currentUser?.assignedSchedules?.includes(s.id));
  const myPersonals = personalSchedules.filter(ps => String(ps.workerId ?? ps.workerid ?? ps.worker_id ?? '') === String(currentUser?.id));

  const currentMonthStr = toISODateLocal(currentMonth).substring(0, 7);
  const myApproval = approvals?.find(a => String(a.workerId ?? a.workerid ?? a.worker_id ?? '') === String(currentUser?.id) && a.month === currentMonthStr);

  const myNotifications = useMemo(() => {
    if (!appNotifications || !currentUser) return [];
    return appNotifications.filter(n => 
      (!n.viewed_by_ids || !n.viewed_by_ids.includes(currentUser.id)) &&
      (!n.dismissed_by_ids || !n.dismissed_by_ids.includes(currentUser.id)) &&
      (n.workerId === currentUser.id || !n.workerId)
    );
  }, [appNotifications, currentUser]);

  // Pending approvals computation
  const pendingApprovals = useMemo(() => {
    const pending = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkPending = (d) => {
      const mStr = toISODateLocal(d).substring(0, 7);
      const lBiz = getLastBusinessDayOfMonth(d);
      lBiz.setHours(0, 0, 0, 0);
      if (today.getTime() >= lBiz.getTime()) {
        const isApproved = approvals?.some(a => String(a.workerId ?? a.workerid ?? a.worker_id ?? '') === String(currentUser?.id) && a.month === mStr);
        if (!isApproved) {
          pending.push({ date: d, monthStr: mStr });
        }
      }
    };

    checkPending(new Date());
    const prevM = new Date();
    prevM.setMonth(prevM.getMonth() - 1);
    checkPending(prevM);

    return pending;
  }, [approvals, currentUser?.id]);

  // Auto-mark notifications as viewed
  useEffect(() => {
    if (!currentUser || !appNotifications || appNotifications.length === 0) return;

    myNotifications.forEach(async (notif) => {
      const viewedIds = notif.viewed_by_ids || [];
      if (!viewedIds.includes(currentUser.id)) {
        if (supabase) {
          await supabase.from('app_notifications').update({
            viewed_by_ids: [...viewedIds, currentUser.id]
          }).eq('id', notif.id);
        }
      }
    });
  }, [currentUser?.id, myNotifications]);

  // Handlers
  const handleDismissNotif = async (id) => {
    const updated = [...dismissedNotifs, id];
    setDismissedNotifs(updated);
    localStorage.setItem(`dismissed_notifs_${currentUser?.id}`, JSON.stringify(updated));

    const notif = appNotifications?.find(n => n.id === id);
    if (notif && supabase) {
      const dismissedIds = notif.dismissed_by_ids || [];
      if (!dismissedIds.includes(currentUser.id)) {
        await supabase.from('app_notifications').update({
          dismissed_by_ids: [...dismissedIds, currentUser.id]
        }).eq('id', id);
      }
    }
  };

  const handleOpenInlineForm = useCallback((ds) => {
    if (!expandedDays.includes(ds)) setExpandedDays(prev => [...prev, ds]);
    setInlineEditingDate(ds);
    setInlineFormData({
      id: null, date: ds, clientId: currentUser?.defaultClientId || '', startTime: '', breakStart: '', breakEnd: '', endTime: '', description: ''
    });
  }, [expandedDays, currentUser]);

  const handleOpenInlineFormDelete = useCallback((ds) => {
    if (!expandedDays.includes(ds)) setExpandedDays(prev => [...prev, ds]);
    setInlineEditingDate(ds);
    setInlineFormData({
      id: null, date: ds, clientId: currentUser?.defaultClientId || '', startTime: '', breakStart: '', breakEnd: '', endTime: '', description: '', _deleteMode: true
    });
  }, [expandedDays, currentUser]);

  const handleQuickRegister = useCallback((ds) => {
    const s = schedules.find(s => s.id === currentUser?.defaultScheduleId) || myPersonals.find(p => p.id === currentUser?.defaultScheduleId);
    if (!currentUser?.defaultClientId || !s) {
      handleOpenInlineForm(ds);
      return false;
    }
    const dsConfig = getScheduleForDay(s, ds);
    if (!dsConfig) { handleOpenInlineForm(ds); return false; }
    handleSaveEntry({
      clientId: currentUser.defaultClientId,
      startTime: dsConfig.startTime,
      breakStart: dsConfig.breakStart,
      breakEnd: dsConfig.breakEnd,
      endTime: dsConfig.endTime,
      description: 'Registo Rápido (Padrão)'
    }, false, ds);
    return true;
  }, [currentUser, schedules, myPersonals, handleSaveEntry, handleOpenInlineForm]);

  const savePersonalSchedule = useCallback(() => {
    if (!newPersonalForm.name) return;
    const pId = `ps${Date.now()}`;
    saveToDb('personalSchedules', pId, { ...newPersonalForm, id: pId, workerId: currentUser?.id });
    setNewPersonalForm({ name: '', startTime: '', breakStart: '', breakEnd: '', endTime: '', weekdays: [1, 2, 3, 4, 5] });
  }, [newPersonalForm, saveToDb, currentUser]);

  const setDefaultSchedule = useCallback((sId) => {
    saveToDb('workers', currentUser?.id, { ...currentUser, defaultScheduleId: sId });
    setCurrentUser(prev => prev ? { ...prev, defaultScheduleId: sId } : null);
  }, [currentUser, saveToDb, setCurrentUser]);

  // Context value
  const value = {
    // State
    currentUser,
    currentMonth,
    setCurrentMonth,
    logs,
    clients,
    schedules,
    personalSchedules,
    approvals,
    documents,
    systemSettings,
    // Local state
    inlineEditingDate, setInlineEditingDate,
    successMsg, setSuccessMsg,
    inlineFormData, setInlineFormData,
    mainFormData, setMainFormData,
    showSchedulesModal, setShowSchedulesModal,
    showProgress, setShowProgress,
    expandedDays, setExpandedDays,
    showPersonalBreaks, setShowPersonalBreaks,
    newPersonalForm, setNewPersonalForm,
    dismissedNotifs,
    // Computed
    monthLogs,
    todayHours,
    totalMonthHours,
    activeWorkerSchedule,
    expectedHours,
    daysList,
    assigned,
    myPersonals,
    currentMonthStr,
    myApproval,
    myNotifications,
    pendingApprovals,
    previousOpenLogs,
    // Handlers
    handleDismissNotif,
    handleOpenInlineForm,
    handleOpenInlineFormDelete,
    handleQuickRegister,
    savePersonalSchedule,
    setDefaultSchedule,
    handleSaveEntry,
    saveToDb,
    handleDelete,
    handleApproveMonth
  };

  return (
    <WorkerContext.Provider value={value}>
      {children}
    </WorkerContext.Provider>
  );
};

export default WorkerContext;