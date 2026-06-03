import { describe, it, expect } from 'vitest';
import {
  roundTimeToIntervalTimeUp,
  roundTimeToIntervalTimeDown,
  roundTimeToIntervalTime,
  timeToDecimal,
  calculateTimeDiff
} from '../../src/utils/timeUtils';

describe('roundTimeToIntervalTimeUp', () => {
  describe('tolerance = 0 (backwards compatible)', () => {
    it('rounds up to next interval', () => {
      expect(roundTimeToIntervalTimeUp('08:05', 30, 0)).toBe('08:30');
      expect(roundTimeToIntervalTimeUp('08:01', 30, 0)).toBe('08:30');
      expect(roundTimeToIntervalTimeUp('08:29', 30, 0)).toBe('08:30');
    });

    it('exact multiples stay unchanged', () => {
      expect(roundTimeToIntervalTimeUp('08:00', 30, 0)).toBe('08:00');
      expect(roundTimeToIntervalTimeUp('08:30', 30, 0)).toBe('08:30');
    });
  });

  describe('tolerance = 10, interval = 30', () => {
    it('rounds down when within tolerance after previous boundary', () => {
      expect(roundTimeToIntervalTimeUp('08:00', 30, 10)).toBe('08:00');
      expect(roundTimeToIntervalTimeUp('08:05', 30, 10)).toBe('08:00');
      expect(roundTimeToIntervalTimeUp('08:10', 30, 10)).toBe('08:00');
    });

    it('rounds up when past tolerance', () => {
      expect(roundTimeToIntervalTimeUp('08:11', 30, 10)).toBe('08:30');
      expect(roundTimeToIntervalTimeUp('08:20', 30, 10)).toBe('08:30');
      expect(roundTimeToIntervalTimeUp('08:29', 30, 10)).toBe('08:30');
    });

    it('before the hour (previous boundary case)', () => {
      expect(roundTimeToIntervalTimeUp('07:50', 30, 10)).toBe('08:00');
      expect(roundTimeToIntervalTimeUp('07:49', 30, 10)).toBe('08:00');
      expect(roundTimeToIntervalTimeUp('07:30', 30, 10)).toBe('07:30');
    });
  });

  describe('tolerance edge cases', () => {
    it('tolerance 0 keeps original behaviour', () => {
      expect(roundTimeToIntervalTimeUp('07:50', 30, 0)).toBe('08:00');
      expect(roundTimeToIntervalTimeUp('08:05', 30, 0)).toBe('08:30');
    });

    it('minutes at exact tolerance boundary round down', () => {
      expect(roundTimeToIntervalTimeUp('08:10', 30, 10)).toBe('08:00');
    });

    it('minutes just above tolerance round up', () => {
      expect(roundTimeToIntervalTimeUp('08:11', 30, 10)).toBe('08:30');
    });
  });

  describe('different intervals', () => {
    it('interval 15 with tolerance 5', () => {
      expect(roundTimeToIntervalTimeUp('08:00', 15, 5)).toBe('08:00');
      expect(roundTimeToIntervalTimeUp('08:03', 15, 5)).toBe('08:00');
      expect(roundTimeToIntervalTimeUp('08:04', 15, 5)).toBe('08:00');
      expect(roundTimeToIntervalTimeUp('08:05', 15, 5)).toBe('08:00');
      expect(roundTimeToIntervalTimeUp('08:06', 15, 5)).toBe('08:15');
      expect(roundTimeToIntervalTimeUp('08:08', 15, 5)).toBe('08:15');
    });

    it('interval 60 with tolerance 15', () => {
      expect(roundTimeToIntervalTimeUp('08:10', 60, 15)).toBe('08:00');
      expect(roundTimeToIntervalTimeUp('08:14', 60, 15)).toBe('08:00');
      expect(roundTimeToIntervalTimeUp('08:15', 60, 15)).toBe('08:00');
      expect(roundTimeToIntervalTimeUp('08:16', 60, 15)).toBe('09:00');
    });
  });

  describe('invalid input', () => {
    it('returns original string for invalid times', () => {
      expect(roundTimeToIntervalTimeUp('--:--', 30, 10)).toBe('--:--');
      expect(roundTimeToIntervalTimeUp('', 30, 10)).toBe('');
      expect(roundTimeToIntervalTimeUp(null, 30, 10)).toBe(null);
    });
  });
});

describe('roundTimeToIntervalTimeDown', () => {
  it('rounds down regardless of tolerance (tolerance param accepted but unused)', () => {
    expect(roundTimeToIntervalTimeDown('08:05', 30, 10)).toBe('08:00');
    expect(roundTimeToIntervalTimeDown('08:30', 30, 10)).toBe('08:30');
    expect(roundTimeToIntervalTimeDown('08:35', 30, 10)).toBe('08:30');
  });
});

describe('timeToDecimal', () => {
  it('converts time strings to decimal hours', () => {
    expect(timeToDecimal('08:30')).toBe(8.5);
    expect(timeToDecimal('08:00')).toBe(8);
    expect(timeToDecimal('00:00')).toBe(0);
  });

  it('returns 0 for invalid input', () => {
    expect(timeToDecimal('--:--')).toBe(0);
    expect(timeToDecimal('')).toBe(0);
    expect(timeToDecimal(null)).toBe(0);
  });
});

describe('calculateTimeDiff', () => {
  it('calculates difference between two times', () => {
    expect(calculateTimeDiff('08:00', '12:00')).toBe(4);
    expect(calculateTimeDiff('08:30', '12:30')).toBe(4);
    expect(calculateTimeDiff('09:00', '17:30')).toBe(8.5);
  });

  it('returns 0 when any time is invalid', () => {
    expect(calculateTimeDiff('--:--', '12:00')).toBe(0);
    expect(calculateTimeDiff('08:00', '--:--')).toBe(0);
  });
});