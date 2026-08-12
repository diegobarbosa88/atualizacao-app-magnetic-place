# Plan 007: Adicionar testes unitários para reconciliacaoSalarialEngine

> **Instruções ao executor**: Segue este plano passo a passo. Executa cada comando de verificação e confirma o resultado esperado antes de avançar. Se alguma condição STOP ocorrer, para e reporta — não improvises. Quando concluíres, actualiza a linha de estado deste plano em `plans/README.md`.
>
> **Drift check (executar primeiro)**: `git diff --stat 88e51cb..HEAD -- src/utils/reconciliacaoSalarialEngine.js`
> Se o ficheiro mudou significativamente, re-lê antes de escrever testes.

## Estado

- **Prioridade**: P2
- **Esforço**: M
- **Risco**: BAIXO (apenas adiciona testes, não modifica lógica)
- **Depende de**: nenhum
- **Categoria**: tests
- **Planeado em**: commit `88e51cb`, 2026-06-22

## Porquê importa

`src/utils/reconciliacaoSalarialEngine.js` é o motor de matching entre transferências bancárias e recibos salariais. Erros nesta lógica causam silenciosamente salários não pagos ou associações incorrectas. O ficheiro tem 172 linhas, sem nenhum teste unitário correspondente.

O resto do backend de salários JÁ tem cobertura (`tests/unit/backend/exportarSepa.handler.test.js`, `sepaXml.test.js`) — o engine de reconciliação é o único ausente.

As funções críticas a cobrir são:
- **`calcWorkerScore(workerName, transferDesc)`** — score de matching por nome
- **`classifyTransfer(transfer, workers, threshold)`** — classifica uma transferência como matched/unmatched
- **`runReconciliation(receipts, transfers, options)`** — reconciliação completa

## Estado actual

Ficheiro a testar: `src/utils/reconciliacaoSalarialEngine.js`

As funções exportadas (verificar com `grep -n "^export" src/utils/reconciliacaoSalarialEngine.js`):

```
# Executar para confirmar as exports actuais:
grep -n "^export\|^function\|^const.*=.*(" src/utils/reconciliacaoSalarialEngine.js | head -30
```

Padrão de ficheiro de teste a seguir: `tests/unit/backend/matchingEngine.test.js` — usa vitest, importa directamente as funções, sem mocks de Supabase.

Configuração vitest: `vitest.config.js` na raiz.

## Comandos necessários

| Propósito | Comando | Esperado em sucesso |
|-----------|---------|---------------------|
| Testes unitários | `npm run test:unit` | all pass |
| Correr apenas o novo ficheiro | `npx vitest run tests/unit/reconciliacaoSalarialEngine.test.js` | all pass |
| Lint | `npm run lint` | exit 0 |

## Âmbito

**Em âmbito** (único ficheiro a criar):
- `tests/unit/reconciliacaoSalarialEngine.test.js`

**Fora de âmbito** (NÃO tocar):
- `src/utils/reconciliacaoSalarialEngine.js` — NÃO modificar o código de produção
- Qualquer outro ficheiro de teste existente

## Workflow git

- Branch: `advisor/007-reconciliation-engine-tests`
- Mensagem de commit estilo: `test: adicionar testes unitários para reconciliacaoSalarialEngine`

## Passos

### Passo 1: Ler o ficheiro fonte antes de escrever testes

Lê `src/utils/reconciliacaoSalarialEngine.js` na íntegra para entender as assinaturas exactas das funções e a lógica. Em particular:
- Que campos esperam os objectos `receipt`, `transfer`, `worker`?
- Qual o threshold default de score?
- O que devolve `classifyTransfer` — string enum? objecto?

### Passo 2: Criar `tests/unit/reconciliacaoSalarialEngine.test.js`

Modela a estrutura em `tests/unit/backend/matchingEngine.test.js`. O ficheiro de teste deve incluir:

**Bloco 1 — `calcWorkerScore` (se exportado):**
```js
describe('calcWorkerScore', () => {
  it('devolve score alto para nome exacto', ...)
  it('devolve score alto para nome com acentos normalizados (José vs Jose)', ...)
  it('ignora palavras comuns (de, da, dos, e)', ...)
  it('devolve score 0 para nomes sem sobreposição', ...)
  it('substring match parcial', ...)
})
```

**Bloco 2 — `classifyTransfer` (ou equivalente):**
```js
describe('classifyTransfer', () => {
  it('associa transferência a trabalhador com nome claro', ...)
  it('marca como unmatched quando score abaixo do threshold', ...)
  it('não associa quando lista de trabalhadores está vazia', ...)
  it('associa ao melhor candidato quando há múltiplos matches', ...)
})
```

**Bloco 3 — `runReconciliation` (ou função principal):**
```js
describe('runReconciliation', () => {
  it('caso base: 2 recibos, 2 transferências exactas → ambos matched', ...)
  it('valor dentro da tolerância → marcado como válido', ...)
  it('valor fora da tolerância → marcado como aviso', ...)
  it('transferência sem recibo correspondente → "saldo pendente" ou equivalente', ...)
  it('recibo sem transferência → não quebra', ...)
})
```

Para fixtures, usa objectos simples inline (não ler ficheiros externos):
```js
const mockWorker = { id: 'w1', name: 'João Silva', ... };
const mockTransfer = { id: 't1', description: 'JOAO SILVA SALARIO', amount: 1200.00, date: '2026-06-05' };
const mockReceipt = { workerId: 'w1', month: '2026-06', netAmount: 1200.00 };
```

### Passo 3: Correr testes e iterar

**Verificar**: `npx vitest run tests/unit/reconciliacaoSalarialEngine.test.js` → todos os testes passam

Se algum teste falhar por causa do comportamento real (não por erro no teste), documenta o comportamento actual com `it.todo` ou ajusta o assert para reflectir a realidade — NÃO modificar o código fonte para fazer os testes passar.

### Passo 4: Correr suite completa e lint

**Verificar**: `npm run test:unit` → all pass (incluindo testes existentes)

**Verificar**: `npm run lint` → exit 0

## Plano de testes

Casos obrigatórios (mínimo a cobrir):
1. Score máximo para nome exacto
2. Score alto para variante com acentos (José vs JOSE, Conceição vs CONCEICAO)
3. Score baixo/zero para nomes sem relação
4. Match correcto de transferência com valor exacto
5. Tolerância: valor com diferença de €0.01 → válido
6. Tolerância: valor com diferença > tolerância → aviso ou inválido
7. Transferência com 0 trabalhadores → sem crash
8. Lista de transferências vazia → resultado vazio

## Critérios de conclusão

- [ ] `tests/unit/reconciliacaoSalarialEngine.test.js` existe e tem ≥ 8 casos de teste
- [ ] `npx vitest run tests/unit/reconciliacaoSalarialEngine.test.js` → todos passam
- [ ] `npm run test:unit` → all pass (nenhum teste existente quebrado)
- [ ] `npm run lint` exit 0
- [ ] Nenhum ficheiro fora do âmbito foi modificado (`git status` mostra apenas o novo teste)
- [ ] Linha de estado em `plans/README.md` actualizada para DONE

## Condições STOP

Para e reporta se:
- `src/utils/reconciliacaoSalarialEngine.js` não exporta funções testáveis individualmente (i.e., todo o código está numa IIFE ou acoplado a Supabase)
- O ficheiro de configuração `vitest.config.js` exclui a pasta `tests/unit/` (verificar antes de criar o teste)
- Os testes do bloco `runReconciliation` requerem dados de Supabase (nesse caso, criar mocks mínimos seguindo o padrão de `tests/unit/backend/exportarSepa.handler.test.js`)

## Notas de manutenção

- Quando a lógica de matching mudar (novo algoritmo de score, novo threshold), actualizar os testes para reflectir o novo comportamento esperado.
- Se os campos dos objectos `transfer` ou `receipt` mudarem, actualizar os fixtures nos testes.
- Considerar adicionar testes de regressão para casos edge descobertos em produção (e.g. nomes com hífen, nomes compostos com preposições).
