import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createConfirmationToken, verifyAndConsumeConfirmation } from '@/lib/ai/tool-confirmation';
import { redis } from '@/lib/rate-limit';

vi.mock('@/lib/rate-limit', () => ({
  redis: {
    setex: vi.fn(),
    del: vi.fn(),
  }
}));

describe('Tool Confirmation Security', () => {
  const context = { userId: 'u1', shopId: 's1', role: 'OWNER' } as any;
  const toolName = 'create_expense';
  const params = { amount: 100, description: 'Test' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a signed token and store in redis', async () => {
    const token = await createConfirmationToken(toolName, params, context);
    
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(2);
    expect(redis.setex).toHaveBeenCalled();
  });

  it('should verify a valid token successfully', async () => {
    // Mock redis.del to simulate successful deletion (token existed)
    (redis.del as any).mockResolvedValue(1);

    const token = await createConfirmationToken(toolName, params, context);
    const isValid = await verifyAndConsumeConfirmation(token, toolName, params, context);
    
    expect(isValid).toBe(true);
    expect(redis.del).toHaveBeenCalled();
  });

  it('should reject if params are tampered', async () => {
    (redis.del as any).mockResolvedValue(1);
    const token = await createConfirmationToken(toolName, params, context);
    
    const tamperedParams = { amount: 200, description: 'Test' };
    const isValid = await verifyAndConsumeConfirmation(token, toolName, tamperedParams, context);
    
    expect(isValid).toBe(false);
  });

  it('should reject if token is already consumed (replay attack)', async () => {
    // Simulating token not found in redis
    (redis.del as any).mockResolvedValue(0);
    const token = await createConfirmationToken(toolName, params, context);
    
    const isValid = await verifyAndConsumeConfirmation(token, toolName, params, context);
    
    expect(isValid).toBe(false);
  });
});
