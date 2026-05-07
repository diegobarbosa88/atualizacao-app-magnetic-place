import React from 'react';
import TimeInput from './TimeInput';

const PrecisionEditTable = ({ days, originalDays, onUpdateField, deletedDays, onDeleteDay, onRestoreDay }) => {
  return (
    <div className="mt-4">
      <table className="w-full">
        <thead>
          <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
            <th className="py-3 px-2 text-left">Dia</th>
            <th className="py-3 px-2 text-left">Entrada</th>
            <th className="py-3 px-2 text-left">Saída</th>
            <th className="py-3 px-2 text-left">Intervalo</th>
            <th className="py-3 px-2 text-left">Original</th>
            <th className="py-3 px-2 text-left">Calculado</th>
            <th className="py-3 px-2 text-left"></th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, index) => {
            const originalIndex = originalDays.indexOf(day);
            const deleteKey = `d${originalIndex}`;
            const isDeleted = deletedDays?.[deleteKey];

            if (isDeleted) return null;

            const origStart = day.entry || day.start || '--:--';
            const editStart = day.editedEntry || day.start || '--:--';
            const origEnd = day.exit || day.end || '--:--';
            const editEnd = day.editedExit || day.end || '--:--';
            const origBreak = day.breakStart || day.break || '--:--';
            const editBreak = day.editedBreakStart || day.breakStart || day.break || '--:--';

            const wasEdited = day.editedEntry || day.editedExit || day.editedBreakStart || day.editedBreakEnd;

            return (
              <tr key={index} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${wasEdited ? 'bg-amber-50/30' : ''}`}>
                <td className="py-3 px-2">
                  <span className="text-sm font-bold text-amber-600">{day.date}</span>
                </td>
                <td className="py-3 px-2">
                  {wasEdited ? (
                    <span className="flex items-center gap-1 text-[10px]">
                      <span className="text-slate-400 line-through">{origStart}</span>
                      <span className="text-slate-300">→</span>
                      <span className="font-bold text-slate-800">{editStart}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600">{origStart}</span>
                  )}
                </td>
                <td className="py-3 px-2">
                  {wasEdited ? (
                    <span className="flex items-center gap-1 text-[10px]">
                      <span className="text-slate-400 line-through">{origEnd}</span>
                      <span className="text-slate-300">→</span>
                      <span className="font-bold text-slate-800">{editEnd}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600">{origEnd}</span>
                  )}
                </td>
                <td className="py-3 px-2">
                  {wasEdited ? (
                    <span className="flex items-center gap-1 text-[10px]">
                      <span className="text-slate-400 line-through">{origBreak}</span>
                      <span className="text-slate-300">→</span>
                      <span className="font-bold text-slate-800">{editBreak}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">{origBreak}</span>
                  )}
                </td>
                <td className="py-3 px-2">
                  <span className="text-[10px] text-slate-400 line-through">{(day.hours || 0).toFixed(1)}h</span>
                </td>
                <td className="py-3 px-2">
                  <span className="text-[10px] font-bold text-indigo-700">{(day.editedHours || day.hours || 0).toFixed(1)}h</span>
                </td>
                <td className="py-3 px-2">
                  <button
                    onClick={() => onDeleteDay?.(originalIndex)}
                    className="text-slate-300 hover:text-rose-500 transition-colors"
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PrecisionEditTable;