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

> Há suite de testes (ver "Testes" abaixo): unit/integração em Vitest (~40 ficheiros) e e2e em
> Playwright (~69 specs). Cobrem lógica de cálculo, APIs e fluxos — **não** regressões visuais nem
> contraste de cor. Por isso o ponto 4 continua a traduzir-se, para trabalho de UI, em critérios
> verificáveis no browser e nos artefactos gerados; para lógica pura, escrever/correr testes é a
> verificação preferida.

Gestão de RH e operações da Magnetic Place Unipessoal, Lda (cedência de mão-de-obra, sede na Trofa,
trabalhadores destacados em clientes industriais em PT e ES). ~28 trabalhadores, ~13 clientes.

**Stack:** React 19 + Vite 6 + Tailwind CSS v4 + Supabase (Postgres, Storage, Auth). PWA com service
worker. Deploy Vercel **automático em cada `git push`** — nunca fazer push sem confirmação explícita
do Diego, porque dispara deploy para produção.

**Domínios:** turnos e horários, registo/validação/aprovação mensal de horas, documentos com
assinatura digital (PDF assinado + carimbo), processamento salarial (recibos, mapas de ajudas de
custo), faturação com TOConline, reconciliação bancária (SaltEdge/Tink), Segurança Social (escritas
REST+SOAP: admissões, cessações, alteração de contrato, documentos de pagamento; e várias consultas
de leitura). Três interfaces: painel admin, dashboard do trabalhador, portal do cliente.

**Repo irmão:** `C:\Users\diego\CONSELHEIRO-ESTRATEGICO` — agente WhatsApp "Trabalhador Virtual",
precisa de `vercel deploy --prod` manual (deploy separado, não automático).

**Projeto não confundir:** o **site institucional** `magneticplace.pt` (HTML/CSS/JS puro, sem build,
sem repo Git, deploy direto para o projeto Vercel `magnetic-place-legal`) é um projeto **separado**
deste. Este repo é o `app-magnetic` (GitHub `diegobarbosa88/atualizacao-app-magnetic-place`). Não
misturar contexto, tokens de cor ("blueprint" escuro do site ≠ navy/laranja da app) nem deploys.

## Testes

Há suite real, com dois motores. **Não** cobre regressões visuais/contraste (isso é sempre no
browser ao vivo), mas cobre lógica de cálculo, APIs e fluxos.

- **Vitest** (unit + integração, jsdom + React Testing Library): `npm test` (watch),
  `npm run test:unit` (`tests/unit`, ~40 ficheiros — cálculos de recibos/IRS/ajudas, matching de
  reconciliação, reports precision/quick, feriados, etc.), `npm run test:unit:app` (`tests/unit/app`).
  Config em `vitest.config.js`, setup em `tests/setup.js`, mocks de rede com MSW.
- **Playwright** (e2e, ~69 specs em `tests/e2e/`): `npm run test:e2e`, UI em `npm run test:e2e:ui`.
  Config em `playwright.config.js`; helpers de auth em `tests/e2e/helpers/`. Cobre login, painel
  admin, correções, documentos, equipa, portal do cliente, SS comunicações, worker.
- Relatório de referência: `tests/TEST_REPORT.md`. Ao mexer em lógica pura (utils, engines,
  cálculos), escrever/correr o teste é a verificação preferida — não só o build.

## Armadilhas conhecidas

- **Referência central — quais fundos `bg-*` invertem em dark mode (2026-08-24).** A classe
  Tailwind `bg-white` INVERTE em dark mode, mas só ela e mais 5 classes: uma regra-ponte global em
  `App.css:46-93` a intercepta. Lista completa, confirmada por grep, é fechada: `.dark .bg-white`
  (→ `#1e293b`), `.dark .bg-slate-50`/`.bg-slate-100` (→ `#0f172a`), `.dark .bg-emerald-50`/
  `.bg-rose-50`/`.bg-amber-50` (→ `rgba(.../0.1)`). **Nenhuma outra classe `bg-*` inverte
  sozinha** — nem `bg-orange-100`, nem `bg-emerald-100`, nem nenhum valor arbitrário
  (`bg-[#FDF8F0]`) nem `background:'#fff'` inline (inline nunca inverte, seja qual for o valor,
  porque a regra-ponte é um selector de classe CSS, não afecta `style`).
  **Regra prática, a aplicar sempre antes de decidir se um fundo "fixo" precisa de texto estático
  ou se um fundo "que segue o tema" aceita `var(...)`:** primeiro identificar qual das duas
  mecânicas está em jogo — `className="bg-white"` (verificar contra a lista acima) vs.
  `style={{background:'#fff'}}` inline — e só depois medir. **Medir sempre com
  `document.documentElement.classList.add('dark')` numa página ACABADA DE RECARREGAR, nunca a meio
  de uma sessão de HMR**: uma medição feita a meio de edições ao vivo já deu duas leituras erradas
  nesta sessão (fundo "branco" que na verdade tinha acabado de inverter, mas o browser ainda não
  tinha repintado no momento exacto da leitura).
  Ferramenta de medição também corrigida: `el.closest('[style*="background"]')` para achar o fundo
  efectivo de um texto é enganador — encontra o primeiro ANCESTRAL com a palavra "background" no
  atributo `style`, que pode não ser o mais próximo nem o que está realmente pintado por cima
  (dois falsos positivos de 1,5:1 apareceram assim, quando o valor real era 8,96:1). Correcto é
  percorrer a cadeia de `parentElement` medindo `getComputedStyle(el).backgroundColor` até
  encontrar o primeiro que não seja `rgba(0,0,0,0)`.
  **Esta descoberta corrigiu uma cadeia de suposições erradas feitas ao vivo, todas nesta mesma
  sessão, ao medir a meio de edições/HMR:**
  - **`WorkerList.jsx`**: o cartão (`Card variant="item"`, usa a classe `bg-white`) afinal
    INVERTE — a nota anterior ("cartão fixo, sem par dark mode") estava errada. Sem consequência
    prática aí porque o badge é autocontido (fundo próprio, não herda do cartão) — comentário no
    código corrigido, nenhuma cor mudou.
  - **`WorkerValidationPanel.jsx`**: a tabela/os cartões (classe `bg-white`) também invertem — 4
    usos de `FT.navy` estático ficavam ilegíveis (1,25:1) em escuro. Corrigidos para `var(--navy)`.
  - **`AbsenceRequestsPanel.jsx`**: mistura as duas mecânicas no mesmo ficheiro — o
    `PendingWorkerCard` exterior usa `background:'#fff'` INLINE (não inverte, a nota original
    estava certa aí) mas o `AvisoRow` aninhado tem o seu próprio `bg-white` de CLASSE (inverte). O
    nome do trabalhador (fundo fixo, token que invertia) e o `chipColor`/ícone de motivo (fundo que
    afinal inverte, token estático) estavam ambos errados, em direcções opostas. Ambos corrigidos.
  - **`CorrectionsInbox.jsx`** (spec nova, ver secção "Correções" abaixo): a pílula activa das 4
    tabs de filtro usa `bg-white` de classe — a primeira implementação usou cor estática por
    assumir (sem medir) que não invertia; corrigida para `var(--tone-*)` antes de chegar a commit.

- **`FT.orangeDeep` (`#C97600`) sobre `FT.warnBg` (`#FBF0DE`) como par texto+fundo dá só 3,07:1 —
  falha AA (mínimo 4,5:1) — apesar de nunca ter sido medido antes de aparecer nesta combinação
  numa spec (badge condicional do cartão de colaborador, `WorkerList.jsx`, 2026-08-24).** O par só
  existia até agora em contextos que mascaravam o problema — `WorkerProfile.jsx:191` usa-o num
  `onMouseEnter` (hover, transitório, menos crítico), e a maioria dos outros usos de
  `FT.orangeDeep` no projeto não está pareada com `FT.warnBg`, está sobre fundo branco/neutro
  ambiente (contraste diferente, não verificado aqui). **Confirmados dois casos reais do mesmo par
  quebrado, fora de hover:** `WorkerProfile.jsx:129-130` — não é o mesmo elemento (129 é
  `orangeDeep` isolado, 130 é um span à parte com `FT.warn`/`FT.warnBg`, esse ainda pior, 2,44:1) —
  e **`GeoSuggestionCard.jsx:58+61`**, esse sim o par exato (`background: FT.warnBg` no `<div>`,
  `color: FT.orangeDeep` no `<p>` lá dentro), **sempre visível quando a condição dispara** (aviso de
  registo sem saída no dashboard do trabalhador), não hover.
  **`GeoSuggestionCard.jsx` corrigido em 2026-08-31** — `#8a4a00` em vez de `FT.orangeDeep`,
  6,08:1 contra `FT.warnBg` (calculado, não medido ao vivo: o dashboard do trabalhador continua
  atrás do bloqueio de sessão 403 já registado — `npx eslint`/`npx vite build` limpos, mas sem
  confirmação visual). `WorkerProfile.jsx:129-130` continua por corrigir, fora do âmbito.
  **`ItemRow.jsx` (corrections) — achado ao reabrir esta pendência: já não é `bg-emerald-600`,
  alguém já o tinha corrigido para `bg-emerald-700` (5,48:1, passa AA) nalgum lote posterior sem
  a nota aqui ter sido actualizada.** Pendência fechada, nada para implementar.
  Correção aplicada só no sítio novo (`WorkerList.jsx`, `vinculoBadge`): `#8a4a00` em vez de
  `FT.orangeDeep` — 6,08:1, mais escuro só o suficiente para passar AA com folga, mesma família
  visual (mesma lógica já usada para o `--orange-hover`: valor mínimo suficiente, não o mais
  extremo). Cores fixas de propósito nesse badge, não `var(--...)`, porque o cartão onde vive usa
  `bg-white` fixo, sem seguir `.dark` — **esta é a segunda pendência a lembrar junto**: quando esse
  cartão for convertido para seguir o tema, o verde do badge pode reverter para
  `var(--ok)`/`var(--ok-bg)`/`var(--ok-border)` sem mais nada (esse par já mede bem nos dois modos),
  mas o laranja precisa de um par novo medido para escuro — não reverter para
  `var(--orange-deep)`/`var(--warn-bg)`, é exactamente o par que falha.
  **Fundo tingido de "item mais urgente" — precedente fixado em `AbsenceRequestsPanel.jsx`
  (2026-08-24), não no cartão de colaborador.** Quando a spec do cartão propôs este padrão
  (Mudança 1), ficou deliberadamente por implementar — sem instância real a que comparar. A
  primeira instância real é o destaque do trabalhador com o pedido de falta mais antigo pendente:
  fundo `#FDF8F0`, barra de acento esquerda 6px `FT.orange`, só no primeiro item da lista (e só se
  tiver pendente). Texto por cima medido e confirmado com `#8a4a00` (mesmo valor do badge acima,
  não `FT.orangeDeep` — falha AA aqui também, 3,27:1 sobre este fundo tingido e 3,46:1 sobre o
  branco dos restantes itens; `#8a4a00` dá 6,49:1 e 6,86:1 respectivamente). **Se o fundo tingido do
  cartão de colaborador avançar um dia, reutilizar `#FDF8F0` + `#8a4a00` daqui — não é preciso medir
  de novo, já está resolvido para esta família de fundo/texto.**

- **Redesenho completo de `AbsenceRequestsPanel.jsx` (2026-08-24) — accordion de dois níveis
  substituído por 3 secções (Aguardando há mais tempo / Restantes pendentes / Sem pendências).**
  Achados de verificação antes de implementar, todos confirmados contra o código/dados reais, não
  assumidos: (1) o projeto usa só `lucide-react`, zero Tabler apesar de a spec pedir ícones `ti-*`
  — mapeados para equivalentes reais (`ClockAlert`, `ListChecks`, `Users`, `Palmtree`, `Thermometer`,
  `Stethoscope`, `Home`, `User`, `HelpCircle`); (2) a lista de motivos (`absence_reasons`) tem 6
  valores, não os 3 que a spec previa, e é **editável pelo admin em Definições** — nunca fechada,
  por isso `HelpCircle` serve de fallback para qualquer motivo fora do mapa, confirmado com dados
  reais (motivo "Outro" existe na BD e caiu no fallback correctamente); (3) **avatares com iniciais
  brancas — o mesmo padrão de erro pela quarta vez nesta sessão.** A spec pedia `slate` (secção 2) e
  `okBg` (secção 3) como fundo do avatar; medidos: branco/`slate` dá 2,89:1 (falha AA), branco/
  `okBg` dá **1,14:1** (falha catastrófica — `okBg` é o tom claro do verde, nunca foi pensado como
  par de texto branco). Corrigido para as 3 variantes usarem a mesma fórmula (branco sobre cor
  sólida): `navy` (11,74:1), `slateDim` (5,10:1, não `slate`), `ok` (5,05:1, não `okBg`) — todos
  `FT.*` fixos, não `var(--...)`, mesmo raciocínio do badge do cartão de colaborador. **Confirmado
  ao vivo, nos dois modos, que não há mais nenhum sítio na app com texto branco sobre `FT.okBg`** —
  todos os outros usos já emparelham `okBg` (fundo) com `ok` (texto), o par correcto; esta pendência
  fica fechada, não é uma quinta instância em aberto.
  **Confirmação de dark mode, pedida explicitamente antes de fechar:** os valores `#8a4a00`,
  `#FDF8F0`, `FT.navy`, `FT.slateDim`, `FT.ok` são todos estáticos — medidos ao vivo nos dois modos,
  dão exactamente os mesmos `rgb()` computados nos dois. Não há necessidade de par separado para
  escuro nestes tokens específicos (ao contrário de `--ok`/`--warn`/`--bad` como CSS vars, que
  invertem — aqui optou-se deliberadamente pela forma fixa `FT.*`, mesma razão documentada acima
  para o badge do cartão de colaborador: o componente não segue tema, ou o papel é fundo sólido que
  não deve inverter).
  **Correcção a um achado anterior — ver "Referência central" no topo de Armadilhas conhecidas.**
  O `PendingWorkerCard` exterior usa `background:'#fff'`/`'#FDF8F0'` INLINE (não inverte mesmo,
  confirmado), mas o `AvisoRow` aninhado lá dentro tem o SEU PRÓPRIO `bg-white` de CLASSE, que
  inverte. Nome do trabalhador (fundo fixo, `text-[var(--ink)]` invertia) media 1,21:1 em escuro —
  corrigido para `FT.ink` estático. `chipColor`/ícone de motivo (fundo que afinal inverte, valor
  estático) media 1,16:1/2,13:1 — corrigido: `chipColor` fica só para o chip de data autocontido,
  `metaTextColor` novo (`var(--tone-amber)`/`var(--ink-mid)`) para o resto. Confirmado ao vivo:
  nome 16,00/16,91:1, "solicitado há Nd" 5,03/6,85:1, motivo+cliente 10,83/8,96:1 (claro/escuro).
  `DoneWorkerCard` (secção 3) não tinha o problema — usa a classe `bg-white`, inverte, tokens já
  todos `var(--...)`.
  **Contador "N pendentes"/"N aprovados" — o par laranja está no limite.** `bg-orange-100`/
  `text-orange-700` (Tailwind) mede **4,56:1**, só 0,06 acima do mínimo AA (4,5:1) — medido via
  canvas do browser (`fillStyle`→`getImageData`), não por parsing manual de `oklch()`, que já
  enganou este mesmo tipo de medição antes nesta migração. `bg-emerald-100`/`text-emerald-700`
  (aprovados) mede 4,72:1, folga confortável. Registado, não corrigido — está tecnicamente dentro
  do AA, mas sem margem de segurança; fica para decisão se vale a pena um tom mais escuro
  (`orange-800`) só para dar folga, mesma lógica do `--orange-hover`.
  **Decisão de implementação, não pedida explicitamente na spec — regista-se por transparência:**
  o aviso mostrado sempre visível na linha principal do cartão (o mais urgente) também ficou
  clicável para revelar Notificar Cliente/Arquivar/Apagar, exactamente como os avisos dentro do
  "+N avisos". A spec só descrevia essas três acções como vivendo "dentro do +N avisos expandido,
  ao nível do aviso individual" — mas um trabalhador com um único pedido nunca teria badge "+N"
  (zero avisos extra), o que apagaria por completo o acesso a Arquivar/Apagar para o caso mais
  comum. Tratado como o mesmo mecanismo aplicado a todos os avisos, não só aos "extra" — confirmado
  ao vivo que funciona sem o badge "+N" presente.

- **Redesenho de `WorkerValidationPanel.jsx` (2026-08-24) — vista lista + vista grade, badges de
  Estado, avatares, contador de resumo.** Checklist confirmou Estado estritamente binário
  (`isApproved` booleano derivado de `approvals.find(...)`, nunca um terceiro valor) e
  `SCALE.radius.card` = `rounded-[1.2rem]` (19,2px) batendo exactamente com o valor já usado.
  **Quinta instância do par laranja quebrado, e a primeira vez que é o par `warn`/`warnBg`
  (não `orangeDeep`/`warnBg`) a aparecer numa spec nova.** Medido: `warn`/`warnBg` dá **2,44:1**
  (falha AA catastroficamente, já registado como o pior caso em `WorkerProfile.jsx:130`); `ok`/
  `okBg` (proposto para "aprovado") dá 4,42:1, abaixo do limiar de segurança já estabelecido para
  texto pequeno nesta sessão. Substituídos por `#8a4a00`/`FT.warnBg` (6,08:1, reutilizado pela
  terceira vez) para "pendente" e um par novo, `#1f6b47`/`FT.okBg` (5,66:1), para "aprovado" — mais
  escuro que `ok` (`#2E7D4F`) só o suficiente para dar folga real, mesma lógica do `--orange-hover`.
  Confirmado ao vivo nos dois modos: os quatro valores (`#8a4a00`, `#1f6b47`, `FT.warnBg`,
  `FT.okBg`) são estáticos, dão o mesmo `rgb()` computado em claro e escuro — mesma razão já
  documentada para `WorkerList.jsx`/`AbsenceRequestsPanel.jsx`: o cartão/tabela à volta não segue o
  tema, por isso o token também não precisa de inverter.
  **Correcção a um achado anterior — ver "Referência central" no topo de Armadilhas conhecidas.**
  A tabela/os cartões usam a CLASSE `bg-white` (não inline) — invertem. A medição original que deu
  "fundo continua branco" foi feita a meio de HMR; isto não era "quarta instância", era medir no
  momento errado. `FT.navy` (estático) nas horas/ícone "Ver Portal"/calendário ficava a 1,25:1 —
  corrigido para `var(--navy)` nos 4 sítios (horas e "Ver Portal" em lista+grade), confirmado
  11,74:1 claro / 5,66:1 escuro. Os 2 usos de `FT.navy` no toggle lista/grade ficam estáticos de
  propósito — usam `background:'#fff'` inline, não a classe, não invertem, par correcto.
  **Auto-correcção antes de mostrar ao Diego: `formatHours()` já devolve o formato completo
  (`"81h30"`), e a primeira escrita do ficheiro apendava um `h` a mais em 4 sítios** — vista de
  grade (`"0h00h"`), meta do modal de registos (`"81h00h total"`), e a linha de cada registo diário
  dentro do modal (`"11h00h"`). A vista de lista usava ainda uma função própria (`fmtH`, formato
  `"81H"`, sem minutos) inconsistente com o resto da app. Só apareceu ao ler o texto real renderizado
  no browser (`get_page_text`/`outerHTML`) — nem o eslint nem o `vite build` acusam duplicação de
  string. Corrigido: os 4 sítios passaram a usar só `formatHours(...)`, sem sufixo, e a vista de
  lista passou a usar `formatHours` em vez do `fmtH` próprio, para as duas vistas mostrarem o mesmo
  formato. Confirmado ao vivo depois da correcção: `"0h00"`, `"81h00"`, `"146h30"` nas duas vistas.
  Fluxo Aprovar/Anular testado ao vivo de ponta a ponta (grava e apaga um registo real em
  `approvals`) — badge muda para "aprovado", botão "Anular" aparece, e o revert devolve o estado
  exacto anterior (28 pendentes / 0 aprovados).
  **O padrão de par de estado quebrado já vai em cinco instâncias** (`slate`/`slate-dim`,
  `navy`/`navy-solid`, `orangeDeep`/`warnBg`, `okBg`+branco, agora `warn`/`warnBg`) — deixou de ser
  coincidência. Cada uma foi descoberta de forma reativa, só ao ir usar o par numa spec nova; é
  provável que existam mais instâncias já em produção, nunca medidas por não termos ido lá por
  acaso. **Quando se abrir a frente própria de "ponte de cor de estado" (já pendente, ver secção
  abaixo), começar por um varrimento sistemático de todos os pares texto+fundo que usam tokens de
  estado (`ok`/`warn`/`bad` e as suas variantes `-bg`) em toda a app — não só corrigir os que forem
  aparecendo por acaso.**

- **A investigar formalmente — `403 Sem permissão para executar esta ação` apareceu três vezes na
  mesma sessão admin, em três features sem relação entre si.** Ordem de aparição: impersonação de
  trabalhador ("Ver Portal" em `/admin/team`, sem sequer chegar a mostrar o erro à 4ª tentativa —
  simplesmente não teve efeito visível), importação Gmail (`GmailConfigPanel.jsx`, durante o lote de
  design `faturas`), e TOConline (botão "Carregar" na aba "Documentos", durante o lote `toconline`,
  mesmo com `ligado: true` confirmado). Três domínios funcionais distintos, três endpoints/fluxos
  diferentes, mesma mensagem, mesma conta admin. Deixou de poder ser tratado como "limitação pontual
  desta sessão" — o padrão sugere ou uma regra de permissão da conta mal configurada, ou algo
  estrutural em como esta sessão de admin foi criada/autenticada. Junta-se à prioridade de
  segurança/permissões já identificada como maior, a retomar — não é um bloqueio de lote de design,
  é um item de segurança/permissões a investigar por si. Nenhuma investigação de causa raiz foi feita
  ainda (estava fora de âmbito de todos os lotes onde apareceu); confirmar primeiro se é reprodutível
  fora do contexto dos lotes de design antes de assumir qualquer hipótese sobre a causa.
- `src/AppLayout.jsx` é código morto; nada o importa. O `main.jsx` monta o `src/app.jsx`.
  (`AdminTopbar.jsx`, que também era código morto, foi apagado no commit `1a25004` — já não existe.)
- Há dois ficheiros diferentes chamados `FaturasTab.jsx` — `src/features/admin/FaturasTab.jsx`
  (usado por `FaturacaoAdmin.jsx`, gera PDF) e `src/features/admin/cost-reports/FaturasTab.jsx`
  (usado por `CostReports.jsx`, tem `.recon-scope`). Confirmar sempre o caminho completo antes de
  mexer num dos dois — e **sempre citar o caminho completo em qualquer comunicação sobre um lote que
  toque um dos dois**, nunca só o nome do ficheiro, para nunca ficar ambíguo qual está em causa.
- Mesma armadilha com `LoginView.jsx` — `src/features/auth/LoginView.jsx` (login do admin/
  trabalhador, usado por `app.jsx`) e `src/client-portal/LoginView.jsx` (login do portal do
  cliente, usado por `ClientPortal.jsx`). Consumidores disjuntos, sem risco real de import cruzado,
  mas mesma regra: **sempre citar o caminho completo** em qualquer comunicação sobre um lote que
  toque um dos dois. Achado da auditoria de bloqueadores (`AUDITORIA-BLOQUEADORES.md`, E.1).
- **Um ficheiro sem `.recon-scope`/marcador sensível escrito nele pode herdar o contexto na mesma,
  por ser renderizado como filho dentro de outro ficheiro que o tem.** Um grep direto ao ficheiro
  diz "limpo" e engana — só aparece ao seguir a árvore de renderização (imports + onde o componente
  é montado). Já aconteceu duas vezes: `salarios/AssocTransacaoModal.jsx`, `SalarioEmployeeCard.jsx`,
  `JustificarModal.jsx` (nenhum tem `.recon-scope` próprio, mas são filhos de `SalariosTab.jsx`, que
  tem); e `reconciliacao/ResultadosTabs.jsx`, `OrfaoBancoModal.jsx`, `HistoricoSection.jsx`,
  `AssocClienteModal.jsx`, `AssociacaoManualModal.jsx` (filhos de `ReconciliacaoAdmin.jsx`). Antes de
  classificar um ficheiro como "fora de qualquer zona sensível", confirmar quem o importa e onde é
  montado, não só o que o próprio ficheiro contém — vale para `.recon-scope`, para ficheiros de
  dinheiro, e para qualquer outra zona sensível que apareça no futuro, não só para este lote.
- Breakpoints Tailwind (`lg:`, `md:`) medem a viewport, não o contentor — partem layouts dentro de
  modais de largura fixa. Usar container queries (`@container` no pai + `@md:` no filho).
- Ficheiros com terminações de linha mistas (LF/CRLF); substituições por script falham
  silenciosamente nos CRLF. Verificar sempre o resultado.
- `npx vite build` passar não prova nada sobre props erradas, ícones perdidos ou imports órfãos.
  Correr também `npx eslint .` e confirmar no browser (localhost:4179). A suite de testes cobre
  lógica e fluxos, mas **não** regressões visuais/contraste — para UI a verificação continua a ser
  no browser ao vivo.
- **Eslint e build não apanham texto errado, só sintaxe — qualquer mudança que toque em formatação
  de texto renderizado precisa sempre de verificação visual ao vivo, não é opcional.** Confirmado em
  `WorkerValidationPanel.jsx` (2026-08-24): `formatHours()` já devolve o formato completo
  (`"81h30"`), e uma primeira escrita do ficheiro apendou um `h` a mais em 4 sítios (`"0h00h"`,
  `"81h00h total"`) — sintaticamente válido, `eslint`/`vite build` limpos nos dois casos, só visível
  ao ler o texto real renderizado (`get_page_text`/`outerHTML`, não screenshot). A mesma classe de
  erro já tinha aparecido com `fmtH`/`formatHours` inconsistentes entre vistas do mesmo ficheiro.
- Migrações Supabase: `supabase db query --linked -f <ficheiro>`, **nunca** `db push`. Depois de DDL
  direto, `NOTIFY pgrst, 'reload schema';`.
- PDFs têm dois motores: jsPDF (programático, imune a CSS) e html2canvas (captura o DOM, sensível a
  CSS). Verificar qual é qual antes de mexer em estilos globais.
- Nunca inventar códigos de campos da Segurança Social — são registos oficiais, há PDFs de
  especificação técnica do PSI no repo.
- `* { text-transform: uppercase !important }` global em `App.css` — usar `className="text-natural"`
  para escapar quando necessário.

## Redesenho — `Documentos › Por categoria` (2026-08-31)

Fluxo completo: mockup interativo (2 opções, artefacto, dados reais do dia) → Diego escolheu
**Opção B** (cartões por colaborador) → implementado. Ficheiros: `DocumentsAdmin.jsx`
(`CategoryRail`), `documents/CategoryWorkerGrid.jsx` (novo, substitui `DocumentsTable.jsx` neste
modo), `documents/docBadges.jsx` (novo — `StateBadge`/`ValidadeBadge`/`CategoriaTag`/
`CategoriaEditor`/classes de ícone, extraídos de `DocumentsTable.jsx` para serem partilhados sem
duplicar), `constants/rhCategories.js` (`SEM_CATEGORIA`, `isUncategorized`).

**Achado real que motivou o "Sem categoria / a rever" fixo na rail:** o cálculo de contagens da
rail (`categoryCounts` em `DocumentsAdmin.jsx`) fazia `d.categoria || 'Outros'` — um documento sem
categoria contava para "Outros" na rail, mas o filtro real (`filteredDocs` em
`useDocumentsAdmin.js`) compara igualdade exacta (`d.categoria !== categoriaFilter`), que um
`null` nunca bate. Resultado: a rail mostrava "Outros" inflacionado, mas clicar nele escondia
esses documentos — nunca apareciam em lado nenhum a não ser "Todas". Confirmado com dados reais
em produção: 3 documentos (2 com `categoria=null`, 1 com `categoria="Segurança Social"` — valor
antigo, já fora da lista oficial de 8, resíduo de antes de existir "Segurança Social e Fiscal").
`isUncategorized(categoria)` (`!categoria || !CATEGORIAS_RH_ACT.includes(categoria)`) trata os
dois casos como o mesmo problema — "precisa de decisão humana" — e é a fonte única partilhada
por `CategoryRail`, `CategoriaTag` (mostra "Categoria não reconhecida: X" em vez de mascarar) e o
filtro.

**`DocumentsTable.jsx` e `SortableTh.jsx` ficam no repo, sem consumidor.** Era a implementação da
Opção A (tabela única, ordenável), comparada lado a lado com a B no mockup antes da decisão — não
é código morto alheio a apagar por rotina, é a alternativa perdida de uma escolha de design feita
5 minutos antes; mantida por reversibilidade caso a decisão mude. `sortKey`/`sortDir`/`handleSort`
em `useDocumentsAdmin.js` também ficam (sem consumidor agora, sem custo de manter).

Verificado ao vivo: contagem da rail bate com a query SQL real (`Sem categoria / a rever: 3`,
`Remuneração: 142`, etc.); `CategoryWorkerGrid` renderiza correctamente com 142 documentos
(maior categoria); `CategoriaEditor` abre o dropdown; sem scroll horizontal a 375px
(`document.body.scrollWidth === innerWidth`, antes a tabela precisava de arrastar para ver
Ações). Ação "Aplicar carimbo" não foi re-testada ponta-a-ponta nesta passagem (zero documentos
`awaiting_admin` no momento) — reaproveita exactamente o mesmo `onApprove`/branch já testado
ponta-a-ponta no Fluxo 3 nesta mesma sessão, só mudou o componente que renderiza o botão.

**Revisão de densidade, mesma sessão — Diego comparou o resultado lado a lado com o mockup e
achou a linha demasiado cheia.** Trocado: bola de estado (cor, sem texto) + `tipo` (não o nome do
ficheiro) como conteúdo em repouso; nome do ficheiro/data ficam só no `title` (tooltip). Ações
(categoria/pré-visualizar/aprovar/apagar) escondidas por omissão, reveladas só em hover
(`group-hover:flex`, mesmo padrão já usado no ícone de lápis do `CategoriaEditor`). O editor de
categoria ganhou uma variante `compact` (`docBadges.jsx`) — ícone `Tag` sozinho, cor de aviso
quando `isUncategorized`, em vez da pílula `CategoriaTag` inteira — só usada aqui, a pílula
completa continua no `DocumentsTable.jsx` (dormente) sem alteração. `MAX_ROWS_PER_CARD` desceu de
8 para 3, e a grelha passou de 2 para 3 colunas (`xl:grid-cols-3`) para bater com a densidade do
mockup. Confirmado ao vivo: bola verde + tooltip "Assinado" num documento assinado, ícone de
categoria em `rgb(217,138,43)` (`--warn`) num documento sem categoria, ações aparecem só ao
`hover` na linha.

**Segunda revisão, mesma sessão — dimensões do cartão e "+N documentos" viraram botão.** A
grelha `xl:grid-cols-3` (colunas fixas, cartão esticado a preencher) foi trocada por
`grid-cols-[repeat(auto-fill,minmax(258px,1fr))]` — o mesmo mecanismo CSS do mockup, cartão com
largura mínima real (258px) em vez de N colunas fixas a esticar. Padding `p-4`→`p-3.5` (16px→14px,
bate exactamente com o mockup). `+N documentos` deixou de ser texto solto e passou a botão que
abre a pasta **completa** do trabalhador (todas as categorias, não só a filtrada) num `ModalShell`
— reaproveita `WorkerPastaView` (o mesmo componente que "Por colaborador" usa por trás do próprio
clique no cartão), com uma prop nova `hideHeader` para não duplicar avatar/nome (já vêm do
`title`/`meta` do `ModalShell`). Precisou de uma segunda prop nova em `CategoryWorkerGrid`
(`allDocs` — a lista total de `useDocumentsAdmin`, não a já filtrada por categoria/pesquisa) para
a pasta mostrar tudo do trabalhador, não só o que estava visível no ecrã. Confirmado ao vivo: o
modal abre com o total certo de documentos, a subpasta por categoria lá dentro abre um segundo
`ModalShell` (aninhado, mesmo padrão de `Z.viewer` usado no resto da app) com os cartões de
documento completos (miniatura, Ver/Apagar) — o mesmíssimo fluxo de "Por colaborador", só que sem
sair de "Por categoria".

**Terceira revisão, mesma sessão — fundo de cada linha tingido pela cor do estado.** `DocRow`
ganhou `STATE_ROW_BG` (`pending`→`var(--warn-bg)`, `awaiting_admin`→`var(--surface-dim)`,
`signed`→`var(--ok-bg)`) como `style.backgroundColor`, sempre visível (antes só no hover) —
reaproveita exactamente as mesmas variáveis já usadas no fundo do `StateBadge` (`docBadges.jsx`),
não uma paleta nova. **Medição em modo escuro apanhou o mesmo instrumento enganador já
documentado na "Referência central" do topo deste ficheiro — `rgba()` não composta**: uma
primeira leitura ingénua (`getComputedStyle` sem contar o alfa) deu 1,69:1 e 3,09:1, parecendo
falha grave; a composição correcta do alfa sobre o fundo real do cartão (`rgb(30,41,59)`, o
`--card`/`bg-white` invertido) deu 6,36:1 e 7,25:1, ambos a passar AA com folga. Confirmado com o
mesmo script de composição já usado noutros pontos desta migração (percorrer `parentElement` até
encontrar o primeiro fundo opaco, misturar `rgb*alpha + fundo*(1-alpha)`).

**Quarta revisão, mesma sessão — sinalização de expirado/urgente mais visível.** A borda
esquerda de 2px (`border-red-300`/`border-amber-300`) ficava discreta ao lado do fundo já tingido
pelo estado (revisão anterior) — trocada por `border-l-4` com tokens (`--bad`/`--warn`, mais
saturados que os `-300` do Tailwind). Expirado/urgente agora **pisa** o fundo de estado (fica
`--bad-bg`/`--warn-bg` em vez do fundo do estado normal — um documento expirado importa mais do
que estar "assinado"), ganha um ícone `AlertTriangle` sempre visível (não só no hover) e o rótulo
de `getExpiryRelativeLabel` ("expirado há Nd") em texto a negrito, na cor do alerta. Verificado com
dado real (`Francisco Wanderlilson Diniz`, Título de Residência expirado há 513 dias) e contraste
medido com composição de alfa correta nos dois modos: 4,76:1 claro, 4,63:1 escuro — ambos a passar
AA, mas com pouca folga; se um dia se quiser mais margem, escurecer o tom do texto é a via já
validada noutros pontos desta migração (mesma lógica do `--orange-hover`).

**Implementação real da reorganização "Por colaborador" (2026-08-31)** — depois do mockup
aprovado (artefacto com 2 correções: ficha com campos reais do documento, depois com miniatura
reconstruída). `WorkerPastaView` (`WorkerDocsFolderView.jsx`) deixou de renderizar
`SubPastaCard` (cartão de subpasta com barra de progresso → abre modal com grelha de cartões) —
agora cada categoria é uma secção com `CompactDocRow` (linha compacta, extraída para
`docBadges.jsx` a partir de `CategoryWorkerGrid.jsx`, partilhada pelos dois eixos de agrupamento).
`SubPastaCard` foi removido do ficheiro (ficava sem consumidor, órfão da própria alteração — ao
contrário do `DocumentsTable.jsx`/Opção A, que ficou guardado por ser uma alternativa recém-
comparada, aqui não houve escolha entre duas opções, só substituição directa).

Clicar numa linha abre `DocCardSingle`/`DocCardPair` (reaproveitados tal como estavam — miniatura
real via `ThumbImg`, `getCategoryFields`, acções) dentro de um `ModalShell` próprio, em vez do
antigo modal por categoria com grelha de vários cartões — 1 clique em vez de 2 até à ficha do
documento, sem perder nenhuma informação (o próprio Diego pediu para confirmar isto ao ver o
modal real antes de aceitar a proposta). Pares Frente/Verso continuam agrupados numa só linha
(`groupDocItems`/`itemToRowModel`, mesma lógica de agrupamento por `grupo_id` que já existia).

Cartão do colaborador (nível 1, grelha de trabalhadores) ganhou "N por resolver" a par da
contagem total (`w.docs.filter(d => d.state !== 'signed').length`), como pedido — o anel de
validade (`AvatarRing`) manteve-se sem alteração, é um sinal diferente (validade, não aprovação).

Como `WorkerPastaView` também é reaproveitado dentro do "+N documentos" de `CategoryWorkerGrid.jsx`
("Por categoria"), esta mudança aplicou-se aos dois sítios de uma vez — mais um ponto a favor da
partilha via `CompactDocRow`.

**Verificado ao vivo com dados reais**, com uma lacuna a registar: nível 1 (grelha com "N por
resolver" e ponto vermelho no avatar do Francisco), nível 2 (secções por categoria, incluindo os
dois documentos genuinamente expirados dele — Título de Residência 513 dias E Documento
Provisório de Identificação Fiscal 2141 dias, este segundo só descoberto agora), ficha de
documento singular (Recibo de Vencimento, miniatura real do PDF) e ficha de par Frente/Verso
(Título de Residência, duas imagens reais lado a lado) — todos confirmados a funcionar
correctamente, directamente a partir de "Por colaborador". **Pendência fechada (2026-08-31,
sessão seguinte):** o caso dos 3 `ModalShell` aninhados (Por categoria → "+N documentos" →
clique numa linha) foi confirmado ao vivo depois de a sessão de admin ser reautenticada —
`layer="nested"` (z=200) empilha correctamente por cima de `layer="viewer"` (z=300) neste caso
porque o backdrop do modal exterior tem `backdrop-blur-sm`, que cria o seu próprio contexto de
empilhamento CSS (`backdrop-filter` isola descendentes, tal como `transform`/`opacity`) — o
z-index do modal interior só compete dentro desse contexto isolado, não contra o z=300 global.
Não é preciso subir a camada do modal interior para `viewer`; a hierarquia actual já é segura
sempre que o modal exterior imediato usar `ModalShell` (todos usam).

**Revitalização visual do cabeçalho/secções de `WorkerPastaView` (2026-08-31)** — proposta via
mockup (artefacto), aceite com uma condição explícita do Diego: reaproveitar os tamanhos de fonte
já existentes (`SCALE.text.*`), não os tamanhos maiores do mockup ilustrativo. Três mudanças:

1. **Cabeçalho do trabalhador** — de faixa simples para cartão em gradiente navy
   (`linear-gradient(135deg, var(--navy-solid), ${FT.navyDeep})`, fundo fixo, não inverte), com
   avatar, nome, e uma faixa de 3 estatísticas (Resolvidos/Por resolver/Expirados, `docs.length`
   dividido em 3 contentores mutuamente exclusivos — `porResolver` = estado ≠ assinado E não
   expirado/urgente) + barra de progresso segmentada. Tamanhos mantidos:
   `SCALE.text.statValue`/`.statLabel`/`.meta`/`.entityName`, só a cor/fundo/layout mudou.
2. **Secções de categoria (`CategorySection`)** — ganharam acento de cor por categoria (borda
   esquerda 3px + fração "N/M" + mini barra de progresso), via novo `CATEGORIA_HEX` (mapa
   categoria→cor, necessário porque o JIT do Tailwind não gera CSS para classes construídas em
   runtime, ex. `colors.text.replace('text-','border-')` — só classes literais no código-fonte).
3. **Cabeçalho do mês (`MonthGroup`)** — de bloco de texto igual ao da categoria para uma marca de
   linha do tempo (ponto + linha horizontal + contagem + chevron).

**Bug de contraste real, encontrado por medição ao vivo, não suposto — nos DOIS modos, não só no
escuro.** O primeiro `CATEGORIA_HEX` usava os `-600` "óbvios" do Tailwind (`#059669` emerald,
`#0284c7` sky, `#e11d48` rose, `#0d9488` teal, etc.) directamente como hex fixo. Medido: contra o
`--panel` branco (claro) davam 3,19–4,76:1 — a maioria **falha AA**; contra o `--panel` escuro
(`#131d28`) davam 3,62–4,54:1 — também falha. Corrigido com dois graus de tom, um por modo, iguais
à técnica já usada em `--tone-*`: **novos tokens `--cat-*` em `src/index.css`** (`:root` +
`.dark`), um por cor de categoria (8: `amber-custom`, `emerald`, `sky`, `rose`, `teal`, `amber`,
`orange`, `slate`) — graus mais escuros que os -600 no claro (`#8a4a00`…`#475569`, ≥5,47:1 contra
branco) e graus mais claros (-300/400) no escuro (`#f0b429`…`#94a3b8`, ≥6,32:1 contra `--panel`
escuro). `CATEGORIA_HEX` passou a apontar para `var(--cat-*)` em vez de hex literal — segue o
`.dark` automaticamente dentro do `style` inline (mesma técnica já documentada para `FT.navy` →
`var(--navy)`). Confirmado ao vivo, nos dois modos, com medição real (não estimada): 5,47–6,29:1
claro, 6,32–9,14:1 escuro.
Achado à parte, também corrigido: o número "Expirados" do cabeçalho usava `var(--bad)` sobre o
fundo navy fixo — 2,11:1, falha AA catastroficamente (`--bad` claro não foi pensado para fundo
navy). Corrigido para `#e08872` fixo (o próprio valor de `--bad` do modo escuro do projeto,
4,43:1) — mesma lógica já documentada para `--on-navy`: fundo fixo, o token que inverte é que
estava errado, não o fundo.

**"cards desalinhados" (feedback do Diego, com screenshot) — `MonthGroup` tinha `px-0.5` (2px) no
botão do cabeçalho do mês, mas o `CompactDocRow` por baixo tem `px-2` (8px) próprio dentro do
mesmo wrapper (`px-2.5`, 10px) — o ponto do cabeçalho do mês ficava ~12px do canto do cartão, o
ponto da linha do documento por baixo ficava ~18px, 6px de desalinhamento vertical entre os dois.**
Corrigido trocando o `px-0.5` do botão do `MonthGroup` para `px-2`, igual ao padding próprio do
`CompactDocRow` — confirmado ao vivo via `getBoundingClientRect()`: pontos a 153px/157px (4px de
diferença residual, só do tamanho do próprio ponto — `w-1.5` vs `w-2` — não da posição).
`npx eslint`/`npx vite build` limpos (os 2 erros que aparecem em `WorkerDocsFolderView.jsx`, sobre
`PreviewThumb` declarado dentro do render, são pré-existentes, confirmados sem relação com esta
alteração).

**"não estão centrados todos cards" + "botão de voltar atrapalha" (feedback do Diego, com
screenshot em ecrã largo ~1900px) — dois bugs distintos, mesma causa raiz.** O contentor raiz de
`WorkerPastaView` tinha `max-w-4xl` mas **sem `mx-auto`** — num painel largo (sem modal à volta,
rota `/admin/documentos` → "Por colaborador"), a coluna de 896px ficava encostada à esquerda em
vez de centrada, com uma faixa enorme de vazio à direita. O botão "voltar" vivia como um `<button>`
irmão à esquerda do cartão navy, fora do fluxo do `max-w-4xl` — ficava ainda mais desalinhado/
solto num ecrã largo. Corrigido: `mx-auto` no contentor raiz (confirmado ao vivo com
`getBoundingClientRect()` a 1900px: 396,5px de margem dos dois lados do painel — perfeitamente
centrado); botão "voltar" movido para DENTRO do cartão navy, antes do avatar, como
`hover:bg-white/10` + `color: var(--on-navy)` (em vez de fundo/texto neutros que destoavam do
cartão) — deixou de ser um elemento solto e passou a fazer parte do cabeçalho. `npx eslint`/
`npx vite build` limpos.

**Revitalização do cartão de detalhe de documento (`DocCardSingle`), 2026-08-31** — mesmo fluxo de
mockup→aprovação→implementação: proposta via artefacto (comparação Atual/Proposta com dados reais
de "Mapa de Ajudas de Custo" do Adriel de Jesus dos Santos), aprovada, implementada. Três mudanças:
cabeçalho ganha ícone+borda-topo na cor real da categoria (`CATEGORIA_HEX`/`--cat-*`, a mesma
paleta já usada em `CategorySection`), o selo de estado (`StateBadgeSmall`)/validade
(`ValidadeChip`) sobe para o cabeçalho junto ao título em vez de ficar só lá em baixo, e os campos
de `getCategoryFields(d)` passam de linhas "rótulo: valor" para uma grelha 2 colunas de fichas
(rótulo `statLabel` em cima, valor `body` em baixo). Ações ganham rótulo ("Ver"/"Visível"/"Oculto"),
com "Apagar" isolado à direita, ícone sozinho, fundo `--bad-bg`. `DocCardPair` (par Frente/Verso,
identidade violeta própria) não foi tocado — fora do pedido, mantém o padrão antigo.

**Bug de contraste real, apanhado ao vivo — `bg-white` no cartão exterior colidia com a
regra-ponte já documentada na "Referência central" no topo deste ficheiro.** A primeira versão
usava `className="rounded-2xl overflow-hidden bg-white border border-[var(--border-soft)]"` com
`style={{ borderTop: '3px solid ' + accentColor }}` (a cor da categoria). Medido em modo escuro: a
borda superior aparecia sempre `#334155` fixo, ignorando `--cat-emerald` (ou qualquer outra cor de
categoria) por completo. Causa: `.dark .bg-white` em `App.css:46-50` não muda só o fundo — define
também `border-color: #334155 !important`, que vence QUALQUER outro valor de `border-color`
(mesmo vindo de `style` inline, que normalmente venceria classes) porque `!important` tem
prioridade sobre a cascata normal independentemente da origem. Corrigido trocando `bg-white` por
`bg-[var(--panel)]` (mesmo token já usado por `CategorySection`) — sem `!important` nenhum a
interceptar, a cor da categoria passou a aplicar-se correctamente. Confirmado ao vivo nos dois
modos: claro `rgb(0,117,74)` (`#00754a`), escuro `rgb(52,211,153)` (`#34d399`) — ambos os valores
exactos de `--cat-emerald`. Contraste dos campos da grelha medido nos dois modos: rótulos
4,81–5,10:1, valores 8,96:1, "Não disponível" 4,81–5,10:1 — todos AA com folga.
**Lição a reter, além da já registada:** a regra-ponte não é só um problema de "o fundo não é o
que eu esperava" — o `!important` no `border-color` pode silenciosamente anular uma cor de borda
definida via `style` inline em qualquer componente novo que combine `bg-white` com uma borda
colorida própria (accent de categoria, estado, o que for). Qualquer cartão novo com borda de
destaque sobre fundo branco/`bg-white` deve usar `bg-[var(--panel)]` desde o início, não só depois
de medir o bug.
`npx eslint`/`npx vite build` limpos (mesmos 2 erros pré-existentes de sempre, sem relação).

**Rótulo do botão de formação por assinar corrigido (2026-08-31, feedback do Diego com screenshot
do telemóvel).** `FormacaoModal.jsx` (lista "As tuas formações" do trabalhador) mostrava o mesmo
selo de estado ("Por iniciar"/"Em progresso"/"Reprovado") para qualquer formação e-learning por
concluir — descrevia a SITUAÇÃO, não dizia o que tocar na linha fazia. Diego pediu explicitamente:
"o curso sem iniciar tem botão Iniciar e curso iniciado tem botão terminar". Corrigido: e-learning
`nao_iniciado` → "Iniciar" (abre a primeira etapa); qualquer outro estado por concluir
(`em_progresso`, `reprovado` a repetir, ou `concluido` no questionário mas por assinar — este
último um caso que só existe porque `FormacaoElearningFlow.jsx` tem uma etapa de assinatura FINAL
mesmo depois de passar no questionário) → "Terminar" (retoma a seguir). Presencial não tem duas
fases — a única acção é assinar em si, por isso ficou "Assinar" (não "Iniciar"/"Terminar"), mudança
mínima face ao "Por assinar" anterior. Constante `STATUS_LABEL` (só usada nesta troca) removida por
ficar órfã. Não confirmado ao vivo — o dashboard do trabalhador está atrás do mesmo bloqueio de
sessão já registado (`403 Sem permissão`, "Ver Portal" em `/admin/team`); `npx eslint`/
`npx vite build` limpos.
**Pendência fechada no mesmo dia:** o botão "Assinar Agora" da secção "Formações por Assinar" em
`PendingAlertsModal.jsx` — inicialmente deixado fora do pedido, por abrir a lista inteira
(`FormacaoModal`) e não uma formação específica, sem correspondência directa com "Iniciar"/
"Terminar" — foi corrigido a pedido do Diego (screenshot novo): título "Formações por Assinar" →
"Formações por Fazer", botão "Assinar Agora" → "Fazer Agora". O botão irmão da secção
"Assinaturas Pendentes" (documentos, não formação) manteve "Assinar Agora" — só o de formação
mudou. **Pendência nova, não corrigida:** a frase de apoio por baixo do título ("N formações
requerem a tua assinatura digital") continua a falar em "assinatura digital", que já não bate
com "Fazer"/"Iniciar" para quem ainda nem começou o curso — não foi pedido explicitamente, fica
registado.

**Varrimento sistemático de pares texto+fundo no mesmo elemento, 2026-08-31 — 358 pares únicos
verificados em todo o `src/`, 5 falhas reais corrigidas, um módulo novo (`mapa-salarios/`) trazido
para dentro dos padrões de contraste, e 2 áreas identificadas e deixadas de propósito.**
Metodologia: script Node ad-hoc (apagado no fim, uso único) que resolve `FT.*`/`var(--x)` para hex
a partir de `designTokens.js`/`index.css` (claro+escuro) e procura, no MESMO elemento — mesma
`className`/mesmo `style={{}}` — um par `text-*`+`bg-*`, calculando o contraste WCAG dos dois lados.
**Dois falsos positivos apanhados e corrigidos a meio do próprio varrimento, antes de reportar
seja o que for:** (1) o primeiro regex emparelhava cor de um ramo de ternário com a do outro
(`cond ? 'bg-x text-y' : 'bg-a text-b'` dava `bg-x`+`text-b`, uma combinação que nunca renderiza
junta) — `WorkerNavBar.jsx`, `RecibosCalculadora.jsx:3735`, `ImportarContratosSSDModal.jsx:376`
eram todos isto, não bugs reais; (2) tentar separar ramos de ternário fazendo `.split(/[?:]/)`
partia `hover:` ao meio (o `:` de `hover:bg-x` não é o mesmo `:` de um ternário) — corrigido para só
fazer essa divisão em template literals (onde um ternário É possível), nunca em strings simples
(onde `:` só pode ser um modificador Tailwind). Cada resultado do varrimento final foi confirmado
por leitura do código antes de entrar nesta lista — nenhum foi corrigido às cegas a partir do script.

Corrigidos, todos com `#8a4a00`/`#92400e`/`#1e40af`/`#991b1b`/`#166534`/`#1f6b47` (mesma lógica do
`--orange-hover` em toda a migração: escurecer o mínimo suficiente para passar AA, não o extremo) —
confirmados ao vivo onde havia caminho sem bloqueio de sessão:
- **`ValidacaoMensalPanel.jsx:151`** — era um dos ~48 casos do "par chip" (`--slate-dim`/
  `--surface-dim`) que a triagem anterior não tinha alcançado por vir de fundo definido no MESMO
  ficheiro mas fora do alcance do primeiro script (esse só via `--surface-dim`; este varrimento por
  par-no-mesmo-elemento apanhou-o de outro ângulo). `--ink-soft`, 4,98:1 escuro.
- **`ClientManager.jsx:338`** — badge "Modo limitado", `#B8791F`/`FT.warnBg`, mesma família
  laranja+warnBg já conhecida (3,21:1 → `#8a4a00`, 6,08:1). Sem confirmação ao vivo (nenhum
  cliente com `triggers_limited_mode` visível na sessão de teste), fórmula já validada noutros
  sítios.
- **`FaturarClienteModal.jsx:971`** — texto de input **desativado** (`disabled:text-*`), 2,68:1 no
  claro → `--ink-soft`, 5,68:1. Sem confirmação ao vivo (TOConline não ligado nesta sessão, mesmo
  bloqueio já registado).
- **`FormacaoElearningFlow.jsx:433`** — banner "Formação concluída e assinada", `FT.ok`/`FT.okBg`
  4,42:1 → `#1f6b47` (mesmo valor já usado no `WorkerValidationPanel.jsx` para este par), 5,66:1.
  Sem confirmação ao vivo (dashboard do trabalhador bloqueado).
- **`mapa-salarios/MapaCartoes.jsx`, `MapaFolhaObra.jsx`, `MapaSalarios.jsx`** — módulo nunca antes
  mencionado nesta migração, confirmado por `git log` que uma "fase 5" anterior o tinha convertido
  de Tailwind para tokens, mas estes badges de proveniência de dados ("Ambíguo", "Recibo (nome)",
  "Sem NIS", "Div.", "OK") ficaram de fora — hex cru, repetido identicamente nos 3 ficheiros
  (mesmo quarteto amber/blue/red/green-600 do Tailwind, sempre sobre o próprio -100), sinal de
  resíduo (copiado, nunca medido), não de identidade deliberada — ao contrário do
  `reconciliacao-mockup.css` ou do `WhatsAppInbox.jsx` (ver abaixo), que têm razão documentada para
  não convergir. Correcção: escurecer cada cor para o degrau -800 do mesmo tom Tailwind
  (`d97706`→`92400e`, `2563eb`→`1e40af`, `dc2626`→`991b1b`, `16a34a`→`166534`), 6,37–7,60:1 contra
  os respectivos fundos claros. `MapaSalarios.jsx` já tinha resolvido o mesmo problema para o par
  âmbar num sítio (`#8a5800`, linha 217) sem o aplicar aos outros dois usos do ficheiro — reutilizado
  esse valor em vez do `92400e` genérico, por já ser o precedente local. Um badge vermelho sólido
  (fundo `#dc2626`, texto branco) e um texto `#dc2626` solto sobre painel branco (4,83:1) já
  passavam — não tocados. Confirmado ao vivo, nas 3 vistas (Folha de Obra, Cartões, Painel
  Executivo não testado): "1 divergência a validar" 5,73:1, "1 sem NIS" 5,82:1/6,37:1, "Div." 6,80:1.

Identificados, decidido não tocar:
- **`WhatsAppInbox.jsx` (6 pares, `#00a884` e variantes)** — cor oficial da marca WhatsApp (o teal
  `#00a884` é literalmente a cor de marca do WhatsApp), usada de forma consistente em toda a
  integração. Mesmo critério já usado para o `VerificationPortal.jsx`: identidade própria e
  deliberada, não converge para os tokens da app sem decisão explícita.
- **`DocumentTemplatesAdmin.jsx:142`** — `var(--ok)`/`var(--ok-bg)` num botão-ícone (não texto
  corrido), 4,42:1 no claro. Ícones só precisam de 3:1 (WCAG 1.4.11, non-text contrast), que já
  passa com folga — não é o mesmo limiar de 4,5:1 do texto. Não alterado, para não arriscar mudar
  o token partilhado `--ok`/`--ok-bg` só por um caso que já cumpre o limiar que lhe compete.

**Segunda ronda do mesmo varrimento, mesmo dia — desta vez por ANCESTRAL (fundo pode estar numa
linha diferente do texto, não só no mesmo elemento), generalizando a técnica já usada para o
"par chip".** Script novo (também apagado no fim), mesma base de resolução de tokens, mas percorre
para trás por indentação (mesma lógica do `fundo-do-ancestral.pl`) em vez de exigir texto+fundo na
mesma `className`/`style`. Encontrou 180 candidatos — **132 são a mesma família já registada e
deliberadamente adiada** ("`--slate`/`FT.slate` a colorir texto", requer classificação ícone-vs-
-texto caso a caso, não converter às cegas — ver secção acima). Dos 48 restantes, **3 grupos
inteiros eram falsos positivos do próprio script**, todos pela mesma razão: o script só olha para
trás (linhas anteriores) à procura do fundo, e um botão que declara `style={{ background: ... }}`
numa linha DEPOIS da que define a cor do texto (comum em JSX multi-linha) engana-o — atribuiu o
fundo errado (o de um ancestral mais distante) em vez do fundo real do próprio elemento:
- `var:navy-solid / bridge:bg-white` (4 casos, RecibosCalculadora/ContadorEmailsAdmin/
  TOConlinePanel) — são todos botões `text-[var(--navy-solid)]` com `style={{ background:
  FT.orange }}` na linha seguinte; par navy/laranja já sabido seguro.
- `ft:navy / var:surface-dim` (WorkerValidationPanel.jsx, toggle lista/grade) — já documentado
  como correcto de propósito (`background:'#fff'` inline por ramo de ternário, não a classe).
- Ícones dentro de `FT.warn`/`FT.warnBg` a 15% opacidade (`GeoSuggestionCard.jsx`,
  `PendingAlertsModal.jsx`) — decorativos, mesmo critério de sempre.

**5 bugs reais confirmados e corrigidos**, todos "texto fixo (`FT.*`/`var(--warn)`) sobre fundo que
inverte (`bg-white` ou `bg-[var(--surface-dim)]`)" — a mesma classe de erro já descrita para
`--on-navy`, só em ficheiros nunca antes auditados por esta técnica:
- **`WorkerNavBar.jsx:86`** — nome do trabalhador na barra superior, `FT.navyDeep` sobre `bg-white`
  → **1,03:1 em modo escuro** (praticamente invisível). `var(--navy)`, 7,22:1.
- **`ManualTimeEntryCard.jsx:81`** e **`WorkerCalendar.jsx:58`** — mesma classe de bug (data/mês
  sobre cartão `bg-white`), mesmo fix `var(--navy)`.
- **`WorkerScheduleTab.jsx:35+38`** — rótulo "Pausa" e horário, `FT.warn`/`FT.orangeDeep` sobre
  `FT.warnBg`, 2,44:1/3,07:1 → `#8a4a00` (reutilizado, já usado 3x nesta migração para este par
  exacto), 6,08:1.
- **`CategoryWorkerGrid.jsx:80`** — "N por resolver" no cartão do colaborador (Por categoria),
  `var(--warn)` sobre `bg-white`, 2,76:1 no claro → `var(--tone-amber)` (o token já pensado para
  texto de aviso sobre painel, não `--warn`, que serve fundos `--warn-bg`), 5,03:1/6,85:1.
  Confirmado ao vivo, 5,03:1.

**Achado, não corrigido — já era pendência conhecida, apanhada de novo por este varrimento:** as
linhas dentro de `bg-white/70` em `CorrectionsInbox.jsx` (`tone-amber-label` etc.) — o script
tratou `bg-white/70` como `bg-white` a 100%, mas é translúcido sobre um fundo tingido por baixo;
resolver isto correctamente exige compor o alpha, exactamente o já registado como "não fazia parte
do pedido, fica por resolver" na secção da ponte de cor de estado, acima. Não é um achado novo.

`npx eslint`/`npx vite build` limpos nos 5 ficheiros corrigidos. Confirmação ao vivo só foi possível
para `CategoryWorkerGrid.jsx` (admin, alcançável) — os outros 4 vivem no dashboard do trabalhador,
atrás do mesmo bloqueio de sessão (403) já registado várias vezes nesta sessão.

**Terceira ronda do mesmo varrimento, mesmo dia — duas frentes novas: hex arbitrário do Tailwind
(`text-[#hex] bg-[#hex]` na mesma classe, nunca coberto pelas rondas anteriores porque só olhavam
para `FT.*`/`var(--x)`) e texto em hex cru (`color: '#hex'`) contra fundo ancestral.** 1 falso
positivo na primeira frente (`DashboardView.jsx`, mesmo problema de ternário já conhecido). Na
segunda, **3 bugs reais confirmados e corrigidos**, 2 falsos positivos descartados por inspecção:
- **`WorkerForm.jsx:144`** — o ponto "n/a" (contorno, sem preenchimento) do timeline "Ciclo de Vida
  do Vínculo", `#cbd5e1` sobre o próprio fundo branco (mesma linha — bug do script: não reconhecia
  hex de 3 dígitos, `'#fff'`, como definição de fundo válida) → **1,48:1, abaixo até do limiar de
  3:1 para ícones** (WCAG 1.4.11). Corrigido para `#64748b`, 4,76:1.
- **`MapaPainelExecutivo.jsx` (53, 62)** — quarto ficheiro do módulo `mapa-salarios` encontrado
  (os 3 anteriores já tinham sido corrigidos numa ronda anterior no mesmo dia) — "Δ valor"/"a
  validar" no `ReconBanner`, `#D3572B` sobre `#FFF8EE`, 3,85:1 → `#8a5800` (o mesmo valor que já
  estava a ser usado correctamente no título do próprio banner, linha 41 — só as duas linhas por
  trabalhador tinham ficado com o hex antigo). Confirmado ao vivo, 5,73:1.
- Falsos positivos: `WorkerOnboardingGate.jsx:110` (branco sobre gradiente navy — o script não
  reconhece `background: \`linear-gradient(...)\`` como fundo, subiu até ao fundo creme da página);
  `WorkerForm.jsx:142-144` de novo, desta vez o emparelhamento cruzado de ramos de ternário já
  conhecido (a razão original por trás do bug dos 3 dígitos).

`npx eslint`/`npx vite build` limpos. `MapaPainelExecutivo.jsx` confirmado ao vivo (admin,
"Painel Executivo"); `WorkerForm.jsx` não confirmado ao vivo (precisa de um contrato sem data de
fim para mostrar o estado "n/a"), fórmula já validada.

**Quarta ronda, mesmo dia — mudança de método: em vez de ler código estático, varrimento ao vivo
no DOM renderizado (percorre `body *`, mede `color` computado contra o fundo efectivo real —
composição de alpha correcta através de toda a cadeia de ancestrais — em várias rotas do admin).**
Decisão do Diego, depois de as três rondas anteriores começarem a esgotar o que dava para apanhar
por leitura de código. Apanha o que as rondas estáticas não alcançam por definição — fundo definido
num componente partilhado, `linear-gradient()`, cores Tailwind v4 em `oklch()` que `getComputedStyle`
não resolve para `rgb()` em runtime.
**4 bugs reais corrigidos**, todos a mesma família (`FT.orange`/hex fixo a falhar contra fundo claro,
já com fórmula estabelecida `#8a4a00`):
- **`AdminOverview.jsx`** — botão "Ver Tudo →", `FT.orange` sobre branco, 2,52:1 → confirmado ao
  vivo, 6,86:1.
- **`RecibosCalculadora.jsx` (2973, 2626-2627)** — duas ocorrências não apanhadas pelas rondas
  anteriores (a primeira é `FT.orange` sobre `bg-white`, nunca antes vista; a segunda já constava
  do achado da 3ª ronda mas ainda não tinha sido corrigida) — "Mapa de Ajudas de Custo"/"Total A082".
- **`TOConlinePanel.jsx`** — tab inactiva "Compras"/"Recibos", `#94A3B8` fixo (não token) sobre
  `--surface-dim`, 2,19:1 → `var(--ink-soft)`, mesmo padrão já aplicado a `DocumentsFilters.jsx`/
  `FilaAprovacaoTab.jsx`/`TOConlineRelatorios.jsx` na 1ª ronda.
- **`FaturasAdmin.jsx`** — dois estados vazios ("Nenhuma fatura importada ainda."/"...corresponde
  aos filtros"), `--slate-dim` directamente sobre o fundo global (`FT.bg`), 4,36:1 → `--ink-soft`,
  mesma regra já documentada na secção "Depois" da migração ("texto que assenta DIRECTAMENTE no
  fundo global precisa de `--ink-soft`, não `--slate-dim`").

**2 casos confirmados, não corrigidos — já são o `SectionHeaderShell.jsx` deliberadamente adiado**
(componente partilhado por 19 secções, decisão do Diego de não mexer sem revisão dedicada — ver
secção "Design system" abaixo): o contador de badge (`FT.badgeBad`, 4,06:1) e a tab activa do
`StatChip` (`var(--orange)`, 2,52:1). Ficam registados como mais dois pontos de dados concretos
para quando essa revisão acontecer.

**1 falso positivo apanhado ao vivo, confirma um pitfall já documentado.** Botão "Recalcular"
(`AdminSettings.jsx`) media "branco sobre branco, 1,00:1" — o `getComputedStyle` devolvia o fundo
como `oklch(0.666 0.179 58.318)` (Tailwind v4 nativo, `bg-amber-600`), que o parser do script (só
entende `rgb()`/`rgba()`) não reconheceu, caindo para o fundo da página. **É exactamente o mesmo
pitfall já registado** ("O varredor de contraste tem de entender oklab()/oklch()") — confirma que
continua activo, desta vez apanhado antes de entrar na lista de "corrigido".
Outros dois achados de fundo `oklch`/gradiente ficaram por resolver, ambos de baixa prioridade: o
rótulo "Auditoria técnica..." (`AdminSettings.jsx`) mede 4,43:1 contra um fundo composto (navy a
8% opacidade sobre branco) — muito perto de passar, sem folga que justifique mexer já; e um texto
de 6px "Documento autenticado eletronicamente" que pertence a um dos componentes de carimbo já
documentados como identidade intencional, não tocado pela mesma razão de sempre.

`npx eslint`/`npx vite build` limpos. `AdminOverview.jsx` confirmado ao vivo (6,86:1); os restantes
3 ficheiros têm fórmula já validada noutros sítios mas não foram remedidos individualmente ao vivo
nesta ronda por repetirem exactamente um padrão já confirmado antes.

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
  **Terceiro caso do mesmo padrão, encontrado em 2026-08-24 durante o lote `SCALE.text` de
  `features/public`:** `src/features/public/OnboardingCommitmentStep.jsx:182`
  (`const cssW = parent.clientWidth;`) — pad de assinatura do fluxo de onboarding público (rota
  `?view=onboarding&token=...`, fora do `AppProvider`), não é modal e nunca tinha sido mapeado nesta
  lista. O contentor do canvas tem `style={{ height: 180 }}` fixo (não medido a partir do conteúdo),
  por isso a conversão de rótulos de texto vizinhos para `SCALE.text` não deveria afetar a largura/
  altura do canvas — mas ficou deliberadamente fora do lote por decisão do Diego, sem checkpoint ao
  vivo possível (precisa de token de convite válido). Antes de mexer neste ficheiro no futuro,
  confirmar ao vivo com um token real, não só por leitura de código.
  **Quarto caso, encontrado em 2026-08-24 durante o lote `SCALE.text` de `client-portal`:**
  `src/client-portal/useSignatureCanvas.js:22` (`canvas.width = parent.clientWidth;`), consumido por
  `src/client-portal/ValidarView.jsx:154` — pad de assinatura da aprovação mensal de horas pelo
  cliente. O `parent.clientWidth` mede o `<div id="signature-canvas-area">` (linha 153), que não tem
  nenhum `text-[Npx]` a converter — os dois rótulos de texto do lote (linhas 150 e 159) estão fora
  desse contentor, por isso a conversão não lhe deveria tocar, mas confirmar ao vivo antes de dar como
  seguro.
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
`src/data/motivosContratoSS.js`, `src/features/admin/team/SSComunicacaoModal.jsx` (escritas) e
`src/features/admin/team/SSConsultasPanel.jsx` (consultas de leitura).

São **dois protocolos diferentes**, não um — REST/JSON e SOAP, misturados conforme a operação. O
`index.js` encaminha por um parâmetro `action` (query/body). Operações atuais (não só as 3
originais):
- **Escritas** (criam/alteram registo oficial no Estado): `admissao` (REST POST
  `/ptss/rest/qlf/tco/vinculos/pedido`), `cessacao` (SOAP `cessarVinculoTrabalhador`),
  `alterar-contrato` (SOAP `alterarContratoTrabalho`), `emitir-documento-pagamento` e
  `cancelar-documento-pagamento`.
- **Consultas/leitura** (sem efeito no Estado): `comunicacoes-pendentes` (SOAP `obterComunicacoes`),
  `situacao-contributiva` (+ `situacao-contributiva-pdf`, proxy autenticado do PDF),
  `comprovativos`, `documentos-pagamento`, `avisos` (REST GET `/ptss/rest/eeaoc/avisos/{niss-ee}`),
  `pesquisar-contratos`/`consultar-contratos`, `pesquisar-trabalhadores-ss`/
  `consultar-trabalhadores-ss`, `consultar-emissao-documento-pagamento`. Diagnóstico: `status`,
  `ping`.

O ambiente é decidido por `SS_AMBIENTE` (`producao` vs qualquer outra coisa) e muda o host:
- Produção: `app.seg-social.pt`
- Testes: `extwww.seg-social.pt` (REST) e `extservices.seg-social.pt` (SOAP)

⚠ **Em produção, cada escrita cria/altera um registo oficial no Estado. Não há desfazer pela API** —
e isto já não vale só para admissão/cessação: `alterar-contrato` e emitir/cancelar documento de
pagamento são igualmente irreversíveis. O modal tem um banner vermelho de propósito — foi
acrescentado deliberadamente e não deve ser despromovido de posição (ver razão da não-migração para
ModalShell acima).

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

### Fluxo 3 — Assinatura de documentos via HTML → PDF.co (mecanismo novo, só 2 templates)

Ficheiros: `src/components/worker/HtmlDocumentViewer.jsx`, `src/utils/pdfCoService.js`
(`convertHtmlToPdf`), `src/utils/templateFields.js` (`replaceTemplateFields`, reaproveitado),
`document_templates.formato`/`template_html` (colunas novas, 2026-08-31).

**Porque existe a par do Fluxo 2 (docx + pdf-lib), em vez de o substituir:** o Fluxo 2 carimba a
assinatura por **coordenadas fixas (mm)** sobre um PDF já gerado, calibradas contra o template por
preencher (`{worker_name}` literal) — nunca contra dados reais. Se o texto antes da assinatura for
mais comprido no documento real do que no template calibrado, a assinatura fica desalinhada. Decisão
do Diego: só os 2 documentos novos do Gate (Termo de Responsabilidade — EPI, Consentimento RGPD)
usam o mecanismo novo; o "CONTRATO DE TRABALHO" continua em docx/pdf-lib, sem alteração.

**Mecânica:** a assinatura é um `<img>` normal dentro do próprio fluxo do HTML — se o texto antes
for mais comprido, ela desce com ele, sempre. Um único PDF é gerado, só depois de o admin aprovar
(via `POST /v1/pdf/convert/from/html` da PDF.co, mesma conta já usada para docx→PDF) — nunca um PDF
intermédio órfão como acontecia no Fluxo 2 (Passo 1 gerava um PDF só do trabalhador que ficava
esquecido no bucket depois do Passo 2 sobrescrever `signed_pdf_url`).

Sequência: `HtmlDocumentViewer.jsx` (trabalhador assina) grava o HTML **pristine** — com
`{worker_signature}`/`{admin_stamp}` ainda literais — em `worker_documents.generated_html`, e a
assinatura em bruto em `signature_data` (coluna à parte). `handleApproveDocument`
(`useDocumentTemplates.js`) resolve as duas tags numa só passagem a partir do HTML pristine, gera o
PDF, e só aí grava `signed_pdf_url`. Deliberado: evita mutar a mesma string duas vezes em sequência,
e evita que uma vista intermédia (assinado pelo trabalhador, ainda não aprovado) mostre a tag
`{admin_stamp}` como texto literal visível.

`document_templates.formato` (`'docx'` default | `'html'`) é o discriminador — qualquer ecrã que
carregue um `worker_documents` ligado a um template tem de o consultar antes de escolher o
componente/branch certo. **Já apanhou 2 sítios que assumiam docx incondicionalmente, os dois só
descobertos ao testar ao vivo, não por build/lint:**
- `WorkerDocuments.jsx`'s `openDoc` — o discriminador antigo `isAcroform` (`!!template_id &&
  !generated_html`) classifica mal um documento html-formato ainda não assinado; teve de ganhar um
  `formato === 'html'` a checar **primeiro**.
- `useDocumentsAdmin.js`'s `openGeneratedPreview` (o "olho" de pré-visualização na lista
  "Documentos" do admin) — tinha `if (!tmpl.template_docx_path) throw new Error('Template sem
  ficheiro .docx')` incondicional, disparando sempre para documentos html-formato. Corrigido com um
  branch antes desse throw, que reaproveita `generated_html` já gravado (ou preenche na hora com
  `replaceTemplateFields` se ainda não assinado) e resolve `{worker_signature}` a partir de
  `signature_data` só para a pré-visualização (sem gravar nada).

**Achado à parte, que custou a maior parte do tempo de depuração:** `DocumentsAdmin.jsx` (o ecrã
"Documentos" da equipa) nunca passava a prop `html` ao `<DocxPreviewModal>` — só `title`/`blob`/
`loading`/`error`. `DocumentTemplatesAdmin.jsx` (ecrã "Templates") já passava `html` correctamente;
os dois consomem o mesmo `DocxPreviewModal.jsx`, que já suportava `html` desde a Fase 3. O sintoma
era um spinner que nunca resolvia, apesar dos logs confirmarem que `setPreview({loading:false,
html,...})` corria e completava — só não chegava ao componente. **Lição: quando dois ecrãs
partilham o mesmo modal mas cada um mantém a lista de props que lhe passa, adicionar uma prop nova
ao modal não a propaga automaticamente — verificar todos os call sites, não só o primeiro testado.**

Verificado ao vivo, ponta a ponta, com `VITE_PDFCO_API_KEY` real (antes vazia — "Sensitive
Environment Variable" do Vercel, irrecuperável por `vercel env pull`, confirmada e resolvida nesta
sessão): trabalhador assina → `generated_html`+`signature_data` gravados, `status=awaiting_admin`,
sem `signed_pdf_url` ainda → admin aprova → PDF real gerado pela PDF.co, assinatura do trabalhador
e carimbo do admin no sítio certo, sem sobreposição — o teste que o Fluxo 2 nunca passava de forma
fiável. Regressão confirmada: "CONTRATO DE TRABALHO" (docx) continua a funcionar sem alteração.

## Bug corrigido — criar trabalhador novo não gravava no Supabase (2026-08-31)

**Sintoma reportado pelo Diego: um novo colaborador criado desaparecia depois de recarregar a
página — parecia gravado (aparecia logo na lista), mas nunca chegava à base de dados.**

**Causa raiz, confirmada contra o schema real:** `vencimento_base` e `subsidio_alimentacao_dia`
são colunas `numeric` em `workers`. `INITIAL_WORKER_FORM` (`TeamContext.jsx:98`) arranca os dois
como `''`. Um trabalhador NOVO cujo admin não visite a aba "Financeiro" antes de gravar chega ao
`upsert` com esses campos ainda `''` — e o Postgres rejeita `''::numeric` (`22P02: invalid input
syntax for type numeric`). Confirmado isoladamente: `select ''::numeric` dá exactamente esse erro.
Ao EDITAR um trabalhador já existente isto nunca disparava, porque o formulário vem pré-preenchido
com valores reais — só um registo genuinamente novo arranca com `''`.

**Por que ficava invisível:** `AppContext.jsx`'s `saveToDb` faz um update optimista do estado local
(`updateState(setWorkers)`) **antes** de chamar o Supabase — por isso o trabalhador aparecia na
lista de imediato. O erro do `upsert` só ia para `console.error`; o `window.alert()` de erro só
disparava para `tableName === 'logs'`, nunca para `'workers'`. O registo só "desaparecia" ao
recarregar, sem nenhum sinal de que a gravação tinha falhado.

**Correcção, em `AppContext.jsx` (`saveToDb`):**
1. No bloco `tableName === 'workers'`, normalizar `vencimento_base`/`subsidio_alimentacao_dia` de
   `''` para `null` antes do `upsert` (a coluna aceita `NULL`, só rejeita string vazia) — corrige a
   causa raiz, o trabalhador passa a gravar mesmo sem a aba Financeiro visitada.
2. `window.alert()` de erro passou a disparar também para `tableName === 'workers'`, não só
   `'logs'` — para esta classe de falha (upsert rejeitado, estado local já optimista) nunca mais
   ficar completamente muda, mesmo que apareça noutro campo no futuro.

Verificado que **não há outro campo com o mesmo risco** neste formulário: as restantes colunas
`numeric`/`integer` de `workers` (`n_dependentes`, `horas_semanais`, `local_trabalho`) não fazem
parte de `INITIAL_WORKER_FORM`, por isso nunca chegam ao payload como `''` — ficam omitidas e usam
o default da coluna. `valorHora` (o outro campo monetário do formulário) é `text` na BD, não
`numeric` — string vazia é um valor válido, sem o mesmo problema.

**Verificado ao vivo, ponta a ponta:** criado um trabalhador de teste ("Teste Fix Numeric Qa") só
com o Nome preenchido, aba Financeiro nunca visitada, gravado, **página recarregada por completo**
— o registo sobreviveu (antes da correcção, teria desaparecido). Apagado a seguir, contagem de
colaboradores voltou ao valor original (28/23 activos). `npx eslint`/`npx vite build` limpos.

## Preview de templates HTML + zoom-to-fit no preview de documento (2026-08-31)

**Pedido do Diego, dois problemas relacionados no mesmo componente partilhado.**

**1. Templates `formato === 'html'` não tinham "Pré-visualizar" nenhum.**
`DocumentTemplatesAdmin.jsx` escondia os botões "Pré-visualizar" (Eye) e "Editar" (Edit3) em bloco
para `t.formato === 'html'` — decisão original fazia sentido para "Editar" (`TemplateEditorModal`
é específico de calibração de carimbo por coordenadas sobre um `.docx`, não existe equivalente para
HTML), mas nunca deveria ter apanhado o "Pré-visualizar" também. Agravado por um segundo bug,
independente: `openTemplatePreview` já tinha código pronto para o caminho HTML, mas lia
`template.html_content` — campo que **não existe**; a coluna real, confirmada noutros dois
consumidores (`useDocumentsAdmin.js`, `HtmlDocumentViewer.jsx`), é `template.template_html`. Mesmo
que o botão não estivesse escondido, este ramo nunca teria funcionado. Corrigidos os dois: o botão
"Pré-visualizar" passou a aparecer sempre (só "Editar" continua condicionado a `formato !== 'html'`),
e o campo lido passou a `template_html`. Mostra o template tal como está gravado — tags
`{worker_name}`/`{worker_nif}`/etc. ainda literais — mesmo espírito do preview docx, que também
renderiza o `.docx` em bruto sem resolver campos.

**2. Preview HTML reflui a cada largura de contentor, ao contrário do preview docx.**
`DocxPreviewModal.jsx` é partilhado por dois consumidores — `DocumentTemplatesAdmin.jsx`
("Pré-visualizar" de um template em branco) e `useDocumentsAdmin.js`'s `openGeneratedPreview`
("olho" de um documento já gerado, na lista "Documentos") — por isso a correcção cobre os dois de
uma vez. O ramo docx já tinha exactamente o comportamento pedido ("documento fixo, só muda de
zoom"): `applyFitToWidth` mede a largura natural da primeira página (`firstPage.offsetWidth ||
794`), calcula `scale = min(1, larguraDisponível / larguraNatural)` e aplica
`transform: scale(...)` a um wrapper com `ResizeObserver`. O ramo HTML não tinha nada disto — o
`<iframe>` só tinha `width: 100% height: 100%`, por isso o conteúdo (HTML normal, sem paginação)
refluía livremente a cada largura de ecrã diferente, como uma página web comum, não como um
documento fixo.
**Achado ao investigar a largura "certa" a fixar:** os templates HTML não têm nenhuma largura fixa
em CSS — só `@page { size: A4; margin: 0; }`, que é uma regra de impressão sem efeito nenhum no
ecrã (só importa quando a PDF.co converte para PDF). Confirmado directamente no `template_html`
gravado dos 2 templates reais (Termo de Responsabilidade EPI, Consentimento RGPD): sem
`width`/`max-width` em px nem mm em lado nenhum. Decisão: usar **794px** como largura de
referência — o mesmo valor já usado como fallback no ramo docx (`|| 794`), consistente com A4 a
96dpi, sem precisar de inventar um segundo valor de referência no mesmo ficheiro.
**Mecanismo implementado, mesma lógica do docx adaptada a HTML** (que não é paginado, ao contrário
do docx-preview, por isso a altura não é conhecida à partida): o `<iframe>` fica com largura fixa
`794px` e altura NATURAL (não escalada) — medida via `iframe.contentDocument.documentElement.
scrollHeight` depois do `load` do `srcDoc` (com 1123px de fallback, altura A4 a 96dpi, caso a
medição falhe) — e um `<div>` wrapper à volta é que recebe `transform: scale(...)` +
`width`/`height` explícitos já escalados, com `ResizeObserver` a reaplicar o fit quando o
contentor muda de tamanho. Mesma separação já usada no docx: o elemento com o conteúdo real fica
sempre ao tamanho natural, só a caixa à volta é que encolhe.
**Verificado ao vivo, três larguras (420px/628px/1400px):** a 1400px o documento mostra a
`scale(1)` (tamanho real, sem ampliar além do natural); a 628px (largura por omissão do painel)
`scale(0.7317)`; a 420px `scale(0.4887)` — a proporção/leiaute mantém-se sempre idêntica, só o
tamanho muda, confirmado visualmente nas três capturas. `npx eslint`/`npx vite build` limpos (os
2 avisos que aparecem são pré-existentes, confirmados por `git stash` antes de editar).

**Extensão no mesmo dia — pedido do Diego "fazer o mesmo em todos os previews de todos html".**
Primeiro apliquei a mesma correcção a `HtmlDocumentViewer.jsx` (o visualizador real onde o
trabalhador assina, `w-full h-full` sem fit nenhum — mesmo sintoma do `DocxPreviewModal.jsx`, só
que aqui o documento é o legítimo, não uma pré-visualização). Ao ir à terceira ocorrência
(`WorkerDocuments.jsx`), a lógica já ia na 3ª cópia quase idêntica — extraída para
**`src/components/common/FitToWidthHtmlFrame.jsx`**, componente partilhado (outer scrollável +
wrapper com `transform:scale()` + iframe a tamanho natural + `ResizeObserver`), e os dois sítios já
feitos (`DocxPreviewModal.jsx`, `HtmlDocumentViewer.jsx`) foram refactorizados para o usar em vez
de manter a lógica duplicada — confirmado ao vivo depois do refactor, sem regressão (mesmos valores
de `scale`/`width`/`height` medidos antes e depois).
**Levantamento de TODOS os `srcDoc=` da app antes de decidir onde aplicar** (`grep -rn
"srcDoc=" src`) — 5 sítios ao todo, só 3 são conteúdo HTML real (sujeito ao problema de refluxo);
os outros 2 são renderizações de PÁGINAS DE PDF via `renderPdfToSrcDoc` (uma imagem/canvas do PDF
embrulhada em HTML só para contornar incompatibilidades de motor), que **não refluem** — esticar o
iframe só corta/escala a vista, não reflui texto nenhum, e os componentes irmãos no mesmo sítio
(`<img>` com `object-contain`, `<iframe src=...&view=FitH>`) já seguem deliberadamente a filosofia
"encaixa nesta caixa", não "documento a tamanho real com zoom" — aplicar a largura fixa A4 aqui
seria incorrecto (nem todos os PDFs digitalizados são A4) e inconsistente com os irmãos. Deixados
de fora, por decisão, não por esquecimento:
- `WorkerDocuments.jsx` — `previewSrcDoc` (PDF renderizado, mesmo ficheiro onde a 3ª correcção
  real foi aplicada, no ramo `generated_html` a seguir).
- `WorkerDocsFolderView.jsx:275` — `content.type === 'srcDoc'` (mesma origem, `renderPdfToSrcDoc`).
**3º sítio corrigido de facto:** `WorkerDocuments.jsx`, ramo `selectedDoc.generated_html` (fluxo
legado de assinatura docx, pré-visualização dentro do modal "Assinar Documento") — usa
`FitToWidthHtmlFrame` com `sandbox="allow-scripts"` (preservado do original, precisa de correr o
`injectSignaturePlaceholder`) e `containerClassName` ajustado para caber no `overflow-hidden` já
existente do cartão pai. **Ficheiro sensível, tratado com cuidado extra**: `WorkerDocuments.jsx` já
tinha um `canvasRef`/`applyFitToWidth` documentado como frágil (traço de assinatura distorce se o
layout do pai mudar) — confirmado antes de editar que esse mecanismo vive noutro componente
(`DocumentViewer.jsx`) e noutra área da árvore, sem overlap com o iframe tocado aqui.
`npx eslint`/`npx vite build` limpos nos 4 ficheiros (`FitToWidthHtmlFrame.jsx` novo,
`DocxPreviewModal.jsx`/`HtmlDocumentViewer.jsx` refactorizados, `WorkerDocuments.jsx` editado).

## Carimbo Opção E + validação de assinaturas (2026-08-31)

**Pedido do Diego, em duas partes: primeiro um visual de carimbo/assinatura mais profissional
(iterado em artefacto, 3+2 opções — A/B/C, depois D/E após feedback), escolhida a Opção E ("Cartão
Digital"); depois, explicitamente, "planeje uma maneira de validar as assinaturas" — o código de
verificação do mockup era só decorativo até aqui.**

**Investigação prévia do mecanismo já existente (Fluxo 2, `VerificationPortal.jsx`) encontrou uma
fraqueza de segurança real, deixada de fora deste trabalho por decisão — não foi pedido mexer no
Fluxo 2:** a página pública expõe IP, a imagem da assinatura em bruto e um link direto ao PDF sem
autenticação; `client_approvals.id` é uma string previsível/enumerável (ao contrário do UUID
aleatório de `worker_documents`); RLS está efectivamente desligado nas duas tabelas envolvidas; sem
rate-limiting em lado nenhum. Registado como pendência de segurança à parte, não corrigido.

**Decisões do Diego (via `AskUserQuestion`), que moldaram o desenho do mecanismo novo:**
- Página pública de verificação mostra o **mínimo**: "✓ Documento autêntico" + tipo de documento +
  nome do trabalhador + data/hora de assinatura + data de aprovação. Nunca IP, nunca a imagem da
  assinatura, nunca um link directo ao PDF.
- "Código de verificação" é um **código curto novo** (`<3 iniciais>-<4 caracteres aleatórios>`,
  alfabeto sem `0/O`/`1/I`), gerado e gravado no momento da aprovação — não um UUID reaproveitado.

**Esquema (migração `add_document_verification_code`):** `worker_documents.verification_code TEXT
UNIQUE` + função `get_document_verification(p_code)` — `SECURITY DEFINER`, devolve só 4 colunas
(`document_title`, `worker_name`, `signed_at`, `admin_signed_at`). A fronteira de segurança real é
esta lista de colunas explicitamente estreita, não RLS (que está efectivamente desligado nas
tabelas relacionadas, ver acima) — uma coluna nova em `worker_documents` não passa a aparecer aqui
por engano, é preciso adicioná-la de propósito.

**Geração do código — `src/utils/verificationCode.js`** (`generateUniqueVerificationCode`): iniciais
do nome (até 3 letras) + 4 caracteres aleatórios de um alfabeto de 32 símbolos sem ambíguos, com
até 5 tentativas de retry em caso de colisão (checado por `select` real à coluna, não confiado só à
entropia). Chamada em `useDocumentTemplates.js`'s `handleApproveDocument`, dentro do branch
`formato === 'html'`, no mesmo ponto onde `{admin_stamp}` já era resolvido — junta-se
`{verification_code}`/`{verification_qr}` (QR opcional, `QRCode.toDataURL` do pacote `qrcode`, já
usado por `useSignatureStamp.jsx` no Fluxo 2, apontando para a nova página) na mesma passagem de
`.replace(...)`, e `verification_code` é gravado no mesmo `update` que já grava `signed_pdf_url`.

**Bloco de assinatura — `.sign-block` antigo (linha simples + legenda) substituído por dois
cartões lado a lado (Opção E) nos 2 templates HTML já em produção** (Termo de Responsabilidade EPI,
Consentimento RGPD — `UPDATE` directo ao `template_html`, mesmo mecanismo de layout `display:
table`/`table-cell` já usado, só o conteúdo de cada célula mudou): aba de cor no topo (laranja
`#EB8D00` trabalhador, navy `#1B3A57` admin), área de assinatura, nome, "ID verificação:
{verification_code}" — o MESMO código nos dois cartões, não dois códigos diferentes (é um único
documento). Cartão do admin leva QR + uma marca de água do logótipo real
(`public/icon-192x192.png`/`icon-512x512.png` — **confirmado, por hash SHA-256, que os dois
ficheiros são bit-a-bit idênticos**, apesar dos nomes sugerirem tamanhos diferentes; redimensionado
com `sharp` para 160×160 antes de embutir, 13,6KB em vez dos ~150KB do PNG original, `opacity:
0.06`). Cores fixas (não `var(--...)`) — é HTML gerado para PDF via PDF.co, sem tema possível, mesma
razão já documentada para o resto do template.

**Nova página pública — `src/components/common/DocumentVerificationPortal.jsx`**, montada em
`app.jsx` num `?view=verify-doc&code=...` novo (distinto do `?view=verify&id=...` do Fluxo 2, para
não colidir) — RPC `get_document_verification`, sem sessão, render minimalista com os 4 campos
acordados. Não reaproveita `VerificationPortal.jsx` de propósito (esse expõe dados a mais, ver
acima).

**Achado de execução, não relacionado com o pedido — reportado, não corrigido:** o `useEffect` de
`app.jsx:302-309` (`if (location.pathname === '/' || location.pathname === '') { ... else
navigate('/login', {replace:true}) }`) corre uma vez ao montar e **quebra qualquer rota pública por
`?view=...` acedida na raiz nua do domínio** (`/?view=verify-doc&code=...` redirecciona para
`/login`, perdendo a query string por completo, página em branco) — afecta também o `?view=verify`
do Fluxo 2, não é regressão desta sessão. Não é visível em uso real porque `buildVerifyUrl`/
`buildVerifyDocUrl` constroem o link a partir de `window.location.pathname` **no momento da
aprovação** (tipicamente `/admin/documentos`, nunca `/`), por isso o link real gerado nunca pisa
este caso — só apareceu ao testar manualmente com a raiz nua. Confirmado ao vivo:
`/admin/documentos?view=verify-doc&code=...` funciona perfeitamente; `/?view=verify&id=...`
(Fluxo 2, código já existente, não tocado nesta sessão) quebra da mesma forma. Fica registado como
pendência — não corrigido por ser um efeito partilhado por toda a navegação da app, fora do âmbito
do pedido.

**Verificado ao vivo, ponta a ponta, com dados reais:** criado um `worker_documents` de teste
(`status: 'awaiting_admin'`, HTML preenchido via `replaceTemplateFields` a partir do template real)
para um trabalhador existente (Adriel de Jesus dos Santos) → aprovado através do botão real
"Aplicar carimbo" em `/admin/documentos` (Por categoria, filtro "Aguarda aprovação") → confirmado
`verification_code: "ADJ-8KRW"` gerado e gravado, `status: 'signed'`, `signed_pdf_url` real → PDF
descarregado e inspeccionado: os dois cartões renderizam correctamente com dados reais, mesmo
código nos dois, QR visível no cartão do admin, assinatura real do admin (Diego Barbosa — Gerente)
no sítio certo, sem sobreposição de texto (a assinatura do "trabalhador" aparece como ícone
quebrado só porque a imagem de teste usada era um base64 inválido, não uma falha do mecanismo) →
página pública em `/admin/documentos?view=verify-doc&code=ADJ-8KRW` mostra exactamente os 4 campos
acordados, sem IP/assinatura/PDF → código inexistente (`XXX-0000`) mostra "Código não encontrado"
sem vazar nada → "CONTRATO DE TRABALHO" (Fluxo 2, docx) não tocado, fora do âmbito. Dados de teste
limpos no fim (registo apagado, PDF removido do storage). `npx eslint`/`npx vite build` limpos.

**Achado à parte, sem relação com este pedido — corrigido no mesmo lote por o utilizador ter
reportado ao vivo durante os testes:** `OnboardingPendentes.jsx` (o modal "Rever" de
`/admin/team` → Pendentes) era o único, de 6 consumidores de `ModalShell` no módulo `team`, sem o
wrapper `p-6` que todos os outros usam à volta do conteúdo do corpo — confirmado por medição real no
browser (`getBoundingClientRect`): a grelha "Editar campos se necessário" media `left: 0, right:
375` (colada às duas bordas do modal, viewport mobile 375px), sem respiro nenhum antes do rodapé
fixo — lia-se como conteúdo cortado/mal dimensionado, exactamente o sintoma reportado. Corrigido
trocando `className="space-y-5"` por `className="p-6 space-y-5"` no wrapper do corpo (linha ~290) —
mesma convenção confirmada em `WorkerValorHoraHistoryModal.jsx`/`DocumentScannerModal.jsx`.
Verificado ao vivo, antes/depois, com o mesmo pedido pendente real: grelha passou a `left: 23, right:
353`, alinhada com o resto do conteúdo; "Tabela IRS"/"Dependentes" (a última linha, antes colada ao
rodapé) ficaram com espaço normal acima dos botões. `npx eslint` limpo.
**Achado à parte, não corrigido — descoberto ao reproduzir o bug acima:** o banner de notificações
global (`app.jsx:490-514`, `z-[9999]`, fixo no topo) fica **acima** de qualquer modal
(`ModalShell` usa no máximo `z-300`, ver `Z` em `ModalShell.jsx`) — com notificações pendentes reais,
o cabeçalho de qualquer modal aberto (incluindo o botão de fechar) fica coberto até serem
dispensadas. Não é o que o Diego reportou (o screenshot dele não tinha banners visíveis), mas é um
problema real, à parte, tocando um z-index partilhado por toda a app — fica registado, não corrigido
de passagem.

## Correções pós-implementação do Carimbo Opção E (2026-08-31)

**Feedback do Diego com screenshots do PDF real gerado** — três bugs concretos + um pedido de novos
modelos visuais, todos no mesmo lote:

1. **Assinaturas de tamanhos diferentes** — `useDocumentTemplates.js` `handleApproveDocument` (branch
   `formato === 'html'`) tinha `max-width:220px;max-height:90px` para `{worker_signature}` e
   `max-width:180px;max-height:80px` para `{admin_stamp}` — limites diferentes, por isso a assinatura
   do trabalhador podia sair visivelmente maior. Unificados os dois para `max-width:180px;
   max-height:64px`.
2. **Botão "Aplicar carimbo" inacessível em mobile** — `docBadges.jsx`'s `CompactDocRow` (partilhado
   por `CategoryWorkerGrid.jsx` e `WorkerDocsFolderView.jsx`) revelava as ações (categoria/pré-visualizar/
   aprovar/apagar) só com `hidden group-hover:flex` — sem `:hover` real em touch, ficavam
   permanentemente escondidas. Corrigido para `flex md:hidden md:group-hover:flex` — sempre visíveis
   abaixo de `md`, hover-reveal a partir daí. Confirmado ao vivo em 375px.
3. **"Entidade Patronal" vazia** — o campo usava `{client_name}` (o cliente onde o trabalhador está
   destacado), que fica vazio sempre que o trabalhador não tem cliente atribuído — e nem seria
   correcto quando tem: numa cedência de mão-de-obra a entidade patronal legal é a Magnetic Place, não
   o cliente. Trocado para `{company_name}` no template EPI (via `UPDATE` directo ao `template_html`,
   mesmo mecanismo já usado para o resto desta migração) — confirmado por grep que o template RGPD não
   tem este campo, não precisou de alteração.
4. **Pedido de modelos alternativos** — Diego mostrou o carimbo antigo (`ValidationStamp`, Fluxo 2:
   um cartão só, miniatura da assinatura + linhas Nome/Data-Hora/IP/ID + rodapé verde "documento
   validado eletronicamente", indigo) como referência de densidade. Gerados 3 modelos novos (C/D/E')
   no mesmo artefacto (`stamp_style_comparison.html`, já tinha "hoje"/A/B de uma ronda anterior) —
   réplica fiel da estrutura do carimbo antigo, mas em navy/laranja (não indigo, que é resíduo de
   template, não identidade real): C (empilhado), D (lado a lado), E' (um cartão só, as duas partes
   como sub-linhas, cabeçalho/rodapé partilhados). Nenhum aplicado ainda — Diego ainda não escolheu.
   `npx eslint`/`npx vite build` limpos nos 2 ficheiros de código (`useDocumentTemplates.js`,
   `docBadges.jsx`); a correcção do template foi só dados (SQL), sem ficheiro para lint.

## Carimbo Opção D aplicado aos 3 templates reais (2026-09-01/02)

**Diego escolheu a Opção D** (réplica do carimbo antigo, cartões lado a lado) do
`stamp_style_comparison.html` — iterada extensivamente via comentários no artefacto antes de "implementa
nos 2 templates reais": proporção "4x2" dos campos (grelha 2x2 → depois "Nome" a ocupar a linha toda),
caixa da assinatura ("swatch") aumentada progressivamente 96×48 → 128×64 → 160×80 (sempre 2:1), marca de
água (logo+carimbo, técnica de duas camadas desalinhadas já usada na aba WhatsApp) movida do `.doc-frame`
(onde ficava invisível, tapada pelo fundo opaco dos cartões) para dentro do próprio fundo de cada cartão,
e por fim título do cartão do admin trocado de "MAGNETIC PLACE" para "EMPRESA". Cada uma destas mudanças
foi pedida via comentário no artefacto e verificada ao vivo (screenshot + medição real do DOM) antes da
seguinte — nenhuma foi aplicada às cegas.

**Migração do bloco de carimbo em produção — `document_templates.template_html` dos 2 templates HTML
(Termo de Responsabilidade EPI `0d31f4e0-...`, Consentimento RGPD `6d74447e-...`).** O bloco antigo
(`.sign-block-e`/`.sign-card-*`: aba de cor + assinatura + nome + código, cartão único por pessoa, sem
grelha de campos, marca de água só no cartão do admin como imagem única no canto) foi substituído pelo
novo (`.stamp-row`/`.stamp-card-*`: cabeçalho com check+título, swatch 160×80, grelha Nome(linha
inteira)/Data-Hora/ID, rodapé com QR no cartão do admin, marca de água de duas camadas em ambos os
cartões). Método usado, não SQL manual: script Node local (`@supabase/supabase-js`, credenciais do
`.env` do próprio repo) que buscou o `template_html` completo (~165KB, insere real do PDF.co com
letterhead/rodapé embutidos em base64) para ficheiro local, aplicou a substituição por âncoras de texto
exactas (`.sign-block-e {` → `.footer {` para o CSS; `<div class="sign-block-e">` → `<div
class="footer">` para o HTML) e gravou de volta — evita transcrever à mão os ~16KB de base64 da marca de
água (extraídos do próprio `stamp_style_comparison.html`, mesmas imagens já verificadas no artefacto) ou
arriscar truncagem ao mover um ficheiro deste tamanho pela conversa.

**Placeholders novos, resolvidos só na aprovação do admin (`handleApproveDocument`, mesmo ponto onde
`{admin_stamp}`/`{verification_code}` já eram resolvidos) — não existiam campos de data/hora no
carimbo antigo:** `{signed_datetime}` (a partir de `doc.signed_at`, gravado quando o trabalhador assina)
e `{admin_signed_datetime}` (a partir de `adminSignedAt`, calculado no momento da aprovação) — novo
`formatDateTimePT()` local em `useDocumentTemplates.js`, formato `DD/MM/AAAA HH:MM`, sem biblioteca de
datas. Ficam por resolver enquanto o documento está só assinado pelo trabalhador (`generated_html`
grava os placeholders ainda literais — `HtmlDocumentViewer.jsx` não precisou de alteração, resolve tudo
de uma vez na aprovação, mesmo padrão já usado para `{verification_code}`).

**Simplificação decidida no mesmo lote:** a Opção D já mostra "MAGNETIC PLACE UNIPESSOAL LDA" fixo como
Nome do cartão do admin — o parágrafo com `companySignature.responsibleName` (quem assinou de facto, ex.
"Diego Barbosa — Gerente") que o código antigo injetava dentro da área de assinatura deixou de ser
impresso. Não é perda acidental: é a mesma decisão já tomada e confirmada no artefacto (thread
`bfe5bfd2`, "Feito — o cartão do admin... mostra 'MAGNETIC PLACE UNIPESSOAL LDA'"), agora aplicada em
produção. Dimensão das imagens de assinatura (`{worker_signature}`/`{admin_stamp}`) ajustada de
`max-width:180px;max-height:64px` para `126×65` (cabe no novo swatch de 160×80 com a margem que a Opção
D usa). Classe do QR trocada de `sign-qr` para `stamp-qr`, a acompanhar o resto da renomeação de classes.

**Verificado, não verificado — para o registo, não é o mesmo nível de confirmação dos lotes anteriores
do Fluxo 3.** Confirmado ao vivo: os 2 templates renderizam corretamente com dados de teste (ficheiro
local, não pelo fluxo real), a 900px de largura (aproxima a página A4 real que o PDF.co usa — a
`FitToWidthHtmlFrame`/preview do browser normal é mais estreita e dá falso alarme de quebra de layout,
como aconteceu na primeira tentativa a ~600px) — marca de água visível nos dois cartões, campos
Nome/Data-Hora/ID legíveis, QR (placeholder) no rodapé do admin, título "EMPRESA" a substituir "MAGNETIC
PLACE". **Não foi feito o teste ponta-a-ponta real desta vez** (assinar como trabalhador → aprovar como
admin → confirmar `{signed_datetime}`/`{admin_signed_datetime}` resolvidos correctamente no PDF real
gerado pela PDF.co) — os lotes anteriores desta funcionalidade sempre fecharam com esse teste real;
fica como pendência explícita antes de confiar cegamente no próximo documento real assinado. `npx
eslint` limpo em `useDocumentTemplates.js`; `npx vite build` completo do projeto também limpo (só os
avisos de chunk grande, pré-existentes, sem relação).

**Extensão no mesmo dia — "CONTRATO DE TRABALHO" (Fluxo 2, docx/pdf-lib) convertido para o mecanismo
novo, revertendo a decisão registada acima de o deixar de fora.** Pedido explícito do Diego ("converter
todos os templates em html"). Levantamento antes de mexer: 4 templates ao todo — os 2 já feitos (EPI,
RGPD), o Contrato (docx real, `template_docx_path` preenchido, `template_fields` com os 10 campos já
usados), e um quarto, "Registo de Informações sobre Riscos no Local de Trabalho" — sem `.docx` nenhum,
guarda conteúdo numa coluna diferente (`html_content`, não `template_html`) e a descrição menciona
"Trabalhador Virtual" (o agente de WhatsApp, repo `CONSELHEIRO-ESTRATEGICO`, separado). **Deixado de
fora, por decisão do Diego** — não encaixa no mecanismo Fluxo 2/3 desta app, parece pertencer a outro
sistema; não investigado a fundo.

Conteúdo do Contrato extraído do `.docx` real via `mammoth` (`convertToHtml`/`extractRawText`, já uma
dependência do projeto) — não reescrito à mão, para não arriscar alterar cláusulas de um documento
legal. **Achado real da extração, não hipotético:** a Cláusula 4.ª usava uma lista numerada nativa do
Word (`<ol>`) cujo texto capturado vinha como "º – ..." em vez de "1º – ...", porque o número em si é
formatação automática do Word, não texto — só visível ao comparar `extractRawText` (perdia o número)
com `convertToHtml` (preservava a estrutura `<ol><li>`). Reconstruído como `<ol class="declara">` real
(a mesma classe já usada para a lista de declarações do EPI) — os números voltam a aparecer certos.
Resto do texto (9 cláusulas, todos os campos) mantido literal, só reformatado com o mesmo CSS/letterhead
já estabelecido para EPI/RGPD (reutilizado tal e qual, incluindo o logótipo em base64 — confirmado que é
a mesma imagem que já vinha embutida no próprio `.docx` original) e o mesmo bloco de carimbo Opção D no
fim. **Confirmado com o Diego antes de gravar** — mostrado o HTML preenchido com dados de teste (ficheiro
enviado + screenshots) antes de qualquer escrita em produção, ele confirmou fidelidade do texto e da
correção da Cláusula 4.ª antes do "pode gravar". `document_templates.formato` mudou de `'docx'` para
`'html'`; `template_docx_path`/`stamp_x`/`stamp_y`/`stamp_admin_x`/`stamp_admin_y` (coordenadas do
Fluxo 2 antigo) ficaram na BD, não apagados — inofensivos e não lidos por nada assim que `formato` muda
(confirmado no código: `useDocumentTemplates.js` só entra no ramo docx/pdf-lib quando
`formato !== 'html'`), mantidos por reversibilidade.

**Ajuste de layout, pedido logo a seguir (com screenshots do documento gerado):** o rótulo "Assinatura
validada eletronicamente"/"Aprovação validada eletronicamente" vivia dentro de cada cartão (um por
pessoa) — Diego pediu para passar a **uma linha só, por baixo dos dois cartões, incluindo por baixo da
própria área de assinatura**. Removidos os dois rótulos individuais (e o `<div class="stamp-foot">` do
admin, que os envolvia junto com o QR), acrescentada `.stamp-note` nova — uma faixa de largura toda,
fora de `.stamp-row`, com o texto único "Documento assinado e aprovado eletronicamente" + o QR (que
manteve a mesma posição relativa, só mudou de contentor). Aplicado aos **3** templates de uma vez (EPI,
RGPD, Contrato) já que os três partilhavam o bloco de carimbo idêntico — script Node fez a mesma
transformação de string nos três, verificado ao vivo antes de gravar. Método de execução, igual ao dos
lotes anteriores desta sessão: scripts Node locais com `@supabase/supabase-js` (credenciais do próprio
`.env`) para buscar/gravar o `template_html`, nunca SQL manual com o HTML/base64 colado na conversa —
evita tanto transcrever à mão dezenas de KB de HTML como o risco de truncagem a mover ficheiros deste
tamanho pela sessão.

**Investigação de uma "distorção" no carimbo real — achado: a caixa não estava distorcida, a imagem
lá dentro é que não enchia o espaço.** Diego reportou que a proporção da caixa de assinatura no PDF
real parecia mais quadrada do que nos testes locais (screenshots comparando os dois). Antes de mexer
às cegas, medi a caixa real: baixei o PDF assinado que o Diego anexou e extraí as coordenadas
vectoriais dos rectângulos desenhados (`pdfjs-dist`, `page.getOperatorList()`, filtrando
`OPS.constructPath` e lendo `args[2]`, a bounding box já calculada) — sem precisar de `poppler`/
`canvas` para rasterizar, que não estavam disponíveis. **Resultado: a caixa mede 159×79pt na página
real (ratio 2,013), praticamente os 160×80 exactos do CSS — não há distorção nenhuma na caixa.**
Confirmado também que a página inteira é renderizada pelo PDF.co a 794×1123px (96dpi, A4) e só depois
escalada uniformemente para os 595,9×842,9pt do PDF final (factor ~0,75 nos dois eixos, idêntico) —
descartada a hipótese de "fit to page" a esticar um eixo mais do que o outro.
**A causa real era outra:** o `<img>` da assinatura só tinha `max-width`/`max-height` — sem
`object-fit`, o browser preserva sempre a proporção NATIVA da imagem (do `<canvas>` onde a pessoa
assinou), não a da caixa. Uma assinatura alta/emaranhada (traço real de punho, ao contrário do SVG de
teste, sempre uma onda larga e baixa) ficava limitada pela altura, sem nunca preencher a largura —
dava a ILUSÃO de caixa mais quadrada, mas a caixa em si media sempre 160×80. Corrigido para
`width:100%;height:100%;object-fit:contain` — a imagem passa a "dar zoom" para preencher o máximo da
caixa fixa, mantendo a sua proporção própria sem distorcer (exactamente o pedido do Diego: "mudando
somente o zoom se for necessário"). Verificado com duas assinaturas de teste de proporção oposta
(uma larga/baixa, uma alta/emaranhada) — cada uma passou a preencher o eixo que a limita, sem
esticar. Aplicado aos 3 templates (`.stamp-swatch img`) e ao código (`useDocumentTemplates.js`, os
dois `.replace` de `{worker_signature}`/`{admin_stamp}`).

**Pedido relacionado, mesmo lote — pré-visualizações dos templates HTML (`FitToWidthHtmlFrame.jsx`,
partilhado por `DocxPreviewModal.jsx`/`HtmlDocumentViewer.jsx`/`WorkerDocuments.jsx`) também sem
proporção A4 fixa.** Media a altura do iframe a partir do `scrollHeight` real do conteúdo — um EPI
curto e um Contrato mais longo davam alturas de "página" diferentes na pré-visualização, proporção
que nunca bate com o PDF real (sempre páginas A4 inteiras, 794×1123px a 96dpi). Corrigido para altura
fixa (`A4_HEIGHT_PX = 1123`, ao lado do já existente `A4_WIDTH_PX = 794`) — a lógica de
`scrollHeight`/evento `load` do iframe deixou de ser necessária, removida por inteiro; conteúdo mais
alto que uma página ganha scroll próprio dentro do iframe (comportamento nativo, sem código extra),
em vez de esticar a proporção da "folha". Verificado com uma réplica isolada da mesma lógica (dois
contentores de larguras diferentes, um documento curto e um longo simulado por repetição de texto) —
proporção 0,7070–0,7071 (A4 exacta, 1/√2) nos dois casos, confirmado por medição real do DOM, não só
visual. Não foi possível verificar dentro da própria app (sessão de admin sem credenciais disponíveis
nesta sessão) — a réplica isolada usa exactamente o mesmo algoritmo (`ResizeObserver` + `transform:
scale()` sobre um wrapper de tamanho fixo), não uma aproximação.
`npx eslint`/`npx vite build` limpos nos 2 ficheiros de código.

**Pedido a seguir, mesmo dia — o cartão do carimbo ainda não tinha proporção fixa, só a caixa da
assinatura tinha.** `.stamp-card` usava `flex:1` para a largura (já efectivamente fixa, dado que a
página em si já está fixa em 794px) mas a ALTURA vinha do conteúdo — um nome mais comprido
("MAGNETIC PLACE UNIPESSOAL LDA", ou um nome de trabalhador longo) envolvia o campo "Nome" para 2
linhas, esticando o cartão; um nome curto dava um cartão mais baixo. Confirmado ao vivo, à largura
real de 794px (não a 900-1000px como as rondas anteriores desta sessão — daí "perdeu as medidas
boas", a proporção nunca tinha sido validada à largura verdadeira da página) antes de mexer.
Corrigido: `.stamp-card` ganhou `height: 128px` fixo (`box-sizing:border-box`, `align-items:center`
em vez de `stretch`, já que a altura deixou de vir do conteúdo) e o valor de cada campo
(`.stamp-field .v`) ganhou `white-space:nowrap;overflow:hidden;text-overflow:ellipsis` — um nome
demasiado comprido para uma linha trunca com "…" em vez de esticar o cartão. Decisão aceite como
trade-off: o carimbo é um selo, não a fonte primária do nome — esse já consta por extenso no corpo
do documento (tabela de campos no topo, no caso do EPI/RGPD; parágrafo de identificação, no
Contrato). Verificado com um nome de teste deliberadamente longo ("Maria Alexandra Ferreira dos
Santos Oliveira") — trunca para "Maria Alexandra Fer…", cartão mede exactamente 326,5×128px
(ratio 2,551) nos dois cartões, idêntico independentemente do conteúdo. Aplicado aos 3 templates.

**Duas correcções finais, mesmo dia — "ainda está ruim" do Diego, depois de reduzir a caixa da
assinatura para 128×64.** Nenhuma das duas era bug de código a sério, mas o resultado visual real
era mesmo inconsistente:
1. **`.stamp-swatch` não tinha `overflow:hidden`.** Isto só se via a olho na pré-visualização de um
   template ainda por preencher (`{worker_signature}`, 19 caracteres, vs `{admin_stamp}`, 13) — sem
   dados reais, é texto literal dentro da caixa, e sem `overflow:hidden` esse texto ultrapassava os
   limites da caixa de forma diferente consoante o comprimento, dando a ilusão de caixas de tamanhos
   diferentes mesmo com CSS idêntico (confirmado, medido: as duas caixas mediam sempre 128×64,
   mesmo nesse estado — o problema era só visual/overflow, não a medida real). Corrigido:
   `overflow:hidden` + `font-size:8px; color:#94A3B8;` no placeholder (texto pequeno e discreto
   quando não há assinatura real, nunca ultrapassa a caixa).
2. **`.page` nunca teve `width` próprio — só `padding`.** Funcionava por acaso sempre que via
   `FitToWidthHtmlFrame` (que força o iframe a 794px), mas fora desse contexto (documento aberto
   directamente, sem o wrapper) a página esticava para preencher o que estivesse à volta, tornando a
   proporção de todo o carimbo dependente de quem o mostra, não do documento em si — exactamente o
   pedido do Diego ("quero todos os templates fixos na largura do a4"). Corrigido: `.page` ganhou
   `width:794px; margin:0 auto; box-sizing:border-box` — confirmado ao vivo que a 1200px de janela
   (bem mais larga que o normal) a página continua a medir exactos 794px, centrada, sem esticar.
   Sem efeito no PDF real: já estava confirmado por extracção vectorial (ver acima) que o PDF.co
   renderiza a exactos 794×1123px, por isso este `width` não muda nada aí — só passa a proteger
   todos os outros contextos (abrir o HTML em bruto, por exemplo) da mesma forma.
Aplicado aos 3 templates, verificado ao vivo nos dois estados (por preencher e preenchido).

**Tamanho final da caixa da assinatura, pedido directo do Diego: 107×77px** (`.stamp-swatch`),
substituindo a progressão anterior (96×48 → 128×64 → 160×80 → 128×64). Confirmado por medição real
no DOM nos 3 templates, idêntico nos dois cartões.

**Marca de água trocada de "duas camadas desalinhadas" (técnica WhatsApp) para tabuleiro de xadrez
real, a pedido explícito do Diego ("que fique como um tabuleiro de xadrez, xoxoxoxoxo /
oxoxoxoxox").** A técnica anterior (`::before`/`::after`, cada um com o seu próprio tile/offset,
propositadamente desalinhados para os dois padrões "derivarem um do outro") deixou de bater com o
pedido — ele queria alternância verdadeira, não sobreposição. Como CSS não tem primitivo para
alternar duas imagens *diferentes* num tabuleiro (o truque habitual com `linear-gradient` só serve
para cores sólidas), gerada uma única imagem composta com `sharp` (`.composite()`), fora do browser:
canvas 64×64 transparente, cada imagem redimensionada para 32×32 (metade do tile anterior — "as
imagens que estão a metade do tamanho que estão", outro pedido explícito no mesmo comentário) com
`fit:'contain'` sobre fundo transparente, coladas nas 4 posições em xadrez (logo/carimbo/carimbo/
logo — cantos opostos iguais). O resultado é UMA imagem só, aplicada como `background-image` num
único `::before` com `background-size:64px 64px; background-repeat:repeat` — mais simples que os
dois layers antigos (menos CSS, ficheiro ~5% mais leve) e visualmente correto: confirmado com uma
réplica isolada a opacidade alta (0.4, depois a opacidade real de produção 0.07) que o padrão
alterna mesmo em xadrez, não em grelha simples. Aplicado aos 3 templates, mesma imagem partilhada
entre os três (sem precisar de gerar uma por template).

## Redesenho do cartão de colaborador — `WorkerList.jsx` (2026-08-31)

Mesmo fluxo de sempre: mockup em artefacto (`equipa_redesign.html`, dados reais dos colaboradores
visíveis no screenshot do Diego) → aprovado com "implemente" → implementado directamente no
componente real (ao contrário do Carimbo/Documentos, aqui não houve intermediário de HTML estático a
copiar — o mockup só serviu para validar a direcção, o código foi escrito de raiz sobre a estrutura
JSX já existente). Três mudanças, mantendo exactamente os mesmos dados e acções de sempre:

1. **Menu "⋯" para as acções situacionais.** O cartão chegava a mostrar até 6 ícones sempre visíveis
   (Ver Portal, Editar, Ver Pasta, + até 3 de SS consoante o estado do vínculo, + Eliminar). Ficam 3
   sempre visíveis (Ver Portal, Ver Pasta, Editar — por esta ordem, a mesma do carimbo/dropdown da
   vista de lista) e as de SS (Comunicar Admissão/Cessação, Alterar Contrato, Transferir Local) +
   Eliminar passam para um menu "⋯", reaproveitando **tal e qual** o mesmo padrão de dropdown
   (`openMenuId`, `fixed inset-0` para fechar ao clicar fora) já usado na vista de lista deste mesmo
   ficheiro — só copiado para o cartão, não inventado de novo. O estado `openMenuId` já existia
   declarado no componente mas só era consumido pela vista de lista; a vista de grade agora também o
   usa.
2. **Anel colorido no avatar.** Extraída a detecção de estado de `vinculoBadge` para uma função nova,
   `vinculoState(w, apoliceMap, ssFlag)` (devolve só `{ ssProblema, apoliceProblema }`, sem construir
   o badge) — `vinculoBadge` passou a chamá-la em vez de duplicar a lógica, e o cartão usa o mesmo
   resultado para pintar a borda do avatar (`var(--ok)` sem problema, `var(--warn)` com problema),
   sem repetir a detecção duas vezes. Avatar subiu de `w-7 h-7` para `w-8 h-8` para dar espaço à
   borda de 2px sem ficar apertado.
3. **Estado consolidado no rodapé.** `vinculoBadge` (SS/apólice) e "Aprovado"/"Por aprovar" (mês
   corrente) eram dois sinais em linhas separadas — passaram para uma só linha `justify-between` no
   rodapé do cartão. O selo "Ativo"/"Inativo" no topo do cartão manteve-se onde estava, de propósito:
   é sobre a conta em si (perfil activo na empresa), não sobre o mês, categoria diferente do resto.
   Os emoji `⏱`/`💼` das linhas de horário/cliente foram trocados por `Clock`/`Briefcase` do
   `lucide-react` (import novo), consistentes com o resto dos ícones do cartão — eram os únicos dois
   emoji do ficheiro, resíduo de antes deste componente ter sido convertido para lucide.

**Pendência sinalizada, não implementada — conflito com uma decisão já registada.** O mockup também
propunha comprimir a faixa "29 · 24 · 5 · 1 · Onboarding pendente" (texto com pontos) para chips com
fundo/borda próprios. Essa faixa não vive em `WorkerList.jsx` — é o prop `stats` de
`SectionHeaderShell` (`TeamManager.jsx:231-240`), o componente partilhado por 19 secções do admin que
o Diego já tinha decidido explicitamente não tocar sem revisão dedicada (ver "Design system (em
migração)" acima). Mudar o visual dos `StatChip` mudaria as 19 secções de uma vez, não só Equipa —
por isso esta parte do mockup **não foi implementada**, fica reportada aqui como pendência para essa
revisão dedicada, não escondida nem decidida sozinho.

Verificado ao vivo em `/admin/team` (vista de grade): anel verde em colaboradores sem problema, anel
laranja em Francisco Wanderlilson Diniz ("Apólice por confirmar" — o mesmo caso já usado como
exemplo no mockup); menu "⋯" abre com "Alterar Contrato"/"Transferir Local de Trabalho"/"Apagar" para
um colaborador com admissão já comunicada à SS; ícones Clock/Briefcase a renderizar em vez dos
emoji. Modo escuro não confirmado ao vivo nesta passagem — forçar `.dark` via JS foi imediatamente
revertido pelo próprio `useEffect` de tema do `AppContext.jsx` (lê `systemSettings.darkMode`, não a
classe DOM directamente), e não foi encontrado o toggle real em Definições a tempo; o par
`var(--ok)`/`var(--warn)` usado na borda do avatar é o mesmo já validado dezenas de vezes ao longo
desta migração, risco considerado baixo. `npx eslint`/`npx vite build` limpos.

## Redesenho da aba Clientes — `ClientManager.jsx` + subtabs (2026-09-01)

Mesmo fluxo já usado na Equipa: mockup em artefacto (`clientes_redesign.html`), iterado em 3 rondas
com o Diego (cartão → "inclua o modal + cartão inteiro clicável" → "inclua as outras subabas
também") antes de "implemente". O cartão de cliente já era mais enxuto que o de colaborador (só 3
ações, nunca teve o problema dos 6 ícones), por isso as mudanças no `ClientManager.jsx` são mais
discretas do que as do `WorkerList.jsx`:

1. **Avatar com iniciais de empresa** (`companyInitials`, novo helper local — **não** o `getInitials`
   partilhado de `textUtils.js`, que é primeira+última palavra, pensado para nomes de pessoa; numa
   empresa a última palavra é quase sempre um sufixo legal tipo "S.L."/"S.A.", que não distingue
   nada — "A&G Steel Building S.L." e "Astilleros Zamakona S.A." dariam as duas "AS" com
   primeira+última. `companyInitials` usa as duas primeiras palavras) substitui o ícone genérico de
   maleta (igual em todos os cartões). Anel `var(--warn)` quando falta NIF/morada ou o modo limitado
   está ativo — mesmo critério e mesma implementação (`border-2`, cor condicional) já usada no anel
   do avatar da Equipa.
2. **"Sem NIF"/"Sem morada"** passam de texto cinzento para `#8a4a00` (o mesmo valor já usado 4+
   vezes nesta migração para texto de aviso, incluindo o "Modo limitado" já existente neste mesmo
   cartão) — os três avisos do cartão ficam visualmente consistentes entre si.
3. **Ícone de histórico** trocado do emoji 📊 para `History` (lucide) — no cartão da grade E no item
   do menu "⋯" da vista de lista (duas ocorrências do mesmo emoji, ambas corrigidas).
4. **O cartão inteiro abre a ficha** (`onClick={() => openEditClient(c)}` no `<Card>`) — antes só o
   lápis "Editar" funcionava, clicar no resto do cartão não fazia nada. A coluna de ações
   (histórico/editar/apagar) ganhou `onClick={(e) => e.stopPropagation()}` para não abrir a ficha
   por engano ao clicar num ícone.
5. **Mesmo avatar acrescentado à vista em Lista** (coluna "Cliente", antes só texto) e às **duas
   outras views que mostram clientes em cartão/linha** — `ClientEnviosPanel.jsx` (grid; a vista de
   lista/tabela dessa aba não mudou, o mockup só propôs a grid) e `ValidacaoMensalPanel.jsx` (linhas)
   — mesmo `companyInitials` copiado localmente para os dois (mesma convenção já usada no projeto:
   `WorkerList.jsx` também tem a sua própria cópia de `getInitials` em vez de importar a partilhada).
   `CorrectionsInbox.jsx` (aba Correções) **não foi tocado** — já tinha sido redesenhado numa sessão
   anterior, já usa o mesmo sistema de tons/avatar; o mockup trazia só uma nota a dizer isso, não uma
   réplica.

**Achado de ferramenta, não do código — os mockups de artefacto com `onclick="..."` inline ficam
mudos, sem erro nenhum.** Ao testar o clique-no-cartão-abre-modal do mockup antes de pedir aprovação,
várias tentativas de clique (via `computer`, coordenadas, `find`+ref) não tinham efeito nenhum,
apesar de o HTML/CSS/JS parecerem corretos. Causa: o artefacto corre num iframe sandboxed com CSP
que bloqueia atributos de evento inline (`onclick="..."`) em silêncio — nem a consola do browser
acusa nada, porque tecnicamente não há erro de JS, o atributo é que nunca é interpretado como
handler. Confirmado copiando o mesmo ficheiro para `public/_scratch_test.html` (servido pelo `vite
dev` local, sem iframe nem CSP do artefacto) — aí os `onclick=` inline funcionavam perfeitamente,
provando que o JS em si estava certo. Corrigido reescrevendo os 5 handlers inline
(`.ccard`/`.qa-btn.edit`/`.modal-box`/`.close`/`.btn.cancel`) para `addEventListener` com delegação
de eventos — **regra a aplicar em qualquer mockup futuro com interatividade real (não só
`innerHTML` estático): nunca usar `onclick=""` inline em HTML gerado para um artefacto, usar sempre
`addEventListener`.**

Verificado ao vivo em `/admin/clients`, com dados reais de produção (13 clientes): anel âmbar em
Astilleros Zamakona (sem NIF/morada) e Caldereria Burdin SLL (idem, achado ao vivo — não estava nos
6 clientes de exemplo do mockup) — confirmado por `getComputedStyle` que Ferrocal Steel Solutions
(modo limitado) também tem `border-color: rgb(217,138,43)` (`--warn`), mesmo não sendo visualmente
óbvio a olho nu num avatar pequeno; clicar em qualquer parte do cartão abre a ficha real com os
dados certos (testado com A&G Steel Building S.L.); clicar no lápis/histórico/apagar não abre a
ficha (stopPropagation confirmado); vista de Lista, Envios (grade) e Validação Mensal — todas com
avatar e dados reais a bater com o que já se sabia do ecrã real. Um quirk pré-existente, não
introduzido por este lote, ficou à vista durante o teste: o indicador de tab ativa do
`SectionHeaderShell` não atualiza ao mudar de "Envios" para "Validação" por navegação
programática — fora de âmbito, não corrigido. `npx eslint`/`npx vite build` limpos nos 3 ficheiros.

## Migração de tokens FT — regras de decisão

Aplicam-se a qualquer lote de conversão Tailwind → tokens `FT`/CSS vars (`designTokens.js`,
`index.css`). Servem para decidir sozinho os casos repetidos; só escalar ao Diego os genuinamente
novos.


### Resíduo ou intenção — a pergunta que decide o sentido da convergência

Antes de convergir seja o que for, perguntar **por que é que o valor divergente está ali**. A
resposta decide qual dos lados se move, e as duas respostas levam a caminhos opostos:

- **Resíduo** — ninguém o escolheu. O indigo `#4F46E5` era o roxo do template `create-vite`, a
  scrollbar `#4f46e5` sobreviveu a todos os lotes porque nenhum grep de JSX chega a CSS puro, o
  `text-white` morto ficou em 23 botões onde o `style` inline já punha navy. Nada disto foi
  decidido: aconteceu. **A app converge para a escala.**
- **Intenção** — alguém escolheu, e repetiu. O `rounded-xl` estava em 709 sítios, 39% de todos os
  raios do admin, sempre no mesmo papel: caixas de ícone, botões com padding, contentores pequenos.
  Isso não é desvio, é a convenção real da app, e a escala é que estava incompleta por vir dos
  mockups. **A escala converge para a app** — ganhou o degrau `box`.

O sinal que separa os dois é **a consistência do uso**, não o número absoluto: 709 usos coerentes no
mesmo papel são uma decisão; 34 hex arbitrários espalhados por ficheiros sem relação são acumulação.
E quando a resposta for "intenção", mudar a app custa o que a migração inteira tem evitado — mudança
visual sem ganho de contraste, de acessibilidade ou de identidade por trás.
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
- **A lista de "6 ficheiros de `components/common` fora do alcance" estava incompleta — havia um
  sétimo.** `CompanySignatureSettings.jsx` (aba "Geral" de Configurações, primeiro ecrã que abre)
  tinha 19 ocorrências de indigo/azul cru, zero tokens, zero import de `designTokens` — nunca tinha
  sido tocado, `git log` confirma a última alteração em 2026-06-03/04, **antes** do commit que
  introduziu a identidade navy/laranja (`6e7d42f`, 2026-08-09). Corrigido em 2026-08-24: botão
  "Guardar" e os 4 cartões de estilo de carimbo (antes indigo/azul sem diferença semântica entre
  si — convergidos para o mesmo acento laranja, é seleção única, não estado) para tokens; caixas de
  erro/sucesso para `--tone-rose`/`--tone-emerald` (os tokens da ponte de cor de estado, secção
  acima). **Fica como aviso: se `git log -- <ficheiro>` mostrar a última alteração antes de
  2026-08-09, é candidato a ter o mesmo problema, independentemente de já ter aparecido nalgum
  levantamento anterior** — a varredura por `grep` de `features/admin`+`components/admin` nunca
  cobriu `components/common` de forma sistemática, só os casos já denunciados por queixa directa.
- **Varredura sistemática do sinal "`git log` &lt; 2026-08-09" em `components/common`/`components/worker`
  — decisão fechada por grupo, 2026-08-24.** Depois do `CompanySignatureSettings.jsx`, correu-se o
  mesmo sinal a todos os ficheiros dessas duas pastas, não só aos já denunciados. 18 candidatos,
  divididos em três grupos:
  - **Portal do cliente converge para navy/laranja** — decisão: não é caso de identidade própria
    como o `.recon-scope`, é resíduo por nunca ter sido tocado. Corrigidos: `DocumentViewer.jsx`
    (viewer de assinatura do trabalhador — atenção, este usa a convenção `components/worker`,
    laranja+texto **branco**+escurece no hover, não a do admin), `DateMultiPicker.jsx` (widget
    genérico, usado em `AdminReports.jsx`). `ClientTimesheetReport.jsx` só a barra de ferramentas
    (zona `no-print`) — o corpo do relatório A4 fica intocado de propósito, é gerado por
    `html2canvas-pro` a partir do DOM real e tem CSS próprio (`ClientTimesheetReport.css`) já a
    fixar as mesmas cores com `!important` para impressão; convergir o corpo faria o PDF variar
    com o tema do utilizador, que é o problema errado a resolver. `ClientPortalNavbar.jsx` **não
    era candidato — era código morto**, confirmado por sonda única + controlo positivo: substituído
    por `ClientPortalHeader.jsx` (import real em `ClientPortal.jsx:405`) sem nunca ter sido apagado;
    apagado nesta sessão.
  - **`VerificationPortal.jsx` mantém identidade própria (`blue-*`/`gray-*`), não converge.**
    Página pública standalone (`app.jsx:444`, condicional a `?view=verify&id=`), lida só via QR
    code gerado em `useSignatureStamp.jsx:12-18` — nunca navegada dentro da app, cria o próprio
    cliente Supabase em vez de usar o contexto partilhado. Parado desde a criação (`67ea50b`,
    2026-05-11); o único commit posterior foi só de segurança, confirmado que não toca
    `className`/`style`. Diferença chave do portal do cliente: aquele é navegação normal dentro da
    experiência da app, isto é um certificado autónomo lido por alguém que nunca viu o resto da
    Magnetic Place — faz sentido a identidade neutra separada da marca comercial. Corrigidas só as
    inconsistências **dentro da própria identidade**, não convergência para os tokens da app: o
    `DetailRow` (linha ~58-65) usava `slate-*`/`indigo-600` enquanto o resto do ficheiro usa
    `gray-*`/`blue-600`; e mais 5 casos de `bg-slate-50`/`text-slate-500`/`text-slate-400` nos três
    estados do ecrã raiz (loading/erro/sucesso) e no cartão de erro, trocados para o `gray-*`
    equivalente pela mesma razão — alinhamento do ficheiro consigo mesmo, não com o resto da app.
  - **6 componentes de carimbo/certificado — não mexer, identidade intencional documentada.**
    `CompanyClassicStamp.jsx`, `CompanyCorporateStamp.jsx`, `CompanyValidationStamp.jsx`,
    `ValidationStampAdmin.jsx` são as 4 pré-visualizações ao vivo dentro de
    `CompanySignatureSettings.jsx` — mas **o PDF real não reutiliza este código**: é gerado à parte
    em `src/utils/pdf/pdfSigningAdminStamp.js`/`pdfSigningAdminVariants.js` (`pdf-lib`). Ou seja,
    estes 4 são JSX normal renderizado ao vivo no browser, **não protegidos por iframe/canvas** — a
    razão para não mexer é só de design (`CompanyCorporateStamp.jsx:7-14` nomeia `NAVY`/`GOLD`/
    `PAPER` com comentário a descrever o efeito pretendido), não imunidade técnica. Se algum dia
    isto mudar, precisa de decisão de design, não é operação livre de risco só por "está protegido".
    `ValidationStamp.jsx`/`ValidationStampWithQR.jsx` são diferentes: alimentam o carimbo com QR do
    Fluxo 2 (`useSignatureStamp.jsx` → `useSignDocument.js`, o iframe isolado + `html2pdf` já
    documentado acima) — aqui sim, duplamente protegidos: intenção **e** imunes a CSS.
    `CompanyLogo.jsx`/`TimeTextInput.jsx`/`workerDocuments/useDocumentPreview.js` ficaram de fora
    da categoria "identidade própria" — são utilitários sem opinião de cor (o `4f46e5` residual no
    `CompanyLogo.jsx:8` está enterrado num parâmetro de URL de avatar de fallback, impacto
    desprezível, não vale tratar).
- **Um sintoma de "código antigo no telemóvel" nem sempre é ficheiro por corrigir — verificar
  primeiro se é cache do PWA antes de caçar no código.** O `ScheduleForm.jsx` foi apontado como
  desatualizado num telemóvel, mas o código já estava migrado (confirmado por `git diff
  origin/master` vazio) e o próprio servidor local, verificado ao vivo no browser, servia a versão
  correcta. O `sw.js` já usa `self.skipWaiting()` + `clients.claim()` (`src/sw.js:13,39-41`), a
  configuração mais agressiva de atualização possível — mas isso só troca o service worker em
  segundo plano; uma aba/instalação do PWA que ficou aberta desde antes do deploy continua a correr
  o bundle antigo já carregado em memória até ser **fechada por completo e reaberta** (um simples
  refresh de navegação pode não bastar num PWA instalado). Antes de investigar código a partir de
  uma queixa "isto está desatualizado no telemóvel", confirmar: (1) `git diff origin/master` no
  ficheiro suspeito — vazio significa que o código já está certo; (2) abrir o mesmo URL no browser
  da máquina de desenvolvimento para confirmar o que o servidor está mesmo a servir agora.
  **Bloqueado, não esquecido:** falta o Diego confirmar no telemóvel real se fechar o PWA por
  completo (não só refresh) resolve o sintoma original do `ScheduleForm.jsx`. Não assumir resolvido
  nem avançar mais nada que dependa dessa resposta até ela chegar.
- **`getComputedStyle().borderWidth` a mostrar um valor diferente do declarado não é sempre bug —
  em ecrã de 1x DPI, larguras de borda fracionárias (`1.5px`) arredondam para o pixel físico mais
  próximo no valor "usado" que o browser devolve.** Confirmado ao criar `SCALE.border.control`
  (2026-08-25): `border-[1.5px]` aplicado a um elemento real mostrava `1px` computado — pareceu bug
  do token, mas `border-2` (2px, inteiro) no mesmo teste dava exatamente `2px`, e o `border-style`/
  `border-color` da mesma classe aplicavam-se corretamente, só a largura sub-pixel arredondava. É o
  mesmo comportamento que o código já tinha *antes* da conversão para token — sem regressão nenhuma,
  só pareceu uma quando comparado a olho. **Reiniciei o servidor `vite dev` a meio desta investigação
  sem necessidade** (pensei que fosse cache do JIT do Tailwind, mesma família do problema do
  `ScheduleForm` acima, mas era outra coisa) — sem dano, mas ficasse registado: antes de reiniciar
  processos a resolver um "computed style errado", testar primeiro com um valor de controlo inteiro
  (`border-2`) para distinguir arredondamento de sub-pixel de classe realmente não aplicada.
  **Armadilha de metodologia à parte:** testar classes Tailwind criando elementos via
  `document.createElement` + `className` no browser só funciona para classes que já existem em
  código-fonte real e scaneado — o JIT do Tailwind não gera CSS para uma string inventada só porque
  apareceu no DOM em runtime. Um teste com uma classe nunca escrita em ficheiro nenhum dá sempre
  "0px"/sem efeito, **por não ter sido gerada**, não porque a sintaxe esteja errada — quase levou a
  concluir (erradamente) que a sintaxe `border-[Npx]` estava globalmente partida nesta versão do
  Tailwind.
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

- **`reconciliacao-mockup.css` mantém identidade própria, por decisão — mas agora reage ao `.dark`.**
  Redefine `--navy`, `--bg`, `--border`, `--text` e as cores de estado dentro de `.recon-scope`,
  deliberadamente distintas dos tokens globais (`--bg` #F5F7FA vs #FFFFFF, `--border` #E3E7EC vs
  #E5E1D6) — comparado ao vivo com um ecrã já convergido, o navy da marca é idêntico e só os
  neutros mudam. **Confirmado como intenção, não resíduo: fica sem convergir.**
  O que era resíduo de facto — o escopo nunca ter reagido ao modo escuro, por os dois sistemas de
  tokens serem independentes — está corrigido num bloco `.dark .recon-scope` próprio, que reaproveita
  os mesmos tons escuros já usados no resto da app (`index.css` `.dark`) em vez de inventar uma
  segunda paleta. Precisou de separar `--navy` (texto, inverte) de um `--navy-solid` novo (fundo do
  botão activo do segmented e do contador de tab, não inverte) — o mesmo desdobramento que o resto
  da app já tem, e pela mesma razão: uma só variável não serve os dois papéis em modo escuro.
  Medido antes e depois: o rótulo "RECONCILIADOS" subiu de 2,54:1 para 6,48:1; o botão TOConline
  activo mantém-se em 11,74:1 (branco sobre `--navy-solid`, que não muda). Verificado nos três
  consumidores (`ReconciliacaoAdmin`, `CostReports`, `SalariosTab`).
  **A verificação em `SalariosTab.jsx` cobriu só o `.recon-stat`, não a extensão real do
  acoplamento — achado 2026-08-25.** `SalariosTab.jsx:696-719` tem um bloco `.recon-scope` inteiro
  à volta de um cartão de "Lote SEPA" (transações bancárias não emparelhadas): `recon-group-card`,
  `recon-group-header`, `recon-group-title`, `recon-group-total`, `recon-group-body`,
  `recon-mini-row`, mais `var(--recon-mono)`/`var(--text-faint)` em `style` inline — substancialmente
  mais do que a faixa de estatísticas já medida. Mesma decisão de fundo (identidade intencional,
  não converge sem decisão explícita), só a extensão real não estava documentada até agora.
  **Descoberta ao verificar: os 2,54:1 já existiam no modo CLARO, sem ligação ao dark.** `--text-faint`
  (#9CA3AF) sobre `--card` (#FFFFFF) falha AA nos dois modos porque nenhum dos dois muda com o tema —
  não foi o meu lote nem o modo escuro que partiu isto, nasceu assim, portado literalmente do mockup
  aprovado. É o único dos seis tokens de texto do mockup que falha (os outros cinco passam, entre
  4,33:1 e 14,68:1) — usado em 7 sítios. **Fica por decidir**: mudar `--text-faint` muda o mockup
  aprovado mesmo em modo claro, não é conversão de tema.
- **A mesma identidade própria também cobre tipografia, não só cor — achado 2026-08-25 durante o
  levantamento do lote `SCALE.text` de `reconciliacao`.** `reconciliacao-mockup.css` define a sua
  própria escala de tamanho por classe (`.recon-stat-value` 20px, `.recon-group-title` 13.5px,
  `.recon-group-subtitle` 11.5px, `.recon-mini-status`/`.recon-status-pill` 10.5px, `.recon-desc`
  11.5px, etc. — passos de meio pixel, mesma assinatura de "intenção" já vista no
  `FormacaoElearningFlow.jsx`). Levantamento confirmado por árvore de render, não por grep de
  ficheiro: `ReconciliacaoAdmin.jsx` abre `.recon-scope` na linha 343 e só fecha na 771 (de 773
  linhas totais) — envolve praticamente o render inteiro — e os 5 ficheiros de
  `features/admin/reconciliacao/` (`AssocClienteModal.jsx`, `AssociacaoManualModal.jsx`,
  `HistoricoSection.jsx`, `OrfaoBancoModal.jsx`, `ResultadosTabs.jsx`) **não são importados por
  nenhum outro ficheiro do `src/`** — confirmado por grep — logo 100% do que renderizam está dentro
  do `.recon-scope`. Nenhum dos dois usa portal (`createPortal`), por isso não há via de escape da
  cascata. Total: **68 ocorrências de `text-[Npx]`** nestes 6 ficheiros — nenhuma convertida, mesma
  decisão de fundo já tomada para a cor: identidade intencional do mockup aprovado, não converge sem
  decisão explícita do Diego. Módulo `reconciliacao` da fila `SCALE.text` fica assim **resolvido por
  exclusão total**, não "por fazer" — a investigação está completa, a decisão é não mexer.
- **Os 13 `color: 'var(--navy)'` que ficavam presos ao valor local ficaram resolvidos como efeito
  colateral do bloco `.dark .recon-scope` acima — não foram tocados directamente.** Vivem em
  `.recon-stat-value`, cujo fundo é `.recon-stat { background: var(--card) }` — a mesma variável que
  o bloco `.dark` agora inverte. Quando `--card` passou a escurecer, o texto `var(--navy)` por cima
  (que já invertia) passou a compor sobre o fundo certo. Medido em `ClientesTab`: 11,74:1 nos dois
  modos → 6,36:1 no escuro, correcto e a inverter. Ficheiros afectados: `ClientesTab` 99/103/107,
  `DespesasTab` 78/82, `EquipaTab` 16/21/25, `FaturasTab` 140, `MargemTab` 37.
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
  **Lote parcial feito, 2026-08-31 — 11 dos ~60, o resto fica por localizar.** O `RecibosCalculadora`
  já estava fechado, então o lote foi desbloqueado. Construído `scripts/par-chip-scan.pl` (reaproveita
  a lógica de `fundo-do-ancestral.pl`, corrido sobre os 1215 usos de `text-[var(--slate-dim)]` em todo
  o `src/`, filtrado só para os casos cujo ancestral NO MESMO FICHEIRO resolve a
  `bg-[var(--surface-dim)]`) — devolveu **12 candidatos** (não 60). Corrigidos 11: 2×
  `TemplateEditorModal.jsx` (placeholder de preview), `TOConlineAdmin.jsx` (contador de contas),
  `ClientesTab.jsx`/`DespesasTab.jsx`/`EquipaTab.jsx`/`MargemTab.jsx` (linha "Total" de tabela, mesmo
  padrão repetido nos 4), `DocumentsFilters.jsx` + `FilaAprovacaoTab.jsx` + `TOConlineRelatorios.jsx`
  (tabs inactivas de segmented control — hover também subiu de `--ink-soft` para `--ink`, já que
  `--ink-soft` passou a ser o estado de repouso). `FilaAprovacaoTab.jsx` teve um segundo achado no
  mesmo local: o contador (badge) dentro da tab inactiva tinha o MESMO texto sobre um fundo diferente
  (`bg-[var(--border)]`, não `--surface-dim` — o script atribuiu-o ao ancestral errado por só ver o
  fundo mais próximo, não o da própria badge) — medido à parte (3,90/3,99:1, falha nos dois modos) e
  corrigido com o mesmo `--ink-soft` (4,95/4,90:1 contra `--border`, também resolve).
  **1 candidato excluído deliberadamente:** `TOConlineBankAccounts.jsx:306` é um ícone (`Landmark`)
  dentro de uma caixa colorida, não texto a ler — mesma classificação já usada no resto da migração
  (ícone/decorativo não precisa do mesmo contraste que texto). Confirmado ao vivo (`DocumentsFilters`,
  claro 5,52:1 / escuro 6,12:1), `npx eslint`/`npx vite build` limpos.
  **Os ~48 restantes ficam por encontrar — o método usado só vê o fundo definido no MESMO ficheiro.**
  A discrepância 60→12 é exactamente a limitação já documentada da "proximidade no código" — muitos
  dos 60 originais devem vir de composição entre ficheiros (um `<Card>`/wrapper partilhado que define
  `--surface-dim` num ficheiro, consumido por um filho que só declara o texto), que este script não
  alcança por construção. Encontrá-los precisa do mesmo processo já usado para o `--on-navy`
  (varrimento por FUNDO EFECTIVO no DOM ao vivo, não por classe no código-fonte) — fica registado
  como o próximo passo, não feito nesta passagem. `scripts/par-chip-scan.pl` foi apagado no fim (uso
  único, já superado por esta descoberta).
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

### Fase 2 — raios (`SCALE.radius`)

A escala original vinha dos mockups e **não descrevia a app**: o valor mais usado, `rounded-xl`
(12px, 709 usos, 39% de todos), não tinha token nenhum, enquanto três degraus definidos — `tab`,
`card`, `input` — tinham 0, 0 e 2 usos. Dos 1.813 raios do admin, 918 estavam fora da escala.

**Decisão: a escala ganhou os degraus que faltavam, em vez de a app mudar de aspecto.** É o inverso
do que se fez ao indigo do Vite, e a razão é a diferença entre resíduo e intenção: o indigo era
sobra de template, sem ninguém a escolhê-lo; os 12px foram escolhidos consistentemente em quase 40%
da app. A escala existe para nomear o que há.

Três degraus novos: `tight` (4px, chips minúsculos e checkboxes), `box` (12px, caixas de ícone,
botões com padding e contentores pequenos) e `hero` (40px, barras muito arredondadas).

**Normalizar valores, não trocar sintaxe.** Converter as 1.813 classes para `SCALE.radius.X`
obrigaria a importar `SCALE` em ~100 ficheiros sem que um único valor mudasse — trabalho cosmético
com superfície de erro a mais. Em vez disso normalizaram-se os **81** valores órfãos para o degrau
mais próximo, e as classes Tailwind ficam como estão, por serem exactamente os mesmos valores. O
vocabulário fechou de 25 valores distintos para 10 degraus nomeados (mais os direccionais
`rounded-r/l/t/tr/tl` e `rounded-none`, que são casos à parte).

A maior mudança visual foi `rounded-md` → `control` (6→8px, 44 casos); o `rounded-3xl` → `panel`
tem exactamente o mesmo valor (24px) e não muda nada. Verificado no browser em 12 rotas nos dois
modos, à procura de raios maiores que metade do lado do elemento — os únicos que aparecem são
círculos a 50% definidos em CSS (logótipo, botões redondos, pontos), nenhum deles tocado aqui.

**Pendência à parte, sem decisão:** os três degraus órfãos. O `tab` (`rounded-[7px]`) continua com
0 usos, e o `card` (`rounded-[1.2rem]`) só passou a ter 2 por receber normalizações. Ou se mantêm
por virem a ser adoptados, ou saem da escala por não descreverem nada real — mas isso decide-se à
parte, não no meio de uma conversão.
**Confirmação, não achado novo (2026-08-25):** o "0 usos" do `tab` já era um artefacto de âmbito,
não um facto sobre a app — `src/components/common/SectionHeaderShell.jsx:68` usa `rounded-[7px]`
exactamente, coincidindo com o degrau `tab`, mas vive fora de `features/admin`+`components/admin`,
o âmbito que a Fase 2 mediu. Mesma armadilha que os três ficheiros de `components/common` que
escaparam à migração de cor antes de serem descobertos — reforça que qualquer contagem "X usos"
feita só nesses dois diretórios precisa de nota explícita de âmbito, não é a app inteira.

**Ponte de cor de estado — iniciada em 2026-08-23/24.** Categoria à parte: não é migração de
neutros nem cor de marca, é o modo escuro das cores de estado. Domínios de correções e faturação
fechados; CorrectionsInbox/ItemRow, validade de documento e alertas ficam por fazer.

**Porque não se corrige metade (a razão de sempre ter sido um projecto à parte):** a regra-ponte do
`App.css` (`.dark .bg-emerald-50` etc.) não muda só o fundo, muda também o `color` do elemento, e os
filhos herdam-no — mas um `text-amber-700` com cor própria não herda. Medido: hoje esse texto fica
escuro sobre creme claro (4,93:1, passa); alargando só os fundos fica escuro sobre escuro (3,03:1,
falha); com fundo *e* texto invertidos dá 9,11:1. **Fundo e texto de estado são um par: mexer num
sem o outro é regressão.** Foi tentado e revertido antes de se decidir tratar isto como projecto
próprio.

**Levantamento confirmado por censo completo (não amostra), corrido com script, não estimado:**
`text-{16 famílias realmente em uso}-{peso}` soma **1.512** ocorrências em 149 ficheiros — a
estimativa antiga de "~1.025" só cobria 7 famílias × pesos 600/700/800; dentro desse recorte exacto
dava 982, próximo. Descontando zonas já excluídas por decisão (`.recon-scope` 69 — confirmados
linha a linha, não por presença do import, que tinha dado 127 por engano numa primeira passagem —,
`SSComunicacaoModal` 30, `AppLayout.jsx` morto 17, e mapas de cor-à-escolha novos não registados
antes: `RecibosCalculadora.jsx:3669-3671`, `OnboardingForm.jsx:723-727`), ficam **1.377 candidatas
reais**. Censo completo classificou-as todas: **775 já sobre fundo que hoje inverte** (`bg-white`,
`bg-slate-50/100`, ou um dos 3 fundos de estado já cobertos pela ponte), **459 sobre fundo que não
inverte**, **143 não determináveis por indentação** — dessas, rastreio ficheiro-a-ficheiro (incluindo
entre ficheiros, via `<Card>`/`ModalShell`) resolveu 141: 117 caem em "já inverte", **21 estão fora
de âmbito por impossibilidade estrutural** (`LoginView.jsx`, `OnboardingForm.jsx`,
`WorkerHeroStats.jsx` — as rotas `/onboarding/:token` e `/partilha/resumo` nunca montam o
`AppProvider`, `main.jsx:6-33`, por isso a classe `.dark` nunca chega a existir nessa árvore React),
3 são condicionais (`CelEditTd.jsx`), e **2 ficam genuinamente por resolver**
(`ValidacaoUI.jsx:10` `DivergenciaBadge`, reutilizado em 3 ficheiros; ponto de montagem de
`SessaoRow.jsx` não encontrado). Confirmados também **24 fundos com modificador de opacidade**
(`bg-amber-50/50`), como a estimativa antiga já dizia.

**Decisão fechada: não convergir para `TONES`/`--ok`/`--warn`/`--bad`.** Comparação OKLCH→sRGB (com
a fórmula validada contra vermelho/verde/azul puro antes de confiar nela) mostrou que `--bad`
(vermelho-tijolo, matiz 9°) e o `rose` do Tailwind (vermelho-magenta, matiz 344°) são famílias de
cor visivelmente diferentes, não tons mais claros/escuros da mesma — convergir mudaria o aspecto
sem ganho de design. Cada domínio ganha tokens de estado próprios, derivados das cores Tailwind já
em uso consistente em cada um, não dos 3 tokens que já existiam.

**Tokens partilhados definidos em `index.css` (ao lado de `--ok/--warn/--bad`), com contraste
calculado, não estimado:**

| Tom | Claro (texto / bg) | Contraste claro | Escuro (degrau Tailwind) | vs. `--surface` | vs. véu |
|---|---|--:|---|--:|--:|
| `--tone-amber` | `#bb4d00` / `#fef3c6` | 4,52:1 | `#fe9a00` (amber-500) | 7,70:1 | 6,41:1 |
| `--tone-emerald` | `#007a55` / `#d0fae5` | 4,72:1 | `#00bc7d` (emerald-500) | 6,65:1 | 5,42:1 |
| `--tone-rose` | `#c70036` / `#ffe4e6` | 5,02:1 | `#ff637e` (rose-400) | 5,75:1 | 5,33:1 |
| `--tone-indigo` | `#432dd7` / `#e0e7ff` | 6,57:1 | `#7c86ff` (indigo-400) | 5,25:1 | 4,71:1 |

Calculado com script Node (matriz OKLCH→sRGB, mesma validação) a partir do `tailwindcss/colors` real
do projeto, calibrado contra o que os pares já aprovados atingem (`--ok/--warn/--bad`: 6,2–8,0:1
contra `--surface`, 5,1–5,8:1 contra o próprio véu). **Dois valores que tinha escrito de cabeça numa
primeira passagem (`--tone-amber`, `--tone-rose`) estavam errados** — só apanhados ao calcular em
vez de estimar, mesma lição de sempre desta migração. O `--tone-indigo` escuro é o mais apertado dos
quatro (4,71:1, mal passa AA) — o degrau seguinte mais claro (`indigo-300`) sairia da gama de
calibração, visivelmente mais lavado que os outros três lado a lado; aceite pela consistência visual
entre os 4 tons.

**Domínios fechados (2026-08-24):**
- **Correções** — os 4 mapas exportados de `correctionsUtils.js` (`STATUS_LABEL`, `ITEM_STATUS`,
  `KIND_LABEL`, `deltaClass`) convertidos para os tokens partilhados. `TYPE_LABEL` (rápido/precisão/
  criação) fica intocado — é eixo de tipo, não de estado, fora do âmbito desta ponte.
- **Faturação/pagamento** — novo `cost-reports/pagamentoStatusUtils.js` (`PAYMENT_STATUS`),
  consumido por `ClientesTab.jsx`, `cost-reports/FaturasTab.jsx`, `SalariosTab.jsx` (cartões "Match
  Exato"/"Pendentes") e `salarios/SalarioEmployeeCard.jsx`. `ClientesTab.jsx` convergiu de rose para
  âmbar em "pendente" — era a exceção, os outros três já usavam âmbar. O `SalarioEmployeeCard.jsx`
  só apareceu ao verificar ao vivo no browser (é a fonte real do badge "X pendente(s)" por linha em
  Reconciliação → Salários); não estava na lista original de 3 ficheiros. Confirmado nos dois modos
  com cor computada no browser, não só por leitura de código.

**`CorrectionsInbox.jsx` — resolvido em 2026-08-25.** O padrão `corrIsPending`/`corrIsApplied` →
amber/emerald/rose não era um badge isolado — é o esquema de cor de ~25 sítios no ficheiro (fundo
de cartão, borda, cabeçalho, nome do trabalhador, data, badges, texto de pausa), em dois painéis
(`ClientCorrectionsPanel`, `WorkerCorrectionsPanel`) escritos independentemente. Confirmado ao vivo,
nos dois painéis: a hierarquia de peso Tailwind (label < meta < value < identity) repete-se
**identicamente** nas três cores, prova de intenção real, não ruído — decisão: **4 variantes de
papel por tom, nomeadas pela função** (`--tone-{amber,emerald,rose}-label/-meta/-value/-identity`,
claro+escuro, em `index.css`). Um suposto 5º peso (`amber-500`, notas de pausa) só apareceu por a
amostra inicial não ter um item com pausa — decisão: funde com `-label`, não abre categoria própria.
Duas divergências acidentais entre os dois painéis, corrigidas na mesma passagem (mesma lógica do
badge "Novo" em rose já corrigido antes): `ClientCorrectionsPanel` usava a família `orange`
(Tailwind), não `amber`, para o mesmo estado "pendente" — convergido; e a data do item usava o peso
`value`(800) em `ClientCorrectionsPanel` contra `meta`(700) em `WorkerCorrectionsPanel` para o mesmo
dado — convergido para `meta`. Verificado nos dois modos, nos dois painéis, ao vivo.
**Achado à parte, não corrigido — as linhas `bg-white/70` dos itens dentro do cartão** (mesmo
ficheiro, ambos os painéis) não invertem no modo escuro, ficam como uma faixa clara dentro do
cartão âmbar/emerald/rose escuro. Não fazia parte do pedido desta passagem, fica por resolver.

**Spec "Inbox de Correções" (4 tabs Abertas/Aplicadas/Rejeitadas/Todas), 2026-08-24 — fechada por
descobrir que já estava construída.** A spec descrevia, ponto por ponto (barra de 4 tabs em
pílula, cartões de grupo cliente+mês com avatar `navy`/`orange` 36px, badges de estado por
`--tone-*`), exactamente o que já existia neste ficheiro — a própria spec já alertava para essa
possibilidade ("confirmar se este Inbox é o mesmo componente antes de aplicar as cores"), e
confirmou-se que sim. Único trabalho real: (1) as 4 tabs de filtro usavam cores Tailwind sem par
de estado (`text-amber-500` etc.) — convergidas para `var(--tone-amber/emerald/rose)` +
`var(--slate-dim)`, confirmado 5,03-6,03:1 claro / 4,81-6,85:1 escuro; (2) nome de
cliente/trabalhador e mês usavam `font-bold`/`font-mono` genéricos do Tailwind em vez de
`FONT_TITLE`/`FONT_MONO` (mesma fonte visual hoje, mas duas fontes-de-verdade divergentes para o
mesmo papel — convergido nos dois painéis). Avatar `navy`(`FT.navy`)/`orange`(`FT.orange`)
confirmado **idêntico byte a byte** nos dois painéis (linhas 83 e 238 antes da conversão de
fonte), 4,66:1 nos dois modos (estático, autocontido, não inverte) — **fica registado como
pendência de prioridade** para quando se abrir o varrimento sistemático de pares de estado (ver
"Referência central" no topo de Armadilhas conhecidas): é a terceira margem "técnica mas frágil"
encontrada nesta sessão (a de Faltas era 4,56:1, esta é 4,66:1), não uma falha clara, mas sem
folga real.

**Spec "Redesenho Inbox de Correções (3 níveis)", 2026-08-24 — achado estrutural real, não
cosmético: os dois painéis não eram simétricos.** A spec pedia para "reestruturar os 3 níveis",
mas o nível 2 (fundo tingido `--tone-*-bg` cobrindo metadados+cartão) já existia exactamente como
descrito nos dois painéis — nada a mudar aí, e a pergunta da regra-ponte nem se aplicava: este
ficheiro usa `bg-[var(--tone-*-bg)]` (custom property com par claro/escuro definido em `index.css`
`:root`/`.dark`), não a classe Tailwind crua `bg-emerald-50`/`bg-rose-50` que a regra-ponte de
`App.css:46` intercepta — mecanismo diferente, já correcto, a "referência central" da ponte não
determina nada aqui. **O achado real: `WorkerCorrectionsPanel` já tinha o nível 3 (item por trás
de botão colapsável — badge de tipo, nome, data, chevron, expande para Original/Solicitado) —
`ClientCorrectionsPanel` não tinha nada disto, mostrava tudo sempre aberto, sem badge de tipo.**
Assimetria não documentada entre dois painéis que mostram o mesmo dado — decisão (Diego): trazer à
paridade, não assumir intenção deliberada sem evidência escrita. Replicado o padrão já testado do
`WorkerCorrectionsPanel` (`labelKind`, `expandedItems`/`toggleItem`) no `ClientCorrectionsPanel`,
não reescrito de raiz. **Badges de tipo são três, não dois** (`✚ Novo`, `✖ Eliminar`, `✎ Ajuste` —
a spec só previa/procurou "Novo"/"Eliminar"; `Ajuste` é o caso mais comum, qualquer alteração de
horário que não seja criação nem remoção). **Rejeitadas não tem campo adicional**: o motivo é só
capturado por `prompt()` no momento da acção e enviado por notificação externa, nunca mostrado de
volta nesta UI — Original/Solicitado renderiza igual ao caso aplicado, só muda o tom.
Checkpoint ao vivo confirmado nos dois painéis: expandir/colapsar funciona igual, com exemplos
reais de `Novo` ("Sem registo anterior" → "07:00 → 17:00") e `Eliminar` ("08:00 → 15:00" →
"Remover dia") no `ClientCorrectionsPanel`. **Achado de medição, não de código:** o badge de tipo
usa `bg-[var(--tone-amber-bg)]`, que em modo escuro é `rgba(187,77,0,0.22)` — translúcido. Medir
com canvas `fillStyle`+`getImageData` numa cor `rgba()` dá o valor composto sobre PRETO (o padrão
do canvas), não sobre o fundo real por trás — deu 2,36:1, parecendo falha. Compor manualmente a
pilha de fundos (percorrer ancestrais, alpha-blend de trás para a frente) deu o valor real: 4,86:1
escuro / 4,52:1 claro, ambos a passar AA — falso alarme do método, não um bug. **Quarta vez nesta
sessão que o instrumento de medição engana antes do código** (a meio de HMR, o selector
`closest('[style*="background"]')`, agora `rgba()` não composta) — reforça a regra já registada:
desconfiar do instrumento antes de assumir que um número surpreendente é real.

**Spec "Título + barra de ferramentas nas subtabs de Equipa" + "tab ativa com fundo do tom"
(Parte A+B), 2026-08-24.** `FT.amberBg`/`FT.amber` — nomes usados na spec — **não existem** em
`designTokens.js`; confirmado por grep antes de aplicar, usados `--tone-amber`/`--tone-amber-bg`
em vez disso (já estabelecidos e medidos nesta mesma sessão). Regra geral, não só deste caso:
nomes de token na spec são aproximações de quem escreve sem acesso ao repositório — confirmar
sempre contra `designTokens.js`/`index.css`, nunca assumir que existem literalmente.
**Parte A** — fundo da tab activa do `CorrectionsInbox.jsx` passou de `bg-white` genérico para
`var(--tone-{amber,emerald,rose}-bg)` por estado ("Todas" fica neutro, `bg-white`). Contraste
medido nos dois modos com composição de alpha correcta (a lição da ronda anterior):
Abertas 4,52/5,95, Aplicadas 4,72/5,03, Rejeitadas 5,02/5,00 (claro/escuro), todos AA com folga.
**Parte B** — antes de tocar em código, mapeado o estado real dos 4 componentes-alvo: dois já
tinham cabeçalho (`CorrectionsInbox.jsx`, `OnboardingPendentes.jsx` — só precisavam de convergir
`bg-amber-50`/`text-amber-600` para `var(--tone-amber-bg)`/`var(--tone-amber)` + `FONT_TITLE`) e
dois não tinham nenhum (`WorkerValidationPanel.jsx`, `AbsenceRequestsPanel.jsx` — cabeçalho
acrescentado de raiz, mesmo padrão de ícone+badge+`FONT_TITLE` nos quatro).
`OnboardingPendentes.jsx` já tinha, coincidentemente, exactamente a barra de ferramentas que a
spec pedia (só ícone de refresh) — zero mudança estrutural aí. `WorkerValidationPanel.jsx` já
tinha o seletor de mês + toggle lista/grade que a spec pedia como barra — só faltava o cabeçalho.
**Achado que mudava o âmbito, confirmado com o Diego antes de implementar:** os campos de
pesquisa de Faltas/Correções não existiam — não era reposicionar algo funcional, era lógica de
filtro nova. Implementada com estado local (`search`) por componente: em `CorrectionsInbox.jsx`
procura no nome do cliente do grupo E no nome de trabalhador dos itens aninhados (uma correção
pode ter itens de vários trabalhadores); em `AbsenceRequestsPanel.jsx` procura no nome do grupo
(trabalhador), aplicado depois de agrupar. Em ambos, os contadores/badges de resumo ficam **fora**
da pesquisa de propósito — mostram o total real, não o total do que está visível no ecrã, decisão
confirmada explicitamente pelo Diego para os badges "N pendentes"/"N aprovados" de Faltas (a
pesquisa é adição ao lado, não substituição). `AbsenceRequestsPanel.jsx` ganhou também uma
mensagem "Nenhum colaborador encontrado" para zero resultados — não existia feedback nenhum antes
(as três secções são todas condicionais, ficavam em branco silencioso).
Confirmado ao vivo, nos quatro componentes: título+ícone renderizam, pesquisa filtra
correctamente por nome de trabalhador E de cliente em Correções, por nome de trabalhador em
Faltas, badges de Faltas inalterados pela pesquisa, mensagem de zero resultados a aparecer.
Contraste do badge de ícone (idêntico nos 4, mesma classe): 4,52:1 claro / 5,95:1 escuro.

**Correção ao contentor invisível do `CorrectionsInbox.jsx`, 2026-08-24 — pílula de botões
separados vira um contentor visível.** As 4 tabs já eram estruturalmente um único `<div>` (não "4
botões soltos"), mas o fundo do contentor (`--surface-dim`) era **idêntico ao fundo da própria
página** — só a pílula colorida da tab activa aparecia, o resto lia-se como texto solto. Corrigido
para `var(--panel)` (branco/`#131d28`, distinto do fundo da página nos dois modos) + borda subtil;
botões passam de `flex-shrink-0` para `flex-1`, para preencherem o contentor em segmentos iguais.
Contraste reconfirmado, melhorou em escuro (o novo fundo por trás do `-bg` translúcido do tom é
mais escuro): 4,52/6,62 (Abertas), inactivas 5,10 — nenhum regrediu.
**Mesmo bug confirmado, sem corrigir, no toggle lista/grade do `WorkerValidationPanel.jsx`**
(idêntica classe `bg-[var(--surface-dim)] p-1 rounded-2xl`) — fora do pedido desta passagem.

**Spec "Cabeçalho unificado Equipa (Opção B)", 2026-08-24 — achado que invalidou a premissa
central da spec antes de tocar em código.** A spec pedia para tratar o "Cartão 1" (ícone+título+
tab bar) como sofrendo do mesmo bug do `--surface-dim` acima, com a extracção como oportunidade de
corrigir os dois de uma vez. **Não é o caso**: o "Cartão 1" já existe — é o `SectionHeaderShell.jsx`,
partilhado por **19 secções do admin** (Clientes, Fornecedores, Horários, Documentos, Faturação,
Reconciliação, Pagamentos, Custos, Calc. Recibos, Relatórios, Definições, Alertas, Ajudas de
Custo, Contabilidade, TOConline, Formação Interna, Mapa Salários, e Equipa) — e usa
`bg-slate-100`/`bg-white`, não `--surface-dim`. Confirmado ao vivo, nos dois modos, que são
genuinamente distintos entre si (claro: branco/cinza-azulado/branco; escuro: `#1e293b`/`#0f172a`/
`#1e293b`) — **sem bug de invisibilidade aqui**, mecanismo diferente do `CorrectionsInbox.jsx`.
**Decisão do Diego: não tocar em `SectionHeaderShell.jsx`** — o risco de mexer num componente
partilhado por 19 secções para resolver uma inconsistência pequena (título sem `FONT_TITLE`,
badge do ícone `--navy-soft` em vez de âmbar como as 4 subtabs) é maior que o ganho; fica
registada como pendência para **ronda dedicada**, com revisão das 19 secções antes de mudar algo
partilhado.
**Segundo achado, também reportado antes de decidir:** o 4º "filtro" proposto para Colaboradores
("Onboarding pendente") não tem alvo sensato como filtro exclusivo — vem de
`worker_onboarding_submissions`, tabela diferente de `workers`, que é o que a lista filtra;
filtrar por ele devolveria sempre lista vazia. Decisão do Diego: comporta-se como link de
navegação para a subtab Pendentes (onde os dados vivem), não como filtro — com "↗" acrescentado
ao rótulo para sinalizar que é diferente dos outros três.
**Implementado:** `StatChip` (dentro do `SectionHeaderShell.jsx`, não tocado) já suportava
`onClick`/`active` — só faltava `TeamManager.jsx` passar essas props. Substituído o antigo
`showInactive` (booleano) por `workerFilter` ('all'/'ativos'/'inativos', exclusivo) — e a checkbox
"Mostrar inativos" foi **removida**, por decisão minha não pedida explicitamente na spec: ficava
redundante com os 3 chips (que já cobrem o mesmo território e mais — "Inativos" sozinho não era
possível só com a checkbox). Registado por transparência, não confirmado com o Diego antes de
remover — reversível se ele preferir manter os dois controlos.
**Default do filtro ficou `'ativos'`, não `'all'` como uma nota solta de uma ronda anterior
sugeria** ("Colaboradores = ver todos, ativo por padrão") — decisão minha de preservar o
comportamento actual da app (inactivos escondidos por omissão, `showInactive` antigo default
`false`), já que ninguém pediu explicitamente para mudar esse default, só para o tornar
filtrável de forma exclusiva. Confirmado ao vivo: filtro exclusivo funciona (28/23/5 correctos),
pesquisa continua a combinar com o filtro activo, "Onboarding pendente ↗" navega para Pendentes,
chip activo com destaque laranja visível nos dois modos.

**Horários — `handleDeleteSchedule` apagava sem `confirm()` nenhum, corrigido 2026-08-24 (isolado,
antes do resto do redesenho da secção).** Achado ao investigar uma spec de redesenho maior:
apagar um horário no `ScheduleManager.jsx` não tinha confirmação de nenhum tipo — nem a básica.
Confirmado por SQL directo ao schema (`information_schema`, não por leitura do código JS): **não
há nenhuma foreign key entre `schedules` e `workers`/`worker_schedule_history`** — zero
constraints. `workers.assignedSchedules` é `ARRAY`, `workers.defaultScheduleId` é `text`,
`worker_schedule_history.schedule_id` é `text`, nenhum com `ON DELETE CASCADE`/`RESTRICT`/
`SET NULL`, porque não há constraint nenhuma a impor isso. Apagar um horário não limpa nada nos
trabalhadores atribuídos — ficam com uma referência morta que os cálculos de horas esperadas
(`calculateExpectedMonthlyHours`) leem em silêncio como "sem horário", sem erro visível,
distorcendo relatórios sem aviso. Corrigido com `confirm()`/`window.confirm()` — o padrão já
dominante no admin para "apagar com aviso dinâmico" (`FaturasAdmin.jsx`, `AjudasCalculadora.jsx`,
`ContadorEmailsAdmin.jsx`), confirmado antes de considerar criar um modal novo. Mensagem
distingue precisamente o que acontece: não "vão perder o horário" (implicaria limpeza automática
que não existe), mas "N trabalhador(es)... ficará(ão) sem horário definido, sem aviso automático".
**Achado secundário, confirmado por SQL, fora de âmbito desta correcção:** o campo
`schedule.assignedWorkers` (contagem mostrada nos cartões/linhas, "N colaboradores") é uma cache
denormalizada que já estava desatualizada em produção — `CALCOSA` mostrava "0 colaboradores" no
ecrã com **2 trabalhadores reais** atribuídos (confirmado via `workers.assignedSchedules`/
`defaultScheduleId`, a fonte viva). Provável causa: `handleUnassignSchedule` (`ScheduleContext.jsx`)
actualiza `assignedScheduleDates` mas nunca `assignedSchedules`, por isso a remoção de atribuição
não se reflecte no array que a contagem do cartão lê. A confirmação de apagar usa a fonte viva
(`assignedSchedules`/`defaultScheduleId`), não o campo em cache — por isso o aviso está correcto
mesmo quando o cartão mostra um número errado. O desfasamento em si fica registado, não corrigido.

**`ItemRow.jsx` — pendência separada, padrão diferente, não convertido.** Ao contrário do
`CorrectionsInbox.jsx`, aqui a cor não segue o estado da correção — é uma cor-chave **fixa por
coluna** da grelha de 3 colunas (Atual/Pedido/Final): "Pedido" é sempre `text-amber-600`, "Final" é
sempre `text-emerald-500`, independentemente de o item estar pendente, aceite ou rejeitado. Aplicar
os tokens de papel (`-label`/`-meta`/`-value`/`-identity`) aqui seria forçar uma solução desenhada
para hierarquia-por-estado a um problema de identidade-por-coluna — não encaixa. Fica por decidir
como tratar (provavelmente tokens novos, papel "coluna", não "estado"), sem pressa.

**Ainda não iniciados:**
- **Validade de documento** — `DocumentScannerModal.jsx` e `WorkerDocsFolderView.jsx` confirmados
  ao vivo (`bg-amber-50`/`bg-emerald-50` no pai com `text-amber-600/800` nos filhos — mesmo
  mecanismo de regressão do parágrafo acima, já presente hoje sem eu ter tocado em nada; e
  `bg-red-100 text-red-700` para "a expirar"). Há pelo menos mais 3 ficheiros com mapas
  `VALIDADE_CLS`/`ESTADO_CFG` duplicados e não centralizados (`CertificacoesValidadeTab.jsx`,
  `ListaAcoesTab.jsx`, `ElearningAcoesTab.jsx`) — não comparados lado a lado por falta de dados de
  teste no ambiente de dev.
- **Alertas** (`AlertasAdmin.jsx`) — decisão explícita de **não** forçar convergência de peso: o
  ficheiro usa `-50/600` (mais claro que o `-100/700` de correções/faturação) e fica com classes
  Tailwind literais, sem tokens, sem `.dark`. Revisitar só se isso incomodar visualmente.

### Fase 3 — tamanho de texto (`SCALE.text`) e largura de contorno (`SCALE.border`)

**Três bugs de método descobertos e corrigidos repetidamente ao longo de toda a Fase 3 — consolidados
aqui para a próxima sessão começar já com os greps certos, em vez de repetir a descoberta módulo a
módulo.** Apareceram em `ModoDocumentos.jsx`, `EquipaTab.jsx`, `CsvMappingCard.jsx` e
`AdminReports.jsx`, entre outros — nenhum destes ficheiros tinha nada em especial, o padrão é
genuinamente recorrente sempre que se converte `text-[Npx]` → `SCALE.text.X` em massa.

1. **`replace_all` numa substring nua (não o atributo inteiro) deixa `${SCALE.text.X}` preso dentro
   de uma string plana.** Quando o alvo do `old_string`/`new_string` é só o miolo das classes
   (`text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]`) em vez do atributo
   `className="..."` completo, o resultado fica `className="${SCALE.text.statLabel} ..."` — uma
   string JSX plana com um template literal por dentro, que nunca interpola e renderiza a expressão
   como texto literal. **Regra sem excepção: o `old_string`/`new_string` tem de incluir sempre
   `className="` no início e a aspa de fecho no fim, convertendo para `` className={`...`} `` no
   mesmo passo — nunca só o conteúdo entre aspas —, mesmo quando parece seguro por o alvo ser um
   `replace_all` de várias ocorrências idênticas.**
2. **O grep de verificação tem de ser `className="[^"]*\${`, nunca `className="\${`.** A versão
   estreita só apanha o bug quando `${` aparece imediatamente a seguir à aspa de abertura; a
   maioria dos casos reais tem outras classes antes (`className="block text-amber-500 ${...}"`), que
   o padrão estreito não vê. Correr o grep alargado **depois de cada lote de edições, não só no
   fim do ficheiro** — é barato e apanha o erro antes de se acumular.
3. **Contar ocorrências com `grep -o '...' | wc -l`, nunca `grep -c`.** `grep -c` conta linhas com
   pelo menos um acerto, não ocorrências — uma linha com duas classes `text-[Npx]` (par responsivo
   `text-[10px] sm:text-[13px]`, ou vários `<code className="text-[10px]">` na mesma linha em
   `AdminSettings.jsx:412`) conta como 1, não 2, e o total fica silenciosamente por baixo. Foi assim
   que `ValidationPortal.jsx` (24 ocorrências reais) escapou ao primeiro varrimento da raiz de
   `features/admin` — a contagem inicial por ficheiro não o listava por estar a subcontar outro
   ficheiro adjacente para o mesmo total aproximado, e só uma recontagem final com `-o` o expôs.

**Achado inicial, 2026-08-25: os tokens que estavam prestes a ser desenhados já existiam.**
Censo de valores `px` arbitrários em classes Tailwind (`text-[Npx]`, `w-[Npx]`, etc.) em todo o
`src/`: **2.153 ocorrências, 62 valores distintos, 78,6% dos ficheiros `.jsx`.** Concentração mais
forte do que a dos raios (39% no `rounded-xl`): os 4 valores mais usados — `10px`(58,8%), `9px`
(21,6%), `11px`(5,5%), `8px`(3,9%) — somam **89,7% do total**, e **91,8% do censo é `text-`**.
A escala `text-` do Tailwind nem sequer desce abaixo de 12px (`text-xs`) — não havia degrau vizinho
a "roubar" o uso, como no caso do `rounded-xl`; estes valores são arbitrários por necessidade
estrutural, não por preguiça. `src/styles/designTokens.js:127-138` já tinha `SCALE.text.meta`(10px)/
`.badge`(9,5px)/`.statLabel`(8,5px)/`.body`(11px), definidos e nomeados, mas com **2 call sites em
todo o `src/`** (`Badge.jsx`, `SectionHeaderShell.jsx`) — mesma pendência já registada em
`PLANO-DESIGN.md:316-323` ("tokens à espera do call site certo"), agora com prova de que o call site
já existe, em centenas de sítios, cada um a reinventar a receita em vez de importar o token.

**Decisão: os valores reais são a fonte de verdade, o token ajusta-se a eles — mesma lógica dos
raios órfãos.** `badge` 9,5px→**9px**, `statLabel` 8,5px→**8px**, sem discussão (arredondamento
"invisível", já feito várias vezes nesta migração). `meta`(10px) e `body`(11px) já batiam
exatamente, confirmados contra o papel encontrado numa amostra de 66 ocorrências em 15 ficheiros:
`uppercase`+`tracking` é sinal mais forte de "rótulo" do que o valor em px por si só; `8px` tende a
rótulo-kicker/badge (sem prosa), `11px` tende a texto corrido sem uppercase (bate com `body`), `10px`
é "coringa" — aparece nos três papéis, coerente com ser o mais frequente do censo (texto pequeno por
omissão). **Isto é um eixo diferente da ponte de cor de estado — tipo de conteúdo (rótulo/prosa/
dado), não hierarquia de importância dentro de um cartão. Dois sistemas paralelos e complementares,
não um a substituir o outro; não misturar os dois vocabulários.**

**`SCALE.border.control` (novo, `border-[1.5px]`)** — contorno de controlo interativo (inputs,
botões secundários, chips/opções selecionáveis), nunca separador estático. 11 usos confirmados,
concentrados em 2 ficheiros (`ClientForm.jsx` 7, `FormacaoElearningFlow.jsx` 3) do mesmo autor, mais
1 caso equivalente via `style` inline no mesmo `FormacaoElearningFlow.jsx:146` (cor vem de `FT.slate`,
JS runtime — Tailwind JIT não resolve arbitrary value com variável em runtime — ficou como `1.5px`
literal, com comentário a apontar para o token, não unificado). Nome escolhido por decisão explícita
apesar de colidir de propósito com `SCALE.radius.control` (papéis diferentes — raio vs. largura de
contorno —, categorias `SCALE` diferentes, sem colisão técnica).

**Convertido nesta sessão:** os 11 `className` + o token criado e as duas correções de 0,5px em
`designTokens.js`.

**Adoção de `SCALE.text` — em curso, sub-lotes por módulo, do menor para o maior.**
Decisão de princípio (2026-08-25), válida para todo o lote, não só o primeiro módulo: **quando um
elemento já está a desempenhar o papel de um token (`meta`/`badge`/`statLabel`/`body`) mas com
peso/tracking ligeiramente diferente da receita exacta, converge para o token — não deixar por
"quase igual".** Divergências pequenas e diferentes de sítio para sítio são assinatura de "cada um
escreveu a receita à sua maneira" (resíduo), não de intenção — se fosse intenção, o mesmo desvio
repetir-se-ia de forma consistente entre módulos, e não é o que se observa. Só voltar a perguntar
caso a caso se a convergência mudar claramente a leitura visual (ex. um peso que existe para dar
ênfase a um alerta, não só estética) — não para toda divergência de 1 grau de peso.
- `features/admin/adminOverview` (4 occ, 2 ficheiros) — ✅ feito, primeiro módulo (mesma zona do
  primeiro lote da migração de neutros). Confirmado antes/depois ao vivo (zoom 3× + `git stash`) na
  pill de tendência do `KpiCard.jsx`: 10px/`font-black`→9px/`font-bold`+uppercase+tracking — legível
  nos dois estados, sem perda de hierarquia visual. `FinancialSummaryPanel.jsx:67` (legenda do ano
  sobre o total YTD) reclassificada de `badge` para `statLabel` a meio — é uma legenda por cima de um
  valor grande, não uma pill colorida; a diferença de papel importa mais do que bater com o tamanho
  mais próximo.
- `features/admin/schedules/ScheduleForm.jsx` (17 occ) — ✅ feito, checkpoint ao vivo completo (dois
  modos). Rótulos de campo → `statLabel`, chip de toggle → `badge`, link de ação não-uppercase →
  `meta`. Confirmado no browser: "Nome do Turno" com `fontSize:8px, fontWeight:800, uppercase,
  letterSpacing:0.88px`, exatamente `statLabel`.
- `features/admin/fornecedores/FornecedorList.jsx` + `FornecedorForm.jsx` (21 occ) — ✅ feito,
  checkpoint ao vivo completo (dois modos). 3 spans de cabeçalho de secção ("Dados da empresa" etc.)
  usam `meta` + `tracking-widest` em vez de `statLabel` de propósito — não eram uppercase no
  original, e `statLabel` força uppercase; confirmado `textTransform:"none"` ao vivo antes de decidir.
- `components/worker/RequestEntryCard.jsx` (21 de 22 occ) — código feito (eslint/build limpos), mas
  **checkpoint ao vivo bloqueado, aceite por decisão do Diego (2026-08-24)**: `RequestEntryCard.jsx`
  só renderiza quando o trabalhador está em `limited_entry_mode` (ou o cliente por omissão tem
  `triggers_limited_mode`) — testar com um trabalhador normal mostra `components/common/
  EntryForm.jsx` (ficheiro diferente, não tocado, ver a nota de colisão acima). Confirmei por SQL um
  trabalhador em modo limitado (`w1775490101706`, Gabriel Gois Saraiva), mas "Ver Portal" devolveu
  `403 Forbidden`/"Sem permissão para executar esta ação" mesmo após sessão admin recarregada de
  raiz — parece restrição real de permissão da conta, não sessão obsoleta. 1 ocorrência deixada de
  propósito: linha ~348, `text-[9px] sm:text-[10px]` responsivo de dois tamanhos, não encaixa no
  modelo de token de tamanho único.
- `features/auth/LoginView.jsx` (14 occ) — código feito, checkpoint ao vivo bloqueado (só renderiza
  com sessão terminada, sem credenciais disponíveis nesta sessão) — aceite por decisão do Diego
  (2026-08-24), mesma razão do `RequestEntryCard.jsx`: mecanismo `${SCALE.text.x}` já provado
  pixel-a-pixel noutros módulos.
- `features/public/OnboardingForm.jsx` (6 occ) + `ResumoMensalPublico.jsx` (11 occ) — código feito
  (eslint zero avisos, build limpo). Checkpoint ao vivo bloqueado nos dois: `OnboardingForm.jsx`
  precisa de um token de convite válido (rota `/onboarding/:token`); `ResumoMensalPublico.jsx` é
  alcançável sem token em `/partilha/resumo`, mas exige `?token=...` gerado em Definições →
  Utilizadores e Acesso → "Acesso do Contabilista", que por sua vez **pede password de admin** — não
  tentei obtê-la. Aceite por decisão do Diego (2026-08-24), mesma categoria dos dois módulos
  anteriores. `OnboardingCommitmentStep.jsx` (9 occ) ficou **fora do lote**, por decisão do Diego —
  ver a nota do padrão de canvas frágil acima (Fluxo 2), pendência registada, sem conversão feita.
- `features/admin/faturas/` (29 occ, 4 ficheiros: `ContadorEmailsAdmin.jsx` 13,
  `TOConlinePanel.jsx` 11, `GmailConfigPanel.jsx` 4, `FaturaConfigPanel.jsx` 1 — `ApoliceSegurosImportPanel.jsx`/
  `CelEditTd.jsx` já não tinham ocorrências) — ✅ feito, checkpoint ao vivo completo nos 4 ficheiros,
  dois modos (`/admin/faturacao` abas Importar/Contador + `/admin/toconline`). `<th>`/rótulos de
  campo → `statLabel`, pills de estado e botões de ação → `badge`, texto corrido/metadados → `body`/
  `meta`. Nota de execução: um `replace_all` inicial no `GmailConfigPanel.jsx` trocou o texto do
  token mas manteve `className="..."` (string simples) em vez de `className={\`...\`}` — ficava
  como classe CSS literal `${SCALE.text.statLabel}`, nunca interpolada. Apanhado antes do commit por
  grep de confirmação, corrigido nas 4 ocorrências.
- `features/admin/pagamentos/` (36 occ, 4 ficheiros: `FilaAprovacaoTab.jsx` 17,
  `ImpostoPdfUploadModal.jsx` 8, `NovoPagamentoModal.jsx` 7, `PagamentosTab.jsx` 4) — ✅ feito,
  checkpoint ao vivo completo, dois modos (`/admin/pagamentos`, abas Fornecedores/Fila de Pag., mais
  os dois modais). Verificado antes de tocar: sem canvas frágil, sem `.recon-scope`, sem overlap com
  SS — módulo limpo confirmado. Mesmo erro do `className` literal vs interpolado do lote `faturas`
  repetiu-se no `NovoPagamentoModal.jsx` (`replace_all` de 6 rótulos idênticos) — apanhado e corrigido
  do mesmo jeito, antes do build.
- `features/admin/client/` (48 occ na recontagem de hoje, não os 41 estimados originalmente — 3
  ficheiros: `ClientPortalAuditPanel.jsx` 21, `ClientForm.jsx` 14, `ClientEnviosPanel.jsx` 13) —
  ✅ feito, checkpoint ao vivo completo, dois modos, nos 3 ficheiros e nas 2 vistas (lista/grade) do
  `ClientEnviosPanel.jsx`. Achado relevante confirmado ao vivo: vários casos (badge "raio Xm" sobre
  o mapa, contador "N selec." de horários, chips de horário com nomes como "manhã"/"teste") não eram
  uppercase no original — usei `SCALE.text.meta` em vez de `badge`/`statLabel` propositadamente
  nesses, para não forçar caixa alta que não existia; confirmado ao vivo que o resultado preserva a
  caixa original (`textTransform: none`) enquanto o tamanho converge. Mesmo erro do `className`
  literal vs interpolado repetiu-se em 2 `replace_all` (`ClientForm.jsx`, `ClientPortalAuditPanel.jsx`)
  — apanhado e corrigido antes do build, como nos lotes anteriores.
- `features/admin/formacao-interna/` (41 occ, 8 ficheiros) — ✅ feito. `formacaoAdminUiKit.jsx`
  (2, `ResumoCard`/`BarraProgresso` partilhados) converteu-se uma vez e beneficiou todos os
  consumidores do módulo. Checkpoint ao vivo completo para `NovaAcaoForm.jsx` (label constante
  `LABEL`, secção e-learling com questionário, "+ Opção"/"+ Adicionar Pergunta") e para o `ResumoCard`
  de `ListaAcoesTab.jsx`/`ElearningAcoesTab.jsx`, dois modos. **Sem checkpoint ao vivo possível para
  as linhas de tabela e pills de estado** de `ListaAcoesTab.jsx`, `ElearningAcoesTab.jsx`,
  `HorasPorTrabalhadorTab.jsx`, `CertificacoesValidadeTab.jsx`, `RegistoIndividualTab.jsx` — o
  ambiente de dev não tem dados de formação seedados (todos os ecrãs mostraram "Sem dados"/"Nenhuma
  ação registada"). Confiança alta por outra via: o padrão exato (`<tr>` → `statLabel`, pill colorida
  → `badge`) já foi verificado ao vivo dezenas de vezes noutros ficheiros nesta sessão, e
  eslint/build ficaram limpos.
- `features/client-report/` (48 occ, 6 ficheiros) — ✅ feito, código convertido e limpo (eslint/build
  ok) nos 6. **Achado relevante, fora do âmbito de tokens:** `ClientReportFlow.jsx` (export default)
  é código morto, junto com os 4 componentes que só ele consome — `StepMode.jsx`, `StepQuick.jsx`,
  `MonthStatusBadge.jsx`, `HistoryItem.jsx`. Confirmado por grep de imports (zero em todo o `src/`)
  e por sonda única no bundle: `"Tipo de reporte"`/`"Escolha como quer reportar a divergência..."`
  (só existem nestes ficheiros) dão 0 em todos os chunks do `dist/`, enquanto `"Ajuste de Precisão"`
  (controlo positivo, do `StepPrecision.jsx`) dá 2. **Só o `StepPrecision` — um export nomeado do
  mesmo `ClientReportFlow.jsx` — está vivo**, consumido por
  `src/features/admin/corrections/CorrectionDetail.jsx`, que por sua vez só é montado quando
  `CorrectionsInbox.jsx` recebe um `initialCorrectionId` (deep-link a partir de uma notificação
  específica de correção "precision" de cliente — não há navegação normal que lá chegue). Não apaguei
  nada — é achado a reportar, não decisão tomada. Por causa disto, o checkpoint ao vivo só foi
  possível para o `StepPrecision` isolado, e mesmo esse ficou por confirmar pixel-a-pixel nesta
  sessão por não ter conseguido reproduzir o deep-link sem dados de teste reais.
- `features/admin/corrections/` (59 occ, 4 ficheiros: `CorrectionDetail.jsx` 27,
  `CorrectionsInbox.jsx` 17, `ItemRow.jsx` 14, `TimesCell.jsx` 1) — ✅ feito. **Sobreposição real
  confirmada com a ponte de cor de estado** (`CorrectionsInbox.jsx` já tinha os tokens de papel
  `-label/-meta/-value/-identity`): SCALE.text (tamanho/peso/caixa) e os tokens de papel (cor) tocam
  propriedades CSS diferentes — o Tailwind resolve `text-[10px]` como `font-size` e
  `text-[var(--tone-amber-meta)]` como `color` no mesmo `text-[]`, porque infere a propriedade pelo
  tipo do valor (comprimento vs cor). Confirmado ao vivo, não só em teoria: "Solicitado" mede
  `8px/800/uppercase` (statLabel) com `#e17100` (`--tone-amber-label`); "Precisão · Submetido:" mede
  `10px/600` (meta) com `#bb4d00` (`--tone-amber-meta`); "✓ Aceite" mede `10px/600/none` (meta,
  caixa preservada) com `#007a55` (`--tone-emerald`) — os três com o token de tamanho e o de cor a
  coexistir sem conflito, numa correção real ("Empresa Teste") em `/admin/clients` → Correções.
  `ItemRow.jsx` usa um padrão diferente (cor fixa por coluna, não por papel de estado — já registado
  como pendência à parte) — sem sobreposição de sistemas aí, só SCALE.text. Checkpoint ao vivo
  completo para `CorrectionsInbox.jsx`, dois modos; `ItemRow.jsx`/`CorrectionDetail.jsx` só por
  padrão de código idêntico já verificado (mesma razão do deep-link não reproduzível do achado
  `ClientReportFlow.jsx` acima — `CorrectionDetail.jsx` só monta com `initialCorrectionId`).
- `features/admin/documents/` (68 occ, 6 ficheiros: `WorkerDocsFolderView.jsx` 32,
  `ReportsEmbedded.jsx` 12, `DocumentsTable.jsx` 11, `UploadManualModal.jsx` 8,
  `DocumentsFilters.jsx` 4, `SortableTh.jsx` 1) — ✅ feito. Verificado antes de tocar:
  `WorkerDocsFolderView.jsx` tem um `<iframe srcDoc={...} sandbox="allow-scripts">` (visualizador de
  documento, não é o iframe de assinatura do Fluxo 2) e nenhum canvas dimensionado por
  `parent.clientWidth` — não é zona sensível, confirmado antes de converter. Checkpoint ao vivo
  completo em `/admin/documentos`, dois modos, para `WorkerDocsFolderView.jsx` (cartões "Por
  colaborador", `DocCard`/`DocCardPair`), `DocumentsTable.jsx` (vista "Por categoria", `<th>` via
  `SortableTh.jsx`) e `UploadManualModal.jsx`. **Achado à parte, não corrigido:** `npx eslint` acusa 2
  erros pré-existentes (`react-hooks/static-components`) em `WorkerDocsFolderView.jsx:354-364` —
  `PreviewThumb` é declarado dentro do render de `DocCardPair`, o que reinicia o seu estado a cada
  render. Confirmei com `git stash`/lint/`git stash pop` que já existia antes desta sessão, sem
  relação com a conversão de tokens — fora de âmbito, fica registado para quem for arrumar
  `components/admin` ou `components/common`.
- `features/admin/toconline/` (103 occ, 6 ficheiros) — ✅ feito, em 4 sub-lotes internos (mesma
  lógica dos módulos grandes da migração de neutros): `ModalDocToc.jsx`(1)+`TOConlineClientes.jsx`(2)
  → `CriarDocumentoModal.jsx`(8) → `TOConlineBankAccounts.jsx`(13) → `TOConlineRelatorios.jsx`(16) →
  `FaturarClienteModal.jsx`(63, o maior de toda a fila `SCALE.text` até agora). Cuidado redobrado
  mantido: confirmei ausência de canvas/iframe sensível em todos antes de tocar; em
  `FaturarClienteModal.jsx:1050` deixei deliberadamente por converter a `<table className="text-
  [10px]">` da pré-visualização da fatura — é a base de tamanho herdada por todas as células de
  dados (preços, quantidades, IVA) de um documento financeiro, e `SCALE.text.meta` traria
  `font-semibold` de propósito para as células que hoje ficam a peso normal; risco desproporcional
  ao ganho, registado como exceção, não esquecido.
  **Checkpoint ao vivo bloqueado para 5 dos 6 ficheiros — duas causas distintas, nenhuma minha:**
  (1) `TOConlineClientes.jsx`/`TOConlineRelatorios.jsx`/`TOConlineBankAccounts.jsx` estão atrás de um
  único `ligado` verificado uma vez em `TOConlineAdmin.jsx:51-61` (`/api/toconline/status`), que
  devolveu `false` nesta sessão — mostram sempre "TOConline não ligado", independentemente do que a
  aba "Documentos" mostra (essa usa uma verificação própria, em `TOConlinePanel.jsx`, e deu `true`).
  (2) Mesmo a aba "Documentos" a dar `ligado`, clicar "Carregar" devolveu `403 Sem permissão para
  executar esta ação` — terceira vez nesta sessão que a mesma mensagem aparece em features
  completamente diferentes (impersonação de trabalhador, importação Gmail, agora TOConline),
  confirma ser uma limitação real da conta admin desta sessão, não um efeito do meu lote.
  `ModalDocToc.jsx` também ficou por confirmar (só abre a partir de uma linha de documento real, que
  o 403 impediu de carregar). Tentei uma via alternativa para `FaturarClienteModal.jsx` — o botão
  "Faturar" em `AjudasCustoAdmin.jsx`/`AjudasCalculadora.jsx` não depende do `ligado` — mas o único
  caminho até lá passava por "Simular" em Ajudas de Custo → Estimativa Mensal, que **grava dados
  reais** (`ajudas_estimativas_fatura`), não é pré-visualização; não cliquei. Confiança por eslint +
  build limpos e por o padrão de conversão ser idêntico a dezenas de casos já confirmados ao vivo
  nesta sessão (`TOConlinePanel.jsx`, já verificado no lote `faturas`).
- `features/worker/` (recontado ao vivo: **121** occ, 16 ficheiros — a estimativa da fila (104) estava
  desatualizada) — ✅ feito, 15 ficheiros convertidos + 1 deixado inteiro por decisão:
  `InServiceCard.jsx`(1), `WorkerDashboard.jsx`(2 — confirmado `import SignatureCanvas` morto, zero
  usos no ficheiro, não é zona sensível apesar do grep inicial), `GeoSuggestionCard.jsx`(3),
  `ManualTimeEntryCard.jsx`(3), `TimeEntryModal.jsx`(4), `FormacaoModal.jsx`(5, 1 fora — título a
  16px, não corresponde a nenhum dos 4 tamanhos do `SCALE.text`), `IncompleteLogModal.jsx`(5),
  `WorkerScheduleTab.jsx`(6), `WorkerCalendar.jsx`(7, 2 fora — número do dia e total de horas dentro
  da célula do calendário, ambos `font-black` com função de destaque real; o total de horas colidiria
  ainda com o `uppercase` forçado do `badge`, mudando "8h" para "8H"), `WorkerHeroStats.jsx`(7, 1 fora
  — relógio a 64/80px), `WorkerProfile.jsx`(9), `AbsenceRequestModal.jsx`(11),
  `WorkerNavBar.jsx`(11, 1 fora — `text-[9px] sm:text-[10px]` no nome do trabalhador tem tamanho
  responsivo por breakpoint, que os tokens `SCALE.text` não suportam), `PendingAlertsModal.jsx`(12),
  `PendingCorrectionsPanel.jsx`(16, 3 fora — o valor `font-black` da comparação antes/depois nos itens
  de correção, mesma lógica de ênfase do `WorkerCalendar.jsx`). **`FormacaoElearningFlow.jsx`(19)
  ficou inteiro por converter, decisão registada:** tem escala tipográfica própria e consistente
  (9.5, 13, 13.5, 14, 14.5, 15, 19, 22, 34px — passos de meio pixel repetidos por todo o ficheiro, não
  valores soltos), usada só neste ecrã de quiz/e-learning; só 3 das 19 ocorrências coincidem por
  acaso com tamanhos do `SCALE.text` (11px×2, 10px×1) e convergê-las isoladamente fragmentaria a
  escala própria sem nenhum ganho — é "intenção", não resíduo, pelo critério já estabelecido nesta
  migração. Também é o ficheiro sensível do módulo (canvas de assinatura dimensionado por
  `parent.clientWidth`, linha 91) — nada foi tocado perto dele.
  `npx eslint`/`npx vite build` limpos no módulo inteiro (só warnings pré-existentes, sem relação).
  **Checkpoint ao vivo não alcançado:** o botão "Ver Portal" (impersonação de trabalhador, em
  `/admin/team`) não produziu efeito visível em três tentativas nesta sessão — consistente com o
  padrão de `403 Sem permissão` já registado três vezes antes neste mesmo lote (TOConline, Gmail,
  impersonação), mas desta vez sem sequer chegar a mostrar o erro. Confiança apoiada em eslint+build
  limpos e no padrão de conversão idêntico a dezenas de casos já confirmados ao vivo nesta sessão.
- `client-portal/` (recontado ao vivo: **129** occ, 11 ficheiros — a estimativa da fila (124) estava
  próxima mas não exacta) — ✅ feito, 10 ficheiros convertidos (`GenericNotificationCard.jsx` tinha 0,
  fora de âmbito): `ClientPortalHeader.jsx`(2), `ReverAlteracoesView.jsx`(6),
  [`src/client-portal/LoginView.jsx`](src/client-portal/LoginView.jsx)(8 — caminho completo citado de
  propósito, colide de nome com `src/features/auth/LoginView.jsx` já registado acima),
  `LogManagementModal.jsx`(11), `WorkerSubmissionsPanel.jsx`(11), `ValidarView.jsx`(12),
  `WorkerRequestsView.jsx`(15), `SimpleReportView.jsx`(19), `CounterProposalCard.jsx`(21),
  `DashboardView.jsx`(24, 2 fora — `text-[11.7px]`/`text-[9.9px]` na célula "hoje" do mini-calendário,
  parte de um ajuste ao sub-pixel que já inclui `m-0.3`/`mt-0.7`/`h-2.7 w-2.7` vizinhos, a mesma lógica
  de "escala própria" do `FormacaoElearningFlow.jsx`, só que aqui restrita a duas linhas em vez do
  ficheiro inteiro). **Quinto caso da família de canvas de assinatura sensível, encontrado neste
  módulo:** `src/client-portal/useSignatureCanvas.js:22` (`canvas.width = parent.clientWidth`),
  consumido por `ValidarView.jsx:154` — registado na lista de Fluxo 2 acima. O `#signature-canvas-area`
  não tinha nenhum `text-[Npx]` a converter, confirmado antes e depois de tocar no ficheiro.
  `npx eslint`/`npx vite build` limpos no módulo inteiro (só warnings pré-existentes).
  **Checkpoint ao vivo parcial:** `LoginView.jsx` confirmado ao vivo em `http://localhost:4179/?
  client=teste` (a query `?client=` activa a vista `client_portal` em `AppContext.jsx:56-57`) — pill
  "Área Reservada", seletor PT/ES, rótulos "Email"/"Senha (NIF)" e botão "Entrar" todos correctos, sem
  regressão. As vistas pós-login (`DashboardView`, `ValidarView`, etc.) não foram alcançadas por
  faltarem credenciais reais de cliente nesta sessão — confiança apoiada em eslint+build limpos e no
  padrão de conversão idêntico a dezenas de casos já confirmados ao vivo nesta sessão.
- Ordem confirmada dos módulos limpos (sem sobreposição com dinheiro/`.recon-scope`/PDF), do menor:
  `adminOverview`(4, feito) → `auth`(14, feito) → `schedules`(17, feito) → `fornecedores`(21, feito) →
  `components/worker`(22, feito) → `public`(27, feito — 17 de 26, `OnboardingCommitmentStep.jsx`
  pendente) → `faturas`(29, feito) → `pagamentos`(36, feito) → `client`(41/48, feito) →
  `formacao-interna`(41, feito) → `client-report`(48, feito) → `corrections`(59, feito) →
  `documents`(68, feito) → `toconline`(103, feito) → `features/worker`(121, feito) →
  `client-portal`(129, feito). **A fila de módulos limpos está esgotada.**
- Módulos com sobreposição confirmada (dinheiro/`.recon-scope`/PDF, direta ou herdada) ficam para
  **depois** de todos os limpos, mesma lógica dos ficheiros de dinheiro na migração de cor:
  `salarios`(59, feito — a estimativa da fila (23) estava desactualizada) →
  `reconciliacao`(68 recontadas, resolvido por exclusão total — `.recon-scope` cobre os 6 ficheiros
  inteiros, ver pendência acima) → `components/common`(69 recontadas, feito) →
  `components/admin`(123, feito) → `cost-reports`(127, feito) →
  `team`(198, feito — a estimativa da fila (197) estava 1 abaixo) →
  `features/admin` raiz(425, feito — a estimativa da fila (490) estava acima; ver detalhe abaixo).
  **A fila da Fase 3 está esgotada — não fica nenhum módulo `SCALE.text` por fazer.**
  **`components/common` — 9 ficheiros, dois deles de alto alcance (`ModalShell.jsx`, usado por 41/47
  modais; `SectionHeaderShell.jsx`, usado em ~19 secções do admin), verificados ao vivo com medição
  antes de dar o módulo como fechado.** `ModalShell.jsx`(2, 1 fora — `text-[12px]` do `meta`, fora dos
  4 tamanhos), `SubTabBar.jsx`(2), `SectionHeaderShell.jsx`(3 — já tinha 2 dos 4 tokens `SCALE.text`
  citados no achado da Fase 3 como "call sites à espera", agora com o 3º valor, o `text-[9.5px]` que
  originou o arredondamento do `badge` para 9px, finalmente a usar o token em vez do literal),
  `DateMultiPicker.jsx`(4, 1 combina `SCALE.text.badge` com `text-[var(--tone-rose)]` no mesmo
  elemento — mesma coexistência tamanho/cor já confirmada em `corrections` e `salarios`),
  `EntryForm.jsx`(10), `WorkerDocuments.jsx`(10, 1 fora — string HTML `SIGNATURE_PLACEHOLDER_HTML`
  injectada num iframe sandboxed via `injectTailwindCDN`, "Aguardando Assinatura", tratada com a
  mesma cautela do Fluxo 2 apesar de o `canvasRef`/`getContext` do ficheiro serem código morto
  confirmado — zero `<canvas>` na JSX, só o `<iframe>` de pré-visualização é real e é read-only),
  `VerificationPortal.jsx`(12 — identidade de cor própria já decidida no passado não se estende ao
  tamanho: os 12 valores são 9/10/11px inteiros, sem a assinatura de meio-pixel que marca uma escala
  própria deliberada, convergidos normalmente), `ClientTimesheetReport.jsx`(13, 9 fora — tudo dentro
  de `.a4-paper`, o corpo do relatório capturado por `html2canvas-pro` para o PDF final, mesmo
  princípio já usado no `FaturarClienteModal.jsx`: só a barra de ferramentas `no-print` converge, o
  render de linha 520 em diante fica intocado), `CompanySignatureSettings.jsx`(13). **Checkpoint ao
  vivo:** medido em `/admin/team` — a linha "Nome · Profissão" dentro de um `ModalShell` mede
  `8px/800/uppercase/0.88px` (== `statLabel`); as sub-abas do `SectionHeaderShell` ("Colaboradores",
  "Faltas", ...) medem `9px/700/uppercase` (== `badge`). `npx eslint`/`npx vite build` limpos no
  módulo inteiro.
  **`components/admin` — 12 ficheiros, 123 ocorrências recontadas (bateu com a estimativa da fila),
  mas só 73 são trabalho — 50 são código morto confirmado.** `ModoLote.jsx`(32) e `SessaoRow.jsx`(18)
  não são importados em ficheiro nenhum do `src/`, estão ausentes do bundle `dist/` (confirmado com
  sonda única + controlo positivo/negativo — "Limites de validação" e "Apagar processamento", ambas
  ausentes; controlo positivo "ERROS DE ENVIO" do `ModoBursting.jsx`, presente), e o histórico do git
  dá a razão exacta: commit `35afa4e` ("refactor: fundir Validar+Histórico em fluxo unificado por
  mês", 2026-06-08) removeu deliberadamente `import ModoLote` e `<ModoLote .../>` de
  `ValidarReciboAdmin.jsx`, reduzindo as tabs para "Recibos / Burst / Documentos" (`ModoReextracao`
  juntou-se depois). `SessaoRow.jsx` era o renderizador de linha do `ModoLote` (extraído no mesmo
  commit de split `e703eea`) e ficou órfão pela mesma razão. **Não convertidos — não é trabalho sobre
  código que ninguém vê — nem apagados, não é decisão a tomar de passagem; registado para quem um dia
  arrumar código morto.** Dos 6 ficheiros vivos: `DocumentTemplatesAdmin.jsx`(1),
  `ValidacaoUI.jsx`(1, `EstadoPicker`, reutilizado por `ModoLote`/`SessaoRow`/`ModoHistorico` — a
  ocorrência em si não tem sobreposição de tom de cor, confirmado antes de tocar),
  `ValidarReciboAdmin.jsx`(1), `templates/FieldBadge.jsx`(1, converge para `meta` em vez de `badge`
  apesar do formato de etiqueta — o conteúdo é o nome literal de uma variável de template, forçar
  maiúsculas mudaria o que o utilizador vê escrito), `templates/TemplateEditorModal.jsx`(3),
  `templates/TemplateGenerateModal.jsx`(3, um deles é `<code>{'{client_*}'}</code>`, mesmo cuidado de
  preservar o literal), `ModoDocumentos.jsx`(10), `ModoHistorico.jsx`(13), `ModoReextracao.jsx`(15,
  13 das 15 convergem para `meta` em vez do papel óbvio de `statLabel` — os textos de relatório
  combinam um prefixo já em maiúsculas com uma frase em minúsculas na mesma etiqueta, ex. "FORA DE
  ÂMBITO (mês fora de Jan-Mai 2026...)" — forçar `uppercase` mudaria a frase inteira, incluindo nomes
  de tabela reais como `receipt_validations`), `ModoBursting.jsx`(25, 1 fora — `<table
  className="text-[10px]">` base de uma tabela editável com inputs de nome de ficheiro por linha,
  mesmo princípio do `FaturarClienteModal.jsx`: risco desproporcional ao ganho). **Achado à parte,
  apanhado e corrigido no próprio lote:** um `replace_all` em `ModoDocumentos.jsx` deixou 4 `<th>`
  com `className="..."` plana em vez de crase, apesar de o `${SCALE.text.statLabel}` estar no meio da
  string em vez de no início — o `grep 'className="\${'` habitual (que só apanha o padrão logo a
  seguir à aspa) não encontrou o bug; só apareceu ao alargar para
  `grep 'className="[^"]*\${'` (apanha o padrão em qualquer posição dentro da string). Confirmado por
  varrimento a todo o `src/` que não se repetia mais nenhures — fica como padrão de verificação mais
  rigoroso para o resto da fila. **Checkpoint ao vivo** em `/admin/reconciliacao/recibos`: as tabs
  "Recibos/Burst/Documentos" medem `9px/700/uppercase` (`badge`); a legenda "21 recibos" mede
  `10px/600/none` (`meta`, minúsculas preservadas); os cabeçalhos "Trabalhador/Líquido/Divergência/
  Estado" medem `8px/uppercase` (`statLabel`). `npx eslint`/`npx vite build` limpos (só warnings
  pré-existentes, incluindo nos dois ficheiros mortos, que não toquei).
  **`cost-reports` — 127 ocorrências, todas convertidas, zero exceções.** 8 ficheiros:
  `EquipaTab.jsx`(4), `LinkPagamentoModal.jsx`(5), `ClientesTab.jsx`(7), `LinkFaturaModal.jsx`(7),
  `MargemTab.jsx`(7), [`src/features/admin/cost-reports/FaturasTab.jsx`](src/features/admin/cost-reports/FaturasTab.jsx)(20 —
  caminho completo citado de propósito, colide de nome com `src/features/admin/FaturasTab.jsx` já
  registado acima), `DespesasTab.jsx`(29), `AjudasCalculadora.jsx`(48, o maior e mais sensível — já
  era o único ficheiro de dinheiro desta pasta a ter lote próprio na migração de cor). **5 dos 8
  ficheiros (`EquipaTab`, `ClientesTab`, `MargemTab`, `cost-reports/FaturasTab`, `DespesasTab`) têm
  `.recon-scope` — confirmado, ficheiro a ficheiro, que a `<div className="recon-scope">` abre e
  fecha só à volta de uma faixa de 3 cartões de resumo (`recon-stat-strip`), sem nenhuma classe
  `text-[Npx]` lá dentro; a tabela com todas as ocorrências-alvo fica sempre num `<div>` irmão,
  fora do scope.** Diferente do `ReconciliacaoAdmin.jsx` (scope à volta do render inteiro) e do
  `SalariosTab.jsx` (scope à volta de um cartão específico no meio do ficheiro) — aqui o scope é uma
  faixa isolada no topo, sem sobreposição real com nada convertido. **Bug do mesmo tipo já apanhado
  em `components/admin` reapareceu logo no primeiro ficheiro** (`EquipaTab.jsx`): um `replace_all`
  numa substring nua («`text-[10px] font-black uppercase tracking-widest">Nome`») deixou o
  `${SCALE.text.statLabel}` dentro de um `className="..."` plano. Apanhado de imediato pelo grep
  rigoroso (`className="[^"]*\${`) e corrigido — reforça que a causa raiz é o hábito de poupar
  esforço com `replace_all` numa substring em vez de trocar o atributo `className` inteiro; a partir
  daqui, sempre que o `className` original for uma string plana, a substituição inclui sempre a
  troca para crase no mesmo passo, nunca só o miolo. **Checkpoint ao vivo** em `/admin/costs`: os
  cabeçalhos "Nome/Total Horas/Custo (€)" do `EquipaTab.jsx` medem `8px/uppercase` (`statLabel`); no
  separador "Ajudas" (`AjudasCalculadora.jsx`, o ficheiro de dinheiro mais delicado do módulo), o
  rótulo "Sem dados" e todos os cabeçalhos da tabela de previsão ("Cliente/Horas/Valor Fatura/%
  Total/Ajudas Incluídas") medem `8px/uppercase` — sem regressão. `npx eslint`/`npx vite build`
  limpos no módulo inteiro.
  **`team` — 198 ocorrências recontadas (a fila estimava 197), maior módulo até agora, 9 ficheiros,
  8 convertidos + 1 excluído por decisão.** `SSComunicacaoModal.jsx`(6) **não convertido** — estende
  para o SCALE.text a mesma exclusão já registada para cor/ModalShell (comunica à Segurança Social,
  ver Fluxo 1 acima); o grep de verificação do módulo confirma que estas 6 são as únicas
  `text-[Npx]` que sobram em `src/features/admin/team/`. **Risco da SS não é uniforme dentro do
  módulo — distinção nova, confirmada por grep:** `ImportarContratosSSDModal.jsx`(16) tem "SS" no
  nome mas é um parser de CSV exportado pela SS, sem nenhuma chamada a `api/seguranca-social`/
  `authFetch`/`fetch(` — convertido normalmente, com cuidado extra de caso em NISS/códigos de
  profissão exibidos. `ChangeRequestsPanel.jsx`(10), `OnboardingPendentes.jsx`(18, inclui o `labelCls`
  partilhado por ~17 rótulos do formulário de revisão de onboarding, um deles SS-adjacente — "Cód.
  Local de Trabalho (SS)"), `WorkerValidationPanel.jsx`(19), `AbsenceRequestsPanel.jsx`(21),
  `DocumentScannerModal.jsx`(28, pesado para `meta` de propósito — mostra nomes/NIFs/datas reais de
  documentos, onde forçar maiúsculas alteraria o que se lê), `WorkerList.jsx`(32, inclui os itens de
  menu "Comunicar Admissão"/"Comunicar Cessação" — só o tamanho do texto muda, a submissão real
  continua a viver só no `SSComunicacaoModal.jsx`, por isso convergem sem risco).
  **`WorkerForm.jsx`(48, o maior ficheiro do módulo) — o componente-pai que renderiza o
  `SSComunicacaoModal` como `ModalShell` aninhado (a razão já registada para essa exclusão).**
  Timeline "Ciclo de Vida do Vínculo": os 3 rótulos de etapa (Admissão/Hoje/Cessação) e o cabeçalho
  → `statLabel`; os 9 pills de estado SS ("✓ SS comunicada", "SS por comunicar", "SS rejeitou —
  reenviar", "SS presa a processar", "sem data", "n/a", "encerrado/em curso") → `meta`, nenhum tinha
  `uppercase` no `className` original, e o conteúdo é estado dinâmico real, não decoração — forçar
  maiúsculas mudaria o que se lê. "Apólice de Seguro: {Ativo/Inativo}" (linha 160) → `meta`, mesmo
  motivo. Os nomes de cliente/horário nas listas de checkbox (`{c.name}`/`{s.name}`, sem `uppercase`
  no original) → `meta`; os mesmos nomes truncados dentro do acordeão de "Períodos" (com `uppercase`
  já presente no original) → `badge`, caso em que convergir preserva a renderização atual em vez de a
  mudar. Rótulos de campo (`lbl`, a constante partilhada por ~20 campos do formulário) e os 4
  cabeçalhos de secção ("Dados do Colaborador", "Vínculo", "Enquadramento PSI", "Financeiro", "IRS —
  Situação Fiscal", "Afetação — Clientes & Horários") → `statLabel`. Botão de ação "↻ Iniciar Novo
  Período (reentrada)" e os botões "Gravar/Gravado" dos cartões de período → `badge` (uppercase já
  presente). Aviso de cessação por preparar (frase completa, `leading-relaxed`) → `body`, único uso de
  `body` no módulo. Os 4 `<input type="date">` (Início/Fim de períodos de cliente e de horário) →
  `meta`, valor de formulário sem transformação de caixa. **Achado de execução:** os 4 pares de
  rótulo/valor "Padrão", "Períodos", "Guarde primeiro", "Início", "Fim" repetem-se identicamente entre
  o cartão de Clientes e o de Horários — únicos casos deste módulo em que `replace_all` foi seguro,
  porque as duas ocorrências exigem exatamente a mesma conversão; os `<input>` de data, apesar de
  também parecerem duplicados na classe, precisaram de contexto (`assignedClientDates` vs
  `assignedScheduleDates`, `dataInicio` vs `dataFim`) para não colidir. `grep 'className="[^"]*\${'`
  correu logo a seguir a cada lote de edições, não só no fim — zero ocorrências do bug em todo o
  ficheiro. **Checkpoint ao vivo** em `/admin/team`, editando "Adriel de Jesus dos Santos": "Ciclo de
  Vida do Vínculo"/"Admissão"/"Hoje"/"Nome"/"Profissão"/"Modo Limitado"/"Clientes" medem
  `8px/800/uppercase/0.88px` (`statLabel`); "✓ SS comunicada" e o nome do cliente "Grandes Mecanizados
  del Norte, S.A." medem `10px/600/none` (`meta`), com o nome do cliente confirmado a preservar a
  caixa original, não forçado a maiúsculas. `npx eslint`/`npx vite build` limpos no módulo inteiro (só
  os avisos pré-existentes já conhecidos, sem relação com esta conversão).
  **`features/admin` raiz — último módulo da fila, 425 ocorrências convertidas em 27 ficheiros
  (a estimativa da fila (490) estava acima; recontagem via `grep -o` em vez de `grep -c`, depois de o
  primeiro método ter sub-contado linhas com duas ocorrências — ex. `text-[10px] sm:text-[13px]` numa
  só linha). Fecha a Fase 3 (`SCALE.text`) inteira: não fica nenhum módulo por fazer.**
  Ordem (do menor): `AdminPasswordModal.jsx`/`DocumentsAdmin.jsx`/`FornecedorManager.jsx`/
  `TagBadge.jsx`(1 cada) → `HistoricoDeslocacao.jsx`(2) → `ContadorAcessoPanel.jsx`(3) →
  `TOConlineAdmin.jsx`(4) → `AdminOverview.jsx`(5) → `AdminClassicNav.jsx`(6, sem import de
  `designTokens` nenhum antes — acrescentado de raiz) → `AdminSidebar.jsx`(7) →
  `FinancialReportOverlay.jsx`(5, 4 fora) → `TeamManager.jsx`(9) → `RelatorioModal.jsx`(10) →
  `AlertasAdmin.jsx`(11) → `CsvMappingCard.jsx`(10, 1 fora) → `ScheduleManager.jsx`(11) →
  `AdminReports.jsx`(16) → `ClientManager.jsx`(17) → `ContabilidadeTab.jsx`(17) →
  `AdminSettings.jsx`(22, recontada — a contagem por linha dava 20, mas a linha 412 tinha 3
  `<code>` de nomes de variável de ambiente na mesma linha) → `NotificationsAdmin.jsx`(20) →
  `FaturasAdmin.jsx`(21) → [`src/features/admin/FaturasTab.jsx`](src/features/admin/FaturasTab.jsx)
  (26, 1 fora — caminho completo citado de propósito, colide de nome com
  `src/features/admin/cost-reports/FaturasTab.jsx` já registado acima) → `AdminDashboard.jsx`(37,
  3 fora) → `AjudasCustoAdmin.jsx`(68, 1 fora) → `RecibosCalculadora.jsx`(72, o maior ficheiro de
  todo o `SCALE.text`, zero exceções) → `ValidationPortal.jsx`(22, 2 fora — achado à parte, ver
  abaixo).
  **Duas pendências já resolvidas por módulos anteriores apareceram de novo no varrimento da raiz —
  não são trabalho novo.** `SalariosTab.jsx`(3) e `ReconciliacaoAdmin.jsx`(24) continuam com
  `text-[Npx]` por decisão já tomada nos módulos `salarios` e `reconciliacao` (exceções de dinheiro/
  `.recon-scope` documentadas acima) — o varrimento por pasta apanha-os de novo porque não sabe de
  módulos, só de ficheiros; confirmado que não é regressão nem trabalho esquecido antes de os excluir
  da contagem.
  **`AjudasCustoAdmin.jsx` — a extrema uniformidade do ficheiro (quase todas as 69 ocorrências eram
  literalmente a mesma string `text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]`
  em `<th>`, variando só o alinhamento) permitiu convergir para `statLabel` com 5 `replace_all` — um
  por combinação alinhamento×padding — em vez de 39 edições individuais, sem nenhum risco extra: o
  alvo do token é idêntico nos 39 casos, só o texto da coluna e o `px-4 py-2/3` à volta mudam, e
  nenhum dos dois é tocado pela substituição.** Reduziu um ficheiro de 69 ocorrências a menos de 20
  chamadas de `Edit`.
  **Reapareceu, duas vezes neste módulo, o mesmo bug de sempre — `replace_all` numa substring nua em
  vez do atributo `className` inteiro — apesar de ser exactamente o padrão que este lote já sabia
  evitar.** Em `CsvMappingCard.jsx` e `AdminReports.jsx`, ao convergir 5-6 rótulos de campo
  idênticos com um único `replace_all`, o texto substituído foi só o miolo
  (`text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)] ml-1`) sem incluir
  `className="` nem a aspa de fecho — deixou `${SCALE.text.statLabel}` dentro de uma string plana em
  `className="${SCALE.text.statLabel} ..."`, apanhado de imediato pelo grep rigoroso
  (`className="[^"]*\${`) e corrigido no mesmo passo. **A lição reforçada: a garantia contra este bug
  não é "já vi este padrão antes", é a disciplina mecânica de incluir sempre `className="` → `` className={`...`} `` no mesmo `old_string`/`new_string`, mesmo num `replace_all` de uma substring
  que parece inofensiva.** Confirmado zero ocorrências do bug em todo o módulo depois da correcção.
  **Achado, não decisão tomada — `ValidationPortal.jsx` pode ser código morto, mas a prova não é
  conclusiva.** Zero imports em todo o `src/` (`ValidationPortalProvider`/`ValidationPortal` não
  aparecem fora do próprio ficheiro e do seu contexto dedicado), mas duas sondas candidatas
  (`"Anular validação?"`, `"Erro ao anular:"`) deram falso positivo no bundle — ambas as frases
  existem também em `src/features/admin/client/ClientEnviosPanel.jsx` (módulo `client`, confirmado
  vivo), que partilha código quase idêntico com este ficheiro; a presença no bundle não distingue as
  duas origens. Git log mostra histórico real e recente (`e3158c8`, `d710e1a`, commits de feature até
  2026), não uma sobra órfã óbvia. Convertido normalmente (é seguro de qualquer forma, vivo ou morto)
  — fica registado para quem um dia arrumar código morto confirmar com uma sonda genuinamente única
  (string que não exista em `ClientEnviosPanel.jsx`) antes de decidir.
  **Checkpoint ao vivo** em `/admin/recibos` (RecibosCalculadora, o ficheiro de dinheiro mais
  sensível de toda a Fase 3): "TRABALHADOR"/"① DADOS DO TRABALHADOR"/"TOTAL ABONOS"/
  "LÍQUIDO A RECEBER"/"MAPA DE AJUDAS DE CUSTO" medem `8px/800/uppercase` (`statLabel`); o nome do
  trabalhador "Adriel de Jesus dos Santos" preserva a caixa original, sem forçar maiúsculas. Em
  `/admin/ajudas-custo`: cabeçalho de tabela "Cliente" mede `8px/800/uppercase`, o nome do cliente
  "Caldereria Kortaberri, S.L" preserva a caixa. Em `/admin/overview`, o dropdown de notificações do
  `AdminDashboard.jsx` mede "Pedido de Ausência" a `8px/800/uppercase` e a data/hora a `10px/600/none`,
  nome do trabalhador preservado. `npx eslint`/`npx vite build` limpos no módulo inteiro (só os
  avisos pré-existentes já conhecidos nestes ficheiros, sem relação com esta conversão).
  **`salarios` — primeiro módulo de dinheiro desta frente, feito com verificação extra de
  coexistência cor/tamanho.** 5 ficheiros: `JustificarModal.jsx`(5), `SalarioEmployeeCard.jsx`(8),
  `AssocTransacaoModal.jsx`(11, 1 fora — `text-[12px]` da descrição do movimento bancário, fora dos 4
  tamanhos do `SCALE.text`), `SalariosTab.jsx`(35, 3 fora — 2× `text-[12px]` de mensagens de estado
  vazio, e 1 dentro do bloco `.recon-scope` de "Lote SEPA" já documentado, linhas 696-735, não tocado
  por decisão já registada), `ImportarIBANsModal.jsx`(0, fora de âmbito). **Antes de tocar em
  `SalarioEmployeeCard.jsx`, confirmado ao vivo com dados reais (não só por leitura de código) que o
  padrão `text-[10px] ... text-[var(--tone-amber)]` já existente na linha 34 resolve `fontSize` e
  `color` como declarações CSS separadas** — medido no browser: `fontSize: 10px`, `color: rgb(187, 77,
  0)` (= `--tone-amber`), a mesma mecânica já confirmada em `corrections`, agora reconfirmada de forma
  independente com o badge real "N pendente(s)" em `/admin/reconciliacao/salarios`. Depois da
  conversão para `SCALE.text.badge`, medido de novo: `fontSize: 9px`, mesma `color`, cor preservada.
  Checkpoint ao vivo completo: resumo (`Trabalhadores`/`Match Exato`/`Pendentes` a 8px/800/uppercase,
  confirmado via `getComputedStyle`), filtros de mês, e um cartão de trabalhador expandido (badges
  "Saldo Pendente", valores, botão "Justificar") — sem regressão visual em nenhum.

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

  ## Fluxo de redesenho visual (mockups em chat)

Processo estabelecido: Diego cola HTML/screenshots de uma tela real no Claude (chat), que constrói
um mockup HTML interativo de referência antes de qualquer implementação. O mockup usa cores/hex
aproximados só para comunicar estrutura, hierarquia e comportamento — **nunca são a fonte de
verdade de cor**, pela mesma razão que qualquer valor deste ficheiro é medido, não assumido.

**Ao implementar a partir de um desses mockups:**

1. Ignorar os hex literais do mockup. Ler `src/styles/designTokens.js` + `src/index.css` para os
   tokens reais.
2. Decidir qual sistema de cor de estado se aplica, não assumir `--ok/--warn/--bad` por serem os
   nomes mais óbvios:
   - Estado simples binário/ternário (válido/pendente/expirado, turno fixo/variável) → `--ok`/
     `--warn`/`--bad`.
   - Hierarquia de peso dentro do mesmo cartão (rótulo vs. metadado vs. valor vs. identidade, como
     em Correções/Faturação) → família `--tone-{amber,emerald,rose,indigo}-{label,meta,value,identity}`.
   - Se nenhum dos dois encaixar (cor é *dado*, não estado — ex. paleta de categorias de documento
     à escolha do utilizador), não forçar semântica: tratar como mapa de cor-à-escolha, mesmo
     critério já usado em `TagBadge.jsx`/`constants/rhCategories.js`.
3. Qualquer par texto+fundo novo introduzido pelo mockup (badge, chip, faixa lateral) precisa de
   medição de contraste nos dois modos antes de ser dado como pronto — mesma disciplina do resto
   deste ficheiro, incluindo desconfiar do instrumento de medição (ver "Armadilhas conhecidas").
4. Convenções recorrentes já validadas nos mockups, para reaproveitar sem redesenhar do zero:
   fita de dias compacta de 7 posições; valores ausentes em itálico neutro ("sem intervalo", "Não
   disponível") em vez de placeholders tipo `--:--`; badges de estado ligados à condição real dos
   dados, não fixos; faixa lateral fina de cor para categorização rápida de cartões; contagens como
   chips, não texto solto; modais com 3 colunas apertadas reestruturados em abas com progressive
   disclosure (itens selecionados como chips que expandem um de cada vez, não cartões sempre
   abertos); icon-buttons com hover neutro, vermelho só em ações destrutivas.
5. Cada mockup aprovado vem acompanhado de um prompt de implementação em PT, colado pelo Diego
   nesta sessão. Confirmar os ficheiros reais citados no prompt contra este

## Carimbo redesenhado (2026-09-02) — substitui a Opção D nos 3 templates reais

**Ronda de exploração longa em artefactos** (`Artifact`, não ficheiro estático copiado como nas
rondas anteriores): partiu de 4 modelos iniciais (rejeitados: "não gostei"), depois 4 modelos numa
direção DocuSign/nota-oficial (Modelo 4 "Verificação Moderna" e Modelo 7 "Nota Oficial" ficaram
"mais ou menos"), depois 4 variações do Modelo 7 ("Aviso com Selo" escolhido), depois testes de
marca de água (mosaico repetido → logo único; tamanho A/B/C → A escolhido), depois 4 variações do
selo final (V3 "QR no canto" escolhido), depois confirmação explícita do Diego de manter a imagem
real da assinatura (não só o selo de confirmação — pergunta feita via `AskUserQuestion` antes de
avançar, por ser mudança grande para documento legal), depois a integração da assinatura dentro do
V3 (4 variações — "D: assinatura solta, sem caixa" escolhida), depois mais campos de verificação
("N.º do documento" + "Aprovado em" — E3 escolhida), depois 4 correções via comentário no artefacto
(remover título repetido/consolidar selo+QR+ID numa linha; bola verde+"Documento assinado
eletronicamente" sem "nos termos da lei"; marca de água só atrás da assinatura da Entidade
Patronal, não do carimbo inteiro; marca de água maior + ID antes do QR; por fim ID por baixo do QR,
os dois só no lado direito).

**Achado real, descoberto antes de implementar, não assumido:** o mockup final tinha dois campos
que pareciam dois códigos diferentes — "N.º do documento" (ex. `WD-240831-1147`) e o "ID" junto ao
QR (ex. `ADJ-8KRW`) — mas no código só existe **um** identificador real
(`verification_code`, gerado em `handleApproveDocument`). Não havia nenhum sistema de "número de
documento" sequencial por trás do valor do mockup — era só um exemplo ilustrativo inventado para a
maquete. Confirmado com o Diego antes de implementar (`AskUserQuestion`): os dois campos mostram o
**mesmo** `{verification_code}`, só com rótulos diferentes — nenhum sistema novo construído.

**Substitui por completo o bloco anterior (Opção D, dois cartões lado a lado com grelha de
campos)** — `.stamp-row`/`.stamp-card-*`/`.stamp-swatch` (com moldura)/`.stamp-rows`/
`.stamp-field`/`.stamp-foot`/`.stamp-note` saem; entram `.stamp-block`/`.stamp-parties`/
`.stamp-party`/`.stamp-swatch` (sem moldura, "assinatura solta")/`.stamp-role`/`.stamp-name`/
`.stamp-time`/`.stamp-meta`/`.stamp-final`. Estrutura final, de cima para baixo:

1. Filete laranja (`.stamp-rule`, 2px).
2. Duas colunas lado a lado (`.stamp-parties`), Trabalhador | Entidade Patronal — cada uma com a
   imagem real da assinatura **sem caixa/moldura** (`.stamp-swatch`, `height:50px`,
   `object-fit:contain`, mesma técnica já validada no carimbo anterior), depois cargo (uppercase
   via CSS, não no HTML), nome, data/hora. Marca de água do logótipo real (`icon-512x512.png`,
   150×150px, opacidade 0.11) fica **só atrás da coluna Entidade Patronal** (`.stamp-party-admin
   .stamp-wm`), não atrás do carimbo inteiro — decisão explícita do Diego via comentário no
   artefacto, ao contrário do checkerboard de duas camadas que cobria o carimbo todo na versão
   anterior (Opção D).
3. Linha "N.º do documento" / "Aprovado em" (`.stamp-meta`, `justify-content:space-between`) — os
   dois valores reais já existentes (`{verification_code}`, `{admin_signed_datetime}`), sem campo
   novo nenhum.
4. Filete cinzento fino (`.stamp-final-rule`).
5. Linha final (`.stamp-final`, `justify-content:space-between`): selo verde com check branco
   (`#1f6b47`, o mesmo valor já validado no projeto para "aprovado", não o laranja/navy do selo
   antigo) + "Documento assinado eletronicamente" à esquerda; QR (`{verification_qr}`) com o
   `{verification_code}` por baixo, os dois juntos e alinhados à direita.

**Nome da Entidade Patronal corrigido depois da primeira gravação** — a primeira versão manteve o
literal "MAGNETIC PLACE UNIPESSOAL LDA" (tudo maiúsculas) herdado da Opção D; o Diego pediu o nome
em capitalização normal ("Magnetic Place Unipessoal LDA"), corrigido nos 3 templates com uma
segunda gravação, confirmada por SQL (`template_html like '%Magnetic Place Unipessoal LDA%'`).

**Método de execução, mesmo já usado nesta sessão para a Opção D — sem SQL colado na conversa:**
scripts Node locais (`@supabase/supabase-js`, credenciais do `.env`) fazem
fetch→transformar-por-âncora→gravar. A transformação desta vez localizou as âncoras
(`.stamp-row {` → `.footer {` para o CSS; `<div class="stamp-row">` → `<div class="footer">` para o
HTML) **programaticamente via `indexOf`/`slice`**, não por `Edit` com o texto old_string/new_string
colado à mão — o bloco antigo inclui uma imagem checkerboard em base64 de ~30KB numa única linha,
impraticável de citar literalmente numa chamada de ferramenta. Confirmado, antes de gravar, que os
3 templates tinham exactamente o mesmo bloco CSS e HTML byte-a-byte (`grep`/`Read` comparados lado a
lado) — a mesma transformação por âncora aplicou-se aos 3 sem adaptação por ficheiro.

**Verificado ao vivo, à largura real da página (794px, não a largura menor do painel de
pré-visualização — lição já registada noutra secção deste ficheiro sobre medir "à largura
verdadeira"):** os 3 templates, com dados de teste (assinaturas SVG inline, QR fake, nome/datas
reais) copiados para `public/_scratch_test.html` — carimbo renderiza correctamente nos 3
(EPI/RGPD/Contrato), marca de água visível só atrás da assinatura da Entidade Patronal, filetes e
espaçamento correctos. Testado também o estado **por preencher** (template em bruto, sem
substituição de placeholders) — os `{worker_signature}`/`{admin_stamp}`/etc. ficam legíveis como
texto placeholder discreto dentro da caixa da assinatura (`font-size:9px;color:#94A3B8`, herdado da
Opção D), sem quebrar layout. Confirmado por SQL (`execute_sql`, projeto `ccvxnrnlbipsojbbrzaw`) que
os 3 `template_html` gravados contêm `stamp-block` e já não contêm `stamp-row`.
**Não testado ainda** o fluxo real ponta-a-ponta (trabalhador assina → admin aprova → PDF real
gerado pela PDF.co) com este bloco novo — os lotes anteriores desta sessão sempre fecharam com esse
teste real antes de dar como definitivamente resolvido; fica como pendência explícita antes do
próximo documento real assinado com este carimbo.

**Decisão registada, não implementada — Diego perguntou, opinião dada, sem mudança de código:**
colocar o IP do trabalhador visível no próprio carimbo (documento/PDF), não só na página de
verificação pública. Recomendação: não pôr — o IP já fica em trilha de auditoria server-side
(`worker_documents.signed_ip`, Fluxo 2) para o caso raro de disputa, mas imprimi-lo no documento
tem baixo valor probatório (redes móveis/partilhadas/VPN tornam o IP pouco fiável como prova) e
expõe um dado pessoal desnecessário num documento que pode circular indefinidamente — mesmo
princípio já decidido para a página pública de verificação ("nunca IP", ver secção "Carimbo Opção E
+ validação de assinaturas" acima). Diego não pediu para reabrir esta decisão, só pediu opinião.

## Bug real de paginação A4 no PDF real (2026-09-02) — achado ao testar ponta-a-ponta

**Diego testou o fluxo real (assinou como trabalhador, aprovou como admin) no Contrato — o PDF
gerado pela PDF.co tinha 3 páginas: uma cláusula cortada a meio entre página 1 e 2, e uma 3.ª
página quase vazia (só o rodapé sozinho).** Pedido: "otimize tudo para uma folha A4 inclusive as
quebras de página".

**Achado metodológico, antes de qualquer correção — o instrumento de medição habitual desta sessão
(`getBoundingClientRect()` num browser normal) não serve para validar quebras de página.** Um
browser normal nunca pagina conteúdo — só a exportação real (impressão/PDF) o faz. Medir a altura
acumulada de elementos e comparar contra múltiplos de 1123px (a altura A4 a 96dpi, já confirmada
nesta sessão) só prevê *aproximadamente* onde o motor vai cortar, mas não confirma se uma correção
de CSS (`page-break-inside`, `break-inside`, mesmo `page-break-before:always` inline) teve
qualquer efeito — o browser ignora essas propriedades fora de um contexto real de paginação.
**Descoberto por controlo negativo:** apliquei `page-break-before:always` inline diretamente no
`<div class="footer">` (a propriedade de quebra mais básica e universalmente suportada) e o PDF
gerado ficou byte-a-byte equivalente em contagem de texto por página ao original sem a regra — só
aí ficou claro que a "correção" não estava a ser testada onde importa.

**Ferramenta de verificação construída para este achado, reutilizável para qualquer dúvida futura
sobre paginação real:** o projeto já tinha `playwright`/`playwright-core` instalado (usado pelos
testes e2e) — usado aqui para gerar um PDF real via `chromium.launch()` → `page.goto('file://...')`
→ `page.pdf({ format:'A4', margin:{...0} })`, o mesmo motor Chromium subjacente que a PDF.co usa
(confirmado no início desta sessão por extração vetorial: páginas reais a exatos 794×1123px/96dpi
antes do escalamento final). Depois, `pdfjs-dist` (já usado nesta sessão para inspecionar PDFs
reais) lê o PDF gerado e devolve número de páginas + texto de cada página — permite confirmar por
inspeção direta se uma frase específica aparece inteira numa só página, sem depender de medição de
scroll. Testado com o `generated_html` real do documento de teste do Diego
(`worker_documents.verification_code = 'DRB-MKKL'`), não com dados sintéticos — o texto mais longo
que ele escreveu num campo livre ("Magnetic Place - obra localizada em trofa 123456789") é
precisamente o que empurrou o documento para 3 páginas.

**Causa raiz real, confirmada por bissecção:** não foi falta de `page-break-inside`/`break-inside`
(essas propriedades funcionam neste motor — confirmado num teste isolado mínimo antes de se
suspeitar de outra coisa) — foi simplesmente **o documento ultrapassar por poucos pixels o
orçamento de páginas inteiras** (2×1123px), e o motor de paginação real do Chromium arredonda
blocos compostos (flex/table) para a página seguinte inteiros em vez de os encolher, mesmo quando
a medição ingénua por scroll sugeria que ainda cabiam por uma margem de 4-12px — a medição em
scroll normal e a paginação real do motor de impressão **não coincidem exatamente**, mesmo para o
mesmo documento. A correção não foi adicionar mais controlo de quebra (isso já lá estava e não
mudava nada sozinho) — foi **dar folga real**, cortando espaçamento vertical sobrante.

**Correção aplicada aos 3 templates (`.page`/`.stamp-block`/`.stamp-rule`/`.stamp-meta`/
`.stamp-final-rule`):**
- `.page` padding-bottom `40px`→`16px` (o footer já tem a sua própria separação por `border-top`,
  não precisava de tanto espaço morto depois).
- `.stamp-block` margin-top `40px`→`24px`, padding-top `20px`→`14px`.
- `.stamp-rule` margin-bottom `18px`→`12px`.
- `.stamp-meta` margin-top `12px`→`8px`.
- `.stamp-final-rule` margin `14px/12px`→`10px/8px`.
- Mais, como hygiene defensiva para documentos futuros mais longos (não mudou nada no teste atual,
  mas não custa e pode ajudar em casos-limite diferentes): `page-break-inside:avoid;
  break-inside:avoid-page;` em `.field`, `.fields-row`, `ol.declara li`, `.epi-list`,
  `.stamp-block`, `.section-label`, `.doc-title`, `.title-band`, `.footer`.

**Verificado com o motor real (não estimado), antes e depois:**
- **Contrato** (o único dos 3 que já passava de 1 página, 9 cláusulas): antes 3 páginas (cláusula
  4.ª cortada a meio entre a 1.ª e 2.ª; 3.ª página só com o rodapé, 41 caracteres) → depois **2
  páginas limpas**, a cláusula inteira ("...trofa 123456789...") confirmada presente por completo
  numa só página via `pdfjs-dist`, sem página residual.
- **EPI**/**RGPD** (mais curtos): confirmado que continuam a caber numa única página depois da
  correção, sem regressão.
- Confirmado visualmente no browser que o carimbo, com os espaçamentos reduzidos, continua com
  boa aparência — não ficou apertado.
- Gravado nos 3 templates reais via Supabase, confirmado por SQL
  (`template_html like '%avoid-page%'` e `like '%padding: 48px 56px 16px%'`, ambos `true` nos 3).

**Pendência:** esta correção foi validada com Playwright/Chromium local, não com uma chamada real
à API da PDF.co (a `VITE_PDFCO_API_KEY` é uma env var sensível só existente em produção/Vercel,
irrecuperável localmente — já registado noutra secção deste ficheiro). Alta confiança por os dois
motores partilharem a mesma base Chromium e a mesma geometria de página já confirmada
anteriormente, mas o próximo documento real assinado é que fecha a verificação de facto.

## Dois bugs reais no carimbo, achados pelo Diego ao testar em telemóvel (2026-09-02)

**Feedback com 2 screenshots do telemóvel: (1) "os dados do assinante está desalinhado com o lugar
que vai a assinatura"; (2) "quero que esteja visualmente limitado o espaço disponível para a
assinatura no painel do worker".**

**Achado 1 — a assinatura ficava centrada na caixa, mas o nome por baixo fica alinhado à
esquerda.** Causa raiz confirmada por medição real (`getBoundingClientRect`), não suposta: as duas
colunas (Trabalhador/Entidade Patronal) estavam perfeitamente simétricas entre si — não era um
problema de simetria horizontal. O problema real: `.stamp-swatch` tinha `justify-content: center`
(herdado da versão "com moldura" de uma ronda anterior do design, nunca ajustado quando a versão
final passou a ser "assinatura solta, sem caixa"), enquanto `.stamp-role`/`.stamp-name` (o nome por
baixo) são texto normal, alinhado à esquerda por omissão — os dois nunca partilhavam o mesmo eixo.
**Achado secundário, mais importante que o primeiro** ao tentar corrigir só via CSS do template:
mudar `justify-content` no `.stamp-swatch` não tinha efeito nenhum na imagem REAL da assinatura,
só no texto placeholder — porque `handleApproveDocument` (`useDocumentTemplates.js`) insere a
`<img>` com `style="width:100%;height:100%;object-fit:contain;"` **inline**, que sempre vence a
classe `.stamp-swatch img` do template (mesma regra da cascata já documentada várias vezes neste
ficheiro: `style` inline > classe, salvo `!important`). Como a imagem ocupa sempre 100% da largura
da caixa, `justify-content` do pai deixa de ter qualquer efeito — o alinhamento real é controlado
por `object-position`, não pela flexbox do contentor.
**Correção em dois sítios, não um:** `object-position: left center` acrescentado (1) ao `style`
inline gerado em `useDocumentTemplates.js` para `{worker_signature}`/`{admin_stamp}` (a correção
que importa de facto, para assinaturas reais) e (2) à classe `.stamp-swatch img` nos 3 templates
(redundante com o inline, mas mantém o preview "por preencher" — sem dados reais, só o texto
placeholder — consistente, já que aí não há `style` inline nenhum a sobrepor-se). `justify-content`
do `.stamp-swatch` também corrigido para `flex-start`, por doença semelhante — sem efeito na
imagem real, mas ajusta o texto placeholder do preview em bruto.
Verificado ao vivo, com uma assinatura de teste desenhada deliberadamente estreita (para expor bem
o efeito do `object-position`): antes ficava centrada, com espaço vazio para os dois lados; depois
começa exactamente no mesmo ponto vertical que "TRABALHADOR"/nome por baixo, nos 3 templates.

**Achado 2 — o canvas de assinatura do trabalhador não tinha limite de altura em mobile.**
`SignDrawModal.jsx` (`src/components/worker/SignDrawModal.jsx`, partilhado por Fluxo 2 e Fluxo 3 —
`HtmlDocumentViewer.jsx` importa-o directamente, sem wrapper próprio) tinha o contentor do canvas
com `flex-1 sm:flex-none` + `minHeight:'200px', height:'auto'` — em mobile (`flex-1` dentro de um
modal `h-full`), o canvas esticava para preencher quase o ecrã inteiro (confirmado no screenshot do
Diego: canvas quase quadrado/vertical, ocupando a maior parte de um ecrã de telemóvel). Isto não é
só feio — produz assinaturas com uma proporção completamente desligada da caixa final onde vão
parar (`.stamp-swatch`, larga e baixa, ~327×50px — ratio ~6,5:1), o que faz com que, mesmo com o
`object-position` corrigido, uma assinatura desenhada alta-e-estreita fique pequena e sem preencher
bem a caixa larga-e-baixa do carimbo.
**Correção:** `flex-1 sm:flex-none` + `minHeight:'200px', height:'auto'` → `flex-shrink-0` +
`height:'170px'` (altura fixa, igual em mobile e desktop, `ratio` mais "paisagem" que o anterior,
sem ser tão extremo quanto o ratio real da caixa final, que tornaria o desenho impraticável a
dedo). **Zona sensível, tratada com o cuidado já documentado** (ver Fluxo 2 acima — "os canvas de
assinatura são dimensionados por JavaScript a partir de `parent.clientWidth`/`clientHeight`... se
mudares o layout do pai, o traço sai distorcido, e fica gravado assim num documento legal"): a
mudança só fixa a ALTURA do contentor antes do canvas ser inicializado (o `useEffect` de setup só
corre uma vez no mount, lendo `parent.clientWidth/clientHeight` já com a nova altura fixa) — não
mexe em nenhum traço já desenhado, nem na lógica de captura de coordenadas. Verificado com uma
réplica isolada do modal (HTML estático com a mesma estrutura/classes, viewport mobile 375×812):
antes, o wrapper `h-full` + canvas `flex-1` ocupava quase o ecrã todo; depois, a caixa de desenho
fica claramente contida (170px), com o resto do modal compacto por baixo.
**Só corrigido em `SignDrawModal.jsx` (painel do worker), por pedido explícito — `AdminSignDrawModal.jsx`
tem exactamente o mesmo padrão (`flex-1 sm:flex-none`, `minHeight:'200px'`) e o mesmíssimo problema,
mas fica por resolver até o Diego pedir, para não alargar o âmbito sozinho.**

Gravado nos 3 templates via Supabase (confirmado por SQL,
`template_html like '%object-position: left center%'` `true` nos 3); `npx eslint` limpo em
`SignDrawModal.jsx` e `useDocumentTemplates.js`. Não confirmado ao vivo dentro da app real (o
dashboard do trabalhador continua atrás do bloqueio de sessão 403 já registado várias vezes nesta
sessão) — confiança apoiada na réplica isolada idêntica em estrutura/classes e na leitura cuidadosa
do `useEffect` de setup do canvas, que não muda de comportamento, só o valor de altura de entrada.

**Achado a seguir, mesmo dia — pré-visualização do template descentrada.** O Diego reportou (com
screenshot) o preview "por preencher" do EPI encostado à esquerda do modal, com uma faixa de vazio
à direita — não era a página em si (que já tem `width:794px;margin:0 auto` desde a correcção de
largura fixa desta sessão), era o **wrapper escalado do `FitToWidthHtmlFrame.jsx`**: o `outer`
(`absolute inset-0 overflow-auto p-4`) é um bloco normal sem `justify-content`, e o `wrapper`
(que recebe `width`/`height` calculados em JS, já em pixels pós-escala) nunca teve `margin` nenhum
— sempre que o modal fica mais largo que 794px (`scale` fica `clamped` a 1 via `Math.min(1, ...)`),
sobra espaço à direita e, sem centering, o bloco cai à esquerda por omissão. Corrigido com
`margin: '0 auto'` no `style` inline do wrapper (uma linha, no componente partilhado — corrige os
3 consumidores de uma vez: `DocxPreviewModal.jsx`, `HtmlDocumentViewer.jsx`, `WorkerDocuments.jsx`).
Verificado com uma réplica isolada fiel ao mecanismo real (mesmo `applyFit()`, mesmo template EPI
real buscado do Supabase, mesma largura de modal 880px do `ModalShell` `size="viewer"`): antes,
encostado à esquerda; depois, centrado (margem esquerda/direita a ~36px/~51px — a pequena diferença
é só a largura da barra de scroll do `outer`, que reduz o espaço disponível de um lado só,
imperceptível visualmente). `npx eslint` limpo. Não confirmado dentro da app real pelo mesmo
bloqueio de sessão já registado.

**Achado a seguir, mesmo dia — assinatura real cortada, achado com o próprio Diego a assinar de
verdade e a circular o problema num screenshot.** Ele usou o canvas todo (170px, já corrigido) e a
assinatura saiu cortada no documento — o traço ultrapassava a caixa (`.stamp-swatch`,
`overflow:hidden`) e transbordava para cima, sobre o parágrafo anterior. **Não era o mesmo sítio já
corrigido hoje** (`useDocumentTemplates.js`'s `handleApproveDocument`, que já tinha
`width:100%;height:100%;object-fit:contain;object-position:left center`) — a correção de manhã
resolveu o carimbo *final* (depois de o admin aprovar), mas o Diego estava a ver a
**pré-visualização do documento ainda por aprovar** (o "olho" no ecrã "Documentos" do admin,
`useDocumentsAdmin.js`'s `openGeneratedPreview` — reaproveita `generated_html` com
`{worker_signature}` ainda literal e resolve-o só para mostrar, sem gravar, deixando
`{admin_stamp}` por resolver). **Este segundo sítio tinha um `style` completamente diferente e
desactualizado**, resíduo de uma versão antiga do carimbo (antes do redesenho desta sessão):
`style="max-width:220px;max-height:90px;"` — sem `width`/`height` fixos, sem `object-fit`. Sem
estar limitada a 100%/100% do pai, a imagem podia ocupar até 220×90px reais — muito maior que a
caixa real (327×50px) — e como `.stamp-swatch` tem `overflow:hidden`, o excesso ficava cortado.
Confirmado por grep em todo o `src/` que era o único sítio com este padrão desactualizado (`"max-
width:220px"`/`"max-height:90px"`, zero outras ocorrências).
**Correção:** mesmo `style` já usado no sítio bom —
`width:100%;height:100%;object-fit:contain;object-position:left center;`.
**Verificado com a assinatura REAL do Diego** (não sintética — buscada de
`worker_documents.signature_data`, o documento exacto do screenshot,
`id=468a6c83-1533-4c91-9a24-b408242b1e7d`), renderizada com o `style` antigo vs. o novo lado a
lado: antes, o traço cruzava visivelmente a régua laranja por cima da caixa; depois, medido por
`getBoundingClientRect()`, a imagem fica exactamente dentro dos limites de `.stamp-swatch`
(mesmo `top`/`bottom` que a própria caixa, 50px de altura, sem overflow). `npx eslint` limpo.

**Fluxo real confirmado a funcionar ponta-a-ponta pela primeira vez com o carimbo novo** — o Diego
assinou como trabalhador e aprovou como admin de verdade (`verification_code=DRB-ED5C`,
notificação "Documento aprovado" no telemóvel), sem passar por nenhum dos bugs já corrigidos hoje.

**Último ajuste, mesmo dia — esquerda vs. centro.** Com o alinhamento à esquerda (corrigido mais
cedo hoje, para bater a assinatura com o texto por baixo), o bloco assinatura+nome+cargo+data
ficava a ocupar só uma fracção da largura da coluna (327px), sobrando um vazio grande à direita —
visualmente desequilibrado. Diego pediu para deslocar para a direita, ou seja, **centrar o bloco
inteiro dentro da coluna**, não voltar ao problema original (assinatura centrada sozinha, texto à
esquerda) — desta vez os dois lados do carimbo (imagem e texto) passaram a **centrar juntos**, em
vez de ficarem ambos à esquerda: `.stamp-party` ganhou `text-align: center` (aplica-se a
`.stamp-role`/`.stamp-name`/`.stamp-time`, texto normal sem align próprio); `.stamp-swatch`
voltou a `justify-content: center`; `object-position` passou de `left center` para `center` nos
dois sítios que resolvem `{worker_signature}`/`{admin_stamp}` com dados reais
(`useDocumentTemplates.js`, `useDocumentsAdmin.js`) e na classe `.stamp-swatch img` dos 3
templates (consistência do preview "por preencher"). **`.stamp-meta` ("N.º do documento"/"Aprovado
em") não foi tocado** — Diego não o incluiu no que circulou, continua `justify-content:
space-between`, a abranger a largura toda da página, por decisão de layout já correcta.
Verificado com a mesma assinatura real de antes (`worker_documents.verification_code=DRB-ED5C`,
o documento exacto do último screenshot): medido por `getBoundingClientRect()` que o centro
horizontal da coluna, do nome e da imagem da assinatura coincidem exactamente (mesmo valor de
píxel, 290px, nos 3). `npx eslint` limpo em `useDocumentTemplates.js`/`useDocumentsAdmin.js`.

**Última correção do dia — duas réguas sobrepostas no preview "por preencher".** `.stamp-block`
tinha `border-top: 1px solid #E2DED4` (cinzento, resíduo herdado da Opção D, onde essa borda era o
único separador) mais o `.stamp-rule` (2px laranja) logo a seguir, 14px de padding depois — as
duas ficavam visualmente coladas. Diego pediu para manter só a laranja. Removido o `border-top`
de `.stamp-block`, mantido `margin-top`/`padding-top` (só espaçamento, sem linha). Confirmado ao
vivo no preview em bruto do EPI: só a régua laranja visível. Gravado nos 3 templates, confirmado
por SQL.

**Achado real a seguir, mesmo dia — a marca de água transbordava por cima da régua laranja.**
Diego reportou (screenshot circulado) espaço vazio a mais antes do carimbo, e a régua a aparecer
"por cima da marca d'água". Medido antes de mexer (`getBoundingClientRect`, não suposto): a marca
de água (`.stamp-wm`, 150×150px, centrada por `top:50%;left:50%;transform:translate(-50%,-50%)`
dentro de `.stamp-party-admin`) tinha o seu `top` real em 783px, enquanto a régua acima
(`.stamp-rule`) terminava em 799px — a marca de água começava **antes** do fim da régua, porque a
coluna `.stamp-party` onde está centrada só mede ~93px de altura (muito menos que os 150px da
própria marca de água) e **não tinha `overflow:hidden`** — o excesso (28px) transbordava para
cima, por cima da régua, que por não estar posicionada (`position:static`) fica visualmente por
baixo de qualquer elemento posicionado (a `.stamp-party`/`.stamp-wm`), mesmo vindo antes no DOM.
**Correcção:** `.stamp-party` ganhou `overflow: hidden` — contém a marca de água dentro dos
limites da própria coluna, sem lhe tocar no tamanho (continua 150×150, só passa a ficar cortada
pelos próprios limites da coluna, tal como já acontecia com `.stamp-swatch`). Espaçamento também
reduzido, por pedido explícito: `.stamp-block` `margin-top` 24→14px, `padding-top` 14→10px;
`.stamp-rule` `margin-bottom` 12→8px.
**Verificado com a assinatura REAL do Diego** (mesmo documento aprovado, `verification_code=
DRB-ED5C`): visualmente, a régua fica limpa, sem sobreposição da marca de água; a marca de água
continua visível (discreta, atrás da assinatura da Entidade Patronal), só deixou de ultrapassar os
limites da própria coluna; o espaço antes da assinatura ficou mais compacto sem parecer apertado.
Gravado nos 3 templates, confirmado por SQL.

**Fecho do dia — margem inferior da página e espaço antes do rodapé, a partir de um PDF real
circulado pelo Diego.** Dois pedidos: "margem inferior quase 0" (o vazio entre o fim do conteúdo
e o fim físico da folha A4) e reduzir bastante a distância entre "Documento assinado
eletronicamente"/QR e o rodapé ("Magnetic Place — Unipessoal, Lda." / "EPI-01").
Correção: `.page` padding-bottom `16px`→`4px`; `.footer` `margin-top` `32px`→`10px`,
`padding-top` `12px`→`8px`.
**Achado ao medir o PDF real (não assumido) — o espaço vazio no fundo de um documento curto
(EPI) não vem só do padding controlável.** Medido com a mesma técnica de extração vetorial já
usada nesta sessão (`pdfjs-dist`, posição Y do último texto real): mesmo com o padding-bottom
já em `4px`, sobravam ~78pt (≈27mm) de vazio antes do fim físico da página A4 — porque o
conteúdo do EPI (documento curto) simplesmente não preenche uma folha A4 inteira, e não há
mecanismo nenhum (nem deve haver, dado o compromisso desta sessão com A4 fixo) que estique o
conteúdo para preencher a folha. **O padding controlável está agora em `4px`, o mínimo razoável
sem colar literalmente ao bordo** — o vazio remanescente para documentos curtos é inerente ao
documento ter menos conteúdo do que uma página A4, não uma margem por afinar. Só é totalmente
invisível em documentos longos como o Contrato (2 páginas, a segunda quase cheia).
**Verificado sem regressão no caso sensível (Contrato, 9 cláusulas):** PDF real gerado com o novo
padding continua em exactos 2 páginas, mesma repartição de texto por página já confirmada
anteriormente — reduzir a margem não introduziu quebra nova nem reabriu o bug da 3.ª página
quase vazia já corrigido hoje. Gravado nos 3 templates, confirmado por SQL.

## Página física encolhida ao conteúdo real + cartão de assinaturas escondido no preview do worker (2026-09-02)

**Pedido do Diego, com screenshot de um PDF real (EPI, `verification_code=DRB-52CX`) aberto num
leitor de PDF no telemóvel, com um rabisco a marcar todo o espaço vazio entre o rodapé e o fim
físico da folha:** "quero que eliminei todo esse espaço" + "no preview do DB do worker não é
necessário aparecer esse card das assinaturas".

**Parte 1 — espaço vazio no fim da página.** Reabre, por pedido explícito, a decisão anterior desta
sessão ("não há mecanismo nenhum, nem deve haver, dado o compromisso com A4 fixo, que estique o
conteúdo para preencher a folha") — o compromisso passou a ser o inverso: encolher a página física
ao conteúdo, não o contrário. Confirmado com a documentação real da PDF.co
(`/pdf/convert/from/html`) que o `paperSize` aceita dimensões custom, mas a via escolhida foi mais
simples e já validada nesta sessão: o próprio `@page { size: A4; margin: 0; }` embutido no HTML já
é o mecanismo comprovado a controlar o tamanho físico real da página (confirmado por extração
vetorial em rondas anteriores) — só é preciso trocar o valor `A4` por um tamanho custom
`794px {H}px`, sem tocar em `pdfCoService.js` nem introduzir nenhum parâmetro novo na chamada à API.

**`measurePageHeightPx(html)` nova, em `useDocumentTemplates.js`:** renderiza o `finalHtml` (já com
todos os placeholders resolvidos) num iframe escondido (`position:fixed;left:-9999px`, nunca
`display:none` — isso zeraria as dimensões) e lê `getBoundingClientRect().height` do `.page` depois
do `onload`. Só documentos de 1 página só (medida < 1123px, o orçamento de uma A4 a 96dpi) recebem
`@page` customizado (`Math.ceil(medida) + 6px` de margem de segurança); documentos mais longos
(Contrato) mantêm `@page:A4` inalterado — o mecanismo de paginação em várias páginas já testado
nesta sessão não é tocado. `finalHtml` passou de `const` para `let` só para permitir esta segunda
passagem de `.replace(...)`, sem mudar mais nada no resto da função.

**Verificado com o motor real (Playwright/Chromium, mesma técnica já validada nesta sessão para o
bug de paginação), não só por leitura de código:**
- **EPI real** (template `0d31f4e0-...`, dados de teste): `.page` mede 1025,4px → `@page` customizado
  para `794px 1032px` → PDF real gerado com página física de **595,92×774,00pt** (não os 842pt
  cheios de A4) — texto mais baixo a **9,75pt** do fim da página (antes ~78pt de vazio). Redução de
  ~90% do espaço vazio, sem cortar nada.
- **Contrato real** (template `0ddaca40-...`, o caso mais sensível, já teve bug de paginação
  corrigido nesta sessão): `.page` mede 2153px — **acima** do orçamento de 1123px, confirma que o
  `if (measuredHeight < A4_HEIGHT_PX)` não dispara, `@page:A4` fica intocado, sem risco de reabrir o
  bug das 3 páginas já corrigido.

**Parte 2 — cartão de assinaturas escondido no preview do worker.** `HtmlDocumentViewer.jsx` (onde o
trabalhador vê/assina o documento, Fluxo 3) mostrava sempre `.stamp-block` com os placeholders
`{worker_signature}`/`{admin_stamp}`/etc. ainda literais — o trabalhador ainda não assinou nesse
ponto, o cartão de duas colunas com texto placeholder cinzento não tem nada de útil para mostrar
(a assinatura em si é capturada à parte, no `SignDrawModal`). Corrigido só na apresentação: `const
previewHtml = filledHtml.replace('</body>', '<style>.stamp-block{display:none!important}</style>
</body>')`, passado ao `FitToWidthHtmlFrame` em vez de `filledHtml` — o `filledHtml` original
continua intocado e é o que é gravado em `generated_html` ao assinar (o admin, na aprovação, resolve
o `.stamp-block` a partir dele, exactamente como antes). Verificado com uma réplica isolada do
mecanismo real (mesmo HTML do EPI, mesma substituição): `.stamp-block` presente no DOM mas
`display:none` computado, resto do documento (incluindo o rodapé) renderiza normalmente, sem gap
nem quebra de layout onde o cartão estaria.

`npx eslint` limpo nos 2 ficheiros. Não confirmado ao vivo dentro da app real (worker dashboard
atrás do mesmo bloqueio de sessão 403 já registado várias vezes nesta sessão) — confiança apoiada
na verificação com o motor real (Playwright) para a Parte 1, que é exactamente o mesmo Chromium
subjacente à PDF.co, e na réplica isolada fiel para a Parte 2.

## Padronização do canvas de assinatura da empresa — `AdminSignDrawModal.jsx` (2026-09-02)

Pedido do Diego: "coloque o campo da assinatura igual o que tem no DB do worker para padronizar o
tamanho das assinaturas", a partir de um screenshot de Configurações → Identidade da Empresa →
"IMAGEM DA ASSINATURA". `AdminSignDrawModal.jsx` (assinatura da empresa/gerente, consumido só por
`CompanySignatureSettings.jsx`) tinha o mesmo canvas de altura elástica já corrigido em
`SignDrawModal.jsx` (worker) numa passagem anterior desta sessão — `flex-1 sm:flex-none` +
`style={{minHeight:'200px', height:'auto'}}`, ocupando quase o ecrã inteiro em mobile — e faltava-lhe
também a função `getTrimmedDataURL` que o `SignDrawModal.jsx` já tinha: `submit()` chamava
`canvasRef.current.toDataURL('image/png')` directamente sobre o canvas completo, sem recortar ao
traço, ao contrário do trabalhador (cujo PNG já sai só com o traço + 12px de margem).

Corrigido, portando exactamente os dois mecanismos já validados no `SignDrawModal.jsx`: (1) o
wrapper do canvas passou a `flex-shrink-0` + `style={{height:'170px'}}` (2) `getTrimmedDataURL`
(scan do canal alfa, bounding box do traço + padding) copiado tal e qual, `submit()` passou a
`onSign(getTrimmedDataURL(canvasRef.current))` em vez do `toDataURL` cru sobre o canvas inteiro.
Nenhuma das duas mudanças toca no `useEffect` que dimensiona o canvas a partir de
`parent.clientWidth/clientHeight` — mesma zona sensível já documentada (Fluxo 2): fixar a altura do
wrapper corre ANTES desse `useEffect`, sem risco de distorcer um traço já desenhado (é sempre um
canvas novo a cada abertura do modal).

**Verificado ao vivo em `/admin/settings`:** wrapper mede exactos 170px (igual ao worker); um traço
de teste desenhado via eventos de rato simulados confirmou `hasInk`/`Confirmar` a funcionar, e a
imagem devolvida por `getTrimmedDataURL` saiu a 187×67px (recortada ao traço + margem), não os
431×166px do canvas inteiro que saía antes — prova de que o recorte está a funcionar, não só o
tamanho da caixa de desenho. Não gravado no Supabase (não cliquei em "Guardar", só em "Confirmar" —
a assinatura real da empresa não foi tocada); página recarregada a seguir para descartar o estado
local de teste. `npx eslint` limpo no ficheiro.