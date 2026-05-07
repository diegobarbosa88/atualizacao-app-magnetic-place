import React, { useState, useEffect, useRef } from 'react';
import { FileText, Edit2, X, Download, CheckCircle, Loader2, Save } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { useApp } from '../../context/AppContext';
import { formatDocDate } from '../../utils/dateUtils';

const WorkerDocuments = ({ currentUser, documents, saveToDb }) => {
  const { supabase: contextSupabase } = useApp() || {};
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('magnetic_worker_doc_tab') || 'pendentes');

  useEffect(() => {
    localStorage.setItem('magnetic_worker_doc_tab', activeTab);
  }, [activeTab]);

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showSigner, setShowSigner] = useState(false);
  const [signing, setSigning] = useState(false);
  const sigCanvas = useRef(null);

  // Use context supabase or fallback to window.supabase
  const supabase = contextSupabase || window.supabase;

  useEffect(() => {
    if (showSigner && sigCanvas.current) {
      const canvas = sigCanvas.current.getCanvas();
      if (canvas) {
        setTimeout(() => {
          const rect = canvas.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            canvas.width = rect.width;
            canvas.height = rect.height;
            sigCanvas.current.clear();
          }
        }, 50);
      }
    }
  }, [showSigner]);

  const docs = documents?.filter(d => d.workerId === currentUser?.id) || [];
  const pendentes = docs.filter(d => d.status === 'Pendente');
  const historico = docs.filter(d => d.status === 'Assinado');

  const handleSign = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return alert('Assinatura obrigatória.');
    setSigning(true);

    try {
      const sigDataUrl = sigCanvas.current.toDataURL('image/png');
      const sigBlob = await fetch(sigDataUrl).then(r => r.blob());
      const sigPath = `${currentUser.id}/assinaturas/${Date.now()}.png`;
      const { data: sigUpload, error: sigError } = await supabase.storage
        .from('documentos')
        .upload(sigPath, sigBlob);

      if (sigError) throw new Error(`Erro upload assinatura: ${sigError.message}`);

      const { data: sigUrlData } = supabase.storage.from('documentos').getPublicUrl(sigPath);
      const assinaturaUrl = sigUrlData.publicUrl;

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
    } catch (err) {
      console.error('Erro completo:', err);
      alert(`Erro: ${err.message}`);
    }
    setSigning(false);
  };

  const docList = activeTab === 'pendentes' ? pendentes : historico;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-indigo-50/50 mt-8">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
        <FileText size={20} className="text-indigo-600" />
        <h3 className="font-black text-lg uppercase tracking-tight text-slate-800">Os Meus Documentos</h3>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('pendentes')} className={`px-4 py-2 rounded-xl font-bold text-sm ${activeTab === 'pendentes' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
          Pendentes ({pendentes.length})
        </button>
        <button onClick={() => setActiveTab('historico')} className={`px-4 py-2 rounded-xl font-bold text-sm ${activeTab === 'historico' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          Histórico ({historico.length})
        </button>
      </div>

      {docList.length === 0 ? (
        <p className="text-slate-400 text-center py-8">Nenhum documento.</p>
      ) : (
        <div className="space-y-3">
          {docList.sort((a, b) => b.dataEmissao?.localeCompare(a.dataEmissao)).map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-indigo-500" />
                <div>
                  <p className="text-sm font-bold text-slate-700">{doc.tipo}</p>
                  <p className="text-[10px] text-slate-400">{formatDocDate(doc.dataEmissao)}</p>
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
              <button onClick={() => setShowSigner(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
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
                <button type="button" onClick={() => sigCanvas.current?.clear()} className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-700 transition-colors">
                  Limpar Área
                </button>
              </div>
              <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden shadow-inner h-40">
                <SignatureCanvas ref={sigCanvas} penColor="black" canvasProps={{ className: 'w-full h-full cursor-crosshair' }} />
              </div>
            </div>
            <button
              onClick={handleSign}
              disabled={signing}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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