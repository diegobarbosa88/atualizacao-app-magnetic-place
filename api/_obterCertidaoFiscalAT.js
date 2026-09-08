// RPA — obtém a Certidão de Situação Fiscal Regularizada ("Dívida e Não
// Dívida") do Portal das Finanças, por não existir nenhuma API oficial para
// isto (ao contrário da Segurança Social, que tem webservices REST/SOAP —
// ver api/seguranca-social/index.js). Login feito com um UTILIZADOR
// SECUNDÁRIO da conta da empresa, criado em acesso.gov.pt > Gestão de
// Utilizadores, com um único perfil atribuído (CTF — Certidões Fiscais) —
// decisão do Diego, 2026-09-08: nunca guardar a credencial principal (acesso
// total à conta fiscal), só uma dedicada com o mínimo de permissão possível.
//
// Mesmo mecanismo de Chromium serverless já usado em api/_gerarPdfHtml.js
// (@sparticuz/chromium + puppeteer-core) — não inventado de novo aqui.
//
// Fluxo replicado a partir de screenshots reais do portal (2026-09-08), não
// documentação oficial (não existe) — mais frágil que uma integração por
// API: se a AT mudar o layout/fluxo, isto pode parar de funcionar sem aviso.
// Por decisão do Diego, corre só sob pedido manual (botão "Obter da AT"),
// não em cron automático, até se confirmar que aguenta vários meses seguidos.
import chromiumModule from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const chromium = chromiumModule.default ?? chromiumModule;

function addMeses(dataISO, meses) {
  const d = new Date(dataISO);
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

// Clica no primeiro elemento que bate com o seletor CSS E contém o texto
// dado — mais resiliente a mudanças de classe/id do que um seletor CSS
// sozinho, que é o que o portal da AT tende a mudar entre versões.
async function clickByText(page, cssSelector, text, { timeout = 10000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const handle = await page.evaluateHandle((sel, txt) => {
      // eslint-disable-next-line no-undef -- corre no contexto da página (browser), não no Node
      const els = Array.from(document.querySelectorAll(sel));
      return els.find(el => el.textContent && el.textContent.trim().includes(txt)) || null;
    }, cssSelector, text);
    const el = handle.asElement();
    if (el) {
      await el.click();
      return;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Elemento "${cssSelector}" com texto "${text}" não encontrado (a AT pode ter mudado o layout).`);
}

export async function obterCertidaoFiscalAT() {
  const utilizador = process.env.AT_UTILIZADOR;
  const senha = process.env.AT_SENHA;
  if (!utilizador || !senha) {
    throw new Error('AT_UTILIZADOR/AT_SENHA não configurados nas variáveis de ambiente.');
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
    page.setDefaultTimeout(15000);

    // Login — via portal público em vez de saltar direto para o formulário
    // de acesso.gov.pt, cujo URL completo (com parâmetros de redirect) não
    // foi confirmado; "Iniciar Sessão" redirige sempre para lá.
    await page.goto('https://www.portaldasfinancas.gov.pt/at/html/index.html', { waitUntil: 'networkidle2' });
    await clickByText(page, 'a, button', 'Iniciar Sessão');
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});

    // Aba "NIF" do formulário de autenticação (por omissão pode abrir noutra
    // aba — CC/CMD).
    await clickByText(page, 'a, button, div, span', 'NIF', { timeout: 8000 }).catch(() => {});

    await page.waitForSelector('input[placeholder="Número de Contribuinte"]', { timeout: 8000 });
    await page.type('input[placeholder="Número de Contribuinte"]', utilizador, { delay: 20 });
    await page.type('input[placeholder="Senha de Acesso"]', senha, { delay: 20 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
      clickByText(page, 'button', 'Autenticar'),
    ]);

    // Pesquisa interna do portal, em vez de navegar pelo menu "Os Seus
    // Serviços > Obter > Certidões" (depende de hovers/dropdowns) — mais
    // resiliente.
    const searchBox = await page.waitForSelector('input[placeholder*="Indique"]', { timeout: 10000 });
    await searchBox.click({ clickCount: 3 });
    await searchBox.type('Pedir Certidão', { delay: 20 });
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

    await clickByText(page, 'a', 'Pedir Certidão', { timeout: 10000 });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

    // Dropdown "Certidão:" — select nativo (confirmado pela UI de opções em
    // radio buttons do Chrome Android, típica de <select> nativo).
    await page.waitForSelector('select', { timeout: 10000 });
    const opcaoEncontrada = await page.evaluate(() => {
      // eslint-disable-next-line no-undef -- corre no contexto da página (browser), não no Node
      const select = document.querySelector('select');
      if (!select) return false;
      const option = Array.from(select.options).find(o => o.textContent.trim() === 'Dívida e Não Dívida');
      if (!option) return false;
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    });
    if (!opcaoEncontrada) throw new Error('Opção "Dívida e Não Dívida" não encontrada no dropdown de certidão.');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {}),
      clickByText(page, 'button', 'Confirmar'),
    ]);

    // "OBTER" devolve o PDF diretamente na resposta HTTP — interceta-se a
    // resposta em vez de esperar um download, mais fiável em Chromium
    // headless (sem UI de download).
    const [pdfResponse] = await Promise.all([
      page.waitForResponse(
        r => (r.headers()['content-type'] || '').includes('application/pdf'),
        { timeout: 20000 }
      ),
      clickByText(page, 'button', 'Obter'),
    ]);
    const pdfBuffer = Buffer.from(await pdfResponse.buffer());
    if (!pdfBuffer.length) throw new Error('O Portal das Finanças devolveu um PDF vazio.');

    const hoje = new Date().toISOString().slice(0, 10);
    return { pdfBuffer, dataEmissao: hoje, dataValidade: addMeses(hoje, 4) };
  } finally {
    if (browser) await browser.close();
  }
}
