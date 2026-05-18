---
status: diagnosed
trigger: Admin cannot edit time inputs in quick report notifications - inputs don't work
created: 2026-05-05
updated: 2026-05-05
symptoms:
  expected: Admin should be able to click Iniciar Edição, then click pencil on a day, then edit time inputs (entry/exit/break)
  actual: Inputs don't function - when typing in time field, digits get replaced/deleted
  error_messages: none visible
  timeline: started when client sends quick report, admin opens in Correções tab
  reproduction: "Cliente envia quick → admin abre" - client sends quick report, admin opens Correções tab
---

## Root Cause Identified

**Root Cause:** Line 2317 in `handleUpdateDraft` has a validation gate that blocks all time field input when the value is less than 5 characters and doesn't contain ':' or '--'.

```javascript
if (isTimeField && value && value.length < 5 && !value.includes('--') && !value.includes(':')) {
  return;
}
```

**Why this blocks typing:**
- `<input type="time">` sends values like "09:00" (5 chars) when complete, but sends partial values like "0", "09", "09:" (1-4 chars) as the user types
- The condition `value.length < 5` rejects all partial input (first keystroke)
- Subsequent keystrokes also get rejected because length is still < 5 and no ':' yet
- Result: React state never updates, input digits appear to be "replaced" by the browser re-rendering to last valid state

**Evidence chain:**
1. Line 2653: `<input type="time" value={change.adminEntry || ''} onChange={e => handleUpdateDraft(...)}>`
2. When user types "0", `e.target.value` = "0" (1 char)
3. Line 2317 check: `isTimeField=true, value="0" (truthy), length=1 (<5), no ':', no '--'` → returns early
4. State never updates, browser reverts to previous display value

---

## Evidence

- Line 2315: `handleUpdateDraft` has time field validation
- Line 2317-2319: Early return blocks all input < 5 chars without ':'
- Line 2653: `adminEntry` field uses `type="time"` which builds value progressively
- This affects adminEntry, adminExit, adminBreakStart, adminBreakEnd fields

---

## Resolution

**root_cause:** Validation at line 2317 blocks partial time input (less than 5 chars) during typing. The condition rejects every keystroke until the user completes a full "HH:MM" format, but `<input type="time">` delivers partial values as they type.

**fix:** Modify the validation to accept partial time values. Change line 2317 from:
```javascript
if (isTimeField && value && value.length < 5 && !value.includes('--') && !value.includes(':')) {
```
to:
```javascript
if (isTimeField && value && value.length > 0 && !value.match(/^\d{2}:\d{2}$/) && !value.includes('--') && value.length < 5 && !value.includes(':')) {
```
Or simpler: remove the `value.length < 5` check entirely since `<input type="time">` guarantees valid format:
```javascript
if (isTimeField && value && !value.match(/^\d{2}:\d{2}$/) && !value.includes('--') && !value.includes(':')) {
```
The regex `^\d{2}:\d{2}$` accepts complete valid times only; partial inputs will pass through for proper state building.

**verification:** 
1. Open Correções tab on a quick report notification
2. Click "Iniciar Edição", then click the pencil icon on a day
3. Type a time like "09:30" - should work character by character
4. Verify: typing "0" in time field shows "0" (not rejected), typing "09" shows "09", completing "09:00" stores correctly

---