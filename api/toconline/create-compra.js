import { getValidToken } from './_token.js';
import { tocFetch } from './_fetch.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { fornecedor, data, linhas, referencia, observacoes } = req.body || {};

  // Validação básica
  if (!fornecedor || (!fornecedor.id && !fornecedor.nome)) {
    return res.status(400).json({ error: 'Fornecedor obrigatório' });
  }
  if (!linhas || linhas.length === 0) {
    return res.status(400).json({ error: 'Pelo menos uma linha é obrigatória' });
  }

  let token;
  try {
    token = await getValidToken();
  } catch (e) {
    return res.status(401).json({ error: 'TOConline não está ligado: ' + e.message });
  }

  try {
    // 1. Criar cabeçalho do documento
    const cabecalhoAttrs = {
      date: data || new Date().toISOString().slice(0, 10),
    };

    if (fornecedor.id) {
      cabecalhoAttrs.supplier_id = fornecedor.id;
    } else {
      cabecalhoAttrs.supplier_business_name = fornecedor.nome;
      if (fornecedor.nif) cabecalhoAttrs.supplier_tax_registration_number = fornecedor.nif;
    }

    if (referencia) cabecalhoAttrs.notes = referencia;
    if (observacoes) cabecalhoAttrs.description = observacoes;

    const cabecalhoPayload = {
      data: {
        type: 'commercial_purchases_documents',
        attributes: cabecalhoAttrs,
      },
    };

    let cabecalhoData;
    try {
      cabecalhoData = await tocFetch('/api/v1/commercial_purchases_documents', token, 'POST', cabecalhoPayload);
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

    const docId = cabecalhoData.data?.id;
    if (!docId) return res.status(500).json({ error: 'Documento criado mas sem ID na resposta' });

    // 2. Adicionar linhas
    for (const linha of linhas) {
      if (!linha.descricao && !linha.item_id) continue;
      const linhaAttrs = {
        commercial_purchases_document_id: docId,
        description: linha.descricao || '',
        quantity: Number(linha.quantidade) || 1,
        unit_price: Number(linha.preco_unitario) || 0,
      };

      if (linha.item_id) linhaAttrs.item_id = linha.item_id;
      if (linha.unidade) linhaAttrs.unit = linha.unidade;
      if (linha.taxa_iva != null) linhaAttrs.tax_percentage = Number(linha.taxa_iva);

      const linhaPayload = {
        data: {
          type: 'commercial_purchases_document_lines',
          attributes: linhaAttrs,
        },
      };

      try {
        await tocFetch('/api/v1/commercial_purchases_document_lines/', token, 'POST', linhaPayload);
      } catch (err) {
        console.warn('[create-compra] linha falhou:', err.message);
      }
    }

    // 3. Buscar documento actualizado
    let docData;
    try {
      docData = await tocFetch(`/api/v1/commercial_purchases_documents/${docId}`, token);
    } catch (err) {
      console.warn('[create-compra] erro ao buscar documento actualizado:', err.message);
      docData = cabecalhoData;
    }

    return res.status(201).json({ doc_id: docId, documento: docData.data || docData });
  } catch (err) {
    console.error('[create-compra] erro:', err);
    return res.status(500).json({ error: err.message });
  }
}
