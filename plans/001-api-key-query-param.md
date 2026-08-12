# Plan 001: Remover chave API Gemini do query param na URL

> **Instruções ao executor**: Segue este plano passo a passo. Executa cada comando de verificação e confirma o resultado esperado antes de avançar. Se alguma condição STOP ocorrer, para e reporta — não improvises. Quando concluíres, actualiza a linha de estado deste plano em `plans/README.md`.
>
> **Drift check (executar primeiro)**: `git diff --stat 88e51cb..HEAD -- api/parse-fatura.js`
> Se o ficheiro mudou desde que este plano foi escrito, compara o excerpt em "Estado actual" com o código antes de avançar.

## Estado

- **Prioridade**: P1
- **Esforço**: S
- **Risco**: BAIXO
- **Depende de**: nenhum
- **Categoria**: security
- **Planeado em**: commit `88e51cb`, 2026-06-22

## Porquê importa

O endpoint de diagnóstico `GET /api/parse-fatura` envia a chave `GEMINI_API_KEY` como query parameter na URL: `?key=${apiKey}`. Qualquer proxy, CDN, servidor de logs ou histórico do browser regista o URL completo, incluindo a chave. Resultado: a chave fica exposta em todos os registos de acesso. Esta é a forma mais comum de rotação de credenciais não planeada (a key aparece em logs que não controlamos).

Note que `src/utils/aiUtils.js` já corrigiu este padrão para chamadas no lado do cliente usando `Authorization: Bearer` header. Este plano aplica o mesmo padrão ao endpoint de servidor.

## Estado actual

Ficheiro relevante:
- `api/parse-fatura.js` — único endpoint serverless de parse de faturas; o bug está nas linhas 6-9

```js
// api/parse-fatura.js:1-10 (estado actual)
export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

  // GET /api/parse-fatura → lista modelos disponíveis (diagnóstico)
  if (req.method === 'GET') {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    const d = await r.json();
    return res.status(r.status).json(d);
  }
```

Padrão correcto já em uso (em `src/utils/aiUtils.js:20-27`):
```js
const response = await fetch(url, { 
  method: 'POST', 
  headers: { 
    'Content-Type': 'application/json', 
    'Authorization': `Bearer ${apiKey}`
  }, 
  body: JSON.stringify(payload) 
});
```

## Comandos necessários

| Propósito | Comando | Esperado em sucesso |
|-----------|---------|---------------------|
| Lint | `npm run lint` | exit 0 |
| Verificar ausência do padrão | `grep -n "key=\${apiKey}" api/parse-fatura.js` | sem output |

## Âmbito

**Em âmbito** (únicos ficheiros a modificar):
- `api/parse-fatura.js`

**Fora de âmbito** (NÃO tocar):
- `src/utils/aiUtils.js` — já corrigido, não alterar
- Qualquer outro ficheiro da API

## Workflow git

- Branch: `advisor/001-api-key-query-param`
- Mensagem de commit estilo: `fix: não enviar GEMINI_API_KEY como query param em GET /api/parse-fatura`

## Passos

### Passo 1: Substituir query param por Authorization header no bloco GET

No ficheiro `api/parse-fatura.js`, localiza o bloco `if (req.method === 'GET')` (linhas 6-9).

Substitui:
```js
if (req.method === 'GET') {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    const d = await r.json();
    return res.status(r.status).json(d);
  }
```

Por:
```js
if (req.method === 'GET') {
    const r = await fetch('https://generativelanguage.googleapis.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const d = await r.json();
    return res.status(r.status).json(d);
  }
```

**Verificar**: `grep -n "key=\${apiKey}" api/parse-fatura.js` → sem output (0 resultados)

### Passo 2: Verificar lint

**Verificar**: `npm run lint -- api/parse-fatura.js` → exit 0

## Critérios de conclusão

- [ ] `grep -n "key=\${apiKey}" api/parse-fatura.js` devolve 0 resultados
- [ ] `npm run lint` exit 0
- [ ] Nenhum ficheiro fora do âmbito foi modificado (`git status`)
- [ ] Linha de estado em `plans/README.md` actualizada para DONE

## Condições STOP

Para e reporta se:
- O código em `api/parse-fatura.js:7` não corresponde ao excerpt acima (codebase mudou)
- A API do Google rejeitar requests com Authorization header (testar manualmente se possível)

## Notas de manutenção

- O endpoint GET é apenas diagnóstico; se for removido no futuro, não há impacto.
- Se a Google Gemini API mudar o esquema de autenticação, actualizar também `src/utils/aiUtils.js`.
