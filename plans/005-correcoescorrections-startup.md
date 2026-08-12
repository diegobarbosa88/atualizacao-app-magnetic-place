# Plan 005: Corrigir correcoesCorrections vazio no startup em app.jsx e AppLayout.jsx

> **Instruções ao executor**: Segue este plano passo a passo. Executa cada comando de verificação e confirma o resultado esperado antes de avançar. Se alguma condição STOP ocorrer, para e reporta — não improvises. Quando concluíres, actualiza a linha de estado deste plano em `plans/README.md`.
>
> **Drift check (executar primeiro)**: `git diff --stat 88e51cb..HEAD -- src/app.jsx src/AppLayout.jsx src/context/AppContext.jsx`
> Se algum dos ficheiros mudou, compara os excerpts abaixo antes de avançar.

## Estado

- **Prioridade**: P1
- **Esforço**: S
- **Risco**: BAIXO
- **Depende de**: nenhum
- **Categoria**: bug
- **Planeado em**: commit `88e51cb`, 2026-06-22

## Porquê importa

O AppContext tem dois states de correcções:
- `corrections` (v2, "single source of truth") — carregado da BD no startup via `fetchTable('corrections', setCorrections)`
- `correcoesCorrections` (v1, legacy) — inicializado como `[]` e **nunca pré-carregado** da BD

`app.jsx` e `AppLayout.jsx` desestruturaram `correcoesCorrections` directamente do contexto — o que significa que no startup mostram sempre 0 correcções pendentes. O badge de notificações e a lógica de rejeição de notificações ficam quebrados até que seja criada uma nova correcção durante a sessão.

`ValidationPortal.jsx` já corrigiu este problema silenciosamente usando o alias `corrections: correcoesCorrections` (desestruturação que pega o state v2 e dá-lhe o nome local `correcoesCorrections`). O mesmo padrão deve ser aplicado a `app.jsx` e `AppLayout.jsx`.

## Estado actual

**AppContext.jsx:88-89** — dois states coexistem:
```js
const [correcoesCorrections, setCorrecoesCorrections] = useState([]);
// v2 corrections (single source of truth) — see supabase/migrations/20260515_corrections_v2.sql
const [corrections, setCorrections] = useState([]);
```

**AppContext.jsx:192** — apenas v2 é pré-carregado:
```js
fetchTable('corrections', setCorrections),  // ← v2 populado
// NÃO existe: fetchTable('correcoes', setCorrecoesCorrections)
```

**Contexto exporta ambos (AppContext.jsx:671-672)**:
```js
correcoesCorrections, setCorrecoesCorrections,
corrections, setCorrections,
```

**app.jsx:50** — desestrutura v1 (vazio):
```js
correcoesCorrections,
```

**AppLayout.jsx:38** — idem:
```js
correcoesCorrections,
```

**ValidationPortal.jsx:52** — padrão correcto (usa v2 com alias):
```js
corrections: correcoesCorrections,
```

## Comandos necessários

| Propósito | Comando | Esperado em sucesso |
|-----------|---------|---------------------|
| Lint | `npm run lint` | exit 0 |
| Testes unitários | `npm run test:unit` | all pass |

## Âmbito

**Em âmbito** (únicos ficheiros a modificar):
- `src/app.jsx`
- `src/AppLayout.jsx`

**Fora de âmbito** (NÃO tocar):
- `src/context/AppContext.jsx` — a solução não requer alterar o contexto
- `src/features/admin/ValidationPortal.jsx` — já correcto
- `src/components/CorrecoesAdminPortal.jsx` — recebe `correcoesCorrections` como prop; quem o renderiza (app.jsx) é que passa o valor correcto após esta fix

## Workflow git

- Branch: `advisor/005-correcoescorrections-startup`
- Mensagem de commit estilo: `fix: usar corrections (v2) em vez de correcoesCorrections (v1 vazio) em app.jsx e AppLayout.jsx`

## Passos

### Passo 1: Corrigir `src/app.jsx`

Localiza a desestruturação de `correcoesCorrections` no bloco `useApp()` (linha 50). O bloco provavelmente tem o formato:

```js
const {
  // ...outros campos...
  correcoesCorrections,
  // ...
} = useApp();
```

Substitui `correcoesCorrections,` por `corrections: correcoesCorrections,`.

Isto diz "pega o campo `corrections` do contexto (v2, populado) e dá-lhe o nome local `correcoesCorrections`". Todo o código restante em app.jsx que usa `correcoesCorrections` continua a funcionar sem outras alterações.

**Verificar**: `grep -n "corrections: correcoesCorrections\|correcoesCorrections," src/app.jsx` → mostra apenas `corrections: correcoesCorrections` (não a forma antiga)

### Passo 2: Corrigir `src/AppLayout.jsx`

Localiza a desestruturação de `correcoesCorrections` no bloco `useApp()` (linha 38). Aplica o mesmo padrão:

Substitui `correcoesCorrections,` por `corrections: correcoesCorrections,`.

**Verificar**: `grep -n "corrections: correcoesCorrections\|correcoesCorrections," src/AppLayout.jsx` → mostra apenas `corrections: correcoesCorrections`

### Passo 3: Verificar lint e testes

**Verificar**: `npm run lint` → exit 0

**Verificar**: `npm run test:unit` → all pass

## Critérios de conclusão

- [ ] `grep -n "^\s*correcoesCorrections,$" src/app.jsx src/AppLayout.jsx` → sem output (padrão antigo removido)
- [ ] `grep -n "corrections: correcoesCorrections" src/app.jsx src/AppLayout.jsx` → 1 resultado por ficheiro
- [ ] `npm run lint` exit 0
- [ ] `npm run test:unit` all pass
- [ ] Nenhum ficheiro fora do âmbito foi modificado (`git status`)
- [ ] Linha de estado em `plans/README.md` actualizada para DONE

## Condições STOP

Para e reporta se:
- A linha de desestruturação em `app.jsx:50` não for `correcoesCorrections,` isolada (pode estar numa desestruturação inline diferente — ajusta conforme o código actual)
- `grep -n "correcoesCorrections" src/app.jsx` mostrar mais de 5 linhas (pode haver usos que precisem de revisão adicional)
- Os testes falharem com erro relacionado com `corrections` ou `correcoesCorrections`

## Notas de manutenção

- O state `correcoesCorrections` (v1) ainda existe no AppContext e recebe updates via `prependState` quando se chama `saveToDb('corrections', ...)`. Pode ser removido numa refactorização futura do AppContext, mas está fora do âmbito deste plano.
- Se `CorrecoesAdminPortal` continuar a mostrar dados incorrectos após esta fix, investigar como `app.jsx` passa `correcoesCorrections` como prop a esse componente.
