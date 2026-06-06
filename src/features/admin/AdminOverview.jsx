import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutGrid, Clock, TrendingUp, TrendingDown, Wallet,
  Trophy, History, Activity, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { isSameMonth } from '../../utils/dateUtils';
import { formatHours, formatCurrency, calculateDuration } from '../../utils/formatUtils';
import { useReconciliationBadges } from './adminOverview/useReconciliationBadges';
import KpiCard from './adminOverview/KpiCard';
import FinancialSummaryPanel from './adminOverview/FinancialSummaryPanel';

export default function AdminOverview({ currentMonth, setCurrentMonth }) {
  const { adminStats, workers, clients, schedules, logs, expenses, supabase } = useApp();

  const [showAllActivity, setShowAllActivity] = useState(false);

  const { badgeTotals, badgeDetails, ytdTotals } = useReconciliationBadges(supabase, currentMonth);

  const getWorkingDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const day = new Date(year, month, i).getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  };

  const getWorkerExpectedHours = (workerId) => {
    const worker = workers.find(w => w.id === workerId);
    if (!worker?.defaultScheduleId) return 0;
    const schedule = schedules.find(s => s.id === worker.defaultScheduleId);
    if (!schedule) return 0;
    const hoursPerDay = calculateDuration(schedule.startTime, schedule.endTime, schedule.breakStart, schedule.breakEnd);
    return hoursPerDay * getWorkingDaysInMonth(currentMonth);
  };

  const todayDay = new Date().getDate();

  const filterPrevMonthProportional = (allLogs, prevMonth) =>
    allLogs.filter(l => {
      if (!isSameMonth(l.date, prevMonth)) return false;
      return new Date(l.date.split('T')[0]).getDate() <= todayDay;
    });

  const prevMonthStats = useMemo(() => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const prevLogs = filterPrevMonthProportional(logs, prevMonth);
    const totalHours = prevLogs.reduce((acc, l) => acc + (Number(l.hours) || 0), 0);
    let expectedRevenue = 0;
    let expectedCosts = 0;
    prevLogs.forEach(l => {
      const client = clients.find(c => c.id === l.clientId);
      const worker = workers.find(w => w.id === l.workerId);
      if (client) expectedRevenue += l.hours * (Number(client.valorHora) || 0);
      if (worker) expectedCosts += l.hours * (Number(worker.valorHora) || 0);
    });
    const monthlyExpenses = expenses
      .filter(e => {
        if (!isSameMonth(e.date, prevMonth)) return false;
        return new Date(e.date.split('T')[0]).getDate() <= todayDay;
      })
      .reduce((a, b) => a + Number(b.amount), 0);
    return { totalHours, expectedRevenue, expectedCosts, monthlyExpenses, netProfit: expectedRevenue - expectedCosts - monthlyExpenses };
  }, [logs, currentMonth, clients, workers, expenses]);

  const aggregatedTrend = useMemo(() => {
    const totalExpected = workers.reduce((sum, w) => sum + getWorkerExpectedHours(w.id), 0);
    if (totalExpected === 0) return { percent: 0, expected: 0 };
    return {
      percent: ((adminStats.totalHours - totalExpected) / totalExpected * 100).toFixed(1),
      expected: totalExpected,
    };
  }, [workers, schedules, currentMonth, adminStats.totalHours]);

  const vsLastMonth = useMemo(() => {
    const pct = (curr, prev) => prev === 0 ? null : Number(((curr - prev) / Math.abs(prev) * 100).toFixed(1));
    return {
      hours: pct(adminStats.totalHours, prevMonthStats.totalHours),
      revenue: pct(adminStats.expectedRevenue, prevMonthStats.expectedRevenue),
      costs: pct(adminStats.expectedCosts + adminStats.monthlyExpenses, prevMonthStats.expectedCosts + prevMonthStats.monthlyExpenses),
      profit: pct(adminStats.netProfit, prevMonthStats.netProfit),
    };
  }, [adminStats, prevMonthStats]);

  const workerComparisonData = useMemo(() => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    return workers
      .map(w => {
        const filterByDay = (logList, month) =>
          logList.filter(l => {
            if (!isSameMonth(l.date, month)) return false;
            return new Date(l.date.split('T')[0]).getDate() <= todayDay;
          });
        const currLogs = filterByDay(logs.filter(l => l.workerId === w.id), currentMonth);
        const prevLogs = filterByDay(logs.filter(l => l.workerId === w.id), prevMonth);
        const currHours = currLogs.reduce((sum, l) => sum + (l.hours || 0), 0);
        const prevHours = prevLogs.reduce((sum, l) => sum + (l.hours || 0), 0);
        const ratioPct = prevHours > 0 ? Number((currHours / prevHours * 100).toFixed(1)) : null;
        const diffPct = prevHours > 0 ? Number(((currHours - prevHours) / prevHours * 100).toFixed(1)) : null;
        return { id: w.id, name: w.name, registered: currHours, prevRegistered: prevHours, expected: getWorkerExpectedHours(w.id), ratioPct, diffPct, isOver: currHours >= prevHours && prevHours > 0 };
      })
      .filter(w => w.registered > 0 || w.prevRegistered > 0)
      .sort((a, b) => (b.ratioPct || 0) - (a.ratioPct || 0));
  }, [workers, logs, schedules, currentMonth, todayDay]);

  const areaData = useMemo(() => {
    if (!logs.length || !adminStats.totalHours) return [];
    const byDay = {};
    logs.forEach(l => {
      if (l.date && l.hours) byDay[l.date.split('T')[0]] = (byDay[l.date.split('T')[0]] || 0) + l.hours;
    });
    return Object.entries(byDay)
      .map(([date, hours]) => ({
        date: date.slice(5).replace('-', '/'),
        horas: Number(hours.toFixed(1)),
        valor: Number(((hours / adminStats.totalHours) * adminStats.expectedRevenue).toFixed(2)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, adminStats]);

  const topClientsWithPrev = useMemo(() => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const currHours = {};
    const prevHours = {};
    logs.forEach(l => {
      if (!l.clientId || !l.hours) return;
      if (isSameMonth(l.date, currentMonth)) {
        currHours[l.clientId] = (currHours[l.clientId] || 0) + l.hours;
      } else if (isSameMonth(l.date, prevMonth) && new Date(l.date.split('T')[0]).getDate() <= todayDay) {
        prevHours[l.clientId] = (prevHours[l.clientId] || 0) + l.hours;
      }
    });
    const totalCurr = Object.values(currHours).reduce((a, b) => a + b, 0);
    return Object.keys(currHours)
      .map(id => {
        const curr = currHours[id];
        const prev = prevHours[id] || 0;
        const pct = prev > 0 ? Number(((curr - prev) / prev * 100).toFixed(1)) : null;
        return { id, name: clients.find(c => c.id === id)?.name || 'Desconhecido', hours: curr, prevHours: prev, pct, totalCurr };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
  }, [logs, currentMonth, clients, todayDay]);

  const parseLogDate = (d) => {
    if (!d) return 0;
    const ptMatch = d.match(/^(\d{2})\/(\d{2})/);
    if (ptMatch) return new Date(`${new Date().getFullYear()}-${ptMatch[2]}-${ptMatch[1]}`).getTime();
    const [y, m, day] = d.split('T')[0].split('-');
    return y && m && day ? new Date(`${y}-${m}-${day}`).getTime() : 0;
  };

  const formatLogDate = (d) => {
    if (!d) return 'Data inválida';
    const ptMatch = d.match(/^(\d{2})\/(\d{2})/);
    if (ptMatch) return `${ptMatch[1]}/${ptMatch[2]}`;
    const [y, m, day] = d.split('T')[0].split('-');
    return (y && m && day) ? `${day}/${m}/${y}` : 'Data inválida';
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header */}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <KpiCard
          icon={<Clock size={24} />} iconBg="bg-indigo-50" iconColor="text-indigo-600"
          value={formatHours(adminStats.totalHours)} subtitle={`${formatHours(aggregatedTrend.expected)} Esperadas`}
          label="Horas Totais" trend={vsLastMonth.hours}
        />
        <KpiCard
          icon={<TrendingUp size={24} />} iconBg="bg-emerald-50" iconColor="text-emerald-600"
          value={formatCurrency(adminStats.expectedRevenue)} subtitle="Estimada"
          label="Faturação" trend={vsLastMonth.revenue}
        />
        <KpiCard
          icon={<TrendingDown size={24} />} iconBg="bg-rose-50" iconColor="text-rose-600"
          value={formatCurrency(adminStats.expectedCosts + adminStats.monthlyExpenses)} subtitle="Operacionais + Fixos"
          label="Custos Globais" trend={vsLastMonth.costs} invertTrend
        />
        <KpiCard
          icon={<Wallet size={24} />} iconBg="bg-white/20" iconColor=""
          value={formatCurrency(adminStats.netProfit)} subtitle="Líquido"
          label="Resultado" trend={vsLastMonth.profit} dark
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        {/* Area Chart */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><TrendingUp size={20} /></div>
            <h3 className="font-black text-lg text-slate-800">Fluxo de Faturamento Diário</h3>
          </div>
          {areaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={areaData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `€${v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => [`€${value}`, 'Faturamento']}
                />
                <Area type="monotone" dataKey="valor" stroke="#6366f1" strokeWidth={2} fill="url(#colorValor)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
              Sem dados de faturação para exibir
            </div>
          )}
        </div>

        <FinancialSummaryPanel
          badgeTotals={badgeTotals}
          badgeDetails={badgeDetails}
          ytdTotals={ytdTotals}
          currentMonth={currentMonth}
        />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        {/* Worker Comparison */}
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
                        <span className={`text-[10px] font-black px-2 py-1 rounded-full ${w.isOver ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {w.isOver ? '▲' : '▼'} {Math.abs(w.diffPct)}%
                        </span>
                      ) : (
                        <span className="text-[10px] font-black text-slate-400 px-2 py-1">—</span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${w.isOver ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${Math.min(100, w.ratioPct || 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-xs text-slate-400 italic text-center py-8">Sem dados de trabalhadores este mês.</p>
            )}
          </div>
        </div>

        {/* Top Units + Recent Activity */}
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
          <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-amber-50 p-2 rounded-xl text-amber-600"><Trophy size={20} /></div>
              <h3 className="font-black text-lg text-slate-800">Top Unidades (Horas)</h3>
            </div>
            <div className="space-y-4">
              {topClientsWithPrev.length > 0 ? topClientsWithPrev.map((c) => (
                <div key={c.id} className="flex items-center justify-between group">
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-700">{c.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.pct !== null && c.pct !== 0 && (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.pct >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {c.pct >= 0 ? '▲' : '▼'} {Math.abs(c.pct)}%
                          </span>
                        )}
                        <span className="text-xs font-black text-indigo-600">{formatHours(c.hours)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-50 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (c.hours / c.totalCurr) * 100)}%` }} />
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
              {logs
                .slice()
                .sort((a, b) => parseLogDate(b.date) - parseLogDate(a.date) || b.id.localeCompare(a.id))
                .slice(0, showAllActivity ? undefined : 5)
                .map(log => (
                  <div key={log.id} className="flex gap-3 items-start p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                    <div className="bg-slate-100 p-2 rounded-xl text-slate-400 mt-0.5"><Activity size={12} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{workers.find(w => w.id === log.workerId)?.name || 'Colaborador'}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest">{clients.find(c => c.id === log.clientId)?.name} • {formatLogDate(log.date)}</p>
                    </div>
                    <div className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg shrink-0">
                      {formatHours(Number(log.hours) || 0)}
                    </div>
                  </div>
                ))}
              {logs.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">Sem atividade registada.</p>}
            </div>
            {logs.length > 5 && (
              <button
                onClick={() => setShowAllActivity(!showAllActivity)}
                className="mt-4 w-full py-3 text-xs font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-colors"
              >
                {showAllActivity ? 'Mostrar Menos' : 'Ver Tudo →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
