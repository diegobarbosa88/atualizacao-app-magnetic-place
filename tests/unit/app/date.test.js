import { describe, it, expect } from 'vitest';

const formatDocDate = (dateStr, showTime = false) => {
  if (!dateStr) return '--/--/----';
  if (dateStr.length === 10) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(dateStr);
  if (showTime) {
    return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-PT');
};

const isSameMonth = (dateStr, targetDate) => {
  if (!dateStr) return false;
  const [y, m] = dateStr.split('-').map(Number);
  return y === targetDate.getFullYear() && (m - 1) === targetDate.getMonth();
};

const getISOWeek = (d) => {
  if (!d || isNaN(d.getTime())) return 0;
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const formatHours = (h) => {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return `${hours}h${minutes === 0 ? '00' : minutes.toString().padStart(2, '0')}`;
};

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val || 0);
};

const toTimeInputValue = (val) => val === '--:--' ? '' : (val || '');

describe('isSameMonth', () => {
  it('should return true for same month', () => {
    expect(isSameMonth('2026-05-15', new Date(2026, 4, 20))).toBe(true);
  });

  it('should return true for same month different day', () => {
    expect(isSameMonth('2026-05-01', new Date(2026, 4, 30))).toBe(true);
  });

  it('should return false for different month', () => {
    expect(isSameMonth('2026-05-15', new Date(2026, 3, 20))).toBe(false);
  });

  it('should return false for different year same month', () => {
    expect(isSameMonth('2025-05-15', new Date(2026, 4, 20))).toBe(false);
  });

  it('should return false for different year and month', () => {
    expect(isSameMonth('2025-12-25', new Date(2026, 4, 20))).toBe(false);
  });

  it('should return false for null dateStr', () => {
    expect(isSameMonth(null, new Date())).toBe(false);
  });

  it('should return false for undefined dateStr', () => {
    expect(isSameMonth(undefined, new Date())).toBe(false);
  });

  it('should return false for empty dateStr', () => {
    expect(isSameMonth('', new Date())).toBe(false);
  });

  it('should return false for whitespace dateStr', () => {
    expect(isSameMonth('   ', new Date())).toBe(false);
  });

  it('should handle Date object as dateStr (edge case)', () => {
    const date = new Date(2026, 4, 15);
    const result = isSameMonth(date.toISOString(), new Date(2026, 4, 20));
    expect(result).toBe(true);
  });

  it('should handle leap year month correctly', () => {
    expect(isSameMonth('2024-02-29', new Date(2024, 1, 29))).toBe(true);
  });

  it('should return false for January vs December previous year', () => {
    expect(isSameMonth('2026-01-15', new Date(2025, 11, 15))).toBe(false);
  });
});

describe('formatDocDate', () => {
  it('should format ISO date correctly', () => {
    expect(formatDocDate('2026-05-15')).toBe('15/05/2026');
  });

  it('should format date with leading zeros', () => {
    expect(formatDocDate('2026-01-05')).toBe('05/01/2026');
  });

  it('should return placeholder for null', () => {
    expect(formatDocDate(null)).toBe('--/--/----');
  });

  it('should return placeholder for undefined', () => {
    expect(formatDocDate(undefined)).toBe('--/--/----');
  });

  it('should return placeholder for empty string', () => {
    expect(formatDocDate('')).toBe('--/--/----');
  });

  it('should format date with time when showTime is true', () => {
    const result = formatDocDate('2026-05-15T14:30:00', true);
    expect(result).toMatch(/15\/05\/2026/);
  });

  it('should handle single digit day and month', () => {
    expect(formatDocDate('2026-01-01')).toBe('01/01/2026');
  });

  it('should handle last day of month', () => {
    expect(formatDocDate('2026-02-28')).toBe('28/02/2026');
  });

  it('should handle December correctly', () => {
    expect(formatDocDate('2026-12-25')).toBe('25/12/2026');
  });
});

describe('getISOWeek', () => {
  it('should return 1 for first week of year', () => {
    expect(getISOWeek(new Date(2026, 0, 1))).toBe(1);
  });

  it('should return correct week for middle of year', () => {
    const week = getISOWeek(new Date(2026, 5, 15));
    expect(week).toBeGreaterThan(1);
    expect(week).toBeLessThan(53);
  });

  it('should return 0 for invalid date', () => {
    expect(getISOWeek(null)).toBe(0);
  });

  it('should return 0 for undefined', () => {
    expect(getISOWeek(undefined)).toBe(0);
  });

  it('should return 0 for NaN date', () => {
    expect(getISOWeek(new Date('invalid'))).toBe(0);
  });

  it('should handle January 4th correctly', () => {
    expect(getISOWeek(new Date(2026, 0, 4))).toBe(1);
  });

  it('should handle last day of year', () => {
    const week = getISOWeek(new Date(2026, 11, 31));
    expect(week).toBeGreaterThan(0);
    expect(week).toBeLessThanOrEqual(53);
  });

  it('should handle leap year correctly', () => {
    const week = getISOWeek(new Date(2024, 1, 29));
    expect(week).toBeGreaterThan(0);
  });
});

describe('formatHours', () => {
  it('should format whole hours correctly', () => {
    expect(formatHours(9)).toBe('9h00');
  });

  it('should format hours with minutes correctly', () => {
    expect(formatHours(9.25)).toBe('9h15');
  });

  it('should format hours with 30 minutes', () => {
    expect(formatHours(8.5)).toBe('8h30');
  });

  it('should format 0 hours', () => {
    expect(formatHours(0)).toBe('0h00');
  });

  it('should handle null as 0', () => {
    const result = formatHours(null);
    expect(result).toMatch(/^[0-9]+h[0-9]{2}$/);
  });

  it('should handle undefined gracefully (returns NaNhNaN)', () => {
    const result = formatHours(undefined);
    expect(result).toBe('NaNhNaN');
  });

  it('should handle fractional minutes', () => {
    expect(formatHours(8.75)).toBe('8h45');
  });

  it('should handle very small fractions', () => {
    const result = formatHours(0.02);
    expect(result).toMatch(/0h0[01]/);
  });

  it('should round minutes correctly', () => {
    expect(formatHours(8.33)).toBe('8h20');
  });

  it('should handle negative values as-is', () => {
    expect(formatHours(-5)).toBe('-5h00');
  });
});

describe('formatCurrency', () => {
  it('should format positive values', () => {
    const result = formatCurrency(100);
    expect(result).toContain('100');
    expect(result).toContain('€');
  });

  it('should format zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
    expect(result).toContain('€');
  });

  it('should format null as zero', () => {
    const result = formatCurrency(null);
    expect(result).toContain('0');
  });

  it('should format undefined as zero', () => {
    const result = formatCurrency(undefined);
    expect(result).toContain('0');
  });

  it('should format decimal values correctly', () => {
    const result = formatCurrency(99.99);
    expect(result).toContain('99');
    expect(result).toContain('€');
  });

  it('should format large values', () => {
    const result = formatCurrency(10000);
    expect(result).toContain('10');
    expect(result).toContain('€');
  });

  it('should handle negative values', () => {
    const result = formatCurrency(-50);
    expect(result).toContain('-50');
  });

  it('should format with 2 decimal places', () => {
    const result = formatCurrency(123.456);
    expect(result).toMatch(/123,46/);
  });

  it('should include euro symbol', () => {
    const result = formatCurrency(100);
    expect(result).toContain('100');
    expect(result).toContain('€');
  });
});

describe('toTimeInputValue', () => {
  it('should return empty string for --:--', () => {
    expect(toTimeInputValue('--:--')).toBe('');
  });

  it('should return the value for normal time', () => {
    expect(toTimeInputValue('08:00')).toBe('08:00');
  });

  it('should return empty string for null', () => {
    expect(toTimeInputValue(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(toTimeInputValue(undefined)).toBe('');
  });

  it('should return the value for valid time string', () => {
    expect(toTimeInputValue('17:30')).toBe('17:30');
  });

  it('should return value as-is for other special markers', () => {
    expect(toTimeInputValue('----')).toBe('----');
  });
});