import React, { useState, useEffect } from 'react';
import { Calendar, Users, Zap } from 'lucide-react';
import EntryForm from '../../../components/common/EntryForm';
import RequestEntryCard from '../../../components/worker/RequestEntryCard';
import ModalShell from '../../../components/common/ModalShell';

const DAY_NAMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export default function TimeEntryModal({
  isOpen, onClose, initialDate, initialLogId, daysList,
  formData, onFormChange, onSave, onBulkSave,
  clients, assignedClients, currentUser, systemSettings,
  monthLogs, logs, isLimitedWorker, onLimitedSuccess,
  onQuickRegister,
}) {
  const [selectedDays, setSelectedDays] = useState([]);
  const [bulkMode, setBulkMode] = useState(false);

  useEffect(() => {
    if (isOpen && initialDate) {
      setSelectedDays([initialDate]);
      setBulkMode(false);
    }
  }, [isOpen, initialDate]);

  const toggleDay = (day) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    if (bulkMode && selectedDays.length > 0) {
      await onBulkSave(formData, selectedDays);
    } else {
      await onSave(formData, initialDate);
    }
    onClose();
  };

  const dObj = initialDate ? new Date(initialDate + 'T00:00:00') : new Date();
  const monthName = dObj.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

  const subtitle = bulkMode
    ? `${selectedDays.length} ${selectedDays.length === 1 ? 'dia selecionado' : 'dias selecionados'}`
    : `${dObj.getDate()} de ${monthName} · ${DAY_NAMES[dObj.getDay()]}`;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Registar Ponto"
      subtitle={subtitle}
      icon={<Calendar size={16} />}
      accent="indigo"
    >
      <div onClick={e => e.stopPropagation()}>
        {/* Toolbar — non-limited workers only */}
        {!isLimitedWorker && (
          <div className="px-5 py-3 border-b border-slate-100 shrink-0 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setBulkMode(v => !v);
                setSelectedDays([initialDate]);
              }}
              className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${
                bulkMode
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
              }`}
            >
              <Users size={14} />
              {bulkMode ? 'Modo Múltiplos Dias Ativo' : 'Múltiplos Dias'}
            </button>

            {!bulkMode && onQuickRegister && (
              <button
                onClick={() => {
                  const saved = onQuickRegister(initialDate);
                  if (saved !== false) onClose();
                }}
                className="flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100 transition-all"
              >
                <Zap size={14} />
                Registo Rápido
              </button>
            )}
          </div>
        )}

        {/* Day selector grid — bulk mode */}
        {bulkMode && !isLimitedWorker && (
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecionar Dias</span>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedDays([...daysList])}
                  className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wide"
                >
                  Todos
                </button>
                <button
                  onClick={() => setSelectedDays([])}
                  className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-wide"
                >
                  Limpar
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {(daysList || []).map(day => {
                const d = new Date(day + 'T00:00:00');
                const isSelected = selectedDays.includes(day);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const hasLogs = (monthLogs || []).some(l => l.date === day);
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`flex flex-col items-center py-1.5 rounded-xl text-center transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : isWeekend
                        ? 'bg-slate-50 text-slate-300 hover:bg-indigo-50 hover:text-indigo-400'
                        : 'bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
                    }`}
                  >
                    <span className="text-[8px] font-bold">{DAY_NAMES[d.getDay()]}</span>
                    <span className="text-sm font-black leading-tight">{d.getDate()}</span>
                    {hasLogs && (
                      <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-indigo-200' : 'bg-indigo-400'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Form */}
        <div className="px-3 py-3 sm:px-5 sm:py-4">
          {isLimitedWorker ? (
            <RequestEntryCard
              currentUser={currentUser}
              logs={logs}
              clients={clients}
              monthLogs={monthLogs}
              initialDate={initialDate}
              initialLogId={initialLogId}
              isInline={true}
              onSuccess={onLimitedSuccess}
            />
          ) : (
            <EntryForm
              isInline
              data={formData}
              clients={clients}
              assignedClients={assignedClients}
              onChange={onFormChange}
              onSave={handleSave}
              onCancel={onClose}
              systemSettings={systemSettings}
            />
          )}
        </div>
      </div>
    </ModalShell>
  );
}
