---
phase: 18-reconciliacao-bancaria
plan: "01"
subsystem: database-migrations
tags: [supabase, sql, migrations, reconciliacao-bancaria, faturas, rls]
dependency_graph:
  requires: []
  provides:
    - faturas table reconciliation columns (tipo, valor, data_documento, descricao, entidade, status, fonte, ficheiro_url)
    - reconciliation_runs table
  affects:
    - matching engine (Plan 03) — precisa de status='PENDENTE' e campo valor
    - API route (Plan 03) — insere em reconciliation_runs após cada run
tech_stack:
  added: []
  patterns:
    - ADD COLUMN IF NOT EXISTS com CHECK constraints (idempotent)
    - RLS com políticas separadas por operação (SELECT / INSERT)
key_files:
  created:
    - supabase/migrations/20260519_reconciliacao_faturas_columns.sql
    - supabase/migrations/20260519_reconciliation_runs.sql
  modified: []
decisions:
  - status CHECK IN ('PENDENTE','PAGO') — dois estados simples, sem transições intermédias
  - fonte CHECK IN ('gmail','toc','manual') — três origens previstas no MVP
  - RLS USING(true) — admin único, sem multi-tenant; rever em Phase 19+
  - Indexes em status e valor para performance do matching engine
metrics:
  duration: "~10 min"
  completed: "2026-05-19"
  tasks_completed: 2
  tasks_total: 3
  files_created: 2
  files_modified: 0
---

# Phase 18 Plan 01: Migrações SQL — Campos de Reconciliação e Tabela reconciliation_runs

**One-liner:** Duas migrações SQL idempotentes que estendem `faturas` com 8 campos financeiros e criam `reconciliation_runs` com RLS e indexes de performance.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migração — Estender tabela `faturas` com campos de reconciliação | 0ee2b4c | supabase/migrations/20260519_reconciliacao_faturas_columns.sql |
| 2 | Migração — Criar tabela `reconciliation_runs` | 276fcff | supabase/migrations/20260519_reconciliation_runs.sql |

## What Was Built

### Task 1 — `20260519_reconciliacao_faturas_columns.sql`

Adiciona 8 colunas à tabela `faturas` (Phase 17) para suportar o matching engine:

- `tipo TEXT CHECK IN ('fatura','recibo')` — tipo de documento
- `valor NUMERIC` — valor monetário para matching exato
- `data_documento DATE` — data do documento financeiro
- `descricao TEXT` — descrição para matching por texto
- `entidade TEXT` — nome trabalhador/cliente/NIF
- `status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK IN ('PENDENTE','PAGO')` — estado do documento
- `fonte TEXT NOT NULL DEFAULT 'gmail' CHECK IN ('gmail','toc','manual')` — origem do registo
- `ficheiro_url TEXT` — URL do ficheiro associado

Indexes de performance: `faturas_status_idx` (filtragem por PENDENTE) e `faturas_valor_idx` (matching numérico).

### Task 2 — `20260519_reconciliation_runs.sql`

Cria a tabela `reconciliation_runs` para histórico de imports bancários com 9 campos (D-11):

- `id, created_at, filename` — identificação do run
- `transaction_count, matched_count, orphan_bank_count, orphan_system_count` — contagens do resultado
- `transactions_json JSONB` — transações bancárias originais
- `results_json JSONB` — resultados do matching (matched, orphan_bank, orphan_system)

RLS ativo com políticas separadas: `Admin can read` (SELECT) e `Service role can insert` (INSERT). Index em `created_at DESC` para listar histórico ordenado.

## Checkpoint Pending

**Task 3** requer ação humana: aplicar as migrações no Supabase Dashboard (SQL Editor).

**Passos:**
1. Supabase Dashboard → SQL Editor
2. Executar `20260519_reconciliacao_faturas_columns.sql` — verificar "Success. No rows returned."
3. Executar `20260519_reconciliation_runs.sql` — verificar "Success. No rows returned."
4. No Table Editor, confirmar que `faturas` tem as 8 novas colunas e `reconciliation_runs` existe com 9 campos
5. Responder "aplicado" para continuar

**Verificação SQL:**
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'faturas'
  AND column_name IN ('tipo','valor','data_documento','descricao','entidade','status','fonte','ficheiro_url')
ORDER BY column_name;
-- Deve retornar 8 linhas

SELECT table_name FROM information_schema.tables
WHERE table_name = 'reconciliation_runs';
-- Deve retornar 1 linha
```

## Deviations from Plan

None — plano executado exatamente como escrito.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| T-18-02 already in threat model | 20260519_reconciliation_runs.sql | RLS USING(true) é adequado para admin único; rever se projeto se tornar multi-tenant |
| T-18-03 already in threat model | 20260519_reconciliacao_faturas_columns.sql | CHECK constraints em status e fonte validados ao nível da BD |

## Known Stubs

None — ficheiros SQL não têm stubs; dados serão inseridos pelo módulo Gmail (Phase 17) e pelo admin via formulário (Plan 02).

## Self-Check

- [x] `supabase/migrations/20260519_reconciliacao_faturas_columns.sql` — criado (commit 0ee2b4c)
- [x] `supabase/migrations/20260519_reconciliation_runs.sql` — criado (commit 276fcff)
- [x] 8 ALTER TABLE ADD COLUMN IF NOT EXISTS no ficheiro 1
- [x] CREATE TABLE IF NOT EXISTS reconciliation_runs no ficheiro 2
- [x] ENABLE ROW LEVEL SECURITY em ambos os ficheiros relevantes

## Self-Check: PASSED
