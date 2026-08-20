import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, ChevronDown, ChevronUp, FileDown, Users, Clock, MapPin, Building2, Search, ListChecks, PenLine, AlertTriangle, Award } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { listFormacoes } from './formacaoApi';
import { exportFormacaoPDF, exportCertificadoPDF } from './formacaoExport';
import { CATEGORIAS } from './formacaoTemplates';
import { ResumoCard, BarraProgresso } from './formacaoAdminUiKit';

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - i);

const ESTADO_CFG = {
  valido:     { label: 'Válido',    bg: 'bg-emerald-50', text: 'text-emerald-600' },
  a_expirar:  { label: 'A Expirar', bg: 'bg-amber-50',   text: 'text-amber-600' },
  expirado:   { label: 'Expirado',  bg: 'bg-rose-50',    text: 'text-rose-600' },
};

// Ordem de urgência para listar participantes dentro de uma ação — quem
// precisa de atenção do admin aparece primeiro.
const ORDEM_URGENCIA = { expirado: 0, a_expirar: 1, valido: 3 };

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
  const [busca, setBusca] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [emitindoCertId, setEmitindoCertId] = useState(null);

  const emitirCertificado = async (formacao, participante) => {
    setEmitindoCertId(participante.id);
    setError('');
    try {
      await exportCertificadoPDF(formacao, participante);
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

  const formacoesFiltradas = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    if (!buscaNorm) return formacoes;
    return formacoes.filter(f => (f.tipo_formacao || f.titulo || '').toLowerCase().includes(buscaNorm));
  }, [formacoes, busca]);

  const resumo = useMemo(() => {
    let totalParticipantes = 0, totalAssinados = 0, pendentesAssinatura = 0;
    for (const f of formacoes) {
      const participantes = f.formacao_participantes || [];
      totalParticipantes += participantes.length;
      for (const p of participantes) {
        if (p.assinado_em) totalAssinados++;
        else pendentesAssinatura++;
      }
    }
    const taxaMedia = totalParticipantes > 0 ? Math.round((totalAssinados / totalParticipantes) * 100) : 0;
    return { totalAcoes: formacoes.length, totalParticipantes, taxaMedia, pendentesAssinatura };
  }, [formacoes]);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <ResumoCard icon={<ListChecks size={16} />} label="Ações presenciais" value={resumo.totalAcoes} />
        <ResumoCard icon={<Users size={16} />} label="Participantes" value={resumo.totalParticipantes} accent="bg-slate-100 text-slate-600" />
        <ResumoCard icon={<ListChecks size={16} />} label="Taxa de assinatura" value={`${resumo.taxaMedia}%`} accent="bg-emerald-50 text-emerald-600" />
        <ResumoCard icon={<PenLine size={16} />} label="Por assinar" value={resumo.pendentesAssinatura} accent="bg-amber-50 text-amber-600" />
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Pesquisar formação..."
            className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 placeholder:text-slate-300 placeholder:font-semibold w-52"
          />
        </div>
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
      ) : formacoesFiltradas.length === 0 ? (
        <p className="text-center py-10 text-slate-400 text-xs font-bold">
          {formacoes.length === 0 ? 'Nenhuma ação presencial registada.' : 'Nenhuma ação corresponde aos filtros.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                <th className="py-2 pr-4">Formação</th>
                <th className="py-2 pr-4">Duração</th>
                <th className="py-2 pr-4">Assinaturas</th>
                <th className="py-2 pr-4">Local</th>
                <th className="py-2 pr-4">Ações</th>
                <th className="py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {formacoesFiltradas.map(f => {
                const isOpen = expandedId === f.id;
                const participantes = f.formacao_participantes || [];
                const totalAssinados = participantes.filter(p => p.assinado_em).length;
                const temExpirado = participantes.some(p => p.estado === 'expirado');
                const participantesOrdenados = [...participantes].sort((a, b) =>
                  (ORDEM_URGENCIA[a.estado] ?? 2) - (ORDEM_URGENCIA[b.estado] ?? 2)
                );
                return (
                  <React.Fragment key={f.id}>
                    <tr
                      onClick={() => setExpandedId(isOpen ? null : f.id)}
                      className="border-b border-slate-50 cursor-pointer hover:bg-slate-50/70 transition-all"
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600">
                            {CATEGORIA_LABEL[f.categoria] || f.categoria}
                          </span>
                          {f.exige_entidade_externa && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
                              <Building2 size={10} /> {f.entidade_externa || 'Entidade Externa'}
                            </span>
                          )}
                          {temExpirado && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-600">
                              <AlertTriangle size={10} /> Expirado
                            </span>
                          )}
                        </div>
                        <p className="font-black text-slate-800">{f.tipo_formacao || f.titulo}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1"><Clock size={12} /> {f.duracao_horas}h</span>
                      </td>
                      <td className="py-3 pr-4">
                        <BarraProgresso concluidos={totalAssinados} total={participantes.length} />
                      </td>
                      <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">
                        {f.local ? <span className="inline-flex items-center gap-1"><MapPin size={12} /> {f.local}</span> : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); exportFormacaoPDF(f); }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title="Exportar PDF"
                        >
                          <FileDown size={16} />
                        </button>
                      </td>
                      <td className="py-3">
                        {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-slate-50">
                        <td colSpan={6} className="bg-slate-50/50 px-2 pb-4 pt-3">
                          <div className="px-1 space-y-1 mb-3">
                            {f.formador?.name && (
                              <p className="text-xs text-slate-500"><span className="font-bold text-slate-700">Formador:</span> {f.formador.name}</p>
                            )}
                            {f.objetivos && (
                              <p className="text-xs text-slate-500"><span className="font-bold text-slate-700">Objetivos:</span> {f.objetivos}</p>
                            )}
                            {f.conteudo_programatico && (
                              <p className="text-xs text-slate-500"><span className="font-bold text-slate-700">Conteúdo Programático:</span> {f.conteudo_programatico}</p>
                            )}
                            <p className="text-xs text-slate-500">
                              <span className="font-bold text-slate-700">Período:</span> {new Date(f.data_inicio).toLocaleDateString('pt-PT')} a {new Date(f.data_fim).toLocaleDateString('pt-PT')}
                            </p>
                          </div>

                          <div className="space-y-2 px-1">
                            {participantesOrdenados.length === 0 ? (
                              <p className="text-center py-6 text-slate-400 text-xs font-bold">Sem participantes atribuídos.</p>
                            ) : participantesOrdenados.map(p => {
                              const estCfg = ESTADO_CFG[p.estado];
                              return (
                                <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-100">
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
                                      <>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                          Assinado {new Date(p.assinado_em).toLocaleDateString('pt-PT')}
                                        </span>
                                        <button
                                          onClick={() => emitirCertificado(f, p)}
                                          disabled={emitindoCertId === p.id}
                                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-50"
                                          title="Emitir Certificado"
                                        >
                                          {emitindoCertId === p.id ? <Loader2 size={13} className="animate-spin" /> : <Award size={13} />}
                                        </button>
                                      </>
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
    </div>
  );
}
