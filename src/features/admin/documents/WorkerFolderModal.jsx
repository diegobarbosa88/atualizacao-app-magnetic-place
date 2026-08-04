import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { useDocumentTemplates } from '../../../hooks/useDocumentTemplates';
import { WorkerPastaView, DocumentViewerModal } from './WorkerDocsFolderView';
import { inferirCategoria } from '../../../constants/rhCategories';

const isSigned = s => ['signed', 'Assinado', 'assinado'].includes(s);
const isAwaitingAdmin = s => ['awaiting_admin', 'pending_admin'].includes(s);

export default function WorkerFolderModal({ workerId, workerName, onClose }) {
  const { documents, supabase, workers } = useApp();
  const { generatedDocs } = useDocumentTemplates(supabase);
  const [previewDoc, setPreviewDoc] = useState(null);

  const workerById = useMemo(() => {
    const m = {};
    (workers || []).forEach(w => { m[w.id] = w; });
    return m;
  }, [workers]);

  const workerDocs = useMemo(() => {
    return (documents || [])
      .filter(d => d.workerId === workerId && d.status !== 'Rascunho')
      .map(d => ({
        id: `manual:${d.id}`,
        source: 'manual',
        workerId: d.workerId,
        workerName: workerName,
        title: d.nomeFicheiro || d.tipo,
        tipo: d.tipo,
        categoria: d.categoria || inferirCategoria?.(d.tipo) || null,
        data_validade: d.data_validade || null,
        state: d.status === 'Assinado' ? 'signed' : 'pending',
        createdAt: d.dataEmissao ? new Date(d.dataEmissao) : null,
        signedAtWorker: d.dataAssinatura ? new Date(d.dataAssinatura) : null,
        signedAtAdmin: null,
        viewUrl: d.url,
        signedPdfUrl: d.pdfAssinadoUrl,
        grupo_id: d.grupo_id || null,
        lado: d.lado || null,
        dados_extraidos: d.dados_extraidos || null,
        workerNif:       workerById[d.workerId]?.nif       || null,
        workerNiss:      workerById[d.workerId]?.nis        || null,
        workerProfissao: workerById[d.workerId]?.profissao  || null,
        raw: d,
      }));
  }, [documents, workerId, workerName, workerById]);

  const templateDocs = useMemo(() => {
    return (generatedDocs || [])
      .filter(d => d.worker_id === workerId)
      .map(d => {
        const state = isSigned(d.status) ? 'signed' : isAwaitingAdmin(d.status) ? 'awaiting_admin' : 'pending';
        const tipo = d.tipo_doc || d.template_name || 'Documento';
        return {
          id: `template:${d.id}`,
          source: 'template',
          workerId: d.worker_id,
          workerName,
          title: d.title,
          tipo,
          categoria: d.categoria || inferirCategoria?.(tipo) || null,
          data_validade: null,
          state,
          createdAt: d.created_at ? new Date(d.created_at) : null,
          signedAtWorker: d.signed_at ? new Date(d.signed_at) : null,
          signedAtAdmin:  d.admin_signed_at ? new Date(d.admin_signed_at) : null,
          viewUrl: null,
          signedPdfUrl: d.signed_pdf_url || null,
          grupo_id: null,
          lado: null,
          dados_extraidos: null,
          workerNif:       workerById[d.worker_id]?.nif       || null,
          workerNiss:      workerById[d.worker_id]?.nis        || null,
          workerProfissao: workerById[d.worker_id]?.profissao  || null,
          raw: d,
        };
      });
  }, [generatedDocs, workerId, workerName, workerById]);

  const handleOpenDoc = (doc) => {
    const url = doc.signedPdfUrl || doc.viewUrl || null;
    setPreviewDoc({ ...doc, previewUrl: url });
  };

  const handleDelete = async (doc) => {
    if (!supabase || !doc.raw) return;
    const raw = doc.raw;
    const match = raw.url?.match(/\/storage\/v1\/object\/public\/documentos\/(.+?)(\?|$)/);
    if (match) {
      await supabase.storage.from('documentos').remove([decodeURIComponent(match[1])]);
    }
    await supabase.from('documents').delete().eq('id', raw.id);
  };

  const allDocs = useMemo(() => [...workerDocs, ...templateDocs], [workerDocs, templateDocs]);
  const worker = { workerId, workerName, docs: allDocs };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pasta de Documentos</p>
            <h3 className="font-black text-slate-800">{workerName}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-4">
          <WorkerPastaView
            worker={worker}
            docs={allDocs}
            onBack={onClose}
            onOpenDoc={handleOpenDoc}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* Modal de pré-visualização (fixed, sobrepõe tudo) */}
      <DocumentViewerModal key={previewDoc?.id} doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
