export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

  // GET /api/parse-fatura → lista modelos disponíveis (diagnóstico)
  if (req.method === 'GET') {
    const r = await fetch('https://generativelanguage.googleapis.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const d = await r.json();
    return res.status(r.status).json(d);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { texto } = req.body || {};
  if (!texto) return res.status(400).json({ error: 'Missing texto' });

  const prompt = `És um especialista em leitura de faturas portuguesas e europeias. Analisa o texto abaixo e extrai os seguintes campos com rigor:

- numero_fatura: número/referência da fatura (ex: "FT 2024/123", "2024-456"). NÃO confundas com número de encomenda, guia ou cliente.
- data_fatura: data de emissão da fatura em formato YYYY-MM-DD. NÃO uses a data de vencimento.
- nif_fornecedor: NIF/NIPC de quem EMITE a fatura (9 dígitos numéricos, sem espaços). NÃO uses o NIF do cliente/destinatário.
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
- Responde APENAS com JSON válido, sem texto antes ou depois, sem markdown.

Texto da fatura:
${texto.slice(0, 6000)}`;

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    return res.status(response.status).json({ error: err });
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonStr = raw.replace(/```json|```/g, '').trim();

  try {
    return res.status(200).json(JSON.parse(jsonStr));
  } catch {
    return res.status(200).json({ raw });
  }
}
