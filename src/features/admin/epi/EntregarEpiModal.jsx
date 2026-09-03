import React, { useState, useEffect } from 'react';
import { PackageCheck, AlertTriangle, Loader2, Check } from 'lucide-react';
import { SCALE, FT } from '../../../styles/designTokens';
import ModalShell from '../../../components/common/ModalShell';
import SignDrawModal from '../../../components/worker/SignDrawModal';
import { EpiIcon } from '../../../utils/epiIcons';
import { isBaseEligible, getStock } from '../../../utils/epiHelpers';
import { newEpiRequestId, notifyWorkerEpiDelivered } from '../../../utils/epiRequestsApi';

// Kit de entrada = itens do Termo de Responsabilidade (epi_catalogo_documento,
// já assinado no onboarding) atribuídos à profissão do trabalhador, cada um
// resolvido ao(s) epi_types elegível(eis) via epi_type_ids — o link criado
// na migração epi_catalogo_documento_type_link. Um item do documento sem
// nenhum epi_types elegível fica informativo (mostra na mesma, mas não é
// entregável) em vez de desaparecer em silêncio — o admin precisa de saber
// que falta ligar ou criar o SKU correspondente.
function buildKitRows(worker, catalogoDocumento, types) {
  if (!worker) return [];
  return (catalogoDocumento || [])
    .filter((d) => (d.profissoes || []).includes(worker.profissao))
    .map((d) => {
      const candidates = (d.epi_type_ids || [])
        .map((id) => types.find((t) => t.id === id))
        .filter((t) => t && isBaseEligible(t, worker));
      return { docKey: d.key, docNome: d.nome, candidates };
    });
}

export default function EntregarEpiModal({ open, onClose, worker, types, catalogoDocumento, currentUser, supabase, onChange }) {
  const [rows, setRows] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [signing, setSigning] = useState(false);

  const kit = buildKitRows(worker, catalogoDocumento, types);

  useEffect(() => {
    if (!open || !worker) return;
    const init = {};
    kit.forEach(({ docKey, candidates }) => {
      if (!candidates.length) return;
      const type = candidates[0];
      init[docKey] = {
        included: true,
        typeId: type.id,
        qty: 1,
        size: type.sizes?.length ? (worker.epi_sizes?.[type.id] || type.sizes[0].name) : null,
      };
    });
    setRows(init);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, worker?.id]);

  if (!open || !worker) return null;

  const updateRow = (docKey, patch) => setRows((prev) => ({ ...prev, [docKey]: { ...prev[docKey], ...patch } }));

  const includedEntries = Object.entries(rows).filter(([, r]) => r.included);
  const missingSize = includedEntries.some(([, r]) => {
    const type = types.find((t) => t.id === r.typeId);
    return type?.sizes?.length && !r.size;
  });

  const handleConfirm = () => {
    if (!includedEntries.length) return;
    if (missingSize) { setError('Há itens sem tamanho escolhido — seleciona um tamanho ou desmarca a linha.'); return; }
    setError('');
    setSigning(true);
  };

  const handleSigned = async (signatureDataUrl) => {
    setBusy(true);
    setError('');
    try {
      const byType = new Map();
      includedEntries.forEach(([, r]) => {
        if (!byType.has(r.typeId)) byType.set(r.typeId, []);
        byType.get(r.typeId).push(r);
      });
      for (const [typeId, group] of byType) {
        const type = types.find((t) => t.id === typeId);
        if (type.sizes?.length) {
          const newSizes = type.sizes.map((s) => {
            const delta = group.filter((r) => r.size === s.name).reduce((sum, r) => sum + r.qty, 0);
            return delta > 0 ? { ...s, stock: Math.max(0, s.stock - delta) } : s;
          });
          const { error: err } = await supabase.from('epi_types').update({ sizes: newSizes }).eq('id', typeId);
          if (err) throw err;
        } else {
          const delta = group.reduce((sum, r) => sum + r.qty, 0);
          const { error: err } = await supabase.from('epi_types').update({ stock: Math.max(0, (type.stock || 0) - delta) }).eq('id', typeId);
          if (err) throw err;
        }
      }

      const now = new Date().toISOString();
      for (const [, r] of includedEntries) {
        const type = types.find((t) => t.id === r.typeId);
        const id = newEpiRequestId();
        const { error: err } = await supabase.from('epi_requests').insert({
          id,
          worker_id: worker.id,
          worker_name: worker.name,
          client_id: worker.defaultClientId || null,
          type_id: r.typeId,
          qty: r.qty,
          size: r.size || null,
          motivo: 'Entrega direta — Termo de Responsabilidade EPI',
          status: 'delivered',
          approved_by: currentUser?.name || 'Admin',
          approved_at: now,
          delivered_at: now,
          signature_data: signatureDataUrl,
          signed_at: now,
        });
        if (err) throw err;
        await notifyWorkerEpiDelivered(supabase, { workerId: worker.id, typeLabel: type.label, requestId: id });
      }

      setBusy(false);
      setSigning(false);
      onChange();
      onClose();
    } catch (err) {
      setBusy(false);
      setSigning(false);
      setError('Erro ao registar entrega: ' + err.message);
    }
  };

  return (
    <ModalShell
      isOpen={open}
      onClose={onClose}
      busy={busy}
      title="Entregar EPI"
      meta={worker.name}
      icon={<PackageCheck size={18} />}
      size="lg"
    >
      <div className="p-5 space-y-3">
        <p className="text-xs text-[var(--slate-dim)]">
          Kit pré-preenchido a partir do Termo de Responsabilidade assinado — itens de EPI atribuídos a <b>{worker.profissao || 'esta profissão'}</b>. Confirmar abate o stock na hora e fica no histórico.
        </p>

        {!kit.length && (
          <p className="text-sm text-[var(--slate-dim)] text-center py-6">
            Nenhum item do Termo de Responsabilidade está atribuído a "{worker.profissao || '—'}" ainda — configura em EPI → Ficha EPI (Documento).
          </p>
        )}

        <div className="space-y-2">
          {kit.map(({ docKey, docNome, candidates }) => {
            if (!candidates.length) {
              return (
                <div key={docKey} className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                  <AlertTriangle size={14} className="text-[var(--orange-deep)] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--ink-mid)] truncate">{docNome}</p>
                    <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>No Termo, sem item de stock ligado (ou nenhum elegível para esta profissão) — não entregável por aqui.</p>
                  </div>
                </div>
              );
            }
            const r = rows[docKey];
            if (!r) return null;
            const type = types.find((t) => t.id === r.typeId);
            const stock = type.sizes?.length ? getStock(type, r.size) : (type.stock || 0);
            const after = Math.max(0, stock - r.qty);
            return (
              <div key={docKey} className={`rounded-xl border px-3 py-2.5 space-y-2 ${r.included ? 'bg-white border-[var(--border-soft)]' : 'bg-[var(--surface-dim)] border-[var(--border-soft)] opacity-60'}`}>
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => updateRow(docKey, { included: !r.included })}
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${r.included ? 'bg-[var(--orange)] border-[var(--orange)]' : 'border-slate-300 bg-white'}`}
                  >
                    {r.included && <Check size={12} className="text-white" />}
                  </button>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[var(--surface)] border border-[var(--border-soft)]">
                    <EpiIcon name={type.icon} size={15} className="text-[var(--navy)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--ink)] truncate">{type.label}</p>
                    <p className={`${SCALE.text.meta} text-[var(--slate-dim)] truncate`}>{docNome}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-9">
                  {candidates.length > 1 && (
                    <select
                      value={r.typeId}
                      onChange={(e) => {
                        const t = types.find((x) => x.id === e.target.value);
                        updateRow(docKey, { typeId: e.target.value, size: t.sizes?.length ? (worker.epi_sizes?.[t.id] || t.sizes[0].name) : null });
                      }}
                      disabled={!r.included}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs disabled:opacity-50"
                    >
                      {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  )}
                  {type.sizes?.length > 0 && (
                    <select
                      value={r.size || ''}
                      onChange={(e) => updateRow(docKey, { size: e.target.value })}
                      disabled={!r.included}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-24 disabled:opacity-50"
                    >
                      <option value="">tamanho…</option>
                      {type.sizes.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                  )}
                  <input
                    type="number"
                    min="1"
                    value={r.qty}
                    onChange={(e) => updateRow(docKey, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    disabled={!r.included}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-16 disabled:opacity-50"
                  />
                  {r.included && (
                    <span className={`${SCALE.text.meta} text-[var(--slate-dim)] whitespace-nowrap`}>
                      stock: {stock} → <span className="font-bold" style={{ color: after === 0 ? FT.bad : 'var(--ok)' }}>{after}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="text-xs text-red-600 font-bold bg-red-50 rounded-lg p-2">{error}</p>}

        <button
          onClick={handleConfirm}
          disabled={busy || !includedEntries.length}
          className="w-full flex items-center justify-center gap-2 disabled:opacity-50 py-2.5 rounded-xl font-black text-xs uppercase shadow-lg transition-all"
          style={{ backgroundColor: FT.orange, color: FT.navy }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
          Confirmar Entrega — {includedEntries.length} {includedEntries.length === 1 ? 'item' : 'itens'}
        </button>
        <p className="text-center text-[10px] text-[var(--slate-dim)] -mt-1">A seguir pede-se a assinatura do trabalhador, no dispositivo.</p>
      </div>

      {signing && (
        <SignDrawModal
          workerName={worker.name}
          working={busy}
          onClose={() => !busy && setSigning(false)}
          onSign={handleSigned}
        />
      )}
    </ModalShell>
  );
}
