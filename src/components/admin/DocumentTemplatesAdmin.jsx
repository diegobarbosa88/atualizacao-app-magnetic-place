import React, { useState, useMemo } from 'react';
import { FileText, Plus, Trash2, Eye, Edit3, Send, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useDocumentTemplates } from '../../hooks/useDocumentTemplates';
import { downloadTemplateBytes } from '../../utils/docxTemplateService';
import DocxPreviewModal from '../common/DocxPreviewModal';
import TemplateEditorModal from './templates/TemplateEditorModal';
import TemplateGenerateModal from './templates/TemplateGenerateModal';

export default function DocumentTemplatesAdmin({ workers = [] }) {
  const { supabase, clients } = useApp();
  const {
    templates,
    loading,
    saving,
    handleUploadTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    handleGenerateDocuments,
  } = useDocumentTemplates(supabase);

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
    setPreview({ title: template.name, loading: true, blob: null, error: '' });
    try {
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
      const res = await handleGenerateDocuments(selectedTemplate, selectedWorkers, {
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
        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Novo Template
        </button>
      </div>

      <div className="overflow-x-auto -mx-2">
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
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-slate-400">
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Nome</th>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Descrição</th>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id} className="bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300">
                  <td className="px-4 py-3 rounded-l-2xl border-y border-l border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="text-sm font-black text-slate-800 truncate">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-y border-slate-100 text-xs text-slate-500 max-w-[200px] truncate">
                    {t.description || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 rounded-r-2xl border-y border-r border-slate-100 text-right">
                    <div className="flex justify-end items-center gap-1">
                      <button onClick={() => openTemplatePreview(t)} className="p-2 bg-white text-slate-500 rounded-xl border border-slate-100 hover:bg-slate-600 hover:text-white transition-all shadow-sm" title="Pré-visualizar"><Eye className="w-3 h-3" /></button>
                      <button onClick={() => openEditModal(t)} className="p-1.5 bg-white text-purple-600 rounded-lg border border-purple-100 hover:bg-purple-600 hover:text-white transition-all shadow-sm" title="Editar"><Edit3 className="w-3 h-3" /></button>
                      <button onClick={() => openGenerateModal(t)} className="p-1.5 bg-white text-emerald-600 rounded-lg border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm" title="Gerar"><Send className="w-3 h-3" /></button>
                      <button onClick={() => handleDeleteTemplate(t)} className="p-1.5 bg-white text-rose-500 rounded-lg border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm" title="Apagar"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                await handleUpdateTemplate({ id: editingTemplate.id, oldDocxPath: editingTemplate.template_docx_path, ...data });
              } else {
                await handleUploadTemplate(data);
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
          loading={preview.loading}
          error={preview.error}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
