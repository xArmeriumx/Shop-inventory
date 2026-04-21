'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { supplierSchema, type SupplierInput } from '@/schemas/supplier';
import type { ActionResponse, SerializedSupplier } from '@/types/domain';
import type { Supplier } from '@prisma/client';
import { SupplierService, ServiceError } from '@/services';

export async function getSuppliersForSelect() {
  const ctx = await requirePermission('PURCHASE_VIEW');
  return SupplierService.getForSelect(ctx);
}

export async function getSuppliers(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}) {
  const ctx = await requirePermission('PURCHASE_VIEW' as any);
  return SupplierService.getAll(ctx, params);
}

export async function getSupplier(id: string) {
  const ctx = await requirePermission('PURCHASE_VIEW' as any);
  try {
    return await SupplierService.getById(id, ctx);
  } catch (error: unknown) {
    if (error instanceof ServiceError) throw new Error(error.message);
    throw error;
  }
}

export async function createSupplier(input: SupplierInput): Promise<ActionResponse<SerializedSupplier>> {
  const ctx = await requirePermission('PURCHASE_CREATE' as any);

  const validated = supplierSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลผู้จำหน่ายไม่ถูกต้อง',
    };
  }

  try {
    const supplier = await SupplierService.create(ctx, validated.data);
    revalidatePath('/suppliers');
    return {
      success: true,
      data: supplier,
      message: 'เพิ่มผู้จำหน่ายสำเร็จ',
    };
  } catch (error: unknown) {
    const typedError = error as Error;
    await logger.error('Create supplier error', typedError, { path: 'createSupplier', userId: ctx.userId });
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการเพิ่มผู้จำหน่าย',
    };
  }
}

export async function updateSupplier(
  id: string,
  input: SupplierInput
): Promise<ActionResponse<SerializedSupplier>> {
  const ctx = await requirePermission('PURCHASE_UPDATE' as any);

  const validated = supplierSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลผู้จำหน่ายไม่ถูกต้อง',
    };
  }

  try {
    const supplier = await SupplierService.update(id, ctx, validated.data);
    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${id}`);
    return {
      success: true,
      data: supplier,
      message: 'อัปเดตข้อมูลผู้จำหน่ายสำเร็จ',
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Update supplier error', typedError, { path: 'updateSupplier', userId: ctx.userId, supplierId: id });
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล',
    };
  }
}

export async function deleteSupplier(id: string): Promise<ActionResponse<void>> {
  const ctx = await requirePermission('PURCHASE_VOID' as any);

  try {
    await SupplierService.delete(id, ctx);
    revalidatePath('/suppliers');
    return {
      success: true,
      message: 'ลบผู้จำหน่ายสำเร็จ',
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Delete supplier error', typedError, { path: 'deleteSupplier', userId: ctx.userId, supplierId: id });
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบผู้จำหน่าย',
    };
  }
}

export async function getSupplierProfile(id: string) {
  const ctx = await requirePermission('PURCHASE_VIEW');
  try {
    return await SupplierService.getProfile(id, ctx);
  } catch (error: unknown) {
    if (error instanceof ServiceError) throw new Error(error.message);
    throw error;
  }
}
