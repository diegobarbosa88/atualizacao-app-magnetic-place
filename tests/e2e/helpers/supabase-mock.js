import { createWorker, createClient, createSchedule, createLog, createNotification, createCorrecao } from './test-data-factory.js';

class MockSupabase {
  constructor() {
    this.data = {
      workers: [],
      clients: [],
      schedules: [],
      logs: [],
      app_notifications: [],
      correcoes: [],
      approvals: [],
      documents: [],
      app_settings: [],
    };
    this.subscriptions = new Map();
  }

  static createClient(url, key) {
    return new MockSupabase();
  }

  from(table) {
    const self = this;
    const tableName = table.toLowerCase();

    return {
      select: (columns = '*') => ({
        eq: (field, value) => ({
          then: (cb) => {
            const result = (self.data[tableName] || []).filter(row => row[field] === value);
            return cb({ data: result, error: null });
          }
        }),
        neq: (field, value) => ({
          then: (cb) => {
            const result = (self.data[tableName] || []).filter(row => row[field] !== value);
            return cb({ data: result, error: null });
          }
        }),
        then: (cb) => {
          const result = self.data[tableName] || [];
          return cb({ data: result, error: null });
        },
      }),

      insert: (records) => {
        const recordArray = Array.isArray(records) ? records : [records];
        recordArray.forEach(record => {
          if (!self.data[tableName]) self.data[tableName] = [];
          self.data[tableName].push({ ...record });
        });
        return Promise.resolve({ data: recordArray, error: null });
      },

      upsert: (record) => {
        if (!self.data[tableName]) self.data[tableName] = [];
        const idx = self.data[tableName].findIndex(r => r.id === record.id);
        if (idx >= 0) {
          self.data[tableName][idx] = { ...self.data[tableName][idx], ...record };
        } else {
          self.data[tableName].push(record);
        }
        return Promise.resolve({ data: record, error: null });
      },

      update: (updates) => ({
        eq: (field, value) => ({
          then: (cb) => {
            const idx = (self.data[tableName] || []).findIndex(r => r[field] === value);
            if (idx >= 0) {
              self.data[tableName][idx] = { ...self.data[tableName][idx], ...updates };
              return cb({ data: self.data[tableName][idx], error: null });
            }
            return cb({ data: null, error: { message: 'Not found' } });
          }
        }),
        then: (cb) => {
          (self.data[tableName] || []).forEach((row, idx) => {
            self.data[tableName][idx] = { ...row, ...updates };
          });
          return cb({ data: self.data[tableName], error: null });
        },
      }),

      delete: () => ({
        eq: (field, value) => ({
          then: (cb) => {
            self.data[tableName] = (self.data[tableName] || []).filter(r => r[field] !== value);
            return cb({ error: null });
          }
        }),
        then: (cb) => {
          self.data[tableName] = [];
          return cb({ error: null });
        },
      }),
    };
  }

  channel(name) {
    const handlers = [];
    return {
      on: (event, config, callback) => {
        handlers.push({ event, config, callback });
        return this;
      },
      subscribe: (callback) => {
        if (callback) callback('SUBSCRIBED');
        return 'SUBSCRIBED';
      },
      unsubscribe: () => 'UNSUBSCRIBED',
      _trigger: (event, payload) => {
        handlers.forEach(h => h.callback(payload));
      },
    };
  }

  getData(table) {
    return this.data[table.toLowerCase()] || [];
  }

  setData(table, data) {
    this.data[table.toLowerCase()] = data;
  }

  clearAll() {
    Object.keys(this.data).forEach(key => {
      this.data[key] = [];
    });
  }

  seedTestData() {
    const worker = createWorker({
      id: 'w_test_001',
      name: 'João Silva',
      nif: '123456789',
      status: 'ativo',
    });
    const client = createClient({
      id: 'c_test_001',
      name: 'EMPRESA TESTE',
    });
    const schedule = createSchedule({
      id: 's_test_001',
      name: 'Horário Normal',
    });

    this.data.workers = [worker];
    this.data.clients = [client];
    this.data.schedules = [schedule];
    this.data.logs = [];
    this.data.app_notifications = [];
    this.data.correcoes = [];

    return { worker, client, schedule };
  }

  createLogsForClient(clientId, workerId, workerName, numDays = 5) {
    const logs = [];
    for (let i = 1; i <= numDays; i++) {
      const date = new Date(2026, 4, i);
      logs.push({
        id: `log_${clientId}_${workerId}_${i}`,
        clientId,
        workerId,
        workerName,
        startTime: '08:00',
        endTime: '17:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        date: date.toISOString().split('T')[0],
        hours: 8
      });
    }
    this.data.logs = logs;
    return logs;
  }

  createCorrecaoWithChanges(clientId, month, workersChanges) {
    const correcaoId = `correcao_${Date.now()}`;
    const correcao = createCorrecao({
      id: correcaoId,
      title: `Pedido de Correção: EMPRESA TESTE`,
      status: 'pending',
      client_id: clientId,
      month,
      payload: {
        reportType: 'precision',
        isFullMonth: true,
        changes: workersChanges
      }
    });
    this.data.correcoes.push(correcao);

    const notification = createNotification({
      id: `notif_${Date.now()}`,
      title: `Pedido de Correção: EMPRESA TESTE`,
      target_client_id: clientId,
      target_type: 'admin',
      status: 'pending',
      type: 'warning',
      payload: {
        correcao_id: correcaoId,
        reportType: 'precision',
        isFullMonth: true,
        month,
        changes: workersChanges
      }
    });
    this.data.app_notifications.push(notification);

    return { correcao, notification };
  }

  getRealtimeChannel(channelName) {
    const handlers = [];
    const channel = this.channel(channelName);

    return {
      ...channel,
      on: (event, config, callback) => {
        handlers.push({ event, config, callback });
        return channel;
      },
      subscribe: (callback) => {
        if (callback) callback('SUBSCRIBED');
        return 'SUBSCRIBED';
      },
      _trigger: (event, payload) => {
        handlers.forEach(h => h.callback(payload));
      },
    };
  }

  simulateRealtimeInsert(table, newRecord) {
    const tableName = table.toLowerCase();
    if (!this.data[tableName]) this.data[tableName] = [];
    this.data[tableName].push(newRecord);

    this.subscriptions.forEach((channel) => {
      channel._trigger('INSERT', { eventType: 'INSERT', new: newRecord, table });
    });
  }

  simulateRealtimeUpdate(table, updatedRecord) {
    const tableName = table.toLowerCase();
    const idx = this.data[tableName].findIndex(r => r.id === updatedRecord.id);
    if (idx >= 0) {
      this.data[tableName][idx] = { ...this.data[tableName][idx], ...updatedRecord };
    }

    this.subscriptions.forEach((channel) => {
      channel._trigger('UPDATE', { eventType: 'UPDATE', old: this.data[tableName][idx], new: updatedRecord, table });
    });
  }
}

let mockInstance = null;

export const getMockSupabase = () => {
  if (!mockInstance) {
    mockInstance = new MockSupabase();
  }
  return mockInstance;
};

export const resetMockSupabase = () => {
  mockInstance = new MockSupabase();
  return mockInstance;
};

export const createSupabaseMock = () => {
  return new MockSupabase();
};

export default MockSupabase;
