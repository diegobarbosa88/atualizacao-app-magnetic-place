import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import CompanyLogo from '../../components/common/CompanyLogo'
import { useAdminData } from './context/AdminDataProvider'
import {
  LayoutGrid, Clock, Bell, LogOut, BarChart3, Users, FileText, Settings,
  X, ChevronLeft, ChevronRight, Zap
} from 'lucide-react'

export default function AdminLayout(props) {
  const navigate = useNavigate()
  const location = useLocation()
  const ctx = useAdminData()

  const {
    app, logs, workers, clients, systemSettings,
    onLogout, handleDelete,
    currentUser,
    currentMonth, setCurrentMonth,
    portalSubTab, setPortalSubTab,
    portalMonth, setPortalMonth,
    selectedCorrectionId, setSelectedCorrectionId,
    reportFilter, setReportFilter,
    printingReport, setPrintingReport,
    workerChangeRequests, corrections, appNotifications,
    pendingChangeRequests, pendingClientCorrectionsCount,
    pendingWorkerCorrectionsCount, totalPendingCorrections,
    workerSubmissionUnread, unreadCount,
    isRead, isViewed,
    markNotifRead, markCorrectionsViewed, handleDismissAdminNotif, getNotificationBadge
  } = ctx

  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const notifDropdownRef = useRef(null)

  const pathParts = location.pathname.replace('/admin', '').split('/').filter(Boolean)
  const activeTab = pathParts[0] || 'overview'

  const handleTabClick = (tabKey) => {
    const path = tabKey === 'overview' ? '' : tabKey
    navigate(`/admin/${path}`)
  }

  const tabs = [
    { key: 'overview', label: 'Geral', icon: LayoutGrid },
    { key: 'team', label: 'Equipa', icon: Users },
    { key: 'clients', label: 'Clientes', icon: FileText },
    { key: 'portal_validacao', label: 'Portal Validação', icon: Bell, badge: totalPendingCorrections },
    { key: 'schedules', label: 'Horários', icon: Clock },
    { key: 'reports', label: 'Relatórios', icon: BarChart3 },
    { key: 'documentos', label: 'Documentos', icon: FileText },
    { key: 'costs', label: 'Custos', icon: LogOut },
    { key: 'settings', label: 'Settings', icon: Settings }
  ]

  useEffect(() => {
    if (!showNotifDropdown) return
    const handler = (e) => {
      if (e.target.closest('[data-notif-bell]')) return
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setShowNotifDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showNotifDropdown])

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans text-slate-900">
      <nav className="bg-white border-b border-slate-200 min-h-[4rem] sticky top-0 z-40 shadow-sm py-3 px-4 md:px-0">
        <div className="mx-auto md:px-10 lg:px-16 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-6" style={{ maxWidth: `var(--app-max-width)` }}>
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3 font-bold text-base tracking-tighter uppercase shrink-0">
              <CompanyLogo className="h-14 w-auto" />
              <span className="hidden md:inline">{systemSettings?.companyName}</span>
            </div>
            <div className="flex md:hidden items-center gap-1">
              <button data-notif-bell onClick={() => setShowNotifDropdown(s => !s)} className="flex items-center justify-center p-1 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 relative">
                <Bell size={17} />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
              </button>
              {currentUser?.isAdmin && <button onClick={() => app.handleLogin?.('worker', currentUser)} className="flex items-center justify-center p-1 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100"><Users size={18} /></button>}
              <button onClick={() => app.setShowFinReport?.(true)} className="flex items-center justify-center p-1 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100"><BarChart3 size={18} /></button>
              <button onClick={onLogout} className="p-1 text-slate-400"><LogOut size={18} /></button>
            </div>
          </div>

          <div className="flex-1 flex justify-center w-full md:w-auto">
            <div className="flex menu-scroll w-full md:w-auto items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto" style={{ scrollbarWidth: 'thin', msOverflowStyle: 'auto' }}>
              {tabs.map(t => {
                const Icon = t.icon
                const isActive = activeTab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => handleTabClick(t.key)}
                    className={`flex-shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${isActive ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'} ${t.key === 'portal_validacao' && totalPendingCorrections > 0 ? 'animate-pulse' : ''}`}
                  >
                    {t.key === 'portal_validacao' ? (
                      <span className="flex items-center gap-1">
                        {t.label}
                        {totalPendingCorrections > 0 && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{totalPendingCorrections}</span>}
                      </span>
                    ) : t.key === 'settings' ? (
                      <Settings size={14} />
                    ) : (
                      <><Icon size={14} className="inline mr-1" />{t.label}</>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 shrink-0">
            <button data-notif-bell onClick={() => setShowNotifDropdown(s => !s)} className="flex items-center justify-center p-1 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm relative">
              <Bell size={18} />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
            </button>
            <button onClick={() => app.setShowFinReport?.(true)} className="flex items-center justify-center p-1 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><BarChart3 size={18} /></button>
            {currentUser?.isAdmin && <button onClick={() => app.handleLogin?.('worker', currentUser)} className="flex items-center justify-center p-1 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Users size={18} /></button>}
            <button onClick={onLogout} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
          </div>
        </div>
      </nav>

      {showNotifDropdown && (
        <NotificationDropdown
          ctx={ctx}
          ref={notifDropdownRef}
          showNotifDropdown={showNotifDropdown}
          setShowNotifDropdown={setShowNotifDropdown}
          handleTabClick={handleTabClick}
        />
      )}

      <main className="w-full mt-4 pb-12">
        <div className="mx-auto px-3 sm:px-6 md:px-10 lg:px-16" style={{ maxWidth: `var(--app-max-width)` }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

const NotificationDropdown = React.forwardRef(function NotificationDropdown({ ctx, showNotifDropdown, setShowNotifDropdown, handleTabClick }, ref) {
  const {
    correctionNotifications, clients, workers, pendingChangeRequests, appNotifications,
    unreadCount, isRead, isViewed,
    markCorrectionsViewed, markNotifRead, handleDismissAdminNotif, getNotificationBadge,
    setSelectedCorrectionId
  } = ctx

  return (
    <div ref={ref} className="fixed top-[4.5rem] right-3 sm:right-6 z-[200] w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-top-2 duration-150">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Notificações</h3>
        <button onClick={() => setShowNotifDropdown(false)} className="p-1 text-slate-300 hover:text-slate-600 transition-colors"><X size={14} /></button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-50">
        {(correctionNotifications || []).filter(n => !isViewed(n)).map(corr => {
          const client = (clients || []).find(c => String(c.id) === String(corr.client_id))
          return (
            <button key={corr.id} onClick={() => { markCorrectionsViewed([corr.id]); setSelectedCorrectionId?.(corr.id); handleTabClick('portal_validacao'); setShowNotifDropdown(false); }} className="w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors flex items-start gap-3">
              <div className="p-2 rounded-xl bg-orange-100 text-orange-600 shrink-0 mt-0.5"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg></div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] font-black uppercase tracking-widest text-orange-500 block">Report de Cliente</span>
                <p className="text-xs font-black text-slate-800 truncate">{client?.name || 'Cliente'}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Mês <span className="font-bold">{corr.month}</span></p>
              </div>
            </button>
          )
        })}
        {pendingChangeRequests.map(req => {
          const worker = (workers || []).find(w => w.id === req.worker_id)
          return (
            <button key={req.id} onClick={() => { handleTabClick('team'); setShowNotifDropdown(false); }} className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-600 shrink-0 mt-0.5"><Users size={14} /></div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] font-black uppercase tracking-widest text-amber-500 block">Alteração de Dados</span>
                <p className="text-xs font-black text-slate-800 truncate">{worker?.name || 'Trabalhador'}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Campo: <span className="font-bold">{req.field_label}</span></p>
              </div>
            </button>
          )
        })}
        {(() => {
          const seenCorrIds = new Set()
          const workerNotifs = (appNotifications || []).filter(n => {
            if (isRead(n)) return false
            if (n.target_type !== 'admin') return false
            if (n.payload?.kind !== 'submitted') return false
            const cid = n.payload?.correction_id
            if (!cid) return false
            if (seenCorrIds.has(cid)) return false
            seenCorrIds.add(cid)
            return true
          })
          if (workerNotifs.length === 0) return null
          return (
            <button onClick={() => { workerNotifs.forEach(n => markNotifRead(n.id)); handleTabClick('portal_validacao'); setShowNotifDropdown(false); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 shrink-0 mt-0.5"><Clock size={14} /></div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500 block">Pedidos de Workers</span>
                <p className="text-xs font-black text-slate-800 truncate">{workerNotifs.length} pedido{workerNotifs.length > 1 ? 's' : ''} pendente{workerNotifs.length > 1 ? 's' : ''}</p>
              </div>
            </button>
          )
        })()}
        {(appNotifications || []).filter(n => { if (isRead(n)) return false; if (n.payload?.kind === 'submitted') return false; return true }).map(notif => {
          const badge = getNotificationBadge(notif)
          const styles = notif.type === 'urgent' ? { hover: 'hover:bg-rose-50', icon: 'bg-rose-100 text-rose-600', label: 'text-rose-500', tag: 'Urgente' }
            : notif.type === 'warning' ? { hover: 'hover:bg-yellow-50', icon: 'bg-yellow-100 text-yellow-600', label: 'text-yellow-500', tag: 'Aviso' }
            : notif.type === 'danger' ? { hover: 'hover:bg-rose-50', icon: 'bg-rose-100 text-rose-600', label: 'text-rose-500', tag: 'Eliminar' }
            : notif.type === 'success' ? { hover: 'hover:bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', label: 'text-emerald-500', tag: 'Sucesso' }
            : { hover: 'hover:bg-indigo-50', icon: 'bg-indigo-100 text-indigo-600', label: 'text-indigo-500', tag: 'Informação' }
          return (
            <button key={notif.id} onClick={() => {
              if (badge.resolved) { handleDismissAdminNotif(notif.id); return }
              markNotifRead(notif.id)
              const corrId = notif.payload?.correction_id || notif.payload?.correcao_id
              if (corrId) { setSelectedCorrectionId?.(corrId); handleTabClick('portal_validacao') }
              else handleTabClick('notificacoes')
              setShowNotifDropdown(false)
            }} className={`w-full text-left px-4 py-3 ${styles.hover} transition-colors flex items-start gap-3 ${badge.resolved ? 'opacity-60' : ''}`}>
              <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${styles.icon}`}>{notif.type === 'danger' ? <Zap size={14} /> : <Bell size={14} />}</div>
              <div className="min-w-0 flex-1">
                <span className={`text-[8px] font-black uppercase tracking-widest ${styles.label} block`}>{styles.tag}</span>
                <p className="text-xs font-black text-slate-800 truncate">{notif.title}</p>
                {badge.resolved && <span className={`text-[9px] font-black px-2 py-0.5 rounded mt-1 inline-block ${badge.status === 'applied' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{badge.label}</span>}
                {!badge.resolved && <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{notif.message}</p>}
              </div>
              {badge.resolved ? (
                <button onClick={(e) => { e.stopPropagation(); handleDismissAdminNotif(notif.id) }} className="p-1 text-slate-400 hover:text-slate-600 shrink-0"><X size={14} /></button>
              ) : <ChevronRight size={14} className="text-slate-300 shrink-0 mt-1" />}
            </button>
          )
        })}
        {unreadCount === 0 && (
          <div className="px-4 py-8 text-center">
            <Bell size={24} className="text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Sem notificações por ler</p>
          </div>
        )}
      </div>
      <div className="border-t border-slate-100 p-2">
        <button onClick={() => { handleTabClick('notificacoes'); setShowNotifDropdown(false); }} className="w-full text-center text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest py-1.5 hover:bg-indigo-50 rounded-xl transition-colors">
          Ver todas as notificações →
        </button>
      </div>
    </div>
  )
})



