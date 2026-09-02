// Ajustes de layout (margens/espaçamentos) por template HTML — gravados em
// document_templates.layout_settings (JSONB). Aplicados como um bloco
// <style> ADITIVO com !important, nunca editando o template_html gravado —
// se `layout_settings` for null/{}, o resultado é idêntico ao valor por
// omissão já usado nos 3 templates reais (EPI/RGPD/Contrato).
export const DEFAULT_LAYOUT_SETTINGS = {
  pagePaddingBottom: 4,
  paragraphSpacing: 14,
  listItemSpacing: 8,
  stampBlockMarginTop: 14,
  stampBlockPaddingTop: 10,
  stampSwatchWidth: 107,
  stampSwatchHeight: 77,
  // Estes dois não entram no <style> — são lidos à parte em
  // htmlDocumentPdf.js, afetam a chamada ao gerador de PDF (margin/altura
  // da página), não uma regra CSS. Ficam aqui só para teres um único sítio
  // com os valores por omissão.
  headerMarginPx: 76,
  footerMarginPx: 34,
};

// Para o painel de ajustes (TemplateLayoutSettingsModal.jsx) — `css: true`
// marca os que entram no <style> aditivo em vez de irem direto como
// parâmetro do gerador de PDF. Não é mais "só no PDF" vs "só no preview":
// desde que a Simulação passou a ser o PDF real, os dois grupos afetam as
// duas vistas por igual.
export const LAYOUT_SETTING_FIELDS = [
  { key: 'paragraphSpacing', label: 'Espaço entre parágrafos', css: true },
  { key: 'listItemSpacing', label: 'Espaço entre itens de lista', css: true },
  { key: 'pagePaddingBottom', label: 'Margem inferior da página', css: true },
  { key: 'stampBlockMarginTop', label: 'Espaço antes do carimbo', css: true },
  { key: 'stampBlockPaddingTop', label: 'Espaço interno do carimbo', css: true },
  { key: 'stampSwatchWidth', label: 'Largura da caixa de assinatura', css: true },
  { key: 'stampSwatchHeight', label: 'Altura da caixa de assinatura', css: true },
  { key: 'headerMarginPx', label: 'Margem do cabeçalho', css: false },
  { key: 'footerMarginPx', label: 'Margem do rodapé', css: false },
];

export function resolveLayoutSettings(saved) {
  return { ...DEFAULT_LAYOUT_SETTINGS, ...(saved || {}) };
}

function buildLayoutOverrideStyle(saved) {
  const s = resolveLayoutSettings(saved);
  return `<style>
  .page { padding-bottom: ${s.pagePaddingBottom}px !important; }
  .body-text p { margin-bottom: ${s.paragraphSpacing}px !important; }
  ol.declara li { margin-bottom: ${s.listItemSpacing}px !important; }
  .stamp-block { margin-top: ${s.stampBlockMarginTop}px !important; padding-top: ${s.stampBlockPaddingTop}px !important; }
  .stamp-swatch { width: ${s.stampSwatchWidth}px !important; height: ${s.stampSwatchHeight}px !important; }
</style>`;
}

// Injeta o override logo antes do </head> — cascata garante que corre
// DEPOIS do <style> original do template, e o !important garante que vence
// independentemente da especificidade das regras originais.
export function applyLayoutOverride(html, saved) {
  if (!html || !html.includes('</head>')) return html;
  return html.replace('</head>', `${buildLayoutOverrideStyle(saved)}</head>`);
}
