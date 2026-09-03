import React, { useState } from 'react';
import { ArrowLeft, PackageCheck } from 'lucide-react';
import { SCALE, FT, FONT_TITLE } from '../../../styles/designTokens';
import { EpiIcon } from '../../../utils/epiIcons';
import { isBaseEligible, eligibleTypesForWorker } from '../../../utils/epiHelpers';
import EntregarEpiModal from './EntregarEpiModal';

const getInitials = (name) => {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
};

// Grava direto em `workers` (epi_overrides/epi_sizes) — sem estado local
// duplicado: a subscrição realtime já existente em AppContext.jsx para a
// tabela `workers` (channelWorkers) atualiza sozinha o array global assim
// que o UPDATE chega, e esta lista lê sempre `workers` (prop, vindo de
// useApp() no componente pai).
export default function EpiWorkerSettingsTab({ types, workers, catalogoDocumento, currentUser, supabase, onChange }) {
  const [pickedId, setPickedId] = useState(null);
  const [entregarOpen, setEntregarOpen] = useState(false);
  const worker = workers.find((w) => w.id === pickedId) || null;

  const persist = async (patch) => {
    if (!worker || !supabase) return;
    await supabase.from('workers').update(patch).eq('id', worker.id);
  };

  const toggleType = (typeId) => {
    const type = types.find((t) => t.id === typeId);
    const overrides = worker.epi_overrides || { add: [], remove: [] };
    const base = isBaseEligible(type, worker);
    const currentlyOn = eligibleTypesForWorker(types, worker).some((t) => t.id === typeId);
    let add = overrides.add || [];
    let remove = overrides.remove || [];
    if (currentlyOn) {
      add = add.filter((id) => id !== typeId);
      if (base) remove = [...remove, typeId];
    } else {
      remove = remove.filter((id) => id !== typeId);
      if (!base) add = [...add, typeId];
    }
    persist({ epi_overrides: { add, remove } });
  };

  const setSize = (typeId, sizeName) => {
    const sizes = { ...(worker.epi_sizes || {}) };
    if (sizeName) sizes[typeId] = sizeName;
    else delete sizes[typeId];
    persist({ epi_sizes: sizes });
  };

  if (!worker) {
    return (
      <div className="space-y-2">
        <p className={`${SCALE.text.body} text-[var(--slate-dim)] mb-2`}>
          Cada trabalhador herda os EPI da profissão dele — escolhe um para ajustar exceções individuais e registar as medidas dele.
        </p>
        {workers.map((w) => {
          const n = eligibleTypesForWorker(types, w).length;
          return (
            <button
              key={w.id}
              onClick={() => setPickedId(w.id)}
              className="w-full flex items-center gap-3 bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm px-4 py-3 text-left hover:border-[var(--navy-soft)] transition-colors"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-black" style={{ background: FT.navy }}>{getInitials(w.name)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--ink)] truncate">{w.name}</p>
                <p className={`${SCALE.text.meta} text-[var(--slate-dim)] truncate`}>{w.profissao || '—'}</p>
              </div>
              <span className={`${SCALE.text.meta} text-[var(--slate-dim)] whitespace-nowrap`}>{n} tipos ativos</span>
            </button>
          );
        })}
      </div>
    );
  }

  const overrides = worker.epi_overrides || { add: [], remove: [] };

  return (
    <div>
      <button onClick={() => setPickedId(null)} className="flex items-center gap-1.5 text-sm font-semibold text-[var(--navy)] mb-3">
        <ArrowLeft size={14} /> todos os trabalhadores
      </button>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-[var(--ink)]" style={{ fontFamily: FONT_TITLE }}>{worker.name}</p>
          <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>{worker.profissao || '—'}</p>
        </div>
        <button
          onClick={() => setEntregarOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase shadow-sm shrink-0"
          style={{ backgroundColor: FT.orange, color: FT.navy }}
        >
          <PackageCheck size={14} /> Entregar EPI
        </button>
      </div>
      <div className="space-y-2">
        {types.map((t) => {
          const base = isBaseEligible(t, worker);
          const added = (overrides.add || []).includes(t.id);
          const removed = (overrides.remove || []).includes(t.id);
          const on = (base && !removed) || added;
          const statusTxt = added ? 'Adicionado individualmente' : removed ? 'Removido individualmente' : base ? 'Padrão da profissão' : 'Não disponível';
          const statusColor = added ? FT.ok : removed ? FT.bad : 'var(--slate-dim)';
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm px-4 py-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[var(--surface)] border border-[var(--border-soft)]">
                <EpiIcon name={t.icon} size={16} className="text-[var(--navy)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--ink)]">{t.label}</p>
                <p className={SCALE.text.meta} style={{ color: statusColor }}>{statusTxt}</p>
                {on && t.sizes && t.sizes.length > 0 && (
                  <select
                    value={(worker.epi_sizes || {})[t.id] || ''}
                    onChange={(e) => setSize(t.id, e.target.value)}
                    className="mt-1.5 w-full max-w-[220px] border border-slate-200 rounded-lg px-2 py-1 text-xs"
                  >
                    <option value="">Medida não registada</option>
                    {t.sizes.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                )}
              </div>
              <button
                onClick={() => toggleType(t.id)}
                className={`w-9 h-5 rounded-full relative transition-colors shrink-0 mt-1 ${on ? 'bg-[var(--orange)]' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          );
        })}
      </div>

      <EntregarEpiModal
        open={entregarOpen}
        onClose={() => setEntregarOpen(false)}
        worker={worker}
        types={types}
        catalogoDocumento={catalogoDocumento}
        currentUser={currentUser}
        supabase={supabase}
        onChange={onChange}
      />
    </div>
  );
}
