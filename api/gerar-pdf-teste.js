// Rota de teste isolada — mede cold start real do Chromium serverless
// (@sparticuz/chromium + puppeteer-core) na Vercel, para decidir se compensa
// migrar o Fluxo 3 (documentos assinados) da PDF.co para este motor.
// Não é chamada por nenhum fluxo existente da app — só por testes manuais
// (curl) enquanto se mede o comportamento real.
//
// Protegida por segredo próprio (PDF_TEST_SECRET), mesmo padrão já usado em
// api/seguranca-social/index.js (AGENTE_SERVICE_SECRET) para rotas chamadas
// sem sessão de admin — sem isto, ficaria um gerador de PDF a partir de HTML
// arbitrário, publicamente acessível, capaz de o Chromium ir buscar recursos
// externos (SSRF) a qualquer pedido não autenticado.

import chromiumModule from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const chromium = chromiumModule.default ?? chromiumModule;

const HEADER_HEIGHT_PX = 76;
const FOOTER_HEIGHT_PX = 34;

export const config = {
  api: {
    bodyParser: { sizeLimit: '5mb' },
  },
};

function isAutorizado(req) {
  const secret = process.env.PDF_TEST_SECRET;
  return !!secret && req.headers['x-pdf-test-secret'] === secret;
}

export default async function handler(req, res) {
  if (!isAutorizado(req)) {
    return res.status(403).json({ error: 'Sem permissão para executar esta ação' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Usa POST.' });
  }

  const { html, useHeaderFooter = false, headerHtml = '', footerHtml = '' } = req.body || {};
  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'Falta o campo "html" no corpo do pedido.' });
  }

  const t0 = Date.now();
  let browser;
  try {
    const executablePath = await chromium.executablePath();
    const tLaunchStart = Date.now();
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: chromium.headless,
    });
    const tLaunched = Date.now();

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    const tContentSet = Date.now();

    const pdfOptions = {
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    };

    if (useHeaderFooter) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = headerHtml || '<div></div>';
      pdfOptions.footerTemplate = footerHtml || '<div></div>';
      pdfOptions.margin = {
        top: `${HEADER_HEIGHT_PX}px`,
        bottom: `${FOOTER_HEIGHT_PX}px`,
        left: '0px',
        right: '0px',
      };
    }

    const pdfBuffer = await page.pdf(pdfOptions);
    const tPdfDone = Date.now();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Timing-Launch-Ms', String(tLaunched - tLaunchStart));
    res.setHeader('X-Timing-SetContent-Ms', String(tContentSet - tLaunched));
    res.setHeader('X-Timing-Pdf-Ms', String(tPdfDone - tContentSet));
    res.setHeader('X-Timing-Total-Ms', String(tPdfDone - t0));
    res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('gerar-pdf-teste error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
}
