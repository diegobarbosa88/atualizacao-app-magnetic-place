import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, AlertCircle } from 'lucide-react';
import { ESTADOS_OPTIONS } from '../../utils/validacaoHelpers';

// ─── Divergência com sinal ────────────────────────────────────────────────────
export function DivergenciaBadge({ sinal, className = 'text-sm font-black' }) {
  if (sinal == null || sinal === 0) return <span className={`${className} text-slate-400`}>0,00€</span>;
  const pos = sinal > 0;
  return (
    <span className={`${className} ${pos ? 'text-emerald-600' : 'text-red-600'}`}>
      {pos ? '+' : ''}{sinal.toFixed(2).replace('.', ',')}€
    </span>
  );
}

// ─── Picker de estado (clicável) ──────────────────────────────────────────────
export function EstadoPicker({ atual, onChange, size = 16 }) {
  const [aberto, setAberto] = useState(false);
  const opt = ESTADOS_OPTIONS.find(o => o.id === atual) ?? ESTADOS_OPTIONS[2];
  const { Icon, color } = opt;

  return (
    <div className="relative inline-flex" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setAberto(o => !o)}
        title="Alterar estado"
        className="p-0.5 rounded hover:bg-slate-100 transition-colors"
      >
        <Icon size={size} className={color} />
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-1 flex flex-col min-w-[110px]">
            {ESTADOS_OPTIONS.map(o => (
              <button key={o.id}
                onClick={() => { setAberto(false); if (o.id !== atual) onChange(o.id); }}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 ${o.id === atual ? 'bg-slate-50' : ''}`}
              >
                <o.Icon size={12} className={o.color} /> {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
