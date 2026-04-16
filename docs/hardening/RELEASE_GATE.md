# Release Gate Policy

This policy defines the mandatory "Hardening Checks" that must pass before any code can be merged into the `main` branch or deployed to production.

## 1. Static Contract Checks
- [ ] **Array Safeguards**: All `.map()` or `.length` operations on dynamic data must use explicit array guards or default shapes.
- [ ] **Type Casts**: No unsafe type casting (`as any`) allowed for data crossing the Client-Server boundary without a corresponding `SafeBoundary` wrapper.

## 2. Recovery UX Checks
- [ ] **SafeBoundary Integration**: Every major business widget or shell-level slot must be wrapped in a `SafeBoundary`.
- [ ] **Variant Alignment**: The used variant (`silent`, `compact`, `inline`) must align with the [UX\_MATRIX.md](file:///Users/napat.a/Desktop/Live%20Coding/Shop-inventory/docs/hardening/UX_MATRIX.md) policy.

## 3. Telemetry Checks
- [ ] **Event Schema**: Any new fallback logic must use `logger.trackEvent` with the correct taxonomy type.
- [ ] **Metadata Integrity**: Logs must include `source`, `message`, and `pathname` for debuggability.

## 4. Performance Checks
- [ ] **Audit JSON**: Any new JSON snapshot display must implement 30k char truncation for browser performance.
- [ ] **Throttling**: verify that high-frequency UI alerts are throttled using the `logger` in-memory skip logic.

---

## Failure Protocol
If a Pull Request fails these checks, it must be marked as **Blocked** until the hardening standards are met. Hardening is a first-class citizen, not a post-release task.
