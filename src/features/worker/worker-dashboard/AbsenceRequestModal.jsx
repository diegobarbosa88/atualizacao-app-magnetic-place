import React, { useState, useEffect } from 'react';
import { CalendarX, Send, CheckCircle, Clock, Eye } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';

const DEFAULT_REASONS = ['Doença', 'Consulta médica', 'Emergência familiar', 'Férias', 'Assunto pessoal', 'Outro'];
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const STATUS_MAP = {
  approved: { label: 'Confirmado', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  seen:     { label: 'Visto',      cls: 'bg-slate-100 text-slate-500',    icon: Eye },
  pending:  { label: 'Aguarda',    cls: 'bg-orange-100 text-orange-600',  icon: Clock },
};

function AbsenceHistoryRow({ r }) {
  const s = STATUS_MAP[r.status] || STATUS_MAP.pending;
  const Icon = s.icon;
  const sortedDates = (r.dates || []).slice().sort();
  return (
    <div className="px-4 py-3 space-y-2 border-b border-slate-50 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-700">{r.reason}</p>
        <span className={`shrink-0 flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${s.cls}`}>
          <Icon size={9} /> {s.label}
        </span>
      </div>
      {sortedDates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sortedDates.map(ds => {
            const d = new Date(ds + 'T00:00:00');
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <span key={ds} className={`inline-flex flex-col items-center px-2.5 py-1.5 rounded-xl text-center leading-none ${isWeekend ? 'bg-slate-100 text-slate-400' : 'bg-orange-100 text-orange-700'}`}>
                <span className="text-[8px] font-black uppercase tracking-wider">{d.toLocaleDateString('pt-PT', { weekday: 'short' })}</span>
                <span className="text-sm font-black">{d.getDate()}</span>
                <span className="text-[8px] font-bold opacity-70">{d.toLocaleDateString('pt-PT', { month: 'short' })}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AbsenceRequestModal({
  isOpen, onClose,
  daysList, monthLogs,
  currentUser, systemSettings,
  absenceRequests,
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

  const myAbsences = (absenceRequests || [])
    .filter(r => r.worker_id === currentUser?.id && r.status !== 'archived')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const footer = (
    <div className="px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))] space-y-2 border-t border-slate-100">
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
  );

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Registar Falta"
      subtitle={monthLabel}
      icon={<CalendarX size={16} />}
      accent="orange"
      footer={footer}
    >
      <div className="px-4 py-4 space-y-4">

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
              const hasAbsence = myAbsences.some(r => (r.dates || []).includes(ds));
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
                  {!isSelected && (hasLog || hasAbsence) && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {hasLog && <span className="w-1 h-1 rounded-full bg-indigo-400" />}
                      {hasAbsence && <span className="w-1 h-1 rounded-full bg-orange-400" />}
                    </span>
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
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
            Notas adicionais <span className="font-bold normal-case tracking-normal text-slate-400">(opcional)</span>
          </p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Consulta de rotina de manhã, regresso previsto à tarde."
            rows={2}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all resize-none placeholder:text-slate-300"
          />
        </div>

        {/* Histórico de avisos */}
        {myAbsences.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Os meus avisos</p>
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
              {myAbsences.map(r => <AbsenceHistoryRow key={r.id} r={r} />)}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
