import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Link2, Loader2 } from 'lucide-react';
import { formatCurrency, parseFaturaValor } from './costReportsUtils';
import { toISODateLocal } from '../../../utils/dateUtils';
import LinkFaturaModal from './LinkFaturaModal';
import '../reconciliacao/reconciliacao-mockup.css';
import { FT, SCALE } from '../../../styles/designTokens';
import { PAYMENT_STATUS } from './pagamentoStatusUtils';

function TypeBadge({ tipo }) {
  if (tipo === 'cliente') return <span className={`px-2 py-0.5 rounded-lg ${SCALE.text.badge} bg-emerald-100 text-emerald-700`}>Cliente</span>;
  if (tipo === 'fornecedor') return <span className={`px-2 py-0.5 rounded-lg ${SCALE.text.badge} bg-rose-100 text-rose-700`}>Fornecedor</span>;
  return <span className={`px-2 py-0.5 rounded-lg ${SCALE.text.badge} bg-[var(--surface-dim)] text-[var(--ink-soft)]`}>Sem tipo</span>;
}

export default function FaturasTab({ supabase }) {
  const [clienteFaturas, setClienteFaturas] = useState([]);
  const [fatLinks, setFatLinks] = useState([]);
  const [isAddingFatura, setIsAddingFatura] = useState(false);
  const [faturaForm, setFaturaForm] = useState({ cliente: '', numero: '', valor: '', data: toISODateLocal(new Date()) });
  const [faturaSaving, setFaturaSaving] = useState(false);
  const [runsLista, setRunsLista] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [linkFaturaModal, setLinkFaturaModal] = useState(null);
  const [selectedRunFatura, setSelectedRunFatura] = useState(null);
  const [runFaturaLoading, setRunFaturaLoading] = useState(false);
  const [linkFaturaSaving, setLinkFaturaSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from('faturas').select('id, dados, status, importado_em').eq('tipo', 'cliente').order('importado_em', { ascending: false }),
      supabase.from('fatura_pagamento_links').select('fatura_id, run_id, tx_key, auto_matched'),
    ]).then(([{ data: fats }, { data: links }]) => {
      setClienteFaturas(fats || []);
      setFatLinks(links || []);
    });
  }, [supabase]);

  const recarregarFaturas = async () => {
    const [{ data: fats }, { data: links }] = await Promise.all([
      supabase.from('faturas').select('id,dados,status,importado_em').eq('tipo', 'cliente').order('importado_em', { ascending: false }),
      supabase.from('fatura_pagamento_links').select('fatura_id,run_id,tx_key,auto_matched'),
    ]);
    setClienteFaturas(fats || []);
    setFatLinks(links || []);
  };

  const abrirLinkFaturaModal = async (fatura) => {
    setLinkFaturaModal(fatura);
    setSelectedRunFatura(null);
    setRunsLoading(true);
    const { data } = await supabase.from('reconciliation_runs')
      .select('id, filename, created_at, transaction_count')
      .order('created_at', { ascending: false }).limit(30);
    setRunsLista(data || []);
    setRunsLoading(false);
  };

  const selecionarRunFatura = async (runId) => {
    if (!runId) { setSelectedRunFatura(null); return; }
    setRunFaturaLoading(true);
    const { data } = await supabase.from('reconciliation_runs').select('id, filename, results_json').eq('id', runId).single();
    setSelectedRunFatura(data);
    setRunFaturaLoading(false);
  };

  const creditosDisponiveisFatura = useMemo(() => {
    if (!selectedRunFatura?.results_json) return [];
    const usedKeys = new Set(fatLinks.map(fl => fl.tx_key));
    const result = [];
    for (const { key, items } of [
      { key: 'matched', items: selectedRunFatura.results_json.matched || [] },
      { key: 'orphan_bank', items: selectedRunFatura.results_json.orphan_bank || [] },
    ]) {
      items.forEach((item, idx) => {
        const tx = item.transacao ?? item;
        if (tx?.tipo === 'credito' && !usedKeys.has(`${tx.data}|${tx.descricao}|${tx.valor}`))
          result.push({ section: key, index: idx, tx });
      });
    }
    return result;
  }, [selectedRunFatura, fatLinks]);

  const associarPagamentoFatura = async (section, index, tx) => {
    if (!linkFaturaModal || !selectedRunFatura) return;
    setLinkFaturaSaving(true);
    const key = `${tx.data}|${tx.descricao}|${tx.valor}`;
    await supabase.from('fatura_pagamento_links').upsert(
      { fatura_id: linkFaturaModal.id, run_id: selectedRunFatura.id, tx_key: key, auto_matched: false },
      { onConflict: 'fatura_id' }
    );
    await supabase.from('faturas').update({ status: 'PAGO' }).eq('id', linkFaturaModal.id);
    await recarregarFaturas();
    setLinkFaturaSaving(false);
    setLinkFaturaModal(null);
  };

  const removerPagamentoFatura = async (faturaId) => {
    await supabase.from('fatura_pagamento_links').delete().eq('fatura_id', faturaId);
    await supabase.from('faturas').update({ status: 'PENDENTE' }).eq('id', faturaId);
    await recarregarFaturas();
  };

  const handleSaveFatura = async () => {
    if (!faturaForm.cliente || !faturaForm.numero || !faturaForm.valor) return alert('Cliente, número e valor são obrigatórios');
    setFaturaSaving(true);
    const valorNum = parseFloat(faturaForm.valor.replace(/\./g, '').replace(',', '.')) || 0;
    await supabase.from('faturas').insert({
      gmail_message_id: `manual_${Date.now()}`, filename: `fatura_cliente_${Date.now()}.pdf`,
      storage_path: '', url: '', mime_type: 'application/pdf', tamanho: 0,
      importado_em: new Date().toISOString(), tipo: 'cliente',
      dados: { fornecedor: faturaForm.cliente, numero_fatura: faturaForm.numero, valor_total: valorNum, data_fatura: faturaForm.data },
      status: 'PENDENTE', fonte: 'manual', valor: valorNum, data_documento: faturaForm.data,
      descricao: `Fatura cliente: ${faturaForm.cliente}`, entidade: faturaForm.cliente,
    });
    setFaturaForm({ cliente: '', numero: '', valor: '', data: toISODateLocal(new Date()) });
    setIsAddingFatura(false);
    setFaturaSaving(false);
    const { data } = await supabase.from('faturas').select('id, dados, status, importado_em').eq('tipo', 'cliente').order('importado_em', { ascending: false });
    setClienteFaturas(data || []);
  };

  const nPendentes = clienteFaturas.filter(f => f.status === 'PENDENTE').length;
  const nPagas = clienteFaturas.filter(f => f.status === 'PAGO').length;
  const totalFaturado = clienteFaturas.reduce((s, f) => s + parseFaturaValor({ dados: { valor_total: f.dados?.valor_total } }), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black text-[var(--ink-mid)] uppercase tracking-tight">Faturas de Clientes</h3>
        <button onClick={() => setIsAddingFatura(true)} className={`flex items-center gap-1.5 px-4 py-2 text-[var(--navy)] rounded-xl shadow-sm transition-colors ${SCALE.text.badge}`} style={{ backgroundColor: FT.orange }}>
          <Plus size={12} /> Inserir Fatura
        </button>
      </div>

      <div className="recon-scope">
        <div className="recon-stat-strip mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="recon-stat">
            <p className="recon-stat-label">Total Faturado</p>
            <p className="recon-stat-value" style={{ color: 'var(--navy)' }}>{formatCurrency(totalFaturado)}</p>
          </div>
          <div className="recon-stat">
            <p className="recon-stat-label">Pendentes</p>
            <p className="recon-stat-value" style={{ color: nPendentes > 0 ? 'var(--red)' : 'var(--navy)' }}>{nPendentes}</p>
          </div>
          <div className="recon-stat">
            <p className="recon-stat-label">Pagas</p>
            <p className="recon-stat-value" style={{ color: 'var(--green)' }}>{nPagas}</p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2.5 bg-white border border-[var(--border)] rounded-2xl px-4 py-3 mb-5 text-xs text-[var(--slate-dim)]" style={{ borderLeftWidth: '3px', borderLeftColor: FT.slate }}>
        <span className="shrink-0">🧾</span>
        <p>Faturas emitidas a <strong className="text-[var(--ink-mid)] font-black">clientes</strong> — ligação a movimentos bancários para confirmar pagamento. Despesas de fornecedor ficam na aba <strong className="text-[var(--ink-mid)] font-black">Despesas</strong>.</p>
      </div>

      {isAddingFatura && (
        <div className="mb-6 bg-[var(--surface)] p-4 sm:p-6 rounded-2xl border border-[var(--border)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-1`}>Cliente</label>
              <input type="text" value={faturaForm.cliente} onChange={e => setFaturaForm({ ...faturaForm, cliente: e.target.value })} className="w-full bg-white border border-[var(--border)] rounded-xl p-3 text-sm font-bold outline-none shadow-sm" placeholder="Nome do cliente..." />
            </div>
            <div className="space-y-1">
              <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-1`}>Número Fatura</label>
              <input type="text" value={faturaForm.numero} onChange={e => setFaturaForm({ ...faturaForm, numero: e.target.value })} className="w-full bg-white border border-[var(--border)] rounded-xl p-3 text-sm font-bold outline-none shadow-sm" placeholder="FT 2026/001..." />
            </div>
            <div className="space-y-1">
              <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-1`}>Valor (€)</label>
              <input type="text" value={faturaForm.valor} onChange={e => setFaturaForm({ ...faturaForm, valor: e.target.value })} className="w-full bg-white border border-[var(--border)] rounded-xl p-3 text-sm font-bold text-[var(--navy)] outline-none shadow-sm" placeholder="0,00" />
            </div>
            <div className="space-y-1">
              <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] ml-1`}>Data</label>
              <input type="date" value={faturaForm.data} onChange={e => setFaturaForm({ ...faturaForm, data: e.target.value })} className="w-full bg-white border border-[var(--border)] rounded-xl p-3 text-sm shadow-sm" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={handleSaveFatura} disabled={faturaSaving} className="flex-1 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-lg transition-colors disabled:opacity-50" style={{ backgroundColor: FT.navy }}>
              {faturaSaving ? <><Loader2 size={14} className="animate-spin inline" /> A guardar...</> : 'Guardar Fatura'}
            </button>
            <button onClick={() => { setIsAddingFatura(false); setFaturaForm({ cliente: '', numero: '', valor: '', data: toISODateLocal(new Date()) }); }} className="px-6 py-4 bg-[var(--surface-dim)] text-[var(--ink-soft)] rounded-2xl font-black text-xs uppercase shadow-sm hover:bg-[var(--border)] transition-colors">Cancelar</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-[var(--slate-dim)]">
              <th className={`px-4 py-2 ${SCALE.text.statLabel}`}>Cliente</th>
              <th className={`px-4 py-2 ${SCALE.text.statLabel}`}>Tipo</th>
              <th className={`px-4 py-2 ${SCALE.text.statLabel}`}>Número</th>
              <th className={`px-4 py-2 ${SCALE.text.statLabel}`}>Valor</th>
              <th className={`px-4 py-2 ${SCALE.text.statLabel}`}>Data</th>
              <th className={`px-4 py-2 ${SCALE.text.statLabel}`}>Estado</th>
              <th className={`px-4 py-2 ${SCALE.text.statLabel} text-right`}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clienteFaturas.length === 0 ? (
              <tr><td colSpan="7" className="py-16 text-center text-[var(--slate-dim)] text-sm font-medium">Nenhuma fatura de cliente inserida.</td></tr>
            ) : clienteFaturas.map(f => {
              const dados = f.dados || {};
              const valor = parseFaturaValor({ dados: { valor_total: dados.valor_total } });
              return (
                <tr key={f.id} className="bg-white hover:shadow-md transition-all duration-300 border border-[var(--border-soft)]">
                  <td className="px-4 py-3 rounded-l-2xl text-sm font-black text-[var(--ink)]">{dados.fornecedor || '—'}</td>
                  <td className="px-4 py-3"><TypeBadge tipo="cliente" /></td>
                  <td className="px-4 py-3 text-sm font-bold text-[var(--ink-soft)]">{dados.numero_fatura || '—'}</td>
                  <td className="px-4 py-3 text-sm font-black text-[var(--navy)]">{formatCurrency(valor)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-[var(--slate-dim)]">{dados.data_fatura ? new Date(dados.data_fatura).toLocaleDateString('pt-PT') : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full ${SCALE.text.badge} ${PAYMENT_STATUS[f.status]?.cls || PAYMENT_STATUS.PENDENTE.cls}`}>{f.status}</span>
                  </td>
                  <td className="px-4 py-3 rounded-r-2xl text-right">
                    {(() => {
                      const fl = fatLinks.find(l => l.fatura_id === f.id);
                      if (fl) {
                        return (
                          <div className="flex items-center justify-end gap-2">
                            <span className={`${SCALE.text.meta} text-[var(--slate-dim)] truncate max-w-[120px]`} title={fl.tx_key}>
                              {fl.tx_key?.split('|')[0]} · {fl.tx_key?.split('|')[2]} €
                            </span>
                            <button onClick={() => removerPagamentoFatura(f.id)} className={`text-rose-400 hover:text-rose-600 hover:underline ${SCALE.text.badge}`}>Desligar</button>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => abrirLinkFaturaModal(f)} className={`flex items-center gap-1 px-2 py-1 bg-[var(--surface)] hover:bg-[var(--surface-dim)] rounded-lg transition-colors ${SCALE.text.badge}`} style={{ color: FT.slateDim }}>
                            <Link2 size={10} /> Ligar
                          </button>
                          {f.status === 'PENDENTE' && (
                            <button onClick={async () => {
                              await supabase.from('faturas').update({ status: 'PAGO' }).eq('id', f.id);
                              await recarregarFaturas();
                            }} className={`text-emerald-600 hover:text-emerald-800 hover:underline ${SCALE.text.badge}`}>PAGO</button>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {linkFaturaModal && (
        <LinkFaturaModal
          fatura={linkFaturaModal}
          runsLista={runsLista}
          runsLoading={runsLoading}
          selectedRun={selectedRunFatura}
          runLoading={runFaturaLoading}
          creditosDisponiveisFatura={creditosDisponiveisFatura}
          fatLink={fatLinks.find(l => l.fatura_id === linkFaturaModal.id) || null}
          linkSaving={linkFaturaSaving}
          onClose={() => setLinkFaturaModal(null)}
          selecionarRun={selecionarRunFatura}
          associarPagamentoFatura={associarPagamentoFatura}
          removerPagamentoFatura={removerPagamentoFatura}
        />
      )}
    </div>
  );
}
