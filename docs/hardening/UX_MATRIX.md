# Recovery UX Matrix

This matrix defines which `SafeBoundary` variant should be used for specific component types to ensure a predictable user experience during failures.

## 1. Variant Guidelines

| Variant | Logic | Use Case |
| :--- | :--- | :--- |
| **`silent`** | Renders `null`. | Non-essential slots, spacers, decoration, secondary nav. |
| **`compact`** | Renders "Unavailable" box. | Actionable widgets, Header items, Dashboard cards, Stats. |
| **`inline`** | Renders "⚠️ Error" text. | Data labels, small values, badges. |

---

## 2. Component Mapping (Policy)

| Component Area | Component Name | Variant | Rationale |
| :--- | :--- | :--- | :--- |
| **Shell** | Sidebar (Desktop) | `compact` | Primary navigation; disappearance is confusing. |
| **Shell** | Sidebar (Mobile) | `compact` | Critical for navigation on mobile. |
| **Shell** | BottomNav | `silent` | Can fail without preventing task completion. |
| **Header** | NotificationBell | `compact` | User expects to see the count/bell. |
| **Header** | UserNav | `compact` | Profile access is essential. |
| **Dashboard** | Stats Cards | `compact` | Maintains layout grid and informs user. |
| **Dashboard** | Recent Sales | `compact` | Business critical data. |
| **Audit** | Diff Label | `inline` | Minimalistic; prevents row collapse. |

---

## 3. Decision Rule
If you are unsure which variant to use, ask:
**"If this component disappears entirely, will it prevent the user from knowing where they are or what happened?"**
- Yes -> `compact`
- No -> `silent`
