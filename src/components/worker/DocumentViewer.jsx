import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, FileText, CheckCircle, Download, Loader2,
  AlertCircle, FileSignature, X, RefreshCw, Eye,
} from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { useApp } from '../../context/AppContext';
import { isSigned } from '../../constants/documentStatus';
import {
  downloadTemplateBytes,
  renderDocx,
  buildRenderData,
  isKnownField,
  triggerDocxDownload,
  TEMPLATES_BUCKET,
} from '../../utils/docxTemplateService';
import { convertDocxToPdf, isCloudConvertConfigured } from '../../utils/cloudConvertService';
import { addSignatureProtocolPage, formatSerialLabel } from '../../utils/pdfSigningService';
import { generateQRCodeDataURL } from '../../hooks/useSignatureStamp';

const PREP_STEPS = [
  { id: 'filling',   label: 'A preencher template Word' },
  { id: 'rendering', label: 'A renderizar pré-visualização' },
];

const SIGN_STEPS = [
  { id: 'converting', label: 'A converter Word para PDF' },
  { id: 'stamping',   label: 'A aplicar assinatura e protocolo' },
  { id: 'uploading',  label: 'A arquivar PDF assinado' },
];

async function fetchCompanyLogoBytes(systemSettings) {
  const raw = systemSettings?.companyLogo || 'MAGNETIC (3).png';
  const url = raw.startsWith('http') || raw.startsWith('/') ? raw : '/' + raw;
  try {
    const res = await fetch(encodeURI(url));
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.warn('Logo da empresa não disponível:', err.message);
    return null;
  }
}

export function DocumentViewer({ document: docRecord, onBack, onSigned }) {
  const { supabase, systemSettings } = useApp();
  const [workerData, setWorkerData] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [phase, setPhase] = useState('idle');
  const [stepStatus, setStepStatus] = useState({});
  const [pipelineError, setPipelineError] = useState('');

  const [filledDocxBlob, setFilledDocxBlob] = useState(null);
  const previewContainerRef = useRef(null);

  const [signedBlobUrl, setSignedBlobUrl] = useState(docRecord.signed_pdf_url || null);
  const [signedBytes, setSignedBytes] = useState(null);

  const [showSignature, setShowSignature] = useState(false);
  const [workerIp, setWorkerIp] = useState('Desconhecido');

  const documentIsSigned = isSigned(docRecord.status);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: workerRow, error: wErr } = await supabase
          .from('workers').select('*').eq('id', docRecord.worker_id).single();
        if (wErr) throw wErr;

        const { data: tmplRow, error: tErr } = await supabase
          .from('document_templates').select('*').eq('id', docRecord.template_id).single();
        if (tErr) throw tErr;
        if (!tmplRow.template_docx_path) throw new Error('Template não tem ficheiro .docx associado.');

        if (cancelled) return;
        setWorkerData(workerRow || {});
        setTemplate(tmplRow);
      } catch (err) {
        console.error('Erro ao carregar documento:', err);
        if (!cancelled) setError(err.message || 'Erro a carregar o documento.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [supabase, docRecord.worker_id, docRecord.template_id]);

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json()).then(d => setWorkerIp(d.ip || 'Desconhecido'))
      .catch(() => setWorkerIp('Desconhecido'));
  }, []);

  useEffect(() => {
    return () => {
      if (signedBlobUrl?.startsWith('blob:')) URL.revokeObjectURL(signedBlobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStep = (id, status) => setStepStatus(prev => ({ ...prev, [id]: status }));

  const preparePreview = useCallback(async () => {
    if (!template || !workerData) return;
    if (documentIsSigned) return;
    setPipelineError('');
    setStepStatus({});
    setPhase('preparing');

    try {
      setStep('filling', 'active');
      const tmplBuffer = await downloadTemplateBytes(supabase, template.template_docx_path);
      const renderData = buildRenderData(workerData, systemSettings || {});
      const blob = renderDocx(tmplBuffer, renderData);
      setStep('filling', 'done');

      setStep('rendering', 'active');
      setFilledDocxBlob(blob);
      setPhase('preview-ready');
    } catch (err) {
      console.error('preparePreview erro:', err);
      setPipelineError(err.message || 'Falha a preparar o documento.');
      setStepStatus(prev => {
        const next = { ...prev };
        for (const s of PREP_STEPS) if (next[s.id] === 'active') next[s.id] = 'error';
        return next;
      });
      setPhase('error');
    }
  }, [template, workerData, documentIsSigned, supabase, systemSettings]);

  useEffect(() => {
    if (loading) return;
    if (documentIsSigned) return;
    if (!template || !workerData) return;
    if (phase !== 'idle') return;
    preparePreview();
  }, [loading, documentIsSigned, template, workerData, phase, preparePreview]);

  useEffect(() => {
    if (phase !== 'preview-ready') return;
    if (!filledDocxBlob) return;
    const container = previewContainerRef.current;
    if (!container) return;

    let cancelled = false;
    let resizeObserver = null;
    container.innerHTML = '';

    const applyFitToWidth = () => {
      const wrapper =
        container.querySelector('.docx-preview-wrapper') ||
        container.querySelector('.docx-wrapper') ||
        container.firstElementChild;
      if (!wrapper) return;

      // Neutralizar o CSS predefinido do docx-preview (display:flex;align-items:center;padding:30px)
      // que centra as páginas e produz overflow cortado dos dois lados.
      wrapper.style.padding = '0';
      wrapper.style.display = 'block';
      wrapper.style.alignItems = '';
      wrapper.style.transform = '';
      wrapper.style.width = '';
      wrapper.style.height = '';
      wrapper.style.transformOrigin = 'top left';

      const firstPage =
        wrapper.querySelector('section.docx-preview') ||
        wrapper.querySelector('section.docx') ||
        wrapper.querySelector('section');
      if (!firstPage) return;
      const naturalWidth = firstPage.offsetWidth || 794;
      const availableWidth = container.clientWidth - 32;
      const scale = Math.min(1, availableWidth / naturalWidth);
      if (scale >= 1) return;

      const naturalHeight = wrapper.scrollHeight;
      wrapper.style.transform = `scale(${scale})`;
      wrapper.style.width = `${naturalWidth * scale}px`;
      wrapper.style.height = `${naturalHeight * scale}px`;
    };

    renderAsync(filledDocxBlob, container, undefined, {
      className: 'docx-preview',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      experimental: false,
      trimXmlDeclaration: true,
      debug: false,
    })
      .then(() => {
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (cancelled) return;
          applyFitToWidth();
          resizeObserver = new ResizeObserver(() => {
            if (!cancelled) applyFitToWidth();
          });
          resizeObserver.observe(container);
          setStep('rendering', 'done');
        });
      })
      .catch(err => {
        if (cancelled) return;
        console.error('docx-preview falhou:', err);
        setPipelineError('Falha a renderizar pré-visualização: ' + (err.message || 'erro desconhecido'));
        setStep('rendering', 'error');
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
    };
  }, [phase, filledDocxBlob]);

  const applySignature = useCallback(async (signatureDataUrl) => {
    if (!filledDocxBlob) return;
    setShowSignature(false);
    setPhase('applying');
    setPipelineError('');
    setStepStatus(prev => {
      const cleaned = { ...prev };
      for (const s of SIGN_STEPS) delete cleaned[s.id];
      return cleaned;
    });

    try {
      setStep('converting', 'active');
      const pdfBlob = await convertDocxToPdf(filledDocxBlob);
      const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
      setStep('converting', 'done');

      setStep('stamping', 'active');
      const signedAt = new Date().toISOString();
      const { data: serialData, error: serialErr } = await supabase.rpc('next_signature_serial');
      if (serialErr) throw new Error(`Falha a obter número de série: ${serialErr.message}`);
      const serial = Number(serialData);
      const serialLabel = formatSerialLabel(serial);

      const [qrDataUrl, companyLogoBytes] = await Promise.all([
        generateQRCodeDataURL(docRecord.id),
        fetchCompanyLogoBytes(systemSettings),
      ]);

      const signedPdfBytes = await addSignatureProtocolPage(pdfBytes, {
        workerName: workerData?.name,
        signatureDataUrl,
        signedAt,
        signedIp: workerIp,
        documentId: docRecord.id,
        documentTitle: docRecord.title,
        serialLabel,
        qrDataUrl,
        companyLogoBytes,
      });
      setStep('stamping', 'done');

      setStep('uploading', 'active');
      const finalBlob = new Blob([signedPdfBytes], { type: 'application/pdf' });
      const signedPath = `signed/${docRecord.id}_${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from(TEMPLATES_BUCKET)
        .upload(signedPath, finalBlob, { contentType: 'application/pdf', upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(TEMPLATES_BUCKET).getPublicUrl(signedPath);
      const publicUrl = pub?.publicUrl || signedPath;

      const { error: dbErr } = await supabase
        .from('worker_documents')
        .update({
          status: 'signed',
          signed_at: signedAt,
          signed_ip: workerIp,
          signed_pdf_url: publicUrl,
          signature_serial: serial,
          signature_serial_label: serialLabel,
        })
        .eq('id', docRecord.id);
      if (dbErr) throw dbErr;
      setStep('uploading', 'done');

      const newUrl = URL.createObjectURL(finalBlob);
      setSignedBytes(signedPdfBytes);
      setSignedBlobUrl(newUrl);
      setPhase('done');
      onSigned?.();
    } catch (err) {
      console.error('applySignature erro:', err);
      setPipelineError(err.message || 'Falha a aplicar assinatura.');
      setStepStatus(prev => {
        const next = { ...prev };
        for (const s of SIGN_STEPS) if (next[s.id] === 'active') next[s.id] = 'error';
        return next;
      });
      setPhase('error');
    }
  }, [filledDocxBlob, supabase, workerData, workerIp, systemSettings, docRecord.id, docRecord.title, onSigned]);

  const retry = useCallback(() => {
    setPipelineError('');
    setStepStatus({});
    setSignedBytes(null);
    if (filledDocxBlob && !documentIsSigned) {
      setPhase('preview-ready');
    } else {
      setPhase('idle');
    }
  }, [filledDocxBlob, documentIsSigned]);

  const downloadFinalPdf = useCallback(() => {
    const safeTitle = (docRecord.title || 'documento').replace(/[\s/\\?%*:|"<>]+/g, '_');
    if (signedBytes) {
      const blob = new Blob([signedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url; a.download = `${safeTitle}_assinado.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    if (documentIsSigned && docRecord.signed_pdf_url) {
      const a = window.document.createElement('a');
      a.href = docRecord.signed_pdf_url;
      a.download = `${safeTitle}_assinado.pdf`;
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.click();
    }
  }, [signedBytes, documentIsSigned, docRecord.signed_pdf_url, docRecord.title]);

  const downloadDocxPreview = useCallback(() => {
    if (!filledDocxBlob) return;
    const safeTitle = (docRecord.title || 'documento').replace(/[\s/\\?%*:|"<>]+/g, '_');
    const workerSlug = (workerData?.name || '').replace(/[\s/\\?%*:|"<>]+/g, '_');
    triggerDocxDownload(filledDocxBlob, `${safeTitle}_${workerSlug || docRecord.id}.docx`);
  }, [filledDocxBlob, docRecord.title, docRecord.id, workerData]);

  const tags = template?.template_fields || [];
  const unknownTags = tags.filter(t => !isKnownField(t));
  const ccConfigured = isCloudConvertConfigured();
  const showingFinal = phase === 'done' || (documentIsSigned && signedBlobUrl);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 sticky top-0 z-40">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
          <ChevronLeft className="w-5 h-5" />
          <span className="font-semibold">Voltar</span>
        </button>
        <div className="flex-1 flex items-center justify-center min-w-0">
          <FileText className="w-5 h-5 text-slate-400 mr-2 flex-shrink-0" />
          <span className="font-semibold text-slate-800 truncate">{docRecord.title}</span>
        </div>
        <div className="w-16" />
      </header>

      <main className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        {loading ? (
          <div className="bg-white rounded-2xl p-16 flex items-center justify-center text-slate-400 shadow">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : error && !template ? (
          <div className="bg-white rounded-2xl p-8 shadow">
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-6 shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-black text-slate-800 truncate">{docRecord.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Para <strong>{workerData?.name || 'trabalhador'}</strong> · {tags.length} variáveis
                    {docRecord.signature_serial_label && <> · <span className="font-mono text-indigo-600">{docRecord.signature_serial_label}</span></>}
                  </p>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tags.map(t => (
                        <span
                          key={t}
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                            isKnownField(t)
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {unknownTags.length > 0 && (
                    <p className="text-[10px] text-amber-600 mt-2">
                      {unknownTags.length} variável/variáveis sem mapeamento — ficam vazias.
                    </p>
                  )}
                </div>
                {documentIsSigned || phase === 'done' ? (
                  <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700">Assinado</span>
                  </div>
                ) : (
                  <div className="bg-amber-50 px-3 py-1.5 rounded-full flex-shrink-0">
                    <span className="text-xs font-bold text-amber-700">Pendente</span>
                  </div>
                )}
              </div>
            </div>

            {!ccConfigured && !documentIsSigned && phase !== 'done' && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-sm text-amber-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>CloudConvert não configurado.</strong> A pré-visualização funciona, mas a assinatura final exige <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded font-mono text-xs">VITE_CLOUDCONVERT_API_KEY</code> no <code>.env</code>.
                </div>
              </div>
            )}

            {(phase === 'preparing' || phase === 'applying' || pipelineError) && (
              <div className="bg-white rounded-2xl p-6 shadow">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-3">
                  {phase === 'applying' ? 'A finalizar assinatura' : 'A preparar pré-visualização'}
                </h3>
                <ol className="space-y-2">
                  {(phase === 'applying' ? SIGN_STEPS : PREP_STEPS).map(s => {
                    const st = stepStatus[s.id] || 'pending';
                    return (
                      <li key={s.id} className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center">
                          {st === 'done' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                          {st === 'active' && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
                          {st === 'error' && <AlertCircle className="w-5 h-5 text-rose-500" />}
                          {st === 'pending' && <span className="w-2 h-2 rounded-full bg-slate-300" />}
                        </span>
                        <span className={`text-sm font-semibold ${
                          st === 'done' ? 'text-slate-800' :
                          st === 'active' ? 'text-indigo-700' :
                          st === 'error' ? 'text-rose-700' :
                          'text-slate-400'
                        }`}>
                          {s.label}{st === 'active' && '...'}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {pipelineError && (
                  <div className="mt-4 flex flex-col sm:flex-row items-start gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-700">
                    <div className="flex-1 flex gap-2">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Falha</p>
                        <p>{pipelineError}</p>
                      </div>
                    </div>
                    <button
                      onClick={filledDocxBlob ? retry : preparePreview}
                      className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 self-stretch sm:self-auto"
                    >
                      <RefreshCw className="w-3 h-3" /> Tentar de novo
                    </button>
                  </div>
                )}
              </div>
            )}

            {phase === 'preview-ready' && !signedBlobUrl && (
              <div className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 gap-2">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-600">
                      Pré-visualização — revê antes de assinar
                    </span>
                  </div>
                  <button
                    onClick={downloadDocxPreview}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                    title="Descarregar .docx preenchido (sem assinatura)"
                  >
                    <Download className="w-3 h-3" /> .docx
                  </button>
                </div>
                <div
                  id="docx-preview-container"
                  ref={previewContainerRef}
                  className="w-full bg-slate-100 overflow-auto p-4"
                  style={{ minHeight: '600px', maxHeight: '75vh' }}
                />
              </div>
            )}

            {showingFinal && signedBlobUrl && (
              <div className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-600">
                      PDF Assinado
                    </span>
                  </div>
                  <button
                    onClick={downloadFinalPdf}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-indigo-700"
                  >
                    <Download className="w-4 h-4" /> Descarregar PDF
                  </button>
                </div>
                <iframe
                  src={signedBlobUrl}
                  title={docRecord.title}
                  className="w-full"
                  style={{ height: '75vh', border: 0 }}
                />
              </div>
            )}

            {phase === 'preview-ready' && !documentIsSigned && !signedBlobUrl && (
              <div className="bg-white rounded-2xl p-6 shadow text-center space-y-3">
                <button
                  onClick={() => setShowSignature(true)}
                  className="w-full py-4 bg-indigo-600 text-white font-black uppercase tracking-wider rounded-2xl hover:bg-indigo-700 flex items-center justify-center gap-2 text-sm"
                >
                  <FileSignature className="w-5 h-5" />
                  Assinar Digitalmente
                </button>
                <p className="text-[10px] text-slate-400">
                  Ao assinares, o documento é convertido para PDF e arquivado com selo digital.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {showSignature && (
        <SignatureModal
          onClose={() => phase !== 'applying' && setShowSignature(false)}
          onSign={(dataUrl) => applySignature(dataUrl)}
          workerName={workerData?.name}
          working={phase === 'applying'}
        />
      )}
    </div>
  );
}

function SignatureModal({ onClose, onSign, workerName, working }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      const parent = c.parentElement;
      if (!parent) return;
      const ratio = window.devicePixelRatio || 1;
      const cssW = parent.clientWidth;
      const cssH = parent.clientHeight;
      c.width = cssW * ratio;
      c.height = cssH * ratio;
      c.style.width = cssW + 'px';
      c.style.height = cssH + 'px';
      const ctx = c.getContext('2d');
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1e293b';
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const pos = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const src = e.touches?.[0] || e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  const start = (e) => {
    if (working) return;
    e.preventDefault();
    drawing.current = true;
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };
  const stop = (e) => {
    if (!drawing.current) return;
    e?.preventDefault?.();
    drawing.current = false;
    canvasRef.current?.getContext('2d')?.closePath();
  };
  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const ratio = window.devicePixelRatio || 1;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    setHasInk(false);
  };
  const submit = () => {
    if (!hasInk) { setError('Por favor, assine antes de confirmar.'); return; }
    setError('');
    onSign(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-stretch sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh]">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-black text-slate-800">Assinar Documento</h2>
          <button
            onClick={onClose}
            disabled={working}
            className="p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {workerName && (
          <p className="text-sm text-slate-600 mb-3 flex-shrink-0">
            <span className="font-bold">Trabalhador:</span> {workerName}
          </p>
        )}
        <div
          className="mb-3 bg-white border-2 border-slate-200 rounded-2xl flex-1 sm:flex-none"
          style={{ minHeight: '200px', height: 'auto', touchAction: 'none' }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-crosshair block"
            style={{ touchAction: 'none', height: '100%' }}
            onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
            onTouchStart={start} onTouchMove={move} onTouchEnd={stop} onTouchCancel={stop}
          />
        </div>
        {error && <div className="mb-3 p-3 bg-rose-50 text-rose-600 text-sm font-bold rounded-xl flex-shrink-0">{error}</div>}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2 flex-shrink-0">
          <button
            onClick={clear}
            disabled={working}
            className="px-4 py-3 sm:py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm disabled:opacity-50 border border-slate-200 sm:border-0"
          >
            Limpar
          </button>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={onClose}
              disabled={working}
              className="px-4 py-3 sm:py-2 text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={working || !hasInk}
              className="px-6 py-3 sm:py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentViewer;
