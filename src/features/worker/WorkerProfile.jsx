import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, Phone, Mail, MapPin, CreditCard, Shield, Landmark, Edit2, X, Send, Clock, CheckCircle, XCircle } from 'lucide-react';

const FIELDS = [
  { key: 'tel',     label: 'Telefone',            icon: Phone,     type: 'tel' },
  { key: 'email',   label: 'Email',                icon: Mail,      type: 'email' },
  { key: 'address', label: 'Morada',               icon: MapPin,    type: 'text' },
  { key: 'dni',     label: 'Doc. Identificação',   icon: CreditCard,type: 'text' },
  { key: 'nis',     label: 'Nº Seg. Social',       icon: Shield,    type: 'text' },
  { key: 'nif',     label: 'NIF',                  icon: Shield,    type: 'text' },
  { key: 'iban',    label: 'IBAN',                 icon: Landmark,  type: 'text' },
];

const WorkerProfile = ({ worker, changeRequests }) => {
  const { supabase } = useApp();
  const [editing, setEditing] = useState(null); // field key being edited
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);

  const pendingFor = (key) => changeRequests.find(r => r.field === key && r.status === 'pending');

  const handleSubmit = async (field) => {
    if (!draft.trim() || !supabase) return;
    const fieldMeta = FIELDS.find(f => f.key === field);
    setLoading(true);
    try {
      const req = {
        id: `chreq_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        worker_id: worker.id,
        worker_name: worker.name,
        field,
        field_label: fieldMeta?.label || field,
        before: worker[field] || '',
        proposed: draft.trim(),
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      await supabase.from('worker_change_requests').insert(req);

      // notificar admin
      await supabase.from('app_notifications').insert({
        id: `change_notif_${Date.now()}`,
        title: 'Solicitação de Alteração de Dados',
        message: `${worker.name} solicitou alteração de ${fieldMeta?.label || field}`,
        type: 'info',
        target_type: 'admin',
        is_dismissible: true,
        is_active: true,
        created_at: new Date().toISOString(),
        viewed_by_ids: [],
        dismissed_by_ids: [],
      });
    } finally {
      setLoading(false);
      setEditing(null);
      setDraft('');
    }
  };

  const handleCancel = async (req) => {
    if (!supabase) return;
    await supabase.from('worker_change_requests').delete().eq('id', req.id);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-2xl uppercase shrink-0">
          {worker.name?.[0] || '?'}
        </div>
        <div>
          <p className="font-black text-lg uppercase tracking-tight leading-none">{worker.name}</p>
          <p className="text-slate-400 text-xs font-bold uppercase mt-1">{worker.profissao || 'Colaborador'}</p>
        </div>
      </div>

      {/* Campos editáveis */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-slate-50">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Dados Pessoais</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Para alterar um campo, clique no lápis e submeta uma solicitação.</p>
        </div>

        {FIELDS.map((f, i) => {
          const Icon = f.icon;
          const pending = pendingFor(f.key);
          const isEditingThis = editing === f.key;
          const value = worker[f.key] || '';

          return (
            <div key={f.key} className={`px-5 py-4 ${i < FIELDS.length - 1 ? 'border-b border-slate-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="mt-0.5 p-1.5 bg-slate-50 rounded-lg text-slate-400 shrink-0">
                    <Icon size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{f.label}</p>
                    {pending ? (
                      <div className="mt-0.5 space-y-1">
                        <p className="text-xs text-slate-400 line-through">{value || '—'}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-indigo-600">{pending.proposed}</span>
                          <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-600 text-[9px] font-black uppercase rounded-full flex items-center gap-1">
                            <Clock size={8} /> A aguardar
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-slate-800 mt-0.5 truncate">{value || <span className="text-slate-300 italic">Não definido</span>}</p>
                    )}

                    {isEditingThis && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type={f.type}
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          placeholder={`Novo valor para ${f.label.toLowerCase()}...`}
                          className="flex-1 text-sm border border-indigo-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 font-medium"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(f.key); if (e.key === 'Escape') { setEditing(null); setDraft(''); } }}
                        />
                        <button
                          onClick={() => handleSubmit(f.key)}
                          disabled={loading || !draft.trim()}
                          className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-40"
                        ><Send size={13} /></button>
                        <button
                          onClick={() => { setEditing(null); setDraft(''); }}
                          className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"
                        ><X size={13} /></button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {pending ? (
                    <button
                      onClick={() => handleCancel(pending)}
                      className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      title="Cancelar solicitação"
                    ><X size={13} /></button>
                  ) : !isEditingThis ? (
                    <button
                      onClick={() => { setEditing(f.key); setDraft(value); }}
                      className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="Solicitar alteração"
                    ><Edit2 size={13} /></button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Histórico de solicitações resolvidas */}
      {changeRequests.filter(r => r.status !== 'pending').length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-slate-50">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Histórico de Solicitações</p>
          </div>
          {changeRequests.filter(r => r.status !== 'pending').slice(0, 10).map(r => (
            <div key={r.id} className="px-5 py-3 border-b border-slate-50 last:border-b-0 flex items-center gap-3">
              {r.status === 'approved'
                ? <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                : <XCircle size={14} className="text-rose-400 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700">{r.field_label}: <span className="text-slate-400 line-through">{r.before || '—'}</span> → <span className={r.status === 'approved' ? 'text-emerald-600' : 'text-slate-400 line-through'}>{r.proposed}</span></p>
                {r.admin_note && <p className="text-[10px] text-slate-400 mt-0.5 italic">"{r.admin_note}"</p>}
              </div>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${r.status === 'approved' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-rose-500 bg-rose-50 border-rose-200'}`}>
                {r.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkerProfile;
