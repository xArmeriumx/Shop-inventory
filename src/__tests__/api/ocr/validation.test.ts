import { describe, it, expect } from 'vitest';
import { validateOcrImageBase64, validateOcrText, MAX_OCR_TEXT_CHARS } from '@/lib/ocr/input-validation';

describe('OCR Input Validation', () => {
  describe('validateOcrImageBase64', () => {
    it('should reject empty input', () => {
      const res = validateOcrImageBase64('');
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain('กรุณาอัพโหลดรูปภาพ');
    });

    it('should reject too large image', () => {
      // 6MB of base64
      const largeString = 'a'.repeat(8 * 1024 * 1024);
      const res = validateOcrImageBase64(largeString);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain('ขนาดรูปภาพเกิน 5MB');
    });

    it('should reject invalid magic bytes', () => {
      // Valid base64 but underlying bytes are not an image
      const badBase64 = Buffer.from('<html></html>').toString('base64');
      const res = validateOcrImageBase64(badBase64);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain('รูปแบบรูปภาพไม่ถูกต้อง');
    });

    it('should accept valid JPEG base64', () => {
      const jpegBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]).toString('base64');
      const res = validateOcrImageBase64(jpegBase64);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.mime).toBe('image/jpeg');
    });
  });

  describe('validateOcrText', () => {
    it('should reject empty text', () => {
      expect(validateOcrText('')).toContain('ไม่มีข้อมูลข้อความ');
    });

    it('should reject text exceeding max length', () => {
      const largeText = 'a'.repeat(MAX_OCR_TEXT_CHARS + 1);
      expect(validateOcrText(largeText)).toContain('ข้อความยาวเกินไป');
    });

    it('should accept valid text', () => {
      expect(validateOcrText('Valid receipt data')).toBeNull();
    });
  });
});
