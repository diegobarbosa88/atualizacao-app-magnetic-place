# Planos de Implementação — APP MAGNETIC

Gerado pelo skill `/improve` em 2026-06-22 (commit `88e51cb`). Executa pela ordem abaixo excepto onde indicado nas dependências. Cada executor: lê o plano integralmente antes de começar, respeita as condições STOP, e actualiza o estado quando concluir.

## Ordem de execução e estado

| Plano | Título | Prioridade | Esforço | Depende de | Estado |
|-------|--------|-----------|---------|------------|--------|
| [001](001-api-key-query-param.md) | Remover chave Gemini API do query param | P1 | S | — | DONE |
| [002](002-gemini-key-localstorage.md) | Parar de persistir chave Gemini no localStorage | P1 | S | — | DONE |
| [003](003-stack-traces-api.md) | Remover stack traces das respostas de erro da API | P1 | S | — | DONE |
| [004](004-host-header-callback-urls.md) | Fixar injecção via host header em URLs de callback | P2 | S | — | DONE |
| [005](005-correcoescorrections-startup.md) | Corrigir correcoesCorrections vazio no startup | P1 | S | — | DONE |
| [006](006-env-example.md) | Criar ficheiro .env.example | P2 | S | 004 | DONE |
| [007](007-reconciliation-engine-tests.md) | Adicionar testes para reconciliacaoSalarialEngine | P2 | M | — | DONE |

Status values: `TODO` | `IN PROGRESS` | `DONE` | `BLOCKED` (com motivo) | `REJECTED` (com motivo)

## Notas de dependência

- **006 depende de 004**: o plano 004 introduz a variável `APP_URL`; o `.env.example` deve incluí-la.
- Os restantes planos (001, 002, 003, 005, 007) são independentes e podem ser executados em paralelo.

## Descobertas consideradas e rejeitadas

- **".env committed to git"** — incorreto: `.env` está em `.gitignore` e não é rastreado. Falso positivo do audit.
- **"Missing auth checks on API endpoints"** — by-design para app single-tenant; não é uma vulnerabilidade no contexto actual.
- **"CSRF protection on Gmail import"** — o `x-import-secret` é um padrão adequado para um trigger de importação server-to-server num ambiente single-tenant.
- **"Race condition em notificações realtime"** — baixa confiança, sem evidência directa; não justifica plano.
- **"xmldom critical vulnerability (DEPS-01)"** — sem fix disponível (`docxtemplater-image-module-free` depende de versão vulnerável de `xmldom`); risco aceite enquanto não houver alternativa. Rever em cada `npm audit`.
- **"AppContext god object (700 linhas)"** — real, mas esforço L com risco MED; prioritário apenas após cobertura de testes mais sólida. Endereçar como trabalho separado.
