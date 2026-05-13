import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FileText, Edit2, X, Download, CheckCircle, Loader2, Filter, FileSignature } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useApp } from '../../context/AppContext';
import { formatDocDate } from '../../utils/dateUtils';
import { replaceTemplateFields } from '../../utils/templateFields';
import { getStampHTML, generateQRCodeDataURL } from '../../hooks/useSignatureStamp';
import { isPending, isSigned } from '../../constants/documentStatus';
import { cropSignatureCanvas } from '../../utils/signatureCanvas';
import workerDocumentsCSS from './WorkerDocuments.css?inline';
import { DocumentViewer } from '../worker/DocumentViewer';

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

const WorkerDocuments = ({ currentUser, documents, saveToDb }) => {
  const { supabase } = useApp();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('magnetic_worker_doc_tab') || 'pendentes');
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

  useEffect(() => {
    if (showSigner && canvasRef.current) {
      const timer = setTimeout(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = 200;
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

  const handleSign = async () => {
    if (!hasSignature) return alert('Assinatura obrigatória.');
    setSigning(true);

    try {
      const userIP = (workerIp && workerIp !== 'A obter IP...') ? workerIp : 'Desconhecido';
      const now = new Date().toISOString();
      const docId = selectedDoc?.id ?? '';
      const signatureDataURL = canvasRef.current ? cropSignatureCanvas(canvasRef.current) : '';

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

        // WorkerDocuments.css espelha 100% ClientTimesheetReport.css + overrides locais
        const workerCSStag = tmplDoc.createElement('style');
        workerCSStag.textContent = workerDocumentsCSS;
        (tmplDoc.head || tmplDoc.documentElement).appendChild(workerCSStag);

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
        console.log('DEBUG: Preserving signature placeholder position - left:', originalLeft, 'top:', originalTop);

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
        console.log('DEBUG: QR code fixo injetado com src:', qrCodeDataURL ? 'presente' : 'vazio');

        // DEBUG: ver o que está dentro do sigArea após modificações
        console.log('DEBUG: sigArea innerHTML após modificações:', sigArea.innerHTML.substring(0, 500));

        const cleanHtml = '<!DOCTYPE html>' + tmplDoc.documentElement.outerHTML;

        // DEBUG
        console.log('DEBUG: cleanHtml contains worker-signature-placeholder?', cleanHtml.includes('worker-signature-placeholder'));
        console.log('DEBUG: cleanHtml contains magnetic-validation-stamp?', cleanHtml.includes('magnetic-validation-stamp'));
        console.log('DEBUG: cleanHtml contains VALIDAÇÃO DIGITAL?', cleanHtml.includes('VALIDAÇÃO DIGITAL'));

        // 5. Criar iframe e escrever o HTML
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:900px;height:1300px;border:none;';
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        document.body.appendChild(iframe);

        iframe.contentDocument.open();
        iframe.contentDocument.write(cleanHtml);
        iframe.contentDocument.close();

        // Aguardar Tailwind CDN carregar + paint
        await new Promise(r => setTimeout(r, 1000));

        // DEBUG: verificar se placeholder e stamp existem no iframe
        const sigInIframe = iframe.contentDocument.querySelector('#worker-signature-placeholder');
        const stampInIframe = iframe.contentDocument.querySelector('.magnetic-validation-stamp');
        const a4InIframe = iframe.contentDocument.querySelector('.a4-paper');
        const qrInIframe = iframe.contentDocument.querySelector('#qr-code-fixed');
        console.log('DEBUG: Placeholder no iframe?', !!sigInIframe);
        console.log('DEBUG: Stamp no iframe?', !!stampInIframe);
        console.log('DEBUG: QR code fixo no iframe?', !!qrInIframe);
        console.log('DEBUG: A4 paper no iframe?', !!a4InIframe);
        if (sigInIframe) {
          console.log('DEBUG: Placeholder innerHTML:', sigInIframe.innerHTML.substring(0, 500));
        }
        if (qrInIframe) {
          console.log('DEBUG: QR code src:', qrInIframe.innerHTML.substring(0, 100));
        }
        if (a4InIframe) {
          console.log('DEBUG: A4 paper innerHTML (last 500 chars):', a4InIframe.innerHTML.slice(-500));
        }

        // 6. Carregar html2pdf e gerar PDF
        await new Promise((resolve, reject) => {
          const h2pScript = iframe.contentDocument.createElement('script');
          h2pScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          h2pScript.onload = () => {
            console.log('DEBUG: html2pdf loaded');
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
            // [top, left, bottom, right] mm — top em todas as páginas
            margin: ifW.Array.of(14, 0, 0, 0),
            filename: `${selectedDoc.id}_signed_${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 1.5,
              useCORS: true,
              logging: false,
              onclone: (clonedDoc) => {
                stripOklch(clonedDoc);
                const clonedStamp = clonedDoc.querySelector('.magnetic-validation-stamp');
                const clonedA4 = clonedDoc.querySelector('.a4-paper');
                console.log('DEBUG onclone: clonedStamp exists?', !!clonedStamp);
                console.log('DEBUG onclone: clonedA4 exists?', !!clonedA4);
                if (clonedA4) {
                  console.log('DEBUG onclone: clonedA4 innerHTML length:', clonedA4.innerHTML.length);
                  console.log('DEBUG onclone: clonedA4 contains stamp?', clonedA4.innerHTML.includes('magnetic-validation-stamp'));
                }
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

          console.log('DEBUG: target element tagName:', target.tagName);
          console.log('DEBUG: target children count:', target.children.length);
          console.log('DEBUG: target innerHTML length:', target.innerHTML.length);
          console.log('DEBUG: target contains magnetic-validation-stamp?', target.innerHTML.includes('magnetic-validation-stamp'));

          try {
            pdfBlob = await ifW.html2pdf().set(opt).from(target).output('blob');
            console.log('DEBUG: pdfBlob size:', pdfBlob.size, 'bytes');
          } catch (pdfErr) {
            console.error('DEBUG: pdf generation error:', pdfErr);
            throw pdfErr;
          }
        } finally {
          document.body.removeChild(iframe);
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
        const pdfDoc = await PDFDocument.load(originalPdfBytes);
        const pngImage = await pdfDoc.embedPng(stampBase64);
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
    let list = activeTab === 'pendentes' ? pendentes : historico;

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
        <h3 className="font-black text-lg uppercase tracking-tight text-slate-800">Os Meus Documentos</h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
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
      </div>

      {activeTab === 'historico' && showFilters && (
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
        <p className="text-slate-400 text-center py-8">Nenhum documento.</p>
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
                  <button onClick={() => openDoc(doc)} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl">
                    <Edit2 size={14} />
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-black text-lg">{selectedDoc.tipo || selectedDoc.title}</h4>
                <button onClick={() => { setShowSigner(false); clearCanvas(); }} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
              </div>
              <div className="w-full h-96 border rounded-xl mb-4 bg-slate-100 relative overflow-hidden">
                {selectedDoc.url ? (
                  <iframe src={`${selectedDoc.url}#toolbar=0`} className="w-full h-full rounded-xl" title="Document Preview" />
                ) : selectedDoc.generated_html ? (
                  <iframe srcDoc={injectSignaturePlaceholder(selectedDoc.generated_html)} sandbox="allow-scripts" className="w-full h-full rounded-xl" title="Document Preview" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-slate-400">Documento não disponível</p>
                  </div>
                )}
              </div>
              <div className="relative w-full max-w-2xl mx-auto border-2 border-dashed border-slate-300 rounded-[2rem] overflow-hidden mb-4 shadow-inner">
                <canvas
                  ref={canvasRef}
                  className="w-full cursor-crosshair touch-none"
                  style={{ touchAction: 'none' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {!hasSignature && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 font-black text-2xl uppercase tracking-wider opacity-60">
                    Assine Aqui
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-2xl mx-auto">
                <button onClick={clearCanvas} className="w-full sm:w-auto px-6 py-4 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Limpar Quadro</button>
              </div>
              <button
                onClick={handleSign}
                disabled={!hasSignature || signing}
                className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${hasSignature && !signing ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
              >
                {signing ? <><Loader2 size={16} className="animate-spin" /> A processar...</> : <><CheckCircle size={16} /> Assinar Documento</>}
              </button>
            </div>
          </div>
        </>
      )}

      {acroformDoc && (
        <div className="fixed inset-0 z-[150] bg-white overflow-auto">
          <DocumentViewer
            document={acroformDoc}
            onBack={() => { setAcroformDoc(null); loadTemplateDocs(); }}
            onSigned={() => loadTemplateDocs()}
          />
        </div>
      )}
    </div>
  );
};

export default WorkerDocuments;
