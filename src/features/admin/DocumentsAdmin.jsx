import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, FileSignature, Users, ScanSearch, Plus, AlertTriangle } from 'lucide-react';
import DocumentTemplatesAdmin from '../../components/admin/DocumentTemplatesAdmin';
import DocxPreviewModal from '../../components/common/DocxPreviewModal';
import { getValidadeStatus, CATEGORIAS_RH_ACT, isUncategorized, SEM_CATEGORIA } from '../../constants/rhCategories';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';
import Card from "../../components/common/Card";
import { FT, SCALE, FONT_MONO } from '../../styles/designTokens';
import DocumentScannerModal from './team/DocumentScannerModal';

import DocumentsFilters from './documents/DocumentsFilters';
import CategoryWorkerGrid from './documents/CategoryWorkerGrid';
import UploadManualModal from './documents/UploadManualModal';
import WorkerDocsFolderView from './documents/WorkerDocsFolderView';
import { useDocumentsAdmin } from './documents/useDocumentsAdmin';

// Cartão de estatística com faixa lateral de cor semântica — em vez das
// pills discretas de SectionHeaderShell.stats (usadas por ~19 secções do
// admin), que não têm este peso visual. Construído localmente para não
// alterar esse componente partilhado.
function StatCard({ label, value, tone, active, onClick }) {
  const toneColor = { warn: 'var(--warn)', ok: 'var(--ok)', bad: 'var(--bad)', neutral: 'var(--slate)' }[tone];
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 min-w-[140px] text-left bg-white rounded-xl border overflow-hidden pl-4 pr-3 py-2.5 transition-all ${active ? 'border-[var(--border)] shadow-sm' : 'border-[var(--border-soft)] hover:border-[var(--border)]'}`}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: toneColor }} />
      <span className={`${SCALE.text.statValue} block text-[var(--ink)]`} style={{ fontFamily: FONT_MONO }}>{value}</span>
      <span className={`${SCALE.text.meta} text-[var(--slate-dim)]`}>{label}</span>
    </button>
  );
}

// Rail vertical de categorias — substitui o dropdown de categoria dentro dos
// filtros. Contagens vêm do total de documentos (unifiedDocs), não do
// resultado já filtrado por outros critérios, para não oscilar consoante o
// estado/fonte/tipo selecionados.
// "Sem categoria / a rever" fica fixo logo a seguir a "Todas", com destaque
// de aviso — agrupa tanto documentos sem categoria como os com um valor de
// categoria que já não existe na lista oficial (ver isUncategorized). Antes
// destes ficarem invisíveis em qualquer item da rail, só apareciam a rever
// "Todas" linha a linha (achado real, 2026-08-31 — ver CLAUDE.md).
function CategoryRail({ categories, counts, total, semCategoriaCount, active, onSelect }) {
  const itemCls = (isActive, warn) =>
    `w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left border-t border-[var(--border-soft)] first:border-t-0 transition-colors ${SCALE.text.body} ${
      isActive
        ? (warn ? 'bg-[var(--warn-bg)] text-[var(--warn)] font-bold' : 'bg-[var(--navy-soft)] text-[var(--navy)] font-bold')
        : (warn ? 'text-[var(--warn)] hover:bg-[var(--warn-bg)]' : 'text-[var(--ink-soft)] hover:bg-[var(--surface)]')
    }`;
  return (
    <div className="md:w-56 shrink-0 bg-white rounded-xl border border-[var(--border-soft)] overflow-hidden h-fit">
      <button onClick={() => onSelect('')} className={itemCls(!active)}>
        <span>Todas</span>
        <span className={SCALE.text.meta}>{total}</span>
      </button>
      <button onClick={() => onSelect(SEM_CATEGORIA)} className={itemCls(active === SEM_CATEGORIA, true)}>
        <span className="flex items-center gap-1.5 truncate"><AlertTriangle size={12} /> Sem categoria / a rever</span>
        <span className={SCALE.text.meta} style={active === SEM_CATEGORIA ? undefined : { backgroundColor: 'var(--warn-bg)' }}>{semCategoriaCount}</span>
      </button>
      {categories.map(cat => (
        <button key={cat} onClick={() => onSelect(cat)} className={itemCls(active === cat)}>
          <span className="truncate">{cat}</span>
          <span className={SCALE.text.meta}>{counts[cat] || 0}</span>
        </button>
      ))}
    </div>
  );
}

export default function DocumentsAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const a = useDocumentsAdmin();
  const templatesRef = useRef(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Contagens por categoria exata — documentos sem categoria (ou com valor
  // fora da lista oficial) já não caem em "Outros" por omissão, ficam à
  // parte em semCategoriaCount (achado real, 2026-08-31 — antes o rail
  // mostrava a contagem de "Outros" inflacionada com estes, mas clicar em
  // "Outros" não os mostrava, porque o filtro real compara igualdade exata).
  const categoryCounts = useMemo(() => {
    const c = {};
    a.unifiedDocs.forEach(d => { if (!isUncategorized(d.categoria)) c[d.categoria] = (c[d.categoria] || 0) + 1; });
    return c;
  }, [a.unifiedDocs]);
  const semCategoriaCount = useMemo(
    () => a.unifiedDocs.filter(d => isUncategorized(d.categoria)).length,
    [a.unifiedDocs]
  );

  const activeSection = useMemo(() => {
    const parts = location.pathname.replace(/^\/admin\/documentos\/?/, '').split('/').filter(Boolean);
    return parts[0] || 'documentos';
  }, [location.pathname]);

  const navigateTo = (sectionId) => navigate(`/admin/documentos/${sectionId}`);

  const goMode = (mode) => { a.setDocMode(mode); navigateTo('documentos'); };
  const goStat = (opts) => {
    if (opts.stateFilter !== undefined) a.setStateFilter(opts.stateFilter);
    if (opts.validadeFilter !== undefined) a.setValidadeFilter(opts.validadeFilter);
    goMode('category');
  };

  const expiringCount = a.unifiedDocs.filter(d => ['expirado', 'urgente'].includes(getValidadeStatus(d.data_validade))).length;
  const activeTabId = activeSection === 'templates' ? 'templates' : a.docMode;

  const headerAction = activeTabId === 'templates' ? (
    <button
      onClick={() => templatesRef.current?.openCreate()}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg shadow-sm transition-all ${SCALE.text.badge}`}
      style={{ backgroundColor: FT.orange, color: '#12293e' }}
    >
      <Plus size={14} /> Novo Template
    </button>
  ) : activeTabId === 'worker' ? (
    <button
      onClick={() => setScannerOpen(true)}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-2 hover:bg-[var(--surface)] transition-all ${SCALE.text.badge}`}
      style={{ borderColor: FT.slate, color: 'var(--ink-soft)' }}
    >
      <ScanSearch size={14} /> Scanner
    </button>
  ) : (
    <button
      onClick={() => a.setShowUploadModal(true)}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg shadow-sm transition-all ${SCALE.text.badge}`}
      style={{ backgroundColor: FT.orange, color: '#12293e' }}
    >
      <Plus size={14} /> Adicionar
    </button>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <DocumentScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} />
      <SectionHeaderShell
        icon={<FileText size={18} />}
        title="Documentos"
        subtitle="Gestão documental da equipa"
        tabs={[
          { id: 'worker',    label: 'Por colaborador', icon: Users },
          { id: 'category',  label: 'Por categoria',   icon: FileText },
          { id: 'templates', label: 'Templates',       icon: FileSignature },
        ]}
        activeTab={activeTabId}
        onTabChange={(id) => (id === 'templates' ? navigateTo('templates') : goMode(id))}
        rightSlot={headerAction}
      />

      {/* Cartões de estatística — faixa lateral de cor semântica em vez de
          brancos iguais; clicáveis, saltam para Por categoria já filtrado. */}
      <div className="flex flex-wrap gap-3 mb-5">
        <StatCard
          label="Pendentes" value={a.counts.pending || 0} tone="warn"
          active={activeSection === 'documentos' && a.docMode === 'category' && a.stateFilter === 'pending'}
          onClick={() => goStat({ stateFilter: 'pending' })}
        />
        <StatCard
          label="Aguarda aprovação" value={a.counts.awaiting_admin || 0} tone="neutral"
          active={activeSection === 'documentos' && a.docMode === 'category' && a.stateFilter === 'awaiting_admin'}
          onClick={() => goStat({ stateFilter: 'awaiting_admin' })}
        />
        <StatCard
          label="Assinados" value={a.counts.signed || 0} tone="ok"
          active={activeSection === 'documentos' && a.docMode === 'category' && a.stateFilter === 'signed'}
          onClick={() => goStat({ stateFilter: 'signed' })}
        />
        <StatCard
          label="A expirar / expirados" value={expiringCount} tone="bad"
          active={activeSection === 'documentos' && a.docMode === 'category' && a.validadeFilter === 'expiring'}
          onClick={() => goStat({ stateFilter: 'all', validadeFilter: 'expiring' })}
        />
      </div>

      {activeSection === 'templates' && (
        <Card>
          <DocumentTemplatesAdmin
            ref={templatesRef}
            workers={a.workers}
            systemSettings={a.systemSettings}
            templates={a.templates}
            loading={a.loadingTemplates}
            saving={a.saving}
            onUploadTemplate={a.handleUploadTemplate}
            onUpdateTemplate={a.handleUpdateTemplate}
            onDeleteTemplate={a.handleDeleteTemplate}
            onGenerateDocuments={a.handleGenerateDocuments}
            gateSlugsAtivos={a.gateSlugsAtivos}
            onToggleGateRequisito={a.handleToggleGateRequisito}
          />
        </Card>
      )}

      {activeSection === 'documentos' && (
        <>
          {/* Modo: Por categoria — rail de categorias à esquerda + filtros/tabela */}
          {a.docMode === 'category' && (
            <div className="flex flex-col md:flex-row gap-4">
              <CategoryRail
                categories={CATEGORIAS_RH_ACT}
                counts={categoryCounts}
                total={a.unifiedDocs.length}
                semCategoriaCount={semCategoriaCount}
                active={a.categoriaFilter}
                onSelect={a.setCategoriaFilter}
              />
              <div className="flex-1 min-w-0">
                <DocumentsFilters
                  stateFilter={a.stateFilter}
                  setStateFilter={a.setStateFilter}
                  counts={a.counts}
                  searchTerm={a.searchTerm}
                  setSearchTerm={a.setSearchTerm}
                  sourceFilter={a.sourceFilter}
                  setSourceFilter={a.setSourceFilter}
                  tipoFilter={a.tipoFilter}
                  setTipoFilter={a.setTipoFilter}
                  tipoOptions={a.tipoOptions}
                  validadeFilter={a.validadeFilter}
                  setValidadeFilter={a.setValidadeFilter}
                />

                <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-4`}>
                  {a.filteredDocs.length} documento{a.filteredDocs.length !== 1 ? 's' : ''}
                </p>

                <CategoryWorkerGrid
                  docs={a.filteredDocs}
                  allDocs={a.unifiedDocs}
                  loadingDocs={a.loadingDocs}
                  onDeleteManual={a.handleDeleteManual}
                  onDeleteGenerated={a.handleDeleteGenerated}
                  onApprove={a.onApprove}
                  onPreview={a.openGeneratedPreview}
                  onEditCategoria={a.handleEditCategoria}
                  approvingId={a.approvingId}
                  saving={a.saving}
                />
              </div>
            </div>
          )}

          {/* Modo: Por colaborador — grade de pessoas → subpastas de categoria */}
          {a.docMode === 'worker' && (
            <WorkerDocsFolderView
              docs={a.unifiedDocs}
              onPreview={a.openGeneratedPreview}
              onDeleteManual={a.handleDeleteManual}
              onDeleteGenerated={a.handleDeleteGenerated}
            />
          )}
        </>
      )}

      {a.showUploadModal && (
        <UploadManualModal
          workers={a.workers}
          uploading={a.uploading}
          selWorker={a.selWorker} setSelWorker={a.setSelWorker}
          selTipo={a.selTipo} setSelTipo={a.setSelTipo}
          selCategoria={a.selCategoria} setSelCategoria={a.setSelCategoria}
          selValidade={a.selValidade} setSelValidade={a.setSelValidade}
          selFile={a.selFile} setSelFile={a.setSelFile}
          onClose={() => a.setShowUploadModal(false)}
          onUpload={a.onUpload}
        />
      )}

      {a.preview && (
        <DocxPreviewModal
          title={a.preview.title}
          blob={a.preview.blob}
          html={a.preview.html}
          loading={a.preview.loading}
          error={a.preview.error}
          onClose={() => a.setPreview(null)}
        />
      )}
    </div>
  );
}
