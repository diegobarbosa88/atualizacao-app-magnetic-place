import formidable from 'formidable';
import fs from 'fs';
import { parseCsv, parseOfxContent } from './parseUtils.js';

export const config = { api: { bodyParser: false } };

async function parseWithGemini(content, mimeType, rawBuf) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurado.');

  const prompt = `Analisa este extrato bancário e extrai TODAS as transações/movimentos.
Devolve um array JSON com cada movimento no formato exacto:
[
  { "data": "YYYY-MM-DD", "descricao": "descrição do movimento", "valor": 1234.56, "tipo": "debito" },
  ...
]

Regras:
- data: sempre YYYY-MM-DD. Converte DD/MM/YYYY ou DD-MM-YYYY → YYYY-MM-DD.
- valor: número decimal positivo (ex: 1234.56). NUNCA negativo.
- tipo: "debito" para pagamentos/saídas/levantamentos, "credito" para depósitos/entradas/transferências recebidas.
- descricao: texto do movimento tal como aparece no extrato.
- Inclui TODOS os movimentos visíveis, sem excepções.
- Responde APENAS com o array JSON válido, sem texto antes ou depois, sem markdown, sem bloco de código.`;

  const parts = [{ text: prompt }];
  if (mimeType === 'application/pdf' && rawBuf) {
    parts.push({ inlineData: { mimeType: 'application/pdf', data: rawBuf.toString('base64') } });
  } else {
    // CSV/texto — envia como texto inline
    parts.push({ text: `\n\nConteúdo do ficheiro:\n${content.slice(0, 30000)}` });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini PDF error: ${err}`);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonStr = raw.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Gemini não devolveu JSON válido para o PDF.');
  }

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
    const form = formidable({ maxFileSize: 20 * 1024 * 1024 }); // 20 MB para PDFs
    const [, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) return res.status(400).json({ error: 'Nenhum ficheiro recebido.' });

    const filename = file.originalFilename || file.newFilename || '';
    const ext = filename.split('.').pop().toLowerCase();
    const isPdf = ext === 'pdf' || file.mimetype === 'application/pdf';

    if (!['csv', 'ofx', 'qfx', 'pdf'].includes(ext)) {
      return res.status(400).json({ error: `Extensão .${ext} não suportada. Formatos aceites: .csv, .ofx, .qfx, .pdf` });
    }

    const rawBuf = fs.readFileSync(file.filepath);
    let transactions;

    if (isPdf) {
      transactions = await parseWithGemini(null, 'application/pdf', rawBuf);
    } else {
      const utfStr = rawBuf.toString('utf-8');
      const content = utfStr.includes('�') ? rawBuf.toString('latin1') : utfStr;
      try {
        transactions = ext === 'csv' ? parseCsv(content) : await parseOfxContent(content);
      } catch (parseErr) {
        if (parseErr.message === 'UNRECOGNIZED_COLUMNS') {
          // Fallback: tentar interpretar com Gemini
          transactions = await parseWithGemini(content, 'text/csv', null);
        } else {
          throw parseErr;
        }
      }
    }

    return res.status(200).json({ filename, transactions });
  } catch (err) {
    console.error('[reconciliacao/parse]', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor.' });
  }
}
