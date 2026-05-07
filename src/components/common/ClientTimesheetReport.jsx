import React, { useState, useMemo, useEffect } from 'react';
import { Download, Loader2, Printer, CheckCircle, Settings2 } from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import { toISODateLocal, isSameMonth, getLastBusinessDayOfMonth, formatDocDate, monthToYYYYMM, getISOWeek } from '../../utils/dateUtils';
import { formatHours, calculateDuration, calculateExpectedMonthlyHours, calculateExpectedDailyHours, getScheduleForDay, formatCurrency, toTimeInputValue } from '../../utils/formatUtils';

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
      // Worker mode (Aggregation): One worker across ALL clients they worked for
      const workerLogs = filteredLogs.filter(l => l.workerId === workerId);
      const clientIds = [...new Set(workerLogs.map(l => l.clientId))];
      units = clientIds.map(cId => {
        const unitLogs = workerLogs.filter(l => l.clientId === cId).sort((a, b) => a.date.localeCompare(b.date));
        return {
          client: clients.find(c => c.id === cId),
          worker: workers.find(w => w.id === workerId),
          logs: unitLogs,
          totalHours: unitLogs.reduce((acc, l) => acc + calculateDuration(l.startTime, l.endTime, l.breakStart, l.breakEnd), 0),
          id: cId
        };
      });
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
      const newTitle = `${shortName} - ${unit.client?.name || 'Empresa'} - ${monthDisplay}`;
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
      let JSZip = window.JSZip;
      if (!JSZip) {
        JSZip = await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
          script.onload = () => resolve(window.JSZip);
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      let html2pdf = window.html2pdf;
      if (!html2pdf) {
        html2pdf = await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
          script.onload = () => resolve(window.html2pdf);
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const zip = new JSZip();

      // 1. Gerar PDFs dentro das pastas (por trabalhador)
      for (let i = 0; i < reportUnits.length; i++) {
        const unit = reportUnits[i];
        const clientName = unit.client?.name || "Sem_Cliente";
        const workerName = unit.worker?.name || "Sem_Colaborador";

        const clientFolder = zip.folder(clientName);
        const originalElement = document.getElementById(`report-unit-${i}`);

        if (originalElement) {
          originalElement.scrollIntoView({ behavior: 'instant', block: 'start' });

          // Guardamos os estilos originais
          const originalPaddingTop = originalElement.style.paddingTop;
          const originalPaddingBottom = originalElement.style.paddingBottom;
          const originalMinHeight = originalElement.style.minHeight;

          // Aplicamos os ajustes
          originalElement.style.paddingTop = '15px';
          originalElement.style.paddingBottom = '10px';
          originalElement.style.minHeight = 'auto';

          await new Promise(r => setTimeout(r, 400));

          const opt = {
            margin: 0,
            filename: `Relatorio_${workerName.replace(/[^a-zA-Z0-9]/g, '_')}_${month}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 1.5,
              useCORS: true,
              logging: false
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };

          const pdfBlob = await html2pdf().set(opt).from(originalElement).output('blob');
          clientFolder.file(opt.filename, pdfBlob);

          // Devolve a tela ao normal
          originalElement.style.paddingTop = originalPaddingTop;
          originalElement.style.paddingBottom = originalPaddingBottom;
          originalElement.style.minHeight = originalMinHeight;
        }
      }

      // --- CORREÇÃO DO ERRO DO ZIP ---
      const blob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `relatorios de horas ${month}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao gerar ZIP com PDFs:", error);
      alert("Ocorreu um erro ao processar os PDFs. Tente novamente.");
    } finally {
      setIsZipping(false);

      // Dá 100 milissegundos para o React remover o botão de "Carregando"
      setTimeout(() => {
        const alvoTopo = document.getElementById('topo-da-pagina');

        if (alvoTopo) {
          // Desliza a tela de volta para o elemento alvo (garantido!)
          alvoTopo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // Fallback caso você esqueça de colocar o ID
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
    }
  };

  return (
    <div className={`bg-white min-h-screen font-sans text-slate-900 ${isEmbedded ? 'relative w-full' : 'absolute inset-0 z-[500]'} overflow-y-auto print:bg-white print:static print:overflow-visible print:inset-auto print:z-0 print:min-h-0 print:shadow-none print:border-none`}>
      <style dangerouslySetInnerHTML={{
        __html: `
        /* --- FUNDO DA TELA E ESTILO DA PÁGINA A4 --- */
        body {
          background-color: #f1f5f9; 
        }

        .a4-paper {
          width: 794px;
          min-height: 1123px;
          background: white;
          margin: 40px auto;
          padding: 40px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          box-sizing: border-box;
          font-family: 'Inter', sans-serif;
          color: #0f172a;
          line-height: 1 !important;
          position: relative;
        }

        .a4-paper .print-table tr {
          height: 12px !important;
        }

        .a4-paper .print-table td { 
          padding-top: 0px !important; 
          padding-bottom: 0px !important;
          line-height: 0.8 !important;
          font-size: 6.5pt !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }

        .a4-paper .p-3 {
          padding-top: 2px !important;
          padding-bottom: 2px !important;
          margin-top: 2px !important; 
          margin-bottom: 4px !important; 
        }

        .a4-paper .p-3 .text-xl {
          font-size: 12pt !important;
          line-height: 1 !important;
        }

        .a4-paper .mt-8 {
          margin-top: 8px !important;
        }

        .a4-paper .column-header-row th { 
          padding: 1px 2px !important;
          height: 14px !important;
        }

        .a4-paper .week-row td { 
          padding-top: 1px !important;
          padding-bottom: 1px !important;
          height: 18px !important;
          font-size: 8.5pt !important;
        }

        .a4-paper .print-table td div, 
        .a4-paper .print-table td span {
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1 !important;
        }

        .a4-paper .week-spacing { 
          margin-top: 0px !important; 
          margin-bottom: 0px !important; 
        }

        @media print, .zip-export-mode {
          body {
            background-color: white !important;
          }
          .a4-paper {
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
          }
        }

        .a4-paper.page-break:first-of-type {
          break-before: auto !important;
          page-break-before: auto !important;
        }

        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .a4-paper * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .a4-paper .print-table th, 
        .a4-paper .print-table td { 
          padding: 3px 4px !important; 
          font-size: 7.5pt !important;
          border: none !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }

        .a4-paper .week-row td { 
          padding: 6px 8px !important;
          font-size: 9pt !important;
          font-weight: 900 !important;
          border-bottom: 1.5px solid #cbd5e1 !important;
          background-color: #f8fafc !important;
        }

        .a4-paper .column-header-row th { 
          font-size: 6.5pt !important;
          padding: 3px 4px !important;
          background-color: #f1f5f9 !important;
          text-transform: uppercase;
        }

        /* CONTAINER PRINCIPAL DO RELATÓRIO */
        .report-container, .pdf-export-mode {
          background: white !important;
          color: #1e293b !important;
          font-family: 'Inter', sans-serif;
          max-width: 794px;
          margin: 0 auto;
          padding: 20px;
        }

        /* ESCONDER ELEMENTOS NA HORA DE IMPRIMIR */
        @media print {
          .no-print { display: none !important; }
          .report-container { padding: 0; max-width: 100%; }
          
          /* Garantir quebras de página corretas */
          .a4-paper { 
            page-break-after: always !important; 
            break-after: page !important;
          }
          .a4-paper:last-child { 
            page-break-after: auto !important; 
            break-after: auto !important;
          }
          
          /* Evitar quebra dentro de elementos */
          .page-break-inside-avoid { 
            break-inside: avoid !important; 
            page-break-inside: avoid !important; 
          }
          
          /* Forçar quebra antes de cada relatório */
          .a4-paper { 
            page-break-before: auto !important;
          }
        }

        /* TABELAS UNIFICADAS */
        .report-table { border-collapse: collapse; width: 100%; table-layout: auto; margin-bottom: 4px; }
        .report-table th, .report-table td { 
          border: none !important; 
          border-bottom: 1px solid #e2e8f0 !important; 
          padding: 2px 4px !important;
        }
        .report-table th { 
          background-color: #f8fafc !important; 
          color: #64748b !important; 
          font-size: 7pt !important;
          text-transform: uppercase;
        }
        .report-table td { font-size: 8pt !important; }

        /* Larguras fixas para todas as tabelas terem colunas alinhadas */
        .report-table .col-day { width: 40px; min-width: 40px; }
        .report-table .col-time { width: 60px; min-width: 60px; }
        .report-table .col-project { min-width: 120px; }
        .report-table .col-comment { width: auto; }

        .week-row td { 
          background-color: #f8fafc !important; 
          font-weight: 900 !important; 
          font-size: 9pt !important; 
          border-bottom: 1px solid #cbd5e1 !important; 
          color: #0f172a !important; 
          padding: 0 !important;
        }

        .column-header-row th { 
          background-color: #f1f5f9 !important; 
          color: #475569 !important; 
          font-weight: 800 !important; 
        }

        /* QUEBRAS DE PÁGINA */
        .page-break-inside-avoid { break-inside: avoid !important; page-break-inside: avoid !important; }

        /* ESTILOS ADICIONAIS */
        .week-spacing { margin-top: 12px !important; }
        .signature-box { height: 25px !important; }
        .employee-bar-print { padding: 4px 10px !important; margin-bottom: 8px !important; border-radius: 0 !important; border: none !important; }
        .week-header { background: #f1f5f9; font-weight: 700; color: #334155; }
        .employee-bar { background: #f1f5f9; padding: 8px 15px; border-radius: 4px; margin-bottom: 12px; border: none !important; }

        /* ZIP EXPORT MODE - Layout紧凑 para PDF no ZIP */
        .zip-export-mode {
          margin: 0 !important; 
          padding: 0 !important;
        }

        .zip-export-mode html, .zip-export-mode body {
          height: auto !important;
          overflow: visible !important;
        }

        .zip-export-mode .page-break {
          break-before: auto !important;
          page-break-before: auto !important;
        }

        .zip-export-mode .mt-8 { margin-top: 16px !important; }
        .zip-export-mode .pb-2 { padding-bottom: 8px !important; }
        .zip-export-mode .mb-4 { margin-bottom: 12px !important; }
        .zip-export-mode .mb-2 { margin-bottom: 0px !important; }
        .zip-export-mode .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 0px !important; }
        .zip-export-mode .border-b-2.border-slate-900 {
          border-bottom: 2px solid #0f172a !important;
        }
        .zip-export-mode .text-xl { font-size: 14pt !important; }
        .zip-export-mode .text-sm { font-size: 10pt !important; }
        .zip-export-mode .text-\[10px\] { font-size: 8pt !important; }
        .zip-export-mode .text-\[9px\] { font-size: 7pt !important; }
        .zip-export-mode .text-\[7px\] { font-size: 6pt !important; }
        .zip-export-mode .week-spacing { margin-top: 8px !important; }
        .zip-export-mode .print-table th,
        .zip-export-mode .print-table td {
          padding: 3px 4px !important; 
          font-size: 7.5pt !important;
          border: none !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        .zip-export-mode .week-row td {
          padding: 6px 8px !important;
          font-size: 9pt !important;
          font-weight: 900 !important;
          border-bottom: 1.5px solid #cbd5e1 !important;
          background-color: #f8fafc !important;
        }
        .zip-export-mode .column-header-row th {
          font-size: 6.5pt !important;
          padding: 3px 4px !important;
          background-color: #f1f5f9 !important;
          text-transform: uppercase;
        }
        `}} />

      <div className="max-w-5xl mx-auto p-4 sm:p-12 report-container pdf-export-mode">
        {!isEmbedded && (
          <div id="topo-da-pagina" className="no-print flex flex-col gap-6 mb-8 pb-6 border-b">
            <div className="flex justify-between items-center">
              <button onClick={onBack} className="px-6 py-2 bg-slate-100 text-slate-600 font-bold text-xs uppercase rounded-xl hover:bg-slate-200 transition-colors">Voltar</button>
              <div className="flex gap-3">
                <button id="magnetic-zip-btn" onClick={handleGenerateZip} disabled={isZipping} className="px-6 py-2 bg-emerald-600 text-white font-black text-xs uppercase rounded-xl shadow-lg flex items-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50">
                  {isZipping ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Baixar ZIP (PDFs)
                </button>
                <button onClick={() => window.print()} className="px-6 py-2.5 bg-slate-900 text-white font-black text-xs uppercase rounded-xl shadow-lg flex items-center gap-2 hover:bg-slate-800 transition-all"><Printer size={16} /> Imprimir / PDF ({reportUnits.length} {reportUnits.length === 1 ? 'Folha' : 'Folhas'})</button>
              </div>
            </div>

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
          </div>
        )}

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
                  Folha de Horas Mensal • {unit.client?.name || ''}
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
                        {visibleColumns.project && <td className="text-center font-medium text-slate-700 uppercase whitespace-nowrap col-project" style={{ fontSize: '8px' }}>{isClearedDay ? '' : (unit.client?.name || '')}</td>}
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

            {/* Final Monthly Summary Section (Isolated from weekly tables) */}
            <div className="bg-white text-black p-4 shadow-none border-y-2 border-slate-900 mt-1 page-break-inside-avoid">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-60">RESUMO MENSAL</span>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-end">
                    <span className="text-[7px] font-bold uppercase opacity-50 mb-0.5">TOTAL REGISTRADO</span>
                    <span className="text-xl font-black text-indigo-600">{formatHours(unit.totalHours)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Signature Section at the bottom */}
            {(() => {
              const approval = clientApprovals?.find(a => a.client_id === unit.client?.id && a.month === month);
              if (approval?.signature_base64) {
                return (
                  <div className="mt-8 pt-6 border-t border-slate-100 page-break-inside-avoid">
                    <div className="flex flex-col items-end">
                      <div className="bg-slate-50 border-2 border-indigo-100 rounded-2xl p-4 relative overflow-hidden shadow-sm flex items-center gap-4">
                        <div className="absolute top-0 right-0 p-1 opacity-5"><CheckCircle size={40} /></div>
                        <div className="bg-white border border-slate-100 rounded-lg p-1.5 shadow-inner">
                          <img src={approval.signature_base64} alt="Assinatura" className="h-12 w-auto mix-blend-multiply" />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 text-indigo-600 font-black text-[9px] uppercase tracking-widest mb-1.5">
                            <span className="bg-indigo-600 text-white p-0.5 rounded-sm"><CheckCircle size={8} /></span>
                            VALIDAÇÃO DIGITAL
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[6.5px] font-bold text-slate-500 uppercase tracking-tight flex justify-between gap-3">
                              <span>Data/Hora:</span>
                              <span className="text-slate-800 font-black">{new Date(approval.created_at).toLocaleString('pt-PT')}</span>
                            </p>
                            <p className="text-[6.5px] font-bold text-slate-500 uppercase tracking-tight flex justify-between gap-3">
                              <span>Endereço IP:</span>
                              <span className="text-slate-800 font-black">{approval.client_ip || 'N/D'}</span>
                            </p>
                            <p className="text-[6.5px] font-bold text-slate-400 uppercase tracking-tight flex justify-between gap-3 mt-1 pt-1 border-t border-slate-100">
                              <span>ID:</span>
                              <span className="font-mono text-slate-400">{approval.id.substring(0, 16)}...</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-[5px] font-bold text-slate-400 mt-1.5 uppercase tracking-[0.2em]">Documento validado eletronicamente</p>
                    </div>
                  </div>
                );
              }
              return (
                <div className="mt-8 pt-6 border-t border-slate-100 opacity-30 page-break-inside-avoid">
                  <div className="flex flex-col items-end">
                    <div className="w-56 h-16 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Aguardando Assinatura</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

    </div>
  );
};

export default ClientTimesheetReport;