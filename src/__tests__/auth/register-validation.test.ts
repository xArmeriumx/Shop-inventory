import { describe, it, expect } from 'vitest';
import { registerSchema } from '@/schemas/core/auth.schema';

describe('Auth Validation', () => {
  it('should validate correct registration data', () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'superSecretPassword123'
    };
    expect(() => registerSchema.parse(validData)).not.toThrow();
  });

  it('should reject short passwords', () => {
    const invalidData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'short'
    };
    expect(() => registerSchema.parse(invalidData)).toThrow('รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร');
  });

  it('should reject invalid emails', () => {
    const invalidData = {
      name: 'John Doe',
      email: 'not-an-email',
      password: 'superSecretPassword123'
    };
    expect(() => registerSchema.parse(invalidData)).toThrow('รูปแบบอีเมลไม่ถูกต้อง');
  });
});
