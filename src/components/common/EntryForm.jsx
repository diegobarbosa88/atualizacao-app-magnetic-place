import { useState, useMemo } from 'react';
import { Calendar, Coffee, Save, X, Plus, Loader2, Sparkles } from 'lucide-react';
import { callGemini } from '../../utils/aiUtils';
import { useApp } from '../../context/AppContext';

const EntryForm = ({ data, clients, assignedClients, onChange, onSave, onCancel, showDate = false, isEditing = false, title = "Registar Horário", isInline = false, systemSettings: propSystemSettings }) => {
  const { systemSettings: contextSystemSettings } = useApp();
  const systemSettings = propSystemSettings || contextSystemSettings;
  const [isImproving, setIsImproving] = useState(false);
  const [showBreaks, setShowBreaks] = useState(!!(data.breakStart || data.breakEnd));
  const [showComments, setShowComments] = useState(!!data.description);
  const filteredClients = useMemo(() => {
    if (!assignedClients || assignedClients.length === 0) return clients;
    return clients.filter(c => assignedClients.includes(c.id));
  }, [clients, assignedClients]);

  const handleAiPolish = async () => {
    if (!data.description) return;
    setIsImproving(true);
    const res = await callGemini(
      `Melhore esta descrição de tarefa para um relatório de horas profissional. Responda APENAS com a descrição polida. Sem conselhos e sem frases introdutórias (ex: não comece com "A descrição melhorada seria..." ou "às vezes isso acontece..."). Texto original: "${data.description}"`,
      "Você é um redator profissional muito rigoroso.",
      systemSettings?.geminiApiKey
    );
    onChange({ ...data, description: res.trim() });
    setIsImproving(false);
  };

  return (
    <div className={`bg-white ${isInline ? 'rounded-2xl p-4 shadow-lg border-2 border-indigo-100' : 'rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl border border-indigo-50/50'} animate-in fade-in zoom-in-95 duration-300 w-full text-slate-900 my-2`}>
      {!isInline && (
        <div className="flex items-center gap-3 mb-4 sm:mb-6 border-b border-slate-100 pb-3 sm:pb-4">
          <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Calendar size={20} /></div>
          <h3 className="font-black text-lg uppercase tracking-tight text-slate-800">{title}</h3>
        </div>
      )}

      <div className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
          <div className={`${showDate ? 'md:col-span-3' : 'md:col-span-4'} space-y-1`}>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente / Unidade</label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none shadow-sm text-slate-900" value={data.clientId || ''} onChange={(e) => onChange({ ...data, clientId: e.target.value })}>
              <option value="">Selecione o Cliente...</option>
              {filteredClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {showDate && (
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
              <input type="date" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-slate-900" value={data.date || ''} onChange={(e) => onChange({ ...data, date: e.target.value })} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Entrada</label><input type="time" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 text-sm text-slate-900" value={data.startTime || ''} onChange={(e) => onChange({ ...data, startTime: e.target.value })} /></div>

          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Saída</label><input type="time" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 text-sm text-slate-900" value={data.endTime || ''} onChange={(e) => onChange({ ...data, endTime: e.target.value })} /></div>

          {showBreaks ? (
            <>
              <div className="space-y-1"><label className="text-[9px] font-black text-orange-500 uppercase tracking-widest ml-1">Pausa I.</label><input type="time" className="w-full bg-orange-50 border border-orange-100 rounded-xl p-2.5 sm:p-3 text-sm text-slate-900" value={data.breakStart || ''} onChange={(e) => onChange({ ...data, breakStart: e.target.value })} /></div>
              <div className="space-y-1"><label className="text-[9px] font-black text-orange-500 uppercase tracking-widest ml-1">Pausa F.</label><input type="time" className="w-full bg-orange-50 border border-orange-100 rounded-xl p-2.5 sm:p-3 text-sm text-slate-900" value={data.breakEnd || ''} onChange={(e) => onChange({ ...data, breakEnd: e.target.value })} /></div>
            </>
          ) : (
            <div className="col-span-2 md:col-span-2 flex items-end">
              <button type="button" onClick={(e) => { e.preventDefault(); setShowBreaks(true); }} className="w-full text-[10px] font-black uppercase text-orange-500 bg-orange-50 hover:bg-orange-100 border border-orange-100 rounded-xl p-2.5 sm:p-3 transition-colors flex items-center justify-center gap-2 h-[38px] sm:h-[46px]">
                <Coffee size={14} /> Adicionar Pausa
              </button>
            </div>
          )}
        </div>

        {showComments ? (
          <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Comentários</label>
              <button onClick={handleAiPolish} disabled={isImproving || !data.description} className="text-[9px] flex items-center gap-1 font-bold text-indigo-500 hover:text-indigo-700 disabled:opacity-50">
                {isImproving ? <Loader2 className="animate-spin" size={10} /> : <Sparkles size={10} />} Sugestão IA ✨
              </button>
            </div>
            <textarea rows="2" placeholder="Opcional: Preencha notas ou detalhes sobre a tarefa..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 text-sm outline-none resize-none shadow-inner text-slate-900" value={data.description || ''} onChange={(e) => onChange({ ...data, description: e.target.value })} />
          </div>
        ) : (
          <div>
            <button onClick={(e) => { e.preventDefault(); setShowComments(true); }} className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1 bg-slate-50 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-slate-200 border-dashed w-max">
              <Plus size={12} /> Adicionar Comentários
            </button>
          </div>
        )}

        <div className="flex gap-2 sm:gap-3 pt-1 sm:pt-2">
          <button onClick={onSave} className="flex-1 bg-emerald-600 text-white py-2.5 sm:py-3 rounded-xl shadow-lg hover:bg-emerald-700 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95"><Save size={16} /> {isEditing ? 'ATUALIZAR' : 'GRAVAR REGISTO'}</button>
          <button onClick={onCancel} className="bg-slate-100 border border-slate-200 text-slate-400 p-2.5 sm:p-3 rounded-xl hover:text-red-500 transition-all shadow-sm"><X size={18} /></button>
        </div>
      </div>
    </div>
  );
};

export default EntryForm;