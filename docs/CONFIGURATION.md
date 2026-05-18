<!-- generated-by: gsd-doc-writer -->
# Configuration

This document describes all environment variables and configuration settings for app-magnetic.

---

## Environment Variables

All runtime configuration is supplied through environment variables prefixed with `VITE_` so they are bundled by Vite into the client-side build. Variables without the `VITE_` prefix are used by server-side tooling only (e.g., the VAPID push notification server).

Copy `.env` (not committed) and populate the values below before running the development server.

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Required | — | Base URL of the Supabase project used for the database and auth. |
| `VITE_SUPABASE_ANON_KEY` | Required | — | Supabase anonymous (publishable) API key for client-side queries. |
| `VITE_GEMINI_API_KEY` | Required | — | Google Gemini API key used for AI text processing features. |
| `VITE_GEMINI_MODEL` | Optional | `gemini-2.5-flash` | Gemini model name to use when calling the Generative Language API. |
| `VITE_CLIENT_PORTAL_URL` | Optional | `https://t2x5z5k2q1qweqobvre.plex.cloud` | URL of the external client portal, included in notification links. |
| `VITE_EMAILJS_SERVICE_ID` | Required | — | EmailJS service identifier used to send notification emails. |
| `VITE_EMAILJS_TEMPLATE_ID_NOTIF` | Required | — | EmailJS template ID for worker/admin notification emails. |
| `VITE_EMAILJS_TEMPLATE_ID_PORTAL` | Required | — | EmailJS template ID for client portal invitation emails. |
| `VITE_EMAILJS_PUBLIC_KEY` | Required | — | EmailJS public key (account-level) used to authenticate API calls. |
| `VITE_PDFCO_API_KEY` | Optional | — | PDF.co API key for PDF processing features. When absent, PDF.co-dependent operations are disabled. |
| `VITE_CLOUDCONVERT_API_KEY` | Required (for DOCX→PDF) | — | CloudConvert API key for converting DOCX documents to PDF. The application throws an error at conversion time if this is missing. |
| `VITE_CLOUDCONVERT_BASE_URL` | Optional | `https://api.cloudconvert.com/v2` | Base URL for the CloudConvert API. Override for sandbox/testing environments. |
| `VITE_VAPID_PUBLIC_KEY` | Required (for push notifications) | — | VAPID public key for Web Push Notifications (client side). Must match `VAPID_PUBLIC_KEY`. |
| `VAPID_PUBLIC_KEY` | Required (for push notifications) | — | VAPID public key used by the push notification server. |
| `VAPID_PRIVATE_KEY` | Required (for push notifications) | — | VAPID private key used by the push notification server. Keep this secret and never expose it client-side. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | — | Supabase service-role key for privileged server-side operations. Never expose this in client-side code. |

### Required vs Optional at Startup

The following variables cause a runtime error if absent when their respective feature is used:

- **`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`** — The app will fail to initialise the Supabase client and no data will load.
- **`VITE_CLOUDCONVERT_API_KEY`** — The application throws `CloudConvert API key em falta. Define VITE_CLOUDCONVERT_API_KEY no .env e reinicia o dev server.` when a DOCX-to-PDF conversion is attempted.
- **`VITE_GEMINI_API_KEY`** — AI features return the message `A IA precisa de uma chave API configurada.` instead of a result.

---

## Config File: vite.config.js

The Vite build configuration is in `vite.config.js` at the project root.

```js
// vite.config.js
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,      // bind to all network interfaces
    port: 4179,      // dev server port (non-strict — falls back if occupied)
    strictPort: false,
  },
})
```

Key settings:

| Setting | Value | Description |
|---|---|---|
| `server.port` | `4179` | Default port for the Vite dev server. |
| `server.strictPort` | `false` | If port 4179 is in use, Vite will try the next available port. |
| `server.host` | `true` | Dev server binds to `0.0.0.0` (accessible on the local network). |

---

## Defaults Defined in Source

Optional variables with code-level defaults:

| Variable | Default value | Defined in |
|---|---|---|
| `VITE_GEMINI_MODEL` | `gemini-2.5-flash` | `src/utils/aiUtils.js` |
| `VITE_CLOUDCONVERT_BASE_URL` | `https://api.cloudconvert.com/v2` | `src/utils/cloudConvertService.js` |
| `VITE_CLIENT_PORTAL_URL` | `https://t2x5z5k2q1qweqobvre.plex.cloud` | `src/app.jsx` |

---

## Per-Environment Overrides

The project does not include `.env.development` or `.env.production` files. All environment-specific values are set in the single `.env` file at the project root.

For production deployments on Vercel (see `vercel.json`), environment variables should be configured in the Vercel project dashboard under **Settings → Environment Variables**. <!-- VERIFY: Vercel project dashboard URL and team/project names -->

Variables containing secrets (`VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_CLOUDCONVERT_API_KEY`, `VITE_PDFCO_API_KEY`) must be stored in the deployment platform's secret store and must **never** be committed to the repository.

---

## External Service Summary

| Service | Variable(s) | Purpose |
|---|---|---|
| Supabase | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Database, authentication, real-time |
| Google Gemini | `VITE_GEMINI_API_KEY`, `VITE_GEMINI_MODEL` | AI text processing |
| EmailJS | `VITE_EMAILJS_*` | Transactional email (notifications, portal invites) |
| CloudConvert | `VITE_CLOUDCONVERT_API_KEY`, `VITE_CLOUDCONVERT_BASE_URL` | DOCX → PDF conversion |
| PDF.co | `VITE_PDFCO_API_KEY` | PDF processing |
| Web Push (VAPID) | `VITE_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Browser push notifications |
