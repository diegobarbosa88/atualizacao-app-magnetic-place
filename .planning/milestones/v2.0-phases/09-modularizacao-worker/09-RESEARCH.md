# Phase 9: Modularização do Worker — Research

**Gathered:** 2026-05-06
**Phase:** 09-modularizacao-worker
**Goal:** Extrair o Dashboard do Trabalhador e seus componentes.

## Source References

- `src/app.jsx` — WorkerDashboard function (lines 2585-3634), rendering at line 3630-3633
- `src/features/admin/` — Pattern to follow for feature extraction
- `src/features/admin/contexts/TeamContext.jsx` — Example of context extraction
- `src/context/AppContext.jsx` — Existing context structure

---

## Domain Analysis

### What is WorkerDashboard?

`WorkerDashboard` is the main view for workers when they log in. It provides:
1. **Monthly time tracking** — Calendar view with daily log entries
2. **Quick register** — One-click entry using default schedule
3. **Approval workflow** — Submit monthly hours for admin approval
4. **Document signing** — Digital signature for pending documents
5. **Schedule management** — Personal schedule configuration

### Current Location

`src/app.jsx` contains:
- `WorkerDashboard` function (~1300 lines, lines 2585-3634)
- Rendered at `{view === 'worker' && <WorkerDashboard {...props} />}`
- Props passed directly from app.jsx state (no intermediate component)

### Dependency Analysis

WorkerDashboard requires from app.jsx:
- `currentUser`, `setCurrentUser`
- `currentMonth`, `setCurrentMonth`
- `logs`, `clients`, `schedules`, `personalSchedules`
- `mainFormData`, `setMainFormData`
- `handleSaveEntry`, `saveToDb`, `handleDelete`
- `approvals`, `handleApproveMonth`
- `systemSettings`, `documents`, `appNotifications`
- `onLogout`, `onLogin`

### Required Extraction for WORKER-01 (Dashboard)

Creating `src/features/worker/WorkerDashboard.jsx` with:
- Props: same set as currently passed from app.jsx
- Pattern: follow `TeamManager.jsx` structure (Provider wrapper)
- Internal state: inlineEditingDate, successMsg, inlineFormData, showSchedulesModal, showProgress, expandedDays, showPersonalBreaks, newPersonalForm, dismissedNotifs, pendingApprovals

### Required Extraction for WORKER-02 (Registo)

This is already part of WorkerDashboard — the monthly view with:
- `daysList` — all days of current month
- `monthLogs` — worker's logs filtered by current month
- `inlineFormData` for entry editing
- `handleSaveEntry` integration

---

## Architectural Decisions

### Context Pattern

Follow the same pattern as `src/features/admin/contexts/`:
- `WorkerContext.jsx` — local state (inlineEditingDate, expandedDays, etc.)
- `useWorker()` hook — exports context values
- `WorkerProvider` — wraps WorkerDashboardContent

### File Structure

```
src/features/worker/
├── WorkerDashboard.jsx     # Main component (from app.jsx)
├── context/
│   └── WorkerContext.jsx   # Local state management
├── index.js               # Exports
```

### Prop Flow

Option A: Pass all required props to WorkerDashboard (current approach in app.jsx)
Option B: Use WorkerContext for local state + AppContext for shared state
Option C: Extract WorkerContext with subset of AppContext values

**Recommendation:** Option B — local WorkerContext for component-specific state, AppContext for shared data (logs, clients, schedules already exist there).

### Shared Components

WorkerDashboard uses from app.jsx:
- `CompanyLogo` — already extracted to separate component, can import
- `formatHours`, `calculateDuration`, `calculateExpectedMonthlyHours` — from formatUtils.js
- `toISODateLocal`, `isSameMonth`, `getLastBusinessDayOfMonth` — from dateUtils.js

---

## Dependencies on AppContext

WorkerDashboard currently receives props, not using AppContext directly. However:
- `logs`, `clients`, `schedules` are in AppContext
- `saveToDb`, `handleDelete` are in AppContext
- `currentUser` is local to app.jsx login flow

**Decision:** WorkerDashboard should use `useApp()` hook to consume AppContext, reducing prop drilling. This matches Phase 7 admin pattern.

---

## Technical Notes

### Inline Edit Pattern

WorkerDashboard uses inline form editing (dates expanded for editing). This pattern is specific to WorkerDashboard and should be captured in WorkerContext.

### Approval Logic

Pending approvals logic:
```javascript
const pendingApprovals = useMemo(() => {
  // Check if current month is past last business day
  // Check if worker has approved that month
  // Return list of pending months
}, [approvals, currentUser.id]);
```

### Quick Register

One-click register using default schedule:
```javascript
const handleQuickRegister = (ds) => {
  const s = getScheduleForDay(schedule, ds);
  handleSaveEntry({ clientId, startTime, breakStart, breakEnd, endTime, description }, false, ds);
};
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking worker login flow | HIGH | Test login as worker after extraction |
| Losing inline edit state | MEDIUM | WorkerContext preserves local state |
| Approval logic regression | MEDIUM | Verify pending approvals still compute |
| Document signing broken | MEDIUM | Test signing flow after extraction |

---

## Out of Scope

- WORKER-03 (Document viewing/signing) — not in phase requirements
- Changes to login/auth flow — handled at app.jsx level
- Modifications to AppContext structure

---

## Validation Strategy

After extraction:
1. Worker login flow still works
2. Dashboard renders with correct data
3. Quick register creates log entries
4. Inline editing saves correctly
5. Approval submission works
6. Month navigation (prev/next) works