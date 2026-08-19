import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, Loader2, ChevronDown, ChevronRight, CheckCircle2, XCircle, Circle, History, Calculator, ArrowRight, AlertTriangle, TrendingUp, Scale } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { sugerirElegibilidade } from '../../lib/ajudas/elegibilidade';
import { executarCalculoFase1 } from '../../lib/ajudas/percentagemHistorica';
import { calcularEstimativaMensal } from '../../lib/ajudas/estimativaMensal';
import { verificarFechoMes, fecharReconciliacaoMes, SALDO_ACUMULADO_INICIAL } from '../../lib/ajudas/reconciliacao';
import { calcularFaturacaoCliente } from '../../lib/faturacao/tarifaHistorica.js';

const TABS = [
  { id: 'elegibilidade', label: 'Elegibilidade de Clientes', icon: Users },
  { id: 'historico', label: 'Histórico', icon: History },
  { id: 'estimativa', label: 'Estimativa Mensal', icon: TrendingUp },
  { id: 'reconciliacao', label: 'Reconciliação', icon: Scale },
];

function fmtEur(v) {
  return (Number(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function fmtPct(v) {
  return ((Number(v) || 0) * 100).toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}
function fmtHoras(v) {
  return (Number(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'h';
}

// Mês corrente e os 5 anteriores, em 'YYYY-MM', para os seletores de período
function ultimosMeses(n) {
  const hoje = new Date();
  const meses = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return meses.reverse();
}

function EvidenciaExpandida({ evidencia }) {
  return (
    <tr>
      <td colSpan={5} className="px-0 py-0 bg-slate-50">
        <div className="px-6 py-3 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-slate-400 uppercase tracking-widest font-black">
                <th className="text-left py-1 pr-3">Mês</th>
                <th className="text-left py-1 pr-3">Trabalhador</th>
                <th className="text-right py-1 pr-3">Horas Cliente</th>
                <th className="text-right py-1 pr-3">Horas Totais do Mês</th>
                <th className="text-right py-1 pr-3">% Horas</th>
                <th className="text-right py-1 pr-3">Ajuda do Mês</th>
                <th className="text-right py-1">Ajuda Atribuída</th>
              </tr>
            </thead>
            <tbody>
              {evidencia.map((ev, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3 font-mono text-slate-600">{ev.mes}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{ev.workerId}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-700">{fmtHoras(ev.horasCliente)}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-400">{fmtHoras(ev.horasTotalTrabalhadorNoMes)}</td>
                  <td className="py-1.5 pr-3 text-right font-bold" style={{ color: '#1B3A57' }}>{fmtPct(ev.pctHorasCliente)}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-400">{fmtEur(ev.ajudaCustoDoMes)}</td>
                  <td className="py-1.5 text-right font-bold text-slate-700">{fmtEur(ev.ajudaAtribuidaProporcional)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

function LinhaCliente({ candidato, nomeCliente, decisao, onDecidir, salvando, expandido, onToggleExpandir }) {
  const ajudaTotalAtribuida = candidato.evidencia.reduce((s, e) => s + e.ajudaAtribuidaProporcional, 0);
  const horasTotalCliente = candidato.evidencia.reduce((s, e) => s + e.horasCliente, 0);
  const pctTopo = candidato.evidencia[0]?.pctHorasCliente ?? 0;
  const elegivel = decisao?.elegivel_ajudas_custo;

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors">
        <td className="px-4 py-3">
          <button onClick={onToggleExpandir} className="flex items-center gap-2 text-left">
            {expandido ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
            <span className="font-semibold text-slate-800">{nomeCliente || candidato.clientId}</span>
          </button>
        </td>
        <td className="px-4 py-3 text-right text-slate-600">{fmtHoras(horasTotalCliente)}</td>
        <td className="px-4 py-3 text-right font-bold" style={{ color: '#1B3A57' }}>{fmtPct(pctTopo)}</td>
        <td className="px-4 py-3 text-right text-slate-700">{fmtEur(ajudaTotalAtribuida)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-center gap-1.5">
            {salvando ? (
              <Loader2 size={16} className="animate-spin text-slate-400" />
            ) : (
              <>
                <button
                  onClick={() => onDecidir(true)}
                  title="Marcar como elegível"
                  className={`p-2 rounded-xl transition-all ${elegivel === true ? 'bg-emerald-100 text-emerald-700' : 'text-slate-300 hover:bg-emerald-50 hover:text-emerald-600'}`}
                >
                  <CheckCircle2 size={16} />
                </button>
                <button
                  onClick={() => onDecidir(false)}
                  title="Marcar como não elegível"
                  className={`p-2 rounded-xl transition-all ${elegivel === false ? 'bg-rose-100 text-rose-700' : 'text-slate-300 hover:bg-rose-50 hover:text-rose-600'}`}
                >
                  <XCircle size={16} />
                </button>
                {elegivel == null && (
                  <span title="Por decidir" className="p-2 text-amber-400"><Circle size={16} /></span>
                )}
              </>
            )}
          </div>
        </td>
      </tr>
      {expandido && <EvidenciaExpandida evidencia={candidato.evidencia} />}
    </>
  );
}

// Cliente com fatura(s) no período mas ZERO evidência em
// sugerirElegibilidade() (nenhum trabalhador com ajuda de custo extraída
// ligado a este cliente via logs) — mesmo toggle elegível/não elegível,
// sem tabela de evidência porque não há nenhuma para mostrar.
function LinhaClienteSemEvidencia({ clientId, nomeCliente, decisao, onDecidir, salvando }) {
  const elegivel = decisao?.elegivel_ajudas_custo;
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <span className="font-semibold text-slate-800">{nomeCliente || clientId}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-1.5">
          {salvando ? (
            <Loader2 size={16} className="animate-spin text-slate-400" />
          ) : (
            <>
              <button
                onClick={() => onDecidir(true)}
                title="Marcar como elegível"
                className={`p-2 rounded-xl transition-all ${elegivel === true ? 'bg-emerald-100 text-emerald-700' : 'text-slate-300 hover:bg-emerald-50 hover:text-emerald-600'}`}
              >
                <CheckCircle2 size={16} />
              </button>
              <button
                onClick={() => onDecidir(false)}
                title="Marcar como não elegível"
                className={`p-2 rounded-xl transition-all ${elegivel === false ? 'bg-rose-100 text-rose-700' : 'text-slate-300 hover:bg-rose-50 hover:text-rose-600'}`}
              >
                <XCircle size={16} />
              </button>
              {elegivel == null && (
                <span title="Por decidir" className="p-2 text-amber-400"><Circle size={16} /></span>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function ElegibilidadeClientesTab() {
  const { supabase, currentUser } = useApp();
  const meses = useMemo(() => ultimosMeses(12), []);
  const [periodoInicio, setPeriodoInicio] = useState(meses[0]);
  const [periodoFim, setPeriodoFim] = useState(meses[meses.length - 1]);
  const [candidatos, setCandidatos] = useState([]);
  const [clientesMap, setClientesMap] = useState({});
  const [decisoes, setDecisoes] = useState({});
  const [clientesSemEvidencia, setClientesSemEvidencia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [salvandoId, setSalvandoId] = useState(null);
  const [expandidos, setExpandidos] = useState(new Set());

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setErro(null);
    try {
      const [candidatosResult, { data: clientesData, error: errClientes }, { data: logsData, error: errLogs }] = await Promise.all([
        sugerirElegibilidade({ periodoInicio, periodoFim, dbClient: supabase }),
        supabase.from('clients').select(
          'id, name, elegivel_ajudas_custo, elegibilidade_confirmado_em, elegibilidade_confirmado_por'
        ),
        // Mesma fonte que o gate da Fase 2b usa para decidir quem bloqueia:
        // um cliente só é bloqueado quando está prestes a ser faturado, e
        // isso acontece quando tem horas registadas no período (é isso que
        // calcularFaturacaoCliente transforma em valor a faturar — ver
        // FaturarClienteModal.jsx). Faturas já emitidas no TOConline NÃO
        // servem aqui: um cliente pode ter horas este mês e ainda não ter
        // nenhuma fatura emitida (é exatamente esse o caso da ADITEK e da
        // Magnetic Place) — usar só faturas já emitidas deixava-os de fora.
        supabase.from('logs').select('clientId, hours, date')
          .gte('date', `${periodoInicio}-01`)
          .lte('date', `${periodoFim}-31`),
      ]);
      if (errClientes) throw errClientes;
      if (errLogs) throw errLogs;

      setCandidatos(candidatosResult);

      const nomeMap = {};
      const decMap = {};
      (clientesData || []).forEach(c => {
        nomeMap[c.id] = c.name;
        decMap[c.id] = {
          elegivel_ajudas_custo: c.elegivel_ajudas_custo,
          confirmado_em: c.elegibilidade_confirmado_em,
          confirmado_por: c.elegibilidade_confirmado_por,
        };
      });
      setClientesMap(nomeMap);
      setDecisoes(decMap);

      const idsComEvidencia = new Set(candidatosResult.map(c => c.clientId));
      const idsComHoras = new Set();
      (logsData || []).forEach(l => {
        if (l.clientId && (parseFloat(l.hours) || 0) > 0) idsComHoras.add(l.clientId);
      });
      const semEvidencia = [...idsComHoras]
        .filter(id => !idsComEvidencia.has(id))
        .map(id => ({ clientId: id, nome: nomeMap[id] }));
      setClientesSemEvidencia(semEvidencia);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar elegibilidade');
    } finally {
      setLoading(false);
    }
  }, [supabase, periodoInicio, periodoFim]);

  useEffect(() => { carregar(); }, [carregar]);

  const decidir = async (clientId, elegivel) => {
    if (!supabase) return;
    const candidato = candidatos.find(c => c.clientId === clientId);
    setSalvandoId(clientId);
    try {
      const agora = new Date().toISOString();
      const confirmadoPor = currentUser?.name || currentUser?.email || currentUser?.id || 'admin';
      const { error } = await supabase
        .from('clients')
        .update({
          elegivel_ajudas_custo: elegivel,
          elegibilidade_evidencia: candidato?.evidencia ?? null,
          elegibilidade_confirmado_em: agora,
          elegibilidade_confirmado_por: confirmadoPor,
        })
        .eq('id', clientId);
      if (error) throw error;

      setDecisoes(prev => ({
        ...prev,
        [clientId]: { elegivel_ajudas_custo: elegivel, confirmado_em: agora, confirmado_por: confirmadoPor },
      }));
    } catch (e) {
      setErro(e.message || 'Erro ao gravar decisão');
    } finally {
      setSalvandoId(null);
    }
  };

  const toggleExpandir = (clientId) => {
    setExpandidos(prev => {
      const n = new Set(prev);
      n.has(clientId) ? n.delete(clientId) : n.add(clientId);
      return n;
    });
  };

  const decididos = candidatos.filter(c => decisoes[c.clientId]?.elegivel_ajudas_custo != null).length;
  const porDecidir = candidatos.length - decididos;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-sm font-black text-slate-800">Elegibilidade de Clientes</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Pré-requisito bloqueante: nenhum cálculo de % histórica avança enquanto houver clientes por decidir.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={periodoInicio}
              onChange={e => setPeriodoInicio(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
            >
              {meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="text-xs text-slate-400">até</span>
            <select
              value={periodoFim}
              onChange={e => setPeriodoFim(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
            >
              {meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={13} /> {decididos} decidido{decididos !== 1 ? 's' : ''}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest ${porDecidir > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-400'}`}>
            <Circle size={13} /> {porDecidir} por decidir
          </span>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-300">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : candidatos.length === 0 ? (
          <div className="px-5 py-16 text-center text-slate-400 text-xs font-semibold">
            Nenhum cliente candidato neste período — sem ajudas de custo extraídas ou sem horas associadas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Horas no Cliente</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">% Horas do Trabalhador</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Ajuda Atribuída (€)</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Decisão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {candidatos.map(candidato => (
                  <LinhaCliente
                    key={candidato.clientId}
                    candidato={candidato}
                    nomeCliente={clientesMap[candidato.clientId]}
                    decisao={decisoes[candidato.clientId]}
                    onDecidir={elegivel => decidir(candidato.clientId, elegivel)}
                    salvando={salvandoId === candidato.clientId}
                    expandido={expandidos.has(candidato.clientId)}
                    onToggleExpandir={() => toggleExpandir(candidato.clientId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {clientesSemEvidencia.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-amber-50/50">
            <h3 className="text-xs font-black text-slate-800">Sem evidência de ajudas de custo</h3>
            <p className="text-[11px] text-amber-700 mt-1">
              Estes clientes têm horas registadas no período (vão gerar fatura) mas nenhum trabalhador com ajuda
              de custo detetada nos recibos está ligado a eles via registos de horas — por isso nunca aparecem
              como candidatos acima. Sem trabalhadores com ajuda de custo detetada — provavelmente não elegível,
              mas confirma. O gate de emissão de faturas (Fase 2b) exige uma decisão para estes clientes na
              mesma, mesmo sem evidência.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Decisão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {clientesSemEvidencia.map(c => (
                  <LinhaClienteSemEvidencia
                    key={c.clientId}
                    clientId={c.clientId}
                    nomeCliente={clientesMap[c.clientId] || c.nome}
                    decisao={decisoes[c.clientId]}
                    onDecidir={elegivel => decidir(c.clientId, elegivel)}
                    salvando={salvandoId === c.clientId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CardClientesPorDecidir({ clientes, onIrParaElegibilidade }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2 text-amber-800">
        <AlertTriangle size={16} />
        <h3 className="text-sm font-black">Cálculo bloqueado — clientes por decidir</h3>
      </div>
      <p className="text-xs text-amber-700">
        Há {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} com faturas de receita no período mas sem
        decisão de elegibilidade confirmada. A % histórica não pode ser calculada até resolveres isto.
      </p>
      <ul className="space-y-1">
        {clientes.map(c => (
          <li key={c.clientId} className="text-xs font-semibold text-amber-800">• {c.nome || c.clientId}</li>
        ))}
      </ul>
      <button
        onClick={onIrParaElegibilidade}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90"
        style={{ backgroundColor: '#EB8D00' }}
      >
        Ir para Elegibilidade de Clientes <ArrowRight size={13} />
      </button>
    </div>
  );
}

function CardPercentagem({ titulo, registo, destaque }) {
  if (!registo) return null;
  return (
    <div className={`rounded-2xl border p-5 space-y-3 ${destaque ? 'bg-white border-emerald-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{titulo}</h3>
        {destaque && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={11} /> Ativa
          </span>
        )}
      </div>
      <p className="text-3xl font-black" style={{ color: '#1B3A57' }}>{fmtPct(registo.percentagem)}</p>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-slate-400 font-semibold">Período</p>
          <p className="text-slate-700 font-bold">{registo.periodo_inicio} a {registo.periodo_fim}</p>
        </div>
        <div>
          <p className="text-slate-400 font-semibold">Calculado em</p>
          <p className="text-slate-700 font-bold">{registo.calculado_em ? new Date(registo.calculado_em).toLocaleString('pt-PT') : '—'}</p>
        </div>
        <div>
          <p className="text-slate-400 font-semibold">Total Ajudas Real</p>
          <p className="text-slate-700 font-bold">{fmtEur(registo.total_ajudas_real)}</p>
        </div>
        <div>
          <p className="text-slate-400 font-semibold">Total Faturamento Elegível</p>
          <p className="text-slate-700 font-bold">{fmtEur(registo.total_bruto_referencia)}</p>
        </div>
        <div>
          <p className="text-slate-400 font-semibold">Calculado por</p>
          <p className="text-slate-700 font-bold">{registo.criado_por || '—'}</p>
        </div>
        <div>
          <p className="text-slate-400 font-semibold">Meses incluídos</p>
          <p className="text-slate-700 font-bold">{(registo.meses_incluidos || []).length}</p>
        </div>
      </div>
      {(registo.meses_excluidos || []).length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Meses excluídos</p>
          <ul className="space-y-0.5">
            {registo.meses_excluidos.map((m, i) => (
              <li key={i} className="text-[11px] text-slate-500"><span className="font-mono font-bold">{m.mes}</span> — {m.motivo}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function HistoricoTab({ onIrParaElegibilidade }) {
  const { supabase, currentUser } = useApp();
  const meses = useMemo(() => ultimosMeses(12), []);
  const [periodoInicio, setPeriodoInicio] = useState(meses[0]);
  const [periodoFim, setPeriodoFim] = useState(meses[meses.length - 1]);

  const [ativo, setAtivo] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loadingLista, setLoadingLista] = useState(false);

  const [resultado, setResultado] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState(null);

  const [novoRegistoId, setNovoRegistoId] = useState(null);
  const [ativando, setAtivando] = useState(false);
  const [gravandoLinhas, setGravandoLinhas] = useState(false);
  const [linhasGravadas, setLinhasGravadas] = useState(false);

  const carregarLista = useCallback(async () => {
    if (!supabase) return;
    setLoadingLista(true);
    try {
      const { data, error } = await supabase
        .from('ajudas_percentagem_historica')
        .select('*')
        .order('calculado_em', { ascending: false });
      if (error) throw error;
      const lista = data || [];
      setAtivo(lista.find(r => r.ativo) || null);
      setHistorico(lista.filter(r => !r.ativo));
    } catch (e) {
      setErro(e.message || 'Erro ao carregar histórico');
    } finally {
      setLoadingLista(false);
    }
  }, [supabase]);

  useEffect(() => { carregarLista(); }, [carregarLista]);

  const recalcular = async () => {
    if (!supabase) return;
    setCalculando(true);
    setErro(null);
    setResultado(null);
    setNovoRegistoId(null);
    setLinhasGravadas(false);
    try {
      const r = await executarCalculoFase1({ periodoInicio, periodoFim, dbClient: supabase });
      setResultado(r);
    } catch (e) {
      setErro(e.message || 'Erro ao calcular % histórica');
    } finally {
      setCalculando(false);
    }
  };

  // Ação 1, explícita: marca o novo cálculo como ativo. Desativa o anterior
  // primeiro (update sequencial), só depois insere o novo — nunca dois
  // registos ativos em simultâneo (o índice único também garante isto a
  // nível de base de dados).
  const confirmarAtivacao = async () => {
    if (!supabase || !resultado || resultado.bloqueado) return;
    setAtivando(true);
    setErro(null);
    try {
      const { error: errDesativar } = await supabase
        .from('ajudas_percentagem_historica')
        .update({ ativo: false })
        .eq('ativo', true);
      if (errDesativar) throw errDesativar;

      const criadoPor = currentUser?.name || currentUser?.email || currentUser?.id || 'admin';
      const { data: inserido, error: errInserir } = await supabase
        .from('ajudas_percentagem_historica')
        .insert({
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          percentagem: resultado.percentagem,
          total_ajudas_real: resultado.totalAjudasReal,
          total_bruto_referencia: resultado.totalBrutoReferencia,
          clientes_elegiveis: resultado.clientesElegiveis,
          meses_incluidos: resultado.mesesIncluidos,
          meses_excluidos: resultado.mesesExcluidos,
          ativo: true,
          criado_por: criadoPor,
        })
        .select()
        .single();
      if (errInserir) throw errInserir;

      setNovoRegistoId(inserido.id);
      await carregarLista();
    } catch (e) {
      setErro(e.message || 'Erro ao ativar % histórica');
    } finally {
      setAtivando(false);
    }
  };

  // Ação 2, separada e só possível depois da Ação 1: grava as linhas de
  // auditoria retroativa em ajudas_estimativas_fatura (origem:'historico').
  const confirmarGravacaoLinhas = async () => {
    if (!supabase || !resultado || !novoRegistoId) return;
    setGravandoLinhas(true);
    setErro(null);
    try {
      const linhas = resultado.linhasHistoricas.map(l => ({ ...l, percentagem_historica_id: novoRegistoId }));
      if (linhas.length > 0) {
        const { error } = await supabase
          .from('ajudas_estimativas_fatura')
          .upsert(linhas, { onConflict: 'mes,client_id,fatura_id' });
        if (error) throw error;
      }
      setLinhasGravadas(true);
    } catch (e) {
      setErro(e.message || 'Erro ao gravar linhas históricas');
    } finally {
      setGravandoLinhas(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-sm font-black text-slate-800">Histórico — Fase 1</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Percentagem média que a ajuda de custo representa sobre o faturamento elegível. Fica fixa até recálculo manual explícito.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600">
            {meses.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <span className="text-xs text-slate-400">até</span>
          <select value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600">
            {meses.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button
            onClick={recalcular}
            disabled={calculando}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#1B3A57' }}
          >
            {calculando ? <Loader2 size={13} className="animate-spin" /> : <Calculator size={13} />}
            Recalcular % Histórica
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      {resultado?.bloqueado && (
        <CardClientesPorDecidir clientes={resultado.clientesPorDecidir} onIrParaElegibilidade={onIrParaElegibilidade} />
      )}

      {resultado && !resultado.bloqueado && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Pré-visualização do novo cálculo</h3>
          <CardPercentagem
            titulo="Novo cálculo (ainda não ativo)"
            registo={{
              percentagem: resultado.percentagem,
              periodo_inicio: periodoInicio,
              periodo_fim: periodoFim,
              total_ajudas_real: resultado.totalAjudasReal,
              total_bruto_referencia: resultado.totalBrutoReferencia,
              meses_incluidos: resultado.mesesIncluidos,
              meses_excluidos: resultado.mesesExcluidos,
              criado_por: currentUser?.name || currentUser?.email,
            }}
          />
          <p className="text-xs text-slate-500">
            {resultado.linhasHistoricas.length} linha{resultado.linhasHistoricas.length !== 1 ? 's' : ''} de auditoria retroativa
            pronta{resultado.linhasHistoricas.length !== 1 ? 's' : ''} para gravar em <code>ajudas_estimativas_fatura</code> (origem: histórico).
          </p>
          {resultado.semClienteCorrespondente?.length > 0 && (
            <p className="text-xs text-amber-600">
              ⚠ {resultado.semClienteCorrespondente.length} fatura(s) com nome de cliente sem correspondência em `clients` — excluídas do cálculo.
            </p>
          )}

          {!novoRegistoId ? (
            <button
              onClick={confirmarAtivacao}
              disabled={ativando}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#EB8D00', color: '#1B3A57' }}
            >
              {ativando ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Confirmar e Marcar como Ativa
            </button>
          ) : !linhasGravadas ? (
            <button
              onClick={confirmarGravacaoLinhas}
              disabled={gravandoLinhas}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#1B3A57' }}
            >
              {gravandoLinhas ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />}
              Gravar Linhas Históricas em ajudas_estimativas_fatura
            </button>
          ) : (
            <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 size={14} /> % ativada e linhas históricas gravadas.
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">% Ativa Atual</h3>
        {loadingLista ? (
          <div className="flex items-center justify-center py-8 text-slate-300"><Loader2 size={20} className="animate-spin" /></div>
        ) : ativo ? (
          <CardPercentagem titulo="Percentagem Ativa" registo={ativo} destaque />
        ) : (
          <p className="text-xs text-slate-400">Nenhuma % histórica ativa ainda.</p>
        )}
      </div>

      {historico.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Cálculos Anteriores</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Período</th>
                  <th className="px-4 py-2 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">%</th>
                  <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Calculado em</th>
                  <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {historico.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-slate-600">{r.periodo_inicio} a {r.periodo_fim}</td>
                    <td className="px-4 py-2 text-right font-bold text-slate-700">{fmtPct(r.percentagem)}</td>
                    <td className="px-4 py-2 text-slate-500">{r.calculado_em ? new Date(r.calculado_em).toLocaleString('pt-PT') : '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{r.criado_por || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function EstimativaMensalTab({ onIrParaElegibilidade }) {
  const { supabase, clients, logs } = useApp();
  const meses = useMemo(() => ultimosMeses(12), []);
  const [mes, setMes] = useState(meses[meses.length - 1]);

  const [ativo, setAtivo] = useState(null);
  const [clientesMap, setClientesMap] = useState({});
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const calcular = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setErro(null);
    try {
      const [{ data: ativoData }, { data: clientRateHistory }] = await Promise.all([
        supabase.from('ajudas_percentagem_historica').select('*').eq('ativo', true).maybeSingle(),
        supabase.from('client_valorhora_history').select('*'),
      ]);
      setAtivo(ativoData || null);
      setClientesMap(Object.fromEntries((clients || []).map(c => [c.id, c.name])));

      // Aproximação de faturasDoMes: horas × tarifa histórica por cliente
      // (mesma fórmula de Custos → Clientes e do FaturarClienteModal) — a
      // fatura real ainda não existe nesta fase, por isso isto é só uma
      // pré-visualização, nunca o valor definitivo (ver aviso na UI).
      const clientIdsComLogs = [...new Set(
        (logs || []).filter(l => (l.date || '').startsWith(mes) && l.clientId).map(l => l.clientId)
      )];
      const faturasDoMes = clientIdsComLogs.map(clientId => {
        const cliente = (clients || []).find(c => c.id === clientId);
        const { valorFaturado } = calcularFaturacaoCliente({
          logs,
          clientId,
          periodo: mes,
          valorHoraAtual: Number(cliente?.valorHora ?? 0),
          clientRateHistory: clientRateHistory || [],
        });
        return { clientId, faturaId: null, valorFaturado };
      });

      const resultadoCalc = await calcularEstimativaMensal({ mes, faturasDoMes, dbClient: supabase });
      setResultado(resultadoCalc);
    } catch (e) {
      setErro(e.message || 'Erro ao calcular estimativa mensal');
    } finally {
      setLoading(false);
    }
  }, [supabase, clients, logs, mes]);

  useEffect(() => { calcular(); }, [calcular]);

  const totalFinal = (resultado?.linhas || []).filter(l => l.status === 'calculado').reduce((s, l) => s + l.valorFinal, 0);
  const bloqueadas = (resultado?.linhas || []).filter(l => l.status === 'bloqueado');

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-800 font-semibold space-y-1">
        <p>Modo simulação — nada aqui é gravado nem enviado para faturação real. Só pré-visualização (Fase 2a).</p>
        <p>Estimativa baseada em horas lançadas — pode divergir do valor final se o admin editar manualmente no momento de faturar.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-800">Estimativa Mensal — Fase 2</h2>
            <p className="text-xs text-slate-400 mt-0.5">Aplica a % histórica ativa ao faturamento elegível do mês, rateado por cliente.</p>
          </div>
          <select value={mes} onChange={e => setMes(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600">
            {meses.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {ativo ? (
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black uppercase tracking-widest bg-emerald-50 text-emerald-700">
              % ativa: {fmtPct(ativo.percentagem)}
            </span>
            <span className="text-slate-400">período de origem: {ativo.periodo_inicio} a {ativo.periodo_fim}</span>
          </div>
        ) : (
          <p className="text-xs text-amber-600 font-semibold">Nenhuma % histórica ativa — todas as linhas deste mês vão ficar bloqueadas.</p>
        )}
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-300"><Loader2 size={24} className="animate-spin" /></div>
        ) : !resultado || resultado.linhas.length === 0 ? (
          <div className="px-5 py-16 text-center text-slate-400 text-xs font-semibold">Nenhuma fatura de receita neste mês.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Fatura</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Valor Estimado Bruto</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Resíduo Aplicado</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Valor Final</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {resultado.linhas.map((l, i) => (
                  <tr key={`${l.clientId}-${l.faturaId ?? i}`} className={l.status === 'bloqueado' ? 'bg-amber-50' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3 font-semibold text-slate-800">{clientesMap[l.clientId] || l.clientId}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono">{l.faturaId || '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmtEur(l.valorEstimadoBruto)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{fmtEur(l.residuoAplicado)}</td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: l.status === 'bloqueado' ? '#B45309' : '#1B3A57' }}>{fmtEur(l.valorFinal)}</td>
                    <td className="px-4 py-3">
                      {l.status === 'calculado' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">Calculado</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">
                            <AlertTriangle size={11} /> Bloqueado
                          </span>
                          <span className="text-slate-500">{l.motivoBloqueio}</span>
                          {l.motivoBloqueio === 'cliente sem decisao de elegibilidade' && (
                            <button onClick={onIrParaElegibilidade} className="text-[10px] font-black uppercase tracking-widest hover:opacity-80" style={{ color: '#EB8D00' }}>
                              Ir para Elegibilidade →
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={4} className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Total (linhas calculadas)</td>
                  <td className="px-4 py-3 text-right font-black" style={{ color: '#1B3A57' }}>{fmtEur(totalFinal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {bloqueadas.length > 0 && (
        <p className="text-xs text-amber-700 font-semibold px-1">
          {bloqueadas.length} linha{bloqueadas.length !== 1 ? 's' : ''} bloqueada{bloqueadas.length !== 1 ? 's' : ''} — resolve antes de considerar avançar para emissão real (Fase 2b, sessão futura).
        </p>
      )}
    </div>
  );
}

function ReconciliacaoTab() {
  const { supabase } = useApp();
  const meses = useMemo(() => ultimosMeses(12), []);
  const [mes, setMes] = useState(meses[meses.length - 2] || meses[0]);

  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [preview, setPreview] = useState(null);
  const [verificando, setVerificando] = useState(false);
  const [fechando, setFechando] = useState(false);

  const carregarHistorico = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase.from('ajudas_reconciliacao_mensal').select('*').order('mes', { ascending: false });
      if (error) throw error;
      setHistorico(data || []);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar reconciliação');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { carregarHistorico(); }, [carregarHistorico]);

  // O saldo do mês mais recentemente fechado (histórico já vem ordenado por
  // mes desc) — ou a semente da Fase 1 se ainda não houve nenhum fecho.
  // Mesma lógica de reconciliacao.js/estimativaMensal.js, nunca duplicada
  // em números diferentes — só a leitura do valor já gravado.
  const saldoAtual = historico.length > 0 ? Number(historico[0].saldo_acumulado) : SALDO_ACUMULADO_INICIAL;

  const handleVerificar = async () => {
    if (!supabase) return;
    setVerificando(true);
    setErro(null);
    setPreview(null);
    try {
      const r = await verificarFechoMes({ mes, dbClient: supabase });
      setPreview(r);
    } catch (e) {
      setErro(e.message || 'Erro ao verificar fecho do mês');
    } finally {
      setVerificando(false);
    }
  };

  const handleConfirmarFecho = async () => {
    if (!supabase || !preview?.fechavel) return;
    setFechando(true);
    setErro(null);
    try {
      const r = await fecharReconciliacaoMes({ mes, dbClient: supabase });
      if (!r.fechavel) { setErro(r.motivo); return; }
      setPreview(null);
      await carregarHistorico();
    } catch (e) {
      setErro(e.message || 'Erro ao fechar mês');
    } finally {
      setFechando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-5 ${saldoAtual < 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Saldo acumulado atual</p>
        <p className={`text-3xl font-black mt-1 ${saldoAtual < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{fmtEur(saldoAtual)}</p>
        <p className="text-xs mt-1 font-semibold" style={{ color: saldoAtual < 0 ? '#9F1239' : '#047857' }}>
          {saldoAtual < 0
            ? 'Em dívida — já foi escrito mais em faturas do que o real confirmado nos recibos. As próximas estimativas mensais ficam reduzidas até este saldo ser absorvido (nunca ficam negativas).'
            : 'A favor — real confirmado nos recibos ainda por reconhecer nas próximas faturas.'}
        </p>
        {historico.length === 0 && (
          <p className="text-[10px] text-slate-400 mt-2">Nenhum mês fechado ainda — valor de semente (saldo deixado pela Fase 1 no fim do saneamento, 2025-12 a 2026-07).</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-800">Reconciliação Mensal — Fase 3</h2>
            <p className="text-xs text-slate-400 mt-0.5">Fecho manual, nunca automático — confirma o resíduo real vs. escrito de um mês já fechado (recibos completos).</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={mes} onChange={e => { setMes(e.target.value); setPreview(null); }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600">
              {meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={handleVerificar} disabled={verificando}
              className="flex items-center gap-1.5 px-4 py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-md hover:opacity-90"
              style={{ backgroundColor: '#1B3A57' }}>
              {verificando && <Loader2 size={13} className="animate-spin" />}
              Fechar mês {mes}
            </button>
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
        )}

        {preview && !preview.fechavel && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 font-semibold flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>Mês não fechável: {preview.motivo}</span>
          </div>
        )}

        {preview && preview.fechavel && (
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Confirmação de fecho — {mes}</p>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Total real (recibos, mês seguinte)</span>
              <span className="font-bold text-slate-800">{fmtEur(preview.totalReal)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Total já escrito em faturas</span>
              <span className="font-bold text-slate-800">{fmtEur(preview.totalEscrito)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Resíduo do mês</span>
              <span className="font-bold" style={{ color: preview.residuoDoMes < 0 ? '#B91C1C' : '#047857' }}>{fmtEur(preview.residuoDoMes)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Saldo acumulado anterior{preview.saldoAcumuladoAnteriorEraSemente ? ' (semente Fase 1)' : ''}</span>
              <span className="font-bold text-slate-800">{fmtEur(preview.saldoAcumuladoAnterior)}</span>
            </div>
            <div className="flex justify-between text-sm font-black pt-1.5 border-t border-slate-200">
              <span>Novo saldo acumulado</span>
              <span style={{ color: preview.novoSaldoAcumulado < 0 ? '#B91C1C' : '#047857' }}>{fmtEur(preview.novoSaldoAcumulado)}</span>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setPreview(null)} disabled={fechando}
                className="flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-white rounded-lg transition-all disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleConfirmarFecho} disabled={fechando}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white rounded-lg transition-all disabled:opacity-60 hover:opacity-90"
                style={{ backgroundColor: '#EB8D00', color: '#1B3A57' }}>
                {fechando ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Confirmar Fecho
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-300"><Loader2 size={24} className="animate-spin" /></div>
        ) : historico.length === 0 ? (
          <div className="px-5 py-16 text-center text-slate-400 text-xs font-semibold">Nenhum mês fechado ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Mês</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Total Real</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Total Estimado</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Resíduo</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo Acumulado</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {historico.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">{r.mes}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmtEur(r.total_real)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmtEur(r.total_estimado)}</td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: r.residuo < 0 ? '#B91C1C' : '#047857' }}>{fmtEur(r.residuo)}</td>
                    <td className="px-4 py-3 text-right font-black" style={{ color: r.saldo_acumulado < 0 ? '#B91C1C' : '#047857' }}>{fmtEur(r.saldo_acumulado)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AjudasCustoAdmin() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const subtab = params.get('subtab') || 'elegibilidade';
  const setSubtab = (id) => navigate(`/admin/ajudas-custo?subtab=${id}`);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-100 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubtab(id)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all shrink-0 ${
              subtab === id ? 'border-[#EB8D00] text-[#1B3A57]' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon size={13} className="shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {subtab === 'elegibilidade' && <ElegibilidadeClientesTab />}
      {subtab === 'historico' && <HistoricoTab onIrParaElegibilidade={() => setSubtab('elegibilidade')} />}
      {subtab === 'estimativa' && <EstimativaMensalTab onIrParaElegibilidade={() => setSubtab('elegibilidade')} />}
      {subtab === 'reconciliacao' && <ReconciliacaoTab />}
    </div>
  );
}
