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

function encodeBase64Url(str) {
  return Buffer.from(str, 'utf-8')
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

function buildRawMessage({ to, subject, bodyText, inReplyToMessageId, fromHeader }) {
  const safeSubject = sanitizeHeaderValue(subject);
  const finalSubject = /^re:/i.test(safeSubject) ? safeSubject : `Re: ${safeSubject}`;
  const headers = [
    `To: ${sanitizeHeaderValue(to)}`,
    fromHeader ? `From: ${sanitizeHeaderValue(fromHeader)}` : null,
    `Subject: ${finalSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
  ];
  if (inReplyToMessageId) {
    headers.push(`In-Reply-To: ${sanitizeHeaderValue(inReplyToMessageId)}`);
    headers.push(`References: ${sanitizeHeaderValue(inReplyToMessageId)}`);
  }
  const message = `${headers.filter(Boolean).join('\r\n')}\r\n\r\n${bodyText}`;
  return encodeBase64Url(message);
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
 * @returns {Promise<{id: string, threadId: string}>}
 */
export async function sendGmailReply(gmail, { userId = 'me', threadId, to, subject, bodyText, inReplyToMessageId }) {
  if (!threadId) throw new Error('threadId é obrigatório para responder na thread original');
  if (!to) throw new Error('Destinatário (to) é obrigatório');

  const raw = buildRawMessage({ to, subject, bodyText, inReplyToMessageId });

  const res = await gmail.users.messages.send({
    userId,
    requestBody: { raw, threadId },
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
