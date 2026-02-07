'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requirePermission, getCurrentUserId } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';
import { supplierSchema, type SupplierInput } from '@/schemas/supplier';
import type { ActionResponse } from '@/types/action-response';
import type { Supplier } from '@prisma/client';
import { toNumber } from '@/lib/money';

// Get all suppliers for select/combobox
export async function getSuppliersForSelect() {
  const ctx = await requirePermission('SUPPLIER_VIEW');
  
  return db.supplier.findMany({
    where: {
      shopId: ctx.shopId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      code: true,
      phone: true,
    },
    orderBy: { name: 'asc' },
  });
}

// Get paginated suppliers
export async function getSuppliers(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}) {
  const ctx = await requirePermission('SUPPLIER_VIEW');
  const { page = 1, limit = 20, search } = params;
  
  const searchFilter = buildSearchFilter(search, ['name', 'code', 'phone', 'email', 'contactName']);
  
  return paginatedQuery(db.supplier, {
    where: {
      shopId: ctx.shopId,
      deletedAt: null,
      ...searchFilter,
    },
    include: {
      _count: {
        select: { purchases: true },
      },
    },
    page,
    limit,
    orderBy: { name: 'asc' },
  });
}

// Get single supplier
export async function getSupplier(id: string) {
  const ctx = await requirePermission('SUPPLIER_VIEW');
  
  const supplier = await db.supplier.findFirst({
    where: {
      id,
      shopId: ctx.shopId,
      deletedAt: null,
    },
    include: {
      _count: {
        select: { purchases: true },
      },
    },
  });
  
  if (!supplier) {
    throw new Error('ไม่พบข้อมูลผู้จำหน่าย');
  }
  
  return supplier;
}

// Create supplier
export async function createSupplier(input: SupplierInput): Promise<ActionResponse<Supplier>> {
  const ctx = await requirePermission('SUPPLIER_CREATE');
  const userId = await getCurrentUserId();
  
  const validated = supplierSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลผู้จำหน่ายไม่ถูกต้อง',
    };
  }
  
  try {
    const supplier = await db.supplier.create({
      data: {
        ...validated.data,
        userId,
        shopId: ctx.shopId,
      },
    });
    
    revalidatePath('/suppliers');
    
    return {
      success: true,
      data: supplier,
      message: 'เพิ่มผู้จำหน่ายสำเร็จ',
    };
  } catch (error) {
    console.error('Create supplier error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการเพิ่มผู้จำหน่าย',
    };
  }
}

// Update supplier
export async function updateSupplier(
  id: string,
  input: SupplierInput
): Promise<ActionResponse<Supplier>> {
  const ctx = await requirePermission('SUPPLIER_EDIT');
  
  const validated = supplierSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลผู้จำหน่ายไม่ถูกต้อง',
    };
  }
  
  try {
    const supplier = await db.supplier.update({
      where: {
        id,
        shopId: ctx.shopId,
        deletedAt: null,
      },
      data: validated.data,
    });
    
    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${id}`);
    
    return {
      success: true,
      data: supplier,
      message: 'อัปเดตข้อมูลผู้จำหน่ายสำเร็จ',
    };
  } catch (error) {
    console.error('Update supplier error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล',
    };
  }
}

// Soft delete supplier
export async function deleteSupplier(id: string): Promise<ActionResponse<void>> {
  const ctx = await requirePermission('SUPPLIER_DELETE');
  
  try {
    // Check if supplier has purchases
    const purchaseCount = await db.purchase.count({
      where: { supplierId: id },
    });
    
    if (purchaseCount > 0) {
      return {
        success: false,
        message: `ไม่สามารถลบผู้จำหน่ายที่มีประวัติการซื้อ ${purchaseCount} รายการ`,
      };
    }
    
    await db.supplier.update({
      where: {
        id,
        shopId: ctx.shopId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
    
    revalidatePath('/suppliers');
    
    return {
      success: true,
      message: 'ลบผู้จำหน่ายสำเร็จ',
    };
  } catch (error) {
    console.error('Delete supplier error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบผู้จำหน่าย',
    };
  }
}

// =============================================================================
// SUPPLIER PROFILE (Full detail with purchases + stats)
// =============================================================================

export async function getSupplierProfile(id: string) {
  const ctx = await requirePermission('SUPPLIER_VIEW');

  const [supplier, purchases, stats] = await Promise.all([
    // 1. Supplier info
    db.supplier.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    }),

    // 2. Recent purchases (latest 10)
    db.purchase.findMany({
      where: { supplierId: id, shopId: ctx.shopId },
      select: {
        id: true,
        date: true,
        totalCost: true,
        status: true,
        items: {
          select: {
            quantity: true,
            product: { select: { name: true } },
          },
          take: 3,
        },
      },
      orderBy: { date: 'desc' },
      take: 10,
    }),

    // 3. Summary stats
    db.purchase.aggregate({
      where: {
        supplierId: id,
        shopId: ctx.shopId,
        status: { not: 'CANCELLED' },
      },
      _sum: { totalCost: true },
      _count: true,
    }),
  ]);

  if (!supplier) {
    throw new Error('ไม่พบข้อมูลผู้จำหน่าย');
  }

  // Get last purchase date
  const lastPurchase = purchases.length > 0 ? purchases[0] : null;

  return {
    supplier,
    purchases: purchases.map(p => ({
      ...p,
      totalCost: toNumber(p.totalCost),
    })),
    stats: {
      totalSpend: toNumber(stats._sum?.totalCost),
      orderCount: stats._count,
      lastPurchaseDate: lastPurchase?.date || null,
    },
  };
}
