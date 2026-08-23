import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { notifyEvent, TARGET } from '../../../utils/notifyEvent';

const ChangeRequestsPanel = ({ requests, onUpdate }) => {
  const { supabase, workers, workerChangeRequests, setWorkerChangeRequests, saveToDb } = useApp();
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  const handleApprove = async (req) => {
    if (!supabase) return;
    const worker = workers.find(w => w.id === req.worker_id);
    if (!worker) return;
    await saveToDb('workers', worker.id, { ...worker, [req.field]: req.proposed });
    await supabase.from('worker_change_requests').update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: 'admin' }).eq('id', req.id);
    setWorkerChangeRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));
    await notifyEvent(supabase, {
      idPrefix: 'chreq_appr',
      title: 'Alteração de Dados Aprovada',
      message: `A sua solicitação de alteração de ${req.field_label} foi aprovada.`,
      type: 'success',
      target: TARGET.WORKER,
      targetWorkerIds: [req.worker_id],
      payload: { change_request_id: req.id, kind: 'change_request_approved' },
    });
    onUpdate?.();
  };

  const handleReject = async (req) => {
    if (!supabase) return;
    await supabase.from('worker_change_requests').update({ status: 'rejected', admin_note: rejectNote, reviewed_at: new Date().toISOString(), reviewed_by: 'admin' }).eq('id', req.id);
    setWorkerChangeRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected', admin_note: rejectNote } : r));
    await notifyEvent(supabase, {
      idPrefix: 'chreq_rej',
      title: 'Alteração de Dados Rejeitada',
      message: `A sua solicitação de alteração de ${req.field_label} foi rejeitada.${rejectNote ? ' Nota: ' + rejectNote : ''}`,
      type: 'warning',
      target: TARGET.WORKER,
      targetWorkerIds: [req.worker_id],
      payload: { change_request_id: req.id, kind: 'change_request_rejected' },
    });
    setRejectingId(null);
    setRejectNote('');
    onUpdate?.();
  };

  if (!requests || requests.length === 0) return null;

  return (
    <div className="mb-6 bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
        <ShieldCheck size={16} className="text-amber-600" />
        <p className="text-[10px] font-black uppercase text-amber-700 tracking-widest flex-1">Solicitações de Alteração de Dados</p>
        <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">{requests.length}</span>
      </div>
      {requests.map(req => (
        <div key={req.id} className="px-5 py-4 border-b border-[var(--border-soft)] last:border-b-0">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-[var(--ink)]">{req.worker_name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] font-bold text-[var(--slate-dim)] uppercase">{req.field_label}</span>
                <span className="text-[10px] text-[var(--slate-dim)] line-through">{req.before || '—'}</span>
                <ArrowRight size={10} className="text-[var(--slate)]" />
                <span className="text-[10px] font-black text-indigo-600">{req.proposed}</span>
              </div>
              <p className="text-[9px] text-[var(--slate-dim)] mt-1">{new Date(req.created_at).toLocaleString('pt-PT')}</p>
              {rejectingId === req.id && (
                <div className="mt-2 flex gap-2">
                  <input value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Motivo da rejeição (opcional)..." className="flex-1 text-xs border border-[var(--border)] rounded-xl px-3 py-2 outline-none focus:border-rose-300" autoFocus />
                  <button onClick={() => handleReject(req)} className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase">Confirmar</button>
                  <button onClick={() => { setRejectingId(null); setRejectNote(''); }} className="px-3 py-1.5 bg-[var(--surface-dim)] text-[var(--slate-dim)] rounded-xl text-[10px] font-black uppercase">Cancelar</button>
                </div>
              )}
            </div>
            {rejectingId !== req.id && (
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleApprove(req)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 transition-all">
                  <CheckCircle size={12} /> Aprovar
                </button>
                <button onClick={() => { setRejectingId(req.id); setRejectNote(''); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-[10px] font-black uppercase hover:bg-rose-100 transition-all">
                  <XCircle size={12} /> Rejeitar
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChangeRequestsPanel;
