import { useState, useCallback } from 'react';
import { submitCorrection } from '../utils/correctionsApi';

const calculateHoursDiff = (entry, exit, breakStart, breakEnd) => {
    if (!entry || !exit || !entry.includes(':') || !exit.includes(':')) return 0;
    const [eh, em] = entry.split(':').map(n => parseInt(n, 10) || 0);
    const [xh, xm] = exit.split(':').map(n => parseInt(n, 10) || 0);
    let diffMins = (xh * 60 + xm) - (eh * 60 + em);
    if (diffMins < 0) diffMins += 24 * 60;
    if (breakStart && breakEnd && breakStart !== '--:--' && breakEnd !== '--:--') {
        const [bsh, bsm] = breakStart.split(':').map(Number);
        const [beh, bem] = breakEnd.split(':').map(Number);
        let bDiff = (beh * 60 + bem) - (bsh * 60 + bsm);
        if (bDiff < 0) bDiff += 24 * 60;
        diffMins -= bDiff;
    }
    return Number(Math.max(0, diffMins / 60).toFixed(2));
};

export function useDraftReport({ originalWorkersData, selectedMonth, logs, originalTotal, clientData, initialClientId, initialMonth, saveToDb, goToView, supabase, companySignature }) {
    const [draftData, setDraftData] = useState([]);
    const [reportJustification, setReportJustification] = useState('');

    const draftTotal = parseFloat(draftData.reduce((acc, curr) => acc + (Number(curr.editedTotalHours) || 0), 0).toFixed(2));

    const startReport = useCallback(() => {
        const getAllMonthDates = (monthStr) => {
            const [year, month] = monthStr.split('-').map(Number);
            const dates = [];
            const numDays = new Date(year, month, 0).getDate();
            for (let i = 1; i <= numDays; i++) {
                dates.push(`${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
            }
            return dates;
        };

        const allDates = getAllMonthDates(selectedMonth);
        const editableData = originalWorkersData.map(w => {
            const logsMap = {};
            w.dailyRecords.forEach(d => { logsMap[d.rawDate.substring(0, 10)] = d; });
            const fullDailyRecords = allDates.map(dateStr => {
                if (logsMap[dateStr]) {
                    const d = logsMap[dateStr];
                    return { ...d, editedEntry: d.entry === '--:--' ? '' : d.entry, editedExit: d.exit === '--:--' ? '' : d.exit, editedHours: d.hours, editedBreakStart: d.breakStart || '', editedBreakEnd: d.breakEnd || '', isVisible: true };
                }
                const dayObj = new Date(dateStr + 'T12:00:00');
                const dayLabel = `${String(dayObj.getDate()).padStart(2, '0')}/${String(dayObj.getMonth() + 1).padStart(2, '0')} (${dayObj.toLocaleDateString('pt-PT', { weekday: 'short' }).substring(0, 3)})`;
                return { logId: `new_${w.id}_${dateStr}`, date: dayLabel, rawDate: dateStr, entry: '--:--', exit: '--:--', hours: 0, breakStart: '', breakEnd: '', editedEntry: '', editedExit: '', editedHours: 0, editedBreakStart: '', editedBreakEnd: '', isNew: true, isVisible: false };
            });
            return { ...w, editedTotalHours: w.totalHours, dailyRecords: fullDailyRecords };
        });
        setDraftData(editableData);
        setReportJustification('');
        goToView('relatorio_cliente');
    }, [originalWorkersData, selectedMonth, goToView]);

    const handleTimeChange = useCallback((workerId, dateStr, field, val) => {
        setDraftData(prev => prev.map(w => {
            if (w.id !== workerId) return w;
            const newDaily = w.dailyRecords.map(d => {
                if (d.rawDate !== dateStr) return d;
                const newEntry = field === 'entry' ? val : d.editedEntry;
                const newExit = field === 'exit' ? val : d.editedExit;
                const newBreakStart = field === 'breakStart' ? val : d.editedBreakStart;
                const newBreakEnd = field === 'breakEnd' ? val : d.editedBreakEnd;
                return { ...d, editedEntry: newEntry, editedExit: newExit, editedBreakStart: newBreakStart, editedBreakEnd: newBreakEnd, editedHours: calculateHoursDiff(newEntry, newExit, newBreakStart, newBreakEnd) };
            });
            return { ...w, dailyRecords: newDaily, editedTotalHours: parseFloat(newDaily.reduce((acc, curr) => acc + curr.editedHours, 0).toFixed(2)) };
        }));
    }, []);

    const handleDeleteDay = useCallback((workerId, dateStr) => {
        setDraftData(prev => prev.map(w => {
            if (w.id !== workerId) return w;
            const newDaily = w.dailyRecords.map(d => {
                if (d.rawDate !== dateStr) return d;
                return { ...d, editedEntry: '', editedExit: '', editedBreakStart: '', editedBreakEnd: '', editedHours: 0 };
            });
            return { ...w, dailyRecords: newDaily, editedTotalHours: parseFloat(newDaily.reduce((acc, curr) => acc + curr.editedHours, 0).toFixed(2)) };
        }));
    }, []);

    const handleRevertDay = useCallback((workerId, dateStr) => {
        setDraftData(prev => prev.map(w => {
            if (w.id !== workerId) return w;
            const newDaily = w.dailyRecords.map(d => {
                if (d.rawDate !== dateStr) return d;
                return { ...d, editedEntry: d.entry === '--:--' ? '' : (d.entry || ''), editedExit: d.exit === '--:--' ? '' : (d.exit || ''), editedBreakStart: d.breakStart || '', editedBreakEnd: d.breakEnd || '', editedHours: d.hours };
            });
            return { ...w, dailyRecords: newDaily, editedTotalHours: parseFloat(newDaily.reduce((acc, curr) => acc + curr.editedHours, 0).toFixed(2)) };
        }));
    }, []);

    const generateCorrectionMessage = useCallback((isQuickMessage = false) => {
        const changedWorkers = isQuickMessage ? draftData : draftData.filter(w => w.dailyRecords.some(d => {
            const isNewDay = !d.entry || d.entry === '--:--' || !d.exit || d.exit === '--:--';
            const origEntry = d.entry === '--:--' ? '' : d.entry;
            const origExit = d.exit === '--:--' ? '' : d.exit;
            const wasEdited = d.editedEntry || d.editedExit || d.editedBreakStart || d.editedBreakEnd;
            const hasChange = d.editedEntry !== origEntry || d.editedExit !== origExit || d.editedBreakStart !== (d.breakStart || '') || d.editedBreakEnd !== (d.breakEnd || '');
            return isNewDay ? wasEdited : hasChange;
        }));

        const diffTotal = (draftTotal - originalTotal).toFixed(2);
        let txt = isQuickMessage ? `💬 MENSAGEM DE DIVERGÊNCIA: ${clientData.name}\n` : `⚠️ PEDIDO DE CORREÇÃO: ${clientData.name}\n`;
        txt += `📅 Período: ${clientData.period}\n\n`;

        if (!isQuickMessage) {
            txt += `📊 RESUMO GERAL:\n• Total Original: ${originalTotal}h\n• Novo Total Sugerido: ${draftTotal}h\n• Diferença: ${diffTotal > 0 ? '+' : ''}${diffTotal}h\n\n👥 DETALHES POR COLABORADOR:\n\n`;
            changedWorkers.forEach(w => {
                const wDiff = (w.editedTotalHours - w.totalHours).toFixed(2);
                txt += `👤 ${w.name.toUpperCase()} [ID:${w.id}]\n   Total: ${w.totalHours}h ➔ ${w.editedTotalHours}h (${wDiff > 0 ? '+' : ''}${wDiff}h)\n   Alterações:\n`;
                w.dailyRecords.filter(d => {
                    const isNewDay = !d.entry || d.entry === '--:--' || !d.exit || d.exit === '--:--';
                    const origEntry = d.entry === '--:--' ? '' : d.entry;
                    const origExit = d.exit === '--:--' ? '' : d.exit;
                    const wasEdited = d.editedEntry || d.editedExit || d.editedBreakStart || d.editedBreakEnd;
                    const hasChange = d.editedEntry !== origEntry || d.editedExit !== origExit || d.editedBreakStart !== (d.breakStart || '') || d.editedBreakEnd !== (d.breakEnd || '');
                    return isNewDay ? wasEdited : hasChange;
                }).forEach(d => {
                    const isNewDay = !d.entry || d.entry === '--:--' || !d.exit || d.exit === '--:--';
                    const origEntry = d.entry === '--:--' || !d.entry ? '' : d.entry;
                    const origExit = d.exit === '--:--' || !d.exit ? '' : d.exit;
                    const origShift = (!origEntry || !origExit || origEntry === '--' || origExit === '--') ? '--:--' : `${origEntry}-${origExit}`;
                    const editedShift = `${d.editedEntry || '--:--'}-${d.editedExit || '--:--'}`;
                    const origBreak = `${d.breakStart || '--:--'}-${d.breakEnd || '--:--'}`;
                    const editedBreak = `${d.editedBreakStart || '--:--'}-${d.editedBreakEnd || '--:--'}`;
                    const displayDate = d.rawDate && d.rawDate.includes('/') ? d.date : (d.rawDate || d.date);
                    txt += `   • ${displayDate}:\n     - Turno: ${origShift} ➔ ${editedShift}\n`;
                    if (origBreak !== '--:----:--' || editedBreak !== '--:----:--') txt += `     - Pausa: ${origBreak} ➔ ${editedBreak}\n`;
                    txt += `     - Horas: ${isNewDay ? 0 : d.hours}h ➔ ${d.editedHours}h\n`;
                });
                txt += '\n';
            });
        }
        if (reportJustification) txt += `💬 JUSTIFICAÇÃO:\n"${reportJustification}"`;
        return txt;
    }, [draftData, draftTotal, originalTotal, clientData, reportJustification]);

    const handlePrecisionConfirm = useCallback(async () => {
        const items = [];
        for (const worker of draftData) {
            for (const day of worker.dailyRecords) {
                const rawDate = day.rawDate;
                const origEntry = day.entry === '--:--' ? '' : (day.entry || '');
                const origExit = day.exit === '--:--' ? '' : (day.exit || '');
                const origBreakStart = day.breakStart || '';
                const origBreakEnd = day.breakEnd || '';
                const hasOrig = !!(origEntry || origExit);
                const hasEdited = !!(day.editedEntry || day.editedExit || day.editedBreakStart || day.editedBreakEnd);
                if (!hasOrig && !hasEdited) continue;
                const wasEmpty = !origEntry && !origExit;
                const isEmpty = !day.editedEntry && !day.editedExit;
                const origLog = logs.find(l => String(l.workerId) === String(worker.id) && l.date === rawDate);
                const beforeFromLog = origLog
                    ? { startTime: origLog.startTime || null, endTime: origLog.endTime || null, breakStart: origLog.breakStart || null, breakEnd: origLog.breakEnd || null, hours: origLog.hours || 0 }
                    : { startTime: origEntry || null, endTime: origExit || null, breakStart: origBreakStart || null, breakEnd: origBreakEnd || null, hours: day.hours || 0 };

                if (wasEmpty && !isEmpty) {
                    items.push({ workerId: worker.id, workerName: worker.name, date: rawDate, before: null, proposed: { startTime: day.editedEntry || null, endTime: day.editedExit || null, breakStart: day.editedBreakStart || null, breakEnd: day.editedBreakEnd || null } });
                } else if (!wasEmpty && isEmpty) {
                    items.push({ workerId: worker.id, workerName: worker.name, date: rawDate, before: beforeFromLog, proposed: { startTime: null, endTime: null, breakStart: null, breakEnd: null } });
                } else if (day.editedEntry !== origEntry || day.editedExit !== origExit || day.editedBreakStart !== origBreakStart || day.editedBreakEnd !== origBreakEnd) {
                    items.push({ workerId: worker.id, workerName: worker.name, date: rawDate, before: beforeFromLog, proposed: { startTime: day.editedEntry || null, endTime: day.editedExit || null, breakStart: day.editedBreakStart || null, breakEnd: day.editedBreakEnd || null } });
                }
            }
        }

        await submitCorrection(supabase, {
            clientId: initialClientId,
            month: initialMonth,
            type: 'precision',
            justification: reportJustification,
            items,
            adminEmail: companySignature?.responsibleEmail,
            clientName: clientData?.name,
        });

        goToView('sucesso_reporte');
    }, [draftData, logs, initialClientId, initialMonth, supabase, companySignature, clientData, reportJustification, goToView]);

    return {
        draftData, setDraftData, draftTotal,
        reportJustification, setReportJustification,
        startReport, handleTimeChange, handleDeleteDay, handleRevertDay, generateCorrectionMessage, handlePrecisionConfirm,
    };
}
