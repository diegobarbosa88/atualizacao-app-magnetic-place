import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ChevronDown, ChevronUp,
  X, Loader2, Download, FileText, FileArchive, Undo2,
  Tag, Trash2, Zap, Plus,
  TrendingUp, TrendingDown,
  RefreshCw, Upload,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  MESES, BANCO_KEYWORDS, INTERNO_KEYWORDS, IMPOSTO_KEYWORDS,
  STATUS_KEYS, STATUS_CFG,
  isTaxaBancaria, labelStatus, fmtEur, fmtMes, txKey,
  extractMonthYearName, previousMonth, extractBankName,
  normName, sigTokens, matchClientByTokens, clienteLink, statusTx,
  normWorker, workerScore, findBestReceipt, findSubsetSum,
} from './movimentacoes/txUtils';
import TxRow from './movimentacoes/TxRow';
import MovMesCard from './movimentacoes/MovMesCard';
import InternoModal from './movimentacoes/InternoModal';
import ImpostoModal from './movimentacoes/ImpostoModal';
import JustModal from './movimentacoes/JustModal';
import FaturaModal from './movimentacoes/FaturaModal';
import ReciboModal from './movimentacoes/ReciboModal';
import NcModal from './movimentacoes/NcModal';
import NcManualModal from './movimentacoes/NcManualModal';
import AddAliasModal from './movimentacoes/AddAliasModal';

// ── Componente principal ──────────────────────────────────────────────────────

export default function MovimentacoesTab() {
  const { supabase, clients } = useApp();

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
  const [exportingZip, setExportingZip] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [showAliases, setShowAliases] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'entradas' | 'saidas'

  // Modal state (apenas qual tx está aberta)
  const [faturaModal, setFaturaModal] = useState(null);
  const [reciboModal, setReciboModal] = useState(null);
  const [ncModal, setNcModal] = useState(null);
  const [ncManualModal, setNcManualModal] = useState(null);
  const [ncManualLoading, setNcManualLoading] = useState(false);
  const [ncManualFaturas, setNcManualFaturas] = useState([]);
  const [internoModal, setInternoModal] = useState(null);
  const [impostoModal, setImpostoModal] = useState(null);
  const [justModal, setJustModal] = useState(null);
  const [addAliasModal, setAddAliasModal] = useState(false);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef(null);

  // ── Upload state (from ReconciliacaoAdmin) ───────────────────────────────────
  const [ficheiros, setFicheiros] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [erro, setErro] = useState(null);
  const [previewTransacoes, setPreviewTransacoes] = useState(null);
  const [previewFilename, setPreviewFilename] = useState('');
  const [selTransacoes, setSelTransacoes] = useState(new Set());
  const [txSearch, setTxSearch] = useState('');
  const [txTipoFiltro, setTxTipoFiltro] = useState('todos');
  const [csvMapping, setCsvMapping] = useState(null);
  const [colMap, setColMap] = useState({ dataCol: '', valorCol: '', descricaoCol: '', debitoCol: '', creditoCol: '', tipoCol: '', modo: 'valor' });
  const [runMonthYear, setRunMonthYear] = useState({});
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (activeRunId === null && allRuns.length > 0) {
      loadRun(undefined);
    }
  }, [activeRunId]);

  // ── Load run data ──────────────────────────────────────────────────────────

  const loadRun = async (overrideRunId) => {
    if (!supabase) return;

    // "Mostrar todos" — load all runs
    if (overrideRunId === undefined && activeRunId === null) {
      setLoading(true);
      try {
        const { data: allRunsData, error: runsErr } = await supabase
          .from('reconciliation_runs')
          .select('id, filename, created_at')
          .order('created_at', { ascending: false })
          .limit(20);

        if (runsErr) { console.error('Erro ao carregar runs:', runsErr); setLoading(false); return; }
        if (!allRunsData?.length) { setLoading(false); return; }

        // Collect all transactions from all runs
        const allTxsMerged = [];
        for (const run of allRunsData) {
          const { data: runTxs } = await supabase
            .from('reconciliation_runs')
            .select('transactions_json')
            .eq('id', run.id)
            .single();
          if (runTxs?.transactions_json) allTxsMerged.push(...runTxs.transactions_json.map(t => ({ ...t, run_id: run.id })));
        }

        setRunId(null);
        setRunData(null);
        setAllTxs(allTxsMerged);
        setAllRuns(allRunsData);

        // Populate runMonthYear for all runs
        for (const run of allRunsData) {
          const { data: runTxs } = await supabase
            .from('reconciliation_runs')
            .select('transactions_json')
            .eq('id', run.id)
            .single();
          if (runTxs?.transactions_json?.length) {
            const monthYear = extractMonthYearName(runTxs.transactions_json);
            if (monthYear) setRunMonthYear(prev => ({ ...prev, [run.id]: monthYear }));
          }
        }

        // Load all linked data for all runs
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
        const { data: fatLinksAllRuns } = await supabase
          .from('fatura_pagamento_links').select('fatura_id, run_id, tx_key, auto_matched').in('run_id', runIds);
        setFaturaLinks(fatLinksAllRuns || []);
        setFaturasData(fats || []);
      } catch (err) { console.error('Erro em loadRun (todos):', err); }
      setLoading(false);
      return;
    }

    let run;
    if (overrideRunId) {
      const { data } = await supabase
        .from('reconciliation_runs')
        .select('id, filename, created_at')
        .eq('id', overrideRunId)
        .single();
      run = data;
    } else if (activeRunId) {
      const { data } = await supabase
        .from('reconciliation_runs')
        .select('id, filename, created_at')
        .eq('id', activeRunId)
        .single();
      run = data;
    }

    if (!run) {
      const { data } = await supabase
        .from('reconciliation_runs')
        .select('id, filename, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
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

    // Load transactions separately
    const { data: runData } = await supabase
      .from('reconciliation_runs')
      .select('transactions_json')
      .eq('id', rid)
      .single();
    const txs = runData?.transactions_json || [];
    setAllTxs(txs);

    // Populate runMonthYear cache
    if (txs.length > 0) {
      const monthYear = extractMonthYearName(txs);
      if (monthYear) setRunMonthYear(prev => ({ ...prev, [rid]: monthYear }));
    }

    const runYear = new Date(run.created_at).getFullYear();
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
    const reciboCount = await runAutoMatchRecibos(
      debitosParaRecibo, rid, salAlsArr, recsArr, rlsArr, setReciboLinks, supabase
    );
    totalCount += reciboCount;

    const matchCount = await runAutoMatch(unresolved, rid, alsArr, clients, intsArr, impsArr, ncsArr, setInternos, setImpostos, setNotasCredito, setFaturaLinks, setPagamentos, supabase, faturaAllKeys, fatsArr);
    totalCount += matchCount;

    const { data: freshNcs } = await supabase.from('entrada_nota_credito_links').select('tx_key, client_id, period').eq('run_id', rid);
    const ncsUpdated = freshNcs || [];
    const linkCount = await runVirtualLinkStep(supabase, rid, txs, fatsArr, ncsUpdated, fatLinksArr, setFaturaLinks);
    totalCount += linkCount;

    if (totalCount > 0) setAutoMatchCount(totalCount);
    setAutoMatching(false);

    const novoBancoFatura = fatsArr.find(f =>
      f.dados?.fornecedor === 'Novo Banco, S.A.' &&
      String(f.dados?.numero_fatura) === '4314117912'
    );
    if (novoBancoFatura) {
      const { data: freshFatLinks } = await supabase
        .from('fatura_pagamento_links')
        .select('fatura_id, tx_key')
        .eq('fatura_id', novoBancoFatura.id)
        .eq('run_id', rid);
      if (freshFatLinks && freshFatLinks.length > 0) {
        updateFaturasPagoIfComplete(fatsArr, freshFatLinks, txs, supabase, rid);
      }
    }

    const { data: freshFatLinks } = await supabase
      .from('fatura_pagamento_links').select('fatura_id, tx_key').eq('run_id', rid);
    const matchedItems = (freshFatLinks || []).map(l => {
      const fat = fatsArr.find(f => f.id === l.fatura_id);
      const tx = txs.find(t => txKey(t) === l.tx_key);
      return { fatura: fat, transacao: tx };
    }).filter(m => m.fatura && m.transacao);
    await autoConfirmarMatched(matchedItems, rid, { matched: matchedItems });
  };

  const handleRunAutoMatch = async () => {
    await loadRun();
  };

  useEffect(() => {
    handleRunAutoMatch();
  }, []);

  useEffect(() => {
    const fetchRuns = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from('reconciliation_runs')
        .select('id, filename, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setAllRuns(data);
    };
    fetchRuns();
  }, []);

  // ── Upload handlers (from ReconciliacaoAdmin) ───────────────────────────────

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    adicionarFicheiros(e.dataTransfer.files);
  };
  const handleFileChange = (e) => {
    adicionarFicheiros(e.target.files);
    e.target.value = '';
  };
  const adicionarFicheiros = (fileList) => {
    setErro(null);
    const validos = [];
    const invalidos = [];
    for (const f of fileList) {
      const ext = f.name.split('.').pop().toLowerCase();
      if (['csv', 'ofx', 'qfx'].includes(ext)) validos.push(f);
      else invalidos.push(f.name);
    }
    if (invalidos.length) setErro(`Formato não suportado: ${invalidos.join(', ')}. Aceites: CSV, OFX, QFX.`);
    if (validos.length) setFicheiros(prev => {
      const existentes = new Set(prev.map(f => f.name));
      return [...prev, ...validos.filter(f => !existentes.has(f.name))];
    });
  };

  const previsar = async () => {
    if (!ficheiros.length) return;
    setPreviewing(true);
    setErro(null);
    setCsvMapping(null);
    const allTx = [];
    let needsMappingData = null;
    for (const f of ficheiros) {
      try {
        const fp = new FormData();
        fp.append('file', f);
        const res = await fetch('/api/reconciliacao/parse', { method: 'POST', body: fp });
        const data = await res.json();
        if (!res.ok) { setErro(data.error || 'Erro ao ler ficheiro.'); continue; }
        if (data.needs_mapping) {
          needsMappingData = data;
          setCsvMapping({ columns: data.columns, preview: data.preview });
          setColMap({ dataCol: '', valorCol: '', descricaoCol: '', debitoCol: '', creditoCol: '', tipoCol: '', modo: 'valor' });
          setPreviewFilename(data.filename || f.name);
          setPreviewing(false);
          return;
        }
        allTx.push(...data.transactions.map(tx => ({ ...tx, _source: f.name })));
      } catch (err) {
        setErro(err.message || 'Erro de rede.');
      }
    }
    if (allTx.length) {
      setPreviewTransacoes(allTx);
      setPreviewFilename(ficheiros.map(f => f.name).join(', '));
      setSelTransacoes(new Set(allTx.map((_, i) => i)));
      setTxSearch('');
      setTxTipoFiltro('todos');
    }
    setFicheiros([]);
    setPreviewing(false);
  };

  const confirmarMapeamento = async () => {
    if (!ficheiros.length) return;
    setPreviewing(true);
    setErro(null);
    try {
      const ficheiroAtual = ficheiros[0];
      const formPayload = new FormData();
      formPayload.append('file', ficheiroAtual);
      formPayload.append('column_mapping', JSON.stringify(colMap));
      const res = await fetch('/api/reconciliacao/parse', { method: 'POST', body: formPayload });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro ao ler ficheiro.'); setPreviewing(false); return; }
      const novasTx = data.transactions.map(tx => ({ ...tx, _source: ficheiroAtual.name }));
      setPreviewTransacoes(novasTx);
      setPreviewFilename(ficheiroAtual.name);
      setSelTransacoes(new Set(novasTx.map((_, i) => i)));
      setTxSearch('');
      setTxTipoFiltro('todos');
      setCsvMapping(null);
      setFicheiros(ficheiros.slice(1));
    } catch (err) {
      setErro(err.message || 'Erro de rede.');
    }
    setPreviewing(false);
  };

  const processar = async () => {
    if (!previewTransacoes) return;
    const selected = previewTransacoes.filter((_, i) => selTransacoes.has(i));
    if (!selected.length) { setErro('Seleccione pelo menos um movimento.'); return; }
    setProcessando(true);
    setErro(null);
    try {
      const res = await fetch('/api/reconciliacao/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions_json: selected, filename: previewFilename }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro ao processar.'); return; }
      setPreviewTransacoes(null);
      setFicheiros([]);
      setActiveRunId(data.run_id);
      setRunId(data.run_id);
      await loadRun(data.run_id);
    } catch (err) {
      setErro(err.message || 'Erro de rede.');
    } finally {
      setProcessando(false);
    }
  };

  async function updateFaturasPagoIfComplete(fatsArr, curFatLinks, txsData, sb, rid) {
    if (!curFatLinks || !curFatLinks.length || !txsData || !txsData.length) return;
    const linkedFatIds = [...new Set(curFatLinks.map(l => l.fatura_id))];

    for (const faturaId of linkedFatIds) {
      const fatura = fatsArr.find(f => f.id === faturaId);
      if (!fatura) continue;
      if (fatura.status === 'PAGO') continue;

      const fornecedor = String(fatura.dados?.fornecedor || '');
      const numFatura = String(fatura.dados?.numero_fatura || '');

      if (fornecedor !== 'Novo Banco, S.A.' || numFatura !== '4314117912') continue;

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

  // ── Auto-match ────────────────────────────────────────────────────────────

  async function runAutoMatchFaturas(debitos, fatsArr, rid, curFatLinks, setFatLinks, sb) {
    if (!debitos.length || !fatsArr.length) return { count: 0, insertedKeys: new Set() };
    const existingKeys = new Set(curFatLinks.map(f => f.tx_key));
    const usedFatIds = new Set(curFatLinks.map(f => f.fatura_id));
    const toInsert = [];

    for (const tx of debitos) {
      const key = txKey(tx);
      if (existingKeys.has(key)) continue;
      const valorTx = Math.abs(parseFloat(tx.valor) || 0);

      let bestFatura = null;
      let bestScore = 0;

      for (const f of fatsArr) {
        if (usedFatIds.has(f.id)) continue;
        const valorFat = parseFloat(f.dados?.valor_total) || 0;
        if (Math.abs(valorTx - valorFat) > 0.01) continue;
        const tokens = normName(f.dados?.fornecedor || '').split(' ').filter(w => w.length >= 3);
        if (tokens.length === 0) continue;
        const descNorm = normName(tx.descricao || '');
        const hits = tokens.filter(t => descNorm.includes(t)).length;
        if (hits >= 1 && hits > bestScore) {
          bestScore = hits;
          bestFatura = f;
        }
      }

      if (!bestFatura) continue;
      existingKeys.add(key);
      usedFatIds.add(bestFatura.id);
      toInsert.push({ fatura_id: bestFatura.id, run_id: rid, tx_key: key, auto_matched: true });
    }

    if (toInsert.length === 0) return { count: 0, insertedKeys: new Set() };
    const { data } = await sb.from('fatura_pagamento_links')
      .upsert(toInsert, { onConflict: 'run_id,tx_key' })
      .select('fatura_id, run_id, tx_key, auto_matched');
    if (data) setFatLinks(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
    return { count: data?.length || 0, insertedKeys: new Set(toInsert.map(r => r.tx_key)) };
  }

  async function runAutoMatchFaturasSplit(debitos, fatsArr, rid, curFatLinks, setFatLinks, sb) {
    if (!debitos.length || !fatsArr.length) return { count: 0, insertedKeys: new Set() };
    const usedFatIds = new Set(curFatLinks.map(f => f.fatura_id));
    const usedTxKeys = new Set(curFatLinks.map(f => f.tx_key));

    const unmatchedDebitos = debitos.filter(tx => !usedTxKeys.has(txKey(tx)));
    const unmatchedFaturas = fatsArr.filter(f => !usedFatIds.has(f.id));

    if (unmatchedDebitos.length === 0 || unmatchedFaturas.length === 0) {
      return { count: 0, insertedKeys: new Set() };
    }

    const debitosPorFornecedor = {};
    for (const tx of unmatchedDebitos) {
      const descNorm = normName(tx.descricao || '');
      const valor = Math.abs(parseFloat(tx.valor) || 0);
      if (!debitosPorFornecedor[descNorm]) debitosPorFornecedor[descNorm] = [];
      debitosPorFornecedor[descNorm].push({ ...tx, _valor: valor });
    }

    const toInsert = [];
    const insertedFatIds = new Set();
    const insertedTxKeys = new Set();

    for (const fatura of unmatchedFaturas) {
      if (insertedFatIds.has(fatura.id)) continue;
      const tokens = normName(fatura.dados?.fornecedor || '').split(' ').filter(w => w.length >= 3);
      if (tokens.length === 0) continue;

      const matchingDebitos = [];
      for (const [descNorm, txs] of Object.entries(debitosPorFornecedor)) {
        const hits = tokens.filter(t => descNorm.includes(t)).length;
        if (hits >= 1) {
          for (const tx of txs) {
            if (!insertedTxKeys.has(txKey(tx))) {
              matchingDebitos.push(tx);
            }
          }
        }
      }

      if (matchingDebitos.length < 2) continue;

      const valorFat = parseFloat(fatura.dados?.valor_total) || 0;
      if (valorFat <= 0) continue;

      const subset = findSubsetSum(matchingDebitos, valorFat);
      if (subset.length > 0) {
        for (const tx of subset) {
          toInsert.push({ fatura_id: fatura.id, run_id: rid, tx_key: txKey(tx), auto_matched: true });
          insertedTxKeys.add(txKey(tx));
        }
        insertedFatIds.add(fatura.id);
      }
    }

    if (toInsert.length === 0) return { count: 0, insertedKeys: new Set() };
    const { data } = await sb.from('fatura_pagamento_links')
      .upsert(toInsert, { onConflict: 'run_id,tx_key' })
      .select('fatura_id, run_id, tx_key, auto_matched');
    if (data) setFatLinks(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
    return { count: data?.length || 0, insertedKeys: new Set(toInsert.map(r => r.tx_key)) };
  }

  async function runAutoMatchRecibos(debitos, rid, salAlsArr, recsArr, curRls, setRls, sb) {
    if (!debitos.length || !recsArr.length) return 0;
    const existingKeys = new Set(curRls.map(r => r.tx_key));
    const toInsert = [];

    const descUpper = (s) => (s || '').toUpperCase();
    const isBancoTx = (tx) => BANCO_KEYWORDS.some(k => descUpper(tx.descricao || '').includes(k));
    const isInternoTx = (tx) => INTERNO_KEYWORDS.some(k => descUpper(tx.descricao || '').includes(k));
    const isImpostoTx = (tx) => IMPOSTO_KEYWORDS.some(k => descUpper(tx.descricao || '').includes(k));

    for (const tx of debitos) {
      const key = txKey(tx);
      if (existingKeys.has(key)) continue;
      if (isBancoTx(tx)) continue;
      if (isInternoTx(tx)) continue;
      if (isImpostoTx(tx)) continue;

      let matchedWorkerName = null;

      // 1. Alias salarial: verifica se algum pattern está na descrição
      for (const alias of salAlsArr) {
        if (!alias.pattern) continue;
        const patternNorm = normWorker(alias.pattern);
        const descNorm = normWorker(tx.descricao);
        if (descNorm.includes(patternNorm)) {
          matchedWorkerName = alias.worker_name;
          break;
        }
      }

      // 2. Token scoring por nome de trabalhador (mais permissivo)
      if (!matchedWorkerName) {
        const descClean = normWorker(tx.descricao)
          .replace(/\bp\/\s*/gi, '')
          .replace(/\bapp\s*\d*/gi, '')
          .replace(/\bapp\b/gi, '')
          .replace(/\d+/g, '')
          .replace(/[-&]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const uniqueWorkers = [...new Map(recsArr.map(r => [normWorker(r.worker_name), r])).values()];
        let bestScore = 0;
        for (const receipt of uniqueWorkers) {
          const score = workerScore(descClean, receipt.worker_name);
          if (score >= 1 && score > bestScore) {
            bestScore = score;
            matchedWorkerName = receipt.worker_name;
          }
        }
      }

      if (!matchedWorkerName) continue;

      const bestReceipt = findBestReceipt(matchedWorkerName, tx.data, recsArr);
      if (!bestReceipt) continue;

      // Calcular mes do link a partir da data da transacção
      // Dias 1-15 → mês anterior | Dias 16-31 → mês da transacção
      const txDay = parseInt(tx.data.split('-')[2]);
      const txYear = parseInt(tx.data.substring(0, 4));
      const txMonth = parseInt(tx.data.substring(5, 7));
      let linkMes;
      if (txDay >= 16) {
        linkMes = tx.data.substring(0, 7);
      } else {
        const prevMonth = txMonth === 1 ? 12 : txMonth - 1;
        const prevYear = txMonth === 1 ? txYear - 1 : txYear;
        linkMes = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
      }

      toInsert.push({
        run_id: rid,
        tx_key: key,
        worker_id: bestReceipt.worker_id || null,
        worker_name: bestReceipt.worker_name,
        mes: linkMes,
        auto_matched: true,
      });
      existingKeys.add(key);
    }

    if (toInsert.length === 0) return 0;
    const { data } = await sb.from('movimentacao_recibo_links').upsert(toInsert, { onConflict: 'run_id,tx_key' }).select('tx_key, worker_id, worker_name, mes, auto_matched');
    if (data) setRls(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
    return data?.length || 0;
  }

  // Step 5: Ligação virtual para comissões bancárias
  // Executa para TODAS as entradas de crédito (não só unresolved)
  // Quando entrada ≠ fatura cliente, verifica se diferença corresponde a fatura de fornecedor
  async function runVirtualLinkStep(sb, rid, txs, fatsArr, ncsArr, curFatLinks, setFatLinks) {
    let count = 0;

    // Só processa créditos que já têm client_id (Step 3 fez match)
    const creditWithClient = txs.filter(tx =>
      tx.tipo === 'credito' &&
      ncsArr.some(n => n.tx_key === txKey(tx))
    );

    for (const tx of creditWithClient) {
      const key = txKey(tx);
      const clientNc = ncsArr.find(n => n.tx_key === key);
      if (!clientNc) continue;

      const valorTx = Math.abs(parseFloat(tx.valor) || 0);

      // Procurar fatura de cliente (tipo=cliente, status=PENDENTE) com valor > tx.valor
      const clienteFatura = fatsArr.find(f =>
        f.tipo === 'cliente' &&
        f.status === 'PENDENTE' &&
        Number(f.dados?.valor_total) > valorTx + 0.01
      );

      if (!clienteFatura) continue;

      const valorFaturaCliente = Math.abs(parseFloat(clienteFatura.dados?.valor_total) || 0);
      const diferenca = valorFaturaCliente - valorTx;

      // Se diferença está entre 0.01 e 500, procurar fatura com valor ≈ diferença
      if (diferenca > 0.01 && diferenca <= 500.00) {
        const comissaoFatura = fatsArr.find(f =>
          (!f.tipo || f.tipo === 'fornecedor') &&
          f.status === 'PENDENTE' &&
          Math.abs(parseFloat(f.dados?.valor_total || 0) - diferenca) <= 0.01
        );

        if (comissaoFatura) {
          // Criar fatura_pagamento_links se ainda não existir
          const jaLinkado = curFatLinks.some(fl => fl.fatura_id === clienteFatura.id && fl.tx_key === key);
          if (!jaLinkado) {
            await sb.from('fatura_pagamento_links').upsert({
              fatura_id: clienteFatura.id,
              run_id: rid,
              tx_key: key,
              auto_matched: true,
            }, { onConflict: 'fatura_id,tx_key' });
          }

          // Atualizar status das faturas para PAGO
          await sb.from('faturas').update({ status: 'PAGO' }).eq('id', clienteFatura.id);
          await sb.from('faturas').update({ status: 'PAGO' }).eq('id', comissaoFatura.id);
          count++;

          // Atualizar state local
          setFatLinks(prev => [...prev, { fatura_id: clienteFatura.id, run_id: rid, tx_key: key, auto_matched: true }]);
        }
      }
    }

    return count;
  }

async function runAutoMatch(unresolved, rid, alsArr, clientList, curInternos, curImpostos, curNcs, setInts, setImpostos, setNcs, setFatLinks, setPags, sb, extraExcludeKeys = new Set(), fatsArr = []) {
    const toInsertInternos = [];
    const toInsertImpostos = [];
    const toInsertNcs = [];
    const toInsertClientes = [];
    const toInsertFaturas = [];
    const existingIntKeys = new Set(curInternos.map(i => i.tx_key));
    const existingImpKeys = new Set(curImpostos.map(i => i.tx_key));
    const existingNcKeys = new Set(curNcs.map(n => n.tx_key));
    const existingPagKeys = new Set();

    for (const tx of unresolved) {
      const key = txKey(tx);
      if (existingIntKeys.has(key) || existingImpKeys.has(key) || existingNcKeys.has(key) || extraExcludeKeys.has(key)) continue;

      const bankName = extractBankName(tx.descricao);
      const bankNorm = normName(bankName);
      const descUpper = String(tx.descricao || '').toUpperCase();

      const alias = alsArr.find(a => {
        const aNorm = normName(a.bank_name);
        return bankNorm.includes(aNorm) || aNorm.includes(bankNorm);
      });
      if (alias) {
        if (alias.resolucao === 'interno') {
          toInsertInternos.push({ run_id: rid, tx_key: key });
          existingIntKeys.add(key);
          continue;
        }
        if (alias.resolucao === 'imposto') {
          toInsertImpostos.push({ run_id: rid, tx_key: key });
          existingImpKeys.add(key);
          continue;
        }
        if (alias.resolucao === 'com_cliente' && alias.client_id && tx.tipo === 'credito') {
          const val = parseFloat(tx.valor) || 0;
          toInsertClientes.push({ run_id: rid, tx_key: key, client_id: alias.client_id, period: previousMonth(tx.data), valor_faturado: val, valor_pago: val });
          existingPagKeys.add(key);
          continue;
        }
        if (alias.resolucao === 'nota_credito' && alias.client_id && tx.tipo === 'credito') {
          toInsertNcs.push({ run_id: rid, tx_key: key, client_id: alias.client_id, period: previousMonth(tx.data) });
          existingNcKeys.add(key);
          continue;
        }
      }

      if (!alias && tx.tipo === 'credito') {
        const matched = matchClientByTokens(tx.descricao, clientList);
        if (matched?.id) {
          const val = parseFloat(tx.valor) || 0;
          toInsertClientes.push({ run_id: rid, tx_key: key, client_id: matched.id, period: previousMonth(tx.data), valor_faturado: val, valor_pago: val });
          existingPagKeys.add(key);
          continue;
        }
      }

      if (INTERNO_KEYWORDS.some(k => descUpper.includes(k))) {
        toInsertInternos.push({ run_id: rid, tx_key: key });
        existingIntKeys.add(key);
        continue;
      }

      if (IMPOSTO_KEYWORDS.some(k => descUpper.includes(k))) {
        toInsertImpostos.push({ run_id: rid, tx_key: key });
        existingImpKeys.add(key);
        continue;
      }

      if (tx.tipo === 'debito' && BANCO_KEYWORDS.some(k => descUpper.includes(k))) {
        const faturaBanco = fatsArr.find(f =>
          f.dados?.fornecedor === 'Novo Banco, S.A.' &&
          String(f.dados?.numero_fatura) === '4314117912'
        );
        if (faturaBanco) {
          toInsertFaturas.push({ fatura_id: faturaBanco.id, run_id: rid, tx_key: key, auto_matched: true });
          existingIntKeys.add(key);
          continue;
        }
        toInsertInternos.push({ run_id: rid, tx_key: key });
        existingIntKeys.add(key);
        continue;
      }

      if (tx.tipo === 'credito' && !existingNcKeys.has(key)) {
        const valorTx = Math.abs(parseFloat(tx.valor) || 0);
        const descNorm = normName(tx.descricao || '');
        for (const f of fatsArr) {
          if (!f.dados?.numero_fatura?.startsWith('NC')) continue;
          const valorFat = Math.abs(parseFloat(f.dados?.valor_total) || 0);
          if (Math.abs(valorTx - valorFat) > 0.01) continue;
          const tokens = normName(f.dados?.fornecedor || '').split(' ').filter(w => w.length >= 3);
          if (tokens.length === 0) continue;
          const hits = tokens.filter(t => descNorm.includes(t)).length;
          if (hits >= 1) {
            toInsertNcs.push({ run_id: rid, tx_key: key, client_id: f.id, period: tx.data.substring(0, 7) });
            existingNcKeys.add(key);
            break;
          }
        }
      }

      if (tx.tipo === 'credito' && !toInsertFaturas.some(f => f.tx_key === key)) {
        const valorTx = Math.abs(parseFloat(tx.valor) || 0);
        const clienteFatura = fatsArr.find(f =>
          f.tipo === 'cliente' &&
          f.status === 'PENDENTE' &&
          Number(f.dados?.valor_total) > valorTx + 0.01
        );
        if (clienteFatura) {
          const valorFaturaCliente = Math.abs(parseFloat(clienteFatura.dados?.valor_total) || 0);
          const diferenca = valorFaturaCliente - valorTx;
          if (diferenca > 0.01 && diferenca <= 500.00) {
            const fornecedorFatura = fatsArr.find(f =>
              (!f.tipo || f.tipo === 'fornecedor') &&
              f.status === 'PENDENTE' &&
              Math.abs(parseFloat(f.dados?.valor_total || 0) - diferenca) <= 0.01
            );
            if (fornecedorFatura) {
              toInsertFaturas.push({ fatura_id: clienteFatura.id, run_id: rid, tx_key: key, auto_matched: true });
              sb.from('faturas').update({ status: 'PAGO' }).eq('id', clienteFatura.id).then(() => {});
              sb.from('faturas').update({ status: 'PAGO' }).eq('id', fornecedorFatura.id).then(() => {});
            }
          }
        }
      }
    }

    let count = 0;
    if (toInsertInternos.length > 0) {
      const { data } = await sb.from('entrada_internos').upsert(toInsertInternos, { onConflict: 'run_id,tx_key' }).select('tx_key');
      if (data) {
        const tagged = data.map(d => ({ ...d, auto_matched: true }));
        setInts(prev => [...prev, ...tagged.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
        count += data.length;
      }
    }
    if (toInsertImpostos.length > 0) {
      const { data } = await sb.from('entrada_impostos').upsert(toInsertImpostos, { onConflict: 'run_id,tx_key' }).select('tx_key');
      if (data) {
        const tagged = data.map(d => ({ ...d, auto_matched: true }));
        setImpostos(prev => [...prev, ...tagged.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
        count += data.length;
      }
    }
if (toInsertNcs.length > 0) {
      const { data } = await sb.from('entrada_nota_credito_links').upsert(toInsertNcs, { onConflict: 'run_id,tx_key' }).select('tx_key, client_id, period, notas');
      if (data) {
        for (const nc of data) {
          await sb.from('faturas').update({ status: 'PAGO' }).eq('id', nc.client_id);
        }
        const tagged = data.map(d => ({ ...d, auto_matched: true }));
        setNcs(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
        count += data.length;
      }
    }
    if (toInsertClientes.length > 0) {
      const { data } = await sb.from('faturacao_clientes_pagamentos').upsert(toInsertClientes, { onConflict: 'run_id,tx_key' }).select('tx_key, client_id, period');
      if (data) {
        setPags(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
        count += data.length;
      }
    }
    if (toInsertFaturas.length > 0) {
      const { data } = await sb.from('fatura_pagamento_links').upsert(toInsertFaturas, { onConflict: 'run_id,tx_key' }).select('fatura_id, run_id, tx_key, auto_matched');
      if (data) {
        setFatLinks(prev => [...prev, ...data.filter(d => !prev.some(p => p.tx_key === d.tx_key))]);
        count += data.length;
      }
    }
    return count;
  }

  // ── Dados derivados ───────────────────────────────────────────────────────

  const creditos = allTxs.filter(t => t.tipo === 'credito');
  const debitos  = allTxs.filter(t => t.tipo === 'debito');
  const filteredTxs = filter === 'entradas' ? creditos : filter === 'saidas' ? debitos : allTxs;

  const getStatus = tx => statusTx(tx, pagamentos, justificacoes, internos, notasCredito, reciboLinks, faturaLinks, impostos);

  const totalResolvido = filteredTxs.filter(tx => getStatus(tx) !== STATUS_KEYS.SEM_CLIENTE).length;
  const semResolver    = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.SEM_CLIENTE).length;
  const totalEntradas  = creditos.reduce((s, tx) => s + Math.abs(parseFloat(tx.valor) || 0), 0);
  const totalSaidas    = debitos.reduce((s, tx) => s + Math.abs(parseFloat(tx.valor) || 0), 0);

  const comClienteCount  = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.COM_CLIENTE).length;
  const comReciboCount   = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.COM_RECIBO).length;
  const comFaturaCount   = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.COM_FATURA).length;
  const notaCreditoCount = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.NOTA_CREDITO).length;
  const internoCount     = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.INTERNO).length;
  const impostoCount     = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.IMPOSTO).length;
  const justCount        = filteredTxs.filter(tx => getStatus(tx) === STATUS_KEYS.JUSTIFICADO).length;

  const grupos = filteredTxs.reduce((acc, tx) => {
    const mes = (tx.data || '').substring(0, 7) || 'Desconhecido';
    (acc[mes] = acc[mes] || []).push(tx);
    return acc;
  }, {});

  const ROW_COLORS = {
    'Com Cliente':   [227, 252, 239],
    'Com Recibo':    [207, 250, 254],
    'Com Fatura':   [254, 235, 222],
    'Nota Crédito': [219, 234, 254],
    'Interno':       [233, 213, 244],
    'Imposto':      [254, 243, 199],
    'Justificado':  [238, 238, 238],
    'Sem Cliente':   [255, 255, 255],
  };

  const buildRowsForTx = (tx) => {
    const status = getStatus(tx);
    const key = txKey(tx);
    const link = clienteLink(tx, pagamentos);
    const ncEntry = notasCredito.find(n => n.tx_key === key);
    const clientName = link ? (clients?.find(c => c.id === link.client_id)?.name || '') : '';
    const justEntry = justificacoes.find(j => j.tx_key === key);
    const detalhe = status === STATUS_KEYS.COM_CLIENTE ? clientName
      : status === STATUS_KEYS.NOTA_CREDITO ? `${clientName || ncEntry?.client_id || ''} · ${fmtMes(ncEntry?.period || '')}`
      : status === STATUS_KEYS.JUSTIFICADO ? (justEntry?.justification || '')
      : '';
    const valor = tx.tipo === 'debito' ? `-${fmtEur(Math.abs(parseFloat(tx.valor) || 0))}` : fmtEur(tx.valor);
    return { status, row: [tx.data, tx.tipo === 'debito' ? 'Saída' : 'Entrada', tx.descricao || '', valor, labelStatus(status, tx.tipo, ncEntry, faturasData, tx.descricao), detalhe] };
  };

  const buildRows = () => filteredTxs.map(tx => {
    const { row } = buildRowsForTx(tx);
    return row;
  });

const calcTotals = (txs) => {
    const totCredito = txs.filter(t => t.tipo === 'credito').reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totDebito = txs.filter(t => t.tipo === 'debito').reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totImposto = txs.filter(t => {
      const key = txKey(t);
      return impostos?.some(i => i.tx_key === key);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totInterno = txs.filter(t => {
      const key = txKey(t);
      return internos?.some(i => i.tx_key === key);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totFatura = txs.filter(t => {
      const key = txKey(t);
      return faturaLinks?.some(f => f.tx_key === key);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totRecibo = txs.filter(t => {
      const key = txKey(t);
      return reciboLinks?.some(r => r.tx_key === key) && !faturaLinks?.some(f => f.tx_key === key);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totCliente = txs.filter(t => {
      const key = txKey(t);
      return clienteLink(t, pagamentos);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totNotaCredito = txs.filter(t => {
      const key = txKey(t);
      return notasCredito?.some(n => n.tx_key === key);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totSemCliente = txs.filter(t => {
      const key = txKey(t);
      return !impostos?.some(i => i.tx_key === key)
        && !internos?.some(i => i.tx_key === key)
        && !faturaLinks?.some(f => f.tx_key === key)
        && !reciboLinks?.some(r => r.tx_key === key)
        && !clienteLink(t, pagamentos)
        && !notasCredito?.some(n => n.tx_key === key)
        && !justificacoes?.some(j => j.tx_key === key);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
    const totJustificado = txs.filter(t => {
      const key = txKey(t);
      return justificacoes?.some(j => j.tx_key === key);
    }).reduce((s, t) => s + parseFloat(t.valor || 0), 0);
return { totCredito, totDebito, totImposto, totInterno, totFatura, totRecibo, totCliente, totNotaCredito, totSemCliente, totJustificado };
  };

  const renderPdfSummary = (doc, y, txs) => {
    const t = calcTotals(txs);
    const linha = (label, valor, r, g, b) => {
      doc.setFillColor(r, g, b);
      doc.rect(14, y, 277, 7, 'F');
      doc.setFontSize(9); doc.setTextColor(30);
      doc.text(label, 16, y + 5);
      doc.setTextColor(0);
      doc.text(fmtEur(valor), 291, y + 5, { align: 'right' });
      y += 8;
    };
    doc.setFontSize(11); doc.setTextColor(30); doc.setFont('helvetica', 'bold');
    doc.text('Resumo', 14, y); y += 6;
    doc.setFont('helvetica', 'normal');
    linha('Total Créditos', t.totCredito, 227, 252, 239);
    linha('Total Débitos', t.totDebito, 254, 235, 222);
    linha(`Com Cliente (${txs.filter(tx => { const k = txKey(tx); return clienteLink(tx, pagamentos); }).length} transações)`, t.totCliente, 227, 252, 239);
    linha(`Nota Crédito (${txs.filter(tx => { const k = txKey(tx); return notasCredito?.some(n => n.tx_key === k); }).length} transações)`, t.totNotaCredito, 219, 234, 254);
    linha(`Com Fatura (${txs.filter(tx => { const k = txKey(tx); return faturaLinks?.some(f => f.tx_key === k); }).length} transações)`, t.totFatura, 254, 235, 222);
    linha(`Com Recibo (${txs.filter(tx => { const k = txKey(tx); return reciboLinks?.some(r => r.tx_key === k); }).length} transações)`, t.totRecibo, 207, 250, 254);
    linha(`Imposto (${txs.filter(tx => { const k = txKey(tx); return impostos?.some(i => i.tx_key === k); }).length} transações)`, t.totImposto, 254, 243, 199);
    linha(`Justificado (${txs.filter(tx => { const k = txKey(tx); return justificacoes?.some(j => j.tx_key === k); }).length} transações)`, t.totJustificado, 238, 238, 238);
    linha(`Sem Cliente (${txs.filter(tx => { const k = txKey(tx); return !impostos?.some(i => i.tx_key === k) && !internos?.some(i => i.tx_key === k) && !faturaLinks?.some(f => f.tx_key === k) && !reciboLinks?.some(r => r.tx_key === k) && !clienteLink(tx, pagamentos) && !notasCredito?.some(n => n.tx_key === k) && !justificacoes?.some(j => j.tx_key === k); }).length} transações)`, t.totSemCliente, 255, 255, 255);
    return y;
  };

  const renderPdfBalance = (doc, y, grupos) => {
    doc.setFontSize(11); doc.setTextColor(30); doc.setFont('helvetica', 'bold');
    doc.text('Balanço Mensal', 14, y); y += 6;
    doc.setFont('helvetica', 'normal');
    const sortedMeses = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
    let acumulado = 0;
    for (const mes of sortedMeses) {
      const mesCred = grupos[mes].filter(t => t.tipo === 'credito').reduce((s, t) => s + parseFloat(t.valor || 0), 0);
      const mesDeb = grupos[mes].filter(t => t.tipo === 'debito').reduce((s, t) => s + parseFloat(t.valor || 0), 0);
      const saldoMes = mesCred - mesDeb;
      acumulado += saldoMes;
      const cor = saldoMes >= 0 ? [227, 252, 239] : [254, 235, 222];
      doc.setFillColor(...cor);
      doc.rect(14, y, 277, 7, 'F');
      doc.setFontSize(9); doc.setTextColor(30);
      doc.text(fmtMes(mes), 16, y + 5);
      doc.setTextColor(saldoMes >= 0 ? 0 : 180);
      doc.text(`+${fmtEur(mesCred)} | -${fmtEur(mesDeb)} | Saldo: ${saldoMes >= 0 ? '+' : ''}${fmtEur(saldoMes)} | Acum: ${acumulado >= 0 ? '+' : ''}${fmtEur(acumulado)}`, 291, y + 5, { align: 'right' });
      y += 8;
    }
    return y;
  };

  const getLogoBase64 = async () => {
    try {
      const response = await fetch('/MAGNETIC (3).png');
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const handleExportCsv = () => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Data', 'Tipo', 'Descrição', 'Valor (€)', 'Status', 'Detalhe'].map(esc).join(';');
    const rows = buildRows().map(r => r.map(esc).join(';'));
    const blob = new Blob(['﻿' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'movimentacoes_validacao.csv'; a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportPdf = async () => {
    const logoBase64 = await getLogoBase64();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    if (logoBase64) doc.addImage(logoBase64, 'PNG', 14, 4, 22, 22);
    doc.setFontSize(14); doc.setTextColor(30);
    doc.text('Relatório de Movimentações', logoBase64 ? 42 : 14, 18);
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} · Extrato: ${runData?.created_at ? new Date(runData.created_at).toLocaleDateString('pt-PT') : '—'}`, logoBase64 ? 42 : 14, 24);

    let currentY = logoBase64 ? 30 : 28;

    const sortedMeses = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
    for (const mes of sortedMeses) {
      const mesTxs = grupos[mes];
      const mesLabel = fmtMes(mes);

      doc.setFontSize(11); doc.setTextColor(30);
      doc.setFillColor(240, 242, 245);
      doc.rect(14, currentY, 277, 7, 'F');
      doc.text(mesLabel, 16, currentY + 5);
      currentY += 10;

      const mesData = mesTxs.map(tx => buildRowsForTx(tx));
      const body = mesData.map(d => d.row);

      autoTable(doc, {
        startY: currentY,
        head: [['Data', 'Tipo', 'Descrição', 'Valor (€)', 'Status', 'Detalhe']],
        body,
        styles: { fontSize: 6.5, cellPadding: 1.5, lineHeight: 1.2 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const status = mesData[data.row.index]?.status;
            if (status && ROW_COLORS[status]) {
              const [r, g, b] = ROW_COLORS[status];
              data.cell.styles.fillColor = [r, g, b];
            }
          }
        },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 16 },
          2: { cellWidth: 60, cellStyles: { overflow: 'linebreak' } },
          3: { cellWidth: 22 },
          4: { cellWidth: 28 },
          5: { cellWidth: 50 },
        },
        margin: { left: 14, right: 14 },
        showHead: 'firstPage',
      });

      currentY = doc.lastAutoTable.finalY + 6;

      if (currentY > 180) { doc.addPage(); currentY = 20; }
    }

    doc.addPage();
    doc.setFontSize(16); doc.setTextColor(30);
    doc.text('Resumo Financeiro', 14, 20);
    let summaryY = renderPdfSummary(doc, 28, filteredTxs);
    doc.addPage();
    doc.setFontSize(16); doc.setTextColor(30);
    doc.text('Balanço Mensal', 14, 20);
    renderPdfBalance(doc, 28, grupos);
    doc.save('movimentacoes_validacao.pdf');
    setShowExportMenu(false);
  };

  const handleExportZip = async () => {
    setExportingZip(true);
    setExportProgress({ current: 0, total: 0 });
    setShowExportMenu(false);
    try {
      const JSZipLib = (await import('jszip')).default;
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const logoBase64 = await getLogoBase64();

      const monthLabel = runData
        ? new Date(runData.created_at).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
        : 'todos';
      const safeMonth = monthLabel.replace(/[^a-zA-Z0-9]/g, '');

      const zip = new JSZipLib();
      const relatorioFolder = zip.folder('relatorio');
      const extratoFolder = zip.folder('extrato');
      const faturasFolder = zip.folder('faturas');
      const mesesFolder = zip.folder('meses');

      // ── Relatório PDF único (sem cores, como antes no ZIP) ──────────────────
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(14); doc.setTextColor(30);
      doc.text('Relatório de Movimentações', 14, 18);
      doc.setFontSize(8); doc.setTextColor(120);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} · Extrato: ${runData?.created_at ? new Date(runData.created_at).toLocaleDateString('pt-PT') : 'Todos'}`, 14, 24);
      const rows = buildRows();
      autoTable(doc, {
        startY: 30,
        head: [['Data', 'Tipo', 'Descrição', 'Valor (€)', 'Status', 'Detalhe']],
        body: rows,
        styles: { fontSize: 6.5, cellPadding: 1.3 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 2: { cellWidth: 55 }, 5: { cellWidth: 45 } },
      });
      relatorioFolder.file('Relatorio_Movimentacoes.pdf', doc.output('blob'));

      // ── PDFs por mês (com cores) ─────────────────────────────────────────────
      const sortedMeses = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
      for (const mes of sortedMeses) {
        const mesTxs = grupos[mes];
        const mesLabel = fmtMes(mes).replace(/[^a-zA-Z0-9]/g, '_');
        const docMes = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        if (logoBase64) docMes.addImage(logoBase64, 'PNG', 14, 4, 22, 22);
        docMes.setFontSize(14); docMes.setTextColor(30);
        docMes.text(`Relatório de Movimentações — ${fmtMes(mes)}`, logoBase64 ? 42 : 14, 18);
        docMes.setFontSize(8); docMes.setTextColor(120);
        docMes.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} · Extrato: ${runData?.created_at ? new Date(runData.created_at).toLocaleDateString('pt-PT') : 'Todos'}`, logoBase64 ? 42 : 14, 24);
        const startY = logoBase64 ? 30 : 28;
        const mesData = mesTxs.map(tx => buildRowsForTx(tx));
        const body = mesData.map(d => d.row);
        autoTable(docMes, {
          startY,
          head: [['Data', 'Tipo', 'Descrição', 'Valor (€)', 'Status', 'Detalhe']],
          body,
          styles: { fontSize: 6.5, cellPadding: 1.5, lineHeight: 1.2 },
          headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
          didParseCell: (data) => {
            if (data.section === 'body') {
              const status = mesData[data.row.index]?.status;
              if (status && ROW_COLORS[status]) {
                const [r, g, b] = ROW_COLORS[status];
                data.cell.styles.fillColor = [r, g, b];
              }
            }
          },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 16 },
            2: { cellWidth: 60, cellStyles: { overflow: 'linebreak' } },
            3: { cellWidth: 22 },
            4: { cellWidth: 28 },
            5: { cellWidth: 50 },
          },
          margin: { left: 14, right: 14 },
          showHead: 'firstPage',
        });
        docMes.addPage();
        docMes.setFontSize(16); docMes.setTextColor(30);
        docMes.text(`Resumo — ${fmtMes(mes)}`, 14, 20);
        renderPdfSummary(docMes, 28, mesTxs);
        mesesFolder.file(`Relatorio_${mesLabel}.pdf`, docMes.output('blob'));
      }

      // ── Extrato CSV ────────────────────────────────────────────────────────
      const txStatus = (tx) => {
        const key = txKey(tx);
        if (clienteLink(tx, pagamentos)) return 'Com Cliente';
        if (notasCredito.some(n => n.tx_key === key)) return 'Nota Crédito';
        if (faturaLinks.some(f => f.tx_key === key)) return 'Com Fatura';
        if (reciboLinks.some(r => r.tx_key === key)) return 'Com Recibo';
        if (internos.some(i => i.tx_key === key)) return 'Interno';
        if (justificacoes.some(j => j.tx_key === key)) return 'Justificado';
        if (pagamentos.some(p => p.tx_key === key)) return 'Com Cliente';
        return 'Sem Cliente';
      };

      const csvLines = ['Data,Tipo,Descrição,Valor (€),Status'];
      for (const tx of allTxs) {
        const status = txStatus(tx);
        csvLines.push(`"${tx.data}","${tx.tipo}","${(tx.descricao || '').replace(/"/g, '""')}","${tx.valor}","${status}"`);
      }
      const csvBlob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      extratoFolder.file('extrato_bancario.csv', csvBlob);

      // ── Extrato PDF (texto real do extrato) ─────────────────────────────────
      const docExtrato = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      docExtrato.setFontSize(16); docExtrato.setTextColor(30);
      docExtrato.text('Extrato Bancário', 14, 18);
      docExtrato.setFontSize(9); docExtrato.setTextColor(120);
      docExtrato.text(`Ficheiro: ${runData?.filename || 'N/A'}  ·  Período: ${monthLabel}  ·  ${allTxs.length} movimentos`, 14, 25);

      const extratoRows = allTxs.map(tx => {
        const signo = tx.tipo === 'credito' ? '+' : '-';
        return [tx.data, tx.tipo === 'credito' ? 'Crédito' : 'Débito', tx.descricao || '', `${signo}${tx.valor}`];
      });

      autoTable(docExtrato, {
        startY: 30,
        head: [['Data', 'Tipo', 'Descrição', 'Valor (€)']],
        body: extratoRows,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 60, 100], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 20 }, 2: { cellWidth: 180 }, 3: { cellWidth: 30 } },
      });

      extratoFolder.file('extrato_bancario.pdf', docExtrato.output('blob'));

      // ── Faturas PDF do storage ─────────────────────────────────────────────
      const linkedFatIds = [...new Set(faturaLinks.map(l => l.fatura_id).filter(Boolean))];
      const faturasNoZip = faturasData.filter(f => linkedFatIds.includes(f.id) && f.storage_path);
      const total = faturasNoZip.length;

      if (total > 0) {
        for (let i = 0; i < faturasNoZip.length; i++) {
          const fat = faturasNoZip[i];
          setExportProgress({ current: i + 1, total });
          const fornecedor = (fat.dados?.fornecedor || 'SEM_FORNECEDOR').replace(/[^a-zA-Z0-9]/g, '_');
          const numero = (fat.dados?.numero_fatura || fat.id).replace(/[^a-zA-Z0-9]/g, '_');
          const filename = `FAT_${fornecedor}_${numero}.pdf`;
          try {
            const { data: pdfBlob, error } = await supabase.storage.from('faturas').download(fat.storage_path);
            if (error || !pdfBlob) {
              console.warn(`Fatura ${fat.id} não acessível:`, error?.message);
              continue;
            }
            faturasFolder.file(filename, pdfBlob);
          } catch (e) {
            console.warn(`Erro ao baixar fatura ${fat.id}:`, e.message);
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `movimentacoes_Extrato_${safeMonth}.zip`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao gerar ZIP:', err);
      alert('Ocorreu um erro ao gerar o ZIP. Tente novamente.');
    } finally {
      setExportingZip(false);
      setExportProgress({ current: 0, total: 0 });
    }
  };

  // ── Acções: Interno ───────────────────────────────────────────────────────

  const handleConfirmarInterno = async (tx, { saveAlias, aliasName }) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('entrada_internos').upsert({ run_id: effectiveRunId, tx_key: key }, { onConflict: 'run_id,tx_key' });
    setInternos(prev => [...prev.filter(i => i.tx_key !== key), { tx_key: key }]);

    if (saveAlias && aliasName.trim()) {
      const { data: newAlias } = await supabase
        .from('movimentacoes_aliases')
        .upsert({ bank_name: aliasName.trim(), resolucao: 'interno', client_id: null }, { onConflict: 'bank_name' })
        .select('id, bank_name, resolucao, client_id')
        .single();
      if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => a.bank_name !== aliasName.trim())]);
    }
  };

  const handleDesfazerInterno = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('entrada_internos').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setInternos(prev => prev.filter(i => i.tx_key !== key));
  };

  // ── Acções: Imposto ───────────────────────────────────────────────────────────

  const handleConfirmarImposto = async (tx, { saveAlias, aliasName }) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('entrada_impostos').upsert({ run_id: effectiveRunId, tx_key: key }, { onConflict: 'run_id,tx_key' });
    setImpostos(prev => [...prev.filter(i => i.tx_key !== key), { tx_key: key }]);

    if (saveAlias && aliasName.trim()) {
      const { data: newAlias } = await supabase
        .from('movimentacoes_aliases')
        .upsert({ bank_name: aliasName.trim(), resolucao: 'imposto', client_id: null }, { onConflict: 'bank_name' })
        .select('id, bank_name, resolucao, client_id')
        .single();
      if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => a.bank_name !== aliasName.trim())]);
    }
  };

  const handleDesfazerImposto = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('entrada_impostos').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setImpostos(prev => prev.filter(i => i.tx_key !== key));
  };

  // ── Acções: Cliente / Fatura ──────────────────────────────────────────────

  const handleOpenAcaoCliente = (tx) => setNcModal(tx);

  const handleSaveAcaoCliente = async (tx, { clientId, period, notas, saveAlias, aliasName }) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    const existing = pagamentos.find(p => p.tx_key === key);
    if (existing) {
      await supabase.from('faturacao_clientes_pagamentos').update({ client_id: clientId, period }).eq('id', existing.id);
    } else {
      await supabase.from('faturacao_clientes_pagamentos').insert({
        run_id: effectiveRunId,
        tx_key: key,
        client_id: clientId,
        period,
      });
    }
    const { data: refreshed } = await supabase
      .from('faturacao_clientes_pagamentos')
      .select('tx_key, client_id, period, run_id')
      .eq('run_id', effectiveRunId);
    setPagamentos(refreshed || []);

    if (saveAlias && aliasName.trim()) {
      const { data: newAlias } = await supabase
        .from('movimentacoes_aliases')
        .upsert({ bank_name: aliasName.trim(), resolucao: 'com_cliente', client_id: clientId }, { onConflict: 'bank_name' })
        .select('id, bank_name, resolucao, client_id')
        .single();
      if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => a.bank_name !== aliasName.trim())]);
    }
  };

  const handleDesfazerCliente = async (tx) => {
    const key = txKey(tx);
    const existingPag = pagamentos.find(p => p.tx_key === key);
    if (existingPag) {
      await supabase.from('faturacao_clientes_pagamentos').delete().eq('id', existingPag.id);
      setPagamentos(prev => prev.filter(p => p.id !== existingPag.id));
      return;
    }
    const existingNc = notasCredito.find(n => n.tx_key === key);
    if (existingNc) {
      await supabase.from('entrada_nota_credito_links').delete().eq('id', existingNc.id);
      setNotasCredito(prev => prev.filter(n => n.id !== existingNc.id));
    }
  };

  const handleOpenNcManual = async (tx) => {
    setNcManualModal(tx);
    setNcManualFaturaId('');
    setNcManualLoading(true);
    const { data } = await supabase
      .from('faturas')
      .select('id, dados')
      .order('importado_em', { ascending: false });
    const ncFaturas = (data || []).filter(f => f.dados?.numero_fatura?.startsWith('NC'));
    setNcManualFaturas(ncFaturas);
    setNcManualLoading(false);
  };

  const handleSaveNcManual = async (tx, faturaId) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    const existing = notasCredito.find(n => n.tx_key === key);
    if (existing) {
      await supabase.from('entrada_nota_credito_links').update({ client_id: faturaId }).eq('id', existing.id);
    } else {
      const { error: ncError } = await supabase.from('entrada_nota_credito_links').upsert({
        run_id: effectiveRunId,
        tx_key: key,
        client_id: faturaId,
        period: previousMonth(tx.data),
      }, { onConflict: 'run_id,tx_key' });
      if (ncError && ncError.code !== '23505') {
        console.error('[handleSaveNcManual] nc insert failed:', ncError);
      }
    }
    const { error: faturaError } = await supabase.from('faturas').update({ status: 'PAGO' }).eq('id', faturaId);
    if (faturaError) {
      console.error('[handleSaveNcManual] fatura update failed:', faturaError);
    } else {
      setFaturasData(prev => prev.map(f => f.id === faturaId ? { ...f, status: 'PAGO' } : f));
    }
    const { data: refreshed } = await supabase
      .from('entrada_nota_credito_links')
      .select('id, tx_key, client_id, period')
      .eq('run_id', effectiveRunId);
    setNotasCredito(refreshed || []);
  };

  // ── Acções: Justificação ──────────────────────────────────────────────────

  const handleSaveJustificacao = async (tx, justText) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    const { data, error } = await supabase
      .from('entrada_justifications')
      .upsert({ run_id: effectiveRunId, tx_key: key, justification: justText.trim() }, { onConflict: 'run_id,tx_key' })
      .select('tx_key, justification')
      .single();
    if (!error && data) {
      setJustificacoes(prev => [...prev.filter(j => j.tx_key !== data.tx_key), data]);
    }
  };

  const handleRemoverJustificacao = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('entrada_justifications').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setJustificacoes(prev => prev.filter(j => j.tx_key !== key));
  };

  // ── Acções: Aliases ───────────────────────────────────────────────────────

  const handleApagarAlias = async (id) => {
    await supabase.from('movimentacoes_aliases').delete().eq('id', id);
    setAliases(prev => prev.filter(a => a.id !== id));
  };

  // ── Acções: Recibo ────────────────────────────────────────────────────────

  const handleOpenAcaoRecibo = (tx) => setReciboModal(tx);

  const handleSaveAcaoRecibo = async (tx, { workerName, workerId, mes }) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    const tipo = (() => {
      const txDay = parseInt(tx.data.split('-')[2]);
      return (txDay >= 1 && txDay <= 6) || txDay >= 16 ? 'Adiantamento' : 'Liquidação';
    })();
    const { data, error } = await supabase
      .from('movimentacao_recibo_links')
      .upsert(
        { run_id: effectiveRunId, tx_key: key, worker_id: workerId || null, worker_name: workerName, mes, tipo, auto_matched: false },
        { onConflict: 'run_id,tx_key' }
      )
      .select('tx_key, worker_id, worker_name, mes, tipo, auto_matched')
      .single();
    if (!error && data) {
      setReciboLinks(prev => [...prev.filter(r => r.tx_key !== data.tx_key), data]);
    }
  };

  const handleDesfazerRecibo = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('movimentacao_recibo_links').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setReciboLinks(prev => prev.filter(r => r.tx_key !== key));
  };

  // ── Acções: Fatura ────────────────────────────────────────────────────────

  const handleOpenAcaoFatura = (tx) => setFaturaModal(tx);

  const handleSaveAcaoFatura = async (tx, faturaSelId) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);
    await supabase.from('fatura_pagamento_links').delete().eq('tx_key', key);
    const { data, error } = await supabase
      .from('fatura_pagamento_links')
      .insert({ fatura_id: faturaSelId, run_id: effectiveRunId, tx_key: key, auto_matched: false })
      .select('fatura_id, run_id, tx_key, auto_matched')
      .single();
    if (!error && data) {
      setFaturaLinks(prev => [...prev.filter(f => f.tx_key !== data.tx_key && f.fatura_id !== data.fatura_id), data]);
    }
  };

  const handleDesfazerFatura = async (tx) => {
    const effectiveRunId = tx.run_id || runId;
    if (!effectiveRunId) return;
    const key = txKey(tx);

    // Restore fatura to PENDENTE before deleting link
    const link = faturaLinks.find(f => f.tx_key === key);
    if (link?.fatura_id) {
      await supabase.from('faturas').update({ status: 'PENDENTE' }).eq('id', link.fatura_id);
    }

    await supabase.from('fatura_pagamento_links').delete().eq('run_id', effectiveRunId).eq('tx_key', key);
    setFaturaLinks(prev => prev.filter(f => f.tx_key !== key));
  };

  const handleSaveNovoAlias = async ({ aliasName, resolucao, clientId }) => {
    const { data: newAlias } = await supabase
      .from('movimentacoes_aliases')
      .upsert(
        { bank_name: aliasName.trim(), resolucao, client_id: resolucao === 'nota_credito' ? clientId : null },
        { onConflict: 'bank_name' }
      )
      .select('id, bank_name, resolucao, client_id')
      .single();
    if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => a.bank_name !== aliasName.trim())]);
  };

  // ── Auto-confirmar todos os matches de um run ────────────────────────────
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
        const payload = { status: 'PAGO' };
        payload.dados = { ...existente, data_pagamento: dataPagamento };
        return supabase.from('faturas').update(payload).eq('id', m.fatura.id);
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
      await supabase.from('reconciliation_runs').update({
        results_json: { ...(fullResults || {}), matched: newMatched },
      }).eq('id', runId);
    }

    return newMatched;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // Upload / Preview zone
  if (ficheiros.length > 0 || previewTransacoes) {
    return (
      <div className="space-y-3">
        {ficheiros.length > 0 && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-indigo-200 p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <Upload size={28} className="text-indigo-400" />
              <p className="text-sm font-semibold text-slate-700">{ficheiros.length} ficheiro(s) pronto(s) para processar</p>
              <p className="text-xs text-slate-400">{ficheiros.map(f => f.name).join(', ')}</p>
              <div className="flex gap-2">
                <button onClick={() => setFicheiros([])} className="px-4 py-2 text-xs font-bold uppercase tracking-widest border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">Cancelar</button>
                <button onClick={previsar} disabled={previewing} className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                  {previewing ? <Loader2 size={13} className="animate-spin" /> : null}
                  Pré-visualizar
                </button>
              </div>
            </div>
          </div>
        )}
        {csvMapping && (
          <div className="bg-white rounded-2xl border border-indigo-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-indigo-700">Mapeamento de Colunas — {previewFilename}</p>
              <button onClick={() => { setCsvMapping(null); setFicheiros([]); }} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">Cancelar</button>
            </div>
            <p className="text-[10px] text-slate-500">Selecione qual coluna corresponde a cada campo:</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Data</label>
                <select value={colMap.dataCol} onChange={e => setColMap(p => ({ ...p, dataCol: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                  <option value="">— Selecionar —</option>
                  {(csvMapping.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Valor</label>
                <select value={colMap.valorCol} onChange={e => setColMap(p => ({ ...p, valorCol: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                  <option value="">— Selecionar —</option>
                  {(csvMapping.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Descrição</label>
                <select value={colMap.descricaoCol} onChange={e => setColMap(p => ({ ...p, descricaoCol: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                  <option value="">— Selecionar —</option>
                  {(csvMapping.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Tipo (opcional)</label>
                <select value={colMap.tipoCol} onChange={e => setColMap(p => ({ ...p, tipoCol: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                  <option value="">— Nenhum —</option>
                  {(csvMapping.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Débito (opcional)</label>
                <select value={colMap.debitoCol} onChange={e => setColMap(p => ({ ...p, debitoCol: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                  <option value="">— Nenhum —</option>
                  {(csvMapping.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Crédito (opcional)</label>
                <select value={colMap.creditoCol} onChange={e => setColMap(p => ({ ...p, creditoCol: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                  <option value="">— Nenhum —</option>
                  {(csvMapping.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {csvMapping.preview && csvMapping.preview.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Pré-visualização (primeiras 3 linhas)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] border border-slate-100 rounded-lg">
                    <thead>
                      <tr className="bg-slate-50">
                        {(csvMapping.columns || []).map(c => <th key={c} className="px-2 py-1 text-slate-500 font-bold">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {csvMapping.preview.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          {(csvMapping.columns || []).map(c => <td key={c} className="px-2 py-1 text-slate-600">{String(row[c] || '')}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <button
              onClick={confirmarMapeamento}
              disabled={previewing || !colMap.dataCol || (!colMap.valorCol && !colMap.debitoCol) || !colMap.descricaoCol}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
            >
              {previewing ? <Loader2 size={13} className="animate-spin" /> : null}
              Confirmar Mapeamento
            </button>
          </div>
        )}
        {previewTransacoes && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">{previewFilename}</p>
              <div className="flex gap-2">
                <button onClick={() => { setPreviewTransacoes(null); setFicheiros([]); }} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">Cancelar</button>
                <button onClick={processar} disabled={processando} className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                  {processando ? <Loader2 size={11} className="animate-spin" /> : null}
                  Processar
                </button>
              </div>
            </div>
            <div className="flex gap-2 mb-2">
              <input type="text" placeholder="Filtrar descrição…" value={txSearch} onChange={e => setTxSearch(e.target.value)} className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl" />
              <select value={txTipoFiltro} onChange={e => setTxTipoFiltro(e.target.value)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl">
                <option value="todos">Todos</option>
                <option value="credito">Entradas</option>
                <option value="debito">Saídas</option>
              </select>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {previewTransacoes.filter(tx => {
                const matchSearch = !txSearch || tx.descricao?.toLowerCase().includes(txSearch.toLowerCase());
                const matchTipo = txTipoFiltro === 'todos' || tx.tipo === txTipoFiltro;
                return matchSearch && matchTipo;
              }).map((tx, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${selTransacoes.has(i) ? 'bg-indigo-50 border border-indigo-200' : 'bg-slate-50 border border-transparent'}`}>
                  <input type="checkbox" checked={selTransacoes.has(i)} onChange={e => { const s = new Set(selTransacoes); e.target.checked ? s.add(i) : s.delete(i); setSelTransacoes(s); }} className="accent-indigo-600" />
                  <span className="w-20 text-slate-500">{tx.data}</span>
                  <span className={`w-16 text-right font-bold ${tx.tipo === 'credito' ? 'text-emerald-600' : 'text-rose-600'}`}>{parseFloat(tx.valor || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} €</span>
                  <span className="flex-1 truncate text-slate-600">{tx.descricao}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {erro && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600">
            <X size={14} /> {erro}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
        <p className="text-[11px] text-slate-400">A carregar movimentações do extrato…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Upload zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`bg-white rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}
      >
        <input ref={inputRef} type="file" accept=".csv,.ofx,.qfx" multiple onChange={handleFileChange} className="hidden" />
        <div className="flex flex-col items-center gap-2">
          <Upload size={24} className={dragging ? 'text-indigo-500' : 'text-slate-400'} />
          <p className="text-sm font-semibold text-slate-600">
            {dragging ? 'Largue o ficheiro aqui' : 'Arraste CSV, OFX ou QFX ou clique para selecionar'}
          </p>
          <p className="text-[10px] text-slate-400">Suporta múltiplos ficheiros</p>
        </div>
      </div>

      {/* Filtros: Todas | Entradas | Saídas */}
      <div className="flex items-center gap-1.5">
        {[
          { key: 'all',      label: 'Todas',    count: allTxs.length },
          { key: 'entradas', label: 'Entradas', count: creditos.length, icon: TrendingUp,   color: 'text-emerald-600' },
          { key: 'saidas',   label: 'Saídas',   count: debitos.length,  icon: TrendingDown, color: 'text-rose-600' },
        ].map(({ key, label, count, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              filter === key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {Icon && <Icon size={11} className={filter === key ? 'text-white' : color} />}
            {label}
            {count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${filter === key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {count}
              </span>
            )}
          </button>
        ))}

        {/* Botão Atualizar Match */}
        <button
          onClick={handleRunAutoMatch}
          disabled={autoMatching}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {autoMatching ? (
            <><Loader2 size={11} className="animate-spin" /> A procurar...</>
          ) : (
            <><RefreshCw size={11} /> Atualizar Match</>
          )}
        </button>
      </div>

      {/* Run selector */}
      {allRuns.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase">Extrato:</span>
            <select
              value={activeRunId || ''}
              onChange={e => {
                const id = e.target.value;
                setActiveRunId(id || null);
                if (id) loadRun(id);
              }}
              className="flex-1 text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl px-3 py-1.5 max-w-xs"
            >
<option value="">Mostrar todos</option>
              {allRuns.map(r => (
                <option key={r.id} value={r.id}>
                  {runMonthYear[r.id] || extractMonthYearName(r.transactions_json) || r.filename || 'Extrato'} — {new Date(r.created_at).toLocaleDateString('pt-PT')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {allRuns.map(r => (
              <div key={r.id} className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold border ${activeRunId === r.id ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                <button
                  onClick={() => { setActiveRunId(r.id); loadRun(r.id); }}
                  className="hover:underline"
                >
                  {runMonthYear[r.id] || extractMonthYearName(r.transactions_json) || r.filename || 'Extrato'}
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm('Apagar este extrato? As faturas confirmadas voltarão a PENDENTE.')) return;
                    const runId = r.id;

                    // Buscar matched do run
                    const { data: runData } = await supabase
                      .from('reconciliation_runs')
                      .select('results_json')
                      .eq('id', runId)
                      .single();

                    if (runData?.results_json?.matched?.length) {
                      const faturaMatches = runData.results_json.matched
                        .filter(m => m.fatura?.fonte !== 'recibo' && m.fatura?.id);
                      const reciboMatches = runData.results_json.matched
                        .filter(m => m.fatura?.fonte === 'recibo' && m.fatura?.id);

                      if (faturaMatches.length) {
                        const porStatus = {};
                        for (const m of faturaMatches) {
                          const st = m.fatura.status_original || 'PENDENTE';
                          if (!porStatus[st]) porStatus[st] = [];
                          porStatus[st].push(m.fatura.id);
                        }
                        await Promise.all(
                          Object.entries(porStatus).map(([st, ids]) =>
                            supabase.from('faturas').update({ status: st }).in('id', ids)
                          )
                        );
                      }

                      if (reciboMatches.length) {
                        const porEstado = {};
                        for (const m of reciboMatches) {
                          const est = m.fatura.estado_original || 'valido';
                          if (!porEstado[est]) porEstado[est] = [];
                          porEstado[est].push(m.fatura.id);
                        }
                        await Promise.all(
                          Object.entries(porEstado).map(([est, ids]) =>
                            supabase.from('receipt_validations').update({ estado: est }).in('id', ids)
                          )
                        );
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

                    // Apagar associações
                    await supabase.from('faturacao_clientes_pagamentos').delete().eq('run_id', runId);
                    await supabase.from('fatura_pagamento_links').delete().eq('run_id', runId);
                    await supabase.from('entrada_justifications').delete().eq('run_id', runId);
                    await supabase.from('entrada_internos').delete().eq('run_id', runId);
                    await supabase.from('entrada_nota_credito_links').delete().eq('run_id', runId);
                    await supabase.from('movimentacao_recibo_links').delete().eq('run_id', runId);

                    // Apagar o run
                    await supabase.from('reconciliation_runs').delete().eq('id', runId);

                    setAllRuns(prev => prev.filter(x => x.id !== runId));
                    if (activeRunId === runId) { setActiveRunId(null); setRunId(null); setAllTxs([]); }
                  }}
                  className="ml-1 text-rose-400 hover:text-rose-600"
                  title="Apagar extrato"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="flex items-start justify-between gap-3">
        <div className="grid grid-cols-3 gap-3 flex-1">
          {[
            { label: 'Total',        value: filteredTxs.length, color: 'text-slate-700',   bg: 'bg-slate-50' },
            { label: 'Resolvidos',   value: totalResolvido,     color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Por Resolver', value: semResolver,        color: 'text-amber-700',   bg: 'bg-amber-50' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-2xl px-4 py-3 text-center`}>
              <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={() => setShowAliases(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${showAliases ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700'}`}
          >
            <Tag size={13} /> Aliases {aliases.length > 0 && `(${aliases.length})`}
          </button>
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setShowExportMenu(v => !v)}
              className="w-full flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <Download size={13} /> Exportar
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 py-1 z-20 min-w-[130px]">
                <button onClick={handleExportCsv}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                  <FileText size={13} className="text-emerald-600" /> CSV
                </button>
                <button onClick={handleExportPdf}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                  <FileText size={13} className="text-rose-500" /> PDF
                </button>
                <button onClick={handleExportZip} disabled={exportingZip}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  {exportingZip ? <Loader2 size={13} className="animate-spin text-indigo-600" /> : <FileArchive size={13} className="text-indigo-600" />}
                  {exportingZip ? `ZIP ${exportProgress.current}/${exportProgress.total}` : 'ZIP'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Totais de entradas/saídas */}
      {(filter === 'all' || filter === 'entradas' || filter === 'saidas') && (
        <div className="flex gap-2">
          {filter !== 'saidas' && totalEntradas > 0 && (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5">
              <TrendingUp size={11} className="text-emerald-600" />
              <span className="text-[10px] font-black text-emerald-700">+{fmtEur(totalEntradas)}</span>
            </div>
          )}
          {filter !== 'entradas' && totalSaidas > 0 && (
            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-xl px-3 py-1.5">
              <TrendingDown size={11} className="text-rose-600" />
              <span className="text-[10px] font-black text-rose-700">-{fmtEur(totalSaidas)}</span>
            </div>
          )}
        </div>
      )}

      {/* Breakdown dos resolvidos */}
      {totalResolvido > 0 && (
        <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
          {comClienteCount > 0 && <span className="text-emerald-600">{comClienteCount} Com Cliente/Fatura</span>}
          {comReciboCount > 0 && <><span>·</span><span className="text-teal-600">{comReciboCount} Com Recibo</span></>}
          {comFaturaCount > 0 && <><span>·</span><span className="text-orange-600">{comFaturaCount} Com Fatura Doc</span></>}
          {notaCreditoCount > 0 && <><span>·</span><span className="text-blue-600">{notaCreditoCount} Com Nota de Crédito</span></>}
          {internoCount > 0 && <><span>·</span><span className="text-purple-600">{internoCount} Interno</span></>}
          {impostoCount > 0 && <><span>·</span><span className="text-amber-600">{impostoCount} Imposto</span></>}
          {justCount > 0 && <><span>·</span><span className="text-violet-600">{justCount} Justificados</span></>}
        </div>
      )}

      {/* Auto-match */}
      {autoMatching && (
        <div className="flex items-center gap-2 text-[10px] text-indigo-500 font-bold">
          <Loader2 size={12} className="animate-spin" /> A executar auto-match…
        </div>
      )}
      {autoMatchCount !== null && autoMatchCount > 0 && !autoMatching && (
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-2">
          <Zap size={13} className="text-indigo-500 flex-shrink-0" />
          <p className="text-[10px] font-bold text-indigo-700">
            Auto-match: {autoMatchCount} transacç{autoMatchCount !== 1 ? 'ões resolvidas' : 'ão resolvida'} automaticamente
          </p>
          <button onClick={() => setAutoMatchCount(null)} className="ml-auto text-indigo-300 hover:text-indigo-500">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Painel de aliases */}
      {showAliases && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Aliases de Movimentações</p>
            <button
              onClick={() => { setAddAliasModal(true); setAddAliasName(''); setAddAliasResolucao('interno'); setAddAliasClientId(''); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
            >
              <Plus size={11} /> Alias
            </button>
          </div>
          {aliases.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-6">Nenhum alias guardado ainda.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {aliases.map(a => {
                const clientName = a.client_id ? (clients?.find(c => c.id === a.client_id)?.name || a.client_id) : null;
                const cfg = a.resolucao === 'interno' ? STATUS_CFG['Interno'] : STATUS_CFG['Nota Crédito'];
                const Icon = cfg.icon;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.text} flex-shrink-0`}>
                      <Icon size={9} /> {a.resolucao === 'interno' ? 'Interno' : a.resolucao === 'com_cliente' ? 'Com Cliente' : 'NC'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 truncate" title={a.bank_name}>{a.bank_name}</p>
                      {clientName && <p className="text-[9px] text-slate-400">{clientName}</p>}
                    </div>
                    <button onClick={() => handleApagarAlias(a.id)}
                      className="text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {runData && (
        <p className="text-[10px] text-slate-400">
          Extrato importado em {new Date(runData.created_at).toLocaleDateString('pt-PT')} · {creditos.length} entradas · {debitos.length} saídas
        </p>
      )}

      {/* Lista por mês */}
      {Object.keys(grupos).length === 0 ? (
        <p className="text-center text-slate-400 py-8 text-sm">Nenhuma transacção encontrada.</p>
      ) : (
        Object.entries(grupos)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([mes, txs]) => (
            <MovMesCard
              key={mes}
              mes={mes}
              txs={txs}
              pagamentos={pagamentos}
              justificacoes={justificacoes}
              internos={internos}
              notasCredito={notasCredito}
              reciboLinks={reciboLinks}
              clients={clients}
              faturaLinks={faturaLinks}
              impostos={impostos}
              faturasData={faturasData}
              onJustificar={tx => { setJustModal(tx); setJustText(''); }}
              onRemoverJustificacao={handleRemoverJustificacao}
              onMarcarInterno={tx => { setInternoModal(tx); setInternoSaveAlias(false); }}
              onDesfazerInterno={handleDesfazerInterno}
              onMarcarImposto={tx => setImpostoModal(tx)}
              onDesfazerImposto={handleDesfazerImposto}
              onAcaoCliente={handleOpenAcaoCliente}
              onDesfazerCliente={handleDesfazerCliente}
              onOpenNcManual={handleOpenNcManual}
              onAcaoRecibo={handleOpenAcaoRecibo}
              onDesfazerRecibo={handleDesfazerRecibo}
              onAcaoFatura={handleOpenAcaoFatura}
              onDesfazerFatura={handleDesfazerFatura}
              onSelectRun={id => { setActiveRunId(id); loadRun(id); }}
            />
          ))
      )}

      {internoModal && <InternoModal tx={internoModal} onClose={() => setInternoModal(null)} onSave={handleConfirmarInterno} />}
      {impostoModal && <ImpostoModal tx={impostoModal} onClose={() => setImpostoModal(null)} onSave={handleConfirmarImposto} />}
      {justModal && <JustModal tx={justModal} onClose={() => setJustModal(null)} onSave={handleSaveJustificacao} />}
      {faturaModal && <FaturaModal tx={faturaModal} faturasData={faturasData} faturaLinks={faturaLinks} onClose={() => setFaturaModal(null)} onSave={handleSaveAcaoFatura} />}
      {reciboModal && <ReciboModal tx={reciboModal} receipts={receipts} onClose={() => setReciboModal(null)} onSave={handleSaveAcaoRecibo} />}
      {ncModal && <NcModal tx={ncModal} clients={clients} onClose={() => setNcModal(null)} onSave={handleSaveAcaoCliente} />}
      {ncManualModal && <NcManualModal tx={ncManualModal} faturas={ncManualFaturas} loading={ncManualLoading} onClose={() => setNcManualModal(null)} onSave={handleSaveNcManual} />}
      {addAliasModal && <AddAliasModal clients={clients} onClose={() => setAddAliasModal(false)} onSave={handleSaveNovoAlias} />}
    </div>
  );
}
