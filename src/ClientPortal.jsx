import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from './context/AppContext';
import { TRANSLATIONS } from './client-portal/translations';
import LoginView from './client-portal/LoginView';
import ClientPortalHeader from './client-portal/ClientPortalHeader';
import { useClientNotifications } from './client-portal/useClientNotifications';
import { useDraftReport } from './client-portal/useDraftReport';
import { useSignatureCanvas } from './client-portal/useSignatureCanvas';
import DashboardView from './client-portal/DashboardView';
import ValidarView from './client-portal/ValidarView';
import SimpleReportView from './client-portal/SimpleReportView';
import CounterProposalCard from './client-portal/CounterProposalCard';
import WorkerSubmissionsPanel from './client-portal/WorkerSubmissionsPanel';
import WorkerRequestsView from './client-portal/WorkerRequestsView';
import LogManagementModal from './client-portal/LogManagementModal';
import { CLIENT_REQUESTS_CUTOFF } from './utils/clientPortalApi';

const calculateHoursDiff = (entry, exit, breakStart, breakEnd) => {
    if (!entry || !exit || !entry.includes(':') || !exit.includes(':')) return 0;
    const [eh, em] = entry.split(':').map(n => parseInt(n, 10) || 0);
    const [xh, xm] = exit.split(':').map(n => parseInt(n, 10) || 0);
    let diffMins = (xh * 60 + xm) - (eh * 60 + em);
    if (diffMins < 0) diffMins += 24 * 60;
    if (breakStart && breakEnd && breakStart !== '--:--' && breakEnd !== '--:--') {
        const [bsh, bsm] = breakStart.split(':').map(Number);
        const [beh, bem] = breakEnd.split(':').map(Number);
        let breakDiffMins = (beh * 60 + bem) - (bsh * 60 + bsm);
        if (breakDiffMins < 0) breakDiffMins += 24 * 60;
        diffMins -= breakDiffMins;
    }
    return Number(Math.max(0, diffMins / 60).toFixed(2));
};

export default function ClientPortal({ clients, workers, logs: initialLogs, saveToDb, initialClientId, initialMonth, initialTokenClientId, renderReport, systemSettings, appNotifications, clientApprovals, supabase }) {
    const { companySignature, corrections, correctionItems } = useApp();
    const [logs, setLogs] = useState(initialLogs || []);
    const [currentView, setCurrentView] = useState('inicio');
    const [expandedWorkers, setExpandedWorkers] = useState([]);
    const [isZipping, setIsZipping] = useState(false);
    const [printingWorker, setPrintingWorker] = useState(null);
    const [clientIp, setClientIp] = useState('Localhost');
    const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState(null);
    const [now, setNow] = useState(() => new Date());
    const [todayLogs, setTodayLogs] = useState([]);
    const [expandedLogLocations, setExpandedLogLocations] = useState(new Set());
    const [expandedHistoryDays, setExpandedHistoryDays] = useState(new Set());
    const [calSelectedDay, setCalSelectedDay] = useState(null);
    const [isWorkersModalOpen, setIsWorkersModalOpen] = useState(false);
    const [rotatingWorkerIdx, setRotatingWorkerIdx] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setRotatingWorkerIdx(i => i + 1), 4000);
        return () => clearInterval(timer);
    }, []);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const [logModalWorker, setLogModalWorker] = useState(null); // worker object para o LogManagementModal

    const [clientSession, setClientSession] = useState(() => {
        try {
            const saved = localStorage.getItem('magnetic_client_session');
            if (!saved) return null;
            const parsed = JSON.parse(saved);
            if (!parsed || Date.now() > parsed.expiry) {
                localStorage.removeItem('magnetic_client_session');
                return null;
            }
            return parsed;
        } catch { return null; }
    });
    const [loginNif, setLoginNif] = useState('');
    const [loginEmail, setLoginEmail] = useState('');
    const [loginError, setLoginError] = useState('');
    const [lang, setLang] = useState(() => localStorage.getItem('magnetic_lang') || 'pt');
    const t = (key) => (TRANSLATIONS[lang] || TRANSLATIONS.pt)[key] || key;

    // A transformação 'c5' → 'client_5' só se aplica ao ID vindo do URL (?client=c5).
    // IDs da sessão e do token já são os IDs reais da DB — não transformar.
    const urlOnlyId = initialClientId?.startsWith('c') && !initialClientId.startsWith('client_')
        ? 'client_' + initialClientId.slice(1)
        : initialClientId;
    const effectiveClientId = initialTokenClientId || clientSession?.clientId || urlOnlyId || null;

    const todayStr = new Date().toLocaleDateString('en-CA');
    const activeNow = logs.filter(l => String(l.clientId) === String(effectiveClientId) && l.date === todayStr && l.startTime && !l.endTime);

    const changeLang = (l) => {
        setLang(l);
        localStorage.setItem('magnetic_lang', l);
    };

    const handleLogin = () => {
        if (clients.length === 0) { setLoginError('A carregar dados, por favor aguarde...'); return; }
        const nifNorm = (loginNif || '').replace(/[\s.\-]/g, '').trim();
        const emailNorm = (loginEmail || '').toLowerCase().trim();
        const client = clients.find(c => {
            const nifMatch = nifNorm && (c.nif || '').replace(/[\s.\-]/g, '').trim() === nifNorm;
            const emailMatch = !emailNorm || (c.email || '').toLowerCase().trim() === emailNorm;
            return nifMatch && emailMatch;
        });
        if (!client) { setLoginError('NIF ou email incorretos.'); return; }
        const session = { clientId: client.id, name: client.name, expiry: Date.now() + 30 * 24 * 60 * 60 * 1000 };
        localStorage.setItem('magnetic_client_session', JSON.stringify(session));
        setClientSession(session);
        const months = [...new Set(
            (initialLogs || [])
                .filter(l => String(l.clientId) === String(client.id)
                    && calculateHoursDiff(l.startTime, l.endTime, l.breakStart, l.breakEnd) > 0
                    && l.date && /^\d{4}-\d{2}/.test(l.date))
                .map(l => l.date.substring(0, 7))
        )].sort((a, b) => b.localeCompare(a));
        if (months.length > 0) setSelectedMonth(months[0]);
        setLoginError('');
    };

    const handleLogout = () => {
        localStorage.removeItem('magnetic_client_session');
        setClientSession(null);
        setLoginNif('');
        setLoginEmail('');
    };

    // Direct access bypass disabled — require proper login always (security: CR-06)
    const isDirectAccess = false;

    const [selectedTab, setSelectedTab] = useState(() => {
        const tokenOrClientId = initialTokenClientId || initialClientId;
        if (tokenOrClientId && initialMonth) return 'validar';
        if (initialMonth) {
            try {
                const sess = JSON.parse(localStorage.getItem('magnetic_client_session') || 'null');
                if (sess && Date.now() < sess.expiry) return 'validar';
            } catch {}
        }
        return 'dashboard';
    });
    const [selectedMonth, setSelectedMonth] = useState(() => {
        if (initialMonth) return initialMonth;
        try {
            const sessStr = localStorage.getItem('magnetic_client_session');
            if (!sessStr) return null;
            const sess = JSON.parse(sessStr);
            if (!sess || Date.now() > sess.expiry) return null;
            const clientId = sess.clientId;
            const months = [...new Set(
                (initialLogs || [])
                    .filter(l => String(l.clientId) === String(clientId)
                        && calculateHoursDiff(l.startTime, l.endTime, l.breakStart, l.breakEnd) > 0
                        && l.date && /^\d{4}-\d{2}/.test(l.date))
                    .map(l => l.date.substring(0, 7))
            )].sort((a, b) => b.localeCompare(a));
            return months[0] || null;
        } catch { return null; }
    });
    const [validarSubView, setValidarSubView] = useState('selector');

    useEffect(() => {
        if (isDirectAccess && initialMonth) {
            setSelectedMonth(initialMonth);
            setValidarSubView('page');
        }
    }, [isDirectAccess, initialMonth]);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (currentView !== 'hoje' || !supabase || !initialClientId) return;
        const today = new Date().toLocaleDateString('en-CA');
        supabase.from('logs').select('*').eq('clientId', initialClientId).eq('date', today)
            .then(({ data, error }) => {
                if (error) { console.error('[ClientPortal] todayLogs fetch error:', error); return; }
                setTodayLogs(data || []);
            });
    }, [currentView, supabase, initialClientId]);

    useEffect(() => {
        if (!lastRealtimeUpdate) return;
        if (currentView !== 'hoje' || !supabase || !initialClientId) return;
        const today = new Date().toLocaleDateString('en-CA');
        supabase.from('logs').select('*').eq('clientId', initialClientId).eq('date', today)
            .then(({ data, error }) => {
                if (error) { console.error('[ClientPortal] todayLogs fetch error:', error); return; }
                setTodayLogs(data || []);
            });
    }, [lastRealtimeUpdate, currentView, supabase, initialClientId]);

    useEffect(() => {
        setLogs(initialLogs || []);
    }, [initialLogs]);

    useEffect(() => {
        if (!supabase) return;
        if (!initialClientId || typeof initialClientId !== 'string') return;
        // CR-05 fix: Use unique channel name per client to prevent subscription collisions
        const channelName = `client-portal-logs-${initialClientId}`;
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'logs',
                filter: `clientId=eq.${initialClientId}`
            }, (payload) => {
                if (payload.eventType === 'UPDATE') {
                    setLogs(prev => prev.map(log => log.id === payload.new.id ? { ...log, ...payload.new } : log));
                } else if (payload.eventType === 'INSERT') {
                    setLogs(prev => [...prev, payload.new]);
                }
                setLastRealtimeUpdate(new Date());
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [supabase, initialClientId]);

    useEffect(() => {
        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => setClientIp(data.ip || 'N/D'))
            .catch(() => setClientIp('N/D'));
    }, []);

    const clientObj = clients.find(c => c.id === effectiveClientId) || { name: 'Cliente Não Encontrado' };
    const getMonthName = (monthStr) => {
        if (!monthStr || monthStr.length !== 7) return monthStr;
        const [y, m] = monthStr.split('-');
        const d = new Date(y, m - 1);
        return d.toLocaleDateString(t('locale'), { month: 'long', year: 'numeric' });
    };
    const clientData = useMemo(() => {
        return { name: clientObj.name, period: getMonthName(selectedMonth) };
    }, [clientObj, selectedMonth]);

    const {
        dismissedNotifs, expandedCards, setExpandedCards,
        myNotifications, workerSubmissionsResolved, workerSubmissionsPending,
        handleDismissNotif, handleAcceptContestation,
        handleApproveCreationRequest, handleRejectCreationRequest,
    } = useClientNotifications({
        appNotifications, effectiveClientId, corrections, correctionItems,
        initialClientId, logs, setLogs, saveToDb, clientData, workers, supabase,
    });

    const availableMonths = useMemo(() => {
        if (!effectiveClientId) return [];
        return [...new Set(
            logs
                .filter(l => String(l.clientId) === String(effectiveClientId)
                    && calculateHoursDiff(l.startTime, l.endTime, l.breakStart, l.breakEnd) > 0
                    && l.date && /^\d{4}-\d{2}/.test(l.date))
                .map(l => l.date.substring(0, 7))
        )].sort((a, b) => b.localeCompare(a));
    }, [logs, effectiveClientId]);

    // WR-10 fix: Remove selectedMonth from dependency array to prevent potential re-render loop
    useEffect(() => {
        if (!selectedMonth && effectiveClientId && availableMonths.length > 0) {
            setSelectedMonth(availableMonths[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveClientId, availableMonths]);

    const originalWorkersData = useMemo(() => {
        if (!effectiveClientId || !selectedMonth || selectedMonth.length < 7) return [];
        const clientLogs = logs.filter(l => String(l.clientId) === String(effectiveClientId) && l.date && l.date.substring(0, 7) === selectedMonth);
        const workerIds = [...new Set(clientLogs.map(l => l.workerId))];
        return workerIds.map(wId => {
            const w = workers.find(work => work.id === wId) || { name: 'Desconhecido', role: 'Colaborador' };
            const wLogs = clientLogs.filter(l => l.workerId === wId).sort((a, b) => a.date.localeCompare(b.date));
            let total = 0;
            const dailyRecords = wLogs.map(log => {
                const h = log.hours ?? calculateHoursDiff(log.startTime, log.endTime, log.breakStart, log.breakEnd);
                const dayObj = new Date(log.date);
                const dayStr = `${String(dayObj.getDate()).padStart(2, '0')}/${String(dayObj.getMonth() + 1).padStart(2, '0')} (${dayObj.toLocaleDateString('pt-PT', { weekday: 'short' }).substring(0, 3)})`;
                total += h;
                return { logId: log.id, date: dayStr, rawDate: log.date, entry: log.startTime || '--:--', exit: log.endTime || '--:--', hours: h, breakStart: log.breakStart, breakEnd: log.breakEnd };
            });
            return { id: wId, name: w.name, role: w.profissao || 'Colaborador', totalHours: parseFloat(total.toFixed(2)), dailyRecords };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [logs, workers, effectiveClientId, selectedMonth]);

    const originalTotal = selectedMonth && selectedMonth.length >= 7
        ? parseFloat(originalWorkersData.reduce((acc, curr) => acc + curr.totalHours, 0).toFixed(2))
        : 0;

    const isApproved = useMemo(() => {
        return clientApprovals?.some(a => a.client_id === effectiveClientId && a.month === selectedMonth);
    }, [clientApprovals, effectiveClientId, selectedMonth]);

    const approvalData = useMemo(() => {
        return clientApprovals?.find(a => a.client_id === effectiveClientId && a.month === selectedMonth);
    }, [clientApprovals, effectiveClientId, selectedMonth]);

    const goToView = (view) => {
        setCurrentView(view);
        window.scrollTo(0, 0);
    };

    // Contagem de pedidos de trabalhadores pendentes no portal do cliente (para badge)
    const pendingWorkerRequests = useMemo(() => {
        if (!corrections || !effectiveClientId) return 0;
        return corrections.filter(c =>
            String(c.client_id) === String(effectiveClientId) &&
            (c.type === 'creation_request' || c.type === 'deletion_request') &&
            c.status === 'submitted' &&
            c.submitted_at >= CLIENT_REQUESTS_CUTOFF
        ).length;
    }, [corrections, effectiveClientId]);

    const {
        draftData, setDraftData, draftTotal,
        reportJustification, setReportJustification,
        startReport, handleTimeChange, handleDeleteDay, handleRevertDay, generateCorrectionMessage, handlePrecisionConfirm,
    } = useDraftReport({ originalWorkersData, selectedMonth, logs, originalTotal, clientData, initialClientId, initialMonth, saveToDb, goToView, supabase, companySignature });

    const {
        canvasRef, isDrawing, hasSignature, setHasSignature,
        signatureSaved, setSignatureSaved,
        startDrawing, draw, stopDrawing, clearCanvas,
    } = useSignatureCanvas({ currentView, printingWorker, isApproved });

    const notifRef = useRef(null);
    useEffect(() => {
        const handler = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleDownloadIndividual = async (e, worker) => {
        e.stopPropagation();
        setPrintingWorker(worker.id);
        setSignatureSaved(null);
        setTimeout(() => {
            window.print();
            window.addEventListener('afterprint', () => { setPrintingWorker(null); }, { once: true });
            setTimeout(() => { setPrintingWorker(null); }, 2000);
        }, 200);
    };

    const handleDownloadAll = async (e) => {
        if (e) e.stopPropagation();
        setPrintingWorker('all');
        setTimeout(() => {
            window.print();
            window.addEventListener('afterprint', () => { setPrintingWorker(null); }, { once: true });
            setTimeout(() => { setPrintingWorker(null); }, 2000);
        }, 200);
    };

    const toggleWorkerDetails = (id) => {
        setExpandedWorkers(prev => prev.includes(id) ? prev.filter(wId => wId !== id) : [...prev, id]);
    };

    if (!clientSession && !isDirectAccess && !initialTokenClientId && !initialClientId) {
        return <LoginView t={t} lang={lang} changeLang={changeLang} loginNif={loginNif} setLoginNif={setLoginNif} loginEmail={loginEmail} setLoginEmail={setLoginEmail} loginError={loginError} handleLogin={handleLogin} clients={clients} systemSettings={systemSettings} />;
    }

    // Dados ainda a carregar do Supabase — mostrar spinner em vez de "Cliente Não Encontrado"
    if (clients.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">A carregar...</p>
                </div>
            </div>
        );
    }

    // Sessão obsoleta — clientId não corresponde a nenhum cliente na DB
    // Mostrar login; handleLogin vai sobrescrever a sessão ao autenticar com sucesso
    if (clientSession && effectiveClientId && !clients.find(c => c.id === effectiveClientId)) {
        return <LoginView t={t} lang={lang} changeLang={changeLang} loginNif={loginNif} setLoginNif={setLoginNif} loginEmail={loginEmail} setLoginEmail={setLoginEmail} loginError={loginError || 'Sessão expirada. Por favor, inicie sessão novamente.'} handleLogin={handleLogin} clients={clients} systemSettings={systemSettings} />;
    }

    return (
        <div className={`min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-200 font-sans ${printingWorker ? 'pb-0 bg-white' : 'pb-20'}`}>
            {!printingWorker && <ClientPortalHeader systemSettings={systemSettings} lang={lang} changeLang={changeLang} selectedTab={selectedTab} t={t} activeNow={activeNow} workers={workers} showNotifDropdown={showNotifDropdown} setShowNotifDropdown={setShowNotifDropdown} notifRef={notifRef} clientSession={clientSession} handleLogout={handleLogout} />}

            {!printingWorker ? (
                <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
                    {myNotifications.filter(n => n.payload?.type === 'counter_proposal').length > 0 && (
                        <div className="mb-8 space-y-4">
                            {myNotifications.filter(n => n.payload?.type === 'counter_proposal').map(notif => (
                                <CounterProposalCard key={notif.id} notif={notif} handleAcceptContestation={handleAcceptContestation} handleDismissNotif={handleDismissNotif} handleApproveCreationRequest={handleApproveCreationRequest} handleRejectCreationRequest={handleRejectCreationRequest} t={t} goToView={goToView} />
                            ))}
                        </div>
                    )}

                    <WorkerSubmissionsPanel
                        workerSubmissionsResolved={workerSubmissionsResolved}
                        workerSubmissionsPending={workerSubmissionsPending}
                        corrections={corrections}
                        correctionItems={correctionItems}
                        workers={workers}
                        expandedCards={expandedCards}
                        setExpandedCards={setExpandedCards}
                        handleDismissNotif={handleDismissNotif}
                        handleApproveCreationRequest={handleApproveCreationRequest}
                        handleRejectCreationRequest={handleRejectCreationRequest}
                    />

                    {currentView === 'inicio' && selectedTab === 'dashboard' && (
                        <DashboardView
                            logs={logs} workers={workers} clients={clients}
                            effectiveClientId={effectiveClientId} selectedMonth={selectedMonth}
                            availableMonths={availableMonths} setSelectedMonth={setSelectedMonth}
                            originalWorkersData={originalWorkersData} originalTotal={originalTotal}
                            clientData={clientData} clientObj={clientObj} todayStr={todayStr}
                            activeNow={activeNow} rotatingWorkerIdx={rotatingWorkerIdx}
                            isWorkersModalOpen={isWorkersModalOpen} setIsWorkersModalOpen={setIsWorkersModalOpen}
                            calSelectedDay={calSelectedDay} setCalSelectedDay={setCalSelectedDay}
                            expandedLogLocations={expandedLogLocations} setExpandedLogLocations={setExpandedLogLocations}
                            now={now} t={t}
                            onManageLogs={(w) => setLogModalWorker(w)}
                        />
                    )}

                    {currentView === 'inicio' && selectedTab === 'validar' && (
                        <ValidarView
                            clientObj={clientObj} clientData={clientData} clientSession={clientSession} t={t}
                            originalWorkersData={originalWorkersData} originalTotal={originalTotal}
                            approvalData={approvalData} isApproved={isApproved} printingWorker={printingWorker}
                            expandedWorkers={expandedWorkers} toggleWorkerDetails={toggleWorkerDetails}
                            handleDownloadAll={handleDownloadAll} handleDownloadIndividual={handleDownloadIndividual}
                            canvasRef={canvasRef} hasSignature={hasSignature}
                            startDrawing={startDrawing} draw={draw} stopDrawing={stopDrawing} clearCanvas={clearCanvas}
                            signatureSaved={signatureSaved} setSignatureSaved={setSignatureSaved}
                            effectiveClientId={effectiveClientId} selectedMonth={selectedMonth}
                            logs={logs} renderReport={renderReport} saveToDb={saveToDb}
                            clientIp={clientIp} companySignature={companySignature}
                            goToView={goToView} startReport={startReport}
                        />
                    )}

                    {currentView === 'relatorio_cliente' && (
                        <SimpleReportView
                            draftData={draftData} handleTimeChange={handleTimeChange}
                            handleDeleteDay={handleDeleteDay} handleRevertDay={handleRevertDay}
                            draftTotal={draftTotal} originalTotal={originalTotal}
                            reportJustification={reportJustification} setReportJustification={setReportJustification}
                            handlePrecisionConfirm={handlePrecisionConfirm}
                            goToView={goToView} clientData={clientData} t={t}
                        />
                    )}

                    {currentView === 'sucesso_assinatura' && (
                        <div className="animate-fade-in flex flex-col items-center justify-center py-20 px-4 text-center mt-10 w-full max-w-2xl mx-auto bg-white rounded-[3rem] shadow-xl border border-slate-100">
                            <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner border border-emerald-100">✅</div>
                            <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter mb-4">{t('approved_success')}</h2>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest max-w-md mx-auto mb-10 leading-relaxed">{t('signature_registered')}</p>
                            <button onClick={() => goToView('inicio')} className="text-slate-500 font-black text-[10px] uppercase tracking-widest bg-slate-50 px-8 py-4 rounded-2xl border border-slate-200 hover:bg-slate-100 hover:text-slate-800 transition-all shadow-sm">{t('view_summary')}</button>
                        </div>
                    )}

                    {currentView === 'pedidos' && (
                        <WorkerRequestsView
                            effectiveClientId={effectiveClientId}
                            clientName={clientObj?.name || ''}
                            corrections={corrections}
                            correctionItems={correctionItems}
                            supabase={supabase}
                            onRequestsChange={() => {}}
                        />
                    )}

                    {currentView === 'sucesso_reporte' && (
                        <div className="animate-fade-in flex flex-col items-center justify-center py-20 px-4 text-center mt-10 w-full max-w-2xl mx-auto bg-white rounded-[3rem] shadow-xl border border-slate-100">
                            <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner border border-indigo-100">🚀</div>
                            <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter mb-4">{t('corrections_sent')}</h2>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest max-w-md mx-auto mb-10 leading-relaxed">{t('corrections_desc')}</p>
                            <button onClick={() => goToView('inicio')} className="text-slate-500 font-black text-[10px] uppercase tracking-widest bg-slate-50 px-8 py-4 rounded-2xl border border-slate-200 hover:bg-slate-100 hover:text-slate-800 transition-all shadow-sm">{t('back_to_start')}</button>
                        </div>
                    )}
                </main>
            ) : (
                <div className="w-full bg-white">
                    <div className="w-[794px] mx-auto">
                        {renderReport(
                            printingWorker === 'all' ? null : printingWorker,
                            false, logs, effectiveClientId, selectedMonth
                        )}
                    </div>
                </div>
            )}

            {/* Barra de navegação inferior do portal */}
            {!printingWorker && effectiveClientId && (
                <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 shadow-lg">
                    <div className="max-w-6xl mx-auto px-4 flex items-center justify-center gap-1 py-2">
                        <button
                            onClick={() => { setCurrentView('inicio'); setSelectedTab('dashboard'); window.scrollTo(0,0); }}
                            className={`flex flex-col items-center gap-0.5 px-6 py-2 rounded-xl transition-all ${currentView === 'inicio' && selectedTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400 hover:text-slate-700'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                            <span className="text-[9px] font-black uppercase tracking-widest">Dashboard</span>
                        </button>
                        <button
                            onClick={() => { goToView('pedidos'); }}
                            className={`relative flex flex-col items-center gap-0.5 px-6 py-2 rounded-xl transition-all ${currentView === 'pedidos' ? 'bg-amber-50 text-amber-700' : 'text-slate-400 hover:text-slate-700'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                            <span className="text-[9px] font-black uppercase tracking-widest">Pedidos</span>
                            {pendingWorkerRequests > 0 && (
                                <span className="absolute -top-0.5 right-3 w-4 h-4 bg-amber-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                                    {pendingWorkerRequests}
                                </span>
                            )}
                        </button>
                    </div>
                </nav>
            )}

            {/* Modal de gestão de logs */}
            {logModalWorker && (
                <LogManagementModal
                    worker={logModalWorker}
                    clientId={effectiveClientId}
                    clientName={clientObj?.name || ''}
                    selectedMonth={selectedMonth}
                    logs={logs}
                    supabase={supabase}
                    onClose={() => setLogModalWorker(null)}
                    onLogsChanged={() => {}}
                />
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
        .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        input[type="time"]::-webkit-calendar-picker-indicator { background: transparent; bottom: 0; color: transparent; cursor: pointer; height: auto; left: 0; position: absolute; right: 0; top: 0; width: auto; }
        input[type="time"] { position: relative; }
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { height: auto !important; min-height: 0 !important; margin: 0; background-color: white !important; }
          #root { height: auto !important; background-color: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .a4-paper { margin: 0 !important; padding: 30px !important; box-shadow: none !important; border: none !important; width: 100% !important; max-width: 100% !important; min-height: auto !important; page-break-after: avoid !important; break-after: avoid !important; }
          .report-scale-outer { display: block !important; height: auto !important; overflow: visible !important; }
          .report-scale-inner { transform: none !important; width: 100% !important; height: auto !important; }
        }
      `}} />
        </div>
    );
}
