import React, { useEffect, useRef } from 'react';

// Largura de referência de uma página A4 a 96dpi. Os templates HTML da app
// (Fluxo 3 — assinatura via HTML/PDF.co) não fixam nenhuma largura em CSS de
// ecrã, só `@page { size: A4 }` (regra de impressão, sem efeito no browser)
// — sem isto o documento reflui a cada largura de contentor diferente, como
// uma página web comum, em vez de ficar fixo e só mudar de zoom (como um
// PDF). Mesmo valor já usado como fallback no preview docx
// (`firstPage.offsetWidth || 794`).
const A4_WIDTH_PX = 794;

// Documento HTML de largura fixa que só muda de zoom para caber no
// contentor — extraído depois de aparecer 3x com a mesma lógica
// (DocxPreviewModal.jsx, HtmlDocumentViewer.jsx, WorkerDocuments.jsx).
// O iframe fica sempre ao tamanho natural (794px de largura, altura medida
// depois do load do `srcDoc`); um <div> wrapper à volta é que recebe
// `transform: scale(...)` + width/height já escalados, reagindo a
// ResizeObserver quando o contentor muda de tamanho.
export default function FitToWidthHtmlFrame({ html, title, sandbox = 'allow-same-origin', className = '', containerClassName = 'absolute inset-0 overflow-auto p-4' }) {
  const outerRef = useRef(null);
  const wrapperRef = useRef(null);
  const iframeRef = useRef(null);
  const naturalHeightRef = useRef(0);

  useEffect(() => {
    if (!html) return;
    const outer = outerRef.current;
    const wrapper = wrapperRef.current;
    if (!outer || !wrapper) return;

    let cancelled = false;
    let resizeObserver = null;

    const applyFit = () => {
      const naturalHeight = naturalHeightRef.current;
      if (!naturalHeight) return;
      const availableWidth = outer.clientWidth - 32;
      const scale = Math.min(1, availableWidth / A4_WIDTH_PX);
      wrapper.style.transform = `scale(${scale})`;
      wrapper.style.transformOrigin = 'top left';
      wrapper.style.width = `${A4_WIDTH_PX * scale}px`;
      wrapper.style.height = `${naturalHeight * scale}px`;
    };

    const handleIframeLoad = () => {
      if (cancelled) return;
      const iframe = iframeRef.current;
      let measured = 0;
      try {
        measured = iframe.contentDocument?.documentElement?.scrollHeight || 0;
      } catch {
        measured = 0;
      }
      const naturalHeight = measured || 1123; // fallback: altura A4 a 96dpi
      naturalHeightRef.current = naturalHeight;
      iframe.style.height = `${naturalHeight}px`;
      applyFit();
      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(() => { if (!cancelled) applyFit(); });
      resizeObserver.observe(outer);
    };

    const iframe = iframeRef.current;
    iframe?.addEventListener('load', handleIframeLoad);
    if (iframe?.contentDocument?.readyState === 'complete') handleIframeLoad();

    return () => {
      cancelled = true;
      iframe?.removeEventListener('load', handleIframeLoad);
      resizeObserver?.disconnect();
    };
  }, [html]);

  return (
    <div ref={outerRef} className={containerClassName}>
      <div ref={wrapperRef} style={{ transformOrigin: 'top left' }}>
        <iframe
          ref={iframeRef}
          title={title || 'Pré-visualização'}
          srcDoc={html}
          sandbox={sandbox}
          className={`border-0 bg-white shadow-sm ${className}`}
          style={{ width: A4_WIDTH_PX, height: 1123, display: 'block' }}
        />
      </div>
    </div>
  );
}
