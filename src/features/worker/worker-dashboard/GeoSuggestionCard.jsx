import React from 'react';
import { LogIn, LogOut, Loader2 } from 'lucide-react';

export default function GeoSuggestionCard({ geoSuggestion, geoSuggestionDismissed, setGeoSuggestion, setGeoSuggestionDismissed, geoActionLoading, handleConfirmGeoSuggestion }) {
  if (!geoSuggestion || geoSuggestionDismissed) return null;

  const isWarning = geoSuggestion.within === false;

  return (
    <div className={`mb-6 rounded-[2rem] border shadow-xl overflow-hidden animate-in slide-in-from-top-4 duration-500 ${isWarning ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
      <div className="p-6 flex flex-col md:flex-row items-center gap-5">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${isWarning ? 'bg-amber-400 text-white' : 'bg-emerald-500 text-white'}`}>
          {geoSuggestion.type === 'entrada' ? <LogIn size={26} /> : <LogOut size={26} />}
        </div>
        <div className="flex-1 text-center md:text-left">
          {geoSuggestion.dist != null && (
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
              {geoSuggestion.within ? `Na unidade · ${geoSuggestion.dist} m` : `A ${geoSuggestion.dist} m da unidade`}
            </p>
          )}
          <p className="text-slate-800 font-black text-lg leading-tight">
            {geoSuggestion.type === 'entrada'
              ? `Registar chegada em ${geoSuggestion.client.name}?`
              : `Registar saída de ${geoSuggestion.client.name}?`}
          </p>
          {geoSuggestion.type === 'saida' && geoSuggestion.startTime && (
            <p className="text-sm text-slate-500 font-bold mt-0.5">Entrada registada às {geoSuggestion.startTime}</p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleConfirmGeoSuggestion}
            disabled={geoActionLoading}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm uppercase tracking-wide text-white transition-all active:scale-95 shadow-sm ${isWarning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:opacity-50`}
          >
            {geoActionLoading ? <Loader2 size={16} className="animate-spin" /> : (geoSuggestion.type === 'entrada' ? <LogIn size={16} /> : <LogOut size={16} />)}
            {geoSuggestion.type === 'entrada' ? 'Registar Entrada' : 'Registar Saída'}
          </button>
          <button
            onClick={() => { setGeoSuggestion(null); setGeoSuggestionDismissed(true); }}
            className="px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wide text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
          >
            Ignorar
          </button>
        </div>
      </div>
    </div>
  );
}
