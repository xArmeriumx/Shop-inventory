import type { Permission } from '@prisma/client';
import type { z } from 'zod';
import type { ShopSessionContext } from '@/lib/auth-guard';

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

export type ToolContext = ShopSessionContext;

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
    token?: string;
  };
}

export interface AITool<TParams = any> {
  requiredPermission?: Permission;
  schema?: z.ZodType<TParams>;
  definition: ToolDefinition;
  execute: (params: TParams, context: ToolContext, confirmed?: boolean) => Promise<ToolResult>;
}

// Tool registry type
export type ToolRegistry = Record<string, AITool>;
