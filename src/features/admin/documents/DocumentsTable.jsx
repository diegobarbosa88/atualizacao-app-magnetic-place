import React from 'react';
import {
  FileText, Eye, Trash2, Loader2, Clock, FileSignature, CheckCircle,
} from 'lucide-react';
import { formatDocDate } from '../../../utils/dateUtils';
import SortableTh from './SortableTh';

function StateBadge({ state }) {
  if (state === 'signed') {
    return (
      <span title="Assinado" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle size={14} />
      </span>
    );
  }
  if (state === 'awaiting_admin') {
    return (
      <span title="Aguarda Aprovação" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-600">
        <FileSignature size={14} />
      </span>
    );
  }
  return (
    <span title="Pendente" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-500">
      <Clock size={14} />
    </span>
  );
}

function SourceChip({ source }) {
  return (
    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
      source === 'template'
        ? 'bg-purple-50 text-purple-700 border-purple-100'
        : 'bg-slate-50 text-slate-600 border-slate-200'
    }`}>
      {source === 'template' ? 'Template' : 'Manual'}
    </span>
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
  approvingId,
  saving,
}) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-slate-400">
            <SortableTh label="Data" columnKey="createdAt" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortableTh label="Colaborador" columnKey="workerName" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortableTh label="Documento" columnKey="title" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortableTh label="Tipo" columnKey="tipo" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortableTh label="Estado" columnKey="state" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {loadingDocs && filteredDocs.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-16 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-300" />
              </td>
            </tr>
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
              return (
                <tr key={d.id} className="bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300">
                  <td className="px-4 py-4 rounded-l-2xl border-y border-l border-slate-100">
                    <span className="text-xs font-bold text-slate-500 font-mono">
                      {d.createdAt ? formatDocDate(d.createdAt.toISOString(), true) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-y border-slate-100">
                    <p className="text-sm font-black text-slate-800">{d.workerName}</p>
                  </td>
                  <td className="px-4 py-4 border-y border-slate-100">
                    <p className="text-xs font-bold text-slate-700 truncate max-w-[260px]" title={d.title}>{d.title}</p>
                    {d.subtitle && <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[260px]">{d.subtitle}</p>}
                    {(d.signedAtWorker || d.signedAtAdmin) && (
                      <div className="mt-1 flex flex-col gap-0.5">
                        {d.signedAtWorker && (
                          <p className="text-[10px] text-emerald-600 font-bold">
                            Trabalhador: {formatDocDate(d.signedAtWorker.toISOString(), true)}
                          </p>
                        )}
                        {d.signedAtAdmin && (
                          <p className="text-[10px] text-indigo-600 font-bold">
                            Magnetic Place: {formatDocDate(d.signedAtAdmin.toISOString(), true)}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 border-y border-slate-100">
                    <p className="text-xs font-bold text-slate-700">{d.tipo || '—'}</p>
                  </td>
                  <td className="px-4 py-4 border-y border-slate-100"><StateBadge state={d.state} /></td>
                  <td className="px-4 py-4 rounded-r-2xl border-y border-r border-slate-100 text-right">
                    <div className="flex justify-end items-center gap-1 flex-nowrap overflow-x-auto">
                      {d.source === 'manual' ? (
                        <>
                          {d.viewUrl && (
                            <a
                              href={d.viewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-white text-indigo-600 rounded-lg border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                              title="Visualizar original"
                            >
                              <Eye size={12} />
                            </a>
                          )}
                          {d.signedPdfUrl && (
                            <a
                              href={d.signedPdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-white text-emerald-600 rounded-lg border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                              title="Visualizar assinado"
                            >
                              <CheckCircle size={12} />
                            </a>
                          )}
                          <button
                            onClick={() => onDeleteManual(d.raw)}
                            className="p-1.5 bg-white text-rose-500 rounded-lg border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                            title="Eliminar"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => onPreview(d.raw)}
                            className="p-1.5 bg-white text-indigo-600 rounded-lg border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                            title="Pré-visualizar com dados do trabalhador"
                          >
                            <Eye size={12} />
                          </button>
                          {d.signedPdfUrl && (
                            <a
                              href={d.signedPdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-white text-emerald-600 rounded-lg border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                              title="Visualizar assinado"
                            >
                              <CheckCircle size={12} />
                            </a>
                          )}
                          {d.state === 'awaiting_admin' && (
                            <button
                              onClick={() => onApprove(d.raw)}
                              disabled={isApproving || saving}
                              className="p-1.5 bg-indigo-600 text-white rounded-lg border border-indigo-600 hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50"
                              title="Aplicar carimbo da empresa e finalizar"
                            >
                              {isApproving ? <Loader2 size={12} className="animate-spin" /> : <FileSignature size={12} />}
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteGenerated(d.raw.id)}
                            className="p-1.5 bg-white text-rose-500 rounded-lg border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                            title="Eliminar"
                          >
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
