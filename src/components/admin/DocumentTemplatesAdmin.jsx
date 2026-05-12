import React, { useState, useEffect, useRef, useMemo } from 'react';
import { isSigned } from '../../constants/documentStatus';
import { FileText, Plus, Edit2, Trash2, X, Save, Eye, Code, ChevronDown, ChevronUp, Send, Users, Loader2, Download, Search, CheckCircle, Clock, FileSignature, Sparkles } from 'lucide-react';
import { TEMPLATE_FIELDS } from '../../utils/templateFields';
import { getPreviewHtml } from '../../utils/dragPreviewUtils';
import { useApp } from '../../context/AppContext';
import { useDocumentTemplates, DEFAULT_TEMPLATE, SIGNATURE_PLACEHOLDER_HTML, QRCODE_PLACEHOLDER_HTML, extractPositionsFromHtml } from '../../hooks/useDocumentTemplates';

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
    description: '',
    html_content: DEFAULT_TEMPLATE
  });
  const [showFieldList, setShowFieldList] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
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
  const editorRef = useRef(null);

  useEffect(() => {
    if (!editingId) {
      setPreviewPositions({});
      return;
    }
    const html = previewData.html_content;
    if (!html) return;
    const extracted = extractPositionsFromHtml(html);
    setPreviewPositions(extracted);
  }, [editingId, previewData.html_content]);

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

  const insertField = (tag) => {
    const editor = editorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = previewData.html_content;
    const before = text.substring(0, start);
    const after = text.substring(end);

    setPreviewData({
      ...previewData,
      html_content: before + tag + after
    });

    setShowFieldList(false);
  };

  const insertSignaturePlaceholder = () => {
    const signatureHtml = SIGNATURE_PLACEHOLDER_HTML;
    const qrcodeHtml = QRCODE_PLACEHOLDER_HTML;
    const combined = (signatureHtml + '\n' + qrcodeHtml).trim();
    if (!combined) return;

    const editor = editorRef.current;
    if (editor) {
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const text = previewData.html_content;
      setPreviewData({
        ...previewData,
        html_content: text.substring(0, start) + '\n' + combined + text.substring(end)
      });
    } else {
      setPreviewData(prev => ({
        ...prev,
        html_content: prev.html_content + '\n' + combined
      }));
    }

    setPreviewPositions(prev => {
      const next = { ...prev };
      if (!next['worker-signature-placeholder']) {
        next['worker-signature-placeholder'] = { left: '0px', top: '0px' };
      }
      if (!next['worker-qrcode-placeholder']) {
        next['worker-qrcode-placeholder'] = { left: '0px', top: '0px' };
      }
      return next;
    });
  };

  const generateAIWrapper = async () => {
    setIsGeneratingAI(true);
    try {
      const generatedHtml = await handleGenerateAI(aiPrompt);
      setPreviewData({ ...previewData, html_content: generatedHtml });
      const newPositions = extractPositionsFromHtml(generatedHtml);
      setPreviewPositions(newPositions);
      setShowAIPanel(false);
      setAiPrompt('');
    } catch (err) {
      alert("Erro ao gerar com IA: " + err.message);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const saveWrapper = async () => {
    let finalHtml = previewData.html_content;

    const ids = Object.keys(previewPositions);
    const livePositions = {};

    if (iframeRef.current && iframeRef.current.contentDocument) {
      ids.forEach(id => {
        const el = iframeRef.current.contentDocument.getElementById(id);
        if (el) {
          livePositions[id] = {
            left: el.style.left || '0px',
            top: el.style.top || '0px'
          };
        }
      });
    }

    const positionsToSave = ids.length > 0 && Object.keys(livePositions).length > 0 ? livePositions : previewPositions;

    const replaceStyleValue = (styleStr, propName, newVal) => {
      const propIdx = styleStr.indexOf(propName + ':');
      if (propIdx === -1) {
        return styleStr + propName + ':' + newVal + ';';
      }
      const valStart = propIdx + propName.length + 1;
      let valEnd = styleStr.indexOf(';', valStart);
      const pctIdx = styleStr.indexOf('%', valStart);
      if (pctIdx !== -1 && (valEnd === -1 || pctIdx < valEnd)) {
        valEnd = pctIdx + 1;
      }
      if (valEnd === -1 || valEnd <= valStart) {
        valEnd = styleStr.length;
      }
      let result = styleStr.substring(0, valStart) + newVal + styleStr.substring(valEnd);
      if (pctIdx !== -1 && (valEnd === -1 || pctIdx < valEnd)) {
        result = result.replace('%', 'px');
      }
      return result;
    };

    ids.forEach(id => {
      const pos = positionsToSave[id];
      if (!pos) return;
      const openTag = '<div id="' + id + '"';
      let idx = finalHtml.indexOf(openTag);
      while (idx !== -1) {
        const styleStart = finalHtml.indexOf('style="', idx);
        if (styleStart === -1 || styleStart > idx + 300) break;
        const styleEndQuote = finalHtml.indexOf('"', styleStart + 7);
        if (styleEndQuote === -1) break;
        const styleVal = finalHtml.substring(styleStart + 7, styleEndQuote);
        let updated = replaceStyleValue(styleVal, 'left', pos.left || '0px');
        updated = replaceStyleValue(updated, 'top', pos.top || '0px');
        finalHtml = finalHtml.substring(0, styleStart + 7) + updated + finalHtml.substring(styleEndQuote + 1);
        idx = finalHtml.indexOf(openTag, idx + 1);
      }
    });
    try {
      await handleSave({ ...previewData, html_content: finalHtml }, editingId);
      setShowModal(false);
    } catch (err) {
      alert("Erro ao gravar: " + err.message);
    }
  };

  const generateDocumentsWrapper = async () => {
    if (!selectedTemplate || selectedWorkers.length === 0) return;
    setGenerating(true);
    try {
      const result = await handleGenerateDocuments(selectedTemplate, selectedWorkers, workers, systemSettings, previewPositions);
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(previewData.html_content)
      .then(() => alert('Código HTML copiado!'))
      .catch(() => alert('Não foi possível copiar. Selecione o código manualmente.'));
  };

  const previewHtml = () => {
    const mockWorker = workers[0] || { name: 'Nome Exemplo', role: 'Função Exemplo' };
    return getPreviewHtml(previewData.html_content, mockWorker, systemSettings);
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
              setPreviewData({ name: '', description: '', html_content: DEFAULT_TEMPLATE });
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
                        description: t.description,
                        html_content: t.html_content
                      });
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código HTML</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowAIPanel(!showAIPanel)}
                        className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all shadow-sm ${showAIPanel ? 'bg-purple-600 text-white' : 'bg-purple-50 border border-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white'}`}
                      >
                        <Sparkles size={14} /> Gerar com IA
                      </button>
                      <button 
                        onClick={() => setShowFieldList(!showFieldList)}
                        className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-tighter bg-white border border-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                      >
                        <Code size={14} /> Placeholders
                        {showFieldList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button
                        onClick={insertSignaturePlaceholder}
                        className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-tighter bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                      >
                        <FileSignature size={14} /> Assinatura
                      </button>
                    </div>
                  </div>
                  
                  {showAIPanel && (
                    <div className="p-4 bg-purple-50 border-b border-purple-100 animate-in slide-in-from-top-2">
                      <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-2 ml-1">Descreva o documento que deseja:</p>
                      <div className="flex gap-2">
                        <textarea
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="Ex: Contrato de prestação de serviços com cláusula de confidencialidade..."
                          className="flex-1 p-3 bg-white border border-purple-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 min-h-[80px]"
                        />
                        <button
                          onClick={generateAIWrapper}
                          disabled={isGeneratingAI || !aiPrompt.trim()}
                          className="px-4 bg-purple-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-2 min-w-[80px]"
                        >
                          {isGeneratingAI ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                          {isGeneratingAI ? '...' : 'Gerar'}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {showFieldList && (
                    <div className="p-4 bg-white grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border-b border-slate-100">
                      {TEMPLATE_FIELDS.map(field => (
                        <button
                          key={field.tag}
                          onClick={() => insertField(field.tag)}
                          className="text-left px-3 py-2 bg-slate-50 hover:bg-indigo-50 rounded-xl border border-slate-100 transition-all"
                        >
                          <p className="font-mono text-[10px] font-black text-indigo-600">{field.tag}</p>
                          <p className="text-[9px] text-slate-400">{field.label}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <textarea
                    ref={editorRef}
                    value={previewData.html_content}
                    onChange={(e) => setPreviewData({ ...previewData, html_content: e.target.value })}
                    className="w-full h-80 p-6 font-mono text-xs border-0 resize-none outline-none bg-white text-slate-600"
                    spellCheck={false}
/>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col bg-slate-50 rounded-[2.5rem] p-4 border border-slate-100 shadow-inner overflow-hidden" style={{ height: `${previewHeight}px` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Preview</div>
                    <button
                      onClick={() => setShowPreviewSettings(!showPreviewSettings)}
                      className="text-[9px] font-black text-indigo-600 uppercase tracking-wider hover:text-indigo-800 transition-colors"
                    >
                      {showPreviewSettings ? 'Ocultar' : 'Ajustar'} Tamanho
                    </button>
                  </div>
                  {showPreviewSettings && (
                    <div className="flex items-center gap-3 mb-2 p-2 bg-white rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Altura:</span>
                      <input
                        type="range"
                        min="300"
                        max="800"
                        value={previewHeight}
                        onChange={(e) => setPreviewHeight(parseInt(e.target.value))}
                        className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <span className="text-[9px] font-black text-indigo-600 tabular-nums">{previewHeight}px</span>
                      <div className="w-px h-4 bg-slate-200" />
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Zoom:</span>
                      <input
                        type="range"
                        min="50"
                        max="200"
                        value={previewZoom}
                        onChange={(e) => setPreviewZoom(parseInt(e.target.value))}
                        className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <span className="text-[9px] font-black text-indigo-600 tabular-nums">{previewZoom}%</span>
                    </div>
                  )}
                  <div className="flex-1 overflow-auto rounded-xl bg-slate-100 p-4 flex justify-center">
                    <div style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top center', display: 'inline-block' }}>
                      <iframe
                        ref={iframeRef}
                        srcDoc={previewHtml()}
                        className="bg-white shadow-xl"
                        title="Preview"
                        style={{ width: '794px', height: '1123px' }}
                      />
                    </div>
                  </div>
                </div>
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