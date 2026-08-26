import React, { useState, useRef, useEffect } from 'react';
import {
  FileText, Eye, Trash2, Loader2, Clock, FileSignature, CheckCircle, AlertTriangle, Pencil,
} from 'lucide-react';
import { formatDocDate } from '../../../utils/dateUtils';
import { toSentenceCase, toSentenceCaseFilename } from '../../../utils/textUtils';
import { SCALE } from '../../../styles/designTokens';
import SortableTh from './SortableTh';
import { getValidadeStatus, getDiasRestantes, CATEGORIAS_RH_ACT, CATEGORIA_CONFIG, CATEGORIA_COLOR_MAP } from '../../../constants/rhCategories';

const ACTION_ICON_CLS = "p-1.5 rounded-lg transition-all text-[var(--slate)] hover:text-[var(--navy)] hover:bg-[var(--surface)]";
const ACTION_ICON_DELETE_CLS = "p-1.5 rounded-lg transition-all text-[var(--bad)] hover:bg-[var(--bad-bg)]";

function StateBadge({ state }) {
  const map = {
    signed:          { icon: CheckCircle,   label: 'Assinado',          color: 'var(--ok)',        bg: 'var(--ok-bg)' },
    awaiting_admin:  { icon: FileSignature, label: 'Aguarda aprovação', color: 'var(--slate-dim)',  bg: 'var(--surface-dim)' },
  };
  const cfg = map[state] || { icon: Clock, label: 'Pendente', color: 'var(--warn)', bg: 'var(--warn-bg)' };
  const Icon = cfg.icon;
  return (
    <span title={cfg.label} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ${SCALE.text.meta}`} style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      <Icon size={12} /> {cfg.label}
    </span>
  );
}

function ValidadeBadge({ dataValidade }) {
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

function CategoriaTag({ categoria }) {
  const semCategoria = !categoria;
  const colors = semCategoria
    ? { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' }
    : CATEGORIA_COLOR_MAP[(CATEGORIA_CONFIG[categoria] || CATEGORIA_CONFIG["Outros"]).color];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${SCALE.text.meta} border ${colors.bg} ${colors.text} ${colors.border}`}>
      {semCategoria && <AlertTriangle size={8} />}
      {categoria || 'Sem categoria'}
    </span>
  );
}

function CategoriaEditor({ docId, source, categoria, onSave }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="group"
        title={categoria ? 'Editar categoria' : 'Sem categoria — clique para definir'}
      >
        <span className="inline-flex items-center gap-1">
          <CategoriaTag categoria={categoria} />
          <Pencil size={8} className="opacity-0 group-hover:opacity-60 text-[var(--slate-dim)] transition-opacity" />
        </span>
      </button>

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

export default function DocumentsTable({
  filteredDocs,
  loadingDocs,
  sortKey, sortDir, onSort,
  onDeleteManual,
  onDeleteGenerated,
  onApprove,
  onPreview,
  onEditCategoria,
  approvingId,
  saving,
}) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-[var(--slate-dim)]">
            <SortableTh label="Data" columnKey="createdAt" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortableTh label="Colaborador" columnKey="workerName" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="hidden md:table-cell" />
            <SortableTh label="Documento" columnKey="title" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th className={`hidden md:table-cell px-4 py-2 ${SCALE.text.statLabel}`}>Categoria</th>
            <SortableTh label="Estado" columnKey="state" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th className={`px-4 py-2 ${SCALE.text.statLabel} text-right`}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {loadingDocs && filteredDocs.length === 0 ? (
            <tr><td colSpan={6} className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--slate)]" /></td></tr>
          ) : filteredDocs.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-20 text-center">
                <div className="flex flex-col items-center gap-2 opacity-30">
                  <FileText size={40} />
                  <p className="text-xs font-black uppercase tracking-widest">Sem documentos</p>
                </div>
              </td>
            </tr>
          ) : (
            filteredDocs.map(d => {
              const isApproving = approvingId === d.raw.id;
              const validadeStatus = getValidadeStatus(d.data_validade);
              const rowHighlight = validadeStatus === 'expirado' ? 'border-l-2 border-red-300'
                : validadeStatus === 'urgente' ? 'border-l-2 border-amber-300' : '';
              return (
                <tr key={d.id} className={`bg-[var(--surface)] hover:bg-white transition-colors duration-200 ${rowHighlight}`}>
                  <td className="px-4 py-4 rounded-l-2xl border-y border-l border-[var(--border-soft)]">
                    <span className="text-xs font-bold text-[var(--slate-dim)] font-mono">
                      {d.createdAt ? formatDocDate(d.createdAt.toISOString(), true) : '—'}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-4 py-4 border-y border-[var(--border-soft)]">
                    <p className="text-sm font-black text-[var(--ink)]">{toSentenceCase(d.workerName)}</p>
                  </td>
                  {/* Documento — nome do ficheiro + tipo juntos (antes repetia
                      o tipo numa coluna à parte). */}
                  <td className="px-4 py-4 border-y border-[var(--border-soft)]">
                    <p className="text-xs font-bold text-[var(--ink-mid)] truncate max-w-[260px]" title={d.title}>{toSentenceCaseFilename(d.title)}</p>
                    {d.tipo && <p className={`${SCALE.text.meta} text-[var(--slate-dim)] mt-0.5 truncate max-w-[260px]`}>{d.tipo}</p>}
                    {(d.signedAtWorker || d.signedAtAdmin) && (
                      <div className="mt-1 flex flex-col gap-0.5">
                        {d.signedAtWorker && <p className={`${SCALE.text.meta}`} style={{ color: 'var(--ok)' }}>Trabalhador: {formatDocDate(d.signedAtWorker.toISOString(), true)}</p>}
                        {d.signedAtAdmin && <p className={`${SCALE.text.meta} text-indigo-600`}>Magnetic Place: {formatDocDate(d.signedAtAdmin.toISOString(), true)}</p>}
                      </div>
                    )}
                  </td>
                  <td className="hidden md:table-cell px-4 py-4 border-y border-[var(--border-soft)]">
                    {onEditCategoria ? (
                      <CategoriaEditor docId={d.raw.id} source={d.source} categoria={d.categoria} onSave={onEditCategoria} />
                    ) : (
                      <CategoriaTag categoria={d.categoria} />
                    )}
                    <div><ValidadeBadge dataValidade={d.data_validade} /></div>
                  </td>
                  <td className="px-4 py-4 border-y border-[var(--border-soft)]"><StateBadge state={d.state} /></td>
                  <td className="px-4 py-4 rounded-r-2xl border-y border-r border-[var(--border-soft)] text-right">
                    <div className="flex justify-end items-center gap-1 flex-nowrap overflow-x-auto">
                      {d.source === 'manual' ? (
                        <>
                          {d.viewUrl && (
                            <a href={d.viewUrl} target="_blank" rel="noreferrer" className={ACTION_ICON_CLS} title="Visualizar original">
                              <Eye size={14} />
                            </a>
                          )}
                          {d.signedPdfUrl && (
                            <a href={d.signedPdfUrl} target="_blank" rel="noreferrer" className={ACTION_ICON_CLS} title="Visualizar assinado">
                              <CheckCircle size={14} />
                            </a>
                          )}
                          <button onClick={() => onDeleteManual(d.raw)} className={ACTION_ICON_DELETE_CLS} title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => onPreview(d.raw)} className={ACTION_ICON_CLS} title="Pré-visualizar">
                            <Eye size={14} />
                          </button>
                          {d.signedPdfUrl && (
                            <a href={d.signedPdfUrl} target="_blank" rel="noreferrer" className={ACTION_ICON_CLS} title="Visualizar assinado">
                              <CheckCircle size={14} />
                            </a>
                          )}
                          {d.state === 'awaiting_admin' && (
                            <button onClick={() => onApprove(d.raw)} disabled={isApproving || saving} className={`${ACTION_ICON_CLS} disabled:opacity-50`} title="Aplicar carimbo">
                              {isApproving ? <Loader2 size={14} className="animate-spin" /> : <FileSignature size={14} />}
                            </button>
                          )}
                          <button onClick={() => onDeleteGenerated(d.raw.id)} className={ACTION_ICON_DELETE_CLS} title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
