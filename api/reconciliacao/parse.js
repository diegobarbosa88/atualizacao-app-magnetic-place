import formidable from 'formidable';
import fs from 'fs';
import { parseCsv, parseCsvColumns, parseCsvWithMapping, parseOfxContent } from './_parseUtils.js';

export const config = { api: { bodyParser: false } };

async function parsePdfWithGemini(rawBuf) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurado.');

  const prompt = `Analisa este extrato bancário em PDF e extrai TODAS as transações/movimentos.
Devolve um array JSON com cada movimento no formato exacto:
[
  { "data": "YYYY-MM-DD", "descricao": "descrição do movimento", "valor": 1234.56, "tipo": "debito" },
  ...
]
Regras:
- data: sempre YYYY-MM-DD. Converte DD/MM/YYYY ou DD-MM-YYYY → YYYY-MM-DD.
- valor: número decimal positivo. NUNCA negativo.
- tipo: "debito" para pagamentos/saídas, "credito" para depósitos/entradas.
- Inclui TODOS os movimentos visíveis, sem excepções.
- Responde APENAS com o array JSON válido, sem markdown, sem bloco de código.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'application/pdf', data: rawBuf.toString('base64') } }] }],
        generationConfig: { temperature: 0 },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini PDF error: ${await response.text()}`);

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonStr = raw.replace(/```json|```/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(jsonStr); } catch { throw new Error('Gemini não devolveu JSON válido.'); }
  if (!Array.isArray(parsed)) throw new Error('Resposta do Gemini não é um array.');

  return parsed
    .map(t => ({
      data: t.data || null,
      descricao: String(t.descricao || '').trim(),
      valor: Math.abs(parseFloat(t.valor) || 0),
      tipo: String(t.tipo || '').toLowerCase() === 'credito' ? 'credito' : 'debito',
      tipoMovimento: null,
    }))
    .filter(t => t.valor > 0);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const form = formidable({ maxFileSize: 20 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) return res.status(400).json({ error: 'Nenhum ficheiro recebido.' });

    const filename = file.originalFilename || file.newFilename || '';
    const ext = filename.split('.').pop().toLowerCase();
    const isPdf = ext === 'pdf' || file.mimetype === 'application/pdf';

    if (!['csv', 'ofx', 'qfx', 'pdf'].includes(ext)) {
      return res.status(400).json({ error: `Extensão .${ext} não suportada. Formatos aceites: .csv, .ofx, .qfx, .pdf` });
    }

    const rawBuf = fs.readFileSync(file.filepath);

    if (isPdf) {
      const transactions = await parsePdfWithGemini(rawBuf);
      return res.status(200).json({ filename, transactions });
    }

    const utfStr = rawBuf.toString('utf-8');
    const content = utfStr.includes('�') ? rawBuf.toString('latin1') : utfStr;

    // Se veio mapeamento explícito de colunas, usar directamente
    const mappingRaw = Array.isArray(fields.column_mapping) ? fields.column_mapping[0] : fields.column_mapping;
    if (mappingRaw) {
      const mapping = JSON.parse(mappingRaw);
      const transactions = parseCsvWithMapping(content, mapping);
      return res.status(200).json({ filename, transactions });
    }

    // Tentar auto-detecção
    try {
      const transactions = ext === 'csv' ? parseCsv(content) : await parseOfxContent(content);
      return res.status(200).json({ filename, transactions });
    } catch (parseErr) {
      if (parseErr.message === 'UNRECOGNIZED_COLUMNS') {
        // Devolver colunas para o utilizador mapear no frontend
        const { columns, preview } = parseCsvColumns(content);
        return res.status(200).json({ filename, needs_mapping: true, columns, preview });
      }
      throw parseErr;
    }
  } catch (err) {
    console.error('[reconciliacao/parse]', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor.' });
  }
}
