# Known Limitations: Session Resilience & Hardening

This document outlines the boundaries of the current implementation. Any behaviors outside these constraints are intentional trade-offs for performance and simplicity.

## 1. Detection Latency (Polling-Based)
The "Logout Guardian" relies on the `PermissionProvider` polling cycle. 
- **Current interval**: 30 seconds.
- **Worst-case impact**: If a session is revoked, a user might remain on a "dead" UI for up to 30 seconds before being automatically redirected.
- **Mitigation**: Future iterations could use `BroadcastChannel` or `WebSockets` for near-instant revocation notifications.

## 2. Public Route Access
The Logout Guardian is explicitly disabled on public routes (`/login`, `/register`, `/forgot-password`, etc.) to prevent redirect loops.
- **Scenario**: If a user is on the `/login` page, the system will not attempt any auto-redirection even if the session state is `unauthenticated`.

## 3. Server-Side Enforcement vs. Client-Side Experience
- **Client-Side**: The Logout Guardian provides a smooth *UX transition* to clear the screen.
- **Server-Side**: NextAuth/Middleware still enforces authentication on every request independently. The Guardian does not replace server-side security.

## 4. Multi-Tab Polling Offset
If a user has 5 tabs open, each tab might be on its own 30-second cycle.
- **Behavior**: Tabs will "pop" back to `/login` staggered over a window of 30 seconds rather than all at the exact same millisecond. 

---
**Status**: Managed. These limitations are acceptable for the current scale of the Shop-inventory ERP.
