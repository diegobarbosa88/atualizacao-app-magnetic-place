import { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { getStampHTML } from '../../../hooks/useSignatureStamp';
import { cropSignatureCanvas } from '../../../utils/signatureCanvas';
import workerDocumentsCSS from '../WorkerDocuments.css?inline';

const oklchToGray = (match) => {
  const m = match.match(/oklch\(\s*([\d.]+)(%?)/i);
  if (!m) return '#000';
  let L = parseFloat(m[1]);
  if (m[2] === '%') L = L / 100;
  const v = Math.max(0, Math.min(255, Math.round(Math.pow(L, 1 / 2.2) * 255)));
  const hex = v.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
};

const replaceOklch = (text) =>
  (text || '').replace(/oklch\([^)]+\)/gi, (m) => oklchToGray(m));

const stripOklch = (clonedDoc) => {
  clonedDoc.querySelectorAll('*').forEach(el => {
    if (el.style && el.style.cssText) el.style.cssText = replaceOklch(el.style.cssText);
  });
  clonedDoc.querySelectorAll('style').forEach(style => {
    style.textContent = replaceOklch(style.textContent);
  });
};

function injectTailwindCDN(doc) {
  doc.querySelectorAll('script[src*="tailwindcss"]').forEach(s => s.remove());
  const script = doc.createElement('script');
  script.src = 'https://cdn.tailwindcss.com';
  (doc.head || doc.documentElement).appendChild(script);
}

async function signTemplateDoc({ selectedDoc, currentUser, signerOpenedAt, workerIp, signatureDataURL, supabase }) {
  const userIP = (workerIp && workerIp !== 'A obter IP...') ? workerIp : 'Desconhecido';
  const now = new Date().toISOString();
  const docId = selectedDoc?.id ?? '';

  const { stampHTML: stampMarkup, qrCodeDataURL } = await getStampHTML({
    signatureDataURL,
    datetime: signerOpenedAt,
    ip: userIP,
    id: docId,
    workerName: currentUser?.name || currentUser?.nome || null,
  });

  const parser = new DOMParser();
  const tmplDoc = parser.parseFromString(selectedDoc.generated_html, 'text/html');
  injectTailwindCDN(tmplDoc);

  const parseMargins = (raw) => {
    if (!raw) return [20, 20, 20, 20];
    const parts = String(raw).split(',').map(s => Number(s.trim()));
    if (parts.length !== 4 || parts.some(n => !Number.isFinite(n) || n < 0)) return [20, 20, 20, 20];
    return parts;
  };
  const metaMargins = tmplDoc.querySelector('meta[name="page-margins"]');
  const [mTop, mRight, mBottom, mLeft] = parseMargins(metaMargins?.getAttribute('content'));

  const workerCSStag = tmplDoc.createElement('style');
  workerCSStag.textContent = workerDocumentsCSS;
  (tmplDoc.head || tmplDoc.documentElement).appendChild(workerCSStag);

  const marginsCSS = tmplDoc.createElement('style');
  marginsCSS.textContent = `.a4-paper { padding: ${mTop}mm ${mRight}mm ${mBottom}mm ${mLeft}mm !important; }`;
  (tmplDoc.head || tmplDoc.documentElement).appendChild(marginsCSS);

  const a4 = tmplDoc.createElement('div');
  a4.className = 'a4-paper';
  a4.id = 'worker-a4-paper';
  while (tmplDoc.body.firstChild) a4.appendChild(tmplDoc.body.firstChild);
  tmplDoc.body.appendChild(a4);

  const bodyResetCSS = tmplDoc.createElement('style');
  bodyResetCSS.textContent = 'body { width: auto !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }';
  (tmplDoc.head || tmplDoc.documentElement).appendChild(bodyResetCSS);

  let sigArea = tmplDoc.querySelector('#worker-signature-placeholder');
  if (!sigArea) {
    sigArea = tmplDoc.createElement('div');
    sigArea.id = 'worker-signature-placeholder';
    sigArea.style.cssText = 'position:absolute;left:0px;top:0px;width:300px;height:150px;';
    a4.appendChild(sigArea);
  }

  const existingQrPlaceholder = tmplDoc.querySelector('#worker-qrcode-placeholder');
  if (existingQrPlaceholder) existingQrPlaceholder.remove();

  const originalLeft = sigArea.style.left || '0px';
  const originalTop = sigArea.style.top || '0px';
  while (sigArea.firstChild) sigArea.removeChild(sigArea.firstChild);
  sigArea.removeAttribute('style');
  sigArea.removeAttribute('class');
  sigArea.setAttribute('class', 'page-break-inside-avoid');
  sigArea.style.cssText = `position:absolute;left:${originalLeft};top:${originalTop};width:290px;border:none;background:transparent;padding:0;margin:0;`;
  sigArea.innerHTML = stampMarkup;

  const qrCodeFixed = tmplDoc.createElement('div');
  qrCodeFixed.id = 'qr-code-fixed';
  qrCodeFixed.style.cssText = 'position:absolute;right:5mm;bottom:5mm;width:20mm;height:20mm;z-index:99999;';
  qrCodeFixed.innerHTML = `<img src="${qrCodeDataURL}" style="width:100%;height:100%;object-fit:contain;" />`;
  a4.appendChild(qrCodeFixed);

  const cleanHtml = '<!DOCTYPE html>' + tmplDoc.documentElement.outerHTML;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:900px;height:1300px;border:none;';
  iframe.setAttribute('sandbox', 'allow-scripts');
  document.body.appendChild(iframe);

  iframe.contentDocument.open();
  iframe.contentDocument.write(cleanHtml);
  iframe.contentDocument.close();

  await new Promise(r => setTimeout(r, 1000));

  await new Promise((resolve, reject) => {
    const h2pScript = iframe.contentDocument.createElement('script');
    h2pScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    h2pScript.onload = () => setTimeout(resolve, 500);
    h2pScript.onerror = () => reject(new Error('Falha ao carregar html2pdf no iframe'));
    (iframe.contentDocument.head || iframe.contentDocument.documentElement).appendChild(h2pScript);
  });

  let pdfBlob;
  try {
    const target = iframe.contentDocument.querySelector('.a4-paper') || iframe.contentDocument.body;
    const ifW = iframe.contentWindow;
    const opt = {
      margin: ifW.Array.of(0, 0, 0, 0),
      filename: `${selectedDoc.id}_signed_${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 1.5, useCORS: true, logging: false,
        onclone: (clonedDoc) => { stripOklch(clonedDoc); },
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: {
        mode: ifW.Array.of('avoid-all', 'css', 'legacy'),
        avoid: ifW.Array.of('section', '.section', '[data-section]', '.signature-block', '.signature-area', '.magnetic-validation-stamp', '.page-break-inside-avoid'),
      },
    };
    pdfBlob = await ifW.html2pdf().set(opt).from(target).output('blob');
  } finally {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }

  const pdfPath = `${currentUser.id}/documentos_assinados/${selectedDoc.id}_signed_${Date.now()}.pdf`;
  const { error: pdfError } = await supabase.storage.from('documentos').upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });
  if (pdfError) throw new Error(`Erro ao guardar PDF: ${pdfError.message}`);

  const { data: pdfUrlData } = supabase.storage.from('documentos').getPublicUrl(pdfPath);
  const pdfAssinadoUrl = pdfUrlData.publicUrl;

  const docData = {
    status: 'signed', signed_at: now, signed_ip: userIP,
    signature_data: signatureDataURL, signed_pdf_url: pdfAssinadoUrl,
  };
  const { error } = await supabase.from('worker_documents').update(docData).eq('id', selectedDoc.id);
  if (error) throw error;
  return { docData, type: 'template' };
}

async function signPdfDoc({ selectedDoc, currentUser, signerOpenedAt, workerIp, signatureDataURL, saveToDb, supabase }) {
  const userIP = (workerIp && workerIp !== 'A obter IP...') ? workerIp : 'Desconhecido';
  const now = new Date().toISOString();
  const docId = selectedDoc?.id ?? '';

  const { stampHTML: stampHTMLFromFn, qrCodeDataURL } = await getStampHTML({
    signatureDataURL, datetime: signerOpenedAt, ip: userIP, id: docId,
    workerName: currentUser?.name || currentUser?.nome || null,
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

  await new Promise(r => setTimeout(r, 200));

  await new Promise((resolve, reject) => {
    const s = stampIframe.contentDocument.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => setTimeout(resolve, 150);
    s.onerror = () => reject(new Error('Falha ao carregar html2canvas (stamp)'));
    (stampIframe.contentDocument.head || stampIframe.contentDocument.documentElement).appendChild(s);
  });

  let stampBase64;
  let stampAspectRatio = 290 / 80;
  try {
    const stampTarget = stampIframe.contentDocument.querySelector('.magnetic-validation-stamp')
      || stampIframe.contentDocument.querySelector('.a4-paper');
    const tempCanvas = await stampIframe.contentWindow.html2canvas(stampTarget, {
      backgroundColor: '#ffffff', scale: 3, useCORS: true, logging: false,
      onclone: stripOklch,
    });
    stampBase64 = tempCanvas.toDataURL('image/png');
    stampAspectRatio = tempCanvas.width / tempCanvas.height;
  } finally {
    if (stampIframe.parentNode) stampIframe.parentNode.removeChild(stampIframe);
  }

  const { error: stampError } = await supabase.storage
    .from('documentos')
    .upload(`${currentUser.id}/stamps/${Date.now()}.png`, await fetch(stampBase64).then(r => r.blob()), { contentType: 'image/png' });
  if (stampError) throw new Error(`Erro ao guardar stamp: ${stampError.message}`);

  const { PDFDocument } = await import('pdf-lib');
  const originalPdfBytes = await fetch(selectedDoc.url).then(r => {
    if (!r.ok) throw new Error('Erro ao baixar PDF original');
    return r.arrayBuffer();
  });
  const pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
  let pngImage;
  try { pngImage = await pdfDoc.embedPng(stampBase64); }
  catch { pngImage = await pdfDoc.embedJpg(stampBase64); }

  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width: pageWidth } = lastPage.getSize();
  const stampWidth = 207;
  const stampHeight = stampWidth / stampAspectRatio;
  lastPage.drawImage(pngImage, { x: pageWidth - stampWidth - 30, y: 30, width: stampWidth, height: stampHeight });

  const pdfBlob = new Blob([await pdfDoc.save()], { type: 'application/pdf' });
  const pdfPath = `${currentUser.id}/documentos_assinados/${selectedDoc.id}_signed_${Date.now()}.pdf`;
  const { error: pdfError } = await supabase.storage.from('documentos').upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });
  if (pdfError) throw new Error(`Erro ao guardar PDF: ${pdfError.message}`);

  const { data: pdfUrlData } = supabase.storage.from('documentos').getPublicUrl(pdfPath);
  const pdfAssinadoUrl = pdfUrlData.publicUrl;

  const docData = {
    id: selectedDoc.id, workerId: selectedDoc.workerId, tipo: selectedDoc.tipo,
    nomeFicheiro: selectedDoc.nomeFicheiro, url: selectedDoc.url,
    status: 'Assinado', assinaturaUrl: signatureDataURL, dataAssinatura: now,
    signed_at: now, ipAssinatura: userIP, pdfAssinadoUrl, dataEmissao: selectedDoc.dataEmissao,
  };
  await saveToDb('documentos', selectedDoc.id, docData);
  return { docData, type: 'pdf' };
}

export function useSignDocument({ currentUser, saveToDb, signerOpenedAt, workerIp, canvasRef }) {
  const { supabase } = useApp();
  const [signing, setSigning] = useState(false);

  const handleSign = async (signatureFromModal, selectedDoc) => {
    const signatureDataURL = typeof signatureFromModal === 'string' && signatureFromModal
      ? signatureFromModal
      : (canvasRef.current ? cropSignatureCanvas(canvasRef.current) : '');
    if (!signatureDataURL) return alert('Assinatura obrigatória.');
    setSigning(true);
    try {
      const isTemplateDoc = !!(selectedDoc.templateId || selectedDoc.template_id);
      if (isTemplateDoc && selectedDoc.generated_html) {
        const { docData } = await signTemplateDoc({ selectedDoc, currentUser, signerOpenedAt, workerIp, signatureDataURL, supabase });
        return { docData, type: 'template' };
      } else {
        const { docData } = await signPdfDoc({ selectedDoc, currentUser, signerOpenedAt, workerIp, signatureDataURL, saveToDb, supabase });
        return { docData, type: 'pdf' };
      }
    } catch (err) {
      console.error('Erro completo:', err);
      alert(`Erro: ${err.message || 'Erro desconhecido'}`);
      return null;
    } finally {
      setSigning(false);
    }
  };

  return { signing, handleSign };
}
