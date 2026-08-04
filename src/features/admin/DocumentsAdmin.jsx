import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, FileSignature, FolderOpen, Mail, Building2, ReceiptText, Coins, Receipt, BarChart2, ArrowRightLeft, Landmark, ListChecks, AlertTriangle, LayoutGrid, List } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useDocumentTemplates } from '../../hooks/useDocumentTemplates';
import { isSigned, isAwaitingAdmin } from '../../constants/documentStatus';
import { downloadTemplateBytes, renderDocx, buildRenderData } from '../../utils/docxTemplateService';
import DocxPreviewModal from '../../components/common/DocxPreviewModal';
import DocumentTemplatesAdmin from '../../components/admin/DocumentTemplatesAdmin';
import ValidarReciboAdmin from '../../components/admin/ValidarReciboAdmin';
import SalariosTab from './SalariosTab';
import FaturasTab from './FaturasTab';
import FaturasAdmin from './FaturasAdmin';
import PagamentosTab from './pagamentos/PagamentosTab';
import FilaAprovacaoTab from './pagamentos/FilaAprovacaoTab';
import MovimentacoesBancariasTab from './MovimentacoesBancariasTab';
import ReconciliacaoAdmin from './ReconciliacaoAdmin';
import { fetchPublicIp } from '../../utils/deviceUtils';
import { getValidadeStatus, inferirCategoria } from '../../constants/rhCategories';

import DocumentsFilters from './documents/DocumentsFilters';
import DocumentsTable from './documents/DocumentsTable';
import UploadManualModal from './documents/UploadManualModal';
import WorkerDocsFolderView from './documents/WorkerDocsFolderView';


const TIPOS_MANUAIS = ['Recibo de Vencimento', 'Mapa de Deslocamento', 'Contrato de Trabalho', 'Outro'];

const DocumentsAdmin = ({ workers = [], documents = [], setDocuments, systemSettings, onSwitchTab, ...rest }) => {
  const props = { workers, documents, setDocuments, systemSettings, onSwitchTab, ...rest };
  const { supabase: clientSupabase, companySignature, stampStyle } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const GROUPS = [
    {
      id: 'arquivo', label: 'Arquivo', icon: FolderOpen, color: 'indigo',
      sections: [
        { id: 'documentos', label: 'Documentos', icon: FileText },
        { id: 'templates',  label: 'Templates',  icon: FileSignature },
      ],
    },
    {
      id: 'faturas', label: 'Faturas', icon: Receipt, color: 'blue',
      sections: [
        { id: 'importar',     label: 'Importar',     icon: Mail },
        { id: 'fornecedores', label: 'Fornecedores', icon: Building2 },
      ],
    },
    {
      id: 'reconciliacao', label: 'Reconciliação', icon: BarChart2, color: 'emerald',
      sections: [
        { id: 'recibos',        label: 'Recibos',        icon: ReceiptText },
        { id: 'salarios',       label: 'Salários',       icon: Coins },
        { id: 'bancaria',       label: 'Bancária',       icon: Landmark },
      ],
    },
    {
      id: 'pagamentos', label: 'Pagamentos', icon: ArrowRightLeft, color: 'violet',
      sections: [
        { id: 'pagamentos-fornecedores', label: 'Fornecedores', icon: ArrowRightLeft },
        { id: 'fila', label: 'Fila de Pag.', icon: ListChecks },
      ],
    },
    {
      id: 'banco', label: 'Banco', icon: Landmark, color: 'sky',
      sections: [
        { id: 'movimentacoes', label: 'Movimentações', icon: Landmark },
      ],
    },
  ];

  const DEFAULT_SECTION = { arquivo: 'documentos', faturas: 'importar', reconciliacao: 'recibos', pagamentos: 'fila', banco: 'movimentacoes' };

  const GROUP_COLOR = {
    indigo:  { active: 'bg-indigo-600 text-white shadow-indigo-200',  text: 'text-indigo-600',  icon: 'bg-indigo-50 text-indigo-600' },
    blue:    { active: 'bg-blue-600 text-white shadow-blue-200',      text: 'text-blue-600',    icon: 'bg-blue-50 text-blue-600' },
    emerald: { active: 'bg-emerald-600 text-white shadow-emerald-200',text: 'text-emerald-600', icon: 'bg-emerald-50 text-emerald-600' },
    violet:  { active: 'bg-violet-600 text-white shadow-violet-200',  text: 'text-violet-600',  icon: 'bg-violet-50 text-violet-600' },
    sky:     { active: 'bg-sky-600 text-white shadow-sky-200',        text: 'text-sky-600',     icon: 'bg-sky-50 text-sky-600' },
  };

  const activeGroup = useMemo(() => {
    const parts = location.pathname.replace(/^\/admin\/documentos\/?/, '').split('/').filter(Boolean);
    const first = parts[0] || 'documentos';
    if (['documentos', 'templates'].includes(first)) return 'arquivo';
    if (first === 'faturas') return 'faturas';
    if (first === 'reconciliacao') return 'reconciliacao';
    if (first === 'pagamentos') return 'pagamentos';
    if (first === 'banco') return 'banco';
    // compatibilidade com rotas antigas /validar/*
    if (first === 'validar') return 'reconciliacao';
    return 'arquivo';
  }, [location.pathname]);

  const activeSection = useMemo(() => {
    const parts = location.pathname.replace(/^\/admin\/documentos\/?/, '').split('/').filter(Boolean);
    if (activeGroup === 'arquivo') return parts[0] || 'documentos';
    // compatibilidade: /validar/entradas → movimentacoes
    if (parts[0] === 'validar') {
      const old = parts[1];
      if (old === 'entradas') return 'movimentacoes';
      if (old === 'faturas')  return 'fornecedores';
      return old || DEFAULT_SECTION.reconciliacao;
    }
    return parts[1] || DEFAULT_SECTION[activeGroup];
  }, [location.pathname, activeGroup]);

  const navigateTo = (groupId, sectionId) => {
    if (groupId === 'arquivo') navigate(`/admin/documentos/${sectionId}`);
    else navigate(`/admin/documentos/${groupId}/${sectionId}`);
  };

  const {
    generatedDocs,
    loadingDocs,
    saving,
    handleApproveDocument,
    handleDeleteDoc: handleDeleteGenerated,
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
  const [viewMode, setViewMode] = useState('folder'); // 'table' | 'folder'
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

  const unifiedDocs = useMemo(() => {
    const manuais = (documents || []).filter(d => d.status !== 'Rascunho').map(d => {
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
        workerNif:       workerById[d.workerId]?.nif       || null,
        workerNiss:      workerById[d.workerId]?.nis        || null,
        workerProfissao: workerById[d.workerId]?.profissao  || null,
        raw: d,
      };
    });
    const gerados = (generatedDocs || []).map(d => {
      const state = isSigned(d.status) ? 'signed' : isAwaitingAdmin(d.status) ? 'awaiting_admin' : 'pending';
      const tipo = d.tipo_doc || d.template_name || 'Documento';
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
    });
    return [...manuais, ...gerados];
  }, [documents, generatedDocs, workerById, categoriaOverrides]);

  const filteredDocs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = unifiedDocs.filter(d => {
      if (stateFilter !== 'all' && d.state !== stateFilter) return false;
      if (sourceFilter !== 'all' && d.source !== sourceFilter) return false;
      if (tipoFilter !== 'all' && d.tipo !== tipoFilter) return false;
      if (categoriaFilter && d.categoria !== categoriaFilter) return false;
      if (validadeFilter === 'expiring') {
        const vs = getValidadeStatus(d.data_validade);
        if (!['expirado', 'urgente'].includes(vs)) return false;
      }
      if (q) {
        const t = (d.title || '').toLowerCase();
        const w = (d.workerName || '').toLowerCase();
        if (!t.includes(q) && !w.includes(q)) return false;
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
  }, [unifiedDocs, stateFilter, sourceFilter, searchTerm, sortKey, sortDir, tipoFilter]);

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

  const currentGroup = GROUPS.find(g => g.id === activeGroup);
  const gc = GROUP_COLOR[currentGroup?.color || 'indigo'];

  return (
    <div className="bg-white rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 lg:p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header + grupos (linha 1) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-50 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl transition-colors duration-200 ${gc.icon}`}>
            {currentGroup ? <currentGroup.icon size={20} /> : <FolderOpen size={20} />}
          </div>
          <h3 className="font-black text-base sm:text-xl text-slate-800 uppercase tracking-tight">Centro de Documentos</h3>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {GROUPS.map(group => {
            const Icon = group.icon;
            const isActive = activeGroup === group.id;
            const c = GROUP_COLOR[group.color];
            return (
              <button
                key={group.id}
                onClick={() => navigateTo(group.id, DEFAULT_SECTION[group.id])}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
                  isActive ? `${c.active} shadow-sm` : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={13} /> {group.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Secções do grupo ativo (linha 2) */}
      {currentGroup && (
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl mb-5 w-full sm:w-auto inline-flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {currentGroup.sections.map(sec => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => navigateTo(activeGroup, sec.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  isActive ? `bg-white ${gc.text} shadow-sm` : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={13} /> {sec.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Conteúdo */}
      {activeGroup === 'arquivo' && activeSection === 'templates' && (
        <DocumentTemplatesAdmin workers={workers} systemSettings={systemSettings} />
      )}
      {activeGroup === 'faturas' && activeSection === 'importar' && (
        <FaturasAdmin />
      )}
      {activeGroup === 'faturas' && activeSection === 'fornecedores' && (
        <FaturasTab />
      )}
      {activeGroup === 'reconciliacao' && activeSection === 'recibos' && (
        <ValidarReciboAdmin workers={workers} />
      )}
      {activeGroup === 'reconciliacao' && activeSection === 'salarios' && (
        <SalariosTab />
      )}
      {activeGroup === 'reconciliacao' && activeSection === 'bancaria' && (
        <ReconciliacaoAdmin />
      )}
      {activeGroup === 'pagamentos' && activeSection === 'pagamentos-fornecedores' && (
        <PagamentosTab />
      )}
      {activeGroup === 'pagamentos' && activeSection === 'fila' && (
        <FilaAprovacaoTab />
      )}
      {activeGroup === 'banco' && activeSection === 'movimentacoes' && (
        <MovimentacoesBancariasTab />
      )}
      {(activeGroup === 'arquivo' && activeSection === 'documentos') && (
        <>
          {/* Banner de alerta de validade */}
          {(() => {
            const expiring = documents.filter(d => ['expirado', 'urgente'].includes(getValidadeStatus(d.data_validade)));
            return expiring.length > 0 ? (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                <p className="text-sm font-black text-red-700 flex-1">
                  {expiring.length} documento{expiring.length !== 1 ? 's' : ''} expirado{expiring.length !== 1 ? 's' : ''} ou a expirar em 30 dias
                </p>
                <button
                  onClick={() => { setValidadeFilter('expiring'); setViewMode('table'); }}
                  className="text-xs font-black text-red-600 underline hover:text-red-800 transition-colors whitespace-nowrap"
                >
                  Ver todos →
                </button>
              </div>
            ) : null;
          })()}

          <DocumentsFilters
            stateFilter={stateFilter}
            setStateFilter={setStateFilter}
            counts={counts}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
            tipoFilter={tipoFilter}
            setTipoFilter={setTipoFilter}
            tipoOptions={tipoOptions}
            categoriaFilter={categoriaFilter}
            setCategoriaFilter={setCategoriaFilter}
            validadeFilter={validadeFilter}
            setValidadeFilter={setValidadeFilter}
            onShowUpload={() => setShowUploadModal(true)}
          />

          {/* Toggle de modo de vista */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {filteredDocs.length} documento{filteredDocs.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <List size={12} /> Lista
              </button>
              <button
                onClick={() => setViewMode('folder')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'folder' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <LayoutGrid size={12} /> Pastas
              </button>
            </div>
          </div>

          {viewMode === 'table' ? (
            <DocumentsTable
              filteredDocs={filteredDocs}
              loadingDocs={loadingDocs}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onDeleteManual={handleDeleteManual}
              onDeleteGenerated={handleDeleteGenerated}
              onApprove={onApprove}
              onPreview={openGeneratedPreview}
              onEditCategoria={handleEditCategoria}
              approvingId={approvingId}
              saving={saving}
            />
          ) : (
            <WorkerDocsFolderView
              docs={filteredDocs}
              workerName={searchTerm ? `Resultados para "${searchTerm}"` : null}
              onPreview={openGeneratedPreview}
              onDeleteManual={handleDeleteManual}
              onDeleteGenerated={handleDeleteGenerated}
            />
          )}
        </>
      )}

      {showUploadModal && (
        <UploadManualModal
          workers={workers}
          uploading={uploading}
          selWorker={selWorker} setSelWorker={setSelWorker}
          selTipo={selTipo} setSelTipo={setSelTipo}
          selCategoria={selCategoria} setSelCategoria={setSelCategoria}
          selValidade={selValidade} setSelValidade={setSelValidade}
          selFile={selFile} setSelFile={setSelFile}
          onClose={() => setShowUploadModal(false)}
          onUpload={onUpload}
        />
      )}

      {preview && (
        <DocxPreviewModal
          title={preview.title}
          blob={preview.blob}
          loading={preview.loading}
          error={preview.error}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
};

export default DocumentsAdmin;
