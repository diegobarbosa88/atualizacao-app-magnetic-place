import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, FileSignature, Users, AlertTriangle } from 'lucide-react';
import DocumentTemplatesAdmin from '../../components/admin/DocumentTemplatesAdmin';
import DocxPreviewModal from '../../components/common/DocxPreviewModal';
import { getValidadeStatus } from '../../constants/rhCategories';

import DocumentsFilters from './documents/DocumentsFilters';
import DocumentsTable from './documents/DocumentsTable';
import UploadManualModal from './documents/UploadManualModal';
import WorkerDocsFolderView from './documents/WorkerDocsFolderView';
import { useDocumentsAdmin } from './documents/useDocumentsAdmin';

const SECTIONS = [
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'templates',  label: 'Templates',  icon: FileSignature },
];

const CARD_CLS = "bg-white rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 lg:p-8 shadow-sm border border-slate-100";

export default function DocumentsAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const a = useDocumentsAdmin();

  const activeSection = useMemo(() => {
    const parts = location.pathname.replace(/^\/admin\/documentos\/?/, '').split('/').filter(Boolean);
    return parts[0] || 'documentos';
  }, [location.pathname]);

  const navigateTo = (sectionId) => navigate(`/admin/documentos/${sectionId}`);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Secções — sublinhado laranja, mesmo padrão de Equipa */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl mb-5 w-full sm:w-auto inline-flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {SECTIONS.map(sec => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => navigateTo(sec.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                isActive ? 'bg-white text-[#1B3A57] shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon size={13} /> {sec.label}
            </button>
          );
        })}
      </div>

      {activeSection === 'templates' && (
        <div className={CARD_CLS}>
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
        </div>
      )}

      {activeSection === 'documentos' && (
        <>
          {/* Seletor de modo */}
          <div className="flex items-center gap-1 mb-4 border-b border-slate-100">
            {[
              { id: 'category', label: 'Por categoria', icon: FileText },
              { id: 'worker',   label: 'Por colaborador', icon: Users },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => a.setDocMode(id)}
                className={`flex items-center gap-1.5 px-3 pb-2.5 pt-1 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 -mb-px ${a.docMode === id ? 'border-[#EB8D00] text-[#1B3A57]' : 'border-transparent text-slate-400 hover:text-[#1B3A57]'}`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {/* Banner de alerta de validade — visível em ambos os modos */}
          {(() => {
            const expiring = a.unifiedDocs.filter(d => ['expirado', 'urgente'].includes(getValidadeStatus(d.data_validade)));
            return expiring.length > 0 ? (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                <p className="text-sm font-black text-red-700 flex-1">
                  {expiring.length} documento{expiring.length !== 1 ? 's' : ''} expirado{expiring.length !== 1 ? 's' : ''} ou a expirar em 30 dias
                </p>
                <button
                  onClick={() => { a.setValidadeFilter('expiring'); a.setDocMode('category'); }}
                  className="text-xs font-black text-red-600 underline hover:text-red-800 transition-colors whitespace-nowrap"
                >
                  Ver todos →
                </button>
              </div>
            ) : null;
          })()}

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

            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
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
