import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../../../api/parse-fatura.js';

function makeRes() {
  const res = {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
  return res;
}

const GEMINI_RESPONSE = {
  candidates: [{
    content: {
      parts: [{
        text: JSON.stringify({
          numero_fatura: 'FT 2026/001',
          data_fatura: '2026-05-01',
          valor_total: 1210.00,
          iva: 210.00,
          fornecedor: 'Fornecedor Lda',
          nif_fornecedor: '123456789',
        }),
      }],
    },
  }],
};

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = vi.fn();
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  vi.restoreAllMocks();
});

describe('POST /api/parse-fatura', () => {
  it('retorna 500 quando GEMINI_API_KEY não está definida', async () => {
    delete process.env.GEMINI_API_KEY;
    const req = { method: 'POST', body: { texto: 'fatura teste' } };
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(500);
    expect(res._body.error).toMatch(/GEMINI_API_KEY/i);
  });

  it('retorna 405 para métodos não permitidos (PUT)', async () => {
    const req = { method: 'PUT', body: {} };
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('retorna 400 quando texto está ausente no body', async () => {
    const req = { method: 'POST', body: {} };
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/texto/i);
  });

  it('chama Gemini API e retorna dados extraídos da fatura', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => GEMINI_RESPONSE,
    });

    const req = { method: 'POST', body: { texto: 'FT 2026/001 valor 1210.00 EUR' } };
    const res = makeRes();
    await handler(req, res);

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
    expect(res._status).toBe(200);
    expect(res._body).toMatchObject({
      numero_fatura: 'FT 2026/001',
      data_fatura: '2026-05-01',
      valor_total: 1210.00,
    });
  });

  it('retorna erro quando Gemini API responde com status não-ok', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'quota exceeded',
      json: async () => ({ error: { message: 'quota exceeded' } }),
    });

    const req = { method: 'POST', body: { texto: 'qualquer texto' } };
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBeGreaterThanOrEqual(400);
  });
});
