import React, { useState, useMemo, useCallback, useEffect, useRef, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useDragScroll } from '../../lib/useDragScroll.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getRateAtDate } from './cost-reports/useCostReportsData.js';
import {
  IRS_TABELAS,
  IRS_TABELAS_BY_YEAR,
  getIRSTabelasPorAno,
  LIMITES,
  MESES_PT,
  calcularRecibo,
  valorDiarioLegal,
  eur,
} from '../../lib/payroll/reciboCalculations.js';
import { calcularDiasUteisNoMes } from '../../lib/payroll/feriadosPortugal.js';
import { findBestCombo, horaDefaultPartida, horaDefaultChegada, pctFromHoraPartida, pctFromHoraChegada, SYNC_TOLERANCE } from '../../lib/payroll/mapaAutoFill.js';
import { calcMesParcial, calcDiasFeriasAnoAdmissao } from '../../lib/payroll/mesParcial.js';
import { RESUMO_COLS, GROUP_DEFS } from '../../lib/payroll/resumoCols.js';
import HistoricoDeslocacao from './HistoricoDeslocacao.jsx';

const EMPRESA = {
  nome: 'Magnetic Place Unipessoal, Lda',
  morada: 'Rua D. Pedro V n 715 Loja 80, Trofa, Bougado (São Martinho e Santiago)',
  nif: '517379740',
};

// Trabalhadores que recebem sempre o máximo de ajudas de custo isentas
const SEMPRE_AJUDAS_MAX = ['diego rocha barbosa', 'nicole emanuele rosa da costa galtieri'];
const isMaxAjudasWorker = (name) => SEMPRE_AJUDAS_MAX.includes((name || '').trim().toLowerCase());
// Função fiscal por trabalhador (fallback name-based para max-ajudas sem CPP definido)
const funcaoMaxAjudasWorker = (name) =>
  (name || '').trim().toLowerCase() === 'diego rocha barbosa' ? 'gerencia' : 'geral';
// CPP Grupo 1 (códigos iniciados por '1'): Diretores e Gestores → gerência; outros → geral
const funcaoDeCPP = (codigoCPP) =>
  codigoCPP && String(codigoCPP).startsWith('1') ? 'gerencia' : 'geral';

const INPUT_DEFAULT = {
  nome: '',
  nif: '',
  categoria: '',
  nis: '',
  mes: String(new Date().getMonth() + 1),
  ano: String(new Date().getFullYear()),
  diasMes: '20',
  vencimentoBase: '',
  horasSemana: '40',
  premios: '0',
  he1: '0',
  he2: '0',
  incluirFerias: true,
  incluirNatal: true,
  subsAlimValorDia: '8.00',
  subsAlimDias: '22',
  subsAlimTipo: 'dinheiro',
  tabelaKey: 'tabelaI',
  nDependentes: '0',
  brutoAlvo: '',
  territorio: 'internacional',
  funcao: 'geral',
  vdl: String(LIMITES.ajudaInternacionalGeral),
  cliente: '',
  localidade: '',
  pais: '',
  clienteAbrev:    '',
  localidadeAbrev: '',
};

const MAPA_DEFAULT = {
  dataInicio: '',
  horaPartida: '07:30',
  horaChegada: '20:30',
};

const CAMPOS_AUTO_DEFAULT = {
  nome: false, nif: false, categoria: false, nis: false,
  vencimentoBase: false, subsAlimValorDia: false, subsAlimTipo: false,
  tabelaKey: false, nDependentes: false,
  cliente: false, localidade: false, pais: false, territorio: false,
};

function n(v) { return parseFloat(v) || 0; }

const InputVariant = createContext('default');

function LabelInput({ label, children, hint, badge }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 ml-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</label>
        {badge && <span className="text-[8px] font-black uppercase tracking-wide text-[#869AAF] bg-[#EEF1F5] px-1.5 py-0.5 rounded">{badge}</span>}
      </div>
      {children}
      {hint && <span className="text-[10px] text-slate-400 ml-1">{hint}</span>}
    </div>
  );
}

function TextInput({ value, onChange, type = 'text', readOnly, step, min, max, className = '', placeholder }) {
  const variant = useContext(InputVariant);
  if (variant === 'line') {
    return (
      <input
        type={type} value={value} onChange={onChange} readOnly={readOnly}
        step={step} min={min} max={max} placeholder={placeholder}
        className={`w-full bg-transparent border-0 border-b border-slate-200 rounded-none pl-0 py-1.5 text-sm font-bold outline-none transition-all
          ${readOnly ? 'text-slate-400 cursor-default' : 'focus:border-[#1B3A57]'}
          ${className}`}
      />
    );
  }
  return (
    <input
      type={type} value={value} onChange={onChange} readOnly={readOnly}
      step={step} min={min} max={max} placeholder={placeholder}
      className={`w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none shadow-sm transition-all
        ${readOnly ? 'bg-slate-50 text-slate-400 cursor-default' : 'focus:border-[#1B3A57] focus:ring-2 focus:ring-[#1B3A57]/10'}
        ${className}`}
    />
  );
}

function SelectInput({ value, onChange, children }) {
  const variant = useContext(InputVariant);
  if (variant === 'line') {
    return (
      <select
        value={value} onChange={onChange}
        className="w-full bg-transparent border-0 border-b border-slate-200 rounded-none px-0 py-1.5 text-sm font-bold outline-none transition-all focus:border-[#1B3A57] lowercase"
      >
        {children}
      </select>
    );
  }
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none shadow-sm focus:border-[#1B3A57] focus:ring-2 focus:ring-[#1B3A57]/10 transition-all lowercase"
    >
      {children}
    </select>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ n: num, label }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0" style={{ background: '#1B3A57' }}>{num}</span>
      <h3 className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#1B3A57' }}>{label}</h3>
    </div>
  );
}

const TZ_MAP = {
  'Europe/Lisbon':     { pais: 'Portugal',       territorio: 'nacional' },
  'Europe/Madrid':     { pais: 'Espanha',         territorio: 'internacional' },
  'Europe/Paris':      { pais: 'França',          territorio: 'internacional' },
  'Europe/Berlin':     { pais: 'Alemanha',        territorio: 'internacional' },
  'Europe/London':     { pais: 'Reino Unido',     territorio: 'internacional' },
  'Europe/Amsterdam':  { pais: 'Países Baixos',   territorio: 'internacional' },
  'Europe/Brussels':   { pais: 'Bélgica',         territorio: 'internacional' },
  'Europe/Luxembourg': { pais: 'Luxemburgo',      territorio: 'internacional' },
  'Europe/Rome':       { pais: 'Itália',          territorio: 'internacional' },
  'Europe/Zurich':     { pais: 'Suíça',           territorio: 'internacional' },
};

function dadosDeCliente(client) {
  const tz = client?.timezone || 'Europe/Madrid';
  const { pais = '', territorio = 'internacional' } = TZ_MAP[tz] || {};
  let localidade = '';
  if (client?.morada) {
    const partes = client.morada.split(',').map(p => p.trim()).filter(Boolean);
    // Penúltima parte costuma ser a localidade (antes do país)
    localidade = partes.length >= 2 ? partes[partes.length - 2] : partes[0] || '';
  }
  return { cliente: client?.name || '', localidade, pais, territorio };
}

const _SESSION_KEY = 'recibos_v1';
const _SESSION_VER = 2;
function _loadSession() {
  try {
    const d = JSON.parse(sessionStorage.getItem(_SESSION_KEY) || 'null');
    if (!d || d._v !== _SESSION_VER) return {};
    return d;
  } catch { return {}; }
}

export default function RecibosCalculadora() {
  const { workers, logs, supabase, clients } = useApp();

  // Lê sessionStorage UMA VEZ por mount; lazy initializers subsequentes usam este snapshot
  const [_s] = useState(_loadSession);

  const [selectedWorkerId, setSelectedWorkerId] = useState(() => _s.selectedWorkerId || '');
  const selectedWorkerIsMaxAjudas = useMemo(() => {
    if (!selectedWorkerId) return false;
    const w = workers?.find(x => x.id === selectedWorkerId);
    return isMaxAjudasWorker(w?.name);
  }, [selectedWorkerId, workers]);

  const [inputs, setInputs] = useState(() => ({ ...INPUT_DEFAULT, ...(_s.inputs || {}) }));
  const [mapa, setMapa] = useState(() => ({ ...MAPA_DEFAULT, ...(_s.mapa || {}) }));
  const [mapaRows, setMapaRows] = useState(() => _s.mapaRows || []);
  const [autoFillInfo, setAutoFillInfo] = useState(() => _s.autoFillInfo || null);
  const [workerRateHistory, setWorkerRateHistory] = useState([]);
  const logoRef = useRef(null);
  const dataInicioInputRef = useRef(null);
  const [subTab, setSubTab] = useState(() => _s.subTab || 'calculadora');
  const [contabData, setContabData] = useState([]);
  // Indica se o valor de cada campo foi calculado automaticamente (true) ou editado manualmente (false)
  const [diasCalculados, setDiasCalculados] = useState(() => _s.diasCalculados || { diasMes: false, subsAlimDias: false });
  // Chave da última combinação trabalhador+mês já auto-preenchida (dias e mapa)
  const diasAutoFillKeyRef = useRef(_s.diasAutoFillKey || '');
  const mapaAutoFillKeyRef = useRef(_s.mapaAutoFillKey || '');
  // Feriado municipal configurado ao nível da empresa (campo 'feriado_municipal' em system_settings)
  const [feriadoMunicipal, setFeriadoMunicipal] = useState(null);
  const [isValidado, setIsValidado]             = useState(false);
  const [saveStatus, setSaveStatus]             = useState(null); // null | 'saving' | 'saved' | 'error'
  const [brutoAlvoEditado, setBrutoAlvoEditado] = useState(() => _s.brutoAlvoEditado || false);
  const [camposAuto, setCamposAuto] = useState(() => ({ ...CAMPOS_AUTO_DEFAULT, ...(_s.camposAuto || {}) }));
  const [complementMethod, setComplementMethod] = useState(() => _s.complementMethod || 'A008');
  const mesStr = useMemo(
    () => `${inputs.ano}-${String(parseInt(inputs.mes, 10)).padStart(2, '0')}`,
    [inputs.ano, inputs.mes]
  );
  // ── Mês parcial (admissão / cessação no mês em processamento) ──
  const [mesParcialDados, setMesParcialDados] = useState(null);
  // null | { tipo, diaInicio, diaFim, diasTrabalhados, vencBaseOriginal, vencProporcional, fator }
  const mesParcialKeyRef  = useRef('');
  const mesParcialDadosRef = useRef(null); // espelho síncrono de mesParcialDados
  let rowCounter = mapaRows.length;

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      const IW = canvas.width, IH = canvas.height;

      // Cor de fundo = canto superior-esquerdo
      const bgR = d[0], bgG = d[1], bgB = d[2];
      const tol = 40;
      const similar = px => Math.abs(d[px]-bgR) < tol && Math.abs(d[px+1]-bgG) < tol && Math.abs(d[px+2]-bgB) < tol;

      // Flood fill BFS a partir de todas as bordas — só remove pixels externos conectados
      const visited = new Uint8Array(IW * IH);
      const queue = [];
      let head = 0;

      const seed = idx => { if (!visited[idx] && similar(idx * 4)) { visited[idx] = 1; queue.push(idx); } };

      for (let x = 0; x < IW; x++) { seed(x); seed((IH - 1) * IW + x); }
      for (let y = 1; y < IH - 1; y++) { seed(y * IW); seed(y * IW + IW - 1); }

      while (head < queue.length) {
        const idx = queue[head++];
        d[idx * 4 + 3] = 0; // transparente
        const x = idx % IW, y = (idx / IW) | 0;
        if (x > 0)      seed(idx - 1);
        if (x < IW - 1) seed(idx + 1);
        if (y > 0)      seed(idx - IW);
        if (y < IH - 1) seed(idx + IW);
      }

      ctx.putImageData(imgData, 0, 0);
      logoRef.current = canvas.toDataURL('image/png');
    };
    img.src = '/logo-magnetic.png';
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('worker_valorhora_history').select('*')
      .then(({ data }) => setWorkerRateHistory(data || []));
  }, [supabase]);

  // Carrega o feriado municipal da empresa (campo 'feriado_municipal' em system_settings)
  useEffect(() => {
    if (!supabase) return;
    supabase.from('system_settings').select('*').eq('id', 1).maybeSingle()
      .then(({ data }) => setFeriadoMunicipal(data?.feriado_municipal || null));
  }, [supabase]);

  // Limpa contabData ao mudar mês para evitar mostrar valores do mês anterior enquanto o fetch não termina
  useEffect(() => {
    setContabData([]);
  }, [inputs.mes, inputs.ano]);

  // Carrega contabilidade_mensal reactivamente ao mudar o mês
  useEffect(() => {
    if (!supabase) return;
    const mesStr = `${inputs.ano}-${String(parseInt(inputs.mes, 10)).padStart(2, '0')}`;
    supabase.from('contabilidade_mensal').select('*').eq('mes', mesStr)
      .then(({ data }) => setContabData(data || []));
  }, [supabase, inputs.mes, inputs.ano]);

  // Calcula o custo do trabalhador no mês selecionado (igual à coluna Custo em Custos/Equipa)
  const calcularCustoMes = useCallback((workerId, mes, ano) => {
    if (!workerId || !logs) return 0;
    const monthStr = `${ano}-${String(mes).padStart(2, '0')}`;
    const worker = workers.find(w => w.id === workerId);
    const history = workerRateHistory.filter(h => h.worker_id === workerId);
    return (logs || [])
      .filter(l => l.workerId === workerId && l.date?.startsWith(monthStr))
      .reduce((sum, log) => {
        const rate = getRateAtDate(log.date, history, worker?.valorHora);
        return sum + (Number(log.hours) || 0) * rate;
      }, 0);
  }, [logs, workers, workerRateHistory]);

  // Ref para aceder à versão mais recente de calcularCustoMes sem re-disparar o efeito quando logs actualizam em background
  const calcularCustoMesRef = useRef(calcularCustoMes);
  useEffect(() => { calcularCustoMesRef.current = calcularCustoMes; }, [calcularCustoMes]);

  // Sincroniza brutoAlvo ao mudar trabalhador ou mês (valor auto dos logs).
  // O useEffect de isValidado corre depois (async) e sobrescreve com o ajuste_bruto salvo, se existir.
  useEffect(() => {
    if (!selectedWorkerId || !workers?.length) return;
    const custo = calcularCustoMesRef.current(selectedWorkerId, inputs.mes, inputs.ano);
    setBrutoAlvoEditado(false);
    setInputs(prev => ({ ...prev, brutoAlvo: custo > 0 ? custo.toFixed(2) : prev.brutoAlvo }));
  // workers?.length garante que o effect re-corre quando os workers carregam (necessário com sessão restaurada)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkerId, inputs.mes, inputs.ano, workers?.length]);

  // Auto-preenchimento de "Dias processados" e "Dias com subsídio" ao mudar trabalhador ou mês.
  // Só corre uma vez por combinação trabalhador+mês; não sobrescreve edições manuais feitas depois.
  useEffect(() => {
    if (!selectedWorkerId || !supabase) return;
    const key = `${selectedWorkerId}-${inputs.mes}-${inputs.ano}`;
    if (diasAutoFillKeyRef.current === key) return;
    diasAutoFillKeyRef.current = key;

    const w = workers.find(x => x.id === selectedWorkerId);
    if (!w) return;

    const mes = parseInt(inputs.mes, 10);
    const ano = parseInt(inputs.ano, 10);
    const mesStr = `${ano}-${String(mes).padStart(2, '0')}`;

    let cancelled = false;
    supabase
      .from('absence_requests')
      .select('dates')
      .eq('worker_id', selectedWorkerId)
      .eq('status', 'approved')
      .then(({ data }) => {
        if (cancelled) return;
        const ausencias = (data || [])
          .flatMap(a => a.dates || [])
          .filter(d => d.startsWith(mesStr));

        const dias = calcularDiasUteisNoMes(ano, mes, {
          feriadoMunicipal,
          dataAdmissao: w.dataInicio || null,
          dataCessacao: w.dataFim || null,
          ausencias,
          horasSemana: parseFloat(inputs.horasSemana) || 40,
        });

        setInputs(prev => ({ ...prev, diasMes: String(dias), subsAlimDias: String(dias) }));
        setDiasCalculados({ diasMes: true, subsAlimDias: true });
        mapaAutoFillKeyRef.current = ''; // permite que o mapa re-preencha com subsAlimDias correcto
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkerId, inputs.mes, inputs.ano, workers, supabase, feriadoMunicipal]);

  // Deteção de mês parcial: auto-fill vencBase proporcional quando admissão ou cessação
  // caem no mês em processamento (convenção de 30 dias — Código do Trabalho).
  useEffect(() => {
    if (!selectedWorkerId) { setMesParcialDados(null); mesParcialDadosRef.current = null; return; }
    const key = `${selectedWorkerId}-${inputs.mes}-${inputs.ano}`;
    if (mesParcialKeyRef.current === key) return;
    mesParcialKeyRef.current = key;

    const w = workers?.find(x => x.id === selectedWorkerId);
    if (!w?.vencimento_base) { setMesParcialDados(null); mesParcialDadosRef.current = null; return; }

    const info = calcMesParcial(
      w.dataInicio || null,
      w.dataFim    || null,
      parseInt(inputs.ano, 10),
      parseInt(inputs.mes, 10),
    );

    if (info.tipo === 'completo') {
      if (mesParcialDadosRef.current !== null) {
        // Voltou de um mês parcial → restaura vencBase do perfil do trabalhador
        setInputs(prev => ({ ...prev, vencimentoBase: String(w.vencimento_base) }));
        setCamposAuto(prev => ({ ...prev, vencimentoBase: true }));
      }
      mesParcialDadosRef.current = null;
      setMesParcialDados(null);
      return;
    }

    const vencBaseOriginal  = parseFloat(w.vencimento_base);
    const vencProporcional  = parseFloat((vencBaseOriginal * info.fator).toFixed(2));
    const dados = { tipo: info.tipo, diaInicio: info.diaInicio, diaFim: info.diaFim,
                    diasTrabalhados: info.diasTrabalhados, vencBaseOriginal, vencProporcional,
                    fator: info.fator };

    mesParcialDadosRef.current = dados;
    setMesParcialDados(dados);
    // Mantém o campo no valor contratual cheio; o desconto aparece como linha separada
    setInputs(prev => ({ ...prev, vencimentoBase: String(vencBaseOriginal) }));
    setCamposAuto(prev => ({ ...prev, vencimentoBase: true }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkerId, inputs.mes, inputs.ano, workers?.length]);

  const set = useCallback((field, value) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSelectWorker = (e) => {
    const id = e.target.value;
    setSelectedWorkerId(id);
    setMapaRows([]);
    setAutoFillInfo(null);
    diasAutoFillKeyRef.current = '';
    mapaAutoFillKeyRef.current = '';
    mesParcialKeyRef.current   = '';
    mesParcialDadosRef.current = null;
    setMesParcialDados(null);
    setDiasCalculados({ diasMes: false, subsAlimDias: false });
    setBrutoAlvoEditado(false);
    if (!id) {
      // Sem trabalhador: limpar todos os campos mas preservar mês/ano
      setInputs(prev => ({ ...INPUT_DEFAULT, mes: prev.mes, ano: prev.ano }));
      setCamposAuto(CAMPOS_AUTO_DEFAULT);
      return;
    }
    setInputs(prev => ({ ...prev, premios: '0' }));
    const w = workers.find(x => x.id === id);
    if (!w) return;

    // Cliente padrão atribuído ao trabalhador
    const clientId = w.defaultClientId || (w.assignedClients || [])[0];
    const client = (clients || []).find(c => c.id === clientId);
    const dc = dadosDeCliente(client);

    setCamposAuto({
      nome:            !!w.name,
      nif:             !!w.nif,
      categoria:       !!w.profissao,
      nis:             !!w.nis,
      vencimentoBase:  w.vencimento_base != null,
      subsAlimValorDia: w.subsidio_alimentacao_dia != null,
      subsAlimTipo:    true, // sempre auto ao selecionar trabalhador
      tabelaKey:       !!w.tabela_irs,
      nDependentes:    w.n_dependentes != null,
      cliente:         !!dc.cliente,
      localidade:      !!dc.localidade,
      pais:            !!dc.pais,
      territorio:      !!dc.territorio,
    });

    setInputs(prev => ({
      ...prev,
      nome: w.name || prev.nome,
      nif: w.nif || prev.nif,
      categoria: w.profissao || prev.categoria,
      nis: w.nis || prev.nis,
      vencimentoBase: w.vencimento_base != null ? String(w.vencimento_base) : prev.vencimentoBase,
      subsAlimValorDia: w.subsidio_alimentacao_dia != null ? String(w.subsidio_alimentacao_dia) : prev.subsAlimValorDia,
      subsAlimTipo: w.subsidio_alimentacao_tipo || 'dinheiro',
      tabelaKey: w.tabela_irs || prev.tabelaKey,
      nDependentes: w.n_dependentes != null ? String(w.n_dependentes) : prev.nDependentes,
      cliente: dc.cliente || prev.cliente,
      localidade: dc.localidade || prev.localidade,
      pais: dc.pais || prev.pais,
      territorio: dc.territorio || prev.territorio,
      // Funcao fiscal: derivada do CPP da profissão; fallback name-based para trabalhadores max-ajudas sem CPP
      funcao: w.profissao_cnp
        ? funcaoDeCPP(w.profissao_cnp)
        : (isMaxAjudasWorker(w.name) ? funcaoMaxAjudasWorker(w.name) : prev.funcao),
      // Para trabalhadores com ajudas máximas: bruto é livre (funcao já definida acima)
      ...(isMaxAjudasWorker(w.name) ? { brutoAlvo: '' } : {}),
    }));
  };

  const r = useMemo(() => {
    // Usa valor proporcional para IRS/SS (correto) mesmo que A001 mostre o valor contratual cheio
    const vencEfetivo = mesParcialDados ? mesParcialDados.vencProporcional : n(inputs.vencimentoBase);
    if (!vencEfetivo) return null;

    return calcularRecibo({
      vencimentoBase: vencEfetivo,
      horasSemana: n(inputs.horasSemana),
      premios: n(inputs.premios),
      he1: n(inputs.he1),
      he2: n(inputs.he2),
      incluirFerias: inputs.incluirFerias,
      incluirNatal: inputs.incluirNatal,
      subsAlimValorDia: n(inputs.subsAlimValorDia),
      subsAlimDias: n(inputs.subsAlimDias),
      subsAlimTipo: inputs.subsAlimTipo,
      tabelaKey: inputs.tabelaKey,
      nDependentes: n(inputs.nDependentes),
      brutoAlvo: n(inputs.brutoAlvo),
      territorio: inputs.territorio,
      funcao: inputs.funcao,
      ano: n(inputs.ano),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, mesParcialDados]);

  // Sincroniza o valor diário legal quando muda o território ou função
  useEffect(() => {
    setInputs(prev => ({
      ...prev,
      vdl: String(valorDiarioLegal(prev.territorio, prev.funcao)),
    }));
  }, [inputs.territorio, inputs.funcao]);

  // Preenche o mapa de ajudas automaticamente ao mudar trabalhador ou mês.
  // Corre duas vezes por design: primeiro com brutoAlvo (rápido), depois com subsAlimDias correcto
  // (quando a query de ausências retorna e reset a chave). Edições manuais ao mapa não são sobrescritas.
  useEffect(() => {
    if (!selectedWorkerId || !r || n(inputs.vdl) <= 0) return;
    if (!selectedWorkerIsMaxAjudas && r.ajudaCustoNecessaria <= 0) return;
    const key = `${selectedWorkerId}-${inputs.mes}-${inputs.ano}-${n(inputs.vencimentoBase)}-${inputs.subsAlimTipo}-${n(inputs.nDependentes)}-${inputs.tabelaKey}-${n(inputs.subsAlimValorDia)}-${n(inputs.subsAlimDias)}-${n(inputs.brutoAlvo)}-${String(inputs.incluirFerias)}-${String(inputs.incluirNatal)}-${n(inputs.he1)}-${n(inputs.he2)}`;
    if (mapaAutoFillKeyRef.current === key) return;
    mapaAutoFillKeyRef.current = key;
    autoFill();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkerId, inputs.mes, inputs.ano, r]);

  // Carrega estado de validação e brutoAlvo salvo manualmente para este worker+mês
  useEffect(() => {
    if (!supabase || !selectedWorkerId || !inputs.mes || !inputs.ano) { setIsValidado(false); return; }
    const mesStr = `${inputs.ano}-${String(n(inputs.mes)).padStart(2, '0')}`;
    supabase
      .from('resumo_observacoes')
      .select('completo, ajuste_bruto')
      .eq('worker_id', selectedWorkerId)
      .eq('mes', mesStr)
      .maybeSingle()
      .then(({ data }) => {
        setIsValidado(data?.completo ?? false);
        if (data?.ajuste_bruto != null) {
          setInputs(prev => ({ ...prev, brutoAlvo: String(data.ajuste_bruto) }));
          setBrutoAlvoEditado(true);
        }
      });
  }, [selectedWorkerId, inputs.mes, inputs.ano, supabase]);

  // Persiste o estado na sessão do browser para sobreviver a navegação entre páginas
  useEffect(() => {
    try {
      sessionStorage.setItem(_SESSION_KEY, JSON.stringify({
        _v: _SESSION_VER,
        selectedWorkerId, inputs, mapa, mapaRows, subTab, autoFillInfo,
        diasCalculados, camposAuto, brutoAlvoEditado, complementMethod,
        diasAutoFillKey: diasAutoFillKeyRef.current,
        mapaAutoFillKey: mapaAutoFillKeyRef.current,
      }));
    } catch {}
  }, [selectedWorkerId, inputs, mapa, mapaRows, subTab, autoFillInfo, diasCalculados, camposAuto, brutoAlvoEditado, complementMethod]);

  const mapaTotal = useMemo(() => {
    return mapaRows.reduce((sum, row) => {
      const limite = row.territorio === 'Nacional' ? LIMITES.ajudaNacional : n(inputs.vdl);
      return sum + limite * (row.pct / 100);
    }, 0);
  }, [mapaRows, inputs.vdl]);

  const mapaDiff = r ? mapaTotal - r.ajudaCustoNecessaria : 0;

  // Subsídio alimentação calculado ao vivo a partir das linhas actuais do mapa (apenas dias úteis Seg-Sex)
  const subsAlimMapaLive = useMemo(() => {
    const vdia = n(inputs.subsAlimValorDia);
    if (vdia <= 0) return 0;
    return mapaRows.reduce((sum, row) => {
      if (!row.dia) return sum;
      const dow = new Date(row.dia + 'T00:00:00').getDay();
      return sum + (dow >= 1 && dow <= 5 ? vdia : 0);
    }, 0);
  }, [mapaRows, inputs.subsAlimValorDia]);

  // Valor total do complemento nos inputs actuais (A008 + HE1 + HE2)
  const complementTotalLive = r
    ? Math.round((n(inputs.premios) + n(inputs.he1) * r.valorHe1un + n(inputs.he2) * r.valorHe2un) * 100) / 100
    : 0;

  // A082 = valor líquido do mapa ao vivo: Total do Mapa − Subsídio Alimentação do Mapa
  // O complemento (A008/HE) é uma rubrica SEPARADA no recibo — NUNCA soma aqui.
  const mapaLiqLive = mapaRows.length > 0
    ? Math.round((mapaTotal - subsAlimMapaLive) * 100) / 100
    : null;

  // Importância total a receber pelo trabalhador = A082 + complemento (só para informação no info-box)
  const importanciaAReceber = mapaLiqLive != null
    ? Math.round((mapaLiqLive + complementTotalLive) * 100) / 100
    : null;

  // Desviado = A082 live ≠ r.ajudaCustoNecessaria (o valor que o recibo calcula para A082)
  // Indica que o mapa e o recibo estão dessincronizados — exportação bloqueada.
  const mapaDesviado = mapaLiqLive != null && r != null
    && Math.abs(mapaLiqLive - r.ajudaCustoNecessaria) > SYNC_TOLERANCE;

  // A082 para o recibo: sempre o líquido do mapa ao vivo (nunca snapshot, nunca com complemento)
  const ajudasDisplay   = mapaLiqLive ?? r?.ajudaCustoNecessaria ?? 0;
  const _diffAjudas     = r ? ajudasDisplay - r.ajudaCustoNecessaria : 0;
  // totalAbonosDisplay e totalDescontosDisplay computados abaixo, após descontoD001 estar disponível
  const liquidoDisplay  = r ? r.liquido      + _diffAjudas : 0;
  const custoEmpDisplay = r ? r.custoEmpresa + _diffAjudas : 0;

  // Linhas do Resumo Mensal (mesma lógica do Excel)
  const resumoRows = useMemo(() => {
    const mesNum  = parseInt(inputs.mes, 10);
    const mesStr  = `${inputs.ano}-${String(mesNum).padStart(2, '0')}`;
    const anoNum  = n(inputs.ano);
    const eur2    = v => (isNaN(v) ? 0 : v).toFixed(2);
    const pct2    = v => (v * 100).toFixed(2) + '%';

    // Trabalhadores sempre incluídos no resumo mesmo sem horas no mês

    const trabalhadores = (workers || [])
      .filter(w => w.vencimento_base != null)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const logsDoMes = (logs || []).filter(l => l.date?.startsWith(mesStr));

    return trabalhadores.map(w => {
      const workerLogs   = logsDoMes.filter(l => l.workerId === w.id);
      const sempreIncluir = isMaxAjudasWorker(w.name);
      const funcaoW       = sempreIncluir ? funcaoMaxAjudasWorker(w.name) : 'geral';
      if (workerLogs.length === 0 && !sempreIncluir) return null; // sem registos neste mês
      const hist         = workerRateHistory.filter(h => h.worker_id === w.id);
      const brutoAlvo    = workerLogs.reduce((s, l) => {
        const rate = getRateAtDate(l.date, hist, parseFloat(w.valorHora) || 0);
        return s + (parseFloat(l.hours) || 0) * rate;
      }, 0);
      const subsAlimDias = calcularDiasUteisNoMes(anoNum, mesNum, {
        feriadoMunicipal,
        dataAdmissao: w.dataInicio || null,
        dataCessacao: w.dataFim    || null,
      });
      const wMesParcialR  = calcMesParcial(w.dataInicio || null, w.dataFim || null, anoNum, mesNum);
      const wVencOrigR    = parseFloat(w.vencimento_base) || 0;
      const wVencCalculoR = wMesParcialR.tipo !== 'completo'
        ? parseFloat((wVencOrigR * wMesParcialR.fator).toFixed(2))
        : undefined;

      // eslint-disable-next-line react-hooks/exhaustive-deps
      const { rc, mapaLiqLive: mapaLiqCalc } = _calcReciboComMapa(w, subsAlimDias, brutoAlvo, anoNum, mesStr, wVencCalculoR, funcaoW);
      // Para trabalhadores sempre incluídos: forçar ajudas máximas isentas (limite legal × todos os dias do mês)
      const mapaLiqLive = sempreIncluir
        ? Math.round(new Date(anoNum, mesNum, 0).getDate() * valorDiarioLegal('internacional', funcaoW) * 100) / 100
        : mapaLiqCalc;
      const mapaAjudasDiff = mapaLiqLive - rc.ajudaCustoNecessaria;

      const tabelaNome = (getIRSTabelasPorAno(anoNum)[w.tabela_irs || 'tabelaI'] || {}).nome || 'Tabela I';

      const empresa =[...new Set(workerLogs.map(l => l.clientId).filter(Boolean))]
        .map(id => (clients || []).find(c => c.id === id)?.name || '')
        .filter(Boolean)
        .join(' / ');

      const fmtData = d => d ? d.split('T')[0] : '';

      return {
        workerId:       w.id,
        nome:           w.name || '',
        nif:            w.nif || '',
        nis:            w.nis || '',
        profissao:      w.profissao || '',
        empresa:        empresa || '—',
        inicioVinculo:  fmtData(w.dataInicio),
        cessacaoVinculo:fmtData(w.dataFim),
        tabelaNome,
        nDep:          String(w.n_dependentes ?? 0),
        vencBase:      eur2(parseFloat(w.vencimento_base)),
        subsAlimDias:  String(subsAlimDias),
        subsAlimDia:   eur2(parseFloat(w.subsidio_alimentacao_dia) || 0),
        subsAlimTotal: eur2(rc.subsAlimTotal),
        subsFerias:    eur2(rc.subsFerias),
        subsNatal:     eur2(rc.subsNatal),
        ajudas:        eur2(mapaLiqLive),
        baseIRS:       eur2(rc.incidenciaRegular),
        taxaIRS:       pct2(rc.taxaRegular),
        irsTotal:      eur2(rc.irsTotal),
        ssTrab:        eur2(rc.ssTrabalhador),
        totalAbonos:   eur2(rc.totalAbonos + mapaAjudasDiff),
        totalDesc:     eur2(rc.totalDescontos),
        liquido:       eur2(rc.liquido + mapaAjudasDiff),
        ssPatronal:    eur2(rc.ssPatronal),
        custoEmpresa:  eur2(rc.custoEmpresa + mapaAjudasDiff),
        brutoAlvo:     eur2(brutoAlvo),
        _brutoNum:     brutoAlvo,
        _abonosNum:    rc.totalAbonos + mapaAjudasDiff,
        _descNum:      rc.totalDescontos,
        _liquidoNum:   rc.liquido + mapaAjudasDiff,
        _ssPatNum:     rc.ssPatronal,
        _custoNum:     rc.custoEmpresa + mapaAjudasDiff,
        _subsAlimNum:  rc.subsAlimTotal,
        _feriasNum:    rc.subsFerias,
        _natalNum:     rc.subsNatal,
        _ajudasNum:    mapaLiqLive,
        _irsNum:       rc.irsTotal,
        _ssTrabNum:    rc.ssTrabalhador,
        _vencNum:      parseFloat(w.vencimento_base) || 0,
      };
    }).filter(Boolean);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workers, logs, clients, workerRateHistory, feriadoMunicipal, inputs.mes, inputs.ano]);

  // Informação sobre dias de férias no ano de admissão (usada no banner do mês parcial)
  const feriasAnoAdmissao = useMemo(() => {
    if (!mesParcialDados || (mesParcialDados.tipo !== 'inicio' && mesParcialDados.tipo !== 'ambos')) return null;
    const w = workers?.find(x => x.id === selectedWorkerId);
    if (!w) return null;
    return calcDiasFeriasAnoAdmissao(w.dataInicio || null, w.dataFim || null, parseInt(inputs.ano, 10));
  }, [mesParcialDados, selectedWorkerId, workers, inputs.ano]);

  // Desconto por dias não trabalhados — TOConline: A001 fica cheio, esta é a linha de desconto separada
  const descontoDiasParcial = useMemo(() => {
    if (!mesParcialDados) return null;
    const diasNaoTrab = 30 - mesParcialDados.diasTrabalhados;
    if (diasNaoTrab <= 0) return null;
    const hs = n(inputs.horasSemana) || 40;
    const horasNaoTrab = parseFloat((diasNaoTrab * hs / 5).toFixed(2));
    const valor = parseFloat((diasNaoTrab * mesParcialDados.vencBaseOriginal / 30).toFixed(2));
    const label = mesParcialDados.tipo === 'inicio'
      ? 'Desconto dias por início de contrato'
      : mesParcialDados.tipo === 'fim'
      ? 'Desconto dias por cessação de contrato'
      : 'Desconto dias por início e cessação de contrato';
    return { diasNaoTrab, horasNaoTrab, valor, label };
  }, [mesParcialDados, inputs.horasSemana]);

  // D001 ("Desconto dias por cessação/início de contrato") — linha informativa de mês parcial.
  // Fórmula corrigida do A082: A082 = brutoAlvo − (outros abonos) + D001 = r.ajudaCustoNecessaria
  //   (o D001 já está absorvido em A082 porque vencProporcional < vencContratual)
  // Totais são somas normais sem excepções:
  //   Total Abonos    = brutoAlvo + D001   (soma de todas as linhas de abono, incluindo A082)
  //   Total Descontos = D001 + IRS + SS    (soma de todas as linhas de desconto)
  //   Líquido         = brutoAlvo − IRS − SS  (D001 cancela-se automaticamente entre as duas colunas)
  const descontoD001          = descontoDiasParcial?.valor ?? 0;
  const ajudasDisplayRecibo   = ajudasDisplay;   // sem ajuste de D001 — nova fórmula corrigida
  const totalAbonosDisplay    = r ? r.totalAbonos    + _diffAjudas + descontoD001 : 0;
  const totalDescontosDisplay = r ? r.totalDescontos + descontoD001               : 0;

  function addRow(data) {
    rowCounter++;
    setMapaRows(prev => [...prev, {
      id: Date.now() + prev.length,
      dia: '',
      servico: 'Serviços de mecânica geral',
      cliente:    inputs.clienteAbrev    || inputs.cliente,
      localidade: inputs.localidadeAbrev || inputs.localidade || inputs.pais,
      territorio: inputs.territorio === 'nacional' ? 'Nacional' : 'Internacional',
      tipo: 'Consecutivo',
      hora: '',
      pct: 100,
      ...data,
    }]);
  }

  function removeRow(id) {
    setMapaRows(prev => prev.filter(r => r.id !== id));
  }

  function updateRow(id, field, value) {
    setMapaRows(prev => prev.map(row => {
      if (row.id !== id) return row;
      const updated = { ...row, [field]: value };
      if (field === 'tipo') {
        const hora = row.hora || (value === 'Partida' ? '07:30' : '20:30');
        updated.pct = value === 'Partida'  ? pctFromHoraPartida(hora)
                    : value === 'Chegada'  ? pctFromHoraChegada(hora)
                    : 100;
      }
      if (field === 'hora' && row.tipo === 'Partida') {
        updated.pct = pctFromHoraPartida(value);
      }
      if (field === 'hora' && row.tipo === 'Chegada') {
        updated.pct = pctFromHoraChegada(value);
      }
      return updated;
    }));
  }

  function autoFill() {
    if (!r) return;

    const valorDiario = n(inputs.vdl);
    const valorAlim   = n(inputs.subsAlimValorDia);
    if (valorDiario <= 0) return;

    const mesStr_af    = `${inputs.ano}-${String(inputs.mes).padStart(2, '0')}`;
    const totalDias_af = new Date(parseInt(inputs.ano), parseInt(inputs.mes), 0).getDate();

    // Para trabalhadores com ajudas máximas: alvo = limite legal × todos os dias do mês (bruto é livre)
    // Para os restantes: alvo = ajudas necessárias para atingir o bruto
    const heComplement = n(inputs.he1) * r.valorHe1un + n(inputs.he2) * r.valorHe2un;
    const ajudaNecessaria = selectedWorkerIsMaxAjudas
      ? totalDias_af * valorDiario
      : r.ajudaCustoNecessaria + n(inputs.premios) + heComplement;
    if (ajudaNecessaria <= 0) return;

    const mesStr       = mesStr_af;
    const totalDiasMes = totalDias_af;

    // Conta dias úteis (Seg–Sex) nas primeiras nDias a partir de dataInicio
    function contarDiasUteis(di, nDias) {
      let count = 0;
      const d = new Date(di + 'T00:00:00');
      for (let i = 0; i < nDias; i++) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5) count++;
        d.setDate(d.getDate() + 1);
      }
      return count;
    }

    // Busca combinatória iterativa para uma dada data de início
    function runForStartDay(di) {
      let subsAlimMapa = valorAlim > 0 ? r.subsAlimTotal : 0;
      let bestCombo = null, diasUteisCount = 0;
      for (let iter = 0; iter < 6; iter++) {
        const valorNec = ajudaNecessaria + subsAlimMapa;
        if (valorNec <= 0) break;
        bestCombo = findBestCombo(valorNec, valorDiario, totalDiasMes);
        if (!bestCombo) break;
        diasUteisCount = valorAlim > 0 ? contarDiasUteis(di, bestCombo.N) : 0;
        const novoSubsAlim = diasUteisCount * valorAlim;
        if (Math.abs(novoSubsAlim - subsAlimMapa) < 0.005) break;
        subsAlimMapa = novoSubsAlim;
      }
      if (!bestCombo) return null;
      const totalAjudas = Math.round(bestCombo.total * 100) / 100;
      const valorNecFinal = ajudaNecessaria + subsAlimMapa;
      const residuo = Math.round((valorNecFinal - totalAjudas) * 100) / 100;
      return { bestCombo, subsAlimMapa, diasUteisCount, totalAjudas, residuo, valorNecFinal, di };
    }

    // Se o utilizador definiu uma data de início específica, usa-a; caso contrário testa dias 1–20
    let bestResult = null;
    if (mapa.dataInicio) {
      bestResult = runForStartDay(mapa.dataInicio);
    } else {
      for (let day = 1; day <= 20; day++) {
        const di = `${mesStr}-${String(day).padStart(2, '0')}`;
        const result = runForStartDay(di);
        if (!result) continue;
        if (!bestResult || Math.abs(result.residuo) < Math.abs(bestResult.residuo)) bestResult = result;
      }
    }
    if (!bestResult) return;

    const { bestCombo, subsAlimMapa, diasUteisCount, totalAjudas, residuo, valorNecFinal, di: dataInicio } = bestResult;
    const nLinhas = bestCombo.N;

    // Mapa data→cliente a partir dos logs do trabalhador no mês selecionado
    const clientePorDia = {};
    (logs || [])
      .filter(l => l.workerId === selectedWorkerId && l.date?.startsWith(mesStr))
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(l => {
        const nome = (clients || []).find(c => c.id === l.clientId)?.name || '';
        if (nome) clientePorDia[l.date] = nome;
      });
    const datasOrdenadas = Object.keys(clientePorDia).sort();
    function clienteParaDia(data) {
      let ultimo = null;
      for (const d of datasOrdenadas) { if (d <= data) ultimo = clientePorDia[d]; else break; }
      return ultimo || (datasOrdenadas.length > 0 ? clientePorDia[datasOrdenadas[0]] : null);
    }

    let cursor = new Date(dataInicio + 'T00:00:00');
    const territorioLabel = inputs.territorio === 'nacional' ? 'Nacional' : 'Internacional';
    const rows = [];
    for (let i = 0; i < nLinhas; i++) {
      const isFirst = i === 0, isLast = i === nLinhas - 1;
      const tipo = isFirst ? 'Partida' : isLast ? 'Chegada' : 'Consecutivo';
      let hora, pct;
      if (isFirst) {
        pct  = Math.round(bestCombo.fP * 100);
        hora = horaDefaultPartida(bestCombo.fP, mapa.horaPartida || null);
      } else if (isLast) {
        pct  = Math.round(bestCombo.fC * 100);
        hora = horaDefaultChegada(bestCombo.fC, mapa.horaChegada || null);
      } else { pct = 100; hora = ''; }
      const dia = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;
      rows.push({
        id: Date.now() + i, dia,
        servico: 'Serviços de mecânica geral',
        cliente:    clienteParaDia(dia)    || inputs.clienteAbrev    || inputs.cliente    || '',
        localidade: inputs.localidadeAbrev || inputs.localidade      || inputs.pais       || '',
        territorio: territorioLabel, tipo, hora, pct,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Para trabalhadores max ajudas: bruto é livre, sem complemento
    const usarComplemento = !selectedWorkerIsMaxAjudas && residuo > SYNC_TOLERANCE;
    if (usarComplemento) {
      if (complementMethod === 'he1' && r.valorHe1un > 0) {
        const h = Math.ceil((residuo / r.valorHe1un) * 100) / 100;
        setInputs(prev => ({ ...prev, he1: String(h), premios: '0' }));
      } else if (complementMethod === 'he2' && r.valorHe2un > 0) {
        const h = Math.ceil((residuo / r.valorHe2un) * 100) / 100;
        setInputs(prev => ({ ...prev, he2: String(h), premios: '0' }));
      } else {
        set('premios', residuo.toFixed(2));
      }
    } else {
      set('premios', '0');
    }

    setMapaRows(rows);
    setAutoFillInfo({
      totalAjudas, subsAlimMapa, diasUteisCount, residuo, usarComplemento,
      complementMethod: usarComplemento ? complementMethod : null,
      valorNecessario: valorNecFinal,
      dataInicio,
      combo: { N: bestCombo.N, fP: bestCombo.fP, fC: bestCombo.fC },
    });
  }

  function navMes(delta) {
    setInputs(prev => {
      let mes = parseInt(prev.mes) + delta;
      let ano = parseInt(prev.ano);
      if (mes < 1)  { mes = 12; ano -= 1; }
      if (mes > 12) { mes = 1;  ano += 1; }
      return { ...prev, mes: String(mes), ano: String(ano) };
    });
    setMapaRows([]);
    setAutoFillInfo(null);
    diasAutoFillKeyRef.current = '';
    mapaAutoFillKeyRef.current = '';
    mesParcialKeyRef.current   = '';
    setDiasCalculados({ diasMes: false, subsAlimDias: false });
    setInputs(prev => ({ ...prev, premios: '0' }));
  }

  function gerarReciboPDF() {
    if (!r) return;
    const doc = new jsPDF();
    const mesNum   = parseInt(inputs.mes, 10);
    const mesLabel = MESES_PT[mesNum] || inputs.mes;
    const a001Valor = mesParcialDados ? mesParcialDados.vencBaseOriginal : n(inputs.vencimentoBase);

    const linhas = [
      ['A001', 'Vencimento Base', '', '', eur(a001Valor), ''],
      ['A002', 'Subsídio de Alimentação', `${inputs.subsAlimDias}d`, eur(n(inputs.subsAlimValorDia)), eur(r.subsAlimTotal), ''],
    ];
    if (r.subsFerias > 0)        linhas.push(['A004', 'Subsídio de Férias (duodécimos)', '', '', eur(r.subsFerias), '']);
    if (n(inputs.premios) > 0)   linhas.push(['A008', 'Prémios / Bónus', '', '', eur(n(inputs.premios)), '']);
    if (n(inputs.he1) > 0)       linhas.push(['A052', 'Trab. Suplementar 1ª hora', `${inputs.he1}h`, eur(r.valorHe1un), eur(r.valorHe1), '']);
    if (n(inputs.he2) > 0)       linhas.push(['A053', 'Trab. Suplementar seguintes', `${inputs.he2}h`, eur(r.valorHe2un), eur(r.valorHe2), '']);
    if (r.subsNatal > 0)         linhas.push(['A021', 'Subsídio de Natal (duodécimos)', '', '', eur(r.subsNatal), '']);
    if (ajudasDisplayRecibo > 0) linhas.push(['A082', 'Ajudas de Custo Internacional (NÃO TRIBUTADO)', '', '', eur(ajudasDisplayRecibo), '']);
    if (descontoDiasParcial)     linhas.push(['D001', descontoDiasParcial.label, `${descontoDiasParcial.horasNaoTrab}h`, '', '', eur(descontoDiasParcial.valor)]);
    linhas.push(['T001', `IRS (Incidência ${eur(r.incidenciaSS)} ; Taxa IRS ${((r.irsVencResult?.taxaMarginal ?? r.taxaRegular) * 100).toFixed(1)}% ; Parcela a abater ${eur(r.irsVencResult?.parcelaAbater ?? 0)})`, '', '', '', eur(r.irsTotal)]);
    linhas.push(['T003', 'Segurança Social — Trabalhador (11%)', '', '', '', eur(r.ssTrabalhador)]);
    if (r.irsVencResult) {
      linhas.push(['', `  ↳ IRS - Taxa efetiva (Vencimento e restantes abonos): ${r.irsVencResult.taxaEfetiva.toFixed(2)}%`, '', '', '', '']);
      if (r.irsOvertimeResult?.retencao > 0)
        linhas.push(['', `  ↳ IRS - Taxa efetiva (Trabalho suplementar): ${r.irsOvertimeResult.taxaEfetiva.toFixed(2)}%`, '', '', '', '']);
      if (r.irsFeriasResult?.retencao > 0)
        linhas.push(['', `  ↳ IRS - Taxa efetiva (Subsídio de Férias): ${r.irsFeriasResult.taxaEfetiva.toFixed(2)}%`, '', '', '', '']);
      if (r.irsNatalResult?.retencao > 0)
        linhas.push(['', `  ↳ IRS - Taxa efetiva (Subsídio de Natal): ${r.irsNatalResult.taxaEfetiva.toFixed(2)}%`, '', '', '', '']);
    }

    _renderReciboPagina(doc, {
      mesLabel, ano: inputs.ano, mesNum,
      nome: inputs.nome, nif: inputs.nif, nis: inputs.nis, profissao: inputs.categoria,
      vencBase: n(inputs.vencimentoBase).toFixed(2),
      linhas,
      totalAbonos:    totalAbonosDisplay,
      totalDescontos: totalDescontosDisplay,
      liquido:        liquidoDisplay,
      logo:           logoRef.current,
    });

    const nomeFile = (inputs.nome || 'trabalhador').replace(/\s+/g, '-').toLowerCase();
    doc.save(`recibo-vencimento-${nomeFile}-${inputs.mes.padStart(2, '0')}-${inputs.ano}.pdf`);
  }

  function exportReciboXLS() {
    if (!r) return;
    const mesNum = parseInt(inputs.mes, 10);
    const mesLabel = MESES_PT[mesNum] || inputs.mes;

    const xlsA001Valor = (mesParcialDados ? mesParcialDados.vencBaseOriginal : n(inputs.vencimentoBase)).toFixed(2);
    const linhas = [
      ['Código', 'Descrição', 'Qtd', 'V.Unit. (€)', 'Abonos (€)', 'Descontos (€)'],
      ['A001', 'Vencimento Base', '', '', xlsA001Valor, ''],
      ['A002', 'Subsídio de Alimentação', `${inputs.subsAlimDias}d`, n(inputs.subsAlimValorDia).toFixed(2), r.subsAlimTotal.toFixed(2), ''],
    ];
    if (r.subsFerias > 0)       linhas.push(['A004', 'Subsídio de Férias (duodécimos)', '', '', r.subsFerias.toFixed(2), '']);
    if (n(inputs.premios) > 0)  linhas.push(['A008', 'Prémios / Bónus', '', '', n(inputs.premios).toFixed(2), '']);
    if (n(inputs.he1) > 0)      linhas.push(['A052', 'Trabalho Suplementar 1ª hora', `${inputs.he1}h`, r.valorHe1un.toFixed(4), r.valorHe1.toFixed(2), '']);
    if (n(inputs.he2) > 0)      linhas.push(['A053', 'Trabalho Suplementar seguintes', `${inputs.he2}h`, r.valorHe2un.toFixed(4), r.valorHe2.toFixed(2), '']);
    if (r.subsNatal > 0)        linhas.push(['A021', 'Subsídio de Natal (duodécimos)', '', '', r.subsNatal.toFixed(2), '']);
    // A082: ajustado pelo D001 para que Total Abonos = BrutoAlvo
    if (ajudasDisplayRecibo > 0) linhas.push(['A082', 'Ajudas de Custo Internacional (NÃO TRIBUTADO)', '', '', ajudasDisplayRecibo.toFixed(2), '']);
    // D001 — linha informativa; não entra em Total Descontos do rodapé
    if (descontoDiasParcial) linhas.push(['D001', descontoDiasParcial.label, `${descontoDiasParcial.horasNaoTrab}h`, '', '', descontoDiasParcial.valor.toFixed(2)]);
    linhas.push(['T001', `IRS (Incidência ${r.incidenciaSS.toFixed(2)} ; Taxa IRS ${((r.irsVencResult?.taxaMarginal ?? r.taxaRegular) * 100).toFixed(1)}% ; Parcela a abater ${(r.irsVencResult?.parcelaAbater ?? 0).toFixed(2)})`, '', '', '', r.irsTotal.toFixed(2)]);
    linhas.push(['T003', 'Segurança Social — Trabalhador (11%)', '', '', '', r.ssTrabalhador.toFixed(2)]);
    linhas.push(['', 'TOTAL', '', '', totalAbonosDisplay.toFixed(2), totalDescontosDisplay.toFixed(2)]);
    linhas.push(['', 'Líquido a Receber', '', '', liquidoDisplay.toFixed(2), '']);
    linhas.push(['', 'Custo Empresa (c/ TSU 23,75%)', '', '', custoEmpDisplay.toFixed(2), '']);

    const rows = linhas.map((row, i) => {
      const isHdr = i === 0;
      const isTot = row[1] === 'TOTAL';
      const isLiq = row[1] === 'Líquido a Receber';
      const bg  = isHdr ? '#0F1F3D' : isTot ? '#EEF2FF' : isLiq ? '#ECFDF5' : i % 2 === 0 ? '#ffffff' : '#F8FAFC';
      const col = isHdr ? 'white' : isTot ? '#4F46E5' : isLiq ? '#059669' : '#1E293B';
      const fw  = isHdr || isTot || isLiq ? 'bold' : 'normal';
      return `<tr>${row.map(c => `<td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;background:${bg};color:${col};font-weight:${fw}">${c}</td>`).join('')}</tr>`;
    }).join('');

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/></head><body>
<h2 style="font-family:Arial;color:#0F1F3D">RECIBO DE VENCIMENTO — ${mesLabel} ${inputs.ano}</h2>
<p style="font-family:Arial;font-size:12px"><b>${inputs.nome || '—'}</b> &nbsp;·&nbsp; NIF: ${inputs.nif || '—'} &nbsp;·&nbsp; Profissão: ${inputs.categoria || '—'}</p>
<table border="1" style="border-collapse:collapse;font-family:Arial;font-size:11px;min-width:600px">${rows}</table>
<p style="font-family:Arial;font-size:10px;color:#64748B;margin-top:16px">Estimativa — confirmar sempre no TOConline antes de processar.</p>
</body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const nomeFile = (inputs.nome || 'trabalhador').replace(/\s+/g, '-').toLowerCase();
    a.download = `recibo-vencimento-${nomeFile}-${inputs.mes.padStart(2, '0')}-${inputs.ano}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function _calcReciboComMapa(w, subsAlimDias, brutoAlvo, anoNum, mesStr, vencBaseOverride, funcao = 'geral') {
    const vencBase         = vencBaseOverride ?? (parseFloat(w.vencimento_base) || 0);
    const subsAlimValorDia = parseFloat(w.subsidio_alimentacao_dia) || 0;
    const baseParams = {
      vencimentoBase: vencBase, horasSemana: 40, premios: 0,
      he1: 0, he2: 0, incluirFerias: true, incluirNatal: true,
      subsAlimValorDia, subsAlimDias, subsAlimTipo: w.subsidio_alimentacao_tipo || 'dinheiro',
      tabelaKey: w.tabela_irs || 'tabelaI',
      nDependentes: w.n_dependentes ?? 0,
      brutoAlvo: brutoAlvo || vencBase,
      territorio: 'internacional', funcao, ano: anoNum,
    };
    const rc0             = calcularRecibo(baseParams);
    const valorDiario     = valorDiarioLegal('internacional', funcao);
    const ajudaNecessaria = rc0.ajudaCustoNecessaria;
    if (ajudaNecessaria <= 0 || valorDiario <= 0) return { rc: rc0, premios: 0, mapaLiqLive: 0 };

    const totalDiasMes = new Date(anoNum, parseInt(mesStr.split('-')[1], 10), 0).getDate();

    function contarDiasUteis(di, nDias) {
      let count = 0;
      const d = new Date(di + 'T00:00:00');
      for (let i = 0; i < nDias; i++) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5) count++;
        d.setDate(d.getDate() + 1);
      }
      return count;
    }

    function runForStartDay(di) {
      let subsAlimMapa = subsAlimValorDia > 0 ? rc0.subsAlimTotal : 0;
      let bestCombo = null;
      for (let iter = 0; iter < 6; iter++) {
        const valorNec = ajudaNecessaria + subsAlimMapa;
        if (valorNec <= 0) break;
        bestCombo = findBestCombo(valorNec, valorDiario, totalDiasMes);
        if (!bestCombo) break;
        const novoSubsAlim = subsAlimValorDia > 0 ? contarDiasUteis(di, bestCombo.N) * subsAlimValorDia : 0;
        if (Math.abs(novoSubsAlim - subsAlimMapa) < 0.005) break;
        subsAlimMapa = novoSubsAlim;
      }
      if (!bestCombo) return null;
      const totalAjudas = Math.round(bestCombo.total * 100) / 100;
      const valorNecFinal = ajudaNecessaria + subsAlimMapa;
      const residuo = Math.round((valorNecFinal - totalAjudas) * 100) / 100;
      return { bestCombo, subsAlimMapa, totalAjudas, residuo };
    }

    let bestResult = null;
    for (let day = 1; day <= 20; day++) {
      const di = `${mesStr}-${String(day).padStart(2, '0')}`;
      const result = runForStartDay(di);
      if (!result) continue;
      if (!bestResult || Math.abs(result.residuo) < Math.abs(bestResult.residuo)) bestResult = result;
    }

    if (!bestResult) {
      // Gap demasiado pequeno para uma taxa diária completa → tratar como prémios
      const premios = ajudaNecessaria > SYNC_TOLERANCE ? Math.round(ajudaNecessaria * 100) / 100 : 0;
      if (premios > 0) return { rc: calcularRecibo({ ...baseParams, premios }), premios, mapaLiqLive: 0 };
      return { rc: rc0, premios: 0, mapaLiqLive: 0 };
    }
    const { bestCombo, subsAlimMapa } = bestResult;

    const totalAjudas   = Math.round(bestCombo.total * 100) / 100;
    const valorNecFinal = ajudaNecessaria + subsAlimMapa;
    const residuo       = Math.round((valorNecFinal - totalAjudas) * 100) / 100;
    const premios       = residuo > SYNC_TOLERANCE ? Math.round(residuo * 100) / 100 : 0;
    const mapaLiqLive   = Math.round((totalAjudas - subsAlimMapa) * 100) / 100;
    const rc = premios > 0 ? calcularRecibo({ ...baseParams, premios }) : rc0;
    return { rc, premios, mapaLiqLive };
  }

  async function gerarRecibosBatchPDF() {
    const mesNum    = parseInt(inputs.mes, 10);
    const mesStr    = `${inputs.ano}-${String(mesNum).padStart(2, '0')}`;
    const mesLabel  = MESES_PT[mesNum] || inputs.mes;
    const anoNum    = n(inputs.ano);

    const logsDoMes = (logs || []).filter(l => l.date?.startsWith(mesStr));
    const trabalhadores = (workers || [])
      .filter(w => (w.is_active !== false && w.status !== 'inativo' || w.dataFim?.startsWith(mesStr) || w.dataInicio?.startsWith(mesStr)) && w.vencimento_base != null && logsDoMes.some(l => l.workerId === w.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (trabalhadores.length === 0) {
      alert('Nenhum trabalhador com registos neste mês.');
      return;
    }

    const { rateHistory, absenceData } = await _fetchBatchData(mesStr);
    const doc = new jsPDF();
    let isFirstPage = true;

    trabalhadores.forEach(w => {
      const workerHistory   = rateHistory.filter(h => h.worker_id === w.id);
      const workerLogs      = logsDoMes.filter(l => l.workerId === w.id);
      const brutoAlvo       = workerLogs.reduce((s, l) => {
        const rate = getRateAtDate(l.date, workerHistory, parseFloat(w.valorHora) || 0);
        return s + (parseFloat(l.hours) || 0) * rate;
      }, 0);
      const workerAusencias = absenceData
        .filter(a => a.worker_id === w.id)
        .flatMap(a => a.dates || [])
        .filter(d => d.startsWith(mesStr));
      const subsAlimDias    = calcularDiasUteisNoMes(anoNum, mesNum, {
        feriadoMunicipal,
        dataAdmissao: w.dataInicio || null,
        dataCessacao: w.dataFim    || null,
        ausencias:    workerAusencias,
      });
      // Proporcionalidade para este trabalhador
      const wMesParcial    = calcMesParcial(w.dataInicio || null, w.dataFim || null, anoNum, mesNum);
      const wVencOrig      = parseFloat(w.vencimento_base) || 0;
      const wVencCalculo   = wMesParcial.tipo !== 'completo' ? parseFloat((wVencOrig * wMesParcial.fator).toFixed(2)) : wVencOrig;
      const funcaoW = w.profissao_cnp ? funcaoDeCPP(w.profissao_cnp) : funcaoMaxAjudasWorker(w.name);
      const { rc, premios: premiosBatch, mapaLiqLive } = _calcReciboComMapa(w, subsAlimDias, brutoAlvo, anoNum, mesStr,
        wMesParcial.tipo !== 'completo' ? wVencCalculo : undefined, funcaoW);
      const mapaAjudasDiff = mapaLiqLive - rc.ajudaCustoNecessaria;

      if (!isFirstPage) doc.addPage();
      isFirstPage = false;

      const linhas = [
        ['A001', 'Vencimento Base', '', '', eur(wVencOrig), ''],
        ['A002', 'Subsídio de Alimentação', `${subsAlimDias}d`, eur(parseFloat(w.subsidio_alimentacao_dia) || 0), eur(rc.subsAlimTotal), ''],
      ];
      if (rc.subsFerias > 0) linhas.push(['A004', 'Subsídio de Férias (duodécimos)', '', '', eur(rc.subsFerias), '']);
      if (premiosBatch > 0)  linhas.push(['A008', 'Prémios / Bónus', '', '', eur(premiosBatch), '']);
      if (rc.subsNatal > 0)  linhas.push(['A021', 'Subsídio de Natal (duodécimos)', '', '', eur(rc.subsNatal), '']);
      if (mapaLiqLive > 0)   linhas.push(['A082', 'Ajudas de Custo Internacional (NÃO TRIBUTADO)', '', '', eur(mapaLiqLive), '']);
      const bDiasNaoTrab   = wMesParcial.tipo !== 'completo' ? 30 - wMesParcial.diasTrabalhados : 0;
      const bDescontoExtra = bDiasNaoTrab > 0 ? parseFloat((bDiasNaoTrab * wVencOrig / 30).toFixed(2)) : 0;
      if (bDiasNaoTrab > 0) {
        const bHorasNaoTrab = parseFloat((bDiasNaoTrab * (Number(w.horas_semana) || 40) / 5).toFixed(2));
        const bLabel = wMesParcial.tipo === 'inicio' ? 'Desconto dias por início de contrato'
          : wMesParcial.tipo === 'fim' ? 'Desconto dias por cessação de contrato'
          : 'Desconto dias por início e cessação de contrato';
        linhas.push(['D001', bLabel, `${bHorasNaoTrab}h`, '', '', eur(bDescontoExtra)]);
      }
      linhas.push(['T001', `IRS (Incidência ${eur(rc.incidenciaSS)} ; Taxa IRS ${((rc.irsVencResult?.taxaMarginal ?? rc.taxaRegular) * 100).toFixed(1)}% ; Parcela a abater ${eur(rc.irsVencResult?.parcelaAbater ?? 0)})`, '', '', '', eur(rc.irsTotal)]);
      linhas.push(['T003', 'Segurança Social — Trabalhador (11%)', '', '', '', eur(rc.ssTrabalhador)]);
      // Linhas informativas de taxa efectiva por componente IRS
      if (rc.irsVencResult) {
        linhas.push(['', `  ↳ IRS - Taxa efetiva (Vencimento e restantes abonos): ${rc.irsVencResult.taxaEfetiva.toFixed(2)}%`, '', '', '', '']);
        if (rc.irsOvertimeResult?.retencao > 0)
          linhas.push(['', `  ↳ IRS - Taxa efetiva (Trabalho suplementar): ${rc.irsOvertimeResult.taxaEfetiva.toFixed(2)}%`, '', '', '', '']);
        if (rc.irsFeriasResult?.retencao > 0)
          linhas.push(['', `  ↳ IRS - Taxa efetiva (Subsídio de Férias): ${rc.irsFeriasResult.taxaEfetiva.toFixed(2)}%`, '', '', '', '']);
        if (rc.irsNatalResult?.retencao > 0)
          linhas.push(['', `  ↳ IRS - Taxa efetiva (Subsídio de Natal): ${rc.irsNatalResult.taxaEfetiva.toFixed(2)}%`, '', '', '', '']);
      }

      _renderReciboPagina(doc, {
        mesLabel, ano: inputs.ano, mesNum,
        nome: w.name, nif: w.nif, nis: w.nis, profissao: w.profissao,
        vencBase: wVencOrig.toFixed(2),
        linhas,
        totalAbonos:    rc.totalAbonos + mapaAjudasDiff + bDescontoExtra,
        totalDescontos: rc.totalDescontos + bDescontoExtra,
        liquido:        rc.liquido + mapaAjudasDiff,
        logo:           logoRef.current,
      });
    });

    doc.save(`recibos-vencimento-${mesStr}.pdf`);
  }

  async function exportRecibosBatchXLS() {
    const mesNum    = parseInt(inputs.mes, 10);
    const mesStr    = `${inputs.ano}-${String(mesNum).padStart(2, '0')}`;
    const mesLabel  = MESES_PT[mesNum] || inputs.mes;
    const anoNum    = n(inputs.ano);

    const logsDoMes = (logs || []).filter(l => l.date?.startsWith(mesStr));
    const trabalhadores = (workers || [])
      .filter(w => (w.is_active !== false && w.status !== 'inativo' || w.dataFim?.startsWith(mesStr) || w.dataInicio?.startsWith(mesStr)) && w.vencimento_base != null && logsDoMes.some(l => l.workerId === w.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (trabalhadores.length === 0) {
      alert('Nenhum trabalhador com registos neste mês.');
      return;
    }

    const { rateHistory, absenceData } = await _fetchBatchData(mesStr);

    const blocos = trabalhadores.map(w => {
      const workerHistory   = rateHistory.filter(h => h.worker_id === w.id);
      const workerLogs      = logsDoMes.filter(l => l.workerId === w.id);
      const brutoAlvo       = workerLogs.reduce((s, l) => {
        const rate = getRateAtDate(l.date, workerHistory, parseFloat(w.valorHora) || 0);
        return s + (parseFloat(l.hours) || 0) * rate;
      }, 0);
      const workerAusencias = absenceData
        .filter(a => a.worker_id === w.id)
        .flatMap(a => a.dates || [])
        .filter(d => d.startsWith(mesStr));
      const subsAlimDias    = calcularDiasUteisNoMes(anoNum, mesNum, {
        feriadoMunicipal,
        dataAdmissao: w.dataInicio || null,
        dataCessacao: w.dataFim    || null,
        ausencias:    workerAusencias,
      });
      const xlsWMesParcial  = calcMesParcial(w.dataInicio || null, w.dataFim || null, anoNum, mesNum);
      const xlsWVencOrig    = parseFloat(w.vencimento_base) || 0;
      const xlsWVencCalculo = xlsWMesParcial.tipo !== 'completo' ? parseFloat((xlsWVencOrig * xlsWMesParcial.fator).toFixed(2)) : xlsWVencOrig;
      const { rc, premios: premiosBatch, mapaLiqLive } = _calcReciboComMapa(w, subsAlimDias, brutoAlvo, anoNum, mesStr,
        xlsWMesParcial.tipo !== 'completo' ? xlsWVencCalculo : undefined);
      const mapaAjudasDiff = mapaLiqLive - rc.ajudaCustoNecessaria;

      const linhas = [
        ['Código', 'Descrição', 'Qtd', 'V.Unit. (€)', 'Abonos (€)', 'Descontos (€)'],
        ['A001', 'Vencimento Base', '', '', xlsWVencOrig.toFixed(2), ''],
        ['A002', 'Subsídio de Alimentação', `${subsAlimDias}d`, (parseFloat(w.subsidio_alimentacao_dia) || 0).toFixed(2), rc.subsAlimTotal.toFixed(2), ''],
      ];
      if (rc.subsFerias > 0) linhas.push(['A004', 'Subsídio de Férias (duodécimos)', '', '', rc.subsFerias.toFixed(2), '']);
      if (premiosBatch > 0)  linhas.push(['A008', 'Prémios / Bónus', '', '', premiosBatch.toFixed(2), '']);
      if (rc.subsNatal > 0)  linhas.push(['A021', 'Subsídio de Natal (duodécimos)', '', '', rc.subsNatal.toFixed(2), '']);
      if (mapaLiqLive > 0)   linhas.push(['A082', 'Ajudas de Custo Internacional (NÃO TRIBUTADO)', '', '', mapaLiqLive.toFixed(2), '']);
      const xlsBDiasNaoTrab = xlsWMesParcial.tipo !== 'completo' ? 30 - xlsWMesParcial.diasTrabalhados : 0;
      const xlsBDescontoExtra = xlsBDiasNaoTrab > 0 ? parseFloat((xlsBDiasNaoTrab * xlsWVencOrig / 30).toFixed(2)) : 0;
      if (xlsBDiasNaoTrab > 0) {
        const xlsBHorasNaoTrab = parseFloat((xlsBDiasNaoTrab * 40 / 5).toFixed(2));
        const xlsBLabel = xlsWMesParcial.tipo === 'inicio' ? 'Desconto dias por início de contrato'
          : xlsWMesParcial.tipo === 'fim' ? 'Desconto dias por cessação de contrato'
          : 'Desconto dias por início e cessação de contrato';
        linhas.push(['D001', xlsBLabel, `${xlsBHorasNaoTrab}h`, '', '', xlsBDescontoExtra.toFixed(2)]);
      }
      linhas.push(['T001', `IRS (Incidência ${rc.incidenciaSS.toFixed(2)} ; Taxa IRS ${((rc.irsVencResult?.taxaMarginal ?? rc.taxaRegular) * 100).toFixed(1)}% ; Parcela a abater ${(rc.irsVencResult?.parcelaAbater ?? 0).toFixed(2)})`, '', '', '', rc.irsTotal.toFixed(2)]);
      linhas.push(['T003', 'Segurança Social — Trabalhador (11%)', '', '', '', rc.ssTrabalhador.toFixed(2)]);
      linhas.push(['', 'TOTAL', '', '', (rc.totalAbonos + mapaAjudasDiff + xlsBDescontoExtra).toFixed(2), (rc.totalDescontos + xlsBDescontoExtra).toFixed(2)]);
      linhas.push(['', 'Líquido a Receber', '', '', (rc.liquido + mapaAjudasDiff).toFixed(2), '']);
      linhas.push(['', 'Custo Empresa (c/ TSU 23,75%)', '', '', (rc.custoEmpresa + mapaAjudasDiff).toFixed(2), '']);

      const rows = linhas.map((row, i) => {
        const isHdr = i === 0;
        const isTot = row[1] === 'TOTAL';
        const isLiq = row[1] === 'Líquido a Receber';
        const bg  = isHdr ? '#0F1F3D' : isTot ? '#EEF2FF' : isLiq ? '#ECFDF5' : i % 2 === 0 ? '#ffffff' : '#F8FAFC';
        const col = isHdr ? 'white' : isTot ? '#4F46E5' : isLiq ? '#059669' : '#1E293B';
        const fw  = isHdr || isTot || isLiq ? 'bold' : 'normal';
        return `<tr>${row.map(c => `<td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;background:${bg};color:${col};font-weight:${fw}">${c}</td>`).join('')}</tr>`;
      }).join('');

      return `<div style="page-break-after:always;margin-bottom:40px">
<h2 style="font-family:Arial;color:#0F1F3D">RECIBO DE VENCIMENTO — ${mesLabel} ${inputs.ano}</h2>
<p style="font-family:Arial;font-size:12px"><b>${(w.name || '—').toUpperCase()}</b> &nbsp;·&nbsp; NIF: ${w.nif || '—'} &nbsp;·&nbsp; Profissão: ${w.profissao || '—'} &nbsp;·&nbsp; NIS: ${w.nis || '—'}</p>
<table border="1" style="border-collapse:collapse;font-family:Arial;font-size:11px;min-width:600px">${rows}</table>
<p style="font-family:Arial;font-size:10px;color:#64748B;margin-top:16px">Estimativa — confirmar sempre no TOConline antes de processar.</p>
</div>`;
    });

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/></head><body>${blocos.join('')}</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `recibos-vencimento-${mesStr}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function gerarMapaSalarialPDF() {
    const mesNum   = parseInt(inputs.mes, 10);
    const mesStr   = `${inputs.ano}-${String(mesNum).padStart(2, '0')}`;
    const mesLabel = MESES_PT[mesNum] || inputs.mes;
    const anoNum   = n(inputs.ano);

    const trabalhadores = (workers || [])
      .filter(w => (w.is_active !== false && w.status !== 'inativo' || w.dataFim?.startsWith(mesStr) || w.dataInicio?.startsWith(mesStr)) && w.vencimento_base != null)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (trabalhadores.length === 0) {
      alert('Nenhum trabalhador activo com vencimento base configurado.');
      return;
    }

    // Buscar histórico de taxas + ausências — mesma lógica dos exports batch
    const { rateHistory, absenceData } = await _fetchBatchData(mesStr);

    // Logs do mês (todos os trabalhadores)
    const logsDoMes = (logs || []).filter(l => l.date?.startsWith(mesStr));

    const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const eur2 = v => (isNaN(v) ? 0 : v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';
    const pct  = v => (v * 100).toFixed(1) + '%';

    let isFirstPage = true;

    trabalhadores.forEach(w => {
      // Bruto = mesmo cálculo da coluna "Ordenado Bruto" na aba Contabilidade:
      // horas × taxa-correta-na-data (usando worker_valorhora_history)
      const workerHistory = rateHistory.filter(h => h.worker_id === w.id);
      const workerLogs    = logsDoMes.filter(l => l.workerId === w.id);
      const totalHoras    = workerLogs.reduce((s, l) => s + (parseFloat(l.hours) || 0), 0);
      const brutoAlvo     = workerLogs.reduce((s, l) => {
        const rate = getRateAtDate(l.date, workerHistory, parseFloat(w.valorHora) || 0);
        return s + (parseFloat(l.hours) || 0) * rate;
      }, 0);

      const workerAusencias = absenceData
        .filter(a => a.worker_id === w.id)
        .flatMap(a => a.dates || [])
        .filter(d => d.startsWith(mesStr));
      const subsAlimDias = calcularDiasUteisNoMes(anoNum, mesNum, {
        feriadoMunicipal,
        dataAdmissao: w.dataInicio || null,
        dataCessacao: w.dataFim    || null,
        ausencias:    workerAusencias,
      });
      const funcaoW = w.profissao_cnp ? funcaoDeCPP(w.profissao_cnp) : funcaoMaxAjudasWorker(w.name);
      const { rc, premios: premiosMapa, mapaLiqLive } = _calcReciboComMapa(
        w, subsAlimDias, brutoAlvo || (parseFloat(w.vencimento_base) || 0), anoNum, mesStr,
        undefined, funcaoW,
      );
      const mapaAjudasDiff = mapaLiqLive - rc.ajudaCustoNecessaria;

      const tabelaNome = (getIRSTabelasPorAno(anoNum)[w.tabela_irs || 'tabelaI'] || {}).nome || 'Tabela I';

      if (!isFirstPage) doc.addPage();
      isFirstPage = false;

      // Cabeçalho empresa
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('FICHA DE PROCESSAMENTO SALARIAL', 105, 14, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`${EMPRESA.nome}  ·  NIF ${EMPRESA.nif}  ·  ${mesLabel} ${inputs.ano}`, 105, 20, { align: 'center' });

      // Identificação do trabalhador
      autoTable(doc, {
        startY: 25,
        body: [
          ['Trabalhador:', (w.name || '—').toUpperCase(), 'NIF:', w.nif || '—'],
          ['Profissão:', w.profissao || '—', 'NIS:', w.nis || '—'],
          ['Tabela IRS:', tabelaNome, 'Nº Dependentes:', String(w.n_dependentes ?? 0)],
          ['Vencimento Base:', eur2(parseFloat(w.vencimento_base)), 'Salário/hora:', eur2(rc.salarioHora)],
        ],
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 }, 2: { fontStyle: 'bold', cellWidth: 30 } },
      });

      // Separador — mês
      const yMes = doc.lastAutoTable.finalY + 2;
      doc.setFillColor(15, 31, 61);
      doc.rect(14, yMes, 182, 6, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`MÊS: ${mesLabel.toUpperCase()} ${inputs.ano}  ·  Sub. Alim.: ${subsAlimDias} dias  ·  Horas totais: ${totalHoras.toFixed(1)}h`, 17, yMes + 4);
      doc.setTextColor(0, 0, 0);

      // Linhas de abonos/descontos
      const linhas = [
        ['A001', 'Vencimento Base', '', '', eur2(parseFloat(w.vencimento_base)), ''],
      ];
      if (subsAlimDias > 0) {
        const tipoAlim = w.subsidio_alimentacao_tipo || 'cartao';
        const descAlim = tipoAlim === 'dinheiro'
          ? 'Sub. Alimentação — Dinheiro (isento ≤ €6,15)'
          : 'Sub. Alimentação — Cartão / vale (isento ≤ €10,46)';
        linhas.push(['A002', descAlim, `${subsAlimDias}d`, eur2(parseFloat(w.subsidio_alimentacao_dia) || 0), eur2(rc.subsAlimTotal), '']);
      }
      if (rc.subsAlimExcedente > 0) linhas.push(['', '  → Excedente sujeito a IRS/SS', '', '', eur2(rc.subsAlimExcedente), '']);
      if (rc.subsFerias > 0) linhas.push(['A004', 'Sub. Férias (duodécimo 1/12)', '', '', eur2(rc.subsFerias), '']);
      if (premiosMapa > 0)   linhas.push(['A008', 'Prémios / Bónus', '', '', eur2(premiosMapa), '']);
      if (rc.subsNatal > 0)  linhas.push(['A021', 'Sub. Natal (duodécimo 1/12)', '', '', eur2(rc.subsNatal), '']);
      if (mapaLiqLive > 0)   linhas.push(['A082', 'Ajudas de Custo Internacional (isento)', '', '', eur2(mapaLiqLive), '']);
      linhas.push(['T001', `IRS (Incidência ${eur2(rc.incidenciaSS)} ; Taxa IRS ${((rc.irsVencResult?.taxaMarginal ?? rc.taxaRegular) * 100).toFixed(1)}% ; Parcela a abater ${(rc.irsVencResult?.parcelaAbater ?? 0).toFixed(2)})`, '', '', '', eur2(rc.irsTotal)]);
      linhas.push(['T003', 'Seg. Social — Trabalhador (11%)', '', '', '', eur2(rc.ssTrabalhador)]);

      autoTable(doc, {
        startY: yMes + 8,
        head: [['Cód.', 'Descrição', 'Qtd', 'V.Unit.', 'Abonos', 'Descontos']],
        body: linhas,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], fontSize: 7, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2.2 },
        columnStyles: {
          0: { cellWidth: 13 },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 20, halign: 'right' },
          4: { cellWidth: 28, halign: 'right' },
          5: { cellWidth: 28, halign: 'right' },
        },
      });

      // Totais
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 2,
        body: [
          [
            { content: 'TOTAL ABONOS', styles: { fontStyle: 'bold' } },
            { content: eur2(rc.totalAbonos + mapaAjudasDiff), styles: { fontStyle: 'bold', halign: 'right' } },
            { content: 'TOTAL DESCONTOS', styles: { fontStyle: 'bold' } },
            { content: eur2(rc.totalDescontos), styles: { fontStyle: 'bold', halign: 'right' } },
          ],
          [
            { content: 'LÍQUIDO A RECEBER', styles: { fontStyle: 'bold', fontSize: 9, fillColor: [236, 253, 245], textColor: [5, 150, 105] } },
            { content: eur2(rc.liquido + mapaAjudasDiff), styles: { fontStyle: 'bold', fontSize: 9, halign: 'right', fillColor: [236, 253, 245], textColor: [5, 150, 105] } },
            { content: 'Custo empresa (+ TSU 23,75%)' },
            { content: eur2(rc.custoEmpresa), styles: { halign: 'right' } },
          ],
          [
            { content: 'TSU Patronal (23,75%)', styles: { textColor: [100, 116, 139] } },
            { content: eur2(rc.ssPatronal), styles: { halign: 'right', textColor: [100, 116, 139] } },
            { content: brutoAlvo > 0 ? `Ordenado bruto (${totalHoras.toFixed(1)}h × taxa hist.)` : 'Sem registos no mês', styles: { textColor: [100, 116, 139], fontSize: 6.5 } },
            { content: brutoAlvo > 0 ? eur2(brutoAlvo) : '—', styles: { halign: 'right', textColor: [100, 116, 139] } },
          ],
        ],
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: { 0: { cellWidth: 58 }, 1: { cellWidth: 30 }, 2: { cellWidth: 62 } },
      });

      // Nota de rodapé
      const yAviso = doc.lastAutoTable.finalY + 3;
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      doc.text('Horas suplementares e ajustamentos manuais não incluídos — confirmar sempre no TOConline antes de processar.', 14, yAviso);
      doc.setTextColor(0, 0, 0);
    });

    doc.save(`processamento-salarial-${String(mesNum).padStart(2, '0')}-${inputs.ano}.pdf`);
  }

  // Helpers partilhados pelas duas funções batch abaixo
  async function _fetchBatchData(mesStr) {
    const [rateRes, contabRes, absenceRes] = await Promise.all([
      supabase.from('worker_valorhora_history').select('*'),
      supabase.from('contabilidade_mensal').select('*').eq('mes', mesStr),
      supabase.from('absence_requests').select('worker_id, dates').eq('status', 'approved'),
    ]);
    return {
      rateHistory:  rateRes.data    || [],
      contabRows:   contabRes.data  || [],
      absenceData:  absenceRes.data || [],
    };
  }

  function _calcBruto(workerId, workerLogs, rateHistory, valorHoraDefault) {
    const hist = rateHistory.filter(h => h.worker_id === workerId);
    return workerLogs.reduce((s, l) => {
      const rate = getRateAtDate(l.date, hist, parseFloat(valorHoraDefault) || 0);
      return s + (parseFloat(l.hours) || 0) * rate;
    }, 0);
  }

  function _clientePorDiaFn(workerId, mesStr) {
    const mapa = {};
    (logs || [])
      .filter(l => l.workerId === workerId && l.date?.startsWith(mesStr))
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(l => {
        const nome = (clients || []).find(c => c.id === l.clientId)?.name || '';
        if (nome) mapa[l.date] = nome;
      });
    const datas = Object.keys(mapa).sort();
    return (data) => {
      let ultimo = null;
      for (const d of datas) {
        if (d <= data) ultimo = mapa[d];
        else break;
      }
      return ultimo || (datas.length > 0 ? mapa[datas[0]] : '');
    };
  }

  async function exportMapaSalarialXLS() {
    const mesNum   = parseInt(inputs.mes, 10);
    const mesStr   = `${inputs.ano}-${String(mesNum).padStart(2, '0')}`;
    const mesLabel = MESES_PT[mesNum] || inputs.mes;
    const anoNum   = n(inputs.ano);

    const trabalhadores = (workers || [])
      .filter(w => (w.is_active !== false && w.status !== 'inativo' || w.dataFim?.startsWith(mesStr) || w.dataInicio?.startsWith(mesStr)) && w.vencimento_base != null)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (trabalhadores.length === 0) { alert('Nenhum trabalhador activo com vencimento base configurado.'); return; }

    const { rateHistory, absenceData } = await _fetchBatchData(mesStr);
    const logsDoMes = (logs || []).filter(l => l.date?.startsWith(mesStr));

    const eur2 = v => (isNaN(v) ? 0 : v).toFixed(2);
    const pct2 = v => (v * 100).toFixed(2) + '%';

    // Cabeçalho
    const cols = [
      'Trabalhador', 'NIF', 'NIS', 'Profissão',
      'Tabela IRS', 'Nº Dep.',
      'Venc. Base (€)', 'Sub. Alim. Dias', 'Sub. Alim. €/dia', 'Sub. Alim. Total (€)',
      'Sub. Férias / Duod. (€)', 'Sub. Natal / Duod. (€)',
      'Prémios / Bónus (€)',
      'Ajudas Custo Inter. (€)',
      'Base IRS (€)', 'Taxa IRS', 'IRS (€)',
      'SS Trab. 11% (€)', 'Total Abonos (€)', 'Total Descontos (€)',
      'Líquido (€)', 'TSU Patronal 23,75% (€)', 'Custo Empresa (€)',
      'Ordenado Bruto (€)',
    ];

    const dataRows = trabalhadores.map(w => {
      const workerLogs      = logsDoMes.filter(l => l.workerId === w.id);
      const brutoAlvo       = _calcBruto(w.id, workerLogs, rateHistory, w.valorHora);
      const workerAusencias = absenceData
        .filter(a => a.worker_id === w.id)
        .flatMap(a => a.dates || [])
        .filter(d => d.startsWith(mesStr));
      const subsAlimDias = calcularDiasUteisNoMes(anoNum, mesNum, {
        feriadoMunicipal,
        dataAdmissao: w.dataInicio || null,
        dataCessacao: w.dataFim    || null,
        ausencias:    workerAusencias,
      });
      const funcaoW = w.profissao_cnp ? funcaoDeCPP(w.profissao_cnp) : funcaoMaxAjudasWorker(w.name);
      const { rc, premios: premiosMapa, mapaLiqLive } = _calcReciboComMapa(
        w, subsAlimDias, brutoAlvo || parseFloat(w.vencimento_base) || 0, anoNum, mesStr,
        undefined, funcaoW,
      );
      const mapaAjudasDiff = mapaLiqLive - rc.ajudaCustoNecessaria;

      const tabelaNome = (getIRSTabelasPorAno(anoNum)[w.tabela_irs || 'tabelaI'] || {}).nome || 'Tabela I';

      return [
        w.name || '', w.nif || '', w.nis || '', w.profissao || '',
        tabelaNome, String(w.n_dependentes ?? 0),
        eur2(parseFloat(w.vencimento_base)), String(subsAlimDias),
        eur2(parseFloat(w.subsidio_alimentacao_dia) || 0), eur2(rc.subsAlimTotal),
        eur2(rc.subsFerias), eur2(rc.subsNatal),
        eur2(premiosMapa),
        eur2(mapaLiqLive),
        eur2(rc.incidenciaRegular), pct2(rc.taxaRegular), eur2(rc.irsTotal),
        eur2(rc.ssTrabalhador), eur2(rc.totalAbonos + mapaAjudasDiff), eur2(rc.totalDescontos),
        eur2(rc.liquido + mapaAjudasDiff), eur2(rc.ssPatronal), eur2(rc.custoEmpresa),
        eur2(brutoAlvo),
      ];
    });

    // Totais
    // índices das colunas numéricas para totalizar (0-based): acrescentada col 12 (Prémios)
    const sumIdx = [6, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 21, 22, 23];
    const totais = cols.map((_, ci) => {
      if (ci === 0) return 'TOTAIS';
      if (!sumIdx.includes(ci)) return '';
      return eur2(dataRows.reduce((s, r) => s + (parseFloat(r[ci]) || 0), 0));
    });

    const lastCol = cols.length - 1; // índice da coluna "Ordenado Bruto"
    const style = (bg, color, bold, isOB = false) =>
      `background:${isOB ? '#ECFDF5' : bg};color:${isOB ? '#065F46' : color};font-weight:${bold || isOB ? 'bold' : 'normal'};padding:7px 10px;border:1px solid ${isOB ? '#6EE7B7' : '#E2E8F0'};white-space:nowrap${isOB ? ';font-size:12px' : ''}`;

    const hdrRow = `<tr>${cols.map((c, ci) => `<td style="${style('#0F1F3D', 'white', true, ci === lastCol)}">${c}</td>`).join('')}</tr>`;
    const bodyRows = dataRows.map((row, ri) =>
      `<tr>${row.map((c, ci) => `<td style="${style(ri % 2 === 0 ? '#ffffff' : '#F8FAFC', '#1E293B', false, ci === lastCol)}">${c}</td>`).join('')}</tr>`
    ).join('');
    const totRow = `<tr>${totais.map((c, ci) => `<td style="${style('#EEF2FF', '#4F46E5', true, ci === lastCol)}">${c}</td>`).join('')}</tr>`;

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/></head><body>
<h2 style="font-family:Arial;color:#0F1F3D">PROCESSAMENTO SALARIAL — ${mesLabel.toUpperCase()} ${inputs.ano}</h2>
<p style="font-family:Arial;font-size:11px">${EMPRESA.nome} &nbsp;·&nbsp; NIF ${EMPRESA.nif}</p>
<table border="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial;font-size:10px">
${hdrRow}${bodyRows}${totRow}
</table>
<p style="font-family:Arial;font-size:9px;color:#64748B;margin-top:12px">Estimativa — confirmar sempre no TOConline antes de processar. Horas suplementares não incluídas.</p>
</body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `processamento-salarial-${String(mesNum).padStart(2, '0')}-${inputs.ano}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Renderiza UMA página de recibo — 2 colunas ORIGINAL/DUPLICADO ────────
  function _renderReciboPagina(doc, { mesLabel, ano, mesNum, nome, nif, nis, profissao, vencBase, linhas, totalAbonos, totalDescontos, liquido, logo }) {
    const PW     = doc.internal.pageSize.getWidth();   // 210mm
    const PH     = doc.internal.pageSize.getHeight();  // 297mm
    const SEP_X  = PW / 2;                             // 105mm
    const COL_W  = SEP_X - 3;                          // 102mm por coluna
    const NAVY   = [27, 58, 87];
    const ORANGE = [235, 141, 0];
    const SLATE  = [134, 154, 175];
    const LGRAY  = [238, 241, 245];
    const BG     = [247, 248, 250];
    const fmtEur = v => (isNaN(v) ? 0 : v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';
    const mN     = parseInt(mesNum || inputs.mes, 10);
    const daysInMonth = new Date(parseInt(ano), mN, 0).getDate();

    // Separador central
    doc.setDrawColor(220, 226, 232);
    doc.setLineWidth(0.2);
    doc.line(SEP_X, 2, SEP_X, PH - 2);

    let tableStartY = null;
    let tableEndY   = null;

    ['ORIGINAL', 'DUPLICADO'].forEach((tipo, colIdx) => {
      const xOff  = colIdx === 0 ? 1.5 : SEP_X + 1.5;
      const cW    = COL_W;
      const LOGO_SZ = 12;
      const HDR_H   = 25;

      // ── 1. Cabeçalho navy ─────────────────────────────────────────────
      doc.setFillColor(...NAVY);
      doc.rect(xOff, 0, cW, HDR_H, 'F');

      if (logo) doc.addImage(logo, 'PNG', xOff + 1.5, (HDR_H - LOGO_SZ) / 2, LOGO_SZ, LOGO_SZ);
      const cxL = xOff + (logo ? LOGO_SZ + 3 : 2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.text(EMPRESA.nome.toUpperCase(), cxL, 8.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.8);
      doc.setTextColor(...SLATE);
      doc.text(`NIF: ${EMPRESA.nif}`, cxL, 12.5);
      const moradaLines = doc.splitTextToSize(EMPRESA.morada, 42);
      doc.text(moradaLines, cxL, 16.5);

      const cxR = xOff + cW - 1;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text('RECIBO DE VENCIMENTO', cxR, 9, { align: 'right' });
      doc.setFontSize(5.5);
      doc.setTextColor(...ORANGE);
      doc.text(tipo, cxR, 14, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.5);
      doc.setTextColor(170, 195, 220);
      doc.text(`De 1 de ${mesLabel} ${ano} até ${daysInMonth} de ${mesLabel} ${ano}`, cxR, 21, { align: 'right' });

      // ── 2. Faixa laranja com nome ──────────────────────────────────────
      let y = HDR_H + 1;
      doc.setFillColor(...ORANGE);
      doc.rect(xOff, y, cW, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text((nome || '—').toUpperCase(), xOff + 2, y + 5);
      y += 8.5;

      // ── 3. Campos do trabalhador ───────────────────────────────────────
      const fldSz = 5.5;
      const fldH  = 6;
      const fx1   = xOff + 2;
      const fx2   = xOff + cW / 2 + 1;

      doc.setFontSize(fldSz);
      [
        ['Nº Contribuinte', nif || '—',   'NIS / Beneficiário',    nis || '—'],
        ['Categoria/Profissão', profissao || '—', 'Vencimento',     `${vencBase}€`],
        ['Tipo de Processamento', 'Normalizado', 'Horas Semana',    '40'],
        ['Base do Processamento', 'Mensal',      'Dias do Mês',     String(daysInMonth)],
      ].forEach(([l1, v1, l2, v2]) => {
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...SLATE);
        doc.text(l1, fx1, y);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
        doc.text(v1, fx1, y + 3);
        if (l2) {
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...SLATE);
          doc.text(l2, fx2, y);
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
          doc.text(v2, fx2, y + 3);
        }
        y += fldH;
      });

      y += 1;
      doc.setDrawColor(...LGRAY);
      doc.setLineWidth(0.3);
      doc.line(xOff + 1, y, xOff + cW - 1, y);
      y += 2;

      // ── 4. Tabela de linhas ────────────────────────────────────────────
      if (tableStartY === null) tableStartY = y;
      autoTable(doc, {
        startY: tableStartY,
        tableWidth: cW - 2,
        margin: { left: xOff + 1, top: 0 },
        head: [['DESCRIÇÃO', 'QTD', 'V.UNIT.', 'ABONOS', 'DESCONTOS']],
        body: linhas.map(r => [r[1], r[2], r[3], r[4], r[5]]),
        theme: 'plain',
        headStyles: {
          fillColor: NAVY, textColor: [255, 255, 255],
          fontSize: 5.5, fontStyle: 'bold',
          cellPadding: { top: 2, bottom: 2, left: 2, right: 1 },
        },
        bodyStyles: { fontSize: 5.5, cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 1 }, textColor: NAVY },
        alternateRowStyles: { fillColor: BG },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 10, halign: 'right' },
          2: { cellWidth: 14, halign: 'right' },
          3: { cellWidth: 17, halign: 'right' },
          4: { cellWidth: 17, halign: 'right' },
        },
        didParseCell(data) {
          if (data.section === 'body') {
            const cod = linhas[data.row.index]?.[0];
            if (cod === 'T001' || cod === 'T003' || cod === 'D001') {
              data.cell.styles.textColor = [185, 28, 28];
            }
          }
        },
      });

      if (tableEndY === null) tableEndY = doc.lastAutoTable.finalY;
      y = tableEndY + 2;

      // ── 5. Barra totais — 3 colunas ────────────────────────────────────
      const totSegW = (cW - 2) / 3;
      [
        ['Total Abonos',    totalAbonos,    false],
        ['Total Descontos', totalDescontos, false],
        ['Total a Receber', liquido,        true ],
      ].forEach(([label, val, hi], j) => {
        const tx = xOff + 1 + j * totSegW;
        doc.setFillColor(...(hi ? NAVY : LGRAY));
        doc.rect(tx, y, totSegW, 11, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(...(hi ? [255, 255, 255] : SLATE));
        doc.text(label, tx + totSegW / 2, y + 4, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...(hi ? [255, 255, 255] : NAVY));
        doc.text(fmtEur(val), tx + totSegW / 2, y + 9, { align: 'center' });
      });
      y += 13;

      // ── 6. Declaração ──────────────────────────────────────────────────
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(...SLATE);
      doc.text(`O Valor de ${fmtEur(liquido)} foi pago por Transferência bancária.`, xOff + 1, y);
      y += 4;
      const decl  = `Declaro que recebi a quantia constante neste recibo no valor de: ${fmtEur(liquido)}.`;
      const dLines = doc.splitTextToSize(decl, cW - 3);
      doc.text(dLines, xOff + 1, y);
      y += dLines.length * 3 + 5;

      // Linha de assinatura
      doc.setDrawColor(200, 212, 224);
      doc.setLineWidth(0.2);
      doc.line(xOff + 1, y + 5, xOff + cW * 0.65, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(...SLATE);
      doc.text('Assinatura:', xOff + 1, y + 9);

      // ── 7. Rodapé laranja ─────────────────────────────────────────────
      doc.setDrawColor(...ORANGE);
      doc.setLineWidth(0.8);
      doc.line(xOff, PH - 5, xOff + cW, PH - 5);
      doc.setFontSize(5);
      doc.setTextColor(...SLATE);
      doc.setFont('helvetica', 'normal');
      doc.text('Página 1 / 1', xOff + 1, PH - 2);
      doc.text('Magnetic Place, Lda', xOff + cW - 1, PH - 2, { align: 'right' });
    });
  }

  // ── Renderiza UMA página do mapa (A4 vertical) ───────────────────────────
  function _renderMapaPagina(doc, { mesLabel, ano, nome, nif, nis, profissao, mapaLinhas, subsAlimTotal, logo }) {
    const W  = doc.internal.pageSize.getWidth();   // 210mm portrait
    const H  = doc.internal.pageSize.getHeight();  // 297mm portrait
    const MX = 5;
    const TW = W - 2 * MX;  // 200mm
    const NAVY   = [27, 58, 87];
    const ORANGE = [235, 141, 0];
    const LGRAY  = [238, 241, 245];
    const SLATE  = [134, 154, 175];
    const BG     = [247, 248, 250];
    const fmt   = v => (isNaN(v) ? 0 : v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const fmtDia  = iso => { const d = new Date(iso + 'T00:00:00'); return `${DIAS_PT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}`; };

    // ── ZONA 1: Cabeçalho navy compacto (22mm) ──────────────────────────────
    const HEADER_H  = 22;
    const LOGO_SIZE = 15;
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, HEADER_H, 'F');

    // Logo no canto esquerdo (fundo transparente)
    if (logo) doc.addImage(logo, 'PNG', MX, (HEADER_H - LOGO_SIZE) / 2, LOGO_SIZE, LOGO_SIZE);

    // Empresa + NIF alinhados à direita (não colidem com o título centrado)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(EMPRESA.nome.toUpperCase(), W - MX, 8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(160, 178, 205);
    doc.text(`NIF ${EMPRESA.nif}`, W - MX, 13, { align: 'right' });

    // Título centrado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('MAPA DE AJUDAS DE CUSTO', W / 2, 9.5, { align: 'center' });
    doc.setDrawColor(...ORANGE);
    doc.setLineWidth(0.4);
    doc.line(W / 2 - 45, 12, W / 2 + 45, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(215, 228, 248);
    doc.text(`${mesLabel.toUpperCase()}  ${ano}`, W / 2, 18, { align: 'center' });

    // ── ZONA 2: Faixa do trabalhador (11mm) ─────────────────────────────────
    const Y_TRAB = HEADER_H + 1;
    doc.setFillColor(...LGRAY);
    doc.rect(MX, Y_TRAB, TW, 11, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text((nome || '—').toUpperCase(), MX + 3, Y_TRAB + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...SLATE);
    doc.text(profissao || '—', MX + 3, Y_TRAB + 9.5);

    doc.setFontSize(6);
    doc.text(`NIF: ${nif || '—'}`, W - MX - 3, Y_TRAB + 5, { align: 'right' });
    doc.text(`NIS: ${nis || '—'}`, W - MX - 3, Y_TRAB + 9.5, { align: 'right' });

    // ── ZONA 3: Tabela adaptativa (190mm de largura) ─────────────────────────
    // Rodapé reserva 48mm: 26mm totais + 22mm assinatura
    const Y_TABLE  = Y_TRAB + 13;
    const Y_FOOTER = H - 42;
    const availH   = Y_FOOTER - Y_TABLE;
    const nRows    = mapaLinhas.length;
    const HEADER_ROW_H = 3.5;
    const rowH = Math.min(4.5, Math.max(1.0, (availH - HEADER_ROW_H) / Math.max(nRows, 1)));
    const fs   = Math.min(6, Math.max(4.5, rowH * 1.4));
    const pad  = Math.max(0.1, (rowH - fs * 0.3528) / 2);

    // Colunas — soma = 200mm (TW portrait com MX=5)
    const colW = [18, 30, 34, 28, 21, 21, 14, 12, 22];

    autoTable(doc, {
      startY: Y_TABLE,
      tableWidth: TW,
      margin: { left: MX, right: MX },
      head: [['Dia', 'Serviço', 'Cliente', 'Localidade', 'Território', 'Tipo', 'Hora', '%', 'Valor (€)']],
      body: mapaLinhas.map(row => [
        fmtDia(row.dia),
        row.servico,
        row.cliente || '—',
        row.localidade || '—',
        row.territorio,
        row.tipo,
        row.hora || '—',
        `${row.pct}%`,
        fmt(row.valor),
      ]),
      theme: 'striped',
      headStyles: {
        fillColor: NAVY, textColor: 255,
        fontSize: Math.min(7, fs + 0.5), fontStyle: 'bold',
        cellPadding: { top: 0.3, bottom: 0.3, left: 1.0, right: 1.0 },
        minCellHeight: HEADER_ROW_H, halign: 'center',
      },
      bodyStyles: {
        fontSize: fs,
        cellPadding: { top: pad, bottom: pad, left: 1.0, right: 1.0 },
        overflow: 'ellipsis',
        minCellHeight: rowH,
        halign: 'center',
      },
      alternateRowStyles: { fillColor: BG },
      columnStyles: {
        0: { cellWidth: colW[0], fontStyle: 'bold' },
        1: { cellWidth: colW[1] },
        2: { cellWidth: colW[2] },
        3: { cellWidth: colW[3] },
        4: { cellWidth: colW[4] },
        5: { cellWidth: colW[5] },
        6: { cellWidth: colW[6] },
        7: { cellWidth: colW[7] },
        8: { cellWidth: colW[8], fontStyle: 'bold' },
      },
      pageBreak: 'avoid',
    });

    // ── ZONA 4: Totais — logo após a tabela ─────────────────────────────────
    const mapaTotal   = mapaLinhas.reduce((s, row) => s + row.valor, 0);
    const importancia = mapaTotal - subsAlimTotal;
    const tableEnd    = (doc.lastAutoTable && doc.lastAutoTable.finalY) || Y_FOOTER;
    const XT          = MX + 55;
    const YT          = Math.min(tableEnd + 4, H - 40);
    const XR          = W - MX - 1;
    const totW        = XR - XT + 3;

    // Total Ajudas de Custo — fundo LGRAY
    doc.setFillColor(...LGRAY);
    doc.rect(XT - 2, YT - 2.5, totW, 7, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE);
    doc.text('Total Ajudas de Custo', XT, YT + 2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(fmt(mapaTotal), XR, YT + 2, { align: 'right' });

    // Dedução Sub. Alimentação — fundo LGRAY continuado
    doc.setFillColor(...LGRAY);
    doc.rect(XT - 2, YT + 4.5, totW, 7, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE);
    doc.text('Dedução Sub. Alimentação', XT, YT + 8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(`- ${fmt(subsAlimTotal)}`, XR, YT + 8.5, { align: 'right' });

    // Importância a Receber — fundo NAVY
    doc.setFillColor(...NAVY);
    doc.rect(XT - 2, YT + 11.5, totW, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('Importância a Receber', XT, YT + 17.5);
    doc.text(fmt(importancia), XR, YT + 17.5, { align: 'right' });

    // ── ZONA 5: Assinatura ──────────────────────────────────────────────────
    const YS = H - 12;
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.3);
    doc.line(MX, YS - 1, W - MX, YS - 1);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...SLATE);
    doc.text(`Recebi a importância de ${fmt(importancia)}, referente a ajudas de custo (${mesLabel} de ${ano}).`, MX, YS + 5);

    // Linha laranja no rodapé
    doc.setDrawColor(...ORANGE);
    doc.setLineWidth(1.2);
    doc.line(MX, H - 3, W - MX, H - 3);
  }

  async function gerarMapasAjudasPDF() {
    const mesNum   = parseInt(inputs.mes, 10);
    const mesStr   = `${inputs.ano}-${String(mesNum).padStart(2, '0')}`;
    const mesLabel = MESES_PT[mesNum] || inputs.mes;
    const anoNum   = n(inputs.ano);

    const trabalhadores = (workers || [])
      .filter(w => (w.is_active !== false && w.status !== 'inativo' || w.dataFim?.startsWith(mesStr) || w.dataInicio?.startsWith(mesStr)) && w.vencimento_base != null)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (trabalhadores.length === 0) { alert('Nenhum trabalhador activo com vencimento base configurado.'); return; }

    const { rateHistory, absenceData } = await _fetchBatchData(mesStr);
    const logsDoMes = (logs || []).filter(l => l.date?.startsWith(mesStr));

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let isFirstPage = true;

    trabalhadores.forEach(w => {
      const workerLogs      = logsDoMes.filter(l => l.workerId === w.id);
      const brutoAlvo       = _calcBruto(w.id, workerLogs, rateHistory, w.valorHora);
      const workerAusencias = absenceData
        .filter(a => a.worker_id === w.id)
        .flatMap(a => a.dates || [])
        .filter(d => d.startsWith(mesStr));
      const subsAlimDias    = calcularDiasUteisNoMes(anoNum, mesNum, {
        feriadoMunicipal,
        dataAdmissao: w.dataInicio || null,
        dataCessacao: w.dataFim    || null,
        ausencias:    workerAusencias,
      });

      const funcaoW = w.profissao_cnp ? funcaoDeCPP(w.profissao_cnp) : funcaoMaxAjudasWorker(w.name);
      const { rc } = _calcReciboComMapa(w, subsAlimDias, brutoAlvo, anoNum, mesStr, undefined, funcaoW);

      if (rc.ajudaCustoNecessaria <= 0) return; // sem ajudas de custo, pula

      // Cliente carry-forward por dia
      const clienteParaDia = _clientePorDiaFn(w.id, mesStr);

      const limiteDia    = valorDiarioLegal('internacional', funcaoW);
      const valorAlimDia = parseFloat(w.subsidio_alimentacao_dia) || 0;
      const totalDiasMes = new Date(anoNum, mesNum, 0).getDate();

      // Conta dias úteis (Seg–Sex) nas primeiras nDias a partir de di
      function contarUteis(di, nDias) {
        let c = 0;
        const d = new Date(di + 'T00:00:00');
        for (let i = 0; i < nDias; i++) { if (d.getDay() >= 1 && d.getDay() <= 5) c++; d.setDate(d.getDate() + 1); }
        return c;
      }

      // Mesma lógica que autoFill na UI: testa dias de início 1–20 e escolhe o de menor |resíduo|
      function runForStartDayMapa(di) {
        let subsAlimMapa = valorAlimDia > 0 ? rc.subsAlimTotal : 0;
        let bestCombo = null;
        for (let iter = 0; iter < 6; iter++) {
          const valorNec = rc.ajudaCustoNecessaria + subsAlimMapa;
          if (valorNec <= 0) break;
          bestCombo = findBestCombo(valorNec, limiteDia, totalDiasMes);
          if (!bestCombo) break;
          const novoSubsAlim = valorAlimDia > 0 ? contarUteis(di, bestCombo.N) * valorAlimDia : 0;
          if (Math.abs(novoSubsAlim - subsAlimMapa) < 0.005) break;
          subsAlimMapa = novoSubsAlim;
        }
        if (!bestCombo) return null;
        const totalAjudas = Math.round(bestCombo.total * 100) / 100;
        const valorNecFinal = rc.ajudaCustoNecessaria + subsAlimMapa;
        const residuo = Math.round((valorNecFinal - totalAjudas) * 100) / 100;
        return { bestCombo, subsAlimMapa, residuo, di };
      }

      let bestMapaResult = null;
      for (let day = 1; day <= 20; day++) {
        const di = `${mesStr}-${String(day).padStart(2, '0')}`;
        const result = runForStartDayMapa(di);
        if (!result) continue;
        if (!bestMapaResult || Math.abs(result.residuo) < Math.abs(bestMapaResult.residuo)) bestMapaResult = result;
      }

      // Constrói linhas do mapa a partir do combo (N, fP, fC) com frações legais
      let mapaLinhas = [];
      let subsAlimMapaFinal = 0;
      if (bestMapaResult) {
        const { bestCombo, subsAlimMapa, di: dataInicio } = bestMapaResult;
        subsAlimMapaFinal = subsAlimMapa;
        let cursor = new Date(dataInicio + 'T00:00:00');
        for (let i = 0; i < bestCombo.N; i++) {
          const isFirst = i === 0, isLast = i === bestCombo.N - 1;
          const tipo = isFirst ? 'Partida' : isLast ? 'Chegada' : 'Consecutivo';
          let pct, hora;
          if (isFirst)     { pct = Math.round(bestCombo.fP * 100); hora = horaDefaultPartida(bestCombo.fP, '07:30'); }
          else if (isLast) { pct = Math.round(bestCombo.fC * 100); hora = horaDefaultChegada(bestCombo.fC, '20:30'); }
          else             { pct = 100; hora = ''; }
          const dia = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;
          mapaLinhas.push({
            id: i + 1, dia,
            servico: 'Serviços de mecânica geral',
            cliente: clienteParaDia(dia) || '',
            localidade: '', territorio: 'Internacional',
            tipo, hora, pct,
            valor: limiteDia * (pct / 100),
          });
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      if (mapaLinhas.length === 0) return;

      if (!isFirstPage) doc.addPage();
      isFirstPage = false;

      _renderMapaPagina(doc, {
        mesLabel, ano: inputs.ano,
        nome: w.name, nif: w.nif, nis: w.nis, profissao: w.profissao,
        mapaLinhas,
        subsAlimTotal: subsAlimMapaFinal,
        logo: logoRef.current,
      });
    });

    if (isFirstPage) { alert('Nenhum trabalhador com ajudas de custo no mês seleccionado.'); return; }
    doc.save(`mapas-ajudas-custo-${String(mesNum).padStart(2, '0')}-${inputs.ano}.pdf`);
  }

  async function saveWorkerProfile() {
    if (!selectedWorkerId) return;
    setSaveStatus('saving');
    const mesStr = `${inputs.ano}-${String(n(inputs.mes)).padStart(2, '0')}`;
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('workers').update({
        vencimento_base:           n(inputs.vencimentoBase),
        subsidio_alimentacao_dia:  n(inputs.subsAlimValorDia),
        subsidio_alimentacao_tipo: inputs.subsAlimTipo,
        tabela_irs:                inputs.tabelaKey,
        n_dependentes:             n(inputs.nDependentes),
      }).eq('id', selectedWorkerId),
      supabase.from('resumo_observacoes').upsert(
        {
          worker_id:    selectedWorkerId,
          mes:          mesStr,
          completo:     isValidado,
          ajuste_bruto: brutoAlvoEditado ? n(inputs.brutoAlvo) : null,
        },
        { onConflict: 'worker_id,mes' }
      ),
    ]);
    if (e1 || e2) { setSaveStatus('error'); return; }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 2500);
  }

  async function toggleValidado() {
    if (!selectedWorkerId) return;
    const mesStr2  = `${inputs.ano}-${String(n(inputs.mes)).padStart(2, '0')}`;
    const novoValor = !isValidado;
    await supabase.from('resumo_observacoes').upsert(
      {
        worker_id:    selectedWorkerId,
        mes:          mesStr2,
        completo:     novoValor,
        ajuste_bruto: brutoAlvoEditado ? n(inputs.brutoAlvo) : null,
      },
      { onConflict: 'worker_id,mes' }
    );
    if (novoValor && mapaRows.length > 0) {
      const pRow = mapaRows.find(row => row.tipo === 'Partida');
      const cRow = [...mapaRows].reverse().find(row => row.tipo === 'Chegada');
      if (pRow && cRow) {
        supabase.from('mapa_viagens_historico').upsert(
          { worker_id: selectedWorkerId, mes: mesStr2,
            data_partida: pRow.dia, data_chegada: cRow.dia,
            hora_partida: pRow.hora || mapa.horaPartida,
            hora_chegada: cRow.hora || mapa.horaChegada,
            n_dias: mapaRows.length, updated_at: new Date().toISOString() },
          { onConflict: 'worker_id,mes' }
        );
      }
    }
    setIsValidado(novoValor);
  }

  async function resetBrutoAlvoAuto() {
    if (!selectedWorkerId) return;
    const custo = calcularCustoMesRef.current(selectedWorkerId, inputs.mes, inputs.ano);
    setBrutoAlvoEditado(false);
    setInputs(prev => ({ ...prev, brutoAlvo: custo > 0 ? custo.toFixed(2) : '' }));
    const mesStr = `${inputs.ano}-${String(n(inputs.mes)).padStart(2, '0')}`;
    await supabase.from('resumo_observacoes').upsert(
      { worker_id: selectedWorkerId, mes: mesStr, completo: isValidado, ajuste_bruto: null },
      { onConflict: 'worker_id,mes' }
    );
  }

  function gerarPDF() {
    const mesNum   = parseInt(inputs.mes, 10);
    const mesLabel = MESES_PT[mesNum] || inputs.mes;

    const rowsWithVal = mapaRows.map(row => {
      const limite = row.territorio === 'Nacional' ? LIMITES.ajudaNacional : n(inputs.vdl);
      return { ...row, valor: limite * (row.pct / 100) };
    });

    // Subsídio alimentação: contar apenas dias úteis (Seg–Sex) nas linhas do mapa
    const valorAlimDia = n(inputs.subsAlimValorDia);
    const diasUteisPDF = valorAlimDia > 0
      ? rowsWithVal.filter(row => {
          if (!row.dia) return false;
          const dow = new Date(row.dia + 'T00:00:00').getDay();
          return dow >= 1 && dow <= 5;
        }).length
      : 0;
    const subsAlimMapaPDF = diasUteisPDF * valorAlimDia;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    _renderMapaPagina(doc, {
      mesLabel, ano: inputs.ano,
      nome:      inputs.nome,
      nif:       inputs.nif,
      nis:       inputs.nis,
      profissao: inputs.categoria,
      mapaLinhas:    rowsWithVal,
      subsAlimTotal: subsAlimMapaPDF,
      logo:          logoRef.current,
    });

    const nomeFile = (inputs.nome || 'trabalhador').replace(/\s+/g, '-').toLowerCase();
    doc.save(`mapa-ajudas-custo-${nomeFile}-${inputs.mes.padStart(2, '0')}-${inputs.ano}.pdf`);
  }

  return (
    <div className={subTab === 'resumo' ? 'flex flex-col flex-1 min-h-0 gap-0 pb-0' : 'space-y-5 pb-2'}>

      {/* ── Modo Calculadora: cabeçalho completo + sub-abas ── */}
      {subTab !== 'resumo' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ background: '#EEF1F5' }}>
                <FileText size={18} style={{ color: '#1B3A57' }} />
              </div>
              <div>
                <h2 className="text-lg font-black leading-tight" style={{ color: '#1B3A57' }}>Calculadora de Recibos</h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Estimativas salariais</p>
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-0.5">
              <button onClick={() => navMes(-1)} className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                <ChevronLeft size={15} style={{ color: '#869AAF' }} />
              </button>
              <span className="px-3 py-1 text-sm font-black min-w-[140px] text-center" style={{ color: '#1B3A57' }}>
                {MESES_PT[parseInt(inputs.mes, 10)] || ''} {inputs.ano}
              </span>
              <button onClick={() => navMes(1)} className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                <ChevronRight size={15} style={{ color: '#869AAF' }} />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={gerarRecibosBatchPDF}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border border-slate-200 hover:bg-slate-50 transition-colors"
                style={{ color: '#1B3A57' }}
                title="PDF dos recibos de vencimento — todos os trabalhadores"
              >
                <FileText size={13} /> Recibos PDF
              </button>
              <button
                onClick={exportRecibosBatchXLS}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border border-slate-200 hover:bg-slate-50 transition-colors"
                style={{ color: '#1B3A57' }}
                title="Excel dos recibos de vencimento — todos os trabalhadores"
              >
                <FileSpreadsheet size={13} /> Recibos XLS
              </button>
              <button
                onClick={gerarMapasAjudasPDF}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border border-slate-200 hover:bg-slate-50 transition-colors"
                style={{ color: '#1B3A57' }}
                title="PDF dos mapas de ajudas de custo — todos os trabalhadores"
              >
                <Download size={13} /> Mapas AC
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 border-b border-slate-100">
            <button
              onClick={() => setSubTab('calculadora')}
              className={`px-3 pb-2.5 pt-1 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 -mb-px ${subTab === 'calculadora' ? 'border-[#EB8D00] text-[#1B3A57]' : 'border-transparent text-slate-400 hover:text-[#1B3A57]'}`}
            >
              Calculadora
            </button>
            <button
              onClick={() => setSubTab('resumo')}
              className="px-3 pb-2.5 pt-1 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 -mb-px border-transparent text-slate-400 hover:text-[#1B3A57]"
            >
              Resumo Mensal
            </button>
          </div>
        </>
      )}

      {/* Selector de trabalhador — oculto na subaba Resumo */}
      {subTab !== 'resumo' && (
      <InputVariant.Provider value="line">
      <Card className="p-4">
        {/* Header: label + badge de estado + mês */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Trabalhador</span>
            {selectedWorkerId && (
              <span className="text-[8px] font-black uppercase tracking-wide px-2 py-0.5 rounded"
                style={isValidado
                  ? { background: '#d1fae5', color: '#065f46' }
                  : { background: '#dce6f0', color: '#1B3A57' }}>
                {isValidado ? 'Validado' : 'Em elaboração'}
              </span>
            )}
          </div>
          {selectedWorkerId && (
            <span className="text-[10px] font-bold text-slate-400">
              {MESES_PT[parseInt(inputs.mes, 10)] || ''} {inputs.ano}
            </span>
          )}
        </div>
        {/* Body: dropdown + botões */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <SelectInput value={selectedWorkerId} onChange={handleSelectWorker}>
              <option value="">— Introduzir manualmente —</option>
              {(workers || [])
                .filter(w => { const m = `${inputs.ano}-${String(parseInt(inputs.mes, 10)).padStart(2, '0')}`; return (w.is_active !== false && w.status !== 'inativo') || w.dataFim?.startsWith(m) || w.dataInicio?.startsWith(m); })
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
            </SelectInput>
          </div>
          {selectedWorkerId && (
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={saveWorkerProfile}
                disabled={saveStatus === 'saving'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all border
                  ${saveStatus === 'saved'  ? 'border-emerald-200 text-emerald-600' :
                    saveStatus === 'error'  ? 'border-rose-200 text-rose-600' :
                                             'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'}`}
                title="Guarda vencimento base, subsídio alimentação, tipo, tabela IRS e nº dependentes no perfil do trabalhador"
              >
                <Save size={12} />
                {saveStatus === 'saving' ? 'A guardar…' : saveStatus === 'saved' ? 'Guardado ✓' : saveStatus === 'error' ? 'Erro!' : 'Guardar'}
              </button>
              <button
                onClick={toggleValidado}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[11px] font-black uppercase text-white transition-colors"
                style={{ background: isValidado ? '#869AAF' : '#1B3A57' }}
                onMouseEnter={e => { e.currentTarget.style.background = isValidado ? '#6b7f91' : '#142d45'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isValidado ? '#869AAF' : '#1B3A57'; }}
                title={isValidado ? 'Recibo validado — clique para remover validação' : 'Marcar recibo deste mês como validado'}
              >
                <CheckCircle size={12} />
                {isValidado ? 'Validado ✓' : 'Validar e concluir'}
              </button>
            </div>
          )}
        </div>
      </Card>
      </InputVariant.Provider>
      )}

      {/* ── Resumo Mensal ── */}
      {subTab === 'resumo' && (
        <ResumoMensalTable
          rows={resumoRows}
          mesLabel={`${MESES_PT[parseInt(inputs.mes, 10)] || ''} ${inputs.ano}`}
          mesStr={`${inputs.ano}-${String(parseInt(inputs.mes, 10)).padStart(2, '0')}`}
          onBack={() => setSubTab('calculadora')}
          onNavMes={navMes}
        />
      )}

      {/* Grid 2 colunas: inputs + preview + mapa */}
      {subTab === 'calculadora' && (isValidado && selectedWorkerId ? (
        <div className="space-y-5">
          {/* Barra de estado validado */}
          <div className="flex items-center justify-between px-5 py-4 rounded-2xl" style={{ background: '#1B3A57' }}>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black" style={{ background: '#EB8D00', color: '#fff' }}>
                <CheckCircle size={12} /> Validado
              </span>
              <div>
                <p className="font-black text-white text-sm leading-tight">{inputs.nome || '—'}</p>
                <p className="text-xs font-bold" style={{ color: '#869AAF' }}>{MESES_PT[parseInt(inputs.mes, 10)] || ''} {inputs.ano}</p>
              </div>
            </div>
            <button
              onClick={toggleValidado}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-colors"
              style={{ border: '1px solid #495f74', color: '#EEF1F5', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Pencil size={12} /> Editar
            </button>
          </div>

          {/* Documentos */}
          <div className="grid sm:grid-cols-2 gap-5 items-start">
            {/* ── Recibo ── */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ borderTop: '4px solid #1B3A57' }}>
              <p className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: '#869AAF' }}>Recibo de Vencimento</p>
              {r ? (
                <>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vencimento base</span>
                      <span className="font-black text-slate-800">{eur(n(inputs.vencimentoBase))}</span>
                    </div>
                    {r.subsAlimTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Sub. alimentação</span>
                        <span className="font-black text-slate-800">{eur(r.subsAlimTotal)}</span>
                      </div>
                    )}
                    {n(inputs.premios) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Prémios / bónus</span>
                        <span className="font-black text-slate-800">{eur(n(inputs.premios))}</span>
                      </div>
                    )}
                    {r.subsFerias > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Sub. férias (duo.)</span>
                        <span className="font-black text-slate-800">{eur(r.subsFerias)}</span>
                      </div>
                    )}
                    {r.subsNatal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Sub. natal (duo.)</span>
                        <span className="font-black text-slate-800">{eur(r.subsNatal)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-100 pt-2 flex justify-between">
                      <span className="text-rose-500">IRS</span>
                      <span className="font-black text-rose-600">−{eur(r.irsTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-rose-500">Seg. Social (11%)</span>
                      <span className="font-black text-rose-600">−{eur(r.ssTrabalhador)}</span>
                    </div>
                  </div>
                  <div className="rounded-xl px-4 py-3 mb-4" style={{ background: '#EEF1F5' }}>
                    <p className="text-[9px] font-black uppercase tracking-wider mb-0.5" style={{ color: '#869AAF' }}>Líquido a receber</p>
                    <p className="text-xl font-black" style={{ color: '#1B3A57' }}>{eur(liquidoDisplay)}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 mb-4">Sem dados de recibo.</p>
              )}
              <button
                onClick={gerarReciboPDF}
                disabled={!r}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#1B3A57' }}
                onMouseEnter={e => { if (r) e.currentTarget.style.background = '#142d45'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#1B3A57'; }}
              >
                <Download size={14} /> Download Recibo PDF
              </button>
            </div>

            {/* ── Mapa de Ajudas ── */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ borderTop: '4px solid #EB8D00' }}>
              <p className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: '#869AAF' }}>Mapa de Ajudas de Custo</p>
              {mapaRows.length > 0 ? (
                <>
                  <div className="space-y-2 text-sm mb-4">
                    {(() => {
                      const pRow = mapaRows.find(row => row.tipo === 'Partida');
                      const cRow = [...mapaRows].reverse().find(row => row.tipo === 'Chegada');
                      return (
                        <>
                          {pRow && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Partida</span>
                              <span className="font-black text-slate-800">{pRow.dia}</span>
                            </div>
                          )}
                          {cRow && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Chegada</span>
                              <span className="font-black text-slate-800">{cRow.dia}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nº dias</span>
                      <span className="font-black text-slate-800">{mapaRows.length}</span>
                    </div>
                    <div className="border-t border-slate-100 pt-2 flex justify-between">
                      <span className="text-slate-500">Ajudas de custo</span>
                      <span className="font-black text-slate-800">{eur(mapaTotal)}</span>
                    </div>
                    {subsAlimMapaLive > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Sub. alim. (dias úteis)</span>
                        <span className="font-black text-slate-800">−{eur(subsAlimMapaLive)}</span>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl px-4 py-3 mb-4" style={{ background: '#FDF1E0' }}>
                    <p className="text-[9px] font-black uppercase tracking-wider mb-0.5" style={{ color: '#EB8D00' }}>Total A082 (recibo)</p>
                    <p className="text-xl font-black" style={{ color: '#EB8D00' }}>{eur(mapaLiqLive ?? mapaTotal)}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 mb-4">Sem mapa preenchido.</p>
              )}
              <button
                onClick={gerarPDF}
                disabled={mapaRows.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#EB8D00' }}
                onMouseEnter={e => { if (mapaRows.length > 0) e.currentTarget.style.background = '#c97700'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#EB8D00'; }}
              >
                <Download size={14} /> Download Mapa PDF
              </button>
            </div>
          </div>
        </div>
      ) : (
      <div className="space-y-5">
      <div className="grid lg:grid-cols-2 gap-5 items-start">

        {/* ── COLUNA INPUTS ── */}
        <InputVariant.Provider value="line">
          <Card className="p-6">

            {/* 1 - Dados do Trabalhador */}
            <div className="pb-5 mb-5 border-b border-slate-100">
              <SectionHeader n="1" label="Dados do Trabalhador" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-4">
                <LabelInput label="Nome" badge={camposAuto.nome ? 'auto' : null}>
                  <TextInput value={inputs.nome} onChange={e => { set('nome', e.target.value); setCamposAuto(p => ({ ...p, nome: false })); }} />
                </LabelInput>
                <LabelInput label="Categoria / Profissão" badge={camposAuto.categoria ? 'auto' : null}>
                  <TextInput value={inputs.categoria} onChange={e => { set('categoria', e.target.value); setCamposAuto(p => ({ ...p, categoria: false })); }} />
                </LabelInput>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                <LabelInput label="NIF" badge={camposAuto.nif ? 'auto' : null}>
                  <TextInput value={inputs.nif} onChange={e => { set('nif', e.target.value); setCamposAuto(p => ({ ...p, nif: false })); }} />
                </LabelInput>
                <LabelInput label="NIS (SS)" badge={camposAuto.nis ? 'auto' : null}>
                  <TextInput value={inputs.nis} onChange={e => { set('nis', e.target.value); setCamposAuto(p => ({ ...p, nis: false })); }} />
                </LabelInput>
                <LabelInput label="Dias processados" badge={diasCalculados.diasMes ? 'auto' : null}>
                  <TextInput type="number" value={inputs.diasMes} onChange={e => { set('diasMes', e.target.value); setDiasCalculados(p => ({ ...p, diasMes: false })); }} min="1" max="31" />
                </LabelInput>
              </div>
            </div>

            {/* ── Banner: mês parcial ── */}
            {mesParcialDados && (
              <div className={`rounded-2xl border px-4 py-3 text-xs space-y-1 mb-5 ${
                mesParcialDados.tipo === 'fim' || mesParcialDados.tipo === 'ambos'
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-amber-50 border-amber-300 text-amber-800'
              }`}>
                <p className="font-black uppercase tracking-wide text-[11px]">
                  {mesParcialDados.tipo === 'inicio' && 'Mês parcial — início de contrato'}
                  {mesParcialDados.tipo === 'fim'    && 'Mês parcial — cessação de contrato'}
                  {mesParcialDados.tipo === 'ambos'  && 'Mês parcial — admissão e cessação'}
                </p>
                <p>Dias trabalhados (convenção 30 dias): <strong>dia {mesParcialDados.diaInicio} a dia {mesParcialDados.diaFim} = {mesParcialDados.diasTrabalhados} dias</strong></p>
                <p>Venc. base contratual: <strong>{mesParcialDados.vencBaseOriginal.toFixed(2)}€</strong></p>
                {descontoDiasParcial && (
                  <p>{descontoDiasParcial.label}: <strong>−{descontoDiasParcial.valor.toFixed(2)}€</strong>{' '}({descontoDiasParcial.diasNaoTrab}d × {descontoDiasParcial.horasNaoTrab}h não trabalhadas)</p>
                )}
                <p>Venc. base neste mês: <strong>{mesParcialDados.vencProporcional.toFixed(2)}€</strong></p>
                {feriasAnoAdmissao && (
                  <p className="text-[11px] opacity-80">
                    Direito a férias no ano de admissão: <strong>{feriasAnoAdmissao.diasFerias} dias</strong> ({feriasAnoAdmissao.mesesCompletos} meses completos × 2){feriasAnoAdmissao.limitado ? ' — limitado a 20' : ''}
                  </p>
                )}
              </div>
            )}

            {/* 2 - Retribuição Base */}
            <div className="pb-5 mb-5 border-b border-slate-100">
              <SectionHeader n="2" label="Retribuição Base" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 mb-4">
                <LabelInput label="Vencimento Base (€/mês)" badge={camposAuto.vencimentoBase ? 'auto' : null}>
                  <TextInput type="number" step="0.01" value={inputs.vencimentoBase} onChange={e => { set('vencimentoBase', e.target.value); setCamposAuto(p => ({ ...p, vencimentoBase: false })); }} />
                </LabelInput>
                <LabelInput label="Horas / semana">
                  <TextInput type="number" value={inputs.horasSemana} onChange={e => set('horasSemana', e.target.value)} />
                </LabelInput>
                <LabelInput label="Salário/hora" badge="auto">
                  <TextInput type="number" readOnly value={r ? r.salarioHora.toFixed(4) : ''} />
                </LabelInput>
              </div>
              <div className="flex flex-col gap-2 mb-4">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={inputs.incluirFerias} onChange={e => set('incluirFerias', e.target.checked)} className="w-4 h-4 accent-[#1B3A57]" />
                  Incluir Subsídio de Férias (100% com duodécimos)
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={inputs.incluirNatal} onChange={e => set('incluirNatal', e.target.checked)} className="w-4 h-4 accent-[#1B3A57]" />
                  Incluir Subsídio de Natal (100% com duodécimos)
                </label>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-4">
                <LabelInput label="Prémios / Bónus (€, tributável)">
                  <TextInput type="number" step="0.01" value={inputs.premios} onChange={e => set('premios', e.target.value)} />
                </LabelInput>
                <div />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 mb-4">
                <LabelInput label="H. Suplementares 1ª hora (qtd)">
                  <TextInput type="number" step="0.5" value={inputs.he1} onChange={e => set('he1', e.target.value)} />
                </LabelInput>
                <LabelInput label="H. Suplementares seguintes (qtd)">
                  <TextInput type="number" step="0.5" value={inputs.he2} onChange={e => set('he2', e.target.value)} />
                </LabelInput>
                <LabelInput label="" hint="1ª h: +25% · seguintes: +37,5%"><div /></LabelInput>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                <LabelInput label="Subsídio Alimentação (€/dia)" badge={camposAuto.subsAlimValorDia ? 'auto' : null}>
                  <TextInput type="number" step="0.01" value={inputs.subsAlimValorDia} onChange={e => { set('subsAlimValorDia', e.target.value); setCamposAuto(p => ({ ...p, subsAlimValorDia: false })); }} />
                </LabelInput>
                <LabelInput label="Pago em" badge={camposAuto.subsAlimTipo ? 'auto' : null}>
                  <SelectInput value={inputs.subsAlimTipo} onChange={e => { set('subsAlimTipo', e.target.value); setCamposAuto(p => ({ ...p, subsAlimTipo: false })); }}>
                    <option value="cartao">Cartão / vale (isento ≤ €10,46)</option>
                    <option value="dinheiro">Dinheiro (isento ≤ €6,15)</option>
                  </SelectInput>
                </LabelInput>
                <LabelInput label="Dias com subsídio" badge={diasCalculados.subsAlimDias ? 'auto' : null}>
                  <TextInput type="number" value={inputs.subsAlimDias} onChange={e => { set('subsAlimDias', e.target.value); setDiasCalculados(p => ({ ...p, subsAlimDias: false })); }} />
                </LabelInput>
              </div>
            </div>

            {/* 3 - IRS */}
            <div className="pb-5 mb-5 border-b border-slate-100">
              <SectionHeader n="3" label="IRS — Situação Fiscal" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <LabelInput label="Tabela de retenção" badge={camposAuto.tabelaKey ? 'auto' : null}>
                  <SelectInput value={inputs.tabelaKey} onChange={e => { set('tabelaKey', e.target.value); setCamposAuto(p => ({ ...p, tabelaKey: false })); }}>
                    {Object.entries(getIRSTabelasPorAno(n(inputs.ano))).map(([k, t]) => (
                      <option key={k} value={k}>{t.nome}</option>
                    ))}
                  </SelectInput>
                </LabelInput>
                <LabelInput
                  label="Nº de dependentes"
                  badge={camposAuto.nDependentes ? 'auto' : null}
                  hint={`Continente — tabelas ${Object.keys(IRS_TABELAS_BY_YEAR).map(Number).sort((a,b)=>b-a).find(a=>a<=n(inputs.ano)) || Object.keys(IRS_TABELAS_BY_YEAR).map(Number).sort((a,b)=>b-a)[0]}`}
                >
                  <TextInput type="number" min="0" value={inputs.nDependentes} onChange={e => { set('nDependentes', e.target.value); setCamposAuto(p => ({ ...p, nDependentes: false })); }} />
                </LabelInput>
              </div>
            </div>

            {/* 4 - Bruto Alvo & Deslocação */}
            <div>
              <SectionHeader n="4" label="Bruto Alvo & Deslocação Internacional" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-4">
                <LabelInput label="Valor Bruto Total Alvo (€)" badge={selectedWorkerId && !brutoAlvoEditado ? 'auto' : null}>
                  <div className="relative">
                    <TextInput
                      type="number" step="0.01" value={inputs.brutoAlvo}
                      onChange={e => { set('brutoAlvo', e.target.value); setBrutoAlvoEditado(true); }}
                      className={brutoAlvoEditado ? 'pr-10' : ''}
                    />
                    {brutoAlvoEditado && (
                      <button type="button" onClick={resetBrutoAlvoAuto}
                        className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] font-bold text-amber-500 hover:text-slate-500 leading-none cursor-pointer"
                        title="Repor valor automático dos registos de horas"
                      >repor ×</button>
                    )}
                  </div>
                </LabelInput>
                <LabelInput label="Valor diário legal (€)" badge="auto">
                  <TextInput type="number" step="0.01" value={inputs.vdl} onChange={e => set('vdl', e.target.value)} />
                </LabelInput>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-4">
                <LabelInput label="Território" badge={camposAuto.territorio ? 'auto' : null}>
                  <SelectInput value={inputs.territorio} onChange={e => { set('territorio', e.target.value); setCamposAuto(p => ({ ...p, territorio: false })); }}>
                    <option value="internacional">Internacional</option>
                    <option value="nacional">Nacional</option>
                  </SelectInput>
                </LabelInput>
                <LabelInput label="Função">
                  <SelectInput value={inputs.funcao} onChange={e => set('funcao', e.target.value)}>
                    <option value="geral">Trabalhador em geral</option>
                    <option value="gerencia">Gerência / Administração</option>
                  </SelectInput>
                </LabelInput>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 mb-4">
                <LabelInput label="Cliente" badge={camposAuto.cliente ? 'auto' : null}>
                  <TextInput value={inputs.cliente} onChange={e => { set('cliente', e.target.value); setCamposAuto(p => ({ ...p, cliente: false })); }} />
                </LabelInput>
                <LabelInput label="Localidade" badge={camposAuto.localidade ? 'auto' : null}>
                  <TextInput value={inputs.localidade} onChange={e => { set('localidade', e.target.value); setCamposAuto(p => ({ ...p, localidade: false })); }} />
                </LabelInput>
                <LabelInput label="País" badge={camposAuto.pais ? 'auto' : null}>
                  <TextInput value={inputs.pais} onChange={e => { set('pais', e.target.value); setCamposAuto(p => ({ ...p, pais: false })); }} />
                </LabelInput>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <LabelInput label="Abreviação Cliente (mapa)">
                  <TextInput value={inputs.clienteAbrev} onChange={e => set('clienteAbrev', e.target.value)} placeholder={inputs.cliente || 'Ex: Calcosa'} />
                </LabelInput>
                <LabelInput label="Abreviação Localidade (mapa)">
                  <TextInput value={inputs.localidadeAbrev} onChange={e => set('localidadeAbrev', e.target.value)} placeholder={inputs.localidade || inputs.pais || 'Ex: Espanha'} />
                </LabelInput>
              </div>
            </div>

          </Card>
        </InputVariant.Provider>

        {/* ── COLUNA PREVIEW ── */}
        <div>
          {r ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ borderTop: '4px solid #1B3A57' }}>
              {/* Cabeçalho do recibo */}
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3 mb-4 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800">{inputs.nome || '—'}</p>
                  <p className="text-[10px] text-slate-500 font-bold">NIF: {inputs.nif || '—'} · Profissão: {inputs.categoria || '—'}</p>
                  <p className="text-[10px] text-slate-500 font-bold">Vencimento: {eur(n(inputs.vencimentoBase))} · Hora: {eur(r.salarioHora)}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="font-black text-lg text-slate-800">{MESES_PT[parseInt(inputs.mes, 10)] || ''} {inputs.ano}</p>
                </div>
              </div>

              {/* Tabela de linhas */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-1.5 px-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Descrição</th>
                      <th className="text-right py-1.5 px-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Qtd</th>
                      <th className="text-right py-1.5 px-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">V.Unit.</th>
                      <th className="text-right py-1.5 px-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Abonos</th>
                      <th className="text-right py-1.5 px-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Descontos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {/* A001 mantém sempre o valor contratual completo (formato TOConline) */}
                    <ReciboLinha desc="A001 - Vencimento Base" abono={r.salarioHora > 0 ? (mesParcialDados ? mesParcialDados.vencBaseOriginal : n(inputs.vencimentoBase)) : null} />
                    {/* D001 — desconto por dias não trabalhados (linha informativa; não soma em Total Descontos) */}
                    {descontoDiasParcial && (
                      <ReciboLinha desc={`D001 - ${descontoDiasParcial.label}`} qtd={`${descontoDiasParcial.horasNaoTrab}h`} desconto={descontoDiasParcial.valor} />
                    )}
                    <ReciboLinha desc="A002 - Subs. Alimentação" qtd={`${inputs.subsAlimDias}d`} vUnit={n(inputs.subsAlimValorDia)} abono={r.subsAlimTotal} />
                    {r.subsFerias > 0 && <ReciboLinha desc="A004 - Subs. Férias (duodécimos)" abono={r.subsFerias} />}
                    {n(inputs.premios) > 0 && <ReciboLinha desc="A008 - Prémios / Bónus" abono={n(inputs.premios)} />}
                    {n(inputs.he1) > 0 && <ReciboLinha desc="A052 - Trabalho Suplementar 1ª hora" qtd={`${inputs.he1}h`} vUnit={r.valorHe1un} abono={r.valorHe1} />}
                    {n(inputs.he2) > 0 && <ReciboLinha desc="A053 - Trabalho Suplementar seguintes" qtd={`${inputs.he2}h`} vUnit={r.valorHe2un} abono={r.valorHe2} />}
                    {r.subsNatal > 0 && <ReciboLinha desc="A021 - Subs. Natal (duodécimos)" abono={r.subsNatal} />}
                    {ajudasDisplayRecibo > 0 && (
                      <tr className="bg-orange-50">
                        <td className="py-1.5 px-1 border-l-2 border-orange-400 font-bold text-slate-700">A082 - Ajudas de Custo Internacional <span className="text-[9px] text-orange-600 font-black ml-1">NÃO TRIBUTADO</span></td>
                        <td className="py-1.5 px-1 text-right" />
                        <td className="py-1.5 px-1 text-right" />
                        <td className="py-1.5 px-1 text-right font-bold">{eur(ajudasDisplayRecibo)}</td>
                        <td className="py-1.5 px-1 text-right" />
                      </tr>
                    )}
                    <ReciboLinha desc={`T001 - IRS (Incidência ${eur(r.incidenciaSS)} ; Taxa IRS ${((r.irsVencResult?.taxaMarginal ?? r.taxaRegular) * 100).toFixed(1)}% ; Parcela a abater ${eur(r.irsVencResult?.parcelaAbater ?? 0)})`} desconto={r.irsTotal} />
                    <ReciboLinha desc="T003 - Seg. Social (11%)" desconto={r.ssTrabalhador} />
                    {/* Total — soma directa de todas as linhas; D001 cancela-se → Líquido = BrutoAlvo − IRS − SS */}
                    <tr className="border-t-2 border-slate-800 font-black">
                      <td className="py-2 px-1">Total</td>
                      <td className="py-2 px-1" />
                      <td className="py-2 px-1" />
                      <td className="py-2 px-1 text-right">{eur(totalAbonosDisplay)}</td>
                      <td className="py-2 px-1 text-right">{eur(totalDescontosDisplay)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Notas de taxas */}
              <div className="mt-3 bg-slate-50 rounded-xl p-3 text-[10px] text-slate-500 font-bold space-y-0.5">
                <p>IRS — Taxa efetiva (Vencimento e restantes abonos): {eur(r.incidenciaRegular)} · {(r.irsVencResult?.taxaEfetiva ?? r.taxaRegular * 100).toFixed(2)}%</p>
                {r.subsFerias > 0 && <p>IRS — Taxa efetiva (Subsídio de Férias): {(r.irsFeriasResult?.taxaEfetiva ?? r.taxaSubsidios * 100).toFixed(2)}%</p>}
                {r.subsNatal  > 0 && <p>IRS — Taxa efetiva (Subsídio de Natal): {(r.irsNatalResult?.taxaEfetiva ?? r.taxaSubsidios * 100).toFixed(2)}%</p>}
                {(n(inputs.he1) > 0 || n(inputs.he2) > 0) && (
                  <p>Trabalho suplementar: taxa {(r.taxaOvertime * 100).toFixed(2)}% (50% da taxa regular)</p>
                )}
                {r.subsAlimExcedente > 0 && (
                  <p className="text-amber-600">Atenção: subsídio de alimentação excede o limite de isenção ({eur(r.limiteAlim)}/dia) — excedente {eur(r.subsAlimExcedente)} sujeito a IRS/SS.</p>
                )}
              </div>

              {/* Resumo — Líquido = Bruto Alvo − IRS − SS SEMPRE | Total Abonos = Bruto Alvo + D001 (mês parcial) */}
              <div className="mt-3 pt-3 border-t-2 border-slate-800 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Abonos</p>
                    <p className="text-base font-black text-slate-800">{eur(totalAbonosDisplay)}</p>
                    {n(inputs.brutoAlvo) > 0 && (
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        {descontoD001 > 0 ? '= Bruto Alvo + D001' : '= Bruto Alvo'}
                      </p>
                    )}
                  </div>
                  <div className="bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-200">
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Líquido a receber</p>
                    <p className="text-base font-black text-emerald-700">{eur(liquidoDisplay)}</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl px-3 py-1.5 text-[10px] text-slate-500 flex justify-between">
                  <span><span className="font-black">IRS:</span> {eur(r.irsTotal)} · <span className="font-black">SS:</span> {eur(r.ssTrabalhador)}</span>
                  <span><span className="font-black">Custo empresa (c/ TSU 23,75%):</span> {eur(custoEmpDisplay)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 flex flex-col items-center justify-center text-center gap-3 min-h-[200px]" style={{ borderTop: '4px solid #1B3A57' }}>
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <RefreshCw size={22} className="text-slate-400" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-wide">Preencha o vencimento base</p>
              <p className="text-xs font-bold text-slate-300">O preview do recibo aparece aqui</p>
            </div>
          )}
        </div>
      </div>

      {/* ── MAPA DE AJUDAS DE CUSTO ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ borderTop: '4px solid #EB8D00' }}>
        <div className="flex items-center justify-between mb-5">
          <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#EB8D00' }}>Mapa de Ajudas de Custo</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setMapaRows([]); setAutoFillInfo(null); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              title="Limpar mapa"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={() => addRow()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black text-slate-500 hover:bg-slate-100 transition-all"
            >
              <Plus size={12} /> Linha
            </button>
            <button
              onClick={gerarMapasAjudasPDF}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black hover:bg-slate-100 transition-all"
              style={{ color: '#869AAF' }}
              title="PDF com todos os trabalhadores"
            >
              <Download size={12} /> Todos
            </button>
            {mapaRows.length > 0 && (
              <button
                onClick={gerarPDF}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black text-white transition-all"
                style={{ background: '#EB8D00' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#c97700'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#EB8D00'; }}
              >
                <Download size={12} /> PDF
              </button>
            )}
          </div>
        </div>

        <HistoricoDeslocacao
          supabase={supabase}
          workers={workers}
          mesStr={mesStr}
          setMapa={setMapa}
          dataInicioInputRef={dataInicioInputRef}
          selectedWorkerId={selectedWorkerId}
        />

        {/* Toolbar de preenchimento automático */}
        <div className="flex gap-3 flex-wrap items-end mb-4 pb-4 border-b border-slate-100">
          <LabelInput label="Data de início" badge={!mapa.dataInicio ? 'Auto' : null}>
            <input
              ref={dataInicioInputRef}
              type="date"
              value={mapa.dataInicio}
              onChange={e => setMapa(p => ({ ...p, dataInicio: e.target.value }))}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-[#1B3A57] focus:ring-2 focus:ring-[#1B3A57]/10 lowercase"
            />
          </LabelInput>
          <LabelInput label="Hora partida">
            <input
              type="time"
              value={mapa.horaPartida}
              onChange={e => setMapa(p => ({ ...p, horaPartida: e.target.value }))}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-[#1B3A57] focus:ring-2 focus:ring-[#1B3A57]/10 lowercase"
            />
          </LabelInput>
          <LabelInput label="Hora chegada">
            <input
              type="time"
              value={mapa.horaChegada}
              onChange={e => setMapa(p => ({ ...p, horaChegada: e.target.value }))}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-[#1B3A57] focus:ring-2 focus:ring-[#1B3A57]/10 lowercase"
            />
          </LabelInput>
          <LabelInput label="Complementar via">
            <SelectInput
              value={complementMethod}
              onChange={e => setComplementMethod(e.target.value)}
            >
              <option value="A008">A008 — Prémios/Bónus</option>
              <option value="he1">HE 1ª hora</option>
              <option value="he2">HE seguintes</option>
              <option value="aleatorio">Aleatório (A008)</option>
            </SelectInput>
          </LabelInput>
          <button
            onClick={autoFill}
            disabled={!r || r.ajudaCustoNecessaria <= 0 || n(inputs.vdl) <= 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#1B3A57' }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#142d45'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1B3A57'; }}
          >
            <RefreshCw size={12} /> Preencher automaticamente
          </button>
        </div>

        {/* Tabela do mapa */}
        {mapaRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#EEF1F5] border-b border-[#E3E7EC]">
                  {['Dia', 'Serviço', 'Cliente', 'Localidade', 'Território', 'Tipo', 'Hora', '%', 'Valor', ''].map(h => (
                    <th key={h} className="px-2 py-2 text-left text-[10px] font-black uppercase tracking-wider text-[#869AAF] first:rounded-tl-xl last:rounded-tr-xl">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mapaRows.map(row => {
                  const limite = row.territorio === 'Nacional' ? LIMITES.ajudaNacional : n(inputs.vdl);
                  const valor = limite * (row.pct / 100);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-1 py-1">
                        <input type="date" value={row.dia} onChange={e => updateRow(row.id, 'dia', e.target.value)}
                          className="w-full border border-transparent rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none hover:border-slate-200 focus:border-[#1B3A57]" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="text" value={row.servico} onChange={e => updateRow(row.id, 'servico', e.target.value)}
                          className="w-full border border-transparent rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none hover:border-slate-200 focus:border-[#1B3A57]" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="text" value={row.cliente} onChange={e => updateRow(row.id, 'cliente', e.target.value)}
                          className="w-full border border-transparent rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none hover:border-slate-200 focus:border-[#1B3A57]" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="text" value={row.localidade} onChange={e => updateRow(row.id, 'localidade', e.target.value)}
                          className="w-full border border-transparent rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none hover:border-slate-200 focus:border-[#1B3A57]" />
                      </td>
                      <td className="px-1 py-1">
                        <select value={row.territorio} onChange={e => updateRow(row.id, 'territorio', e.target.value)}
                          className="w-full border border-transparent rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none hover:border-slate-200 focus:border-[#1B3A57]">
                          <option value="Internacional">Internacional</option>
                          <option value="Nacional">Nacional</option>
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <select
                          value={row.tipo}
                          onChange={e => updateRow(row.id, 'tipo', e.target.value)}
                          style={{
                            border: 'none', outline: 'none', borderRadius: 20,
                            padding: '3px 10px',
                            fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
                            letterSpacing: '.04em', cursor: 'pointer', appearance: 'none',
                            ...(row.tipo === 'Partida'    ? { background: '#dce6f0', color: '#1B3A57' }
                              : row.tipo === 'Chegada'    ? { background: '#fef0d5', color: '#c57800' }
                              :                            { background: '#edf0f3', color: '#6B7A8D' })
                          }}
                        >
                          <option value="Partida">Partida</option>
                          <option value="Consecutivo">Consecutivo</option>
                          <option value="Chegada">Chegada</option>
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <input type="time" value={row.hora} onChange={e => updateRow(row.id, 'hora', e.target.value)}
                          className="w-full border border-transparent rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none hover:border-slate-200 focus:border-[#1B3A57]" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" value={row.pct} min="0" max="100" step="5"
                          onChange={e => updateRow(row.id, 'pct', parseFloat(e.target.value) || 0)}
                          className="w-16 border border-transparent rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none hover:border-slate-200 focus:border-[#1B3A57]" />
                      </td>
                      <td className="px-2 py-1 text-right font-black text-[#1B3A57] tabular-nums">{eur(valor)}</td>
                      <td className="px-1 py-1 text-center">
                        <button onClick={() => removeRow(row.id)} className="p-1 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all">
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center text-slate-400">
            <p className="text-xs font-bold">Sem linhas — use "Preencher automaticamente" ou adicione manualmente.</p>
          </div>
        )}

        {/* Totais do mapa */}
        {mapaRows.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-baseline gap-4 flex-wrap text-sm">
            <span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide mr-1.5">Total</span>
              <span className="font-black text-slate-800">{eur(mapaTotal)}</span>
            </span>
            {r && (
              <>
                <span className="text-slate-300 select-none">·</span>
                <span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide mr-1.5">Necessário</span>
                  <span className="font-black text-slate-800">{eur(r.ajudaCustoNecessaria)}</span>
                </span>
                <span className="text-slate-300 select-none">·</span>
                <span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide mr-1.5">Dif.</span>
                  <span className={`font-black ${Math.abs(mapaDiff) < 0.5 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {mapaDiff >= 0 ? '+' : ''}{eur(mapaDiff)}
                  </span>
                </span>
              </>
            )}
          </div>
        )}
        {mapaDesviado && (
          <div className="mt-2 px-4 py-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-500" />
            <div>
              <p className="font-black uppercase tracking-wide mb-0.5">Mapa dessincronizado — exportação bloqueada</p>
              <p className="font-semibold">
                O A082 do mapa ({eur(mapaLiqLive)}) difere do necessário no recibo ({r ? eur(r.ajudaCustoNecessaria) : '—'}).
                Clique em <strong>Preencher automaticamente</strong> para ressincronizar antes de exportar o recibo.
              </p>
            </div>
          </div>
        )}
      </div>
      </div>))}

      {/* Rodapé de compliance */}
      <p className="text-center text-[10px] text-slate-400 font-bold leading-none py-0.5">
        <AlertTriangle size={10} className="inline mr-1 text-amber-400" />
        Estimativa não oficial · IRS 2026 (Desp. 233-A/2026) · TSU em vigor · Confirme sempre no TOConline · Ajudas de custo isentas só com deslocações documentadas
      </p>
    </div>
  );
}

function ReciboLinha({ desc, qtd, vUnit, abono, desconto }) {
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="py-1.5 px-1 text-slate-700 font-bold">{desc}</td>
      <td className="py-1.5 px-1 text-right text-slate-500">{qtd || ''}</td>
      <td className="py-1.5 px-1 text-right text-slate-500">{vUnit != null ? eur(vUnit) : ''}</td>
      <td className="py-1.5 px-1 text-right font-bold text-slate-800">{abono != null ? eur(abono) : ''}</td>
      <td className="py-1.5 px-1 text-right font-bold text-rose-600">{desconto != null ? eur(desconto) : ''}</td>
    </tr>
  );
}


function CopiarLinkBtn({ mesStr }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = () => {
    const url = `${window.location.origin}/partilha/resumo?mes=${mesStr}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  };
  return (
    <button
      onClick={copiar}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase transition-all border shadow-sm ${copiado ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800'}`}
      title="Copiar link partilhável para o contabilista"
    >
      {copiado ? (
        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copiado!</>
      ) : (
        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Partilhar</>
      )}
    </button>
  );
}

const LS_COLS    = 'resumo_visible_cols';
const LS_WORKERS = 'resumo_selected_workers';
const LS_OBS     = 'resumo_observacoes';

function loadFromLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

function ExpandCell({ text, maxWidth }) {
  const ref  = useRef(null);
  const [rect, setRect] = useState(null);
  const handleEnter = () => {
    if (ref.current && ref.current.scrollWidth > ref.current.clientWidth + 1)
      setRect(ref.current.getBoundingClientRect());
  };
  return (
    <div
      ref={ref}
      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: maxWidth || 'none' }}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setRect(null)}
    >
      {text}
      {rect && createPortal(
        <div style={{
          position: 'fixed', top: rect.top, left: rect.left, height: rect.height,
          zIndex: 9999, background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px',
          padding: '0 10px', whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,.18)',
          fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center',
          pointerEvents: 'none', color: '#1e293b', minWidth: rect.width,
        }}>
          {text}
        </div>,
        document.body
      )}
    </div>
  );
}

function ResumoMensalTable({ rows, mesLabel, mesStr, onBack, onNavMes }) {
  const { supabase } = useApp();
  const { ref: tableScrollRef, dragProps } = useDragScroll();

  const [visibleCols, setVisibleColsRaw] = useState(() =>
    new Set(loadFromLS(LS_COLS, RESUMO_COLS.map((_, i) => i)))
  );
  const [selectedWorkers, setSelectedWorkersRaw] = useState(() =>
    new Set(loadFromLS(LS_WORKERS, []))
  );
  const [observacoes, setObservacoes] = useState(() => loadFromLS(LS_OBS, {}));
  const [completos, setCompletos] = useState({});
  const [ajustes,   setAjustes]   = useState({});
  const [showColPicker, setShowColPicker] = useState(false);
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'ok' | 'error'
  const [dbError,    setDbError]    = useState(null);
  const [copiedCell, setCopiedCell] = useState(null);

  const copyCell = (ri, ci, text) => {
    if (text === '' || text == null || !navigator.clipboard) return;
    navigator.clipboard.writeText(String(text)).then(() => {
      const key = `${ri}-${ci}`;
      setCopiedCell(key);
      setTimeout(() => setCopiedCell(prev => (prev === key ? null : prev)), 900);
    }).catch(() => {});
  };
  const handleCellClick = (e, ri, ci, text) => {
    if (e.target.closest('input, button')) return;
    copyCell(ri, ci, text);
  };

  // Verificar se a BD está configurada corretamente
  useEffect(() => {
    if (!supabase) return;
    supabase.from('resumo_observacoes').select('completo, ajuste_bruto').limit(1)
      .then(({ error }) => {
        if (error) setDbError(error.message);
        else setDbError(null);
      });
  }, [supabase]);

  // Sincronizar colunas visíveis com Supabase (fonte de verdade partilhada)
  useEffect(() => {
    if (!supabase) return;

    const parseValor = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
      return null;
    };

    supabase.from('resumo_config').select('valor').eq('chave', 'visible_cols').maybeSingle()
      .then(({ data }) => {
        const arr = parseValor(data?.valor);
        if (arr) {
          const cols = new Set(arr);
          setVisibleColsRaw(cols);
          localStorage.setItem(LS_COLS, JSON.stringify([...cols]));
        } else {
          // Nenhuma configuração guardada ainda — escrever estado actual
          supabase.from('resumo_config').upsert(
            { chave: 'visible_cols', valor: [...visibleCols], updated_at: new Date().toISOString() },
            { onConflict: 'chave' }
          );
        }
      });

    const ch = supabase.channel('resumo_config_cols')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'resumo_config',
      }, ({ new: row }) => {
        if (row?.chave !== 'visible_cols') return;
        const arr = parseValor(row?.valor);
        if (arr) {
          const cols = new Set(arr);
          setVisibleColsRaw(cols);
          localStorage.setItem(LS_COLS, JSON.stringify([...cols]));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [supabase]);

  // Carregar do Supabase e subscrever real-time ao mudar o mês
  useEffect(() => {
    if (!supabase || !mesStr) return;

    supabase.from('resumo_observacoes').select('worker_id, observacao, completo, ajuste_bruto').eq('mes', mesStr)
      .then(({ data }) => {
        if (!data) return;
        const obsMap = {}, compMap = {}, ajMap = {};
        data.forEach(r => {
          obsMap[r.worker_id]  = r.observacao;
          compMap[r.worker_id] = !!r.completo;
          if (r.ajuste_bruto)  ajMap[r.worker_id] = parseFloat(r.ajuste_bruto) || 0;
        });
        setObservacoes(prev => {
          const merged = { ...prev, ...obsMap };
          localStorage.setItem(LS_OBS, JSON.stringify(merged));
          return merged;
        });
        setCompletos(prev => ({ ...prev, ...compMap }));
        setAjustes(prev => ({ ...prev, ...ajMap }));
      });

    const channel = supabase
      .channel(`resumo_obs_${mesStr}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'resumo_observacoes',
        filter: `mes=eq.${mesStr}`,
      }, ({ new: row, eventType }) => {
        if (!row?.worker_id) return;
        setObservacoes(prev => {
          const next = eventType === 'DELETE'
            ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== row.worker_id))
            : { ...prev, [row.worker_id]: row.observacao || '' };
          localStorage.setItem(LS_OBS, JSON.stringify(next));
          return next;
        });
        if (eventType !== 'DELETE') {
          setCompletos(prev => ({ ...prev, [row.worker_id]: !!row.completo }));
          setAjustes(prev => ({ ...prev, [row.worker_id]: parseFloat(row.ajuste_bruto) || 0 }));
        } else {
          setCompletos(prev => { const n = { ...prev }; delete n[row.worker_id]; return n; });
          setAjustes(prev =>   { const n = { ...prev }; delete n[row.worker_id]; return n; });
        }
      })
      .subscribe();

    // Polling como fallback quando Realtime não dispara
    const syncData = () =>
      supabase.from('resumo_observacoes')
        .select('worker_id, observacao, completo, ajuste_bruto').eq('mes', mesStr)
        .then(({ data }) => {
          if (!data) return;
          const obsMap = {}, compMap = {}, ajMap = {};
          data.forEach(r => {
            obsMap[r.worker_id]  = r.observacao || '';
            compMap[r.worker_id] = !!r.completo;
            ajMap[r.worker_id]   = parseFloat(r.ajuste_bruto) || 0;
          });
          setObservacoes(prev => {
            const merged = { ...prev, ...obsMap };
            localStorage.setItem(LS_OBS, JSON.stringify(merged));
            return merged;
          });
          setCompletos(prev => ({ ...prev, ...compMap }));
          setAjustes(prev =>   ({ ...prev, ...ajMap }));
        });
    const poll = setInterval(syncData, 4000);

    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [supabase, mesStr]);

  const setVisibleCols = (val) => {
    const next = typeof val === 'function' ? val(visibleCols) : val;
    setVisibleColsRaw(next);
    localStorage.setItem(LS_COLS, JSON.stringify([...next]));
    if (supabase) {
      supabase.from('resumo_config').upsert(
        { chave: 'visible_cols', valor: [...next], updated_at: new Date().toISOString() },
        { onConflict: 'chave' }
      ).then(({ error }) => {
        if (error) console.error('[resumo_config] erro ao guardar colunas:', error.message);
      });
    }
  };

  const setSelectedWorkers = (val) => {
    const next = typeof val === 'function' ? val(selectedWorkers) : val;
    setSelectedWorkersRaw(next);
    localStorage.setItem(LS_WORKERS, JSON.stringify([...next]));
  };

  const upsertObs = (workerId, patch) => {
    if (!supabase || !workerId || !mesStr) return;
    setSaveStatus('saving');
    supabase.from('resumo_observacoes').upsert(
      {
        worker_id:    workerId,
        mes:          mesStr,
        observacao:   observacoes[workerId] || '',
        completo:     completos[workerId]   || false,
        ajuste_bruto: ajustes[workerId]     || 0,
        updated_at:   new Date().toISOString(),
        ...patch,
      },
      { onConflict: 'worker_id,mes' }
    ).then(({ error }) => {
      if (error) {
        console.error('[resumo_obs] upsert erro:', error);
        setDbError(error.message);
        setSaveStatus('error');
      } else {
        setDbError(null);
        setSaveStatus('ok');
      }
      setTimeout(() => setSaveStatus(null), 2500);
    });
  };

  const updateObs = (workerId, valor) => {
    setObservacoes(prev => {
      const next = { ...prev, [workerId]: valor };
      localStorage.setItem(LS_OBS, JSON.stringify(next));
      return next;
    });
    upsertObs(workerId, { observacao: valor });
  };

  const updateCompleto = (workerId, valor) => {
    setCompletos(prev => ({ ...prev, [workerId]: valor }));
    upsertObs(workerId, { completo: valor });
  };

  const updateAjuste = (workerId, valor) => {
    const v = parseFloat(valor) || 0;
    setAjustes(prev => ({ ...prev, [workerId]: v }));
    upsertObs(workerId, { ajuste_bruto: v });
  };

  const toggleCol = (ci) => {
    if (ci === 0) return;
    setVisibleCols(prev => {
      const next = new Set(prev);
      next.has(ci) ? next.delete(ci) : next.add(ci);
      return next;
    });
  };

  const toggleWorker = (nome) => {
    setSelectedWorkers(prev => {
      const next = new Set(prev);
      next.has(nome) ? next.delete(nome) : next.add(nome);
      return next;
    });
  };

  function exportXLS() {
    const style = (bg, color, bold, highlight = false) =>
      `background:${highlight ? '#ECFDF5' : bg};color:${highlight ? '#065F46' : color};font-weight:${bold || highlight ? 'bold' : 'normal'};padding:7px 10px;border:1px solid ${highlight ? '#6EE7B7' : '#E2E8F0'};white-space:nowrap;text-align:center${highlight ? ';font-size:12px' : ''}`;

    const hdrRow = `<tr>${activeCols.map(({ col }) =>
      `<td style="${style('#0F1F3D', 'white', true, col.highlight)}">${col.label}</td>`
    ).join('')}</tr>`;

    const bodyRows = displayRows.map((row, ri) =>
      `<tr>${activeCols.map(({ col }) =>
        `<td style="${style(ri % 2 === 0 ? '#ffffff' : '#F8FAFC', '#1E293B', false, col.highlight)}">${row[col.key] ?? ''}</td>`
      ).join('')}</tr>`
    ).join('');

    const totRow = `<tr>${activeCols.map(({ col }, ai) => {
      const val = col.sumKey ? displayRows.reduce((s, r) => s + (r[col.sumKey] || 0), 0) : null;
      return `<td style="${style('#EEF2FF', '#4F46E5', true, col.highlight)}">${ai === 0 ? 'TOTAIS' : val !== null ? val.toFixed(2) : ''}</td>`;
    }).join('')}</tr>`;

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/></head><body>
<h2 style="font-family:Arial;color:#0F1F3D">RESUMO MENSAL — ${mesLabel.toUpperCase()}</h2>
<table border="1">${hdrRow}${bodyRows}${totRow}</table>
</body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `resumo-mensal-${mesLabel.toLowerCase().replace(/\s+/g, '-')}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeCols = RESUMO_COLS.map((col, ci) => ({ col, ci })).filter(({ ci }) => visibleCols.has(ci));

  // Set vazio = todos; Set com nomes = apenas os selecionados
  const filteredRows = selectedWorkers.size > 0 ? rows.filter(r => selectedWorkers.has(r.nome)) : rows;

  // Injeta observação, completo e ajuste; recalcula bruto
  const eur2pub = v => (isNaN(v) ? 0 : v).toFixed(2);
  const displayRows = filteredRows.map(r => {
    const ajusteVal    = ajustes[r.workerId] || 0;
    const brutoEfetivo = r._brutoNum + ajusteVal;
    return {
      ...r,
      observacao:  observacoes[r.workerId] || '',
      completo:    completos[r.workerId]   || false,
      ajuste:      ajusteVal,
      _ajusteNum:  ajusteVal,
      brutoAlvo:   eur2pub(brutoEfetivo),
      _brutoNum:   brutoEfetivo,
    };
  });

  const totals = activeCols.map(({ col }) =>
    col.sumKey ? displayRows.reduce((s, r) => s + (r[col.sumKey] || 0), 0) : null
  );

  // Agrupamentos de colunas para cabeçalho duplo
  const groupSpans = activeCols.reduce((acc, { col }) => {
    const g = col.group || 'obs';
    const last = acc[acc.length - 1];
    if (last && last.group === g) { last.span++; }
    else { acc.push({ group: g, span: 1 }); }
    return acc;
  }, []);

  // Helpers de destaque por tipo de coluna
  // 4 categorias reais de coluna-total (Total Abonos/Líquido/Custo Empresa/Ordenado Bruto) — mantidas
  // com cores distintas dentro da paleta categórica já usada nas tags de documentos (sky/emerald/rose),
  // trocando só 'emerald' por teal para não colidir com 'green' (ambas cairiam no mesmo tom de verde).
  const hlHead = h => ({ blue: 'bg-sky-700 text-white', green: 'bg-emerald-700 text-white', rose: 'bg-rose-700 text-white', emerald: 'bg-teal-700 text-white' }[h] || '');
  const hlCell = h => ({ blue: 'bg-sky-50 text-sky-900 border-x border-sky-100', green: 'bg-emerald-50 text-emerald-900 border-x border-emerald-100', rose: 'bg-rose-50 text-rose-900 border-x border-rose-100', emerald: 'bg-teal-50 text-teal-900 border-x border-teal-100' }[h] || '');
  const hlFoot = h => ({ blue: 'bg-sky-200 text-sky-900 border-x border-sky-300', green: 'bg-emerald-200 text-emerald-900 border-x border-emerald-300', rose: 'bg-rose-200 text-rose-900 border-x border-rose-300', emerald: 'bg-teal-200 text-teal-900 border-x border-teal-300' }[h] || '');
  const tdAlign = col => col?.align === 'right' ? 'text-right' : col?.align === 'left' ? 'text-left' : 'text-center';

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      {/* Banner de erro de BD */}
      {dbError && (
        <div className="flex-shrink-0 p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-800">
          <strong>⚠️ Erro na base de dados:</strong> {dbError}
          <br />Execute este SQL no Supabase → SQL Editor:
          <pre className="mt-1 bg-red-100 rounded p-2 text-[10px] overflow-x-auto whitespace-pre-wrap select-all">
{`DROP TABLE IF EXISTS resumo_observacoes;
CREATE TABLE resumo_observacoes (
  worker_id    TEXT        NOT NULL,
  mes          TEXT        NOT NULL,
  observacao   TEXT        NOT NULL DEFAULT '',
  completo     BOOLEAN     NOT NULL DEFAULT FALSE,
  ajuste_bruto NUMERIC     DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (worker_id, mes)
);
ALTER TABLE resumo_observacoes DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE resumo_observacoes;`}
          </pre>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-black text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all shrink-0"
          >
            <ChevronLeft size={13} /> Calculadora
          </button>
        )}
        {onBack && <div className="w-px h-4 bg-slate-200 shrink-0" />}
        <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide whitespace-nowrap">Resumo Mensal</h3>
        {onNavMes && (
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-0.5">
            <button onClick={() => onNavMes(-1)} className="p-1 rounded-lg hover:bg-white transition-colors">
              <ChevronLeft size={13} className="text-slate-500" />
            </button>
            <span className="px-2 text-xs font-black text-slate-700 min-w-[110px] text-center">{mesLabel}</span>
            <button onClick={() => onNavMes(1)} className="p-1 rounded-lg hover:bg-white transition-colors">
              <ChevronRight size={13} className="text-slate-500" />
            </button>
          </div>
        )}
        {rows.length > 0 && (
          <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
            {filteredRows.length} {filteredRows.length !== rows.length ? `de ${rows.length} ` : ''}trabalhadores
          </span>
        )}
        {saveStatus === 'saving' && <span className="text-[10px] text-slate-400 animate-pulse">A guardar…</span>}
        {saveStatus === 'ok'     && <span className="text-[10px] text-emerald-600 font-black">✓ Guardado</span>}
        {saveStatus === 'error'  && <span className="text-[10px] text-red-600 font-black">✗ Erro ao guardar</span>}

        <div className="ml-auto flex items-center gap-2">
          {/* Seletor de trabalhadores */}
          <div className="relative">
            <button
              onClick={() => { setShowWorkerPicker(p => !p); setShowColPicker(false); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase transition-all border shadow-sm ${showWorkerPicker ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Trabalhadores
              {selectedWorkers.size > 0 && (
                <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md text-[9px] font-black">
                  {selectedWorkers.size}/{rows.length}
                </span>
              )}
            </button>

            {showWorkerPicker && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-72">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Trabalhadores visíveis</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedWorkers(new Set())}
                      className="text-[10px] font-black text-[#1B3A57] hover:opacity-70 uppercase tracking-wide"
                    >
                      Todos
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      onClick={() => setSelectedWorkers(new Set(rows.map(r => r.nome)))}
                      className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-wide"
                    >
                      Nenhum
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
                  {rows.map(r => (
                    <label
                      key={r.nome}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedWorkers.size === 0 || selectedWorkers.has(r.nome)}
                        onChange={() => {
                          if (selectedWorkers.size === 0) {
                            // primeiro clique a desseleccionar: mantém todos menos este
                            setSelectedWorkers(new Set(rows.map(x => x.nome).filter(n => n !== r.nome)));
                          } else {
                            toggleWorker(r.nome);
                          }
                        }}
                        className="w-3.5 h-3.5 accent-slate-700 shrink-0"
                      />
                      <span className="text-[11px] font-bold text-slate-700 truncate">{r.nome}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => setShowWorkerPicker(false)}
                  className="mt-3 w-full py-1.5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-wide"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>

          {/* Seletor de colunas */}
          <div className="relative">
            <button
              onClick={() => { setShowColPicker(p => !p); setShowWorkerPicker(false); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase transition-all border shadow-sm ${showColPicker ? 'text-white' : 'bg-white text-slate-600 border-slate-200 hover:border-[#869AAF] hover:text-[#1B3A57]'}`}
              style={showColPicker ? { backgroundColor: '#1B3A57', borderColor: '#1B3A57' } : {}}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              Colunas
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md text-[9px] font-black">
                {visibleCols.size}/{RESUMO_COLS.length}
              </span>
            </button>

            {showColPicker && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-[520px]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Colunas visíveis</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVisibleCols(new Set(RESUMO_COLS.map((_, i) => i)))}
                      className="text-[10px] font-black text-[#1B3A57] hover:opacity-70 uppercase tracking-wide"
                    >
                      Todas
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      onClick={() => setVisibleCols(new Set([0]))}
                      className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-wide"
                    >
                      Mínimo
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {RESUMO_COLS.map((col, ci) => (
                    <label
                      key={ci}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${ci === 0 ? 'opacity-50 cursor-default' : 'hover:bg-slate-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={visibleCols.has(ci)}
                        onChange={() => toggleCol(ci)}
                        disabled={ci === 0}
                        className="w-3.5 h-3.5 accent-[#1B3A57] shrink-0"
                      />
                      <span className={`text-[11px] font-bold truncate ${col.highlight ? 'text-emerald-700' : 'text-slate-600'}`}>
                        {col.label}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => setShowColPicker(false)}
                  className="mt-3 w-full py-1.5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-wide"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>

          {/* Copiar link partilhável */}
          <CopiarLinkBtn mesStr={mesStr} />

          {/* Exportar XLS */}
          <button
            onClick={exportXLS}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase bg-emerald-600 text-white hover:bg-emerald-700 transition-all border border-emerald-600 shadow-sm"
            title="Exportar tabela actual como folha de cálculo"
          >
            <FileSpreadsheet size={13} /> XLS
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 bg-white rounded-2xl border border-slate-100">
          <p className="text-sm font-black uppercase tracking-wide">Sem trabalhadores activos com vencimento base</p>
        </div>
      ) : (
        <div
          ref={tableScrollRef}
          className="scroll-marca flex-1 min-h-0 overflow-auto rounded-2xl border border-slate-200 shadow-sm"
          {...dragProps}
        >
          <table
            className="border-collapse"
            style={{ tableLayout: 'auto', width: '100%', fontSize: '11px' }}
          >
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              {/* Linha de grupos */}
              <tr>
                {activeCols.map(({ col, ci }, ai) => {
                  const g = col.group || 'obs';
                  const def = GROUP_DEFS[g] || GROUP_DEFS.obs;
                  const isFirstInGroup = ai === 0 || (activeCols[ai - 1]?.col.group || 'obs') !== g;
                  const isLastInGroup  = ai === activeCols.length - 1 || (activeCols[ai + 1]?.col.group || 'obs') !== g;
                  return (
                    <th
                      key={ci}
                      className="text-[8px] font-black uppercase tracking-widest py-1"
                      style={{
                        background: def.bg, color: def.text,
                        textAlign: isFirstInGroup ? 'left' : 'center',
                        paddingLeft: isFirstInGroup ? '8px' : '0',
                        borderRight: isLastInGroup && def.border ? `2px solid ${def.border}` : isLastInGroup ? '1px solid #1e293b' : 'none',
                        whiteSpace: 'nowrap',
                        minWidth: col.key === 'nome' ? undefined : `${col.w || 64}px`,
                        ...(ai === 0 ? { position: 'sticky', left: 0, zIndex: 12 } : col.key === 'completo' ? { position: 'sticky', right: 0, zIndex: 12 } : {}),
                      }}
                    >
                      {isFirstInGroup ? def.label : ''}
                    </th>
                  );
                })}
              </tr>
              {/* Linha de nomes de colunas */}
              <tr>
                {activeCols.map(({ col, ci }, ai) => {
                  const isLastInGroup = ai === activeCols.length - 1 || (activeCols[ai + 1]?.col.group || 'obs') !== (col.group || 'obs');
                  const def = GROUP_DEFS[col.group || 'obs'] || GROUP_DEFS.obs;
                  return (
                    <th
                      key={ci}
                      className={`px-1.5 py-2 text-[9px] font-black uppercase tracking-wide text-center leading-tight ${col.highlight ? hlHead(col.highlight) : ''}`}
                      style={{
                        background: col.highlight ? undefined : def.bg,
                        color: col.highlight ? undefined : def.text,
                        whiteSpace: 'nowrap',
                        minWidth: col.key === 'nome' ? undefined : `${col.w || 64}px`,
                        borderRight: isLastInGroup && def.border ? `2px solid ${def.border}` : isLastInGroup ? '1px solid #1e293b' : undefined,
                        ...(ai === 0 ? { position: 'sticky', left: 0, zIndex: 12 } : col.key === 'completo' ? { position: 'sticky', right: 0, zIndex: 12 } : {}),
                      }}
                    >
                      {col.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, ri) => (
                <tr
                  key={ri}
                  className={`group/row transition-colors ${row.completo ? 'bg-emerald-50 hover:bg-emerald-100' : ri % 2 === 0 ? 'bg-white hover:bg-slate-100' : 'bg-slate-50 hover:bg-slate-100'}`}
                >
                  {activeCols.map(({ col, ci }, ai) => {
                    const isLastInGroup = ai === activeCols.length - 1 || (activeCols[ai + 1]?.col.group || 'obs') !== (col.group || 'obs');
                    const def = GROUP_DEFS[col.group || 'obs'] || GROUP_DEFS.obs;
                    const stickyBg = row.completo ? '#ecfdf5' : ri % 2 === 0 ? '#ffffff' : '#f8fafc';
                    const isNome     = col.key === 'nome';
                    const isCompleto = col.key === 'completo';
                    const cellKey = `${ri}-${ci}`;
                    const isCopied = copiedCell === cellKey;
                    const canCopy  = col.tipo !== 'toggle';
                    return (
                      <td
                        key={ci}
                        onClick={canCopy ? e => handleCellClick(e, ri, ci, row[col.key]) : undefined}
                        title={canCopy ? (isCopied ? 'Copiado!' : 'Clique para copiar') : undefined}
                        className={`px-2 py-0.5 font-bold ${col.highlight ? hlCell(col.highlight) : 'text-slate-700'} ${canCopy ? 'cursor-pointer' : ''}`}
                        style={{
                          position: 'relative',
                          whiteSpace: 'nowrap',
                          minWidth: isNome ? undefined : `${col.w || 64}px`,
                          ...(ai === 0 ? { position: 'sticky', left: 0, zIndex: 5, background: stickyBg, boxShadow: '2px 0 6px -2px rgba(0,0,0,.10)' } : {}),
                          ...(isCompleto ? { position: 'sticky', right: 0, zIndex: 5, background: stickyBg, boxShadow: '-2px 0 4px -2px rgba(0,0,0,.08)' } : {}),
                          ...(isLastInGroup && def.border ? { borderRight: `2px solid ${def.border}33` } : {}),
                          ...(isCopied ? { background: 'rgba(16,185,129,0.22)' } : {}),
                        }}
                      >
                        {isCopied && (
                          <span
                            className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wide shadow-md pointer-events-none whitespace-nowrap"
                            style={{ zIndex: 20 }}
                          >
                            Copiado!
                          </span>
                        )}
                        {col.tipo === 'ajuste' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={ajustes[row.workerId] ?? ''}
                            onChange={e => updateAjuste(row.workerId, e.target.value)}
                            placeholder="0"
                            className="w-full bg-transparent outline-none text-center text-xs font-bold placeholder:text-slate-300 px-1 py-1 rounded-lg hover:bg-amber-50 focus:bg-white focus:ring-2 focus:ring-amber-200 transition-all"
                            style={{ color: (ajustes[row.workerId] || 0) < 0 ? '#dc2626' : (ajustes[row.workerId] || 0) > 0 ? '#16a34a' : '#64748b' }}
                          />
                        ) : col.tipo === 'toggle' ? (
                          <div className="flex justify-center px-2">
                            <button
                              onClick={() => updateCompleto(row.workerId, !row.completo)}
                              title={row.completo ? 'Desmarcar como completo' : 'Marcar como completo'}
                              className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                                row.completo
                                  ? 'bg-emerald-500 text-white hover:bg-red-400 shadow-sm'
                                  : 'bg-white border-2 border-slate-300 text-transparent hover:border-emerald-400 hover:text-emerald-400'
                              }`}
                            >
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </button>
                          </div>
                        ) : col.editable ? (
                          <input
                            type="text"
                            value={observacoes[row.workerId] || ''}
                            onChange={e => updateObs(row.workerId, e.target.value)}
                            placeholder="—"
                            className="w-full min-w-36 bg-transparent outline-none text-center text-xs font-bold text-slate-700 placeholder:text-slate-300 px-2 py-1 rounded-lg hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-[#1B3A57]/20 transition-all"
                          />
                        ) : isNome ? (
                          <span>{row[col.key]}</span>
                        ) : col.key === 'totalAbonos' && row._brutoNum > 0 ? (() => {
                          const diff = Math.round((row._brutoNum - row._abonosNum) * 100) / 100;
                          return (
                            <span className={`block px-2 ${tdAlign(col)}`}>
                              {row[col.key]}
                              {Math.abs(diff) >= 0.005 && (
                                <span className={`block text-[9px] font-bold leading-tight ${diff <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                </span>
                              )}
                            </span>
                          );
                        })() : (
                          <ExpandCell text={String(row[col.key] ?? '')} maxWidth={`${col.w || 84}px`} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2" style={{ borderColor: 'rgba(27,58,87,0.3)', position: 'sticky', bottom: 0, zIndex: 9 }}>
                {activeCols.map(({ col, ci }, ai) => {
                  const isLastInGroup = ai === activeCols.length - 1 || (activeCols[ai + 1]?.col.group || 'obs') !== (col.group || 'obs');
                  const def = GROUP_DEFS[col.group || 'obs'] || GROUP_DEFS.obs;
                  return (
                    <td
                      key={ci}
                      className={`px-2 py-2.5 text-[11px] font-black whitespace-nowrap text-center ${col.highlight ? hlFoot(col.highlight) : 'bg-slate-100'}`}
                      style={{
                        ...(col.highlight ? {} : { color: '#1B3A57' }),
                        ...(ai === 0 ? { position: 'sticky', left: 0, zIndex: 5, background: '#eef2ff', color: '#4338ca' } : {}),
                        ...(col.key === 'completo' ? { position: 'sticky', right: 0, zIndex: 5, background: '#eef2ff' } : {}),
                        ...(isLastInGroup && def.border ? { borderRight: `2px solid ${def.border}` } : {}),
                      }}
                    >
                      {ai === 0 ? 'TOTAIS' : col.tipo === 'toggle' ? `${displayRows.filter(r => r.completo).length}/${displayRows.length} ✓` : totals[ai] !== null ? totals[ai].toFixed(2) : ''}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
