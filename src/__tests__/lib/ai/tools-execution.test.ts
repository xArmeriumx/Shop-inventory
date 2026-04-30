import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool } from '@/lib/ai/tools';
import { Security } from '@/services/core/iam/security.service';

// Mock Security
vi.mock('@/services/core/iam/security.service', () => ({
  Security: {
    requirePermission: vi.fn(),
  }
}));

describe('AI Tool Execution', () => {
  const context = { userId: 'u1', shopId: 's1', role: 'STAFF' } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject invalid parameters based on schema', async () => {
    const result = await executeTool('create_expense', { amount: 'invalid-string' }, context, false);
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('ข้อมูลไม่ถูกต้อง');
  });

  it('should enforce RBAC requiredPermission', async () => {
    // Simulate Security throwing an error for missing permission
    (Security.requirePermission as any).mockImplementation(() => {
      throw new Error('Permission Denied');
    });

    const result = await executeTool('create_expense', { description: 'Test', amount: 100 }, context, false);
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้');
  });
});
