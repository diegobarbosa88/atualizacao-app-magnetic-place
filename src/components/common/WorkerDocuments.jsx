import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FileText, Download, Loader2, Filter, FileSignature, Pencil, GraduationCap, HeartPulse, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDocDate } from '../../utils/dateUtils';
import { isPending, isSigned } from '../../constants/documentStatus';
import { DocumentViewer } from '../worker/DocumentViewer';
import SignDrawModal from '../worker/SignDrawModal';
import ModalShell from './ModalShell';
import { useDocumentPreview } from './workerDocuments/useDocumentPreview';
import { useSignDocument } from './workerDocuments/useSignDocument';
import { FT, FONT_TITLE, FONT_MONO } from '../../styles/designTokens';

const CATEGORY_RULES = [
  { key: 'formacao', label: 'Formação Interna', icon: GraduationCap, test: t => /forma[cç][aã]o|certificado/i.test(t) },
  { key: 'saude', label: 'Saúde e Segurança', icon: HeartPulse, test: t => /aptid[aã]o|sa[uú]de|seguran[cç]a|\bepi\b/i.test(t) },
  { key: 'contratual', label: 'Contratuais', icon: FileText, test: t => /contrato|adenda|admiss[aã]o/i.test(t) },
];
const OTHER_CATEGORY = { key: 'outros', label: 'Outros Documentos', icon: FileText };

function categorizeDoc(doc) {
  const t = doc.tipo || doc.title || '';
  return CATEGORY_RULES.find(c => c.test(t)) || OTHER_CATEGORY;
}

function groupDocsByCategory(list) {
  const groups = new Map();
  list.forEach(doc => {
    const cat = categorizeDoc(doc);
    if (!groups.has(cat.key)) groups.set(cat.key, { ...cat, docs: [] });
    groups.get(cat.key).docs.push(doc);
  });
  return Array.from(groups.values());
}

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

function DocRow({ doc, openDoc }) {
  const pending = isPending(doc.status);
  const signed = isSigned(doc.status);
  const isTemplate = !!(doc.templateId || doc.template_id);
  return (
    <div
      className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3"
      style={{ border: `1px solid ${pending ? '#EFD9AE' : FT.border}` }}
    >
      {/* Ícone */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: pending ? FT.warnBg : FT.okBg }}>
        {isTemplate
          ? <FileSignature size={16} style={{ color: pending ? FT.warn : FT.ok }} />
          : <FileText size={16} style={{ color: pending ? FT.warn : FT.ok }} />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-slate-800 truncate">{doc.tipo || doc.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] text-slate-400">Emitido: {formatDocDate(doc.dataEmissao || doc.created_at)}</span>
          {signed && (doc.dataAssinatura || doc.signed_at) && (
            <span className="text-[10px] font-bold" style={{ color: FT.ok }}>
              · Assinado {new Date(doc.dataAssinatura || doc.signed_at).toLocaleDateString('pt-PT')}
            </span>
          )}
        </div>
      </div>

      {/* Acção */}
      {pending ? (
        <button
          onClick={() => openDoc(doc)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-white rounded-xl text-[10px] font-black uppercase tracking-wide transition-all active:scale-95"
          style={{ fontFamily: FONT_MONO, background: FT.orange }}
        >
          <Pencil size={12} /> Assinar
        </button>
      ) : (
        <a
          href={doc.pdfAssinadoUrl || doc.signed_pdf_url || doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-2 text-slate-300 hover:bg-[#1B3A57]/10 hover:text-[var(--navy)] rounded-xl transition-all"
        >
          <Download size={15} />
        </a>
      )}
    </div>
  );
}

const WorkerDocuments = ({ currentUser, documents, saveToDb, pendingOnly = false }) => {
  const { supabase } = useApp();
  const [activeTab, setActiveTab] = useState(() => pendingOnly ? 'pendentes' : (localStorage.getItem('magnetic_worker_doc_tab') || 'pendentes'));
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [showFilters, setShowFilters] = useState(false);
  const [templateDocs, setTemplateDocs] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(null); // null = default (primeiro grupo aberto)
  const toggleGroup = (key) => setExpandedGroups(prev => {
    const base = prev || {};
    return { ...base, [key]: !(base[key] ?? false) };
  });

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
    const manual = docs.filter(d => isPending(d.status) && d.visivel_worker === true);
    const template = templateDocs.filter(d => isPending(d.status));
    return [...new Map([...manual, ...template].map(d => [d.id, d])).values()];
  }, [docs, templateDocs]);
  const historico = useMemo(() => {
    const manual = docs.filter(d => isSigned(d.status) && d.visivel_worker === true);
    const template = templateDocs.filter(d => isSigned(d.status));
    return [...new Map([...manual, ...template].map(d => [d.id, d])).values()];
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

  const docGroups = useMemo(() => {
    if (pendingOnly || activeTab !== 'historico') return null;
    return groupDocsByCategory(docList);
  }, [pendingOnly, activeTab, docList]);

  return (
    <div className="space-y-4 mb-6">

      {/* Tabs */}
      {!pendingOnly && (
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: '#F4F2EC' }}>
          <button
            onClick={() => setActiveTab('pendentes')}
            className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            style={{ fontFamily: FONT_MONO, background: activeTab === 'pendentes' ? '#fff' : 'transparent', color: activeTab === 'pendentes' ? FT.navy : FT.slateDim, boxShadow: activeTab === 'pendentes' ? '0 1px 2px rgba(18,39,65,.08)' : 'none' }}
          >
            Pendentes{pendentes.length > 0 && ` (${pendentes.length})`}
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1"
            style={{ fontFamily: FONT_MONO, background: activeTab === 'historico' ? '#fff' : 'transparent', color: activeTab === 'historico' ? FT.navy : FT.slateDim, boxShadow: activeTab === 'historico' ? '0 1px 2px rgba(18,39,65,.08)' : 'none' }}
          >
            Histórico{historico.length > 0 && ` (${historico.length})`}
            {activeTab === 'historico' && (
              <button
                onClick={e => { e.stopPropagation(); setShowFilters(!showFilters); }}
                className="ml-1 p-0.5 rounded transition-colors"
                style={{ color: showFilters ? FT.navy : FT.slateDim }}
              >
                <Filter size={11} />
              </button>
            )}
          </button>
        </div>
      )}

      {/* Filtros histórico */}
      {!pendingOnly && activeTab === 'historico' && showFilters && (
        <div className="bg-white rounded-2xl px-4 py-3 flex flex-wrap gap-3 items-center" style={{ border: `1px solid ${FT.border}` }}>
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-black uppercase" style={{ fontFamily: FONT_MONO, color: FT.slateDim }}>Tipo</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="px-2 py-1 rounded-lg text-xs font-bold outline-none" style={{ background: '#F4F2EC', border: `1px solid ${FT.border}` }}>
              <option value="all">Todos</option>
              {uniqueTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-black uppercase" style={{ fontFamily: FONT_MONO, color: FT.slateDim }}>Ordenar</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="px-2 py-1 rounded-lg text-xs font-bold outline-none" style={{ background: '#F4F2EC', border: `1px solid ${FT.border}` }}>
              <option value="date_desc">Mais Recentes</option>
              <option value="date_asc">Mais Antigos</option>
              <option value="name_asc">Nome (A-Z)</option>
              <option value="name_desc">Nome (Z-A)</option>
            </select>
          </div>
          <span className="text-[9px] ml-auto" style={{ color: FT.slateDim }}>{docList.length} doc(s)</span>
        </div>
      )}

      {/* Lista */}
      {docList.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <p className="text-sm font-bold">{pendingOnly ? 'Nenhum documento por assinar.' : 'Nenhum documento.'}</p>
        </div>
      ) : docGroups ? (
        <div className="space-y-2.5">
          {docGroups.map((group, idx) => {
            const isOpen = expandedGroups ? (expandedGroups[group.key] ?? false) : idx === 0;
            const GroupIcon = group.icon;
            return (
              <div key={group.key}>
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl mb-2"
                  style={{ background: `${FT.navy}0D`, border: `1px solid ${FT.border}` }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: FT.navyDeep, color: FT.orange }}>
                    <GroupIcon size={13} />
                  </div>
                  <span className="flex-1 text-left font-bold uppercase text-sm tracking-tight" style={{ fontFamily: FONT_TITLE, color: FT.navyDeep }}>{group.label}</span>
                  <span className="text-[9px] font-black rounded-full px-2 py-0.5 text-white shrink-0" style={{ fontFamily: FONT_MONO, background: FT.navy }}>{group.docs.length}</span>
                  {isOpen ? <ChevronUp size={14} style={{ color: FT.navy }} /> : <ChevronDown size={14} style={{ color: FT.slate }} />}
                </button>
                {isOpen && (
                  <div className="space-y-2 mb-1">
                    {group.docs.map(doc => <DocRow key={doc.id} doc={doc} openDoc={openDoc} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {docList.map(doc => <DocRow key={doc.id} doc={doc} openDoc={openDoc} />)}
        </div>
      )}

      {showSigner && selectedDoc && (
        <>
          <ModalShell
            isOpen
            onClose={() => { setShowSigner(false); setShowSignPad(false); clearCanvas(); }}
            busy={signing}
            closeOnOverlay={false}
            subtitle="Assinar Documento"
            title={selectedDoc.tipo || selectedDoc.title}
            icon={<FileSignature size={20} />}
            accent="brand"
            size="5xl"
            layer="nested"
            footer={
              <div className="px-3 sm:px-6 py-3 sm:py-4">
                <button onClick={() => setShowSignPad(true)} disabled={signing}
                  className="w-full py-4 sm:py-5 text-white rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: FT.orange }}
                  onMouseEnter={e => { if (!signing) e.currentTarget.style.background = FT.orangeDeep; }}
                  onMouseLeave={e => { e.currentTarget.style.background = FT.orange; }}
                >
                  {signing ? <><Loader2 size={18} className="animate-spin" /> A processar...</> : <><FileSignature size={18} /> Assinar Digitalmente</>}
                </button>
              </div>
            }
          >
            <div className="p-3 sm:p-6">
              <div className="w-full min-h-[60vh] sm:min-h-[70vh] border rounded-xl bg-slate-100 relative overflow-hidden">
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
                        <a href={selectedDoc.url} target="_blank" rel="noreferrer" className="px-4 py-2 text-white text-xs font-black uppercase tracking-widest rounded-xl" style={{ background: FT.orange }}>
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
            </div>
          </ModalShell>
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
