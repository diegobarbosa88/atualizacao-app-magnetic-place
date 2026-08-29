import { createClient } from '@supabase/supabase-js';
import { gerarSepaSalariosXML } from '../../services/sepaSalariosService.js';
import { requireAuth } from '../_authUtils.js';

// ─── WhatsApp (inbox por trabalhador) ──────────────────────────────
// Fundido aqui só por causa do limite de 12 Serverless Functions do
// plano Hobby da Vercel — este projeto já estava exatamente no limite.
// Sem relação nenhuma com SEPA; a rota pública continua /api/whatsapp
// (ver rewrite em vercel.json), o frontend (WhatsAppInbox.jsx) nem sabe
// que aterra fisicamente aqui. Se um dia passar para o plano Pro (sem
// limite de funções), isto deve voltar a ser api/whatsapp/index.js.
//
// Ver supabase/migrations/20260829_worker_whatsapp_messages.sql para o
// desenho completo (as mensagens recebidas chegam via um 3º ramo em
// conselheiro/api/whatsapp/webhook.js, não por este endpoint).

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

async function handlerWhatsApp(req, res, action) {
  try {
    // Lista de trabalhadores com pelo menos uma mensagem trocada (contactos
    // da aba), ordenados pela mensagem mais recente.
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

// ─── SEPA (exportação de salários) ─────────────────────────────────

export default async function handler(req, res) {
  if (!requireAuth(req, res, ['admin'])) return;

  // WHATSAPP_ACTIONS decide o desvio ANTES do guard "só POST" abaixo,
  // porque listar-conversas/historico/historico-bot são GET.
  const whatsappAction = req.method === 'GET' ? req.query?.action : req.body?.action;
  if (['listar-conversas', 'historico', 'historico-bot', 'enviar'].includes(whatsappAction)) {
    return handlerWhatsApp(req, res, whatsappAction);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const { trabalhadores, instant = false, urgente = false } = req.body || {};
  const isInstant = Boolean(instant || urgente);

  if (!Array.isArray(trabalhadores) || trabalhadores.length === 0) {
    return res.status(400).json({
      error: 'O campo "trabalhadores" é obrigatório e deve ser um array não vazio.',
    });
  }

  const incompleto = trabalhadores.findIndex(t => !t.nome || !t.iban || t.salario == null || !t.mes || !t.ano);
  if (incompleto !== -1) {
    return res.status(400).json({
      error: `Trabalhador #${incompleto + 1} incompleto. Campos obrigatórios: nome, iban, salario, mes, ano.`,
    });
  }

  const ibanEmpresa = process.env.MINHA_CONTA_IBAN;
  const bicEmpresa  = process.env.MINHA_CONTA_BIC;

  if (!ibanEmpresa || !bicEmpresa) {
    return res.status(500).json({
      error: 'Configuração em falta: defina MINHA_CONTA_IBAN e MINHA_CONTA_BIC nas variáveis de ambiente.',
    });
  }

  try {
    const xmlString = gerarSepaSalariosXML(
      { iban: ibanEmpresa, bic: bicEmpresa },
      trabalhadores,
      isInstant,
    );

    const nomeArquivo = isInstant
      ? 'transferencias_imediatas.xml'
      : 'salarios_magnetic_place.xml';

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);

    return res.status(200).send(xmlString);
  } catch (erro) {
    console.error('[SEPA] Erro ao gerar ficheiro XML:', erro.message);
    return res.status(500).json({ error: erro.message });
  }
}
