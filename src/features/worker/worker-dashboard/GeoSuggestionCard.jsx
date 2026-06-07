import React, { useState, useEffect } from 'react';
import { LogIn, LogOut, Loader2, MapPin } from 'lucide-react';

export default function GeoSuggestionCard({ geoSuggestion, geoSuggestionDismissed, setGeoSuggestion, setGeoSuggestionDismissed, geoActionLoading, handleConfirmGeoSuggestion }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!geoSuggestion || geoSuggestionDismissed) return null;

  const isEntry = geoSuggestion.type === 'entrada';
  const hm      = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const sec     = String(now.getSeconds()).padStart(2, '0');
  const dayNum  = now.toLocaleDateString('pt-PT', { day: '2-digit' });
  const month   = now.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '').toUpperCase();
  const year    = now.getFullYear();
  const weekday = now.toLocaleDateString('pt-PT', { weekday: 'long' });

  return (
    <div className="mb-4 rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm animate-in slide-in-from-top-4 duration-500">
      <div className="flex items-stretch bg-slate-50">
        <div className="flex flex-col items-center justify-center px-4 py-3 min-w-[64px] bg-indigo-600">
          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200">{month}</span>
          <span className="text-3xl font-black text-white leading-none">{dayNum}</span>
          <span className="text-[9px] font-bold text-indigo-200">{year}</span>
        </div>
        <div className="flex flex-col justify-center px-4 flex-1 py-3">
          <span className="text-[10px] font-black uppercase tracking-widest capitalize text-indigo-400">{weekday}</span>
          <div className="flex items-end gap-1 mt-0.5">
            <span className="text-4xl font-black tabular-nums leading-none text-slate-800">{hm}</span>
            <span className="text-xl font-bold tabular-nums mb-0.5 text-slate-300">{sec}</span>
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div className="text-center">
          <p className="text-2xl font-black uppercase tracking-tight text-slate-800">{geoSuggestion.client?.name}</p>
          {geoSuggestion.dist != null && (
            <span className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest mt-0.5 text-slate-400">
              <MapPin size={10} />{geoSuggestion.within ? `Na unidade · ${geoSuggestion.dist} m` : `${geoSuggestion.dist} m da unidade`}
            </span>
          )}
        </div>
        <button
          onClick={handleConfirmGeoSuggestion}
          disabled={geoActionLoading}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-base uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50 bg-emerald-600 hover:bg-emerald-700 text-white"
          style={isEntry && !geoActionLoading ? { animation: 'pulse-slow 2.5s ease-in-out infinite' } : {}}
        >
          {geoActionLoading ? <Loader2 size={20} className="animate-spin" /> : isEntry ? <LogIn size={20} /> : <LogOut size={20} />}
          {geoActionLoading ? 'A registar...' : isEntry ? 'Registar Entrada' : 'Registar Saída'}
        </button>
        {!isEntry && geoSuggestion.startTime && (
          <p className="text-center text-xs font-bold text-slate-400">
            Em serviço desde {geoSuggestion.startTime}
          </p>
        )}
      </div>
    </div>
  );
}
