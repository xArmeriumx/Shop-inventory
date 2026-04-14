import { db } from '@/lib/db';
import { RequestContext, ServiceError } from './product.service';
import { LookupTypeCode } from '@prisma/client';

export interface CreateLookupValueInput {
  name: string;
  color?: string;
  icon?: string;
}

export const LookupService = {
  async getLookupTypes() {
    return db.lookupType.findMany({
      orderBy: { name: 'asc' },
    });
  },

  async getLookupValues(typeCode: LookupTypeCode, ctx: RequestContext) {
    const lookupType = await db.lookupType.findUnique({
      where: { code: typeCode },
    });

    if (!lookupType) return [];

    return db.lookupValue.findMany({
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
  },

  async getLookupValuesForSettings(typeCode: LookupTypeCode, ctx: RequestContext) {
    const lookupType = await db.lookupType.findUnique({
      where: { code: typeCode },
    });

    if (!lookupType) return [];

    return db.lookupValue.findMany({
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
  },

  async quickAddCategory(typeCode: LookupTypeCode, name: string, ctx: RequestContext) {
    const trimmedName = name.trim();
    const lookupType = await db.lookupType.findUnique({
      where: { code: typeCode },
    });

    if (!lookupType) throw new ServiceError('ไม่พบประเภทหมวดหมู่');

    const code = trimmedName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_\u0E00-\u0E7F]/g, '');

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

    if (existing) throw new ServiceError('มีหมวดหมู่นี้อยู่แล้ว');

    const maxOrder = await db.lookupValue.aggregate({
      where: { lookupTypeId: lookupType.id, shopId: ctx.shopId },
      _max: { order: true },
    });

    return db.lookupValue.create({
      data: {
        lookupTypeId: lookupType.id,
        shopId: ctx.shopId,
        userId: ctx.userId,
        code: code || `custom_${Date.now()}`,
        name: trimmedName,
        order: (maxOrder._max.order || 0) + 1,
      },
    });
  },

  async createLookupValue(typeCode: LookupTypeCode, input: CreateLookupValueInput, ctx: RequestContext) {
    const lookupType = await db.lookupType.findUnique({
      where: { code: typeCode },
    });

    if (!lookupType) throw new ServiceError('ไม่พบประเภทหมวดหมู่');

    const code = input.name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    const existing = await db.lookupValue.findFirst({
      where: {
        lookupTypeId: lookupType.id,
        shopId: ctx.shopId,
        code: code,
        deletedAt: null,
      },
    });

    if (existing) throw new ServiceError('มีหมวดหมู่นี้อยู่แล้ว');

    const maxOrder = await db.lookupValue.aggregate({
      where: { lookupTypeId: lookupType.id, shopId: ctx.shopId },
      _max: { order: true },
    });

    return db.lookupValue.create({
      data: {
        lookupTypeId: lookupType.id,
        shopId: ctx.shopId,
        userId: ctx.userId,
        code: code,
        name: input.name,
        color: input.color,
        icon: input.icon,
        order: (maxOrder._max.order || 0) + 1,
      },
    });
  },

  async updateLookupValue(id: string, input: Partial<CreateLookupValueInput>, ctx: RequestContext) {
    const existing = await db.lookupValue.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูล หรือไม่มีสิทธิ์แก้ไข');
    if (existing.isSystem) throw new ServiceError('ไม่สามารถแก้ไขข้อมูลระบบได้');

    return db.lookupValue.update({
      where: { id },
      data: input,
    });
  },

  async deleteLookupValue(id: string, ctx: RequestContext) {
    const existing = await db.lookupValue.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
      include: {
        _count: {
          select: { products: true, expenses: true },
        },
      },
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูล หรือไม่มีสิทธิ์ลบ');
    if (existing.isSystem) throw new ServiceError('ไม่สามารถลบข้อมูลระบบได้');

    const inUseCount = existing._count.products + existing._count.expenses;
    if (inUseCount > 0) {
      throw new ServiceError(`ไม่สามารถลบได้ เนื่องจากมีข้อมูล ${inUseCount} รายการใช้หมวดหมู่นี้อยู่`);
    }

    return db.lookupValue.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async seedDefaultLookupValues(ctx: RequestContext) {
    const existingCount = await db.lookupValue.count({
      where: { shopId: ctx.shopId },
    });

    if (existingCount > 0) return { success: true };

    const [productCategoryType, expenseCategoryType, incomeCategoryType] = await Promise.all([
      db.lookupType.findUnique({ where: { code: 'PRODUCT_CATEGORY' } }),
      db.lookupType.findUnique({ where: { code: 'EXPENSE_CATEGORY' } }),
      db.lookupType.findUnique({ where: { code: 'INCOME_CATEGORY' } }),
    ]);

    if (!productCategoryType || !expenseCategoryType) {
      throw new ServiceError('Lookup types not found. Please run seed first.');
    }

    const dataToCreate: any[] = [];
    
    // Helper to add categories
    const addCategories = (categories: any[], typeId: string) => {
      categories.forEach((cat, i) => {
        dataToCreate.push({
          lookupTypeId: typeId,
          shopId: ctx.shopId,
          userId: ctx.userId,
          ...cat,
          order: i + 1,
        });
      });
    };

    addCategories([
      { name: 'อาหาร', code: 'food', color: '#22c55e' },
      { name: 'เครื่องดื่ม', code: 'beverage', color: '#3b82f6' },
      { name: 'ของใช้', code: 'supplies', color: '#f59e0b' },
      { name: 'อื่นๆ', code: 'other', color: '#6b7280' },
    ], productCategoryType.id);

    addCategories([
      { name: 'ค่าเช่า', code: 'rent', color: '#ef4444' },
      { name: 'ค่าน้ำ/ค่าไฟ', code: 'utilities', color: '#f97316' },
      { name: 'ค่าจ้าง', code: 'salary', color: '#8b5cf6' },
      { name: 'ค่าขนส่ง', code: 'transport', color: '#06b6d4' },
      { name: 'อื่นๆ', code: 'other_expense', color: '#6b7280' },
    ], expenseCategoryType.id);

    if (incomeCategoryType) {
      addCategories([
        { name: 'ค่าบริการ/ค่าซ่อม', code: 'service', color: '#22c55e' },
        { name: 'ค่าติดตั้ง/ค่าแรง', code: 'installation', color: '#10b981' },
        { name: 'ค่าเช่า', code: 'rental', color: '#3b82f6' },
        { name: 'ค่าคอมมิชชั่น', code: 'commission', color: '#8b5cf6' },
        { name: 'ค่าจัดส่ง', code: 'delivery', color: '#f59e0b' },
        { name: 'อื่นๆ', code: 'other_income', color: '#6b7280' },
      ], incomeCategoryType.id);
    }

    return db.lookupValue.createMany({ data: dataToCreate });
  }
};
