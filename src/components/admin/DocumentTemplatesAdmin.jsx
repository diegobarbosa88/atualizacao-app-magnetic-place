import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText, Plus, Trash2, X, Upload, Send, Users, Loader2, Download,
  Search, CheckCircle, Clock, FileSignature, AlertCircle, Eye, Edit3,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useDocumentTemplates } from '../../hooks/useDocumentTemplates';
import { isSigned } from '../../constants/documentStatus';
import {
  KNOWN_FIELD_NAMES,
  isKnownField,
  extractTags,
  readFileAsArrayBuffer,
  downloadTemplateBytes,
  renderDocx,
  buildRenderData,
} from '../../utils/docxTemplateService';
import { convertDocxToPdf } from '../../utils/pdfCoService';
import { PDFDocument } from 'pdf-lib';
import DocxPreviewModal from '../common/DocxPreviewModal';

export default function DocumentTemplatesAdmin({ workers = [] }) {
  const { supabase, systemSettings } = useApp();
  const {
    templates,
    generatedDocs,
    loading,
    loadingDocs,
    saving,
    handleUploadTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    handleGenerateDocuments,
    handleDownloadGenerated,
    handleDeleteDoc,
  } = useDocumentTemplates(supabase);

  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null); // null = criar novo, objeto = editar
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(null);

  const [preview, setPreview] = useState(null);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setShowEditorModal(true);
  };

  const openEditModal = (template) => {
    setEditingTemplate(template);
    setShowEditorModal(true);
  };

  const closeEditorModal = () => {
    setShowEditorModal(false);
    setEditingTemplate(null);
  };

  const openTemplatePreview = async (template) => {
    setPreview({ title: template.name, loading: true, blob: null, error: '' });
    try {
      const buffer = await downloadTemplateBytes(supabase, template.template_docx_path);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      setPreview({ title: template.name, loading: false, blob, error: '' });
    } catch (err) {
      console.error('Falha a abrir preview de template:', err);
      setPreview({ title: template.name, loading: false, blob: null, error: err.message || 'Erro a carregar template.' });
    }
  };

  const openGeneratedDocPreview = async (doc) => {
    const workerName = workerById[doc.worker_id]?.name || '';
    const title = `${doc.title}${workerName ? ` — ${workerName}` : ''}`;
    setPreview({ title, loading: true, blob: null, error: '' });
    try {
      if (!doc.template_id) throw new Error('Documento sem template associado.');
      const { data: tmpl, error: tErr } = await supabase
        .from('document_templates').select('*').eq('id', doc.template_id).single();
      if (tErr) throw tErr;
      if (!tmpl?.template_docx_path) throw new Error('Template sem ficheiro .docx');

      const { data: worker, error: wErr } = await supabase
        .from('workers').select('*').eq('id', doc.worker_id).single();
      if (wErr) throw wErr;

      const buffer = await downloadTemplateBytes(supabase, tmpl.template_docx_path);
      const renderData = buildRenderData(worker || {}, systemSettings || {});
      const filledBlob = renderDocx(buffer, renderData);
      setPreview({ title, loading: false, blob: filledBlob, error: '' });
    } catch (err) {
      console.error('Falha a abrir preview de doc gerado:', err);
      setPreview({ title, loading: false, blob: null, error: err.message || 'Erro a carregar documento.' });
    }
  };

  const [docSearch, setDocSearch] = useState('');
  const [docFilter, setDocFilter] = useState('all');

  const workerById = useMemo(() => {
    const m = {};
    workers.forEach(w => { m[w.id] = w; });
    return m;
  }, [workers]);

  const filteredDocs = useMemo(() => {
    return generatedDocs.filter(doc => {
      if (docFilter === 'signed' && !isSigned(doc.status)) return false;
      if (docFilter === 'pending' && isSigned(doc.status)) return false;
      if (docSearch) {
        const q = docSearch.toLowerCase();
        const w = workerById[doc.worker_id];
        const title = (doc.title || '').toLowerCase();
        const wname = (w?.name || '').toLowerCase();
        if (!title.includes(q) && !wname.includes(q)) return false;
      }
      return true;
    });
  }, [generatedDocs, docFilter, docSearch, workerById]);

  const openGenerateModal = (template) => {
    setSelectedTemplate(template);
    setSelectedWorkers([]);
    setShowGenerateModal(true);
  };

  const submitGenerate = async () => {
    if (!selectedTemplate || selectedWorkers.length === 0) return;
    setGenerating(true);
    setGenProgress({ current: 0, total: selectedWorkers.length, workerName: '', status: 'pending' });
    try {
      const res = await handleGenerateDocuments(selectedTemplate, selectedWorkers, {
        workersById: workerById,
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
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Novo Template
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-700">Templates Disponíveis</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Nenhum template ainda. Faz upload de um PDF preenchível para começar.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {templates.map(t => (
              <li key={t.id} className="p-4 flex items-start gap-4 hover:bg-slate-50">
                <FileText className="w-10 h-10 text-indigo-500 flex-shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h4 className="font-bold text-slate-800 truncate">{t.name}</h4>
                    <span className="text-xs text-slate-400">{(t.template_fields || []).length} campos</span>
                  </div>
                  {t.description && <p className="text-xs text-slate-500 mt-1">{t.description}</p>}
                  {(t.template_fields || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(t.template_fields || []).map(name => (
                        <FieldBadge key={name} name={name} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => openTemplatePreview(t)}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                    title="Pré-visualizar template (sem dados)"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => openEditModal(t)}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100"
                    title="Editar template e posição do carimbo"
                  >
                    <Edit3 className="w-3 h-3" /> Editar
                  </button>
                  <button
                    onClick={() => openGenerateModal(t)}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100"
                  >
                    <Send className="w-3 h-3" /> Gerar
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(t)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                    title="Apagar template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-bold text-slate-700">Documentos Gerados</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={docSearch}
                onChange={e => setDocSearch(e.target.value)}
                placeholder="Procurar..."
                className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-48 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <select
              value={docFilter}
              onChange={e => setDocFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendentes</option>
              <option value="signed">Assinados</option>
            </select>
          </div>
        </div>
        {loadingDocs ? (
          <div className="p-8 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Nenhum documento gerado.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredDocs.map(doc => {
              const worker = workerById[doc.worker_id];
              const signed = isSigned(doc.status);
              return (
                <li key={doc.id} className="p-4 flex items-center gap-4 hover:bg-slate-50">
                  {signed ? (
                    <CheckCircle className="w-8 h-8 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <Clock className="w-8 h-8 text-amber-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 truncate">{doc.title}</h4>
                    <p className="text-xs text-slate-500 truncate">
                      {worker?.name || 'Trabalhador desconhecido'} ·{' '}
                      {signed
                        ? `Assinado em ${doc.signed_at ? new Date(doc.signed_at).toLocaleString('pt-PT') : ''}`
                        : `Pendente desde ${new Date(doc.created_at).toLocaleDateString('pt-PT')}`}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => openGeneratedDocPreview(doc)}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                      title="Pré-visualizar com dados do trabalhador"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDownloadGenerated(doc, systemSettings).catch(err => alert('Erro: ' + err.message))}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                      title="Gerar .docx para este trabalhador"
                    >
                      <Download className="w-3 h-3" /> Word
                    </button>
                    {doc.signed_pdf_url && (
                      <a
                        href={doc.signed_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100"
                        title="Abrir PDF assinado"
                      >
                        <Download className="w-3 h-3" /> PDF
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showEditorModal && (
        <TemplateEditorModal
          template={editingTemplate}
          supabase={supabase}
          onClose={closeEditorModal}
          onSave={async (data) => {
            try {
              if (editingTemplate) {
                await handleUpdateTemplate({
                  id: editingTemplate.id,
                  oldDocxPath: editingTemplate.template_docx_path,
                  ...data,
                });
              } else {
                await handleUploadTemplate(data);
              }
              closeEditorModal();
            } catch (err) {
              throw err; // Propagar erro para o modal mostrar
            }
          }}
          saving={saving}
        />
      )}

      {showGenerateModal && selectedTemplate && (
        <Modal
          onClose={() => { setShowGenerateModal(false); setSelectedTemplate(null); setSelectedWorkers([]); }}
          title={`Gerar "${selectedTemplate.name}"`}
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Seleciona os trabalhadores que vão receber este documento. Será enviado um email se o trabalhador tiver email definido.
            </p>
            <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {workers.length === 0 ? (
                <div className="p-4 text-sm text-slate-400 text-center">Nenhum trabalhador na lista.</div>
              ) : workers.map(w => {
                const checked = selectedWorkers.includes(w.id);
                return (
                  <label key={w.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={generating}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedWorkers([...selectedWorkers, w.id]);
                        else setSelectedWorkers(selectedWorkers.filter(id => id !== w.id));
                      }}
                    />
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="text-sm flex-1">{w.name}</span>
                    {!w.email && (
                      <span className="text-[10px] font-bold text-amber-600" title="Sem email — não receberá notificação">
                        sem email
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {generating && genProgress && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    {genProgress.current} / {genProgress.total}
                  </span>
                  <span className="text-slate-500 truncate ml-2">
                    {genProgress.workerName && `A processar ${genProgress.workerName}...`}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{ width: `${(genProgress.current / Math.max(genProgress.total, 1)) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowGenerateModal(false); setSelectedTemplate(null); }}
                disabled={generating}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitGenerate}
                disabled={generating || selectedWorkers.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Gerar {selectedWorkers.length} documento(s)
              </button>
            </div>
          </div>
        </Modal>
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

function TemplateEditorModal({ template, supabase, onClose, onSave, saving }) {
  const isEditing = !!template;
  const fileInputRef = useRef(null);
  
  // Form state
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [file, setFile] = useState(null);
  const [previewFields, setPreviewFields] = useState(template?.template_fields || null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Stamp position state
  const [stampX, setStampX] = useState(template?.stamp_x ?? 130);
  const [stampY, setStampY] = useState(template?.stamp_y ?? 30);
  const [stampPage, setStampPage] = useState(template?.stamp_page || 'last');
  
  // PDF preview state
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Presets para posições comuns
  const presets = [
    { label: 'Inferior Direito', x: 130, y: 30 },
    { label: 'Inferior Esquerdo', x: 20, y: 30 },
    { label: 'Inferior Centro', x: 75, y: 30 },
    { label: 'Superior Direito', x: 130, y: 260 },
  ];

  // Gerar preview da última página do PDF (extraída isoladamente para posicionamento exato)
  useEffect(() => {
    let cancelled = false;
    let createdUrl = null;
    const generatePreview = async () => {
      const sourceFile = file;
      const existingPath = template?.template_docx_path;

      if (!sourceFile && !existingPath) {
        setPdfPreviewUrl(null);
        return;
      }

      setLoadingPreview(true);
      try {
        let docxBlob;
        if (sourceFile) {
          docxBlob = sourceFile;
        } else if (existingPath && supabase) {
          const buffer = await downloadTemplateBytes(supabase, existingPath);
          docxBlob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
        }

        if (cancelled || !docxBlob) return;

        // 1. Converter docx → PDF completo via PDF.co
        const fullPdfBlob = await convertDocxToPdf(docxBlob);
        if (cancelled) return;

        // 2. Extrair apenas a última página com pdf-lib para um PDF de uma página
        const fullPdfBytes = await fullPdfBlob.arrayBuffer();
        const fullPdf = await PDFDocument.load(fullPdfBytes);
        const lastIndex = fullPdf.getPageCount() - 1;

        const singlePagePdf = await PDFDocument.create();
        const [copiedPage] = await singlePagePdf.copyPages(fullPdf, [lastIndex]);
        singlePagePdf.addPage(copiedPage);
        const singlePageBytes = await singlePagePdf.save();
        if (cancelled) return;

        const singlePageBlob = new Blob([singlePageBytes], { type: 'application/pdf' });
        createdUrl = URL.createObjectURL(singlePageBlob);
        setPdfPreviewUrl(createdUrl);
      } catch (err) {
        console.error('Erro ao gerar preview PDF:', err);
        if (!cancelled) setPdfPreviewUrl(null);
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    };

    generatePreview();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file, template?.template_docx_path, supabase]);

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    setError('');
    if (!f) {
      setFile(null);
      if (!isEditing) setPreviewFields(null);
      return;
    }
    const isDocx = f.name.toLowerCase().endsWith('.docx')
      || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!isDocx) {
      setError('Apenas ficheiros Word (.docx) são suportados.');
      setFile(null);
      return;
    }
    setFile(f);
    if (!name.trim()) {
      setName(f.name.replace(/\.docx$/i, ''));
    }
    try {
      const buf = await readFileAsArrayBuffer(f);
      const tags = extractTags(buf);
      setPreviewFields(tags);
      if (tags.length === 0) {
        setError('Não foi encontrada nenhuma variável { } neste documento.');
      }
    } catch (err) {
      console.error('Erro a ler .docx:', err);
      setError('Não foi possível ler o ficheiro: ' + err.message);
    }
  };

  const handleSubmit = async () => {
    if (!isEditing && !file) {
      setError('Selecione um ficheiro .docx.');
      return;
    }
    if (!name.trim()) {
      setError('Nome é obrigatório.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSave({
        name,
        description,
        file: file || undefined,
        stamp_x: Number(stampX),
        stamp_y: Number(stampY),
        stamp_page: stampPage,
      });
    } catch (err) {
      console.error('Erro ao guardar:', err);
      setError('Erro ao guardar: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} title={isEditing ? `Editar Template` : 'Novo Template'} wide>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna esquerda: Formulário */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">Nome</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Contrato de Trabalho"
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">Descrição (opcional)</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Curta descrição interna"
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">
              Ficheiro Word (.docx) {isEditing && <span className="text-slate-400 font-normal">(opcional - substituir)</span>}
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="text-sm"
              />
            </div>
            {isEditing && !file && (
              <p className="text-xs text-slate-500 mt-1">Ficheiro atual será mantido se não selecionar um novo.</p>
            )}
          </div>

          {previewFields && previewFields.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Variáveis detetadas ({previewFields.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {previewFields.map(fname => <FieldBadge key={fname} name={fname} />)}
              </div>
            </div>
          )}

          {/* Posição do Carimbo */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-sm font-bold text-slate-700 mb-3">Posição do Carimbo</h4>
            
            {/* Presets */}
            <div className="mb-3">
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Posições Predefinidas</label>
              <div className="flex flex-wrap gap-2">
                {presets.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setStampX(p.x); setStampY(p.y); }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                      stampX === p.x && stampY === p.y
                        ? 'text-purple-700 bg-purple-100 border-purple-300'
                        : 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Coordenadas manuais */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">X (mm)</label>
                <input
                  type="number"
                  value={stampX}
                  onChange={e => setStampX(e.target.value)}
                  min={0}
                  max={210}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Y (mm)</label>
                <input
                  type="number"
                  value={stampY}
                  onChange={e => setStampY(e.target.value)}
                  min={0}
                  max={297}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Página</label>
                <select
                  value={stampPage}
                  onChange={e => setStampPage(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 text-sm"
                >
                  <option value="last">Última</option>
                  <option value="first">Primeira</option>
                  <option value="all">Todas</option>
                </select>
              </div>
            </div>
          </div>

          <details className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <summary className="text-xs font-bold uppercase tracking-wider text-slate-600 cursor-pointer">
              Variáveis disponíveis
            </summary>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto">
              {KNOWN_FIELD_NAMES.map(f => (
                <div key={f.name} className="flex items-baseline gap-2 text-xs">
                  <code className="font-mono text-indigo-600">{f.name}</code>
                  <span className="text-slate-500 truncate">{f.label}</span>
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* Coluna direita: Preview da última página em A4 fixo */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-700">Pré-visualização da Última Página</h4>

          <div
            className="bg-slate-100 rounded-xl p-2 mx-auto"
            style={{ aspectRatio: '210 / 297', maxWidth: '420px' }}
          >
            <div className="relative w-full h-full">
              {loadingPreview ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-xs">A gerar preview...</span>
                </div>
              ) : pdfPreviewUrl ? (
                <>
                  <iframe
                    src={`${pdfPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                    className="absolute inset-0 w-full h-full rounded-lg border border-slate-300 bg-white"
                    title="Preview última página"
                  />
                  {/* Overlay do carimbo: 70x25mm em A4 (210x297mm) */}
                  <div
                    className="absolute bg-purple-500/70 rounded text-white text-[10px] font-bold flex items-center justify-center pointer-events-none border-2 border-purple-700"
                    style={{
                      width: `${(70 / 210) * 100}%`,
                      height: `${(25 / 297) * 100}%`,
                      left: `${(stampX / 210) * 100}%`,
                      bottom: `${(stampY / 297) * 100}%`,
                    }}
                  >
                    CARIMBO
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <FileText className="w-12 h-12" />
                  <span className="text-xs text-center px-4">
                    {isEditing ? 'A carregar preview...' : 'Seleciona um ficheiro .docx para ver o preview'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <strong>Nota:</strong> O carimbo (70×25mm) é desenhado a partir do canto inferior-esquerdo (X, Y em mm). O QR é colocado automaticamente em todas as páginas — não precisa de posicionamento.
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-200">
        <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || saving || (!isEditing && !file)}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
        >
          {(submitting || saving) ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {isEditing ? 'Guardar Alterações' : 'Criar Template'}
        </button>
      </div>
    </Modal>
  );
}

function FieldBadge({ name }) {
  const known = isKnownField(name);
  return (
    <span
      className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold tracking-tight ${
        known
          ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
          : 'bg-amber-50 text-amber-700 border border-amber-100'
      }`}
      title={known ? 'Variável reconhecida' : 'Variável não reconhecida — não será preenchida automaticamente'}
    >
      {name}
    </span>
  );
}

function Modal({ onClose, title, children, wide = false }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-start justify-center p-4 overflow-y-auto">
      <div className={`bg-white w-full ${wide ? 'max-w-5xl' : 'max-w-2xl'} rounded-[2rem] p-6 shadow-2xl my-8`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-black text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
