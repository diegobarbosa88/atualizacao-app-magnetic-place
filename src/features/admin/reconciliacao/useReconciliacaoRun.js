import { useState, useEffect } from 'react';
import { matchClientByTokens, previousMonth } from '../movimentacoes/txUtils';

export function useReconciliacaoRun(supabase, clients, { setHistorico }) {
  // ── Run results state ─────────────────────────────────────────────────────
  const [resultado, setResultado] = useState(null);
  const [runSelecionado, setRunSelecionado] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('matched');
  const [selMatched, setSelMatched] = useState(new Set());
  const [selOrphan, setSelOrphan] = useState(new Set());
  const [confirmando, setConfirmando] = useState(new Set());
  const [bulkConfirmando, setBulkConfirmando] = useState(false);
  const [confirmedOrphans, setConfirmedOrphans] = useState(new Set());
  const [orphanObservacoes, setOrphanObservacoes] = useState({});
  const [orphanClassificacoes, setOrphanClassificacoes] = useState({});
  const [pendingOrphanConfirm, setPendingOrphanConfirm] = useState(null);
  const [pagamentosLinks, setPagamentosLinks] = useState([]);
  const [autoAssociando, setAutoAssociando] = useState(false);
  const [desvinculando, setDesvinculando] = useState(new Set());
  const [excluindo, setExcluindo] = useState(new Set());
  const [confirmandoEntrada, setConfirmandoEntrada] = useState(new Set());
  const [editingResultDesc, setEditingResultDesc] = useState(null);
  const [pendingAssociacao, setPendingAssociacao] = useState(null);
  const [assocFaturas, setAssocFaturas] = useState([]);
  const [loadingAssoc, setLoadingAssoc] = useState(false);
  const [assocClienteModal, setAssocClienteModal] = useState(null);
  const [aliases, setAliases] = useState([]);
  const [showAliases, setShowAliases] = useState(false);
  const [tags, setTags] = useState([]);
  const [reprocessando, setReprocessando] = useState(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const displayData = runSelecionado
    ? { ...runSelecionado.results_json, run_id: runSelecionado.id }
    : resultado;

  const clientAssocMatched = pagamentosLinks
    .filter(p => p.transaction_section === 'orphan_bank')
    .map(p => {
      const orphanItem = (displayData?.orphan_bank || []).find((_, idx) => idx === p.transaction_index);
      return {
        transacao: p.transaction_data,
        fatura: null,
        rule: 'client_association',
        client_name: clients?.find(c => c.id === p.client_id)?.name || p.client_id,
        period: p.period,
        _orig_section: 'orphan_bank',
        _orig_index: p.transaction_index,
        confirmed_entrada: orphanItem?.confirmed_entrada || false,
      };
    });

  const orphanBankAssocSet = new Set(
    pagamentosLinks.filter(p => p.transaction_section === 'orphan_bank').map(p => p.transaction_index)
  );

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const runId = runSelecionado?.id ?? resultado?.run_id;
    if (runId) carregarPagamentosLinks(runId);
    else setPagamentosLinks([]);
  }, [runSelecionado?.id, resultado?.run_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const bank = runSelecionado
      ? (runSelecionado.results_json?.orphan_bank || [])
      : (resultado?.orphan_bank || []);
    const confirmed = new Set();
    const obs = {};
    const classif = {};
    bank.forEach((item, i) => {
      if (item.confirmed) {
        confirmed.add(i);
        if (item.observacao) obs[i] = item.observacao;
        if (item.classificacao) classif[i] = item.classificacao;
      }
    });
    setConfirmedOrphans(confirmed);
    setOrphanObservacoes(obs);
    setOrphanClassificacoes(classif);
  }, [runSelecionado?.id, resultado?.run_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!supabase) return;
    carregarTags();
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tags ──────────────────────────────────────────────────────────────────
  const carregarTags = async () => {
    const { data } = await supabase
      .from('reconciliation_classificacao_tags')
      .select('id, nome, cor')
      .order('created_at', { ascending: true });
    if (data) setTags(data);
  };

  const criarTag = async (nome, cor) => {
    try {
      const { data, error } = await supabase
        .from('reconciliation_classificacao_tags')
        .insert({ nome, cor })
        .select('id, nome, cor')
        .single();
      if (error) throw error;
      setTags(prev => [...prev, data]);
      return data;
    } catch (err) {
      alert(`Erro ao criar tag: ${err.message}`);
      return null;
    }
  };

  // ── Pagamentos links ──────────────────────────────────────────────────────
  const carregarPagamentosLinks = async (runId) => {
    if (!supabase || !runId) return;
    const { data } = await supabase
      .from('faturacao_clientes_pagamentos')
      .select('*')
      .eq('reconciliation_run_id', runId);
    setPagamentosLinks(data || []);
  };

  const txLinkInfo = (section, index) =>
    pagamentosLinks.find(p => p.transaction_section === section && p.transaction_index === index);

  const abrirAssociarCliente = (section, index, tx) => {
    const runId = runSelecionado?.id ?? resultado?.run_id;
    const defaultPeriod = previousMonth(tx?.data || '');
    setAssocClienteModal({ section, index, tx, runId, defaultPeriod });
  };

  const salvarAssociacaoCliente = async (modal, clienteId, periodo) => {
    if (!modal || !clienteId || !periodo) return;
    const { section, index, tx, runId } = modal;
    const existente = txLinkInfo(section, index);
    if (existente) {
      await supabase.from('faturacao_clientes_pagamentos').delete().eq('id', existente.id);
    }
    await supabase.from('faturacao_clientes_pagamentos').insert({
      client_id: clienteId,
      period: periodo,
      reconciliation_run_id: runId,
      transaction_section: section,
      transaction_index: index,
      transaction_data: tx,
      valor_pago: Number(tx?.valor || 0),
    });
    await carregarPagamentosLinks(runId);
    if (section === 'orphan_bank') setActiveSubTab('matched');
  };

  const removerAssociacaoCliente = async (section, index) => {
    const existente = txLinkInfo(section, index);
    if (existente) {
      await supabase.from('faturacao_clientes_pagamentos').delete().eq('id', existente.id);
    }
    const runId = runSelecionado?.id ?? resultado?.run_id;
    await carregarPagamentosLinks(runId);
  };

  // ── Auto-associação ───────────────────────────────────────────────────────
  const autoAssociarEntradas = async (resultsJson, runId) => {
    if (!supabase || !clients?.length || !runId) return 0;
    const { data: existentes } = await supabase
      .from('faturacao_clientes_pagamentos')
      .select('transaction_section, transaction_index')
      .eq('reconciliation_run_id', runId);
    const jaAssociados = new Set((existentes || []).map(p => `${p.transaction_section}_${p.transaction_index}`));
    const toInsert = [];
    for (const { key, items } of [
      { key: 'orphan_bank', items: resultsJson.orphan_bank || [] },
    ]) {
      items.forEach((item, idx) => {
        const tx = item.transacao ?? item;
        if (tx?.tipo !== 'credito') return;
        if (jaAssociados.has(`${key}_${idx}`)) return;
        const client = matchClientByTokens(tx.descricao, clients);
        if (!client) return;
        toInsert.push({
          client_id: client.id,
          period: previousMonth(tx.data),
          reconciliation_run_id: runId,
          transaction_section: key,
          transaction_index: idx,
          transaction_data: tx,
          valor_pago: Number(tx.valor || 0),
        });
      });
    }
    if (toInsert.length > 0) await supabase.from('faturacao_clientes_pagamentos').insert(toInsert);
    return toInsert.length;
  };

  // ── Auto-confirmar matches ────────────────────────────────────────────────
  const autoConfirmarMatched = async (matchedItems, runId, fullResults) => {
    if (!supabase || !matchedItems?.length) return matchedItems;

    const faturaItemsComData = matchedItems.filter(
      m => m.fatura?.id && m.fatura?.fonte !== 'recibo' && m.transacao?.data
    );
    const porConfirmar = matchedItems.filter(
      m => m.fatura?.id && m.fatura?.status !== 'PAGO' && m.rule !== 'confirmed_manual'
    );
    const faturasPorConfirmar = porConfirmar.filter(m => m.fatura.fonte !== 'recibo');
    const recibosPorConfirmar = porConfirmar.filter(m => m.fatura.fonte === 'recibo');

    const allFaturaIdsUpdate = [...new Set([
      ...faturasPorConfirmar.map(m => m.fatura.id),
      ...faturaItemsComData.map(m => m.fatura.id),
    ])];
    let dadosMap = {};
    if (allFaturaIdsUpdate.length) {
      const { data: faturasAtuals } = await supabase
        .from('faturas').select('id, dados').in('id', allFaturaIdsUpdate);
      dadosMap = Object.fromEntries((faturasAtuals || []).map(f => [f.id, f.dados]));
    }

    const semDataPagamento = faturaItemsComData.filter(
      m => m.fatura.status === 'PAGO' && !dadosMap[m.fatura.id]?.data_pagamento
    );
    const pagasSemDataNenhuma = matchedItems.filter(
      m => m.fatura?.id && m.fatura?.fonte !== 'recibo' &&
        m.fatura.status === 'PAGO' && !m.transacao?.data && !dadosMap[m.fatura.id]?.data_pagamento
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
      ...recibosPorConfirmar.map(m =>
        supabase.from('receipt_validations').update({ estado: 'pago' }).eq('id', m.fatura.id)
      ),
    ]);

    if (!porConfirmar.length && !semDataPagamento.length && !pagasSemDataNenhuma.length) return matchedItems;

    const confirmedIds = new Set(porConfirmar.map(m => m.fatura.id));
    const newMatched = matchedItems.map(m =>
      confirmedIds.has(m.fatura?.id) ? { ...m, fatura: { ...m.fatura, status: 'PAGO' } } : m
    );

    if (runId && confirmedIds.size > 0) {
      const base = fullResults ?? runSelecionado?.results_json ?? resultado ?? {};
      await supabase.from('reconciliation_runs').update({
        results_json: { ...base, matched: newMatched },
      }).eq('id', runId);
    }

    return newMatched;
  };

  // ── Confirmar pagamento individual ────────────────────────────────────────
  const confirmarPagamento = async (faturaId, fonte, txDate) => {
    setConfirmando(prev => new Set(prev).add(faturaId));
    try {
      if (fonte === 'recibo') {
        const { error } = await supabase.from('receipt_validations').update({ estado: 'pago' }).eq('id', faturaId);
        if (error) throw error;
      } else {
        const { data: f } = await supabase.from('faturas').select('dados').eq('id', faturaId).single();
        const dadosExistentes = f?.dados || {};
        const dataPagamento = txDate || dadosExistentes.data_pagamento || new Date().toISOString().slice(0, 10);
        const { error } = await supabase.from('faturas')
          .update({ status: 'PAGO', dados: { ...dadosExistentes, data_pagamento: dataPagamento } })
          .eq('id', faturaId);
        if (error) throw error;
      }
      const updateMatched = matched => matched.map(m =>
        m.fatura?.id === faturaId ? { ...m, fatura: { ...m.fatura, status: 'PAGO' } } : m
      );
      const runId = runSelecionado?.id ?? resultado?.run_id;
      let newMatched;
      if (runSelecionado) {
        newMatched = updateMatched(runSelecionado.results_json.matched || []);
        setRunSelecionado(prev => ({ ...prev, results_json: { ...prev.results_json, matched: newMatched } }));
      } else {
        newMatched = updateMatched(resultado?.matched || []);
        setResultado(prev => ({ ...prev, matched: newMatched }));
      }
      if (runId) {
        const baseResults = runSelecionado?.results_json ?? {
          matched: resultado?.matched || [],
          orphan_bank: resultado?.orphan_bank || [],
          orphan_system: resultado?.orphan_system || [],
        };
        await supabase.from('reconciliation_runs').update({ results_json: { ...baseResults, matched: newMatched } }).eq('id', runId);
      }
    } catch (err) {
      alert(`Erro ao confirmar pagamento: ${err.message}`);
    } finally {
      setConfirmando(prev => { const s = new Set(prev); s.delete(faturaId); return s; });
    }
  };

  // ── Confirmar bulk matched ────────────────────────────────────────────────
  const confirmarBulkMatched = async () => {
    if (!selMatched.size) return;
    setBulkConfirmando(true);
    try {
      const allDisplayItems = [...((runSelecionado ? runSelecionado.results_json : resultado)?.matched || []), ...clientAssocMatched];
      const selectedItems = allDisplayItems.filter((_, i) => selMatched.has(i));
      const faturaSelected = selectedItems.filter(m => m.fatura?.id && m.fatura?.status !== 'PAGO' && m.rule !== 'confirmed_manual');
      const entradaSelected = selectedItems.filter(m => m.rule === 'client_association' && !m.confirmed_entrada);
      if (!faturaSelected.length && !entradaSelected.length) return;

      const seenIds = new Set();
      const uniqueFaturas = faturaSelected.filter(m => { if (seenIds.has(m.fatura.id)) return false; seenIds.add(m.fatura.id); return true; });
      const allFaturaIds = uniqueFaturas.map(m => m.fatura.id);
      if (allFaturaIds.length) setConfirmando(new Set(allFaturaIds));

      const faturaIdsNaoRecibo = uniqueFaturas.filter(i => i.fatura.fonte !== 'recibo').map(i => i.fatura.id);
      let dadosMap = {};
      if (faturaIdsNaoRecibo.length) {
        const { data: faturasAtuals } = await supabase.from('faturas').select('id, dados').in('id', faturaIdsNaoRecibo);
        dadosMap = Object.fromEntries((faturasAtuals || []).map(f => [f.id, f.dados]));
      }

      const hojeB = new Date().toISOString().slice(0, 10);
      await Promise.all(uniqueFaturas.map(item => {
        if (item.fatura.fonte === 'recibo')
          return supabase.from('receipt_validations').update({ estado: 'pago' }).eq('id', item.fatura.id);
        const existenteB = dadosMap[item.fatura.id] || {};
        const dataPagamento = item.transacao?.data || existenteB.data_pagamento || hojeB;
        return supabase.from('faturas').update({ status: 'PAGO', dados: { ...existenteB, data_pagamento: dataPagamento } }).eq('id', item.fatura.id);
      }));

      const runId = runSelecionado?.id ?? resultado?.run_id;
      const baseResults = runSelecionado?.results_json ?? {
        matched: resultado?.matched || [],
        orphan_bank: resultado?.orphan_bank || [],
        orphan_system: resultado?.orphan_system || [],
      };

      const idSet = new Set(allFaturaIds);
      const newMatched = (baseResults.matched || []).map(m =>
        m.fatura?.id && idSet.has(m.fatura.id) ? { ...m, fatura: { ...m.fatura, status: 'PAGO' } } : m
      );

      const origIndicesConfirmadas = new Set(entradaSelected.map(m => m._orig_index));
      const newOrphanBank = (baseResults.orphan_bank || []).map((ob, idx) =>
        origIndicesConfirmadas.has(idx) ? { ...ob, confirmed_entrada: true } : ob
      );

      const newResults = { ...baseResults, matched: newMatched, orphan_bank: newOrphanBank };
      if (runId) {
        await supabase.from('reconciliation_runs').update({ results_json: newResults }).eq('id', runId);
      }
      if (runSelecionado) {
        setRunSelecionado(prev => ({ ...prev, results_json: newResults }));
      } else {
        setResultado(prev => ({ ...prev, matched: newMatched, orphan_bank: newOrphanBank }));
      }
      setSelMatched(new Set());
      setConfirmando(new Set());
    } catch (err) {
      alert(`Erro ao confirmar pagamentos: ${err.message}`);
    } finally {
      setBulkConfirmando(false);
    }
  };

  // ── Confirmar órfão banco ─────────────────────────────────────────────────
  const pedirObservacaoOrphan = (indices) => setPendingOrphanConfirm({ indices });

  const confirmarMovimento = async ({ tag: selectedTag, obs: orphanObs }) => {
    if (!pendingOrphanConfirm) return;
    const { indices } = pendingOrphanConfirm;
    const idxSet = new Set(indices);
    const obsText = orphanObs.trim();
    const tag = selectedTag ? { nome: selectedTag.nome, cor: selectedTag.cor } : null;

    setPendingOrphanConfirm(null);
    setSelOrphan(new Set());

    const runId = runSelecionado?.id ?? resultado?.run_id;
    if (!runId) return;

    const baseResults = runSelecionado?.results_json ?? {
      matched: resultado?.matched || [],
      orphan_bank: resultado?.orphan_bank || [],
      orphan_system: resultado?.orphan_system || [],
    };

    const sourceBank = baseResults.orphan_bank;
    const newOrphanBank = sourceBank.filter((_, i) => !idxSet.has(i));
    const newManualMatches = sourceBank
      .filter((_, i) => idxSet.has(i))
      .map(item => ({
        transacao: item.transacao,
        fatura: null,
        rule: 'confirmed_manual',
        observacao: obsText || null,
        classificacao: tag,
      }));

    const newMatched = [...(baseResults.matched || []), ...newManualMatches];
    const newResults = { ...baseResults, matched: newMatched, orphan_bank: newOrphanBank };

    if (runSelecionado) {
      setRunSelecionado(prev => ({ ...prev, results_json: newResults }));
    } else {
      setResultado(prev => ({ ...prev, matched: newMatched, orphan_bank: newOrphanBank }));
    }

    const { error } = await supabase.from('reconciliation_runs').update({ results_json: newResults }).eq('id', runId);
    if (error) console.error('Erro ao persistir confirmação:', error.message);
  };

  // ── Associação manual a fatura ────────────────────────────────────────────
  const abrirAssociarFatura = async (index, transacao) => {
    setPendingAssociacao({ index, transacao });
    setLoadingAssoc(true);
    try {
      const [{ data: faturas }, { data: recibos }] = await Promise.all([
        supabase.from('faturas')
          .select('id, tipo, valor, data_documento, descricao, entidade, status, fonte, dados, filename')
          .not('status', 'eq', 'PAGO').order('data_documento', { ascending: false }).limit(100),
        supabase.from('receipt_validations')
          .select('id, worker_name, liquido_extraido, mes, estado')
          .not('estado', 'eq', 'pago').limit(100),
      ]);
      const recibosNorm = (recibos || []).map(r => ({
        id: r.id, tipo: 'recibo', fonte: 'recibo', valor: r.liquido_extraido,
        data_documento: null, descricao: `Recibo ${r.worker_name || ''} ${r.mes || ''}`.trim(),
        entidade: r.worker_name || '', status: r.estado, estado_original: r.estado, dados: null, filename: null,
      }));
      setAssocFaturas([...(faturas || []), ...recibosNorm]);
    } finally {
      setLoadingAssoc(false);
    }
  };

  const extractEntityFromDescUI = (desc) => {
    const patterns = [
      /TRF\s+IMEDIATA\s+DE\s+/i, /TRANSFERENCIA\s+DE\s+/i,
      /TRANSF(?:ERENCIA)?\s+DE\s+/i, /TRF\s+DE\s+/i,
      /ORDEM\s+DE\s+PAGAMENTO\s+DE\s+/i, /PAGAMENTO\s+DE\s+/i,
      /PAGT\s+DE\s+/i, /RECEBIDO\s+DE\s+/i, /REC\s+DE\s+/i,
    ];
    for (const p of patterns) {
      const m = desc.match(p);
      if (m) return desc.slice(m.index + m[0].length).trim();
    }
    return desc;
  };

  const confirmarAssociacaoManual = async (fatura, saveAlias) => {
    if (!pendingAssociacao) return;
    const { index, transacao } = pendingAssociacao;

    const sourceMatchedCheck = runSelecionado
      ? (runSelecionado.results_json?.matched || [])
      : (resultado?.matched || []);
    const isSplit = sourceMatchedCheck.some(m => m.fatura?.id === fatura.id);
    const novoMatch = { transacao, fatura: { ...fatura, valor: fatura.valor ?? fatura.dados?.valor_total }, rule: isSplit ? 'manual_split' : 'manual' };

    const runId = runSelecionado?.id ?? resultado?.run_id;
    if (!runId) { setPendingAssociacao(null); return; }

    const sourceBank = runSelecionado ? (runSelecionado.results_json?.orphan_bank || []) : (resultado?.orphan_bank || []);
    const sourceMatched = runSelecionado ? (runSelecionado.results_json?.matched || []) : (resultado?.matched || []);
    const sourceSystem = runSelecionado ? (runSelecionado.results_json?.orphan_system || []) : (resultado?.orphan_system || []);

    const newOrphanBank = sourceBank.filter((_, i) => i !== index);
    const newMatched = [...sourceMatched, novoMatch];
    const newOrphanSystem = sourceSystem.filter(s => s.fatura?.id !== fatura.id);

    const baseResults = runSelecionado?.results_json ?? {
      matched: resultado?.matched || [],
      orphan_bank: resultado?.orphan_bank || [],
      orphan_system: resultado?.orphan_system || [],
    };
    const newResults = { ...baseResults, matched: newMatched, orphan_bank: newOrphanBank, orphan_system: newOrphanSystem };

    const { error } = await supabase.from('reconciliation_runs').update({
      results_json: newResults,
      matched_count: newMatched.length,
      orphan_bank_count: newOrphanBank.length,
      orphan_system_count: newOrphanSystem.length,
    }).eq('id', runId);
    if (error) { alert(`Erro ao guardar associação: ${error.message}`); return; }

    if (runSelecionado) {
      setRunSelecionado(prev => ({
        ...prev,
        matched_count: newMatched.length,
        orphan_bank_count: newOrphanBank.length,
        orphan_system_count: newOrphanSystem.length,
        results_json: newResults,
      }));
    } else {
      setResultado(prev => ({
        ...prev,
        matched: newMatched, orphan_bank: newOrphanBank, orphan_system: newOrphanSystem,
        matched_count: newMatched.length, orphan_bank_count: newOrphanBank.length, orphan_system_count: newOrphanSystem.length,
      }));
    }
    setHistorico(prev => prev.map(r => r.id === runId
      ? { ...r, matched_count: newMatched.length, orphan_bank_count: newOrphanBank.length, orphan_system_count: newOrphanSystem.length }
      : r
    ));
    if (saveAlias && fatura.entidade) {
      const bankName = extractEntityFromDescUI(transacao.descricao || '');
      const { data: newAlias } = await supabase.from('reconciliacao_entity_aliases')
        .upsert({ bank_name: bankName, system_entity: fatura.entidade }, { onConflict: 'bank_name,system_entity' })
        .select().single();
      if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => !(a.bank_name === bankName && a.system_entity === fatura.entidade))]);
    }
    setPendingAssociacao(null);
  };

  const apagarAlias = async (id) => {
    await supabase.from('reconciliacao_entity_aliases').delete().eq('id', id);
    setAliases(prev => prev.filter(a => a.id !== id));
  };

  // ── Desvincular / excluir ─────────────────────────────────────────────────
  const limparEReindexarLinks = async (runId, section, removedIndex) => {
    if (!runId) return;
    await supabase.from('faturacao_clientes_pagamentos').delete()
      .eq('reconciliation_run_id', runId).eq('transaction_section', section).eq('transaction_index', removedIndex);
    const { data: posteriores } = await supabase.from('faturacao_clientes_pagamentos').select('id, transaction_index')
      .eq('reconciliation_run_id', runId).eq('transaction_section', section).gt('transaction_index', removedIndex);
    if (posteriores?.length) {
      await Promise.all(posteriores.map(p =>
        supabase.from('faturacao_clientes_pagamentos').update({ transaction_index: p.transaction_index - 1 }).eq('id', p.id)
      ));
    }
  };

  const desvincularMatch = async (matchItem, matchIndex) => {
    const key = `${matchIndex}`;
    setDesvinculando(prev => new Set(prev).add(key));
    try {
      const runId = runSelecionado?.id ?? resultado?.run_id;
      const base = runSelecionado?.results_json ?? {
        matched: resultado?.matched || [], orphan_bank: resultado?.orphan_bank || [], orphan_system: resultado?.orphan_system || [],
      };
      const newMatched = base.matched.filter((_, i) => i !== matchIndex);
      const newOrphanBank = [...base.orphan_bank, { transacao: matchItem.transacao, reason: 'desvinculado' }];
      const newOrphanSystem = matchItem.fatura
        ? [...base.orphan_system, { fatura: matchItem.fatura, reason: 'desvinculado' }]
        : base.orphan_system;
      const newResults = { matched: newMatched, orphan_bank: newOrphanBank, orphan_system: newOrphanSystem };

      if (matchItem.fatura?.status === 'PAGO') {
        if (matchItem.fatura.fonte === 'recibo') {
          await supabase.from('receipt_validations').update({ estado: matchItem.fatura.estado_original || 'valido' }).eq('id', matchItem.fatura.id);
        } else {
          await supabase.from('faturas').update({ status: 'PENDENTE' }).eq('id', matchItem.fatura.id);
        }
      }
      if (runId) {
        await supabase.from('reconciliation_runs').update({
          results_json: newResults, matched_count: newMatched.length,
          orphan_bank_count: newOrphanBank.length, orphan_system_count: newOrphanSystem.length,
        }).eq('id', runId);
        await limparEReindexarLinks(runId, 'matched', matchIndex);
        await carregarPagamentosLinks(runId);
      }
      if (runSelecionado) {
        setRunSelecionado(prev => ({ ...prev, results_json: newResults }));
      } else {
        setResultado(prev => ({ ...prev, ...newResults }));
      }
    } catch (err) {
      alert(`Erro ao desvincular: ${err.message}`);
    } finally {
      setDesvinculando(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const excluirItem = async (section, index) => {
    const key = `${section}_${index}`;
    setExcluindo(prev => new Set(prev).add(key));
    try {
      const runId = runSelecionado?.id ?? resultado?.run_id;
      const base = runSelecionado?.results_json ?? {
        matched: resultado?.matched || [], orphan_bank: resultado?.orphan_bank || [], orphan_system: resultado?.orphan_system || [],
      };
      let newMatched = [...base.matched];
      let newOrphanBank = [...base.orphan_bank];
      let newOrphanSystem = [...base.orphan_system];

      if (section === 'matched') {
        const item = newMatched[index];
        if (item?.fatura?.status === 'PAGO') {
          if (item.fatura.fonte === 'recibo') {
            await supabase.from('receipt_validations').update({ estado: item.fatura.estado_original || 'valido' }).eq('id', item.fatura.id);
          } else {
            await supabase.from('faturas').update({ status: 'PENDENTE' }).eq('id', item.fatura.id);
          }
        }
        newMatched = newMatched.filter((_, i) => i !== index);
      } else if (section === 'orphan_bank') {
        newOrphanBank = newOrphanBank.filter((_, i) => i !== index);
      } else if (section === 'orphan_system') {
        newOrphanSystem = newOrphanSystem.filter((_, i) => i !== index);
      }

      const newResults = { matched: newMatched, orphan_bank: newOrphanBank, orphan_system: newOrphanSystem };
      if (runId) {
        await supabase.from('reconciliation_runs').update({
          results_json: newResults, matched_count: newMatched.length,
          orphan_bank_count: newOrphanBank.length, orphan_system_count: newOrphanSystem.length,
        }).eq('id', runId);
        if (section !== 'orphan_system') {
          await limparEReindexarLinks(runId, section, index);
          await carregarPagamentosLinks(runId);
        }
      }
      if (runSelecionado) {
        setRunSelecionado(prev => ({ ...prev, results_json: newResults }));
      } else {
        setResultado(prev => ({ ...prev, ...newResults }));
      }
    } catch (err) {
      alert(`Erro ao excluir: ${err.message}`);
    } finally {
      setExcluindo(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const confirmarEntrada = async (item, displayIndex) => {
    setConfirmandoEntrada(prev => new Set(prev).add(displayIndex));
    try {
      const runId = runSelecionado?.id ?? resultado?.run_id;
      const base = runSelecionado?.results_json ?? {
        matched: resultado?.matched || [], orphan_bank: resultado?.orphan_bank || [], orphan_system: resultado?.orphan_system || [],
      };
      const newOrphanBank = (base.orphan_bank || []).map((ob, idx) =>
        idx === item._orig_index ? { ...ob, confirmed_entrada: true } : ob
      );
      const newResults = { ...base, orphan_bank: newOrphanBank };
      if (runId) {
        await supabase.from('reconciliation_runs').update({ results_json: newResults }).eq('id', runId);
      }
      if (runSelecionado) {
        setRunSelecionado(prev => ({ ...prev, results_json: newResults }));
      } else {
        setResultado(prev => ({ ...prev, orphan_bank: newOrphanBank }));
      }
    } catch (err) {
      alert(`Erro ao confirmar entrada: ${err.message}`);
    } finally {
      setConfirmandoEntrada(prev => { const s = new Set(prev); s.delete(displayIndex); return s; });
    }
  };

  const saveResultDescricao = async (section, index, newDesc) => {
    setEditingResultDesc(null);
    const runId = runSelecionado?.id ?? resultado?.run_id;
    const base = runSelecionado?.results_json ?? {
      matched: resultado?.matched || [], orphan_bank: resultado?.orphan_bank || [], orphan_system: resultado?.orphan_system || [],
    };
    const newSection = base[section].map((item, i) =>
      i === index ? { ...item, transacao: { ...item.transacao, descricao: newDesc } } : item
    );
    const newResults = { ...base, [section]: newSection };
    if (runId) {
      await supabase.from('reconciliation_runs').update({ results_json: newResults }).eq('id', runId);
    }
    if (runSelecionado) {
      setRunSelecionado(prev => ({ ...prev, results_json: newResults }));
    } else {
      setResultado(prev => ({ ...prev, [section]: newSection }));
    }
  };

  // ── Histórico: apagar / reprocessar run ───────────────────────────────────
  const apagarRun = async (e, runId) => {
    e.stopPropagation();
    if (!window.confirm('Apagar esta importação? As faturas confirmadas voltarão a PENDENTE.')) return;
    const { data: runData } = await supabase.from('reconciliation_runs').select('results_json').eq('id', runId).single();
    if (runData?.results_json?.matched?.length) {
      const faturaMatches = runData.results_json.matched.filter(m => m.fatura?.fonte !== 'recibo' && m.fatura?.id);
      const reciboMatches = runData.results_json.matched.filter(m => m.fatura?.fonte === 'recibo' && m.fatura?.id);

      if (faturaMatches.length) {
        const porStatus = {};
        for (const m of faturaMatches) {
          const st = m.fatura.status_original || 'PENDENTE';
          if (!porStatus[st]) porStatus[st] = [];
          porStatus[st].push(m.fatura.id);
        }
        const results = await Promise.all(
          Object.entries(porStatus).map(([st, ids]) => supabase.from('faturas').update({ status: st }).in('id', ids))
        );
        const fatErr = results.find(r => r.error);
        if (fatErr) { alert(`Erro ao reverter faturas: ${fatErr.error.message}`); return; }
      }

      if (reciboMatches.length) {
        const porEstado = {};
        for (const m of reciboMatches) {
          const est = m.fatura.estado_original || 'valido';
          if (!porEstado[est]) porEstado[est] = [];
          porEstado[est].push(m.fatura.id);
        }
        const results = await Promise.all(
          Object.entries(porEstado).map(([est, ids]) => supabase.from('receipt_validations').update({ estado: est }).in('id', ids))
        );
        const recErr = results.find(r => r.error);
        if (recErr) { alert(`Erro ao reverter recibos: ${recErr.error.message}`); return; }
      }
    }

    if (runData?.results_json?.matched?.length) {
      const fatIds = runData.results_json.matched.filter(m => m.fatura?.fonte !== 'recibo' && m.fatura?.id).map(m => m.fatura.id);
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

    await supabase.from('faturacao_clientes_pagamentos').delete().eq('reconciliation_run_id', runId);

    const { data: linksFaturas } = await supabase.from('fatura_pagamento_links').select('fatura_id').eq('run_id', runId);
    if (linksFaturas?.length > 0) {
      const faturaIds = [...new Set(linksFaturas.map(l => l.fatura_id))];
      await supabase.from('faturas').update({ status: 'PENDENTE' }).in('id', faturaIds);
      await supabase.from('fatura_pagamento_links').delete().eq('run_id', runId);
    }

    const { error, count } = await supabase.from('reconciliation_runs').delete({ count: 'exact' }).eq('id', runId);
    if (error) { alert(`Erro ao apagar: ${error.message}`); return; }
    if (count === 0) { alert('Sem permissão para apagar. Aplique a política RLS de DELETE na tabela reconciliation_runs.'); return; }
    setHistorico(prev => prev.filter(r => r.id !== runId));
    if (runSelecionado?.id === runId) setRunSelecionado(null);
  };

  const reprocessarRun = async (e, runId) => {
    e.stopPropagation();
    setReprocessando(runId);
    try {
      const res = await fetch('/api/reconciliacao/process?action=reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Erro ao reprocessar.'); return; }
      await supabase.from('faturacao_clientes_pagamentos').delete().eq('reconciliation_run_id', runId);
      await autoAssociarEntradas({ matched: data.matched, orphan_bank: data.orphan_bank }, runId);
      await carregarPagamentosLinks(runId);
      setHistorico(prev => prev.map(r => r.id === runId
        ? { ...r, matched_count: data.matched_count, orphan_bank_count: data.orphan_bank_count, orphan_system_count: data.orphan_system_count }
        : r
      ));
      if (runSelecionado?.id === runId) {
        setRunSelecionado(prev => ({
          ...prev,
          matched_count: data.matched_count,
          orphan_bank_count: data.orphan_bank_count,
          orphan_system_count: data.orphan_system_count,
          results_json: { matched: data.matched, orphan_bank: data.orphan_bank, orphan_system: data.orphan_system },
        }));
      }
      if (resultado?.run_id === runId) {
        setResultado(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      alert(err.message || 'Erro de rede.');
    } finally {
      setReprocessando(null);
    }
  };

  return {
    // state
    resultado, setResultado,
    runSelecionado, setRunSelecionado,
    activeSubTab, setActiveSubTab,
    selMatched, setSelMatched,
    selOrphan, setSelOrphan,
    confirmando,
    bulkConfirmando,
    confirmedOrphans,
    orphanObservacoes,
    orphanClassificacoes,
    pendingOrphanConfirm, setPendingOrphanConfirm,
    pagamentosLinks,
    autoAssociando, setAutoAssociando,
    desvinculando,
    excluindo,
    confirmandoEntrada,
    editingResultDesc, setEditingResultDesc,
    pendingAssociacao, setPendingAssociacao,
    assocFaturas,
    loadingAssoc,
    assocClienteModal, setAssocClienteModal,
    aliases, setAliases,
    showAliases, setShowAliases,
    tags,
    reprocessando,
    // derived
    displayData,
    clientAssocMatched,
    orphanBankAssocSet,
    // actions
    carregarPagamentosLinks,
    autoAssociarEntradas,
    autoConfirmarMatched,
    txLinkInfo,
    abrirAssociarCliente,
    salvarAssociacaoCliente,
    removerAssociacaoCliente,
    confirmarPagamento,
    confirmarBulkMatched,
    pedirObservacaoOrphan,
    confirmarMovimento,
    abrirAssociarFatura,
    confirmarAssociacaoManual,
    criarTag,
    apagarAlias,
    desvincularMatch,
    excluirItem,
    confirmarEntrada,
    saveResultDescricao,
    apagarRun,
    reprocessarRun,
  };
}
