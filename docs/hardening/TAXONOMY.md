# System Event Taxonomy

This document defines the categorized events used for telemetry in the Hardened ERP structure. All logs must adhere to these types and schemas to ensure dashboard observability.

## 1. Event Types

| Type | Description | Priority |
| :--- | :--- | :--- |
| `boundary_recovery` | Caught by `SafeBoundary` (UI Crash). | High |
| `fallback_contract` | Data didn't match contract; used safe default. | Medium |
| `auth_transition_recovery` | Recovered from transient session expiry. | Medium |
| `validation_failure` | Boundry validation failed (Input/API). | Low |
| `mutation_failure` | Critical failure during write (Create/Update). | Critical |

---

## 2. Metadata Schemas

### `boundary_recovery`
- **source**: Component name (e.g., `Sidebar`).
- **variant**: `silent` | `compact` | `inline`.
- **pathname**: Current URL path.
- **stack_preview**: First 500 chars of stack trace.

### `fallback_contract`
- **source**: Service/Action name (e.g., `getNotifications`).
- **expected**: Expected type (e.g., `array`).
- **actual**: Received type (e.g., `null`).
- **is_fallback**: `true` (Mandatory).

### `auth_transition_recovery`
- **source**: Hook/Provider name.
- **previous_status**: `authenticated` | `loading`.
- **next_status**: `unauthenticated`.
- **pathname**: Where it happened.

---

## 3. Query Guidelines
To monitor system health, use these internal body filters in the logs:
- `body->>'is_hardening_event' = 'true'`
- `body->>'type' = 'boundary_recovery'`
