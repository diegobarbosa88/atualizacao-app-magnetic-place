// RPA — obtém o RNT ("Extrato Declaração") e o TC2 ("Extrato Resumo") do
// portal Segurança Social Direta, por não existir nenhuma API PSI que
// devolva estes documentos (o webservice SOAP `consultarFicheiro`, já
// implementado em api/seguranca-social/_soapUtils.js, só devolve o ESTADO da
// declaração, não os PDFs). Mesmo mecanismo de Chromium serverless já usado
// em api/_obterCertidaoFiscalAT.js (@sparticuz/chromium + puppeteer-core) —
// helpers de baixo nível (findInFrames, clickByText, captura de download via
// CDP) duplicados a partir de lá em vez de partilhados num módulo comum, por
// serem pequenos e o resto do fluxo ser bastante diferente (login CAS em vez
// de React, pesquisa com formulário + tabela em vez de select/submit).
//
// Fluxo replicado a partir de screenshots reais do portal (2026-09-09), não
// documentação oficial (não existe) — mais frágil que uma integração por
// API: se a SS mudar o layout/fluxo, isto pode parar de funcionar sem aviso.
// Login via CAS (`seg-social.pt/sso/login`), utilizador = NISS + senha.
//
// Por omissão obtém o MÊS ANTERIOR ao atual (decisão do Diego, 2026-09-09 —
// as declarações de remunerações são entregues no mês seguinte ao dos
// salários), com `anoMes` opcional para reprocessar um mês antigo.
import chromiumModule from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fsPromises from 'node:fs/promises';

const chromium = chromiumModule.default ?? chromiumModule;

function mesAnterior() {
  const hoje = new Date();
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Clica no primeiro elemento que bate com o seletor CSS E contém o texto
// dado (comparação exacta, trim), em qualquer frame da página.
async function clickByText(page, cssSelector, text, { timeout = 10000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const handle = await frame.evaluateHandle((sel, txt) => {
        // eslint-disable-next-line no-undef -- corre no contexto da página (browser), não no Node
        const els = Array.from(document.querySelectorAll(sel));
        return els.find(el => {
          const t = (el.textContent && el.textContent.trim()) || (el.value && el.value.trim()) || '';
          return t === txt;
        }) || null;
      }, cssSelector, text).catch(() => null);
      const el = handle?.asElement();
      if (el) {
        await el.click();
        return;
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Elemento "${cssSelector}" com texto "${text}" não encontrado (a SS pode ter mudado o layout).`);
}

// Preenche um <input> localizado pelo texto do <label>/rótulo mais próximo
// (procurado entre label/div/span/p com texto EXACTO igual ao dado) — mais
// resiliente do que adivinhar um id/name, que o portal pode gerar
// dinamicamente. Clica com triple-click (seleciona tudo) antes de escrever,
// para substituir qualquer valor pré-preenchido em vez de o concatenar.
async function preencherCampoPorLabel(page, labelText, value, { timeout = 10000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const handle = await frame.evaluateHandle((txt) => {
        /* eslint-disable no-undef -- corre no contexto da página (browser), não no Node */
        const candidatos = Array.from(document.querySelectorAll('label, div, span, p, strong, b'));
        const label = candidatos.find(el => el.textContent && el.textContent.trim() === txt);
        if (!label) return null;
        if (label.htmlFor) {
          const byFor = document.getElementById(label.htmlFor);
          if (byFor) return byFor;
        }
        let container = label;
        for (let i = 0; i < 3 && container; i++) {
          container = container.parentElement;
          if (!container) break;
          const input = container.querySelector('input');
          if (input) return input;
        }
        return null;
        /* eslint-enable no-undef */
      }, labelText).catch(() => null);
      const el = handle?.asElement();
      if (el) {
        await el.click({ clickCount: 3 }).catch(() => {});
        await el.type(String(value), { delay: 20 });
        return true;
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

// Localiza o bloco "Período de Referência" (heading + os 2 inputs "De"/"a"
// dentro do mesmo contentor, subindo até 3 níveis) e preenche os dois com o
// mesmo anoMes (consulta um único mês, não um intervalo). Usa o "native
// setter" de HTMLInputElement.value em vez de atribuição direta — necessário
// para o evento `input` disparado a seguir ser reconhecido por um campo
// controlado por JS (React/similar intercepta o setter normal), mesma
// técnica que evita o problema já documentado em
// api/_obterCertidaoFiscalAT.js (cliques sintéticos ignorados por Radix UI).
async function preencherPeriodoReferencia(page, anoMes, { timeout = 10000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const ok = await frame.evaluate((headingTxt, valor) => {
        /* eslint-disable no-undef -- corre no contexto da página (browser), não no Node */
        const headings = Array.from(document.querySelectorAll('label, div, span, p, strong, b'));
        const h = headings.find(el => el.textContent && el.textContent.trim() === headingTxt);
        if (!h) return false;
        let container = h.parentElement;
        for (let i = 0; i < 3 && container; i++) {
          const inputs = container.querySelectorAll('input');
          if (inputs.length >= 2) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            for (const input of [inputs[0], inputs[1]]) {
              nativeSetter.call(input, valor);
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              input.dispatchEvent(new Event('blur', { bubbles: true }));
            }
            return true;
          }
          container = container.parentElement;
        }
        return false;
        /* eslint-enable no-undef */
      }, 'Período de Referência', anoMes).catch(() => false);
      if (ok) return true;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

// Conta as linhas de resultados da tabela de "Declarações de remunerações"
// — localizada por ter uma célula de cabeçalho a começar por "Ano/Mês",
// mais específico do que o heading da secção (que colide com o título da
// própria página).
async function contarLinhasResultado(page, { timeout = 15000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const n = await frame.evaluate(() => {
        /* eslint-disable no-undef -- corre no contexto da página (browser), não no Node */
        const ths = Array.from(document.querySelectorAll('th, td'));
        const anoMesTh = ths.find(el => el.textContent && el.textContent.trim().startsWith('Ano/Mês'));
        const table = anoMesTh?.closest('table');
        if (!table) return null;
        return table.querySelectorAll('tbody tr').length;
        /* eslint-enable no-undef */
      }).catch(() => null);
      if (n != null) return { frame, count: n };
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return { frame: null, count: 0 };
}

// Clica o link "Ações" da linha `indiceLinha` (0-based) da tabela de
// resultados, espera o menu suspenso abrir, e clica no item com o texto
// dado ("Extrato Declaração"/"Extrato Resumo").
async function clicarAcaoEExtrato(frame, indiceLinha, textoItem) {
  const handleAcao = await frame.evaluateHandle((idx) => {
    /* eslint-disable no-undef -- corre no contexto da página (browser), não no Node */
    const ths = Array.from(document.querySelectorAll('th, td'));
    const anoMesTh = ths.find(el => el.textContent && el.textContent.trim().startsWith('Ano/Mês'));
    const table = anoMesTh?.closest('table');
    if (!table) return null;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const row = rows[idx];
    if (!row) return null;
    const links = Array.from(row.querySelectorAll('a, button'));
    return links.find(el => el.textContent && el.textContent.trim() === 'Ações') || null;
    /* eslint-enable no-undef */
  }, indiceLinha).catch(() => null);
  const elAcao = handleAcao?.asElement();
  if (!elAcao) throw new Error(`Link "Ações" da linha ${indiceLinha} não encontrado.`);
  await elAcao.click();
  await new Promise(r => setTimeout(r, 500));

  const handleItem = await frame.evaluateHandle((txt) => {
    /* eslint-disable no-undef -- corre no contexto da página (browser), não no Node */
    function visivel(el) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
    const items = Array.from(document.querySelectorAll('a, button, li, div, span'));
    return items.find(el => el.textContent && el.textContent.trim() === txt && visivel(el)) || null;
    /* eslint-enable no-undef */
  }, textoItem).catch(() => null);
  const elItem = handleItem?.asElement();
  if (!elItem) throw new Error(`Item "${textoItem}" não encontrado no menu de Ações.`);
  await elItem.click();
}

// Captura um download nativo do Chromium via CDP — mesmo mecanismo já
// validado em api/_obterCertidaoFiscalAT.js (ver comentário lá para o
// histórico da descoberta): Browser.setDownloadBehavior com
// eventsEnabled:true, escuta downloadWillBegin/downloadProgress, e faz
// retry ao ler o ficheiro (corrida entre o evento 'completed' chegar e o
// flush a disco terminar).
async function capturarDownload(browser, disparar, timeoutMs) {
  const downloadDir = `/tmp/ssd-declaracao-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await fsPromises.mkdir(downloadDir, { recursive: true });

  const browserCdp = await browser.target().createCDPSession();
  await browserCdp.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadDir,
    eventsEnabled: true,
  });

  const downloadPromise = new Promise((resolve, reject) => {
    let guid = null;
    let suggestedFilename = null;

    const onWillBegin = (evt) => {
      guid = evt.guid;
      suggestedFilename = evt.suggestedFilename;
    };
    const onProgress = (evt) => {
      if (guid && evt.guid !== guid) return;
      if (evt.state === 'completed') {
        limpar();
        resolve({ guid: evt.guid, suggestedFilename });
      } else if (evt.state === 'canceled') {
        limpar();
        reject(new Error('O download do PDF foi cancelado pelo browser.'));
      }
    };
    const limpar = () => {
      clearTimeout(temporizador);
      browserCdp.off('Browser.downloadWillBegin', onWillBegin);
      browserCdp.off('Browser.downloadProgress', onProgress);
    };

    browserCdp.on('Browser.downloadWillBegin', onWillBegin);
    browserCdp.on('Browser.downloadProgress', onProgress);

    const temporizador = setTimeout(() => {
      limpar();
      reject(new Error(`Timed out after waiting ${timeoutMs}ms for the PDF download to complete`));
    }, timeoutMs);
  });

  await disparar();
  const { guid: guidFicheiro, suggestedFilename } = await downloadPromise;

  const candidatosNome = [guidFicheiro, suggestedFilename].filter(Boolean);
  let pdfBuffer = null;
  let ultimoErro = null;
  for (let tentativa = 0; tentativa < 6 && !pdfBuffer; tentativa++) {
    for (const nome of candidatosNome) {
      try {
        pdfBuffer = await fsPromises.readFile(`${downloadDir}/${nome}`);
        break;
      } catch (e) {
        ultimoErro = e;
      }
    }
    if (!pdfBuffer) await new Promise((r) => setTimeout(r, 300));
  }

  const ficheirosReais = pdfBuffer ? null : await fsPromises.readdir(downloadDir).catch(() => []);
  await fsPromises.rm(downloadDir, { recursive: true, force: true }).catch(() => {});

  if (!pdfBuffer) {
    throw new Error(
      `Download completo (guid=${guidFicheiro}, suggestedFilename=${suggestedFilename}) mas não foi possível ler o ficheiro. ` +
      `Ficheiros reais em ${downloadDir}: [${(ficheirosReais || []).join(', ')}]. Último erro: ${ultimoErro?.message}`
    );
  }
  return pdfBuffer;
}

async function screenshotDebug(page) {
  try {
    return await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 60 });
  } catch {
    return null;
  }
}

export async function obterDeclaracoesRemuneracoesSSD({ anoMes } = {}) {
  const utilizador = process.env.SS_DIRETA_UTILIZADOR;
  const senha = process.env.SS_DIRETA_SENHA;
  if (!utilizador || !senha) {
    throw new Error('SS_DIRETA_UTILIZADOR/SS_DIRETA_SENHA não configurados nas variáveis de ambiente.');
  }
  const periodo = anoMes || mesAnterior();

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

    // Login CAS — URL confirmada pelo Diego, 2026-09-09.
    await page.goto(
      'https://www.seg-social.pt/sso/login?service=' + encodeURIComponent('https://www.seg-social.pt/ptss/caslogin'),
      { waitUntil: 'networkidle2' },
    );

    const preencheuUtilizador = await preencherCampoPorLabel(page, 'Utilizador', utilizador);
    const preencheuSenha = preencheuUtilizador ? await preencherCampoPorLabel(page, 'Palavra-passe', senha) : false;
    if (!preencheuUtilizador || !preencheuSenha) {
      const debug = await screenshotDebug(page);
      const err = new Error('Campos de login (Utilizador/Palavra-passe) não encontrados — a SS pode ter mudado o layout.');
      err.debugScreenshot = debug;
      err.debugUrl = page.url();
      throw err;
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
      clickByText(page, 'button, input[type="submit"]', 'Entrar'),
    ]);

    // Página de pesquisa de declarações de remunerações — URL confirmada
    // pelo Diego ao navegar manualmente, 2026-09-09 (sem o parâmetro
    // `dswid`, que parece ser um id de janela gerado por sessão).
    await page.goto('https://www.seg-social.pt/ptss/gr/pesquisa/consultarDR', { waitUntil: 'networkidle2' });

    const preencheuPeriodo = await preencherPeriodoReferencia(page, periodo);
    if (!preencheuPeriodo) {
      const debug = await screenshotDebug(page);
      const err = new Error('Campo "Período de Referência" não encontrado na página de pesquisa.');
      err.debugScreenshot = debug;
      err.debugUrl = page.url();
      throw err;
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      clickByText(page, 'button, input[type="submit"]', 'Pesquisar'),
    ]);
    await new Promise(r => setTimeout(r, 1000));

    const { frame, count } = await contarLinhasResultado(page);
    if (!frame || count === 0) {
      return { periodo, disponivel: false };
    }

    // Assume um único estabelecimento (confirmado pelo Diego — Magnetic
    // Place tem só a linha "Estab. 1") — usa sempre a primeira linha.
    const rntBuffer = await capturarDownload(
      browser,
      () => clicarAcaoEExtrato(frame, 0, 'Extrato Declaração'),
      20000,
    );
    const tc2Buffer = await capturarDownload(
      browser,
      () => clicarAcaoEExtrato(frame, 0, 'Extrato Resumo'),
      20000,
    );

    if (!rntBuffer.length || !tc2Buffer.length) {
      throw new Error('A Segurança Social devolveu um PDF vazio (RNT ou TC2).');
    }

    return { periodo, disponivel: true, rntBuffer, tc2Buffer };
  } catch (err) {
    if (page && !err.debugScreenshot) {
      err.debugScreenshot = await screenshotDebug(page);
      err.debugUrl = page.url();
    }
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}
