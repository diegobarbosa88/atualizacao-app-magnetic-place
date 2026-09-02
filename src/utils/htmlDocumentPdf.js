import { authFetch } from './authFetch';
import { resolveLayoutSettings } from './templateLayoutSettings';

// Altura real de uma página A4 a 96dpi (mesmo valor já usado em
// FitToWidthHtmlFrame.jsx) — orçamento de 1 página física. Exportado — a
// simulação paginada do painel "Ajustar Layout" precisa do mesmo valor para
// calcular quantas páginas o conteúdo vai ocupar.
export const A4_HEIGHT_PX = 1123;

// Mede a altura real do `.page` renderizado, num iframe escondido, para
// documentos de 1 página só (EPI/RGPD): sem isto, a página física força
// sempre o orçamento inteiro de 1 página, mesmo quando o conteúdo é bem mais
// curto — sobra espaço vazio visível no PDF real (achado do Diego,
// 2026-09-02). Não mexe em documentos de várias páginas (Contrato): aí a
// paginação normal (repetindo timbre/rodapé por página) é o que já dá o
// resultado correto, testado nesta sessão.
export function measurePageHeightPx(html) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '900px';
    iframe.style.height = '2000px';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.onload = () => {
      let height = null;
      try {
        const pageEl = iframe.contentDocument?.querySelector('.page');
        height = pageEl ? pageEl.getBoundingClientRect().height : null;
      } catch {
        height = null;
      }
      iframe.remove();
      resolve(height);
    };
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });
}

// Fallback de 1x1 transparente — só usado se a busca ao logo pequeno falhar,
// para nunca bloquear uma geração de PDF por causa do cabeçalho.
const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// Versão pequena (100×100, ~13,7KB) do logótipo, gerada com sharp a partir
// de `public/logo-magnetic.png` — o mesmo ficheiro embutido no timbre do
// template, mas esse vem a 138KB (pensado para o corpo do documento, nunca
// para ir 1x por cada geração a um endpoint separado). Buscado fresco em
// vez de extraído do template para não repetir o custo do original.
// Cache em memória — a simulação paginada chama isto a cada mudança de
// valor no painel, não faz sentido voltar a pedir o mesmo ficheiro estático.
let logoDataUrlPromise = null;
export function fetchLogoDataUrl() {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = (async () => {
      try {
        const res = await fetch('/logo-header-small.png');
        const blob = await res.blob();
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        return TRANSPARENT_PIXEL;
      }
    })();
  }
  return logoDataUrlPromise;
}

// Separa o timbre (`.letterhead`+`.rule`) e o rodapé (`.footer`) do fluxo do
// `.page` para os passar como `header`/`footer` da PDF.co — repetem-se
// automaticamente em TODAS as páginas físicas (timbre só aparecia na 1.ª
// página, rodapé só na última, no mecanismo antigo de conteúdo único
// contínuo).
//
// Header/footer reescritos com `style=` inline, SEM duplicar o `<style>`
// principal do documento — achado real, não hipotético: a 1.ª versão desta
// função copiava o `<style>` inteiro (102KB, quase tudo a marca de água em
// base64, irrelevante aqui) para dentro de cada um, e reaproveitava o logo
// já embutido no timbre (138KB, pensado para o corpo do documento) — dava
// um `header` de 241KB. A PDF.co devolveu em produção "Error running
// process: [Errno 7] Argument list too long: '/opt/html2pdf/html2pdf'":
// o motor deles passa o header/footer como argumento de linha de comandos
// ao binário `html2pdf`, com um limite bem mais apertado do que o corpo
// principal do documento (esse SEMPRE funcionou a ~245KB, deve ir por outra
// via). Corrigido: só os campos de texto reais (referência do documento,
// as duas linhas do rodapé) saem do template via regex; o resto — logo,
// tipografia, cores — é markup fixo e pequeno, igual nos 3 templates.
export function buildPdfHeaderFooter(finalHtml, logoDataUrl) {
  const letterheadMatch = finalHtml.match(/<div class="letterhead">[\s\S]*?<\/div>\s*<div class="rule"><\/div>/);
  const footerMatch = finalHtml.match(/<div class="footer">[\s\S]*?<\/div>/);
  const docRefMatch = finalHtml.match(/<div class="doc-ref">([\s\S]*?)<\/div>/);
  const footerSpansMatch = finalHtml.match(/<div class="footer">\s*<span>([\s\S]*?)<\/span>\s*<span>([\s\S]*?)<\/span>\s*<\/div>/);
  if (!letterheadMatch || !footerMatch || !docRefMatch || !footerSpansMatch) {
    return { html: finalHtml, header: null, footer: null };
  }

  const html = finalHtml
    .replace(letterheadMatch[0], '')
    .replace(footerMatch[0], '')
    .replace('@page { size: A4; margin: 0; }', '')
    .replace('padding: 48px 56px 4px;', 'padding: 16px 56px 4px;');

  const header = `<div style="width:100%; font-family: Arial, Helvetica, sans-serif; box-sizing:border-box; padding: 0 56px;">
  <div style="display:flex; align-items:center; gap:16px;">
    <img src="${logoDataUrl}" style="width:40px;height:40px;flex-shrink:0;" />
    <div>
      <div style="font-weight:800; font-size:13px; letter-spacing:0.01em; color:#1B3A57; line-height:1.15;">MAGNETIC PLACE — Unipessoal, Lda.</div>
      <div style="font-size:7.5px; color:#5C7086; letter-spacing:0.02em; margin-top:2px;">Cedência de Mão-de-Obra · Trofa, Portugal</div>
    </div>
    <div style="margin-left:auto; text-align:right; font-size:7.5px; color:#5C7086; line-height:1.4;">${docRefMatch[1]}</div>
  </div>
  <div style="height:3px; background:linear-gradient(90deg,#1B3A57 0%,#1B3A57 60%,#EB8D00 100%); margin-top:12px;"></div>
</div>`;

  const footer = `<div style="width:100%; font-family: Arial, Helvetica, sans-serif; box-sizing:border-box; padding: 0 56px; font-size:8px; color:#5C7086;">
  <div style="border-top:1px solid #EAE7DF; padding-top:8px; display:flex; justify-content:space-between;">
    <span>${footerSpansMatch[1]}</span>
    <span>${footerSpansMatch[2]}</span>
  </div>
</div>`;

  return { html, header, footer };
}

/**
 * Gera o PDF real de um documento `formato==='html'` já preenchido — mesmo
 * caminho usado por `handleApproveDocument` (aprovação real) e pelo preview
 * ao vivo do painel "Ajustar Layout" (com dados fictícios), para os dois
 * nunca divergirem no que fazem à chamada da PDF.co.
 * @param {string} finalHtml - HTML já com todos os campos/placeholders resolvidos
 * @param {object} layoutSettings - `document_templates.layout_settings` (ou o rascunho do painel)
 * @returns {Promise<Blob>}
 */
export async function generateHtmlDocumentPdf(finalHtml, layoutSettings) {
  const s = resolveLayoutSettings(layoutSettings);
  const logoDataUrl = await fetchLogoDataUrl();
  const { html: pdfHtml, header, footer } = buildPdfHeaderFooter(finalHtml, logoDataUrl);

  let pdfPageHeight = A4_HEIGHT_PX;
  if (header) {
    const usableHeight = A4_HEIGHT_PX - s.headerMarginPx - s.footerMarginPx;
    const measuredHeight = await measurePageHeightPx(pdfHtml);
    if (measuredHeight && measuredHeight < usableHeight) {
      pdfPageHeight = Math.ceil(measuredHeight) + s.headerMarginPx + s.footerMarginPx + 6;
    }
  }

  return convertHtmlToPdfServerless(pdfHtml, header ? {
    header,
    footer,
    headerMarginPx: s.headerMarginPx,
    footerMarginPx: s.footerMarginPx,
    width: '794px',
    height: `${pdfPageHeight}px`,
  } : {});
}

// Chama a nossa própria rota serverless (Chromium via @sparticuz/chromium +
// puppeteer-core, api/_gerarPdfHtml.js) em vez da PDF.co — mesma extração de
// header/footer e cálculo de página acima, só muda quem converte o HTML em
// PDF. Testado contra a Vercel real (cold start ~5s, bem dentro do
// maxDuration de 60s) antes de substituir a PDF.co.
async function convertHtmlToPdfServerless(html, { header, footer, headerMarginPx, footerMarginPx, width, height } = {}) {
  const res = await authFetch('/api/parse-fatura?action=gerar-pdf-html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html,
      useHeaderFooter: !!header,
      headerHtml: header || '',
      footerHtml: footer || '',
      headerMarginPx,
      footerMarginPx,
      width: width || null,
      height: height || null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao gerar PDF (${res.status}).`);
  }
  return res.blob();
}
