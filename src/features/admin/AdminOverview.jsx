import React, { useState, useMemo } from 'react'
import {
  Settings2, CheckCircle, X, Trash2, Plus, LayoutGrid,
  ChevronLeft, ChevronRight, Clock, TrendingUp, TrendingDown,
  Wallet, Activity, Trophy, History
} from 'lucide-react'
import { useAdminData } from './context/AdminDataProvider'
import { toISODateLocal, isSameMonth } from '../../utils/dateUtils'
import { formatHours, formatCurrency } from '../../utils/formatUtils'
import EntryForm from '../../components/common/EntryForm'
import OverviewCharts from './components/OverviewCharts'

export default function AdminOverview() {
  const {
    logs, workers, clients, adminStats, currentMonth, setCurrentMonth,
    systemSettings, approvals, handleDelete, saveToDb
  } = useAdminData()

  const [auditWorkerId, setAuditWorkerId] = useState(null)
  const [expandedItems, setExpandedItems] = useState([])
  const [detailsPage, setDetailsPage] = useState(1)
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [inlineEditingDate, setInlineEditingDate] = useState(null)
  const [inlineFormData, setInlineFormData] = useState({})

  const auditedWorker = workers.find(w => w.id === auditWorkerId)
  const auditedMonthLogs = (logs || []).filter(l => l.workerId === auditWorkerId && isSameMonth(l.date, currentMonth))
  const daysInMonthList = useMemo(() => Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }, (_, i) => toISODateLocal(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1))), [currentMonth])
  const currentMonthStr = toISODateLocal(currentMonth).substring(0, 7)

  const getWorkingDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    let count = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let i = 1; i <= daysInMonth; i++) {
      const day = new Date(year, month, i).getDay()
      if (day !== 0 && day !== 6) count++
    }
    return count
  }

  const getWorkerExpectedHours = (workerId) => {
    const worker = workers.find(w => w.id === workerId)
    if (!worker?.defaultScheduleId) return 0
    const schedule = (worker.defaultSchedule || null)
    if (!schedule) return 0
    const hoursPerDay = (() => {
      const start = schedule.startTime
      const end = schedule.endTime
      if (!start || !end) return 0
      const [sh, sm] = start.split(':').map(Number)
      const [eh, em] = end.split(':').map(Number)
      let mins = (eh * 60 + em) - (sh * 60 + sm)
      if (mins < 0) mins += 24 * 60
      let breakMins = 0
      if (schedule.breakStart && schedule.breakEnd) {
        const [bsh, bsm] = schedule.breakStart.split(':').map(Number)
        const [beh, bem] = schedule.breakEnd.split(':').map(Number)
        breakMins = (beh * 60 + bem) - (bsh * 60 + bsm)
        if (breakMins < 0) breakMins += 24 * 60
      }
      return (mins - breakMins) / 60
    })()
    const workingDays = getWorkingDaysInMonth(currentMonth)
    return hoursPerDay * workingDays
  }

  const aggregatedTrend = useMemo(() => {
    const totalExpected = workers.reduce((sum, w) => sum + getWorkerExpectedHours(w.id), 0)
    const totalRegistered = adminStats.totalHours || 0
    if (totalExpected === 0) return { percent: 0, expected: 0 }
    return {
      percent: ((totalRegistered - totalExpected) / totalExpected * 100).toFixed(1),
      expected: totalExpected
    }
  }, [workers, currentMonth, adminStats])

  const todayDay = new Date().getDate()

  const filterPrevMonthProportional = (allLogs, prevMonth) =>
    (allLogs || []).filter(l => {
      if (!isSameMonth(l.date, prevMonth)) return false
      const d = new Date(l.date.split('T')[0])
      return d.getDate() <= todayDay
    })

  const prevMonthStats = useMemo(() => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    const prevLogs = filterPrevMonthProportional(logs, prevMonth)
    const totalHours = prevLogs.reduce((acc, l) => acc + (Number(l.hours) || 0), 0)
    let expectedRevenue = 0
    let expectedCosts = 0
    prevLogs.forEach(l => {
      const client = (clients || []).find(c => c.id === l.clientId)
      const worker = (workers || []).find(w => w.id === l.workerId)
      if (client) expectedRevenue += l.hours * (Number(client.valorHora) || 0)
      if (worker) expectedCosts += l.hours * (Number(worker.valorHora) || 0)
    })
    return { totalHours, expectedRevenue, expectedCosts }
  }, [logs, currentMonth, clients, workers])

  const vsLastMonth = useMemo(() => {
    const pct = (curr, prev) => {
      if (prev === 0) return null
      return Number(((curr - prev) / Math.abs(prev) * 100).toFixed(1))
    }
    const prevNetProfit = prevMonthStats.expectedRevenue - prevMonthStats.expectedCosts
    return {
      hours: pct(adminStats.totalHours || 0, prevMonthStats.totalHours),
      revenue: pct(adminStats.expectedRevenue || 0, prevMonthStats.expectedRevenue),
      costs: pct((adminStats.expectedCosts || 0) + (adminStats.monthlyExpenses || 0), prevMonthStats.expectedCosts),
      profit: pct(adminStats.netProfit || 0, prevNetProfit)
    }
  }, [adminStats, prevMonthStats])

  const workerComparisonData = useMemo(() => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    return (workers || []).map(w => {
      const filterByDay = (logList, month) =>
        (logList || []).filter(l => {
          if (!isSameMonth(l.date, month)) return false
          const d = new Date(l.date.split('T')[0])
          return d.getDate() <= todayDay
        })

      const currLogs = filterByDay((logs || []).filter(l => l.workerId === w.id), currentMonth)
      const prevLogs = filterByDay((logs || []).filter(l => l.workerId === w.id), prevMonth)
      const currHours = currLogs.reduce((sum, l) => sum + (l.hours || 0), 0)
      const prevHours = prevLogs.reduce((sum, l) => sum + (l.hours || 0), 0)
      const ratioPct = prevHours > 0 ? Number((currHours / prevHours * 100).toFixed(1)) : null
      const diffPct = prevHours > 0 ? Number(((currHours - prevHours) / prevHours * 100).toFixed(1)) : null
      return {
        id: w.id,
        name: w.name,
        registered: currHours,
        prevRegistered: prevHours,
        expected: getWorkerExpectedHours(w.id),
        ratioPct,
        diffPct,
        isOver: currHours >= prevHours && prevHours > 0
      }
    }).filter(w => w.registered > 0 || w.prevRegistered > 0)
      .sort((a, b) => (b.ratioPct || 0) - (a.ratioPct || 0))
  }, [workers, logs, currentMonth, todayDay])

  const topClientsWithPrev = useMemo(() => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    const currHours = {}
    const prevHours = {}
    ;(logs || []).forEach(l => {
      if (!l.clientId || !l.hours) return
      if (isSameMonth(l.date, currentMonth)) {
        currHours[l.clientId] = (currHours[l.clientId] || 0) + l.hours
      } else if (isSameMonth(l.date, prevMonth)) {
        const d = new Date(l.date.split('T')[0])
        if (d.getDate() <= todayDay) {
          prevHours[l.clientId] = (prevHours[l.clientId] || 0) + l.hours
        }
      }
    })
    const totalCurr = Object.values(currHours).reduce((a, b) => a + b, 0)
    return Object.keys(currHours)
      .map(id => {
        const curr = currHours[id]
        const prev = prevHours[id] || 0
        const pct = prev > 0 ? Number(((curr - prev) / prev * 100).toFixed(1)) : null
        return {
          id,
          name: (clients || []).find(c => c.id === id)?.name || 'Desconhecido',
          hours: curr,
          prevHours: prev,
          pct,
          totalCurr
        }
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5)
  }, [logs, currentMonth, clients, todayDay])

  const parseLogDate = (d) => {
    if (!d) return 0
    const ptMatch = d.match(/^(\d{2})\/(\d{2})/)
    if (ptMatch) return new Date(`${new Date().getFullYear()}-${ptMatch[2]}-${ptMatch[1]}`).getTime()
    const [y, m, day] = d.split('T')[0].split('-')
    return y && m && day ? new Date(`${y}-${m}-${day}`).getTime() : 0
  }

  const formatLogDate = (d) => {
    if (!d) return 'Data inválida'
    const ptMatch = d.match(/^(\d{2})\/(\d{2})/)
    if (ptMatch) return `${ptMatch[1]}/${ptMatch[2]}`
    const [y, m, day] = d.split('T')[0].split('-')
    return (y && m && day) ? `${day}/${m}/${y}` : 'Data inválida'
  }

  const handleOpenInlineForm = (ds) => {
    setInlineEditingDate(ds)
    setInlineFormData({ id: null, date: ds, clientId: auditedWorker?.defaultClientId || '', startTime: '', breakStart: '', breakEnd: '', endTime: '', description: '' })
  }

  const handleSaveEntry = async (data, isNew, dateStr) => {
    if (!data.clientId || !data.startTime || !data.endTime) return
    const id = data.id || `log_${Date.now()}`
    const entry = { id, ...data, workerId: auditWorkerId, hours: 0 }
    await saveToDb('logs', id, entry)
    setInlineEditingDate(null)
  }

  if (auditWorkerId && auditedWorker) {
    const currentApproval = (approvals || []).find(a => a.workerId === auditWorkerId && a.month === currentMonthStr)

    return (
      <div className="mb-6 bg-white rounded-2xl sm:rounded-[3rem] p-4 sm:p-8 lg:p-10 shadow-2xl border-4 border-indigo-500/20 animate-in slide-in-from-top-8 duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 gap-3 md:gap-6">
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="bg-slate-900 p-3 sm:p-5 rounded-2xl sm:rounded-3xl text-white shadow-xl"><Settings2 size={28} className="sm:hidden" /><Settings2 size={40} className="hidden sm:block" /></div>
            <div>
              <h2 className="text-xl sm:text-3xl font-black uppercase">Audit: {auditedWorker?.name}</h2>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Controlo Mensal Detalhado</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-[2.5rem] border border-slate-200">
            {currentApproval && (
              <div className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-[2rem] shadow-sm flex items-center gap-4 border border-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle size={20} />
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-70 leading-none">Status</span>
                    <span className="text-sm font-black leading-none">Aprovado</span>
                  </div>
                </div>
                <button onClick={() => handleDelete('approvals', currentApproval.id)} className="bg-white p-2 rounded-full text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-rose-100" title="Desbloquear Mês para o Trabalhador">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </button>
              </div>
            )}
            <div className="bg-slate-900 text-white px-8 py-3 rounded-[2rem] shadow-lg flex flex-col items-center"><span className="text-[8px] font-black uppercase opacity-70">Total Mês</span><span className="text-xl font-black">{formatHours(auditedMonthLogs.reduce((a, b) => a + b.hours, 0))}</span></div>
            <button onClick={() => setAuditWorkerId(null)} className="p-4 bg-white text-red-500 rounded-full border border-red-100 shadow-md"><X size={28} /></button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[3rem] border border-slate-100 bg-white shadow-inner">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 sm:px-10 py-4 sm:py-6 text-[10px] font-black uppercase tracking-widest w-16 sm:w-32">Dia</th>
                <th className="px-4 sm:px-10 py-4 sm:py-6 text-[10px] font-black uppercase tracking-widest">Actividades</th>
                <th className="px-4 sm:px-10 py-4 sm:py-6 text-[10px] font-black uppercase tracking-widest text-right">Acção</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {daysInMonthList.map(ds => {
                const dayLogs = (logs || []).filter(l => l.workerId === auditWorkerId && l.date === ds)
                const isCurrentInline = inlineEditingDate === ds
                return (
                  <React.Fragment key={ds}>
                    <tr className="group">
                      <td className="px-4 sm:px-10 py-4 sm:py-8 align-top"><p className="text-2xl sm:text-3xl font-black">{new Date(ds).getDate()}</p></td>
                      <td className="px-4 sm:px-10 py-4 sm:py-8">
                        <div className="space-y-3">
                          {dayLogs.map(log => (
                            <div key={log.id} className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl border border-indigo-100/50 flex items-center justify-between shadow-sm gap-2">
                              <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl uppercase border border-indigo-100">{(clients || []).find(c => c.id === log.clientId)?.name}</span>
                                <div className="text-sm font-bold font-mono">{log.startTime}-{log.endTime} {log.breakStart ? `(P: ${log.breakStart})` : ''}</div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-2xl font-black">{formatHours(log.hours)}</span>
                                <button onClick={() => handleDelete('logs', log.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Apagar Registo"><Trash2 size={18} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 sm:px-10 py-4 sm:py-8 text-right align-top">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleOpenInlineForm(ds)} className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all"><Plus size={20} /></button>
                        </div>
                      </td>
                    </tr>
                    {isCurrentInline && (
                      <tr><td colSpan={3} className="px-4 sm:px-10 py-4 bg-indigo-50/30">
                        <EntryForm isInline data={inlineFormData} clients={clients || []} assignedClients={auditedWorker?.assignedClients} onChange={setInlineFormData} onSave={() => handleSaveEntry(inlineFormData, false, ds)} onCancel={() => setInlineEditingDate(null)} />
                      </td></tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 sm:mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><LayoutGrid size={20} /></div>
          <h3 className="font-black text-base sm:text-xl text-slate-800 uppercase tracking-tight">Dashboard Geral</h3>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><ChevronLeft size={16} /></button>
          <span className="font-bold text-sm uppercase tracking-widest text-indigo-600 min-w-[120px] text-center">
            {currentMonth.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}
          </span>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2 sm:gap-3">
          <div className="flex justify-between items-start">
            <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl"><Clock size={24} /></div>
            {vsLastMonth.hours !== null && vsLastMonth.hours !== 0 && (
              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${vsLastMonth.hours >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{vsLastMonth.hours >= 0 ? '▲' : '▼'} {Math.abs(vsLastMonth.hours)}%</span>
            )}
          </div>
          <div>
            <p className="text-xl sm:text-3xl font-black text-slate-800">{formatHours(adminStats.totalHours || 0)}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatHours(aggregatedTrend.expected)} Esperadas</p>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Horas Totais</p>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2 sm:gap-3">
          <div className="flex justify-between items-start">
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl"><TrendingUp size={24} /></div>
            {vsLastMonth.revenue !== null && vsLastMonth.revenue !== 0 && (
              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${vsLastMonth.revenue >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{vsLastMonth.revenue >= 0 ? '▲' : '▼'} {Math.abs(vsLastMonth.revenue)}%</span>
            )}
          </div>
          <div>
            <p className="text-xl sm:text-3xl font-black text-slate-800">{formatCurrency(adminStats.expectedRevenue || 0)}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimada</p>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Faturação</p>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2 sm:gap-3">
          <div className="flex justify-between items-start">
            <div className="bg-rose-50 text-rose-600 p-3 rounded-2xl"><TrendingDown size={24} /></div>
            {vsLastMonth.costs !== null && vsLastMonth.costs !== 0 && (
              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${vsLastMonth.costs <= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{vsLastMonth.costs >= 0 ? '▲' : '▼'} {Math.abs(vsLastMonth.costs)}%</span>
            )}
          </div>
          <div>
            <p className="text-xl sm:text-3xl font-black text-slate-800">{formatCurrency((adminStats.expectedCosts || 0) + (adminStats.monthlyExpenses || 0))}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operacionais + Fixos</p>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custos Globais</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-xl flex flex-col gap-2 sm:gap-3 text-white">
          <div className="flex justify-between items-start">
            <div className="bg-white/20 p-3 rounded-2xl"><Wallet size={24} /></div>
            {vsLastMonth.profit !== null && vsLastMonth.profit !== 0 && (
              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${vsLastMonth.profit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{vsLastMonth.profit >= 0 ? '▲' : '▼'} {Math.abs(vsLastMonth.profit)}%</span>
            )}
          </div>
          <div>
            <p className="text-xl sm:text-3xl font-black">{formatCurrency(adminStats.netProfit || 0)}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Líquido</p>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resultado</p>
        </div>
      </div>

      <OverviewCharts />

      <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Activity size={20} /></div>
          <h3 className="font-black text-lg text-slate-800">Comparativo por Trabalhador</h3>
        </div>
        <div className="space-y-3">
          {workerComparisonData.length > 0 ? workerComparisonData.map((w) => (
            <div key={w.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-bold text-slate-700 truncate">{w.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-black text-slate-400">{formatHours(w.registered)} / {formatHours(w.prevRegistered)}</span>
                    {w.diffPct !== null ? (
                      <span className={`text-[10px] font-black px-2 py-1 rounded-full ${w.isOver ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{w.isOver ? '▲' : '▼'} {Math.abs(w.diffPct)}%</span>
                    ) : (
                      <span className="text-[10px] font-black text-slate-400 px-2 py-1">—</span>
                    )}
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all duration-500 ${w.isOver ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, w.ratioPct || 0)}%` }} />
                </div>
              </div>
            </div>
          )) : (
            <p className="text-xs text-slate-400 italic text-center py-8">Sem dados de trabalhadores este mês.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-amber-50 p-2 rounded-xl text-amber-600"><Trophy size={20} /></div>
            <h3 className="font-black text-lg text-slate-800">Top Unidades (Horas)</h3>
          </div>
          <div className="space-y-4">
            {topClientsWithPrev.length > 0 ? topClientsWithPrev.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between group">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-700">{c.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.pct !== null && c.pct !== 0 && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.pct >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{c.pct >= 0 ? '▲' : '▼'} {Math.abs(c.pct)}%</span>
                      )}
                      <span className="text-xs font-black text-indigo-600">{formatHours(c.hours)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-50 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (c.hours / c.totalCurr) * 100)}%` }}></div>
                  </div>
                </div>
              </div>
            )) : <p className="text-xs text-slate-400 italic">Sem dados de clientes registados este mês.</p>}
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-50 p-2 rounded-xl text-blue-600"><History size={20} /></div>
            <h3 className="font-black text-lg text-slate-800">Atividade Recente</h3>
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {(logs || []).slice().sort((a, b) => parseLogDate(b.date) - parseLogDate(a.date) || b.id.localeCompare(a.id)).slice(0, showAllActivity ? undefined : 5).map(log => (
              <div key={log.id} className="flex gap-3 items-start p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                <div className="bg-slate-100 p-2 rounded-xl text-slate-400 mt-0.5"><Activity size={12} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{(workers || []).find(w => w.id === log.workerId)?.name || 'Colaborador'}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">{(clients || []).find(c => c.id === log.clientId)?.name} • {formatLogDate(log.date)}</p>
                </div>
                <div className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg shrink-0">{formatHours(Number(log.hours) || 0)}</div>
              </div>
            ))}
            {(logs || []).length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">Sem atividade registada.</p>}
          </div>
          {(logs || []).length > 5 && (
            <button onClick={() => setShowAllActivity(!showAllActivity)} className="mt-4 w-full py-3 text-xs font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-colors">
              {showAllActivity ? 'Mostrar Menos' : 'Ver Tudo →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}