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

**Success Criteria:**
1. Fluxo "Mensagem Rápida" funciona completamente
2. Fluxo "Ajuste de Precisão" funciona completamente
3. Admin recebe notificações em tempo real
4. Admin pode editar/apagar/adicionar registos
5. Cliente recebe feedback das ações do admin
6. Sistema de contra-proposta funciona

**UI hint:** yes

---

## Milestone v1.0

| Phase | Name | Status |
|-------|------|--------|
| 1 | Correções de Segurança e Error Handling | Complete |
| 2 | Melhorias de UX nas Notificações | Pending |
| 3 | Portal Admin - Histórico e Filtros | Pending |
| 4 | Validação e Testing | Pending |
| 5 | Correção do Sistema de Reports | Pending |

*Created: 2026-05-05*
