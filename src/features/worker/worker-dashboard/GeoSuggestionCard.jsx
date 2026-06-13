import React from 'react';
import { LogIn, LogOut, Loader2, MapPin, Building2 } from 'lucide-react';

export default function GeoSuggestionCard({ geoSuggestion, geoSuggestionDismissed, setGeoSuggestion, setGeoSuggestionDismissed, geoActionLoading, handleConfirmGeoSuggestion }) {
  if (!geoSuggestion || geoSuggestionDismissed) return null;

  const isEntry = geoSuggestion.type === 'entrada';

  return (
    <div className="bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-200/30 overflow-hidden mb-4 animate-in slide-in-from-top-4 duration-500">
      <div className="p-5 flex flex-col gap-4">

        {/* Ícone + info + dot */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Building2 size={24} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200 mb-0.5">
              {isEntry ? 'Registar entrada em' : 'Registar saída de'}
            </p>
            <p className="text-white font-black text-xl leading-none truncate">{geoSuggestion.client?.name}</p>
            {geoSuggestion.dist != null && (
              <p className={`text-sm font-bold mt-0.5 ${geoSuggestion.within ? 'text-emerald-300' : 'text-rose-300'}`}>
                <MapPin size={10} className="inline mr-1 -mt-0.5" />
                {geoSuggestion.within ? `Dentro · ${geoSuggestion.dist}m` : `Fora · ${geoSuggestion.dist}m`}
              </p>
            )}
          </div>
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            geoSuggestion.within
              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
              : 'bg-rose-400'
          }`} />
        </div>

        {/* Botão */}
        <button
          onClick={handleConfirmGeoSuggestion}
          disabled={geoActionLoading}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50 text-white ${
            isEntry
              ? 'bg-emerald-500 hover:bg-emerald-400'
              : 'bg-rose-500 hover:bg-rose-400'
          }`}
          style={isEntry && !geoActionLoading ? { animation: 'pulse-slow 2.5s ease-in-out infinite' } : {}}
        >
          {geoActionLoading ? <Loader2 size={14} className="animate-spin" /> : isEntry ? <LogIn size={14} /> : <LogOut size={14} />}
          {geoActionLoading ? 'A registar...' : isEntry ? 'Registar Entrada' : 'Registar Saída'}
        </button>

        {!isEntry && geoSuggestion.startTime && (
          <p className="text-center text-xs font-bold text-indigo-200/60 -mt-1">
            Em serviço desde {geoSuggestion.startTime}
          </p>
        )}

      </div>
    </div>
  );
}
