import { getValidToken } from './_token.js';
import { tocFetch, obterUrlPdf } from './_fetch.js';

const ENDPOINTS = {
  venda: '/api/v1/commercial_sales_documents',
  compra: '/api/v1/commercial_purchases_documents',
  recibo: '/api/v1/commercial_sales_receipts',
};

export default async function handler(req, res) {
  let accessToken;
  try {
    accessToken = await getValidToken();
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  const { id, tipo = 'venda' } = req.method === 'GET' ? req.query : (req.body || {});

  if (!id) return res.status(400).json({ error: 'Parâmetro obrigatório: id' });

  const base = ENDPOINTS[tipo];
  if (!base) return res.status(400).json({ error: `Tipo inválido: ${tipo}. Use venda, compra ou recibo.` });

  if (req.method === 'GET') {
    try {
      const data = await tocFetch(`${base}/${id}`, accessToken);
      const pdfUrl = await obterUrlPdf(id, tipo, accessToken);
      return res.status(200).json({ data: data.data || data, pdf_url: pdfUrl });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      // TOConline usa POST para anular documentos
      const data = await tocFetch(`${base}/${id}/cancel`, accessToken, 'POST');
      return res.status(200).json({ anulado: true, data: data.data || data });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
