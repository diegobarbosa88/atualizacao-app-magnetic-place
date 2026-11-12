import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFakeSupabase } from './fakeSupabase.js';

const fake = { db: null };
vi.mock('@supabase/supabase-js', () => ({ createClient: () => fake.db }));

const { default: handler } = await import('../../../api/formacao/index.js');
const { assinarSessao } = await import('../../../api/_authUtils.js');
const { generatePlan } = await import('../../../src/features/avaliacao-tecnica/data/plan.js');
const { getPhase1Items } = await import('../../../src/features/avaliacao-tecnica/data/phase1.js');
const { buildPhase2 } = await import('../../../src/features/avaliacao-tecnica/data/phase2.js');
const { buildPhase3 } = await import('../../../src/features/avaliacao-tecnica/data/phase3.js');

function makeRes() {
  return {
    _status: null,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
}

async function call(action, { method = 'GET', query = {}, body, admin = false } = {}) {
  const headers = { 'user-agent': 'vitest' };
  if (admin) headers.authorization = `Bearer ${assinarSessao({ role: 'admin', id: 'adm-1', exp: Date.now() + 60_000 })}`;
  const req = { method, query: { action: `avaliacao-${action}`, ...query }, body, headers };
  const res = makeRes();
  await handler(req, res);
  return res;
}

const CANDIDATO = {
  nome: 'João Carlos Pereira',
  telefone: '+351 912 345 678',
  email: 'joao@example.com',
  experiencia: '3 a 5 anos',
  localidade: 'Porto',
  rgpd: true,
};

function respostasCertas(seed, level) {
  const plan = generatePlan(seed);
  return {
    phase1: getPhase1Items(level).map((i) => ({ itemId: i.id, found: true, attemptsUsed: 1, wrongTaps: [], timeMs: 2000, timedOut: false })),
    phase2: buildPhase2(plan, level).map((q) => ({ questionId: q.id, rawInput: String(q.expected), timeMs: 5000, timedOut: false, skipped: false })),
    phase3: buildPhase3(plan, level).map((q) => ({ questionId: q.id, selectedOptionId: 'a', timeMs: 3000, timedOut: false })),
    integrity: { focusLosses: 0, exitAttempts: 0, abandoned: false },
  };
}

async function criar(nivel = 'pleno', extra = {}) {
  const res = await call('criar', { method: 'POST', admin: true, body: { nivel, candidato_nome: 'João Pereira', ...extra } });
  expect(res._status).toBe(200);
  return res._body.data;
}

beforeEach(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste';
  fake.db = createFakeSupabase();
});

describe('avaliações técnicas — admin', () => {
  it('endpoints de admin exigem sessão', async () => {
    expect((await call('listar'))._status).toBe(401);
    expect((await call('criar', { method: 'POST', body: { nivel: 'pleno' } }))._status).toBe(401);
  });

  it('cria um convite com token, variante e validade, sem expor a seed', async () => {
    const a = await criar('especialista', { validade_dias: 3 });
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(a.nivel).toBe('especialista');
    expect(a.plan_variant).toMatch(/^[2-9A-HJ-NP-Z]{5}$/);
    expect(a.estado).toBe('pending');
    expect(a.seed).toBeUndefined();
    const dias = (new Date(a.expires_at) - Date.now()) / 86400000;
    expect(dias).toBeGreaterThan(2.9);
    expect(dias).toBeLessThan(3.1);
  });

  it('recusa nível inválido', async () => {
    const res = await call('criar', { method: 'POST', admin: true, body: { nivel: 'mestre' } });
    expect(res._status).toBe(400);
  });
});

describe('avaliações técnicas — fluxo do candidato', () => {
  it('link → dados → prova → resultado corrigido no servidor', async () => {
    const a = await criar('pleno');

    const pub = await call('publica', { query: { token: a.token } });
    expect(pub._status).toBe(200);
    expect(pub._body).toEqual({ estado: 'pending', nivel: 'pleno', candidato: { nome: 'João Pereira', telefone: '' } });

    const ini = await call('iniciar', { method: 'POST', body: { token: a.token, candidato: CANDIDATO } });
    expect(ini._status).toBe(200);
    const row = fake.db.tables.avaliacoes_tecnicas[0];
    expect(ini._body.seed).toBe(row.seed);
    expect(row.status).toBe('in_progress');
    expect(row.candidato_email).toBe('joao@example.com');
    expect(row.rgpd_consentido_em).toBeTruthy();

    // segundo início (outro separador, duplo clique) é recusado
    const ini2 = await call('iniciar', { method: 'POST', body: { token: a.token, candidato: CANDIDATO } });
    expect(ini2._status).toBe(409);
    expect(ini2._body.estado).toBe('in_progress');

    // o navegador tenta "ajudar": manda correct:true em tudo e uma nota inventada
    const respostas = respostasCertas(row.seed, 'pleno');
    respostas.phase2[0] = { ...respostas.phase2[0], rawInput: '1', correct: true };
    const sub = await call('submeter', { method: 'POST', body: { token: a.token, sessionId: 'abc', respostas, overall_score: 100 } });
    expect(sub._status).toBe(200);
    expect(row.status).toBe('completed');
    expect(row.score_calculo).toBe(83); // 5 de 6 — a resposta errada foi recorrigida
    expect(row.overall_score).toBeLessThan(100);
    expect(row.resultado.plan_variant).toBe(row.plan_variant);
    expect(row.resultado.candidate_name).toBe('João Carlos Pereira');
    expect(fake.db.tables.app_notifications).toHaveLength(1);
    expect(fake.db.tables.app_notifications[0].target_type).toBe('admin');

    // reenvio depois de uma resposta perdida: não é erro nem duplica
    const sub2 = await call('submeter', { method: 'POST', body: { token: a.token, respostas } });
    expect(sub2._status).toBe(200);
    expect(sub2._body.jaEnviada).toBe(true);
    expect(fake.db.tables.app_notifications).toHaveLength(1);

    // link já usado
    expect((await call('publica', { query: { token: a.token } }))._body.estado).toBe('completed');

    // relatório no admin
    const obt = await call('obter', { query: { id: a.id }, admin: true });
    expect(obt._status).toBe(200);
    expect(obt._body.data.resultado.phase2).toHaveLength(6);
    expect(obt._body.data.seed).toBeUndefined();
  });

  it('não submete sem ter iniciado e valida os dados do candidato', async () => {
    const a = await criar();
    expect((await call('submeter', { method: 'POST', body: { token: a.token, respostas: {} } }))._status).toBe(409);
    const semRgpd = await call('iniciar', { method: 'POST', body: { token: a.token, candidato: { ...CANDIDATO, rgpd: false } } });
    expect(semRgpd._status).toBe(400);
    const semExp = await call('iniciar', { method: 'POST', body: { token: a.token, candidato: { ...CANDIDATO, experiencia: 'muita' } } });
    expect(semExp._status).toBe(400);
  });

  it('token inexistente ou malformado → inválido', async () => {
    expect((await call('publica', { query: { token: 'x' } }))._status).toBe(404);
    expect((await call('publica', { query: { token: 'A'.repeat(32) } }))._body.estado).toBe('invalid');
  });

  it('link expirado não inicia; reabrir renova a validade', async () => {
    const a = await criar();
    fake.db.tables.avaliacoes_tecnicas[0].expires_at = new Date(Date.now() - 1000).toISOString();
    expect((await call('publica', { query: { token: a.token } }))._body.estado).toBe('expired');
    const ini = await call('iniciar', { method: 'POST', body: { token: a.token, candidato: CANDIDATO } });
    expect(ini._status).toBe(409);
    expect(ini._body.estado).toBe('expired');

    const re = await call('reabrir', { method: 'POST', admin: true, body: { id: a.id } });
    expect(re._status).toBe(200);
    expect(re._body.data.estado).toBe('pending');
    expect((await call('iniciar', { method: 'POST', body: { token: a.token, candidato: CANDIDATO } }))._status).toBe(200);
  });

  it('prova interrompida: reabrir sorteia variante nova', async () => {
    const a = await criar();
    await call('iniciar', { method: 'POST', body: { token: a.token, candidato: CANDIDATO } });
    const row = fake.db.tables.avaliacoes_tecnicas[0];
    const seedAntes = row.seed;
    const re = await call('reabrir', { method: 'POST', admin: true, body: { id: a.id } });
    expect(re._status).toBe(200);
    expect(row.status).toBe('pending');
    expect(row.started_at).toBeNull();
    expect(row.reaberturas).toBe(1);
    expect(row.seed).not.toBe(seedAntes);
  });

  it('cancelar bloqueia o link; apagar remove os dados', async () => {
    const a = await criar();
    expect((await call('cancelar', { method: 'POST', admin: true, body: { id: a.id } }))._status).toBe(200);
    expect((await call('iniciar', { method: 'POST', body: { token: a.token, candidato: CANDIDATO } }))._body.estado).toBe('cancelled');
    expect((await call('apagar', { method: 'POST', admin: true, body: { id: a.id } }))._status).toBe(200);
    expect(fake.db.tables.avaliacoes_tecnicas).toHaveLength(0);
  });
});
