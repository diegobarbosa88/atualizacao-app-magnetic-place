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

// replyTo (wamid, opcional) responde a uma mensagem concreta -- aparece no
// WhatsApp do trabalhador como citação por cima do texto, tal como quando
// se responde a uma mensagem à mão na app normal.
async function enviarGraphApi(to, body, replyTo) {
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
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
      ...(replyTo ? { context: { message_id: replyTo } } : {}),
    }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados?.error?.message || `Falha ao enviar WhatsApp (HTTP ${resposta.status})`);
  }
  return dados;
}

// Mensagem iniciada pela empresa (as notificações do admin podem disparar a
// qualquer hora, sem garantia de estar dentro da janela de 24h de conversa
// com o Diego) -- por isso é sempre por template aprovado, nunca texto
// livre. Reaproveita mp_aviso_pendencia_botao, já aprovado pela Meta para
// os avisos automáticos do conselheiro (mesmo formato {{1}} + botão "Ver
// pendências").
async function enviarGraphApiTemplate(to, variavel1) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const nomeTemplate = process.env.WHATSAPP_TEMPLATE_AVISO_BOTAO;
  if (!token || !phoneNumberId || !nomeTemplate) {
    throw new Error('WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_TEMPLATE_AVISO_BOTAO não configurados neste projeto.');
  }
  const resposta = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: nomeTemplate,
        language: { code: 'pt_PT' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: variavel1 }] }],
      },
    }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados?.error?.message || `Falha ao enviar WhatsApp (HTTP ${resposta.status})`);
  }
  return dados;
}

// Anexos -- sobe o ficheiro para a Meta (fica hospedado do lado deles,
// nada guardado aqui) e devolve o media id a usar na mensagem a seguir.
// https://graph.facebook.com/{Phone-Number-ID}/media, multipart/form-data.
async function enviarMediaGraphApi(buffer, mimetype) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error('WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID não configurados neste projeto.');
  }
  const formData = new FormData();
  formData.append('messaging_product', 'whatsapp');
  formData.append('file', new Blob([buffer], { type: mimetype }));
  formData.append('type', mimetype);
  const resposta = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados?.error?.message || `Falha ao enviar ficheiro (HTTP ${resposta.status})`);
  }
  return dados.id;
}

// Deduz o tipo de mensagem da Meta a partir do mimetype do ficheiro --
// imagem/áudio/vídeo têm tipo próprio, tudo o resto (pdf, word, excel...)
// vai como documento genérico.
function tipoMediaPorMimetype(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  return 'document';
}

// Manda a mensagem de imagem/documento/áudio/vídeo propriamente dita,
// referenciando o media id já enviado. filename só é usado (e aceite) para
// documento -- os outros tipos não têm nome de ficheiro visível no
// WhatsApp.
async function enviarMensagemComMedia(to, mediaId, tipoMedia, filename) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const payload = tipoMedia === 'document'
    ? { type: 'document', document: { id: mediaId, filename } }
    : { type: tipoMedia, [tipoMedia]: { id: mediaId } };
  const resposta = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, ...payload }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados?.error?.message || `Falha ao enviar mensagem (HTTP ${resposta.status})`);
  }
  return dados;
}

// Localização -- morada de um cliente/obra, mostrada como pin no mapa
// dentro do WhatsApp do trabalhador.
async function enviarMensagemLocalizacao(to, { latitude, longitude, nome, endereco }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const resposta = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'location',
      location: { latitude, longitude, name: nome, address: endereco },
    }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados?.error?.message || `Falha ao enviar localização (HTTP ${resposta.status})`);
  }
  return dados;
}

// Cartão de contacto -- ex. mediador de seguros, contabilista. Lista curta
// e fixa no código de propósito (não vale a pena um CRUD para isto).
const CONTACTOS_UTEIS = {
  mediador: { nome: 'Mediador de Seguros', tel: process.env.WHATSAPP_MEDIADOR_SEGUROS },
};

async function enviarMensagemContacto(to, contatoId) {
  const contato = CONTACTOS_UTEIS[contatoId];
  if (!contato) throw new Error(`Contacto desconhecido: ${contatoId}`);
  if (!contato.tel) throw new Error(`Número não configurado para "${contato.nome}".`);
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const resposta = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'contacts',
      contacts: [{
        name: { formatted_name: contato.nome, first_name: contato.nome },
        phones: [{ phone: contato.tel, type: 'WORK' }],
      }],
    }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados?.error?.message || `Falha ao enviar contacto (HTTP ${resposta.status})`);
  }
  return { dados, nome: contato.nome };
}

// Reação com emoji a uma mensagem concreta (pelo wamid). Emoji vazio ("")
// remove uma reação já colocada -- comportamento nativo da Meta.
async function enviarReacaoGraphApi(to, wamid, emoji) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const resposta = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'reaction',
      reaction: { message_id: wamid, emoji },
    }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados?.error?.message || `Falha ao enviar reação (HTTP ${resposta.status})`);
  }
  return dados;
}

// Botões de resposta rápida -- até 3, cada um com id (o que volta na
// resposta) e title (o que o trabalhador vê). Mesma constraint da Meta já
// conhecida do lado do conselheiro (enviarBotoesRapidos).
async function enviarBotoesGraphApi(to, corpo, botoes) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const resposta = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: corpo },
        action: { buttons: botoes.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
      },
    }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados?.error?.message || `Falha ao enviar botões (HTTP ${resposta.status})`);
  }
  return dados;
}

// Marca como lida no WhatsApp real do trabalhador (o ✓✓ azul) e mostra
// "a escrever…" por alguns segundos -- mesmo pedido único que a Meta usa
// para as duas coisas (ver "Send typing indicator and read receipt" na
// spec oficial). wamid tem de ser de uma mensagem RECEBIDA (nunca das que
// nós enviámos).
async function marcarComoLidaGraphApi(wamid) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const resposta = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: wamid,
      typing_indicator: { type: 'text' },
    }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados?.error?.message || `Falha ao marcar como lida (HTTP ${resposta.status})`);
  }
  return dados;
}

// Só chamada depois do worker_id já ter sido resolvido/validado pelo
// chamador -- reaproveitada por 'enviar' (um) e 'enviar-lote' (vários).
// replyTo (wamid, opcional) só faz sentido no envio individual -- em lote
// não há "a mensagem a que se está a responder" para vários de uma vez.
async function enviarParaTrabalhador(db, workerId, tel, texto, replyTo) {
  const dados = await enviarGraphApi(tel.replace(/[^\d]/g, ''), texto, replyTo);
  const { error } = await db.from('worker_whatsapp_messages').insert({
    id: `wwm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    worker_id: workerId,
    direcao: 'enviada',
    texto,
    wamid: dados?.messages?.[0]?.id || null,
  });
  if (error) throw new Error(error.message);
}

async function handlerWhatsApp(req, res, action) {
  try {
    // Lista de trabalhadores com pelo menos uma mensagem trocada (contactos
    // da aba), ordenados pela mensagem mais recente, com a contagem de
    // mensagens recebidas por ler.
    if (action === 'listar-conversas') {
      const db = supabaseAdmin();
      const [{ data, error }, { data: naoLidas, error: errNaoLidas }] = await Promise.all([
        db
          .from('worker_whatsapp_messages')
          .select('worker_id, texto, direcao, criado_em, workers!inner(name, tel)')
          .order('criado_em', { ascending: false }),
        db
          .from('worker_whatsapp_messages')
          .select('worker_id')
          .eq('direcao', 'recebida')
          .eq('lida', false),
      ]);
      if (error) return res.status(500).json({ error: error.message });
      if (errNaoLidas) return res.status(500).json({ error: errNaoLidas.message });

      const contagemNaoLidas = new Map();
      for (const linha of naoLidas || []) {
        contagemNaoLidas.set(linha.worker_id, (contagemNaoLidas.get(linha.worker_id) || 0) + 1);
      }

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
            nao_lidas: contagemNaoLidas.get(linha.worker_id) || 0,
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
        .select('id, direcao, texto, criado_em, wamid')
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
      // Ordena descendente + limite para apanhar as 200 mais RECENTES (não
      // as 200 mais antigas, que é o que "ascending + limit" devolvia --
      // bug real: com >200 mensagens no total, ficava preso para sempre
      // nas mesmas 200 mais velhas, por mais que passasse tempo). Inverte
      // no fim para a conversa continuar a aparecer do mais antigo para o
      // mais recente na UI.
      const { data, error } = await db
        .from('whatsapp_conversas')
        .select('direcao, texto, criado_em')
        .order('criado_em', { ascending: false })
        .limit(200);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ mensagens: (data || []).reverse() });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

    // Marca as mensagens recebidas de um trabalhador como lidas -- chamado
    // pelo frontend ao abrir essa conversa, para o indicador de não lidas
    // da lista de contactos desaparecer.
    if (action === 'marcar-lida') {
      const { worker_id: workerId } = req.body || {};
      if (!workerId) return res.status(400).json({ error: 'worker_id em falta.' });
      const db = supabaseAdmin();

      // Marca no WhatsApp REAL do trabalhador (o ✓✓ azul) -- só a mensagem
      // recebida mais recente, é o que a própria app do WhatsApp faz (a
      // Meta trata as anteriores da mesma conversa como lidas também).
      // Falha aqui não deve impedir marcar como lida no nosso lado --
      // regista o erro e continua.
      const { data: ultimaRecebida } = await db
        .from('worker_whatsapp_messages')
        .select('wamid')
        .eq('worker_id', workerId)
        .eq('direcao', 'recebida')
        .not('wamid', 'is', null)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ultimaRecebida?.wamid) {
        try {
          await marcarComoLidaGraphApi(ultimaRecebida.wamid);
        } catch (e) {
          console.error('[marcar-lida] falha ao marcar no WhatsApp real:', e.message);
        }
      }

      const { error } = await db
        .from('worker_whatsapp_messages')
        .update({ lida: true })
        .eq('worker_id', workerId)
        .eq('direcao', 'recebida')
        .eq('lida', false);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ sucesso: true });
    }

    // Envia uma mensagem de texto livre a um trabalhador e regista.
    // reply_to (wamid, opcional): responde a uma mensagem concreta em vez
    // de mandar solto no fim da conversa.
    if (action === 'enviar') {
      const { worker_id: workerId, texto, reply_to: replyTo } = req.body || {};
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
        await enviarParaTrabalhador(db, workerId, worker.tel, texto.trim(), replyTo || undefined);
      } catch (e) {
        return res.status(502).json({ error: e.message });
      }

      return res.status(200).json({ sucesso: true });
    }

    // Envia um anexo (imagem, documento, áudio ou vídeo) a um trabalhador
    // -- só envio, não guarda o ficheiro aqui, fica hospedado do lado da
    // Meta. O frontend manda o ficheiro em base64 dentro do JSON (mais
    // simples do que multipart neste endpoint), por isso o limite prático
    // é o do corpo do pedido -- 3MB dá margem confortável sem se aproximar
    // do limite do runtime serverless.
    if (action === 'enviar-anexo') {
      const { worker_id: workerId, filename, mimetype, data_base64: dataBase64 } = req.body || {};
      if (!workerId || !filename || !mimetype || !dataBase64) {
        return res.status(400).json({ error: 'worker_id, filename, mimetype e data_base64 são obrigatórios.' });
      }
      const db = supabaseAdmin();
      const { data: worker, error: errWorker } = await db
        .from('workers')
        .select('id, tel, name')
        .eq('id', workerId)
        .maybeSingle();
      if (errWorker) return res.status(500).json({ error: errWorker.message });
      if (!worker?.tel) return res.status(404).json({ error: 'Trabalhador sem número de telemóvel registado.' });

      const buffer = Buffer.from(dataBase64, 'base64');
      // 3MB de ficheiro original -- em base64 (+33%) mais o resto do JSON
      // fica confortavelmente sob o limite de 4.5MB do corpo do pedido nas
      // Serverless Functions da Vercel (que rejeitaria antes disto sequer
      // correr, com um 413 genérico em vez desta mensagem clara).
      const LIMITE_BYTES = 3 * 1024 * 1024;
      if (buffer.length > LIMITE_BYTES) {
        return res.status(400).json({ error: 'Ficheiro demasiado grande (máx. 3MB).' });
      }

      const tipoMedia = tipoMediaPorMimetype(mimetype);
      let wamid = null;
      try {
        const mediaId = await enviarMediaGraphApi(buffer, mimetype);
        const dados = await enviarMensagemComMedia(worker.tel.replace(/[^\d]/g, ''), mediaId, tipoMedia, filename);
        wamid = dados?.messages?.[0]?.id || null;
      } catch (e) {
        return res.status(502).json({ error: e.message });
      }

      const ICONES = { image: '🖼️', audio: '🎤', video: '🎥', document: '📎' };
      const { error: errInsert } = await db.from('worker_whatsapp_messages').insert({
        id: `wwm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        worker_id: workerId,
        direcao: 'enviada',
        texto: `${ICONES[tipoMedia]} ${filename}`,
        wamid,
      });
      if (errInsert) return res.status(500).json({ error: errInsert.message });

      return res.status(200).json({ sucesso: true });
    }

    // Envia uma localização (morada de obra/cliente) a um trabalhador.
    if (action === 'enviar-localizacao') {
      const { worker_id: workerId, latitude, longitude, nome, endereco } = req.body || {};
      if (!workerId || latitude == null || longitude == null) {
        return res.status(400).json({ error: 'worker_id, latitude e longitude são obrigatórios.' });
      }
      const db = supabaseAdmin();
      const { data: worker, error: errWorker } = await db
        .from('workers')
        .select('id, tel, name')
        .eq('id', workerId)
        .maybeSingle();
      if (errWorker) return res.status(500).json({ error: errWorker.message });
      if (!worker?.tel) return res.status(404).json({ error: 'Trabalhador sem número de telemóvel registado.' });

      let wamid = null;
      try {
        const dados = await enviarMensagemLocalizacao(worker.tel.replace(/[^\d]/g, ''), { latitude, longitude, nome, endereco });
        wamid = dados?.messages?.[0]?.id || null;
      } catch (e) {
        return res.status(502).json({ error: e.message });
      }

      const { error: errInsert } = await db.from('worker_whatsapp_messages').insert({
        id: `wwm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        worker_id: workerId,
        direcao: 'enviada',
        texto: `📍 ${nome || 'Localização'}${endereco ? ` — ${endereco}` : ''}`,
        wamid,
      });
      if (errInsert) return res.status(500).json({ error: errInsert.message });

      return res.status(200).json({ sucesso: true });
    }

    // Envia um cartão de contacto (ex. mediador de seguros) a um trabalhador.
    if (action === 'enviar-contacto') {
      const { worker_id: workerId, contato_id: contatoId } = req.body || {};
      if (!workerId || !contatoId) {
        return res.status(400).json({ error: 'worker_id e contato_id são obrigatórios.' });
      }
      const db = supabaseAdmin();
      const { data: worker, error: errWorker } = await db
        .from('workers')
        .select('id, tel, name')
        .eq('id', workerId)
        .maybeSingle();
      if (errWorker) return res.status(500).json({ error: errWorker.message });
      if (!worker?.tel) return res.status(404).json({ error: 'Trabalhador sem número de telemóvel registado.' });

      let wamid = null;
      let nomeContato = '';
      try {
        const { dados, nome } = await enviarMensagemContacto(worker.tel.replace(/[^\d]/g, ''), contatoId);
        wamid = dados?.messages?.[0]?.id || null;
        nomeContato = nome;
      } catch (e) {
        return res.status(502).json({ error: e.message });
      }

      const { error: errInsert } = await db.from('worker_whatsapp_messages').insert({
        id: `wwm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        worker_id: workerId,
        direcao: 'enviada',
        texto: `👤 Contacto: ${nomeContato}`,
        wamid,
      });
      if (errInsert) return res.status(500).json({ error: errInsert.message });

      return res.status(200).json({ sucesso: true });
    }

    // Reage com um emoji a uma mensagem concreta (pelo wamid). emoji: ''
    // remove uma reação já colocada.
    if (action === 'enviar-reacao') {
      const { wamid, to, emoji } = req.body || {};
      if (!wamid || !to || emoji == null) {
        return res.status(400).json({ error: 'wamid, to e emoji são obrigatórios.' });
      }
      try {
        await enviarReacaoGraphApi(to.replace(/[^\d]/g, ''), wamid, emoji);
      } catch (e) {
        return res.status(502).json({ error: e.message });
      }
      return res.status(200).json({ sucesso: true });
    }

    // Envia uma pergunta com até 3 botões de resposta rápida.
    if (action === 'enviar-botoes') {
      const { worker_id: workerId, corpo, botoes } = req.body || {};
      if (!workerId || !corpo?.trim() || !Array.isArray(botoes) || botoes.length === 0 || botoes.length > 3) {
        return res.status(400).json({ error: 'worker_id, corpo e botoes (1 a 3) são obrigatórios.' });
      }
      const db = supabaseAdmin();
      const { data: worker, error: errWorker } = await db
        .from('workers')
        .select('id, tel, name')
        .eq('id', workerId)
        .maybeSingle();
      if (errWorker) return res.status(500).json({ error: errWorker.message });
      if (!worker?.tel) return res.status(404).json({ error: 'Trabalhador sem número de telemóvel registado.' });

      let wamid = null;
      try {
        const dados = await enviarBotoesGraphApi(worker.tel.replace(/[^\d]/g, ''), corpo.trim(), botoes);
        wamid = dados?.messages?.[0]?.id || null;
      } catch (e) {
        return res.status(502).json({ error: e.message });
      }

      const { error: errInsert } = await db.from('worker_whatsapp_messages').insert({
        id: `wwm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        worker_id: workerId,
        direcao: 'enviada',
        texto: corpo.trim(),
        wamid,
      });
      if (errInsert) return res.status(500).json({ error: errInsert.message });

      return res.status(200).json({ sucesso: true });
    }

    // Envia a mesma mensagem a vários trabalhadores de uma vez -- continua
    // mesmo que um envio individual falhe, para não travar os restantes
    // por causa de um único erro (ex: trabalhador sem tel válido).
    if (action === 'enviar-lote') {
      const { worker_ids: workerIds, texto } = req.body || {};
      if (!Array.isArray(workerIds) || workerIds.length === 0 || !texto?.trim()) {
        return res.status(400).json({ error: 'worker_ids (array) e texto são obrigatórios.' });
      }
      const db = supabaseAdmin();
      const { data: trabalhadores, error: errWorkers } = await db
        .from('workers')
        .select('id, tel, name')
        .in('id', workerIds);
      if (errWorkers) return res.status(500).json({ error: errWorkers.message });

      const resultados = [];
      for (const workerId of workerIds) {
        const worker = trabalhadores.find(w => w.id === workerId);
        if (!worker?.tel) {
          resultados.push({ worker_id: workerId, sucesso: false, error: 'Sem número de telemóvel registado.' });
          continue;
        }
        try {
          await enviarParaTrabalhador(db, workerId, worker.tel, texto.trim());
          resultados.push({ worker_id: workerId, sucesso: true });
        } catch (e) {
          resultados.push({ worker_id: workerId, sucesso: false, error: e.message });
        }
      }

      const falhas = resultados.filter(r => !r.sucesso);
      return res.status(200).json({
        sucesso: falhas.length === 0,
        mensagem: `${resultados.length - falhas.length}/${resultados.length} mensagens enviadas.`,
        resultados,
      });
    }

    // Relay de notificações do admin para WhatsApp -- chamado pelo trigger
    // Postgres em app_notifications (ver migração
    // 20260829_notificar_admin_whatsapp.sql), nunca diretamente pelo
    // browser. Autenticado por segredo partilhado, não por sessão admin
    // (o trigger dispara também para eventos originados por trabalhadores
    // ou pela página pública de onboarding, sem sessão admin nenhuma).
    if (action === 'notificar-admin') {
      const { title, message } = req.body || {};
      if (!title && !message) return res.status(400).json({ error: 'title ou message em falta.' });
      const numeros = (process.env.WHATSAPP_NUMEROS_AUTORIZADOS || '')
        .split(',').map(n => n.trim().replace(/[^\d]/g, '')).filter(Boolean);
      if (!numeros.length) {
        return res.status(500).json({ error: 'WHATSAPP_NUMEROS_AUTORIZADOS não configurado neste projeto.' });
      }
      // Parâmetros de template da Meta são mais restritivos que o corpo
      // estático do template -- emoji (frequentes nos títulos das
      // notificações do admin, ex. "✍️ Documento assinado") disparam
      // "(#131009) Parameter value is not valid". Remove-os e normaliza
      // espaços em branco antes de enviar.
      const corpo = [title, message].filter(Boolean).join(': ')
        // \p{Extended_Pictographic} apanha o emoji em si; ️ (variation
        // selector) e ‍ (zero-width joiner) ficam de fora dessa
        // categoria mas sobram como caracteres invisíveis se não forem
        // removidos à parte (confirmado ao testar contra o caso real que
        // falhou: "✍️" deixava o ️ solto no início do texto).
        .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
      const resultados = await Promise.allSettled(numeros.map(n => enviarGraphApiTemplate(n, corpo)));
      const falhas = resultados.filter(r => r.status === 'rejected');
      if (falhas.length) console.error('[notificar-admin] falhas ao enviar:', falhas.map(f => f.reason?.message));
      return res.status(200).json({ sucesso: falhas.length < resultados.length, enviados: resultados.length - falhas.length });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch (e) {
    console.error('[api/whatsapp] erro:', e);
    return res.status(500).json({ error: e.message || 'Erro inesperado.' });
  }
}

// ─── SEPA (exportação de salários) ─────────────────────────────────

// notificar-admin vem do trigger Postgres (net.http_post), nunca de uma
// sessão de browser -- por isso é autenticado por segredo partilhado, não
// pelo requireAuth normal. Mesmo espírito do isAgenteAutorizado em
// api/seguranca-social/index.js.
function isWebhookAutorizado(req) {
  const segredo = process.env.ADMIN_NOTIF_WEBHOOK_SECRET;
  return !!segredo && req.headers['x-webhook-secret'] === segredo;
}

export default async function handler(req, res) {
  // WHATSAPP_ACTIONS decide o desvio ANTES do guard "só POST" abaixo,
  // porque listar-conversas/historico/historico-bot são GET.
  const whatsappAction = req.method === 'GET' ? req.query?.action : req.body?.action;

  if (whatsappAction === 'notificar-admin') {
    if (!isWebhookAutorizado(req)) return res.status(401).json({ error: 'Não autorizado.' });
    return handlerWhatsApp(req, res, whatsappAction);
  }

  if (!requireAuth(req, res, ['admin'])) return;

  if ([
    'listar-conversas', 'historico', 'historico-bot', 'marcar-lida', 'enviar', 'enviar-lote', 'enviar-anexo',
    'enviar-localizacao', 'enviar-contacto', 'enviar-reacao', 'enviar-botoes',
  ].includes(whatsappAction)) {
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
