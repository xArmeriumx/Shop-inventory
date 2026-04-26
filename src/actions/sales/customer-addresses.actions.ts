'use server';

import { revalidateTag } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { partnerAddressSchema } from '@/schemas/core/partner-common.schema';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { CustomerService } from '@/services';

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
    const result = await CustomerService.createAddress(input.customerId, ctx, validated);
    
    if (result.affectedTags) {
      result.affectedTags.forEach((tag: string) => revalidateTag(tag));
    }

    return result.data;
  }, { context: { action: 'createCustomerAddress', customerId: input.customerId } });
}

export async function updateCustomerAddress(id: string, input: any): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('CUSTOMER_UPDATE');
    const validated = partnerAddressSchema.parse(input);
    const result = await CustomerService.updateAddress(id, ctx, validated);
    
    if (result.affectedTags) {
      result.affectedTags.forEach((tag: string) => revalidateTag(tag));
    }

    return null;
  }, { context: { action: 'updateCustomerAddress', addressId: id } });
}

export async function deleteCustomerAddress(id: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('CUSTOMER_UPDATE');
    const result = await CustomerService.deleteAddress(id, ctx);
    
    if (result.affectedTags) {
      result.affectedTags.forEach((tag: string) => revalidateTag(tag));
    }

    return null;
  }, { context: { action: 'deleteCustomerAddress', addressId: id } });
}
