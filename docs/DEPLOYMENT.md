<!-- generated-by: gsd-doc-writer -->
# Deployment

This document describes how to build and deploy the app-magnetic application.

---

## Deployment Targets

The project is configured for deployment on **Vercel**, a static hosting platform. The `vercel.json` configuration file at the project root handles SPA routing by rewriting all requests to `index.html`.

| Target | Config File | Notes |
|---|---|---|
| Vercel | `vercel.json` | SPA rewrite rule — all routes resolve to `index.html` |

No Docker, Netlify, Fly.io, Railway, or Serverless Framework configuration files were detected.

---

## Build Pipeline

The application is a Vite-bundled React SPA. The build produces a static artifact in the `dist/` directory.

**Build command:**

```bash
npm run build
```

This executes `vite build`, which compiles and bundles all source files into `dist/`.

**CI workflow (`copilot-setup-steps.yml`):**

The only workflow present in `.github/workflows/` is the GitHub Copilot setup workflow. It does not contain a deploy step. There is no automated CI/CD deploy pipeline configured in the repository.

Steps in the setup workflow:
1. Checkout source (`actions/checkout@v4`)
2. Set up Node.js LTS (`actions/setup-node@v4`)
3. Install dependencies (`npm ci`)
4. Install Playwright browsers (`npx playwright install --with-deps`)
5. Build application (`npx run build`)

To deploy to Vercel, the recommended approach is to connect the repository to a Vercel project via the Vercel dashboard or Vercel CLI. Vercel will run `npm run build` automatically on each push to the configured branch.

<!-- VERIFY: Confirm which branch (main/master) is connected as the production branch in the Vercel project settings -->

---

## Environment Setup

All required environment variables must be set in the Vercel project's environment variable settings before the first deployment. The application will not function correctly if the required variables are absent.

**Required variables for production:**

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous API key |
| `VITE_GEMINI_API_KEY` | Google Gemini API key |
| `VITE_EMAILJS_SERVICE_ID` | EmailJS service identifier |
| `VITE_EMAILJS_TEMPLATE_ID_NOTIF` | EmailJS notification template |
| `VITE_EMAILJS_TEMPLATE_ID_PORTAL` | EmailJS client portal template |
| `VITE_EMAILJS_PUBLIC_KEY` | EmailJS public key |
| `VITE_CLOUDCONVERT_API_KEY` | CloudConvert API key (DOCX→PDF) |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key (Web Push) |

See [CONFIGURATION.md](./CONFIGURATION.md) for the full list of variables including optional settings and their default values.

**Setting variables in Vercel:**
1. Open the Vercel project dashboard.
2. Go to **Settings > Environment Variables**.
3. Add each required variable for the **Production** environment.
4. Redeploy the project after saving changes.

<!-- VERIFY: Confirm Vercel project name and dashboard URL for this deployment -->

---

## Rollback Procedure

Vercel maintains a deployment history for every project. To roll back to a previous release:

1. Open the Vercel project dashboard.
2. Go to **Deployments**.
3. Locate the last known-good deployment.
4. Click the three-dot menu on that deployment and select **Promote to Production**.

<!-- VERIFY: Confirm rollback access permissions for the team members who manage production -->

Alternatively, revert the relevant commit in the repository and push — Vercel will trigger a new build from the reverted code if automatic deployments are enabled.

---

## Monitoring

No application monitoring library (`@sentry/*`, `dd-trace`, `newrelic`, `@opentelemetry/*`) was detected in `package.json`.

<!-- VERIFY: Confirm whether Vercel Analytics or any external monitoring service is enabled for this project -->

For basic deployment health, Vercel provides build logs and deployment status in the project dashboard.
