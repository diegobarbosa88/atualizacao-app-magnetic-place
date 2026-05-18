<!-- generated-by: gsd-doc-writer -->
# Testing

This document describes the test strategy, frameworks, and commands used in the app-magnetic project.

## Test Framework and Setup

The project uses two test frameworks:

- **Vitest** (`^4.1.5`) — unit and integration tests, running in a `jsdom` environment with React support via `@vitejs/plugin-react`.
- **Playwright** (`^1.59.1`) — end-to-end (E2E) browser tests running against Chromium.

Supporting libraries:

- `@testing-library/react` (`^16.3.2`) and `@testing-library/jest-dom` (`^6.9.1`) — DOM assertions and React component rendering.
- `msw` (`^2.7.0`) — Mock Service Worker for API mocking in unit/integration tests.
- `@faker-js/faker` (`^10.4.0`) — fake data generation in test helpers.

### Global Setup (Vitest)

The file `tests/setup.js` is loaded before every Vitest test run. It:

1. Imports `@testing-library/jest-dom` matchers.
2. Stubs `localStorage` and `window.matchMedia` globals required by React components.
3. Starts the MSW mock server before all tests and resets/closes it between/after tests.

No additional setup is required beyond `npm install`.

## Running Tests

### Unit Tests

Run all unit tests once (no watch):

```bash
npm run test:unit
```

Run unit tests for a specific sub-directory:

```bash
npm run test:unit:app
```

Watch mode (re-runs on file changes):

```bash
npm run test:watch
```

Run the full Vitest suite (unit + integration + performance):

```bash
npm test
```

### End-to-End Tests

E2E tests require the dev server. Playwright starts it automatically on port `4180` if it is not already running.

Run E2E tests (headless, Chromium only):

```bash
npm run test:e2e
```

Run E2E tests with the Playwright interactive UI:

```bash
npm run test:e2e:ui
```

## Writing New Tests

### File Naming Convention

| Test type   | Location                              | Pattern                       |
|-------------|---------------------------------------|-------------------------------|
| Unit        | `tests/unit/`                         | `*.test.js`, `*.test.jsx`     |
| Unit (app)  | `tests/unit/app/`                     | `*.test.js`                   |
| Integration | `tests/integration/`                  | `*.test.js`, `*.test.jsx`     |
| Performance | `tests/performance/`                  | `*.test.js`                   |
| E2E         | `tests/e2e/<feature-folder>/`         | `*.spec.js`, `*.spec.ts`      |

### Test Helpers

- `tests/setup.js` — Global Vitest setup (MSW server lifecycle, DOM stubs). Imported automatically via `vitest.config.js`.
- `tests/integration/test-helpers.cjs` — Shared helper utilities for integration tests.
- `tests/e2e/helpers/auth-helpers.js` — E2E authentication helpers (login flows).
- `tests/e2e/helpers/test-data-factory.js` — Factory functions for generating test data in E2E scenarios.
- `tests/e2e/helpers/supabase-mock.js` — Supabase mock configuration for E2E tests.
- `tests/e2e/support/mock-setup.js` and `tests/e2e/support/test-setup.js` — E2E support setup files.

### Adding a Unit Test

Create a file matching `tests/unit/**/*.test.js` (or `.jsx` for React components). The `jsdom` environment and all globals from `tests/setup.js` are available automatically.

### Adding an E2E Test

Create a `.spec.js` file under `tests/e2e/<feature-folder>/`. Use `@playwright/test` imports. The base URL is `http://localhost:4180` — reference pages with relative paths (e.g., `page.goto('/')`).

## Coverage Requirements

No minimum coverage thresholds are configured in `vitest.config.js`. Coverage reports are generated in the following formats when the coverage flag is passed:

- **text** — printed to the console
- **json** — written to disk for tooling consumption
- **html** — browsable HTML report

To generate a coverage report:

```bash
npm test -- --coverage
```

The `node_modules/` and `tests/` directories are excluded from coverage collection.

## CI Integration

The project includes a GitHub Actions workflow at `.github/workflows/copilot-setup-steps.yml`. This workflow:

- **Trigger:** `workflow_dispatch`, push or PR targeting changes to the workflow file itself.
- **Steps:** checks out the repo, sets up Node.js (LTS), runs `npm ci`, and installs Playwright browsers with `npx playwright install --with-deps`.

No automated test execution step is currently present in the CI workflow. Tests are run locally by developers using the commands above.
