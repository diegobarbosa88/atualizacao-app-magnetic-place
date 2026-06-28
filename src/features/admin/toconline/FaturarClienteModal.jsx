import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, ChevronRight, CheckCircle, AlertCircle, FileText, Plus, Trash2, Save } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function periodoLabel(mes) {
  if (!mes) return '';
  const [y, m] = mes.split('-');
  return `${MESES[parseInt(m, 10) - 1]} ${y}`;
}

function periodoDefault() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function novoId() {
  return Math.random().toString(36).slice(2, 10);
}

const IVA_OPTS = [0, 6, 13, 23];

export default function FaturarClienteModal({ onClose, onFaturado, clienteIdInicial, ajudasValorInicial, periodoInicial }) {
  const { clients, logs, supabase } = useApp();

  const hoje = new Date().toISOString().slice(0, 10);
  const daqui30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [passo, setPasso] = useState(1);
  const [clienteId, setClienteId] = useState(clienteIdInicial || '');
  const [periodo, setPeriodo] = useState(periodoInicial || periodoDefault);
  const [dataFatura, setDataFatura] = useState(hoje);
  const [dataVencimento, setDataVencimento] = useState(daqui30);
  const [ajudas, setAjudas] = useState(null);
  const [carregandoAjudas, setCarregandoAjudas] = useState(false);
  const [ajudasEstimado, setAjudasEstimado] = useState(null);
  const [observacoes, setObservacoes] = useState('');
  const [emitindo, setEmitindo] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Serviços configuráveis por cliente
  const [servicosLinhas, setServicosLinhas] = useState([]);
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [configGuardada, setConfigGuardada] = useState(false);

  const cliente = useMemo(() => clients?.find(c => c.id === clienteId), [clients, clienteId]);

  const totalHoras = useMemo(() => {
    if (!clienteId || !periodo || !logs) return 0;
    return (logs || [])
      .filter(l => l.clientId === clienteId && (l.date || '').startsWith(periodo))
      .reduce((sum, l) => sum + (Number(l.hours) || 0), 0);
  }, [clienteId, periodo, logs]);

  const valorHora = Number(cliente?.valorHora ?? 0);
  const subtotalHoras = totalHoras * valorHora;
  const valorAjudas = ajudas?.valor_ajudas ?? 0;

  const totalFatura = useMemo(() => servicosLinhas.reduce((sum, s) => {
    const qty = Number(s.quantidade) || 0;
    const price = Number(s.preco_unitario ?? s.valor_fixo) || 0;
    return sum + qty * price * (1 + (s.taxa_iva || 0) / 100);
  }, 0), [servicosLinhas]);

  // Carregar invoice_config do cliente ao selecioná-lo
  useEffect(() => {
    if (!cliente) { setServicosLinhas([]); setConfigGuardada(false); return; }
    const cfg = cliente.invoice_config;
    if (cfg?.servicos?.length) {
      setServicosLinhas(cfg.servicos.map(s =>
        s.tipo === 'horas' ? { ...s, quantidade: s.quantidade ?? totalHoras, preco_unitario: s.preco_unitario ?? valorHora } : s
      ));
    } else {
      setServicosLinhas([{ id: novoId(), tipo: 'horas', descricao: 'Serviços de gestão de pessoal', taxa_iva: 0, quantidade: totalHoras, preco_unitario: valorHora, unidade: 'h' }]);
    }
    setConfigGuardada(false);
  }, [cliente?.id]);

  // Carregar ajudas ao selecionar cliente/período
  useEffect(() => {
    if (ajudasValorInicial != null) { setAjudas(null); return; }
    if (!clienteId || !periodo || !supabase) { setAjudas(null); return; }
    setCarregandoAjudas(true);
    supabase
      .from('ajudas_faturadas_clientes')
      .select('valor_ajudas, confirmado')
      .eq('client_id', clienteId)
      .eq('mes', periodo)
      .maybeSingle()
      .then(({ data }) => setAjudas(data))
      .catch(() => setAjudas(null))
      .finally(() => setCarregandoAjudas(false));
  }, [clienteId, periodo, supabase]);

  // Estimativa de ajudas baseada nos últimos meses do cliente quando não há dados confirmados
  useEffect(() => {
    if (ajudasValorInicial != null) { setAjudasEstimado(null); return; }
    const val = ajudas?.valor_ajudas ?? 0;
    if (val > 0 || !clienteId || !periodo || !supabase) { setAjudasEstimado(null); return; }
    supabase
      .from('ajudas_faturadas_clientes')
      .select('mes, valor_ajudas')
      .eq('client_id', clienteId)
      .lt('mes', periodo)
      .gt('valor_ajudas', 0)
      .order('mes', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (!data?.length) { setAjudasEstimado(null); return; }
        const media = data.reduce((s, r) => s + parseFloat(r.valor_ajudas), 0) / data.length;
        setAjudasEstimado(Math.round(media * 100) / 100);
      });
  }, [ajudas, clienteId, periodo, supabase]);

  // Pré-preencher observação quando ajudas (ou estimativa) carregam
  useEffect(() => {
    if (!clienteId || !periodo) return;
    if (ajudasValorInicial != null) {
      if (ajudasValorInicial > 0) {
        setObservacoes(`Nesta fatura estão incluidas as ajudas de custo dos trabalhadores no valor de ${Number(ajudasValorInicial).toFixed(2)} €`);
      }
      return;
    }
    const val = ajudas?.valor_ajudas ?? 0;
    const valEfetivo = val > 0 ? val : (ajudasEstimado ?? 0);
    if (valEfetivo > 0) {
      const sufixo = val === 0 && ajudasEstimado != null ? ' (estimativa)' : '';
      setObservacoes(`Nesta fatura estão incluidas as ajudas de custo dos trabalhadores no valor de ${Number(valEfetivo).toFixed(2)} €${sufixo}`);
    }
  }, [ajudas, ajudasEstimado, clienteId, periodo]);

  const podeContinuar = clienteId && periodo && totalHoras > 0;

  const updateLinha = (id, campo, valor) =>
    setServicosLinhas(prev => prev.map(s => s.id === id ? { ...s, [campo]: valor } : s));

  const removerLinha = (id) =>
    setServicosLinhas(prev => prev.filter(s => s.id !== id));

  const adicionarLinhaFixa = () =>
    setServicosLinhas(prev => [...prev, { id: novoId(), tipo: 'fixo', descricao: '', taxa_iva: 0, valor_fixo: 0, quantidade: 1, unidade: '' }]);

  const handleGuardarConfig = async () => {
    if (!cliente || !supabase) return;
    setGuardandoConfig(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ invoice_config: { servicos: servicosLinhas } })
        .eq('id', clienteId);
      if (error) throw error;
      setConfigGuardada(true);
      setTimeout(() => setConfigGuardada(false), 2500);
    } catch (e) {
      alert('Erro ao guardar configuração: ' + e.message);
    } finally {
      setGuardandoConfig(false);
    }
  };

  const handleEmitir = async () => {
    setEmitindo(true);
    try {
      const linhas = servicosLinhas
        .filter(s => s.tipo === 'horas' ? totalHoras > 0 : (Number(s.valor_fixo) || 0) > 0)
        .map(s => ({
          descricao: s.tipo === 'horas' ? `${s.descricao} — ${periodoLabel(periodo)}` : s.descricao,
          quantidade: Number(s.quantidade) || 1,
          preco_unitario: Number(s.preco_unitario ?? s.valor_fixo) || 0,
          taxa_iva: s.taxa_iva || 0,
          unidade: s.unidade || undefined,
        }));

      if (!linhas.length) throw new Error('Sem linhas para faturar');

      const res = await fetch('/api/toconline/create-fatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_documento: 'FT',
          data: dataFatura,
          data_vencimento: dataVencimento || undefined,
          cliente: { nome: cliente.name, nif: cliente.nif || undefined },
          linhas,
          observacoes: observacoes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao emitir fatura');

      // Auto-confirmar ajudas na BD após emissão bem-sucedida
      if (supabase && clienteId && !clienteId.startsWith('toc:') && periodo) {
        const valAjudas = ajudasValorInicial != null
          ? Number(ajudasValorInicial)
          : (ajudas?.valor_ajudas ?? ajudasEstimado ?? 0);
        const baseTotal = servicosLinhas.reduce((s, sl) => {
          const qty = sl.tipo === 'horas' ? totalHoras : (Number(sl.quantidade) || 1);
          const price = Number(sl.preco_unitario ?? sl.valor_fixo) || 0;
          return s + qty * price;
        }, 0);
        await supabase.from('ajudas_faturadas_clientes').upsert(
          { mes: periodo, client_id: clienteId, valor_ajudas: parseFloat(Number(valAjudas).toFixed(2)), total_fatura: parseFloat(baseTotal.toFixed(2)), confirmado: true },
          { onConflict: 'mes,client_id' }
        );
      }

      setResultado({ sucesso: true, doc_id: data.doc_id, documento: data.documento });
      setPasso(3);
      onFaturado?.();
    } catch (e) {
      setResultado({ sucesso: false, erro: e.message });
      setPasso(3);
    } finally {
      setEmitindo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Faturar Cliente</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {passo === 1 ? 'Passo 1 — Selecionar cliente e período' :
               passo === 2 ? 'Passo 2 — Preview da fatura' : 'Concluído'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Passo 1 — Seleção */}
        {passo === 1 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente *</p>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)}
                disabled={!!clienteIdInicial}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50 disabled:text-slate-500">
                <option value="">Selecionar cliente...</option>
                {(clients || []).filter(c => c.valorHora > 0).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Período *</p>
              <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
                disabled={!!periodoInicial}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50 disabled:text-slate-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data da fatura</p>
                <input type="date" value={dataFatura} onChange={e => setDataFatura(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vencimento</p>
                <input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>

            {clienteId && periodo && (
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Horas registadas no período</span>
                  <span className="font-black text-slate-800">{totalHoras.toFixed(2)} h</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tarifa horária</span>
                  <span className="font-black text-slate-800">{valorHora.toFixed(2)} €/h</span>
                </div>
                {ajudasValorInicial != null ? (
                  ajudasValorInicial > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Ajudas de custo (incluídas)</span>
                      <span className="font-black text-slate-800">{Number(ajudasValorInicial).toFixed(2)} €</span>
                    </div>
                  )
                ) : carregandoAjudas ? (
                  <div className="flex items-center gap-2 text-slate-400"><Loader2 size={12} className="animate-spin" /> A carregar ajudas...</div>
                ) : valorAjudas > 0 ? (
                  <div className="flex justify-between text-slate-600">
                    <span>Ajudas de custo (incluídas)</span>
                    <span className="font-black text-slate-800">{valorAjudas.toFixed(2)} €</span>
                  </div>
                ) : ajudasEstimado != null && (
                  <div className="flex justify-between text-slate-600">
                    <span>Ajudas de custo <span className="text-amber-500 font-black">(estimativa)</span></span>
                    <span className="font-black text-amber-700">{ajudasEstimado.toFixed(2)} €</span>
                  </div>
                )}
                {!podeContinuar && clienteId && periodo && !carregandoAjudas && (
                  <p className="text-amber-600 flex items-center gap-1">
                    <AlertCircle size={12} /> Sem horas registadas neste período
                  </p>
                )}
              </div>
            )}

            {/* Configuração de serviços predefinidos */}
            {clienteId && servicosLinhas.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Serviços predefinidos</p>
                  <button
                    onClick={handleGuardarConfig}
                    disabled={guardandoConfig}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-50"
                  >
                    {guardandoConfig ? <Loader2 size={11} className="animate-spin" /> : configGuardada ? <CheckCircle size={11} className="text-emerald-500" /> : <Save size={11} />}
                    {configGuardada ? 'Guardado' : 'Guardar padrão'}
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 grid grid-cols-[1fr_48px_52px_44px_28px] gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <span>Descrição / Valor unit.</span>
                    <span className="text-center">Qtd</span>
                    <span className="text-center">Unidade</span>
                    <span className="text-center">IVA</span>
                    <span />
                  </div>

                  {servicosLinhas.map((s) => (
                    <div key={s.id} className="px-3 py-2.5 space-y-1.5 border-t border-slate-50">
                      {/* Linha 1: Descrição + apagar */}
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="text"
                          value={s.descricao}
                          onChange={e => updateLinha(s.id, 'descricao', e.target.value)}
                          placeholder="Descrição do serviço"
                          className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        />
                        <button
                          onClick={() => removerLinha(s.id)}
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {/* Linha 2: Qtd · Unidade · Preço unit. · IVA */}
                      <div className="grid grid-cols-4 gap-1.5">
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 pl-0.5">Qtd</p>
                          <input
                            type="number" min="0" step="0.01"
                            value={s.quantidade ?? ''}
                            onChange={e => updateLinha(s.id, 'quantidade', e.target.value)}
                            placeholder="0"
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 pl-0.5">Unidade</p>
                          <input
                            type="text"
                            value={s.unidade ?? ''}
                            onChange={e => updateLinha(s.id, 'unidade', e.target.value)}
                            placeholder="h / un / mês"
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 pl-0.5">Preço unit. (€)</p>
                          <input
                            type="number" min="0" step="0.01"
                            value={s.preco_unitario ?? s.valor_fixo ?? ''}
                            onChange={e => updateLinha(s.id, 'preco_unitario', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 pl-0.5">IVA</p>
                          <select
                            value={s.taxa_iva}
                            onChange={e => updateLinha(s.id, 'taxa_iva', Number(e.target.value))}
                            className="w-full px-1 py-1.5 rounded-lg border border-slate-200 text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          >
                            {IVA_OPTS.map(v => <option key={v} value={v}>{v}%</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="px-3 py-2 border-t border-slate-100">
                    <button
                      onClick={adicionarLinhaFixa}
                      className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700 transition-colors"
                    >
                      <Plus size={11} /> Adicionar linha fixa
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button onClick={() => setPasso(2)} disabled={!podeContinuar}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 shadow-md shadow-blue-100">
              Ver Preview <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Passo 2 — Preview local */}
        {passo === 2 && (() => {
          const linhasPreview = servicosLinhas
            .map(s => {
              const qtd = s.tipo === 'horas' ? totalHoras : (Number(s.quantidade) || 1);
              const unitPrice = s.tipo === 'horas' ? valorHora : (Number(s.preco_unitario ?? s.valor_fixo) || 0);
              const unidade = s.unidade || (s.tipo === 'horas' ? 'h' : '');
              const descricao = s.tipo === 'horas'
                ? `${s.descricao || 'Serviços'} — ${periodoLabel(periodo)}`
                : (s.descricao || 'Linha fixa');
              const base = qtd * unitPrice;
              const iva = base * (s.taxa_iva || 0) / 100;
              return { descricao, qtd, unidade, unitPrice, taxa_iva: s.taxa_iva || 0, base, iva, total: base + iva };
            })
            .filter(l => l.base > 0);

          const totalBase = linhasPreview.reduce((s, l) => s + l.base, 0);
          const totalIva = linhasPreview.reduce((s, l) => s + l.iva, 0);
          const gruposIva = Object.values(
            linhasPreview.reduce((acc, l) => {
              const k = l.taxa_iva;
              if (!acc[k]) acc[k] = { taxa: k, base: 0, iva: 0 };
              acc[k].base += l.base; acc[k].iva += l.iva;
              return acc;
            }, {})
          );

          return (
            <div className="space-y-4">
              {/* Documento simulado */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                {/* Cabeçalho */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Fatura</p>
                    <p className="text-lg font-black text-slate-800">FT ••••</p>
                  </div>
                  <div className="text-right text-[10px] text-slate-500 space-y-0.5">
                    <p><span className="font-bold text-slate-700">Data:</span> {dataFatura}</p>
                    {dataVencimento && <p><span className="font-bold text-slate-700">Vencimento:</span> {dataVencimento}</p>}
                  </div>
                </div>

                {/* Cliente */}
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Cliente</p>
                  <p className="text-xs font-bold text-slate-800">{cliente?.name}</p>
                  {cliente?.nif && <p className="text-[10px] text-slate-500">NIF: {cliente.nif}</p>}
                </div>

                {/* Linhas */}
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-5 py-2 text-left font-black uppercase tracking-widest text-slate-400">Descrição</th>
                      <th className="px-3 py-2 text-center font-black uppercase tracking-widest text-slate-400 w-16">Qtd</th>
                      <th className="px-3 py-2 text-right font-black uppercase tracking-widest text-slate-400 w-20">Unit.</th>
                      <th className="px-3 py-2 text-center font-black uppercase tracking-widest text-slate-400 w-12">IVA</th>
                      <th className="px-5 py-2 text-right font-black uppercase tracking-widest text-slate-400 w-20">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {linhasPreview.map((l, i) => (
                      <tr key={i}>
                        <td className="px-5 py-2.5 text-slate-700 font-semibold">{l.descricao}</td>
                        <td className="px-3 py-2.5 text-center text-slate-500">{l.qtd.toFixed(2)}{l.unidade && ` ${l.unidade}`}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500">{l.unitPrice.toFixed(2)} €</td>
                        <td className="px-3 py-2.5 text-center text-slate-500">{l.taxa_iva}%</td>
                        <td className="px-5 py-2.5 text-right font-bold text-slate-800">{l.total.toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totais */}
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Subtotal</span><span>{totalBase.toFixed(2)} €</span>
                  </div>
                  {gruposIva.map(g => g.taxa > 0 && (
                    <div key={g.taxa} className="flex justify-between text-[10px] text-slate-500">
                      <span>IVA {g.taxa}%</span><span>{g.iva.toFixed(2)} €</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total</span><span>{totalFatura.toFixed(2)} €</span>
                  </div>
                </div>

                {/* Observações inline */}
                {observacoes.trim() && (
                  <div className="px-5 py-3 border-t border-slate-100">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Observações</p>
                    <p className="text-[10px] text-slate-600 leading-relaxed">{observacoes}</p>
                  </div>
                )}
              </div>

              {/* Observações editáveis */}
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observações <span className="normal-case font-normal">(opcional)</span></p>
                <textarea
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  rows={2}
                  placeholder="Observações que aparecerão na fatura..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setPasso(1)}
                  className="flex-1 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
                  Voltar
                </button>
                <button onClick={handleEmitir} disabled={emitindo}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all disabled:opacity-60 shadow-md shadow-blue-100">
                  {emitindo ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                  Emitir Fatura
                </button>
              </div>
            </div>
          );
        })()}

        {/* Passo 3 — Resultado */}
        {passo === 3 && resultado && (
          <div className="space-y-4 py-2">
            {resultado.sucesso ? (
              <div className="text-center space-y-3">
                <CheckCircle size={40} className="mx-auto text-emerald-500" />
                <div>
                  <p className="text-sm font-black text-slate-800">Fatura emitida com sucesso</p>
                  {resultado.documento?.attributes?.document_number && (
                    <p className="text-xs text-slate-500 mt-1">Nº {resultado.documento.attributes.document_number}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">Cliente: {cliente?.name} · {periodoLabel(periodo)}</p>
                  <p className="text-sm font-black text-emerald-700 mt-2">{totalFatura.toFixed(2)} €</p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <AlertCircle size={40} className="mx-auto text-red-400" />
                <div>
                  <p className="text-sm font-black text-slate-800">Erro ao emitir fatura</p>
                  <p className="text-xs text-red-600 mt-1">{resultado.erro}</p>
                </div>
                <button onClick={() => { setPasso(2); setResultado(null); }}
                  className="px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                  Tentar novamente
                </button>
              </div>
            )}
            <button onClick={onClose}
              className="w-full px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
