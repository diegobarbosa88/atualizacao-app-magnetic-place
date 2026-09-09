import React, { useState } from 'react';
import { QrCode, RefreshCw, ExternalLink, MapPin } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import SectionHeaderShell from '../../../components/common/SectionHeaderShell';
import { toISODateLocal } from '../../../utils/dateUtils';
import { authFetch } from '../../../utils/authFetch';

// Painel mínimo v1: atribuir/revogar o registo de ponto por QR a um cliente
// (ativa o kiosk para esse cliente — todos os trabalhadores afetos a ele
// passam a ver "Picar Ponto"), e ver as picagens de hoje (logs com
// source='qr'). O segredo de assinatura do QR NUNCA chega a este
// componente nem a `clients` — vive numa tabela isolada só acessível pelos
// endpoints admin (ver api/formacao/index.js, ponto-kiosk-ativar/
// -desativar) — este ecrã só lê/escreve o booleano público `ponto_qr_ativo`.
export default function PontoAdmin() {
  const { clients, logs, workers } = useApp();
  const [processando, setProcessando] = useState(null);

  const hoje = toISODateLocal(new Date());
  const logsHoje = (logs || []).filter((l) => l.date === hoje && l.source === 'qr');

  const workerName = (id) => workers.find((w) => String(w.id) === String(id))?.name || id;
  const kioskUrl = (clientId) => `${window.location.origin}/kiosk/${clientId}`;

  const handleToggleKiosk = async (client) => {
    setProcessando(client.id);
    const endpoint = client.ponto_qr_ativo ? '/api/ponto/kiosk-desativar' : '/api/ponto/kiosk-ativar';
    try {
      await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      });
    } finally {
      setProcessando(null);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeaderShell
        icon={<QrCode size={18} />}
        title="Ponto QR"
        subtitle="Kiosk de registo de ponto por QR dinâmico, por cliente"
      />

      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-50">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Kiosks por cliente</p>
        </div>
        <div className="divide-y divide-slate-50">
          {(clients || []).map((c) => (
            <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-slate-700">{c.name}</p>
                <p className="text-xs text-slate-400">
                  {c.ponto_qr_ativo ? 'Ponto por QR atribuído — trabalhadores deste cliente veem "Picar Ponto"' : 'Ponto por QR não atribuído a este cliente'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {c.ponto_qr_ativo && (
                  <a
                    href={kioskUrl(c.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-100"
                  >
                    <ExternalLink size={13} /> Abrir kiosk
                  </a>
                )}
                <button
                  onClick={() => handleToggleKiosk(c)}
                  disabled={processando === c.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 ${c.ponto_qr_ativo ? 'bg-rose-50 text-rose-600' : 'bg-[var(--navy-solid)] text-white'}`}
                >
                  <RefreshCw size={13} className={processando === c.id ? 'animate-spin' : ''} />
                  {c.ponto_qr_ativo ? 'Desativar' : 'Atribuir a este cliente'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-50">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Ponto de hoje ({hoje})</p>
        </div>
        {logsHoje.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 text-center">Sem picagens por QR hoje.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 uppercase text-[10px] tracking-wide">
                <th className="px-4 py-2">Trabalhador</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Entrada</th>
                <th className="px-4 py-2">Pausa</th>
                <th className="px-4 py-2">Saída</th>
                <th className="px-4 py-2">Geo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logsHoje.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2 font-bold text-slate-700">{workerName(l.workerId)}</td>
                  <td className="px-4 py-2 text-slate-500">{clients.find((c) => String(c.id) === String(l.clientId))?.name || l.clientId}</td>
                  <td className="px-4 py-2 text-slate-500">{l.startTime || '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{l.breakStart ? `${l.breakStart}–${l.breakEnd || '...'}` : '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{l.endTime || '—'}</td>
                  <td className="px-4 py-2">
                    {l.geo_verified === true && <span className="inline-flex items-center gap-1 text-emerald-600"><MapPin size={11} /> dentro</span>}
                    {l.geo_verified === false && <span className="inline-flex items-center gap-1 text-amber-600"><MapPin size={11} /> fora</span>}
                    {l.geo_verified == null && <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
