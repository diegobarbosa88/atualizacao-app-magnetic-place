# Phase 5: Correção do Sistema de Reports - Discussion Log

**Date:** 2026-05-05
**Phase:** 05-correcao-reports

## Areas Discussed

### 1. State Architecture
**Options presented:**
- State separation (separate quickCorrections and precisionCorrections objects)
- Single state with filter
- Shared via Context API

**Decision:** State separation (Recommended)
**Rationale:** Complete isolation between types prevents bugs from mixed state

### 2. Hooks for Editing
**Options presented:**
- Identical hooks for both types
- Same structure but different logic
- Separate hooks per type

**Decision:** Separate hooks
**Rationale:** Each type has specific editing logic that shouldn't be mixed

### 3. UI Components
**Options presented:**
- Two separate components (QuickReportCorrectionCard and PrecisionReportCorrectionCard)
- Single component with props
- Component with render props

**Decision:** Two components
**Rationale:** Clear separation of concerns, easier to maintain

### 4. Notification Filters
**Options presented:**
- Independent filters (Recommended)
- Single total badge
- Dynamic filter by type

**Decision:** Independent filters (Recommended)
**Rationale:** Admin can see pending counts per type

### 5. Legacy Notifications
**Options presented:**
- Show both UI modes
- Treat as Quick Report
- Show format error

**Decision:** Show both modes
**Rationale:** Maximum compatibility with existing data

---

## Key Decisions Captured

1. **D-01:** State completely separated between Quick and Precision Reports
2. **D-02:** Each type (Quick/Precision) has its own dedicated hook
3. **D-04:** Two separate components: QuickReportCorrectionCard and PrecisionReportCorrectionCard
4. **D-06:** Notification filters are completely independent between types
5. **D-09:** Legacy notifications (no reportType) show both UI modes

---

*Discussion log for Phase 5 context gathering*