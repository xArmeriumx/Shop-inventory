/**
 * shipment.service.ts — Public Facade for Shipments operations
 * ============================================================================
 * Refactored into Domain-Driven Use Cases.
 * Public API remains unchanged.
 */

import { IShippingService } from '@/types/service-contracts';

import { ShipmentQueryService } from './shipment/query';
import { ShipmentCreateUseCase } from './shipment/create';
import { ShipmentDispatchUseCase } from './shipment/dispatch';
import { ShipmentCancelUseCase } from './shipment/cancel';

export type { OcrParcel, ParcelMatch } from './shipment/helpers';
export { STATUS_LABELS, validateTransition, getAllowedTransitions } from './shipment/helpers';

export const ShipmentService: IShippingService = {
  // Query Operations
  getList: ShipmentQueryService.getList,
  getById: ShipmentQueryService.getById,
  getSalesWithoutShipment: ShipmentQueryService.getSalesWithoutShipment,
  getStats: ShipmentQueryService.getStats,
  calculateLoad: ShipmentQueryService.calculateLoad,
  matchParcelsToSales: ShipmentQueryService.matchParcelsToSales,
  getLogisticsGaps: ShipmentQueryService.getLogisticsGaps,

  // Create & Update
  create: ShipmentCreateUseCase.create,
  update: ShipmentCreateUseCase.update,

  // Dispatch & Route
  updateStatus: ShipmentDispatchUseCase.updateStatus,
  updateStatusWithSync: ShipmentDispatchUseCase.updateStatusWithSync,
  updateDispatchSequence: ShipmentDispatchUseCase.updateDispatchSequence,
  processRoute: ShipmentDispatchUseCase.processRoute,

  // Cancel & Delete
  cancel: ShipmentCancelUseCase.cancel,
  delete: ShipmentCancelUseCase.delete,
};
