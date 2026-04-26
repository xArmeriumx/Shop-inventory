import { z } from 'zod';

/**
 * Shared entity ID schema (CUID v2 / UUID standard)
 * Used to validate IDs in Server Actions before passing to Service Layer.
 */
export const entityIdSchema = z.string()
  .min(1, 'ต้องระบุ ID')
  .max(128, 'ID ยาวเกินกำหนด')
  .describe('รหัสอ้างอิงนิติสัมพันธ์');

export type EntityIdInput = z.infer<typeof entityIdSchema>;

export const queryParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
}).partial();
