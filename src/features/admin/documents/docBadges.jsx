import React, { useState, useRef, useEffect } from 'react';
import { Clock, FileSignature, CheckCircle, AlertTriangle, Pencil, Tag } from 'lucide-react';
import { SCALE } from '../../../styles/designTokens';
import { getValidadeStatus, getDiasRestantes, getExpiryRelativeLabel, CATEGORIAS_RH_ACT, CATEGORIA_CONFIG, CATEGORIA_COLOR_MAP, isUncategorized } from '../../../constants/rhCategories';
import { MESES_PT } from '../../../utils/validacaoHelpers';

// Badges/editor de documento partilhados entre DocumentsTable.jsx (Por
// categoria — tabela), CategoryWorkerGrid.jsx (Por categoria — cartões por
// colaborador) e WorkerDocsFolderView.jsx (Por colaborador) — extraído para
// não duplicar a mesma lógica já validada.
export const ACTION_ICON_CLS = "p-1.5 rounded-lg transition-all text-[var(--slate)] hover:text-[var(--navy)] hover:bg-[var(--surface)]";
export const ACTION_ICON_DELETE_CLS = "p-1.5 rounded-lg transition-all text-[var(--bad)] hover:bg-[var(--bad-bg)]";

export const STATE_META = {
  signed:          { icon: CheckCircle,   label: 'Assinado',          color: 'var(--ok)',        bg: 'var(--ok-bg)' },
  awaiting_admin:  { icon: FileSignature, label: 'Aguarda aprovação', color: 'var(--slate-dim)',  bg: 'var(--surface-dim)' },
  pending:         { icon: Clock,         label: 'Pendente',          color: 'var(--warn)',       bg: 'var(--warn-bg)' },
};
const stateMeta = (state) => STATE_META[state] || STATE_META.pending;

export function StateBadge({ state }) {
  const cfg = stateMeta(state);
  const Icon = cfg.icon;
  return (
    <span title={cfg.label} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ${SCALE.text.meta}`} style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      <Icon size={12} /> {cfg.label}
    </span>
  );
}

export function ValidadeBadge({ dataValidade }) {
  const status = getValidadeStatus(dataValidade);
  if (!status) return null;
  const dias = getDiasRestantes(dataValidade);
  const map = {
    expirado: { color: 'var(--bad)',  bg: 'var(--bad-bg)',  border: 'var(--bad-border)',  icon: AlertTriangle, label: 'Expirado' },
    urgente:  { color: 'var(--warn)', bg: 'var(--warn-bg)', border: 'var(--warn-border)', icon: Clock,         label: `${dias}d restantes` },
    aviso:    { color: 'var(--warn)', bg: 'var(--warn-bg)', border: 'var(--warn-border)', icon: Clock,         label: `${dias}d restantes` },
    ok:       { color: 'var(--ok)',   bg: 'var(--ok-bg)',   border: 'var(--ok-border)',   icon: CheckCircle,   label: 'Válido' },
  };
  const { color, bg, border, icon: Icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-lg border ${SCALE.text.meta}`} style={{ color, backgroundColor: bg, borderColor: border }}>
      <Icon size={9} /> {label}
    </span>
  );
}

export function CategoriaTag({ categoria }) {
  const semCategoria = isUncategorized(categoria);
  const colors = semCategoria
    ? { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' }
    : CATEGORIA_COLOR_MAP[(CATEGORIA_CONFIG[categoria] || CATEGORIA_CONFIG["Outros"]).color];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${SCALE.text.meta} border ${colors.bg} ${colors.text} ${colors.border}`}>
      {semCategoria && <AlertTriangle size={8} />}
      {categoria && !semCategoria ? categoria : (categoria ? `Categoria não reconhecida: "${categoria}"` : 'Sem categoria')}
    </span>
  );
}

// `compact`: gatilho é só um ícone (para linhas densas, ex. CategoryWorkerGrid)
// em vez da pílula CategoriaTag completa — mesmo menu, só o botão muda.
export function CategoriaEditor({ docId, source, categoria, onSave, compact }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const semCategoria = isUncategorized(categoria);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const title = categoria ? `Categoria: ${categoria} — clique para editar` : 'Sem categoria — clique para definir';

  return (
    <div className="relative inline-block" ref={ref}>
      {compact ? (
        <button
          onClick={() => setOpen(o => !o)}
          title={title}
          className="p-1.5 rounded-lg transition-all"
          style={semCategoria ? { color: 'var(--warn)' } : { color: 'var(--slate)' }}
        >
          <Tag size={14} />
        </button>
      ) : (
        <button onClick={() => setOpen(o => !o)} className="group" title={title}>
          <span className="inline-flex items-center gap-1">
            <CategoriaTag categoria={categoria} />
            <Pencil size={8} className="opacity-0 group-hover:opacity-60 text-[var(--slate-dim)] transition-opacity" />
          </span>
        </button>
      )}

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-[var(--border)] rounded-xl shadow-xl overflow-hidden min-w-[220px]">
          <div className="px-3 py-2 border-b border-[var(--border-soft)]">
            <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>Categoria ACT</p>
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            {CATEGORIAS_RH_ACT.map(c => (
              <button
                key={c}
                onClick={() => { onSave(docId, source, c); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-bold hover:bg-[var(--navy-soft)] hover:text-[var(--navy)] transition-colors ${c === categoria ? 'bg-[var(--navy-soft)] text-[var(--navy)]' : 'text-[var(--ink-mid)]'}`}
              >
                {c === categoria && <span className="mr-1">✓</span>}{c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Linha compacta de documento — bola de estado + tipo, fundo tingido pela
// cor do estado (STATE_META), sem nome de ficheiro nem data à vista (ficam
// no tooltip). Expirado/urgente pisa o fundo de estado e ganha ícone +
// rótulo sempre visíveis — um documento expirado importa mais do que estar
// "assinado". Partilhada entre CategoryWorkerGrid.jsx (Por categoria) e
// WorkerDocsFolderView.jsx (Por colaborador) — mesma linguagem visual nos
// dois eixos de agrupamento (decisão do Diego, 2026-08-31 — ver CLAUDE.md).
// `onClick` é opcional: em "Por categoria" a linha não é clicável (só os
// ícones de ação, revelados no hover via `children`); em "Por colaborador"
// a linha inteira abre a ficha do documento.
export function CompactDocRow({ d, onClick, hideMesAno, children }) {
  const validadeStatus = getValidadeStatus(d.data_validade);
  const isExpirado = validadeStatus === 'expirado';
  const isUrgente = validadeStatus === 'urgente';
  const expiry = (isExpirado || isUrgente) ? getExpiryRelativeLabel(d.data_validade) : null;
  const meta = stateMeta(d.state);
  const rowHighlight = isExpirado ? 'border-l-4 border-[var(--bad)]'
    : isUrgente ? 'border-l-4 border-[var(--warn)]' : 'border-l-4 border-transparent';
  const mesAno = d.createdAt ? `${MESES_PT[d.createdAt.getMonth()]} ${d.createdAt.getFullYear()}` : null;
  const tooltip = [d.tipo, mesAno, d.title, meta.label, expiry?.label].filter(Boolean).join(' — ');
  const rowBg = isExpirado ? 'var(--bad-bg)' : isUrgente ? 'var(--warn-bg)' : meta.bg;

  return (
    <div
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${rowHighlight} ${onClick ? 'cursor-pointer hover:translate-x-0.5' : ''}`}
      style={{ backgroundColor: rowBg }}
      onClick={onClick}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} title={meta.label} />
      {expiry && (
        <AlertTriangle size={13} className="shrink-0" style={{ color: isExpirado ? 'var(--bad)' : 'var(--warn)' }} />
      )}
      <span className={`flex-1 min-w-0 truncate ${SCALE.text.body} font-semibold text-[var(--ink-mid)]`} title={tooltip}>
        {d.tipo}
        {mesAno && !hideMesAno && <span className="font-normal text-[var(--slate-dim)]"> · {mesAno}</span>}
        {expiry && (
          <span className="font-bold ml-1.5" style={{ color: isExpirado ? 'var(--bad)' : 'var(--warn)' }}>
            · {expiry.label}
          </span>
        )}
      </span>
      {children && <div className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>{children}</div>}
    </div>
  );
}
