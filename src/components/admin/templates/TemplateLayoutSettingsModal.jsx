import React, { useEffect, useRef, useState } from 'react';
import { Sliders, Save, Loader2, RotateCcw, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import ModalShell from '../../common/ModalShell';
import { FT } from '../../../styles/designTokens';
import { replaceTemplateFields } from '../../../utils/templateFields';
import { generateHtmlDocumentPdf } from '../../../utils/htmlDocumentPdf';
import {
  DEFAULT_LAYOUT_SETTINGS,
  LAYOUT_SETTING_FIELDS,
  resolveLayoutSettings,
} from '../../../utils/templateLayoutSettings';

// Dados fictícios só para o preview deste painel — nunca gravados, nunca
// associados a um trabalhador real. Mesmo padrão de assinatura/QR "falsos"
// já usado nos scripts de verificação desta sessão.
const SAMPLE_SIGNATURE = 'data:image/svg+xml;base64,' + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><path d="M10 40 Q30 10 50 40 T90 40 T130 40 T170 40" fill="none" stroke="#1A1D21" stroke-width="3"/></svg>'
);
const SAMPLE_WORKER = {
  name: 'Diego Rocha Barbosa', nif: '291159893', nis: '12072162234',
  profissao: 'Gerente / Diretor Geral', dataInicio: '2026-01-01',
};
const SAMPLE_STAMP_TAGS = {
  '{worker_signature}': `<img src="${SAMPLE_SIGNATURE}" style="width:100%;height:100%;object-fit:contain;object-position:center;" alt="" />`,
  '{admin_stamp}': `<img src="${SAMPLE_SIGNATURE}" style="width:100%;height:100%;object-fit:contain;object-position:center;" alt="" />`,
  '{verification_code}': 'DRB-0000',
  '{verification_qr}': '',
  '{signed_datetime}': '02/09/2026 09:00',
  '{admin_signed_datetime}': '02/09/2026 09:05',
};

function fillSample(templateHtml, systemSettings) {
  let html = replaceTemplateFields(templateHtml, SAMPLE_WORKER, systemSettings || {}, null);
  Object.entries(SAMPLE_STAMP_TAGS).forEach(([tag, value]) => {
    html = html.split(tag).join(value);
  });
  return html;
}

export default function TemplateLayoutSettingsModal({ template, systemSettings, onClose, onSave, saving }) {
  const [values, setValues] = useState(() => resolveLayoutSettings(template.layout_settings));
  const [pdfUrl, setPdfUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const pdfUrlRef = useRef(null);

  useEffect(() => () => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
  }, []);

  const setField = (key, raw) => {
    const n = Number(raw);
    setValues(prev => ({ ...prev, [key]: Number.isFinite(n) ? n : prev[key] }));
  };

  const resetDefaults = () => setValues({ ...DEFAULT_LAYOUT_SETTINGS });

  const gerarPreviewReal = async () => {
    if (!template.template_html) return;
    setGenerating(true);
    setGenError('');
    try {
      const finalHtml = fillSample(template.template_html, systemSettings);
      const pdfBlob = await generateHtmlDocumentPdf(finalHtml, values);
      const url = URL.createObjectURL(pdfBlob);
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = url;
      setPdfUrl(url);
    } catch (err) {
      console.error('Erro a gerar preview real do PDF:', err);
      setGenError(err.message || 'Erro a gerar o PDF.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={`Ajustar layout — "${template.name}"`}
      icon={<Sliders size={18} />}
      size="viewer"
      busy={saving}
      footer={
        <div className="flex justify-between items-center gap-2 px-6 py-4">
          <button
            onClick={resetDefaults}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-xl disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Repor valores por omissão
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className="px-4 py-2 text-[var(--ink-soft)] hover:bg-[var(--surface-dim)] rounded-xl disabled:opacity-50">
              Cancelar
            </button>
            <button
              onClick={() => onSave(values)}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: FT.orange, color: FT.navy }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col @2xl:flex-row h-full min-h-[500px]">
        {/* Coluna esquerda: controlos de margem + botão de atualização */}
        <div className="@2xl:w-[280px] @2xl:border-r border-[var(--border)] p-6 space-y-4 flex-shrink-0">
          <p className="text-xs text-[var(--ink-soft)]">
            Margens e espaçamentos deste template. O preview à direita é o PDF
            real, gerado pela PDF.co — clica em "Atualizar" depois de mudar
            valores para o veres refletido.
          </p>
          {LAYOUT_SETTING_FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold text-[var(--ink-soft)] uppercase tracking-widest mb-1">
                {f.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={values[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  disabled={saving || generating}
                  className="w-full border border-[var(--border)] rounded-xl p-2 text-sm focus:ring-2 focus:ring-[#1B3A57]/30 outline-none"
                />
                <span className="text-xs text-[var(--slate-dim)]">px</span>
              </div>
            </div>
          ))}
          <button
            onClick={gerarPreviewReal}
            disabled={generating || saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 font-bold rounded-xl hover:opacity-90 disabled:opacity-50 border border-[var(--border)] text-[var(--navy)] bg-[var(--surface)]"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {generating ? 'A gerar PDF real...' : 'Atualizar Preview'}
          </button>
          {genError && (
            <div className="flex items-start gap-2 p-3 bg-[var(--tone-rose-bg)] border border-[var(--tone-rose-border)] rounded-xl text-xs text-[var(--tone-rose)]">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{genError}</span>
            </div>
          )}
        </div>

        {/* Coluna direita: iframe com o PDF real da PDF.co */}
        <div className="flex-1 relative bg-[var(--surface-dim)] min-h-[400px]">
          {pdfUrl ? (
            <iframe title="Preview PDF real" src={pdfUrl} className="w-full h-full border-0" />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-[var(--slate-dim)] text-center px-6">
              {generating ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <FileText className="w-8 h-8 opacity-40" />
                  <p>Clica em "Atualizar Preview" para gerar o PDF real com estes ajustes.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
