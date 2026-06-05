import React from 'react';
import { Clock, ChevronDown, ChevronUp, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { extractMonthYearName } from '../movimentacoes/txUtils';

export default function HistoricoSection({
  historico, setHistorico,
  historicoAberto, setHistoricoAberto,
  loadingHistorico,
  selHistorico, setSelHistorico,
  relatorioRuns, setRelatorioRuns,
  showRelatorio, setShowRelatorio,
  loadingMultiRel, setLoadingMultiRel,
  runSelecionado, setRunSelecionado,
  reprocessando,
  supabase,
  autoAssociarEntradas, autoConfirmarMatched, carregarPagamentosLinks,
  apagarRun, reprocessarRun,
}) {
  const handleRunClick = async (run) => {
    const { data } = await supabase
      .from('reconciliation_runs')
      .select('*')
      .eq('id', run.id)
      .single();
    if (!data) return;
    setRunSelecionado(data);
    if (data.results_json) {
      await autoAssociarEntradas(data.results_json, data.id);
      const newMatched = await autoConfirmarMatched(data.results_json.matched || [], data.id, data.results_json);
      if (newMatched !== data.results_json.matched) {
        setRunSelecionado(prev => prev
          ? { ...prev, results_json: { ...prev.results_json, matched: newMatched } }
          : prev
        );
      }
      const { data: pLinksCount } = await supabase
        .from('faturacao_clientes_pagamentos')
        .select('transaction_section')
        .eq('reconciliation_run_id', data.id);
      const nAssoc = (pLinksCount || []).filter(p => p.transaction_section === 'orphan_bank').length;
      setHistorico(prev => prev.map(r => r.id === data.id
        ? { ...r, matched_count: (data.results_json.matched?.length ?? 0) + nAssoc, orphan_bank_count: Math.max(0, (data.results_json.orphan_bank?.length ?? 0) - nAssoc) }
        : r
      ));
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100">
      <button
        onClick={() => setHistoricoAberto(v => !v)}
        className="w-full flex items-center justify-between px-6 sm:px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock size={14} /> Histórico de Importações ({historico.length})
        </span>
        {historicoAberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {historicoAberto && (
        <div className="px-6 sm:px-8 pb-6">
          {loadingHistorico && (
            <div className="flex justify-center py-4">
              <Loader2 size={18} className="animate-spin text-indigo-400" />
            </div>
          )}
          {!loadingHistorico && historico.length === 0 && (
            <p className="text-center text-slate-400 py-4 text-sm">Nenhuma importação anterior.</p>
          )}

          {selHistorico.size > 0 && (
            <div className="flex items-center justify-between mb-3 px-3 py-2 bg-indigo-50 rounded-xl">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                {selHistorico.size} seleccionada{selHistorico.size > 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setSelHistorico(new Set())}
                  className="text-[10px] text-slate-400 hover:text-slate-600 font-black uppercase tracking-widest">
                  Limpar
                </button>
                <button
                  disabled={loadingMultiRel}
                  onClick={async () => {
                    setLoadingMultiRel(true);
                    try {
                      const { data } = await supabase
                        .from('reconciliation_runs')
                        .select('id, filename, created_at, results_json')
                        .in('id', [...selHistorico]);
                      if (data) { setRelatorioRuns(data); setShowRelatorio(true); }
                    } finally {
                      setLoadingMultiRel(false);
                    }
                  }}
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                >
                  {loadingMultiRel ? <Loader2 size={12} className="animate-spin" /> : null}
                  Relatório
                </button>
              </div>
            </div>
          )}

          {historico.map(run => (
            <div
              key={run.id}
              onClick={() => handleRunClick(run)}
              className={`w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 cursor-pointer ${selHistorico.has(run.id) ? 'bg-indigo-50' : ''}`}
            >
              <input
                type="checkbox"
                checked={selHistorico.has(run.id)}
                onClick={e => e.stopPropagation()}
                onChange={e => {
                  e.stopPropagation();
                  setSelHistorico(prev => {
                    const s = new Set(prev);
                    e.target.checked ? s.add(run.id) : s.delete(run.id);
                    return s;
                  });
                }}
                className="accent-indigo-600 w-4 h-4 flex-shrink-0 mr-2 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{extractMonthYearName(run.transactions_json) || run.filename}</p>
                <p className="text-[10px] text-slate-400">
                  {new Date(run.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-black flex-shrink-0">
                <span className="hidden sm:inline bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{run.matched_count} ok</span>
                <span className="hidden sm:inline bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{run.orphan_bank_count} banco</span>
                <span className="hidden sm:inline bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{run.orphan_system_count} sist.</span>
                <span className="sm:hidden bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{run.matched_count}✓</span>
                <button onClick={e => reprocessarRun(e, run.id)} disabled={reprocessando === run.id}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  title="Reprocessar extrato com faturas actuais">
                  {reprocessando === run.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                </button>
                <button onClick={e => apagarRun(e, run.id)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                  title="Apagar importação">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
