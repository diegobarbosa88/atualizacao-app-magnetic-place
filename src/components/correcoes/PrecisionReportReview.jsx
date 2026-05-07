import React, { useState, useRef, useMemo } from 'react';
import { Trash2, AlertCircle, ChevronDown } from 'lucide-react';

const PrecisionReportReview = ({
  draftData,
  originalTotal,
  draftTotal,
  reportJustification,
  onBack,
  onConfirm,
  onEditDay,
  onDeleteDay,
  readOnly = false,
  showAllDays = false,
  selectedWorkerId = null,
  showAllWorkers = false,
  isReviewMode = false,
  title = "Ajuste de Precisão",
  subtitle = "Revisão do Reporte",
  monthLabel = ""
}) => {
  const [expandedWorker, setExpandedWorker] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const inputRef = useRef(null);

  const isDayChanged = (d) => {
    const originalEntry = d.entry === '--:--' ? '' : d.entry;
    const originalExit = d.exit === '--:--' ? '' : d.exit;
    return d.editedEntry !== originalEntry || d.editedExit !== originalExit ||
           d.editedBreakStart !== (d.breakStart || '') || d.editedBreakEnd !== (d.breakEnd || '');
  };

  const isDayAdded = (d) => {
    const wasOriginallyEmpty = (!d.entry || d.entry === '--:--') && (!d.exit || d.exit === '--:--');
    const isNowFilled = (d.editedEntry && d.editedEntry !== '--:--') || (d.editedExit && d.editedExit !== '--:--');
    return wasOriginallyEmpty && isNowFilled;
  };

  const isDayEdited = (d) => {
    const wasOriginallyEmpty = (!d.entry || d.entry === '--:--') && (!d.exit || d.exit === '--:--');
    return !wasOriginallyEmpty && isDayChanged(d);
  };

  const isDayCleared = (d) => {
    const isClearedPattern = (val) => val === '--:--' || (val && val.startsWith('--:') && val.includes('-----'));
    return (d.entry && d.entry !== '--:--' && (!d.editedEntry || isClearedPattern(d.editedEntry) || !d.editedExit || isClearedPattern(d.editedExit))) ||
           (d.exit && d.exit !== '--:--' && (!d.editedEntry || isClearedPattern(d.editedEntry) || !d.editedExit || isClearedPattern(d.editedExit)));
  };

  const workersToShow = useMemo(() => {
    if (selectedWorkerId) {
      return draftData.filter(w => w.id === selectedWorkerId);
    }
    return draftData;
  }, [draftData, selectedWorkerId]);

  const relevantWorkers = useMemo(() => {
    if (showAllWorkers) {
      return workersToShow.filter(w => w.dailyRecords.some(d => d.hours > 0 || d.editedHours > 0));
    }
    return workersToShow.filter(w => w.dailyRecords.some(d => d.hours > 0 || d.editedHours > 0));
  }, [workersToShow, showAllWorkers]);

  const allWorkers = useMemo(() => {
    return draftData;
  }, [draftData]);

  const startEditing = (workerId, dayDate, field) => {
    if (readOnly) return;
    if (editingCell && editingCell.workerId === workerId && editingCell.dayDate === dayDate && editingCell.field === field) {
      return;
    }
    setEditingCell({ workerId, dayDate, field });
  };

  const stopEditing = () => {
    setEditingCell(null);
  };

  const handleInputChange = (workerId, dayDate, field, value) => {
    if (readOnly) return;
    onEditDay?.(workerId, dayDate, field, value);
    stopEditing();
  };

  const isEditingCell = (workerId, dayDate, field) => {
    return editingCell && editingCell.workerId === workerId && editingCell.dayDate === dayDate && editingCell.field === field;
  };

  const formatTimeValue = (val) => {
    if (!val || val === '--:--' || val === '-') return '';
    return val;
  };

  const renderDaysForWorker = (worker) => {
    const days = worker.dailyRecords || [];
    const filteredDays = showAllDays
      ? days
      : days.filter(d => d.hours > 0 || d.editedHours > 0 || isDayChanged(d) || isDayCleared(d));

    return filteredDays.map((day) => {
      const changed = isDayChanged(day);
      const isAdded = isDayAdded(day);
      const isEdited = isDayEdited(day);
      const cleared = isDayCleared(day);
      const origEntry = day.entry || '';
      const origExit = day.exit || '';
      const origBreakStart = day.breakStart || '';
      const origBreakEnd = day.breakEnd || '';
      const origHours = day.hours || 0;

      const editEntry = day.editedEntry || day.entry || '';
      const editExit = day.editedExit || day.exit || '';
      const editBreakStart = day.editedBreakStart || day.breakStart || '';
      const editBreakEnd = day.editedBreakEnd || day.breakEnd || '';
      const calcHours = day.editedHours || day.hours || 0;
      const hoursDiff = calcHours - origHours;

      const hasData = day.hours > 0 || day.editedHours > 0;

      return (
        <div key={day.date} className={`flex items-center gap-1 py-2.5 border-b border-slate-100 last:border-0 ${cleared ? 'bg-rose-200' : isAdded ? 'bg-emerald-200' : isEdited ? 'bg-amber-200/50' : !hasData && showAllDays ? 'bg-slate-50' : ''}`}>
          <span className="w-12 text-xs font-bold text-slate-600">{day.date?.slice(0, 2) || '-'}</span>

          <div className="flex-1 flex items-center justify-center gap-0.5 text-[10px]">
            {isEditingCell(worker.id, day.date, 'entry') ? (
              <input
                ref={inputRef}
                type="time"
                className="w-full text-xs border border-amber-300 rounded-lg px-1 py-1 text-center focus:ring-2 focus:ring-amber-500 outline-none bg-white text-black"
                value={formatTimeValue(editEntry)}
                onChange={(e) => handleInputChange(worker.id, day.date, 'entry', e.target.value)}
                onBlur={(e) => handleInputChange(worker.id, day.date, 'entry', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInputChange(worker.id, day.date, 'entry', e.target.value)}
              />
            ) : (
              <div
                onClick={() => !readOnly && startEditing(worker.id, day.date, 'entry')}
                className={`w-full flex items-center justify-center gap-0.5 rounded px-1 py-1 ${!readOnly ? 'cursor-pointer hover:bg-amber-50' : ''}`}
              >
                {(changed || cleared || isAdded) ? (
                  <>
                    <span className="text-slate-400 line-through">{origEntry || '--:--'}</span>
                    <span className="text-slate-300">→</span>
                    <span className={`font-bold ${cleared ? 'text-rose-500' : 'text-black'}`}>{cleared ? '--:--' : (editEntry || '--:--')}</span>
                  </>
                ) : (
                  <span className="text-xs text-black">{origEntry || '--:--'}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center gap-0.5 text-[10px]">
            {isEditingCell(worker.id, day.date, 'exit') ? (
              <input
                ref={inputRef}
                type="time"
                className="w-full text-xs border border-amber-300 rounded-lg px-1 py-1 text-center focus:ring-2 focus:ring-amber-500 outline-none bg-white text-black"
                value={formatTimeValue(editExit)}
                onChange={(e) => handleInputChange(worker.id, day.date, 'exit', e.target.value)}
                onBlur={(e) => handleInputChange(worker.id, day.date, 'exit', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInputChange(worker.id, day.date, 'exit', e.target.value)}
              />
            ) : (
              <div
                onClick={() => !readOnly && startEditing(worker.id, day.date, 'exit')}
                className={`w-full flex items-center justify-center gap-0.5 rounded px-1 py-1 ${!readOnly ? 'cursor-pointer hover:bg-amber-50' : ''}`}
              >
                {(changed || cleared || isAdded) ? (
                  <>
                    <span className="text-slate-400 line-through">{origExit || '--:--'}</span>
                    <span className="text-slate-300">→</span>
                    <span className={`font-bold ${cleared ? 'text-rose-500' : 'text-black'}`}>{cleared ? '--:--' : (editExit || '--:--')}</span>
                  </>
                ) : (
                  <span className="text-xs text-black">{origExit || '--:--'}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center gap-0.5 text-[10px]">
            {isEditingCell(worker.id, day.date, 'breakStart') ? (
              <input
                ref={inputRef}
                type="time"
                className="w-full text-xs border border-amber-300 rounded-lg px-1 py-1 text-center focus:ring-2 focus:ring-amber-500 outline-none bg-white text-black"
                value={formatTimeValue(editBreakStart)}
                onChange={(e) => handleInputChange(worker.id, day.date, 'breakStart', e.target.value)}
                onBlur={(e) => handleInputChange(worker.id, day.date, 'breakStart', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInputChange(worker.id, day.date, 'breakStart', e.target.value)}
              />
            ) : (
              <div
                onClick={() => !readOnly && startEditing(worker.id, day.date, 'breakStart')}
                className={`w-full flex items-center justify-center gap-0.5 rounded px-1 py-1 ${!readOnly ? 'cursor-pointer hover:bg-amber-50' : ''}`}
              >
                {(changed || cleared || isAdded) ? (
                  <>
                    <span className="text-slate-400 line-through">{origBreakStart || '--:--'}</span>
                    <span className="text-slate-300">→</span>
                    <span className={`font-bold ${cleared ? 'text-rose-500' : 'text-black'}`}>{cleared ? '--:--' : (editBreakStart || '--:--')}</span>
                  </>
                ) : (
                  <span className="text-xs text-black">{origBreakStart || '--:--'}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center gap-0.5 text-[10px]">
            {isEditingCell(worker.id, day.date, 'breakEnd') ? (
              <input
                ref={inputRef}
                type="time"
                className="w-full text-xs border border-amber-300 rounded-lg px-1 py-1 text-center focus:ring-2 focus:ring-amber-500 outline-none bg-white text-black"
                value={formatTimeValue(editBreakEnd)}
                onChange={(e) => handleInputChange(worker.id, day.date, 'breakEnd', e.target.value)}
                onBlur={(e) => handleInputChange(worker.id, day.date, 'breakEnd', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInputChange(worker.id, day.date, 'breakEnd', e.target.value)}
              />
            ) : (
              <div
                onClick={() => !readOnly && startEditing(worker.id, day.date, 'breakEnd')}
                className={`w-full flex items-center justify-center gap-0.5 rounded px-1 py-1 ${!readOnly ? 'cursor-pointer hover:bg-amber-50' : ''}`}
              >
                {(changed || cleared || isAdded) ? (
                  <>
                    <span className="text-slate-400 line-through">{origBreakEnd || '--:--'}</span>
                    <span className="text-slate-300">→</span>
                    <span className={`font-bold ${cleared ? 'text-rose-500' : 'text-black'}`}>{cleared ? '--:--' : (editBreakEnd || '--:--')}</span>
                  </>
                ) : (
                  <span className="text-xs text-black">{origBreakEnd || '--:--'}</span>
                )}
              </div>
            )}
          </div>

          <span className="w-14 text-[10px] text-center text-slate-400">
            {origHours.toFixed(1)}h
          </span>

          <div className="w-20 flex items-center justify-center gap-1">
            {cleared ? (
              <>
                <span className="text-black font-bold text-[10px]">0.0h</span>
                <span className="text-rose-600 text-[9px] font-bold">-{origHours.toFixed(1)}h</span>
              </>
            ) : (
              <>
                <span className="text-black font-bold text-[10px]">{calcHours.toFixed(1)}h</span>
                {hoursDiff !== 0 && (
                  <span className={`text-[9px] font-bold ${hoursDiff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {hoursDiff > 0 ? '+' : ''}{hoursDiff.toFixed(1)}h
                  </span>
                )}
              </>
            )}
          </div>

          {!readOnly && (
            <button
              onClick={() => onDeleteDay?.(worker.id, day.date)}
              className="w-8 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"
              title="Eliminar"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      );
    });
  };

  return (
    <div className="animate-fade-in bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-slate-50 flex justify-between items-start bg-gradient-to-br from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center font-black text-lg">🎯</div>
          <div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{title}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5 flex-1 overflow-y-auto">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-[2rem] p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Total Original</p>
                <p className="text-white text-2xl font-black">{originalTotal}h</p>
              </div>
              <div className="text-slate-500 text-2xl">→</div>
              <div>
                <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-1">Novo Total</p>
                <p className="text-indigo-300 text-2xl font-black">{draftTotal}h</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${draftTotal - originalTotal > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                Diferença
              </p>
              <p className={`text-sm font-black ${draftTotal - originalTotal > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {draftTotal - originalTotal > 0 ? '+' : ''}{(draftTotal - originalTotal).toFixed(2)}h
              </p>
            </div>
          </div>
        </div>

        {reportJustification && (
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={12} className="text-amber-500" />
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Mensagem Enviada</span>
            </div>
            <p className="text-slate-600 text-sm font-medium leading-relaxed">"{reportJustification}"</p>
          </div>
        )}

        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden flex-1 flex flex-col">

          <div className="p-4 bg-white flex-1 overflow-y-auto">
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

            {isReviewMode ? (
              allWorkers.map((worker) => {
                const workerChanged = worker.editedTotalHours !== worker.totalHours;
                const hasEditedDays = worker.dailyRecords.some(d => isDayChanged(d) || isDayCleared(d));

                if (!hasEditedDays && showAllWorkers) return null;

                return (
                  <div key={worker.id} className="mb-4 last:mb-0">
                    <div
                      className="bg-slate-50 p-3 border border-slate-100 rounded-xl mb-2 cursor-pointer hover:bg-slate-100 transition-colors flex items-center justify-between"
                      onClick={() => setExpandedWorker(expandedWorker === worker.id ? null : worker.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] ${workerChanged ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                          {workerChanged ? '!' : '✓'}
                        </span>
                        <span className="font-black text-slate-700 text-sm">{worker.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 line-through">{worker.totalHours}h</span>
                        <span className="text-slate-300">→</span>
                        <span className="text-xs font-black text-indigo-600">{worker.editedTotalHours}h</span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedWorker === worker.id ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {expandedWorker === worker.id && (
                      <div className="space-y-1 pl-2">
                        {renderDaysForWorker(worker)}
                      </div>
                    )}
                  </div>
                );
              })
            ) : selectedWorkerId ? (
              relevantWorkers.map((worker) => {
                return (
                  <div key={worker.id}>
                    {renderDaysForWorker(worker)}
                  </div>
                );
              })
            ) : null}

            {relevantWorkers.length === 0 && !isReviewMode && (
              <div className="text-center py-8 text-slate-400 text-sm">
                Selecione um colaborador na lista à esquerda
              </div>
            )}
          </div>

          <div className="flex justify-between items-center bg-slate-900 p-6 rounded-[2rem] mt-6">
            <div className="hidden md:block">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Diferença Total</p>
              <p className={`text-lg font-black ${draftTotal - originalTotal > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(draftTotal - originalTotal).toFixed(2)} horas
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onBack}
                className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-slate-400 bg-slate-800 hover:text-white rounded-xl transition-all"
              >
                Cancelar
              </button>
              {onConfirm && (
                <button
                  onClick={onConfirm}
                  className="px-10 py-4 font-black text-[10px] uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xl"
                >
                  {isReviewMode ? 'Aplicar e Enviar' : 'Rever Alterações'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrecisionReportReview;