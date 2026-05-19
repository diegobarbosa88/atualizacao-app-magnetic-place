---
phase: 18-reconciliacao-bancaria
plan: "03"
subsystem: matching-engine
tags: [matching-engine, api-route, supabase, reconciliacao-bancaria, tdd, vitest]
dependency_graph:
  requires:
    - "18-01" — tabelas faturas e reconciliation_runs no Supabase
    - "18-02" — parsers CSV/OFX em upload.js (Transacao[])
  provides:
    - runMatchingEngine (função pura exportável, testada)
    - API Route /api/reconciliacao/upload.js completa com matching + persistência
    - Resposta { run_id, matched[], orphan_bank[], orphan_system[], counts }
  affects:
    - Plan 18-04 (UI ReconciliacaoAdmin) — consome run_id e os 3 arrays da resposta
    - Plan 18-05 (botão Confirmar Pagamento) — matched[] contém fatura.id para update
tech_stack:
  added: []
  patterns:
    - TDD com Vitest (RED commit → GREEN commit)
    - Função pura extraída para ficheiro separado (matchingEngine.js) — testável sem mocks
    - Set para marcar faturas já usadas (sem reutilização por transação)
    - Regra 1 (valor exato) → Regra 2 (substring entidade) → ambiguous
key_files:
  created:
    - api/reconciliacao/matchingEngine.js
    - tests/unit/matchingEngine.test.js
  modified:
    - api/reconciliacao/upload.js
decisions:
  - runMatchingEngine extraída para ficheiro separado para ser testável com Vitest sem mocks Supabase
  - Faturas ambíguas (Regra 2 não resolve) ficam em orphan_bank com reason='ambiguous' e lista de candidates
  - Set usedFaturaIds previne reutilização da mesma fatura por múltiplas transações
  - Função não altera BD (D-08 non-destructive) — apenas lê faturas e grava run; confirmação é manual no frontend
metrics:
  duration: "~15 min"
  completed: "2026-05-19"
  tasks_completed: 1
  tasks_total: 1
  files_created: 2
  files_modified: 1
---

# Phase 18 Plan 03: Matching Engine e API Route Completa

**One-liner:** Matching engine TDD com Regras 1+2 (valor exato + substring entidade), integrado na API Route com query Supabase e persistência em reconciliation_runs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED  | Testes failing para runMatchingEngine | 398dedc | tests/unit/matchingEngine.test.js |
| GREEN | Implementação matchingEngine.js + upload.js completo | b4aee1b | api/reconciliacao/matchingEngine.js, api/reconciliacao/upload.js |

## What Was Built

### `api/reconciliacao/matchingEngine.js` (novo)

Função pura `runMatchingEngine(transacoes, faturas)` que implementa:

- **Regra 1 — Valor exato:** `Number(fatura.valor) === transacao.valor` — se exatamente 1 candidato → `matched` com `rule: 'exact_value'`
- **Regra 2 — Descrição substring:** quando múltiplos candidatos por valor, filtra `fatura.entidade.toLowerCase()` contida em `transacao.descricao.toLowerCase()` — se exatamente 1 → `matched` com `rule: 'description_match'`
- **Ambiguous:** múltiplos candidatos após Regra 2 → `orphan_bank` com `reason: 'ambiguous'` e array `candidates[]`
- **No match:** nenhum candidato → `orphan_bank` com `reason: 'no_match'`
- **Orphan system:** faturas não consumidas → `orphan_system` com `reason: 'no_transaction'`
- Usa `Set usedFaturaIds` para garantir que cada fatura só é consumida uma vez

### `tests/unit/matchingEngine.test.js` (novo)

11 testes Vitest cobrindo:
- Regra 1: match exato, no_match, orphan_system
- Regra 2: desambiguação correta, ambiguous, case-insensitive
- Múltiplas transações: sem reutilização de faturas, múltiplos pares
- Casos extremos: arrays vazios, entidade null, descrição vazia

### `api/reconciliacao/upload.js` (modificado)

Substituição do placeholder Plan 03 com implementação completa:

1. Importa `createClient` do `@supabase/supabase-js` e `runMatchingEngine` de `./matchingEngine.js`
2. Query `faturas` com `status = 'PENDENTE'` via `SUPABASE_SERVICE_ROLE_KEY`
3. Chama `runMatchingEngine(transacoes, faturas || [])`
4. Insere registo em `reconciliation_runs` com todos os campos do D-11
5. Devolve `{ ok, run_id, filename, transaction_count, matched_count, orphan_bank_count, orphan_system_count, matched[], orphan_bank[], orphan_system[] }`

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED  | 398dedc `test(18-03): add failing tests...` | PASSED |
| GREEN | b4aee1b `feat(18-03): matching engine...` | PASSED |
| REFACTOR | — | N/A (código limpo desde GREEN) |

## Deviations from Plan

### Auto-fix (Regra 2 — Estrutura)

**Extração para ficheiro separado:** O plano especificava adicionar `runMatchingEngine` directamente em `upload.js`. Optou-se por extrair para `api/reconciliacao/matchingEngine.js` separado para permitir importação directa nos testes Vitest sem necessidade de mocks para formidable/supabase. A função é importada em `upload.js` com `import { runMatchingEngine } from './matchingEngine.js'`. Sem impacto funcional — comportamento idêntico ao especificado.

## Threat Surface Scan

Sem novas superfícies de ameaça além do threat model existente (T-18-07, T-18-08, T-18-09):
- A função `runMatchingEngine` é pura — sem acesso a rede ou BD
- Supabase queries usam `SUPABASE_SERVICE_ROLE_KEY` (conforme T-18-07)
- Matching é não-destrutivo (D-08) — sem alteração de status de faturas neste plano

## Known Stubs

Nenhum — API devolve dados reais do Supabase; estrutura de resposta completa e funcional.

## Self-Check

- [x] `api/reconciliacao/matchingEngine.js` criado com `export function runMatchingEngine`
- [x] `tests/unit/matchingEngine.test.js` criado com 11 testes (todos passam)
- [x] `api/reconciliacao/upload.js` modificado — sem placeholder Plan 03
- [x] grep `runMatchingEngine` em upload.js: 2 ocorrências (import + chamada)
- [x] grep `.eq('status', 'PENDENTE')` em upload.js: 1 ocorrência
- [x] grep `orphan_bank` em upload.js: 5 ocorrências (>= 3 exigidas)
- [x] grep `orphan_system` em upload.js: 5 ocorrências (>= 3 exigidas)
- [x] grep `reconciliation_runs` em upload.js: 2 ocorrências (from + insert)
- [x] grep `run_id: run.id` em upload.js: 1 ocorrência
- [x] grep `ambiguous` em matchingEngine.js: 2 ocorrências
- [x] grep `description_match\|exact_value` em matchingEngine.js: 2 ocorrências
- [x] grep `SUPABASE_SERVICE_ROLE_KEY` em upload.js: 1 ocorrência
- [x] RED commit 398dedc existe
- [x] GREEN commit b4aee1b existe

## Self-Check: PASSED
