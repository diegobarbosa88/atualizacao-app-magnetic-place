import { useState, useEffect, useRef } from 'react';
import { extractMonthYearName, txKey } from './txUtils';
import {
  runAutoMatchFaturas, runAutoMatchFaturasSplit,
  runAutoMatchRecibos, runVirtualLinkStep, runAutoMatch,
} from './autoMatchEngine';

export function useMovData({ supabase, clients }) {
  const [allTxs, setAllTxs] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [justificacoes, setJustificacoes] = useState([]);
  const [internos, setInternos] = useState([]);
  const [impostos, setImpostos] = useState([]);
  const [notasCredito, setNotasCredito] = useState([]);
  const [reciboLinks, setReciboLinks] = useState([]);
  const [faturaLinks, setFaturaLinks] = useState([]);
  const [faturasData, setFaturasData] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [salarialAliases, setSalarialAliases] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [runId, setRunId] = useState(null);
  const [runData, setRunData] = useState(null);
  const [activeRunId, setActiveRunId] = useState(null);
  const [allRuns, setAllRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);
  const [autoMatchCount, setAutoMatchCount] = useState(null);
  const [runMonthYear, setRunMonthYear] = useState({});

  const activeRunIdRef = useRef(activeRunId);
  useEffect(() => { activeRunIdRef.current = activeRunId; }, [activeRunId]);

  async function updateFaturasPagoIfComplete(fatsArr, curFatLinks, txsData, sb, rid) {
    if (!curFatLinks?.length || !txsData?.length) return;
    const linkedFatIds = [...new Set(curFatLinks.map(l => l.fatura_id))];
    for (const faturaId of linkedFatIds) {
      const fatura = fatsArr.find(f => f.id === faturaId);
      if (!fatura || fatura.status === 'PAGO') continue;
      if (String(fatura.dados?.fornecedor) !== 'Novo Banco, S.A.' || String(fatura.dados?.numero_fatura) !== '4314117912') continue;
      const valorTotal = Math.abs(parseFloat(fatura.dados?.valor_total) || 0);
      if (valorTotal <= 0) continue;
      const linksForFatura = curFatLinks.filter(l => l.fatura_id === faturaId);
      let soma = 0;
      for (const link of linksForFatura) {
        const tx = txsData.find(t => txKey(t) === link.tx_key);
        if (tx) soma += Math.abs(parseFloat(tx.valor) || 0);
      }
      if (soma >= valorTotal - 0.01) {
        await sb.from('faturas').update({ status: 'PAGO' }).eq('id', faturaId);
        setFaturasData(prev => prev.map(f => f.id === faturaId ? { ...f, status: 'PAGO' } : f));
      }
    }
  }

  async function autoConfirmarMatched(matchedItems, rid, fullResults) {
    if (!supabase || !matchedItems?.length) return matchedItems;
    const faturaItemsComData = matchedItems.filter(m => m.fatura?.id && m.fatura?.fonte !== 'recibo' && m.transacao?.data);
    const porConfirmar = matchedItems.filter(m => m.fatura?.id && m.fatura?.status !== 'PAGO' && m.rule !== 'confirmed_manual');
    const faturasPorConfirmar = porConfirmar.filter(m => m.fatura.fonte !== 'recibo');
    const recibosPorConfirmar = porConfirmar.filter(m => m.fatura.fonte === 'recibo');
    const allFaturaIdsUpdate = [...new Set([...faturasPorConfirmar.map(m => m.fatura.id), ...faturaItemsComData.map(m => m.fatura.id)])];
    let dadosMap = {};
    if (allFaturaIdsUpdate.length) {
      const { data: faturasAtuals } = await supabase.from('faturas').select('id, dados').in('id', allFaturaIdsUpdate);
      dadosMap = Object.fromEntries((faturasAtuals || []).map(f => [f.id, f.dados]));
    }
    const semDataPagamento = faturaItemsComData.filter(m => m.fatura.status === 'PAGO' && !dadosMap[m.fatura.id]?.data_pagamento);
    const pagasSemDataNenhuma = matchedItems.filter(
      m => m.fatura?.id && m.fatura?.fonte !== 'recibo' && m.fatura.status === 'PAGO' && !m.transacao?.data && !dadosMap[m.fatura.id]?.data_pagamento
    );
    const hoje = new Date().toISOString().slice(0, 10);
    await Promise.all([
      ...faturasPorConfirmar.map(m => {
        const existente = dadosMap[m.fatura.id] || {};
        const dataPagamento = m.transacao?.data || existente.data_pagamento || hoje;
        return supabase.from('faturas').update({ status: 'PAGO', dados: { ...existente, data_pagamento: dataPagamento } }).eq('id', m.fatura.id);
      }),
      ...semDataPagamento.map(m => supabase.from('faturas').update({
        dados: { ...(dadosMap[m.fatura.id] || {}), data_pagamento: m.transacao.data },
      }).eq('id', m.fatura.id)),
      ...pagasSemDataNenhuma.map(m => supabase.from('faturas').update({
        dados: { ...(dadosMap[m.fatura.id] || {}), data_pagamento: hoje },
      }).eq('id', m.fatura.id)),
      ...recibosPorConfirmar.map(m => supabase.from('receipt_validations').update({ estado: 'pago' }).eq('id', m.fatura.id)),
    ]);
    if (!porConfirmar.length && !semDataPagamento.length && !pagasSemDataNenhuma.length) return matchedItems;
    const confirmedIds = new Set(porConfirmar.map(m => m.fatura.id));
    const newMatched = matchedItems.map(m => confirmedIds.has(m.fatura?.id) ? { ...m, fatura: { ...m.fatura, status: 'PAGO' } } : m);
    if (rid && confirmedIds.size > 0) {
      await supabase.from('reconciliation_runs').update({ results_json: { ...(fullResults || {}), matched: newMatched } }).eq('id', rid);
    }
    return newMatched;
  }

  const loadRun = async (overrideRunId) => {
    if (!supabase) return;
    const currentActiveRunId = activeRunIdRef.current;

    if (overrideRunId === undefined && currentActiveRunId === null) {
      setLoading(true);
      try {
        const { data: allRunsData, error: runsErr } = await supabase
          .from('reconciliation_runs')
          .select('id, filename, created_at')
          .order('created_at', { ascending: false })
          .limit(20);
        if (runsErr) { console.error('Erro ao carregar runs:', runsErr); setLoading(false); return; }
        if (!allRunsData?.length) { setLoading(false); return; }

        const allTxsMerged = [];
        for (const run of allRunsData) {
          const { data: runTxs } = await supabase.from('reconciliation_runs').select('transactions_json').eq('id', run.id).single();
          if (runTxs?.transactions_json) allTxsMerged.push(...runTxs.transactions_json.map(t => ({ ...t, run_id: run.id })));
        }
        setRunId(null);
        setRunData(null);
        setAllTxs(allTxsMerged);
        setAllRuns(allRunsData);

        for (const run of allRunsData) {
          const { data: runTxs } = await supabase.from('reconciliation_runs').select('transactions_json').eq('id', run.id).single();
          if (runTxs?.transactions_json?.length) {
            const monthYear = extractMonthYearName(runTxs.transactions_json);
            if (monthYear) setRunMonthYear(prev => ({ ...prev, [run.id]: monthYear }));
          }
        }

        const runIds = allRunsData.map(r => r.id);
        const [{ data: pags }, { data: just }, { data: ints }, { data: imps }, { data: ncs }, { data: als }, { data: rls }, { data: recs }, { data: fats }] = await Promise.all([
          supabase.from('faturacao_clientes_pagamentos').select('tx_key, client_id, period, run_id').in('run_id', runIds),
          supabase.from('entrada_justifications').select('tx_key, justification, run_id').in('run_id', runIds),
          supabase.from('entrada_internos').select('tx_key, run_id').in('run_id', runIds),
          supabase.from('entrada_impostos').select('tx_key, run_id').in('run_id', runIds),
          supabase.from('entrada_nota_credito_links').select('id, tx_key, client_id, period, notas, run_id').in('run_id', runIds),
          supabase.from('movimentacoes_aliases').select('id, bank_name, resolucao, client_id'),
          supabase.from('movimentacao_recibo_links').select('tx_key, worker_id, worker_name, mes, auto_matched, run_id').in('run_id', runIds),
          supabase.from('receipt_validations').select('worker_id, worker_name, mes, liquido_extraido').not('estado', 'in', '("erro","invalido")'),
          supabase.from('faturas').select('id, dados, status, tipo, storage_path').order('importado_em', { ascending: false }),
        ]);
        setPagamentos(pags || []);
        setJustificacoes(just || []);
        setInternos(ints || []);
        setImpostos(imps || []);
        setNotasCredito(ncs || []);
        setAliases(als || []);
        setReciboLinks(rls || []);
        setReceipts(recs || []);
        const { data: fatLinksAllRuns } = await supabase.from('fatura_pagamento_links').select('fatura_id, run_id, tx_key, auto_matched').in('run_id', runIds);
        setFaturaLinks(fatLinksAllRuns || []);
        setFaturasData(fats || []);
      } catch (err) { console.error('Erro em loadRun (todos):', err); }
      setLoading(false);
      return;
    }

    let run;
    if (overrideRunId) {
      const { data } = await supabase.from('reconciliation_runs').select('id, filename, created_at').eq('id', overrideRunId).single();
      run = data;
    } else if (currentActiveRunId) {
      const { data } = await supabase.from('reconciliation_runs').select('id, filename, created_at').eq('id', currentActiveRunId).single();
      run = data;
    }
    if (!run) {
      const { data } = await supabase.from('reconciliation_runs').select('id, filename, created_at').order('created_at', { ascending: false }).limit(1).single();
      run = data;
      if (run) {
        setActiveRunId(run.id);
        setAllRuns(prev => prev.some(r => r.id === run.id) ? prev : [run, ...prev].slice(0, 10));
      }
    }
    if (!run) return;

    const rid = run.id;
    setRunId(rid);
    setRunData(run);

    const { data: txsData } = await supabase.from('reconciliation_runs').select('transactions_json').eq('id', rid).single();
    const txs = txsData?.transactions_json || [];
    setAllTxs(txs);

    if (txs.length > 0) {
      const monthYear = extractMonthYearName(txs);
      if (monthYear) setRunMonthYear(prev => ({ ...prev, [rid]: monthYear }));
    }

    const [{ data: pags }, { data: just }, { data: ints }, { data: imps }, { data: ncs }, { data: als }, { data: rls }, { data: salAls }, { data: recs }, { data: fats }, { data: fatLinks }] = await Promise.all([
      supabase.from('faturacao_clientes_pagamentos').select('tx_key, client_id, period').eq('run_id', rid),
      supabase.from('entrada_justifications').select('tx_key, justification').eq('run_id', rid),
      supabase.from('entrada_internos').select('tx_key').eq('run_id', rid),
      supabase.from('entrada_impostos').select('tx_key').eq('run_id', rid),
      supabase.from('entrada_nota_credito_links').select('id, tx_key, client_id, period, notas').eq('run_id', rid),
      supabase.from('movimentacoes_aliases').select('id, bank_name, resolucao, client_id'),
      supabase.from('movimentacao_recibo_links').select('tx_key, worker_id, worker_name, mes, auto_matched').eq('run_id', rid),
      supabase.from('reconciliacao_salarial_aliases').select('pattern, worker_name'),
      supabase.from('receipt_validations').select('worker_id, worker_name, mes, liquido_extraido').not('estado', 'in', '("erro","invalido")'),
      supabase.from('faturas').select('id, dados, status, tipo').order('importado_em', { ascending: false }),
      supabase.from('fatura_pagamento_links').select('fatura_id, run_id, tx_key, auto_matched').eq('run_id', rid),
    ]);

    const pagsArr = pags || [];
    const justArr = just || [];
    const intsArr = ints || [];
    const impsArr = imps || [];
    const ncsArr = ncs || [];
    const alsArr = als || [];
    const rlsArr = rls || [];
    const salAlsArr = salAls || [];
    const recsArr = recs || [];
    const fatsArr = fats || [];
    const fatLinksArr = fatLinks || [];

    setPagamentos(pagsArr);
    setJustificacoes(justArr);
    setInternos(intsArr);
    setImpostos(impsArr);
    setNotasCredito(ncsArr);
    setAliases(alsArr);
    setReciboLinks(rlsArr);
    setSalarialAliases(salAlsArr);
    setReceipts(recsArr);
    setFaturasData(fatsArr);
    setFaturaLinks(fatLinksArr);
    setLoading(false);

    const resolvedKeys = new Set([
      ...pagsArr.map(p => p.tx_key),
      ...justArr.map(j => j.tx_key),
      ...intsArr.map(i => i.tx_key),
      ...ncsArr.map(n => n.tx_key),
      ...rlsArr.map(r => r.tx_key),
      ...fatLinksArr.map(f => f.tx_key),
    ]);
    const unresolved = txs.filter(tx => !resolvedKeys.has(txKey(tx)));
    if (unresolved.length === 0) return;

    setAutoMatching(true);
    let totalCount = 0;

    const { count: faturaCount, insertedKeys: faturaKeys } = await runAutoMatchFaturas(
      unresolved.filter(tx => tx.tipo === 'debito'), fatsArr, rid, fatLinksArr, setFaturaLinks, supabase
    );
    totalCount += faturaCount;

    const { count: splitCount, insertedKeys: splitKeys } = await runAutoMatchFaturasSplit(
      unresolved.filter(tx => tx.tipo === 'debito'), fatsArr, rid, fatLinksArr, setFaturaLinks, supabase
    );
    totalCount += splitCount;
    const faturaAllKeys = new Set([...faturaKeys, ...splitKeys]);

    const debitosParaRecibo = unresolved.filter(tx => tx.tipo === 'debito' && !faturaAllKeys.has(txKey(tx)));
    const reciboCount = await runAutoMatchRecibos(debitosParaRecibo, rid, salAlsArr, recsArr, rlsArr, setReciboLinks, supabase);
    totalCount += reciboCount;

    const matchCount = await runAutoMatch(unresolved, rid, alsArr, clients, intsArr, impsArr, ncsArr, setInternos, setImpostos, setNotasCredito, setFaturaLinks, setPagamentos, supabase, faturaAllKeys, fatsArr);
    totalCount += matchCount;

    const { data: freshNcs } = await supabase.from('entrada_nota_credito_links').select('tx_key, client_id, period').eq('run_id', rid);
    const ncsUpdated = freshNcs || [];
    const linkCount = await runVirtualLinkStep(supabase, rid, txs, fatsArr, ncsUpdated, fatLinksArr, setFaturaLinks);
    totalCount += linkCount;

    if (totalCount > 0) setAutoMatchCount(totalCount);
    setAutoMatching(false);

    const novoBancoFatura = fatsArr.find(f => f.dados?.fornecedor === 'Novo Banco, S.A.' && String(f.dados?.numero_fatura) === '4314117912');
    if (novoBancoFatura) {
      const { data: freshFatLinks } = await supabase.from('fatura_pagamento_links').select('fatura_id, tx_key').eq('fatura_id', novoBancoFatura.id).eq('run_id', rid);
      if (freshFatLinks?.length) updateFaturasPagoIfComplete(fatsArr, freshFatLinks, txs, supabase, rid);
    }

    const { data: freshFatLinks } = await supabase.from('fatura_pagamento_links').select('fatura_id, tx_key').eq('run_id', rid);
    const matchedItems = (freshFatLinks || []).map(l => {
      const fat = fatsArr.find(f => f.id === l.fatura_id);
      const tx = txs.find(t => txKey(t) === l.tx_key);
      return { fatura: fat, transacao: tx };
    }).filter(m => m.fatura && m.transacao);
    await autoConfirmarMatched(matchedItems, rid, { matched: matchedItems });
  };

  const handleDeleteRun = async (r) => {
    if (!window.confirm('Apagar este extrato? As faturas confirmadas voltarão a PENDENTE.')) return;
    const rid = r.id;
    const { data: runResult } = await supabase.from('reconciliation_runs').select('results_json').eq('id', rid).single();

    if (runResult?.results_json?.matched?.length) {
      const faturaMatches = runResult.results_json.matched.filter(m => m.fatura?.fonte !== 'recibo' && m.fatura?.id);
      const reciboMatches = runResult.results_json.matched.filter(m => m.fatura?.fonte === 'recibo' && m.fatura?.id);

      if (faturaMatches.length) {
        const porStatus = {};
        for (const m of faturaMatches) {
          const st = m.fatura.status_original || 'PENDENTE';
          if (!porStatus[st]) porStatus[st] = [];
          porStatus[st].push(m.fatura.id);
        }
        await Promise.all(Object.entries(porStatus).map(([st, ids]) => supabase.from('faturas').update({ status: st }).in('id', ids)));
      }

      if (reciboMatches.length) {
        const porEstado = {};
        for (const m of reciboMatches) {
          const est = m.fatura.estado_original || 'valido';
          if (!porEstado[est]) porEstado[est] = [];
          porEstado[est].push(m.fatura.id);
        }
        await Promise.all(Object.entries(porEstado).map(([est, ids]) => supabase.from('receipt_validations').update({ estado: est }).in('id', ids)));
      }

      const fatIds = faturaMatches.map(m => m.fatura.id);
      if (fatIds.length) {
        const { data: faturasAtuals } = await supabase.from('faturas').select('id, dados').in('id', fatIds);
        const comDataPagamento = (faturasAtuals || []).filter(f => f.dados?.data_pagamento);
        if (comDataPagamento.length) {
          await Promise.all(comDataPagamento.map(f => {
            const { data_pagamento, ...dadosSem } = f.dados;
            return supabase.from('faturas').update({ dados: dadosSem }).eq('id', f.id);
          }));
        }
      }
    }

    await supabase.from('faturacao_clientes_pagamentos').delete().eq('run_id', rid);
    await supabase.from('fatura_pagamento_links').delete().eq('run_id', rid);
    await supabase.from('entrada_justifications').delete().eq('run_id', rid);
    await supabase.from('entrada_internos').delete().eq('run_id', rid);
    await supabase.from('entrada_nota_credito_links').delete().eq('run_id', rid);
    await supabase.from('movimentacao_recibo_links').delete().eq('run_id', rid);
    await supabase.from('reconciliation_runs').delete().eq('id', rid);

    setAllRuns(prev => prev.filter(x => x.id !== rid));
    if (activeRunIdRef.current === rid) { setActiveRunId(null); setRunId(null); setAllTxs([]); }
  };

  useEffect(() => { loadRun(); }, []);

  useEffect(() => {
    if (activeRunId === null && allRuns.length > 0) loadRun(undefined);
  }, [activeRunId]);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('reconciliation_runs')
      .select('id, filename, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setAllRuns(data); });
  }, []);

  return {
    allTxs,
    pagamentos, setPagamentos,
    justificacoes, setJustificacoes,
    internos, setInternos,
    impostos, setImpostos,
    notasCredito, setNotasCredito,
    reciboLinks, setReciboLinks,
    faturaLinks, setFaturaLinks,
    faturasData, setFaturasData,
    receipts,
    salarialAliases,
    aliases, setAliases,
    runId,
    runData,
    activeRunId, setActiveRunId,
    allRuns,
    loading,
    autoMatching,
    autoMatchCount, setAutoMatchCount,
    runMonthYear,
    loadRun,
    handleDeleteRun,
  };
}
