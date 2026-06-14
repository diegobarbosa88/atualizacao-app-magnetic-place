import { useState, useMemo } from 'react';
import { PenLine, CheckCircle, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import EntryForm from '../../../components/common/EntryForm';
import { toISODateLocal } from '../../../utils/dateUtils';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function ManualTimeEntryCard({ clients, currentUser, onSave, onQuickRegister, monthLogs, systemSettings }) {
  const today = new Date();
  const todayStr = toISODateLocal(today);

  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [quickSaved, setQuickSaved] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    date: todayStr,
    clientId: currentUser?.defaultClientId || '',
    startTime: '',
    breakStart: '',
    breakEnd: '',
    endTime: '',
    description: '',
  });

  const todayLogs = useMemo(
    () => (monthLogs || []).filter(l => l.date === todayStr),
    [monthLogs, todayStr]
  );

  const dayName = DAY_NAMES[today.getDay()];
  const dateLabel = `${today.getDate()} de ${today.toLocaleDateString('pt-PT', { month: 'long' })} · ${dayName}`;

  const handleToggle = () => {
    setExpanded(e => !e);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData, todayStr);
      setSaved(true);
      setExpanded(false);
      setFormData(prev => ({ ...prev, startTime: '', breakStart: '', breakEnd: '', endTime: '', description: '' }));
      setTimeout(() => setSaved(false), 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickRegister = async (e) => {
    e.stopPropagation();
    const saved = onQuickRegister(todayStr);
    if (saved === false) {
      // sem horário padrão configurado para hoje — abre formulário manual
      setExpanded(true);
    } else {
      setQuickSaved(true);
      setTimeout(() => setQuickSaved(false), 4000);
    }
  };

  const showZap = todayLogs.length === 0;

  return (
    <div className="mb-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={handleToggle}
            className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
          >
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 shrink-0">
              <PenLine size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registar Horário de Hoje</p>
              <p className="text-sm font-bold text-slate-800">{dateLabel}</p>
            </div>
            {todayLogs.length > 0 && (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-black px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wide shrink-0">
                {todayLogs.length} registo{todayLogs.length !== 1 ? 's' : ''}
              </span>
            )}
            {(saved || quickSaved) && !expanded && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold animate-in fade-in shrink-0">
                <CheckCircle size={13} /> Guardado!
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 shrink-0 ml-3">
            {showZap && (
              <button
                onClick={handleQuickRegister}
                title="Registo rápido com horário padrão"
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl border border-amber-100 transition-colors text-[10px] font-black uppercase tracking-wide"
              >
                <Zap size={13} />
                <span className="hidden sm:inline">Rápido</span>
              </button>
            )}
            <button onClick={handleToggle} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
              {expanded
                ? <ChevronUp size={16} className="text-slate-400" />
                : <ChevronDown size={16} className="text-slate-400" />
              }
            </button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-slate-100 px-4 pb-4 pt-3">
            <EntryForm
              data={formData}
              clients={clients}
              assignedClients={currentUser?.assignedClients}
              onChange={setFormData}
              onSave={handleSave}
              onCancel={handleToggle}
              isInline
              systemSettings={systemSettings}
            />
            {saving && (
              <p className="text-xs text-indigo-500 font-bold text-center mt-2 animate-pulse">A guardar…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
