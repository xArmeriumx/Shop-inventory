import { describe, it, expect } from 'vitest';
import { redact } from '@/lib/redact';

describe('Log Redaction Utility', () => {
  it('should redact sensitive keys in a flat object', () => {
    const input = {
      username: 'johndoe',
      password: 'my-secret-password',
      email: 'john@example.com',
      token: 'jwt-token-123'
    };
    
    const output = redact(input);
    expect(output.username).toBe('johndoe');
    expect(output.email).toBe('john@example.com');
    expect(output.password).toBe('***REDACTED***');
    expect(output.token).toBe('***REDACTED***');
  });

  it('should redact sensitive keys case-insensitively', () => {
    const input = {
      AccessToken: '123',
      PASSWORD_HASH: 'abc'
    };
    
    const output = redact(input);
    expect(output.AccessToken).toBe('***REDACTED***');
    expect(output.PASSWORD_HASH).toBe('***REDACTED***');
  });

  it('should redact sensitive keys in nested objects', () => {
    const input = {
      user: {
        id: '123',
        credentials: {
          secret: 'shh'
        }
      }
    };
    
    const output = redact(input);
    expect(output.user.id).toBe('123');
    expect(output.user.credentials.secret).toBe('***REDACTED***');
  });

  it('should redact items within arrays', () => {
    const input = [
      { id: 1, password: 'p1' },
      { id: 2, password: 'p2' }
    ];
    
    const output = redact(input);
    expect(output[0].password).toBe('***REDACTED***');
    expect(output[1].password).toBe('***REDACTED***');
  });

  it('should redact large image base64 strings', () => {
    const largeString = 'a'.repeat(2000);
    const input = {
      receiptImage: largeString
    };
    
    const output = redact(input);
    expect(output.receiptImage).toContain('***REDACTED_LARGE_STRING');
  });

  it('should handle null and undefined', () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  describe('redactString', () => {
    it('should redact bearer tokens in strings', () => {
      const input = 'Error: failed request Authorization=Bearer secret-token-123';
      const output = redact(input);
      expect(output).toContain('Authorization=Bearer ***REDACTED***');
      expect(output).not.toContain('secret-token-123');
    });

    it('should redact query string tokens', () => {
      const input = 'fetch https://api.example.com?apiKey=sk_live_123&other=val';
      const output = redact(input);
      expect(output).toContain('apiKey=***REDACTED***');
      expect(output).not.toContain('sk_live_123');
    });

    it('should redact credential pairs', () => {
      const input = 'Cookie: sessionToken=abc.jwt.secret';
      const output = redact(input);
      expect(output).toContain('Cookie: ***REDACTED***');
      expect(output).not.toContain('abc.jwt.secret');
    });

    it('should not redact safe keys', () => {
      const input = { sessionVersion: 'v1', permissionVersion: 'v2', roleId: '123', isOwner: true };
      const output = redact(input);
      expect(output.sessionVersion).toBe('v1');
      expect(output.permissionVersion).toBe('v2');
      expect(output.roleId).toBe('123');
      expect(output.isOwner).toBe(true);
    });
  });
});
