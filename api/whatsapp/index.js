// Inbox de WhatsApp dentro do admin — mesmo número "Trabalhador Virtual"
// já usado pelo agente (repo conselheiro), mas para o Diego falar
// diretamente com trabalhadores individuais. Ver
// supabase/migrations/20260829_worker_whatsapp_messages.sql para o
// desenho completo (porque as mensagens recebidas chegam via um 3º ramo
// em conselheiro/api/whatsapp/webhook.js, não por este endpoint).
//
// Credenciais da Meta (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID)
// duplicadas aqui do projeto conselheiro, por decisão do Diego — mais
// simples do que partilhar entre os dois projetos, ao custo de rodar o
// token em dois sítios se algum dia expirar/mudar.

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_authUtils.js';

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Acesso de leitura à BD do conselheiro (projeto Supabase separado) só
// para mostrar o histórico de conversa do Trabalhador Virtual com o Diego
// (tabela whatsapp_conversas, que vive lá, não aqui).
function conselheiroSupabase() {
  const url = process.env.CONSELHEIRO_SUPABASE_URL;
  const key = process.env.CONSELHEIRO_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const GRAPH_API_VERSION = 'v25.0';

async function enviarGraphApi(to, body) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error('WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID não configurados neste projeto.');
  }
  const resposta = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados?.error?.message || `Falha ao enviar WhatsApp (HTTP ${resposta.status})`);
  }
  return dados;
}

export default async function handler(req, res) {
  if (!requireAuth(req, res, ['admin'])) return;

  const action = req.method === 'GET' ? req.query?.action : req.body?.action;

  try {
    // Lista de trabalhadores com pelo menos uma mensagem trocada (contactos
    // da aba), ordenados pela mensagem mais recente — a "lista de conversas"
    // à esquerda no estilo WhatsApp.
    if (action === 'listar-conversas') {
      const db = supabaseAdmin();
      const { data, error } = await db
        .from('worker_whatsapp_messages')
        .select('worker_id, texto, direcao, criado_em, workers!inner(name, tel)')
        .order('criado_em', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });

      const porTrabalhador = new Map();
      for (const linha of data || []) {
        if (!porTrabalhador.has(linha.worker_id)) {
          porTrabalhador.set(linha.worker_id, {
            worker_id: linha.worker_id,
            nome: linha.workers?.name,
            tel: linha.workers?.tel,
            ultima_mensagem: linha.texto,
            ultima_direcao: linha.direcao,
            ultima_em: linha.criado_em,
          });
        }
      }
      return res.status(200).json({ conversas: [...porTrabalhador.values()] });
    }

    // Histórico completo de um trabalhador específico.
    if (action === 'historico') {
      const workerId = req.query?.worker_id;
      if (!workerId) return res.status(400).json({ error: 'worker_id em falta.' });
      const db = supabaseAdmin();
      const { data, error } = await db
        .from('worker_whatsapp_messages')
        .select('id, direcao, texto, criado_em')
        .eq('worker_id', workerId)
        .order('criado_em', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ mensagens: data || [] });
    }

    // Histórico de conversa do Trabalhador Virtual com o próprio Diego —
    // lido diretamente da BD do conselheiro (projeto Supabase separado).
    if (action === 'historico-bot') {
      const db = conselheiroSupabase();
      if (!db) {
        return res.status(500).json({
          error: 'CONSELHEIRO_SUPABASE_URL/CONSELHEIRO_SUPABASE_SERVICE_KEY não configurados neste projeto.',
        });
      }
      const { data, error } = await db
        .from('whatsapp_conversas')
        .select('direcao, texto, criado_em')
        .order('criado_em', { ascending: true })
        .limit(200);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ mensagens: data || [] });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

    // Envia uma mensagem de texto livre a um trabalhador e regista.
    if (action === 'enviar') {
      const { worker_id: workerId, texto } = req.body || {};
      if (!workerId || !texto?.trim()) {
        return res.status(400).json({ error: 'worker_id e texto são obrigatórios.' });
      }
      const db = supabaseAdmin();
      const { data: worker, error: errWorker } = await db
        .from('workers')
        .select('id, tel, name')
        .eq('id', workerId)
        .maybeSingle();
      if (errWorker) return res.status(500).json({ error: errWorker.message });
      if (!worker?.tel) return res.status(404).json({ error: 'Trabalhador sem número de telemóvel registado.' });

      try {
        await enviarGraphApi(worker.tel.replace(/[^\d]/g, ''), texto.trim());
      } catch (e) {
        return res.status(502).json({ error: e.message });
      }

      const { error: errInsert } = await db.from('worker_whatsapp_messages').insert({
        id: `wwm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        worker_id: workerId,
        direcao: 'enviada',
        texto: texto.trim(),
      });
      if (errInsert) return res.status(500).json({ error: errInsert.message });

      return res.status(200).json({ sucesso: true });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch (e) {
    console.error('[api/whatsapp] erro:', e);
    return res.status(500).json({ error: e.message || 'Erro inesperado.' });
  }
}
