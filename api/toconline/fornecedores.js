import { getValidToken } from './_token.js';
import { tocFetch } from './_fetch.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let accessToken;
  try {
    accessToken = await getValidToken();
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  const { page = 1 } = req.query;
  try {
    const data = await tocFetch(`/api/suppliers?page[number]=${page}&page[size]=50`, accessToken);
    const lista = Array.isArray(data) ? data : (data.data || []);
    return res.status(200).json({ data: lista, meta: data.meta || {} });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
