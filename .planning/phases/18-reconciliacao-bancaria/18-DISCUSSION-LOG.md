# Discussion Log: Phase 18 — Reconciliação Bancária Automática

**Date:** 2026-05-19
**Outcome:** CONTEXT.md created, ready for planning

## Summary

The user defined a bank reconciliation module to cross-reference bank statement transactions (CSV/OFX) with invoices and receipts in the database. All key decisions were captured in 18-CONTEXT.md.

## Decisions Made

**Upload & Parsing:**
- CSV and OFX accepted; PDF explicitly rejected with a clear error message
- CSV parser uses header auto-detection (Portuguese column names: Data, Valor, Descrição, Débito, Crédito)
- Standardized output: `Transacao[]` with `{ data, descricao, valor, tipo: 'credito'|'debito' }`

**Matching Engine:**
- Rule 1 (Exact): Match by exact numeric value against PENDENTE faturas
- Rule 2 (Description): When multiple documents share the same value, use bank description to find worker name, client name, or NIF (case-insensitive substring)
- 3 transaction states: `matched`, `ambiguous`, `orphan_bank`
- 3 document states: `matched`, `orphan_system`, `pending`

**Workflow:**
- Non-destructive by default — results displayed without modifying DB
- Per-line "Confirmar Pagamento" button updates status PENDENTE → PAGO in `faturas` table
- No bulk confirmation — intentional for admin review

**Persistence:**
- New table `reconciliation_runs` stores each import's metadata + JSON blobs
- History view: read-only, no re-confirmation of past runs

**Database:**
- New table `faturas` with fields: id, tipo, valor, data_documento, descricao, entidade, status, fonte, ficheiro_url
- MVP: admin can insert faturas manually via simple form

**Architecture:**
- Vercel API Route `/api/reconciliacao/upload.js` (follows Phase 17 pattern)
- FormData upload → parse + match + save run → return structured JSON
- Frontend button "Confirmar Pagamento" → `saveToDb('faturas', id, { status: 'PAGO' })` directly

**UI:**
- New "Reconciliação" tab in AdminDashboard with Landmark icon
- Drag & drop zone + "Processar" button
- 3 result sub-tabs: Reconciliados / Órfãos Banco / Órfãos Sistema
- Collapsible history section below results
- Design: emerald for matches, amber for ambiguous, rose for orphans
