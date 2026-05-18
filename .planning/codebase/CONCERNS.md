# Concerns — app-magnetic

**Mapeado:** 2026-05-05

## Security Issues

### CRÍTICO: Secrets Hardcoded ⚠️

**Ficheiros afetados:**
- `src/app.jsx:22-23` — Supabase URL/Key
- `src/app.jsx:62-65` — EmailJS credentials
- `src/app.jsx:1224-1225` — pdf.co API key
- `src/restore_schedules.js:3-4`
- `src/check_db.js:3-4`

**Problema:** Chaves de API expostas no código cliente (JavaScript bundle)

**Recomendação:** Mover todas as secrets para variáveis de ambiente `VITE_*`

### API Key em Query String

**Ficheiro:** `src/app.jsx:32`

**Problema:** API key exposta na URL como query parameter

**Recomendação:** Usar `Authorization: Bearer` header

### Armazenamento de IP

**Ficheiro:** `src/ClientPortal.jsx:33, 89-92`

**Problema:** IP do cliente armazenado em localStorage sem consentimento

## Error Handling Issues

### Error Messages Genéricas

**Ficheiro:** `src/app.jsx:43-44`

**Problema:** Mensagens de erro ocultam a causa raiz

**Recomendação:**
```javascript
if (error.message.includes('401')) return "Chave API inválida.";
if (error.message.includes('429')) return "Limite de uso atingido.";
```

### Unhandled Promise Rejections

**Ficheiro:** `src/app.jsx:261-267`

**Problema:** `handleAiPolish` sem try/catch — `setIsImproving(false)` pode nunca executar

**Recomendação:** Adicionar try/catch/finally

## React Patterns

### Race Conditions

**Ficheiro:** `src/ClientPortal.jsx:61-85`

**Problema:** `supabase` não está no dependency array do useEffect

**Recomendação:** Adicionar `supabase` às dependências

### NaN em reduce

**Ficheiros:** `src/app.jsx:2797-2798, 2916-2917, 2963-2964`

**Problema:** `parseFloat` de strings inválidas retorna `NaN`

**Recomendação:**
```javascript
const total = (arr || []).reduce((acc, w) => {
  const val = parseFloat(w.totalHours);
  return acc + (isNaN(val) ? 0 : val);
}, 0);
```

## Tech Debt

### Componentes Não Utilizados

- `src/TestPart.jsx`
- `src/TestOnly.jsx`

Estes componentes existem mas não são importados em nenhum lugar.

### Código Comentado

Múltiplos blocos de código comentado encontrados ao longo do código.

### Console Logs em Produção

Múltiplos `console.error` em código de produção.

## Performance

### Cálculos Não Memoized

**Ficheiro:** `src/ClientPortal.jsx:1360-1390`

**Problema:** `isModified` recalculado em cada render

**Recomendação:** Usar `useMemo`

## XSS Risks

### dangerouslySetInnerHTML

**Ficheiros:**
- `src/app.jsx:676-677` (print CSS)
- `src/app.jsx:1589-1614`
- `src/ClientPortal.jsx:467-479`

**Problema:** HTML injetado via dangerouslySetInnerHTML

**Recomendação:** Usar ficheiros CSS externos ou CSS modules
