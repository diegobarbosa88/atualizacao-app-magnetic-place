import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ onClose, title, children, wide = false }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-start justify-center p-4 overflow-y-auto">
      <div className={`bg-white w-full ${wide ? 'max-w-5xl' : 'max-w-2xl'} rounded-[2rem] p-6 shadow-2xl my-8`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-black text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
