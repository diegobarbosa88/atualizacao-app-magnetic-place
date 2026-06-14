import { useState, useMemo } from 'react';
import { PenLine, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import EntryForm from '../../../components/common/EntryForm';
import { toISODateLocal } from '../../../utils/dateUtils';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function ManualTimeEntryCard({ clients, currentUser, onSave, monthLogs, systemSettings }) {
  const today = new Date();
  const todayStr = toISODateLocal(today);

  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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

  return (
    <div className="mb-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={handleToggle}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <PenLine size={16} />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registar Horário</p>
              <p className="text-sm font-bold text-slate-800">{dateLabel}</p>
            </div>
            {todayLogs.length > 0 && (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-black px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wide">
                {todayLogs.length} registo{todayLogs.length !== 1 ? 's' : ''}
              </span>
            )}
            {saved && !expanded && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold animate-in fade-in">
                <CheckCircle size={13} /> Guardado!
              </span>
            )}
          </div>
          {expanded
            ? <ChevronUp size={16} className="text-slate-400 shrink-0" />
            : <ChevronDown size={16} className="text-slate-400 shrink-0" />
          }
        </button>

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
