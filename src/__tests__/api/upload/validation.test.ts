import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/upload/route';

// Mocks
vi.mock('@/lib/auth/api-guard', () => ({
  withAuth: (handler: any) => handler
}));
vi.mock('@/lib/auth-guard', () => ({
  getSessionContext: vi.fn().mockResolvedValue({ shopId: 'shop_123', isOwner: true })
}));

// Provide access to the inner handler without auth guard middleware logic
// @ts-ignore - bypassing withAuth for test
const routeHandler = POST;

describe('Upload API Route Validation', () => {
  it('should reject missing profile', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['fake content']), 'test.jpg');
    
    const request = {
      formData: vi.fn().mockResolvedValue(formData)
    } as unknown as NextRequest;

    const response = await routeHandler(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid or missing upload profile');
  });

  it('should reject invalid profile', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['fake content']), 'test.jpg');
    formData.append('profile', 'invalid-profile');
    
    const request = {
      formData: vi.fn().mockResolvedValue(formData)
    } as unknown as NextRequest;

    const response = await routeHandler(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid or missing upload profile');
  });

  it('should reject empty files before buffering', async () => {
    const formData = new FormData();
    // Empty file
    formData.append('file', new Blob([]), 'empty.jpg');
    formData.append('profile', 'product-image');
    
    const request = {
      formData: vi.fn().mockResolvedValue(formData)
    } as unknown as NextRequest;

    const response = await routeHandler(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toContain('Empty file is not allowed');
  });

  it('should reject oversized files before buffering', async () => {
    const formData = new FormData();
    
    // Create a real 11MB file in memory to avoid FormData stripping mocked properties
    const fakeFile = new File([new Uint8Array(11 * 1024 * 1024)], 'test.jpg', { type: 'image/jpeg' });

    formData.append('file', fakeFile);
    formData.append('profile', 'product-image');
    
    const request = {
      formData: vi.fn().mockResolvedValue(formData)
    } as unknown as NextRequest;

    const response = await routeHandler(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toContain('File too large');
  });
});
