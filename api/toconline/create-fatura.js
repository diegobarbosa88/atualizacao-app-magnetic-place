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
  const {
    cliente,
    data,
    data_vencimento,
    linhas,
    tipo_documento = 'FT',
    serie,
    observacoes,
    finalizar = true,
    // Novos campos
    desconto_global,       // settlement_expression no cabeçalho (ex: "10" ou "3+5")
    metodo_pagamento,      // payment_mechanism (MO, TR, MB, CC, DC, CH, DDA, OU)
    referencia_externa,    // external_reference
    iva_incluido,          // vat_included_prices (bool)
    retencao,              // { percentagem, tipo: 'IRS'|'IRC', ao_pagar: bool }
    moeda,                 // { iso: 'USD', taxa: 1.08 }
    morada_cliente,        // { detalhe, codigo_postal, cidade, pais }
  } = body;

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
      // Desconto por linha (ex: "10" = 10%, "3+5" = composto)
      if (l.desconto?.trim()) linha.settlement_expression = l.desconto.trim();
      // Código do artigo
      if (l.codigo_artigo?.trim()) linha.item_code = l.codigo_artigo.trim();
      return linha;
    }),
  };

  // Cliente
  if (cliente.id) {
    attrs.customer_id = cliente.id;
  } else {
    attrs.customer_business_name = cliente.nome;
    attrs.customer_tax_number = cliente.nif || undefined;
  }

  // Série
  if (serie) attrs.document_series_prefix = serie;

  // Observações
  if (observacoes) attrs.notes = observacoes;

  // Vencimento
  if (data_vencimento) attrs.due_date = data_vencimento;

  // Desconto global no cabeçalho
  if (desconto_global?.trim()) attrs.settlement_expression = desconto_global.trim();

  // Método de pagamento
  if (metodo_pagamento) attrs.payment_mechanism = metodo_pagamento;

  // Referência externa
  if (referencia_externa?.trim()) attrs.external_reference = referencia_externa.trim();

  // Preços com IVA incluído
  if (iva_incluido) attrs.vat_included_prices = true;

  // Retenção na fonte
  if (retencao?.percentagem > 0) {
    attrs.retention = Number(retencao.percentagem);
    attrs.retention_type = retencao.tipo || 'IRS';
    if (retencao.ao_pagar != null) attrs.apply_retention_when_paid = Boolean(retencao.ao_pagar);
  }

  // Moeda (apenas se diferente de EUR)
  if (moeda?.iso && moeda.iso.toUpperCase() !== 'EUR') {
    attrs.currency_iso_code = moeda.iso.toUpperCase();
    if (moeda.taxa) attrs.currency_conversion_rate = Number(moeda.taxa);
  }

  // Morada do cliente
  if (morada_cliente?.detalhe) attrs.customer_address_detail = morada_cliente.detalhe;
  if (morada_cliente?.codigo_postal) attrs.customer_postcode = morada_cliente.codigo_postal;
  if (morada_cliente?.cidade) attrs.customer_city = morada_cliente.cidade;
  if (morada_cliente?.pais) attrs.customer_country = morada_cliente.pais;

  const payload = { data: { type: 'commercial_sales_documents', attributes: attrs } };

  let tocData;
  try {
    tocData = await tocFetch('/api/v1/commercial_sales_documents', accessToken, 'POST', payload);
  } catch (e) {
    let msg = e.message;
    try {
      const match = msg.match(/\d{3}: (.+)$/s);
      if (match) {
        const parsed = JSON.parse(match[1]);
        const apiErrors = parsed?.errors;
        if (Array.isArray(apiErrors) && apiErrors.length) {
          msg = apiErrors.map(err => err.detail || err.title || JSON.stringify(err)).join('; ');
        }
      }
    } catch { /* manter msg original */ }
    return res.status(422).json({ error: msg });
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
