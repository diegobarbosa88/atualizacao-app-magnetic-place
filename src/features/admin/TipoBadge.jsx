import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default function TipoBadge({ tipo }) {
  if (tipo === 'credito') return (
    <span className="flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
      <ArrowDownLeft size={10} /> Entrada
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
      <ArrowUpRight size={10} /> Saída
    </span>
  );
}
