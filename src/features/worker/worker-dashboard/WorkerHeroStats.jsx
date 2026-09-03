import React, { useState, useEffect } from 'react';
import { ChevronLeft, CheckCircle, TrendingUp } from 'lucide-react';
import { formatHours } from '../../../utils/formatUtils';
import { FT, FONT_MONO, SCALE } from './formacaoDesignTokens';

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
    <div
      className={`rounded-2xl md:rounded-[3rem] p-5 md:p-8 shadow-2xl text-white relative overflow-hidden mb-4 flex flex-col ${fillHeight ? 'flex-1 min-h-0' : ''}`}
      style={{
        background: FT.navyDeep,
        backgroundImage: `radial-gradient(circle at 90% -10%, rgba(235,141,0,0.16), transparent 55%)`,
      }}
      data-tour="hero-stats"
    >

      {/* Linha superior: data + selector de mês */}
      <div className="flex items-center justify-between mb-4">
        <p className={SCALE.text.statLabel} style={{ fontFamily: FONT_MONO, color: FT.slate }}>{dateLabel}</p>
        <div className="flex items-center gap-1 rounded-full px-1.5 py-1" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            className="w-[22px] h-[22px] flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={13} />
          </button>
          <span className={`${SCALE.text.badge} px-1.5 min-w-[54px] text-center text-white`} style={{ fontFamily: FONT_MONO }}>
            {new Date(currentMonth).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })}
          </span>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            className="w-[22px] h-[22px] flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={13} className="rotate-180" />
          </button>
        </div>
      </div>

      {/* Relógio */}
      <div className="flex items-end gap-2 mb-5">
        <span className="text-[64px] md:text-[80px] font-bold tabular-nums leading-none text-white" style={{ fontFamily: FONT_MONO }}>{hm}</span>
        <span className="text-2xl md:text-3xl font-semibold tabular-nums mb-1.5" style={{ fontFamily: FONT_MONO, color: FT.slate }}>{sec}</span>
      </div>

      {/* Stats: Hoje + Mês */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Hoje */}
        <div className="rounded-xl px-4 py-3 flex flex-col gap-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <p className={SCALE.text.statLabel} style={{ fontFamily: FONT_MONO, color: FT.slate }}>Hoje</p>
          <p className="text-2xl font-black text-white tabular-nums leading-none">{formatHours(todayHours)}</p>
        </div>

        {/* Mês */}
        <div className="rounded-xl px-4 py-3 flex flex-col gap-0.5 relative" style={{ background: 'rgba(235,141,0,0.14)' }}>
          <div className="flex items-center justify-between">
            <p className={`${SCALE.text.statLabel} capitalize`} style={{ fontFamily: FONT_MONO, color: '#FFD9A3' }}>
              {new Date(currentMonth).toLocaleDateString('pt-PT', { month: 'long' })}
            </p>
            <div className="flex items-center gap-1.5">
              {myApproval && <CheckCircle size={11} className="text-emerald-400" />}
              {expectedHours > 0 && (
                <button
                  onClick={() => setShowProgress(!showProgress)}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: 'rgba(255,217,163,0.7)' }}
                  title={showProgress ? 'Ocultar Meta' : 'Ver Meta'}
                >
                  <TrendingUp size={11} />
                </button>
              )}
            </div>
          </div>
          <p className="text-2xl font-black text-white tabular-nums leading-none">{formatHours(totalMonthHours)}</p>
          {myApproval && (
            <p className={`${SCALE.text.statLabel} text-emerald-400`}>Aprovado</p>
          )}
        </div>
      </div>

      {/* Barra de progresso */}
      {expectedHours > 0 && showProgress && (
        <div className="mt-3 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-1.5">
            <span className={SCALE.text.statLabel} style={{ fontFamily: FONT_MONO, color: '#FFD9A3' }}>
              Meta: {formatHours(expectedHours)}
            </span>
            <span className="text-sm font-black text-white">
              {Math.round((totalMonthHours / expectedHours) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.25)' }}>
            <div
              className="h-full rounded-full transition-all duration-[1500ms] ease-out"
              style={{ width: `${Math.min(100, (totalMonthHours / expectedHours) * 100)}%`, background: `linear-gradient(90deg, ${FT.orangeDeep}, ${FT.orange})` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
