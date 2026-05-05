# Testing — app-magnetic

**Mapeado:** 2026-05-05

## Test Framework

| Framework | Versão | Uso |
|-----------|--------|-----|
| Vitest | 4.1.5 | Unit testing |
| Playwright | 1.59.1 | E2E testing |
| @testing-library/* | 6.9.1+ | React component testing |
| MSW | 2.7.0 | API mocking |

## Test Structure

```
tests/
├── unit/              # Vitest unit tests
│   ├── app/          # Tests for app.jsx
│   └── (other)       # Other unit tests
├── e2e/              # Playwright E2E tests
└── (root config)     # vitest.config.js, playwright.config.js
```

## Test Commands

```bash
# All unit tests
npm test

# Unit tests only (headless)
npm run test:unit

# Unit tests for app only
npm run test:unit:app

# Unit tests in watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# E2E tests with UI
npm run test:e2e:ui
```

## Testing Patterns

### Component Testing with @testing-library

```javascript
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

test('renders component', () => {
  render(<Component />);
  expect(screen.getByText('expected')).toBeInTheDocument();
});
```

### Mocking with MSW

```javascript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('/api/data', () => HttpResponse.json({ data: 'mocked' }))
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Coverage

Cobertura actual desconhecida - executar `npm test -- --coverage` para verificar.

## E2E Testing (Playwright)

Configurado em `playwright.config.js`:
- Base URL configurável
- headless por padrão
- UI mode disponível com `--ui`

## Test Components

Dois componentes de teste existem mas parecem não ser utilizados:
- `src/TestPart.jsx`
- `src/TestOnly.jsx`
