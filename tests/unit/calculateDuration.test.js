import { describe, it, expect } from 'vitest';

const calculateDuration = (entry, exit, breakStart = null, breakEnd = null) => {
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

describe('calculateDuration', () => {
  it('should calculate basic duration correctly', () => {
    expect(calculateDuration('08:00', '17:00')).toBe(9);
  });

  it('should calculate duration with minutes correctly', () => {
    expect(calculateDuration('08:30', '17:45')).toBe(9.25);
  });

  it('should subtract break time correctly', () => {
    expect(calculateDuration('08:00', '17:00', '12:00', '13:00')).toBe(8);
  });

  it('should subtract break time with minutes correctly', () => {
    expect(calculateDuration('08:00', '17:30', '12:00', '12:45')).toBe(8.75);
  });

  it('should return 0 for empty entry', () => {
    expect(calculateDuration('', '17:00')).toBe(0);
  });

  it('should return 0 for empty exit', () => {
    expect(calculateDuration('08:00', '')).toBe(0);
  });

  it('should return 0 for --:-- entry', () => {
    expect(calculateDuration('--:--', '17:00')).toBe(0);
  });

  it('should return 0 for --:-- exit', () => {
    expect(calculateDuration('08:00', '--:--')).toBe(0);
  });

  it('should return 0 for both --:--', () => {
    expect(calculateDuration('--:--', '--:--')).toBe(0);
  });

  it('should handle overnight shifts', () => {
    expect(calculateDuration('22:00', '06:00')).toBe(8);
  });

  it('should handle overnight shifts with break', () => {
    expect(calculateDuration('22:00', '06:00', '00:00', '01:00')).toBe(7);
  });

  it('should handle same entry and exit (zero hours)', () => {
    expect(calculateDuration('08:00', '08:00')).toBe(0);
  });

  it('should handle null break times', () => {
    expect(calculateDuration('08:00', '17:00', null, null)).toBe(9);
  });

  it('should handle undefined break times', () => {
    expect(calculateDuration('08:00', '17:00', undefined, undefined)).toBe(9);
  });

  it('should handle 1 minute shift', () => {
    expect(calculateDuration('08:00', '08:01')).toBe(0.02);
  });

  it('should handle short shifts', () => {
    expect(calculateDuration('09:00', '10:00')).toBe(1);
  });

  it('should return 0 for invalid time format', () => {
    expect(calculateDuration('invalid', '17:00')).toBe(0);
  });
});
