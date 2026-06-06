import React, { useState } from 'react';
import { CalendarX, Eye, Copy, CheckCircle, Clock } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

export default function AbsenceRequestsPanel({ requests, systemSettings, clients }) {
  const { supabase, setAbsenceRequests, currentUser } = useApp();
  const [copiedId, setCopiedId] = useState(null);

  const notifyClient = systemSettings?.absenceConfig?.absence_notify_client ?? false;

  const handleMarkSeen = async (req) => {
    if (!supabase) return;
    const now = new Date().toISOString();
    await supabase.from('absence_requests').update({
      status: 'seen',
      seen_at: now,
      seen_by: currentUser?.name || 'admin',
    }).eq('id', req.id);
    setAbsenceRequests(prev => prev.map(r =>
      r.id === req.id ? { ...r, status: 'seen', seen_at: now, seen_by: currentUser?.name || 'admin' } : r
    ));
  };

  const buildEmailText = (req) => {
    const dateLabels = (req.dates || []).sort().map(ds =>
      new Date(ds + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
    ).join(', ');
    return `Assunto: Aviso de Falta — ${req.worker_name}\n\nBom dia,\n\nVenho por este meio informar que o colaborador ${req.worker_name} avisou que não poderá comparecer ao trabalho nos seguintes dias:\n${dateLabels}\n\nMotivo: ${req.reason}${req.notes ? `\nNotas: ${req.notes}` : ''}\n\nCumprimentos,\nMagnetic Place`;
  };

  const handleCopyEmail = (req) => {
    navigator.clipboard.writeText(buildEmailText(req));
    setCopiedId(req.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  if (!requests || requests.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-10 text-center">
        <CalendarX size={28} className="text-slate-300 mx-auto mb-3" />
        <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Sem avisos de falta</p>
        <p className="text-[10px] text-slate-300 font-bold mt-1">Os avisos dos colaboradores aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {[...requests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(req => {
        const client = clients?.find(c => c.id === req.client_id);
        const sortedDates = (req.dates || []).slice().sort();
        const createdLabel = new Date(req.created_at).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const isNew = req.status === 'pending';

        return (
          <div key={req.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isNew ? 'border-orange-200' : 'border-slate-100'}`}>
            <div className={`px-5 py-3 flex items-center gap-3 ${isNew ? 'bg-orange-50' : 'bg-slate-50'}`}>
              <div className={`p-2 rounded-xl shrink-0 ${isNew ? 'bg-orange-100' : 'bg-slate-100'}`}>
                <CalendarX size={15} className={isNew ? 'text-orange-600' : 'text-slate-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-black text-slate-800">{req.worker_name}</p>
                  {isNew && (
                    <span className="bg-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Novo</span>
                  )}
                  {!isNew && (
                    <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 uppercase">
                      <CheckCircle size={10} /> Visto
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                  <Clock size={9} /> {createdLabel}
                </p>
              </div>
              {isNew && (
                <button
                  onClick={() => handleMarkSeen(req)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-900 transition-all"
                >
                  <Eye size={12} /> Marcar como Visto
                </button>
              )}
            </div>

            <div className="px-5 py-4 space-y-2">
              <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Motivo</p>
                  <p className="text-xs font-black text-slate-700">{req.reason}</p>
                </div>
                {client && (
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Unidade</p>
                    <p className="text-xs font-black text-slate-700">{client.name}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">
                  Dias ausente <span className="font-bold normal-case tracking-normal text-slate-300">({sortedDates.length})</span>
                </p>
                {sortedDates.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {sortedDates.map(ds => {
                      const d = new Date(ds + 'T00:00:00');
                      const weekday = d.toLocaleDateString('pt-PT', { weekday: 'short' });
                      const dayNum = d.getDate();
                      const month = d.toLocaleDateString('pt-PT', { month: 'short' });
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <span key={ds} className={`inline-flex flex-col items-center px-2.5 py-1.5 rounded-xl text-center leading-none ${isWeekend ? 'bg-slate-100 text-slate-400' : 'bg-orange-100 text-orange-700'}`}>
                          <span className="text-[8px] font-black uppercase tracking-wider">{weekday}</span>
                          <span className="text-sm font-black">{dayNum}</span>
                          <span className="text-[8px] font-bold opacity-70">{month}</span>
                        </span>
                      );
                    })}
                  </div>
                ) : <span className="text-xs text-slate-400">—</span>}
              </div>

              {req.notes && (
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Notas</p>
                  <p className="text-xs text-slate-600">{req.notes}</p>
                </div>
              )}

              {notifyClient && client?.email && (
                <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-[9px] font-black uppercase text-amber-700 tracking-widest mb-1">Notificar Cliente</p>
                  <p className="text-[10px] font-bold text-slate-600 mb-2">{client.email}</p>
                  <button
                    onClick={() => handleCopyEmail(req)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-amber-600 transition-all"
                  >
                    {copiedId === req.id ? <><CheckCircle size={11} /> Copiado!</> : <><Copy size={11} /> Copiar Mensagem</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
