// Envio de reply dentro de uma thread Gmail existente.
// Não existe precedente disto no código (o resto do projeto só LÊ Gmail,
// nunca envia) — implementado de raiz seguindo a Gmail API oficial:
// https://developers.google.com/gmail/api/guides/sending
//
// Uma reply "correta" (aparece na mesma thread no cliente de email do
// destinatário, não só no Gmail) precisa de:
//   - threadId do Gmail no requestBody de messages.send
//   - headers RFC 2822 In-Reply-To / References a apontar para o
//     Message-ID original (cabeçalho de email, distinto do id do Gmail)
//   - Subject com prefixo "Re: " (se ainda não tiver)

function encodeBase64UrlBuffer(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Escapa quebras de linha / caracteres de controlo em valores de header
// para prevenir header injection a partir de dados vindos do email original
// (assunto/remetente) ou do rascunho gerado por IA.
function sanitizeHeaderValue(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

// Quebra uma string base64 em linhas de 76 caracteres, como exige a RFC 2045
// para Content-Transfer-Encoding: base64.
function wrapBase64(str) {
  return str.replace(/.{1,76}/g, '$&\r\n').trim();
}

// Headers de email são ASCII-only por norma (RFC 2822/5322) — assuntos em
// português com acentos ("Faturas em falta — Março") precisam de ser
// codificados conforme RFC 2047, senão ficam corrompidos (mojibake) em
// clientes/servidores mais estritos. Confirmado ao vivo: sem isto, um
// assunto com "—" e acentos chegava ilegível mesmo dentro do próprio Gmail.
function encodeRfc2047(str) {
  if (/^[\x00-\x7F]*$/.test(str)) return str;
  return `=?UTF-8?B?${Buffer.from(str, 'utf-8').toString('base64')}?=`;
}

/**
 * Constrói a mensagem RFC 2822 em bruto (antes do base64url final exigido
 * pela Gmail API). Sem anexos: text/plain simples, como sempre foi. Com
 * anexos: multipart/mixed — uma parte de texto + uma parte base64 por
 * ficheiro, cada uma com Content-Disposition: attachment.
 */
function buildRawMessage({ to, subject, bodyText, inReplyToMessageId, fromHeader, attachments = [], isReply = true }) {
  const safeSubject = sanitizeHeaderValue(subject);
  const finalSubject = encodeRfc2047(
    isReply ? (/^re:/i.test(safeSubject) ? safeSubject : `Re: ${safeSubject}`) : safeSubject
  );
  const baseHeaders = [
    `To: ${sanitizeHeaderValue(to)}`,
    fromHeader ? `From: ${sanitizeHeaderValue(fromHeader)}` : null,
    `Subject: ${finalSubject}`,
    'MIME-Version: 1.0',
  ].filter(Boolean);
  if (inReplyToMessageId) {
    baseHeaders.push(`In-Reply-To: ${sanitizeHeaderValue(inReplyToMessageId)}`);
    baseHeaders.push(`References: ${sanitizeHeaderValue(inReplyToMessageId)}`);
  }

  if (!attachments || attachments.length === 0) {
    const headers = [...baseHeaders, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: 7bit'];
    const message = `${headers.join('\r\n')}\r\n\r\n${bodyText}`;
    return encodeBase64UrlBuffer(Buffer.from(message, 'utf-8'));
  }

  const boundary = `----magnetic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    bodyText,
    '',
  ];
  for (const att of attachments) {
    const safeFilename = sanitizeHeaderValue(att.filename || 'anexo').replace(/"/g, "'");
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${safeFilename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${safeFilename}"`,
      '',
      wrapBase64(att.content.toString('base64')),
      '',
    );
  }
  parts.push(`--${boundary}--`);

  const headers = [...baseHeaders, `Content-Type: multipart/mixed; boundary="${boundary}"`];
  const message = `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
  return encodeBase64UrlBuffer(Buffer.from(message, 'utf-8'));
}

/**
 * Envia uma reply dentro de uma thread Gmail existente.
 * @param {import('googleapis').gmail_v1.Gmail} gmail
 * @param {object} params
 * @param {string} params.userId - normalmente 'me'
 * @param {string} params.threadId - thread do Gmail a responder
 * @param {string} params.to - endereço do destinatário original (remetente do email recebido)
 * @param {string} params.subject - assunto original (será prefixado com "Re: " se necessário)
 * @param {string} params.bodyText - corpo da resposta (texto simples)
 * @param {string} [params.inReplyToMessageId] - cabeçalho Message-ID do email original
 * @param {Array<{filename: string, mimeType: string, content: Buffer}>} [params.attachments] - ficheiros a anexar
 * @returns {Promise<{id: string, threadId: string}>}
 */
export async function sendGmailReply(gmail, { userId = 'me', threadId, to, subject, bodyText, inReplyToMessageId, attachments }) {
  if (!threadId) throw new Error('threadId é obrigatório para responder na thread original');
  if (!to) throw new Error('Destinatário (to) é obrigatório');

  const raw = buildRawMessage({ to, subject, bodyText, inReplyToMessageId, attachments });

  const res = await gmail.users.messages.send({
    userId,
    requestBody: { raw, threadId },
  });

  return { id: res.data.id, threadId: res.data.threadId };
}

/**
 * Envia uma mensagem nova, sem thread de origem — usado para emails
 * proativos (ex: envio mensal ao contador) que não respondem a nada
 * recebido. Sem In-Reply-To/References e sem prefixo "Re: " no assunto.
 * @param {import('googleapis').gmail_v1.Gmail} gmail
 * @param {object} params
 * @param {string} params.to
 * @param {string} params.subject
 * @param {string} params.bodyText
 * @param {Array<{filename: string, mimeType: string, content: Buffer}>} [params.attachments]
 * @returns {Promise<{id: string, threadId: string}>}
 */
export async function sendGmailNewMessage(gmail, { userId = 'me', to, subject, bodyText, attachments }) {
  if (!to) throw new Error('Destinatário (to) é obrigatório');
  if (!subject) throw new Error('Assunto (subject) é obrigatório');

  const raw = buildRawMessage({ to, subject, bodyText, attachments, isReply: false });

  const res = await gmail.users.messages.send({
    userId,
    requestBody: { raw },
  });

  return { id: res.data.id, threadId: res.data.threadId };
}

/**
 * Busca o cabeçalho Message-ID e o threadId de uma mensagem Gmail já importada,
 * necessários para construir a reply (In-Reply-To/References + threadId).
 */
export async function getMessageReplyContext(gmail, { userId = 'me', gmailMessageId }) {
  const full = await gmail.users.messages.get({ userId, id: gmailMessageId, format: 'metadata', metadataHeaders: ['Message-ID', 'Subject', 'From'] });
  const headers = full.data.payload?.headers || [];
  const messageIdHeader = headers.find(h => h.name === 'Message-ID' || h.name === 'Message-Id')?.value || null;
  const subject = headers.find(h => h.name === 'Subject')?.value || '';
  const from = headers.find(h => h.name === 'From')?.value || '';
  return {
    threadId: full.data.threadId,
    messageIdHeader,
    subject,
    from,
  };
}
