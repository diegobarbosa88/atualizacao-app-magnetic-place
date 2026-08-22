import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { callGeminiJSON } from '../parse-fatura.js';
import { requireAuth } from '../_authUtils.js';

// Import dinâmico: evita que uma falha de inicialização do pdf-parse
// (que ocorre no Vercel ao carregar ficheiros de teste) quebre o modo faturas.
async function getParser() {
  return import('./_parseComprovativo.js');
}

const ALLOWED_MIME_TYPES = ['application/pdf', 'application/xml', 'text/xml'];
const ZIP_MIME_TYPES = ['application/zip', 'application/x-zip-compressed'];
const FATURAS_QUERY = 'is:unread has:attachment {subject:fatura subject:invoice subject:FT}';
const APOLICE_QUERY = 'from:88diegobarbosa@gmail.com';
const MAX_RESULTS = 50;

// Deteção por mimetype OU extensão do filename — muitos remetentes (ex:
// novobanco) etiquetam .zip como 'application/octet-stream' em vez do
// mimetype correto, por isso o mimetype sozinho não é fiável (mesmo padrão
// de fallback por extensão já usado em findContadorAttachmentParts, abaixo).
function findAttachmentParts(parts = []) {
  const found = [];
  for (const part of parts) {
    const isZip = ZIP_MIME_TYPES.includes(part.mimeType) || part.filename?.toLowerCase().endsWith('.zip');
    const isAllowed = ALLOWED_MIME_TYPES.includes(part.mimeType);
    if ((isZip || isAllowed) && part.body?.attachmentId) {
      found.push({ ...part, isZip });
    }
    if (part.parts) found.push(...findAttachmentParts(part.parts));
  }
  return found;
}

function sanitizeFilename(name) {
  return name.trim().replace(/[_\s]+$/, '').replace(/[^a-zA-Z0-9.\-_()]/g, '_');
}

// Upload + insert partilhado por anexos PDF/XML diretos e por PDFs extraídos
// de dentro de um .zip — mesma lógica em ambos os casos, para nunca divergir
// silenciosamente. O índice único (gmail_message_id, filename) na tabela
// `faturas` é o que garante a deduplicação: um re-import do mesmo anexo (ou
// da mesma entrada dentro do mesmo zip) simplesmente ignora o erro de
// duplicado abaixo.
async function guardarFaturaAnexo(supabase, { gmailMessageId, buffer, filename, mimeType, storagePath }) {
  const { error: uploadError } = await supabase.storage
    .from('faturas')
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`);

  const { data: { publicUrl } } = supabase.storage.from('faturas').getPublicUrl(storagePath);

  const { error: dbError } = await supabase.from('faturas').insert({
    gmail_message_id: gmailMessageId,
    filename,
    storage_path: storagePath,
    url: publicUrl,
    mime_type: mimeType,
    tamanho: buffer.length,
  });

  if (dbError && !dbError.message.includes('duplicate')) {
    throw new Error(`DB insert: ${dbError.message}`);
  }
}

// Mesmo padrão de api/contador/index.js (verificarAutorizacaoCron): permite
// chamadas server-a-server autenticadas por CRON_SECRET, sem sessão de
// utilizador. Usado pelo agente WhatsApp "Trabalhador Virtual" (repo
// CONSELHEIRO-ESTRATEGICO) para disparar a importação da apólice sob pedido.
// Restrito só ao modo apolice_seguros — os outros modos continuam a exigir
// sessão admin (requireAuth), para não alargar o alcance do secret.
function autorizadoPorSecret(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers['authorization'] === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    let body = {};
    try { body = req.body || {}; } catch (_) { /* ok */ }
    const modeAntesAuth = body.mode || 'faturas';

    // CR-07: x-import-secret substituído por sessão assinada — o "secret"
    // vivia em VITE_GMAIL_IMPORT_SECRET, exposto no bundle do frontend a
    // qualquer visitante (mesma família de falha do share_token do CR-06).
    const viaSecret = modeAntesAuth === 'apolice_seguros' && autorizadoPorSecret(req);
    if (!viaSecret && !requireAuth(req, res, ['admin'])) return;

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

    // mode: 'faturas' (default) | 'comprovativos' | 'contador' | 'apolice_seguros' | 'all'
    const mode = modeAntesAuth;
    const userId = 'me';

    if (mode === 'contador') {
      if (!body.fornecedorId) {
        return res.status(400).json({ error: 'fornecedorId é obrigatório no modo contador' });
      }
      const parser = await getParser();
      const result = await importarContador(gmail, supabase, userId, body.query, body.fornecedorId, parser);
      return res.status(200).json(result);
    }

    if (mode === 'apolice_seguros') {
      const parser = await getParser();
      const result = await importarApoliceSeguros(gmail, supabase, userId, body.query, parser);
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

  let processados = 0, ficheiros = 0, restantes = 0;
  const erros = [];

  // Orçamento de tempo: um zip com várias faturas multiplica o trabalho por
  // mensagem (download + expansão + N uploads + N inserts), e maxDuration
  // está limitado a 60s (vercel.json) — o mesmo padrão já usado em
  // importarContador. A verificação só acontece ENTRE mensagens, nunca a
  // meio dos anexos de uma mensagem: um zip é sempre expandido e processado
  // por inteiro (todas as entradas) antes de decidir parar, para nunca
  // deixar ficheiros a meio. A mensagem só é marcada como lida no fim do seu
  // próprio processamento, por isso se o corte acontecer antes de a
  // alcançar, ela continua "unread" e é retomada na próxima execução — os
  // anexos já importados (mesmos desta mensagem ou de outras) não duplicam,
  // graças ao índice único (gmail_message_id, filename).
  const inicioExecucao = Date.now();
  const ORCAMENTO_MS = 45_000;

  const mensagens = listRes.data.messages || [];
  for (let i = 0; i < mensagens.length; i++) {
    const msg = mensagens[i];

    if (Date.now() - inicioExecucao > ORCAMENTO_MS) {
      restantes = mensagens.length - i;
      break;
    }

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

        if (part.isZip) {
          const rawZipName = part.filename || `anexo_${Date.now()}.zip`;
          const zipBaseName = sanitizeFilename(rawZipName.replace(/\.zip$/i, '')) || `anexo_${Date.now()}`;

          const zip = await JSZip.loadAsync(buffer);
          const entradasPdf = Object.values(zip.files).filter(
            (entry) => !entry.dir && /\.pdf$/i.test(entry.name)
          );

          for (const entry of entradasPdf) {
            try {
              const pdfBuffer = await entry.async('nodebuffer');
              const entryBaseName = sanitizeFilename(entry.name.split('/').pop() || `documento_${Date.now()}.pdf`) || `documento_${Date.now()}.pdf`;
              // Prefixo com o nome do zip: garante um filename estável e
              // único mesmo quando dois zips diferentes têm PDFs com o
              // mesmo nome interno (ex: "fatura.pdf" em ambos).
              const filename = `${zipBaseName}__${entryBaseName}`;
              const storagePath = `faturas/${msg.id}/${zipBaseName}/${entryBaseName}`;

              await guardarFaturaAnexo(supabase, {
                gmailMessageId: msg.id,
                buffer: pdfBuffer,
                filename,
                mimeType: 'application/pdf',
                storagePath,
              });

              ficheiros++;
            } catch (e) {
              erros.push({ messageId: msg.id, filename: `${part.filename || 'zip'} > ${entry.name}`, error: e.message });
            }
          }
          continue;
        }

        const filename = sanitizeFilename(part.filename || `attachment_${Date.now()}.pdf`) || `attachment_${Date.now()}.pdf`;
        const storagePath = `faturas/${msg.id}/${filename}`;

        await guardarFaturaAnexo(supabase, {
          gmailMessageId: msg.id,
          buffer,
          filename,
          mimeType: part.mimeType,
          storagePath,
        });

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

  return {
    processados, ficheiros, erros,
    ...(restantes > 0 ? {
      restantes,
      aviso: `Limite de tempo atingido — ${restantes} email(s) por processar. Clica em "Importar do Gmail" outra vez para continuar (os já processados não são repetidos).`,
    } : {}),
  };
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

// ---------------------------------------------------------------------------
// Modo "apolice_seguros": email da Allianz com o "Quadro de Pessoal Seguro"
// → tabela apolice_seguro_importacoes, comparado automaticamente contra
// worker_apolice_seguro via RPC comparar_apolice_seguros (só comparação,
// não escreve nada em workers/worker_apolice_seguro — revisão humana
// continua a ser feita pelo Diego a partir da pendência discrepancias_apolice).
// ---------------------------------------------------------------------------
function buildApoliceSegurosPrompt(texto) {
  return `Este é o texto extraído de uma apólice de seguros de Acidentes de Trabalho (Allianz
Portugal). Extrai APENAS a lista de trabalhadores segurados da secção "Quadro de
Pessoal Seguro". Cada trabalhador aparece como um bloco que começa com "Nome:" e
continua com outros campos (Profissão, Retribuição, etc.) até ao próximo "Nome:" ou
ao fim da secção (que termina antes de "Coberturas").

Devolve APENAS um array JSON, sem texto adicional, no formato:
[{"nome": "NOME COMPLETO EM MAIÚSCULAS"}, ...]

Não incluas o Tomador do Seguro (a empresa) na lista — só os trabalhadores
individuais listados no Quadro de Pessoal Seguro. Não inventes NIFs; este
documento não os contém, por isso omite esse campo.

Texto do documento:
${texto.slice(0, 20000)}`;
}

async function importarApoliceSeguros(gmail, supabase, userId, queryOverride, parser) {
  const { findPdfParts, extractPdfText } = parser;
  const query = queryOverride?.trim() || APOLICE_QUERY;
  let listRes;
  try {
    listRes = await gmail.users.messages.list({ userId, q: query, maxResults: MAX_RESULTS });
  } catch (e) {
    return { error: `Gmail list failed: ${e.message}` };
  }

  const { data: existingRows } = await supabase
    .from('apolice_seguro_importacoes')
    .select('gmail_message_id');
  const importedIds = new Set((existingRows || []).map(r => r.gmail_message_id));

  let processados = 0, skipped = 0, restantes = 0;
  const erros = [];

  console.log(`[apolice] ${listRes.data.messages?.length || 0} mensagem(ns) encontradas, ${importedIds.size} já importadas.`);

  // Orçamento de tempo (mesmo padrão de importarFaturas/importarContador,
  // abaixo) — sem isto, uma caixa com muitas mensagens já importadas
  // excedia os 60s de maxDuration (vercel.json) e a chamada do agente
  // WhatsApp expirava em timeout antes de sequer chegar à mensagem nova.
  const inicioExecucao = Date.now();
  const ORCAMENTO_MS = 45_000;
  const mensagens = listRes.data.messages || [];

  for (let i = 0; i < mensagens.length; i++) {
    const msg = mensagens[i];

    if (Date.now() - inicioExecucao > ORCAMENTO_MS) {
      restantes = mensagens.length - i;
      break;
    }

    if (importedIds.has(msg.id)) {
      // Já importada — não vale a pena gastar um round-trip à Gmail API só
      // para tentar remover UNREAD de novo (idempotente e, na prática, já
      // deve estar lida de uma execução anterior).
      skipped++;
      continue;
    }

    const t0 = Date.now();
    console.log(`[apolice] a processar ${msg.id}...`);
    try {
      const full = await gmail.users.messages.get({ userId, id: msg.id, format: 'full' });
      console.log(`[apolice] ${msg.id} gmail.get: ${Date.now() - t0}ms`);
      const payload = full.data.payload;
      const headers = payload?.headers || [];
      const from = headers.find(h => h.name === 'From')?.value || '';
      const internalDate = full.data.internalDate ? new Date(Number(full.data.internalDate)).toISOString() : null;

      const pdfParts = findPdfParts(payload?.parts || []);
      if (pdfParts.length === 0) {
        erros.push({ messageId: msg.id, error: 'Sem anexo PDF nesta mensagem.' });
        await gmail.users.messages.modify({ userId, id: msg.id, requestBody: { removeLabelIds: ['UNREAD'] } });
        continue;
      }

      const part = pdfParts[0];
      const attRes = await gmail.users.messages.attachments.get({
        userId, messageId: msg.id, id: part.body.attachmentId,
      });
      const buffer = Buffer.from(attRes.data.data, 'base64url');
      console.log(`[apolice] ${msg.id} attachment (${(buffer.length / 1024).toFixed(0)}KB): ${Date.now() - t0}ms`);
      const filename = (part.filename || `apolice_${Date.now()}.pdf`).replace(/[^a-zA-Z0-9.\-_()]/g, '_');
      const storagePath = `apolice-seguros/${msg.id}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from('faturas')
        .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });
      if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`);
      console.log(`[apolice] ${msg.id} storage upload: ${Date.now() - t0}ms`);

      const textoExtraido = await extractPdfText(buffer);
      console.log(`[apolice] ${msg.id} extractPdfText (${textoExtraido.length} chars): ${Date.now() - t0}ms`);
      const { data: dadosExtraidos } = await callGeminiJSON(buildApoliceSegurosPrompt(textoExtraido));
      console.log(`[apolice] ${msg.id} callGeminiJSON: ${Date.now() - t0}ms`);

      const { data: inserted, error: dbError } = await supabase
        .from('apolice_seguro_importacoes')
        .insert({
          gmail_message_id: msg.id,
          remetente: from,
          recebido_em: internalDate,
          anexo_path: storagePath,
          dados_extraidos: dadosExtraidos,
          // A tabela tem CHECK (status IN ('pendente','processado','erro')) —
          // 'importado' violava sempre a constraint, e como o erro não
          // contém a palavra "duplicate" (era ignorado só nesse caso), o
          // insert falhava silenciosamente TODAS as vezes: nada ficava
          // gravado, e cada nova chamada reprocessava as mesmas mensagens
          // do zero (é o que causava o timeout de 60s no agente WhatsApp).
          status: 'pendente',
        })
        .select('id')
        .single();

      if (dbError) {
        if (!dbError.message.includes('duplicate')) throw new Error(`DB insert: ${dbError.message}`);
      } else {
        // Só comparação, não escreve em workers/worker_apolice_seguro — pode
        // correr automaticamente, sem espera por revisão humana.
        const { data: discrepancias, error: cmpError } = await supabase
          .rpc('comparar_apolice_seguros', { p_dados_extraidos: dadosExtraidos });

        const patch = { processado_em: new Date().toISOString() };
        if (!cmpError) {
          patch.discrepancias = discrepancias;
          patch.status = 'processado';
        } else {
          erros.push({ messageId: msg.id, error: `comparar_apolice_seguros: ${cmpError.message}` });
        }

        await supabase.from('apolice_seguro_importacoes').update(patch).eq('id', inserted.id);
      }

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
    processados, skipped, erros,
    ...(restantes > 0 ? {
      restantes,
      aviso: `Limite de tempo atingido — ${restantes} email(s) por processar. Chama outra vez para continuar.`,
    } : {}),
  };
}
