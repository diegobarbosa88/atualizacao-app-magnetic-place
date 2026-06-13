import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, Check, X } from 'lucide-react';

const WorkerEmploymentHistoryModal = ({ show, workerId, workerName, supabase, onClose }) => {
  const [periods, setPeriods] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingDraft, setEditingDraft] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    if (show && workerId && supabase) {
      supabase.from('worker_employment_history').select('*').eq('worker_id', workerId).order('created_at', { ascending: false })
        .then(({ data }) => setPeriods(data || []));
    }
  }, [show, workerId, supabase]);

  const handleSave = async (p) => {
    await supabase.from('worker_employment_history').update({ data_inicio: editingDraft.data_inicio, data_fim: editingDraft.data_fim || null }).eq('id', p.id);
    setEditingId(null);
    const { data } = await supabase.from('worker_employment_history').select('*').eq('worker_id', workerId).order('created_at', { ascending: false });
    setPeriods(data || []);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('worker_employment_history').delete().eq('id', id);
    if (error) { alert('Erro ao apagar: ' + error.message); return; }
    setConfirmDeleteId(null);
    const { data } = await supabase.from('worker_employment_history').select('*').eq('worker_id', workerId).order('created_at', { ascending: false });
    setPeriods(data || []);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-indigo-700">Períodos de Emprego</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
        </div>
        <p className="text-sm font-bold text-slate-500 mb-4">{workerName}</p>
        {periods.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Sem períodos registados</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {periods.map((p) => (
              <div key={p.id}>
                {editingId === p.id ? (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                    <input type="date" value={editingDraft.data_inicio || ''} onChange={e => setEditingDraft(d => ({ ...d, data_inicio: e.target.value }))} className="border border-slate-300 rounded-lg p-1 text-xs font-bold flex-1 min-w-0" />
                    <span className="text-slate-400 text-xs">→</span>
                    <input type="date" value={editingDraft.data_fim || ''} onChange={e => setEditingDraft(d => ({ ...d, data_fim: e.target.value }))} className="border border-slate-300 rounded-lg p-1 text-xs font-bold flex-1 min-w-0" placeholder="Em aberto" />
                    <button onClick={() => handleSave(p)} className="p-1 text-green-600 hover:bg-green-50 rounded-lg"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={14} /></button>
                  </div>
                ) : confirmDeleteId === p.id ? (
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-200">
                    <span className="text-xs font-bold text-red-600">Apagar este período?</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleDelete(p.id)} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg">Sim</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg">Não</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-600">{p.data_inicio}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-sm font-bold text-indigo-600">{p.data_fim || 'Atual'}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingId(p.id); setEditingDraft(p); }} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit2 size={12} /></button>
                      <button onClick={() => setConfirmDeleteId(p.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={12} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkerEmploymentHistoryModal;
