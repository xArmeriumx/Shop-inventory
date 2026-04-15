'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { customerAddressSchema, type CustomerAddressInput } from '@/schemas/customer-address';
import type { ActionResponse } from '@/types/domain';
import { CustomerService, ServiceError } from '@/services';

export async function getCustomerAddresses(customerId: string) {
  const ctx = await requirePermission('CUSTOMER_VIEW');
  return CustomerService.getAddresses(customerId, ctx);
}

export async function createCustomerAddress(input: CustomerAddressInput): Promise<ActionResponse> {
  const ctx = await requirePermission('CUSTOMER_EDIT');

  const validated = customerAddressSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลที่อยู่ไม่ถูกต้อง',
    };
  }

  try {
    const address = await CustomerService.createAddress(validated.data.customerId, ctx, validated.data);
    revalidatePath('/customers');
    return {
      success: true,
      message: 'เพิ่มที่อยู่สำเร็จ',
      data: address,
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Failed to create customer address', typedError, { path: 'createCustomerAddress', userId: ctx.userId });
    return {
      success: false,
      message: typedError.message || 'เกิดข้อผิดพลาด',
    };
  }
}

export async function updateCustomerAddress(id: string, input: CustomerAddressInput): Promise<ActionResponse> {
  const ctx = await requirePermission('CUSTOMER_EDIT');

  const validated = customerAddressSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลที่อยู่ไม่ถูกต้อง',
    };
  }

  try {
    await CustomerService.updateAddress(id, ctx, validated.data);
    revalidatePath('/customers');
    return {
      success: true,
      message: 'อัพเดทที่อยู่สำเร็จ',
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Failed to update customer address', typedError, { path: 'updateCustomerAddress', userId: ctx.userId });
    return {
      success: false,
      message: typedError.message || 'เกิดข้อผิดพลาด',
    };
  }
}

export async function deleteCustomerAddress(id: string): Promise<ActionResponse> {
  const ctx = await requirePermission('CUSTOMER_EDIT');

  try {
    await CustomerService.deleteAddress(id, ctx);
    revalidatePath('/customers');
    return {
      success: true,
      message: 'ลบที่อยู่สำเร็จ',
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Failed to delete customer address', typedError, { path: 'deleteCustomerAddress', userId: ctx.userId });
    return {
      success: false,
      message: typedError.message || 'เกิดข้อผิดพลาด',
    };
  }
}
