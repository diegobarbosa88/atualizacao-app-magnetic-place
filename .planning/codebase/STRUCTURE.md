# Structure — app-magnetic

**Mapeado:** 2026-05-05

## Directory Layout

```
app-magnetic/
├── .planning/              # GSD planning artifacts
│   └── codebase/          # Codebase maps
├── api/                    # Backend API files
├── backup_2026-05-05/     # Backup directory
├── dist/                   # Build output
├── public/                 # Static public assets
├── src/                    # Source code (main app)
│   ├── app.jsx             # Main component
│   ├── ClientPortal.jsx    # Client portal component
│   ├── assets/             # Static assets
│   ├── hooks/              # Custom React hooks
│   └── mocks/              # Mock data
├── tests/                  # Test files
│   ├── e2e/               # E2E tests (Playwright)
│   └── unit/              # Unit tests (Vitest)
├── node_modules/           # Dependencies
├── index.html              # Entry HTML
├── package.json            # Dependencies
├── vite.config.js         # Vite configuration
├── eslint.config.js        # ESLint configuration
└── playwright.config.js    # Playwright configuration
```

## Key Files

| Ficheiro | Descrição |
|----------|-----------|
| `src/app.jsx` | Main application component (~6365 lines) |
| `src/ClientPortal.jsx` | Client portal component (~1616 lines) |
| `vite.config.js` | Vite build configuration |
| `playwright.config.js` | Playwright test configuration |

## Naming Conventions

- **Components**: PascalCase (`.jsx`)
- **Hooks**: camelCase com prefixo `use` (`useCustomHook`)
- **Tests**: Correspondente ao ficheiro testado + sufixo `.test.js`

## Key Locations

- **Configuração**: `vite.config.js`, `eslint.config.js`
- **API**: `api/` - Backend endpoints
- **Assets**: `src/assets/`, `public/`
- **Testes**: `tests/unit/`, `tests/e2e/`
