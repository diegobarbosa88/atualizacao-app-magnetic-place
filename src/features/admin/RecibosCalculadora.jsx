import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Plus, RefreshCw, Trash2, X } from 'lucide-react';
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
  gerarLinhasMapa,
  eur,
} from '../../lib/payroll/reciboCalculations.js';

const EMPRESA = {
  nome: 'Magnetic Place Unipessoal, Lda',
  morada: 'Rua D. Pedro V n 715 Loja 80, Trofa, Bougado (São Martinho e Santiago)',
  nif: '517379740',
};

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

function n(v) { return parseFloat(v) || 0; }

function LabelInput({ label, children, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">{label}</label>
      {children}
      {hint && <span className="text-[10px] text-slate-400 ml-1">{hint}</span>}
    </div>
  );
}

function TextInput({ value, onChange, type = 'text', readOnly, step, min, max, className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      step={step}
      min={min}
      max={max}
      className={`w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none shadow-sm transition-all
        ${readOnly ? 'bg-slate-50 text-slate-400 cursor-default' : 'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50'}
        ${className}`}
    />
  );
}

function SelectInput({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all lowercase"
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
      <span className="w-6 h-6 rounded-full bg-slate-700 text-white text-[11px] font-black flex items-center justify-center shrink-0">{num}</span>
      <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">{label}</h3>
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

export default function RecibosCalculadora() {
  const { workers, logs, supabase, clients } = useApp();

  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [inputs, setInputs] = useState(INPUT_DEFAULT);
  const [mapa, setMapa] = useState(MAPA_DEFAULT);
  const [mapaRows, setMapaRows] = useState([]);
  const [autoFillInfo, setAutoFillInfo] = useState(null);
  const [workerRateHistory, setWorkerRateHistory] = useState([]);
  const logoRef = useRef(null);
  const [subTab, setSubTab] = useState('calculadora');
  const [contabData, setContabData] = useState([]);
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

  // Sincroniza brutoAlvo ao mudar trabalhador ou mês; não sobrescreve edições manuais quando logs sincronizam
  useEffect(() => {
    if (!selectedWorkerId) return;
    const custo = calcularCustoMesRef.current(selectedWorkerId, inputs.mes, inputs.ano);
    setInputs(prev => ({ ...prev, brutoAlvo: custo > 0 ? custo.toFixed(2) : '' }));
  }, [selectedWorkerId, inputs.mes, inputs.ano]);

  // Sincroniza subsAlimDias com contabilidade_mensal ao mudar trabalhador ou mês
  useEffect(() => {
    if (!selectedWorkerId) return;
    const contabRow = contabData.find(r => r.worker_id === selectedWorkerId);
    if (contabRow?.dias_trabalhados != null) {
      setInputs(prev => ({ ...prev, subsAlimDias: String(contabRow.dias_trabalhados) }));
    }
  }, [selectedWorkerId, inputs.mes, inputs.ano, contabData]);

  const set = useCallback((field, value) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSelectWorker = (e) => {
    const id = e.target.value;
    setSelectedWorkerId(id);
    if (!id) return;
    const w = workers.find(x => x.id === id);
    if (!w) return;

    // Cliente padrão atribuído ao trabalhador
    const clientId = w.defaultClientId || (w.assignedClients || [])[0];
    const client = (clients || []).find(c => c.id === clientId);
    const dc = dadosDeCliente(client);

    setInputs(prev => ({
      ...prev,
      nome: w.name || prev.nome,
      nif: w.nif || prev.nif,
      categoria: w.profissao || prev.categoria,
      nis: w.nis || prev.nis,
      vencimentoBase: w.vencimento_base != null ? String(w.vencimento_base) : prev.vencimentoBase,
      subsAlimValorDia: w.subsidio_alimentacao_dia != null ? String(w.subsidio_alimentacao_dia) : prev.subsAlimValorDia,
      tabelaKey: w.tabela_irs || prev.tabelaKey,
      nDependentes: w.n_dependentes != null ? String(w.n_dependentes) : prev.nDependentes,
      cliente: dc.cliente || prev.cliente,
      localidade: dc.localidade || prev.localidade,
      pais: dc.pais || prev.pais,
      territorio: dc.territorio || prev.territorio,
    }));
  };

  const r = useMemo(() => {
    if (!inputs.vencimentoBase) return null;
    return calcularRecibo({
      vencimentoBase: n(inputs.vencimentoBase),
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
  }, [inputs]);

  // Sincroniza o valor diário legal quando muda o território ou função
  useEffect(() => {
    setInputs(prev => ({
      ...prev,
      vdl: String(valorDiarioLegal(prev.territorio, prev.funcao)),
    }));
  }, [inputs.territorio, inputs.funcao]);

  const mapaTotal = useMemo(() => {
    return mapaRows.reduce((sum, row) => {
      const limite = row.territorio === 'Nacional' ? LIMITES.ajudaNacional : n(inputs.vdl);
      return sum + limite * (row.pct / 100);
    }, 0);
  }, [mapaRows, inputs.vdl]);

  const mapaDiff = r ? mapaTotal - r.ajudaCustoNecessaria : 0;

  // Linhas do Resumo Mensal (mesma lógica do Excel)
  const resumoRows = useMemo(() => {
    const mesNum  = parseInt(inputs.mes, 10);
    const mesStr  = `${inputs.ano}-${String(mesNum).padStart(2, '0')}`;
    const anoNum  = n(inputs.ano);
    const eur2    = v => (isNaN(v) ? 0 : v).toFixed(2);
    const pct2    = v => (v * 100).toFixed(2) + '%';

    const trabalhadores = (workers || [])
      .filter(w => w.vencimento_base != null)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const logsDoMes = (logs || []).filter(l => l.date?.startsWith(mesStr));

    return trabalhadores.map(w => {
      const workerLogs   = logsDoMes.filter(l => l.workerId === w.id);
      if (workerLogs.length === 0) return null; // sem registos neste mês
      const hist         = workerRateHistory.filter(h => h.worker_id === w.id);
      const brutoAlvo    = workerLogs.reduce((s, l) => {
        const rate = getRateAtDate(l.date, hist, parseFloat(w.valorHora) || 0);
        return s + (parseFloat(l.hours) || 0) * rate;
      }, 0);
      const contabRow    = contabData.find(r => r.worker_id === w.id);
      const subsAlimDias = Number(contabRow?.dias_trabalhados ?? 22);

      const rc = calcularRecibo({
        vencimentoBase:   parseFloat(w.vencimento_base) || 0,
        horasSemana: 40, premios: 0, he1: 0, he2: 0,
        incluirFerias: true, incluirNatal: true,
        subsAlimValorDia: parseFloat(w.subsidio_alimentacao_dia) || 0,
        subsAlimDias,
        subsAlimTipo: 'cartao',
        tabelaKey:    w.tabela_irs || 'tabelaI',
        nDependentes: w.n_dependentes ?? 0,
        brutoAlvo:    brutoAlvo || parseFloat(w.vencimento_base) || 0,
        territorio: 'internacional', funcao: 'geral', ano: anoNum,
      });

      const tabelaNome = (getIRSTabelasPorAno(anoNum)[w.tabela_irs || 'tabelaI'] || {}).nome || 'Tabela I';

      const empresa = [...new Set(workerLogs.map(l => l.clientId).filter(Boolean))]
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
        ajudas:        eur2(rc.ajudaCustoNecessaria),
        baseIRS:       eur2(rc.incidenciaRegular),
        taxaIRS:       pct2(rc.taxaRegular),
        irsTotal:      eur2(rc.irsTotal),
        ssTrab:        eur2(rc.ssTrabalhador),
        totalAbonos:   eur2(rc.totalAbonos),
        totalDesc:     eur2(rc.totalDescontos),
        liquido:       eur2(rc.liquido),
        ssPatronal:    eur2(rc.ssPatronal),
        custoEmpresa:  eur2(rc.custoEmpresa),
        brutoAlvo:     eur2(brutoAlvo),
        _brutoNum:     brutoAlvo,
        _abonosNum:    rc.totalAbonos,
        _descNum:      rc.totalDescontos,
        _liquidoNum:   rc.liquido,
        _ssPatNum:     rc.ssPatronal,
        _custoNum:     rc.custoEmpresa,
        _subsAlimNum:  rc.subsAlimTotal,
        _feriasNum:    rc.subsFerias,
        _natalNum:     rc.subsNatal,
        _ajudasNum:    rc.ajudaCustoNecessaria,
        _irsNum:       rc.irsTotal,
        _ssTrabNum:    rc.ssTrabalhador,
        _vencNum:      parseFloat(w.vencimento_base) || 0,
      };
    }).filter(Boolean);
  }, [workers, logs, clients, workerRateHistory, contabData, inputs.mes, inputs.ano]);

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
    setMapaRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function autoFill() {
    if (!r) return;

    const valorDiario    = n(inputs.vdl);
    const valorAlim      = n(inputs.subsAlimValorDia);
    const ajudaNecessaria = r.ajudaCustoNecessaria; // fixo — calculado com os inputs actuais

    if (ajudaNecessaria <= 0 || valorDiario <= 0) return;

    const mesStr     = `${inputs.ano}-${String(inputs.mes).padStart(2, '0')}`;
    const dataInicio = mapa.dataInicio || `${mesStr}-01`;

    // Conta dias úteis (Seg–Sex) nas primeiras nDias da viagem
    function contarDiasUteis(nDias) {
      let count = 0;
      const d = new Date(dataInicio + 'T00:00:00');
      for (let i = 0; i < nDias; i++) {
        const dow = d.getDay(); // 0=Dom, 6=Sáb
        if (dow >= 1 && dow <= 5) count++;
        d.setDate(d.getDate() + 1);
      }
      return count;
    }

    // Algoritmo iterativo: subsAlimMapa = dias_úteis_no_mapa × valorAlim
    // O nº de dias do mapa depende de subsAlimMapa, e vice-versa → convergir por iteração
    let subsAlimMapa  = valorAlim > 0 ? r.subsAlimTotal : 0;
    let bestF = 0, bestDias = 0, bestTotal = 0, nLinhas = 1, diasUteisCount = 0;

    for (let iter = 0; iter < 6; iter++) {
      const valorNec = ajudaNecessaria + subsAlimMapa;
      if (valorNec <= 0) break;
      const unidades = valorNec / valorDiario;

      bestF = 0; bestDias = 0; bestTotal = 0;
      for (const f of [0.50, 0.25, 0.00]) {
        const dias  = Math.floor(unidades - f);
        if (dias < 0) continue;
        const total = dias + f;
        if (total <= unidades + 1e-9 && total > bestTotal) {
          bestF = f; bestDias = dias; bestTotal = total;
        }
      }

      nLinhas = bestDias + 1;
      diasUteisCount = valorAlim > 0 ? contarDiasUteis(nLinhas) : 0;
      const novoSubsAlim = diasUteisCount * valorAlim;

      if (Math.abs(novoSubsAlim - subsAlimMapa) < 0.005) break;
      subsAlimMapa = novoSubsAlim;
    }

    // Hora de chegada conforme fração legal (editável manualmente depois)
    const horaChegadaAuto = bestF === 0.50 ? '21:30' : bestF === 0.25 ? '19:00' : '12:00';
    const horaPartidaAuto = mapa.horaPartida || '07:30';

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
      for (const d of datasOrdenadas) {
        if (d <= data) ultimo = clientePorDia[d];
        else break;
      }
      return ultimo || (datasOrdenadas.length > 0 ? clientePorDia[datasOrdenadas[0]] : null);
    }

    let cursor = new Date(dataInicio + 'T00:00:00');
    const territorioLabel = inputs.territorio === 'nacional' ? 'Nacional' : 'Internacional';
    const rows = [];

    for (let i = 0; i < nLinhas; i++) {
      const isFirstRow = i === 0;
      const isLastRow  = i === nLinhas - 1;
      const tipo = isFirstRow && !isLastRow ? 'Partida'
                 : isLastRow && !isFirstRow ? 'Chegada'
                 : isFirstRow               ? 'Partida'
                 :                            'Consecutivo';
      const hora = isFirstRow ? horaPartidaAuto : isLastRow ? horaChegadaAuto : '';
      const pct  = isLastRow && !isFirstRow ? Math.round(bestF * 100) : 100;
      const dia  = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;

      rows.push({
        id: Date.now() + i,
        dia,
        servico: 'Serviços de mecânica geral',
        cliente:    clienteParaDia(dia)    || inputs.clienteAbrev    || inputs.cliente    || '',
        localidade: inputs.localidadeAbrev || inputs.localidade      || inputs.pais       || '',
        territorio: territorioLabel,
        tipo,
        hora,
        pct,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    // Resíduo → definir A008 Prémios (substituir, não acumular)
    const totalAjudas        = Math.round(bestTotal * valorDiario * 100) / 100;
    const valorNecessarioFinal = ajudaNecessaria + subsAlimMapa;
    const residuo             = Math.round((valorNecessarioFinal - totalAjudas) * 100) / 100;
    if (residuo > 0.01) {
      set('premios', residuo.toFixed(2));
    }

    setMapaRows(rows);
    setAutoFillInfo({ totalAjudas, subsAlimMapa, diasUteisCount, residuo, valorNecessario: valorNecessarioFinal });
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
  }

  function gerarReciboPDF() {
    if (!r) return;
    const doc = new jsPDF();
    const mesNum = parseInt(inputs.mes, 10);
    const mesLabel = MESES_PT[mesNum] || inputs.mes;

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBO DE VENCIMENTO', 105, 16, { align: 'center' });

    autoTable(doc, {
      startY: 22,
      body: [
        ['Empresa:', EMPRESA.nome],
        ['Morada:', EMPRESA.morada],
        ['NIF:', EMPRESA.nif],
      ],
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 22 } },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 2,
      body: [
        ['Trabalhador:', inputs.nome || '—', 'Mês / Ano:', `${mesLabel} ${inputs.ano}`],
        ['NIF:', inputs.nif || '—', 'Profissão:', inputs.categoria || '—'],
        ['NIS:', inputs.nis || '—', 'Venc. Base:', eur(n(inputs.vencimentoBase))],
      ],
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 22 }, 2: { fontStyle: 'bold', cellWidth: 26 } },
    });

    const linhas = [
      ['A001', 'Vencimento Base', '', '', eur(n(inputs.vencimentoBase)), ''],
      ['A002', 'Subsídio de Alimentação', `${inputs.subsAlimDias}d`, eur(n(inputs.subsAlimValorDia)), eur(r.subsAlimTotal), ''],
    ];
    if (r.subsFerias > 0) linhas.push(['A004', 'Subsídio de Férias (duodécimos)', '', '', eur(r.subsFerias), '']);
    if (n(inputs.premios) > 0) linhas.push(['A008', 'Prémios / Bónus', '', '', eur(n(inputs.premios)), '']);
    if (n(inputs.he1) > 0) linhas.push(['A052', 'Trab. Suplementar 1ª hora', `${inputs.he1}h`, eur(r.valorHe1un), eur(r.valorHe1), '']);
    if (n(inputs.he2) > 0) linhas.push(['A053', 'Trab. Suplementar seguintes', `${inputs.he2}h`, eur(r.valorHe2un), eur(r.valorHe2), '']);
    if (r.subsNatal > 0) linhas.push(['A021', 'Subsídio de Natal (duodécimos)', '', '', eur(r.subsNatal), '']);
    if (r.ajudaCustoNecessaria > 0) linhas.push(['A082', 'Ajudas de Custo Internacional (NÃO TRIBUTADO)', '', '', eur(r.ajudaCustoNecessaria), '']);
    linhas.push(['T001', `IRS (venc. ${eur(r.incidenciaRegular)}·${(r.taxaRegular*100).toFixed(1)}% + subs.·${(r.taxaSubsidios*100).toFixed(1)}%)`, '', '', '', eur(r.irsTotal)]);
    linhas.push(['T003', 'Segurança Social — Trabalhador (11%)', '', '', '', eur(r.ssTrabalhador)]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 4,
      head: [['Cód.', 'Descrição', 'Qtd', 'V.Unit.', 'Abonos', 'Descontos']],
      body: linhas,
      theme: 'striped',
      headStyles: { fillColor: [15, 31, 61], fontSize: 7, fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 12 }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 3,
      body: [
        [
          { content: 'Total Abonos', styles: { fontStyle: 'bold' } },
          { content: eur(r.totalAbonos), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: 'Total Descontos', styles: { fontStyle: 'bold' } },
          { content: eur(r.totalDescontos), styles: { fontStyle: 'bold', halign: 'right' } },
        ],
        [
          { content: 'Líquido a Receber', styles: { fontStyle: 'bold', fontSize: 9 } },
          { content: eur(r.liquido), styles: { fontStyle: 'bold', fontSize: 9, halign: 'right' } },
          { content: 'Custo Empresa (c/ TSU 23,75%)' },
          { content: eur(r.custoEmpresa), styles: { halign: 'right' } },
        ],
      ],
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 28 }, 2: { cellWidth: 60 } },
    });

    const ySign = doc.lastAutoTable.finalY + 14;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`O(a) trabalhador(a),`, 14, ySign);
    doc.text(`Data: _______ / _______ / ${inputs.ano}`, 14, ySign + 8);
    doc.text('Assinatura: _____________________________________________', 14, ySign + 18);

    const nomeFile = (inputs.nome || 'trabalhador').replace(/\s+/g, '-').toLowerCase();
    doc.save(`recibo-vencimento-${nomeFile}-${inputs.mes.padStart(2, '0')}-${inputs.ano}.pdf`);
  }

  function exportReciboXLS() {
    if (!r) return;
    const mesNum = parseInt(inputs.mes, 10);
    const mesLabel = MESES_PT[mesNum] || inputs.mes;

    const linhas = [
      ['Código', 'Descrição', 'Qtd', 'V.Unit. (€)', 'Abonos (€)', 'Descontos (€)'],
      ['A001', 'Vencimento Base', '', '', n(inputs.vencimentoBase).toFixed(2), ''],
      ['A002', 'Subsídio de Alimentação', `${inputs.subsAlimDias}d`, n(inputs.subsAlimValorDia).toFixed(2), r.subsAlimTotal.toFixed(2), ''],
    ];
    if (r.subsFerias > 0)       linhas.push(['A004', 'Subsídio de Férias (duodécimos)', '', '', r.subsFerias.toFixed(2), '']);
    if (n(inputs.premios) > 0)  linhas.push(['A008', 'Prémios / Bónus', '', '', n(inputs.premios).toFixed(2), '']);
    if (n(inputs.he1) > 0)      linhas.push(['A052', 'Trabalho Suplementar 1ª hora', `${inputs.he1}h`, r.valorHe1un.toFixed(4), r.valorHe1.toFixed(2), '']);
    if (n(inputs.he2) > 0)      linhas.push(['A053', 'Trabalho Suplementar seguintes', `${inputs.he2}h`, r.valorHe2un.toFixed(4), r.valorHe2.toFixed(2), '']);
    if (r.subsNatal > 0)        linhas.push(['A021', 'Subsídio de Natal (duodécimos)', '', '', r.subsNatal.toFixed(2), '']);
    if (r.ajudaCustoNecessaria > 0) linhas.push(['A082', 'Ajudas de Custo Internacional (NÃO TRIBUTADO)', '', '', r.ajudaCustoNecessaria.toFixed(2), '']);
    linhas.push(['T001', `IRS (venc. ${r.incidenciaRegular.toFixed(2)}·${(r.taxaRegular*100).toFixed(1)}% + subs.·${(r.taxaSubsidios*100).toFixed(1)}%)`, '', '', '', r.irsTotal.toFixed(2)]);
    linhas.push(['T003', 'Segurança Social — Trabalhador (11%)', '', '', '', r.ssTrabalhador.toFixed(2)]);
    linhas.push(['', 'TOTAL', '', '', r.totalAbonos.toFixed(2), r.totalDescontos.toFixed(2)]);
    linhas.push(['', 'Líquido a Receber', '', '', r.liquido.toFixed(2), '']);
    linhas.push(['', 'Custo Empresa (c/ TSU 23,75%)', '', '', r.custoEmpresa.toFixed(2), '']);

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

  async function gerarMapaSalarialPDF() {
    const mesNum   = parseInt(inputs.mes, 10);
    const mesStr   = `${inputs.ano}-${String(mesNum).padStart(2, '0')}`;
    const mesLabel = MESES_PT[mesNum] || inputs.mes;
    const anoNum   = n(inputs.ano);

    const trabalhadores = (workers || [])
      .filter(w => w.is_active !== false && w.status !== 'inativo' && w.vencimento_base != null)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (trabalhadores.length === 0) {
      alert('Nenhum trabalhador activo com vencimento base configurado.');
      return;
    }

    // Buscar histórico de taxas + dias editáveis — mesma lógica da aba Contabilidade
    const [rateRes, contabRes] = await Promise.all([
      supabase.from('worker_valorhora_history').select('*'),
      supabase.from('contabilidade_mensal').select('*').eq('mes', mesStr),
    ]);
    const rateHistory = rateRes.data || [];
    const contabRows  = contabRes.data || [];

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

      // Dias de subsídio alimentação = valor da aba Contabilidade (editável, default 22)
      const contabRow  = contabRows.find(r => r.worker_id === w.id);
      const subsAlimDias = Number(contabRow?.dias_trabalhados ?? 22);

      const rc = calcularRecibo({
        vencimentoBase:   parseFloat(w.vencimento_base) || 0,
        horasSemana:      40,
        premios:          0,
        he1: 0, he2: 0,
        incluirFerias:    true,
        incluirNatal:     true,
        subsAlimValorDia: parseFloat(w.subsidio_alimentacao_dia) || 0,
        subsAlimDias,
        subsAlimTipo:     'cartao',
        tabelaKey:        w.tabela_irs || 'tabelaI',
        nDependentes:     w.n_dependentes ?? 0,
        brutoAlvo:        brutoAlvo || (parseFloat(w.vencimento_base) || 0),
        territorio:       'internacional',
        funcao:           'geral',
        ano:              anoNum,
      });

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
        linhas.push(['A002', 'Sub. Alimentação — Cartão (isento ≤ €10,46)', `${subsAlimDias}d`, eur2(parseFloat(w.subsidio_alimentacao_dia) || 0), eur2(rc.subsAlimTotal), '']);
      }
      if (rc.subsAlimExcedente > 0) linhas.push(['', '  → Excedente sujeito a IRS/SS', '', '', eur2(rc.subsAlimExcedente), '']);
      if (rc.subsFerias > 0)  linhas.push(['A004', 'Sub. Férias (duodécimo 1/12)', '', '', eur2(rc.subsFerias), '']);
      if (rc.subsNatal > 0)   linhas.push(['A021', 'Sub. Natal (duodécimo 1/12)', '', '', eur2(rc.subsNatal), '']);
      if (rc.ajudaCustoNecessaria > 0) linhas.push(['A082', 'Ajudas de Custo Internacional (isento)', '', '', eur2(rc.ajudaCustoNecessaria), '']);
      linhas.push(['T001', `IRS — ${tabelaNome.split('—')[0].trim()} / ${w.n_dependentes ?? 0} dep. (venc. ${eur2(rc.incidenciaRegular)}·${pct(rc.taxaRegular)} + subs.·${pct(rc.taxaSubsidios)})`, '', '', '', eur2(rc.irsTotal)]);
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
            { content: eur2(rc.totalAbonos), styles: { fontStyle: 'bold', halign: 'right' } },
            { content: 'TOTAL DESCONTOS', styles: { fontStyle: 'bold' } },
            { content: eur2(rc.totalDescontos), styles: { fontStyle: 'bold', halign: 'right' } },
          ],
          [
            { content: 'LÍQUIDO A RECEBER', styles: { fontStyle: 'bold', fontSize: 9, fillColor: [236, 253, 245], textColor: [5, 150, 105] } },
            { content: eur2(rc.liquido), styles: { fontStyle: 'bold', fontSize: 9, halign: 'right', fillColor: [236, 253, 245], textColor: [5, 150, 105] } },
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
      doc.text('Prémios, horas suplementares e ajustamentos manuais não incluídos — adicionar no TOConline conforme necessário.', 14, yAviso);
      doc.setTextColor(0, 0, 0);
    });

    doc.save(`processamento-salarial-${String(mesNum).padStart(2, '0')}-${inputs.ano}.pdf`);
  }

  // Helpers partilhados pelas duas funções batch abaixo
  async function _fetchBatchData(mesStr) {
    const [rateRes, contabRes] = await Promise.all([
      supabase.from('worker_valorhora_history').select('*'),
      supabase.from('contabilidade_mensal').select('*').eq('mes', mesStr),
    ]);
    return { rateHistory: rateRes.data || [], contabRows: contabRes.data || [] };
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
      .filter(w => w.is_active !== false && w.status !== 'inativo' && w.vencimento_base != null)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (trabalhadores.length === 0) { alert('Nenhum trabalhador activo com vencimento base configurado.'); return; }

    const { rateHistory, contabRows } = await _fetchBatchData(mesStr);
    const logsDoMes = (logs || []).filter(l => l.date?.startsWith(mesStr));

    const eur2 = v => (isNaN(v) ? 0 : v).toFixed(2);
    const pct2 = v => (v * 100).toFixed(2) + '%';

    // Cabeçalho
    const cols = [
      'Trabalhador', 'NIF', 'NIS', 'Profissão',
      'Tabela IRS', 'Nº Dep.',
      'Venc. Base (€)', 'Sub. Alim. Dias', 'Sub. Alim. €/dia', 'Sub. Alim. Total (€)',
      'Sub. Férias / Duod. (€)', 'Sub. Natal / Duod. (€)',
      'Ajudas Custo Inter. (€)',
      'Base IRS (€)', 'Taxa IRS', 'IRS (€)',
      'SS Trab. 11% (€)', 'Total Abonos (€)', 'Total Descontos (€)',
      'Líquido (€)', 'TSU Patronal 23,75% (€)', 'Custo Empresa (€)',
      'Ordenado Bruto (€)',
    ];

    const dataRows = trabalhadores.map(w => {
      const workerLogs   = logsDoMes.filter(l => l.workerId === w.id);
      const brutoAlvo    = _calcBruto(w.id, workerLogs, rateHistory, w.valorHora);
      const contabRow    = contabRows.find(r => r.worker_id === w.id);
      const subsAlimDias = Number(contabRow?.dias_trabalhados ?? 22);

      const rc = calcularRecibo({
        vencimentoBase:   parseFloat(w.vencimento_base) || 0,
        horasSemana: 40, premios: 0, he1: 0, he2: 0,
        incluirFerias: true, incluirNatal: true,
        subsAlimValorDia: parseFloat(w.subsidio_alimentacao_dia) || 0,
        subsAlimDias,
        subsAlimTipo: 'cartao',
        tabelaKey:    w.tabela_irs || 'tabelaI',
        nDependentes: w.n_dependentes ?? 0,
        brutoAlvo:    brutoAlvo || parseFloat(w.vencimento_base) || 0,
        territorio: 'internacional', funcao: 'geral', ano: anoNum,
      });

      const tabelaNome = (getIRSTabelasPorAno(anoNum)[w.tabela_irs || 'tabelaI'] || {}).nome || 'Tabela I';

      return [
        w.name || '', w.nif || '', w.nis || '', w.profissao || '',
        tabelaNome, String(w.n_dependentes ?? 0),
        eur2(parseFloat(w.vencimento_base)), String(subsAlimDias),
        eur2(parseFloat(w.subsidio_alimentacao_dia) || 0), eur2(rc.subsAlimTotal),
        eur2(rc.subsFerias), eur2(rc.subsNatal),
        eur2(rc.ajudaCustoNecessaria),
        eur2(rc.incidenciaRegular), pct2(rc.taxaRegular), eur2(rc.irsTotal),
        eur2(rc.ssTrabalhador), eur2(rc.totalAbonos), eur2(rc.totalDescontos),
        eur2(rc.liquido), eur2(rc.ssPatronal), eur2(rc.custoEmpresa),
        eur2(brutoAlvo),
      ];
    });

    // Totais
    const sumIdx = [6, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20, 21, 22];
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
<p style="font-family:Arial;font-size:9px;color:#64748B;margin-top:12px">Estimativa — confirmar sempre no TOConline antes de processar. Prémios e horas suplementares não incluídos.</p>
</body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `processamento-salarial-${String(mesNum).padStart(2, '0')}-${inputs.ano}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Renderiza UMA página do mapa (A4 vertical) ───────────────────────────
  function _renderMapaPagina(doc, { mesLabel, ano, nome, nif, nis, profissao, mapaLinhas, subsAlimTotal, logo }) {
    const W  = doc.internal.pageSize.getWidth();   // 210mm portrait
    const H  = doc.internal.pageSize.getHeight();  // 297mm portrait
    const MX = 5;
    const TW = W - 2 * MX;  // 200mm
    const NAVY  = [15, 31, 61];
    const GOLD  = [212, 175, 55];
    const LGRAY = [242, 244, 247];
    const MGRAY = [90, 105, 125];
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
    doc.setDrawColor(...GOLD);
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
    doc.setTextColor(...MGRAY);
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
      alternateRowStyles: { fillColor: [248, 249, 251] },
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
    const YT          = Math.min(tableEnd + 5, H - 38);

    // Fundo suave na zona de totais
    doc.setFillColor(245, 247, 250);
    doc.rect(XT - 2, YT - 3, W - MX - XT + 2, 24, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 75, 95);
    doc.text('Total Ajudas de Custo', XT, YT + 2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(fmt(mapaTotal), W - MX - 1, YT + 2, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 75, 95);
    doc.text('Dedução Sub. Alimentação', XT, YT + 8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(`- ${fmt(subsAlimTotal)}`, W - MX - 1, YT + 8, { align: 'right' });

    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.3);
    doc.line(XT, YT + 11, W - MX - 1, YT + 11);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text('Importância a Receber', XT, YT + 18);
    doc.text(fmt(importancia), W - MX - 1, YT + 18, { align: 'right' });

    // ── ZONA 5: Assinatura ──────────────────────────────────────────────────
    const YS = H - 12;
    doc.setDrawColor(190, 200, 215);
    doc.setLineWidth(0.2);
    doc.line(MX, YS - 1, W - MX, YS - 1);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(55, 65, 80);
    doc.text(`Recebi a importância de ${fmt(importancia)}, referente a ajudas de custo (${mesLabel} de ${ano}).`, MX, YS + 5);
  }

  async function gerarMapasAjudasPDF() {
    const mesNum   = parseInt(inputs.mes, 10);
    const mesStr   = `${inputs.ano}-${String(mesNum).padStart(2, '0')}`;
    const mesLabel = MESES_PT[mesNum] || inputs.mes;
    const anoNum   = n(inputs.ano);

    const trabalhadores = (workers || [])
      .filter(w => w.is_active !== false && w.status !== 'inativo' && w.vencimento_base != null)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (trabalhadores.length === 0) { alert('Nenhum trabalhador activo com vencimento base configurado.'); return; }

    const { rateHistory, contabRows } = await _fetchBatchData(mesStr);
    const logsDoMes = (logs || []).filter(l => l.date?.startsWith(mesStr));

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let isFirstPage = true;

    trabalhadores.forEach(w => {
      const workerLogs   = logsDoMes.filter(l => l.workerId === w.id);
      const brutoAlvo    = _calcBruto(w.id, workerLogs, rateHistory, w.valorHora);
      const contabRow    = contabRows.find(r => r.worker_id === w.id);
      const subsAlimDias = Number(contabRow?.dias_trabalhados ?? 22);

      const rc = calcularRecibo({
        vencimentoBase:   parseFloat(w.vencimento_base) || 0,
        horasSemana: 40, premios: 0, he1: 0, he2: 0,
        incluirFerias: true, incluirNatal: true,
        subsAlimValorDia: parseFloat(w.subsidio_alimentacao_dia) || 0,
        subsAlimDias,
        subsAlimTipo: 'cartao',
        tabelaKey:    w.tabela_irs || 'tabelaI',
        nDependentes: w.n_dependentes ?? 0,
        brutoAlvo:    brutoAlvo || parseFloat(w.vencimento_base) || 0,
        territorio: 'internacional', funcao: 'geral', ano: anoNum,
      });

      if (rc.ajudaCustoNecessaria <= 0) return; // sem ajudas de custo, pula

      // Cliente carry-forward por dia
      const clienteParaDia = _clientePorDiaFn(w.id, mesStr);

      // Mapa arranca sempre no dia 1 do mês
      const dataInicio   = `${mesStr}-01`;
      const limiteDia    = valorDiarioLegal('internacional', 'geral');
      const valorAlimDia = parseFloat(w.subsidio_alimentacao_dia) || 0;

      // Conta dias úteis (Seg–Sex) nas primeiras nDias a partir de dataInicio
      function contarUteis(nDias) {
        let c = 0;
        const d = new Date(dataInicio + 'T00:00:00');
        for (let i = 0; i < nDias; i++) { if (d.getDay() >= 1 && d.getDay() <= 5) c++; d.setDate(d.getDate() + 1); }
        return c;
      }

      // Iteração: subsAlimMapa = diasÚteis(mapa) × valorAlimDia
      let subsAlimMapa = valorAlimDia > 0 ? rc.subsAlimTotal : 0;
      let mapaLinhas   = [];

      for (let iter = 0; iter < 6; iter++) {
        mapaLinhas = gerarLinhasMapa({
          necessaria:  rc.ajudaCustoNecessaria + subsAlimMapa,
          limiteDia,
          dataInicio,
          horaPartida: '07:30',
          horaChegada: '20:30',
          territorio:  'internacional',
          cliente:     '',
          localidade:  '',
        }).map(row => ({
          ...row,
          cliente: clienteParaDia(row.dia) || '',
          valor:   limiteDia * (row.pct / 100),
        }));

        if (mapaLinhas.length === 0) break;
        const novo = contarUteis(mapaLinhas.length) * valorAlimDia;
        if (Math.abs(novo - subsAlimMapa) < 0.005) break;
        subsAlimMapa = novo;
      }

      if (mapaLinhas.length === 0) return;

      if (!isFirstPage) doc.addPage();
      isFirstPage = false;

      _renderMapaPagina(doc, {
        mesLabel, ano: inputs.ano,
        nome: w.name, nif: w.nif, nis: w.nis, profissao: w.profissao,
        mapaLinhas,
        subsAlimTotal: subsAlimMapa,
        logo: logoRef.current,
      });
    });

    if (isFirstPage) { alert('Nenhum trabalhador com ajudas de custo no mês seleccionado.'); return; }
    doc.save(`mapas-ajudas-custo-${String(mesNum).padStart(2, '0')}-${inputs.ano}.pdf`);
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
    <div className="space-y-5 pb-12">

      {/* Aviso de compliance — sempre visível */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 border-l-4 border-l-amber-400 rounded-2xl p-4">
        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs font-bold text-amber-800 leading-relaxed">
          <span className="font-black uppercase tracking-wide">Estimativa — não oficial.</span>{' '}
          Valores calculados com base nas tabelas IRS 2026 (Despacho n.º 233-A/2026) e TSU em vigor.
          Confirme sempre os valores finais no <span className="font-black">TOConline</span> antes de processar o salário.
          Ajudas de custo só são isentas se corresponderem a deslocações reais devidamente documentadas.
        </p>
      </div>

      {/* Selector de trabalhador */}
      <Card className="p-5">
        <LabelInput label="Trabalhador (preenchimento automático)">
          <SelectInput value={selectedWorkerId} onChange={handleSelectWorker}>
            <option value="">— Introduzir manualmente —</option>
            {(workers || [])
              .filter(w => w.is_active !== false && w.status !== 'inativo')
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
              .map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
          </SelectInput>
        </LabelInput>
      </Card>

      {/* Seletor de mês — global, controla todo o recibo */}
      <Card className="px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navMes(-1)}
              className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-black text-slate-800 text-base min-w-40 text-center">
              {MESES_PT[parseInt(inputs.mes, 10)] || ''} {inputs.ano}
            </span>
            <button
              onClick={() => navMes(1)}
              className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={gerarMapaSalarialPDF}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[10px] font-black uppercase bg-slate-700 text-white hover:bg-slate-900 transition-all shadow-sm"
              title="PDF de processamento — todos os trabalhadores"
            >
              <FileText size={12} /> PDF
            </button>
            <button
              onClick={exportMapaSalarialXLS}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[10px] font-black uppercase bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm"
              title="Excel de processamento — todos os trabalhadores"
            >
              <FileSpreadsheet size={12} /> Excel
            </button>
            <button
              onClick={gerarMapasAjudasPDF}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[10px] font-black uppercase bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm"
              title="PDF dos mapas de ajudas de custo — todos os trabalhadores"
            >
              <Download size={12} /> Mapas AC
            </button>
          </div>
        </div>
      </Card>

      {/* Sub-abas */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setSubTab('calculadora')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${subTab === 'calculadora' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Calculadora
        </button>
        <button
          onClick={() => setSubTab('resumo')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${subTab === 'resumo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Resumo Mensal
        </button>
      </div>

      {/* ── Resumo Mensal ── */}
      {subTab === 'resumo' && (
        <ResumoMensalTable
          rows={resumoRows}
          mesLabel={`${MESES_PT[parseInt(inputs.mes, 10)] || ''} ${inputs.ano}`}
          mesStr={`${inputs.ano}-${String(parseInt(inputs.mes, 10)).padStart(2, '0')}`}
        />
      )}

      {/* Grid 2 colunas: inputs + preview + mapa */}
      {subTab === 'calculadora' && <>
      <div className="grid lg:grid-cols-2 gap-5 items-start">

        {/* ── COLUNA INPUTS ── */}
        <div className="space-y-4">

          {/* 1 - Dados do Trabalhador */}
          <Card className="p-5">
            <SectionHeader n="1" label="Dados do Trabalhador" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <LabelInput label="Nome">
                <TextInput value={inputs.nome} onChange={e => set('nome', e.target.value)} />
              </LabelInput>
              <LabelInput label="Categoria / Profissão">
                <TextInput value={inputs.categoria} onChange={e => set('categoria', e.target.value)} />
              </LabelInput>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <LabelInput label="NIF">
                <TextInput value={inputs.nif} onChange={e => set('nif', e.target.value)} />
              </LabelInput>
              <LabelInput label="NIS (SS)">
                <TextInput value={inputs.nis} onChange={e => set('nis', e.target.value)} />
              </LabelInput>
              <LabelInput label="Dias processados">
                <TextInput type="number" value={inputs.diasMes} onChange={e => set('diasMes', e.target.value)} min="1" max="31" />
              </LabelInput>
            </div>
          </Card>

          {/* 2 - Retribuição Base */}
          <Card className="p-5">
            <SectionHeader n="2" label="Retribuição Base" />
            <div className="grid grid-cols-3 gap-3 mb-3">
              <LabelInput label="Vencimento Base (€/mês)">
                <TextInput type="number" step="0.01" value={inputs.vencimentoBase} onChange={e => set('vencimentoBase', e.target.value)} />
              </LabelInput>
              <LabelInput label="Horas / semana">
                <TextInput type="number" value={inputs.horasSemana} onChange={e => set('horasSemana', e.target.value)} />
              </LabelInput>
              <LabelInput label="Salário/hora (auto)">
                <TextInput
                  type="number"
                  readOnly
                  value={r ? r.salarioHora.toFixed(4) : ''}
                />
              </LabelInput>
            </div>

            <div className="flex flex-col gap-2 mb-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={inputs.incluirFerias} onChange={e => set('incluirFerias', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                Incluir Subsídio de Férias (100% com duodécimos)
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={inputs.incluirNatal} onChange={e => set('incluirNatal', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                Incluir Subsídio de Natal (100% com duodécimos)
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <LabelInput label="Prémios / Bónus (€, tributável)">
                <TextInput type="number" step="0.01" value={inputs.premios} onChange={e => set('premios', e.target.value)} />
              </LabelInput>
              <div />
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <LabelInput label="H. Suplementares 1ª hora (qtd)">
                <TextInput type="number" step="0.5" value={inputs.he1} onChange={e => set('he1', e.target.value)} />
              </LabelInput>
              <LabelInput label="H. Suplementares seguintes (qtd)">
                <TextInput type="number" step="0.5" value={inputs.he2} onChange={e => set('he2', e.target.value)} />
              </LabelInput>
              <LabelInput label="" hint="1ª h: +25% · seguintes: +37,5%">
                <div />
              </LabelInput>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <LabelInput label="Subsídio Alimentação (€/dia)">
                <TextInput type="number" step="0.01" value={inputs.subsAlimValorDia} onChange={e => set('subsAlimValorDia', e.target.value)} />
              </LabelInput>
              <LabelInput label="Pago em">
                <SelectInput value={inputs.subsAlimTipo} onChange={e => set('subsAlimTipo', e.target.value)}>
                  <option value="cartao">Cartão / vale (isento ≤ €10,46)</option>
                  <option value="dinheiro">Dinheiro (isento ≤ €6,15)</option>
                </SelectInput>
              </LabelInput>
              <LabelInput label="Dias com subsídio">
                <TextInput type="number" value={inputs.subsAlimDias} onChange={e => set('subsAlimDias', e.target.value)} />
              </LabelInput>
            </div>
          </Card>

          {/* 3 - IRS */}
          <Card className="p-5">
            <SectionHeader n="3" label="IRS — Situação Fiscal" />
            <div className="grid grid-cols-2 gap-3">
              <LabelInput label="Tabela de retenção">
                <SelectInput value={inputs.tabelaKey} onChange={e => set('tabelaKey', e.target.value)}>
                  {Object.entries(getIRSTabelasPorAno(n(inputs.ano))).map(([k, t]) => (
                    <option key={k} value={k}>{t.nome}</option>
                  ))}
                </SelectInput>
              </LabelInput>
              <LabelInput
                label="Nº de dependentes"
                hint={`Continente — tabelas ${Object.keys(IRS_TABELAS_BY_YEAR).map(Number).sort((a,b)=>b-a).find(a=>a<=n(inputs.ano)) || Object.keys(IRS_TABELAS_BY_YEAR).map(Number).sort((a,b)=>b-a)[0]}`}
              >
                <TextInput type="number" min="0" value={inputs.nDependentes} onChange={e => set('nDependentes', e.target.value)} />
              </LabelInput>
            </div>
          </Card>

          {/* 4 - Bruto Alvo & Deslocação */}
          <Card className="p-5">
            <SectionHeader n="4" label="Bruto Alvo & Deslocação Internacional" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <LabelInput
                label="Valor Bruto Total Alvo (€)"
                hint={selectedWorkerId ? 'Auto: custo do mês em Custos/Equipa. Editável.' : 'Selecione um trabalhador para preencher automaticamente.'}
              >
                <TextInput type="number" step="0.01" value={inputs.brutoAlvo} onChange={e => set('brutoAlvo', e.target.value)} />
              </LabelInput>
              <LabelInput label="Valor diário legal (€)" hint="Auto-preenchido por território/função. Editável.">
                <TextInput type="number" step="0.01" value={inputs.vdl} onChange={e => set('vdl', e.target.value)} />
              </LabelInput>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <LabelInput label="Território">
                <SelectInput value={inputs.territorio} onChange={e => set('territorio', e.target.value)}>
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
            <div className="grid grid-cols-3 gap-3">
              <LabelInput label="Cliente">
                <TextInput value={inputs.cliente} onChange={e => set('cliente', e.target.value)} />
              </LabelInput>
              <LabelInput label="Localidade">
                <TextInput value={inputs.localidade} onChange={e => set('localidade', e.target.value)} />
              </LabelInput>
              <LabelInput label="País">
                <TextInput value={inputs.pais} onChange={e => set('pais', e.target.value)} />
              </LabelInput>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <LabelInput label="Abreviação Cliente (mapa)">
                <TextInput value={inputs.clienteAbrev}
                  onChange={e => set('clienteAbrev', e.target.value)}
                  placeholder={inputs.cliente || 'Ex: Calcosa'} />
              </LabelInput>
              <LabelInput label="Abreviação Localidade (mapa)">
                <TextInput value={inputs.localidadeAbrev}
                  onChange={e => set('localidadeAbrev', e.target.value)}
                  placeholder={inputs.localidade || inputs.pais || 'Ex: Espanha'} />
              </LabelInput>
            </div>
          </Card>
        </div>

        {/* ── COLUNA PREVIEW ── */}
        <div>
          {r ? (
            <Card className="p-5">
              {/* Cabeçalho do recibo */}
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3 mb-4 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800">{inputs.nome || '—'}</p>
                  <p className="text-[10px] text-slate-500 font-bold">NIF: {inputs.nif || '—'} · Profissão: {inputs.categoria || '—'}</p>
                  <p className="text-[10px] text-slate-500 font-bold">Vencimento: {eur(n(inputs.vencimentoBase))} · Hora: {eur(r.salarioHora)}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="font-black text-lg text-slate-800">{MESES_PT[parseInt(inputs.mes, 10)] || ''} {inputs.ano}</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={gerarReciboPDF}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase bg-slate-700 text-white hover:bg-slate-900 transition-all"
                      title="Exportar recibo em PDF"
                    >
                      <FileText size={11} /> PDF
                    </button>
                    <button
                      onClick={exportReciboXLS}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                      title="Exportar recibo em Excel"
                    >
                      <FileSpreadsheet size={11} /> Excel
                    </button>
                  </div>
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
                    <ReciboLinha desc="A001 - Vencimento Base" abono={r.salarioHora > 0 ? n(inputs.vencimentoBase) : null} />
                    <ReciboLinha desc="A002 - Subs. Alimentação" qtd={`${inputs.subsAlimDias}d`} vUnit={n(inputs.subsAlimValorDia)} abono={r.subsAlimTotal} />
                    {r.subsFerias > 0 && <ReciboLinha desc="A004 - Subs. Férias (duodécimos)" abono={r.subsFerias} />}
                    {n(inputs.premios) > 0 && <ReciboLinha desc="A008 - Prémios / Bónus" abono={n(inputs.premios)} />}
                    {n(inputs.he1) > 0 && <ReciboLinha desc="A052 - Trabalho Suplementar 1ª hora" qtd={`${inputs.he1}h`} vUnit={r.valorHe1un} abono={r.valorHe1} />}
                    {n(inputs.he2) > 0 && <ReciboLinha desc="A053 - Trabalho Suplementar seguintes" qtd={`${inputs.he2}h`} vUnit={r.valorHe2un} abono={r.valorHe2} />}
                    {r.subsNatal > 0 && <ReciboLinha desc="A021 - Subs. Natal (duodécimos)" abono={r.subsNatal} />}
                    {r.ajudaCustoNecessaria > 0 && (
                      <tr className="bg-orange-50">
                        <td className="py-1.5 px-1 border-l-2 border-orange-400 font-bold text-slate-700">A082 - Ajudas de Custo Internacional <span className="text-[9px] text-orange-600 font-black ml-1">NÃO TRIBUTADO</span></td>
                        <td className="py-1.5 px-1 text-right" />
                        <td className="py-1.5 px-1 text-right" />
                        <td className="py-1.5 px-1 text-right font-bold">{eur(r.ajudaCustoNecessaria)}</td>
                        <td className="py-1.5 px-1 text-right" />
                      </tr>
                    )}
                    <ReciboLinha desc={`T001 - IRS (venc.·${(r.taxaRegular*100).toFixed(1)}% + subs.·${(r.taxaSubsidios*100).toFixed(1)}%)`} desconto={r.irsTotal} />
                    <ReciboLinha desc="T003 - Seg. Social (11%)" desconto={r.ssTrabalhador} />
                    {/* Total */}
                    <tr className="border-t-2 border-slate-800 font-black">
                      <td className="py-2 px-1">Total</td>
                      <td className="py-2 px-1" />
                      <td className="py-2 px-1" />
                      <td className="py-2 px-1 text-right">{eur(r.totalAbonos)}</td>
                      <td className="py-2 px-1 text-right">{eur(r.totalDescontos)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Notas de taxas */}
              <div className="mt-3 bg-slate-50 rounded-xl p-3 text-[10px] text-slate-500 font-bold space-y-0.5">
                <p>IRS — Taxa efetiva (Vencimento e restantes abonos): {eur(r.incidenciaRegular)} · {(r.taxaRegular * 100).toFixed(2)}%</p>
                {r.subsFerias > 0 && <p>IRS — Taxa efetiva (Subsídio de Férias): {(r.taxaSubsidios * 100).toFixed(2)}%</p>}
                {r.subsNatal  > 0 && <p>IRS — Taxa efetiva (Subsídio de Natal): {(r.taxaSubsidios * 100).toFixed(2)}%</p>}
                {(n(inputs.he1) > 0 || n(inputs.he2) > 0) && (
                  <p>Trabalho suplementar: taxa {(r.taxaOvertime * 100).toFixed(2)}% (50% da taxa regular)</p>
                )}
                {r.subsAlimExcedente > 0 && (
                  <p className="text-amber-600">Atenção: subsídio de alimentação excede o limite de isenção ({eur(r.limiteAlim)}/dia) — excedente {eur(r.subsAlimExcedente)} sujeito a IRS/SS.</p>
                )}
              </div>

              {/* Resumo líquido / custo */}
              <div className="mt-3 pt-3 border-t border-dashed border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Líquido a receber</p>
                  <p className="text-xl font-black text-slate-800">{eur(r.liquido)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Custo empresa (c/ TSU 23,75%)</p>
                  <p className="text-xl font-black text-slate-800">{eur(r.custoEmpresa)}</p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-10 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <RefreshCw size={22} className="text-slate-400" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-wide">Preencha o vencimento base</p>
              <p className="text-xs font-bold text-slate-300">O preview do recibo aparece aqui</p>
            </Card>
          )}
        </div>
      </div>

      {/* ── MAPA DE AJUDAS DE CUSTO ── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <SectionHeader n="5" label="Mapa de Ajudas de Custo" />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setMapaRows([]); setAutoFillInfo(null); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
            >
              <Trash2 size={12} /> Limpar
            </button>
            <button
              onClick={() => addRow()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
            >
              <Plus size={12} /> Linha manual
            </button>
            {mapaRows.length > 0 && (
              <button
                onClick={gerarPDF}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
              >
                <Download size={12} /> Exportar PDF
              </button>
            )}
          </div>
        </div>

        {/* Toolbar de preenchimento automático */}
        <div className="flex gap-3 flex-wrap items-end mb-4 p-3.5 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <LabelInput label="Data de início">
            <input
              type="date"
              value={mapa.dataInicio}
              onChange={e => setMapa(p => ({ ...p, dataInicio: e.target.value }))}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 lowercase"
            />
          </LabelInput>
          <LabelInput label="Hora partida">
            <input
              type="time"
              value={mapa.horaPartida}
              onChange={e => setMapa(p => ({ ...p, horaPartida: e.target.value }))}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 lowercase"
            />
          </LabelInput>
          <LabelInput label="Hora chegada">
            <input
              type="time"
              value={mapa.horaChegada}
              onChange={e => setMapa(p => ({ ...p, horaChegada: e.target.value }))}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 lowercase"
            />
          </LabelInput>
          <button
            onClick={autoFill}
            disabled={!r || r.ajudaCustoNecessaria <= 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={12} /> Preencher automaticamente
          </button>
        </div>

        {/* Tabela do mapa */}
        {mapaRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white">
                  {['Dia', 'Serviço', 'Cliente', 'Localidade', 'Território', 'Tipo', 'Hora', '%', 'Valor', ''].map(h => (
                    <th key={h} className="px-2 py-2 text-left text-[10px] font-black uppercase tracking-wider first:rounded-tl-xl last:rounded-tr-xl">{h}</th>
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
                          className="w-full border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none focus:border-indigo-300" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="text" value={row.servico} onChange={e => updateRow(row.id, 'servico', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none focus:border-indigo-300" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="text" value={row.cliente} onChange={e => updateRow(row.id, 'cliente', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none focus:border-indigo-300" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="text" value={row.localidade} onChange={e => updateRow(row.id, 'localidade', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none focus:border-indigo-300" />
                      </td>
                      <td className="px-1 py-1">
                        <select value={row.territorio} onChange={e => updateRow(row.id, 'territorio', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none focus:border-indigo-300">
                          <option value="Internacional">Internacional</option>
                          <option value="Nacional">Nacional</option>
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <select value={row.tipo} onChange={e => updateRow(row.id, 'tipo', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none focus:border-indigo-300">
                          <option value="Partida">Partida</option>
                          <option value="Consecutivo">Consecutivo</option>
                          <option value="Chegada">Chegada</option>
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <input type="time" value={row.hora} onChange={e => updateRow(row.id, 'hora', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none focus:border-indigo-300" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" value={row.pct} min="0" max="100" step="5"
                          onChange={e => updateRow(row.id, 'pct', parseFloat(e.target.value) || 0)}
                          className="w-16 border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-bold lowercase outline-none focus:border-indigo-300" />
                      </td>
                      <td className="px-2 py-1 text-right font-bold text-slate-700">{eur(valor)}</td>
                      <td className="px-1 py-1 text-center">
                        <button onClick={() => removeRow(row.id)} className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
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
          <div className="mt-4 flex gap-5 flex-wrap p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total do Mapa</p>
              <p className="text-lg font-black text-slate-800">{eur(mapaTotal)}</p>
            </div>
            {r && (
              <>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Necessário (do recibo)</p>
                  <p className="text-lg font-black text-slate-800">{eur(r.ajudaCustoNecessaria)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Diferença</p>
                  <p className={`text-lg font-black ${Math.abs(mapaDiff) < 0.5 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {mapaDiff >= 0 ? '+' : ''}{eur(mapaDiff)}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
        {autoFillInfo && (
          <div className="mt-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs text-slate-600 flex flex-wrap gap-4">
            <span>
              <span className="font-semibold text-slate-700">Ajudas de custo:</span>{' '}
              {eur(autoFillInfo.totalAjudas)}
            </span>
            {autoFillInfo.subsAlimMapa > 0 && (
              <span>
                <span className="font-semibold text-slate-700">Sub. alim. ({autoFillInfo.diasUteisCount} dias úteis):</span>{' '}
                −{eur(autoFillInfo.subsAlimMapa)}
              </span>
            )}
            {autoFillInfo.residuo > 0.01 && (
              <span>
                <span className="font-semibold text-slate-700">Complemento A008:</span>{' '}
                {eur(autoFillInfo.residuo)}
              </span>
            )}
            <span>
              <span className="font-semibold text-slate-700">Importância a receber:</span>{' '}
              {eur(autoFillInfo.totalAjudas - autoFillInfo.subsAlimMapa + autoFillInfo.residuo)} ✓
            </span>
          </div>
        )}
      </Card>
      </>}
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

const RESUMO_COLS = [
  { label: 'Trabalhador',              key: 'nome',           align: 'center', w: 150 },
  { label: 'NIF',                      key: 'nif',            align: 'center', w: 85  },
  { label: 'NIS',                      key: 'nis',            align: 'center', w: 85  },
  { label: 'Profissão',                key: 'profissao',      align: 'center', w: 100 },
  { label: 'Empresa',                  key: 'empresa',        align: 'center', w: 130 },
  { label: 'Início Vínculo',           key: 'inicioVinculo',  align: 'center', w: 88  },
  { label: 'Cessação Vínculo',         key: 'cessacaoVinculo',align: 'center', w: 88  },
  { label: 'Tabela IRS',               key: 'tabelaNome',     align: 'center', w: 82  },
  { label: 'Nº Dep.',                  key: 'nDep',           align: 'center', w: 54  },
  { label: 'Venc. Base (€)',           key: 'vencBase',       align: 'right',  w: 84,  sumKey: '_vencNum'    },
  { label: 'Sub. Alim. Dias',          key: 'subsAlimDias',   align: 'center', w: 64  },
  { label: 'Sub. Alim. €/dia',         key: 'subsAlimDia',    align: 'right',  w: 76  },
  { label: 'Sub. Alim. Total (€)',     key: 'subsAlimTotal',  align: 'right',  w: 84,  sumKey: '_subsAlimNum'},
  { label: 'Sub. Férias / Duod. (€)', key: 'subsFerias',     align: 'right',  w: 84,  sumKey: '_feriasNum'  },
  { label: 'Sub. Natal / Duod. (€)',  key: 'subsNatal',      align: 'right',  w: 84,  sumKey: '_natalNum'   },
  { label: 'Ajudas Custo Inter. (€)', key: 'ajudas',         align: 'right',  w: 84,  sumKey: '_ajudasNum'  },
  { label: 'Base IRS (€)',             key: 'baseIRS',        align: 'right',  w: 76  },
  { label: 'Taxa IRS',                 key: 'taxaIRS',        align: 'right',  w: 64  },
  { label: 'IRS (€)',                  key: 'irsTotal',       align: 'right',  w: 70,  sumKey: '_irsNum'     },
  { label: 'SS Trab. 11% (€)',         key: 'ssTrab',         align: 'right',  w: 80,  sumKey: '_ssTrabNum'  },
  { label: 'Total Abonos (€)',         key: 'totalAbonos',    align: 'right',  w: 84,  sumKey: '_abonosNum'  },
  { label: 'Total Descontos (€)',      key: 'totalDesc',      align: 'right',  w: 84,  sumKey: '_descNum'    },
  { label: 'Líquido (€)',              key: 'liquido',        align: 'right',  w: 76,  sumKey: '_liquidoNum' },
  { label: 'TSU Patronal 23,75% (€)', key: 'ssPatronal',     align: 'right',  w: 84,  sumKey: '_ssPatNum'   },
  { label: 'Custo Empresa (€)',        key: 'custoEmpresa',   align: 'right',  w: 84,  sumKey: '_custoNum'   },
  { label: 'Ajuste (€)',               key: 'ajuste',         align: 'right',  w: 74,  sumKey: '_ajusteNum', tipo: 'ajuste' },
  { label: 'Ordenado Bruto (€)',       key: 'brutoAlvo',      align: 'right',  w: 96,  sumKey: '_brutoNum',  highlight: true },
  { label: 'Observação',               key: 'observacao',     align: 'center', w: 150, editable: true },
  { label: 'Completo',                 key: 'completo',       align: 'center', w: 64,  tipo: 'toggle' },
];

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

function ResumoMensalTable({ rows, mesLabel, mesStr }) {
  const { supabase } = useApp();

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

  const thBase = 'px-3 py-2.5 text-[10px] font-black uppercase tracking-wide whitespace-nowrap text-center';
  const tdAlign = () => 'text-center';

  return (
    <div className="space-y-3">
      {/* Banner de erro de BD */}
      {dbError && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-800">
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
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">Resumo Mensal — {mesLabel}</h3>
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
                      className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wide"
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
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase transition-all border shadow-sm ${showColPicker ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              Colunas
              <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md text-[9px] font-black">
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
                      className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wide"
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
                        className="w-3.5 h-3.5 accent-indigo-600 shrink-0"
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
        <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-100">
          <p className="text-sm font-black uppercase tracking-wide">Sem trabalhadores activos com vencimento base</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table
            className="border-collapse"
            style={{
              width: '100%',
              tableLayout: 'fixed',
              minWidth: `${activeCols.reduce((s, { col }) => s + (col.w || 84), 0)}px`,
              fontSize: '11px',
            }}
          >
            <colgroup>
              {activeCols.map(({ col, ci }) => (
                <col key={ci} style={{ width: `${col.w || 84}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-slate-800 text-white">
                {activeCols.map(({ col, ci }, ai) => (
                  <th
                    key={ci}
                    className={`px-1.5 py-2 text-[9px] font-black uppercase tracking-wide text-center leading-tight ${col.highlight ? 'bg-emerald-700 text-white' : 'text-slate-200'}`}
                    style={ai === 0 ? { position: 'sticky', left: 0, zIndex: 10, background: col.highlight ? '#065f46' : '#1e293b' } : {}}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, ri) => (
                <tr
                  key={ri}
                  className={row.completo ? 'bg-emerald-50' : ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                >
                  {activeCols.map(({ col, ci }, ai) => (
                    <td
                      key={ci}
                      className={`px-1.5 py-1.5 font-bold overflow-hidden ${col.highlight ? 'text-emerald-700 bg-emerald-50 border-x border-emerald-100' : 'text-slate-700'}`}
                      style={{
                        ...(ai === 0 ? { position: 'sticky', left: 0, zIndex: 5, background: row.completo ? '#ecfdf5' : ri % 2 === 0 ? '#ffffff' : '#f8fafc', boxShadow: '2px 0 4px -2px rgba(0,0,0,.08)' } : {}),
                        ...(col.tipo || col.editable ? {} : { textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }),
                      }}
                    >
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
                          className="w-full min-w-36 bg-transparent outline-none text-center text-xs font-bold text-slate-700 placeholder:text-slate-300 px-2 py-1 rounded-lg hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-200 transition-all"
                        />
                      ) : (
                        <span className={`block px-2 ${tdAlign()}`}>{row[col.key]}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                {activeCols.map(({ col, ci }, ai) => (
                  <td
                    key={ci}
                    className={`px-1.5 py-2 text-[10px] font-black whitespace-nowrap text-center ${col.highlight ? 'bg-emerald-100 text-emerald-800 border-x border-emerald-200' : 'text-indigo-700'}`}
                    style={ai === 0 ? { position: 'sticky', left: 0, zIndex: 5, background: '#eef2ff', textAlign: 'center' } : {}}
                  >
                    {ai === 0 ? 'TOTAIS' : col.tipo === 'toggle' ? `${displayRows.filter(r => r.completo).length}/${displayRows.length} ✓` : totals[ai] !== null ? totals[ai].toFixed(2) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
