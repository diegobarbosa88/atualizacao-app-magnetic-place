# APP MAGNETIC PRODUÇÃO

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

### Antes de cada lote

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
- **Contraste depende do fundo, não só da cor do texto.** Medir sempre in-place; um chip sobre
  `--surface-dim` pode precisar de `--ink-soft` mesmo com a mesma cor de texto que passa noutro sítio.
- **Regra de fundo escuro:** sobre fundo claro o texto desce na escala de tinta (mais escuro); sobre
  fundo escuro sobe (mais claro). Não aplicar a mesma direção às cegas — foi o erro que escureceu
  "Unipessoal, Lda" no topbar navy.
- **Tinta não serve de fundo.** Os tokens de tinta — `--ink`, `--ink-mid`, `--ink-soft`, `--navy`,
  `--slate`, `--slate-dim` — invertem no modo escuro, porque é isso que se espera de texto. Usá-los
  como superfície (`bg-`, `backgroundColor`) faz o fundo clarear no escuro enquanto o texto por cima
  fica igual. Para fundo, usar sempre as variantes que **não** invertem: `--navy-solid` (o navy da
  marca) e `--navy-deep` (para o hover).
  A verificar em cada lote — `verificar-lote-design.sh` conta os casos, mas convém saber porquê:
  esta família de erro já apareceu três vezes e parece inofensiva de cada vez.
  - `bg-[var(--navy)]` na barra do trabalhador e nos 30 botões `bg-[var(--orange)]
    text-[var(--navy)]` → resolvido com `--navy-solid`;
  - `bg-[var(--ink)]` no botão "gerar relatório" (documents) → 16,9:1 no claro, **1,2:1 no escuro**;
  - `bg-[var(--ink-mid)]` no botão "marcar resolvido" (corrections), introduzido por um lote anterior
    e só apanhado dois lotes depois, porque a verificação de então corria só em modo claro.
- Nunca `/NN` (opacidade) sobre `var(--token)` — compila para `color-mix` com fallback a 100%,
  visualmente diferente do esperado. Criar variável dedicada com o alpha embutido (ex.
  `--orange-shadow`) em vez disso.
- `sed` como correções de contraste pode comer terminações de linha (CRLF→LF). Verificar sempre com
  `git diff` antes de commitar.

### Depois

- Varrimento de contraste no ecrã real, **nos dois modos (claro e escuro)**, não só claro — o modo
  escuro pode ficar diferente do esperado se houver regras `.dark` legadas com `!important` presas a
  classes em vez de tokens.
- Antes de apagar qualquer ficheiro suspeito de código morto: confirmar por três vias — grep de
  imports em todo o `src/`, quem consome os subcomponentes, e presença de strings únicas no `dist/`
  do build. Ver histórico do git para saber se foi desligado por decisão consciente antes de propor
  apagar.
- Ordem de lotes: do módulo mais pequeno para o maior, um commit por módulo, checkpoint no browser
  antes de avançar para o seguinte.

### Decisões já tomadas (não reabrir sem motivo novo)

- O `SCALE`/`FT` em `designTokens.js` é a fonte de verdade; a app converge para ele, não o inverso.
- Canal de `style` inline (`color: FT.slate/FT.navy` em JS) é tratado numa passagem própria, separada
  dos lotes de classe — fica facilmente esquecido dentro de lotes normais.
- `reconciliacao-mockup.css` mantém identidade visual própria (`.recon-scope`); não converge para os
  tokens FT até decisão explícita em contrário.
  
  ### Estado da migração (atualizar a cada lote)

Total: 4.197 classes Tailwind → tokens `FT`. Última contagem: **445 de 4.197 (6 módulos), mais o
canal `style` inline fechado.**

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
| `movimentacoes`           | 152          | ❌ código morto — a apagar, não conta para o total | — |
| `documents`               | 155          | ⏳ próximo                       | —          |
| `toconline`                | 355          | não iniciado                     | —          |
| `team`                     | 463          | não iniciado                     | —          |
| *(restantes módulos ainda não medidos individualmente)* | — | não iniciado | — |

**Canal `style` inline do navy (`color: FT.navy`, 126 usos)** — pendente, passagem própria ainda
por agendar (mesma lógica do `FT.slate`: separar ícone/texto, medir contraste fundo-a-fundo).

**Pendências registadas, sem decisão de convergência:**
- `reconciliacao-mockup.css` (`--navy`/`--bg`/`--border` locais) não converge para os tokens FT;
  24 bordas em `reconciliacao` ficam presas a isso.
- Modo escuro dentro de `.recon-scope` fica parcialmente claro — mesma causa acima.
- Colisão de `#1B3A57` ainda hardcoded em 87 ficheiros, contra 29 usos do token — resolver por
  código, não à mão.
- `pill de estado` no modal de cliente (`clients.status`: pendente/enviado) e `Badge.jsx` — decisão
  de design ainda por tomar.