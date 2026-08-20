import React, { useEffect, useState } from 'react';
import { Loader2, ChevronDown, ChevronUp, FileDown, Users, Clock, Image as ImageIcon, UserPlus, Check } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { listFormacoes, atribuirParticipantes } from './formacaoApi';
import { exportFormacaoPDF } from './formacaoExport';
import { CATEGORIAS, CATEGORIAS_EXIGEM_VALIDADE, VALIDADE_PADRAO_MESES } from './formacaoTemplates';
import ModalShell from '../../../components/common/ModalShell';

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - i);

const ESTADO_CONCLUSAO_CFG = {
  nao_iniciado: { label: 'Não Iniciado', bg: 'bg-slate-100',  text: 'text-slate-400' },
  em_progresso: { label: 'Em Progresso', bg: 'bg-amber-50',   text: 'text-amber-600' },
  concluido:    { label: 'Concluído',    bg: 'bg-emerald-50', text: 'text-emerald-600' },
  reprovado:    { label: 'Reprovado',    bg: 'bg-rose-50',    text: 'text-rose-600' },
};

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.label]));

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
  const { supabase } = useApp();
  const [formacoes, setFormacoes] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workerFilter, setWorkerFilter] = useState('');
  const [anoFilter, setAnoFilter] = useState(String(ANO_ATUAL));
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const [atribuirAlvo, setAtribuirAlvo] = useState(null);
  const [selecionados, setSelecionados] = useState({});
  const [atribuirBusy, setAtribuirBusy] = useState(false);
  const [atribuirErro, setAtribuirErro] = useState('');

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

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={workerFilter}
          onChange={e => setWorkerFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
        >
          <option value="">Todos os trabalhadores</option>
          {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select
          value={categoriaFilter}
          onChange={e => setCategoriaFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
        >
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select
          value={anoFilter}
          onChange={e => setAnoFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
        >
          {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : formacoes.length === 0 ? (
        <p className="text-center py-10 text-slate-400 text-xs font-bold">Nenhuma ação e-learning registada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                <th className="py-2 pr-4">Formação</th>
                <th className="py-2 pr-4">Duração</th>
                <th className="py-2 pr-4">Participantes</th>
                <th className="py-2 pr-4">Nota Mínima</th>
                <th className="py-2 pr-4">Ações</th>
                <th className="py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {formacoes.map(f => {
                const isOpen = expandedId === f.id;
                const participantes = f.formacao_participantes || [];
                const totalConcluidos = participantes.filter(p => p.assinado_em).length;
                return (
                  <React.Fragment key={f.id}>
                    <tr
                      onClick={() => setExpandedId(isOpen ? null : f.id)}
                      className="border-b border-slate-50 cursor-pointer hover:bg-slate-50/70 transition-all"
                    >
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 mb-1">
                          {CATEGORIA_LABEL[f.categoria] || f.categoria}
                        </span>
                        <p className="font-black text-slate-800">{f.tipo_formacao || f.titulo}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1"><Clock size={12} /> {f.duracao_horas}h</span>
                      </td>
                      <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1"><Users size={12} /> {totalConcluidos}/{participantes.length} concluídos</span>
                      </td>
                      <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">{f.nota_minima_aprovacao}%</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); abrirAtribuir(f); }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Atribuir Trabalhadores"
                          >
                            <UserPlus size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); exportFormacaoPDF(f); }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Exportar PDF"
                          >
                            <FileDown size={16} />
                          </button>
                        </div>
                      </td>
                      <td className="py-3">
                        {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-slate-50">
                        <td colSpan={6} className="bg-slate-50/50 px-2 pb-4 pt-1">
                          <div className="space-y-4">
                            {f.conteudo_estruturado?.objetivo && (
                              <p className="text-xs text-slate-500"><span className="font-bold text-slate-700">Objetivo:</span> {f.conteudo_estruturado.objetivo}</p>
                            )}

                            <div className="space-y-2">
                              {participantes.map(p => {
                                const conclusaoCfg = ESTADO_CONCLUSAO_CFG[p.estado_conclusao];
                                const duracao = formatDuracao(p.iniciado_em, p.concluido_em);
                                return (
                                  <div key={p.id} className="p-3 rounded-2xl bg-white border border-slate-100">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-bold text-slate-700 truncate">{p.workers?.name || p.worker_id}</p>
                                      {p.assinado_em ? (
                                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg shrink-0">
                                          Assinado {new Date(p.assinado_em).toLocaleDateString('pt-PT')}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded-lg shrink-0">
                                          Por assinar (worker)
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                                      {conclusaoCfg && (
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${conclusaoCfg.bg} ${conclusaoCfg.text}`}>
                                          {conclusaoCfg.label}
                                        </span>
                                      )}
                                      {p.nota_obtida != null && (
                                        <span className="text-[9px] font-bold text-slate-500">Nota: {p.nota_obtida}%</span>
                                      )}
                                      {duracao && (
                                        <span className="text-[9px] font-bold text-slate-400">Tempo de conclusão: {duracao}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {Array.isArray(f.questionario) && f.questionario.length > 0 && (
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Questionário</p>
                                <div className="space-y-2">
                                  {f.questionario.map((q, qi) => (
                                    <div key={qi} className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-slate-100">
                                      {q.imagem_url ? (
                                        <img src={q.imagem_url} alt="" className="w-14 h-14 object-cover rounded-xl border border-slate-100 shrink-0" />
                                      ) : (
                                        <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-300">
                                          <ImageIcon size={18} />
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pergunta {qi + 1}</p>
                                        <p className="text-xs font-bold text-slate-700">{q.pergunta}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
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
        accent="indigo"
        size="md"
        footer={
          <div className="p-4 border-t border-slate-100">
            {atribuirErro && <p className="mb-3 text-xs font-bold text-rose-600">{atribuirErro}</p>}
            <button
              onClick={submeterAtribuicao}
              disabled={atribuirBusy || idsSelecionados.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {atribuirBusy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Atribuir {idsSelecionados.length > 0 ? `(${idsSelecionados.length})` : ''}
            </button>
          </div>
        }
      >
        <div className="p-4">
          {workersDisponiveis.length === 0 ? (
            <p className="text-center py-6 text-slate-400 text-xs font-bold">Todos os trabalhadores já são participantes desta ação.</p>
          ) : (
            <div className="border border-slate-100 rounded-2xl divide-y divide-slate-50">
              {workersDisponiveis.map(w => {
                const sel = selecionados[w.id];
                return (
                  <div key={w.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 transition-all">
                    <button
                      type="button"
                      onClick={() => toggleSelecionado(w.id)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    >
                      <span className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${sel ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                        {sel && <Check size={12} />}
                      </span>
                      <span className="text-xs font-bold text-slate-700 truncate">{w.name}</span>
                    </button>
                    {sel && exigeValidadeAlvo && (
                      <input
                        type="date"
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 shrink-0"
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
            <p className="text-[10px] font-bold text-slate-400 mt-2">Data de validade em branco assume automaticamente +{validadeMesesAlvo} meses.</p>
          )}
        </div>
      </ModalShell>
    </div>
  );
}
