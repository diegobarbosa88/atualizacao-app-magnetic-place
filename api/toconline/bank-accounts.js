import { getValidToken } from './_token.js';
import { tocFetch, fetchAllPages } from './_fetch.js';

async function getSaldoAtual(contaId, initialBalance, accessToken) {
  try {
    const data = await tocFetch(
      `/api/bank_transactions?filter[bank_account_id]=${contaId}&page[size]=1&sort=-transaction_date`,
      accessToken
    );
    const items = Array.isArray(data) ? data : (data.data || []);
    if (items.length === 0) return initialBalance ?? 0;
    const attrs = items[0].attributes || items[0];
    const bal = attrs.imported_balance ?? null;
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
    const { id, com_saldo, movimentos, page = 1, probe_rh } = req.query;

    // Probe endpoints de RH/vencimentos
    if (probe_rh === '1') {
      const CANDIDATES = [
        '/api/payrolls', '/api/payroll_documents', '/api/salary_receipts',
        '/api/employee_receipts', '/api/vencimentos', '/api/employees',
        '/api/receipts', '/api/salary_slips', '/api/payslips',
        '/api/rh_documents', '/api/worker_receipts',
        '/v1/payrolls', '/v1/employees', '/v1/salary_receipts',
      ];
      const results = [];
      for (const path of CANDIDATES) {
        try {
          const data = await tocFetch(`${path}?page[size]=1`, accessToken);
          const item = Array.isArray(data) ? data[0] : (data.data?.[0]?.attributes || data.data?.[0] || data);
          results.push({ path, status: 'OK', keys: item ? Object.keys(item).slice(0, 8) : [] });
        } catch (e) {
          const code = (e.message || '').match(/→ (\d+)/)?.[1] || 'ERR';
          results.push({ path, status: code });
        }
      }
      return res.status(200).json({ results });
    }

    // ?movimentos=1&id=X — lista movimentos de uma conta
    if (movimentos === '1' && id) {
      try {
        const data = await tocFetch(
          `/api/bank_transactions?filter[bank_account_id]=${id}&page[number]=${page}&page[size]=30&sort=-transaction_date`,
          accessToken
        );
        const items = Array.isArray(data) ? data : (data.data || []);
        return res.status(200).json({ data: items, meta: data.meta || {} });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
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

      // Apenas contas da empresa (entity_type === 'Company')
      const contasBancarias = lista.filter(c => {
        const a = c.attributes || c;
        return a.entity_type === 'Company';
      });

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

  return res.status(405).json({ error: 'Method not allowed' });
}
