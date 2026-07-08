import React from 'react';
import { LogIn, LogOut, Loader2, MapPin, Building2, AlertTriangle, Edit2 } from 'lucide-react';

export default function GeoSuggestionCard({ geoSuggestion, geoSuggestionDismissed, setGeoSuggestion, setGeoSuggestionDismissed, geoActionLoading, handleConfirmGeoSuggestion, previousOpenLogs, clients, onCompleteLog }) {
  if (!geoSuggestion || geoSuggestionDismissed) return null;

  const isEntry = geoSuggestion.type === 'entrada';
  const blockedLog = isEntry && previousOpenLogs?.length > 0
    ? [...previousOpenLogs].sort((a, b) => a.date.localeCompare(b.date))[0]
    : null;

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

        {/* Botão / Bloqueio */}
        {blockedLog ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 bg-orange-500/20 border border-orange-400/30 rounded-xl px-3 py-2.5">
              <AlertTriangle size={14} className="text-orange-300 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-orange-100 text-xs font-black leading-snug">
                  Tens um registo sem saída de {new Date(blockedLog.date + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-orange-200/70 text-[10px] font-bold mt-0.5">
                  Entrada {blockedLog.startTime} · {(clients || []).find(c => String(c.id) === String(blockedLog.clientId))?.name || 'Unidade'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onCompleteLog(blockedLog)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wide bg-orange-500 hover:bg-orange-400 text-white transition-all active:scale-95"
            >
              <Edit2 size={14} /> Completar Registo Anterior
            </button>
          </div>
        ) : (
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
        )}

        {!isEntry && geoSuggestion.startTime && (
          <p className="text-center text-xs font-bold text-indigo-200/60 -mt-1">
            Em serviço desde {geoSuggestion.startTime}
          </p>
        )}

      </div>
    </div>
  );
}
