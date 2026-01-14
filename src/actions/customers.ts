'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';
import { customerSchema, type CustomerInput } from '@/schemas/customer';
import type { Customer } from '@prisma/client';

interface GetCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getCustomers(params: GetCustomersParams = {}) {
  const userId = await getCurrentUserId();
  const { page = 1, limit = 20, search } = params;

  const searchFilter = buildSearchFilter(search, ['name', 'phone', 'email']);

  const where = {
    userId,
    ...(searchFilter && searchFilter),
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
    where: { id, userId },
  });

  if (!customer) {
    throw new Error('ไม่พบข้อมูลลูกค้า');
  }

  return customer;
}

export async function createCustomer(input: CustomerInput) {
  const userId = await getCurrentUserId();

  const validated = customerSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const customer = await db.customer.create({
      data: {
        ...validated.data,
        name: validated.data.name,
        phone: validated.data.phone || null,
        address: validated.data.address || null,
        notes: validated.data.notes || null,
        userId,
      },
    });

    revalidatePath('/customers');
    return { data: customer };
  } catch (error) {
    console.error('Create customer error:', error);
    return { error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

export async function updateCustomer(id: string, input: CustomerInput) {
  const userId = await getCurrentUserId();

  const validated = customerSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const existing = await db.customer.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return { error: { _form: ['ไม่พบข้อมูลลูกค้า'] } };
  }

  try {
    const customer = await db.customer.update({
      where: { id },
      data: {
        ...validated.data,
        name: validated.data.name,
        phone: validated.data.phone || null,
        address: validated.data.address || null,
        notes: validated.data.notes || null,
      },
    });

    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return { data: customer };
  } catch (error) {
    console.error('Update customer error:', error);
    return { error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

export async function deleteCustomer(id: string) {
  const userId = await getCurrentUserId();

  const existing = await db.customer.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return { error: 'ไม่พบข้อมูลลูกค้า' };
  }

  try {
    await db.customer.delete({
      where: { id },
    });

    revalidatePath('/customers');
    return { success: true };
  } catch (error) {
    console.error('Delete customer error:', error);
    return { error: 'เกิดข้อผิดพลาด หรือลูกค้ามีการขายเกิดขึ้นแล้ว (ไม่สามารถลบได้)' };
  }
}

export async function getCustomersForSelect() {
  const userId = await getCurrentUserId();

  return db.customer.findMany({
    where: { userId },
    select: { id: true, name: true, phone: true },
    orderBy: { name: 'asc' },
  });
}
