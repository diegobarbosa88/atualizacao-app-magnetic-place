import React, { useState } from 'react';
import { ChevronDown, Search, Plus, Info, Lock, Boxes } from 'lucide-react';
import { SCALE, FT } from '../../../styles/designTokens';
import { PROFISSOES_EMPRESA, GRUPOS_PROFISSOES } from '../../../data/profissoesEmpresa';
import { EpiIcon } from '../../../utils/epiIcons';

// Pequena biblioteca de ícones SVG autocontidos (sem <img>/CDN — os
// templates HTML deste catálogo vão para geração de PDF num Lambda
// isolado, ver src/data/epiIcones.js). Reaproveitada para itens NOVOS —
// os 17 itens seedados na migração já trazem o seu próprio icon_svg.
const ICON_LIBRARY = [
  { id: 'capacete', svg: '<path d="M4 16h16a8 8 0 0 0-16 0Z"/><path d="M2 16h20"/><path d="M12 4v4"/>' },
  { id: 'auricular', svg: '<path d="M4 13a8 8 0 0 1 16 0"/><rect x="2.5" y="12" width="4" height="6" rx="1.5"/><rect x="17.5" y="12" width="4" height="6" rx="1.5"/>' },
  { id: 'oculos', svg: '<rect x="2.5" y="9" width="7" height="6" rx="2"/><rect x="14.5" y="9" width="7" height="6" rx="2"/><path d="M9.5 12h5"/>' },
  { id: 'mascara', svg: '<path d="M4 12c0-3 3.5-5 8-5s8 2 8 5-3.5 6-8 6-8-3-8-6Z"/><path d="M4 12h16"/>' },
  { id: 'vestuario', svg: '<path d="M8 3 5 6v4l2-1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9l2 1V6l-3-3-2 2H10Z"/>' },
  { id: 'colete', svg: '<path d="M8 3 6 6v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6l-2-3-3 2h-2Z"/><path d="M7 10h10"/><path d="M7 14h10"/>' },
  { id: 'luvas', svg: '<path d="M7 21v-9a3 3 0 0 1 3-3h1a3 3 0 0 1 3 3v1a3 3 0 0 1 3 3v5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2Z"/>' },
  { id: 'calcado', svg: '<path d="M6 3v9l-3 3v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1c0-2-2-3-5-4l-4-1.5V3Z"/>' },
  { id: 'arnes', svg: '<circle cx="12" cy="5" r="2.2"/><path d="M12 7v14"/><path d="M6 11h12"/><path d="M8 9l4 2 4-2"/><path d="M8 21l4-8 4 8"/>' },
  { id: 'generico', svg: '<circle cx="12" cy="12" r="8"/>' },
];
const S_ATTRS = 'fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
function buildIconSvg(iconId) {
  const found = ICON_LIBRARY.find((i) => i.id === iconId) || ICON_LIBRARY[ICON_LIBRARY.length - 1];
  return `<svg width="16" height="16" viewBox="0 0 24 24" ${S_ATTRS}>${found.svg}</svg>`;
}

function slugify(nome) {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function NewEpiForm({ existingKeys, onCancel, onCreate }) {
  const [nome, setNome] = useState('');
  const [risco, setRisco] = useState('');
  const [manutencao, setManutencao] = useState('');
  const [iconId, setIconId] = useState('generico');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const submit = async () => {
    if (!nome.trim()) return;
    let key = slugify(nome);
    if (!key) key = 'epi';
    if (existingKeys.includes(key)) {
      let i = 2;
      while (existingKeys.includes(`${key}_${i}`)) i++;
      key = `${key}_${i}`;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      await onCreate({
        key,
        nome: nome.trim(),
        risco: risco.trim(),
        manutencao: manutencao.trim(),
        icon_svg: buildIconSvg(iconId),
        profissoes: [],
      });
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao criar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[var(--navy)] shadow-sm px-4 py-4 mb-3">
      <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-3`}>Novo EPI</p>
      <div className="space-y-3">
        <div>
          <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] block mb-1`}>Nome</label>
          <input
            type="text" value={nome} onChange={(e) => setNome(e.target.value)}
            className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
            placeholder="Ex.: Protetor Solar"
          />
        </div>
        <div>
          <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] block mb-1`}>Ícone</label>
          <div className="flex flex-wrap gap-2">
            {ICON_LIBRARY.map((ic) => (
              <button
                key={ic.id}
                onClick={() => setIconId(ic.id)}
                className={`w-9 h-9 rounded-lg border flex items-center justify-center ${iconId === ic.id ? 'border-[var(--orange)] bg-[var(--warn-bg)]' : 'border-[var(--border-soft)] bg-[var(--surface)]'}`}
              >
                <span dangerouslySetInnerHTML={{ __html: `<svg width="16" height="16" viewBox="0 0 24 24" ${S_ATTRS}>${ic.svg}</svg>` }} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] block mb-1`}>Risco</label>
          <textarea
            value={risco} onChange={(e) => setRisco(e.target.value)}
            className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm min-h-[52px]"
            placeholder="Descrição do risco que este EPI mitiga"
          />
        </div>
        <div>
          <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] block mb-1`}>Manutenção</label>
          <textarea
            value={manutencao} onChange={(e) => setManutencao(e.target.value)}
            className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm min-h-[52px]"
            placeholder="Instruções de conservação/substituição"
          />
        </div>
        {errorMsg && <p className="text-xs text-[var(--bad)]">{errorMsg}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-3.5 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--slate-dim)]">Cancelar</button>
          <button
            onClick={submit} disabled={!nome.trim() || saving}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: FT.navy }}
          >
            {saving ? 'A criar...' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EpiCard({ item, types, expanded, onToggle, onSave }) {
  const [nome, setNome] = useState(item.nome);
  const [risco, setRisco] = useState(item.risco);
  const [manutencao, setManutencao] = useState(item.manutencao);
  const [profissoes, setProfissoes] = useState(item.profissoes || []);
  const [epiTypeIds, setEpiTypeIds] = useState(item.epi_type_ids || []);
  const [saving, setSaving] = useState(false);

  // Reset do estado local do formulário sempre que o item de fora mudar
  // (ex. outra aba/sessão gravou entretanto) — evita mostrar dados presos
  // de uma edição anterior.
  React.useEffect(() => {
    setNome(item.nome); setRisco(item.risco); setManutencao(item.manutencao);
    setProfissoes(item.profissoes || []); setEpiTypeIds(item.epi_type_ids || []);
  }, [item]);

  const toggleProf = (rotulo) => {
    setProfissoes((prev) => prev.includes(rotulo) ? prev.filter((p) => p !== rotulo) : [...prev, rotulo]);
  };

  const toggleType = (typeId) => {
    setEpiTypeIds((prev) => prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(item.key, { nome, risco, manutencao, profissoes, epi_type_ids: epiTypeIds });
    } finally {
      setSaving(false);
    }
  };

  const has = (item.profissoes || []).length > 0;
  const linkedCount = (item.epi_type_ids || []).length;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors ${expanded ? 'border-[var(--navy)]' : 'border-[var(--border-soft)]'}`}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[var(--surface)] border border-[var(--border-soft)] text-[var(--navy)]">
          <span dangerouslySetInnerHTML={{ __html: item.icon_svg || '' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-[var(--ink)] truncate" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>{item.nome}</p>
          <p className={`${SCALE.text.meta}`} style={{ color: has ? FT.ok : 'var(--slate-dim)' }}>
            {has ? `${item.profissoes.length} profissão(ões) atribuída(s)` : 'Nenhuma profissão atribuída'}
          </p>
          <p className={`${SCALE.text.meta}`} style={{ color: linkedCount ? FT.ok : FT.orangeDeep }}>
            {linkedCount ? `Ligado a ${linkedCount} item${linkedCount > 1 ? 's' : ''} de stock` : 'Sem item de stock associado — só documento'}
          </p>
        </div>
        <ChevronDown size={16} className={`text-[var(--slate-dim)] shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-[var(--border-soft)]">
          <div className="mt-3">
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] block mb-1`}>Nome</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="mt-3">
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-1 flex items-center gap-1.5`}>
              Risco
              <span className="inline-flex items-center gap-1 bg-[var(--warn-bg)] text-[var(--orange-deep)] text-[9px] font-bold px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                <Lock size={9} /> texto oficial
              </span>
            </label>
            <textarea value={risco} onChange={(e) => setRisco(e.target.value)} className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm min-h-[52px]" />
          </div>
          <div className="mt-3">
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-1 flex items-center gap-1.5`}>
              Manutenção
              <span className="inline-flex items-center gap-1 bg-[var(--warn-bg)] text-[var(--orange-deep)] text-[9px] font-bold px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                <Lock size={9} /> texto oficial
              </span>
            </label>
            <textarea value={manutencao} onChange={(e) => setManutencao(e.target.value)} className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm min-h-[52px]" />
          </div>
          <div className="mt-3">
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] block mb-2`}>Atribuir a estas profissões</label>
            {profissoes.length === 0 && <p className="text-xs italic text-[var(--slate-dim)] mb-2">Ainda sem nenhuma profissão marcada.</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {GRUPOS_PROFISSOES.map((grupo) => (
                <div key={grupo}>
                  <p className="text-[9.5px] font-extrabold uppercase tracking-wider text-[var(--slate)] mb-1.5">{grupo}</p>
                  <div className="space-y-0.5">
                    {PROFISSOES_EMPRESA.filter((p) => p.grupo === grupo).map((p) => {
                      const on = profissoes.includes(p.rotulo);
                      return (
                        <div key={p.rotulo} onClick={() => toggleProf(p.rotulo)} className="flex items-center gap-2 py-1 px-1.5 rounded-lg cursor-pointer hover:bg-[var(--surface)]">
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${on ? 'border-[var(--orange)]' : 'border-[var(--border)]'}`} style={on ? { background: FT.orange } : undefined}>
                            {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
                          </div>
                          <span className="text-[12.5px] text-[var(--ink)]">{p.rotulo}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <label className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-1 flex items-center gap-1.5`}>
              <Boxes size={11} /> Item(ns) de stock associado(s)
            </label>
            <p className="text-xs text-[var(--slate-dim)] mb-2">
              Liga este item do documento ao(s) SKU(s) reais do Catálogo — é o que a "Entrega de EPI" usa para saber o que abater do stock. Mais de um quando este item cobre profissões com produtos diferentes (ex. luvas de soldador vs. de serralheiro).
            </p>
            {!types?.length && <p className="text-xs italic text-[var(--slate-dim)]">Sem tipos no Catálogo ainda.</p>}
            <div className="flex flex-wrap gap-1.5">
              {(types || []).map((t) => {
                const on = epiTypeIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleType(t.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${on ? 'border-[var(--orange)] bg-[var(--warn-bg)] text-[var(--orange-deep)]' : 'border-[var(--border)] bg-[var(--panel)] text-[var(--ink-mid)]'}`}
                  >
                    <EpiIcon name={t.icon} size={12} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--border-soft)]">
            <button onClick={onToggle} className="px-3.5 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--slate-dim)]">Fechar</button>
            <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: FT.navy }}>
              {saving ? 'A gravar...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Catálogo EPI usado só para preencher o documento "Termo de
// Responsabilidade — EPI" (e templates HTML semelhantes) — diferente do
// "Catálogo" da 1.ª aba (esse é para o pedido/stock self-service). Aqui não
// há tamanhos nem controlo de stock, só nome/risco/manutenção (texto
// oficial) e a atribuição por profissão, que o documento usa para montar a
// lista de EPI automaticamente a partir de workers.profissao.
export default function EpiDocumentoTab({ catalogo, types, supabase, onChange }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);

  const items = (catalogo || []).filter((i) => !search.trim() || i.nome.toLowerCase().includes(search.trim().toLowerCase()));

  const persist = async (key, patch) => {
    await supabase.from('epi_catalogo_documento').update(patch).eq('key', key);
    onChange();
  };

  const create = async (row) => {
    const { error } = await supabase.from('epi_catalogo_documento').insert(row);
    if (error) throw error;
    setShowNew(false);
    onChange();
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-start gap-2.5 bg-[var(--warn-bg)] border border-[rgba(217,138,43,0.35)] rounded-xl px-3.5 py-2.5 mb-3">
        <Info size={15} className="text-[var(--orange-deep)] shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-[var(--ink-soft)] leading-snug">
          <b className="text-[var(--ink)]">Risco e manutenção são texto oficial</b> — só editar aqui se o modelo (F-108_012) mudar. O que normalmente precisas de ajustar é a <b className="text-[var(--ink)]">atribuição por profissão</b>, dentro de cada item.
        </p>
      </div>

      <div className="flex items-center gap-2.5 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate-dim)]" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar EPI..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--border)] text-sm"
          />
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold whitespace-nowrap"
          style={{ background: FT.orange }}
        >
          <Plus size={14} /> Novo EPI
        </button>
      </div>

      {showNew && (
        <NewEpiForm
          existingKeys={(catalogo || []).map((i) => i.key)}
          onCancel={() => setShowNew(false)}
          onCreate={create}
        />
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <EpiCard
            key={item.key}
            item={item}
            types={types}
            expanded={expandedKey === item.key}
            onToggle={() => setExpandedKey((k) => k === item.key ? null : item.key)}
            onSave={persist}
          />
        ))}
        {items.length === 0 && (
          <p className="text-sm text-[var(--slate-dim)] text-center py-6">Nenhum EPI encontrado.</p>
        )}
      </div>
    </div>
  );
}
