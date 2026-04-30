// AI Tools Registry - Central export for all tools

import { ToolRegistry } from './types';
import { z } from 'zod';
import { Security } from '@/services/core/iam/security.service';
import { createConfirmationToken, verifyAndConsumeConfirmation } from '../tool-confirmation';
import type { ShopSessionContext } from '@/lib/auth-guard';
import { createExpenseTool } from './create-expense';
import { createIncomeTool } from './create-income';
import { createProductTool } from './create-product';
import { checkStockTool } from './check-stock';
import { generateReportTool } from './generate-report';

// Export all tools
export { createExpenseTool } from './create-expense';
export { createIncomeTool } from './create-income';
export { createProductTool } from './create-product';
export { checkStockTool } from './check-stock';
export { generateReportTool } from './generate-report';
export * from './types';

// Tool registry - add new tools here
export const toolRegistry: ToolRegistry = {
  create_expense: createExpenseTool,
  create_income: createIncomeTool,
  create_product: createProductTool,
  check_stock: checkStockTool,
  generate_report: generateReportTool,
};

// Get tool definitions for Groq API
export function getToolDefinitions() {
  return Object.values(toolRegistry).map(tool => ({
    type: 'function' as const,
    function: tool.definition,
  }));
}

// Execute a tool by name
export async function executeTool(
  toolName: string,
  params: Record<string, any>,
  context: ShopSessionContext,
  confirmed: boolean | string = false
) {
  const tool = toolRegistry[toolName];
  if (!tool) {
    return {
      success: false,
      message: `❌ ไม่พบ tool: ${toolName}`,
    };
  }

  // Parse schema
  let parsedParams = params;
  if (tool.schema) {
    try {
      parsedParams = tool.schema.parse(params);
    } catch (e: any) {
      return {
        success: false,
        message: `❌ ข้อมูลไม่ถูกต้อง: ${e.errors?.[0]?.message || e.message}`,
      };
    }
  }

  // Check required permission
  if (tool.requiredPermission) {
    try {
      Security.requirePermission(context, tool.requiredPermission);
    } catch (e: any) {
      return {
        success: false,
        message: `❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้ (${tool.requiredPermission})`,
      };
    }
  }

  // Wrap execution to intercept confirmation requests and inject tokens
  // If confirmed is a string, it's a token.
  const isConfirmed = typeof confirmed === 'string';

  if (isConfirmed) {
    const isValid = await verifyAndConsumeConfirmation(confirmed as string, toolName, parsedParams, context);
    if (!isValid) {
      return {
        success: false,
        message: `❌ การยืนยันตัวตนไม่ถูกต้อง หรือหมดอายุแล้ว โปรดลองอีกครั้ง`,
      };
    }
  }

  const result = await tool.execute(parsedParams, context, isConfirmed);

  // If tool requests confirmation, generate a token and attach to confirmationData
  if (result.requireConfirmation && result.confirmationData) {
    const canonicalParams = result.confirmationData.params;
    const token = await createConfirmationToken(toolName, canonicalParams, context);
    result.confirmationData.token = token;
  }

  return result;
}
