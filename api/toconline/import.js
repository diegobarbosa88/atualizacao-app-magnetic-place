import { createClient } from '@supabase/supabase-js';
import { getValidToken } from './_token.js';
import { tocFetch, fetchAllPages, obterUrlPdf } from './_fetch.js';

async function descarregarGuardarExtrairPdf(docId, filename, tipoDoc, accessToken, supabase) {
  const pdfUrl = await obterUrlPdf(docId, tipoDoc, accessToken);
  if (!pdfUrl) return {};

  try {
    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) return {};

    const buffer = Buffer.from(await pdfRes.arrayBuffer());
    const storagePath = `faturas/toc/${docId}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('faturas')
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });

    if (uploadError) return {};

    const { data: { publicUrl } } = supabase.storage.from('faturas').getPublicUrl(storagePath);

    let texto = '';
    try {
      const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
      const parsed = await pdfParse(buffer);
      texto = parsed.text || '';
    } catch { /* PDF sem texto extraível */ }

    return { storage_path: storagePath, url: publicUrl, mime_type: 'application/pdf', tamanho: buffer.length, texto };
  } catch {
    return {};
  }
}

async function extrairDadosComGemini(texto) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !texto) return null;

  const prompt = `És um especialista em leitura de faturas portuguesas e europeias. Analisa o texto abaixo e extrai os seguintes campos com rigor:

- numero_fatura: número/referência da fatura (ex: "FT 2024/123", "2024-456"). NÃO confundas com número de encomenda, guia ou cliente.
- data_fatura: data de emissão da fatura em formato YYYY-MM-DD. NÃO uses a data de vencimento.
- nif_fornecedor: NIF/NIPC de quem EMITE a fatura (9 dígitos numéricos, sem espaços). NÃO uses o NIF do cliente/destinatário.
- fornecedor: nome legal completo da empresa que EMITE a fatura (não o cliente).
- valor_total: valor total da fatura com IVA incluído (número decimal, ex: 1234.56). É o subtotal dos bens/serviços mais o IVA. NÃO incluas encargos adicionais, imposto de selo, juros de mora, taxas de processamento nem outros acréscimos que apareçam depois do total da fatura.
- iva: valor monetário total do IVA (não a taxa percentual, mas o montante em euros).

Regras importantes:
- Se um campo não existir claramente no texto, usa null.
- Para valor_total e iva usa sempre número decimal (ex: 123.45), nunca string.
- Para datas, converte formatos como "15/03/2024" ou "15 março 2024" para "2024-03-15".
- valor_total deve corresponder à linha "Total", "Total com IVA" ou "Total Fatura".
- Responde APENAS com JSON válido, sem texto antes ou depois, sem markdown.

Texto da fatura:
${texto.slice(0, 6000)}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonStr = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function dadosFallback(a, tipo) {
  if (tipo === 'fornecedor') {
    return {
      numero_fatura: a.document_number || null,
      data_fatura: a.date || null,
      nif_fornecedor: a.supplier_tax_number || null,
      fornecedor: a.supplier_name || a.supplier_business_name || null,
      valor_total: a.total_amount ?? a.total_value ?? null,
      iva: a.total_tax_amount ?? a.total_tax ?? null,
    };
  }
  return {
    numero_fatura: a.document_number || null,
    data_fatura: a.date || null,
    nif_fornecedor: a.customer_tax_number || null,
    fornecedor: a.customer_name || a.customer_business_name || null,
    valor_total: a.received_value ?? a.total_amount ?? a.total_value ?? null,
    iva: tipo === 'recibo' ? null : (a.total_tax_amount ?? a.total_tax ?? null),
  };
}

async function mapDoc(doc, tipo, accessToken, supabase) {
  const a = doc.attributes || {};
  const prefixo = tipo === 'fornecedor' ? 'FC' : tipo === 'recibo' ? 'RC' : 'FT';
  const filename = (a.document_number || `${prefixo}-${doc.id}`).replace(/[^a-zA-Z0-9.\-_()\/]/g, '_');

  const { storage_path, url, mime_type, tamanho, texto } = await descarregarGuardarExtrairPdf(
    doc.id, filename, tipo, accessToken, supabase
  );

  // Usa texto do PDF se disponível; caso contrário usa atributos estruturados como texto
  const textoParaGemini = texto || Object.entries(a)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n');

  const dados = (await extrairDadosComGemini(textoParaGemini)) || dadosFallback(a, tipo);

  return {
    toconline_doc_id: String(doc.id),
    fonte: 'toc',
    tipo,
    filename,
    storage_path: storage_path || null,
    url: url || null,
    mime_type: mime_type || null,
    tamanho: tamanho || null,
    dados,
    valor: a.received_value ?? a.total_amount ?? a.total_value ?? null,
    data_documento: dados.data_fatura || a.date || null,
    entidade: dados.fornecedor || null,
  };
}

async function mapEmParalelo(docs, tipo, accessToken, supabase, concorrencia = 3) {
  const resultado = [];
  for (let i = 0; i < docs.length; i += concorrencia) {
    const lote = docs.slice(i, i + concorrencia);
    const mapped = await Promise.all(lote.map(d => mapDoc(d, tipo, accessToken, supabase)));
    resultado.push(...mapped);
  }
  return resultado;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const tipos = body.tipos || ['vendas', 'compras', 'recibos'];

  function buildFiltro(tablePrefix) {
    const partes = [];
    if (body.data_de) partes.push(`${tablePrefix}.created_at>='${body.data_de}'::date`);
    if (body.data_ate) partes.push(`${tablePrefix}.created_at<='${body.data_ate}'::date`);
    return partes.length ? `?filter=${encodeURIComponent(`"${partes.join(' AND ')}"`) }` : '';
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  let accessToken;
  try {
    accessToken = await getValidToken();
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  const resultados = { vendas: 0, compras: 0, recibos: 0, duplicados: 0, erros: [] };

  async function inserir(rows) {
    for (const row of rows) {
      const { error } = await supabase.from('faturas').insert(row);
      if (error) {
        if (error.message.includes('duplicate') || error.code === '23505') {
          resultados.duplicados++;
        } else {
          resultados.erros.push(`${row.filename}: ${error.message}`);
        }
      }
    }
  }

  try {
    if (tipos.includes('vendas')) {
      const docs = await fetchAllPages(`/v1/commercial_sales_documents${buildFiltro('documents')}`, accessToken);
      const rows = await mapEmParalelo(docs, 'cliente', accessToken, supabase);
      await inserir(rows);
      resultados.vendas = docs.length;
    }

    if (tipos.includes('compras')) {
      const docs = await fetchAllPages(`/v1/commercial_purchases_documents${buildFiltro('purchases_documents')}`, accessToken);
      const rows = await mapEmParalelo(docs, 'fornecedor', accessToken, supabase);
      await inserir(rows);
      resultados.compras = docs.length;
    }

    if (tipos.includes('recibos')) {
      const docs = await fetchAllPages(`/v1/commercial_sales_receipts${buildFiltro('receipts')}`, accessToken);
      const rows = await mapEmParalelo(docs, 'recibo', accessToken, supabase);
      await inserir(rows);
      resultados.recibos = docs.length;
    }
  } catch (e) {
    return res.status(500).json({ error: e.message, resultados });
  }

  return res.status(200).json(resultados);
}
