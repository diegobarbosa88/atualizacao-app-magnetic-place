---
phase: deep-code-review
reviewed: 2026-05-29T00:00:00Z
depth: deep
files_reviewed: 52
files_reviewed_list:
  - src/app.jsx
  - src/main.jsx
  - src/ClientPortal.jsx
  - src/context/AppContext.jsx
  - src/features/auth/LoginView.jsx
  - src/features/auth/index.js
  - src/features/worker/WorkerDashboard.jsx
  - src/features/worker/contexts/WorkerContext.jsx
  - src/features/admin/AdminDashboard.jsx
  - src/features/admin/ValidationPortal.jsx
  - src/features/admin/contexts/ValidationPortalContext.jsx
  - src/features/admin/corrections/CorrectionsInbox.jsx
  - src/components/common/EntryForm.jsx
  - src/components/common/ClientTimesheetReport.jsx
  - src/components/common/WorkerDocuments.jsx
  - src/components/common/VerificationPortal.jsx
  - src/utils/emailUtils.js
  - src/utils/aiUtils.js
  - src/utils/cloudConvertService.js
  - src/utils/pdfSigningService.js
  - src/utils/signatureCanvas.js
  - src/utils/formatUtils.js
  - src/utils/dateUtils.js
  - src/utils/geoUtils.js
  - src/utils/docxTemplateService.js
  - src/utils/reconciliacaoSalarialEngine.js
  - src/utils/templateFields.js
  - src/utils/oklchUtils.js
  - src/utils/timesheetTemplateService.js
  - src/utils/notifParser.js
  - src/utils/deviceUtils.js
  - src/utils/pdfCoService.js
  - src/utils/dragPreviewUtils.js
  - src/utils/correctionsApi.js
  - src/utils/toggleTipoLink.js
  - src/utils/validarReciboTOConline.js
  - src/utils/separarRecibosTOConline.js
  - src/utils/aiUtils.js
  - src/hooks/useSignatureStamp.jsx
  - src/hooks/useDocumentTemplates.js
  - src/hooks/useEditDraft.js
  - src/features/worker/index.js
  - src/features/admin/index.js
  - src/features/admin/TeamManager.jsx
  - src/features/admin/ClientManager.jsx
  - src/features/admin/MovimentacoesTab.jsx
  - src/features/admin/SalariosTab.jsx
  - src/features/admin/ScheduleManager.jsx
  - src/features/admin/EntradasTab.jsx
  - src/features/admin/FaturasTab.jsx
  - src/features/admin/CostReports.jsx
  - src/features/admin/DocumentsAdmin.jsx
findings:
  critical: 5
  warning: 11
  info: 14
  total: 30
status: issues_found
---

# Phase: Deep Code Review Report

**Reviewed:** 2026-05-29
**Depth:** deep (cross-file analysis including import graphs and call chains)
**Files Reviewed:** 52 (.js and .jsx files in src/)
**Status:** issues_found

## Summary

Reviewed all 52 source files in src/ at deep depth, tracing cross-file dependencies and import chains. The codebase implements a full HR/timesheet management system with admin dashboard, worker portal, client portal, document signing, and PDF generation. Multiple critical security vulnerabilities were identified, primarily around authentication, credential handling, and API key exposure. Several bugs relate to race conditions, error handling, and data consistency. Code quality issues include deep prop drilling, magic strings, and complex conditional logic.

**Critical issues requiring immediate fixes before production deployment.**

---

## Critical Issues

### CR-01: Admin Authentication Bypass — Empty Default Password

**File:** `src/context/AppContext.jsx:16-23`
**Issue:** The default `adminPassword` is set to an empty string `''`. The admin login check in `LoginView.jsx:48` compares `pass.trim() === systemSettings.adminPassword`. When adminPassword is empty (default), ANY password passes authentication.

```javascript
// AppContext.jsx lines 16-23 — default has empty password
const defaults = {
  adminPassword: '',   // ← EMPTY DEFAULT
  companyName: 'MAGNETIC PLACE',
  // ...
};

// LoginView.jsx line 48 — accepts ANY password when adminPassword is ''
if (user.trim().toLowerCase() === 'admin' && pass.trim() === systemSettings.adminPassword) {
  onLogin('admin');
```

**Fix:**
```javascript
// AppContext.jsx — require password to be non-empty on first boot
const defaults = {
  adminPassword: null,  // Must be set before admin can login
  // ...
};
```

Also add validation in LoginView:
```javascript
if (user.trim().toLowerCase() === 'admin') {
  if (!systemSettings.adminPassword) {
    setError('Sistema não configurado. Contacte o administrador.');
    return;
  }
  if (pass.trim() !== systemSettings.adminPassword) {
    setError('Senha incorreta.');
    return;
  }
  onLogin('admin');
  return;
}
```

---

### CR-02: Gemini API Key Exposed in URL Query Parameter

**File:** `src/utils/aiUtils.js:13`
**Issue:** The Gemini API key is passed as a URL query parameter in a GET request. API keys in URL parameters are logged by browsers, web servers, and proxy servers, and appear in server-side access logs. This is a security vulnerability.

```javascript
// aiUtils.js line 13 — API key in URL query parameter
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
```

**Fix:**
```javascript
// Use POST request with Authorization header instead
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify(payload)
});
```

---

### CR-03: NIF-as-Password Weak Authentication

**File:** `src/features/auth/LoginView.jsx:64-77`
**Issue:** Workers authenticate using their NIF (Portuguese tax number) as a password. NIFs are public/半-public identifiers — they can be found on payslips, government records, and are not secret. This is weak authentication for a system containing sensitive HR data.

```javascript
// LoginView.jsx lines 64-77
const validPass = (found.nif || "").toString().trim();
if (validPass === pass.trim()) {
  // Worker is authenticated
}
```

Additionally, NIFs are stored in plain text in the database with no hashing.

**Fix:**
Implement proper password authentication:
1. Add a separate `password_hash` field to workers table
2. Use bcrypt or similar for password hashing
3. Allow workers to set/reset their password
4. Keep NIF separate for identity verification only

---

### CR-04: Client Portal Token Enumeration via share_token

**File:** `src/app.jsx:311-313`
**Issue:** The system resolves `tokenResolvedClientId` by looking up `share_token` in the clients table. Share tokens appear to be predictable (based on how they're generated elsewhere in the codebase). An attacker with knowledge of a client's share token could access the client portal without authentication.

```javascript
// app.jsx lines 311-313
const tokenResolvedClientId = urlToken
  ? (clients.find(c => c.share_token === urlToken)?.id || null)
  : null;
```

**Fix:**
1. Use cryptographically random UUIDs for share_token (not predictable)
2. Add rate limiting on token-based access attempts
3. Log and alert on suspicious token-based access patterns
4. Consider adding a token expiration mechanism

---

### CR-05: Unbounded Supabase Realtime Subscription Growth

**File:** `src/ClientPortal.jsx:400-428`
**Issue:** Each time ClientPortal mounts and has a valid `initialClientId`, it creates a new Supabase realtime channel. If the component mounts/unmounts frequently (e.g., during navigation), subscriptions accumulate in memory and with the Supabase server, potentially causing memory leaks and unexpected behavior.

```javascript
// ClientPortal.jsx lines 400-428
useEffect(() => {
  if (!supabase) return;
  if (!initialClientId || typeof initialClientId !== 'string') return;

  const channel = supabase
    .channel('client-portal-logs')
    .on('postgres_changes', ...)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [supabase, initialClientId]);
```

The channel name is always `'client-portal-logs'` regardless of `initialClientId`, so multiple mounts create distinct subscription handles that are never reused efficiently.

**Fix:**
```javascript
// Use unique channel name per client
const channelName = `client-portal-logs-${initialClientId}`;
const channel = supabase.channel(channelName)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'logs', filter: `clientId=eq.${initialClientId}` }, ...)
  .subscribe();

// Cleanup on unmount
return () => { supabase.removeChannel(channel); };
```

Also ensure AppContext channels are cleaned up on unmount (see WR-02).

---

## Warnings

### WR-01: Race Condition in Version Checking

**File:** `src/app.jsx:66-82`
**Issue:** The `checkUpdate` function uses `baseVersion` closure variable that is set inside the async callback. On the first call, `baseVersion` is null, so it gets set. But subsequent calls don't update `baseVersion` even if `version !== baseVersion`. The condition `if (baseVersion === null)` only runs once, but `setUpdateAvailable` only triggers when `version !== baseVersion` after the first set. This means if the first fetch returns version X, and later the server updates to version Y while the page is open, it won't be detected until the next page load.

```javascript
// app.jsx lines 66-82
const check = async () => {
  try {
    const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
    const { version } = await res.json();
    if (baseVersion === null) {
      baseVersion = version;  // Only set once
    } else if (version !== baseVersion) {
      setUpdateAvailable(true);  // Never triggers if baseVersion was set differently
    }
  } catch {}
};
```

**Fix:**
```javascript
const [currentVersion, setCurrentVersion] = useState(null);
const check = async () => {
  try {
    const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
    const { version } = await res.json();
    if (currentVersion === null) {
      setCurrentVersion(version);
    } else if (version !== currentVersion) {
      setUpdateAvailable(true);
    }
  } catch {}
};
```

---

### WR-02: Supabase Realtime Subscriptions Not Cleaned Up on Provider Unmount

**File:** `src/context/AppContext.jsx:214-325`
**Issue:** Multiple realtime channels are created in an effect that runs once (`isDbReady` dependency). The cleanup function returns the suppression of channels, but this cleanup only runs when `AppProvider` unmounts. If the app never unmounts the provider (typical SPA behavior), these channels persist for the session lifetime.

```javascript
// AppContext.jsx lines 317-325
return () => {
  supabaseInstance.removeChannel(channelNotif);
  supabaseInstance.removeChannel(channelCorrections);
  supabaseInstance.removeChannel(channelCorrectionItems);
  supabaseInstance.removeChannel(channelApprovals);
  supabaseInstance.removeChannel(channelLogs);
  supabaseInstance.removeChannel(channelChangeReqs);
  supabaseInstance.removeChannel(channelWorkers);
};
```

This is acceptable for the app lifetime, but the pattern could cause issues in testing or micro-frontend scenarios.

---

### WR-03: Double Month Parsing with Divergent Logic

**File:** `src/app.jsx:242-267`
**Issue:** `handleConfirmarRejeicao` parses the month string twice using two different code paths. Lines 243-249 use regex matching for Portuguese month names, but the same variable `rawTargetMonth` is reassigned at lines 260-267. The second block only runs if `!rawTargetMonth && monthFromMsg`. This creates inconsistent behavior depending on the format of the notification's message.

```javascript
// First parsing (lines 242-249)
if (rawTargetMonth && !rawTargetMonth.match(/^\d{4}-\d{2}$/)) {
  // ... parse Portuguese month name
  if (monthIdx >= 0 && yearMatch) rawTargetMonth = `${yearMatch[0]}-${String(monthIdx + 1).padStart(2, '0')}`;
}

// Second parsing (lines 260-267) — same variable reassigned differently
if (!rawTargetMonth && monthFromMsg) {
  // ... parse again, possibly differently
  if (monthIdx >= 0 && yearMatch) rawTargetMonth = `${yearMatch[0]}-${String(monthIdx + 1).padStart(2, '0')}`;
}
```

**Fix:** Extract month parsing to a dedicated utility function and use it consistently.

---

### WR-04: Optimistic UI Updates Without Validation

**File:** `src/features/admin/AdminDashboard.jsx:127-154`
**Issue:** `markNotifRead` and `markCorrectionsViewed` update local state optimistically before the Supabase request completes. If the Supabase request fails silently or returns an error, the local state remains incorrect until the next page reload.

```javascript
// AdminDashboard.jsx lines 127-137
const markNotifRead = async (id) => {
  setOptimisticReadIds(prev => new Set([...prev, id]));  // Optimistic update
  if (!currentUser?.id || !supabase) return;
  // ... Supabase update runs async, no error handling
  await supabase.from('app_notifications')
    .update({ read_by_admin_ids: [...current, currentUser.id] })
    .eq('id', id);
};
```

**Fix:**
```javascript
const markNotifRead = async (id) => {
  const previousState = optimisticReadIds;
  setOptimisticReadIds(prev => new Set([...prev, id]));
  try {
    if (currentUser?.id && supabase) {
      const notif = appNotifications.find(n => n.id === id);
      if (!notif) return;
      const current = notif.read_by_admin_ids || [];
      await supabase.from('app_notifications')
        .update({ read_by_admin_ids: [...current, currentUser.id] })
        .eq('id', id);
    }
  } catch (err) {
    // Revert optimistic update on failure
    setOptimisticReadIds(previousState);
    console.error('Failed to mark notification as read:', err);
  }
};
```

---

### WR-05: Magic Strings Throughout Codebase

**Files:** Multiple — `app.jsx`, `AdminDashboard.jsx`, `ValidationPortal.jsx`, `ClientPortal.jsx`
**Issue:** Status comparisons use magic strings like `'enviado_${monthStr}'`, `'pending'`, `'rejected'`, `'ativo'`, `'inativo'`, `'approved'`, `'appr_'`. These strings are duplicated across files and make maintenance difficult. If a status value changes, it must be updated in every location.

**Examples:**
```javascript
// app.jsx line 223
status_email: `enviado_${monthStr}`

// AdminDashboard.jsx line 210
await supabase.from('corrections').update({ status: 'applied' }).eq('id', correctionId);

// ValidationPortal.jsx line 133
const status = approval ? 'validado' : (c.status_email === `enviado_${portalMonthStr}` ? 'enviado' : 'pendente');
```

**Fix:** Create a central constants file:
```javascript
// src/constants/documentStatus.js (already exists)
// Extend it to cover all statuses
export const WORKER_STATUS = {
  ACTIVE: 'ativo',
  INACTIVE: 'inativo',
};

export const CORRECTION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  APPLIED: 'applied',
};

export const EMAIL_STATUS = {
  SENT: (month) => `enviado_${month}`,
};

export const APPROVAL_ID_PREFIX = 'appr_';
```

---

### WR-06: Hardcoded Fallback URL with Production Domain

**File:** `src/app.jsx:32`
**Issue:** A production domain is hardcoded as a fallback when the environment variable is missing. This could cause issues in development/staging if the variable is accidentally cleared.

```javascript
// app.jsx line 32
const CLIENT_PORTAL_URL = (import.meta.env.VITE_CLIENT_PORTAL_URL || 'https://painelcliente.magneticplace.pt/').split('?')[0] + '/';
```

**Fix:**
```javascript
const getClientPortalUrl = () => {
  const configured = import.meta.env.VITE_CLIENT_PORTAL_URL;
  if (!configured) {
    console.warn('[app] VITE_CLIENT_PORTAL_URL not set — client portal links will not work');
    return null;
  }
  return configured.split('?')[0] + '/';
};
const CLIENT_PORTAL_URL = getClientPortalUrl() || '';
```

---

### WR-07: Geolocation Errors Silently Swallowed

**File:** `src/features/worker/WorkerDashboard.jsx:105-108`
**Issue:** When GPS is unavailable, the error is caught but no user feedback is provided. The comment says "GPS indisponível — registo sem verificação" but the user has no way of knowing the GPS check failed or why location wasn't recorded.

```javascript
// WorkerDashboard.jsx lines 105-108
} catch {
  // GPS indisponível — registo sem verificação
  // ← No user notification that geolocation failed
} finally {
  setGeoLoading(false);
}
```

**Fix:**
```javascript
} catch (err) {
  console.warn('[WorkerDashboard] GPS unavailable:', err.message);
  // Optionally set a warning state to show to user
  setGeoError('Localização indisponível. Registo guardado sem verificação GPS.');
} finally {
  setGeoLoading(false);
}
```

---

### WR-08: Inline CSS via dangerouslySetInnerHTML

**File:** `src/features/auth/LoginView.jsx:184-188`
**Issue:** A keyframe animation is injected via dangerouslySetInnerHTML. This bypasses React's security model and CSP protections.

```javascript
// LoginView.jsx lines 184-188
<style dangerouslySetInnerHTML={{
  __html: `
  @keyframes bounce-subtle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
  .animate-bounce-subtle { animation: bounce-subtle 3s infinite ease-in-out; }
`}} />
```

**Fix:** Move animation to CSS file or use inline style with animation property:
```javascript
// Use CSS module or global stylesheet
const bounceStyle = {
  animation: 'bounce-subtle 3s infinite ease-in-out',
};
```

---

### WR-09: Document ID Collisions Possible with Date.now() + Math.random()

**File:** `src/ClientPortal.jsx:507, 582, 620`
**Issue:** New document/log IDs are generated using `Date.now() + Math.random()` pattern, which is not guaranteed unique. In a distributed system with multiple clients, collision is possible.

```javascript
// ClientPortal.jsx line 507
const newLogId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

// ClientPortal.jsx line 582
const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

// ClientPortal.jsx line 620
id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
```

**Fix:** Use crypto.randomUUID() which is available in all modern browsers:
```javascript
const newLogId = `log_${crypto.randomUUID()}`;
```

---

### WR-10: useEffect Dependency Array Causes Unnecessary Re-runs

**File:** `src/ClientPortal.jsx:678-683`
**Issue:** The effect depends on `selectedMonth`, which it also sets inside the effect. This creates a potential loop where setting `selectedMonth` triggers the effect, which might set `selectedMonth` again if certain conditions are met.

```javascript
// ClientPortal.jsx lines 678-683
useEffect(() => {
  if (!selectedMonth && effectiveClientId && availableMonths.length > 0) {
    setSelectedMonth(availableMonths[0]);  // Sets selectedMonth
  }
}, [effectiveClientId, availableMonths, selectedMonth]);  // ← selectedMonth in deps
```

**Fix:** Remove `selectedMonth` from dependency array (it's set, not read in this effect):
```javascript
useEffect(() => {
  if (!selectedMonth && effectiveClientId && availableMonths.length > 0) {
    setSelectedMonth(availableMonths[0]);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [effectiveClientId, availableMonths]);
```

---

### WR-11: PDF Generation Uses User-Provided Input Without Sanitization

**File:** `src/utils/pdfSigningService.js:547-573`
**Issue:** When applying the admin stamp, `ip` and other user-provided data are rendered into the PDF without sanitization. While pdf-lib handles basic text rendering safely, malformed data could potentially cause issues in edge cases.

```javascript
// pdfSigningService.js lines 725, 730
page.drawText(`IP ${String(ip || 'N/D')}`, { ... });
if (id) {
  page.drawText(`ID: ${String(id)}`, { ... });
}
```

**Fix:** Basic sanitization for PDF text:
```javascript
const sanitizePdfText = (str) => String(str || 'N/D').replace(/[^\x20-\x7E\s]/g, '').substring(0, 100);
page.drawText(`IP ${sanitizePdfText(ip)}`, { ... });
```

---

## Info Items

### IN-01: Deep Prop Drilling in AdminDashboard

**File:** `src/app.jsx:358-389`
**Issue:** AdminDashboard receives over 20 props directly from App, rather than using the AppContext. This makes the component interface complex and creates tight coupling. When a prop needs to be added or removed, both files must be modified.

**Suggestion:** Use `useApp()` hook in AdminDashboard instead of passing all props through the component tree.

---

### IN-02: Dead Code — isDirectAccess Flag

**File:** `src/ClientPortal.jsx:289`
**Issue:** A comment says "Direct access bypass disabled — require proper login always" but there's a variable `const isDirectAccess = false;` and code that references it. This appears to be abandoned functionality.

```javascript
// ClientPortal.jsx line 289
// Direct access bypass disabled — require proper login always (security: CR-06)
const isDirectAccess = false;
```

**Suggestion:** Remove the dead code if it's not being used, or document why it's kept.

---

### IN-03: Commented-Out Code

**Files:** `src/features/worker/WorkerDashboard.jsx` (line 442)
**Issue:** There is commented-out code referencing "Legacy logic reference - needs to be handled via proper schedule selection in future refactor".

```javascript
// WorkerDashboard.jsx line 442
// Legacy logic reference - needs to be handled via proper schedule selection in future refactor
handleOpenInlineForm(ds);
```

**Suggestion:** Remove or complete the refactor, don't leave commented legacy code.

---

### IN-04: Missing Error Handling in Supabase Realtime Handlers

**File:** `src/context/AppContext.jsx:215-241`
**Issue:** The postgres_changes callback handlers don't have try/catch blocks. If processing a notification throws an exception, it will be silently swallowed by the realtime system.

```javascript
// AppContext.jsx lines 217-241
.on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, (payload) => {
  // No try/catch — errors in processing payload.new silently ignored
  if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
    // ...
  }
})
```

**Suggestion:** Wrap processing logic in try/catch:
```javascript
.on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, (payload) => {
  try {
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      // processing
    }
  } catch (err) {
    console.error('[AppContext] Error processing notification:', err);
  }
})
```

---

### IN-05: Redundant Supabase Client Initialization Check

**File:** `src/context/AppContext.jsx:106-124`
**Issue:** The initialization checks `window.supabase` twice — once directly and once after creating the script. This is minor but the logic could be simplified.

```javascript
// AppContext.jsx lines 106-124
const initSupabase = async () => {
  if (window.supabase) {
    supabaseInstance = window.supabase.createClient(supabaseUrl, supabaseKey);
    // ...
  } else {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = () => {
      if (window.supabase) {  // ← Redundant check
        supabaseInstance = window.supabase.createClient(supabaseUrl, supabaseKey);
        // ...
      }
    };
```

**Suggestion:** Remove the inner `if (window.supabase)` check since we're already in the `else` branch where it must exist.

---

### IN-06: Translation System Only Supports Two Languages

**File:** `src/utils/emailUtils.js:8-32`
**Issue:** The email translations only support `es` (Spanish) as an alternative to `pt` (Portuguese). The `translateEmailContent` function returns original text if the language is not found, which means any future language additions won't work without code changes.

```javascript
// emailUtils.js lines 40-41
export const translateEmailContent = (text, lang = 'es') => {
  if (!text || !emailTranslations[lang]) return text;
```

**Suggestion:** Add a warning log when an unsupported language is requested, and create a constant for supported languages.

---

### IN-07: Hardcoded Company Name in Corporate Stamp

**File:** `src/utils/pdfSigningService.js:1000`
**Issue:** "GLOBAL WORKFORCE SOLUTIONS" is hardcoded in the corporate stamp template. This appears to be a placeholder that was never made configurable.

```javascript
// pdfSigningService.js line 1000
page.drawText('GLOBAL WORKFORCE SOLUTIONS', {
  x: titleX, y: headerY + 1.5, size: 3.5, font: helvBold, color: GOLD,
});
```

**Suggestion:** Move to system settings or make it configurable via options parameter.

---

### IN-08: Complex Conditional in AdminDashboard Approval Status

**File:** `src/features/admin/AdminDashboard.jsx:132-133`
**Issue:** The approval status determination involves multiple conditions across different data structures. The logic is spread across two files and relies on implicit field matching (client_id vs clientId).

```javascript
// AdminDashboard.jsx lines 132-133
const approval = clientApprovals?.find(a => (String(a.client_id || a.clientId || '') === String(c.id)) && a.month === portalMonthStr);
const hasEmail = c.status_email === `enviado_${portalMonthStr}`;
return approval || hasEmail;
```

**Suggestion:** Create a helper function for approval status determination and document the expected field structure.

---

### IN-09: Client IP Fetched from External Service

**File:** `src/ClientPortal.jsx:431-436`
**Issue:** The client IP address is fetched from api.ipify.org. This introduces an external dependency for a non-critical feature. The IP is used for signature stamping but isn't validated or essential.

```javascript
// ClientPortal.jsx lines 431-436
useEffect(() => {
  fetch('https://api.ipify.org?format=json')
    .then(res => res.json())
    .then(data => setClientIp(data.ip || 'N/D'))
    .catch(() => setClientIp('N/D'));
}, []);
```

**Suggestion:** Consider using a server-side endpoint you control, or accept that IP display is best-effort and doesn't need to be fetched from an external service.

---

### IN-10: Console.warn Suppression of Errors

**Files:** Multiple — `emailUtils.js:111`, `emailUtils.js:144`, `cloudConvertService.js:131-135`
**Issue:** Email failures are logged as warnings instead of errors, suppressing potential issues from application monitoring. Email is a critical feature in this app (client notifications, validation confirmations).

```javascript
// emailUtils.js line 125
console.warn('Falha no envio de email de validação:', error);
```

**Suggestion:** Use `console.error` for email failures, as they represent actual failures in critical communication paths.

---

### IN-11: Variable Naming Inconsistency — worker_id vs workerId

**Files:** `AppContext.jsx`, `ClientPortal.jsx`, `ValidationPortal.jsx`, multiple others
**Issue:** The codebase inconsistently uses `worker_id` (Supabase convention) and `workerId` (JS convention). This causes bugs where fields don't match between database and application state.

Examples:
- `AppContext.jsx:361` uses `workerId` in saveToDb payload
- `ClientPortal.jsx:566` uses `worker_id` in Supabase queries
- `saveToDb` at line 357 maps to `workerId` but Supabase stores `worker_id`

**Suggestion:** Establish a naming convention and create a normalization function for all worker ID access.

---

### IN-12: formatHours Rounds Without Clear Handling of Edge Cases

**File:** `src/utils/formatUtils.js:47-51`
**Issue:** `formatHours` uses `Math.round` for minutes, which means 8.5 hours displays as "8h30" but 8.999 would also display as "9h0". The rounding behavior might not match user expectations for financial/HR data.

```javascript
// formatUtils.js lines 47-51
export const formatHours = (h) => {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return `${hours}h${minutes === 0 ? '00' : minutes.toString().padStart(2, '0')}`;
};
```

**Suggestion:** Consider truncation instead of rounding for financial contexts, or document the rounding behavior clearly.

---

### IN-13: Supabase URL and Key Declared at Module Level

**File:** `src/context/AppContext.jsx:7-8`
**Issue:** The Supabase URL and anon key are declared as module-level constants. While they're environment variables (acceptable), they could be accidentally logged if the module is imported and the variables are undefined.

```javascript
// AppContext.jsx lines 7-8
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

**Suggestion:** Add validation at initialization time that these values are present and well-formed before creating the client.

---

### IN-14: No Loading/Error States for Realtime Connections

**Files:** `src/context/AppContext.jsx:214-325`, `src/ClientPortal.jsx:400-428`
**Issue:** Realtime subscriptions are created without any UI indication of connection state. If the Supabase realtime connection fails, the user has no way of knowing the app is no longer receiving real-time updates.

**Suggestion:** Add connection state tracking:
```javascript
const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
// Update status in channel subscription callbacks
```

---

## Cross-File Dependency Analysis

### Import Graph Summary

**Core Flow:**
1. `main.jsx` → `AppProvider` (AppContext) + `App`
2. `App` → AdminDashboard, WorkerDashboard, ClientPortal, LoginView
3. `AppContext` → All data and operations (logs, workers, clients, saveToDb, etc.)
4. `AdminDashboard` → 20+ components including ValidationPortal, TeamManager, etc.
5. `ClientPortal` → PrecisionReportReview, ClientReportFlow, ValidationStampWithQR

**Key utility modules and their consumers:**
- `emailUtils.js` — Used by app.jsx, ClientPortal.jsx, ValidationPortal.jsx
- `aiUtils.js` — Used by AdminDashboard.jsx
- `pdfSigningService.js` — Used by multiple stamp components
- `geoUtils.js` — Used by WorkerDashboard.jsx
- `formatUtils.js` — Used by nearly every file
- `dateUtils.js` — Used by multiple files

**Circular dependency risk:** None identified, but the WorkerContext imports from AppContext and creates its own providers that wrap the component tree, creating complex dependency chains.

---

## Severity Classification Reference

| Class | Definition | Count |
|-------|------------|-------|
| **Critical** | Security vulnerabilities, authentication bypasses, data loss risks | 5 |
| **Warning** | Logic errors, unhandled edge cases, missing error handling, code smells | 11 |
| **Info** | Style issues, naming improvements, suggestions | 14 |

---

_Reviewed: 2026-05-29_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_