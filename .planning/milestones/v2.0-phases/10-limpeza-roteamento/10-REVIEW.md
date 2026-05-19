---
phase: 10-limpeza-roteamento
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/components/common/CompanyLogo.jsx
  - src/components/common/EntryForm.jsx
  - src/components/common/WorkerDocuments.jsx
  - src/components/common/ClientTimesheetReport.jsx
  - src/components/common/index.js
  - src/features/auth/LoginView.jsx
  - src/features/auth/index.js
  - src/features/admin/FinancialReportOverlay.jsx
  - src/features/admin/DocumentsAdmin.jsx
  - src/features/admin/NotificationsAdmin.jsx
  - src/features/admin/AdminDashboard.jsx
  - src/features/admin/index.js
  - src/features/worker/WorkerDashboard.jsx
  - src/app.jsx
findings:
  critical: 4
  warning: 6
  info: 4
  total: 14
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-05-09
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

This phase extracted components from a monolithic `app.jsx` into feature-based directories. The structural refactoring is largely correct — imports resolve, barrel files are consistent, and the component API boundaries are preserved. However the review found four BLOCKERs: hardcoded third-party API credentials in source code, a dead supabase reference pattern in `DocumentsAdmin`, an XSS vector via unsandboxed `srcDoc` iframe, and `dangerouslySetInnerHTML` on user-influenced CSS. Six warnings cover a stale dependency array, app.jsx passing empty arrays that silently override context data, unhandled async rejections, and logic edge cases.

---

## Critical Issues

### CR-01: Hardcoded EmailJS credentials in app.jsx

**File:** `src/app.jsx:176-178`
**Issue:** Three EmailJS credentials (`EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`) are hardcoded as string literals inside `handleDisparoEmail`. These credentials are also duplicated in `src/utils/emailUtils.js:4-6`. Because this is a Vite SPA, these values are included verbatim in the public JS bundle and visible to any user who opens DevTools. An attacker can use the public key and service ID to send unlimited emails from the account, impersonating the company.

**Fix:** Move all three identifiers to environment variables and import them from the shared util. Remove the local copies in `handleDisparoEmail` and use the already-exported constants from `emailUtils.js`:

```js
// src/utils/emailUtils.js
export const EMAILJS_SERVICE_ID    = import.meta.env.VITE_EMAILJS_SERVICE_ID;
export const EMAILJS_TEMPLATE_ID   = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_MAIN;
export const EMAILJS_PUBLIC_KEY    = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

// src/app.jsx — remove local consts, import from util
import { EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY } from './utils/emailUtils';
// use a separate env var for this template ID
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_MAIN;
```

Note: the EmailJS public key is intentionally client-side in many integrations, but the service ID and template IDs should be kept in `.env` to prevent account enumeration and quota abuse.

---

### CR-02: DocumentsAdmin bypasses React context to obtain Supabase — silently fails when window global is absent

**File:** `src/features/admin/DocumentsAdmin.jsx:14`
**Issue:** The component reads Supabase via `window.supabaseInstance` instead of `useApp()`. If the global is not yet set (race on mount, SSR, or future test environment), `clientSupabase` is `null`. The upload path already has a guard (`if (!clientSupabase) return alert(...)`), but `handleDeleteDoc` at line 87 calls `clientSupabase.storage.from(...)` unconditionally — if `clientSupabase` is null, this throws `TypeError: Cannot read properties of null`. This is a data-loss path: a user clicking "Delete" on a record when the global is transiently null will get an unhandled exception rather than a friendly error, and the UI does not recover gracefully.

Additionally, all other extracted components correctly call `useApp()` for Supabase. The inconsistency was introduced during extraction and is a maintenance hazard — future refactors will not know to update the window global.

**Fix:**
```jsx
// Replace line 14:
// const clientSupabase = typeof window !== 'undefined' ? window.supabaseInstance : null;

import { useApp } from '../../context/AppContext';

const DocumentsAdmin = ({ workers = [], documents = [], setDocuments }) => {
  const { supabase: clientSupabase } = useApp();
  // rest unchanged
```

Then add a null guard at the top of `handleDeleteDoc`:
```js
const handleDeleteDoc = async (doc) => {
  if (!clientSupabase) return alert('Conexão indisponível. Actualize a página.');
  // ...
```

---

### CR-03: Unsandboxed srcDoc iframe renders arbitrary stored HTML without script restriction

**File:** `src/components/common/WorkerDocuments.jsx:584`
**Issue:** The document preview iframe uses `srcDoc={selectedDoc.generated_html}` with `sandbox="allow-same-origin"`. `allow-same-origin` alone grants the iframe the same origin as the parent page, meaning any JavaScript embedded in `generated_html` that was stored by an admin (or injected via a compromised template) can access `window.parent`, read parent-frame cookies/localStorage, and call parent-frame APIs. The `allow-scripts` attribute is absent, which prevents inline `<script>` tags from running — however, `allow-same-origin` without `allow-scripts` is still a known risk: an attacker can use HTML event handlers (`<img onerror=...>`) or meta-refresh redirects, and if `allow-scripts` is accidentally added later the entire app session token becomes readable.

**Fix:** Remove `allow-same-origin` or replace with a safe combination. Since this is a read-only preview, no same-origin access is needed:

```jsx
<iframe
  srcDoc={selectedDoc.generated_html}
  sandbox=""           {/* or: sandbox="allow-same-origin allow-scripts" only if Tailwind CDN is required for styling */}
  className="w-full h-full rounded-xl"
  title="Document Preview"
/>
```

If the template HTML requires Tailwind CDN scripts to render correctly, use `sandbox="allow-scripts"` (without `allow-same-origin`) — this executes scripts in an opaque origin and prevents parent-frame access.

---

### CR-04: dangerouslySetInnerHTML injects user-influenced CSS into the DOM

**File:** `src/components/common/ClientTimesheetReport.jsx:273`
**File:** `src/features/auth/LoginView.jsx:159`
**Issue:** Both components inject a `<style>` block via `dangerouslySetInnerHTML`. In `ClientTimesheetReport`, the injected CSS references class names that are data-driven (e.g., `.zip-export-mode`) but the CSS itself is a static string, so it is low-risk as written. In `LoginView`, the injected CSS is also fully static. **The risk here is forward-looking and architectural**: `dangerouslySetInnerHTML` on `<style>` is flagged because if any part of the injected string ever interpolates a prop or state value (e.g., a company name, a color preference from `systemSettings`), it becomes a CSS injection vector where a crafted value like `</style><script>` would break out of the style block. `ClientTimesheetReport` already reads `systemSettings` elsewhere; the pattern is one refactor away from being exploitable.

**Fix for LoginView:** Move the `@keyframes bounce-subtle` animation to the Tailwind config or a static CSS file — it is always the same string.

**Fix for ClientTimesheetReport:** Same — the entire `<style>` block contains no dynamic values and should be in a static `.css` file imported at the module level. This eliminates the `dangerouslySetInnerHTML` entirely.

---

## Warnings

### WR-01: app.jsx passes `schedules: []` and `personalSchedules: []` as hard-coded empty arrays to WorkerDashboard — but WorkerContext reads these from AppContext, not props

**File:** `src/app.jsx:332`
**Issue:** The `WorkerDashboard` spread at line 332 includes `schedules: []` and `personalSchedules: []`. `WorkerDashboard` itself only accepts `onLogout`, `onLogin`, and `handleSaveEntry` (line 581 of WorkerDashboard.jsx); all other data is sourced from `AppContext` via `WorkerProvider`. The empty arrays in the spread are silently ignored today, but they create a false impression that schedules are being passed down as props. If a future developer (or this one during a merge) ever plumbs these arrays through as actual props, workers will see no schedules, their default schedule will not resolve, and time-tracking expectations will be broken with no error or warning.

**Fix:** Remove `schedules: []` and `personalSchedules: []` from the spread to eliminate the misleading dead props:
```jsx
<WorkerDashboard
  onLogout={handleLogout}
  onLogin={handleLogin}
  handleSaveEntry={handleSaveEntry}
/>
```

---

### WR-02: useEffect in app.jsx has a stale/incomplete dependency array — viewed_by notification update runs only on mount

**File:** `src/app.jsx:120-130`
**Issue:** The `useEffect` that marks notifications as viewed by the current user lists only `[currentUser?.id]` in its dependency array, despite using `myNotifications`, `supabase`, and `currentUser` inside the callback. If `myNotifications` changes after mount (new notifications arrive via realtime), the effect will not re-run and new notifications will not be marked as viewed until the user logs out and back in.

**Fix:**
```js
useEffect(() => {
  if (!currentUser || !myNotifications.length) return;
  myNotifications.forEach(async (notif) => {
    const viewedIds = notif.viewed_by_ids || [];
    if (!viewedIds.includes(currentUser.id) && supabase) {
      await supabase.from('app_notifications')
        .update({ viewed_by_ids: [...viewedIds, currentUser.id] })
        .eq('id', notif.id);
    }
  });
}, [currentUser?.id, myNotifications, supabase]);
```

---

### WR-03: handleAiPolish in EntryForm does not handle callGemini errors — UI silently leaves old text on error

**File:** `src/components/common/EntryForm.jsx:17-27`
**Issue:** `handleAiPolish` calls `callGemini` and then immediately calls `onChange({ ...data, description: res.trim() })` without checking whether `res` contains an error string. `callGemini` returns error messages as plain strings (e.g., `"Erro API (429): ..."`) rather than throwing exceptions. If the API fails, the description field is overwritten with the error message, destroying the user's original text.

**Fix:** Check that the response does not look like an error before overwriting:
```js
const handleAiPolish = async () => {
  if (!data.description) return;
  setIsImproving(true);
  try {
    const res = await callGemini(..., systemSettings?.geminiApiKey);
    // callGemini returns error text starting with "Erro" or "A IA precisa..."
    if (res && !res.startsWith('Erro') && !res.startsWith('A IA') && !res.startsWith('Ocorreu')) {
      onChange({ ...data, description: res.trim() });
    } else {
      alert(res); // show error without overwriting
    }
  } finally {
    setIsImproving(false);
  }
};
```

---

### WR-04: generateInsight in FinancialReportOverlay has no try/catch — an API failure leaves isAnalyzing stuck at true

**File:** `src/features/admin/FinancialReportOverlay.jsx:27-33`
**Issue:** `generateInsight` calls `callGemini` without a try/catch. Because `callGemini` itself swallows network errors and returns a string, this particular call will not throw. However, `setIsAnalyzing(false)` is only called on the happy path. If an exception ever propagates (e.g., a future refactor changes `callGemini`), the "Analisando..." spinner becomes permanently stuck and the button is permanently disabled.

**Fix:** Wrap in try/finally:
```js
const generateInsight = async () => {
  setIsAnalyzing(true);
  try {
    const res = await callGemini(prompt, "...", systemSettings.geminiApiKey);
    setInsight(res);
  } finally {
    setIsAnalyzing(false);
  }
};
```

---

### WR-05: NotificationsAdmin — appNotifications list filters out inactive notifications but the toggle button still shows them; unrelated, handleAdd does not reset the `type` and `targetType` fields after creation

**File:** `src/features/admin/NotificationsAdmin.jsx:146-148`
**Issue 1 (logic):** The existing notifications list at line 146 filters to `n.is_active === true`. This means that when an admin pauses a notification via the `toggleStatus` button, the item immediately disappears from the list. The admin has no way to see or re-activate paused notifications — they are hidden forever in the UI. This is a usability defect that can lead an admin to create duplicate notifications believing the original was deleted.

**Issue 2 (state hygiene):** After `handleAdd` completes (line 35), `setTitle('')` and `setMessage('')` are reset but `type`, `targetType`, `isDismissible`, and `targetType` are not. The form visually shows its previous values. Minor, but the next notification created will inherit the previous `type` silently.

**Fix for Issue 1:** Remove the `n.is_active` filter from the list, or add a separate "show inactive" toggle, and show a distinct visual state for paused items.

**Fix for Issue 2:**
```js
setTitle('');
setMessage('');
setType('info');
setTargetType('all');
setIsDismissible(true);
setSelectedWorkers([]);
```

---

### WR-06: WorkerDocuments — duplicate document entries possible because pendentes/historico merge two separate sources without deduplication

**File:** `src/components/common/WorkerDocuments.jsx:82-89`
**Issue:** `pendentes` is built by concatenating `docs.filter(isPending)` (from the `documents` prop, which comes from the `documents` Supabase table) with `templateDocs.filter(isPending)` (from the `worker_documents` Supabase table). If a document record exists in both tables with the same logical identity — possible if data was migrated or a bug caused double-insert — it will appear twice in the list with the same `doc.id`, causing a React key collision and a duplicate sign button. The same applies to `historico`.

**Fix:** Deduplicate by `id` after concat:
```js
const pendentes = useMemo(() => {
  const combined = docs.filter(d => isPending(d.status))
    .concat(templateDocs.filter(d => isPending(d.status)));
  return [...new Map(combined.map(d => [d.id, d])).values()];
}, [docs, templateDocs]);
```

---

## Info

### IN-01: CompanyLogo uses a relative image path that will break when served from a subdirectory

**File:** `src/components/common/CompanyLogo.jsx:3`
**Issue:** `src="MAGNETIC (3).png"` is a bare relative path with no leading `/`. In Vite, public-folder assets should be referenced as `/MAGNETIC (3).png` (absolute from the public root). If the app is ever deployed at a subpath (e.g., `/app/`), or if `CompanyLogo` is rendered in a context where the browser's base URL differs from `/`, the image will 404. The `onError` fallback to ui-avatars.com masks this silently.

**Fix:**
```jsx
src="/MAGNETIC (3).png"
```

Additionally the filename contains spaces, which can cause issues with some servers/CDNs. Rename to `magnetic-logo.png` and update both references (CompanyLogo.jsx and app.jsx line 61).

---

### IN-02: LoginView — `console.log` left in production code

**File:** `src/app.jsx:137`
**Issue:** `console.log('Auto-descartando notificações...')` is in the production `useEffect`. Minor, but it leaks internal implementation details.

**Fix:** Remove the `console.log` call.

---

### IN-03: AdminDashboard — `valSortConfig` state is initialised but never used

**File:** `src/features/admin/AdminDashboard.jsx:71`
**Issue:** `const [valSortConfig, setValSortConfig] = useState(...)` is declared but neither `valSortConfig` nor `setValSortConfig` appears anywhere else in the file. This is dead state left from the extraction refactor.

**Fix:** Delete the declaration:
```js
// Remove this line:
const [valSortConfig, setValSortConfig] = useState({ key: 'name', direction: 'asc' });
```

---

### IN-04: AdminDashboard — `aggregatedTrend.percent != 0` uses loose equality, masking a string/number comparison ambiguity

**File:** `src/features/admin/AdminDashboard.jsx:412` and `453`
**Issue:** `aggregatedTrend.percent` is set via `.toFixed(1)` which returns a **string** (e.g., `"0.0"`). The comparisons `aggregatedTrend.percent != 0` use loose equality, which coerces `"0.0"` to `0` correctly in this case, but `Number(aggregatedTrend.percent) >= 0` at line 413 works correctly because `Number("0.0")` is `0`. The inconsistency between returning a string from `toFixed` but comparing with `Number(...)` is confusing. `"0.0" != 0` is `false` (loose equality coerces), so this accidentally works, but it would break if the value were ever `"0"` vs `0`.

**Fix:** Return a number from `aggregatedTrend`:
```js
percent: parseFloat(((totalRegistered - totalExpected) / totalExpected * 100).toFixed(1)),
```
Then the comparisons `percent !== 0` and `percent >= 0` are unambiguous.

---

_Reviewed: 2026-05-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
