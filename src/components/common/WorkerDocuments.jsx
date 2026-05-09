import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FileText, Edit2, X, Download, CheckCircle, Loader2, Filter, FileSignature } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDocDate } from '../../utils/dateUtils';
import { replaceTemplateFields } from '../../utils/templateFields';
import SignatureStamp from './SignatureStamp';
import { isPending, isSigned } from '../../constants/documentStatus';

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
  const stampRef = useRef(null);
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
  const pendentes = useMemo(
    () => docs.filter(d => isPending(d.status)).concat(templateDocs.filter(d => isPending(d.status))),
    [docs, templateDocs]
  );
  const historico = useMemo(
    () => docs.filter(d => isSigned(d.status)).concat(templateDocs.filter(d => isSigned(d.status))),
    [docs, templateDocs]
  );

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
      const canvas = canvasRef.current;
      const assinaturaUrl = canvas.toDataURL('image/png');

      const userIP = (workerIp && workerIp !== 'A obter IP...') ? workerIp : 'Desconhecido';
      const now = new Date().toISOString();
      const docId = selectedDoc?.id ?? '';

      // ── 1. Draw stamp using Canvas 2D API — zero CSS, zero oklch risk ──
      const stampBase64 = await new Promise((resolve) => {
        const SCALE = 2;
        const W = 580, H = 130;
        const c = document.createElement('canvas');
        c.width = W * SCALE;
        c.height = H * SCALE;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.scale(SCALE, SCALE);

        const rrect = (x, y, w, h, r) => {
          ctx.beginPath();
          ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
          ctx.arcTo(x + w, y, x + w, y + r, r);
          ctx.lineTo(x + w, y + h - r);
          ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
          ctx.lineTo(x + r, y + h);
          ctx.arcTo(x, y + h, x, y + h - r, r);
          ctx.lineTo(x, y + r);
          ctx.arcTo(x, y, x + r, y, r);
          ctx.closePath();
        };

        // Outer card background + border
        ctx.fillStyle = '#f8fafc'; rrect(1, 1, W - 2, H - 14, 12); ctx.fill();
        ctx.strokeStyle = '#e0e7ff'; ctx.lineWidth = 2; rrect(1, 1, W - 2, H - 14, 12); ctx.stroke();

        // Signature image box
        ctx.fillStyle = '#ffffff'; rrect(10, 10, 105, H - 34, 8); ctx.fill();
        ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1; rrect(10, 10, 105, H - 34, 8); ctx.stroke();

        const drawText = () => {
          // Badge (indigo square + checkmark)
          ctx.fillStyle = '#4f46e5'; rrect(126, 11, 8, 8, 2); ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(128, 15.5); ctx.lineTo(130, 17.5); ctx.lineTo(133, 13.5); ctx.stroke();

          ctx.fillStyle = '#4f46e5'; ctx.font = 'bold 8.5px Arial';
          ctx.fillText('VALIDAÇÃO DIGITAL', 140, 20);

          const dateStr = new Date(now).toLocaleString('pt-PT');
          ctx.fillStyle = '#64748b'; ctx.font = '7px Arial'; ctx.fillText('Data/Hora:', 126, 38);
          ctx.fillStyle = '#1e293b'; ctx.font = 'bold 7px Arial'; ctx.fillText(dateStr, 200, 38);

          ctx.fillStyle = '#64748b'; ctx.font = '7px Arial'; ctx.fillText('Endereço IP:', 126, 52);
          ctx.fillStyle = '#1e293b'; ctx.font = 'bold 7px Arial'; ctx.fillText(userIP || 'N/D', 200, 52);

          ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(126, 59); ctx.lineTo(W - 10, 59); ctx.stroke();

          ctx.fillStyle = '#94a3b8'; ctx.font = '6px Arial'; ctx.fillText('ID:', 126, 70);
          ctx.font = '6px monospace';
          ctx.fillText(docId ? docId.substring(0, 20) + '...' : '', 140, 70);

          ctx.fillStyle = '#94a3b8'; ctx.font = '5px Arial';
          ctx.fillText('Documento validado eletronicamente', 0, H - 3);

          resolve(c.toDataURL('image/png'));
        };

        const sigImg = new Image();
        sigImg.onload = () => {
          ctx.globalCompositeOperation = 'multiply';
          ctx.drawImage(sigImg, 16, 16, 93, H - 46);
          ctx.globalCompositeOperation = 'source-over';
          drawText();
        };
        sigImg.onerror = () => drawText();
        sigImg.src = assinaturaUrl;
      });

      // ── 2. Generate PDF ──
      let pdfBlob;

      const isTemplateDoc = !!(selectedDoc.templateId || selectedDoc.template_id);

      if (isTemplateDoc && selectedDoc.generated_html) {
        // Parse template HTML via DOMParser and inject scripts BEFORE writing to iframe
        const parser = new DOMParser();
        const tmplDoc = parser.parseFromString(selectedDoc.generated_html, 'text/html');

        // Force Tailwind v3 (hex colors, no oklch)
        tmplDoc.querySelectorAll('script[src]').forEach(s => {
          if ((s.getAttribute('src') || '').includes('tailwindcss')) {
            s.setAttribute('src', 'https://cdn.tailwindcss.com/3.4.16');
          }
        });

        // Inject html2canvas into <head> at parse time (no post-write DOM manipulation)
        const h2cTag = tmplDoc.createElement('script');
        h2cTag.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        (tmplDoc.head || tmplDoc.documentElement).appendChild(h2cTag);

        // Inject CSS to normalise A4 width and remove body margins
        const normCSS = tmplDoc.createElement('style');
        normCSS.textContent = [
          'html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; width: 210mm !important; min-height: 297mm !important; }',
          '.document-container { width: 210mm !important; min-height: 297mm !important; margin: 0 !important; padding: 20mm !important; box-shadow: none !important; box-sizing: border-box !important; }',
          '* { box-sizing: border-box !important; }'
        ].join('\n');
        (tmplDoc.head || tmplDoc.documentElement).appendChild(normCSS);

        const cleanHtml = '<!DOCTYPE html>' + tmplDoc.documentElement.outerHTML;

        const iframe = document.createElement('iframe');
        // A4 = 210mm, which is ~794px at 96dpi. We use a bit more for safe rendering.
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:800px;height:1200px;border:none;overflow:hidden;';
        document.body.appendChild(iframe);

        try {
          iframe.contentDocument.open();
          iframe.contentDocument.write(cleanHtml);
          iframe.contentDocument.close();

          // Poll until both Tailwind v3 and html2canvas are ready inside the iframe
          await new Promise((resolve, reject) => {
            const deadline = Date.now() + 15000;
            const check = () => {
              if (Date.now() > deadline) {
                reject(new Error('Timeout a aguardar html2canvas/Tailwind (15s)'));
                return;
              }
              const win = iframe.contentWindow;
              if (win?.html2canvas && (win.tailwind || iframe.contentDocument.readyState === 'complete')) {
                setTimeout(resolve, 600);
              } else {
                setTimeout(check, 150);
              }
            };
            setTimeout(check, 300);
          });

          // Measure real content height and resize iframe
          const docEl = iframe.contentDocument.querySelector('.document-container') || iframe.contentDocument.body;
          const contentH = docEl.scrollHeight + 100;
          iframe.style.height = contentH + 'px';
          await new Promise(resolve => setTimeout(resolve, 100));

          // Append stamp image at bottom of document
          const stampDiv = iframe.contentDocument.createElement('div');
          stampDiv.style.cssText = 'margin-top:32px;display:flex;justify-content:flex-end;padding-right:8px;page-break-inside:avoid;';
          const stampImgEl = iframe.contentDocument.createElement('img');
          stampImgEl.src = stampBase64;
          stampImgEl.style.cssText = 'width:300px;height:auto;';
          stampDiv.appendChild(stampImgEl);
          docEl.appendChild(stampDiv);
          await new Promise(resolve => setTimeout(resolve, 200));

          // Capture with 2x scale (safer for memory) and exact pixel alignment
          const captureEl = iframe.contentDocument.querySelector('.document-container') || iframe.contentDocument.body;
          const captureH = captureEl.scrollHeight;
          const captureW = captureEl.scrollWidth;
          
          const iframeCanvas = await iframe.contentWindow.html2canvas(captureEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: captureW,
            height: captureH,
            windowWidth: captureW,
            windowHeight: captureH,
            logging: false,
            onclone: (clonedDoc) => {
              const el = clonedDoc.querySelector('.document-container') || clonedDoc.body;
              el.style.width = '210mm';
              el.style.margin = '0';
            }
          });

          // Load jsPDF and assemble PDF page-by-page
          let jsPDF = window.jspdf?.jsPDF;
          if (!jsPDF) {
            await new Promise((resolve, reject) => {
              const s = document.createElement('script');
              s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
              s.onload = () => { jsPDF = window.jspdf.jsPDF; resolve(); };
              s.onerror = reject;
              document.head.appendChild(s);
            });
          }

          const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
          const pageW = pdf.internal.pageSize.getWidth();
          const pageH = pdf.internal.pageSize.getHeight();
          const imgData = iframeCanvas.toDataURL('image/jpeg', 0.92);
          
          // The critical part: ensure totalImgH is calculated based on actual A4 width
          const totalImgH = pageW * (iframeCanvas.height / iframeCanvas.width);

          let yOff = 0;
          let pageNum = 1;
          const totalPages = Math.ceil(totalImgH / (pageH - 1)); // 1mm overlap buffer

          while (yOff < totalImgH - 1) { 
            if (pageNum > 1) pdf.addPage();
            
            // Add the document content
            pdf.addImage(imgData, 'JPEG', 0, -yOff, pageW, totalImgH, undefined, 'FAST');
            
            // Add page numbering
            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);
            pdf.text(`Página ${pageNum} de ${Math.max(pageNum, totalPages)}`, pageW / 2, pageH - 8, { align: 'center' });
            
            yOff += pageH;
            pageNum++;
          }
          pdfBlob = pdf.output('blob');
        } finally {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }

      } else {
        // ── Non-template docs: use PDF.co API to stamp existing PDF ──
        const stampPath = `${currentUser.id}/stamps/${Date.now()}.png`;
        const stampBlob = await fetch(stampBase64).then(r => r.blob());
        const { error: stampError } = await supabase.storage
          .from('documentos')
          .upload(stampPath, stampBlob, { contentType: 'image/png' });
        if (stampError) throw new Error(`Erro ao guardar stamp: ${stampError.message}`);
        const { data: stampUrlData } = supabase.storage.from('documentos').getPublicUrl(stampPath);
        const stampPublicUrl = stampUrlData.publicUrl;

        const pdfCoKey = import.meta.env.VITE_PDFCO_API_KEY;
        if (!pdfCoKey) throw new Error('VITE_PDFCO_API_KEY não configurada. Contacte o administrador.');
        const imgResponse = await fetch('https://api.pdf.co/v1/pdf/edit/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': pdfCoKey },
          body: JSON.stringify({
            url: selectedDoc.url,
            name: 'Documento_Assinado',
            images: [{ url: stampPublicUrl, x: 300, y: 755, width: 230, height: 55 }]
          })
        });
        const imgResult = await imgResponse.json();
        if (imgResult.error) throw new Error(imgResult.error);
        pdfBlob = await fetch(imgResult.url).then(async r => {
          if (!r.ok) throw new Error('Erro ao baixar PDF temporário do PDF.co');
          return r.blob();
        });
      }

      // ── 3. Upload signed PDF to Supabase Storage ──
      const pdfPath = `${currentUser.id}/documentos_assinados/${selectedDoc.id}_signed_${Date.now()}.pdf`;
      const { error: pdfError } = await supabase.storage
        .from('documentos')
        .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });
      if (pdfError) throw new Error(`Erro ao guardar PDF: ${pdfError.message}`);

      const { data: pdfUrlData } = supabase.storage.from('documentos').getPublicUrl(pdfPath);
      const pdfAssinadoUrl = pdfUrlData.publicUrl;

      // ── 4. Persist metadata to database ──
      if (isTemplateDoc) {
        const docData = {
          status: 'signed',
          signed_at: now,
          signed_ip: userIP,
          signature_data: stampBase64,
          signed_pdf_url: pdfAssinadoUrl
        };
        const { error } = await supabase.from('worker_documents').update(docData).eq('id', selectedDoc.id);
        if (error) throw error;
        setTemplateDocs(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, ...docData } : d));
      } else {
        const docData = {
          id: selectedDoc.id,
          workerId: selectedDoc.workerId,
          tipo: selectedDoc.tipo,
          nomeFicheiro: selectedDoc.nomeFicheiro,
          url: selectedDoc.url,
          status: 'Assinado',
          assinaturaUrl: stampBase64,
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
          <div ref={stampRef} style={{ position: 'fixed', left: '-9999px', top: '-9999px', zIndex: -1 }} />
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
                  
                  <div className="border border-slate-200 rounded-2xl p-4 mb-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">Pré-visualização do Stamp</p>
                    <div className="flex justify-center">
                      <SignatureStamp
                        signature={canvasRef.current ? canvasRef.current.toDataURL('image/png') : ''}
                        ip={workerIp}
                        datetime={signerOpenedAt}
                        id={selectedDoc.id}
                      />
                    </div>
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
