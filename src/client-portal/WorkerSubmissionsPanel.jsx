import React from 'react';
import { ChevronDown, X, Clock } from 'lucide-react';

const calculateHoursDiff = (entry, exit, breakStart, breakEnd) => {
    if (!entry || !exit || !entry.includes(':') || !exit.includes(':')) return 0;
    const [eh, em] = entry.split(':').map(n => parseInt(n, 10) || 0);
    const [xh, xm] = exit.split(':').map(n => parseInt(n, 10) || 0);
    let diffMins = (xh * 60 + xm) - (eh * 60 + em);
    if (diffMins < 0) diffMins += 24 * 60;
    if (breakStart && breakEnd && breakStart !== '--:--' && breakEnd !== '--:--') {
        const [bsh, bsm] = breakStart.split(':').map(Number);
        const [beh, bem] = breakEnd.split(':').map(Number);
        let bDiff = (beh * 60 + bem) - (bsh * 60 + bsm);
        if (bDiff < 0) bDiff += 24 * 60;
        diffMins -= bDiff;
    }
    return Number(Math.max(0, diffMins / 60).toFixed(2));
};

export default function WorkerSubmissionsPanel({ workerSubmissionsResolved, workerSubmissionsPending, corrections, correctionItems, workers, expandedCards, setExpandedCards, handleDismissNotif, handleApproveCreationRequest, handleRejectCreationRequest }) {
    return (
        <>
            {workerSubmissionsResolved.length > 0 && (
                <div className="mb-8 space-y-3">
                    {workerSubmissionsResolved.map(notif => {
                        const correctionId = notif.payload?.correction_id;
                        const correction = corrections?.find(c => c.id === correctionId);
                        const items = (correctionItems || []).filter(it => it.correction_id === correctionId);
                        const isApproved = correction?.status === 'applied';
                        const isExpanded = expandedCards[notif.id];
                        return (
                            <div key={notif.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                                <button
                                    onClick={() => setExpandedCards(prev => ({ ...prev, [notif.id]: !prev[notif.id] }))}
                                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${isApproved ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                            <Clock size={16} />
                                        </div>
                                        <div className="text-left">
                                            <span className="font-bold text-slate-700 text-sm">{notif.title}</span>
                                            <span className="text-xs text-slate-400 ml-2">({items.length} pedido{items.length > 1 ? 's' : ''})</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl ${isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {isApproved ? '✅ Aprovado' : '❌ Rejeitado'}
                                        </span>
                                        <button onClick={(e) => { e.stopPropagation(); handleDismissNotif(notif.id); }} className="p-1 text-slate-400 hover:text-slate-600">
                                            <X size={16} />
                                        </button>
                                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-slate-100">
                                        <div className="pt-4 space-y-2">
                                            {items.map(item => {
                                                const workerObj = workers.find(w => String(w.id) === String(item.worker_id));
                                                const beforeHours = item.before?.startTime ? calculateHoursDiff(item.before.startTime, item.before.endTime, item.before.breakStart, item.before.breakEnd) : null;
                                                const proposedHours = item.proposed?.startTime ? calculateHoursDiff(item.proposed.startTime, item.proposed.endTime, item.proposed.breakStart, item.proposed.breakEnd) : null;
                                                return (
                                                    <div key={item.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="font-bold text-slate-600 text-xs">{item.worker_name || workerObj?.name || 'Trabalhador'}</span>
                                                            <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-lg">{item.date}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4 text-xs">
                                                            <div>
                                                                <span className="text-slate-400 font-bold uppercase text-[9px]">Original</span>
                                                                <p className="text-slate-500">{item.before?.startTime && item.before?.endTime ? `${item.before.startTime}-${item.before.endTime}` : 'Sem registo'}</p>
                                                                {beforeHours !== null && <span className="text-[10px] text-slate-400">({beforeHours}h)</span>}
                                                            </div>
                                                            {item.proposed?.startTime && (
                                                                <>
                                                                    <div className="text-emerald-600 font-bold">→</div>
                                                                    <div className="bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                                                        <span className="text-[9px] text-emerald-600 font-bold uppercase">Proposto</span>
                                                                        <p className="text-emerald-700 font-bold">{`${item.proposed.startTime}-${item.proposed.endTime}`}</p>
                                                                        {proposedHours !== null && <span className="text-[10px] text-emerald-600">({proposedHours}h)</span>}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {workerSubmissionsPending.length > 0 && (
                <div className="mb-8 space-y-3">
                    {workerSubmissionsPending.map(notif => {
                        const correctionId = notif.payload?.correction_id;
                        const items = (correctionItems || []).filter(it => it.correction_id === correctionId);
                        return (
                            <div key={notif.id} className="bg-white border border-emerald-200 rounded-2xl shadow-sm overflow-hidden">
                                <button
                                    onClick={() => setExpandedCards(prev => ({ ...prev, [notif.id]: !prev[notif.id] }))}
                                    className="w-full flex items-center justify-between p-4 hover:bg-emerald-50/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                                            <Clock size={16} />
                                        </div>
                                        <div className="text-left">
                                            <span className="font-bold text-slate-700 text-sm">{notif.title}</span>
                                            <span className="text-xs text-slate-400 ml-2">({items.length} pedido{items.length > 1 ? 's' : ''})</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleApproveCreationRequest(notif); }}
                                            className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                                        >
                                            Aprovar
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRejectCreationRequest(notif); }}
                                            className="bg-rose-500 text-white px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-colors"
                                        >
                                            Rejeitar
                                        </button>
                                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${expandedCards[notif.id] ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>
                                {expandedCards[notif.id] && (
                                    <div className="px-4 pb-4 border-t border-emerald-100">
                                        <div className="pt-4 space-y-2">
                                            {items.map(item => {
                                                const workerObj = workers.find(w => String(w.id) === String(item.worker_id));
                                                const beforeHours = item.before?.startTime ? calculateHoursDiff(item.before.startTime, item.before.endTime, item.before.breakStart, item.before.breakEnd) : null;
                                                const proposedHours = item.proposed?.startTime ? calculateHoursDiff(item.proposed.startTime, item.proposed.endTime, item.proposed.breakStart, item.proposed.breakEnd) : null;
                                                const diffHours = (proposedHours !== null && beforeHours !== null) ? (proposedHours - beforeHours).toFixed(2) : null;
                                                const isPositive = diffHours !== null && parseFloat(diffHours) >= 0;
                                                return (
                                                    <div key={item.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="font-bold text-slate-600 text-xs">{item.worker_name || workerObj?.name || 'Trabalhador'}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{item.date}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4 text-xs">
                                                            <div>
                                                                <span className="text-slate-400 font-bold uppercase text-[9px]">Original</span>
                                                                <p className="text-slate-500">{item.before?.startTime && item.before?.endTime ? `${item.before.startTime}-${item.before.endTime}` : 'Sem registo'}</p>
                                                                {beforeHours !== null && <span className="text-[10px] text-slate-400">({beforeHours}h)</span>}
                                                            </div>
                                                            <div className="text-emerald-600 font-bold">→</div>
                                                            <div className="bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                                                <span className="text-[9px] text-emerald-600 font-bold uppercase">Proposto</span>
                                                                <p className="text-emerald-700 font-bold">{item.proposed?.startTime && item.proposed?.endTime ? `${item.proposed.startTime}-${item.proposed.endTime}` : 'N/A'}</p>
                                                                {proposedHours !== null && <span className="text-[10px] text-emerald-600">({proposedHours}h)</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}
