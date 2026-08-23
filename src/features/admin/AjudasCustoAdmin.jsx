import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, Loader2, ChevronDown, ChevronRight, CheckCircle2, XCircle, Circle, History, Calculator, ArrowRight, AlertTriangle, TrendingUp, Scale, Receipt, Coins } from 'lucide-react';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';
import { useApp } from '../../context/AppContext';
import { sugerirElegibilidade } from '../../lib/ajudas/elegibilidade';
import { executarCalculoFase1, normalizarWorkerId } from '../../lib/ajudas/percentagemHistorica';
import { calcularEstimativaMensal } from '../../lib/ajudas/estimativaMensal';
import { verificarFechoMes, fecharReconciliacaoMes, SALDO_ACUMULADO_INICIAL } from '../../lib/ajudas/reconciliacao';
import { buscarFaturasVendasPeriodo } from '../../lib/ajudas/faturasToConline.js';
import { FT } from '../../styles/designTokens';
import { mesSeguinte } from '../../lib/ajudas/valoresPorFatura.js';
import { fetchTudoPaginado } from '../../lib/ajudas/paginacao.js';
import { calcularFaturacaoCliente } from '../../lib/faturacao/tarifaHistorica.js';
import FaturarClienteModal from './toconline/FaturarClienteModal';

const TABS = [
  { id: 'elegibilidade', label: 'Elegibilidade de Clientes', icon: Users },
  { id: 'historico', label: 'Histórico', icon: History },
  { id: 'estimativa', label: 'Estimativa Mensal', icon: TrendingUp },
  { id: 'reconciliacao', label: 'Reconciliação', icon: Scale },
  { id: 'faturas', label: 'Faturas com Observações', icon: Receipt },
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
      <td colSpan={5} className="px-0 py-0 bg-[var(--surface)]">
        <div className="px-6 py-3 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[var(--slate-dim)] uppercase tracking-widest font-black">
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
                <tr key={i} className="border-t border-[var(--border-soft)]">
                  <td className="py-1.5 pr-3 font-mono text-[var(--ink-soft)]">{ev.mes}</td>
                  <td className="py-1.5 pr-3 text-[var(--ink-soft)]">{ev.workerId}</td>
                  <td className="py-1.5 pr-3 text-right text-[var(--ink-mid)]">{fmtHoras(ev.horasCliente)}</td>
                  <td className="py-1.5 pr-3 text-right text-[var(--slate-dim)]">{fmtHoras(ev.horasTotalTrabalhadorNoMes)}</td>
                  <td className="py-1.5 pr-3 text-right font-bold" style={{ color: 'var(--navy)' }}>{fmtPct(ev.pctHorasCliente)}</td>
                  <td className="py-1.5 pr-3 text-right text-[var(--slate-dim)]">{fmtEur(ev.ajudaCustoDoMes)}</td>
                  <td className="py-1.5 text-right font-bold text-[var(--ink-mid)]">{fmtEur(ev.ajudaAtribuidaProporcional)}</td>
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
      <tr className="hover:bg-[var(--surface)] transition-colors">
        <td className="px-4 py-3">
          <button onClick={onToggleExpandir} className="flex items-center gap-2 text-left">
            {expandido ? <ChevronDown size={14} className="text-[var(--slate)] shrink-0" /> : <ChevronRight size={14} className="text-[var(--slate)] shrink-0" />}
            <span className="font-semibold text-[var(--ink)]">{nomeCliente || candidato.clientId}</span>
          </button>
        </td>
        <td className="px-4 py-3 text-right text-[var(--ink-soft)]">{fmtHoras(horasTotalCliente)}</td>
        <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--navy)' }}>{fmtPct(pctTopo)}</td>
        <td className="px-4 py-3 text-right text-[var(--ink-mid)]">{fmtEur(ajudaTotalAtribuida)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-center gap-1.5">
            {salvando ? (
              <Loader2 size={16} className="animate-spin text-[var(--slate)]" />
            ) : (
              <>
                <button
                  onClick={() => onDecidir(true)}
                  title="Marcar como elegível"
                  className={`p-2 rounded-xl transition-all ${elegivel === true ? 'bg-emerald-100 text-emerald-700' : 'text-[var(--slate-dim)] hover:bg-emerald-50 hover:text-emerald-600'}`}
                >
                  <CheckCircle2 size={16} />
                </button>
                <button
                  onClick={() => onDecidir(false)}
                  title="Marcar como não elegível"
                  className={`p-2 rounded-xl transition-all ${elegivel === false ? 'bg-rose-100 text-rose-700' : 'text-[var(--slate-dim)] hover:bg-rose-50 hover:text-rose-600'}`}
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
    <tr className="hover:bg-[var(--surface)] transition-colors">
      <td className="px-4 py-3">
        <span className="font-semibold text-[var(--ink)]">{nomeCliente || clientId}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-1.5">
          {salvando ? (
            <Loader2 size={16} className="animate-spin text-[var(--slate)]" />
          ) : (
            <>
              <button
                onClick={() => onDecidir(true)}
                title="Marcar como elegível"
                className={`p-2 rounded-xl transition-all ${elegivel === true ? 'bg-emerald-100 text-emerald-700' : 'text-[var(--slate-dim)] hover:bg-emerald-50 hover:text-emerald-600'}`}
              >
                <CheckCircle2 size={16} />
              </button>
              <button
                onClick={() => onDecidir(false)}
                title="Marcar como não elegível"
                className={`p-2 rounded-xl transition-all ${elegivel === false ? 'bg-rose-100 text-rose-700' : 'text-[var(--slate-dim)] hover:bg-rose-50 hover:text-rose-600'}`}
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
      const [candidatosResult, { data: clientesData, error: errClientes }, logsData] = await Promise.all([
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
        // Paginado (fetchTudoPaginado) — sem filtro de worker, sobre até 12
        // meses, esta query ultrapassa facilmente o limite de 1000 linhas
        // do PostgREST e truncava silenciosamente (bug real confirmado em
        // produção — ver paginacao.js), fazendo clientes com horas reais
        // desaparecerem da lista "Sem evidência".
        fetchTudoPaginado(() => supabase.from('logs').select('clientId, hours, date')
          .gte('date', `${periodoInicio}-01`)
          .lte('date', `${periodoFim}-31`)),
      ]);
      if (errClientes) throw errClientes;

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
      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-sm font-black text-[var(--ink)]">Elegibilidade de Clientes</h2>
            <p className="text-xs text-[var(--slate-dim)] mt-0.5">
              Pré-requisito bloqueante: nenhum cálculo de % histórica avança enquanto houver clientes por decidir.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={periodoInicio}
              onChange={e => setPeriodoInicio(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--ink-soft)]"
            >
              {meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="text-xs text-[var(--slate-dim)]">até</span>
            <select
              value={periodoFim}
              onChange={e => setPeriodoFim(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--ink-soft)]"
            >
              {meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={13} /> {decididos} decidido{decididos !== 1 ? 's' : ''}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest ${porDecidir > 0 ? 'bg-amber-50 text-amber-700' : 'bg-[var(--surface)] text-[var(--slate-dim)]'}`}>
            <Circle size={13} /> {porDecidir} por decidir
          </span>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--slate-dim)]">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : candidatos.length === 0 ? (
          <div className="px-5 py-16 text-center text-[var(--slate-dim)] text-xs font-semibold">
            Nenhum cliente candidato neste período — sem ajudas de custo extraídas ou sem horas associadas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--surface)] border-b border-[var(--border-soft)]">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Cliente</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Horas no Cliente</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">% Horas do Trabalhador</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Ajuda Atribuída (€)</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Decisão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
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
        <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-soft)] bg-amber-50/50">
            <h3 className="text-xs font-black text-[var(--ink)]">Sem evidência de ajudas de custo</h3>
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
                <tr className="bg-[var(--surface)] border-b border-[var(--border-soft)]">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Cliente</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Decisão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
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
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-[var(--navy-solid)] transition-all hover:opacity-90"
        style={{ backgroundColor: FT.orange }}
      >
        Ir para Elegibilidade de Clientes <ArrowRight size={13} />
      </button>
    </div>
  );
}

// IDs embutidos no `motivo` de registos antigos (gravados antes do campo
// estruturado `workerIds` existir) — fallback só para não perder a
// informação nesses registos históricos.
function extrairWorkerIdsDoMotivo(motivo) {
  const m = /:\s*(.+)$/.exec(motivo || '');
  return m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : [];
}

function CardPercentagem({ titulo, registo, destaque, workersMap, interativo, revisados, onToggleRevisado }) {
  if (!registo) return null;
  return (
    <div className={`rounded-2xl border p-5 space-y-3 ${destaque ? 'bg-white border-emerald-200 shadow-sm' : 'bg-[var(--surface)] border-[var(--border)]'}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--slate-dim)]">{titulo}</h3>
        {destaque && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={11} /> Ativa
          </span>
        )}
      </div>
      <p className="text-3xl font-black" style={{ color: 'var(--navy)' }}>{fmtPct(registo.percentagem)}</p>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-[var(--slate-dim)] font-semibold">Período</p>
          <p className="text-[var(--ink-mid)] font-bold">{registo.periodo_inicio} a {registo.periodo_fim}</p>
        </div>
        <div>
          <p className="text-[var(--slate-dim)] font-semibold">Calculado em</p>
          <p className="text-[var(--ink-mid)] font-bold">{registo.calculado_em ? new Date(registo.calculado_em).toLocaleString('pt-PT') : '—'}</p>
        </div>
        <div>
          <p className="text-[var(--slate-dim)] font-semibold">Total Ajudas Real</p>
          <p className="text-[var(--ink-mid)] font-bold">{fmtEur(registo.total_ajudas_real)}</p>
        </div>
        <div>
          <p className="text-[var(--slate-dim)] font-semibold">Total Faturamento Elegível</p>
          <p className="text-[var(--ink-mid)] font-bold">{fmtEur(registo.total_bruto_referencia)}</p>
        </div>
        <div>
          <p className="text-[var(--slate-dim)] font-semibold">Calculado por</p>
          <p className="text-[var(--ink-mid)] font-bold">{registo.criado_por || '—'}</p>
        </div>
        <div>
          <p className="text-[var(--slate-dim)] font-semibold">Meses incluídos</p>
          <p className="text-[var(--ink-mid)] font-bold">{(registo.meses_incluidos || []).length}</p>
        </div>
      </div>
      {(registo.meses_excluidos || []).length > 0 && (
        <div className="pt-2 border-t border-[var(--border-soft)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Avisos de completude (não removem nada do total)</p>
          <div className="space-y-2">
            {registo.meses_excluidos.map((m, i) => {
              const ids = m.workerIds || extrairWorkerIdsDoMotivo(m.motivo);
              return (
                <div key={i} className="text-[11px] text-[var(--slate-dim)]">
                  <span className="font-mono font-bold">{m.mes}</span> — {ids.length} trabalhador(es) com horas sem recibo processado:
                  <ul className="mt-1 space-y-0.5 pl-3">
                    {ids.map(id => {
                      const nome = workersMap?.get(normalizarWorkerId(id)) || id;
                      const chave = `${m.mes}:${id}`;
                      const revisto = revisados?.has(chave);
                      return (
                        <li key={id} className="flex items-center gap-1.5">
                          {interativo ? (
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!revisto}
                                onChange={() => onToggleRevisado?.(chave)}
                                className="rounded border-[var(--border)]"
                              />
                              <span className={revisto ? 'line-through text-[var(--slate-dim)]' : 'text-[var(--ink-soft)] font-semibold'}>{nome}</span>
                            </label>
                          ) : (
                            <span className="text-[var(--ink-soft)] font-semibold">{nome}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
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

  const [workersMap, setWorkersMap] = useState(new Map());
  // Marcação "revisto/aceite" dos avisos de completude — só para
  // acompanhamento nesta pré-visualização, não persiste em BD e não afeta o
  // cálculo (os avisos já não removiam nada do total). Reinicia a cada novo
  // recálculo, porque a lista de avisos pode mudar.
  const [revisados, setRevisados] = useState(new Set());
  const toggleRevisado = useCallback((chave) => {
    setRevisados(prev => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave); else next.add(chave);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('workers').select('id, name').then(({ data }) => {
      setWorkersMap(new Map((data || []).map(w => [normalizarWorkerId(w.id), w.name])));
    });
  }, [supabase]);

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
    setRevisados(new Set());
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
      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-sm font-black text-[var(--ink)]">Histórico — Fase 1</h2>
          <p className="text-xs text-[var(--slate-dim)] mt-0.5">
            Percentagem média que a ajuda de custo representa sobre o faturamento elegível. Fica fixa até recálculo manual explícito.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--ink-soft)]">
            {meses.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <span className="text-xs text-[var(--slate-dim)]">até</span>
          <select value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--ink-soft)]">
            {meses.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button
            onClick={recalcular}
            disabled={calculando}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: FT.navy }}
          >
            {calculando ? <Loader2 size={13} className="animate-spin" /> : <Calculator size={13} />}
            Recalcular % Histórica
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      {resultado?.bloqueado && resultado.clientesPorDecidir && (
        <CardClientesPorDecidir clientes={resultado.clientesPorDecidir} onIrParaElegibilidade={onIrParaElegibilidade} />
      )}

      {resultado?.bloqueado && resultado.motivoBloqueio === 'valor_manual_excede_total_real' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle size={16} />
            <h3 className="text-sm font-black">Cálculo bloqueado — valor manual excede o total real</h3>
          </div>
          <p className="text-xs text-red-700">
            O total já declarado manualmente nas observações das faturas ({fmtEur(resultado.valorManualTotal)},
            em {resultado.faturasComValorManualCount} fatura{resultado.faturasComValorManualCount !== 1 ? 's' : ''})
            excede o total real confirmado pelos recibos ({fmtEur(resultado.totalAjudasRealComRecibos)}).
            O ajuste ficaria negativo — precisa de decisão manual antes de continuar (rever se falta algum
            recibo por processar, ou se algum valor declarado manualmente está incorreto).
          </p>
        </div>
      )}

      {resultado && !resultado.bloqueado && (
        <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[var(--slate-dim)]">Pré-visualização do novo cálculo</h3>
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
            workersMap={workersMap}
            interativo
            revisados={revisados}
            onToggleRevisado={toggleRevisado}
          />
          <p className="text-xs text-[var(--slate-dim)]">
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
 className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: FT.orange, color: FT.navy }}
            >
              {ativando ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Confirmar e Marcar como Ativa
            </button>
          ) : !linhasGravadas ? (
            <button
              onClick={confirmarGravacaoLinhas}
              disabled={gravandoLinhas}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: FT.navy }}
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

      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-5 space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--slate-dim)]">% Ativa Atual</h3>
        {loadingLista ? (
          <div className="flex items-center justify-center py-8 text-[var(--slate)]"><Loader2 size={20} className="animate-spin" /></div>
        ) : ativo ? (
          <CardPercentagem titulo="Percentagem Ativa" registo={ativo} destaque workersMap={workersMap} />
        ) : (
          <p className="text-xs text-[var(--slate-dim)]">Nenhuma % histórica ativa ainda.</p>
        )}
      </div>

      {historico.length > 0 && (
        <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-soft)]">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--slate-dim)]">Cálculos Anteriores</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--surface)] border-b border-[var(--border-soft)]">
                  <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Período</th>
                  <th className="px-4 py-2 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">%</th>
                  <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Calculado em</th>
                  <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {historico.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-[var(--ink-soft)]">{r.periodo_inicio} a {r.periodo_fim}</td>
                    <td className="px-4 py-2 text-right font-bold text-[var(--ink-mid)]">{fmtPct(r.percentagem)}</td>
                    <td className="px-4 py-2 text-[var(--slate-dim)]">{r.calculado_em ? new Date(r.calculado_em).toLocaleString('pt-PT') : '—'}</td>
                    <td className="px-4 py-2 text-[var(--slate-dim)]">{r.criado_por || '—'}</td>
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

// Resolução manual de uma fatura TOConline cujo nome de cliente não bateu
// com nenhum registo em `clients` — mesmo padrão/linguagem do painel
// "Cliente não identificado automaticamente" em FaturarClienteModal.jsx.
function LinhaResolucaoSemCliente({ fatura, clients, desabilitado, onConfirmar, onSemCorrespondencia }) {
  const [escolha, setEscolha] = useState('');
  const clientesOrdenados = useMemo(
    () => [...(clients || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [clients]
  );
  return (
    <div className="px-5 py-3 space-y-2">
      <p className="text-xs text-[var(--ink-mid)]">
        <span className="font-bold">"{fatura.clienteNome}"</span>
        <span className="text-[var(--slate-dim)]"> — fatura {fatura.faturaId}, {fmtEur(fatura.valor)}</span>
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <select value={escolha} onChange={e => setEscolha(e.target.value)} disabled={desabilitado}
          className="px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-[#1B3A57]/30 disabled:opacity-50">
          <option value="">Selecionar cliente...</option>
          {clientesOrdenados.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={() => escolha && onConfirmar(escolha)}
          disabled={!escolha || desabilitado}
          className="px-3 py-1.5 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: FT.navy }}>
          Confirmar correspondência
        </button>
        <button
          onClick={onSemCorrespondencia}
          disabled={desabilitado}
          className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-xl transition-all disabled:opacity-50">
          Não corresponde a nenhum cliente
        </button>
      </div>
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
  const [semClienteCorrespondente, setSemClienteCorrespondente] = useState([]);
  const [erro, setErro] = useState(null);

  const [simulando, setSimulando] = useState(false);
  const [linhasGravadas, setLinhasGravadas] = useState(null);
  const [jaSimulado, setJaSimulado] = useState(false);

  // Fase 2b a partir daqui: cliente com horas lançadas no mês mas sem
  // fatura real ainda (`l.faturaId == null` no resultado) ganha um botão
  // "Criar Fatura" que abre o FaturarClienteModal já com o cliente e o
  // período preenchidos — mesmo padrão (mesmas props) já usado em
  // AjudasCalculadora.jsx. `ajudasValorInicial` é só informativo no modal
  // (Passo 1) — a Fase 2b recalcula sempre o valor real no momento da
  // confirmação, nunca confia neste valor para a emissão em si.
  const [dadosFaturar, setDadosFaturar] = useState(null); // { clienteId, ajudasValor }

  // Faturas cruas do último fetch ao TOConline (buscarFaturasVendasPeriodo)
  // — guardadas para poder reprocessar depois de uma resolução manual
  // (ver `resolverSemCliente` abaixo) sem chamar o TOConline outra vez.
  const [ultimasFaturasBrutas, setUltimasFaturasBrutas] = useState([]);
  const [ultimasSemCliente, setUltimasSemCliente] = useState([]);
  // faturaId -> clientId escolhido, ou 'nenhum' (confirmado sem correspondência).
  // Só em memória, por sessão deste ecrã — nunca persistido, tal como a
  // resolução equivalente no FaturarClienteModal.jsx.
  const [resolucoesSemCliente, setResolucoesSemCliente] = useState({});

  // Só a % ativa e o nome dos clientes (leitura local, sem chamar o
  // TOConline) — mostrados de imediato ao trocar de mês, para orientar o
  // admin antes de decidir simular. A leitura de faturas reais só acontece
  // dentro de `simular`, nunca automaticamente (ver nota abaixo).
  useEffect(() => {
    if (!supabase) return;
    supabase.from('ajudas_percentagem_historica').select('*').eq('ativo', true).maybeSingle()
      .then(({ data }) => setAtivo(data || null));
    setClientesMap(Object.fromEntries((clients || []).map(c => [c.id, c.name])));
  }, [supabase, clients, mes]);

  // Trocar de mês não recalcula nem grava nada sozinho — evita chamadas
  // silenciosas ao TOConline só por navegar no seletor. O resultado
  // anterior fica limpo para não parecer pertencer ao mês novo.
  useEffect(() => {
    setResultado(null);
    setSemClienteCorrespondente([]);
    setLinhasGravadas(null);
    setJaSimulado(false);
    setErro(null);
    setUltimasFaturasBrutas([]);
    setUltimasSemCliente([]);
    setResolucoesSemCliente({});
  }, [mes]);

  // Aplica as resoluções manuais já escolhidas (ver `resolverSemCliente`) às
  // faturas sem cliente correspondente: as resolvidas com um cliente real
  // entram no cálculo como qualquer outra fatura; as confirmadas como "não
  // corresponde a nenhum" ficam de fora, mas já não aparecem como
  // pendentes; o resto continua pendente de decisão.
  const separarResolucoes = (semCliente, resolucoes) => {
    const resolvidas = [];
    const pendentes = [];
    for (const f of semCliente) {
      const resolucao = resolucoes[f.faturaId];
      if (resolucao && resolucao !== 'nenhum') resolvidas.push({ ...f, clientId: resolucao });
      else if (!resolucao) pendentes.push(f);
    }
    return { resolvidas, pendentes };
  };

  // Calcula e grava — partilhado entre `simular` (primeira leitura) e
  // `resolverSemCliente` (reprocessa com uma resolução nova, sem chamar o
  // TOConline outra vez, já com as faturas cruas em memória).
  const calcularEGravar = async (faturasBrutas, semCliente, resolucoes) => {
    const { resolvidas, pendentes } = separarResolucoes(semCliente, resolucoes);
    setSemClienteCorrespondente(pendentes);

    const faturasReaisDoMes = [...faturasBrutas, ...resolvidas].map(f => ({
      clientId: f.clientId, faturaId: f.faturaId, valorFaturado: f.valor,
    }));

    // Clientes com horas lançadas no mês de referência mas SEM fatura real
    // encontrada — ainda por faturar. Estimativa por horas × tarifa
    // histórica (mesma fórmula de Custos → Clientes e do próprio
    // FaturarClienteModal.jsx, nunca uma segunda cópia). Entram no mesmo
    // cálculo com faturaId=null — calcularEstimativaMensal já trata isso
    // (é exactamente o mesmo formato que a Fase 2b usa na pré-visualização
    // de uma fatura ainda não emitida). Nunca gravadas em
    // ajudas_estimativas_fatura (só faturas reais entram nessa tabela) —
    // são só visibilidade + atalho para criar a fatura.
    const clientIdsComFaturaReal = new Set(faturasReaisDoMes.map(f => f.clientId));
    const clientIdsComHoras = [...new Set(
      (logs || []).filter(l => (l.date || '').startsWith(mes) && l.clientId).map(l => l.clientId)
    )];
    const clientIdsPorFaturar = clientIdsComHoras.filter(id => !clientIdsComFaturaReal.has(id));

    let faturasPorFaturarDoMes = [];
    if (clientIdsPorFaturar.length > 0) {
      const { data: clientRateHistory } = await supabase.from('client_valorhora_history').select('*');
      faturasPorFaturarDoMes = clientIdsPorFaturar.map(clientId => {
        const cliente = (clients || []).find(c => c.id === clientId);
        const { valorFaturado } = calcularFaturacaoCliente({
          logs, clientId, periodo: mes, valorHoraAtual: Number(cliente?.valorHora ?? 0),
          clientRateHistory: clientRateHistory || [],
        });
        return { clientId, faturaId: null, valorFaturado };
      });
    }

    const faturasDoMes = [...faturasReaisDoMes, ...faturasPorFaturarDoMes];

    const resultadoCalc = await calcularEstimativaMensal({ mes, faturasDoMes, dbClient: supabase });
    setResultado(resultadoCalc);
    setJaSimulado(true);

    const linhasComFaturaReal = resultadoCalc.linhas.filter(l => l.faturaId != null);
    if (linhasComFaturaReal.length > 0) {
      const linhas = linhasComFaturaReal.map(l => ({
        mes,
        client_id: l.clientId,
        fatura_id: l.faturaId,
        percentagem_historica_id: resultadoCalc.percentagemHistoricaId,
        residuo_mes_anterior_aplicado: l.residuoAplicado,
        valor_fatura: l.valorFaturado,
        valor_estimado_bruto: l.valorEstimadoBruto,
        valor_final: l.valorFinal,
        status: l.status,
        origem: 'estimativa',
        motivo_bloqueio: l.motivoBloqueio,
      }));
      const { error } = await supabase
        .from('ajudas_estimativas_fatura')
        .upsert(linhas, { onConflict: 'mes,client_id,fatura_id' });
      if (error) throw error;
      setLinhasGravadas(linhas.length);
    }
  };

  // Ação única e explícita: lê faturas JÁ EMITIDAS no TOConline (nunca uma
  // aproximação por horas), calcula, e grava (upsert) as linhas resultantes
  // em ajudas_estimativas_fatura — tudo no mesmo clique, sem passo
  // intermédio de pré-visualização automática. `mes` aqui é sempre o mês de
  // REFERÊNCIA (do trabalho), mesma convenção usada em toda a calculadora
  // (Fase 1/3, valoresPorFatura.js): a fatura que reporta o trabalho de
  // `mes` é emitida em mesSeguinte(mes). status vem tal como calculado
  // ('calculado'/'bloqueado') — nunca 'faturado', essa transição só
  // acontece na Fase 2b (FaturarClienteModal.jsx/emitirFaturaComAjudas.js),
  // fora do âmbito desta tela. onConflict (mes, client_id, fatura_id)
  // garante que correr "Simular" outra vez para o mesmo mês substitui a
  // linha anterior de cada fatura em vez de duplicar ou falhar — todas as
  // linhas aqui têm fatura_id real (vêm de faturas já emitidas), por isso
  // o índice único nunca vê fatura_id NULL nesta tela.
  const simular = async () => {
    if (!supabase) return;
    setSimulando(true);
    setErro(null);
    setLinhasGravadas(null);
    try {
      const mesFatura = mesSeguinte(mes);
      const { faturas, semClienteCorrespondente: semCliente } = await buscarFaturasVendasPeriodo({
        periodoInicio: mesFatura, periodoFim: mesFatura, dbClient: supabase,
      });
      setUltimasFaturasBrutas(faturas);
      setUltimasSemCliente(semCliente);
      await calcularEGravar(faturas, semCliente, resolucoesSemCliente);
    } catch (e) {
      setErro(e.message || 'Erro ao simular');
    } finally {
      setSimulando(false);
    }
  };

  // Resolução manual de uma fatura sem cliente correspondente (mesmo
  // padrão do painel "Cliente não identificado automaticamente" em
  // FaturarClienteModal.jsx): associa a um cliente real, ou confirma
  // explicitamente que não corresponde a nenhum. Reprocessa de imediato com
  // os dados já em memória — não volta a chamar o TOConline.
  const resolverSemCliente = async (faturaId, clientIdOuNenhum) => {
    const novasResolucoes = { ...resolucoesSemCliente, [faturaId]: clientIdOuNenhum };
    setResolucoesSemCliente(novasResolucoes);
    setSimulando(true);
    setErro(null);
    try {
      await calcularEGravar(ultimasFaturasBrutas, ultimasSemCliente, novasResolucoes);
    } catch (e) {
      setErro(e.message || 'Erro ao reprocessar após resolução');
    } finally {
      setSimulando(false);
    }
  };

  const totalFinal = (resultado?.linhas || []).filter(l => l.status === 'calculado').reduce((s, l) => s + l.valorFinal, 0);
  const bloqueadas = (resultado?.linhas || []).filter(l => l.status === 'bloqueado');

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-800 font-semibold space-y-1">
        <p>Simula contra faturas já emitidas no TOConline para o mês seguinte a {mes} (mesSeguinte, mesma convenção do resto da calculadora), e mostra também clientes com horas lançadas em {mes} que ainda não têm fatura nenhuma. A pré-visualização abaixo é só cálculo — nada é gravado até clicares "Simular".</p>
        <p>"Simular" grava (ou substitui) as linhas com fatura real deste mês em <code>ajudas_estimativas_fatura</code> com status <code>calculado</code>/<code>bloqueado</code> — nunca <code>faturado</code>. Clientes ainda por faturar (sem fatura real) não são gravados — só aparecem para dares o próximo passo com "Criar Fatura".</p>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-black text-[var(--ink)]">Estimativa Mensal — Fase 2</h2>
            <p className="text-xs text-[var(--slate-dim)] mt-0.5">Aplica a % histórica ativa ao faturamento elegível do mês, rateado por cliente.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={mes} onChange={e => setMes(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--ink-soft)]">
              {meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button
              onClick={simular}
              disabled={simulando}
 className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: FT.orange, color: FT.navy }}
            >
              {simulando ? <Loader2 size={13} className="animate-spin" /> : <Calculator size={13} />}
              Simular
            </button>
          </div>
        </div>

        {ativo ? (
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black uppercase tracking-widest bg-emerald-50 text-emerald-700">
              % ativa: {fmtPct(ativo.percentagem)}
            </span>
            <span className="text-[var(--slate-dim)]">período de origem: {ativo.periodo_inicio} a {ativo.periodo_fim}</span>
          </div>
        ) : (
          <p className="text-xs text-amber-600 font-semibold">Nenhuma % histórica ativa — todas as linhas deste mês vão ficar bloqueadas.</p>
        )}

        {linhasGravadas != null && (
          <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> {linhasGravadas} linha{linhasGravadas !== 1 ? 's' : ''} gravada{linhasGravadas !== 1 ? 's' : ''} em ajudas_estimativas_fatura.
          </p>
        )}
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      {semClienteCorrespondente.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-100 bg-amber-50/50">
            <h3 className="text-xs font-black text-amber-800">
              Faturas sem cliente correspondente ({semClienteCorrespondente.length})
            </h3>
            <p className="text-[11px] text-amber-700 mt-1">
              Nome do cliente no TOConline não bate com nenhum registo em `clients`. Associa a um cliente real para
              entrar na simulação, ou confirma que não corresponde a nenhum.
            </p>
          </div>
          <div className="divide-y divide-amber-50">
            {semClienteCorrespondente.map(f => (
              <LinhaResolucaoSemCliente
                key={f.faturaId}
                fatura={f}
                clients={clients}
                desabilitado={simulando}
                onConfirmar={clientId => resolverSemCliente(f.faturaId, clientId)}
                onSemCorrespondencia={() => resolverSemCliente(f.faturaId, 'nenhum')}
              />
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
        {simulando ? (
          <div className="flex items-center justify-center py-16 text-[var(--slate)]"><Loader2 size={24} className="animate-spin" /></div>
        ) : !jaSimulado ? (
          <div className="px-5 py-16 text-center text-[var(--slate-dim)] text-xs font-semibold">Clica em "Simular" para ler as faturas já emitidas no TOConline e calcular a estimativa deste mês.</div>
        ) : !resultado || resultado.linhas.length === 0 ? (
          <div className="px-5 py-16 text-center text-[var(--slate-dim)] text-xs font-semibold">Nenhuma fatura de receita neste mês.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--surface)] border-b border-[var(--border-soft)]">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Cliente</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Fatura</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Valor Estimado Bruto</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Resíduo Aplicado</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Valor Final</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Estado</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {resultado.linhas.map((l, i) => (
                  <tr key={`${l.clientId}-${l.faturaId ?? i}`} className={l.status === 'bloqueado' ? 'bg-amber-50' : 'hover:bg-[var(--surface)]'}>
                    <td className="px-4 py-3 font-semibold text-[var(--ink)]">{clientesMap[l.clientId] || l.clientId}</td>
                    <td className="px-4 py-3 text-[var(--slate-dim)] font-mono">
                      {l.faturaId || (
                        <span className="text-amber-600 font-sans font-semibold not-italic">ainda por faturar</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--ink-soft)]">{fmtEur(l.valorEstimadoBruto)}</td>
                    <td className="px-4 py-3 text-right text-[var(--slate-dim)]">{fmtEur(l.residuoAplicado)}</td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: l.status === 'bloqueado' ? '#B45309' : FT.navy }}>{fmtEur(l.valorFinal)}</td>
                    <td className="px-4 py-3">
                      {l.status === 'calculado' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">Calculado</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">
                            <AlertTriangle size={11} /> Bloqueado
                          </span>
                          <span className="text-[var(--slate-dim)]">{l.motivoBloqueio}</span>
                          {l.motivoBloqueio === 'cliente sem decisao de elegibilidade' && (
                            <button onClick={onIrParaElegibilidade} className="text-[10px] font-black uppercase tracking-widest hover:opacity-80" style={{ color: FT.orange }}>
                              Ir para Elegibilidade →
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!l.faturaId && l.status === 'calculado' && (
                        <button
                          onClick={() => setDadosFaturar({ clienteId: l.clientId, ajudasValor: l.valorFinal })}
 className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all hover:opacity-90"
                          style={{ backgroundColor: FT.orange, color: FT.navy }}>
                          Criar Fatura
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border)] bg-[var(--surface)]">
                  <td colSpan={4} className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Total (linhas calculadas)</td>
                  <td className="px-4 py-3 text-right font-black" style={{ color: 'var(--navy)' }}>{fmtEur(totalFinal)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {bloqueadas.length > 0 && (
        <p className="text-xs text-amber-700 font-semibold px-1">
          {bloqueadas.length} linha{bloqueadas.length !== 1 ? 's' : ''} bloqueada{bloqueadas.length !== 1 ? 's' : ''} — resolve antes de criar a fatura correspondente.
        </p>
      )}

      {dadosFaturar && (
        <FaturarClienteModal
          clienteIdInicial={dadosFaturar.clienteId}
          ajudasValorInicial={dadosFaturar.ajudasValor}
          periodoInicial={mes}
          onClose={() => setDadosFaturar(null)}
          onFaturado={() => { setDadosFaturar(null); simular(); }}
        />
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
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Saldo acumulado atual</p>
        <p className={`text-3xl font-black mt-1 ${saldoAtual < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{fmtEur(saldoAtual)}</p>
        <p className="text-xs mt-1 font-semibold" style={{ color: saldoAtual < 0 ? '#9F1239' : '#047857' }}>
          {saldoAtual < 0
            ? 'Em dívida — já foi escrito mais em faturas do que o real confirmado nos recibos. As próximas estimativas mensais ficam reduzidas até este saldo ser absorvido (nunca ficam negativas).'
            : 'A favor — real confirmado nos recibos ainda por reconhecer nas próximas faturas.'}
        </p>
        {historico.length === 0 && (
          <p className="text-[10px] text-[var(--slate-dim)] mt-2">Nenhum mês fechado ainda — valor de semente (saldo deixado pela Fase 1 no fim do saneamento, 2025-12 a 2026-07).</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-black text-[var(--ink)]">Reconciliação Mensal — Fase 3</h2>
            <p className="text-xs text-[var(--slate-dim)] mt-0.5">Fecho manual, nunca automático — confirma o resíduo real vs. escrito de um mês já fechado (recibos completos).</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={mes} onChange={e => { setMes(e.target.value); setPreview(null); }}
              className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--ink-soft)]">
              {meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={handleVerificar} disabled={verificando}
              className="flex items-center gap-1.5 px-4 py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-md hover:opacity-90"
              style={{ backgroundColor: FT.navy }}>
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
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 space-y-2.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Confirmação de fecho — {mes}</p>
            <div className="flex justify-between text-xs text-[var(--ink-soft)]">
              <span>Total real (recibos, mês seguinte)</span>
              <span className="font-bold text-[var(--ink)]">{fmtEur(preview.totalReal)}</span>
            </div>
            <div className="flex justify-between text-xs text-[var(--ink-soft)]">
              <span>Total já escrito em faturas</span>
              <span className="font-bold text-[var(--ink)]">{fmtEur(preview.totalEscrito)}</span>
            </div>
            <div className="flex justify-between text-xs text-[var(--ink-soft)]">
              <span>Resíduo do mês</span>
              <span className="font-bold" style={{ color: preview.residuoDoMes < 0 ? '#B91C1C' : '#047857' }}>{fmtEur(preview.residuoDoMes)}</span>
            </div>
            <div className="flex justify-between text-xs text-[var(--ink-soft)]">
              <span>Saldo acumulado anterior{preview.saldoAcumuladoAnteriorEraSemente ? ' (semente Fase 1)' : ''}</span>
              <span className="font-bold text-[var(--ink)]">{fmtEur(preview.saldoAcumuladoAnterior)}</span>
            </div>
            <div className="flex justify-between text-sm font-black pt-1.5 border-t border-[var(--border)]">
              <span>Novo saldo acumulado</span>
              <span style={{ color: preview.novoSaldoAcumulado < 0 ? '#B91C1C' : '#047857' }}>{fmtEur(preview.novoSaldoAcumulado)}</span>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setPreview(null)} disabled={fechando}
                className="flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] hover:bg-white rounded-lg transition-all disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleConfirmarFecho} disabled={fechando}
 className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all disabled:opacity-60 hover:opacity-90"
                style={{ backgroundColor: FT.orange, color: FT.navy }}>
                {fechando ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Confirmar Fecho
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--slate)]"><Loader2 size={24} className="animate-spin" /></div>
        ) : historico.length === 0 ? (
          <div className="px-5 py-16 text-center text-[var(--slate-dim)] text-xs font-semibold">Nenhum mês fechado ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--surface)] border-b border-[var(--border-soft)]">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Mês</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Total Real</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Total Estimado</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Resíduo</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Saldo Acumulado</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {historico.map(r => (
                  <tr key={r.id} className="hover:bg-[var(--surface)]">
                    <td className="px-4 py-3 font-mono font-semibold text-[var(--ink)]">{r.mes}</td>
                    <td className="px-4 py-3 text-right text-[var(--ink-soft)]">{fmtEur(r.total_real)}</td>
                    <td className="px-4 py-3 text-right text-[var(--ink-soft)]">{fmtEur(r.total_estimado)}</td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: r.residuo < 0 ? '#B91C1C' : '#047857' }}>{fmtEur(r.residuo)}</td>
                    <td className="px-4 py-3 text-right font-black" style={{ color: r.saldo_acumulado < 0 ? '#B91C1C' : '#047857' }}>{fmtEur(r.saldo_acumulado)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-[var(--surface-dim)] text-[var(--ink-soft)]">{r.status}</span>
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

// Parte 3 (2026-08-20): ecrã de auditoria a nível de FATURA, novo separador
// próprio — não vive em "Histórico" (esse é sobre a governança da %
// histórica em si, ativar/recalcular, não sobre listar faturas
// individuais) nem em "Reconciliação" (essa é sobre o fecho mensal
// agregado real-vs-escrito, não sobre cada fatura). É o único ecrã que
// junta as duas fontes de verdade que já coexistem em
// ajudas_estimativas_fatura: status='faturado' (Fase 2b, faturas reais já
// emitidas através deste sistema) e origem='historico' (Fase 1, rateio
// retroativo do saneamento) — o "quadro completo" pedido, retroativo +
// prospetivo, num único sítio.
function FaturasComObservacoesTab() {
  const { supabase, clients } = useApp();
  const [faturadas, setFaturadas] = useState([]);
  const [simuladas, setSimuladas] = useState([]);
  const [historicas, setHistoricas] = useState([]);
  const [percentagensMap, setPercentagensMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [secao, setSecao] = useState('faturadas'); // 'faturadas' | 'simuladas' | 'historicas'

  const clientesMap = useMemo(() => Object.fromEntries((clients || []).map(c => [c.id, c.name])), [clients]);

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    setErro(null);
    Promise.all([
      supabase.from('ajudas_estimativas_fatura').select('*').eq('status', 'faturado').order('mes', { ascending: false }),
      // origem='estimativa' cobre 'calculado' e 'bloqueado' (Fase 2a,
      // botão "Simular") e 'confirmado' (Fase 2b, gravado antes da chamada
      // ao TOConline mas ainda sem resposta de sucesso) — tudo o que já
      // passou pela calculadora mas ainda não é uma fatura real emitida.
      supabase.from('ajudas_estimativas_fatura').select('*').eq('origem', 'estimativa').order('mes', { ascending: false }),
      supabase.from('ajudas_estimativas_fatura').select('*').eq('origem', 'historico').order('mes', { ascending: false }),
      supabase.from('ajudas_percentagem_historica').select('id, percentagem'),
    ]).then(([rFaturadas, rSimuladas, rHistoricas, rPct]) => {
      if (rFaturadas.error) throw rFaturadas.error;
      if (rSimuladas.error) throw rSimuladas.error;
      if (rHistoricas.error) throw rHistoricas.error;
      if (rPct.error) throw rPct.error;
      setFaturadas(rFaturadas.data || []);
      // origem='estimativa' inclui as que já transitaram para 'faturado'
      // (essas já aparecem na secção "Faturas Emitidas") — exclui aqui
      // para não duplicar entre secções.
      setSimuladas((rSimuladas.data || []).filter(l => l.status !== 'faturado'));
      setHistoricas(rHistoricas.data || []);
      setPercentagensMap(Object.fromEntries((rPct.data || []).map(p => [p.id, p.percentagem])));
    }).catch(e => {
      setErro(e.message || 'Erro ao carregar faturas com observações');
    }).finally(() => setLoading(false));
  }, [supabase]);

  const linhas = secao === 'faturadas' ? faturadas : secao === 'simuladas' ? simuladas : historicas;

  // Retroativo, agrupado por mês (a query já vem ordenada por mes desc) —
  // cada grupo mostra quantas linhas têm valor_observacao_manual preenchido
  // (já estava escrito na fatura, "declarado") vs calculadas por rateio.
  const historicasPorMes = useMemo(() => {
    const grupos = new Map();
    for (const l of historicas) {
      if (!grupos.has(l.mes)) grupos.set(l.mes, []);
      grupos.get(l.mes).push(l);
    }
    return [...grupos.entries()]; // já em ordem (historicas veio ordenado por mes desc)
  }, [historicas]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-5 space-y-3">
        <div>
          <h2 className="text-sm font-black text-[var(--ink)]">Faturas com Observações de Ajudas de Custo</h2>
          <p className="text-xs text-[var(--slate-dim)] mt-0.5">
            Auditoria do que já passou pela calculadora de ajudas de custo — faturas reais emitidas através deste
            sistema (Fase 2b), simulações ainda não confirmadas (Fase 2a) e linhas retroativas do saneamento
            histórico (Fase 1), lado a lado.
          </p>
          <p className="text-[11px] text-amber-600 mt-1.5">
            ⚠ O "Mês" tem significados diferentes consoante a secção: em "Emitidas" e "Simuladas" é o mês de
            referência do trabalho (a fatura real está no mês seguinte); em "Retroativo" é o mês da própria
            fatura (sem desvio). Duas linhas com o mesmo "Mês" em secções diferentes podem não corresponder ao
            mesmo período — compara sempre pelo número da fatura, não só pelo mês.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setSecao('faturadas')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              secao === 'faturadas' ? 'text-white' : 'bg-[var(--surface-dim)] text-[var(--ink-soft)] hover:bg-[var(--border)]'
            }`}
            style={secao === 'faturadas' ? { backgroundColor: FT.navy } : undefined}>
            Faturas Emitidas ({faturadas.length})
          </button>
          <button onClick={() => setSecao('simuladas')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              secao === 'simuladas' ? 'text-white' : 'bg-[var(--surface-dim)] text-[var(--ink-soft)] hover:bg-[var(--border)]'
            }`}
            style={secao === 'simuladas' ? { backgroundColor: FT.navy } : undefined}>
            Simuladas — Ainda Não Emitidas ({simuladas.length})
          </button>
          <button onClick={() => setSecao('historicas')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              secao === 'historicas' ? 'text-white' : 'bg-[var(--surface-dim)] text-[var(--ink-soft)] hover:bg-[var(--border)]'
            }`}
            style={secao === 'historicas' ? { backgroundColor: FT.navy } : undefined}>
            Retroativo — Histórico ({historicas.length})
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--slate)]"><Loader2 size={24} className="animate-spin" /></div>
        ) : linhas.length === 0 ? (
          <div className="px-5 py-16 text-center text-[var(--slate-dim)] text-xs font-semibold">
            {secao === 'faturadas' && 'Nenhuma fatura real emitida através deste sistema ainda.'}
            {secao === 'simuladas' && 'Nenhuma simulação por confirmar — corre "Simular" no ecrã Estimativa Mensal.'}
            {secao === 'historicas' && 'Nenhuma linha retroativa gravada ainda.'}
          </div>
        ) : secao === 'faturadas' || secao === 'simuladas' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--surface)] border-b border-[var(--border-soft)]">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Cliente</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Mês</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Fatura</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Valor Total da Fatura</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Valor na Observação</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">% Histórica Usada</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Resíduo Aplicado</th>
                  {secao === 'simuladas' && (
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Estado</th>
                  )}
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {linhas.map(l => (
                  <tr key={l.id} className={l.status === 'bloqueado' ? 'bg-amber-50' : 'hover:bg-[var(--surface)]'}>
                    <td className="px-4 py-3 font-semibold text-[var(--ink)]">{clientesMap[l.client_id] || l.client_id}</td>
                    <td className="px-4 py-3 font-mono text-[var(--ink-soft)]">{l.mes}</td>
                    <td className="px-4 py-3 font-mono text-[var(--slate-dim)]">{l.fatura_id || '—'}</td>
                    <td className="px-4 py-3 text-right text-[var(--ink-soft)]">{l.valor_fatura != null ? fmtEur(l.valor_fatura) : '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--ink)]">{fmtEur(l.valor_final)}</td>
                    <td className="px-4 py-3 text-right text-[var(--ink-soft)]">
                      {l.percentagem_historica_id && percentagensMap[l.percentagem_historica_id] != null
                        ? fmtPct(percentagensMap[l.percentagem_historica_id])
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--slate-dim)]">
                      {Number(l.residuo_mes_anterior_aplicado) > 0 ? fmtEur(l.residuo_mes_anterior_aplicado) : '—'}
                    </td>
                    {secao === 'simuladas' && (
                      <td className="px-4 py-3">
                        {l.status === 'bloqueado' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">Bloqueado</span>
                        ) : l.status === 'confirmado' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-orange-100 text-orange-700">Confirmado, a aguardar TOConline</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-[var(--surface-dim)] text-[var(--ink-soft)]">Calculado</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-[var(--slate-dim)]">{l.criado_em ? new Date(l.criado_em).toLocaleString('pt-PT') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-soft)]">
            {historicasPorMes.map(([mes, linhasDoMes]) => {
              const nDeclaradas = linhasDoMes.filter(l => l.valor_observacao_manual != null).length;
              return (
                <div key={mes}>
                  <div className="px-4 py-2.5 bg-[var(--surface)] flex items-center gap-3 flex-wrap">
                    <span className="font-mono font-black text-[var(--ink-mid)] text-xs">{mes}</span>
                    <span className="text-[10px] text-[var(--slate-dim)] font-semibold">
                      {linhasDoMes.length} fatura{linhasDoMes.length !== 1 ? 's' : ''}
                      {nDeclaradas > 0 && ` · ${nDeclaradas} com valor explícito na observação`}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-soft)]">
                          <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Cliente</th>
                          <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Fatura</th>
                          <th className="px-4 py-2 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Valor Total da Fatura</th>
                          <th className="px-4 py-2 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Valor na Observação</th>
                          <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Origem do valor</th>
                          <th className="px-4 py-2 text-right text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">% Histórica Usada</th>
                          <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Criado em</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-soft)]">
                        {linhasDoMes.map(l => {
                          const declarado = l.valor_observacao_manual != null;
                          return (
                            <tr key={l.id} className="hover:bg-[var(--surface)]">
                              <td className="px-4 py-2.5 font-semibold text-[var(--ink)]">{clientesMap[l.client_id] || l.client_id}</td>
                              <td className="px-4 py-2.5 font-mono text-[var(--slate-dim)]">{l.fatura_id || '—'}</td>
                              <td className="px-4 py-2.5 text-right text-[var(--ink-soft)]">{l.valor_fatura != null ? fmtEur(l.valor_fatura) : '—'}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-[var(--ink)]">{fmtEur(l.valor_final)}</td>
                              <td className="px-4 py-2.5">
                                {declarado ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">
                                    Declarado na fatura
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-[var(--surface-dim)] text-[var(--ink-soft)]">
                                    Rateio
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right text-[var(--ink-soft)]">
                                {l.percentagem_historica_id && percentagensMap[l.percentagem_historica_id] != null
                                  ? fmtPct(percentagensMap[l.percentagem_historica_id])
                                  : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-[var(--slate-dim)]">{l.criado_em ? new Date(l.criado_em).toLocaleString('pt-PT') : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
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
      <SectionHeaderShell
        icon={<Coins size={18} />}
        title="Ajudas de Custo"
        tabs={TABS}
        activeTab={subtab}
        onTabChange={setSubtab}
      />

      {subtab === 'elegibilidade' && <ElegibilidadeClientesTab />}
      {subtab === 'historico' && <HistoricoTab onIrParaElegibilidade={() => setSubtab('elegibilidade')} />}
      {subtab === 'estimativa' && <EstimativaMensalTab onIrParaElegibilidade={() => setSubtab('elegibilidade')} />}
      {subtab === 'reconciliacao' && <ReconciliacaoTab />}
      {subtab === 'faturas' && <FaturasComObservacoesTab />}
    </div>
  );
}
