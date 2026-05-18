import React, { useState, useEffect, useRef } from 'react';
import StatusBadge from './StatusBadge';
import { AlertCircle, Trash2 } from 'lucide-react';
import { calculateDuration } from '../../utils/formatUtils';

const QuickReportCard = ({ notification, onEdit, isEditing, draft, updateField, allWorkersData, onApply, onReject }) => {
  const { dateRange, message, clientName } = notification;
  const hoursDiscrepancy = notification.hoursDiscrepancy;
  const showDiscrepancy = hoursDiscrepancy && hoursDiscrepancy !== '0.0' && hoursDiscrepancy !== '0';

  const workersData = notification.payload?.changes || allWorkersData || [];

  const [localEdits, setLocalEdits] = useState({});
  const [deletedDays, setDeletedDays] = useState({});
  const [calcKey, setCalcKey] = useState(0);
  const [expandedWorker, setExpandedWorker] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const inputRef = useRef(null);

  const handleTimeChange = (workerIdx, dayIdx, field, value) => {
    const key = `w${workerIdx}.d${dayIdx}.${field}`;
    setLocalEdits(prev => ({ ...prev, [key]: value }));
    setCalcKey(prev => prev + 1);

    if (draft?.updateFn) {
      draft.updateFn(`workers.${workerIdx}.dailyRecords.${dayIdx}.${field}`, value);
    }
  };

  const handleDeleteDay = (workerIdx, dayIdx) => {
    const key = `w${workerIdx}.d${dayIdx}`;
    setDeletedDays(prev => ({ ...prev, [key]: true }));
    setCalcKey(prev => prev + 1);

    if (draft?.updateFn) {
      draft.updateFn(`workers.${workerIdx}.dailyRecords.${dayIdx}.deleted`, true);
    }
  };

  const handleRestoreDay = (workerIdx, dayIdx) => {
    const key = `w${workerIdx}.d${dayIdx}`;
    setDeletedDays(prev => ({ ...prev, [key]: false }));
    setCalcKey(prev => prev + 1);

    if (draft?.updateFn) {
      draft.updateFn(`workers.${workerIdx}.dailyRecords.${dayIdx}.deleted`, false);
    }
  };

  const getValue = (workerIdx, dayIdx, field, originalValue) => {
    const key = `w${workerIdx}.d${dayIdx}.${field}`;
    return localEdits[key] ?? originalValue ?? '';
  };

  useEffect(() => {
    setCalcKey(prev => prev + 1);
  }, [localEdits]);

  const startEditing = (workerIdx, dayIdx, field) => {
    if (editingCell && editingCell.workerIdx === workerIdx &&
        editingCell.dayIdx === dayIdx && editingCell.field === field) {
      return;
    }
    setEditingCell({ workerIdx, dayIdx, field });
  };

  const stopEditing = () => {
    setEditingCell(null);
  };

  const handleInputChange = (workerIdx, dayIdx, field, value) => {
    handleTimeChange(workerIdx, dayIdx, field, value);
  };

  const isEditingCell = (workerIdx, dayIdx, field) => {
    return editingCell && editingCell.workerIdx === workerIdx && editingCell.dayIdx === dayIdx && editingCell.field === field;
  };

  const formatTimeValue = (val) => {
    if (!val || val === '--:--' || val === '-') return '';
    return val;
  };

  const handleTimeInputBlur = (workerIdx, dayIdx, field, value) => {
    handleTimeChange(workerIdx, dayIdx, field, value);
    stopEditing();
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden transition-all hover:shadow-2xl">
      <div className="p-6 border-b border-slate-50 flex justify-between items-start bg-gradient-to-br from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <StatusBadge type="quick" />
          <div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{clientName || 'Cliente'}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Mensagem Rápida</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-300 bg-slate-100 px-2 py-1 rounded-lg">{notification.id?.slice(-8)}</span>
      </div>

      <div className="p-6 space-y-5">
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={12} className="text-indigo-500" />
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Mensagem do Cliente</span>
          </div>
          <p className="text-slate-600 text-sm font-medium leading-relaxed">"{message}"</p>
        </div>

        {workersData.length > 0 && (
          <div className="space-y-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Colaboradores</span>

            {workersData.map((worker, idx) => {
              const visibleDays = (worker.dailyRecords || []).filter((d, di) => !deletedDays[`w${idx}.d${di}`]);
              const workerOriginalTotal = (worker.dailyRecords || []).reduce((acc, d) => acc + (d.hours || 0), 0);
              const workerEditedTotal = visibleDays.reduce((acc, d) => {
                const dayIdx = worker.dailyRecords.indexOf(d);
                const entry = getValue(idx, dayIdx, 'editedEntry', d.entry);
                const exit = getValue(idx, dayIdx, 'editedExit', d.exit);
                const breakStart = getValue(idx, dayIdx, 'editedBreakStart', d.breakStart);
                const breakEnd = getValue(idx, dayIdx, 'editedBreakEnd', d.breakEnd);
                return acc + calculateDuration(entry, exit, breakStart, breakEnd);
              }, 0);
              const workerDiff = workerEditedTotal - workerOriginalTotal;

              return (
                <div key={worker.id || idx} className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                  <div
                    className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => setExpandedWorker(expandedWorker === idx ? null : idx)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 border border-slate-200 text-slate-500 rounded-xl flex items-center justify-center font-black text-xs">
                        {workerOriginalTotal.toFixed(1)}h
                      </span>
                      <div>
                        <p className="font-black text-slate-800">{worker.name}</p>
                        <p className="text-[10px] text-slate-400">{worker.role || 'Colaborador'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-indigo-600">{workerEditedTotal.toFixed(1)}h</span>
                      {workerDiff !== 0 && (
                        <span className={`text-[10px] font-bold ${workerDiff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {workerDiff > 0 ? '+' : ''}{workerDiff.toFixed(1)}h
                        </span>
                      )}
                    </div>
                  </div>

                  {expandedWorker === idx && (
                    <div className="p-4 bg-white">
                      <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase mb-3 px-1 bg-slate-50 py-2 rounded-lg">
                        <span className="w-12 text-center">Dia</span>
                        <span className="flex-1 text-center">Entrada</span>
                        <span className="flex-1 text-center">Saída</span>
                        <span className="flex-1 text-center">P.Início</span>
                        <span className="flex-1 text-center">P.Fim</span>
                        <span className="w-14 text-center">Original</span>
                        <span className="w-20 text-center">Calculado</span>
                        <span className="w-8 text-center"></span>
                      </div>

                      {(worker.dailyRecords || []).map((day, dayIdx) => {
                        const isDeleted = deletedDays[`w${idx}.d${dayIdx}`];

                        const origEntry = day.entry || '';
                        const origExit = day.exit || '';
                        const origBreakStart = day.breakStart || '';
                        const origBreakEnd = day.breakEnd || '';
                        const origHours = day.hours || 0;

                        const editEntry = getValue(idx, dayIdx, 'editedEntry', day.entry);
                        const editExit = getValue(idx, dayIdx, 'editedExit', day.exit);
                        const editBreakStart = getValue(idx, dayIdx, 'editedBreakStart', day.breakStart);
                        const editBreakEnd = getValue(idx, dayIdx, 'editedBreakEnd', day.breakEnd);

                        const calcHours = calculateDuration(editEntry, editExit, editBreakStart, editBreakEnd);
                        const hoursDiff = calcHours - origHours;

                        const hasChanges = localEdits[`w${idx}.d${dayIdx}.editedEntry`] || localEdits[`w${idx}.d${dayIdx}.editedExit`] || localEdits[`w${idx}.d${dayIdx}.editedBreakStart`] || localEdits[`w${idx}.d${dayIdx}.editedBreakEnd`];
                        const wasOriginallyEmpty = (origEntry === '--:--' || !origEntry) && (origExit === '--:--' || !origExit);
                        const isNowFilled = (editEntry && editEntry !== '--:--') || (editExit && editExit !== '--:--');
                        const isAdded = wasOriginallyEmpty && isNowFilled && !isDeleted;
                        const isEdited = !wasOriginallyEmpty && hasChanges && !isDeleted && !isAdded;

                        return (
                          <div key={dayIdx} className={`flex items-center gap-1 py-2.5 border-b border-slate-100 last:border-0 ${isDeleted ? 'bg-rose-200' : isAdded ? 'bg-emerald-200' : isEdited ? 'bg-amber-200/50' : ''}`}>
                            <span className="w-12 text-xs font-bold text-slate-600">{day.date?.slice(0, 5) || '-'}</span>

                            <div className="flex-1 flex items-center justify-center gap-0.5 text-[10px]">
                              {isEditingCell(idx, dayIdx, 'editedEntry') ? (
                                <input
                                  ref={inputRef}
                                  type="time"
                                  className="w-full text-xs border border-indigo-300 rounded-lg px-1 py-1 text-center focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                  value={formatTimeValue(editEntry)}
                                  onChange={(e) => handleInputChange(idx, dayIdx, 'editedEntry', e.target.value)}
                                  onBlur={(e) => handleTimeInputBlur(idx, dayIdx, 'editedEntry', e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleTimeInputBlur(idx, dayIdx, 'editedEntry', e.target.value)}
                                />
                              ) : (
                                <div
                                  onClick={() => !isDeleted && startEditing(idx, dayIdx, 'editedEntry')}
                                  className={`w-full flex items-center justify-center gap-0.5 cursor-pointer rounded px-1 py-1 ${!isDeleted && 'hover:bg-indigo-50'}`}
                                >
                                  {(hasChanges || isDeleted) ? (
                                    <>
                                      <span className="text-slate-400 line-through">{origEntry || '--:--'}</span>
                                      <span className="text-slate-300">→</span>
                                      <span className={`font-bold ${isDeleted ? 'text-rose-500' : 'text-slate-800'}`}>{isDeleted ? '--:--' : (editEntry || '--:--')}</span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-600">{origEntry || '--:--'}</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 flex items-center justify-center gap-0.5 text-[10px]">
                              {isEditingCell(idx, dayIdx, 'editedExit') ? (
                                <input
                                  ref={inputRef}
                                  type="time"
                                  className="w-full text-xs border border-indigo-300 rounded-lg px-1 py-1 text-center focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                  value={formatTimeValue(editExit)}
                                  onChange={(e) => handleInputChange(idx, dayIdx, 'editedExit', e.target.value)}
                                  onBlur={(e) => handleTimeInputBlur(idx, dayIdx, 'editedExit', e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleTimeInputBlur(idx, dayIdx, 'editedExit', e.target.value)}
                                />
                              ) : (
                                <div
                                  onClick={() => !isDeleted && startEditing(idx, dayIdx, 'editedExit')}
                                  className={`w-full flex items-center justify-center gap-0.5 cursor-pointer rounded px-1 py-1 ${!isDeleted && 'hover:bg-indigo-50'}`}
                                >
                                  {(hasChanges || isDeleted) ? (
                                    <>
                                      <span className="text-slate-400 line-through">{origExit || '--:--'}</span>
                                      <span className="text-slate-300">→</span>
                                      <span className={`font-bold ${isDeleted ? 'text-rose-500' : 'text-slate-800'}`}>{isDeleted ? '--:--' : (editExit || '--:--')}</span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-600">{origExit || '--:--'}</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 flex items-center justify-center gap-0.5 text-[10px]">
                              {isEditingCell(idx, dayIdx, 'editedBreakStart') ? (
                                <input
                                  ref={inputRef}
                                  type="time"
                                  className="w-full text-xs border border-indigo-300 rounded-lg px-1 py-1 text-center focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                  value={formatTimeValue(editBreakStart)}
                                  onChange={(e) => handleInputChange(idx, dayIdx, 'editedBreakStart', e.target.value)}
                                  onBlur={(e) => handleTimeInputBlur(idx, dayIdx, 'editedBreakStart', e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleTimeInputBlur(idx, dayIdx, 'editedBreakStart', e.target.value)}
                                />
                              ) : (
                                <div
                                  onClick={() => !isDeleted && startEditing(idx, dayIdx, 'editedBreakStart')}
                                  className={`w-full flex items-center justify-center gap-0.5 cursor-pointer rounded px-1 py-1 ${!isDeleted && 'hover:bg-indigo-50'}`}
                                >
                                  {(hasChanges || isDeleted) ? (
                                    <>
                                      <span className="text-slate-400 line-through">{origBreakStart || '--:--'}</span>
                                      <span className="text-slate-300">→</span>
                                      <span className={`font-bold ${isDeleted ? 'text-rose-500' : 'text-slate-800'}`}>{isDeleted ? '--:--' : (editBreakStart || '--:--')}</span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-500">{origBreakStart || '--:--'}</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 flex items-center justify-center gap-0.5 text-[10px]">
                              {isEditingCell(idx, dayIdx, 'editedBreakEnd') ? (
                                <input
                                  ref={inputRef}
                                  type="time"
                                  className="w-full text-xs border border-indigo-300 rounded-lg px-1 py-1 text-center focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                  value={formatTimeValue(editBreakEnd)}
                                  onChange={(e) => handleInputChange(idx, dayIdx, 'editedBreakEnd', e.target.value)}
                                  onBlur={(e) => handleTimeInputBlur(idx, dayIdx, 'editedBreakEnd', e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleTimeInputBlur(idx, dayIdx, 'editedBreakEnd', e.target.value)}
                                />
                              ) : (
                                <div
                                  onClick={() => !isDeleted && startEditing(idx, dayIdx, 'editedBreakEnd')}
                                  className={`w-full flex items-center justify-center gap-0.5 cursor-pointer rounded px-1 py-1 ${!isDeleted && 'hover:bg-indigo-50'}`}
                                >
                                  {(hasChanges || isDeleted) ? (
                                    <>
                                      <span className="text-slate-400 line-through">{origBreakEnd || '--:--'}</span>
                                      <span className="text-slate-300">→</span>
                                      <span className={`font-bold ${isDeleted ? 'text-rose-500' : 'text-slate-800'}`}>{isDeleted ? '--:--' : (editBreakEnd || '--:--')}</span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-500">{origBreakEnd || '--:--'}</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <span className={`w-14 text-[10px] text-center ${hasChanges || isDeleted ? 'text-slate-400 line-through' : ''} ${!(hasChanges || isDeleted) && origHours !== 0 ? 'font-bold text-slate-600' : ''}`}>{origHours.toFixed(1)}h</span>

                            <div className="w-20 flex items-center justify-center gap-1">
                              {isDeleted ? (
                                <>
                                  <span className="text-black font-bold text-[10px]">0.0h</span>
                                  <span className="text-rose-600 text-[9px] font-bold">-{origHours.toFixed(1)}h</span>
                                </>
                              ) : hasChanges ? (
                                <>
                                  <span className="text-[10px] font-bold text-indigo-700">
                                    {calcHours.toFixed(1)}h
                                  </span>
                                  {hoursDiff !== 0 && (
                                    <span className={`text-[9px] font-bold ${hoursDiff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {hoursDiff > 0 ? '+' : ''}{hoursDiff.toFixed(1)}h
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-300">—</span>
                              )}
                            </div>

                            <button
                              onClick={() => isDeleted ? handleRestoreDay(idx, dayIdx) : handleDeleteDay(idx, dayIdx)}
                              className={`w-8 flex items-center justify-center transition-colors ${isDeleted ? 'text-emerald-500 hover:text-emerald-700' : 'text-slate-300 hover:text-rose-500'}`}
                              title={isDeleted ? 'Restaurar' : 'Eliminar'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                      <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
<button
                          onClick={() => onApply?.({ localEdits, deletedDays, workersData, notification })}
                          className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                        >
                          Aplicar e Enviar
                        </button>
                        <button
                          onClick={() => onReject?.({ notification, workersData })}
                          className="py-3 px-4 bg-rose-50 text-rose-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition-colors"
                        >
                          Rejeitar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Período</span>
              <span className="text-xs font-bold text-slate-700">{dateRange}</span>
            </div>
            {showDiscrepancy && (
              <>
                <div className="w-px h-8 bg-slate-200"></div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Diferença</span>
                  <span className="text-lg font-black text-amber-500">{hoursDiscrepancy}h</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="px-6 pb-6">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Observações (opcional)</label>
            <textarea
              className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows="2"
              placeholder="Nota sobre a correção..."
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickReportCard;