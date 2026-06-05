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

export const StepPrecision = ({
  workers,
  logs,
  month,
  onSubmit,
  onBack,
  busy,
  submitLabel,
  showBack = true,
  showJustification = true,
  initialJustification = '',
  initialEntries = {},
}) => {
  const [entries, setEntries] = useState(initialEntries || {}); // { [workerId]: { [date]: Entry } }
  const [justification, setJustification] = useState(initialJustification || '');
  const [activeWorker, setActiveWorker] = useState(null);
  const [addingNewDay, setAddingNewDay] = useState(false);
  const [newDayDraft, setNewDayDraft] = useState({ date: '', startTime: '', endTime: '', breakStart: '', breakEnd: '' });
  const [pausaVisivel, setPausaVisivel] = useState({});

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

  const monthDelta = useMemo(() => {
    let delta = 0;
    workersWithDays.forEach((w) => {
      const dayEntries = entries[w.id] || {};
      Object.entries(dayEntries).forEach(([date, entry]) => {
        const existing = w.logs.find((l) => l.date === date);
        const orig = Number(existing?.hours || 0);
        if (entry.kind === 'new') delta += hoursFor(entry.values);
        else if (entry.kind === 'remove') delta -= orig;
        else if (entry.kind === 'edit') delta += hoursFor(entry.changes) - orig;
      });
    });
    return Number(delta.toFixed(2));
  }, [entries, workersWithDays]);

  const workerTotals = useMemo(() => {
    const result = {};
    workersWithDays.forEach((w) => {
      const orig = w.logs.reduce((acc, l) => acc + Number(l.hours || 0), 0);
      let delta = 0;
      Object.entries(entries[w.id] || {}).forEach(([date, entry]) => {
        const existing = w.logs.find((l) => l.date === date);
        const o = Number(existing?.hours || 0);
        if (entry.kind === 'new') delta += hoursFor(entry.values);
        else if (entry.kind === 'remove') delta -= o;
        else if (entry.kind === 'edit') delta += hoursFor(entry.changes) - o;
      });
      result[w.id] = { orig: Number(orig.toFixed(2)), delta: Number(delta.toFixed(2)), proposed: Number((orig + delta).toFixed(2)) };
    });
    return result;
  }, [entries, workersWithDays]);

  const fmtH = (n) => `${Number(n.toFixed(1))}h`;

  const fmtDelta = (n) => {
    if (!n) return '0h';
    const sign = n > 0 ? '+' : '';
    return `${sign}${Number(n.toFixed(2))}h`;
  };

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
    <div className="animate-fade-in max-w-2xl mx-auto py-4">
      {showBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest mb-4">
          <ChevronLeft size={14} /> Voltar
        </button>
      )}

      {/* Header compacto */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Ajuste de Precisão</h2>
          <p className="text-xs text-slate-400 mt-0.5">Edite ou remova dias de cada colaborador.</p>
        </div>
        {itemsCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl">{itemsCount} alteração(ões)</span>
            <span className={`text-xs font-black px-3 py-1.5 rounded-xl ${monthDelta > 0 ? 'bg-emerald-50 text-emerald-700' : monthDelta < 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>{fmtDelta(monthDelta)}</span>
          </div>
        )}
      </div>

      {/* Worker tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {workersWithDays.map((w) => {
          const wt = workerTotals[w.id] || { orig: 0, delta: 0, proposed: 0 };
          const hasEdits = wt.delta !== 0;
          const isActive = w.id === activeWorker;
          return (
            <button
              key={w.id}
              onClick={() => { setActiveWorker(w.id); setAddingNewDay(false); resetNewDayDraft(); }}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}
            >
              <span>{w.name}</span>
              {hasEdits ? (
                <span className={`text-[9px] flex items-center gap-1 ${isActive ? 'text-white/80' : 'text-amber-700'}`}>
                  <s className="opacity-60">{fmtH(wt.orig)}</s>
                  <span>→</span>
                  <span className={isActive ? 'text-white font-black' : wt.delta > 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{fmtH(wt.proposed)}</span>
                </span>
              ) : (
                <span className={`text-[9px] ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{fmtH(wt.orig)}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Day editor */}
      {!active ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl h-40 flex items-center justify-center text-center p-8">
          <p className="text-slate-400 font-bold text-sm">Selecione um colaborador acima para começar.</p>
        </div>
      ) : (
        <>
        {/* Resumo total trabalhador */}
        {(() => {
          const wt = workerTotals[active.id] || { orig: 0, delta: 0, proposed: 0 };
          return (
            <div className={`flex items-center justify-between px-4 py-3 rounded-2xl mb-2 ${wt.delta !== 0 ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50 border border-slate-100'}`}>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{active.name} — Total do mês</span>
              {wt.delta !== 0 ? (
                <div className="flex items-center gap-2 text-sm font-black">
                  <span className="text-slate-400 line-through">{fmtH(wt.orig)}</span>
                  <span className="text-slate-400">→</span>
                  <span className={wt.delta > 0 ? 'text-emerald-600' : 'text-rose-600'}>{fmtH(wt.proposed)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${wt.delta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{fmtDelta(wt.delta)}</span>
                </div>
              ) : (
                <span className="text-sm font-black text-slate-700">{fmtH(wt.orig)}</span>
              )}
            </div>
          );
        })()}

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50">

          {/* Form para novo dia */}
          {addingNewDay && (
            <div className="p-4 bg-emerald-50/50">
              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-3">Novo dia</p>
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Data</label>
                  <input
                    type="date"
                    min={bounds.min}
                    max={bounds.max}
                    value={newDayDraft.date}
                    onChange={(e) => setNewDayDraft({ ...newDayDraft, date: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono mt-1"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Entrada</label>
                    <TimeTextInput value={newDayDraft.startTime} onChange={(v) => setNewDayDraft({ ...newDayDraft, startTime: v })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono mt-1" />
                  </div>
                  <span className="text-slate-300 pb-2">→</span>
                  <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saída</label>
                    <TimeTextInput value={newDayDraft.endTime} onChange={(v) => setNewDayDraft({ ...newDayDraft, endTime: v })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono mt-1" />
                  </div>
                </div>
                {(newDayDraft.breakStart || newDayDraft.breakEnd || pausaVisivel['_new']) ? (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pausa Início</label>
                      <TimeTextInput value={newDayDraft.breakStart} onChange={(v) => setNewDayDraft({ ...newDayDraft, breakStart: v })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono mt-1" />
                    </div>
                    <span className="text-slate-300 pb-2">→</span>
                    <div className="flex-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pausa Fim</label>
                      <TimeTextInput value={newDayDraft.breakEnd} onChange={(v) => setNewDayDraft({ ...newDayDraft, breakEnd: v })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono mt-1" />
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setPausaVisivel(p => ({ ...p, _new: true }))} className="text-[10px] font-black text-slate-400 hover:text-indigo-600 flex items-center gap-1">
                    <Plus size={11} /> Adicionar pausa
                  </button>
                )}
              </div>
              <div className="flex gap-2 justify-end mt-3">
                <button onClick={() => { setAddingNewDay(false); resetNewDayDraft(); setPausaVisivel(p => { const n = { ...p }; delete n._new; return n; }); }} className="px-3 py-1.5 text-slate-500 text-[10px] font-black uppercase">Cancelar</button>
                <button
                  onClick={() => {
                    if (!newDayDraft.date) return alert('Escolha uma data dentro do mês.');
                    if (!newDayDraft.startTime || !newDayDraft.endTime) return alert('Indique pelo menos entrada e saída.');
                    if (active.logs.some((l) => l.date === newDayDraft.date)) return alert('Já existe um registo nesse dia. Edite o registo existente.');
                    addNewDay(active.id, newDayDraft);
                    setAddingNewDay(false);
                    resetNewDayDraft();
                    setPausaVisivel(p => { const n = { ...p }; delete n._new; return n; });
                  }}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase"
                >
                  Adicionar
                </button>
              </div>
            </div>
          )}

          {/* Dias novos já adicionados */}
          {newDays.map(({ date, values }) => {
            const pk = `${active.id}_n_${date}`;
            const pausaOpen = pausaVisivel[pk] || !!(values.breakStart || values.breakEnd);
            return (
              <div key={`new_${date}`} className="p-4 bg-emerald-50/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">✚ Novo</span>
                    <span className="text-sm font-black text-slate-700 font-mono">{date}</span>
                    <span className="text-[10px] text-emerald-600 font-bold">{hoursFor(values)}h</span>
                  </div>
                  <button onClick={() => revert(active.id, date)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Cancelar"><Trash2 size={14} /></button>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Entrada</label>
                    <TimeTextInput value={values.startTime || ''} onChange={(v) => setEditField(active.id, date, 'startTime', v, null)} className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm font-mono mt-1" />
                  </div>
                  <span className="text-slate-300 pb-2">→</span>
                  <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saída</label>
                    <TimeTextInput value={values.endTime || ''} onChange={(v) => setEditField(active.id, date, 'endTime', v, null)} className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm font-mono mt-1" />
                  </div>
                </div>
                {pausaOpen ? (
                  <div className="flex items-end gap-2 mt-2">
                    <div className="flex-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pausa Início</label>
                      <TimeTextInput value={values.breakStart || ''} onChange={(v) => setEditField(active.id, date, 'breakStart', v, null)} className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm font-mono mt-1" />
                    </div>
                    <span className="text-slate-300 pb-2">→</span>
                    <div className="flex-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pausa Fim</label>
                      <TimeTextInput value={values.breakEnd || ''} onChange={(v) => setEditField(active.id, date, 'breakEnd', v, null)} className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm font-mono mt-1" />
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setPausaVisivel(p => ({ ...p, [pk]: true }))} className="mt-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 flex items-center gap-1">
                    <Plus size={11} /> Adicionar pausa
                  </button>
                )}
              </div>
            );
          })}

          {active.logs.length === 0 && newDays.length === 0 && !addingNewDay && (
            <div className="p-6 text-center text-slate-400 text-sm">Sem registos para este mês. Use "Adicionar Dia" abaixo.</div>
          )}

          {/* Dias existentes */}
          {active.logs.map((l) => {
            const entry = activeEntries[l.date];
            const isRemoved = entry?.kind === 'remove';
            const editVals = entry?.kind === 'edit' ? entry.changes : null;
            const displayVals = editVals || { startTime: l.startTime, endTime: l.endTime, breakStart: l.breakStart, breakEnd: l.breakEnd };
            const newHours = hoursFor(displayVals);
            const origHours = Number(l.hours || 0);
            const pk = `${active.id}_${l.date}`;
            const pausaOpen = pausaVisivel[pk] || !!(displayVals.breakStart || displayVals.breakEnd);
            return (
              <div key={l.id || l.date} className={`p-4 ${isRemoved ? 'bg-rose-50/40' : editVals ? 'bg-amber-50/20' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isRemoved && <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">Removido</span>}
                    {editVals && <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">Editado</span>}
                    <span className={`text-sm font-black font-mono ${isRemoved ? 'text-rose-500 line-through' : 'text-slate-700'}`}>{l.date}</span>
                    {!isRemoved && <span className="text-[10px] font-bold text-slate-400">{editVals ? <><s>{origHours}h</s> → <span className="text-amber-700">{newHours}h</span></> : `${origHours}h`}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {entry && <button onClick={() => revert(active.id, l.date)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg" title="Reverter"><RotateCcw size={14} /></button>}
                    {!isRemoved && <button onClick={() => markRemove(active.id, l.date)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Dia não trabalhado"><Trash2 size={14} /></button>}
                  </div>
                </div>
                {!isRemoved && (
                  <>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Entrada</label>
                        <TimeTextInput value={displayVals.startTime || ''} onChange={(v) => setEditField(active.id, l.date, 'startTime', v, l)} className={`w-full border rounded-xl px-3 py-2 text-sm font-mono mt-1 ${editVals ? 'border-amber-300' : 'border-slate-200'}`} />
                      </div>
                      <span className="text-slate-300 pb-2">→</span>
                      <div className="flex-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saída</label>
                        <TimeTextInput value={displayVals.endTime || ''} onChange={(v) => setEditField(active.id, l.date, 'endTime', v, l)} className={`w-full border rounded-xl px-3 py-2 text-sm font-mono mt-1 ${editVals ? 'border-amber-300' : 'border-slate-200'}`} />
                      </div>
                    </div>
                    {pausaOpen ? (
                      <div className="flex items-end gap-2 mt-2">
                        <div className="flex-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pausa Início</label>
                          <TimeTextInput value={displayVals.breakStart || ''} onChange={(v) => setEditField(active.id, l.date, 'breakStart', v, l)} className={`w-full border rounded-xl px-3 py-2 text-sm font-mono mt-1 ${editVals ? 'border-amber-300' : 'border-slate-200'}`} />
                        </div>
                        <span className="text-slate-300 pb-2">→</span>
                        <div className="flex-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pausa Fim</label>
                          <TimeTextInput value={displayVals.breakEnd || ''} onChange={(v) => setEditField(active.id, l.date, 'breakEnd', v, l)} className={`w-full border rounded-xl px-3 py-2 text-sm font-mono mt-1 ${editVals ? 'border-amber-300' : 'border-slate-200'}`} />
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setPausaVisivel(p => ({ ...p, [pk]: true }))} className="mt-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 flex items-center gap-1">
                        <Plus size={11} /> Adicionar pausa
                      </button>
                    )}
                  </>
                )}
                {isRemoved && (
                  <p className="text-[10px] font-bold text-rose-600">Era: {l.startTime || '—'} → {l.endTime || '—'} ({origHours}h)</p>
                )}
              </div>
            );
          })}

          {/* Botão adicionar dia */}
          {!addingNewDay && (
            <button
              onClick={() => setAddingNewDay(true)}
              className="w-full p-3 flex items-center justify-center gap-2 text-emerald-600 hover:bg-emerald-50 transition-all text-[10px] font-black uppercase tracking-widest"
            >
              <Plus size={14} /> Adicionar Dia
            </button>
          )}
        </div>
      </>
      )}

      {/* Nota + submit */}
      <div className="mt-4 bg-white rounded-2xl border border-slate-100 p-4">
        {showJustification && (
          <>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nota (opcional)</label>
            <textarea
              rows="2"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full border-2 border-slate-100 rounded-xl p-3 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              placeholder="Contexto adicional para o admin..."
            />
          </>
        )}
        <button
          disabled={busy || itemsCount === 0}
          onClick={() => onSubmit({ justification, items: buildItems() })}
          className={`${showJustification ? 'mt-3' : ''} w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-sm disabled:opacity-50`}
        >
          {busy ? 'A processar...' : (submitLabel || `Enviar ${itemsCount} alteração(ões) ao Admin`)}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

const ClientReportFlow = ({ clientId, month, workers, logs, onClose, initialStep }) => {
  const { supabase, corrections, correctionItems, companySignature, clients } = useApp();
  const [step, setStep] = useState(initialStep || 'home'); // home | mode | quick | precision | success
  const [busy, setBusy] = useState(false);
  const clientObj = clients?.find((c) => String(c.id) === String(clientId));

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
        adminEmail: companySignature?.responsibleEmail,
        clientName: clientObj?.name,
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

  if (step === 'mode') return (
    <div className="max-w-2xl mx-auto py-6 animate-fade-in">
      <button onClick={() => initialStep === 'mode' ? onClose?.() : setStep('home')} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest mb-6">
        <ChevronLeft size={14} /> Voltar
      </button>
      <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Tipo de reporte</h2>
      <p className="text-slate-500 text-sm font-medium mb-8">Escolha como quer reportar a divergência deste mês.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => setStep('quick')}
          className="text-left p-6 bg-white border-2 border-indigo-200 hover:border-indigo-400 rounded-2xl transition-all group"
        >
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <MessageCircle size={24} />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-2">Mensagem Rápida</h3>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">Descreva o problema em texto livre. Ideal para quando não sabe os detalhes exatos dos horários.</p>
          <div className="mt-4 flex items-center gap-1 text-indigo-600 font-black text-[10px] uppercase tracking-widest">
            Escolher este <ChevronDown size={12} className="-rotate-90" />
          </div>
        </button>
        <button
          onClick={() => setStep('precision')}
          className="text-left p-6 bg-white border-2 border-amber-200 hover:border-amber-400 rounded-2xl transition-all group"
        >
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-600 group-hover:text-white transition-colors">
            <Sparkles size={24} />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-2">Ajuste de Precisão</h3>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">Edite os horários diretamente no relatório. Ideal para correções específicas de horas e pausas.</p>
          <div className="mt-4 flex items-center gap-1 text-amber-600 font-black text-[10px] uppercase tracking-widest">
            Escolher este <ChevronDown size={12} className="-rotate-90" />
          </div>
        </button>
      </div>
    </div>
  );

  if (step === 'quick') return <StepQuick onBack={() => setStep('mode')} busy={busy} onSubmit={(p) => handleSubmit(p, 'quick')} />;
  if (step === 'precision') return <StepPrecision workers={workers} logs={logs} month={month} onBack={() => setStep('mode')} busy={busy} onSubmit={(p) => handleSubmit(p, 'precision')} />;

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
