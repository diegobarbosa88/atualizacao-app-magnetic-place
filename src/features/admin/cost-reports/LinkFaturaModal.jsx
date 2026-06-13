import React from 'react';
import { X, Loader2, Plus, Link2 } from 'lucide-react';
import { formatCurrency } from './costReportsUtils';

const LinkFaturaModal = ({
  fatura,
  runsLista,
  runsLoading,
  selectedRun,
  runLoading,
  creditosDisponiveisFatura,
  fatLink,
  linkSaving,
  onClose,
  selecionarRun,
  associarPagamentoFatura,
  removerPagamentoFatura,
}) => {
  const dados = fatura?.dados || {};
  const valor = parseFloat(dados.valor_total || fatura?.valor || 0);
  const cliente = dados.fornecedor || fatura?.entidade || '—';
  const numero = dados.numero_fatura || '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-800 text-base uppercase tracking-tight">Ligar Pagamento</h3>
            <p className="text-xs text-slate-400 mt-0.5">{numero} · {cliente} · {formatCurrency(valor)}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all">
            <X size={16} />
          </button>
        </div>

        {fatLink && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Movimento Associado</p>
            <div className="flex items-center justify-between bg-emerald-50 rounded-2xl px-4 py-3">
              <div>
                <p className="text-sm font-bold text-emerald-800">{formatCurrency(Number(fatLink.tx_key?.split('|')[2] || 0))}</p>
                <p className="text-[10px] text-slate-500">
                  {fatLink.tx_key?.split('|')[0]} · {(fatLink.tx_key?.split('|')[1] || '').slice(0, 50)}
                </p>
                {fatLink.auto_matched && (
                  <span className="text-[9px] text-indigo-400 font-black uppercase">Auto-match</span>
                )}
              </div>
              <button
                onClick={() => removerPagamentoFatura(fatura.id)}
                className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {!fatLink && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adicionar pagamento de extrato</p>
            {runsLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 size={14} className="animate-spin" /> A carregar extratos...
              </div>
            ) : (
              <select
                value={selectedRun?.id || ''}
                onChange={e => selecionarRun(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
              >
                <option value="">Selecionar extrato bancário...</option>
                {runsLista.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.filename} · {new Date(r.created_at).toLocaleDateString('pt-PT')}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {!fatLink && runLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 size={14} className="animate-spin" /> A carregar movimentos...
          </div>
        )}

        {!fatLink && selectedRun && !runLoading && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Entradas disponíveis ({creditosDisponiveisFatura.length})
            </p>
            {creditosDisponiveisFatura.length === 0 && (
              <p className="text-xs text-slate-400 italic">Sem créditos disponíveis neste extrato.</p>
            )}
            {creditosDisponiveisFatura.map(({ section, index, tx }) => (
              <button
                key={`${section}_${index}`}
                onClick={() => associarPagamentoFatura(section, index, tx)}
                disabled={linkSaving}
                className="w-full flex items-center justify-between bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-2xl px-4 py-3 transition-all text-left disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">{formatCurrency(Number(tx.valor))}</p>
                  <p className="text-[10px] text-slate-500">{tx.data} · {(tx.descricao || '').slice(0, 55)}</p>
                </div>
                {linkSaving
                  ? <Loader2 size={13} className="animate-spin text-indigo-500" />
                  : <Plus size={14} className="text-indigo-400" />
                }
              </button>
            ))}
          </div>
        )}

        {fatLink && (
          <p className="text-[10px] text-slate-400 text-center">
            Para substituir o movimento, primeiro remova o atual.
          </p>
        )}
      </div>
    </div>
  );
};

export default LinkFaturaModal;
