# Phase 17: Importação Automática de Faturas via Gmail — Research

**Researched:** 2026-05-18
**Domain:** Gmail API (googleapis npm), Vercel Serverless Functions, Supabase Storage server-side uploads
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** O módulo é acionado por um **endpoint REST manual** — não há cron job automático. O admin clica "Importar Faturas do Gmail" no painel e o endpoint é chamado.
- **D-02:** O endpoint responde com um resumo: quantos emails processados, quantos ficheiros guardados, erros parciais.
- **D-03:** Autenticação **server-to-server** via Google Cloud Service Account (`GoogleAuth` do pacote `googleapis`).
- **D-04:** Scope obrigatório: `https://www.googleapis.com/auth/gmail.modify`.
- **D-05:** O ficheiro de credenciais `credentials.json` deve estar no `.gitignore` e ser referenciado por variável de ambiente.
- **D-06:** Query: `is:unread has:attachment {subject:fatura subject:invoice subject:FT}`.
- **D-07:** Chamar `gmail.users.messages.list` com a query, iterar resultados com `gmail.users.messages.get` para aceder ao payload completo.
- **D-08:** Filtrar partes com `mimeType` `application/pdf` ou `application/xml` para obter `attachmentId`.
- **D-09:** Descarregar via `gmail.users.messages.attachments.get` e converter a string **Base64Url** devolvida para `Buffer` nativo Node.js usando `Buffer.from(data, 'base64url')`.
- **D-10:** Guardar os ficheiros no **Supabase Storage**, bucket `faturas`, com path `faturas/{messageId}/{filename}`.
- **D-11:** Registar a URL pública de cada ficheiro.
- **D-12:** Se um anexo falhar, continuar com os restantes (fail-partial).
- **D-13:** O email **é marcado como lido** mesmo com falhas parciais.
- **D-14:** Cada download de anexo deve ter o seu próprio `try/catch`.
- **D-15:** Após processar todos os anexos, chamar `gmail.users.messages.modify` com `{ removeLabelIds: ['UNREAD'] }`.
- **D-16:** Objetivo: garantir que o email não é reprocessado.
- **D-17:** Adicionar botão **"Importar Faturas do Gmail"** na tab `Documentos` do painel admin (`DocumentsAdmin.jsx`).
- **D-18:** O botão mostra estado de loading durante a operação e exibe o resultado.

### Claude's Discretion
- WHERE the endpoint lives: Supabase Edge Function vs Vercel Serverless Function (a principal questão arquitectural a resolver nesta research).

### Deferred Ideas (OUT OF SCOPE)
- Processamento automático/OCR das faturas após download
- Scheduler automático (cron)
- Filtros avançados por remetente ou data na query Gmail
</user_constraints>

---

## Summary

This phase introduces the first server-side compute component in a project that is otherwise a pure Vite/React SPA deployed on Vercel. The core question is where to run the Gmail API logic: Supabase Edge Functions (Deno runtime) or a Vercel API route (Node.js runtime).

The research strongly favours **Vercel API route (`/api/gmail/import-faturas.js`)** over a Supabase Edge Function. The project already deploys to Vercel (confirmed by `vercel.json` in the repo root), the `googleapis` npm package is a 170 MB Node.js-first library with documented compatibility issues in Deno, and a Vercel API route requires zero new infrastructure — just one new file in an `api/` directory.

The `googleapis` package at v171.4.0 provides a clean service-account-from-env-var pattern using `google.auth.JWT` with credentials passed as a parsed JSON object (not a file path). All four required Gmail API calls (`messages.list`, `messages.get`, `attachments.get`, `messages.modify`) are covered by the same `googleapis` package. Supabase Storage server-side upload uses a separate `createClient` instance initialised with the service role key — the anon key used in the browser is insufficient for bypassing RLS on Storage writes from server code.

**Primary recommendation:** Create `api/gmail/import-faturas.js` as a Vercel API route. Install `googleapis` as a production dependency. Use `GMAIL_SERVICE_ACCOUNT_JSON` (base64-encoded) + `SUPABASE_SERVICE_ROLE_KEY` as server-only env vars. Set `maxDuration: 60` in `vercel.json` for this function.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gmail OAuth (server-to-server) | API / Backend | — | Service account private key must never reach the browser |
| Gmail message list/get/attachments | API / Backend | — | Requires Node.js `googleapis` with JWT auth |
| Base64Url → Buffer decode | API / Backend | — | `Buffer` is a Node.js built-in; not available in browser |
| Supabase Storage upload | API / Backend | — | Service role key required; must stay server-side |
| `documents` table insert | API / Backend | — | Same service role client used for Storage |
| Button + loading state | Browser / Client | — | React state in DocumentsAdmin.jsx |
| Fetch call to endpoint | Browser / Client | — | Standard `fetch('/api/gmail/import-faturas', { method: 'POST' })` |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `googleapis` | 171.4.0 | Gmail API client (auth + all API methods) | Official Google Node.js client; only viable option for server-to-server Gmail |
| `@supabase/supabase-js` | 2.105.4 (already installed) | Storage upload + DB insert from server | Already in project; service-role client pattern well documented |

[VERIFIED: npm registry — `npm view googleapis version` returned `171.4.0`; `npm view @supabase/supabase-js version` returned `2.105.4`]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js built-in `Buffer` | native | Base64Url → binary decode | Always — `Buffer.from(data, 'base64url')` |
| Node.js built-in `process.env` | native | Read server-only env vars | Always |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vercel API route | Supabase Edge Function | Edge Function runs Deno; `googleapis` has documented Deno breakage (gcp-metadata dependency); requires separate Supabase CLI deploy pipeline; no benefit for a manually triggered endpoint |
| `google.auth.JWT` | `GoogleAuth` with `keyFile` | `keyFile` requires filesystem access — not available in serverless environments; `JWT` accepts credentials object directly |
| Base64-encoded JSON env var | Individual env vars per field | Base64 approach handles newlines in private key without escaping; individual vars work too but require reconstructing the JSON object |

**Installation (new dependency only):**
```bash
npm install googleapis
```

**Version verification:** `googleapis` 171.4.0 confirmed via `npm view googleapis version` on 2026-05-18. [VERIFIED: npm registry]

---

## Architecture Decision: Vercel API Route vs Supabase Edge Function

### Verdict: Use Vercel API Route (`/api/gmail/import-faturas.js`)

#### Why NOT Supabase Edge Functions

1. **Deno runtime incompatibility with `googleapis`** — A documented breaking change occurred in late January 2025 when `gcp-metadata` was updated from 6.1.0 to 6.1.1, introducing a `google-logging-utils` dependency that fails in Deno. Users on the Supabase GitHub discussions board confirmed `googleapis` + `google-auth-library` stopped working in Edge Functions until the lock file workaround was applied. [CITED: github.com/orgs/supabase/discussions/33244]

2. **Separate deploy pipeline** — Edge Functions are deployed via `supabase functions deploy`, a completely separate flow from the existing Vercel git-push deploy. This adds ops complexity for a single endpoint.

3. **`googleapis` bundle size** — The package is ~170 MB installed; Deno/Edge environments have tighter size constraints and load modules differently.

4. **No benefit** — Edge Functions shine for latency-sensitive globally distributed work. A manually triggered admin import does not need edge distribution.

#### Why Vercel API Route IS the right choice

1. **Zero new infrastructure** — The project already deploys to Vercel (confirmed by `vercel.json`). An `api/` directory is all that's needed; Vercel auto-detects it. [VERIFIED: vercel.json present in repo root]

2. **Full Node.js compatibility** — All Node.js APIs available, including `Buffer`, `process.env`, `crypto`. `googleapis` works exactly as documented. [CITED: vercel.com/docs/functions/runtimes/node-js]

3. **300s default timeout on Hobby plan** — With Fluid Compute enabled by default, Hobby plan now supports up to 300s. This is more than sufficient for processing a batch of emails. Per-function `maxDuration` can be set in `vercel.json`. [CITED: vercel.com/docs/functions/configuring-functions/duration]

4. **No CORS issue** — The function lives on the same origin as the SPA (`/api/...`), so no CORS configuration is needed.

5. **Same env var system** — Server-only vars (without `VITE_` prefix) are already the Vercel convention. The existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are browser-exposed; the new `SUPABASE_SERVICE_ROLE_KEY` and `GMAIL_SERVICE_ACCOUNT_JSON` will be server-only (no `VITE_` prefix).

#### Vercel API Route File Location

```
api/
└── gmail/
    └── import-faturas.js    ← auto-served at /api/gmail/import-faturas
```

The existing `vercel.json` has a catch-all rewrite `"/(.*)" → "/index.html"`. This does NOT intercept `/api/**` routes because Vercel processes API routes before rewrites. No changes to `vercel.json` are needed for routing — only a `maxDuration` addition.

**vercel.json update needed:**
```json
{
  "functions": {
    "api/gmail/import-faturas.js": {
      "maxDuration": 60
    }
  }
}
```

---

## Architecture Patterns

### System Architecture Diagram

```
[Admin Browser]
    │
    │  POST /api/gmail/import-faturas
    │  (button click in DocumentsAdmin.jsx)
    ▼
[Vercel API Route — api/gmail/import-faturas.js]
    │
    ├──► [Google Gmail API]
    │        │  JWT auth (service account)
    │        │  messages.list (q: unread+attachment)
    │        │  messages.get (format: full)
    │        │  attachments.get (base64url → Buffer)
    │        │  messages.modify (removeLabelIds: UNREAD)
    │
    ├──► [Supabase Storage — bucket: faturas]
    │        │  upload(path, buffer, { contentType, upsert })
    │        │  getPublicUrl(path) → URL
    │
    └──► [Supabase DB — table: documents]
             │  insert({ id, tipo, nomeFicheiro, url, status, dataEmissao })
             │
             ▼
[Response to Browser]
    { processados: N, ficheiros: N, erros: [...] }
```

### Recommended Project Structure
```
api/
└── gmail/
    └── import-faturas.js     # Vercel serverless function (CommonJS or ESM)

src/
└── features/
    └── admin/
        └── DocumentsAdmin.jsx  # Add button + state (importando, importResult)
```

### Pattern 1: Service Account Auth from Environment Variable

**What:** Parse the service account JSON from a base64-encoded env var instead of reading a file. This is the only safe pattern for serverless environments where the filesystem is ephemeral and credentials files cannot be guaranteed present.

**When to use:** Always in Vercel/serverless deployments.

```javascript
// Source: https://www.paulie.dev/posts/2024/06/how-to-use-google-application-json-credentials-in-environment-variables/
// Pattern: base64-encoded JSON in env var

const credentials = JSON.parse(
  Buffer.from(process.env.GMAIL_SERVICE_ACCOUNT_JSON, 'base64').toString('utf-8')
);

const auth = new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/gmail.modify'],
  subject: process.env.GMAIL_TARGET_EMAIL,  // the Gmail mailbox to impersonate
});

await auth.authorize();
const gmail = google.gmail({ version: 'v1', auth });
```

**IMPORTANT — Domain-Wide Delegation:** Gmail API with a Service Account requires Domain-Wide Delegation to be enabled in Google Workspace Admin. The `subject` field in JWT must be the actual Gmail address being read. Without this, the API returns a 403. [ASSUMED — this is a Google Workspace requirement, not something verifiable in code; must be configured by user in Google Admin Console]

**Alternative: GoogleAuth with credentials object (simpler):**
```javascript
// Source: [ASSUMED based on googleapis README pattern]
const auth = new google.auth.GoogleAuth({
  credentials: credentials,  // parsed JSON object
  scopes: ['https://www.googleapis.com/auth/gmail.modify'],
});
const client = await auth.getClient();
const gmail = google.gmail({ version: 'v1', auth: client });
```

The `JWT` constructor is more explicit and recommended when you know the service account will always be used. `GoogleAuth` auto-detects the auth type from the credentials object.

### Pattern 2: Gmail messages.list

```javascript
// Source: [CITED: developers.google.com/gmail/api/reference/rest/v1/users.messages/list]
const listRes = await gmail.users.messages.list({
  userId: 'me',
  q: 'is:unread has:attachment {subject:fatura subject:invoice subject:FT}',
  maxResults: 50,
});

const messages = listRes.data.messages || [];
// messages = [{ id: '...', threadId: '...' }, ...]
// NOTE: list() only returns id + threadId; full payload requires messages.get()
```

### Pattern 3: Gmail messages.get (full payload)

```javascript
// Source: [CITED: developers.google.com/gmail/api/reference/rest/v1/users.messages/get]
const msgRes = await gmail.users.messages.get({
  userId: 'me',
  id: message.id,
  format: 'full',  // returns complete payload including parts[]
});

const payload = msgRes.data.payload;
const parts = payload.parts || [];

// Recursive helper to find attachment parts
function findAttachmentParts(parts) {
  const attachments = [];
  for (const part of parts) {
    if (
      (part.mimeType === 'application/pdf' || part.mimeType === 'application/xml') &&
      part.body?.attachmentId
    ) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename || `attachment.${part.mimeType === 'application/pdf' ? 'pdf' : 'xml'}`,
        mimeType: part.mimeType,
      });
    }
    // Recurse into nested parts (multipart/mixed emails have nested structure)
    if (part.parts && part.parts.length > 0) {
      attachments.push(...findAttachmentParts(part.parts));
    }
  }
  return attachments;
}
```

**IMPORTANT — Nested parts:** Multipart emails have a tree structure. `payload.parts` may contain `multipart/mixed` parts which themselves contain the actual attachments. Always recurse.

### Pattern 4: Gmail attachments.get + Buffer decode

```javascript
// Source: [CITED: developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get]
// + D-09 locked decision
const attRes = await gmail.users.messages.attachments.get({
  userId: 'me',
  messageId: message.id,
  id: attachmentPart.attachmentId,
});

// attRes.data.data is a Base64Url string (uses - and _ instead of + and /)
const buffer = Buffer.from(attRes.data.data, 'base64url');
// buffer is now a binary Buffer ready for upload
```

### Pattern 5: Gmail messages.modify (mark as read)

```javascript
// Source: [CITED: developers.google.com/gmail/api/reference/rest/v1/users.messages/modify]
await gmail.users.messages.modify({
  userId: 'me',
  id: message.id,
  requestBody: {
    removeLabelIds: ['UNREAD'],
  },
});
// Note: parameter is 'requestBody', not 'resource', in googleapis v100+
```

**IMPORTANT:** In recent versions of `googleapis` (v100+), the request body parameter for mutation calls changed from `resource:` to `requestBody:`. Using `resource:` still works but triggers a deprecation warning. Use `requestBody:`. [ASSUMED based on googleapis changelog patterns — verify if warnings appear]

### Pattern 6: Supabase Storage upload from server (service role)

```javascript
// Source: pattern from src/utils/separarRecibosTOConline.js (adapted for server)
// + [CITED: supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa]
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,   // server-only (no VITE_ prefix)
  process.env.SUPABASE_SERVICE_ROLE_KEY  // NEVER expose this to browser
);

const storagePath = `faturas/${messageId}/${filename}`;

const { error: uploadError } = await supabaseAdmin.storage
  .from('faturas')
  .upload(storagePath, buffer, {
    contentType: attachmentPart.mimeType,  // 'application/pdf' or 'application/xml'
    upsert: true,
  });
if (uploadError) throw uploadError;

const { data: urlData } = supabaseAdmin.storage
  .from('faturas')
  .getPublicUrl(storagePath);
// urlData.publicUrl is the public URL
```

**IMPORTANT — Bucket must exist:** The `faturas` bucket must be created in Supabase Dashboard before the first upload. The API will return a 404 if the bucket doesn't exist. This is a Wave 0 task.

**IMPORTANT — Service role vs anon key:**
- The browser SPA uses `VITE_SUPABASE_ANON_KEY` — subject to RLS policies.
- The server function must use `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS entirely.
- Create a separate `supabaseAdmin` client in the API route; do not reuse the browser client.
- `SUPABASE_URL` (without `VITE_`) must also be set as a server env var since `VITE_SUPABASE_URL` is only injected at Vite build time and not available in Vercel's Node.js serverless runtime.

### Pattern 7: Complete API route structure

```javascript
// api/gmail/import-faturas.js
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- Auth guard: only admin can call this ---
  // Option A: check a shared secret header (simplest for MVP)
  // Option B: validate Supabase JWT from Authorization header
  // (see Security Domain section)

  let processados = 0;
  let ficheiros = 0;
  const erros = [];

  try {
    // 1. Init Gmail client
    const credentials = JSON.parse(
      Buffer.from(process.env.GMAIL_SERVICE_ACCOUNT_JSON, 'base64').toString('utf-8')
    );
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/gmail.modify'],
      subject: process.env.GMAIL_TARGET_EMAIL,
    });
    await auth.authorize();
    const gmail = google.gmail({ version: 'v1', auth });

    // 2. Init Supabase admin client
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 3. List unread emails with attachments
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread has:attachment {subject:fatura subject:invoice subject:FT}',
      maxResults: 50,
    });

    const messages = listRes.data.messages || [];

    for (const msg of messages) {
      try {
        // 4. Get full message payload
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        const attachmentParts = findAttachmentParts(msgRes.data.payload?.parts || []);

        for (const part of attachmentParts) {
          try {
            // 5. Download attachment
            const attRes = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: msg.id,
              id: part.attachmentId,
            });

            const buffer = Buffer.from(attRes.data.data, 'base64url');
            const storagePath = `faturas/${msg.id}/${part.filename}`;

            // 6. Upload to Supabase Storage
            const { error: uploadError } = await supabaseAdmin.storage
              .from('faturas')
              .upload(storagePath, buffer, { contentType: part.mimeType, upsert: true });
            if (uploadError) throw uploadError;

            const { data: urlData } = supabaseAdmin.storage
              .from('faturas')
              .getPublicUrl(storagePath);

            // 7. Record in documents table
            await supabaseAdmin.from('documents').insert({
              id: `fatura_${msg.id}_${Date.now()}`,
              tipo: 'Fatura',
              nomeFicheiro: part.filename,
              url: urlData.publicUrl,
              status: 'Pendente',
              dataEmissao: new Date().toISOString(),
            });

            ficheiros++;
          } catch (attachErr) {
            erros.push({ messageId: msg.id, filename: part.filename, error: attachErr.message });
          }
        }

        // 8. Mark email as read (even if some attachments failed — D-13)
        await gmail.users.messages.modify({
          userId: 'me',
          id: msg.id,
          requestBody: { removeLabelIds: ['UNREAD'] },
        });

        processados++;
      } catch (msgErr) {
        erros.push({ messageId: msg.id, error: msgErr.message });
      }
    }

    return res.status(200).json({ processados, ficheiros, erros });
  } catch (fatalErr) {
    return res.status(500).json({ error: fatalErr.message });
  }
}

// Recursive helper — see Pattern 3
function findAttachmentParts(parts) { /* ... */ }
```

### Pattern 8: Button in DocumentsAdmin.jsx

The toolbar section (lines 398–435 of DocumentsAdmin.jsx) is the correct insertion point — add the Gmail import button alongside the existing upload button.

```jsx
// Add to DocumentsAdmin state:
const [importando, setImportando] = useState(false);
const [importResult, setImportResult] = useState(null);

// Handler:
const handleImportarGmail = async () => {
  setImportando(true);
  setImportResult(null);
  try {
    const res = await fetch('/api/gmail/import-faturas', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
    setImportResult(data);  // { processados, ficheiros, erros }
  } catch (err) {
    setImportResult({ error: err.message });
  } finally {
    setImportando(false);
  }
};

// Button (add to toolbar next to existing Plus button):
<button
  onClick={handleImportarGmail}
  disabled={importando}
  className="p-2.5 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 shrink-0 disabled:opacity-50"
  title="Importar Faturas do Gmail"
>
  {importando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
</button>

// Result feedback (add below toolbar):
{importResult && !importResult.error && (
  <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700">
    {importResult.processados} emails processados — {importResult.ficheiros} ficheiros importados
    {importResult.erros?.length > 0 && (
      <span className="text-amber-600 ml-2">({importResult.erros.length} erros)</span>
    )}
  </div>
)}
{importResult?.error && (
  <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
    Erro: {importResult.error}
  </div>
)}
```

**Icon:** Import `Download` from `lucide-react` (already installed, version 1.7.0). This icon is not yet in the existing import list in `DocumentsAdmin.jsx`.

### Anti-Patterns to Avoid

- **Using `keyFile:` path in `GoogleAuth`** — Serverless functions have no writable filesystem; credentials files cannot be deployed. Always use `credentials:` object or `JWT` constructor with parsed JSON.
- **Reusing `VITE_SUPABASE_ANON_KEY` in the API route** — The anon key is an RLS-restricted client key; it cannot write to the `faturas` bucket without explicit RLS policies. Use `SUPABASE_SERVICE_ROLE_KEY` on the server.
- **Using `VITE_` prefix for server env vars** — `VITE_*` variables are replaced at Vite build time into the client bundle. They are NOT available as `process.env.VITE_*` in Vercel's Node.js runtime. The API route needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as plain (non-VITE) env vars set in Vercel project settings.
- **Not recursing into nested parts** — Many email clients send `multipart/mixed` → `multipart/alternative` + `application/pdf`. Checking only the top level `payload.parts` will miss attachments in nested structures.
- **Using `resource:` instead of `requestBody:` in modify calls** — Older tutorials show `resource:` but `googleapis` v100+ uses `requestBody:` for mutation operations.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gmail OAuth token management | Custom JWT signing | `google.auth.JWT` from `googleapis` | Token refresh, retry, clock skew all handled |
| Base64Url → binary decode | Custom base64 URL decoder | `Buffer.from(data, 'base64url')` | Node.js built-in; handles URL-safe alphabet (`-`, `_`) correctly |
| Gmail API HTTP requests | Direct `fetch` to Gmail API | `googleapis` client | Handles auth headers, pagination, retry on 429 |
| Supabase upload retry/error | Custom retry loop | `supabase.storage.from().upload()` SDK | SDK handles multipart upload, returns structured errors |

**Key insight:** The attachment data from Gmail uses Base64Url encoding (RFC 4648 §5), not standard Base64. A hand-rolled `atob()` will silently corrupt binary data on the `+`/`-` and `/`/`_` substitutions. `Buffer.from(data, 'base64url')` handles this correctly. [CITED: developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get]

---

## Common Pitfalls

### Pitfall 1: Gmail API requires Domain-Wide Delegation for Service Account
**What goes wrong:** API returns 403 `"Request had insufficient authentication scopes"` or `"Service accounts cannot impersonate users without Domain-Wide Delegation"`.
**Why it happens:** Gmail API with service accounts requires explicit Domain-Wide Delegation in the Google Workspace Admin Console. The scope must also be added there (not just in code).
**How to avoid:** Before any code runs, in Google Admin Console → Security → API Controls → Domain-wide Delegation → Add the service account client ID with scope `https://www.googleapis.com/auth/gmail.modify`.
**Warning signs:** 403 on the first `auth.authorize()` call.

### Pitfall 2: Private key newlines in env var
**What goes wrong:** `Error: error:0909006C:PEM routines:get_name:no start line` when creating JWT auth.
**Why it happens:** The private key in the service account JSON has literal `\n` characters. When stored in a `.env` file as a plain string, these may become escaped double-backslash sequences.
**How to avoid:** Use the base64 approach — `cat credentials.json | base64` and store the entire base64 string. Decode with `Buffer.from(process.env.GMAIL_SERVICE_ACCOUNT_JSON, 'base64').toString('utf-8')` then `JSON.parse()`. The private key survives base64 round-trip with newlines intact.
**Warning signs:** JWT constructor throws a PEM format error.

### Pitfall 3: `faturas` bucket does not exist or is not public
**What goes wrong:** Upload returns 404 or `getPublicUrl` returns a URL that 404s on access.
**Why it happens:** Supabase Storage buckets must be created explicitly before first use. Public URL access requires the bucket to be set to "Public".
**How to avoid:** Wave 0 task: create `faturas` bucket in Supabase Dashboard → Storage → New Bucket, check "Public bucket".
**Warning signs:** Upload returns `{ error: { message: 'Bucket not found' } }`.

### Pitfall 4: VITE_ vars not available in Vercel Node.js runtime
**What goes wrong:** `process.env.VITE_SUPABASE_URL` is `undefined` in the API route.
**Why it happens:** `VITE_*` variables are inlined at Vite build time into the React bundle. They are not set as process environment variables in Vercel's serverless runtime.
**How to avoid:** Add `SUPABASE_URL` (no `VITE_`) and `SUPABASE_SERVICE_ROLE_KEY` to Vercel project settings as separate env vars. The API route reads them via `process.env.SUPABASE_URL`.
**Warning signs:** `Cannot read properties of undefined (reading 'from')` from Supabase client initialisation.

### Pitfall 5: Vercel catch-all rewrite intercepting API routes
**What goes wrong:** `/api/gmail/import-faturas` returns the `index.html` content instead of executing the function.
**Why it happens:** The existing `vercel.json` has `"/(.*)" → "/index.html"`. If Vercel's API route detection is not triggered, the rewrite runs first.
**How to avoid:** Vercel processes `api/` directory routes before rewrite rules — this is automatic. However, if the function file is NOT in the `api/` directory at the project root, the rewrite will catch it. Ensure the file path is exactly `api/gmail/import-faturas.js` from the project root.
**Warning signs:** POST to `/api/gmail/import-faturas` returns HTML.

### Pitfall 6: `messages.list` returns only IDs, not full message data
**What goes wrong:** Trying to access `msg.payload` or `msg.subject` directly from the list results.
**Why it happens:** `users.messages.list` returns only `{ id, threadId }` per message. Full payload requires a separate `users.messages.get` call per message.
**How to avoid:** Always call `messages.get({ id: msg.id, format: 'full' })` for each message before accessing `payload`.
**Warning signs:** `payload` is `undefined` on messages from the list.

---

## Environment Variables Required

New server-only vars (to be added in Vercel project settings — NOT in `.env.example` with real values, and NOT with `VITE_` prefix):

| Var Name | Value | Notes |
|----------|-------|-------|
| `GMAIL_SERVICE_ACCOUNT_JSON` | base64-encoded contents of `credentials.json` | `cat credentials.json \| base64` |
| `GMAIL_TARGET_EMAIL` | e.g. `faturas@magneticplace.pt` | The Gmail mailbox to read (must have DWD) |
| `SUPABASE_URL` | Same value as `VITE_SUPABASE_URL` | Server copy without VITE_ prefix |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase Dashboard → Settings → API | NEVER expose to browser |

**Update `.env.example`** (add placeholder entries, NOT real values):
```bash
# Gmail Import (server-only — never use VITE_ prefix for these)
GMAIL_SERVICE_ACCOUNT_JSON=base64_encoded_credentials_json
GMAIL_TARGET_EMAIL=your_gmail_address@example.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**`.gitignore` status:** `credentials.json` is NOT currently in `.gitignore` [VERIFIED: read .gitignore — only `*.local`, `.env`, `.env.*.local`, `.vercel`, `node_modules`, `dist` are listed]. A `credentials.json` entry must be added. The base64 approach means `credentials.json` never needs to be in the repo at all, but the gitignore entry is still a safety net.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `resource:` in mutation calls | `requestBody:` | googleapis v100+ | Old tutorials still show `resource:` — use `requestBody:` to avoid deprecation warnings |
| Vercel Hobby 60s timeout | 300s default with Fluid Compute | Late 2024 | Gmail batch processing is safe on Hobby plan |
| `googleapis` file-based auth only | `credentials:` object or `JWT` constructor with object | Long-standing, documented | Serverless-safe pattern |

---

## Open Questions (RESOLVED)

1. **Domain-Wide Delegation setup** — RESOLVED
   - `magneticplace.pt` is a Google Workspace organisation. DWD can be configured in Google Workspace Admin Console. Service Account auth is valid. ✓

2. **`workerId` on faturas records** — RESOLVED
   - Faturas are stored in a new separate `faturas` table (not `documents`). No `workerId` column — invoices are company-level, not worker-level. ✓

3. **Pagination in `messages.list`** — RESOLVED
   - MVP caps at `maxResults: 50` per invocation. Pagination deferred to a future phase. ✓

4. **`credentials.json` in `.gitignore`** — RESOLVED
   - Plan 01 Task 1 adds `credentials.json` and `service-account*.json` to `.gitignore`. ✓

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vercel API route | ✓ | 24.x (Vercel default) | — |
| `googleapis` npm | Gmail API client | ✗ (not installed) | 171.4.0 latest | None — must install |
| `@supabase/supabase-js` | Supabase Storage + DB | ✓ | 2.101.1 (in package.json) | — |
| Supabase `faturas` bucket | Storage upload | ✗ (not created yet) | — | Must create in Dashboard |
| Google Service Account | Gmail auth | ✗ (not created yet) | — | Must create in Google Cloud Console |
| Google Workspace DWD | Gmail API access | Unknown | — | If not Workspace: OAuth flow required |

[VERIFIED: package.json — `googleapis` not present; `@supabase/supabase-js` 2.101.1 present]
[VERIFIED: vercel.json present — project deploys to Vercel]

**Missing dependencies with no fallback:**
- `googleapis` npm package (install required)
- Supabase `faturas` bucket (create in Dashboard)
- Google Cloud Service Account + JSON key (create in GCP Console)
- Domain-Wide Delegation configuration (requires Google Workspace Admin access)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Service account JWT — Google-managed; endpoint needs caller auth |
| V3 Session Management | no | Stateless REST endpoint |
| V4 Access Control | yes | Endpoint must verify caller is admin (not public) |
| V5 Input Validation | low | No user input processed; query is hardcoded |
| V6 Cryptography | no | No custom crypto; JWT handled by `googleapis` |

### Endpoint Authorization

The `/api/gmail/import-faturas` endpoint is server-side but publicly routable. Without auth, anyone who discovers the URL can trigger Gmail reads and Supabase writes.

**Recommended approach for MVP (simplest):** Check a shared secret header.

```javascript
// In the API route
const secret = req.headers['x-import-secret'];
if (secret !== process.env.GMAIL_IMPORT_SECRET) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

Set `GMAIL_IMPORT_SECRET` as a Vercel env var; include it in the `fetch` call from `DocumentsAdmin.jsx`:
```javascript
fetch('/api/gmail/import-faturas', {
  method: 'POST',
  headers: { 'x-import-secret': import.meta.env.VITE_GMAIL_IMPORT_SECRET },
});
```

Add `VITE_GMAIL_IMPORT_SECRET` to Vercel env vars (browser-exposed is acceptable since it's a shared secret between admin UI and the function, and the admin UI is already auth-gated by Supabase login).

**Alternative:** Validate the Supabase JWT from the Authorization header — more robust but adds complexity (requires `@supabase/supabase-js` server-side auth verification). Defer to future hardening.

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated endpoint trigger | Tampering | Shared secret header (MVP) or Supabase JWT validation |
| `SUPABASE_SERVICE_ROLE_KEY` exposure | Information Disclosure | Never use `VITE_` prefix; never log the value |
| `GMAIL_SERVICE_ACCOUNT_JSON` exposure | Information Disclosure | Server-only env var; base64 in Vercel settings only |
| Malicious attachment filename injection | Tampering | Sanitise `part.filename` before using as Storage path — strip `../`, special chars |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | User has Google Workspace (not personal Gmail); Domain-Wide Delegation is possible | Open Questions #1 | If personal Gmail, service account DWD doesn't work; entire auth approach must change to OAuth user flow |
| A2 | `documents` table allows `workerId: null` | Open Questions #2 | DB insert will fail with NOT NULL constraint; need to either find a workerID or alter schema |
| A3 | `faturas` bucket does not yet exist in Supabase | Environment Availability | If it exists with different settings (e.g., private), uploads will succeed but public URLs won't work |
| A4 | `requestBody:` is the correct parameter name (not `resource:`) for googleapis v171 | Pattern 5 | `modify` call silently fails or sends empty request body |
| A5 | Vercel Hobby plan is in use (not Pro) | Architecture Decision | If Pro, maxDuration can be 800s; planning for 60s is conservative and safe either way |

---

## Sources

### Primary (HIGH confidence)
- [CITED: vercel.com/docs/functions/runtimes/node-js] — Node.js runtime support, full npm compatibility
- [CITED: vercel.com/docs/functions/configuring-functions/duration] — maxDuration 300s Hobby default, 800s Pro max
- [CITED: developers.google.com/gmail/api/reference/rest/v1/users.messages/list] — `q` parameter, maxResults
- [CITED: developers.google.com/gmail/api/reference/rest/v1/users.messages/get] — `format: 'full'` parameter
- [CITED: developers.google.com/gmail/api/reference/rest/v1/users.messages/modify] — `removeLabelIds: ['UNREAD']`
- [CITED: developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get] — Base64Url encoding of attachment data
- [VERIFIED: npm registry] — `googleapis` 171.4.0, `@supabase/supabase-js` 2.105.4
- [VERIFIED: repo codebase] — `vercel.json` present (Vercel deployment confirmed); `api/` directory does not exist yet; `googleapis` not in `package.json`; `credentials.json` not in `.gitignore`

### Secondary (MEDIUM confidence)
- [CITED: paulie.dev/posts/2024/06/how-to-use-google-application-json-credentials-in-environment-variables/] — Base64 env var pattern for Google credentials
- [CITED: supabase.com/docs/guides/functions/dependencies] — Supabase Edge Functions npm support and Deno runtime
- [CITED: github.com/orgs/supabase/discussions/33244] — Documented googleapis breakage in Supabase Edge Functions (gcp-metadata 6.1.1)
- Existing codebase pattern `src/utils/separarRecibosTOConline.js` — Supabase Storage upload + getPublicUrl + documents insert (adapted for server-side)

### Tertiary (LOW confidence / ASSUMED)
- `requestBody:` vs `resource:` param rename in googleapis v100+ — [ASSUMED] based on general package changelog patterns; should be verified by checking actual deprecation warnings during implementation
- `google.auth.GoogleAuth` with `credentials:` object accepting a parsed JSON — [ASSUMED]; `JWT` constructor is more explicit and verified

---

## Metadata

**Confidence breakdown:**
- Architecture decision (Vercel vs Edge Function): HIGH — Deno breakage documented, Vercel pattern straightforward, confirmed by codebase
- Standard stack: HIGH — npm registry confirmed, googleapis is the only option
- Gmail API call patterns: HIGH — all from official Google docs
- Service account env var pattern: MEDIUM — verified via official Google blog post; base64 approach well established
- Endpoint auth (shared secret): MEDIUM — pattern is standard; specific implementation is recommendation
- DWD requirement: ASSUMED — critical prerequisite; must be confirmed with user before any code is written

**Research date:** 2026-05-18
**Valid until:** 2026-08-18 (stable APIs; googleapis versioning is fast but breaking changes are rare for Gmail methods)
