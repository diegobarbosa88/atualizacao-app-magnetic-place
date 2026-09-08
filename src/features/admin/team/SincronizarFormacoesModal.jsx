import React, { useEffect, useState } from 'react';
import { GraduationCap, Loader2, CheckCircle2 } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';
import { formacoesPendentes, autoAtribuirPorProfissao } from '../formacao-interna/formacaoApi';
import { SCALE, FT } from '../../../styles/designTokens';

// Trabalhador antigo que nunca passou pelo auto-atribuir (ver
// TeamContext.jsx/OnboardingPendentes.jsx) — este modal lista o que falta
// e deixa o admin escolher, por formação, a data em que foi de facto
// realizada (para entrar já concluída, não "por fazer"). Deixar a data em
// branco mantém o comportamento antigo (fica não iniciada). Pedido do
// Diego, 2026-09-08.
export default function SincronizarFormacoesModal({ worker, onClose }) {
  const [loading, setLoading] = useState(true);
  const [pendentes, setPendentes] = useState([]);
  const [datas, setDatas] = useState({}); // { formacao_id: 'YYYY-MM-DD' }
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    if (!worker) return;
    setLoading(true);
    setError('');
    setResultado(null);
    setDatas({});
    formacoesPendentes(worker.id, worker.profissao_cnp)
      .then((r) => { if (r.error) throw new Error(r.error); setPendentes(r.pendentes || []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [worker]);

  const handleConfirmar = async () => {
    setSaving(true);
    setError('');
    try {
      const datasConclusao = Object.fromEntries(Object.entries(datas).filter(([, v]) => v));
      const r = await autoAtribuirPorProfissao(worker.id, worker.profissao_cnp, datasConclusao);
      if (r.error) throw new Error(r.error);
      setResultado(r);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  if (!worker) return null;

  return (
    <ModalShell isOpen onClose={onClose} title="Sincronizar Formações" meta={worker.name} icon={<GraduationCap size={18} />} size="sm" layer="nested">
      <div className="p-5 space-y-3">
        {loading ? (
          <div className="py-8 text-center opacity-40"><Loader2 className="animate-spin mx-auto" size={22} /></div>
        ) : resultado ? (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-3">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <p className={`${SCALE.text.body} text-emerald-700 font-bold`}>
              {resultado.atribuidas > 0 ? `${resultado.atribuidas} formação(ões) atribuída(s) a ${worker.name}.` : 'Nada por atribuir.'}
            </p>
          </div>
        ) : pendentes.length === 0 ? (
          <p className={`${SCALE.text.body} text-[var(--slate-dim)]`}>{worker.name} já tem todas as formações obrigatórias atribuídas.</p>
        ) : (
          <>
            <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>
              Se já foram feitas antes (trabalhador antigo), escolhe a data — ficam logo concluídas. Deixa em branco para ficarem por fazer.
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
          </>
        )}

        {error && <p className="text-xs text-red-600 font-bold bg-red-50 rounded-lg p-2">{error}</p>}

        {!resultado && !loading && pendentes.length > 0 && (
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
