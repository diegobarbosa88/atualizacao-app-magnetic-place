import React from 'react';
import { FileText, Eye, Trash2, Loader2, FileSignature, CheckCircle } from 'lucide-react';
import { formatDocDate } from '../../../utils/dateUtils';
import { toSentenceCase, toSentenceCaseFilename } from '../../../utils/textUtils';
import { SCALE } from '../../../styles/designTokens';
import SortableTh from './SortableTh';
import { getValidadeStatus } from '../../../constants/rhCategories';
import { StateBadge, ValidadeBadge, CategoriaTag, CategoriaEditor, ACTION_ICON_CLS, ACTION_ICON_DELETE_CLS } from './docBadges';

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
