// AI Tools Registry - Central export for all tools

import { ToolRegistry } from './types';
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
  context: { userId: string; shopId: string },
  confirmed: boolean = false
) {
  const tool = toolRegistry[toolName];
  if (!tool) {
    return {
      success: false,
      message: `❌ ไม่พบ tool: ${toolName}`,
    };
  }
  return tool.execute(params, context, confirmed);
}
