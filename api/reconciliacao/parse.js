import formidable from 'formidable';
import fs from 'fs';
import { parseCsv, parseOfxContent } from './parseUtils.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) return res.status(400).json({ error: 'Nenhum ficheiro recebido.' });

    const filename = file.originalFilename || file.newFilename || '';
    const ext = filename.split('.').pop().toLowerCase();

    if (ext === 'pdf' || file.mimetype === 'application/pdf') {
      return res.status(400).json({ error: 'Formato não suportado. Apenas CSV e OFX são aceites.' });
    }
    if (!['csv', 'ofx', 'qfx'].includes(ext)) {
      return res.status(400).json({ error: `Extensão .${ext} não suportada. Formatos aceites: .csv, .ofx, .qfx` });
    }

    const rawBuf = fs.readFileSync(file.filepath);
    const utfStr = rawBuf.toString('utf-8');
    const content = utfStr.includes('�') ? rawBuf.toString('latin1') : utfStr;

    let transactions;
    try {
      transactions = ext === 'csv' ? parseCsv(content) : await parseOfxContent(content);
    } catch (parseErr) {
      if (parseErr.message === 'UNRECOGNIZED_COLUMNS') {
        return res.status(400).json({
          error: 'Colunas do CSV não reconhecidas. Esperado: Data, Valor (ou Débito/Crédito), Descrição.',
          detected: parseErr.detected,
        });
      }
      throw parseErr;
    }

    return res.status(200).json({ filename, transactions });
  } catch (err) {
    console.error('[reconciliacao/parse]', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor.' });
  }
}
