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
//
// 2ª e 3ª tentativas (mesmo dia): clique por texto exato via Puppeteer, e
// depois clique nativo (el.click()) em vez de clique por coordenadas —
// ambas falharam de forma IDÊNTICA ao testar ao vivo (mesma aba "CC/CMD"
// visualmente ativa, "NIF" nunca troca). Como três mecanismos de clique
// diferentes dão o mesmo resultado, o problema provavelmente não é COMO se
// clica — é O QUÊ está a ser encontrado. 4ª tentativa: filtrar candidatos
// por visibilidade real antes de clicar + capturar a estrutura real de
// TODOS os candidatos (outerHTML, visibilidade) se mesmo assim falhar.
//
// 4ª tentativa CONFIRMOU a causa parcial: o dump de diagnóstico mostrou 2
// pares idênticos de "NIF" no DOM (confirmado depois, ao vivo, por
// inspeção direta do portal real, 2026-09-08 — é um formulário de login
// Radix UI duplicado, um para mobile escondido via CSS "d-md-none", um para
// desktop, sempre os dois no DOM independentemente do viewport) — mas
// mesmo já a clicar no candidato certo (confirmado `visivel: true` no
// dump), a aba continuou sem trocar ao fim de 6 tentativas. Isso aponta
// para uma segunda causa: el.click() dispara um evento SINTÉTICO
// (isTrusted: false); um clique real do Diego no browser funcionou
// instantaneamente. 5ª tentativa: mantém o filtro de visibilidade (já
// provado certo), mas troca o mecanismo de clique de el.click() sintético
// para o clique REAL do Puppeteer (ElementHandle.click(), via CDP) — a
// primeira vez que as duas correções (elemento certo + clique fiável) são
// combinadas.
//
// 5ª tentativa CONFIRMOU que a aba NIF ficou resolvida — o robô passou a
// entrar com sucesso (screenshot real: "Boa noite, Rpa Certidões"),
// navegar até "Emissão de Certidão" e selecionar o dropdown, falhando só
// mais à frente em "Elemento 'button' com texto Confirmar não encontrado".
// Causa: essa página já não é o formulário React do login (acesso.gov.pt)
// — é a página clássica de serviços do portal (portaldasfinancas.gov.pt),
// onde "Confirmar"/"Obter" são tipicamente <input type="submit">, não
// <button>, e <input> não tem textContent (o rótulo vive no atributo
// `value`). Seletor alargado para incluir input[type="submit"/"button"] +
// clickByText também a comparar `value`, não só `textContent`.
//
// 6ª tentativa: a 5ª CONFIRMOU que "Confirmar" ficou resolvido — o robô
// chegou à página final ("Pedido de Certificação de Dívida e Não Dívida",
// screenshot real com NIF/Nome/Tipo já preenchidos, botão OBTER visível),
// clicou "Obter" sem erro de elemento, mas o PDF nunca chegou
// (page.waitForResponse deu timeout aos 20s). Causa mais provável: "Obter"
// abre o PDF numa aba/janela NOVA (comum em páginas .gov mais antigas via
// target="_blank"), que page.waitForResponse nunca alcança por só ouvir a
// página onde foi chamado. Também simplificado o passo de chegar à página
// de pedido: em vez de pesquisa interna + clique num link, navegação
// direta ao URL confirmado pelo Diego ao navegar manualmente
// (emissaoCertidaoForm.action).
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
//
// Lê `value` além de `textContent` (achado real, 2026-09-08) — um
// `<input type="submit" value="Confirmar">`, típico da página clássica de
// serviços do portal, não tem `textContent` nenhum (elementos `<input>` não
// têm filhos/texto interno, o rótulo vive só no atributo `value`); sem
// isto, o robô nunca encontrava o botão "Confirmar"/"Obter" dessa página,
// apesar do seletor já incluir `input[type="submit"]`.
async function clickByText(page, cssSelector, text, { timeout = 10000, exact = false } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const handle = await frame.evaluateHandle((sel, txt, ex) => {
        // eslint-disable-next-line no-undef -- corre no contexto da página (browser), não no Node
        const els = Array.from(document.querySelectorAll(sel));
        return els.find(el => {
          const t = (el.textContent && el.textContent.trim()) || (el.value && el.value.trim()) || '';
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

// Marca (com um atributo temporário) o elemento correto — visível, subindo
// até 4 níveis na árvore à procura de um ancestral com role="tab"/button/a
// — sem o clicar. Devolve o seletor do atributo para o Node conseguir obter
// um ElementHandle Puppeteer real do mesmo elemento a seguir, em vez de o
// clicar aqui dentro do browser.
//
// Separado em duas fases (marcar em frame.evaluate, clicar via
// ElementHandle.click() do Puppeteer) porque o achado do Diego, 2026-09-08
// (confirmado ao vivo: o candidato certo já era identificado como
// `visivel: true` no dump de diagnóstico, mas 6 tentativas de
// frame.evaluate(() => el.click()) não faziam a aba trocar) aponta para uma
// causa diferente da que se pensava — não é "elemento errado" (já resolvido
// pelo filtro de visibilidade), é que el.click() dispara um evento
// SINTÉTICO (isTrusted: false), e um componente Radix UI (confirmado pelas
// classes "data-radix-collection-item"/"radix-:xx:-trigger" no dump) pode
// não reagir da mesma forma a um clique não fiável. O Puppeteer
// ElementHandle.click() simula um clique REAL via CDP (sequência completa
// mousedown/mouseup/click, isTrusted: true) — o mesmo mecanismo que as
// tentativas 1 e 2 já usavam, mas sempre no elemento ERRADO (invisível),
// porque não existia ainda o filtro de visibilidade. Esta é a primeira
// tentativa a combinar as duas correções.
async function marcarAbaVisivel(frame, cssSelector, text, marcador) {
  return frame.evaluate((sel, txt, marc) => {
    /* eslint-disable no-undef -- corre no contexto da página (browser), não no Node */
    function visivel(el) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
    const els = Array.from(document.querySelectorAll(sel));
    /* eslint-enable no-undef */
    const el = els.find(e => e.textContent && e.textContent.trim() === txt && visivel(e));
    if (!el) return false;
    let target = el;
    for (let i = 0; i < 4 && target; i++) {
      if (target.getAttribute?.('role') === 'tab' || target.tagName === 'BUTTON' || target.tagName === 'A') break;
      target = target.parentElement;
    }
    (target || el).setAttribute(marc, '1');
    return true;
  }, cssSelector, text, marcador).catch(() => false);
}

// Clica de facto o elemento marcado por marcarAbaVisivel, num frame — clique
// REAL do Puppeteer (ElementHandle.click(), via CDP), não o el.click()
// sintético usado nas tentativas anteriores.
async function clicarMarcado(frame, marcador) {
  const handle = await frame.$(`[${marcador}]`).catch(() => null);
  if (!handle) return false;
  try {
    await handle.click();
    return true;
  } catch {
    return false;
  } finally {
    await handle.dispose().catch(() => {});
  }
}

// Diagnóstico de último recurso, acrescentado depois de 3 estratégias de
// clique diferentes falharem de forma idêntica (2026-09-08) — até agora só
// havia screenshot, que mostra o resultado visual mas não a estrutura real
// do DOM. Captura TODOS os elementos que batem com o texto exato dado, em
// qualquer frame, visíveis ou não, com outerHTML truncado — para finalmente
// inspecionar se existe mais do que um "NIF" na página (ex. clone
// invisível) em vez de continuar a adivinhar pela imagem.
async function dumpCandidatosTexto(page, cssSelector, text) {
  const candidatos = [];
  for (const frame of page.frames()) {
    const dados = await frame.evaluate((sel, txt) => {
      /* eslint-disable no-undef -- corre no contexto da página (browser), não no Node */
      function visivel(el) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }
      const els = Array.from(document.querySelectorAll(sel));
      /* eslint-enable no-undef */
      return els
        .filter(e => e.textContent && e.textContent.trim() === txt)
        .map(e => ({
          tag: e.tagName,
          role: e.getAttribute('role'),
          className: typeof e.className === 'string' ? e.className.slice(0, 150) : '',
          visivel: visivel(e),
          outerHtml: e.outerHTML.slice(0, 400),
        }));
    }, cssSelector, text).catch(() => []);
    for (const d of dados) candidatos.push({ frameUrl: frame.url(), ...d });
  }
  return candidatos;
}

// A aba "CC/CMD" fica ativa por omissão no formulário de login — clicar em
// "NIF" precisa de fazer a troca de facto acontecer, não só o clique
// disparar sem efeito (achado real, 2026-09-08: 4 tentativas diferentes já
// falharam, incluindo com filtro de visibilidade a confirmar que o
// candidato certo estava a ser encontrado). Marca o elemento certo em cada
// frame, clica com o Puppeteer real (CDP), confirma a troca depois de cada
// tentativa — nunca assume que um clique bastou.
async function selecionarAbaNif(page, { tentativas = 6 } = {}) {
  const marcador = 'data-at-rpa-alvo';
  for (let i = 0; i < tentativas; i++) {
    for (const frame of page.frames()) {
      const marcado = await marcarAbaVisivel(frame, 'a, button, div, span, li, [role="tab"]', 'NIF', marcador);
      if (marcado) await clicarMarcado(frame, marcador);
    }
    const trocou = await findInFrames(page, 'input[placeholder="Número de Contribuinte"]', { timeout: 1500 });
    if (trocou) return;
  }
  const candidatos = await dumpCandidatosTexto(page, 'a, button, div, span, li, [role="tab"]', 'NIF');
  const err = new Error('Não foi possível mudar para a aba "NIF" do formulário de login.');
  err.debugCandidates = candidatos;
  throw err;
}

// Aguarda uma resposta PDF na página dada OU em qualquer aba/janela nova
// criada pelo browser durante a espera — page.waitForResponse sozinho só
// vê respostas da própria página, e uma página .gov mais antiga (como a
// de emissão de certidões, ao contrário do login React) pode abrir o PDF
// numa aba nova (target="_blank") em vez de servi-lo na mesma página.
function aguardarRespostaPdfEmQualquerAba(browser, page, timeoutMs) {
  return new Promise((resolve, reject) => {
    let resolvido = false;
    const paginasOuvidas = new Set();

    const ehPdf = (r) => (r.headers()['content-type'] || '').includes('application/pdf');

    const onResponse = (r) => {
      if (resolvido || !ehPdf(r)) return;
      resolvido = true;
      limpar();
      resolve(r);
    };

    const ouvirPagina = (p) => {
      if (paginasOuvidas.has(p)) return;
      paginasOuvidas.add(p);
      p.on('response', onResponse);
    };

    const onTargetCreated = async (target) => {
      if (target.type() !== 'page') return;
      const novaPagina = await target.page().catch(() => null);
      if (novaPagina) ouvirPagina(novaPagina);
    };

    const limpar = () => {
      clearTimeout(temporizador);
      for (const p of paginasOuvidas) p.off('response', onResponse);
      browser.off('targetcreated', onTargetCreated);
    };

    ouvirPagina(page);
    browser.on('targetcreated', onTargetCreated);

    const temporizador = setTimeout(() => {
      if (resolvido) return;
      limpar();
      reject(new Error(`Timed out after waiting ${timeoutMs}ms for a PDF response`));
    }, timeoutMs);
  });
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

    // Navegação direta ao URL da página de pedido de certidão, em vez de
    // pesquisa interna + clique num link — encontrado e confirmado pelo
    // Diego ao navegar manualmente, 2026-09-08 ("vai para o lugar certo").
    // Mais direto e menos frágil do que depender do texto/comportamento da
    // caixa de pesquisa interna do portal (a verificação do dropdown logo a
    // seguir continua a servir de rede de segurança se este URL um dia
    // deixar de levar ao sítio certo).
    await page.goto('https://www.portaldasfinancas.gov.pt/pt/emissaoCertidaoForm.action', { waitUntil: 'networkidle2' });

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

    // "Confirmar"/"Obter" vivem na página clássica de serviços do portal
    // (portaldasfinancas.gov.pt), não no formulário React moderno do login
    // (acesso.gov.pt) — achado real, 2026-09-08: o robô chegou até aqui com
    // sucesso (login e seleção do dropdown confirmados por screenshot), mas
    // falhou em "Elemento 'button' com texto Confirmar não encontrado".
    // Página clássica deste tipo tipicamente usa <input type="submit">, não
    // <button> — seletor alargado para cobrir os dois casos.
    const SELETOR_BOTAO_CLASSICO = 'button, input[type="submit"], input[type="button"]';

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {}),
      clickByText(page, SELETOR_BOTAO_CLASSICO, 'Confirmar'),
    ]);

    // "OBTER" devolve o PDF diretamente na resposta HTTP — interceta-se a
    // resposta em vez de esperar um download, mais fiável em Chromium
    // headless (sem UI de download).
    //
    // Achado real, 2026-09-08: o clique em "Obter" funcionou (sem erro de
    // "elemento não encontrado"), mas page.waitForResponse (scoped só à
    // página original) nunca via o PDF — timeout aos 20s, confirmado por
    // screenshot mostrando a página de pedido ainda visível, sem navegação
    // nem erro algum. Causa mais provável: "Obter" abre o PDF numa NOVA
    // aba/janela (comum em páginas .gov mais antigas, via target="_blank"),
    // que page.waitForResponse nunca alcança por estar limitado à página
    // onde foi chamado. aguardarRespostaPdfEmQualquerAba ouve respostas na
    // página original E em qualquer aba nova criada pelo browser.
    const [pdfResponse] = await Promise.all([
      aguardarRespostaPdfEmQualquerAba(browser, page, 20000),
      clickByText(page, SELETOR_BOTAO_CLASSICO, 'Obter'),
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
