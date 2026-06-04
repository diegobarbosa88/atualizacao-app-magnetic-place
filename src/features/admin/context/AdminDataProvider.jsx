import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { useApp } from '../../../context/AppContext'
import { toISODateLocal, isSameMonth } from '../../../utils/dateUtils'

const AdminDataContext = createContext(null)

export function useAdminData() {
  const ctx = useContext(AdminDataContext)
  if (!ctx) throw new Error('useAdminData must be used within AdminDataProvider')
  return ctx
}

export function AdminDataProvider({ children, value: externalValue }) {
  if (externalValue) {
    return (
      <AdminDataContext.Provider value={externalValue}>
        {children}
      </AdminDataContext.Provider>
    )
  }
  return <AdminDataProviderInternal>{children}</AdminDataProviderInternal>
}

function AdminDataProviderInternal({ children }) {
  const app = useApp()
  const {
    logs, workers, clients, adminStats, schedules, expenses,
    systemSettings, documents, setDocuments,
    correctionNotifications, appNotifications, workerChangeRequests,
    corrections, correctionItems,
    saveToDb, setSystemSettings, saveSystemSettings,
    supabase, companySignature, saveCompanySignature,
    stampStyle, setStampStyle, approvals, clientApprovals,
    onLogout, handleDelete
  } = app

  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [portalSubTab, setPortalSubTab] = useState('correcoes')
  const [portalMonth, setPortalMonth] = useState(() => new Date())
  const [selectedCorrectionId, setSelectedCorrectionId] = useState(null)
  const [showRecalcModal, setShowRecalcModal] = useState(false)
  const [recalcProgress, setRecalcProgress] = useState({ current: 0, total: 0, done: false })

  const [reportFilter, setReportFilter] = useState({ clientId: '', workerId: '', month: toISODateLocal(new Date()).substring(0, 7) })
  const [printingReport, setPrintingReport] = useState(null)
  const [reportHistory, setReportHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('reportHistory') || '[]') } catch { return [] }
  })

  const [optimisticReadIds, setOptimisticReadIds] = useState(new Set())
  const [optimisticViewedCorrIds, setOptimisticViewedCorrIds] = useState(new Set())
  const [dismissedAdminNotifs, setDismissedAdminNotifs] = useState([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('dismissed_admin_notifs')
      if (stored) setDismissedAdminNotifs(JSON.parse(stored))
    } catch {}
  }, [])

  const { currentUser } = app

  const isRead = useCallback((n) => (n.read_by_admin_ids || []).includes(currentUser?.id) || optimisticReadIds.has(n.id), [currentUser?.id, optimisticReadIds])
  const isViewed = useCallback((n) => (n.viewed_by_admin_ids || []).includes(currentUser?.id) || optimisticViewedCorrIds.has(n.id), [currentUser?.id, optimisticViewedCorrIds])

  const pendingChangeRequests = useMemo(() => (workerChangeRequests || []).filter(r => r.status === 'pending'), [workerChangeRequests])
  const pendingClientCorrectionsCount = useMemo(() => (correctionNotifications || []).length, [correctionNotifications])
  const pendingWorkerCorrectionsCount = useMemo(() => (corrections || []).filter(c => (c.type === 'creation_request' || c.type === 'deletion_request') && (c.status === 'submitted' || c.status === 'under_review')).length, [corrections])
  const totalPendingCorrections = pendingClientCorrectionsCount + pendingWorkerCorrectionsCount

  const workerSubmissionUnread = useMemo(() => (appNotifications || []).filter(n => {
    if (n.target_type !== 'admin') return false
    if (n.payload?.kind !== 'submitted') return false
    if (isRead(n)) return false
    if (dismissedAdminNotifs.includes(n.id)) return false
    return true
  }).length, [appNotifications, isRead, dismissedAdminNotifs])

  const unreadCount = workerSubmissionUnread + pendingChangeRequests.length

  const markNotifRead = useCallback(async (id) => {
    const previousState = optimisticReadIds
    setOptimisticReadIds(prev => new Set([...prev, id]))
    try {
      if (!currentUser?.id || !supabase) return
      const notif = (appNotifications || []).find(n => n.id === id)
      if (!notif) return
      const current = notif.read_by_admin_ids || []
      if (current.includes(currentUser.id)) return
      await supabase.from('app_notifications').update({ read_by_admin_ids: [...current, currentUser.id] }).eq('id', id)
    } catch (err) {
      setOptimisticReadIds(previousState)
      console.error('Failed to mark notification as read:', err)
    }
  }, [currentUser?.id, supabase, appNotifications, optimisticReadIds])

  const markCorrectionsViewed = useCallback(async (specificIds) => {
    const allIds = specificIds ?? (correctionNotifications || []).map(n => n.id)
    setOptimisticViewedCorrIds(prev => new Set([...prev, ...allIds]))
    if (!currentUser?.id || !supabase) return
    const toMark = specificIds ? (correctionNotifications || []).filter(n => specificIds.includes(n.id)) : (correctionNotifications || [])
    await Promise.all(toMark.map(async n => {
      const current = n.viewed_by_admin_ids || []
      if (current.includes(currentUser.id)) return
      await supabase.from('corrections').update({ viewed_by_admin_ids: [...current, currentUser.id] }).eq('id', n.id)
    }))
  }, [currentUser?.id, supabase, correctionNotifications, optimisticViewedCorrIds])

  const handleDismissAdminNotif = useCallback((id) => {
    setDismissedAdminNotifs(prev => {
      if (prev.includes(id)) return prev
      const updated = [...prev, id]
      localStorage.setItem('dismissed_admin_notifs', JSON.stringify(updated))
      return updated
    })
  }, [])

  const getNotificationBadge = useCallback((notif) => {
    if (notif.payload?.kind === 'submitted') {
      const corr = (corrections || []).find(c => c.id === notif.payload?.correction_id)
      if (corr && corr.status && corr.status !== 'submitted' && corr.status !== 'under_review') {
        return { resolved: true, status: corr.status, label: corr.status === 'applied' ? 'Aprovado' : 'Rejeitado' }
      }
    }
    return { resolved: false }
  }, [corrections])

  const activeReportsCount = useMemo(() => {
    if (!reportFilter.month) return 0
    return (logs || []).filter(l => l.date?.startsWith(reportFilter.month)).length
  }, [logs, reportFilter.month])

  const activeClientsCount = useMemo(() => {
    if (!reportFilter.month) return (clients || []).length
    return [...new Set((logs || []).filter(l => l.date?.startsWith(reportFilter.month)).map(l => l.clientId))].length
  }, [logs, reportFilter.month, clients])

  const activeWorkersCount = useMemo(() => {
    if (!reportFilter.month) return (workers || []).filter(w => w.is_active !== false).length
    return [...new Set((logs || []).filter(l => l.date?.startsWith(reportFilter.month)).map(l => l.workerId))].length
  }, [logs, reportFilter.month, workers])

  const value = {
    app,
    logs, workers, clients, adminStats, schedules, expenses,
    systemSettings, documents, setDocuments,
    correctionNotifications, appNotifications, workerChangeRequests,
    corrections, correctionItems,
    saveToDb, setSystemSettings, saveSystemSettings,
    supabase, companySignature, saveCompanySignature,
    stampStyle, setStampStyle, approvals, clientApprovals,
    onLogout, handleDelete,
    currentUser,
    currentMonth, setCurrentMonth,
    portalSubTab, setPortalSubTab,
    portalMonth, setPortalMonth,
    selectedCorrectionId, setSelectedCorrectionId,
    showRecalcModal, setShowRecalcModal,
    recalcProgress, setRecalcProgress,
    reportFilter, setReportFilter,
    printingReport, setPrintingReport,
    reportHistory, setReportHistory,
    optimisticReadIds, setOptimisticReadIds,
    optimisticViewedCorrIds, setOptimisticViewedCorrIds,
    dismissedAdminNotifs, setDismissedAdminNotifs,
    isRead, isViewed,
    pendingChangeRequests, pendingClientCorrectionsCount,
    pendingWorkerCorrectionsCount, totalPendingCorrections,
    workerSubmissionUnread, unreadCount,
    markNotifRead, markCorrectionsViewed, handleDismissAdminNotif, getNotificationBadge,
    activeReportsCount, activeClientsCount, activeWorkersCount
  }

  return (
    <AdminDataContext.Provider value={value}>
      {children}
    </AdminDataContext.Provider>
  )
}