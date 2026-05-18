# Conventions — app-magnetic

**Mapeado:** 2026-05-05

## Code Style

- **ESLint** com `eslint-plugin-react-refresh` e `eslint-plugin-react-hooks`
- **Babel** para transpilação
- **Prettier** não mencionado (pode não estar em uso)

## Naming Conventions

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Componentes React | PascalCase | `ClientPortal.jsx` |
| Ficheiros utils | camelCase | `utils.js` |
| Hooks | `use` + camelCase | `useCustomHook` |
| CSS classes | Tailwind (snake-case) | `bg-white/60` |

## Component Patterns

### Estado Local
```javascript
const [state, setState] = useState(initialValue);
```

### Estado Derivado
```javascript
const derivedValue = useMemo(() => {
  return items.filter(item => item.active);
}, [items]);
```

### Efeitos
```javascript
useEffect(() => {
  // effect logic
  return () => { /* cleanup */ };
}, [dependencies]);
```

## Error Handling Patterns

### Fetch com error handling
```javascript
try {
  const response = await fetch(url);
  if (response.ok) {
    const data = await response.json();
    // process data
  }
} catch (error) {
  console.error(error);
  // handle error
}
```

### Async handlers
```javascript
const handleAsync = async () => {
  setLoading(true);
  try {
    const result = await asyncOperation();
    setData(result);
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
};
```

## State Management

- **React hooks** para state management
- **useMemo** para computações caras
- **useEffect** para side effects
- **localStorage** para persistência simples

## API Patterns

### Supabase
```javascript
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('column', value);
```

## React Best Practices

- Componentes funcionais (hooks-based)
- PropTypes para type checking
- Fragmentos para múltiplos elementos raiz
