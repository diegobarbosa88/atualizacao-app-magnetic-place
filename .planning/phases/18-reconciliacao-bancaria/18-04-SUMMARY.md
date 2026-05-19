---
phase: 18-reconciliacao-bancaria
plan: "04"
subsystem: admin-ui
tags: [reconciliacao-bancaria, admin, upload, drag-drop, supabase]
dependency_graph:
  requires:
    - 18-03  # API route /api/reconciliacao/upload (resposta JSON shape)
  provides:
    - ReconciliacaoAdmin.jsx (UI completo de reconciliação)
  affects:
    - AdminDashboard.jsx (Plan 05 ligará este componente)
tech_stack:
  added: []
  patterns:
    - drag-and-drop HTML5 nativo (onDragOver/onDragLeave/onDrop)
    - supabase.from('faturas').update({ status: 'PAGO' }) directo do frontend
    - fetch com FormData para API route
    - histórico via reconciliation_runs.select() ao montar
key_files:
  created:
    - src/features/admin/ReconciliacaoAdmin.jsx
  modified: []
decisions:
  - "Confirmação de pagamento individual (não-bulk) conforme D-10 — admin revê antes de actualizar"
  - "Histórico read-only conforme D-12 — botão Confirmar Pagamento não aparece em runs anteriores"
  - "Validação PDF no cliente com mensagem explícita em PT para orientar o admin"
  - "gmail_message_id preenchido com prefixo 'manual-' para respeitar campo NOT NULL do schema"
metrics:
  duration: "~15min"
  completed: "2026-05-19"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 18 Plan 04: ReconciliacaoAdmin.jsx — UI Completo Summary

**One-liner:** Componente React de reconciliação bancária com upload drag & drop CSV/OFX, sub-tabs de resultados (matched/orphan_bank/orphan_system), confirmação de pagamento individual via Supabase, formulário de inserção manual e histórico colapsável de runs anteriores.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Criar ReconciliacaoAdmin.jsx — Upload + Sub-tabs de Resultados | d04692c | src/features/admin/ReconciliacaoAdmin.jsx |

## What Was Built

### ReconciliacaoAdmin.jsx (462 linhas)

Componente principal com 5 secções funcionais:

1. **Header + Botão Inserção Manual** — Título com ícone `Landmark`, botão toggle para o formulário manual.

2. **Formulário de Inserção Manual** — Campos tipo (fatura/recibo), valor, data_documento, entidade e descrição. Guarda directamente via `supabase.from('faturas').insert()`. O campo `gmail_message_id` é preenchido com `manual-{timestamp}` para respeitar o `NOT NULL` do schema.

3. **Zona de Upload Drag & Drop** — HTML5 nativo (`onDragOver`, `onDragLeave`, `onDrop`). Valida extensão: CSV/OFX/QFX aceites, PDF rejeitado com mensagem clara em PT. Botão "Processar Extrato" envia via `fetch('/api/reconciliacao/upload', { method: 'POST', body: FormData })`.

4. **Sub-tabs de Resultados** — Aparecem após processamento com 3 tabs:
   - **Reconciliados (N)** — fundo `emerald-50`, botão "Confirmar Pagamento" por linha (oculto se já `PAGO` ou em modo histórico)
   - **Órfãos Banco (N)** — `amber-50` para ambíguos, `rose-50` para sem correspondência; mostra candidatos quando `reason === 'ambiguous'`
   - **Órfãos Sistema (N)** — `rose-50`, mostra faturas pendentes sem transação correspondente

5. **Histórico Colapsável** — Carregado de `reconciliation_runs` ao montar. Ao clicar num run, carrega `results_json` e mostra em modo read-only (sem botão Confirmar Pagamento, conforme D-12).

### Funções implementadas

| Função | Responsabilidade |
|--------|-----------------|
| `carregarHistorico` | SELECT de reconciliation_runs ao montar e após cada processamento |
| `processar` | POST fetch com FormData para /api/reconciliacao/upload |
| `confirmarPagamento` | supabase.from('faturas').update({ status: 'PAGO' }).eq('id', faturaId) |
| `guardarFatura` | supabase.from('faturas').insert() com campos obrigatórios |
| `validarESelecionarFicheiro` | Valida extensão, rejeita PDF com mensagem PT |

## Deviations from Plan

None — plano executado exactamente como escrito.

## Known Stubs

None — componente completamente funcional. O campo `storage_path` e `url` são enviados como strings vazias na inserção manual, o que é válido para a fase MVP (D-15).

## Threat Surface Scan

Nenhuma superfície nova além do declarado no `<threat_model>` do plano:
- T-18-10: `supabase.update({ status: 'PAGO' })` do frontend — aceite; RLS e sessão autenticada protegem
- T-18-11: Histórico read-only — garantido pela condição `!runSelecionado` no botão Confirmar Pagamento

## Self-Check: PASSED

- [x] `src/features/admin/ReconciliacaoAdmin.jsx` criado (462 linhas)
- [x] Commit `d04692c` existe
- [x] `grep -c "Confirmar Pagamento\|orphan_bank\|orphan_system\|reconciliation_runs\|FormData"` → 24 matches
- [x] `orphan_bank` → 7 ocorrências; `orphan_system` → 7 ocorrências
- [x] 5 funções principais presentes (export default, confirmarPagamento, processar, carregarHistorico, guardarFatura)
