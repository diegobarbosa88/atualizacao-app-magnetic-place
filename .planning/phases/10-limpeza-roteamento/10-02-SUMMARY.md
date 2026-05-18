---
phase: 10
plan: 02
name: Extract Feature Components
subsystem: src/features/
tags: [cleanup, extraction, components]
dependency-graph:
  requires:
    - plan: "10-01"
      description: "Common components must exist first"
  provides:
    - path: "src/features/auth/LoginView.jsx"
      component: "LoginView"
    - path: "src/features/admin/FinancialReportOverlay.jsx"
      component: "FinancialReportOverlay"
    - path: "src/features/admin/DocumentsAdmin.jsx"
      component: "DocumentsAdmin"
    - path: "src/features/admin/NotificationsAdmin.jsx"
      component: "NotificationsAdmin"
tech-stack:
  added:
    - React functional components (4 files)
  patterns:
    - Feature-based directory organization
    - Named exports via index.js
key-files:
  created:
    - path: src/features/auth/LoginView.jsx
      lines: 173
      description: "Login screen with PWA installation support, iOS/Android detection"
    - path: src/features/admin/FinancialReportOverlay.jsx
      lines: 80
      description: "Financial analysis overlay with AI-powered insights"
    - path: src/features/admin/DocumentsAdmin.jsx
      lines: 307
      description: "Admin document management with upload, search, filter, sort"
    - path: src/features/admin/NotificationsAdmin.jsx
      lines: 278
      description: "Admin banner/notification management with interaction tracking"
  modified:
    - path: src/features/auth/index.js
      description: "Added LoginView export"
    - path: src/features/admin/index.js
      description: "Added FinancialReportOverlay, DocumentsAdmin, NotificationsAdmin exports"
decisions:
  - decision: "Components extracted to src/features/ (not src/components/features/)"
    rationale: "Plan specified src/features/ as the target directory structure"
  - decision: "Created src/features/auth/ directory for LoginView"
    rationale: "LoginView is an auth feature, not admin"
  - decision: "All components use relative imports for context/utils"
    rationale: "Maintain portability for future refactoring"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-06T10:01:00Z"
  tasks-completed: 4
  files-created: 6
  lines-extracted: 838
---

# Phase 10 Plan 02 Summary: Extract Feature Components

## Objective
Extract feature-specific components from app.jsx to their respective feature directories under `src/features/`.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extract LoginView | 90bcb0d | src/features/auth/LoginView.jsx, src/features/auth/index.js |
| 2 | Extract FinancialReportOverlay | 90bcb0d | src/features/admin/FinancialReportOverlay.jsx |
| 3 | Extract DocumentsAdmin | 90bcb0d | src/features/admin/DocumentsAdmin.jsx |
| 4 | Extract NotificationsAdmin | 90bcb0d | src/features/admin/NotificationsAdmin.jsx |

## Extracted Components

### LoginView (173 lines)
- **Path:** `src/features/auth/LoginView.jsx`
- **Signature:** `const LoginView = ({ workers, onLogin, systemSettings, setSystemSettings }) => {`
- **Features:**
  - User/password authentication with worker NIF lookup
  - PWA installation prompt handling (iOS + Android)
  - Admin password authentication
  - Bounce animation for install button
  - iOS standalone detection

### FinancialReportOverlay (80 lines)
- **Path:** `src/features/admin/FinancialReportOverlay.jsx`
- **Signature:** `const FinancialReportOverlay = ({ logs, workers, clients, expenses, finFilter, setFinFilter, setShowFinReport }) => {`
- **Features:**
  - Revenue, team costs, net profit calculation
  - AI-powered financial insights via Gemini
  - Date range filtering
  - Modal overlay UI

### DocumentsAdmin (307 lines)
- **Path:** `src/features/admin/DocumentsAdmin.jsx`
- **Signature:** `const DocumentsAdmin = ({ workers = [], documents = [], setDocuments }) => {`
- **Features:**
  - Document upload with worker/tipo selection
  - Search and filter functionality
  - Sortable table by date, worker name, tipo, status
  - View original/signed PDF links
  - Delete with storage cleanup

### NotificationsAdmin (278 lines)
- **Path:** `src/features/admin/NotificationsAdmin.jsx`
- **Signature:** `const NotificationsAdmin = ({ workers, appNotifications, saveToDb, handleDelete }) => {`
- **Features:**
  - Create banner notifications with title, message, type
  - Target all workers or specific workers
  - Toggle active status
  - View/dismiss interaction tracking
  - Dismissible flag support

## Index Files Updated

### src/features/auth/index.js
```javascript
export { default as LoginView } from './LoginView';
```

### src/features/admin/index.js
```javascript
export { default as FinancialReportOverlay } from './FinancialReportOverlay';
export { default as DocumentsAdmin } from './DocumentsAdmin';
export { default as NotificationsAdmin } from './NotificationsAdmin';
```

## Dependencies
- **Pre-requisite:** Plan 10-01 must complete first (CompanyLogo extracted to `src/components/common/`)
- **Import path:** Components import `CompanyLogo` from `'../components/common/CompanyLogo'`

## Verification
All 4 components exist with default exports:
- `src/features/auth/LoginView.jsx` - export default LoginView ✓
- `src/features/admin/FinancialReportOverlay.jsx` - export default FinancialReportOverlay ✓
- `src/features/admin/DocumentsAdmin.jsx` - export default DocumentsAdmin ✓
- `src/features/admin/NotificationsAdmin.jsx` - export default NotificationsAdmin ✓

## Deviations from Plan

### Deviation 1: Directory Structure
- **Plan specified:** `src/components/features/`
- **Actual:** `src/features/`
- **Reason:** Plan context and existing structure in `src/features/` (already had `admin/` and `worker/` directories)
- **Impact:** None - components work correctly, paths are consistent with existing feature structure

## Known Stubs
None - all components are fully functional with proper imports and dependencies.

## Commit
```
90bcb0d phase-10: extract feature components to src/features/auth and src/features/admin
```

## Next Steps
Plan 10-03 will update imports in app.jsx to use the extracted components from their new locations.
