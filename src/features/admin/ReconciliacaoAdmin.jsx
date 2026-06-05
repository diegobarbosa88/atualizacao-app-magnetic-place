import React, { useState, useEffect, useRef } from 'react';
import {
  Landmark, Upload, CheckCircle, X, ChevronDown, ChevronUp,
  AlertCircle, Clock, FileText, Loader2, Plus, ArrowLeftRight,
  Trash2, RefreshCw, Tag, Download, Unlink, Pencil, Link2
} from 'lucide-react';
import RelatorioModal from './RelatorioModal';
import CsvMappingCard from './CsvMappingCard';
import TagBadge from './TagBadge';
import TipoBadge from './TipoBadge';
import AssociacaoManualModal from './reconciliacao/AssociacaoManualModal';
import OrfaoBancoModal from './reconciliacao/OrfaoBancoModal';
import AssocClienteModal from './reconciliacao/AssocClienteModal';
import { extractMonthYearName, previousMonth, matchClientByTokens } from './movimentacoes/txUtils';

import { useApp } from '../../context/AppContext';

const COR_MAP = {
  violet:  { bg: 'bg-violet-100',  text: 'text-violet-700',  ring: 'ring-violet-400',  dot: 'bg-violet-500'  },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-400', dot: 'bg-emerald-500' },
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-700',    ring: 'ring-blue-400',    dot: 'bg-blue-500'    },
  orange:  { bg: 'bg-orange-100',  text: 'text-orange-700',  ring: 'ring-orange-400',  dot: 'bg-orange-500'  },
  slate:   { bg: 'bg-slate-100',   text: 'text-slate-600',   ring: 'ring-slate-400',   dot: 'bg-slate-500'   },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-700',    ring: 'ring-rose-400',    dot: 'bg-rose-500'    },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-700',   ring: 'ring-amber-400',   dot: 'bg-amber-500'   },
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-700',  ring: 'ring-indigo-400',  dot: 'bg-indigo-500'  },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-700',    ring: 'ring-cyan-400',    dot: 'bg-cyan-500'    },
  gray:    { bg: 'bg-gray-100',    text: 'text-gray-600',    ring: 'ring-gray-400',    dot: 'bg-gray-400'    },
};
const CORES_DISPONIVEIS = ['indigo', 'violet', 'emerald', 'blue', 'cyan', 'orange', 'amber', 'rose', 'slate', 'gray'];

export default function ReconciliacaoAdmin() {
  const { supabase, clients } = useApp();

  // ── Upload state ──────────────────────────────────────────────────────────
  const [ficheiros, setFicheiros] = useState([]);         // File[]
  const [previewErrors, setPreviewErrors] = useState([]); // { filename, error }[]
  const [dragging, setDragging] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [erro, setErro] = useState(null);
  const inputRef = useRef(null);

  // ── Preview / seleção de movimentos ───────────────────────────────────────
  const [previewTransacoes, setPreviewTransacoes] = useState(null); // null = não em preview
  const [previewFilename, setPreviewFilename] = useState('');
  const [selTransacoes, setSelTransacoes] = useState(new Set());
  const [txSearch, setTxSearch] = useState('');
  const [txTipoFiltro, setTxTipoFiltro] = useState('todos'); // 'todos' | 'debito' | 'credito'

  // ── Edição inline de descrição na pré-visualização ───────────────────────
  const [editingTxIdx, setEditingTxIdx] = useState(null);

  // ── Edição inline de descrição nos resultados (histórico/run actual) ──────
  const [editingResultDesc, setEditingResultDesc] = useState(null); // { section, index, value }

  // ── Mapeamento de colunas CSV ─────────────────────────────────────────────
  const [csvMapping, setCsvMapping] = useState(null); // { columns, preview } quando needs_mapping
  const [colMap, setColMap] = useState({ dataCol: '', valorCol: '', descricaoCol: '', debitoCol: '', creditoCol: '', tipoCol: '', modo: 'valor' });

  // ── Resultados ────────────────────────────────────────────────────────────
  const [resultado, setResultado] = useState(null);      // resposta da API
  const [activeSubTab, setActiveSubTab] = useState('matched'); // matched | orphan_bank | orphan_system
  const [confirmando, setConfirmando] = useState(new Set()); // IDs em processo
  const [selMatched, setSelMatched] = useState(new Set());    // índices seleccionados em Reconciliados
  const [selOrphan, setSelOrphan] = useState(new Set());      // índices seleccionados em Órfãos Banco
  const [confirmedOrphans, setConfirmedOrphans] = useState(new Set()); // índices confirmados órfãos
  const [orphanObservacoes, setOrphanObservacoes] = useState({}); // { [index]: string }
  const [pendingOrphanConfirm, setPendingOrphanConfirm] = useState(null); // { indices: number[] }
  const [bulkConfirmando, setBulkConfirmando] = useState(false);
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [selHistorico, setSelHistorico] = useState(new Set());
  const [relatorioRuns, setRelatorioRuns] = useState(null);
  const [aliases, setAliases] = useState([]);
  const [showAliases, setShowAliases] = useState(false);
  const [loadingMultiRel, setLoadingMultiRel] = useState(false);

  // ── Classificação de Órfãos ───────────────────────────────────────────────
  const [tags, setTags] = useState([]);
  const [orphanClassificacoes, setOrphanClassificacoes] = useState({}); // { [index]: { nome, cor } }

  // ── Associação Manual ────────────────────────────────────────────────────
  const [pendingAssociacao, setPendingAssociacao] = useState(null); // { index, transacao }
  const [assocFaturas, setAssocFaturas] = useState([]);
  const [loadingAssoc, setLoadingAssoc] = useState(false);

  // ── Histórico ─────────────────────────────────────────────────────────────
  const [historico, setHistorico] = useState([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [runSelecionado, setRunSelecionado] = useState(null); // run do histórico a ver
  const [reprocessando, setReprocessando] = useState(null); // id do run a reprocessar

  // ── Formulário inserção manual ─────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'fatura', valor: '', data_documento: '', descricao: '', entidade: '', fonte: 'manual'
  });
  const [savingFatura, setSavingFatura] = useState(false);

  // ── Auto-associação de entradas a clientes ────────────────────────────────
  const [autoAssociando, setAutoAssociando] = useState(false);

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

  // ── Associação a Cliente (Faturação) ──────────────────────────────────────
  const [assocClienteModal, setAssocClienteModal] = useState(null); // { section, index, tx, runId, defaultPeriod }
  const [assocSaving, setAssocSaving] = useState(false);
  const [pagamentosLinks, setPagamentosLinks] = useState([]); // faturacao_clientes_pagamentos para o run actual

  const carregarPagamentosLinks = async (runId) => {
    if (!supabase || !runId) return;
    const { data } = await supabase
      .from('faturacao_clientes_pagamentos')
      .select('*')
      .eq('reconciliation_run_id', runId);
    setPagamentosLinks(data || []);
  };

  const linkKey = (section, index) => `${section}_${index}`;
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

  // Carregar histórico e tags ao montar
  useEffect(() => {
    carregarHistorico();
    carregarTags();
  }, []);

  // Carregar links de cliente quando muda o run activo
  useEffect(() => {
    const runId = runSelecionado?.id ?? resultado?.run_id;
    if (runId) carregarPagamentosLinks(runId);
    else setPagamentosLinks([]);
  }, [runSelecionado?.id, resultado?.run_id]);

  // Restaurar estado de confirmações ao mudar de run (histórico ou novo upload)
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
  }, [runSelecionado?.id, resultado?.run_id]);

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

  const carregarHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const [{ data, error }, { data: aliasData }] = await Promise.all([
        supabase
          .from('reconciliation_runs')
          .select('id, created_at, filename, transaction_count, matched_count, orphan_bank_count, orphan_system_count, transactions_json')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('reconciliacao_entity_aliases').select('*').order('created_at', { ascending: false }),
      ]);
      if (!error) setHistorico(data || []);
      setAliases(aliasData || []);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const apagarRun = async (e, runId) => {
    e.stopPropagation();
    if (!window.confirm('Apagar esta importação? As faturas confirmadas voltarão a PENDENTE.')) return;
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

      // Reverter cada fatura para o seu status original (PENDENTE por defeito para runs antigos)
      if (faturaMatches.length) {
        const porStatus = {};
        for (const m of faturaMatches) {
          const st = m.fatura.status_original || 'PENDENTE';
          if (!porStatus[st]) porStatus[st] = [];
          porStatus[st].push(m.fatura.id);
        }
        const results = await Promise.all(
          Object.entries(porStatus).map(([st, ids]) =>
            supabase.from('faturas').update({ status: st }).in('id', ids)
          )
        );
        const fatErr = results.find(r => r.error);
        if (fatErr) { alert(`Erro ao reverter faturas: ${fatErr.error.message}`); return; }
      }

      // Reverter cada recibo para o seu estado original (valido ou aviso)
      if (reciboMatches.length) {
        const porEstado = {};
        for (const m of reciboMatches) {
          const est = m.fatura.estado_original || 'valido';
          if (!porEstado[est]) porEstado[est] = [];
          porEstado[est].push(m.fatura.id);
        }
        const results = await Promise.all(
          Object.entries(porEstado).map(([est, ids]) =>
            supabase.from('receipt_validations').update({ estado: est }).in('id', ids)
          )
        );
        const recErr = results.find(r => r.error);
        if (recErr) { alert(`Erro ao reverter recibos: ${recErr.error.message}`); return; }
      }
    }
    // Limpar data_pagamento das faturas confirmadas via este run
    if (runData?.results_json?.matched?.length) {
      const fatIds = runData.results_json.matched
        .filter(m => m.fatura?.fonte !== 'recibo' && m.fatura?.id)
        .map(m => m.fatura.id);
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

    // Apagar registos de associação de clientes ligados a este run
    await supabase.from('faturacao_clientes_pagamentos').delete().eq('reconciliation_run_id', runId);

    // Apagar links de faturas e reset status das faturas para PENDENTE
    const { data: linksFaturas } = await supabase
      .from('fatura_pagamento_links')
      .select('fatura_id')
      .eq('run_id', runId);
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
      const res = await fetch('/api/reconciliacao/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Erro ao reprocessar.'); return; }
      // Limpar links antigos (índices mudaram) e recriar auto-associações
      await supabase.from('faturacao_clientes_pagamentos').delete().eq('reconciliation_run_id', runId);
      await autoAssociarEntradas({ matched: data.matched, orphan_bank: data.orphan_bank }, runId);
      await carregarPagamentosLinks(runId);
      // Actualizar contadores no histórico
      setHistorico(prev => prev.map(r => r.id === runId
        ? { ...r, matched_count: data.matched_count, orphan_bank_count: data.orphan_bank_count, orphan_system_count: data.orphan_system_count }
        : r
      ));
      // Se este run estava seleccionado, actualizar resultados visíveis
      if (runSelecionado?.id === runId) {
        setRunSelecionado(prev => ({
          ...prev,
          matched_count: data.matched_count,
          orphan_bank_count: data.orphan_bank_count,
          orphan_system_count: data.orphan_system_count,
          results_json: { matched: data.matched, orphan_bank: data.orphan_bank, orphan_system: data.orphan_system },
        }));
      }
      // Se é o resultado activo corrente, actualizar também
      if (resultado?.run_id === runId) {
        setResultado(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      alert(err.message || 'Erro de rede.');
    } finally {
      setReprocessando(null);
    }
  };

  // ── Drag & Drop handlers ──────────────────────────────────────────────────
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
      if (['csv', 'ofx', 'qfx', 'pdf'].includes(ext)) validos.push(f);
      else invalidos.push(f.name);
    }
    if (invalidos.length) setErro(`Formato não suportado: ${invalidos.join(', ')}. Aceites: CSV, OFX, QFX, PDF.`);
    if (validos.length) setFicheiros(prev => {
      const existentes = new Set(prev.map(f => f.name));
      return [...prev, ...validos.filter(f => !existentes.has(f.name))];
    });
  };

  // ── Etapa 1: pré-visualizar movimentos do extrato ────────────────────────
  const previsar = async () => {
    if (!ficheiros.length) return;
    setPreviewing(true);
    setErro(null);
    setPreviewErrors([]);
    const allTx = [];
    const errors = [];
    const multiSource = ficheiros.length > 1;
    for (let idx = 0; idx < ficheiros.length; idx++) {
      const f = ficheiros[idx];
      try {
        const fp = new FormData();
        fp.append('file', f);
        const res = await fetch('/api/reconciliacao/parse', { method: 'POST', body: fp });
        const data = await res.json();
        if (!res.ok) { errors.push({ filename: f.name, error: data.error || 'Erro ao ler' }); continue; }
        if (data.needs_mapping) {
          // Guardar restantes para depois do mapeamento
          const remaining = ficheiros.slice(idx + 1);
          if (allTx.length) {
            setPreviewTransacoes(allTx);
            setSelTransacoes(new Set(allTx.map((_, i) => i)));
          }
          setFicheiros([f, ...remaining]);
          setCsvMapping({ columns: data.columns, preview: data.preview });
          setColMap({ dataCol: '', valorCol: '', descricaoCol: '', debitoCol: '', creditoCol: '', tipoCol: '', modo: 'valor' });
          setPreviewFilename(data.filename);
          if (errors.length) setPreviewErrors(errors);
          setPreviewing(false);
          return;
        }
        allTx.push(...data.transactions.map(tx => ({ ...tx, _source: multiSource ? f.name : undefined })));
      } catch (err) {
        errors.push({ filename: f.name, error: err.message || 'Erro de rede' });
      }
    }
    if (errors.length) setPreviewErrors(errors);
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

  // ── Confirmar mapeamento de colunas e re-parsear ──────────────────────
  const confirmarMapeamento = async () => {
    if (!ficheiros.length) return;
    const ficheiroAtual = ficheiros[0];
    const restantes = ficheiros.slice(1);
    const mapping = { ...colMap };
    setPreviewing(true);
    setErro(null);
    try {
      const formPayload = new FormData();
      formPayload.append('file', ficheiroAtual);
      formPayload.append('column_mapping', JSON.stringify(mapping));
      const res = await fetch('/api/reconciliacao/parse', { method: 'POST', body: formPayload });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro ao ler ficheiro.'); return; }
      const novasTx = data.transactions.map(tx => ({ ...tx, _source: restantes.length || previewTransacoes?.length ? ficheiroAtual.name : undefined }));
      const merged = [...(previewTransacoes || []), ...novasTx];
      setCsvMapping(null);
      setPreviewTransacoes(merged);
      setSelTransacoes(new Set(merged.map((_, i) => i)));
      setTxSearch('');
      setTxTipoFiltro('todos');
      // Continuar com ficheiros restantes
      if (restantes.length) {
        setFicheiros(restantes);
      } else {
        setFicheiros([]);
      }
    } catch (err) {
      setErro(err.message || 'Erro de rede.');
    } finally {
      setPreviewing(false);
    }
  };

  // ── Etapa 2: processar movimentos seleccionados ────────────────────────
  const processar = async () => {
    if (!previewTransacoes) return;
    const selected = previewTransacoes.filter((_, i) => selTransacoes.has(i));
    if (!selected.length) { setErro('Seleccione pelo menos um movimento.'); return; }
    setProcessando(true);
    setErro(null);
    setResultado(null);
    try {
      const res = await fetch('/api/reconciliacao/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions_json: selected, filename: previewFilename }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro ao processar.'); return; }
      setResultado(data);
      setActiveSubTab('matched');
      setPreviewTransacoes(null);
      setFicheiros([]);
      carregarHistorico();
      if (data.run_id) {
        await autoAssociarEntradas(data, data.run_id);
        const fullResults = { matched: data.matched || [], orphan_bank: data.orphan_bank || [], orphan_system: data.orphan_system || [] };
        const newMatched = await autoConfirmarMatched(data.matched || [], data.run_id, fullResults);
        setResultado(prev => ({ ...prev, matched: newMatched }));
        await carregarPagamentosLinks(data.run_id);
      }
    } catch (err) {
      setErro(err.message || 'Erro de rede.');
    } finally {
      setProcessando(false);
    }
  };

  // ── Auto-confirmar todos os matches de um run ────────────────────────────
  // Marca como PAGO todas as faturas/recibos reconciliados que ainda não estão pagos.
  // fullResults: { matched, orphan_bank, orphan_system } — passado directamente para
  // evitar depender do React state (que pode ainda não ter sido actualizado).
  const autoConfirmarMatched = async (matchedItems, runId, fullResults) => {
    if (!supabase || !matchedItems?.length) return matchedItems;

    // Faturas (não recibos) com transacao.data — candidatas a receber data_pagamento
    const faturaItemsComData = matchedItems.filter(
      m => m.fatura?.id && m.fatura?.fonte !== 'recibo' && m.transacao?.data
    );

    // Faturas que ainda não estão PAGO — precisam de ser confirmadas
    const porConfirmar = matchedItems.filter(
      m => m.fatura?.id && m.fatura?.status !== 'PAGO' && m.rule !== 'confirmed_manual'
    );
    const faturasPorConfirmar = porConfirmar.filter(m => m.fatura.fonte !== 'recibo');
    const recibosPorConfirmar = porConfirmar.filter(m => m.fatura.fonte === 'recibo');

    // Batch-read dados para TODAS as faturas que vão ser actualizadas
    // (inclui faturas sem transacao.data para não apagar dados existentes ao fazer spread)
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

    // Faturas já PAGO que ainda não têm data_pagamento mas têm data de transação
    const semDataPagamento = faturaItemsComData.filter(
      m => m.fatura.status === 'PAGO' && !dadosMap[m.fatura.id]?.data_pagamento
    );
    // Faturas já PAGO sem data_pagamento E sem data de transação — usar hoje como fallback
    const pagasSemDataNenhuma = matchedItems.filter(
      m => m.fatura?.id && m.fatura?.fonte !== 'recibo' &&
        m.fatura.status === 'PAGO' && !m.transacao?.data && !dadosMap[m.fatura.id]?.data_pagamento
    );

    const hoje = new Date().toISOString().slice(0, 10);
    await Promise.all([
      // Confirmar como PAGO; usa data da transação, ou data já existente em dados, ou hoje como último recurso
      ...faturasPorConfirmar.map(m => {
        const existente = dadosMap[m.fatura.id] || {};
        const dataPagamento = m.transacao?.data || existente.data_pagamento || hoje;
        const payload = { status: 'PAGO' };
        payload.dados = { ...existente, data_pagamento: dataPagamento };
        return supabase.from('faturas').update(payload).eq('id', m.fatura.id);
      }),
      // Para faturas já PAGO mas sem data_pagamento, gravar a data da transação
      ...semDataPagamento.map(m => supabase.from('faturas').update({
        dados: { ...(dadosMap[m.fatura.id] || {}), data_pagamento: m.transacao.data },
      }).eq('id', m.fatura.id)),
      // Para faturas já PAGO sem data_pagamento e sem transacao.data, usar hoje
      ...pagasSemDataNenhuma.map(m => supabase.from('faturas').update({
        dados: { ...(dadosMap[m.fatura.id] || {}), data_pagamento: hoje },
      }).eq('id', m.fatura.id)),
      // Confirmar recibos pendentes
      ...recibosPorConfirmar.map(m =>
        supabase.from('receipt_validations').update({ estado: 'pago' }).eq('id', m.fatura.id)
      ),
    ]);

    if (!porConfirmar.length && !semDataPagamento.length && !pagasSemDataNenhuma.length) return matchedItems;

    // Array actualizado com status PAGO
    const confirmedIds = new Set(porConfirmar.map(m => m.fatura.id));
    const newMatched = matchedItems.map(m =>
      confirmedIds.has(m.fatura?.id) ? { ...m, fatura: { ...m.fatura, status: 'PAGO' } } : m
    );

    // Persistir status actualizado no run usando fullResults (não depende do React state)
    if (runId && confirmedIds.size > 0) {
      const base = fullResults ?? runSelecionado?.results_json ?? resultado ?? {};
      await supabase.from('reconciliation_runs').update({
        results_json: { ...base, matched: newMatched },
      }).eq('id', runId);
    }

    return newMatched;
  };

  // ── Confirmar Pagamento (individual, não-bulk per D-10) ────────────────────
  const confirmarPagamento = async (faturaId, fonte, txDate) => {
    setConfirmando(prev => new Set(prev).add(faturaId));
    try {
      if (fonte === 'recibo') {
        const { error } = await supabase
          .from('receipt_validations')
          .update({ estado: 'pago' })
          .eq('id', faturaId);
        if (error) throw error;
      } else {
        // Ler dados existentes para fazer merge (não sobrescrever)
        const { data: f } = await supabase.from('faturas').select('dados').eq('id', faturaId).single();
        const dadosExistentes = f?.dados || {};
        // Prioridade: data da transação → data já gravada → hoje como último recurso
        const dataPagamento = txDate || dadosExistentes.data_pagamento || new Date().toISOString().slice(0, 10);
        const dadosUpdate = { dados: { ...dadosExistentes, data_pagamento: dataPagamento } };
        const { error } = await supabase
          .from('faturas')
          .update({ status: 'PAGO', ...dadosUpdate })
          .eq('id', faturaId);
        if (error) throw error;
      }
      const updateMatched = matched => matched.map(m =>
        m.fatura?.id === faturaId ? { ...m, fatura: { ...m.fatura, status: 'PAGO' } } : m
      );

      // Actualizar estado local
      const runId = runSelecionado?.id ?? resultado?.run_id;
      let newMatched;
      if (runSelecionado) {
        newMatched = updateMatched(runSelecionado.results_json.matched || []);
        setRunSelecionado(prev => ({
          ...prev,
          results_json: { ...prev.results_json, matched: newMatched },
        }));
      } else {
        newMatched = updateMatched(resultado?.matched || []);
        setResultado(prev => ({ ...prev, matched: newMatched }));
      }

      // Persistir no results_json do run para que o histórico reflicta o status
      if (runId) {
        const baseResults = runSelecionado?.results_json ?? {
          matched: resultado?.matched || [],
          orphan_bank: resultado?.orphan_bank || [],
          orphan_system: resultado?.orphan_system || [],
        };
        await supabase
          .from('reconciliation_runs')
          .update({ results_json: { ...baseResults, matched: newMatched } })
          .eq('id', runId);
      }
    } catch (err) {
      alert(`Erro ao confirmar pagamento: ${err.message}`);
    } finally {
      setConfirmando(prev => { const s = new Set(prev); s.delete(faturaId); return s; });
    }
  };

  // ── Bulk: confirmar pagamento para seleccionados em Reconciliados ─────────
  const confirmarBulkMatched = async () => {
    if (!selMatched.size) return;
    setBulkConfirmando(true);
    try {
      const allDisplayItems = [...((runSelecionado ? runSelecionado.results_json : resultado)?.matched || []), ...clientAssocMatched];
      const selectedItems = allDisplayItems.filter((_, i) => selMatched.has(i));

      const faturaSelected = selectedItems.filter(m => m.fatura?.id && m.fatura?.status !== 'PAGO' && m.rule !== 'confirmed_manual');
      const entradaSelected = selectedItems.filter(m => m.rule === 'client_association' && !m.confirmed_entrada);

      if (!faturaSelected.length && !entradaSelected.length) return;

      // Deduplicate faturas por ID
      const seenIds = new Set();
      const uniqueFaturas = faturaSelected.filter(m => { if (seenIds.has(m.fatura.id)) return false; seenIds.add(m.fatura.id); return true; });
      const allFaturaIds = uniqueFaturas.map(m => m.fatura.id);
      if (allFaturaIds.length) setConfirmando(new Set(allFaturaIds));

      // Ler dados existentes de TODAS as faturas (não só as com transacao.data)
      const faturaIdsNaoRecibo = uniqueFaturas.filter(i => i.fatura.fonte !== 'recibo').map(i => i.fatura.id);
      let dadosMap = {};
      if (faturaIdsNaoRecibo.length) {
        const { data: faturasAtuals } = await supabase
          .from('faturas').select('id, dados').in('id', faturaIdsNaoRecibo);
        dadosMap = Object.fromEntries((faturasAtuals || []).map(f => [f.id, f.dados]));
      }

      // Confirmar faturas em paralelo; só grava data_pagamento se há data real
      const hojeB = new Date().toISOString().slice(0, 10);
      await Promise.all(uniqueFaturas.map(item => {
        if (item.fatura.fonte === 'recibo')
          return supabase.from('receipt_validations').update({ estado: 'pago' }).eq('id', item.fatura.id);
        const existenteB = dadosMap[item.fatura.id] || {};
        const dataPagamento = item.transacao?.data || existenteB.data_pagamento || hojeB;
        const payload = { status: 'PAGO', dados: { ...existenteB, data_pagamento: dataPagamento } };
        return supabase.from('faturas').update(payload).eq('id', item.fatura.id);
      }));

      // Construir results_json actualizado (faturas + entradas num único update)
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

  // ── Confirmar movimento em Órfãos Banco — abre modal para observação ────────
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

    // Actualizar estado imediatamente (optimistic)
    if (runSelecionado) {
      setRunSelecionado(prev => ({ ...prev, results_json: newResults }));
    } else {
      setResultado(prev => ({ ...prev, matched: newMatched, orphan_bank: newOrphanBank }));
    }

    const { error } = await supabase
      .from('reconciliation_runs')
      .update({ results_json: newResults })
      .eq('id', runId);
    if (error) console.error('Erro ao persistir confirmação:', error.message);
  };

  // ── Associação Manual de Órfão Banco a Fatura ────────────────────────────
  const abrirAssociarFatura = async (index, transacao) => {
    setPendingAssociacao({ index, transacao });
    setAssocSearch('');
    setLoadingAssoc(true);
    try {
      const [{ data: faturas }, { data: recibos }] = await Promise.all([
        supabase
          .from('faturas')
          .select('id, tipo, valor, data_documento, descricao, entidade, status, fonte, dados, filename')
          .not('status', 'eq', 'PAGO')
          .order('data_documento', { ascending: false })
          .limit(100),
        supabase
          .from('receipt_validations')
          .select('id, worker_name, liquido_extraido, mes, estado')
          .not('estado', 'eq', 'pago')
          .limit(100),
      ]);
      const recibosNorm = (recibos || []).map(r => ({
        id: r.id,
        tipo: 'recibo',
        fonte: 'recibo',
        valor: r.liquido_extraido,
        data_documento: null,
        descricao: `Recibo ${r.worker_name || ''} ${r.mes || ''}`.trim(),
        entidade: r.worker_name || '',
        status: r.estado,
        estado_original: r.estado,
        dados: null,
        filename: null,
      }));
      setAssocFaturas([...(faturas || []), ...recibosNorm]);
    } finally {
      setLoadingAssoc(false);
    }
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

    const sourceBank = runSelecionado
      ? (runSelecionado.results_json?.orphan_bank || [])
      : (resultado?.orphan_bank || []);
    const sourceMatched = runSelecionado
      ? (runSelecionado.results_json?.matched || [])
      : (resultado?.matched || []);
    const sourceSystem = runSelecionado
      ? (runSelecionado.results_json?.orphan_system || [])
      : (resultado?.orphan_system || []);

    const newOrphanBank = sourceBank.filter((_, i) => i !== index);
    const newMatched = [...sourceMatched, novoMatch];
    const newOrphanSystem = sourceSystem.filter(s => s.fatura?.id !== fatura.id);

    const baseResults = runSelecionado?.results_json ?? {
      matched: resultado?.matched || [],
      orphan_bank: resultado?.orphan_bank || [],
      orphan_system: resultado?.orphan_system || [],
    };
    const newResults = {
      ...baseResults,
      matched: newMatched,
      orphan_bank: newOrphanBank,
      orphan_system: newOrphanSystem,
    };

    const { error } = await supabase
      .from('reconciliation_runs')
      .update({
        results_json: newResults,
        matched_count: newMatched.length,
        orphan_bank_count: newOrphanBank.length,
        orphan_system_count: newOrphanSystem.length,
      })
      .eq('id', runId);
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
        matched: newMatched,
        orphan_bank: newOrphanBank,
        orphan_system: newOrphanSystem,
        matched_count: newMatched.length,
        orphan_bank_count: newOrphanBank.length,
        orphan_system_count: newOrphanSystem.length,
      }));
    }
    setHistorico(prev => prev.map(r => r.id === runId
      ? { ...r, matched_count: newMatched.length, orphan_bank_count: newOrphanBank.length, orphan_system_count: newOrphanSystem.length }
      : r
    ));
    if (saveAlias && fatura.entidade) {
      const bankName = extractEntityFromDescUI(transacao.descricao || '');
      const { data: newAlias } = await supabase
        .from('reconciliacao_entity_aliases')
        .upsert({ bank_name: bankName, system_entity: fatura.entidade }, { onConflict: 'bank_name,system_entity' })
        .select()
        .single();
      if (newAlias) setAliases(prev => [newAlias, ...prev.filter(a => !(a.bank_name === bankName && a.system_entity === fatura.entidade))]);
    }
    setPendingAssociacao(null);
  };

  // ── Extracção de entidade para UI (espelho da lógica do engine) ────────────
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

  const apagarAlias = async (id) => {
    await supabase.from('reconciliacao_entity_aliases').delete().eq('id', id);
    setAliases(prev => prev.filter(a => a.id !== id));
  };

  // ── Guardar fatura manual ─────────────────────────────────────────────────
  const guardarFatura = async () => {
    if (!formData.valor || !formData.data_documento) {
      alert('Valor e data são obrigatórios.');
      return;
    }
    setSavingFatura(true);
    try {
      const { error } = await supabase.from('faturas').insert({
        tipo: formData.tipo,
        valor: parseFloat(formData.valor),
        data_documento: formData.data_documento,
        descricao: formData.descricao,
        entidade: formData.entidade,
        fonte: 'manual',
        status: 'PENDENTE',
        gmail_message_id: `manual-${Date.now()}`, // campo NOT NULL do schema original
        filename: `manual-${Date.now()}.txt`,
        storage_path: '',
        url: '',
      });
      if (error) throw error;
      setShowForm(false);
      setFormData({ tipo: 'fatura', valor: '', data_documento: '', descricao: '', entidade: '', fonte: 'manual' });
    } catch (err) {
      alert(`Erro ao guardar fatura: ${err.message}`);
    } finally {
      setSavingFatura(false);
    }
  };

  // ── Desvincular match ────────────────────────────────────────────────────
  const [desvinculando, setDesvinculando] = useState(new Set());

  // Remove o registo de faturacao_clientes_pagamentos para (section, index)
  // e decrementa os índices de todos os registos subsequentes da mesma secção.
  const limparEReindexarLinks = async (runId, section, removedIndex) => {
    if (!runId) return;
    await supabase
      .from('faturacao_clientes_pagamentos')
      .delete()
      .eq('reconciliation_run_id', runId)
      .eq('transaction_section', section)
      .eq('transaction_index', removedIndex);
    const { data: posteriores } = await supabase
      .from('faturacao_clientes_pagamentos')
      .select('id, transaction_index')
      .eq('reconciliation_run_id', runId)
      .eq('transaction_section', section)
      .gt('transaction_index', removedIndex);
    if (posteriores?.length) {
      await Promise.all(posteriores.map(p =>
        supabase.from('faturacao_clientes_pagamentos')
          .update({ transaction_index: p.transaction_index - 1 })
          .eq('id', p.id)
      ));
    }
  };

  const desvincularMatch = async (matchItem, matchIndex) => {
    const key = `${matchIndex}`;
    setDesvinculando(prev => new Set(prev).add(key));
    try {
      const runId = runSelecionado?.id ?? resultado?.run_id;
      const base = runSelecionado?.results_json ?? {
        matched: resultado?.matched || [],
        orphan_bank: resultado?.orphan_bank || [],
        orphan_system: resultado?.orphan_system || [],
      };

      const newMatched      = base.matched.filter((_, i) => i !== matchIndex);
      const newOrphanBank   = [...base.orphan_bank, { transacao: matchItem.transacao, reason: 'desvinculado' }];
      const newOrphanSystem = matchItem.fatura
        ? [...base.orphan_system, { fatura: matchItem.fatura, reason: 'desvinculado' }]
        : base.orphan_system;
      const newResults = { matched: newMatched, orphan_bank: newOrphanBank, orphan_system: newOrphanSystem };

      // Reverter status se estiver PAGO
      if (matchItem.fatura?.status === 'PAGO') {
        if (matchItem.fatura.fonte === 'recibo') {
          await supabase.from('receipt_validations')
            .update({ estado: matchItem.fatura.estado_original || 'valido' })
            .eq('id', matchItem.fatura.id);
        } else {
          await supabase.from('faturas').update({ status: 'PENDENTE' }).eq('id', matchItem.fatura.id);
        }
      }

      if (runId) {
        await supabase.from('reconciliation_runs').update({
          results_json: newResults,
          matched_count: newMatched.length,
          orphan_bank_count: newOrphanBank.length,
          orphan_system_count: newOrphanSystem.length,
        }).eq('id', runId);
        // Apagar registo e reindexar matched após remoção
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

  // ── Excluir item de um run ───────────────────────────────────────────────
  const [excluindo, setExcluindo] = useState(new Set());

  const excluirItem = async (section, index) => {
    const key = `${section}_${index}`;
    setExcluindo(prev => new Set(prev).add(key));
    try {
      const runId = runSelecionado?.id ?? resultado?.run_id;
      const base = runSelecionado?.results_json ?? {
        matched: resultado?.matched || [],
        orphan_bank: resultado?.orphan_bank || [],
        orphan_system: resultado?.orphan_system || [],
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
          results_json: newResults,
          matched_count: newMatched.length,
          orphan_bank_count: newOrphanBank.length,
          orphan_system_count: newOrphanSystem.length,
        }).eq('id', runId);
        // Apagar registo e reindexar secção após remoção (orphan_system não tem links)
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

  // ── Confirmar entrada (client_association sem fatura) ───────────────────────
  const [confirmandoEntrada, setConfirmandoEntrada] = useState(new Set());

  const confirmarEntrada = async (item, displayIndex) => {
    setConfirmandoEntrada(prev => new Set(prev).add(displayIndex));
    try {
      const runId = runSelecionado?.id ?? resultado?.run_id;
      const base = runSelecionado?.results_json ?? {
        matched: resultado?.matched || [],
        orphan_bank: resultado?.orphan_bank || [],
        orphan_system: resultado?.orphan_system || [],
      };

      // Encontrar o item em orphan_bank pelo índice original e marcá-lo como confirmado
      const newOrphanBank = (base.orphan_bank || []).map((ob, idx) =>
        idx === item._orig_index ? { ...ob, confirmed_entrada: true } : ob
      );
      const newResults = { ...base, orphan_bank: newOrphanBank };

      if (runId) {
        await supabase.from('reconciliation_runs')
          .update({ results_json: newResults })
          .eq('id', runId);
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

  // ── Guardar descrição editada nos resultados ──────────────────────────────
  const saveResultDescricao = async (section, index, newDesc) => {
    setEditingResultDesc(null);
    const runId = runSelecionado?.id ?? resultado?.run_id;
    const base = runSelecionado?.results_json ?? {
      matched: resultado?.matched || [],
      orphan_bank: resultado?.orphan_bank || [],
      orphan_system: resultado?.orphan_system || [],
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

  // ── Render helpers ────────────────────────────────────────────────────────
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

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black flex items-center gap-2">
          <Landmark size={24} className="text-indigo-600" /> Reconciliação Bancária
        </h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
        >
          <Plus size={14} /> Inserir Fatura Manual
        </button>
      </div>

      {/* Formulário inserção manual */}
      {showForm && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nova Fatura / Recibo</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Tipo</label>
              <select value={formData.tipo} onChange={e => setFormData(p => ({...p, tipo: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
                <option value="fatura">Fatura</option>
                <option value="recibo">Recibo</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Valor (€)</label>
              <input type="number" step="0.01" value={formData.valor} onChange={e => setFormData(p => ({...p, valor: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Data Documento</label>
              <input type="date" value={formData.data_documento} onChange={e => setFormData(p => ({...p, data_documento: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Entidade (nome/NIF)</label>
              <input type="text" value={formData.entidade} onChange={e => setFormData(p => ({...p, entidade: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="Nome ou NIF" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Descrição</label>
              <input type="text" value={formData.descricao} onChange={e => setFormData(p => ({...p, descricao: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="Descrição opcional" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={guardarFatura} disabled={savingFatura}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
              {savingFatura ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Guardar
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-500 hover:text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Zona de Upload */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 sm:p-8">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
          Importar Extrato Bancário
        </h3>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-5 sm:p-8 text-center cursor-pointer transition-all ${
            dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
          }`}
        >
          <input ref={inputRef} type="file" accept=".csv,.ofx,.qfx,.pdf" multiple className="hidden" onChange={handleFileChange} />
          <Upload size={32} className={`mx-auto mb-3 ${dragging ? 'text-indigo-500' : 'text-slate-300'}`} />
          {ficheiros.length > 0 ? (
            <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
              {ficheiros.map((f, idx) => (
                <div key={idx} className="flex items-center justify-center gap-2">
                  <FileText size={14} className="text-indigo-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 truncate max-w-xs">{f.name}</span>
                  <button onClick={() => setFicheiros(prev => prev.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-rose-500 flex-shrink-0">
                    <X size={13} />
                  </button>
                </div>
              ))}
              <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest pt-1 cursor-pointer hover:underline"
                onClick={() => inputRef.current?.click()}>
                + Adicionar mais ficheiros
              </p>
            </div>
          ) : (
            <>
              <p className="text-slate-500 font-medium">Arraste ficheiros CSV, OFX ou PDF aqui</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">ou clique para escolher (múltiplos permitidos)</p>
            </>
          )}
        </div>

        {erro && (
          <div className="mt-3 flex items-start gap-2 bg-rose-50 text-rose-700 rounded-xl p-3 text-sm">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {previewErrors.length > 0 && (
          <div className="mt-3 space-y-1">
            {previewErrors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 bg-amber-50 text-amber-700 rounded-xl p-3 text-xs">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span><strong>{e.filename}</strong>: {e.error}</span>
              </div>
            ))}
          </div>
        )}
        {ficheiros.length > 0 && !previewing && !csvMapping && (
          <button onClick={previsar}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-2xl py-3 hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest">
            <ArrowLeftRight size={14} /> Pré-visualizar {ficheiros.length > 1 ? `${ficheiros.length} Ficheiros` : 'Movimentos'}
          </button>
        )}
        {previewing && (
          <div className="mt-4 flex items-center justify-center gap-2 text-indigo-600">
            <Loader2 size={18} className="animate-spin" /> A ler ficheiros...
          </div>
        )}
      </div>

      {/* Mapeamento de colunas CSV */}
      {csvMapping && (
        <CsvMappingCard
          csvMapping={csvMapping}
          colMap={colMap}
          setColMap={setColMap}
          previewing={previewing}
          confirmarMapeamento={confirmarMapeamento}
          onCancel={() => { setCsvMapping(null); setFicheiros([]); setErro(null); }}
        />
      )}

      {/* Preview de movimentos — etapa de seleção */}
      {previewTransacoes && (() => {
        const q = txSearch.trim().toLowerCase();
        const visibleIndices = previewTransacoes
          .map((tx, i) => ({ tx, i }))
          .filter(({ tx }) => {
            if (txTipoFiltro !== 'todos' && tx.tipo !== txTipoFiltro) return false;
            if (q && !tx.descricao.toLowerCase().includes(q) && !String(tx.valor).includes(q)) return false;
            return true;
          });
        const nDebito = previewTransacoes.filter(t => t.tipo === 'debito').length;
        const nCredito = previewTransacoes.filter(t => t.tipo === 'credito').length;
        const allVisible = visibleIndices.map(x => x.i);
        const allVisibleSelected = allVisible.length > 0 && allVisible.every(i => selTransacoes.has(i));
        return (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Seleccionar Movimentos
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selTransacoes.size} de {previewTransacoes.length} seleccionados
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setPreviewTransacoes(null); setFicheiros([]); setPreviewErrors([]); setErro(null); }}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:border-slate-300 transition-all"
                >
                  <X size={11} className="inline mr-1" />Cancelar
                </button>
                <button
                  onClick={processar}
                  disabled={processando || selTransacoes.size === 0}
                  className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                >
                  {processando ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeftRight size={12} />}
                  Processar {selTransacoes.size > 0 ? `(${selTransacoes.size})` : ''}
                </button>
              </div>
            </div>

            {/* Filtro por tipo */}
            <div className="flex gap-2">
              {[
                { key: 'todos', label: `Todos (${previewTransacoes.length})` },
                { key: 'debito', label: `Saídas (${nDebito})` },
                { key: 'credito', label: `Entradas (${nCredito})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTxTipoFiltro(key)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                    txTipoFiltro === key
                      ? key === 'debito' ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-300'
                        : key === 'credito' ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                        : 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              value={txSearch}
              onChange={e => setTxSearch(e.target.value)}
              placeholder="Filtrar por descrição ou valor..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />

            <div className="flex items-center gap-3 px-1">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={e => {
                    setSelTransacoes(prev => {
                      const s = new Set(prev);
                      allVisible.forEach(i => e.target.checked ? s.add(i) : s.delete(i));
                      return s;
                    });
                  }}
                  className="accent-indigo-600 w-4 h-4"
                />
                {allVisibleSelected ? 'Desseleccionar visíveis' : 'Seleccionar visíveis'}
              </label>
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {visibleIndices.length === 0 && (
                <p className="text-center text-slate-400 py-6 text-sm">Nenhum movimento corresponde ao filtro.</p>
              )}
              {visibleIndices.map(({ tx, i }) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${selTransacoes.has(i) ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50 border border-transparent hover:bg-slate-100'}`}>
                  <input
                    type="checkbox"
                    checked={selTransacoes.has(i)}
                    onChange={e => setSelTransacoes(prev => { const s = new Set(prev); e.target.checked ? s.add(i) : s.delete(i); return s; })}
                    className="accent-indigo-600 w-4 h-4 flex-shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    {tx._source && (
                      <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 truncate mb-0.5">{tx._source}</p>
                    )}
                    {editingTxIdx === i ? (
                      <input
                        autoFocus
                        className="w-full text-xs text-slate-700 font-medium border-b border-indigo-400 bg-transparent outline-none pb-0.5"
                        value={tx.descricao}
                        onChange={e => setPreviewTransacoes(prev => prev.map((t, j) => j === i ? { ...t, descricao: e.target.value } : t))}
                        onBlur={() => setEditingTxIdx(null)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTxIdx(null); }}
                      />
                    ) : (
                      <p className="text-xs text-slate-700 font-medium truncate">{tx.descricao || '—'}</p>
                    )}
                    <p className="text-[10px] text-slate-400">{tx.data}</p>
                  </div>
                  <button
                    onClick={() => setEditingTxIdx(editingTxIdx === i ? null : i)}
                    className={`flex-shrink-0 transition-all ${editingTxIdx === i ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-400'}`}
                    title="Editar descrição"
                  >
                    <Pencil size={12} />
                  </button>
                  <div className="text-right flex-shrink-0 flex items-center gap-2">
                    <TipoBadge tipo={tx.tipo} />
                    <span className="text-sm font-bold text-slate-700">€{Number(tx.valor).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Sub-tabs de Resultados */}
      {displayData && (
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

          {/* Sub-tab buttons + download */}
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
                title="Associar automaticamente entradas bancárias a clientes (por nome na descrição)"
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
                        {item.rule === 'client_association' && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest">cliente · {item.period}</span>
                        )}
                        {item.rule === 'confirmed_manual' && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest">confirmado</span>
                        )}
                        {item.rule === 'alias_match' && (
                          <span className="text-[9px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full uppercase tracking-widest">alias</span>
                        )}
                        {item.rule === 'manual' && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest">manual</span>
                        )}
                        {item.rule === 'manual_split' && (
                          <span className="text-[9px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full uppercase tracking-widest">split</span>
                        )}
                        {item.rule === 'description_match' && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-widest">desc</span>
                        )}
                        {item.rule === 'date_proximity' && (
                          <span className="text-[9px] bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full uppercase tracking-widest">data</span>
                        )}
                        {faturaIdCount[item.fatura?.id] > 1 && item.rule !== 'manual_split' && (
                          <span className="text-[9px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full uppercase tracking-widest">2 movimentos</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {editingResultDesc?.section === 'matched' && editingResultDesc?.index === i ? (
                          <input
                            autoFocus
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
                        <button
                          onClick={() => setEditingResultDesc({ section: 'matched', index: i, value: item.transacao?.descricao || '' })}
                          className={`flex-shrink-0 transition-all ${editingResultDesc?.section === 'matched' && editingResultDesc?.index === i ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-400'}`}
                          title="Editar descrição"
                        >
                          <Pencil size={11} />
                        </button>
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
                            <span
                              title={`Associado a ${item.client_name} (${item.period}) — clique para remover`}
                              className="flex items-center gap-1 text-indigo-500 text-[9px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-full cursor-pointer hover:bg-rose-50 hover:text-rose-500"
                              onClick={() => removerAssociacaoCliente(item._orig_section, item._orig_index)}
                            >
                              <Link2 size={10} /> {item.client_name}
                            </span>
                          );
                        }
                        const link = txLinkInfo('matched', i);
                        const clientName = link ? (clients?.find(c => c.id === link.client_id)?.name || link.client_id) : null;
                        return link ? (
                          <span
                            title={`Associado a ${clientName} (${link.period})`}
                            className="flex items-center gap-1 text-indigo-500 text-[9px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-full cursor-pointer hover:bg-rose-50 hover:text-rose-500"
                            onClick={() => removerAssociacaoCliente('matched', i)}
                          >
                            <Link2 size={10} /> {clientName}
                          </span>
                        ) : (
                          <button
                            onClick={() => abrirAssociarCliente('matched', i, item.transacao)}
                            title="Associar a cliente de faturação"
                            className="p-1.5 rounded-xl text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                          >
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
                          <button
                            onClick={() => confirmarEntrada(item, i)}
                            disabled={confirmandoEntrada.has(i)}
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
                        <button
                          onClick={() => desvincularMatch(item, i)}
                          disabled={desvinculando.has(`${i}`)}
                          title="Desvincular"
                          className="p-1.5 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50">
                          {desvinculando.has(`${i}`) ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
                        </button>
                      )}
                      {item.rule !== 'client_association' && (
                        <button
                          onClick={() => { if (window.confirm('Excluir este movimento dos resultados?')) excluirItem('matched', i); }}
                          disabled={excluindo.has(`matched_${i}`)}
                          title="Excluir movimento"
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
            const items = (displayData.orphan_bank || []).filter((_, i) => !confirmedOrphans.has(i) && !orphanBankAssocSet.has(i));
            const allIndices = (displayData.orphan_bank || []).map((_, i) => i).filter(i => !confirmedOrphans.has(i) && !orphanBankAssocSet.has(i));
            return (
              <div className="space-y-3">
                {items.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Sem transações sem correspondência.</p>}
                {items.length > 0 && (
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
                              <input
                                autoFocus
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
                            <button
                              onClick={() => setEditingResultDesc({ section: 'orphan_bank', index: i, value: item.transacao.descricao || '' })}
                              className={`flex-shrink-0 transition-all ${editingResultDesc?.section === 'orphan_bank' && editingResultDesc?.index === i ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-400'}`}
                              title="Editar descrição"
                            >
                              <Pencil size={11} />
                            </button>
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
                                <span
                                  title={`Associado a ${clientName} (${link.period}) — clique para remover`}
                                  className="flex items-center gap-1 text-indigo-500 text-[9px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-full cursor-pointer hover:bg-rose-50 hover:text-rose-500"
                                  onClick={() => removerAssociacaoCliente('orphan_bank', i)}
                                >
                                  <Link2 size={10} /> {clientName}
                                </span>
                              ) : (
                                <button
                                  onClick={() => abrirAssociarCliente('orphan_bank', i, item.transacao)}
                                  title="Associar a cliente de faturação"
                                  className="flex items-center gap-1 border border-indigo-100 text-indigo-400 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all"
                                >
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
                            <button
                              onClick={() => { if (window.confirm('Excluir este movimento dos resultados?')) excluirItem('orphan_bank', i); }}
                              disabled={excluindo.has(`orphan_bank_${i}`)}
                              title="Excluir movimento"
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
                  <button
                    onClick={() => { if (window.confirm('Remover esta fatura dos resultados?')) excluirItem('orphan_system', i); }}
                    disabled={excluindo.has(`orphan_system_${i}`)}
                    title="Excluir da lista"
                    className="flex-shrink-0 p-1.5 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50">
                    {excluindo.has(`orphan_system_${i}`) ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Histórico — secção colapsável */}
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

            {/* Barra de acções multi-selecção */}
            {selHistorico.size > 0 && (
              <div className="flex items-center justify-between mb-3 px-3 py-2 bg-indigo-50 rounded-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                  {selHistorico.size} seleccionada{selHistorico.size > 1 ? 's' : ''}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelHistorico(new Set())}
                    className="text-[10px] text-slate-400 hover:text-slate-600 font-black uppercase tracking-widest"
                  >
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
                      } finally { setLoadingMultiRel(false); }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    {loadingMultiRel ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                    Relatório
                  </button>
                </div>
              </div>
            )}

            {historico.map(run => (
              <div
                key={run.id}
                onClick={async () => {
                  const { data } = await supabase
                    .from('reconciliation_runs')
                    .select('*')
                    .eq('id', run.id)
                    .single();
                  if (data) {
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
                      // Busca só a contagem para actualizar o contador do histórico;
                      // o carregarPagamentosLinks completo é feito pelo useEffect abaixo.
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
                  }
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 cursor-pointer ${selHistorico.has(run.id) ? 'bg-indigo-50' : ''}`}
              >
                {/* Checkbox de selecção */}
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
                  <button
                    onClick={e => reprocessarRun(e, run.id)}
                    disabled={reprocessando === run.id}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                    title="Reprocessar extrato com faturas actuais"
                  >
                    {reprocessando === run.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  </button>
                  <button
                    onClick={e => apagarRun(e, run.id)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    title="Apagar importação"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingAssociacao && (
        <AssociacaoManualModal
          tx={pendingAssociacao.transacao}
          txValor={pendingAssociacao.transacao.valor}
          faturas={assocFaturas}
          loading={loadingAssoc}
          onClose={() => setPendingAssociacao(null)}
          onSelect={(fatura, saveAlias) => confirmarAssociacaoManual(fatura, saveAlias)}
        />
      )}
      {pendingOrphanConfirm && (
        <OrfaoBancoModal
          indices={pendingOrphanConfirm.indices}
          tags={tags}
          onCreateTag={criarTag}
          onClose={() => setPendingOrphanConfirm(null)}
          onSave={confirmarMovimento}
        />
      )}
      {assocClienteModal && (
        <AssocClienteModal
          modal={assocClienteModal}
          clients={clients}
          onClose={() => setAssocClienteModal(null)}
          onSave={salvarAssociacaoCliente}
        />
      )}
      
            {showRelatorio && (relatorioRuns || displayData) && (
        <RelatorioModal
          displayData={relatorioRuns ? null : displayData}
          filename={runSelecionado?.filename ?? resultado?.filename ?? 'extrato'}
          dataRun={runSelecionado
            ? new Date(runSelecionado.created_at).toLocaleDateString('pt-PT')
            : new Date().toLocaleDateString('pt-PT')}
          runs={relatorioRuns}
          onClose={() => { setShowRelatorio(false); setRelatorioRuns(null); }}
        />
      )}
    </div>
  );
}
