import React, { useState, useEffect } from 'react';
import { Timer, LogOut, Coffee, Loader2 } from 'lucide-react';

export default function InServiceCard({ todayOpenLog, clients, handleRegistarPausa, handleRegistarSaida, geoActionLoading }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const formatElapsed = (startTimeStr) => {
    const [h, m] = startTimeStr.split(':').map(Number);
    const start = new Date(now);
    start.setHours(h, m, 0, 0);
    const diffMins = Math.max(0, Math.floor((now - start) / 60000));
    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `${diffMins} min`;
    const hh = Math.floor(diffMins / 60);
    const mm = diffMins % 60;
    return mm > 0 ? `${hh}h ${mm}min` : `${hh}h`;
  };

  if (!todayOpenLog) return null;

  return (
    <div className="mb-6 bg-indigo-600 rounded-[2rem] shadow-xl shadow-indigo-200 overflow-hidden animate-in slide-in-from-top-4 duration-500">
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Timer size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Em serviço desde {todayOpenLog.startTime}</p>
            <p className="text-white font-black text-2xl leading-tight">{formatElapsed(todayOpenLog.startTime)}</p>
            <p className="text-indigo-200 text-sm font-bold mt-0.5">
              {clients.find(c => String(c.id) === String(todayOpenLog.clientId))?.name || 'Unidade'}
            </p>
          </div>
          <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse flex-shrink-0" />
        </div>

        {todayOpenLog.breakStart && !todayOpenLog.breakEnd && (
          <div className="bg-amber-400/20 border border-amber-300/30 rounded-xl px-4 py-2 flex items-center gap-2">
            <Coffee size={14} className="text-amber-200" />
            <span className="text-amber-100 text-sm font-bold">Em pausa desde {todayOpenLog.breakStart} · {formatElapsed(todayOpenLog.breakStart)}</span>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {!todayOpenLog.breakStart && (
            <button onClick={() => handleRegistarPausa('inicio', todayOpenLog)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide bg-white/15 hover:bg-white/25 text-white transition-all active:scale-95">
              <Coffee size={14} /> Iniciar Pausa
            </button>
          )}
          {todayOpenLog.breakStart && !todayOpenLog.breakEnd && (
            <button onClick={() => handleRegistarPausa('fim', todayOpenLog)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide bg-amber-400/30 hover:bg-amber-400/50 text-amber-100 transition-all active:scale-95">
              <Coffee size={14} /> Terminar Pausa
            </button>
          )}
          <button
            onClick={() => handleRegistarSaida(todayOpenLog)}
            disabled={geoActionLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide bg-rose-500 hover:bg-rose-600 text-white transition-all active:scale-95 shadow-sm disabled:opacity-50"
          >
            {geoActionLoading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
            Registar Saída
          </button>
        </div>
      </div>
    </div>
  );
}
