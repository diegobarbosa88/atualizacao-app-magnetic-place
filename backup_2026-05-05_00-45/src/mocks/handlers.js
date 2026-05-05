import { http, HttpResponse } from 'msw';

const SUPABASE_URL = 'https://ccvxnrnlbipsojbbrzaw.supabase.co';

let mockData = {
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

const resetMockData = () => {
  mockData = {
    workers: [
      {
        id: 'w_admin',
        name: 'Admin User',
        email: 'admin@magnetic.pt',
        nif: '123456789',
        status: 'ativo',
        role: 'admin',
        valorHora: 25,
        tel: '912345678',
        iban: 'PT50000201231234567890154',
        profissao: 'Gestor',
        is_active: true,
        assignedClients: [],
        assignedSchedules: [],
        defaultClientId: null,
        defaultScheduleId: null,
      },
    ],
    clients: [
      {
        id: 'c_test_001',
        name: 'EMPRESA TESTE',
        nif: '987654321',
        email: 'teste@empresa.pt',
        morada: 'Rua Teste, 123',
        valorHora: 35,
        status_email: 'pendente',
        link_gerado: null,
        status: 'ativo',
        totalHoras: 0,
      },
    ],
    schedules: [],
    logs: [],
    app_notifications: [],
    correcoes: [],
    approvals: [],
    documents: [],
    app_settings: [
      {
        id: 'settings_001',
        companyName: 'Magnetic Place',
        companyLogo: '/Magnetic (3).png',
        adminPassword: 'admin123',
        currentMonth: '2026-05',
      },
    ],
  };
};

resetMockData();

export const setMockData = (table, data) => {
  mockData[table] = data;
};

export const getMockData = (table) => {
  return mockData[table] || [];
};

export const handlers = [
  // Auth - Login
  http.post(`${SUPABASE_URL}/auth/v1/token`, async ({ request }) => {
    const body = await request.json();
    const { email, password } = body;

    if (email === 'admin' && password === 'admin123') {
      return HttpResponse.json({
        user: { id: 'w_admin', email: 'admin@magnetic.pt' },
        session: { access_token: 'mock-admin-token', refresh_token: 'mock-refresh-token' },
      });
    }

    const worker = mockData.workers.find(w =>
      w.name.toLowerCase().replace(/\s+/g, '') === email.toLowerCase() &&
      w.nif === password &&
      w.status === 'ativo'
    );

    if (worker) {
      return HttpResponse.json({
        user: { id: worker.id, email: worker.email },
        session: { access_token: `mock-worker-token-${worker.id}`, refresh_token: 'mock-refresh-token' },
      });
    }

    return HttpResponse.json(
      { message: 'Invalid credentials' },
      { status: 400 }
    );
  }),

  // Workers - GET all
  http.get(`${SUPABASE_URL}/rest/v1/workers`, ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const select = url.searchParams.get('select');

    if (id) {
      const worker = mockData.workers.find(w => w.id === id);
      return HttpResponse.json(worker ? [worker] : []);
    }

    return HttpResponse.json(mockData.workers);
  }),

  // Workers - POST
  http.post(`${SUPABASE_URL}/rest/v1/workers`, async ({ request }) => {
    const body = await request.json();
    const newWorker = { ...body, id: body.id || `w_${Date.now()}` };
    mockData.workers.push(newWorker);
    return HttpResponse.json(newWorker, { status: 201 });
  }),

  // Workers - PATCH
  http.patch(`${SUPABASE_URL}/rest/v1/workers`, async ({ request }) => {
    const body = await request.json();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const index = mockData.workers.findIndex(w => w.id === id);
      if (index >= 0) {
        mockData.workers[index] = { ...mockData.workers[index], ...body };
        return HttpResponse.json(mockData.workers[index]);
      }
    }
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),

  // Workers - DELETE
  http.delete(`${SUPABASE_URL}/rest/v1/workers`, ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      mockData.workers = mockData.workers.filter(w => w.id !== id);
      return HttpResponse.json({ message: 'Deleted' });
    }
    return HttpResponse.json({ message: 'Invalid request' }, { status: 400 });
  }),

  // Clients - GET all
  http.get(`${SUPABASE_URL}/rest/v1/clients`, ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const select = url.searchParams.get('select');

    if (id) {
      const client = mockData.clients.find(c => c.id === id);
      return HttpResponse.json(client ? [client] : []);
    }

    return HttpResponse.json(mockData.clients);
  }),

  // Clients - POST
  http.post(`${SUPABASE_URL}/rest/v1/clients`, async ({ request }) => {
    const body = await request.json();
    const newClient = { ...body, id: body.id || `c_${Date.now()}` };
    mockData.clients.push(newClient);
    return HttpResponse.json(newClient, { status: 201 });
  }),

  // Clients - PATCH
  http.patch(`${SUPABASE_URL}/rest/v1/clients`, async ({ request }) => {
    const body = await request.json();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const index = mockData.clients.findIndex(c => c.id === id);
      if (index >= 0) {
        mockData.clients[index] = { ...mockData.clients[index], ...body };
        return HttpResponse.json(mockData.clients[index]);
      }
    }
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),

  // Clients - DELETE
  http.delete(`${SUPABASE_URL}/rest/v1/clients`, ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      mockData.clients = mockData.clients.filter(c => c.id !== id);
      return HttpResponse.json({ message: 'Deleted' });
    }
    return HttpResponse.json({ message: 'Invalid request' }, { status: 400 });
  }),

  // Logs - GET
  http.get(`${SUPABASE_URL}/rest/v1/logs`, ({ request }) => {
    const url = new URL(request.url);
    const workerId = url.searchParams.get('workerId');
    const clientId = url.searchParams.get('clientId');

    let filtered = [...mockData.logs];

    if (workerId) {
      filtered = filtered.filter(l => l.workerId === workerId);
    }
    if (clientId) {
      filtered = filtered.filter(l => l.clientId === clientId);
    }

    return HttpResponse.json(filtered);
  }),

  // Logs - POST
  http.post(`${SUPABASE_URL}/rest/v1/logs`, async ({ request }) => {
    const body = await request.json();
    const newLog = { ...body, id: body.id || `log_${Date.now()}` };
    mockData.logs.push(newLog);
    return HttpResponse.json(newLog, { status: 201 });
  }),

  // Logs - PATCH
  http.patch(`${SUPABASE_URL}/rest/v1/logs`, async ({ request }) => {
    const body = await request.json();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const index = mockData.logs.findIndex(l => l.id === id);
      if (index >= 0) {
        mockData.logs[index] = { ...mockData.logs[index], ...body };
        return HttpResponse.json(mockData.logs[index]);
      }
    }
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),

  // Logs - DELETE
  http.delete(`${SUPABASE_URL}/rest/v1/logs`, ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      mockData.logs = mockData.logs.filter(l => l.id !== id);
      return HttpResponse.json({ message: 'Deleted' });
    }
    return HttpResponse.json({ message: 'Invalid request' }, { status: 400 });
  }),

  // Schedules - GET
  http.get(`${SUPABASE_URL}/rest/v1/schedules`, ({ request }) => {
    return HttpResponse.json(mockData.schedules);
  }),

  // Schedules - POST
  http.post(`${SUPABASE_URL}/rest/v1/schedules`, async ({ request }) => {
    const body = await request.json();
    const newSchedule = { ...body, id: body.id || `s_${Date.now()}` };
    mockData.schedules.push(newSchedule);
    return HttpResponse.json(newSchedule, { status: 201 });
  }),

  // Schedules - PATCH
  http.patch(`${SUPABASE_URL}/rest/v1/schedules`, async ({ request }) => {
    const body = await request.json();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const index = mockData.schedules.findIndex(s => s.id === id);
      if (index >= 0) {
        mockData.schedules[index] = { ...mockData.schedules[index], ...body };
        return HttpResponse.json(mockData.schedules[index]);
      }
    }
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),

  // app_notifications - GET
  http.get(`${SUPABASE_URL}/rest/v1/app_notifications`, ({ request }) => {
    const url = new URL(request.url);
    const targetClientId = url.searchParams.get('target_client_id');
    const targetType = url.searchParams.get('target_type');
    const status = url.searchParams.get('status');

    let filtered = [...mockData.app_notifications];

    if (targetClientId) {
      filtered = filtered.filter(n => n.target_client_id === targetClientId);
    }
    if (targetType) {
      filtered = filtered.filter(n => n.target_type === targetType);
    }
    if (status) {
      filtered = filtered.filter(n => n.status === status);
    }

    return HttpResponse.json(filtered);
  }),

  // app_notifications - POST
  http.post(`${SUPABASE_URL}/rest/v1/app_notifications`, async ({ request }) => {
    const body = await request.json();
    const newNotification = { ...body, id: body.id || `notif_${Date.now()}` };
    mockData.app_notifications.push(newNotification);
    return HttpResponse.json(newNotification, { status: 201 });
  }),

  // app_notifications - PATCH
  http.patch(`${SUPABASE_URL}/rest/v1/app_notifications`, async ({ request }) => {
    const body = await request.json();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const index = mockData.app_notifications.findIndex(n => n.id === id);
      if (index >= 0) {
        mockData.app_notifications[index] = { ...mockData.app_notifications[index], ...body };
        return HttpResponse.json(mockData.app_notifications[index]);
      }
    }
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),

  // correcoes - GET
  http.get(`${SUPABASE_URL}/rest/v1/correcoes`, ({ request }) => {
    const url = new URL(request.url);
    const clientId = url.searchParams.get('client_id');
    const month = url.searchParams.get('month');

    let filtered = [...mockData.correcoes];

    if (clientId) {
      filtered = filtered.filter(c => c.client_id === clientId);
    }
    if (month) {
      filtered = filtered.filter(c => c.month === month);
    }

    return HttpResponse.json(filtered);
  }),

  // correcoes - POST
  http.post(`${SUPABASE_URL}/rest/v1/correcoes`, async ({ request }) => {
    const body = await request.json();
    const newCorrecao = { ...body, id: body.id || `correcao_${Date.now()}` };
    mockData.correcoes.push(newCorrecao);
    return HttpResponse.json(newCorrecao, { status: 201 });
  }),

  // correcoes - PATCH
  http.patch(`${SUPABASE_URL}/rest/v1/correcoes`, async ({ request }) => {
    const body = await request.json();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const index = mockData.correcoes.findIndex(c => c.id === id);
      if (index >= 0) {
        mockData.correcoes[index] = { ...mockData.correcoes[index], ...body };
        return HttpResponse.json(mockData.correcoes[index]);
      }
    }
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),

  // approvals - GET
  http.get(`${SUPABASE_URL}/rest/v1/approvals`, ({ request }) => {
    return HttpResponse.json(mockData.approvals);
  }),

  // approvals - POST
  http.post(`${SUPABASE_URL}/rest/v1/approvals`, async ({ request }) => {
    const body = await request.json();
    const newApproval = { ...body, id: body.id || `approval_${Date.now()}` };
    mockData.approvals.push(newApproval);
    return HttpResponse.json(newApproval, { status: 201 });
  }),

  // approvals - PATCH
  http.patch(`${SUPABASE_URL}/rest/v1/approvals`, async ({ request }) => {
    const body = await request.json();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const index = mockData.approvals.findIndex(a => a.id === id);
      if (index >= 0) {
        mockData.approvals[index] = { ...mockData.approvals[index], ...body };
        return HttpResponse.json(mockData.approvals[index]);
      }
    }
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),

  // documents - GET
  http.get(`${SUPABASE_URL}/rest/v1/documents`, ({ request }) => {
    return HttpResponse.json(mockData.documents);
  }),

  // documents - POST
  http.post(`${SUPABASE_URL}/rest/v1/documents`, async ({ request }) => {
    const body = await request.json();
    const newDoc = { ...body, id: body.id || `doc_${Date.now()}` };
    mockData.documents.push(newDoc);
    return HttpResponse.json(newDoc, { status: 201 });
  }),

  // app_settings - GET
  http.get(`${SUPABASE_URL}/rest/v1/app_settings`, ({ request }) => {
    return HttpResponse.json(mockData.app_settings);
  }),

  // app_settings - PATCH
  http.patch(`${SUPABASE_URL}/rest/v1/app_settings`, async ({ request }) => {
    const body = await request.json();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const index = mockData.app_settings.findIndex(s => s.id === id);
      if (index >= 0) {
        mockData.app_settings[index] = { ...mockData.app_settings[index], ...body };
        return HttpResponse.json(mockData.app_settings[index]);
      }
    }
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),

  // EmailJS mock
  http.post('https://api.emailjs.com/**', () => {
    return HttpResponse.json({ status: 'success', message: 'Email sent (mock)' });
  }),

  // Gemini API mock
  http.post('https://generativelanguage.googleapis.com/**', () => {
    return HttpResponse.json({
      candidates: [{
        content: {
          parts: [{ text: 'Esta é uma resposta simulada pela Mock API. Como posso ajudar?' }]
        }
      }]
    });
  }),
];

export { resetMockData };
export default handlers;