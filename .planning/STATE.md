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

## Todos

- [ ] Phase 14: Planear editor de blocos JSON — /gsd-plan-phase 14

## Next Steps

1. /gsd-plan-phase 14 — Criar PLAN.md para Phase 14 (Editor de Blocos JSON)

*State updated: 2026-05-12*