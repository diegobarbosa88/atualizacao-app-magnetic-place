import React, { useState, useEffect, useRef } from 'react';
import {
  Landmark, Upload, CheckCircle, X, ChevronDown, ChevronUp,
  AlertCircle, FileText, Loader2, Plus, ArrowLeftRight, Pencil, Zap
} from 'lucide-react';
import RelatorioModal from './RelatorioModal';
import CsvMappingCard from './CsvMappingCard';
import TipoBadge from './TipoBadge';
import AssociacaoManualModal from './reconciliacao/AssociacaoManualModal';
import OrfaoBancoModal from './reconciliacao/OrfaoBancoModal';
import AssocClienteModal from './reconciliacao/AssocClienteModal';
import ResultadosTabs from './reconciliacao/ResultadosTabs';
import HistoricoSection from './reconciliacao/HistoricoSection';
import { useReconciliacaoRun } from './reconciliacao/useReconciliacaoRun';
import { useApp } from '../../context/AppContext';

export default function ReconciliacaoAdmin() {
  const { supabase, clients } = useApp();

  // ── Upload state ──────────────────────────────────────────────────────────
  const [ficheiros, setFicheiros] = useState([]);
  const [previewErrors, setPreviewErrors] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [erro, setErro] = useState(null);
  const inputRef = useRef(null);

  // ── Preview state ─────────────────────────────────────────────────────────
  const [previewTransacoes, setPreviewTransacoes] = useState(null);
  const [previewFilename, setPreviewFilename] = useState('');
  const [selTransacoes, setSelTransacoes] = useState(new Set());
  const [txSearch, setTxSearch] = useState('');
  const [txTipoFiltro, setTxTipoFiltro] = useState('todos');
  const [editingTxIdx, setEditingTxIdx] = useState(null);
  const [csvMapping, setCsvMapping] = useState(null);
  const [colMap, setColMap] = useState({ dataCol: '', valorCol: '', descricaoCol: '', debitoCol: '', creditoCol: '', tipoCol: '', modo: 'valor' });

  // ── TOConline import state ────────────────────────────────────────────────
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const [tocPainelAberto, setTocPainelAberto] = useState(false);
  const [tocDe, setTocDe] = useState(mesAtual);
  const [tocAte, setTocAte] = useState(mesAtual);
  const [tocProcessando, setTocProcessando] = useState(false);
  const [tocErro, setTocErro] = useState(null);

  const importarDoTOConline = async () => {
    setTocProcessando(true);
    setTocErro(null);
    run.setResultado(null);
    try {
      const res = await fetch('/api/reconciliacao/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fonte: 'toconline', de: tocDe, ate: tocAte }),
      });
      const data = await res.json();
      if (!res.ok) { setTocErro(data.error || 'Erro ao importar.'); return; }
      run.setResultado(data);
      run.setActiveSubTab('matched');
      setTocPainelAberto(false);
      carregarHistorico();
      if (data.run_id) {
        await run.autoAssociarEntradas(data, data.run_id);
        const fullResults = { matched: data.matched || [], orphan_bank: data.orphan_bank || [], orphan_system: data.orphan_system || [] };
        const newMatched = await run.autoConfirmarMatched(data.matched || [], data.run_id, fullResults);
        run.setResultado(prev => ({ ...prev, matched: newMatched }));
        await run.carregarPagamentosLinks(data.run_id);
      }
    } catch (err) {
      setTocErro(err.message || 'Erro de rede.');
    } finally {
      setTocProcessando(false);
    }
  };

  // ── Form state ────────────────────────────────────────────────────────────
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

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    carregarHistorico();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      run.setAliases(aliasData || []);
    } finally {
      setLoadingHistorico(false);
    }
  };

  // ── Drag & Drop ───────────────────────────────────────────────────────────
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

  // ── Pré-visualizar movimentos ─────────────────────────────────────────────
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

  // ── Confirmar mapeamento CSV ───────────────────────────────────────────────
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
      setFicheiros(restantes.length ? restantes : []);
    } catch (err) {
      setErro(err.message || 'Erro de rede.');
    } finally {
      setPreviewing(false);
    }
  };

  // ── Processar movimentos seleccionados ────────────────────────────────────
  const processar = async () => {
    if (!previewTransacoes) return;
    const selected = previewTransacoes.filter((_, i) => selTransacoes.has(i));
    if (!selected.length) { setErro('Seleccione pelo menos um movimento.'); return; }
    setProcessando(true);
    setErro(null);
    run.setResultado(null);
    try {
      const res = await fetch('/api/reconciliacao/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions_json: selected, filename: previewFilename }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro ao processar.'); return; }
      run.setResultado(data);
      run.setActiveSubTab('matched');
      setPreviewTransacoes(null);
      setFicheiros([]);
      carregarHistorico();
      if (data.run_id) {
        await run.autoAssociarEntradas(data, data.run_id);
        const fullResults = { matched: data.matched || [], orphan_bank: data.orphan_bank || [], orphan_system: data.orphan_system || [] };
        const newMatched = await run.autoConfirmarMatched(data.matched || [], data.run_id, fullResults);
        run.setResultado(prev => ({ ...prev, matched: newMatched }));
        await run.carregarPagamentosLinks(data.run_id);
      }
    } catch (err) {
      setErro(err.message || 'Erro de rede.');
    } finally {
      setProcessando(false);
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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black flex items-center gap-2">
          <Landmark size={24} className="text-indigo-600" /> Reconciliação Bancária
        </h2>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest">
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
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Importar Extrato Bancário</h3>
        <div
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
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
                    className="text-slate-400 hover:text-rose-500 flex-shrink-0"><X size={13} /></button>
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

      {/* Importar do TOConline */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <button
          onClick={() => setTocPainelAberto(v => !v)}
          className="w-full px-6 sm:px-8 py-5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl"><Zap size={15} className="text-emerald-600" /></div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Importar do TOConline</p>
              <p className="text-xs text-slate-400">Busca movimentos directamente da API bancária</p>
            </div>
          </div>
          {tocPainelAberto ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </button>
        {tocPainelAberto && (
          <div className="px-6 sm:px-8 pb-6 space-y-4 border-t border-slate-100">
            <div className="pt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">De (mês)</label>
                <input type="month" value={tocDe} onChange={e => setTocDe(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Até (mês)</label>
                <input type="month" value={tocAte} onChange={e => setTocAte(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
            </div>
            {tocErro && (
              <div className="flex items-start gap-2 bg-rose-50 text-rose-700 rounded-xl p-3 text-xs">
                <AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{tocErro}</span>
              </div>
            )}
            <button
              onClick={importarDoTOConline}
              disabled={tocProcessando || !tocDe || !tocAte}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-2xl py-3 hover:bg-emerald-700 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            >
              {tocProcessando ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {tocProcessando ? 'A importar movimentos...' : 'Importar e Reconciliar'}
            </button>
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

      {/* Preview de movimentos */}
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
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Seleccionar Movimentos</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selTransacoes.size} de {previewTransacoes.length} seleccionados</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setPreviewTransacoes(null); setFicheiros([]); setPreviewErrors([]); setErro(null); }}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:border-slate-300 transition-all">
                  <X size={11} className="inline mr-1" />Cancelar
                </button>
                <button onClick={processar} disabled={processando || selTransacoes.size === 0}
                  className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
                  {processando ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeftRight size={12} />}
                  Processar {selTransacoes.size > 0 ? `(${selTransacoes.size})` : ''}
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
                        : 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}>{label}</button>
              ))}
            </div>

            <input value={txSearch} onChange={e => setTxSearch(e.target.value)}
              placeholder="Filtrar por descrição ou valor..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />

            <div className="flex items-center gap-3 px-1">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer select-none">
                <input type="checkbox" checked={allVisibleSelected}
                  onChange={e => setSelTransacoes(prev => {
                    const s = new Set(prev);
                    allVisible.forEach(i => e.target.checked ? s.add(i) : s.delete(i));
                    return s;
                  })}
                  className="accent-indigo-600 w-4 h-4" />
                {allVisibleSelected ? 'Desseleccionar visíveis' : 'Seleccionar visíveis'}
              </label>
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {visibleIndices.length === 0 && (
                <p className="text-center text-slate-400 py-6 text-sm">Nenhum movimento corresponde ao filtro.</p>
              )}
              {visibleIndices.map(({ tx, i }) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${selTransacoes.has(i) ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50 border border-transparent hover:bg-slate-100'}`}>
                  <input type="checkbox" checked={selTransacoes.has(i)}
                    onChange={e => setSelTransacoes(prev => { const s = new Set(prev); e.target.checked ? s.add(i) : s.delete(i); return s; })}
                    className="accent-indigo-600 w-4 h-4 flex-shrink-0 cursor-pointer" />
                  <div className="flex-1 min-w-0">
                    {tx._source && <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 truncate mb-0.5">{tx._source}</p>}
                    {editingTxIdx === i ? (
                      <input autoFocus
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
                  <button onClick={() => setEditingTxIdx(editingTxIdx === i ? null : i)}
                    className={`flex-shrink-0 transition-all ${editingTxIdx === i ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-400'}`}
                    title="Editar descrição"><Pencil size={12} /></button>
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

      {/* Resultados */}
      <ResultadosTabs
        displayData={run.displayData}
        runSelecionado={run.runSelecionado} setRunSelecionado={run.setRunSelecionado}
        activeSubTab={run.activeSubTab} setActiveSubTab={run.setActiveSubTab}
        selMatched={run.selMatched} setSelMatched={run.setSelMatched}
        selOrphan={run.selOrphan} setSelOrphan={run.setSelOrphan}
        bulkConfirmando={run.bulkConfirmando} confirmando={run.confirmando}
        confirmedOrphans={run.confirmedOrphans} orphanObservacoes={run.orphanObservacoes} orphanClassificacoes={run.orphanClassificacoes}
        confirmandoEntrada={run.confirmandoEntrada} desvinculando={run.desvinculando} excluindo={run.excluindo}
        editingResultDesc={run.editingResultDesc} setEditingResultDesc={run.setEditingResultDesc}
        pagamentosLinks={run.pagamentosLinks} clientAssocMatched={run.clientAssocMatched} orphanBankAssocSet={run.orphanBankAssocSet}
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
        historico={historico} setHistorico={setHistorico}
        historicoAberto={historicoAberto} setHistoricoAberto={setHistoricoAberto}
        loadingHistorico={loadingHistorico}
        selHistorico={selHistorico} setSelHistorico={setSelHistorico}
        relatorioRuns={relatorioRuns} setRelatorioRuns={setRelatorioRuns}
        showRelatorio={showRelatorio} setShowRelatorio={setShowRelatorio}
        loadingMultiRel={loadingMultiRel} setLoadingMultiRel={setLoadingMultiRel}
        runSelecionado={run.runSelecionado} setRunSelecionado={run.setRunSelecionado}
        reprocessando={run.reprocessando}
        supabase={supabase}
        autoAssociarEntradas={run.autoAssociarEntradas}
        autoConfirmarMatched={run.autoConfirmarMatched}
        carregarPagamentosLinks={run.carregarPagamentosLinks}
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
          filename={run.runSelecionado?.filename ?? run.resultado?.filename ?? 'extrato'}
          dataRun={run.runSelecionado
            ? new Date(run.runSelecionado.created_at).toLocaleDateString('pt-PT')
            : new Date().toLocaleDateString('pt-PT')}
          runs={relatorioRuns}
          onClose={() => { setShowRelatorio(false); setRelatorioRuns(null); }}
        />
      )}
    </div>
  );
}
