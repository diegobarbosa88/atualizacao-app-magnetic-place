import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, Check, X } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';

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

  return (
    <ModalShell
      isOpen={show}
      onClose={onClose}
      title="Períodos de Emprego"
      meta={workerName}
      size="md"
    >
      <div className="p-6">
        {periods.length === 0 ? (
          <p className="text-sm text-[var(--slate-dim)] text-center py-4">Sem períodos registados</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {periods.map((p) => (
              <div key={p.id}>
                {editingId === p.id ? (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                    <input type="date" value={editingDraft.data_inicio || ''} onChange={e => setEditingDraft(d => ({ ...d, data_inicio: e.target.value }))} className="border border-[var(--border)] rounded-lg p-1 text-xs font-bold flex-1 min-w-0" />
                    <span className="text-[var(--slate)] text-xs">→</span>
                    <input type="date" value={editingDraft.data_fim || ''} onChange={e => setEditingDraft(d => ({ ...d, data_fim: e.target.value }))} className="border border-[var(--border)] rounded-lg p-1 text-xs font-bold flex-1 min-w-0" placeholder="Em aberto" />
                    <button onClick={() => handleSave(p)} className="p-1 text-green-600 hover:bg-green-50 rounded-lg"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-[var(--slate-dim)] hover:bg-[var(--surface-dim)] rounded-lg"><X size={14} /></button>
                  </div>
                ) : confirmDeleteId === p.id ? (
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-200">
                    <span className="text-xs font-bold text-red-600">Apagar este período?</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleDelete(p.id)} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg">Sim</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 bg-[var(--border)] text-[var(--ink-soft)] text-xs font-bold rounded-lg">Não</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center p-3 bg-[var(--surface)] rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--ink-soft)]">{p.data_inicio}</span>
                      <span className="text-[var(--slate)]">→</span>
                      <span className="text-sm font-bold text-indigo-600">{p.data_fim || 'Atual'}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingId(p.id); setEditingDraft(p); }} className="p-1 text-[var(--slate)] hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit2 size={12} /></button>
                      <button onClick={() => setConfirmDeleteId(p.id)} className="p-1 text-[var(--slate)] hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={12} /></button>
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

export default WorkerEmploymentHistoryModal;
