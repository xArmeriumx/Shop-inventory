// ─────────────────────────────────────────────────────────────────────────────
// Barrel: hooks/
//
// ⚠️  RULES:
//   • Client-only hooks ONLY — never import server-only utilities here
//   • Each hook must start with `use` (React convention)
//   • Use explicit named exports — never `export * from './xxx'`
// ─────────────────────────────────────────────────────────────────────────────

export { usePermissions } from './use-permissions';
export { useUrlFilters } from './use-url-filters';
