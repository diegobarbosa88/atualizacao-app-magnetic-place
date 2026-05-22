import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Download, ChevronDown, ChevronUp, X, Sparkles, History, MessageCircle, CheckCircle, Edit2, Trash2, Bell, AlertCircle, MapPin, Navigation, LogOut } from 'lucide-react';
import PrecisionReportReview from './components/correcoes/PrecisionReportReview';
import ClientReportFlow from './features/client-report/ClientReportFlow';
import { useApp } from './context/AppContext';
import { sendValidationEmail } from './utils/emailUtils';
import ValidationStamp from './components/common/ValidationStampWithQR';
import ClientPortalNavbar from './components/common/ClientPortalNavbar';
import { cropSignatureCanvas } from './utils/signatureCanvas';

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

export default function ClientPortal({ clients, workers, logs: initialLogs, saveToDb, initialClientId, initialMonth, renderReport, systemSettings, appNotifications, clientApprovals, supabase }) {
    const { companySignature } = useApp();
    const [logs, setLogs] = useState(initialLogs || []);
    const [currentView, setCurrentView] = useState('inicio');
    const [expandedWorkers, setExpandedWorkers] = useState([]);
    const [draftData, setDraftData] = useState([]);
    const [reportJustification, setReportJustification] = useState("");
    const [isZipping, setIsZipping] = useState(false);
    const [printingWorker, setPrintingWorker] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    const [signatureSaved, setSignatureSaved] = useState(null);
    const [clientIp, setClientIp] = useState('Localhost');
    const [correctionMode, setCorrectionMode] = useState('triagem'); // 'triagem', 'manual', 'comentario'
    const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState(null);
    const [now, setNow] = useState(() => new Date());
    const [todayLogs, setTodayLogs] = useState([]);
    const [expandedLogLocations, setExpandedLogLocations] = useState(new Set());
    const [expandedHistoryDays, setExpandedHistoryDays] = useState(new Set());

    // --- CLIENT SESSION / LOGIN ---
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

    const effectiveClientId = clientSession?.clientId || initialClientId || null;

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

    const [selectedTab, setSelectedTab] = useState(isDirectAccess ? 'validar' : 'dashboard');
    const [selectedMonth, setSelectedMonth] = useState(initialMonth || null);
    const [validarSubView, setValidarSubView] = useState('selector'); // 'selector' | 'page'

    // When direct access, set validating month
    useEffect(() => {
        if (isDirectAccess && initialMonth) {
            setSelectedMonth(initialMonth);
            setValidarSubView('page');
        }
    }, [isDirectAccess, initialMonth]);

    // Após login via formulário, selecionar automaticamente o mês mais recente disponível
    useEffect(() => {
        if (!selectedMonth && effectiveClientId && availableMonths.length > 0) {
            setSelectedMonth(availableMonths[0]);
        }
    }, [effectiveClientId, availableMonths, selectedMonth]);

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(t);
    }, []);

    // Carregar logs de hoje ao mudar para tab "Hoje"
    useEffect(() => {
        if (currentView !== 'hoje' || !supabase || !initialClientId) return;
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD em hora local
        supabase
            .from('logs')
            .select('*')
            .eq('clientId', initialClientId)
            .eq('date', today)
            .then(({ data, error }) => {
                if (error) { console.error('[ClientPortal] todayLogs fetch error:', error); return; }
                setTodayLogs(data || []);
            });
    }, [currentView, supabase, initialClientId]);

    // Actualizar todayLogs em tempo real via eventos da subscrição
    useEffect(() => {
        if (!lastRealtimeUpdate) return;
        if (currentView !== 'hoje' || !supabase || !initialClientId) return;
        const today = new Date().toLocaleDateString('en-CA');
        supabase
            .from('logs')
            .select('*')
            .eq('clientId', initialClientId)
            .eq('date', today)
            .then(({ data, error }) => {
                if (error) { console.error('[ClientPortal] todayLogs fetch error:', error); return; }
                setTodayLogs(data || []);
            });
    }, [lastRealtimeUpdate, currentView, supabase, initialClientId]);
    const [editingWorkerId, setEditingWorkerId] = useState(null);
    const [editingDayId, setEditingDayId] = useState(null);
    const canvasRef = useRef(null);

    const isApproved = useMemo(() => {
        return clientApprovals?.some(a => a.client_id === effectiveClientId && a.month === selectedMonth);
    }, [clientApprovals, effectiveClientId, selectedMonth]);

    const approvalData = useMemo(() => {
        return clientApprovals?.find(a => a.client_id === effectiveClientId && a.month === selectedMonth);
    }, [clientApprovals, effectiveClientId, selectedMonth]);

    // Limpar assinatura se o administrador anular a validação
    useEffect(() => {
        if (!isApproved) {
            setSignatureSaved(null);
            setHasSignature(false);
        }
    }, [isApproved]);

    // Atualizar logs quando initialLogs mudar
    useEffect(() => {
        setLogs(initialLogs || []);
    }, [initialLogs]);

    // Subscription em tempo real para logs
    useEffect(() => {
        if (!supabase) return;
        if (!initialClientId || typeof initialClientId !== 'string') {
            return;
        }

        const channel = supabase
            .channel('client-portal-logs')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'logs',
                filter: `clientId=eq.${initialClientId}`
            }, (payload) => {
                if (payload.eventType === 'UPDATE') {
                    setLogs(prev => prev.map(log =>
                        log.id === payload.new.id ? { ...log, ...payload.new } : log
                    ));
                } else if (payload.eventType === 'INSERT') {
                    setLogs(prev => [...prev, payload.new]);
                }
                setLastRealtimeUpdate(new Date());
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, initialClientId]);

    // Fetch IP address
    useEffect(() => {
        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => setClientIp(data.ip))
            .catch(err => console.error("Erro ao obter IP:", err));
    }, []);

    const [dismissedNotifs, setDismissedNotifs] = useState([]);
    useEffect(() => {
        if (!effectiveClientId) return;
        try {
            setDismissedNotifs(JSON.parse(localStorage.getItem(`dismissed_client_notifs_${effectiveClientId}`) || '[]'));
        } catch { setDismissedNotifs([]); }
    }, [effectiveClientId]);

    const myNotifications = useMemo(() => {
        if (!appNotifications || !initialClientId) return [];

        const filtered = appNotifications.filter(n => {
            const matchTarget = n.target_type === 'client';
            const matchClientId = String(n.target_client_id) === String(initialClientId);
            const isActive = n.is_active === true;
            const notDismissed = !dismissedNotifs.includes(n.id);

            return matchTarget && matchClientId && isActive && notDismissed;
        });

        return filtered;
    }, [appNotifications, initialClientId, dismissedNotifs]);

    const handleDismissNotif = (id) => {
        setDismissedNotifs(prev => {
            if (prev.includes(id)) return prev;
            const updated = [...prev, id];
            localStorage.setItem(`dismissed_client_notifs_${initialClientId}`, JSON.stringify(updated));
            return updated;
        });
    };

    const clientObj = clients.find(c => c.id === effectiveClientId) || { name: 'Cliente Não Encontrado' };
    const getMonthName = (monthStr) => {
        if (!monthStr || monthStr.length !== 7) return monthStr;
        const [y, m] = monthStr.split('-');
        const d = new Date(y, m - 1);
        return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    };

    const clientData = useMemo(() => {
        return { name: clientObj.name, period: getMonthName(selectedMonth) };
    }, [clientObj, selectedMonth]);

    const handleAcceptContestation = useCallback(async (notif) => {
        const changes = notif.payload?.changes;
        if (!changes || !Array.isArray(changes)) {
            alert("Erro: Não foi possível encontrar os dados da contra-proposta.");
            return;
        }

        try {
            const updates = [];
            const inserts = [];
            for (const w of changes) {
                for (const d of w.dailyRecords) {
                    const targetWorkerId = String(w.id);
                    const targetClientId = String(initialClientId);
                    const targetDate = d.date || d.dateLabel || d.rawDate;
                    const originalLog = logs.find(l =>
                        String(l.workerId || l.worker_id) === targetWorkerId &&
                        l.date === targetDate &&
                        String(l.clientId || l.client_id) === targetClientId
                    );
                    const entry = (d.adminEntry || d.editedEntry || d.newEntry) === '--:--' ? null : (d.adminEntry || d.editedEntry || d.newEntry);
                    const exit  = (d.adminExit  || d.editedExit  || d.newExit)  === '--:--' ? null : (d.adminExit  || d.editedExit  || d.newExit);
                    if (originalLog) {
                        updates.push({ id: originalLog.id, data: { ...originalLog, startTime: entry, endTime: exit, breakStart: d.adminBreakStart || d.editedBreakStart || d.newBreakStart, breakEnd: d.adminBreakEnd || d.editedBreakEnd || d.newBreakEnd, hours: d.adminHours || d.editedHours || d.newHours } });
                    } else {
                        const newLogId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
                        inserts.push({ id: newLogId, data: { id: newLogId, date: targetDate, workerId: targetWorkerId, clientId: targetClientId, startTime: entry, endTime: exit, breakStart: d.adminBreakStart || d.editedBreakStart || d.newBreakStart, breakEnd: d.adminBreakEnd || d.editedBreakEnd || d.newBreakEnd, hours: d.adminHours || d.editedHours || d.newHours, created_at: new Date().toISOString() } });
                    }
                }
            }
            await Promise.all([
                ...updates.map(u => saveToDb('logs', u.id, u.data)),
                ...inserts.map(i => saveToDb('logs', i.id, i.data)),
            ]);
            setLogs(prev => {
                const updateMap = new Map(updates.map(u => [u.id, u.data]));
                const updated = prev.map(l => updateMap.has(l.id) ? { ...l, ...updateMap.get(l.id) } : l);
                return [...updated, ...inserts.map(i => i.data)];
            });

            const timestamp = Date.now();
            const adminNotifId = `accp_${notif.id}_${timestamp}`;
            await saveToDb('app_notifications', adminNotifId, {
                title: `✅ Contra-proposta Aceite e Aplicada: ${clientData.name}`,
                message: `O cliente ACEITOU a contra-proposta para ${clientData.period}. Os registos de horas foram atualizados automaticamente no sistema.`,
                type: 'success',
                target_type: 'admin',
                created_at: new Date().toISOString(),
                is_active: true
            });

            handleDismissNotif(notif.id);
            alert("As alterações foram aplicadas! Por favor, assine agora o relatório atualizado.");
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

        } catch (error) {
            console.error("Erro ao aplicar contra-proposta:", error);
            alert("Ocorreu um erro ao atualizar os dados. Por favor, tente novamente.");
        }
    }, [clientData, clientSession, supabase, logs, initialClientId, saveToDb]);

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

    const originalWorkersData = useMemo(() => {
        if (!effectiveClientId || !selectedMonth) return [];
        const clientLogs = logs.filter(l => String(l.clientId) === String(effectiveClientId) && l.date && l.date.substring(0, 7) === selectedMonth);
        const workerIds = [...new Set(clientLogs.map(l => l.workerId))];

        return workerIds.map(wId => {
            const w = workers.find(work => work.id === wId) || { name: 'Desconhecido', role: 'Colaborador' };
            const wLogs = clientLogs.filter(l => l.workerId === wId).sort((a, b) => a.date.localeCompare(b.date));
            let total = 0;
            const dailyRecords = wLogs.map(log => {
                const h = calculateHoursDiff(log.startTime, log.endTime, log.breakStart, log.breakEnd);
                const dayObj = new Date(log.date);
                const dayStr = `${String(dayObj.getDate()).padStart(2, '0')}/${String(dayObj.getMonth() + 1).padStart(2, '0')} (${dayObj.toLocaleDateString('pt-PT', { weekday: 'short' }).substring(0, 3)})`;
                total += h;
                return { logId: log.id, date: dayStr, rawDate: log.date, entry: log.startTime || '--:--', exit: log.endTime || '--:--', hours: h, breakStart: log.breakStart, breakEnd: log.breakEnd };
            });
            return { id: wId, name: w.name, role: w.profissao || 'Colaborador', totalHours: parseFloat(total.toFixed(2)), dailyRecords };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [logs, workers, effectiveClientId, selectedMonth]);

    const originalTotal = parseFloat(originalWorkersData.reduce((acc, curr) => acc + curr.totalHours, 0).toFixed(2));
    const draftTotal = parseFloat(draftData.reduce((acc, curr) => acc + (Number(curr.editedTotalHours) || 0), 0).toFixed(2));

    const downloadFile = (filename, content) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadIndividual = async (e, worker) => {
        e.stopPropagation();
        setPrintingWorker(worker.id);
        setSignatureSaved(null);

        setTimeout(() => {
            window.print();
            window.addEventListener('afterprint', () => {
                setPrintingWorker(null);
            }, { once: true });
            setTimeout(() => {
                setPrintingWorker(null);
            }, 2000);
        }, 200);
    };

    const handleDownloadAll = async (e) => {
        if (e) e.stopPropagation();
        setPrintingWorker('all');

        setTimeout(() => {
            window.print();
            window.addEventListener('afterprint', () => {
                setPrintingWorker(null);
            }, { once: true });
            setTimeout(() => {
                setPrintingWorker(null);
            }, 2000);
        }, 200);
    };

    const toggleWorkerDetails = (id) => {
        setExpandedWorkers(prev => prev.includes(id) ? prev.filter(wId => wId !== id) : [...prev, id]);
    };

    useEffect(() => {
        if (currentView === 'inicio' && canvasRef.current) {
            // Pequeno timeout para garantir que o elemento pai já tenha largura final
            const timer = setTimeout(() => {
                if (!canvasRef.current) return;
                const canvas = canvasRef.current;
                const parent = canvas.parentElement;
                canvas.width = parent.clientWidth;
                canvas.height = 200;
                const ctx = canvas.getContext('2d');
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#4f46e5';

                if (signatureSaved && !printingWorker) {
                    const img = new Image();
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0);
                        setHasSignature(true);
                    };
                    img.src = signatureSaved;
                } else if (!printingWorker) {
                    // Se não há assinatura salva, garantir que o canvas está limpo
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    setHasSignature(false);
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [currentView, printingWorker, isApproved, signatureSaved]);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const startDrawing = (e) => {
        setIsDrawing(true);
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
        if (!hasSignature) setHasSignature(true);
    };

    const stopDrawing = () => {
        if (isDrawing && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.closePath();
            setIsDrawing(false);
        }
    };

    const clearCanvas = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
        setSignatureSaved(null);
    };

    const goToView = (view) => {
        if (view === 'editar_relatorio') {
            setCorrectionMode('triagem');
            setEditingWorkerId(null);
        }
        if (view === 'precision_review') {
            // Reset editing state when entering precision review
        }
        setCurrentView(view);
        window.scrollTo(0, 0);
    };

    const startReport = () => {
        // Função auxiliar para obter todos os dias do mês sem desvios de fuso horário
        const getAllMonthDates = (monthStr) => {
            const [year, month] = monthStr.split('-').map(Number);
            const dates = [];
            const numDays = new Date(year, month, 0).getDate();
            for (let i = 1; i <= numDays; i++) {
                const d = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                dates.push(d);
            }
            return dates;
        };

        const allDates = getAllMonthDates(selectedMonth);

        const editableData = originalWorkersData.map(w => {
            // Mapear logs existentes por data (garantindo que pegamos apenas a parte YYYY-MM-DD)
            const logsMap = {};
            w.dailyRecords.forEach(d => {
                const dateKey = d.rawDate.substring(0, 10);
                logsMap[dateKey] = d;
            });

            // Criar lista completa de dias para edição
            const fullDailyRecords = allDates.map(dateStr => {
                if (logsMap[dateStr]) {
                    const d = logsMap[dateStr];
                    return {
                        ...d,
                        editedEntry: d.entry === '--:--' ? '' : d.entry,
                        editedExit: d.exit === '--:--' ? '' : d.exit,
                        editedHours: d.hours,
                        editedBreakStart: d.breakStart || '',
                        editedBreakEnd: d.breakEnd || '',
                        isVisible: true // Dias com registo original são visíveis por padrão
                    };
                } else {
                    const dayObj = new Date(dateStr + 'T12:00:00'); // Forçar meio-dia para evitar shift de fuso
                    const dayLabel = `${String(dayObj.getDate()).padStart(2, '0')}/${String(dayObj.getMonth() + 1).padStart(2, '0')} (${dayObj.toLocaleDateString('pt-PT', { weekday: 'short' }).substring(0, 3)})`;
                    return {
                        logId: `new_${w.id}_${dateStr}`,
                        date: dayLabel,
                        rawDate: dateStr,
                        entry: '--:--',
                        exit: '--:--',
                        hours: 0,
                        breakStart: '',
                        breakEnd: '',
                        editedEntry: '',
                        editedExit: '',
                        editedHours: 0,
                        editedBreakStart: '',
                        editedBreakEnd: '',
                        isNew: true,
                        isVisible: false // Dias vazios ficam escondidos até o cliente querer ver
                    };
                }
            });

            return {
                ...w,
                editedTotalHours: w.totalHours,
                dailyRecords: fullDailyRecords
            };
        });
        setDraftData(editableData);
        setReportJustification("");
        goToView('editar_relatorio');
    };

    const handleTimeChange = (workerId, dateStr, field, val) => {
        setDraftData(prev => prev.map(w => {
            if (w.id === workerId) {
                const newDaily = w.dailyRecords.map(d => {
                    if (d.rawDate === dateStr) {
                        const newEntry = field === 'entry' ? val : d.editedEntry;
                        const newExit = field === 'exit' ? val : d.editedExit;
                        const newBreakStart = field === 'breakStart' ? val : d.editedBreakStart;
                        const newBreakEnd = field === 'breakEnd' ? val : d.editedBreakEnd;
                        const newHours = calculateHoursDiff(newEntry, newExit, newBreakStart, newBreakEnd);
                        return { ...d, editedEntry: newEntry, editedExit: newExit, editedBreakStart: newBreakStart, editedBreakEnd: newBreakEnd, editedHours: newHours };
                    }
                    return d;
                });
                const newTotal = parseFloat(newDaily.reduce((acc, curr) => acc + curr.editedHours, 0).toFixed(2));
                return { ...w, dailyRecords: newDaily, editedTotalHours: newTotal };
            }
            return w;
        }));
    };

    // Animation and time input styles moved into dangerouslySetInnerHTML block (WR-08)

    const Header = () => (
        <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10 w-full shadow-sm py-4">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 font-black text-xl tracking-tighter uppercase text-slate-900">
                    <img
                        src={systemSettings?.companyLogo || 'MAGNETIC (3).png'}
                        alt="Logo"
                        className="h-10 w-auto object-contain"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                        }}
                    />
                    <div className="hidden bg-indigo-600 text-white w-10 h-10 items-center justify-center rounded-xl shadow-lg shadow-indigo-600/20">M</div>
                    {systemSettings?.companyName || 'Magnetic Place'}
                </div>

                <div className="flex-1 hidden md:flex justify-center invisible">
                    {/* Espaçador para manter equilíbrio */}
                </div>

                <div className="text-[10px] uppercase font-black tracking-widest text-slate-500 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 shadow-inner">
                    {clientData.name}
                </div>
            </div>
        </header>
    );

    const formatElapsed = (startTimeStr) => {
        const [h, m] = startTimeStr.split(':').map(Number);
        const start = new Date(now);
        start.setHours(h, m, 0, 0);
        const diffMins = Math.max(0, Math.floor((now - start) / 60000));
        if (diffMins < 1) return 'agora mesmo';
        if (diffMins < 60) return `${diffMins} min`;
        const hh = Math.floor(diffMins / 60);
        const mm = diffMins % 60;
        return mm > 0 ? `${hh}h ${mm}min` : `${hh}h`;
    };

    const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;
    const moradaMapsLink = (morada) => morada ? `https://www.google.com/maps/search/${encodeURIComponent(morada)}` : null;

    const LocationDot = ({ lat, lng, verified }) => {
        if (lat == null || lng == null) return null;
        const cls = verified === true
            ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)] animate-pulse'
            : verified === false
            ? 'bg-rose-400'
            : 'bg-slate-300';
        return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} title={verified === true ? 'Na localização' : verified === false ? 'Fora da localização' : 'GPS registado'} />;
    };

    const renderHistorico = () => {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const thisClient = clients?.find(c => String(c.id) === String(initialClientId));
        const logsByDate = {};
        logs
            .filter(l => calculateHoursDiff(l.startTime, l.endTime, l.breakStart, l.breakEnd) > 0)
            .forEach(l => { if (!logsByDate[l.date]) logsByDate[l.date] = []; logsByDate[l.date].push(l); });
        const sortedDates = Object.keys(logsByDate)
            .filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d))
            .sort((a, b) => a.localeCompare(b));
        const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

        const renderLogLine = (log) => {
            const h = calculateHoursDiff(log.startTime, log.endTime, log.breakStart, log.breakEnd);
            const isOpen = log.startTime && !log.endTime;
            const inBreak = isOpen && log.breakStart && !log.breakEnd;
            const logHasGps = log.check_in_lat || log.check_out_lat || log.break_start_lat || log.break_end_lat;
            const isLocExpanded = expandedLogLocations.has(log.id);
            const worker = workers.find(w => String(w.id) === String(log.workerId || log.worker_id));
            const gpsPoints = [
                log.check_in_lat ? { label: 'Entrada', lat: log.check_in_lat, lng: log.check_in_lng, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' } : null,
                log.break_start_lat ? { label: 'Pausa ↑', lat: log.break_start_lat, lng: log.break_start_lng, cls: 'text-amber-700 bg-amber-50 border-amber-200' } : null,
                log.break_end_lat ? { label: 'Pausa ↓', lat: log.break_end_lat, lng: log.break_end_lng, cls: 'text-orange-700 bg-orange-50 border-orange-200' } : null,
                log.check_out_lat ? { label: 'Saída', lat: log.check_out_lat, lng: log.check_out_lng, cls: 'text-rose-700 bg-rose-50 border-rose-200' } : null,
            ].filter(Boolean);
            return (
                <div key={log.id} className="px-6 py-3 border-b border-slate-100 last:border-0">
                    {worker && <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{worker.name}</p>}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Entrada</span>
                            <span className={`text-sm font-black font-mono ${isOpen && !inBreak ? 'text-emerald-700' : 'text-slate-700'}`}>{log.startTime || '–'}</span>
                            <LocationDot lat={log.check_in_lat} lng={log.check_in_lng} verified={log.geo_verified} />
                            {isOpen && !inBreak && <span className="text-[9px] font-bold text-emerald-500">{formatElapsed(log.startTime)}</span>}
                        </div>
                        <span className="text-slate-200">|</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pausa</span>
                            {log.breakStart ? (
                                <>
                                    <span className={`text-sm font-black font-mono ${inBreak ? 'text-amber-600' : 'text-slate-600'}`}>{log.breakStart}{log.breakEnd ? ` → ${log.breakEnd}` : ' → …'}</span>
                                    <LocationDot lat={log.break_start_lat} lng={log.break_start_lng} verified={null} />
                                    {inBreak && <span className="text-[9px] font-bold text-amber-500">{formatElapsed(log.breakStart)}</span>}
                                </>
                            ) : <span className="text-slate-300 font-bold text-sm">–</span>}
                        </div>
                        <span className="text-slate-200">|</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Saída</span>
                            <span className="text-sm font-black font-mono text-slate-700">{log.endTime || '–'}</span>
                            {log.endTime && <LocationDot lat={log.check_out_lat} lng={log.check_out_lng} verified={null} />}
                        </div>
                        <span className="text-slate-200">|</span>
                        <span className="text-sm font-black text-indigo-700">{h > 0 ? `${h.toFixed(2)}h` : '–'}</span>
                        {logHasGps && (
                            <button onClick={(e) => { e.stopPropagation(); setExpandedLogLocations(prev => { const n = new Set(prev); n.has(log.id) ? n.delete(log.id) : n.add(log.id); return n; }); }}
                                className={`ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black transition-all ${isLocExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}>
                                <Navigation size={9} /> Locais
                            </button>
                        )}
                    </div>
                    {isLocExpanded && (
                        <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in duration-200">
                            <div className="flex flex-wrap gap-1.5">
                                {thisClient?.morada && (
                                    <a href={moradaMapsLink(thisClient.morada)} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-all">
                                        <MapPin size={10} /> {thisClient.morada}
                                    </a>
                                )}
                                {gpsPoints.map(p => (
                                    <a key={p.label} href={mapsLink(p.lat, p.lng)} target="_blank" rel="noreferrer" className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black border ${p.cls} hover:opacity-75 transition-all`}>
                                        <MapPin size={10} /> {p.label}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        };

        return (
            <div className="animate-fade-in space-y-4">
                <section className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden p-6 md:p-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Histórico de Registos</h2>
                        <p className="text-2xl font-black text-slate-800 mt-1 uppercase">{new Date().toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</p>
                    </div>
                    {lastRealtimeUpdate && (
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl">
                            Atualizado: {lastRealtimeUpdate.toLocaleTimeString('pt-PT')}
                        </div>
                    )}
                </section>

                {sortedDates.length === 0 ? (
                    <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 p-12 text-center text-slate-400 font-bold text-sm">Sem registos para este período.</div>
                ) : (
                    <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                        <div className="divide-y divide-slate-100">
                            {sortedDates.map(dateStr => {
                                const dayLogs = logsByDate[dateStr];
                                const dayTotal = dayLogs.reduce((acc, l) => acc + calculateHoursDiff(l.startTime, l.endTime, l.breakStart, l.breakEnd), 0);
                                const isExpanded = expandedHistoryDays.has(dateStr);
                                const [dy, dm, dd] = dateStr.split('-').map(Number);
                                const dObj = new Date(dy, dm - 1, dd);
                                const isToday = dateStr === todayStr;
                                return (
                                    <React.Fragment key={dateStr}>
                                        <div onClick={() => setExpandedHistoryDays(prev => { const n = new Set(prev); n.has(dateStr) ? n.delete(dateStr) : n.add(dateStr); return n; })}
                                            className={`px-6 py-4 flex items-center gap-4 cursor-pointer transition-colors hover:bg-slate-50 ${isExpanded ? 'bg-indigo-50/30' : ''}`}>
                                            <div className="flex items-baseline gap-2 min-w-[60px]">
                                                <span className="text-2xl font-black text-slate-800">{dObj.getDate()}</span>
                                                <span className="text-[10px] uppercase font-bold text-slate-400">{dayNames[dObj.getDay()]}</span>
                                            </div>
                                            <div className="flex-1 flex items-center gap-3 flex-wrap">
                                                {isToday && <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase">Hoje</span>}
                                                {dayTotal > 0 && <span className="text-[10px] font-black text-indigo-600">{dayTotal.toFixed(2)}h</span>}
                                                <span className="text-[10px] text-slate-300 font-bold">{dayLogs.length} registo{dayLogs.length !== 1 ? 's' : ''}</span>
                                            </div>
                                            {isExpanded ? <ChevronUp size={18} className="text-indigo-400 flex-shrink-0" /> : <ChevronDown size={18} className="text-slate-300 flex-shrink-0" />}
                                        </div>
                                        {isExpanded && (
                                            <div className="border-t border-slate-100 bg-slate-50/20 animate-in fade-in slide-in-from-top-2 duration-200">
                                                {dayLogs.map(renderLogLine)}
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderInicio = () => (
        <div className="animate-fade-in space-y-8">
            <section className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden p-6 md:p-10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período de Validação</h2>
                    <p className="text-3xl font-black text-slate-800 mt-2 uppercase">{clientData.period}</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 md:min-w-[200px] text-center shadow-inner">
                    <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest mb-1">Total de Horas</p>
                    <p className="text-4xl font-black text-indigo-700">{originalTotal}h</p>
                </div>
            </section>

            {(() => {
                const todayStr = new Date().toLocaleDateString('en-CA');
                const activeNow = logs.filter(l => String(l.clientId) === String(initialClientId) && l.date === todayStr && l.startTime && !l.endTime);
                if (activeNow.length === 0) return null;
                return (
                    <section className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
                        <div className="px-8 py-5 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse flex-shrink-0" />
                                <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Tempo Real</h3>
                            </div>
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl uppercase tracking-wide">{activeNow.length} em serviço</span>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {activeNow.map(log => {
                                const worker = workers.find(w => String(w.id) === String(log.workerId || log.worker_id));
                                const inBreak = log.breakStart && !log.breakEnd;
                                return (
                                    <div key={log.id} className="px-6 py-4 flex items-center gap-4">
                                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${inBreak ? 'bg-amber-400' : 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)] animate-pulse'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-slate-800 text-sm truncate">{worker?.name || 'Colaborador'}</p>
                                            <p className="text-[10px] font-bold text-slate-400">{inBreak ? `Em pausa desde ${log.breakStart}` : `Em serviço desde ${log.startTime}`}</p>
                                        </div>
                                        <span className={`text-sm font-black ${inBreak ? 'text-amber-600' : 'text-emerald-600'}`}>
                                            {inBreak ? formatElapsed(log.breakStart) : formatElapsed(log.startTime)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })()}

            <section className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h3 className="font-black text-slate-800 text-2xl uppercase tracking-tighter">Detalhe de Horas</h3>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 block">Resumo descriminado</span>
                    </div>
                    {originalWorkersData.length > 1 && (
                        <button onClick={handleDownloadAll} className="w-full md:w-auto inline-flex items-center justify-center gap-3 bg-emerald-600 border border-emerald-500 hover:bg-emerald-700 text-white px-6 py-4 rounded-2xl shadow-sm transition-all font-black text-xs uppercase tracking-widest active:scale-95">
                            <Download size={18} />
                            Baixar Todos (PDF)
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-black border-b border-slate-100">
                                <th className="p-6">Colaborador</th>
                                <th className="p-6 text-right">Horas</th>
                                <th className="p-6 text-right w-24">Ação</th>
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
                                                            {renderReport(worker.id, true, logs)}
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
                                        Nenhum colaborador registado para este cliente no mês de {clientData.period}.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

            </section>

            {currentView === 'inicio' && !printingWorker && (
                <section id="validar-horarios-section" className="approval-section bg-white rounded-[3rem] shadow-xl border border-slate-100 p-8 md:p-12 animate-in slide-in-from-bottom-8 duration-500">
                    {isApproved ? (
                        <div className="text-center py-6">
                            <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-100 shadow-lg shadow-emerald-200/50">
                                <CheckCircle size={48} />
                            </div>
                            <h3 className="font-black text-3xl text-slate-800 uppercase tracking-tighter mb-4">Relatório Validado</h3>
                            <div className="text-center mb-10">
                                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                    Este relatório já foi validado e assinado digitalmente em:
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
                                    <Download size={20} /> Baixar Relatório Assinado
                                </button>
                            </div>

                            <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center gap-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">A possibilidade de edição foi desativada após a aprovação.</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-10">
                                <h3 className="font-black text-2xl text-slate-800 uppercase tracking-tighter mb-2">Aprovação do Cliente</h3>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Assine abaixo para validar e aprovar o relatório de {originalTotal} horas.</p>
                            </div>

                            <div id="signature-canvas-area" className="relative w-full max-w-2xl mx-auto bg-slate-50 border-2 border-dashed border-slate-300 rounded-[2rem] overflow-hidden mb-6 shadow-inner">
                                <canvas ref={canvasRef} className="w-full cursor-crosshair touch-none" style={{ touchAction: 'none' }} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                                {!hasSignature && <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 font-black text-2xl uppercase tracking-wider opacity-60">Assine Aqui</div>}
                            </div>

                            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-2xl mx-auto">
                                <button onClick={clearCanvas} className="w-full sm:w-auto px-6 py-4 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Limpar Quadro</button>

                                <button onClick={() => {
                                    const canvas = canvasRef.current;
                                    const base64Image = cropSignatureCanvas(canvas);
                                    setSignatureSaved(base64Image);
                                    const safeClientId = String(initialClientId || 'unknown');
                                    const safeMonth = String(initialMonth || 'unknown');
                                    const id = "c_appr_" + safeClientId + "_" + safeMonth;

                                    const approvalData = {
                                        id,
                                        client_id: initialClientId,
                                        month: initialMonth,
                                        signature_base64: base64Image,
                                        approved_total_hours: originalTotal,
                                        has_corrections: false,
                                        created_at: new Date().toISOString(),
                                        client_ip: clientIp || 'N/D',
                                        client_ua: navigator.userAgent || 'N/D'
                                    };

                                    saveToDb('client_approvals', id, approvalData)
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
                                    Validar e Aprovar Horas
                                </button>
                            </div>

                            <div className="mt-12 pt-8 border-t border-slate-100 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Encontrou alguma divergência nos horários?</p>
                                <button onClick={startReport} className="inline-flex items-center gap-3 text-white bg-slate-900 hover:bg-slate-800 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50" disabled={originalTotal === 0}>
                                    Editar Relatório
                                </button>
                            </div>
                        </>
                    )}
                </section>
            )}
        </div>
    );

    const renderEditarRelatorio = () => {
        if (correctionMode === 'triagem') {
            return (
                <div className="animate-fade-in max-w-4xl mx-auto py-10">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-4">Como deseja reportar?</h2>
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em]">Escolha o método mais simples para si</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Opção 1: Mensagem Rápida */}
                        <button
                            onClick={() => { setCorrectionMode('comentario'); setReportJustification(''); }}
                            className="group bg-white p-10 rounded-[3rem] border-2 border-slate-100 hover:border-indigo-600 transition-all text-left shadow-xl shadow-slate-200/50 hover:shadow-indigo-600/10 active:scale-[0.98]"
                        >
                            <div className="w-16 h-16 bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-2xl flex items-center justify-center mb-8 transition-colors">
                                <MessageCircle size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-3 uppercase tracking-tight">Mensagem Rápida</h3>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">Explique o erro por texto. Ideal para problemas gerais ou quando não quer editar horas manualmente.</p>
                            <div className="inline-flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest">
                                Escolher este método <ChevronDown size={14} className="-rotate-90" />
                            </div>
                        </button>

                        {/* Opção 2: Ajuste Manual */}
                        <button
                            onClick={() => { setCorrectionMode('manual'); }}
                            className="group bg-white p-10 rounded-[3rem] border-2 border-slate-100 hover:border-amber-500 transition-all text-left shadow-xl shadow-slate-200/50 hover:shadow-amber-500/10 active:scale-[0.98]"
                        >
                            <div className="w-16 h-16 bg-slate-50 text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-500 rounded-2xl flex items-center justify-center mb-8 transition-colors">
                                <Sparkles size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-3 uppercase tracking-tight">Ajuste de Precisão</h3>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">Altere os horários de entrada e saída colaborador a colaborador. Ideal para correções exatas.</p>
                            <div className="inline-flex items-center gap-2 text-amber-600 font-black text-[10px] uppercase tracking-widest">
                                Escolher este método <ChevronDown size={14} className="-rotate-90" />
                            </div>
                        </button>
                    </div>

                    <div className="mt-12 text-center">
                        <button onClick={() => goToView('inicio')} className="text-slate-400 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest transition-colors">Voltar para o Início</button>
                    </div>
                </div>
            );
        }

        if (correctionMode === 'comentario') {
            return (
                <div className="animate-fade-in max-w-2xl mx-auto py-10">
                    <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-10 md:p-12">
                        <div className="flex items-center gap-4 mb-8">
                            <button onClick={() => setCorrectionMode('triagem')} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
                                <ChevronDown size={24} className="rotate-90" />
                            </button>
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Descreva a divergência</h2>
                        </div>

                        <p className="text-slate-500 text-sm font-medium mb-8">Explique de forma clara o que está incorreto no relatório. O administrador irá analisar e entrar em contacto se necessário.</p>

                        <textarea
                            rows="8"
                            value={reportJustification}
                            onChange={(e) => setReportJustification(e.target.value)}
                            placeholder="Ex: O colaborador João Silva não esteve presente no dia 15..."
                            className="w-full border-2 border-slate-100 rounded-3xl p-6 bg-slate-50 text-slate-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none mb-10 shadow-inner"
                        ></textarea>

                        <div className="flex flex-col gap-4">
                            <button
                                onClick={async () => {
                                    if (!reportJustification.trim()) { alert("Por favor, descreva o problema."); return; }

                                    const notifId = `notif_corr_${initialClientId}_${initialMonth}_quick`;
                                    const correcoesTexto = generateCorrectionMessage(true);
                                    // Envia TODOS os trabalhadores e TODOS os dias do mês no payload para que o admin possa editar qualquer dia
                                    const fullMonthSnapshot = draftData;
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
                                    const correcaoId = `correcao_${initialClientId}_${initialMonth}_quick`;
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

                                    // Include correcao_id in notification payload so admin can update status
                                    const newNotifWithCorrecaoId = {
                                        ...newNotif,
                                        payload: { ...newNotif.payload, correcao_id: correcaoId }
                                    };
                                    await saveToDb('app_notifications', notifId, newNotifWithCorrecaoId);

                                    goToView('sucesso_reporte');
                                }}
                                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all"
                            >
                                Enviar Mensagem ao Admin
                            </button>
                            <button onClick={() => setCorrectionMode('triagem')} className="w-full py-5 text-slate-400 font-black uppercase tracking-widest text-[10px]">Alterar Método</button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="animate-fade-in space-y-6 max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setCorrectionMode('triagem')} className="p-3 text-slate-400 hover:bg-slate-100 hover:text-slate-800 rounded-xl transition-all shadow-sm border border-slate-50"><ChevronDown size={20} className="rotate-90" /></button>
                        <div><h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Ajuste de Precisão</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Selecione o colaborador para editar</p></div>
                    </div>
                    <div className="text-right bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Novo Total do Mês</p>
                        <p className={`text-3xl font-black ${draftTotal !== originalTotal ? 'text-amber-500' : 'text-slate-800'}`}>{draftTotal}h</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Lista de Colaboradores (Cards Laterais) */}
                    <div className="lg:col-span-1 space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                        {draftData.map(w => {
                            const workerChanged = w.editedTotalHours !== w.totalHours;
                            const isEditing = editingWorkerId === w.id;
                            return (
                                <button
                                    key={w.id}
                                    onClick={() => setEditingWorkerId(w.id)}
                                    className={`w-full p-6 rounded-[2rem] border-2 transition-all text-left flex flex-col gap-2 ${isEditing ? 'border-indigo-600 bg-white shadow-xl shadow-indigo-100/50 translate-x-2' : 'border-slate-100 bg-white hover:border-slate-300'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${workerChanged ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                            {workerChanged ? '!' : '✓'}
                                        </span>
                                        <span className="text-[10px] font-black uppercase text-slate-400">{w.editedTotalHours}h</span>
                                    </div>
                                    <h4 className="font-black text-slate-800 leading-tight">{w.name}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{w.role}</p>
                                </button>
                            );
                        })}
                    </div>

                    {/* Área de Edição (Direita) */}
                    <div className="lg:col-span-2 h-full">
                        {!editingWorkerId ? (
                            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] h-[500px] flex flex-col items-center justify-center text-center p-10">
                                <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mb-6">
                                    <ChevronDown size={32} />
                                </div>
                                <h4 className="text-xl font-black text-slate-800 mb-2">Selecione um colaborador</h4>
                                <p className="text-sm text-slate-400 font-medium max-w-xs">Clique na lista à esquerda para começar a ajustar os horários individuais.</p>
                            </div>
                        ) : (
                            <div className="h-full">
                                <PrecisionReportReview
                                    draftData={draftData}
                                    originalTotal={originalTotal}
                                    draftTotal={draftTotal}
                                    reportJustification={reportJustification}
                                    readOnly={false}
                                    showAllDays={false}
                                    selectedWorkerId={editingWorkerId}
                                    title={clientData.period}
                                    subtitle="Ajustando registos diários"
                                    onBack={() => setEditingWorkerId(null)}
                                    onEditDay={handleTimeChange}
                                    onDeleteDay={(workerId, dayDate) => {
                                        handleTimeChange(workerId, dayDate, 'entry', '--:--');
                                        handleTimeChange(workerId, dayDate, 'exit', '--:--');
                                        handleTimeChange(workerId, dayDate, 'breakStart', '--:--');
                                        handleTimeChange(workerId, dayDate, 'breakEnd', '--:--');
                                    }}
                                    onConfirm={() => goToView('rever_alteracoes')}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Secção de Comentário Final */}
                <section className="bg-white rounded-[3rem] shadow-xl border border-slate-100 p-10 mt-10">
                    <div className="flex items-center gap-4 mb-6 text-slate-400">
                        <MessageCircle size={20} />
                        <label className="text-[10px] font-black uppercase tracking-[0.3em]">Justificação Geral</label>
                    </div>
                    <textarea rows="4" value={reportJustification} onChange={(e) => setReportJustification(e.target.value)} placeholder="Ex: O João chegou uma hora mais tarde no dia 2..." className="w-full border-2 border-slate-100 rounded-[2rem] p-6 bg-slate-50 text-slate-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner"></textarea>
                </section>
            </div>
        );
    };

    const generateCorrectionMessage = (isQuickMessage = false) => {
        const changedWorkers = isQuickMessage ? draftData : draftData.filter(w => w.dailyRecords.some(d => {
            const isNewDay = !d.entry || d.entry === '--:--' || !d.exit || d.exit === '--:--';
            const originalEntry = d.entry === '--:--' ? '' : d.entry;
            const originalExit = d.exit === '--:--' ? '' : d.exit;
            const wasEdited = d.editedEntry || d.editedExit || d.editedBreakStart || d.editedBreakEnd;
            const hasChange = d.editedEntry !== originalEntry || d.editedExit !== originalExit || d.editedBreakStart !== (d.breakStart || '') || d.editedBreakEnd !== (d.breakEnd || '');
            return isNewDay ? wasEdited : hasChange;
        }));

        const diffTotal = (draftTotal - originalTotal).toFixed(2);

        let correcoesTexto = isQuickMessage ? `💬 MENSAGEM DE DIVERGÊNCIA: ${clientData.name}\n` : `⚠️ PEDIDO DE CORREÇÃO: ${clientData.name}\n`;
        correcoesTexto += `📅 Período: ${clientData.period}\n\n`;

        if (!isQuickMessage) {
            correcoesTexto += `📊 RESUMO GERAL:\n`;
            correcoesTexto += `• Total Original: ${originalTotal}h\n`;
            correcoesTexto += `• Novo Total Sugerido: ${draftTotal}h\n`;
            correcoesTexto += `• Diferença: ${diffTotal > 0 ? '+' : ''}${diffTotal}h\n\n`;
            correcoesTexto += `👥 DETALHES POR COLABORADOR:\n\n`;
            changedWorkers.forEach(w => {
                const wDiff = (w.editedTotalHours - w.totalHours).toFixed(2);
                correcoesTexto += `👤 ${w.name.toUpperCase()} [ID:${w.id}]\n`;
                correcoesTexto += `   Total: ${w.totalHours}h ➔ ${w.editedTotalHours}h (${wDiff > 0 ? '+' : ''}${wDiff}h)\n`;
                correcoesTexto += `   Alterações:\n`;

                const relevantDays = w.dailyRecords.filter(d => {
                    const isNewDay = !d.entry || d.entry === '--:--' || !d.exit || d.exit === '--:--';
                    const originalEntry = d.entry === '--:--' ? '' : d.entry;
                    const originalExit = d.exit === '--:--' ? '' : d.exit;
                    const wasEdited = d.editedEntry || d.editedExit || d.editedBreakStart || d.editedBreakEnd;
                    const hasChange = d.editedEntry !== originalEntry || d.editedExit !== originalExit || d.editedBreakStart !== (d.breakStart || '') || d.editedBreakEnd !== (d.breakEnd || '');
                    return isNewDay ? wasEdited : hasChange;
                });

                relevantDays.forEach(d => {
                    const isNewDay = !d.entry || d.entry === '--:--' || !d.exit || d.exit === '--:--';
                    const originalEntry = d.entry === '--:--' || !d.entry ? '' : d.entry;
                    const originalExit = d.exit === '--:--' || !d.exit ? '' : d.exit;
                    const originalShift = (!originalEntry || !originalExit || originalEntry === '--' || originalExit === '--') ? '--:--' : `${originalEntry}-${originalExit}`;
                    const editedShift = `${d.editedEntry || '--:--'}-${d.editedExit || '--:--'}`;
                    const originalBreak = `${d.breakStart || '--:--'}-${d.breakEnd || '--:--'}`;
                    const editedBreak = `${d.editedBreakStart || '--:--'}-${d.editedBreakEnd || '--:--'}`;

                    const displayDate = d.rawDate && d.rawDate.includes('/') ? d.date : (d.rawDate || d.date);
                    correcoesTexto += `   • ${displayDate}:\n`;
                    correcoesTexto += `     - Turno: ${originalShift} ➔ ${editedShift}\n`;
                    if (originalBreak !== '--:----:--' || editedBreak !== '--:----:--') {
                        correcoesTexto += `     - Pausa: ${originalBreak} ➔ ${editedBreak}\n`;
                    }
                    const origH = isNewDay ? 0 : d.hours;
                    correcoesTexto += `     - Horas: ${origH}h ➔ ${d.editedHours}h\n`;
                });
                correcoesTexto += `\n`;
            });
        }

        if (reportJustification) {
            correcoesTexto += `💬 JUSTIFICAÇÃO:\n"${reportJustification}"`;
        }

        return correcoesTexto;
    };

    const handlePrecisionConfirm = async () => {
        const correcoesTexto = generateCorrectionMessage(false);
        const changedWorkers = draftData.map(w => ({
            ...w,
            dailyRecords: w.dailyRecords.map(d => ({ ...d, date: d.rawDate || d.date }))
        }));

        const notifId = `notif_corr_${initialClientId}_${initialMonth}_precision`;
        const newNotif = {
            id: notifId,
            title: `Pedido de Correção: ${clientData.name}`,
            message: correcoesTexto,
            type: 'warning',
            target_type: 'admin',
            target_client_id: initialClientId,
            target_worker_ids: [],
            payload: { changes: changedWorkers, isFullMonth: true, month: initialMonth, reportType: 'precision' },
            is_dismissible: true,
            is_active: true,
            created_at: new Date().toISOString()
        };
        const correcaoId = `correcao_${initialClientId}_${initialMonth}_precision`;
        const correcaoRecord = {
            id: correcaoId,
            title: `Pedido de Correção: ${clientData.name}`,
            message: correcoesTexto,
            status: 'pending',
            client_id: initialClientId,
            month: initialMonth,
            payload: { changes: changedWorkers, isFullMonth: true, month: initialMonth, reportType: 'precision' },
            created_at: new Date().toISOString()
        };
        await saveToDb('corrections', correcaoId, correcaoRecord);

        const newNotifWithCorrecaoId = {
            ...newNotif,
            payload: { ...newNotif.payload, correcao_id: correcaoId }
        };
        await saveToDb('app_notifications', notifId, newNotifWithCorrecaoId);

        goToView('sucesso_reporte');
    };

    const renderReverAlteracoes = () => {
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

        // Mostramos todos os trabalhadores que têm qualquer registo (original ou novo)
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

                        const newNotifWithCorrecaoId = {
                            ...newNotif,
                            payload: { ...newNotif.payload, correcao_id: correcaoId }
                        };
                        await saveToDb('app_notifications', notifId, newNotifWithCorrecaoId);

                        goToView('sucesso_reporte');
                    }} className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xl shadow-indigo-600/30 active:scale-95">Confirmar e Enviar</button>
                </div>
            </div>
        );
    };

    const renderSucessoAssinatura = () => (
        <div className="animate-fade-in flex flex-col items-center justify-center py-20 px-4 text-center mt-10 w-full max-w-2xl mx-auto bg-white rounded-[3rem] shadow-xl border border-slate-100">
            <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner border border-emerald-100">
                ✅
            </div>
            <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter mb-4">Aprovado Com Sucesso</h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest max-w-md mx-auto mb-10 leading-relaxed">A sua assinatura foi registada na plataforma central e o processo concluído.</p>
            <button onClick={() => goToView('inicio')} className="text-slate-500 font-black text-[10px] uppercase tracking-widest bg-slate-50 px-8 py-4 rounded-2xl border border-slate-200 hover:bg-slate-100 hover:text-slate-800 transition-all shadow-sm">Ver Resumo Novamente</button>
        </div>
    );

    const renderSucessoReporte = () => (
        <div className="animate-fade-in flex flex-col items-center justify-center py-20 px-4 text-center mt-10 w-full max-w-2xl mx-auto bg-white rounded-[3rem] shadow-xl border border-slate-100">
            <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner border border-indigo-100">
                🚀
            </div>
            <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter mb-4">Correções Enviadas</h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest max-w-md mx-auto mb-10 leading-relaxed">O relatório detalhado com os pedidos de alteração foi enviado para análise pelo administrador.</p>
            <button onClick={() => goToView('inicio')} className="text-slate-500 font-black text-[10px] uppercase tracking-widest bg-slate-50 px-8 py-4 rounded-2xl border border-slate-200 hover:bg-slate-100 hover:text-slate-800 transition-all shadow-sm">Voltar ao Início</button>
        </div>
    );

    const renderLogin = () => (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <img src={systemSettings?.companyLogo || 'MAGNETIC (3).png'} alt="Logo" className="h-14 mx-auto mb-4 object-contain" onError={e => e.target.style.display = 'none'} />
                    <h1 className="text-3xl font-black text-white uppercase tracking-tight">Portal do Cliente</h1>
                    <p className="text-indigo-400 font-bold text-sm mt-2 uppercase tracking-widest">Aceda à sua área reservada</p>
                </div>
                <div className="bg-white/10 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-10 border border-white/10 shadow-2xl">
                    <div className="space-y-5">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">NIF</label>
                            <input type="text" value={loginNif} onChange={e => setLoginNif(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="NIF do cliente" className="w-full px-5 py-4 bg-white/10 border border-white/10 rounded-2xl text-white placeholder-slate-400 font-bold text-sm focus:outline-none focus:border-indigo-400 transition-all" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">Email</label>
                            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="Email associado" className="w-full px-5 py-4 bg-white/10 border border-white/10 rounded-2xl text-white placeholder-slate-400 font-bold text-sm focus:outline-none focus:border-indigo-400 transition-all" />
                        </div>
                        {loginError && (
                            <div className="bg-rose-500/20 border border-rose-400/30 rounded-xl px-4 py-3 text-rose-200 text-xs font-bold text-center">{loginError}</div>
                        )}
                        <button onClick={handleLogin} disabled={clients.length === 0} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">{clients.length === 0 ? 'A carregar...' : 'Entrar'}</button>
                    </div>
                </div>
                <p className="text-center text-indigo-400/60 text-[10px] font-bold mt-6 uppercase tracking-widest">© {new Date().getFullYear()} {systemSettings?.companyName || 'Magnetic Place'}</p>
            </div>
        </div>
    );

    if (!clientSession && !isDirectAccess) {
        return renderLogin();
    }

    return (
        <div className={`min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-200 font-sans ${printingWorker ? 'pb-0 bg-white' : 'pb-20'}`}>
            {/* Banner fixo no topo — igual ao do trabalhador */}
            {!printingWorker && myNotifications.length > 0 && (
                <div className="fixed top-4 left-4 right-4 z-[9999] pointer-events-none space-y-3 max-w-xl mx-auto">
                    {myNotifications.map(notif => (
                        <div key={notif.id} className="pointer-events-auto animate-in slide-in-from-top-4 duration-700">
                            <div className={`rounded-[2rem] p-0.5 shadow-2xl ${
                                notif.type === 'error' ? 'bg-gradient-to-br from-rose-500 to-red-600' :
                                notif.type === 'success' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' :
                                notif.type === 'warning' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                                'bg-gradient-to-br from-indigo-500 to-violet-600'
                            }`}>
                                <div className="bg-white/95 backdrop-blur-md rounded-[1.95rem] p-4 shadow-inner">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2.5 rounded-2xl shrink-0 ${
                                            notif.type === 'error' ? 'bg-rose-50 text-rose-600' :
                                            notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                                            notif.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                                            'bg-indigo-50 text-indigo-600'
                                        }`}>
                                            {notif.type === 'error' ? <AlertCircle size={20} /> : <Bell size={20} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">{notif.title}</h3>
                                            <p className="text-[10px] font-bold text-slate-500 mt-0.5 leading-tight line-clamp-1">{notif.message}</p>
                                        </div>
                                        <button onClick={() => handleDismissNotif(notif.id)} className="p-1.5 text-slate-300 hover:text-slate-600 transition-all hover:bg-slate-50 rounded-xl shrink-0"><X size={18} /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {!printingWorker ? (
                <main className="max-w-6xl mx-auto px-4 md:px-8 mt-12">
                    <div className="mb-12 text-center animate-fade-in">
                        <h1 className="text-5xl md:text-7xl font-black text-slate-900 uppercase tracking-tighter mb-4 leading-none">
                            Portal do <span className="text-indigo-600">Cliente</span>
                        </h1>
                        <div className="flex items-center justify-center gap-4">
                            <div className="h-[2px] w-12 bg-slate-200"></div>
                            <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-[0.5em]">Validação e Aprovação de Horas</p>
                            <div className="h-[2px] w-12 bg-slate-200"></div>
                        </div>
                    </div>
                    {/* Detalhe inline apenas para contra-propostas (precisam de botões aceitar/rejeitar) */}
                    {myNotifications.filter(n => n.payload?.type === 'counter_proposal').length > 0 && (
                        <div className="mb-8 space-y-4">
                            {myNotifications.filter(n => n.payload?.type === 'counter_proposal').map(notif => (
                                <div key={notif.id} className="relative overflow-hidden bg-white border border-indigo-100 rounded-[2rem] shadow-xl shadow-indigo-100/30 animate-fade-in">
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
                                                                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Justificação do Administrador</p>
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
                                                                        let labelClass = 'text-[10px] text-slate-500';
                                                                        let valueClass = 'text-xs text-slate-700 font-mono';

                                                                        if (label.includes('Original')) {
                                                                            valueClass = 'text-xs text-slate-500 font-mono';
                                                                        } else if (label.includes('Cliente')) {
                                                                            valueClass = 'text-xs text-amber-600 font-mono font-bold';
                                                                        } else if (label.includes('Admin')) {
                                                                            valueClass = 'text-xs text-indigo-600 font-mono font-bold';
                                                                        }

                                                                        return (
                                                                            <div key={i} className="flex items-center ml-4 gap-2 py-0.5">
                                                                                <span className={labelClass}>{label}:</span>
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
                                                                <CheckCircle size={14} /> Validar Horas
                                                            </button>
                                                            <button
                                                                onClick={() => handleDismissNotif(notif.id)}
                                                                className="bg-slate-100 text-slate-500 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                                                            >
                                                                Fechar
                                                            </button>
                                                        </>
                                                    ) : notif.payload?.type === 'counter_proposal' ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleAcceptContestation(notif)}
                                                                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 flex items-center gap-2"
                                                            >
                                                                <CheckCircle size={14} /> Aceitar Contra-proposta
                                                            </button>
                                                            <button
                                                                onClick={() => handleDismissNotif(notif.id)}
                                                                className="bg-slate-100 text-slate-500 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                                                            >
                                                                Ignorar
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleDismissNotif(notif.id)}
                                                            className="bg-slate-100 text-slate-500 px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                                                        >
                                                            Fechar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {(currentView === 'inicio' || currentView === 'hoje') && (
                        <div className="flex gap-2 mb-6">
                            <button onClick={() => setCurrentView('inicio')} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${currentView === 'inicio' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>Início</button>
                            <button onClick={() => setCurrentView('hoje')} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${currentView === 'hoje' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>Histórico</button>
                        </div>
                    )}
                    {currentView === 'inicio' && renderInicio()}
                    {currentView === 'hoje' && renderHistorico()}
                    {currentView === 'editar_relatorio' && (
                        <ClientReportFlow
                            clientId={initialClientId}
                            month={initialMonth}
                            workers={(() => {
                                const ids = new Set(
                                    logs
                                        .filter(l => String(l.clientId) === String(initialClientId) && l.date && l.date.substring(0, 7) === initialMonth)
                                        .map(l => String(l.workerId))
                                );
                                return workers.filter(w => ids.has(String(w.id)));
                            })()}
                            logs={logs}
                            onClose={() => goToView('inicio')}
                        />
                    )}
                    {currentView === 'rever_alteracoes' && renderReverAlteracoes()}
                    {currentView === 'precision_review' && (
                        <PrecisionReportReview
                            draftData={draftData}
                            originalTotal={originalTotal}
                            draftTotal={draftTotal}
                            reportJustification={reportJustification}
                            onBack={() => goToView('rever_alteracoes')}
                            onConfirm={handlePrecisionConfirm}
                            onEditDay={handleTimeChange}
                            onDeleteDay={(workerId, dayDate) => {
                                handleTimeChange(workerId, dayDate, 'entry', '--:--');
                                handleTimeChange(workerId, dayDate, 'exit', '--:--');
                                handleTimeChange(workerId, dayDate, 'breakStart', '--:--');
                                handleTimeChange(workerId, dayDate, 'breakEnd', '--:--');
                            }}
                        />
                    )}
                    {currentView === 'sucesso_assinatura' && renderSucessoAssinatura()}
                    {currentView === 'sucesso_reporte' && renderSucessoReporte()}
                </main>
            ) : (
                <div className="w-full bg-white flex justify-center items-center min-h-screen">
                    <div className="w-[794px]">
                        {renderReport(printingWorker === 'all' ? null : printingWorker, false)}
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
        .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        input[type="time"]::-webkit-calendar-picker-indicator { background: transparent; bottom: 0; color: transparent; cursor: pointer; height: auto; left: 0; position: absolute; right: 0; top: 0; width: auto; }
        input[type="time"] { position: relative; }
        @page { size: A4 portrait; margin: 0; }
        @media print {
          body {
             margin: 0;
             background-color: white !important;
          }
          #root {
            background-color: white !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .a4-paper {
            margin: 0 !important;
            padding: 30px !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
          }
        }
      `}} />
        </div>
    );
}