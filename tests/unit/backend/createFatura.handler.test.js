import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks dos módulos de que o handler depende.
vi.mock('../../../api/toconline/_token.js', () => ({
  getValidToken: vi.fn(),
}));
vi.mock('../../../api/toconline/_fetch.js', () => ({
  tocFetch: vi.fn(),
}));
const insertMock = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ insert: insertMock }) }),
}));

import handler from '../../../api/toconline/create-fatura.js';
import { getValidToken } from '../../../api/toconline/_token.js';
import { tocFetch } from '../../../api/toconline/_fetch.js';

function makeRes() {
  const res = {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
  return res;
}

const CLIENTE = { nome: 'Cliente Lda', nif: '123456789' };
const LINHAS = [{ descricao: 'Serviço', quantidade: 2, preco_unitario: 50, taxa_iva: 23 }];

function bodyValido(extra = {}) {
  return { cliente: CLIENTE, linhas: LINHAS, ...extra };
}

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  getValidToken.mockResolvedValue('tok-123');
  tocFetch.mockReset();
  insertMock.mockReset();
  insertMock.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('POST /api/toconline/create-fatura', () => {
  it('retorna 405 para métodos não permitidos', async () => {
    const res = makeRes();
    await handler({ method: 'GET', body: {} }, res);
    expect(res._status).toBe(405);
  });

  it('retorna 400 sem cliente ou sem linhas', async () => {
    const res1 = makeRes();
    await handler({ method: 'POST', body: { linhas: LINHAS } }, res1);
    expect(res1._status).toBe(400);

    const res2 = makeRes();
    await handler({ method: 'POST', body: { cliente: CLIENTE, linhas: [] } }, res2);
    expect(res2._status).toBe(400);
  });

  it('retorna 400 para tipo_documento inválido', async () => {
    const res = makeRes();
    await handler({ method: 'POST', body: bodyValido({ tipo_documento: 'XX' }) }, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/tipo_documento/i);
  });

  it('retorna 400 para NIF inválido', async () => {
    const res = makeRes();
    await handler({ method: 'POST', body: { cliente: { nome: 'X', nif: '12' }, linhas: LINHAS } }, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/NIF/i);
  });

  it('retorna 400 quando nenhuma linha tem quantidade e preço > 0', async () => {
    const res = makeRes();
    await handler({ method: 'POST', body: { cliente: CLIENTE, linhas: [{ descricao: 'X', quantidade: 0, preco_unitario: 0 }] } }, res);
    expect(res._status).toBe(400);
  });

  it('retorna 401 quando getValidToken falha', async () => {
    getValidToken.mockRejectedValueOnce(new Error('TOConline não está ligado.'));
    const res = makeRes();
    await handler({ method: 'POST', body: bodyValido() }, res);
    expect(res._status).toBe(401);
    expect(res._body.error).toMatch(/não está ligado/i);
  });

  it('retorna 422 usando errors[] estruturado do tocFetch', async () => {
    const err = new Error('TOConline API POST → 422');
    err.status = 422;
    err.tocErrors = [{ detail: 'NIF já registado' }, { title: 'Erro secundário' }];
    tocFetch.mockRejectedValueOnce(err);

    const res = makeRes();
    await handler({ method: 'POST', body: bodyValido() }, res);
    expect(res._status).toBe(422);
    expect(res._body.error).toBe('NIF já registado; Erro secundário');
  });

  it('retorna 201 e envia payload JSON:API correcto no caminho feliz', async () => {
    tocFetch.mockResolvedValueOnce({
      data: { id: '789', attributes: { document_number: 'FT 2026/7', date: '2026-07-02', total_amount: 123, total_tax_amount: 23 } },
    });

    const res = makeRes();
    await handler({ method: 'POST', body: bodyValido({ observacoes: 'Obrigado' }) }, res);

    expect(res._status).toBe(201);
    expect(res._body.doc_id).toBe('789');
    expect(res._body.warning).toBeUndefined();

    // payload enviado ao TOConline
    const [path, token, method, payload] = tocFetch.mock.calls[0];
    expect(path).toBe('/api/v1/commercial_sales_documents');
    expect(token).toBe('tok-123');
    expect(method).toBe('POST');
    expect(payload.data.type).toBe('commercial_sales_documents');
    expect(payload.data.attributes.document_type).toBe('FT');
    expect(payload.data.attributes.finalize).toBe(1);
    expect(payload.data.attributes.customer_business_name).toBe('Cliente Lda');
    expect(payload.data.attributes.customer_tax_number).toBe('123456789');
    expect(payload.data.attributes.notes).toBe('Obrigado');
    expect(payload.data.attributes.lines[0]).toMatchObject({
      item_type: 'Service', description: 'Serviço', quantity: 2, unit_price: 50, tax_percentage: 23,
    });

    // espelhou na tabela faturas
    expect(insertMock).toHaveBeenCalledOnce();
    expect(insertMock.mock.calls[0][0]).toMatchObject({ toconline_doc_id: '789', fonte: 'toc', tipo: 'cliente' });
  });

  it('usa customer_id quando o cliente tem id', async () => {
    tocFetch.mockResolvedValueOnce({ data: { id: '1', attributes: {} } });
    const res = makeRes();
    await handler({ method: 'POST', body: { cliente: { id: 42 }, linhas: LINHAS } }, res);
    const payload = tocFetch.mock.calls[0][3];
    expect(payload.data.attributes.customer_id).toBe(42);
    expect(payload.data.attributes.customer_business_name).toBeUndefined();
  });

  it('usa vat_tax_id quando fornecido em vez de tax_percentage', async () => {
    tocFetch.mockResolvedValueOnce({ data: { id: '1', attributes: {} } });
    const res = makeRes();
    await handler({ method: 'POST', body: { cliente: CLIENTE, linhas: [{ descricao: 'X', quantidade: 1, preco_unitario: 10, vat_tax_id: 55 }] } }, res);
    const linha = tocFetch.mock.calls[0][3].data.attributes.lines[0];
    expect(linha.vat_tax_id).toBe(55);
    expect(linha.tax_percentage).toBeUndefined();
  });

  it('retorna 201 com warning quando o espelho local falha', async () => {
    tocFetch.mockResolvedValueOnce({ data: { id: '99', attributes: {} } });
    insertMock.mockResolvedValueOnce({ error: { message: 'db em baixo' } });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = makeRes();
    await handler({ method: 'POST', body: bodyValido() }, res);

    expect(res._status).toBe(201);
    expect(res._body.doc_id).toBe('99');
    expect(res._body.warning).toMatch(/não foi registada localmente/i);
    expect(errSpy).toHaveBeenCalled();
  });
});
