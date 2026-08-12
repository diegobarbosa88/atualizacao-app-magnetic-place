import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { sendGmailReply, getMessageReplyContext } from './gmail/_sendGmailReply.js';

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function gmailClient() {
  const auth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth });
}

// Aprova (envia de facto, via Gmail API, na thread original) ou rejeita um
// rascunho de resposta ao contador. NUNCA envia sem esta chamada explícita —
// é o único ponto do fluxo que efetivamente comunica com o exterior.
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { resposta_id, action, confirmado_por, rascunho_final } = req.body || {};
    if (!resposta_id) return res.status(400).json({ error: 'resposta_id é obrigatório' });
    if (!['aprovar', 'rejeitar'].includes(action)) return res.status(400).json({ error: 'action deve ser "aprovar" ou "rejeitar"' });
    if (!confirmado_por) return res.status(400).json({ error: 'confirmado_por é obrigatório — nunca envio sem identidade registada' });

    const missingEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
      .concat(action === 'aprovar' ? ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'] : [])
      .filter(k => !process.env[k]);
    if (missingEnv.length) {
      return res.status(500).json({ error: `Env vars em falta: ${missingEnv.join(', ')}` });
    }

    const supabase = supabaseAdmin();

    const { data: resposta, error: fetchError } = await supabase
      .from('respostas_contador_pendentes')
      .select('*, emails_contador(id, gmail_message_id, remetente, assunto)')
      .eq('id', resposta_id)
      .single();

    if (fetchError || !resposta) {
      return res.status(404).json({ error: `Resposta não encontrada: ${fetchError?.message || resposta_id}` });
    }

    if (resposta.status !== 'pendente') {
      return res.status(409).json({ error: `Esta resposta já foi ${resposta.status} — não pode ser reprocessada` });
    }

    const rascunhoFinal = (rascunho_final ?? resposta.rascunho).trim();
    const foiEditado = rascunhoFinal !== resposta.rascunho.trim();

    if (action === 'rejeitar') {
      const { error: updateError } = await supabase
        .from('respostas_contador_pendentes')
        .update({ status: 'rejeitado', confirmado_por, resolved_at: new Date().toISOString(), rascunho: rascunhoFinal, editado_manualmente: foiEditado })
        .eq('id', resposta_id);
      if (updateError) return res.status(500).json({ error: `Erro ao registar rejeição: ${updateError.message}` });

      await supabase.from('emails_contador').update({ status: 'rejeitado' }).eq('id', resposta.emails_contador.id);

      return res.status(200).json({ sucesso: true, status: 'rejeitado' });
    }

    // action === 'aprovar' — envio real, ponto sem retorno
    const emailContador = resposta.emails_contador;
    if (!emailContador?.remetente) {
      return res.status(500).json({ error: 'Email do contador associado não tem remetente registado — não é possível responder' });
    }

    let sendResult;
    try {
      const gmail = gmailClient();
      const replyContext = await getMessageReplyContext(gmail, { gmailMessageId: emailContador.gmail_message_id });
      sendResult = await sendGmailReply(gmail, {
        threadId: resposta.gmail_thread_id || replyContext.threadId,
        to: emailContador.remetente,
        subject: emailContador.assunto,
        bodyText: rascunhoFinal,
        inReplyToMessageId: replyContext.messageIdHeader,
      });
    } catch (e) {
      return res.status(502).json({ error: `Falha ao enviar via Gmail: ${e.message}` });
    }

    const { error: updateError } = await supabase
      .from('respostas_contador_pendentes')
      .update({
        status: 'enviado',
        confirmado_por,
        resolved_at: new Date().toISOString(),
        rascunho: rascunhoFinal,
        editado_manualmente: foiEditado,
      })
      .eq('id', resposta_id);

    if (updateError) {
      // O email já foi enviado — não podemos "desfazer" isto, mas reportamos o erro
      // explicitamente em vez de fingir que o registo de auditoria ficou consistente.
      return res.status(500).json({
        error: `Email enviado com sucesso (gmail_message_id: ${sendResult.id}), mas falhou registar o estado: ${updateError.message}`,
        enviado: true,
        gmail_message_id: sendResult.id,
      });
    }

    await supabase.from('emails_contador').update({ status: 'enviado' }).eq('id', emailContador.id);

    return res.status(200).json({ sucesso: true, status: 'enviado', gmail_message_id: sendResult.id });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}
