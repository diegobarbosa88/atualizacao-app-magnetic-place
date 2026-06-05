import React from 'react';
import {
  CheckCircle, X, Loader2, ArrowLeftRight, Tag, Download, Unlink, Pencil, Link2, Trash2
} from 'lucide-react';
import TagBadge from '../TagBadge';
import TipoBadge from '../TipoBadge';

export default function ResultadosTabs({
  displayData, runSelecionado, setRunSelecionado,
  activeSubTab, setActiveSubTab,
  selMatched, setSelMatched,
  selOrphan, setSelOrphan,
  bulkConfirmando, confirmando, confirmedOrphans, orphanObservacoes, orphanClassificacoes,
  confirmandoEntrada, desvinculando, excluindo,
  editingResultDesc, setEditingResultDesc,
  pagamentosLinks, clientAssocMatched, orphanBankAssocSet,
  autoAssociando, setAutoAssociando,
  aliases, showAliases, setShowAliases,
  showRelatorio, setShowRelatorio, relatorioRuns, setRelatorioRuns,
  clients, supabase,
  txLinkInfo,
  autoAssociarEntradas, carregarPagamentosLinks,
  confirmarPagamento, confirmarBulkMatched,
  pedirObservacaoOrphan,
  abrirAssociarFatura, abrirAssociarCliente, removerAssociacaoCliente,
  confirmarEntrada, desvincularMatch, excluirItem, saveResultDescricao,
}) {
  if (!displayData) return null;

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-4 sm:p-8">
      {runSelecionado && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <button onClick={() => setRunSelecionado(null)}
            className="text-indigo-600 hover:underline text-[10px] font-black uppercase tracking-widest flex-shrink-0">
            ← Voltar ao run actual
          </button>
          <span className="text-xs text-slate-500 truncate">· {runSelecionado.filename} ({new Date(runSelecionado.created_at).toLocaleDateString('pt-PT')})</span>
        </div>
      )}

      {/* Sub-tab buttons + actions */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
          {[
            { key: 'matched',       labelFull: 'Reconciliados', labelShort: 'Recon.',  count: (displayData.matched?.length ?? 0) + clientAssocMatched.length },
            { key: 'orphan_bank',   labelFull: 'Órfãos Banco',  labelShort: 'Banco',   count: Math.max(0, (displayData.orphan_bank?.length ?? 0) - orphanBankAssocSet.size) },
            { key: 'orphan_system', labelFull: 'Órfãos Sistema', labelShort: 'Sistema', count: displayData.orphan_system?.length ?? 0 },
          ].map(tab => (
            <button key={tab.key} onClick={() => { setActiveSubTab(tab.key); setSelMatched(new Set()); setSelOrphan(new Set()); }}
              className={`flex-1 px-2 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${
                activeSubTab === tab.key ? 'bg-white shadow-md' : 'text-slate-400 hover:text-slate-600'
              }`}>
              <span className="hidden sm:inline">{tab.labelFull}</span>
              <span className="sm:hidden">{tab.labelShort}</span>
              {tab.count !== null && ` (${tab.count})`}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={async () => {
              const runId = runSelecionado?.id ?? displayData?.run_id;
              const rj = runSelecionado?.results_json ?? { matched: displayData?.matched || [], orphan_bank: displayData?.orphan_bank || [] };
              if (!runId) return;
              setAutoAssociando(true);
              const n = await autoAssociarEntradas(rj, runId);
              await carregarPagamentosLinks(runId);
              setAutoAssociando(false);
              if (n > 0) alert(`${n} entrada${n > 1 ? 's' : ''} associada${n > 1 ? 's' : ''} automaticamente.`);
              else alert('Nenhuma nova entrada com cliente identificável.');
            }}
            disabled={autoAssociando}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0 disabled:opacity-50"
            title="Associar automaticamente entradas bancárias a clientes"
          >
            {autoAssociando ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} Auto
          </button>
          <button onClick={() => setShowAliases(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-violet-100 text-slate-500 hover:text-violet-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0">
            <Tag size={13} /> Aliases {aliases.length > 0 && `(${aliases.length})`}
          </button>
          <button onClick={() => setShowRelatorio(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0">
            <Download size={13} /> Relatório
          </button>
        </div>
      </div>

      {/* Sub-tab: Reconciliados */}
      {activeSubTab === 'matched' && (() => {
        const items = [...(displayData.matched || []), ...clientAssocMatched];
        const faturaIdCount = items.reduce((acc, m) => { if (m.fatura?.id) acc[m.fatura.id] = (acc[m.fatura.id] || 0) + 1; return acc; }, {});
        const allPendentes = items.filter(m =>
          m.rule === 'client_association'
            ? !m.confirmed_entrada
            : m.fatura?.id && m.fatura?.status !== 'PAGO' && m.rule !== 'confirmed_manual'
        );
        return (
          <div className="space-y-3">
            {items.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Nenhuma transação reconciliada.</p>}
            {items.length > 0 && (
              <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer select-none">
                  <input type="checkbox"
                    checked={allPendentes.length > 0 && selMatched.size === allPendentes.length}
                    onChange={e => setSelMatched(e.target.checked ? new Set(items.map((_, i) => i).filter(i => {
                      const m = items[i];
                      return m.rule === 'client_association'
                        ? !m.confirmed_entrada
                        : m.fatura?.id && m.fatura?.status !== 'PAGO' && m.rule !== 'confirmed_manual';
                    })) : new Set())}
                    className="accent-emerald-600 w-4 h-4" />
                  Seleccionar todos
                </label>
                {selMatched.size > 0 && (
                  <button onClick={confirmarBulkMatched} disabled={bulkConfirmando}
                    className="flex items-center gap-1 bg-emerald-600 text-white rounded-xl px-4 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50">
                    {bulkConfirmando ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                    Confirmar Selecionados ({selMatched.size})
                  </button>
                )}
              </div>
            )}
            {items.map((item, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 bg-emerald-50 rounded-2xl p-3 sm:p-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {(item.rule === 'client_association'
                    ? !item.confirmed_entrada
                    : item.fatura?.status !== 'PAGO' && item.rule !== 'confirmed_manual'
                  ) && (
                    <input type="checkbox" checked={selMatched.has(i)}
                      onChange={e => setSelMatched(prev => { const s = new Set(prev); e.target.checked ? s.add(i) : s.delete(i); return s; })}
                      className="accent-emerald-600 w-4 h-4 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TipoBadge tipo={item.transacao?.tipo} />
                      <span className="text-sm font-bold text-slate-700">€{Number(item.transacao?.valor ?? 0).toFixed(2)}</span>
                      <span className="text-[10px] text-slate-400">{item.transacao?.data}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                        {item.rule === 'client_association' ? 'Banco' : item.fatura?.fonte === 'recibo' ? 'Recibo' : item.fatura?.tipo || 'Fatura'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {item.rule === 'client_association' ? item.client_name : item.fatura?.entidade}
                      </span>
                      {item.rule === 'client_association' && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest">cliente · {item.period}</span>}
                      {item.rule === 'confirmed_manual' && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest">confirmado</span>}
                      {item.rule === 'alias_match' && <span className="text-[9px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full uppercase tracking-widest">alias</span>}
                      {item.rule === 'manual' && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest">manual</span>}
                      {item.rule === 'manual_split' && <span className="text-[9px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full uppercase tracking-widest">split</span>}
                      {item.rule === 'description_match' && <span className="text-[9px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-widest">desc</span>}
                      {item.rule === 'date_proximity' && <span className="text-[9px] bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full uppercase tracking-widest">data</span>}
                      {faturaIdCount[item.fatura?.id] > 1 && item.rule !== 'manual_split' && <span className="text-[9px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full uppercase tracking-widest">2 movimentos</span>}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {editingResultDesc?.section === 'matched' && editingResultDesc?.index === i ? (
                        <input autoFocus
                          className="flex-1 text-xs text-slate-700 font-medium border-b border-indigo-400 bg-transparent outline-none pb-0.5"
                          value={editingResultDesc.value}
                          onChange={e => setEditingResultDesc(prev => ({ ...prev, value: e.target.value }))}
                          onBlur={() => saveResultDescricao('matched', i, editingResultDesc.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveResultDescricao('matched', i, editingResultDesc.value);
                            if (e.key === 'Escape') setEditingResultDesc(null);
                          }}
                        />
                      ) : (
                        <p className="flex-1 text-xs text-slate-600 truncate font-medium">{item.transacao?.descricao}</p>
                      )}
                      <button onClick={() => setEditingResultDesc({ section: 'matched', index: i, value: item.transacao?.descricao || '' })}
                        className={`flex-shrink-0 transition-all ${editingResultDesc?.section === 'matched' && editingResultDesc?.index === i ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-400'}`}
                        title="Editar descrição"><Pencil size={11} /></button>
                    </div>
                    {item.fatura?.descricao && (
                      <p className="text-xs text-slate-500 truncate">{item.fatura.entidade} · {item.fatura.descricao}</p>
                    )}
                    {item.rule === 'confirmed_manual' && (item.observacao || item.classificacao) && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {item.classificacao && <TagBadge nome={item.classificacao.nome} cor={item.classificacao.cor} />}
                        {item.observacao && <span className="italic ml-1">{item.observacao}</span>}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 justify-start sm:justify-end sm:flex-shrink-0">
                  {item.transacao?.tipo === 'credito' && (() => {
                    if (item.rule === 'client_association') {
                      return (
                        <span title={`Associado a ${item.client_name} (${item.period}) — clique para remover`}
                          className="flex items-center gap-1 text-indigo-500 text-[9px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-full cursor-pointer hover:bg-rose-50 hover:text-rose-500"
                          onClick={() => removerAssociacaoCliente(item._orig_section, item._orig_index)}>
                          <Link2 size={10} /> {item.client_name}
                        </span>
                      );
                    }
                    const link = txLinkInfo('matched', i);
                    const clientName = link ? (clients?.find(c => c.id === link.client_id)?.name || link.client_id) : null;
                    return link ? (
                      <span title={`Associado a ${clientName} (${link.period})`}
                        className="flex items-center gap-1 text-indigo-500 text-[9px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-full cursor-pointer hover:bg-rose-50 hover:text-rose-500"
                        onClick={() => removerAssociacaoCliente('matched', i)}>
                        <Link2 size={10} /> {clientName}
                      </span>
                    ) : (
                      <button onClick={() => abrirAssociarCliente('matched', i, item.transacao)}
                        title="Associar a cliente de faturação"
                        className="p-1.5 rounded-xl text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors">
                        <Link2 size={13} />
                      </button>
                    );
                  })()}
                  {item.rule === 'confirmed_manual' ? (
                    <span className="flex items-center gap-1 text-indigo-500 text-[10px] font-black uppercase tracking-widest">
                      <CheckCircle size={14} /> Confirmado
                    </span>
                  ) : item.rule === 'client_association' ? (
                    item.confirmed_entrada ? (
                      <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                        <CheckCircle size={14} /> Confirmado
                      </span>
                    ) : (
                      <button onClick={() => confirmarEntrada(item, i)} disabled={confirmandoEntrada.has(i)}
                        className="flex items-center gap-1 bg-emerald-600 text-white rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50">
                        {confirmandoEntrada.has(i) ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                        Confirmar
                      </button>
                    )
                  ) : item.fatura?.status === 'PAGO' ? (
                    <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                      <CheckCircle size={14} /> Pago
                    </span>
                  ) : (
                    <button onClick={() => confirmarPagamento(item.fatura?.id, item.fatura?.fonte, item.transacao?.data)}
                      disabled={confirmando.has(item.fatura?.id)}
                      className="flex items-center gap-1 bg-emerald-600 text-white rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50">
                      {confirmando.has(item.fatura?.id) ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                      Confirmar
                    </button>
                  )}
                  {item.rule !== 'client_association' && (
                    <button onClick={() => desvincularMatch(item, i)} disabled={desvinculando.has(`${i}`)}
                      title="Desvincular"
                      className="p-1.5 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50">
                      {desvinculando.has(`${i}`) ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
                    </button>
                  )}
                  {item.rule !== 'client_association' && (
                    <button onClick={() => { if (window.confirm('Excluir este movimento dos resultados?')) excluirItem('matched', i); }}
                      disabled={excluindo.has(`matched_${i}`)} title="Excluir movimento"
                      className="p-1.5 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50">
                      {excluindo.has(`matched_${i}`) ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Sub-tab: Órfãos Banco */}
      {activeSubTab === 'orphan_bank' && (() => {
        const allIndices = (displayData.orphan_bank || []).map((_, i) => i).filter(i => !confirmedOrphans.has(i) && !orphanBankAssocSet.has(i));
        return (
          <div className="space-y-3">
            {allIndices.length === 0 && (displayData.orphan_bank || []).filter((_, i) => !orphanBankAssocSet.has(i)).length === 0 && (
              <p className="text-center text-slate-400 py-8 text-sm">Sem transações sem correspondência.</p>
            )}
            {allIndices.length > 0 && (
              <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer select-none">
                  <input type="checkbox"
                    checked={allIndices.length > 0 && selOrphan.size === allIndices.length}
                    onChange={e => setSelOrphan(e.target.checked ? new Set(allIndices) : new Set())}
                    className="accent-indigo-600 w-4 h-4" />
                  Seleccionar todos
                </label>
                {selOrphan.size > 0 && (
                  <button onClick={() => pedirObservacaoOrphan([...selOrphan])}
                    className="flex items-center gap-1 bg-indigo-600 text-white rounded-xl px-4 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                    <CheckCircle size={12} /> Confirmar Selecionados ({selOrphan.size})
                  </button>
                )}
              </div>
            )}
            {(displayData.orphan_bank || []).map((item, i) => {
              if (orphanBankAssocSet.has(i)) return null;
              const isConfirmed = confirmedOrphans.has(i);
              if (isConfirmed) {
                const classif = orphanClassificacoes[i];
                return (
                  <div key={i} className="rounded-2xl p-4 bg-slate-50 border border-slate-100 opacity-70">
                    <div className="flex items-start gap-3">
                      <CheckCircle size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <TipoBadge tipo={item.transacao.tipo} />
                          <span className="text-sm font-bold text-slate-500">€{Number(item.transacao.valor).toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400">{item.transacao.data}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Confirmado</span>
                          {classif && <TagBadge nome={classif.nome} cor={classif.cor} />}
                        </div>
                        {orphanObservacoes[i] && (
                          <p className="text-xs text-slate-500 mt-1 italic">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 not-italic">Obs: </span>
                            {orphanObservacoes[i]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} className={`rounded-2xl p-3 sm:p-4 ${item.reason === 'ambiguous' ? 'bg-amber-50' : 'bg-rose-50'}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selOrphan.has(i)}
                      onChange={e => setSelOrphan(prev => { const s = new Set(prev); e.target.checked ? s.add(i) : s.delete(i); return s; })}
                      className="accent-indigo-600 w-4 h-4 mt-1 flex-shrink-0 self-start" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <TipoBadge tipo={item.transacao.tipo} />
                        <span className="text-sm font-bold text-slate-700">€{Number(item.transacao.valor).toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400">{item.transacao.data}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${item.reason === 'ambiguous' ? 'text-amber-700' : 'text-rose-700'}`}>
                          {item.reason === 'ambiguous' ? 'Ambíguo' : 'Sem correspondência'}
                        </span>
                      </div>
                      {item.transacao.tipoMovimento && (
                        <p className="text-[10px] text-slate-500 mb-1">
                          <span className="font-black uppercase tracking-widest">Tipo Movimento:</span> {item.transacao.tipoMovimento}
                        </p>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex-shrink-0">Descrição: </span>
                        {editingResultDesc?.section === 'orphan_bank' && editingResultDesc?.index === i ? (
                          <input autoFocus
                            className="flex-1 text-xs text-slate-700 font-medium border-b border-indigo-400 bg-transparent outline-none pb-0.5"
                            value={editingResultDesc.value}
                            onChange={e => setEditingResultDesc(prev => ({ ...prev, value: e.target.value }))}
                            onBlur={() => saveResultDescricao('orphan_bank', i, editingResultDesc.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveResultDescricao('orphan_bank', i, editingResultDesc.value);
                              if (e.key === 'Escape') setEditingResultDesc(null);
                            }}
                          />
                        ) : (
                          <span className="text-xs text-slate-700 font-medium truncate">{item.transacao.descricao || '—'}</span>
                        )}
                        <button onClick={() => setEditingResultDesc({ section: 'orphan_bank', index: i, value: item.transacao.descricao || '' })}
                          className={`flex-shrink-0 transition-all ${editingResultDesc?.section === 'orphan_bank' && editingResultDesc?.index === i ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-400'}`}
                          title="Editar descrição"><Pencil size={11} /></button>
                      </div>
                      {item.reason === 'ambiguous' && item.candidates && (
                        <p className="text-[10px] text-amber-600 mt-1">
                          Candidatos: {item.candidates.map(c => c.entidade).filter(Boolean).join(', ')}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {item.transacao?.tipo === 'credito' && (() => {
                          const link = txLinkInfo('orphan_bank', i);
                          const clientName = link ? (clients?.find(c => c.id === link.client_id)?.name || link.client_id) : null;
                          return link ? (
                            <span title={`Associado a ${clientName} (${link.period}) — clique para remover`}
                              className="flex items-center gap-1 text-indigo-500 text-[9px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-full cursor-pointer hover:bg-rose-50 hover:text-rose-500"
                              onClick={() => removerAssociacaoCliente('orphan_bank', i)}>
                              <Link2 size={10} /> {clientName}
                            </span>
                          ) : (
                            <button onClick={() => abrirAssociarCliente('orphan_bank', i, item.transacao)}
                              title="Associar a cliente de faturação"
                              className="flex items-center gap-1 border border-indigo-100 text-indigo-400 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all">
                              <Link2 size={12} /> Cliente
                            </button>
                          );
                        })()}
                        <button onClick={() => abrirAssociarFatura(i, item.transacao)}
                          className="flex items-center gap-1 border border-indigo-200 text-indigo-600 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all">
                          <Tag size={12} /> Associar
                        </button>
                        <button onClick={() => pedirObservacaoOrphan([i])}
                          className="flex items-center gap-1 bg-indigo-600 text-white rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                          <CheckCircle size={12} /> Confirmar
                        </button>
                        <button onClick={() => { if (window.confirm('Excluir este movimento dos resultados?')) excluirItem('orphan_bank', i); }}
                          disabled={excluindo.has(`orphan_bank_${i}`)} title="Excluir movimento"
                          className="p-1.5 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50">
                          {excluindo.has(`orphan_bank_${i}`) ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Sub-tab: Órfãos Sistema */}
      {activeSubTab === 'orphan_system' && (
        <div className="space-y-3">
          {(displayData.orphan_system || []).length === 0 && (
            <p className="text-center text-slate-400 py-8 text-sm">Todas as faturas têm correspondência.</p>
          )}
          {(displayData.orphan_system || []).map((item, i) => (
            <div key={i} className="bg-rose-50 rounded-2xl p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-700">Fatura sem pagamento</span>
                  <span className="text-sm font-bold text-slate-700">€{Number(item.fatura.valor).toFixed(2)}</span>
                  <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">PENDENTE</span>
                </div>
                <p className="text-xs text-slate-600 truncate">{item.fatura.entidade} · {item.fatura.descricao}</p>
              </div>
              <button onClick={() => { if (window.confirm('Remover esta fatura dos resultados?')) excluirItem('orphan_system', i); }}
                disabled={excluindo.has(`orphan_system_${i}`)} title="Excluir da lista"
                className="flex-shrink-0 p-1.5 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50">
                {excluindo.has(`orphan_system_${i}`) ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
