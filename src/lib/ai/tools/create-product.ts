// Tool: Create Product - เพิ่มสินค้าใหม่

import { ProductService } from '@/services';
import { AITool, ToolResult } from './types';
import { z } from 'zod';

const schema = z.object({
  name: z.string(),
  price: z.number(),
  cost: z.number().optional(),
  stock: z.number().optional(),
  category: z.string().optional(),
});

export const createProductTool: AITool<z.infer<typeof schema>> = {
  requiredPermission: 'PRODUCT_CREATE',
  schema,
  definition: {
    name: 'create_product',
    description: 'เพิ่มสินค้าใหม่เข้าระบบ | Keywords: เพิ่มสินค้า, สร้างสินค้า, ลงสินค้า, สินค้าใหม่ | ตัวอย่าง: "เพิ่มสินค้า Labubu ราคา 1050", "สินค้าใหม่ Test ราคา 100"',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'ชื่อสินค้า',
        },
        price: {
          type: 'number',
          description: 'ราคาขาย (บาท)',
        },
        cost: {
          type: 'number',
          description: 'ต้นทุน (บาท) - ถ้าไม่ระบุจะเท่ากับ 80% ของราคาขาย',
        },
        stock: {
          type: 'number',
          description: 'จำนวนสต็อกเริ่มต้น - ถ้าไม่ระบุจะเป็น 0',
        },
        category: {
          type: 'string',
          description: 'หมวดหมู่สินค้า',
        },
      },
      required: ['name', 'price'],
    },
  },

  async execute(params, context, confirmed = false): Promise<ToolResult> {
    const canonicalParams = {
      ...params,
      cost: params.cost ?? Math.floor(params.price * 0.8),
      stock: params.stock ?? 0,
      category: params.category ?? 'ทั่วไป',
    };

    const { name, price, stock, category, cost } = canonicalParams;

    if (!confirmed) {
      return {
        success: true,
        message: 'กรุณายืนยันการเพิ่มสินค้า',
        requireConfirmation: true,
        confirmationData: {
          title: '📦 เพิ่มสินค้าใหม่',
          items: [
            { label: 'ชื่อสินค้า', value: name, icon: '🏷️' },
            { label: 'ราคาขาย', value: `฿${Number(price).toLocaleString()}`, icon: '💵' },
            { label: 'ต้นทุน', value: `฿${Number(cost).toLocaleString()}`, icon: '💰' },
            { label: 'กำไร/ชิ้น', value: `฿${Number(price - cost).toLocaleString()}`, icon: '📈' },
            { label: 'สต็อกเริ่มต้น', value: `${stock} ชิ้น`, icon: '📊' },
            { label: 'หมวดหมู่', value: category, icon: '📁' },
          ],
          toolName: 'create_product',
          params: canonicalParams,
        },
      };
    }

    try {
      // Generate SKU
      const timestamp = Date.now().toString(36).toUpperCase();
      const sku = `PRD-${timestamp}`;

      const result = await ProductService.create(context, {
        name,
        sku,
        salePrice: price,
        costPrice: cost,
        stock: stock,
        category,
        minStock: 5,
        isActive: true,
      });

      const product = result.data;

      // Handle revalidation for AI actions too
      if (result.affectedTags && typeof window === 'undefined') {
        const { revalidateTag } = await import('next/cache');
        result.affectedTags.forEach(tag => revalidateTag(tag));
      }

      return {
        success: true,
        message: `✅ เพิ่มสินค้า "${name}" เรียบร้อยแล้ว!\n📦 SKU: ${sku}\n💵 ราคา: ฿${Number(price).toLocaleString()}\n📁 หมวดหมู่: ${category}`,
        data: { productId: product.id, sku },
      };
    } catch (error) {
      console.error('Create product error:', error);
      return {
        success: false,
        message: '❌ เกิดข้อผิดพลาดในการเพิ่มสินค้า',
      };
    }
  },
};
