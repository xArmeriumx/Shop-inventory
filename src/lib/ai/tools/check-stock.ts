// Tool: Check Stock - เช็คสต็อกสินค้า (Read-only, no confirmation needed)

import { db } from '@/lib/db';
import { AITool, ToolResult, ToolContext } from './types';

export const checkStockTool: AITool = {
  definition: {
    name: 'check_stock',
    description: 'เช็คสต็อก/จำนวนคงเหลือของสินค้า | Keywords: เช็คสต็อก, ดูสต็อก, เหลือเท่าไหร่, เหลือกี่ชิ้น, มีกี่อัน | ตัวอย่าง: "เช็คสต็อก Labubu", "สินค้า Molly เหลือเท่าไหร่"',
    parameters: {
      type: 'object',
      properties: {
        productName: {
          type: 'string',
          description: 'ชื่อสินค้าที่ต้องการเช็ค (สามารถเป็นชื่อบางส่วนได้)',
        },
      },
      required: ['productName'],
    },
  },

  async execute(params, context): Promise<ToolResult> {
    const { productName } = params;

    try {
      // Search products by name
      const products = await db.product.findMany({
        where: {
          shopId: context.shopId,
          deletedAt: null,
          name: {
            contains: productName,
            mode: 'insensitive',
          },
        },
        select: {
          name: true,
          sku: true,
          stock: true,
          minStock: true,
          salePrice: true, // Fixed: use salePrice instead of price
          isLowStock: true,
        },
        take: 5,
      });

      if (products.length === 0) {
        return {
          success: true,
          message: `🔍 ไม่พบสินค้าที่ชื่อ "${productName}"\n\nลองค้นหาด้วยชื่ออื่น หรือตรวจสอบการสะกด`,
        };
      }

      // Format results
      const results = products.map(p => {
        const status = p.isLowStock ? '⚠️ ใกล้หมด' : '✅ ปกติ';
        return `📦 **${p.name}**\n   SKU: ${p.sku}\n   คงเหลือ: ${p.stock} ชิ้น (ขั้นต่ำ: ${p.minStock})\n   ราคา: ฿${Number(p.salePrice).toLocaleString()}\n   สถานะ: ${status}`;
      }).join('\n\n');

      return {
        success: true,
        message: `🔍 **ผลการค้นหา "${productName}"**\n\n${results}`,
        data: products,
      };
    } catch (error) {
      console.error('Check stock error:', error);
      return {
        success: false,
        message: '❌ เกิดข้อผิดพลาดในการค้นหาสินค้า',
      };
    }
  },
};
