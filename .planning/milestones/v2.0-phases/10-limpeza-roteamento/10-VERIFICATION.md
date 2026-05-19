---
phase: 10-limpeza-roteamento
verified: 2026-05-09T10:00:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Carregar a aplicação no browser e navegar pelas quatro vistas: login, admin, worker, portal de cliente"
    expected: "Todas as vistas renderizam sem erros na consola; EntryForm, WorkerDocuments, CompanyLogo e ClientTimesheetReport funcionam normalmente nas vistas worker e client_portal"
    why_human: "Não é possível verificar programaticamente que os componentes extraídos estão a funcionar de forma integrada em runtime, dado que as dependências entre common/ e features/ envolvem comportamento dinâmico (upload de PDF, assinatura digital, geração de ZIP)"
---

# Phase 10: Limpeza e Roteamento — Relatório de Verificação

**Goal da Fase:** Consolidar o `app.jsx` como um roteador limpo e remover código duplicado.
**Verificado em:** 2026-05-09
**Status:** human_needed
**Re-verificação:** Não — verificação inicial

---

## Avaliação do Objetivo

### Truths Observáveis

| # | Truth | Status | Evidência |
|---|-------|--------|-----------|
| 1 | `app.jsx` reduzido drasticamente (idealmente < 200 linhas) | PARCIAL | 435 linhas — 89% de redução face às 3230 originais; objetivo numérico estrito de <200 não atingido |
| 2 | Estrutura de pastas finalizada e organizada por domínio | VERIFICADO | `src/features/admin/`, `src/features/auth/`, `src/features/worker/`, `src/components/common/` existem e agrupam componentes por domínio |
| 3 | EntryForm existe num único local e é usado por app.jsx e WorkerDashboard | VERIFICADO | `src/components/common/EntryForm.jsx` (100 linhas, export default); importado em app.jsx linha 20 e WorkerDashboard.jsx linha 24 |
| 4 | WorkerDocuments existe num único local e é usado por ambos | VERIFICADO | `src/components/common/WorkerDocuments.jsx` (640 linhas, export default); importado em app.jsx linha 22 e WorkerDashboard.jsx linha 25 |
| 5 | CompanyLogo existe num único local partilhado | VERIFICADO | `src/components/common/CompanyLogo.jsx` (12 linhas, export default); sem definições inline em app.jsx ou WorkerDashboard |
| 6 | ClientTimesheetReport extraído para `src/components/common/` | VERIFICADO | 759 linhas, export default, importado em app.jsx linha 21 |
| 7 | LoginView extraído para `src/features/auth/LoginView.jsx` | VERIFICADO | 173 linhas, export default; importado em app.jsx linha 18 |
| 8 | FinancialReportOverlay, DocumentsAdmin, NotificationsAdmin em `src/features/admin/` | VERIFICADO | Ficheiros existem (80, 308, 278 linhas), todos com export default, exportados via index.js |
| 9 | AdminDashboard extraído para `src/features/admin/AdminDashboard.jsx` | VERIFICADO | 846 linhas, export default, importado em app.jsx linha 14 |
| 10 | Sem definições inline duplicadas em app.jsx | VERIFICADO | `grep` por `const (CompanyLogo\|EntryForm\|WorkerDocuments\|...)` em app.jsx retorna zero resultados |
| 11 | Sem definições inline duplicadas em WorkerDashboard | VERIFICADO | `grep` por `const (CompanyLogo\|EntryForm\|WorkerDocuments)` em WorkerDashboard.jsx retorna zero resultados |
| 12 | `adminStats` useMemo duplicado removido de app.jsx | VERIFICADO | `grep` por `adminStats.*useMemo` em app.jsx retorna zero resultados |
| 13 | WorkerDashboard importa de `components/common/` | VERIFICADO | Linhas 23-25 de WorkerDashboard.jsx: imports diretos de `../../components/common/` |
| 14 | `src/components/common/index.js` barrel export criado | VERIFICADO | 4 exports (CompanyLogo, EntryForm, WorkerDocuments, ClientTimesheetReport) |

**Pontuação das Truths-chave das Success Criteria do ROADMAP: 1 parcial + 1 verificado = 1/2 (SC estrito)**
**Pontuação das must-haves dos PLANs: 9/10 verificados (Truth #1 marcada PARCIAL)**

---

### Avaliação da Success Criteria do ROADMAP

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| SC-1 | `app.jsx` reduzido drasticamente (idealmente < 200 linhas) | PARCIAL | 435 linhas. O critério usa "idealmente" — 87% de redução de 3230 → 435 é substancial. Conteúdo remanescente é lógica de handlers legítima (notificações, email, rejeição de correções), não componentes duplicados. Nenhuma definição inline de componente subsiste. |
| SC-2 | Estrutura de pastas finalizada e organizada por domínio | VERIFICADO | `src/features/admin/`, `src/features/auth/`, `src/features/worker/`, `src/components/common/` todos presentes com barrel exports (index.js) |

---

### Artefactos Verificados

| Artefacto | Mínimo | Atual | Status | Detalhes |
|-----------|--------|-------|--------|----------|
| `src/components/common/CompanyLogo.jsx` | 15 linhas | 12 linhas | STUB em tamanho, VERIFICADO em função | Componente único (<img> com fallback); 12 linhas é o tamanho correto para este componente simples |
| `src/components/common/EntryForm.jsx` | 90 linhas | 100 linhas | VERIFICADO | Export default, substantivo |
| `src/components/common/WorkerDocuments.jsx` | 290 linhas | 640 linhas | VERIFICADO | Export default, excede mínimo |
| `src/components/common/ClientTimesheetReport.jsx` | 750 linhas | 759 linhas | VERIFICADO | Export default, cumpre mínimo |
| `src/features/auth/LoginView.jsx` | 165 linhas | 173 linhas | VERIFICADO | Export default |
| `src/features/admin/FinancialReportOverlay.jsx` | 70 linhas | 80 linhas | VERIFICADO | Export default |
| `src/features/admin/DocumentsAdmin.jsx` | 300 linhas | 308 linhas | VERIFICADO | Export default |
| `src/features/admin/NotificationsAdmin.jsx` | 270 linhas | 278 linhas | VERIFICADO | Export default |
| `src/features/admin/AdminDashboard.jsx` | 550 linhas | 846 linhas | VERIFICADO | Export default |
| `src/features/worker/WorkerDashboard.jsx` | actualizado | 589 linhas | VERIFICADO | Sem definições inline; imports de common/ presentes |
| `src/components/common/index.js` | barrel export | 4 exports | VERIFICADO | Todos os 4 common components exportados |
| `src/app.jsx` | < 200 linhas | 435 linhas | PARCIAL | Sem definições inline; estrutura de router presente; handlers legítimos mantidos |

---

### Verificação de Key Links

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|---------|
| `src/app.jsx` | `src/components/common/EntryForm.jsx` | import linha 20 | VERIFICADO | `import EntryForm from './components/common/EntryForm'` |
| `src/app.jsx` | `src/components/common/WorkerDocuments.jsx` | import linha 22 | VERIFICADO | `import WorkerDocuments from './components/common/WorkerDocuments'` |
| `src/app.jsx` | `src/features/auth/LoginView.jsx` | import linha 18 | VERIFICADO | `import LoginView from './features/auth/LoginView'` |
| `src/app.jsx` | `src/features/admin/AdminDashboard.jsx` | import linha 14 | VERIFICADO | `import AdminDashboard from './features/admin/AdminDashboard'` |
| `src/app.jsx` | `src/features/admin/DocumentsAdmin.jsx` | import linha 16 | VERIFICADO | `import DocumentsAdmin from './features/admin/DocumentsAdmin'` |
| `src/features/worker/WorkerDashboard.jsx` | `src/components/common/EntryForm.jsx` | import linha 24 | VERIFICADO | `import EntryForm from '../../components/common/EntryForm'` |
| `src/features/worker/WorkerDashboard.jsx` | `src/components/common/CompanyLogo.jsx` | import linha 23 | VERIFICADO | `import CompanyLogo from '../../components/common/CompanyLogo'` |
| `src/features/worker/WorkerDashboard.jsx` | `src/components/common/WorkerDocuments.jsx` | import linha 25 | VERIFICADO | `import WorkerDocuments from '../../components/common/WorkerDocuments'` |
| `src/features/admin/AdminDashboard.jsx` | `src/components/common/CompanyLogo.jsx` | import linha 3 | VERIFICADO | `import CompanyLogo from '../../components/common/CompanyLogo'` |
| `src/features/admin/index.js` | AdminDashboard, FinancialReportOverlay, DocumentsAdmin, NotificationsAdmin | exports | VERIFICADO | Todos os 9 exports presentes |
| `src/features/auth/index.js` | LoginView | export linha 1 | VERIFICADO | `export { default as LoginView }` |

---

### Verificação de Data-Flow (Nível 4)

Não aplicável para esta fase — as extrações são refactoring estrutural de componentes existentes, não criação de novas fontes de dados. As ligações de dados a Supabase/AppContext mantêm-se intactas através dos hooks `useApp()` já existentes dentro de cada componente extraído. A verificação de data-flow em runtime requer a verificação humana abaixo.

---

### Behavioral Spot-Checks

| Comportamento | Verificação | Resultado | Status |
|---------------|-------------|-----------|--------|
| app.jsx sem definições inline | `grep -E "const (CompanyLogo\|EntryForm\|...)=" src/app.jsx` | Zero correspondências | PASS |
| WorkerDashboard sem definições inline | `grep -E "const (CompanyLogo\|EntryForm\|WorkerDocuments)=" src/features/worker/WorkerDashboard.jsx` | Zero correspondências | PASS |
| adminStats duplicado removido | `grep "adminStats.*useMemo" src/app.jsx` | Zero correspondências | PASS |
| app.jsx linha 435 | `wc -l src/app.jsx` | 435 | PASS (funcional, PARCIAL face ao target <200) |
| Todos os artefactos com export default | grep por ficheiro | Todos os 9 targets têm export default | PASS |
| common/index.js com 4 exports | Leitura direta | 4 exports corretos | PASS |

---

### Cobertura de Requisitos

| Requisito | Plano | Descrição | Status | Evidência |
|-----------|-------|-----------|--------|-----------|
| CLEANUP-01 | 10-01, 10-02, 10-03, 10-04 | Consolidar app.jsx como router limpo, remover duplicados | SUBSTANCIALMENTE SATISFEITO | Todos os componentes extraídos, sem definições inline, estrutura de pastas organizada. app.jsx a 435 linhas (vs <200 idealizado). |

---

### Anti-Padrões Encontrados

| Ficheiro | Linha | Padrão | Severidade | Impacto |
|----------|-------|--------|------------|---------|
| `src/app.jsx` | — | 435 linhas vs target <200 | INFO | O conteúdo remanescente (handlers de email, notificações, rejeição de correções, modais globais) é lógica legítima de coordenação de app. Não são definições de componentes duplicadas. Não bloqueia o objetivo principal. |
| `src/app.jsx` | 143 | `console.log('Banner clicado:', notif.title)` | INFO | Debug log não removido; não bloqueia funcionalidade |

---

### Verificação Humana Necessária

#### 1. Teste de Integração das Quatro Vistas

**Teste:** Abrir a aplicação no browser. Fazer login como trabalhador — verificar que EntryForm, WorkerDocuments e CompanyLogo carregam (importados de common/). Fazer login como admin — verificar que AdminDashboard com todas as tabs funciona. Aceder ao portal de cliente — verificar que ClientTimesheetReport gera o PDF. Abrir o relatório financeiro (FinancialReportOverlay).

**Esperado:** Todas as vistas e funcionalidades funcionam sem erros na consola do browser. Nenhum import a falhar. O formulário de registo de horas (EntryForm), documentos do trabalhador (WorkerDocuments) e o relatório de timesheets (ClientTimesheetReport) devem operar de forma idêntica ao comportamento pré-fase-10.

**Porquê humano:** A extração de componentes com dependências dinâmicas (PDF.co para assinaturas, geração de ZIP, integração Supabase via useApp()) só pode ser validada completamente em runtime.

---

### Resumo das Lacunas

**Lacuna parcial (não bloqueante):**

O `app.jsx` está em 435 linhas em vez do target idealizado de <200 linhas. O SUMMARY da fase reconhece explicitamente este desvio, justificando que os ~235 linhas remanescentes para além das 200 são handlers legítimos de coordenação ao nível da aplicação (sistema de notificações, modal de email, modal de rejeição de correções, lógica de entry saving) e não definições de componentes duplicadas.

O objetivo principal da fase — "remover código duplicado" e "consolidar app.jsx como um roteador limpo" — está atingido: zero definições inline de componentes permanecem, todos os componentes foram extraídos para as localizações canónicas, e a redução foi de 3230 → 435 linhas (87%). O critério usa "idealmente" como qualificador, o que permite esta interpretação.

**Não há gaps bloqueantes.** A única pendência é a verificação humana de integração em runtime.

---

_Verificado: 2026-05-09_
_Verificador: Claude (gsd-verifier)_
