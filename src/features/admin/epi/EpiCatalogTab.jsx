import React, { useState } from 'react';
import { Plus, Pencil, Trash2, PackagePlus, X, ScanSearch } from 'lucide-react';
import { SCALE } from '../../../styles/designTokens';
import ModalShell from '../../../components/common/ModalShell';
import { EpiIcon, EPI_ICON_OPTIONS } from '../../../utils/epiIcons';
import { typeStockList, LOW_STOCK_THRESHOLD } from '../../../utils/epiHelpers';
import { PROFISSOES_EMPRESA, GRUPOS_PROFISSOES } from '../../../data/profissoesEmpresa';
import EpiAlbaranScannerModal from './EpiAlbaranScannerModal';

function blankForm() {
  return { id: null, label: '', icon: 'HardHat', sizesOn: false, sizeRows: [], noSizeStock: 0, eligAll: true, eligProfessions: [] };
}
function formFromType(t) {
  return {
    id: t.id,
    label: t.label,
    icon: t.icon,
    sizesOn: !!(t.sizes && t.sizes.length),
    sizeRows: t.sizes ? t.sizes.map((s) => ({ name: s.name, stock: s.stock })) : [],
    noSizeStock: t.sizes ? 0 : (t.stock || 0),
    eligAll: t.eligibility_all,
    eligProfessions: t.eligibility_professions || [],
  };
}
function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'tipo';
}

export default function EpiCatalogTab({ types, requests, supabase, onChange }) {
  const [form, setForm] = useState(blankForm());
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockValues, setRestockValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [albaranOpen, setAlbaranOpen] = useState(false);

  const usageCount = (typeId) => requests.filter((r) => r.type_id === typeId).length;

  const startEdit = (t) => { setForm(formFromType(t)); setError(''); };
  const cancelEdit = () => { setForm(blankForm()); setError(''); };

  const handleDelete = async (t) => {
    if (usageCount(t.id) > 0) return;
    if (!window.confirm(`Remover "${t.label}" do catálogo?`)) return;
    const { error: err } = await supabase.from('epi_types').delete().eq('id', t.id);
    if (err) { window.alert('Erro ao remover: ' + err.message); return; }
    if (form.id === t.id) cancelEdit();
    onChange();
  };

  const handleSave = async () => {
    const label = form.label.trim();
    if (!label) { setError('Dá um nome ao tipo de EPI.'); return; }
    if (!form.eligAll && !form.eligProfessions.length) { setError('Escolhe pelo menos uma profissão, ou ativa "todas as profissões".'); return; }
    let sizes = null;
    let stock = null;
    if (form.sizesOn) {
      const clean = form.sizeRows.filter((r) => r.name && r.name.trim()).map((r) => ({ name: r.name.trim(), stock: Math.max(0, Number(r.stock) || 0) }));
      if (!clean.length) { setError('Adiciona pelo menos um tamanho, ou desliga a variação de tamanho.'); return; }
      sizes = clean;
    } else {
      stock = Math.max(0, Number(form.noSizeStock) || 0);
    }
    setBusy(true);
    setError('');
    const payload = {
      label,
      icon: form.icon,
      sizes,
      stock,
      eligibility_all: form.eligAll,
      eligibility_professions: form.eligAll ? [] : form.eligProfessions,
    };
    let err;
    if (form.id) {
      ({ error: err } = await supabase.from('epi_types').update(payload).eq('id', form.id));
    } else {
      ({ error: err } = await supabase.from('epi_types').insert({ id: `${slugify(label)}-${Date.now() % 100000}`, ...payload }));
    }
    setBusy(false);
    if (err) { setError('Erro ao gravar: ' + err.message); return; }
    cancelEdit();
    onChange();
  };

  const openRestock = (t) => {
    setRestockTarget(t);
    const init = {};
    typeStockList(t).forEach((s) => { init[s.name || '__base__'] = 0; });
    setRestockValues(init);
  };
  const confirmRestock = async () => {
    if (!restockTarget) return;
    const t = restockTarget;
    if (t.sizes && t.sizes.length) {
      const newSizes = t.sizes.map((s) => {
        const delta = Number(restockValues[s.name]) || 0;
        return delta > 0 ? { ...s, stock: s.stock + delta } : s;
      });
      await supabase.from('epi_types').update({ sizes: newSizes }).eq('id', t.id);
    } else {
      const delta = Number(restockValues.__base__) || 0;
      if (delta > 0) await supabase.from('epi_types').update({ stock: (t.stock || 0) + delta }).eq('id', t.id);
    }
    setRestockTarget(null);
    onChange();
  };

  const toggleProfession = (rotulo) => {
    setForm((f) => {
      const has = f.eligProfessions.includes(rotulo);
      return { ...f, eligProfessions: has ? f.eligProfessions.filter((p) => p !== rotulo) : [...f.eligProfessions, rotulo] };
    });
  };

  const addSizeRow = () => setForm((f) => ({ ...f, sizeRows: [...f.sizeRows, { name: '', stock: 0 }] }));
  const removeSizeRow = (i) => setForm((f) => ({ ...f, sizeRows: f.sizeRows.filter((_, idx) => idx !== i) }));
  const updateSizeRow = (i, field, value) => setForm((f) => ({ ...f, sizeRows: f.sizeRows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)) }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
      <div className="space-y-2">
        <button
          onClick={() => setAlbaranOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-[var(--border)] text-[var(--ink-mid)] hover:border-[var(--navy-soft)] hover:bg-[var(--surface)] text-xs font-bold uppercase transition-all"
        >
          <ScanSearch size={14} /> Ler Albarán e Atualizar Stock
        </button>
        {types.map((t) => {
          const used = usageCount(t.id);
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[var(--surface)] border border-[var(--border-soft)]">
                <EpiIcon name={t.icon} size={16} className="text-[var(--navy)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--ink)] truncate">{t.label}</p>
                <p className={`${SCALE.text.meta} text-[var(--slate-dim)] truncate`}>
                  {typeStockList(t).map((s) => `${s.name ? s.name + ': ' : 'Stock: '}${s.stock}${s.stock <= LOW_STOCK_THRESHOLD ? ' ⚠' : ''}`).join(' · ')}
                </p>
                <p className={`${SCALE.text.meta} text-[var(--slate-dim)] truncate`}>
                  {t.eligibility_all ? 'Todas as profissões' : (t.eligibility_professions || []).join(', ') || 'Só por exceção individual'}
                </p>
              </div>
              {used > 0 && <span className={`${SCALE.text.meta} text-[var(--slate-dim)] whitespace-nowrap`}>{used} pedido{used > 1 ? 's' : ''}</span>}
              <button onClick={() => openRestock(t)} title="Repor stock" className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-[var(--ink-mid)] hover:border-[var(--navy-soft)] shrink-0">
                <PackagePlus size={14} />
              </button>
              <button onClick={() => startEdit(t)} title="Editar" className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-[var(--ink-mid)] hover:border-[var(--navy-soft)] shrink-0">
                <Pencil size={13} />
              </button>
              <button
                onClick={() => handleDelete(t)}
                disabled={used > 0}
                title={used > 0 ? 'Não é possível remover — usado em pedidos existentes' : 'Remover'}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-[var(--ink-mid)] hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:text-[var(--ink-mid)] disabled:hover:bg-transparent shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-[var(--border-soft)] shadow-sm p-4 space-y-3 lg:sticky lg:top-4">
        <p className="text-xs font-black uppercase tracking-widest text-[var(--slate-dim)]">{form.id ? 'Editar tipo' : 'Adicionar novo tipo'}</p>

        <div className="flex gap-2">
          <div className="w-40 shrink-0">
            <label className="block text-xs font-bold uppercase text-[var(--ink-mid)] mb-1">Ícone</label>
            <div className="grid grid-cols-4 gap-1.5">
              {EPI_ICON_OPTIONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  onClick={() => setForm((f) => ({ ...f, icon: name }))}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center ${form.icon === name ? 'border-[var(--orange)] bg-amber-50' : 'border-slate-200 bg-white'}`}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-bold uppercase text-[var(--ink-mid)] mb-1">Nome</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="ex. Luvas anticorte"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[var(--ink-mid)]">Disponível para todas as profissões?</span>
            <button onClick={() => setForm((f) => ({ ...f, eligAll: !f.eligAll }))} className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${form.eligAll ? 'bg-[var(--orange)]' : 'bg-slate-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.eligAll ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
          {!form.eligAll && (
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
              {GRUPOS_PROFISSOES.map((grupo) => (
                <div key={grupo}>
                  <p className="text-[10px] font-bold uppercase text-[var(--slate-dim)] mb-1">{grupo}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PROFISSOES_EMPRESA.filter((p) => p.grupo === grupo).map((p) => (
                      <button
                        key={p.codigoCPP}
                        onClick={() => toggleProfession(p.rotulo)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${form.eligProfessions.includes(p.rotulo) ? 'border-[var(--orange)] bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-[var(--ink-mid)]'}`}
                      >
                        {p.rotulo}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[var(--ink-mid)]">Tem variação de tamanho?</span>
            <button
              onClick={() => setForm((f) => ({ ...f, sizesOn: !f.sizesOn, sizeRows: !f.sizesOn && !f.sizeRows.length ? [{ name: '', stock: 0 }] : f.sizeRows }))}
              className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${form.sizesOn ? 'bg-[var(--orange)]' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.sizesOn ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
          {form.sizesOn ? (
            <div className="mt-2 space-y-1.5">
              {form.sizeRows.map((row, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input type="text" placeholder="Nome (ex. M)" value={row.name} onChange={(e) => updateSizeRow(i, 'name', e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                  <input type="number" min="0" placeholder="Stock" value={row.stock} onChange={(e) => updateSizeRow(i, 'stock', e.target.value)} className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                  <button onClick={() => removeSizeRow(i)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-rose-500 shrink-0"><X size={12} /></button>
                </div>
              ))}
              <button onClick={addSizeRow} className="text-xs font-semibold text-[var(--navy)] flex items-center gap-1"><Plus size={12} /> Adicionar tamanho</button>
            </div>
          ) : (
            <div className="mt-2">
              <label className="block text-xs font-bold uppercase text-[var(--ink-mid)] mb-1">Stock atual</label>
              <input type="number" min="0" value={form.noSizeStock} onChange={(e) => setForm((f) => ({ ...f, noSizeStock: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          )}
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          {form.id && <button onClick={cancelEdit} className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold">Cancelar edição</button>}
          <button onClick={handleSave} disabled={busy} className="px-3 py-1.5 rounded-xl bg-[var(--orange)] text-[var(--navy)] text-xs font-bold disabled:opacity-50">
            {form.id ? 'Guardar alterações' : '+ Adicionar tipo'}
          </button>
        </div>
      </div>

      <ModalShell
        isOpen={!!restockTarget}
        onClose={() => setRestockTarget(null)}
        title={`Repor stock — ${restockTarget?.label || ''}`}
        icon={<PackagePlus size={16} />}
        accent="brand"
        footer={
          <div className="flex justify-end gap-2 px-6 py-4">
            <button onClick={() => setRestockTarget(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold">Cancelar</button>
            <button onClick={confirmRestock} className="px-4 py-2 rounded-xl bg-[var(--orange)] text-[var(--navy)] text-sm font-semibold">Confirmar Reposição</button>
          </div>
        }
      >
        {restockTarget && (
          <div className="px-6 py-5 space-y-2.5">
            <p className="text-xs text-[var(--slate-dim)]">Quantidade a somar ao stock atual de cada {restockTarget.sizes?.length ? 'tamanho' : 'item'}.</p>
            {typeStockList(restockTarget).map((s) => {
              const key = s.name || '__base__';
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="flex-1 text-sm font-semibold">{s.name || restockTarget.label}</span>
                  <span className="text-xs text-[var(--slate-dim)] w-20">atual: {s.stock}</span>
                  <input
                    type="number"
                    min="0"
                    value={restockValues[key] ?? 0}
                    onChange={(e) => setRestockValues((v) => ({ ...v, [key]: e.target.value }))}
                    className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
              );
            })}
          </div>
        )}
      </ModalShell>

      <EpiAlbaranScannerModal
        open={albaranOpen}
        onClose={() => setAlbaranOpen(false)}
        types={types}
        onChange={onChange}
      />
    </div>
  );
}
