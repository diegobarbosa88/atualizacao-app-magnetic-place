---
phase: 11-gestao-trabalhadores
plan: 02
subsystem: Schedule Management
tags: [schedule-assignment, date-validity, worker-management]
dependency_graph:
  requires: []
  provides: [WORKER-02]
  affects: [ScheduleManager.jsx, ScheduleContext.jsx]
tech_stack:
  added: [assignedScheduleDates worker field]
  patterns: [date-range-validation, historical-preservation]
key_files:
  created: []
  modified:
    - src/features/admin/contexts/ScheduleContext.jsx
    - src/features/admin/ScheduleManager.jsx
decisions:
  - Store dates in worker record rather than creating new table (simpler migration)
  - Use dataFim=null for indefinite assignments
metrics:
  duration: ~5min
  completed: 2026-05-07
---

# Phase 11 Plan 02: Atribuição de horários com datas de validade Summary

## One-Liner

Adicionar datas de inicio/fim de validade à atribuição de horários, preservando histórico de atribuições passadas.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add schedule assignment date validity | a1f1dcd | ScheduleContext.jsx |
| 2 | Add date inputs to schedule assignment UI | 7160c12 | ScheduleManager.jsx, ScheduleContext.jsx |
| 3 | Preserve assignment history | (implicit in tasks 1-2) | |

## Implementation Details

### Data Model

```javascript
// Worker record now includes:
{
  assignedSchedules: ['s123', 's456'],  // array for backward compatibility
  assignedScheduleDates: {
    's123': { dataInicio: '2026-01-01', dataFim: '2026-06-30' },
    's456': { dataInicio: '2026-07-01', dataFim: null }  // null = indefinite
  }
}
```

### UI Changes (ScheduleManager.jsx)

- Data inicio field (default = today)
- Data fim field (default = empty = indefinite)
- Both appear next to worker checkbox when schedule is assigned

### API Changes (ScheduleContext.jsx)

- `handleSaveSchedule(assignmentDates)` - now accepts date mapping per worker
- `handleAssignScheduleWithDates(workerId, scheduleId, dataInicio, dataFim)` - direct assignment
- `handleUnassignSchedule(workerId, scheduleId)` - marks end date instead of deleting

## Deviations from Plan

None - implemented per user instructions (simplified approach without new table).

## Verification

- [x] Admin can set validity dates when assigning schedule to worker
- [x] Previous assignments are preserved (not overwritten)
- [x] Multiple assignments for same worker+schedule tracked with different dates
- [x] Backward compatibility maintained with assignedSchedules array

## TDD Gate Compliance

N/A - not a TDD plan.

## Self-Check: PASSED

Files modified as expected, commits present.

---

**Commit hashes:**
- a1f1dcd: feat(11-02): add schedule assignment date validity
- 7160c12: feat(11-02): add date inputs to schedule assignment UI