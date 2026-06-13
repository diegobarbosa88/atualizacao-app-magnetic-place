import React from 'react';
import { Coffee, Star } from 'lucide-react';

const ALL_DAYS = [{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }];
const WEEKDAY_BADGES = [{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }];

function TimeBlock({ label, time }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</span>
      <span className="text-lg font-black tabular-nums text-slate-800 leading-none">{time || '--:--'}</span>
    </div>
  );
}

function ScheduleCard({ s, isDefault, setDefaultSchedule }) {
  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${isDefault ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}>

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className={`text-sm font-black leading-tight ${isDefault ? 'text-indigo-800' : 'text-slate-800'}`}>{s.name}</p>
        <div className="flex items-center gap-2 shrink-0">
          {isDefault && (
            <span className="text-[8px] font-black uppercase tracking-widest bg-indigo-600 text-white px-2 py-0.5 rounded-full">Padrão</span>
          )}
          <button
            onClick={() => setDefaultSchedule(s.id)}
            title="Definir como Padrão"
            className={`p-1.5 rounded-xl transition-all ${isDefault ? 'text-indigo-500 bg-indigo-100' : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100'}`}
          >
            <Star fill={isDefault ? 'currentColor' : 'none'} size={14} />
          </button>
        </div>
      </div>

      {/* Time info */}
      {s.isAdvanced ? (
        <div className="space-y-1.5">
          {ALL_DAYS.map(d => {
            const config = s.dailyConfigs?.[d.v];
            if (!config?.isActive) return null;
            return (
              <div key={d.v} className="flex items-center gap-2">
                <span className="w-7 shrink-0 text-center text-[9px] font-black uppercase bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded-lg">{d.l}</span>
                <span className="text-xs font-black tabular-nums text-slate-700">{config.startTime} – {config.endTime}</span>
                {config.breakStart && (
                  <span className="text-[9px] font-bold text-orange-500 flex items-center gap-0.5 ml-1">
                    <Coffee size={9} /> {config.breakStart}–{config.breakEnd}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <TimeBlock label="Entrada" time={s.startTime} />
            <span className="text-slate-300 font-black text-lg mt-3">→</span>
            <TimeBlock label="Saída" time={s.endTime} />
            {s.breakStart && (
              <>
                <div className="h-8 w-px bg-slate-100 mx-1" />
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black uppercase tracking-widest text-orange-400 mb-0.5 flex items-center gap-0.5"><Coffee size={8} /> Pausa</span>
                  <span className="text-xs font-black tabular-nums text-orange-500 leading-none">{s.breakStart} – {s.breakEnd || '--:--'}</span>
                </div>
              </>
            )}
          </div>

          {/* Day chips */}
          <div className="flex gap-1 flex-wrap">
            {WEEKDAY_BADGES.map(d => {
              const isActive = (s.weekdays || [1, 2, 3, 4, 5]).includes(d.v);
              return (
                <span
                  key={d.v}
                  className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-300'}`}
                >
                  {d.l}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function WorkerScheduleTab({ assigned, currentUser, expandedSchedules, toggleScheduleExpand, setDefaultSchedule }) {
  if (assigned.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400">
        <p className="text-sm font-bold">Sem turnos atribuídos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
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
