import { createClient } from '@supabase/supabase-js';
import { getValidToken } from './_token.js';
import { tocFetch } from './_fetch.js';

const TIPOS_VENDA = ['FT', 'FR', 'FS', 'FRS', 'NC', 'ND', 'VD', 'GT', 'GR', 'ORC', 'PROJ', 'NAFT'];

function hojeEmPortugal() {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()).split('/').reverse().join('-');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const { cliente, data, data_vencimento, linhas, tipo_documento = 'FT', serie, observacoes, finalizar = true } = body;

  if (!cliente || !linhas?.length) {
    return res.status(400).json({ error: 'Campos obrigatórios: cliente, linhas' });
  }

  if (!TIPOS_VENDA.includes(tipo_documento)) {
    return res.status(400).json({ error: `tipo_documento inválido. Aceites: ${TIPOS_VENDA.join(', ')}` });
  }

  if (!cliente.nome && !cliente.id) {
    return res.status(400).json({ error: 'Cliente deve ter nome ou id.' });
  }

  if (cliente.nif && !/^\d{9}$/.test(String(cliente.nif).trim())) {
    return res.status(400).json({ error: 'NIF inválido — deve ter exactamente 9 dígitos numéricos.' });
  }

  const linhasValidas = linhas.filter(
    l => (Number(l.quantidade) || 0) > 0 && (Number(l.preco_unitario) || 0) > 0
  );
  if (!linhasValidas.length) {
    return res.status(400).json({ error: 'Pelo menos uma linha deve ter quantidade e preço unitário superiores a zero.' });
  }

  let accessToken;
  try {
    accessToken = await getValidToken();
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  const attrs = {
    document_type: tipo_documento,
    date: data || hojeEmPortugal(),
    finalize: finalizar ? 1 : 0,
    lines: linhasValidas.map(l => {
      const linha = {
        item_type: l.tipo_item || 'Service',
        description: l.descricao,
        quantity: Number(l.quantidade),
        unit_price: Number(l.preco_unitario),
        item_id: l.artigo_id || undefined,
        unit: l.unidade || undefined,
      };
      if (l.vat_tax_id != null) {
        linha.vat_tax_id = l.vat_tax_id;
      } else {
        linha.tax_percentage = l.taxa_iva ?? 23;
      }
      return linha;
    }),
  };

  if (cliente.id) {
    attrs.customer_id = cliente.id;
  } else {
    attrs.customer_business_name = cliente.nome;
    attrs.customer_tax_number = cliente.nif || undefined;
  }

  if (serie) attrs.serie = serie;
  if (observacoes) attrs.notes = observacoes;
  if (data_vencimento) attrs.due_date = data_vencimento;

  const payload = { data: { type: 'commercial_sales_documents', attributes: attrs } };

  let tocData;
  try {
    tocData = await tocFetch('/api/v1/commercial_sales_documents', accessToken, 'POST', payload);
  } catch (e) {
    // Erro estruturado de tocFetch: usa errors[] JSON:API quando disponível.
    const apiErrors = e.tocErrors;
    const msg = Array.isArray(apiErrors) && apiErrors.length
      ? apiErrors.map(err => err.detail || err.title || JSON.stringify(err)).join('; ')
      : e.message;
    return res.status(422).json({ error: msg });
  }

  const docId = String(tocData.data?.id || '');
  const docAttrs = tocData.data?.attributes || {};

  let warning;
  if (docId) {
    // A fatura JÁ foi emitida no TOConline. Se o espelho local falhar não
    // revertemos nem devolvemos erro — sinalizamos via warning para
    // reconciliação posterior.
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { error } = await supabase.from('faturas').insert({
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
      if (error) throw new Error(error.message);
    } catch (e) {
      console.error(`Fatura ${docId} emitida no TOConline mas falhou espelho local:`, e.message);
      warning = 'Fatura emitida no TOConline mas não foi registada localmente. Reconcilie manualmente.';
    }
  }

  return res.status(201).json({ doc_id: docId, documento: tocData.data, ...(warning ? { warning } : {}) });
}
