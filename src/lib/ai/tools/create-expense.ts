// Tool: Create Expense - บันทึกค่าใช้จ่าย

import { FinanceService } from '@/services';
import { AITool, ToolResult } from './types';
import { z } from 'zod';

const schema = z.object({
  description: z.string(),
  amount: z.number(),
  category: z.string().optional(),
});

export const createExpenseTool: AITool<z.infer<typeof schema>> = {
  requiredPermission: 'EXPENSE_CREATE',
  schema,
  definition: {
    name: 'create_expense',
    description: 'บันทึกค่าใช้จ่าย/รายจ่าย เช่น ค่าไฟ ค่าน้ำ ค่าเช่า ค่าจ้าง ค่าขนส่ง | Keywords: บันทึกค่า, จ่ายค่า, รายจ่าย, ค่าใช้จ่าย | ตัวอย่าง: "บันทึกค่าไฟ 2500", "จ่ายค่าเช่า 5000"',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'รายละเอียดค่าใช้จ่าย เช่น "ค่าไฟฟ้า" "ค่าน้ำประปา"',
        },
        amount: {
          type: 'number',
          description: 'จำนวนเงิน (บาท)',
        },
        category: {
          type: 'string',
          description: 'หมวดหมู่ค่าใช้จ่าย',
          enum: ['ค่าเช่า', 'ค่าน้ำ/ค่าไฟ', 'ค่าจ้าง', 'ค่าขนส่ง', 'อื่นๆ'],
        },
      },
      required: ['description', 'amount'],
    },
  },

  async execute(params, context, confirmed = false): Promise<ToolResult> {
    const { description, amount, category } = params;

    // If not confirmed, return confirmation request
    if (!confirmed) {
      return {
        success: true,
        message: 'กรุณายืนยันการบันทึกค่าใช้จ่าย',
        requireConfirmation: true,
        confirmationData: {
          title: '📝 บันทึกค่าใช้จ่าย',
          items: [
            { label: 'รายละเอียด', value: description, icon: '📄' },
            { label: 'จำนวนเงิน', value: `฿${Number(amount).toLocaleString()}`, icon: '💰' },
            { label: 'หมวดหมู่', value: category || 'อื่นๆ', icon: '🏷️' },
            { label: 'วันที่', value: new Date().toLocaleDateString('th-TH'), icon: '📅' },
          ],
          toolName: 'create_expense',
          params,
        },
      };
    }

    try {
      // Create expense via FinanceService (Service Layer)
      await FinanceService.createExpense({
        description,
        amount,
        category: category || 'อื่นๆ',
        date: new Date(),
      }, context);

      return {
        success: true,
        message: `✅ บันทึกค่าใช้จ่าย "${description}" จำนวน ฿${Number(amount).toLocaleString()} เรียบร้อยแล้ว!`,
      };
    } catch (error) {
      console.error('Create expense error:', error);
      return {
        success: false,
        message: '❌ เกิดข้อผิดพลาดในการบันทึกค่าใช้จ่าย',
      };
    }
  },
};
