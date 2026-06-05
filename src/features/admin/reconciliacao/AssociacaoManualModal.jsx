import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function AssociacaoManualModal({ tx, txValor, faturas, loading, onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [saveAlias, setSaveAlias] = useState(false);

  const filtradas = (() => {
    const q = search.toLowerCase();
    if (!q) return faturas;
    return faturas.filter(f => {
      const v = String(f.valor ?? f.dados?.valor_total ?? '');
      const ent = (f.entidade || f.dados?.fornecedor || '').toLowerCase();
      const desc = (f.descricao || f.dados?.numero_fatura || f.filename || '').toLowerCase();
      return ent.includes(q) || desc.includes(q) || v.includes(q);
    });
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Associar a Fatura</h3>
          <p className="text-sm text-slate-700 mt-1 font-semibold">
            €{Number(txValor).toFixed(2)} · {tx.data}
          </p>
          <p className="text-xs text-slate-500 truncate">{tx.descricao}</p>
        </div>

        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrar por entidade, descrição ou valor..."
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />

        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {loading && (
            <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-indigo-400" /></div>
          )}
          {!loading && filtradas.length === 0 && (
            <p className="text-center text-slate-400 py-6 text-sm">Nenhuma fatura encontrada.</p>
          )}
          {!loading && filtradas.map(f => {
            const valorF = f.valor ?? f.dados?.valor_total;
            const diff = Math.abs((valorF ?? 0) - txValor);
            const isClose = diff <= 0.01;
            return (
              <button
                key={f.id}
                onClick={() => onSelect(f, saveAlias)}
                className={`w-full text-left p-3 rounded-xl border transition-all hover:border-indigo-400 hover:bg-indigo-50 ${isClose ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">
                      {f.entidade || f.dados?.fornecedor || f.filename || '—'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {f.descricao || f.dados?.numero_fatura || f.dados?.fornecedor || '—'}
                    </p>
                    {f.data_documento && <p className="text-[10px] text-slate-400">{f.data_documento}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${isClose ? 'text-emerald-700' : 'text-slate-700'}`}>
                      €{Number(valorF ?? 0).toFixed(2)}
                    </p>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{f.status || 'PENDENTE'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none px-1 pb-1">
          <input type="checkbox" checked={saveAlias} onChange={e => setSaveAlias(e.target.checked)}
            className="accent-indigo-600 w-4 h-4" />
          <span className="text-xs text-slate-600">Guardar como alias (próximos matches automáticos)</span>
        </label>

        <button
          onClick={onClose}
          className="w-full py-2 text-slate-500 hover:text-slate-700 text-[10px] font-black uppercase tracking-widest"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
