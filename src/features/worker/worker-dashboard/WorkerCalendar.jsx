import React, { useState, useRef, useEffect } from 'react';
import { Plus, Zap, Trash2, Edit2 } from 'lucide-react';
import { formatHours } from '../../../utils/formatUtils';
import { toISODateLocal } from '../../../utils/dateUtils';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function WorkerCalendar({
  daysList, monthLogs, dayRequestsByDate,
  clients, myApproval, isLimitedWorker, workerStartDate,
  onAddEntry, onEditLog, onDeleteLog, onEditLimitedLog, onQuickRegister,
}) {
  const [selectedDay, setSelectedDay] = useState(null);
  const detailRef = useRef(null);
  const today = toISODateLocal(new Date());

  useEffect(() => {
    if (selectedDay && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
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

  return (
    <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden mb-12">

      {/* Calendar grid */}
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[9px] font-black uppercase tracking-widest text-slate-400 py-1">{d}</div>
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

            return (
              <button
                key={ds}
                onClick={() => handleDayClick(ds)}
                disabled={!!isDayBeforeStart}
                className={`
                  relative aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95
                  ${isDayBeforeStart ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}
                  ${isToday && !isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
                  ${isSelected ? 'ring-2 ring-slate-400 ring-offset-1' : ''}
                  ${hasLog
                    ? 'bg-indigo-50 border border-indigo-200 hover:bg-indigo-100'
                    : isWeekend
                    ? 'bg-slate-50'
                    : 'bg-white border border-slate-100 hover:bg-indigo-50/50'
                  }
                `}
              >
                <span className={`text-[11px] font-black leading-none ${
                  hasLog ? 'text-indigo-700' : isWeekend ? 'text-slate-300' : 'text-slate-500'
                }`}>
                  {dObj.getDate()}
                </span>
                {hasLog && (
                  <span className="text-[9px] font-black text-indigo-500 leading-none mt-px">
                    {formatHours(dayTotal)}
                  </span>
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
                <p className="text-[10px] font-bold text-indigo-600 mt-0.5">{formatHours(selectedDayTotal)} registadas</p>
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
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wide hover:bg-indigo-700 transition-all active:scale-95"
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
                  className="bg-white px-3 py-2.5 rounded-2xl border border-slate-100 flex items-center justify-between gap-2 shadow-sm cursor-pointer hover:bg-indigo-50/40 transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg border border-indigo-100 uppercase shrink-0 max-w-[90px] truncate">
                      {clients.find(c => c.id === log.clientId)?.name || 'Cliente'}
                    </span>
                    <div className="text-xs font-bold font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 shrink-0">
                      {log.startTime}–{log.endTime || '?'}
                    </div>
                    {(log.breakStart || log.breakEnd) && (
                      <div className="text-[9px] font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100 hidden sm:block shrink-0">
                        P: {log.breakStart || '--:--'}–{log.breakEnd || '--:--'}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 border-l border-slate-100 pl-3">
                    <span className="text-sm font-black text-indigo-700">{formatHours(log.hours || 0)}</span>
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
