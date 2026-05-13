import React, { useState, useEffect, useRef, useMemo } from 'react';
import { isSigned } from '../../constants/documentStatus';
import { FileText, Plus, Edit2, Trash2, X, Save, Eye, ChevronDown, ChevronUp, Send, Users, Loader2, Download, Search, CheckCircle, Clock, FileSignature, Sparkles, FileDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useDocumentTemplates } from '../../hooks/useDocumentTemplates';
import { BlockEditor } from './BlockEditor';
import { blocksToPdfMake } from '../../utils/pdfGenerator';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
const _vfs = pdfFonts?.pdfMake?.vfs || pdfFonts?.vfs || pdfFonts;
if (typeof pdfMake.addVirtualFileSystem === 'function') {
  pdfMake.addVirtualFileSystem(_vfs);
} else {
  pdfMake.vfs = _vfs;
}

export default function DocumentTemplatesAdmin({ workers = [] }) {
  const { systemSettings, supabase } = useApp();
  const [previewHeight, setPreviewHeight] = useState(500);
  const [showPreviewSettings, setShowPreviewSettings] = useState(false);

  const {
    templates,
    generatedDocs,
    loading,
    loadingDocs,
    saving,
    handleSave,
    handleDeleteTemplate,
    handleGenerateDocuments,
    handleGenerateAI,
    handleDownloadSigned,
    handleDeleteDoc
  } = useDocumentTemplates(supabase);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedDocView, setSelectedDocView] = useState(null);
  
  // Form states
  const [editingId, setEditingId] = useState(null);
  const [previewData, setPreviewData] = useState({
    name: '',
    description: ''
  });
  const [blocks, setBlocks] = useState([]);
  const [modalTab, setModalTab] = useState('edit');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  
  // Generation states
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [generating, setGenerating] = useState(false);
  
  // Filters
  const [docFilter, setDocFilter] = useState('all');
  const [docSearch, setDocSearch] = useState('');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  // AI states
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [previewPositions, setPreviewPositions] = useState({});
  const [previewZoom, setPreviewZoom] = useState(100);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (modalTab !== 'preview' || blocks.length === 0) {
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(null);
      }
      setPdfLoading(false);
      return;
    }

    let cancelled = false;

    const generatePreview = () => {
      if (cancelled) return;

      try {
        setPdfLoading(true);
        const docDef = blocksToPdfMake(blocks, {}, null);

        if (!docDef || !docDef.content || docDef.content.length === 0) {
          console.error('[PDF Preview] docDef inválido ou sem conteúdo:', docDef);
          setPdfLoading(false);
          return;
        }

        const pdfDoc = pdfMake.createPdf(docDef);

        if (!pdfDoc) {
          console.error('[PDF Preview] createPdf retornou null');
          setPdfLoading(false);
          return;
        }

        pdfDoc.getBlob()
          .then((blob) => {
            if (cancelled) return;

            if (!blob) {
              console.error('[PDF Preview] getBlob retornou blob null');
              setPdfLoading(false);
              return;
            }

            console.log('[PDF Preview] Blob gerado com sucesso, size:', blob.size);

            if (pdfPreviewUrl) {
              URL.revokeObjectURL(pdfPreviewUrl);
            }
            const url = URL.createObjectURL(blob);
            setPdfPreviewUrl(url);
            setPdfLoading(false);
          })
          .catch((error) => {
            if (cancelled) return;
            console.error('[PDF Preview] Erro no getBlob:', error);
            setPdfLoading(false);
          });
      } catch (error) {
        console.error('[PDF Preview] Erro ao gerar PDF:', error);
        setPdfLoading(false);
      }
    };

    generatePreview();

    return () => {
      cancelled = true;
    };
  }, [modalTab, blocks]);

  useEffect(() => {
    let debounceTimer = null;
    const handleMessage = (e) => {
      if (e.data?.type === 'elementMoved') {
        const { id, left, top } = e.data;
        if (!id || !left || !top) return;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          setPreviewPositions(prev => ({ ...prev, [id]: { left, top } }));
        }, 16);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    if (Object.keys(previewPositions).length === 0) return;
    if (iframeRef.current && iframeRef.current.contentDocument) {
      Object.entries(previewPositions).forEach(([id, pos]) => {
        const el = iframeRef.current.contentDocument.getElementById(id);
        if (el) {
          el.style.left = pos.left;
          el.style.top = pos.top;
        }
      });
    }
  }, [previewPositions]);

  const generateAIWrapper = async () => {
    setIsGeneratingAI(true);
    try {
      const generatedBlocks = await handleGenerateAI(aiPrompt);
      setBlocks(generatedBlocks);
      setModalTab('edit');
      setShowAIPanel(false);
      setAiPrompt('');
    } catch (err) {
      alert("Erro ao gerar com IA: " + err.message);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const saveWrapper = async () => {
    try {
      await handleSave(previewData, editingId, blocks);
      setShowModal(false);
    } catch (err) {
      alert("Erro ao gravar: " + err.message);
    }
  };

  const generateDocumentsWrapper = async () => {
    if (!selectedTemplate || selectedWorkers.length === 0) return;
    setGenerating(true);
    try {
      const result = await handleGenerateDocuments(selectedTemplate, selectedWorkers, workers, systemSettings);
      setShowGenerateModal(false);
      if (result.failed > 0) {
        alert(`${result.total - result.failed} documentos gerados. ${result.failed} falharam.`);
      } else {
        alert(`${selectedWorkers.length} documentos gerados com sucesso!`);
      }
    } catch (err) {
      alert("Erro ao gerar documentos: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const docsWithWorkers = useMemo(
    () => generatedDocs.map(doc => ({
      ...doc,
      worker: workers.find(w => w.id === doc.worker_id) || { name: 'Desconhecido' }
    })),
    [generatedDocs, workers]
  );

  const filteredDocs = useMemo(() => {
    const list = docsWithWorkers
      .filter(d => docFilter === 'all' || d.status === docFilter)
      .filter(d => !docSearch || d.title.toLowerCase().includes(docSearch.toLowerCase()) || (d.worker?.name || '').toLowerCase().includes(docSearch.toLowerCase()));

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'title') {
        cmp = (a.title || '').localeCompare(b.title || '') || (a.worker?.name || '').localeCompare(b.worker?.name || '');
      } else if (sortKey === 'date') {
        cmp = (a.created_at || '').localeCompare(b.created_at || '');
      } else if (sortKey === 'status') {
        cmp = (isSigned(a.status) ? 1 : 0) - (isSigned(b.status) ? 1 : 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [docsWithWorkers, docFilter, docSearch, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <ChevronDown size={10} className="opacity-20" />;
    return sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
            <FileText size={20} />
          </div>
          <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight">Gestão de Templates</h3>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setEditingId(null);
              setPreviewData({ name: '', description: '' });
              setBlocks([]);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-indigo-100 active:scale-95"
          >
            <Plus size={14} /> Novo Template
          </button>
          <button 
            onClick={() => {
              setSelectedTemplate(null);
              setSelectedWorkers([]);
              setShowGenerateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-purple-100 active:scale-95"
          >
            <Send size={14} /> Gerar Documentos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 animate-pulse">
              <div className="h-4 w-3/4 bg-slate-200 rounded mb-4" />
              <div className="h-3 w-full bg-slate-100 rounded mb-6" />
              <div className="flex gap-2">
                <div className="h-8 w-8 bg-slate-200 rounded-lg" />
                <div className="h-8 w-8 bg-slate-200 rounded-lg" />
              </div>
            </div>
          ))
        ) : (
          templates.map(t => (
            <div key={t.id} className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-md transition-all group flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-black text-sm text-slate-800 line-clamp-1">{t.name}</h4>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setEditingId(t.id);
                      setPreviewData({
                        name: t.name,
                        description: t.description
                      });
                      const templateBlocks = typeof t.blocks === 'string' ? JSON.parse(t.blocks) : (t.blocks || []);
                      setBlocks(templateBlocks);
                      setShowModal(true);
                    }}
                    className="p-1.5 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg border border-indigo-100 transition-all"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button 
                    onClick={() => handleDeleteTemplate(t.id)}
                    className="p-1.5 bg-white text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg border border-rose-100 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-6 line-clamp-2 leading-relaxed">{t.description || "Sem descrição disponível."}</p>
              <button 
                onClick={() => {
                  setSelectedTemplate(t);
                  setSelectedWorkers([]);
                  setShowGenerateModal(true);
                }}
                className="mt-auto w-full py-2 bg-white text-purple-600 border border-purple-100 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all"
              >
                Usar este Template
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-12 pt-8 border-t border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-purple-50 p-2 rounded-xl text-purple-600">
              <FileSignature size={20} />
            </div>
            <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">Documentos Gerados</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Pesquisar..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
              />
            </div>
            <select 
              className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none"
              value={docFilter}
              onChange={(e) => setDocFilter(e.target.value)}
            >
              <option value="all">Todos os Estados</option>
              <option value="pending">Pendentes</option>
              <option value="signed">Assinados</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-slate-400">
                <th
                  onClick={() => handleSort('title')}
                  className="px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer select-none hover:text-slate-700 transition-colors"
                >
                  <span className="inline-flex items-center gap-1">Documento / Colaborador <SortIcon k="title" /></span>
                </th>
                <th
                  onClick={() => handleSort('date')}
                  className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-center cursor-pointer select-none hover:text-slate-700 transition-colors"
                >
                  <span className="inline-flex items-center gap-1">Data <SortIcon k="date" /></span>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-center cursor-pointer select-none hover:text-slate-700 transition-colors"
                >
                  <span className="inline-flex items-center gap-1">Estado <SortIcon k="status" /></span>
                </th>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {loadingDocs ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest">A carregar documentos...</span>
                  </td>
                </tr>
              ) : generatedDocs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center opacity-30">
                    <FileSignature size={40} className="mx-auto mb-2" />
                    <p className="text-xs font-black uppercase tracking-widest">Sem documentos gerados</p>
                  </td>
                </tr>
              ) : (
                filteredDocs.map(doc => (
                    <tr key={doc.id} className="bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300 group">
                      <td className="px-4 py-4 rounded-l-2xl border-y border-l border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${isSigned(doc.status) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {isSigned(doc.status) ? <CheckCircle size={16} /> : <Clock size={16} />}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800 leading-none mb-1">{doc.title}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{doc.worker?.name || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 border-y border-slate-100 text-center">
                        <span className="text-xs font-bold text-slate-500 font-mono whitespace-nowrap">
                          {new Date(doc.created_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </td>
                      <td className="px-4 py-4 border-y border-slate-100 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${isSigned(doc.status) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {isSigned(doc.status) ? 'Assinado' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-4 py-4 rounded-r-2xl border-y border-r border-slate-100 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() => setSelectedDocView(doc)}
                            className="p-2 bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                            title="Visualizar"
                          >
                            <Eye size={16} />
                          </button>
                          {isSigned(doc.status) && doc.signed_pdf_url && (
                            <button
                              onClick={() => handleDownloadSigned(doc)}
                              className="p-2 bg-white text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                              title="Baixar Documento Assinado"
                            >
                              <Download size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="p-2 bg-white text-rose-500 rounded-xl border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                            title="Apagar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals are kept with their separate z-index and portal-like behavior */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[3rem] p-8 max-w-5xl w-full my-auto shadow-2xl animate-in zoom-in duration-300 border border-slate-100">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-50">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-100">
                  <Edit2 size={24} />
                </div>
                <div>
                  <h4 className="font-black text-2xl text-slate-800">{editingId ? 'Editar Template' : 'Novo Template'}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Defina o conteúdo e placeholders HTML</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all">
                <X size={24} />
              </button>
            </div>

<div className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome do Template *</label>
                  <input
                    type="text"
                    value={previewData.name}
                    onChange={(e) => setPreviewData({ ...previewData, name: e.target.value })}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Contrato de Trabalho"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Descrição</label>
                  <input
                    type="text"
                    value={previewData.description}
                    onChange={(e) => setPreviewData({ ...previewData, description: e.target.value })}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Breve descrição..."
                  />
                </div>

                <div className="border border-slate-100 rounded-[2rem] overflow-hidden bg-slate-50">
                  <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setModalTab('edit')}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${modalTab === 'edit' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setModalTab('preview')}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${modalTab === 'preview' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                      >
                        Pré-visualizar PDF
                      </button>
                    </div>
                    {modalTab === 'edit' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => setShowAIPanel(!showAIPanel)}
                          disabled={isGeneratingAI}
                          className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm ${showAIPanel ? 'bg-purple-600 text-white' : 'bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-600 hover:text-white'} ${isGeneratingAI ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isGeneratingAI ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                          {isGeneratingAI ? 'A gerar...' : 'Gerar com IA'}
                        </button>
                      </div>
                    )}
                    {modalTab === 'preview' && blocks.length > 0 && (
                      <button
                        onClick={() => {
                          const docDef = blocksToPdfMake(blocks, {}, null);
                          pdfMake.createPdf(docDef).download(previewData.name || 'documento');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all"
                      >
                        <FileDown size={14} /> Descarregar PDF
                      </button>
                    )}
                  </div>

                  {modalTab === 'edit' ? (
                      <div className="h-[500px] overflow-y-auto">
                        {isGeneratingAI ? (
                          <div className="flex flex-col items-center justify-center h-full">
                            <Loader2 size={32} className="text-purple-600 animate-spin mb-4" />
                            <p className="text-sm font-bold text-slate-600">A gerar documento com IA...</p>
                            <p className="text-xs text-slate-400 mt-1">Aguarde um momento</p>
                          </div>
                        ) : (
                          <BlockEditor blocks={blocks} onChange={setBlocks} />
                        )}
                      </div>
                    ) : (
                    <div className="h-[500px] flex flex-col items-center justify-center bg-slate-100 rounded-b-2xl">
                      {blocks.length === 0 ? (
                        <div className="text-center px-6">
                          <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <FileDown size={24} className="text-slate-400" />
                          </div>
                          <p className="text-sm font-bold text-slate-500 mb-1">Nenhum bloco adicionado</p>
                          <p className="text-xs text-slate-400">Adicione blocos na tab Editar para ver o PDF</p>
                        </div>
                      ) : pdfLoading ? (
                        <div className="text-center px-6">
                          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Loader2 size={24} className="text-indigo-600 animate-spin" />
                          </div>
                          <p className="text-sm font-bold text-slate-500 mb-1">A gerar PDF...</p>
                          <p className="text-xs text-slate-400">Aguarde um momento</p>
                        </div>
                      ) : pdfPreviewUrl ? (
                        <iframe
                          src={pdfPreviewUrl}
                          className="w-full h-full min-h-[480px] border-0 rounded-lg"
                          title="PDF Preview"
                        />
                      ) : (
                        <div className="text-center px-6">
                          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <FileDown size={24} className="text-indigo-600" />
                          </div>
                          <p className="text-sm font-bold text-slate-700 mb-1">Pré-visualização PDF</p>
                          <p className="text-xs text-slate-500 mb-4">Clique em "Descarregar PDF" para ver o resultado</p>
                          <button
                            onClick={() => {
                              const docDef = blocksToPdfMake(blocks, {}, null);
                              pdfMake.createPdf(docDef).download(previewData.name || 'documento');
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all mx-auto"
                          >
                            <FileDown size={16} /> Descarregar PDF
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            <div className="flex justify-end gap-3 mt-10 pt-6 border-t border-slate-50">
              <button onClick={() => setShowModal(false)} className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
              <button
                onClick={saveWrapper}
                disabled={saving}
                className="flex items-center gap-3 px-10 py-4 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {editingId ? 'Gravar Alterações' : 'Criar Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showGenerateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-8 max-w-2xl w-full shadow-2xl animate-in slide-in-from-bottom-8 duration-500 border border-slate-100">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-50">
              <div className="flex items-center gap-4">
                <div className="bg-purple-600 p-3 rounded-2xl text-white shadow-lg shadow-purple-100">
                  <Send size={24} />
                </div>
                <div>
                  <h4 className="font-black text-2xl text-slate-800">Gerar Documentos</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Emissão em lote para colaboradores</p>
                </div>
              </div>
              <button onClick={() => setShowGenerateModal(false)} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">1. Escolha o Template</label>
                <select
                  value={selectedTemplate?.id || ''}
                  onChange={(e) => setSelectedTemplate(templates.find(t => t.id === e.target.value) || null)}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-purple-500 shadow-inner"
                >
                  <option value="">-- Selecionar --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">2. Selecione Colaboradores</label>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedWorkers(workers.map(w => w.id))} className="text-[9px] font-black text-indigo-600 uppercase">Todos</button>
                    <button onClick={() => setSelectedWorkers([])} className="text-[9px] font-black text-slate-400 uppercase">Limpar</button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-4 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                  {workers.map(w => (
                    <label key={w.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${selectedWorkers.includes(w.id) ? 'bg-white border-purple-500 shadow-sm' : 'bg-transparent border-transparent opacity-60'}`}>
                      <input
                        type="checkbox"
                        checked={selectedWorkers.includes(w.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedWorkers([...selectedWorkers, w.id]);
                          else setSelectedWorkers(selectedWorkers.filter(id => id !== w.id));
                        }}
                        className="hidden"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedWorkers.includes(w.id) ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                        {selectedWorkers.includes(w.id) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <span className="text-xs font-bold text-slate-700 truncate">{w.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {selectedTemplate && selectedWorkers.length > 0 && (
                <div className="bg-purple-50 p-6 rounded-[2rem] border border-purple-100 flex items-center gap-4 animate-in fade-in">
                  <div className="bg-white p-3 rounded-2xl text-purple-600 shadow-sm"><Users size={20} /></div>
                  <div>
                    <p className="text-[10px] font-black text-purple-900 uppercase tracking-widest">Pronto para gerar</p>
                    <p className="text-xs font-bold text-purple-600">Serão emitidos {selectedWorkers.length} documentos.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-10 pt-6 border-t border-slate-50">
              <button onClick={() => setShowGenerateModal(false)} className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
              <button
                onClick={generateDocumentsWrapper}
                disabled={!selectedTemplate || selectedWorkers.length === 0 || generating}
                className="flex items-center gap-3 px-10 py-4 bg-purple-600 hover:bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-purple-100 disabled:opacity-50"
              >
                {generating ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                {generating ? 'Gerando...' : 'Confirmar Geração'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedDocView && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-0 max-w-5xl w-full h-[90vh] shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-500 p-2.5 rounded-xl text-white shadow-lg shadow-emerald-100">
                  <Eye size={20} />
                </div>
                <div>
                  <h4 className="font-black text-lg text-slate-800">{selectedDocView.title}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {selectedDocView.worker?.name || 'N/A'} • {new Date(selectedDocView.created_at).toLocaleDateString('pt-PT')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const blob = new Blob([selectedDocView.generated_html], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
                    if (printWindow) {
                      printWindow.addEventListener('load', () => {
                        printWindow.print();
                        URL.revokeObjectURL(url);
                      });
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all"
                >
                  <Download size={14} /> PDF
                </button>
                <button onClick={() => setSelectedDocView(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-all">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-slate-100 p-8 overflow-y-auto shadow-inner">
              <div className="mx-auto bg-white shadow-2xl w-full max-w-[21cm] min-h-[29.7cm] p-[2cm] border border-slate-200">
                <iframe
                  srcDoc={selectedDocView.generated_html}
                  sandbox="allow-same-origin"
                  className="w-full h-full border-0"
                  style={{ height: '25cm' }}
                  title="Document Preview"
                />
              </div>
            </div>
            
            <div className="px-8 py-4 bg-white border-t border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isSigned(selectedDocView.status) ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {isSigned(selectedDocView.status) ? 'Assinado' : 'Pendente'}
                </span>
              </div>
              <p className="text-[9px] font-bold text-slate-400">DOC_ID: {selectedDocView.id}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}