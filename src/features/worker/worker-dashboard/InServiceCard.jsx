import React, { useState, useEffect } from 'react';
import { LogOut, Coffee, Loader2, Timer } from 'lucide-react';

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

  const inBreak = todayOpenLog.breakStart && !todayOpenLog.breakEnd;
  const clientName = clients.find(c => String(c.id) === String(todayOpenLog.clientId))?.name;

  return (
    <div className="flex-shrink-0 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-200/30 overflow-hidden animate-in slide-in-from-top-4 duration-500 mb-4">
      <div className="p-5 flex flex-col gap-4">

        {/* Timer + info + dot */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Timer size={24} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200 mb-0.5">
              Em serviço desde {todayOpenLog.startTime}
            </p>
            <p className="text-white font-black text-3xl leading-none tabular-nums">{formatElapsed(todayOpenLog.startTime)}</p>
            <p className="text-indigo-200 text-sm font-bold mt-0.5 truncate">
              {clientName || 'Unidade'}
            </p>
          </div>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse flex-shrink-0" />
        </div>

        {/* Card de pausa activa */}
        {inBreak && (
          <div className="bg-amber-400/15 border border-amber-300/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <Coffee size={13} className="text-amber-200 shrink-0" />
            <span className="text-amber-100 text-sm font-bold">
              Em pausa desde {todayOpenLog.breakStart} · {formatElapsed(todayOpenLog.breakStart)}
            </span>
          </div>
        )}

        {/* Botões */}
        <div className="grid grid-cols-2 gap-2">
          {!todayOpenLog.breakStart && (
            <button
              onClick={() => handleRegistarPausa('inicio', todayOpenLog)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wide bg-white/15 hover:bg-white/25 text-white transition-all active:scale-95"
            >
              <Coffee size={14} /> Iniciar Pausa
            </button>
          )}
          {inBreak && (
            <button
              onClick={() => handleRegistarPausa('fim', todayOpenLog)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wide bg-amber-400/25 hover:bg-amber-400/40 text-amber-100 transition-all active:scale-95"
            >
              <Coffee size={14} /> Terminar Pausa
            </button>
          )}
          <button
            onClick={() => handleRegistarSaida(todayOpenLog)}
            disabled={geoActionLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wide bg-rose-500 hover:bg-rose-400 text-white transition-all active:scale-95 shadow-sm disabled:opacity-50"
          >
            {geoActionLoading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
            Registar Saída
          </button>
        </div>

      </div>
    </div>
  );
}
