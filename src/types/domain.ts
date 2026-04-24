/**
 * ============================================================================
 * ERP Domain Types - Unified Barrel (Phase 8 Refactored)
 * ============================================================================
 * 
 * NOTE: New code should import directly from the domain-specific type files:
 * - @/types/common
 * - @/services/sales/sales.types
 * - ... etc.
 */

export * from './common';
export * from '../services/sales/sales.types';
export * from '../services/purchases/purchases.types';
export * from '../services/inventory/inventory.types';
export * from '../services/accounting/accounting.types';
export * from '../services/core/core.types';
export * from './onboarding.types';
export * from './dtos/sales.dto';


// Backward compatibility for any remaining direct references
export * from './serialized';
