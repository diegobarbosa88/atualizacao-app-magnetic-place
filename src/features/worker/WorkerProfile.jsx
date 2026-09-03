import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, Phone, Mail, MapPin, CreditCard, Shield, Landmark, Edit2, X, Send, Clock, CheckCircle, XCircle, FileCheck, Download, Bell, BellRing, Loader2, Compass, ChevronRight } from 'lucide-react';
import { isSigned } from '../../constants/documentStatus';
import { FT, FONT_TITLE, FONT_MONO, SCALE } from '../../styles/designTokens';
import { notifyEvent, TARGET } from '../../utils/notifyEvent';
import { usePushSubscription } from '../../hooks/usePushSubscription';

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
    <p className={`${SCALE.text.statLabel} text-slate-400 px-1 mb-2`}>{children}</p>
  );
}

const WorkerProfile = ({ worker, changeRequests, documents = [], onRequestTour }) => {
  const signedDocs = [...documents]
    .filter(d => isSigned(d.status))
    .sort((a, b) => (b.signed_at || b.dataAssinatura || '').localeCompare(a.signed_at || a.dataAssinatura || ''));
  const { supabase } = useApp();
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [successField, setSuccessField] = useState(null);
  const { permission, isSubscribed, subscribing, subscribe, unsubscribe, supported: pushSupported } = usePushSubscription({ supabase, role: 'worker', userId: worker?.id });

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
      await notifyEvent(supabase, {
        idPrefix: 'change_notif',
        title: 'Solicitação de Alteração de Dados',
        message: `${worker.name} solicitou alteração de ${fieldMeta?.label || field}`,
        type: 'info',
        target: TARGET.ADMIN,
        payload: { change_request_id: req.id, kind: 'change_request' },
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
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: FT.navyDeep, border: `2px solid ${FT.orange}` }}>
          <span className="text-2xl font-bold" style={{ fontFamily: FONT_TITLE, color: FT.orange }}>{getInitials(worker?.name)}</span>
        </div>
        <div className="text-center">
          <p className="text-base font-black text-slate-800">{worker?.name || '—'}</p>
          {worker?.profissao && (
            <p className={`${SCALE.text.statLabel} mt-0.5`} style={{ fontFamily: FONT_MONO, color: FT.orangeDeep }}>{worker.profissao}</p>
          )}
        </div>
      </div>

      {/* Rever tour do painel */}
      {onRequestTour && (
        <button
          type="button"
          onClick={onRequestTour}
          className="w-full bg-white rounded-2xl border border-slate-100 overflow-hidden px-4 py-3 text-left"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: FT.okBg }}>
                <Compass size={13} style={{ color: FT.ok }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">Rever tour do painel</p>
                <p className={`${SCALE.text.meta} text-slate-400`}>Uma volta rápida pelas funcionalidades principais</p>
              </div>
            </div>
            <ChevronRight size={15} className="text-slate-300 shrink-0" />
          </div>
        </button>
      )}

      {/* Dados Pessoais */}
      <div>
        <SectionLabel>Dados Pessoais</SectionLabel>
        <p className={`${SCALE.text.meta} text-slate-400 px-1 mb-3`}>Para alterar um campo clique no lápis.</p>
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
                      <p className={`${SCALE.text.statLabel} text-slate-400`}>{f.label}</p>
                      {pending ? (
                        <div className="mt-0.5 space-y-0.5">
                          <p className="text-xs text-slate-300 line-through leading-snug">{value || '—'}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black" style={{ color: FT.orangeDeep }}>{pending.proposed}</span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${SCALE.text.badge}`} style={{ fontFamily: FONT_MONO, background: FT.warnBg, color: FT.warn, border: `1px solid ${FT.warn}55` }}>
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
                            className="flex-1 text-sm rounded-xl px-3 py-2 outline-none font-medium"
                            style={{ border: `1px solid ${FT.orange}55` }}
                            onFocus={e => { e.target.style.border = `1px solid ${FT.orange}`; e.target.style.boxShadow = `0 0 0 3px ${FT.orange}1A`; }}
                            onBlur={e => { e.target.style.border = `1px solid ${FT.orange}55`; e.target.style.boxShadow = 'none'; }}
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSubmit(f.key);
                              if (e.key === 'Escape') { setEditing(null); setDraft(''); }
                            }}
                          />
                          <button
                            onClick={() => handleSubmit(f.key)}
                            disabled={loading || !draft.trim()}
                            className="p-2 text-white rounded-xl transition-all disabled:opacity-40 shrink-0"
                            style={{ background: FT.orange }}
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
                        className="p-1.5 text-slate-300 rounded-lg transition-all"
                        style={{ '--hover-color': FT.navy }}
                        onMouseEnter={e => { e.currentTarget.style.color = FT.orangeDeep; e.currentTarget.style.background = FT.warnBg; }}
                        onMouseLeave={e => { e.currentTarget.style.color = ''; e.currentTarget.style.background = ''; }}
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

      {/* Notificações */}
      {pushSupported && (
        <div>
          <SectionLabel>Notificações</SectionLabel>
          <button
            type="button"
            onClick={isSubscribed ? unsubscribe : subscribe}
            disabled={subscribing || (!isSubscribed && permission === 'denied')}
            className="w-full bg-white rounded-2xl border border-slate-100 overflow-hidden px-4 py-3 text-left disabled:opacity-60"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                  {isSubscribed ? <BellRing size={12} style={{ color: FT.ok }} /> : <Bell size={12} className="text-slate-400" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">Avisos no telemóvel</p>
                  <p className={`${SCALE.text.meta} text-slate-400`}>
                    {isSubscribed ? 'Ativos neste dispositivo — toca para desativar' : permission === 'denied' ? 'Bloqueados nas definições do browser' : 'Recebe avisos mesmo com a app fechada'}
                  </p>
                </div>
              </div>
              <span
                className="shrink-0 px-3 py-2 rounded-xl font-black text-xs uppercase tracking-wide transition-all"
                style={isSubscribed ? { background: FT.okBg, color: FT.ok } : { background: FT.orange, color: FT.navy }}
              >
                {subscribing ? <Loader2 size={13} className="animate-spin" /> : isSubscribed ? 'Ativo' : permission === 'denied' ? 'Bloqueado' : 'Ativar'}
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Documentos Assinados */}
      {signedDocs.length > 0 && (
        <div>
          <SectionLabel>Documentos Assinados</SectionLabel>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
            {signedDocs.map(doc => (
              <div key={doc.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: FT.okBg }}>
                  <FileCheck size={13} style={{ color: FT.ok }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{doc.tipo || doc.title || doc.nome || doc.name}</p>
                  {(doc.signed_at || doc.dataAssinatura) && (
                    <p className={`${SCALE.text.meta} text-slate-400 mt-0.5`}>
                      {new Date(doc.signed_at || doc.dataAssinatura).toLocaleDateString('pt-PT')}
                    </p>
                  )}
                </div>
                {(doc.signed_pdf_url || doc.pdfAssinadoUrl) && (
                  <a
                    href={doc.signed_pdf_url || doc.pdfAssinadoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-300 hover:bg-[#1B3A57]/10 hover:text-[var(--navy)] rounded-lg transition-all shrink-0"
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
                <div className="mt-0.5 w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: r.status === 'approved' ? FT.okBg : FT.badBg }}>
                  {r.status === 'approved'
                    ? <CheckCircle size={13} style={{ color: FT.ok }} />
                    : <XCircle size={13} style={{ color: FT.bad }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`${SCALE.text.statLabel} text-slate-400`} style={{ fontFamily: FONT_MONO }}>{r.field_label}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="text-xs text-slate-300 line-through">{r.before || '—'}</span>
                    <span className="text-slate-300">→</span>
                    <span className="text-xs font-bold" style={{ color: r.status === 'approved' ? FT.ok : FT.inkSoft, textDecoration: r.status === 'approved' ? 'none' : 'line-through' }}>{r.proposed}</span>
                  </div>
                  {r.admin_note && (
                    <p className={`${SCALE.text.meta} text-slate-400 mt-0.5 italic`}>"{r.admin_note}"</p>
                  )}
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full ${SCALE.text.badge}`} style={{ fontFamily: FONT_MONO, background: r.status === 'approved' ? FT.okBg : FT.badBg, color: r.status === 'approved' ? FT.ok : FT.bad }}>
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
