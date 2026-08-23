import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, ChevronDown, ChevronUp, FileDown, Users, Clock, Image as ImageIcon, UserPlus, Check, Search, GraduationCap, PenLine, AlertTriangle, Award } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { listFormacoes, atribuirParticipantes } from './formacaoApi';
import { exportFormacaoPDF, exportCertificadoPDF } from './formacaoExport';
import { CATEGORIAS, CATEGORIAS_EXIGEM_VALIDADE, VALIDADE_PADRAO_MESES } from './formacaoTemplates';
import { IlustracaoTile } from './formacaoIcons';
import { ResumoCard, BarraProgresso } from './formacaoAdminUiKit';
import ModalShell from '../../../components/common/ModalShell';
import SubTabBar from '../../../components/common/SubTabBar';

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - i);

const ESTADO_CONCLUSAO_CFG = {
  nao_iniciado: { label: 'Não Iniciado', bg: 'bg-[var(--surface-dim)]',  text: 'text-[var(--slate-dim)]' },
  em_progresso: { label: 'Em Progresso', bg: 'bg-amber-50',   text: 'text-amber-600' },
  concluido:    { label: 'Concluído',    bg: 'bg-emerald-50', text: 'text-emerald-600' },
  reprovado:    { label: 'Reprovado',    bg: 'bg-rose-50',    text: 'text-rose-600' },
};

// Ordem de urgência para listar participantes dentro de uma ação — quem
// precisa de atenção do admin aparece primeiro.
const ORDEM_URGENCIA = { reprovado: 0, em_progresso: 1, nao_iniciado: 2, concluido: 3 };

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.label]));

const SUB_TABS = [
  { id: 'participantes', label: 'Participantes' },
  { id: 'conteudo', label: 'Conteúdo' },
  { id: 'questionario', label: 'Questionário' },
];

function formatDuracao(iniciadoEm, concluidoEm) {
  if (!iniciadoEm || !concluidoEm) return null;
  const minutos = Math.round((new Date(concluidoEm) - new Date(iniciadoEm)) / 60000);
  if (minutos < 1) return '<1 min';
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)}h ${minutos % 60}min`;
}

// Ações e-learning, separadas das presenciais (ver ListaAcoesTab.jsx) —
// mostra progresso/nota por participante, preview do questionário com as
// ilustrações de cada pergunta, e permite atribuir a ação a mais
// trabalhadores depois de já criada (não só no momento da criação).
export default function ElearningAcoesTab({ refreshKey }) {
  const { supabase, companySignature } = useApp();
  const [formacoes, setFormacoes] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workerFilter, setWorkerFilter] = useState('');
  const [anoFilter, setAnoFilter] = useState(String(ANO_ATUAL));
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [busca, setBusca] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedTab, setExpandedTab] = useState('participantes');

  const [atribuirAlvo, setAtribuirAlvo] = useState(null);
  const [selecionados, setSelecionados] = useState({});
  const [atribuirBusy, setAtribuirBusy] = useState(false);
  const [atribuirErro, setAtribuirErro] = useState('');
  const [emitindoCertId, setEmitindoCertId] = useState(null);

  const emitirCertificado = async (formacao, participante) => {
    setEmitindoCertId(participante.id);
    setError('');
    try {
      await exportCertificadoPDF(formacao, participante, companySignature);
    } catch (e) {
      setError(e.message);
    }
    setEmitindoCertId(null);
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.from('workers').select('id, name').order('name').then(({ data }) => setWorkers(data || []));
  }, [supabase]);

  const fetchFormacoes = async () => {
    setLoading(true);
    setError('');
    try {
      const { formacoes } = await listFormacoes({
        workerId: workerFilter || undefined,
        ano: anoFilter || undefined,
        categoria: categoriaFilter || undefined,
        formato: 'e-learning',
      });
      setFormacoes(formacoes || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchFormacoes(); }, [workerFilter, anoFilter, categoriaFilter, refreshKey]);

  // Defesa extra: se por alguma razão existir mais do que um registo para o
  // mesmo tipo de formação (ex: criado duas vezes por engano), mostra-se
  // como uma única linha — participantes de todos os registos combinados,
  // usando o mais recente como base para as ações (Atribuir/Exportar).
  const formacoesAgrupadas = useMemo(() => {
    const porTipo = new Map();
    for (const f of formacoes) {
      const chave = `${f.categoria}::${f.tipo_formacao || f.titulo}`;
      const atual = porTipo.get(chave);
      if (!atual) {
        porTipo.set(chave, { ...f, formacao_participantes: [...(f.formacao_participantes || [])] });
        continue;
      }
      const idsExistentes = new Set(atual.formacao_participantes.map(p => p.worker_id));
      for (const p of f.formacao_participantes || []) {
        if (!idsExistentes.has(p.worker_id)) atual.formacao_participantes.push(p);
      }
    }
    return [...porTipo.values()];
  }, [formacoes]);

  const formacoesFiltradas = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    return formacoesAgrupadas.filter(f => {
      if (buscaNorm && !(f.tipo_formacao || f.titulo || '').toLowerCase().includes(buscaNorm)) return false;
      if (estadoFilter && !(f.formacao_participantes || []).some(p => p.estado_conclusao === estadoFilter)) return false;
      return true;
    });
  }, [formacoesAgrupadas, busca, estadoFilter]);

  // Resumo global — visão rápida sem precisar de expandir cada linha.
  const resumo = useMemo(() => {
    let totalParticipantes = 0, totalConcluidos = 0, pendentesAssinatura = 0;
    for (const f of formacoesAgrupadas) {
      const participantes = f.formacao_participantes || [];
      totalParticipantes += participantes.length;
      for (const p of participantes) {
        if (p.assinado_em) totalConcluidos++;
        else if (p.estado_conclusao === 'concluido') pendentesAssinatura++;
      }
    }
    const taxaMedia = totalParticipantes > 0 ? Math.round((totalConcluidos / totalParticipantes) * 100) : 0;
    return { totalAcoes: formacoesAgrupadas.length, totalParticipantes, taxaMedia, pendentesAssinatura };
  }, [formacoesAgrupadas]);

  const abrirAtribuir = (f) => {
    setAtribuirErro('');
    setSelecionados({});
    setAtribuirAlvo(f);
  };

  const toggleSelecionado = (id) => {
    setSelecionados(prev => {
      if (prev[id]) {
        const { [id]: _omit, ...resto } = prev;
        return resto;
      }
      return { ...prev, [id]: { data_validade: '' } };
    });
  };

  const setValidadeSelecionado = (id, data_validade) => {
    setSelecionados(prev => ({ ...prev, [id]: { ...prev[id], data_validade } }));
  };

  const exigeValidadeAlvo = atribuirAlvo && CATEGORIAS_EXIGEM_VALIDADE.includes(atribuirAlvo.categoria);
  const validadeMesesAlvo = atribuirAlvo && VALIDADE_PADRAO_MESES[atribuirAlvo.categoria];
  const idsSelecionados = Object.keys(selecionados);

  const submeterAtribuicao = async () => {
    setAtribuirErro('');
    if (idsSelecionados.length === 0) {
      setAtribuirErro('Seleciona pelo menos um trabalhador.');
      return;
    }
    setAtribuirBusy(true);
    try {
      await atribuirParticipantes(
        atribuirAlvo.id,
        idsSelecionados.map(id => ({ worker_id: id, data_validade: selecionados[id].data_validade || null }))
      );
      setAtribuirAlvo(null);
      await fetchFormacoes();
    } catch (e) {
      setAtribuirErro(e.message);
    }
    setAtribuirBusy(false);
  };

  const workersDisponiveis = atribuirAlvo
    ? workers.filter(w => !(atribuirAlvo.formacao_participantes || []).some(p => p.worker_id === w.id))
    : [];

  const toggleExpandida = (id) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setExpandedTab('participantes');
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <ResumoCard icon={<GraduationCap size={16} />} label="Ações e-learning" value={resumo.totalAcoes} />
        <ResumoCard icon={<Users size={16} />} label="Participantes" value={resumo.totalParticipantes} accent="bg-[var(--surface-dim)] text-[var(--ink-soft)]" />
        <ResumoCard icon={<Check size={16} />} label="Taxa de conclusão" value={`${resumo.taxaMedia}%`} accent="bg-emerald-50 text-emerald-600" />
        <ResumoCard icon={<PenLine size={16} />} label="Por assinar" value={resumo.pendentesAssinatura} accent="bg-amber-50 text-amber-600" />
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate)]" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Pesquisar formação..."
            className="pl-8 pr-3 py-2 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--ink-soft)] placeholder:text-[var(--slate)] placeholder:font-semibold w-52"
          />
        </div>
        <select
          value={workerFilter}
          onChange={e => setWorkerFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--ink-soft)]"
        >
          <option value="">Todos os trabalhadores</option>
          {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select
          value={categoriaFilter}
          onChange={e => setCategoriaFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--ink-soft)]"
        >
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--ink-soft)]"
        >
          <option value="">Todos os estados</option>
          {Object.entries(ESTADO_CONCLUSAO_CFG).map(([id, cfg]) => <option key={id} value={id}>{cfg.label}</option>)}
        </select>
        <select
          value={anoFilter}
          onChange={e => setAnoFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--ink-soft)]"
        >
          {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--slate-dim)]">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : formacoesFiltradas.length === 0 ? (
        <p className="text-center py-10 text-[var(--slate-dim)] text-xs font-bold">
          {formacoesAgrupadas.length === 0 ? 'Nenhuma ação e-learning registada.' : 'Nenhuma ação corresponde aos filtros.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[9px] font-black uppercase tracking-widest text-[var(--slate-dim)] border-b border-[var(--border-soft)]">
                <th className="py-2 pr-4">Formação</th>
                <th className="py-2 pr-4">Duração</th>
                <th className="py-2 pr-4">Progresso</th>
                <th className="py-2 pr-4">Nota Mínima</th>
                <th className="py-2 pr-4">Ações</th>
                <th className="py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {formacoesFiltradas.map(f => {
                const isOpen = expandedId === f.id;
                const participantes = f.formacao_participantes || [];
                const totalConcluidos = participantes.filter(p => p.assinado_em).length;
                const temReprovado = participantes.some(p => p.estado_conclusao === 'reprovado');
                const participantesOrdenados = [...participantes].sort((a, b) =>
                  (ORDEM_URGENCIA[a.estado_conclusao] ?? 9) - (ORDEM_URGENCIA[b.estado_conclusao] ?? 9)
                );
                return (
                  <React.Fragment key={f.id}>
                    <tr
                      onClick={() => toggleExpandida(f.id)}
                      className="border-b border-[var(--border-soft)] cursor-pointer hover:bg-[var(--surface)] transition-all"
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600">
                            {CATEGORIA_LABEL[f.categoria] || f.categoria}
                          </span>
                          {temReprovado && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-600">
                              <AlertTriangle size={10} /> Reprovado
                            </span>
                          )}
                        </div>
                        <p className="font-black text-[var(--ink)]">{f.tipo_formacao || f.titulo}</p>
                      </td>
                      <td className="py-3 pr-4 text-[var(--slate-dim)] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1"><Clock size={12} /> {f.duracao_horas}h</span>
                      </td>
                      <td className="py-3 pr-4">
                        <BarraProgresso concluidos={totalConcluidos} total={participantes.length} />
                      </td>
                      <td className="py-3 pr-4 text-[var(--slate-dim)] whitespace-nowrap">{f.nota_minima_aprovacao}%</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); abrirAtribuir(f); }}
                            className="p-2 text-[var(--slate)] hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Atribuir Trabalhadores"
                          >
                            <UserPlus size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); exportFormacaoPDF(f); }}
                            className="p-2 text-[var(--slate)] hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Exportar PDF"
                          >
                            <FileDown size={16} />
                          </button>
                        </div>
                      </td>
                      <td className="py-3">
                        {isOpen ? <ChevronUp size={16} className="text-[var(--slate)]" /> : <ChevronDown size={16} className="text-[var(--slate)]" />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-[var(--border-soft)]">
                        <td colSpan={6} className="bg-[var(--surface)] px-2 pb-4 pt-1">
                          {f.conteudo_estruturado?.objetivo && (
                            <p className="text-xs text-[var(--slate-dim)] px-1 pt-2 pb-3">
                              <span className="font-bold text-[var(--ink-mid)]">Objetivo:</span> {f.conteudo_estruturado.objetivo}
                            </p>
                          )}

                          <SubTabBar
                            tabs={SUB_TABS.map(tab => ({
                              ...tab,
                              badge: tab.id === 'participantes' && participantes.length > 0
                                ? participantes.length
                                : tab.id === 'questionario' && Array.isArray(f.questionario) && f.questionario.length > 0
                                  ? f.questionario.length
                                  : undefined,
                              badgeColor: 'slate',
                            }))}
                            activeTab={expandedTab}
                            onTabChange={setExpandedTab}
                            className="mb-3"
                          />

                          {expandedTab === 'participantes' && (
                            <div className="space-y-2 px-1">
                              {participantesOrdenados.length === 0 ? (
                                <p className="text-center py-6 text-[var(--slate-dim)] text-xs font-bold">Sem participantes atribuídos.</p>
                              ) : participantesOrdenados.map(p => {
                                const conclusaoCfg = ESTADO_CONCLUSAO_CFG[p.estado_conclusao];
                                const duracao = formatDuracao(p.iniciado_em, p.concluido_em);
                                return (
                                  <div key={p.id} className="p-3 rounded-2xl bg-white border border-[var(--border-soft)]">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-bold text-[var(--ink-mid)] truncate">{p.workers?.name || p.worker_id}</p>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {p.assinado_em ? (
                                          <>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                              Assinado {new Date(p.assinado_em).toLocaleDateString('pt-PT')}
                                            </span>
                                            <button
                                              onClick={() => emitirCertificado(f, p)}
                                              disabled={emitindoCertId === p.id}
                                              className="p-1.5 text-[var(--slate)] hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-50"
                                              title="Emitir Certificado"
                                            >
                                              {emitindoCertId === p.id ? <Loader2 size={13} className="animate-spin" /> : <Award size={13} />}
                                            </button>
                                          </>
                                        ) : (
                                          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--ink-soft)] bg-[var(--surface-dim)] px-2 py-1 rounded-lg">
                                            Por assinar (worker)
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-[var(--border-soft)]">
                                      {conclusaoCfg && (
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${conclusaoCfg.bg} ${conclusaoCfg.text}`}>
                                          {conclusaoCfg.label}
                                        </span>
                                      )}
                                      {p.nota_obtida != null && (
                                        <span className="text-[9px] font-bold text-[var(--slate-dim)]">Nota: {p.nota_obtida}%</span>
                                      )}
                                      {duracao && (
                                        <span className="text-[9px] font-bold text-[var(--slate-dim)]">Tempo de conclusão: {duracao}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {expandedTab === 'conteudo' && (
                            <div className="space-y-2 px-1">
                              {!Array.isArray(f.conteudo_estruturado?.seccoes) || f.conteudo_estruturado.seccoes.length === 0 ? (
                                <p className="text-center py-6 text-[var(--slate-dim)] text-xs font-bold">Sem conteúdo estruturado.</p>
                              ) : f.conteudo_estruturado.seccoes.map((sec, si) => (
                                <div key={si} className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-[var(--border-soft)]">
                                  <div className="w-14 h-14 shrink-0">
                                    {sec.icone ? (
                                      <IlustracaoTile nome={sec.icone} height={56} />
                                    ) : (
                                      <div className="w-14 h-14 rounded-xl bg-[var(--surface-dim)] flex items-center justify-center text-[var(--ink-soft)]">
                                        <ImageIcon size={18} />
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs font-bold text-[var(--ink-mid)]">{sec.titulo}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {expandedTab === 'questionario' && (
                            <div className="space-y-2 px-1">
                              {!Array.isArray(f.questionario) || f.questionario.length === 0 ? (
                                <p className="text-center py-6 text-[var(--slate-dim)] text-xs font-bold">Sem questionário.</p>
                              ) : f.questionario.map((q, qi) => (
                                <div key={qi} className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-[var(--border-soft)]">
                                  <div className="w-14 h-14 shrink-0">
                                    {q.icone ? (
                                      <IlustracaoTile nome={q.icone} height={56} />
                                    ) : (
                                      <div className="w-14 h-14 rounded-xl bg-[var(--surface-dim)] flex items-center justify-center text-[var(--ink-soft)]">
                                        <ImageIcon size={18} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Pergunta {qi + 1}</p>
                                    <p className="text-xs font-bold text-[var(--ink-mid)]">{q.pergunta}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ModalShell
        isOpen={!!atribuirAlvo}
        onClose={() => !atribuirBusy && setAtribuirAlvo(null)}
        title="Atribuir Trabalhadores"
        subtitle={atribuirAlvo?.tipo_formacao}
        icon={<UserPlus size={16} />}
        accent="default"
        size="md"
        footer={
          <div className="p-4 border-t border-[var(--border-soft)]">
            {atribuirErro && <p className="mb-3 text-xs font-bold text-rose-600">{atribuirErro}</p>}
            <button
              onClick={submeterAtribuicao}
              disabled={atribuirBusy || idsSelecionados.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--orange)] text-[var(--navy-solid)] rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[var(--orange-hover)] transition-all disabled:opacity-50"
            >
              {atribuirBusy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Atribuir {idsSelecionados.length > 0 ? `(${idsSelecionados.length})` : ''}
            </button>
          </div>
        }
      >
        <div className="p-4">
          {workersDisponiveis.length === 0 ? (
            <p className="text-center py-6 text-[var(--slate-dim)] text-xs font-bold">Todos os trabalhadores já são participantes desta ação.</p>
          ) : (
            <div className="border border-[var(--border-soft)] rounded-2xl divide-y divide-[var(--border-soft)]">
              {workersDisponiveis.map(w => {
                const sel = selecionados[w.id];
                return (
                  <div key={w.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[var(--surface)] transition-all">
                    <button
                      type="button"
                      onClick={() => toggleSelecionado(w.id)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    >
                      <span className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${sel ? 'bg-indigo-600 text-white' : 'bg-[var(--surface-dim)]'}`}>
                        {sel && <Check size={12} />}
                      </span>
                      <span className="text-xs font-bold text-[var(--ink-mid)] truncate">{w.name}</span>
                    </button>
                    {sel && exigeValidadeAlvo && (
                      <input
                        type="date"
                        className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[11px] font-bold text-[var(--ink-soft)] shrink-0"
                        value={sel.data_validade}
                        onChange={e => setValidadeSelecionado(w.id, e.target.value)}
                        placeholder={validadeMesesAlvo ? `Auto (+${validadeMesesAlvo}m)` : 'Data de validade'}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {exigeValidadeAlvo && validadeMesesAlvo && (
            <p className="text-[10px] font-bold text-[var(--slate-dim)] mt-2">Data de validade em branco assume automaticamente +{validadeMesesAlvo} meses.</p>
          )}
        </div>
      </ModalShell>
    </div>
  );
}
