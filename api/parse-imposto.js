export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { texto } = req.body || {};
  if (!texto) return res.status(400).json({ error: 'Missing texto' });

  const prompt = `És um especialista em documentos fiscais portugueses (guias de pagamento, notas de liquidação). Analisa o texto abaixo e extrai os seguintes campos:

- tipo: tipo de imposto. Um dos seguintes: "IRC", "IVA", "IRS", "SS" ou "Outro". Deteta pela referência ao imposto no documento.
- periodo: período de referência do imposto, ex: "2026-06", "Q2-2026", "2025" (ano). Se for mensal usa YYYY-MM, trimestral usa QN-YYYY, anual usa YYYY.
- valor: valor total a pagar (número decimal, ex: 1234.56). Procura "Total a pagar", "Valor a liquidar" ou similar.
- data_vencimento: data limite de pagamento em formato YYYY-MM-DD. Procura "Data limite", "Prazo de pagamento", "Vencimento".
- referencia: referência de pagamento (Multibanco ou documento). Pode ser "Entidade: XXXXX Referência: XXXXXXXXX" ou um número de documento.
- iban_destino: IBAN do beneficiário (Estado, AT, SS). Formato PT50XXXX... Se não existir usa null.
- descricao: breve descrição do documento, ex: "IVA Mensal Jun 2026".

Regras:
- Se um campo não existir claramente, usa null.
- Para valor usa sempre número decimal (ex: 123.45), nunca string.
- Responde APENAS com JSON válido, sem texto antes ou depois, sem markdown.

Texto do documento:
${texto.slice(0, 6000)}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
