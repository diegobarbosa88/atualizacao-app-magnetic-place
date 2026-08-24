import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, FileSignature, Users } from 'lucide-react';
import DocumentTemplatesAdmin from '../../components/admin/DocumentTemplatesAdmin';
import DocxPreviewModal from '../../components/common/DocxPreviewModal';
import { getValidadeStatus } from '../../constants/rhCategories';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';
import Card from "../../components/common/Card";
import { FT, SCALE } from '../../styles/designTokens';

import DocumentsFilters from './documents/DocumentsFilters';
import DocumentsTable from './documents/DocumentsTable';
import UploadManualModal from './documents/UploadManualModal';
import WorkerDocsFolderView from './documents/WorkerDocsFolderView';
import { useDocumentsAdmin } from './documents/useDocumentsAdmin';


export default function DocumentsAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const a = useDocumentsAdmin();

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

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
        stats={[
          {
            label: 'Pendentes', value: a.counts.pending || 0,
            colorText: '#92660a', dotColor: '#e8a317',
            active: activeSection === 'documentos' && a.docMode === 'category' && a.stateFilter === 'pending',
            onClick: () => goStat({ stateFilter: 'pending' }),
          },
          {
            label: 'Aguarda aprovação', value: a.counts.awaiting_admin || 0,
            colorText: '#516375', dotColor: FT.slate,
            active: activeSection === 'documentos' && a.docMode === 'category' && a.stateFilter === 'awaiting_admin',
            onClick: () => goStat({ stateFilter: 'awaiting_admin' }),
          },
          {
            label: 'Assinados', value: a.counts.signed || 0,
            colorText: '#0d7a4b', dotColor: '#1cb476',
            active: activeSection === 'documentos' && a.docMode === 'category' && a.stateFilter === 'signed',
            onClick: () => goStat({ stateFilter: 'signed' }),
          },
          {
            label: 'A expirar / expirados', value: expiringCount,
            colorText: '#b7273a', dotColor: '#e2384f',
            active: activeSection === 'documentos' && a.docMode === 'category' && a.validadeFilter === 'expiring',
            onClick: () => goStat({ stateFilter: 'all', validadeFilter: 'expiring' }),
          },
        ]}
      />

      {activeSection === 'templates' && (
        <Card>
          <DocumentTemplatesAdmin
            workers={a.workers}
            systemSettings={a.systemSettings}
            templates={a.templates}
            loading={a.loadingTemplates}
            saving={a.saving}
            onUploadTemplate={a.handleUploadTemplate}
            onUpdateTemplate={a.handleUpdateTemplate}
            onDeleteTemplate={a.handleDeleteTemplate}
            onGenerateDocuments={a.handleGenerateDocuments}
          />
        </Card>
      )}

      {activeSection === 'documentos' && (
        <>
          {/* Modo: Por categoria — lista plana de documentos, filtrável por estado/categoria */}
          {a.docMode === 'category' && (<>
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
              categoriaFilter={a.categoriaFilter}
              setCategoriaFilter={a.setCategoriaFilter}
              validadeFilter={a.validadeFilter}
              setValidadeFilter={a.setValidadeFilter}
              onShowUpload={() => a.setShowUploadModal(true)}
            />

            <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)] mb-4`}>
              {a.filteredDocs.length} documento{a.filteredDocs.length !== 1 ? 's' : ''}
            </p>

            <DocumentsTable
              filteredDocs={a.filteredDocs}
              loadingDocs={a.loadingDocs}
              sortKey={a.sortKey}
              sortDir={a.sortDir}
              onSort={a.handleSort}
              onDeleteManual={a.handleDeleteManual}
              onDeleteGenerated={a.handleDeleteGenerated}
              onApprove={a.onApprove}
              onPreview={a.openGeneratedPreview}
              onEditCategoria={a.handleEditCategoria}
              approvingId={a.approvingId}
              saving={a.saving}
            />
          </>)}

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
          loading={a.preview.loading}
          error={a.preview.error}
          onClose={() => a.setPreview(null)}
        />
      )}
    </div>
  );
}
