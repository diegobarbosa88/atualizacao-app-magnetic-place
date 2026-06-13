import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';

const StepQuick = ({ onSubmit, onBack, busy }) => {
  const [text, setText] = useState('');
  return (
    <div className="animate-fade-in max-w-2xl mx-auto py-6">
      <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest mb-6">
          <ChevronLeft size={14} /> Mudar método
        </button>
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Descreva a divergência</h2>
        <p className="text-sm text-slate-500 mb-6">Seja específico: dia, colaborador, hora. O administrador vai analisar.</p>
        <textarea
          rows="8"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex: O João não esteve presente no dia 15 de manhã..."
          className="w-full border-2 border-slate-100 rounded-2xl p-5 bg-slate-50 text-slate-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
        />
        <button
          onClick={() => {
            if (!text.trim()) return alert('Descreva o problema.');
            onSubmit({ justification: text, items: [] });
          }}
          disabled={busy}
          className="w-full mt-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm disabled:opacity-50"
        >
          {busy ? 'A enviar...' : 'Enviar ao Administrador'}
        </button>
      </div>
    </div>
  );
};

export default StepQuick;
