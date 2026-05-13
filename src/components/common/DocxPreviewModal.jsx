import React, { useEffect, useRef } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { renderAsync } from 'docx-preview';

export default function DocxPreviewModal({ title, blob, loading, error, onClose }) {
  const previewContainerRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (loading || error || !blob) return;
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

    renderAsync(blob, container, undefined, {
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
        container.innerHTML = '<div style="padding:24px;color:#be123c;font-weight:bold;">Falha a renderizar pré-visualização: '
          + (err.message || 'erro desconhecido') + '</div>';
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
    };
  }, [blob, loading, error]);

  return (
    <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div
        className="w-[90vw] h-[90vh] max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-base sm:text-lg font-black text-slate-800 truncate pr-4">
            {title || 'Pré-visualização'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl flex-shrink-0"
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
          ) : loading || !blob ? (
            <div className="h-full flex items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <div
              ref={previewContainerRef}
              className="absolute inset-0 overflow-auto p-4"
            />
          )}
        </div>
      </div>
    </div>
  );
}
