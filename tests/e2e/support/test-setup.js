import { test as base, expect } from '@playwright/test';

export { expect };

const getMockData = () => ({
  workers: global._mockWorkers || [],
  clients: global._mockClients || [],
  logs: global._mockLogs || [],
  schedules: global._mockSchedules || [],
  app_notifications: global._mockNotifications || [],
  correcoes: [],
  documents: [],
});

const customTest = base.extend({
  page: async ({ page }, use) => {
    const setupRoutes = () => {
      page.route('**/rest/v1/workers*', route => {
        const data = getMockData();
        const url = new URL(route.request().url());
        const idParam = url.searchParams.get('id');
        let result = data.workers;
        if (idParam && idParam.startsWith('eq.')) {
          const matchId = idParam.replace('id=eq.', '');
          result = result.filter(w => w.id === matchId);
        }
        route.fulfill({ status: 200, body: JSON.stringify(result), headers: { 'Content-Type': 'application/json' } });
      });

      page.route('**/rest/v1/clients*', route => {
        const data = getMockData();
        route.fulfill({ status: 200, body: JSON.stringify(data.clients), headers: { 'Content-Type': 'application/json' } });
      });

      page.route('**/rest/v1/logs*', route => {
        const data = getMockData();
        route.fulfill({ status: 200, body: JSON.stringify(data.logs), headers: { 'Content-Type': 'application/json' } });
      });

      page.route('**/rest/v1/schedules*', route => {
        const data = getMockData();
        route.fulfill({ status: 200, body: JSON.stringify(data.schedules), headers: { 'Content-Type': 'application/json' } });
      });

      page.route('**/rest/v1/app_notifications*', route => {
        const data = getMockData();
        route.fulfill({ status: 200, body: JSON.stringify(data.app_notifications), headers: { 'Content-Type': 'application/json' } });
      });

      page.route('**/rest/v1/correcoes*', route => {
        route.fulfill({ status: 200, body: JSON.stringify([]), headers: { 'Content-Type': 'application/json' } });
      });

      page.route('**/rest/v1/documents*', route => {
        route.fulfill({ status: 200, body: JSON.stringify([]), headers: { 'Content-Type': 'application/json' } });
      });

      page.route('**/rest/v1/approvals*', route => {
        route.fulfill({ status: 200, body: JSON.stringify([]), headers: { 'Content-Type': 'application/json' } });
      });

      page.route('**/rest/v1/client_approvals*', route => {
        route.fulfill({ status: 200, body: JSON.stringify([]), headers: { 'Content-Type': 'application/json' } });
      });
    };

    setupRoutes();
    await use(page);
  },
});

export const test = customTest;

export const setMockData = (workers = [], clients = [], logs = [], notifications = []) => {
  global._mockWorkers = workers;
  global._mockClients = clients;
  global._mockLogs = logs;
  global._mockSchedules = [];
  global._mockNotifications = notifications;
};

export const createTestWorker = (overrides = {}) => ({
  id: 'w_test_001',
  name: 'João Silva',
  nif: '123456789',
  status: 'ativo',
  role: 'worker',
  ...overrides,
});

export const createTestClient = (overrides = {}) => ({
  id: 'c_test_001',
  name: 'EMPRESA TESTE',
  ...overrides,
});

export const loginAsAdmin = async (page) => {
  await page.goto('/');
  await page.click('text=Admin');
};