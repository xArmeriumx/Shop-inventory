// Tool: Create Income - บันทึกรายรับอื่นๆ

import { FinanceService } from '@/services';
import { AITool, ToolResult } from './types';
import { z } from 'zod';

const schema = z.object({
  description: z.string(),
  amount: z.number(),
  category: z.string().optional(),
});

export const createIncomeTool: AITool<z.infer<typeof schema>> = {
  requiredPermission: 'FINANCE_CONFIG',
  schema,
  definition: {
    name: 'create_income',
    description: 'บันทึกรายรับอื่นๆ (ไม่ใช่การขายสินค้า) เช่น ค่าบริการ ค่าซ่อม ค่าติดตั้ง ค่าแรง ค่าคอมมิชชั่น | Keywords: บันทึกรายรับ, ค่าซ่อม, ค่าบริการ, รับเงิน | ตัวอย่าง: "บันทึกค่าซ่อม 500", "ค่าบริการ 200"',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'รายละเอียดรายรับ เช่น "ค่าซ่อมมือถือ" "ค่าติดตั้งซอฟต์แวร์"',
        },
        amount: {
          type: 'number',
          description: 'จำนวนเงิน (บาท)',
        },
        category: {
          type: 'string',
          description: 'หมวดหมู่รายรับ',
          enum: ['ค่าบริการ/ค่าซ่อม', 'ค่าติดตั้ง/ค่าแรง', 'ค่าเช่า', 'ค่าคอมมิชชั่น', 'ค่าจัดส่ง', 'อื่นๆ'],
        },
      },
      required: ['description', 'amount'],
    },
  },

  async execute(params, context, confirmed = false): Promise<ToolResult> {
    const { description, amount, category } = params;

    if (!confirmed) {
      return {
        success: true,
        message: 'กรุณายืนยันการบันทึกรายรับ',
        requireConfirmation: true,
        confirmationData: {
          title: '💵 บันทึกรายรับอื่นๆ',
          items: [
            { label: 'รายละเอียด', value: description, icon: '📄' },
            { label: 'จำนวนเงิน', value: `฿${Number(amount).toLocaleString()}`, icon: '💰' },
            { label: 'หมวดหมู่', value: category || 'อื่นๆ', icon: '🏷️' },
            { label: 'วันที่', value: new Date().toLocaleDateString('th-TH'), icon: '📅' },
          ],
          toolName: 'create_income',
          params,
        },
      };
    }

    try {
      // Use Service Layer instead of direct DB access
      const income = await FinanceService.createIncome({
        description,
        amount,
        category: category || 'อื่นๆ',
        date: new Date(),
      }, context);

      return {
        success: true,
        message: `✅ บันทึกรายรับ "${description}" จำนวน ฿${Number(amount).toLocaleString()} เรียบร้อยแล้ว!`,
        data: { incomeId: income.data.id },
      };
    } catch (error) {
      console.error('Create income error:', error);
      return {
        success: false,
        message: '❌ เกิดข้อผิดพลาดในการบันทึกรายรับ',
      };
    }
  },
};
