import React, { useState, useEffect } from 'react';
import { ChevronLeft, CheckCircle, TrendingUp } from 'lucide-react';
import { formatHours } from '../../../utils/formatUtils';

export default function WorkerHeroStats({ currentUser, currentMonth, setCurrentMonth, todayHours, totalMonthHours, expectedHours, myApproval, showProgress, setShowProgress, fillHeight }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hm      = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const sec     = String(now.getSeconds()).padStart(2, '0');
  const weekday = now.toLocaleDateString('pt-PT', { weekday: 'long' });
  const dayNum  = now.getDate();
  const monthName = now.toLocaleDateString('pt-PT', { month: 'long' });
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const dateLabel = `${cap(weekday)}, ${dayNum} ${cap(monthName)}`;

  return (
    <div className={`bg-slate-900 rounded-2xl md:rounded-[3rem] p-5 md:p-8 shadow-2xl text-white relative overflow-hidden mb-4 flex flex-col ${fillHeight ? 'flex-1 min-h-0' : ''}`}>

      {/* Linha superior: data + selector de mês */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{dateLabel}</p>
        <div className="flex items-center bg-white/10 rounded-xl p-1">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 px-2 min-w-[60px] text-center">
            {new Date(currentMonth).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })}
          </span>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors"
          >
            <ChevronLeft size={13} className="rotate-180" />
          </button>
        </div>
      </div>

      {/* Relógio */}
      <div className="flex items-end gap-2 mb-5">
        <span className="text-[72px] md:text-[88px] font-black tabular-nums leading-none text-white">{hm}</span>
        <span className="text-3xl md:text-4xl font-bold tabular-nums text-slate-700 mb-1.5">{sec}</span>
      </div>

      {/* Stats: Hoje + Mês */}
      <div className="grid grid-cols-2 gap-2">
        {/* Hoje */}
        <div className="bg-white/10 rounded-xl px-4 py-3 flex flex-col gap-0.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Hoje</p>
          <p className="text-2xl font-black text-white tabular-nums leading-none">{formatHours(todayHours)}</p>
        </div>

        {/* Mês */}
        <div className="bg-indigo-500/20 border border-indigo-400/20 rounded-xl px-4 py-3 flex flex-col gap-0.5 relative">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Mês</p>
            <div className="flex items-center gap-1.5">
              {myApproval && <CheckCircle size={11} className="text-emerald-400" />}
              {expectedHours > 0 && (
                <button
                  onClick={() => setShowProgress(!showProgress)}
                  className="p-0.5 rounded text-indigo-400/60 hover:text-indigo-300 transition-colors"
                  title={showProgress ? 'Ocultar Meta' : 'Ver Meta'}
                >
                  <TrendingUp size={11} />
                </button>
              )}
            </div>
          </div>
          <p className="text-2xl font-black text-indigo-100 tabular-nums leading-none">{formatHours(totalMonthHours)}</p>
          {myApproval && (
            <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-wide">Aprovado</p>
          )}
        </div>
      </div>

      {/* Barra de progresso */}
      {expectedHours > 0 && showProgress && (
        <div className="mt-3 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">
              Meta: {formatHours(expectedHours)}
            </span>
            <span className="text-sm font-black text-indigo-100">
              {Math.round((totalMonthHours / expectedHours) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 via-indigo-400 to-indigo-300 rounded-full transition-all duration-[1500ms] ease-out"
              style={{ width: `${Math.min(100, (totalMonthHours / expectedHours) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
