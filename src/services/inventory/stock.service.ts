/**
 * stock.service.ts — Public Facade
 * ============================================================================
 * Refactored into Domain-Driven Use Cases.
 */

import { StockQuery } from './stock/query';
import { StockMovementService } from './stock/movement';
import { StockAllocation } from './stock/allocation';
import { StockAvailabilityEngine } from './stock/availability.engine';

export * from './stock/movement'; // Export types like CreateStockMovementParams

export const StockService = {
  // Query
  getProductHistory: StockQuery.getProductHistory,

  // Direct Movements
  recordMovement: StockMovementService.recordMovement,
  recordMovements: StockMovementService.recordMovements,

  // Allocation & Reservation
  reserveStock: StockAllocation.reserveStock,
  releaseStock: StockAllocation.releaseStock,
  deductStock: StockAllocation.deductStock,
  bulkReserveStock: StockAllocation.bulkReserveStock,
  bulkReleaseStock: StockAllocation.bulkReleaseStock,
  bulkDeductStock: StockAllocation.bulkDeductStock,

  // Availability Engine
  getAvailability: StockAvailabilityEngine.getAvailability,
  checkBulkAvailability: StockAvailabilityEngine.checkBulkAvailability,
};
