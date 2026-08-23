import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { getAttrs, getNomeEntidade, getDocNum, formatValToc, tipoDocLabel, FIELD_LABELS_TOC } from '../utils/tocUtils';
import ModalShell from '../../../../components/common/ModalShell';
import { FT } from '../../../../styles/designTokens';

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
    <ModalShell
      isOpen
      onClose={onClose}
      subtitle={tipoDocLabel(tipo)}
      title={docNum}
      meta={entidade || undefined}
      size="lg"
      footer={
        <div className="px-6 pb-6 pt-4">
          <button
            onClick={handleBaixarPdf}
            disabled={carregandoPdf}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-60 border-2 hover:bg-[var(--surface)]"
            style={{ borderColor: FT.slate, color: 'var(--navy)' }}
          >
            {carregandoPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {pdfUrl ? 'Abrir PDF' : 'Baixar PDF Original'}
          </button>
        </div>
      }
    >
      <div className="px-6 py-4">
        {campos.length === 0 ? (
          <p className="text-sm text-[var(--slate-dim)] text-center py-8">Sem dados disponíveis.</p>
        ) : (
          <div className="space-y-3">
            {campos.map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] w-36 shrink-0 pt-0.5">
                  {FIELD_LABELS_TOC[k] || k.replace(/_/g, ' ')}
                </span>
                <span className="text-sm text-[var(--ink-mid)] font-semibold flex-1 break-words">
                  {formatValToc(k, v)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
