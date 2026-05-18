<!-- generated-by: gsd-doc-writer -->
# Development Guide

This guide covers the local development workflow for the app-magnetic project.

## Local Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "app Magnetic"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example file and fill in your values:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your credentials. At minimum you need:
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — required for all data operations
   - `VITE_GEMINI_API_KEY` — required for AI features

   See [CONFIGURATION.md](CONFIGURATION.md) for the full variable reference.

4. **Start the development server**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173` (Vite default).

## Build Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with hot module replacement |
| `npm run build` | Compile and bundle for production (outputs to `dist/`) |
| `npm run preview` | Serve the production build locally for verification |
| `npm run lint` | Run ESLint across all `.js` and `.jsx` files |
| `npm test` | Run the full Vitest test suite |
| `npm run test:unit` | Run unit tests once (no watch) |
| `npm run test:unit:app` | Run only `tests/unit/app` suite once |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run test:e2e:ui` | Open Playwright's interactive UI runner |

## Code Style

**ESLint** is the linter for this project. Configuration is in `eslint.config.js` (flat config format).

Active rules and plugins:
- `@eslint/js` recommended rules
- `eslint-plugin-react-hooks` — enforces React hooks rules
- `eslint-plugin-react-refresh` — guards against React Refresh edge cases
- `no-unused-vars` — errors on unused variables (uppercase-only names are exempt)
- `no-console` — errors on `console.log`; `console.warn` and `console.error` are allowed

Run the linter:
```bash
npm run lint
```

No Prettier or Biome configuration is present. Code formatting is not enforced automatically — follow the style of the file you are editing.

## Branch Conventions

No branch naming convention is formally documented. The current active branch structure observed in the project uses descriptive `feat/` prefixes (e.g., `feat/documentos-mvp`). The main integration branch is `master`.

Suggested convention (adapt to team preference):
- `feat/<short-description>` — new features
- `fix/<short-description>` — bug fixes
- `chore/<short-description>` — maintenance tasks

## PR Process

No pull request template is present in `.github/`. Follow these general guidelines:

- Open PRs against `master`.
- Ensure `npm run lint` passes before submitting.
- Run `npm run test:unit` to confirm unit tests pass.
- Describe what changed and why in the PR body.
- Request review from at least one team member before merging.
