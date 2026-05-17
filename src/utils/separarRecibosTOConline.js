import { PDFDocument } from 'pdf-lib';
import { extrairPaginasPdf, extrairMetadadosTOConline } from './validarReciboTOConline';

// Apanha 9 dígitos consecutivos após "Contribuinte" + separadores
const NIF_REGEX = /Contribuinte[^0-9]*(\d{9})/;

function extrairNif(texto) {
  return texto.match(NIF_REGEX)?.[1] ?? null;
}

function yieldToMain() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Separa um PDF TOConline agregado em recibos individuais.
 * @param {File} file
 * @param {Function} [onProgresso] - callback(paginaAtual, totalPaginas)
 * @returns {Promise<{ resultados: Array, orfaos: Array }>}
 */
export async function separarRecibosTOConline(file, onProgresso) {
  // extrairPaginasPdf faz Y-grouping correcto (mesmo que a validação)
  const paginas = await extrairPaginasPdf(file);

  // pdf-lib precisa de uma cópia independente do buffer
  const arrayBuffer = await file.arrayBuffer();
  const pdfLib = await PDFDocument.load(new Uint8Array(arrayBuffer));

  const numPages = paginas.length;
  const grupos   = new Map(); // nif → { nome, mes, paginas[] }
  const orfaos   = [];

  for (let i = 0; i < numPages; i++) {
    await yieldToMain();
    onProgresso?.(i + 1, numPages);

    const texto = paginas[i];
    const nif   = extrairNif(texto);

    if (!nif) {
      orfaos.push({ pageIndex: i, texto: texto.slice(0, 200) });
      continue;
    }

    if (!grupos.has(nif)) {
      const { nome, mes } = extrairMetadadosTOConline(texto);
      grupos.set(nif, { nome: nome ?? null, mes: mes ?? null, paginas: [], textos: [] });
    }
    grupos.get(nif).paginas.push(i);
    grupos.get(nif).textos.push(texto);
  }

  const resultados = [];
  for (const [nif, grupo] of grupos) {
    await yieldToMain();
    const docIndividual = await PDFDocument.create();
    const pagsCopied    = await docIndividual.copyPages(pdfLib, grupo.paginas);
    pagsCopied.forEach(p => docIndividual.addPage(p));
    const pdfBytes = await docIndividual.save();
    const { textos, ...grupoSemTextos } = grupo;
    resultados.push({ nif, ...grupoSemTextos, texto: textos.join('\n'), pdfBytes });
  }

  return { resultados, orfaos };
}

/**
 * Faz upload do PDF individual para o Supabase Storage e regista em `documents`.
 */
export async function associarDocumentoAoTrabalhador({ nif, nome, mes, worker, pdfBytes, supabase }) {
  if (!worker) throw new Error(`Trabalhador não encontrado para NIF ${nif}`);

  const fileName    = `recibo_${mes ?? 'sem-mes'}_${nif}.pdf`;
  const storagePath = `${worker.id}/recibos/${fileName}`;
  const blob        = new Blob([pdfBytes], { type: 'application/pdf' });

  const { error: uploadErr } = await supabase.storage
    .from('documentos')
    .upload(storagePath, blob, { upsert: true, contentType: 'application/pdf' });
  if (uploadErr) throw uploadErr;

  const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(storagePath);

  const docId = `doc_${Date.now()}_${nif}`;
  const { error: dbErr } = await supabase.from('documents').insert({
    id:           docId,
    workerId:     worker.id,
    tipo:         'Recibo de Vencimento',
    nomeFicheiro: fileName,
    url:          urlData.publicUrl,
    status:       'Pendente',
    dataEmissao:  new Date().toISOString(),
  });
  if (dbErr) throw dbErr;

  return { docId, storagePath, url: urlData.publicUrl };
}
