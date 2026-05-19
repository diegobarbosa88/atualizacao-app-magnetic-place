---
phase: 11-gestao-trabalhadores
plan: 01
subsystem: worker-management
tags: [worker-registration, date-fields, contract-dates]
dependency_graph:
  requires: []
  provides: [WORKER-01, WORKER-03]
  affects: [TeamManager.jsx, TeamContext.jsx]
tech_stack:
  added: [date input fields, auto-status logic]
  patterns: [form-state-management, auto-inactive-toggle]
key_files:
  created: []
  modified:
    - src/features/admin/contexts/TeamContext.jsx
    - src/features/admin/TeamManager.jsx
decisions: []
metrics:
  duration: ~
  tasks_completed: "3/3"
  files_modified: 2
  completed_date: "2026-05-07"
---

# Phase 11 Plan 01: Data de início/fim no registo de trabalhador Summary

## Objective

Adicionar campos de Data de Início e Data de Fim ao formulário de registo de trabalhadores. Quando Data de Fim for preenchida, a conta deve automaticamente ficar inativa.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add dataInicio/dataFim to workerForm state | d11eefc | TeamContext.jsx |
| 2 | Add date inputs to worker form | b226436 | TeamManager.jsx |
| 3 | Auto-set inactive when dataFim filled | 07e281e | TeamContext.jsx, TeamManager.jsx |

## Verification Results

- [x] `grep -c "dataInicio.*dataFim" TeamContext.jsx` → 1 (> 0)
- [x] `grep -c "type=\"date\"" TeamManager.jsx` → 2 (== 2)
- [x] `grep -c "dataFim.*inativo" TeamContext.jsx` → 1 (> 0)

## Deviations from Plan

None - plan executed exactly as written.

## Threat Flags

None identified - dates are client-entered strings validated by Supabase.

## Self-Check: PASSED

All files modified as expected, commits verified.