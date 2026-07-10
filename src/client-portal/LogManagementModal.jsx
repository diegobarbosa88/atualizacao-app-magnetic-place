import React, { useState, useMemo } from 'react';
import { X, Plus, Edit2, Trash2, Check, AlertTriangle } from 'lucide-react';
import { createLogByClient, updateLogByClient, deleteLogByClient } from '../utils/clientPortalApi';
import { calculateDuration } from '../utils/formatUtils';
import { roundTimeToIntervalTimeUp, roundTimeToIntervalTimeDown, getIntervalSettings } from '../utils/timeUtils';

const calculateHoursDiff = (entry, exit, breakStart, breakEnd) => {
  if (!entry || !exit || !entry.includes(':') || !exit.includes(':')) return 0;
  const { interval, tolerance } = getIntervalSettings();
  return calculateDuration(
    roundTimeToIntervalTimeUp(entry, interval, tolerance),
    roundTimeToIntervalTimeDown(exit, interval),
    breakStart && breakStart !== '--:--' ? roundTimeToIntervalTimeUp(breakStart, interval, tolerance) : null,
    breakEnd && breakEnd !== '--:--' ? roundTimeToIntervalTimeDown(breakEnd, interval) : null,
  );
};

const EMPTY_FORM = { date: '', startTime: '', endTime: '', breakStart: '', breakEnd: '' };

function TimeInput({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</label>
      <input
        type="time"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="px-2 py-1.5 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-slate-800"
      />
    </div>
  );
}

function AddLogForm({ clientId, clientName, workerId, workerName, selectedMonth, supabase, onDone, onCancel }) {
  const [form, setForm] = useState(() => {
    const today = new Date().toLocaleDateString('en-CA');
    const monthPrefix = selectedMonth || today.substring(0, 7);
    const isCurrentMonth = today.startsWith(monthPrefix);
    return { ...EMPTY_FORM, date: isCurrentMonth ? today : `${monthPrefix}-01` };
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const hours = form.startTime && form.endTime
    ? calculateHoursDiff(form.startTime, form.endTime, form.breakStart, form.breakEnd)
    : null;

  const handleSubmit = async () => {
    if (!form.date || !form.startTime || !form.endTime) {
      setError('Data, entrada e saída são obrigatórias.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createLogByClient(supabase, {
        clientId, clientName,
        workerId, workerName,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        breakStart: form.breakStart || null,
        breakEnd: form.breakEnd || null,
      });
      onDone();
    } catch (err) {
      setError('Erro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Novo Registo</p>
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Data</label>
        <input
          type="date"
          value={form.date}
          onChange={e => set('date', e.target.value)}
          className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-slate-800"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TimeInput label="Entrada" value={form.startTime} onChange={v => set('startTime', v)} />
        <TimeInput label="Saída" value={form.endTime} onChange={v => set('endTime', v)} />
        <TimeInput label="Pausa início" value={form.breakStart} onChange={v => set('breakStart', v)} />
        <TimeInput label="Pausa fim" value={form.breakEnd} onChange={v => set('breakEnd', v)} />
      </div>
      {hours !== null && (
        <p className="text-xs font-bold text-indigo-700 text-right">{hours}h calculadas</p>
      )}
      {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
        >
          <Check size={14} /> {loading ? 'A guardar…' : 'Guardar'}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-500 font-black text-xs rounded-xl hover:bg-slate-50 transition-all">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function EditLogForm({ log, clientId, clientName, workerId, workerName, supabase, onDone, onCancel }) {
  const [form, setForm] = useState({
    startTime: log.startTime || '',
    endTime: log.endTime || '',
    breakStart: log.breakStart || '',
    breakEnd: log.breakEnd || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const hours = form.startTime && form.endTime
    ? calculateHoursDiff(form.startTime, form.endTime, form.breakStart, form.breakEnd)
    : null;

  const handleSubmit = async () => {
    if (!form.startTime || !form.endTime) { setError('Entrada e saída são obrigatórias.'); return; }
    setLoading(true);
    setError('');
    try {
      await updateLogByClient(supabase, {
        clientId, clientName, workerId, workerName,
        logId: log.id, date: log.date,
        startTime: form.startTime, endTime: form.endTime,
        breakStart: form.breakStart || null, breakEnd: form.breakEnd || null,
        existingLog: log,
      });
      onDone();
    } catch (err) {
      setError('Erro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2 space-y-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">A editar registo de {log.date}</p>
      <div className="grid grid-cols-2 gap-2">
        <TimeInput label="Entrada" value={form.startTime} onChange={v => set('startTime', v)} />
        <TimeInput label="Saída" value={form.endTime} onChange={v => set('endTime', v)} />
        <TimeInput label="Pausa início" value={form.breakStart} onChange={v => set('breakStart', v)} />
        <TimeInput label="Pausa fim" value={form.breakEnd} onChange={v => set('breakEnd', v)} />
      </div>
      {hours !== null && <p className="text-xs font-bold text-amber-700 text-right">{hours}h</p>}
      {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={loading}
          className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl transition-all disabled:opacity-50">
          {loading ? 'A guardar…' : 'Guardar'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-white border border-slate-200 text-slate-500 font-black text-xs rounded-xl hover:bg-slate-50">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function LogRow({ log, clientId, clientName, workerId, workerName, supabase, onDone }) {
  const [editMode, setEditMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  const hours = log.hours ?? calculateHoursDiff(log.startTime, log.endTime, log.breakStart, log.breakEnd);
  const dateLabel = () => {
    const d = new Date(log.date + 'T00:00:00');
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', weekday: 'short' });
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteLogByClient(supabase, { clientId, clientName, workerId, workerName, logId: log.id, date: log.date, existingLog: log });
      onDone();
    } catch (err) {
      alert('Erro ao eliminar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const sourceTag = log.source === 'client_portal' ? (
    <span className="text-[8px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded">portal</span>
  ) : log.source === 'gps_auto' ? (
    <span className="text-[8px] font-bold text-emerald-400 bg-emerald-50 px-1.5 py-0.5 rounded">GPS</span>
  ) : log.source === 'manual_admin' ? (
    <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">admin</span>
  ) : null;

  return (
    <div className="border-b border-slate-50 last:border-0">
      <div className="flex items-center justify-between py-2.5 px-3 hover:bg-slate-50 rounded-xl transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-600 w-20 shrink-0">{dateLabel()}</span>
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-700">
            <span>{log.startTime || '–'}</span>
            <span className="text-slate-300">→</span>
            <span>{log.endTime || '…'}</span>
            {log.breakStart && <span className="text-[10px] text-slate-400">(⏸ {log.breakStart}–{log.breakEnd || '…'})</span>}
          </div>
          {sourceTag}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-500">{hours > 0 ? `${hours}h` : '–'}</span>
          {!confirmDelete && !editMode && (
            <>
              <button onClick={() => setEditMode(true)} className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all">
                <Edit2 size={13} />
              </button>
              <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                <Trash2 size={13} />
              </button>
            </>
          )}
          {confirmDelete && (
            <>
              <span className="text-[10px] font-bold text-rose-600">Confirmar?</span>
              <button onClick={handleDelete} disabled={loading} className="px-2 py-1 bg-rose-600 text-white text-[10px] font-black rounded-lg hover:bg-rose-700 disabled:opacity-50">
                {loading ? '…' : 'Sim'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg hover:bg-slate-200">
                Não
              </button>
            </>
          )}
        </div>
      </div>
      {editMode && (
        <div className="px-3 pb-2">
          <EditLogForm
            log={log} clientId={clientId} clientName={clientName}
            workerId={workerId} workerName={workerName} supabase={supabase}
            onDone={() => { setEditMode(false); onDone(); }}
            onCancel={() => setEditMode(false)}
          />
        </div>
      )}
    </div>
  );
}

export default function LogManagementModal({ worker, clientId, clientName, selectedMonth, logs, supabase, onClose, onLogsChanged }) {
  const [showAddForm, setShowAddForm] = useState(false);

  const workerLogs = useMemo(() =>
    logs.filter(l => String(l.workerId) === String(worker.id) && l.date && l.date.substring(0, 7) === selectedMonth)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [logs, worker.id, selectedMonth]
  );

  const totalHours = workerLogs.reduce((acc, l) =>
    acc + (l.hours ?? calculateHoursDiff(l.startTime, l.endTime, l.breakStart, l.breakEnd)), 0
  );

  const monthLabel = selectedMonth
    ? new Date(selectedMonth + '-01').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
    : selectedMonth;

  const handleDone = () => { if (onLogsChanged) onLogsChanged(); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-black text-slate-800 text-base uppercase tracking-tight">{worker.name}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{monthLabel} · {workerLogs.length} registos · {totalHours.toFixed(2)}h total</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Add form */}
          {showAddForm ? (
            <AddLogForm
              clientId={clientId} clientName={clientName}
              workerId={worker.id} workerName={worker.name}
              selectedMonth={selectedMonth} supabase={supabase}
              onDone={() => { setShowAddForm(false); handleDone(); }}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-indigo-200 text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 font-black text-xs uppercase tracking-wider rounded-2xl transition-all"
            >
              <Plus size={15} /> Adicionar Registo
            </button>
          )}

          {/* Logs list */}
          {workerLogs.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle size={20} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-400">Sem registos em {monthLabel}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {workerLogs.map(log => (
                <LogRow
                  key={log.id}
                  log={log}
                  clientId={clientId} clientName={clientName}
                  workerId={worker.id} workerName={worker.name}
                  supabase={supabase}
                  onDone={handleDone}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-wider rounded-2xl transition-all">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
