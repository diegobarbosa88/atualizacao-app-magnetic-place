import React from 'react';
import { FileText, X } from 'lucide-react';
import WorkerDocuments from '../../../components/common/WorkerDocuments';

export default function DocumentsModal({ isOpen, onClose, currentUser, documents, saveToDb }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex flex-col sm:hidden">
      <button className="flex-shrink-0 h-16" onClick={onClose} aria-label="Fechar" />
      <div className="flex-1 bg-white rounded-t-3xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 bg-slate-50 border-b border-slate-100 px-5 py-4 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-slate-600" />
          </div>
          <h2 className="flex-1 font-black text-slate-800 uppercase tracking-tight text-sm">Meus Documentos</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-4">
          <WorkerDocuments currentUser={currentUser} documents={documents} saveToDb={saveToDb} pendingOnly={false} />
        </div>
      </div>
    </div>
  );
}
