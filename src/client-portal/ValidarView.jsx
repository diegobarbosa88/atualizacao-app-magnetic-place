import React from 'react';
import { Download, ChevronDown, ChevronLeft, CheckCircle, Calendar } from 'lucide-react';
import { cropSignatureCanvas } from '../utils/signatureCanvas';
import { sendValidationEmail } from '../utils/emailUtils';

export default function ValidarView({ clientObj, clientData, clientSession, t, originalWorkersData, originalTotal, approvalData, isApproved, printingWorker, expandedWorkers, toggleWorkerDetails, handleDownloadAll, handleDownloadIndividual, canvasRef, hasSignature, startDrawing, draw, stopDrawing, clearCanvas, signatureSaved, setSignatureSaved, effectiveClientId, selectedMonth, logs, renderReport, saveToDb, clientIp, companySignature, goToView, startReport }) {
    return (
        <div className="animate-fade-in space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-end w-full gap-8 mb-10 pb-8 border-b border-zinc-200">
                <div className="flex-1">
                    <div className="flex items-center gap-4 mb-5">
                        <span className="px-2.5 py-1 rounded-md bg-zinc-900 text-zinc-50 text-[10px] font-bold uppercase tracking-widest shadow-sm">
                            {t('client_panel')}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-zinc-300 hidden sm:block" />
                        <div className="flex items-center gap-1.5 text-sm text-zinc-500 font-medium">
                            <Calendar size={15} />
                            <span className="capitalize">{new Date().toLocaleDateString(t('locale'), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                    </div>
                    <div className="text-4xl md:text-4xl font-semibold text-zinc-900 tracking-tight">
                        <span className="text-zinc-400 font-light">{t('hello')},</span> {clientObj.name}
                    </div>
                    <div className="mt-3 text-zinc-500 text-xs leading-relaxed max-w-md">
                        {t('dashboard_desc')}
                    </div>
                </div>
            </div>

            {clientSession && (
                <button onClick={() => window.location.href = window.location.origin + window.location.pathname} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-black text-[10px] uppercase tracking-widest transition-all">
                    <ChevronLeft size={16} /> {t('back_dashboard')}
                </button>
            )}

            <section className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden p-6 md:p-10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('selected_period')}</h2>
                    <p className="text-3xl font-black text-slate-800 mt-2 uppercase">{clientData.period || '—'}</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 md:min-w-[200px] text-center shadow-inner">
                    <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest mb-1">{t('total_hours')}</p>
                    <p className="text-4xl font-black text-indigo-700">{originalTotal}h</p>
                </div>
            </section>

            <section className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h3 className="font-black text-slate-800 text-2xl uppercase tracking-tighter">{t('hours_detail')}</h3>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 block">{t('detailed_summary')}</span>
                    </div>
                    {originalWorkersData.length > 1 && (
                        <button onClick={handleDownloadAll} className="w-full md:w-auto inline-flex items-center justify-center gap-3 bg-emerald-600 border border-emerald-500 hover:bg-emerald-700 text-white px-6 py-4 rounded-2xl shadow-sm transition-all font-black text-xs uppercase tracking-widest active:scale-95">
                            <Download size={18} />
                            {t('download_all')}
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-black border-b border-slate-100">
                                <th className="p-6">{t('worker_col')}</th>
                                <th className="p-6 text-right">{t('hours_col')}</th>
                                <th className="p-6 text-right w-24">{t('action_col')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {originalWorkersData.map(worker => {
                                const isExpanded = expandedWorkers.includes(worker.id);
                                return (
                                    <React.Fragment key={worker.id}>
                                        <tr className={`transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`} onClick={() => toggleWorkerDetails(worker.id)}>
                                            <td className="p-6">
                                                <p className="font-black text-slate-800">{worker.name}</p>
                                                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">{worker.role}</p>
                                            </td>
                                            <td className="p-6 font-black text-lg text-slate-700 text-right">{worker.totalHours}h</td>
                                            <td className="p-6">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={(e) => handleDownloadIndividual(e, worker)} className="p-3 text-emerald-600 hover:text-emerald-800 transition-colors rounded-xl hover:bg-emerald-100" title="Baixar Relatório PDF">
                                                        <Download className="w-5 h-5" />
                                                    </button>
                                                    <button className="p-3 text-indigo-600 hover:text-indigo-800 transition-colors rounded-xl hover:bg-indigo-100">
                                                        <ChevronDown className={`w-6 h-6 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-50 border-b-2 border-indigo-100 shadow-inner">
                                                <td colSpan="3" className="p-0">
                                                    <div className="p-6">
                                                        <div id={`report-worker-${worker.id}`} className="overflow-hidden bg-white">
                                                            {renderReport(worker.id, true, logs, effectiveClientId, selectedMonth)}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {originalWorkersData.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="p-8 text-center text-slate-500 font-bold">
                                        {t('no_workers')} {clientData.period}.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {!printingWorker && (
                <section id="validar-horarios-section" className="approval-section bg-white rounded-[3rem] shadow-xl border border-slate-100 p-8 md:p-12 animate-in slide-in-from-bottom-8 duration-500">
                    {isApproved ? (
                        <div className="text-center py-6">
                            <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-100 shadow-lg shadow-emerald-200/50">
                                <CheckCircle size={48} />
                            </div>
                            <h3 className="font-black text-3xl text-slate-800 uppercase tracking-tighter mb-4">{t('report_validated')}</h3>
                            <div className="text-center mb-10">
                                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                    {t('already_validated')}
                                </p>
                                <p className="text-emerald-600 text-base font-bold mt-2">
                                    {new Date(approvalData?.created_at).toLocaleString('pt-PT')}
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-lg mx-auto">
                                <button
                                    onClick={handleDownloadAll}
                                    className="w-full sm:flex-1 px-8 py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-200 active:scale-95 flex items-center justify-center gap-3"
                                >
                                    <Download size={20} /> {t('download_signed')}
                                </button>
                            </div>
                            <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center gap-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('editing_disabled')}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-10">
                                <h3 className="font-black text-2xl text-slate-800 uppercase tracking-tighter mb-2">{t('client_approval')}</h3>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{t('sign_to_validate')} {originalTotal} {t('hours_col').toLowerCase()}.</p>
                            </div>

                            <div id="signature-canvas-area" className="relative w-full max-w-2xl mx-auto bg-slate-50 border-2 border-dashed border-slate-300 rounded-[2rem] overflow-hidden mb-6 shadow-inner">
                                <canvas ref={canvasRef} className="w-full cursor-crosshair touch-none" style={{ touchAction: 'none' }} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                                {!hasSignature && <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 font-black text-2xl uppercase tracking-wider opacity-60">{t('sign_here')}</div>}
                            </div>

                            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-2xl mx-auto">
                                <button onClick={clearCanvas} className="w-full sm:w-auto px-6 py-4 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">{t('clear_canvas')}</button>

                                <button onClick={() => {
                                    const canvas = canvasRef.current;
                                    const base64Image = cropSignatureCanvas(canvas);
                                    setSignatureSaved(base64Image);
                                    const safeClientId = String(effectiveClientId || 'unknown');
                                    const safeMonth = String(selectedMonth || 'unknown');
                                    const id = "c_appr_" + safeClientId + "_" + safeMonth;

                                    const approvalPayload = {
                                        id,
                                        client_id: effectiveClientId,
                                        month: selectedMonth,
                                        signature_base64: base64Image,
                                        approved_total_hours: originalTotal,
                                        has_corrections: false,
                                        created_at: new Date().toISOString(),
                                        client_ip: clientIp || 'N/D',
                                        client_ua: navigator.userAgent || 'N/D'
                                    };

                                    saveToDb('client_approvals', id, approvalPayload)
                                        .then(() => {
                                            const notifId = "notif_" + Date.now();
                                            const newNotif = {
                                                id: notifId,
                                                title: `✅ Validação Recebida: ${clientData.name}`,
                                                message: `O cliente aprovou e assinou o relatório de ${originalTotal}h referente a ${clientData.period}.`,
                                                type: 'success',
                                                target_type: 'specific',
                                                target_worker_ids: [],
                                                is_dismissible: true,
                                                is_active: true,
                                                created_at: new Date().toISOString()
                                            };
                                            return saveToDb('app_notifications', notifId, newNotif);
                                        })
                                        .then(() => {
                                            if (companySignature?.responsibleEmail) {
                                                sendValidationEmail({
                                                    to: companySignature.responsibleEmail,
                                                    name: companySignature.responsibleName || 'Admin',
                                                    title: `Cliente validou o relatório: ${clientData.name}`,
                                                    message: `${clientData.name} aprovou e assinou o relatório de ${originalTotal}h referente a ${clientData.period}.`,
                                                    link: `${window.location.origin}/?view=admin`,
                                                }).catch(() => {});
                                            }
                                            goToView('sucesso_assinatura');
                                        })
                                        .catch(err => {
                                            console.error("Erro ao salvar validação:", err);
                                            alert("Erro ao guardar a validação. Por favor, tente novamente.");
                                        });
                                }} disabled={!hasSignature || originalTotal === 0} className={`w-full sm:flex-1 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl flex justify-center ${hasSignature && originalTotal > 0 ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                                    {t('validate_approve')}
                                </button>
                            </div>

                            <div className="mt-12 pt-8 border-t border-slate-100 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('found_divergence')}</p>
                                <button onClick={startReport} className="inline-flex items-center gap-3 text-white bg-slate-900 hover:bg-slate-800 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50" disabled={originalTotal === 0}>
                                    {t('edit_report')}
                                </button>
                            </div>
                        </>
                    )}
                </section>
            )}
        </div>
    );
}
