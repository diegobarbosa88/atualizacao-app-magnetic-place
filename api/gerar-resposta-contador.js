import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { getMessageReplyContext } from './gmail/_sendGmailReply.js';

const VALOR_TOLERANCIA = 0.01;

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function gmailClient() {
  const auth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth });
}

// Cruza os dados extraídos do email do contador com o que já está registado
// em faturas / pagamentos_fornecedores — reutiliza o mesmo padrão de matching
// por NIF (texto) já usado no resto do sistema (api/pagamentos/index.js).
// NÃO resolve o FK fraco fatura↔fornecedor existente — só consulta o que já lá está.
export async function cruzarComRegistos(supabase, contadorNif, dadosExtraidos) {
  const numeroFatura = dadosExtraidos?.numero_fatura || null;
  const valor = dadosExtraidos?.valor != null ? Number(dadosExtraidos.valor) : null;

  const { data: faturasMatch } = await supabase
    .from('faturas')
    .select('id, dados')
    .eq('dados->>nif_fornecedor', contadorNif);

  let matchedFatura = null;
  if (faturasMatch?.length) {
    if (numeroFatura) {
      matchedFatura = faturasMatch.find(f => f.dados?.numero_fatura && String(f.dados.numero_fatura).trim() === String(numeroFatura).trim());
    }
    if (!matchedFatura && valor != null) {
      matchedFatura = faturasMatch.find(f => f.dados?.valor_total != null && Math.abs(Number(f.dados.valor_total) - valor) < VALOR_TOLERANCIA);
    }
  }

  const { data: pagamentosMatch } = await supabase
    .from('pagamentos_fornecedores')
    .select('id, valor, referencia, status')
    .eq('fornecedor_nif', contadorNif)
    .in('status', ['enviado', 'confirmado']);

  let matchedPagamento = null;
  if (pagamentosMatch?.length) {
    if (numeroFatura) {
      matchedPagamento = pagamentosMatch.find(p => p.referencia && String(p.referencia).trim() === String(numeroFatura).trim());
    }
    if (!matchedPagamento && valor != null) {
      matchedPagamento = pagamentosMatch.find(p => p.valor != null && Math.abs(Number(p.valor) - valor) < VALOR_TOLERANCIA);
    }
  }

  let situacao;
  let valorRegistado = null;
  if (matchedPagamento && (valor == null || Math.abs(Number(matchedPagamento.valor) - valor) < VALOR_TOLERANCIA)) {
    situacao = 'pago';
    valorRegistado = matchedPagamento.valor;
  } else if (matchedFatura && valor != null && matchedFatura.dados?.valor_total != null && Math.abs(Number(matchedFatura.dados.valor_total) - valor) >= VALOR_TOLERANCIA) {
    situacao = 'divergencia';
    valorRegistado = matchedFatura.dados.valor_total;
  } else if (matchedFatura || matchedPagamento) {
    // Existe registo, mas sem confirmação segura de pagamento com o valor exato —
    // trata-se com a mesma cautela do caso "sem registo" (nunca afirmar pagamento sem correspondência clara)
    situacao = 'sem_registo';
  } else {
    situacao = 'sem_registo';
  }

  return { situacao, valorRegistado, matchedFatura, matchedPagamento };
}

export function buildRespostaPrompt({ situacao, dadosExtraidos, valorRegistado, assunto, nomeEmpresaContador }) {
  const numeroFatura = dadosExtraidos?.numero_fatura || 'não indicado';
  const valor = dadosExtraidos?.valor != null ? `${Number(dadosExtraidos.valor).toFixed(2)} €` : 'não indicado';
  const mesRef = dadosExtraidos?.mes_referencia || 'não indicado';

  const instrucaoSituacao = {
    pago: `A fatura/cobrança JÁ ESTÁ registada como paga no nosso sistema (valor confirmado: ${valorRegistado != null ? Number(valorRegistado).toFixed(2) + ' €' : valor}). Confirma a receção deste email e confirma explicitamente que o pagamento já foi efetuado. Não peças mais informação.`,
    divergencia: `Há uma DIVERGÊNCIA DE VALOR entre o que está a ser cobrado (${valor}) e o que temos registado (${valorRegistado != null ? Number(valorRegistado).toFixed(2) + ' €' : 'valor diferente'}). Aponta a divergência de forma clara e direta, pedindo esclarecimento sobre a diferença, sem acusar nem especular sobre a causa.`,
    sem_registo: `NÃO há registo desta fatura/cobrança no nosso sistema. Confirma a receção do email e informa que vai ser verificado internamente. NÃO prometas um prazo específico de resposta ou pagamento.`,
  }[situacao];

  return `Atua como assistente administrativo da Magnetic Place Unipessoal, Lda a responder por email ao contador/contabilista da empresa.

CONTEXTO DO EMAIL RECEBIDO:
- Assunto: ${assunto || '(sem assunto)'}
- Número de fatura/referência indicado: ${numeroFatura}
- Valor cobrado: ${valor}
- Mês de referência: ${mesRef}

SITUAÇÃO APURADA (verificada no nosso sistema, não é para ti verificar novamente):
${instrucaoSituacao}

REGRAS DE ESCRITA:
- Português de Portugal, tom profissional e cordial, mas direto — sem floreados.
- Não repitas o assunto no corpo do email.
- Não inventes números de registo, datas de pagamento ou prazos que não te foram dados.
- Termina com uma saudação simples, sem assinatura completa (a assinatura é adicionada depois manualmente).
- Escreve APENAS o corpo do email de resposta, sem "Assunto:", sem markdown, sem comentários sobre a tua resposta.`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const missingEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN']
      .filter(k => !process.env[k]);
    if (missingEnv.length) {
      return res.status(500).json({ error: `Env vars em falta: ${missingEnv.join(', ')}` });
    }

    const { email_contador_id } = req.body || {};
    if (!email_contador_id) return res.status(400).json({ error: 'email_contador_id é obrigatório' });

    const supabase = supabaseAdmin();

    const { data: emailContador, error: fetchError } = await supabase
      .from('emails_contador')
      .select('*, fornecedores(nome, nif)')
      .eq('id', email_contador_id)
      .single();

    if (fetchError || !emailContador) {
      return res.status(404).json({ error: `Email do contador não encontrado: ${fetchError?.message || email_contador_id}` });
    }

    const contadorNif = emailContador.fornecedores?.nif;
    if (!contadorNif) {
      return res.status(500).json({ error: 'Fornecedor "contador" associado não tem NIF definido — não é possível cruzar com faturas/pagamentos' });
    }

    // Busca threadId + Message-ID original via Gmail (necessário para a reply, feito aqui
    // e não guardado em emails_contador para manter o schema tal como definido)
    let replyContext;
    try {
      const gmail = gmailClient();
      replyContext = await getMessageReplyContext(gmail, { gmailMessageId: emailContador.gmail_message_id });
    } catch (e) {
      return res.status(502).json({ error: `Falha ao obter contexto da thread Gmail: ${e.message}` });
    }

    const { situacao, valorRegistado } = await cruzarComRegistos(supabase, contadorNif, emailContador.dados_extraidos);

    const prompt = buildRespostaPrompt({
      situacao,
      dadosExtraidos: emailContador.dados_extraidos,
      valorRegistado,
      assunto: emailContador.assunto,
      nomeEmpresaContador: emailContador.fornecedores?.nome,
    });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    let rascunho;
    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        thinking: { type: 'adaptive' },
        messages: [{ role: 'user', content: prompt }],
      });
      const textBlock = response.content.find(b => b.type === 'text');
      rascunho = textBlock?.text?.trim();
    } catch (e) {
      return res.status(502).json({ error: `Falha ao gerar rascunho com a API da Anthropic: ${e.message}` });
    }

    if (!rascunho) {
      return res.status(502).json({ error: 'A API da Anthropic não devolveu texto de resposta' });
    }

    const { data: resposta, error: insertError } = await supabase
      .from('respostas_contador_pendentes')
      .insert({
        email_contador_id,
        rascunho,
        editado_manualmente: false,
        status: 'pendente',
        gmail_thread_id: replyContext.threadId,
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: `Erro ao guardar rascunho: ${insertError.message}` });
    }

    const { error: updateError } = await supabase
      .from('emails_contador')
      .update({ status: 'rascunho_gerado' })
      .eq('id', email_contador_id);

    if (updateError) {
      return res.status(500).json({ error: `Rascunho guardado, mas falhou atualizar status do email: ${updateError.message}` });
    }

    return res.status(200).json({ resposta_id: resposta.id, rascunho, situacao });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}
