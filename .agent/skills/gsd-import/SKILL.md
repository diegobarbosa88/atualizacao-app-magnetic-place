---
name: gsd-import
description: "Ingerir planos externos com detecção de conflitos contra as decisões do projeto antes de escrever qualquer coisa."
---


<objective>
Import external plan files into the GSD planning system with conflict detection against PROJECT.md decisions.

- **--from**: Import an external plan file, detect conflicts, write as GSD PLAN.md, validate via gsd-plan-checker.

Future: `--prd` mode for PRD extraction is planned for a follow-up PR.
</objective>

<execution_context>
@.agent/get-shit-done/workflows/import.md
@.agent/get-shit-done/references/ui-brand.md
@.agent/get-shit-done/references/gate-prompts.md
@.agent/get-shit-done/references/doc-conflict-engine.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute the import workflow end-to-end.
</process>
