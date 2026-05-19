import React, { useState, useEffect, useRef } from 'react';
import {
  Landmark, Upload, CheckCircle, X, ChevronDown, ChevronUp,
  AlertCircle, Clock, FileText, Loader2, Plus, ArrowLeftRight,
  ArrowDownLeft, ArrowUpRight
} from 'lucide-react';
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

  // ── Histórico ─────────────────────────────────────────────────────────────
  const [historico, setHistorico] = useState([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [runSelecionado, setRunSelecionado] = useState(null); // run do histórico a ver

  // ── Formulário inserção manual ─────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'fatura', valor: '', data_documento: '', descricao: '', entidade: '', fonte: 'manual'
  });
  const [savingFatura, setSavingFatura] = useState(false);

  // Carregar histórico ao montar
  useEffect(() => {
    carregarHistorico();
  }, []);

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
      setResultado(prev => ({
        ...prev,
        matched: prev.matched.map(m =>
          m.fatura.id === faturaId
            ? { ...m, fatura: { ...m.fatura, status: 'PAGO' } }
            : m
        ),
      }));
    } catch (err) {
      alert(`Erro ao confirmar pagamento: ${err.message}`);
    } finally {
      setConfirmando(prev => { const s = new Set(prev); s.delete(faturaId); return s; });
    }
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
              <button key={tab.key} onClick={() => setActiveSubTab(tab.key)}
                className={`flex-1 flex-shrink-0 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeSubTab === tab.key ? 'bg-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                }`}>
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Sub-tab: Reconciliados */}
          {activeSubTab === 'matched' && (
            <div className="space-y-3">
              {(displayData.matched || []).length === 0 && (
                <p className="text-center text-slate-400 py-8 text-sm">Nenhuma transação reconciliada.</p>
              )}
              {(displayData.matched || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-emerald-50 rounded-2xl p-4 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TipoBadge tipo={item.transacao.tipo} />
                      <span className="text-sm font-bold text-slate-700">€{Number(item.transacao.valor).toFixed(2)}</span>
                      <span className="text-[10px] text-slate-400">{item.transacao.data}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                        {item.fatura.fonte === 'recibo' ? 'Recibo' : item.fatura.tipo || 'Fatura'}
                      </span>
                      <span className="text-[10px] text-slate-500">{item.fatura.entidade}</span>
                      {item.rule === 'description_match' && (
                        <span className="text-[9px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-widest">desc</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 truncate font-medium">{item.transacao.descricao}</p>
                  </div>
                  {!runSelecionado && (
                    item.fatura.status === 'PAGO' ? (
                      <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase tracking-widest flex-shrink-0">
                        <CheckCircle size={14} /> Pago
                      </span>
                    ) : (
                      <button
                        onClick={() => confirmarPagamento(item.fatura.id, item.fatura.fonte)}
                        disabled={confirmando.has(item.fatura.id)}
                        className="flex-shrink-0 flex items-center gap-1 bg-emerald-600 text-white rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
                      >
                        {confirmando.has(item.fatura.id)
                          ? <Loader2 size={12} className="animate-spin" />
                          : <CheckCircle size={12} />}
                        Confirmar Pagamento
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Sub-tab: Órfãos Banco */}
          {activeSubTab === 'orphan_bank' && (
            <div className="space-y-3">
              {(displayData.orphan_bank || []).length === 0 && (
                <p className="text-center text-slate-400 py-8 text-sm">Sem transações sem correspondência.</p>
              )}
              {(displayData.orphan_bank || []).map((item, i) => (
                <div key={i} className={`rounded-2xl p-4 ${item.reason === 'ambiguous' ? 'bg-amber-50' : 'bg-rose-50'}`}>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <TipoBadge tipo={item.transacao.tipo} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${item.reason === 'ambiguous' ? 'text-amber-700' : 'text-rose-700'}`}>
                      {item.reason === 'ambiguous' ? 'Ambíguo' : 'Sem correspondência'}
                    </span>
                    <span className="text-sm font-bold text-slate-700">€{Number(item.transacao.valor).toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400">{item.transacao.data}</span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium truncate">{item.transacao.descricao}</p>
                  {item.reason === 'ambiguous' && item.candidates && (
                    <p className="text-[10px] text-amber-600 mt-1">
                      Candidatos: {item.candidates.map(c => c.entidade).filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

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
              <button
                key={run.id}
                onClick={async () => {
                  // Carregar detalhes completos do run seleccionado
                  const { data } = await supabase
                    .from('reconciliation_runs')
                    .select('*')
                    .eq('id', run.id)
                    .single();
                  if (data) setRunSelecionado(data);
                }}
                className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-700">{run.filename}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(run.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex gap-2 text-[10px] font-black">
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{run.matched_count} ok</span>
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{run.orphan_bank_count} banco</span>
                  <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{run.orphan_system_count} sistema</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
