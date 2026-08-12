# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Magnetic Place is a React SPA for workforce/timesheet management at a staffing company. A single app serves three roles from one codebase: **admin** (manages workers, clients, schedules, expenses, documents, invoicing, payroll, bank reconciliation), **worker** (logs time, submits corrections/absences, accesses documents), and **client** (a separate read-only portal to review and approve monthly timesheet reports). All persistent state lives in Supabase (Postgres) and stays live via Supabase Realtime. Document generation (DOCX/PDF, digital signatures, SEPA XML exports) happens client-side. A set of Vercel serverless functions under `api/` handles server-side integrations (Gmail invoice import, TOConline invoicing, bank reconciliation parsing, Social Security SOAP calls, SEPA salary exports).

## Commands

```bash
npm run dev              # Vite dev server (port 4179, falls back if busy)
npm run dev:api          # vercel dev — needed when working on api/ serverless functions
npm run build             # production build → dist/
npm run lint              # ESLint (flat config, eslint.config.js)

npm run test:unit         # unit + integration + performance tests, run once (Vitest)
npm run test:unit:app     # only tests/unit/app
npm run test:watch        # unit tests, watch mode
npm test                  # vitest in default (watch) mode — prefer test:unit in CI/scripts

npx vitest run tests/unit/matchingEngine.test.js         # run a single test file
npx vitest run tests/unit/matchingEngine.test.js -t "name"  # single test by name

npm run test:e2e          # Playwright, headless Chromium (auto-starts dev server on port 4180)
npm run test:e2e:ui       # Playwright interactive UI
npx playwright test tests/e2e/worker/some.spec.ts        # single e2e spec
```

CI (`.github/workflows/ci.yml`) runs on push/PR to `main`/`master`: `npm ci` → pull env vars from Vercel → `npm run lint` → `npm run test:unit` (with `VITE_MOCK_API=true`) → `npm run build`. There is no automated E2E run in CI.

## Environment

No `.env.example` is checked in. Required variables (all client-bundled `VITE_*` vars are read via `import.meta.env`):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — required for all data operations; app fails to load data without them.
- `VITE_GEMINI_API_KEY` (optional `VITE_GEMINI_MODEL`, default `gemini-2.5-flash`) — AI text polishing and PDF bank-statement parsing.
- `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID_NOTIF`, `VITE_EMAILJS_TEMPLATE_ID_PORTAL`, `VITE_EMAILJS_PUBLIC_KEY` — outbound notification/portal-invite emails.
- `VITE_CLOUDCONVERT_API_KEY` (+ optional `VITE_CLOUDCONVERT_BASE_URL`) — DOCX→PDF conversion; throws at call time if missing.
- `VITE_PDFCO_API_KEY` — optional; PDF.co-dependent operations are disabled without it.
- `VITE_VAPID_PUBLIC_KEY` / server-side `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — Web Push.
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only (`api/`), never expose client-side.
- `VITE_MOCK_API=true` — routes Supabase calls through MSW mocks (`src/mocks/`) instead of a live backend; used in CI unit tests and available for local dev in `.env.test`.

Dev server defaults to port 4179 (`vite.config.js`); Playwright's dedicated dev server instance runs on port 4180 (`playwright.config.js`, baseURL `http://localhost:4180`).

## Architecture

**Role-based single root, no router library.** `src/main.jsx` mounts `AppProvider` (`src/context/AppContext.jsx`) around `src/app.jsx`. `app.jsx` reads a `view` string (`login | admin | worker | client_portal`) plus URL query params (`?view=verify&id=…` for signature verification, `?view=client_portal&client=…&month=…` or the `painelcliente` hostname for the client portal) and conditionally renders the matching top-level component. There is no React Router — routing is manual conditional rendering based on state + `URLSearchParams`.

**`AppContext` is the single data-access layer.** It initializes the Supabase client, fetches all core tables in parallel on boot (`clients`, `workers`, `logs`, `expenses`, `approvals`, `documents`, `corrections`, `correction_items`, `app_notifications`, etc.), and opens Realtime channels so `INSERT`/`UPDATE`/`DELETE` events patch React state directly (no polling). All writes go through `saveToDb(table, id, data)` (upsert) exposed by the context — components should not call Supabase directly. `localStorage` persists `systemSettings`, `currentUser`, `view`, and a few UI prefs (`magnetic_*` keys).

**Directory split enforces role boundaries:**
```
src/
├── app.jsx                  # Root: view routing, global modals
├── ClientPortal.jsx          # Self-contained client-facing portal
├── context/AppContext.jsx    # All Supabase I/O + Realtime, single global context
├── features/
│   ├── admin/                # Admin-only views (dashboard, faturas, pagamentos, reconciliacao,
│   │                          #   mapa-salarios, fornecedores, toconline, movimentacoes, corrections, ...)
│   ├── worker/                # Worker-only views + WorkerContext
│   ├── auth/                  # Login
│   ├── client-report/         # Report rendering used inside ClientPortal
│   └── public/
├── components/
│   ├── admin/, worker/, common/   # Shared UI; common/ is cross-role (EntryForm, VerificationPortal, ...)
├── utils/                     # Pure modules: date/format/email, PDF/DOCX generation, AI, signatures — all
│                               #   external service calls are isolated here, not inline in components
├── client-portal/             # Sub-views + hooks specific to the client portal
├── hooks/, constants/, lib/, data/
└── mocks/                     # MSW handlers for VITE_MOCK_API / test mode
```
`features/admin` and `features/worker` should not import from each other; shared primitives belong in `components/common/`.

**Document generation pipeline:** `docxTemplateService.js` / `timesheetTemplateService.js` fill DOCX templates in-memory with `docxtemplater` + `pizzip`, then export to PDF via `pdf-lib` / `jsPDF`, or convert via CloudConvert. QR codes (`qrcode`) and signatures (`react-signature-canvas`, stored as base64 data URLs) are embedded into the generated documents.

**Backend (`api/`) — Vercel serverless functions.** Endpoints are consolidated into single router files dispatched by a `?tipo=`/`?action=` query param rather than one file per route, specifically to stay under the Vercel Hobby plan's serverless function count limit (e.g. `api/reconciliacao/index.js` handles parse/upload/process; `api/toconline/proxy.js` handles bank-accounts/clientes/fornecedores/relatorio/status/auth). `vercel.json` rewrites the original REST-style paths (e.g. `/api/reconciliacao/parse`) to the query-param form, so the frontend calls clean URLs. Files prefixed with `_` (e.g. `_matchingEngine.js`, `_parseUtils.js`, `_token.js`) are shared helpers, not routes. `vercel.json` also sets per-function `maxDuration` and one cron (`/api/contador?tipo=preparar_mensal`, monthly). When touching `api/`, run against a live backend with `npm run dev:api` (Vite alone won't serve these).

**Database:** Supabase Postgres, migrations in `supabase/migrations/` (~90 files, date-prefixed `YYYYMMDD[NN]_description.sql`, always additive — add a new migration rather than editing a past one). Notable domains covered: time logs/schedules/corrections, worker documents & onboarding, client invoicing (`faturas`), payments (`pagamentos`), bank reconciliation, SEPA payroll export, TOConline integration, Social Security (`seguranca_social`) communications.

## Conventions

- ESLint flat config (`eslint.config.js`) has separate rule sets for `src/**` (browser globals, react-hooks/react-refresh plugins), `api/**` (node globals), and test files (relaxed). `no-console` only allows `warn`/`error`; unused vars starting with `_` (args) or uppercase (vars) are exempt.
- No Prettier/Biome — match the surrounding file's style.
- Components: PascalCase `.jsx`; hooks: `use` + camelCase; utils: camelCase `.js`.
- Functional components with hooks throughout; `prop-types` used for prop validation (no TypeScript in `src/`).
- Portuguese is used for domain terms in code, comments, and DB columns (e.g. `faturas`, `pagamentos`, `correcoes`, `fornecedores`) — keep new code consistent with this rather than translating to English.
- `backup_*` directories are excluded from linting and are historical snapshots, not live code — don't edit or treat them as current architecture.

## Testing

- Vitest (`vitest.config.js`, jsdom environment) covers `tests/unit/**`, `tests/integration/**`, `tests/performance/**`, loading `tests/setup.js` first (jest-dom matchers, `localStorage`/`matchMedia` stubs, MSW server lifecycle).
- MSW (`src/mocks/`) mocks Supabase REST calls for unit tests and for local dev when `VITE_MOCK_API=true`.
- Playwright e2e tests live under `tests/e2e/<feature-folder>/*.spec.{js,ts}`, with shared auth helpers, a test-data factory, and Supabase mocks in `tests/e2e/helpers/` and `tests/e2e/support/`. `fullyParallel: false`, `workers: 1` — e2e tests are written to run sequentially against a single dev server instance, not isolated per-worker.
