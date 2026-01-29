// AI Tool Types - Modular tool definition for easy maintenance

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export interface ToolContext {
  userId: string;
  shopId: string;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
  requireConfirmation?: boolean;
  confirmationData?: {
    title: string;
    items: { label: string; value: string; icon?: string }[];
    toolName: string;
    params: Record<string, any>;
  };
}

export interface AITool {
  definition: ToolDefinition;
  execute: (params: Record<string, any>, context: ToolContext, confirmed?: boolean) => Promise<ToolResult>;
}

// Tool registry type
export type ToolRegistry = Record<string, AITool>;
