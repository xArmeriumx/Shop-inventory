'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAuth, requirePermission, getCurrentUserId } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { LookupTypeCode } from '@prisma/client';

// ==================== Schemas ====================

const createLookupValueSchema = z.object({
  name: z.string().min(1, 'กรุณาระบุชื่อ'),
  code: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().optional(),
});

const updateLookupValueSchema = z.object({
  name: z.string().min(1, 'กรุณาระบุชื่อ').optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().optional(),
  isActive: z.boolean().optional(),
});

// ==================== Types ====================

export type LookupValueState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ==================== Read Operations ====================

export async function getLookupTypes() {
  const types = await db.lookupType.findMany({
    orderBy: { name: 'asc' },
  });
  return types;
}

export async function getLookupValues(typeCode: LookupTypeCode) {
  const ctx = await requireAuth();

  // Get lookup type first
  const lookupType = await db.lookupType.findUnique({
    where: { code: typeCode },
  });

  if (!lookupType) {
    return [];
  }

  // Get values: system (shopId = null, isSystem = true) + shop-specific
  // Note: We'll filter by shopId OR isSystem
  const values = await db.lookupValue.findMany({
    where: {
      lookupTypeId: lookupType.id,
      isActive: true,
      deletedAt: null,
      OR: [
        { isSystem: true },
        { shopId: ctx.shopId },
      ],
    },
    orderBy: [
      { isDefault: 'desc' },
      { order: 'asc' },
      { name: 'asc' },
    ],
  });

  return values;
}

export async function getLookupValuesForSettings(typeCode: LookupTypeCode) {
  const ctx = await requirePermission('SETTINGS_LOOKUPS');

  const lookupType = await db.lookupType.findUnique({
    where: { code: typeCode },
  });

  if (!lookupType) {
    return [];
  }

  // Get only shop-specific values for editing
  const values = await db.lookupValue.findMany({
    where: {
      lookupTypeId: lookupType.id,
      shopId: ctx.shopId,
      deletedAt: null,
    },
    orderBy: [
      { order: 'asc' },
      { name: 'asc' },
    ],
  });

  return values;
}


// ==================== Quick Add (for inline dropdowns) ====================

/**
 * Quick add a category without form data - for inline dropdowns
 * Returns the created category with id and name
 */
export async function quickAddCategory(
  typeCode: LookupTypeCode,
  name: string
): Promise<{ success: boolean; data?: { id: string; name: string }; error?: string }> {
  const ctx = await requireAuth();
  
  if (!name || name.trim().length === 0) {
    return { success: false, error: 'กรุณาระบุชื่อหมวดหมู่' };
  }

  const trimmedName = name.trim();

  try {
    const lookupType = await db.lookupType.findUnique({
      where: { code: typeCode },
    });

    if (!lookupType) {
      return { success: false, error: 'ไม่พบประเภทหมวดหมู่' };
    }

    // Generate code from name
    const code = trimmedName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_\u0E00-\u0E7F]/g, '');

    // Check for duplicate by name (more user-friendly)
    const existing = await db.lookupValue.findFirst({
      where: {
        lookupTypeId: lookupType.id,
        deletedAt: null,
        OR: [
          { shopId: ctx.shopId, name: trimmedName },
          { isSystem: true, name: trimmedName },
        ],
      },
    });

    if (existing) {
      return { success: false, error: 'มีหมวดหมู่นี้อยู่แล้ว' };
    }

    // Get max order
    const maxOrder = await db.lookupValue.aggregate({
      where: {
        lookupTypeId: lookupType.id,
        shopId: ctx.shopId,
      },
      _max: { order: true },
    });

    const created = await db.lookupValue.create({
      data: {
        lookupTypeId: lookupType.id,
        shopId: ctx.shopId,
        userId: ctx.userId,
        code: code || `custom_${Date.now()}`,
        name: trimmedName,
        order: (maxOrder._max.order || 0) + 1,
      },
    });

    return { 
      success: true, 
      data: { id: created.id, name: created.name } 
    };
  } catch (error) {
    await logger.error('Quick add category error', error as Error, { path: 'quickAddCategory', typeCode });
    return { success: false, error: 'เกิดข้อผิดพลาดในการบันทึก' };
  }
}

// ==================== Write Operations ====================

export async function createLookupValue(
  typeCode: LookupTypeCode,
  prevState: LookupValueState,
  formData: FormData
): Promise<LookupValueState> {
  // RBAC: Require SETTINGS_LOOKUPS permission
  const ctx = await requirePermission('SETTINGS_LOOKUPS');

  const rawData = {
    name: formData.get('name'),
    color: formData.get('color') || undefined,
    icon: formData.get('icon') || undefined,
  };

  const validated = createLookupValueSchema.safeParse(rawData);

  if (!validated.success) {
    return {
      error: 'ข้อมูลไม่ถูกต้อง',
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    const lookupType = await db.lookupType.findUnique({
      where: { code: typeCode },
    });

    if (!lookupType) {
      return { error: 'ไม่พบประเภทหมวดหมู่' };
    }

    // Generate code from name
    const code = validated.data.name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    // Check for duplicate
    const existing = await db.lookupValue.findFirst({
      where: {
        lookupTypeId: lookupType.id,
        shopId: ctx.shopId,
        code: code,
        deletedAt: null,
      },
    });

    if (existing) {
      return { error: 'มีหมวดหมู่นี้อยู่แล้ว' };
    }

    // Get max order
    const maxOrder = await db.lookupValue.aggregate({
      where: {
        lookupTypeId: lookupType.id,
        shopId: ctx.shopId,
      },
      _max: { order: true },
    });

    await db.lookupValue.create({
      data: {
        lookupTypeId: lookupType.id,
        shopId: ctx.shopId, // Set shopId
        userId: ctx.userId, // Keep userId for audit if needed, or make it optional in schema? Schema says userId String?
        code: code,
        name: validated.data.name,
        color: validated.data.color,
        icon: validated.data.icon,
        order: (maxOrder._max.order || 0) + 1,
      },
    });

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    await logger.error('Create lookup value error', error as Error, { path: 'createLookupValue', typeCode });
    return { error: 'เกิดข้อผิดพลาดในการบันทึก' };
  }
}

export async function updateLookupValue(
  id: string,
  prevState: LookupValueState,
  formData: FormData
): Promise<LookupValueState> {
  // RBAC: Require SETTINGS_LOOKUPS permission
  const ctx = await requirePermission('SETTINGS_LOOKUPS');

  const rawData = {
    name: formData.get('name') || undefined,
    color: formData.get('color') || undefined,
    icon: formData.get('icon') || undefined,
  };

  const validated = updateLookupValueSchema.safeParse(rawData);

  if (!validated.success) {
    return {
      error: 'ข้อมูลไม่ถูกต้อง',
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    // Verify ownership
    const existing = await db.lookupValue.findFirst({
      where: {
        id,
        shopId: ctx.shopId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return { error: 'ไม่พบข้อมูล หรือไม่มีสิทธิ์แก้ไข' };
    }

    if (existing.isSystem) {
      return { error: 'ไม่สามารถแก้ไขข้อมูลระบบได้' };
    }

    await db.lookupValue.update({
      where: { id },
      data: {
        name: validated.data.name,
        color: validated.data.color,
        icon: validated.data.icon,
      },
    });

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    await logger.error('Update lookup value error', error as Error, { path: 'updateLookupValue', lookupId: id });
    return { error: 'เกิดข้อผิดพลาดในการบันทึก' };
  }
}

export async function deleteLookupValue(id: string): Promise<LookupValueState> {
  // RBAC: Require SETTINGS_LOOKUPS permission
  const ctx = await requirePermission('SETTINGS_LOOKUPS');

  try {
    const existing = await db.lookupValue.findFirst({
      where: {
        id,
        shopId: ctx.shopId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            products: true,
            expenses: true,
          },
        },
      },
    });

    if (!existing) {
      return { error: 'ไม่พบข้อมูล หรือไม่มีสิทธิ์ลบ' };
    }

    if (existing.isSystem) {
      return { error: 'ไม่สามารถลบข้อมูลระบบได้' };
    }

    // Check if in use
    const inUseCount = existing._count.products + existing._count.expenses;
    if (inUseCount > 0) {
      return { 
        error: `ไม่สามารถลบได้ เนื่องจากมีข้อมูล ${inUseCount} รายการใช้หมวดหมู่นี้อยู่` 
      };
    }

    // Soft delete
    await db.lookupValue.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    await logger.error('Delete lookup value error', error as Error, { path: 'deleteLookupValue', lookupId: id });
    return { error: 'เกิดข้อผิดพลาดในการลบ' };
  }
}

// ==================== Seed Default Values ====================

export async function seedDefaultLookupValues() {
  const ctx = await requirePermission('SETTINGS_LOOKUPS'); // or requireAuth?

  // Check if shop already has values
  const existingCount = await db.lookupValue.count({
    where: { shopId: ctx.shopId },
  });

  if (existingCount > 0) {
    return { success: true, message: 'Already seeded' };
  }

  try {
    // Get lookup types
    const productCategoryType = await db.lookupType.findUnique({
      where: { code: 'PRODUCT_CATEGORY' },
    });

    const expenseCategoryType = await db.lookupType.findUnique({
      where: { code: 'EXPENSE_CATEGORY' },
    });

    const incomeCategoryType = await db.lookupType.findUnique({
      where: { code: 'INCOME_CATEGORY' },
    });

    if (!productCategoryType || !expenseCategoryType) {
      return { error: 'Lookup types not found. Please run seed first.' };
    }

    // Default product categories
    const productCategories = [
      { name: 'อาหาร', code: 'food', color: '#22c55e' },
      { name: 'เครื่องดื่ม', code: 'beverage', color: '#3b82f6' },
      { name: 'ของใช้', code: 'supplies', color: '#f59e0b' },
      { name: 'อื่นๆ', code: 'other', color: '#6b7280' },
    ];

    // Default expense categories  
    const expenseCategories = [
      { name: 'ค่าเช่า', code: 'rent', color: '#ef4444' },
      { name: 'ค่าน้ำ/ค่าไฟ', code: 'utilities', color: '#f97316' },
      { name: 'ค่าจ้าง', code: 'salary', color: '#8b5cf6' },
      { name: 'ค่าขนส่ง', code: 'transport', color: '#06b6d4' },
      { name: 'อื่นๆ', code: 'other_expense', color: '#6b7280' },
    ];

    // Default income categories
    const incomeCategories = [
      { name: 'ค่าบริการ/ค่าซ่อม', code: 'service', color: '#22c55e' },
      { name: 'ค่าติดตั้ง/ค่าแรง', code: 'installation', color: '#10b981' },
      { name: 'ค่าเช่า', code: 'rental', color: '#3b82f6' },
      { name: 'ค่าคอมมิชชั่น', code: 'commission', color: '#8b5cf6' },
      { name: 'ค่าจัดส่ง', code: 'delivery', color: '#f59e0b' },
      { name: 'อื่นๆ', code: 'other_income', color: '#6b7280' },
    ];

    const dataToCreate = [
      ...productCategories.map((cat, i) => ({
        lookupTypeId: productCategoryType.id,
        shopId: ctx.shopId,
        userId: ctx.userId,
        ...cat,
        order: i + 1,
      })),
      ...expenseCategories.map((cat, i) => ({
        lookupTypeId: expenseCategoryType.id,
        shopId: ctx.shopId,
        userId: ctx.userId,
        ...cat,
        order: i + 1,
      })),
    ];

    // Add income categories if lookup type exists
    if (incomeCategoryType) {
      dataToCreate.push(
        ...incomeCategories.map((cat, i) => ({
          lookupTypeId: incomeCategoryType.id,
          shopId: ctx.shopId,
          userId: ctx.userId,
          ...cat,
          order: i + 1,
        }))
      );
    }

    await db.lookupValue.createMany({
      data: dataToCreate,
    });

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    await logger.error('Seed default values error', error as Error, { path: 'seedDefaultLookupValues' });
    return { error: 'เกิดข้อผิดพลาด' };
  }
}
