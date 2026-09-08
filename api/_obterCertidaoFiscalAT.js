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
//
// Primeira tentativa real (2026-09-08) falhou em
// input[placeholder="Número de Contribuinte"] — causa mais provável: o
// formulário de acesso.gov.pt corre dentro de um <iframe>, e o código
// original só procurava no frame principal da página. Corrigido para
// procurar em todos os frames (findInFrames) — sem confirmação ainda de que
// resolve, é a explicação mais plausível para este tipo de falha em
// portais de autenticação .gov, que costumam isolar o login num iframe.
import chromiumModule from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const chromium = chromiumModule.default ?? chromiumModule;

function addMeses(dataISO, meses) {
  const d = new Date(dataISO);
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

// Devolve o primeiro frame (a própria página, ou um dos seus <iframe>) que
// já tem o seletor no DOM — o formulário de login pode estar isolado num
// iframe, caso em que procurar só em `page` nunca encontra nada.
async function findInFrames(page, selector, { timeout = 10000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const el = await frame.$(selector).catch(() => null);
      if (el) return frame;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

// Clica no primeiro elemento que bate com o seletor CSS E contém o texto
// dado, em qualquer frame da página — mais resiliente a mudanças de
// classe/id do que um seletor CSS sozinho, e a login isolado num iframe.
// `exact`: compara o texto inteiro do elemento (trim), não uma substring —
// necessário para abas curtas como "NIF", onde `includes` também bateria
// com qualquer outro texto da página que contenha essas 3 letras.
async function clickByText(page, cssSelector, text, { timeout = 10000, exact = false } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const handle = await frame.evaluateHandle((sel, txt, ex) => {
        // eslint-disable-next-line no-undef -- corre no contexto da página (browser), não no Node
        const els = Array.from(document.querySelectorAll(sel));
        return els.find(el => {
          const t = el.textContent && el.textContent.trim();
          return ex ? t === txt : (t && t.includes(txt));
        }) || null;
      }, cssSelector, text, exact).catch(() => null);
      const el = handle?.asElement();
      if (el) {
        await el.click();
        return;
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Elemento "${cssSelector}" com texto "${text}" não encontrado (a AT pode ter mudado o layout).`);
}

// A aba "CC/CMD" fica ativa por omissão no formulário de login — clicar em
// "NIF" precisa de fazer a troca de facto acontecer, não só o clique
// disparar sem efeito (achado real, 2026-09-08: o primeiro clique não
// mudava de aba, ficava sempre em CC/CMD — provavelmente porque `includes`
// apanhava outro elemento antes do botão-aba real, ou porque um único
// clique não bastava). Confirma a troca depois de cada tentativa, em vez de
// assumir que funcionou.
async function selecionarAbaNif(page, { tentativas = 4, timeout = 10000 } = {}) {
  for (let i = 0; i < tentativas; i++) {
    // Texto EXATO "NIF", não substring — evita apanhar outro elemento.
    await clickByText(page, 'a, button, div, span, li', 'NIF', { timeout: 4000, exact: true }).catch(() => {});
    const trocou = await findInFrames(page, 'input[placeholder="Número de Contribuinte"]', { timeout: 2500 });
    if (trocou) return;
  }
  // Última tentativa: nenhuma correspondência exata funcionou — tenta por
  // substring, caso o texto real tenha espaços/carateres extra.
  await clickByText(page, 'a, button, div, span, li', 'NIF', { timeout }).catch(() => {});
}

// Captura um screenshot (base64) para anexar ao erro, quando algo falhar a
// meio — sem isto, diagnosticar uma falha de RPA é adivinhar às cegas onde
// o robô ficou preso.
async function screenshotDebug(page) {
  try {
    return await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 60 });
  } catch {
    return null;
  }
}

export async function obterCertidaoFiscalAT() {
  const utilizador = process.env.AT_UTILIZADOR;
  const senha = process.env.AT_SENHA;
  if (!utilizador || !senha) {
    throw new Error('AT_UTILIZADOR/AT_SENHA não configurados nas variáveis de ambiente.');
  }

  let browser;
  let page;
  try {
    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: chromium.headless,
    });
    page = await browser.newPage();
    page.setDefaultTimeout(15000);

    // Login — via portal público em vez de saltar direto para o formulário
    // de acesso.gov.pt, cujo URL completo (com parâmetros de redirect) não
    // foi confirmado; "Iniciar Sessão" redirige sempre para lá.
    await page.goto('https://www.portaldasfinancas.gov.pt/at/html/index.html', { waitUntil: 'networkidle2' });
    await clickByText(page, 'a, button', 'Iniciar Sessão');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

    // Aba "NIF" do formulário de autenticação — CC/CMD fica ativa por
    // omissão (confirmado por screenshot real, 2026-09-08), é preciso
    // trocar e VERIFICAR que trocou, não só clicar.
    await selecionarAbaNif(page);

    const loginFrame = await findInFrames(page, 'input[placeholder="Número de Contribuinte"]', { timeout: 15000 });
    if (!loginFrame) {
      const debug = await screenshotDebug(page);
      const err = new Error('Campo "Número de Contribuinte" não apareceu — o portal pode ter mudado de layout ou o login não redirecionou como esperado.');
      err.debugScreenshot = debug;
      err.debugUrl = page.url();
      throw err;
    }
    await loginFrame.type('input[placeholder="Número de Contribuinte"]', utilizador, { delay: 20 });
    await loginFrame.type('input[placeholder="Senha de Acesso"]', senha, { delay: 20 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
      clickByText(page, 'button', 'Autenticar'),
    ]);

    // Pesquisa interna do portal, em vez de navegar pelo menu "Os Seus
    // Serviços > Obter > Certidões" (depende de hovers/dropdowns) — mais
    // resiliente.
    const searchBox = await page.waitForSelector('input[placeholder*="Indique"]', { timeout: 15000 }).catch(() => null);
    if (!searchBox) {
      const debug = await screenshotDebug(page);
      const err = new Error('Caixa de pesquisa do portal não apareceu depois do login — a autenticação pode ter falhado.');
      err.debugScreenshot = debug;
      err.debugUrl = page.url();
      throw err;
    }
    await searchBox.click({ clickCount: 3 });
    await searchBox.type('Pedir Certidão', { delay: 20 });
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

    await clickByText(page, 'a', 'Pedir Certidão', { timeout: 10000 });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

    // Dropdown "Certidão:" — select nativo (confirmado pela UI de opções em
    // radio buttons do Chrome Android, típica de <select> nativo).
    const selectFound = await page.waitForSelector('select', { timeout: 10000 }).then(() => true).catch(() => false);
    if (!selectFound) {
      const debug = await screenshotDebug(page);
      const err = new Error('Dropdown "Certidão:" não apareceu na página de pedido.');
      err.debugScreenshot = debug;
      err.debugUrl = page.url();
      throw err;
    }
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
  } catch (err) {
    // Se ainda não tiver debug anexado (falha nalgum ponto sem um dos
    // checkpoints acima), tenta capturar mesmo assim antes do browser fechar.
    if (page && !err.debugScreenshot) {
      err.debugScreenshot = await screenshotDebug(page);
      err.debugUrl = page.url();
    }
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}
