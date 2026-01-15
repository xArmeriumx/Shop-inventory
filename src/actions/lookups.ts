'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAuth, requirePermission, getCurrentUserId } from '@/lib/auth-guard';
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
  const userId = await getCurrentUserId();

  // Get lookup type first
  const lookupType = await db.lookupType.findUnique({
    where: { code: typeCode },
  });

  if (!lookupType) {
    return [];
  }

  // Get values: global (userId = null) + shop-specific
  const values = await db.lookupValue.findMany({
    where: {
      lookupTypeId: lookupType.id,
      isActive: true,
      deletedAt: null,
      OR: [
        { userId: null },
        { userId: userId },
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
  const userId = await getCurrentUserId();

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
      userId: userId,
      deletedAt: null,
    },
    orderBy: [
      { order: 'asc' },
      { name: 'asc' },
    ],
  });

  return values;
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
        userId: ctx.userId,
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
        userId: ctx.userId,
      },
      _max: { order: true },
    });

    await db.lookupValue.create({
      data: {
        lookupTypeId: lookupType.id,
        userId: ctx.userId,
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
    console.error('Create lookup value error:', error);
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
        userId: ctx.userId,
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
    console.error('Update lookup value error:', error);
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
        userId: ctx.userId,
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
    console.error('Delete lookup value error:', error);
    return { error: 'เกิดข้อผิดพลาดในการลบ' };
  }
}

// ==================== Seed Default Values ====================

export async function seedDefaultLookupValues() {
  const userId = await getCurrentUserId();

  // Check if user already has values
  const existingCount = await db.lookupValue.count({
    where: { userId },
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
      { name: 'อื่นๆ', code: 'other', color: '#6b7280' },
    ];

    await db.lookupValue.createMany({
      data: [
        ...productCategories.map((cat, i) => ({
          lookupTypeId: productCategoryType.id,
          userId,
          ...cat,
          order: i + 1,
        })),
        ...expenseCategories.map((cat, i) => ({
          lookupTypeId: expenseCategoryType.id,
          userId,
          ...cat,
          order: i + 1,
        })),
      ],
    });

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    console.error('Seed default values error:', error);
    return { error: 'เกิดข้อผิดพลาด' };
  }
}
