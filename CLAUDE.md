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
  registo sem saída no dashboard do trabalhador), não hover — candidato mais forte a corrigir a
  seguir. Nenhum destes foi tocado — fica registado, não corrigido, por estar fora do âmbito da
  mudança que o encontrou.
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
  Correr também `npx eslint .` e confirmar no browser (localhost:4179). Não há suite de testes E2E
  fiável para regressões visuais.
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