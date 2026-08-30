import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, ChevronDown, ChevronUp, Check, GraduationCap } from 'lucide-react';
import { listFormacoes, listRequisitosProfissao, setRequisitoProfissao } from './formacaoApi';
import { PROFISSOES_EMPRESA, GRUPOS_PROFISSOES } from '../../../data/profissoesEmpresa';
import { SCALE } from '../../../styles/designTokens';

// Configura, por profissão, quais ações e-learning são atribuídas
// automaticamente a um trabalhador novo assim que é criado com essa
// profissão (ver TeamContext.jsx handleSaveWorker + api/formacao/index.js
// ação "auto-atribuir"). Só cobre e-learning — formações presenciais
// continuam a ser sempre atribuídas manualmente.
export default function RequisitosProfissaoTab() {
  const [acoesElearning, setAcoesElearning] = useState([]);
  const [requisitos, setRequisitos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandidoCnp, setExpandidoCnp] = useState(null);
  const [gravandoChave, setGravandoChave] = useState(null);

  const carregar = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ formacoes }, { requisitos: reqs }] = await Promise.all([
        listFormacoes({ formato: 'e-learning' }),
        listRequisitosProfissao(),
      ]);
      setAcoesElearning(formacoes || []);
      setRequisitos(reqs || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const requisitosPorProfissao = useMemo(() => {
    const mapa = new Map();
    for (const r of requisitos) {
      if (!r.ativo) continue;
      if (!mapa.has(r.profissao_cnp)) mapa.set(r.profissao_cnp, new Set());
      mapa.get(r.profissao_cnp).add(r.formacao_id);
    }
    return mapa;
  }, [requisitos]);

  const toggleRequisito = async (profissaoCnp, formacaoId, ativoAtual) => {
    const chave = `${profissaoCnp}::${formacaoId}`;
    setGravandoChave(chave);
    setError('');
    const novoAtivo = !ativoAtual;
    // Otimista: atualiza local antes da resposta, revertendo se falhar.
    setRequisitos(prev => {
      const semEsta = prev.filter(r => !(r.profissao_cnp === profissaoCnp && r.formacao_id === formacaoId));
      return [...semEsta, { profissao_cnp: profissaoCnp, formacao_id: formacaoId, ativo: novoAtivo }];
    });
    try {
      await setRequisitoProfissao(profissaoCnp, formacaoId, novoAtivo);
    } catch (e) {
      setError(e.message);
      await carregar();
    }
    setGravandoChave(null);
  };

  return (
    <div>
      <p className={`${SCALE.text.body} text-[var(--slate-dim)] mb-5`}>
        Marca quais ações e-learning são atribuídas automaticamente a um trabalhador novo, consoante
        a profissão escolhida na ficha dele. Formações presenciais continuam sempre manuais.
      </p>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--slate-dim)]">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : acoesElearning.length === 0 ? (
        <p className="text-center py-10 text-[var(--slate-dim)] text-xs font-bold">
          Ainda não existe nenhuma ação e-learning — cria uma primeiro na aba "E-learning".
        </p>
      ) : (
        <div className="space-y-5">
          {GRUPOS_PROFISSOES.map(grupo => (
            <div key={grupo}>
              <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-2`}>{grupo}</p>
              <div className="border border-[var(--border-soft)] rounded-2xl divide-y divide-[var(--border-soft)] overflow-hidden">
                {PROFISSOES_EMPRESA.filter(p => p.grupo === grupo).map(profissao => {
                  const selecionadas = requisitosPorProfissao.get(profissao.codigoCPP) || new Set();
                  const isOpen = expandidoCnp === profissao.codigoCPP;
                  return (
                    <div key={profissao.codigoCPP}>
                      <button
                        type="button"
                        onClick={() => setExpandidoCnp(isOpen ? null : profissao.codigoCPP)}
                        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-[var(--surface)] transition-all"
                      >
                        <span className="text-xs font-bold text-[var(--ink-mid)]">{profissao.rotulo}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          {selecionadas.size > 0 && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${SCALE.text.badge} bg-indigo-50 text-indigo-600`}>
                              <GraduationCap size={10} /> {selecionadas.size}
                            </span>
                          )}
                          {isOpen ? <ChevronUp size={14} className="text-[var(--slate)]" /> : <ChevronDown size={14} className="text-[var(--slate)]" />}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-3 space-y-1.5 bg-[var(--surface)]">
                          {acoesElearning.map(acao => {
                            const ativo = selecionadas.has(acao.id);
                            const chave = `${profissao.codigoCPP}::${acao.id}`;
                            const gravando = gravandoChave === chave;
                            return (
                              <button
                                key={acao.id}
                                type="button"
                                disabled={gravando}
                                onClick={() => toggleRequisito(profissao.codigoCPP, acao.id, ativo)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[var(--border-soft)] hover:bg-[var(--surface-dim)] transition-all disabled:opacity-50 text-left"
                              >
                                <span className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${ativo ? 'bg-indigo-600 text-white' : 'bg-[var(--surface-dim)]'}`}>
                                  {gravando ? <Loader2 size={11} className="animate-spin" /> : (ativo && <Check size={12} />)}
                                </span>
                                <span className="text-xs font-bold text-[var(--ink-mid)] truncate">{acao.tipo_formacao || acao.titulo}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
