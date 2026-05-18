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

function extrairDadosFatura(texto) {
  const t = texto || '';

  // Número de fatura: FT, FR, FS, RC, NC, ND seguido de série/número
  const numMatch = t.match(/\b(FT|FR|FS|RC|RG|ND|NC|VD)\s*[\s\/]?\s*([\w\d]+\/\d+)/i);
  const numero_fatura = numMatch ? `${numMatch[1]} ${numMatch[2]}`.trim() : null;

  // Data no formato DD/MM/YYYY ou DD-MM-YYYY
  const dataMatch = t.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  let data_fatura = null;
  if (dataMatch) {
    const [, d, m, y] = dataMatch;
    data_fatura = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // NIF: 9 dígitos começando por 1-9 (PT) — evita matches em datas/valores
  const nifMatches = [...t.matchAll(/\b([1-9]\d{8})\b/g)].map(m => m[1]);
  // Remove NIFs que parecem datas ou números de fatura
  const nif_fornecedor = nifMatches.find(n => !t.includes(`/${n}`) && !t.includes(`${n}/`)) || null;

  // Valor total — procura "Total" seguido de valor
  const totalMatch = t.match(/total\s*(?:a\s*pagar|com\s*iva|geral|fatura)?\s*[:\s]*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:€|eur)?/i)
    || t.match(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*€/i);
  let valor_total = null;
  if (totalMatch) {
    valor_total = parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.')) || null;
  }

  // IVA — valor monetário de IVA
  const ivaMatch = t.match(/iva\s*(?:\d+\s*%\s*)?[:\s]*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:€|eur)?/i);
  let iva = null;
  if (ivaMatch) {
    iva = parseFloat(ivaMatch[1].replace(/\./g, '').replace(',', '.')) || null;
  }

  // Fornecedor — primeira linha não vazia do texto (geralmente o nome da empresa)
  const linhas = t.split('\n').map(l => l.trim()).filter(l => l.length > 3 && !/^\d+$/.test(l));
  const fornecedor = linhas[0] || null;

  return { numero_fatura, data_fatura, nif_fornecedor, valor_total, iva, fornecedor };
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
    try { body = req.body || {}; } catch {}
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
          const filename = part.filename || `attachment_${Date.now()}.pdf`;
          const storagePath = `faturas/${msg.id}/${filename}`;

          const { error: uploadError } = await supabase.storage
            .from('faturas')
            .upload(storagePath, buffer, { contentType: part.mimeType, upsert: true });

          if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`);

          const { data: { publicUrl } } = supabase.storage
            .from('faturas')
            .getPublicUrl(storagePath);

          // Extrair dados do PDF
          let dados = null;
          let _debugTexto = null;
          if (part.mimeType === 'application/pdf') {
            try {
              const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
              const parsed = await pdfParse(buffer);
              _debugTexto = parsed.text?.slice(0, 1000);
              dados = extrairDadosFatura(parsed.text);
            } catch (e) {
              _debugTexto = `ERRO pdf-parse: ${e.message}`;
            }
          }
          if (_debugTexto) erros.push({ debug: true, filename, texto: _debugTexto });

          const { error: dbError } = await supabase.from('faturas').insert({
            gmail_message_id: msg.id,
            filename,
            storage_path: storagePath,
            url: publicUrl,
            mime_type: part.mimeType,
            tamanho: buffer.length,
            dados,
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
