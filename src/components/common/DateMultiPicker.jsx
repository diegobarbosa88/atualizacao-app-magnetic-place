import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toISODateLocal } from '../../utils/dateUtils';
import { SCALE } from '../../styles/designTokens';

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function DateMultiPicker({ selected = [], onChange }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const selectedSet = new Set(selected);

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  // ISO weekday: Mon=0 ... Sun=6
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const toDateStr = (day) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${viewYear}-${mm}-${dd}`;
  };

  const toggleDay = (day) => {
    const str = toDateStr(day);
    const next = selectedSet.has(str)
      ? selected.filter(d => d !== str)
      : [...selected, str];
    onChange(next);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Select all days in the current viewed month
  const selectAll = () => {
    const monthDays = Array.from({ length: daysInMonth }, (_, i) => toDateStr(i + 1));
    const merged = [...new Set([...selected, ...monthDays])];
    onChange(merged);
  };

  const clearAll = () => onChange([]);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-3">
      {/* Header navegação */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-1.5 rounded-xl hover:bg-[var(--border-soft)] text-[var(--slate-dim)] transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-black text-[var(--ink-soft)] uppercase tracking-wider">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} className="p-1.5 rounded-xl hover:bg-[var(--border-soft)] text-[var(--slate-dim)] transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Labels dos dias da semana */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map(l => (
          <div key={l} className={`text-center ${SCALE.text.statLabel} text-[var(--slate-dim)] py-1`}>{l}</div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const str = toDateStr(day);
          const isSelected = selectedSet.has(str);
          return (
            <button
              key={str}
              onClick={() => toggleDay(day)}
              className={`aspect-square rounded-xl text-xs font-black transition-all active:scale-90 ${
                isSelected
                  ? 'bg-[var(--orange)] text-[var(--navy-solid)] shadow-md'
                  : 'bg-white text-[var(--ink-soft)] hover:bg-[var(--navy-soft)] border border-[var(--border-soft)]'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Ações rápidas */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          <button onClick={selectAll} className={`${SCALE.text.badge} text-[var(--navy)] hover:text-[var(--navy-deep)] transition-colors`}>
            Selec. mês
          </button>
          {selected.length > 0 && (
            <button onClick={clearAll} className={`${SCALE.text.badge} text-[var(--tone-rose)] hover:opacity-70 transition-colors flex items-center gap-1`}>
              <X size={10} /> Limpar
            </button>
          )}
        </div>
        <span className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>
          {selected.length} {selected.length === 1 ? 'dia' : 'dias'}
        </span>
      </div>
    </div>
  );
}
