import crypto from 'node:crypto';
import { calculateDuration } from '../../src/utils/formatUtils.js';

// Assinatura/verificação do token do QR — mesmo espírito de
// api/_authUtils.js (HMAC-SHA256 nativo, formato <payload base64url>.<hmac
// base64url>), mas com um secreto POR CLIENTE (clients.qr_secret_key) em vez
// do SESSION_SECRET global, porque cada kiosk precisa de poder ser revogado
// isoladamente (regenerar o secreto de um cliente invalida só os QRs desse
// cliente).

const ALGORITMO = 'sha256';

function assinar(body, secret) {
  return crypto.createHmac(ALGORITMO, secret).update(body).digest('base64url');
}

export function assinarTokenQr(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${assinar(body, secret)}`;
}

// Extrai o payload sem validar a assinatura — usado só para descobrir o
// clientId antes de sabermos qual secreto usar para verificar a assinatura.
// NUNCA usar o resultado sem passar depois por verificarTokenQr.
export function decodificarClientIdSemVerificar(token) {
  if (!token || typeof token !== 'string') return null;
  const [body] = token.split('.');
  if (!body) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload?.clientId || null;
  } catch {
    return null;
  }
}

// Devolve o payload se o token for válido (assinatura correta, não
// expirado) ou null — nunca lança.
export function verificarTokenQr(token, secret) {
  if (!token || typeof token !== 'string' || !secret) return null;
  const partes = token.split('.');
  if (partes.length !== 2) return null;
  const [body, hmac] = partes;
  if (!body || !hmac) return null;

  const esperado = assinar(body, secret);
  const a = Buffer.from(hmac);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (!payload.exp || Date.now() > payload.exp) return null;

  return payload;
}

// Transições válidas a partir do estado do log de hoje deste
// trabalhador+cliente. A sequência entrada→início pausa→fim pausa→saída
// mapeia diretamente para startTime/breakStart/breakEnd/endTime — não há
// coluna `tipo` nova em `logs`, o estado É a máquina de estados.
export function transicoesValidas(logDeHoje) {
  if (!logDeHoje || !logDeHoje.startTime) return ['entrada'];
  if (logDeHoje.endTime) return [];
  if (logDeHoje.breakStart && !logDeHoje.breakEnd) return ['fim_pausa'];
  if (logDeHoje.breakEnd) return ['saida'];
  return ['inicio_pausa', 'saida'];
}

// Monta o insert/update a aplicar em `logs` para o tipo de picagem escolhido.
// horaHHMM é sempre calculada no servidor (nunca confiar no dispositivo).
// `source` identifica a origem da picagem ('qr' kiosk, 'nfc' terminal) —
// default 'qr' preserva o comportamento do fluxo QR existente.
export function construirPatchLog({ tipo, logDeHoje, horaHHMM, dateStr, workerId, clientId, geo, source = 'qr' }) {
  const geoCols = (prefix) => ({
    [`${prefix}_lat`]: geo?.lat ?? null,
    [`${prefix}_lng`]: geo?.lng ?? null,
  });

  if (tipo === 'entrada') {
    return {
      action: 'insert',
      patch: {
        id: `l${Date.now()}`,
        workerId,
        clientId,
        date: dateStr,
        startTime: horaHHMM,
        endTime: null,
        breakStart: null,
        breakEnd: null,
        hours: 0,
        description: '',
        source,
        geo_verified: geo?.verified ?? null,
        ...geoCols('check_in'),
      },
    };
  }

  if (tipo === 'inicio_pausa') {
    return {
      action: 'update',
      patch: { ...logDeHoje, breakStart: horaHHMM, source, ...geoCols('break_start') },
    };
  }

  if (tipo === 'fim_pausa') {
    return {
      action: 'update',
      patch: { ...logDeHoje, breakEnd: horaHHMM, source, ...geoCols('break_end') },
    };
  }

  if (tipo === 'saida') {
    const hours = calculateDuration(
      logDeHoje.startTime,
      horaHHMM,
      logDeHoje.breakStart,
      logDeHoje.breakEnd,
    );
    return {
      action: 'update',
      patch: { ...logDeHoje, endTime: horaHHMM, hours, source, ...geoCols('check_out') },
    };
  }

  return null;
}

// Réplica de getEffectiveClientId de
// src/features/worker/contexts/WorkerContext.jsx:46-56 — cliente ativo por
// assignedClientDates numa data, com fallback a defaultClientId. Duplicada
// aqui (6 linhas) em vez de importada porque WorkerContext.jsx não a exporta
// isoladamente do componente React.
export function getEffectiveClientId(worker, dateStr) {
  const dates = worker?.assignedClientDates;
  if (dates) {
    const active = Object.entries(dates).filter(([, range]) =>
      range?.dataInicio && range.dataInicio <= dateStr && (!range.dataFim || range.dataFim >= dateStr)
    );
    if (active.length === 1) return active[0][0];
  }
  return worker?.defaultClientId || '';
}

// Data/hora "agora" no fuso horário do cliente (clients.timezone, default
// 'Europe/Madrid') — nunca a hora do dispositivo do trabalhador.
export function horaAtualNoCliente(client) {
  const tz = client?.timezone || 'Europe/Lisbon';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date()).map(p => [p.type, p.value])
  );
  // hour12:false pode devolver "24" à meia-noite em alguns runtimes ICU.
  const hora = parts.hour === '24' ? '00' : parts.hour;
  return {
    data: `${parts.year}-${parts.month}-${parts.day}`,
    hora: `${hora}:${parts.minute}`,
  };
}

// ---------------------------------------------------------------------------
// Terminal NFC (piloto) — cartão por trabalhador lido num dispositivo fixo.
// ---------------------------------------------------------------------------

// Serial NFC tal como o Web NFC o devolve ("04:a2:3f:...") → forma canónica
// guardada em cartoes_ponto.uid ("04A23F..."). null se não for hex válido.
export function normalizarUid(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const limpo = raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (limpo.length < 8 || limpo.length > 32) return null;
  return limpo;
}

export function hashSha256(valor) {
  return crypto.createHash('sha256').update(String(valor)).digest('hex');
}

// Código de ativação de uso único, introduzido à mão no terminal. 8
// caracteres de um alfabeto sem ambíguos (sem 0/O/1/I) → 32^8 ≈ 10^12
// combinações; com expiração de 10 min, força bruta não é viável.
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function gerarCodigoAtivacao() {
  const bytes = crypto.randomBytes(8);
  let c = '';
  for (let i = 0; i < 8; i++) c += ALFABETO_CODIGO[bytes[i] % ALFABETO_CODIGO.length];
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

// Normaliza o que o utilizador escreveu no terminal ("abcd efgh", "ABCD-EFGH").
export function normalizarCodigoAtivacao(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const limpo = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (limpo.length !== 8) return null;
  return `${limpo.slice(0, 4)}-${limpo.slice(4)}`;
}

export function gerarTokenTerminal() {
  return crypto.randomBytes(32).toString('hex');
}

// Janela anti-duplo-toque: o mesmo cartão passado de novo dentro de N
// segundos após uma picagem bem sucedida é ignorado (não regista 2x).
export const JANELA_REPETICAO_MS = 60 * 1000;
export function eRepeticao(ultimaPicagemOkEm, agoraMs = Date.now()) {
  if (!ultimaPicagemOkEm) return false;
  const t = new Date(ultimaPicagemOkEm).getTime();
  if (Number.isNaN(t)) return false;
  return agoraMs - t < JANELA_REPETICAO_MS;
}
