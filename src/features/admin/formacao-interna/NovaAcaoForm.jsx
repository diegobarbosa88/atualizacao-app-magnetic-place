import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Check, Plus, Trash2, FileText } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { createFormacao } from './formacaoApi';
import {
  CATEGORIAS, TIPOS_POR_CATEGORIA, CAMPOS_POR_TIPO,
  CATEGORIAS_ENTIDADE_EXTERNA, CATEGORIAS_EXIGEM_VALIDADE, VALIDADE_PADRAO_MESES,
} from './formacaoTemplates';

const CAMPO = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300';
const CAMPO_DISABLED = 'w-full px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-400';
const LABEL = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5';

const INICIAL = {
  categoria: 'soldadura', tipo_formacao: '', data_inicio: '', data_fim: '', duracao_horas: '',
  local: '', formador_id: '', entidade_externa: '',
  objetivos: '', conteudo_programatico: '', justificativa_afinidade: '',
  metodo_avaliacao: '', resultado_avaliacao: '', evidencias_url: '',
  formato: 'presencial', conteudo_url: '', nota_minima_aprovacao: '70',
};

const PERGUNTA_INICIAL = () => ({ pergunta: '', opcoes: ['', ''], resposta_correta: 0 });

export default function NovaAcaoForm({ onCriada }) {
  const { supabase } = useApp();
  const [workers, setWorkers] = useState([]);
  const [form, setForm] = useState(INICIAL);
  const [participantes, setParticipantes] = useState({}); // { [workerId]: { selecionado, data_validade } }
  const [questionario, setQuestionario] = useState([PERGUNTA_INICIAL()]);
  const [conteudoEstruturado, setConteudoEstruturado] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.from('workers').select('id, name').order('name').then(({ data }) => setWorkers(data || []));
  }, [supabase]);

  const exigeEntidadeExterna = CATEGORIAS_ENTIDADE_EXTERNA.includes(form.categoria);
  const exigeValidade = CATEGORIAS_EXIGEM_VALIDADE.includes(form.categoria);
  const formadorDesabilitado = form.categoria === 'gwo';
  const validadeMesesDefault = VALIDADE_PADRAO_MESES[form.categoria];
  const tiposSugeridos = TIPOS_POR_CATEGORIA[form.categoria] || [];

  const setField = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const setCategoria = (categoria) => {
    setForm(f => ({
      ...f,
      categoria,
      tipo_formacao: '',
      formador_id: categoria === 'gwo' ? '' : f.formador_id,
      entidade_externa: CATEGORIAS_ENTIDADE_EXTERNA.includes(categoria) ? f.entidade_externa : '',
    }));
    setConteudoEstruturado(null);
  };

  // Quando o tipo escolhido corresponde exatamente a um dos predefinidos,
  // preenche automaticamente todos os campos exceto as datas (data_inicio,
  // data_fim, data_validade continuam sempre manuais).
  const setTipoFormacao = (e) => {
    const tipo_formacao = e.target.value;
    const template = CAMPOS_POR_TIPO[tipo_formacao];
    setForm(f => ({
      ...f,
      tipo_formacao,
      ...(template ? {
        duracao_horas: String(template.duracao_horas),
        objetivos: template.objetivos,
        conteudo_programatico: template.conteudo_programatico,
        justificativa_afinidade: template.justificativa_afinidade,
        metodo_avaliacao: template.metodo_avaliacao,
      } : {}),
    }));
    setConteudoEstruturado(template?.conteudo_estruturado || null);
  };

  const toggleParticipante = (id) => {
    setParticipantes(prev => {
      const atual = prev[id];
      if (atual?.selecionado) {
        const { [id]: _omit, ...resto } = prev;
        return resto;
      }
      return { ...prev, [id]: { selecionado: true, data_validade: '' } };
    });
  };

  const setValidadeParticipante = (id, data_validade) => {
    setParticipantes(prev => ({ ...prev, [id]: { ...prev[id], data_validade } }));
  };

  const selecionadosIds = useMemo(() => Object.keys(participantes), [participantes]);
  const isElearning = form.formato === 'e-learning';

  const addPergunta = () => setQuestionario(qs => [...qs, PERGUNTA_INICIAL()]);
  const removePergunta = (idx) => setQuestionario(qs => qs.filter((_, i) => i !== idx));
  const setPergunta = (idx, pergunta) => setQuestionario(qs => qs.map((q, i) => i === idx ? { ...q, pergunta } : q));
  const addOpcao = (idx) => setQuestionario(qs => qs.map((q, i) => i === idx ? { ...q, opcoes: [...q.opcoes, ''] } : q));
  const removeOpcao = (idx, oIdx) => setQuestionario(qs => qs.map((q, i) => {
    if (i !== idx) return q;
    const opcoes = q.opcoes.filter((_, j) => j !== oIdx);
    return { ...q, opcoes, resposta_correta: q.resposta_correta >= opcoes.length ? 0 : q.resposta_correta };
  }));
  const setOpcao = (idx, oIdx, valor) => setQuestionario(qs => qs.map((q, i) => (
    i === idx ? { ...q, opcoes: q.opcoes.map((o, j) => j === oIdx ? valor : o) } : q
  )));
  const setRespostaCorreta = (idx, oIdx) => setQuestionario(qs => qs.map((q, i) => i === idx ? { ...q, resposta_correta: oIdx } : q));

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (selecionadosIds.length === 0) {
      setError('Selecione pelo menos um participante.');
      return;
    }
    if (exigeEntidadeExterna && !form.entidade_externa.trim()) {
      setError('Esta categoria exige o nome da entidade externa certificadora.');
      return;
    }
    if (form.categoria === 'certificacao_formal' && selecionadosIds.some(id => !participantes[id].data_validade)) {
      setError('Esta categoria exige data de validade para todos os participantes.');
      return;
    }
    if (isElearning) {
      if (!form.conteudo_url.trim() && !conteudoEstruturado) {
        setError('Formação e-learning exige o link do conteúdo (vídeo ou PDF) ou um conteúdo estruturado pré-definido.');
        return;
      }
      const perguntasValidas = questionario.every(q => q.pergunta.trim() && q.opcoes.every(o => o.trim()) && q.opcoes.length >= 2);
      if (questionario.length === 0 || !perguntasValidas) {
        setError('Preenche todas as perguntas e opções do questionário.');
        return;
      }
      if (!(Number(form.nota_minima_aprovacao) > 0) || Number(form.nota_minima_aprovacao) > 100) {
        setError('Nota mínima de aprovação deve ser entre 1 e 100.');
        return;
      }
    }

    setBusy(true);
    try {
      await createFormacao({
        ...form,
        questionario: isElearning ? questionario : undefined,
        conteudo_estruturado: isElearning ? conteudoEstruturado : undefined,
        participantes: selecionadosIds.map(id => ({ worker_id: id, data_validade: participantes[id].data_validade || null })),
      });
      setForm(INICIAL);
      setParticipantes({});
      setQuestionario([PERGUNTA_INICIAL()]);
      setConteudoEstruturado(null);
      onCriada?.();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <div className="p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Categoria</label>
          <select className={CAMPO} value={form.categoria} onChange={e => setCategoria(e.target.value)}>
            {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Tipo de Formação</label>
          <input
            required
            list="tipos-formacao-sugeridos"
            className={CAMPO}
            value={form.tipo_formacao}
            onChange={setTipoFormacao}
            placeholder="Escrever ou escolher da lista"
          />
          <datalist id="tipos-formacao-sugeridos">
            {tiposSugeridos.map(t => <option key={t} value={t} />)}
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={LABEL}>Data de Início</label>
          <input required type="date" className={CAMPO} value={form.data_inicio} onChange={setField('data_inicio')} />
        </div>
        <div>
          <label className={LABEL}>Data de Fim</label>
          <input required type="date" className={CAMPO} value={form.data_fim} onChange={setField('data_fim')} />
        </div>
        <div>
          <label className={LABEL}>Duração (horas)</label>
          <input required type="number" min="0.5" step="0.5" className={CAMPO} value={form.duracao_horas} onChange={setField('duracao_horas')} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Local</label>
          <input className={CAMPO} value={form.local} onChange={setField('local')} placeholder="Ex: Sede Magnetic Place" />
        </div>
        <div>
          <label className={LABEL}>Formador {formadorDesabilitado && '(N/A — entidade externa)'}</label>
          <select
            className={formadorDesabilitado ? CAMPO_DISABLED : CAMPO}
            value={formadorDesabilitado ? '' : form.formador_id}
            onChange={setField('formador_id')}
            disabled={formadorDesabilitado}
          >
            <option value="">— Selecionar —</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      {exigeEntidadeExterna && (
        <div>
          <label className={LABEL}>Entidade Externa Certificadora</label>
          <input
            required
            className={CAMPO}
            value={form.entidade_externa}
            onChange={setField('entidade_externa')}
            placeholder="Ex: entidade certificadora ou parceiro formativo"
          />
        </div>
      )}

      <div>
        <label className={LABEL}>Objetivos</label>
        <textarea rows={2} className={CAMPO} value={form.objetivos} onChange={setField('objetivos')} />
      </div>

      <div>
        <label className={LABEL}>Conteúdo Programático</label>
        <textarea rows={3} className={CAMPO} value={form.conteudo_programatico} onChange={setField('conteudo_programatico')} />
      </div>

      <div>
        <label className={LABEL}>Justificativa de Afinidade com a Função</label>
        <textarea rows={2} className={CAMPO} value={form.justificativa_afinidade} onChange={setField('justificativa_afinidade')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Método de Avaliação</label>
          <input className={CAMPO} value={form.metodo_avaliacao} onChange={setField('metodo_avaliacao')} placeholder="Ex: Teste escrito, avaliação prática" />
        </div>
        <div>
          <label className={LABEL}>Resultado da Avaliação</label>
          <input className={CAMPO} value={form.resultado_avaliacao} onChange={setField('resultado_avaliacao')} />
        </div>
      </div>

      <div>
        <label className={LABEL}>Evidências (link)</label>
        <input className={CAMPO} value={form.evidencias_url} onChange={setField('evidencias_url')} placeholder="Link para fotos, materiais, etc." />
      </div>

      <div>
        <label className={LABEL}>Formato</label>
        <select className={CAMPO} value={form.formato} onChange={setField('formato')}>
          <option value="presencial">Presencial</option>
          <option value="e-learning">E-learning</option>
        </select>
        <p className="text-[10px] font-bold text-slate-400 mt-1.5">
          {isElearning
            ? 'O trabalhador vê o conteúdo, responde ao questionário e só depois de aprovado assina.'
            : 'Fluxo atual — o trabalhador assina diretamente a partir do dashboard.'}
        </p>
      </div>

      {isElearning && (
        <div className="space-y-4 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Link do Conteúdo (vídeo ou PDF, opcional)</label>
              <input className={CAMPO} value={form.conteudo_url} onChange={setField('conteudo_url')} placeholder="https://... (opcional se já houver conteúdo estruturado)" />
              {conteudoEstruturado && (
                <p className="text-[10px] font-bold text-indigo-500 mt-1.5 flex items-center gap-1">
                  <FileText size={11} /> Conteúdo estruturado pré-preenchido a partir do modelo — o trabalhador vê-o diretamente na app.
                </p>
              )}
            </div>
            <div>
              <label className={LABEL}>Nota Mínima de Aprovação (%)</label>
              <input required={isElearning} type="number" min="1" max="100" className={CAMPO} value={form.nota_minima_aprovacao} onChange={setField('nota_minima_aprovacao')} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Questionário</label>
            <div className="space-y-3">
              {questionario.map((q, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-white border border-slate-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      className={`${CAMPO} flex-1`}
                      value={q.pergunta}
                      onChange={e => setPergunta(idx, e.target.value)}
                      placeholder={`Pergunta ${idx + 1}`}
                    />
                    {questionario.length > 1 && (
                      <button type="button" onClick={() => removePergunta(idx)} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shrink-0">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 pl-2">
                    {q.opcoes.map((op, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`resposta-correta-${idx}`}
                          checked={q.resposta_correta === oIdx}
                          onChange={() => setRespostaCorreta(idx, oIdx)}
                          title="Marcar como resposta correta"
                        />
                        <input
                          className={`${CAMPO} flex-1 py-1.5`}
                          value={op}
                          onChange={e => setOpcao(idx, oIdx, e.target.value)}
                          placeholder={`Opção ${oIdx + 1}`}
                        />
                        {q.opcoes.length > 2 && (
                          <button type="button" onClick={() => removeOpcao(idx, oIdx)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-all shrink-0">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => addOpcao(idx)} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700 mt-1">
                      <Plus size={11} /> Opção
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addPergunta}
              className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
            >
              <Plus size={12} /> Adicionar Pergunta
            </button>
          </div>
        </div>
      )}

      <div>
        <label className={LABEL}>Participantes</label>
        <div className="border border-slate-100 rounded-2xl divide-y divide-slate-50">
          {workers.map(w => {
            const sel = participantes[w.id];
            return (
              <div key={w.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 transition-all">
                <button
                  type="button"
                  onClick={() => toggleParticipante(w.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <span className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${sel?.selecionado ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                    {sel?.selecionado && <Check size={12} />}
                  </span>
                  <span className="text-xs font-bold text-slate-700 truncate">{w.name}</span>
                </button>
                {sel?.selecionado && exigeValidade && (
                  <input
                    type="date"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 shrink-0"
                    value={sel.data_validade}
                    onChange={e => setValidadeParticipante(w.id, e.target.value)}
                    placeholder={validadeMesesDefault ? `Auto (+${validadeMesesDefault}m)` : 'Data de validade'}
                    required={form.categoria === 'certificacao_formal'}
                  />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] font-bold text-slate-400 mt-1.5">
          {selecionadosIds.length} selecionado{selecionadosIds.length !== 1 ? 's' : ''}
          {exigeValidade && validadeMesesDefault ? ` — data de validade em branco assume automaticamente +${validadeMesesDefault} meses.` : ''}
        </p>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Registar Ação
      </button>
    </form>
  );
}
