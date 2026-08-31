import React, { useMemo, useState } from 'react';
import { FileText, Eye, Trash2, Loader2, FileSignature, CheckCircle } from 'lucide-react';
import { toSentenceCase, getInitials } from '../../../utils/textUtils';
import { SCALE, FT, FONT_TITLE } from '../../../styles/designTokens';
import { CategoriaEditor, ACTION_ICON_CLS, ACTION_ICON_DELETE_CLS, CompactDocRow } from './docBadges';
import ModalShell from '../../../components/common/ModalShell';
import { WorkerPastaView, DocumentViewerModal } from './WorkerDocsFolderView';

const ACTION_STATES = ['pending', 'awaiting_admin'];
const MAX_ROWS_PER_CARD = 3;

// Linha compacta (CompactDocRow, docBadges.jsx) + ícones de ação revelados
// só no hover — a linha em si não é clicável aqui (ao contrário de "Por
// colaborador"), só os ícones (decisão do Diego, 2026-08-31 — ver CLAUDE.md).
function DocRow({ d, onApprove, onPreview, onDeleteManual, onDeleteGenerated, onEditCategoria, approvingId, saving }) {
  const isApproving = approvingId === d.raw.id;
  return (
    <CompactDocRow d={d}>
      {onEditCategoria && (
        <CategoriaEditor docId={d.raw.id} source={d.source} categoria={d.categoria} onSave={onEditCategoria} compact />
      )}
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
    </CompactDocRow>
  );
}

function WorkerCard({ worker, docs, onOpenFolder, ...actions }) {
  const acaoCount = docs.filter(d => ACTION_STATES.includes(d.state)).length;
  const shown = docs.slice(0, MAX_ROWS_PER_CARD);
  const extra = docs.length - shown.length;

  return (
    <div className="bg-white rounded-2xl border border-[var(--border-soft)] p-3.5">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0"
          style={{ backgroundColor: FT.navy, color: FT.orange }}
        >
          {getInitials(worker.workerName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-[var(--ink)] truncate" style={{ fontFamily: FONT_TITLE }}>{toSentenceCase(worker.workerName)}</p>
          <p className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>
            {docs.length} documento{docs.length !== 1 ? 's' : ''}
            {acaoCount > 0 && <span style={{ color: 'var(--warn)' }}> · {acaoCount} por resolver</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {shown.map(d => (
          <DocRow key={d.id} d={d} {...actions} />
        ))}
      </div>
      {extra > 0 && (
        <button
          onClick={() => onOpenFolder(worker.workerId)}
          className={`w-full ${SCALE.text.meta} text-[var(--slate-dim)] hover:text-[var(--navy)] text-center pt-2 transition-colors`}
        >
          +{extra} documento{extra !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}

// Vista "Por categoria" (cartões por colaborador) — mostra a lista já
// filtrada (categoria/estado/pesquisa) agrupada por trabalhador, com quem
// tem algo por resolver sempre primeiro. Substitui a antiga tabela única
// (DocumentsTable.jsx, mantida no repo mas já sem consumidor) por decisão
// de reorganização (2026-08-31) — ver CLAUDE.md.
//
// "+N documentos" abre a pasta completa do trabalhador (todas as
// categorias, não só a filtrada) — reaproveita WorkerPastaView tal como a
// vista "Por colaborador" usa, dentro de um ModalShell em vez de navegar
// para lá, para não perder o filtro de categoria em que se estava.
export default function CategoryWorkerGrid({
  docs,
  allDocs,
  loadingDocs,
  onDeleteManual,
  onDeleteGenerated,
  onApprove,
  onPreview,
  onEditCategoria,
  approvingId,
  saving,
}) {
  const [openWorkerId, setOpenWorkerId] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  const workerGroups = useMemo(() => {
    const map = {};
    docs.forEach(d => {
      if (!map[d.workerId]) map[d.workerId] = { workerId: d.workerId, workerName: d.workerName, docs: [] };
      map[d.workerId].docs.push(d);
    });
    const groups = Object.values(map);
    groups.forEach(g => g.docs.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)));
    const needsAction = [];
    const resolved = [];
    groups.forEach(g => {
      (g.docs.some(d => ACTION_STATES.includes(d.state)) ? needsAction : resolved).push(g);
    });
    const byName = (a, b) => a.workerName.localeCompare(b.workerName, 'pt');
    return [...needsAction.sort(byName), ...resolved.sort(byName)];
  }, [docs]);

  // Pasta completa (todas as categorias) do trabalhador aberto — vem de
  // `allDocs` (lista total, não filtrada), não de `docs`.
  const openWorkerDocs = useMemo(() => {
    if (!openWorkerId || !allDocs) return null;
    const wDocs = allDocs.filter(d => d.workerId === openWorkerId);
    if (wDocs.length === 0) return null;
    return { workerId: openWorkerId, workerName: wDocs[0].workerName, docs: wDocs };
  }, [openWorkerId, allDocs]);

  const handleOpenDoc = (doc) => {
    const url = doc.signedPdfUrl || doc.viewUrl || null;
    if (url) setPreviewDoc({ ...doc, previewUrl: url });
    else if (onPreview) onPreview(doc.raw);
    else setPreviewDoc({ ...doc, previewUrl: null });
  };

  const handleDelete = (doc) => {
    if (doc.source === 'manual') onDeleteManual?.(doc.raw);
    else onDeleteGenerated?.(doc.raw.id);
  };

  const actions = { onApprove, onPreview, onDeleteManual, onDeleteGenerated, onEditCategoria, approvingId, saving };

  if (loadingDocs && docs.length === 0) {
    return <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--slate)]" /></div>;
  }
  if (workerGroups.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="flex flex-col items-center gap-2 opacity-30">
          <FileText size={40} />
          <p className="text-xs font-black uppercase tracking-widest">Sem documentos</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(258px,1fr))]">
        {workerGroups.map(w => (
          <WorkerCard key={w.workerId} worker={w} docs={w.docs} onOpenFolder={setOpenWorkerId} {...actions} />
        ))}
      </div>

      <ModalShell
        isOpen={!!openWorkerDocs}
        onClose={() => setOpenWorkerId(null)}
        title={openWorkerDocs ? toSentenceCase(openWorkerDocs.workerName) : ''}
        meta={openWorkerDocs ? `${openWorkerDocs.docs.length} documento${openWorkerDocs.docs.length !== 1 ? 's' : ''}` : undefined}
        size="4xl"
        layer="viewer"
      >
        {openWorkerDocs && (
          <div className="p-4">
            <WorkerPastaView
              hideHeader
              worker={openWorkerDocs}
              docs={openWorkerDocs.docs}
              onBack={() => setOpenWorkerId(null)}
              onOpenDoc={handleOpenDoc}
              onDelete={handleDelete}
            />
          </div>
        )}
      </ModalShell>

      <DocumentViewerModal key={previewDoc?.id} doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  );
}
