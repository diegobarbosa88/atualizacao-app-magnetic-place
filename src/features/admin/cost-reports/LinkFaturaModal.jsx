import React from 'react';
import { X, Loader2, Plus, Link2 } from 'lucide-react';
import { formatCurrency } from './costReportsUtils';
import ModalShell from '../../../components/common/ModalShell';
import { FT } from '../../../styles/designTokens';

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
    <ModalShell
      isOpen
      onClose={onClose}
      title="Ligar Pagamento"
      meta={`${numero} · ${cliente} · ${formatCurrency(valor)}`}
      size="lg"
    >
      <div className="p-6 sm:p-8 space-y-5">
        {fatLink && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Movimento Associado</p>
            <div className="flex items-center justify-between bg-emerald-50 rounded-2xl px-4 py-3">
              <div>
                <p className="text-sm font-bold text-emerald-800">{formatCurrency(Number(fatLink.tx_key?.split('|')[2] || 0))}</p>
                <p className="text-[10px] text-[var(--slate-dim)]">
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
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Adicionar pagamento de extrato</p>
            {runsLoading ? (
              <div className="flex items-center gap-2 text-[var(--slate-dim)] text-sm">
                <Loader2 size={14} className="animate-spin" /> A carregar extratos...
              </div>
            ) : (
              <select
                value={selectedRun?.id || ''}
                onChange={e => selecionarRun(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
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
          <div className="flex items-center gap-2 text-[var(--slate-dim)] text-sm">
            <Loader2 size={14} className="animate-spin" /> A carregar movimentos...
          </div>
        )}

        {!fatLink && selectedRun && !runLoading && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">
              Entradas disponíveis ({creditosDisponiveisFatura.length})
            </p>
            {creditosDisponiveisFatura.length === 0 && (
              <p className="text-xs text-[var(--slate-dim)] italic">Sem créditos disponíveis neste extrato.</p>
            )}
            {creditosDisponiveisFatura.map(({ section, index, tx }) => (
              <button
                key={`${section}_${index}`}
                onClick={() => associarPagamentoFatura(section, index, tx)}
                disabled={linkSaving}
                className="w-full flex items-center justify-between bg-[var(--surface)] hover:bg-[var(--surface-dim)] border border-[var(--border-soft)] hover:border-[var(--slate)] rounded-2xl px-4 py-3 transition-all text-left disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-bold text-[var(--ink)]">{formatCurrency(Number(tx.valor))}</p>
                  <p className="text-[10px] text-[var(--slate-dim)]">{tx.data} · {(tx.descricao || '').slice(0, 55)}</p>
                </div>
                {linkSaving
                  ? <Loader2 size={13} className="animate-spin" style={{ color: 'var(--navy)' }} />
                  : <Plus size={14} style={{ color: FT.slate }} />
                }
              </button>
            ))}
          </div>
        )}

        {fatLink && (
          <p className="text-[10px] text-[var(--slate-dim)] text-center">
            Para substituir o movimento, primeiro remova o atual.
          </p>
        )}
      </div>
    </ModalShell>
  );
};

export default LinkFaturaModal;
