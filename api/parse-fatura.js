import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from './_authUtils.js';
import { handleGerarPdfHtml } from './_gerarPdfHtml.js';

export function buildFaturaPrompt(texto, nomeFicheiro = '') {
  const pistaFicheiro = nomeFicheiro
    ? `\n- O ficheiro chama-se "${nomeFicheiro}". Muitos fornecedores põem o número da fatura no nome do ficheiro (ex: "2026-6332.pdf" → fatura 6332). Se o texto tiver um número de fatura que coincida com o do nome do ficheiro, é esse o numero_fatura; um código que se repete em todas as faturas do mesmo fornecedor é código de cliente, não número de fatura.`
    : '';
  return `És um especialista em leitura de faturas portuguesas e europeias. Analisa o texto abaixo e extrai os seguintes campos com rigor:

- numero_fatura: número/referência da fatura (ex: "FT 2024/123", "2024-456"). NÃO confundas com número de encomenda, guia ou cliente. 517379740 é o NIF da Magnetic Place (normalmente a cliente) — nunca é o numero_fatura.
- data_fatura: data de emissão da fatura em formato YYYY-MM-DD. NÃO uses a data de vencimento.
- prazo_pagamento: data de vencimento / limite de pagamento em formato YYYY-MM-DD (rótulos como "Vencimento", "Data de vencimento", "Fecha de vencimiento", "Vto.", "Due date", "Fällig"). Se o documento só indicar um prazo em dias (ex: "30 dias"), soma-o à data_fatura. Se indicar pagamento a pronto, usa a data_fatura. Se não existir, usa null.
- nif_fornecedor: identificador fiscal de quem EMITE a fatura, em qualquer formato europeu — português (NIF/NIPC, 9 dígitos numéricos), espanhol (NIF/CIF, uma letra seguida de 8 dígitos, ex: "B64076482"), ou outro. Procura rótulos como "NIF:", "NIPC:", "CIF:", "VAT:", "Tax ID:", "N.I.F.". Extrai tal como aparece no documento (sem espaços). NÃO uses o NIF do cliente/destinatário.
- fornecedor: nome legal completo da empresa que EMITE a fatura (não o cliente).
- valor_total: valor total da fatura com IVA incluído (número decimal, ex: 1234.56). É o subtotal dos bens/serviços mais o IVA. NÃO incluas encargos adicionais, imposto de selo, juros de mora, taxas de processamento nem outros acréscimos que apareçam depois do total da fatura.
- iva: valor monetário total do IVA (não a taxa percentual, mas o montante em euros).
- iban: IBAN da conta bancária do fornecedor (quem emite a fatura), se presente no documento. Formato PTXX... ou outro IBAN europeu. Se não existir, usa null.

Regras importantes:
- Se um campo não existir claramente no texto, usa null.
- Para valor_total e iva usa sempre número decimal (ex: 123.45), nunca string.
- iban deve estar em formato limpo sem espaços (ex: "PT50000201231234567890154").
- Para datas, converte formatos como "15/03/2024" ou "15 março 2024" para "2024-03-15".
- valor_total deve corresponder à linha "Total", "Total com IVA" ou "Total Fatura" — se existir uma linha separada "Total a Pagar" ou "Total Líquido a Pagar" que inclua encargos, usa o valor anterior sem encargos.
- Responde APENAS com JSON válido, sem texto antes ou depois, sem markdown.${pistaFicheiro}

Texto da fatura:
${texto.slice(0, 6000)}`;
}

// Extração com a API da Claude (Anthropic), mesma chave ANTHROPIC_API_KEY já
// usada em api/contador. Saiu do Gemini: a conta Google ficou sem créditos
// pré-pagos (HTTP 402). Modelo configurável por env var (ANTHROPIC_MODEL).
const IA_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

// Chama a IA com um prompt já montado e devolve o JSON parseado.
// Reutilizável por qualquer chamador que precise de extrair campos estruturados
// de texto (faturas normais, emails do contador, etc.).
export async function callIAJSON(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

  let response;
  try {
    const anthropic = new Anthropic({ apiKey });
    response = await anthropic.messages.create({
      model: IA_MODEL,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (e) {
    console.error(`[ia] ${IA_MODEL} HTTP ${e.status ?? '?'}: ${String(e.message).slice(0, 500)}`);
    throw new Error(`Claude API error${e.status ? ` (${e.status})` : ''}: ${e.message}`);
  }

  const raw = response.content.find(b => b.type === 'text')?.text || '';
  const jsonStr = raw.replace(/```json|```/g, '').trim();

  try {
    return { data: JSON.parse(jsonStr), raw: null };
  } catch {
    // Texto à volta do JSON ("Aqui está o JSON: {...}") — tenta só o bloco.
    const bloco = jsonStr.match(/[[{][\s\S]*[\]}]/);
    try {
      if (bloco) return { data: JSON.parse(bloco[0]), raw: null };
    } catch { /* cai no raw abaixo */ }
    return { data: null, raw };
  }
}

export default async function handler(req, res) {
  // Fluxo 3 (documentos HTML assinados) — ver api/_gerarPdfHtml.js. Faz a
  // sua própria verificação de sessão de admin, por isso fica antes do
  // requireAuth abaixo (early return, sem duplicar a verificação).
  if (req.query.action === 'gerar-pdf-html') {
    return handleGerarPdfHtml(req, res);
  }

  if (!requireAuth(req, res, ['admin'])) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { texto, nomeFicheiro } = req.body || {};
  if (!texto) return res.status(400).json({ error: 'Missing texto' });

  try {
    const { data, raw } = await callIAJSON(buildFaturaPrompt(texto, nomeFicheiro));
    return res.status(200).json(data ?? { raw });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
