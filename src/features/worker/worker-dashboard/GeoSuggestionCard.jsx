import React from 'react';
import { LogIn, LogOut, Loader2, MapPin } from 'lucide-react';

export default function GeoSuggestionCard({ geoSuggestion, geoSuggestionDismissed, setGeoSuggestion, setGeoSuggestionDismissed, geoActionLoading, handleConfirmGeoSuggestion }) {
  if (!geoSuggestion || geoSuggestionDismissed) return null;

  const isEntry = geoSuggestion.type === 'entrada';
  const isWarning = geoSuggestion.within === false;

  return (
    <div className={`mb-4 rounded-2xl overflow-hidden animate-in slide-in-from-top-4 duration-500 ${isWarning ? 'bg-amber-50 border border-amber-200' : isEntry ? 'bg-emerald-600' : 'bg-slate-800'}`}>
      <div className="p-4 flex flex-col gap-3">
        {/* Nome do cliente */}
        <div className="text-center">
          <p className={`text-2xl font-black uppercase tracking-tight ${isWarning ? 'text-amber-800' : 'text-white'}`}>
            {geoSuggestion.client?.name}
          </p>
          {geoSuggestion.dist != null && (
            <span className={`flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest mt-0.5 ${isWarning ? 'text-amber-600' : 'text-white/50'}`}>
              <MapPin size={10} />
              {geoSuggestion.within ? `Na unidade · ${geoSuggestion.dist} m` : `${geoSuggestion.dist} m da unidade`}
            </span>
          )}
        </div>

        {/* Acção principal */}
        <button
          onClick={handleConfirmGeoSuggestion}
          disabled={geoActionLoading}
          className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-base uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50 shadow-sm
            ${isWarning
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : isEntry
                ? 'bg-white text-emerald-700 hover:bg-emerald-50 animate-pulse-slow'
                : 'bg-rose-500 hover:bg-rose-600 text-white'
            }`}
          style={isEntry && !geoActionLoading ? { animation: 'pulse-slow 2.5s ease-in-out infinite' } : undefined}
        >
          {geoActionLoading
            ? <Loader2 size={20} className="animate-spin" />
            : isEntry ? <LogIn size={20} /> : <LogOut size={20} />
          }
          {geoActionLoading ? 'A registar...' : isEntry ? 'Registar Entrada' : 'Registar Saída'}
        </button>

        {!isEntry && geoSuggestion.startTime && (
          <p className="text-center text-xs font-bold text-white/50">
            Em serviço desde {geoSuggestion.startTime}
          </p>
        )}
      </div>
    </div>
  );
}
