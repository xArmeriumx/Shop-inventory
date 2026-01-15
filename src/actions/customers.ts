'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAuth, requirePermission, getCurrentUserId } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';
import { customerSchema, type CustomerInput } from '@/schemas/customer';
import type { Customer } from '@prisma/client';
import type { ActionResponse } from '@/types/action-response';

interface GetCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getCustomers(params: GetCustomersParams = {}) {
  const userId = await getCurrentUserId();
  const { page = 1, limit = 20, search } = params;

  const searchFilter = buildSearchFilter(search, ['name', 'phone', 'address']);

  const where = {
    userId,
    ...(searchFilter && searchFilter),
    deletedAt: null, // Only active customers
  };

  return paginatedQuery<Customer>(db.customer, {
    where,
    page,
    limit,
    orderBy: { name: 'asc' },
  });
}

export async function getCustomer(id: string) {
  const userId = await getCurrentUserId();

  const customer = await db.customer.findFirst({
    where: { id, userId, deletedAt: null },
  });

  if (!customer) {
    throw new Error('ไม่พบข้อมูลลูกค้า');
  }

  return customer;
}

export async function createCustomer(input: CustomerInput): Promise<ActionResponse<Customer>> {
  // RBAC: Require CUSTOMER_CREATE permission
  const ctx = await requirePermission('CUSTOMER_CREATE');

  const validated = customerSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบความถูกต้อง',
    };
  }

  try {
    const customer = await db.customer.create({
      data: {
        ...validated.data,
        name: validated.data.name,
        phone: validated.data.phone || null,
        address: validated.data.address || null,
        taxId: validated.data.taxId || null,
        notes: validated.data.notes || null,
        userId: ctx.userId,
        shopId: ctx.shopId,  // RBAC: Set shopId for new customer
      },
    });

    revalidatePath('/customers');
    return {
      success: true,
      message: 'บันทึกข้อมูลลูกค้าสำเร็จ',
      data: customer,
    };
  } catch (error) {
    console.error('Create customer error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง',
    };
  }
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<ActionResponse<Customer>> {
  // RBAC: Require CUSTOMER_EDIT permission
  const ctx = await requirePermission('CUSTOMER_EDIT');

  const validated = customerSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบความถูกต้อง',
    };
  }

  const existing = await db.customer.findFirst({
    where: { id, userId: ctx.userId, deletedAt: null },
  });

  if (!existing) {
    return {
      success: false,
      message: 'ไม่พบข้อมูลลูกค้า หรือลูกค้าถูกลบไปแล้ว',
    };
  }

  try {
    const customer = await db.customer.update({
      where: { id },
      data: {
        ...validated.data,
        name: validated.data.name,
        phone: validated.data.phone || null,
        address: validated.data.address || null,
        taxId: validated.data.taxId || null,
        notes: validated.data.notes || null,
      },
    });

    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    
    return {
      success: true,
      message: 'อัปเดตข้อมูลลูกค้าสำเร็จ',
      data: customer,
    };
  } catch (error) {
    console.error('Update customer error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล',
    };
  }
}

export async function deleteCustomer(id: string): Promise<ActionResponse> {
  // RBAC: Require CUSTOMER_DELETE permission
  const ctx = await requirePermission('CUSTOMER_DELETE');

  const existing = await db.customer.findFirst({
    where: { id, userId: ctx.userId, deletedAt: null },
  });

  if (!existing) {
    return {
      success: false,
      message: 'ไม่พบข้อมูลลูกค้า',
    };
  }

  try {
    // Soft delete
    await db.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath('/customers');
    return {
      success: true,
      message: 'ลบข้อมูลลูกค้าสำเร็จ',
    };
  } catch (error) {
    console.error('Delete customer error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบข้อมูล (อาจมีการใช้งานลูกค้ารายนี้ในรายการขาย)',
    };
  }
}

export async function getCustomersForSelect() {
  const userId = await getCurrentUserId();

  return db.customer.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, name: true, phone: true, address: true, taxId: true },
    orderBy: { name: 'asc' },
  });
}
