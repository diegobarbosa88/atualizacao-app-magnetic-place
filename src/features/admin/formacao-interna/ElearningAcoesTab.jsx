import React, { useEffect, useState } from 'react';
import { Loader2, ChevronDown, ChevronUp, FileDown, Users, Clock, Image as ImageIcon } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { listFormacoes } from './formacaoApi';
import { exportFormacaoPDF } from './formacaoExport';
import { CATEGORIAS } from './formacaoTemplates';

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
// mostra progresso/nota por participante e uma pré-visualização do
// questionário com as ilustrações associadas a cada pergunta.
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
        <div className="space-y-3">
          {formacoes.map(f => {
            const isOpen = expandedId === f.id;
            const participantes = f.formacao_participantes || [];
            const totalConcluidos = participantes.filter(p => p.assinado_em).length;
            return (
              <div key={f.id} className="rounded-3xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedId(isOpen ? null : f.id)}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 mb-1">
                      {CATEGORIA_LABEL[f.categoria] || f.categoria}
                    </span>
                    <p className="text-sm font-black text-slate-800">{f.tipo_formacao || f.titulo}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span className="inline-flex items-center gap-1"><Clock size={11} /> {f.duracao_horas}h</span>
                      <span className="inline-flex items-center gap-1"><Users size={11} /> {totalConcluidos}/{participantes.length} concluídos</span>
                      <span>Nota mínima {f.nota_minima_aprovacao}%</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); exportFormacaoPDF(f); }}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    title="Exportar PDF"
                  >
                    <FileDown size={16} />
                  </button>
                  {isOpen ? <ChevronUp size={16} className="text-slate-400 mt-1" /> : <ChevronDown size={16} className="text-slate-400 mt-1" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-slate-50 pt-3 space-y-4">
                    {f.conteudo_estruturado?.objetivo && (
                      <p className="text-xs text-slate-500"><span className="font-bold text-slate-700">Objetivo:</span> {f.conteudo_estruturado.objetivo}</p>
                    )}

                    <div className="space-y-2">
                      {participantes.map(p => {
                        const conclusaoCfg = ESTADO_CONCLUSAO_CFG[p.estado_conclusao];
                        const duracao = formatDuracao(p.iniciado_em, p.concluido_em);
                        return (
                          <div key={p.id} className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100">
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
                            <div key={qi} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50/70 border border-slate-100">
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
