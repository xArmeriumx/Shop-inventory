// Tool: Create Product - เพิ่มสินค้าใหม่

import { db } from '@/lib/db';
import { AITool, ToolResult, ToolContext } from './types';
import { StockService } from '@/services';

export const createProductTool: AITool = {
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
    const { name, price, stock = 0, category = 'ทั่วไป' } = params;
    // Default cost to 80% of price if not specified
    const cost = params.cost ?? Math.floor(price * 0.8);

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
          params: { ...params, cost, category },
        },
      };
    }

    try {
      // Generate SKU
      const timestamp = Date.now().toString(36).toUpperCase();
      const sku = `PRD-${timestamp}`;

      const product = await db.$transaction(async (tx) => {
        // 1. Create product with stock = 0 (StockService will set the real value)
        const newProduct = await tx.product.create({
          data: {
            name,
            sku,
            salePrice: price,
            costPrice: cost,
            stock: 0,
            category,
            minStock: 5,
            isActive: true,
            userId: context.userId,
            shopId: context.shopId,
          },
        });

        // 2. If initial stock > 0, record via StockService (creates StockLog)
        if (stock > 0) {
          await StockService.recordMovement(context as any, {
            productId: newProduct.id,
            type: 'ADJUSTMENT',
            quantity: stock,
            userId: context.userId,
            shopId: context.shopId,
            note: 'สต็อกเริ่มต้น (AI สร้างสินค้า)',
            tx,
          });
        }

        return newProduct;
      });

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
