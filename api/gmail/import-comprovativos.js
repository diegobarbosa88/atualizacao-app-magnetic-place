import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import {
  COMPROVATIVO_QUERY,
  extractFromPdf,
  extractFromText,
  extractBodyText,
  findPdfParts,
} from './_parseComprovativo.js';

const MAX_RESULTS = 50;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.headers['x-import-secret'] !== process.env.GMAIL_IMPORT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
    return res.status(500).json({ error: 'Missing Gmail env vars' });
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

  const query = req.body?.query?.trim() || COMPROVATIVO_QUERY;
  const userId = 'me';
  const processados = [];
  const erros = [];

  let listRes;
  try {
    listRes = await gmail.users.messages.list({ userId, q: query, maxResults: MAX_RESULTS });
  } catch (e) {
    return res.status(500).json({ error: `Gmail list failed: ${e.message}` });
  }

  for (const msg of listRes.data.messages || []) {
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

      // --- Tentativa 1: PDF em anexo ---
      const pdfParts = findPdfParts(payload?.parts || []);
      if (pdfParts.length > 0) {
        const part = pdfParts[0];
        const attRes = await gmail.users.messages.attachments.get({
          userId, messageId: msg.id, id: part.body.attachmentId,
        });
        const buffer = Buffer.from(attRes.data.data, 'base64url');

        // Guardar PDF no Storage mesmo que o parse falhe
        const filename = (part.filename || `comprovativo_${Date.now()}.pdf`)
          .replace(/[^a-zA-Z0-9.\-_()]/g, '_');
        storagePath = `comprovativos/${msg.id}/${filename}`;

        await supabase.storage
          .from('faturas')
          .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });

        const { data: { publicUrl: url } } = supabase.storage
          .from('faturas')
          .getPublicUrl(storagePath);
        publicUrl = url;

        try {
          campos = await extractFromPdf(buffer);
          fonte = 'pdf';
        } catch (pdfErr) {
          erros.push({ messageId: msg.id, aviso: `pdf-parse falhou, a usar corpo: ${pdfErr.message}` });
        }
      }

      // --- Tentativa 2: corpo do email ---
      if (!campos) {
        const bodyText = extractBodyText(payload);
        campos = extractFromText(bodyText);
        fonte = 'corpo';
      }

      // Validação mínima: sem valor não inserimos
      if (!campos.valor || campos.valor <= 0) {
        erros.push({ messageId: msg.id, subject, aviso: 'Montante não encontrado — registo ignorado.' });
        // Marca como lido mesmo assim para não repetir
        await gmail.users.messages.modify({
          userId, id: msg.id,
          requestBody: { removeLabelIds: ['UNREAD'] },
        });
        continue;
      }

      // Inserir em faturas_centro_documentos (fonte: comprovativo novobanco)
      const { error: dbError } = await supabase.from('faturas_centro_documentos').insert({
        fornecedor: campos.fornecedor,
        fornecedor_nif: campos.fornecedor_nif || null,
        fornecedor_iban: campos.fornecedor_iban || null,
        valor: campos.valor,
        data_documento: campos.data_documento || null,
        referencia: campos.referencia || null,
        descricao: campos.descricao || subject,
        moeda: campos.moeda || 'EUR',
        estado_pagamento: 'confirmado', // já foi pago pelo banco
        storage_path: storagePath || null,
        url: publicUrl || null,
      });

      if (dbError) {
        erros.push({ messageId: msg.id, error: `DB insert: ${dbError.message}` });
      } else {
        processados.push({
          messageId: msg.id,
          subject,
          from,
          fonte,
          fornecedor: campos.fornecedor,
          valor: campos.valor,
          referencia: campos.referencia,
        });
      }

      // Marcar como lido
      await gmail.users.messages.modify({
        userId, id: msg.id,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });

    } catch (e) {
      erros.push({ messageId: msg.id, error: e.message });
    }
  }

  return res.status(200).json({
    processados: processados.length,
    detalhes: processados,
    erros,
  });
}
