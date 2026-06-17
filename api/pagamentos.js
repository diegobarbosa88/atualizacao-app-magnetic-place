import { createClient } from '@supabase/supabase-js';
import { gerarSEPAXml } from './salarios/_sepaXml.js';

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  const { action } = req.query;
  const db = supabase();

  if (action === 'listar') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const { status, mes } = req.query;
    let query = db.from('pagamentos_fornecedores').select('*').order('data_pagamento', { ascending: false });
    if (status) query = query.eq('status', status);
    if (mes) {
      const [ano, m] = mes.split('-');
      const inicio = `${ano}-${m}-01`;
      const fim = new Date(Number(ano), Number(m), 0).toISOString().slice(0, 10);
      query = query.gte('data_pagamento', inicio).lte('data_pagamento', fim);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: data || [] });
  }

  if (action === 'criar') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { fornecedor_nome, fornecedor_iban, fornecedor_nif, valor, referencia, data_pagamento } = req.body || {};
    if (!fornecedor_nome || !fornecedor_iban || !valor || !data_pagamento) {
      return res.status(400).json({ error: 'Campos obrigatórios: fornecedor_nome, fornecedor_iban, valor, data_pagamento' });
    }
    const ibanLimpo = String(fornecedor_iban).replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,}$/.test(ibanLimpo)) {
      return res.status(400).json({ error: 'IBAN inválido' });
    }
    const { data, error } = await db
      .from('pagamentos_fornecedores')
      .insert({
        fornecedor_nome,
        fornecedor_iban: ibanLimpo,
        fornecedor_nif: fornecedor_nif || null,
        valor: Number(valor),
        referencia: referencia || null,
        data_pagamento,
        status: 'pendente',
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data });
  }

  if (action === 'exportar-sepa') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids obrigatório' });
    }
    const { data: pagamentos, error } = await db
      .from('pagamentos_fornecedores')
      .select('*')
      .in('id', ids)
      .eq('status', 'pendente');
    if (error) return res.status(500).json({ error: error.message });
    if (!pagamentos || pagamentos.length === 0) {
      return res.status(404).json({ error: 'Nenhum pagamento pendente encontrado para os IDs fornecidos' });
    }

    const trabalhadores = pagamentos.map(p => ({
      nome: p.fornecedor_nome,
      iban: p.fornecedor_iban,
      salario: p.valor,
      mes: new Date(p.data_pagamento).toLocaleString('pt-PT', { month: 'long' }),
      ano: new Date(p.data_pagamento).getFullYear().toString(),
      descritivo: p.referencia || `Pagamento ${p.fornecedor_nome}`,
    }));

    try {
      const xmlStr = gerarSEPAXml(trabalhadores, { instant: false, ctgyPurp: 'SUPP' });
      const msgId = `PAG-${Date.now()}`;
      await db
        .from('pagamentos_fornecedores')
        .update({ status: 'exportado', sepa_msg_id: msgId })
        .in('id', ids);

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="pagamentos_fornecedores.xml"`);
      return res.status(200).send(xmlStr);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'marcar-enviado') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids obrigatório' });
    }
    const { error } = await db
      .from('pagamentos_fornecedores')
      .update({ status: 'enviado', enviado_em: new Date().toISOString() })
      .in('id', ids);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  if (action === 'apagar') {
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id obrigatório' });
    const { error } = await db
      .from('pagamentos_fornecedores')
      .delete()
      .eq('id', id)
      .eq('status', 'pendente');
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: `Acção desconhecida: ${action || '(não definida)'}` });
}
