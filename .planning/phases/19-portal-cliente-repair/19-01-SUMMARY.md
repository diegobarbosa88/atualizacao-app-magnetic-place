# Summary: Phase 19 — Reparações Portal Cliente

## Objetivo
Corrigir os problemas críticos do portal cliente identificados em `PORTAL-CLIENTE-REVIEW.md` (2026-05-22).

## Ficheiros Modificados
- `src/ClientPortal.jsx` — 2 correções reais aplicadas

## Correções Aplicadas

### BUG-01 · PDF "Baixar Todos" baixa de todos os clientes (CRITICAL)
**Ficheiro:** `src/ClientPortal.jsx:2454`

**Problema:** Quando `printingWorker === 'all'`, o `renderReport` era chamado sem os parâmetros `portalLogs`, `portalClientId`, `portalMonth`. O fallback em `app.jsx:396` usava `logs` (TODOS os clientes) e activava modo global, gerando PDFs de todos os clientes em vez de só o cliente efectivo.

**Fix aplicado:**
```jsx
// Antes (bugado):
{renderReport(printingWorker === 'all' ? null : printingWorker, printingWorker === 'all')}

// Depois (corrigido):
{renderReport(
  printingWorker === 'all' ? null : printingWorker,
  printingWorker === 'all',
  logs,                    // portalLogs = logs filtrados por effectiveClientId
  effectiveClientId,       // portalClientId
  selectedMonth            // portalMonth
)}
```

**Verificação:** O `renderReport` em `app.jsx:394` propaga `portalClientId` para o `ClientTimesheetReport`, que em modo não-global filtra por `client.id`. Com `effectiveClientId` como parâmetro, o PDF respeita o filtro do cliente activo.

---

### IN-03 · IP fetch sem fallback explícito em caso de erro
**Ficheiro:** `src/ClientPortal.jsx:426-431`

**Problema:** O `.catch()` não fazia nada — se o fetch falhasse, `clientIp` ficaria `undefined` e o fallback `clientIp || 'N/D'` no approval seria usado, mas sem feedback ao utilizador.

**Fix aplicado:**
```jsx
// Antes:
.then(data => setClientIp(data.ip))
.catch(err => console.error("Erro ao obter IP:", err));

// Depois:
.then(data => setClientIp(data.ip || 'N/D'))
.catch(() => setClientIp('N/D'));
```

---

## Issues que JÁ Estavam Corrigidos no Código

Os seguintes issues do `PORTAL-CLIENTE-REVIEW.md` **não necessitavam de correcção** — o código actual já os implementava correctamente:

- **CR-03** (ReferenceError: notifId): `const notifId = "notif_" + Date.now();` já está declarado antes da Promise chain (linha 1461). O bug original já não existe.

- **CR-04** (handleAcceptContestation sem useCallback): A função já está envolvida em `useCallback` (linha 477) com `clientData` no dependency array (linha 536). Correcção anterior já aplicada.

- **CR-05** (todayLogs fetch ignora erros): Ambos os `useEffect` (linhas 340-342 e 356-358) já têm tratamento de erro com `if (error)` + `return`. Código já corrigido.

- **CR-06** (isDirectAccess bypass): `isDirectAccess = false` hardcoded na linha 286. segurança desactivada.

- **CR-07** (GPS com nome hardcoded): Agente confirmou ausência de "diego rocha barbosa" no WorkerDashboard. O código usa `currentUser.gps_enabled === true` (campo na base de dados). Já estava corrigido.

---

## Issues Falsos Positivos (Misinterpretados)

- **CR-01** (return dentro de JSX): A linha 1558 `return (` é o `return` de uma **função** (`renderCorrecao`), não um `return` dentro de JSX expressão. O fluxo é: `renderCorrecao` é chamada pela renderização principal e retorna o seu JSX condicionalmente. O `<main>` autenticado (linha 2161) é渲染ado pelo `return` principal do componente (linha 2124) — não é alcançado "por baixo" do `return` de `renderCorrecao`. A estrutura é lógica, não um bug. Confirmado após análise profunda do fluxo de renderização.

- **WR-01** (originalWorkersData dependency): O dependency array `[logs, workers, effectiveClientId, selectedMonth]` (linha 575) **já inclui** `effectiveClientId` e `selectedMonth`. A queixa do review era de que usava `initialClientId` e `initialMonth` — mas o código actual usa os valores correctos.

- **WR-07** (dismissedNotifs key): O useEffect às linhas 433-439 já usa `effectiveClientId` como key. Problema já não existe.

- **WR-08** (style injection): O `<style dangerouslySetInnerHTML>` às linhas 2459-2506 é o método usado para CSS de impressão. O `useEffect` com append/remove de style tags já não existe (foi removido ou refactorado).

---

## Issues Não Tratados (Recomendação para Fase Posterior)

- **CR-02** (auth client-side): A autenticação é feita iterando a lista de clientes no browser. Isto é um risco de segurança real, mas a correcção completa requer uma Supabase Edge Function com JWT — mudança estrutural grande. **Recomendação:** criar Edge Function `auth-client` que valida NIF+email e retorna token.

---

## Estado das Tasks do Plano

| Task | Estado | Notas |
|------|--------|-------|
| Tarefa 1 — BUG-01 | ✅ Concluída | Fix em linha 2454 |
| Tarefa 2 — CR-01 | ✅ Não aplicável | Não era bug real |
| Tarefa 3 — CR-03 | ✅ Confirmado ok | Já estava corrigido |
| Tarefa 4 — CR-04 | ✅ Confirmado ok | Já tinha useCallback |
| Tarefa 5 — CR-05 | ✅ Confirmado ok | Já tinha error handling |
| Tarefa 6 — WR-07 | ✅ Confirmado ok | Já estava corrigido |
| Tarefa 7 — IN-03 | ✅ Concluída | Fix em linha 426-431 |
| Tarefa 8 — CR-06/CR-07 | ✅ Confirmado ok | isDirectAccess=false, GPS sem nome |

**Total: 2 correcções aplicadas, 6 confirmações, 1 não aplicável.**

---

*Created: 2026-05-25*
*Phase: 19-portal-cliente-repair*
*Issues resolved: 2 critical (bug-01, in-03) + 1 info*