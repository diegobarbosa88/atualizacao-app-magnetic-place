import React from 'react';
import PrecisionReportReview from '../components/correcoes/PrecisionReportReview';

export default function ReverAlteracoesView({ correctionMode, draftData, draftTotal, originalTotal, reportJustification, handlePrecisionConfirm, handleTimeChange, goToView, generateCorrectionMessage, saveToDb, clientData, initialClientId, initialMonth }) {
    if (correctionMode === 'manual') {
        return (
            <PrecisionReportReview
                draftData={draftData}
                originalTotal={originalTotal}
                draftTotal={draftTotal}
                reportJustification={reportJustification}
                onBack={() => goToView('editar_relatorio')}
                onConfirm={handlePrecisionConfirm}
                onEditDay={handleTimeChange}
                onDeleteDay={(workerId, dayDate) => {
                    handleTimeChange(workerId, dayDate, 'entry', '--:--');
                    handleTimeChange(workerId, dayDate, 'exit', '--:--');
                    handleTimeChange(workerId, dayDate, 'breakStart', '--:--');
                    handleTimeChange(workerId, dayDate, 'breakEnd', '--:--');
                }}
                readOnly={true}
                showAllDays={false}
                showAllWorkers={true}
                isReviewMode={true}
                title="Ajuste de Precisão"
                subtitle="Revisão do Reporte"
            />
        );
    }

    const isDayChanged = (d) => {
        const originalEntry = d.entry === '--:--' ? '' : d.entry;
        const originalExit = d.exit === '--:--' ? '' : d.exit;
        return d.editedEntry !== originalEntry || d.editedExit !== originalExit || d.editedBreakStart !== (d.breakStart || '') || d.editedBreakEnd !== (d.breakEnd || '');
    };

    const relevantWorkers = draftData.filter(w => w.dailyRecords.some(d => d.hours > 0 || d.editedHours > 0));

    return (
        <div className="animate-fade-in bg-white rounded-[3rem] shadow-xl border border-slate-100 p-8 md:p-12 max-w-4xl mx-auto mt-8">
            <div className="flex items-center mb-10 pb-6 border-b border-slate-100">
                <h2 className="text-3xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
                    <span className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl">📝</span> Resumo do Reporte
                </h2>
            </div>

            <p className="text-slate-500 font-bold text-sm mb-8">O administrador irá receber o seguinte alerta de correções de horários:</p>

            <div className="bg-slate-50 rounded-3xl border border-slate-200 p-6 md:p-8 mb-10">
                <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-200">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total do Período</span>
                    <div className="flex items-center gap-4 font-black text-2xl">
                        <span className="text-slate-400 line-through decoration-rose-400/50">{originalTotal}h</span>
                        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        <span className="text-indigo-600 bg-indigo-100 px-4 py-1 rounded-xl shadow-sm">{draftTotal}h</span>
                    </div>
                </div>

                <div className="space-y-6">
                    {relevantWorkers.map(w => {
                        const relevantDays = w.dailyRecords.filter(d => d.hours > 0 || d.editedHours > 0);
                        return (
                            <div key={w.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
                                    <span className="font-black text-slate-800">{w.name}</span>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Total Sugerido: <span className="text-indigo-600 text-sm ml-1 bg-indigo-50 px-2 py-1 rounded-lg">{w.editedTotalHours}h</span></span>
                                </div>
                                <div className="space-y-3">
                                    {relevantDays.map(day => {
                                        const changed = isDayChanged(day);
                                        return (
                                            <div key={day.date} className={`flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 rounded-xl gap-3 ${changed ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50 border border-transparent'}`}>
                                                <span className="font-bold text-slate-600 text-[10px] uppercase tracking-wider">{day.date}</span>
                                                <div className={`flex flex-col sm:flex-row items-center gap-3 text-xs px-4 py-2 rounded-lg shadow-sm ${changed ? 'bg-white border border-amber-200' : 'bg-white/50 border border-slate-100'}`}>
                                                    {changed ? (
                                                        <>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-400 font-bold">Turno:</span>
                                                                <span className="text-slate-400 line-through decoration-rose-400">{day.entry} - {day.exit}</span>
                                                                <span className="text-slate-300">→</span>
                                                                <span className="text-amber-600 font-black">{day.editedEntry} - {day.editedExit}</span>
                                                            </div>
                                                            <div className="hidden sm:block w-px h-4 bg-slate-200"></div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-400 font-bold">Pausa:</span>
                                                                <span className="text-slate-400 line-through decoration-rose-400">{day.breakStart || '--:--'} - {day.breakEnd || '--:--'}</span>
                                                                <span className="text-slate-300">→</span>
                                                                <span className="text-amber-600 font-black">{day.editedBreakStart || '--:--'} - {day.editedBreakEnd || '--:--'}</span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-400 font-bold">Turno:</span>
                                                                <span className="text-slate-600 font-black">{day.entry} - {day.exit}</span>
                                                            </div>
                                                            <div className="hidden sm:block w-px h-4 bg-slate-100"></div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-400 font-bold">Pausa:</span>
                                                                <span className="text-slate-600 font-black">{day.breakStart || '--:--'} - {day.breakEnd || '--:--'}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                    <span className={`sm:ml-2 px-2 py-1 rounded-md font-black ${changed ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{day.editedHours}h</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {reportJustification && (
                    <div className="mt-8 pt-6 border-t border-slate-200">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Comentário Adicional</p>
                        <p className="text-sm text-slate-700 italic font-medium bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">"{reportJustification}"</p>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-4">
                <button onClick={() => goToView('editar_relatorio')} className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 rounded-xl transition-all shadow-sm">Voltar</button>
                <button onClick={async () => {
                    const correcoesTexto = generateCorrectionMessage(true);
                    const fullMonthSnapshot = draftData;
                    const notifId = "notif_" + Date.now();
                    const newNotif = {
                        id: notifId,
                        title: `Divergência Reportada: ${clientData.name}`,
                        message: correcoesTexto,
                        type: 'warning',
                        target_type: 'admin',
                        target_client_id: initialClientId,
                        target_worker_ids: [],
                        payload: { changes: fullMonthSnapshot, isFullMonth: true, month: initialMonth, reportType: 'quick' },
                        is_dismissible: true,
                        is_active: true,
                        created_at: new Date().toISOString()
                    };
                    const correcaoId = "correcao_" + Date.now();
                    const correcaoRecord = {
                        id: correcaoId,
                        title: `Divergência Reportada: ${clientData.name}`,
                        message: correcoesTexto,
                        status: 'pending',
                        client_id: initialClientId,
                        month: initialMonth,
                        payload: { changes: fullMonthSnapshot, isFullMonth: true, reportType: 'quick' },
                        created_at: new Date().toISOString()
                    };
                    await saveToDb('corrections', correcaoId, correcaoRecord);
                    const newNotifWithCorrecaoId = { ...newNotif, payload: { ...newNotif.payload, correcao_id: correcaoId } };
                    await saveToDb('app_notifications', notifId, newNotifWithCorrecaoId);
                    goToView('sucesso_reporte');
                }} className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xl shadow-indigo-600/30 active:scale-95">Confirmar e Enviar</button>
            </div>
        </div>
    );
}
