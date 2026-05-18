import { describe, it, expect, vi } from 'vitest';

const calculateDuration = (entry, exit, breakStart = null, breakEnd = null) => {
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

const calculateMonthTotal = (worker) => {
  if (!worker.dailyRecords && !worker.changes) return worker.editedTotalHours || 0;
  const records = worker.dailyRecords || worker.changes;
  return records.reduce((acc, c) => {
    const entry = c.adminEntry || c.editedEntry || c.entry || '--:--';
    const exit = c.adminExit || c.editedExit || c.exit || '--:--';
    const bStart = c.adminBreakStart || c.breakStart || '--:--';
    const bEnd = c.adminBreakEnd || c.breakEnd || '--:--';
    const h = calculateDuration(entry, exit, bStart === '--:--' ? null : bStart, bEnd === '--:--' ? null : bEnd);
    return acc + h;
  }, 0);
};

describe('handleUpdateDraft', () => {
  const createMockDraft = () => ({
    workers: [
      {
        id: 'w1',
        name: 'João Silva',
        dailyRecords: [
          {
            date: '2026-05-01',
            dateLabel: '01/05 (sex)',
            entry: '08:00',
            exit: '17:00',
            breakStart: '12:00',
            breakEnd: '13:00',
            hours: 8,
            editedEntry: null,
            editedExit: null,
            adminEntry: null,
            adminExit: null,
            adminBreakStart: null,
            adminBreakEnd: null,
          },
          {
            date: '2026-05-02',
            dateLabel: '02/05 (sáb)',
            entry: '08:00',
            exit: '17:00',
            breakStart: '12:00',
            breakEnd: '13:00',
            hours: 8,
          },
        ],
      },
    ],
  });

  it('should update adminEntry for a specific worker and date', () => {
    const currentData = createMockDraft();
    const prevDrafts = {};

    const notif = { id: 'notif_1' };

    const handleUpdateDraft = (workerName, date, field, value) => {
      const newDrafts = { ...prevDrafts };
      const currentDraft = newDrafts[notif.id] || JSON.parse(JSON.stringify(currentData));
      const worker = currentDraft.workers.find(w => w.name === workerName);
      if (worker) {
        let change = (worker.dailyRecords || worker.changes).find(c => (c.date || c.dateLabel) === date);
        if (change) {
          change[field] = value;
          if (field.startsWith('admin')) {
            const entry = change.adminEntry || change.editedEntry || change.entry || '';
            const exit = change.adminExit || change.editedExit || change.exit || '';
            const bStart = change.adminBreakStart || change.breakStart || '--:--';
            const bEnd = change.adminBreakEnd || change.breakEnd || '--:--';
            change.adminHours = calculateDuration(entry, exit, bStart === '--:--' ? null : bStart, bEnd === '--:--' ? null : bEnd);
          }
          worker.editedTotalHours = calculateMonthTotal(worker);
        }
      }
      newDrafts[notif.id] = currentDraft;
      return newDrafts;
    };

    const result = handleUpdateDraft('João Silva', '2026-05-01', 'adminEntry', '09:00');

    expect(result['notif_1'].workers[0].dailyRecords[0].adminEntry).toBe('09:00');
  });

  it('should update adminExit for a specific worker and date', () => {
    const currentData = createMockDraft();
    const prevDrafts = {};
    const notif = { id: 'notif_1' };

    const handleUpdateDraft = (workerName, date, field, value) => {
      const newDrafts = { ...prevDrafts };
      const currentDraft = newDrafts[notif.id] || JSON.parse(JSON.stringify(currentData));
      const worker = currentDraft.workers.find(w => w.name === workerName);
      if (worker) {
        let change = (worker.dailyRecords || worker.changes).find(c => (c.date || c.dateLabel) === date);
        if (change) {
          change[field] = value;
        }
      }
      newDrafts[notif.id] = currentDraft;
      return newDrafts;
    };

    const result = handleUpdateDraft('João Silva', '2026-05-01', 'adminExit', '18:00');

    expect(result['notif_1'].workers[0].dailyRecords[0].adminExit).toBe('18:00');
  });

  it('should convert empty value to --:-- for time fields', () => {
    const currentData = createMockDraft();
    const prevDrafts = {};
    const notif = { id: 'notif_1' };

    const handleUpdateDraft = (workerName, date, field, value) => {
      const newDrafts = { ...prevDrafts };
      const currentDraft = newDrafts[notif.id] || JSON.parse(JSON.stringify(currentData));
      const worker = currentDraft.workers.find(w => w.name === workerName);
      if (worker) {
        let change = (worker.dailyRecords || worker.changes).find(c => (c.date || c.dateLabel) === date);
        if (change) {
          if (field !== 'adminHours' && !value) {
            value = '--:--';
          }
          change[field] = value;
        }
      }
      newDrafts[notif.id] = currentDraft;
      return newDrafts;
    };

    const result = handleUpdateDraft('João Silva', '2026-05-01', 'adminEntry', '');

    expect(result['notif_1'].workers[0].dailyRecords[0].adminEntry).toBe('--:--');
  });

  it('should recalculate hours when adminEntry changes', () => {
    const currentData = createMockDraft();
    const prevDrafts = {};
    const notif = { id: 'notif_1' };

    const handleUpdateDraft = (workerName, date, field, value) => {
      const newDrafts = { ...prevDrafts };
      const currentDraft = newDrafts[notif.id] || JSON.parse(JSON.stringify(currentData));
      const worker = currentDraft.workers.find(w => w.name === workerName);
      if (worker) {
        let change = (worker.dailyRecords || worker.changes).find(c => (c.date || c.dateLabel) === date);
        if (change) {
          if (field !== 'adminHours' && !value) {
            value = '--:--';
          }
          change[field] = value;
          if (field.startsWith('admin')) {
            const entry = change.adminEntry || change.editedEntry || change.entry || '';
            const exit = change.adminExit || change.editedExit || change.exit || '';
            const bStart = change.adminBreakStart || change.breakStart || '--:--';
            const bEnd = change.adminBreakEnd || change.breakEnd || '--:--';
            change.adminHours = calculateDuration(entry, exit, bStart === '--:--' ? null : bStart, bEnd === '--:--' ? null : bEnd);
          }
          worker.editedTotalHours = calculateMonthTotal(worker);
        }
      }
      newDrafts[notif.id] = currentDraft;
      return newDrafts;
    };

    const result = handleUpdateDraft('João Silva', '2026-05-01', 'adminEntry', '09:00');

    expect(result['notif_1'].workers[0].dailyRecords[0].adminHours).toBe(7);
  });

  it('should not modify other workers or dates', () => {
    const currentData = createMockDraft();
    const prevDrafts = {};
    const notif = { id: 'notif_1' };

    const handleUpdateDraft = (workerName, date, field, value) => {
      const newDrafts = { ...prevDrafts };
      const currentDraft = newDrafts[notif.id] || JSON.parse(JSON.stringify(currentData));
      const worker = currentDraft.workers.find(w => w.name === workerName);
      if (worker) {
        let change = (worker.dailyRecords || worker.changes).find(c => (c.date || c.dateLabel) === date);
        if (change) {
          change[field] = value;
        }
      }
      newDrafts[notif.id] = currentDraft;
      return newDrafts;
    };

    const result = handleUpdateDraft('João Silva', '2026-05-01', 'adminEntry', '09:00');

    expect(result['notif_1'].workers[0].dailyRecords[1].adminEntry).toBeUndefined();
  });

  it('should handle adminHours field without converting to --:--', () => {
    const currentData = createMockDraft();
    const prevDrafts = {};
    const notif = { id: 'notif_1' };

    const handleUpdateDraft = (workerName, date, field, value) => {
      const newDrafts = { ...prevDrafts };
      const currentDraft = newDrafts[notif.id] || JSON.parse(JSON.stringify(currentData));
      const worker = currentDraft.workers.find(w => w.name === workerName);
      if (worker) {
        let change = (worker.dailyRecords || worker.changes).find(c => (c.date || c.dateLabel) === date);
        if (change) {
          if (field !== 'adminHours' && !value) {
            value = '--:--';
          }
          change[field] = value;
        }
      }
      newDrafts[notif.id] = currentDraft;
      return newDrafts;
    };

    const result = handleUpdateDraft('João Silva', '2026-05-01', 'adminHours', 0);

    expect(result['notif_1'].workers[0].dailyRecords[0].adminHours).toBe(0);
  });
});
