import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, FileSignature, Users } from 'lucide-react';
import DocumentTemplatesAdmin from '../../components/admin/DocumentTemplatesAdmin';
import DocxPreviewModal from '../../components/common/DocxPreviewModal';
import { getValidadeStatus } from '../../constants/rhCategories';

import DocumentsFilters from './documents/DocumentsFilters';
import DocumentsTable from './documents/DocumentsTable';
import UploadManualModal from './documents/UploadManualModal';
import WorkerDocsFolderView from './documents/WorkerDocsFolderView';
import { useDocumentsAdmin } from './documents/useDocumentsAdmin';

const CARD_CLS = "bg-white rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 lg:p-8 shadow-sm border border-slate-100";

// Cartão de estatística clicável — filtra a lista e serve de resumo do
// estado geral sem ter de ler a tabela toda. Substitui as tabs de estado
// com contador "(n)" que existiam soltas dentro de DocumentsFilters.
function StatCard({ label, value, colorText, dotColor, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white border rounded-2xl px-4 py-3 transition-all ${active ? 'border-[#EB8D00] ring-2 ring-[#EB8D00]/25' : 'border-slate-100 hover:border-slate-200'}`}
    >
      <span className="inline-block w-2 h-2 rounded-full mb-1.5" style={{ backgroundColor: dotColor }} />
      <p className="text-xl font-black tabular-nums leading-none" style={{ color: colorText }}>{value}</p>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">{label}</p>
    </button>
  );
}

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
  const breadcrumbLabel = activeSection === 'templates' ? 'Templates' : (a.docMode === 'worker' ? 'Por colaborador' : 'Por categoria');

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Cabeçalho navy — navegação unificada (antes: 2 linhas de tabs sobrepostas) + stat strip */}
      <div className="rounded-2xl sm:rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 mb-5">
        <div className="px-5 sm:px-8 py-5" style={{ background: 'linear-gradient(135deg, #1B3A57 0%, #12293e 100%)' }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-white font-black text-base uppercase tracking-tight leading-none">Documentos</h2>
                <p className="text-[11px] text-[#b7c8d8] font-semibold mt-0.5">Gestão documental da equipa</p>
              </div>
            </div>
            <div className="flex bg-white/10 rounded-xl p-1 gap-1">
              {[
                { id: 'worker',    label: 'Por colaborador', icon: Users,         onClick: () => goMode('worker') },
                { id: 'category',  label: 'Por categoria',   icon: FileText,      onClick: () => goMode('category') },
                { id: 'templates', label: 'Templates',       icon: FileSignature, onClick: () => navigateTo('templates') },
              ].map(({ id, label, icon: Icon, onClick }) => {
                const isActive = activeSection === 'templates' ? id === 'templates' : (activeSection === 'documentos' && a.docMode === id);
                return (
                  <button
                    key={id}
                    onClick={onClick}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all whitespace-nowrap ${
                      isActive ? 'bg-white text-[#1B3A57]' : 'text-[#b7c8d8] hover:text-white'
                    }`}
                  >
                    <Icon size={12} /> {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-bold">
            <span className="text-[#8ea6bc]">Documentos</span>
            <span className="text-[#5c7590]">›</span>
            <span className="text-white">{breadcrumbLabel}</span>
          </div>
        </div>
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #EB8D00, #ffb444)' }} />

        {/* Stat strip — resumo do estado geral, clicável para filtrar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 sm:p-5 bg-slate-50">
          <StatCard
            label="Pendentes" value={a.counts.pending || 0}
            colorText="#92660a" dotColor="#e8a317"
            active={activeSection === 'documentos' && a.docMode === 'category' && a.stateFilter === 'pending'}
            onClick={() => goStat({ stateFilter: 'pending' })}
          />
          <StatCard
            label="Aguarda aprovação" value={a.counts.awaiting_admin || 0}
            colorText="#516375" dotColor="#869AAF"
            active={activeSection === 'documentos' && a.docMode === 'category' && a.stateFilter === 'awaiting_admin'}
            onClick={() => goStat({ stateFilter: 'awaiting_admin' })}
          />
          <StatCard
            label="Assinados" value={a.counts.signed || 0}
            colorText="#0d7a4b" dotColor="#1cb476"
            active={activeSection === 'documentos' && a.docMode === 'category' && a.stateFilter === 'signed'}
            onClick={() => goStat({ stateFilter: 'signed' })}
          />
          <StatCard
            label="A expirar / expirados" value={expiringCount}
            colorText="#b7273a" dotColor="#e2384f"
            active={activeSection === 'documentos' && a.docMode === 'category' && a.validadeFilter === 'expiring'}
            onClick={() => goStat({ stateFilter: 'all', validadeFilter: 'expiring' })}
          />
        </div>
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
