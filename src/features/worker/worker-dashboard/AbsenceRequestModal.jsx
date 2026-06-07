import React, { useState, useEffect } from 'react';
import { CalendarX, X, Send, ChevronLeft, ChevronRight } from 'lucide-react';

const DEFAULT_REASONS = ['Doença', 'Consulta médica', 'Emergência familiar', 'Férias', 'Assunto pessoal', 'Outro'];

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function AbsenceRequestModal({
  isOpen, onClose,
  daysList, monthLogs,
  currentUser, systemSettings,
  onSubmit,
}) {
  const [selectedDates, setSelectedDates] = useState([]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasons = systemSettings?.absenceConfig?.absence_reasons || DEFAULT_REASONS;

  useEffect(() => {
    if (isOpen) {
      setSelectedDates([]);
      setReason(reasons[0] || '');
      setNotes('');
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleDate = (ds) => {
    setSelectedDates(prev =>
      prev.includes(ds) ? prev.filter(d => d !== ds) : [...prev, ds]
    );
  };

  const handleSubmit = async () => {
    if (selectedDates.length === 0 || !reason) return;
    setSubmitting(true);
    await onSubmit(selectedDates, reason, notes.trim());
    setSubmitting(false);
    onClose();
  };

  const monthLabel = daysList.length > 0
    ? new Date(daysList[0] + 'T00:00:00').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
        style={{ maxHeight: 'min(92dvh, 92vh)' }}>

        {/* Header — fixo */}
        <div className="flex-none flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-orange-50 p-2 rounded-xl text-orange-600">
              <CalendarX size={17} />
            </div>
            <div>
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-sm">Avisar Falta</h2>
              <p className="text-[10px] font-bold text-slate-400 capitalize">{monthLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo scrollável — ocupa espaço disponível */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4 min-h-0">

          {/* Day grid */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Dias em falta <span className="text-slate-400 font-bold normal-case tracking-normal">({selectedDates.length} selecionado{selectedDates.length !== 1 ? 's' : ''})</span>
            </p>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_SHORT.map(d => (
                <div key={d} className="text-center text-[9px] font-black uppercase text-slate-300 pb-1">{d}</div>
              ))}
              {Array.from({ length: new Date(daysList[0] + 'T00:00:00').getDay() }).map((_, i) => (
                <div key={`e${i}`} />
              ))}
              {daysList.map(ds => {
                const d = new Date(ds + 'T00:00:00');
                const hasLog = (monthLogs || []).some(l => l.date === ds);
                const isSelected = selectedDates.includes(ds);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <button
                    key={ds}
                    onClick={() => toggleDate(ds)}
                    className={`aspect-square rounded-xl text-xs font-black transition-all relative flex items-center justify-center
                      ${isSelected
                        ? 'bg-orange-500 text-white shadow-sm'
                        : isWeekend
                          ? 'bg-slate-50 text-slate-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-orange-100 hover:text-orange-700'
                      }`}
                  >
                    {d.getDate()}
                    {hasLog && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-400" />
                    )}
                  </button>
                );
              })}
            </div>
            {selectedDates.length > 0 && (
              <p className="text-[10px] text-orange-600 font-bold mt-2 leading-relaxed">
                {selectedDates.sort().map(ds => new Date(ds + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })).join(', ')}
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Motivo</p>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
            >
              {reasons.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Notas adicionais <span className="font-bold normal-case tracking-normal text-slate-400">(opcional)</span></p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Consulta de rotina de manhã, regresso previsto à tarde."
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all resize-none placeholder:text-slate-300"
            />
          </div>
        </div>

        {/* Footer — fixo, com padding extra para home indicator iOS */}
        <div className="flex-none px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))] space-y-2 border-t border-slate-100">
          <button
            onClick={handleSubmit}
            disabled={selectedDates.length === 0 || !reason || submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={13} />
            {submitting ? 'A enviar...' : `Enviar Aviso${selectedDates.length > 1 ? ` (${selectedDates.length} dias)` : ''}`}
          </button>
          <p className="text-[10px] text-slate-400 font-bold text-center">
            O aviso será enviado imediatamente ao responsável.
          </p>
        </div>
      </div>
    </div>
  );
}
