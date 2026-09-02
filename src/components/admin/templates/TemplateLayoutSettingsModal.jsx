import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sliders, Save, Loader2, RotateCcw, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import ModalShell from '../../common/ModalShell';
import { useApp } from '../../../context/AppContext';
import { FT } from '../../../styles/designTokens';
import { TEMPLATES_BUCKET } from '../../../utils/docxTemplateService';
import { replaceTemplateFields } from '../../../utils/templateFields';
import { generateHtmlDocumentPdf } from '../../../utils/htmlDocumentPdf';
import {
  DEFAULT_LAYOUT_SETTINGS,
  LAYOUT_SETTING_FIELDS,
  resolveLayoutSettings,
  applyLayoutOverride,
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

function fillSample(templateHtml, systemSettings, epiCatalogo) {
  let html = replaceTemplateFields(templateHtml, SAMPLE_WORKER, systemSettings || {}, null, epiCatalogo || []);
  Object.entries(SAMPLE_STAMP_TAGS).forEach(([tag, value]) => {
    html = html.split(tag).join(value);
  });
  return html;
}

const PDFJS_VERSION = '4.0.379';
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
let pdfjsLibPromise = null;
function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(/* @vite-ignore */ PDFJS_URL).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return lib;
    });
  }
  return pdfjsLibPromise;
}

// O Chrome de ambiente de trabalho tem visualizador de PDF nativo embutido
// em <iframe src="blob:...">, mas o Chrome Android não — mostra só um ícone
// genérico + botão "Abrir" (achado do Diego, testado no telemóvel). Em vez
// de depender do visualizador do browser (que varia por plataforma),
// desenha-se o PDF em <canvas> com pdf.js — mesmo resultado em qualquer
// browser/dispositivo. Carregado da CDN (mesmo padrão já usado em
// AppContext.jsx para o supabase-js), não é dependência do bundle.
function PdfCanvasPreview({ pdfUrl }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!pdfUrl || !containerRef.current) return undefined;
    let cancelled = false;
    const container = containerRef.current;
    container.innerHTML = '';

    (async () => {
      try {
        const pdfjsLib = await loadPdfJs();
        const doc = await pdfjsLib.getDocument(pdfUrl).promise;
        // Escala à largura real do contentor (menos o padding de 32px, 16px
        // cada lado) — uma escala fixa (ex. 1.3) ficava mais larga do que a
        // coluna de preview e obrigava a scroll horizontal (achado do Diego,
        // com screenshot do telemóvel).
        const availableWidth = Math.max(200, container.clientWidth - 32);
        const firstPage = await doc.getPage(1);
        const naturalWidth = firstPage.getViewport({ scale: 1 }).width;
        const fitScale = availableWidth / naturalWidth;
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const page = i === 1 ? firstPage : await doc.getPage(i);
          const viewport = page.getViewport({ scale: fitScale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.display = 'block';
          canvas.style.margin = i === 1 ? '0 auto 12px' : '12px auto';
          canvas.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
          canvas.style.background = '#fff';
          container.appendChild(canvas);
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch (err) {
        console.error('Erro a desenhar o PDF em canvas:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [pdfUrl]);

  return <div ref={containerRef} className="w-full h-full overflow-auto p-4" />;
}

// Pedido do Diego, depois de duas voltas de bugs de paginação causados por
// tentar PREVER a altura da página num motor (o browser do admin) diferente
// do que gera o PDF final (o Chromium do Lambda): "vamos pelo certo" — a
// Simulação deixa de ser uma aproximação por CSS e passa a ser o PDF real,
// gerado pelo mesmo pipeline de sempre (generateHtmlDocumentPdf), só que
// automático (debounce ~800ms depois de parar de editar) em vez de exigir
// um clique. Já não há previsão nenhuma para divergir — o que se vê AQUI é
// literalmente o mesmo motor que gera o documento assinado.
function LivePdfPreview({ finalHtml, values }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const urlRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!finalHtml) { setPdfUrl(null); setLoading(false); return undefined; }
    let cancelled = false;
    const mySeq = ++seqRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const blob = await generateHtmlDocumentPdf(finalHtml, values);
        if (cancelled || mySeq !== seqRef.current) return;
        const url = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setPdfUrl(url);
        setError('');
      } catch (err) {
        if (cancelled || mySeq !== seqRef.current) return;
        console.error('Erro a gerar pré-visualização ao vivo:', err);
        setError(err.message || 'Erro a gerar o PDF.');
      } finally {
        if (!cancelled && mySeq === seqRef.current) setLoading(false);
      }
    }, 800);
    return () => { cancelled = true; clearTimeout(t); };
  }, [finalHtml, values]);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  return (
    <div className="absolute inset-0">
      {loading && pdfUrl && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[11px] text-[var(--slate-dim)] shadow">
          <Loader2 className="w-3 h-3 animate-spin" /> A atualizar...
        </div>
      )}
      {error && (
        <div className="absolute top-2 left-2 right-2 z-10 flex items-start gap-2 p-2 bg-[var(--tone-rose-bg)] border border-[var(--tone-rose-border)] rounded-lg text-[11px] text-[var(--tone-rose)]">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {pdfUrl ? (
        <PdfCanvasPreview pdfUrl={pdfUrl} />
      ) : loading ? (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--slate-dim)]" />
        </div>
      ) : !error ? (
        <div className="h-full flex items-center justify-center text-sm text-[var(--slate-dim)]">
          Este template não tem conteúdo HTML.
        </div>
      ) : null}
    </div>
  );
}

export default function TemplateLayoutSettingsModal({ template, systemSettings, onClose, onSave, saving }) {
  const [values, setValues] = useState(() => resolveLayoutSettings(template.layout_settings));
  // Duas vistas, as duas com o PDF real (gerado pelo mesmo Chromium
  // serverless que assina os documentos): "Simulação" atualiza-se sozinha
  // (debounce ~800ms) a cada ajuste, "PDF Oficial" só gera quando pedido e
  // fica gravada como a última versão confirmada. Deixou de haver uma
  // vista aproximada — as duas usam generateHtmlDocumentPdf, nunca podem
  // divergir uma da outra por definição.
  const { supabase } = useApp();
  const [tab, setTab] = useState('sim');
  const [epiCatalogo, setEpiCatalogo] = useState([]);
  useEffect(() => {
    if (!supabase) return;
    supabase.from('epi_catalogo_documento').select('*').then(({ data }) => setEpiCatalogo(data || []));
  }, [supabase]);
  // Pedido do Diego: "quero que o real fique salvo sempre a última
  // importação" — inicializa já com o último PDF Oficial gravado (se
  // existir), para não ter de gerar de novo só para ver o que já tinha
  // sido confirmado da última vez.
  const [pdfUrl, setPdfUrl] = useState(template.layout_preview_pdf_url || null);
  const [pdfIsStale, setPdfIsStale] = useState(!!template.layout_preview_pdf_url);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const pdfUrlRef = useRef(null);

  const simulationHtml = useMemo(() => {
    if (!template.template_html) return '';
    return applyLayoutOverride(fillSample(template.template_html, systemSettings, epiCatalogo), values);
  }, [template.template_html, systemSettings, values, epiCatalogo]);

  useEffect(() => () => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
  }, []);

  // Um valor mudado depois de gerar (ou depois de carregar a última versão
  // gravada) torna o PDF Oficial visível desatualizado — volta a marcar
  // como "por confirmar" em vez de deixar a mensagem antiga a parecer válida.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (pdfUrl) setPdfIsStale(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const setField = (key, raw) => {
    const n = Number(raw);
    setValues(prev => ({ ...prev, [key]: Number.isFinite(n) ? n : prev[key] }));
  };

  const resetDefaults = () => setValues({ ...DEFAULT_LAYOUT_SETTINGS });

  // Grava o PDF Oficial mais recente no Storage (mesmo bucket dos templates,
  // caminho fixo por template — cada geração substitui a anterior, é sempre
  // "a última") e aponta `document_templates.layout_preview_pdf_url` para
  // lá, para a próxima vez que o painel abrir já ter algo para mostrar sem
  // gerar de novo. Corre em segundo plano — se falhar, o preview local (já
  // visível via blob) não é afetado, só fica por gravar.
  const persistLastPreview = async (pdfBlob) => {
    const path = `layout-preview/${template.id}.pdf`;
    const { error: upErr } = await supabase.storage
      .from(TEMPLATES_BUCKET)
      .upload(path, pdfBlob, { contentType: 'application/pdf', upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(TEMPLATES_BUCKET).getPublicUrl(path);
    if (!pub?.publicUrl) return;
    // `?t=` evita que o browser/CDN sirva a versão em cache da geração
    // anterior, gravada no mesmo caminho.
    const { error: dbErr } = await supabase
      .from('document_templates')
      .update({ layout_preview_pdf_url: `${pub.publicUrl}?t=${Date.now()}` })
      .eq('id', template.id);
    if (dbErr) throw dbErr;
  };

  const gerarPreviewReal = async () => {
    if (!template.template_html) return;
    setGenerating(true);
    setGenError('');
    try {
      // simulationHtml já leva applyLayoutOverride aplicado — achado ao
      // reescrever este painel: esta função enviava fillSample(...) em bruto,
      // sem o override de margens/espaçamentos, só a Simulação (CSS) é que o
      // aplicava. Divergência real entre as duas vistas, agora corrigida
      // usando a mesma fonte para as duas.
      const pdfBlob = await generateHtmlDocumentPdf(simulationHtml, values);
      const url = URL.createObjectURL(pdfBlob);
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = url;
      setPdfUrl(url);
      setPdfIsStale(false);
      persistLastPreview(pdfBlob).catch((err) => console.error('Falha a gravar o último PDF Oficial:', err));
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
            Margens e espaçamentos deste template. A "Simulação" atualiza-se
            sozinha com o PDF real a cada ajuste; o "PDF Oficial" gera a
            pedido e fica gravado como a última versão confirmada.
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
            {generating ? 'A gerar PDF real...' : 'Gerar PDF Oficial'}
          </button>
          {genError && (
            <div className="flex items-start gap-2 p-3 bg-[var(--tone-rose-bg)] border border-[var(--tone-rose-border)] rounded-xl text-xs text-[var(--tone-rose)]">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{genError}</span>
            </div>
          )}
        </div>

        {/* Coluna direita: separador Simulação (PDF real, auto-atualiza com
            debounce) / PDF Oficial (PDF real, só a pedido, fica gravado) —
            as duas desenhadas em canvas via PdfCanvasPreview, funciona
            igual em desktop e mobile (ver nota no componente) */}
        <div className="flex-1 flex flex-col min-h-[400px]">
          <div className="flex border-b border-[var(--border)] px-4 pt-3 gap-1 flex-shrink-0 bg-[var(--surface-dim)]">
            {[
              { key: 'sim', label: 'Simulação' },
              { key: 'real', label: 'PDF Oficial' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 -mb-px transition-colors ${
                  tab === t.key
                    ? 'border-[var(--orange)] text-[var(--navy)] bg-[var(--surface)]'
                    : 'border-transparent text-[var(--slate-dim)] hover:text-[var(--ink-soft)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 relative bg-[var(--surface-dim)]">
            {tab === 'sim' ? (
              simulationHtml ? (
                <LivePdfPreview finalHtml={simulationHtml} values={values} />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-[var(--slate-dim)]">
                  Este template não tem conteúdo HTML.
                </div>
              )
            ) : pdfUrl ? (
              <>
                {pdfIsStale && (
                  <div className="absolute top-2 left-2 right-2 z-10 flex items-start gap-2 p-2 bg-[var(--tone-amber-bg)] border border-[var(--tone-amber-border)] rounded-lg text-[11px] text-[var(--tone-amber)]">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>Última versão gravada — pode não refletir ajustes ainda por confirmar. Clica em "Gerar PDF Oficial" para atualizar.</span>
                  </div>
                )}
                <PdfCanvasPreview pdfUrl={pdfUrl} />
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-[var(--slate-dim)] text-center px-6">
                {generating ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <FileText className="w-8 h-8 opacity-40" />
                    <p>Clica em "Gerar PDF Oficial" para gerar o PDF real com estes ajustes.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
