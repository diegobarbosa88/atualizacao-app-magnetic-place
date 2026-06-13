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
      const data = await tocFetch(`/api/customers?page[number]=${page}&page[size]=50`, accessToken);
      const lista = Array.isArray(data) ? data : (data.data || []);
      return res.status(200).json({ data: lista, meta: data.meta || {} });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { nome, nif, email, morada, codigo_postal, localidade } = req.body || {};
    if (!nome) return res.status(400).json({ error: 'Campo obrigatório: nome' });

    const payload = {
      data: {
        type: 'customers',
        attributes: {
          business_name: nome,
          tax_registration_number: nif || undefined,
          email: email || undefined,
        },
      },
    };

    try {
      const data = await tocFetch('/api/customers', accessToken, 'POST', payload);
      return res.status(201).json({ data: data.data });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
