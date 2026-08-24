# Auditoria ao design system — 2026-08-22

Levantamento só de leitura, sem alterações de código. Âmbito: `src/styles/designTokens.js`,
`src/components/common/` (ModalShell, SectionHeaderShell, SubTabBar, Card, Badge), adesão real do
resto do código aos tokens, inconsistências entre as três interfaces, riscos de layout (breakpoints
de viewport dentro de modais) e CSS morto.

**Nota de método:** todos os números abaixo vêm de `grep`/`wc` exatos sobre o estado atual da árvore
de trabalho (incluindo os 18 commits locais por fazer push), não de estimativa. Onde escrevo
"confirmado" verifiquei o ficheiro/linha diretamente antes de o listar aqui. Onde não tive tempo de
verificar visualmente (ex: como um ecrã realmente aparece no browser), digo-o explicitamente — isto é
uma auditoria de código, não uma auditoria visual.

---

## Resumo executivo

O design system tem uma base sólida (`ModalShell`, `Card`, tokens `FT`/`SCALE`) mas a adoção é muito
desigual: dois dos cinco componentes partilhados (`Badge`, e por extensão `TONES`) **têm zero
consumidores em toda a app**, ~64% das chaves de `SCALE` nunca são referenciadas fora do próprio
ficheiro, e a cor de marca `#1B3A57` está hardcoded em 87 ficheiros contra 29 usos do token
`FT.navy` que existe precisamente para a substituir — inclusive dentro dos próprios componentes do
design system. A armadilha já conhecida (breakpoints de viewport dentro de modais de largura fixa) é
real mas contida: depois de verificar linha a linha se o código está mesmo dentro do bloco do modal
(ver secção 2), confirmam-se 3 ficheiros e 6 ocorrências — bem menos do que uma primeira leitura pelas
mensagens de commit sugeria.

---

## 1. Vale a pena corrigir primeiro (alto impacto, baixo risco de regressão)

### 1.1 `Badge.jsx` e `TONES` foram construídos e nunca adotados
`src/components/common/Badge.jsx` — **zero ficheiros importam `Badge` ou `createStatusBadge` em
toda a app** (confirmado por duas pesquisas: import direto do caminho `common/Badge`, e pelo nome
do componente). `TONES` (`designTokens.js:44-51`) só é referenciado dentro do próprio `Badge.jsx` —
nenhum outro ficheiro o usa.

Entretanto, o próprio comentário de `Badge.jsx:7-9` diz que substituiria "10+ mapas locais... que
repetiam as mesmas cores". Isso não aconteceu — encontrei pelo menos 8 implementações de badge
locais ainda em uso, exatamente o padrão que `Badge.jsx` foi feito para eliminar:
`DivergenciaBadge` (`src/components/admin/ValidacaoUI.jsx`), `FieldBadge`
(`src/components/admin/templates/FieldBadge.jsx`), `StatusBadge` (dois ficheiros distintos:
`src/components/correcoes/StatusBadge.jsx` usado por `PrecisionReportCard.jsx` e
`QuickReportCard.jsx`), `TagBadge`/`TipoBadge` (`src/features/admin/TagBadge.jsx`,
`src/features/admin/TipoBadge.jsx`), `MonthStatusBadge`
(`src/features/client-report/components/MonthStatusBadge.jsx`), `resolveBadge`
(`src/features/admin/adminNavConfig.js`).

**Recomendação:** decidir entre (a) migrar um destes badges locais para `Badge`+`createStatusBadge`
como prova de conceito, ou (b) se `Badge.jsx` não serve as necessidades reais destes casos, assumir
que é código morto e removê-lo. Deixá-lo como está — construído, documentado, zero uso — é o pior dos
três cenários.

### 1.2 Dois sistemas paralelos de cor de estado, com valores que não coincidem
`designTokens.js` define **dois vocabulários diferentes** para o mesmo conceito (estado
sucesso/aviso/erro/info):
- `FT.ok`/`FT.bad`/`FT.warn`/`FT.info` (linhas 18-25) — hex fixos, usados **diretamente** em 10
  ficheiros, todos no dashboard do trabalhador: `WorkerDocuments.jsx`, `FormacaoModal.jsx`,
  `TimeEntryModal.jsx`, `PendingAlertsModal.jsx`, `AbsenceRequestModal.jsx`, `WorkerProfile.jsx`,
  `FormacaoElearningFlow.jsx`, `WorkerScheduleTab.jsx`, `ManualTimeEntryCard.jsx`,
  `GeoSuggestionCard.jsx`.
- `TONES` (linhas 44-51) — classes Tailwind (`emerald`, `amber`, `rose`, `indigo`), usadas só dentro
  de `Badge.jsx`, que como visto acima não tem consumidores.

Os valores nem sequer coincidem para o mesmo conceito: `FT.ok` = `#2E7D4F`, o verde Tailwind mais
próximo em `TONES.success` é `emerald-700` ≈ `#047857` — tons de verde visivelmente diferentes. O
mesmo desalinhamento acontece em warning (`FT.warn` `#D98A2B` vs `amber-700` ≈ `#b45309`) e danger
(`FT.bad` `#B4432F` vs `rose-700` ≈ `#be123c`). Só `FT.teal`/`TONES.pending` (ambos "teal") batem
certo por coincidência de nome, não de valor.

**Recomendação:** escolher um dos dois sistemas como fonte única da verdade para cor de estado, e
fazer o outro apontar para ele (ou remover).

### 1.3 Os próprios componentes partilhados não usam os tokens que já existem
Nenhum destes factos é suposição — os três ficheiros abaixo **não importam `designTokens.js`**
(confirmei a ausência do `import` em cada um) e reproduzem à mão valores que já lá estão definidos:

- `ModalShell.jsx:30,129,144` — hardcoda `#1B3A57` três vezes (é `FT.navy`) e `#EB8D00` uma vez
  (é `FT.orange`). Linha 107 hardcoda `rounded-[2rem]`, que é exatamente o valor de
  `SCALE.radius.modal` (`designTokens.js:71`) — que tem **zero usos em todo o código**, incluindo
  aqui, onde seria o consumidor óbvio.
- `SectionHeaderShell.jsx:44,47,52,20,24,26` — hardcoda `rounded-2xl` (= `SCALE.radius.header`,
  0 usos) e `text-[1.3rem] font-bold leading-none` na linha 52, que é uma cópia carácter-a-carácter
  de `SCALE.text.sectionTitle` (`designTokens.js:87`, também 0 usos). Hardcoda `#1B3A57` duas vezes e
  `#EB8D00` duas vezes.
- `SubTabBar.jsx:18,25` — hardcoda `#1B3A57` e, na linha 25, dois hex ad-hoc que não estão em
  lado nenhum do `designTokens.js` (ver 1.4).

**Recomendação:** estes três ficheiros vivem na mesma pasta (`src/components/common/`) que
`designTokens.js` (`../../styles/designTokens`) e que `Card.jsx`/`Badge.jsx`, que já o importam
corretamente — é a correção mais barata e mais visível desta auditoria.

### 1.4 Um terceiro amarelo "de facto" que não está em lado nenhum do token file
`#e8a317` aparece copiado à mão em **6 sítios independentes**, sempre para o mesmo conceito
("urgente" / "a expirar"): `SectionHeaderShell.jsx:75`, `SubTabBar.jsx:25`,
`WorkerDocsFolderView.jsx:100,510`, `DocumentsAdmin.jsx:55`, `TeamManager.jsx:176`. Não corresponde
a `FT.warn` (`#D98A2B`) nem a nenhum amarelo Tailwind padrão — é uma terceira cor de aviso que
ninguém decidiu formalizar como token, mas que já se comporta como um. O par `#e0455a` (rosa/vermelho
de badge) tem o mesmo padrão em `SectionHeaderShell.jsx:75` e `SubTabBar.jsx:25`.

**Recomendação:** promover `#e8a317`/`#e0455a` a tokens reais em `FT` (ou substituí-los pelo par
`FT.warn`/`FT.bad` já existente, se a diferença de tom não for intencional — perguntar ao Diego antes
de decidir).

### 1.5 `#1B3A57` hardcoded domina o código: 87 ficheiros, 476 ocorrências, contra 29 usos do token
Para comparação, `FT.orange`/`#EB8D00` tem o mesmo padrão em escala menor: 40 usos do token contra
57 ficheiros / 118 ocorrências em hex direto. O pior ofensor isolado é
`src/features/admin/RecibosCalculadora.jsx`, com **57 ocorrências de `#1B3A57`** sozinho (confirmei
que não é geração de PDF via jsPDF — são classes Tailwind normais como `focus:border-[#1B3A57]` e
`style={{ color: '#1B3A57' }}` no DOM) e **não importa `designTokens.js`**. Outros focos fortes:
`FaturarClienteModal.jsx` (32), `WorkerForm.jsx` (32), `ScheduleForm.jsx` (19),
`AdminSettings.jsx` (19), `AjudasCalculadora.jsx` (17), `SalariosTab.jsx` (17),
`AjudasCustoAdmin.jsx` (17). `#869AAF` (= `FT.slate`) segue o mesmo padrão em vários destes
ficheiros (10-11 ocorrências cada).

**Não é o mesmo problema que `text-gray-500`/`bg-white`** (ver secção 3) — aqui a cor tem um nome de
marca e um token dedicado; usar o hex à mão é sempre substituível 1:1 por `FT.navy`/`FT.orange`.

### 1.6 `App.css` anula a sua própria truncagem de texto nas tabelas do admin
`.admin-table td` é definida em `App.css:37-39` com `overflow:hidden; text-overflow:ellipsis` — mas
mais abaixo, no mesmo ficheiro, `App.css:51-54` define `.admin-table th, .admin-table td {
overflow:visible !important; text-overflow:clip !important }`. Mesma especificidade, `!important`,
posição mais tardia na cascata → a segunda regra ganha sempre. **O design de "cortar texto longo com
reticências" nas tabelas de admin nunca chega a aplicar-se visualmente**, porque a própria folha de
estilo o desliga a seguir a ligá-lo. (Achado do agente de auditoria CSS, verificado por mim
diretamente nas linhas indicadas.)

**Recomendação:** decidir qual dos dois comportamentos é o pretendido e remover a regra contrária —
provavelmente a de `overflow:visible/clip` é resto de uma tentativa anterior de resolver outra coisa
e ficou esquecida.

---

## 2. Risco de layout confirmado: breakpoints de viewport dentro de modais

**Correção ao meu levantamento inicial:** a minha primeira passagem por esta secção assumiu, a partir
das mensagens de commit da fase 4b (que descrevem ficheiros como "modais migrados"), que 8 ficheiros
inteiros eram conteúdo de modal. Um segundo agente fez a verificação correta — confirmar, para cada
ocorrência de `lg:`/`md:`, se a linha cai **dentro** do bloco `<ModalShell>...</ModalShell>` real ou
apenas algures no mesmo ficheiro que também importa `ModalShell` para outra coisa. Verifiquei
diretamente 4 dos casos discutidos (`AdminSettings.jsx`, `NotificationsAdmin.jsx`,
`ReportsEmbedded.jsx`, `FinancialReportOverlay.jsx`) e a distinção é real: nesses três primeiros, o
componente é renderizado como **página/aba normal** (`<AdminSettings />` em
`AdminDashboard.jsx:575`, `<NotificationsAdmin />` em `AdminDashboard.jsx:547`, ambos fora de
qualquer `ModalShell`) e só uma pequena parte do mesmo ficheiro — um diálogo de confirmação, um
preview — está de facto dentro de um `<ModalShell>` mais abaixo. Os `lg:`/`md:` que eu tinha listado
para esses ficheiros medem viewport corretamente, porque a página realmente ocupa a viewport. Fica
como nota de metodologia: cruzar "importa `ModalShell`" com "está dentro do `<ModalShell>...
</ModalShell>`" dá resultados muito diferentes, e só o segundo é um risco real.

**Lista corrigida — 3 ficheiros, 6 ocorrências, todas confirmadas dentro do bloco do modal:**

| Ficheiro | Ocorrências | Linhas | Confirmação |
|---|---|---|---|
| `src/features/admin/schedules/ScheduleForm.jsx` | 4 | 69, 71, 222, 229 | `<ScheduleForm />` é renderizado dentro de `<ModalShell size="6xl">` em `ScheduleManager.jsx:43-73` — o próprio `ModalShell` ali tem um comentário do autor (linhas 49-52) a documentar exatamente este bug: "os breakpoints do Tailwind medem a VIEWPORT, não o contentor... os rótulos ENTRADA/PAUSA/SAÍDA chegavam a sobrepor-se" |
| `src/components/admin/templates/TemplateEditorModal.jsx` | 1 | 130 | Não usa `ModalShell` — usa o wrapper genérico `templates/Modal.jsx` (um dos 3 modais "pendentes de decisão", ver `CLAUDE.md`); todo o corpo do componente é conteúdo do modal |
| `src/features/admin/FinancialReportOverlay.jsx` | 1 | 97 | Todo o `return` do componente (linhas 57-208) é o próprio `<ModalShell>` — confirmei que não há conteúdo fora dele |

Caso interessante dentro de `ScheduleForm.jsx`: a linha 202 do mesmo ficheiro já tem a correção certa
(`@md:grid-cols-4`, dentro de um `<div className="@container ...">` na linha 169 — a **única**
declaração `@container` em todo o `src/`) — mas o mesmo ficheiro deixou as outras 4 grelhas (linhas
69, 71, 222, 229) por corrigir. É meio-migrado, não por migrar.

**Ponto estrutural a ter em conta antes de corrigir:** `ModalShell.jsx:147` (o `<div className="flex-1
overflow-y-auto ...">` que envolve `{children}`) **não declara `@container`**. Isto significa que
trocar `lg:`/`md:` por `@lg:`/`@md:` em `ScheduleForm.jsx` só funciona porque o próprio `ScheduleForm`
já embrulha manualmente o bloco corrigido num `@container` (linha 169) — não é algo que o `ModalShell`
resolva automaticamente para todos os consumidores. Se se quiser generalizar a correção, `ModalShell`
teria de declarar `@container` no wrapper do conteúdo, não cada consumidor à sua maneira.

**Recomendação:** o volume real do problema é pequeno (3 ficheiros) — aplicar a mesma técnica de
container query já usada com sucesso em `ScheduleForm.jsx:169-202` aos 3 casos confirmados, e
considerar mover a declaração `@container` para o próprio `ModalShell` para não repetir a solução
manualmente em cada modal futuro.

---

## 3. Inconsistências entre as três interfaces

Isto é o que consigo confirmar por código — não naveguei nos três ecrãs lado a lado no browser, por
isso trato como leitura de intenção de código, não como veredito visual definitivo.

- **`SectionHeaderShell`, `SubTabBar` e `Card` são usados exclusivamente no admin** — 21, 8 e 9
  ficheiros respetivamente, todos dentro de `src/features/admin/` ou `src/components/admin/`. Zero
  ocorrências em `src/features/worker/` ou `src/client-portal/` (confirmei com `grep -rl` nos três
  diretórios separadamente). O "cabeçalho de secção" e o "cartão de entidade" que o admin já
  padronizou continuam a ser resolvidos à mão nas outras duas interfaces.
- **`ModalShell` tem adoção parcial fora do admin** — 72 ficheiros no total importam-no; destes, 10
  são do dashboard do trabalhador e 2 do portal do cliente. Ou seja, os modais já convergiram bastante
  entre interfaces, mas os cabeçalhos de página e os cartões, não.
- **O dashboard do trabalhador tem o seu próprio ficheiro de tokens** —
  `src/features/worker/worker-dashboard/formacaoDesignTokens.js` — mas confirmei que **não é uma
  cópia divergente**, é um re-export de uma linha do `designTokens.js` canónico, mantido "por
  compatibilidade" (comentário do próprio ficheiro). 12 ficheiros do worker dashboard importam `FT`
  por este caminho indireto em vez de importar diretamente. Não é um bug, é só um salto
  desnecessário — cosmético, sem risco.

**Recomendação:** se o objetivo é visual único entre as três interfaces, `SectionHeaderShell`/
`SubTabBar`/`Card` são candidatos óbvios à próxima fase de rollout — já existem, já estão a ser
usados com sucesso num sítio, falta levá-los aos outros dois.

---

## 4. CSS morto e ficheiros de estilo

(Parte deste levantamento foi feito por um agente de auditoria dedicado; verifiquei diretamente as
duas classes mortas e a regra `!important` antes de as incluir aqui.)

- **2 classes CSS confirmadas mortas, zero usos:** `.admin-dashboard-container` (`App.css:125`) e
  `.counter` (`index.css:117`). Nenhuma tem sinais de ser construída dinamicamente por template
  literal — são candidatas limpas a remover.
- **0 ficheiros `.css` órfãos.** Os 6 ficheiros CSS do projeto (`App.css`, `index.css`,
  `ClientTimesheetReport.css`, `WorkerDocuments.css`, `reconciliacao-mockup.css`, `LoginView.css`)
  têm todos pelo menos um import ativo. Nota à parte: `WorkerDocuments.css` é importado de forma
  atípica em `useSignDocument.js:6` com o sufixo `?inline` do Vite — carregado como string e injetado
  manualmente num `<style>`, não como stylesheet normal. Não mexer nisso sem perceber este padrão,
  até porque é o CSS que entra no iframe isolado de assinatura (ver `CLAUDE.md`).
- **A regra global `* { text-transform: uppercase !important }` já não existe.** O comentário em
  `App.css:5-9` confirma que foi removida deliberadamente no commit `b11f48e` ("fase 0: fundação CSS")
  — um dos 18 commits locais ainda por fazer push. **Isto contradiz a memória guardada do projeto**
  (que ainda descreve essa regra como ativa) — é uma correção a fazer à memória assim que estes
  commits forem para produção, não um achado de auditoria contra o código.
- **28 usos de `!important` em `App.css`, 0 em `index.css`.** Fora da regra de maiúsculas já
  removida, nenhuma outra regra usa um seletor verdadeiramente global (`*` solto ou tag sem classe) —
  todas estão condicionadas a uma classe (`.admin-table`, `.dark`, etc.). As duas mais próximas de
  "agressivas" são `input.lowercase` (`App.css:7`, compete diretamente com a regra de maiúsculas) e
  `div[class*="bg-white"]` dentro de `.grid >` (`App.css:128`), que usa correspondência por
  substring de classe numa tag genérica.
- **0 comentários de dívida técnica** (TODO/FIXME/deprecated/legacy) em qualquer ficheiro `.css`.

---

## 5. Cosmético / baixo risco

- **~64% das chaves de `SCALE` nunca são referenciadas fora do próprio `designTokens.js`.** Das 22
  chaves (8 em `radius`, 5 em `pad`, 8 em `text`, mais `grid`), só 8 têm algum uso real:
  `radius.chip` (1), `radius.card` (1), `radius.panel` (2), `pad.card` (1), `pad.panel` (1),
  `pad.badge` (1), `text.badge` (1), `grid` (2). As 14 restantes — incluindo toda a escala tipográfica
  (`text.entityName`, `text.price`, `text.statValue`, `text.sectionTitle`, `text.meta`,
  `text.statLabel`, `text.body`) e metade dos raios (`tab`, `control`, `input`, `header`, `modal`) —
  têm zero usos. Isto liga diretamente ao achado 1.3: os consumidores óbvios destes valores
  (`ModalShell`, `SectionHeaderShell`) reproduzem os mesmos valores à mão em vez de importar a chave.
- **6 aliases antigos do `ModalShell` (`ACCENT_ALIAS`, `ModalShell.jsx:36-40`) têm 0 usos reais** —
  `indigo`, `orange`, `slate`, `rose`, `navy`, `navyOrange`, `navyGradient`. A única ocorrência de
  `accent="indigo"` no código (`OnboardingForm.jsx:605`) pertence a um componente local diferente
  (`ReviewBlock`, definido no mesmo ficheiro), não ao `ModalShell` — confirmei antes de descartar como
  falso alarme. O mapa de aliases pode ser removido sem quebrar nenhum call site real.
- **Nenhuma variante de `size` do `ModalShell` está órfã** — todas (`sm` a `6xl`, `clientWide`,
  `viewer`) têm pelo menos 1 uso confirmado.
- **`text-gray-500`/`bg-white` e afins: ~3320 e ~1630 ocorrências, em 191-192 dos 228 ficheiros
  `.jsx` do projeto.** Reporto o número porque foi pedido, mas não o recomendo como alvo de limpeza:
  os próprios componentes partilhados (`Card.jsx`, `Badge.jsx`, `ModalShell.jsx`) usam a escala
  `slate` do Tailwind como cinzento neutro de base, e `designTokens.js` não define nenhuma escala de
  cinzentos própria para substituir isto. Ao contrário de `#1B3A57`/`#EB8D00` (que têm um token de
  marca dedicado e nome próprio), usar `text-slate-500` é o comportamento esperado do Tailwind, não
  uma fuga ao design system.
- **Hex literais a "furar" classes Tailwind arbitrárias (`bg-[#..]`, `border-[#..]`, `ring-[#..]`,
  etc.): 408 ocorrências em 70 ficheiros.** Padrão claro: `#1B3A57` e `#869AAF` (= `FT.slate`)
  repetem-se dezenas de vezes em `src/components/admin/Modo*.jsx` (Bursting, Documentos, Histórico) —
  quase de certeza os mesmos tons já definidos em `FT`, só reescritos à mão em vez de importados.
  Mais 495 linhas com hex dentro de `style={{}}` inline, em 87 ficheiros — piores focos:
  `RecibosCalculadora.jsx`, `ClientForm.jsx`, `MapaFolhaObra.jsx`, `MapaPainelExecutivo.jsx`. Estes
  dois grupos são a mesma família de problema do achado 1.5, só que via sintaxe Tailwind em vez de
  CSS/JS puro.
- **`src/features/admin/reconciliacao/reconciliacao-mockup.css` tem nome de protótipo mas está em
  produção real**, importado por 7 ficheiros fora do módulo de reconciliação
  (`SalariosTab.jsx`, `CostReports.jsx`, `cost-reports/DespesasTab.jsx`, `ClientesTab.jsx`,
  `EquipaTab.jsx`, `FaturasTab.jsx`, `MargemTab.jsx`). Vale a pena confirmar com o Diego se o
  conteúdo ainda é necessário como está, ou se pode ser convertido em tokens/Tailwind — o nome sugere
  que "escapou" de um mockup e nunca foi formalizado.

---

## 6. O que não tocar sem cuidado

- `ModalShell.jsx`, `SectionHeaderShell.jsx`, `SubTabBar.jsx` são usados por 72+21+8 ficheiros
  respetivamente — qualquer correção ao achado 1.3 (fazê-los importar `FT`/`SCALE`) é segura porque os
  valores hardcoded e os valores dos tokens são idênticos hoje, mas convém confirmar visualmente num
  antes/depois no browser antes de fazer commit, dado o histórico de regressões visuais nesta
  refatoração (`f8f12d4`, `576c362`).
- `WorkerDocuments.css` — não converter o import `?inline` para import normal sem perceber que este
  CSS é injetado dentro do iframe isolado de assinatura (`useSignDocument.js`), não no documento
  principal.
- O achado 2 (breakpoints em `AdminSettings.jsx`, `ScheduleForm.jsx`, etc.) tem o mesmo risco que os
  dois fixes recentes já mitigaram — trocar `lg:`/`md:` por `@container`/`@md:` exige confirmar no
  browser em ecrã pequeno e grande, porque o erro é silencioso no build (`npx vite build` não o apanha).

---

## Anexo — números brutos verificados

| Métrica | Valor |
|---|---|
| Ficheiros que importam `ModalShell` | 72 |
| Ficheiros que importam `SectionHeaderShell` | 21 |
| Ficheiros que importam `SubTabBar` | 8 |
| Ficheiros que importam `Card` (`common/Card`) | 9 |
| Ficheiros que importam `Badge` (`common/Badge`) | 0 |
| Ficheiros que usam `TONES.*` | 1 (o próprio `Badge.jsx`) |
| Ficheiros que usam `FT.ok`/`FT.bad`/`FT.warn` diretamente | 10 (todos no worker dashboard) |
| Usos de `FT.navy` (token) | 29 |
| Ficheiros com `#1B3A57` hardcoded | 87 (476 ocorrências) |
| Usos de `FT.orange` (token) | 40 |
| Ficheiros com `#EB8D00` hardcoded | 57 (118 ocorrências) |
| `FT.info`/`FT.infoBg`/`FT.teal`/`FT.tealBg` | 0 usos (órfãos) |
| Chaves de `SCALE` usadas / total | 8 / 22 |
| Ocorrências de `lg:`/`md:` em conteúdo de modal confirmado (dentro do `<ModalShell>`) | 6, em 3 ficheiros |
| Hex em classes Tailwind arbitrárias (`bg-[#..]` etc.) | 408, em 70 ficheiros |
| Linhas com hex em `style={{}}` inline | 495, em 87 ficheiros |
| Classes CSS mortas confirmadas | 2 (`.admin-dashboard-container`, `.counter`) |
| Ficheiros `.css` órfãos (sem import) | 0 de 6 |
| `!important` em `App.css` / `index.css` | 28 / 0 |
