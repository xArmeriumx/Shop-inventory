# ERP Data Contract & Shell Hardening: Regression Checklist

This checklist must be verified before any main branch merge involving UI components, server actions, or data structure changes.

## 1. Auth & Session Transitions
- [ ] **Initial Mount**: Dashboard loads without white screen when session is loading.
- [ ] **Session Expiry**: Components (NotificationBell, Sidebar) degrade to fallback states (silent/compact) during simulation of session timeout.
- [ ] **Logout**: No `Cannot read properties of undefined` in console during navigation to `/login`.

## 2. Shared Layout Shell (SafeBoundaries)
- [ ] **Sidebar**: If `usePermissions` or `getNotifications` fails, the Sidebar must hide completely (`variant="silent"`), preserving the main layout.
- [ ] **Header**: If `NotificationBell` crashes, the Header remains fixed at the top, showing the "Unavailable" compact fallback.
- [ ] **BottomNav**: Mobile navigation fails silently to avoid obstructing the viewport.

## 3. Defensive Data Contracts
- [ ] **Arrays**: All server action results used in `.map()` or `.length` must be guarded by `Array.isArray(v) ? v : []`.
- [ ] **Status Machine**: UI components must read `status` (loading|auth|unauth|error) from `usePermissions` before attempting to render permission-gated elements.
- [ ] **Shared Hooks**: Ensure `usePermissions` and other context hooks do not leak `null` or `undefined` for critical object paths.

## 4. Audit & History Traversal
- [ ] **Complex Data**: Verify that nested objects/arrays in Audit logs show `"Complex data changed — View raw JSON"` instead of recursing infinitely or crashing.
- [ ] **Raw Viewer**: Verify the "View Raw JSON" dialog opens and displays formatting correctly for both old/new snapshots.

## 5. Telemetry & Observability
- [ ] **Fallback Tracking**: Check `systemLog` for entries with `is_fallback: true` after triggering a manual error.
- [ ] **Throttling**: Ensure that a crashed component rendering 60 times/sec only writes **one** log entry per 60 seconds to the DB.

---

## Standard Recovery States (Policy)

| Component Type | Recovery Variant | Visual Expectation |
| :--- | :--- | :--- |
| **Shell/Nav** (Sidebar, Nav) | `silent` | Element disappears; layout adjusts to fill space. |
| **Actionable** (Bell, Cards) | `compact` | Styled box with "Unavailable" and icon. |
| **Data Fields** (inline text) | `inline` | Small red "Error" or "⚠️" indicator. |
