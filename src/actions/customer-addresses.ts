'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { requirePermission } from '@/lib/auth-guard';
import { customerAddressSchema } from '@/schemas/customer-address';
import type { CustomerAddressInput } from '@/schemas/customer-address';
import type { ActionResponse } from '@/types/action-response';

// Get addresses for a customer
export async function getCustomerAddresses(customerId: string) {
  const ctx = await requirePermission('CUSTOMER_VIEW');

  const addresses = await db.customerAddress.findMany({
    where: {
      customerId,
      shopId: ctx.shopId,
      deletedAt: null,
    },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return addresses;
}

// Create address
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

  const data = validated.data;

  try {
    // Verify customer belongs to this shop
    const customer = await db.customer.findFirst({
      where: { id: data.customerId, shopId: ctx.shopId, deletedAt: null },
    });

    if (!customer) {
      throw new Error('ไม่พบข้อมูลลูกค้า');
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await db.customerAddress.updateMany({
        where: { customerId: data.customerId, shopId: ctx.shopId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await db.customerAddress.create({
      data: {
        ...data,
        shopId: ctx.shopId,
      },
    });

    revalidatePath('/customers');
    return {
      success: true,
      message: 'เพิ่มที่อยู่สำเร็จ',
      data: address,
    };
  } catch (error: any) {
    await logger.error('Failed to create customer address', error, {
      path: 'createCustomerAddress',
      userId: ctx.userId,
    });
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาด',
    };
  }
}

// Update address
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

  const data = validated.data;

  try {
    const existing = await db.customerAddress.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) {
      throw new Error('ไม่พบข้อมูลที่อยู่');
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await db.customerAddress.updateMany({
        where: {
          customerId: data.customerId,
          shopId: ctx.shopId,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    await db.customerAddress.update({
      where: { id },
      data,
    });

    revalidatePath('/customers');
    return {
      success: true,
      message: 'อัพเดทที่อยู่สำเร็จ',
    };
  } catch (error: any) {
    await logger.error('Failed to update customer address', error, {
      path: 'updateCustomerAddress',
      userId: ctx.userId,
    });
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาด',
    };
  }
}

// Soft delete address
export async function deleteCustomerAddress(id: string): Promise<ActionResponse> {
  const ctx = await requirePermission('CUSTOMER_EDIT');

  try {
    const existing = await db.customerAddress.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) {
      throw new Error('ไม่พบข้อมูลที่อยู่');
    }

    await db.customerAddress.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath('/customers');
    return {
      success: true,
      message: 'ลบที่อยู่สำเร็จ',
    };
  } catch (error: any) {
    await logger.error('Failed to delete customer address', error, {
      path: 'deleteCustomerAddress',
      userId: ctx.userId,
    });
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาด',
    };
  }
}
