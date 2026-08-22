import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { authFetch } from '../../../utils/authFetch';
import { impersonarTrabalhador } from '../../../utils/impersonateWorker';
import { Search, Edit2, Trash2, CheckCircle, ShieldCheck, ShieldOff, MoreVertical, FolderOpen, SendHorizonal, AlertTriangle, Shield } from 'lucide-react';
import SSComunicacaoModal from './SSComunicacaoModal';

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
    : 'bg-slate-200';

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
      <span className={`w-3 h-[2px] shrink-0 ${admissaoState === 'done' ? 'bg-emerald-500' : 'bg-slate-200'}`} />
      <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: '#1B3A57' }} />
      <span className={`w-3 h-[2px] shrink-0 ${cessacaoState === 'done' ? 'bg-emerald-500' : 'bg-slate-200'}`} />
      <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${dotCls(cessacaoState)}`} />
      <span className={`text-[9px] font-black uppercase tracking-wide ml-1 truncate ${labelCls}`}>{label}</span>
    </div>
  );
}

function apoliceBadge(w, apoliceMap) {
  const status = apoliceMap[w.id]?.status;
  if (status === 'ativo') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 border border-emerald-200 text-emerald-600">
        <Shield size={8} /> Apólice Ativa
      </span>
    );
  }
  if (status === 'solicitado' || status === 'pendente') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-50 border border-amber-200 text-amber-600">
        <AlertTriangle size={8} /> Apólice Solicitada
      </span>
    );
  }
  if (status === 'excluido') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 border border-slate-200 text-slate-500">
        <ShieldOff size={8} /> Apólice Excluída
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-50 border border-amber-200 text-amber-600">
      <AlertTriangle size={8} /> Apólice por confirmar
    </span>
  );
}

const WorkerList = ({ sortedWorkers, workersView, setWorkersView, workersSort, setWorkersSort, onLogin, onEdit, onOpenVHHistory, onOpenEmpHistory, onVerPasta }) => {
  const { approvals, currentMonthStr, schedules, clients, saveToDb, setWorkers, supabase } = useApp();
  const [confirmDeleteWorkerId, setConfirmDeleteWorkerId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [ssModal, setSsModal] = useState(null); // { worker, tipo: 'admissao'|'cessacao' }
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
    authFetch('/api/seguranca-social?action=comunicacoes-pendentes')
      .then(r => r.json())
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
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="min-w-[480px] w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[42%]" />
            <col className="hidden sm:table-column w-[33%]" />
            <col className="w-[17%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th
                onClick={() => setWorkersSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-700 transition-colors"
              >
                Colaborador {workersSort.key === 'name' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th
                onClick={() => setWorkersSort(prev => ({ key: 'schedule', direction: prev.key === 'schedule' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                className="hidden sm:table-cell text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-700 transition-colors"
              >
                Horário · Unidade {workersSort.key === 'schedule' ? (workersSort.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="text-left px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Estado
              </th>
              <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedWorkers.map(w => {
              const schedule = schedules.find(s => s.id === w.defaultScheduleId);
              const client = clients.find(c => c.id === w.defaultClientId);
              return (
                <tr key={w.id} onClick={() => onEdit(w)} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer">
                  {/* Colaborador */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black" style={{ backgroundColor: '#1B3A57', color: '#EB8D00' }}>{getInitials(w.name)}</div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-800 text-sm truncate">{w.name}</p>
                        <p className="text-xs text-slate-400 truncate">{w.profissao || 'Staff'}</p>
                        <div className="mt-1"><MiniTimeline w={w} ssFlag={ssComunicacoesMap[w.nis]} /></div>
                        <div className="mt-1">{apoliceBadge(w, apoliceMap)}</div>
                        {w.valorHora && <p className="text-[10px] text-slate-300 font-bold mt-0.5">{w.valorHora}€/h</p>}
                      </div>
                    </div>
                  </td>

                  {/* Horário · Unidade (oculto em mobile) */}
                  <td className="hidden sm:table-cell px-4 py-3">
                    <p className="text-xs font-bold text-slate-500 truncate">{schedule?.name || 'N/A'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{client?.name || 'N/A'}</p>
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
                        className={`p-1.5 rounded-lg transition-all ${w.limited_entry_mode ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:bg-slate-100'}`}
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
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                        title="Mais ações"
                      >
                        <MoreVertical size={15} />
                      </button>
                      {openMenuId === w.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200/80 rounded-xl shadow-xl ring-1 ring-black/5 py-1 min-w-[170px]">
                            <button
                              onClick={() => { onEdit(w); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-amber-50 group transition-colors"
                            >
                              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 text-amber-500 group-hover:bg-amber-200 transition-colors shrink-0"><Edit2 size={11} /></span>
                              <span className="text-[11px] font-semibold text-slate-700 group-hover:text-amber-700">Editar</span>
                            </button>
                            <button
                              onClick={() => { verPortal(w); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 group transition-colors"
                            >
                              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 group-hover:bg-slate-200 transition-colors shrink-0" style={{ color: '#869AAF' }}><Search size={11} /></span>
                              <span className="text-[11px] font-semibold text-slate-700 group-hover:text-slate-800">Ver Portal</span>
                            </button>
                            <button
                              onClick={() => { onVerPasta?.(w.id); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-emerald-50 group transition-colors"
                            >
                              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-500 group-hover:bg-emerald-200 transition-colors shrink-0"><FolderOpen size={11} /></span>
                              <span className="text-[11px] font-semibold text-slate-700 group-hover:text-emerald-700">Ver Pasta</span>
                            </button>
                            <div className="mx-3 my-1 border-t border-slate-100" />
                            <button
                              onClick={() => { onOpenEmpHistory(w.id, w.name); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 group transition-colors"
                            >
                              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 group-hover:bg-slate-200 transition-colors shrink-0 text-[11px] leading-none">📅</span>
                              <span className="text-[11px] font-semibold text-slate-700">Períodos</span>
                            </button>
                            <button
                              onClick={() => { onOpenVHHistory(w.id, w.name); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 group transition-colors"
                            >
                              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 group-hover:bg-slate-200 transition-colors shrink-0 text-[11px] leading-none">📊</span>
                              <span className="text-[11px] font-semibold text-slate-700">Valor/hora</span>
                            </button>
                            {/* Segurança Social */}
                            {(w.status === 'ativo' && !w.ss_admissao_comunicada_em) && (
                              <>
                                <div className="mx-3 my-1 border-t border-slate-100" />
                                <button
                                  onClick={() => { setSsModal({ worker: w, tipo: 'admissao' }); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-amber-50 group transition-colors"
                                >
                                  <span className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 text-amber-600 group-hover:bg-amber-200 transition-colors shrink-0"><SendHorizonal size={11} /></span>
                                  <div className="text-left">
                                    <span className="text-[11px] font-semibold text-slate-700 group-hover:text-amber-700">Comunicar Admissão</span>
                                    {ssAmbiente === 'teste' && <p className="text-[8px] text-orange-500 font-bold leading-none">TESTE</p>}
                                  </div>
                                </button>
                              </>
                            )}
                            {(w.dataFim && !w.ss_cessacao_comunicada_em) && (
                              <>
                                {!(w.status === 'ativo' && !w.ss_admissao_comunicada_em) && <div className="mx-3 my-1 border-t border-slate-100" />}
                                <button
                                  onClick={() => { setSsModal({ worker: w, tipo: 'cessacao' }); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-amber-50 group transition-colors"
                                >
                                  <span className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 text-amber-600 group-hover:bg-amber-200 transition-colors shrink-0"><SendHorizonal size={11} /></span>
                                  <div className="text-left">
                                    <span className="text-[11px] font-semibold text-slate-700 group-hover:text-amber-700">Comunicar Cessação</span>
                                    {ssAmbiente === 'teste' && <p className="text-[8px] text-orange-500 font-bold leading-none">TESTE</p>}
                                  </div>
                                </button>
                              </>
                            )}
                            <div className="mx-3 my-1 border-t border-slate-100" />
                            {confirmDeleteWorkerId === w.id ? (
                              <div className="mx-2 mb-1 p-2 bg-rose-50 rounded-lg border border-rose-100">
                                <p className="text-[9px] font-black text-rose-500 uppercase tracking-wider mb-1.5">Confirmar apagar?</p>
                                <div className="flex gap-1">
                                  <button onClick={() => { handleDelete(w.id); setConfirmDeleteWorkerId(null); setOpenMenuId(null); }} className="flex-1 py-1 bg-rose-600 text-white text-[9px] font-black rounded-md hover:bg-rose-700 transition-colors">Sim</button>
                                  <button onClick={() => setConfirmDeleteWorkerId(null)} className="flex-1 py-1 bg-white border border-slate-200 text-slate-600 text-[9px] font-black rounded-md hover:bg-slate-50 transition-colors">Não</button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteWorkerId(w.id)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-rose-50 group transition-colors"
                              >
                                <span className="flex items-center justify-center w-6 h-6 rounded-md bg-rose-100 text-rose-500 group-hover:bg-rose-200 transition-colors shrink-0"><Trash2 size={11} /></span>
                                <span className="text-[11px] font-semibold text-rose-500 group-hover:text-rose-600">Apagar</span>
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
    </>
    );
  }

  return (
    <>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {sortedWorkers.map(w => {
        const workerApproval = approvals.find(a => a.workerId === w.id && a.month === currentMonthStr);
        return (
          <div key={w.id} onClick={() => onEdit(w)} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
            <div className="flex justify-between items-start mb-2">
              <div className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase border flex items-center gap-1 ${w.status === 'inativo' ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50'}`}>
                {w.status !== 'inativo' && <CheckCircle size={8} />}
                {w.status === 'inativo' ? 'Inativo' : 'Ativo'}
              </div>
              <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => verPortal(w)} className="p-1 hover:bg-slate-50 rounded-md transition-all border border-slate-100" style={{ color: '#869AAF' }} title="Ver Portal"><Search size={10} /></button>
                <button onClick={() => onEdit(w)} className="p-1 text-amber-600 hover:bg-amber-50 rounded-md transition-all border border-amber-100" title="Editar"><Edit2 size={10} /></button>
                <button onClick={() => onVerPasta?.(w.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-all border border-emerald-100" title="Ver Pasta de Documentos"><FolderOpen size={10} /></button>
                {w.status === 'ativo' && !w.ss_admissao_comunicada_em && (
                  <button onClick={() => setSsModal({ worker: w, tipo: 'admissao' })} className="p-1 text-amber-600 hover:bg-amber-50 rounded-md transition-all border border-amber-200" title={`Comunicar Admissão à SS${ssAmbiente === 'teste' ? ' (TESTE)' : ''}`}><SendHorizonal size={10} /></button>
                )}
                {w.dataFim && !w.ss_cessacao_comunicada_em && (
                  <button onClick={() => setSsModal({ worker: w, tipo: 'cessacao' })} className="p-1 text-amber-600 hover:bg-amber-50 rounded-md transition-all border border-amber-200" title={`Comunicar Cessação à SS${ssAmbiente === 'teste' ? ' (TESTE)' : ''}`}><SendHorizonal size={10} /></button>
                )}
                {confirmDeleteWorkerId === w.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => { handleDelete(w.id); setConfirmDeleteWorkerId(null); }} className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded-md">Sim</button>
                    <button onClick={() => setConfirmDeleteWorkerId(null)} className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-md">Não</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteWorkerId(w.id)} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all border border-slate-100"><Trash2 size={10} /></button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black" style={{ backgroundColor: '#1B3A57', color: '#EB8D00' }}>{getInitials(w.name)}</div>
              <div className="min-w-0">
                <h4 className="font-black text-slate-800 text-xs truncate">{w.name}</h4>
                <p className="text-[9px] text-slate-400 font-bold truncate">{w.profissao || 'Staff'}</p>
              </div>
            </div>
            <div className="mb-1.5 overflow-hidden"><MiniTimeline w={w} ssFlag={ssComunicacoesMap[w.nis]} /></div>
            <div className="mb-2">{apoliceBadge(w, apoliceMap)}</div>
            <div className="text-[9px] text-slate-400 font-bold space-y-0.5 border-t border-slate-50 pt-1.5">
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
          </div>
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
    </>
  );
};

export { WorkerList as default, WorkerList };
