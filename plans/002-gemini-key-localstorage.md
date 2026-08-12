# Plan 002: Parar de persistir chave Gemini API no localStorage

> **Instruções ao executor**: Segue este plano passo a passo. Executa cada comando de verificação e confirma o resultado esperado antes de avançar. Se alguma condição STOP ocorrer, para e reporta — não improvises. Quando concluíres, actualiza a linha de estado deste plano em `plans/README.md`.
>
> **Drift check (executar primeiro)**: `git diff --stat 88e51cb..HEAD -- src/context/AppContext.jsx`
> Se o ficheiro mudou, compara os excerpts abaixo com o código actual antes de avançar.

## Estado

- **Prioridade**: P1
- **Esforço**: S
- **Risco**: BAIXO
- **Depende de**: nenhum
- **Categoria**: security
- **Planeado em**: commit `88e51cb`, 2026-06-22

## Porquê importa

A chave API do Google Gemini é lida da base de dados Supabase e guardada em `systemSettings.geminiApiKey`. O estado `systemSettings` é persistido no `localStorage` do browser a cada alteração (linha 43 do AppContext). Qualquer extensão de browser, script XSS, ou acesso físico ao dispositivo pode ler `localStorage.getItem('magnetic_settings')` e obter a chave.

A chave Gemini serve apenas para chamadas à API do Google — é um segredo que não deve sair do contexto da aplicação em memória para armazenamento persistente no cliente.

A correcção é simples: excluir `geminiApiKey` da serialização para `localStorage`. A chave continua em memória durante a sessão (carregada da Supabase), mas não é gravada em disco.

## Estado actual

Ficheiros relevantes:
- `src/context/AppContext.jsx` — contexto global; três pontos de interesse

**Ponto 1 — inicialização (linha 30-39):** `systemSettings` é hidratado do localStorage:
```js
// src/context/AppContext.jsx:30-39
const saved = localStorage.getItem('magnetic_settings');
if (saved) {
  try {
    const parsed = JSON.parse(saved);
    return { ...defaults, ...parsed };  // ← geminiApiKey incluído aqui
  } catch (e) {
    return defaults;
  }
}
```

**Ponto 2 — persistência (linha 42-51):** `systemSettings` é serializado integralmente:
```js
// src/context/AppContext.jsx:42-51
useEffect(() => {
  localStorage.setItem('magnetic_settings', JSON.stringify(systemSettings));  // ← chave incluída
  // ...
}, [systemSettings]);
```

**Ponto 3 — carregamento da BD (linha 226):** chave carregada do Supabase para o state:
```js
// src/context/AppContext.jsx:226
...(data.gemini_api_key !== undefined && { geminiApiKey: data.gemini_api_key }),
```

## Comandos necessários

| Propósito | Comando | Esperado em sucesso |
|-----------|---------|---------------------|
| Lint | `npm run lint` | exit 0 |
| Testes unitários | `npm run test:unit` | all pass |

## Âmbito

**Em âmbito**:
- `src/context/AppContext.jsx`

**Fora de âmbito** (NÃO tocar):
- `src/utils/aiUtils.js` — usa a chave correctamente em memória, não persistida
- Qualquer componente que leia `geminiApiKey` do contexto — continuam a funcionar porque a chave permanece em state

## Workflow git

- Branch: `advisor/002-gemini-key-localstorage`
- Mensagem de commit estilo: `fix: excluir geminiApiKey da persistência em localStorage`

## Passos

### Passo 1: Excluir geminiApiKey da serialização para localStorage

No `useEffect` de persistência (linha 42 do AppContext), substitui:
```js
localStorage.setItem('magnetic_settings', JSON.stringify(systemSettings));
```

Por:
```js
const { geminiApiKey: _omit, ...settingsToSave } = systemSettings;
localStorage.setItem('magnetic_settings', JSON.stringify(settingsToSave));
```

Isto desestrutura `geminiApiKey` para `_omit` (descartado) e guarda tudo o resto.

**Verificar**: `grep -n "localStorage.setItem.*magnetic_settings" src/context/AppContext.jsx` → mostra a linha actualizada com `settingsToSave`

### Passo 2: Garantir que a hidratação não lê chave antiga do localStorage

No mesmo ficheiro, na função de inicialização do state (linhas 30-39), após o `JSON.parse`, a chave antiga pode ainda estar no localStorage de utilizadores existentes. Adiciona uma limpeza explícita. Localiza:

```js
const parsed = JSON.parse(saved);
return { ...defaults, ...parsed };
```

Substitui por:
```js
const { geminiApiKey: _old, ...parsed } = JSON.parse(saved);
return { ...defaults, ...parsed };
```

**Verificar**: `npm run lint` → exit 0

### Passo 3: Verificar testes

**Verificar**: `npm run test:unit` → all pass

## Critérios de conclusão

- [ ] `grep -n "geminiApiKey" src/context/AppContext.jsx` mostra apenas as linhas de definição do default, carregamento da BD (linha 226), e a nova exclusão — NÃO mostra inclusão no `JSON.stringify`
- [ ] `npm run lint` exit 0
- [ ] `npm run test:unit` all pass
- [ ] Nenhum ficheiro fora do âmbito foi modificado (`git status`)
- [ ] Linha de estado em `plans/README.md` actualizada para DONE

## Condições STOP

Para e reporta se:
- O `useEffect` de persistência (linha 42) não corresponde ao excerpt acima
- Existir outro `localStorage.setItem` com `magnetic_settings` no ficheiro (verificar com grep)
- Os testes unitários falharem por razão relacionada com `systemSettings`

## Notas de manutenção

- A chave Gemini continua acessível em `systemSettings.geminiApiKey` durante a sessão — componentes que a usam não precisam de ser alterados.
- Se no futuro for necessário persistir a chave (e.g. para modo offline), a abordagem correcta é usar a Web Crypto API para encriptar antes de guardar.
- A chave continua guardada na coluna `gemini_api_key` da tabela `system_settings` na Supabase — isso é adequado pois o Supabase tem controlo de acesso por row-level security.
