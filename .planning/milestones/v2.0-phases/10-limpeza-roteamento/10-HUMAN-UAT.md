---
status: partial
phase: 10-limpeza-roteamento
source: [10-VERIFICATION.md]
started: 2026-05-09T00:00:00Z
updated: 2026-05-09T00:00:00Z
---

## Current Test

[aguardando testes manuais no browser]

## Tests

### 1. Vista de Login funciona correctamente
expected: Página de login carrega, autenticação admin e worker funciona, PWA install prompt aparece em iOS/Android
result: [pendente]

### 2. Vista Admin carrega sem erros
expected: AdminDashboard renderiza com todas as tabs (Team, Clients, Schedule, Reports, etc.), sem erros de import no console
result: [pendente]

### 3. EntryForm funciona no contexto Admin e Worker
expected: Formulário de registo de horas abre, permite submissão, AI polish funciona
result: [pendente]

### 4. WorkerDashboard e assinatura de documentos
expected: Worker consegue ver documentos, fluxo de assinatura PDF (WorkerDocuments) funciona sem erros
result: [pendente]

### 5. ClientTimesheetReport — geração de ZIP
expected: Admin consegue gerar relatório PDF para cliente, download ZIP funciona
result: [pendente]

### 6. FinancialReportOverlay
expected: Overlay de relatório financeiro abre, cálculos de receita/custos/lucro aparecem correctamente
result: [pendente]

### 7. Portal de Cliente funciona
expected: Vista ClientPortal carrega e é funcional
result: [pendente]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
