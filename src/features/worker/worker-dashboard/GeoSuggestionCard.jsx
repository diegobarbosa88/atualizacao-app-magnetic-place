import React from 'react';
import { LogIn, LogOut, Loader2, MapPin, Building2, AlertTriangle, Edit2 } from 'lucide-react';
import { FT, FONT_MONO, SCALE } from './formacaoDesignTokens';

export default function GeoSuggestionCard({ geoSuggestion, geoSuggestionDismissed, setGeoSuggestion, setGeoSuggestionDismissed, geoActionLoading, handleConfirmGeoSuggestion, previousOpenLogs, clients, onCompleteLog }) {
  if (!geoSuggestion || geoSuggestionDismissed) return null;

  const isEntry = geoSuggestion.type === 'entrada';
  const blockedLog = isEntry && previousOpenLogs?.length > 0
    ? [...previousOpenLogs].sort((a, b) => a.date.localeCompare(b.date))[0]
    : null;

  return (
    <div
      className="rounded-2xl shadow-xl overflow-hidden mb-4 animate-in slide-in-from-top-4 duration-500 relative"
      style={{ background: `linear-gradient(135deg, ${FT.navy} 0%, ${FT.navyMid} 100%)`, boxShadow: '0 20px 40px -12px rgba(18,39,65,0.35)' }}
    >
      {/* glow decorativo, mesmo espírito do painel de ponto */}
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full pointer-events-none" style={{ background: 'rgba(235,141,0,0.10)' }} />

      <div className="p-5 flex flex-col gap-4 relative">

        {/* Ícone + info + estado */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/12 flex items-center justify-center flex-shrink-0 text-white">
            <Building2 size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`${SCALE.text.statLabel} mb-0.5`} style={{ fontFamily: FONT_MONO, color: FT.slate }}>
              {isEntry ? 'Registar entrada em' : 'Registar saída de'}
            </p>
            <p className="text-white font-extrabold text-xl leading-none truncate flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: geoSuggestion.within ? FT.ok : FT.warn }}
              />
              {geoSuggestion.client?.name}
            </p>
            {geoSuggestion.dist != null && (
              <span
                className={`inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full ${SCALE.text.badge}`}
                style={{
                  fontFamily: FONT_MONO,
                  background: geoSuggestion.within ? FT.okBg : FT.warnBg,
                  color: geoSuggestion.within ? FT.ok : FT.warn,
                }}
              >
                <MapPin size={11} />
                {geoSuggestion.within ? `Dentro · ${geoSuggestion.dist}m` : `Fora · ${geoSuggestion.dist}m`}
              </span>
            )}
          </div>
        </div>

        {/* Botão / Bloqueio */}
        {blockedLog ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: FT.warnBg }}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: FT.warn }} />
              <div className="min-w-0">
                {/* #8a4a00 fixo, não FT.orangeDeep: FT.orangeDeep sobre FT.warnBg
                    dá só 3,07:1 (falha AA) — #8a4a00 dá 6,08:1, mesmo valor já
                    usado noutros badges sobre este fundo (ver CLAUDE.md). */}
                <p className="text-xs font-black leading-snug" style={{ color: '#8a4a00' }}>
                  Tens um registo sem saída de {new Date(blockedLog.date + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className={`${SCALE.text.meta} mt-0.5`} style={{ color: FT.inkSoft }}>
                  Entrada {blockedLog.startTime} · {(clients || []).find(c => String(c.id) === String(blockedLog.clientId))?.name || 'Unidade'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onCompleteLog(blockedLog)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wide text-white transition-all active:scale-95 bg-[var(--orange)] hover:bg-[var(--orange-deep)]"
            >
              <Edit2 size={14} /> Completar Registo Anterior
            </button>
          </div>
        ) : (
          <button
            onClick={handleConfirmGeoSuggestion}
            disabled={geoActionLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50 text-white bg-[var(--orange)] hover:bg-[var(--orange-deep)]"
            style={isEntry && !geoActionLoading ? { animation: 'pulse-slow 2.5s ease-in-out infinite' } : {}}
          >
            {geoActionLoading ? <Loader2 size={14} className="animate-spin" /> : isEntry ? <LogIn size={14} /> : <LogOut size={14} />}
            {geoActionLoading ? 'A registar...' : isEntry ? 'Registar Entrada' : 'Registar Saída'}
          </button>
        )}

        {!isEntry && geoSuggestion.startTime && (
          <p className="text-center text-xs font-bold -mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Em serviço desde {geoSuggestion.startTime}
          </p>
        )}

      </div>
    </div>
  );
}
