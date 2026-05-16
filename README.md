<!-- generated-by: gsd-doc-writer -->
# app-magnetic

Internal workforce management platform for Magnetic Place — tracks worker time entries, client approvals, documents, financial reporting, and notifications through a unified React dashboard.

## Installation

Requires Node.js. Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd "app Magnetic"
npm install
```

Copy the environment template and fill in your credentials:

```bash
cp .env.example .env
```

See [Environment Variables](#environment-variables) below for required values.

## Quick Start

1. Configure `.env` with your Supabase, EmailJS, Gemini AI, and PDF.co credentials.
2. Start the development server:

```bash
npm run dev
```

3. Open the local URL printed by Vite (typically `http://localhost:5173`).

## Usage Examples

**Admin dashboard** — Admins log in to manage workers, review time entries, approve corrections, generate financial reports, and administer document templates.

**Worker portal** — Workers log in to register daily time entries, view their monthly summaries, submit correction requests, and download documents.

**Client portal** — Clients access a separate view to review and approve worker timesheets; reachable via the URL configured in `VITE_CLIENT_PORTAL_URL`.

**Document generation** — Admins upload `.docx` templates with placeholder fields; the platform fills them per-worker and exports signed documents as PDF.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public API key |
| `VITE_GEMINI_API_KEY` | Yes | Google Gemini AI API key ([get one](https://aistudio.google.com/app/apikey)) |
| `VITE_CLIENT_PORTAL_URL` | Yes | Public URL for the client approval portal |
| `VITE_EMAILJS_SERVICE_ID` | Yes | EmailJS service ID |
| `VITE_EMAILJS_TEMPLATE_ID_NOTIF` | Yes | EmailJS template for worker notifications |
| `VITE_EMAILJS_TEMPLATE_ID_PORTAL` | Yes | EmailJS template for client portal invites |
| `VITE_EMAILJS_PUBLIC_KEY` | Yes | EmailJS public key |
| `VITE_PDFCO_API_KEY` | Optional | PDF.co API key for Word to PDF conversion ([get one](https://app.pdf.co/)) |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run all tests with Vitest |
| `npm run test:unit` | Run unit tests once |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run test:e2e:ui` | Run Playwright tests with interactive UI |

## Tech Stack

- **React 19** + **Vite** — frontend framework and build tool
- **Tailwind CSS v4** — utility-first styling
- **Supabase** — database and authentication backend
- **Google Gemini AI** — AI-assisted features
- **EmailJS** — transactional email delivery
- **docxtemplater / docx / pdf-lib** — document generation and PDF handling
- **Recharts** — financial reporting charts
- **Vitest** + **Playwright** — unit and end-to-end testing
