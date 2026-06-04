import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutGrid, Clock, TrendingUp, TrendingDown, Wallet, Trophy, History,
  Activity, BarChart3, ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { isSameMonth } from '../../utils/dateUtils';
import { formatHours, formatCurrency, calculateDuration } from '../../utils/formatUtils';

export default function AdminOverview({ currentMonth, setCurrentMonth }) {
  const { adminStats, workers, clients, schedules, logs, expenses, supabase } = useApp();

  const [badgeTotals, setBadgeTotals] = useState({
    cliente: 0, recibo: 0, fatura: 0, imposto: 0, justificado: 0, receitas: 0, despesas: 0
  });
  const [ytdTotals, setYtdTotals] = useState({ receitas: 0, despesas: 0 });
  const [badgeDetails, setBadgeDetails] = useState([]);
  const [expandedItems, setExpandedItems] = useState([]);
  const [detailsPage, setDetailsPage] = useState(1);
  const [showAllActivity, setShowAllActivity] = useState(false);

  // Fetch badge totals for current month
  useEffect(() => {
    if (!supabase) return;

    const monthStr = currentMonth.getFullYear() + '-' + String(currentMonth.getMonth() + 1).padStart(2, '0');

    supabase
      .from('reconciliation_runs')
      .select('id, transactions_json')
      .then(async ({ data: runs }) => {
        if (!runs?.length) {
          setBadgeTotals({ cliente: 0, recibo: 0, fatura: 0, imposto: 0, justificado: 0, receitas: 0, despesas: 0 });
          setBadgeDetails([]);
          return;
        }

        const runIds = runs.map(r => r.id);

        const [pags, rls, fatLinks, ints, imps, justs, allClients] = await Promise.all([
          supabase.from('faturacao_clientes_pagamentos').select('tx_key, valor_pago, client_id').in('run_id', runIds),
          supabase.from('movimentacao_recibo_links').select('tx_key, worker_name').in('run_id', runIds),
          supabase.from('fatura_pagamento_links').select('tx_key, fatura_id').in('run_id', runIds),
          supabase.from('entrada_internos').select('tx_key').in('run_id', runIds),
          supabase.from('entrada_impostos').select('tx_key').in('run_id', runIds),
          supabase.from('entrada_justifications').select('tx_key, justification').in('run_id', runIds),
          supabase.from('clients').select('id, name')
        ]);

        const faturaIds = (fatLinks.data || []).map(f => f.fatura_id).filter(Boolean);
        let allFaturas = { data: [] };
        if (faturaIds.length > 0 && faturaIds.length <= 100) {
          try {
            allFaturas = await supabase.from('faturas').select('id, dados').in('id', faturaIds);
          } catch (e) {
            console.warn('Erro ao carregar faturas:', e);
          }
        }

        const mapCliente = {};
        const mapClienteNome = {};
        (pags.data || []).forEach(p => {
          mapCliente[p.tx_key] = Number(p.valor_pago) || 0;
          mapClienteNome[p.tx_key] = p.client_id;
        });

        const mapReciboNome = {};
        (rls.data || []).forEach(r => { mapReciboNome[r.tx_key] = r.worker_name; });

        const mapFaturaId = {};
        (fatLinks.data || []).forEach(f => { mapFaturaId[f.tx_key] = f.fatura_id; });

        const mapFaturaDetails = {};
        (allFaturas.data || []).forEach(fat => {
          mapFaturaDetails[fat.id] = {
            fornecedor: fat.dados?.fornecedor || fat.dados?.entidade || '—'
          };
        });

        const mapJustificacao = {};
        (justs.data || []).forEach(j => { mapJustificacao[j.tx_key] = j.justification; });

        const clientNames = {};
        (allClients.data || []).forEach(c => { clientNames[c.id] = c.name; });

        const setRecibo = new Set((rls.data || []).map(r => r.tx_key));
        const setFatura = new Set((fatLinks.data || []).map(f => f.tx_key));
        const setInterno = new Set((ints.data || []).map(i => i.tx_key));
        const setImposto = new Set((imps.data || []).map(i => i.tx_key));
        const setJustificado = new Set((justs.data || []).map(j => j.tx_key));

        const totals = { cliente: 0, recibo: 0, fatura: 0, imposto: 0, justificado: 0, receitas: 0, despesas: 0 };
        const details = [];

        runs.forEach(run => {
          let txs = run.transactions_json;
          if (typeof txs === 'string') {
            try { txs = JSON.parse(txs || '[]'); } catch { txs = []; }
          }
          if (!Array.isArray(txs)) txs = [];

          txs.forEach(tx => {
            if (!tx.data?.startsWith(monthStr)) return;

            const key = `${tx.data}|${tx.descricao}|${tx.valor}`;
            const valor = Math.abs(Number(tx.valor) || 0);

            if (setInterno.has(key)) return;

            let badge = null;
            if (mapCliente[key]) {
              badge = 'cliente';
              totals.cliente += valor;
            } else if (setRecibo.has(key)) {
              badge = 'recibo';
              totals.recibo += valor;
            } else if (setFatura.has(key)) {
              badge = 'fatura';
              totals.fatura += valor;
            } else if (setImposto.has(key)) {
              badge = 'imposto';
              totals.imposto += valor;
            } else if (setJustificado.has(key)) {
              badge = 'justificado';
              totals.justificado += valor;
            }

            if (tx.tipo === 'credito') {
              totals.receitas += valor;
            } else {
              totals.despesas += valor;
            }

            if (badge) {
              details.push({
                date: tx.data,
                descricao: tx.descricao || '',
                valor,
                tipo: tx.tipo,
                badge,
                clienteNome: mapClienteNome[key] ? clientNames[mapClienteNome[key]] || mapClienteNome[key] : null,
                workerName: mapReciboNome[key] || null,
                faturaFornecedor: mapFaturaDetails[mapFaturaId[key]]?.fornecedor || null,
                justificacao: mapJustificacao[key] || null
              });
            }
          });
        });

        setBadgeTotals(totals);
        setBadgeDetails(details);

        const yearStr = currentMonth.getFullYear().toString();
        const ytd = { receitas: 0, despesas: 0 };
        runs.forEach(run => {
          let txs = run.transactions_json;
          if (typeof txs === 'string') {
            try { txs = JSON.parse(txs || '[]'); } catch { txs = []; }
          }
          if (!Array.isArray(txs)) txs = [];

          txs.forEach(tx => {
            if (!tx.data?.startsWith(yearStr)) return;
            if (setInterno.has(`${tx.data}|${tx.descricao}|${tx.valor}`)) return;
            const valor = Math.abs(Number(tx.valor) || 0);
            if (tx.tipo === 'credito') { ytd.receitas += valor; } else { ytd.despesas += valor; }
          });
        });
        setYtdTotals(ytd);
      });
  }, [supabase, currentMonth]);

  // Helper functions
  const getWorkingDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    let count = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
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
    const workingDays = getWorkingDaysInMonth(currentMonth);
    return hoursPerDay * workingDays;
  };

  const todayDay = new Date().getDate();

  const filterPrevMonthProportional = (allLogs, prevMonth) =>
    allLogs.filter(l => {
      if (!isSameMonth(l.date, prevMonth)) return false;
      const d = new Date(l.date.split('T')[0]);
      return d.getDate() <= todayDay;
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
    const prevMonth2 = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const monthlyExpenses = expenses
      .filter(e => {
        if (!isSameMonth(e.date, prevMonth2)) return false;
        const d = new Date(e.date.split('T')[0]);
        return d.getDate() <= todayDay;
      })
      .reduce((a, b) => a + Number(b.amount), 0);
    return {
      totalHours,
      expectedRevenue,
      expectedCosts,
      monthlyExpenses,
      netProfit: expectedRevenue - expectedCosts - monthlyExpenses
    };
  }, [logs, currentMonth, clients, workers, expenses]);

  const aggregatedTrend = useMemo(() => {
    const totalExpected = workers.reduce((sum, w) => sum + getWorkerExpectedHours(w.id), 0);
    const totalRegistered = adminStats.totalHours;
    if (totalExpected === 0) return { percent: 0, expected: 0 };
    return {
      percent: ((totalRegistered - totalExpected) / totalExpected * 100).toFixed(1),
      expected: totalExpected
    };
  }, [workers, schedules, currentMonth, adminStats.totalHours]);

  const vsLastMonth = useMemo(() => {
    const pct = (curr, prev) => {
      if (prev === 0) return null;
      return Number(((curr - prev) / Math.abs(prev) * 100).toFixed(1));
    };
    return {
      hours: pct(adminStats.totalHours, prevMonthStats.totalHours),
      revenue: pct(adminStats.expectedRevenue, prevMonthStats.expectedRevenue),
      costs: pct(adminStats.expectedCosts + adminStats.monthlyExpenses, prevMonthStats.expectedCosts + prevMonthStats.monthlyExpenses),
      profit: pct(adminStats.netProfit, prevMonthStats.netProfit)
    };
  }, [adminStats, prevMonthStats]);

  const workerComparisonData = useMemo(() => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    return workers
      .map(w => {
        const filterByDay = (logList, month) =>
          logList.filter(l => {
            if (!isSameMonth(l.date, month)) return false;
            const d = new Date(l.date.split('T')[0]);
            return d.getDate() <= todayDay;
          });

        const currLogs = filterByDay(logs.filter(l => l.workerId === w.id), currentMonth);
        const prevLogs = filterByDay(logs.filter(l => l.workerId === w.id), prevMonth);
        const currHours = currLogs.reduce((sum, l) => sum + (l.hours || 0), 0);
        const prevHours = prevLogs.reduce((sum, l) => sum + (l.hours || 0), 0);
        const ratioPct = prevHours > 0 ? Number((currHours / prevHours * 100).toFixed(1)) : null;
        const diffPct = prevHours > 0 ? Number(((currHours - prevHours) / prevHours * 100).toFixed(1)) : null;
        return {
          id: w.id,
          name: w.name,
          registered: currHours,
          prevRegistered: prevHours,
          expected: getWorkerExpectedHours(w.id),
          ratioPct,
          diffPct,
          isOver: currHours >= prevHours && prevHours > 0
        };
      })
      .filter(w => w.registered > 0 || w.prevRegistered > 0)
      .sort((a, b) => (b.ratioPct || 0) - (a.ratioPct || 0));
  }, [workers, logs, schedules, currentMonth, todayDay]);

  const areaData = useMemo(() => {
    if (!logs.length || !adminStats.totalHours) return [];
    const byDay = {};
    logs.forEach(l => {
      if (l.date && l.hours) {
        const day = l.date.split('T')[0];
        byDay[day] = (byDay[day] || 0) + l.hours;
      }
    });
    return Object.entries(byDay)
      .map(([date, hours]) => ({
        date: date.slice(5).replace('-', '/'),
        horas: Number(hours.toFixed(1)),
        valor: adminStats.totalHours > 0
          ? Number(((hours / adminStats.totalHours) * adminStats.expectedRevenue).toFixed(2))
          : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, adminStats]);

  const pieData = [
    { name: 'R. Cliente', tipo: 'credito', badgeKey: 'cliente', color: '#22c55e' },
    { name: 'R. Recibo', tipo: 'credito', badgeKey: 'recibo', color: '#16a34a' },
    { name: 'R. Fatura', tipo: 'credito', badgeKey: 'fatura', color: '#15803d' },
    { name: 'R. Justif.', tipo: 'credito', badgeKey: 'justificado', color: '#166534' },
    { name: 'D. Cliente', tipo: 'debito', badgeKey: 'cliente', color: '#ef4444' },
    { name: 'D. Recibo', tipo: 'debito', badgeKey: 'recibo', color: '#dc2626' },
    { name: 'D. Fatura', tipo: 'debito', badgeKey: 'fatura', color: '#b91c1c' },
    { name: 'D. Imposto', tipo: 'debito', badgeKey: 'imposto', color: '#991b1b' },
    { name: 'D. Justif.', tipo: 'debito', badgeKey: 'justificado', color: '#7f1d1d' }
  ].map(item => {
    const items = badgeDetails.filter(t => t.badge === item.badgeKey && t.tipo === item.tipo);
    const value = items.reduce((sum, t) => sum + t.valor, 0);
    return { ...item, value };
  }).filter(p => p.value > 0);

  const subCategoriasCredito = [
    { name: 'Com Cliente', badgeKey: 'cliente', color: '#f43f5e' },
    { name: 'Com Recibo', badgeKey: 'recibo', color: '#14b8a6' },
    { name: 'Com Fatura', badgeKey: 'fatura', color: '#a855f7' },
    { name: 'Justificado', badgeKey: 'justificado', color: '#8b5cf6' }
  ];
  const subCategoriasDebito = [
    { name: 'Com Cliente', badgeKey: 'cliente', color: '#f43f5e' },
    { name: 'Com Recibo', badgeKey: 'recibo', color: '#14b8a6' },
    { name: 'Com Fatura', badgeKey: 'fatura', color: '#a855f7' },
    { name: 'Imposto', badgeKey: 'imposto', color: '#ef4444' },
    { name: 'Justificado', badgeKey: 'justificado', color: '#8b5cf6' }
  ];

  const resultado = badgeTotals.receitas - badgeTotals.despesas;

  const topClientsWithPrev = useMemo(() => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const currHours = {};
    const prevHours = {};
    logs.forEach(l => {
      if (!l.clientId || !l.hours) return;
      if (isSameMonth(l.date, currentMonth)) {
        currHours[l.clientId] = (currHours[l.clientId] || 0) + l.hours;
      } else if (isSameMonth(l.date, prevMonth)) {
        const d = new Date(l.date.split('T')[0]);
        if (d.getDate() <= todayDay) {
          prevHours[l.clientId] = (prevHours[l.clientId] || 0) + l.hours;
        }
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

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2 sm:gap-3">
          <div className="flex justify-between items-start">
            <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl"><Clock size={24} /></div>
            {vsLastMonth.hours !== null && vsLastMonth.hours !== 0 && (
              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${vsLastMonth.hours >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {vsLastMonth.hours >= 0 ? '▲' : '▼'} {Math.abs(vsLastMonth.hours)}%
              </span>
            )}
          </div>
          <div>
            <p className="text-xl sm:text-3xl font-black text-slate-800">{formatHours(adminStats.totalHours)}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatHours(aggregatedTrend.expected)} Esperadas</p>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Horas Totais</p>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2 sm:gap-3">
          <div className="flex justify-between items-start">
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl"><TrendingUp size={24} /></div>
            {vsLastMonth.revenue !== null && vsLastMonth.revenue !== 0 && (
              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${vsLastMonth.revenue >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {vsLastMonth.revenue >= 0 ? '▲' : '▼'} {Math.abs(vsLastMonth.revenue)}%
              </span>
            )}
          </div>
          <div>
            <p className="text-xl sm:text-3xl font-black text-slate-800">{formatCurrency(adminStats.expectedRevenue)}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimada</p>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Faturação</p>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2 sm:gap-3">
          <div className="flex justify-between items-start">
            <div className="bg-rose-50 text-rose-600 p-3 rounded-2xl"><TrendingDown size={24} /></div>
            {vsLastMonth.costs !== null && vsLastMonth.costs !== 0 && (
              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${vsLastMonth.costs <= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {vsLastMonth.costs >= 0 ? '▲' : '▼'} {Math.abs(vsLastMonth.costs)}%
              </span>
            )}
          </div>
          <div>
            <p className="text-xl sm:text-3xl font-black text-slate-800">{formatCurrency(adminStats.expectedCosts + adminStats.monthlyExpenses)}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operacionais + Fixos</p>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custos Globais</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-xl flex flex-col gap-2 sm:gap-3 text-white">
          <div className="flex justify-between items-start">
            <div className="bg-white/20 p-3 rounded-2xl"><Wallet size={24} /></div>
            {vsLastMonth.profit !== null && vsLastMonth.profit !== 0 && (
              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${vsLastMonth.profit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                {vsLastMonth.profit >= 0 ? '▲' : '▼'} {Math.abs(vsLastMonth.profit)}%
              </span>
            )}
          </div>
          <div>
            <p className="text-xl sm:text-3xl font-black">{formatCurrency(adminStats.netProfit)}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Líquido</p>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resultado</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
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

        {/* Pie Chart */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Wallet size={20} /></div>
            <h3 className="font-black text-lg text-slate-800">Resumo Financeiro</h3>
          </div>
          {pieData.some(p => p.value > 0) ? (
            <div className="relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={2}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9px] font-black text-slate-400 uppercase">{currentMonth.getFullYear()}</span>
                <span className={`text-lg font-black ${ytdTotals.receitas - ytdTotals.despesas >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(ytdTotals.receitas - ytdTotals.despesas)}
                </span>
              </div>
            </div>
          ) : null}
          <div className="space-y-3 mt-4">
            {['Receitas', 'Despesa'].map(tipoNome => {
              const tipoKey = tipoNome === 'Receitas' ? 'credito' : 'debito';
              const itemData = pieData.filter(p => p.tipo === tipoKey);
              const totalValue = tipoKey === 'credito' ? badgeTotals.receitas : badgeTotals.despesas;
              const isExpanded = expandedItems.includes(tipoNome);
              const subCats = tipoKey === 'credito' ? subCategoriasCredito : subCategoriasDebito;

              return (
                <div key={tipoNome}>
                  <div
                    onClick={() => {
                      setExpandedItems(prev => isExpanded ? prev.filter(i => i !== tipoNome) : [...prev, tipoNome]);
                      setDetailsPage(1);
                    }}
                    className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tipoKey === 'credito' ? '#22c55e' : '#ef4444' }} />
                      <span className="text-sm font-bold text-slate-700">{tipoNome}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-800">{formatCurrency(totalValue)}</span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {isExpanded && itemData.length > 0 && (
                    <div className="mt-2 pl-4 border-l-2 border-slate-200 space-y-2">
                      {itemData.map(sub => {
                        const isSubExpanded = expandedItems.includes(`${tipoNome}-${sub.name}`);
                        const subBadgeItems = badgeDetails.filter(t => t.badge === sub.badgeKey && t.tipo === tipoKey);
                        const totalPages = Math.ceil(subBadgeItems.length / 10);
                        const paginatedItems = subBadgeItems
                          .sort((a, b) => new Date(b.date) - new Date(a.date))
                          .slice((detailsPage - 1) * 10, detailsPage * 10);

                        return (
                          <div key={sub.name}>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                const key = `${tipoNome}-${sub.name}`;
                                setExpandedItems(prev => isSubExpanded ? prev.filter(i => i !== key) : [...prev, key]);
                                setDetailsPage(1);
                              }}
                              className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.color }} />
                                <span className="text-xs font-bold text-slate-600">{sub.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-700">{formatCurrency(sub.value)}</span>
                                <ChevronDown size={12} className={`text-slate-400 transition-transform ${isSubExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </div>

                            {isSubExpanded && subBadgeItems.length > 0 && (
                              <div className="mt-1 ml-4 bg-slate-50 rounded-xl overflow-hidden">
                                <table className="w-full text-[10px]">
                                  <thead>
                                    <tr className="border-b border-slate-200">
                                      <th className="px-3 py-2 text-left font-black text-slate-500 uppercase tracking-widest">Data</th>
                                      <th className="px-3 py-2 text-left font-black text-slate-500 uppercase tracking-widest">Descrição</th>
                                      <th className="px-3 py-2 text-right font-black text-slate-500 uppercase tracking-widest">Valor</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {paginatedItems.map((item, idx) => (
                                      <tr key={idx} className="border-b border-slate-100 last:border-0">
                                        <td className="px-3 py-2 text-slate-600 font-mono whitespace-nowrap">{item.date}</td>
                                        <td className="px-3 py-2 text-slate-600 truncate max-w-[120px]">
                                          {item.clienteNome || item.workerName || item.faturaFornecedor || item.justificacao || item.descricao}
                                        </td>
                                        <td className="px-3 py-2 text-right font-black text-slate-700">{formatCurrency(item.valor)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {totalPages > 1 && (
                                  <div className="flex justify-center gap-1 pt-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDetailsPage(p => Math.max(1, p - 1)); }}
                                      disabled={detailsPage === 1}
                                      className="px-2 py-1 text-xs font-bold bg-slate-100 rounded-lg disabled:opacity-40 hover:bg-slate-200 transition-colors"
                                    >‹</button>
                                    <span className="px-2 py-1 text-xs font-bold text-slate-500">{detailsPage}/{totalPages}</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDetailsPage(p => Math.min(totalPages, p + 1)); }}
                                      disabled={detailsPage === totalPages}
                                      className="px-2 py-1 text-xs font-bold bg-slate-100 rounded-lg disabled:opacity-40 hover:bg-slate-200 transition-colors"
                                    >›</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
            <span className="text-sm font-black text-slate-700">Resultado</span>
            <span className={`text-sm font-black ${resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(resultado)}
            </span>
          </div>
        </div>
      </div>

      {/* Worker Comparison + Top Units + Activity */}
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

        {/* Top Units + Activity (stacked) */}
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
              {logs.slice().sort((a, b) => parseLogDate(b.date) - parseLogDate(a.date) || b.id.localeCompare(a.id)).slice(0, showAllActivity ? undefined : 5).map(log => (
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
