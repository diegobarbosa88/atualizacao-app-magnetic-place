# Phase 10: Limpeza e Roteamento - Research

**Researched:** 2026-05-06
**Domain:** React code organization, component extraction, state management consolidation
**Confidence:** HIGH

## Summary

Phase 10 aims to reduce `app.jsx` from ~3230 lines to <200 lines by extracting inline components into feature directories and consolidating duplicate code. The key findings are:

1. **Duplicate components exist** - `EntryForm`, `WorkerDocuments`, and `CompanyLogo` are defined both in `app.jsx` AND in `WorkerDashboard.jsx` (different implementations)
2. **AdminDashboard is the largest extraction target** (~555 lines) - contains mixed state that needs splitting between App and AppContext
3. **App function still holds significant state** that should be in AppContext or feature-specific contexts
4. **Component Organization Target:** `src/components/common/` for shared components, `src/features/admin/` for admin-specific, `src/features/worker/` already exists for worker-specific

**Primary recommendation:** Extract inline components first (CompanyLogo, ClientTimesheetReport, EntryForm consolidation), then move AdminDashboard into the feature structure with proper context separation.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Authentication/Login | Browser/Client | — | LoginView handles session, should be extracted |
| Worker time entry | Browser/Client | — | EntryForm lives in WorkerDashboard |
| Admin dashboard | Browser/Client | — | Large component, needs extraction to feature |
| Financial reports | Browser/Client | — | Overlay component, admin-only |
| Document signing (worker) | Browser/Client | — | WorkerDocuments sub-component |
| Document management (admin) | Browser/Client | — | DocumentsAdmin sub-component |
| Notification management | Browser/Client | — | NotificationsAdmin sub-component |
| Timesheet report rendering | Browser/Client | — | ClientTimesheetReport - shared across views |
| App-level routing | Browser/Client | — | View switching via `view` state in App |
| Global state (data) | API/Backend | Browser/Client | AppContext holds all data, passed down |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI framework | Project foundation |
| @supabase/supabase-js | 2.x | Database/storage | Already in use |
| react-signature-canvas | latest | Digital signatures | Already in use |
| lucide-react | latest | Icons | Already in use |
| @emailjs/browser | latest | Email sending | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jszip | 3.10.1 | ZIP generation for reports | ClientTimesheetReport PDF export |
| html2pdf.js | 0.10.1 | PDF generation | ClientTimesheetReport PDF export |

---

## Current State Analysis

### app.jsx Line Count: ~3230 lines

#### Components Defined IN app.jsx (that need extraction):

| Component | Lines | Purpose | Target Location |
|-----------|-------|---------|-----------------|
| `CompanyLogo` | 58-68 (11 lines) | Company logo img | `src/components/common/CompanyLogo.jsx` |
| `EntryForm` | 71-163 (93 lines) | Time entry form | **CONSOLIDATE** with WorkerDashboard version |
| `FinancialReportOverlay` | 165-235 (71 lines) | Financial analysis overlay | `src/features/admin/FinancialReportOverlay.jsx` |
| `ClientTimesheetReport` | 237-984 (748 lines) | PDF report generation | `src/components/common/ClientTimesheetReport.jsx` |
| `WorkerDocuments` | 987-1279 (293 lines) | Worker doc signing | **DUPLICATE** - in WorkerDashboard too |
| `DocumentsAdmin` | 1281-1581 (301 lines) | Admin doc management | `src/features/admin/DocumentsAdmin.jsx` |
| `NotificationsAdmin` | 1586-1858 (273 lines) | Admin notifications | `src/features/admin/NotificationsAdmin.jsx` |
| `LoginView` | 1860-2026 (167 lines) | Login screen | `src/features/auth/LoginView.jsx` |
| `AdminDashboard` | 2028-2582 (555 lines) | Admin main view | `src/features/admin/AdminDashboard.jsx` |

#### State Still in `App` Function (2586-3228):

| State | Lines | Should Move To |
|-------|-------|----------------|
| `activeTab`, `portalMonth`, `portalSubTab` | 2625-2627 | AppContext or AdminDashboard |
| `printingReport`, `clienteSelecionado` | 2628-2629 | AppContext |
| `modalEmailAberto`, `toastMessage`, `isSendingEmail` | 2630-2632 | AppContext |
| `modalRejeitarAberto`, `rejeitarMotivo`, `rejeitarNotif` | 2633-2635 | AppContext or AdminDashboard |
| `auditWorkerId`, `showFinReport`, `finFilter` | 2637-2639 | AppContext or AdminDashboard |
| `mainFormData` | 2640 | AppContext (already partially there) |
| `dismissedNotifs` | 2678-2683 | AppContext (persisted to localStorage) |
| `adminStats` | 2642-2676 | **DUPLICATED** - already in AppContext! |
| `myNotifications`, `correctionNotifications` | 2685-2698 | AppContext (already there!) |
| `handleDismissNotif`, `handleBannerClick` | 2700-2756 | AppContext |
| `handleLogin`, `handleLogout` | 2758-2774 | AppContext |
| `handleDisparoEmail`, `handleConfirmarRejeicao` | 2777-2883 | AdminDashboard or AppContext |
| `handleSaveEntry`, `handleApproveMonth` | 2886-2926 | AppContext or feature contexts |

#### CRITICAL FINDING: Duplicate adminStats!

The `adminStats` computation (lines 2642-2676) is DUPLICATED - it's ALREADY computed in `AppContext.jsx` (lines 286-317). AdminDashboard receives `adminStats` as a prop from App, but App gets it from its own useMemo instead of from context.

**FIX:** Remove the duplicate useMemo from App, use `adminStats` from `useApp()` directly.

---

## Duplication Analysis

### Critical Duplicate: EntryForm and WorkerDocuments

**EntryForm** exists in TWO places:
- `app.jsx` lines 71-163 (original, uses `useApp()` for `systemSettings`)
- `WorkerDashboard.jsx` lines 35-140 (different version, accepts `systemSettings` as prop)

These have DIFFERENT implementations:
- app.jsx version: Uses `useApp()` directly
- WorkerDashboard version: Accepts `systemSettings` as prop, no `useApp()` call

**WorkerDocuments** also exists in TWO places:
- `app.jsx` lines 987-1279 (original)
- `WorkerDashboard.jsx` lines 142-362 (different version with different supabase handling)

**CompanyLogo** exists in THREE places:
- `app.jsx` lines 58-68
- `WorkerDashboard.jsx` lines 23-33
- `AdminDashboard` (implicit via `CompanyLogo` function definition)

**Action Required:** Consolidate EntryForm and WorkerDocuments to ONE version each in `src/components/common/`.

---

## Extraction Targets

### Tier 1: Common Components (shared across views)

| Component | Source | Target | Notes |
|-----------|--------|--------|-------|
| `CompanyLogo` | app.jsx:58-68, WorkerDashboard.jsx:23-33 | `src/components/common/CompanyLogo.jsx` | Single source |
| `EntryForm` | app.jsx:71-163, WorkerDashboard.jsx:35-140 | `src/components/common/EntryForm.jsx` | Consolidate both versions |
| `ClientTimesheetReport` | app.jsx:237-984 | `src/components/common/ClientTimesheetReport.jsx` | Large component, 748 lines |
| `WorkerDocuments` | app.jsx:987-1279, WorkerDashboard.jsx:142-362 | `src/components/common/WorkerDocuments.jsx` | Consolidate both versions |

### Tier 2: Admin Feature Components

| Component | Source | Target | Notes |
|-----------|--------|--------|-------|
| `FinancialReportOverlay` | app.jsx:165-235 | `src/features/admin/FinancialReportOverlay.jsx` | Admin-only |
| `DocumentsAdmin` | app.jsx:1281-1581 | `src/features/admin/DocumentsAdmin.jsx` | Admin-only |
| `NotificationsAdmin` | app.jsx:1586-1858 | `src/features/admin/NotificationsAdmin.jsx` | Admin-only |
| `LoginView` | app.jsx:1860-2026 | `src/features/auth/LoginView.jsx` | Auth feature |
| `AdminDashboard` | app.jsx:2028-2582 | `src/features/admin/AdminDashboard.jsx` | Requires state refactor |

### Tier 3: State Refactoring

| State | Current Location | Target Location | Action |
|-------|-----------------|-----------------|--------|
| `adminStats` | App useMemo (duplicated) | AppContext | Remove duplicate, use from context |
| `view`, `currentUser` | Already in AppContext | — | Already correct |
| All data states | AppContext | — | Already correct |
| Modal states | App | AppContext or feature | Investigate feasibility |
| `handleSaveEntry` | App | AppContext or feature | Investigate feasibility |

---

## Recommended Project Structure After Cleanup

```
src/
├── app.jsx                    # < 200 lines - pure router
├── App.css                    # Global styles
├── context/
│   └── AppContext.jsx        # Global state (keep as-is)
├── components/
│   └── common/
│       ├── CompanyLogo.jsx   # Extracted
│       ├── EntryForm.jsx     # Consolidated from app.jsx + WorkerDashboard
│       ├── ClientTimesheetReport.jsx  # Extracted
│       └── WorkerDocuments.jsx  # Consolidated
├── features/
│   ├── admin/
│   │   ├── index.js
│   │   ├── AdminDashboard.jsx    # Extracted + refactored
│   │   ├── FinancialReportOverlay.jsx  # Extracted
│   │   ├── DocumentsAdmin.jsx   # Extracted
│   │   ├── NotificationsAdmin.jsx  # Extracted
│   │   ├── TeamManager.jsx      # Already exists
│   │   ├── ClientManager.jsx    # Already exists
│   │   ├── ScheduleManager.jsx  # Already exists
│   │   ├── ExpenseManager.jsx   # Already exists
│   │   ├── ValidationPortal.jsx  # Already exists
│   │   └── contexts/            # Already exists
│   ├── worker/
│   │   ├── index.js
│   │   ├── WorkerDashboard.jsx  # Already exists (update to use common components)
│   │   └── contexts/            # Already exists
│   └── auth/
│       └── LoginView.jsx       # Extracted from app.jsx
├── ClientPortal.jsx           # Keep as-is (separate entry point)
├── components/
│   └── CorrecoesAdminPortal.jsx  # Keep as-is
└── utils/                      # Keep as-is
```

---

## Router Pattern for app.jsx

After extraction, `app.jsx` should look like:

```jsx
// ~150-180 lines total
import { AppProvider, useApp } from './context/AppContext';
import LoginView from './features/auth/LoginView';
import AdminDashboard from './features/admin/AdminDashboard';
import WorkerDashboard from './features/worker/WorkerDashboard';
import ClientPortal from './ClientPortal';
import FinancialReportOverlay from './features/admin/FinancialReportOverlay';

function App() {
  const { view, showFinReport } = useApp();
  
  return (
    <div>
      {view === 'login' && <LoginView />}
      {view === 'admin' && <AdminDashboard />}
      {view === 'worker' && <WorkerDashboard />}
      {view === 'client_portal' && <ClientPortal />}
      {showFinReport && <FinancialReportOverlay />}
    </div>
  );
}

export default function AppWrapper() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}
```

**Key changes:**
1. Remove ALL component definitions from app.jsx
2. Remove ALL state (except what's absolutely needed at top level)
3. app.jsx becomes a pure routing container
4. Data flows DOWN via props from context

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State management | Custom prop drilling for all data | AppContext already exists | AppContext already has all data states |
| Report generation | Custom PDF/ZIP code | ClientTimesheetReport (already works) | Complex browser-print/PDF logic |
| Login flow | Custom session handling | LoginView component | Already handles auth logic |
| Component reuse | Copy-paste components | Consolidate to common/ | DUPLICATES found - consolidate |

---

## Common Pitfalls

### Pitfall 1: Incomplete Extraction (Props Broken)
**What goes wrong:** After moving components, imports break or props aren't passed correctly.
**How to avoid:** 
- Follow the existing pattern from `WorkerDashboard.jsx` which already imports from `context/AppContext` and `../../context/AppContext`
- Ensure all required context values are available or passed as props
**Warning signs:** `Cannot read property 'X' of undefined` errors after moving components

### Pitfall 2: Duplicate Definition Errors
**What goes wrong:** Component defined in two files causing "duplicate identifier" TypeScript errors or React hydation mismatches.
**How to avoid:** 
- After extracting, DELETE the original from app.jsx
- Update WorkerDashboard.jsx imports to use `src/components/common/`
**Warning signs:** Build errors about duplicate exports, or two versions of component in different bundles

### Pitfall 3: State Still Prop-Drilled Excessively
**What goes wrong:** After extraction, components still receive 20+ props, making maintenance worse.
**How to avoid:** 
- Use context hooks (`useApp()`) inside components instead of requiring all data via props
- Components that use `useApp()` can access any context value directly
- Only pass data that's NOT in context, or computed values that depend on props

### Pitfall 4: Forgetting to Update imports in WorkerDashboard
**What goes wrong:** WorkerDashboard.jsx has its own copy of EntryForm, CompanyLogo, WorkerDocuments. If you only update app.jsx, duplicates remain.
**How to avoid:** 
- Must update BOTH app.jsx AND WorkerDashboard.jsx
- Create common components, then update WorkerDashboard.jsx to import from common
- Delete the duplicate definitions from WorkerDashboard.jsx

---

## Open Questions

1. **Should modal states (`modalEmailAberto`, `modalRejeitarAberto`, etc.) move to AppContext?**
   - Current: App function holds these
   - Alternative: Keep in App function, pass down to AdminDashboard
   - Recommendation: **Keep in App** - these are UI states that don't need global access

2. **Should we create an `AdminContext` to hold admin-specific state?**
   - Current: adminDashboard receives many props from App
   - Alternative: Create `AdminContext` similar to how `WorkerContext` exists
   - Recommendation: **Yes, consider after Phase 10** - Phase 10 should focus on extraction, Phase 11 on context creation

3. **Should we move `handleSaveEntry` to AppContext?**
   - Current: Defined in App, passed to AdminDashboard and WorkerDashboard
   - Alternative: Move to AppContext
   - Recommendation: **Yes** - `saveToDb` is already in context, `handleSaveEntry` wraps it with business logic

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLEANUP-01 | app.jsx reduced drastically (ideally < 200 lines) | Extraction targets identified - achievable if all components moved out |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | EntryForm in WorkerDashboard.jsx can be replaced with consolidated common version | Duplication Analysis | WorkerDashboard may need prop adjustments if common EntryForm doesn't match |
| A2 | CompanyLogo can be safely extracted to common/ without breaking styles | Extraction Targets | Logo may have view-specific styling differences |
| A3 | ClientTimesheetReport can be moved without changing its dependencies | Common Pitfalls | Report may depend on app.jsx-specific imports that need updating |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: Source code analysis] `src/app.jsx` - full file read, all 3230 lines analyzed
- [VERIFIED: Source code analysis] `src/features/worker/WorkerDashboard.jsx` - verified duplicate components
- [VERIFIED: Source code analysis] `src/context/AppContext.jsx` - verified existing state structure
- [VERIFIED: Source code analysis] `src/features/admin/index.js` - verified feature export pattern

### Secondary (MEDIUM confidence)
- [ASSUMED] Recommended folder structure follows existing project conventions
- [ASSUMED] Component extraction pattern will match Phase 6-9 extractions

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - all libraries verified as already in use
- Architecture: HIGH - based on direct code analysis
- Duplication Analysis: HIGH - verified by reading both source files
- Extraction Targets: MEDIUM - based on manual code review, needs verification with actual refactor attempt

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (30 days - codebase structure is stable)
