<!-- generated-by: gsd-doc-writer -->
# Getting Started

This guide walks you through setting up the app-magnetic project locally for the first time.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js >= 18.0.0** — required by Vite 5 and the React 19 ecosystem
- **npm >= 9.0.0** — used as the package manager (comes with Node.js)
- **Git** — to clone the repository

You will also need accounts and API keys for the following external services:

- [Supabase](https://supabase.com) — database and authentication backend
- [Google AI Studio](https://aistudio.google.com/app/apikey) — Gemini AI API key
- [EmailJS](https://www.emailjs.com) — transactional email service
- [PDF.co](https://app.pdf.co) — Word to PDF conversion (10,000 free credits on signup)

## Installation Steps

1. Clone the repository:

```bash
git clone <repository-url>
cd "app Magnetic"
```

2. Install dependencies:

```bash
npm install
```

3. Copy the environment variables file and fill in your credentials:

```bash
cp .env.example .env
```

Open `.env` in your editor and replace each placeholder value with your actual credentials. See [CONFIGURATION.md](./CONFIGURATION.md) for a full description of every variable.

## First Run

Start the development server:

```bash
npm run dev
```

Vite will start the app at `http://localhost:5173` by default. The terminal output will show the exact URL.

## Common Setup Issues

**Missing environment variables — app fails to connect to Supabase**
If the app loads but shows authentication errors or a blank screen, your `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is likely incorrect or missing. Verify the values in your Supabase project dashboard under Project Settings > API.

**Gemini AI features return errors**
Ensure `VITE_GEMINI_API_KEY` is set. Keys are generated at [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey). Free-tier keys have per-minute rate limits that can cause intermittent failures during heavy use.

**Port 5173 already in use**
Vite will automatically try the next available port and print the new URL. Alternatively, start the server on a specific port:

```bash
npm run dev -- --port 3000
```

**EmailJS emails not sending**
All four `VITE_EMAILJS_*` variables must be set. The service ID, template IDs, and public key are found in your EmailJS dashboard. Confirm that the templates referenced by `VITE_EMAILJS_TEMPLATE_ID_NOTIF` and `VITE_EMAILJS_TEMPLATE_ID_PORTAL` exist and are published.

## Next Steps

- **Local development workflows and build commands:** [DEVELOPMENT.md](./DEVELOPMENT.md)
- **Running the test suite:** [TESTING.md](./TESTING.md)
- **Full environment variable reference:** [CONFIGURATION.md](./CONFIGURATION.md)
- **System architecture overview:** [ARCHITECTURE.md](./ARCHITECTURE.md)
