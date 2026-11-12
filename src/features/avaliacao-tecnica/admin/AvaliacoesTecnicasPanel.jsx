import { useCallback, useEffect, useState } from 'react';
import { Ban, Check, ClipboardCheck, Copy, FileText, LoaderCircle, MessageCircle, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';
import { FONT_TITLE, SCALE } from '../../../styles/designTokens';
import { CLASSIFICATION_LABELS, LEVEL_LABELS } from '../config.js';
import { LEVELS, maxDurationSec } from '../data/levels.js';
import { apagarAvaliacao, cancelarAvaliacao, criarAvaliacao, linkDaAvaliacao, listarAvaliacoes, reabrirAvaliacao } from '../api.js';

// Equipa › Avaliações — o admin gera um link único por candidato, escolhe o nível
// da prova, envia-o (copiar / WhatsApp) e consulta aqui o resultado e os dados que
// o candidato preencheu. A prova em si vive em /avaliacao/:token (AvaliacaoPublica).

const NIVEIS = ['meio-oficial', 'pleno', 'especialista'];

// Pares texto/fundo dos tokens --tone-*, pensados para texto sobre o próprio fundo
// nos dois modos (ver CLAUDE.md sobre os pares warn/warnBg que falham AA).
const TOM = {
  indigo: 'bg-[var(--tone-indigo-bg)] text-[var(--tone-indigo)]',
  amber: 'bg-[var(--tone-amber-bg)] text-[var(--tone-amber)]',
  emerald: 'bg-[var(--tone-emerald-bg)] text-[var(--tone-emerald)]',
  rose: 'bg-[var(--tone-rose-bg)] text-[var(--tone-rose)]',
  neutro: 'bg-[var(--surface-dim)] text-[var(--ink-soft)]',
};

const ESTADO = {
  pending: { label: 'Por iniciar', tom: 'indigo' },
  in_progress: { label: 'Em curso', tom: 'amber' },
  interrompida: { label: 'Interrompida', tom: 'rose' },
  completed: { label: 'Concluída', tom: 'emerald' },
  expired: { label: 'Expirada', tom: 'neutro' },
  cancelled: { label: 'Cancelada', tom: 'neutro' },
};

const CLASSIFICACAO_TOM = { apto: 'emerald', 'em-avaliacao': 'amber', 'nao-recomendado': 'rose' };

const VALIDADES = [3, 7, 14, 30];

const dataCurta = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

/** "Em curso" há mais tempo do que a prova pode durar = página fechada/recarregada a meio */
function estadoVisivel(a) {
  if (a.estado === 'in_progress' && a.started_at) {
    const limiteMs = (maxDurationSec(a.nivel) + 15 * 60) * 1000;
    if (Date.now() - new Date(a.started_at).getTime() > limiteMs) return 'interrompida';
  }
  return a.estado;
}

function linkWhatsApp(a) {
  let digitos = (a.candidato_telefone || '').replace(/\D/g, '');
  if (digitos.length === 9 && digitos.startsWith('9')) digitos = `351${digitos}`; // telemóvel PT sem indicativo
  const nome = (a.candidato_nome || '').split(' ')[0];
  const expira = new Date(a.expires_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
  const minutos = Math.ceil(maxDurationSec(a.nivel) / 60);
  const texto =
    `Olá${nome ? ` ${nome}` : ''}! A Magnetic Place convida-o(a) para a avaliação técnica de Caldeireiro Industrial ` +
    `(interpretação de plano, nível ${LEVEL_LABELS[a.nivel]}). Reserve cerca de ${minutos} minutos e faça a prova num tablet ` +
    `ou computador (no telemóvel/celular, com o ecrã na horizontal). O link é pessoal, só pode ser usado uma vez e é válido até ${expira}:\n` +
    linkDaAvaliacao(a.token);
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

function Chip({ tom, children }) {
  return (
    <span
      style={{ fontFamily: 'var(--mono)' }}
      className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 ${SCALE.text.badge} ${TOM[tom]}`}
    >
      {children}
    </span>
  );
}

function BotaoIcone({ title, onClick, href, children, perigo = false, disabled = false }) {
  const cls = `p-2 rounded-xl transition-all disabled:opacity-40 ${
    perigo
      ? 'text-[var(--tone-rose)] hover:bg-[var(--tone-rose-bg)]'
      : 'text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--surface-dim)]'
  }`;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" title={title} aria-label={title} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={cls} disabled={disabled}>
      {children}
    </button>
  );
}

function useCopiar() {
  const [copiado, setCopiado] = useState(null);
  const copiar = (chave, textoACopiar) => {
    navigator.clipboard
      .writeText(textoACopiar)
      .then(() => {
        setCopiado(chave);
        setTimeout(() => setCopiado(null), 2000);
      })
      .catch(() => window.prompt('Copia o link:', textoACopiar));
  };
  return [copiado, copiar];
}

export default function AvaliacoesTecnicasPanel() {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [confirmarApagar, setConfirmarApagar] = useState(null);
  const [copiado, copiar] = useCopiar();

  const carregar = useCallback(async () => {
    setACarregar(true);
    setErro('');
    try {
      setLista(await listarAvaliacoes());
    } catch (e) {
      setErro(e.message);
    } finally {
      setACarregar(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const substituir = (nova) => setLista((l) => l.map((a) => (a.id === nova.id ? nova : a)));

  const acao = async (id, fn) => {
    setOcupado(id);
    setErro('');
    try {
      await fn();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(null);
    }
  };

  const reabrir = (a) => acao(a.id, async () => substituir(await reabrirAvaliacao(a.id)));
  const cancelar = (a) => acao(a.id, async () => substituir(await cancelarAvaliacao(a.id)));
  const apagar = (a) => {
    if (confirmarApagar !== a.id) {
      setConfirmarApagar(a.id);
      setTimeout(() => setConfirmarApagar((c) => (c === a.id ? null : c)), 4000);
      return;
    }
    acao(a.id, async () => {
      await apagarAvaliacao(a.id);
      setLista((l) => l.filter((x) => x.id !== a.id));
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--tone-indigo-bg)] text-[var(--tone-indigo)] shrink-0">
            <ClipboardCheck size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-base text-[var(--ink)] uppercase tracking-tight" style={{ fontFamily: FONT_TITLE }}>
              Avaliações técnicas
            </h3>
            <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>Prova de interpretação de plano — Caldeireiro Industrial</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={carregar}
            className="p-2 text-[var(--slate)] hover:text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-xl transition-all"
            title="Atualizar"
            aria-label="Atualizar"
          >
            <RefreshCw size={16} className={aCarregar ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setNovaAberta(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--orange)] text-[var(--navy-solid)] rounded-xl hover:bg-[var(--orange-hover)] transition-all text-[11px] font-black uppercase tracking-widest"
          >
            <Plus size={14} /> Nova avaliação
          </button>
        </div>
      </div>

      {erro && <p className="mb-3 rounded-xl px-4 py-2.5 text-sm font-semibold bg-[var(--tone-rose-bg)] text-[var(--tone-rose)]">{erro}</p>}

      {lista === null ? (
        <div className="flex justify-center py-16">
          <LoaderCircle className="animate-spin text-[var(--slate)]" size={28} />
        </div>
      ) : lista.length === 0 ? (
        <div className="bg-[var(--panel)] rounded-2xl border border-[var(--border-soft)] shadow-sm p-10 text-center">
          <ClipboardCheck className="mx-auto mb-3 text-[var(--slate)]" size={32} />
          <p className="font-black text-[var(--ink-soft)] text-sm uppercase tracking-wide">Ainda não há avaliações</p>
          <p className="text-xs text-[var(--slate-dim)] mt-1">Cria um link em “Nova avaliação”, escolhe o nível e envia-o ao candidato.</p>
        </div>
      ) : (
        <div className="bg-[var(--panel)] rounded-2xl border border-[var(--border-soft)] shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)] bg-[var(--surface)]">
                {['Candidato', 'Nível', 'Estado', 'Resultado', 'Ações'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 ${SCALE.text.statLabel} text-[var(--slate-dim)] ${i === 4 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => {
                const estado = estadoVisivel(a);
                const e = ESTADO[estado] || ESTADO.pending;
                const busy = ocupado === a.id;
                return (
                  <tr key={a.id} className="border-b border-[var(--border-soft)] last:border-0 align-top">
                    <td className="px-4 py-3">
                      <p className="font-black text-[var(--ink)] text-sm">{a.candidato_nome || 'Sem nome'}</p>
                      <p className="text-xs text-[var(--slate-dim)]">
                        {[a.candidato_telefone, a.candidato_email].filter(Boolean).join(' · ') || '—'}
                      </p>
                      {(a.candidato_experiencia || a.vaga) && (
                        <p className="text-xs text-[var(--slate-dim)]">
                          {[a.candidato_experiencia && `Exp.: ${a.candidato_experiencia}`, a.vaga].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-bold text-[var(--ink-mid)]">{LEVEL_LABELS[a.nivel]}</p>
                      <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`} style={{ fontFamily: 'var(--mono)' }}>
                        variante {a.plan_variant}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Chip tom={e.tom}>{e.label}</Chip>
                      <p className="text-xs text-[var(--slate-dim)] mt-1">
                        {estado === 'completed'
                          ? `Concluída ${dataCurta(a.completed_at)}`
                          : estado === 'in_progress' || estado === 'interrompida'
                            ? `Iniciada ${dataCurta(a.started_at)}`
                            : estado === 'pending'
                              ? `Válido até ${dataCurta(a.expires_at)}`
                              : `Criada ${dataCurta(a.created_at)}`}
                      </p>
                      {a.reaberturas > 0 && <p className="text-xs text-[var(--slate-dim)]">Reaberta {a.reaberturas}×</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {a.estado === 'completed' ? (
                        <>
                          <p className="font-black text-lg text-[var(--ink)] leading-none" style={{ fontFamily: 'var(--mono)' }}>
                            {a.overall_score}
                            <span className="text-xs font-bold text-[var(--slate-dim)]">/100</span>
                          </p>
                          <div className="mt-1">
                            <Chip tom={CLASSIFICACAO_TOM[a.classification]}>{CLASSIFICATION_LABELS[a.classification]}</Chip>
                          </div>
                          {a.abandonada && <p className="text-xs text-[var(--tone-rose)] mt-1">Encerrada antes do fim</p>}
                        </>
                      ) : (
                        <span className="text-[var(--slate-dim)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        {busy && <LoaderCircle size={16} className="animate-spin text-[var(--slate)] mr-1" />}
                        {a.estado === 'completed' && (
                          <button
                            type="button"
                            onClick={() => setRelatorio(a)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--navy-solid)] text-white hover:opacity-90 transition-all ${SCALE.text.badge}`}
                          >
                            <FileText size={12} /> Relatório
                          </button>
                        )}
                        {a.estado === 'pending' && (
                          <>
                            <BotaoIcone title="Copiar link" onClick={() => copiar(a.id, linkDaAvaliacao(a.token))}>
                              {copiado === a.id ? <Check size={16} /> : <Copy size={16} />}
                            </BotaoIcone>
                            <BotaoIcone title="Enviar por WhatsApp" href={linkWhatsApp(a)}>
                              <MessageCircle size={16} />
                            </BotaoIcone>
                          </>
                        )}
                        {(a.estado === 'in_progress' || a.estado === 'expired') && (
                          <BotaoIcone
                            title={
                              a.estado === 'expired'
                                ? 'Reabrir (renova a validade por 7 dias)'
                                : 'Reabrir — só se o candidato confirmar que a prova foi interrompida (gera uma variante nova)'
                            }
                            onClick={() => reabrir(a)}
                            disabled={busy}
                          >
                            <RotateCcw size={16} />
                          </BotaoIcone>
                        )}
                        {(a.estado === 'pending' || a.estado === 'in_progress') && (
                          <BotaoIcone title="Cancelar link" onClick={() => cancelar(a)} disabled={busy}>
                            <Ban size={16} />
                          </BotaoIcone>
                        )}
                        {confirmarApagar === a.id ? (
                          <button
                            type="button"
                            onClick={() => apagar(a)}
                            disabled={busy}
                            className={`px-2.5 py-1.5 rounded-lg bg-[var(--tone-rose-bg)] text-[var(--tone-rose)] ${SCALE.text.badge}`}
                          >
                            Apagar?
                          </button>
                        ) : (
                          <BotaoIcone title="Apagar (dados e resultado)" onClick={() => apagar(a)} perigo disabled={busy}>
                            <Trash2 size={16} />
                          </BotaoIcone>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <NovaAvaliacaoModal
        isOpen={novaAberta}
        onClose={() => setNovaAberta(false)}
        onCriada={(nova) => setLista((l) => [nova, ...(l || [])])}
      />

      <ModalShell
        isOpen={!!relatorio}
        onClose={() => setRelatorio(null)}
        title={relatorio?.candidato_nome || 'Relatório'}
        subtitle="Relatório da avaliação técnica"
        meta={relatorio ? `${LEVEL_LABELS[relatorio.nivel]} · variante ${relatorio.plan_variant} · ${relatorio.overall_score}/100` : ''}
        icon={<FileText size={16} />}
        size="viewer"
      >
        {relatorio && (
          <iframe
            title="Relatório da avaliação técnica"
            src={`/avaliacao-relatorio/${relatorio.id}`}
            className="block w-full h-full min-h-[70vh] border-0 bg-white"
          />
        )}
      </ModalShell>
    </div>
  );
}

function NovaAvaliacaoModal({ isOpen, onClose, onCriada }) {
  const [form, setForm] = useState({ candidato_nome: '', candidato_telefone: '', nivel: '', vaga: '', validade_dias: 7 });
  const [criada, setCriada] = useState(null);
  const [aGerar, setAGerar] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, copiar] = useCopiar();

  const fechar = () => {
    setForm({ candidato_nome: '', candidato_telefone: '', nivel: '', vaga: '', validade_dias: 7 });
    setCriada(null);
    setErro('');
    onClose();
  };

  const gerar = async () => {
    if (!form.nivel) {
      setErro('Escolhe o nível da prova.');
      return;
    }
    setAGerar(true);
    setErro('');
    try {
      const nova = await criarAvaliacao(form);
      setCriada(nova);
      onCriada(nova);
    } catch (e) {
      setErro(e.message);
    } finally {
      setAGerar(false);
    }
  };

  const input =
    'w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg py-2 px-3 text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--orange)] transition-all placeholder:font-normal placeholder:text-[var(--slate-dim)]';
  const rotulo = `block ${SCALE.text.statLabel} text-[var(--slate-dim)] mb-1`;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={fechar}
      busy={aGerar}
      title={criada ? 'Link criado' : 'Nova avaliação técnica'}
      subtitle="Caldeireiro Industrial · interpretação de plano"
      icon={<ClipboardCheck size={16} />}
      accent="brand"
      size="lg"
    >
      <div className="p-6 space-y-4">
        {!criada ? (
          <div key="form" className="space-y-4">
            <p className="text-xs text-[var(--slate-dim)] font-medium leading-relaxed">
              Gera um link único para o candidato fazer a prova no tablet, computador ou telemóvel. Cada link tem uma variante do plano com
              medidas próprias e só pode ser usado uma vez. O resultado e os dados do candidato aparecem nesta lista.
            </p>

            <fieldset>
              <legend className={rotulo}>Nível da prova</legend>
              <div role="radiogroup" className="grid gap-2">
                {NIVEIS.map((n) => {
                  const l = LEVELS[n];
                  const ativo = form.nivel === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => setForm((f) => ({ ...f, nivel: n }))}
                      className={`flex items-center gap-3 text-left rounded-xl border-2 px-3 py-2.5 transition-all ${
                        ativo ? 'border-[var(--orange)] bg-[var(--surface)]' : 'border-[var(--border)] hover:border-[var(--slate)]'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-black text-[var(--ink)]">
                          {LEVEL_LABELS[n]}{' '}
                          <span className="font-semibold text-xs text-[var(--ink-soft)]">· prova {l.difficulty.toLowerCase()}</span>
                        </span>
                        <span
                          className="block text-[11px] leading-snug text-[var(--slate-dim)] mt-0.5"
                          style={{ fontFamily: 'var(--mono)' }}
                        >
                          {l.phase1.items.length} cotas · {l.phase2.questions.length} cálculos · {l.phase3.questions.length} símbolos · ~
                          {Math.ceil(maxDurationSec(n) / 60)} min
                        </span>
                      </span>
                      {ativo && <Check size={18} className="text-[var(--orange-deep)] shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {form.nivel && <p className="text-xs text-[var(--ink-soft)] mt-2 leading-relaxed">{LEVELS[form.nivel].summary}</p>}
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={rotulo} htmlFor="av-nome">
                  Nome (opcional)
                </label>
                <input
                  id="av-nome"
                  className={input}
                  placeholder="Ana Silva"
                  value={form.candidato_nome}
                  onChange={(e) => setForm((f) => ({ ...f, candidato_nome: e.target.value }))}
                />
              </div>
              <div>
                <label className={rotulo} htmlFor="av-tel">
                  Telemóvel (opcional)
                </label>
                <input
                  id="av-tel"
                  type="tel"
                  className={input}
                  placeholder="+351912345678"
                  value={form.candidato_telefone}
                  onChange={(e) => setForm((f) => ({ ...f, candidato_telefone: e.target.value }))}
                />
              </div>
              <div>
                <label className={rotulo} htmlFor="av-vaga">
                  Vaga / obra (opcional)
                </label>
                <input
                  id="av-vaga"
                  className={input}
                  placeholder="Ex.: Ferrocal — Bilbau"
                  value={form.vaga}
                  onChange={(e) => setForm((f) => ({ ...f, vaga: e.target.value }))}
                />
              </div>
              <div>
                <label className={rotulo} htmlFor="av-validade">
                  Validade do link
                </label>
                <select
                  id="av-validade"
                  className={input}
                  value={form.validade_dias}
                  onChange={(e) => setForm((f) => ({ ...f, validade_dias: Number(e.target.value) }))}
                >
                  {VALIDADES.map((d) => (
                    <option key={d} value={d}>
                      {d} dias
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {erro && <p className="rounded-xl px-3 py-2 text-sm font-semibold bg-[var(--tone-rose-bg)] text-[var(--tone-rose)]">{erro}</p>}

            <button
              type="button"
              onClick={gerar}
              disabled={aGerar}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--orange)] text-[var(--navy-solid)] rounded-xl hover:bg-[var(--orange-hover)] transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50"
            >
              {aGerar ? <LoaderCircle size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
              Gerar link
            </button>
          </div>
        ) : (
          <div key="criada" className="space-y-4">
            <p className="text-sm text-[var(--ink-mid)]">
              Prova <strong>{LEVEL_LABELS[criada.nivel]}</strong> para <strong>{criada.candidato_nome || 'o candidato'}</strong>, variante{' '}
              <span style={{ fontFamily: 'var(--mono)' }}>{criada.plan_variant}</span>. Válido até {dataCurta(criada.expires_at)}.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={linkDaAvaliacao(criada.token)}
                onFocus={(e) => e.target.select()}
                className={`${input} font-mono text-xs`}
                aria-label="Link da avaliação"
              />
              <button
                type="button"
                onClick={() => copiar('novo', linkDaAvaliacao(criada.token))}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--navy-solid)] text-white text-xs font-black uppercase tracking-wide"
              >
                {copiado === 'novo' ? <Check size={14} /> : <Copy size={14} />} {copiado === 'novo' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <a
              href={linkWhatsApp(criada)}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--tone-emerald-bg)] text-[var(--tone-emerald)] text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all"
            >
              <MessageCircle size={14} /> Enviar por WhatsApp
            </a>
            {!criada.candidato_telefone && (
              <p className="text-xs text-[var(--slate-dim)]">Sem telemóvel indicado: o WhatsApp abre para escolheres o contacto.</p>
            )}
            <button
              type="button"
              onClick={fechar}
              className="w-full py-2.5 rounded-xl border border-[var(--border)] text-[var(--ink-soft)] text-xs font-black uppercase tracking-widest hover:bg-[var(--surface)] transition-all"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
