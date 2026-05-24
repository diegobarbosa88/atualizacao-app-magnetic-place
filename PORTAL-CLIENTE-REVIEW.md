---
phase: portal-cliente-review
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/ClientPortal.jsx
  - src/app.jsx
  - src/components/common/ClientPortalNavbar.jsx
  - src/features/worker/WorkerDashboard.jsx
findings:
  critical: 7
  warning: 8
  info: 4
  total: 19
status: issues_found
---

# Portal Cliente: Code Review Report

**Reviewed:** 2026-05-22
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

The four files implement a client-facing portal with login, dashboard, history, and a month-validation/signature flow, plus the worker dashboard with GPS check-in. The codebase is functional and reasonably structured, but several issues were found ranging from a broken JSX render path that makes the entire portal invisible after login, a client-side-only authentication mechanism that is trivially bypassed, a hardcoded feature flag that leaks a real person's full name, a `ReferenceError` crash in a production submission path, and multiple stale-closure / missing-dependency warnings that cause incorrect data to be presented after state changes.

---

## Critical Issues

### CR-01: Entire portal body is unreachable — `return` statement inside JSX expression

**File:** `src/ClientPortal.jsx:1591`

**Issue:** After the notification banner block (line 1559–1590), the code writes a bare `return (` statement inside what is already a JSX expression. JSX does not allow JavaScript `return` statements inside its body. The compiler treats line 1591 as an expression statement that evaluates to `undefined`, and the entire `<main>` block from line 1592 to 1903 is dead code that is never rendered. The actual JSX closing `</div>` at line 1931 closes the wrapping div opened at line 1557, so the component compiles without a hard error, but the logged-in portal renders as a blank page.

**Fix:** Replace the bare `return (` on line 1591 and its matching `) : (` (line 1897) / closing `)` (line 1903) with a conditional expression inline inside the wrapping div. The structure should be:

```jsx
<div className={...}>
  {/* notifications banner */}
  {!printingWorker ? (
    <main className="max-w-6xl mx-auto px-4 md:px-8 mt-12">
      ...
    </main>
  ) : (
    <div className="w-full bg-white flex justify-center items-center min-h-screen">
      ...
    </div>
  )}
  <style ... />
</div>
```

---

### CR-02: Client authentication is client-side only — trivially bypassed

**File:** `src/ClientPortal.jsx:74-88`

**Issue:** The `handleLogin` function verifies credentials by iterating the `clients` array that was passed as a prop. This means all client records (including NIF and email of every client) are downloaded to the browser before login. An unauthenticated user can open DevTools, read the React component tree or the Supabase network responses, extract any client's NIF, and log in as them. There is no server-side session, no token, no rate-limiting, and no brute-force protection. The 30-day localStorage session stores only `{ clientId, name, expiry }` — an attacker can forge any session by writing directly to `localStorage`.

**Fix:** Authentication for the client portal must be server-side. Options in ascending complexity:
1. Issue a short-lived signed JWT from a Supabase Edge Function after verifying NIF+email server-side. Store only the JWT, not the raw `clientId`.
2. At minimum, do not load the full `clients` list until after login is verified server-side. Never expose NIF or email of other clients to the browser.

---

### CR-03: `ReferenceError: notifId is not defined` — crashes on correction submission

**File:** `src/ClientPortal.jsx:1492`

**Issue:** Inside the "Confirmar e Enviar" button's inline `onClick` handler (the `renderReverAlteracoes` path for the non-`correctionMode === 'manual'` branch), `newNotifWithCorrecaoId` is saved with `saveToDb('app_notifications', notifId, ...)` but `notifId` was never declared in that scope. The variable `newNotif.id` was set to `"notif_" + Date.now()` on line 1463 but was not assigned to any `const notifId`. This will throw a `ReferenceError` at runtime when the user clicks "Confirmar e Enviar" in the review screen.

**Fix:**
```js
// Line 1463, change:
id: "notif_" + Date.now(),
// to:
id: notifId,
// and declare above:
const notifId = "notif_" + Date.now();
const newNotif = { id: notifId, ... };
```

---

### CR-04: `handleAcceptContestation` uses `clientData` before it is stable — stale closure crash

**File:** `src/ClientPortal.jsx:274`

**Issue:** `handleAcceptContestation` references `clientData` (line 274) which is a `useMemo` value. However, at the point this function is defined (line 226), `clientData` is captured by closure from the outer scope. The function is never wrapped in `useCallback`, so it does not re-create when `clientData` changes. More critically, the function builds the admin notification title using `clientData.name` and `clientData.period`. If `clientData` has not yet resolved (e.g. `effectiveClientId` is null on first render because `clientSession` is being read from localStorage), `clientData` will be `{ name: 'Cliente Não Encontrado', period: undefined }`, and the notification sent to the admin will contain wrong data.

**Fix:** Move `handleAcceptContestation` to after the `clientData` memo, or add `clientData` and `clientSession` to a `useCallback` dependency array.

---

### CR-05: Supabase `todayLogs` fetch ignores errors — silent data loss

**File:** `src/ClientPortal.jsx:119-127` and `131-139`

**Issue:** Both `useEffect` hooks that fetch `todayLogs` from Supabase use `.then(({ data }) => setTodayLogs(data || []))` without destructuring or handling `error`. If the Supabase query fails (RLS denial, network error), `data` will be `null` and `error` will be set, but the error is silently swallowed and the UI shows "Sem registos" as if the day has no entries.

**Fix:**
```js
.then(({ data, error }) => {
  if (error) {
    console.error('[ClientPortal] todayLogs fetch error:', error);
    return; // keep stale state rather than replacing with empty
  }
  setTodayLogs(data || []);
});
```

---

### CR-06: `isDirectAccess` flag bypasses login entirely with no server-side validation

**File:** `src/ClientPortal.jsx:98`, `src/app.jsx:296-298`

**Issue:** When `?client=X&month=Y` URL parameters are present and there is no `clientSession`, `isDirectAccess` is set to `true` (line 98) and `renderLogin()` is skipped (line 1552). Any anonymous user who knows or guesses a client ID and a month string gains full access to that client's hours data, signature canvas, and can submit approvals on behalf of the client. The URL parameters are taken directly from `window.location.search` with no validation beyond existence. Client IDs are typically sequential integers or UUIDs which are guessable/enumerable.

**Fix:** Remove or gate `isDirectAccess`. If the intent is a "magic link" feature, generate a signed, single-use token server-side and validate it server-side before granting access. Never accept a raw `clientId` from the URL as proof of authorization.

---

### CR-07: GPS feature-flag hardcodes a real employee's full name

**File:** `src/features/worker/WorkerDashboard.jsx:106`, `291`

**Issue:** Two separate locations hardcode a real person's full name as a string literal to gate the GPS check-in feature:

```js
// Line 106:
if (!currentUser.name?.toLowerCase().includes('diego rocha barbosa') && !currentUser.name?.toLowerCase().includes('trabalhador teste')) return;
// Line 291:
const gpsCheckInEnabled = currentUser?.name?.toLowerCase().includes('diego rocha barbosa');
```

This exposes a real person's identity in source code and in the compiled JavaScript bundle served to every user. Additionally, the two checks are inconsistent: line 106 also enables GPS for 'trabalhador teste' but line 291 does not, meaning the `geoSuggestion` card populates for 'trabalhador teste' but `gpsCheckInEnabled` is false, so the "Em serviço" card is never shown for that user even when there is an open log.

**Fix:** Add a boolean field (e.g. `gps_enabled: true`) to the worker record in Supabase. Replace both hardcoded conditions with `currentUser?.gps_enabled === true`. This removes PII from source code and fixes the inconsistency.

---

## Warnings

### WR-01: `originalWorkersData` memo depends on `initialClientId`/`initialMonth` but uses `effectiveClientId`/`selectedMonth`

**File:** `src/ClientPortal.jsx:328-346`

**Issue:** The `originalWorkersData` useMemo dependency array lists `[logs, workers, initialClientId, initialMonth]` (line 346) but the computation filters by `effectiveClientId` and `selectedMonth`. When the user logs in via the login form (not direct access), `effectiveClientId = clientSession.clientId` and `selectedMonth` is chosen from the navbar. Changes to `selectedMonth` do not trigger a recompute because it is not in the dependency array. The report will show stale month data.

**Fix:**
```js
}, [logs, workers, effectiveClientId, selectedMonth]);
```

---

### WR-02: `useEffect` for `lastRealtimeUpdate` missing dependencies — stale closure

**File:** `src/ClientPortal.jsx:130-140`

**Issue:** The effect at lines 130–140 references `currentView`, `supabase`, and `initialClientId` inside its callback but only declares `[lastRealtimeUpdate]` as dependencies. If `currentView` changes after the effect is registered, the effect still executes with the old captured value, meaning real-time updates may trigger a DB fetch when the view is not 'hoje'.

**Fix:**
```js
}, [lastRealtimeUpdate, currentView, supabase, initialClientId]);
```

---

### WR-03: `startReport` uses `initialMonth` instead of `selectedMonth`

**File:** `src/ClientPortal.jsx:498`

**Issue:** `startReport` calls `getAllMonthDates(initialMonth)` where `initialMonth` is the URL parameter (only set in direct-access mode). When a logged-in session user navigates to a different month via the navbar, `selectedMonth` is updated but `startReport` continues to build edit data for the original URL month, not the currently displayed month.

**Fix:** Replace `initialMonth` with `selectedMonth` in `startReport`:
```js
const allDates = getAllMonthDates(selectedMonth);
```
And update `handlePrecisionConfirm` and related functions consistently.

---

### WR-04: `handleTimeChange` matches day by `d.date` (display label), not by `rawDate`

**File:** `src/ClientPortal.jsx:559`

**Issue:** `handleTimeChange` finds the day record with `d.date === dateStr`. The `date` field on draft records is a human-readable label like `"02/05 (Sáb)"`, not an ISO date. `PrecisionReportReview` calls `onEditDay(workerId, dayDate, ...)` — if `dayDate` is passed as a display label this works; if it is passed as a `rawDate`, edits silently fail and the draft is not updated.

**Fix:** Standardize on `rawDate` as the matching key throughout the editing pipeline:
```js
if (d.rawDate === dateStr) { ... }
```

---

### WR-05: `handleLogin` in `ClientPortal` does not guard against `clients` being empty mid-load

**File:** `src/ClientPortal.jsx:75`

**Issue:** `if (clients.length === 0) return;` exits silently when the clients list is still loading. The user sees no feedback — the login button appears to do nothing. If there is a network error loading clients, login becomes permanently impossible with no error message.

**Fix:** Separate the "loading" state from the "empty" state. Show a spinner if clients have not yet loaded, and an error message if loading failed.

---

### WR-06: `myNotifications` in `ClientPortalNavbar` comes from `useApp()` context — wrong source

**File:** `src/components/common/ClientPortalNavbar.jsx:22`

**Issue:** The navbar calls `const { myNotifications } = useApp()`. The `AppContext` `myNotifications` is filtered for the logged-in *admin/worker* user (`currentUser`), not for the current client session. The client portal has its own `myNotifications` computed in `ClientPortal.jsx` (lines 211–224) that correctly filters for `initialClientId`. The navbar therefore either shows no notifications or shows admin/worker notifications to the client.

**Fix:** Pass the correctly filtered `myNotifications` as a prop to `ClientPortalNavbar` rather than reading it from the shared context.

---

### WR-07: `dismissedNotifs` keyed on `initialClientId` at init time — wrong key on login-flow

**File:** `src/ClientPortal.jsx:205-209`

**Issue:** The `dismissedNotifs` state initializer reads `localStorage.getItem(`dismissed_client_notifs_${initialClientId}`)`. In the login flow (non-direct-access), `initialClientId` is null at initialization because the user has not logged in yet. The correct key for the logged-in client (`clientSession.clientId`) is never read. Dismissed notifications reappear every time the client logs in.

**Fix:** Initialize from `effectiveClientId`, but since that is derived state, use an effect to re-load dismissed notifications after login:
```js
useEffect(() => {
  if (!effectiveClientId) return;
  try {
    setDismissedNotifs(JSON.parse(localStorage.getItem(`dismissed_client_notifs_${effectiveClientId}`) || '[]'));
  } catch { setDismissedNotifs([]); }
}, [effectiveClientId]);
```

---

### WR-08: Canvas `<style>` injection via `useEffect` appends new style tag on every remount

**File:** `src/ClientPortal.jsx:576-590`

**Issue:** The effect at lines 576–590 creates a new `<style>` element and appends it to `document.head` every time `ClientPortal` mounts. The cleanup function removes it on unmount. However, if React renders the component in `StrictMode` (double-invocation in development) or if the component remounts due to a parent re-render, multiple identical style tags accumulate. In production this is benign but creates unnecessary DOM noise. The `dangerouslySetInnerHTML` style on lines 1905–1930 is a better pattern (already used for print CSS) and should replace this.

**Fix:** Move the animation CSS to a static CSS file or to the existing `dangerouslySetInnerHTML` style block. Remove the `useEffect` that injects the style tag.

---

## Info

### IN-01: `portalMonth` in `app.jsx` is inconsistent with `currentMonth`

**File:** `src/app.jsx:90`

**Issue:** `app.jsx` maintains both `currentMonth` (from context) and a local `portalMonth` state. The email modal at line 406 uses `currentMonth` for the month string, but `handleDisparoEmail` at line 201 uses `portalMonth`. These can diverge and the wrong month may appear in the email subject or the hours summary.

**Fix:** Use one source of truth for the month. If the portal tab has its own month selector, derive the email month from `portalMonth` consistently everywhere.

---

### IN-02: `handleDisparoEmail` sums all log hours ignoring selected month filter

**File:** `src/app.jsx:425`

**Issue:** In the email preview modal (line 425), total hours are computed by `logs.filter(l => l.clientId === clienteSelecionado.id).reduce(...)` — without filtering by month. The preview shows the all-time total, not the current month's total. The same filter in `handleDisparoEmail` (line 203) does filter by month, so the email template receives the correct number but the modal preview shows a misleading figure.

**Fix:**
```js
// In the modal preview (line 425), apply the same month filter:
const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
logs.filter(l => l.clientId === clienteSelecionado.id && l.date?.substring(0, 7) === monthStr).reduce(...)
```

---

### IN-03: IP fetched from unauthenticated third-party API

**File:** `src/ClientPortal.jsx:199-203`

**Issue:** The client IP is fetched from `https://api.ipify.org` — an unauthenticated third-party service. If this service is unavailable or returns an unexpected format, the IP stored on the approval record will be null or garbage (the `.catch` sets nothing). The IP is also only useful as a forensic hint; it is not suitable as an authentication signal.

**Fix:** Accept that IP logging is best-effort. Add explicit null handling: store `'N/D'` on failure rather than relying on `clientIp || 'N/D'` which may still be the stale default `'Localhost'` if the fetch has not resolved yet when the user signs.

---

### IN-04: Debug/test references to specific worker names in production code

**File:** `src/features/worker/WorkerDashboard.jsx:291`

**Issue:** (Related to CR-07, flagged separately for the test-mode framing.) The comment on line 290 reads `// GPS check-in/out só activo para Diego Rocha Barbosa (fase de teste)`. Test-phase feature flags belonging to individual users should never reach the main branch in production. This indicates an incomplete feature rollout process.

**Fix:** Track feature enablement in the database (as described in CR-07) and remove all hardcoded names and test-phase comments before shipping.

---

_Reviewed: 2026-05-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
