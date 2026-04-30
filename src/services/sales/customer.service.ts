/**
 * customer.service.ts — Public Facade
 * ============================================================================
 * Refactored into Domain-Driven Use Cases.
 */

import { CustomerQuery } from './customer/query';
import { CustomerCreate } from './customer/create';
import { CustomerUpdate } from './customer/update';
import { CustomerDelete } from './customer/delete';
import { CustomerCreditEngine } from './customer/credit.engine';
import { CustomerAddress } from './customer/address';
import { CustomerBatch } from './customer/batch';

import { ServiceError } from '@/types/domain';

export const CustomerService = {
  // Query
  getList: CustomerQuery.getList,
  getForSelect: CustomerQuery.getForSelect,
  getById: CustomerQuery.getById,
  getProfile: CustomerQuery.getProfile,
  getDeletionImpact: CustomerQuery.getDeletionImpact,

  // Mutation
  create: CustomerCreate.create,
  update: CustomerUpdate.update,
  delete: CustomerDelete.delete,

  // Credit Engine
  checkCreditLimit: CustomerCreditEngine.checkCreditLimit,

  // Address Management
  getAddresses: CustomerAddress.getAddresses,
  getAddressById: CustomerAddress.getAddressById,
  createAddress: CustomerAddress.createAddress,
  updateAddress: CustomerAddress.updateAddress,
  deleteAddress: CustomerAddress.deleteAddress,

  // Batch / Utils
  batchCreate: CustomerBatch.batchCreate,
  getSalespersonsByRegion: CustomerBatch.getSalespersonsByRegion,
};
