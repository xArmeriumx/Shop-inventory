/**
 * return.service.ts — Public Facade
 * ============================================================================
 * Refactored into Domain-Driven Use Cases.
 */

import { ReturnQuery } from './return/query';
import { ReturnCreate } from './return/create';

export * from './return/create'; // Export types

export const ReturnService = {
  // Queries
  getReturnableSaleItems: ReturnQuery.getReturnableSaleItems,
  getList: ReturnQuery.getList,
  getById: ReturnQuery.getById,

  // Mutations
  create: ReturnCreate.create,
};
