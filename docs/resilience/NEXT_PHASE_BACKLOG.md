# Resilience & Operations: Next Phase Backlog

The following items are prioritized for future stability and security enhancements.

## 1. High Priority: Resilience Test Harness (Phase 3)
**Goal**: Enable QA and Engineering teams to simulate failures without modifying code.
- **Engine**: Build the cookie-based simulation engine (`resilience-harness.ts`).
- **Dashboard**: Create `src/app/(admin)/system/test/page.tsx`.
- **Scenarios**: UI Crash Toggles, Malformed Data Contracts, and Auth Status Mocking.

## 2. High Priority: Active Session Management UI
**Goal**: Empower users with "Logout Other Devices" capability and visibility.
- **UI**: A new section in User Settings showing browser, IP, and location context for all active sessions.
- **Security**: Allows users to proactively revoke compromised sessions, which will be immediately handled by the newly implemented **Logout Guardian**.

## 3. Medium Priority: Instant Revocation (BroadcastChannel)
**Goal**: Reduce the 30-second polling latency to <1 second for users with multiple tabs.
- **Tech**: Use the `BroadcastChannel` API to signal "Logout" events across all open tabs in the same browser.

## 4. Maintenance: Governance Audit
**Goal**: Periodic review of `isDynamicServerError` filters to adapt to Next.js version upgrades.
