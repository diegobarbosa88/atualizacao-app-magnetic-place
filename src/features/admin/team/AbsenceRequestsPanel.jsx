import React, { useState } from 'react';
import { CalendarX, Copy, CheckCircle, Clock, ChevronDown, ChevronUp, ThumbsUp, RotateCcw, Archive } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

export default function AbsenceRequestsPanel({ requests, systemSettings, clients }) {
  const { supabase, setAbsenceRequests, currentUser } = useApp();
  const [copiedId, setCopiedId] = useState(null);
  const [openIds, setOpenIds] = useState(new Set());
  const toggleOpen = (id) => setOpenIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const [openWorkers, setOpenWorkers] = useState(new Set());
  const toggleWorker = (id) => setOpenWorkers(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const [openApprovedGroups, setOpenApprovedGroups] = useState(new Set());
  const toggleApprovedGroup = (id) => setOpenApprovedGroups(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const [openPendingGroups, setOpenPendingGroups] = useState(new Set());
  const togglePendingGroup = (id) => setOpenPendingGroups(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const notifyClient = systemSettings?.absenceConfig?.absence_notify_client ?? false;

  const handleApprove = async (req) => {
    if (!supabase) return;
    const { error } = await supabase.from('absence_requests').update({ status: 'approved' }).eq('id', req.id);
    if (!error) {
      setAbsenceRequests(prev => prev.map(r =>
        r.id === req.id ? { ...r, status: 'approved' } : r
      ));
    }
  };

  const handleRevert = async (req) => {
    if (!supabase) return;
    const { error } = await supabase.from('absence_requests').update({ status: 'pending' }).eq('id', req.id);
    if (!error) {
      setAbsenceRequests(prev => prev.map(r =>
        r.id === req.id ? { ...r, status: 'pending' } : r
      ));
    }
  };

  const handleArchive = async (req) => {
    if (!supabase) return;
    const { error } = await supabase.from('absence_requests').update({ status: 'archived' }).eq('id', req.id);
    if (!error) {
      setAbsenceRequests(prev => prev.map(r =>
        r.id === req.id ? { ...r, status: 'archived' } : r
      ));
    }
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

  const visibleRequests = (requests || []).filter(r => r.status !== 'archived');

  if (!visibleRequests.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-10 text-center">
        <CalendarX size={28} className="text-slate-300 mx-auto mb-3" />
        <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Sem avisos de falta</p>
        <p className="text-[10px] text-slate-300 font-bold mt-1">Os avisos dos colaboradores aparecerão aqui.</p>
      </div>
    );
  }

  const renderCard = (req) => {
    const client = clients?.find(c => c.id === req.client_id);
    const sortedDates = (req.dates || []).slice().sort();
    const createdLabel = new Date(req.created_at).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const isNew = req.status === 'pending';
    const isApproved = req.status === 'approved';

    return (
      <div key={req.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isNew ? 'border-orange-200' : 'border-slate-100'}`}>
        <div onClick={() => toggleOpen(req.id)} className={`px-5 py-3 flex items-center gap-3 cursor-pointer select-none ${isNew ? 'bg-orange-50' : 'bg-slate-50'}`}>
          <div className={`p-2 rounded-xl shrink-0 ${isNew ? 'bg-orange-100' : 'bg-slate-100'}`}>
            <CalendarX size={15} className={isNew ? 'text-orange-600' : 'text-slate-400'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {!isApproved && (
                <span className="bg-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Novo</span>
              )}
              {isApproved && (
                <span className="flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase">
                  <ThumbsUp size={9} /> OK dado
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
              <Clock size={9} /> {createdLabel}
            </p>
          </div>
          {!isApproved && (
            <button
              onClick={(e) => { e.stopPropagation(); handleApprove(req); }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all"
            >
              <ThumbsUp size={12} /> Dar OK
            </button>
          )}
          {openIds.has(req.id) ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
        </div>

        {openIds.has(req.id) && <div className="px-5 py-4 space-y-2">
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

          <div className="flex gap-2 pt-3 mt-1 border-t border-slate-100">
            {isApproved && (
              <button
                onClick={() => handleRevert(req)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-orange-100 hover:text-orange-700 transition-all"
              >
                <RotateCcw size={11} /> Reverter
              </button>
            )}
            <button
              onClick={() => handleArchive(req)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-50 hover:text-red-500 transition-all"
            >
              <Archive size={11} /> Arquivar
            </button>
          </div>
        </div>}
      </div>
    );
  };

  const workerGroups = Object.values(
    visibleRequests.reduce((acc, req) => {
      if (!acc[req.worker_id]) acc[req.worker_id] = { id: req.worker_id, name: req.worker_name, requests: [] };
      acc[req.worker_id].requests.push(req);
      return acc;
    }, {})
  ).sort((a, b) => {
    const aPending = a.requests.some(r => r.status === 'pending') ? 0 : 1;
    const bPending = b.requests.some(r => r.status === 'pending') ? 0 : 1;
    return aPending - bPending || a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-2">
      {workerGroups.map(group => {
        const pendingCount = group.requests.filter(r => r.status === 'pending').length;
        const sortedReqs = [...group.requests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const isOpen = openWorkers.has(group.id);
        return (
          <div key={group.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div
              onClick={() => toggleWorker(group.id)}
              className="px-5 py-3 flex items-center gap-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                <p className="text-xs font-black text-slate-800">{group.name}</p>
                {pendingCount > 0 && (
                  <span className="bg-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-bold text-slate-300">{sortedReqs.length} aviso{sortedReqs.length !== 1 ? 's' : ''}</span>
              {isOpen ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
            </div>
            {isOpen && (() => {
              const pendingReqs = sortedReqs.filter(r => r.status !== 'approved');
              const approvedReqs = sortedReqs.filter(r => r.status === 'approved');
              const mostRecentPending = pendingReqs[0];
              const restPending = pendingReqs.slice(1);
              const mostRecentApproved = approvedReqs[0];
              const restApproved = approvedReqs.slice(1);
              const pendingOpen = openPendingGroups.has(group.id);
              const approvedOpen = openApprovedGroups.has(group.id);
              return (
                <div className="px-3 pb-3 space-y-2 border-t border-slate-100 pt-3">
                  {mostRecentPending && renderCard(mostRecentPending)}
                  {restPending.length > 0 && (
                    <>
                      <button
                        onClick={() => togglePendingGroup(group.id)}
                        className="w-full px-4 py-2 flex items-center gap-2 text-[10px] font-black uppercase text-orange-400 bg-orange-50 rounded-xl hover:text-orange-600 hover:bg-orange-100 transition-all"
                      >
                        {pendingOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        {pendingOpen ? 'Mostrar menos' : `Ver mais ${restPending.length} pendente${restPending.length !== 1 ? 's' : ''}`}
                      </button>
                      {pendingOpen && restPending.map(renderCard)}
                    </>
                  )}
                  {mostRecentApproved && renderCard(mostRecentApproved)}
                  {restApproved.length > 0 && (
                    <>
                      <button
                        onClick={() => toggleApprovedGroup(group.id)}
                        className="w-full px-4 py-2 flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 bg-slate-50 rounded-xl hover:text-slate-600 hover:bg-slate-100 transition-all"
                      >
                        {approvedOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        {approvedOpen ? 'Mostrar menos' : `Ver mais ${restApproved.length} com OK dado`}
                      </button>
                      {approvedOpen && restApproved.map(renderCard)}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
