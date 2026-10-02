import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Base de dados em memória com o subconjunto do query builder do
// supabase-js que os handlers do terminal usam. Não é um mock de chamadas
// encadeadas: filtra/ordena/escreve de verdade sobre arrays, por isso os
// testes verificam o estado final das tabelas, não a ordem das chamadas.
let fake;
// Defaults das colunas tal como na migração (o fake não tem DDL).
const DEFAULTS = { ponto_terminais: { ativo: true }, cartoes_ponto: { ativo: true } };
function criarFakeDb(seed) {
  const db = JSON.parse(JSON.stringify(seed));
  let seq = 0;
  function from(tabela) {
    if (!db[tabela]) db[tabela] = [];
    let op = 'select';
    let payload = null;
    const filtros = [];
    let ordem = null;
    let limite = null;
    const b = {
      select() { return b; },
      insert(r) { op = 'insert'; payload = r; return b; },
      update(p) { op = 'update'; payload = p; return b; },
      delete() { op = 'delete'; return b; },
      eq(k, v) { filtros.push((r) => r[k] === v); return b; },
      in(k, vs) { filtros.push((r) => vs.includes(r[k])); return b; },
      order(k, opts) { ordem = { k, asc: opts?.ascending !== false }; return b; },
      limit(n) { limite = n; return b; },
      run() {
        if (op === 'insert') {
          const linhas = (Array.isArray(payload) ? payload : [payload]).map((r) => ({
            id: `id${++seq}`,
            criado_em: new Date(Date.now() + seq).toISOString(),
            ...DEFAULTS[tabela],
            ...r,
          }));
          db[tabela].push(...linhas);
          return linhas;
        }
        let linhas = db[tabela].filter((r) => filtros.every((f) => f(r)));
        if (op === 'update') { linhas.forEach((r) => Object.assign(r, payload)); return linhas; }
        if (op === 'delete') { db[tabela] = db[tabela].filter((r) => !linhas.includes(r)); return linhas; }
        if (ordem) linhas = [...linhas].sort((x, y) => (x[ordem.k] < y[ordem.k] ? -1 : 1) * (ordem.asc ? 1 : -1));
        if (limite != null) linhas = linhas.slice(0, limite);
        return linhas;
      },
      maybeSingle() { return Promise.resolve({ data: b.run()[0] ?? null, error: null }); },
      single() { return Promise.resolve({ data: b.run()[0] ?? null, error: null }); },
      then(ok, ko) { return Promise.resolve({ data: b.run(), error: null }).then(ok, ko); },
    };
    return b;
  }
  return { db, client: { from } };
}

const sendNotification = vi.fn(() => Promise.resolve());
vi.mock('@supabase/supabase-js', () => ({ createClient: () => fake.client }));
vi.mock('web-push', () => ({ default: { setVapidDetails: () => {}, sendNotification } }));

const { default: handler } = await import('../../../api/formacao/index.js');
const { assinarSessao } = await import('../../../api/_authUtils.js');

function makeRes() {
  return {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
}

async function chamar(action, { body = {}, method = 'POST', headers = {} } = {}) {
  const res = makeRes();
  await handler({ method, query: { action }, body, headers }, res);
  return res;
}

function adminHeaders() {
  return { authorization: `Bearer ${assinarSessao({ role: 'admin', id: 'a1', exp: Date.now() + 60_000 })}` };
}

async function criarTerminalAtivado() {
  const criado = await chamar('ponto-terminal-criar', { body: { clientId: 'c1', nome: 'Portão norte' }, headers: adminHeaders() });
  const ativado = await chamar('ponto-terminal-ativar', { body: { codigo: criado._body.codigo } });
  return { terminalId: criado._body.terminalId, codigo: criado._body.codigo, token: ativado._body.token };
}

const UID = '04:A2:3F:1B:C4:5D:80';
const UID_NORM = '04A23F1BC45D80';

beforeEach(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste-sessao';
  sendNotification.mockClear();
  fake = criarFakeDb({
    clients: [
      { id: 'c1', name: 'Grandes Mecanizados', timezone: 'Europe/Madrid', ponto_qr_ativo: true },
      { id: 'c2', name: 'Outro Cliente', timezone: 'Europe/Madrid' },
    ],
    workers: [
      { id: 'w1', name: 'Adriel dos Santos', defaultClientId: 'c1', assignedClientDates: null },
      { id: 'w2', name: 'Bruno Lima', defaultClientId: 'c2', assignedClientDates: null },
    ],
    cartoes_ponto: [],
    ponto_terminais: [],
    ponto_terminal_picagens: [],
    logs: [],
    push_subscriptions: [{ id: 'p1', role: 'worker', user_id: 'w1', endpoint: 'https://push', p256dh: 'k', auth: 'a' }],
  });
});

afterEach(() => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
});

describe('ativação do terminal', () => {
  it('troca o código por um token e só guarda o hash', async () => {
    const { token, codigo } = await criarTerminalAtivado();
    expect(token).toHaveLength(64);
    const t = fake.db.ponto_terminais[0];
    expect(t.token_hash).not.toBe(token);
    expect(t.codigo_hash).toBeNull();
    // código é de uso único
    const outra = await chamar('ponto-terminal-ativar', { body: { codigo } });
    expect(outra._status).toBe(404);
  });

  it('rejeita código expirado', async () => {
    const criado = await chamar('ponto-terminal-criar', { body: { clientId: 'c1', nome: 'T' }, headers: adminHeaders() });
    fake.db.ponto_terminais[0].codigo_expira_em = new Date(Date.now() - 1000).toISOString();
    const r = await chamar('ponto-terminal-ativar', { body: { codigo: criado._body.codigo } });
    expect(r._status).toBe(404);
  });

  it('criar terminal exige sessão admin', async () => {
    const r = await chamar('ponto-terminal-criar', { body: { clientId: 'c1', nome: 'T' } });
    expect(r._status).toBe(401);
  });

  it('gerar novo código revoga o dispositivo antigo', async () => {
    const { terminalId, token } = await criarTerminalAtivado();
    await chamar('ponto-terminal-codigo', { body: { terminalId }, headers: adminHeaders() });
    const r = await chamar('ponto-terminal-identificar', { body: { uid: UID }, headers: { 'x-terminal-token': token } });
    expect(r._status).toBe(401);
  });
});

describe('identificação do cartão', () => {
  it('sem token devolve 401', async () => {
    const r = await chamar('ponto-terminal-identificar', { body: { uid: UID } });
    expect(r._status).toBe(401);
  });

  it('terminal desativado devolve 401', async () => {
    const { terminalId, token } = await criarTerminalAtivado();
    await chamar('ponto-terminal-ativo', { body: { terminalId, ativo: false }, headers: adminHeaders() });
    const r = await chamar('ponto-terminal-identificar', { body: { uid: UID }, headers: { 'x-terminal-token': token } });
    expect(r._status).toBe(401);
  });

  it('cartão desconhecido devolve 404 e fica auditado', async () => {
    const { token } = await criarTerminalAtivado();
    const r = await chamar('ponto-terminal-identificar', { body: { uid: UID }, headers: { 'x-terminal-token': token } });
    expect(r._status).toBe(404);
    expect(fake.db.ponto_terminal_picagens.at(-1)).toMatchObject({ uid: UID_NORM, resultado: 'cartao_desconhecido' });
  });

  it('associação pendente: o próximo cartão desconhecido fica do trabalhador escolhido', async () => {
    const { terminalId, token } = await criarTerminalAtivado();
    await chamar('ponto-cartao-associar', { body: { terminalId, workerId: 'w1' }, headers: adminHeaders() });
    const r = await chamar('ponto-terminal-identificar', { body: { uid: UID }, headers: { 'x-terminal-token': token } });
    expect(r._body.resultado).toBe('associado');
    expect(fake.db.cartoes_ponto).toEqual([expect.objectContaining({ uid: UID_NORM, worker_id: 'w1' })]);
    expect(fake.db.ponto_terminais[0].associar_worker_id).toBeNull();
  });

  it('associação pendente expirada não associa', async () => {
    const { terminalId, token } = await criarTerminalAtivado();
    await chamar('ponto-cartao-associar', { body: { terminalId, workerId: 'w1' }, headers: adminHeaders() });
    fake.db.ponto_terminais[0].associar_expira_em = new Date(Date.now() - 1000).toISOString();
    const r = await chamar('ponto-terminal-identificar', { body: { uid: UID }, headers: { 'x-terminal-token': token } });
    expect(r._status).toBe(404);
    expect(fake.db.cartoes_ponto).toHaveLength(0);
  });

  it('cartão bloqueado devolve 403', async () => {
    const { token } = await criarTerminalAtivado();
    fake.db.cartoes_ponto.push({ uid: UID_NORM, worker_id: 'w1', ativo: false });
    const r = await chamar('ponto-terminal-identificar', { body: { uid: UID }, headers: { 'x-terminal-token': token } });
    expect(r._status).toBe(403);
    expect(r._body.code).toBe('cartao_bloqueado');
  });

  it('trabalhador de outro cliente devolve 403 nao_afeto', async () => {
    const { token } = await criarTerminalAtivado();
    fake.db.cartoes_ponto.push({ uid: UID_NORM, worker_id: 'w2', ativo: true });
    const r = await chamar('ponto-terminal-identificar', { body: { uid: UID }, headers: { 'x-terminal-token': token } });
    expect(r._status).toBe(403);
    expect(r._body.code).toBe('nao_afeto');
  });

  it('cartão válido devolve nome e ações válidas', async () => {
    const { token } = await criarTerminalAtivado();
    fake.db.cartoes_ponto.push({ uid: UID_NORM, worker_id: 'w1', ativo: true });
    const r = await chamar('ponto-terminal-identificar', { body: { uid: UID }, headers: { 'x-terminal-token': token } });
    expect(r._status).toBe(200);
    expect(r._body).toMatchObject({ resultado: 'identificado', worker: { name: 'Adriel dos Santos' }, validas: ['entrada'] });
  });
});

describe('registo da picagem', () => {
  async function prepararCartao() {
    const t = await criarTerminalAtivado();
    fake.db.cartoes_ponto.push({ uid: UID_NORM, worker_id: 'w1', ativo: true });
    return { 'x-terminal-token': t.token };
  }

  it('regista a entrada em logs com source=nfc e envia push ao trabalhador', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    const headers = await prepararCartao();
    const r = await chamar('ponto-terminal-registar', { body: { uid: UID, tipo: 'entrada' }, headers });
    expect(r._status).toBe(200);
    expect(fake.db.logs).toEqual([expect.objectContaining({ workerId: 'w1', clientId: 'c1', source: 'nfc', endTime: null })]);
    expect(fake.db.ponto_terminal_picagens.at(-1)).toMatchObject({ resultado: 'ok', tipo: 'entrada', log_id: fake.db.logs[0].id });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sendNotification.mock.calls[0][1]).title).toMatch(/^Entrada registada às \d\d:\d\d$/);
  });

  it('o mesmo cartão dentro de 60 s é ignorado (não regista duas vezes)', async () => {
    const headers = await prepararCartao();
    await chamar('ponto-terminal-registar', { body: { uid: UID, tipo: 'entrada' }, headers });
    const r = await chamar('ponto-terminal-registar', { body: { uid: UID, tipo: 'saida' }, headers });
    expect(r._status).toBe(409);
    expect(r._body.code).toBe('repetido');
    expect(fake.db.logs[0].endTime).toBeNull();
  });

  it('rejeita transição inválida e não altera o log', async () => {
    const headers = await prepararCartao();
    await chamar('ponto-terminal-registar', { body: { uid: UID, tipo: 'entrada' }, headers });
    fake.db.ponto_terminal_picagens.forEach((p) => { p.criado_em = new Date(Date.now() - 5 * 60_000).toISOString(); });
    const r = await chamar('ponto-terminal-registar', { body: { uid: UID, tipo: 'fim_pausa' }, headers });
    expect(r._status).toBe(409);
    expect(r._body.code).toBe('transicao_invalida');
    expect(fake.db.logs[0].breakEnd).toBeNull();
  });

  it('fecha o dia com a saída depois da janela de repetição', async () => {
    const headers = await prepararCartao();
    await chamar('ponto-terminal-registar', { body: { uid: UID, tipo: 'entrada' }, headers });
    fake.db.ponto_terminal_picagens.forEach((p) => { p.criado_em = new Date(Date.now() - 5 * 60_000).toISOString(); });
    const r = await chamar('ponto-terminal-registar', { body: { uid: UID, tipo: 'saida' }, headers });
    expect(r._status).toBe(200);
    expect(fake.db.logs).toHaveLength(1);
    expect(fake.db.logs[0].endTime).not.toBeNull();
  });

  it('tipo desconhecido devolve 400', async () => {
    const headers = await prepararCartao();
    const r = await chamar('ponto-terminal-registar', { body: { uid: UID, tipo: 'almoco' }, headers });
    expect(r._status).toBe(400);
  });
});

describe('listagem no admin', () => {
  it('nunca devolve hashes de token nem de código', async () => {
    await criarTerminalAtivado();
    const r = await chamar('ponto-terminais-listar', { method: 'GET', headers: adminHeaders() });
    expect(r._status).toBe(200);
    expect(r._body.terminais[0]).not.toHaveProperty('token_hash');
    expect(r._body.terminais[0]).not.toHaveProperty('codigo_hash');
    expect(r._body.terminais[0].ativado).toBe(true);
  });
});
