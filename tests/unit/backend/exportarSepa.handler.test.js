import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import handler from '../../../api/salarios/exportar-sepa.js';

function makeRes() {
  const res = {
    _status: null,
    _body: null,
    _headers: {},
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    send(body) { this._body = body; return this; },
    setHeader(k, v) { this._headers[k] = v; },
  };
  return res;
}

const TRABALHADOR_VALIDO = {
  nome: 'João Silva',
  iban: 'PT50000201231234567890154',
  salario: 1200,
  mes: '05',
  ano: '2026',
};

beforeEach(() => {
  process.env.MINHA_CONTA_IBAN = 'PT50000201231234567890154';
  process.env.MINHA_CONTA_BIC = 'NOVAPTPL';
});

afterEach(() => {
  delete process.env.MINHA_CONTA_IBAN;
  delete process.env.MINHA_CONTA_BIC;
});

describe('POST /api/salarios/exportar-sepa', () => {
  it('retorna 405 para GET', async () => {
    const req = { method: 'GET', body: {} };
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('retorna 400 quando trabalhadores está vazio', async () => {
    const req = { method: 'POST', body: { trabalhadores: [] } };
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/obrigatório/i);
  });

  it('retorna 400 quando trabalhadores não é array', async () => {
    const req = { method: 'POST', body: { trabalhadores: 'invalido' } };
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('retorna 400 quando registo está incompleto (falta iban)', async () => {
    const req = {
      method: 'POST',
      body: { trabalhadores: [{ nome: 'A', salario: 100, mes: '01', ano: '2026' }] },
    };
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/incompleto/i);
  });

  it('retorna 200 com XML e headers corretos para payload válido', async () => {
    const req = { method: 'POST', body: { trabalhadores: [TRABALHADOR_VALIDO] } };
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toContain('application/xml');
    expect(res._headers['Content-Disposition']).toContain('salarios_magnetic_place.xml');
    expect(res._body).toContain('pain.001.001.03');
  });

  it('retorna filename de transferências imediatas quando instant=true', async () => {
    const req = { method: 'POST', body: { trabalhadores: [TRABALHADOR_VALIDO], instant: true } };
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._headers['Content-Disposition']).toContain('transferencias_imediatas');
    expect(res._body).toContain('<Cd>INST</Cd>');
  });

  it('retorna 500 quando variáveis de ambiente IBAN/BIC estão ausentes', async () => {
    delete process.env.MINHA_CONTA_IBAN;
    const req = { method: 'POST', body: { trabalhadores: [TRABALHADOR_VALIDO] } };
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(500);
    expect(res._body.error).toMatch(/IBAN/i);
  });
});
