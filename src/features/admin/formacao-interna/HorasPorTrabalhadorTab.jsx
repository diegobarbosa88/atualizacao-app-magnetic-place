import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { horasPorTrabalhador } from './formacaoApi';

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - i);

function corIndicador(horas, meta) {
  if (horas >= meta) return { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' };
  if (horas >= meta * 0.5) return { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' };
  return { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500' };
}

export default function HorasPorTrabalhadorTab() {
  const [ano, setAno] = useState(String(ANO_ATUAL));
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    horasPorTrabalhador(ano)
      .then(setDados)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [ano]);

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={ano}
          onChange={e => setAno(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--ink-soft)]"
        >
          {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--slate-dim)]">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : !dados?.trabalhadores?.length ? (
        <p className="text-center py-10 text-[var(--slate-dim)] text-xs font-bold">Sem dados de formação para {ano}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[9px] font-black uppercase tracking-widest text-[var(--slate-dim)] border-b border-[var(--border-soft)]">
                <th className="py-2 pr-4">Trabalhador</th>
                <th className="py-2 pr-4">Horas de Formação</th>
                <th className="py-2 pr-4">Meta Anual</th>
                <th className="py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {dados.trabalhadores.map(w => {
                const cor = corIndicador(w.horas, w.meta);
                return (
                  <tr key={w.worker_id} className="border-b border-[var(--border-soft)]">
                    <td className="py-3 pr-4 font-bold text-[var(--ink-mid)]">{w.nome}</td>
                    <td className="py-3 pr-4 text-[var(--ink-soft)]">{w.horas.toFixed(1)}h</td>
                    <td className="py-3 pr-4 text-[var(--slate-dim)]">{w.meta}h</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${cor.bg} ${cor.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cor.dot}`} />
                        {w.cumprido ? 'Cumprido' : `${w.horas.toFixed(1)}/${w.meta}h`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
