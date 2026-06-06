import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronUp, AlertCircle, Trash2, RotateCcw } from 'lucide-react';
import TimeTextInput from '../components/common/TimeTextInput';

export default function SimpleReportView({ draftData, handleTimeChange, handleDeleteDay, handleRevertDay, draftTotal, originalTotal, reportJustification, setReportJustification, handlePrecisionConfirm, goToView, clientData, t }) {
    const [expandedWorkers, setExpandedWorkers] = useState(() => draftData.map(w => w.id));
    const [showAllDays, setShowAllDays] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleWorker = (id) => setExpandedWorkers(prev =>
        prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );

    const diff = parseFloat((draftTotal - originalTotal).toFixed(2));
    const hasDiff = diff !== 0;

    const origEntry = (d) => d.entry === '--:--' ? '' : (d.entry || '');
    const origExit = (d) => d.exit === '--:--' ? '' : (d.exit || '');

    const isDeleted = (d) => {
        const hasOrig = !!(origEntry(d) || origExit(d));
        return hasOrig && !d.editedEntry && !d.editedExit;
    };

    const isDayChanged = (d) => {
        return d.editedEntry !== origEntry(d) || d.editedExit !== origExit(d) ||
            d.editedBreakStart !== (d.breakStart || '') || d.editedBreakEnd !== (d.breakEnd || '');
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await handlePrecisionConfirm();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="animate-fade-in max-w-3xl mx-auto mt-6 space-y-5 pb-10">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => goToView('inicio')}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest transition-colors"
                >
                    <ChevronLeft size={16} /> Cancelar
                </button>
                <div className="flex-1">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Reportar Divergência</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{clientData?.period}</p>
                </div>
            </div>

            {/* Totais */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between gap-4">
                <div className="text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Original</p>
                    <p className="text-2xl font-black text-slate-500">{originalTotal}h</p>
                </div>
                <div className="text-slate-300 font-black text-xl">→</div>
                <div className="text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Proposto</p>
                    <p className={`text-2xl font-black ${hasDiff ? 'text-indigo-600' : 'text-slate-500'}`}>{draftTotal}h</p>
                </div>
                {hasDiff && (
                    <div className={`ml-auto px-3 py-1.5 rounded-xl text-xs font-black ${diff > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {diff > 0 ? '+' : ''}{diff}h
                    </div>
                )}
            </div>

            {/* Workers */}
            {draftData.map(worker => {
                const isExpanded = expandedWorkers.includes(worker.id);
                const seeAll = showAllDays[worker.id];
                const visibleDays = worker.dailyRecords.filter(d => seeAll ? true : (d.isVisible || isDayChanged(d)));
                const changedCount = worker.dailyRecords.filter(isDayChanged).length;
                const workerDiff = parseFloat((worker.editedTotalHours - worker.totalHours).toFixed(2));

                return (
                    <div key={worker.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <button
                            onClick={() => toggleWorker(worker.id)}
                            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 font-black text-xs uppercase flex-shrink-0">
                                    {worker.name.charAt(0)}
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-slate-800 text-sm">{worker.name}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{worker.role}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {changedCount > 0 && (
                                    <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">
                                        {changedCount} alt.
                                    </span>
                                )}
                                <div className="text-right">
                                    <p className="text-xs font-black text-slate-500 line-through">{worker.totalHours}h</p>
                                    <p className={`text-sm font-black ${workerDiff !== 0 ? 'text-indigo-600' : 'text-slate-600'}`}>{worker.editedTotalHours}h</p>
                                </div>
                                {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                            </div>
                        </button>

                        {isExpanded && (
                            <div className="border-t border-slate-100">
                                {visibleDays.length === 0 ? (
                                    <p className="px-5 py-4 text-sm text-slate-400 font-bold">Sem registos para este período.</p>
                                ) : (
                                    <div className="divide-y divide-slate-50">
                                        {visibleDays.map(day => {
                                            const deleted = isDeleted(day);
                                            const changed = isDayChanged(day);
                                            const hasOrigData = !!(origEntry(day) || origExit(day));
                                            return (
                                                <div key={day.rawDate} className={`px-5 py-3 ${deleted ? 'bg-rose-50/60' : changed ? 'bg-amber-50/50' : ''}`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className={`text-[10px] font-black uppercase tracking-wide ${deleted ? 'text-rose-400 line-through' : 'text-slate-500'}`}>{day.date}</span>
                                                        <div className="flex items-center gap-2">
                                                            {deleted && <span className="text-[9px] font-black text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">eliminado</span>}
                                                            {!deleted && changed && <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">editado</span>}
                                                            {!deleted && !changed && day.editedHours > 0 && <span className="text-[10px] font-black text-indigo-600">{day.editedHours}h</span>}
                                                            {deleted && handleRevertDay && (
                                                                <button
                                                                    onClick={() => handleRevertDay(worker.id, day.rawDate)}
                                                                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                                    title="Reverter"
                                                                >
                                                                    <RotateCcw size={13} />
                                                                </button>
                                                            )}
                                                            {!deleted && hasOrigData && handleDeleteDay && (
                                                                <button
                                                                    onClick={() => handleDeleteDay(worker.id, day.rawDate)}
                                                                    className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                                    title="Eliminar registo"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {deleted ? (
                                                        <p className="text-[10px] font-bold text-rose-400">
                                                            Era: {origEntry(day) || '--:--'} → {origExit(day) || '--:--'}
                                                            {(day.breakStart || day.breakEnd) && ` · Pausa: ${day.breakStart || '--:--'} – ${day.breakEnd || '--:--'}`}
                                                        </p>
                                                    ) : (
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            {/* Entrada */}
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase">Entrada</span>
                                                                <TimeTextInput
                                                                    value={day.editedEntry || ''}
                                                                    onChange={val => handleTimeChange(worker.id, day.rawDate, 'entry', val)}
                                                                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-700 bg-white focus:ring-1 focus:ring-indigo-400 focus:outline-none w-20"
                                                                />
                                                            </div>
                                                            {/* Saída */}
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase">Saída</span>
                                                                <TimeTextInput
                                                                    value={day.editedExit || ''}
                                                                    onChange={val => handleTimeChange(worker.id, day.rawDate, 'exit', val)}
                                                                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-700 bg-white focus:ring-1 focus:ring-indigo-400 focus:outline-none w-20"
                                                                />
                                                            </div>
                                                            {/* Pausa */}
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase">Pausa</span>
                                                                <TimeTextInput
                                                                    value={day.editedBreakStart || ''}
                                                                    onChange={val => handleTimeChange(worker.id, day.rawDate, 'breakStart', val)}
                                                                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-700 bg-white focus:ring-1 focus:ring-indigo-400 focus:outline-none w-20"
                                                                />
                                                                <span className="text-slate-300 text-xs">–</span>
                                                                <TimeTextInput
                                                                    value={day.editedBreakEnd || ''}
                                                                    onChange={val => handleTimeChange(worker.id, day.rawDate, 'breakEnd', val)}
                                                                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-700 bg-white focus:ring-1 focus:ring-indigo-400 focus:outline-none w-20"
                                                                />
                                                            </div>
                                                            {changed && (
                                                                <span className="ml-auto text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">{day.editedHours}h</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="px-5 py-3 border-t border-slate-50">
                                    <button
                                        onClick={() => setShowAllDays(prev => ({ ...prev, [worker.id]: !seeAll }))}
                                        className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors"
                                    >
                                        {seeAll ? '↑ Ocultar dias sem registo' : '↓ Mostrar todos os dias do mês'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Justificação */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">
                    Justificação <span className="text-rose-400">*</span>
                </label>
                <textarea
                    value={reportJustification}
                    onChange={e => setReportJustification(e.target.value)}
                    placeholder="Descreve brevemente o motivo da divergência..."
                    rows={3}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-300 focus:outline-none resize-none transition-all"
                />
            </div>

            {/* Aviso sem alterações */}
            {!hasDiff && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
                    <p className="text-xs font-bold text-amber-700">Sem alterações de horas. Edita as entradas acima antes de submeter.</p>
                </div>
            )}

            {/* Botões */}
            <div className="flex gap-3 justify-end">
                <button
                    onClick={() => goToView('inicio')}
                    className="px-6 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className={`px-8 py-3 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center gap-2 ${
                        !isSubmitting
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-95'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                >
                    {isSubmitting ? 'A enviar...' : 'Enviar Correção'}
                </button>
            </div>
        </div>
    );
}
