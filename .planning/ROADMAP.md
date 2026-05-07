# Roadmap: app-magnetic

**Created:** 2026-05-05
**Granularity:** Coarse
**Mode:** YOLO

## Phase 1: Correções de Segurança e Error Handling

**Goal:** Eliminar vulnerabilidades críticas de segurança e corrigir problemas de error handling identificados na análise do codebase.

**Requirements:** SEC-01, SEC-02, SEC-03, SEC-04, ERR-01, ERR-02, ERR-03, DATA-01, DATA-02, DATA-03

**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Move all hardcoded API keys to environment variables
- [x] 01-02-PLAN.md — Fix error handling (try/catch/finally, NaN guards, dependency arrays)

**Success Criteria:**
1. Todas as API keys movidas para .env e referenciadas via import.meta.env
2. Gemini API key usa Authorization header Bearer em vez de query string
3. handleAiPolish executa sempre setIsImproving(false) via finally
4. Mensagens de erro específicas por tipo (401, 429, network)
5. Operações reduce com validação isNaN
6. Supabase subscription com dependency array correto
7. clientId validado antes de usar em filtros
8. Verificação (displayWorkers?.length ?? 0) em vez de displayWorkers.length

**UI hint:** no

---

## Phase 2: Melhorias de UX nas Notificações

**Goal:** Melhorar a experiência do utilizador no sistema de reportes entre admin e clientes.

**Requirements:** NOTF-01, NOTF-02

**Plans:** 2 plans

Plans:
- [ ] 02-01-PLAN.md — Client push notifications when report is generated
- [ ] 02-02-PLAN.md — Admin notification badge counter and instant divergence alerts

**Success Criteria:**
1. Clientes recebem notificação quando novo relatório está disponível
2. Admin recebe notificação instantânea de reportes de divergência
3. Interface de notificaciones com contador badge

**UI hint:** yes

---

## Phase 3: Portal Admin - Histórico e Filtros

**Goal:** Permitir ao admin visualizar histórico de reportes e filtrar por múltiplos critérios.

**Requirements:** PORTAL-01, PORTAL-02

**Plans:** 2 plans

Plans:
- [ ] 03-01-PLAN.md — Admin history view with client/status/date filters
- [ ] 03-02-PLAN.md — Text search capability for report history

**Success Criteria:**
1. Página de histórico com lista de todos os reportes
2. Filtros por cliente, data, status (pendente/resolvido/rejeitado)
3. Busca por texto nos mensajes de reporte

**UI hint:** yes

---

## Phase 4: Validação e Testing

**Goal:** Adicionar testes automatizados para as funcionalidades críticas.

**Requirements:** TEST-01, TEST-02

**Success Criteria:**
1. Testes unitários para parseCorrectionDetails
2. Testes para calculateDuration com valores inválidos
3. Testes E2E para fluxo de reporte quick e precision
4. Coverage mínimo 70%

**UI hint:** no

---

## Phase 5: Correção do Sistema de Reports

**Goal:** Analisar e corrigir todos os bugs no sistema de troca de reports entre cliente e admin.

**Requirements:** REPORT-01, REPORT-02, REPORT-03, REPORT-04

**Plans:** 5 plans

Plans:
- [x] 05-01-PLAN.md — (completed) Fix contra-proposta button
- [x] 05-02-PLAN.md — (completed) Fix client name resolution for counter-proposal
- [x] 05-03-PLAN.md — (completed) Architecture for state separation (D-01 decisions)
- [x] 05-04-PLAN.md — (completed) Type-aware state separation achieved
- [x] 05-05-PLAN.md — (completed) Implement separate state per report type
- [x] 05-06-PLAN.md — (completed) Type-specific state via type-aware monolithic approach

**UI hint:** yes

---

## Milestone v1.0

| 5 | Correção do Sistema de Reports | Complete |

---

## Phase 6: Infraestrutura de Estado e Utilitários

**Goal:** Preparar o terreno para a modularização criando o Contexto global e movendo funções auxiliares.

**Requirements:** STATE-01, UTIL-01

**Success Criteria:**
1. Criado `AppContext.jsx` com os estados principais (users, logs, settings).
2. Funções de utilidade (formatDate, calculateDuration, etc.) movidas para `src/utils/`.
3. `app.jsx` utiliza o Provider do Contexto.

---

## Phase 7: Modularização do Admin (Core)

**Goal:** Extrair as funcionalidades principais do painel administrativo.

**Requirements:** ADMIN-01, ADMIN-02, ADMIN-03

**Plans:** 3 plans

Plans:
- [ ] 07-01-PLAN.md — TeamManager context extraction (ADMIN-02)
- [ ] 07-02-PLAN.md — ClientManager context extraction (ADMIN-03)
- [ ] 07-03-PLAN.md — ScheduleManager context extraction (ADMIN-02)

**Success Criteria:**
1. Criada pasta `src/features/admin`.
2. Funcionalidades "Equipa", "Clientes" e "Horários" extraídas para arquivos próprios.
3. Dashboards utilizam o Contexto em vez de props perfuradas (prop drilling).

---

## Phase 8: Modularização do Admin (Portal & Docs)

**Goal:** Extrair o Portal de Validação, Relatórios e Gestão de Documentos.

**Requirements:** ADMIN-04, ADMIN-05, ADMIN-06

Plans:
- [ ] 08-01-PLAN.md — ValidationPortal context extraction (ADMIN-04)

**Success Criteria:**
2. Sistema de Notificações e Links movidos para componentes independentes.

---

## Phase 9: Modularização do Worker

**Goal:** Extrair o Dashboard do Trabalhador e seus componentes.

**Requirements:** WORKER-01, WORKER-02

**Success Criteria:**
1. Criada pasta `src/features/worker`.
2. Dashboard do Trabalhador e formulários de entrada extraídos.

---

## Phase 10: Limpeza e Roteamento

**Goal:** Consolidar o `app.jsx` como um roteador limpo e remover código duplicado.

**Requirements:** CLEANUP-01

**Plans:** 4 plans

Plans:
- [ ] 10-01-PLAN.md — Extract common components (CompanyLogo, EntryForm, WorkerDocuments, ClientTimesheetReport)
- [ ] 10-02-PLAN.md — Extract feature components (LoginView, FinancialReportOverlay, DocumentsAdmin, NotificationsAdmin)
- [ ] 10-03-PLAN.md — Extract AdminDashboard, refactor app.jsx to pure router, remove duplicate adminStats
- [ ] 10-04-PLAN.md — Update WorkerDashboard to use common components, finalize folder structure

**Success Criteria:**
1. `app.jsx` reduzido drasticamente (idealmente < 200 linhas).
2. Estrutura de pastas finalizada e organizada por domínio.

---

---

## Phase 11: Gestão de Ciclo de Vida do Trabalhador

**Goal:** Adicionar datas de início/fim ao registo de trabalhadores e à atribuição de horários. Implementar histórico de evolução dos valores hora.

**Requirements:** WORKER-01, WORKER-02, WORKER-03, WORKER-04, WORKER-05

**Plans:** 4 plans

Plans:
- [ ] 11-01-PLAN.md — Data de início/fim no registo de trabalhador
- [ ] 11-02-PLAN.md — Atribuição de horários com datas de validade
- [ ] 11-03-PLAN.md — Histórico de evolução do valor hora
- [ ] 11-04-PLAN.md — Acesso condicional por data de início/fim
- [ ] 11-05-PLAN.md — Histórico de períodos de emprego
- [ ] 11-06-PLAN.md — Histórico de atribuição de horários

**Success Criteria:**
1. Campo "Data de Início" no formulário de registo de trabalhador
2. Campo "Data de Fim" que define automaticamente a conta como inativa
3. Datas de validade na atribuição de horários (preserva históricos)
4. Histórico de alterações do valor hora (trabalhador e cliente)
5. Trabalhador só vê notificações de meses >= dataInicio (filtragem de validações)
6. Admin tem filtro para mostrar/ocultar trabalhadores inativos
7. Histórico de períodos de emprego — worker pode sair e voltar sem perder dados
8. Histórico de atribuição de horários — períodos preservados em histórico

**UI hint:** yes

---

## Milestone v2.0 - Arquitetura Modular

| Phase | Name | Status |
|-------|------|--------|
| 1-5 | Correções e Estabilidade (Legacy) | Complete |
| 6 | Infraestrutura de Estado e Utilitários | Complete |
| 7 | Modularização do Admin (Core) | Complete |
| 8 | Modularização do Admin (Portal & Docs) | Complete |
| 9 | Modularização do Worker | Complete |
| 10 | Limpeza e Roteamento | Ready to execute |
| 11 | Gestão de Ciclo de Vida do Trabalhador | Complete |

---

## Phase 12: Modernização UI — ClientManager

**Goal:** Aplicar o design system de alta fidelidade (2 colunas, Indigo/Emerald, rounded-[2.5rem], labels uppercase, ícones lucide-react) ao ClientManager.jsx, replicando a estrutura visual do TeamManager.jsx e ScheduleManager.jsx.

**Requirements:** UI-MOD-01

**Plans:** 1 plan

Plans:
- [x] 12-01-PLAN.md — Modernização UI do ClientManager.jsx

**Success Criteria:**
1. Layout 2 colunas: DADOS DO CLIENTE (esquerda) + HORÁRIOS / TRABALHADORES / AÇÕES (direita)
2. Design system unificado com TeamManager (cores, bordas, tipografia)
3. Todas as funcionalidades originais preservadas (CRUD, histórico valor hora, sorting, views)
4. Labels em uppercase com ícones lucide-react
5. Classes CSS consistentes (rounded-[2.5rem], shadow-xl, border-slate-100)

**UI hint:** yes

*Last updated: 2026-05-07*

