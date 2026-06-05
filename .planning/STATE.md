---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: | 5 | Correção do Sistema de Reports | Complete |
status: unknown
last_updated: "2026-06-05T20:19:21.434Z"
progress:
  total_phases: 11
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# State: app-magnetic

**Project:** app-magnetic
**Milestone:** v3.0 - Automação de Documentos Contratuais
**Phase:** Not started (defining requirements)
**Last updated:** 2026-05-12 after v3.0 milestone start

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-12)

**Core value:** Modularidade e escalabilidade: a gestão de horas e relatórios é automatizada, com uma arquitetura limpa e sustentável que permite o crescimento rápido de novas funcionalidades sem a dívida técnica de um monolito.

**Current focus:** Phase 14 — Editor de Blocos JSON

## Phase Status

| Phase | Status | Plans | Summaries |
|-------|--------|-------|-----------|
| 14 | Planning | 0 | 0 |

## Milestone v3.0 — Automação de Documentos Contratuais

### Target Features

- Editor de blocos JSON (Gestor/HR) — adicionar, remover, reordenar blocos com variáveis `{{variavel}}`
- Viewer responsivo (Trabalhador) — renderizar HTML, substituir variáveis, botão "Assinar Digitalmente"
- Motor PDF com pdfmake — mapeamento JSON→docDefinition, signature unbreakable, margens 50/60mm

### Key Decisions

- pdfmake para geração de PDF (não html2canvas/jsPDF)
- Editor de blocos JSON como formato de armazenamento do documento
- Variáveis dinâmicas com syntax `{{variavel}}`
- Bloco signature com `unbreakable: true` para quebras de página perfeitas

## Phase 18 — Reconciliação Bancária Automática

**Context:** Gathered 2026-05-19 — ready for planning
**Key decisions:** CSV/OFX upload, matching engine (exact + description), non-destructive workflow, new `faturas` table, Vercel API Route
**Context file:** `.planning/phases/18-reconciliacao-bancaria/18-CONTEXT.md`

## Phase Status

| Phase | Status | Plans |
|-------|--------|-------|
| 18 | Ready to execute | 5 |

## Todos

- [ ] Phase 18: Executar reconciliação bancária — /gsd-execute-phase 18

## Next Steps

1. /gsd-execute-phase 18 — Executar Phase 18 (Reconciliação Bancária Automática)

*State updated: 2026-05-19*
