import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Landmark, Upload, CheckCircle, X, AlertCircle, FileText, Loader2, Plus,
  ArrowLeftRight, Pencil, Zap,
} from 'lucide-react';
import RelatorioModal from './RelatorioModal';
import CsvMappingCard from './CsvMappingCard';
import TipoBadge from './TipoBadge';
import AssociacaoManualModal from './reconciliacao/AssociacaoManualModal';
import { FT } from '../../styles/designTokens';
import OrfaoBancoModal from './reconciliacao/OrfaoBancoModal';
import AssocClienteModal from './reconciliacao/AssocClienteModal';
import ResultadosTabs from './reconciliacao/ResultadosTabs';
import HistoricoSection from './reconciliacao/HistoricoSection';
import { useReconciliacaoRun } from './reconciliacao/useReconciliacaoRun';
import { fmtMes } from './movimentacoes/txUtils';
import { useApp } from '../../context/AppContext';
import { authFetch } from '../../utils/authFetch';
import './reconciliacao/reconciliacao-mockup.css';

export default function ReconciliacaoAdmin() {
  const { supabase, clients } = useApp();

  // ── Origem selecionada — escolha simétrica, sem acordeão escondido ────────
  const [origem, setOrigem] = useState('toconline'); // 'toconline' | 'ficheiro'

  // ── Upload (ficheiro) ──────────────────────────────────────────────────────
  const [ficheiros, setFicheiros] = useState([]);
  const [previewErrors, setPreviewErrors] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [erro, setErro] = useState(null);
  const inputRef = useRef(null);
  const [csvMapping, setCsvMapping] = useState(null);
  const [colMap, setColMap] = useState({ dataCol: '', valorCol: '', descricaoCol: '', debitoCol: '', creditoCol: '', tipoCol: '', modo: 'valor' });

  // ── TOConline ──────────────────────────────────────────────────────────────
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const [contasDisponiveis, setContasDisponiveis] = useState([]);
  const [contasCarregadas, setContasCarregadas] = useState(false);
  const [tocContaId, setTocContaId] = useState('');
  const [tocDe, setTocDe] = useState(mesAtual);
  const [tocAte, setTocAte] = useState(mesAtual);
  const [tocBuscando, setTocBuscando] = useState(false);
  const [tocErro, setTocErro] = useState(null);

  useEffect(() => {
    if (origem !== 'toconline' || contasCarregadas) return;
    setContasCarregadas(true);
    authFetch('/api/toconline/bank-accounts')
      .then(r => r.json())
      .then(d => {
        const conectadas = (d.data || []).filter(c => (c.attributes || c).is_connected);
        setContasDisponiveis(conectadas);
        if (conectadas.length) setTocContaId(String(conectadas[0].id));
      })
      .catch(() => {});
  }, [origem, contasCarregadas]);

  // ── Preview acumulativo — o "cesto" partilhado por qualquer origem ────────
  const [previewTransacoes, setPreviewTransacoes] = useState(null);
  const [previewFontes, setPreviewFontes] = useState([]); // rótulos das fontes já acumuladas
  const [selTransacoes, setSelTransacoes] = useState(new Set());
  const [txSearch, setTxSearch] = useState('');
  const [txTipoFiltro, setTxTipoFiltro] = useState('todos');
  const [editingTxIdx, setEditingTxIdx] = useState(null);

  const adicionarAoPreview = (novasTx, fonteLabel) => {
    if (!novasTx.length) return;
    setPreviewTransacoes(prev => {
      const base = prev || [];
      const comFonte = novasTx.map(tx => ({ ...tx, _source: tx._source || fonteLabel }));
      const merged = [...base, ...comFonte];
      setSelTransacoes(prevSel => {
        const s = new Set(prevSel);
        for (let i = base.length; i < merged.length; i++) s.add(i);
        return s;
      });
      return merged;
    });
    setPreviewFontes(prev => [...prev, fonteLabel]);
    setTxSearch(''); setTxTipoFiltro('todos');
  };

  const limparPreview = () => {
    setPreviewTransacoes(null);
    setPreviewFontes([]);
    setFicheiros([]);
    setPreviewErrors([]);
    setErro(null);
    setTocErro(null);
  };

  // ── Buscar do TOConline (preview, não processa direto) ────────────────────
  const buscarDoTOConline = async () => {
    if (!tocContaId || !tocDe || !tocAte) return;
    setTocBuscando(true); setTocErro(null);
    try {
      const res = await authFetch('/api/reconciliacao/process?action=toconline-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contaId: tocContaId, de: tocDe, ate: tocAte }),
      });
      const data = await res.json();
      if (!res.ok) { setTocErro(data.error || 'Erro ao buscar movimentos.'); return; }
      if (!data.transactions?.length) { setTocErro(`Sem movimentos em "${data.conta}" entre ${tocDe} e ${tocAte}.`); return; }
      const label = `${data.conta} (${tocDe} a ${tocAte})`;
      adicionarAoPreview(data.transactions, label);
    } catch (err) {
      setTocErro(err.message || 'Erro de rede.');
    } finally {
      setTocBuscando(false);
    }
  };

  // ── Upload de ficheiro (mantém parse/mapeamento, mas acrescenta ao preview) ─
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); adicionarFicheiros(e.dataTransfer.files); };
  const handleFileChange = (e) => { adicionarFicheiros(e.target.files); e.target.value = ''; };

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

  const previsar = async () => {
    if (!ficheiros.length) return;
    setPreviewing(true);
    setErro(null);
    setPreviewErrors([]);
    const allTx = [];
    const errors = [];
    for (let idx = 0; idx < ficheiros.length; idx++) {
      const f = ficheiros[idx];
      try {
        const fp = new FormData();
        fp.append('file', f);
        const res = await authFetch('/api/reconciliacao/parse', { method: 'POST', body: fp });
        const data = await res.json();
        if (!res.ok) { errors.push({ filename: f.name, error: data.error || 'Erro ao ler' }); continue; }
        if (data.needs_mapping) {
          const remaining = ficheiros.slice(idx + 1);
          if (allTx.length) adicionarAoPreview(allTx, ficheiros.slice(0, idx).map(x => x.name).join(', '));
          setFicheiros([f, ...remaining]);
          setCsvMapping({ columns: data.columns, preview: data.preview });
          setColMap({ dataCol: '', valorCol: '', descricaoCol: '', debitoCol: '', creditoCol: '', tipoCol: '', modo: 'valor' });
          if (errors.length) setPreviewErrors(errors);
          setPreviewing(false);
          return;
        }
        allTx.push(...data.transactions.map(tx => ({ ...tx, _source: f.name })));
      } catch (err) {
        errors.push({ filename: f.name, error: err.message || 'Erro de rede' });
      }
    }
    if (errors.length) setPreviewErrors(errors);
    if (allTx.length) adicionarAoPreview(allTx, ficheiros.map(f => f.name).join(', '));
    setFicheiros([]);
    setPreviewing(false);
  };

  const confirmarMapeamento = async () => {
    if (!ficheiros.length) return;
    const ficheiroAtual = ficheiros[0];
    const restantes = ficheiros.slice(1);
    setPreviewing(true);
    setErro(null);
    try {
      const formPayload = new FormData();
      formPayload.append('file', ficheiroAtual);
      formPayload.append('column_mapping', JSON.stringify({ ...colMap }));
      const res = await authFetch('/api/reconciliacao/parse', { method: 'POST', body: formPayload });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro ao ler ficheiro.'); return; }
      const novasTx = data.transactions.map(tx => ({ ...tx, _source: ficheiroAtual.name }));
      setCsvMapping(null);
      adicionarAoPreview(novasTx, ficheiroAtual.name);
      setFicheiros(restantes.length ? restantes : []);
    } catch (err) {
      setErro(err.message || 'Erro de rede.');
    } finally {
      setPreviewing(false);
    }
  };

  // ── Processar — único ponto de entrada, independente da mistura de origens ─
  const processar = async () => {
    if (!previewTransacoes) return;
    const selected = previewTransacoes.filter((_, i) => selTransacoes.has(i));
    if (!selected.length) { setErro('Seleccione pelo menos um movimento.'); return; }
    setProcessando(true);
    setErro(null);
    try {
      const filenameLabel = previewFontes.join(' + ') || 'movimentos';
      const res = await authFetch('/api/reconciliacao/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions_json: selected, filename: filenameLabel }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro ao processar.'); return; }

      const runShape = {
        id: data.run_id,
        filename: data.filename,
        created_at: new Date().toISOString(),
        matched_count: data.matched_count,
        orphan_bank_count: data.orphan_bank_count,
        orphan_system_count: data.orphan_system_count,
        transactions_json: selected,
        results_json: { matched: data.matched, orphan_bank: data.orphan_bank, orphan_system: data.orphan_system },
      };
      run.iniciarRunCriado(runShape);
      run.setActiveSubTab('matched');
      limparPreview();
      carregarHistorico();
      run.carregarSaldoManual();

      await run.autoAssociarEntradas(runShape.results_json, data.run_id);
      const newMatched = await run.autoConfirmarMatched(data.matched || [], data.run_id, runShape.results_json);
      run.setActiveRun(prev => (prev ? { ...prev, results_json: { ...prev.results_json, matched: newMatched } } : prev));
      await run.carregarPagamentosLinks(data.run_id);
    } catch (err) {
      setErro(err.message || 'Erro de rede.');
    } finally {
      setProcessando(false);
    }
  };

  // ── Form state (inserção manual de fatura) ───────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ tipo: 'fatura', valor: '', data_documento: '', descricao: '', entidade: '', fonte: 'manual' });
  const [savingFatura, setSavingFatura] = useState(false);

  // ── History state ─────────────────────────────────────────────────────────
  const [historico, setHistorico] = useState([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [selHistorico, setSelHistorico] = useState(new Set());
  const [loadingMultiRel, setLoadingMultiRel] = useState(false);
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [relatorioRuns, setRelatorioRuns] = useState(null);

  // ── Run hook ──────────────────────────────────────────────────────────────
  const run = useReconciliacaoRun(supabase, clients, { setHistorico });

  // ── Seletor de mês/ano + conta — um run por (mês, conta), o mais recente
  // quando há reimportações. Cada conta importa o seu extrato num run
  // separado (Novo Banco, Santander, ...) — agrupar só por mês escondia um
  // dos dois atrás do outro sempre que partilhavam o mesmo mês. A conta vem
  // de transactions_json[0].conta (só preenchido em imports via TOConline);
  // uploads manuais de CSV sem essa coluna caem no fallback 'Ficheiro'. ────
  const periodosDisponiveis = useMemo(() => {
    const porPeriodo = new Map();
    historico.forEach(r => {
      const mesAno = (r.transactions_json?.[0]?.data || '').slice(0, 7);
      if (!mesAno) return;
      const conta = r.transactions_json?.[0]?.conta || 'Ficheiro';
      const chave = `${mesAno}|${conta}`;
      if (porPeriodo.has(chave)) return; // historico já vem ordenado created_at desc → 1º = mais recente
      porPeriodo.set(chave, { mesAno, conta, runId: r.id });
    });
    return [...porPeriodo.values()]
      .sort((a, b) => b.mesAno.localeCompare(a.mesAno) || a.conta.localeCompare(b.conta))
      .map(p => ({ ...p, label: `${fmtMes(p.mesAno)} — ${p.conta}` }));
  }, [historico]);

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    carregarHistorico();
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ao carregar o histórico, se ainda não há nada em ecrã, mostra logo o
  // período mais recente — evita ecrã vazio até o Diego abrir o histórico.
  useEffect(() => {
    if (run.activeRun || !periodosDisponiveis.length) return;
    run.selecionarRun(periodosDisponiveis[0].runId);
  }, [periodosDisponiveis]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregarHistorico = async () => {
    if (!supabase) return;
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
      run.setAliases(aliasData || []);
    } finally {
      setLoadingHistorico(false);
    }
  };

  // ── Guardar fatura manual ─────────────────────────────────────────────────
  const guardarFatura = async () => {
    if (!formData.valor || !formData.data_documento) { alert('Valor e data são obrigatórios.'); return; }
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
        gmail_message_id: `manual-${Date.now()}`,
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

  return (
    <div className="recon-scope animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black flex items-center gap-2">
          <Landmark size={24} style={{ color: FT.slate }} /> Reconciliação Bancária
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {periodosDisponiveis.length > 0 && (
            <select
              value={run.activeRun?.id || ''}
              onChange={e => { if (e.target.value) run.selecionarRun(e.target.value); }}
              className="border border-slate-200 rounded-2xl px-4 py-2 text-[11px] font-black tracking-widest text-[var(--ink-soft)] bg-white hover:bg-[var(--surface)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30"
              style={{ textTransform: 'uppercase' }}
            >
              {!run.activeRun && <option value="">Selecionar período…</option>}
              {periodosDisponiveis.map(p => (
                <option key={p.runId} value={p.runId}>{p.label}</option>
              ))}
            </select>
          )}
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-dim)] rounded-2xl border border-slate-200 hover:bg-slate-200 transition-all text-[10px] font-black uppercase tracking-widest"
            style={{ color: FT.slateDim }}>
            <Plus size={14} /> Inserir Fatura Manual
          </button>
        </div>
      </div>

      {/* Faixa de estatísticas — substitui os contadores espalhados pelas tabs + o chip solto de saldo */}
      {run.displayData && (() => {
        const nMatched = (run.displayData.matched?.length ?? 0) + run.clientAssocMatched.length;
        const nOrphanBank = Math.max(0, (run.displayData.orphan_bank?.length ?? 0) - run.orphanBankAssocSet.size - run.orphanBankSepaLoteSet.size);
        const nOrphanSystem = run.displayData.orphan_system?.length ?? 0;
        return (
          <div className="recon-stat-strip mb-6">
            <div className="recon-stat">
              <p className="recon-stat-label">Reconciliados</p>
              <p className="recon-stat-value" style={{ color: 'var(--green)' }}>{nMatched}</p>
            </div>
            <div className="recon-stat">
              <p className="recon-stat-label">Órfãos Banco</p>
              <p className="recon-stat-value" style={{ color: 'var(--amber)' }}>{nOrphanBank}</p>
            </div>
            <div className="recon-stat">
              <p className="recon-stat-label">Órfãos Sistema</p>
              <p className="recon-stat-value">{nOrphanSystem}</p>
            </div>
            <div className="recon-stat">
              <p className="recon-stat-label">Novobanco Poupança</p>
              <p className="recon-stat-value" style={{ color: 'var(--slate)' }}>
                {run.saldoManual == null ? '—' : `€${Number(run.saldoManual.saldo).toFixed(2)}`}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Formulário inserção manual */}
      {showForm && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-[var(--border-soft)] p-6 space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Nova Fatura / Recibo</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] mb-1">Tipo</label>
              <select value={formData.tipo} onChange={e => setFormData(p => ({...p, tipo: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
                <option value="fatura">Fatura</option>
                <option value="recibo">Recibo</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] mb-1">Valor (€)</label>
              <input type="number" step="0.01" value={formData.valor} onChange={e => setFormData(p => ({...p, valor: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] mb-1">Data Documento</label>
              <input type="date" value={formData.data_documento} onChange={e => setFormData(p => ({...p, data_documento: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] mb-1">Entidade (nome/NIF)</label>
              <input type="text" value={formData.entidade} onChange={e => setFormData(p => ({...p, entidade: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="Nome ou NIF" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] mb-1">Descrição</label>
              <input type="text" value={formData.descricao} onChange={e => setFormData(p => ({...p, descricao: e.target.value}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="Descrição opcional" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={guardarFatura} disabled={savingFatura}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-xl transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: FT.navy }}>
              {savingFatura ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Guardar
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 text-[var(--slate-dim)] hover:text-[var(--ink-mid)] rounded-xl text-[10px] font-black uppercase tracking-widest">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Seletor de origem — simétrico, sem acordeão escondido */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-[var(--border-soft)] p-6 sm:p-8 space-y-5">
        <div className="recon-segmented">
          {[
            { key: 'toconline', label: 'TOConline', icon: Zap },
            { key: 'ficheiro', label: 'Ficheiro', icon: Upload },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setOrigem(key)} className={origem === key ? 'active' : ''}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {origem === 'toconline' ? (
          <div className="space-y-4">
            {contasCarregadas && contasDisponiveis.length === 0 && (
              <div className="flex items-start gap-2 bg-amber-50 text-amber-700 rounded-xl p-3 text-xs">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>Nenhuma conta ligada ao TOConline encontrada. Liga uma conta em Faturação → TOConline primeiro.</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] mb-1">Conta</label>
                <select value={tocContaId} onChange={e => setTocContaId(e.target.value)}
                  disabled={!contasDisponiveis.length}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-50">
                  {contasDisponiveis.map(c => {
                    const a = c.attributes || c;
                    return <option key={c.id} value={c.id}>{a.name} {a.iban ? `— ${a.iban.slice(-6)}` : ''}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] mb-1">De (mês)</label>
                <input type="month" value={tocDe} onChange={e => setTocDe(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] mb-1">Até (mês)</label>
                <input type="month" value={tocAte} onChange={e => setTocAte(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
            </div>
            {tocErro && (
              <div className="flex items-start gap-2 bg-rose-50 text-rose-700 rounded-xl p-3 text-xs">
                <AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{tocErro}</span>
              </div>
            )}
            <button
              onClick={buscarDoTOConline}
              disabled={tocBuscando || !tocContaId || !tocDe || !tocAte}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-2xl py-3 hover:bg-emerald-700 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            >
              {tocBuscando ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {tocBuscando ? 'A buscar movimentos...' : 'Buscar Movimentos'}
            </button>
          </div>
        ) : (
          <div>
            <div
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 sm:p-8 text-center cursor-pointer transition-all ${
                dragging ? 'border-[var(--slate)] bg-[var(--surface)]' : 'border-slate-200 hover:border-[var(--slate)] hover:bg-[var(--surface)]'
              }`}
            >
              <input ref={inputRef} type="file" accept=".csv,.ofx,.qfx,.pdf" multiple className="hidden" onChange={handleFileChange} />
              <Upload size={32} className="mx-auto mb-3" style={{ color: dragging ? FT.slate : '#CBD5E1' }} />
              {ficheiros.length > 0 ? (
                <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                  {ficheiros.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-center gap-2">
                      <FileText size={14} style={{ color: FT.slate }} className="flex-shrink-0" />
                      <span className="text-sm font-medium text-[var(--ink-mid)] truncate max-w-xs">{f.name}</span>
                      <button onClick={() => setFicheiros(prev => prev.filter((_, i) => i !== idx))}
                        className="text-[var(--slate)] hover:text-rose-500 flex-shrink-0"><X size={13} /></button>
                    </div>
                  ))}
                  <p className="text-[10px] font-bold uppercase tracking-widest pt-1 cursor-pointer hover:underline" style={{ color: FT.slateDim }}
                    onClick={() => inputRef.current?.click()}>
                    + Adicionar mais ficheiros
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[var(--slate-dim)] font-medium">Arraste ficheiros CSV, OFX ou PDF aqui</p>
                  <p className="text-[10px] text-[var(--slate-dim)] mt-1 uppercase tracking-widest">ou clique para escolher (múltiplos permitidos)</p>
                </>
              )}
            </div>

            {erro && (
              <div className="mt-3 flex items-start gap-2 bg-rose-50 text-rose-700 rounded-xl p-3 text-sm">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /><span>{erro}</span>
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
                className="mt-4 w-full flex items-center justify-center gap-2 text-white rounded-2xl py-3 transition-all text-[10px] font-black uppercase tracking-widest hover:opacity-90"
                style={{ backgroundColor: FT.navy }}>
                <ArrowLeftRight size={14} /> Adicionar {ficheiros.length > 1 ? `${ficheiros.length} Ficheiros` : 'Movimentos'} ao Preview
              </button>
            )}
            {previewing && (
              <div className="mt-4 flex items-center justify-center gap-2" style={{ color: FT.slateDim }}>
                <Loader2 size={18} className="animate-spin" /> A ler ficheiros...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mapeamento de colunas CSV */}
      {csvMapping && (
        <CsvMappingCard
          csvMapping={csvMapping} colMap={colMap} setColMap={setColMap}
          previewing={previewing} confirmarMapeamento={confirmarMapeamento}
          onCancel={() => { setCsvMapping(null); setFicheiros([]); setErro(null); }}
        />
      )}

      {/* Preview acumulativo — cesto partilhado por qualquer origem já adicionada */}
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
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-[var(--border-soft)] p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Seleccionar Movimentos</h3>
                <p className="text-xs text-[var(--slate-dim)] mt-0.5">{selTransacoes.size} de {previewTransacoes.length} seleccionados · fontes: {previewFontes.join(', ')}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={limparPreview}
                  className="px-3 py-1.5 text-[var(--slate-dim)] hover:text-[var(--ink-soft)] rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:border-slate-300 transition-all">
                  <X size={11} className="inline mr-1" />Limpar tudo
                </button>
                <button onClick={processar} disabled={processando || selTransacoes.size === 0}
 className="flex items-center gap-2 px-4 py-1.5 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:opacity-90"
                  style={{ backgroundColor: FT.orange, color: FT.navy }}>
                  {processando ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeftRight size={12} />}
                  Processar Selecionados {selTransacoes.size > 0 ? `(${selTransacoes.size})` : ''}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              {[
                { key: 'todos', label: `Todos (${previewTransacoes.length})` },
                { key: 'debito', label: `Saídas (${nDebito})` },
                { key: 'credito', label: `Entradas (${nCredito})` },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setTxTipoFiltro(key)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                    txTipoFiltro === key
                      ? key === 'debito' ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-300'
                        : key === 'credito' ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                        : 'bg-slate-200 text-[var(--ink-mid)] ring-2 ring-slate-300'
                      : 'bg-[var(--surface-dim)] text-[var(--ink-soft)] hover:bg-slate-200'
                  }`}>{label}</button>
              ))}
            </div>

            <input value={txSearch} onChange={e => setTxSearch(e.target.value)}
              placeholder="Filtrar por descrição ou valor..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30" />

            <div className="flex items-center gap-3 px-1">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] cursor-pointer select-none">
                <input type="checkbox" checked={allVisibleSelected}
                  onChange={e => setSelTransacoes(prev => {
                    const s = new Set(prev);
                    allVisible.forEach(i => e.target.checked ? s.add(i) : s.delete(i));
                    return s;
                  })}
                  className="accent-[var(--navy)] w-4 h-4" />
                {allVisibleSelected ? 'Desseleccionar visíveis' : 'Seleccionar visíveis'}
              </label>
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {visibleIndices.length === 0 && (
                <p className="text-center text-[var(--slate-dim)] py-6 text-sm">Nenhum movimento corresponde ao filtro.</p>
              )}
              {visibleIndices.map(({ tx, i }) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${selTransacoes.has(i) ? 'border-transparent' : 'bg-[var(--surface)] border-transparent hover:bg-[var(--surface-dim)]'}`}
                  style={selTransacoes.has(i) ? { backgroundColor: 'rgba(235,141,0,0.08)' } : {}}>
                  <input type="checkbox" checked={selTransacoes.has(i)}
                    onChange={e => setSelTransacoes(prev => { const s = new Set(prev); e.target.checked ? s.add(i) : s.delete(i); return s; })}
                    className="accent-[var(--navy)] w-4 h-4 flex-shrink-0 cursor-pointer" />
                  <div className="flex-1 min-w-0">
                    {tx._source && <p className="text-[9px] font-black uppercase tracking-widest text-[var(--slate-dim)] truncate mb-0.5">{tx._source}</p>}
                    {editingTxIdx === i ? (
                      <input autoFocus
                        className="w-full text-xs text-[var(--ink-mid)] font-medium border-b border-[var(--navy)] bg-transparent outline-none pb-0.5"
                        value={tx.descricao}
                        onChange={e => setPreviewTransacoes(prev => prev.map((t, j) => j === i ? { ...t, descricao: e.target.value } : t))}
                        onBlur={() => setEditingTxIdx(null)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTxIdx(null); }}
                      />
                    ) : (
                      <p className="text-xs text-[var(--ink-mid)] font-medium truncate">{tx.descricao || '—'}</p>
                    )}
                    <p className="text-[10px] text-[var(--slate-dim)]">{tx.data}</p>
                  </div>
                  <button onClick={() => setEditingTxIdx(editingTxIdx === i ? null : i)}
                    className={`flex-shrink-0 transition-all ${editingTxIdx === i ? '' : 'text-[var(--slate)] hover:text-[var(--slate)]'}`}
                    style={editingTxIdx === i ? { color: FT.slate } : {}}
                    title="Editar descrição"><Pencil size={12} /></button>
                  <div className="text-right flex-shrink-0 flex items-center gap-2">
                    <TipoBadge tipo={tx.tipo} />
                    <span className="text-sm font-bold text-[var(--ink-mid)]">€{Number(tx.valor).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Resultados */}
      <ResultadosTabs
        displayData={run.displayData} saldoManual={run.saldoManual}
        activeRun={run.activeRun} lastCreatedRun={run.lastCreatedRun} voltarAoRunAtual={run.voltarAoRunAtual}
        activeSubTab={run.activeSubTab} setActiveSubTab={run.setActiveSubTab}
        selMatched={run.selMatched} setSelMatched={run.setSelMatched}
        selOrphan={run.selOrphan} setSelOrphan={run.setSelOrphan}
        bulkConfirmando={run.bulkConfirmando} confirmando={run.confirmando}
        confirmedOrphans={run.confirmedOrphans} orphanObservacoes={run.orphanObservacoes} orphanClassificacoes={run.orphanClassificacoes}
        confirmandoEntrada={run.confirmandoEntrada} desvinculando={run.desvinculando} excluindo={run.excluindo}
        editingResultDesc={run.editingResultDesc} setEditingResultDesc={run.setEditingResultDesc}
        pagamentosLinks={run.pagamentosLinks} clientAssocMatched={run.clientAssocMatched} orphanBankAssocSet={run.orphanBankAssocSet}
        orphanBankSepaLoteSet={run.orphanBankSepaLoteSet}
        autoAssociando={run.autoAssociando} setAutoAssociando={run.setAutoAssociando}
        aliases={run.aliases} showAliases={run.showAliases} setShowAliases={run.setShowAliases}
        showRelatorio={showRelatorio} setShowRelatorio={setShowRelatorio}
        relatorioRuns={relatorioRuns} setRelatorioRuns={setRelatorioRuns}
        clients={clients} supabase={supabase}
        txLinkInfo={run.txLinkInfo}
        autoAssociarEntradas={run.autoAssociarEntradas} carregarPagamentosLinks={run.carregarPagamentosLinks}
        confirmarPagamento={run.confirmarPagamento} confirmarBulkMatched={run.confirmarBulkMatched}
        pedirObservacaoOrphan={run.pedirObservacaoOrphan}
        abrirAssociarFatura={run.abrirAssociarFatura} abrirAssociarCliente={run.abrirAssociarCliente}
        removerAssociacaoCliente={run.removerAssociacaoCliente}
        confirmarEntrada={run.confirmarEntrada} desvincularMatch={run.desvincularMatch}
        excluirItem={run.excluirItem} saveResultDescricao={run.saveResultDescricao}
      />

      {/* Histórico */}
      <HistoricoSection
        historico={historico}
        historicoAberto={historicoAberto} setHistoricoAberto={setHistoricoAberto}
        loadingHistorico={loadingHistorico}
        selHistorico={selHistorico} setSelHistorico={setSelHistorico}
        setRelatorioRuns={setRelatorioRuns}
        setShowRelatorio={setShowRelatorio}
        loadingMultiRel={loadingMultiRel} setLoadingMultiRel={setLoadingMultiRel}
        reprocessando={run.reprocessando}
        supabase={supabase}
        selecionarRun={run.selecionarRun}
        apagarRun={run.apagarRun} reprocessarRun={run.reprocessarRun}
      />

      {/* Modais */}
      {run.pendingAssociacao && (
        <AssociacaoManualModal
          tx={run.pendingAssociacao.transacao}
          txValor={run.pendingAssociacao.transacao.valor}
          faturas={run.assocFaturas}
          loading={run.loadingAssoc}
          onClose={() => run.setPendingAssociacao(null)}
          onSelect={(fatura, saveAlias) => run.confirmarAssociacaoManual(fatura, saveAlias)}
        />
      )}
      {run.pendingOrphanConfirm && (
        <OrfaoBancoModal
          indices={run.pendingOrphanConfirm.indices}
          tags={run.tags}
          onCreateTag={run.criarTag}
          onClose={() => run.setPendingOrphanConfirm(null)}
          onSave={run.confirmarMovimento}
        />
      )}
      {run.assocClienteModal && (
        <AssocClienteModal
          modal={run.assocClienteModal}
          clients={clients}
          onClose={() => run.setAssocClienteModal(null)}
          onSave={run.salvarAssociacaoCliente}
        />
      )}
      {showRelatorio && (relatorioRuns || run.displayData) && (
        <RelatorioModal
          displayData={relatorioRuns ? null : run.displayData}
          filename={run.activeRun?.filename ?? 'extrato'}
          dataRun={run.activeRun
            ? new Date(run.activeRun.created_at).toLocaleDateString('pt-PT')
            : new Date().toLocaleDateString('pt-PT')}
          runs={relatorioRuns}
          onClose={() => { setShowRelatorio(false); setRelatorioRuns(null); }}
        />
      )}
    </div>
  );
}
