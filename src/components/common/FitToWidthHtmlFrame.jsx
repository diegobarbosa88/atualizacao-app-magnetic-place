import React, { useEffect, useRef } from 'react';

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
// Altura fixa em vez de medida a partir do `scrollHeight` do conteúdo (era
// assim antes) — o `scrollHeight` varia por documento (um EPI curto e um
// Contrato mais longo davam proporções de "página" diferentes na
// pré-visualização), o que fazia o carimbo no fim do documento parecer
// desproporcionado em relação ao PDF real, gerado sempre em páginas A4
// inteiras. Conteúdo mais alto que uma página fica com scroll próprio
// dentro do iframe, não estica a proporção da "folha".
export default function FitToWidthHtmlFrame({ html, title, sandbox = 'allow-same-origin', className = '', containerClassName = 'absolute inset-0 overflow-auto p-4' }) {
  const outerRef = useRef(null);
  const wrapperRef = useRef(null);

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
      wrapper.style.height = `${A4_HEIGHT_PX * scale}px`;
    };

    applyFit();
    const resizeObserver = new ResizeObserver(applyFit);
    resizeObserver.observe(outer);
    return () => resizeObserver.disconnect();
  }, [html]);

  return (
    <div ref={outerRef} className={containerClassName}>
      <div ref={wrapperRef} style={{ transformOrigin: 'top left', margin: '0 auto' }}>
        <iframe
          title={title || 'Pré-visualização'}
          srcDoc={html}
          sandbox={sandbox}
          className={`border-0 bg-white shadow-sm ${className}`}
          style={{ width: A4_WIDTH_PX, height: A4_HEIGHT_PX, display: 'block' }}
        />
      </div>
    </div>
  );
}
