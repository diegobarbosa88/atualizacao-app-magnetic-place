import React, { useEffect, useState } from 'react';
import { GraduationCap, Loader2, CheckCircle2, X } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';
import { formacoesPendentes, autoAtribuirPorProfissao, removerParticipante } from '../formacao-interna/formacaoApi';
import { SCALE, FT } from '../../../styles/designTokens';

// Trabalhador antigo que nunca passou pelo auto-atribuir (ver
// TeamContext.jsx/OnboardingPendentes.jsx) — este modal lista o que falta
// e deixa o admin escolher, por formação, a data em que foi de facto
// realizada (para entrar já concluída, não "por fazer"). Deixar a data em
// branco mantém o comportamento antigo (fica não iniciada). Pedido do
// Diego, 2026-09-08.
//
// Ganhou também a secção "Já atribuídas" no mesmo dia — pedido explícito:
// "excluir formações assinadas, deixar possível atribuir outra vez". Remover
// um participante liberta a formação para reatribuir (via este mesmo modal,
// escolhendo a data certa desta vez, ou pelo fluxo normal do trabalhador).
export default function SincronizarFormacoesModal({ worker, onClose }) {
  const [loading, setLoading] = useState(true);
  const [pendentes, setPendentes] = useState([]);
  const [atribuidas, setAtribuidas] = useState([]);
  const [datas, setDatas] = useState({}); // { formacao_id: 'YYYY-MM-DD' }
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [removendoId, setRemovendoId] = useState(null); // participante_id
  const [confirmRemoverId, setConfirmRemoverId] = useState(null); // participante_id

  const carregar = () => {
    if (!worker) return;
    setLoading(true);
    setError('');
    formacoesPendentes(worker.id, worker.profissao_cnp)
      .then((r) => {
        if (r.error) throw new Error(r.error);
        setPendentes(r.pendentes || []);
        setAtribuidas(r.atribuidas || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!worker) return;
    setResultado(null);
    setDatas({});
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker]);

  const handleConfirmar = async () => {
    setSaving(true);
    setError('');
    try {
      const datasConclusao = Object.fromEntries(Object.entries(datas).filter(([, v]) => v));
      const r = await autoAtribuirPorProfissao(worker.id, worker.profissao_cnp, datasConclusao);
      if (r.error) throw new Error(r.error);
      setResultado(r);
      carregar();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleRemover = async (participanteId) => {
    setRemovendoId(participanteId);
    setError('');
    try {
      const r = await removerParticipante(participanteId);
      if (r.error) throw new Error(r.error);
      setConfirmRemoverId(null);
      carregar();
    } catch (e) {
      setError(e.message);
    }
    setRemovendoId(null);
  };

  if (!worker) return null;

  const fmtData = (d) => d ? new Date(d).toLocaleDateString('pt-PT') : null;

  return (
    <ModalShell isOpen onClose={onClose} title="Sincronizar Formações" meta={worker.name} icon={<GraduationCap size={18} />} size="sm" layer="nested">
      <div className="p-5 space-y-4">
        {loading ? (
          <div className="py-8 text-center opacity-40"><Loader2 className="animate-spin mx-auto" size={22} /></div>
        ) : (
          <>
            {resultado && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-3">
                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                <p className={`${SCALE.text.body} text-emerald-700 font-bold`}>
                  {resultado.atribuidas > 0 ? `${resultado.atribuidas} formação(ões) atribuída(s) a ${worker.name}.` : 'Nada por atribuir.'}
                </p>
              </div>
            )}

            {pendentes.length === 0 && atribuidas.length === 0 && (
              <p className={`${SCALE.text.body} text-[var(--slate-dim)]`}>{worker.name} não tem formações obrigatórias definidas.</p>
            )}

            {pendentes.length > 0 && (
              <div className="space-y-2">
                <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>
                  Por atribuir — se já foram feitas antes (trabalhador antigo), escolhe a data para entrarem já concluídas. Deixa em branco para ficarem por fazer.
                </p>
                <div className="space-y-2.5">
                  {pendentes.map((p) => (
                    <div key={p.formacao_id} className="flex items-center justify-between gap-3">
                      <span className={`${SCALE.text.body} text-[var(--ink-mid)] truncate`}>{p.titulo}</span>
                      <input
                        type="date"
                        value={datas[p.formacao_id] || ''}
                        onChange={(e) => setDatas((prev) => ({ ...prev, [p.formacao_id]: e.target.value }))}
                        className="w-36 p-1.5 rounded-lg border border-[var(--border)] text-xs shrink-0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {atribuidas.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-[var(--border-soft)]">
                <p className={`${SCALE.text.meta} text-[var(--slate-dim)] pt-2`}>
                  Já atribuídas — remove para poder atribuir outra vez (ex. corrigir uma data errada).
                </p>
                <div className="space-y-1.5">
                  {atribuidas.map((p) => (
                    <div key={p.participante_id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`${SCALE.text.body} text-[var(--ink-mid)] truncate`}>{p.titulo}</p>
                        <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>
                          {p.estado_conclusao === 'concluido' ? `Concluída${fmtData(p.concluido_em) ? ` em ${fmtData(p.concluido_em)}` : ''}` : 'Por fazer'}
                        </p>
                      </div>
                      {confirmRemoverId === p.participante_id ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleRemover(p.participante_id)} disabled={removendoId === p.participante_id} className="px-2 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50" style={{ fontSize: '10px', fontWeight: 700 }}>
                            {removendoId === p.participante_id ? <Loader2 size={11} className="animate-spin" /> : 'Sim'}
                          </button>
                          <button onClick={() => setConfirmRemoverId(null)} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg" style={{ fontSize: '10px', fontWeight: 700 }}>Não</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmRemoverId(p.participante_id)} title="Remover — permite atribuir outra vez" className="p-1.5 rounded-lg text-[var(--bad)] hover:bg-[var(--bad-bg)] transition-colors shrink-0">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {error && <p className="text-xs text-red-600 font-bold bg-red-50 rounded-lg p-2">{error}</p>}

        {!loading && pendentes.length > 0 && (
          <button
            onClick={handleConfirmar}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase disabled:opacity-50"
            style={{ backgroundColor: FT.orange, color: FT.navy }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />} Confirmar
          </button>
        )}
      </div>
    </ModalShell>
  );
}
