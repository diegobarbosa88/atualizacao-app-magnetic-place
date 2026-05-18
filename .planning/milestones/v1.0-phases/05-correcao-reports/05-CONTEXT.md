# Phase 5: Correção do Sistema de Reports - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning
**Source:** User reported entire system is broken

<domain>
## Phase Boundary

Phase 5 focuses on **bug correction and system review** for the client-admin report exchange system.

**Known scope:**
- Mensagem Rápida: Client sends text → Admin receives notification → Admin edits records
- Ajuste de Precisão: Client edits → Admin receives proposal → Admin accepts/rejects

**User reports ALL points in the flow are broken:**
1. When client sends correction
2. When admin receives notification
3. When admin tries to edit
4. When admin responds to client

This phase will perform deep analysis, identify all bugs, and fix them.
</domain>

<decisions>
## Implementation Decisions

### State Architecture
- **D-01:** State completamente separado entre Quick e Precision Reports:
  ```javascript
  quickCorrections[notifId] = {
    status: 'pending' | 'accepted' | 'rejected' | 'counter_proposal',
    reason: '',
    adminEditedWorkers: [],
    originalMessage: '',
  }

  precisionCorrections[notifId] = {
    workers: [],
    editingDayId: null,
    activeWorkerId: null,
    adminChanges: {},
  }
  ```

### Hooks por Tipo
- **D-02:** Cada tipo (Quick/Precision) tem seu próprio hook dedicado
- **D-03:** Hooks não são partilhados — cada um tem lógica específica para seu tipo

### Componentes de UI
- **D-04:** Dois componentes separados:
  - `QuickReportCorrectionCard` — para Quick Reports (badge "Rápido")
  - `PrecisionReportCorrectionCard` — para Precision Reports (badge "Precisão")
- **D-05:** Routing no início do render usa `notif.payload?.reportType` para decidir qual componente renderizar

### Filtros de Notificação
- **D-06:** Filtros completamente independentes entre tipos
- **D-07:** quickNotifications usa filtro específico para reportType === 'quick'
- **D-08:** precisionNotifications usa filtro específico para reportType === 'precision'

### Notificações Legacy
- **D-09:** Notificações sem `reportType` no payload mostram ambos os modos de UI
- **D-10:** Fallback: componente LegacyCorrectionCard para兼容性

### Regras de Negócio (confirmadas)
- **Quick Report** (badge "Rápido"): Cliente envia mensagem de texto. Admin pode editar horas, aceitar, rejeitar, enviar contra-proposta.
- **Precision Report** (badge "Precisão"): Cliente edita dias específicos. Admin pode editar horas de qualquer dia, aceitar, rejeitar, enviar contra-proposta.
- Ambos permitem admin editar horas — diferença é apenas a origem dos dados

### Implementação Partilhada
- **D-11:** `parseCorrectionDetails` — já existe globalmente, continuar a usar
- **D-12:** `calculateDuration` — já existe globalmente, continuar a usar
- **D-13:** `handleApplyCorrection` — lógica partilhada mas chamada por cada componente

### Fase Approach (mantido de contexto anterior)
- Deep analysis first — understand what breaks where before fixing
- Fix systematically — don't just patch symptoms
- Test each fix — ensure flow works end-to-end
- Scope is bug fixes and corrections only — new features belong in future phases

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project vision, constraints, stack
- `.planning/STATE.md` — Current phase status and prior learnings
- `.planning/ROADMAP.md` — Phase 5 goal and success criteria
- `.planning/REQUIREMENTS.md` — Requirements definitions

### Code (main files)
- `src/app.jsx` — Admin dashboard with CorrecoesAdmin component (lines 1746-3073)
- `src/ClientPortal.jsx` — Client portal with report editing

### Plans and Summaries
- `.planning/phases/05-correcao-reports/05-01-SUMMARY.md` — Bug fix: contra-proposta button
- `.planning/phases/05-correcao-reports/05-02-SUMMARY.md` — Bug fix: client name resolution
- `.planning/phases/05-correcao-reports/05-03-PLAN.md` — Planned architecture for separation

### External Docs
- No external specs — requirements fully captured in decisions above
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parseCorrectionDetails` function (line ~1800) — already handles both formats
- `calculateDuration` utility — already exists globally
- LocalStorage persistence patterns already established for editingDrafts

### Established Patterns
- Notification filtering: `n.title.includes(...)` + `target_type === 'admin'`
- Badge counter using `correctionNotifications.length`
- State persistence via localStorage with JSON serialization

### Integration Points
- `correcoesCorrections` state from Supabase realtime subscription
- `app_notifications` table for client-admin communication
- `logs` table for actual hour records

</code_context>

<specifics>
## Specific Ideas

### Arquitetura do State
- State isolado em objetos separados por tipo de correção
- adminChanges usa estrutura `{ workerId: { dayDate: { adminEntry, adminExit, ... } } }`

### UI/UX
- Badge claro "Rápido" vs "Precisão" em cada cartão
- Componentes pequenos com nomes claros
- Props partilhadas via componente pai (CorrecoesAdmin)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-correcao-reports*
*Context gathered: 2026-05-05*