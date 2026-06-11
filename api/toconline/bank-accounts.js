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
    const { id } = req.query;
    const path = id ? `/api/bank_accounts/${id}` : '/api/bank_accounts';
    try {
      const data = await tocFetch(path, accessToken);
      if (id) return res.status(200).json({ data: data.data || data });
      const lista = Array.isArray(data) ? data : (data.data || []);
      return res.status(200).json({ data: lista, meta: data.meta || {} });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { nome, iban, banco, moeda = 'EUR', saldo_inicial = 0 } = req.body || {};
    if (!nome) return res.status(400).json({ error: 'Campo obrigatório: nome' });

    const payload = {
      data: {
        type: 'bank_accounts',
        attributes: {
          name: nome,
          iban: iban || undefined,
          description: banco || undefined,
          initial_balance: saldo_inicial,
        },
      },
    };

    try {
      const data = await tocFetch('/api/bank_accounts', accessToken, 'POST', payload);
      return res.status(201).json({ data: data.data });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Parâmetro obrigatório: id' });
    try {
      await tocFetch(`/api/bank_accounts/${id}`, accessToken, 'DELETE');
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
