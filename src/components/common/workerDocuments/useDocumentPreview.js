import { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';

async function renderPdfToSrcDoc(arrayBuffer) {
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
}

export function useDocumentPreview(showSigner, selectedDoc) {
  const { supabase } = useApp();
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewSrcDoc, setPreviewSrcDoc] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [previewMime, setPreviewMime] = useState('application/pdf');

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

  return { previewBlobUrl, previewSrcDoc, previewError, previewMime };
}
