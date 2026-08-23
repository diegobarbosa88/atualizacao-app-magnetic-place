import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, FileDown, User, Clock, CheckCircle2, AlertTriangle, Hourglass, Award } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { listFormacoes } from './formacaoApi';
import { exportRegistoIndividualPDF, exportCertificadoPDF } from './formacaoExport';
import { CATEGORIAS } from './formacaoTemplates';

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - i);

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.label]));

function fmtData(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-PT');
}

function isBissexto(ano) {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

// Cálculo proporcional das 40h anuais do art. 131.º CT — proporcional ao
// número de dias de vínculo dentro do ano e ao regime (tempo inteiro vs.
// parcial, via horas_semanais/40). Não é um cálculo juridicamente
// vinculativo, mas uma estimativa de boa-fé para acompanhamento interno.
function calcularHorasMinimas(worker, ano) {
  const anoInicio = new Date(`${ano}-01-01T00:00:00`);
  const anoFim = new Date(`${ano}-12-31T00:00:00`);
  const admissao = worker.dataInicio ? new Date(`${worker.dataInicio}T00:00:00`) : anoInicio;
  const cessacao = worker.dataFim ? new Date(`${worker.dataFim}T00:00:00`) : anoFim;

  const inicioVinculo = admissao > anoInicio ? admissao : anoInicio;
  const fimVinculo = cessacao < anoFim ? cessacao : anoFim;

  if (inicioVinculo > fimVinculo) return { horas: 0, dias: 0, diasNoAno: isBissexto(Number(ano)) ? 366 : 365 };

  const diasNoAno = isBissexto(Number(ano)) ? 366 : 365;
  const dias = Math.round((fimVinculo - inicioVinculo) / 86400000) + 1;
  const fracaoAno = dias / diasNoAno;
  const fracaoFTE = Math.min((Number(worker.horas_semanais) || 40) / 40, 1);
  const horas = 40 * fracaoAno * fracaoFTE;
  return { horas, dias, diasNoAno };
}

export default function RegistoIndividualTab() {
  const { supabase, companySignature } = useApp();
  const [workers, setWorkers] = useState([]);
  const [workerId, setWorkerId] = useState('');
  const [ano, setAno] = useState(String(ANO_ATUAL));
  const [worker, setWorker] = useState(null);
  const [formacoes, setFormacoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportando, setExportando] = useState(false);
  const [emitindoCertId, setEmitindoCertId] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('workers').select('id, name').order('name').then(({ data }) => setWorkers(data || []));
  }, [supabase]);

  useEffect(() => {
    if (!workerId || !supabase) { setWorker(null); setFormacoes([]); return; }
    setLoading(true);
    setError('');
    Promise.all([
      supabase.from('workers')
        .select('id, name, nif, profissao, dataInicio, dataFim, regime, horas_semanais')
        .eq('id', workerId)
        .single(),
      listFormacoes({ workerId, ano }),
    ])
      .then(([{ data: workerData, error: workerError }, formacoesRes]) => {
        if (workerError) throw new Error(workerError.message);
        setWorker(workerData);
        setFormacoes(formacoesRes.formacoes || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [workerId, ano, supabase]);

  const formacoesDoTrabalhador = useMemo(() => {
    return formacoes.map(f => {
      const participacao = (f.formacao_participantes || []).find(p => p.worker_id === workerId);
      return { formacao: f, participacao };
    }).filter(x => x.participacao)
      .sort((a, b) => new Date(a.formacao.data_inicio) - new Date(b.formacao.data_inicio));
  }, [formacoes, workerId]);

  const resumo = useMemo(() => {
    if (!worker) return null;
    const { horas: horasMinimas } = calcularHorasMinimas(worker, ano);
    const horasRealizadas = formacoesDoTrabalhador
      .filter(x => x.participacao.assinado_em)
      .reduce((acc, x) => acc + Number(x.formacao.duracao_horas || 0), 0);
    const anoEmCurso = Number(ano) === ANO_ATUAL;
    const cumprido = horasRealizadas >= horasMinimas;
    return { horasMinimas, horasRealizadas, anoEmCurso, cumprido };
  }, [worker, ano, formacoesDoTrabalhador]);

  const handleExportar = async () => {
    if (!worker || !resumo) return;
    setExportando(true);
    try {
      await exportRegistoIndividualPDF(worker, ano, formacoesDoTrabalhador, resumo, companySignature);
    } catch (e) {
      setError(e.message);
    }
    setExportando(false);
  };

  const emitirCertificado = async (formacao, participacao) => {
    setEmitindoCertId(participacao.id);
    setError('');
    try {
      await exportCertificadoPDF(formacao, participacao, companySignature);
    } catch (e) {
      setError(e.message);
    }
    setEmitindoCertId(null);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={workerId}
          onChange={e => setWorkerId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--ink-soft)]"
        >
          <option value="">— Selecionar trabalhador —</option>
          {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select
          value={ano}
          onChange={e => setAno(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--ink-soft)]"
        >
          {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {worker && (
          <button
            onClick={handleExportar}
            disabled={exportando}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-[var(--navy-solid)] bg-[var(--orange)] hover:bg-[var(--orange-hover)] transition-all disabled:opacity-50"
          >
            {exportando ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Exportar PDF
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl">{error}</div>}

      {!workerId ? (
        <p className="text-center py-10 text-[var(--slate-dim)] text-xs font-bold">Seleciona um trabalhador para gerar o registo individual.</p>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--slate-dim)]">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : !worker ? null : (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="p-4 rounded-2xl bg-white border border-[var(--border-soft)]">
              <div className="flex items-center gap-2 mb-3 text-[var(--slate-dim)]">
                <User size={14} />
                <p className="text-[10px] font-black uppercase tracking-widest">Trabalhador</p>
              </div>
              <p className="text-sm font-black text-[var(--ink)] mb-1">{worker.name}</p>
              <p className="text-xs text-[var(--slate-dim)]">NIF: {worker.nif || '—'}</p>
              <p className="text-xs text-[var(--slate-dim)]">Função: {worker.profissao || '—'}</p>
              <p className="text-xs text-[var(--slate-dim)]">Admissão: {fmtData(worker.dataInicio)}{worker.dataFim ? ` · Cessação: ${fmtData(worker.dataFim)}` : ''}</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[var(--border-soft)]">
              <div className="flex items-center gap-2 mb-3 text-[var(--slate-dim)]">
                <Clock size={14} />
                <p className="text-[10px] font-black uppercase tracking-widest">Art. 131.º CT — {ano}</p>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-2xl font-black text-[var(--ink)]">{resumo.horasRealizadas.toFixed(1)}h</p>
                <p className="text-xs font-bold text-[var(--slate-dim)]">de {resumo.horasMinimas.toFixed(1)}h mínimas (proporcional)</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                resumo.anoEmCurso ? 'bg-amber-50 text-amber-600' : resumo.cumprido ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                {resumo.anoEmCurso
                  ? <><Hourglass size={11} /> Em curso</>
                  : resumo.cumprido
                    ? <><CheckCircle2 size={11} /> Cumprido</>
                    : <><AlertTriangle size={11} /> Por cumprir</>}
              </span>
            </div>
          </div>

          {formacoesDoTrabalhador.length === 0 ? (
            <p className="text-center py-10 text-[var(--slate-dim)] text-xs font-bold">Sem formações registadas para {ano}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[9px] font-black uppercase tracking-widest text-[var(--slate-dim)] border-b border-[var(--border-soft)]">
                    <th className="py-2 pr-4">Data</th>
                    <th className="py-2 pr-4">Formação</th>
                    <th className="py-2 pr-4">Categoria</th>
                    <th className="py-2 pr-4">Formato</th>
                    <th className="py-2 pr-4">Duração</th>
                    <th className="py-2 pr-4">Assinado</th>
                  </tr>
                </thead>
                <tbody>
                  {formacoesDoTrabalhador.map(({ formacao: f, participacao: p }) => (
                    <tr key={f.id} className="border-b border-[var(--border-soft)]">
                      <td className="py-3 pr-4 text-[var(--slate-dim)] whitespace-nowrap">{fmtData(f.data_inicio)}</td>
                      <td className="py-3 pr-4 font-bold text-[var(--ink)]">{f.tipo_formacao || f.titulo}</td>
                      <td className="py-3 pr-4 text-[var(--slate-dim)] whitespace-nowrap">{CATEGORIA_LABEL[f.categoria] || f.categoria}</td>
                      <td className="py-3 pr-4 text-[var(--slate-dim)] whitespace-nowrap">{f.formato === 'e-learning' ? 'E-learning' : 'Presencial'}</td>
                      <td className="py-3 pr-4 text-[var(--slate-dim)] whitespace-nowrap">{f.duracao_horas}h</td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {p.assinado_em ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                              {fmtData(p.assinado_em)}
                            </span>
                            <button
                              onClick={() => emitirCertificado(f, p)}
                              disabled={emitindoCertId === p.id}
                              className="p-1.5 text-[var(--slate)] hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-50"
                              title="Emitir Certificado"
                            >
                              {emitindoCertId === p.id ? <Loader2 size={13} className="animate-spin" /> : <Award size={13} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--ink-soft)] bg-[var(--surface-dim)] px-2 py-1 rounded-lg">
                            Por assinar
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
