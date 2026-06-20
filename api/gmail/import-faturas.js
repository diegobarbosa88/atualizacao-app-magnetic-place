import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

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

    // mode: 'faturas' (default) | 'comprovativos' | 'all'
    const mode = body.mode || 'faturas';
    const userId = 'me';

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
      try { await gmail.users.messages.modify({ userId, id: msg.id, requestBody: { removeLabelIds: ['UNREAD'] } }); } catch (_) {}
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
