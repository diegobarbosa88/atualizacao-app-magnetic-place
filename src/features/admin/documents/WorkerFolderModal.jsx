import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';
import { useApp } from '../../../context/AppContext';
import { useDocumentTemplates } from '../../../hooks/useDocumentTemplates';
import { WorkerPastaView, DocumentViewerModal } from './WorkerDocsFolderView';
import UploadManualModal from './UploadManualModal';
import { mapManualDoc, mapGeneratedDoc } from './unifyDocuments';
import { toSentenceCase } from '../../../utils/textUtils';

// Recibo e mapa de ajudas ficam visíveis ao trabalhador logo no upload,
// sem precisar do toggle manual (ver useDocumentsAdmin.js).
const TIPOS_AUTO_VISIVEL = ['Recibo de Vencimento', 'Mapa de Ajudas de Custo'];

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

  // Reutiliza os mesmos mapeadores puros da página Documentos (unifyDocuments.js)
  // em vez de re-derivar o formato unificado à parte.
  const workerDocs = useMemo(() => {
    return (documents || [])
      .filter(d => d.workerId === workerId && d.status !== 'Rascunho')
      .map(d => mapManualDoc(d, workerById, {}));
  }, [documents, workerId, workerById]);

  const templateDocs = useMemo(() => {
    return (generatedDocs || [])
      .filter(d => d.worker_id === workerId)
      .map(d => mapGeneratedDoc(d, workerById, {}));
  }, [generatedDocs, workerId, workerById]);

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
        visivel_worker: TIPOS_AUTO_VISIVEL.includes(selTipo),
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
    <>
      <ModalShell
        isOpen
        onClose={onClose}
        subtitle="Pasta de Documentos"
        title={toSentenceCase(workerName)}
        size="2xl"
        footer={
          <div className="flex justify-end px-5 py-4">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-colors flex-shrink-0"
              style={{ backgroundColor: '#EB8D00', color: '#1B3A57' }}
            >
              <Plus size={13} /> Adicionar
            </button>
          </div>
        }
      >
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
      </ModalShell>

      {/* Modal de pré-visualização (layer="viewer", sobrepõe tudo) */}
      <DocumentViewerModal key={previewDoc?.id} doc={previewDoc} onClose={() => setPreviewDoc(null)} />

      {/* Modal de upload (layer="nested", sobrepõe esta pasta) */}
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
    </>
  );
}
