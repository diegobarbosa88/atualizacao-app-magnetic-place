import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FileText, Edit2, X, Download, CheckCircle, Loader2, Filter, FileSignature } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useApp } from '../../context/AppContext';
import { formatDocDate } from '../../utils/dateUtils';
import { replaceTemplateFields } from '../../utils/templateFields';
import { getStampHTML } from '../../hooks/useSignatureStamp';
import { isPending, isSigned } from '../../constants/documentStatus';
import { cropSignatureCanvas } from '../../utils/signatureCanvas';

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
        const parser = new DOMParser();
        const tmplDoc = parser.parseFromString(selectedDoc.generated_html, 'text/html');

        const normCSS = tmplDoc.createElement('style');
        normCSS.textContent = [
          'html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; width: 210mm !important; }',
          'body { width: 210mm !important; min-height: 297mm !important; margin: 15mm !important; box-sizing: border-box !important; }',
          '.document-container { width: 210mm !important; min-height: 297mm !important; margin: 15mm !important; padding: 0 !important; box-shadow: none !important; box-sizing: border-box !important; }',
          '@media print { body { margin: 15mm !important; } .document-container { margin: 15mm !important; } .signature-block, .signature-area { page-break-inside: avoid !important; break-inside: avoid !important; } }',
          '* { box-sizing: border-box !important; }'
        ].join('\n');
        (tmplDoc.head || tmplDoc.documentElement).appendChild(normCSS);

        const stampDiv = tmplDoc.createElement('div');
        stampDiv.innerHTML = getStampHTML({
          signatureDataURL,
          datetime: signerOpenedAt,
          ip: userIP,
          id: docId
        });

        const container = tmplDoc.querySelector('.document-container') || tmplDoc.body;

        // Tentar injetar na zona de assinatura do template (primeiro .signature-area)
        const sigArea = container.querySelector('.signature-area');
        if (sigArea) {
          sigArea.innerHTML = '';
          sigArea.appendChild(stampDiv);
        } else {
          container.appendChild(stampDiv);
        }

        const cleanHtml = '<!DOCTYPE html>' + tmplDoc.documentElement.outerHTML;

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:820px;height:1200px;border:none;';
        document.body.appendChild(iframe);

        iframe.contentDocument.open();
        iframe.contentDocument.write(cleanHtml);
        iframe.contentDocument.close();

        // Aguardar html2canvas estar disponível no iframe
        await new Promise((resolve, reject) => {
          const h2cScript = iframe.contentDocument.createElement('script');
          h2cScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          h2cScript.onload = () => setTimeout(resolve, 400);
          h2cScript.onerror = () => reject(new Error('Falha ao carregar html2canvas no iframe'));
          (iframe.contentDocument.head || iframe.contentDocument.documentElement).appendChild(h2cScript);
        });

        const body = iframe.contentDocument.body;

        let jsPDF = window.jspdf?.jsPDF;
        if (!jsPDF) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            s.onload = () => { jsPDF = window.jspdf.jsPDF; resolve(); };
            s.onerror = () => reject(new Error('Falha ao carregar jsPDF'));
            document.head.appendChild(s);
          });
        }

        const captureCanvas = await iframe.contentWindow.html2canvas(body, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          onclone: (clonedDoc) => {
            clonedDoc.querySelectorAll('*').forEach(e => {
              e.style.cssText = (e.style.cssText || '').replace(/oklch\([^)]+\)/g, '#ffffff');
            });
            clonedDoc.querySelectorAll('style').forEach(style => {
              style.textContent = style.textContent.replace(/oklch\([^)]+\)/g, '#ffffff');
            });
          }
        });

        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const imgData = captureCanvas.toDataURL('image/jpeg', 0.92);

        const totalImgH = pageW * (captureCanvas.height / captureCanvas.width);

        let yOff = 0;
        let pageNum = 1;
        const overlap = 1;
        while (yOff + overlap < totalImgH) {
          if (pageNum > 1) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, -(yOff - (pageNum - 1) * overlap), pageW, totalImgH, undefined, 'FAST');
          pdf.setFontSize(8);
          pdf.setTextColor(150, 150, 150);
          pdf.text(`Página ${pageNum}`, pageW / 2, pageH - 8, { align: 'center' });
          yOff += pageH;
          pageNum++;
        }

        const pdfBlob = pdf.output('blob');
        document.body.removeChild(iframe);

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
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'position:fixed;left:-99999px;top:0;';
        tempDiv.innerHTML = getStampHTML({
          signatureDataURL,
          datetime: signerOpenedAt,
          ip: userIP,
          id: docId
        });
        document.body.appendChild(tempDiv);
        let stampBase64;
        try {
          const tempCanvas = await html2canvas(tempDiv, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            logging: false,
            onclone: (clonedDoc) => {
              clonedDoc.querySelectorAll('*').forEach(el => {
                el.style.cssText = (el.style.cssText || '').replace(/oklch\([^)]+\)/g, '#ffffff');
              });
              clonedDoc.querySelectorAll('style').forEach(style => {
                style.textContent = style.textContent.replace(/oklch\([^)]+\)/g, '#ffffff');
              });
            }
          });
          stampBase64 = tempCanvas.toDataURL('image/png');
        } finally {
          if (tempDiv.parentNode) tempDiv.parentNode.removeChild(tempDiv);
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
        const stampWidth = 280;
        const stampHeight = 80;
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
                  <button onClick={() => { setSelectedDoc(doc); setShowSigner(true); }} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl">
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
                  <iframe srcDoc={selectedDoc.generated_html} sandbox="allow-scripts" className="w-full h-full rounded-xl" title="Document Preview" />
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
    </div>
  );
};

export default WorkerDocuments;
