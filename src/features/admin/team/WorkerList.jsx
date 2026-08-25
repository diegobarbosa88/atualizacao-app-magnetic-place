import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { authFetch } from '../../../utils/authFetch';
import { consultarComunicacoesPendentes, invalidarComunicacoesPendentes } from './ssComunicacoesPendentes';
import { impersonarTrabalhador } from '../../../utils/impersonateWorker';
import { Search, Edit2, Trash2, CheckCircle, ShieldCheck, ShieldOff, MoreVertical, FolderOpen, SendHorizonal, AlertTriangle, Shield, FileEdit } from 'lucide-react';
import SSComunicacaoModal from './SSComunicacaoModal';
import AlterarContratoModal from './AlterarContratoModal';
import { FT, SCALE } from '../../../styles/designTokens';
import Card from '../../../components/common/Card';
import { FONT_TITLE, FONT_MONO } from '../../../styles/designTokens';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Mini linha do tempo Admissão → Hoje → Cessação — versão compacta da
// usada em WorkerForm.jsx, para o mesmo idioma visual ler-se em cards e
// lista sem reabrir a ficha. Substitui o antigo ssBadge() (dois estados
// soltos "SS Admissão OK"/"SS Cessação pendente" competindo por espaço).
// ssFlag (opcional): entrada de ssComunicacoesMap[w.nis] quando a consulta
// obterComunicacoes da PSI encontrou esta comunicação "não aceite"
// (rejeitada) ou presa "a processar" há vários dias — sobrepõe-se ao estado
// normal (que só reflete o que a própria app gravou, não o estado real na SS).
function MiniTimeline({ w, ssFlag }) {
  const admissaoFeita = !!w.ss_admissao_comunicada_em;
  const cessacaoFeita = !!w.ss_cessacao_comunicada_em;
  const temFim = !!w.dataFim;

  const dotCls = (state) =>
    state === 'done' ? 'bg-emerald-500'
    : state === 'pending' ? 'bg-amber-400'
    : state === 'rejected' ? 'bg-rose-500'
    : state === 'stuck' ? 'bg-orange-500'
    : state === 'now' ? '' // usa style inline navy
    : 'bg-[var(--border)]';

  let admissaoState = admissaoFeita ? 'done' : 'pending';
  const cessacaoState = !temFim ? 'na' : cessacaoFeita ? 'done' : 'pending';

  let label, labelCls;
  if (!admissaoFeita) { label = 'SS admissão por comunicar'; labelCls = 'text-amber-600'; }
  else if (temFim && !cessacaoFeita) { label = 'SS cessação por comunicar'; labelCls = 'text-amber-600'; }
  else { label = temFim ? 'SS ok · cessado' : 'SS ok'; labelCls = 'text-emerald-600'; }

  // A consulta real à SS pode contradizer o que a app achava que estava OK.
  if (ssFlag?.prioridade === 'rejeitada') {
    admissaoState = 'rejected';
    label = `SS rejeitou: ${ssFlag.motivo || 'ver detalhe'}`;
    labelCls = 'text-rose-600';
  } else if (ssFlag?.prioridade === 'presa') {
    admissaoState = 'stuck';
    label = 'SS presa a processar';
    labelCls = 'text-orange-600';
  }

  return (
    <div className="flex items-center gap-1" title={label}>
      <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${dotCls(admissaoState)}`} />
      <span className={`w-3 h-[2px] shrink-0 ${admissaoState === 'done' ? 'bg-emerald-500' : 'bg-[var(--border)]'}`} />
      <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: FT.navy }} />
      <span className={`w-3 h-[2px] shrink-0 ${cessacaoState === 'done' ? 'bg-emerald-500' : 'bg-[var(--border)]'}`} />
      <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${dotCls(cessacaoState)}`} />
      <span className={`${SCALE.text.statLabel} ml-1 truncate ${labelCls}`}>{label}</span>
    </div>
  );
}

// Badge único do cartão (grid): reutiliza a mesma deteção de estado que
// MiniTimeline/apoliceBadge já fazem para a vista de tabela, mas condensa
// num só selo — verde "OK" quando SS e Apólice estão ambos regularizados,
// laranja com as mensagens específicas (não um "pendente" genérico) quando
// há 1+ problema. Vista de tabela mantém-se em MiniTimeline/apoliceBadge.
function vinculoBadge(w, apoliceMap, ssFlag) {
  const admissaoFeita = !!w.ss_admissao_comunicada_em;
  const cessacaoFeita = !!w.ss_cessacao_comunicada_em;
  const temFim = !!w.dataFim;

  let ssProblema = null;
  if (ssFlag?.prioridade === 'rejeitada') ssProblema = `SS rejeitou: ${ssFlag.motivo || 'ver detalhe'}`;
  else if (ssFlag?.prioridade === 'presa') ssProblema = 'SS presa a processar';
  else if (!admissaoFeita) ssProblema = 'SS admissão por comunicar';
  else if (temFim && !cessacaoFeita) ssProblema = 'SS cessação por comunicar';

  const apoliceStatus = apoliceMap[w.id]?.status;
  let apoliceProblema = null;
  if (apoliceStatus === 'solicitado' || apoliceStatus === 'pendente') apoliceProblema = 'Apólice Solicitada';
  else if (apoliceStatus === 'excluido') apoliceProblema = 'Apólice Excluída';
  else if (apoliceStatus !== 'ativo') apoliceProblema = 'Apólice por confirmar';

  // Cores fixas (não var(--...)), de propósito: o badge tem fundo próprio
  // (FT.okBg/FT.warnBg) autocontido, não herda do cartão à volta — por
  // isso não importa que o cartão (Card variant="item") na verdade inverta
  // em dark mode (confirmado depois: usa a classe bg-white, que a
  // regra-ponte de App.css converte para #1e293b). Herdar tokens que
  // invertem aqui componha a cor errada consigo própria, não com o
  // cartão. O laranja usa #8a4a00, não FT.orangeDeep — mesmo fixo,
  // FT.orangeDeep sobre FT.warnBg dá só 3,07:1 (falha AA); nunca tinha
  // sido medido como par texto+fundo antes (só existia em hover). Se o
  // par do badge alguma vez precisar de inverter, o verde já tem
  // var(--ok)/var(--ok-bg)/var(--ok-border) pronto — mas o laranja
  // precisa de um par novo medido para dark mode: ver nota em CLAUDE.md.
  if (!ssProblema && !apoliceProblema) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${SCALE.text.meta}`} style={{ background: FT.okBg, border: `1px solid ${FT.ok}4D`, color: FT.ok }}>
        <ShieldCheck size={9} /> OK
      </span>
    );
  }

  const texto = [ssProblema, apoliceProblema].filter(Boolean).join(' · ');
  return (
    // #8a4a00, não FT.orangeDeep: medido, FT.orangeDeep sobre FT.warnBg dá
    // 3,07:1 (falha AA). #8a4a00 dá 6,08:1 — mais escuro só o suficiente,
    // mesma família visual do orangeDeep. Ver nota em CLAUDE.md.
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${SCALE.text.meta}`} style={{ background: FT.warnBg, border: `1px solid ${FT.warn}4D`, color: '#8a4a00' }} title={texto}>
      <AlertTriangle size={9} /> {texto}
    </span>
  );
}

function apoliceBadge(w, apoliceMap) {
  const status = apoliceMap[w.id]?.status;
  if (status === 'ativo') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 ${SCALE.text.meta}`}>
        <Shield size={8} /> Apólice Ativa
      </span>
    );
  }
  if (status === 'solicitado' || status === 'pendente') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 ${SCALE.text.meta}`}>
        <AlertTriangle size={8} /> Apólice Solicitada
      </span>
    );
  }
  if (status === 'excluido') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--surface-dim)] border border-[var(--border)] text-[var(--ink-soft)] ${SCALE.text.meta}`}>
        <ShieldOff size={8} /> Apólice Excluída
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 ${SCALE.text.meta}`}>
      <AlertTriangle size={8} /> Apólice por confirmar
    </span>
  );
}

const WorkerList = ({ sortedWorkers, workersView, setWorkersView, workersSort, setWorkersSort, onLogin, onEdit, onOpenVHHistory, onOpenEmpHistory, onVerPasta }) => {
  const { approvals, currentMonthStr, schedules, clients, saveToDb, setWorkers, supabase } = useApp();
  const [confirmDeleteWorkerId, setConfirmDeleteWorkerId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [ssModal, setSsModal] = useState(null); // { worker, tipo: 'admissao'|'cessacao' }
  const [alterarContratoWorker, setAlterarContratoWorker] = useState(null); // worker | null
  const [ssAmbiente, setSsAmbiente] = useState('teste');
  const [apoliceMap, setApoliceMap] = useState({});
  const [ssComunicacoesMap, setSsComunicacoesMap] = useState({});

  useEffect(() => {
    // supabase vem do AppContext (nunca window.supabaseInstance direto) —
    // esse global só fica pronto depois do primeiro render em certas
    // condições de arranque (F5 direto nesta página), o que fazia este
    // fetch falhar silenciosamente e todos os colaboradores ficarem presos
    // em "Apólice por confirmar" até trocar de separador (remount, já com
    // o global pronto). O supabase do contexto já está garantidamente
    // pronto sempre que este componente é montado.
    if (!supabase) return;
    supabase.from('worker_apolice_seguro').select('worker_id, status').then(({ data }) => {
      setApoliceMap(Object.fromEntries((data || []).map(r => [r.worker_id, r])));
    });
  }, [supabase]);

  const verPortal = async (w) => {
    try {
      const { user, token } = await impersonarTrabalhador(w);
      onLogin('worker', { ...user, isAdminImpersonating: true }, token);
    } catch (e) {
      alert(e.message);
    }
  };

  useEffect(() => {
    authFetch('/api/seguranca-social?action=status')
      .then(r => r.json())
      .then(d => { if (d.ambiente) setSsAmbiente(d.ambiente); })
      .catch(() => {});
  }, []);

  // Consulta real ao serviço obterComunicacoes da PSI — pode contradizer o
  // que a app achava resolvido (ex: admissão rejeitada depois de o envio
  // síncrono ter parecido OK). Mapeado por NISS, que é a única chave comum
  // devolvida pela SS.
  useEffect(() => {
    consultarComunicacoesPendentes()
      .then(d => {
        const map = {};
        (d.naoAceites || []).forEach(c => { map[c.nissTrabalhador] = { prioridade: 'rejeitada', motivo: c.motivo, dataComunicacao: c.dataComunicacao }; });
        (d.aProcessar || []).forEach(c => {
          if (map[c.nissTrabalhador]) return; // rejeitada tem prioridade sobre presa
          const dias = Math.floor((Date.now() - new Date(c.dataComunicacao)) / 86400000);
          if (dias >= 2) map[c.nissTrabalhador] = { prioridade: 'presa', dataComunicacao: c.dataComunicacao };
        });
        setSsComunicacoesMap(map);
      })
      .catch(() => {});
  }, []);

  function handleSsSuccess(data, workerIdOverride, tipoOverride) {
    invalidarComunicacoesPendentes(); // o que está pendente na SS acabou de mudar
    const workerId = workerIdOverride || ssModal?.worker?.id;
    const tipo = tipoOverride || ssModal?.tipo;
    if (workerId && tipo) {
      const campo = tipo === 'admissao'
        ? { ss_admissao_comunicada_em: data.dataHora || new Date().toISOString(), ss_admissao_num_registo: data.numRegisto || null }
        : { ss_cessacao_comunicada_em: data.dataHora || new Date().toISOString(), ss_cessacao_num_registo: data.numRegisto || null };
      setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, ...campo } : w));
    }
  }

  const handleDelete = (id) => {
    onEdit?.({ __deleteId: id });
  };

  if (workersView === 'list') {
    return (
      <>
      <div className="bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm overflow-x-auto">
        <table className="min-w-[480px] w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[42%]" />
            <col className="hidden sm:table-column w-[33%]" />
            <col className="w-[17%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--border-soft)] bg-[var(--surface)]">
              <th
                onClick={() => setWorkersSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                className={`text-left px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)] cursor-pointer hover:text-[var(--ink-mid)] transition-colors`}
              >
                Colaborador {workersSort.key === 'name' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th
                onClick={() => setWorkersSort(prev => ({ key: 'schedule', direction: prev.key === 'schedule' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                className={`hidden sm:table-cell text-left px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)] cursor-pointer hover:text-[var(--ink-mid)] transition-colors`}
              >
                Horário · Unidade {workersSort.key === 'schedule' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className={`text-left px-3 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>
                Estado
              </th>
              <th className={`text-right px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)]`}>
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedWorkers.map(w => {
              const schedule = schedules.find(s => s.id === w.defaultScheduleId);
              const client = clients.find(c => c.id === w.defaultClientId);
              return (
                <tr key={w.id} onClick={() => onEdit(w)} className="border-b border-[var(--border-soft)] hover:bg-[var(--surface)] transition-colors cursor-pointer">
                  {/* Colaborador */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black" style={{ backgroundColor: FT.navy, color: FT.orange }}>{getInitials(w.name)}</div>
                      <div className="min-w-0">
                        <p className="font-black text-[var(--ink)] text-sm truncate">{w.name}</p>
                        <p className="text-xs text-[var(--slate-dim)] truncate">{w.profissao || 'Staff'}</p>
                        <div className="mt-1"><MiniTimeline w={w} ssFlag={ssComunicacoesMap[w.nis]} /></div>
                        <div className="mt-1">{apoliceBadge(w, apoliceMap)}</div>
                        {w.valorHora && <p className={`${SCALE.text.meta} text-[var(--slate-dim)] mt-0.5`}>{w.valorHora}€/h</p>}
                      </div>
                    </div>
                  </td>

                  {/* Horário · Unidade (oculto em mobile) */}
                  <td className="hidden sm:table-cell px-4 py-3">
                    <p className="text-xs font-bold text-[var(--slate-dim)] truncate">{schedule?.name || 'N/A'}</p>
                    <p className={`${SCALE.text.meta} text-[var(--slate-dim)] truncate`}>{client?.name || 'N/A'}</p>
                  </td>

                  {/* Estado — dois toggles compactos */}
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => saveToDb('workers', w.id, { ...w, status: w.status === 'inativo' ? 'ativo' : 'inativo' })}
                        title={w.status === 'inativo' ? 'Inativo — clique para ativar' : 'Ativo — clique para desativar'}
                        className={`p-1.5 rounded-lg transition-all ${w.status === 'inativo' ? 'text-rose-400 hover:bg-rose-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                      >
                        {w.status === 'inativo' ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                      </button>
                      <button
                        onClick={() => saveToDb('workers', w.id, { ...w, limited_entry_mode: !w.limited_entry_mode })}
                        title={w.limited_entry_mode ? 'Modo limitado ativo — clique para desativar' : 'Modo livre — clique para ativar modo limitado'}
                        className={`p-1.5 rounded-lg transition-all ${w.limited_entry_mode ? 'text-amber-500 hover:bg-amber-50' : 'text-[var(--slate)] hover:text-[var(--ink-soft)] hover:bg-[var(--surface-dim)]'}`}
                      >
                        {w.limited_entry_mode ? <ShieldOff size={15} /> : <CheckCircle size={15} />}
                      </button>
                    </div>
                  </td>

                  {/* Ações — dropdown ⋮ */}
                  <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === w.id ? null : w.id)}
                        className="p-1.5 text-[var(--slate)] hover:text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-lg transition-all"
                        title="Mais ações"
                      >
                        <MoreVertical size={15} />
                      </button>
                      {openMenuId === w.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-[var(--border)] rounded-xl shadow-xl ring-1 ring-black/5 py-1 min-w-[170px]">
                            <button
                              onClick={() => { onEdit(w); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-amber-50 group transition-colors"
                            >
                              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-100 text-amber-500 group-hover:bg-amber-200 transition-colors shrink-0"><Edit2 size={11} /></span>
                              <span className={`${SCALE.text.body} text-[var(--ink-mid)] group-hover:text-amber-700`}>Editar</span>
                            </button>
                            <button
                              onClick={() => { verPortal(w); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--surface)] group transition-colors"
                            >
                              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[var(--surface-dim)] group-hover:bg-[var(--border)] transition-colors shrink-0" style={{ color: 'var(--slate-dim)' }}><Search size={11} /></span>
                              <span className={`${SCALE.text.body} text-[var(--ink-mid)] group-hover:text-[var(--ink)]`}>Ver Portal</span>
                            </button>
                            <button
                              onClick={() => { onVerPasta?.(w.id); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-emerald-50 group transition-colors"
                            >
                              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-100 text-emerald-500 group-hover:bg-emerald-200 transition-colors shrink-0"><FolderOpen size={11} /></span>
                              <span className={`${SCALE.text.body} text-[var(--ink-mid)] group-hover:text-emerald-700`}>Ver Pasta</span>
                            </button>
                            <div className="mx-3 my-1 border-t border-[var(--border-soft)]" />
                            <button
                              onClick={() => { onOpenEmpHistory(w.id, w.name); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--surface)] group transition-colors"
                            >
                              <span className={`flex items-center justify-center w-6 h-6 rounded-lg bg-[var(--surface-dim)] group-hover:bg-[var(--border)] transition-colors shrink-0 leading-none ${SCALE.text.body}`}>📅</span>
                              <span className={`${SCALE.text.body} text-[var(--ink-mid)]`}>Períodos</span>
                            </button>
                            <button
                              onClick={() => { onOpenVHHistory(w.id, w.name); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--surface)] group transition-colors"
                            >
                              <span className={`flex items-center justify-center w-6 h-6 rounded-lg bg-[var(--surface-dim)] group-hover:bg-[var(--border)] transition-colors shrink-0 leading-none ${SCALE.text.body}`}>📊</span>
                              <span className={`${SCALE.text.body} text-[var(--ink-mid)]`}>Valor/hora</span>
                            </button>
                            {/* Segurança Social */}
                            {(w.status === 'ativo' && !w.ss_admissao_comunicada_em) && (
                              <>
                                <div className="mx-3 my-1 border-t border-[var(--border-soft)]" />
                                <button
                                  onClick={() => { setSsModal({ worker: w, tipo: 'admissao' }); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-amber-50 group transition-colors"
                                >
                                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-100 text-amber-600 group-hover:bg-amber-200 transition-colors shrink-0"><SendHorizonal size={11} /></span>
                                  <div className="text-left">
                                    <span className={`${SCALE.text.body} text-[var(--ink-mid)] group-hover:text-amber-700`}>Comunicar Admissão</span>
                                    {ssAmbiente === 'teste' && <p className={`${SCALE.text.statLabel} text-orange-500 leading-none`}>TESTE</p>}
                                  </div>
                                </button>
                              </>
                            )}
                            {(w.dataFim && !w.ss_cessacao_comunicada_em) && (
                              <>
                                {!(w.status === 'ativo' && !w.ss_admissao_comunicada_em) && <div className="mx-3 my-1 border-t border-[var(--border-soft)]" />}
                                <button
                                  onClick={() => { setSsModal({ worker: w, tipo: 'cessacao' }); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-amber-50 group transition-colors"
                                >
                                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-100 text-amber-600 group-hover:bg-amber-200 transition-colors shrink-0"><SendHorizonal size={11} /></span>
                                  <div className="text-left">
                                    <span className={`${SCALE.text.body} text-[var(--ink-mid)] group-hover:text-amber-700`}>Comunicar Cessação</span>
                                    {ssAmbiente === 'teste' && <p className={`${SCALE.text.statLabel} text-orange-500 leading-none`}>TESTE</p>}
                                  </div>
                                </button>
                              </>
                            )}
                            {w.ss_admissao_comunicada_em && (
                              <>
                                <div className="mx-3 my-1 border-t border-[var(--border-soft)]" />
                                <button
                                  onClick={() => { setAlterarContratoWorker(w); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-amber-50 group transition-colors"
                                >
                                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-100 text-amber-600 group-hover:bg-amber-200 transition-colors shrink-0"><FileEdit size={11} /></span>
                                  <div className="text-left">
                                    <span className={`${SCALE.text.body} text-[var(--ink-mid)] group-hover:text-amber-700`}>Alterar Contrato</span>
                                    {ssAmbiente === 'teste' && <p className={`${SCALE.text.statLabel} text-orange-500 leading-none`}>TESTE</p>}
                                  </div>
                                </button>
                              </>
                            )}
                            <div className="mx-3 my-1 border-t border-[var(--border-soft)]" />
                            {confirmDeleteWorkerId === w.id ? (
                              <div className="mx-2 mb-1 p-2 bg-rose-50 rounded-lg border border-rose-100">
                                <p className={`${SCALE.text.statLabel} text-rose-500 mb-1.5`}>Confirmar apagar?</p>
                                <div className="flex gap-1">
                                  <button onClick={() => { handleDelete(w.id); setConfirmDeleteWorkerId(null); setOpenMenuId(null); }} className={`flex-1 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors ${SCALE.text.meta}`}>Sim</button>
                                  <button onClick={() => setConfirmDeleteWorkerId(null)} className={`flex-1 py-1 bg-white border border-[var(--border)] text-[var(--ink-soft)] rounded-lg hover:bg-[var(--surface)] transition-colors ${SCALE.text.meta}`}>Não</button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteWorkerId(w.id)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-rose-50 group transition-colors"
                              >
                                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-rose-100 text-rose-500 group-hover:bg-rose-200 transition-colors shrink-0"><Trash2 size={11} /></span>
                                <span className={`${SCALE.text.body} text-rose-500 group-hover:text-rose-600`}>Apagar</span>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {ssModal && (
        <SSComunicacaoModal
          worker={ssModal.worker}
          tipo={ssModal.tipo}
          ambiente={ssAmbiente}
          onClose={() => setSsModal(null)}
          onSuccess={(data) => handleSsSuccess(data)}
        />
      )}
      {alterarContratoWorker && (
        <AlterarContratoModal
          worker={alterarContratoWorker}
          ambiente={ssAmbiente}
          onClose={() => setAlterarContratoWorker(null)}
          onSuccess={() => setAlterarContratoWorker(null)}
        />
      )}
    </>
    );
  }

  return (
    <>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {sortedWorkers.map(w => {
        const workerApproval = approvals.find(a => a.workerId === w.id && a.month === currentMonthStr);
        return (
          // Mantém-se a grelha responsiva própria em vez do CardGrid de 230px:
          // este cartão leva linha do tempo, badge de apólice e seis ações, e
          // a 230px o conteúdo ficava espremido.
          <Card key={w.id} variant="item" interactive onClick={() => onEdit(w)} className="!px-3 !py-3">
            <div className="flex justify-between items-start mb-2">
              <div className={`px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${SCALE.text.statLabel} ${w.status === 'inativo' ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50'}`}>
                {w.status !== 'inativo' && <CheckCircle size={8} />}
                {w.status === 'inativo' ? 'Inativo' : 'Ativo'}
              </div>
              <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => verPortal(w)} className="p-1 hover:bg-[var(--surface)] rounded-lg transition-all border border-[var(--border-soft)]" style={{ color: 'var(--slate-dim)' }} title="Ver Portal"><Search size={10} /></button>
                <button onClick={() => onEdit(w)} className="p-1 text-amber-600 hover:bg-amber-50 rounded-lg transition-all border border-amber-100" title="Editar"><Edit2 size={10} /></button>
                <button onClick={() => onVerPasta?.(w.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all border border-emerald-100" title="Ver Pasta de Documentos"><FolderOpen size={10} /></button>
                {w.status === 'ativo' && !w.ss_admissao_comunicada_em && (
                  <button onClick={() => setSsModal({ worker: w, tipo: 'admissao' })} className="p-1 text-amber-600 hover:bg-amber-50 rounded-lg transition-all border border-amber-200" title={`Comunicar Admissão à SS${ssAmbiente === 'teste' ? ' (TESTE)' : ''}`}><SendHorizonal size={10} /></button>
                )}
                {w.dataFim && !w.ss_cessacao_comunicada_em && (
                  <button onClick={() => setSsModal({ worker: w, tipo: 'cessacao' })} className="p-1 text-amber-600 hover:bg-amber-50 rounded-lg transition-all border border-amber-200" title={`Comunicar Cessação à SS${ssAmbiente === 'teste' ? ' (TESTE)' : ''}`}><SendHorizonal size={10} /></button>
                )}
                {w.ss_admissao_comunicada_em && (
                  <button onClick={() => setAlterarContratoWorker(w)} className="p-1 text-amber-600 hover:bg-amber-50 rounded-lg transition-all border border-amber-200" title={`Alterar Contrato na SS${ssAmbiente === 'teste' ? ' (TESTE)' : ''}`}><FileEdit size={10} /></button>
                )}
                {confirmDeleteWorkerId === w.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => { handleDelete(w.id); setConfirmDeleteWorkerId(null); }} className={`px-1.5 py-0.5 bg-red-600 text-white rounded-lg ${SCALE.text.meta}`}>Sim</button>
                    <button onClick={() => setConfirmDeleteWorkerId(null)} className={`px-1.5 py-0.5 bg-[var(--border)] text-[var(--ink-soft)] rounded-lg ${SCALE.text.meta}`}>Não</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteWorkerId(w.id)} className="p-1 text-[var(--slate)] hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all border border-[var(--border-soft)]"><Trash2 size={10} /></button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${SCALE.text.meta}`} style={{ backgroundColor: FT.navy, color: FT.orange }}>{getInitials(w.name)}</div>
              <div className="min-w-0">
                <h4 className="text-[0.95rem] font-bold leading-[1.15] text-[var(--ink-mid)] truncate" style={{ fontFamily: FONT_TITLE }} title={w.name}>{w.name}</h4>
                <p className={`${SCALE.text.meta} text-[var(--slate-dim)] truncate`} style={{ fontFamily: FONT_MONO }}>{w.profissao || 'Staff'}</p>
              </div>
            </div>
            <div className="mb-2">{vinculoBadge(w, apoliceMap, ssComunicacoesMap[w.nis])}</div>
            <div className={`${SCALE.text.meta} text-[var(--slate-dim)] space-y-0.5 border-t border-[var(--border-soft)] pt-1.5`}>
              <div className="flex items-center gap-1 truncate">
                <span>⏱</span> <span className="truncate">{schedules.find(s => s.id === w.defaultScheduleId)?.name || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1 truncate">
                <span>💼</span> <span className="truncate">{clients.find(c => c.id === w.defaultClientId)?.name || 'N/A'}</span>
              </div>
              {workerApproval && (
                <div className="flex items-center gap-1 pt-1"><CheckCircle size={9} className="text-emerald-500" /><span className="text-emerald-600">Aprovado</span></div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
    {ssModal && (
      <SSComunicacaoModal
        worker={ssModal.worker}
        tipo={ssModal.tipo}
        ambiente={ssAmbiente}
        onClose={() => setSsModal(null)}
        onSuccess={(data) => handleSsSuccess(data)}
      />
    )}
    {alterarContratoWorker && (
      <AlterarContratoModal
        worker={alterarContratoWorker}
        ambiente={ssAmbiente}
        onClose={() => setAlterarContratoWorker(null)}
        onSuccess={() => setAlterarContratoWorker(null)}
      />
    )}
    </>
  );
};

export { WorkerList as default, WorkerList };
