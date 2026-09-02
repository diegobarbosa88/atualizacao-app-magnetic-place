// Converte HTML -> PDF com Chromium serverless (@sparticuz/chromium +
// puppeteer-core), substituindo a PDF.co para o Fluxo 3 (documentos HTML
// assinados). Usado por src/utils/htmlDocumentPdf.js (generateHtmlDocumentPdf)
// — tanto na aprovação real (handleApproveDocument) como no botão "Gerar PDF
// Oficial" do painel "Ajustar Layout". A extração de header/footer, medição
// de altura de página e cálculo de margens continuam client-side, tal como
// já estava com a PDF.co — este endpoint só recebe HTML/header/footer já
// resolvidos e devolve o PDF.
//
// Não é um ficheiro de rota próprio (prefixo `_`, a Vercel não o conta como
// função) — montado como branch dentro de api/parse-fatura.js
// (?action=gerar-pdf-html), porque o projeto está no limite de 12 funções
// serverless do plano Hobby (ver commit "fix: rota de teste PDF integrada em
// parse-fatura.js" para o contexto completo). Mesmo padrão de consolidação
// já usado no resto do projeto (formacao, reconciliacao, toconline/proxy).
//
// Protegida por sessão de admin (requireAuth) — chamada só pelo browser
// autenticado (nunca por curl externo, ao contrário da versão de teste que
// a precedeu).

import chromiumModule from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { requireAuth } from './_authUtils.js';

const chromium = chromiumModule.default ?? chromiumModule;

export async function handleGerarPdfHtml(req, res) {
  if (!requireAuth(req, res, ['admin'])) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Usa POST.' });
  }

  const {
    html,
    useHeaderFooter = false,
    headerHtml = '',
    footerHtml = '',
    headerMarginPx = 76,
    footerMarginPx = 34,
    width = null,
    height = null,
  } = req.body || {};
  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'Falta o campo "html" no corpo do pedido.' });
  }

  let browser;
  try {
    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });

    const pdfOptions = {
      printBackground: true,
      preferCSSPageSize: true,
    };

    if (width && height) {
      pdfOptions.width = width;
      pdfOptions.height = height;
    } else {
      pdfOptions.format = 'A4';
    }

    if (useHeaderFooter) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = headerHtml || '<div></div>';
      pdfOptions.footerTemplate = footerHtml || '<div></div>';
      pdfOptions.margin = {
        top: `${headerMarginPx}px`,
        bottom: `${footerMarginPx}px`,
        left: '0px',
        right: '0px',
      };
    }

    // page.pdf() pode devolver Uint8Array em vez de Buffer nativo do Node
    // consoante a versão do puppeteer-core — res.send() da Vercel só escreve
    // bytes crus quando reconhece um Buffer real (Buffer.isBuffer()); com um
    // Uint8Array simples cai no branch de JSON e serializa byte a byte
    // (achado real, confirmado ao testar contra a Vercel real).
    const pdfBuffer = Buffer.from(await page.pdf(pdfOptions));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('gerar-pdf-html error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
}
