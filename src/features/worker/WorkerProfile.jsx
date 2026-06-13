import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, Phone, Mail, MapPin, CreditCard, Shield, Landmark, Edit2, X, Send, Clock, CheckCircle, XCircle, FileCheck, Download } from 'lucide-react';
import { isSigned } from '../../constants/documentStatus';

const FIELDS = [
  { key: 'tel',     label: 'Telefone',           icon: Phone,      type: 'tel' },
  { key: 'email',   label: 'Email',               icon: Mail,       type: 'email' },
  { key: 'address', label: 'Morada',              icon: MapPin,     type: 'text' },
  { key: 'dni',     label: 'Doc. Identificação',  icon: CreditCard, type: 'text' },
  { key: 'nis',     label: 'Nº Seg. Social',      icon: Shield,     type: 'text' },
  { key: 'nif',     label: 'NIF',                 icon: Shield,     type: 'text' },
  { key: 'iban',    label: 'IBAN',                icon: Landmark,   type: 'text' },
];

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function SectionLabel({ children }) {
  return (
    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1 mb-2">{children}</p>
  );
}

const WorkerProfile = ({ worker, changeRequests, documents = [] }) => {
  const signedDocs = [...documents]
    .filter(d => isSigned(d.status))
    .sort((a, b) => (b.signed_at || b.dataAssinatura || '').localeCompare(a.signed_at || a.dataAssinatura || ''));
  const { supabase } = useApp();
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [successField, setSuccessField] = useState(null);

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
      setSuccessField(field);
      setTimeout(() => setSuccessField(null), 3000);
    }
  };

  const handleCancel = async (req) => {
    if (!supabase) return;
    await supabase.from('worker_change_requests').delete().eq('id', req.id);
  };

  const resolvedRequests = changeRequests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {successField && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle size={14} /> Solicitação enviada
        </div>
      )}

      {/* Avatar + nome */}
      <div className="flex flex-col items-center py-4 gap-2">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg">
          <span className="text-2xl font-black text-white">{getInitials(worker?.name)}</span>
        </div>
        <div className="text-center">
          <p className="text-base font-black text-slate-800">{worker?.name || '—'}</p>
          {worker?.profissao && (
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mt-0.5">{worker.profissao}</p>
          )}
        </div>
      </div>

      {/* Dados Pessoais */}
      <div>
        <SectionLabel>Dados Pessoais</SectionLabel>
        <p className="text-[10px] text-slate-400 font-bold px-1 mb-3">Para alterar um campo clique no lápis.</p>
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
          {FIELDS.map(f => {
            const Icon = f.icon;
            const pending = pendingFor(f.key);
            const isEditingThis = editing === f.key;
            const value = worker[f.key] || '';

            return (
              <div key={f.key} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-0.5 w-7 h-7 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                      <Icon size={12} className="text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{f.label}</p>
                      {pending ? (
                        <div className="mt-0.5 space-y-0.5">
                          <p className="text-xs text-slate-300 line-through leading-snug">{value || '—'}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-indigo-600">{pending.proposed}</span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-600 text-[8px] font-black uppercase rounded-full">
                              <Clock size={7} /> Aguarda
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-slate-800 mt-0.5 break-all">
                          {value || <span className="text-slate-300 italic text-xs">Não definido</span>}
                        </p>
                      )}

                      {isEditingThis && (
                        <div className="mt-2 flex gap-1.5">
                          <input
                            type={f.type}
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            placeholder={`Novo ${f.label.toLowerCase()}...`}
                            className="flex-1 text-sm border border-indigo-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 font-medium"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSubmit(f.key);
                              if (e.key === 'Escape') { setEditing(null); setDraft(''); }
                            }}
                          />
                          <button
                            onClick={() => handleSubmit(f.key)}
                            disabled={loading || !draft.trim()}
                            className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-40 shrink-0"
                          >
                            <Send size={13} />
                          </button>
                          <button
                            onClick={() => { setEditing(null); setDraft(''); }}
                            className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all shrink-0"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 mt-0.5">
                    {pending ? (
                      <button
                        onClick={() => handleCancel(pending)}
                        className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        title="Cancelar solicitação"
                      >
                        <X size={12} />
                      </button>
                    ) : !isEditingThis ? (
                      <button
                        onClick={() => { setEditing(f.key); setDraft(value); }}
                        className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Solicitar alteração"
                      >
                        <Edit2 size={12} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Documentos Assinados */}
      {signedDocs.length > 0 && (
        <div>
          <SectionLabel>Documentos Assinados</SectionLabel>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
            {signedDocs.map(doc => (
              <div key={doc.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <FileCheck size={13} className="text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{doc.tipo || doc.title || doc.nome || doc.name}</p>
                  {(doc.signed_at || doc.dataAssinatura) && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(doc.signed_at || doc.dataAssinatura).toLocaleDateString('pt-PT')}
                    </p>
                  )}
                </div>
                {(doc.signed_pdf_url || doc.pdfAssinadoUrl) && (
                  <a
                    href={doc.signed_pdf_url || doc.pdfAssinadoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all shrink-0"
                  >
                    <Download size={13} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de solicitações */}
      {resolvedRequests.length > 0 && (
        <div>
          <SectionLabel>Histórico de Solicitações</SectionLabel>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
            {resolvedRequests.slice(0, 10).map(r => (
              <div key={r.id} className="px-4 py-3 flex items-start gap-3">
                <div className={`mt-0.5 w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${r.status === 'approved' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                  {r.status === 'approved'
                    ? <CheckCircle size={13} className="text-emerald-500" />
                    : <XCircle size={13} className="text-rose-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{r.field_label}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="text-xs text-slate-300 line-through">{r.before || '—'}</span>
                    <span className="text-slate-300">→</span>
                    <span className={`text-xs font-bold ${r.status === 'approved' ? 'text-emerald-600' : 'text-slate-400 line-through'}`}>{r.proposed}</span>
                  </div>
                  {r.admin_note && (
                    <p className="text-[10px] text-slate-400 mt-0.5 italic">"{r.admin_note}"</p>
                  )}
                </div>
                <span className={`shrink-0 text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${r.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                  {r.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerProfile;
