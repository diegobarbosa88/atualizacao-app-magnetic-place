import React, { useState, useRef, useEffect } from 'react';
import { Plus, Zap, Trash2, Edit2, Moon } from 'lucide-react';
import { formatHours } from '../../../utils/formatUtils';
import { toISODateLocal } from '../../../utils/dateUtils';
import { FT, FONT_TITLE, FONT_MONO, SCALE } from './formacaoDesignTokens';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function WorkerCalendar({
  daysList, monthLogs, dayRequestsByDate,
  clients, myApproval, isLimitedWorker, workerStartDate,
  absenceRequests, currentUserId,
  onAddEntry, onEditLog, onDeleteLog, onEditLimitedLog, onQuickRegister,
}) {
  const [selectedDay, setSelectedDay] = useState(null);
  const detailRef = useRef(null);
  const today = toISODateLocal(new Date());

  useEffect(() => {
    if (!selectedDay || !detailRef.current) return;
    const el = detailRef.current;
    const rect = el.getBoundingClientRect();
    const bottomNavHeight = 72; // fixed bottom nav + safe area buffer
    const visibleBottom = window.innerHeight - bottomNavHeight;
    if (rect.bottom > visibleBottom) {
      window.scrollBy({ top: rect.bottom - visibleBottom, behavior: 'smooth' });
    }
  }, [selectedDay]);

  if (!daysList || daysList.length === 0) return null;

  const firstDay = new Date(daysList[0] + 'T00:00:00');
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0 … Sun=6 (PT week)

  const handleDayClick = (ds) => {
    const isDayBeforeStart = workerStartDate && new Date(ds + 'T00:00:00') < workerStartDate;
    if (isDayBeforeStart) return;
    const dayLogs = monthLogs.filter(l => l.date === ds);
    if (dayLogs.length === 0) {
      onAddEntry(ds);
      return;
    }
    setSelectedDay(prev => prev === ds ? null : ds);
  };

  const selectedLogs = selectedDay ? monthLogs.filter(l => l.date === selectedDay) : [];
  const selectedDayTotal = selectedLogs.reduce((acc, l) => acc + (l.hours || 0), 0);
  const selectedDayBeforeStart = selectedDay && workerStartDate && new Date(selectedDay + 'T00:00:00') < workerStartDate;
  const selectedDayHasAbsence = selectedDay && (absenceRequests || []).some(
    r => r.worker_id === String(currentUserId) && r.status === 'approved' && (r.dates || []).includes(selectedDay)
  );

  return (
    <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden mb-12">

      {/* Calendar grid */}
      <div className="p-4 sm:p-6">
        <p className="text-base font-bold uppercase tracking-widest mb-2.5 capitalize" style={{ fontFamily: FONT_TITLE, color: FT.navyDeep }}>
          {new Date(daysList[0] + 'T00:00:00').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
        </p>
        {/* Divisor "cordão de solda" — mesmo estilo do módulo de Formação Interna */}
        <div
          className="h-[2px] mb-3"
          style={{ backgroundImage: `repeating-linear-gradient(90deg, ${FT.slate} 0 6px, transparent 6px 10px)`, opacity: 0.5 }}
        />
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map(d => (
            <div key={d} className={`text-center ${SCALE.text.statLabel} text-slate-400 py-1`} style={{ fontFamily: FONT_MONO }}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startOffset }).map((_, i) => <div key={`s${i}`} />)}

          {daysList.map(ds => {
            const dObj = new Date(ds + 'T00:00:00');
            const dayLogs = monthLogs.filter(l => l.date === ds);
            const dayTotal = dayLogs.reduce((acc, l) => acc + (l.hours || 0), 0);
            const isToday = ds === today;
            const isSelected = ds === selectedDay;
            const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
            const isDayBeforeStart = workerStartDate && dObj < workerStartDate;
            const hasPending = (dayRequestsByDate?.[ds] || []).some(
              ({ corr }) => corr.status === 'submitted' || corr.status === 'under_review'
            );
            const hasLog = dayLogs.length > 0;
            const hasApprovedAbsence = (absenceRequests || []).some(
              r => r.worker_id === String(currentUserId) && r.status === 'approved' && (r.dates || []).includes(ds)
            );

            const todayNaoSelecionado = isToday && !isSelected;
            return (
              <button
                key={ds}
                onClick={() => handleDayClick(ds)}
                disabled={!!isDayBeforeStart}
                className={`
                  relative aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95
                  ${isDayBeforeStart ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}
                  ${isSelected ? 'ring-2 ring-slate-400 ring-offset-1' : ''}
                  ${todayNaoSelecionado
                    ? ''
                    : hasLog
                    ? 'border'
                    : hasApprovedAbsence
                    ? 'bg-orange-50 border border-orange-200 hover:bg-orange-100'
                    : isWeekend
                    ? 'bg-slate-50'
                    : 'bg-white border border-slate-100 hover:bg-[#1B3A57]/5'
                  }
                `}
                style={
                  todayNaoSelecionado
                    ? { background: FT.orange, boxShadow: '0 3px 10px rgba(235,141,0,0.35)' }
                    : hasLog
                    ? { background: `${FT.navy}0F`, borderColor: `${FT.navy}33` }
                    : undefined
                }
              >
                <span
                  className={`text-[11px] font-black leading-none ${
                    todayNaoSelecionado ? 'text-white' : hasApprovedAbsence && !hasLog ? 'text-orange-600' : isWeekend && !hasLog ? 'text-slate-300' : !hasLog ? 'text-slate-500' : ''
                  }`}
                  style={hasLog && !todayNaoSelecionado ? { color: FT.navy } : undefined}
                >
                  {dObj.getDate()}
                </span>
                {hasLog && (
                  <span
                    className="text-[9px] font-black leading-none mt-px"
                    style={{ color: todayNaoSelecionado ? 'rgba(255,255,255,0.85)' : FT.orangeDeep }}
                  >
                    {formatHours(dayTotal)}
                  </span>
                )}
                {hasApprovedAbsence && !hasLog && (
                  <Moon size={8} className={todayNaoSelecionado ? 'text-white/85 mt-px' : 'text-orange-400 mt-px'} />
                )}
                {hasApprovedAbsence && hasLog && (
                  <span className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-orange-400" />
                )}
                {hasPending && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail panel */}
      {selectedDay && (
        <div ref={detailRef} className="border-t border-slate-100 px-4 py-4 bg-slate-50/50 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black text-slate-800 capitalize">
                {new Date(selectedDay + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              {selectedDayTotal > 0 && (
                <p className={`${SCALE.text.meta} text-[var(--navy)] mt-0.5`}>{formatHours(selectedDayTotal)} registadas</p>
              )}
            </div>
            {!myApproval && !selectedDayBeforeStart && (
              <div className="flex items-center gap-1.5">
                {!isLimitedWorker && (
                  <button
                    onClick={() => onQuickRegister(selectedDay)}
                    className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-xl transition-all"
                    title="Registo Rápido"
                  >
                    <Zap size={14} />
                  </button>
                )}
                <button
                  onClick={() => onAddEntry(selectedDay)}
                  className={`flex items-center gap-1.5 px-3 py-2 bg-[var(--orange)] text-white rounded-xl hover:bg-[var(--orange-deep)] transition-all active:scale-95 ${SCALE.text.badge}`}
                >
                  <Plus size={13} /> Adicionar
                </button>
              </div>
            )}
          </div>

          {selectedLogs.length > 0 ? (
            <div className="space-y-2">
              {selectedLogs.map(log => (
                <div
                  key={log.id}
                  onClick={() => isLimitedWorker ? onEditLimitedLog(selectedDay, log.id) : onEditLog(log)}
                  className="bg-white px-3 py-2.5 rounded-2xl border border-slate-100 flex items-center justify-between gap-2 shadow-sm cursor-pointer hover:bg-[#1B3A57]/5 transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`${SCALE.text.badge} bg-[#1B3A57]/10 text-[var(--navy)] px-2 py-1 rounded-lg border border-[#1B3A57]/15 shrink-0 max-w-[90px] truncate`}>
                      {clients.find(c => c.id === log.clientId)?.name || 'Cliente'}
                    </span>
                    <div className="text-xs font-bold font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 shrink-0">
                      {log.startTime}–{log.endTime || '?'}
                    </div>
                    {(log.breakStart || log.breakEnd) && (
                      <div className={`${SCALE.text.badge} text-orange-500 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100 hidden sm:block shrink-0`}>
                        P: {log.breakStart || '--:--'}–{log.breakEnd || '--:--'}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 border-l border-slate-100 pl-3">
                    <span className="text-sm font-black text-[var(--navy)]">{formatHours(log.hours || 0)}</span>
                    {!myApproval && !isLimitedWorker && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteLog(log); }}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    {isLimitedWorker && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditLimitedLog(selectedDay, log.id); }}
                        className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 font-bold text-center py-2">Sem registos neste dia.</p>
          )}
        </div>
      )}
    </div>
  );
}
