import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FileText, X, Download, Loader2, Filter, FileSignature, Pencil } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDocDate } from '../../utils/dateUtils';
import { isPending, isSigned } from '../../constants/documentStatus';
import { DocumentViewer } from '../worker/DocumentViewer';
import SignDrawModal from '../worker/SignDrawModal';
import { useDocumentPreview } from './workerDocuments/useDocumentPreview';
import { useSignDocument } from './workerDocuments/useSignDocument';

const SIGNATURE_PLACEHOLDER_HTML = `<div class="mt-8 pt-6 border-t border-slate-100 opacity-30 page-break-inside-avoid"><div class="flex flex-col items-end"><div class="w-56 h-16 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center"><span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Aguardando Assinatura</span></div></div></div>`;

function injectTailwindCDN(doc) {
  doc.querySelectorAll('script[src*="tailwindcss"]').forEach(s => s.remove());
  const script = doc.createElement('script');
  script.src = 'https://cdn.tailwindcss.com';
  (doc.head || doc.documentElement).appendChild(script);
}

function injectSignaturePlaceholder(html) {
  if (!html) return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    injectTailwindCDN(doc);
    const sigArea = doc.querySelector('.signature-area');
    if (sigArea) {
      sigArea.innerHTML = SIGNATURE_PLACEHOLDER_HTML;
    } else {
      const container = doc.querySelector('.document-container') || doc.body;
      if (container) {
        const wrap = doc.createElement('div');
        wrap.innerHTML = SIGNATURE_PLACEHOLDER_HTML;
        container.appendChild(wrap.firstChild);
      }
    }
    return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
  } catch {
    return html;
  }
}

const WorkerDocuments = ({ currentUser, documents, saveToDb, pendingOnly = false }) => {
  const { supabase } = useApp();
  const [activeTab, setActiveTab] = useState(() => pendingOnly ? 'pendentes' : (localStorage.getItem('magnetic_worker_doc_tab') || 'pendentes'));
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [showFilters, setShowFilters] = useState(false);
  const [templateDocs, setTemplateDocs] = useState([]);

  useEffect(() => {
    localStorage.setItem('magnetic_worker_doc_tab', activeTab);
  }, [activeTab]);

  const loadTemplateDocs = useCallback(async () => {
    if (!currentUser?.id || !supabase) return;
    try {
      const { data } = await supabase
        .from('worker_documents')
        .select('*')
        .eq('worker_id', currentUser.id)
        .order('created_at', { ascending: false });
      setTemplateDocs(data || []);
    } catch (err) {
      console.error('Erro ao carregar documentos de templates:', err);
    }
  }, [currentUser?.id, supabase]);

  useEffect(() => { loadTemplateDocs(); }, [loadTemplateDocs]);

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showSigner, setShowSigner] = useState(false);
  const [showSignPad, setShowSignPad] = useState(false);
  const [acroformDoc, setAcroformDoc] = useState(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [workerIp, setWorkerIp] = useState('A obter IP...');
  const [signerOpenedAt, setSignerOpenedAt] = useState('');
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  const openDoc = useCallback((doc) => {
    const isAcroform = !!(doc.template_id || doc.templateId) && !doc.generated_html;
    if (isAcroform) {
      setAcroformDoc(doc);
    } else {
      setSelectedDoc(doc);
      setShowSigner(true);
    }
  }, []);

  const { previewBlobUrl, previewSrcDoc, previewError, previewMime } = useDocumentPreview(showSigner, selectedDoc);

  const { signing, handleSign } = useSignDocument({
    currentUser,
    saveToDb,
    signerOpenedAt,
    workerIp,
    canvasRef,
  });

  useEffect(() => {
    if (showSigner && canvasRef.current) {
      const timer = setTimeout(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = window.innerWidth < 640 ? 140 : 200;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#4f46e5';
        setHasSignature(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showSigner]);

  useEffect(() => {
    if (showSigner) {
      setSignerOpenedAt(new Date().toISOString());
      fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => setWorkerIp(data.ip || 'Desconhecido'))
        .catch(() => setWorkerIp('Desconhecido'));
    }
  }, [showSigner]);

  const docs = useMemo(
    () => documents?.filter(d => d.workerId === currentUser?.id && d.status !== 'Rascunho') || [],
    [documents, currentUser?.id]
  );
  const pendentes = useMemo(() => {
    const combined = docs.filter(d => isPending(d.status)).concat(templateDocs.filter(d => isPending(d.status)));
    return [...new Map(combined.map(d => [d.id, d])).values()];
  }, [docs, templateDocs]);
  const historico = useMemo(() => {
    const combined = docs.filter(d => isSigned(d.status)).concat(templateDocs.filter(d => isSigned(d.status)));
    return [...new Map(combined.map(d => [d.id, d])).values()];
  }, [docs, templateDocs]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e) => {
    isDrawing.current = true;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSignature) setHasSignature(true);
  };

  const stopDrawing = () => {
    if (isDrawing.current && canvasRef.current) {
      canvasRef.current.getContext('2d').closePath();
      isDrawing.current = false;
    }
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const onSignComplete = async (signatureDataURL) => {
    const result = await handleSign(signatureDataURL, selectedDoc);
    if (!result) return;
    if (result.type === 'template') {
      setTemplateDocs(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, ...result.docData } : d));
    }
    alert('Documento assinado com sucesso!');
    setShowSignPad(false);
    setShowSigner(false);
    setSelectedDoc(null);
    clearCanvas();
  };

  const docList = useMemo(() => {
    let list = (pendingOnly || activeTab === 'pendentes') ? pendentes : historico;
    if (pendingOnly) return list.slice(0, 5);
    if (activeTab === 'historico') {
      if (filterType !== 'all') list = list.filter(d => (d.tipo || d.title || '') === filterType);
      list = [...list].sort((a, b) => {
        if (sortBy === 'date_desc') return (b.dataAssinatura || b.signed_at || b.dataEmissao || b.created_at || '').localeCompare(a.dataAssinatura || a.signed_at || a.dataEmissao || a.created_at || '');
        if (sortBy === 'date_asc') return (a.dataAssinatura || a.signed_at || a.dataEmissao || a.created_at || '').localeCompare(b.dataAssinatura || b.signed_at || b.dataEmissao || b.created_at || '');
        if (sortBy === 'name_asc') return (a.tipo || a.title || '').localeCompare(b.tipo || b.title || '');
        if (sortBy === 'name_desc') return (b.tipo || b.title || '').localeCompare(a.tipo || a.title || '');
        return 0;
      });
    }
    return list;
  }, [activeTab, pendentes, historico, filterType, sortBy, pendingOnly]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(historico.map(d => d.tipo || d.title).filter(Boolean));
    return Array.from(types).sort();
  }, [historico]);

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-indigo-50/50 mt-8">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
        <FileText size={20} className="text-indigo-600" />
        <h3 className="font-black text-lg uppercase tracking-tight text-slate-800">
          {pendingOnly ? 'Documentos Por Assinar' : 'Os Meus Documentos'}
        </h3>
      </div>

      {!pendingOnly && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
            <button onClick={() => setActiveTab('pendentes')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pendentes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              Pendentes ({pendentes.length})
            </button>
            <button onClick={() => setActiveTab('historico')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'historico' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              Histórico ({historico.length})
            </button>
          </div>
          {activeTab === 'historico' && (
            <button onClick={() => setShowFilters(!showFilters)}
              className={`ml-auto p-1.5 rounded-xl transition-all ${showFilters ? 'bg-white text-indigo-600 shadow-sm' : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
              <Filter size={16} />
            </button>
          )}
        </div>
      )}

      {!pendingOnly && activeTab === 'historico' && showFilters && (
        <div className="bg-slate-50 rounded-xl p-4 mb-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Tipo:</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-bold">
              <option value="all">Todos</option>
              {uniqueTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Ordenar:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-bold">
              <option value="date_desc">Mais Recentes</option>
              <option value="date_asc">Mais Antigos</option>
              <option value="name_asc">Nome (A-Z)</option>
              <option value="name_desc">Nome (Z-A)</option>
            </select>
          </div>
          <span className="text-xs text-slate-400 ml-auto">{docList.length} documento(s)</span>
        </div>
      )}

      {docList.length === 0 ? (
        <p className="text-slate-400 text-center py-8">{pendingOnly ? 'Nenhum documento por assinar.' : 'Nenhum documento.'}</p>
      ) : (
        <div className="space-y-3">
          {docList.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                {doc.templateId ? <FileSignature size={18} className="text-purple-500" /> : <FileText size={18} className="text-indigo-500" />}
                <div>
                  <p className="text-sm font-bold text-slate-700">{doc.tipo || doc.title}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-slate-400">Emitido: {formatDocDate(doc.dataEmissao || doc.created_at)}</p>
                    {isSigned(doc.status) && (doc.dataAssinatura || doc.signed_at) && (
                      <>
                        <span className="text-slate-300">|</span>
                        <p className="text-[10px] text-emerald-600 font-bold">
                          Assinado: {new Date(doc.dataAssinatura || doc.signed_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${isPending(doc.status) ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {isPending(doc.status) ? 'Pendente' : 'Assinado'}
                </span>
                {isPending(doc.status) ? (
                  <button onClick={() => openDoc(doc)}
                    className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl"
                    title="Assinar documento">
                    <Pencil size={18} />
                  </button>
                ) : (
                  <a href={doc.pdfAssinadoUrl || doc.signed_pdf_url || doc.url} target="_blank" rel="noopener noreferrer"
                    className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl">
                    <Download size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showSigner && selectedDoc && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-stretch sm:items-center justify-center p-2 sm:p-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-6 max-w-5xl w-full h-full sm:h-[92vh] overflow-y-auto flex flex-col gap-3 sm:gap-4">
              <div className="flex justify-between items-center">
                <h4 className="font-black text-base sm:text-lg truncate pr-2">{selectedDoc.tipo || selectedDoc.title}</h4>
                <button onClick={() => { setShowSigner(false); setShowSignPad(false); clearCanvas(); }}
                  className="p-2 hover:bg-slate-100 rounded-xl shrink-0"><X size={20} /></button>
              </div>
              <div className="w-full flex-1 min-h-[60vh] sm:min-h-[70vh] border rounded-xl bg-slate-100 relative overflow-hidden">
                {selectedDoc.url ? (
                  <>
                    {previewSrcDoc ? (
                      <iframe srcDoc={previewSrcDoc} sandbox="allow-scripts" className="w-full h-full rounded-xl" title="Pré-visualização do documento" />
                    ) : previewBlobUrl ? (
                      previewMime.startsWith('image/') ? (
                        <img src={previewBlobUrl} alt="Pré-visualização" className="max-w-full max-h-full m-auto block rounded-xl" />
                      ) : (
                        <iframe src={`${previewBlobUrl}#toolbar=0&view=FitH`} className="w-full h-full rounded-xl" title="Pré-visualização do documento" />
                      )
                    ) : previewError ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-center">
                        <p className="text-rose-600 text-sm font-bold">Erro a carregar: {previewError}</p>
                        <a href={selectedDoc.url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-xl">
                          Abrir noutra aba
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                      </div>
                    )}
                  </>
                ) : selectedDoc.generated_html ? (
                  <iframe srcDoc={injectSignaturePlaceholder(selectedDoc.generated_html)} sandbox="allow-scripts" className="w-full h-full rounded-xl" title="Document Preview" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-slate-400">Documento não disponível</p>
                  </div>
                )}
              </div>
              <button onClick={() => setShowSignPad(true)} disabled={signing}
                className="w-full py-4 sm:py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {signing ? <><Loader2 size={18} className="animate-spin" /> A processar...</> : <><FileSignature size={18} /> Assinar Digitalmente</>}
              </button>
            </div>
          </div>
          {showSignPad && (
            <SignDrawModal
              workerName={currentUser?.name || currentUser?.nome}
              working={signing}
              onClose={() => setShowSignPad(false)}
              onSign={onSignComplete}
            />
          )}
        </>
      )}

      {acroformDoc && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <DocumentViewer
            document={acroformDoc}
            onBack={() => { setAcroformDoc(null); loadTemplateDocs(); }}
            onSigned={() => { setAcroformDoc(null); loadTemplateDocs(); alert('Documento assinado com sucesso!'); }}
          />
        </div>
      )}
    </div>
  );
};

export default WorkerDocuments;
