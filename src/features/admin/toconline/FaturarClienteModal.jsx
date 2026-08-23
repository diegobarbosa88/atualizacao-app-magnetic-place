import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, ChevronRight, ChevronDown, CheckCircle, AlertCircle,
  FileText, Plus, Trash2, Save, ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import ModalShell from '../../../components/common/ModalShell';
import { authFetch } from '../../../utils/authFetch';
import { calcularFaturacaoCliente } from '../../../lib/faturacao/tarifaHistorica.js';
import { verificarEstimativaParaFatura, confirmarEEmitirFatura } from '../../../lib/ajudas/emitirFaturaComAjudas.js';
import { FT } from '../../../styles/designTokens';

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
      className="w-9 h-5 rounded-full transition-colors relative shrink-0"
      style={{ backgroundColor: checked ? FT.slate : 'var(--border)' }}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function FaturarClienteModal({ onClose, onFaturado, clienteIdInicial, ajudasValorInicial, periodoInicial, nomeToConlineInicial }) {
  const { clients, logs, supabase, currentUser } = useApp();
  const navigate = useNavigate();

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

  // Fase 2b — fail-closed de ajudas de custo, ligado no momento da emissão.
  // null → nada verificado ainda; 'verificando' → a chamar
  // verificarEstimativaParaFatura; { status:'bloqueado', motivo } → nunca
  // chega a chamar create-fatura.js; { status:'calculado', ... } → mostra
  // cartão de confirmação, só emite após clique explícito em "Confirmar e Emitir".
  const [gateAjudas, setGateAjudas] = useState(null);

  const cliente = useMemo(() => clients?.find(c => c.id === clienteId), [clients, clienteId]);

  // Fase 2b, Ponto 2 — quando o modal é aberto com um clienteIdInicial que
  // não corresponde a nenhum cliente cadastrado (tipicamente `toc:${nome}`,
  // vindo do fallback "sem horas registadas" de AjudasCalculadora.jsx, cujo
  // nome de fatura TOConline não bateu com nenhum `clients.name`), nunca
  // avança automaticamente para emissão: exige resolução humana explícita
  // — ou associar a um cliente real (aplica o gate normal a partir daí), ou
  // confirmar que não corresponde a nenhum (emite sem ajudas, mas por
  // decisão visível do admin, não por omissão silenciosa).
  const [semClienteCorrespondente, setSemClienteCorrespondente] = useState(false);
  const [resolucaoEscolhida, setResolucaoEscolhida] = useState('');
  const precisaResolucaoManual = !!clienteIdInicial && !cliente && !semClienteCorrespondente;

  // Histórico de tarifas do cliente — mesma tabela/fonte usada em Custos →
  // Clientes (useCostReportsData.js), para o valor por defeito proposto
  // aqui nunca divergir silenciosamente do que o admin já viu naquele ecrã.
  const [clientRateHistory, setClientRateHistory] = useState([]);
  useEffect(() => {
    if (!clienteId || !supabase) { setClientRateHistory([]); return; }
    supabase.from('client_valorhora_history').select('*').eq('client_id', clienteId)
      .then(({ data }) => setClientRateHistory(data || []));
  }, [clienteId, supabase]);

  // totalHoras/valorHora por defeito vêm de calcularFaturacaoCliente
  // (tarifaHistorica.js) — respeita a tarifa em vigor em cada data de log,
  // não a tarifa atual do cliente. valorHora aqui é um preço-por-hora
  // efetivo (valorFaturado ÷ totalHoras) para caber no modelo de linha
  // "quantidade × preço unitário" do formulário — se a tarifa não mudou
  // dentro do período, é exatamente a tarifa vigente; se mudou a meio,
  // é a média ponderada que reproduz o mesmo total. Continua 100%
  // editável pelo admin a partir daqui.
  const { totalHoras, valorFaturado } = useMemo(() => {
    if (!clienteId || !periodo || !logs) return { totalHoras: 0, valorFaturado: 0 };
    return calcularFaturacaoCliente({
      logs,
      clientId: clienteId,
      periodo,
      valorHoraAtual: Number(cliente?.valorHora ?? 0),
      clientRateHistory,
    });
  }, [clienteId, periodo, logs, cliente, clientRateHistory]);

  const valorHora = totalHoras > 0 ? valorFaturado / totalHoras : Number(cliente?.valorHora ?? 0);

  // Auto-calcular data de vencimento quando muda prazo ou data da fatura
  useEffect(() => {
    if (prazo === -1) return; // modo manual
    setDataVencimento(prazo === 0 ? dataFatura : addDias(dataFatura, prazo));
  }, [prazo, dataFatura]);

  // Carregar invoice_config ao selecionar cliente. Guarda por `clienteId`
  // (não `cliente?.id`) para também inicializar uma linha por defeito no
  // caso "sem correspondência confirmada" (Fase 2b, Ponto 2) — aí `cliente`
  // nunca resolve, mas o admin ainda precisa de conseguir editar/preencher
  // uma linha manualmente para poder emitir.
  useEffect(() => {
    if (!clienteId) { setServicosLinhas([]); setConfigGuardada(false); return; }
    const cfg = cliente?.invoice_config;
    if (cfg?.servicos?.length) {
      setServicosLinhas(cfg.servicos.map(s =>
        s.tipo === 'horas'
          ? { desconto: '', codigo_artigo: '', ...s, quantidade: s.quantidade ?? totalHoras, preco_unitario: s.preco_unitario ?? valorHora }
          : { desconto: '', codigo_artigo: '', ...s }
      ));
    } else if (cliente) {
      setServicosLinhas([{
        id: novoId(), tipo: 'horas', descricao: 'Serviços de gestão de pessoal',
        taxa_iva: 0, quantidade: totalHoras, preco_unitario: valorHora, unidade: 'h',
        desconto: '', codigo_artigo: '',
      }]);
    } else {
      // Sem cliente resolvido (ex.: "toc:" sem correspondência confirmada,
      // Ponto 2) — não há horas internas associadas a este id sintético
      // (totalHoras será sempre 0), por isso a linha por defeito é do tipo
      // "fixo": a quantidade/preço que o admin escrever nos campos abaixo
      // são efetivamente usados na validação, ao contrário de "horas" (que
      // ignora `s.quantidade` a favor de `totalHoras`).
      setServicosLinhas([{
        id: novoId(), tipo: 'fixo', descricao: '', taxa_iva: 0,
        valor_fixo: 0, quantidade: 1, unidade: '',
        desconto: '', codigo_artigo: '',
      }]);
    }
    setConfigGuardada(false);
  }, [clienteId, cliente]);

  // Carregar ajudas — só para o resumo informativo do Passo 1 (histórico do
  // que já foi confirmado/estimado noutros meses). Deixou de alimentar o
  // texto das observações da fatura: essa é agora sempre e só a saída de
  // calcularEstimativaMensal (emitirFaturaComAjudas.js) — ver Fase 2b, Ponto 1.
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

  // NOTA (Fase 2b, Ponto 1): já não existe aqui um useEffect a
  // pré-preencher `observacoes` com texto de ajudas de custo. Antes disso
  // acontecia a partir de `ajudasValorInicial`/`ajudas`/`ajudasEstimado` —
  // três fontes de valor diferentes do cálculo novo (percentagem histórica
  // ativa), e o texto acabava por coexistir com o texto novo anexado em
  // `criarFaturaTOConline`, com dois valores em euros potencialmente
  // divergentes na mesma fatura fiscal. `ajudasValorInicial`/`ajudas`/
  // `ajudasEstimado` continuam a existir só para o resumo informativo do
  // Passo 1 (abaixo) — nunca mais escrevem texto nem alimentam o valor
  // realmente faturado.

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

  // Chamada real ao TOConline — extraída de handleEmitir para ser reutilizável
  // tanto no caminho direto (sem ajudas aplicáveis: cliente explicitamente
  // não elegível, ou "toc:" sem correspondência confirmada) como no
  // `criarFaturaFn` passado a confirmarEEmitirFatura (Fase 2b). O texto de
  // ajudas de custo, quando existe, é a ÚNICA fonte de texto de ajudas nas
  // observações (Fase 2b, Ponto 1) — anexado ao que o admin tiver escrito
  // manualmente, nunca substituindo.
  const criarFaturaTOConline = async ({ textoObservacaoAjudas } = {}) => {
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

    // Se "Observações" já contém exatamente o texto de ajudas pré-preenchido
    // (o caso comum — o admin não tocou nele), não anexa outra vez: o
    // gate recalcula sempre no momento da confirmação (confirmarEEmitirFatura),
    // por isso `textoObservacaoAjudas` chega aqui como o valor definitivo —
    // normalmente igual ao que já está pré-preenchido, mas nunca assumido
    // como igual sem verificar (ex.: o total mudou entre o pré-preenchimento
    // e a confirmação).
    const observacoesFinal = observacoes.trim() === (textoObservacaoAjudas || '').trim()
      ? observacoes.trim()
      : [observacoes.trim(), textoObservacaoAjudas].filter(Boolean).join('\n');

    const bodyPayload = {
      tipo_documento: tipoDocumento,
      serie: serie.trim() || undefined,
      data: dataFatura,
      data_vencimento: dataVencimento || undefined,
      cliente: { nome: cliente?.name || nomeToConlineInicial || 'Cliente', nif: cliente?.nif || undefined },
      linhas,
      observacoes: observacoesFinal || undefined,
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

    const res = await authFetch('/api/toconline/create-fatura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao emitir fatura');

    // NOTA (Fase 2b, Ponto 1): já não há aqui um upsert automático em
    // `ajudas_faturadas_clientes` a partir do cálculo antigo. Quando o gate
    // de ajudas corre e é confirmado, é `confirmarEEmitirFatura`
    // (emitirFaturaComAjudas.js) que atualiza essa tabela — com o valor
    // NOVO, não com este. Quando não há ajudas aplicáveis (cliente não
    // elegível, ou "toc:" sem correspondência), a tabela simplesmente não é
    // tocada — não há nenhum valor de ajudas correto para lá gravar.

    const faturaId = data.documento?.attributes?.document_no || data.documento?.document_no || data.doc_id;
    return { faturaId, doc_id: data.doc_id, documento: data.documento };
  };

  // Caminho sem gate de ajudas de custo. Só é alcançado em dois casos, ambos
  // já decididos explicitamente antes de chegar aqui:
  //  (a) cliente real com elegivel_ajudas_custo === false — decisão humana
  //      já tomada no ecrã de Elegibilidade, não há nada para calcular;
  //  (b) cliente "toc:" cuja falta de correspondência com `clients` foi
  //      confirmada manualmente pelo admin no painel de resolução (Ponto 2)
  //      — nunca por omissão silenciosa de um clienteId não resolvido.
  const handleEmitirDireto = async () => {
    setEmitindo(true);
    try {
      const r = await criarFaturaTOConline({});
      setResultado({ sucesso: true, doc_id: r.doc_id, documento: r.documento });
      setPasso(3);
      onFaturado?.();
    } catch (e) {
      setResultado({ sucesso: false, erro: e.message });
      setPasso(3);
    } finally {
      setEmitindo(false);
    }
  };

  // Passo (2)/(3) do fluxo Fase 2b: antes de emitir, verifica a estimativa de
  // ajudas para o mês de REFERÊNCIA do trabalho (`periodo` — já representa o
  // mês M, não o mês de emissão da fatura, regra M→M-1) com o valor final já
  // decidido no modal (`totalFatura`, pós-edição/desconto/IVA).
  const handleIniciarEmissao = async () => {
    // Guarda defensiva: a UI já bloqueia o acesso a este botão enquanto
    // `precisaResolucaoManual` for true (só o painel de resolução é
    // renderizado nesse estado), mas o fail-closed não deve depender só
    // disso — nunca emitir com uma correspondência de cliente por resolver.
    if (precisaResolucaoManual) return;

    if (clienteId.startsWith('toc:')) {
      // Só chega aqui depois de o admin confirmar explicitamente "não
      // corresponde a nenhum cliente" no painel de resolução — não há
      // `clients` row para verificar elegibilidade, logo não há gate a
      // aplicar (mas a decisão em si já foi humana e visível).
      return handleEmitirDireto();
    }
    if (!supabase || !clienteId) {
      return handleEmitirDireto();
    }
    setGateAjudas({ status: 'verificando' });
    try {
      const r = await verificarEstimativaParaFatura({
        mesReferencia: periodo,
        clientId: clienteId,
        valorFinalDoModal: totalFatura,
        dbClient: supabase,
      });
      if (!r.linha) {
        // Cliente com elegivel_ajudas_custo === false — exclusão legítima,
        // não bloqueada: não há ajudas a aplicar, segue emissão direta.
        return handleEmitirDireto();
      }
      if (r.linha.status === 'bloqueado') {
        setGateAjudas({
          status: 'bloqueado',
          motivo: r.linha.motivoBloqueio || 'Não foi possível calcular a estimativa de ajudas de custo para este cliente/mês.',
        });
        return;
      }
      setGateAjudas({
        status: 'calculado',
        linha: r.linha,
        percentagemUsada: r.percentagemUsada,
        percentagemHistoricaId: r.percentagemHistoricaId,
        residuoOrigem: r.residuoOrigem,
      });
    } catch (e) {
      setGateAjudas({ status: 'bloqueado', motivo: 'Erro ao calcular estimativa de ajudas de custo: ' + e.message });
    }
  };

  // Só corre depois do clique explícito em "Confirmar e Emitir" no cartão —
  // grava 'confirmado' em ajudas_estimativas_fatura ANTES de chamar o
  // TOConline (DECISIONS.md); se a API falhar, o estado fica em 'confirmado'
  // (nunca regride) e a fatura fica disponível para retry manual no ecrã
  // "Estimativa Mensal".
  const handleConfirmarEEmitir = async () => {
    if (!gateAjudas || gateAjudas.status !== 'calculado') return;
    setEmitindo(true);
    try {
      const confirmadoPor = currentUser?.name || currentUser?.email || currentUser?.id || 'admin';
      const resultado = await confirmarEEmitirFatura({
        mesReferencia: periodo,
        clientId: clienteId,
        linha: gateAjudas.linha,
        percentagemHistoricaId: gateAjudas.percentagemHistoricaId,
        dbClient: supabase,
        confirmadoPor,
        valorFaturaTotal: totalFatura,
        criarFaturaFn: ({ textoObservacaoAjudas }) => criarFaturaTOConline({ textoObservacaoAjudas }),
      });
      if (resultado.faturado) {
        setResultado({ sucesso: true, doc_id: resultado.faturaId });
        setPasso(3);
        onFaturado?.();
      } else {
        setResultado({
          sucesso: false,
          erro: (resultado.erro || 'Falha ao emitir a fatura.') + ' A confirmação de ajudas de custo já ficou gravada — pode tentar novamente a partir do ecrã "Estimativa Mensal".',
        });
        setPasso(3);
      }
    } catch (e) {
      setResultado({ sucesso: false, erro: e.message });
      setPasso(3);
    } finally {
      setEmitindo(false);
      setGateAjudas(null);
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

  // Pré-preenche "Observações" com o texto de ajudas de custo ANTES da
  // confirmação — pedido explícito, mas com cuidado: calculado sempre a
  // partir do MESMO gate real (verificarEstimativaParaFatura) que vai
  // decidir o texto definitivo na emissão, nunca de ajudasValorInicial (só
  // informativo, pode estar desatualizado) — evita as duas fontes
  // divergirem, que foi exatamente o bug que uma decisão anterior aqui já
  // corrigiu (ver nota acima). Só atualiza o campo enquanto continuar
  // exatamente igual ao último texto auto-preenchido — assim que o admin
  // editar (ou apagar), deixa de mexer, tal como sempre aconteceu com
  // "Observações" para o resto do texto livre. Debounced (400ms) para não
  // disparar uma chamada ao Supabase a cada tecla enquanto o total muda.
  const [ajudasAutoTexto, setAjudasAutoTexto] = useState('');
  useEffect(() => {
    if (!supabase || !clienteId || clienteId.startsWith('toc:') || precisaResolucaoManual) return;
    if (!periodo || !(totalFatura > 0)) return;
    const timer = setTimeout(() => {
      verificarEstimativaParaFatura({
        mesReferencia: periodo, clientId: clienteId, valorFinalDoModal: totalFatura, dbClient: supabase,
      }).then(r => {
        if (r.linha?.status !== 'calculado') return;
        const valorFinalFormatado = r.linha.valorFinal.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const texto = `Estão incluídas nesta fatura €${valorFinalFormatado} referentes a ajudas de custo.`;
        setObservacoes(prev => (prev === ajudasAutoTexto ? texto : prev));
        setAjudasAutoTexto(texto);
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, clienteId, periodo, totalFatura, precisaResolucaoManual]);

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title="Faturar Cliente"
      meta={passo === 1 ? 'Passo 1 — Configurar fatura' :
            passo === 2 ? 'Passo 2 — Preview da fatura' : 'Concluído'}
      size="lg"
      accent="brand"
      closeOnOverlay={false}
    >
      <div className="p-6 space-y-5">

        {/* ─── RESOLUÇÃO MANUAL (Fase 2b, Ponto 2) ───
            Bloqueia todo o resto do modal enquanto o cliente vindo de fora
            (tipicamente "toc:nome", do fallback sem-horas de
            AjudasCalculadora.jsx) não tiver sido associado a um cliente
            real ou explicitamente confirmado como "sem correspondência". */}
        {precisaResolucaoManual ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-amber-800">Cliente não identificado automaticamente</p>
                  <p className="text-[10px] text-amber-700 mt-0.5">
                    A fatura do TOConline está em nome de{' '}
                    <span className="font-bold">"{nomeToConlineInicial || clienteIdInicial?.replace(/^toc:/, '')}"</span>,
                    que não corresponde a nenhum cliente cadastrado. Escolha o cliente correspondente para aplicar
                    corretamente o gate de ajudas de custo, ou confirme que não corresponde a nenhum.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Cliente correspondente</p>
              <select value={resolucaoEscolhida} onChange={e => setResolucaoEscolhida(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30">
                <option value="">Selecionar cliente...</option>
                {(clients || []).filter(c => c.valorHora > 0).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setSemClienteCorrespondente(true)}
                className="flex-1 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-xl transition-all">
                Não corresponde a nenhum cliente
              </button>
              <button onClick={() => { if (resolucaoEscolhida) setClienteId(resolucaoEscolhida); }} disabled={!resolucaoEscolhida}
                className="flex-1 px-3 py-2.5 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 shadow-md hover:opacity-90"
                style={{ backgroundColor: FT.navy }}>
                Confirmar correspondência
              </button>
            </div>
          </div>
        ) : <>
        {/* ─── PASSO 1 ─── */}
        {passo === 1 && (
          <div className="space-y-4">

            {/* Cliente */}
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Cliente *</p>
              {clienteId.startsWith('toc:') ? (
                <input type="text" disabled
                  value={`${nomeToConlineInicial || clienteId.replace(/^toc:/, '')} (sem cliente cadastrado associado)`}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--slate-dim)] bg-[var(--surface)]" />
              ) : (
                <select value={clienteId} onChange={e => setClienteId(e.target.value)}
                  disabled={!!clienteIdInicial}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30 disabled:bg-[var(--surface)] disabled:text-[var(--slate-dim)]">
                  <option value="">Selecionar cliente...</option>
                  {(clients || []).filter(c => c.valorHora > 0).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Período */}
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Período *</p>
              <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
                disabled={!!periodoInicial}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30 disabled:bg-[var(--surface)] disabled:text-[var(--slate-dim)]" />
            </div>

            {/* Tipo + Série */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Tipo de documento</p>
                <select value={tipoDocumento} onChange={e => setTipoDocumento(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30">
                  {TIPOS_DOCUMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Série</p>
                <input type="text" value={serie} onChange={e => setSerie(e.target.value)}
                  placeholder="Ex: A"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30" />
              </div>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Data da fatura</p>
                <input type="date" value={dataFatura} onChange={e => setDataFatura(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Prazo de pagamento</p>
                <select value={prazo} onChange={e => setPrazo(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30">
                  {PRAZOS_PAGAMENTO.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {/* Data de vencimento (manual ou calculada) */}
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">
                Data de vencimento
                {prazo !== -1 && <span className="normal-case font-normal text-[var(--slate-dim)]"> — calculada automaticamente</span>}
              </p>
              <input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)}
                readOnly={prazo !== -1}
                className={`w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30 ${prazo !== -1 ? 'bg-[var(--surface)] text-[var(--slate-dim)]' : ''}`} />
            </div>

            {/* Resumo horas/ajudas */}
            {clienteId && periodo && (
              <div className="bg-[var(--surface)] rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-[var(--ink-soft)]">
                  <span>Horas registadas no período</span>
                  <span className="font-black text-[var(--ink)]">{totalHoras.toFixed(2)} h</span>
                </div>
                <div className="flex justify-between text-[var(--ink-soft)]">
                  <span>Tarifa horária</span>
                  <span className="font-black text-[var(--ink)]">{valorHora.toFixed(2)} €/h</span>
                </div>
                {ajudasValorInicial != null ? (
                  ajudasValorInicial > 0 && (
                    <div className="flex justify-between text-[var(--ink-soft)]">
                      <span>Ajudas de custo (histórico)</span>
                      <span className="font-black text-[var(--ink)]">{Number(ajudasValorInicial).toFixed(2)} €</span>
                    </div>
                  )
                ) : carregandoAjudas ? (
                  <div className="flex items-center gap-2 text-[var(--slate-dim)]"><Loader2 size={12} className="animate-spin" /> A carregar ajudas...</div>
                ) : (ajudas?.valor_ajudas ?? 0) > 0 ? (
                  <div className="flex justify-between text-[var(--ink-soft)]">
                    <span>Ajudas de custo (histórico)</span>
                    <span className="font-black text-[var(--ink)]">{(ajudas.valor_ajudas).toFixed(2)} €</span>
                  </div>
                ) : ajudasEstimado != null && (
                  <div className="flex justify-between text-[var(--ink-soft)]">
                    <span>Ajudas de custo <span className="text-amber-500 font-black">(histórico, estimativa)</span></span>
                    <span className="font-black text-amber-700">{ajudasEstimado.toFixed(2)} €</span>
                  </div>
                )}
                {((ajudasValorInicial ?? ajudas?.valor_ajudas ?? ajudasEstimado) != null) && (
                  <p className="text-[9px] text-[var(--slate-dim)] italic">Valor informativo de meses anteriores — o valor final de ajudas de custo é sempre recalculado no momento da confirmação de emissão.</p>
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
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Linhas da fatura</p>
                  <button onClick={handleGuardarConfig} disabled={guardandoConfig}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-[var(--surface-dim)] rounded-lg transition-all disabled:opacity-50" style={{ color: 'var(--slate-dim)' }}>
                    {guardandoConfig ? <Loader2 size={11} className="animate-spin" /> : configGuardada ? <CheckCircle size={11} className="text-emerald-500" /> : <Save size={11} />}
                    {configGuardada ? 'Guardado' : 'Guardar padrão'}
                  </button>
                </div>

                <div className="rounded-2xl border border-[var(--border-soft)] overflow-hidden">
                  {servicosLinhas.map((s) => (
                    <div key={s.id} className="px-3 py-2.5 space-y-1.5 border-b border-[var(--border-soft)] last:border-b-0">
                      {/* Linha 1: Descrição + Cód. Artigo + Apagar */}
                      <div className="flex gap-1.5 items-center">
                        <input type="text" value={s.descricao}
                          onChange={e => updateLinha(s.id, 'descricao', e.target.value)}
                          placeholder="Descrição do serviço"
                          className="flex-1 px-2 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-1 focus:ring-[#1B3A57]/30" />
                        <input type="text" value={s.codigo_artigo ?? ''}
                          onChange={e => updateLinha(s.id, 'codigo_artigo', e.target.value)}
                          placeholder="Cód."
                          title="Código do artigo no TOConline"
                          className="w-14 px-2 py-1.5 rounded-lg border border-[var(--border)] text-xs text-center text-[var(--ink-mid)] focus:outline-none focus:ring-1 focus:ring-[#1B3A57]/30" />
                        <button onClick={() => removerLinha(s.id)}
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-[var(--slate)] hover:text-red-500 hover:bg-red-50 transition-all shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {/* Linha 2: Qtd · Unidade · Preço · IVA · Desconto */}
                      <div className="grid grid-cols-5 gap-1.5">
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--slate-dim)] pl-0.5">Qtd</p>
                          <input type="number" min="0" step="0.01"
                            value={s.quantidade ?? ''}
                            onChange={e => updateLinha(s.id, 'quantidade', e.target.value)}
                            placeholder="0"
                            className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] text-xs text-center text-[var(--ink-mid)] focus:outline-none focus:ring-1 focus:ring-[#1B3A57]/30" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--slate-dim)] pl-0.5">Unidade</p>
                          <input type="text"
                            value={s.unidade ?? ''}
                            onChange={e => updateLinha(s.id, 'unidade', e.target.value)}
                            placeholder="h / un"
                            className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] text-xs text-center text-[var(--ink-mid)] focus:outline-none focus:ring-1 focus:ring-[#1B3A57]/30" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--slate-dim)] pl-0.5">Preço unit.</p>
                          <input type="number" min="0" step="0.01"
                            value={s.preco_unitario ?? s.valor_fixo ?? ''}
                            onChange={e => updateLinha(s.id, 'preco_unitario', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] text-xs text-center text-[var(--ink-mid)] focus:outline-none focus:ring-1 focus:ring-[#1B3A57]/30" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--slate-dim)] pl-0.5">IVA</p>
                          <select value={s.taxa_iva}
                            onChange={e => updateLinha(s.id, 'taxa_iva', Number(e.target.value))}
                            className="w-full px-1 py-1.5 rounded-lg border border-[var(--border)] text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-[#1B3A57]/30">
                            {IVA_OPTS.map(v => <option key={v} value={v}>{v}%</option>)}
                          </select>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--slate-dim)] pl-0.5">Desc. %</p>
                          <input type="text"
                            value={s.desconto ?? ''}
                            onChange={e => updateLinha(s.id, 'desconto', e.target.value)}
                            placeholder="10"
                            title='Desconto em %. Composto: "3+5"'
                            className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] text-xs text-center text-[var(--ink-mid)] focus:outline-none focus:ring-1 focus:ring-[#1B3A57]/30" />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="px-3 py-2 border-t border-[var(--border-soft)]">
                    <button onClick={adicionarLinhaFixa}
                      className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-colors" style={{ color: 'var(--slate-dim)' }}>
                      <Plus size={11} /> Adicionar linha
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Observações */}
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Observações</p>
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
                rows={2} placeholder="Observações que aparecerão na fatura..."
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30 resize-none" />
            </div>

            {/* ── Opções Avançadas ── */}
            <div className="rounded-2xl border border-[var(--border-soft)] overflow-hidden">
              <button type="button"
                onClick={() => setOpcoesAbertas(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] hover:bg-[var(--surface)] transition-colors">
                <span>Opções avançadas</span>
                <ChevronDown size={12} className={`transition-transform ${opcoesAbertas ? 'rotate-180' : ''}`} />
              </button>

              {opcoesAbertas && (
                <div className="px-4 pb-4 space-y-4 border-t border-[var(--border-soft)] pt-3">

                  {/* Desconto global */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Desconto global no documento</p>
                    <input type="text" value={descontoGlobal} onChange={e => setDescontoGlobal(e.target.value)}
                      placeholder='Ex: "10" = 10% · "3+5" = composto'
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30" />
                  </div>

                  {/* Método de pagamento */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Método de pagamento</p>
                    <select value={metodoPagamento} onChange={e => setMetodoPagamento(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30">
                      {METODOS_PAGAMENTO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>

                  {/* Referência externa */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Referência externa</p>
                    <input type="text" value={referenciaExterna} onChange={e => setReferenciaExterna(e.target.value)}
                      placeholder="Nº encomenda, PO, referência do cliente..."
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30" />
                  </div>

                  {/* Preços com IVA incluído */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Preços com IVA incluído</p>
                      <p className="text-[9px] text-[var(--slate-dim)] mt-0.5">Os preços nas linhas já incluem IVA</p>
                    </div>
                    <Toggle checked={ivaIncluido} onChange={setIvaIncluido} />
                  </div>

                  {/* Retenção na fonte */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Retenção na fonte</p>
                        <p className="text-[9px] text-[var(--slate-dim)] mt-0.5">IRS ou IRC retido na fonte</p>
                      </div>
                      <Toggle checked={retencao.ativa} onChange={v => setRetencao(r => ({ ...r, ativa: v }))} />
                    </div>
                    {retencao.ativa && (
                      <div className="grid grid-cols-3 gap-2 pl-1">
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Percentagem</p>
                          <input type="number" min="0" max="100" step="0.1"
                            value={retencao.percentagem}
                            onChange={e => setRetencao(r => ({ ...r, percentagem: Number(e.target.value) }))}
                            className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] text-xs text-center focus:outline-none focus:ring-1 focus:ring-[#1B3A57]/30" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--slate)]">Tipo</p>
                          <select value={retencao.tipo}
                            onChange={e => setRetencao(r => ({ ...r, tipo: e.target.value }))}
                            className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] text-xs focus:outline-none focus:ring-1 focus:ring-[#1B3A57]/30">
                            <option value="IRS">IRS</option>
                            <option value="IRC">IRC</option>
                          </select>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Ao pagar</p>
                          <div className="flex items-center h-[30px] gap-2">
                            <Toggle checked={retencao.ao_pagar} onChange={v => setRetencao(r => ({ ...r, ao_pagar: v }))} />
                            <span className="text-[9px] text-[var(--slate-dim)]">{retencao.ao_pagar ? 'Sim' : 'Não'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Moeda */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Moeda</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Código ISO</p>
                        <input type="text" value={moedaIso} onChange={e => setMoedaIso(e.target.value.toUpperCase())}
                          maxLength={3} placeholder="EUR"
                          className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] text-xs text-center focus:outline-none focus:ring-1 focus:ring-[#1B3A57]/30" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Taxa de conversão</p>
                        <input type="number" min="0" step="0.0001" value={moedaTaxa}
                          onChange={e => setMoedaTaxa(e.target.value)}
                          placeholder="1.0000"
                          disabled={moedaIso.toUpperCase() === 'EUR'}
                          className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] text-xs text-center focus:outline-none focus:ring-1 focus:ring-[#1B3A57]/30 disabled:bg-[var(--surface)] disabled:text-[var(--slate)]" />
                      </div>
                    </div>
                  </div>

                  {/* Morada do cliente */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Morada do cliente na fatura</p>
                        <p className="text-[9px] text-[var(--slate-dim)] mt-0.5">Sobrepõe a morada registada no TOConline</p>
                      </div>
                      <Toggle checked={moradaAtiva} onChange={setMoradaAtiva} />
                    </div>
                    {moradaAtiva && (
                      <div className="space-y-1.5 pl-1">
                        <input type="text" value={moradaDetalhe} onChange={e => setMoradaDetalhe(e.target.value)}
                          placeholder="Morada (rua, nº, andar...)"
                          className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30" />
                        <div className="grid grid-cols-3 gap-1.5">
                          <input type="text" value={moradaCp} onChange={e => setMoradaCp(e.target.value)}
                            placeholder="Cód. Postal"
                            className="px-2 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30" />
                          <input type="text" value={moradaCidade} onChange={e => setMoradaCidade(e.target.value)}
                            placeholder="Cidade"
                            className="col-span-2 px-2 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30" />
                        </div>
                        <input type="text" value={moradaPais} onChange={e => setMoradaPais(e.target.value)}
                          placeholder="País (PT)"
                          className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30" />
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

            <button onClick={() => setPasso(2)} disabled={!podeContinuar}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-md hover:opacity-90"
              style={{ backgroundColor: FT.navy }}>
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
              <div className="rounded-2xl border border-[var(--border)] overflow-hidden bg-white shadow-sm">
                {/* Cabeçalho */}
                <div className="px-5 py-4 border-b border-[var(--border-soft)] flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--slate-dim)] mb-0.5">{tipoLabel}</p>
                    <p className="text-lg font-black text-[var(--ink)]">{tipoDocumento} ••••{serie ? ` / ${serie}` : ''}</p>
                  </div>
                  <div className="text-right text-[10px] text-[var(--slate-dim)] space-y-0.5">
                    <p><span className="font-bold text-[var(--ink-mid)]">Data:</span> {dataFatura}</p>
                    {dataVencimento && <p><span className="font-bold text-[var(--ink-mid)]">Vencimento:</span> {dataVencimento}</p>}
                    {prazo > 0 && <p className="text-[var(--slate-dim)]">{prazo} dias</p>}
                    {metodoPgLabel && <p><span className="font-bold text-[var(--ink-mid)]">Pagamento:</span> {metodoPgLabel}</p>}
                    {referenciaExterna.trim() && <p><span className="font-bold text-[var(--ink-mid)]">Ref.:</span> {referenciaExterna}</p>}
                  </div>
                </div>

                {/* Cliente */}
                <div className="px-5 py-3 border-b border-[var(--border-soft)] bg-[var(--surface)]">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--slate-dim)] mb-1">Cliente</p>
                  <p className="text-xs font-bold text-[var(--ink)]">{cliente?.name}</p>
                  {cliente?.nif && <p className="text-[10px] text-[var(--slate-dim)]">NIF: {cliente.nif}</p>}
                  {moradaAtiva && moradaDetalhe && (
                    <p className="text-[10px] text-[var(--slate-dim)]">{moradaDetalhe}{moradaCp || moradaCidade ? `, ${moradaCp} ${moradaCidade}`.trim() : ''}</p>
                  )}
                </div>

                {/* Linhas */}
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-[var(--surface)] border-b border-[var(--border-soft)]">
                      <th className="px-5 py-2 text-left font-black uppercase tracking-widest text-[var(--slate-dim)]">Descrição</th>
                      <th className="px-2 py-2 text-center font-black uppercase tracking-widest text-[var(--slate-dim)] w-16">Qtd</th>
                      <th className="px-2 py-2 text-right font-black uppercase tracking-widest text-[var(--slate-dim)] w-20">Unit.</th>
                      <th className="px-2 py-2 text-center font-black uppercase tracking-widest text-[var(--slate-dim)] w-10">IVA</th>
                      {temDesconto && <th className="px-2 py-2 text-center font-black uppercase tracking-widest text-[var(--slate-dim)] w-12">Desc.</th>}
                      <th className="px-5 py-2 text-right font-black uppercase tracking-widest text-[var(--slate-dim)] w-20">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-soft)]">
                    {linhasPreview.map((l, i) => (
                      <tr key={i}>
                        <td className="px-5 py-2.5 text-[var(--ink-mid)] font-semibold">{l.descricao}</td>
                        <td className="px-2 py-2.5 text-center text-[var(--slate-dim)]">{l.qtd.toFixed(2)}{l.unidade && ` ${l.unidade}`}</td>
                        <td className="px-2 py-2.5 text-right text-[var(--slate-dim)]">{l.unitPrice.toFixed(2)} €</td>
                        <td className="px-2 py-2.5 text-center text-[var(--slate-dim)]">{l.taxa_iva}%</td>
                        {temDesconto && <td className="px-2 py-2.5 text-center text-[var(--slate-dim)]">{l.desconto || '—'}</td>}
                        <td className="px-5 py-2.5 text-right font-bold text-[var(--ink)]">{l.total.toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totais */}
                <div className="px-5 py-3 border-t border-[var(--border-soft)] bg-[var(--surface)] space-y-1">
                  {ivaIncluido && (
                    <p className="text-[9px] text-amber-600 mb-1">* Preços incluem IVA</p>
                  )}
                  <div className="flex justify-between text-[10px] text-[var(--slate-dim)]">
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
                  <div className="flex justify-between text-[10px] text-[var(--slate-dim)]">
                    <span>Base tributável</span>
                    <span>{totalBaseGlobal.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--slate-dim)]">
                    <span>IVA</span>
                    <span>{totalIva.toFixed(2)} €</span>
                  </div>
                  {retencao.ativa && (
                    <div className="flex justify-between text-[10px] text-amber-600">
                      <span>Retenção {retencao.tipo} ({retencao.percentagem}%)</span>
                      <span>-{(totalBaseGlobal * retencao.percentagem / 100).toFixed(2)} €</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-[var(--ink)] pt-1 border-t border-[var(--border)]">
                    <span>Total</span>
                    <span>{totalFatura.toFixed(2)} €{moedaIso.toUpperCase() !== 'EUR' ? ` ${moedaIso.toUpperCase()}` : ''}</span>
                  </div>
                </div>

                {/* Observações */}
                {observacoes.trim() && (
                  <div className="px-5 py-3 border-t border-[var(--border-soft)]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--slate-dim)] mb-1">Observações</p>
                    <p className="text-[10px] text-[var(--ink-soft)] leading-relaxed">{observacoes}</p>
                  </div>
                )}
              </div>

              {/* Fase 2b — bloqueio fail-closed: nunca deixa avançar para a
                  emissão sem uma estimativa de ajudas de custo válida. */}
              {gateAjudas?.status === 'bloqueado' && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-rose-700">Fatura não pode ser emitida</p>
                      <p className="text-[10px] text-rose-600 mt-0.5">{gateAjudas.motivo}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setGateAjudas(null)}
                      className="flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] hover:bg-white rounded-lg transition-all">
                      Cancelar
                    </button>
                    <button
                      onClick={() => navigate(gateAjudas.motivo?.includes('percentagem') ? '/admin/ajudas-custo?subtab=historico' : '/admin/ajudas-custo?subtab=elegibilidade')}
                      className="flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white rounded-lg transition-all hover:opacity-90"
                      style={{ backgroundColor: FT.navy }}>
                      {gateAjudas.motivo?.includes('percentagem') ? 'Ir para Histórico' : 'Ir para Elegibilidade'}
                    </button>
                  </div>
                </div>
              )}

              {/* Cartão de confirmação (mesmo padrão do SEPA) — só emite após clique explícito. */}
              {gateAjudas?.status === 'calculado' && (() => {
                const l = gateAjudas.linha;
                return (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Confirmação de ajudas de custo</p>
                    <div className="flex justify-between text-[11px] text-[var(--ink-soft)]">
                      <span>Valor estimado bruto</span>
                      <span className="font-bold text-[var(--ink)]">{l.valorEstimadoBruto.toFixed(2)} €</span>
                    </div>
                    {l.residuoAplicado !== 0 && (
                      <div className="flex justify-between text-[11px] text-[var(--ink-soft)]">
                        <span>Resíduo do mês anterior aplicado</span>
                        <span className="font-bold text-[var(--ink)]">{l.residuoAplicado.toFixed(2)} €</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[11px] text-[var(--ink-soft)]">
                      <span>% histórica usada</span>
                      <span className="font-bold text-[var(--ink)]">{(gateAjudas.percentagemUsada * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-xs font-black text-[var(--ink)] pt-1.5 border-t border-[var(--border)]">
                      <span>Valor final (vai para a observação)</span>
                      <span>{l.valorFinal.toFixed(2)} €</span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setGateAjudas(null)} disabled={emitindo}
                        className="flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] hover:bg-white rounded-lg transition-all disabled:opacity-50">
                        Cancelar
                      </button>
                      <button onClick={handleConfirmarEEmitir} disabled={emitindo}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white rounded-lg transition-all disabled:opacity-60 hover:opacity-90"
                        style={{ backgroundColor: FT.orange, color: FT.navy }}>
                        {emitindo ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                        Confirmar e Emitir
                      </button>
                    </div>
                  </div>
                );
              })()}

              {(!gateAjudas || gateAjudas.status === 'verificando') && (
                <div className="flex gap-2">
                  <button onClick={() => setPasso(1)} disabled={gateAjudas?.status === 'verificando'}
                    className="flex-1 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-xl transition-all disabled:opacity-50">
                    Voltar
                  </button>
                  <button onClick={handleIniciarEmissao} disabled={emitindo || gateAjudas?.status === 'verificando'}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-60 shadow-md hover:opacity-90"
                    style={{ backgroundColor: FT.orange, color: FT.navy }}>
                    {(emitindo || gateAjudas?.status === 'verificando') ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                    {gateAjudas?.status === 'verificando' ? 'A verificar ajudas...' : `Emitir ${tipoDocumento}`}
                  </button>
                </div>
              )}
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
                  <p className="text-sm font-black text-[var(--ink)]">{tipoDocumento} emitido com sucesso</p>
                  {(resultado.documento?.attributes?.document_number || resultado.doc_id) && (
                    <p className="text-xs text-[var(--slate-dim)] mt-1">Nº {resultado.documento?.attributes?.document_number || resultado.doc_id}</p>
                  )}
                  <p className="text-xs text-[var(--slate-dim)] mt-0.5">Cliente: {cliente?.name || nomeToConlineInicial} · {periodoLabel(periodo)}</p>
                  <p className="text-sm font-black text-emerald-700 mt-2">{totalFatura.toFixed(2)} €</p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <AlertCircle size={40} className="mx-auto text-red-400" />
                <div>
                  <p className="text-sm font-black text-[var(--ink)]">Erro ao emitir documento</p>
                  <p className="text-xs text-red-600 mt-1">{resultado.erro}</p>
                </div>
                <button onClick={() => { setPasso(2); setResultado(null); }}
                  className="px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-[var(--surface-dim)] rounded-xl transition-all" style={{ color: 'var(--slate-dim)' }}>
                  Tentar novamente
                </button>
              </div>
            )}
            <button onClick={onClose}
              className="w-full px-4 py-2.5 text-xs font-black uppercase tracking-widest text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-xl transition-all">
              Fechar
            </button>
          </div>
        )}
        </>}

      </div>
    </ModalShell>
  );
}
