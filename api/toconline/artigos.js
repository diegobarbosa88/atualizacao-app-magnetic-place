import { getValidToken } from './_token.js';
import { tocFetch } from './_fetch.js';

export default async function handler(req, res) {
  let accessToken;
  try {
    accessToken = await getValidToken();
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  if (req.method === 'GET') {
    const { page = 1 } = req.query;
    try {
      // Busca produtos e serviços em paralelo
      const [prodData, svcData] = await Promise.all([
        tocFetch(`/api/products?page[number]=${page}&page[size]=50`, accessToken),
        tocFetch(`/api/services?page[number]=${page}&page[size]=50`, accessToken),
      ]);
      const produtos = (Array.isArray(prodData) ? prodData : (prodData.data || [])).map(i => ({ ...i, _kind: 'product' }));
      const servicos = (Array.isArray(svcData) ? svcData : (svcData.data || [])).map(i => ({ ...i, _kind: 'service' }));
      return res.status(200).json({ data: [...servicos, ...produtos], meta: {} });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { descricao, codigo, preco_unitario, taxa_iva = 23, tipo = 'Service' } = req.body || {};
    if (!descricao) return res.status(400).json({ error: 'Campo obrigatório: descricao' });

    const endpoint = tipo === 'Product' ? '/api/products' : '/api/services';
    const payload = {
      data: {
        type: tipo === 'Product' ? 'products' : 'services',
        attributes: {
          item_code: codigo || undefined,
          item_description: descricao,
          sales_price: preco_unitario ?? undefined,
        },
      },
    };

    try {
      const data = await tocFetch(endpoint, accessToken, 'POST', payload);
      return res.status(201).json({ data: data.data });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
