import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { FileText, Edit2, X, Download, CheckCircle, Loader2, Filter, FileSignature } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDocDate } from '../../utils/dateUtils';
import { replaceTemplateFields } from '../../utils/templateFields';
import SignatureStamp from './SignatureStamp';

const WorkerDocuments = ({ currentUser, documents, saveToDb }) => {
  const { supabase: contextSupabase } = useApp() || {};
  const supabase = contextSupabase || window.supabase;
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('magnetic_worker_doc_tab') || 'pendentes');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [showFilters, setShowFilters] = useState(false);
  const [templateDocs, setTemplateDocs] = useState([]);

  useEffect(() => {
    localStorage.setItem('magnetic_worker_doc_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (currentUser?.id && supabase) {
      loadTemplateDocs();
    }
  }, [currentUser?.id]);

  const loadTemplateDocs = async () => {
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
  };

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showSigner, setShowSigner] = useState(false);
  const [signing, setSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [workerIp, setWorkerIp] = useState('A obter IP...');
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
      fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => setWorkerIp(data.ip || 'Desconhecido'))
        .catch(() => setWorkerIp('Desconhecido'));
    }
  }, [showSigner]);

  const docs = documents?.filter(d => d.workerId === currentUser?.id) || [];
  const pendentes = docs.filter(d => d.status === 'Pendente').concat(templateDocs.filter(d => d.status === 'pending'));
  const historico = docs.filter(d => d.status === 'Assinado').concat(templateDocs.filter(d => d.status === 'signed'));

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

      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const userIP = ipData.ip || 'Desconhecido';
      const now = new Date().toISOString();
      const workerName = currentUser?.name || 'Desconhecido';

      if (!stampRef.current) {
        throw new Error('Stamp ref not ready');
      }

      const root = createRoot(stampRef.current);
      root.render(
        React.createElement(SignatureStamp, {
          signature: assinaturaUrl,
          workerName: workerName,
          ip: userIP,
          datetime: now,
          id: selectedDoc.id
        })
      );

      await new Promise(resolve => {
        const maxWait = 3000;
        const checkInterval = 100;
        let waited = 0;
        const check = () => {
          if (stampRef.current && stampRef.current.querySelector('.bg-indigo-600')) {
            resolve();
          } else if (waited >= maxWait) {
            resolve();
          } else {
            waited += checkInterval;
            setTimeout(check, checkInterval);
          }
        };
        setTimeout(check, 50);
      });

      const actualWidth = stampRef.current.scrollWidth || 560;
      const actualHeight = stampRef.current.scrollHeight || 150;

      const stampCanvas = await html2canvas(stampRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        width: actualWidth,
        height: actualHeight,
        x: 0,
        y: 0
      });

      const stampBase64 = stampCanvas.toDataURL('image/png');

      if (stampBase64.length < 5000) {
        root.unmount();
        throw new Error('Stamp capture failed - image too small');
      }

      root.unmount();

      let pdfBlob;
      
      if (selectedDoc.templateId && selectedDoc.generated_html) {
        const previewEl = document.createElement('div');
        previewEl.innerHTML = selectedDoc.generated_html;
        previewEl.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:794px;padding:40px;background:white;font-family:Arial,sans-serif;';
        document.body.appendChild(previewEl);
        
        let html2pdf = window.html2pdf;
        if (!html2pdf) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = () => { html2pdf = window.html2pdf; resolve(); };
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        
        pdfBlob = await html2pdf().set({
          margin: 0,
          filename: `${selectedDoc.title || 'document'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(previewEl).output('blob');
        
        document.body.removeChild(previewEl);
      } else {
        const stampPath = `${currentUser.id}/stamps/${Date.now()}.png`;
        const stampBlob = await fetch(stampBase64).then(r => r.blob());
        const { error: stampError } = await supabase.storage
          .from('documentos')
          .upload(stampPath, stampBlob, { contentType: 'image/png' });
        if (stampError) throw new Error(`Erro ao guardar stamp: ${stampError.message}`);
        const { data: stampUrlData } = supabase.storage.from('documentos').getPublicUrl(stampPath);
        const stampPublicUrl = stampUrlData.publicUrl;

        const pdfCoUrl = 'https://api.pdf.co/v1/pdf/edit/add';
        const pdfCoKey = import.meta.env.VITE_PDFCO_API_KEY || 'diegobarbosa@magneticplace.pt_QTV2lppvP8euGSGmWWAEU9iZTpb81mZIQqOJM1r9zsVW4weRfuolLhkdzXFTpNFU';

        const imgResponse = await fetch(pdfCoUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': pdfCoKey },
          body: JSON.stringify({
            url: selectedDoc.url,
            name: 'Documento_Assinado',
            images: [
              { url: stampPublicUrl, x: 300, y: 755, width: 230, height: 55 }
            ]
          })
        });

        const imgResult = await imgResponse.json();
        if (imgResult.error) throw new Error(imgResult.error);

        const pdfCoTempUrl = imgResult.url;
        pdfBlob = await fetch(pdfCoTempUrl).then(async r => {
          if (!r.ok) throw new Error('Erro ao baixar PDF temporário do PDF.co');
          return await r.blob();
        });
      }

      const pdfPath = `${currentUser.id}/documentos_assinados/${selectedDoc.id}_signed_${Date.now()}.pdf`;
      const { data: pdfUpload, error: pdfError } = await supabase.storage
        .from('documentos')
        .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });

      if (pdfError) throw new Error(`Erro ao guardar PDF no seu storage: ${pdfError.message}`);

const { data: pdfUrlData } = supabase.storage.from('documentos').getPublicUrl(pdfPath);
      const pdfAssinadoUrl = pdfUrlData.publicUrl;

      const isTemplateDoc = !!(selectedDoc.templateId || selectedDoc.template_id);
      
      if (isTemplateDoc) {
        const docData = {
          id: selectedDoc.id,
          status: 'signed',
          signed_at: now,
          signed_ip: userIP,
          signature_data: stampBase64,
          pdfAssinadoUrl: pdfAssinadoUrl
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
      alert('Documento assinado com sucesso! O PDF será atualizado em breve.');
      setShowSigner(false);
      setSelectedDoc(null);
      clearCanvas();
    } catch (err) {
      console.error('Erro completo:', err);
      alert(`Erro: ${err.message}`);
    }
    setSigning(false);
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
                    {(doc.status === 'Assinado' || doc.status === 'signed') && (doc.dataAssinatura || doc.signed_at) && (
                      <span className="text-slate-300">|</span>
                    )}
                    {(doc.status === 'Assinado' || doc.status === 'signed') && (doc.dataAssinatura || doc.signed_at) && (
                      <p className="text-[10px] text-emerald-600 font-bold">
                        Assinado: {new Date(doc.dataAssinatura || doc.signed_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${(doc.status === 'Pendente' || doc.status === 'pending') ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {doc.status === 'pending' ? 'Pendente' : doc.status}
                </span>
                {(doc.status === 'Pendente' || doc.status === 'pending') ? (
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
                  <iframe srcDoc={selectedDoc.generated_html} className="w-full h-full rounded-xl" title="Document Preview" />
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
                        datetime={new Date().toISOString()} 
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
