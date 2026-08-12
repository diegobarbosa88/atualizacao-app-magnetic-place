import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { callGeminiJSON } from '../parse-fatura.js';

// Import dinâmico: evita que uma falha de inicialização do pdf-parse
// (que ocorre no Vercel ao carregar ficheiros de teste) quebre o modo faturas.
async function getParser() {
  return import('./_parseComprovativo.js');
}

const ALLOWED_MIME_TYPES = ['application/pdf', 'application/xml', 'text/xml'];
const FATURAS_QUERY = 'is:unread has:attachment {subject:fatura subject:invoice subject:FT}';
const MAX_RESULTS = 50;

function findAttachmentParts(parts = []) {
  const found = [];
  for (const part of parts) {
    if (ALLOWED_MIME_TYPES.includes(part.mimeType) && part.body?.attachmentId) {
      found.push(part);
    }
    if (part.parts) found.push(...findAttachmentParts(part.parts));
  }
  return found;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (req.headers['x-import-secret'] !== process.env.GMAIL_IMPORT_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
      return res.status(500).json({ error: 'Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET or GMAIL_REFRESH_TOKEN env vars' });
    }

    const auth = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
    const gmail = google.gmail({ version: 'v1', auth });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let body = {};
    try { body = req.body || {}; } catch (_) { /* ok */ }

    // mode: 'faturas' (default) | 'comprovativos' | 'contador' | 'all'
    const mode = body.mode || 'faturas';
    const userId = 'me';

    if (mode === 'contador') {
      if (!body.fornecedorId) {
        return res.status(400).json({ error: 'fornecedorId é obrigatório no modo contador' });
      }
      const parser = await getParser();
      const result = await importarContador(gmail, supabase, userId, body.query, body.fornecedorId, parser);
      return res.status(200).json(result);
    }

    const result = { faturas: null, comprovativos: null };

    if (mode === 'faturas' || mode === 'all') {
      result.faturas = await importarFaturas(gmail, supabase, userId, body.query);
    }
    if (mode === 'comprovativos' || mode === 'all') {
      const parser = await getParser();
      result.comprovativos = await importarComprovativos(gmail, supabase, userId, body.query, parser);
    }

    return res.status(200).json(mode === 'all' ? result : (result.faturas ?? result.comprovativos));
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}

// ---------------------------------------------------------------------------
// Modo "faturas": anexos de fatura (PDF/XML) → tabela faturas
// ---------------------------------------------------------------------------
async function importarFaturas(gmail, supabase, userId, queryOverride) {
  const query = queryOverride?.trim() || FATURAS_QUERY;
  let listRes;
  try {
    listRes = await gmail.users.messages.list({ userId, q: query, maxResults: MAX_RESULTS });
  } catch (e) {
    return { error: `Gmail list failed: ${e.message}` };
  }

  let processados = 0, ficheiros = 0;
  const erros = [];

  for (const msg of listRes.data.messages || []) {
    let full;
    try {
      full = await gmail.users.messages.get({ userId, id: msg.id, format: 'full' });
    } catch (e) {
      erros.push({ messageId: msg.id, error: `messages.get failed: ${e.message}` });
      continue;
    }

    const parts = findAttachmentParts(full.data.payload?.parts || []);

    for (const part of parts) {
      try {
        const attRes = await gmail.users.messages.attachments.get({
          userId, messageId: msg.id, id: part.body.attachmentId,
        });

        const buffer = Buffer.from(attRes.data.data, 'base64url');
        const rawName = part.filename || `attachment_${Date.now()}.pdf`;
        const filename = rawName.trim().replace(/[_\s]+$/, '').replace(/[^a-zA-Z0-9.\-_()]/g, '_') || `attachment_${Date.now()}.pdf`;
        const storagePath = `faturas/${msg.id}/${filename}`;

        const { error: uploadError } = await supabase.storage
          .from('faturas')
          .upload(storagePath, buffer, { contentType: part.mimeType, upsert: true });

        if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`);

        const { data: { publicUrl } } = supabase.storage.from('faturas').getPublicUrl(storagePath);

        const { error: dbError } = await supabase.from('faturas').insert({
          gmail_message_id: msg.id,
          filename,
          storage_path: storagePath,
          url: publicUrl,
          mime_type: part.mimeType,
          tamanho: buffer.length,
        });

        if (dbError && !dbError.message.includes('duplicate')) {
          throw new Error(`DB insert: ${dbError.message}`);
        }

        ficheiros++;
      } catch (e) {
        erros.push({ messageId: msg.id, filename: part.filename, error: e.message });
      }
    }

    try {
      await gmail.users.messages.modify({
        userId, id: msg.id,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
    } catch (e) {
      erros.push({ messageId: msg.id, error: `mark-as-read failed: ${e.message}` });
    }

    processados++;
  }

  return { processados, ficheiros, erros };
}

// ---------------------------------------------------------------------------
// Modo "comprovativos": emails novobanco → tabela faturas_centro_documentos
// ---------------------------------------------------------------------------
async function importarComprovativos(gmail, supabase, userId, queryOverride, parser) {
  const { COMPROVATIVO_QUERY, extractFromText, extractBodyText, findPdfParts, extractPdfText } = parser;
  const query = queryOverride?.trim() || COMPROVATIVO_QUERY;
  let listRes;
  try {
    listRes = await gmail.users.messages.list({ userId, q: query, maxResults: MAX_RESULTS });
  } catch (e) {
    return { error: `Gmail list failed: ${e.message}` };
  }

  const processados = [];
  const erros = [];

  // Fetch all already-imported gmail_message_ids to skip duplicates
  const { data: existingRows } = await supabase
    .from('faturas_centro_documentos')
    .select('gmail_message_id')
    .not('gmail_message_id', 'is', null);
  const importedIds = new Set((existingRows || []).map(r => r.gmail_message_id));

  let skipped = 0;

  for (const msg of listRes.data.messages || []) {
    if (importedIds.has(msg.id)) {
      // Already imported — just ensure email is marked as read
      try { await gmail.users.messages.modify({ userId, id: msg.id, requestBody: { removeLabelIds: ['UNREAD'] } }); } catch { /* marcar como lido é best-effort — ignorar falhas */ }
      skipped++;
      continue;
    }

    try {
      const full = await gmail.users.messages.get({ userId, id: msg.id, format: 'full' });
      const payload = full.data.payload;
      const headers = payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';

      let campos = null;
      let storagePath = null;
      let publicUrl = null;
      let fonte = 'corpo';
      let textoExtraido = '';

      const pdfParts = findPdfParts(payload?.parts || []);
      if (pdfParts.length > 0) {
        const part = pdfParts[0];
        const attRes = await gmail.users.messages.attachments.get({
          userId, messageId: msg.id, id: part.body.attachmentId,
        });
        const buffer = Buffer.from(attRes.data.data, 'base64url');

        const filename = (part.filename || `comprovativo_${Date.now()}.pdf`)
          .replace(/[^a-zA-Z0-9.\-_()]/g, '_');
        storagePath = `comprovativos/${msg.id}/${filename}`;

        await supabase.storage
          .from('faturas')
          .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });

        const { data: { publicUrl: url } } = supabase.storage.from('faturas').getPublicUrl(storagePath);
        publicUrl = url;

        try {
          textoExtraido = await extractPdfText(buffer);
          campos = extractFromText(textoExtraido);
          fonte = 'pdf';
        } catch (pdfErr) {
          erros.push({ messageId: msg.id, aviso: `pdf-parse falhou, a usar corpo: ${pdfErr.message}` });
        }
      }

      if (!campos) {
        textoExtraido = extractBodyText(payload);
        campos = extractFromText(textoExtraido);
        fonte = 'corpo';
      }

      if (!campos.valor || campos.valor <= 0) {
        const flatParts = (function flat(ps) { return ps.flatMap(p => [{ mimeType: p.mimeType, filename: p.filename, hasId: !!p.body?.attachmentId }, ...flat(p.parts || [])]); })(payload?.parts || []);
        erros.push({ messageId: msg.id, subject, fonte, campos_extraidos: campos, texto_debug: textoExtraido.slice(0, 800), partes: flatParts, aviso: 'Montante não encontrado — registo ignorado.' });
        await gmail.users.messages.modify({ userId, id: msg.id, requestBody: { removeLabelIds: ['UNREAD'] } });
        continue;
      }

      const { error: dbError } = await supabase.from('faturas_centro_documentos').insert({
        gmail_message_id: msg.id,
        fornecedor: campos.fornecedor,
        fornecedor_nif: campos.fornecedor_nif || null,
        fornecedor_iban: campos.fornecedor_iban || null,
        conta_origem: campos.conta_origem || null,
        valor: campos.valor,
        data_documento: campos.data_documento || null,
        referencia: campos.referencia || null,
        descricao: campos.descricao || subject,
        moeda: campos.moeda || 'EUR',
        estado_pagamento: 'confirmado',
        storage_path: storagePath || null,
        url: publicUrl || null,
      });

      if (dbError) {
        erros.push({ messageId: msg.id, error: `DB insert: ${dbError.message}` });
      } else {
        processados.push({ messageId: msg.id, subject, from, fonte, fornecedor: campos.fornecedor, valor: campos.valor, referencia: campos.referencia });
      }

      await gmail.users.messages.modify({ userId, id: msg.id, requestBody: { removeLabelIds: ['UNREAD'] } });

    } catch (e) {
      erros.push({ messageId: msg.id, error: e.message });
    }
  }

  return { importados: processados.length, skipped, detalhes: processados, erros };
}

// ---------------------------------------------------------------------------
// Modo "contador": emails de cobrança do contador → tabela emails_contador
// (NÃO gera rascunho de resposta aqui — isso é feito por
// api/gerar-resposta-contador.js, num passo seguinte e separado)
// ---------------------------------------------------------------------------
function buildContadorPrompt(texto) {
  return `Analisa o texto abaixo, extraído de um email de cobrança do contador/contabilista da empresa. Extrai os seguintes campos com rigor:

- numero_fatura: número/referência da fatura ou honorários (ex: "FT 2024/123"). Se não existir, usa null.
- valor: valor total a pagar (número decimal, ex: 245.00). Se não existir, usa null.
- mes_referencia: mês a que a cobrança se refere, formato YYYY-MM (ex: "2026-08"). Deduz pelo contexto (assunto, corpo) se não estiver explícito como data.
- data_documento: data do documento/email em formato YYYY-MM-DD, se presente. Senão null.
- descricao: breve descrição do que está a ser cobrado (ex: "Honorários mensais de contabilidade", "Fatura de serviços").
- iban: IBAN indicado para pagamento, se presente. Formato limpo sem espaços. Senão null.

Regras:
- Se um campo não existir claramente no texto, usa null.
- valor deve ser sempre número decimal, nunca string.
- Responde APENAS com JSON válido, sem texto antes ou depois, sem markdown.

Texto do email:
${texto.slice(0, 6000)}`;
}

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Processa UM email do contador: descarrega/guarda o anexo (PDF ou .xlsx) e
// classifica o tipo de pedido. Partilhado entre a importação em massa
// (importarContador, abaixo) e o reprocessamento sob pedido em
// api/contador?tipo=gerar (botão "Regenerar Rascunho") — mesma lógica em
// ambos os sítios, para nunca haver os dois a divergir silenciosamente.
// NÃO grava nada em emails_contador — quem chama decide insert vs update.
export async function processarUmEmailContador(gmail, supabase, { userId = 'me', gmailMessageId }, parser) {
  const { extractBodyText, findContadorAttachmentParts, extractPdfText } = parser;
  const { classificarTipoPedido } = await import('../contador/_pedidosContador.js');

  const full = await gmail.users.messages.get({ userId, id: gmailMessageId, format: 'full' });
  const payload = full.data.payload;
  const headers = payload?.headers || [];
  const subject = headers.find(h => h.name === 'Subject')?.value || '';
  const from = headers.find(h => h.name === 'From')?.value || '';
  const internalDate = full.data.internalDate ? new Date(Number(full.data.internalDate)).toISOString() : null;

  let anexoPath = null;
  let textoPdfExtraido = '';

  // Fase B: aceita anexo em PDF OU .xlsx (o contabilista mudou de formato
  // sem aviso — um relatório mensal chegou em Excel em vez de PDF).
  const attachmentParts = findContadorAttachmentParts(payload?.parts || []);
  if (attachmentParts.length > 0) {
    const part = attachmentParts[0];
    const attRes = await gmail.users.messages.attachments.get({
      userId, messageId: gmailMessageId, id: part.body.attachmentId,
    });
    const buffer = Buffer.from(attRes.data.data, 'base64url');
    const extensaoPadrao = part.kind === 'xlsx' ? '.xlsx' : '.pdf';
    const filename = (part.filename || `contador_${Date.now()}${extensaoPadrao}`).replace(/[^a-zA-Z0-9.\-_()]/g, '_');
    anexoPath = `contador/${gmailMessageId}/${filename}`;
    const contentType = part.kind === 'xlsx' ? XLSX_CONTENT_TYPE : 'application/pdf';

    const { error: uploadError } = await supabase.storage
      .from('faturas')
      .upload(anexoPath, buffer, { contentType, upsert: true });
    if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`);

    if (part.kind === 'pdf') {
      try {
        textoPdfExtraido = await extractPdfText(buffer);
      } catch { /* cai para o corpo do email abaixo */ }
    }
  }

  const textoCorpo = extractBodyText(payload);
  const textoParaClassificar = textoPdfExtraido || textoCorpo;

  // Fase A: classifica o tipo de pedido ANTES de decidir que extração correr.
  const tipoPedido = await classificarTipoPedido(subject, textoParaClassificar);

  // A extração antiga (cobrança de valor único) só faz sentido para
  // 'cobranca' — para os outros tipos os campos ficam quase todos null e
  // desperdiça uma chamada Gemini. 'faturas_em_falta' e
  // 'extratos_bancarios_em_falta' são processados sob pedido em
  // api/contador?tipo=gerar (precisam do anexo completo, não só do texto).
  let dadosExtraidos = null;
  if (tipoPedido === 'cobranca' && textoParaClassificar) {
    try {
      const { data } = await callGeminiJSON(buildContadorPrompt(textoParaClassificar));
      dadosExtraidos = data;
    } catch { /* dadosExtraidos fica null — quem chama decide se regista aviso */ }
  }

  return { subject, from, internalDate, anexoPath, tipoPedido, dadosExtraidos };
}

async function importarContador(gmail, supabase, userId, queryOverride, fornecedorId, parser) {
  const query = queryOverride?.trim() || 'is:unread';
  let listRes;
  try {
    listRes = await gmail.users.messages.list({ userId, q: query, maxResults: MAX_RESULTS });
  } catch (e) {
    return { error: `Gmail list failed: ${e.message}` };
  }

  const { data: existingRows } = await supabase
    .from('emails_contador')
    .select('gmail_message_id');
  const importedIds = new Set((existingRows || []).map(r => r.gmail_message_id));

  let processados = 0, ficheiros = 0, skipped = 0, restantes = 0;
  const erros = [];

  // Orçamento de tempo: a classificação de tipo (Fase A) acrescentou uma
  // chamada Gemini por email a processar, e maxDuration está limitado a 60s
  // (vercel.json) — com muitos emails a lista inteira pode não caber numa
  // única invocação (confirmado: causava FUNCTION_INVOCATION_TIMEOUT/504,
  // que chegava ao frontend como HTML não-JSON). Em vez de arriscar o
  // timeout, pára com margem e devolve o que já processou — os já
  // importados são saltados (importedIds), por isso clicar "Importar do
  // Gmail" outra vez retoma exatamente de onde ficou.
  const inicioExecucao = Date.now();
  const ORCAMENTO_MS = 45_000;

  const mensagens = listRes.data.messages || [];
  for (let i = 0; i < mensagens.length; i++) {
    const msg = mensagens[i];

    if (importedIds.has(msg.id)) {
      try { await gmail.users.messages.modify({ userId, id: msg.id, requestBody: { removeLabelIds: ['UNREAD'] } }); } catch { /* best-effort */ }
      skipped++;
      continue;
    }

    if (Date.now() - inicioExecucao > ORCAMENTO_MS) {
      restantes = mensagens.length - i;
      break;
    }

    try {
      const { subject, from, internalDate, anexoPath, tipoPedido, dadosExtraidos } =
        await processarUmEmailContador(gmail, supabase, { userId, gmailMessageId: msg.id }, parser);

      const { error: dbError } = await supabase.from('emails_contador').insert({
        gmail_message_id: msg.id,
        fornecedor_id: fornecedorId,
        assunto: subject,
        remetente: from,
        recebido_em: internalDate,
        dados_extraidos: dadosExtraidos,
        anexo_path: anexoPath,
        tipo_pedido: tipoPedido,
        status: 'importado',
      });

      if (dbError && !dbError.message.includes('duplicate')) {
        throw new Error(`DB insert: ${dbError.message}`);
      }

      if (anexoPath) ficheiros++;
      processados++;
    } catch (e) {
      erros.push({ messageId: msg.id, error: e.message });
    }

    try {
      await gmail.users.messages.modify({ userId, id: msg.id, requestBody: { removeLabelIds: ['UNREAD'] } });
    } catch (e) {
      erros.push({ messageId: msg.id, error: `mark-as-read failed: ${e.message}` });
    }
  }

  return {
    processados, ficheiros, skipped, erros,
    ...(restantes > 0 ? {
      restantes,
      aviso: `Limite de tempo atingido — ${restantes} email(s) por processar. Clica em "Importar do Gmail" outra vez para continuar (os já processados não são repetidos).`,
    } : {}),
  };
}
