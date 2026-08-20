import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { listCertificacoes } from './formacaoApi';
import { CATEGORIAS } from './formacaoTemplates';

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.label]));

const ESTADO_CFG = {
  valido:    { label: 'Válido',    bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  a_expirar: { label: 'A Expirar', bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-500' },
  expirado:  { label: 'Expirado',  bg: 'bg-rose-50',    text: 'text-rose-600',    dot: 'bg-rose-500' },
};

export default function CertificacoesValidadeTab() {
  const [certificacoes, setCertificacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    listCertificacoes()
      .then(({ certificacoes }) => setCertificacoes(certificacoes))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : certificacoes.length === 0 ? (
        <p className="text-center py-10 text-slate-400 text-xs font-bold">Sem certificações com validade registadas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                <th className="py-2 pr-4">Trabalhador</th>
                <th className="py-2 pr-4">Categoria</th>
                <th className="py-2 pr-4">Certificação</th>
                <th className="py-2 pr-4">Obtenção</th>
                <th className="py-2 pr-4">Validade</th>
                <th className="py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {certificacoes.map((c, idx) => {
                const cfg = ESTADO_CFG[c.estado] || ESTADO_CFG.valido;
                return (
                  <tr key={`${c.worker_id}-${idx}`} className="border-b border-slate-50">
                    <td className="py-3 pr-4 font-bold text-slate-700">{c.worker_nome}</td>
                    <td className="py-3 pr-4 text-slate-500">{CATEGORIA_LABEL[c.categoria] || c.categoria}</td>
                    <td className="py-3 pr-4 text-slate-600">{c.tipo_formacao}</td>
                    <td className="py-3 pr-4 text-slate-400">{c.data_obtencao ? new Date(c.data_obtencao).toLocaleDateString('pt-PT') : '—'}</td>
                    <td className="py-3 pr-4 text-slate-600 font-bold">{new Date(c.data_validade).toLocaleDateString('pt-PT')}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
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
