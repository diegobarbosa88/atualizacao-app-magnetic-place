import React from 'react';
import { Upload, X, Loader2 } from 'lucide-react';

const TIPOS_MANUAIS = ['Recibo de Vencimento', 'Mapa de Deslocamento', 'Contrato de Trabalho', 'Outro'];

export default function UploadManualModal({
  workers,
  uploading,
  selWorker, setSelWorker,
  selTipo, setSelTipo,
  selFile, setSelFile,
  onClose,
  onUpload,
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-[2rem] p-6 shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Upload size={18} /></div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Upload Manual</h2>
          </div>
          <button
            onClick={() => !uploading && onClose()}
            className="p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50"
            disabled={uploading}
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Colaborador</label>
            <select
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
              value={selWorker}
              onChange={(e) => setSelWorker(e.target.value)}
              disabled={uploading}
            >
              <option value="">Selecionar...</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo</label>
            <select
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
              value={selTipo}
              onChange={(e) => setSelTipo(e.target.value)}
              disabled={uploading}
            >
              {TIPOS_MANUAIS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ficheiro (PDF)</label>
            <input
              type="file"
              accept=".pdf"
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs cursor-pointer"
              onChange={(e) => setSelFile(e.target.files?.[0])}
              disabled={uploading}
            />
            {selFile && (
              <p className="text-[10px] text-slate-500 mt-1 ml-1 truncate">{selFile.name}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-5 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onUpload}
            disabled={uploading || !selWorker || !selFile}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2 disabled:opacity-50 transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-200"
          >
            {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            {uploading ? 'A Enviar...' : 'Submeter'}
          </button>
        </div>
      </div>
    </div>
  );
}
