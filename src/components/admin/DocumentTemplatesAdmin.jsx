import React, { useState, useMemo } from 'react';
import { FileText, Plus, Trash2, Eye, Edit3, Send, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadTemplateBytes } from '../../utils/docxTemplateService';
import DocxPreviewModal from '../common/DocxPreviewModal';
import TemplateEditorModal from './templates/TemplateEditorModal';
import Card, { CardGrid } from '../common/Card';
import { FONT_TITLE } from '../../styles/designTokens';
import TemplateGenerateModal from './templates/TemplateGenerateModal';

export default function DocumentTemplatesAdmin({
  workers = [],
  templates = [],
  loading = false,
  saving = false,
  onUploadTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onGenerateDocuments,
}) {
  const { supabase, clients } = useApp();

  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(null);
  const [preview, setPreview] = useState(null);

  const workerById = useMemo(() => {
    const m = {};
    workers.forEach(w => { m[w.id] = w; });
    return m;
  }, [workers]);

  const openCreateModal = () => { setEditingTemplate(null); setShowEditorModal(true); };
  const openEditModal = (template) => { setEditingTemplate(template); setShowEditorModal(true); };
  const closeEditorModal = () => { setShowEditorModal(false); setEditingTemplate(null); };

  const openTemplatePreview = async (template) => {
    if (!template.template_docx_path && !template.template_pdf_path && template.html_content) {
      setPreview({ title: template.name, loading: false, blob: null, html: template.html_content, error: '' });
      return;
    }
    setPreview({ title: template.name, loading: true, blob: null, error: '' });
    try {
      if (!template.template_docx_path) throw new Error('Este modelo não tem ficheiro .docx associado.');
      const buffer = await downloadTemplateBytes(supabase, template.template_docx_path);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      setPreview({ title: template.name, loading: false, blob, error: '' });
    } catch (err) {
      console.error('Falha a abrir preview de template:', err);
      setPreview({ title: template.name, loading: false, blob: null, error: err.message || 'Erro a carregar template.' });
    }
  };

  const openGenerateModal = (template) => {
    setSelectedTemplate(template);
    setSelectedWorkers([]);
    setSelectedClientId('');
    setShowGenerateModal(true);
  };

  const submitGenerate = async () => {
    if (!selectedTemplate || selectedWorkers.length === 0) return;
    setGenerating(true);
    setGenProgress({ current: 0, total: selectedWorkers.length, workerName: '', status: 'pending' });
    try {
      const res = await onGenerateDocuments(selectedTemplate, selectedWorkers, {
        workersById: workerById,
        clientId: selectedClientId || null,
        onProgress: (p) => setGenProgress(p),
      });
      const parts = [`${res.succeeded}/${res.total} documento(s) gerado(s)`];
      if (res.emailsSent > 0) parts.push(`${res.emailsSent} email(s) enviado(s)`);
      if (res.emailsSkipped > 0) parts.push(`${res.emailsSkipped} sem email`);
      if (res.failed > 0) parts.push(`${res.failed} falha(s)`);
      alert(parts.join(' · '));
      setShowGenerateModal(false);
      setSelectedTemplate(null);
      setSelectedWorkers([]);
    } catch (err) {
      console.error('Erro a gerar:', err);
      alert('Erro: ' + err.message);
    } finally {
      setGenerating(false);
      setGenProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Templates de Documentos</h2>
          <p className="text-sm text-slate-500 mt-1">Templates Word (.docx) com variáveis preenchidas automaticamente.</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 text-white font-bold rounded-xl hover:opacity-90" style={{ backgroundColor: '#EB8D00', color: '#1B3A57' }}>
          <Plus className="w-4 h-4" /> Novo Template
        </button>
      </div>

      <div>
        {loading ? (
          <div className="py-16 text-center text-slate-300">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : templates.length === 0 ? (
          <div className="py-20 text-center">
            <div className="flex flex-col items-center gap-2 opacity-30">
              <FileText size={40} />
              <p className="text-xs font-black uppercase tracking-widest">Sem templates</p>
            </div>
          </div>
        ) : (
          <CardGrid>
            {templates.map(t => (
              <Card key={t.id} variant="item" interactive>
                <div className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center mb-[0.7rem]" style={{ backgroundColor: '#f4f0fd', color: '#6743c2' }}>
                  <FileText size={17} />
                </div>
                <p className="text-[1.05rem] font-bold leading-[1.15] text-[#28323c] truncate" style={{ fontFamily: FONT_TITLE }} title={t.name}>{t.name}</p>
                <p className="text-[11px] font-semibold text-[#5c6a76] mt-1 mb-3 line-clamp-2 min-h-[2rem]">
                  {t.description || <span className="italic text-slate-300">Sem descrição</span>}
                </p>
                <div className="flex items-center gap-1.5 pt-[0.7rem] border-t border-[#F1EFE8]">
                  <button onClick={() => openTemplatePreview(t)} className="p-1.5 bg-white text-slate-500 rounded-lg border border-slate-200 hover:bg-slate-600 hover:text-white transition-all" title="Pré-visualizar"><Eye className="w-3.5 h-3.5" /></button>
                  <button onClick={() => openEditModal(t)} className="p-1.5 bg-white rounded-lg border border-slate-200 text-[#869AAF] hover:bg-[#869AAF] hover:text-white transition-all" title="Editar"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => openGenerateModal(t)} className="p-1.5 bg-white rounded-lg border border-slate-200 text-[#869AAF] hover:bg-[#869AAF] hover:text-white transition-all" title="Gerar"><Send className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDeleteTemplate(t)} className="p-1.5 bg-white text-rose-500 rounded-lg border border-rose-100 hover:bg-rose-500 hover:text-white transition-all ml-auto" title="Apagar"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </Card>
            ))}
          </CardGrid>
        )}
      </div>

      {showEditorModal && (
        <TemplateEditorModal
          template={editingTemplate}
          supabase={supabase}
          onClose={closeEditorModal}
          saving={saving}
          onSave={async (data) => {
            try {
              if (editingTemplate) {
                await onUpdateTemplate({ id: editingTemplate.id, oldDocxPath: editingTemplate.template_docx_path, ...data });
              } else {
                await onUploadTemplate(data);
              }
              closeEditorModal();
            } catch (err) {
              throw err;
            }
          }}
        />
      )}

      {showGenerateModal && selectedTemplate && (
        <TemplateGenerateModal
          template={selectedTemplate}
          workers={workers}
          clients={clients}
          selectedWorkers={selectedWorkers} setSelectedWorkers={setSelectedWorkers}
          selectedClientId={selectedClientId} setSelectedClientId={setSelectedClientId}
          generating={generating}
          genProgress={genProgress}
          onClose={() => { setShowGenerateModal(false); setSelectedTemplate(null); setSelectedWorkers([]); }}
          onSubmit={submitGenerate}
        />
      )}

      {preview && (
        <DocxPreviewModal
          title={preview.title}
          blob={preview.blob}
          html={preview.html}
          loading={preview.loading}
          error={preview.error}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
