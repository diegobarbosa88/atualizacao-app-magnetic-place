import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, Check, X } from 'lucide-react';

const WorkerValorHoraHistoryModal = ({ show, workerId, workerName, supabase, onClose }) => {
  const [history, setHistory] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingDraft, setEditingDraft] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    if (show && workerId && supabase) {
      supabase.from('worker_valorhora_history').select('*').eq('worker_id', workerId).order('data_alteracao', { ascending: false })
        .then(({ data }) => setHistory(data || []));
    }
  }, [show, workerId, supabase]);

  const handleSave = async (h) => {
    await supabase.from('worker_valorhora_history').update({ valor_anterior: editingDraft.valor_anterior, valor_novo: editingDraft.valor_novo, data_alteracao: editingDraft.data_alteracao }).eq('id', h.id);
    setEditingId(null);
    const { data } = await supabase.from('worker_valorhora_history').select('*').eq('worker_id', workerId).order('data_alteracao', { ascending: false });
    setHistory(data || []);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('worker_valorhora_history').delete().eq('id', id).select();
    if (error) { alert('Erro ao apagar: ' + error.message); return; }
    setConfirmDeleteId(null);
    const { data } = await supabase.from('worker_valorhora_history').select('*').eq('worker_id', workerId).order('data_alteracao', { ascending: false });
    setHistory(data || []);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-indigo-700">Histórico de Valor Hora</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
        </div>
        <p className="text-sm font-bold text-slate-500 mb-4">{workerName}</p>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Sem histórico disponível</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {history.map(h => (
              <div key={h.id}>
                {editingId === h.id ? (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                    <input type="number" step="0.01" value={editingDraft.valor_anterior || ''} onChange={e => setEditingDraft(d => ({ ...d, valor_anterior: e.target.value }))} className="w-16 border border-slate-300 rounded-lg p-1 text-xs font-bold" placeholder="Ant." />
                    <span className="text-slate-400 text-xs">→</span>
                    <input type="number" step="0.01" value={editingDraft.valor_novo || ''} onChange={e => setEditingDraft(d => ({ ...d, valor_novo: e.target.value }))} className="w-16 border border-slate-300 rounded-lg p-1 text-xs font-bold" placeholder="Novo" />
                    <input type="date" value={editingDraft.data_alteracao ? editingDraft.data_alteracao.split('T')[0] : ''} onChange={e => setEditingDraft(d => ({ ...d, data_alteracao: e.target.value }))} className="border border-slate-300 rounded-lg p-1 text-xs font-bold flex-1 min-w-0" />
                    <button onClick={() => handleSave(h)} className="p-1 text-green-600 hover:bg-green-50 rounded-lg"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={14} /></button>
                  </div>
                ) : confirmDeleteId === h.id ? (
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-200">
                    <span className="text-xs font-bold text-red-600">Apagar este registo?</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleDelete(h.id)} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg">Sim</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg">Não</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-600">{h.valor_anterior || 'N/A'}€</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-sm font-bold text-indigo-600">{h.valor_novo}€</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{new Date(h.data_alteracao).toLocaleDateString('pt-PT')}</span>
                      <button onClick={() => { setEditingId(h.id); setEditingDraft(h); }} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit2 size={12} /></button>
                      <button onClick={() => setConfirmDeleteId(h.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={12} /></button>
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

export default WorkerValorHoraHistoryModal;
