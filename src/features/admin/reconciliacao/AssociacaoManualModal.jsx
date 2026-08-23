import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';

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
    <ModalShell
      isOpen
      onClose={onClose}
      busy={loading}
      title="Associar a Fatura"
      meta={`€${Number(txValor).toFixed(2)} · ${tx.data}`}
      size="lg"
      accent="brand"
      closeOnOverlay={false}
      footer={
        <div className="px-6 py-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none px-1">
            <input type="checkbox" checked={saveAlias} onChange={e => setSaveAlias(e.target.checked)}
              className="accent-indigo-600 w-4 h-4" />
            <span className="text-xs text-[var(--ink-soft)]">Guardar como alias (próximos matches automáticos)</span>
          </label>

          <button
            onClick={onClose}
            className="w-full py-2 text-[var(--slate-dim)] hover:text-[var(--ink-mid)] text-[10px] font-black uppercase tracking-widest"
          >
            Cancelar
          </button>
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <p className="text-xs text-[var(--slate-dim)] truncate">{tx.descricao}</p>

        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrar por entidade, descrição ou valor..."
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />

        <div className="space-y-2">
          {loading && (
            <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-indigo-400" /></div>
          )}
          {!loading && filtradas.length === 0 && (
            <p className="text-center text-[var(--slate-dim)] py-6 text-sm">Nenhuma fatura encontrada.</p>
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
                    <p className="text-sm font-semibold text-[var(--ink-mid)] truncate">
                      {f.entidade || f.dados?.fornecedor || f.filename || '—'}
                    </p>
                    <p className="text-xs text-[var(--slate-dim)] truncate">
                      {f.descricao || f.dados?.numero_fatura || f.dados?.fornecedor || '—'}
                    </p>
                    {f.data_documento && <p className="text-[10px] text-[var(--slate-dim)]">{f.data_documento}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${isClose ? 'text-emerald-700' : 'text-[var(--ink-mid)]'}`}>
                      €{Number(valorF ?? 0).toFixed(2)}
                    </p>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--slate-dim)]">{f.status || 'PENDENTE'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
}
