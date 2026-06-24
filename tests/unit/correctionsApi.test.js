import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyCorrection } from '../../src/utils/correctionsApi.js';

// Minimal supabase mock factory
const makeSupabase = ({ upsertFn, insertFn } = {}) => {
  const chain = (overrides = {}) => {
    const obj = {
      upsert: vi.fn(() => Promise.resolve(overrides.upsert ?? { error: null })),
      insert: vi.fn(() => Promise.resolve(overrides.insert ?? { error: null })),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      ...overrides,
    };
    // Make chainable methods return the object itself
    obj.update.mockReturnValue(obj);
    obj.eq.mockReturnValue(obj);
    return obj;
  };

  const sb = {
    _calls: { upsert: [], insert: [] },
    from: vi.fn((table) => {
      const obj = {
        upsert: vi.fn(async (data, opts) => {
          sb._calls.upsert.push({ table, data, opts });
          return upsertFn ? upsertFn(table, data) : { error: null };
        }),
        insert: vi.fn(async (data) => {
          sb._calls.insert.push({ table, data });
          return insertFn ? insertFn(table, data) : { error: null };
        }),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      obj.update.mockReturnValue(obj);
      obj.eq.mockReturnValue({ ...obj, then: undefined }); // resolve as value
      // Make update().eq().eq() resolve
      const makeResolvable = (o) => {
        o.eq = vi.fn((k, v) => {
          const next = { ...o, eq: o.eq };
          next.then = (cb) => Promise.resolve({ error: null }).then(cb);
          return next;
        });
        return o;
      };
      const updateObj = makeResolvable({ ...obj });
      obj.update = vi.fn(() => updateObj);
      const deleteObj = makeResolvable({ ...obj });
      obj.delete = vi.fn(() => deleteObj);
      return obj;
    }),
  };
  return sb;
};

// Helper item shapes
const makeItem = (id, workerId, date, overrides = {}) => ({
  id,
  worker_id: workerId,
  worker_name: 'Worker ' + workerId,
  date,
  item_status: 'accepted',
  before: null,
  proposed: { startTime: '09:00', endTime: '17:00', breakStart: null, breakEnd: null, hours: 8 },
  final: { startTime: '09:00', endTime: '17:00', breakStart: null, breakEnd: null, hours: 8 },
  ...overrides,
});

const makeCorrection = (overrides = {}) => ({
  id: 'corr_1',
  client_id: 'client_1',
  month: '2026-05',
  status: 'under_review',
  ...overrides,
});

describe('applyCorrection', () => {
  describe('rejects when items are still pending', () => {
    it('throws if any item is pending', async () => {
      const sb = makeSupabase();
      const correction = makeCorrection();
      const items = [
        makeItem('i1', 'w1', '2026-05-01'),
        makeItem('i2', 'w2', '2026-05-02', { item_status: 'pending' }),
      ];
      await expect(
        applyCorrection(sb, { correction, items, logs: [], reviewer: 'admin' })
      ).rejects.toThrow('1 item(ns) por resolver');
    });

    it('throws listing all pending items count', async () => {
      const sb = makeSupabase();
      const items = [
        makeItem('i1', 'w1', '2026-05-01', { item_status: 'pending' }),
        makeItem('i2', 'w2', '2026-05-02', { item_status: 'pending' }),
        makeItem('i3', 'w3', '2026-05-03', { item_status: 'pending' }),
      ];
      await expect(
        applyCorrection(sb, { correction: makeCorrection(), items, logs: [], reviewer: 'admin' })
      ).rejects.toThrow('3 item(ns) por resolver');
    });
  });

  describe('parallel DB writes via Promise.allSettled', () => {
    it('processes multiple accepted items concurrently (upsert for existing logs)', async () => {
      const upsertOrder = [];
      let resolveFns = [];

      const sb = {
        from: vi.fn((table) => {
          if (table === 'logs') {
            return {
              upsert: vi.fn((data) => {
                return new Promise((resolve) => {
                  upsertOrder.push(data.id || data[0]?.id);
                  resolveFns.push(() => resolve({ error: null }));
                });
              }),
              insert: vi.fn(() => Promise.resolve({ error: null })),
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
            };
          }
          // corrections table and notifications
          const obj = {
            update: vi.fn().mockReturnThis(),
            insert: vi.fn(() => Promise.resolve({ error: null })),
            eq: vi.fn().mockReturnThis(),
          };
          obj.update.mockReturnValue({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) });
          return obj;
        }),
      };

      const logs = [
        { id: 'log_w1', workerId: 'w1', date: '2026-05-01' },
        { id: 'log_w2', workerId: 'w2', date: '2026-05-02' },
      ];
      const items = [
        makeItem('i1', 'w1', '2026-05-01'),
        makeItem('i2', 'w2', '2026-05-02'),
      ];

      const applyPromise = applyCorrection(sb, {
        correction: makeCorrection(),
        items,
        logs,
        reviewer: 'admin',
      });

      // Both upserts should be in-flight before we resolve either
      await new Promise((r) => setTimeout(r, 0)); // microtask flush
      expect(upsertOrder.length).toBe(2); // both started concurrently

      resolveFns.forEach((r) => r());
      await applyPromise; // should complete now
    });

    it('resolves successfully when all items are accepted with existing logs', async () => {
      const upsertCalls = [];
      const sb = {
        from: vi.fn((table) => {
          if (table === 'logs') {
            return {
              upsert: vi.fn((data) => {
                upsertCalls.push(data);
                return Promise.resolve({ error: null });
              }),
              insert: vi.fn(() => Promise.resolve({ error: null })),
            };
          }
          return {
            update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })),
            insert: vi.fn(() => Promise.resolve({ error: null })),
            eq: vi.fn().mockReturnThis(),
          };
        }),
      };

      const logs = [{ id: 'log_w1', workerId: 'w1', date: '2026-05-01' }];
      const items = [makeItem('i1', 'w1', '2026-05-01')];

      await expect(
        applyCorrection(sb, { correction: makeCorrection(), items, logs, reviewer: 'admin' })
      ).resolves.toBeUndefined();

      expect(upsertCalls).toHaveLength(1);
    });

    it('inserts new log when no existing log matches worker+date', async () => {
      const insertCalls = [];
      const sb = {
        from: vi.fn((table) => {
          if (table === 'logs') {
            return {
              upsert: vi.fn(() => Promise.resolve({ error: null })),
              insert: vi.fn((data) => {
                insertCalls.push(data);
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {
            update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })),
            insert: vi.fn(() => Promise.resolve({ error: null })),
            eq: vi.fn().mockReturnThis(),
          };
        }),
      };

      const items = [makeItem('i1', 'w1', '2026-05-10')]; // no matching log
      await applyCorrection(sb, {
        correction: makeCorrection(),
        items,
        logs: [], // empty — no existing log
        reviewer: 'admin',
      });

      expect(insertCalls).toHaveLength(1);
      expect(insertCalls[0]).toMatchObject({
        workerId: 'w1',
        clientId: 'client_1',
        date: '2026-05-10',
        startTime: '09:00',
        endTime: '17:00',
      });
    });

    it('skips rejected items — does not write to logs', async () => {
      const writeCalls = [];
      const sb = {
        from: vi.fn((table) => {
          if (table === 'logs') {
            return {
              upsert: vi.fn((d) => { writeCalls.push(d); return Promise.resolve({ error: null }); }),
              insert: vi.fn((d) => { writeCalls.push(d); return Promise.resolve({ error: null }); }),
            };
          }
          return {
            update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })),
            insert: vi.fn(() => Promise.resolve({ error: null })),
          };
        }),
      };

      const items = [
        makeItem('i1', 'w1', '2026-05-01', { item_status: 'rejected', final: null }),
        makeItem('i2', 'w2', '2026-05-02'), // accepted
      ];
      await applyCorrection(sb, {
        correction: makeCorrection(),
        items,
        logs: [],
        reviewer: 'admin',
      });

      // Only the accepted item triggers a write
      expect(writeCalls).toHaveLength(1);
    });
  });

  describe('error handling — partial failures via Promise.allSettled', () => {
    it('throws aggregated error when one DB write fails', async () => {
      const sb = {
        from: vi.fn((table) => {
          if (table === 'logs') {
            return {
              upsert: vi.fn(() => Promise.resolve({ error: { message: 'DB constraint error' } })),
              insert: vi.fn(() => Promise.resolve({ error: null })),
            };
          }
          return {
            update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })),
            insert: vi.fn(() => Promise.resolve({ error: null })),
          };
        }),
      };

      const logs = [{ id: 'log_w1', workerId: 'w1', date: '2026-05-01' }];
      const items = [makeItem('i1', 'w1', '2026-05-01')];

      await expect(
        applyCorrection(sb, { correction: makeCorrection(), items, logs, reviewer: 'admin' })
      ).rejects.toThrow('Falha ao aplicar 1 item(ns)');
    });

    it('includes all failure reasons in the thrown error', async () => {
      let callCount = 0;
      const sb = {
        from: vi.fn((table) => {
          if (table === 'logs') {
            return {
              upsert: vi.fn(() => {
                callCount++;
                return Promise.resolve({ error: { message: `error_${callCount}` } });
              }),
              insert: vi.fn(() => Promise.resolve({ error: null })),
            };
          }
          return {
            update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })),
            insert: vi.fn(() => Promise.resolve({ error: null })),
          };
        }),
      };

      const logs = [
        { id: 'log_w1', workerId: 'w1', date: '2026-05-01' },
        { id: 'log_w2', workerId: 'w2', date: '2026-05-02' },
      ];
      const items = [
        makeItem('i1', 'w1', '2026-05-01'),
        makeItem('i2', 'w2', '2026-05-02'),
      ];

      let caught;
      try {
        await applyCorrection(sb, { correction: makeCorrection(), items, logs, reviewer: 'admin' });
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeDefined();
      expect(caught.message).toMatch('Falha ao aplicar 2 item(ns)');
      expect(caught.message).toContain('error_1');
      expect(caught.message).toContain('error_2');
    });

    it('still throws even when only one of many items fails', async () => {
      const logs = [
        { id: 'log_w1', workerId: 'w1', date: '2026-05-01' },
        { id: 'log_w2', workerId: 'w2', date: '2026-05-02' },
        { id: 'log_w3', workerId: 'w3', date: '2026-05-03' },
      ];
      let upsertCallIdx = 0;
      const sb = {
        from: vi.fn((table) => {
          if (table === 'logs') {
            return {
              upsert: vi.fn(() => {
                const idx = upsertCallIdx++;
                const error = idx === 1 ? { message: 'only middle fails' } : null;
                return Promise.resolve({ error });
              }),
              insert: vi.fn(() => Promise.resolve({ error: null })),
            };
          }
          return {
            update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })),
            insert: vi.fn(() => Promise.resolve({ error: null })),
          };
        }),
      };

      const items = [
        makeItem('i1', 'w1', '2026-05-01'),
        makeItem('i2', 'w2', '2026-05-02'),
        makeItem('i3', 'w3', '2026-05-03'),
      ];

      await expect(
        applyCorrection(sb, { correction: makeCorrection(), items, logs, reviewer: 'admin' })
      ).rejects.toThrow('Falha ao aplicar 1 item(ns)');
    });

    it('does not mark correction as applied when DB writes fail', async () => {
      const correctionUpdates = [];
      const sb = {
        from: vi.fn((table) => {
          if (table === 'logs') {
            return {
              upsert: vi.fn(() => Promise.resolve({ error: { message: 'write failed' } })),
              insert: vi.fn(() => Promise.resolve({ error: null })),
            };
          }
          if (table === 'corrections') {
            return {
              update: vi.fn((data) => {
                correctionUpdates.push(data);
                return { eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) };
              }),
            };
          }
          return {
            insert: vi.fn(() => Promise.resolve({ error: null })),
          };
        }),
      };

      const logs = [{ id: 'log_w1', workerId: 'w1', date: '2026-05-01' }];
      const items = [makeItem('i1', 'w1', '2026-05-01')];

      try {
        await applyCorrection(sb, { correction: makeCorrection(), items, logs, reviewer: 'admin' });
      } catch (_) {}

      // corrections.update should NOT have been called (error thrown before reaching it)
      expect(correctionUpdates).toHaveLength(0);
    });
  });

  describe('supabase guard', () => {
    it('throws immediately if supabase is null', async () => {
      await expect(
        applyCorrection(null, { correction: makeCorrection(), items: [], logs: [], reviewer: 'admin' })
      ).rejects.toThrow('Supabase indisponível');
    });
  });
});
