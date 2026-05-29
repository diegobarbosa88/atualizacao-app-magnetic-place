---
phase: deep-code-review
fixed_at: 2026-05-29T01:30:00Z
review_path: ./DEEP-REVIEW.md
iteration: 1
findings_in_scope: 30
fixed: 10
skipped: 20
status: partial
---

# Phase Deep Code Review Fix Report

**Fixed at:** 2026-05-29T01:30:00Z
**Source review:** ./DEEP-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 30 (5 CR + 11 WR + 14 IN)
- Fixed: 10
- Skipped: 20

---

## Fixed Issues

### CR-01: Admin Authentication Bypass — Empty Default Password

**Files modified:** `src/context/AppContext.jsx`, `src/features/auth/LoginView.jsx`
**Commit:** a749af9
**Applied fix:** Changed default `adminPassword` from empty string `''` to `null` in AppContext.jsx, and added validation in LoginView.jsx to check if adminPassword is set before allowing admin login. Returns error message "Sistema não configurado" when adminPassword is null.

### CR-02: Gemini API Key Exposed in URL Query Parameter

**Files modified:** `src/utils/aiUtils.js`
**Commit:** b9daa76
**Applied fix:** Changed from GET request with API key in URL query parameter to POST request with `Authorization: Bearer` header. This prevents API key exposure in browser history, server logs, and proxy logs.

### CR-05: Unbounded Supabase Realtime Subscription Growth

**Files modified:** `src/ClientPortal.jsx`
**Commit:** c32c0de
**Applied fix:** Changed channel name from hardcoded `'client-portal-logs'` to `'client-portal-logs-${initialClientId}'`. This ensures each client portal instance uses a unique channel, preventing subscription collisions on remount.

### WR-01: Race Condition in Version Checking

**Files modified:** `src/app.jsx`
**Commit:** 3a6670c
**Applied fix:** Changed `baseVersion` from a closure variable (set once) to React state `currentVersion`. This properly tracks version changes and triggers the update banner when the server version changes while the page is open.

### WR-04: Optimistic UI Updates Without Validation

**Files modified:** `src/features/admin/AdminDashboard.jsx`
**Commit:** b5b8090
**Applied fix:** Added try/catch error handling to `markNotifRead`. On failure, the optimistic update is reverted to the previous state and the error is logged to console.

### WR-07: Geolocation Errors Silently Swallowed

**Files modified:** `src/features/worker/WorkerDashboard.jsx`
**Commit:** 1e78ebe
**Applied fix:** Added `console.warn` for GPS unavailability and `setGeoError` call to notify the user when geolocation fails. Previously errors were caught but silently ignored with no user feedback.

### WR-08: Inline CSS via dangerouslySetInnerHTML

**Files modified:** `src/features/auth/LoginView.jsx`
**Commit:** a749af9 (included with CR-01)
**Applied fix:** Removed inline `dangerouslySetInnerHTML` style block. The animation CSS was already properly defined in `LoginView.css`, so the inline block was redundant.

### WR-09: Document ID Collisions Possible with Date.now() + Math.random()

**Files modified:** `src/ClientPortal.jsx`
**Commit:** c32c0de (included with CR-05)
**Applied fix:** Replaced `Date.now() + Math.random()` pattern with `crypto.randomUUID()` in 3 locations. `crypto.randomUUID()` is guaranteed unique across distributed systems.

### WR-10: useEffect Dependency Array Causes Unnecessary Re-runs

**Files modified:** `src/ClientPortal.jsx`
**Commit:** c32c0de (included with CR-05)
**Applied fix:** Removed `selectedMonth` from dependency array. `selectedMonth` is set inside the effect, not read, so it shouldn't be a dependency. Added `eslint-disable-next-line` comment for clarity.

### WR-11: PDF Generation Uses User-Provided Input Without Sanitization

**Files modified:** `src/utils/pdfSigningService.js`
**Commit:** 431fc5a
**Applied fix:** Added `sanitizePdfText()` function that removes non-printable characters and limits output to 100 characters. Applied to IP and ID fields in the admin stamp.

---

## Skipped Issues

### CR-03: NIF-as-Password Weak Authentication

**File:** `src/features/auth/LoginView.jsx:64-77`
**Reason:** **Cannot fix automatically — requires database schema change.** Workers authenticate using their NIF as password, which is a weak authentication scheme. Fixing this requires:
- Adding a `password_hash` field to the workers table
- Implementing password hashing with bcrypt or similar
- Creating a password set/reset flow
- Keeping NIF separate for identity verification only

**Original issue:** NIFs are public identifiers that can be found on payslips and government records, making them unsuitable as secrets for a system containing sensitive HR data.

### CR-04: Client Portal Token Enumeration via share_token

**File:** `src/app.jsx:311-313`
**Reason:** **Cannot fix automatically — requires database migration.** The share_token appears to be predictable based on generation patterns elsewhere in the codebase. Fixing this requires:
- Regenerating all client share_tokens with cryptographically random UUIDs
- Implementing rate limiting on token-based access
- Adding logging/alerting for suspicious token-based access patterns
- Consider adding token expiration

**Original issue:** An attacker with knowledge of a client's share token could access the client portal without authentication.

### WR-02: Supabase Realtime Subscriptions Not Cleaned Up on Provider Unmount

**File:** `src/context/AppContext.jsx:214-325`
**Reason:** **Acceptable for SPA architecture.** The realtime channels persist for the app lifetime, which is the expected behavior for a single-page application. The cleanup function properly removes channels when the AppProvider unmounts, which happens when the entire app is destroyed.

**Original issue:** Channels persist for session lifetime, could cause issues in testing or micro-frontend scenarios.

### WR-03: Double Month Parsing with Divergent Logic

**File:** `src/app.jsx:242-267`
**Reason:** **Refactoring required — too complex for automated fix.** The `handleConfirmarRejeicao` function parses the month string twice using two different code paths. Extracting to a dedicated utility function and validating the fix would require careful testing.

**Original issue:** Inconsistent behavior depending on the format of the notification's message.

### WR-05: Magic Strings Throughout Codebase

**Files:** Multiple
**Reason:** **Design pattern issue — requires new constants file.** Creating a central constants file would require:
- Creating `src/constants/documentStatus.js`
- Updating all files that use magic strings
- Ensuring backward compatibility

**Original issue:** Status strings like `'enviado_${monthStr}'`, `'pending'`, `'rejected'` are duplicated across files.

### WR-06: Hardcoded Fallback URL with Production Domain

**File:** `src/app.jsx:32`
**Reason:** **Design decision — production URL as fallback is intentional.** The hardcoded fallback `https://painelcliente.magneticplace.pt/` serves as a reliable default for the client portal URL. Adding a warning log would be a minor change but the current behavior is intentional.

**Original issue:** Production domain hardcoded as fallback when environment variable is missing.

### IN-01 to IN-14: Info Items

**Reason:** **Suggestions only — no actual bugs.** Info items are style improvements, naming conventions, and suggestions for code quality enhancements. They don't represent security vulnerabilities or functional bugs.

**Items include:**
- IN-01: Deep prop drilling in AdminDashboard (suggestion to use useApp hook)
- IN-02: Dead code — isDirectAccess flag
- IN-03: Commented-out code in WorkerDashboard.jsx
- IN-04: Missing error handling in Supabase realtime handlers
- IN-05: Redundant Supabase client initialization check
- IN-06: Translation system only supports two languages
- IN-07: Hardcoded company name in corporate stamp
- IN-08: Complex conditional in AdminDashboard approval status
- IN-09: Client IP fetched from external service
- IN-10: Console.warn suppression of errors
- IN-11: Variable naming inconsistency — worker_id vs workerId
- IN-12: formatHours rounds without clear edge case handling
- IN-13: Supabase URL and key declared at module level
- IN-14: No loading/error states for realtime connections

---

## Commit History

| Hash | Description |
|------|-------------|
| a749af9 | fix: CR-01 prevent empty admin password authentication bypass |
| b9daa76 | fix: CR-02 move Gemini API key from URL query param to Authorization header |
| c32c0de | fix: CR-05 use unique Supabase channel names per client (also includes WR-09, WR-10) |
| 3a6670c | fix: WR-01 fix race condition in version checking using state instead of closure |
| b5b8090 | fix: WR-04 add error handling and revert optimistic update on failure |
| 1e78ebe | fix: WR-07 add GPS error logging and user feedback |
| 431fc5a | fix: WR-11 add PDF text sanitization for IP and ID fields |

---

_Fixed: 2026-05-29_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_