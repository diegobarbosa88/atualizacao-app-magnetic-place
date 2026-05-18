/**
 * Tests for the parallelized log-save logic in ClientPortal.handleAcceptContestation.
 *
 * The component is not rendered here — instead we extract and test the three-phase
 * algorithm (collect → parallel persist → single state update) as a pure function
 * matching the exact logic in ClientPortal.jsx lines 136-168.
 */
import { describe, it, expect, vi } from 'vitest';

// ─── Extracted algorithm (mirrors ClientPortal.jsx lines 136-168 exactly) ───

async function applyContestationChanges({ changes, logs, clientId, saveToDb, setLogs }) {
  const updates = [];
  const inserts = [];

  for (const w of changes) {
    for (const d of w.dailyRecords) {
      const targetWorkerId = String(w.id);
      const targetClientId = String(clientId);
      const targetDate = d.date || d.dateLabel || d.rawDate;
      const originalLog = logs.find(
        (l) =>
          String(l.workerId || l.worker_id) === targetWorkerId &&
          l.date === targetDate &&
          String(l.clientId || l.client_id) === targetClientId
      );
      const entry = (d.adminEntry || d.editedEntry || d.newEntry) === '--:--'
        ? null
        : (d.adminEntry || d.editedEntry || d.newEntry);
      const exit = (d.adminExit || d.editedExit || d.newExit) === '--:--'
        ? null
        : (d.adminExit || d.editedExit || d.newExit);

      if (originalLog) {
        updates.push({
          id: originalLog.id,
          data: {
            ...originalLog,
            startTime: entry,
            endTime: exit,
            breakStart: d.adminBreakStart || d.editedBreakStart || d.newBreakStart,
            breakEnd: d.adminBreakEnd || d.editedBreakEnd || d.newBreakEnd,
            hours: d.adminHours || d.editedHours || d.newHours,
          },
        });
      } else {
        const newLogId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        inserts.push({
          id: newLogId,
          data: {
            id: newLogId,
            date: targetDate,
            workerId: targetWorkerId,
            clientId: targetClientId,
            startTime: entry,
            endTime: exit,
            breakStart: d.adminBreakStart || d.editedBreakStart || d.newBreakStart,
            breakEnd: d.adminBreakEnd || d.editedBreakEnd || d.newBreakEnd,
            hours: d.adminHours || d.editedHours || d.newHours,
          },
        });
      }
    }
  }

  // Phase 2: parallel persist
  await Promise.all([
    ...updates.map((u) => saveToDb('logs', u.id, u.data)),
    ...inserts.map((i) => saveToDb('logs', i.id, i.data)),
  ]);

  // Phase 3: single consolidated state update
  setLogs((prev) => {
    const updateMap = new Map(updates.map((u) => [u.id, u.data]));
    const updated = prev.map((l) => (updateMap.has(l.id) ? { ...l, ...updateMap.get(l.id) } : l));
    return [...updated, ...inserts.map((i) => i.data)];
  });

  return { updates, inserts };
}

// ─── Helpers ───

const makeDay = (date, entry = '09:00', exit = '17:00', hours = 8) => ({
  date,
  adminEntry: entry,
  adminExit: exit,
  adminHours: hours,
});

const makeWorkerChange = (id, dailyRecords) => ({ id, dailyRecords });

const makeLog = (id, workerId, date, clientId = 'c1') => ({
  id,
  workerId,
  date,
  clientId,
  startTime: '08:00',
  endTime: '16:00',
  hours: 8,
});

// ─── Tests ───

describe('applyContestationChanges — Phase 1: collect + ID generation', () => {
  it('classifies existing logs as updates', async () => {
    const log = makeLog('log1', 'w1', '2026-05-01');
    const saveToDb = vi.fn(() => Promise.resolve());
    const setLogs = vi.fn();

    const { updates, inserts } = await applyContestationChanges({
      changes: [makeWorkerChange('w1', [makeDay('2026-05-01')])],
      logs: [log],
      clientId: 'c1',
      saveToDb,
      setLogs,
    });

    expect(updates).toHaveLength(1);
    expect(inserts).toHaveLength(0);
    expect(updates[0].id).toBe('log1');
  });

  it('classifies missing logs as inserts with generated IDs', async () => {
    const saveToDb = vi.fn(() => Promise.resolve());
    const setLogs = vi.fn();

    const { updates, inserts } = await applyContestationChanges({
      changes: [makeWorkerChange('w1', [makeDay('2026-05-10')])],
      logs: [],
      clientId: 'c1',
      saveToDb,
      setLogs,
    });

    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].id).toMatch(/^log_\d+_[a-z0-9]+$/);
  });

  it('generates unique IDs for multiple simultaneous inserts', async () => {
    const saveToDb = vi.fn(() => Promise.resolve());
    const setLogs = vi.fn();

    const { inserts } = await applyContestationChanges({
      changes: [
        makeWorkerChange('w1', [makeDay('2026-05-01'), makeDay('2026-05-02')]),
        makeWorkerChange('w2', [makeDay('2026-05-01')]),
      ],
      logs: [],
      clientId: 'c1',
      saveToDb,
      setLogs,
    });

    const ids = inserts.map((i) => i.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('maps "adminEntry" fields correctly onto the data shape', async () => {
    const log = makeLog('log1', 'w1', '2026-05-01');
    const saveToDb = vi.fn(() => Promise.resolve());
    const setLogs = vi.fn();

    const { updates } = await applyContestationChanges({
      changes: [makeWorkerChange('w1', [{ date: '2026-05-01', adminEntry: '10:00', adminExit: '18:00', adminHours: 8 }])],
      logs: [log],
      clientId: 'c1',
      saveToDb,
      setLogs,
    });

    expect(updates[0].data.startTime).toBe('10:00');
    expect(updates[0].data.endTime).toBe('18:00');
  });

  it('normalizes "--:--" entry/exit to null', async () => {
    const log = makeLog('log1', 'w1', '2026-05-01');
    const saveToDb = vi.fn(() => Promise.resolve());
    const setLogs = vi.fn();

    const { updates } = await applyContestationChanges({
      changes: [makeWorkerChange('w1', [{ date: '2026-05-01', adminEntry: '--:--', adminExit: '--:--', adminHours: 0 }])],
      logs: [log],
      clientId: 'c1',
      saveToDb,
      setLogs,
    });

    expect(updates[0].data.startTime).toBeNull();
    expect(updates[0].data.endTime).toBeNull();
  });
});

describe('applyContestationChanges — Phase 2: parallel saves', () => {
  it('calls saveToDb for every update and insert', async () => {
    const saveToDb = vi.fn(() => Promise.resolve());
    const setLogs = vi.fn();

    const logs = [
      makeLog('log1', 'w1', '2026-05-01'),
      makeLog('log2', 'w2', '2026-05-02'),
    ];

    await applyContestationChanges({
      changes: [
        makeWorkerChange('w1', [makeDay('2026-05-01')]),
        makeWorkerChange('w2', [makeDay('2026-05-02')]),
        makeWorkerChange('w3', [makeDay('2026-05-03')]), // no existing log → insert
      ],
      logs,
      clientId: 'c1',
      saveToDb,
      setLogs,
    });

    // 2 updates + 1 insert = 3 saveToDb calls
    expect(saveToDb).toHaveBeenCalledTimes(3);
    expect(saveToDb).toHaveBeenCalledWith('logs', 'log1', expect.any(Object));
    expect(saveToDb).toHaveBeenCalledWith('logs', 'log2', expect.any(Object));
    // insert uses generated id
    const insertCall = saveToDb.mock.calls.find((c) => c[1] !== 'log1' && c[1] !== 'log2');
    expect(insertCall[0]).toBe('logs');
    expect(insertCall[1]).toMatch(/^log_/);
  });

  it('launches all saves concurrently — none blocked by the others', async () => {
    const order = [];
    let resolvers = [];

    const saveToDb = vi.fn(() =>
      new Promise((resolve) => {
        resolvers.push(resolve);
      })
    );
    const setLogs = vi.fn();

    const logs = [makeLog('log1', 'w1', '2026-05-01'), makeLog('log2', 'w2', '2026-05-02')];

    const applyPromise = applyContestationChanges({
      changes: [
        makeWorkerChange('w1', [makeDay('2026-05-01')]),
        makeWorkerChange('w2', [makeDay('2026-05-02')]),
      ],
      logs,
      clientId: 'c1',
      saveToDb,
      setLogs,
    });

    // After one microtask tick both saves should be in-flight
    await Promise.resolve();
    expect(saveToDb).toHaveBeenCalledTimes(2); // both launched before either resolved

    // Resolve all
    resolvers.forEach((r) => r());
    await applyPromise;
  });

  it('propagates a rejected save as a thrown error', async () => {
    const saveToDb = vi.fn(() => Promise.reject(new Error('network timeout')));
    const setLogs = vi.fn();

    await expect(
      applyContestationChanges({
        changes: [makeWorkerChange('w1', [makeDay('2026-05-01')])],
        logs: [makeLog('log1', 'w1', '2026-05-01')],
        clientId: 'c1',
        saveToDb,
        setLogs,
      })
    ).rejects.toThrow('network timeout');
  });

  it('does not call setLogs if saves fail', async () => {
    const saveToDb = vi.fn(() => Promise.reject(new Error('db error')));
    const setLogs = vi.fn();

    try {
      await applyContestationChanges({
        changes: [makeWorkerChange('w1', [makeDay('2026-05-01')])],
        logs: [makeLog('log1', 'w1', '2026-05-01')],
        clientId: 'c1',
        saveToDb,
        setLogs,
      });
    } catch (_) {}

    expect(setLogs).not.toHaveBeenCalled();
  });
});

describe('applyContestationChanges — Phase 3: single consolidated setLogs call', () => {
  it('calls setLogs exactly once after all saves succeed', async () => {
    const saveToDb = vi.fn(() => Promise.resolve());
    const setLogs = vi.fn();

    await applyContestationChanges({
      changes: [
        makeWorkerChange('w1', [makeDay('2026-05-01'), makeDay('2026-05-02')]),
        makeWorkerChange('w2', [makeDay('2026-05-01')]),
      ],
      logs: [makeLog('log1', 'w1', '2026-05-01'), makeLog('log2', 'w2', '2026-05-01')],
      clientId: 'c1',
      saveToDb,
      setLogs,
    });

    expect(setLogs).toHaveBeenCalledTimes(1);
  });

  it('updater replaces existing log data in prev state', () => {
    const existingLog = makeLog('log1', 'w1', '2026-05-01');
    const prev = [existingLog];

    // Simulate what the updater does
    const updates = [{ id: 'log1', data: { ...existingLog, startTime: '10:00', endTime: '18:00' } }];
    const inserts = [];
    const updater = (p) => {
      const updateMap = new Map(updates.map((u) => [u.id, u.data]));
      const updated = p.map((l) => (updateMap.has(l.id) ? { ...l, ...updateMap.get(l.id) } : l));
      return [...updated, ...inserts.map((i) => i.data)];
    };

    const result = updater(prev);
    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe('10:00');
    expect(result[0].endTime).toBe('18:00');
  });

  it('updater appends new inserts to existing logs', () => {
    const existingLog = makeLog('log1', 'w1', '2026-05-01');
    const prev = [existingLog];

    const updates = [];
    const inserts = [
      {
        id: 'log_new',
        data: { id: 'log_new', workerId: 'w2', date: '2026-05-02', clientId: 'c1', startTime: '09:00', endTime: '17:00' },
      },
    ];
    const updater = (p) => {
      const updateMap = new Map(updates.map((u) => [u.id, u.data]));
      const updated = p.map((l) => (updateMap.has(l.id) ? { ...l, ...updateMap.get(l.id) } : l));
      return [...updated, ...inserts.map((i) => i.data)];
    };

    const result = updater(prev);
    expect(result).toHaveLength(2);
    expect(result[1].id).toBe('log_new');
  });

  it('updater leaves unrelated logs untouched', () => {
    const log1 = makeLog('log1', 'w1', '2026-05-01');
    const log2 = makeLog('log2', 'w2', '2026-05-02');
    const prev = [log1, log2];

    const updates = [{ id: 'log1', data: { ...log1, startTime: '11:00' } }];
    const inserts = [];
    const updater = (p) => {
      const updateMap = new Map(updates.map((u) => [u.id, u.data]));
      const updated = p.map((l) => (updateMap.has(l.id) ? { ...l, ...updateMap.get(l.id) } : l));
      return [...updated, ...inserts.map((i) => i.data)];
    };

    const result = updater(prev);
    expect(result[1]).toEqual(log2); // log2 unchanged
    expect(result[0].startTime).toBe('11:00'); // log1 updated
  });
});
