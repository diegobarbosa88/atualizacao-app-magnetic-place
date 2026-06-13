import React from 'react';
import { Sparkles, X, CheckCircle } from 'lucide-react';

export default function CounterProposalCard({ notif, handleAcceptContestation, handleDismissNotif, handleApproveCreationRequest, handleRejectCreationRequest, t, goToView }) {
    return (
        <div className="relative overflow-hidden bg-white border border-indigo-100 rounded-[2rem] shadow-xl shadow-indigo-100/30 animate-fade-in">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
            <div className="p-6 md:p-8">
                <div className="flex items-start gap-4 md:gap-6">
                    <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 shrink-0 hidden sm:block">
                        <Sparkles size={24} />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{notif.title}</h3>
                            <button onClick={() => handleDismissNotif(notif.id)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap mb-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                            {notif.payload?.type === 'counter_proposal' && notif.payload?.changes ? (
                                <div className="space-y-6">
                                    {notif.payload.reason && (
                                        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                                            <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">{t('admin_justification')}</p>
                                            <p className="text-xs text-amber-800 font-medium italic">"{notif.payload.reason}"</p>
                                        </div>
                                    )}
                                    {notif.payload.changes.map((worker, wIdx) => (
                                        <div key={wIdx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-50">
                                                <span className="font-black text-slate-800 text-sm uppercase">{worker.name}</span>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[7px] text-slate-400 font-bold uppercase">Original</span>
                                                        <span className="text-[10px] text-slate-500 font-black">{worker.totalHours || worker.originalTotal}h</span>
                                                    </div>
                                                    <div className="text-slate-300">→</div>
                                                    <div className="flex flex-col items-center bg-indigo-50 px-2 py-1 rounded-lg">
                                                        <span className="text-[7px] text-indigo-500 font-bold uppercase">Admin</span>
                                                        <span className="text-xs text-indigo-700 font-black">{worker.editedTotalHours}h</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {worker.dailyRecords.map((day, dIdx) => {
                                                    const isModified = !!(day.adminEntry || day.adminExit);
                                                    if (!isModified) return null;
                                                    return (
                                                        <div key={dIdx} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{day.date || day.dateLabel}</span>
                                                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm text-[10px]">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-slate-400 font-bold">Orig:</span>
                                                                    <span className="text-slate-500 font-black">{day.originalShift || (day.entry + '-' + day.exit)}</span>
                                                                </div>
                                                                <div className="w-px h-3 bg-slate-100"></div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-indigo-600 font-bold uppercase text-[8px]">Admin:</span>
                                                                    <span className="text-indigo-700 font-black">{(day.adminEntry || day.editedEntry)}-{(day.adminExit || day.editedExit)}</span>
                                                                </div>
                                                                <div className="w-px h-3 bg-slate-100"></div>
                                                                <span className="text-indigo-700 font-black bg-indigo-50 px-1.5 py-0.5 rounded-md">{day.adminHours || day.editedHours}h</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : notif.message.includes('CONTRA-PROPOSTA') || notif.message.includes('CONTESTAÇÃO') ? (
                                <div className="space-y-4">
                                    {notif.message.split('\n').filter(line => line.trim()).map((line, i) => {
                                        if (line.includes('👤') && line.includes('TRABALHADOR')) {
                                            return <p key={i} className="text-base font-black text-indigo-700 mt-2">{line}</p>;
                                        }
                                        if (line.match(/^ {3}📋/)) {
                                            return <p key={i} className="text-xs font-bold text-indigo-600 mt-3">{line}</p>;
                                        }
                                        if (line.match(/^ {3}[✓•]/)) {
                                            const match = line.match(/^ {3}[✓•]\s+(.+?):\s+(.+?)\s*\|\s*Pausa:\s*(.+?)\s*\|\s*([\d.]+)h/);
                                            if (match) {
                                                return (
                                                    <div key={i} className="flex items-center gap-2 ml-2 py-1 px-2 bg-slate-100 rounded text-xs">
                                                        <span className="text-slate-400">✓</span>
                                                        <span className="font-medium text-slate-600">{match[1]}</span>
                                                        <span className="text-slate-400">|</span>
                                                        <span className="text-slate-500">{match[2]}</span>
                                                        <span className="text-slate-400">|</span>
                                                        <span className="font-bold text-slate-600">{match[3]}h</span>
                                                    </div>
                                                );
                                            }
                                            return <p key={i} className="text-xs text-slate-600 ml-2">{line}</p>;
                                        }
                                        if (line.match(/^ {3}✏️/) || line.match(/\(ALTERADO\)/)) {
                                            return <p key={i} className="text-xs font-bold text-amber-600 mt-3">{line}</p>;
                                        }
                                        if (line.match(/^ {3}📊/) || line.match(/^ {3}📈/)) {
                                            const match = line.match(/(Subtotal|Total do Período):\s*([\d.]+)h\s*➔\s*([\d.]+)h\s*➔\s*([\d.]+)h/);
                                            const orig = match ? match[2] : '';
                                            const sugieren = match ? match[3] : '';
                                            const contra = match ? match[4] : '';
                                            return (
                                                <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-amber-200 mt-2 shadow-sm">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] text-slate-400 font-bold uppercase">Original</span>
                                                        <span className="text-slate-500 font-black">{orig}h</span>
                                                    </div>
                                                    <div className="text-slate-300 font-bold">→</div>
                                                    <div className="flex flex-col items-center bg-amber-50 px-3 py-1 rounded-lg border border-amber-100">
                                                        <span className="text-[8px] text-amber-500 font-bold uppercase">Cliente</span>
                                                        <span className="text-amber-600 font-black">{sugieren}h</span>
                                                    </div>
                                                    <div className="text-slate-300 font-bold">→</div>
                                                    <div className="flex flex-col items-center bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                                                        <span className="text-[8px] text-indigo-500 font-bold uppercase">Admin</span>
                                                        <span className="text-indigo-700 font-black">{contra}h</span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        if (line.match(/^ {3}Total/)) {
                                            const match = line.match(/Total do Período:\s*([\d.]+)h\s*➔\s*([\d.]+)h\s*➔\s*([\d.]+)h/);
                                            const orig = match ? match[1] : '';
                                            const sugieren = match ? match[2] : '';
                                            const contra = match ? match[3] : '';
                                            return (
                                                <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-indigo-100 mt-2 shadow-sm">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] text-slate-400 font-bold uppercase">Original</span>
                                                        <span className="text-slate-500 font-black">{orig}h</span>
                                                    </div>
                                                    <div className="text-slate-300 font-bold">→</div>
                                                    <div className="flex flex-col items-center bg-amber-50 px-3 py-1 rounded-lg border border-amber-100">
                                                        <span className="text-[8px] text-amber-500 font-bold uppercase">Cliente</span>
                                                        <span className="text-amber-600 font-black">{sugieren}h</span>
                                                    </div>
                                                    <div className="text-slate-300 font-bold">→</div>
                                                    <div className="flex flex-col items-center bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                                                        <span className="text-[8px] text-indigo-500 font-bold uppercase">Admin</span>
                                                        <span className="text-indigo-700 font-black">{contra}h</span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        if (line.match(/^ {6}/) && line.includes(':')) {
                                            const labelMatch = line.match(/^\s*(.+?):\s*(.+)$/);
                                            if (labelMatch) {
                                                const [, label, value] = labelMatch;
                                                let valueClass = 'text-xs text-slate-700 font-mono';
                                                if (label.includes('Original')) valueClass = 'text-xs text-slate-500 font-mono';
                                                else if (label.includes('Cliente')) valueClass = 'text-xs text-amber-600 font-mono font-bold';
                                                else if (label.includes('Admin')) valueClass = 'text-xs text-indigo-600 font-mono font-bold';
                                                return (
                                                    <div key={i} className="flex items-center ml-4 gap-2 py-0.5">
                                                        <span className="text-[10px] text-slate-500">{label}:</span>
                                                        <span className={valueClass}>{value}</span>
                                                    </div>
                                                );
                                            }
                                        }
                                        if (line.includes('━━━━━━━━━━━━━━━━') || line.includes('────────────────')) {
                                            return <div key={i} className="border-t border-slate-200 my-2"></div>;
                                        }
                                        if (line.includes('📊') || line.includes('📋') || line.includes('📅')) {
                                            return <p key={i} className="text-xs font-bold text-slate-600 mt-3">{line}</p>;
                                        }
                                        if (line.includes('⏰') || line.includes('☕') || line.includes('⏱️')) {
                                            return <p key={i} className="text-xs font-bold text-indigo-600 mt-2">{line}</p>;
                                        }
                                        return <p key={i} className="text-xs text-slate-600">{line}</p>;
                                    })}
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap font-sans">{notif.message}</pre>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            {notif.payload?.type === 'correcoes_aplicadas' || notif.payload?.type === 'correcao_admin' ? (
                                <>
                                    <button
                                        onClick={() => {
                                            handleDismissNotif(notif.id);
                                            goToView('inicio');
                                            const scrollToSignature = () => {
                                                const el = document.getElementById('signature-canvas-area');
                                                if (el) {
                                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                    const canvas = document.querySelector('canvas');
                                                    if (canvas) canvas.focus();
                                                } else {
                                                    setTimeout(scrollToSignature, 150);
                                                }
                                            };
                                            setTimeout(scrollToSignature, 150);
                                        }}
                                        className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 flex items-center gap-2"
                                    >
                                        <CheckCircle size={14} /> {t('validate_hours')}
                                    </button>
                                    <button
                                        onClick={() => handleDismissNotif(notif.id)}
                                        className="bg-slate-100 text-slate-500 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                                    >
                                        {t('close')}
                                    </button>
                                </>
                            ) : notif.payload?.type === 'counter_proposal' ? (
                                <>
                                    <button
                                        onClick={() => handleAcceptContestation(notif)}
                                        className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 flex items-center gap-2"
                                    >
                                        <CheckCircle size={14} /> {t('accept_counter')}
                                    </button>
                                    <button
                                        onClick={() => handleDismissNotif(notif.id)}
                                        className="bg-slate-100 text-slate-500 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                                    >
                                        {t('ignore_notif')}
                                    </button>
                                </>
                            ) : notif.payload?.kind === 'submitted' && notif.payload?.correction_id ? (
                                <>
                                    <button
                                        onClick={() => handleApproveCreationRequest(notif)}
                                        className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 flex items-center gap-2"
                                    >
                                        <CheckCircle size={14} /> Aprovar
                                    </button>
                                    <button
                                        onClick={() => handleRejectCreationRequest(notif)}
                                        className="bg-rose-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-95"
                                    >
                                        Rejeitar
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => handleDismissNotif(notif.id)}
                                    className="bg-slate-100 text-slate-500 px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                                >
                                    {t('close')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
