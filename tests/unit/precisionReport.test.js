import { describe, it, expect } from 'vitest';

const calculateHoursDiff = (entry, exit, breakStart, breakEnd) => {
    if (!entry || !exit || entry === '--:--' || exit === '--:--' || !entry.includes(':') || !exit.includes(':')) return 0;
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

describe('Precision Report - calculateHoursDiff', () => {
    it('should calculate basic duration correctly', () => {
        expect(calculateHoursDiff('08:00', '17:00')).toBe(9);
    });

    it('should calculate duration with minutes correctly', () => {
        expect(calculateHoursDiff('08:30', '17:45')).toBe(9.25);
    });

    it('should subtract break time correctly', () => {
        expect(calculateHoursDiff('08:00', '17:00', '12:00', '13:00')).toBe(8);
    });

    it('should handle overnight shifts', () => {
        expect(calculateHoursDiff('22:00', '06:00')).toBe(8);
    });

    it('should return 0 for invalid entry format', () => {
        expect(calculateHoursDiff('--:--', '17:00')).toBe(0);
    });

    it('should return 0 for empty entry', () => {
        expect(calculateHoursDiff('', '17:00')).toBe(0);
    });

    it('should handle 1 minute shift', () => {
        expect(calculateHoursDiff('08:00', '08:01')).toBe(0.02);
    });
});

describe('Precision Report - calculateMonthTotal', () => {
    it('should calculate month total from dailyRecords', () => {
        const worker = {
            id: 'w1',
            name: 'João Silva',
            totalHours: 160,
            editedTotalHours: 160,
            dailyRecords: [
                { entry: '08:00', exit: '17:00', breakStart: '12:00', breakEnd: '13:00', hours: 8 },
                { entry: '08:00', exit: '17:00', breakStart: '12:00', breakEnd: '13:00', hours: 8 }
            ]
        };
        expect(calculateMonthTotal(worker)).toBe(16);
    });

    it('should use editedEntry/editedExit when present', () => {
        const worker = {
            id: 'w1',
            name: 'João Silva',
            totalHours: 8,
            editedTotalHours: 9,
            dailyRecords: [
                { entry: '08:00', exit: '17:00', breakStart: '12:00', breakEnd: '13:00', hours: 8, editedEntry: '08:00', editedExit: '18:00', editedBreakStart: '12:00', editedBreakEnd: '13:00' }
            ]
        };
        expect(calculateMonthTotal(worker)).toBe(9);
    });

    it('should use adminEntry/adminExit when present (override edited)', () => {
        const worker = {
            id: 'w1',
            name: 'João Silva',
            totalHours: 8,
            editedTotalHours: 9,
            dailyRecords: [
                { entry: '08:00', exit: '17:00', breakStart: '12:00', breakEnd: '13:00', hours: 8, editedEntry: '08:00', editedExit: '18:00', adminEntry: '07:00', adminExit: '17:00' }
            ]
        };
        expect(calculateMonthTotal(worker)).toBe(9);
    });

    it('should return editedTotalHours when no dailyRecords', () => {
        const worker = {
            id: 'w1',
            name: 'João Silva',
            totalHours: 160,
            editedTotalHours: 165
        };
        expect(calculateMonthTotal(worker)).toBe(165);
    });

    it('should calculate correctly for month with varied hours', () => {
        const worker = {
            id: 'w1',
            name: 'João Silva',
            dailyRecords: [
                { entry: '08:00', exit: '17:00', breakStart: '12:00', breakEnd: '13:00', hours: 8 },
                { entry: '09:00', exit: '18:00', breakStart: '12:00', breakEnd: '13:00', hours: 8 },
                { entry: '08:00', exit: '14:00', breakStart: null, breakEnd: null, hours: 6 }
            ]
        };
        expect(calculateMonthTotal(worker)).toBe(22);
    });

    it('should handle empty dailyRecords', () => {
        const worker = {
            id: 'w1',
            name: 'João Silva',
            dailyRecords: []
        };
        expect(calculateMonthTotal(worker)).toBe(0);
    });

    it('should handle --:-- entries as 0 hours', () => {
        const worker = {
            id: 'w1',
            name: 'João Silva',
            dailyRecords: [
                { entry: '--:--', exit: '--:--', hours: 0 }
            ]
        };
        expect(calculateMonthTotal(worker)).toBe(0);
    });
});

describe('Precision Report - handleTimeChange logic', () => {
    const handleTimeChange = (workerId, dateStr, field, val, draftData) => {
        return draftData.map(w => {
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
        });
    };

    const createMockDraft = () => [
        {
            id: 'w1',
            name: 'João Silva',
            totalHours: 24,
            editedTotalHours: 24,
            dailyRecords: [
                { date: '01/05', entry: '08:00', exit: '17:00', breakStart: '12:00', breakEnd: '13:00', hours: 8, editedEntry: '08:00', editedExit: '17:00', editedBreakStart: '12:00', editedBreakEnd: '13:00', editedHours: 8 },
                { date: '02/05', entry: '08:00', exit: '17:00', breakStart: '12:00', breakEnd: '13:00', hours: 8, editedEntry: '08:00', editedExit: '17:00', editedBreakStart: '12:00', editedBreakEnd: '13:00', editedHours: 8 },
                { date: '03/05', entry: '08:00', exit: '17:00', breakStart: '12:00', breakEnd: '13:00', hours: 8, editedEntry: '08:00', editedExit: '17:00', editedBreakStart: '12:00', editedBreakEnd: '13:00', editedHours: 8 }
            ]
        }
    ];

    it('should update single day entry time', () => {
        const draft = createMockDraft();
        const result = handleTimeChange('w1', '01/05', 'entry', '09:00', draft);

        expect(result[0].dailyRecords[0].editedEntry).toBe('09:00');
        expect(result[0].dailyRecords[0].editedHours).toBe(7);
    });

    it('should recalculate month total after time change', () => {
        const draft = createMockDraft();
        const result = handleTimeChange('w1', '01/05', 'exit', '19:00', draft);

        expect(result[0].editedTotalHours).toBe(26);
    });

    it('should not modify other workers', () => {
        const draft = [
            ...createMockDraft(),
            {
                id: 'w2',
                name: 'Maria Santos',
                totalHours: 8,
                editedTotalHours: 8,
                dailyRecords: [
                    { date: '01/05', entry: '08:00', exit: '17:00', breakStart: '12:00', breakEnd: '13:00', hours: 8, editedEntry: '08:00', editedExit: '17:00', editedBreakStart: '12:00', editedBreakEnd: '13:00', editedHours: 8 }
                ]
            }
        ];
        const result = handleTimeChange('w1', '01/05', 'exit', '19:00', draft);

        expect(result[1].editedTotalHours).toBe(8);
        expect(result[1].dailyRecords[0].editedExit).toBe('17:00');
    });

    it('should not modify other days', () => {
        const draft = createMockDraft();
        const result = handleTimeChange('w1', '01/05', 'entry', '09:00', draft);

        expect(result[0].dailyRecords[1].editedEntry).toBe('08:00');
        expect(result[0].dailyRecords[1].editedHours).toBe(8);
    });

    it('should update break times correctly', () => {
        const draft = createMockDraft();
        const result = handleTimeChange('w1', '01/05', 'breakEnd', '14:00', draft);

        expect(result[0].dailyRecords[0].editedBreakEnd).toBe('14:00');
        expect(result[0].dailyRecords[0].editedHours).toBe(7);
    });

    it('should clear day when entry/exit set to --:--', () => {
        const draft = createMockDraft();
        const result = handleTimeChange('w1', '01/05', 'entry', '--:--', draft);

        expect(result[0].dailyRecords[0].editedHours).toBe(0);
    });
});

describe('Precision Report - generateCorrectionMessage (Precision Format)', () => {
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

    const createMockDraft = () => [
        {
            id: 'w1',
            name: 'João Silva',
            totalHours: 160,
            editedTotalHours: 162,
            dailyRecords: [
                {
                    date: '01/05 (sex)',
                    rawDate: '2026-05-01',
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
                }
            ]
        }
    ];

    const createMockClientData = () => ({
        name: 'EMPRESA TESTE',
        period: 'Maio de 2026'
    });

    it('should generate precision report header (not quick message)', () => {
        const message = generateCorrectionMessage(createMockDraft(), createMockClientData(), 160, '', false);
        expect(message).toContain('⚠️ PEDIDO DE CORREÇÃO: EMPRESA TESTE');
    });

    it('should include all summary fields', () => {
        const message = generateCorrectionMessage(createMockDraft(), createMockClientData(), 160, '', false);
        expect(message).toContain('📅 Período: Maio de 2026');
        expect(message).toContain('• Total Original: 160h');
        expect(message).toContain('• Novo Total Sugerido: 162h');
        expect(message).toContain('• Diferença: +2.00h');
    });

    it('should include worker details section', () => {
        const message = generateCorrectionMessage(createMockDraft(), createMockClientData(), 160, '', false);
        expect(message).toContain('👤 JOÃO SILVA [ID:w1]');
        expect(message).toContain('Total: 160h ➔ 162h (+2.00h)');
    });

    it('should include detailed day changes', () => {
        const message = generateCorrectionMessage(createMockDraft(), createMockClientData(), 160, '', false);
        expect(message).toContain('• 2026-05-01:');
        expect(message).toContain('Turno: 08:00-17:00 ➔ 08:00-18:00');
        expect(message).toContain('Horas: 8h ➔ 9h');
    });

    it('should include justification when provided', () => {
        const justification = 'Projeto urgente';
        const message = generateCorrectionMessage(createMockDraft(), createMockClientData(), 160, justification, false);
        expect(message).toContain('💬 JUSTIFICAÇÃO:');
        expect(message).toContain(`"${justification}"`);
    });

    it('should filter to only changed workers in precision mode', () => {
        const unchangedDraft = [
            {
                id: 'w1',
                name: 'João Silva',
                totalHours: 8,
                editedTotalHours: 8,
                dailyRecords: [
                    {
                        date: '01/05',
                        entry: '08:00',
                        exit: '17:00',
                        breakStart: '12:00',
                        breakEnd: '13:00',
                        hours: 8,
                        editedEntry: '08:00',
                        editedExit: '17:00',
                        editedBreakStart: '12:00',
                        editedBreakEnd: '13:00',
                        editedHours: 8
                    }
                ]
            }
        ];
        const message = generateCorrectionMessage(unchangedDraft, createMockClientData(), 8, '', false);
        expect(message).not.toContain('JOÃO SILVA');
    });

    it('should include all days with changes in precision mode', () => {
        const multiDayDraft = [
            {
                id: 'w1',
                name: 'João Silva',
                totalHours: 16,
                editedTotalHours: 18,
                dailyRecords: [
                    {
                        date: '01/05',
                        rawDate: '2026-05-01',
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
                    },
                    {
                        date: '02/05',
                        rawDate: '2026-05-02',
                        entry: '08:00',
                        exit: '17:00',
                        breakStart: '12:00',
                        breakEnd: '13:00',
                        hours: 8,
                        editedEntry: '09:00',
                        editedExit: '18:00',
                        editedBreakStart: '12:00',
                        editedBreakEnd: '13:00',
                        editedHours: 8
                    }
                ]
            }
        ];
        const message = generateCorrectionMessage(multiDayDraft, createMockClientData(), 16, '', false);
        expect(message).toContain('• 2026-05-01:');
        expect(message).toContain('• 2026-05-02:');
    });

    it('should handle negative difference', () => {
        const negativeDraft = [
            {
                id: 'w1',
                name: 'João Silva',
                totalHours: 160,
                editedTotalHours: 150,
                dailyRecords: [
                    {
                        date: '01/05',
                        entry: '08:00',
                        exit: '17:00',
                        hours: 8,
                        editedEntry: '--:--',
                        editedExit: '--:--',
                        editedHours: 0
                    }
                ]
            }
        ];
        const message = generateCorrectionMessage(negativeDraft, createMockClientData(), 160, '', false);
        expect(message).toContain('• Diferença: -10.00h');
    });
});

describe('Precision Report - startReport initialization', () => {
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

    const createMockWorkersData = () => [
        {
            id: 'w1',
            name: 'João Silva',
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
        },
        {
            id: 'w2',
            name: 'Maria Santos',
            role: 'Designer',
            totalHours: 80,
            dailyRecords: [
                {
                    rawDate: '2026-05-01',
                    date: '01/05 (sex)',
                    entry: '09:00',
                    exit: '18:00',
                    breakStart: '12:00',
                    breakEnd: '13:00',
                    hours: 8
                }
            ]
        }
    ];

    it('should create editable data for all workers', () => {
        const result = startReportInitialState(createMockWorkersData(), '2026-05');
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('João Silva');
        expect(result[1].name).toBe('Maria Santos');
    });

    it('should preserve original total hours for all workers', () => {
        const result = startReportInitialState(createMockWorkersData(), '2026-05');
        expect(result[0].editedTotalHours).toBe(160);
        expect(result[1].editedTotalHours).toBe(80);
    });

    it('should create full month records for all workers', () => {
        const result = startReportInitialState(createMockWorkersData(), '2026-05');
        expect(result[0].dailyRecords.length).toBe(31);
        expect(result[1].dailyRecords.length).toBe(31);
    });

    it('should mark existing records as visible', () => {
        const result = startReportInitialState(createMockWorkersData(), '2026-05');
        const existingRecord = result[0].dailyRecords.find(d => d.rawDate === '2026-05-01');
        expect(existingRecord.isVisible).toBe(true);
    });

    it('should mark new records as not visible', () => {
        const result = startReportInitialState(createMockWorkersData(), '2026-05');
        const newRecord = result[0].dailyRecords.find(d => d.rawDate === '2026-05-03');
        expect(newRecord.isVisible).toBe(false);
        expect(newRecord.isNew).toBe(true);
    });

    it('should set edited values from original', () => {
        const result = startReportInitialState(createMockWorkersData(), '2026-05');
        const record = result[0].dailyRecords.find(d => d.rawDate === '2026-05-01');
        expect(record.editedEntry).toBe('08:00');
        expect(record.editedExit).toBe('17:00');
        expect(record.editedHours).toBe(8);
    });

    it('should handle worker with no records', () => {
        const emptyWorker = [{ id: 'w1', name: 'Test', role: 'Dev', totalHours: 0, dailyRecords: [] }];
        const result = startReportInitialState(emptyWorker, '2026-05');
        expect(result[0].dailyRecords.length).toBe(31);
        expect(result[0].dailyRecords.every(d => d.isNew && !d.isVisible)).toBe(true);
    });

    it('should handle leap year February (29 days)', () => {
        const workers = [{ id: 'w1', name: 'Test', role: 'Dev', totalHours: 0, dailyRecords: [] }];
        const result = startReportInitialState(workers, '2028-02');
        expect(result[0].dailyRecords.length).toBe(29);
    });
});

describe('Precision Report - correctionMode transitions', () => {
    const modes = ['triagem', 'manual', 'comentario'];

    it('should have all required modes', () => {
        expect(modes).toContain('triagem');
        expect(modes).toContain('manual');
        expect(modes).toContain('comentario');
    });

    const getValidTransitions = (currentMode) => {
        const transitions = {
            'triagem': ['comentario', 'manual'],
            'comentario': ['triagem'],
            'manual': ['triagem']
        };
        return transitions[currentMode] || [];
    };

    it('should allow transition from triagem to manual', () => {
        const validTransitions = getValidTransitions('triagem');
        expect(validTransitions).toContain('manual');
    });

    it('should allow transition from triagem to comentario', () => {
        const validTransitions = getValidTransitions('triagem');
        expect(validTransitions).toContain('comentario');
    });

    it('should allow transition from manual back to triagem', () => {
        const validTransitions = getValidTransitions('manual');
        expect(validTransitions).toContain('triagem');
    });

    it('should allow transition from comentario back to triagem', () => {
        const validTransitions = getValidTransitions('comentario');
        expect(validTransitions).toContain('triagem');
    });
});

describe('Precision Report - draftTotal calculation', () => {
    const calculateDraftTotal = (draftData) => {
        return parseFloat(draftData.reduce((acc, w) => acc + (w.editedTotalHours || 0), 0).toFixed(2));
    };

    it('should calculate total from multiple workers', () => {
        const draftData = [
            { id: 'w1', editedTotalHours: 160 },
            { id: 'w2', editedTotalHours: 80 }
        ];
        expect(calculateDraftTotal(draftData)).toBe(240);
    });

    it('should handle empty draft', () => {
        expect(calculateDraftTotal([])).toBe(0);
    });

    it('should handle worker with no editedTotalHours', () => {
        const draftData = [
            { id: 'w1' },
            { id: 'w2', editedTotalHours: 80 }
        ];
        expect(calculateDraftTotal(draftData)).toBe(80);
    });
});

describe('Precision Report - isDayChanged detection', () => {
    const isDayChanged = (day) => {
        const originalEntry = day.entry === '--:--' ? '' : day.entry;
        const originalExit = day.exit === '--:--' ? '' : day.exit;
        return day.editedEntry !== originalEntry || day.editedExit !== originalExit ||
               day.editedBreakStart !== (day.breakStart || '') || day.editedBreakEnd !== (day.breakEnd || '');
    };

    it('should detect change in entry time', () => {
        const day = {
            entry: '08:00',
            exit: '17:00',
            breakStart: '12:00',
            breakEnd: '13:00',
            editedEntry: '09:00',
            editedExit: '17:00',
            editedBreakStart: '12:00',
            editedBreakEnd: '13:00'
        };
        expect(isDayChanged(day)).toBe(true);
    });

    it('should detect change in exit time', () => {
        const day = {
            entry: '08:00',
            exit: '17:00',
            breakStart: '12:00',
            breakEnd: '13:00',
            editedEntry: '08:00',
            editedExit: '18:00',
            editedBreakStart: '12:00',
            editedBreakEnd: '13:00'
        };
        expect(isDayChanged(day)).toBe(true);
    });

    it('should not detect change when nothing edited', () => {
        const day = {
            entry: '08:00',
            exit: '17:00',
            breakStart: '12:00',
            breakEnd: '13:00',
            editedEntry: '08:00',
            editedExit: '17:00',
            editedBreakStart: '12:00',
            editedBreakEnd: '13:00'
        };
        expect(isDayChanged(day)).toBe(false);
    });

    it('should handle cleared day (--:-- entries)', () => {
        const day = {
            entry: '08:00',
            exit: '17:00',
            breakStart: '12:00',
            breakEnd: '13:00',
            editedEntry: '--:--',
            editedExit: '--:--',
            editedBreakStart: '--:--',
            editedBreakEnd: '--:--'
        };
        expect(isDayChanged(day)).toBe(true);
    });
});