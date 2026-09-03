import React, { useEffect, useRef, useState } from 'react';

// Largura/altura de referência de uma página A4 a 96dpi. Os templates HTML
// da app (Fluxo 3 — assinatura via HTML/PDF.co) não fixam nenhuma largura em
// CSS de ecrã, só `@page { size: A4 }` (regra de impressão, sem efeito no
// browser) — sem isto o documento reflui a cada largura de contentor
// diferente, como uma página web comum, em vez de ficar fixo e só mudar de
// zoom (como um PDF real, sempre em páginas A4 inteiras). Mesmo valor já
// usado como fallback no preview docx (`firstPage.offsetWidth || 794`).
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

// Documento HTML de proporção A4 fixa que só muda de zoom para caber no
// contentor — extraído depois de aparecer 3x com a mesma lógica
// (DocxPreviewModal.jsx, HtmlDocumentViewer.jsx, WorkerDocuments.jsx).
export default function FitToWidthHtmlFrame({ html, title, sandbox = 'allow-same-origin', className = '', containerClassName = 'absolute inset-0 overflow-auto p-4' }) {
  const outerRef = useRef(null);
  const wrapperRef = useRef(null);
  const iframeRef = useRef(null);
  // Altura do iframe, em múltiplos exactos de página A4 — nunca a altura
  // "crua" do conteúdo (scrollHeight), que dava proporções de folha
  // diferentes por documento. Antes disto ficava sempre fixa numa página:
  // um documento mais alto (ex. Contrato de Trabalho, 2 páginas reais)
  // media o mesmo 1123px do iframe, e o excesso ficava com scroll NATIVO
  // dentro do próprio iframe — a par do scroll do `outer` que já existe
  // para caber o zoom no ecrã, dando duas barras de rolagem visíveis ao
  // mesmo tempo. Arredondar para o múltiplo de página mais próximo mantém
  // cada "folha" com a proporção A4 exacta e faz o iframe caber o
  // documento inteiro, sem scroll próprio — só o `outer` rola.
  const [pageHeight, setPageHeight] = useState(A4_HEIGHT_PX);

  useEffect(() => {
    setPageHeight(A4_HEIGHT_PX);
  }, [html]);

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const contentHeight = iframe.contentDocument?.documentElement?.scrollHeight || A4_HEIGHT_PX;
      const paginas = Math.max(1, Math.ceil(contentHeight / A4_HEIGHT_PX));
      setPageHeight(paginas * A4_HEIGHT_PX);
    } catch {
      setPageHeight(A4_HEIGHT_PX);
    }
  };

  useEffect(() => {
    const outer = outerRef.current;
    const wrapper = wrapperRef.current;
    if (!outer || !wrapper) return;

    const applyFit = () => {
      const availableWidth = outer.clientWidth - 32;
      const scale = Math.min(1, availableWidth / A4_WIDTH_PX);
      wrapper.style.transform = `scale(${scale})`;
      wrapper.style.transformOrigin = 'top left';
      wrapper.style.width = `${A4_WIDTH_PX * scale}px`;
      wrapper.style.height = `${pageHeight * scale}px`;
    };

    applyFit();
    const resizeObserver = new ResizeObserver(applyFit);
    resizeObserver.observe(outer);
    return () => resizeObserver.disconnect();
  }, [html, pageHeight]);

  return (
    <div ref={outerRef} className={containerClassName}>
      <div ref={wrapperRef} style={{ transformOrigin: 'top left', margin: '0 auto' }}>
        <iframe
          ref={iframeRef}
          title={title || 'Pré-visualização'}
          srcDoc={html}
          sandbox={sandbox}
          onLoad={handleIframeLoad}
          className={`border-0 bg-white shadow-sm ${className}`}
          style={{ width: A4_WIDTH_PX, height: pageHeight, display: 'block' }}
        />
      </div>
    </div>
  );
}
