import React, { useState, useMemo } from 'react';
import { X, Plus } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { useDocumentTemplates } from '../../../hooks/useDocumentTemplates';
import { WorkerPastaView, DocumentViewerModal } from './WorkerDocsFolderView';
import UploadManualModal from './UploadManualModal';
import { inferirCategoria } from '../../../constants/rhCategories';
import { toSentenceCase } from '../../../utils/textUtils';

const isSigned = s => ['signed', 'Assinado', 'assinado'].includes(s);
const isAwaitingAdmin = s => ['awaiting_admin', 'pending_admin'].includes(s);

export default function WorkerFolderModal({ workerId, workerName, onClose }) {
  const { documents, supabase, workers, setDocuments } = useApp();
  const { generatedDocs } = useDocumentTemplates(supabase);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [showUpload, setShowUpload]     = useState(false);
  const [selTipo, setSelTipo]           = useState('Recibo de Vencimento');
  const [selCategoria, setSelCategoria] = useState('Remuneração');
  const [selValidade, setSelValidade]   = useState('');
  const [selFile, setSelFile]           = useState(null);
  const [uploading, setUploading]       = useState(false);

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
        visivel_worker: d.visivel_worker ?? false,
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
        const tipo = d.tipo_doc || d.template_name || d.title || 'Documento';
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

  const handleUpload = async () => {
    if (!selFile || !supabase) return;
    setUploading(true);
    try {
      const slugify = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      const cleanName = selFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${workerId}/${slugify(selCategoria || selTipo)}/${Date.now()}_${cleanName}`;
      const { error: upError } = await supabase.storage.from('documentos').upload(path, selFile);
      if (upError) throw upError;
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);
      const newDoc = {
        id: `doc_${Date.now()}`,
        workerId,
        tipo: selTipo,
        nomeFicheiro: selFile.name,
        url: urlData.publicUrl,
        status: 'Pendente',
        categoria: selCategoria || null,
        data_validade: selValidade || null,
        dataEmissao: new Date().toISOString(),
      };
      const { error: dbError } = await supabase.from('documents').insert([newDoc]);
      if (dbError) throw dbError;
      if (setDocuments) setDocuments(prev => [newDoc, ...prev]);
      setSelFile(null);
      setSelValidade('');
      setShowUpload(false);
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

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
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pasta de Documentos</p>
            <h3 className="font-black text-slate-800 truncate">{toSentenceCase(workerName)}</h3>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-colors flex-shrink-0"
            style={{ backgroundColor: '#EB8D00', color: '#1B3A57' }}
          >
            <Plus size={13} /> Adicionar
          </button>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors flex-shrink-0">
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

      {/* Modal de upload (fixed, z-[200] sobrepõe tudo) */}
      {showUpload && (
        <UploadManualModal
          hideWorkerSelect
          workers={[{ id: workerId, name: workerName }]}
          uploading={uploading}
          selWorker={workerId}
          setSelWorker={() => {}}
          selTipo={selTipo}           setSelTipo={setSelTipo}
          selCategoria={selCategoria} setSelCategoria={setSelCategoria}
          selValidade={selValidade}   setSelValidade={setSelValidade}
          selFile={selFile}           setSelFile={setSelFile}
          onClose={() => { setShowUpload(false); setSelFile(null); setSelValidade(''); }}
          onUpload={handleUpload}
        />
      )}
    </div>
  );
}
