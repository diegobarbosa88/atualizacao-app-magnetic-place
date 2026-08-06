import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  calcularRecibo, getIRSTabelasPorAno, MESES_PT,
} from '../../lib/payroll/reciboCalculations.js';
import { getRateAtDate } from '../admin/cost-reports/useCostReportsData.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const sb = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const EMPRESA = { nome: 'Magnetic Place Unipessoal, Lda', nif: '517379740' };

const COLS = [
  { label: 'Trabalhador',             key: 'nome' },
  { label: 'NIF',                     key: 'nif' },
  { label: 'NIS',                     key: 'nis' },
  { label: 'Profissão',               key: 'profissao' },
  { label: 'Empresa',                 key: 'empresa' },
  { label: 'Início Vínculo',          key: 'inicioVinculo' },
  { label: 'Cessação Vínculo',        key: 'cessacaoVinculo' },
  { label: 'Tabela IRS',              key: 'tabelaNome' },
  { label: 'Nº Dep.',                 key: 'nDep' },
  { label: 'Venc. Base (€)',          key: 'vencBase',      sum: '_vencNum' },
  { label: 'Sub. Alim. Dias',         key: 'subsAlimDias' },
  { label: 'Sub. Alim. €/dia',        key: 'subsAlimDia' },
  { label: 'Sub. Alim. Total (€)',    key: 'subsAlimTotal', sum: '_subsAlimNum' },
  { label: 'Sub. Férias / Duod. (€)', key: 'subsFerias',    sum: '_feriasNum' },
  { label: 'Sub. Natal / Duod. (€)',  key: 'subsNatal',     sum: '_natalNum' },
  { label: 'Ajudas Custo Inter. (€)', key: 'ajudas',        sum: '_ajudasNum' },
  { label: 'Base IRS (€)',            key: 'baseIRS' },
  { label: 'Taxa IRS',                key: 'taxaIRS' },
  { label: 'IRS (€)',                 key: 'irsTotal',      sum: '_irsNum' },
  { label: 'SS Trab. 11% (€)',        key: 'ssTrab',        sum: '_ssTrabNum' },
  { label: 'Total Abonos (€)',        key: 'totalAbonos',   sum: '_abonosNum' },
  { label: 'Total Descontos (€)',     key: 'totalDesc',     sum: '_descNum' },
  { label: 'Líquido (€)',             key: 'liquido',       sum: '_liquidoNum' },
  { label: 'TSU Patronal 23,75% (€)', key: 'ssPatronal',    sum: '_ssPatNum' },
  { label: 'Custo Empresa (€)',       key: 'custoEmpresa',  sum: '_custoNum' },
  { label: 'Observação',              key: 'observacao' },
  { label: 'Ordenado Bruto (€)',      key: 'brutoAlvo',     sum: '_brutoNum', highlight: true },
];

function parseMes(str) {
  const [a, m] = (str || '').split('-');
  return { ano: parseInt(a) || new Date().getFullYear(), mes: parseInt(m) || new Date().getMonth() + 1 };
}
function toMesStr(ano, mes) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

export default function ResumoMensalPublico() {
  const params   = new URLSearchParams(window.location.search);
  const inicial  = params.get('mes') || toMesStr(new Date().getFullYear(), new Date().getMonth() + 1);
  const { ano: a0, mes: m0 } = parseMes(inicial);

  const [ano, setAno] = useState(a0);
  const [mes, setMes] = useState(m0);

  // Dados estáticos — carregados uma vez
  const [workers,     setWorkers]     = useState([]);
  const [clients,     setClients]     = useState([]);
  const [rateHistory, setRateHistory] = useState([]);
  const [staticReady, setStaticReady] = useState(false);

  // Dados reactivos ao mês
  const [logs,    setLogs]    = useState([]);
  const [contab,  setContab]  = useState([]);
  const [obs,     setObs]     = useState({});
  const [loading, setLoading] = useState(true);

  const ms = toMesStr(ano, mes);

  // Carregar workers, clients, historico de taxas uma vez
  useEffect(() => {
    if (!sb) return;
    Promise.all([
      sb.from('workers').select('*').limit(1000),
      sb.from('clients').select('*').limit(1000),
      sb.from('worker_valorhora_history').select('*').limit(5000),
    ]).then(([w, c, r]) => {
      setWorkers(w.data || []);
      setClients(c.data || []);
      setRateHistory(r.data || []);
      setStaticReady(true);
    });
  }, []);

  // Carregar logs (filtrados pelo mês), contabilidade e observações quando o mês muda
  useEffect(() => {
    if (!sb) return;
    setLoading(true);

    // Calcular intervalo do mês
    const dataInicio = `${ms}-01`;
    const nextMes    = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;

    Promise.all([
      sb.from('logs').select('*').gte('date', dataInicio).lt('date', nextMes).limit(5000),
      sb.from('contabilidade_mensal').select('*').eq('mes', ms),
      sb.from('resumo_observacoes').select('worker_id, observacao').eq('mes', ms),
    ]).then(([l, c, o]) => {
      setLogs(l.data || []);
      setContab(c.data || []);
      const map = {};
      (o.data || []).forEach(r => { map[r.worker_id] = r.observacao; });
      setObs(map);
      setLoading(false);
    });

    // Subscrição real-time das observações
    const channel = sb.channel(`pub_obs_${ms}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'resumo_observacoes', filter: `mes=eq.${ms}`,
      }, ({ new: row, eventType }) => {
        if (!row?.worker_id) return;
        setObs(prev => eventType === 'DELETE'
          ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== row.worker_id))
          : { ...prev, [row.worker_id]: row.observacao || '' }
        );
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [ms]);

  function navMes(dir) {
    let m = mes + dir, a = ano;
    if (m > 12) { m = 1; a++; }
    if (m < 1)  { m = 12; a--; }
    setMes(m); setAno(a);
    window.history.replaceState(null, '', `?mes=${toMesStr(a, m)}`);
  }

  const rows = useMemo(() => {
    if (!staticReady) return [];

    const eur2 = v => (isNaN(v) ? 0 : v).toFixed(2);
    const pct2 = v => (v * 100).toFixed(2) + '%';
    const fmtData = d => d ? String(d).split('T')[0] : '';

    const ativos = workers
      .filter(w => w.is_active !== false && w.vencimento_base != null)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return ativos.map(w => {
      // Logs deste trabalhador no mês (campo workerId — camelCase, igual ao admin)
      const workerLogs = logs.filter(l => l.workerId === w.id);
      const hist       = rateHistory.filter(h => h.worker_id === w.id);

      // Bruto alvo: horas × taxa histórica (igual à lógica do admin)
      const brutoAlvo = workerLogs.reduce((s, l) => {
        const rate = getRateAtDate(l.date, hist, parseFloat(w.valorHora) || 0);
        return s + (parseFloat(l.hours) || 0) * rate;
      }, 0);

      const contabRow    = contab.find(r => r.worker_id === w.id);
      const subsAlimDias = Number(contabRow?.dias_trabalhados ?? 22);

      const rc = calcularRecibo({
        vencimentoBase:   parseFloat(w.vencimento_base) || 0,
        horasSemana: 40, premios: 0, he1: 0, he2: 0,
        incluirFerias: true, incluirNatal: true,
        subsAlimValorDia: parseFloat(w.subsidio_alimentacao_dia) || 0,
        subsAlimDias, subsAlimTipo: 'cartao',
        tabelaKey:    w.tabela_irs || 'tabelaI',
        nDependentes: w.n_dependentes ?? 0,
        brutoAlvo:    brutoAlvo || parseFloat(w.vencimento_base) || 0,
        territorio: 'internacional', funcao: 'geral', ano,
      });

      const tabelaNome = (getIRSTabelasPorAno(ano)[w.tabela_irs || 'tabelaI'] || {}).nome || 'Tabela I';

      // Empresa: clientes únicos nos logs do mês (campo clientId — camelCase)
      const empresa = [...new Set(workerLogs.map(l => l.clientId).filter(Boolean))]
        .map(id => clients.find(c => c.id === id)?.name || '')
        .filter(Boolean).join(' / ');

      return {
        workerId: w.id, nome: w.name || '', nif: w.nif || '', nis: w.nis || '',
        profissao: w.profissao || '', empresa: empresa || '—',
        inicioVinculo: fmtData(w.dataInicio), cessacaoVinculo: fmtData(w.dataFim),
        tabelaNome, nDep: String(w.n_dependentes ?? 0),
        vencBase:      eur2(parseFloat(w.vencimento_base)),
        subsAlimDias:  String(subsAlimDias),
        subsAlimDia:   eur2(parseFloat(w.subsidio_alimentacao_dia) || 0),
        subsAlimTotal: eur2(rc.subsAlimTotal),
        subsFerias:    eur2(rc.subsFerias),
        subsNatal:     eur2(rc.subsNatal),
        ajudas:        eur2(rc.ajudaCustoNecessaria),
        baseIRS:       eur2(rc.incidenciaIRS),
        taxaIRS:       pct2(rc.taxaEfIRS),
        irsTotal:      eur2(rc.irsTotal),
        ssTrab:        eur2(rc.ssTrabalhador),
        totalAbonos:   eur2(rc.totalAbonos),
        totalDesc:     eur2(rc.totalDescontos),
        liquido:       eur2(rc.liquido),
        ssPatronal:    eur2(rc.ssPatronal),
        custoEmpresa:  eur2(rc.custoEmpresa),
        brutoAlvo:     eur2(brutoAlvo),
        observacao:    obs[w.id] || '',
        _vencNum:      parseFloat(w.vencimento_base) || 0,
        _subsAlimNum:  rc.subsAlimTotal,
        _feriasNum:    rc.subsFerias,
        _natalNum:     rc.subsNatal,
        _ajudasNum:    rc.ajudaCustoNecessaria,
        _irsNum:       rc.irsTotal,
        _ssTrabNum:    rc.ssTrabalhador,
        _abonosNum:    rc.totalAbonos,
        _descNum:      rc.totalDescontos,
        _liquidoNum:   rc.liquido,
        _ssPatNum:     rc.ssPatronal,
        _custoNum:     rc.custoEmpresa,
        _brutoNum:     brutoAlvo,
      };
    });
  }, [staticReady, workers, clients, rateHistory, logs, contab, obs, ano]);

  const mesLabel = `${MESES_PT[mes] || ''} ${ano}`;
  const isReady  = staticReady && !loading;

  if (!sb) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-slate-500 font-bold">Configuração Supabase em falta.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between gap-4 shadow-lg flex-wrap">
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Resumo Mensal Salarial</p>
          <p className="text-sm font-black text-white">{EMPRESA.nome} · NIF {EMPRESA.nif}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navMes(-1)} className="p-2 rounded-xl hover:bg-slate-700 transition-all">
            <ChevronLeft size={16} />
          </button>
          <span className="font-black text-base min-w-44 text-center">{mesLabel}</span>
          <button onClick={() => navMes(1)} className="p-2 rounded-xl hover:bg-slate-700 transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Vista partilhada · só leitura</p>
          {isReady && <p className="text-[10px] text-slate-400">{rows.length} trabalhadores · {logs.length} registos</p>}
        </div>
      </div>

      {/* Tabela */}
      <div className="p-4">
        {!isReady ? (
          <div className="py-24 flex items-center justify-center gap-3 text-slate-400">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-sm font-bold">A carregar dados…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-24 text-center text-slate-400">
            <p className="text-sm font-black uppercase tracking-wide">Sem dados para {mesLabel}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
            <table className="border-collapse text-xs" style={{ minWidth: '1800px', width: '100%' }}>
              <thead>
                <tr className="bg-slate-800 text-white">
                  {COLS.map((col, ci) => (
                    <th key={ci} className={`px-3 py-3 text-[10px] font-black uppercase tracking-wide text-center whitespace-nowrap ${col.highlight ? 'bg-emerald-700' : ''}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    {COLS.map((col, ci) => (
                      <td key={ci} className={`px-3 py-2 text-center whitespace-nowrap font-bold ${col.highlight ? 'text-emerald-700 bg-emerald-50 border-x border-emerald-100' : 'text-slate-700'}`}>
                        {row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                  {COLS.map((col, ci) => {
                    const val = col.sum ? rows.reduce((s, r) => s + (r[col.sum] || 0), 0) : null;
                    return (
                      <td key={ci} className={`px-3 py-2.5 text-center text-xs font-black whitespace-nowrap ${col.highlight ? 'bg-emerald-100 text-emerald-800 border-x border-emerald-200' : 'text-indigo-700'}`}>
                        {ci === 0 ? 'TOTAIS' : val !== null ? val.toFixed(2) : ''}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="px-6 py-4 text-center text-[10px] text-slate-400 font-bold">
        Estimativa — não oficial · Valores calculados com base nas tabelas IRS {ano} e TSU em vigor · Confirme sempre no TOConline
      </div>
    </div>
  );
}
