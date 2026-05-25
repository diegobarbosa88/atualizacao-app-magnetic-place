import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Download, Loader2, Printer, Settings2, ZoomIn, ZoomOut } from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import ValidationStamp from './ValidationStampWithQR';
import './ClientTimesheetReport.css';
import { toISODateLocal, isSameMonth, getLastBusinessDayOfMonth, formatDocDate, monthToYYYYMM, getISOWeek } from '../../utils/dateUtils';
import { formatHours, calculateDuration, calculateExpectedMonthlyHours, calculateExpectedDailyHours, getScheduleForDay, formatCurrency, toTimeInputValue } from '../../utils/formatUtils';

const ClientTimesheetReport = ({ data, onBack, isEmbedded = false, hideActions = false }) => {
  const { client, logs, workers, clients, month, workerId, clientApprovals } = data;

  const [visibleColumns, setVisibleColumns] = useState({
    day: true,
    start: true,
    breakStart: true,
    breakEnd: true,
    end: true,
    total: true,
    project: true,
    comment: false
  });

  const [isZipping, setIsZipping] = useState(false);
  const reportContainerRef = useRef(null);

  // Zoom / scale for embedded mode
  const scaleWrapperRef = useRef(null);
  const scaleContentRef = useRef(null);
  const [autoScale, setAutoScale] = useState(1);
  const [manualZoom, setManualZoom] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [scaledContainerHeight, setScaledContainerHeight] = useState(null);
  const scale = (isExporting || isPrinting) ? 1 : (manualZoom ?? autoScale);

  useEffect(() => {
    const before = () => setIsPrinting(true);
    const after = () => setIsPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  useEffect(() => {
    if (!isEmbedded) return;
    const update = () => {
      if (scaleWrapperRef.current) {
        const w = scaleWrapperRef.current.offsetWidth;
        setAutoScale(Math.min(1, w / 794));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (scaleWrapperRef.current) ro.observe(scaleWrapperRef.current);
    return () => ro.disconnect();
  }, [isEmbedded]);

  useEffect(() => {
    if (!isEmbedded || isExporting || !scaleContentRef.current) return;
    const h = scaleContentRef.current.scrollHeight;
    setScaledContainerHeight(h * scale);
  });

  const columns = [
    { id: 'day', label: 'Dia', width: '30px' },
    { id: 'start', label: 'Entrada', width: '50px' },
    { id: 'breakStart', label: 'I. Desc', width: '50px' },
    { id: 'breakEnd', label: 'F. Desc', width: '50px' },
    { id: 'end', label: 'Saída', width: '50px' },
    { id: 'total', label: 'Total', width: '50px' },
    { id: 'project', label: 'Projeto', width: 'auto' },
    { id: 'comment', label: 'Comentário', width: 'auto' },
  ];

  const activeColumnsCount = Object.values(visibleColumns).filter(Boolean).length;



  const isClearedPattern = (val) => val === '--:--' || (val && val.startsWith('--:') && val.includes('-----'));

  // Groups logs and metadata for each individual report unit (Client + Worker pair)
  const reportUnits = useMemo(() => {
    if (!month) return [];

    let filteredLogs = logs.filter(l => l.date && l.date.startsWith(month));

    // Determine the grouping criteria based on the data provided
    let units = [];

    if (data.isGlobal) {
      // Global mode: group by (clientId, workerId) for ALL logs in the month
      const pairs = [...new Set(filteredLogs.map(l => `${l.clientId}:::${l.workerId}`))];
      units = pairs.map(pair => {
        const [cId, wId] = pair.split(':::');
        const unitLogs = filteredLogs.filter(l => l.clientId === cId && l.workerId === wId).sort((a, b) => a.date.localeCompare(b.date));
        const uClient = clients.find(c => c.id === cId);
        const uWorker = workers.find(w => w.id === wId);
        if (!uClient || !uWorker) return null;
        return {
          client: uClient,
          worker: uWorker,
          logs: unitLogs,
          totalHours: unitLogs.reduce((acc, l) => acc + calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd), 0),
          id: pair
        };
      }).filter(Boolean);
    } else if (client && !workerId) {
      // Client mode: all workers for ONE specified client
      const clientLogs = filteredLogs.filter(l => l.clientId === client.id);
      const workerIds = [...new Set(clientLogs.map(l => l.workerId))];
      units = workerIds.map(wId => {
        const unitLogs = clientLogs.filter(l => l.workerId === wId).sort((a, b) => a.date.localeCompare(b.date));
        return {
          client,
          worker: workers.find(w => w.id === wId),
          logs: unitLogs,
          totalHours: unitLogs.reduce((acc, l) => acc + calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd), 0),
          id: wId
        };
      });
    } else if (client && workerId) {
      // Specific mode: ONE client + ONE worker
      const specificLogs = filteredLogs.filter(l => l.clientId === client.id && l.workerId === workerId).sort((a, b) => a.date.localeCompare(b.date));
      if (specificLogs.length > 0) {
        units = [{
          client,
          worker: workers.find(w => w.id === workerId),
          logs: specificLogs,
          totalHours: specificLogs.reduce((acc, l) => acc + calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd), 0),
          id: workerId
        }];
      }
    } else if (!client && workerId) {
      // Worker mode (Consolidated): One worker across ALL clients — single report unit
      const workerLogs = filteredLogs.filter(l => l.workerId === workerId).sort((a, b) => a.date.localeCompare(b.date));
      const clientIds = [...new Set(workerLogs.map(l => l.clientId))];
      const clientBreakdowns = clientIds.map(cId => {
        const cLogs = workerLogs.filter(l => l.clientId === cId);
        const cName = clients.find(c => c.id === cId)?.name || '';
        const cHours = cLogs.reduce((acc, l) => acc + calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd), 0);
        return { clientId: cId, clientName: cName, hours: cHours };
      });
      const workerTotal = clientBreakdowns.reduce((acc, c) => acc + c.hours, 0);
      units = [{
        client: { id: null, name: 'Vários Clientes' },
        worker: workers.find(w => w.id === workerId),
        logs: workerLogs,
        totalHours: workerTotal,
        id: workerId,
        clientBreakdowns: clientBreakdowns.sort((a, b) => a.clientName.localeCompare(b.clientName)),
        isWorkerOnly: true
      }];
    }

    // Sort units: by Client Name then Worker Name
    return units.sort((a, b) => {
      const cComp = (a.client?.name || '').localeCompare(b.client?.name || '');
      if (cComp !== 0) return cComp;
      return (a.worker?.name || '').localeCompare(b.worker?.name || '');
    });
  }, [logs, client, month, workerId, workers, clients, data.isGlobal]);

  const daysInMonthList = useMemo(() => {
    if (!month || !month.includes('-')) return [];
    const [y, m] = month.split('-').map(Number);
    if (isNaN(y) || isNaN(m)) return [];
    const lastDay = new Date(y, m, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => {
      const d = String(i + 1).padStart(2, '0');
      return `${month}-${d}`;
    });
  }, [month]);

  // Group days by week
  const weeksData = useMemo(() => {
    const groups = {};
    daysInMonthList.forEach(dateStr => {
      const date = new Date(dateStr);
      const weekNum = getISOWeek(date);
      if (!groups[weekNum]) groups[weekNum] = [];
      groups[weekNum].push(dateStr);
    });
    return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
  }, [daysInMonthList]);

  // Update document.title for the PDF filename
  useEffect(() => {
    const originalTitle = document.title;
    if (reportUnits.length === 1) {
      const unit = reportUnits[0];
      const name = unit.worker?.name || 'Colaborador';
      const nameParts = name.trim().split(/\s+/);
      const shortName = nameParts.length > 1
        ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
        : name;

      const monthDisplay = daysInMonthList.length > 0
        ? new Date(daysInMonthList[0]).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
        : '';
      const clientLabel = unit.isWorkerOnly ? 'Vários Clientes' : (unit.client?.name || 'Empresa');
      const newTitle = `${shortName} - ${clientLabel} - ${monthDisplay}`;
      document.title = newTitle;
    } else if (month) {
      const monthDisplay = daysInMonthList.length > 0
        ? new Date(daysInMonthList[0]).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
        : month;
      document.title = `Relatório de Horas - ${monthDisplay}`;
    }

    return () => {
      document.title = originalTitle;
    };
}, [reportUnits, daysInMonthList, month]);

  const handlePrint = () => {
    const prev = manualZoom;
    setManualZoom(null);
    setIsExporting(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsExporting(false);
        setManualZoom(prev);
      }, 100);
    }, 100);
  };

  const handleGenerateZip = async () => {
    const prev = manualZoom;
    setManualZoom(null);
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 100));
    setIsZipping(true);
    try {
      const JSZipLib = (await import('jszip')).default;
      const html2canvas = (await import('html2canvas-pro')).default;
      const { jsPDF } = await import('jspdf');

      const zip = new JSZipLib();

      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      for (let i = 0; i < reportUnits.length; i++) {
        const unit = reportUnits[i];
        const clientName = (unit.client?.name || 'Sem_Cliente').replace(/[^a-zA-Z0-9]/g, '_');
        const workerName = (unit.worker?.name || 'Sem_Colaborador').replace(/[^a-zA-Z0-9]/g, '_');

        const folder = zip.folder(clientName);
        if (!folder) continue;

        const liveNode = document.getElementById(`report-unit-${i}`);
        if (!liveNode) continue;

        const clone = liveNode.cloneNode(true);

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;overflow:hidden;';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);
        await new Promise(r => setTimeout(r, 100));

        const scrollH = clone.scrollHeight;
        const actualW = clone.offsetWidth || 794;
        const canvas = await html2canvas(clone, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 794,
          width: actualW,
          height: scrollH,
        });

        document.body.removeChild(wrapper);

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const MARGIN_MM = 15;
        const usableH = pdfHeight - 2 * MARGIN_MM;
        const ratio = pdfWidth / canvas.width;
        const pageHeightPx = usableH / ratio;

        const totalContentPx = canvas.height;
        const totalPages = Math.max(1, Math.ceil(totalContentPx / pageHeightPx));

        if (totalPages <= 1) {
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, MARGIN_MM, pdfWidth, canvas.height * ratio);
        } else {
          for (let p = 0; p < totalPages; p++) {
            const sliceY = Math.floor(p * pageHeightPx);
            const nextSliceY = Math.floor((p + 1) * pageHeightPx);
            const isLast = p === totalPages - 1;
            const sliceH = isLast ? totalContentPx - sliceY : nextSliceY - sliceY;
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceH;
            sliceCanvas.getContext('2d').drawImage(
              canvas, 0, sliceY, canvas.width, sliceH, 0, 0, canvas.width, sliceH
            );
            const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.98);
            if (p > 0) pdf.addPage();
            pdf.addImage(sliceData, 'JPEG', 0, MARGIN_MM, pdfWidth, sliceH * ratio);
          }
        }

        folder.file(`Relatorio_${workerName}_${month}.pdf`, pdf.output('blob'));
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorios de horas ${month}.zip`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao gerar ZIP com PDFs:', error);
      alert('Ocorreu um erro ao processar os PDFs. Tente novamente.');
    } finally {
      setIsZipping(false);
      setIsExporting(false);
      setManualZoom(prev);
    }
  };


  return (
    <div ref={scaleWrapperRef} className={`bg-white font-sans text-slate-900 ${isEmbedded ? 'relative w-full' : 'min-h-screen absolute inset-0 z-[500]'} overflow-y-auto print:bg-white print:static print:overflow-visible print:inset-auto print:z-0 print:min-h-0 print:shadow-none print:border-none`}>

      <div ref={reportContainerRef} className={isEmbedded ? 'w-full pdf-export-mode' : 'max-w-5xl mx-auto p-4 sm:p-12 report-container pdf-export-mode'}>
        {!hideActions && (
          <div id="topo-da-pagina" className="no-print flex flex-col gap-6 mb-8 pb-6 border-b">
            <div className="flex justify-between items-center">
              {isEmbedded ? null : (
                <button onClick={onBack} className="px-6 py-2 bg-slate-100 text-slate-600 font-bold text-xs uppercase rounded-xl hover:bg-slate-200 transition-colors">Voltar</button>
              )}
              <div className="flex gap-3">
                <button id="magnetic-zip-btn" onClick={handleGenerateZip} disabled={isZipping} className="px-5 py-2.5 bg-emerald-600 text-white font-black text-xs uppercase rounded-xl shadow-lg flex items-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50">
                  {isZipping ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} ZIP
                </button>
                <button onClick={handlePrint} className="px-5 py-2.5 bg-slate-900 text-white font-black text-xs uppercase rounded-xl shadow-lg flex items-center gap-2 hover:bg-slate-800 transition-all"><Printer size={16} /> PDF/Imprimir</button>
              </div>
            </div>

            {!isEmbedded && (
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Settings2 size={16} className="text-indigo-600" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Selecionar Colunas Visíveis</h4>
                  </div>
                  <div className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-lg">Gerando {reportUnits.length} documentos individuais</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {columns.map(col => (
                    <button
                      key={col.id}
                      onClick={() => setVisibleColumns(prev => ({ ...prev, [col.id]: !prev[col.id] }))}
                      className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all border ${visibleColumns[col.id]
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300'
                        }`}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {isEmbedded && (
          <div className="no-print flex items-center justify-end gap-2 px-2 pb-2">
            <button
              onClick={() => setManualZoom(Math.max(0.2, (manualZoom ?? autoScale) - 0.1))}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-all"
              title="Diminuir zoom"
            ><ZoomOut size={14} /></button>
            <button
              onClick={() => setManualZoom(null)}
              className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase w-10 text-center"
              title="100%"
            >{Math.round(scale * 100)}%</button>
            <button
              onClick={() => setManualZoom(Math.min(1, (manualZoom ?? autoScale) + 0.1))}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-all"
              title="Aumentar zoom"
            ><ZoomIn size={14} /></button>
          </div>
        )}

        {reportUnits.length === 0 && isEmbedded && (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Sem registos para este período.</div>
        )}

        <div className="report-scale-outer" style={(isEmbedded && !isExporting && !isPrinting) ? { display: 'flex', justifyContent: 'center', height: scaledContainerHeight ? `${scaledContainerHeight}px` : undefined, overflow: 'hidden' } : undefined}>
        <div
          ref={isEmbedded ? scaleContentRef : null}
          className="report-scale-inner"
          style={(isEmbedded && !isExporting && !isPrinting) ? { transform: `scale(${scale})`, transformOrigin: 'top center', width: '794px', flexShrink: 0 } : undefined}
        >
        {reportUnits.map((unit, idx) => (
          <div key={`${unit.id}-${idx}`} id={`report-unit-${idx}`} className="a4-paper">
            {/* Header Section */}
            <div className="flex justify-between items-center mb-10 text-slate-900 border-b-2 border-slate-900 pb-3">
              <div className="flex items-center gap-4">
                <CompanyLogo className="h-11 w-auto" />
                <div>
                  <div className="text-[17pt] font-black uppercase tracking-tighter leading-none text-slate-900">Magnetic Place</div>
                  <div className="text-[8pt] font-black uppercase tracking-[0.3em] text-slate-400 mt-0.5">Unipessoal LDA</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[12pt] font-black text-slate-800 uppercase tracking-widest">
                  {daysInMonthList.length > 0 && new Date(daysInMonthList[0]).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                </div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {unit.isWorkerOnly ? 'Folha de Horas Mensal • Vários Clientes' : `Folha de Horas Mensal • ${unit.client?.name || ''}`}
                </div>
              </div>
            </div>

            <div className="employee-bar employee-bar-print flex justify-between items-center py-2 px-4 bg-slate-50 mb-4 mt-12">
              <div>
                <div className="text-[7px] font-black uppercase text-slate-400 tracking-[0.2em]">Colaborador</div>
                <div className="text-[12pt] font-black text-slate-800 uppercase leading-tight">{unit.worker?.name || 'Vários Colaboradores'}</div>
              </div>
              <div className="text-right">
                <div className="text-[7px] font-black uppercase text-indigo-400 tracking-[0.2em]">Total Registrado</div>
                <div className="text-[13pt] font-black text-indigo-600 leading-tight mt-0.5">{formatHours(unit.totalHours)}</div>
              </div>
            </div>

            {/* Table Section */}
            {/* Weekly Tables Section */}
            <div className="mb-2">
              {weeksData.map(([weekNum, dates]) => {
                let weekPerformed = 0;

                const dayRows = dates.map(dateStr => {
                  const dayLogs = unit.logs.filter(l => l.date === dateStr);
                  const dateObj = new Date(dateStr);
                  const dayNum = dateObj.getDate();
                  const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0, 3);

                  if (dayLogs.length === 0) {
                    return (
                      <tr key={dateStr} className="print-scale">
                        {visibleColumns.day && <td className="text-center font-bold text-slate-400 py-0 col-day">{dayNum} {dayName}</td>}
                        {visibleColumns.start && <td className="border-r border-slate-200 col-time"></td>}
                        {visibleColumns.breakStart && <td className="border-r border-slate-200 col-time"></td>}
                        {visibleColumns.breakEnd && <td className="border-r border-slate-200 col-time"></td>}
                        {visibleColumns.end && <td className="border-r border-slate-200 col-time"></td>}
                        {visibleColumns.total && <td className="border-r border-slate-200 col-time"></td>}
                        {visibleColumns.project && <td className="border-r border-slate-200 col-project"></td>}
                        {visibleColumns.comment && <td className="col-comment"></td>}
                      </tr>
                    );
                  }

                  return dayLogs.map((log, lIdx) => {
                    const isClearedDay =
                      (log.startTime == null && log.endTime == null) ||
                      (isClearedPattern(log.startTime) && isClearedPattern(log.endTime));
                    const logHours = isClearedDay ? 0 : calculateDuration(log.startTime, log.endTime, log.breakStart, log.breakEnd);
                    if (!isClearedDay) {
                      weekPerformed += logHours;
                    }
                    return (
                      <tr key={`${log.id}-${lIdx}`} className="page-break-inside-avoid">
                        {visibleColumns.day && <td className="text-center font-bold text-slate-700 py-0 col-day">{lIdx === 0 ? `${dayNum} ${dayName}` : ''}</td>}
                        {visibleColumns.start && <td className="text-center font-mono col-time">{log.startTime ?? ''}</td>}
                        {visibleColumns.breakStart && <td className="text-center font-mono text-slate-400 col-time">{isClearedDay ? '' : (log.breakStart || '')}</td>}
                        {visibleColumns.breakEnd && <td className="text-center font-mono text-slate-400 col-time">{isClearedDay ? '' : (log.breakEnd || '')}</td>}
                        {visibleColumns.end && <td className="text-center font-mono col-time">{log.endTime ?? ''}</td>}
                        {visibleColumns.total && <td className="text-center font-bold text-slate-700 col-time">{isClearedDay ? '' : formatHours(logHours)}</td>}
                        {visibleColumns.project && <td className="text-center font-medium text-slate-700 uppercase whitespace-nowrap col-project" style={{ fontSize: '8px' }}>{isClearedDay ? '' : (unit.isWorkerOnly ? (clients.find(c => c.id === log.clientId)?.name || '') : (unit.client?.name || ''))}</td>}
                        {visibleColumns.comment && <td className="text-center text-slate-500 italic col-comment" style={{ fontSize: '8px' }}>{log.description || ''}</td>}
                      </tr>
                    );
                  });
                }).flat();

                return (
                  <div key={weekNum} className="page-break-inside-avoid shadow-sm week-spacing">
                    <table className="report-table print-table mb-0">
                      <thead>
                        {/* 1. Week Summary Line (Title of the individual table) */}
                        <tr className="week-header week-row bg-slate-50">
                          {visibleColumns.day && <td colSpan="1" className="bg-slate-100 font-black whitespace-nowrap text-[10px] sm:text-xs border-l-0">SEMANA {weekNum}</td>}
                          <td colSpan={Math.max(1, (visibleColumns.start ? 1 : 0) + (visibleColumns.breakStart ? 1 : 0) + (visibleColumns.breakEnd ? 1 : 0) + (visibleColumns.end ? 1 : 0))} className="bg-slate-100 text-right pr-4 text-[7px] uppercase tracking-widest text-slate-400">Total Semanal:</td>
                          {visibleColumns.total && <td className="text-center bg-slate-100 font-black text-slate-900 border-x-2 border-slate-900">{formatHours(weekPerformed)}</td>}
                          <td colSpan={(visibleColumns.project ? 1 : 0) + (visibleColumns.comment ? 1 : 0)} className="bg-slate-100 border-r-0"></td>
                        </tr>

                        {/* 2. Column Headers for this week's table (Fixed widths for alignment) */}
                        <tr className="column-header-row bg-slate-50 border-b border-slate-200">
                          {visibleColumns.day && <th className="text-center col-day">Dia</th>}
                          {visibleColumns.start && <th className="text-center col-time">Entrada</th>}
                          {visibleColumns.breakStart && <th className="text-center col-time">I. Desc</th>}
                          {visibleColumns.breakEnd && <th className="text-center col-time">F. Desc</th>}
                          {visibleColumns.end && <th className="text-center col-time">Saída</th>}
                          {visibleColumns.total && <th className="text-center col-time">Total</th>}
                          {visibleColumns.project && <th className="text-center px-4 col-project">Projeto</th>}
                          {visibleColumns.comment && <th className="text-center px-4 col-comment">Comentário</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {dayRows}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* Final Monthly Summary + Signature (tied together to avoid orphan stamp) */}
            <div className="mt-1 page-break-inside-avoid">
              <div className="bg-white text-black p-4 shadow-none border-y-2 border-slate-900">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-60">RESUMO MENSAL</span>
                    {unit.isWorkerOnly && unit.clientBreakdowns ? (
                      <div className="mt-2 space-y-0.5">
                        {unit.clientBreakdowns.map(cb => (
                          <div key={cb.clientId} className="flex items-center gap-4 text-[8px]">
                            <span className="font-bold text-slate-600 uppercase w-32 truncate">{cb.clientName}</span>
                            <span className="font-black text-indigo-700">{formatHours(cb.hours)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[7px] font-bold uppercase opacity-50 mb-0.5">TOTAL REGISTRADO</span>
                    <span className="text-xl font-black text-indigo-600">{formatHours(unit.totalHours)}</span>
                  </div>
                </div>
              </div>

              {(() => {
                const approval = clientApprovals?.find(a => a.client_id === unit.client?.id && a.month === month);
                if (approval?.signature_base64) {
                  return (
                    <div className="mt-2 pt-2">
                      <div className="flex flex-col items-end">
                        <ValidationStamp
                          signature={approval.signature_base64}
                          datetime={approval.created_at}
                          ip={approval.client_ip}
                          id={approval.id}
                        />
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="mt-3 pt-2 opacity-30">
                    <div className="flex flex-col items-end">
                      <div className="w-56 h-16 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Aguardando Assinatura</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ))}
        </div>
        </div>
      </div>

    </div>
  );
};

export default ClientTimesheetReport;