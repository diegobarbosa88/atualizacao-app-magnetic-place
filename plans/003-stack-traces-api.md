# Plan 003: Remover stack traces das respostas de erro da API

> **Instruções ao executor**: Segue este plano passo a passo. Executa cada comando de verificação e confirma o resultado esperado antes de avançar. Se alguma condição STOP ocorrer, para e reporta — não improvises. Quando concluíres, actualiza a linha de estado deste plano em `plans/README.md`.
>
> **Drift check (executar primeiro)**: `git diff --stat 88e51cb..HEAD -- api/gmail/import-faturas.js`
> Se o ficheiro mudou, compara o excerpt abaixo antes de avançar.

## Estado

- **Prioridade**: P1
- **Esforço**: S
- **Risco**: BAIXO
- **Depende de**: nenhum
- **Categoria**: security
- **Planeado em**: commit `88e51cb`, 2026-06-22

## Porquê importa

O handler `api/gmail/import-faturas.js` devolve `stack: e.stack` no corpo da resposta de erro HTTP 500. As stack traces revelam:
- Caminhos absolutos de ficheiros no servidor Vercel (e.g. `/var/task/api/gmail/import-faturas.js:68`)
- Versões exactas de pacotes npm em uso
- Estrutura interna do código

Esta informação facilita a identificação de vulnerabilidades conhecidas e o planeamento de ataques dirigidos. Nenhum cliente legítimo precisa da stack trace — apenas a mensagem de erro em linguagem natural.

## Estado actual

Ficheiro único a corrigir:
- `api/gmail/import-faturas.js` — linhas 67-69

```js
// api/gmail/import-faturas.js:65-69 (estado actual)
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
```

Verificação de que este é o único ficheiro com este padrão:
```
grep -rn "stack: e.stack\|stack: err.stack" api/
```
Output actual: apenas `api/gmail/import-faturas.js:68`

## Comandos necessários

| Propósito | Comando | Esperado em sucesso |
|-----------|---------|---------------------|
| Confirmar padrão removido | `grep -rn "stack: e.stack" api/` | sem output |
| Lint | `npm run lint` | exit 0 |

## Âmbito

**Em âmbito**:
- `api/gmail/import-faturas.js`

**Fora de âmbito** (NÃO tocar):
- Qualquer outro ficheiro em `api/` ou `src/`

## Workflow git

- Branch: `advisor/003-stack-traces-api`
- Mensagem de commit estilo: `fix: remover stack trace das respostas de erro da API Gmail`

## Passos

### Passo 1: Remover `stack` da resposta de erro

No ficheiro `api/gmail/import-faturas.js`, localiza o bloco catch no final do handler (linha 67-69):

```js
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
```

Substitui por:

```js
  } catch (e) {
    console.error('[import-faturas] unhandled error:', e);
    return res.status(500).json({ error: e.message });
  }
```

O `console.error` garante que a stack trace continua visível nos logs do Vercel para debugging, mas não é exposta ao cliente.

**Verificar**: `grep -n "stack: e.stack" api/gmail/import-faturas.js` → sem output

### Passo 2: Verificar padrão globalmente e lint

**Verificar**: `grep -rn "stack: e.stack\|stack: err.stack\|stack: error.stack" api/` → sem output

**Verificar**: `npm run lint` → exit 0

## Critérios de conclusão

- [ ] `grep -rn "stack:" api/` não mostra nenhuma linha com `e.stack` ou `err.stack`
- [ ] `npm run lint` exit 0
- [ ] Nenhum ficheiro fora do âmbito foi modificado (`git status`)
- [ ] Linha de estado em `plans/README.md` actualizada para DONE

## Condições STOP

Para e reporta se:
- O bloco catch em `api/gmail/import-faturas.js` não corresponder ao excerpt acima
- `grep` encontrar outros ficheiros com `stack: e.stack` fora de `api/gmail/` (reporta os ficheiros para extensão do âmbito)

## Notas de manutenção

- O padrão `{ error: e.message }` é o standard deste projecto para respostas de erro — ver outros handlers em `api/pagamentos/index.js` que já o seguem.
- Os logs do Vercel (Functions → Logs) mostram o `console.error` com stack completa para debugging.
