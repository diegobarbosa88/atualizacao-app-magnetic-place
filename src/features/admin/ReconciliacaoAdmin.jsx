import React, { useState, useEffect, useRef } from 'react';
import {
  Landmark, Upload, CheckCircle, X, ChevronDown, ChevronUp,
  AlertCircle, Clock, FileText, Loader2, Plus, ArrowLeftRight,
  ArrowDownLeft, ArrowUpRight, Trash2, RefreshCw, Tag
} from 'lucide-react';

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

function TagBadge({ nome, cor }) {
  const c = COR_MAP[cor] || COR_MAP.gray;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${c.bg} ${c.text}`}>
      <Tag size={9} /> {nome}
    </span>
  );
}
import { useApp } from '../../context/AppContext';

function TipoBadge({ tipo }) {
  if (tipo === 'credito') return (
    <span className="flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
      <ArrowDownLeft size={10} /> Entrada
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
      <ArrowUpRight size={10} /> Saída
    </span>
  );
}

export default function ReconciliacaoAdmin() {
  const { supabase } = useApp();

  // ── Upload state ──────────────────────────────────────────────────────────
  const [ficheiro, setFicheiro] = useState(null);        // File object
  const [dragging, setDragging] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState(null);
  const inputRef = useRef(null);

  // ── Resultados ────────────────────────────────────────────────────────────
  const [resultado, setResultado] = useState(null);      // resposta da API
  const [activeSubTab, setActiveSubTab] = useState('matched'); // matched | orphan_bank | orphan_system
  const [confirmando, setConfirmando] = useState(new Set()); // IDs em processo
  const [selMatched, setSelMatched] = useState(new Set());    // índices seleccionados em Reconciliados
  const [selOrphan, setSelOrphan] = useState(new Set());      // índices seleccionados em Órfãos Banco
  const [confirmedOrphans, setConfirmedOrphans] = useState(new Set()); // índices confirmados órfãos
  const [orphanObservacoes, setOrphanObservacoes] = useState({}); // { [index]: string }
  const [pendingOrphanConfirm, setPendingOrphanConfirm] = useState(null); // { indices: number[] }
  const [orphanObs, setOrphanObs] = useState('');
  const [bulkConfirmando, setBulkConfirmando] = useState(false);

  // ── Classificação de Órfãos ───────────────────────────────────────────────
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);        // { id, nome, cor }
  const [orphanClassificacoes, setOrphanClassificacoes] = useState({}); // { [index]: { nome, cor } }
  const [showNovaTag, setShowNovaTag] = useState(false);
  const [novaTagNome, setNovaTagNome] = useState('');
  const [novaTagCor, setNovaTagCor] = useState('indigo');
  const [savingTag, setSavingTag] = useState(false);

  // ── Associação Manual ────────────────────────────────────────────────────
  const [pendingAssociacao, setPendingAssociacao] = useState(null); // { index, transacao }
  const [assocFaturas, setAssocFaturas] = useState([]);
  const [loadingAssoc, setLoadingAssoc] = useState(false);
  const [assocSearch, setAssocSearch] = useState('');

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

  // Carregar histórico e tags ao montar
  useEffect(() => {
    carregarHistorico();
    carregarTags();
  }, []);

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

  const criarTag = async () => {
    if (!novaTagNome.trim()) return;
    setSavingTag(true);
    try {
      const { data, error } = await supabase
        .from('reconciliation_classificacao_tags')
        .insert({ nome: novaTagNome.trim(), cor: novaTagCor })
        .select('id, nome, cor')
        .single();
      if (error) throw error;
      setTags(prev => [...prev, data]);
      setSelectedTag(data);
      setShowNovaTag(false);
      setNovaTagNome('');
      setNovaTagCor('indigo');
    } catch (err) {
      alert(`Erro ao criar tag: ${err.message}`);
    } finally {
      setSavingTag(false);
    }
  };

  const carregarHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const { data, error } = await supabase
        .from('reconciliation_runs')
        .select('id, created_at, filename, transaction_count, matched_count, orphan_bank_count, orphan_system_count')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error) setHistorico(data || []);
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
      const faturaIds = runData.results_json.matched
        .filter(m => m.fatura?.fonte !== 'recibo')
        .map(m => m.fatura?.id)
        .filter(Boolean);
      const reciboMatches = runData.results_json.matched
        .filter(m => m.fatura?.fonte === 'recibo' && m.fatura?.id);
      if (faturaIds.length) await supabase.from('faturas').update({ status: 'PENDENTE' }).in('id', faturaIds);
      // Reverter cada recibo para o seu estado original (valido ou aviso)
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
    const f = e.dataTransfer.files[0];
    if (f) validarESelecionarFicheiro(f);
  };
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) validarESelecionarFicheiro(f);
  };
  const validarESelecionarFicheiro = (f) => {
    setErro(null);
    const ext = f.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      setErro('Ficheiros PDF não são suportados. Carregue um ficheiro CSV ou OFX.');
      return;
    }
    if (!['csv', 'ofx', 'qfx'].includes(ext)) {
      setErro(`Formato .${ext} não suportado. Formatos aceites: CSV, OFX, QFX.`);
      return;
    }
    setFicheiro(f);
  };

  // ── Processar ficheiro ────────────────────────────────────────────────────
  const processar = async () => {
    if (!ficheiro) return;
    setProcessando(true);
    setErro(null);
    setResultado(null);
    try {
      const formPayload = new FormData();
      formPayload.append('file', ficheiro);
      const res = await fetch('/api/reconciliacao/upload', {
        method: 'POST',
        body: formPayload,
      });
      const data = await res.json();
      if (!res.ok) {
        let mensagemErro = data.error || 'Erro ao processar ficheiro.';
        if (data.detected) mensagemErro = `${data.error} Colunas detectadas: ${data.detected.join(', ')}`;
        setErro(mensagemErro);
        return;
      }
      setResultado(data);
      setActiveSubTab('matched');
      carregarHistorico(); // refresh histórico
    } catch (err) {
      setErro(err.message || 'Erro de rede ao enviar ficheiro.');
    } finally {
      setProcessando(false);
    }
  };

  // ── Confirmar Pagamento (individual, não-bulk per D-10) ────────────────────
  const confirmarPagamento = async (faturaId, fonte) => {
    setConfirmando(prev => new Set(prev).add(faturaId));
    try {
      if (fonte === 'recibo') {
        const { error } = await supabase
          .from('receipt_validations')
          .update({ estado: 'pago' })
          .eq('id', faturaId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('faturas')
          .update({ status: 'PAGO' })
          .eq('id', faturaId);
        if (error) throw error;
      }
      const updateMatched = matched => matched.map(m =>
        m.fatura.id === faturaId ? { ...m, fatura: { ...m.fatura, status: 'PAGO' } } : m
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
      const currentMatched = (runSelecionado ? runSelecionado.results_json : resultado)?.matched || [];
      const items = currentMatched.filter((_, i) => selMatched.has(i) && _.fatura.status !== 'PAGO');
      if (!items.length) return;

      // Deduplicate por ID (splits não devem confirmar o mesmo recibo duas vezes)
      const seenIds = new Set();
      const uniqueItems = items.filter(m => { if (seenIds.has(m.fatura.id)) return false; seenIds.add(m.fatura.id); return true; });
      const allIds = uniqueItems.map(m => m.fatura.id);
      setConfirmando(new Set(allIds));

      // Todos os updates em paralelo (já deduplicados)
      await Promise.all(uniqueItems.map(item =>
        item.fatura.fonte === 'recibo'
          ? supabase.from('receipt_validations').update({ estado: 'pago' }).eq('id', item.fatura.id)
          : supabase.from('faturas').update({ status: 'PAGO' }).eq('id', item.fatura.id)
      ));

      // Actualizar estado local uma única vez com todos os IDs
      const idSet = new Set(allIds);
      const updateAllMatched = matched => matched.map(m =>
        idSet.has(m.fatura.id) ? { ...m, fatura: { ...m.fatura, status: 'PAGO' } } : m
      );

      const runId = runSelecionado?.id ?? resultado?.run_id;
      let newMatched;
      if (runSelecionado) {
        newMatched = updateAllMatched(runSelecionado.results_json.matched || []);
        setRunSelecionado(prev => ({
          ...prev,
          results_json: { ...prev.results_json, matched: newMatched },
        }));
      } else {
        newMatched = updateAllMatched(resultado?.matched || []);
        setResultado(prev => ({ ...prev, matched: newMatched }));
      }

      // Persistir no run
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

      setSelMatched(new Set());
      setConfirmando(new Set());
    } catch (err) {
      alert(`Erro ao confirmar pagamentos: ${err.message}`);
    } finally {
      setBulkConfirmando(false);
    }
  };

  // ── Confirmar movimento em Órfãos Banco — abre modal para observação ────────
  const pedirObservacaoOrphan = (indices) => {
    setPendingOrphanConfirm({ indices });
    setOrphanObs('');
    setSelectedTag(null);
    setShowNovaTag(false);
    setNovaTagNome('');
  };

  const confirmarMovimento = async () => {
    if (!pendingOrphanConfirm) return;
    const { indices } = pendingOrphanConfirm;
    const idxSet = new Set(indices);
    const obsText = orphanObs.trim();
    const tag = selectedTag ? { nome: selectedTag.nome, cor: selectedTag.cor } : null;

    // Actualizar estado de display imediatamente
    setConfirmedOrphans(prev => { const s = new Set(prev); indices.forEach(i => s.add(i)); return s; });
    if (obsText) setOrphanObservacoes(prev => { const n = { ...prev }; indices.forEach(i => { n[i] = obsText; }); return n; });
    if (tag) setOrphanClassificacoes(prev => { const n = { ...prev }; indices.forEach(i => { n[i] = tag; }); return n; });

    // Fechar modal
    setPendingOrphanConfirm(null);
    setOrphanObs('');
    setSelectedTag(null);
    setSelOrphan(new Set());

    // Persistir no Supabase
    const runId = runSelecionado?.id ?? resultado?.run_id;
    if (!runId) return;

    const sourceBank = runSelecionado
      ? (runSelecionado.results_json?.orphan_bank || [])
      : (resultado?.orphan_bank || []);

    const newOrphanBank = sourceBank.map((item, i) =>
      idxSet.has(i)
        ? { ...item, confirmed: true, observacao: obsText || null, classificacao: tag }
        : item
    );

    const baseResults = runSelecionado?.results_json ?? {
      matched: resultado?.matched || [],
      orphan_bank: resultado?.orphan_bank || [],
      orphan_system: resultado?.orphan_system || [],
    };
    const newResults = { ...baseResults, orphan_bank: newOrphanBank };

    const { error } = await supabase
      .from('reconciliation_runs')
      .update({ results_json: newResults })
      .eq('id', runId);
    if (error) { console.error('Erro ao persistir confirmação:', error.message); return; }

    // Actualizar estado local para reflectir no retorno do histórico
    if (runSelecionado) {
      setRunSelecionado(prev => ({ ...prev, results_json: newResults }));
    } else {
      setResultado(prev => ({ ...prev, orphan_bank: newOrphanBank }));
    }
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

  const confirmarAssociacaoManual = async (fatura) => {
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
    setPendingAssociacao(null);
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

  // ── Render helpers ────────────────────────────────────────────────────────
  const displayData = runSelecionado
    ? { ...runSelecionado.results_json, run_id: runSelecionado.id }
    : resultado;

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
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
          }`}
        >
          <input ref={inputRef} type="file" accept=".csv,.ofx,.qfx" className="hidden" onChange={handleFileChange} />
          <Upload size={32} className={`mx-auto mb-3 ${dragging ? 'text-indigo-500' : 'text-slate-300'}`} />
          {ficheiro ? (
            <div className="flex items-center justify-center gap-2">
              <FileText size={16} className="text-indigo-600" />
              <span className="font-semibold text-slate-700">{ficheiro.name}</span>
              <button onClick={e => { e.stopPropagation(); setFicheiro(null); setErro(null); }}
                className="text-slate-400 hover:text-rose-500 ml-1">
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <p className="text-slate-500 font-medium">Arraste um ficheiro CSV ou OFX aqui</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">ou clique para escolher</p>
            </>
          )}
        </div>

        {erro && (
          <div className="mt-3 flex items-start gap-2 bg-rose-50 text-rose-700 rounded-xl p-3 text-sm">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {ficheiro && !processando && (
          <button onClick={processar}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-2xl py-3 hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest">
            <ArrowLeftRight size={14} /> Processar Extrato
          </button>
        )}
        {processando && (
          <div className="mt-4 flex items-center justify-center gap-2 text-indigo-600">
            <Loader2 size={18} className="animate-spin" /> A processar...
          </div>
        )}
      </div>

      {/* Sub-tabs de Resultados */}
      {displayData && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 sm:p-8">
          {runSelecionado && (
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
              <button onClick={() => setRunSelecionado(null)}
                className="text-indigo-600 hover:underline text-[10px] font-black uppercase tracking-widest">
                ← Voltar ao run actual
              </button>
              <span>· A ver: {runSelecionado.filename} ({new Date(runSelecionado.created_at).toLocaleDateString('pt-PT')})</span>
            </div>
          )}

          {/* Sub-tab buttons */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-6 overflow-x-auto">
            {[
              { key: 'matched', label: 'Reconciliados', count: displayData.matched?.length ?? 0, color: 'emerald' },
              { key: 'orphan_bank', label: 'Órfãos Banco', count: displayData.orphan_bank?.length ?? 0, color: 'amber' },
              { key: 'orphan_system', label: 'Órfãos Sistema', count: displayData.orphan_system?.length ?? 0, color: 'rose' },
            ].map(tab => (
              <button key={tab.key} onClick={() => { setActiveSubTab(tab.key); setSelMatched(new Set()); setSelOrphan(new Set()); }}
                className={`flex-1 flex-shrink-0 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeSubTab === tab.key ? 'bg-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                }`}>
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Sub-tab: Reconciliados */}
          {activeSubTab === 'matched' && (() => {
            const items = displayData.matched || [];
            const faturaIdCount = items.reduce((acc, m) => { if (m.fatura?.id) acc[m.fatura.id] = (acc[m.fatura.id] || 0) + 1; return acc; }, {});
            const allPendentes = items.filter(m => m.fatura?.status !== 'PAGO');
            return (
              <div className="space-y-3">
                {items.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Nenhuma transação reconciliada.</p>}
                {items.length > 0 && (
                  <div className="flex items-center justify-between mb-1">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer select-none">
                      <input type="checkbox"
                        checked={allPendentes.length > 0 && selMatched.size === allPendentes.length}
                        onChange={e => setSelMatched(e.target.checked ? new Set(items.map((_, i) => i).filter(i => items[i].fatura?.status !== 'PAGO')) : new Set())}
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
                  <div key={i} className="flex items-center gap-3 bg-emerald-50 rounded-2xl p-4">
                    {item.fatura?.status !== 'PAGO' && (
                      <input type="checkbox" checked={selMatched.has(i)}
                        onChange={e => setSelMatched(prev => { const s = new Set(prev); e.target.checked ? s.add(i) : s.delete(i); return s; })}
                        className="accent-emerald-600 w-4 h-4 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TipoBadge tipo={item.transacao?.tipo} />
                        <span className="text-sm font-bold text-slate-700">€{Number(item.transacao?.valor ?? 0).toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400">{item.transacao?.data}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                          {item.fatura?.fonte === 'recibo' ? 'Recibo' : item.fatura?.tipo || 'Fatura'}
                        </span>
                        <span className="text-[10px] text-slate-500">{item.fatura?.entidade}</span>
                        {item.rule === 'manual' && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest">manual</span>
                        )}
                        {item.rule === 'manual_split' && (
                          <span className="text-[9px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full uppercase tracking-widest">split</span>
                        )}
                        {item.rule === 'description_match' && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-widest">desc</span>
                        )}
                        {faturaIdCount[item.fatura?.id] > 1 && item.rule !== 'manual_split' && (
                          <span className="text-[9px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full uppercase tracking-widest">2 movimentos</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 truncate font-medium">{item.transacao?.descricao}</p>
                      {item.fatura?.descricao && (
                        <p className="text-xs text-slate-500 truncate">{item.fatura.entidade} · {item.fatura.descricao}</p>
                      )}
                    </div>
                    {item.fatura?.status === 'PAGO' ? (
                      <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase tracking-widest flex-shrink-0">
                        <CheckCircle size={14} /> Pago
                      </span>
                    ) : (
                      <button onClick={() => confirmarPagamento(item.fatura?.id, item.fatura?.fonte)}
                        disabled={confirmando.has(item.fatura?.id)}
                        className="flex-shrink-0 flex items-center gap-1 bg-emerald-600 text-white rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50">
                        {confirmando.has(item.fatura?.id) ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                        Confirmar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Sub-tab: Órfãos Banco */}
          {activeSubTab === 'orphan_bank' && (() => {
            const items = (displayData.orphan_bank || []).filter((_, i) => !confirmedOrphans.has(i));
            const allIndices = (displayData.orphan_bank || []).map((_, i) => i).filter(i => !confirmedOrphans.has(i));
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
                    <div key={i} className={`rounded-2xl p-4 ${item.reason === 'ambiguous' ? 'bg-amber-50' : 'bg-rose-50'}`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={selOrphan.has(i)}
                          onChange={e => setSelOrphan(prev => { const s = new Set(prev); e.target.checked ? s.add(i) : s.delete(i); return s; })}
                          className="accent-indigo-600 w-4 h-4 mt-1 flex-shrink-0" />
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
                          <p className="text-xs text-slate-700 font-medium">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descrição: </span>
                            {item.transacao.descricao || '—'}
                          </p>
                          {item.reason === 'ambiguous' && item.candidates && (
                            <p className="text-[10px] text-amber-600 mt-1">
                              Candidatos: {item.candidates.map(c => c.entidade).filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 flex gap-2">
                          <button onClick={() => abrirAssociarFatura(i, item.transacao)}
                            className="flex items-center gap-1 border border-indigo-200 text-indigo-600 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all">
                            <Tag size={12} /> Associar
                          </button>
                          <button onClick={() => pedirObservacaoOrphan([i])}
                            className="flex items-center gap-1 bg-indigo-600 text-white rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                            <CheckCircle size={12} /> Confirmar
                          </button>
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
                <div key={i} className="bg-rose-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-700">Fatura sem pagamento</span>
                    <span className="text-sm font-bold text-slate-700">€{Number(item.fatura.valor).toFixed(2)}</span>
                    <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">PENDENTE</span>
                  </div>
                  <p className="text-xs text-slate-600 truncate">{item.fatura.entidade} · {item.fatura.descricao}</p>
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
            {historico.map(run => (
              <div
                key={run.id}
                onClick={async () => {
                  const { data } = await supabase
                    .from('reconciliation_runs')
                    .select('*')
                    .eq('id', run.id)
                    .single();
                  if (data) setRunSelecionado(data);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 cursor-pointer"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-700">{run.filename}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(run.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black">
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{run.matched_count} ok</span>
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{run.orphan_bank_count} banco</span>
                  <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{run.orphan_system_count} sistema</span>
                  <button
                    onClick={e => reprocessarRun(e, run.id)}
                    disabled={reprocessando === run.id}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                    title="Reprocessar extrato com faturas actuais"
                  >
                    {reprocessando === run.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <RefreshCw size={13} />}
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

      {/* Modal — Associação Manual */}
      {pendingAssociacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Associar a Fatura</h3>
              <p className="text-sm text-slate-700 mt-1 font-semibold">
                €{Number(pendingAssociacao.transacao.valor).toFixed(2)} · {pendingAssociacao.transacao.data}
              </p>
              <p className="text-xs text-slate-500 truncate">{pendingAssociacao.transacao.descricao}</p>
            </div>

            <input
              autoFocus
              value={assocSearch}
              onChange={e => setAssocSearch(e.target.value)}
              placeholder="Filtrar por entidade, descrição ou valor..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {loadingAssoc && (
                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-indigo-400" /></div>
              )}
              {!loadingAssoc && (() => {
                const q = assocSearch.toLowerCase();
                const lista = assocFaturas.filter(f => {
                  if (!q) return true;
                  const v = String(f.valor ?? f.dados?.valor_total ?? '');
                  const ent = (f.entidade || f.dados?.fornecedor || '').toLowerCase();
                  const desc = (f.descricao || f.dados?.numero_fatura || f.filename || '').toLowerCase();
                  return ent.includes(q) || desc.includes(q) || v.includes(q);
                });
                if (!lista.length) return <p className="text-center text-slate-400 py-6 text-sm">Nenhuma fatura encontrada.</p>;
                return lista.map(f => {
                  const valorF = f.valor ?? f.dados?.valor_total;
                  const diff = Math.abs((valorF ?? 0) - pendingAssociacao.transacao.valor);
                  const isClose = diff <= 0.01;
                  return (
                    <button
                      key={f.id}
                      onClick={() => confirmarAssociacaoManual(f)}
                      className={`w-full text-left p-3 rounded-xl border transition-all hover:border-indigo-400 hover:bg-indigo-50 ${isClose ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">
                            {f.entidade || f.dados?.fornecedor || f.filename || '—'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {f.descricao || f.dados?.numero_fatura || f.dados?.fornecedor || '—'}
                          </p>
                          {f.data_documento && <p className="text-[10px] text-slate-400">{f.data_documento}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${isClose ? 'text-emerald-700' : 'text-slate-700'}`}>
                            €{Number(valorF ?? 0).toFixed(2)}
                          </p>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{f.status || 'PENDENTE'}</span>
                        </div>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>

            <button
              onClick={() => setPendingAssociacao(null)}
              className="w-full py-2 text-slate-500 hover:text-slate-700 text-[10px] font-black uppercase tracking-widest"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal — Confirmar Órfão Banco */}
      {pendingOrphanConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Confirmar Movimento
                {pendingOrphanConfirm.indices.length > 1 && ` (${pendingOrphanConfirm.indices.length} movimentos)`}
              </h3>
              <p className="text-sm text-slate-500 mt-1">Classifique e/ou adicione uma observação para este movimento.</p>
            </div>

            {/* Classificação */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <Tag size={10} /> Classificação
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => {
                  const c = COR_MAP[tag.cor] || COR_MAP.gray;
                  const isSelected = selectedTag?.id === tag.id;
                  return (
                    <button
                      key={tag.id}
                      onClick={() => setSelectedTag(isSelected ? null : tag)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ring-2 transition-all ${
                        isSelected
                          ? `${c.bg} ${c.text} ${c.ring}`
                          : 'bg-slate-100 text-slate-500 ring-transparent hover:ring-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {tag.nome}
                    </button>
                  );
                })}

                {/* Criar nova tag */}
                {showNovaTag ? (
                  <div className="flex items-center gap-2 w-full mt-1 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <input
                      autoFocus
                      value={novaTagNome}
                      onChange={e => setNovaTagNome(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') criarTag(); if (e.key === 'Escape') { setShowNovaTag(false); setNovaTagNome(''); } }}
                      placeholder="Nome da classificação..."
                      className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <div className="flex items-center gap-1">
                      {CORES_DISPONIVEIS.map(cor => (
                        <button
                          key={cor}
                          onClick={() => setNovaTagCor(cor)}
                          title={cor}
                          className={`w-5 h-5 rounded-full ${COR_MAP[cor].dot} transition-all ${
                            novaTagCor === cor ? 'ring-2 ring-offset-1 ring-slate-500 scale-110' : 'opacity-60 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={criarTag}
                      disabled={!novaTagNome.trim() || savingTag}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                    >
                      {savingTag ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />} Criar
                    </button>
                    <button onClick={() => { setShowNovaTag(false); setNovaTagNome(''); }} className="text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNovaTag(true)}
                    className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-1"
                  >
                    <Plus size={10} /> Nova
                  </button>
                )}
              </div>
            </div>

            {/* Observação */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Observação {!selectedTag && <span className="text-rose-400">*</span>}
              </label>
              <textarea
                value={orphanObs}
                onChange={e => setOrphanObs(e.target.value)}
                placeholder="Ex: Pagamento de fornecedor por transferência direta, fatura pendente de envio..."
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {!selectedTag && !orphanObs.trim() && (
                <p className="text-[10px] text-slate-400">Seleccione uma classificação ou escreva uma observação.</p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={confirmarMovimento}
                disabled={!selectedTag && !orphanObs.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle size={12} /> Confirmar
              </button>
              <button
                onClick={() => { setPendingOrphanConfirm(null); setOrphanObs(''); setSelectedTag(null); setShowNovaTag(false); setNovaTagNome(''); }}
                className="px-4 py-2 text-slate-500 hover:text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
