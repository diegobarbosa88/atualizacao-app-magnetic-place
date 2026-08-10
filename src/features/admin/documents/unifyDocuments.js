import { isSigned, isAwaitingAdmin } from '../../../constants/documentStatus';
import { inferirCategoria } from '../../../constants/rhCategories';

// Mapeador puro partilhado: converte um documento "manual" (tabela `documents`)
// para a forma unificada usada em DocumentsTable / WorkerDocsFolderView.
export function mapManualDoc(d, workerById = {}, categoriaOverrides = {}) {
  const state = d.status === 'Assinado' ? 'signed' : 'pending';
  return {
    id: `manual:${d.id}`,
    source: 'manual',
    workerId: d.workerId,
    workerName: workerById[d.workerId]?.name || 'Desconhecido',
    title: d.nomeFicheiro || d.tipo,
    subtitle: d.tipo,
    tipo: d.tipo,
    categoria: categoriaOverrides[d.id] ?? d.categoria ?? inferirCategoria(d.tipo) ?? null,
    data_validade: d.data_validade || null,
    state,
    createdAt: d.dataEmissao ? new Date(d.dataEmissao) : null,
    signedAtWorker: d.dataAssinatura ? new Date(d.dataAssinatura) : null,
    signedAtAdmin: null,
    viewUrl: d.url,
    signedPdfUrl: d.pdfAssinadoUrl,
    grupo_id: d.grupo_id || null,
    lado: d.lado || null,
    dados_extraidos: d.dados_extraidos || null,
    visivel_worker: d.visivel_worker ?? false,
    workerNif:       workerById[d.workerId]?.nif       || null,
    workerNiss:      workerById[d.workerId]?.nis        || null,
    workerProfissao: workerById[d.workerId]?.profissao  || null,
    raw: d,
  };
}

// Mapeador puro partilhado: converte um documento "gerado" (template, tabela
// `worker_documents`) para a mesma forma unificada.
export function mapGeneratedDoc(d, workerById = {}, categoriaOverrides = {}) {
  const state = isSigned(d.status) ? 'signed' : isAwaitingAdmin(d.status) ? 'awaiting_admin' : 'pending';
  const tipo = d.tipo_doc || d.template_name || d.title || 'Documento';
  return {
    id: `template:${d.id}`,
    source: 'template',
    workerId: d.worker_id,
    workerName: workerById[d.worker_id]?.name || 'Desconhecido',
    title: d.title,
    subtitle: tipo,
    tipo: tipo,
    categoria: categoriaOverrides[d.id] ?? d.categoria ?? inferirCategoria(tipo) ?? null,
    data_validade: null,
    state,
    createdAt: d.created_at ? new Date(d.created_at) : null,
    signedAt: d.admin_signed_at ? new Date(d.admin_signed_at) : (d.signed_at ? new Date(d.signed_at) : null),
    signedAtWorker: d.signed_at ? new Date(d.signed_at) : null,
    signedAtAdmin: d.admin_signed_at ? new Date(d.admin_signed_at) : null,
    signedPdfUrl: d.signed_pdf_url,
    workerNif:       workerById[d.worker_id]?.nif       || null,
    workerNiss:      workerById[d.worker_id]?.nis        || null,
    workerProfissao: workerById[d.worker_id]?.profissao  || null,
    raw: d,
  };
}

// Junta documentos manuais + gerados numa única lista, na forma unificada.
// `documents` exclui rascunhos (geridos à parte em ModoDocumentos).
export function unifyDocuments(documents = [], generatedDocs = [], workerById = {}, categoriaOverrides = {}) {
  const manuais = documents
    .filter(d => d.status !== 'Rascunho')
    .map(d => mapManualDoc(d, workerById, categoriaOverrides));
  const gerados = generatedDocs.map(d => mapGeneratedDoc(d, workerById, categoriaOverrides));
  return [...manuais, ...gerados];
}
