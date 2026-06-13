import { getValidToken } from './_token.js';
import { tocFetch } from './_fetch.js';

const ENDPOINTS = {
  vendas: '/v1/commercial_sales_documents',
  compras: '/v1/commercial_purchases_documents',
  recibos: '/v1/commercial_sales_receipts',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let accessToken;
  try {
    accessToken = await getValidToken();
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  const { tipo = 'vendas', data_de, data_ate, page = 1 } = req.query;
  const base = ENDPOINTS[tipo];
  if (!base) return res.status(400).json({ error: `Tipo inválido: ${tipo}. Use vendas, compras ou recibos.` });

  const TABLE_PREFIX = { vendas: 'documents', compras: 'purchases_documents', recibos: 'receipts' };
  const pref = TABLE_PREFIX[tipo];

  try {
    const filtros = [`page[number]=${page}`, `page[size]=50`];
    if (data_de && data_ate) {
      filtros.push(`filter=${encodeURIComponent(`"${pref}.date>='${data_de}' AND ${pref}.date<='${data_ate}'"`)}`);
    } else if (data_de) {
      filtros.push(`filter=${encodeURIComponent(`"${pref}.date>='${data_de}'"`)}`);
    } else if (data_ate) {
      filtros.push(`filter=${encodeURIComponent(`"${pref}.date<='${data_ate}'"`)}`);
    }

    const data = await tocFetch(`${base}?${filtros.join('&')}`, accessToken);
    const lista = Array.isArray(data) ? data : (data.data || []);
    return res.status(200).json({ data: lista, meta: data.meta || {} });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
