---
phase: 05-correcao-reports
plan: 02
type: summary
status: complete
duration_minutes: 30

## Summary

**Fixed:** Missing "Enviar Contra-proposta" (Send Counter-proposal) button in CorrecoesAdmin component.

---

## Issues Analyzed

### Admin-to-Client Feedback Flow Analysis

**Flow Expected:**
1. Client sends "Ajuste de Precisão" → Admin receives notification
2. Admin edits records OR sends counter-proposal
3. Client receives admin's response and can accept/reject

**Bugs Found:**

#### Bug 1: Missing "Enviar Contra-proposta" Button (FIXED)
**Issue:** When admin clicked on a client correction notification and started editing days, there was no button to send a counter-proposal back to the client.

**Root Cause:** The code to send counter-proposals existed in `app.jsx.new` (an alternative version with newer features) but was not present in the active `app.jsx`. The button with `Sparkles size={16}` icon and full counter-proposal logic was simply absent from the editing interface.

**Fix Applied:** Added the "Enviar Contra-proposta" button (lines 2849-2916) that:
- Only appears when `isEditing === true` (admin has started editing)
- Prompts for a reason/contestation message via `prompt()`
- Creates a notification with:
  - `title: 'Contra-proposta: {monthLabel}'`
  - `target_type: 'client'`
  - `target_client_id: String(targetClientId)` (resolved from client name)
  - `payload.type: 'counter_proposal'`
  - `payload.reason: reason`
  - `payload.changes: currentData.workers` (structured worker data)
- Marks original notification as `status: 'contestada'` and `is_active: false`

#### Bug 2: Client Name Resolution for Counter-proposal
**Issue:** Counter-proposal notification needs `target_client_id` but admin notification only has client name in message.

**Resolution:** The fix looks up client by name:
```javascript
const normalizedClientName = (currentData.clientName || "").trim().toLowerCase();
const clientObj = clients.find(c => (c.name || "").trim().toLowerCase() === normalizedClientName);
const targetClientId = clientObj?.id;
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/app.jsx` | Added "Enviar Contra-proposta" button with full counter-proposal logic (lines 2849-2916) |

---

## Verification

- ✅ Build passes successfully
- ✅ Button appears conditionally when admin is editing (`isEditing === true`)
- ✅ Counter-proposal notification has correct structure:
  - `target_type: 'client'` - matches ClientPortal filter
  - `target_client_id: String(targetClientId)` - precise client targeting
  - `payload.type: 'counter_proposal'` - triggers `handleAcceptContestation`
  - `payload.changes: currentData.workers` - structured data for client to apply
- ✅ Client's `handleAcceptContestation` function exists and processes counter-proposals correctly
- ✅ Client portal correctly displays counter-proposal with accept/ignore buttons

---

## TDD Gate Compliance
Not a TDD plan - bug fix execution.