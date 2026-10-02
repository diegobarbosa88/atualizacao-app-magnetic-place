import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('qrcode', () => ({ default: { toDataURL: () => Promise.resolve('data:image/png;base64,AA==') } }));

const { default: TerminalPontoView } = await import('../../src/features/public/TerminalPontoView.jsx');

// localStorage real (o setup global devolve sempre null).
function instalarStorage(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  global.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
  return m;
}

// Leitor Web NFC falso: guarda o handler para o teste "aproximar" cartões.
let leitor;
function instalarNfc() {
  leitor = null;
  window.NDEFReader = class {
    constructor() { leitor = this; }
    scan() { return Promise.resolve(); }
  };
}

function respostas(map) {
  global.fetch = vi.fn(async (url, opts) => {
    const acao = String(url).replace('/api/ponto/', '').split('?')[0];
    const r = typeof map[acao] === 'function' ? map[acao](opts) : map[acao];
    if (!r) return { ok: false, status: 404, json: async () => ({ error: 'sem mock' }) };
    return { ok: r.status ? r.status < 400 : true, status: r.status || 200, json: async () => r.body };
  });
}

const ESTADO = { body: { terminal: { id: 't1', nome: 'Portão norte' }, client: { id: 'c1', name: 'Grandes Mecanizados', pontoQrAtivo: false }, associacao: null } };

beforeEach(() => {
  instalarNfc();
});

afterEach(() => {
  delete window.NDEFReader;
});

describe('TerminalPontoView', () => {
  // Nota: o setup global (tests/setup.js) substitui `window` por um objeto
  // simples, e com isso o onChange de inputs controlados não dispara em
  // jsdom (mesma causa das falhas pré-existentes de FaturarClienteModal).
  // Por isso a ativação é testada pelo ecrã + validação, e a troca código→
  // token fica coberta em tests/unit/backend/pontoTerminal.handler.test.js.
  it('sem token mostra o ecrã de ativação', () => {
    instalarStorage();
    respostas({});
    render(<TerminalPontoView />);
    expect(screen.getByText('Ativar terminal de ponto')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ABCD-EFGH')).toBeInTheDocument();
  });

  it('valida o tamanho do código antes de enviar', async () => {
    instalarStorage();
    respostas({});
    render(<TerminalPontoView />);
    fireEvent.click(screen.getByRole('button', { name: 'Ativar' }));
    expect(await screen.findByText('O código tem 8 caracteres.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sem Web NFC avisa que o dispositivo não suporta', async () => {
    instalarStorage({ ponto_terminal_token: 'x'.repeat(64) });
    delete window.NDEFReader;
    respostas({ 'terminal-estado': ESTADO });
    render(<TerminalPontoView />);
    expect(await screen.findByText('NFC indisponível')).toBeInTheDocument();
  });

  it('cartão com uma só ação válida confirma sozinho e mostra sucesso', async () => {
    instalarStorage({ ponto_terminal_token: 'x'.repeat(64) });
    respostas({
      'terminal-estado': ESTADO,
      'terminal-identificar': { body: { resultado: 'identificado', worker: { name: 'Adriel dos Santos' }, validas: ['entrada'], hora: '07:58', hoje: null } },
      'terminal-registar': { body: { ok: true, tipo: 'entrada', hora: '07:58', worker: { name: 'Adriel dos Santos' } } },
    });
    render(<TerminalPontoView />);
    await screen.findByText('Aproxima o cartão');

    await act(async () => { leitor.onreading({ serialNumber: '04:a2:3f:1b:c4:5d:80' }); });
    expect(await screen.findByText('Adriel dos Santos')).toBeInTheDocument();
    expect(screen.getByText(/Confirma automaticamente em 3s/)).toBeInTheDocument();

    expect(await screen.findByText(/registada/, {}, { timeout: 5000 })).toHaveTextContent('Entrada registada');

    const registar = global.fetch.mock.calls.find(([u]) => u.endsWith('terminal-registar'));
    expect(JSON.parse(registar[1].body)).toEqual({ uid: '04:a2:3f:1b:c4:5d:80', tipo: 'entrada' });
    expect(registar[1].headers['x-terminal-token']).toBe('x'.repeat(64));
  });

  it('com escolha entre pausa e saída não confirma sozinho', async () => {
    instalarStorage({ ponto_terminal_token: 'x'.repeat(64) });
    respostas({
      'terminal-estado': ESTADO,
      'terminal-identificar': { body: { resultado: 'identificado', worker: { name: 'Adriel dos Santos' }, validas: ['inicio_pausa', 'saida'], hora: '12:30', hoje: { startTime: '07:58' } } },
    });
    render(<TerminalPontoView />);
    await screen.findByText('Aproxima o cartão');
    await act(async () => { leitor.onreading({ serialNumber: '04A23F1BC45D80' }); });
    await screen.findByText('Início de pausa');
    await act(async () => { await new Promise((r) => setTimeout(r, 3500)); });
    expect(global.fetch.mock.calls.some(([u]) => u.endsWith('terminal-registar'))).toBe(false);
    expect(screen.queryByText(/Confirma automaticamente/)).toBeNull();
  });

  it('erro da API aparece no ecrã (ex.: cartão desconhecido)', async () => {
    instalarStorage({ ponto_terminal_token: 'x'.repeat(64) });
    respostas({
      'terminal-estado': ESTADO,
      'terminal-identificar': { status: 404, body: { error: 'Cartão não reconhecido. Fala com o responsável.', code: 'cartao_desconhecido' } },
    });
    render(<TerminalPontoView />);
    await screen.findByText('Aproxima o cartão');
    await act(async () => { leitor.onreading({ serialNumber: '04A23F1BC45D80' }); });
    expect(await screen.findByText('Cartão não reconhecido. Fala com o responsável.')).toBeInTheDocument();
  });

  it('token revogado (401) volta ao ecrã de ativação', async () => {
    const storage = instalarStorage({ ponto_terminal_token: 'x'.repeat(64) });
    respostas({ 'terminal-estado': { status: 401, body: { error: 'revogado', code: 'terminal_revogado' } } });
    render(<TerminalPontoView />);
    expect(await screen.findByText('Ativar terminal de ponto')).toBeInTheDocument();
    expect(storage.has('ponto_terminal_token')).toBe(false);
  });
});
