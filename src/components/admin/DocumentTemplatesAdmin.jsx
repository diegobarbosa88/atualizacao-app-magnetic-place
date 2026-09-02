import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { FileText, Trash2, Eye, Edit3, Send, Loader2, ShieldCheck, Sliders } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadTemplateBytes } from '../../utils/docxTemplateService';
import DocxPreviewModal from '../common/DocxPreviewModal';
import { SCALE } from '../../styles/designTokens';
import TemplateEditorModal from './templates/TemplateEditorModal';
import Card, { CardGrid } from '../common/Card';
import { FONT_TITLE } from '../../styles/designTokens';
import TemplateGenerateModal from './templates/TemplateGenerateModal';
import TemplateLayoutSettingsModal from './templates/TemplateLayoutSettingsModal';

const DocumentTemplatesAdmin = forwardRef(function DocumentTemplatesAdmin({
  workers = [],
  templates = [],
  loading = false,
  saving = false,
  onUploadTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onGenerateDocuments,
  gateSlugsAtivos = new Set(),
  onToggleGateRequisito,
}, ref) {
  const { supabase, clients, systemSettings } = useApp();

  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(null);
  const [preview, setPreview] = useState(null);
  const [layoutTemplate, setLayoutTemplate] = useState(null);
  const [savingLayout, setSavingLayout] = useState(false);

  const workerById = useMemo(() => {
    const m = {};
    workers.forEach(w => { m[w.id] = w; });
    return m;
  }, [workers]);

  const openCreateModal = () => { setEditingTemplate(null); setShowEditorModal(true); };
  const openEditModal = (template) => { setEditingTemplate(template); setShowEditorModal(true); };
  const closeEditorModal = () => { setShowEditorModal(false); setEditingTemplate(null); };

  // O botão "+ Novo Template" vive agora no cabeçalho partilhado
  // (DocumentsAdmin.jsx), que não vê este estado local — expõe-se só a
  // abertura, sem tocar no contrato de props existente.
  useImperativeHandle(ref, () => ({ openCreate: openCreateModal }));

  const openTemplatePreview = async (template) => {
    // formato 'html': mostra o template tal como está gravado (tags
    // {worker_name} etc. ainda literais) — mesmo espírito do preview docx,
    // que também renderiza o .docx em bruto sem resolver campos.
    if (template.formato === 'html') {
      if (!template.template_html) {
        setPreview({ title: template.name, loading: false, blob: null, error: 'Este modelo não tem conteúdo HTML associado.' });
        return;
      }
      setPreview({ title: template.name, loading: false, blob: null, html: template.template_html, error: '' });
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

  const saveLayoutSettings = async (values) => {
    setSavingLayout(true);
    try {
      const { error } = await supabase
        .from('document_templates')
        .update({ layout_settings: values })
        .eq('id', layoutTemplate.id);
      if (error) throw error;
      setLayoutTemplate(null);
    } catch (err) {
      console.error('Erro a gravar ajustes de layout:', err);
      alert('Erro: ' + err.message);
    } finally {
      setSavingLayout(false);
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
      <div>
        {loading ? (
          <div className="py-16 text-center text-[var(--slate-dim)]">
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
                <div className="w-[38px] h-[38px] rounded-xl flex items-center justify-center mb-[0.7rem]" style={{ backgroundColor: '#f4f0fd', color: '#6743c2' }}>
                  <FileText size={17} />
                </div>
                <p className="text-[1.05rem] font-bold leading-[1.15] text-[var(--ink-mid)] truncate" style={{ fontFamily: FONT_TITLE }} title={t.name}>
                  {t.name}
                  {t.formato === 'html' && (
                    <span className="ml-2 align-middle text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600">HTML</span>
                  )}
                </p>
                <p className={`${SCALE.text.body} text-[var(--ink-soft)] mt-1 mb-3 line-clamp-3 min-h-[3rem]`}>
                  {t.description || <span className="italic text-[var(--slate-dim)]">Sem descrição</span>}
                </p>
                <div className="flex items-center gap-1 pt-[0.7rem] border-t border-[#F1EFE8]">
                  {/* Pré-visualizar funciona para docx e html — só o Editar
                      (TemplateEditorModal, calibração de carimbo por
                      coordenadas) é específico de docx e fica de fora. */}
                  <button onClick={() => openTemplatePreview(t)} className="p-1.5 rounded-lg transition-all text-[var(--slate)] hover:text-[var(--navy)] hover:bg-[var(--surface)]" title="Pré-visualizar"><Eye className="w-3.5 h-3.5" /></button>
                  {t.formato !== 'html' && (
                    <button onClick={() => openEditModal(t)} className="p-1.5 rounded-lg transition-all text-[var(--slate)] hover:text-[var(--navy)] hover:bg-[var(--surface)]" title="Editar"><Edit3 className="w-3.5 h-3.5" /></button>
                  )}
                  {t.formato === 'html' && (
                    <button onClick={() => setLayoutTemplate(t)} className="p-1.5 rounded-lg transition-all text-[var(--slate)] hover:text-[var(--navy)] hover:bg-[var(--surface)]" title="Ajustar Layout"><Sliders className="w-3.5 h-3.5" /></button>
                  )}
                  <button onClick={() => openGenerateModal(t)} className="p-1.5 rounded-lg transition-all text-[var(--slate)] hover:text-[var(--navy)] hover:bg-[var(--surface)]" title="Gerar"><Send className="w-3.5 h-3.5" /></button>
                  <button
                    onClick={() => onToggleGateRequisito?.(t)}
                    className={`p-1.5 rounded-lg transition-all ${t.slug && gateSlugsAtivos.has(t.slug) ? 'text-[var(--ok)] bg-[var(--ok-bg)]' : 'text-[var(--slate)] hover:text-[var(--navy)] hover:bg-[var(--surface)]'}`}
                    title={t.slug && gateSlugsAtivos.has(t.slug) ? 'Obrigatório no Gate de Onboarding — clicar para desligar' : 'Marcar como obrigatório no Gate de Onboarding'}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDeleteTemplate(t)} className="p-1.5 rounded-lg transition-all text-[var(--slate)] hover:text-[var(--bad)] hover:bg-[var(--bad-bg)] ml-auto" title="Apagar"><Trash2 className="w-3.5 h-3.5" /></button>
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

      {layoutTemplate && (
        <TemplateLayoutSettingsModal
          template={layoutTemplate}
          systemSettings={systemSettings}
          saving={savingLayout}
          onClose={() => setLayoutTemplate(null)}
          onSave={saveLayoutSettings}
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
});

export default DocumentTemplatesAdmin;
