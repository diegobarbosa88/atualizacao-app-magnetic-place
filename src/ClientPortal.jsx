import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Download, ChevronDown, Printer, Loader2, Bell, X, AlertCircle, Info, Megaphone, Sparkles, History, MessageCircle, CheckCircle } from 'lucide-react';

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
  const [editingWorkerId, setEditingWorkerId] = useState(null);
  const canvasRef = useRef(null);

  const isApproved = useMemo(() => {
    return clientApprovals?.some(a => a.client_id === initialClientId && a.month === initialMonth);
  }, [clientApprovals, initialClientId, initialMonth]);

  const approvalData = useMemo(() => {
    return clientApprovals?.find(a => a.client_id === initialClientId && a.month === initialMonth);
  }, [clientApprovals, initialClientId, initialMonth]);

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
    
    const channel = supabase
      .channel('client-portal-logs')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'logs',
        filter: `clientId=eq.${initialClientId}`
      }, (payload) => {
        console.log('Mudança em tempo real nos logs do cliente:', payload);
        
        if (payload.eventType === 'UPDATE') {
          setLogs(prev => prev.map(log => 
            log.id === payload.new.id ? { ...log, ...payload.new } : log
          ));
        } else if (payload.eventType === 'INSERT') {
          setLogs(prev => [...prev, payload.new]);
        }
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
  
  const [dismissedNotifs, setDismissedNotifs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`dismissed_client_notifs_${initialClientId}`) || '[]');
    } catch { return []; }
  });

  const myNotifications = useMemo(() => {
    console.log("Notificações Totais:", appNotifications);
    console.log("ID do Cliente no Portal:", initialClientId);
    
    if (!appNotifications || !initialClientId) return [];
    
    const filtered = appNotifications.filter(n => {
      const matchTarget = n.target_type === 'client';
      // Compara IDs convertendo ambos para string para evitar erro de tipo (123 vs "123")
      const matchClientId = String(n.target_client_id) === String(initialClientId);
      const isActive = n.is_active === true;
      const notDismissed = !dismissedNotifs.includes(n.id);
      
      return matchTarget && matchClientId && isActive && notDismissed;
    });

    console.log("Notificações Filtradas para este Cliente:", filtered);
    return filtered;
  }, [appNotifications, initialClientId, dismissedNotifs]);

  const handleAcceptContestation = async (notif) => {
    const changes = notif.payload?.changes;
    if (!changes || !Array.isArray(changes)) {
      alert("Erro: Não foi possível encontrar os dados da contra-proposta.");
      return;
    }

    try {
      // 1. Aplicar as alterações nos LOGS originais e atualizar estado local
        for (const w of changes) {
          for (const d of w.dailyRecords) {
            // Procurar o log original
            // Usar workerId e clientId normalizados como string para comparação
            const targetWorkerId = String(w.id);
            const targetClientId = String(initialClientId);
            const targetDate = d.date || d.dateLabel || d.rawDate;

            const originalLog = logs.find(l => 
              String(l.workerId || l.worker_id) === targetWorkerId && 
              l.date === targetDate && 
              String(l.clientId || l.client_id) === targetClientId
            );

            if (originalLog) {
              const updatedLog = {
                ...originalLog,
                startTime: d.adminEntry || d.editedEntry || d.newEntry,
                endTime: d.adminExit || d.editedExit || d.newExit,
                breakStart: d.adminBreakStart || d.editedBreakStart || d.newBreakStart,
                breakEnd: d.adminBreakEnd || d.editedBreakEnd || d.newBreakEnd,
                hours: d.adminHours || d.editedHours || d.newHours
              };
              await saveToDb('logs', originalLog.id, updatedLog);
              
              setLogs(prev => prev.map(l => 
                l.id === originalLog.id ? { ...l, ...updatedLog } : l
              ));
            } else {
              // Se o log não existia, criar um novo
              const newId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              const newLog = {
                id: newId,
                date: targetDate,
                workerId: targetWorkerId,
                clientId: targetClientId,
                startTime: d.adminEntry || d.editedEntry || d.newEntry,
                endTime: d.adminExit || d.editedExit || d.newExit,
                breakStart: d.adminBreakStart || d.editedBreakStart || d.newBreakStart,
                breakEnd: d.adminBreakEnd || d.editedBreakEnd || d.newBreakEnd,
                hours: d.adminHours || d.editedHours || d.newHours,
                created_at: new Date().toISOString()
              };
              await saveToDb('logs', newId, newLog);
              setLogs(prev => [...prev, newLog]);
            }
          }
        }

      // 2. Notificar o administrador que o cliente aceitou e os dados foram aplicados
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

      // 3. Marcar a notificação atual como lida
      handleDismissNotif(notif.id);
      
      alert("As alterações foram aplicadas! Por favor, assine agora o relatório atualizado.");
      
      // 4. Levar o cliente para a área de assinatura
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

    } catch (error) {
      console.error("Erro ao aplicar contra-proposta:", error);
      alert("Ocorreu um erro ao atualizar os dados. Por favor, tente novamente.");
    }
  };

  const handleDismissNotif = (id) => {
    setDismissedNotifs(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      localStorage.setItem(`dismissed_client_notifs_${initialClientId}`, JSON.stringify(updated));
      return updated;
    });
  };

  const clientObj = clients.find(c => c.id === initialClientId) || { name: 'Cliente Não Encontrado' };
  const getMonthName = (monthStr) => {
    if (!monthStr || monthStr.length !== 7) return monthStr;
    const [y, m] = monthStr.split('-');
    const d = new Date(y, m - 1);
    return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  };
  
  const clientData = useMemo(() => {
    return { name: clientObj.name, period: getMonthName(initialMonth) };
  }, [clientObj, initialMonth]);

  const originalWorkersData = useMemo(() => {
    if (!initialClientId || !initialMonth) return [];
    const clientLogs = logs.filter(l => l.clientId === initialClientId && l.date && l.date.substring(0, 7) === initialMonth);
    const workerIds = [...new Set(clientLogs.map(l => l.workerId))];
    
    return workerIds.map(wId => {
      const w = workers.find(work => work.id === wId) || { name: 'Desconhecido', role: 'Colaborador' };
      const wLogs = clientLogs.filter(l => l.workerId === wId).sort((a,b) => a.date.localeCompare(b.date));
      let total = 0;
      const dailyRecords = wLogs.map(log => {
        let h = log.hours;
        if (h === undefined || h === null) h = calculateHoursDiff(log.startTime, log.endTime, log.breakStart, log.breakEnd);
        const dayObj = new Date(log.date);
        const dayStr = `${String(dayObj.getDate()).padStart(2, '0')}/${String(dayObj.getMonth()+1).padStart(2,'0')} (${dayObj.toLocaleDateString('pt-PT', { weekday: 'short' }).substring(0,3)})`;
        total += h;
        return { logId: log.id, date: dayStr, rawDate: log.date, entry: log.startTime || '--:--', exit: log.endTime || '--:--', hours: h, breakStart: log.breakStart, breakEnd: log.breakEnd };
      });
      return { id: wId, name: w.name, role: w.profissao || 'Colaborador', totalHours: parseFloat(total.toFixed(2)), dailyRecords };
    }).sort((a,b) => a.name.localeCompare(b.name));
  }, [logs, workers, initialClientId, initialMonth]);

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

    const allDates = getAllMonthDates(initialMonth);

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
                const dayLabel = `${String(dayObj.getDate()).padStart(2, '0')}/${String(dayObj.getMonth()+1).padStart(2,'0')} (${dayObj.toLocaleDateString('pt-PT', { weekday: 'short' }).substring(0,3)})`;
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
            if (d.date === dateStr) {
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

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      input[type="time"]::-webkit-calendar-picker-indicator { background: transparent; bottom: 0; color: transparent; cursor: pointer; height: auto; left: 0; position: absolute; right: 0; top: 0; width: auto; }
      input[type="time"] { position: relative; }
    `;
    document.head.appendChild(style);
    return () => {
       if (document.head.contains(style)) {
           document.head.removeChild(style);
       }
    };
  }, []);

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
                                {renderReport(worker.id, true)}
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
      <section className="approval-section bg-white rounded-[3rem] shadow-xl border border-slate-100 p-8 md:p-12 animate-in slide-in-from-bottom-8 duration-500">
        {isApproved ? (
          <div className="text-center py-6">
            <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-100 shadow-lg shadow-emerald-200/50">
              <CheckCircle size={48} />
            </div>
            <h3 className="font-black text-3xl text-slate-800 uppercase tracking-tighter mb-4">Relatório Validado</h3>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest max-w-md mx-auto mb-10 leading-relaxed">
              Este relatório já foi validado e assinado digitalmente em <span className="text-emerald-600">{new Date(approvalData?.created_at).toLocaleString('pt-PT')}</span>.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-lg mx-auto">
              <button 
                onClick={handleDownloadAll}
                className="w-full sm:flex-1 px-8 py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-200 active:scale-95 flex items-center justify-center gap-3"
              >
                <Download size={20} /> Baixar Relatório Assinado
              </button>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4 max-w-sm">
                <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                  <img src={approvalData?.signature_base64} alt="Sua Assinatura" className="h-10 w-auto mix-blend-multiply" />
                </div>
                <div className="text-left">
                  <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Sua Assinatura Digital</p>
                  <p className="text-[7px] font-bold text-slate-400 mt-0.5">IP: {approvalData?.client_ip}</p>
                </div>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">A possibilidade de edição foi desativada após a aprovação.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
                <h3 className="font-black text-2xl text-slate-800 uppercase tracking-tighter mb-2">Aprovação do Cliente</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Assine abaixo para validar e aprovar o relatório de {originalTotal} horas.</p>
            </div>
            
            <div className="relative w-full max-w-2xl mx-auto bg-slate-50 border-2 border-dashed border-slate-300 rounded-[2rem] overflow-hidden mb-6 shadow-inner">
              <canvas ref={canvasRef} className="w-full cursor-crosshair touch-none" style={{ touchAction: 'none' }} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
              {!hasSignature && <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 font-black text-2xl uppercase tracking-wider opacity-60">Assine Aqui</div>}
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-2xl mx-auto">
              <button onClick={clearCanvas} className="w-full sm:w-auto px-6 py-4 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Limpar Quadro</button>
              
              <button onClick={() => {
                  const canvas = canvasRef.current;
                  const base64Image = canvas.toDataURL('image/png');
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
                  
                  console.log("Saving approval to DB:", id, approvalData);
                  
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
                onClick={() => {
                  if (!reportJustification.trim()) { alert("Por favor, descreva o problema."); return; }
                  
                  const notifId = "notif_" + Date.now();
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
                      payload: { changes: fullMonthSnapshot, isFullMonth: true }, 
                      is_dismissible: true, 
                      is_active: true, 
                      created_at: new Date().toISOString()
                  };
                  saveToDb('app_notifications', notifId, newNotif).then(() => { goToView('sucesso_reporte'); });
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
            <div className="lg:col-span-2">
                {!editingWorkerId ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] h-[500px] flex flex-col items-center justify-center text-center p-10">
                        <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mb-6">
                            <ChevronDown size={32} />
                        </div>
                        <h4 className="text-xl font-black text-slate-800 mb-2">Selecione um colaborador</h4>
                        <p className="text-sm text-slate-400 font-medium max-w-xs">Clique na lista à esquerda para começar a ajustar os horários individuais.</p>
                    </div>
                ) : (
                    <div className="animate-fade-in bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col h-full max-h-[80vh]">
                        {/* Header do Colaborador Sendo Editado */}
                        <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800">{draftData.find(w => w.id === editingWorkerId)?.name}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ajustando registos diários</p>
                            </div>
                            <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                                <span className="text-[10px] font-black text-slate-400 uppercase mr-2">Total:</span>
                                <span className="font-black text-indigo-600">{draftData.find(w => w.id === editingWorkerId)?.editedTotalHours}h</span>
                            </div>
                        </div>

                        {/* Lista de Dias */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-white">
                            {draftData.find(w => w.id === editingWorkerId)?.dailyRecords.map(day => {
                                const isDayChanged = day.editedEntry !== (day.entry === '--:--' ? '' : day.entry) || 
                                                   day.editedExit !== (day.exit === '--:--' ? '' : day.exit) || 
                                                   day.editedBreakStart !== (day.breakStart || '') || 
                                                   day.editedBreakEnd !== (day.breakEnd || '');
                                
                                // Só mostrar se tiver registo original ou se o cliente tiver ativado "Mostrar Todos" ou se houver alteração
                                const shouldShow = day.isVisible || isDayChanged;
                                
                                if (!shouldShow) return null;

                                return (
                                    <div key={day.date} className={`p-4 rounded-2xl transition-all border ${isDayChanged ? 'border-amber-200 bg-amber-50/20' : 'border-slate-50 hover:bg-slate-50'}`}>
                                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                                            <div className="md:w-24">
                                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider block">{day.date}</span>
                                            </div>
                                            
                                            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Entrada</span>
                                                    <input type="time" value={day.editedEntry} onChange={(e) => handleTimeChange(editingWorkerId, day.date, 'entry', e.target.value)} className="bg-white border border-slate-200 p-2 rounded-xl text-xs font-black w-full text-center focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">I. Desc</span>
                                                    <input type="time" value={day.editedBreakStart} onChange={(e) => handleTimeChange(editingWorkerId, day.date, 'breakStart', e.target.value)} className="bg-white border border-slate-200 p-2 rounded-xl text-xs font-black w-full text-center focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">F. Desc</span>
                                                    <input type="time" value={day.editedBreakEnd} onChange={(e) => handleTimeChange(editingWorkerId, day.date, 'breakEnd', e.target.value)} className="bg-white border border-slate-200 p-2 rounded-xl text-xs font-black w-full text-center focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Saída</span>
                                                    <input type="time" value={day.editedExit} onChange={(e) => handleTimeChange(editingWorkerId, day.date, 'exit', e.target.value)} className="bg-white border border-slate-200 p-2 rounded-xl text-xs font-black w-full text-center focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-end md:w-16">
                                                <span className={`font-black text-xs px-2 py-1 rounded-lg ${isDayChanged ? 'text-amber-600 bg-amber-50' : 'text-slate-400'}`}>{day.editedHours}h</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Rodapé da Edição */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                            <button 
                                onClick={() => {
                                    setDraftData(prev => prev.map(w => {
                                        if (w.id === editingWorkerId) {
                                            return { ...w, dailyRecords: w.dailyRecords.map(d => ({ ...d, isVisible: true })) };
                                        }
                                        return w;
                                    }));
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-[10px] uppercase text-slate-400 hover:text-indigo-600 transition-all"
                            >
                                <History size={14} /> Mostrar Calendário Completo
                            </button>
                            <button onClick={() => setEditingWorkerId(null)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20">Concluir este Colaborador</button>
                        </div>
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

        <div className="flex justify-between items-center bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl mt-12 mb-20">
          <div className="hidden md:block">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Diferença Total</p>
            <p className="text-white font-black text-xl">{(draftTotal - originalTotal).toFixed(2)} horas</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button onClick={() => goToView('inicio')} className="flex-1 md:flex-none px-10 py-5 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-white transition-all">Cancelar</button>
            <button onClick={() => goToView('rever_alteracoes')} disabled={draftTotal === originalTotal && !reportJustification.trim()} className={`flex-1 md:flex-none px-12 py-5 font-black text-[10px] uppercase tracking-widest text-white rounded-2xl transition-all shadow-xl disabled:opacity-50 ${ (draftTotal !== originalTotal || reportJustification.trim()) ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30' : 'bg-slate-700 cursor-not-allowed'}`}>Rever Alterações</button>
          </div>
        </div>
      </div>
    );
  };

  const generateCorrectionMessage = (isQuickMessage = false) => {
    const changedWorkers = isQuickMessage ? draftData.filter(w => w.dailyRecords.some(d => d.hours > 0)) : draftData.filter(w => w.dailyRecords.some(d => {
        const originalEntry = d.entry === '--:--' ? '' : d.entry;
        const originalExit = d.exit === '--:--' ? '' : d.exit;
        return d.editedEntry !== originalEntry || d.editedExit !== originalExit || d.editedBreakStart !== (d.breakStart || '') || d.editedBreakEnd !== (d.breakEnd || '');
    }));
    
    const diffTotal = (draftTotal - originalTotal).toFixed(2);
    
    let correcoesTexto = isQuickMessage ? `💬 MENSAGEM DE DIVERGÊNCIA: ${clientData.name}\n` : `⚠️ PEDIDO DE CORREÇÃO: ${clientData.name}\n`;
    correcoesTexto += `📅 Período: ${clientData.period}\n\n`;
    
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
       
       const relevantDays = isQuickMessage ? w.dailyRecords.filter(d => d.hours > 0) : w.dailyRecords.filter(d => {
          const originalEntry = d.entry === '--:--' ? '' : d.entry;
          const originalExit = d.exit === '--:--' ? '' : d.exit;
          return d.editedEntry !== originalEntry || d.editedExit !== originalExit || d.editedBreakStart !== (d.breakStart || '') || d.editedBreakEnd !== (d.breakEnd || '');
       });

       relevantDays.forEach(d => {
           const originalShift = `${d.entry}-${d.exit}`;
           const editedShift = `${d.editedEntry}-${d.editedExit}`;
           const originalBreak = `${d.breakStart || '--:--'}-${d.breakEnd || '--:--'}`;
           const editedBreak = `${d.editedBreakStart || '--:--'}-${d.editedBreakEnd || '--:--'}`;
           
           correcoesTexto += `   • ${d.rawDate || d.date}:\n`;
           correcoesTexto += `     - Turno: ${originalShift} ➔ ${editedShift}\n`;
           if (originalBreak !== '--:----:--' || editedBreak !== '--:----:--') {
             correcoesTexto += `     - Pausa: ${originalBreak} ➔ ${editedBreak}\n`;
           }
           correcoesTexto += `     - Horas: ${d.hours}h ➔ ${d.editedHours}h\n`;
       });
       correcoesTexto += `\n`;
    });

    if (reportJustification) {
        correcoesTexto += `💬 JUSTIFICAÇÃO:\n"${reportJustification}"`;
    }
    
    return correcoesTexto;
  };

  const renderReverAlteracoes = () => {
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
          <button onClick={() => {
              const correcoesTexto = generateCorrectionMessage(false);
              // Filtra para enviar APENAS os dias que foram modificados pelo cliente
              const changedWorkers = draftData.map(w => {
                const modifiedDays = w.dailyRecords.filter(d => {
                  const originalEntry = d.entry === '--:--' ? '' : d.entry;
                  const originalExit = d.exit === '--:--' ? '' : d.exit;
                  const originalBStart = d.breakStart || '';
                  const originalBEnd = d.breakEnd || '';
                  return d.editedEntry !== originalEntry || 
                         d.editedExit !== originalExit || 
                         d.editedBreakStart !== originalBStart || 
                         d.editedBreakEnd !== originalBEnd;
                });
                return { ...w, dailyRecords: modifiedDays };
              }).filter(w => w.dailyRecords.length > 0);

              const notifId = "notif_" + Date.now();
              const newNotif = {
                  id: notifId, 
                  title: `Pedido de Correção: ${clientData.name}`, 
                  message: correcoesTexto,
                  type: 'warning', 
                  target_type: 'admin', 
                  target_client_id: initialClientId,
                  target_worker_ids: [],
                  payload: { changes: changedWorkers, isOnlyModified: true },
                  is_dismissible: true, 
                  is_active: true, 
                  created_at: new Date().toISOString()
              };
              saveToDb('app_notifications', notifId, newNotif).then(() => { goToView('sucesso_reporte'); });
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

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-200 font-sans ${printingWorker ? 'pb-0 bg-white' : 'pb-20'}`}>
      {!printingWorker && <Header />}
      
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
        {/* Banner de Notificações */}
        {myNotifications.length > 0 && (
          <div className="mb-8 space-y-4">
            {myNotifications.map(notif => (
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
                        {notif.payload?.type === 'correcoes_aplicadas' ? (
                          <>
                            <button 
                              onClick={() => {
                                goToView('inicio');
                                setTimeout(() => {
                                  const signatureSection = document.querySelector('.approval-section');
                                  if (signatureSection) {
                                    signatureSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }
                                }, 100);
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

        {currentView === 'inicio' && renderInicio()}
        {currentView === 'editar_relatorio' && renderEditarRelatorio()}
        {currentView === 'rever_alteracoes' && renderReverAlteracoes()}
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

      <style dangerouslySetInnerHTML={{ __html: `
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
            padding: 0 !important;
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