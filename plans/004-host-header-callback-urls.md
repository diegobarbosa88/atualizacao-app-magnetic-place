# Plan 004: Fixar injecção via host header em URLs de callback

> **Instruções ao executor**: Segue este plano passo a passo. Executa cada comando de verificação e confirma o resultado esperado antes de avançar. Se alguma condição STOP ocorrer, para e reporta — não improvises. Quando concluíres, actualiza a linha de estado deste plano em `plans/README.md`.
>
> **Drift check (executar primeiro)**: `git diff --stat 88e51cb..HEAD -- api/pagamentos/processar-lote.js api/toconline/callback.js`
> Se algum dos ficheiros mudou, compara os excerpts abaixo antes de avançar.

## Estado

- **Prioridade**: P2
- **Esforço**: S
- **Risco**: BAIXO
- **Depende de**: nenhum
- **Categoria**: security
- **Planeado em**: commit `88e51cb`, 2026-06-22

## Porquê importa

Dois endpoints constroem URLs a partir de headers HTTP (`host`, `x-forwarded-host`, `x-forwarded-proto`) sem validar se o host é o esperado:

1. `api/pagamentos/processar-lote.js:35-37` — constrói `returnTo` enviado à API Salt Edge como URL de callback de pagamento. Um atacante que controle o header `host` (e.g. por DNS rebinding ou proxy) pode fazer Salt Edge redirigir utilizadores para um domínio arbitrário.

2. `api/toconline/callback.js:6-9` — constrói `APP_URL` usado em redirects OAuth. Idem.

A correcção é usar uma variável de ambiente `APP_URL` com o domínio canónico. O Vercel define `VERCEL_URL` automaticamente, mas contém o domínio do deployment (e.g. `app-magnetic-abc.vercel.app`) e não o domínio de produção. A abordagem correcta é definir explicitamente `APP_URL` nas variáveis de ambiente do Vercel com o valor `https://trabalhador.magneticplace.pt`.

## Estado actual

**Ficheiro 1** — `api/pagamentos/processar-lote.js:34-38`:
```js
const totalLote = faturas_para_pagar.reduce((sum, f) => sum + Number(f.valor), 0);
const host = req.headers.host || 'localhost:3000';
const protocol = req.headers['x-forwarded-proto'] || 'http';
const returnTo = `${protocol}://${host}/admin/pagamentos?saltedge=callback`;
```

**Ficheiro 2** — `api/toconline/callback.js:6-9`:
```js
function getAppUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}
```

Nota: `api/toconline/callback.js:4` já define uma constante do ambiente:
```js
const REDIRECT_URI = process.env.TOCONLINE_REDIRECT_URI || 'https://trabalhador.magneticplace.pt/api/toconline/callback';
```
O mesmo padrão deve ser aplicado ao `APP_URL`.

## Comandos necessários

| Propósito | Comando | Esperado em sucesso |
|-----------|---------|---------------------|
| Confirmar remoção do padrão | `grep -n "req.headers.host\|x-forwarded-host" api/pagamentos/processar-lote.js api/toconline/callback.js` | sem output |
| Lint | `npm run lint` | exit 0 |

## Âmbito

**Em âmbito**:
- `api/pagamentos/processar-lote.js`
- `api/toconline/callback.js`

**Fora de âmbito** (NÃO tocar):
- `api/toconline/proxy.js` — não usa host headers para construir URLs de redirect
- Qualquer outro ficheiro

## Configuração necessária no Vercel

Antes de fazer deploy, adicionar a variável de ambiente `APP_URL` no painel Vercel com o valor `https://trabalhador.magneticplace.pt`. Para desenvolvimento local, adicionar ao `.env.local`:
```
APP_URL=http://localhost:3000
```

## Workflow git

- Branch: `advisor/004-host-header-callback-urls`
- Mensagem de commit estilo: `fix: usar APP_URL env var em vez de req.headers.host em callbacks`

## Passos

### Passo 1: Corrigir `api/pagamentos/processar-lote.js`

Localiza as linhas 35-37 (host/protocol/returnTo). Substitui:

```js
const host = req.headers.host || 'localhost:3000';
const protocol = req.headers['x-forwarded-proto'] || 'http';
const returnTo = `${protocol}://${host}/admin/pagamentos?saltedge=callback`;
```

Por:

```js
const appUrl = process.env.APP_URL || 'http://localhost:3000';
const returnTo = `${appUrl}/admin/pagamentos?saltedge=callback`;
```

**Verificar**: `grep -n "req.headers.host\|x-forwarded-proto" api/pagamentos/processar-lote.js` → sem output

### Passo 2: Corrigir `api/toconline/callback.js`

Localiza a função `getAppUrl` (linhas 6-9). Substitui a função inteira:

```js
function getAppUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}
```

Por uma constante no topo do ficheiro (após as imports, antes do handler):

```js
const APP_URL = process.env.APP_URL || 'https://trabalhador.magneticplace.pt';
```

E substitui as referências a `getAppUrl(req)` por `APP_URL`. Há 3 usos: linhas 14 (`const APP_URL = getAppUrl(req)`), 17, 34, 48. Após a substituição, a linha 14 (`const APP_URL = getAppUrl(req)`) deve ser removida (a constante agora é módulo-level).

**Verificar**: `grep -n "getAppUrl\|req.headers.host\|x-forwarded-host" api/toconline/callback.js` → sem output

### Passo 3: Lint final

**Verificar**: `npm run lint` → exit 0

## Critérios de conclusão

- [ ] `grep -rn "req.headers.host\|x-forwarded-host" api/pagamentos/processar-lote.js api/toconline/callback.js` → sem output
- [ ] `npm run lint` exit 0
- [ ] Nenhum ficheiro fora do âmbito foi modificado (`git status`)
- [ ] Variável `APP_URL` documentada no novo `.env.example` (ver plano 006)
- [ ] Linha de estado em `plans/README.md` actualizada para DONE

## Condições STOP

Para e reporta se:
- O código nos ficheiros não corresponder aos excerpts acima (codebase mudou)
- Existirem mais referências a `getAppUrl` fora das linhas documentadas
- `callback.js` tiver mais de 3 usos de `APP_URL` (contar antes de remover a função)

## Notas de manutenção

- Ao fazer deploy para um novo ambiente (staging, etc.), definir `APP_URL` correspondente nas env vars do Vercel.
- Se o domínio de produção mudar, actualizar `APP_URL` no Vercel — o fallback hardcoded em `callback.js` serve apenas como last-resort.
