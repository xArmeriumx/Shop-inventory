'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { customerSchema, type CustomerInput } from '@/schemas/sales/customer.schema';
import type { Customer } from '@prisma/client';
import type { SerializedCustomer, GetCustomersParams } from '@/types/domain';
import { CustomerService, ServiceError } from '@/services';
import { Permission } from '@prisma/client';

import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction, type ActionResponse } from '@/lib/action-handler';

export async function getCustomers(params: GetCustomersParams = {}): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('CUSTOMER_VIEW');
      return CustomerService.getAll(ctx, params);
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
      return CustomerService.create(ctx, validated);
    }, 'sales:createCustomer');
  }, { context: { action: 'sales:createCustomer' } });
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<ActionResponse<SerializedCustomer>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission(Permission.CUSTOMER_UPDATE);
      const validated = customerSchema.parse(input);
      const customer = await CustomerService.update(id, ctx, validated);
      revalidatePath('/customers');
      revalidatePath(`/customers/${id}`);
      return customer;
    }, 'sales:updateCustomer');
  }, { context: { action: 'sales:updateCustomer', id } });
}

export async function deleteCustomer(id: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('CUSTOMER_DELETE');
      await CustomerService.delete(id, ctx);
      revalidatePath('/customers');
      return null;
    }, 'sales:deleteCustomer');
  }, { context: { action: 'sales:deleteCustomer', id } });
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
