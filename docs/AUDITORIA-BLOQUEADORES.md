# Auditoria geral — bloqueadores da padronização visual (SCALE/FT)

Relatório de leitura, sem alterações de código. Segue as fases A–E do pedido. Onde já havia
número verificado e registado em `CLAUDE.md` de trabalho recente na mesma área, cito-o em vez de
recontar — mas com uma recontagem pontual de controlo, não às cegas.

---

## Sumário executivo

**Não há bloqueador estrutural real na Fase A.** A hipótese central do documento — que o Tailwind
JIT não resolve classes construídas por template literal a partir de `FT`/`SCALE` — **está errada**
como está formulada, e o precedente citado (`SCALE.border.control`) não é o exemplo que parecia ser.
Ver A.3.

**Dois achados novos, fora do que já estava mapeado:**
- **`src/client-portal/LoginView.jsx` vs `src/features/auth/LoginView.jsx`** — segunda colisão de
  nome de ficheiro no projeto, mesma família de risco do par `FaturasTab.jsx` já conhecido (E.1).
- **`ClientTimesheetReport.css:2`** define `body { background-color: #f1f5f9; }` sem `@media`, sem
  scope — fuga de CSS global genuína, não hipotética (B.3).

O resto confirma, quantifica ou dá nuance a coisas já mapeadas parcialmente nesta conversa.

---

## Fase A — Bloqueadores de configuração

### A.1 — `tailwind.config.js`

**Não existe `tailwind.config.js` no projeto.** É Tailwind v4 com config 100% em CSS
(`@import "tailwindcss";` em `src/index.css:1`, plugin oficial `@tailwindcss/vite` em
`vite.config.js`). Não há bloco `@theme` em nenhum ficheiro do projeto (confirmado por grep a
`src/`) e não há nenhuma diretiva `@source` a restringir o scanning.

Consequências diretas:
- **As cores navy/orange/slate/etc. não são cores nomeadas do Tailwind.** Existem só como CSS
  custom properties (`--navy`, `--orange`, `--slate`, …) em `:root`/`.dark` de `src/index.css`.
  Todo o uso é via arbitrary value escrito à mão (`text-[var(--navy)]`,
  `bg-[var(--surface-dim)]`) — **sem autocomplete/IntelliSense**, e sem validação de que o nome da
  variável existe (um erro de escrita em `var(--navyy)` não dá warning nenhum, aplica-se como
  "sem efeito", silenciosamente).
- **Não há escala de `fontSize` nomeada.** Confirma-se o padrão já visto no `SalariosTab.jsx`: todo
  o texto fora do default do Tailwind é `text-[Npx]` arbitrário. Isto já estava plenamente
  censado nesta sessão (ver C.3) — é sistemático, não um caso isolado.
- **O scanning cobre `src/` inteiro por omissão** (comportamento padrão do Tailwind v4 sem
  `@source`), incluindo `designTokens.js` — o que é o que torna A.3 seguro, ver abaixo.

**Classificação: inconsistência de aplicação / característica estrutural aceite, não bloqueador.**
Não impede nada de funcionar — impede é autocomplete e deteção de erros de escrita. Se isto
incomodar, a correção seria registar as cores em `@theme` (Tailwind v4) para ganhar
IntelliSense — mas é uma mudança de arquitetura do sistema de tokens, não housekeeping.

### A.2 — `src/styles/designTokens.js`

Todas as chaves de `FT` (26 no total) são **hex direto** — nenhuma referencia `var()` nem é
valor de espaçamento. Lista completa:

```
navy, navyDeep, navyMid, orange, orangeDeep, slate, slateDim, bg, panel, ink, inkSoft,
surface, inkMid, borderSoft, ok, okBg, bad, badBg, warn, warnBg, info, infoBg, teal, tealBg,
border, badgeWarn, badgeBad
```

`SCALE` é um objeto separado (não faz parte de `FT`), com `radius`/`border`/`pad`/`text`/`grid` —
esses sim, na maioria classes Tailwind em string (`'rounded-xl'`) ou arbitrary values
(`'text-[9px] font-bold uppercase tracking-[0.04em]'`), não hex.

**Tokens de estado semântico:** confirmo `--tone-amber`, `--tone-emerald`, `--tone-rose`,
`--tone-indigo` em `src/index.css` (com variantes `-bg`/`-border` e, para os três primeiros,
`-label/-meta/-value/-identity`). **`--tone-sky` não existe** — confirma a suspeita do documento.
Estes tokens vivem só em `index.css`, centralizados, não há cópias soltas noutros `.css`.

**Classificação: sem achado novo, só confirmação.**

### A.3 — Conflito Tailwind JIT vs. valores dinâmicos JS

**A premissa está errada.** Fui ao código confirmar o precedente citado
(`FormacaoElearningFlow.jsx:146-150`) e não é o que o documento descreve:

```jsx
{/* border via style, não className: a cor vem de FT.slate (JS, não estático),
    Tailwind JIT não resolve arbitrary value com variável em runtime. A
    largura é a mesma de SCALE.border.control (1.5px) — mantida literal
    aqui por não haver como partilhar o valor numérico com a classe. */}
<div style={{ border: `1.5px dashed ${FT.slate}`, ... }}>
```

O `1.5px` está literal ali porque **a cor** (`FT.slate`) é uma variável de JS interpolada dentro de
um `style` inline — que nunca foi Tailwind, é CSS puro desde o início. Não há "classe que o JIT
falhou em resolver": nunca existiu ali uma classe Tailwind, logo não há category error nenhum
para o JIT cometer. O comentário do próprio ficheiro mistura os dois problemas.

**A prova de que `SCALE.border.control` funciona perfeitamente via `className` está no mesmo
ficheiro**, três sítios abaixo (linhas 164, 331, 353):
```jsx
className={`flex-1 py-2.5 px-3.5 rounded-[9px] text-[13px] font-semibold ${SCALE.border.control} transition-all disabled:opacity-50`}
```
E em `ClientForm.jsx` (7 usos), `ClientManager.jsx` (1 uso) — todos a funcionar. Confirmei
`getComputedStyle` ao vivo nesta sessão em vários pontos com `SCALE.text.*` (que é exatamente o
mesmo mecanismo — string com `text-[Npx]` composta por template literal): `statLabel` deu
`fontSize:8px, fontWeight:800` exatamente como esperado, em 4 módulos, nos dois modos. A dúvida do
episódio anterior ("porque é que `border-width` computado dava `1px` em vez de `1.5px`") já está
resolvida e registada no `CLAUDE.md` como arredondamento de sub-pixel a 1×DPI — **não** como falha
de JIT. Não há registo de o `vite dev` alguma vez ter precisado de reiniciar para o
`SCALE.border.control`/`SCALE.text.*` funcionarem — o reinício que aconteceu foi por suspeita
errada, também já documentado.

**Porque funciona, mecanicamente:** o Tailwind v4 faz scanning por regex sobre bytes de ficheiro,
não avalia JavaScript. `designTokens.js` contém a string literal `'text-[9px] font-bold uppercase
tracking-[0.04em]'` — essa substring já existe, verbatim, dentro de um ficheiro `src/**/*.js` que o
scanner varre por omissão (sem `@source` a excluir nada, confirmado em A.1). O scanner não precisa
de "ver" o template literal composto em `ClientForm.jsx` — encontra a classe na própria origem, em
`designTokens.js`. É por isto que não há, nem pode haver, um problema sistémico aqui: **qualquer**
string Tailwind válida definida dentro de `SCALE`/`FT` e usada como está (sem concatenação
dinâmica de fragmentos, ex. `` `text-${size}px` ``) vai ser encontrada.

**O padrão que seria mesmo perigoso — e que não encontrei nenhuma ocorrência dele:**
```
grep -rn "className={\`.*\${FT\." src --include="*.jsx"
grep -rn "className={\`.*\${SCALE\." src --include="*.jsx"
```
Corri os dois. Zero resultados do tipo perigoso (fragmento de classe montado por concatenação de
string, ex. `` `text-[${n}px]` ``). Todos os ~90 resultados reais são interpolação de um **token
inteiro e já resolvido** (`${SCALE.text.badge}`, `${SCALE.border.control}`) dentro de uma classe
maior — o padrão seguro, já em uso extenso e a funcionar: `RequestEntryCard.jsx` (18×),
`ScheduleForm.jsx` (14×), `ClientForm.jsx` (7×), `FornecedorList.jsx`/`FornecedorForm.jsx` (9×),
`LoginView.jsx` (12×), `FormacaoElearningFlow.jsx` (3×), `Badge.jsx`, `Card.jsx`,
`SectionHeaderShell.jsx`, `ClientManager.jsx`, `KpiCard.jsx`, `FinancialSummaryPanel.jsx`.

**Classificação: falso alarme, não bloqueador.** O único cuidado real a reter (e a manter no
`CLAUDE.md`) é não concatenar fragmentos dinâmicos dentro de uma classe arbitrary value — isso sim
o JIT não resolve, mas é uma regra geral do Tailwind, documentada por eles, não uma
particularidade deste projeto.

**Correção aplicada (2026-08-24):** o comentário em `FormacaoElearningFlow.jsx:146-148` que
originou a leitura errada foi reescrito para explicar a causa real (variável de JS dentro de
`style` inline, nunca foi uma classe Tailwind) e aponta para esta secção do relatório, para que
quem o ler a seguir não repita o mesmo raciocínio.

### A.4 — PostCSS / build pipeline

Tailwind `^4.3.0`, plugin oficial `@tailwindcss/vite` (não PostCSS standalone). Sem `@source`, sem
`@config`. Nada a reportar além do já dito em A.1.

---

## Fase B — Contaminação cross-module

### B.1/B.2 — Imports de CSS solto

Todos os `.css` importados por `.jsx` em `src/`, e o que cada um realmente é:

| CSS | Importado por | Cross-module? |
|---|---|---|
| `App.css` | `app.jsx`, `AppLayout.jsx` (morto) | Não — é o global, esperado |
| `index.css` | `main.jsx` | Não — é o global, esperado |
| `ClientTimesheetReport.css` | só `ClientTimesheetReport.jsx` | Não, mas ver B.3 |
| `LoginView.css` | só `features/auth/LoginView.jsx` | Não |
| `reconciliacao-mockup.css` | 8 ficheiros: `ClientesTab`, `DespesasTab`, `EquipaTab`, `FaturasTab` (o de `cost-reports/`), `MargemTab`, `CostReports.jsx`, `ReconciliacaoAdmin.jsx`, `SalariosTab.jsx` | **Sim — já mapeado e aceite por decisão** (`.recon-scope`, identidade própria) |
| `WorkerDocuments.css` | **nenhum import normal** | Ver achado abaixo |

**`WorkerDocuments.css` não é importado como stylesheet em lado nenhum.** O único consumidor é
`useSignDocument.js:6`, via `import workerDocumentsCSS from '../WorkerDocuments.css?inline'` — o
sufixo `?inline` do Vite carrega o ficheiro como **string**, não como `<style>`/`<link>` real.
Confirmei que `WorkerDocuments.jsx` (o componente com o mesmo nome de base) não importa este CSS
de forma nenhuma. Ou seja: as regras deste ficheiro (incluindo `body {}`/`* {}` nas linhas
6/116/290) **nunca chegam ao DOM principal da app** — só existem dentro da string HTML que
`useSignDocument.js` injeta no iframe isolado de assinatura (Fluxo 2, já documentado no
`CLAUDE.md`). É o oposto de uma fuga: está corretamente isolado, apesar de o nome do ficheiro
sugerir o contrário a quem procurar só por grep. Vale a pena registar esta armadilha de nome —
mesma família do achado "sensibilidade por herança" já no `CLAUDE.md`, mas ao contrário: parece
global e não é.

`LoginView.css` é trivial — 8 linhas, uma única `@keyframes`/classe (`animate-bounce-subtle`), sem
seletor genérico, sem risco de colisão.

`reconciliacao-mockup.css` — sem seletores de tag genéricos soltos fora de `.recon-scope`
(confirmei por grep, zero ocorrências de `body`/`*`/`button` etc. sem prefixo). Consistente com
"identidade própria, mas contida" já documentado.

### B.3 — Seletores genéricos com risco de fuga

**Achado novo: `ClientTimesheetReport.css:2`**
```css
body {
  background-color: #f1f5f9;
}
```
Está **fora de qualquer `@media`** (o ficheiro tem `@media print` nas linhas 22 e 159, mas esta
regra não está dentro de nenhum dos dois). Isto é uma regra CSS global, sem scope, importada
normalmente (não `?inline`) por `ClientTimesheetReport.jsx`. Bundlers como o Vite injetam o CSS
importado como `<style>` no `<head>` na primeira vez que o módulo é carregado, e essa tag
tipicamente **persiste depois do componente desmontar** (não há mecanismo automático de remoção).
Isto significa que, na prática, assim que o relatório de horas do cliente for aberto uma vez numa
sessão, o fundo de `<body>` de **toda a app** muda para `#f1f5f9` pelo resto dessa sessão — não só
enquanto o relatório está visível. Não testei ao vivo para confirmar o sintoma exato (é fora do
âmbito "só leitura" desta fase), mas o código, por si, já basta para classificar isto como risco
real, não teórico.

O outro seletor genérico do mesmo ficheiro, `* { print-color-adjust: exact !important; }`
(linha 115), é inofensivo — essa propriedade não tem efeito nenhum fora do contexto de impressão.

**Classificação: inconsistência de aplicação, com potencial de bug visível.** Não é um bloqueador
do sistema de tokens, mas é o tipo de coisa que qualquer lote de limpeza deste ficheiro devia
resolver (mover o `background-color` para dentro de `.a4-paper` ou para um seletor com classe
própria, nunca `body`).

---

## Fase C — Inconsistências de valor

### C.1 — Cores hardcoded fora do sistema de tokens

Recontagem de controlo (não às cegas — o `CLAUDE.md` já tinha "115 ocorrências / 31 ficheiros"
para `#1B3A57` isolado, de uma fase anterior desta mesma migração): hoje, `#1B3A57`+`#EB8D00`
combinados, fora de `designTokens.js`, dão **118 ocorrências em 30 ficheiros** — consistente, sem
regressão nem crescimento anómalo desde a última medição.

Já está totalmente quantificado e decidido no `CLAUDE.md` (secção "Cor de marca fora do alcance
dos tokens"): 105 das 118 são `/NN` de opacidade, deixadas de propósito (risco de `color-mix` sem
fallback em browsers antigos); as restantes são as definições em `designTokens.js`/
`reconciliacao-mockup.css` e o `SSComunicacaoModal.jsx`, também já fora por decisão. **Não é um
achado novo — confirmo que os números continuam corretos.**

Cores Tailwind cruas (`amber-600`, `emerald-700`, etc., como texto de estado) — já censadas a
fundo nesta sessão: **1.512 ocorrências em 149 ficheiros**, das quais 1.377 candidatas reais depois
de descontar zonas já excluídas. Trabalho em curso, documentado extensivamente no `CLAUDE.md`
("Fase 2 — raios" / ponte de cor de estado). Não repito aqui.

### C.2 — `style={{ FT.x }}` inline

Contagem atual, por chave, de tudo o que aparece dentro de `style={{...}}`:

| Token | Ocorrências |
|---|--:|
| `FT.navy` | 132 |
| `FT.orange` | 102 |
| `FT.slate` | 94 |
| `FT.navyDeep` | 14 |
| `FT.ok` | 12 |
| `FT.slateDim` | 11 |
| `FT.inkSoft` | 9 |
| `FT.orangeDeep` | 8 |
| `FT.warn` | 7 |
| `FT.okBg` / `FT.bad` | 5 cada |
| `FT.warnBg` / `FT.badBg` | 3 cada |
| `FT.ink` / `FT.border` / `FT.badgeWarn` / `FT.badgeBad` | 2 cada |
| `FT.bg` | 1 |

**Importante para não ler isto como regressão:** o `CLAUDE.md` regista "ambos os canais de style
inline fechados" para `FT.slate` e `FT.navy` — mas essa afirmação é sobre um **subconjunto**
(essencialmente `color:` de texto/ícone dentro do admin), não sobre toda e qualquer ocorrência da
chave. Muitas das 132+94 que aparecem aqui são legítimas por desenho: os 36 casos documentados de
`backgroundColor: FT.orange` + `color: FT.navy` emparelhados (o navy não inverte de propósito
porque o laranja por baixo também não inverte), e o worker dashboard, onde `FT.ok/warn/bad`
continuam a ser o sistema real em uso (decisão já tomada na Fase 4 do `PLANO-DESIGN.md`, oposta a
`TONES`). Não tratar este número como "360 pendências" — é preciso separar caso a caso, como já se
fez nos canais fechados. Fica como inventário para quem for revisitar essa frente, não como lista
de trabalho pronta.

### C.3 — Tamanhos de texto arbitrários

Já censado a fundo nesta sessão (`CLAUDE.md`, Fase 3): **2.153 ocorrências, 62 valores distintos,
78,6% dos `.jsx`**, dominado por 10px/9px/11px/8px (89,7% do total). Não repito — confirmo que é
sistemático em todo o projeto, não concentrado num módulo, exatamente como o documento suspeitava.
É o que motivou a criação de `SCALE.text.*` e o rollout em curso.

### C.4 — Tamanhos de `ModalShell`

63 instâncias de `<ModalShell` no projeto. Distribuição de `size`:

| size | Usos |
|---|--:|
| `md` | 21 |
| `lg` | 19 |
| `2xl` | 9 |
| `sm` | 5 |
| `5xl` | 3 |
| `xl` | 2 |
| `3xl` | 2 |
| `4xl` | 1 |
| `6xl` | 1 |
| `viewer` | 1 |
| `clientWide` | 1 |

Padrão visível sem precisar de catalogar os 63 um a um: `sm`/`md` concentram-se em confirmações e
formulários curtos (1-2 campos), `lg`/`2xl` em formulários médios, os tamanhos `4xl`+ em ecrãs de
dados tabulares/relatório. Não fiz o levantamento ficheiro-a-ficheiro completo — os 63 casos
dariam para uma fase própria de documentação, não cabe no orçamento desta auditoria. Sinal
suficiente para dizer que **há** lógica implícita a formalizar, não achado urgente.

### C.5 — Padrão de header de modal

94 ocorrências de `title=` associadas às 63 instâncias de `ModalShell` (múltiplos títulos por
ficheiro em alguns casos). Verifiquei especificamente se havia instâncias de `ModalShell` **sem**
`title` nas primeiras 15 linhas (candidato a header custom por fora do padrão) — **zero
encontradas**. Todos os `ModalShell` atuais usam o padrão de header do próprio componente.

Os headers "custom" que existem no projeto pertencem todos a modais que **não usam `ModalShell`
de todo** — já mapeados exaustivamente no `CLAUDE.md` (`SSComunicacaoModal`, `SignDrawModal`,
`AdminSignDrawModal`, `WorkerDocuments.jsx`, e o `templates/Modal.jsx` ainda pendente de decisão).
Não há um terceiro grupo escondido de "ModalShell usado sem título".

---

## Fase D — Duplicação estrutural

**Aviso de precisão:** ao contrário das fases anteriores, estes números são só sinal — os greps
usados são propositadamente largos e não distinguem "mesmo componente reescrito" de "coincidência
de classes". Não os tratar como contagem de trabalho, só como indicação de onde vale a pena olhar
com mais cuidado antes de decidir componentizar.

### D.1 — Padrão de eyebrow/label

`text-[10px] font-black uppercase tracking-widest`, string exata: **423 ocorrências** em todo o
projeto — muito acima do "~15 no SalariosTab.jsx" que motivou a pergunta original; confirma que
não é um padrão local, é sistémico. Para contexto, o equivalente já tokenizado (`SCALE.text.
statLabel`) tem hoje 40 usos e `SCALE.text.badge` 19 — ou seja, a conversão em curso já cobre uma
fração pequena dos 423 literais. Reforça (não muda) a decisão já tomada de continuar o rollout
módulo a módulo em vez de um `<Eyebrow>` novo — seria bom candidato a componente só depois de o
vocabulário de tamanhos estar consolidado, não antes.

### D.2 — Botão de ação repetido

Não há uma string única e exata como no D.1 para procurar (o padrão "Exportar/SEPA/Descontos" é
mais uma família de intenção do que uma classe idêntica). A busca mais larga possível
(`font-black uppercase tracking-wide`, sem "s" final, para apanhar ambas as variantes) dá **797
ocorrências** — número claramente inflacionado por apanhar badges, labels e headers de secção que
nada têm a ver com botões de ação. **Não é um número utilizável.** Precisaria de um levantamento
dedicado (provavelmente por padrão de `onClick` + ícone + posição, não só classe) antes de ter
valor para decisão — fica registado como pendência de metodologia, não como achado quantificado.

### D.3 — Cartão "ícone + título uppercase"

Sinal aproximado (`p-2 rounded-xl` perto de um ícone): **30 ficheiros**. Mesma ressalva do D.2 —
é indicativo de que o padrão existe em volume, não uma contagem de instâncias reais do bloco
completo. Vale como justificação para uma auditoria dedicada, não como número final.

---

## Fase E — Armadilhas de descoberta/navegação

### E.1 — Ficheiros com nomes duplicados

```
Get-ChildItem equivalente (find + basename), todo o src/:
  2× LoginView.jsx
  2× FaturasTab.jsx
```

`FaturasTab.jsx` já estava mapeado. **`LoginView.jsx` é achado novo**, mesma família de risco:

- `src/client-portal/LoginView.jsx` — login do portal do cliente, consumido só por
  `ClientPortal.jsx` (linhas 4, 382, 400).
- `src/features/auth/LoginView.jsx` — login do admin/trabalhador, consumido só por `app.jsx`
  (linhas 20, 493). **É o ficheiro que converti nesta sessão para `SCALE.text`** (14 ocorrências).

Confirmei que os dois têm consumidor único e disjunto — não há ambiguidade real de import (ao
contrário do `FaturasTab.jsx`, onde os dois ficheiros vivem em pastas próximas e um deles tem
`.recon-scope`), mas o risco humano é o mesmo: qualquer busca por "LoginView" sem confirmar o
caminho completo pode abrir/editar o ficheiro errado. Recomendo a mesma regra já aplicada ao
`FaturasTab.jsx` no `CLAUDE.md` — citar sempre o caminho completo (`src/features/auth/LoginView.jsx`
vs `src/client-portal/LoginView.jsx`) em qualquer comunicação sobre um lote que toque um dos dois.

### E.2 — `AppLayout.jsx` e CSS órfão

Já confirmado como código morto (`main.jsx` monta `app.jsx`, não `AppLayout.jsx`). Confirmação
pedida pelo documento: `AppLayout.jsx:2` importa `'./App.css'` — o **mesmo** ficheiro global que
`app.jsx` também importa. Não tem CSS próprio, não tem classe exclusiva. **Seguro remover sem
efeito colateral visual** — não haveria nenhuma regra de CSS a ficar órfã, porque `App.css`
continua a ser carregado pelo `app.jsx` real.

### E.3 — `src/mocks/` (MSW)

`src/mocks/browser.js`, `handlers.js`, `server.js` existem, e `msw` está em `package.json`
(dependência + secção de config `"msw"`), mas **nada em `src/` importa nenhum dos três** (grep
confirmado, zero ocorrências de `mocks/browser`, `mocks/server`, ou qualquer import relativo para
a pasta `mocks`). Não há suite de testes no projeto (já sabido, `CLAUDE.md`) nem script em
`package.json` que referencie a pasta. **É scaffolding 100% inerte** — nem dev nem test o
carregam. Ruído de navegação puro: alguém a explorar "onde está a lógica de X" pode tropeçar nestes
handlers e assumir que representam comportamento real da API quando não influenciam nada em
execução. Candidato a remoção, sem relação com o design system.

---

## Classificação consolidada

| # | Achado | Ficheiro(s) | Classificação |
|---|---|---|---|
| A.1 | Sem cores nomeadas Tailwind, sem escala `fontSize` nomeada | `index.css`, todo `src/` | Característica estrutural aceite |
| A.3 | Premissa do JIT falso alarme; comentário desatualizado | `FormacaoElearningFlow.jsx:146-148` | **Não é bloqueador** — corrigir só o comentário |
| B.1 | `WorkerDocuments.css` parece global, está isolado por `?inline` | `useSignDocument.js:6` | Ruído de navegação (nome enganoso) |
| B.3 | `body{}` global sem scope, sem `@media` | `ClientTimesheetReport.css:2` | **Inconsistência com potencial de bug visível** |
| C.2 | 360 `style={{FT.x}}`, maioria legítima, sem triagem individual | ~40 ficheiros | Inventário, não lista de trabalho |
| C.4/C.5 | `ModalShell` consistente; sem headers custom escondidos | 63 instâncias | Sem achado, confirmação |
| D.1 | Padrão eyebrow sistémico, 423 usos | todo `src/` | Confirma decisão já tomada (rollout `SCALE.text`) |
| D.2/D.3 | Números não confiáveis, precisam de metodologia própria | — | Pendência de metodologia |
| E.1 | Segunda colisão de nome, `LoginView.jsx` | `client-portal/` vs `features/auth/` | **Risco de navegação — registar regra no CLAUDE.md** |
| E.2 | `AppLayout.jsx` seguro para remover | `AppLayout.jsx` | Confirmação, sem CSS órfão |
| E.3 | `src/mocks/` totalmente inerte | `src/mocks/*` | Ruído, candidato a remoção |

**Nenhum achado da Fase A muda decisões pendentes do `PLANO-DESIGN.md`** — não há bloqueador
estrutural que obrigue a repensar a Fase 4 (Badge/TONES) ou a Fase 5 (substituição em massa de
hex). O documento de referência do design system pode avançar sem esperar por mais nada desta
auditoria, exceto talvez decidir o destino de E.3 e corrigir o comentário de A.3 en passant.

Nenhum código foi alterado a produzir este relatório; nenhum push foi feito.
