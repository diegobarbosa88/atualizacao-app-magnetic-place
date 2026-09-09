import React, { useState } from 'react';
import { QrCode, RefreshCw, ExternalLink, MapPin } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import SectionHeaderShell from '../../../components/common/SectionHeaderShell';
import { toISODateLocal } from '../../../utils/dateUtils';

// Painel mínimo v1: activar/regenerar o secreto do kiosk por cliente, e ver
// as picagens de hoje registadas via QR (logs com source='qr'). O registo em
// si vive só em `logs` — este ecrã é só leitura + a acção de gerir o
// secreto, sem endpoint dedicado (RLS de clients já desligada, logs já
// permissiva, mesmo padrão de EpiAdmin.jsx).
export default function PontoAdmin() {
  const { clients, logs, workers, saveToDb } = useApp();
  const [regenerando, setRegenerando] = useState(null);

  const hoje = toISODateLocal(new Date());
  const logsHoje = (logs || []).filter((l) => l.date === hoje && l.source === 'qr');

  const workerName = (id) => workers.find((w) => String(w.id) === String(id))?.name || id;
  const kioskUrl = (clientId) => `${window.location.origin}/kiosk/${clientId}`;

  const handleRegenerar = async (client) => {
    setRegenerando(client.id);
    try {
      const novoSecret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      await saveToDb('clients', client.id, { ...client, qr_secret_key: novoSecret });
    } finally {
      setRegenerando(null);
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
                  {c.qr_secret_key ? 'Kiosk ativo' : 'Kiosk desativado — sem secreto configurado'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {c.qr_secret_key && (
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
                  onClick={() => handleRegenerar(c)}
                  disabled={regenerando === c.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--navy-solid)] text-white text-xs font-bold disabled:opacity-50"
                >
                  <RefreshCw size={13} className={regenerando === c.id ? 'animate-spin' : ''} />
                  {c.qr_secret_key ? 'Regenerar chave' : 'Ativar kiosk'}
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
