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
  { label: 'Trabalhador',              key: 'nome',        w: 150 },
  { label: 'NIF',                      key: 'nif',         w: 85  },
  { label: 'NIS',                      key: 'nis',         w: 85  },
  { label: 'Profissão',                key: 'profissao',   w: 100 },
  { label: 'Empresa',                  key: 'empresa',     w: 130 },
  { label: 'Início Vínculo',           key: 'inicioVinculo',  w: 88 },
  { label: 'Cessação Vínculo',         key: 'cessacaoVinculo',w: 88 },
  { label: 'Tabela IRS',               key: 'tabelaNome',  w: 82  },
  { label: 'Nº Dep.',                  key: 'nDep',        w: 54  },
  { label: 'Venc. Base (€)',           key: 'vencBase',    w: 84,  sum: '_vencNum'    },
  { label: 'Sub. Alim. Dias',          key: 'subsAlimDias',w: 64  },
  { label: 'Sub. Alim. €/dia',         key: 'subsAlimDia', w: 76  },
  { label: 'Sub. Alim. Total (€)',     key: 'subsAlimTotal',w: 84, sum: '_subsAlimNum'},
  { label: 'Sub. Férias / Duod. (€)', key: 'subsFerias',  w: 84,  sum: '_feriasNum'  },
  { label: 'Sub. Natal / Duod. (€)',  key: 'subsNatal',   w: 84,  sum: '_natalNum'   },
  { label: 'Ajudas Custo Inter. (€)', key: 'ajudas',      w: 84,  sum: '_ajudasNum'  },
  { label: 'Base IRS (€)',             key: 'baseIRS',     w: 76  },
  { label: 'Taxa IRS',                 key: 'taxaIRS',     w: 64  },
  { label: 'IRS (€)',                  key: 'irsTotal',    w: 70,  sum: '_irsNum'     },
  { label: 'SS Trab. 11% (€)',         key: 'ssTrab',      w: 80,  sum: '_ssTrabNum'  },
  { label: 'Total Abonos (€)',         key: 'totalAbonos', w: 84,  sum: '_abonosNum'  },
  { label: 'Total Descontos (€)',      key: 'totalDesc',   w: 84,  sum: '_descNum'    },
  { label: 'Líquido (€)',              key: 'liquido',     w: 76,  sum: '_liquidoNum' },
  { label: 'TSU Patronal 23,75% (€)', key: 'ssPatronal',  w: 84,  sum: '_ssPatNum'   },
  { label: 'Custo Empresa (€)',        key: 'custoEmpresa',w: 84,  sum: '_custoNum'   },
  { label: 'Ajuste (€)',               key: 'ajusteLabel', w: 74,  sum: '_ajusteNum'  },
  { label: 'Ordenado Bruto (€)',       key: 'brutoAlvo',   w: 96,  sum: '_brutoNum',  highlight: true },
  { label: 'Observação',               key: 'observacao',  w: 150 },
  { label: 'Completo',                 key: 'completo',    w: 64,  tipo: 'toggle' },
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

  // Colunas visíveis — sincronizadas com as escolhas do admin
  const [visibleCols, setVisibleCols] = useState(() => new Set(COLS.map((_, i) => i)));

  // Dados reactivos ao mês
  const [logs,      setLogs]      = useState([]);
  const [contab,    setContab]    = useState([]);
  const [obs,       setObs]       = useState({});
  const [completos, setCompletos] = useState({});
  const [ajustes,   setAjustes]   = useState({});
  const [loading,   setLoading]   = useState(true);

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

  // Carregar e sincronizar colunas visíveis definidas pelo admin
  useEffect(() => {
    if (!sb) return;

    const parseValor = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
      return null;
    };

    let lastHash = '';

    const syncCols = () =>
      sb.from('resumo_config').select('valor').eq('chave', 'visible_cols').maybeSingle()
        .then(({ data }) => {
          const arr = parseValor(data?.valor);
          if (!arr) return;
          const hash = [...arr].sort().join(',');
          if (hash === lastHash) return;
          lastHash = hash;
          setVisibleCols(new Set(arr));
        });

    syncCols(); // carrega imediatamente ao montar
    const interval = setInterval(syncCols, 3000); // polling a cada 3 s como fallback

    // Realtime como complemento (instantâneo quando funciona)
    const ch = sb.channel('pub_config_cols')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resumo_config' },
        ({ new: row }) => {
          if (row?.chave !== 'visible_cols') return;
          const arr = parseValor(row?.valor);
          if (arr) { lastHash = [...arr].sort().join(','); setVisibleCols(new Set(arr)); }
        })
      .subscribe();

    return () => { clearInterval(interval); sb.removeChannel(ch); };
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
      sb.from('resumo_observacoes').select('worker_id, observacao, completo, ajuste_bruto').eq('mes', ms),
    ]).then(([l, c, o]) => {
      setLogs(l.data || []);
      setContab(c.data || []);
      const obsMap = {}, compMap = {}, ajMap = {};
      (o.data || []).forEach(r => {
        obsMap[r.worker_id]  = r.observacao;
        compMap[r.worker_id] = !!r.completo;
        if (r.ajuste_bruto)  ajMap[r.worker_id] = parseFloat(r.ajuste_bruto) || 0;
      });
      setObs(obsMap);
      setCompletos(compMap);
      setAjustes(ajMap);
      setLoading(false);
    });

    // Subscrição real-time das observações, completo e ajuste
    const channel = sb.channel(`pub_obs_${ms}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'resumo_observacoes', filter: `mes=eq.${ms}`,
      }, ({ new: row, eventType }) => {
        if (!row?.worker_id) return;
        setObs(prev => eventType === 'DELETE'
          ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== row.worker_id))
          : { ...prev, [row.worker_id]: row.observacao || '' }
        );
        if (eventType !== 'DELETE') {
          setCompletos(prev => ({ ...prev, [row.worker_id]: !!row.completo }));
          setAjustes(prev =>   ({ ...prev, [row.worker_id]: parseFloat(row.ajuste_bruto) || 0 }));
        } else {
          setCompletos(prev => { const n = { ...prev }; delete n[row.worker_id]; return n; });
          setAjustes(prev =>   { const n = { ...prev }; delete n[row.worker_id]; return n; });
        }
      })
      .subscribe();

    // Polling como fallback quando Realtime não dispara
    const syncData = () =>
      sb.from('resumo_observacoes')
        .select('worker_id, observacao, completo, ajuste_bruto').eq('mes', ms)
        .then(({ data }) => {
          if (!data) return;
          const obsMap = {}, compMap = {}, ajMap = {};
          data.forEach(r => {
            obsMap[r.worker_id]  = r.observacao || '';
            compMap[r.worker_id] = !!r.completo;
            ajMap[r.worker_id]   = parseFloat(r.ajuste_bruto) || 0;
          });
          setObs(obsMap);
          setCompletos(compMap);
          setAjustes(ajMap);
        });
    const poll = setInterval(syncData, 4000);

    return () => { sb.removeChannel(channel); clearInterval(poll); };
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
        brutoAlvo:     eur2((brutoAlvo || 0) + (ajustes[w.id] || 0)),
        observacao:    obs[w.id] || '',
        completo:      completos[w.id] || false,
        ajusteLabel:   (() => { const v = ajustes[w.id] || 0; return v !== 0 ? (v > 0 ? '+' : '') + v.toFixed(2) : '—'; })(),
        _ajusteNum:    ajustes[w.id] || 0,
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
        _brutoNum:     (brutoAlvo || 0) + (ajustes[w.id] || 0),
      };
    });
  }, [staticReady, workers, clients, rateHistory, logs, contab, obs, completos, ajustes, ano]);

  const updateCompleto = (workerId, valor) => {
    setCompletos(prev => ({ ...prev, [workerId]: valor }));
    if (sb && workerId && ms) {
      sb.from('resumo_observacoes').upsert(
        { worker_id: workerId, mes: ms, completo: valor, observacao: obs[workerId] || '', ajuste_bruto: ajustes[workerId] || 0, updated_at: new Date().toISOString() },
        { onConflict: 'worker_id,mes' }
      ).then(({ error }) => { if (error) console.error('[resumo_obs] upsert completo erro:', error); });
    }
  };

  const mesLabel   = `${MESES_PT[mes] || ''} ${ano}`;
  const isReady    = staticReady && !loading;
  const activeCols = COLS.map((col, ci) => ({ col, ci })).filter(({ ci }) => visibleCols.has(ci));

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
                      className={`px-1.5 py-2 text-[9px] font-black uppercase tracking-wide text-center leading-tight ${col.highlight ? 'bg-emerald-700' : ''}`}
                      style={ai === 0 ? { position: 'sticky', left: 0, zIndex: 10, background: '#1e293b' } : {}}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className={row.completo ? 'bg-emerald-50' : ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    {activeCols.map(({ col, ci }, ai) => (
                      <td
                        key={ci}
                        className={`px-1.5 py-1.5 font-bold overflow-hidden ${col.highlight ? 'text-emerald-700 bg-emerald-50 border-x border-emerald-100' : 'text-slate-700'}`}
                        style={{
                          ...(ai === 0 ? { position: 'sticky', left: 0, zIndex: 5, background: row.completo ? '#ecfdf5' : ri % 2 === 0 ? '#ffffff' : '#f8fafc', boxShadow: '2px 0 4px -2px rgba(0,0,0,.08)' } : {}),
                          ...(col.tipo ? {} : { textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'center' }),
                        }}
                      >
                        {col.key === 'ajusteLabel' ? (
                          <span style={{ color: (ajustes[row.workerId] || 0) < 0 ? '#dc2626' : (ajustes[row.workerId] || 0) > 0 ? '#16a34a' : '#94a3b8' }}>
                            {row.ajusteLabel}
                          </span>
                        ) : col.tipo === 'toggle' ? (
                          <div className="flex justify-center">
                            <button
                              onClick={() => updateCompleto(row.workerId, !row.completo)}
                              title={row.completo ? 'Desmarcar como completo' : 'Marcar como completo'}
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                row.completo
                                  ? 'bg-emerald-500 text-white hover:bg-red-400 shadow-sm'
                                  : 'bg-white border-2 border-slate-300 text-transparent hover:border-emerald-400 hover:text-emerald-400'
                              }`}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </button>
                          </div>
                        ) : (
                          row[col.key]
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                  {activeCols.map(({ col, ci }, idx) => {
                    const val = col.sum ? rows.reduce((s, r) => s + (r[col.sum] || 0), 0) : null;
                    return (
                      <td
                        key={ci}
                        className={`px-1.5 py-2 text-[10px] font-black whitespace-nowrap text-right ${col.highlight ? 'bg-emerald-100 text-emerald-800 border-x border-emerald-200' : 'text-indigo-700'}`}
                        style={idx === 0 ? { position: 'sticky', left: 0, zIndex: 5, background: '#eef2ff', textAlign: 'left' } : {}}
                      >
                        {idx === 0 ? 'TOTAIS' : col.tipo === 'toggle' ? `${rows.filter(r => r.completo).length}/${rows.length} ✓` : val !== null ? val.toFixed(2) : ''}
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
