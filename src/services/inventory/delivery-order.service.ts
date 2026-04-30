/**
 * delivery-order.service.ts — Public Facade
 * ============================================================================
 * Refactored into Domain-Driven Use Cases.
 */

import { DeliveryOrderQuery } from './delivery-order/query';
import { DeliveryOrderCreate } from './delivery-order/create';
import { DeliveryOrderAvailabilityEngine } from './delivery-order/availability.engine';
import { DeliveryOrderCancel } from './delivery-order/cancel';

export const DeliveryOrderService = {
    // Query
    list: DeliveryOrderQuery.list,
    getById: DeliveryOrderQuery.getById,

    // Mutation
    create: DeliveryOrderCreate.create,
    checkAvailability: DeliveryOrderAvailabilityEngine.checkAvailability,
    validate: DeliveryOrderAvailabilityEngine.validate,
    cancel: DeliveryOrderCancel.cancel,
};
