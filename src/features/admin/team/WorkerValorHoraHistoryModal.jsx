import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, Check, X } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';

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

  return (
    <ModalShell
      isOpen={show}
      onClose={onClose}
      title="Histórico de Valor Hora"
      meta={workerName}
      size="md"
    >
      <div className="p-6">
        {history.length === 0 ? (
          <p className="text-sm text-[var(--slate-dim)] text-center py-4">Sem histórico disponível</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {history.map(h => (
              <div key={h.id}>
                {editingId === h.id ? (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                    <input type="number" step="0.01" value={editingDraft.valor_anterior || ''} onChange={e => setEditingDraft(d => ({ ...d, valor_anterior: e.target.value }))} className="w-16 border border-[var(--border)] rounded-lg p-1 text-xs font-bold" placeholder="Ant." />
                    <span className="text-[var(--slate)] text-xs">→</span>
                    <input type="number" step="0.01" value={editingDraft.valor_novo || ''} onChange={e => setEditingDraft(d => ({ ...d, valor_novo: e.target.value }))} className="w-16 border border-[var(--border)] rounded-lg p-1 text-xs font-bold" placeholder="Novo" />
                    <input type="date" value={editingDraft.data_alteracao ? editingDraft.data_alteracao.split('T')[0] : ''} onChange={e => setEditingDraft(d => ({ ...d, data_alteracao: e.target.value }))} className="border border-[var(--border)] rounded-lg p-1 text-xs font-bold flex-1 min-w-0" />
                    <button onClick={() => handleSave(h)} className="p-1 text-green-600 hover:bg-green-50 rounded-lg"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-[var(--slate-dim)] hover:bg-[var(--surface-dim)] rounded-lg"><X size={14} /></button>
                  </div>
                ) : confirmDeleteId === h.id ? (
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-200">
                    <span className="text-xs font-bold text-red-600">Apagar este registo?</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleDelete(h.id)} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg">Sim</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 bg-[var(--border)] text-[var(--ink-soft)] text-xs font-bold rounded-lg">Não</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center p-3 bg-[var(--surface)] rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--ink-soft)]">{h.valor_anterior || 'N/A'}€</span>
                      <span className="text-[var(--slate)]">→</span>
                      <span className="text-sm font-bold text-indigo-600">{h.valor_novo}€</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--slate-dim)]">{new Date(h.data_alteracao).toLocaleDateString('pt-PT')}</span>
                      <button onClick={() => { setEditingId(h.id); setEditingDraft(h); }} className="p-1 text-[var(--slate)] hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit2 size={12} /></button>
                      <button onClick={() => setConfirmDeleteId(h.id)} className="p-1 text-[var(--slate)] hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={12} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
};

export default WorkerValorHoraHistoryModal;
