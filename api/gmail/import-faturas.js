import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_MIME_TYPES = ['application/pdf', 'application/xml', 'text/xml'];
const GMAIL_QUERY = 'is:unread has:attachment {subject:fatura subject:invoice subject:FT}';
const MAX_RESULTS = 50;

function findAttachmentParts(parts = []) {
  const found = [];
  for (const part of parts) {
    if (ALLOWED_MIME_TYPES.includes(part.mimeType) && part.body?.attachmentId) {
      found.push(part);
    }
    if (part.parts) {
      found.push(...findAttachmentParts(part.parts));
    }
  }
  return found;
}


export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

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

    const userId = 'me';
    let processados = 0;
    let ficheiros = 0;
    const erros = [];

    let body = {};
    try { body = req.body || {}; } catch (_) { /* body not parseable */ }
    const query = (body.query && body.query.trim()) ? body.query.trim() : GMAIL_QUERY;

    let listRes;
    try {
      listRes = await gmail.users.messages.list({
        userId,
        q: query,
        maxResults: MAX_RESULTS,
      });
    } catch (e) {
      return res.status(500).json({ error: `Gmail list failed: ${e.message}` });
    }

    const messages = listRes.data.messages || [];

    for (const msg of messages) {
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
            userId,
            messageId: msg.id,
            id: part.body.attachmentId,
          });

          const buffer = Buffer.from(attRes.data.data, 'base64url');
          const rawName = part.filename || `attachment_${Date.now()}.pdf`;
          const filename = rawName.trim().replace(/[_\s]+$/, '').replace(/[^a-zA-Z0-9.\-_()]/g, '_') || `attachment_${Date.now()}.pdf`;
          const storagePath = `faturas/${msg.id}/${filename}`;

          const { error: uploadError } = await supabase.storage
            .from('faturas')
            .upload(storagePath, buffer, { contentType: part.mimeType, upsert: true });

          if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`);

          const { data: { publicUrl } } = supabase.storage
            .from('faturas')
            .getPublicUrl(storagePath);

          // Extracção de dados feita no cliente após import

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
          userId,
          id: msg.id,
          requestBody: { removeLabelIds: ['UNREAD'] },
        });
      } catch (e) {
        erros.push({ messageId: msg.id, error: `mark-as-read failed: ${e.message}` });
      }

      processados++;
    }

    return res.status(200).json({ processados, ficheiros, erros });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}
