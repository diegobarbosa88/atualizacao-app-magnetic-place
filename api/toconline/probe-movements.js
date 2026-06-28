import { getValidToken } from './_token.js';
import { tocFetch } from './_fetch.js';

const CANDIDATES = [
  '/api/bank_account_transactions',
  '/api/bank_account_movements',
  '/api/bank_account_extracts',
  '/api/bank_extracts',
  '/api/bank_transactions',
  '/api/cash_flows',
  '/api/current_accounts',
  '/api/receipts',
  '/api/bank_account_statements',
  '/api/bank_statements',
];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let accessToken;
  try {
    accessToken = await getValidToken();
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  const results = [];
  for (const path of CANDIDATES) {
    try {
      const data = await tocFetch(`${path}?page[size]=1`, accessToken);
      const keys = data && typeof data === 'object'
        ? Object.keys(Array.isArray(data) ? (data[0] || {}) : (data.data?.[0]?.attributes || data.data?.[0] || data))
        : [];
      results.push({ path, status: 'OK', sample_keys: keys, total: data?.meta?.total_records ?? data?.meta?.total ?? (Array.isArray(data) ? data.length : (data?.data?.length ?? '?')) });
    } catch (e) {
      const msg = e.message || '';
      const code = msg.match(/→ (\d+)/)?.[1] || 'ERR';
      results.push({ path, status: code, error: msg.slice(0, 120) });
    }
  }

  return res.status(200).json({ results });
}
