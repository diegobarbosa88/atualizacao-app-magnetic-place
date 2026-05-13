import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, FileText, CheckCircle, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { replaceTemplateFields, TEMPLATE_FIELDS } from '../../utils/templateFields';
import { downloadPdf } from '../../utils/pdfGenerator';
import { isSigned } from '../../constants/documentStatus';

export function DocumentViewer({ document, onBack }) {
  const { supabase } = useApp();
  const [workerData, setWorkerData] = useState({});
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signatureCanvas, setSignatureCanvas] = useState(null);
  const [showSignature, setShowSignature] = useState(false);
  const [signatureError, setSignatureError] = useState('');

  const blocks = typeof document.blocks === 'string' ? JSON.parse(document.blocks) : (document.blocks || []);

  useEffect(() => {
    const loadWorker = async () => {
      if (!supabase || !document.worker_id) return;
      try {
        const { data } = await supabase
          .from('workers')
          .select('*')
          .eq('id', document.worker_id)
          .single();
        if (data) setWorkerData(data);
      } catch (err) {
        console.error('Erro ao carregar dados do trabalhador:', err);
      } finally {
        setLoading(false);
      }
    };
    loadWorker();
  }, [supabase, document.worker_id]);

  const renderBlock = (block) => {
    switch (block.type) {
      case 'title':
        return <h1 key={block.id} className="font-black text-2xl text-slate-800 mb-4">{block.content}</h1>;
      case 'subtitle':
        return <h2 key={block.id} className="font-bold text-base text-slate-600 mb-3">{block.content}</h2>;
      case 'paragraph': {
        let content = block.content || '';
        if (workerData && Object.keys(workerData).length > 0) {
          content = replaceTemplateFields(content, workerData, {});
        }
        return <p key={block.id} className="text-slate-700 mb-4 leading-relaxed">{content}</p>;
      }
      case 'signature':
        return (
          <div key={block.id} className="mt-8 pt-6 border-t border-slate-200">
            <div className="w-full h-24 bg-amber-50 border-2 border-dashed border-amber-200 rounded-2xl flex items-center justify-center">
              {document.signature_data ? (
                <img src={document.signature_data} alt="Assinatura" className="h-full object-contain" />
              ) : (
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Assinatura</span>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const handleSign = async () => {
    if (!signatureCanvas || signatureCanvas.isEmpty()) {
      setSignatureError('Por favor, assine antes de confirmar');
      return;
    }

    setSigning(true);
    setSignatureError('');

    try {
      const signatureData = signatureCanvas.getTrimmedCanvas().toDataURL('image/png');
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('worker_documents')
        .update({
          status: 'signed',
          signature_data: signatureData,
          signed_at: now
        })
        .eq('id', document.id);

      if (error) throw error;

      setShowSignature(false);
      window.location.reload();
    } catch (err) {
      console.error('Erro ao assinar:', err);
      setSignatureError('Erro ao assinar. Tente novamente.');
    } finally {
      setSigning(false);
    }
  };

  const handleDownload = () => {
    downloadPdf({
      id: document.id,
      title: document.title,
      blocks,
      workerData,
      signature_data: document.signature_data
    }, {}, `documento_${document.id}.pdf`);
  };

  const documentIsSigned = isSigned(document.status);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 sticky top-0 z-40">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-600">
            <ChevronLeft className="w-5 h-5" />
            <span className="font-semibold">Voltar</span>
          </button>
        </header>
        <main className="max-w-[21cm] mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded"></div>
            <div className="h-4 bg-slate-200 rounded w-5/6"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 sticky top-0 z-40">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
          <ChevronLeft className="w-5 h-5" />
          <span className="font-semibold">Voltar</span>
        </button>
        <div className="flex-1 flex items-center justify-center">
          <FileText className="w-5 h-5 text-slate-400 mr-2" />
          <span className="font-semibold text-slate-800">{document.title}</span>
        </div>
        <div className="w-16"></div>
      </header>

      <main className="max-w-[21cm] mx-auto py-6 px-4">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="p-6 md:p-12">
            {blocks.map(renderBlock)}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          {documentIsSigned ? (
            <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-bold text-emerald-700">
                Assinado em {document.signed_at ? new Date(document.signed_at).toLocaleString('pt-PT') : ''}
              </span>
            </div>
          ) : (
            <div className="bg-amber-50 px-4 py-2 rounded-full">
              <span className="text-sm font-bold text-amber-700">Pendente de assinatura</span>
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
        <div className="max-w-[21cm] mx-auto flex justify-end gap-3">
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-semibold">Descarregar PDF</span>
          </button>

          {!documentIsSigned && (
            <button
              onClick={() => setShowSignature(true)}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 flex items-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Assinar Digitalmente
            </button>
          )}
        </div>
      </div>

      {showSignature && (
        <SignatureModal
          onClose={() => setShowSignature(false)}
          onSign={handleSign}
          workerName={workerData.name}
          error={signatureError}
          signing={signing}
          setSignatureCanvas={setSignatureCanvas}
        />
      )}
    </div>
  );
}

function SignatureModal({ onClose, onSign, workerName, error, signing, setSignatureCanvas }) {
  let sigCanvas;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[2rem] p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-800">Assinar Documento</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          <span className="font-bold">Trabalhador:</span> {workerName}
        </p>

        <div className="mb-4">
          <canvas
            ref={c => { sigCanvas = c; if (c) { setSignatureCanvas(new SignatureCanvasWrapper(c)); } }}
            className="w-full h-[150px] bg-white border-2 border-slate-200 rounded-2xl cursor-crosshair"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">
            Cancelar
          </button>
          <button
            onClick={onSign}
            disabled={signing}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
          >
            {signing ? 'A assinar...' : 'Confirmar Assinatura'}
          </button>
        </div>
      </div>
    </div>
  );
}

class SignatureCanvasWrapper {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.isDrawing = false;
    this.hasSignature = false;

    canvas.width = canvas.offsetWidth;
    canvas.height = 150;
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = '#1E293B';

    canvas.addEventListener('mousedown', (e) => this.start(e));
    canvas.addEventListener('mousemove', (e) => this.draw(e));
    canvas.addEventListener('mouseup', () => this.stop());
    canvas.addEventListener('mouseleave', () => this.stop());
    canvas.addEventListener('touchstart', (e) => this.start(e.touches[0]));
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this.draw(e.touches[0]); });
    canvas.addEventListener('touchend', () => this.stop());
  }

  start(e) {
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  draw(e) {
    if (!this.isDrawing) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.hasSignature = true;
  }

  stop() {
    this.isDrawing = false;
    this.ctx.closePath();
  }

  isEmpty() {
    return !this.hasSignature;
  }

  getTrimmedCanvas() {
    const trimmed = document.createElement('canvas');
    const ctx = trimmed.getContext('2d');
    trimmed.width = this.canvas.width;
    trimmed.height = this.canvas.height;
    ctx.drawImage(this.canvas, 0, 0);
    return trimmed;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hasSignature = false;
  }
}

function X({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
