import React from 'react';
import { Coffee, Star, Timer, Clock } from 'lucide-react';

const ALL_DAYS = [{ v: 1, l: '2ª' }, { v: 2, l: '3ª' }, { v: 3, l: '4ª' }, { v: 4, l: '5ª' }, { v: 5, l: '6ª' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }];

function groupDaysByTime(dailyConfigs) {
  const groups = {};
  ALL_DAYS.forEach(d => {
    const cfg = dailyConfigs?.[d.v];
    if (!cfg?.isActive) return;
    const key = `${cfg.startTime}|${cfg.endTime}|${cfg.breakStart || ''}|${cfg.breakEnd || ''}`;
    if (!groups[key]) groups[key] = { startTime: cfg.startTime, endTime: cfg.endTime, breakStart: cfg.breakStart || '', breakEnd: cfg.breakEnd || '', days: [] };
    groups[key].days.push(d);
  });
  return Object.values(groups);
}

function TimeRow({ startTime, endTime, breakStart, breakEnd }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-center">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Entrada</p>
        <p className="text-base font-black tabular-nums text-slate-800 leading-none">{startTime || '--:--'}</p>
      </div>
      <span className="text-slate-300 font-black">→</span>
      <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-center">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Saída</p>
        <p className="text-base font-black tabular-nums text-slate-800 leading-none">{endTime || '--:--'}</p>
      </div>
      {breakStart && (
        <>
          <span className="text-slate-200">·</span>
          <div className="bg-orange-50 rounded-xl px-3 py-2 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-0.5 flex items-center justify-center gap-0.5">
              <Coffee size={8} /> Pausa
            </p>
            <p className="text-xs font-black tabular-nums text-orange-500 leading-none whitespace-nowrap">
              {breakStart} – {breakEnd || '--:--'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function DayChips({ days, allDays = false, activeDayValues }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {ALL_DAYS.map(d => {
        const isActive = allDays
          ? activeDayValues.includes(d.v)
          : days.some(day => day.v === d.v);
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
  );
}

function ScheduleCard({ s, isDefault, setDefaultSchedule }) {
  const groups = s.isAdvanced ? groupDaysByTime(s.dailyConfigs) : [];
  const firstGroup = groups[0];
  const headerSubtitle = s.isAdvanced
    ? (firstGroup ? `${firstGroup.startTime} – ${firstGroup.endTime}` : null)
    : (s.startTime ? `${s.startTime} – ${s.endTime || '--:--'}` : null);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <div className={`p-2 rounded-xl shrink-0 ${isDefault ? 'bg-indigo-100' : 'bg-slate-100'}`}>
          <Timer size={15} className={isDefault ? 'text-indigo-600' : 'text-slate-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-800 leading-tight truncate">{s.name}</p>
          {headerSubtitle && (
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{headerSubtitle}</p>
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
      <div className="px-4 py-3 space-y-3">
        {s.isAdvanced ? (
          groups.length === 1 ? (
            /* Single group — same visual as simple schedule */
            <>
              <TimeRow {...firstGroup} />
              <DayChips days={firstGroup.days} />
            </>
          ) : (
            /* Multiple groups — show each group with its day chips + time row */
            <div className="space-y-3">
              {groups.map((g, i) => (
                <div key={i} className={i > 0 ? 'pt-3 border-t border-slate-100' : ''}>
                  <DayChips days={g.days} />
                  <div className="mt-2">
                    <TimeRow {...g} />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Simple schedule */
          <>
            <TimeRow startTime={s.startTime} endTime={s.endTime} breakStart={s.breakStart} breakEnd={s.breakEnd} />
            <DayChips allDays activeDayValues={s.weekdays || [1, 2, 3, 4, 5]} />
          </>
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
