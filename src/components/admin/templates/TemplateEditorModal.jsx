import React, { useState, useRef, useEffect } from 'react';
import { Loader2, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import {
  KNOWN_FIELD_NAMES,
  extractTags,
  readFileAsArrayBuffer,
  downloadTemplateBytes,
} from '../../../utils/docxTemplateService';
import { convertDocxToPdf } from '../../../utils/pdfCoService';
import { PDFDocument } from 'pdf-lib';
import ModalShell from '../../common/ModalShell';
import FieldBadge from './FieldBadge';
import { FT, SCALE } from '../../../styles/designTokens';

const PRESETS = [
  { label: 'Inferior Direito', x: 130, y: 30 },
  { label: 'Inferior Esquerdo', x: 20, y: 30 },
  { label: 'Inferior Centro', x: 75, y: 30 },
  { label: 'Superior Direito', x: 130, y: 260 },
];

export default function TemplateEditorModal({ template, supabase, onClose, onSave, saving }) {
  const isEditing = !!template;
  const fileInputRef = useRef(null);

  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [file, setFile] = useState(null);
  const [previewFields, setPreviewFields] = useState(template?.template_fields || null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [stampX, setStampX] = useState(template?.stamp_x ?? 130);
  const [stampY, setStampY] = useState(template?.stamp_y ?? 30);
  const [stampPage, setStampPage] = useState(template?.stamp_page || 'last');

  const [stampAdminX, setStampAdminX] = useState(template?.stamp_admin_x ?? 20);
  const [stampAdminY, setStampAdminY] = useState(template?.stamp_admin_y ?? 30);
  const [stampAdminPage, setStampAdminPage] = useState(template?.stamp_admin_page || 'last');

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copiedTag, setCopiedTag] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl = null;
    const generatePreview = async () => {
      const sourceFile = file;
      const existingPath = template?.template_docx_path;
      if (!sourceFile && !existingPath) { setPdfPreviewUrl(null); return; }
      setLoadingPreview(true);
      try {
        let docxBlob;
        if (sourceFile) {
          docxBlob = sourceFile;
        } else if (existingPath && supabase) {
          const buffer = await downloadTemplateBytes(supabase, existingPath);
          docxBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        }
        if (cancelled || !docxBlob) return;
        const fullPdfBlob = await convertDocxToPdf(docxBlob);
        if (cancelled) return;
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
    if (!f) { setFile(null); if (!isEditing) setPreviewFields(null); return; }
    const isDocx = f.name.toLowerCase().endsWith('.docx')
      || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!isDocx) { setError('Apenas ficheiros Word (.docx) são suportados.'); setFile(null); return; }
    setFile(f);
    if (!name.trim()) setName(f.name.replace(/\.docx$/i, ''));
    try {
      const buf = await readFileAsArrayBuffer(f);
      const tags = extractTags(buf);
      setPreviewFields(tags);
      if (tags.length === 0) setError('Não foi encontrada nenhuma variável { } neste documento.');
    } catch (err) {
      console.error('Erro a ler .docx:', err);
      setError('Não foi possível ler o ficheiro: ' + err.message);
    }
  };

  const handleSubmit = async () => {
    if (!isEditing && !file) { setError('Selecione um ficheiro .docx.'); return; }
    if (!name.trim()) { setError('Nome é obrigatório.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSave({
        name, description,
        file: file || undefined,
        stamp_x: Number(stampX), stamp_y: Number(stampY), stamp_page: stampPage,
        stamp_admin_x: Number(stampAdminX), stamp_admin_y: Number(stampAdminY), stamp_admin_page: stampAdminPage,
      });
    } catch (err) {
      console.error('Erro ao guardar:', err);
      setError('Erro ao guardar: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={isEditing ? 'Editar Template' : 'Novo Template'}
      icon={<FileText size={18} />}
      size="5xl"
      busy={submitting || saving}
      footer={
        <div className="flex justify-end gap-2 px-6 py-4">
          <button onClick={onClose} className="px-4 py-2 text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-xl">Cancelar</button>
          <button onClick={handleSubmit} disabled={submitting || saving || (!isEditing && !file)}
 className="flex items-center gap-2 px-6 py-2 font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: FT.orange, color: FT.navy }}>
            {(submitting || saving) ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {isEditing ? 'Guardar Alterações' : 'Criar Template'}
          </button>
        </div>
      }
    >
      <div className="@container px-6 py-4">
      <div className="grid grid-cols-1 @lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[var(--ink-soft)] uppercase">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Contrato de Trabalho"
              className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-xl focus:outline-none focus:border-[var(--navy)]" />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--ink-soft)] uppercase">Descrição (opcional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Curta descrição interna"
              className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-xl focus:outline-none focus:border-[var(--navy)]" />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--ink-soft)] uppercase">
              Ficheiro Word (.docx) {isEditing && <span className="text-[var(--slate-dim)] font-normal">(opcional - substituir)</span>}
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input ref={fileInputRef} type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange} className="text-sm" />
            </div>
            {isEditing && !file && (
              <p className="text-xs text-[var(--slate-dim)] mt-1">Ficheiro atual será mantido se não selecionar um novo.</p>
            )}
          </div>

          {previewFields && previewFields.length > 0 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
                Variáveis detetadas ({previewFields.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {previewFields.map(fname => <FieldBadge key={fname} name={fname} />)}
              </div>
            </div>
          )}

          <StampSection
            title="Carimbo do Trabalhador"
            color="sky"
            x={stampX} setX={setStampX}
            y={stampY} setY={setStampY}
            page={stampPage} setPage={setStampPage}
          />

          <StampSection
            title="Carimbo da Empresa (Responsável)"
            color="amber"
            x={stampAdminX} setX={setStampAdminX}
            y={stampAdminY} setY={setStampAdminY}
            page={stampAdminPage} setPage={setStampAdminPage}
          />

          <details className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3">
            <summary className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] cursor-pointer">
              Variáveis disponíveis <span className="font-normal text-[var(--slate-dim)] normal-case">— clica para copiar</span>
            </summary>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-60 overflow-y-auto">
              {KNOWN_FIELD_NAMES.map(f => {
                const tag = `{${f.name}}`;
                const copy = async () => {
                  try {
                    await navigator.clipboard.writeText(tag);
                    setCopiedTag(f.name);
                    setTimeout(() => setCopiedTag((cur) => (cur === f.name ? null : cur)), 1200);
                  } catch (err) {
                    console.warn('Falha a copiar:', err);
                  }
                };
                const isCopied = copiedTag === f.name;
                return (
                  <button type="button" key={f.name} onClick={copy} title={`Copiar ${tag}`}
                    className={`flex items-center gap-2 text-xs text-left px-2 py-1 rounded-lg border transition-all ${isCopied ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-[var(--border)] hover:border-[var(--slate)] hover:bg-[var(--surface)]'}`}>
                    <code className={isCopied ? 'font-mono text-emerald-700' : 'font-mono'} style={isCopied ? {} : { color: 'var(--slate-dim)' }}>{tag}</code>
                    <span className="text-[var(--slate-dim)] truncate flex-1">{f.label}</span>
                    <span className={`${SCALE.text.statLabel} ${isCopied ? 'text-emerald-600' : 'text-[var(--slate-dim)]'}`}>
                      {isCopied ? 'Copiado' : 'Copiar'}
                    </span>
                  </button>
                );
              })}
            </div>
          </details>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[var(--ink-mid)]">Pré-visualização da Última Página</h4>
          <div className="bg-[var(--surface-dim)] rounded-xl p-2 mx-auto" style={{ aspectRatio: '210 / 297', maxWidth: '420px' }}>
            <div className="relative w-full h-full">
              {loadingPreview ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--slate-dim)]">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-xs">A gerar preview...</span>
                </div>
              ) : pdfPreviewUrl ? (
                <>
                  <iframe src={`${pdfPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                    className="absolute inset-0 w-full h-full rounded-lg border border-[var(--border)] bg-white"
                    title="Preview última página" />
                  <div className={`absolute bg-sky-500/70 rounded text-white flex items-center justify-center pointer-events-none border-2 border-sky-700 ${SCALE.text.badge}`}
                    style={{ width: `${(70 / 210) * 100}%`, height: `${(25 / 297) * 100}%`, left: `${(stampX / 210) * 100}%`, bottom: `${(stampY / 297) * 100}%` }}>
                    TRABALHADOR
                  </div>
                  <div className={`absolute bg-amber-500/70 rounded text-white flex items-center justify-center pointer-events-none border-2 border-amber-700 ${SCALE.text.badge}`}
                    style={{ width: `${(70 / 210) * 100}%`, height: `${(25 / 297) * 100}%`, left: `${(stampAdminX / 210) * 100}%`, bottom: `${(stampAdminY / 297) * 100}%` }}>
                    EMPRESA
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--slate-dim)]">
                  <FileText className="w-12 h-12" />
                  <span className="text-xs text-center px-4">
                    {isEditing ? 'A carregar preview...' : 'Seleciona um ficheiro .docx para ver o preview'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-[var(--slate-dim)] bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 space-y-1">
            <p><span className="inline-block w-2 h-2 rounded-full bg-sky-500 mr-1" /><strong>Trabalhador</strong> — aplicado quando o trabalhador assina.</p>
            <p><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" /><strong>Empresa</strong> — aplicado depois pelo responsável da Magnetic Place ao aprovar.</p>
            <p className="text-[var(--slate-dim)] pt-1">Ambos os carimbos têm 70×25mm, posicionados a partir do canto inferior-esquerdo. O QR é colocado automaticamente em todas as páginas.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      </div>
    </ModalShell>
  );
}

function StampSection({ title, color, x, setX, y, setY, page, setPage }) {
  const cls = {
    dot: `bg-${color}-500`,
    active: `text-${color}-700 bg-${color}-100 border-${color}-300`,
    inactive: `text-${color}-700 bg-${color}-50 border-${color}-200 hover:bg-${color}-100`,
    focus: `focus:border-${color}-500`,
  };
  return (
    <div className="border-t border-[var(--border)] pt-4">
      <h4 className="text-sm font-bold text-[var(--ink-mid)] mb-3 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${cls.dot}`} />
        {title}
      </h4>
      <div className="mb-3">
        <label className="text-xs font-bold text-[var(--slate-dim)] uppercase mb-2 block">Posições Predefinidas</label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button key={p.label} type="button" onClick={() => { setX(p.x); setY(p.y); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${x === p.x && y === p.y ? cls.active : cls.inactive}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'X (mm)', val: x, set: setX, max: 210 },
          { label: 'Y (mm)', val: y, set: setY, max: 297 },
        ].map(({ label, val, set, max }) => (
          <div key={label}>
            <label className="text-xs font-bold text-[var(--slate-dim)] uppercase">{label}</label>
            <input type="number" value={val} onChange={e => set(e.target.value)} min={0} max={max}
              className={`mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-xl focus:outline-none ${cls.focus} text-sm`} />
          </div>
        ))}
        <div>
          <label className="text-xs font-bold text-[var(--slate-dim)] uppercase">Página</label>
          <select value={page} onChange={e => setPage(e.target.value)}
            className={`mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-xl focus:outline-none ${cls.focus} text-sm`}>
            <option value="last">Última</option>
            <option value="first">Primeira</option>
            <option value="all">Todas</option>
          </select>
        </div>
      </div>
    </div>
  );
}
