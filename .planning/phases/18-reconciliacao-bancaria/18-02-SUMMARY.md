---
phase: 18-reconciliacao-bancaria
plan: "02"
subsystem: api-reconciliacao
tags: [api-route, csv-parser, ofx-parser, vercel-serverless]
key-files:
  created:
    - api/reconciliacao/upload.js
  modified:
    - package.json
metrics:
  tasks_completed: 2
  tasks_total: 2
  commits: 2
---

## Summary

Plano 18-02 completo. Instaladas dependências e criada a API Route base com parsers CSV e OFX normalizados para `Transacao[]`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 — npm deps | 83edfcf | chore(18-02): instalar dependências csv-parse, ofx-js e formidable |
| 2 — API Route | de50eda | feat(18-02): criar API Route /api/reconciliacao/upload.js com parsers CSV e OFX |

## What Was Built

**`api/reconciliacao/upload.js`** — Vercel API Route que:
- Recebe upload via FormData (formidable, bodyParser:false)
- **Rejeita PDFs** explicitamente com mensagem de erro clara
- **Parser CSV**: auto-detects colunas por cabeçalho (Data, Valor, Descrição, Débito, Crédito) — normaliza datas DD-MM-YYYY / DD/MM/YYYY → YYYY-MM-DD
- **Parser OFX**: extrai transações de `OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN`
- **Output padronizado**: `Transacao[] = { data, descricao, valor, tipo: 'credito'|'debito' }`
- Plan 03 adicionará o matching engine (por agora retorna transações parseadas)

**Dependências instaladas:**
- `csv-parse@6.2.1` — parsing CSV linha a linha com API sync
- `ofx-js@1.0.0` — parsing ficheiros OFX/QFX bancários
- `formidable@3.5.4` — multipart/form-data file upload

## Deviations

Nenhuma. Seguido exactamente o plano. Usou `csv-parse` e `ofx-js` (equivalentes funcionais a `csv-parser` e `ofx` mencionados no CONTEXT.md com melhor suporte a async).

## Self-Check: PASSED

- ✓ `api/reconciliacao/upload.js` existe com parser CSV e OFX
- ✓ PDF rejeitado com mensagem explícita
- ✓ Output `Transacao[]` com campos `data`, `descricao`, `valor`, `tipo`
- ✓ Dependências csv-parse, ofx-js, formidable em package.json
