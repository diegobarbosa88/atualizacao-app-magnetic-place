import React from 'react';
import { X } from 'lucide-react';

const ACCENT = {
  indigo: { header: 'bg-indigo-50 border-indigo-100', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600' },
  orange: { header: 'bg-orange-50 border-orange-100', iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
  rose:   { header: 'bg-rose-50 border-rose-100',     iconBg: 'bg-rose-100',   iconColor: 'text-rose-600'   },
  slate:  { header: 'bg-slate-50 border-slate-100',   iconBg: 'bg-slate-100',  iconColor: 'text-slate-600'  },
};

export default function ModalShell({ isOpen, onClose, title, subtitle, icon, accent = 'indigo', footer, children }) {
  if (!isOpen) return null;
  const a = ACCENT[accent] || ACCENT.indigo;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4">
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
        style={{ maxHeight: 'min(92dvh, 92vh)' }}
      >
        <div className={`flex items-center gap-3 ${a.header} border-b px-5 py-4 shrink-0`}>
          <div className={`w-8 h-8 rounded-xl ${a.iconBg} flex items-center justify-center shrink-0`}>
            <span className={a.iconColor}>{icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-slate-800 uppercase tracking-tight text-sm leading-none">{title}</h2>
            {subtitle && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all shrink-0"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          {children}
        </div>
        {footer && <div className="shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
