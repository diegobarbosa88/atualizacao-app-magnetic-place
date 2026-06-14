import React from 'react';
import { Coffee, Star, Timer, Clock } from 'lucide-react';

const ALL_DAYS = [{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }];

function ScheduleCard({ s, isDefault, setDefaultSchedule }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <div className={`p-2 rounded-xl shrink-0 ${isDefault ? 'bg-indigo-100' : 'bg-slate-100'}`}>
          <Timer size={15} className={isDefault ? 'text-indigo-600' : 'text-slate-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-800 leading-tight truncate">{s.name}</p>
          {!s.isAdvanced && s.startTime && (
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
              {s.startTime} – {s.endTime || '--:--'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDefault && (
            <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white px-2.5 py-0.5 rounded-full">
              Padrão
            </span>
          )}
          <button
            onClick={() => setDefaultSchedule(s.id)}
            title="Definir como Padrão"
            className={`p-1.5 rounded-xl transition-all ${isDefault ? 'text-indigo-500 bg-indigo-50' : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100'}`}
          >
            <Star fill={isDefault ? 'currentColor' : 'none'} size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {s.isAdvanced ? (
          <div className="space-y-2">
            {ALL_DAYS.map(d => {
              const config = s.dailyConfigs?.[d.v];
              if (!config?.isActive) return null;
              return (
                <div key={d.v} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2">
                  <span className="w-7 shrink-0 text-center text-[9px] font-black uppercase bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded-lg">
                    {d.l}
                  </span>
                  <span className="text-xs font-black tabular-nums text-slate-700 flex-1">
                    {config.startTime} – {config.endTime}
                  </span>
                  {config.breakStart && (
                    <span className="text-[9px] font-bold text-orange-500 flex items-center gap-0.5">
                      <Coffee size={9} /> {config.breakStart}–{config.breakEnd}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Time row */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Entrada</p>
                <p className="text-base font-black tabular-nums text-slate-800 leading-none">{s.startTime || '--:--'}</p>
              </div>
              <span className="text-slate-300 font-black">→</span>
              <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Saída</p>
                <p className="text-base font-black tabular-nums text-slate-800 leading-none">{s.endTime || '--:--'}</p>
              </div>
              {s.breakStart && (
                <>
                  <span className="text-slate-200">·</span>
                  <div className="bg-orange-50 rounded-xl px-3 py-2 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-0.5 flex items-center justify-center gap-0.5">
                      <Coffee size={8} /> Pausa
                    </p>
                    <p className="text-xs font-black tabular-nums text-orange-500 leading-none whitespace-nowrap">
                      {s.breakStart} – {s.breakEnd || '--:--'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Weekday chips */}
            <div className="flex gap-1 flex-wrap">
              {ALL_DAYS.map(d => {
                const isActive = (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
                return (
                  <span
                    key={d.v}
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-300'}`}
                  >
                    {d.l}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkerScheduleTab({ assigned, currentUser, expandedSchedules, toggleScheduleExpand, setDefaultSchedule }) {
  if (assigned.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-12 text-center">
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
          <Clock size={18} className="text-slate-400" />
        </div>
        <p className="text-sm font-bold text-slate-400">Sem turnos atribuídos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {assigned.map(s => (
        <ScheduleCard
          key={s.id}
          s={s}
          isDefault={currentUser?.defaultScheduleId === s.id}
          setDefaultSchedule={setDefaultSchedule}
        />
      ))}
    </div>
  );
}
