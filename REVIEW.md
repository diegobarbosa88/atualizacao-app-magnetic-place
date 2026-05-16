---
phase: feat-documentos-mvp
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/components/admin/DocumentTemplatesAdmin.jsx
  - src/components/common/CompanyClassicStamp.jsx
  - src/components/common/CompanyValidationStamp.jsx
  - src/components/common/ValidationStampAdmin.jsx
  - src/components/common/WorkerDocuments.css
  - src/components/common/WorkerDocuments.jsx
  - src/context/AppContext.jsx
  - src/features/admin/AdminDashboard.jsx
  - src/features/admin/DocumentsAdmin.jsx
  - src/features/admin/FinancialReportOverlay.jsx
  - src/utils/aiUtils.js
  - src/utils/deviceUtils.js
  - src/utils/docxTemplateService.js
  - src/utils/pdfSigningService.js
  - src/utils/templateFields.js
  - src/utils/timesheetTemplateService.js
findings:
  critical: 6
  warning: 9
  info: 5
  total: 20
status: issues_found
---

# Relatório de Revisão de Código — feat/documentos-mvp

**Data:** 2026-05-15
**Profundidade:** standard
**Ficheiros revistos:** 16
**Estado:** problemas encontrados

## Resumo

Este branch introduz um sistema de modelos de documentos (upload DOCX, substituição de campos, assinatura PDF com carimbos do trabalhador e do representante da empresa), mais uma vista unificada de administração de documentos. A implementação é abrangente e toca no contexto de autenticação, subscrições em tempo real, geração de PDF e armazenamento de ficheiros.

Foram encontrados vários problemas críticos: uma chave anon do Supabase hardcoded no código-fonte, um iframe que fica permanentemente no DOM quando a geração de PDF falha antes do bloco `finally` interno, um vetor de XSS através de HTML não sanitizado injetado via `innerHTML`, uma race condition no padrão singleton do Supabase, e ausência de `ignoreEncryption` num caminho de carregamento de PDF durante a assinatura. Os avisos cobrem chamadas `console.log` de depuração deixadas no código (há muitas), erros silenciados e fugas de URL objects.

---

## Problemas Críticos

### CR-01: Credencial do Supabase hardcoded no código-fonte

**Ficheiro:** `src/context/AppContext.jsx:9`
**Problema:** A chave anon do Supabase `sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ` está hardcoded como valor de fallback no código-fonte. Qualquer pessoa que consiga ler o repositório ou o JS compilado pode extrair esta chave e fazer chamadas diretas à API do Supabase, contornando a camada da aplicação. Mesmo sendo uma chave "publishable", incluí-la no código-fonte associa a chave ao repositório e dificulta a sua rotação.
**Correção:**
```js
// Remover o fallback hardcoded. Lançar um erro claro em alternativa.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY têm de estar configuradas.');
}
```

---

### CR-02: Fuga de iframe no DOM quando ocorre erro na geração do PDF

**Ficheiro:** `src/components/common/WorkerDocuments.jsx:516-517`
**Problema:** O elemento `iframe` adicionado ao `document.body` só é removido dentro do `finally { document.body.removeChild(iframe); }` nas linhas 516–517. No entanto, o bloco `try` que envolve `pdfBlob = await ifW.html2pdf()...` começa na linha 460, mas o iframe foi adicionado na linha 421 — *antes* deste try/finally interno. Se algum erro ocorrer entre a linha 421 (adição do iframe) e a linha 460 (início do try interno), ou se o `catch` externo na linha 649 correr sem passar pelo `finally` interno, o iframe fica permanentemente no DOM. Em particular, as duas chamadas `await new Promise(...)` nas linhas 427 e 449–457 que podem rejeitar vão saltar o `finally` interno.

**Correção:** Mover o `document.body.removeChild(iframe)` para o `try/finally` externo, ou envolver todo o ciclo de vida do iframe num único `try/finally`:
```js
document.body.appendChild(iframe);
try {
  // ... todas as operações com o iframe ...
} finally {
  if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
}
```

---

### CR-03: XSS via injeção de `innerHTML` com markup de carimbo controlado por dados da BD

**Ficheiro:** `src/components/common/WorkerDocuments.jsx:396`
**Problema:** `sigArea.innerHTML = stampMarkup;` na linha 396 injeta o resultado de `getStampHTML(...)` diretamente num elemento DOM dentro de um iframe com sandbox (`sandbox="allow-scripts allow-same-origin"`). O atributo `allow-same-origin` significa que scripts dentro podem aceder aos cookies e localStorage da página pai, se a origem do `srcdoc` do iframe coincidir com a da página. Se `getStampHTML` incorporar conteúdo vindo da base de dados (nome do trabalhador, IP) sem sanitização, um payload de XSS armazenado nesses campos seria executado. Mesmo que `getStampHTML` seja atualmente seguro, o padrão de injetar HTML bruto num iframe com `allow-same-origin` é intrinsecamente frágil.

**Correção:** Remover `allow-same-origin` do atributo sandbox do iframe de assinatura (linha 419), ou sanitizar o `stampMarkup` antes da injeção com `DOMPurify.sanitize()`.

---

### CR-04: Race condition — singleton Supabase ao nível do módulo nunca é reiniciado no teardown

**Ficheiro:** `src/context/AppContext.jsx:11`, `src/context/AppContext.jsx:100-120`
**Problema:** `supabaseInstance` é uma variável ao nível do módulo. O `useEffect` que a inicializa (linhas 100–120) depende de `[]` (corre uma vez), mas o valor é exposto via `value.supabase: supabaseInstance` (linha 505). Se o `AppProvider` desmontar e remontar (ex: hot reload, double-invoke do Strict Mode), `supabaseInstance` não é reiniciado para `null` antes de ser recriado; o cliente anterior fica em memória e os seus canais realtime nunca são libertados. No Strict Mode, a limpeza corre mas a variável ao nível do módulo ainda guarda uma referência obsoleta.

**Correção:** Mover `supabaseInstance` para um `useRef` dentro do componente, ou garantir que é limpo na função de cleanup do `useEffect`:
```js
const supabaseRef = useRef(null);
// Em initSupabase: supabaseRef.current = window.supabase.createClient(...)
// Expor: supabase: supabaseRef.current
```

---

### CR-05: Carregamento de PDF sem `ignoreEncryption` no caminho de assinatura de documentos clássicos

**Ficheiro:** `src/components/common/WorkerDocuments.jsx:603`
**Problema:** `await PDFDocument.load(originalPdfBytes)` (linha 603) no caminho de assinatura de documentos não-template (clássicos) **não** passa `{ ignoreEncryption: true }`. Se o PDF carregado tiver algum flag de encriptação (mesmo restrições de "só impressão", comuns em PDFs gerados por empregadores), o `pdf-lib` vai lançar uma exceção e o trabalhador não consegue assinar o documento. O caminho de templates na linha 295 de `pdfSigningService.js` passa corretamente `{ ignoreEncryption: true }`.

**Correção:**
```js
const pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
```

---

### CR-06: `applyAdminStampToPage` ignora silenciosamente valores de `page` desconhecidos

**Ficheiro:** `src/utils/pdfSigningService.js:583-588`
**Problema:** Quando `page` não é `'first'`, `'last'` ou `'all'`, `targetPages` fica `[]` e a função retorna um PDF sem carimbo sem lançar qualquer erro. O código que chama a função (em `useDocumentTemplates`) não tem forma de detetar isto — a aprovação parece ter sucesso, mas o carimbo está silenciosamente ausente do PDF.

**Correção:** Adicionar uma guarda e lançar erro ou usar `'last'` como fallback:
```js
if (targetPages.length === 0) {
  console.warn(`applyAdminStampToPage: valor de page desconhecido "${page}", a usar última página`);
  targetPages = [pages[pages.length - 1]];
}
```

---

## Avisos

### AV-01: Muitos `console.log` de depuração no caminho crítico de assinatura

**Ficheiro:** `src/components/common/WorkerDocuments.jsx:382`, `404`, `407`, `412-414`, `430-446`, `453`, `479-485`, `503-506`, `510`
**Problema:** Existem mais de 15 chamadas `console.log('DEBUG: ...')` incorporadas no fluxo crítico de assinatura de PDF. Estas imprimem estrutura DOM interna, fragmentos de HTML e tamanhos de blob para a consola do browser em produção. Para além de serem ruído, podem expor detalhes estruturais sobre o pipeline de documentos.
**Correção:** Remover todas as linhas `console.log('DEBUG: ...')`. Os erros genuínos já usam `console.error`.

---

### AV-02: `saveToDb` faz double-update na tabela `documents`, criando estado local inconsistente

**Ficheiro:** `src/context/AppContext.jsx:288-356`
**Problema:** Quando `colName` é `'documents'` ou `'documentos'`, `updateState(setDocuments)` é chamado na linha 301, e depois — após o upsert do Supabase — `setDocuments` é chamado novamente nas linhas 349–356 com o mesmo `payload`. Este double-update significa que qualquer atualização otimista é aplicada duas vezes. Se o upsert falhar, o segundo update ainda corre porque a verificação é `if (...tableName... && !error)`, mas o primeiro update otimista já foi confirmado.
**Correção:** Remover o segundo bloco `setDocuments` nas linhas 348–356 e confiar apenas no update otimista da linha 301.

---

### AV-03: `embedPng` sem fallback JPEG no caminho de assinatura clássico

**Ficheiro:** `src/components/common/WorkerDocuments.jsx:604`
**Problema:** `await pdfDoc.embedPng(stampBase64)` na linha 604 é chamado incondicionalmente. O `stampBase64` vem de `canvas.toDataURL('image/png')` (linha 585), por isso será sempre PNG — no entanto, se o `html2canvas` estiver configurado de forma diferente ou o canvas produzir um JPEG, a chamada `embedPng` vai lançar exceção e a assinatura falhará completamente sem mensagem de erro amigável.
**Correção:** Usar `tryEmbedImage` (já exportado de `pdfSigningService.js`) ou adicionar um try/catch com fallback JPEG:
```js
let pngImage;
try {
  pngImage = await pdfDoc.embedPng(stampBase64);
} catch {
  pngImage = await pdfDoc.embedJpg(stampBase64);
}
```

---

### AV-04: Obtenção do IP do trabalhador de um serviço externo (`api.ipify.org`) sem timeout

**Ficheiro:** `src/components/common/WorkerDocuments.jsx:236-238`, `src/utils/deviceUtils.js:22-30`
**Problema:** A obtenção do IP via `https://api.ipify.org` não tem `AbortController` / timeout. Se o serviço for lento ou inacessível, o modal de assinatura ficará preso em "A obter IP..." indefinidamente.
**Correção:**
```js
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 5000);
try {
  const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
  // ...
} finally {
  clearTimeout(timer);
}
```

---

### AV-05: Fuga de URL object no efeito de preview de `DocumentTemplatesAdmin`

**Ficheiro:** `src/components/admin/DocumentTemplatesAdmin.jsx:412-415`
**Problema:** Se o componente desmontar depois da linha 401 (`URL.createObjectURL`) mas antes da linha 402 (`setPdfPreviewUrl`), a função de cleanup já terá corrido com `createdUrl = null`, pelo que o URL object fica em fuga de memória.
**Correção:** Usar uma ref para persistir a URL entre os gaps assíncronos:
```js
const createdUrlRef = useRef(null);
// Após createObjectURL:
createdUrlRef.current = URL.createObjectURL(...);
// No cleanup:
return () => { cancelled = true; if (createdUrlRef.current) URL.revokeObjectURL(createdUrlRef.current); };
```

---

### AV-06: `handleDeleteManual` em `DocumentsAdmin` extrai o path de storage por split frágil

**Ficheiro:** `src/features/admin/DocumentsAdmin.jsx:219`
**Problema:** `raw.url.split('/documentos/')[1]` assume que o URL público terá sempre a string `/documentos/`. Se o bucket for renomeado, a estrutura do URL mudar, ou o URL tiver parâmetros de query, o resultado é `undefined` e `remove([undefined])` é chamado no storage do Supabase — a operação tem sucesso silenciosamente sem apagar o ficheiro.
**Correção:**
```js
const match = raw.url?.match(/\/storage\/v1\/object\/public\/documentos\/(.+?)(\?|$)/);
const pathInStorage = match ? decodeURIComponent(match[1]) : null;
```

---

### AV-07: `extractTags` em `docxTemplateService` usa `getFullText()` que pode não detetar tags partidas em múltiplos runs XML

**Ficheiro:** `src/utils/docxTemplateService.js:84-93`
**Problema:** `doc.getFullText()` retorna apenas o texto simples do documento. No Word, uma tag como `{worker_name}` pode ser partida em múltiplos runs XML (especialmente após autocorreção ou verificação ortográfica). Isto significa que um template pode passar a validação `extractTags` (mostrando a tag como detetada) mas falhar na renderização com um erro confuso para o utilizador.
**Correção:** Usar parsing direto do XML, ou correr `doc.render({})` com `nullGetter: () => ''` num try/catch para detetar erros de renderização no momento do upload.

---

### AV-08: `parseHtmlToDocx` em `timesheetTemplateService` descarta silenciosamente conteúdo inline e listas

**Ficheiro:** `src/utils/timesheetTemplateService.js:11-81`
**Problema:** A função `processNode` trata apenas `h1-h4`, `p`, `br`, `table` e `div`. Qualquer outro elemento (`span`, `strong`, `em`, `ul`, `li`, `img`) retorna `[]` — o seu conteúdo é completamente descartado. Texto dentro de `ul/li` é perdido silenciosamente.
**Correção:** Adicionar handlers para pelo menos `span`, `strong`, `em`, `ul`, `li`, ou usar uma biblioteca como `html-to-docx`.

---

### AV-09: `adminStats` em `AppContext` reduz `logs` sem null-guard em `l.hours`

**Ficheiro:** `src/context/AppContext.jsx:422`
**Problema:** `monthLogs.reduce((acc, curr) => acc + curr.hours, 0)` — se algum registo tiver `hours: null` ou `hours: undefined`, o resultado torna-se `NaN` e todas as estatísticas derivadas (`expectedRevenue`, `expectedCosts`, `netProfit`) também ficam `NaN`, quebrando silenciosamente o dashboard.
**Correção:**
```js
const totalHours = monthLogs.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);
```

---

## Informação

### IN-01: Mapa `workerById` calculado duas vezes na mesma árvore de renderização

**Ficheiro:** `src/features/admin/DocumentsAdmin.jsx:48-51` e `src/components/admin/DocumentTemplatesAdmin.jsx:71-75`
**Problema:** Tanto `DocumentsAdmin` como `DocumentTemplatesAdmin` calculam independentemente um mapa `workerById` a partir da mesma prop `workers`. Como `DocumentTemplatesAdmin` é renderizado *dentro* de `DocumentsAdmin`, o mapa é calculado duas vezes em cada renderização.
**Correção:** Calcular o mapa uma vez em `DocumentsAdmin` e passá-lo como prop.

---

### IN-02: `void companyName` suprime um aviso de lint em vez de remover o parâmetro

**Ficheiro:** `src/utils/pdfSigningService.js:520`
**Problema:** `void companyName;` é um truque de supressão de lint. O parâmetro `companyName` é desestruturado e passado para `drawAdminStampCorporate` nalgum ramo (linha 594), por isso está efetivamente em uso. O `void` é provavelmente obsoleto.
**Correção:** Remover a linha `void companyName;`.

---

### IN-03: Tagline da cidade hardcoded no estilo de carimbo corporativo

**Ficheiro:** `src/utils/pdfSigningService.js:1127`
**Problema:** `'Lisboa · Porto · Madrid'` está hardcoded como rodapé do carimbo corporativo, independentemente da morada ou configurações reais da empresa.
**Correção:** Usar `companyAddress` das opções, ou pelo menos torná-lo uma constante nomeada para ser fácil de encontrar.

---

### IN-04: `acroformDoc` chama `alert()` dentro de um `try/catch` que engole erros

**Ficheiro:** `src/components/common/WorkerDocuments.jsx:873`
**Problema:** `try { alert('Documento assinado com sucesso!'); } catch (_) {}` — `alert()` não lança exceções em circunstâncias normais. O catch é inútil e confuso.
**Correção:** Remover o try/catch. Se precisar suportar ambientes sem `alert`, verificar `typeof alert === 'function'` explicitamente.

---

### IN-05: `DocumentsAdmin` recebe `supabase` como prop mas usa `clientSupabase` do contexto

**Ficheiro:** `src/features/admin/DocumentsAdmin.jsx:36-37`
**Problema:** A assinatura do componente inclui `supabase` como prop (linha 36), mas `clientSupabase` do `useApp()` é usado em todas as operações reais (linhas 165, 176, etc.). A prop `supabase` nunca é lida dentro do componente, tornando a API da prop enganosa.
**Correção:** Remover `supabase` das props desestruturadas se não for usada.

---

_Revisto em: 2026-05-15_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
