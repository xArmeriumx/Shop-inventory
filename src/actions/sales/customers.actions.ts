'use server';

import { revalidateTag } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { customerSchema, type CustomerInput } from '@/schemas/sales/customer.schema';
import type { SerializedCustomer, GetCustomersParams } from '@/types/domain';
import { CustomerService } from '@/services';
import { Permission } from '@prisma/client';

import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction, type ActionResponse } from '@/lib/action-handler';

export async function getCustomers(params: GetCustomersParams = {}): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('CUSTOMER_VIEW');
      return CustomerService.getList(params, ctx);
    }, 'sales:getCustomers');
  }, { context: { action: 'sales:getCustomers', ...params } });
}

export async function getCustomer(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('CUSTOMER_VIEW');
      return CustomerService.getById(id, ctx);
    }, 'sales:getCustomer');
  }, { context: { action: 'sales:getCustomer', id } });
}

export async function createCustomer(input: CustomerInput): Promise<ActionResponse<SerializedCustomer>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission(Permission.CUSTOMER_CREATE);
      const validated = customerSchema.parse(input);
      const result = await CustomerService.create(ctx, validated);

      if (result.affectedTags) {
        result.affectedTags.forEach((tag: string) => revalidateTag(tag));
      }

      return result.data;
    }, 'sales:createCustomer');
  }, { context: { action: 'sales:createCustomer' } });
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<ActionResponse<SerializedCustomer>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission(Permission.CUSTOMER_UPDATE);
      const validated = customerSchema.parse(input);
      const result = await CustomerService.update(id, ctx, validated);

      if (result.affectedTags) {
        result.affectedTags.forEach((tag: string) => revalidateTag(tag));
      }

      return result.data;
    }, 'sales:updateCustomer');
  }, { context: { action: 'sales:updateCustomer', id } });
}

export async function deleteCustomer(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('CUSTOMER_DELETE');
      const result = await CustomerService.delete(id, ctx);

      if (result.affectedTags) {
        result.affectedTags.forEach((tag: string) => revalidateTag(tag));
      }

      return result.data;
    }, 'sales:deleteCustomer');
  }, { context: { action: 'sales:deleteCustomer', id } });
}

export async function getCustomerDeletionImpact(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('CUSTOMER_VIEW');
      return CustomerService.getDeletionImpact(id, ctx);
    }, 'sales:getCustomerDeletionImpact');
  }, { context: { action: 'sales:getCustomerDeletionImpact', id } });
}

export async function getCustomersForSelect(): Promise<ActionResponse<any[]>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('CUSTOMER_VIEW');
      return CustomerService.getForSelect(ctx);
    }, 'sales:getCustomersForSelect');
  }, { context: { action: 'sales:getCustomersForSelect' } });
}

export async function getCustomerProfile(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('CUSTOMER_VIEW');
      return CustomerService.getProfile(id, ctx);
    }, 'sales:getCustomerProfile');
  }, { context: { action: 'sales:getCustomerProfile', id } });
}
