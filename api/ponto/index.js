import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_authUtils.js';
import { isWithinGeofence } from '../../src/utils/geoUtils.js';
import {
  assinarTokenQr,
  verificarTokenQr,
  decodificarClientIdSemVerificar,
  transicoesValidas,
  construirPatchLog,
  getEffectiveClientId,
  horaAtualNoCliente,
} from './_pontoUtils.js';

// Registo de ponto via QR dinâmico (kiosk). Duas actions:
//  - `token`   (GET, PÚBLICA — o kiosk não tem sessão): emite o token do QR.
//  - `registar` (POST, exige sessão de worker): valida o QR lido e grava em
//    `logs`. Por isso o auth NÃO corre uniformemente antes do dispatch,
//    ao contrário do padrão de api/seguranca-social/index.js.

const TTL_SEGUNDOS = Number(process.env.PONTO_QR_TOKEN_TTL_SECONDS) || 20;
const GEO_ENABLED = process.env.PONTO_QR_GEO_ENABLED === 'true';

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  const action = req.method === 'GET' ? req.query?.action : req.body?.action;

  if (action === 'token') return handleToken(req, res);

  const sessao = requireAuth(req, res, ['worker']);
  if (!sessao) return;

  if (action === 'registar') return handleRegistar(req, res, sessao);

  return res.status(400).json({ error: 'action desconhecida.' });
}

async function handleToken(req, res) {
  const clientId = req.query?.clientId;
  if (!clientId) return res.status(400).json({ error: 'clientId em falta.' });

  const supabase = supabaseAdmin();
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name, qr_secret_key')
    .eq('id', clientId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!client || !client.qr_secret_key) {
    return res.status(404).json({ error: 'Kiosk não configurado para este cliente.' });
  }

  const iat = Date.now();
  const payload = { clientId: client.id, iat, exp: iat + TTL_SEGUNDOS * 1000 };
  const token = assinarTokenQr(payload, client.qr_secret_key);

  return res.status(200).json({ token, ttlSeconds: TTL_SEGUNDOS, clientName: client.name });
}

async function handleRegistar(req, res, sessao) {
  const { token, tipo, lat, lng } = req.body || {};
  if (!token || !tipo) return res.status(400).json({ error: 'token/tipo em falta.' });

  const clientId = decodificarClientIdSemVerificar(token);
  if (!clientId) return res.status(400).json({ error: 'QR inválido.' });

  const supabase = supabaseAdmin();

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, timezone, lat, lng, geo_radius_m, qr_secret_key')
    .eq('id', clientId)
    .maybeSingle();
  if (clientErr) return res.status(500).json({ error: clientErr.message });
  if (!client || !client.qr_secret_key) {
    return res.status(404).json({ error: 'Kiosk não configurado para este cliente.' });
  }

  const payload = verificarTokenQr(token, client.qr_secret_key);
  if (!payload) {
    return res.status(400).json({ error: 'QR expirado — aponta a câmara outra vez.' });
  }

  const { data: worker, error: workerErr } = await supabase
    .from('workers')
    .select('id, defaultClientId, assignedClientDates')
    .eq('id', sessao.id)
    .maybeSingle();
  if (workerErr) return res.status(500).json({ error: workerErr.message });
  if (!worker) return res.status(404).json({ error: 'Trabalhador não encontrado.' });

  const hojeInfo = horaAtualNoCliente(client);
  const dateStr = hojeInfo.data;
  const horaHHMM = hojeInfo.hora;

  const clienteEfetivo = getEffectiveClientId(worker, dateStr);
  if (clienteEfetivo !== client.id) {
    return res.status(403).json({ error: 'Não estás afeto a este cliente hoje.' });
  }

  const { data: logDeHoje, error: logErr } = await supabase
    .from('logs')
    .select('*')
    .eq('workerId', worker.id)
    .eq('clientId', client.id)
    .eq('date', dateStr)
    .maybeSingle();
  if (logErr) return res.status(500).json({ error: logErr.message });

  const validas = transicoesValidas(logDeHoje);
  if (!validas.includes(tipo)) {
    return res.status(409).json({
      error: validas.length
        ? `Ação inválida — próximo passo esperado: ${validas.join(' ou ')}.`
        : 'Já concluíste o registo de hoje neste cliente.',
    });
  }

  let geo = null;
  if (GEO_ENABLED && typeof lat === 'number' && typeof lng === 'number') {
    const dentro = isWithinGeofence(lat, lng, client.lat, client.lng, client.geo_radius_m ?? 200);
    geo = { lat, lng, verified: dentro };
  }

  const { action, patch } = construirPatchLog({
    tipo,
    logDeHoje,
    horaHHMM,
    dateStr,
    workerId: worker.id,
    clientId: client.id,
    geo,
  });

  // Regista o nonce PRIMEIRO — se falhar por violação de unicidade (replay),
  // não chegamos a escrever em `logs`, evitando ter de reverter nada.
  const { error: usoErr } = await supabase.from('qr_ponto_usos').insert({
    client_id: client.id,
    worker_id: worker.id,
    seq: payload.iat,
    tipo,
    log_id: action === 'insert' ? patch.id : logDeHoje.id,
  });
  if (usoErr) {
    if (usoErr.code === '23505') {
      return res.status(409).json({ error: 'Este QR já foi usado.' });
    }
    return res.status(500).json({ error: usoErr.message });
  }

  const logQuery = action === 'insert'
    ? supabase.from('logs').insert(patch)
    : supabase.from('logs').update(patch).eq('id', patch.id);
  const { error: patchErr } = await logQuery;
  if (patchErr) return res.status(500).json({ error: patchErr.message });

  return res.status(200).json({
    ok: true,
    tipo,
    hora: horaHHMM,
    data: dateStr,
    logId: action === 'insert' ? patch.id : patch.id,
  });
}
