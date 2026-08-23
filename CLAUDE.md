# APP MAGNETIC PRODUÇÃO

## Diretrizes de trabalho

Reduzem os erros clássicos. Compromisso assumido: cautela acima de velocidade. Para tarefas triviais,
usar bom senso.

**1. Pensar antes de codificar.** Não assumir, não esconder confusão, expor tradeoffs. Antes de
implementar: explicitar as assunções, e perguntar se houver incerteza; se existirem várias
interpretações, apresentá-las em vez de escolher em silêncio; se existir uma abordagem mais simples,
dizê-lo e contestar quando fizer sentido; se algo não estiver claro, parar, nomear o que confunde e
perguntar.

**2. Simplicidade primeiro.** O mínimo de código que resolve o problema, nada especulativo. Sem
funcionalidades além do pedido, sem abstrações para código de uso único, sem "flexibilidade" ou
configurabilidade não pedidas, sem tratamento de erros para cenários impossíveis. Se escreveste 200
linhas e davam 50, reescreve. O teste: um engenheiro sénior diria que isto está complicado de mais?

**3. Alterações cirúrgicas.** Tocar só no necessário, limpar só a própria sujidade. Não "melhorar"
código, comentários ou formatação adjacentes; não refatorar o que não está partido; seguir o estilo
existente mesmo que se fizesse de outra forma. **Código morto não relacionado: mencionar, não
apagar.** Remover apenas os imports/variáveis/funções que as próprias alterações tornaram órfãos. O
teste: cada linha alterada deve remontar diretamente ao pedido.

**4. Execução orientada a objetivos.** Transformar tarefas em objetivos verificáveis ("adicionar
validação" → "escrever testes para inputs inválidos e fazê-los passar"). Em tarefas de vários passos,
enunciar um plano curto com a verificação de cada passo. Critérios de sucesso fortes permitem iterar
sem supervisão; critérios fracos ("fazer funcionar") obrigam a clarificações constantes.

> Neste repo não há suite de testes, por isso o ponto 4 traduz-se em critérios verificáveis no
> browser e nos artefactos gerados, não em testes automatizados.

Gestão de RH e operações da Magnetic Place Unipessoal, Lda (cedência de mão-de-obra, sede na Trofa,
trabalhadores destacados em clientes industriais em PT e ES). ~28 trabalhadores, ~13 clientes.

**Stack:** React 19 + Vite 6 + Tailwind CSS v4 + Supabase (Postgres, Storage, Auth). PWA com service
worker. Deploy Vercel **automático em cada `git push`** — nunca fazer push sem confirmação explícita
do Diego, porque dispara deploy para produção.

**Domínios:** turnos e horários, registo/validação/aprovação mensal de horas, documentos com
assinatura digital (PDF assinado + carimbo), processamento salarial (recibos, mapas de ajudas de
custo), faturação com TOConline, reconciliação bancária (SaltEdge/Tink), Segurança Social (admissões
REST, cessações SOAP). Três interfaces: painel admin, dashboard do trabalhador, portal do cliente.

**Repo irmão:** `C:\Users\diego\CONSELHEIRO-ESTRATEGICO` — agente WhatsApp "Trabalhador Virtual",
precisa de `vercel deploy --prod` manual (deploy separado, não automático).

## Armadilhas conhecidas

- `src/AppLayout.jsx` e `src/features/admin/AdminTopbar.jsx` são código morto; nada os importa.
  O `main.jsx` monta o `src/app.jsx`.
- Breakpoints Tailwind (`lg:`, `md:`) medem a viewport, não o contentor — partem layouts dentro de
  modais de largura fixa. Usar container queries (`@container` no pai + `@md:` no filho).
- Ficheiros com terminações de linha mistas (LF/CRLF); substituições por script falham
  silenciosamente nos CRLF. Verificar sempre o resultado.
- `npx vite build` passar não prova nada sobre props erradas, ícones perdidos ou imports órfãos.
  Correr também `npx eslint .` e confirmar no browser (localhost:4179). Não há suite de testes E2E
  fiável para regressões visuais.
- Migrações Supabase: `supabase db query --linked -f <ficheiro>`, **nunca** `db push`. Depois de DDL
  direto, `NOTIFY pgrst, 'reload schema';`.
- PDFs têm dois motores: jsPDF (programático, imune a CSS) e html2canvas (captura o DOM, sensível a
  CSS). Verificar qual é qual antes de mexer em estilos globais.
- Nunca inventar códigos de campos da Segurança Social — são registos oficiais, há PDFs de
  especificação técnica do PSI no repo.
- `* { text-transform: uppercase !important }` global em `App.css` — usar `className="text-natural"`
  para escapar quando necessário.

## Design system (em migração)

`src/styles/designTokens.js` (paleta FT, tons TONES, escala SCALE) e `src/components/common/`
(ModalShell, SectionHeaderShell, SubTabBar, Card, Badge).

Levantamento em 2026-08-22: dos ficheiros `*Modal*.jsx`, 41/47 já usam `ModalShell`. Os 6 que não
usam dividem-se em dois grupos:

**Excluídos deliberadamente, com razão técnica documentada no commit (não mexer sem reabrir o caso):**
- `src/features/admin/team/SSComunicacaoModal.jsx` — comunica à Segurança Social; Esc a meio do POST
  reproduziria um bug já corrigido, o banner de aviso de ambiente real perderia destaque dentro do
  shell, e é renderizado dentro de outro ModalShell (WorkerForm) — shell dentro de shell prende o
  `position:fixed` do filho no `transform` da animação.
- `src/components/common/AdminSignDrawModal.jsx` e `src/components/worker/SignDrawModal.jsx` — pads
  de assinatura; o `<canvas>` é dimensionado a partir de `parent.clientWidth/clientHeight` num
  container flex que o shell não fornece — a área de desenho colapsaria para ~200px em mobile.
- `src/components/common/WorkerDocuments.jsx` (visualizador acroform, linha ~475) — não é um modal,
  é um wrapper à volta do `DocumentViewer` com painel/header/footer próprios e um
  `applyFitToWidth`/`ResizeObserver` que calcula escala a partir da largura do contentor; dentro do
  shell a largura de referência mudaria.

**Pendentes, sem decisão tomada ainda:**
- `src/components/admin/templates/Modal.jsx` (wrapper genérico usado só por `TemplateEditorModal.jsx`
  e `TemplateGenerateModal.jsx`) — ficou explicitamente "para decisão à parte", ao contrário dos
  três acima que têm bloqueio técnico real.

Ao adicionar ou tocar num modal novo, confirmar primeiro se já existe `ModalShell` a resolver o caso
antes de escrever CSS/z-index à mão.

## Áreas delicadas

Nestes dois fluxos o erro é silencioso e só aparece no artefacto final (registo criado no Estado, ou
PDF assinado gravado com traço distorcido) — `npx vite build` passar não prova nada. Testar sempre o
caminho real antes de dar como resolvido.

### Fluxo 1 — Segurança Social

Ficheiros: `api/seguranca-social/index.js`, `api/seguranca-social/_soapUtils.js`,
`src/data/motivosContratoSS.js`, `src/features/admin/team/SSComunicacaoModal.jsx`.

São **dois protocolos diferentes**, não um:
- Admissão — REST/JSON — `/ptss/rest/qlf/tco/vinculos/pedido`
- Cessação — SOAP — `/ws/contrato/v1/cessarVinculoTrabalhador`
- Consulta — SOAP — `/ws/contrato/v1/obterComunicacoes`

O ambiente é decidido por `SS_AMBIENTE` (`producao` vs qualquer outra coisa) e muda o host:
- Produção: `app.seg-social.pt`
- Testes: `extwww.seg-social.pt` (REST) e `extservices.seg-social.pt` (SOAP)

⚠ **Em produção, cada envio cria um registo oficial no Estado. Não há desfazer pela API.** O modal
tem um banner vermelho de propósito — foi acrescentado deliberadamente e não deve ser despromovido
de posição (ver razão da não-migração para ModalShell acima).

Regras de negócio que já custaram rejeições reais da SS:
- `fim-contrato` só vai para contratos a termo certo. Enviá-lo vazio em termo incerto dá
  "DATA FIM CONTRATO COM FORMATO INVÁLIDO".
- `motivo-contrato` é obrigatório para termo certo (exceto modalidade "I") e para todo o termo
  incerto. Códigos válidos em `src/data/motivosContratoSS.js`, extraídos do PDF oficial do PSI.
- Os motivos STAJ/STAT/STLR/STTC exigem o NISS do trabalhador substituído.
- Cessação: `data-fim-vinculo` não pode ser futura nem ter mais de 60 meses.

**Nunca inventar um código.** Se faltar, pedir o PDF de especificação técnica do PSI ao Diego — ele
tem-nos.

Autenticação: sessão de admin ou header `x-agente-secret` (`AGENTE_SERVICE_SECRET`), este último para
o agente de WhatsApp chamar sem sessão de browser — é um segredo próprio, distinto do
`SESSION_SECRET`.

A consulta `obterComunicacoes` só devolve comunicações "a processar" ou "não aceites" — **nunca** as
aceites com sucesso. É um complemento, não um histórico.

### Fluxo 2 — Assinatura de documentos

Ficheiros: `src/components/common/workerDocuments/useSignDocument.js`,
`src/components/worker/SignDrawModal.jsx`, `src/hooks/useSignatureStamp.jsx`,
`src/components/worker/DocumentViewer.jsx`.

O PDF assinado é gerado dentro de um `<iframe>` isolado (`useSignDocument.js:109`), com
`sandbox="allow-scripts"`, medindo 900×1300px fora do ecrã. O `html2pdf` é carregado por CDN dentro
desse iframe.

Consequência: o CSS da app **não** afeta o PDF gerado — foi por isso que a limpeza do CSS global foi
segura. Mas também significa que mudanças no iframe não são visíveis em testes normais no browser.

Trilha de auditoria em `worker_documents`: `signed_at`, `signed_ip` (via ipify), `signature_data`
(dataURL do traço) e `signed_pdf_url`. Há ainda um carimbo com QR de verificação.

⚠ Os canvas de assinatura são dimensionados por JavaScript a partir de `parent.clientWidth` e
`clientHeight`. Se mudares o layout do pai, o traço sai distorcido — **e fica gravado assim num
documento legal.** Foi por isso que `SignDrawModal` e `AdminSignDrawModal` ficaram deliberadamente
fora da migração de modais.

Código morto: `WorkerDocuments.jsx` tem um `canvasRef` e um `useEffect` que o dimensiona, mas zero
elementos `<canvas>` — resto de uma refatoração antiga. Não te deixes enganar por ele.

## Migração de tokens FT — regras de decisão

Aplicam-se a qualquer lote de conversão Tailwind → tokens `FT`/CSS vars (`designTokens.js`,
`index.css`). Servem para decidir sozinho os casos repetidos; só escalar ao Diego os genuinamente
novos.

### Contagens

**Nunca comunicar um número sem o ter corrido.** Aconteceu três vezes nesta migração, sempre no
mesmo sentido — a estimativa a olho inflaciona:
- a soma manual da tabela de progresso dava 1.107, o valor derivado do script era 1.189;
- a raiz de `features/admin` foi anunciada como «~1.900», eram 1.319 (e o número certo só apareceu
  quando se percorreu ficheiro a ficheiro);
- os hex arbitrários foram anunciados como «~30», eram 16.

Nenhuma foi grave por si, mas todas alimentaram decisões de ordem e de âmbito. A regra é correr
`verificar-lote-design.sh` ou um `grep -c` **antes** de escrever o número, não depois de alguém
perguntar. E usar sempre a mesma métrica: o script conta **ocorrências**, não linhas — 34 linhas com
`slate` podem ser 51 ocorrências, e misturar as duas foi o que produziu a discrepância do FaturasTab.

### Antes de cada lote

- **Onde há `style` inline, ele é a fonte de verdade visual — não a `className`.** Vale para
  qualquer verificação baseada em grep de classe: procurar `text-white` diz o que está escrito, não
  o que se vê, e num elemento que tem `style={{ color: ... }}` a classe pode estar lá sem efeito
  nenhum. Nos 34 candidatos a laranja+branco, 23 eram exactamente isso — classe morta que fazia o
  script acusar botões já correctos. **Antes de agir sobre uma classe encontrada por grep, verificar
  se o mesmo elemento tem `style` inline a sobrepor-se-lhe**; e, na dúvida, medir a cor computada no
  browser, que é o único sítio onde a cascata já está resolvida.
- **`grep` conta ocorrências da string, não trabalho.** Já enganou de quatro maneiras diferentes:
  contando comentários, ignorando CRLF, tratando `/NN` como parte da cor e lendo `oklab` como RGB.
  O caso mais recente: `ModoLote.jsx` aparecia com 1 classe por converter, e era
  `pdf.setTextColor(30, 41, 59);    // slate-800` — um comentário a documentar o RGB passado ao
  jsPDF. Converter o comentário não faria nada; mexer no número mudaria o PDF. **Confirmar que a
  ocorrência é código antes de a tratar como pendente**, sobretudo em ficheiros que geram
  ficheiros, onde as cores aparecem como valores numéricos e não como classes.
- **Correr `verificar-lote-design.sh` sobre `admin` + `components/admin` inteiros, não só o módulo do
  lote.** Duas inconsistências (`color-mix` num `shadow-[var(--orange)]/30`, um botão laranja com
  `text-white` fora do padrão indigo) só apareceram na verificação global — o script do módulo não as
  via.
- Confirmar se o ficheiro/pasta está dentro de algum escopo com vocabulário próprio (ex.
  `.recon-scope` em `reconciliacao-mockup.css`). Se estiver, **não convergir sem decisão explícita**
  — tratar a colisão de variável como pendência registada, não como bug a corrigir.
- Detetar mapas de cor-à-escolha (uma chave com nome de cor cujo valor usa classes dessa cor — ex.
  paleta de tags do `OrfaoBancoModal`). Nesses, a cor é dado, não estado semântico — não converter.
  Mesma lógica dos cartões de métrica com indigo/rose/emerald como cor-de-dado.

### Durante

- Classificar cada ocorrência por função, não por classe: **ícone/decorativo → `FT.slate`; texto a
  ler (rótulos, `<th>`, chips, NIF, datas) → `FT.slateDim`.** Uppercase pequeno (10px) não é
  automaticamente decorativo — se o utilizador tem de o ler para agir, é texto.
- **Mas "ícone ou texto?" não é a pergunta de base — é um atalho que só funciona quando o token em si
  é estável nos dois modos.** A pergunta correta é sempre **"o que está por baixo muda de tom no
  modo escuro?"**. Com o `FT.slate` (#869AAF, que serve claro e escuro) as duas perguntas dão a mesma
  resposta, e por isso o atalho passou despercebido. Com o `FT.navy` não: o navy é escuro e fica
  ilegível sobre fundo escuro, seja ícone ou texto — ali o critério teve de ser o fundo, e foi o que
  separou os 72 a converter dos 36 que assentam em laranja sólido e ficam.
- **Atalho técnico para canais inline:** `style={{ color: 'var(--token)' }}` segue o `.dark`
  normalmente — a variável resolve no contexto do elemento. Quando só a **fonte do valor** precisa de
  mudar (uma constante JS que não inverte → um token que inverte), preferir isto a mover o valor para
  `className`: é uma substituição no mesmo sítio, sem tocar na estrutura do JSX. Foi assim que os 72
  `color: FT.navy` foram corrigidos sem reescrever um único componente.
- **Contraste depende do fundo, não só da cor do texto.** Medir sempre in-place; um chip sobre
  `--surface-dim` pode precisar de `--ink-soft` mesmo com a mesma cor de texto que passa noutro sítio.
- **Regra de fundo escuro:** sobre fundo claro o texto desce na escala de tinta (mais escuro); sobre
  fundo escuro sobe (mais claro). Não aplicar a mesma direção às cegas — foi o erro que escureceu
  "Unipessoal, Lda" no topbar navy — hoje resolvido com o --on-navy (ver abaixo).
- **O canal inline fora do admin: 5 convertidos, 12 mantidos de propósito.** A pergunta de sempre —
  *o fundo por baixo inverte?* — deu a resposta inversa da esperada: no dashboard do trabalhador a
  maioria dos textos assenta em fundos que **não** invertem (`background: FT.panel`, `FT.warnBg`,
  `FT.okBg`, `'#F4F2EC'`, `'#F5F3EE'`), e ali a constante JS é o par correcto. Só 5 estavam dentro
  de `bg-white`, que inverte pela regra-ponte, e esses passaram a `var(--…)`:
  `WorkerDocuments` 342/350/359 e `WorkerScheduleTab` 89/91.
  **A heurística do "fundo mais próximo para trás" errou em três dos cinco** — apanhava o
  `background` de um elemento IRMÃO (a caixa do ícone ao lado, o `<select>` a seguir, um `<iframe>`
  no ramo anterior do ternário) em vez do contentor. Foi preciso ler a estrutura para separar pai de
  irmão. É a mesma armadilha da proximidade que já apareceu no varrimento por fundo e no par chip:
  **linhas próximas no código não são elementos aninhados no ecrã.**
  **Ferramenta:** `perl scripts/fundo-do-ancestral.pl <ficheiro> <linha>` responde à pergunta "que
  fundo está por baixo desta linha?" usando a **indentação** para separar pai de irmão, em vez da
  proximidade. Nos três casos que a proximidade errou — a caixa de ícone irmã, o `<select>`
  seguinte, o `<iframe>` de outro ramo do ternário — acerta. Onde não encontra ancestral com fundo
  (por exemplo quando o fundo vem de uma função helper, como o `FT.panel` do `FormacaoElearningFlow`)
  devolve `?` em vez de apontar o vizinho: **falhar em silêncio é pior do que dizer "não sei"**.
  Não substitui a medição no browser, que é onde a cascata está resolvida de facto — serve para
  triar sem renderizar.
- **Sobre os fundos navy da marca, use-se `--on-navy` (#A9B8C7).** Os fundos navy — `--navy-solid`,
  `background: FT.navy` — não invertem, e a escala de tinta não tem tom que sirva ali: o
  `--slate-dim` inverte e cai para 2,30:1 no modo claro; o `--slate` não inverte mas fica a 4,05:1,
  a falhar AA por pouco. Foram precisos três encontros com o mesmo beco para o perceber — o
  "Unipessoal, Lda" do topbar, os rótulos do KpiCard em modo `dark`, e o mês/ano do recibo — e o
  comentário do KpiCard chegou a documentá-lo como se fosse inevitável ("nenhum tom de neutro serve
  os dois"). Não era: faltava um token para o papel. O `--on-navy` dá 5,79:1 e, como o fundo é
  constante nos dois modos, também não é redefinido no `.dark`.
  **O varrimento que os encontrou não foi por classe, foi por fundo:** percorrer o DOM à procura de
  elementos cujo fundo efectivo seja um dos navys fixos e medir tudo o que lá está por cima. A busca
  estática equivalente deu 117 candidatos, quase todos falsos positivos — um avatar navy seguido de
  texto sobre fundo branco parece igual no código e é o contrário no ecrã.
- **Tinta não serve de fundo.** Os tokens de tinta — `--ink`, `--ink-mid`, `--ink-soft`, `--navy`,
  `--slate`, `--slate-dim` — invertem no modo escuro, porque é isso que se espera de texto. Usá-los
  como superfície (`bg-`, `backgroundColor`) faz o fundo clarear no escuro enquanto o texto por cima
  fica igual. Para fundo, usar sempre as variantes que **não** invertem: `--navy-solid` (o navy da
  marca) e `--navy-deep` (para o hover).
  A verificar em cada lote — **já apareceu cinco vezes** e parece inofensiva de cada vez:
  - `bg-[var(--navy)]` na barra do trabalhador e nos 30 botões `bg-[var(--orange)]
    text-[var(--navy)]` → resolvido com `--navy-solid`;
  - `bg-[var(--ink)]` no botão "gerar relatório" (documents) → 16,9:1 no claro, **1,2:1 no escuro**;
  - `bg-[var(--ink-mid)]` no botão "marcar resolvido" (corrections), introduzido por um lote anterior
    e só apanhado dois lotes depois, porque a verificação de então corria só em modo claro;
  - `bg-slate-800` no `<tfoot>` da ContabilidadeTab → `--navy-solid`;
  - `bg-slate-900` no painel de Resumo do Turno (ScheduleForm) → `--navy-solid`.

  **O detetor do script apanha os três primeiros, não os dois últimos** — e a diferença importa. Ele
  procura `bg-[var(--ink*)]`, ou seja o erro **depois de cometido**. Nos casos 4 e 5 a origem era
  `bg-slate-800/900` ainda em Tailwind, e a decisão errada teria sido convertê-los para um token de
  tinta; aí o script já os apanharia, mas com o estrago feito. A prevenção continua a ser a régua
  mental na hora de escolher o destino de um fundo escuro: **é superfície, logo `--navy-solid` /
  `--navy-deep`, nunca a escala de tinta.**

  **A lista de tokens do detetor tem de acompanhar o bloco `.dark`:** só entra token que lá esteja
  redefinido. O `--slate` está de fora de propósito — serve os dois modos (5,68:1 sobre `--surface`
  no escuro, 2,9:1 sobre branco no claro), por isso os `hover:bg-[var(--slate)]` que existem são
  legítimos e a primeira versão do detetor dava-lhes falso positivo. Se um dia se acrescentar ou
  retirar um token do `.dark`, actualizar a lista no script — senão o mesmo falso positivo volta,
  ou pior, um token que passou a inverter deixa de ser vigiado.
- Nunca `/NN` (opacidade) sobre `var(--token)` — compila para `color-mix` com fallback a 100%,
  visualmente diferente do esperado. Criar variável dedicada com o alpha embutido (ex.
  `--orange-shadow`) em vez disso.
- `sed` como correções de contraste pode comer terminações de linha (CRLF→LF). Verificar sempre com
  `git diff` antes de commitar.

### Depois

- Varrimento de contraste no ecrã real, **nos dois modos (claro e escuro)**, não só claro — o modo
  escuro pode ficar diferente do esperado se houver regras `.dark` legadas com `!important` presas a
  classes em vez de tokens.
- **Os varrimentos de contraste medem só o estado normal; `hover`/`focus`/`active` não são cobertos
  automaticamente — verificar à mão quando um lote toca em `hover:bg-*`.** Foi assim que passou
  despercebido, durante 18 lotes, um hover que tornava o botão *menos* legível ao passar o rato:
  nenhum varrimento o via, porque em repouso o botão estava correcto.
  Duas lições que valem para além deste caso:
  - **Com texto escuro, o hover tem de clarear, não escurecer.** A convenção "hover escurece"
    pressupõe texto branco. Nos botões primários (navy sobre laranja) escurecer aproxima as duas
    cores: `--orange-deep` dava 3,39:1 contra os 4,66:1 do repouso. Daí o token `--orange-hover`
    (#F59B1C, 5,36:1), separado do `--orange-deep` — que se mantém porque serve outros 20 sítios no
    papel de tinta, onde clarear é que pioraria (3,46:1 → 2,19:1 como texto sobre branco).
  - **Antes de mudar o valor de um token, contar em que papéis ele é usado.** Um token com nome de
    superfície pode estar a servir de tinta noutro sítio; nesse caso a correcção é um token novo,
    não um valor novo.
- **O fundo global do admin e a colisão `--panel`/`--surface` estão resolvidos** (lote 21B), mas as
  duas lições ficam. O fundo era `bg-[#EEF2F5]` fixo em `AdminDashboard.jsx`, hoje `--surface-dim`;
  o `--panel` valia o mesmo que o `--surface` no `.dark` e hoje é `#131d28`. O que interessa reter:
  - **Dois erros podem cancelar-se e parecer que está tudo bem.** Havia 66 `color: FT.slateDim/
    inkSoft/ink` inline que não invertiam, e um fundo global que também não invertia. Cada um
    isolado dava mau contraste; juntos davam bom. Corrigir só o fundo teria exposto os 66 de uma
    vez. Por isso os dois foram no mesmo lote. Antes de corrigir um token de fundo, verificar
    sempre o que assenta nele.
  - **Texto que assenta DIRECTAMENTE no fundo global precisa de `--ink-soft`, não `--slate-dim`.**
    Sobre `--surface-dim` o slate-dim dá 4,36:1 e falha; o ink-soft dá 5,52:1 no claro e 6,12:1 no
    escuro. Já apanhou o botão "Scanner" e o "Mostrar inativos". O `--slate-dim` continua certo
    dentro de painéis brancos (5,10:1).
  - **Medir contraste durante uma transição CSS dá o valor errado.** Elementos com `transition-*`
    devolvem a cor a meio da interpolação, e `getComputedStyle` lê-a sem avisar — deu duas leituras
    falsas seguidas (o hover do botão laranja e o Scanner "por resolver" quando já estava). Injectar
    `*{transition:none!important}` antes de qualquer varrimento.
- **O conversor tem de tratar o `/NN` que fica órfão.** Um `bg-slate-50/60` convertido pela regex de
  cor deixa `bg-[var(--surface)]/60`, que é precisamente o `color-mix` proibido. Aconteceu nos dois
  lotes do `team` (4 casos + 8 casos) porque a regex substitui a cor e não olha para o que vem a
  seguir. Correr sempre o script depois de converter — é ele que os apanha — e limpar a opacidade:
  o `--surface` já é por construção subtil, não precisa de a diluir.
- **O varredor de contraste tem de entender `oklab()`/`oklch()`.** O Tailwind v4 serve as paletas
  nesses espaços, e um parser que faça `match(/[\d.]+/g)` lê o `0.973` de
  `oklab(0.973 … / 0.6)` como se fosse um canal 0-255 — trata um branco quase puro como preto. Isso
  produziu 11 falsos positivos a 1,12:1 no WorkerForm, todos em texto que na realidade estava a
  ~5:1 sobre `bg-white`. Converter oklab→sRGB antes de medir (a fórmula está no histórico do lote
  21C), e validar o parser contra um caso conhecido antes de confiar no resultado.
  **É a terceira vez nesta migração que o instrumento engana, não o código:** a transição CSS a
  meio, o `grep` de linha única, e agora o parser de cor. Sempre que um varrimento acusar um número
  invulgarmente alto ou invulgarmente baixo, validar o instrumento antes de agir sobre o resultado.
- **Distinguir a origem da cor é o que torna o varrimento accionável.** No fim de um lote interessa
  saber quantos dos casos são *do lote*, e para isso classifica-se a cor computada: se é um dos
  tokens no valor do modo activo, é meu; se é `#94A3B8` ou `#F1F5F9`, veio da regra-ponte do
  `App.css` e o elemento ainda está por converter; se está em `oklab`/`oklch`, é Tailwind puro.
  No sub-lote B isso deu `meusTokens: []` nos dois modos — prova de que os 14 casos restantes no
  ecrã eram todos anteriores.
- **34 botões laranja com texto branco (2,52:1) que o script dava como zero.** A verificação
  procurava `text-white` e a cor laranja na MESMA linha; o padrão real é `className="… text-white"`
  numa linha e `style={{ backgroundColor: FT.orange }}` na seguinte. Corrigido para janela de 3
  linhas — passou de 0 para 34 sem nada ter mudado no código. Vale como regra geral: **quando uma
  verificação dá zero num defeito que já apareceu antes, desconfiar do instrumento antes de assumir
  que está limpo.** Os 34 ficam por tratar, em lote próprio.
  **Mas a janela de 3 linhas troca falsos negativos por falsos positivos:** ela vê o `text-white` e
  um `FT.orange` por perto, e assume que um é fundo do outro. Nem sempre é — em
  `FinancialReportOverlay.jsx:115` o `text-white` assenta em `bg-slate-900` (hoje `--navy-solid`) e
  dá 11,74:1, com o laranja a pertencer a um elemento vizinho. **O lote dos 34 precisa de
  confirmação caso a caso do fundo real, não de conversão em massa** — o script lista candidatos,
  não confirmações. Medir o fundo computado de cada um no browser antes de lhe tocar.
  **Resolvido, e o número era falso.** Dos 34 candidatos, **7 eram reais**; 23 tinham `text-white`
  no `className` mas `color: FT.navy` no `style` inline — que vence o className, logo já estavam
  correctos a 4,66:1 — e 4 tinham por perto um laranja que não era o fundo daquele elemento. Os 7
  foram corrigidos para `--navy-solid`, os 23 `text-white` mortos foram removidos, e a verificação
  passou a v3: reconstrói a tag inteira e só conta quando o fundo laranja está na MESMA tag e não
  há `color:` inline a sobrepor-se. **A regra que fica: uma classe pode estar presente e não ter
  efeito.** Procurar classes no código diz o que está escrito, não o que se vê — e num ficheiro que
  mistura `className` com `style` inline, a segunda ganha sempre.
- **Um teste escrito a partir da mesma premissa do código que testa herda-lhe o ponto cego.** O
  conversor não conhecia a propriedade `placeholder` (o Tailwind antigo escreve
  `placeholder-slate-400`, com hífen, não `placeholder:text-slate-400`) e deixou uma classe por
  converter em silêncio. O teste de cobertura **não podia** tê-lo apanhado: procurava as variantes
  com a mesma lista `bg|text|border|divide|ring` que o conversor usava. Não era uma segunda opinião,
  era a mesma opinião escrita duas vezes.
  **Regra: um teste de cobertura deriva a lista de uma fonte independente do código que verifica.**
  Aqui isso resolveu-se com uma linha — em vez de repetir a lista de propriedades, o teste passou a
  capturar qualquer prefixo (`([a-z][a-z-]*)-slate-(\d{2,3})`) directamente do código-fonte, que é a
  realidade que interessa. À primeira execução acusou logo `accent-slate-700`, um checkbox nativo no
  RecibosCalculadora que nenhuma das duas listas continha. É a mesma família do detector de
  laranja+branco: instrumento e verificação a espelhar o mesmo ponto cego.
- **`constants/rhCategories.js:139`** — a entrada `amberCustom` usa `text-[#854F0B]` sobre
  `bg-[rgba(235,141,0,0.15)]`: 1,73:1 no modo escuro, porque nenhum dos dois hex inverte. É um mapa
  de cor-à-escolha (categorias de documentos), por isso não se converte às cegas — fica com as
  outras pendências de cor-como-dado.
- **O varrimento "regressões globais" do script não é global — olha só para `src/features/admin` e
  `src/components/admin`.** Está a zero ali, mas há 6 botões laranja com texto branco (2,52:1) fora
  desse alcance, em `components/common/EntryForm.jsx`, `components/common/WorkerDocuments.jsx`,
  `worker-dashboard/GeoSuggestionCard.jsx` (2), `worker-dashboard/WorkerCalendar.jsx` e
  `worker-dashboard/WorkerScheduleTab.jsx`. Ficaram de fora do lote do `--orange-hover` de propósito:
  têm o defeito ao contrário — com texto branco, escurecer é que ajuda, e clarear o hover pioraria.
  Tratar quando a migração chegar ao dashboard do trabalhador.
- **Navegar por URL, não por cliques.** O admin usa react-router e `setActiveTab` é literalmente
  `navigate('/admin/' + tab)`, por isso `http://localhost:4179/admin/<seccao>` abre qualquer ecrã
  directamente. Clicar na barra lateral com refs do browser é frágil: os refs desalinham quando os
  toasts de notificação entram e saem, e isso já travou dois checkpoints (o gate do
  FaturarClienteModal e o do ScheduleForm). Ids das secções em `adminNavConfig.js` — os principais:
  `overview team clients fornecedores schedules documentos faturacao reconciliacao pagamentos
  reports costs ajudas-custo recibos mapa-salarios toconline formacao alertas settings`, e há
  sub-rotas como `/admin/pagamentos/fila` ou `/admin/toconline/toc-relatorios`.
- Antes de apagar qualquer ficheiro suspeito de código morto: confirmar por três vias — grep de
  imports em todo o `src/`, quem consome os subcomponentes, e presença de strings únicas no `dist/`
  do build. Ver histórico do git para saber se foi desligado por decisão consciente antes de propor
  apagar.
  **A sonda tem de ser uma string genuinamente única.** Ao verificar o `AdminTopbar`, a primeira
  tentativa usou `"Administração"` e deu *presente* no bundle — é palavra comum, reutilizada noutros
  componentes, e teria levado à conclusão errada de que o ficheiro estava vivo. Com `"Voltar à
  equipa"`, que só existe nesse ficheiro, deu *ausente* e confirmou o diagnóstico. Escolher sempre
  uma frase que não possa aparecer noutro sítio, e confirmar isso com um grep ao `src/` antes de a
  usar como prova.
  **E confirmar a sonda com um controlo positivo.** Ausência no bundle só prova morte se o método
  souber detectar vida. Ao verificar o `ReconciliacaoSalarialAdmin`, as duas sondas únicas davam
  `dist=0` — mas isso, sozinho, também seria o resultado se o `dist/` estivesse desactualizado ou o
  grep estivesse a falhar por encoding. Correr a mesma busca com uma string de um ficheiro que se
  sabe estar vivo (ali foi `"Reconciliação Bancária"`, `dist=1`) mostra que o método distingue os
  dois casos. Sem esse contraste, um `dist=0` não vale como prova.
  A armadilha da sonda não-única repetiu-se nesse mesmo ficheiro: `reconciliacao_salarial_` aparecia
  no bundle, mas existe em **dois** ficheiros do `src` e o que lá estava era o `SalariosTab`, vivo.
  Contar em quantos ficheiros do `src` a sonda existe **antes** de a usar, não depois.
- Ordem de lotes: do módulo mais pequeno para o maior, um commit por módulo, checkpoint no browser
  antes de avançar para o seguinte.

### Decisões já tomadas (não reabrir sem motivo novo)

- O `SCALE`/`FT` em `designTokens.js` é a fonte de verdade; a app converge para ele, não o inverso.
- Canal de `style` inline (`color: FT.slate/FT.navy` em JS) é tratado numa passagem própria, separada
  dos lotes de classe — fica facilmente esquecido dentro de lotes normais.
- `reconciliacao-mockup.css` mantém identidade visual própria (`.recon-scope`); não converge para os
  tokens FT até decisão explícita em contrário.
  
  ### Estado da migração (atualizar a cada lote)

Total: 4.197 classes Tailwind → tokens `FT`. **Restam 269 em `src/features/admin` +
`src/components/admin`, mas só 197 são trabalho** — e são exactamente o último ficheiro de
dinheiro, isolado de propósito para o fim: `RecibosCalculadora` (197).
Todo o resto do admin está convertido. Dois ficheiros que estavam nesta lista foram apagados em vez
de convertidos, por serem código morto: o `EntradasTab` (55), que nunca chegou a ser importado desde
que nasceu em 2026-05-24, e o `ReconciliacaoSalarialAdmin` (56), desligado por decisão explícita no
commit `a56e8b9` quando a análise salarial foi fundida na Reconciliação.

As outras 72 estão fora do âmbito, cada uma com razão registada:

| onde | n | porquê |
|---|--:|---|
| `team/SSComunicacaoModal.jsx` | 29 | excluído por decisão (comunica à Segurança Social) |
| `ReconciliacaoAdmin.jsx` | 18 | o `.recon-scope` envolve todo o render (abre na linha 343) |
| `reconciliacao/` (3 ficheiros) | 17 | colidem com o `.recon-scope` |
| `TagBadge.jsx` | 4 | mapa de cor-à-escolha: a cor é dado, não estado |
| `adminOverview/KpiCard.jsx` | 2 | `/20` sobre classe Tailwind — legítimo, convertê-lo dá color-mix |
| `AdminSidebar.jsx` | 1 | backdrop `/50`, mesma razão |
| `ModoLote.jsx` | 1 | não é classe: é `// slate-800` a comentar um `setTextColor` do jsPDF |

Estão fechados **três** canais de `style` inline: `FT.slate`, `FT.navy` e o terceiro
(`FT.slateDim`/`inkSoft`/`ink`, 42 dos 49 do admin; 7 ficam por estarem em `.recon-scope`).

Para medir o que falta em qualquer momento, sem contar à mão:
`sh scripts/verificar-lote-design.sh src/features/admin src/components/admin`

| Módulo / lote            | Classes      | Estado                          | Commit     |
|---------------------------|:------------:|----------------------------------|:----------:|
| Botão primário (indigo→laranja) | 30 botões / 25 ficheiros | ✅ feito | `f1b13d5` |
| `fornecedores`            | 63           | ✅ feito                         | `3e5cfdf`  |
| `client`                  | 90           | ✅ feito (+7 botões laranja/branco bónus) | `e043e04` / `8591c7b` |
| `salarios`                | 61           | ✅ feito                         | `2c410f6`  |
| `SalariosTab.jsx`         | 57           | ✅ feito (lote próprio, dinheiro) | —          |
| `corrections`             | 99           | ✅ feito                         | `a53b10f`  |
| Canal inline (`color: FT.slate`) | 100 ocorrências / 42 ficheiros | ✅ fechado | — |
| Modo escuro — correção de raiz | 23 regras `.dark` → tokens | ✅ feito | `4a4db23` |
| Fix `color-mix` + scrollbar indigo | — | ✅ feito | `c5faeec` |
| `reconciliacao`           | 156 (132 convertidas, 24 bordas fora — `.recon-scope`) | ✅ feito | `c1d075e` |
| `movimentacoes`           | 152          | ❌ código morto — **apagado** (2.915 linhas), não conta | `79eefa3` |
| `documents`               | 155          | ✅ feito                         | `885da84`  |
| `pagamentos`              | 115          | ✅ feito                         | `48a1620`  |
| Canal inline (`color: FT.navy`) | 108 (72 convertidos, 36 sobre laranja ficam) | ✅ fechado | `de236ab` |
| `faturas`                 | 125          | ✅ feito                         | `74e4d8a`  |
| `cost-reports` (8 de 9 ficheiros) | 180  | ✅ feito                         | `e039edc`  |
| `cost-reports/AjudasCalculadora.jsx` | 104 | ✅ feito — lote próprio, dinheiro | `f336916` |
| `toconline`                | 355          | ✅ feito (lotes 12 e 13)          | `6f0ab78` / `c8cb698` |
| `team`                     | 463 (434 + 29 fora) | ✅ feito em 2 lotes            | `4f4cb1b` / — |
| raiz de `features/admin`   | 1.028        | ✅ feito, menos os 4 de dinheiro  | `48af8a1` … `936f8f8` |
| `components/admin`         | 117          | ✅ feito                         | `48af8a1` / `5eccd92` |

**Ambos os canais de `style` inline estão fechados.** Critério, que difere entre eles: no `FT.slate`
a pergunta foi *ícone ou texto?* (o slate serve os dois modos, só o contraste variava); no `FT.navy`
a pergunta foi *o fundo por baixo inverte?* — o navy é escuro e fica ilegível sobre fundo escuro seja
ícone ou texto. Os 36 casos sobre `backgroundColor: FT.orange` mantêm `FT.navy` de propósito: o
laranja também é constante JS, não inverte, e o par é estável.
Nota técnica que tornou isto barato: **`var()` dentro de `style` inline segue o `.dark`** — não é
preciso mover nada para `className`, basta trocar `FT.navy` por `'var(--navy)'` no mesmo sítio.

**Pendências registadas, sem decisão de convergência.** Todas dependem da mesma decisão — se e
quando o `reconciliacao-mockup.css` converge para os tokens FT. Ficam aqui com a localização exacta
para quem um dia a tomar não ter de as redescobrir:

- **`reconciliacao-mockup.css` não converge.** Redefine `--navy`, `--bg`, `--border` e `--text`
  dentro de `.recon-scope`, e a definição mais próxima vence, por isso nem o bloco `.dark` do
  `index.css` lhes chega.
- **24 bordas em `reconciliacao`** por converter: `border-slate-200/300` iria para `--border`, a
  única variável cujo valor local (#E3E7EC) difere do global (#e5e1d6).
- **Modo escuro dentro de `.recon-scope` fica claro** — mesma causa. Medido: com o dark ligado,
  `--bg` resolve para #F5F7FA e `--navy` para #1B3A57 dentro do escopo. Afecta Reconciliação,
  Custos e o painel de Salários.
- **13 `color: 'var(--navy)'` presos ao valor local**, todos em faixas de estatísticas dentro de
  blocos `.recon-scope` do `cost-reports`: `ClientesTab` 99/103/107, `DespesasTab` 78/82,
  `EquipaTab` 16/21/25, `FaturasTab` 140, `MargemTab` 37. Vieram da passagem do canal inline do
  navy (`de236ab`) e ali a conversão **não teve efeito** — o `var(--navy)` resolve para o #1B3A57
  fixo do mockup, não para o global que clareia. Não é regressão nem bug: o mockup fixa fundo *e*
  texto, e a faixa dá 11,74:1 nos dois modos. É só a mesma ilha clara das outras pendências.
- **O par chip: `--slate-dim` sobre `--surface-dim` dá 4,36:1 e falha AA.** São **60 elementos em 35
  ficheiros** — chips de estado, tabs inactivas, botões secundários. **Não é regressão da migração**:
  o original `bg-slate-100 text-slate-500` já dava 4,34:1, e onde era `text-slate-400` dava 2,34:1,
  por isso a conversão manteve ou melhorou. Mas ficou uniforme, e por isso corrigível de uma vez:
  `--ink-soft` sobre `--surface-dim` dá 5,52:1 no claro e 6,12:1 no escuro.
  **Lote próprio, e só depois do `RecibosCalculadora`** — decisão do Diego: não abrir uma frente
  espalhada por 35 ficheiros enquanto o último ficheiro grande ainda está em curso. É o mesmo
  calibre do `--orange-hover`: muda o aspecto de todos os chips do admin.
  Os varrimentos por lote não o apanharam porque nunca estiveram os 60 visíveis no mesmo ecrã; só
  apareceu ao procurar o padrão no código, não no que estava renderizado.
- **Família por tratar: o `--slate` a colorir texto.** O `--slate` foi reservado para ícone e
  decorativo, onde os seus 2,89:1 sobre branco chegam. Mas acabou também em texto, e aí falha. O
  varrimento de 16 rotas encontrou ~70 travessões no `faturacao`, 14 números de dia no
  `mapa-salarios`, ~70 cabeçalhos de dia no `schedules` (esses já em `--slate-dim`, 4,45 no claro e
  3,79 no escuro) e 2 chips no `pagamentos`. **Decisões de princípio já tomadas pelo Diego**, a
  confirmar com levantamento normal quando o lote chegar:
  - **travessão `—` de valor ausente → fica `--slate`.** É sinal deliberado de "nada aqui", não
    informação a processar. Mesmo critério dos `—` de contacto ausente no lote de fornecedores.
  - **números de dia do `mapa-salarios` → `--slate-dim`.** São dados: o utilizador lê o número para
    saber a que dia corresponde o valor.
  - **cabeçalhos `2ª`/`3ª`/`Sáb` do `schedules` → `--slate-dim`.** Mesma lógica dos `<th>` e labels
    já classificados como funcionais.
  - **chips do `pagamentos` com fundo no pai → verificar o par completo** (repouso *e* hover) antes
    de escolher o destino, como no lote do par chip.
- **`bg-emerald-600` com `text-white` dá 3,77:1** (`corrections/ItemRow.jsx:103`, o botão "aceitar"). O
  irmão `bg-rose-600` passa (4,70:1). Cor semântica, fora dos lotes de neutros.
- **A regra-ponte não alcança as variantes com opacidade — e corrigir só isso PIORA.** `.dark
  .bg-amber-50` apanha `bg-amber-50` mas não `bg-amber-50/50`, que o Tailwind compila para outra
  classe. São 24 casos. Mas a experiência de alargar a ponte com um selector de atributo
  (`.dark [class*="bg-amber-50/"]`) mostrou que a correção isolada é **uma regressão**: a regra
  original não muda só o fundo, muda também o `color` do elemento, e os filhos herdam-no. Um
  `text-amber-700` dentro da caixa tem cor própria e não herda — hoje fica escuro sobre fundo creme
  claro (4,93:1, passa); com o fundo invertido e o texto na mesma, fica escuro sobre escuro
  (3,03:1). Com os dois invertidos daria 9,11:1.
  **A causa raiz é maior do que os 24 fundos: a ponte cobre fundos de estado e não cobre texto de
  estado — são 1.025 ocorrências de `text-{amber,emerald,rose,red,indigo,…}-{600,700,800}` sem
  regra nenhuma no `.dark`.** Tratar metade do par piora; tratar as duas metades é um lote grande e
  precisa de medir onde é que esses textos assentam em fundos que não invertem. Fica por decidir.

**Cor de marca fora do alcance dos tokens.** Categoria à parte das anteriores: aqui o problema não é
uma variável que colide, é cor que os tokens não conseguem alcançar de todo. Não se resolve com mais
lotes de conversão.

- **`#1B3A57` literal: 31 ficheiros, 115 ocorrências** (a nota anterior dizia 87 ficheiros — estava
  desactualizada, a fase 5 reduziu-a). **105 dessas são `/NN`** (`ring-[#1B3A57]/30`,
  `bg-[#1B3A57]/5`…) e ficam de propósito: o modificador de opacidade sobre `var()` compila para
  `color-mix`, cujo fallback é a cor a 100%. As 10 restantes são legítimas ou já conhecidas —
  `designTokens.js:7` e `reconciliacao-mockup.css:13` são as *definições*, e 4 estão no
  `SSComunicacaoModal`, que está fora da migração por decisão registada.
- **O export de ajudas de custo usa paleta própria.** `AjudasCalculadora.jsx:580` gera um `.xls` a
  partir de uma string HTML com CSS embutido, e o cabeçalho e faixas são `#4F46E5` (o indigo do
  `create-vite`) e `#7C3AED`. O ficheiro que o cliente recebe não se parece com a Magnetic Place.
  Está fora do alcance dos tokens por ser string, não classe — e mudá-lo é decisão de marca sobre
  material que sai da empresa, não housekeeping de UI.
- `pill de estado` no modal de cliente (`clients.status`: pendente/enviado) e `Badge.jsx` — decisão
  de design ainda por tomar.