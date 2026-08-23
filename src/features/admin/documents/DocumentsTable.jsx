import React, { useState, useRef, useEffect } from 'react';
import {
  FileText, Eye, Trash2, Loader2, Clock, FileSignature, CheckCircle, AlertTriangle, Pencil,
} from 'lucide-react';
import { formatDocDate } from '../../../utils/dateUtils';
import { toSentenceCase, toSentenceCaseFilename } from '../../../utils/textUtils';
import { FT } from '../../../styles/designTokens';
import SortableTh from './SortableTh';
import { getValidadeStatus, getDiasRestantes, CATEGORIAS_RH_ACT, CATEGORIA_CONFIG, CATEGORIA_COLOR_MAP } from '../../../constants/rhCategories';

const ACTION_ICON_CLS = "p-1.5 bg-white rounded-lg border border-[var(--border)] hover:text-white transition-all shadow-sm";
const ACTION_ICON_STYLE = { color: FT.slate };

function StateBadge({ state }) {
  if (state === 'signed') return (
    <span title="Assinado" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-700">
      <CheckCircle size={12} /> Assinado
    </span>
  );
  if (state === 'awaiting_admin') return (
    <span title="Aguarda aprovação" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-[var(--surface-dim)] text-[var(--navy)]">
      <FileSignature size={12} /> Aguarda aprovação
    </span>
  );
  return (
    <span title="Pendente" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-amber-100 text-amber-700">
      <Clock size={12} /> Pendente
    </span>
  );
}

function ValidadeBadge({ dataValidade }) {
  const status = getValidadeStatus(dataValidade);
  if (!status) return null;
  const dias = getDiasRestantes(dataValidade);
  const config = {
    expirado: { cls: 'bg-red-50 text-red-600 border-red-200',        icon: <AlertTriangle size={9} />, label: 'Expirado' },
    urgente:  { cls: 'bg-amber-50 text-amber-600 border-amber-200',  icon: <Clock size={9} />,         label: `${dias}d restantes` },
    aviso:    { cls: 'bg-yellow-50 text-yellow-700 border-yellow-200',icon: <Clock size={9} />,         label: `${dias}d restantes` },
    ok:       { cls: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: <CheckCircle size={9} />, label: 'Válido' },
  };
  const { cls, icon, label } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-lg text-[9px] font-black border ${cls}`}>
      {icon} {label}
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

  const semCategoria = !categoria;
  const colors = semCategoria
    ? { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' }
    : CATEGORIA_COLOR_MAP[(CATEGORIA_CONFIG[categoria] || CATEGORIA_CONFIG["Outros"]).color];

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-lg text-[9px] font-black border transition-all group ${colors.bg} ${colors.text} ${colors.border} hover:brightness-95`}
        title={semCategoria ? 'Sem categoria — clique para definir' : 'Editar categoria'}
      >
        {semCategoria && <AlertTriangle size={8} />}
        {categoria || 'Sem categoria'}
        <Pencil size={8} className="opacity-50 group-hover:opacity-100" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-[var(--border)] rounded-xl shadow-xl overflow-hidden min-w-[220px]">
          <div className="px-3 py-2 border-b border-[var(--border-soft)]">
            <p className="text-[9px] font-black text-[var(--slate-dim)] uppercase tracking-widest">Categoria ACT</p>
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            {CATEGORIAS_RH_ACT.map(c => (
              <button
                key={c}
                onClick={() => { onSave(docId, source, c); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-bold hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${c === categoria ? 'bg-indigo-50 text-indigo-700' : 'text-[var(--ink-mid)]'}`}
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
            <SortableTh label="Tipo / Categoria" columnKey="tipo" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="hidden md:table-cell" />
            <SortableTh label="Estado" columnKey="state" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-right">Ações</th>
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
                <tr key={d.id} className={`bg-[var(--surface)] hover:bg-white hover:shadow-md transition-all duration-300 ${rowHighlight}`}>
                  <td className="px-4 py-4 rounded-l-2xl border-y border-l border-[var(--border-soft)]">
                    <span className="text-xs font-bold text-[var(--slate-dim)] font-mono">
                      {d.createdAt ? formatDocDate(d.createdAt.toISOString(), true) : '—'}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-4 py-4 border-y border-[var(--border-soft)]">
                    <p className="text-sm font-black text-[var(--ink)]">{toSentenceCase(d.workerName)}</p>
                  </td>
                  <td className="px-4 py-4 border-y border-[var(--border-soft)]">
                    <p className="text-xs font-bold text-[var(--ink-mid)] truncate max-w-[260px]" title={d.title}>{toSentenceCaseFilename(d.title)}</p>
                    {d.subtitle && <p className="text-[10px] text-[var(--slate-dim)] mt-0.5 truncate max-w-[260px]">{d.subtitle}</p>}
                    {(d.signedAtWorker || d.signedAtAdmin) && (
                      <div className="mt-1 flex flex-col gap-0.5">
                        {d.signedAtWorker && <p className="text-[10px] text-emerald-600 font-bold">Trabalhador: {formatDocDate(d.signedAtWorker.toISOString(), true)}</p>}
                        {d.signedAtAdmin && <p className="text-[10px] text-indigo-600 font-bold">Magnetic Place: {formatDocDate(d.signedAtAdmin.toISOString(), true)}</p>}
                      </div>
                    )}
                  </td>
                  <td className="hidden md:table-cell px-4 py-4 border-y border-[var(--border-soft)]">
                    <p className="text-xs font-bold text-[var(--ink-mid)]">{d.tipo || '—'}</p>
                    {onEditCategoria ? (
                      <CategoriaEditor
                        docId={d.raw.id}
                        source={d.source}
                        categoria={d.categoria}
                        onSave={onEditCategoria}
                      />
                    ) : (() => {
                      const semCategoria = !d.categoria;
                      const colors = semCategoria
                        ? { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' }
                        : CATEGORIA_COLOR_MAP[(CATEGORIA_CONFIG[d.categoria] || CATEGORIA_CONFIG["Outros"]).color];
                      return (
                        <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-lg text-[9px] font-black border ${colors.bg} ${colors.text} ${colors.border}`}>
                          {semCategoria && <AlertTriangle size={8} />}
                          {d.categoria || 'Sem categoria'}
                        </span>
                      );
                    })()}
                    <ValidadeBadge dataValidade={d.data_validade} />
                  </td>
                  <td className="px-4 py-4 border-y border-[var(--border-soft)]"><StateBadge state={d.state} /></td>
                  <td className="px-4 py-4 rounded-r-2xl border-y border-r border-[var(--border-soft)] text-right">
                    <div className="flex justify-end items-center gap-1 flex-nowrap overflow-x-auto">
                      {d.source === 'manual' ? (
                        <>
                          {d.viewUrl && (
                            <a href={d.viewUrl} target="_blank" rel="noreferrer"
                              className={`${ACTION_ICON_CLS} hover:bg-[var(--slate)]`} style={ACTION_ICON_STYLE} title="Visualizar original">
                              <Eye size={12} />
                            </a>
                          )}
                          {d.signedPdfUrl && (
                            <a href={d.signedPdfUrl} target="_blank" rel="noreferrer"
                              className={`${ACTION_ICON_CLS} hover:bg-[var(--slate)]`} style={ACTION_ICON_STYLE} title="Visualizar assinado">
                              <CheckCircle size={12} />
                            </a>
                          )}
                          <button onClick={() => onDeleteManual(d.raw)}
                            className="p-1.5 bg-white text-red-600 rounded-lg border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm" title="Eliminar">
                            <Trash2 size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => onPreview(d.raw)}
                            className={`${ACTION_ICON_CLS} hover:bg-[var(--slate)]`} style={ACTION_ICON_STYLE} title="Pré-visualizar">
                            <Eye size={12} />
                          </button>
                          {d.signedPdfUrl && (
                            <a href={d.signedPdfUrl} target="_blank" rel="noreferrer"
                              className={`${ACTION_ICON_CLS} hover:bg-[var(--slate)]`} style={ACTION_ICON_STYLE} title="Visualizar assinado">
                              <CheckCircle size={12} />
                            </a>
                          )}
                          {d.state === 'awaiting_admin' && (
                            <button onClick={() => onApprove(d.raw)} disabled={isApproving || saving}
                              className={`${ACTION_ICON_CLS} hover:bg-[var(--slate)] disabled:opacity-50`} style={ACTION_ICON_STYLE} title="Aplicar carimbo">
                              {isApproving ? <Loader2 size={12} className="animate-spin" /> : <FileSignature size={12} />}
                            </button>
                          )}
                          <button onClick={() => onDeleteGenerated(d.raw.id)}
                            className="p-1.5 bg-white text-red-600 rounded-lg border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm" title="Eliminar">
                            <Trash2 size={12} />
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
