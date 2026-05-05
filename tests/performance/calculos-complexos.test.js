import { describe, it, expect, beforeEach } from 'vitest';

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

const calculateMonthTotal = (worker) => {
    if (!worker.dailyRecords && !worker.changes) return worker.editedTotalHours || 0;
    const records = worker.dailyRecords || worker.changes;
    return records.reduce((acc, c) => {
        const entry = c.adminEntry || c.editedEntry || c.entry || '--:--';
        const exit = c.adminExit || c.editedExit || c.exit || '--:--';
        const bStart = c.adminBreakStart || c.breakStart || '--:--';
        const bEnd = c.adminBreakEnd || c.breakEnd || '--:--';
        const h = calculateHoursDiff(entry, exit, bStart === '--:--' ? null : bStart, bEnd === '--:--' ? null : bEnd);
        return acc + h;
    }, 0);
};

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

const generateCorrectionMessage = (draftData, clientData, originalTotal, reportJustification, isQuickMessage = false) => {
    const changedWorkers = isQuickMessage ? draftData : draftData.filter(w => w.dailyRecords.some(d => {
        const isNewDay = !d.entry || d.entry === '--:--' || !d.exit || d.exit === '--:--';
        const originalEntry = d.entry === '--:--' ? '' : d.entry;
        const originalExit = d.exit === '--:--' ? '' : d.exit;
        const wasEdited = d.editedEntry || d.editedExit || d.editedBreakStart || d.editedBreakEnd;
        const hasChange = d.editedEntry !== originalEntry || d.editedExit !== originalExit || d.editedBreakStart !== (d.breakStart || '') || d.editedBreakEnd !== (d.breakEnd || '');
        return isNewDay ? wasEdited : hasChange;
    }));

    const draftTotal = draftData.reduce((acc, w) => acc + (w.editedTotalHours || 0), 0);
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

        const relevantDays = isQuickMessage ? w.dailyRecords : w.dailyRecords.filter(d => {
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

            correcoesTexto += `   • ${d.rawDate || d.date}:\n`;
            correcoesTexto += `     - Turno: ${originalShift} ➔ ${editedShift}\n`;
            if (originalBreak !== '--:----:--' || editedBreak !== '--:----:--') {
                correcoesTexto += `     - Pausa: ${originalBreak} ➔ ${editedBreak}\n`;
            }
            const origH = isNewDay ? 0 : d.hours;
            correcoesTexto += `     - Horas: ${origH}h ➔ ${d.editedHours}h\n`;
        });
        correcoesTexto += `\n`;
    });

    if (reportJustification) {
        correcoesTexto += `💬 JUSTIFICAÇÃO:\n"${reportJustification}"`;
    }

    return correcoesTexto;
};

const startReportInitialState = (originalWorkersData, initialMonth) => {
    const allDates = getAllMonthDates(initialMonth);

    const editableData = originalWorkersData.map(w => {
        const logsMap = {};
        w.dailyRecords.forEach(d => {
            const dateKey = d.rawDate.substring(0, 10);
            logsMap[dateKey] = d;
        });

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
                    isVisible: true
                };
            } else {
                const dayObj = new Date(dateStr + 'T12:00:00');
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
                    isVisible: false
                };
            }
        });

        return {
            ...w,
            editedTotalHours: w.totalHours,
            dailyRecords: fullDailyRecords
        };
    });

    return editableData;
};

describe('Performance Tests - calculateDuration operations', () => {
    const iterations = 1000;

    it(`should perform calculateDuration 1000x in < 50ms`, () => {
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            calculateHoursDiff('08:00', '17:00', '12:00', '13:00');
        }

        const duration = performance.now() - start;
        console.log(`calculateDuration ${iterations}x took: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(50);
    });

    it(`should perform calculateDuration with overnight shift 1000x in < 50ms`, () => {
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            calculateHoursDiff('22:00', '06:00', '23:00', '23:30');
        }

        const duration = performance.now() - start;
        console.log(`calculateDuration overnight ${iterations}x took: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(50);
    });
});

describe('Performance Tests - calculateMonthTotal operations', () => {
    const createWorkerWithRecords = (numDays) => {
        const dailyRecords = [];
        for (let i = 1; i <= numDays; i++) {
            dailyRecords.push({
                entry: '08:00',
                exit: '17:00',
                breakStart: '12:00',
                breakEnd: '13:00',
                hours: 8
            });
        }
        return {
            id: 'w_perf',
            name: 'Performance Test Worker',
            totalHours: numDays * 8,
            editedTotalHours: numDays * 8,
            dailyRecords
        };
    };

    it('should calculate month total for 31 days in < 10ms', () => {
        const worker = createWorkerWithRecords(31);
        const start = performance.now();

        calculateMonthTotal(worker);

        const duration = performance.now() - start;
        console.log(`calculateMonthTotal (31 days) took: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(10);
    });

    it('should calculate month total for 100 records in < 30ms', () => {
        const worker = createWorkerWithRecords(100);
        const start = performance.now();

        calculateMonthTotal(worker);

        const duration = performance.now() - start;
        console.log(`calculateMonthTotal (100 records) took: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(30);
    });

    it('should handle multiple workers (10 workers, 31 days each) in < 100ms', () => {
        const workers = [];
        for (let i = 0; i < 10; i++) {
            workers.push(createWorkerWithRecords(31));
        }

        const start = performance.now();

        workers.forEach(w => calculateMonthTotal(w));

        const duration = performance.now() - start;
        console.log(`calculateMonthTotal (10 workers x 31 days) took: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(100);
    });
});

describe('Performance Tests - startReport initialization', () => {
    const createMockWorkersData = (numWorkers) => {
        const workers = [];
        for (let i = 0; i < numWorkers; i++) {
            workers.push({
                id: `w_${i}`,
                name: `Worker ${i}`,
                role: 'Developer',
                totalHours: 160,
                dailyRecords: [
                    {
                        rawDate: '2026-05-01',
                        date: '01/05 (sex)',
                        entry: '08:00',
                        exit: '17:00',
                        breakStart: '12:00',
                        breakEnd: '13:00',
                        hours: 8
                    },
                    {
                        rawDate: '2026-05-02',
                        date: '02/05 (sáb)',
                        entry: '08:00',
                        exit: '17:00',
                        breakStart: '12:00',
                        breakEnd: '13:00',
                        hours: 8
                    }
                ]
            });
        }
        return workers;
    };

    it('should initialize startReport for 1 worker in < 50ms', () => {
        const workers = createMockWorkersData(1);
        const start = performance.now();

        startReportInitialState(workers, '2026-05');

        const duration = performance.now() - start;
        console.log(`startReport init (1 worker) took: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(50);
    });

    it('should initialize startReport for 5 workers in < 100ms', () => {
        const workers = createMockWorkersData(5);
        const start = performance.now();

        startReportInitialState(workers, '2026-05');

        const duration = performance.now() - start;
        console.log(`startReport init (5 workers) took: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(100);
    });

    it('should initialize startReport for 20 workers in < 200ms', () => {
        const workers = createMockWorkersData(20);
        const start = performance.now();

        startReportInitialState(workers, '2026-05');

        const duration = performance.now() - start;
        console.log(`startReport init (20 workers) took: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(200);
    });
});

describe('Performance Tests - generateCorrectionMessage', () => {
    const createMockDraftData = (numWorkers, numDaysPerWorker) => {
        const draftData = [];
        for (let w = 0; w < numWorkers; w++) {
            const dailyRecords = [];
            for (let d = 0; d < numDaysPerWorker; d++) {
                dailyRecords.push({
                    date: `${String(d + 1).padStart(2, '0')}/05`,
                    rawDate: `2026-05-${String(d + 1).padStart(2, '0')}`,
                    entry: '08:00',
                    exit: '17:00',
                    breakStart: '12:00',
                    breakEnd: '13:00',
                    hours: 8,
                    editedEntry: '08:00',
                    editedExit: '18:00',
                    editedBreakStart: '12:00',
                    editedBreakEnd: '13:00',
                    editedHours: 9
                });
            }
            draftData.push({
                id: `w_${w}`,
                name: `Worker ${w}`,
                totalHours: numDaysPerWorker * 8,
                editedTotalHours: numDaysPerWorker * 9,
                dailyRecords
            });
        }
        return draftData;
    };

    const mockClientData = {
        name: 'EMPRESA TESTE',
        period: 'Maio de 2026'
    };

    it('should generate message for 1 worker with 5 days in < 20ms', () => {
        const draftData = createMockDraftData(1, 5);
        const start = performance.now();

        generateCorrectionMessage(draftData, mockClientData, 40, 'Test justification', false);

        const duration = performance.now() - start;
        console.log(`generateCorrectionMessage (1 worker, 5 days) took: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(20);
    });

    it('should generate message for 5 workers with 10 days each in < 50ms', () => {
        const draftData = createMockDraftData(5, 10);
        const start = performance.now();

        generateCorrectionMessage(draftData, mockClientData, 400, 'Test justification', false);

        const duration = performance.now() - start;
        console.log(`generateCorrectionMessage (5 workers, 10 days) took: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(50);
    });

    it('should generate message for 10 workers with 31 days each in < 100ms', () => {
        const draftData = createMockDraftData(10, 31);
        const start = performance.now();

        generateCorrectionMessage(draftData, mockClientData, 2480, 'Large dataset test', false);

        const duration = performance.now() - start;
        console.log(`generateCorrectionMessage (10 workers, 31 days) took: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(100);
    });
});

describe('Performance Tests - date calculations', () => {
    it('should get all dates for May 2026 (31 days) in < 5ms', () => {
        const start = performance.now();

        getAllMonthDates('2026-05');

        const duration = performance.now() - start;
        console.log(`getAllMonthDates (May 2026) took: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(5);
    });

    it('should get all dates for February 2028 (leap year, 29 days) in < 5ms', () => {
        const start = performance.now();

        getAllMonthDates('2028-02');

        const duration = performance.now() - start;
        console.log(`getAllMonthDates (Feb 2028 leap year) took: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(5);
    });

    it('should get all dates for February 2026 (non-leap year, 28 days) in < 5ms', () => {
        const start = performance.now();

        getAllMonthDates('2026-02');

        const duration = performance.now() - start;
        console.log(`getAllMonthDates (Feb 2026 non-leap year) took: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(5);
    });
});