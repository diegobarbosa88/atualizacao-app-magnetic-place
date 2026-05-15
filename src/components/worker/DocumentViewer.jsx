import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle, Loader2, AlertCircle, FileSignature, X, RefreshCw,
} from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { useApp } from '../../context/AppContext';
import {
  downloadTemplateBytes,
  renderDocx,
  buildRenderData,
  TEMPLATES_BUCKET,
} from '../../utils/docxTemplateService';
import { convertDocxToPdf } from '../../utils/pdfCoService';
import { formatSerialLabel, applyQrToAllPages, applyStampToPage } from '../../utils/pdfSigningService';
import { generateQRCodeDataURL } from '../../hooks/useSignatureStamp';
import { DOC_STATUS } from '../../constants/documentStatus';
import SignDrawModal from './SignDrawModal';

export function DocumentViewer({ document: docRecord, onBack, onSigned }) {
  const { supabase, systemSettings } = useApp();
  const [workerData, setWorkerData] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [phase, setPhase] = useState('idle');
  const [pipelineError, setPipelineError] = useState('');

  const [filledDocxBlob, setFilledDocxBlob] = useState(null);
  const previewContainerRef = useRef(null);

  const [showSignature, setShowSignature] = useState(false);
  const [workerIp, setWorkerIp] = useState('Desconhecido');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

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

        let clientRow = null;
        if (docRecord.client_id) {
          const { data: c } = await supabase
            .from('clients').select('*').eq('id', docRecord.client_id).maybeSingle();
          clientRow = c || null;
        }

        if (cancelled) return;
        setWorkerData(workerRow || {});
        setClientData(clientRow);
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
  }, [supabase, docRecord.worker_id, docRecord.template_id, docRecord.client_id]);

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json()).then(d => setWorkerIp(d.ip || 'Desconhecido'))
      .catch(() => setWorkerIp('Desconhecido'));
  }, []);

  const preparePreview = useCallback(async () => {
    if (!template || !workerData) return;
    setPipelineError('');
    setPhase('preparing');

    try {
      const tmplBuffer = await downloadTemplateBytes(supabase, template.template_docx_path);
      const renderData = buildRenderData(workerData, systemSettings || {}, clientData);
      const blob = renderDocx(tmplBuffer, renderData);
      setFilledDocxBlob(blob);
      setPhase('preview-ready');
    } catch (err) {
      console.error('preparePreview erro:', err);
      setPipelineError(err.message || 'Falha a preparar o documento.');
      setPhase('error');
    }
  }, [template, workerData, clientData, supabase, systemSettings]);

  useEffect(() => {
    if (loading) return;
    if (!template || !workerData) return;
    if (phase !== 'idle') return;
    preparePreview();
  }, [loading, template, workerData, phase, preparePreview]);

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
        });
      })
      .catch(err => {
        if (cancelled) return;
        console.error('docx-preview falhou:', err);
        setPipelineError('Falha a renderizar pré-visualização: ' + (err.message || 'erro desconhecido'));
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
    };
  }, [phase, filledDocxBlob]);

  const applySignature = useCallback(async (signatureDataUrl) => {
    if (!template || !workerData) return;
    setShowSignature(false);
    setPhase('applying');
    setPipelineError('');

    try {
      const signedAt = new Date().toISOString();
      const { data: serialData, error: serialErr } = await supabase.rpc('next_signature_serial');
      if (serialErr) throw new Error(`Falha a obter número de série: ${serialErr.message}`);
      const serial = Number(serialData);
      const serialLabel = formatSerialLabel(serial);

      const qrDataUrl = await generateQRCodeDataURL(docRecord.id);

      // Preencher template DOCX com dados do trabalhador (sem stamp - será aplicado no PDF)
      const tmplBuffer = await downloadTemplateBytes(supabase, template.template_docx_path);
      const renderData = buildRenderData(workerData, systemSettings || {}, clientData);
      const filledDocxBlob = renderDocx(tmplBuffer, renderData);

      // Converter DOCX para PDF
      const pdfBlob = await convertDocxToPdf(filledDocxBlob);

      // Aplicar carimbo vetorial na posição configurada no template
      const pdfWithStamp = await applyStampToPage(pdfBlob, {
        workerName: workerData?.name,
        signatureDataUrl,
        signedAt,
        signedIp: workerIp,
        serialLabel,
        xMm: template.stamp_x ?? 130,
        yMm: template.stamp_y ?? 30,
        page: template.stamp_page || 'last',
        stampWidthMm: 70,
        stampHeightMm: 25,
      });
      
      // Aplicar QR code em todas as páginas do PDF
      const pdfWithQr = await applyQrToAllPages(pdfWithStamp, qrDataUrl);
      const finalBlob = new Blob([pdfWithQr], { type: 'application/pdf' });

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
          status: DOC_STATUS.AWAITING_ADMIN,
          signed_at: signedAt,
          signed_ip: workerIp,
          signed_pdf_url: publicUrl,
          signature_serial: serial,
          signature_serial_label: serialLabel,
        })
        .eq('id', docRecord.id);
      if (dbErr) throw dbErr;

      setPhase('done');
      onSigned?.();
    } catch (err) {
      console.error('applySignature erro:', err);
      setPipelineError(err.message || 'Falha a aplicar assinatura.');
      setPhase('error');
    }
  }, [template, workerData, supabase, workerIp, systemSettings, docRecord.id, onSigned]);

  const retry = useCallback(() => {
    setPipelineError('');
    if (filledDocxBlob) setPhase('preview-ready');
    else setPhase('idle');
  }, [filledDocxBlob]);

  const isWorking = loading || phase === 'preparing' || phase === 'applying';
  const canSign = phase === 'preview-ready' && !isWorking;
  const buttonLabel = phase === 'applying'
    ? 'A processar assinatura...'
    : phase === 'preparing'
    ? 'A preparar pré-visualização...'
    : loading
    ? 'A carregar...'
    : 'Assinar Digitalmente';

  return (
    <div
      className="w-[90vw] h-[90vh] max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
        <h2 className="text-base sm:text-lg font-black text-slate-800 truncate pr-4">
          {docRecord.title}
        </h2>
        <button
          onClick={onBack}
          disabled={phase === 'applying'}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl disabled:opacity-50 flex-shrink-0"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 min-h-0 bg-slate-100 relative">
        {error ? (
          <div className="h-full flex items-center justify-center p-6">
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-700 max-w-md">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          </div>
        ) : isWorking && !filledDocxBlob ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div
            id="docx-preview-container"
            ref={previewContainerRef}
            className="absolute inset-0 overflow-auto p-4"
          />
        )}

        {phase === 'applying' && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-xl px-6 py-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              <span className="text-sm font-bold text-slate-700">A processar assinatura...</span>
            </div>
          </div>
        )}
      </div>

      <footer className="flex-shrink-0 border-t border-slate-200 px-4 sm:px-6 py-4 bg-white">
        {pipelineError && (
          <div className="mb-3 flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{pipelineError}</span>
            <button
              onClick={retry}
              className="px-2 py-1 bg-rose-100 hover:bg-rose-200 rounded-md text-xs font-bold flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Tentar
            </button>
          </div>
        )}
        <button
          onClick={() => setShowSignature(true)}
          disabled={!canSign}
          className="w-full py-3 sm:py-4 bg-indigo-600 text-white font-black uppercase tracking-wider rounded-2xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm transition-colors"
        >
          {phase === 'applying' || phase === 'preparing' || loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <FileSignature className="w-5 h-5" />
          )}
          {buttonLabel}
        </button>
      </footer>

      {showSignature && (
        <SignDrawModal
          onClose={() => phase !== 'applying' && setShowSignature(false)}
          onSign={(dataUrl) => applySignature(dataUrl)}
          workerName={workerData?.name}
          working={phase === 'applying'}
        />
      )}
    </div>
  );
}

export default DocumentViewer;
