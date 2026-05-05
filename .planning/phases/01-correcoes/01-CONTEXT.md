# Phase 1: Correções de Segurança e Error Handling - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminar vulnerabilidades críticas de segurança (API keys hardcoded) e corrigir problemas de error handling identificados no codebase existente.
</domain>

<decisions>
## Implementation Decisions

### Missing Environment Variables
- **D-01:** O sistema deve ter **degradação elegante** — se uma variável de ambiente estiver em falta, a funcionalidade correspondente deve mostrar uma mensagem clara ao utilizador em português e continuar a funcionar (quando possível), em vez de bloquear completamente a aplicação.

### Formato de Mensagens de Erro
- **D-02:** Todas as mensagens de erro para o utilizador final devem ser em **português**.
- **D-03:** Detalhes técnicos (console logs, debug info) podem permanecer em inglês.
- **D-04:** Códigos de erro HTTP específicos devem retornar mensagens descritivas em português (ex: 401 → "Chave API inválida", 429 → "Limite de uso atingido").

### Testes
- **D-05:** Adicionar testes unitários para as correções aplicadas (validação NaN, error handling, etc.).
- **D-06:** Prioridade: testes para `handleAiPolish` (async error handling) e validação em `reduce` operations.

### the agent's Discretion
- Validação exata de como implementar a degradação elegante é deixada ao critério do agente — pode ser `try/catch` com fallback ou validação `import.meta.env.VITE_*` antes de usar.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project vision, constraints (security), stack
- `.planning/REQUIREMENTS.md` — 10 requirements for Phase 1 (SEC-01 to SEC-04, ERR-01 to ERR-03, DATA-01 to DATA-03)
- `.planning/ROADMAP.md` — Phase 1 goal and success criteria
- `.planning/codebase/STACK.md` — Current tech stack (React 19, Supabase, Vite)

### Existing Code (for reference)
- `src/app.jsx` — Main app with hardcoded secrets (lines 22-23, 62-65, 1224-1225)
- `src/app.jsx` — `callGemini` function (lines 30-51) — needs error handling improvements
- `src/app.jsx` — `handleAiPolish` function (lines 261-267) — needs try/catch/finally
- `src/ClientPortal.jsx` — Supabase subscription (lines 61-85) — needs dependency array fix

### External Docs
- No external specs — requirements fully captured in decisions above
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app.jsx` — já existe `callGemini` com fetch — pode ser adaptado para usar Bearer token
- Supabase client já configurado — usar `import.meta.env` para credenciais

### Established Patterns
- Error handling com `try/catch` já usado em algumas partes do código — padronizar
- Mensagens de erro em português já existem em algumas áreas — usar como modelo

### Integration Points
- Novas env vars: `VITE_GEMINI_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLIENT_PORTAL_URL`
- Código que usa `import.meta.env.VITE_*` é o padrão Vite para variáveis de frontend
</code_context>

<specifics>
## Specific Ideas

- Implementar `VITE_GEMINI_API_KEY` via `import.meta.env.VITE_GEMINI_API_KEY` em vez de string hardcoded
- API key do Gemini deve ser enviada no header `Authorization: Bearer ${apiKey}` em vez de query string
- `handleAiPolish` deve usar `try/catch/finally` guarantee pattern
- Reducer operations devem usar `isNaN` check antes de somar
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 1-Correções de Segurança e Error Handling*
*Context gathered: 2026-05-05*
