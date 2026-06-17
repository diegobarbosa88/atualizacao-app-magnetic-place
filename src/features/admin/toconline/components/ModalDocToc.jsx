import React, { useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { getAttrs, getNomeEntidade, getDocNum, formatValToc, tipoDocLabel, FIELD_LABELS_TOC } from '../utils/tocUtils';

export default function ModalDocToc({ item, tipo, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [carregandoPdf, setCarregandoPdf] = useState(false);

  if (!item) return null;
  const attrs = getAttrs(item);

  const campos = Object.entries(attrs)
    .filter(([, v]) => v != null && v !== '' && typeof v !== 'object')
    .sort(([a], [b]) => {
      const order = ['document_number', 'document_no', 'date', 'customer_name', 'customer_business_name', 'supplier_name', 'supplier_business_name', 'gross_total', 'total_amount', 'total_tax_amount'];
      const ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    });

  const handleBaixarPdf = async () => {
    if (pdfUrl) { window.open(pdfUrl, '_blank'); return; }
    setCarregandoPdf(true);
    try {
      const tipoDoc = tipo === 'compras' ? 'compra' : tipo === 'recibos' ? 'recibo' : 'venda';
      const id = item.id ?? attrs.id;
      const res = await fetch(`/api/toconline/documento?id=${id}&tipo=${tipoDoc}`);
      const data = await res.json();
      if (data.pdf_url) {
        setPdfUrl(data.pdf_url);
        window.open(data.pdf_url, '_blank');
      } else {
        alert('PDF não disponível para este documento.');
      }
    } catch (e) {
      alert('Erro ao obter PDF: ' + e.message);
    } finally {
      setCarregandoPdf(false);
    }
  };

  const entidade = getNomeEntidade(attrs, tipo);
  const docNum = getDocNum(item, attrs);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{tipoDocLabel(tipo)}</p>
            <p className="text-sm font-bold text-slate-700">{docNum}</p>
            {entidade && <p className="text-xs text-slate-500 mt-0.5">{entidade}</p>}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors ml-3">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {campos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Sem dados disponíveis.</p>
          ) : (
            <div className="space-y-3">
              {campos.map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 w-36 shrink-0 pt-0.5">
                    {FIELD_LABELS_TOC[k] || k.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm text-slate-700 font-semibold flex-1 break-words">
                    {formatValToc(k, v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-slate-100">
          <button
            onClick={handleBaixarPdf}
            disabled={carregandoPdf}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60"
          >
            {carregandoPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {pdfUrl ? 'Abrir PDF' : 'Baixar PDF Original'}
          </button>
        </div>
      </div>
    </div>
  );
}
