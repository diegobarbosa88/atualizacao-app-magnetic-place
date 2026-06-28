import { getValidToken } from './_token.js';
import { tocFetch, fetchAllPages } from './_fetch.js';

// Busca o saldo atual de uma conta pelo imported_balance do movimento mais recente.
// Fallback: initial_balance se não houver movimentos.
async function getSaldoAtual(contaId, initialBalance, accessToken) {
  try {
    const data = await tocFetch(
      `/api/bank_transactions?filter[bank_account_id]=${contaId}&page[size]=1&sort=-transaction_date`,
      accessToken
    );
    const items = Array.isArray(data) ? data : (data.data || []);
    if (items.length === 0) return initialBalance ?? 0;
    const attrs = items[0].attributes || items[0];
    const bal = attrs.imported_balance ?? attrs.value ?? null;
    return bal != null ? Number(bal) : (initialBalance ?? 0);
  } catch {
    return initialBalance ?? 0;
  }
}

export default async function handler(req, res) {
  let accessToken;
  try {
    accessToken = await getValidToken();
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  if (req.method === 'GET') {
    const { id, probe, com_saldo } = req.query;

    // Diagnóstico temporário
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
        const conta = data.data || data;
        if (com_saldo === '1') {
          const a = conta.attributes || conta;
          const saldo_atual = await getSaldoAtual(conta.id || id, a.initial_balance, accessToken);
          return res.status(200).json({ data: { ...conta, saldo_atual } });
        }
        return res.status(200).json({ data: conta });
      }

      const lista = await fetchAllPages('/api/bank_accounts', accessToken);

      // ?debug_types=1 — mostra distribuição de entity_type e sub_type para afinar filtro
      if (req.query.debug_types === '1') {
        const tipos = {};
        const subtipos = {};
        lista.forEach(c => {
          const a = c.attributes || c;
          const t = a.entity_type || '(vazio)';
          const s = a.sub_type || '(vazio)';
          tipos[t] = (tipos[t] || 0) + 1;
          subtipos[s] = (subtipos[s] || 0) + 1;
        });
        // Mostra também as primeiras 5 contas com SWIFT para identificar as contas reais
        const comSwift = lista
          .filter(c => { const a = c.attributes || c; return a.swift; })
          .slice(0, 8)
          .map(c => { const a = c.attributes || c; return { id: c.id, name: a.name, entity_type: a.entity_type, sub_type: a.sub_type, swift: a.swift, iban: a.iban }; });
        return res.status(200).json({ entity_types: tipos, sub_types: subtipos, contas_com_swift: comSwift, total: lista.length });
      }

      // Filtrar apenas contas com identificador bancário (IBAN, NIB ou SWIFT)
      const contasBancarias = lista.filter(c => {
        const a = c.attributes || c;
        return a.iban || a.nib || a.swift;
      });

      // ?com_saldo=1 — enriquecer cada conta com o saldo atual via movimentos
      if (com_saldo === '1') {
        const enriquecida = await Promise.all(contasBancarias.map(async (c) => {
          const a = c.attributes || c;
          const saldo_atual = await getSaldoAtual(c.id, a.initial_balance, accessToken);
          return { ...c, saldo_atual };
        }));
        return res.status(200).json({ data: enriquecida });
      }

      return res.status(200).json({ data: contasBancarias });
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
