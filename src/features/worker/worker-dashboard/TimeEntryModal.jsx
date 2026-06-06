import React, { useState, useEffect } from 'react';
import { X, Calendar, Users } from 'lucide-react';
import EntryForm from '../../../components/common/EntryForm';
import RequestEntryCard from '../../../components/worker/RequestEntryCard';

const DAY_NAMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export default function TimeEntryModal({
  isOpen, onClose, initialDate, daysList,
  formData, onFormChange, onSave, onBulkSave,
  clients, assignedClients, currentUser, systemSettings,
  monthLogs, logs, isLimitedWorker, onLimitedSuccess,
}) {
  const [selectedDays, setSelectedDays] = useState([]);
  const [bulkMode, setBulkMode] = useState(false);

  useEffect(() => {
    if (isOpen && initialDate) {
      setSelectedDays([initialDate]);
      setBulkMode(false);
    }
  }, [isOpen, initialDate]);

  if (!isOpen) return null;

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

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="font-black text-slate-800 uppercase tracking-tight text-base">
                Registar Horário
              </h2>
              {bulkMode ? (
                <p className="text-xs text-indigo-500 font-bold">
                  {selectedDays.length} {selectedDays.length === 1 ? 'dia selecionado' : 'dias selecionados'}
                </p>
              ) : (
                <p className="text-xs text-slate-400 font-bold">
                  {dObj.getDate()} de {monthName} · {DAY_NAMES[dObj.getDay()]}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Bulk mode toggle — non-limited workers only */}
        {!isLimitedWorker && (
          <div className="px-6 py-3 border-b border-slate-100 shrink-0">
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
              {bulkMode ? 'Modo Múltiplos Dias Ativo' : 'Registar em Múltiplos Dias'}
            </button>
          </div>
        )}

        {/* Day selector grid — bulk mode */}
        {bulkMode && !isLimitedWorker && (
          <div className="px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Selecionar Dias
              </span>
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
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {isLimitedWorker ? (
            <RequestEntryCard
              currentUser={currentUser}
              logs={logs}
              clients={clients}
              monthLogs={monthLogs}
              initialDate={initialDate}
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
    </div>
  );
}
