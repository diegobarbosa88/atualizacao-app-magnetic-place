import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link2 } from 'lucide-react';
import { formatCurrency } from './costReportsUtils';
import LinkPagamentoModal from './LinkPagamentoModal';
import '../reconciliacao/reconciliacao-mockup.css';
import { FT, SCALE } from '../../../styles/designTokens';
import { PAYMENT_STATUS } from './pagamentoStatusUtils';

export default function ClientesTab({ clientCosts, supabase, selectedMonth }) {
  const [pagamentos, setPagamentos] = useState([]);
  const [linkModal, setLinkModal] = useState(null);
  const [runsLista, setRunsLista] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runLoading, setRunLoading] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);

  const carregarPagamentos = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('faturacao_clientes_pagamentos').select('*').eq('period', selectedMonth);
    setPagamentos(data || []);
  }, [supabase, selectedMonth]);

  useEffect(() => { carregarPagamentos(); }, [carregarPagamentos]);

  const pagamentosDoCliente = (clientId) => pagamentos.filter(p => p.client_id === clientId);
  const totalPagoCli = (clientId) => pagamentosDoCliente(clientId).reduce((s, p) => s + Number(p.valor_pago || 0), 0);
  const estadoPagamento = (clientId, valorFaturado) => {
    const total = totalPagoCli(clientId);
    if (total <= 0) return 'PENDENTE';
    if (total >= valorFaturado - 0.01) return 'PAGO';
    return 'PARCIAL';
  };

  const creditosDisponiveis = useMemo(() => {
    if (!selectedRun?.results_json) return [];
    const jaAssociados = new Set(
      pagamentos.filter(p => p.reconciliation_run_id === selectedRun.id).map(p => `${p.transaction_section}_${p.transaction_index}`)
    );
    const result = [];
    const sections = [
      { key: 'matched', items: selectedRun.results_json.matched || [] },
      { key: 'orphan_bank', items: selectedRun.results_json.orphan_bank || [] },
    ];
    for (const { key, items } of sections) {
      items.forEach((item, idx) => {
        const tx = item.transacao ?? item;
        if (tx?.tipo === 'credito' && !jaAssociados.has(`${key}_${idx}`)) result.push({ section: key, index: idx, tx });
      });
    }
    return result;
  }, [selectedRun, pagamentos]);

  const abrirLinkModal = async (clientId, clientName, valorFaturado) => {
    setLinkModal({ clientId, clientName, valorFaturado });
    setSelectedRun(null);
    setRunsLoading(true);
    const { data } = await supabase.from('reconciliation_runs').select('id, filename, created_at, transaction_count').order('created_at', { ascending: false }).limit(30);
    setRunsLista(data || []);
    setRunsLoading(false);
  };

  const selecionarRun = async (runId) => {
    if (!runId) { setSelectedRun(null); return; }
    setRunLoading(true);
    const { data } = await supabase.from('reconciliation_runs').select('id, filename, results_json').eq('id', runId).single();
    setSelectedRun(data);
    setRunLoading(false);
  };

  const associarPagamento = async (section, index, tx) => {
    if (!linkModal || !selectedRun) return;
    setLinkSaving(true);
    const { data: existente } = await supabase.from('faturacao_clientes_pagamentos').select('id').eq('reconciliation_run_id', selectedRun.id).eq('transaction_section', section).eq('transaction_index', index).maybeSingle();
    if (!existente) {
      await supabase.from('faturacao_clientes_pagamentos').insert({
        client_id: linkModal.clientId, period: selectedMonth, valor_faturado: linkModal.valorFaturado,
        reconciliation_run_id: selectedRun.id, transaction_section: section, transaction_index: index,
        transaction_data: tx, valor_pago: Number(tx.valor),
      });
    }
    await carregarPagamentos();
    setLinkSaving(false);
  };

  const removerPagamento = async (pagId) => {
    await supabase.from('faturacao_clientes_pagamentos').delete().eq('id', pagId);
    await carregarPagamentos();
  };

  const totalFaturado = clientCosts.reduce((s, i) => s + i.cost, 0);
  const ticketMedio = clientCosts.length ? totalFaturado / clientCosts.length : 0;

  return (
    <>
      <div className="recon-scope">
        <div className="recon-stat-strip mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="recon-stat">
            <p className="recon-stat-label">Faturado</p>
            <p className="recon-stat-value" style={{ color: 'var(--navy)' }}>{formatCurrency(totalFaturado)}</p>
          </div>
          <div className="recon-stat">
            <p className="recon-stat-label">Clientes Ativos</p>
            <p className="recon-stat-value" style={{ color: 'var(--navy)' }}>{clientCosts.length}</p>
          </div>
          <div className="recon-stat">
            <p className="recon-stat-label">Ticket Médio</p>
            <p className="recon-stat-value" style={{ color: 'var(--navy)' }}>{formatCurrency(ticketMedio)}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-[var(--slate-dim)]">
              <th className={`px-4 py-2 ${SCALE.text.statLabel}`}>Nome</th>
              <th className={`px-4 py-2 ${SCALE.text.statLabel}`}>Total Horas</th>
              <th className={`px-4 py-2 ${SCALE.text.statLabel}`}>Faturação (€)</th>
              <th className={`px-4 py-2 ${SCALE.text.statLabel}`}>Pago Banco</th>
              <th className={`px-4 py-2 ${SCALE.text.statLabel}`}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {clientCosts.length === 0 ? (
              <tr><td colSpan="5" className="py-16 text-center text-[var(--slate-dim)] text-sm font-medium">Sem dados para o período selecionado.</td></tr>
            ) : clientCosts.map((item) => {
              const estado = estadoPagamento(item.id, item.cost);
              const totalPago = totalPagoCli(item.id);
              return (
                <tr key={item.id} className="bg-[var(--surface)] hover:bg-white hover:shadow-md transition-all duration-300">
                  <td className="px-4 py-3 rounded-l-2xl border-y border-l border-[var(--border-soft)] text-sm font-black text-[var(--ink)]">{item.name}</td>
                  <td className="px-4 py-3 border-y border-[var(--border-soft)] text-sm font-bold text-[var(--ink-soft)]">{item.totalHours.toFixed(1)}h</td>
                  <td className="px-4 py-3 border-y border-[var(--border-soft)] text-sm font-black text-[var(--navy)]">{formatCurrency(item.cost)}</td>
                  <td className="px-4 py-3 border-y border-[var(--border-soft)] text-sm font-bold text-emerald-700">
                    {totalPago > 0 ? formatCurrency(totalPago) : <span className="text-[var(--slate)]">—</span>}
                  </td>
                  <td className="px-4 py-3 rounded-r-2xl border-y border-r border-[var(--border-soft)]">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full ${SCALE.text.badge} ${PAYMENT_STATUS[estado].cls}`}>{estado}</span>
                      <button onClick={() => abrirLinkModal(item.id, item.name, item.cost)} className="p-1 rounded-lg hover:bg-[var(--surface)] transition-all" style={{ color: FT.slateDim }} title="Associar pagamento bancário">
                        <Link2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {clientCosts.length > 0 && (
              <tr className="bg-[var(--surface-dim)]">
                <td className={`px-4 py-3 rounded-l-2xl ${SCALE.text.statLabel} text-[var(--ink-soft)]`}>Total</td>
                <td className="px-4 py-3 text-sm font-black text-[var(--ink-mid)]">{clientCosts.reduce((a, i) => a + i.totalHours, 0).toFixed(1)}h</td>
                <td className="px-4 py-3 text-sm font-black text-[var(--navy)]">{formatCurrency(clientCosts.reduce((a, i) => a + i.cost, 0))}</td>
                <td className="px-4 py-3 text-sm font-black text-emerald-700">{formatCurrency(pagamentos.reduce((s, p) => s + Number(p.valor_pago || 0), 0))}</td>
                <td className="px-4 py-3 rounded-r-2xl"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {linkModal && (
        <LinkPagamentoModal
          linkModal={linkModal}
          selectedMonth={selectedMonth}
          pagamentos={pagamentos}
          runsLista={runsLista}
          runsLoading={runsLoading}
          selectedRun={selectedRun}
          runLoading={runLoading}
          creditosDisponiveis={creditosDisponiveis}
          linkSaving={linkSaving}
          setLinkModal={setLinkModal}
          selecionarRun={selecionarRun}
          associarPagamento={associarPagamento}
          removerPagamento={removerPagamento}
        />
      )}
    </>
  );
}
