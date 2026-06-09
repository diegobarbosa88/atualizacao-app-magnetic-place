import { createClient } from '@supabase/supabase-js';
import { getValidToken } from './_token.js';
import { tocFetch } from './_fetch.js';

const TIPOS_VENDA = ['FT', 'FR', 'FS', 'FRS', 'NC', 'ND', 'VD', 'GT', 'GR', 'ORC', 'PROJ', 'NAFT'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const { cliente, data, linhas, tipo_documento = 'FT', serie, observacoes } = body;

  if (!cliente || !linhas?.length) {
    return res.status(400).json({ error: 'Campos obrigatórios: cliente, linhas' });
  }

  if (!TIPOS_VENDA.includes(tipo_documento)) {
    return res.status(400).json({ error: `tipo_documento inválido. Aceites: ${TIPOS_VENDA.join(', ')}` });
  }

  let accessToken;
  try {
    accessToken = await getValidToken();
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  const attrs = {
    document_type: tipo_documento,
    date: data || new Date().toISOString().slice(0, 10),
    lines: linhas.map(l => ({
      item_type: l.tipo_item || 'Service',
      description: l.descricao,
      quantity: l.quantidade ?? 1,
      unit_price: l.preco_unitario,
      tax_percentage: l.taxa_iva ?? 23,
      item_id: l.artigo_id || undefined,
      unit: l.unidade || undefined,
    })),
  };

  if (cliente.id) {
    attrs.customer_id = cliente.id;
  } else {
    attrs.customer_business_name = cliente.nome;
    attrs.customer_tax_number = cliente.nif || undefined;
  }

  if (serie) attrs.serie = serie;
  if (observacoes) attrs.notes = observacoes;

  const payload = { data: { type: 'commercial_sales_documents', attributes: attrs } };

  let tocData;
  try {
    tocData = await tocFetch('/api/v1/commercial_sales_documents', accessToken, 'POST', payload);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const docId = String(tocData.data?.id || '');
  const docAttrs = tocData.data?.attributes || {};

  if (docId) {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from('faturas').insert({
      toconline_doc_id: docId,
      fonte: 'toc',
      tipo: 'cliente',
      filename: docAttrs.document_number || `${tipo_documento}-${docId}`,
      dados: {
        numero_fatura: docAttrs.document_number || null,
        data_fatura: docAttrs.date || data || null,
        nif_fornecedor: cliente.nif || null,
        fornecedor: cliente.nome || cliente.id,
        valor_total: docAttrs.total_amount ?? null,
        iva: docAttrs.total_tax_amount ?? null,
      },
      valor: docAttrs.total_amount ?? null,
      data_documento: docAttrs.date || data || null,
      entidade: cliente.nome || null,
    });
  }

  return res.status(201).json({ doc_id: docId, documento: tocData.data });
}
