import React from 'react';
import { UserCircle, X } from 'lucide-react';
import WorkerProfile from '../WorkerProfile';
import { FT, FONT_TITLE } from './formacaoDesignTokens';

export default function ProfileModal({ isOpen, onClose, worker, changeRequests, documents }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex flex-col sm:items-center sm:justify-center">
      <button className="flex-shrink-0 h-16 sm:hidden" onClick={onClose} aria-label="Fechar" />
      <div className="flex-1 sm:flex-none bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col sm:w-full sm:max-w-2xl sm:max-h-[85vh]">
        <div className="flex items-center gap-3 bg-white border-b px-5 py-4 shrink-0" style={{ borderColor: FT.border }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: FT.navyDeep }}>
            <UserCircle size={16} style={{ color: FT.orange }} />
          </div>
          <h2 className="flex-1 font-bold uppercase tracking-tight text-sm" style={{ fontFamily: FONT_TITLE, color: FT.navyDeep }}>Meu Perfil</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-4">
          <WorkerProfile
            worker={worker}
            changeRequests={changeRequests}
            documents={documents}
          />
        </div>
      </div>
    </div>
  );
}
