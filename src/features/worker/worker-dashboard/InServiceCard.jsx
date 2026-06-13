import React, { useState, useEffect } from 'react';
import { LogOut, Coffee, Loader2 } from 'lucide-react';

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
    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `${diffMins}m`;
    const hh = Math.floor(diffMins / 60);
    const mm = diffMins % 60;
    return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
  };

  if (!todayOpenLog) return null;

  const inBreak = todayOpenLog.breakStart && !todayOpenLog.breakEnd;
  const clientName = clients.find(c => String(c.id) === String(todayOpenLog.clientId))?.name;

  return (
    <div className={`mb-4 rounded-2xl overflow-hidden animate-in slide-in-from-top-4 duration-500 ${inBreak ? 'bg-amber-500' : 'bg-indigo-600'}`}>
      <div className="p-4 flex flex-col gap-3">

        {/* Status */}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${inBreak ? 'bg-amber-200' : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/70">
            {inBreak ? 'Em pausa' : 'Em serviço'}
          </span>
        </div>

        {/* Cliente + tempo */}
        <div className="text-center">
          {clientName && (
            <p className="text-lg font-black uppercase tracking-tight text-white mb-1">{clientName}</p>
          )}
          <p className="text-4xl font-black text-white tracking-tight">
            {formatElapsed(inBreak ? todayOpenLog.breakStart : todayOpenLog.startTime)}
          </p>
          <p className="text-xs text-white/50 font-bold mt-0.5">
            desde as {inBreak ? todayOpenLog.breakStart : todayOpenLog.startTime}
          </p>
        </div>

        {/* Botões */}
        <div className={`grid gap-2 ${inBreak ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {!inBreak && (
            <button
              onClick={() => handleRegistarPausa('inicio', todayOpenLog)}
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm uppercase tracking-wide bg-white/15 hover:bg-white/25 text-white transition-all active:scale-95"
            >
              <Coffee size={16} /> Pausa
            </button>
          )}
          {inBreak && (
            <button
              onClick={() => handleRegistarPausa('fim', todayOpenLog)}
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm uppercase tracking-wide bg-white text-amber-600 hover:bg-amber-50 transition-all active:scale-95 shadow-sm"
            >
              <Coffee size={16} /> Retomar
            </button>
          )}
          <button
            onClick={() => handleRegistarSaida(todayOpenLog)}
            disabled={geoActionLoading}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm uppercase tracking-wide bg-rose-500 hover:bg-rose-600 text-white transition-all active:scale-95 shadow-sm disabled:opacity-50"
          >
            {geoActionLoading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
            Saída
          </button>
        </div>
      </div>
    </div>
  );
}
