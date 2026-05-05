import { describe, it, expect } from 'vitest';

const calculateHoursDiff = (entry, exit, breakStart, breakEnd) => {
  if (!entry || entry === '--:--' || !exit || exit === '--:--') {
    return 0;
  }

  const [entryH, entryM] = entry.split(':').map(Number);
  const [exitH, exitM] = exit.split(':').map(Number);

  if (isNaN(entryH) || isNaN(exitH)) {
    return 0;
  }

  let totalMinutes = (exitH * 60 + (exitM || 0)) - (entryH * 60 + (entryM || 0));

  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }

  if (breakStart && breakEnd && breakStart !== '--:--' && breakEnd !== '--:--') {
    const [breakStartH, breakStartM] = breakStart.split(':').map(Number);
    const [breakEndH, breakEndM] = breakEnd.split(':').map(Number);
    const breakMinutes = (breakEndH * 60 + (breakEndM || 0)) - (breakStartH * 60 + (breakStartM || 0));
    totalMinutes = Math.max(0, totalMinutes - breakMinutes);
  }

  return parseFloat((totalMinutes / 60).toFixed(2));
};

describe('calculateHoursDiff', () => {
  it('should calculate basic duration correctly', () => {
    expect(calculateHoursDiff('08:00', '17:00')).toBe(9);
  });

  it('should calculate duration with minutes correctly', () => {
    expect(calculateHoursDiff('08:30', '17:45')).toBe(9.25);
  });

  it('should subtract break time correctly', () => {
    expect(calculateHoursDiff('08:00', '17:00', '12:00', '13:00')).toBe(8);
  });

  it('should return 0 for empty entry', () => {
    expect(calculateHoursDiff('', '17:00')).toBe(0);
  });

  it('should return 0 for empty exit', () => {
    expect(calculateHoursDiff('08:00', '')).toBe(0);
  });

  it('should return 0 for --:-- entry', () => {
    expect(calculateHoursDiff('--:--', '17:00')).toBe(0);
  });

  it('should handle overnight shifts', () => {
    expect(calculateHoursDiff('22:00', '06:00')).toBe(8);
  });

  it('should handle null break times', () => {
    expect(calculateHoursDiff('08:00', '17:00', null, null)).toBe(9);
  });

  it('should handle 1 minute shift', () => {
    expect(calculateHoursDiff('08:00', '08:01')).toBe(0.02);
  });

  it('should handle negative break (reverse break times)', () => {
    expect(calculateHoursDiff('08:00', '17:00', '13:00', '12:00')).toBe(10);
  });
});

describe('generateCorrectionMessage (Quick Report)', () => {
  const generateCorrectionMessage = (draftData, clientData, originalTotal, reportJustification) => {
    const changedWorkers = draftData.filter(w => w.dailyRecords.some(d => {
      const isNewDay = !d.entry || d.entry === '--:--' || !d.exit || d.exit === '--:--';
      const originalEntry = d.entry === '--:--' ? '' : d.entry;
      const originalExit = d.exit === '--:--' ? '' : d.exit;
      const wasEdited = d.editedEntry || d.editedExit || d.editedBreakStart || d.editedBreakEnd;
      const hasChange = d.editedEntry !== originalEntry || d.editedExit !== originalExit || d.editedBreakStart !== (d.breakStart || '') || d.editedBreakEnd !== (d.breakEnd || '');
      return isNewDay ? wasEdited : hasChange;
    }));

    const draftTotal = draftData.reduce((acc, w) => acc + (w.editedTotalHours || 0), 0);
    const diffTotal = (draftTotal - originalTotal).toFixed(2);

    let correcoesTexto = `💬 MENSAGEM DE DIVERGÊNCIA: ${clientData.name}\n`;
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

  const createMockDraftData = () => [
    {
      id: 'w1',
      name: 'João Silva',
      role: 'Developer',
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
        },
        {
          date: '02/05 (sáb)',
          rawDate: '2026-05-02',
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

  const createMockClientData = () => ({
    name: 'EMPRESA TESTE',
    period: 'Maio de 2026'
  });

  it('should generate message header with client name', () => {
    const message = generateCorrectionMessage(createMockDraftData(), createMockClientData(), 160, '');
    expect(message).toContain('💬 MENSAGEM DE DIVERGÊNCIA: EMPRESA TESTE');
  });

  it('should generate message with period', () => {
    const message = generateCorrectionMessage(createMockDraftData(), createMockClientData(), 160, '');
    expect(message).toContain('📅 Período: Maio de 2026');
  });

  it('should include original total in summary', () => {
    const message = generateCorrectionMessage(createMockDraftData(), createMockClientData(), 160, '');
    expect(message).toContain('• Total Original: 160h');
  });

  it('should include suggested total in summary', () => {
    const message = generateCorrectionMessage(createMockDraftData(), createMockClientData(), 160, '');
    expect(message).toContain('• Novo Total Sugerido: 162h');
  });

  it('should calculate difference correctly', () => {
    const message = generateCorrectionMessage(createMockDraftData(), createMockClientData(), 160, '');
    expect(message).toContain('• Diferença: +2.00h');
  });

  it('should include worker details', () => {
    const message = generateCorrectionMessage(createMockDraftData(), createMockClientData(), 160, '');
    expect(message).toContain('👤 JOÃO SILVA [ID:w1]');
  });

  it('should include worker total change', () => {
    const message = generateCorrectionMessage(createMockDraftData(), createMockClientData(), 160, '');
    expect(message).toContain('Total: 160h ➔ 162h (+2.00h)');
  });

  it('should include day changes', () => {
    const message = generateCorrectionMessage(createMockDraftData(), createMockClientData(), 160, '');
    expect(message).toContain('• 2026-05-01:');
  });

  it('should show shift changes', () => {
    const message = generateCorrectionMessage(createMockDraftData(), createMockClientData(), 160, '');
    expect(message).toContain('Turno: 08:00-17:00 ➔ 08:00-18:00');
  });

  it('should include justification when provided', () => {
    const justification = 'Trabalho extra devido a projeto urgente';
    const message = generateCorrectionMessage(createMockDraftData(), createMockClientData(), 160, justification);
    expect(message).toContain('💬 JUSTIFICAÇÃO:');
    expect(message).toContain(`"${justification}"`);
  });

  it('should not include justification section when empty', () => {
    const message = generateCorrectionMessage(createMockDraftData(), createMockClientData(), 160, '');
    expect(message).not.toContain('💬 JUSTIFICAÇÃO:');
  });

  it('should only include workers with changes', () => {
    const unchangedWorkerDraft = [
      {
        id: 'w2',
        name: 'Maria Santos',
        role: 'Designer',
        totalHours: 80,
        editedTotalHours: 80,
        dailyRecords: [
          {
            date: '01/05 (sex)',
            rawDate: '2026-05-01',
            entry: '09:00',
            exit: '17:00',
            breakStart: '12:00',
            breakEnd: '13:00',
            hours: 8,
            editedEntry: '09:00',
            editedExit: '17:00',
            editedBreakStart: '12:00',
            editedBreakEnd: '13:00',
            editedHours: 8
          }
        ]
      }
    ];
    const message = generateCorrectionMessage(unchangedWorkerDraft, createMockClientData(), 80, '');
    expect(message).not.toContain('MARIA SANTOS');
  });

  it('should handle negative difference', () => {
    const negativeDraft = [
      {
        id: 'w1',
        name: 'João Silva',
        role: 'Developer',
        totalHours: 160,
        editedTotalHours: 150,
        dailyRecords: [
          {
            date: '01/05 (sex)',
            rawDate: '2026-05-01',
            entry: '08:00',
            exit: '17:00',
            breakStart: '12:00',
            breakEnd: '13:00',
            hours: 8,
            editedEntry: '',
            editedExit: '',
            editedBreakStart: '',
            editedBreakEnd: '',
            editedHours: 0
          }
        ]
      }
    ];
    const message = generateCorrectionMessage(negativeDraft, createMockClientData(), 160, '');
    expect(message).toContain('• Diferença: -10.00h');
  });

  it('should show cleared shifts correctly', () => {
    const clearedDraft = [
      {
        id: 'w1',
        name: 'João Silva',
        role: 'Developer',
        totalHours: 8,
        editedTotalHours: 0,
        dailyRecords: [
          {
            date: '01/05 (sex)',
            rawDate: '2026-05-01',
            entry: '08:00',
            exit: '17:00',
            breakStart: '12:00',
            breakEnd: '13:00',
            hours: 8,
            editedEntry: '--:--',
            editedExit: '--:--',
            editedBreakStart: '--:--',
            editedBreakEnd: '--:--',
            editedHours: 0
          }
        ]
      }
    ];
    const message = generateCorrectionMessage(clearedDraft, createMockClientData(), 8, '');
    expect(message).toContain('Turno: 08:00-17:00 ➔ --:-----:--');
    expect(message).toContain('Horas: 8h ➔ 0h');
  });

  it('should handle empty draft data', () => {
    const message = generateCorrectionMessage([], createMockClientData(), 0, '');
    expect(message).toContain('• Novo Total Sugerido: 0h');
    expect(message).toContain('• Diferença: 0.00h');
  });
});

describe('handleTimeChange logic', () => {
  const calculateHoursDiff = (entry, exit, breakStart, breakEnd) => {
    if (!entry || entry === '--:--' || !exit || exit === '--:--') {
      return 0;
    }
    const [entryH, entryM] = entry.split(':').map(Number);
    const [exitH, exitM] = exit.split(':').map(Number);
    if (isNaN(entryH) || isNaN(exitH)) return 0;
    let totalMinutes = (exitH * 60 + (exitM || 0)) - (entryH * 60 + (entryM || 0));
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    if (breakStart && breakEnd && breakStart !== '--:--' && breakEnd !== '--:--') {
      const [breakStartH, breakStartM] = breakStart.split(':').map(Number);
      const [breakEndH, breakEndM] = breakEnd.split(':').map(Number);
      const breakMinutes = (breakEndH * 60 + (breakEndM || 0)) - (breakStartH * 60 + (breakStartM || 0));
      totalMinutes = Math.max(0, totalMinutes - breakMinutes);
    }
    return parseFloat((totalMinutes / 60).toFixed(2));
  };

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

  it('should update entry time and recalculate hours', () => {
    const draft = createMockDraft();
    const result = handleTimeChange('w1', '01/05', 'entry', '09:00', draft);

    expect(result[0].dailyRecords[0].editedEntry).toBe('09:00');
    expect(result[0].dailyRecords[0].editedHours).toBe(7);
  });

  it('should update exit time and recalculate hours', () => {
    const draft = createMockDraft();
    const result = handleTimeChange('w1', '01/05', 'exit', '18:00', draft);

    expect(result[0].dailyRecords[0].editedExit).toBe('18:00');
    expect(result[0].dailyRecords[0].editedHours).toBe(9);
  });

  it('should update break start time and recalculate hours', () => {
    const draft = createMockDraft();
    const result = handleTimeChange('w1', '01/05', 'breakStart', '12:30', draft);

    expect(result[0].dailyRecords[0].editedBreakStart).toBe('12:30');
    expect(result[0].dailyRecords[0].editedHours).toBe(8.5);
  });

  it('should update break end time and recalculate hours', () => {
    const draft = createMockDraft();
    const result = handleTimeChange('w1', '01/05', 'breakEnd', '13:30', draft);

    expect(result[0].dailyRecords[0].editedBreakEnd).toBe('13:30');
    expect(result[0].dailyRecords[0].editedHours).toBe(7.5);
  });

  it('should recalculate worker total after time change', () => {
    const draft = createMockDraft();
    const result = handleTimeChange('w1', '01/05', 'exit', '19:00', draft);

    expect(result[0].editedTotalHours).toBe(10);
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
    const result = handleTimeChange('w1', '01/05', 'exit', '18:00', draft);

    expect(result[1].dailyRecords[0].editedExit).toBe('17:00');
    expect(result[1].editedTotalHours).toBe(8);
  });

  it('should not modify other days', () => {
    const draft = [
      {
        id: 'w1',
        name: 'João Silva',
        totalHours: 16,
        editedTotalHours: 16,
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
          },
          {
            date: '02/05',
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
    const result = handleTimeChange('w1', '01/05', 'exit', '19:00', draft);

    expect(result[0].dailyRecords[1].editedExit).toBe('17:00');
    expect(result[0].dailyRecords[1].editedHours).toBe(8);
  });

  it('should set hours to 0 when clearing entry/exit', () => {
    const draft = createMockDraft();
    const result = handleTimeChange('w1', '01/05', 'entry', '--:--', draft);

    expect(result[0].dailyRecords[0].editedHours).toBe(0);
  });
});

describe('startReport initialization', () => {
  const createMockOriginalWorkersData = () => [
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
    }
  ];

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

  it('should create editable data for all workers', () => {
    const workers = createMockOriginalWorkersData();
    const result = startReportInitialState(workers, '2026-05');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('João Silva');
  });

  it('should preserve original total hours', () => {
    const workers = createMockOriginalWorkersData();
    const result = startReportInitialState(workers, '2026-05');

    expect(result[0].editedTotalHours).toBe(160);
  });

  it('should create records for all days in month', () => {
    const workers = createMockOriginalWorkersData();
    const result = startReportInitialState(workers, '2026-05');

    expect(result[0].dailyRecords.length).toBeGreaterThanOrEqual(31);
  });

  it('should mark existing records as visible', () => {
    const workers = createMockOriginalWorkersData();
    const result = startReportInitialState(workers, '2026-05');

    const existingRecords = result[0].dailyRecords.filter(d => d.rawDate === '2026-05-01');
    expect(existingRecords[0].isVisible).toBe(true);
  });

  it('should mark new (empty) records as not visible', () => {
    const workers = createMockOriginalWorkersData();
    const result = startReportInitialState(workers, '2026-05');

    const emptyRecords = result[0].dailyRecords.filter(d => d.rawDate === '2026-05-03');
    expect(emptyRecords[0].isVisible).toBe(false);
  });

  it('should set editedEntry and editedExit from original values', () => {
    const workers = createMockOriginalWorkersData();
    const result = startReportInitialState(workers, '2026-05');

    const mayFirst = result[0].dailyRecords.find(d => d.rawDate === '2026-05-01');
    expect(mayFirst.editedEntry).toBe('08:00');
    expect(mayFirst.editedExit).toBe('17:00');
  });

  it('should set empty strings for missing entry/exit', () => {
    const workers = [
      {
        id: 'w1',
        name: 'João Silva',
        role: 'Developer',
        totalHours: 0,
        dailyRecords: [
          {
            rawDate: '2026-05-01',
            date: '01/05 (sex)',
            entry: '--:--',
            exit: '--:--',
            hours: 0
          }
        ]
      }
    ];
    const result = startReportInitialState(workers, '2026-05');

    const mayFirst = result[0].dailyRecords.find(d => d.rawDate === '2026-05-01');
    expect(mayFirst.editedEntry).toBe('');
    expect(mayFirst.editedExit).toBe('');
  });

  it('should create new records for days without data', () => {
    const workers = createMockOriginalWorkersData();
    const result = startReportInitialState(workers, '2026-05');

    const emptyDay = result[0].dailyRecords.find(d => d.rawDate === '2026-05-03');
    expect(emptyDay).toBeDefined();
    expect(emptyDay.isNew).toBe(true);
    expect(emptyDay.entry).toBe('--:--');
    expect(emptyDay.editedEntry).toBe('');
  });

  it('should handle month with 28 days (February)', () => {
    const workers = [{ id: 'w1', name: 'Test', role: 'Dev', totalHours: 0, dailyRecords: [] }];
    const result = startReportInitialState(workers, '2026-02');

    expect(result[0].dailyRecords.length).toBe(28);
  });

  it('should handle month with 30 days (April)', () => {
    const workers = [{ id: 'w1', name: 'Test', role: 'Dev', totalHours: 0, dailyRecords: [] }];
    const result = startReportInitialState(workers, '2026-04');

    expect(result[0].dailyRecords.length).toBe(30);
  });

  it('should handle month with 31 days (May)', () => {
    const workers = [{ id: 'w1', name: 'Test', role: 'Dev', totalHours: 0, dailyRecords: [] }];
    const result = startReportInitialState(workers, '2026-05');

    expect(result[0].dailyRecords.length).toBe(31);
  });
});