import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Download, Loader2, Printer, Settings2, FileText } from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import ValidationStamp from './ValidationStampWithQR';
import './ClientTimesheetReport.css';
import { toISODateLocal, isSameMonth, getLastBusinessDayOfMonth, formatDocDate, monthToYYYYMM, getISOWeek } from '../../utils/dateUtils';
import { formatHours, calculateDuration, calculateExpectedMonthlyHours, calculateExpectedDailyHours, getScheduleForDay, formatCurrency, toTimeInputValue } from '../../utils/formatUtils';
import { convertHtmlToDocx, triggerDownload } from '../../utils/timesheetTemplateService';

const ClientTimesheetReport = ({ data, onBack, isEmbedded = false }) => {
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
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const reportContainerRef = useRef(null);

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

  const handleGenerateZip = async () => {
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
        wrapper.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        await new Promise(r => setTimeout(r, 100));

        const canvas = await html2canvas(clone, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 794,
          width: clone.offsetWidth || 794,
          height: clone.offsetHeight,
        });

        document.body.removeChild(wrapper);

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = pdfWidth / imgWidth;
        const heightInMm = imgHeight * ratio;

        const PAGE_TOLERANCE_MM = 5;
        if (heightInMm <= pdfHeight + PAGE_TOLERANCE_MM) {
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, heightInMm);
        } else {
          let position = 0;
          let remaining = heightInMm;
          while (remaining > PAGE_TOLERANCE_MM) {
            pdf.addImage(imgData, 'JPEG', 0, -position, pdfWidth, heightInMm);
            remaining -= pdfHeight;
            if (remaining > PAGE_TOLERANCE_MM) {
              pdf.addPage();
              position += pdfHeight;
            }
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
    }
  };

  const handleDownloadDocx = async () => {
    if (reportUnits.length === 0) return;
    setIsDownloadingDocx(true);
    try {
      const unit = reportUnits[0];
      const workerName = (unit.worker?.name || 'Colaborador').replace(/[^a-zA-Z0-9]/g, '_');
      const html = buildPdfContent(unit);
      const docxBuffer = await convertHtmlToDocx(html);
      const blob = new Blob([docxBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      triggerDownload(blob, `Relatorio_${workerName}_${month}.docx`);
    } catch (error) {
      console.error('Erro ao gerar DOCX:', error);
      alert('Ocorreu um erro ao gerar o DOCX. Tente novamente.');
    } finally {
      setIsDownloadingDocx(false);
    }
  };

  const buildPdfContent = (unit) => {
    const vc = visibleColumns;
    const monthDisplay = daysInMonthList.length > 0 ? new Date(daysInMonthList[0]).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }) : month;
    const clientLabel = unit.isWorkerOnly ? 'Folha de Horas Mensal • Vários Clientes' : `Folha de Horas Mensal • ${unit.client?.name || ''}`;
    const workerLabel = unit.worker?.name || 'Vários Colaboradores';

    let html = `<div style="width:794px;padding:40px;box-sizing:border-box;font-family:Inter,sans-serif;font-size:8pt;color:#0f172a;background:#fff;line-height:1;">`;

    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;padding-bottom:12px;border-bottom:2px solid #0f172a;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:44px;height:44px;background:#6366f1;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20pt;font-weight:900;color:#fff;">MP</div>
        <div>
          <div style="font-size:17pt;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;color:#0f172a;">Magnetic Place</div>
          <div style="font-size:8pt;font-weight:900;text-transform:uppercase;letter-spacing:0.3em;color:#94a3b8;margin-top:2px;">Unipessoal LDA</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:12pt;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#1e293b;">${monthDisplay}</div>
        <div style="font-size:9pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">${clientLabel}</div>
      </div>
    </div>`;

    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:16px;margin-top:48px;">
      <div>
        <div style="font-size:7pt;font-weight:900;text-transform:uppercase;letter-spacing:0.2em;color:#64748b;">Colaborador</div>
        <div style="font-size:12pt;font-weight:900;text-transform:uppercase;color:#1e293b;margin-top:2px;">${workerLabel}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:7pt;font-weight:900;text-transform:uppercase;letter-spacing:0.2em;color:#6366f1;">Total Registado</div>
        <div style="font-size:13pt;font-weight:900;color:#6366f1;margin-top:2px;">${formatHours(unit.totalHours)}</div>
      </div>
    </div>`;

    const colWidths = [];
    if (vc.day) colWidths.push({ id: 'day', label: 'Dia', w: 50 });
    if (vc.start) colWidths.push({ id: 'start', label: 'Entrada', w: 60 });
    if (vc.breakStart) colWidths.push({ id: 'breakStart', label: 'I. Desc', w: 55 });
    if (vc.breakEnd) colWidths.push({ id: 'breakEnd', label: 'F. Desc', w: 55 });
    if (vc.end) colWidths.push({ id: 'end', label: 'Saída', w: 60 });
    if (vc.total) colWidths.push({ id: 'total', label: 'Total', w: 55 });
    if (vc.project) colWidths.push({ id: 'project', label: 'Projeto', w: 220 });
    if (vc.comment) colWidths.push({ id: 'comment', label: 'Comentário', w: 120 });

    const colStyle = (c) => `width:${c.w}px;min-width:${c.w}px;max-width:${c.w}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;

    html += `<div style="margin-bottom:8px;">`;
    weeksData.forEach(([weekNum, dates]) => {
      const rows = [];
      colWidths.forEach(c => { rows.push({ ...c, rows: [] }); });

      dates.forEach(dateStr => {
        const dayLogs = unit.logs.filter(l => l.date === dateStr);
        const dateObj = new Date(dateStr);
        const dayNum = String(dateObj.getDate()).padStart(2, '0');
        const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0, 3).toUpperCase();

        if (dayLogs.length === 0) {
          const rowData = { day: `${dayNum} ${dayName}`, start: '', breakStart: '', breakEnd: '', end: '', total: '', project: '', comment: '' };
          colWidths.forEach(c => { rows.find(x => x.id === c.id).rows.push({ content: rowData[c.id], isEmpty: true }); });
        } else {
          dayLogs.forEach((log, lIdx) => {
            const isCleared = (log.startTime == null && log.endTime == null) || (log.startTime === '--:--' && log.endTime === '--:--');
            const logH = isCleared ? 0 : calculateDuration(log.startTime, log.endTime, log.breakStart, log.breakEnd);
            const cName = unit.isWorkerOnly ? (clients.find(c => c.id === log.clientId)?.name || '') : (unit.client?.name || '');
            const rowData = {
              day: lIdx === 0 ? `${dayNum} ${dayName}` : '',
              start: log.startTime || '',
              breakStart: isCleared ? '' : (log.breakStart || ''),
              breakEnd: isCleared ? '' : (log.breakEnd || ''),
              end: log.endTime || '',
              total: isCleared ? '' : formatHours(logH),
              project: isCleared ? '' : cName.toUpperCase(),
              comment: log.description || ''
            };
            colWidths.forEach(c => { rows.find(x => x.id === c.id).rows.push({ content: rowData[c.id], isEmpty: false, isBold: c.id === 'day' || c.id === 'total' }); });
          });
        }
      });

      html += `<div style="page-break-inside:avoid;margin-bottom:8px;">
        <table style="table-layout:fixed;border-collapse:collapse;">
          <thead>
            <tr>
              <td colspan="${colWidths.length}" style="font-size:9pt;font-weight:900;padding:6px 8px;color:#334155;background:#f1f5f9;">SEMANA ${weekNum}</td>
              <td colspan="2" style="font-size:7pt;font-weight:700;text-align:right;padding:6px 8px;color:#64748b;text-transform:uppercase;background:#f1f5f9;">Total Semanal:</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              ${colWidths.map(c => `<th style="width:${c.w}px;min-width:${c.w}px;max-width:${c.w}px;padding:3px 4px;font-size:6.5pt;font-weight:800;text-transform:uppercase;color:#475569;text-align:center;background:#f1f5f9;white-space:nowrap;">${c.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>`;

      const maxRows = Math.max(...rows.map(r => r.rows.length));
      for (let ri = 0; ri < maxRows; ri++) {
        html += `<tr style="border-bottom:1px solid #e2e8f0;">`;
        rows.forEach(r => {
          const cell = r.rows[ri] || { content: '', isEmpty: true };
          const fontSize = r.id === 'project' || r.id === 'comment' ? '7pt' : '8pt';
          const fontWeight = cell.isBold ? '700' : '400';
          const color = r.id === 'breakStart' || r.id === 'breakEnd' ? '#94a3b8' : (r.id === 'project' || r.id === 'comment' ? '#475569' : '#334155');
          const fontStyle = r.id === 'comment' ? 'italic' : 'normal';
          html += `<td style="${colStyle(r)}padding:2px 4px;font-size:${fontSize};font-weight:${fontWeight};font-style:${fontStyle};color:${color};${r.id === 'comment' ? 'text-align:left;' : ''}">${cell.content}</td>`;
        });
        html += `</tr>`;
      }
      html += `</tbody></table></div>`;
    });

    html += `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:16px;border-top:2px solid #0f172a;border-bottom:2px solid #0f172a;margin-top:4px;page-break-inside:avoid;background:#fff;">
      <div>`;
    if (unit.isWorkerOnly && unit.clientBreakdowns) {
      html += `<span style="font-size:9pt;font-weight:900;text-transform:uppercase;letter-spacing:0.3em;color:#64748b;">RESUMO MENSAL</span>`;
      unit.clientBreakdowns.forEach(cb => {
        html += `<div style="display:flex;align-items:center;gap:16px;margin-top:4px;">
          <span style="font-size:8pt;font-weight:700;text-transform:uppercase;color:#475569;width:128px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cb.clientName}</span>
          <span style="font-size:9pt;font-weight:900;color:#4338ca;">${formatHours(cb.hours)}</span>
        </div>`;
      });
    } else {
      html += `<span style="font-size:9pt;font-weight:900;text-transform:uppercase;letter-spacing:0.3em;color:#64748b;">RESUMO MENSAL</span>`;
    }
    html += `</div><div style="text-align:right;"><span style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#94a3b8;margin-bottom:2px;display:block;">TOTAL REGISTADO</span><span style="font-size:20pt;font-weight:900;color:#6366f1;">${formatHours(unit.totalHours)}</span></div></div>`;

    const approval = clientApprovals?.find(a => a.client_id === unit.client?.id && a.month === month);
    if (approval?.signature_base64) {
      html += `<div style="margin-top:12px;padding-top:24px;border-top:1px solid #e2e8f0;text-align:right;page-break-inside:avoid;">
        <div style="display:inline-block;padding:8px;border:1px dashed #cbd5e1;border-radius:12px;">
          <div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Assinatura do Cliente</div>
          <img src="${approval.signature_base64}" style="height:60px;max-width:200px;" />
          <div style="font-size:6pt;color:#94a3b8;margin-top:4px;">${approval.created_at ? new Date(approval.created_at).toLocaleString('pt-PT') : ''}</div>
        </div>
      </div>`;
    } else {
      html += `<div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;opacity:0.3;text-align:right;page-break-inside:avoid;">
        <div style="display:inline-block;width:224px;height:64px;border:2px dashed #cbd5e1;border-radius:12px;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:8pt;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">Aguardando Assinatura</span>
        </div>
      </div>`;
    }

    html += `</div>`;
    html += `</div>`;
    return html;
  };

  return (
    <div className={`bg-white min-h-screen font-sans text-slate-900 ${isEmbedded ? 'relative w-full' : 'absolute inset-0 z-[500]'} overflow-y-auto print:bg-white print:static print:overflow-visible print:inset-auto print:z-0 print:min-h-0 print:shadow-none print:border-none`}>

      <div ref={reportContainerRef} className={isEmbedded ? 'w-full pdf-export-mode' : 'max-w-5xl mx-auto p-4 sm:p-12 report-container pdf-export-mode'}>
        <div id="topo-da-pagina" className="no-print flex flex-col gap-6 mb-8 pb-6 border-b">
          <div className="flex justify-between items-center">
            {isEmbedded ? null : (
              <button onClick={onBack} className="px-6 py-2 bg-slate-100 text-slate-600 font-bold text-xs uppercase rounded-xl hover:bg-slate-200 transition-colors">Voltar</button>
            )}
            <div className="flex gap-3">
              <button id="magnetic-zip-btn" onClick={handleGenerateZip} disabled={isZipping} className="px-5 py-2.5 bg-emerald-600 text-white font-black text-xs uppercase rounded-xl shadow-lg flex items-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50">
                {isZipping ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} ZIP
              </button>
              <button onClick={handleDownloadDocx} disabled={isDownloadingDocx} className="px-5 py-2.5 bg-indigo-600 text-white font-black text-xs uppercase rounded-xl shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50">
                {isDownloadingDocx ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} DOCX
              </button>
              <button onClick={() => window.print()} className="px-5 py-2.5 bg-slate-900 text-white font-black text-xs uppercase rounded-xl shadow-lg flex items-center gap-2 hover:bg-slate-800 transition-all"><Printer size={16} /> PDF/Imprimir</button>
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
  );
};

export default ClientTimesheetReport;