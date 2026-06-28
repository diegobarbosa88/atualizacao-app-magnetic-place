import { getValidToken } from './_token.js';
import { tocFetch, fetchAllPages } from './_fetch.js';

export default async function handler(req, res) {
  let accessToken;
  try {
    accessToken = await getValidToken();
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  if (req.method === 'GET') {
    const { id, probe } = req.query;

    // Probe temporário: ?probe=1 — descobrir endpoints de movimentos
    if (probe === '1') {
      const CANDIDATES = [
        '/api/bank_account_transactions',
        '/api/bank_account_movements',
        '/api/bank_account_extracts',
        '/api/bank_extracts',
        '/api/bank_transactions',
        '/api/cash_flows',
        '/api/current_accounts',
        '/api/bank_account_statements',
        '/api/bank_statements',
      ];
      const results = [];
      for (const path of CANDIDATES) {
        try {
          const data = await tocFetch(`${path}?page[size]=1`, accessToken);
          const item = Array.isArray(data) ? data[0] : (data.data?.[0]?.attributes || data.data?.[0] || data);
          results.push({ path, status: 'OK', sample_keys: item ? Object.keys(item) : [], total: data?.meta?.total_records ?? data?.meta?.total ?? '?' });
        } catch (e) {
          const code = (e.message || '').match(/→ (\d+)/)?.[1] || 'ERR';
          results.push({ path, status: code });
        }
      }
      return res.status(200).json({ results });
    }

    try {
      if (id) {
        const data = await tocFetch(`/api/bank_accounts/${id}`, accessToken);
        return res.status(200).json({ data: data.data || data });
      }
      const lista = await fetchAllPages('/api/bank_accounts', accessToken);
      return res.status(200).json({ data: lista });
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
