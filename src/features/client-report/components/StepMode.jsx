import React from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';

const StepMode = ({ onPick, onCancel }) => (
  <div className="animate-fade-in max-w-4xl mx-auto py-6">
    <div className="text-center mb-10">
      <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-2">Como deseja reportar?</h2>
      <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em]">Escolha o método mais simples</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <button onClick={() => onPick('quick')} className="group bg-white p-8 rounded-3xl border-2 border-slate-100 hover:border-indigo-600 transition-all text-left">
        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-5"><MessageCircle size={26} /></div>
        <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Mensagem Rápida</h3>
        <p className="text-slate-500 text-sm font-medium">Explique a divergência por texto. O administrador analisa e responde.</p>
      </button>
      <button onClick={() => onPick('precision')} className="group bg-white p-8 rounded-3xl border-2 border-slate-100 hover:border-amber-500 transition-all text-left">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-5"><Sparkles size={26} /></div>
        <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Ajuste de Precisão</h3>
        <p className="text-slate-500 text-sm font-medium">Indique exatamente que dias e horas devem mudar, colaborador a colaborador.</p>
      </button>
    </div>
    <div className="mt-10 text-center">
      <button onClick={onCancel} className="text-slate-400 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest">Voltar</button>
    </div>
  </div>
);

export default StepMode;
