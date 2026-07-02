import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tocFetch } from '../../../api/toconline/_fetch.js';

function resp({ ok = false, status = 200, body = '', json = null, retryAfter = null }) {
  return {
    ok,
    status,
    headers: { get: (h) => (h.toLowerCase() === 'retry-after' ? retryAfter : null) },
    text: async () => body,
    json: async () => (json ?? {}),
  };
}

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('tocFetch', () => {
  it('devolve o JSON no caminho feliz sem repetir', async () => {
    global.fetch.mockResolvedValueOnce(resp({ ok: true, status: 200, json: { data: { id: '1' } } }));
    const r = await tocFetch('/x', 'tok');
    expect(r).toEqual({ data: { id: '1' } });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('repete em 429 e sucede na tentativa seguinte', async () => {
    vi.useFakeTimers();
    global.fetch
      .mockResolvedValueOnce(resp({ status: 429, body: 'rate limited' }))
      .mockResolvedValueOnce(resp({ ok: true, status: 200, json: { data: { id: '2' } } }));

    const p = tocFetch('/x', 'tok');
    await vi.runAllTimersAsync();
    const r = await p;

    expect(r).toEqual({ data: { id: '2' } });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('repete em 5xx até esgotar e lança erro estruturado', async () => {
    vi.useFakeTimers();
    global.fetch.mockResolvedValue(resp({ status: 503, body: 'unavailable' }));

    const p = tocFetch('/x', 'tok');
    const assertion = expect(p).rejects.toMatchObject({ status: 503 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('não repete em 4xx definitivo e expõe status + tocErrors', async () => {
    global.fetch.mockResolvedValueOnce(
      resp({ status: 422, body: JSON.stringify({ errors: [{ detail: 'inválido' }] }) })
    );

    let capturado;
    try {
      await tocFetch('/x', 'tok', 'POST', { data: {} });
    } catch (e) {
      capturado = e;
    }
    expect(fetch).toHaveBeenCalledOnce();
    expect(capturado.status).toBe(422);
    expect(capturado.tocErrors).toEqual([{ detail: 'inválido' }]);
  });
});
