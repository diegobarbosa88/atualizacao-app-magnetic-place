export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { texto } = req.body || {};
  if (!texto) return res.status(400).json({ error: 'Missing texto' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

  const prompt = `Analisa este texto extraído de uma fatura e devolve APENAS um JSON válido com os campos:
numero_fatura, data_fatura (formato YYYY-MM-DD ou null), nif_fornecedor (9 dígitos PT ou null), fornecedor (nome da empresa emitente), valor_total (número decimal ou null), iva (valor monetário do IVA ou null).
Se não encontrares um campo, usa null. Responde APENAS com o JSON, sem explicações.

Texto:
${texto.slice(0, 3000)}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
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
