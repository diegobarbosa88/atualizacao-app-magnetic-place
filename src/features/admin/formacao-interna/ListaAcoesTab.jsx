import React, { useEffect, useState } from 'react';
import { Loader2, ChevronDown, ChevronUp, FileDown, Users, Clock, MapPin, Building2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { listFormacoes } from './formacaoApi';
import { exportFormacaoPDF } from './formacaoExport';
import { CATEGORIAS } from './formacaoTemplates';

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - i);

const ESTADO_CFG = {
  valido:     { label: 'Válido',    bg: 'bg-emerald-50', text: 'text-emerald-600' },
  a_expirar:  { label: 'A Expirar', bg: 'bg-amber-50',   text: 'text-amber-600' },
  expirado:   { label: 'Expirado',  bg: 'bg-rose-50',    text: 'text-rose-600' },
};

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.label]));

// Só ações presenciais — o e-learning tem a sua própria tab (ver
// ElearningAcoesTab.jsx), com os campos e filtros próprios do formato.
export default function ListaAcoesTab({ refreshKey }) {
  const { supabase } = useApp();
  const [formacoes, setFormacoes] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workerFilter, setWorkerFilter] = useState('');
  const [anoFilter, setAnoFilter] = useState(String(ANO_ATUAL));
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
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
        estado: estadoFilter || undefined,
        formato: 'presencial',
      });
      setFormacoes(formacoes || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchFormacoes(); }, [workerFilter, anoFilter, categoriaFilter, estadoFilter, refreshKey]);

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
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
        >
          <option value="">Qualquer estado de validade</option>
          <option value="valido">Válido</option>
          <option value="a_expirar">A Expirar</option>
          <option value="expirado">Expirado</option>
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
        <p className="text-center py-10 text-slate-400 text-xs font-bold">Nenhuma ação presencial registada.</p>
      ) : (
        <div className="space-y-3">
          {formacoes.map(f => {
            const isOpen = expandedId === f.id;
            const participantes = f.formacao_participantes || [];
            const totalAssinados = participantes.filter(p => p.assinado_em).length;
            return (
              <div key={f.id} className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedId(isOpen ? null : f.id)}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
                        {CATEGORIA_LABEL[f.categoria] || f.categoria}
                      </span>
                      {f.exige_entidade_externa && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600">
                          <Building2 size={10} /> {f.entidade_externa || 'Entidade Externa'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-black text-slate-800">{f.tipo_formacao || f.titulo}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span className="inline-flex items-center gap-1"><Clock size={11} /> {f.duracao_horas}h</span>
                      {f.local && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {f.local}</span>}
                      <span className="inline-flex items-center gap-1"><Users size={11} /> {totalAssinados}/{participantes.length} assinados</span>
                      <span>{new Date(f.data_inicio).toLocaleDateString('pt-PT')} a {new Date(f.data_fim).toLocaleDateString('pt-PT')}</span>
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
                  <div className="px-4 pb-4 border-t border-slate-50 pt-3 space-y-3">
                    {f.formador?.name && (
                      <p className="text-xs text-slate-500"><span className="font-bold text-slate-700">Formador:</span> {f.formador.name}</p>
                    )}
                    {f.objetivos && (
                      <p className="text-xs text-slate-500"><span className="font-bold text-slate-700">Objetivos:</span> {f.objetivos}</p>
                    )}
                    {f.conteudo_programatico && (
                      <p className="text-xs text-slate-500"><span className="font-bold text-slate-700">Conteúdo Programático:</span> {f.conteudo_programatico}</p>
                    )}

                    <div className="space-y-2">
                      {participantes.map(p => {
                        const estCfg = ESTADO_CFG[p.estado];
                        return (
                          <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 border border-slate-100">
                            <div className="flex items-center gap-2 min-w-0">
                              {p.assinatura_signed_url ? (
                                <img src={p.assinatura_signed_url} alt="Assinatura" className="h-8 w-16 object-contain bg-white rounded-lg border border-slate-100" />
                              ) : null}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-700 truncate">{p.workers?.name || p.worker_id}</p>
                                {p.data_validade && (
                                  <p className="text-[9px] font-bold text-slate-400">Válido até {new Date(p.data_validade).toLocaleDateString('pt-PT')}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {estCfg && (
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${estCfg.bg} ${estCfg.text}`}>
                                  {estCfg.label}
                                </span>
                              )}
                              {p.assinado_em ? (
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                  Assinado {new Date(p.assinado_em).toLocaleDateString('pt-PT')}
                                </span>
                              ) : (
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                                  Por assinar (worker)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
