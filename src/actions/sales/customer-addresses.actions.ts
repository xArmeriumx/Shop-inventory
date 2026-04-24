'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { partnerAddressSchema } from '@/schemas/core/partner-common.schema';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { CustomerService, ServiceError } from '@/services';

export async function getCustomerAddresses(customerId: string): Promise<ActionResponse<any[]>> {
  return handleAction(async () => {
    const ctx = await requirePermission('CUSTOMER_VIEW' as any);
    return CustomerService.getAddresses(customerId, ctx);
  }, { context: { action: 'getCustomerAddresses', customerId } });
}

export async function createCustomerAddress(input: any): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const ctx = await requirePermission('CUSTOMER_UPDATE');
    const validated = partnerAddressSchema.parse(input);
    const address = await CustomerService.createAddress(input.customerId, ctx, validated);
    revalidatePath('/customers');
    return address;
  }, { context: { action: 'createCustomerAddress', customerId: input.customerId } });
}

export async function updateCustomerAddress(id: string, input: any): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('CUSTOMER_UPDATE');
    const validated = partnerAddressSchema.parse(input);
    await CustomerService.updateAddress(id, ctx, validated);
    revalidatePath('/customers');
    return null;
  }, { context: { action: 'updateCustomerAddress', addressId: id } });
}

export async function deleteCustomerAddress(id: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('CUSTOMER_UPDATE');
    await CustomerService.deleteAddress(id, ctx);
    revalidatePath('/customers');
    return null;
  }, { context: { action: 'deleteCustomerAddress', addressId: id } });
}
