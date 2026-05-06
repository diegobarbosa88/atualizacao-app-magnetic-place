---
phase: 07-modularizacao-admin-core
plan: '07'
type: execute
wave: 1
subsystem: admin-features
tags: [context-extraction, modularization, react-context]
tech-stack:
  added:
    - React Context API (createContext, useContext, useState, useCallback)
  patterns:
    - Feature-local Context pattern (per-manager contexts)
    - Provider wrapping pattern for component isolation
    - Hook-based API for context consumption
dependency-graph:
  requires:
    - src/context/AppContext.jsx
  provides:
    - src/features/admin/contexts/TeamContext.jsx
    - src/features/admin/contexts/ClientContext.jsx
    - src/features/admin/contexts/ScheduleContext.jsx
key-files:
  created:
    - src/features/admin/contexts/TeamContext.jsx
    - src/features/admin/contexts/ClientContext.jsx
    - src/features/admin/contexts/ScheduleContext.jsx
    - src/features/admin/index.js
  modified:
    - src/features/admin/TeamManager.jsx
    - src/features/admin/ClientManager.jsx
    - src/features/admin/ScheduleManager.jsx
decisions:
  - Extract local UI state (isAddingInTab, view mode, sort, form data) into feature-specific contexts
  - Keep global data (workers, clients, schedules) in AppContext, consume via useApp() hook
  - Each manager component wrapped by its Provider for full isolation
  - Handler functions (handleSave, handleDelete) moved into contexts to maintain encapsulation
metrics:
  duration: "~2 minutes"
  completed: "2026-05-06"
  tasks: 3
  files: 7
---

# Phase 07: Modularização Admin Core Summary

**One-liner:** Extracted TeamContext, ClientContext, and ScheduleContext from manager components for full feature isolation.

## Objective

Create dedicated contexts for TeamManager, ClientManager, and ScheduleManager to make each manager fully autonomous for local state while consuming global data from AppContext.

## What Was Built

### TeamContext (`src/features/admin/contexts/TeamContext.jsx`)
- Local state: `isAddingInTab`, `workersView`, `workersSort`, `workerForm`
- Actions: `handleSaveWorker`, `handleDeleteWorker`
- Exports: `TeamProvider`, `useTeam()` hook

### ClientContext (`src/features/admin/contexts/ClientContext.jsx`)
- Local state: `isAddingInTab`, `clientsView`, `clientsSort`, `clientForm`
- Actions: `handleSaveClient`, `handleDeleteClient`
- Exports: `ClientProvider`, `useClient()` hook

### ScheduleContext (`src/features/admin/contexts/ScheduleContext.jsx`)
- Local state: `isAddingInTab`, `schedulesView`, `schedulesSort`, `scheduleForm`
- Actions: `handleSaveSchedule` (with worker association logic), `handleDeleteSchedule`
- Exports: `ScheduleProvider`, `useSchedule()` hook

### Refactored Managers
All three managers now:
- Wrapped in their respective Provider components
- Use context hooks for local state only
- Consume global data via `useApp()` for database operations

### Index Exports (`src/features/admin/index.js`)
```javascript
export { useTeam } from './contexts/TeamContext';
export { useClient } from './contexts/ClientContext';
export { useSchedule } from './contexts/ScheduleContext';
```

## Verification

| Check | Status |
|-------|--------|
| TeamContext created with useTeam() hook | ✓ |
| ClientContext created with useClient() hook | ✓ |
| ScheduleContext created with useSchedule() hook | ✓ |
| Managers refactored to use context | ✓ |
| index.js exports all hooks | ✓ |

## Threat Flags

None — all data flows through existing AppContext trust boundaries.

## Commit

```
38188d5 feat(07): extract TeamContext, ClientContext, ScheduleContext from manager components
```

## Self-Check: PASSED
