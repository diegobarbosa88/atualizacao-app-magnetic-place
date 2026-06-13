import React from 'react';
import { Timer, Coffee, Star, ChevronUp, ChevronDown } from 'lucide-react';

const formatTimeCompact = (timeStr) => {
  if (!timeStr) return '--h';
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return '--h';
  return `${h}h${m === 0 ? '' : m.toString().padStart(2, '0')}`;
};

const ALL_DAYS = [{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }];
const WEEKDAY_BADGES = [{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }];

export default function WorkerScheduleTab({ assigned, currentUser, expandedSchedules, toggleScheduleExpand, setDefaultSchedule }) {
  return (
    <div className="animate-in slide-in-from-top-4 duration-300">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6 max-w-2xl">
        <h3 className="text-base sm:text-lg font-black flex items-center gap-2 mb-5 border-b pb-3">
          <Timer className="text-indigo-600" size={18} /> Meus Horários
        </h3>
        <div className="space-y-3">
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pela Empresa</h4>
          <div className="space-y-1.5">
            {assigned.length > 0 ? assigned.map(s => {
              const isExpanded = expandedSchedules.has(s.id);
              const isDefault = currentUser?.defaultScheduleId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => toggleScheduleExpand(s.id)}
                  className={`p-3 rounded-xl border cursor-pointer hover:shadow-sm transition-all flex flex-col gap-2 ${isDefault ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <p className="text-xs font-black truncate">{s.name}</p>
                      {isExpanded ? <ChevronUp size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-300 flex-shrink-0" />}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDefaultSchedule(s.id); }}
                      title="Definir como Padrão"
                      className={`p-2 rounded-xl transition-all flex-shrink-0 ${isDefault ? 'text-amber-500 bg-amber-100' : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100'}`}
                    >
                      <Star fill={isDefault ? 'currentColor' : 'none'} size={16} />
                    </button>
                  </div>
                  {isExpanded && (
                    <div>
                      {s.isAdvanced ? (
                        <div className="space-y-1">
                          {ALL_DAYS.map(d => {
                            const config = s.dailyConfigs && s.dailyConfigs[d.v];
                            if (!config || !config.isActive) return null;
                            return (
                              <div key={d.v} className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-600">
                                <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded flex-shrink-0 w-6 text-center uppercase">{d.l}</span>
                                <span>{config.startTime}-{config.endTime}</span>
                                {config.breakStart && (
                                  <span className="text-orange-500 flex items-center ml-1">
                                    <Coffee size={10} className="mr-0.5" /> {config.breakStart}-{config.breakEnd}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <>
                          <p className="text-sm sm:text-base font-black text-slate-900 mb-1 leading-none">
                            {s.startTime || '--:--'} - {s.endTime || '--:--'}
                          </p>
                          {s.breakStart && (
                            <div className="flex items-center gap-1 text-[9px] font-black text-orange-500 uppercase">
                              <Coffee size={10} /> Pausa: {s.breakStart} - {s.breakEnd || '--:--'}
                            </div>
                          )}
                          <div className="flex gap-0.5 mt-1">
                            {WEEKDAY_BADGES.map(d => {
                              const isActive = (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
                              return isActive ? (
                                <span key={d.v} className="bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded text-[8px] font-black uppercase">{d.l}</span>
                              ) : null;
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            }) : <p className="text-xs text-slate-400 italic">Sem turnos atribuídos.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
