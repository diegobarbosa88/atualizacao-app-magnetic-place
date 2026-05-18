# Stack — app-magnetic

**Mapeado:** 2026-05-05
**Última atualização:** 2026-05-05

## Runtime & Framework

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Node.js | — | Runtime |
| React | 19.2.4 | UI framework |
| Vite | 5.4.21 | Build tool |

## UI & Styling

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| lucide-react | 1.7.0 | Icons |
| prop-types | 15.8.1 | Type checking |

## Backend Services

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| @supabase/supabase-js | 2.101.1 | Database & realtime |
| @google/generative-ai | 0.24.1 | Gemini AI integration |

## PDF & Document Generation

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| jspdf | 4.2.1 | PDF generation |
| html2canvas | 1.4.1 | Screenshot for PDF |
| jszip | 3.10.1 | Zip archives |

## Email

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| @emailjs/browser | 4.4.1 | Email delivery |

## Signature

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| react-signature-canvas | 1.1.0-alpha.2 | Digital signatures |

## Testing

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| vitest | 4.1.5 | Unit testing |
| @playwright/test | 1.59.1 | E2E testing |
| msw | 2.7.0 | API mocking |
| @testing-library/* | — | React testing |

## Development Tools

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| eslint | 9.39.4 | Linting |
| parcel | 2.16.4 | Bundler (cache) |
| babel/* | 7.29.0 | Transpilation |

## Build & Deploy

| Tecnologia | Uso |
|------------|-----|
| Vercel | Hosting/deployment |

## Environment Variables

Variáveis esperadas (`VITE_*`):
- `VITE_GEMINI_API_KEY` — Google Gemini API key
- `VITE_CLIENT_PORTAL_URL` — Client portal URL
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key
