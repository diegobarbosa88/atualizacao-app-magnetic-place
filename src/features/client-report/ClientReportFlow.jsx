import React, { useMemo, useState } from 'react';
import { MessageCircle, Sparkles, ChevronLeft, CheckCircle, Clock, AlertCircle, ChevronDown, Plus, Trash2, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { submitCorrection } from '../../utils/correctionsApi';
import { calculateDuration } from '../../utils/formatUtils';
import TimeTextInput from '../../components/common/TimeTextInput';

const STATUS = {
  submitted: { label: 'Submetido', cls: 'bg-amber-100 text-amber-700' },
  under_review: { label: 'Em revisão', cls: 'bg-indigo-100 text-indigo-700' },
  applied: { label: 'Aplicado', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejeitado', cls: 'bg-rose-100 text-rose-700' },
};

const fmtTime = (t) => (t && t !== '--:--' ? t : '');

const MonthStatusBadge = ({ corrections }) => {
  if (!corrections || corrections.length === 0) {
    return <span className="text-[10px] font-black px-3 py-1 rounded-md bg-slate-100 text-slate-500">Sem reportes</span>;
  }
  const open = corrections.find((c) => c.status === 'submitted' || c.status === 'under_review');
  if (open) return <span className={`text-[10px] font-black px-3 py-1 rounded-md ${STATUS[open.status].cls}`}>{STATUS[open.status].label}</span>;
  const last = corrections[0];
  return <span className={`text-[10px] font-black px-3 py-1 rounded-md ${STATUS[last.status]?.cls || ''}`}>{STATUS[last.status]?.label}</span>;
};

const HistoryItem = ({ correction, items }) => {
  const [open, setOpen] = useState(false);
  const myItems = items.filter((i) => i.correction_id === correction.id);
  return (
    <div className="border border-slate-100 rounded-2xl bg-white">
      <button onClick={() => setOpen(!open)} className="w-full p-4 flex items-center gap-3 text-left">
        <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center">
          <Clock size={18} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800 text-sm">{correction.month}</span>
            <span className="text-[10px] font-mono text-slate-400">{correction.type}</span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${STATUS[correction.status]?.cls}`}>{STATUS[correction.status]?.label}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{myItems.length} alteração(ões) • submetido {correction.submitted_at?.slice(0, 10)}</p>
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {correction.justification && (
            <p className="text-xs text-slate-600 italic border-l-2 border-slate-200 pl-2">"{correction.justification}"</p>
          )}
          {myItems.map((it) => (
            <div key={it.id} className="text-xs flex items-center justify-between border-t border-slate-50 pt-2">
              <span className="font-bold text-slate-700">{it.worker_name} • {it.date}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${STATUS[correction.status]?.cls}`}>{it.item_status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step components

const StepMode = ({ onPick, onCancel }) => (
  <div className="animate-fade-in max-w-4xl mx-auto py-6">
    <div className="text-center mb-10">
      <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-2">Como deseja reportar?</h2>
      <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em]">Escolha o método mais simples</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <button onClick={() => onPick('quick')} className="group bg-white p-8 rounded-3xl border-2 border-slate-100 hover:border-indigo-600 transition-all text-left">
        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-5"><MessageCircle size={26} /></div>
        <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Mensagem Rápida</h3>
        <p className="text-slate-500 text-sm font-medium">Explique a divergência por texto. O administrador analisa e responde.</p>
      </button>
      <button onClick={() => onPick('precision')} className="group bg-white p-8 rounded-3xl border-2 border-slate-100 hover:border-amber-500 transition-all text-left">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-5"><Sparkles size={26} /></div>
        <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Ajuste de Precisão</h3>
        <p className="text-slate-500 text-sm font-medium">Indique exatamente que dias e horas devem mudar, colaborador a colaborador.</p>
      </button>
    </div>
    <div className="mt-10 text-center">
      <button onClick={onCancel} className="text-slate-400 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest">Voltar</button>
    </div>
  </div>
);

const StepQuick = ({ onSubmit, onBack, busy }) => {
  const [text, setText] = useState('');
  return (
    <div className="animate-fade-in max-w-2xl mx-auto py-6">
      <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest mb-6">
          <ChevronLeft size={14} /> Mudar método
        </button>
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Descreva a divergência</h2>
        <p className="text-sm text-slate-500 mb-6">Seja específico: dia, colaborador, hora. O administrador vai analisar.</p>
        <textarea
          rows="8"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex: O João não esteve presente no dia 15 de manhã..."
          className="w-full border-2 border-slate-100 rounded-2xl p-5 bg-slate-50 text-slate-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
        />
        <button
          onClick={() => {
            if (!text.trim()) return alert('Descreva o problema.');
            onSubmit({ justification: text, items: [] });
          }}
          disabled={busy}
          className="w-full mt-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm disabled:opacity-50"
        >
          {busy ? 'A enviar...' : 'Enviar ao Administrador'}
        </button>
      </div>
    </div>
  );
};

// Entry shape per worker/date:
//   { kind: 'edit',   changes: { startTime, endTime, breakStart, breakEnd } }   (for existing logs)
//   { kind: 'remove' }                                                          (marks existing day for removal)
//   { kind: 'new',    values:  { startTime, endTime, breakStart, breakEnd } }   (brand new day)

const monthBounds = (month) => {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { min: `${month}-01`, max: `${month}-${String(last).padStart(2, '0')}` };
};

const hoursFor = (shape) => {
  if (!shape) return 0;
  return calculateDuration(shape.startTime, shape.endTime, shape.breakStart, shape.breakEnd) || 0;
};

const StepPrecision = ({ workers, logs, month, onSubmit, onBack, busy }) => {
  const [entries, setEntries] = useState({}); // { [workerId]: { [date]: Entry } }
  const [justification, setJustification] = useState('');
  const [activeWorker, setActiveWorker] = useState(null);
  const [addingNewDay, setAddingNewDay] = useState(false);
  const [newDayDraft, setNewDayDraft] = useState({ date: '', startTime: '', endTime: '', breakStart: '', breakEnd: '' });

  const bounds = useMemo(() => monthBounds(month), [month]);

  const workersWithDays = useMemo(() => {
    return workers.map((w) => {
      const wLogs = logs
        .filter((l) => String(l.workerId) === String(w.id) && (l.date || '').startsWith(month))
        .sort((a, b) => a.date.localeCompare(b.date));
      return { ...w, logs: wLogs };
    });
  }, [workers, logs, month]);

  const setEntry = (workerId, date, entry) => {
    setEntries((prev) => {
      const w = { ...(prev[workerId] || {}) };
      if (entry === null) delete w[date];
      else w[date] = entry;
      return { ...prev, [workerId]: w };
    });
  };

  const setEditField = (workerId, date, key, value, existingLog) => {
    setEntries((prev) => {
      const w = { ...(prev[workerId] || {}) };
      const current = w[date];
      if (current?.kind === 'remove') return prev; // ignore edits while removed
      if (current?.kind === 'new') {
        w[date] = { kind: 'new', values: { ...current.values, [key]: value } };
      } else {
        // existing log path → "edit"
        const baseline = {
          startTime: existingLog?.startTime || '',
          endTime: existingLog?.endTime || '',
          breakStart: existingLog?.breakStart || '',
          breakEnd: existingLog?.breakEnd || '',
        };
        const changes = { ...baseline, ...(current?.changes || {}), [key]: value };
        // If matches baseline entirely, drop the entry
        const equalsBaseline =
          changes.startTime === baseline.startTime &&
          changes.endTime === baseline.endTime &&
          changes.breakStart === baseline.breakStart &&
          changes.breakEnd === baseline.breakEnd;
        if (equalsBaseline) delete w[date];
        else w[date] = { kind: 'edit', changes };
      }
      return { ...prev, [workerId]: w };
    });
  };

  const markRemove = (workerId, date) => setEntry(workerId, date, { kind: 'remove' });
  const revert = (workerId, date) => setEntry(workerId, date, null);
  const addNewDay = (workerId, draft) => setEntry(workerId, draft.date, { kind: 'new', values: { startTime: draft.startTime, endTime: draft.endTime, breakStart: draft.breakStart, breakEnd: draft.breakEnd } });

  const itemsCount = useMemo(() => {
    let n = 0;
    Object.values(entries).forEach((days) => { n += Object.keys(days).length; });
    return n;
  }, [entries]);

  const buildItems = () => {
    const out = [];
    workersWithDays.forEach((w) => {
      const dayEntries = entries[w.id] || {};
      Object.entries(dayEntries).forEach(([date, entry]) => {
        const existing = w.logs.find((l) => l.date === date);
        if (entry.kind === 'new') {
          out.push({
            workerId: w.id,
            workerName: w.name,
            date,
            before: null,
            proposed: { ...entry.values, hours: hoursFor(entry.values) },
          });
        } else if (entry.kind === 'remove') {
          out.push({
            workerId: w.id,
            workerName: w.name,
            date,
            before: existing ? {
              startTime: existing.startTime, endTime: existing.endTime,
              breakStart: existing.breakStart, breakEnd: existing.breakEnd, hours: existing.hours,
            } : null,
            proposed: { startTime: null, endTime: null, breakStart: null, breakEnd: null, hours: 0 },
          });
        } else if (entry.kind === 'edit') {
          out.push({
            workerId: w.id,
            workerName: w.name,
            date,
            before: existing ? {
              startTime: existing.startTime, endTime: existing.endTime,
              breakStart: existing.breakStart, breakEnd: existing.breakEnd, hours: existing.hours,
            } : null,
            proposed: { ...entry.changes, hours: hoursFor(entry.changes) },
          });
        }
      });
    });
    return out;
  };

  const active = workersWithDays.find((w) => w.id === activeWorker);
  const activeEntries = (active && entries[active.id]) || {};
  const newDays = Object.entries(activeEntries)
    .filter(([, e]) => e.kind === 'new')
    .map(([date, e]) => ({ date, values: e.values }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const resetNewDayDraft = () => setNewDayDraft({ date: '', startTime: '', endTime: '', breakStart: '', breakEnd: '' });

  return (
    <div className="animate-fade-in max-w-5xl mx-auto py-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest mb-4">
        <ChevronLeft size={14} /> Mudar método
      </button>

      <header className="bg-white rounded-3xl border border-slate-100 p-6 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Ajuste de Precisão</h2>
          <p className="text-sm text-slate-500">Edite, remova ou adicione dias. Cada alteração é submetida individualmente ao admin.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alterações pendentes</p>
          <p className="text-3xl font-black text-amber-500">{itemsCount}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-2 lg:max-h-[65vh] overflow-y-auto pr-1">
          {workersWithDays.map((w) => {
            const editedDays = Object.keys(entries[w.id] || {}).length;
            const isActive = w.id === activeWorker;
            return (
              <button
                key={w.id}
                onClick={() => { setActiveWorker(w.id); setAddingNewDay(false); resetNewDayDraft(); }}
                className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${isActive ? 'border-indigo-600 bg-white shadow-md' : 'border-slate-100 bg-white hover:border-slate-300'}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-black text-slate-800 text-sm">{w.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{w.role || ''}</p>
                  </div>
                  {editedDays > 0 && <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-md">{editedDays} dia(s)</span>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-2">
          {!active ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl h-[400px] flex items-center justify-center text-center p-8">
              <p className="text-slate-400 font-bold text-sm">Selecione um colaborador à esquerda para começar.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-3">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h3 className="font-black text-slate-800 text-lg">{active.name}</h3>
                <button
                  onClick={() => setAddingNewDay(true)}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                >
                  <Plus size={14} /> Adicionar Dia
                </button>
              </div>

              {addingNewDay && (
                <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/40 rounded-2xl p-4 space-y-3">
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Novo dia (não registado)</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="md:col-span-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Data</label>
                      <input
                        type="date"
                        min={bounds.min}
                        max={bounds.max}
                        value={newDayDraft.date}
                        onChange={(e) => setNewDayDraft({ ...newDayDraft, date: e.target.value })}
                        className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm font-mono"
                      />
                    </div>
                    {[
                      ['startTime', 'Entrada'],
                      ['endTime', 'Saída'],
                      ['breakStart', 'Pausa Início'],
                      ['breakEnd', 'Pausa Fim'],
                    ].map(([k, label]) => (
                      <div key={k}>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                        <TimeTextInput
                          value={newDayDraft[k]}
                          onChange={(v) => setNewDayDraft({ ...newDayDraft, [k]: v })}
                          className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm font-mono"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setAddingNewDay(false); resetNewDayDraft(); }} className="px-3 py-1.5 text-slate-500 text-[10px] font-black uppercase tracking-widest">Cancelar</button>
                    <button
                      onClick={() => {
                        if (!newDayDraft.date) return alert('Escolha uma data dentro do mês.');
                        if (!newDayDraft.startTime || !newDayDraft.endTime) return alert('Indique pelo menos entrada e saída.');
                        if (active.logs.some((l) => l.date === newDayDraft.date)) return alert('Já existe um registo nesse dia. Edite o registo existente.');
                        addNewDay(active.id, newDayDraft);
                        setAddingNewDay(false);
                        resetNewDayDraft();
                      }}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              )}

              {/* New days already added */}
              {newDays.map(({ date, values }) => (
                <div key={`new_${date}`} className="border border-emerald-200 bg-emerald-50/30 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">✚ Novo dia</span>
                      <p className="text-xs font-black text-slate-700 font-mono">{date}</p>
                    </div>
                    <button onClick={() => revert(active.id, date)} className="text-[10px] font-black text-slate-400 hover:text-rose-600 flex items-center gap-1"><Trash2 size={12} /> Cancelar</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      ['startTime', 'Entrada'],
                      ['endTime', 'Saída'],
                      ['breakStart', 'Pausa Início'],
                      ['breakEnd', 'Pausa Fim'],
                    ].map(([k, label]) => (
                      <div key={k}>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                        <TimeTextInput
                          value={values[k] || ''}
                          onChange={(v) => setEditField(active.id, date, k, v, null)}
                          className="w-full border border-emerald-200 rounded-md px-2 py-1 text-sm font-mono"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] font-black text-emerald-700 mt-2">Novo: {hoursFor(values)}h</p>
                </div>
              ))}

              {active.logs.length === 0 && newDays.length === 0 && !addingNewDay && (
                <p className="text-slate-400 text-sm">Sem registos para este mês. Use "Adicionar Dia" para criar um.</p>
              )}

              {/* Existing logs */}
              {active.logs.map((l) => {
                const entry = activeEntries[l.date];
                const isRemoved = entry?.kind === 'remove';
                const editVals = entry?.kind === 'edit' ? entry.changes : null;
                const displayVals = editVals || { startTime: l.startTime, endTime: l.endTime, breakStart: l.breakStart, breakEnd: l.breakEnd };
                const newHours = hoursFor(displayVals);
                const origHours = Number(l.hours || 0);
                return (
                  <div
                    key={l.id || l.date}
                    className={`border rounded-xl p-3 ${isRemoved ? 'border-rose-200 bg-rose-50/40' : editVals ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'}`}
                  >
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {isRemoved && <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">✖ Remover</span>}
                        {editVals && <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">✎ Editado</span>}
                        <p className={`text-xs font-black font-mono ${isRemoved ? 'text-rose-600 line-through' : 'text-slate-700'}`}>{l.date}</p>
                      </div>
                      <div className="flex gap-2">
                        {!isRemoved && (
                          <button onClick={() => markRemove(active.id, l.date)} className="text-[10px] font-black text-rose-600 hover:text-rose-800 flex items-center gap-1"><Trash2 size={12} /> Marcar como não trabalhado</button>
                        )}
                        {entry && (
                          <button onClick={() => revert(active.id, l.date)} className="text-[10px] font-black text-slate-500 hover:text-slate-800 flex items-center gap-1"><RotateCcw size={12} /> Reverter</button>
                        )}
                      </div>
                    </div>

                    {!isRemoved && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                          ['startTime', 'Entrada'],
                          ['endTime', 'Saída'],
                          ['breakStart', 'Pausa Início'],
                          ['breakEnd', 'Pausa Fim'],
                        ].map(([k, label]) => (
                          <div key={k}>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                            <TimeTextInput
                              value={displayVals[k] || ''}
                              onChange={(v) => setEditField(active.id, l.date, k, v, l)}
                              className={`w-full border rounded-md px-2 py-1 text-sm font-mono ${editVals ? 'border-amber-300' : 'border-slate-200'}`}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {editVals && (
                      <div className="mt-2 text-[10px] font-bold flex flex-wrap gap-x-3 gap-y-1">
                        <span className="text-slate-400">Era: <span className="font-mono text-slate-600">{l.startTime || '—'} → {l.endTime || '—'}</span> ({origHours}h)</span>
                        <span className="text-amber-700">Novo: <span className="font-mono">{displayVals.startTime || '—'} → {displayVals.endTime || '—'}</span> ({newHours}h)</span>
                      </div>
                    )}
                    {isRemoved && (
                      <p className="text-[10px] font-bold text-rose-700">Era: <span className="font-mono">{l.startTime || '—'} → {l.endTime || '—'}</span> ({origHours}h) • será marcado como não trabalhado.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-white rounded-3xl border border-slate-100 p-6">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Justificação (opcional)</label>
        <textarea
          rows="3"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          className="w-full border-2 border-slate-100 rounded-2xl p-4 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          placeholder="Contexto adicional para o admin..."
        />
        <button
          disabled={busy || itemsCount === 0}
          onClick={() => onSubmit({ justification, items: buildItems() })}
          className="mt-4 w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm disabled:opacity-50"
        >
          {busy ? 'A enviar...' : `Enviar ${itemsCount} alteração(ões) ao Admin`}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

const ClientReportFlow = ({ clientId, month, workers, logs, onClose }) => {
  const { supabase, corrections, correctionItems } = useApp();
  const [step, setStep] = useState('home'); // home | mode | quick | precision | success
  const [busy, setBusy] = useState(false);

  const myCorrections = useMemo(
    () => (corrections || [])
      .filter((c) => String(c.client_id) === String(clientId))
      .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || '')),
    [corrections, clientId]
  );
  const thisMonthCorrections = myCorrections.filter((c) => c.month === month);
  const hasOpen = thisMonthCorrections.some((c) => c.status === 'submitted' || c.status === 'under_review');

  const handleSubmit = async ({ justification, items }, type) => {
    setBusy(true);
    try {
      await submitCorrection(supabase, {
        clientId,
        month,
        type,
        justification,
        items,
      });
      setStep('success');
    } catch (e) {
      alert('Erro ao submeter: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="max-w-xl mx-auto py-16 text-center animate-fade-in">
        <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} />
        </div>
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-2">Pedido enviado</h2>
        <p className="text-slate-500 text-sm font-medium mb-8">O administrador foi notificado e vai analisar a sua correção.</p>
        <button onClick={() => { setStep('home'); onClose?.(); }} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">Voltar ao Portal</button>
      </div>
    );
  }

  if (step === 'quick') return <StepQuick onBack={() => setStep('mode')} busy={busy} onSubmit={(p) => handleSubmit(p, 'quick')} />;
  if (step === 'precision') return <StepPrecision workers={workers} logs={logs} month={month} onBack={() => setStep('mode')} busy={busy} onSubmit={(p) => handleSubmit(p, 'precision')} />;
  if (step === 'mode') return <StepMode onPick={(m) => setStep(m)} onCancel={() => setStep('home')} />;

  // home: status + history + CTA
  return (
    <div className="max-w-3xl mx-auto py-6 animate-fade-in">
      <header className="bg-white rounded-3xl border border-slate-100 p-6 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Folha do mês {month}</h2>
          <div className="mt-2"><MonthStatusBadge corrections={thisMonthCorrections} /></div>
        </div>
        <button
          onClick={() => setStep('mode')}
          disabled={hasOpen}
          title={hasOpen ? 'Já existe uma correção em aberto para este mês' : ''}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <AlertCircle size={14} /> Reportar Divergência
        </button>
      </header>

      <section>
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Histórico</h3>
        <div className="space-y-2">
          {myCorrections.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 text-sm text-slate-400 text-center">Ainda sem reportes submetidos.</div>
          )}
          {myCorrections.map((c) => (
            <HistoryItem key={c.id} correction={c} items={correctionItems || []} />
          ))}
        </div>
      </section>

      {onClose && (
        <div className="mt-8 text-center">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest">Voltar ao Portal</button>
        </div>
      )}
    </div>
  );
};

export default ClientReportFlow;
