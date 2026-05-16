import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FileText, Edit2, X, Download, CheckCircle, Loader2, Filter, FileSignature, Pencil } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useApp } from '../../context/AppContext';
import { formatDocDate } from '../../utils/dateUtils';
import { replaceTemplateFields } from '../../utils/templateFields';
import { getStampHTML, generateQRCodeDataURL } from '../../hooks/useSignatureStamp';
import { isPending, isSigned } from '../../constants/documentStatus';
import { cropSignatureCanvas } from '../../utils/signatureCanvas';
import workerDocumentsCSS from './WorkerDocuments.css?inline';
import { DocumentViewer } from '../worker/DocumentViewer';
import SignDrawModal from '../worker/SignDrawModal';

// Converte oklch(L C H [/ A]) para grayscale aproximado, preservando lightness.
// Necessário porque o html2canvas usado pelo html2pdf não parseia oklch (CSS Color L4),
// e o Tailwind v4 gera todas as cores em oklch por defeito.
const oklchToGray = (match) => {
  const m = match.match(/oklch\(\s*([\d.]+)(%?)/i);
  if (!m) return '#000';
  let L = parseFloat(m[1]);
  if (m[2] === '%') L = L / 100;
  // Aplicar uma curva gamma simples para aproximar a luminosidade percebida
  const v = Math.max(0, Math.min(255, Math.round(Math.pow(L, 1 / 2.2) * 255)));
  const hex = v.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
};

const replaceOklch = (text) =>
  (text || '').replace(/oklch\([^)]+\)/gi, (m) => oklchToGray(m));

const stripOklch = (clonedDoc) => {
  clonedDoc.querySelectorAll('*').forEach(el => {
    if (el.style && el.style.cssText) {
      el.style.cssText = replaceOklch(el.style.cssText);
    }
  });
  clonedDoc.querySelectorAll('style').forEach(style => {
    style.textContent = replaceOklch(style.textContent);
  });
};


const SIGNATURE_PLACEHOLDER_HTML = `<div class="mt-8 pt-6 border-t border-slate-100 opacity-30 page-break-inside-avoid"><div class="flex flex-col items-end"><div class="w-56 h-16 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center"><span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Aguardando Assinatura</span></div></div></div>`;

const injectTailwindCDN = (doc) => {
  // Remover quaisquer scripts Tailwind pré-existentes no template (frequentemente com plugins deprecados
  // como ?plugins=aspect-ratio,line-clamp que produzem warnings na consola).
  doc.querySelectorAll('script[src*="tailwindcss"]').forEach(s => s.remove());

  // Injetar o nosso (CDN limpo, sem plugins deprecados).
  const script = doc.createElement('script');
  script.src = 'https://cdn.tailwindcss.com';
  (doc.head || doc.documentElement).appendChild(script);
};

const injectSignaturePlaceholder = (html) => {
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
};

const renderPdfToSrcDoc = async (arrayBuffer) => {
  const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const imgs = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    imgs.push(canvas.toDataURL('image/jpeg', 0.88));
  }
  const imgTags = imgs.map(src =>
    `<img src="${src}" style="width:100%;display:block;margin-bottom:8px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" />`
  ).join('');
  return `<!DOCTYPE html><html><body style="margin:0;padding:8px;background:#f1f5f9;">${imgTags}</body></html>`;
};

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

  useEffect(() => {
    loadTemplateDocs();
  }, [loadTemplateDocs]);

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showSigner, setShowSigner] = useState(false);
  const [showSignPad, setShowSignPad] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewSrcDoc, setPreviewSrcDoc] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [previewMime, setPreviewMime] = useState('application/pdf');
  const [acroformDoc, setAcroformDoc] = useState(null);

  const openDoc = useCallback((doc) => {
    const isAcroform = !!(doc.template_id || doc.templateId) && !doc.generated_html;
    if (isAcroform) {
      setAcroformDoc(doc);
    } else {
      setSelectedDoc(doc);
      setShowSigner(true);
    }
  }, []);
  const [signing, setSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [workerIp, setWorkerIp] = useState('A obter IP...');
  const [signerOpenedAt, setSignerOpenedAt] = useState('');
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  // Buscar o ficheiro como blob (via Supabase Storage API se possível) para
  // garantir que renderiza em <iframe>/<img> independentemente do
  // Content-Disposition / Content-Type do storage.
  useEffect(() => {
    let cancelled = false;
    let createdUrl = null;
    setPreviewBlobUrl(null);
    setPreviewSrcDoc(null);
    setPreviewError('');
    const src = selectedDoc?.url;
    if (!showSigner || !src) return;

    const name = (selectedDoc?.nomeFicheiro || src.split('?')[0]).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (name.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (name.endsWith('.png')) mimeType = 'image/png';
    else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (name.endsWith('.webp')) mimeType = 'image/webp';

    (async () => {
      try {
        let blob;
        const m = src.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
        if (m && supabase) {
          const { data, error } = await supabase.storage.from(m[1]).download(decodeURIComponent(m[2]));
          if (error) throw error;
          blob = data;
        } else {
          const res = await fetch(src);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          blob = await res.blob();
        }
        if (cancelled) return;
        const buf = await blob.arrayBuffer();
        if (mimeType === 'application/pdf') {
          const srcDoc = await renderPdfToSrcDoc(buf);
          if (!cancelled) setPreviewSrcDoc(srcDoc);
        } else {
          const typedBlob = new Blob([buf], { type: mimeType });
          createdUrl = URL.createObjectURL(typedBlob);
          if (!cancelled) {
            setPreviewBlobUrl(createdUrl);
            setPreviewMime(mimeType);
          }
        }
      } catch (err) {
        console.warn('Falha a carregar preview:', err);
        if (!cancelled) setPreviewError(err.message || 'Falha a carregar o documento');
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [showSigner, selectedDoc?.url, selectedDoc?.nomeFicheiro, supabase]);

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
    () => documents?.filter(d => d.workerId === currentUser?.id) || [],
    [documents, currentUser?.id]
  );
  const pendentes = useMemo(() => {
    const combined = docs.filter(d => isPending(d.status))
      .concat(templateDocs.filter(d => isPending(d.status)));
    return [...new Map(combined.map(d => [d.id, d])).values()];
  }, [docs, templateDocs]);
  const historico = useMemo(() => {
    const combined = docs.filter(d => isSigned(d.status))
      .concat(templateDocs.filter(d => isSigned(d.status)));
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
      const ctx = canvasRef.current.getContext('2d');
      ctx.closePath();
      isDrawing.current = false;
    }
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSign = async (signatureFromModal) => {
    const signatureDataURL = typeof signatureFromModal === 'string' && signatureFromModal
      ? signatureFromModal
      : (canvasRef.current ? cropSignatureCanvas(canvasRef.current) : '');
    if (!signatureDataURL) return alert('Assinatura obrigatória.');
    setSigning(true);

    try {
      const userIP = (workerIp && workerIp !== 'A obter IP...') ? workerIp : 'Desconhecido';
      const now = new Date().toISOString();
      const docId = selectedDoc?.id ?? '';

      const isTemplateDoc = !!(selectedDoc.templateId || selectedDoc.template_id);

      if (isTemplateDoc && selectedDoc.generated_html) {
        // 1. Gerar stamp HTML via getStampHTML (igual ao que o cliente usa)
        const { stampHTML: stampMarkup, qrCodeDataURL } = await getStampHTML({
          signatureDataURL,
          datetime: signerOpenedAt,
          ip: userIP,
          id: docId,
        });

        // 2. Parse template e injetar Tailwind CDN + CSS
        const parser = new DOMParser();
        const tmplDoc = parser.parseFromString(selectedDoc.generated_html, 'text/html');

        injectTailwindCDN(tmplDoc);

        // Margens da página: lê <meta name="page-margins" content="t,r,b,l"> (em mm)
        // gravada no momento da criação do generated_html; fallback 20mm em todos os lados.
        const parseMargins = (raw) => {
          if (!raw) return [20, 20, 20, 20];
          const parts = String(raw).split(',').map(s => Number(s.trim()));
          if (parts.length !== 4 || parts.some(n => !Number.isFinite(n) || n < 0)) return [20, 20, 20, 20];
          return parts;
        };
        const metaMargins = tmplDoc.querySelector('meta[name="page-margins"]');
        const [mTop, mRight, mBottom, mLeft] = parseMargins(metaMargins?.getAttribute('content'));

        // WorkerDocuments.css espelha 100% ClientTimesheetReport.css + overrides locais
        const workerCSStag = tmplDoc.createElement('style');
        workerCSStag.textContent = workerDocumentsCSS;
        (tmplDoc.head || tmplDoc.documentElement).appendChild(workerCSStag);

        // Padding dinâmico do .a4-paper a partir das margens do DOCX
        const marginsCSS = tmplDoc.createElement('style');
        marginsCSS.textContent = `.a4-paper { padding: ${mTop}mm ${mRight}mm ${mBottom}mm ${mLeft}mm !important; }`;
        (tmplDoc.head || tmplDoc.documentElement).appendChild(marginsCSS);

        // 3. Envolver o conteúdo do body num <div class="a4-paper"> (igual ao cliente)
        const a4 = tmplDoc.createElement('div');
        a4.className = 'a4-paper';
        a4.id = 'worker-a4-paper';
        while (tmplDoc.body.firstChild) {
          a4.appendChild(tmplDoc.body.firstChild);
        }
        tmplDoc.body.appendChild(a4);

        // Override do body do template
        const bodyResetCSS = tmplDoc.createElement('style');
        bodyResetCSS.textContent = 'body { width: auto !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }';
        (tmplDoc.head || tmplDoc.documentElement).appendChild(bodyResetCSS);

        // 4. Criar placeholders se não existirem (obrigatório para o stamp aparecer)
        let sigArea = tmplDoc.querySelector('#worker-signature-placeholder');
        if (!sigArea) {
          sigArea = tmplDoc.createElement('div');
          sigArea.id = 'worker-signature-placeholder';
          sigArea.style.cssText = 'position:absolute;left:0px;top:0px;width:300px;height:150px;';
          a4.appendChild(sigArea);
        }

        // Remover placeholder QR code do template (será substituído pelo QR fixo)
        const existingQrPlaceholder = tmplDoc.querySelector('#worker-qrcode-placeholder');
        if (existingQrPlaceholder) {
          existingQrPlaceholder.remove();
        }

        // 5. Criar estrutura igual ao cliente no placeholder de assinatura
        // Primeiro: guardar a posição original do placeholder do template
        const originalLeft = sigArea.style.left || '0px';
        const originalTop = sigArea.style.top || '0px';

        // Segundo: remover todo o conteúdo interno do placeholder
        while (sigArea.firstChild) {
          sigArea.removeChild(sigArea.firstChild);
        }
        // Terceiro: limpar todos os atributos de estilo do placeholder
        sigArea.removeAttribute('style');
        sigArea.removeAttribute('class');
        sigArea.setAttribute('class', 'page-break-inside-avoid');
        // Manter position:absolute com a posição original do template
        sigArea.style.cssText = `position:absolute;left:${originalLeft};top:${originalTop};width:290px;border:none;background:transparent;padding:0;margin:0;`;

        // Injetar o stamp markup diretamente no placeholder (sem wrappers extra)
        sigArea.innerHTML = stampMarkup;

        // Injetar QR code fixo na parte inferior direita (dentro do .a4-paper para ser capturado pelo html2pdf)
        const qrCodeFixed = tmplDoc.createElement('div');
        qrCodeFixed.id = 'qr-code-fixed';
        qrCodeFixed.style.cssText = 'position:absolute;right:5mm;bottom:5mm;width:20mm;height:20mm;z-index:99999;';
        qrCodeFixed.innerHTML = `<img src="${qrCodeDataURL}" style="width:100%;height:100%;object-fit:contain;" />`;
        a4.appendChild(qrCodeFixed);

        const cleanHtml = '<!DOCTYPE html>' + tmplDoc.documentElement.outerHTML;

        // 5. Criar iframe e escrever o HTML
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:900px;height:1300px;border:none;';
        iframe.setAttribute('sandbox', 'allow-scripts');
        document.body.appendChild(iframe);

        iframe.contentDocument.open();
        iframe.contentDocument.write(cleanHtml);
        iframe.contentDocument.close();

        // Aguardar Tailwind CDN carregar + paint
        await new Promise(r => setTimeout(r, 1000));

        // 6. Carregar html2pdf e gerar PDF
        await new Promise((resolve, reject) => {
          const h2pScript = iframe.contentDocument.createElement('script');
          h2pScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          h2pScript.onload = () => {
            setTimeout(resolve, 500);
          };
          h2pScript.onerror = () => reject(new Error('Falha ao carregar html2pdf no iframe'));
          (iframe.contentDocument.head || iframe.contentDocument.documentElement).appendChild(h2pScript);
        });

        let pdfBlob;
        try {
          // Capturar o .a4-paper — EXATAMENTE o mesmo elemento que o cliente captura
          const target = iframe.contentDocument.querySelector('.a4-paper') || iframe.contentDocument.body;

          // OPÇÕES — arrays construídos com o Array do iframe para passar o instanceof check do html2pdf
          const ifW = iframe.contentWindow;
          const opt = {
            // margens estão DENTRO do .a4-paper como padding (vindas do DOCX); html2pdf não adiciona nada
            margin: ifW.Array.of(0, 0, 0, 0),
            filename: `${selectedDoc.id}_signed_${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 1.5,
              useCORS: true,
              logging: false,
              onclone: (clonedDoc) => {
                stripOklch(clonedDoc);
              },
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: {
              mode: ifW.Array.of('avoid-all', 'css', 'legacy'),
              avoid: ifW.Array.of(
                'section',
                '.section',
                '[data-section]',
                '.signature-block',
                '.signature-area',
                '.magnetic-validation-stamp',
                '.page-break-inside-avoid',
              ),
            },
          };

          pdfBlob = await ifW.html2pdf().set(opt).from(target).output('blob');
        } finally {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }

        const pdfPath = `${currentUser.id}/documentos_assinados/${selectedDoc.id}_signed_${Date.now()}.pdf`;
        const { error: pdfError } = await supabase.storage
          .from('documentos')
          .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });
        if (pdfError) throw new Error(`Erro ao guardar PDF: ${pdfError.message}`);

        const { data: pdfUrlData } = supabase.storage.from('documentos').getPublicUrl(pdfPath);
        const pdfAssinadoUrl = pdfUrlData.publicUrl;

        const docData = {
          status: 'signed',
          signed_at: now,
          signed_ip: userIP,
          signature_data: signatureDataURL,
          signed_pdf_url: pdfAssinadoUrl
        };
        const { error } = await supabase.from('worker_documents').update(docData).eq('id', selectedDoc.id);
        if (error) throw error;
        setTemplateDocs(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, ...docData } : d));

      } else {
        const stampPath = `${currentUser.id}/stamps/${Date.now()}.png`;
        // Pré-renderizar o stamp num iframe isolado com WorkerDocuments.css aplicado,
        // dentro de .a4-paper > .signature-area (igual ao pipeline da rota template).
        const { stampHTML: stampHTMLFromFn, qrCodeDataURL } = await getStampHTML({
          signatureDataURL,
          datetime: signerOpenedAt,
          ip: userIP,
          id: docId
        });
        const stampDocHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${workerDocumentsCSS}</style><style>
          html, body { margin:0; padding:0; background:#fff; }
          .a4-paper { width:auto !important; min-height:auto !important; padding:0 !important; margin:0 !important; box-shadow:none !important; display:inline-block; }
        </style></head><body><div class="a4-paper"><div class="signature-area">${stampHTMLFromFn}${qrCodeDataURL ? `<img src="${qrCodeDataURL}" class="worker-qrcode-img" style="display:block;width:64px;height:64px;margin-top:8px;border:1px solid #e2e8f0;border-radius:4px;padding:2px;background:#fff;" />` : ''}</div></div></body></html>`;

        const stampIframe = document.createElement('iframe');
        stampIframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:500px;height:200px;border:none;';
        document.body.appendChild(stampIframe);
        stampIframe.contentDocument.open();
        stampIframe.contentDocument.write(stampDocHtml);
        stampIframe.contentDocument.close();

        // Aguardar paint
        await new Promise(r => setTimeout(r, 200));

        // Carregar html2canvas no iframe
        await new Promise((resolve, reject) => {
          const s = stampIframe.contentDocument.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          s.onload = () => setTimeout(resolve, 150);
          s.onerror = () => reject(new Error('Falha ao carregar html2canvas (stamp)'));
          (stampIframe.contentDocument.head || stampIframe.contentDocument.documentElement).appendChild(s);
        });

        let stampBase64;
        let stampAspectRatio = 290 / 80; // fallback
        try {
          const stampTarget = stampIframe.contentDocument.querySelector('.magnetic-validation-stamp')
            || stampIframe.contentDocument.querySelector('.a4-paper');
          const tempCanvas = await stampIframe.contentWindow.html2canvas(stampTarget, {
            backgroundColor: '#ffffff',
            scale: 3,
            useCORS: true,
            logging: false,
            onclone: stripOklch,
          });
          stampBase64 = tempCanvas.toDataURL('image/png');
          stampAspectRatio = tempCanvas.width / tempCanvas.height;
        } finally {
          if (stampIframe.parentNode) stampIframe.parentNode.removeChild(stampIframe);
        }

        const { error: stampError } = await supabase.storage
          .from('documentos')
          .upload(stampPath, await fetch(stampBase64).then(r => r.blob()), { contentType: 'image/png' });
        if (stampError) throw new Error(`Erro ao guardar stamp: ${stampError.message}`);
        const { data: stampUrlData } = supabase.storage.from('documentos').getPublicUrl(stampPath);
        const stampPublicUrl = stampUrlData.publicUrl;

        const { PDFDocument } = await import('pdf-lib');
        const originalPdfBytes = await fetch(selectedDoc.url).then(r => {
          if (!r.ok) throw new Error('Erro ao baixar PDF original');
          return r.arrayBuffer();
        });
        const pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
        let pngImage;
        try {
          pngImage = await pdfDoc.embedPng(stampBase64);
        } catch {
          pngImage = await pdfDoc.embedJpg(stampBase64);
        }
        const pages = pdfDoc.getPages();
        const lastPage = pages[pages.length - 1];
        const { width: pageWidth } = lastPage.getSize();
        // Manter aspect ratio natural do stamp (em vez de forçar 280×80, que esticava)
        const stampWidth = 207;
        const stampHeight = stampWidth / stampAspectRatio;
        lastPage.drawImage(pngImage, {
          x: pageWidth - stampWidth - 30,
          y: 30,
          width: stampWidth,
          height: stampHeight,
        });
        const pdfBlob = new Blob([await pdfDoc.save()], { type: 'application/pdf' });

        const pdfPath = `${currentUser.id}/documentos_assinados/${selectedDoc.id}_signed_${Date.now()}.pdf`;
        const { error: pdfError } = await supabase.storage
          .from('documentos')
          .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });
        if (pdfError) throw new Error(`Erro ao guardar PDF: ${pdfError.message}`);
        const { data: pdfUrlData } = supabase.storage.from('documentos').getPublicUrl(pdfPath);
        const pdfAssinadoUrl = pdfUrlData.publicUrl;

        const docData = {
          id: selectedDoc.id,
          workerId: selectedDoc.workerId,
          tipo: selectedDoc.tipo,
          nomeFicheiro: selectedDoc.nomeFicheiro,
          url: selectedDoc.url,
          status: 'Assinado',
          assinaturaUrl: signatureDataURL,
          dataAssinatura: now,
          signed_at: now,
          ipAssinatura: userIP,
          pdfAssinadoUrl: pdfAssinadoUrl,
          dataEmissao: selectedDoc.dataEmissao
        };
        await saveToDb('documentos', selectedDoc.id, docData);
      }

      alert('Documento assinado com sucesso!');
      setShowSignPad(false);
      setShowSigner(false);
      setSelectedDoc(null);
      clearCanvas();
    } catch (err) {
      console.error('Erro completo:', err);
      alert(`Erro: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setSigning(false);
    }
  };

  const docList = useMemo(() => {
    let list = (pendingOnly || activeTab === 'pendentes') ? pendentes : historico;
    if (pendingOnly) return list.slice(0, 5);

    if (activeTab === 'historico') {
      if (filterType !== 'all') {
        list = list.filter(d => (d.tipo || d.title || '') === filterType);
      }

      list = [...list].sort((a, b) => {
        if (sortBy === 'date_desc') {
          return (b.dataAssinatura || b.signed_at || b.dataEmissao || b.created_at || '').localeCompare(a.dataAssinatura || a.signed_at || a.dataEmissao || a.created_at || '');
        } else if (sortBy === 'date_asc') {
          return (a.dataAssinatura || a.signed_at || a.dataEmissao || a.created_at || '').localeCompare(b.dataAssinatura || b.signed_at || b.dataEmissao || b.created_at || '');
        } else if (sortBy === 'name_asc') {
          return (a.tipo || a.title || '').localeCompare(b.tipo || b.title || '');
        } else if (sortBy === 'name_desc') {
          return (b.tipo || b.title || '').localeCompare(a.tipo || a.title || '');
        }
        return 0;
      });
    }

    return list;
  }, [activeTab, pendentes, historico, filterType, sortBy]);

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

      {!pendingOnly && <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setActiveTab('pendentes')} className={`px-4 py-2 rounded-xl font-bold text-sm ${activeTab === 'pendentes' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
          Pendentes ({pendentes.length})
        </button>
        <button onClick={() => setActiveTab('historico')} className={`px-4 py-2 rounded-xl font-bold text-sm ${activeTab === 'historico' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          Histórico ({historico.length})
        </button>

        {activeTab === 'historico' && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`ml-auto p-2 rounded-xl ${showFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}
          >
            <Filter size={16} />
          </button>
        )}
      </div>}

      {!pendingOnly && activeTab === 'historico' && showFilters && (
        <div className="bg-slate-50 rounded-xl p-4 mb-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Tipo:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-bold"
            >
              <option value="all">Todos</option>
              {uniqueTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Ordenar:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-bold"
            >
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
                      <span className="text-slate-300">|</span>
                    )}
                    {isSigned(doc.status) && (doc.dataAssinatura || doc.signed_at) && (
                      <p className="text-[10px] text-emerald-600 font-bold">
                        Assinado: {new Date(doc.dataAssinatura || doc.signed_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${isPending(doc.status) ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {isPending(doc.status) ? 'Pendente' : 'Assinado'}
                </span>
                {isPending(doc.status) ? (
                  <button
                    onClick={() => openDoc(doc)}
                    className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl"
                    title="Assinar documento"
                  >
                    <Pencil size={18} />
                  </button>
                ) : (
                  <a href={doc.pdfAssinadoUrl || doc.signed_pdf_url || doc.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl">
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
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-6 max-w-5xl w-full max-h-[95vh] h-full sm:h-auto overflow-y-auto flex flex-col gap-3 sm:gap-4">
              <div className="flex justify-between items-center">
                <h4 className="font-black text-base sm:text-lg truncate pr-2">{selectedDoc.tipo || selectedDoc.title}</h4>
                <button onClick={() => { setShowSigner(false); setShowSignPad(false); clearCanvas(); }} className="p-2 hover:bg-slate-100 rounded-xl shrink-0"><X size={20} /></button>
              </div>
              <div className="w-full flex-1 min-h-[60vh] sm:min-h-[70vh] border rounded-xl bg-slate-100 relative overflow-hidden">
                {selectedDoc.url ? (
                  <>
                    {previewSrcDoc ? (
                      <iframe
                        srcDoc={previewSrcDoc}
                        sandbox="allow-scripts"
                        className="w-full h-full rounded-xl"
                        title="Pré-visualização do documento"
                      />
                    ) : previewBlobUrl ? (
                      previewMime.startsWith('image/') ? (
                        <img
                          src={previewBlobUrl}
                          alt="Pré-visualização"
                          className="max-w-full max-h-full m-auto block rounded-xl"
                        />
                      ) : (
                        <iframe
                          src={`${previewBlobUrl}#toolbar=0&view=FitH`}
                          className="w-full h-full rounded-xl"
                          title="Pré-visualização do documento"
                        />
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
              <button
                onClick={() => setShowSignPad(true)}
                disabled={signing}
                className="w-full py-4 sm:py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {signing ? <><Loader2 size={18} className="animate-spin" /> A processar...</> : <><FileSignature size={18} /> Assinar Digitalmente</>}
              </button>
            </div>
          </div>
          {showSignPad && (
            <SignDrawModal
              workerName={currentUser?.name || currentUser?.nome}
              working={signing}
              onClose={() => setShowSignPad(false)}
              onSign={(dataUrl) => handleSign(dataUrl)}
            />
          )}
        </>
      )}

      {acroformDoc && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <DocumentViewer
            document={acroformDoc}
            onBack={() => { setAcroformDoc(null); loadTemplateDocs(); }}
            onSigned={() => {
              setAcroformDoc(null);
              loadTemplateDocs();
              alert('Documento assinado com sucesso!');
            }}
          />
        </div>
      )}
    </div>
  );
};

export default WorkerDocuments;
