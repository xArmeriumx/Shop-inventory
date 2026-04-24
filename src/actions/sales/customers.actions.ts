'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { customerSchema, type CustomerInput } from '@/schemas/sales/customer.schema';
import type { Customer } from '@prisma/client';
import type { ActionResponse, SerializedCustomer, GetCustomersParams } from '@/types/domain';
import { CustomerService, ServiceError } from '@/services';

export async function getCustomers(params: GetCustomersParams = {}) {
  const ctx = await requirePermission('CUSTOMER_VIEW');
  return CustomerService.getAll(ctx, params);
}

export async function getCustomer(id: string) {
  const ctx = await requirePermission('CUSTOMER_VIEW');
  try {
    return await CustomerService.getById(id, ctx);
  } catch (error: unknown) {
    if (error instanceof ServiceError) throw new Error(error.message);
    throw error;
  }
}

export async function createCustomer(input: CustomerInput): Promise<ActionResponse<SerializedCustomer>> {
  const ctx = await requirePermission('CUSTOMER_CREATE' as any);

  const validated = customerSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบความถูกต้อง',
    };
  }

  try {
    const customer = await CustomerService.create(ctx, validated.data);
    revalidatePath('/customers');
    return {
      success: true,
      message: 'บันทึกข้อมูลลูกค้าสำเร็จ',
      data: customer,
    };
  } catch (error: unknown) {
    const typedError = error as Error;
    await logger.error('Create customer error', typedError, { path: 'createCustomer', userId: ctx.userId });
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง',
    };
  }
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<ActionResponse<SerializedCustomer>> {
  const ctx = await requirePermission('CUSTOMER_UPDATE' as any);

  const validated = customerSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบความถูกต้อง',
    };
  }

  try {
    const customer = await CustomerService.update(id, ctx, validated.data);
    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return {
      success: true,
      message: 'อัปเดตข้อมูลลูกค้าสำเร็จ',
      data: customer,
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Update customer error', typedError, { path: 'updateCustomer', userId: ctx.userId, customerId: id });
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล',
    };
  }
}

export async function deleteCustomer(id: string): Promise<ActionResponse> {
  const ctx = await requirePermission('CUSTOMER_DELETE');

  try {
    await CustomerService.delete(id, ctx);
    revalidatePath('/customers');
    return {
      success: true,
      message: 'ลบข้อมูลลูกค้าสำเร็จ',
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Delete customer error', typedError, { path: 'deleteCustomer', userId: ctx.userId, customerId: id });
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบข้อมูล (อาจมีการใช้งานลูกค้ารายนี้ในรายการขาย)',
    };
  }
}

export async function getCustomersForSelect() {
  const ctx = await requirePermission('CUSTOMER_VIEW');
  return CustomerService.getForSelect(ctx);
}

export async function getCustomerProfile(id: string) {
  const ctx = await requirePermission('CUSTOMER_VIEW');
  try {
    return await CustomerService.getProfile(id, ctx);
  } catch (error: unknown) {
    if (error instanceof ServiceError) throw new Error(error.message);
    throw error;
  }
}
