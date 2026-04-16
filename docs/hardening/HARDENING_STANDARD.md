# Hardening Standard: Operational Golden Rules

This document defines the mandatory patterns for developing features in the Shop-Inventory ERP. Following these rules ensures system stability, isolation, and observability.

---

## 1. Safe Rendering of Shared State
**Rule**: Always assume external or shared data (from hooks or services) is unreliable during initial mount or session transitions.

**Why**: Accessing properties on `undefined` (e.g. `data.items.length`) causes "Shell Collapse" (page-wide white screen).

### Bad
```tsx
const { data } = useService();
return <div>Total: {data.items.length}</div>; // Crashes if data is loading or null
```

### Good
```tsx
const { data, status } = useService();
const items = Array.isArray(data?.items) ? data.items : [];
return <div>Total: {items.length}</div>;
```

**Checklist**:
- [ ] Are `.map()` or `.length` guarded by `Array.isArray()`?
- [ ] Is `status` (loading/auth) checked before rendering business data?

---

## 2. Choosing the Right Fallback (UX Policy)
**Rule**: Use the recovery variant that matches the component's critical importance.

**Why**: `silent` fallbacks can hide system failures in critical areas, leading to user confusion.

### Bad
```tsx
<SafeBoundary variant="silent">
  <DashboardStatsCard /> {/* If this fails, the dashboard grid looks broken/empty */}
</SafeBoundary>
```

### Good
```tsx
<SafeBoundary variant="compact" componentName="StatsCard">
  <DashboardStatsCard /> {/* Shows styled error box if failure occurs */}
</SafeBoundary>
```

**UX Matrix Reference**:
- **Critical Shell** (Sidebar/Nav) -> `compact`
- **Actionable Widget** (Bell/Stats) -> `compact`
- **Non-essential Slot** (Decors) -> `silent`
- **Text Labels** (Inline values) -> `inline`

---

## 3. Server Action Consistency
**Rule**: Server Actions used for UI convenience reads must return a consistent empty shape instead of throwing.

**Why**: UI components shouldn't have to handle `try/catch` for simple list reads.

### Bad
```ts
async function getNotifications() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized"); // Causes UI crash
  return await db.notification.findMany();
}
```

### Good
```ts
async function getNotifications() {
  const session = await auth();
  if (!session) return []; // UI remains stable
  return await db.notification.findMany();
}
```

---

## 4. Telemetry Requirements
**Rule**: Every manual fallback trigger must be logged with the correct `SystemEventType`.

**Why**: Hardening without telemetry is "Invisible Failure."

### Bad
```ts
const items = data ?? []; // Silent fallback without observation
```

### Good
```ts
const items = Array.isArray(data) ? data : (
  logger.trackFallback({ source: 'MyList', expected: 'array' }),
  []
);
```

**Checklist**:
- [ ] Is `source` clearly identified (e.g., ComponentName)?
- [ ] Is `pathname` captured for context?

---

## 5. Summary Developer Checklist
- [x] **Boundary**: Is this widget wrapped in `SafeBoundary`?
- [x] **Contract**: if data is `null`, is there a `[]` or `0` fallback?
- [x] **Telemetry**: Is the fallback being logged with a `type`?
- [x] **Standard**: Does it match the [UX Matrix](file:///Users/napat.a/Desktop/Live%20Coding/Shop-inventory/docs/hardening/UX_MATRIX.md)?
