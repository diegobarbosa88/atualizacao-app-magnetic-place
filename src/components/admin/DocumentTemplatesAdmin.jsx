import React, { useState, useMemo, useRef } from 'react';
import {
  FileText, Plus, Trash2, X, Upload, Send, Users, Loader2, Download,
  Search, CheckCircle, Clock, FileSignature, AlertCircle, Eye,
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
    handleDeleteTemplate,
    handleGenerateDocuments,
    handleDownloadGenerated,
    handleDeleteDoc,
  } = useDocumentTemplates(supabase);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(null);

  const [preview, setPreview] = useState(null);

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

  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [previewFields, setPreviewFields] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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

  const resetUploadModal = () => {
    setShowUploadModal(false);
    setUploadName('');
    setUploadDescription('');
    setUploadFile(null);
    setPreviewFields(null);
    setPreviewError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    setPreviewError('');
    setPreviewFields(null);
    if (!f) {
      setUploadFile(null);
      return;
    }
    const isDocx = f.name.toLowerCase().endsWith('.docx')
      || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!isDocx) {
      setPreviewError('Apenas ficheiros Word (.docx) são suportados.');
      setUploadFile(null);
      return;
    }
    setUploadFile(f);
    if (!uploadName.trim()) {
      setUploadName(f.name.replace(/\.docx$/i, ''));
    }
    try {
      const buf = await readFileAsArrayBuffer(f);
      const tags = extractTags(buf);
      setPreviewFields(tags);
      if (tags.length === 0) {
        setPreviewError('Não foi encontrada nenhuma variável { } neste documento. Adiciona tags como {worker_name} no Word antes de fazer upload.');
      }
    } catch (err) {
      console.error('Erro a ler .docx:', err);
      setPreviewError('Não foi possível ler o ficheiro: ' + err.message);
    }
  };

  const submitUpload = async () => {
    if (!uploadFile) {
      setPreviewError('Selecione um ficheiro .docx.');
      return;
    }
    if (!uploadName.trim()) {
      setPreviewError('Nome é obrigatório.');
      return;
    }
    setUploading(true);
    setPreviewError('');
    try {
      await handleUploadTemplate({
        name: uploadName,
        description: uploadDescription,
        file: uploadFile,
      });
      resetUploadModal();
    } catch (err) {
      console.error('Erro no upload:', err);
      setPreviewError('Erro ao guardar: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

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
          onClick={() => setShowUploadModal(true)}
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

      {showUploadModal && (
        <Modal onClose={resetUploadModal} title="Novo Template (Word .docx)">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Nome</label>
              <input
                value={uploadName}
                onChange={e => setUploadName(e.target.value)}
                placeholder="Ex: Contrato de Trabalho"
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Descrição (opcional)</label>
              <input
                value={uploadDescription}
                onChange={e => setUploadDescription(e.target.value)}
                placeholder="Curta descrição interna"
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Ficheiro Word (.docx)</label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  className="text-sm"
                />
                {uploadFile && <span className="text-xs text-slate-500">{uploadFile.name}</span>}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                As variáveis no Word devem estar entre chavetas <code className="bg-slate-100 px-1 rounded">{'{worker_name}'}</code> e usar os nomes da lista abaixo.
              </p>
            </div>

            {previewError && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{previewError}</span>
              </div>
            )}

            {previewFields && previewFields.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Variáveis detetadas ({previewFields.length})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {previewFields.map(name => <FieldBadge key={name} name={name} />)}
                </div>
              </div>
            )}

            <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg p-3 space-y-1">
              <p><strong>Carimbo de Assinatura:</strong> Inclui{' '}
              <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-indigo-100">{`{%signature_stamp}`}</code>{' '}
              (com o sinal <code>%</code>) no Word onde queres que o carimbo digital apareça.</p>
              <p className="text-indigo-600"><strong>Dica:</strong> Tamanho default ~99x49mm. Para ajustar, coloca o tag numa tabela/moldura e redimensiona a celula no Word. O QR code de verificacao e aplicado automaticamente em todas as paginas do PDF final.</p>
            </div>

            <details className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <summary className="text-xs font-bold uppercase tracking-wider text-slate-600 cursor-pointer">
                Variáveis disponíveis (nomes a usar no Word)
              </summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-60 overflow-y-auto">
                {KNOWN_FIELD_NAMES.map(f => (
                  <div key={f.name} className="flex items-baseline gap-2 text-xs">
                    <code className="font-mono text-indigo-600">{f.name}</code>
                    <span className="text-slate-500 truncate">{f.label}</span>
                  </div>
                ))}
              </div>
            </details>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={resetUploadModal} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button
                onClick={submitUpload}
                disabled={uploading || saving || !uploadFile}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Guardar Template
              </button>
            </div>
          </div>
        </Modal>
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

function Modal({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-[2rem] p-6 shadow-2xl my-8">
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
