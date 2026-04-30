import { describe, it, expect } from 'vitest';
import { detectMimeTypeFromBuffer } from '@/lib/upload/magic-bytes';

describe('Magic Bytes Validation', () => {
  it('should detect valid JPEG', () => {
    // FFD8FFE0
    const buffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(detectMimeTypeFromBuffer(buffer)).toBe('image/jpeg');
  });

  it('should detect valid PNG', () => {
    // 89504e47
    const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(detectMimeTypeFromBuffer(buffer)).toBe('image/png');
  });

  it('should detect valid PDF', () => {
    // 25504446
    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3]);
    expect(detectMimeTypeFromBuffer(buffer)).toBe('application/pdf');
  });

  it('should detect valid WEBP', () => {
    // RIFF....WEBP
    const buffer = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1c, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(detectMimeTypeFromBuffer(buffer)).toBe('image/webp');
  });

  it('should reject invalid files (e.g. text/html spoofed as png)', () => {
    const buffer = new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00]); // <html>
    expect(detectMimeTypeFromBuffer(buffer)).toBeNull();
  });

  it('should reject too short buffers', () => {
    const buffer = new Uint8Array([0xff, 0xd8, 0xff]);
    expect(detectMimeTypeFromBuffer(buffer)).toBeNull();
  });
});
