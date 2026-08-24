# Plano de ação — design system

Baseado em `AUDITORIA-DESIGN.md` (2026-08-22). Cada fase é independente, entregável sozinha, e o repo
fica coerente se pararmos entre fases. Nenhuma fase depende de outra estar feita para compilar ou
funcionar — a ordem é só a que dá melhor retorno por risco, não a que agrupa por gravidade.

## Estado (2026-08-23, fim da sessão)

- **Fase 1 — feita e commitada** (`bb69eb5`): `ModalShell`, `SectionHeaderShell` e `SubTabBar`
  importam os tokens; `#e8a317`/`#e0455a` formalizados como `FT.badgeWarn`/`FT.badgeBad`;
  contradição do `App.css:37-54` resolvida.
- **Fase 2 — feita, commitada e verificada no browser** (`635af7c`): `templates/Modal.jsx` removido;
  `TemplateEditorModal` e `TemplateGenerateModal` migrados para `ModalShell`. Confirmado a 600/700/
  1200px: layout correto, rodapé fixo, e **Esc fecha** — a lacuna que o wrapper antigo tinha.
- **Fase 3 — feita, commitada e verificada no browser** (`1461177` + correção `4cec240`). A conversão
  `lg:`/`md:` → `@lg:`/`@md:` estava certa, mas dois limiares eram otimistas e cortavam conteúdo:
  `ScheduleForm` no modo simples (campo de hora a 66px, "--:" em vez de "--:--") e
  `FinancialReportOverlay` (o "€" cortado e um valor a transbordar por cima do cartão ao lado).
  Corrigidos para `@3xl` e `@5xl`, medidos no DOM a 600/700/820/1050/1100/1400px.
  O risco que este plano levantava — container query não recalcular na **primeira** abertura do
  modal — foi testado e **não se materializa**.
- **Fase 4 — feita e commitada** (`30e7faf`): Opção B escolhida — `TONES` deriva de
  `FT.ok/warn/bad` via variáveis CSS (`--ok`, `--warn`, `--bad` em `index.css`); `TipoBadge` é o
  primeiro consumidor real do `Badge`. Os outros 7 badges locais ficam para depois, um de cada vez.
- **Fase 5 — concluída na parte literal** (12 commits, `9525b81`..`02ef624`). Já não existe nenhum
  `#1B3A57`/`#EB8D00`/`#869AAF` literal em `src/` fora de três grupos, todos deliberados:
  1. **`SSComunicacaoModal.jsx`** (10 ocorrências) — fora, como sempre esteve.
  2. **`index.css` e `designTokens.js`** — são a fonte dos valores; é onde o hex deve estar.
  3. **~90 casos com modificador de opacidade** (`ring-[#1B3A57]/30`, `bg-[#1B3A57]/5`, …) —
     ver a decisão em aberto abaixo.
- **Fase 6 — feita e commitada** (`fc96c7d`): `.counter` e o `ACCENT_ALIAS` do `ModalShell`
  removidos. As 14 chaves de `SCALE` sem uso ficam, por decisão registada.
- **Fase 6 — parte 2, feita e commitada** (`4ffd6a9`): `ExpenseManager.jsx` apagado por decisão do
  Diego, junto com a linha do barrel e as 49 linhas de `.admin-table` em `App.css`. Fecha o achado 4
  da auditoria por remoção, não por correção. **Fica em aberto:** o barrel `features/admin/index.js`
  também não tem consumidores nenhuns — os 12 exports que restam são todos alcançados por import
  direto. Candidato a remoção inteira, mas é uma segunda decisão.

### Decisão em aberto — os ~90 hex com modificador de opacidade

Os lotes da fase 5 deixaram intacto tudo o que tem `/NN` a seguir ao hex, com base no comentário do
`--navy-soft` no `index.css` ("o Tailwind não aplica o modificador de opacidade a uma cor vinda de
`var()`"). **Testei e esse comentário já não é verdade no Tailwind v4** — `bg-[var(--navy)]/10`
compila e gera `color-mix(in oklab, var(--navy) 10%, transparent)`.

Mas gera-o dentro de um `@supports (color: color-mix(...))`, e o fallback fora do bloco é
`background-color: var(--navy)` — **a cor a 100%**. Num browser sem `color-mix` (anterior a
Chrome 111 / Safari 16.2 / Firefox 113, todos de 2023), um `bg-[var(--navy)]/5` que hoje é um
toque de fundo passaria a um bloco navy sólido. Com o hex literal isso não acontece: o Tailwind
gera `rgb(27 58 87 / 0.05)` diretamente, sem depender de `color-mix`.

Como a app é PWA em telemóveis de trabalhadores, cuja idade não controlamos, **não converti nada
disto** — a mudança é invisível em qualquer máquina de desenvolvimento e só apareceria no telemóvel
mais velho da equipa. As três saídas possíveis:

- **(a) Deixar como está.** Custo: os `/NN` continuam a repetir o hex. É o estado atual.
- **(b) Criar variáveis por nível de opacidade**, como o `--navy-soft` já faz para `/8`. Sem
  dependência de `color-mix`, mas é uma variável por nível usado (hoje: /5, /10, /15, /20, /30, /40).
- **(c) Converter para `var()` e aceitar o fallback.** Mais limpo no código, com o risco descrito.


**Antes de mais, duas correções aos números que levaste da auditoria** — ambas mudam a prioridade
relativa das fases que propuseste, por isso vale a pena lê-las antes do resto:

1. **O achado dos breakpoints (o teu item 3) não é 28 ocorrências em 8 ficheiros — é 6 ocorrências em
   3 ficheiros.** A minha primeira leitura da auditoria confiou nas mensagens de commit ("estes
   ficheiros foram migrados para modal") sem confirmar se o `lg:`/`md:` estava mesmo dentro da tag
   `<ModalShell>`. Um segundo agente fez essa verificação linha a linha e eu confirmei 4 dos casos à
   mão: `AdminSettings.jsx` e `NotificationsAdmin.jsx`, por exemplo, são páginas normais do admin
   (`<AdminSettings />` é renderizado fora de qualquer modal em `AdminDashboard.jsx:575`) — só uma
   fatia pequena de cada ficheiro é modal, e é essa fatia que não tem breakpoints problemáticos. Isto
   já está corrigido em `AUDITORIA-DESIGN.md`. Continua a ser o único achado com histórico real de
   partir layouts (dois fixes recentes o provam), mas o volume de trabalho é um décimo do que
   parecia.
2. **O teu item 4 (conflito `App.css:37-39` vs `51-54`) aplica-se a uma classe, `.admin-table`, que
   só é usada por `ExpenseManager.jsx` — e `ExpenseManager.jsx` não é importado por ninguém.** Nem
   pelo `app.jsx`, nem pelo `AdminDashboard.jsx`, nem por nenhum outro ficheiro — só é exportado por
   um barrel (`src/features/admin/index.js`) que também não tem consumidores. É código morto. O
   conflito de CSS existe, mas hoje não é visível em produção porque o ecrã que o mostraria não é
   alcançável a partir de lado nenhum da app. Isto muda o que a fase resolve — ver Fase 6.

---

## Fase 1 — Os três componentes comuns passam a importar os tokens

**O quê e porquê:** `ModalShell.jsx`, `SectionHeaderShell.jsx` e `SubTabBar.jsx` reproduzem à mão
`#1B3A57` (= `FT.navy`), `#EB8D00` (= `FT.orange`) e `rounded-[2rem]`/`rounded-2xl`/
`text-[1.3rem] font-bold leading-none` (= `SCALE.radius.modal`, `SCALE.radius.header`,
`SCALE.text.sectionTitle`) em vez de importar `designTokens.js`, apesar de viverem na mesma pasta
(`src/components/common/`) e ao lado de `Card.jsx`/`Badge.jsx`, que já o fazem corretamente. Achados
1.3 e 1.5 da auditoria. É a fase que dá coerência a todas as seguintes — não faz sentido pedir ao
resto do código para usar tokens se os próprios componentes partilhados não usam.

**Âmbito exato:**
- `src/components/common/ModalShell.jsx` — adicionar `import { FT, SCALE } from '../../styles/designTokens'`; trocar `#1B3A57` (linhas 30, 129, 144), `#EB8D00` (linha 144), `rounded-[2rem]` (linha 107) por `SCALE.radius.modal`. Aproveitar para apagar o `ACCENT_ALIAS` (linhas 36-40) — os 7 nomes antigos (`indigo`, `orange`, `slate`, `rose`, `navy`, `navyOrange`, `navyGradient`) têm confirmadamente **zero usos reais** no código (a única ocorrência de `accent="indigo"` encontrada pertence a um componente local diferente, não ligado ao `ModalShell`).
- `src/components/common/SectionHeaderShell.jsx` — mesmo import; trocar `rounded-2xl` (linha 44) por `SCALE.radius.header`, `text-[1.3rem] font-bold leading-none` (linha 52) por `SCALE.text.sectionTitle`, `#1B3A57` (linhas 47, 52) e `#EB8D00` (linhas 20, 24, 26) pelos tokens.
- `src/components/common/SubTabBar.jsx` — mesmo import; trocar `#1B3A57` (linha 18).
- **Decisão à parte, dentro desta fase:** `#e8a317` e `#e0455a` (`SectionHeaderShell.jsx:75`, `SubTabBar.jsx:25`) não correspondem a nenhum token existente — não são `FT.warn`/`FT.bad`. Recomendo **formalizá-los como dois tokens novos** (ex.: `FT.badgeAmber`, `FT.badgeRose`) com o valor exato que já têm hoje, em vez de realinhá-los para `FT.warn`/`FT.bad` — isso mudaria a cor visível sem ser essa a intenção desta fase. Realinhar é uma decisão de design separada, não uma limpeza de tokens.

Total: ~20-25 linhas alteradas em 3 ficheiros, mais ~4 linhas novas em `designTokens.js` (os dois
tokens novos).

**Risco:** baixo. Os valores hex e os valores de `SCALE` são idênticos aos que já lá estavam — não há
mudança visual esperada, só a fonte do valor muda. O que pode partir em silêncio: se algum dos
"quase-duplicados" que pareciam idênticos na leitura não for byte-a-byte igual (ex.: um `rounded-2xl`
que na verdade tinha um `!important` ou uma unidade ligeiramente diferente nalgum sítio que não vi),
a mudança visual seria subtil e fácil de não notar num diff de código.

**Como verificar:** `npx vite build` não prova nada aqui — é preciso ver os três componentes no
browser em `localhost:4179`. `ModalShell` é usado por 72 ficheiros; não dá para abrir todos, mas
abrir **um modal de cada `size`/`accent` usado** cobre a superfície de risco: um modal `accent="brand"`
com o filete laranja (ex.: ficha de cliente), um `accent="danger"` (ex.: eliminar registo), um
`layer="viewer"` (ex.: pré-visualização de documento em Documentos → pasta do colaborador), e um
`accent="default"` simples. Para `SectionHeaderShell`, abrir a secção "Equipa" ou "Clientes" no admin
e confirmar que o cabeçalho branco, o ícone e os separadores de abas continuam com o mesmo tom de
navy. Para `SubTabBar`, abrir um ecrã com sub-abas internas (ex.: Custos → separador dentro da página)
e confirmar o pill ativo.

**Esforço estimado:** pequeno — 1-2 horas incluindo a verificação visual.

**Reversibilidade:** total, `git revert` limpo — são 3 ficheiros, sem efeitos em dados nem em schema.

---

## Fase 2 — Migrar os 3 modais de templates para `ModalShell`

*(Responde à primeira pergunta em aberto — ver justificação completa mais abaixo.)*

**O quê e porquê:** `templates/Modal.jsx` é um wrapper genérico usado só por
`TemplateEditorModal.jsx` e `TemplateGenerateModal.jsx`, deixado "para decisão à parte" no commit da
fase 4b. Ao contrário do `SSComunicacaoModal`/`SignDrawModal`/`AdminSignDrawModal`, que ficaram fora
por razão técnica real (registo oficial do Estado, canvas dimensionado por JS), este não tem nenhum
bloqueio — é só um wrapper mais simples que nunca foi decidido. E tem uma lacuna real:
**não tem proteção de Esc/clique-fora durante gravação** — `TemplateEditorModal.jsx` recebe uma prop
`saving` (linha 21) mas `templates/Modal.jsx` não lê nada parecido com `busy`, e não tem listener de
Esc nenhum. É exatamente o tipo de bug que a prop `busy` do `ModalShell` já corrigiu nos outros 14
modais do lote 4b.

**Âmbito exato:**
- `src/components/admin/templates/Modal.jsx` (18 linhas) — remover depois de migrados os dois consumidores, ou manter como wrapper morto por uma fase até se confirmar que nada mais o usa (confirmei que só tem estes 2 consumidores).
- `src/components/admin/templates/TemplateEditorModal.jsx` (324 linhas) — trocar `<Modal onClose={onClose} title="..." wide>` por `<ModalShell isOpen onClose={onClose} title="..." size="3xl" busy={saving}>`; mover o rodapé de botões (linha 265) para a prop `footer`.
- `src/components/admin/templates/TemplateGenerateModal.jsx` (107 linhas) — mesma troca.
- Nenhum canvas, nenhum `ResizeObserver`, nenhuma dependência de `parent.clientWidth` nestes dois ficheiros — confirmei antes de recomendar a migração, ao contrário dos casos que ficaram deliberadamente fora.

**Risco:** baixo-médio. `TemplateEditorModal.jsx:130` tem um `lg:grid-cols-2` que hoje está dentro de
`Modal.jsx` (`z-[200]`, sem limite de largura fixo tipo `sm:max-w-*`) — ao passar para `ModalShell`
com um `size` fixo, este grid passa a estar genuinely dentro de um contentor de largura fixa, o que é
exatamente a armadilha da Fase 3. Corrigir para `@lg:` **ao mesmo tempo** que se migra, não depois.

**Como verificar:** Admin → Documentos → Templates (ou onde estiver a entrada, confirmar o caminho no
menu). Abrir "Editar Template" e "Gerar Documento", testar Esc durante uma gravação (deve ficar
bloqueado), testar em ecrã estreito e largo (o grid de 2 colunas do editor é o ponto a vigiar).

**Esforço estimado:** pequeno — meio dia, é o mesmo padrão já repetido 9 vezes nos lotes anteriores.

**Reversibilidade:** total.

---

## Fase 3 — Os 3 modais com breakpoints de viewport → container queries

**O quê e porquê:** achado 2 da auditoria, número corrigido (ver nota no topo). `ScheduleForm.jsx`
(linhas 69, 71, 222, 229), `TemplateEditorModal.jsx` (linha 130 — ver Fase 2, fazer junto),
`FinancialReportOverlay.jsx` (linha 97) usam `lg:`/`md:` dentro de conteúdo real de modal. É o único
achado da auditoria com histórico comprovado de causar bugs visíveis (dois fixes recentes,
`f8f12d4` e `576c362`).

**Âmbito exato:**
- `src/features/admin/schedules/ScheduleForm.jsx` — linhas 69, 71, 222, 229: trocar `lg:grid-cols-2/3` e `lg:col-span-1/2` por `@lg:`, dentro de um `<div className="@container">` (o ficheiro já tem um exemplo funcional na linha 169-202, replicar o padrão).
- `src/components/admin/templates/TemplateEditorModal.jsx:130` — mesma técnica (fazer junto da Fase 2 se ainda não tiver sido feito lá).
- `src/features/admin/FinancialReportOverlay.jsx:97` — mesma técnica.
- **Pré-requisito estrutural a decidir aqui:** `ModalShell.jsx:147` (o wrapper de `{children}`) não declara `@container`. Isso significa que cada consumidor tem de embrulhar o seu próprio conteúdo manualmente, como o `ScheduleForm` já faz — ou o `ModalShell` passa a declarar `@container` ele próprio, e todos os consumidores futuros ganham a proteção de borda. Recomendo a segunda opção: adicionar `@container` ao wrapper do `ModalShell` nesta fase, não só corrigir os 3 casos atuais.

**Risco:** médio — é layout, e já partiu duas vezes. O que pode partir em silêncio: container queries
precisam de o pai ter `container-type` definido; se o `@container` acabar num elemento com `display:
none` condicional (alguns modais só renderizam quando `isOpen`) o browser pode não recalcular a
query a tempo na primeira abertura — testar sempre a **primeira** abertura do modal, não só re-aberturas.

**Como verificar:** localhost:4179, redimensionar a janela do browser (não o telemóvel do DevTools —
o `ModalShell` já é responsivo por si, o que se testa aqui é a largura do modal em ecrãs médios/
grandes). Abrir "Novo Horário" (`ScheduleForm`, via Horários → Novo), redimensionar entre ~700px e
~1400px de largura de janela e confirmar que os rótulos ENTRADA/PAUSA/SAÍDA não se sobrepõem em
nenhuma largura. Repetir para os outros dois modais.

**Esforço estimado:** pequeno — 2-3 horas incluindo teste em várias larguras.

**Reversibilidade:** total.

---

## Fase 4 — Decisão Badge/TONES + consolidação dos badges locais

**O quê e porquê:** achados 1.1 e 1.2. `Badge.jsx` e `TONES` têm **zero consumidores reais** em toda
a app — só se usam um ao outro. Entretanto há pelo menos 8 implementações de badge locais
(`DivergenciaBadge`, `FieldBadge`, `StatusBadge`×2 ficheiros, `TagBadge`, `TipoBadge`×2,
`MonthStatusBadge`, `resolveBadge`) a fazer o que `Badge.jsx` deveria centralizar. E há um segundo
sistema paralelo, `FT.ok`/`FT.bad`/`FT.warn`, usado diretamente em 10 ficheiros do dashboard do
trabalhador, cujos valores hex nem sequer coincidem com os das classes Tailwind de `TONES` para o
mesmo conceito.

**Decisão que precisas de tomar antes de começar esta fase** (não é código, é escolha de produto):

- **Opção A — `TONES` vence.** `FT.ok`/`bad`/`warn`/`info`/`badBg`/`okBg`/`warnBg`/`infoBg` deixam de
  ser usados para estado (continuam a existir para outras coisas, se as tiverem); os 10 ficheiros do
  worker dashboard passam a usar `<Badge tone="...">` ou os seus valores Tailwind diretamente. A cor
  de sucesso muda de `#2E7D4F` para o emerald do Tailwind (~`#047857`) onde hoje se vê o verde `FT.ok`
  — **é uma mudança visual real**, pequena mas real, no dashboard do trabalhador.
- **Opção B — `FT.ok`/`bad`/`warn`/`info` vencem.** `TONES` passa a derivar destes hex em vez de usar
  classes Tailwind soltas (`TONES.success.text` passaria a `text-[${FT.ok}]` ou equivalente); `Badge`
  fica visualmente igual ao que já se vê no worker dashboard. Sem mudança visual no worker dashboard;
  mudança visual em `Badge.jsx` (que hoje não é usado em lado nenhum, logo sem impacto real).
- **Recomendo a Opção B.** `FT.ok`/`bad`/`warn`/`info` já estão em uso real, no dashboard do
  trabalhador, hoje; `TONES`/`Badge` estão a zero. É menos trabalho e zero risco visual mudar o
  sistema não usado para bater certo com o sistema usado, em vez do inverso.

**Âmbito exato (assumindo a Opção B):**
- `src/styles/designTokens.js` — reescrever `TONES` (linhas 44-51) para derivar de `FT.ok/okBg/bad/badBg/warn/warnBg/info/infoBg/teal/tealBg` em vez de classes Tailwind soltas. Como `SCALE`/`Badge` usam classes de string, isto provavelmente implica trocar `bg-emerald-50` por algo como `bg-[${FT.okBg}]` — confirmar que o Tailwind v4 aceita essa sintaxe dinâmica no vosso setup (JIT com string interpolada nem sempre é detetado pelo scanner de classes do Tailwind — testar, não assumir).
- Escolher **um** badge local para migrar como prova de conceito antes de tocar nos outros 7 — sugiro `TipoBadge`/`TagBadge` (usados só em 2-3 sítios do módulo de reconciliação) por serem os de menor fan-out, não os de maior.
- Os outros badges locais ficam para uma fase futura, um de cada vez — **não migrar os 8 de uma vez nesta fase**, é como o `ModalShell` foi feito (lotes pequenos, não um big bang).

**Risco:** médio-alto na parte de `TONES` (afeta a cor de fundo/texto que `Badge.jsx` vai mostrar,
mesmo sem consumidores hoje — importa para quando for adotado); baixo na migração do primeiro badge
de prova de conceito (fan-out pequeno, fácil de verificar).

**Como verificar:** depois de mudar `TONES`, criar um ecrã de teste temporário (ou usar o
Storybook/uma página de debug, se existir — confirmar se existe) que renderize `<Badge tone="success"
/>`, `<Badge tone="warning" />`, etc., lado a lado com o badge local equivalente no worker dashboard,
para comparação visual direta. Para a migração do `TipoBadge`/`TagBadge`, abrir a aba de Reconciliação
e confirmar que as etiquetas de tipo de transação continuam com a mesma cor/forma.

**Esforço estimado:** médio — a decisão em si é rápida (conversa, não código), mas a implementação e
verificação da Opção B é meio dia; cada badge local migrado a seguir é mais meio dia cada, um de
cada vez.

**Reversibilidade:** total por commit — fazer um commit só com a mudança de `TONES`, outro só com a
migração do primeiro badge, para poder reverter cada um independentemente.

---

## Fase 5 — Substituição em massa de `#1B3A57`/`#EB8D00` por `FT.navy`/`FT.orange`

**O quê e porquê:** achado 1.5. 476 ocorrências em 87 ficheiros para `#1B3A57`, 118 em 57 ficheiros
para `#EB8D00`. É o maior achado em volume, mas o de menor risco conceptual — é sempre o mesmo hex,
substituível 1:1.

**A tua pergunta: por lotes, ou não mexer e só aplicar a regra a código novo?**

Recomendo **não fazer isto de uma vez, e recomendo não fazer por lotes cegos (ex.: "50 ficheiros por
semana") — recomendo fazer por lotes agrupados por domínio funcional, com um critério: só entra num
lote um ficheiro que alguém vai ter de abrir por outra razão em breve, ou um cluster pequeno e
coeso.** Justificação:

1. **87 ficheiros é grande demais para verificar visualmente de uma vez com confiança** — build
   verde não prova nada aqui (é literalmente o mesmo valor hex, o build nunca vai acusar nada errado
   mesmo que a substituição tenha corrido mal a apanhar um `#1B3A57` dentro de uma string que não era
   suposto, ex. um comentário ou uma cor de PDF).
2. **CRLF é um risco real e mensurável aqui, não teórico:** confirmei que, dos 87 ficheiros, **50 têm
   terminadores CRLF e 37 têm LF** — mistura confirmada, exatamente a armadilha já conhecida do
   projeto. Um script de substituição por regex que não trate os dois finais de linha corretamente
   falha silenciosamente num dos dois grupos. Se decidires avançar com um script, corre-o com um
   editor que preserve terminadores por ficheiro (o `Edit` tool do Claude Code trata isto
   corretamente, um `sed`/PowerShell genérico não trata sem cuidado explícito) e confirma depois com
   `git diff` que nenhum ficheiro mudou de CRLF para LF nem vice-versa — isso por si só gera um diff
   enorme de ruído que esconde a mudança real.
3. **Alguns dos "quase-duplicados" que a auditoria listou podem não ser byte-a-byte `#1B3A57`** — por
   exemplo, tons ligeiramente diferentes usados de propósito (`#ffb444` no gradiente do `ModalShell`,
   que é uma variante mais clara do laranja, não um erro). Uma substituição cega de "qualquer coisa
   parecida com navy" arrisca apanhar isto. Manter a substituição estritamente literal
   (`#1B3A57` → `FT.navy`, nada mais) evita isto, mas então não apanha as variantes — que ficam por
   decidir caso a caso, não em massa.

**Critério de agrupamento recomendado:** por diretório/domínio, começando pelos piores ofensores que
também são os mais usados/visíveis — `RecibosCalculadora.jsx` (57+10 ocorrências, é o ecrã de cálculo
salarial, usado todos os meses), depois `FaturarClienteModal.jsx`/`WorkerForm.jsx` (32 cada), depois
o cluster `components/admin/Modo*.jsx` (Bursting, Documentos, Histórico — 3 ficheiros, mesmo padrão
repetido, boa relação esforço/ficheiros). Cada lote é 1-4 ficheiros do mesmo módulo, testado e
commitado antes do seguinte — exatamente como os lotes do `ModalShell` na fase 4b.

**Âmbito exato:** decidir lote a lote; não especificar tudo agora.

**Risco:** baixo por ficheiro (mesmo valor, substituição literal), mas **o risco acumula com o
volume** — 87 ficheiros dão muita superfície para um erro pontual passar despercebido se a
verificação for só "o build passou".

**Como verificar (por lote):** abrir cada ecrã tocado em `localhost:4179` e comparar visualmente antes/
depois (screenshot ou só olhar) — não basta grep confirmar que o hex desapareceu, é preciso ver que a
cor no ecrã é a mesma. Correr `git diff --stat` depois de cada lote e confirmar que só as linhas
esperadas mudaram (nenhuma mudança de terminador de linha em massa).

**Esforço estimado:** grande no total (provavelmente 15-20 lotes pequenos ao longo de semanas), mas
cada lote individual é pequeno (1-2h). **Alternativa honesta:** se não há apetite para isto agora,
está bem deixar como está e aplicar `FT.navy`/`FT.orange` só a código novo ou sempre que um ficheiro
for aberto por outra razão — o custo de não fazer nada é estético, não funcional, e não bloqueia mais
nada desta lista.

**Reversibilidade:** total, lote a lote.

---

## Fase 6 — Limpeza de baixo risco (opcional, avaliar se vale o churn)

**Honestamente, a maior parte disto não merece uma fase dedicada.** Respondo item a item:

- **`.admin-dashboard-container` e `.counter` em `App.css`/`index.css` (0 usos confirmados).**
  Vale a pena apagar — é código morto sem ambiguidade, 2 linhas, zero risco. Mas não merece uma fase
  só para isto: apagar na próxima vez que `App.css` for aberto por outra razão (ex.: Fase 1 ou o
  ponto abaixo).
- **`ExpenseManager.jsx` + a classe `.admin-table` que só ele usa.** Isto **precisa** de uma decisão
  tua, não é limpeza automática: o componente existe, tem 104 linhas, parece funcional, mas não é
  importado por nada. Ou (a) é resto de um ecrã que se tencionava ligar e nunca se ligou — nesse caso
  vale a pena perceber se ainda é preciso, e só depois vale a pena corrigir o conflito
  `App.css:37-39`/`51-54`; ou (b) é código morto de vez — apaga-se o componente e a classe `.admin-table`
  junto, e o conflito de CSS deixa de existir por não ter nada para se aplicar. **Recomendo (b)** a
  não ser que reconheças o ecrã e queiras revivê-lo — perguntar antes de decidir.
- **6-7 aliases mortos do `ModalShell` (`ACCENT_ALIAS`).** Já incluído na Fase 1 — não repetir aqui.
- **14 das 22 chaves de `SCALE` sem uso (`radius.tab/control/input/header/modal`, toda a
  `text.*` exceto `text.badge`, `pad.stat/input`).** **Recomendo não apagar.** Ao contrário de código
  morto normal, isto é uma tabela de valores medidos em mockups aprovados (o comentário do próprio
  ficheiro diz isso) — é vocabulário de design barato de manter e caro de reconstruir se for preciso
  outra vez. `SCALE.radius.header`/`SCALE.text.sectionTitle` só ficam com uso real depois da Fase 1;
  as restantes (`radius.tab`, `radius.control`, `radius.input`, a escala de preços/valores) são
  candidatas óbvias a consumidor assim que se tocar em botões, campos de formulário ou cartões de
  valor — não são lixo, são tokens à espera do call site certo.

**Se decidires fazer esta fase:** é a única desta lista que dá para fazer toda de uma vez, numa
sessão, sem risco de layout — é remoção de código morto confirmado, não substituição em massa.

**Esforço estimado:** trivial, 30-60 min (excluindo a decisão sobre `ExpenseManager.jsx`, que é uma
conversa, não código).

**Reversibilidade:** total.

---

## Pergunta em aberto 1 — Templates: migrar para `ModalShell`?

**Sim — ver Fase 2.** Não há razão técnica para não migrar (confirmei: sem canvas, sem
`ResizeObserver`, sem dependência de layout de flex-container como os casos que ficaram
deliberadamente fora). E migrar corrige uma lacuna real de hoje — `templates/Modal.jsx` não tem
proteção de Esc/clique-fora durante gravação, o mesmo bug que a prop `busy` já corrigiu nos outros 14
modais migrados. É o único dos "3 pendentes" que devia continuar pendente por preferência, não por
bloqueio — e mesmo assim, não vejo motivo para o deixar pendente mais tempo.

## Pergunta em aberto 2 — Levar `SectionHeaderShell`/`SubTabBar`/`Card` ao worker dashboard e ao
## portal do cliente?

**Não recomendo, pelo menos não como projeto de convergência.** Verifiquei a navegação real das duas
interfaces antes de responder:

- O **dashboard do trabalhador** usa `WorkerNavBar` — uma barra de navegação inferior fixa, ícone +
  rótulo, pensada para telemóvel (é onde os trabalhadores efetivamente usam a app, conforme o
  `CLAUDE.md` já regista para a assinatura). `SectionHeaderShell` é um padrão de topo de página
  desktop, com sub-abas em pill — dois paradigmas de navegação diferentes, não dois estilos do mesmo
  paradigma. Forçar o segundo por cima do primeiro seria pior UX, não mais consistência.
- O **portal do cliente** tem o seu próprio `ClientPortalNavbar.jsx` — que já resolve dropdown de
  notificações, seletor de mês, troca de idioma (PT/ES) e logout, tudo isto fora do âmbito do que
  `SectionHeaderShell` faz. Substituir só a parte das abas por `SubTabBar` é tecnicamente possível
  mas de baixo retorno — não resolve nenhuma inconsistência visível, só troca uma implementação
  funcional por outra.

**Onde faz sentido divergir menos:** `Card`/`CardGrid` são o candidato mais razoável a levar a outras
interfaces, caso surjam grelhas de entidades lá (hoje não vi nenhuma no worker dashboard nem no
portal do cliente que se pareça com o padrão "cartão de colaborador/cliente" do admin) — mas isto é
uma decisão para quando/se essa necessidade aparecer, não uma fase a agendar agora.

---

## Resumo da ordem recomendada

| # | Fase | Esforço | Risco | Depende de |
|---|---|---|---|---|
| 1 | Componentes comuns importam tokens | pequeno | baixo | — |
| 2 | Templates → `ModalShell` | pequeno | baixo-médio | — |
| 3 | 3 modais: breakpoints → container queries | pequeno | médio | Fase 2 (parcial, mesmo ficheiro) |
| 4 | Decisão Badge/TONES + 1º badge migrado | médio | médio-alto | — |
| 5 | Substituição em massa de hex (por lotes) | grande, fatiável | baixo por lote | — |
| 6 | Limpeza de baixo risco (opcional) | trivial | baixo | Decisão sobre `ExpenseManager.jsx` |

Nenhum código foi alterado a escrever este plano; nenhum push foi feito.
