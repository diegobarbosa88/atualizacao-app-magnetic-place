import { faker } from '@faker-js/faker';

export const createWorker = (overrides = {}) => ({
  id: `w${Date.now()}${faker.string.numeric(4)}`,
  name: `${faker.person.firstName('male')} ${faker.person.lastName('male')}`,
  nif: faker.string.numeric(9),
  email: faker.internet.email().toLowerCase(),
  profissao: faker.helpers.arrayElement(['Soldador', 'Electricista', 'Mecânico', 'Operador']),
  tel: faker.phone.number('### ### ###'),
  valorHora: parseFloat(faker.finance.amount(25, 50)),
  iban: faker.finance.iban(),
  nis: faker.string.numeric(8),
  is_active: true,
  status: 'ativo',
  assignedClients: [],
  assignedSchedules: [],
  defaultClientId: null,
  defaultScheduleId: null,
  ...overrides,
});

export const createClient = (overrides = {}) => ({
  id: `c${Date.now()}${faker.string.numeric(4)}`,
  name: faker.company.name(),
  morada: faker.location.streetAddress(),
  nif: faker.string.numeric(9),
  email: faker.internet.email().toLowerCase(),
  valorHora: parseFloat(faker.finance.amount(30, 60)),
  status_email: 'pendente',
  link_gerado: null,
  status: 'ativo',
  totalHoras: 0,
  ...overrides,
});

export const createSchedule = (overrides = {}) => ({
  id: `s${Date.now()}${faker.string.numeric(4)}`,
  name: faker.helpers.arrayElement(['Manhã', 'Tarde', 'Noite', 'Horário Flexible']),
  isAdvanced: false,
  dailyConfigs: {
    0: { isActive: false, hasBreak: false, startTime: '', breakStart: '', breakEnd: '', endTime: '' },
    1: { isActive: true, hasBreak: false, startTime: '08:00', breakStart: '', breakEnd: '', endTime: '17:00' },
    2: { isActive: true, hasBreak: false, startTime: '08:00', breakStart: '', breakEnd: '', endTime: '17:00' },
    3: { isActive: true, hasBreak: false, startTime: '08:00', breakStart: '', breakEnd: '', endTime: '17:00' },
    4: { isActive: true, hasBreak: false, startTime: '08:00', breakStart: '', breakEnd: '', endTime: '17:00' },
    5: { isActive: true, hasBreak: false, startTime: '08:00', breakStart: '', breakEnd: '', endTime: '17:00' },
    6: { isActive: false, hasBreak: false, startTime: '', breakStart: '', breakEnd: '', endTime: '' },
  },
  weekdays: [1, 2, 3, 4, 5],
  assignedWorkers: [],
  startTime: '08:00',
  endTime: '17:00',
  breakStart: '',
  breakEnd: '',
  hasBreak: false,
  ...overrides,
});

export const createLog = (workerId, clientId, overrides = {}) => {
  const date = faker.date.recent({ days: 30 });
  const startHour = faker.number.int({ min: 6, max: 10 });
  const endHour = startHour + faker.number.int({ min: 6, max: 10 });
  return {
    id: `log_${Date.now()}${faker.string.numeric(4)}`,
    workerId,
    clientId,
    date: date.toISOString().split('T')[0],
    startTime: `${String(startHour).padStart(2, '0')}:00`,
    endTime: `${String(endHour).padStart(2, '0')}:00`,
    breakStart: '12:00',
    breakEnd: '13:00',
    hours: endHour - startHour - 1,
    ...overrides,
  };
};

export const createNotification = (overrides = {}) => ({
  id: `notif_${Date.now()}`,
  title: `Pedido de Correção: ${faker.company.name()}`,
  message: `⚠️ PEDIDO DE CORREÇÃO: EMPRESA TESTE\n📅 Período: maio de 2026\n\n👥 DETALHES POR COLABORADOR:\n\n👤 TRABALHADOR TESTE [ID:w123]\n   Total: 40h ➔ 42h (2.00h)\n   Alterações:\n   • 2026-05-01:\n     - Turno: 08:00-17:00 ➔ 08:00-18:00\n     - Pausa: 12:00-13:00 ➔ 12:00-13:00\n     - Horas: 8h ➔ 9h\n\n💬 JUSTIFICAÇÃO:\n\"${faker.lorem.sentence()}\"`,
  status: 'pending',
  target_type: 'admin',
  target_client_id: null,
  is_active: true,
  created_at: new Date().toISOString(),
  payload: {
    reportType: 'precision',
    changes: [],
    isFullMonth: false,
  },
  ...overrides,
});

export const createCorrecao = (overrides = {}) => ({
  id: `correcao_${Date.now()}`,
  title: `Divergência Reportada: ${faker.company.name()}`,
  status: 'pending',
  client_id: null,
  month: '2026-05',
  message: '',
  payload: {
    changes: [],
    reportType: 'quick',
    isFullMonth: true,
  },
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createApproval = (workerId, clientId, overrides = {}) => ({
  id: `approval_${Date.now()}`,
  workerId,
  clientId,
  month: '2026-05',
  status: 'pending',
  totalHours: 160,
  approvedByAdmin: false,
  approvedByClient: false,
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createSystemSettings = (overrides = {}) => ({
  companyName: 'Magnetic Lda',
  companyLogo: '/Magnetic (3).png',
  adminPassword: 'admin123',
  currentMonth: new Date().toISOString().slice(0, 7),
  ...overrides,
});
