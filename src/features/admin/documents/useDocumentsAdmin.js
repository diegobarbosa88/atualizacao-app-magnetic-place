import { useState, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { useDocumentTemplates } from '../../../hooks/useDocumentTemplates';
import { getValidadeStatus, isUncategorized, SEM_CATEGORIA } from '../../../constants/rhCategories';
import { downloadTemplateBytes, renderDocx, buildRenderData } from '../../../utils/docxTemplateService';
import { replaceTemplateFields } from '../../../utils/templateFields';
import { applyLayoutOverride } from '../../../utils/templateLayoutSettings';
import { fetchPublicIp } from '../../../utils/deviceUtils';
import { unifyDocuments } from './unifyDocuments';

const TIPOS_MANUAIS = ['Recibo de Vencimento', 'Mapa de Ajudas de Custo', 'Mapa de Deslocamento', 'Contrato de Trabalho', 'Outro'];

// Tipos de documento que o trabalhador deve ver automaticamente na sua
// dashboard assim que são carregados, sem precisar do toggle manual de
// visibilidade (recibo e mapa de ajudas já são "oficialmente dele").
const TIPOS_AUTO_VISIVEL = ['Recibo de Vencimento', 'Mapa de Ajudas de Custo'];

// Estado + lógica de negócio da página "Documentos" (Arquivo). Extraído de
// DocumentsAdmin.jsx para manter o componente focado em JSX — mesmo padrão
// de src/hooks/useDocumentTemplates.js.
export function useDocumentsAdmin() {
  const { supabase: clientSupabase, companySignature, stampStyle, workers = [], documents = [], setDocuments, systemSettings } = useApp();

  const {
    templates,
    generatedDocs,
    gateSlugsAtivos,
    loading: loadingTemplates,
    loadingDocs,
    saving,
    handleUploadTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    handleGenerateDocuments,
    handleApproveDocument,
    handleDeleteDoc: handleDeleteGenerated,
    handleToggleGateRequisito,
  } = useDocumentTemplates(clientSupabase);

  const workerById = useMemo(() => {
    const m = {};
    workers.forEach(w => { m[w.id] = w; });
    return m;
  }, [workers]);

  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [validadeFilter, setValidadeFilter] = useState('');
  const [docMode, setDocMode] = useState('worker'); // 'category' | 'worker'
  const [categoriaOverrides, setCategoriaOverrides] = useState({}); // { [docId]: categoria }
  const [approvingId, setApprovingId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selWorker, setSelWorker] = useState('');
  const [selTipo, setSelTipo] = useState(TIPOS_MANUAIS[0]);
  const [selCategoria, setSelCategoria] = useState('Remuneração');
  const [selValidade, setSelValidade] = useState('');
  const [selFile, setSelFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const unifiedDocs = useMemo(
    () => unifyDocuments(documents, generatedDocs, workerById, categoriaOverrides),
    [documents, generatedDocs, workerById, categoriaOverrides]
  );

  const filteredDocs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = unifiedDocs.filter(d => {
      if (stateFilter !== 'all' && d.state !== stateFilter) return false;
      if (sourceFilter !== 'all' && d.source !== sourceFilter) return false;
      if (tipoFilter !== 'all' && d.tipo !== tipoFilter) return false;
      if (categoriaFilter === SEM_CATEGORIA) {
        if (!isUncategorized(d.categoria)) return false;
      } else if (categoriaFilter && d.categoria !== categoriaFilter) return false;
      if (validadeFilter === 'expiring') {
        const vs = getValidadeStatus(d.data_validade);
        if (!['expirado', 'urgente'].includes(vs)) return false;
      }
      if (q) {
        const t = (d.title || '').toLowerCase();
        const w = (d.workerName || '').toLowerCase();
        const tp = (d.tipo || '').toLowerCase();
        const c = (d.categoria || '').toLowerCase();
        if (!t.includes(q) && !w.includes(q) && !tp.includes(q) && !c.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    const getVal = (d) => {
      switch (sortKey) {
        case 'createdAt': return d.createdAt ? d.createdAt.getTime() : null;
        case 'workerName': return d.workerName || null;
        case 'title': return d.title || null;
        case 'source': return d.source || null;
        case 'state': return d.state || null;
        default: return null;
      }
    };
    return [...list].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'pt', { sensitivity: 'base' }) * dir;
    });
  }, [unifiedDocs, stateFilter, sourceFilter, searchTerm, sortKey, sortDir, tipoFilter, categoriaFilter, validadeFilter]);

  const counts = useMemo(() => {
    const c = { all: unifiedDocs.length, pending: 0, awaiting_admin: 0, signed: 0 };
    unifiedDocs.forEach(d => { c[d.state] = (c[d.state] || 0) + 1; });
    return c;
  }, [unifiedDocs]);

  const tipoOptions = useMemo(() => {
    const tipos = [...new Set(unifiedDocs.map(d => d.tipo).filter(Boolean))];
    return tipos.sort();
  }, [unifiedDocs]);

  const onUpload = async () => {
    if (!selWorker || !selFile) return alert('Selecione tudo.');
    setUploading(true);

    if (!clientSupabase) {
      setUploading(false);
      return alert('A conexão com a base de dados falhou. Por favor, atualize a página (F5) e tente novamente.');
    }

    const slugify = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const cleanName = selFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${selWorker}/${slugify(selCategoria || selTipo)}/${Date.now()}_${cleanName}`;

    try {
      const { error: upError } = await clientSupabase.storage.from('documentos').upload(path, selFile);
      if (upError) throw upError;

      const { data: urlData } = clientSupabase.storage.from('documentos').getPublicUrl(path);

      const newDoc = {
        id: `doc_${Date.now()}`,
        workerId: selWorker,
        tipo: selTipo,
        nomeFicheiro: selFile.name,
        url: urlData.publicUrl,
        status: 'Pendente',
        categoria: selCategoria || null,
        data_validade: selValidade || null,
        dataEmissao: new Date().toISOString(),
        visivel_worker: TIPOS_AUTO_VISIVEL.includes(selTipo),
      };

      const { file: _unused, ...docToInsert } = newDoc;
      const { error: dbError } = await clientSupabase.from('documents').insert([docToInsert]);
      if (dbError) throw dbError;

      if (setDocuments) setDocuments(prev => [newDoc, ...prev]);
      setSelFile(null);
      setSelWorker('');
      setShowUploadModal(false);
      alert('Documento enviado com sucesso!');
    } catch (err) {
      console.error('Erro no upload:', err);
      alert(`Erro: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleEditCategoria = async (docId, source, novaCategoria) => {
    if (!clientSupabase) return;
    // Atualiza localmente de imediato
    setCategoriaOverrides(prev => ({ ...prev, [docId]: novaCategoria }));
    if (source !== 'template' && setDocuments) {
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, categoria: novaCategoria } : d));
    }
    try {
      const table = source === 'template' ? 'worker_documents' : 'documents';
      const { error } = await clientSupabase.from(table).update({ categoria: novaCategoria }).eq('id', docId);
      if (error) throw error;
    } catch (err) {
      // Reverte o override se falhou
      setCategoriaOverrides(prev => { const n = { ...prev }; delete n[docId]; return n; });
      alert(`Erro ao guardar categoria: ${err.message}`);
    }
  };

  const handleDeleteManual = async (raw) => {
    if (!clientSupabase) return alert('Conexão indisponível. Actualize a página.');
    if (!window.confirm('Apagar documento permanentemente?')) return;

    try {
      const match = raw.url?.match(/\/storage\/v1\/object\/public\/documentos\/(.+?)(\?|$)/);
      const pathInStorage = match ? decodeURIComponent(match[1]) : null;
      if (pathInStorage) await clientSupabase.storage.from('documentos').remove([pathInStorage]);
      const { error } = await clientSupabase.from('documents').delete().eq('id', raw.id);
      if (error) throw error;
      if (setDocuments) setDocuments(prev => prev.filter(d => d.id !== raw.id));
    } catch (err) {
      alert(`Erro ao apagar: ${err.message}`);
    }
  };

  const onApprove = async (raw) => {
    if (!companySignature?.signatureDataUrl) {
      alert('Configura primeiro a assinatura da empresa em Definições.');
      return;
    }
    setApprovingId(raw.id);
    try {
      const adminIp = await fetchPublicIp();
      await handleApproveDocument(raw, {
        companyName: systemSettings?.companyName,
        companySignature,
        adminIp,
        stampStyle,
      });
    } catch (err) {
      console.error('Erro a aprovar documento:', err);
      alert('Erro: ' + (err.message || err));
    } finally {
      setApprovingId(null);
    }
  };

  const openGeneratedPreview = async (raw) => {
    const workerName = workerById[raw.worker_id]?.name || '';
    const title = `${raw.title}${workerName ? ` — ${workerName}` : ''}`;
    setPreview({ title, loading: true, blob: null, error: '' });
    try {
      if (!raw.template_id) throw new Error('Documento sem template associado.');
      const { data: tmpl, error: tErr } = await clientSupabase
        .from('document_templates').select('*').eq('id', raw.template_id).single();
      if (tErr) throw tErr;

      if (tmpl.formato === 'html') {
        if (!tmpl.template_html) throw new Error('Template sem conteúdo HTML associado.');
        // Se o trabalhador já assinou, o HTML preenchido já está gravado
        // (worker_documents.generated_html) — reaproveita-o em vez de gerar
        // de novo. Caso ainda não tenha assinado, preenche na hora só para
        // pré-visualização.
        let html = raw.generated_html;
        if (!html) {
          const { data: worker, error: wErr } = await clientSupabase
            .from('workers').select('*').eq('id', raw.worker_id).single();
          if (wErr) throw wErr;
          let clientData = null;
          if (raw.client_id) {
            const { data: c } = await clientSupabase
              .from('clients').select('*').eq('id', raw.client_id).maybeSingle();
            clientData = c || null;
          }
          const { data: epiCatalogo } = await clientSupabase.from('epi_catalogo_documento').select('*');
          html = applyLayoutOverride(
            replaceTemplateFields(tmpl.template_html, worker || {}, systemSettings || {}, clientData, epiCatalogo || []),
            tmpl.layout_settings
          );
        }
        // A assinatura do trabalhador fica em signature_data à parte (ver
        // HtmlDocumentViewer.jsx) — o generated_html gravado ainda tem a tag
        // literal por resolver. Resolve-a só para a pré-visualização, sem
        // gravar nada; o carimbo do admin ({admin_stamp}) fica por resolver
        // até à aprovação real.
        if (raw.signature_data) {
          html = html.replace('{worker_signature}', `<img src="${raw.signature_data}" alt="Assinatura do trabalhador" style="width:100%;height:100%;object-fit:contain;object-position:center;" />`);
        }
        setPreview({ title, loading: false, blob: null, html, error: '' });
        return;
      }

      if (!tmpl?.template_docx_path) throw new Error('Template sem ficheiro .docx');

      const { data: worker, error: wErr } = await clientSupabase
        .from('workers').select('*').eq('id', raw.worker_id).single();
      if (wErr) throw wErr;

      let clientData = null;
      if (raw.client_id) {
        const { data: c } = await clientSupabase
          .from('clients').select('*').eq('id', raw.client_id).maybeSingle();
        clientData = c || null;
      }

      const buffer = await downloadTemplateBytes(clientSupabase, tmpl.template_docx_path);
      const renderData = buildRenderData(worker || {}, systemSettings || {}, clientData);
      const filledBlob = renderDocx(buffer, renderData);
      setPreview({ title, loading: false, blob: filledBlob, error: '' });
    } catch (err) {
      console.error('Falha a abrir preview:', err);
      setPreview({ title, loading: false, blob: null, error: err.message || 'Erro a carregar documento.' });
    }
  };

  return {
    workers, systemSettings, unifiedDocs,
    templates, loadingTemplates, loadingDocs, saving,
    handleUploadTemplate, handleUpdateTemplate, handleDeleteTemplate, handleGenerateDocuments,
    handleDeleteGenerated,
    gateSlugsAtivos, handleToggleGateRequisito,
    searchTerm, setSearchTerm,
    stateFilter, setStateFilter,
    sourceFilter, setSourceFilter,
    tipoFilter, setTipoFilter,
    categoriaFilter, setCategoriaFilter,
    validadeFilter, setValidadeFilter,
    docMode, setDocMode,
    approvingId, preview, setPreview,
    sortKey, sortDir, handleSort,
    showUploadModal, setShowUploadModal,
    selWorker, setSelWorker,
    selTipo, setSelTipo,
    selCategoria, setSelCategoria,
    selValidade, setSelValidade,
    selFile, setSelFile,
    uploading,
    filteredDocs, counts, tipoOptions,
    onUpload, handleEditCategoria, handleDeleteManual, onApprove, openGeneratedPreview,
    TIPOS_MANUAIS,
  };
}
