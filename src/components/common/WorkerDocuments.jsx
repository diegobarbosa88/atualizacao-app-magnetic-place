import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FileText, Edit2, X, Download, CheckCircle, Loader2, Filter } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDocDate } from '../../utils/dateUtils';

const WorkerDocuments = ({ currentUser, documents, saveToDb }) => {
  const { supabase: contextSupabase } = useApp() || {};
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('magnetic_worker_doc_tab') || 'pendentes');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    localStorage.setItem('magnetic_worker_doc_tab', activeTab);
  }, [activeTab]);

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showSigner, setShowSigner] = useState(false);
  const [signing, setSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  const supabase = contextSupabase || window.supabase;

  useEffect(() => {
    if (showSigner && canvasRef.current) {
      const timer = setTimeout(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#4f46e5';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showSigner]);

  const docs = documents?.filter(d => d.workerId === currentUser?.id) || [];
  const pendentes = docs.filter(d => d.status === 'Pendente');
  const historico = docs.filter(d => d.status === 'Assinado');

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

      const pdfCoUrl = 'https://api.pdf.co/v1/pdf/edit/add';
      const pdfCoKey = import.meta.env.VITE_PDFCO_API_KEY || 'diegobarbosa@magneticplace.pt_QTV2lppvP8euGSGmWWAEU9iZTpb81mZIQqOJM1r9zsVW4weRfuolLhkdzXFTpNFU';

      const textResponse = await fetch(pdfCoUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': pdfCoKey },
        body: JSON.stringify({
          url: selectedDoc.url,
          name: 'Documento_Assinado',
          annotations: [{ text: `Assinado por ${workerName} em ${new Date(now).toLocaleString('pt-PT')} via IP ${userIP}`, x: 50, y: 750, width: 450, height: 16, fontsize: 9, color: '333333' }]
        })
      });

      const textResult = await textResponse.json();
      if (textResult.error) throw new Error(textResult.error);

      const pdfWithSigUrl = textResult.url;

      const imgResponse = await fetch(pdfCoUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': pdfCoKey },
        body: JSON.stringify({
          url: pdfWithSigUrl,
          name: 'Documento_Assinado_Completo',
          images: [{ url: assinaturaUrl, x: 400, y: 700, width: 150, height: 50 }]
        })
      });

      const imgResult = await imgResponse.json();
      if (imgResult.error) throw new Error(imgResult.error);

      const pdfCoTempUrl = imgResult.url;
      const pdfBlob = await fetch(pdfCoTempUrl).then(async r => {
        if (!r.ok) throw new Error('Erro ao baixar PDF temporário do PDF.co');
        return await r.blob();
      });

      const pdfPath = `${currentUser.id}/documentos_assinados/${selectedDoc.id}_signed_${Date.now()}.pdf`;
      const { data: pdfUpload, error: pdfError } = await supabase.storage
        .from('documentos')
        .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });

      if (pdfError) throw new Error(`Erro ao guardar PDF no seu storage: ${pdfError.message}`);

      const { data: pdfUrlData } = supabase.storage.from('documentos').getPublicUrl(pdfPath);
      const pdfAssinadoUrl = pdfUrlData.publicUrl;

      const docData = {
        id: selectedDoc.id,
        workerId: selectedDoc.workerId,
        tipo: selectedDoc.tipo,
        nomeFicheiro: selectedDoc.nomeFicheiro,
        url: selectedDoc.url,
        status: 'Assinado',
        assinaturaUrl: assinaturaUrl,
        dataAssinatura: now,
        signed_at: now,
        ipAssinatura: userIP,
        pdfAssinadoUrl: pdfAssinadoUrl,
        dataEmissao: selectedDoc.dataEmissao
      };

      await saveToDb('documentos', selectedDoc.id, docData);
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
        list = list.filter(d => d.tipo === filterType);
      }
      
      list = [...list].sort((a, b) => {
        if (sortBy === 'date_desc') {
          return (b.dataAssinatura || b.dataEmissao || '').localeCompare(a.dataAssinatura || a.dataEmissao || '');
        } else if (sortBy === 'date_asc') {
          return (a.dataAssinatura || a.dataEmissao || '').localeCompare(b.dataAssinatura || b.dataEmissao || '');
        } else if (sortBy === 'name_asc') {
          return (a.tipo || '').localeCompare(b.tipo || '');
        } else if (sortBy === 'name_desc') {
          return (b.tipo || '').localeCompare(a.tipo || '');
        }
        return 0;
      });
    }
    
    return list;
  }, [activeTab, pendentes, historico, filterType, sortBy]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(historico.map(d => d.tipo).filter(Boolean));
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
                <FileText size={18} className="text-indigo-500" />
                <div>
                  <p className="text-sm font-bold text-slate-700">{doc.tipo}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-slate-400">Emitido: {formatDocDate(doc.dataEmissao)}</p>
                    {doc.status === 'Assinado' && doc.dataAssinatura && (
                      <span className="text-slate-300">|</span>
                    )}
                    {doc.status === 'Assinado' && doc.dataAssinatura && (
                      <p className="text-[10px] text-emerald-600 font-bold">
                        Assinado: {new Date(doc.dataAssinatura).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${doc.status === 'Pendente' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {doc.status}
                </span>
                {doc.status === 'Pendente' ? (
                  <button onClick={() => { setSelectedDoc(doc); setShowSigner(true); }} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl">
                    <Edit2 size={14} />
                  </button>
                ) : (
                  <a href={doc.pdfAssinadoUrl || doc.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl">
                    <Download size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showSigner && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-black text-lg">{selectedDoc.tipo}</h4>
              <button onClick={() => { setShowSigner(false); clearCanvas(); }} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
            </div>
            <div className="w-full h-96 border rounded-xl mb-4 bg-slate-100 relative">
              {selectedDoc.url ? (
                <iframe src={`${selectedDoc.url}#toolbar=0`} className="w-full h-full rounded-xl" title="Document Preview" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400">Documento não disponível</p>
                </div>
              )}
            </div>
            <div className="bg-slate-50 p-4 rounded-xl mb-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-bold text-slate-500">Desenhe a sua assinatura abaixo:</p>
                <button type="button" onClick={clearCanvas} className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-700 transition-colors">
                  Limpar Área
                </button>
              </div>
              <div className="relative w-full max-w-2xl mx-auto bg-white border-2 border-dashed border-slate-300 rounded-[2rem] overflow-hidden shadow-inner">
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
      )}
    </div>
  );
};

export default WorkerDocuments;
