import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Loader2, ChevronRight, ChevronDown, CheckCircle, AlertCircle,
  FileText, Plus, Trash2, Save,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const TIPOS_DOCUMENTO = [
  { value: 'FT',  label: 'FT — Fatura' },
  { value: 'FR',  label: 'FR — Fatura-Recibo' },
  { value: 'FS',  label: 'FS — Fatura Simplificada' },
  { value: 'FRS', label: 'FRS — Fat. Recibo Simplif.' },
  { value: 'NC',  label: 'NC — Nota de Crédito' },
  { value: 'ND',  label: 'ND — Nota de Débito' },
  { value: 'VD',  label: 'VD — Venda a Dinheiro' },
  { value: 'ORC', label: 'ORC — Orçamento' },
  { value: 'GT',  label: 'GT — Guia de Transporte' },
  { value: 'GR',  label: 'GR — Guia de Remessa' },
];

const METODOS_PAGAMENTO = [
  { value: '',    label: 'Não especificado' },
  { value: 'MO',  label: 'MO — Numerário' },
  { value: 'TR',  label: 'TR — Transferência Bancária' },
  { value: 'MB',  label: 'MB — Referência Multibanco' },
  { value: 'CC',  label: 'CC — Cartão de Crédito' },
  { value: 'DC',  label: 'DC — Cartão de Débito' },
  { value: 'CH',  label: 'CH — Cheque' },
  { value: 'DDA', label: 'DDA — Débito Direto' },
  { value: 'OU',  label: 'OU — Outro' },
];

const PRAZOS_PAGAMENTO = [
  { value: 0,   label: 'Pagamento imediato' },
  { value: 15,  label: '15 dias' },
  { value: 30,  label: '30 dias' },
  { value: 45,  label: '45 dias' },
  { value: 60,  label: '60 dias' },
  { value: 90,  label: '90 dias' },
  { value: -1,  label: 'Data manual' },
];

const IVA_OPTS = [0, 6, 13, 23];

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

function addDias(dataIso, dias) {
  if (!dias || dias <= 0) return dataIso;
  const d = new Date(dataIso + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Calcula o factor de desconto a partir de uma expressão tipo "10" ou "3+5"
function calcDesconto(expr) {
  if (!expr || !expr.trim()) return 0;
  const parts = expr.trim().split('+').map(s => parseFloat(s)).filter(n => !isNaN(n) && n >= 0 && n < 100);
  if (!parts.length) return 0;
  return 1 - parts.reduce((acc, p) => acc * (1 - p / 100), 1);
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${checked ? 'bg-indigo-500' : 'bg-slate-200'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function FaturarClienteModal({ onClose, onFaturado, clienteIdInicial, ajudasValorInicial, periodoInicial }) {
  const { clients, logs, supabase } = useApp();

  const hoje = new Date().toISOString().slice(0, 10);

  const [passo, setPasso] = useState(1);

  // Campos base
  const [clienteId, setClienteId] = useState(clienteIdInicial || '');
  const [periodo, setPeriodo] = useState(periodoInicial || periodoDefault);
  const [dataFatura, setDataFatura] = useState(hoje);
  const [prazo, setPrazo] = useState(30);
  const [dataVencimento, setDataVencimento] = useState(addDias(hoje, 30));
  const [tipoDocumento, setTipoDocumento] = useState('FT');
  const [serie, setSerie] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Opções avançadas
  const [opcoesAbertas, setOpcoesAbertas] = useState(false);
  const [descontoGlobal, setDescontoGlobal] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [referenciaExterna, setReferenciaExterna] = useState('');
  const [ivaIncluido, setIvaIncluido] = useState(false);
  const [retencao, setRetencao] = useState({ ativa: false, percentagem: 25, tipo: 'IRS', ao_pagar: false });
  const [moedaIso, setMoedaIso] = useState('EUR');
  const [moedaTaxa, setMoedaTaxa] = useState('');
  const [moradaAtiva, setMoradaAtiva] = useState(false);
  const [moradaDetalhe, setMoradaDetalhe] = useState('');
  const [moradaCp, setMoradaCp] = useState('');
  const [moradaCidade, setMoradaCidade] = useState('');
  const [moradaPais, setMoradaPais] = useState('PT');

  // Linhas e config
  const [servicosLinhas, setServicosLinhas] = useState([]);
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [configGuardada, setConfigGuardada] = useState(false);

  // Ajudas
  const [ajudas, setAjudas] = useState(null);
  const [carregandoAjudas, setCarregandoAjudas] = useState(false);
  const [ajudasEstimado, setAjudasEstimado] = useState(null);

  // Resultado
  const [emitindo, setEmitindo] = useState(false);
  const [resultado, setResultado] = useState(null);

  const cliente = useMemo(() => clients?.find(c => c.id === clienteId), [clients, clienteId]);

  const totalHoras = useMemo(() => {
    if (!clienteId || !periodo || !logs) return 0;
    return (logs || [])
      .filter(l => l.clientId === clienteId && (l.date || '').startsWith(periodo))
      .reduce((sum, l) => sum + (Number(l.hours) || 0), 0);
  }, [clienteId, periodo, logs]);

  const valorHora = Number(cliente?.valorHora ?? 0);

  // Auto-calcular data de vencimento quando muda prazo ou data da fatura
  useEffect(() => {
    if (prazo === -1) return; // modo manual
    setDataVencimento(prazo === 0 ? dataFatura : addDias(dataFatura, prazo));
  }, [prazo, dataFatura]);

  // Carregar invoice_config ao selecionar cliente
  useEffect(() => {
    if (!cliente) { setServicosLinhas([]); setConfigGuardada(false); return; }
    const cfg = cliente.invoice_config;
    if (cfg?.servicos?.length) {
      setServicosLinhas(cfg.servicos.map(s =>
        s.tipo === 'horas'
          ? { desconto: '', codigo_artigo: '', ...s, quantidade: s.quantidade ?? totalHoras, preco_unitario: s.preco_unitario ?? valorHora }
          : { desconto: '', codigo_artigo: '', ...s }
      ));
    } else {
      setServicosLinhas([{
        id: novoId(), tipo: 'horas', descricao: 'Serviços de gestão de pessoal',
        taxa_iva: 0, quantidade: totalHoras, preco_unitario: valorHora, unidade: 'h',
        desconto: '', codigo_artigo: '',
      }]);
    }
    setConfigGuardada(false);
  }, [cliente?.id]);

  // Carregar ajudas
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

  // Estimativa de ajudas
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

  // Pré-preencher observação com ajudas
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

  // Há pelo menos uma linha com quantidade e preço válidos
  const temLinhasValidas = servicosLinhas.some(s => {
    const qty = s.tipo === 'horas' ? totalHoras : (Number(s.quantidade) || 0);
    return qty > 0 && (Number(s.preco_unitario ?? s.valor_fixo) || 0) > 0;
  });

  const podeContinuar = clienteId && periodo && temLinhasValidas;

  const updateLinha = (id, campo, valor) =>
    setServicosLinhas(prev => prev.map(s => s.id === id ? { ...s, [campo]: valor } : s));

  const removerLinha = (id) =>
    setServicosLinhas(prev => prev.filter(s => s.id !== id));

  const adicionarLinhaFixa = () =>
    setServicosLinhas(prev => [...prev, {
      id: novoId(), tipo: 'fixo', descricao: '', taxa_iva: 0,
      valor_fixo: 0, quantidade: 1, unidade: '',
      desconto: '', codigo_artigo: '',
    }]);

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
        .filter(s => {
          const qty = s.tipo === 'horas' ? totalHoras : (Number(s.quantidade) || 0);
          return qty > 0 && (Number(s.preco_unitario ?? s.valor_fixo) || 0) > 0;
        })
        .map(s => ({
          descricao: s.tipo === 'horas' ? `${s.descricao} — ${periodoLabel(periodo)}` : s.descricao,
          quantidade: s.tipo === 'horas' ? totalHoras : (Number(s.quantidade) || 1),
          preco_unitario: Number(s.preco_unitario ?? s.valor_fixo) || 0,
          taxa_iva: s.taxa_iva || 0,
          unidade: s.unidade || undefined,
          desconto: s.desconto?.trim() || undefined,
          codigo_artigo: s.codigo_artigo?.trim() || undefined,
        }));

      if (!linhas.length) throw new Error('Sem linhas para faturar');

      const bodyPayload = {
        tipo_documento: tipoDocumento,
        serie: serie.trim() || undefined,
        data: dataFatura,
        data_vencimento: dataVencimento || undefined,
        cliente: { nome: cliente.name, nif: cliente.nif || undefined },
        linhas,
        observacoes: observacoes.trim() || undefined,
        desconto_global: descontoGlobal.trim() || undefined,
        metodo_pagamento: metodoPagamento || undefined,
        referencia_externa: referenciaExterna.trim() || undefined,
        iva_incluido: ivaIncluido || undefined,
        retencao: retencao.ativa ? {
          percentagem: retencao.percentagem,
          tipo: retencao.tipo,
          ao_pagar: retencao.ao_pagar,
        } : undefined,
        moeda: moedaIso.toUpperCase() !== 'EUR' && moedaIso.trim() ? {
          iso: moedaIso.trim().toUpperCase(),
          taxa: moedaTaxa ? Number(moedaTaxa) : undefined,
        } : undefined,
        morada_cliente: moradaAtiva ? {
          detalhe: moradaDetalhe.trim() || undefined,
          codigo_postal: moradaCp.trim() || undefined,
          cidade: moradaCidade.trim() || undefined,
          pais: moradaPais.trim() || undefined,
        } : undefined,
      };

      const res = await fetch('/api/toconline/create-fatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao emitir fatura');

      // Auto-confirmar ajudas após emissão
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

  // Total calculado (com descontos por linha)
  const totalFatura = useMemo(() => {
    const globalFrac = calcDesconto(descontoGlobal);
    return servicosLinhas.reduce((sum, s) => {
      const qty = s.tipo === 'horas' ? totalHoras : (Number(s.quantidade) || 0);
      const price = Number(s.preco_unitario ?? s.valor_fixo) || 0;
      const base = qty * price * (1 - calcDesconto(s.desconto));
      const baseGlobal = base * (1 - globalFrac);
      return sum + baseGlobal * (1 + (s.taxa_iva || 0) / 100);
    }, 0);
  }, [servicosLinhas, totalHoras, descontoGlobal]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Faturar Cliente</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {passo === 1 ? 'Passo 1 — Configurar fatura' :
               passo === 2 ? 'Passo 2 — Preview da fatura' : 'Concluído'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
            <X size={16} />
          </button>
        </div>

        {/* ─── PASSO 1 ─── */}
        {passo === 1 && (
          <div className="space-y-4">

            {/* Cliente */}
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

            {/* Período */}
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Período *</p>
              <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
                disabled={!!periodoInicial}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50 disabled:text-slate-500" />
            </div>

            {/* Tipo + Série */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de documento</p>
                <select value={tipoDocumento} onChange={e => setTipoDocumento(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
                  {TIPOS_DOCUMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Série</p>
                <input type="text" value={serie} onChange={e => setSerie(e.target.value)}
                  placeholder="Ex: A"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data da fatura</p>
                <input type="date" value={dataFatura} onChange={e => setDataFatura(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prazo de pagamento</p>
                <select value={prazo} onChange={e => setPrazo(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
                  {PRAZOS_PAGAMENTO.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {/* Data de vencimento (manual ou calculada) */}
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Data de vencimento
                {prazo !== -1 && <span className="normal-case font-normal text-slate-400"> — calculada automaticamente</span>}
              </p>
              <input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)}
                readOnly={prazo !== -1}
                className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 ${prazo !== -1 ? 'bg-slate-50 text-slate-500' : ''}`} />
            </div>

            {/* Resumo horas/ajudas */}
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
                      <span>Ajudas de custo</span>
                      <span className="font-black text-slate-800">{Number(ajudasValorInicial).toFixed(2)} €</span>
                    </div>
                  )
                ) : carregandoAjudas ? (
                  <div className="flex items-center gap-2 text-slate-400"><Loader2 size={12} className="animate-spin" /> A carregar ajudas...</div>
                ) : (ajudas?.valor_ajudas ?? 0) > 0 ? (
                  <div className="flex justify-between text-slate-600">
                    <span>Ajudas de custo</span>
                    <span className="font-black text-slate-800">{(ajudas.valor_ajudas).toFixed(2)} €</span>
                  </div>
                ) : ajudasEstimado != null && (
                  <div className="flex justify-between text-slate-600">
                    <span>Ajudas de custo <span className="text-amber-500 font-black">(estimativa)</span></span>
                    <span className="font-black text-amber-700">{ajudasEstimado.toFixed(2)} €</span>
                  </div>
                )}
                {!temLinhasValidas && !carregandoAjudas && (
                  <p className="text-amber-600 flex items-center gap-1">
                    <AlertCircle size={12} /> Sem linhas com valor para faturar
                  </p>
                )}
              </div>
            )}

            {/* Serviços */}
            {clienteId && servicosLinhas.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Linhas da fatura</p>
                  <button onClick={handleGuardarConfig} disabled={guardandoConfig}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-50">
                    {guardandoConfig ? <Loader2 size={11} className="animate-spin" /> : configGuardada ? <CheckCircle size={11} className="text-emerald-500" /> : <Save size={11} />}
                    {configGuardada ? 'Guardado' : 'Guardar padrão'}
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                  {servicosLinhas.map((s) => (
                    <div key={s.id} className="px-3 py-2.5 space-y-1.5 border-b border-slate-50 last:border-b-0">
                      {/* Linha 1: Descrição + Cód. Artigo + Apagar */}
                      <div className="flex gap-1.5 items-center">
                        <input type="text" value={s.descricao}
                          onChange={e => updateLinha(s.id, 'descricao', e.target.value)}
                          placeholder="Descrição do serviço"
                          className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        <input type="text" value={s.codigo_artigo ?? ''}
                          onChange={e => updateLinha(s.id, 'codigo_artigo', e.target.value)}
                          placeholder="Cód."
                          title="Código do artigo no TOConline"
                          className="w-14 px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        <button onClick={() => removerLinha(s.id)}
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {/* Linha 2: Qtd · Unidade · Preço · IVA · Desconto */}
                      <div className="grid grid-cols-5 gap-1.5">
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 pl-0.5">Qtd</p>
                          <input type="number" min="0" step="0.01"
                            value={s.quantidade ?? ''}
                            onChange={e => updateLinha(s.id, 'quantidade', e.target.value)}
                            placeholder="0"
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 pl-0.5">Unidade</p>
                          <input type="text"
                            value={s.unidade ?? ''}
                            onChange={e => updateLinha(s.id, 'unidade', e.target.value)}
                            placeholder="h / un"
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 pl-0.5">Preço unit.</p>
                          <input type="number" min="0" step="0.01"
                            value={s.preco_unitario ?? s.valor_fixo ?? ''}
                            onChange={e => updateLinha(s.id, 'preco_unitario', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 pl-0.5">IVA</p>
                          <select value={s.taxa_iva}
                            onChange={e => updateLinha(s.id, 'taxa_iva', Number(e.target.value))}
                            className="w-full px-1 py-1.5 rounded-lg border border-slate-200 text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-indigo-300">
                            {IVA_OPTS.map(v => <option key={v} value={v}>{v}%</option>)}
                          </select>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 pl-0.5">Desc. %</p>
                          <input type="text"
                            value={s.desconto ?? ''}
                            onChange={e => updateLinha(s.id, 'desconto', e.target.value)}
                            placeholder="10"
                            title='Desconto em %. Composto: "3+5"'
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="px-3 py-2 border-t border-slate-100">
                    <button onClick={adicionarLinhaFixa}
                      className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700 transition-colors">
                      <Plus size={11} /> Adicionar linha
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Observações */}
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observações</p>
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
                rows={2} placeholder="Observações que aparecerão na fatura..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
            </div>

            {/* ── Opções Avançadas ── */}
            <div className="rounded-2xl border border-slate-100 overflow-hidden">
              <button type="button"
                onClick={() => setOpcoesAbertas(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors">
                <span>Opções avançadas</span>
                <ChevronDown size={12} className={`transition-transform ${opcoesAbertas ? 'rotate-180' : ''}`} />
              </button>

              {opcoesAbertas && (
                <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">

                  {/* Desconto global */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Desconto global no documento</p>
                    <input type="text" value={descontoGlobal} onChange={e => setDescontoGlobal(e.target.value)}
                      placeholder='Ex: "10" = 10% · "3+5" = composto'
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>

                  {/* Método de pagamento */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Método de pagamento</p>
                    <select value={metodoPagamento} onChange={e => setMetodoPagamento(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
                      {METODOS_PAGAMENTO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>

                  {/* Referência externa */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Referência externa</p>
                    <input type="text" value={referenciaExterna} onChange={e => setReferenciaExterna(e.target.value)}
                      placeholder="Nº encomenda, PO, referência do cliente..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>

                  {/* Preços com IVA incluído */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Preços com IVA incluído</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Os preços nas linhas já incluem IVA</p>
                    </div>
                    <Toggle checked={ivaIncluido} onChange={setIvaIncluido} />
                  </div>

                  {/* Retenção na fonte */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Retenção na fonte</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">IRS ou IRC retido na fonte</p>
                      </div>
                      <Toggle checked={retencao.ativa} onChange={v => setRetencao(r => ({ ...r, ativa: v }))} />
                    </div>
                    {retencao.ativa && (
                      <div className="grid grid-cols-3 gap-2 pl-1">
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Percentagem</p>
                          <input type="number" min="0" max="100" step="0.1"
                            value={retencao.percentagem}
                            onChange={e => setRetencao(r => ({ ...r, percentagem: Number(e.target.value) }))}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Tipo</p>
                          <select value={retencao.tipo}
                            onChange={e => setRetencao(r => ({ ...r, tipo: e.target.value }))}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300">
                            <option value="IRS">IRS</option>
                            <option value="IRC">IRC</option>
                          </select>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Ao pagar</p>
                          <div className="flex items-center h-[30px] gap-2">
                            <Toggle checked={retencao.ao_pagar} onChange={v => setRetencao(r => ({ ...r, ao_pagar: v }))} />
                            <span className="text-[9px] text-slate-400">{retencao.ao_pagar ? 'Sim' : 'Não'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Moeda */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Moeda</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Código ISO</p>
                        <input type="text" value={moedaIso} onChange={e => setMoedaIso(e.target.value.toUpperCase())}
                          maxLength={3} placeholder="EUR"
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Taxa de conversão</p>
                        <input type="number" min="0" step="0.0001" value={moedaTaxa}
                          onChange={e => setMoedaTaxa(e.target.value)}
                          placeholder="1.0000"
                          disabled={moedaIso.toUpperCase() === 'EUR'}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-400" />
                      </div>
                    </div>
                  </div>

                  {/* Morada do cliente */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Morada do cliente na fatura</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Sobrepõe a morada registada no TOConline</p>
                      </div>
                      <Toggle checked={moradaAtiva} onChange={setMoradaAtiva} />
                    </div>
                    {moradaAtiva && (
                      <div className="space-y-1.5 pl-1">
                        <input type="text" value={moradaDetalhe} onChange={e => setMoradaDetalhe(e.target.value)}
                          placeholder="Morada (rua, nº, andar...)"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        <div className="grid grid-cols-3 gap-1.5">
                          <input type="text" value={moradaCp} onChange={e => setMoradaCp(e.target.value)}
                            placeholder="Cód. Postal"
                            className="px-2 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                          <input type="text" value={moradaCidade} onChange={e => setMoradaCidade(e.target.value)}
                            placeholder="Cidade"
                            className="col-span-2 px-2 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        </div>
                        <input type="text" value={moradaPais} onChange={e => setMoradaPais(e.target.value)}
                          placeholder="País (PT)"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

            <button onClick={() => setPasso(2)} disabled={!podeContinuar}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 shadow-md shadow-blue-100">
              Ver Preview <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* ─── PASSO 2 — Preview ─── */}
        {passo === 2 && (() => {
          const globalFrac = calcDesconto(descontoGlobal);

          const linhasPreview = servicosLinhas
            .map(s => {
              const qtd = s.tipo === 'horas' ? totalHoras : (Number(s.quantidade) || 0);
              const unitPrice = s.tipo === 'horas' ? valorHora : (Number(s.preco_unitario ?? s.valor_fixo) || 0);
              const unidade = s.unidade || (s.tipo === 'horas' ? 'h' : '');
              const descricao = s.tipo === 'horas'
                ? `${s.descricao || 'Serviços'} — ${periodoLabel(periodo)}`
                : (s.descricao || 'Linha');
              const linhaFrac = calcDesconto(s.desconto);
              const base = qtd * unitPrice * (1 - linhaFrac);
              const baseGlobal = base * (1 - globalFrac);
              const iva = baseGlobal * (s.taxa_iva || 0) / 100;
              return {
                descricao, qtd, unidade, unitPrice,
                desconto: s.desconto?.trim() || '',
                taxa_iva: s.taxa_iva || 0,
                base, baseGlobal, iva,
                total: baseGlobal + iva,
              };
            })
            .filter(l => l.baseGlobal > 0);

          const totalBase = linhasPreview.reduce((s, l) => s + l.base, 0);
          const totalBaseGlobal = linhasPreview.reduce((s, l) => s + l.baseGlobal, 0);
          const totalIva = linhasPreview.reduce((s, l) => s + l.iva, 0);
          const temDesconto = linhasPreview.some(l => l.desconto) || descontoGlobal.trim();
          const tipoLabel = TIPOS_DOCUMENTO.find(t => t.value === tipoDocumento)?.label || tipoDocumento;
          const metodoPgLabel = METODOS_PAGAMENTO.find(m => m.value === metodoPagamento)?.label || '';

          return (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                {/* Cabeçalho */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{tipoLabel}</p>
                    <p className="text-lg font-black text-slate-800">{tipoDocumento} ••••{serie ? ` / ${serie}` : ''}</p>
                  </div>
                  <div className="text-right text-[10px] text-slate-500 space-y-0.5">
                    <p><span className="font-bold text-slate-700">Data:</span> {dataFatura}</p>
                    {dataVencimento && <p><span className="font-bold text-slate-700">Vencimento:</span> {dataVencimento}</p>}
                    {prazo > 0 && <p className="text-slate-400">{prazo} dias</p>}
                    {metodoPgLabel && <p><span className="font-bold text-slate-700">Pagamento:</span> {metodoPgLabel}</p>}
                    {referenciaExterna.trim() && <p><span className="font-bold text-slate-700">Ref.:</span> {referenciaExterna}</p>}
                  </div>
                </div>

                {/* Cliente */}
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Cliente</p>
                  <p className="text-xs font-bold text-slate-800">{cliente?.name}</p>
                  {cliente?.nif && <p className="text-[10px] text-slate-500">NIF: {cliente.nif}</p>}
                  {moradaAtiva && moradaDetalhe && (
                    <p className="text-[10px] text-slate-500">{moradaDetalhe}{moradaCp || moradaCidade ? `, ${moradaCp} ${moradaCidade}`.trim() : ''}</p>
                  )}
                </div>

                {/* Linhas */}
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-5 py-2 text-left font-black uppercase tracking-widest text-slate-400">Descrição</th>
                      <th className="px-2 py-2 text-center font-black uppercase tracking-widest text-slate-400 w-16">Qtd</th>
                      <th className="px-2 py-2 text-right font-black uppercase tracking-widest text-slate-400 w-20">Unit.</th>
                      <th className="px-2 py-2 text-center font-black uppercase tracking-widest text-slate-400 w-10">IVA</th>
                      {temDesconto && <th className="px-2 py-2 text-center font-black uppercase tracking-widest text-slate-400 w-12">Desc.</th>}
                      <th className="px-5 py-2 text-right font-black uppercase tracking-widest text-slate-400 w-20">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {linhasPreview.map((l, i) => (
                      <tr key={i}>
                        <td className="px-5 py-2.5 text-slate-700 font-semibold">{l.descricao}</td>
                        <td className="px-2 py-2.5 text-center text-slate-500">{l.qtd.toFixed(2)}{l.unidade && ` ${l.unidade}`}</td>
                        <td className="px-2 py-2.5 text-right text-slate-500">{l.unitPrice.toFixed(2)} €</td>
                        <td className="px-2 py-2.5 text-center text-slate-500">{l.taxa_iva}%</td>
                        {temDesconto && <td className="px-2 py-2.5 text-center text-slate-500">{l.desconto || '—'}</td>}
                        <td className="px-5 py-2.5 text-right font-bold text-slate-800">{l.total.toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totais */}
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 space-y-1">
                  {ivaIncluido && (
                    <p className="text-[9px] text-amber-600 mb-1">* Preços incluem IVA</p>
                  )}
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Subtotal s/ desconto</span>
                    <span>{totalBase.toFixed(2)} €</span>
                  </div>
                  {descontoGlobal.trim() && (
                    <div className="flex justify-between text-[10px] text-rose-600">
                      <span>Desconto global ({descontoGlobal}%)</span>
                      <span>-{(totalBase - totalBaseGlobal).toFixed(2)} €</span>
                    </div>
                  )}
                  {linhasPreview.filter(l => l.desconto).length > 0 && (
                    <div className="flex justify-between text-[10px] text-rose-500">
                      <span>Descontos nas linhas</span>
                      <span>incluídos acima</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Base tributável</span>
                    <span>{totalBaseGlobal.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>IVA</span>
                    <span>{totalIva.toFixed(2)} €</span>
                  </div>
                  {retencao.ativa && (
                    <div className="flex justify-between text-[10px] text-amber-600">
                      <span>Retenção {retencao.tipo} ({retencao.percentagem}%)</span>
                      <span>-{(totalBaseGlobal * retencao.percentagem / 100).toFixed(2)} €</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total</span>
                    <span>{totalFatura.toFixed(2)} €{moedaIso.toUpperCase() !== 'EUR' ? ` ${moedaIso.toUpperCase()}` : ''}</span>
                  </div>
                </div>

                {/* Observações */}
                {observacoes.trim() && (
                  <div className="px-5 py-3 border-t border-slate-100">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Observações</p>
                    <p className="text-[10px] text-slate-600 leading-relaxed">{observacoes}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setPasso(1)}
                  className="flex-1 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
                  Voltar
                </button>
                <button onClick={handleEmitir} disabled={emitindo}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all disabled:opacity-60 shadow-md shadow-blue-100">
                  {emitindo ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                  Emitir {tipoDocumento}
                </button>
              </div>
            </div>
          );
        })()}

        {/* ─── PASSO 3 — Resultado ─── */}
        {passo === 3 && resultado && (
          <div className="space-y-4 py-2">
            {resultado.sucesso ? (
              <div className="text-center space-y-3">
                <CheckCircle size={40} className="mx-auto text-emerald-500" />
                <div>
                  <p className="text-sm font-black text-slate-800">{tipoDocumento} emitido com sucesso</p>
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
                  <p className="text-sm font-black text-slate-800">Erro ao emitir documento</p>
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
