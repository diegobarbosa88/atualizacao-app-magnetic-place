import { getValidToken } from './_token.js';
import { tocFetch, fetchAllPages } from './_fetch.js';

const API_URL = process.env.TOCONLINE_API_URL || 'https://api12.toconline.pt';

async function testarUrlPdf(docId, filterType, accessToken) {
  try {
    const url = `${API_URL}/api/url_for_print/${docId}?filter[type]=${filterType}&filter[copies]=1`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/json',
      },
    });
    const status = res.status;
    let body = null;
    try { body = await res.json(); } catch { body = await res.text(); }
    return { url, status, ok: res.ok, body };
  } catch (e) {
    return { error: e.message };
  }
}

export default async function handler(req, res) {
  // Variáveis de ambiente
  const env = {
    CLIENT_ID: process.env.TOCONLINE_CLIENT_ID ? '✓' : '✗ ausente',
    CLIENT_SECRET: process.env.TOCONLINE_CLIENT_SECRET ? '✓' : '✗ ausente',
    API_URL: process.env.TOCONLINE_API_URL || '(default: https://api12.toconline.pt)',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '✓' : '✗ ausente',
  };

  let accessToken;
  try {
    accessToken = await getValidToken();
  } catch (e) {
    return res.status(200).json({ env, token: `✗ erro: ${e.message}` });
  }

  const result = { env, token: '✓ válido' };

  // Buscar 2 documentos de compra
  try {
    const data = await tocFetch('/v1/commercial_purchases_documents?page[number]=1&page[size]=2', accessToken);
    const lista = Array.isArray(data) ? data : (data.data || []);
    result.compras_raw_count = lista.length;
    result.compras_meta = data.meta || null;

    if (lista.length > 0) {
      const doc = lista[0];
      result.doc_id = doc.id;
      result.doc_type = doc.type;
      result.doc_attributes = doc.attributes || '(sem attributes — resposta pode ser flat)';
      result.doc_raw = doc; // objeto completo para ver a estrutura

      // Testar PDF URL com diferentes filter[type]
      const docId = doc.id;
      result.pdf_testes = {};
      for (const filterType of ['Document', 'PurchasesDocument', 'Purchase', 'Bill']) {
        result.pdf_testes[filterType] = await testarUrlPdf(docId, filterType, accessToken);
      }

      // Simular dadosFallback
      const a = doc.attributes || doc; // se flat, usar o próprio doc
      result.dadosFallback_simulado = {
        numero_fatura: a.document_no || a.document_number || a.number || null,
        data_fatura: a.date || null,
        nif_fornecedor: a.supplier_tax_registration_number || a.supplier_tax_number || null,
        fornecedor: a.supplier_business_name || a.supplier_name || null,
        valor_total: a.gross_total ?? a.total_amount ?? null,
        iva: a.tax_payable ?? a.total_tax_amount ?? null,
      };
    }
  } catch (e) {
    result.compras_erro = e.message;
  }

  // Buscar 2 documentos de venda para comparar
  try {
    const data = await tocFetch('/v1/commercial_sales_documents?page[number]=1&page[size]=2', accessToken);
    const lista = Array.isArray(data) ? data : (data.data || []);
    if (lista.length > 0) {
      const doc = lista[0];
      result.venda_doc_id = doc.id;
      result.venda_doc_attributes = doc.attributes || '(sem attributes)';
      result.venda_pdf_teste = await testarUrlPdf(doc.id, 'Document', accessToken);
    }
  } catch (e) {
    result.vendas_erro = e.message;
  }

  // Contas bancárias — ver estrutura completa
  try {
    const data = await tocFetch('/api/bank_accounts', accessToken);
    const lista = Array.isArray(data) ? data : (data.data || []);
    result.bank_accounts_count = lista.length;
    if (lista.length > 0) {
      result.bank_account_raw = lista[0];
      result.bank_account_all_keys = Object.keys(lista[0]);
      const a = lista[0].attributes || lista[0];
      result.bank_account_attributes_keys = Object.keys(a);
    }
  } catch (e) {
    result.bank_accounts_erro = e.message;
  }

  return res.status(200).json(result);
}
