# Integrations — app-magnetic

**Mapeado:** 2026-05-05

## External Services

### Supabase

| Aspecto | Detalhe |
|---------|---------|
| **Package** | `@supabase/supabase-js` 2.101.1 |
| **Uso** | Database + Realtime subscriptions |
| **Tabelas** | `logs`, `clients`, `workers` |
| **Features** | postgres_changes channel subscriptions |

**Configuração:**
```javascript
const supabaseUrl = 'https://xxx.supabase.co';
const supabaseKey = 'sb_publishable_xxx';
```

### Google Gemini AI

| Aspecto | Detalhe |
|---------|---------|
| **Package** | `@google/generative-ai` 0.24.1 |
| **Modelo** | gemini-2.5-flash-preview |
| **Uso** | AI-powered description polishing |
| **Endpoint** | `generativelanguage.googleapis.com` |

**Uso típico:**
```javascript
const result = await model.generateContent(prompt);
```

### EmailJS

| Aspecto | Detalhe |
|---------|---------|
| **Package** | `@emailjs/browser` 4.4.1 |
| **Uso** | Email notifications to clients |
| **Templates** | Notification, Portal access |

### External APIs

| API | Uso |
|-----|-----|
| `api.ipify.org` | Get client IP address |
| `generativelanguage.googleapis.com` | Gemini AI |

## Environment Variables

| Variável | Serviço |
|----------|---------|
| `VITE_GEMINI_API_KEY` | Gemini AI |
| `VITE_CLIENT_PORTAL_URL` | Client portal base URL |
| `VITE_SUPABASE_URL` | Supabase project |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |

## Security Concerns

⚠️ **AVISO:** Várias chaves de API estão hardcoded no código cliente:
- `src/app.jsx` — Supabase keys, EmailJS credentials, Gemini key, pdf.co key
- Estas devem ser movidas para environment variables `VITE_*`
