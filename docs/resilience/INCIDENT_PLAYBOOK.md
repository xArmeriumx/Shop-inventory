# Incident Playbook: Session & Resilience Support

This playbook provides quick-response guidance for issues related to authentication transitions and build-time stability.

## 1. Issue: User complains of "Sudden Redirect to Login"
**Diagnosis**: This is likely the "Logout Guardian" working correctly due to a session revocation.
- **Check Logs**: Query `systemLog` where `type = 'AUTH_TRANSITION_RECOVERY'`.
- **Search Metadata**: Look for the user's ID or the `pathname` from which they were redirected.
- **Possible Cause**:
    - "Logout All" was triggered from another tab.
    - The `next-auth.session-token` cookie expired or was cleared.
    - A database error caused the auth-check to fail temporarily (Check for `ERROR` level logs).

## 2. Issue: "The build is noisy/failing during static generation"
**Diagnosis**: A new Server Action might be missing the `isDynamicServerError` filter.
- **Symptom**: Console shows `[Action: someAction] Failed: ... DYNAMIC_SERVER_USAGE`.
- **Solution**:
    1. Open the failing action in `src/actions/`.
    2. Import `isDynamicServerError` from `@/lib/next-utils`.
    3. Add the filter to the `catch` block (refer to `src/actions/dashboard.ts` for pattern).

## 3. Issue: Notification Bell is not updating
**Diagnosis**: Client-side mount issue or Supabase connection failure.
- **Check**: Browser Console for `[NotificationBell] Failed to load notifications`.
- **Verify**: Component state for `isMounted`. If it remains `false`, the bell will never initialize subscriptions.

---
**Key Telemetry Code (Taxonomy)**: `AUTH_TRANSITION_RECOVERY`
**Key Utility**: `isDynamicServerError`
