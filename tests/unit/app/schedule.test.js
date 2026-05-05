import { describe, it, expect } from 'vitest';

const calculateDuration = (entry, exit, breakStart, breakEnd) => {
  if (!entry || !exit || entry === '--:--' || exit === '--:--') return 0;
  const [eh, em] = entry.split(':').map(Number);
  const [xh, xm] = exit.split(':').map(Number);
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

const getScheduleForDay = (schedule, dateStr) => {
  if (!schedule) return null;
  const d = new Date(dateStr).getDay();
  if (schedule.isAdvanced && schedule.dailyConfigs && schedule.dailyConfigs[d]) {
    return schedule.dailyConfigs[d].isActive ? schedule.dailyConfigs[d] : null;
  }
  const allowedDays = schedule.weekdays || [1, 2, 3, 4, 5];
  if (allowedDays.includes(d)) {
    return { startTime: schedule.startTime, breakStart: schedule.breakStart, breakEnd: schedule.breakEnd, endTime: schedule.endTime };
  }
  return null;
};

const calculateExpectedMonthlyHours = (schedule, targetDate) => {
  if (!schedule) return 0;
  const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
  let totalHours = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const ds = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayConfig = getScheduleForDay(schedule, ds);
    if (dayConfig) {
      totalHours += calculateDuration(dayConfig.startTime, dayConfig.endTime, dayConfig.breakStart, dayConfig.breakEnd);
    }
  }
  return totalHours;
};

const calculateExpectedDailyHours = (schedule, dateStr) => {
  if (!schedule) return 0;
  const dayConfig = getScheduleForDay(schedule, dateStr);
  if (!dayConfig) return 0;
  return calculateDuration(dayConfig.startTime, dayConfig.endTime, dayConfig.breakStart, dayConfig.breakEnd);
};

describe('getScheduleForDay', () => {
  const simpleSchedule = {
    startTime: '08:00',
    endTime: '17:00',
    breakStart: '12:00',
    breakEnd: '13:00',
    weekdays: [1, 2, 3, 4, 5]
  };

  it('should return schedule for Monday (day 1)', () => {
    const result = getScheduleForDay(simpleSchedule, '2026-05-04');
    expect(result).not.toBeNull();
    expect(result.startTime).toBe('08:00');
  });

  it('should return schedule for Friday (day 5)', () => {
    const result = getScheduleForDay(simpleSchedule, '2026-05-08');
    expect(result).not.toBeNull();
  });

  it('should return null for Saturday (day 6)', () => {
    const result = getScheduleForDay(simpleSchedule, '2026-05-02');
    expect(result).toBeNull();
  });

  it('should return null for Sunday (day 0)', () => {
    const result = getScheduleForDay(simpleSchedule, '2026-05-03');
    expect(result).toBeNull();
  });

  it('should return null for null schedule', () => {
    expect(getScheduleForDay(null, '2026-05-04')).toBeNull();
  });

  it('should return null for undefined schedule', () => {
    expect(getScheduleForDay(undefined, '2026-05-04')).toBeNull();
  });

  it('should handle advanced schedule with daily configs', () => {
    const advancedSchedule = {
      isAdvanced: true,
      dailyConfigs: {
        0: { isActive: false },
        1: { isActive: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
        2: { isActive: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
        3: { isActive: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
        4: { isActive: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
        5: { isActive: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
        6: { isActive: false }
      }
    };
    const result = getScheduleForDay(advancedSchedule, '2026-05-04');
    expect(result).not.toBeNull();
    expect(result.startTime).toBe('09:00');
  });

  it('should return null for inactive day in advanced schedule', () => {
    const advancedSchedule = {
      isAdvanced: true,
      dailyConfigs: {
        0: { isActive: false },
        1: { isActive: true, startTime: '09:00', endTime: '18:00' },
        6: { isActive: false }
      }
    };
    const result = getScheduleForDay(advancedSchedule, '2026-05-02');
    expect(result).toBeNull();
  });

  it('should use default weekdays if not specified', () => {
    const scheduleWithoutWeekdays = {
      startTime: '08:00',
      endTime: '17:00'
    };
    const result = getScheduleForDay(scheduleWithoutWeekdays, '2026-05-04');
    expect(result).not.toBeNull();
  });

  it('should return null for weekend when weekdays is Mon-Fri only', () => {
    const result = getScheduleForDay(simpleSchedule, '2026-05-09');
    expect(result).toBeNull();
  });
});

describe('calculateExpectedDailyHours', () => {
  const simpleSchedule = {
    startTime: '08:00',
    endTime: '17:00',
    breakStart: '12:00',
    breakEnd: '13:00',
    weekdays: [1, 2, 3, 4, 5]
  };

  it('should return 8 hours for standard weekday', () => {
    const result = calculateExpectedDailyHours(simpleSchedule, '2026-05-04');
    expect(result).toBe(8);
  });

  it('should return 0 for weekend', () => {
    const result = calculateExpectedDailyHours(simpleSchedule, '2026-05-02');
    expect(result).toBe(0);
  });

  it('should return 0 for null schedule', () => {
    const result = calculateExpectedDailyHours(null, '2026-05-04');
    expect(result).toBe(0);
  });

  it('should handle schedule without break', () => {
    const noBreakSchedule = {
      startTime: '09:00',
      endTime: '17:00',
      weekdays: [1, 2, 3, 4, 5]
    };
    const result = calculateExpectedDailyHours(noBreakSchedule, '2026-05-04');
    expect(result).toBe(8);
  });

  it('should return 0 for invalid date string', () => {
    const result = calculateExpectedDailyHours(simpleSchedule, 'invalid-date');
    expect(result).toBe(0);
  });
});

describe('calculateExpectedMonthlyHours', () => {
  const simpleSchedule = {
    startTime: '08:00',
    endTime: '17:00',
    breakStart: '12:00',
    breakEnd: '13:00',
    weekdays: [1, 2, 3, 4, 5]
  };

  it('should return 0 for null schedule', () => {
    const result = calculateExpectedMonthlyHours(null, new Date(2026, 4, 1));
    expect(result).toBe(0);
  });

  it('should return 0 for undefined schedule', () => {
    const result = calculateExpectedMonthlyHours(undefined, new Date(2026, 4, 1));
    expect(result).toBe(0);
  });

  it('should calculate correct hours for May 2026 (21 weekdays * 8 hours)', () => {
    const result = calculateExpectedMonthlyHours(simpleSchedule, new Date(2026, 4, 1));
    expect(result).toBe(168);
  });

  it('should calculate correct hours for June 2026 (22 weekdays * 8 hours)', () => {
    const result = calculateExpectedMonthlyHours(simpleSchedule, new Date(2026, 5, 1));
    expect(result).toBe(176);
  });

  it('should calculate correct hours for February 2026 (leap year, 20 weekdays)', () => {
    const febSchedule = {
      startTime: '08:00',
      endTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      weekdays: [1, 2, 3, 4, 5]
    };
    const result = calculateExpectedMonthlyHours(febSchedule, new Date(2026, 1, 1));
    expect(result).toBe(160);
  });

  it('should return 0 for schedule with no working days in month', () => {
    const emptySchedule = {
      startTime: '08:00',
      endTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      weekdays: []
    };
    const result = calculateExpectedMonthlyHours(emptySchedule, new Date(2026, 4, 1));
    expect(result).toBe(0);
  });

  it('should handle schedule without break', () => {
    const noBreakSchedule = {
      startTime: '09:00',
      endTime: '17:00',
      weekdays: [1, 2, 3, 4, 5]
    };
    const result = calculateExpectedMonthlyHours(noBreakSchedule, new Date(2026, 4, 1));
    expect(result).toBe(168);
  });

  it('should handle short daily schedule (4 hours per day)', () => {
    const halfDaySchedule = {
      startTime: '09:00',
      endTime: '13:00',
      weekdays: [1, 2, 3, 4, 5]
    };
    const result = calculateExpectedMonthlyHours(halfDaySchedule, new Date(2026, 4, 1));
    expect(result).toBe(84);
  });

  it('should handle Monday to Thursday schedule (16 days * 8 hours)', () => {
    const monThuSchedule = {
      startTime: '08:00',
      endTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      weekdays: [1, 2, 3, 4]
    };
    const result = calculateExpectedMonthlyHours(monThuSchedule, new Date(2026, 4, 1));
    expect(result).toBe(128);
  });

  it('should handle Wednesday only schedule (4 Wednesdays * 8 hours)', () => {
    const wedOnlySchedule = {
      startTime: '08:00',
      endTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      weekdays: [3]
    };
    const result = calculateExpectedMonthlyHours(wedOnlySchedule, new Date(2026, 4, 1));
    expect(result).toBe(32);
  });
});

describe('calculateDuration', () => {
  it('should calculate basic duration correctly', () => {
    expect(calculateDuration('08:00', '17:00')).toBe(9);
  });

  it('should subtract break time correctly', () => {
    expect(calculateDuration('08:00', '17:00', '12:00', '13:00')).toBe(8);
  });

  it('should return 0 for empty entry', () => {
    expect(calculateDuration('', '17:00')).toBe(0);
  });

  it('should return 0 for --:-- entry', () => {
    expect(calculateDuration('--:--', '17:00')).toBe(0);
  });

  it('should handle overnight shifts', () => {
    expect(calculateDuration('22:00', '06:00')).toBe(8);
  });

  it('should return 0 for null schedule', () => {
    expect(calculateDuration(null, null)).toBe(0);
  });

  it('should handle break without start/end values', () => {
    expect(calculateDuration('08:00', '17:00', '', '')).toBe(9);
  });

  it('should handle partial break times', () => {
    expect(calculateDuration('08:00', '17:00', '12:00', '')).toBe(9);
  });

  it('should handle null break times', () => {
    expect(calculateDuration('08:00', '17:00', null, null)).toBe(9);
  });

  it('should handle undefined break times', () => {
    expect(calculateDuration('08:00', '17:00', undefined, undefined)).toBe(9);
  });
});