import { describe, it, expect } from 'vitest';
import {
  assinarTokenQr,
  verificarTokenQr,
  decodificarClientIdSemVerificar,
  transicoesValidas,
  construirPatchLog,
  getEffectiveClientId,
  horaAtualNoCliente,
} from '../../api/ponto/_pontoUtils.js';

// Testa só as funções puras de api/ponto/_pontoUtils.js — o handler
// api/ponto/index.js (I/O com Supabase) é verificado ponta-a-ponta contra a
// branch de teste do Supabase, não com mocks encadeados aqui (ver plano).

describe('assinarTokenQr / verificarTokenQr', () => {
  const secret = 'segredo-de-teste';

  it('assina e verifica um token válido', () => {
    const payload = { clientId: 'c1', iat: Date.now(), exp: Date.now() + 20000 };
    const token = assinarTokenQr(payload, secret);
    const verificado = verificarTokenQr(token, secret);
    expect(verificado).toEqual(payload);
  });

  it('rejeita token com assinatura adulterada', () => {
    const payload = { clientId: 'c1', iat: Date.now(), exp: Date.now() + 20000 };
    const token = assinarTokenQr(payload, secret);
    const [body] = token.split('.');
    const adulterado = `${body}.assinaturafalsa`;
    expect(verificarTokenQr(adulterado, secret)).toBeNull();
  });

  it('rejeita token expirado', () => {
    const payload = { clientId: 'c1', iat: Date.now() - 30000, exp: Date.now() - 10000 };
    const token = assinarTokenQr(payload, secret);
    expect(verificarTokenQr(token, secret)).toBeNull();
  });

  it('rejeita token assinado com secreto diferente', () => {
    const payload = { clientId: 'c1', iat: Date.now(), exp: Date.now() + 20000 };
    const token = assinarTokenQr(payload, secret);
    expect(verificarTokenQr(token, 'outro-segredo')).toBeNull();
  });

  it('rejeita entradas malformadas sem lançar', () => {
    expect(verificarTokenQr(null, secret)).toBeNull();
    expect(verificarTokenQr('sem-ponto', secret)).toBeNull();
    expect(verificarTokenQr('a.b.c', secret)).toBeNull();
    expect(verificarTokenQr('token-qualquer', null)).toBeNull();
  });
});

describe('decodificarClientIdSemVerificar', () => {
  it('extrai o clientId de um token válido sem verificar assinatura', () => {
    const token = assinarTokenQr({ clientId: 'c42', iat: 1, exp: 2 }, 'segredo');
    expect(decodificarClientIdSemVerificar(token)).toBe('c42');
  });

  it('devolve null para token malformado', () => {
    expect(decodificarClientIdSemVerificar('lixo')).toBeNull();
    expect(decodificarClientIdSemVerificar(null)).toBeNull();
  });
});

describe('transicoesValidas', () => {
  it('sem log de hoje → só entrada', () => {
    expect(transicoesValidas(null)).toEqual(['entrada']);
  });

  it('startTime preenchido, sem pausa nem saída → início de pausa ou saída', () => {
    const log = { startTime: '08:00', breakStart: null, breakEnd: null, endTime: null };
    expect(transicoesValidas(log)).toEqual(['inicio_pausa', 'saida']);
  });

  it('pausa iniciada mas não terminada → só fim de pausa', () => {
    const log = { startTime: '08:00', breakStart: '12:00', breakEnd: null, endTime: null };
    expect(transicoesValidas(log)).toEqual(['fim_pausa']);
  });

  it('pausa terminada, sem saída → só saída', () => {
    const log = { startTime: '08:00', breakStart: '12:00', breakEnd: '13:00', endTime: null };
    expect(transicoesValidas(log)).toEqual(['saida']);
  });

  it('log já com saída → nenhuma transição', () => {
    const log = { startTime: '08:00', breakStart: '12:00', breakEnd: '13:00', endTime: '17:00' };
    expect(transicoesValidas(log)).toEqual([]);
  });
});

describe('construirPatchLog', () => {
  it('entrada cria um insert novo com source qr', () => {
    const { action, patch } = construirPatchLog({
      tipo: 'entrada', logDeHoje: null, horaHHMM: '08:00', dateStr: '2026-09-09',
      workerId: 'w1', clientId: 'c1', geo: null,
    });
    expect(action).toBe('insert');
    expect(patch).toMatchObject({
      workerId: 'w1', clientId: 'c1', date: '2026-09-09',
      startTime: '08:00', endTime: null, breakStart: null, breakEnd: null,
      hours: 0, source: 'qr',
    });
    expect(patch.id).toMatch(/^l\d+$/);
  });

  it('início de pausa atualiza o log existente preservando os outros campos', () => {
    const logDeHoje = { id: 'l1', workerId: 'w1', clientId: 'c1', date: '2026-09-09', startTime: '08:00', breakStart: null, breakEnd: null, endTime: null, hours: 0, description: '' };
    const { action, patch } = construirPatchLog({
      tipo: 'inicio_pausa', logDeHoje, horaHHMM: '12:00', dateStr: '2026-09-09',
      workerId: 'w1', clientId: 'c1', geo: null,
    });
    expect(action).toBe('update');
    expect(patch.breakStart).toBe('12:00');
    expect(patch.startTime).toBe('08:00');
  });

  it('saída calcula hours com calculateDuration', () => {
    const logDeHoje = { id: 'l1', workerId: 'w1', clientId: 'c1', date: '2026-09-09', startTime: '08:00', breakStart: '12:00', breakEnd: '13:00', endTime: null, hours: 0, description: '' };
    const { patch } = construirPatchLog({
      tipo: 'saida', logDeHoje, horaHHMM: '17:00', dateStr: '2026-09-09',
      workerId: 'w1', clientId: 'c1', geo: null,
    });
    expect(patch.endTime).toBe('17:00');
    expect(patch.hours).toBe(8); // 08:00-17:00 (9h) - 1h de pausa = 8h
  });

  it('regista colunas de geo quando fornecidas', () => {
    const { patch } = construirPatchLog({
      tipo: 'entrada', logDeHoje: null, horaHHMM: '08:00', dateStr: '2026-09-09',
      workerId: 'w1', clientId: 'c1', geo: { lat: 41.1, lng: -8.6, verified: true },
    });
    expect(patch.check_in_lat).toBe(41.1);
    expect(patch.check_in_lng).toBe(-8.6);
    expect(patch.geo_verified).toBe(true);
  });
});

describe('getEffectiveClientId', () => {
  it('sem assignedClientDates cai no defaultClientId', () => {
    const worker = { defaultClientId: 'c-default', assignedClientDates: null };
    expect(getEffectiveClientId(worker, '2026-09-09')).toBe('c-default');
  });

  it('uma janela ativa hoje devolve o cliente dessa janela', () => {
    const worker = {
      defaultClientId: 'c-default',
      assignedClientDates: { 'c-especial': { dataInicio: '2026-09-01', dataFim: '2026-09-30' } },
    };
    expect(getEffectiveClientId(worker, '2026-09-09')).toBe('c-especial');
  });

  it('janela fora do intervalo cai no defaultClientId', () => {
    const worker = {
      defaultClientId: 'c-default',
      assignedClientDates: { 'c-especial': { dataInicio: '2026-01-01', dataFim: '2026-01-31' } },
    };
    expect(getEffectiveClientId(worker, '2026-09-09')).toBe('c-default');
  });
});

describe('horaAtualNoCliente', () => {
  it('devolve data no formato YYYY-MM-DD e hora HH:MM', () => {
    const { data, hora } = horaAtualNoCliente({ timezone: 'Europe/Lisbon' });
    expect(data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hora).toMatch(/^\d{2}:\d{2}$/);
  });

  it('usa Europe/Lisbon como fallback quando o cliente não tem timezone', () => {
    const semTz = horaAtualNoCliente({});
    const comTz = horaAtualNoCliente({ timezone: 'Europe/Lisbon' });
    expect(semTz.data).toBe(comTz.data);
  });
});
