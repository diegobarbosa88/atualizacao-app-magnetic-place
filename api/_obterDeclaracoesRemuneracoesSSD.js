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
// Por omissão pesquisa um intervalo alargado (últimos 3 meses até o mês
// atual) e escolhe a declaração MAIS RECENTE encontrada — não um mês fixo
// (decisão do Diego, 2026-09-09, depois de confirmar ao vivo que o mês
// mais recente pode ainda não estar aceite na SS quando o RPA corre).
// `anoMes` opcional pesquisa e exige só esse mês exato, para reprocessar
// um mês antigo específico.
//
// A subconta criada para este RPA (2026-09-09) ficou sob autenticação de
// dois fatores obrigatória — login com NISS+senha continua a funcionar
// (confirmado pelo Diego), mas pede sempre um código de verificação por
// e-mail a seguir. Resolvido reaproveitando a integração Gmail já existente
// no projeto (api/gmail/import-faturas.js, mesmas env vars
// GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN) — confirmado
// pelo Diego que essa caixa (diegobarbosa@magneticplace.pt) é a mesma que
// recebe o código da SS. Formato do e-mail confirmado com um exemplo real
// (2026-09-09): remetente noreply@seg-social.pt, assunto "Código de
// verificação", corpo com "Código de verificação: NNNNNN" (6 dígitos).
import chromiumModule from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fsPromises from 'node:fs/promises';
import { google } from 'googleapis';

const chromium = chromiumModule.default ?? chromiumModule;

function gmailClient() {
  const auth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth });
}

// Extrai o texto simples de uma mensagem Gmail (percorre as partes
// multipart à procura de text/plain; cai para text/html sem tags só se não
// houver nenhuma parte de texto simples).
function extrairTextoMensagem(payload) {
  let textoPlano = null;
  let textoHtml = null;
  function percorrer(part) {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data && !textoPlano) {
      textoPlano = Buffer.from(part.body.data, 'base64url').toString('utf8');
    } else if (part.mimeType === 'text/html' && part.body?.data && !textoHtml) {
      textoHtml = Buffer.from(part.body.data, 'base64url').toString('utf8').replace(/<[^>]+>/g, ' ');
    }
    (part.parts || []).forEach(percorrer);
  }
  percorrer(payload);
  return textoPlano || textoHtml || '';
}

// Faz polling ao Gmail à procura do e-mail "Código de verificação" da SS
// mais recente que `desdeMs` — evita reaproveitar por engano o código de
// uma tentativa de login anterior (ex. se o RPA falhar e for corrido de
// novo pouco depois).
async function obterCodigoVerificacaoEmail(desdeMs, { timeout = 60000, intervalo = 3000 } = {}) {
  const gmail = gmailClient();
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:noreply@seg-social.pt subject:"Código de verificação"',
      maxResults: 5,
    }).catch(() => null);
    const ids = listRes?.data?.messages || [];
    for (const { id } of ids) {
      const full = await gmail.users.messages.get({ userId: 'me', id, format: 'full' }).catch(() => null);
      if (!full) continue;
      const internalDate = Number(full.data.internalDate || 0);
      if (internalDate < desdeMs) continue;
      const texto = extrairTextoMensagem(full.data.payload);
      const m = texto.match(/Código de verificação:\s*(\d{6})/);
      if (m) return m[1];
    }
    await new Promise(r => setTimeout(r, intervalo));
  }
  throw new Error('Código de verificação não chegou ao e-mail dentro do tempo limite.');
}

function anoMesAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

function subtrairMeses(anoMesBase, meses) {
  const [ano, mes] = anoMesBase.split('-').map(Number);
  const d = new Date(ano, mes - 1 - meses, 1);
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

// A secção "Autenticação com o seu utilizador da Segurança Social" (onde
// vivem os campos NISS/senha) pode estar colapsada por omissão, atrás de um
// accordion — achado real, 2026-09-09: o robô só via a opção "Cartão de
// Cidadão/Chave Móvel Digital" no screenshot de debug, sem os campos de
// login.
//
// Duas tentativas anteriores, baseadas em heurística de texto, falharam:
// (1) el.click() sintético dentro de frame.evaluate não teve efeito
// nenhum; (2) subir a árvore até um ancestral "clicável" e clicá-lo via
// ElementHandle.click() real (CDP) TAMBÉM não teve efeito. O Diego
// resolveu a dúvida inspecionando o HTML real do portal: o toggle é
// `<a id="toogleAuth" onclick="abrirSlideAutenticacao()">` — um handler
// inline clássico (jQuery/JSF), não um componente React (o que explica por
// que a heurística baseada em "onclick"/"cursor:pointer" nunca acertava —
// essas tentativas corriam antes de se saber o ID real). Com o ID exacto
// confirmado, `frame.click('#toogleAuth')` (clique real do Puppeteer via
// CDP) é muito mais direto e fiável do que qualquer heurística — usado
// primeiro; a lógica anterior (clicar em cada nível ascendente a partir do
// texto) fica como rede de segurança, só para o caso de a SS mudar o ID.
async function garantirSeccaoLoginAberta(page) {
  for (const frame of page.frames()) {
    const toggle = await frame.$('#toogleAuth').catch(() => null);
    if (toggle) {
      await toggle.dispose().catch(() => {});
      try {
        await frame.click('#toogleAuth');
        await new Promise(r => setTimeout(r, 500));
        return;
      } catch {
        // segue para o fallback por texto abaixo, neste mesmo frame
      }
    }
  }

  for (const frame of page.frames()) {
    const existeAlvo = await frame.evaluate(() => {
      /* eslint-disable no-undef -- corre no contexto da página (browser), não no Node */
      return Array.from(document.querySelectorAll('a, button, div, span, h2, h3, h4, strong, b')).some(el => {
        const t = el.textContent && el.textContent.trim().toLowerCase();
        return t && t.includes('utilizador da segurança social') && !t.startsWith('fechar');
      });
      /* eslint-enable no-undef */
    }).catch(() => false);
    if (!existeAlvo) continue;

    const marcador = 'data-ssd-rpa-toggle';
    for (let nivel = 0; nivel < 6; nivel++) {
      const marcou = await frame.evaluate((marc, n) => {
        /* eslint-disable no-undef -- corre no contexto da página (browser), não no Node */
        const candidatos = Array.from(document.querySelectorAll('a, button, div, span, h2, h3, h4, strong, b'));
        const textoAlvo = candidatos.find(el => {
          const t = el.textContent && el.textContent.trim().toLowerCase();
          return t && t.includes('utilizador da segurança social') && !t.startsWith('fechar');
        });
        if (!textoAlvo) return false;
        let target = textoAlvo;
        for (let i = 0; i < n && target.parentElement; i++) target = target.parentElement;
        document.querySelectorAll(`[${marc}]`).forEach(el => el.removeAttribute(marc));
        target.setAttribute(marc, '1');
        return true;
        /* eslint-enable no-undef */
      }, marcador, nivel).catch(() => false);
      if (!marcou) break;

      const handle = await frame.$(`[${marcador}]`).catch(() => null);
      if (handle) {
        await handle.click().catch(() => {});
        await handle.dispose().catch(() => {});
      }
      await new Promise(r => setTimeout(r, 400));

      const abriu = await frame.evaluate(() => {
        /* eslint-disable no-undef -- corre no contexto da página (browser), não no Node */
        return Array.from(document.querySelectorAll('label, div, span, p, strong, b'))
          .some(el => el.textContent && el.textContent.trim() === 'Utilizador');
        /* eslint-enable no-undef */
      }).catch(() => false);
      if (abriu) return;
    }
    return;
  }
}

// Preenche um <input> localizado por CSS selector directo (ex. "#username")
// em qualquer frame — mais fiável do que procurar por label quando se
// conhece o id real do campo (confirmado pelo Diego via inspeção do HTML
// real: os campos de login são exactamente #username/#password, o par
// clássico do CAS/Apereo). Triple-click antes de escrever, para substituir
// qualquer valor pré-preenchido em vez de o concatenar.
async function preencherCampoPorSeletor(page, seletor, value, { timeout = 10000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const el = await frame.$(seletor).catch(() => null);
      if (el) {
        await el.click({ clickCount: 3 }).catch(() => {});
        await el.type(String(value), { delay: 20 });
        await el.dispose().catch(() => {});
        // Fecha um eventual popup de datepicker (jQuery UI, campos
        // "hasDatepicker") que a digitação possa ter aberto, sem arriscar
        // reverter o valor digitado — Escape tem semântica de "cancelar"
        // no jQuery UI Datepicker e chegou a reverter o campo para o valor
        // anterior num teste real (achado, 2026-09-09: pesquisa com
        // intervalo alargado não encontrou nem a declaração de julho, já
        // confirmada existir). Tab move o foco e confirma o valor, sem
        // esse risco. Sem efeito em campos sem datepicker (login).
        await page.keyboard.press('Tab').catch(() => {});
        return true;
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
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

// Depois do clique em "Entrar", a SS pode pedir um código de verificação
// por e-mail (autenticação de dois fatores) — detectado pela presença do
// rótulo "Código de verificação de e-mail". Se não aparecer (2FA não pedido
// nesta sessão/subconta), não faz nada. `desdeMs` é o instante ANTES do
// clique em "Entrar" — usado para não reaproveitar por engano o código de
// uma tentativa de login anterior.
async function preencher2FASeNecessario(page, desdeMs) {
  let apareceu2FA = false;
  for (const frame of page.frames()) {
    const achou = await frame.evaluate(() => {
      // eslint-disable-next-line no-undef -- corre no contexto da página (browser), não no Node
      return Array.from(document.querySelectorAll('label, div, span, p, strong, b'))
        .some(el => el.textContent && el.textContent.trim() === 'Código de verificação de e-mail');
    }).catch(() => false);
    if (achou) { apareceu2FA = true; break; }
  }
  if (!apareceu2FA) return;

  const codigo = await obterCodigoVerificacaoEmail(desdeMs);
  const preencheu = await preencherCampoPorLabel(page, 'Código de verificação de e-mail', codigo);
  if (!preencheu) throw new Error('Campo "Código de verificação de e-mail" (2FA) não encontrado para preencher.');

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
    clickByText(page, 'button, input[type="submit"]', 'Confirmar código de verificação'),
  ]);
}

// IDs reais dos dois campos "Período de Referência" (De/a) — confirmados
// pelo Diego via inspeção do HTML real, 2026-09-09: PrimeFaces (JSF),
// formato "aaaa-mm". Os ":" fazem parte do id do PrimeFaces e têm de ser
// escapados em CSS. "Período de Entrega" não é tocado — fica com o valor
// por omissão que a própria página já carrega.
const SELETOR_PERIODO_REF_DE = '#dadosPesquisaDeclaracoes\\:dataReferenciaInicioMonthPicker\\:calendar_input';
const SELETOR_PERIODO_REF_A = '#dadosPesquisaDeclaracoes\\:dataReferenciaFimMonthPicker\\:calendar_input';

// Preenche os 2 campos "Período de Referência" (De/a) com um INTERVALO
// (não um único mês) — decisão do Diego, 2026-09-09: a declaração do mês
// mais recente pode ainda não estar aceite na SS quando o RPA corre
// (confirmado ao vivo: pesquisando só "2026-08" dava "sem resultados",
// mas alargando para "De 2026-07 a 2026-09" já aparecia a declaração real
// de julho). O robô escolhe depois a linha mais recente entre os
// resultados (ver obterDeclaracoesRemuneracoesSSD), em vez de assumir que
// o mês pedido tem sempre dados. Pelos IDs reais; fallback para a heurística
// antiga (heading + inputs no mesmo contentor, preenchendo os dois com
// `periodoDe`) só se os IDs tiverem mudado. Pequena espera entre os dois
// campos — mudar "De" pode disparar um postback AJAX do PrimeFaces (comum
// nestes formulários JSF) que precisa de tempo para assentar antes de
// mexer no campo "a", evitando uma corrida entre o preenchimento e esse
// callback.
async function preencherPeriodoReferencia(page, periodoDe, periodoA) {
  const preencheuDe = await preencherCampoPorSeletor(page, SELETOR_PERIODO_REF_DE, periodoDe);
  if (preencheuDe) await new Promise(r => setTimeout(r, 500));
  const preencheuA = preencheuDe ? await preencherCampoPorSeletor(page, SELETOR_PERIODO_REF_A, periodoA) : false;
  if (preencheuDe && preencheuA) return true;

  const deadline = Date.now() + 10000;
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
      }, 'Período de Referência', periodoDe).catch(() => false);
      if (ok) return true;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

// Devolve as linhas de resultado REAIS da tabela "Declarações de
// remunerações" — localizada por ter uma célula de cabeçalho a começar por
// "Ano/Mês" — com o respetivo Ano/Mês (2ª coluna). Sem resultados, o
// PrimeFaces normalmente devolve uma única linha com uma mensagem tipo
// "Não existem resultados..." em vez de dados reais; só entram linhas que
// tenham de facto o link "Ações" dentro, para não confundir isso com uma
// declaração real (achado real, 2026-09-09). `indice` é a posição DENTRO
// deste subconjunto já filtrado (0-based) — o mesmo índice que
// clicarAcaoEExtrato espera, não a posição na tabela completa.
async function obterLinhasValidas(page, { timeout = 15000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const linhas = await frame.evaluate(() => {
        /* eslint-disable no-undef -- corre no contexto da página (browser), não no Node */
        const ths = Array.from(document.querySelectorAll('th, td'));
        const anoMesTh = ths.find(el => el.textContent && el.textContent.trim().startsWith('Ano/Mês'));
        const table = anoMesTh?.closest('table');
        if (!table) return null;
        return Array.from(table.querySelectorAll('tbody tr'))
          .filter(row => Array.from(row.querySelectorAll('a, button'))
            .some(el => el.textContent && el.textContent.trim() === 'Ações'))
          .map((row, indice) => ({ indice, anoMes: row.querySelectorAll('td')[1]?.textContent?.trim() || null }));
        /* eslint-enable no-undef */
      }).catch(() => null);
      if (linhas != null) return { frame, linhas };
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return { frame: null, linhas: [] };
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
    // Mesma filtragem de obterLinhasValidas — só linhas com o link
    // "Ações" de facto contam como resultado real, não a linha de
    // "Não existem resultados..." que o PrimeFaces devolve sem dados.
    const rows = Array.from(table.querySelectorAll('tbody tr')).filter(row =>
      Array.from(row.querySelectorAll('a, button')).some(el => el.textContent && el.textContent.trim() === 'Ações'));
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
  // "De": intervalo alargado (3 meses atrás) quando anoMes não é pedido
  // explicitamente — a declaração mais recente pode ainda não estar aceite
  // na SS no momento em que o RPA corre (ver preencherPeriodoReferencia
  // para o achado real que motivou isto). Quando anoMes É pedido
  // (reprocessar um mês específico), pesquisa só esse mês exato.
  const periodoDe = anoMes || subtrairMeses(anoMesAtual(), 3);
  const periodoA = anoMes || anoMesAtual();

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
    // Viewport largo o suficiente para a secção "Autenticação com o seu
    // utilizador da Segurança Social" (NISS/senha) ficar dentro da área
    // capturada — o viewport pequeno por omissão (800x600) do Puppeteer
    // deixava-a fora do screenshot de debug, achado real, 2026-09-09.
    await page.setViewport({ width: 1280, height: 1600 });

    // Login CAS — URL confirmada pelo Diego, 2026-09-09.
    await page.goto(
      'https://www.seg-social.pt/sso/login?service=' + encodeURIComponent('https://www.seg-social.pt/ptss/caslogin'),
      { waitUntil: 'networkidle2' },
    );

    await garantirSeccaoLoginAberta(page);
    const preencheuUtilizador = await preencherCampoPorSeletor(page, '#username', utilizador);
    const preencheuSenha = preencheuUtilizador ? await preencherCampoPorSeletor(page, '#password', senha) : false;
    if (!preencheuUtilizador || !preencheuSenha) {
      const debug = await screenshotDebug(page);
      const err = new Error('Campos de login (Utilizador/Palavra-passe) não encontrados — a SS pode ter mudado o layout.');
      err.debugScreenshot = debug;
      err.debugUrl = page.url();
      throw err;
    }

    const antesLoginMs = Date.now();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
      clickByText(page, 'button, input[type="submit"]', 'Entrar'),
    ]);

    await preencher2FASeNecessario(page, antesLoginMs);

    // Página de pesquisa de declarações de remunerações — URL confirmada
    // pelo Diego ao navegar manualmente, 2026-09-09 (sem o parâmetro
    // `dswid`, que parece ser um id de janela gerado por sessão).
    await page.goto('https://www.seg-social.pt/ptss/gr/pesquisa/consultarDR', { waitUntil: 'networkidle2' });

    const preencheuPeriodo = await preencherPeriodoReferencia(page, periodoDe, periodoA);
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

    const { frame, linhas } = await obterLinhasValidas(page);
    if (!frame || linhas.length === 0) {
      // Screenshot de debug também aqui — "sem resultados" nunca lançou
      // exceção, por isso nunca dava a ver o estado real da página nesse
      // caso (achado, 2026-09-09: precisei disto para diagnosticar se o
      // período preenchido pelo robô batia com o que se via manualmente).
      const debug = await screenshotDebug(page);
      return { periodo: anoMes || periodoA, disponivel: false, debugScreenshot: debug, debugUrl: page.url() };
    }

    // anoMes pedido explicitamente (reprocessar um mês específico): exige
    // a declaração exata desse mês. Caso contrário (uso normal, intervalo
    // alargado): escolhe a mais recente entre as encontradas — "aaaa-mm"
    // ordena lexicograficamente igual a numericamente, por isso comparar
    // como string já dá a ordem cronológica certa.
    const linhaEscolhida = anoMes
      ? linhas.find(l => l.anoMes === anoMes) || null
      : linhas.reduce((maisRecente, l) => (!maisRecente || l.anoMes > maisRecente.anoMes ? l : maisRecente), null);
    if (!linhaEscolhida) {
      const debug = await screenshotDebug(page);
      return { periodo: anoMes || periodoA, disponivel: false, debugScreenshot: debug, debugUrl: page.url() };
    }

    // Assume um único estabelecimento (confirmado pelo Diego — Magnetic
    // Place tem só a linha "Estab. 1") — usa sempre a mesma linha
    // escolhida para os dois documentos (mesma declaração).
    const rntBuffer = await capturarDownload(
      browser,
      () => clicarAcaoEExtrato(frame, linhaEscolhida.indice, 'Extrato Declaração'),
      20000,
    );
    const tc2Buffer = await capturarDownload(
      browser,
      () => clicarAcaoEExtrato(frame, linhaEscolhida.indice, 'Extrato Resumo'),
      20000,
    );

    if (!rntBuffer.length || !tc2Buffer.length) {
      throw new Error('A Segurança Social devolveu um PDF vazio (RNT ou TC2).');
    }

    return { periodo: linhaEscolhida.anoMes, disponivel: true, rntBuffer, tc2Buffer };
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
